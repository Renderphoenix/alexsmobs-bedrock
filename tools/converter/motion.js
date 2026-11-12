// Motion engine: turns the gait data recorded from the Java mod (walk/swing/flap/bob/chain/faceTarget calls and the
// compiled pose channels) into our own clean keyframed animations - no per-frame Molang, no state variables.
//  - gaits are filtered per state (ground / fly / swim) by evaluating their guard conditions numerically
//  - limb gaits (driven by limbSwing) become looping walk/run cycles, time gaits (ageInTicks) idle/flap loops
//  - posture changes (sit / sleep / stand / fly / swim) become static pose deltas blended in by controllers
'use strict';
const M = require('./molang');

const DEG = 180 / Math.PI;
const r3 = n => Math.round(n * 1000) / 1000 || 0;
const r2 = n => Math.round(n * 100) / 100 || 0;
const tkey = t => String(Math.round(t * 10000) / 10000);

// ------------------------------------------------------------------ tiny Molang evaluator (numbers only)
const MATH = {
  sin: d => Math.sin(d / DEG), cos: d => Math.cos(d / DEG), abs: Math.abs, min: Math.min, max: Math.max,
  clamp: (x, a, b) => Math.min(Math.max(x, a), b), sqrt: Math.sqrt, floor: Math.floor, trunc: Math.trunc,
  mod: (a, b) => (b ? a % b : 0), lerp: (a, b, t) => a + (b - a) * t, pow: Math.pow, atan2: (y, x) => Math.atan2(y, x) * DEG,
  random: () => 0.5, random_integer: a => a,
};
const fnCache = new Map();
function evalM(str, env) {
  if (typeof str === 'number') return str;
  const js = String(str)
    .replace(/(^|[^A-Za-z0-9_.])(v|q|variable|query)[.]([a-z_0-9]+)/gi, (m, p, a, b) => `${p}E("${a[0].toLowerCase()}.${b.toLowerCase()}")`)
    .replace(/(^|[^A-Za-z0-9_.])math[.]/gi, (m, p) => p + 'MATH.');
  let fn = fnCache.get(js);
  if (!fn) { try { fn = new Function('E', 'MATH', 'return (' + js + ');'); } catch { fn = () => 0; } fnCache.set(js, fn); }
  try { const v = Number(fn(k => (env[k] === undefined ? 0 : env[k]), MATH)); return Number.isFinite(v) ? v : 0; } catch { return 0; }
}

// ------------------------------------------------------------------ states
const TARGET = {
  fly: 'v.am_flying', swim: 'q.is_in_water', sit: 'q.is_sitting', sleep: 'v.am_sleeping', stand: 'v.am_standing',
  eat: 'v.am_eating', climb: 'q.is_wall_climbing', dig: 'v.am_digging', roll: 'v.am_rolling', perch: 'v.am_perching', dance: 'v.am_dancing',
};
function stateEnv(state, progress) {
  const env = { 'q.is_on_ground': 1, 'q.is_in_water': 0, 'v.ls': 0, 'v.lsa': 0, 'v.age': 0, 'v.yaw': 0, 'v.pitch': 0 };
  const target = TARGET[state];
  if (!target) return env;
  env[target] = 1;
  for (const [k, p] of progress) if (p.target === target) env['v.p_' + k] = p.max || 5;
  if (state === 'fly' || state === 'swim') env['q.is_on_ground'] = 0;
  return env;
}

