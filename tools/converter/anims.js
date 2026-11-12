// Animation generation:
//  - pose:      setupAnim compiled to Molang (walk cycles, idle motion, look-at, sit/sleep/fly poses)
//  - keyframed: Citadel ModelAnimator animations baked per tick with Citadel's sine easing
//  - extras:    death (2 variants), hurt flinch, generic idle actions, picked from bone names
'use strict';
const M = require('./molang');
const DEG = 180 / Math.PI;
const r3 = n => Math.round(n * 1000) / 1000 || 0;

function chanExpr(v, scale) {
  v = M.toVal(v);
  if (M.isNum(v)) return Math.abs(v) < 1e-6 ? 0 : r3(v * scale);
  if (scale === 1) return M.str(v);
  if (scale === -1) return M.str(M.neg(v));
  return `(${M.str(v)}) * ${M.fmt(scale)}`;
}

// interp channel map -> bedrock bones
function poseAnimation(animId, chan, boxes, names) {
  const bones = {};
  const byId = new Map(boxes.map(b => [b.id, b]));
  const keyRe = /^(\d+)(rx|ry|rz|px|py|pz|sx|sy|sz|vis)$/;
  const acc = new Map();
  for (const [k, v] of chan) {
    const m = k.match(keyRe);
    if (!m) continue;
    const b = byId.get(+m[1]);
    if (!b || !names.has(b.id)) continue;
    if (!acc.has(b.id)) acc.set(b.id, {});
    acc.get(b.id)[m[2]] = v;
  }
  for (const [id, ch] of acc) {
    const o = {};
    const rot = ['rx', 'ry', 'rz'].map(c => (ch[c] === undefined ? 0 : chanExpr(ch[c], DEG)));
    const pos = [chanExpr(ch.px === undefined ? 0 : ch.px, 1), chanExpr(ch.py === undefined ? 0 : ch.py, -1), chanExpr(ch.pz === undefined ? 0 : ch.pz, 1)];
    const scl = ['sx', 'sy', 'sz'].map(c => (ch[c] === undefined ? 0 : ch[c]));
    if (rot.some(x => x !== 0)) o.rotation = rot;
    if (pos.some(x => x !== 0)) o.position = pos;
    if (scl.some(x => !(M.isNum(M.toVal(x)) && Math.abs(M.toVal(x)) < 1e-6))) o.scale = scl.map(x => { const t = M.toVal(x); return M.isNum(t) ? r3(1 + t) : `1 + ${M.p(t)}`; });
    if (ch.vis !== undefined) {
      const vv = M.toVal(ch.vis);
      if (!(M.isNum(vv) && vv)) o.scale = M.isNum(vv) ? 0 : `${M.p(vv)} ? 1 : 0`;
    }
    if (Object.keys(o).length) bones[names.get(id)] = o;
  }
  return { [animId]: { loop: true, bones } };
}

