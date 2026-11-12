// Client side of one creature: our own animation set + controllers + client entity + render controllers.
//   idle / walk / run / swim / fly loops  <- Java gait data (motion.js), re-authored as clean keyframes
//   sit / sleep / stand postures           <- Java pose channels evaluated into static deltas
//   look, baby, hurt, 2x death, idle actions, Java attack keyframes (+ generic bite)
// Everything is keyframed; Molang is only used for head look-at, speed scaling and controller conditions, and every
// variable a controller reads is assigned in pre_animation (the game drops whole files on unknown variables).
'use strict';
const path = require('path');
const C = require('./config');
const U = require('./util');
const A = require('./anims');
const MO = require('./motion');

const NS = C.NS;
const ATTACK_RE = /^(SLASH|SWIPE|MAUL|BITE|ATTACK|SLAM|LUNGE|DEATHROLL|STOMP|FLING|SHOVE|KICK|PUNCH|TAILSWING|STAB|PAW|LEAP|GORE|BUCK|THROW|LAUNCH)/;
const IDLE_SKIP_RE = /PREPARE|EMERGE|JUMPUP|DODGE|SUCK|SPIT/;
const texPath = rel => `textures/entity/${NS}/${rel}`;
const cleanBones = bones => (bones && Object.keys(bones).length ? bones : null);
const mk = (o, bones) => { const b = cleanBones(bones); const r = Object.assign({}, o); if (b) r.bones = b; return r; };

// ------------------------------------------------------------------ generic fallbacks / extras
function genericWalk(C, amp, L = 1.0) {
  const bones = {};
  const limbs = C.legs.concat(C.arms);
  if (!limbs.length) return bones;
  const bz = (C.body && C.body.pivot[2]) || 0;
  const N = 8;
  for (const b of limbs) {
    const side = b.pivot[0] > 0.3 ? 1 : b.pivot[0] < -0.3 ? -1 : 0;
    const front = b.pivot[2] < bz;
    const ph = (front ? 0 : Math.PI) + (side > 0 ? 0 : Math.PI);
    const kf = {};
    for (let k = 0; k <= N; k++) kf[MO.tkey((L * k) / N)] = [MO.r2(Math.sin((2 * Math.PI * k) / N + ph) * 32 * amp), 0, 0];
    bones[b.name] = { rotation: kf };
  }
  for (const t of C.tail.slice(0, 3)) {
    const kf = {};
    for (let k = 0; k <= N; k++) kf[MO.tkey((L * k) / N)] = [0, MO.r2(Math.sin((2 * Math.PI * k) / N) * 10 * amp), 0];
    bones[t.name] = { rotation: kf };
  }
  return bones;
}

// both hind legs together, body arcing up, forelegs tucked (kangaroo, jerboa, frogs)
function hopWalk(C, amp, L = 0.8) {
  const bones = {};
  const bz = (C.body && C.body.pivot[2]) || 0;
  const N = 8;
  const arc = k => Math.max(0, Math.sin((Math.PI * k) / N));
  for (const b of C.legs.concat(C.arms)) {
    const front = b.pivot[2] < bz;
    const kf = {};
    for (let k = 0; k <= N; k++) kf[MO.tkey((L * k) / N)] = [MO.r2(front ? -arc(k) * 28 * amp + 8 : Math.sin((2 * Math.PI * k) / N + 0.6) * 38 * amp), 0, 0];
    bones[b.name] = { rotation: kf };
  }
  if (C.body && C.body !== C.root) { const kf = {}, kr = {}; for (let k = 0; k <= N; k++) { kf[MO.tkey((L * k) / N)] = [0, MO.r2(arc(k) * 2.4 * amp), 0]; kr[MO.tkey((L * k) / N)] = [MO.r2(-arc(k) * 8 * amp), 0, 0]; } bones[C.body.name] = { position: kf, rotation: kr }; }
  for (const t of C.tail.slice(0, 2)) { const kf = {}; for (let k = 0; k <= N; k++) kf[MO.tkey((L * k) / N)] = [MO.r2(arc(k) * 14 * amp), 0, 0]; bones[t.name] = { rotation: kf }; }
  return bones;
}
// limbless ground animals (snake heads): sinuous yaw wave travelling down the body and tail
function slither(C, amp, L = 1.2, all = []) {
  const bones = {};
  const N = 8;
  let chain = [C.body && C.body !== C.root ? C.body : null].concat(C.neck, C.head.slice(0, 1), C.tail).filter(Boolean);
  if (!chain.length) chain = all.filter(b => b.parent && !/jaw|mouth|tongue|eye/i.test(b.name));
  const amps = Math.max(11, 20 - chain.length * 2);
  chain.slice(0, 10).forEach((b, i) => {
    const kf = {}, kp = {};
    for (let k = 0; k <= N; k++) {
      kf[MO.tkey((L * k) / N)] = [MO.r2(Math.sin((4 * Math.PI * k) / N + 1) * 3 * amp), MO.r2(Math.sin((2 * Math.PI * k) / N - i * 0.8) * amps * amp), MO.r2(Math.sin((2 * Math.PI * k) / N - i * 0.8 + 1.2) * 4 * amp)];
      kp[MO.tkey((L * k) / N)] = [MO.r2(Math.sin((2 * Math.PI * k) / N - i * 0.8 + 0.5) * 0.9 * amp), 0, MO.r2(-Math.abs(Math.sin((2 * Math.PI * k) / N)) * 0.7 * amp)];
    }
    bones[b.name] = { rotation: kf, position: kp };
  });
  return bones;
}
// gentle hover: body bobs, head and tail sway, wings/legs dangle (limbless flyers like the void worm)
function hover(C, L = 1.6) {
  const bones = {};
  const N = 8;
  if (C.body && C.body !== C.root) { const kf = {}; for (let k = 0; k <= N; k++) kf[MO.tkey((L * k) / N)] = [0, MO.r2(Math.sin((2 * Math.PI * k) / N) * 0.9), 0]; bones[C.body.name] = { position: kf }; }
  for (const h of C.head.slice(0, 1)) { const kf = {}; for (let k = 0; k <= N; k++) kf[MO.tkey((L * k) / N)] = [MO.r2(Math.sin((2 * Math.PI * k) / N + 1) * 3), MO.r2(Math.sin((2 * Math.PI * k) / N) * 6), 0]; bones[h.name] = { rotation: kf }; }
  C.tail.slice(0, 6).forEach((t, i) => { const kf = {}; for (let k = 0; k <= N; k++) kf[MO.tkey((L * k) / N)] = [0, MO.r2(Math.sin((2 * Math.PI * k) / N - i * 0.7) * 10), 0]; bones[t.name] = { rotation: kf }; });
  return bones;
}