// ------------------------------------------------------------------ gait normalisation
const lin = (expr, v, env) => evalM(expr, Object.assign({}, env, { [v]: 1 })) - evalM(expr, Object.assign({}, env, { [v]: 0 }));
function normGait(g, env) {
  const n = x => (typeof x === 'number' ? x : x === undefined ? 0 : evalM(x, env));
  const fs = String(g.f);
  const limb = /v\.ls\b/.test(fs);
  const kf = limb ? lin(fs, 'v.ls', env) : lin(fs, 'v.age', env);
  const f1s = String(g.f1);
  let f1;
  if (typeof g.f1 === 'number') f1 = g.f1;
  else if (/v\.lsa\b/.test(f1s)) f1 = { limb: lin(f1s, 'v.lsa', env) || 1 };
  else if (/v\.p_/.test(f1s)) f1 = 1;
  else f1 = evalM(f1s, env);
  return {
    kind: g.kind, bone: g.bone, axis: g.axis, limb, kf: kf || 1,
    speed: n(g.speed), degree: n(g.degree), invert: !!n(g.invert), offset: n(g.offset), weight: n(g.weight), bounce: !!n(g.bounce),
    rootOffset: n(g.rootOffset), index: g.index || 0, count: g.count || 1, f1,
  };
}
function activeGaits(raw, env) {
  const out = [];
  const seen = new Set();
  for (const g of raw) {
    if (g.kind === 'face') continue;
    if (!g.guard.every(lit => evalM(lit, env) !== 0)) continue;
    const ng = normGait(g, env);
    const key = JSON.stringify([ng.kind, ng.bone, ng.axis, ng.speed, ng.degree, ng.invert, ng.offset, ng.weight, ng.index, ng.limb, ng.f1]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ng);
  }
  return out;
}

// ------------------------------------------------------------------ sampling
function gaitValue(g, t, w, L, amp) {
  const f1 = typeof g.f1 === 'object' ? g.f1.limb * amp : g.f1;
  const th = (2 * Math.PI * g.n * t) / L;
  switch (g.kind) {
    case 'walk': {
      const r = Math.cos(th + g.offset) * g.degree * f1 + g.weight * f1;
      return { rot: g.axis, v: (g.invert ? -r : r) * DEG };
    }
    case 'chain': {
      const off = (g.rootOffset * Math.PI) / (2 * g.count);
      return { rot: g.axis, v: Math.cos(th + g.index * off) * f1 * g.degree * DEG };
    }
    case 'bob': {
      const s = Math.sin(th);
      const bob = g.bounce ? -Math.abs(s * f1 * g.degree) : s * f1 * g.degree - f1 * g.degree;
      return { pos: 'y', v: -bob };
    }
  }
  return null;
}

// gaits: normalised list; opts: { rate (limb units / s), amp (limb swing amount), minL, maxL, delta (static pose per bone id) }
function buildLoop(gaits, opts) {
  const rate = opts.rate || 6, amp = opts.amp === undefined ? 0.7 : opts.amp;
  const ws = gaits.map(g => Math.abs(g.speed * g.kf) * (g.limb ? rate : 20)).filter(w => w > 1e-6);
  if (!ws.length && !opts.delta) return null;
  let L = opts.fixedL;
  if (!L) {
    const wmin = ws.length ? Math.min(...ws) : 1;
    L = Math.min(opts.maxL || 4.8, Math.max(opts.minL || 0.8, (2 * Math.PI) / wmin));
  }
  let maxN = 1;
  for (const g of gaits) {
    const w = Math.abs(g.speed * g.kf) * (g.limb ? rate : 20);
    g.n = Math.max(1, Math.round((w * L) / (2 * Math.PI)));
    if (g.kf < 0 || g.speed < 0) g.n = g.n; // sign handled by phase offset only
    maxN = Math.max(maxN, g.n);
  }
  const N = Math.min(opts.maxKeys || 120, Math.max(16, Math.ceil(10 * maxN)));
  const per = new Map(); // bone -> { rot: {t:[x,y,z]}, pos: {t:[..]} }
  const touch = id => { if (!per.has(id)) per.set(id, { rot: [], pos: [] }); return per.get(id); };
  for (const g of gaits) touch(g.bone);
  if (opts.delta) for (const id of Object.keys(opts.delta)) touch(+id);
  for (let k = 0; k <= N; k++) {
    const t = (L * k) / N;
    const acc = new Map();
    for (const [id] of per) acc.set(id, { rot: [0, 0, 0], pos: [0, 0, 0] });
    for (const g of gaits) {
      const v = gaitValue(g, t, 0, L, amp);
      if (!v) continue;
      const a = acc.get(g.bone);
      if (v.rot) a.rot['xyz'.indexOf(v.rot)] += v.v;
      if (v.pos) a.pos['xyz'.indexOf(v.pos)] += v.v;
    }
    for (const [id, a] of acc) {
      const d = opts.delta && opts.delta[id];
      if (d) { for (let i = 0; i < 3; i++) { a.rot[i] += d.rot[i]; a.pos[i] += d.pos[i]; } }
      const p = per.get(id);
      for (let i = 0; i < 3; i++) a.rot[i] = Math.max(-85, Math.min(85, a.rot[i]));
      p.rot.push([t, a.rot.map(r2)]);
      p.pos.push([t, a.pos.map(r2)]);
    }
  }
  return { length: r3(L), bones: per };
}