// Bake one Citadel animation. frames: [{start,end,stationary,rot:Map,pos:Map}]
function bakeKeyframed(animId, an, duration, names) {
  const len = Math.max(duration || 0, an.tick || 0, 1);
  const boxesTouched = new Map();
  for (const f of an.frames) for (const m of [f.rot, f.pos]) for (const e of m.values()) boxesTouched.set(e.box.id, e.box);
  const poseAt = t => {
    // Citadel: walks keyframes; prev pose updated at the end of each non-stationary keyframe
    let prev = { rot: new Map(), pos: new Map() };
    for (const f of an.frames) {
      if (t >= f.start && t < f.end) {
        if (f.stationary || f.end === f.start) return prev;
        const tick = (t - f.start) / (f.end - f.start);
        const inc = Math.sin(tick * Math.PI / 2), dec = 1 - inc;
        const out = { rot: new Map(), pos: new Map() };
        for (const key of ['rot', 'pos']) {
          const ids = new Set([...prev[key].keys(), ...f[key].keys()]);
          for (const id of ids) {
            const a = (prev[key].get(id) || { v: [0, 0, 0] }).v, b = (f[key].get(id) || { v: [0, 0, 0] }).v;
            out[key].set(id, { v: a.map((x, i) => x * dec + b[i] * inc) });
          }
        }
        return out;
      }
      if (!f.stationary) prev = f;
    }
    // after the last keyframe Citadel applies nothing
    return { rot: new Map(), pos: new Map() };
  };
  const bones = {};
  for (let t = 0; t <= len; t++) {
    const p = poseAt(Math.min(t, len - 0.0001));
    const time = r3(t / 20).toFixed(2).replace(/\.?0+$/, '') || '0';
    for (const [id] of boxesTouched) {
      const n = names.get(id);
      if (!n) continue;
      const r = (p.rot.get(id) || { v: [0, 0, 0] }).v, ps = (p.pos.get(id) || { v: [0, 0, 0] }).v;
      bones[n] = bones[n] || { rotation: {}, position: {} };
      bones[n].rotation[time] = r.map(x => r3(x * DEG));
      bones[n].position[time] = [r3(ps[0]), r3(-ps[1]), r3(ps[2])];
    }
  }
  // drop constant-zero channels and collapse repeated keyframes
  for (const n of Object.keys(bones)) {
    for (const ch of ['rotation', 'position']) {
      const kf = bones[n][ch];
      const keys = Object.keys(kf);
      if (keys.every(k => kf[k].every(x => x === 0))) { delete bones[n][ch]; continue; }
      const out = {};
      keys.forEach((k, i) => {
        const prev = keys[i - 1], next = keys[i + 1];
        const same = (a, b) => a && b && kf[a].every((x, j) => x === kf[b][j]);
        if (prev && next && same(prev, k) && same(k, next)) return;
        out[k] = kf[k];
      });
      bones[n][ch] = out;
    }
    if (!Object.keys(bones[n]).length) delete bones[n];
  }
  return { [animId]: { animation_length: r3(len / 20), bones } };
}

// ---------------- bone classification ----------------
function classify(geoBones) {
  const C = { head: [], neck: [], legs: [], arms: [], tail: [], wings: [], fins: [], body: null, root: null, jaw: [], ears: [] };
  const lower = b => b.name.toLowerCase();
  for (const b of geoBones) {
    const n = lower(b);
    if (/tail/.test(n)) C.tail.push(b);
    else if (/wing/.test(n)) C.wings.push(b);
    else if (/fin|flipper|fluke/.test(n)) C.fins.push(b);
    else if (/jaw|mouth|mandible/.test(n)) C.jaw.push(b);
    else if (/ear/.test(n) && !/rear/.test(n)) C.ears.push(b);
    else if (/neck/.test(n)) C.neck.push(b);
    else if (/head|skull/.test(n) && !/headgear|forehead/.test(n)) C.head.push(b);
    else if (/arm|hand|claw/.test(n)) C.arms.push(b);
    else if (/leg|foot|feet|thigh|knee|calf|paw|shin/.test(n)) C.legs.push(b);
  }
  C.root = geoBones.find(b => !b.parent);
  C.body = geoBones.find(b => /^(body|torso|chest|main|abdomen|thorax)$/i.test(b.name)) || geoBones.find(b => /body|torso/i.test(b.name)) || C.root;
  // keep only top-most members of each limb chain so folds don't compound
  const byName = new Map(geoBones.map(b => [b.name, b]));
  const topOnly = list => {
    const set = new Set(list.map(b => b.name));
    return list.filter(b => { for (let p = b.parent && byName.get(b.parent); p; p = p.parent && byName.get(p.parent)) if (set.has(p.name)) return false; return true; });
  };
  for (const k of ['head', 'neck', 'legs', 'arms', 'tail', 'wings', 'fins', 'ears', 'jaw']) C[k] = topOnly(C[k]);
  return C;
}

const side = b => (b.pivot[0] > 0.3 ? 1 : b.pivot[0] < -0.3 ? -1 : 0);
const front = (b, C) => b.pivot[2] < ((C.body && C.body.pivot[2]) || 0);

function kf(obj) { return obj; }