// limbless animals: head sways, tongue flicks (jaw bone) - used as the idle when nothing else matched
function snakeIdle(C, all) {
  const bones = {};
  const L = 4;
  const parts = all.filter(b => b.parent && !/jaw|mouth|tongue/i.test(b.name)).slice(0, 4);
  parts.forEach((b, i) => { bones[b.name] = { rotation: { '0': [0, 0, 0], '1': [2, 7 - i, 1], '2': [0, 0, 0], '3': [-2, -7 + i, -1], '4': [0, 0, 0] } }; });
  for (const j of all.filter(b => /jaw|mouth|tongue/i.test(b.name)).slice(0, 1)) bones[j.name] = { rotation: { '0': [0, 0, 0], '0.5': [0, 0, 0], '0.62': [16, 0, 0], '0.74': [0, 0, 0], '0.86': [16, 0, 0], '1': [0, 0, 0], '2.6': [0, 0, 0], '2.72': [14, 0, 0], '2.84': [0, 0, 0], '4': [0, 0, 0] } };
  return Object.keys(bones).length ? { loop: true, animation_length: L, bones } : null;
}

function breathe(C) {
  const L = 3.6, bones = {};
  const wave = (a, ph = 0) => ({ '0': a(0 + ph), '0.9': a(1 + ph), '1.8': a(2 + ph), '2.7': a(3 + ph), '3.6': a(4 + ph) });
  const sinAt = (amp, ph) => k => MO.r2(Math.sin((k * Math.PI) / 2 + ph) * amp);
  if (C.body && C.body !== C.root) bones[C.body.name] = { position: wave(k => [0, MO.r2(Math.sin((k * Math.PI) / 2) * 0.14), 0]) };
  for (const h of C.head.slice(0, 1)) bones[h.name] = Object.assign(bones[h.name] || {}, { rotation: wave(k => [sinAt(1.4, 0.8)(k), sinAt(1.8, 0)(k), 0]) });
  C.tail.slice(0, 2).forEach((t, i) => (bones[t.name] = { rotation: wave(k => [0, sinAt(5, i * 0.9)(k), 0]) }));
  C.ears.slice(0, 4).forEach((e, i) => (bones[e.name] = { rotation: wave(k => [0, 0, sinAt(2.5, i * 1.3)(k) * (e.pivot[0] >= 0 ? 1 : -1)]) }));
  C.wings.slice(0, 2).forEach((w, i) => (bones[w.name] = { rotation: wave(k => [0, 0, sinAt(1.5, 0)(k) * (w.pivot[0] >= 0 ? 1 : -1)]) }));
  C.fins.slice(0, 6).forEach((f, i) => (bones[f.name] = { rotation: wave(k => [0, sinAt(6, i)(k), 0]) }));
  return Object.keys(bones).length ? { loop: true, animation_length: L, bones } : null;
}

function genericBite(C) {
  const bones = {};
  const head = C.head[0] || C.neck[0];
  if (head) bones[head.name] = { rotation: { '0': [0, 0, 0], '0.12': [-22, 0, 0], '0.26': [34, 0, 0], '0.34': [30, 0, 0], '0.55': [0, 0, 0] } };
  for (const j of C.jaw.slice(0, 1)) bones[j.name] = { rotation: { '0': [0, 0, 0], '0.12': [38, 0, 0], '0.26': [0, 0, 0], '0.55': [0, 0, 0] } };
  if (C.body && C.body !== C.root) bones[C.body.name] = { position: { '0': [0, 0, 0], '0.12': [0, 0.3, 1.2], '0.26': [0, -0.3, -2.4], '0.55': [0, 0, 0] }, rotation: { '0': [0, 0, 0], '0.12': [-4, 0, 0], '0.26': [5, 0, 0], '0.55': [0, 0, 0] } };
  for (const l of C.arms.slice(0, 2)) bones[l.name] = { rotation: { '0': [0, 0, 0], '0.12': [-25, 0, 0], '0.3': [20, 0, 0], '0.55': [0, 0, 0] } };
  return mk({ animation_length: 0.55 }, bones);
}