// per-bone sample lists -> Bedrock bone objects (drops all-zero channels and merges constant ones)
function toBones(loop, names, scale = 1) {
  const bones = {};
  for (const [id, p] of loop.bones) {
    const name = names.get(id);
    if (!name) continue;
    const o = {};
    for (const [key, list] of [['rotation', p.rot], ['position', p.pos]]) {
      if (list.every(([, v]) => v.every(x => x === 0))) continue;
      const first = list[0][1];
      if (list.every(([, v]) => v.every((x, i) => x === first[i]))) { o[key] = first.map(x => r2(x * scale)); continue; }
      const kf = {};
      list.forEach(([t, v], i) => {
        // drop keys that sit exactly on the line between neighbours
        const a = list[i - 1], b = list[i + 1];
        if (a && b) {
          const f = (t - a[0]) / (b[0] - a[0]);
          if (v.every((x, j) => Math.abs(x - (a[1][j] + (b[1][j] - a[1][j]) * f)) < 0.01)) return;
        }
        kf[tkey(t)] = v.map(x => r2(x * scale));
      });
      o[key] = kf;
    }
    if (Object.keys(o).length) bones[name] = o;
  }
  return bones;
}

// ------------------------------------------------------------------ static pose deltas from the compiled channels
function poseValues(chan, env) {
  const vals = new Map();
  for (const [k, v] of chan) vals.set(k, evalM(M.str(M.toVal(v)), env));
  return vals;
}
// returns { boneId: { rot, pos, scl } } for state env relative to base env (degrees / px)
function poseDelta(chan, env, base) {
  const a = poseValues(chan, env), b = poseValues(chan, base);
  const out = {};
  for (const [k, va] of a) {
    const m = k.match(/^(\d+)(rx|ry|rz|px|py|pz|sx|sy|sz)$/);
    if (!m) continue;
    const d = va - (b.get(k) || 0);
    if (Math.abs(d) < 1e-5) continue;
    const id = +m[1];
    const o = out[id] || (out[id] = { rot: [0, 0, 0], pos: [0, 0, 0], scl: [1, 1, 1] });
    const ax = 'xyz'.indexOf(m[2][1]);
    if (m[2][0] === 'r') o.rot[ax] = d * DEG;
    else if (m[2][0] === 'p') o.pos[ax] = ax === 1 ? -d : d;
    else o.scl[ax] = 1 + d;
  }
  for (const id of Object.keys(out)) {
    const o = out[id];
    const small = o.rot.every(x => Math.abs(x) < 0.4) && o.pos.every(x => Math.abs(x) < 0.05) && o.scl.every(x => Math.abs(x - 1) < 0.01);
    if (small) delete out[id];
  }
  return out;
}
function deltaToBones(delta, names, lim = 50) {
  const bones = {};
  for (const [id, o] of Object.entries(delta)) {
    const name = names.get(+id);
    if (!name) continue;
    const b = {};
    if (o.rot.some(x => Math.abs(x) >= 0.4)) b.rotation = o.rot.map(x => r2(Math.max(-lim * 2, Math.min(lim * 2, x))));
    if (o.pos.some(x => Math.abs(x) >= 0.05)) b.position = o.pos.map(r2);
    if (o.scl.some(x => Math.abs(x - 1) >= 0.01)) b.scale = o.scl.map(r3);
    if (Object.keys(b).length) bones[name] = b;
  }
  return bones;
}

module.exports = { evalM, stateEnv, activeGaits, buildLoop, toBones, poseDelta, deltaToBones, TARGET, r2, r3, tkey, DEG };