function deathAnims(prefix, geoBones, kind) {
  const C = classify(geoBones);
  const A = {};
  const ease = (a, b, c, d) => ({ '0': a, '0.15': b, '0.45': c, '0.8': d });
  // variant 0: collapse - legs buckle, head drops, tail goes limp
  const d0 = {};
  const d1 = {};
  for (const b of C.legs.concat(C.arms)) {
    const s = side(b) || 1, f = front(b, C) ? -1 : 1;
    d0[b.name] = { rotation: ease([0, 0, 0], [f * 20, 0, s * 8], [f * 55, 0, s * 25], [f * 50, 0, s * 22]) };
    d1[b.name] = { rotation: { '0': [0, 0, 0], '0.08': [f * -30, 0, s * 10], '0.16': [f * 25, 0, s * 5], '0.24': [f * -20, 0, s * 15], '0.32': [f * 20, 0, s * 10], '0.6': [f * 45, 0, s * 30], '0.9': [f * 40, 0, s * 28] } };
  }
  for (const b of C.head.concat(C.neck)) {
    d0[b.name] = { rotation: ease([0, 0, 0], [-15, 0, 0], [30, 10, 0], [25, 12, 0]) };
    d1[b.name] = { rotation: { '0': [0, 0, 0], '0.1': [-35, 0, 0], '0.3': [-25, -10, 5], '0.6': [30, 15, 0], '0.9': [28, 15, 0] } };
  }
  for (const b of C.jaw) { d0[b.name] = { rotation: ease([0, 0, 0], [20, 0, 0], [12, 0, 0], [10, 0, 0]) }; d1[b.name] = d0[b.name]; }
  for (const b of C.tail) {
    d0[b.name] = { rotation: ease([0, 0, 0], [-10, 15, 0], [20, -5, 0], [18, -4, 0]) };
    d1[b.name] = { rotation: { '0': [0, 0, 0], '0.1': [-20, 25, 0], '0.2': [-10, -25, 0], '0.3': [-15, 20, 0], '0.6': [20, 0, 0], '0.9': [18, 0, 0] } };
  }
  for (const b of C.wings) {
    const s = side(b) || 1;
    d0[b.name] = { rotation: ease([0, 0, 0], [0, 0, s * -70], [0, 0, s * 10], [0, 0, s * 5]) };
    d1[b.name] = { rotation: { '0': [0, 0, 0], '0.08': [0, 0, s * -60], '0.16': [0, 0, s * 20], '0.24': [0, 0, s * -50], '0.36': [0, 0, s * 15], '0.7': [0, 0, s * 5] } };
  }
  for (const b of C.fins) {
    const s = side(b) || 1;
    d0[b.name] = { rotation: ease([0, 0, 0], [0, 0, s * 30], [0, 0, s * -20], [0, 0, s * -10]) };
    d1[b.name] = d0[b.name];
  }
  for (const b of C.ears) { d0[b.name] = { rotation: ease([0, 0, 0], [-10, 0, 0], [25, 0, 0], [25, 0, 0]) }; d1[b.name] = d0[b.name]; }
  if (C.body && C.body !== C.root) {
    d0[C.body.name] = Object.assign(d0[C.body.name] || {}, { rotation: ease([0, 0, 0], [-6, 0, 0], [4, 0, 6], [3, 0, 5]) });
    d1[C.body.name] = Object.assign(d1[C.body.name] || {}, { rotation: { '0': [0, 0, 0], '0.1': [-12, 0, -4], '0.2': [6, 0, 6], '0.3': [-6, 0, -3], '0.6': [3, 0, 6], '0.9': [3, 0, 5] } });
  }
  A[`${prefix}.death_0`] = { animation_length: 1, loop: 'hold_on_last_frame', bones: d0 };
  A[`${prefix}.death_1`] = { animation_length: 1, loop: 'hold_on_last_frame', bones: d1 };
  // hurt flinch
  const h = {};
  for (const b of C.head.concat(C.neck)) h[b.name] = { rotation: { '0': [0, 0, 0], '0.08': [-18, 8, 0], '0.3': [0, 0, 0] } };
  if (C.body && C.body !== C.root) h[C.body.name] = { rotation: { '0': [0, 0, 0], '0.08': [-5, 0, 4], '0.3': [0, 0, 0] } };
  for (const b of C.tail) h[b.name] = { rotation: { '0': [0, 0, 0], '0.1': [-25, 0, 0], '0.3': [0, 0, 0] } };
  for (const b of C.ears) h[b.name] = { rotation: { '0': [0, 0, 0], '0.1': [30, 0, 0], '0.3': [0, 0, 0] } };
  for (const b of C.wings) { const s = side(b) || 1; h[b.name] = { rotation: { '0': [0, 0, 0], '0.1': [0, 0, s * -35], '0.3': [0, 0, 0] } }; }
  A[`${prefix}.hurt`] = { animation_length: 0.3, bones: h };
  return { anims: A, C };
}