// ------------------------------------------------------------------ jump / fall / land (Phoenix-style)
// jump = pushing up a block (front end rises, forelegs reach up, hind legs drive); fall = a real drop (nose down,
// forelegs reach); land = squash with a small overshoot. Written for any quadruped/biped rig from the bone classes.
const K = list => Object.fromEntries(list.map(([t, v]) => [MO.tkey(t), { post: v, lerp_mode: 'catmullrom' }]));
const Z = [0, 0, 0];
function airAnims(C, f) {
  const bz = (C.body && C.body.pivot[2]) || 0;
  const limbs = C.legs.concat(C.arms);
  if (!limbs.length) return null;
  const front = limbs.filter(b => b.pivot[2] < bz - 0.5 || C.arms.includes(b));
  const hind = limbs.filter(b => !front.includes(b));
  const head = C.head[0] || C.neck[0];
  const body = C.body && C.body !== C.root ? C.body : null;
  const set = (bones, list, key, kf) => list.forEach(b => { bones[b.name] = Object.assign(bones[b.name] || {}, { [key]: kf }); });
  const mk3 = (fn) => {
    const bones = {};
    fn(bones);
    return Object.keys(bones).length ? bones : null;
  };
  const jump = mk3(b => {
    if (body) b[body.name] = { rotation: K([[0, Z], [0.1, [-34, 0, 0]], [0.35, [-24, 0, 0]], [0.7, [-6, 0, 0]]]), position: K([[0, Z], [0.1, [0, 1.6 * f, 0.6 * f]], [0.7, Z]]) };
    set(b, front, 'rotation', K([[0, Z], [0.1, [-80, 0, 0]], [0.35, [-56, 0, 0]], [0.7, [-14, 0, 0]]]));
    set(b, hind, 'rotation', K([[0, Z], [0.08, [58, 0, 0]], [0.35, [38, 0, 0]], [0.7, [8, 0, 0]]]));
    if (head) b[head.name] = { rotation: K([[0, Z], [0.1, [22, 0, 0]], [0.7, [6, 0, 0]]]) };
    set(b, C.tail.slice(0, 3), 'rotation', K([[0, Z], [0.2, [-32, 0, 0]], [0.7, [-8, 0, 0]]]));
    set(b, C.ears.slice(0, 4), 'rotation', K([[0, Z], [0.2, [-24, 0, 0]], [0.7, Z]]));
  });
  const fall = mk3(b => {
    if (body) b[body.name] = { rotation: [24, 0, 0] };
    set(b, front, 'rotation', [-58, 0, 0]);
    set(b, hind, 'rotation', [-22, 0, 0]);
    if (head) b[head.name] = { rotation: [-20, 0, 0] };
    set(b, C.tail.slice(0, 3), 'rotation', [42, 0, 0]);
    set(b, C.ears.slice(0, 4), 'rotation', [-34, 0, 0]);
  });
  const land = mk3(b => {
    if (body) b[body.name] = { position: K([[0, [0, -2 * f, 0]], [0.12, [0, -3 * f, 0]], [0.36, [0, 0.4 * f, 0]], [0.7, Z]]), rotation: K([[0, [12, 0, 0]], [0.15, [16, 0, 0]], [0.4, [-3, 0, 0]], [0.7, Z]]) };
    set(b, front, 'rotation', K([[0, [-18, 0, 0]], [0.15, [14, 0, 0]], [0.7, Z]]));
    set(b, hind, 'rotation', K([[0, [18, 0, 0]], [0.15, [-12, 0, 0]], [0.7, Z]]));
    if (head) b[head.name] = { rotation: K([[0, [18, 0, 0]], [0.18, [26, 0, 0]], [0.42, [-6, 0, 0]], [0.7, Z]]) };
    set(b, C.tail.slice(0, 3), 'rotation', K([[0, [34, 0, 0]], [0.25, [-18, 0, 0]], [0.7, Z]]));
  });
  if (!jump || !fall || !land) return null;
  return { jump: { animation_length: 0.7, loop: 'hold_on_last_frame', bones: jump }, fall: { loop: true, animation_length: 1, bones: fall }, land: { animation_length: 0.7, bones: land } };
}

// reuse the animations of the previous add-on (same bone names): extra idles, attacks, rolls, pounces...
const LEGACY_DIR = path.join(C.ROOT, 'legacy', 'v1', 'RP', 'animations');
const LEGACY_BASE = new Set(['walk', 'idle', 'run', 'hurt', 'swim', 'attack', 'pose', 'fly']);
const LEGACY_ATTACK = /^(death_roll|throw|pounce|kick|box|dropkick|peck|spin)$/;
function legacyAnims(id, bones) {
  const f = path.join(LEGACY_DIR, id + '.animation.json');
  if (!require('fs').existsSync(f)) return [];
  let j;
  try { j = JSON.parse(require('fs').readFileSync(f, 'utf8').replace(/^\uFEFF/, '')).animations || {}; } catch { return []; }
  const out = [];
  const hasStr = v => (typeof v === 'string' ? true : Array.isArray(v) ? v.some(hasStr) : v && typeof v === 'object' ? Object.values(v).some(hasStr) : false);
  const lastKey = v => (Array.isArray(v) || typeof v !== 'object' ? 0 : Math.max(0, ...Object.keys(v).map(Number).filter(Number.isFinite)));
  for (const [key, def] of Object.entries(j)) {
    const name = key.split('.').slice(2).join('.');
    if (!name || LEGACY_BASE.has(name) || /\s/.test(name)) continue;
    const nb = {};
    let len = def.animation_length || 0;
    for (const [bn, ch] of Object.entries(def.bones || {})) {
      if (!bones.has(bn)) continue;
      const o = {};
      for (const [k, v] of Object.entries(ch)) { if (hasStr(v)) continue; o[k] = v; len = Math.max(len, lastKey(v)); }
      if (Object.keys(o).length) nb[bn] = o;
    }
    if (!Object.keys(nb).length) continue;
    out.push({ short: 'lg_' + name.replace(/[^a-z0-9_]/gi, '_'), attack: LEGACY_ATTACK.test(name), def: { animation_length: MO.r3(len || 1), bones: nb } });
  }
  return out;
}

// ------------------------------------------------------------------ main
function generateClient(P) {
  const { e, s, id, full, prefix, geos, main, kindOf, variants, sleepTex, angryTex, glow, overlay, babyTex, ctx } = P;
  const anims = {};
  const short = {}; // short name -> full id
  const add = (name, def) => { if (!def) return; anims[`${prefix}.${name}`] = def; short[name] = `${prefix}.${name}`; };
  const I = main.I;
  const names = main.names;
  const CL = A.classify(main.bones);
  const ctrl = {};
  const cid = n => `controller.animation.${NS}.${id}.${n}`;

  // ---- Java data
  const pose = I.setupAnim();
  const progress = [...I.ent.progress.entries()];
  for (const g of geos.slice(1)) { g.I.setupAnim(); for (const [k, v] of g.I.ent.progress) if (!progress.find(p => p[0] === k)) progress.push([k, v]); }
  const raw = I.gaits.slice();
  // Java bobs a single leg bone in a few models (a quirk of the original): bob the body instead
  const bodyId = [...names].find(([, n]) => CL.body && n === CL.body.name);
  const limbNames = new Set(CL.legs.concat(CL.arms).map(b => b.name));
  for (const g of raw) if (g.kind === 'bob' && limbNames.has(names.get(g.bone)) && bodyId) g.bone = bodyId[0];
  const attr = (e.attrs && e.attrs.speed) || 0.25;
  const base = s.alwaysFly || kindOf === 'hover' ? 'fly' : ['water', 'whale'].includes(kindOf) ? 'swim' : 'ground';
  const envBase = MO.stateEnv(base, progress);
  const hasProg = t => progress.some(([, p]) => p.target === MO.TARGET[t]);
  const limbOf = g => g.filter(x => x.limb), timeOf = g => g.filter(x => !x.limb);
  const gBase = MO.activeGaits(raw, envBase);
  let usedGait = gBase.length > 0;

  // ---- locomotion loops
  const REF = Math.max(0.12, Math.min(0.6, attr * 0.9));
  const moveT = +Math.max(0.03, Math.min(0.1, attr * 0.35)).toFixed(3);
  const sprintT = +Math.max(0.4, Math.min(0.9, attr * 1.6)).toFixed(3);
  const timeScale = { anim_time_update: 'q.anim_time + q.delta_time * v.anim_speed' };
  const loopAnim = (loop, extra) => (loop ? mk(Object.assign({ loop: true, animation_length: loop.length }, extra || {}), MO.toBones(loop, names)) : null);

  const deltaFor = state => {
    if (!pose || !hasProg(state)) return null;
    const d = MO.poseDelta(pose.chan, MO.stateEnv(state, progress), MO.stateEnv('ground', progress));
    return Object.keys(d).length ? d : null;
  };

  // idle: time-driven Java gaits in the base state (+ our breathing on top)
  const idleG = timeOf(gBase);
  const idleLoop = idleG.length ? MO.buildLoop(idleG, { maxL: 6, maxKeys: 110 }) : null;
  add('idle', idleLoop ? loopAnim(idleLoop) : null);
  add('breathe', breathe(CL));
  if (!short.idle && !short.breathe && base === 'ground' && !CL.legs.length && !CL.arms.length) add('idle', snakeIdle(CL, main.bones));
  // walk / run (ground) or swim (water kinds): limb-driven Java gaits
  const limbG = limbOf(gBase);
  const walkLoop = limbG.length ? MO.buildLoop(limbG, { rate: 6, amp: 0.65, minL: 0.9, maxL: 3.2 }) : null;
  const runLoop = limbG.length ? MO.buildLoop(limbG.map(g => Object.assign({}, g)), { rate: 6, amp: 1.0, minL: 0.9, maxL: 3.2 }) : null;
  if (base === 'ground') {
    if (walkLoop) { add('walk', loopAnim(walkLoop, timeScale)); add('run', loopAnim(runLoop, timeScale)); }
    else {
      const hop = s.hops && (CL.legs.length || CL.arms.length);
      const mkW = a => (hop ? hopWalk(CL, a) : (CL.legs.length || CL.arms.length ? genericWalk(CL, a) : slither(CL, a, 1.2, main.bones)));
      const gw = mkW(0.65), gr = mkW(1.0);
      if (Object.keys(gw).length) { add('walk', mk({ loop: true, animation_length: hop ? 0.8 : 1.2, anim_time_update: timeScale.anim_time_update }, gw)); add('run', mk({ loop: true, animation_length: hop ? 0.8 : 1.2, anim_time_update: timeScale.anim_time_update }, gr)); usedGait = 'generic'; }
    }
  }
  // swim: water kinds use the base gaits (limb + time); land kinds that swim use the swim-state gaits
  let hasSwim = false;
  if (base === 'swim') {
    const all = gBase;
    const lp = all.length ? MO.buildLoop(all, { rate: 6, amp: 0.8, minL: 1, maxL: 3.6, maxKeys: 100 }) : null;
    if (lp) { add('swim', loopAnim(lp, timeScale)); hasSwim = true; }
    else {
      const w = {};
      const segs = CL.tail.concat(CL.fins);
      segs.slice(0, 8).forEach((b, i) => { const kf = {}; for (let k = 0; k <= 8; k++) kf[MO.tkey(k / 8 * 1.2)] = [0, MO.r2(Math.sin((2 * Math.PI * k) / 8 + i * 0.7) * 18), 0]; w[b.name] = { rotation: kf }; });
      if (CL.body && CL.body !== CL.root) { const kf = {}; for (let k = 0; k <= 8; k++) kf[MO.tkey(k / 8 * 1.2)] = [0, MO.r2(Math.sin((2 * Math.PI * k) / 8) * 6), 0]; w[CL.body.name] = { rotation: kf }; }
      if (Object.keys(w).length) { add('swim', mk({ loop: true, animation_length: 1.2, anim_time_update: timeScale.anim_time_update }, w)); hasSwim = true; usedGait = 'generic'; }
    }
  } else if (base === 'ground' && hasProg('swim')) {
    const envS = MO.stateEnv('swim', progress);
    const gs = MO.activeGaits(raw, envS);
    const d = deltaFor('swim');
    if (gs.length || d) {
      const lp = MO.buildLoop(gs, { rate: 6, amp: 0.8, minL: 1, maxL: 3.6, maxKeys: 100, delta: d || undefined });
      if (lp) { add('swim', loopAnim(lp, timeScale)); hasSwim = true; }
    }
  }
  // fly
  let hasFly = false;
  if (base === 'fly' || kindOf === 'flyer' || hasProg('fly')) {
    const envF = MO.stateEnv('fly', progress);
    const gf = MO.activeGaits(raw, envF);
    const d = base === 'fly' ? null : deltaFor('fly');
    let lp = gf.length || d ? MO.buildLoop(gf, { rate: 7, amp: 0.6, minL: 0.5, maxL: 3, maxKeys: 100, delta: d || undefined }) : null;
    if (!lp) {
      const w = {};
      CL.wings.forEach(b => { const sd = b.pivot[0] >= 0 ? 1 : -1; const kf = {}; for (let k = 0; k <= 8; k++) kf[MO.tkey(k / 8 * 0.45)] = [0, 0, MO.r2(Math.sin((2 * Math.PI * k) / 8) * 42 * sd)]; w[b.name] = { rotation: kf }; });
      if (Object.keys(w).length) { add('fly', mk({ loop: true, animation_length: 0.45 }, w)); hasFly = true; usedGait = usedGait || 'generic'; }
      else { const hv = hover(CL); if (Object.keys(hv).length) { add('fly', mk({ loop: true, animation_length: 1.6 }, hv)); hasFly = true; usedGait = usedGait || 'generic'; } }
    } else { add('fly', loopAnim(lp)); hasFly = true; }
  }
  // postures from the Java pose (sit / sleep / stand)
  const POSE = {};
  for (const st of ['sit', 'sleep', 'stand']) {
    const d = deltaFor(st);
    if (d) { const b = MO.deltaToBones(d, names); if (Object.keys(b).length) { add('pose_' + st, mk({ loop: true, animation_length: 1 }, b)); POSE[st] = true; } }
  }
  // generic sleeping curl when the Java model has no sleep pose but the mob sleeps
  const sleeps = !!(progress.some(([k]) => /sleep/.test(k)) || (s.states && s.states.sleep) || s.sleepy);
  if (sleeps && !POSE.sleep) {
    const b = {};
    const legs = CL.legs.concat(CL.arms);
    const lowest = Math.max(1, Math.min(6, (main.bounds && main.bounds.maxY ? 0 : 0) + 2.2));
    if (CL.body && CL.body !== CL.root) b[CL.body.name] = { position: [0, -lowest, 0] };
    for (const l of legs) b[l.name] = { rotation: [(l.pivot[2] < ((CL.body && CL.body.pivot[2]) || 0) ? -70 : 70), 0, 0] };
    for (const h of CL.head.slice(0, 1)) b[h.name] = Object.assign(b[h.name] || {}, { rotation: [22, 12, 0] });
    for (const t of CL.tail.slice(0, 2)) b[t.name] = { rotation: [0, 25, 0] };
    if (Object.keys(b).length) { add('pose_sleep', mk({ loop: true, animation_length: 1 }, b)); POSE.sleep = true; }
  }

  // head look-at (the Java mod's faceTarget bones, split like Java does)
  const faceBones = new Map();
  for (const g of raw.filter(x => x.kind === 'face')) {
    const nm = names.get(g.bone);
    if (!nm) continue;
    const dv = typeof g.divisor === 'number' && g.divisor > 0 ? g.divisor : 1;
    faceBones.set(nm, 1 / (dv * (g.n || 1)));
  }
  if (!faceBones.size) for (const h of CL.head.slice(0, 1).concat(CL.neck.slice(0, 1))) faceBones.set(h.name, 1 / Math.max(1, CL.head.length ? 1 : 1));
  if (faceBones.size) {
    const b = {};
    for (const [nm, k] of faceBones) b[nm] = { rotation: [`math.clamp(q.target_x_rotation, -45, 45) * ${MO.r3(k)}`, `math.clamp(q.target_y_rotation, -70, 70) * ${MO.r3(k)}`, 0] };
    add('look', mk({ loop: true, animation_length: 1 }, b));
  }
  // baby: bigger head (the BP scales the whole mob down)
  if (!s.baby && CL.head.length) {
    const b = {};
    for (const h of CL.head.slice(0, 1)) b[h.name] = { scale: [1.32, 1.32, 1.32] };
    add('baby', mk({ loop: true, animation_length: 1 }, b));
  }
  if (s.fix) add('fix', mk({ loop: true, animation_length: 1 }, Object.fromEntries(Object.entries(s.fix).map(([bn, r]) => [bn, { rotation: r }]))));

  // Java keyframed animations: attacks + signature idles (eat, sniff, trumpet, chest pound ...)
  const attackNames = [], javaIdles = [];
  for (const [name, an] of I.animator()) {
    if (!an.frames.length) continue;
    const sh = name.replace(/^ANIMATION_/, '').toLowerCase();
    const dur = (e.animations || {})[name] || an.tick;
    const baked = A.bakeKeyframed(`${prefix}.${sh}`, an, dur, names);
    const def = baked[`${prefix}.${sh}`];
    if (!def || !def.bones || !Object.keys(def.bones).length) continue;
    anims[`${prefix}.${sh}`] = def; short[sh] = `${prefix}.${sh}`;
    if (ATTACK_RE.test(name.replace(/^ANIMATION_/, ''))) attackNames.push(sh); else if (!IDLE_SKIP_RE.test(name)) javaIdles.push(sh);
  }
  const legacy = legacyAnims(id, new Set(main.bones.map(b => b.name)));
  for (const l of legacy) { anims[`${prefix}.${l.short}`] = l.def; short[l.short] = `${prefix}.${l.short}`; (l.attack ? attackNames : javaIdles).push(l.short); }
  const hurtful = (e.attrs && e.attrs.damage) || s.temper === 'hostile' || s.temper === 'predator' || s.temper === 'neutral';
  if (!attackNames.length && hurtful && (CL.head.length || CL.arms.length)) { add('attack_bite', genericBite(CL)); attackNames.push('attack_bite'); }
  const death = A.deathAnims(prefix, main.bones, kindOf);
  for (const [k, v] of Object.entries(death.anims)) { const sh = k.slice(prefix.length + 1); if (v.bones && Object.keys(v.bones).length) { anims[k] = v; short[sh] = k; } else { const r = main.bones.find(b => !b.parent); anims[k] = mk({ animation_length: 1, loop: sh.startsWith('death') ? 'hold_on_last_frame' : undefined }, r && sh.startsWith('death') ? { [(CL.body || r).name]: { rotation: { '0': [0, 0, 0], '0.5': [0, 0, 8] } } } : null); short[sh] = k; } }
  const generic = A.idleActions(prefix, main.bones, kindOf === 'water' ? 'fish' : kindOf);
  const idleList = javaIdles.slice();
  for (const [k, v] of Object.entries(generic)) { if (!v.bones || !Object.keys(v.bones).length) continue; anims[k] = v; const sh = k.slice(prefix.length + 1); short[sh] = k; idleList.push(sh); }
  const canIdle = base === 'ground' && !s.alwaysFly && idleList.length > 0;

  // ---- jump / fall / land for walkers (adults and babies share the rig)
  const bodyH = (main.bounds && main.bounds.maxY) || 14;
  const sizeF = Math.max(0.7, Math.min(2.5, bodyH / 14));
  const airW = sizeF > 1.6 ? 0.55 : sizeF > 1.2 ? 0.75 : 1;
  const air = base === 'ground' && !['flyer', 'hover', 'water', 'whale'].includes(kindOf) && !s.hops ? airAnims(CL, sizeF) : null;
  if (air) for (const [k, v] of Object.entries(air)) add('air_' + k, v);

  // ---- animation file
  for (const [k, v] of Object.entries(anims)) { if (v && v.loop === undefined) delete v.loop; }
  U.writeJson(path.join(C.RP, 'animations', NS, `${id}.animation.json`), { format_version: '1.8.0', animations: anims });

  // ---- pre_animation (every variable the controllers read is assigned here)
  const flyExpr = s.alwaysFly || base === 'fly' ? '1' : hasFly ? '!q.is_on_ground && !q.is_in_water' : '0';
  const standExpr = POSE.stand ? `q.property('${NS}:angry') && !v.is_moving && q.is_on_ground` : '0';
  const pre = [
    `v.is_moving = q.modified_move_speed >= ${moveT};`,
    `v.is_sprinting = q.modified_move_speed >= ${sprintT};`,
    `v.anim_speed = math.clamp(q.modified_move_speed / ${REF}, 0.35, 2.4);`,
    `v.am_flying = ${flyExpr};`,
    `v.am_sleeping = ${sleeps ? `q.property('${NS}:sleeping')` : '0'};`,
    `v.am_standing = ${standExpr};`,
    'v.idle_wait = v.idle_wait ?? 4;',
    'v.idle_pick = v.idle_pick ?? 0;',
    'v.atk_pick = v.atk_pick ?? 0;',
    'v.death_pick = v.death_pick ?? 0;',
    'v.life_vy = math.clamp((q.position(1) - (v.life_py ?? q.position(1))) / math.max(q.delta_time, 0.01), -30, 30);',
    'v.life_py = q.position(1);',
  ];

  // ---- controllers
  const states = {};
  const canSwimState = hasSwim && base !== 'swim';
  const avail = {
    sleep: sleeps && POSE.sleep, sit: POSE.sit, stand: POSE.stand,
    fly: hasFly && base !== 'fly', swim: canSwimState, run: !!short.run, walk: !!short.walk,
  };
  const cond = {
    sleep: 'v.am_sleeping', sit: 'q.is_sitting && !v.am_sleeping', stand: 'v.am_standing', fly: 'v.am_flying && !v.am_sleeping',
    swim: 'q.is_in_water && v.is_moving', run: 'v.is_sprinting', walk: 'v.is_moving',
  };
  const order = ['sleep', 'sit', 'fly', 'swim', 'stand', 'run', 'walk'];
  const BLEND = { idle: 0.3, walk: 0.3, run: 0.25, swim: 0.4, fly: 0.3, sit: 0.5, sleep: 0.7, stand: 0.45 };
  const route = self => order.filter(k => avail[k] && k !== self).map(k => ({ [k]: cond[k] })).concat(self === 'idle' ? [] : [{ idle: 'true' }]);
  const stateAnims = {
    idle: base === 'swim' ? ['idle', 'breathe'] : ['idle', 'breathe'].filter(n => short[n]),
    walk: ['walk'], run: ['run'], swim: ['swim'], fly: ['fly'],
    sit: ['pose_sit', 'breathe'], sleep: ['pose_sleep', 'breathe'], stand: ['pose_stand', 'breathe'],
  };
  if (base === 'fly') { stateAnims.idle = ['fly']; }
  let initial = 'idle';
  const stat = (name, extra) => ({ animations: stateAnims[name].filter(n => short[n]), blend_transition: BLEND[name] || 0.3, transitions: extra });
  if (base === 'swim') {
    states.idle = stat('idle', hasSwim ? [{ swim: 'v.is_moving' }] : []);
    if (hasSwim) states.swim = stat('swim', [{ idle: '!v.is_moving' }]);
    if (avail.sleep) { states.idle.transitions.unshift({ sleep: cond.sleep }); states.sleep = stat('sleep', [{ idle: '!v.am_sleeping' }]); }
    if (avail.sit) { states.idle.transitions.unshift({ sit: cond.sit }); states.sit = stat('sit', [{ idle: '!q.is_sitting' }]); }
  } else if (base === 'fly') {
    states.idle = stat('idle', []);
    initial = 'idle';
    if (!states.idle.animations.length) delete states.idle.animations;
  } else {
    states.idle = stat('idle', route('idle').filter(t => !t.idle));
    if (avail.walk) states.walk = stat('walk', route('walk').map(t => (t.idle ? { idle: '!v.is_moving' } : t)));
    if (avail.run) {
      const rt = route('run').map(t => (t.idle ? { idle: '!v.is_moving' } : t.walk ? { walk: `q.modified_move_speed < ${(sprintT * 0.8).toFixed(3)}` } : t));
      rt.sort((a, b) => (a.walk ? 1 : 0) - (b.walk ? 1 : 0));
      states.run = stat('run', rt);
    }
    for (const k of ['sleep', 'sit', 'stand', 'fly', 'swim']) {
      if (!avail[k]) continue;
      const back = { sleep: '!v.am_sleeping', sit: '!q.is_sitting || v.am_sleeping', stand: '!v.am_standing', fly: '!v.am_flying', swim: '!q.is_in_water || !v.is_moving' }[k];
      states[k] = stat(k, [{ idle: back }]);
    }
  }
  if (!states.idle.animations || !states.idle.animations.length) delete states.idle.animations;
  ctrl[cid('move')] = { initial_state: initial, states };

  const calm = `q.modified_move_speed < ${moveT} && q.is_on_ground && !q.is_in_water && !v.am_sleeping && !q.is_sitting && q.is_alive && !q.has_target`;
  if (canIdle) {
    const st = {
      default: { on_entry: ['v.idle_wait = math.random(3, 9);'], transitions: [{ pick: `q.state_time > v.idle_wait && ${calm}` }] },
      pick: { on_entry: [`v.idle_pick = math.random_integer(0, ${idleList.length - 1});`], transitions: idleList.map((_, i) => ({ ['a' + i]: `v.idle_pick == ${i}` })) },
    };
    idleList.forEach((n, i) => { st['a' + i] = { animations: [n], blend_transition: 0.35, transitions: [{ default: `q.all_animations_finished || q.modified_move_speed >= ${moveT} || v.am_sleeping || q.has_target || !q.is_alive` }] }; });
    ctrl[cid('idles')] = { initial_state: 'default', states: st };
  }
  if (attackNames.length) {
    const st = { default: { transitions: [{ [attackNames.length > 1 ? 'pick' : 'a0']: 'v.attack_time > 0 && q.is_alive' }] } };
    if (attackNames.length > 1) {
      st.pick = { on_entry: [`v.atk_pick = math.random_integer(0, ${attackNames.length - 1});`], transitions: attackNames.map((_, i) => ({ ['a' + i]: `v.atk_pick == ${i}` })) };
    }
    attackNames.forEach((n, i) => { st['a' + i] = { animations: [n], blend_transition: 0.12, transitions: [{ default: 'q.all_animations_finished' }] }; });
    ctrl[cid('attack')] = { initial_state: 'default', states: st };
  }
  if (air) {
    const aw = `q.is_baby ? 1 : ${airW}`;
    ctrl[cid('air')] = { initial_state: 'default', states: {
      default: { transitions: [{ jump: 'v.life_vy > 2 && !q.is_in_water && !v.am_sleeping' }, { fall: 'v.life_vy < -5 && !q.is_on_ground && !q.is_in_water' }] },
      jump: { animations: [{ air_jump: aw }], blend_transition: 0.12, transitions: [{ land: 'q.state_time > 0.3 && v.life_vy <= 0.5 && q.is_on_ground' }, { fall: 'v.life_vy < -5' }, { default: 'q.is_in_water || q.state_time > 2' }] },
      fall: { animations: [{ air_fall: aw }], blend_transition: 0.25, transitions: [{ land: 'q.is_on_ground' }, { default: 'q.is_in_water' }] },
      land: { animations: [{ air_land: aw }], blend_transition: 0.08, transitions: [{ default: 'q.any_animation_finished' }, { jump: 'v.life_vy > 2' }] },
    } };
  }
  ctrl[cid('hurt')] = { initial_state: 'default', states: {
    default: { transitions: [{ hurt: 'q.hurt_time > 0 && q.is_alive' }] },
    hurt: { animations: ['hurt'], blend_transition: 0.05, transitions: [{ default: 'q.all_animations_finished' }] },
  } };
  ctrl[cid('death')] = { initial_state: 'default', states: {
    default: { on_entry: ['v.death_pick = math.random_integer(0, 1);'], transitions: [{ dead_0: '!q.is_alive && v.death_pick == 0' }, { dead_1: '!q.is_alive && v.death_pick == 1' }] },
    dead_0: { animations: ['death_0'], blend_transition: 0.1 },
    dead_1: { animations: ['death_1'], blend_transition: 0.1 },
  } };
  U.writeJson(path.join(C.RP, 'animation_controllers', NS, `${id}.controller.json`), { format_version: '1.10.0', animation_controllers: ctrl });

  // ---- client entity
  const textures = {};
  variants.forEach((t, i) => (textures['v' + i] = texPath(t)));
  if (sleepTex) sleepTex.forEach((t, i) => (textures['sleep' + i] = texPath(t)));
  if (angryTex) angryTex.forEach((t, i) => (textures['angry' + i] = texPath(t)));
  if (glow) textures.glow = texPath(glow);
  if (overlay) textures.overlay = texPath(overlay);
  if (babyTex) textures.baby = texPath(babyTex);
  const geometry = {};
  geos.forEach(g => (geometry[g.key] = g.geoId));
  const animations = Object.assign({}, short);
  const animate = ['ctrl_move'];
  animations.ctrl_move = cid('move');
  if (short.look) animate.push({ look: '!v.am_sleeping && q.is_alive' });
  if (short.fix) animate.push('fix');
  for (const n of ['air', 'idles', 'attack', 'hurt', 'death']) if (ctrl[cid(n)]) { animations['ctrl_' + n] = cid(n); animate.push('ctrl_' + n); }
  if (short.baby) animate.push({ baby: 'q.is_baby' });

  const nV = variants.length;
  const texArr = variants.map((_, i) => 'Texture.v' + i)
    .concat(variants.map((_, i) => (angryTex ? 'Texture.angry' + i : 'Texture.v' + i)))
    .concat(variants.map((_, i) => (sleepTex ? 'Texture.sleep' + i : 'Texture.v' + i)));
  const varIdx = nV > 1 ? `math.clamp(q.variant, 0, ${nV - 1})` : '0';
  let texIndex = varIdx;
  if (sleepTex && angryTex) texIndex = `(v.am_sleeping ? ${2 * nV} : (q.property('${NS}:angry') ? ${nV} : 0)) + ${varIdx}`;
  else if (sleepTex) texIndex = `(v.am_sleeping ? ${2 * nV} : 0) + ${varIdx}`;
  else if (angryTex) texIndex = `(q.property('${NS}:angry') ? ${nV} : 0) + ${varIdx}`;
  if (babyTex) { texArr.push('Texture.baby'); texIndex = `q.is_baby ? ${texArr.length - 1} : (${texIndex})`; }
  let geoExpr = 'Geometry.default';
  const geoArrays = {};
  if (geos.length > 1) {
    geoArrays['Array.geos'] = geos.map(g => 'Geometry.' + g.key);
    const bi = geos.findIndex(g => g.key === 'baby');
    const vIdx = s.variantModels ? `math.clamp(q.variant, 0, ${s.variantModels.length - 1})` : '0';
    geoExpr = bi >= 0 ? `Array.geos[q.is_baby ? ${bi} : ${vIdx}]` : `Array.geos[${vIdx}]`;
  }
  const rcMain = `controller.render.${NS}.${id}`;
  const rc = { [rcMain]: Object.assign({ arrays: Object.assign({ textures: { 'Array.skins': texArr } }, geos.length > 1 ? { geometries: geoArrays } : {}) }, { geometry: geoExpr, materials: [{ '*': 'Material.default' }], textures: [`Array.skins[${texIndex}]`] }) };
  const rcs = [rcMain];
  if (overlay) {
    rc[rcMain + '.overlay'] = Object.assign(geos.length > 1 ? { arrays: { geometries: geoArrays } } : {}, { geometry: geoExpr, materials: [{ '*': 'Material.overlay' }], textures: ['Texture.overlay'] });
    rcs.push(rcMain + '.overlay');
  }
  if (glow) {
    rc[rcMain + '.glow'] = Object.assign(geos.length > 1 ? { arrays: { geometries: geoArrays } } : {}, { geometry: geoExpr, materials: [{ '*': 'Material.glow' }], textures: ['Texture.glow'], ignore_lighting: true });
    rcs.push(sleeps ? { [rcMain + '.glow']: '!v.am_sleeping' } : rcMain + '.glow');
  }
  U.writeJson(path.join(C.RP, 'render_controllers', NS, `${id}.render_controllers.json`), { format_version: '1.10.0', render_controllers: rc });
  const scripts = { initialize: ['v.is_moving = 0;', 'v.is_sprinting = 0;', 'v.anim_speed = 1;', 'v.am_flying = 0;', 'v.am_sleeping = 0;', 'v.am_standing = 0;', 'v.life_py = q.position(1);', 'v.life_vy = 0;'], pre_animation: pre, animate };
  if (e.scale) scripts.scale = String(e.scale[0]);
  if (s.scaleVariant) scripts.scale = `q.variant == 1 ? ${s.scaleVariant[1]} : (q.variant == 2 ? ${s.scaleVariant[2]} : 1)`;
  U.writeJson(path.join(C.RP, 'entity', NS, `${id}.entity.json`), {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: full,
        materials: { default: s.translucent ? 'entity_alphablend' : 'entity_alphatest', overlay: 'entity_alphatest', glow: 'entity_alphatest' },
        textures, geometry, animations, scripts, render_controllers: rcs,
        spawn_egg: e.egg ? { base_color: e.egg[0], overlay_color: e.egg[1] } : { base_color: '#7a5a3a', overlay_color: '#d8b98a' },
        enable_attachables: false,
      },
    },
  });
  return { sleeps, nV, attackNames, idleList, gait: usedGait, anims: Object.keys(anims).length, states: Object.keys(states) };
}

module.exports = { generateClient };