// Generic idle actions (look around, sniff, shake, stretch) used alongside the Java ones.
function idleActions(prefix, geoBones, kind) {
  const C = classify(geoBones);
  const out = {};
  const head = C.head[0] || C.neck[0];
  if (head) {
    out[`${prefix}.idle_look`] = { animation_length: 3, bones: { [head.name]: { rotation: { '0': [0, 0, 0], '0.5': [-5, 40, 0], '1.3': [-5, 40, 0], '1.8': [0, -35, 5], '2.5': [0, -35, 5], '3': [0, 0, 0] } } } };
    out[`${prefix}.idle_sniff`] = { animation_length: 2, bones: { [head.name]: { rotation: { '0': [0, 0, 0], '0.4': [25, 0, 0], '0.6': [20, 0, 0], '0.8': [25, 0, 0], '1': [20, 0, 0], '1.2': [25, 0, 0], '1.6': [10, 0, 0], '2': [0, 0, 0] } } } };
    if (C.ears.length) for (const e of C.ears) out[`${prefix}.idle_sniff`].bones[e.name] = { rotation: { '0': [0, 0, 0], '0.5': [-15, 0, 0], '1.5': [-15, 0, 0], '2': [0, 0, 0] } };
  }
  if (kind !== 'fish' && C.body && C.body !== C.root) {
    const sh = { [C.body.name]: { rotation: { '0': [0, 0, 0], '0.1': [0, 0, 10], '0.2': [0, 0, -10], '0.3': [0, 0, 9], '0.4': [0, 0, -9], '0.5': [0, 0, 6], '0.6': [0, 0, -6], '0.7': [0, 0, 3], '0.8': [0, 0, 0] } } };
    if (head) sh[head.name] = { rotation: { '0': [0, 0, 0], '0.1': [0, 0, -14], '0.2': [0, 0, 14], '0.3': [0, 0, -12], '0.4': [0, 0, 12], '0.5': [0, 0, -8], '0.6': [0, 0, 8], '0.8': [0, 0, 0] } };
    for (const t of C.tail) sh[t.name] = { rotation: { '0': [0, 0, 0], '0.15': [0, 25, 0], '0.3': [0, -25, 0], '0.45': [0, 20, 0], '0.6': [0, -15, 0], '0.8': [0, 0, 0] } };
    out[`${prefix}.idle_shake`] = { animation_length: 0.8, bones: sh };
  }
  if (C.wings.length) {
    const wb = {};
    for (const w of C.wings) { const s = side(w) || 1; wb[w.name] = { rotation: { '0': [0, 0, 0], '0.3': [0, 0, s * -60], '0.5': [0, 0, s * -55], '0.7': [0, 0, s * -62], '1.1': [0, 0, 0] } }; }
    out[`${prefix}.idle_wings`] = { animation_length: 1.1, bones: wb };
  }
  if (C.tail.length && kind !== 'fish') {
    const tb = {};
    for (const t of C.tail) tb[t.name] = { rotation: { '0': [0, 0, 0], '0.3': [0, 20, 0], '0.6': [0, -20, 0], '0.9': [0, 18, 0], '1.2': [0, -15, 0], '1.5': [0, 0, 0] } };
    out[`${prefix}.idle_tail`] = { animation_length: 1.5, bones: tb };
  }
  return out;
}

module.exports = { poseAnimation, bakeKeyframed, deathAnims, idleActions, classify };
