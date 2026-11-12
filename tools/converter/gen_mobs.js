// Generates every Alex's Mobs creature: RP (geometry, textures, animations, controllers,
// client entity, render controllers) + BP (entity, spawn rule, loot table).
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');
const U = require('./util');
const { Interp } = require('./interp');
const G = require('./geometry');
const A = require('./anims');
const B = require('./biomes');
const SPECS = require('./mobs');
const GP = require('./gen_parts');

const NS = C.NS;
const P = C.PKG;
const MODEL = n => (n.includes('/') ? n : `${P}/client/model/${n}`);
const ATTACK_RE = /^(SLASH|SWIPE|MAUL|BITE|ATTACK|SLAM|LUNGE|DEATHROLL|STOMP|FLING|SHOVE|KICK|PUNCH|TAILSWING|STAB|PAW|LEAP|GORE|BUCK|THROW|LAUNCH)/;
const IDLE_SKIP_RE = /PREPARE|EMERGE|JUMPUP|DODGE|SUCK|SPIT/;

// ---------------------------------------------------------------- model helpers
function buildModel(cls, ctor, sw) {
  const I = new Interp(MODEL(cls));
  const boxes = I.build(ctor || [], sw || 1);
  return { I, boxes };
}

function texPath(rel) { return `textures/entity/${NS}/${rel}`; }
function copyTex(rel) {
  if (!U.hasTex('entity/' + rel)) return false;
  U.copy(U.jarTex('entity/' + rel), path.join(C.RP, texPath(rel) + '.png'));
  return true;
}

// ---------------------------------------------------------------- per mob
function generate(e, ctx) {
  const id = e.id;
  const s = Object.assign({}, SPECS[id] || {});
  const full = `${NS}:${id}`;
  const prefix = `animation.${NS}.${id}`;
  const out = { id, notes: [] };

  // ---- models
  const mainCls = s.modelHint || (e.models && e.models[0] && e.models[0].split('/').pop()) || (e.guessModel && e.guessModel.split('/').pop());
  if (!mainCls) { ctx.warn.push(`${id}: no model`); return null; }
  const geos = []; // {key, geoId, interp, boxes, names}
  const addGeo = (key, cls, ctor, sw) => {
    const { I, boxes } = buildModel(cls, ctor, sw);
    const geoId = key === 'default' ? `geometry.${NS}.${id}` : `geometry.${NS}.${id}.${key}`;
    let g = G.toGeometry(geoId, boxes, I.texW, I.texH, { neck: geos[0] && geos[0].neck });
    if (!geos.length) g = G.toGeometry(geoId, boxes, I.texW, I.texH, { neck: g.neck });
    U.writeJson(path.join(C.RP, 'models/entity', NS, `${id}${key === 'default' ? '' : '.' + key}.geo.json`), g.json);
    const rec = { key, geoId, I, boxes, neck: geos.length ? geos[0].neck : g.neck, names: g.names, bones: g.json['minecraft:geometry'][0].bones, bounds: g.bounds };
    geos.push(rec);
    return rec;
  };
  const main = addGeo('default', mainCls, s.modelCtor);
  if (s.variantModels) s.variantModels.forEach((m, i) => { if (i > 0) addGeo('v' + i, m); });
  if (s.baby) addGeo('baby', s.baby);

  // ---- textures
  const exists = rel => U.hasTex('entity/' + rel);
  let variants = (s.variants || [s.tex || id]).filter(exists);
  if (!variants.length) {
    const cand = (e.textures || []).map(t => t.replace(/^alexsmobs:textures\/entity\//, '').replace(/\.png$/, '')).filter(t => exists(t) && !/glow|eyes|overlay|saddle|sleep|angry/.test(t));
    variants = cand.length ? [cand[0]] : [];
  }
  if (!variants.length) { ctx.warn.push(`${id}: no texture`); return null; }
  variants.forEach(copyTex);
  const listOrRepeat = v => (Array.isArray(v) ? v : variants.map(() => v)).map((t, i) => (exists(t) ? t : variants[i]));
  const sleepTex = s.states && s.states.sleep ? listOrRepeat(s.states.sleep) : null;
  const angryTex = s.states && s.states.angry ? listOrRepeat(s.states.angry) : null;
  [sleepTex, angryTex].forEach(l => l && l.forEach(copyTex));
  const glow = s.glow && exists(s.glow) ? s.glow : null;
  if (glow) copyTex(glow);
  const overlay = s.overlay && exists(s.overlay) ? s.overlay : null;
  if (overlay) copyTex(overlay);
  const babyTex = s.babyTex && exists(s.babyTex) ? s.babyTex : null;
  if (babyTex) copyTex(babyTex);

  // ---- animations
  const anims = {};
  const animMap = {}; // short -> full id
  let pose = main.I.setupAnim();
  const M_ = require('./molang');
  const poseSize = r => (r ? [...r.chan.values()].reduce((a, v) => a + M_.str(v).length, 0) : 0);
  if (poseSize(pose) > 30000) { pose = main.I.setupAnim(false); out.notes.push('pose compiled without branch forking (size)'); }
  const progress = [...main.I.ent.progress.entries()];
  if (pose) Object.assign(anims, A.poseAnimation(`${prefix}.pose`, pose.chan, main.boxes, main.names));
  animMap.pose = `${prefix}.pose`;
  for (const g of geos.slice(1)) {
    const r = g.I.setupAnim();
    for (const [k, v] of g.I.ent.progress) if (!progress.find(p => p[0] === k)) progress.push([k, v]);
    if (r) { Object.assign(anims, A.poseAnimation(`${prefix}.pose_${g.key}`, r.chan, g.boxes, g.names)); animMap['pose_' + g.key] = `${prefix}.pose_${g.key}`; }
  }
  const javaAnims = main.I.animator();
  const attackAnims = [], idleJava = [];
  for (const [name, an] of javaAnims) {
    if (!an.frames.length) continue;
    const short = name.replace(/^ANIMATION_/, '').toLowerCase();
    const dur = (e.animations || {})[name] || an.tick;
    Object.assign(anims, A.bakeKeyframed(`${prefix}.${short}`, an, dur, main.names));
    animMap[short] = `${prefix}.${short}`;
    if (ATTACK_RE.test(name.replace(/^ANIMATION_/, ''))) attackAnims.push({ short, ticks: dur });
    else if (!IDLE_SKIP_RE.test(name)) idleJava.push(short);
  }
  const kindOf = s.kind || autoKind(e);
  const death = A.deathAnims(prefix, main.bones, kindOf);
  Object.assign(anims, death.anims);
  animMap.death_0 = `${prefix}.death_0`; animMap.death_1 = `${prefix}.death_1`; animMap.hurt = `${prefix}.hurt`;
  const generic = A.idleActions(prefix, main.bones, kindOf === 'water' ? 'fish' : kindOf);
  Object.assign(anims, generic);
  const idleList = idleJava.slice();
  for (const k of Object.keys(generic)) { const sh = k.slice(prefix.length + 1); animMap[sh] = k; idleList.push(sh); }
  if (s.fix) { anims[`${prefix}.fix`] = { loop: true, bones: Object.fromEntries(Object.entries(s.fix).map(([b, r]) => [b, { rotation: r }])) }; animMap.fix = `${prefix}.fix`; }
  U.writeJson(path.join(C.RP, 'animations', NS, `${id}.animation.json`), { format_version: '1.8.0', animations: anims });

  // ---- controllers
  const ctrl = {};
  const cid = n => `controller.animation.${NS}.${id}.${n}`;
  const aliveStill = 'q.is_alive && q.ground_speed < 0.08 && !q.is_sitting' + (s.sleepy !== false ? ' && !v.am_sleeping' : '');
  if (attackAnims.length) {
    const st = { default: { transitions: attackAnims.map((a, i) => ({ ['attack_' + i]: `q.property('${NS}:anim') == ${i + 1}` })) } };
    attackAnims.forEach((a, i) => {
      st['attack_' + i] = { animations: [a.short], transitions: [{ default: `q.property('${NS}:anim') != ${i + 1} && q.all_animations_finished` }], blend_transition: 0.15 };
    });
    ctrl[cid('attack')] = { initial_state: 'default', states: st };
  }
  if (idleList.length) {
    const st = {
      default: {
        on_entry: ['v.idle_t = 0;', 'v.idle_wait = math.random(4, 12);', `v.idle_pick = math.random_integer(0, ${idleList.length - 1});`],
        transitions: idleList.map((n, i) => ({ ['act_' + i]: `v.idle_t > v.idle_wait && v.idle_pick == ${i} && ${aliveStill}` })),
      },
    };
    idleList.forEach((n, i) => {
      st['act_' + i] = { animations: [n], transitions: [{ default: `q.all_animations_finished || q.ground_speed > 0.15 || !q.is_alive` }], blend_transition: 0.3 };
    });
    ctrl[cid('idle')] = { initial_state: 'default', states: st };
  }
  ctrl[cid('death')] = {
    initial_state: 'default',
    states: {
      default: { on_entry: ['v.death_pick = math.random_integer(0, 1);'], transitions: [{ dead_0: '!q.is_alive && v.death_pick == 0' }, { dead_1: '!q.is_alive && v.death_pick == 1' }] },
      dead_0: { animations: ['death_0'], blend_transition: 0.1 },
      dead_1: { animations: ['death_1'], blend_transition: 0.1 },
    },
  };
  ctrl[cid('hurt')] = {
    initial_state: 'default',
    states: {
      default: { transitions: [{ hurt: 'q.hurt_time > 0 && q.is_alive' }] },
      hurt: { animations: ['hurt'], transitions: [{ default: 'q.all_animations_finished' }], blend_transition: 0.05 },
    },
  };
  U.writeJson(path.join(C.RP, 'animation_controllers', NS, `${id}.controller.json`), { format_version: '1.10.0', animation_controllers: ctrl });

  // ---- client entity
  const isFlyKind = ['flyer', 'hover'].includes(kindOf);
  const sleeps = progress.some(([k]) => /sleep/.test(k)) || !!(s.states && s.states.sleep);
  const pre = [
    'v.ls = q.modified_distance_moved;',
    'v.lsa = math.clamp(q.modified_move_speed, 0, 1);',
    'v.age = q.life_time * 20;',
    'v.yaw = math.clamp(q.target_y_rotation, -85, 85);',
    'v.pitch = math.clamp(q.target_x_rotation, -60, 60);',
    'v.idle_t = (v.idle_t ?? 0) + q.delta_time;',
    `v.am_flying = ${s.alwaysFly ? '1' : isFlyKind ? '!q.is_on_ground && !q.is_in_water' : '0'};`,
    'v.am_running = q.modified_move_speed > 0.45;',
    `v.am_sleeping = ${sleeps ? `q.property('${NS}:sleeping')` : '0'};`,
    `v.am_standing = ${attackAnims.length ? '0' : `q.property('${NS}:angry') && q.ground_speed < 0.05`};`,
    'v.am_eating = 0; v.am_digging = 0; v.am_rolling = 0; v.am_perching = 0; v.am_dancing = 0;',
  ];
  for (const [key, p] of progress) {
    const max = p.max || 5;
    const target = p.target || '0';
    pre.push(`v.p_${key} = math.clamp((v.p_${key} ?? 0) + ((${target}) ? 1 : -1) * q.delta_time * 20, 0, ${max});`);
  }
  const textures = {};
  variants.forEach((t, i) => (textures['v' + i] = texPath(t)));
  if (sleepTex) sleepTex.forEach((t, i) => (textures['sleep' + i] = texPath(t)));
  if (angryTex) angryTex.forEach((t, i) => (textures['angry' + i] = texPath(t)));
  if (glow) textures.glow = texPath(glow);
  if (overlay) textures.overlay = texPath(overlay);
  if (babyTex) textures.baby = texPath(babyTex);
  const geometry = {};
  geos.forEach(g => (geometry[g.key] = g.geoId));
  const animations = Object.assign({}, animMap);
  const animate = [];
  if (geos.length > 1 && s.variantModels) {
    animate.push({ pose: 'q.variant == 0' });
    geos.filter(g => g.key.startsWith('v')).forEach(g => animate.push({ ['pose_' + g.key]: `q.variant == ${g.key.slice(1)}` }));
  } else if (s.baby) {
    animate.push({ pose: '!q.is_baby' });
    if (animMap.pose_baby) animate.push({ pose_baby: 'q.is_baby' });
  } else animate.push('pose');
  if (animMap.fix) animate.push('fix');
  for (const n of ['attack', 'idle', 'death', 'hurt']) {
    if (ctrl[cid(n)]) { animations['ctrl_' + n] = cid(n); animate.push('ctrl_' + n); }
  }
  const nV = variants.length;
  const state = [
    sleepTex ? `(v.am_sleeping ? ${2 * nV} : 0)` : null,
    angryTex ? `(q.property('${NS}:angry') ? ${nV} : 0)` : null,
  ].filter(Boolean);
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
    const list = geos.map(g => 'Geometry.' + g.key);
    geoArrays['Array.geos'] = list;
    const bi = geos.findIndex(g => g.key === 'baby');
    const vIdx = s.variantModels ? `math.clamp(q.variant, 0, ${s.variantModels.length - 1})` : '0';
    geoExpr = bi >= 0 ? `Array.geos[q.is_baby ? ${bi} : ${vIdx}]` : `Array.geos[${vIdx}]`;
  }
  const rcMain = `controller.render.${NS}.${id}`;
  const rc = {
    [rcMain]: Object.assign(
      { arrays: Object.assign({ textures: { 'Array.skins': texArr } }, geos.length > 1 ? { geometries: geoArrays } : {}) },
      { geometry: geoExpr, materials: [{ '*': 'Material.default' }], textures: [`Array.skins[${texIndex}]`] }),
  };
  const rcs = [rcMain];
  if (overlay) {
    rc[rcMain + '.overlay'] = Object.assign(geos.length > 1 ? { arrays: { geometries: geoArrays } } : {}, { geometry: geoExpr, materials: [{ '*': 'Material.overlay' }], textures: ['Texture.overlay'] });
    rcs.push(rcMain + '.overlay');
  }
  if (glow) {
    rc[rcMain + '.glow'] = Object.assign(geos.length > 1 ? { arrays: { geometries: geoArrays } } : {}, { geometry: geoExpr, materials: [{ '*': 'Material.glow' }], textures: ['Texture.glow'], ignore_lighting: true });
    rcs.push(sleepTex || sleeps ? { [rcMain + '.glow']: '!v.am_sleeping' } : rcMain + '.glow');
  }
  U.writeJson(path.join(C.RP, 'render_controllers', NS, `${id}.render_controllers.json`), { format_version: '1.10.0', render_controllers: rc });
  const scripts = { pre_animation: pre, animate };
  if (e.scale) scripts.scale = String(e.scale[0]);
  const client = {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: full,
        materials: { default: s.translucent ? 'entity_alphablend' : 'entity_alphatest', overlay: 'entity_alphatest', glow: 'entity_alphatest' },
        textures, geometry, animations, scripts,
        render_controllers: rcs,
        spawn_egg: e.egg ? { base_color: e.egg[0], overlay_color: e.egg[1] } : { base_color: '#7a5a3a', overlay_color: '#d8b98a' },
        enable_attachables: false,
      },
    },
  };
  U.writeJson(path.join(C.RP, 'entity', NS, `${id}.entity.json`), client);

  // ---- behavior
  const bp = behavior(e, s, kindOf, { attackAnims, sleeps, nV, babyModel: !!s.baby });
  U.writeJson(path.join(C.BP, 'entities', NS, `${id}.json`), bp);
  spawnRule(e, s, kindOf, ctx);
  loot(e, ctx);
  sounds(e, ctx);
  ctx.lang.push(`entity.${full}.name=${e.name}`, `item.spawn_egg.entity.${full}.name=${e.name} Spawn Egg`);
  ctx.attackAnims[full] = attackAnims.map(a => a.ticks);
  if (s.parts) GP.generateChain(e, s, { variants }, ctx);
  if (s.follower) GP.generateFollower(e, s, ctx);
  out.geos = geos.map(g => g.key);
  out.anims = Object.keys(anims).length;
  out.attack = attackAnims.map(a => a.short);
  out.idle = idleList;
  return out;
}

function autoKind(e) {
  const sup = (e.supers || []).join(' ');
  const ifs = (e.interfaces || []).join(' ');
  if (/ISemiAquatic/.test(ifs)) return 'semi';
  if (/WaterAnimal/.test(sup)) return 'water';
  if (/FlyingAnimal/.test(ifs) || e.attrs.flying_speed) return 'hover';
  return 'land';
}

// ---------------------------------------------------------------- behavior pack entity
function behavior(e, s, kind, info) {
  const id = e.id, full = `${NS}:${id}`;
  const a = e.attrs || {};
  const health = Math.max(1, Math.round(a.health || 10));
  const speed = +(a.speed || 0.25).toFixed(3);
  const damage = a.damage ? Math.max(1, Math.round(a.damage)) : 0;
  const temper = s.temper || (e.category === 'MONSTER' ? 'hostile' : damage ? 'neutral' : 'passive');
  const hostile = temper === 'hostile';
  const fam = [id, NS, 'mob'];
  if (/water|whale/.test(kind)) fam.push('fish');
  if (hostile) fam.push('monster'); else fam.push('animal');
  const goals = (e.goals || []).map(g => g.goal).join(' ');
  const breedable = /Breed|MateGoal/.test(goals) && !hostile;
  // Alex's Mobs tags are named after the mob, sometimes shortened (grizzly_*, not grizzly_bear_*)
  const names = [...new Set([id, id.replace(/_[a-z]+$/, ''), id.split('_')[0], ...(s.tagNames || [])])];
  const tagOf = (suffix, fn = U.itemTag) => { for (const n of names) { const v = fn(`${n}_${suffix}`); if (v.length) return v; } return []; };
  const tameItems = tagOf('tameables');
  const tameable = (e.supers || []).includes('TamableAnimal') && tameItems.length > 0;
  const breedItems = [...new Set(tagOf('breedables').concat(s.breedItems || []))];
  const temptItems = [...new Set([...tagOf('foodstuffs'), ...breedItems, ...tameItems])].slice(0, 40);
  const prey = [...new Set([...(s.prey || []), ...tagOf('targets', U.entityTag).map(x => x.split(':')[1])])].filter(x => x && x !== id);

  const C2 = {}; // components
  const groups = {};
  const events = {};
  C2['minecraft:type_family'] = { family: fam };
  C2['minecraft:collision_box'] = { width: Math.min(e.width, 4), height: Math.min(e.height, 4) };
  C2['minecraft:health'] = { value: health, max: health };
  C2['minecraft:movement'] = { value: speed };
  if (damage) C2['minecraft:attack'] = { damage };
  if (a.knockback_resistance) C2['minecraft:knockback_resistance'] = { value: Math.min(1, +a.knockback_resistance.toFixed(2)) };
  if (a.follow_range) C2['minecraft:follow_range'] = { value: Math.min(64, Math.round(a.follow_range)), max: 64 };
  C2['minecraft:physics'] = {};
  C2['minecraft:pushable'] = { is_pushable: true, is_pushable_by_piston: true };
  C2['minecraft:nameable'] = {};
  C2['minecraft:conditional_bandwidth_optimization'] = {};
  C2['minecraft:jump.static'] = {};
  C2['minecraft:loot'] = { table: `loot_tables/${NS}/entities/${id}.json` };
  if (!hostile && e.height < 2.2) C2['minecraft:leashable'] = { soft_distance: 4, hard_distance: 6, max_distance: 10 };
  if (e.fireImmune || ['lava', 'lavawalker'].includes(kind) || s.lavaOk) C2['minecraft:fire_immune'] = true;
  else C2['minecraft:hurt_on_condition'] = { damage_conditions: [{ filters: { test: 'in_lava', subject: 'self' }, cause: 'lava', damage_per_tick: 4 }] };
  C2['minecraft:despawn'] = hostile ? { despawn_from_distance: {} } : { despawn_from_distance: { min_distance: 54, max_distance: 128 } };
  C2['minecraft:experience_reward'] = { on_bred: 'Math.Random(1,7)', on_death: hostile ? 'q.last_hit_by_player ? 5 : 0' : 'q.last_hit_by_player ? Math.Random(1,3) : 0' };
  C2['minecraft:behavior.look_at_player'] = { priority: 8, look_distance: 8, probability: 0.02 };
  C2['minecraft:behavior.random_look_around'] = { priority: 9 };
  if (a.armor) C2['minecraft:damage_sensor'] = { triggers: [{ cause: 'entity_attack', deals_damage: 'yes', damage_multiplier: +(1 - Math.min(0.6, a.armor * 0.04)).toFixed(2) }] };

  // ---- movement kinds
  const flyFall = { triggers: [{ cause: 'fall', deals_damage: 'no' }] };
  switch (kind) {
    case 'water':
      Object.assign(C2, {
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0, breathes_water: true, breathes_air: false, generates_bubbles: false },
        'minecraft:navigation.generic': { is_amphibious: false, can_path_over_water: false, can_swim: true, can_walk: false, can_breach: false, can_sink: false },
        'minecraft:movement.sway': { sway_amplitude: 0 },
        'minecraft:underwater_movement': { value: Math.min(0.2, Math.max(0.08, speed * 0.6)) },
        'minecraft:behavior.swim_idle': { priority: 7, idle_time: 5, success_rate: 0.1 },
        'minecraft:behavior.random_swim': { priority: 5, speed_multiplier: 1, xz_dist: 16, y_dist: s.bottom ? 1 : 4, interval: 0 },
        'minecraft:behavior.swim_wander': { priority: 6, interval: 0.0166, look_ahead: 5, speed_multiplier: 0.014, wander_time: 5 },
      });
      delete C2['minecraft:jump.static'];
      if (s.school) C2['minecraft:flocking'] = { in_water: true, match_variants: false, use_center_of_mass: true, low_flock_limit: 4, high_flock_limit: 8, goal_weight: 2, loner_chance: 0.1, influence_radius: 3, breach_influence: 7, separation_weight: 1.75, separation_threshold: 0.95, cohesion_weight: 1.85, cohesion_threshold: 1.95, innner_cohesion_threshold: 1.25, min_height: 1.5, max_height: 6, block_distance: 1, block_weight: 0.75 };
      break;
    case 'whale':
      Object.assign(C2, {
        'minecraft:breathable': { total_supply: 300, suffocate_time: 0, breathes_air: true, breathes_water: false, generates_bubbles: false },
        'minecraft:navigation.generic': { is_amphibious: true, can_path_over_water: true, can_swim: true, can_walk: true, can_breach: false, can_jump: false },
        'minecraft:movement.basic': {},
        'minecraft:underwater_movement': { value: 0.18 },
        'minecraft:behavior.swim_up_for_breath': { priority: 1 },
        'minecraft:behavior.random_swim': { priority: 7, interval: 0, xz_dist: 20, y_dist: 4 },
        'minecraft:behavior.swim_wander': { priority: 8, interval: 0.0166, look_ahead: 5, speed_multiplier: 0.014, wander_time: 5 },
      });
      C2['minecraft:movement'] = { value: 0.12 };
      break;
    case 'semi':
      Object.assign(C2, {
        'minecraft:breathable': { total_supply: 300, suffocate_time: 0, breathes_air: true, breathes_water: true, generates_bubbles: false },
        'minecraft:navigation.generic': { is_amphibious: true, can_path_over_water: false, can_swim: true, can_walk: true, can_sink: false, avoid_damage_blocks: true },
        'minecraft:movement.amphibious': { max_turn: 15 },
        'minecraft:underwater_movement': { value: Math.min(0.2, Math.max(0.06, speed * 0.6)) },
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.8, interval: 100 },
        'minecraft:behavior.random_swim': { priority: 7, speed_multiplier: 1, xz_dist: 12, y_dist: s.bottom ? 1 : 3, interval: 100 },
        'minecraft:behavior.move_to_water': { priority: 6, search_range: 16, search_height: 5, search_count: 1, goal_radius: 0.1 },
      });
      if (s.bottom) delete C2['minecraft:behavior.move_to_water'];
      break;
    case 'flyer':
      Object.assign(C2, {
        'minecraft:navigation.fly': { can_path_over_water: true, can_path_from_air: true, avoid_damage_blocks: true, avoid_water: true },
        'minecraft:movement.fly': {},
        'minecraft:can_fly': {},
        'minecraft:flying_speed': { value: Math.min(0.6, Math.max(0.3, (a.flying_speed || speed * 1.6))) },
        'minecraft:behavior.random_fly': { priority: 6, xz_dist: 16, y_dist: 6, y_offset: 0, speed_multiplier: 1, can_land_on_trees: true, avoid_damage_blocks: true },
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.8 },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
      });
      C2['minecraft:damage_sensor'] = mergeSensor(C2['minecraft:damage_sensor'], flyFall);
      break;
    case 'hover':
      Object.assign(C2, {
        'minecraft:navigation.hover': { can_path_over_water: true, can_sink: false, can_pass_doors: false, can_path_from_air: true, avoid_water: true, avoid_damage_blocks: true, avoid_sun: false },
        'minecraft:movement.hover': {},
        'minecraft:can_fly': {},
        'minecraft:flying_speed': { value: Math.min(0.6, Math.max(0.15, (a.flying_speed && a.flying_speed < 2 ? a.flying_speed * 0.6 : speed * 1.2))) },
        'minecraft:behavior.random_hover': { priority: 6, xz_dist: 10, y_dist: 6, y_offset: -1, interval: 1, hover_height: [1, 5] },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
      });
      C2['minecraft:damage_sensor'] = mergeSensor(C2['minecraft:damage_sensor'], flyFall);
      if (s.alwaysFly || s.gravityless) C2['minecraft:physics'] = { has_gravity: false };
      delete C2['minecraft:jump.static'];
      break;
    case 'lava':
    case 'lavawalker':
      Object.assign(C2, {
        'minecraft:navigation.walk': { can_path_over_lava: true, can_walk_in_lava: true, avoid_water: true, can_sink: false, avoid_damage_blocks: false },
        'minecraft:movement.basic': {},
        'minecraft:lava_movement': { value: Math.max(0.2, speed * 1.5) },
        'minecraft:buoyant': { base_buoyancy: 1, apply_gravity: true, simulate_waves: false, big_wave_probability: 0, liquid_blocks: ['minecraft:lava', 'minecraft:flowing_lava'] },
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.8 },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0, breathes_water: true },
        'minecraft:hurt_on_condition': { damage_conditions: [{ filters: { test: 'in_contact_with_water', operator: '==', value: true }, cause: 'drowning', damage_per_tick: 1 }] },
      });
      break;
    case 'climber':
      Object.assign(C2, {
        'minecraft:navigation.climb': { can_path_over_water: false, avoid_damage_blocks: true },
        'minecraft:movement.basic': {},
        'minecraft:can_climb': {},
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.8 },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
      });
      break;
    default:
      Object.assign(C2, {
        'minecraft:navigation.walk': { can_path_over_water: true, avoid_water: true, avoid_damage_blocks: true, can_open_doors: false },
        'minecraft:movement.basic': {},
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.8 },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
      });
      if (s.climbs) C2['minecraft:can_climb'] = {};
  }
  if (!['water', 'whale'].includes(kind) && !(kind === 'hover' && s.alwaysFly)) C2['minecraft:behavior.float'] = { priority: 0 };

  // ---- temperament
  const melee = { priority: 3, speed_multiplier: kind === 'water' || kind === 'whale' ? 1.6 : 1.25, track_target: true, reach_multiplier: Math.max(1.5, Math.min(3, e.width * 1.2)) };
  const famTest = f => ({ test: 'is_family', subject: 'other', value: f });
  const targets = [];
  if (hostile || s.player) targets.push({ filters: { all_of: [famTest('player'), { test: 'is_creative', subject: 'other', operator: '!=', value: true }] }, max_dist: Math.min(48, a.follow_range || 16) });
  if (prey.length) targets.push({ filters: { any_of: prey.map(famTest) }, max_dist: 16 });
  if (damage && (hostile || temper === 'predator' || temper === 'neutral')) {
    C2['minecraft:behavior.melee_attack'] = melee;
    C2['minecraft:behavior.hurt_by_target'] = { priority: 1 };
    if (targets.length) {
      C2['minecraft:behavior.nearest_attackable_target'] = {
        priority: 2, must_see: true, reselect_targets: true, within_radius: 24, must_see_forget_duration: 10,
        attack_interval: hostile ? 0 : 20,
        entity_types: targets,
      };
    }
    C2['minecraft:on_target_acquired'] = { event: `${NS}:angry`, target: 'self' };
    C2['minecraft:on_target_escape'] = { event: `${NS}:calm`, target: 'self' };
    events[`${NS}:angry`] = { set_property: { [`${NS}:angry`]: true } };
    events[`${NS}:calm`] = { set_property: { [`${NS}:angry`]: false } };
  } else {
    C2['minecraft:behavior.panic'] = { priority: 1, speed_multiplier: kind === 'water' ? 1.6 : 1.5 };
  }
  if (temper === 'skittish') {
    C2['minecraft:behavior.avoid_mob_type'] = { priority: 2, entity_types: [{ filters: { all_of: [famTest('player'), { test: 'is_sneaking', subject: 'other', value: false }, ...temptItems.slice(0, 6).map(it => ({ test: 'has_equipment', subject: 'other', domain: 'hand', operator: '!=', value: it }))] }, max_dist: 8, walk_speed_multiplier: 1.3, sprint_speed_multiplier: 1.6 }] };
  }
  if (temptItems.length && !hostile) C2['minecraft:behavior.tempt'] = { priority: 4, speed_multiplier: 1.1, within_radius: 10, items: temptItems, can_tempt_vertically: isFly(kind) };

  // ---- breeding / babies
  const baby = {
    'minecraft:is_baby': {},
    'minecraft:scale': { value: info.babyModel ? 1 : 0.5 },
    'minecraft:ageable': { duration: 1200, feed_items: breedItems.length ? breedItems : temptItems, grow_up: { event: 'minecraft:ageable_grow_up', target: 'self' } },
    'minecraft:behavior.follow_parent': { priority: 5, speed_multiplier: 1.1 },
  };
  if (C2['minecraft:behavior.melee_attack']) baby['minecraft:behavior.panic'] = { priority: 1, speed_multiplier: 1.4 };
  const adult = {};
  if (breedable && (breedItems.length || temptItems.length)) {
    adult['minecraft:breedable'] = {
      require_tame: false, breed_items: breedItems.length ? breedItems : temptItems,
      breeds_with: { mate_type: full, baby_type: full, breed_event: { event: 'minecraft:entity_born', target: 'baby' } },
    };
    adult['minecraft:behavior.breed'] = { priority: 3, speed_multiplier: 1 };
  }
  groups[`${NS}:baby`] = baby;
  groups[`${NS}:adult`] = adult;
  if (C2['minecraft:behavior.melee_attack'] && breedable) {
    // babies never fight
    adult['minecraft:behavior.melee_attack'] = C2['minecraft:behavior.melee_attack'];
    delete C2['minecraft:behavior.melee_attack'];
  }

  // ---- taming
  if (tameable) {
    groups[`${NS}:wild`] = {
      'minecraft:tameable': { probability: 0.33, tame_items: tameItems, tame_event: { event: `${NS}:on_tame`, target: 'self' } },
    };
    groups[`${NS}:tamed`] = {
      'minecraft:is_tamed': {},
      'minecraft:sittable': {},
      'minecraft:behavior.stay_while_sitting': { priority: 1 },
      'minecraft:behavior.follow_owner': { priority: 4, speed_multiplier: 1.1, start_distance: 10, stop_distance: 3 },
      'minecraft:behavior.owner_hurt_by_target': { priority: 1 },
      'minecraft:behavior.owner_hurt_target': { priority: 2 },
      'minecraft:healable': { items: temptItems.slice(0, 12).map(item => ({ item, heal_amount: 4 })) },
    };
    events[`${NS}:on_tame`] = { remove: { component_groups: [`${NS}:wild`] }, add: { component_groups: [`${NS}:tamed`] } };
    if (C2['minecraft:behavior.nearest_attackable_target']) {
      groups[`${NS}:wild`]['minecraft:behavior.nearest_attackable_target'] = C2['minecraft:behavior.nearest_attackable_target'];
      delete C2['minecraft:behavior.nearest_attackable_target'];
    }
  }

  // ---- variants
  const variantGroups = [];
  if (info.nV > 1) {
    for (let i = 0; i < info.nV; i++) { groups[`${NS}:variant_${i}`] = { 'minecraft:variant': { value: i } }; variantGroups.push(`${NS}:variant_${i}`); }
  }
  const weights = s.variantWeights || variantGroups.map(() => 1);
  const pickVariant = variantGroups.length ? [{ randomize: variantGroups.map((g, i) => ({ weight: weights[i] || 1, add: { component_groups: [g] } })) }] : [];

  // ---- sleep schedule (only mobs with sleep poses/textures)
  if (info.sleeps) {
    const night = !s.nocturnal;
    const awake = { 'minecraft:movement': C2['minecraft:movement'], 'minecraft:timer': { looping: true, randomInterval: true, time: [20, 60], time_down_event: { event: `${NS}:try_sleep`, target: 'self' } } };
    delete C2['minecraft:movement'];
    groups[`${NS}:awake`] = awake;
    groups[`${NS}:asleep`] = {
      'minecraft:movement': { value: 0 },
      'minecraft:environment_sensor': { triggers: [{ filters: { any_of: [{ test: 'is_daytime', value: night }, { test: 'in_water', value: true }, { test: 'has_target', value: true }] }, event: `${NS}:wake` }] },
      'minecraft:damage_sensor': { triggers: [{ on_damage: { event: `${NS}:wake`, target: 'self' }, deals_damage: 'yes' }] },
    };
    events[`${NS}:try_sleep`] = { sequence: [{ filters: { all_of: [{ test: 'is_daytime', value: !night }, { test: 'on_ground', value: true }, { test: 'in_water', value: false }, { test: 'has_target', value: false }, { test: 'is_sitting', value: false }] }, sequence: [{ remove: { component_groups: [`${NS}:awake`] } }, { add: { component_groups: [`${NS}:asleep`] }, set_property: { [`${NS}:sleeping`]: true } }] }] };
    events[`${NS}:wake`] = { sequence: [{ remove: { component_groups: [`${NS}:asleep`] } }, { add: { component_groups: [`${NS}:awake`] }, set_property: { [`${NS}:sleeping`]: false } }] };
  }
  const baseAdd = [...(tameable ? [`${NS}:wild`] : []), ...(info.sleeps ? [`${NS}:awake`] : [])];
  events['minecraft:entity_spawned'] = {
    sequence: [
      ...(baseAdd.length ? [{ add: { component_groups: baseAdd } }] : []),
      ...pickVariant,
      breedable ? { randomize: [{ weight: 90, add: { component_groups: [`${NS}:adult`] } }, { weight: 10, add: { component_groups: [`${NS}:baby`] } }] } : { add: { component_groups: [`${NS}:adult`] } },
    ],
  };
  events['minecraft:entity_born'] = { sequence: [{ add: { component_groups: [...baseAdd, `${NS}:baby`] } }, ...pickVariant] };
  events['minecraft:entity_transformed'] = { add: { component_groups: [...baseAdd, `${NS}:adult`] } };
  events[`${NS}:become_baby`] = { remove: { component_groups: [`${NS}:adult`] }, add: { component_groups: [`${NS}:baby`] } };
  events['minecraft:ageable_grow_up'] = { remove: { component_groups: [`${NS}:baby`] }, add: { component_groups: [`${NS}:adult`] } };
  for (const ev of Object.values(events)) if (ev.add && ev.add.component_groups && !ev.add.component_groups.length) delete ev.add;

  const properties = {
    [`${NS}:anim`]: { type: 'int', range: [0, Math.max(1, info.attackAnims.length)], default: 0, client_sync: true },
    [`${NS}:angry`]: { type: 'bool', default: false, client_sync: true },
  };
  if (info.sleeps) properties[`${NS}:sleeping`] = { type: 'bool', default: false, client_sync: true };
  return {
    format_version: '1.21.50',
    'minecraft:entity': {
      description: { identifier: full, is_spawnable: true, is_summonable: true, is_experimental: false, properties },
      component_groups: groups,
      components: C2,
      events,
    },
  };
}
function mergeSensor(a, b) { return { triggers: [...((b && b.triggers) || []), ...((a && a.triggers) || [])] }; }
const isFly = k => k === 'flyer' || k === 'hover';

// ---------------------------------------------------------------- spawn rules
const POP = { CREATURE: 'animal', MONSTER: 'monster', WATER_CREATURE: 'water_animal', WATER_AMBIENT: 'water_animal', AMBIENT: 'ambient', UNDERGROUND_WATER_CREATURE: 'water_animal', AXOLOTLS: 'water_animal' };
const GROUND = ['minecraft:grass_block', 'minecraft:podzol', 'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:sand', 'minecraft:red_sand', 'minecraft:snow', 'minecraft:snow_layer', 'minecraft:mud', 'minecraft:moss_block', 'minecraft:gravel', 'minecraft:stone', 'minecraft:clay', 'minecraft:mycelium', 'minecraft:terracotta', 'minecraft:grass_path'];
function spawnRule(e, s, kind, ctx) {
  const sp = e.spawn;
  if (!sp || !sp.weight || !sp.biomes || !sp.biomes.length) return;
  const filter = B.biomeFilter(sp.biomes);
  if (!filter) { ctx.warn.push(`${e.id}: no Bedrock biome for spawn set ${sp.set}`); return; }
  const dim = s.spawnDim || B.dimensionOf(sp.biomes, filter);
  const cat = sp.category || e.category;
  const pop = POP[cat] || 'animal';
  const rollPenalty = sp.rolls > 0 ? 1 / Math.max(1, sp.rolls) : 1;
  const weight = Math.max(1, Math.round(sp.weight * rollPenalty * (pop === 'monster' ? 0.6 : 1.5)));
  const cond = {};
  const water = ['water', 'whale'].includes(kind) || (kind === 'semi' && /WATER/.test(cat));
  if (water) {
    cond['minecraft:spawns_underwater'] = {};
    cond['minecraft:height_filter'] = /DEEP_SEA|deep/i.test(sp.set) ? { min: -20, max: 40 } : { min: 30, max: 64 };
    cond['minecraft:distance_filter'] = { min: 12, max: 32 };
  } else if (dim === 'cave') {
    cond['minecraft:spawns_underground'] = {};
    cond['minecraft:height_filter'] = { min: -60, max: 50 };
    cond['minecraft:brightness_filter'] = { min: 0, max: 7, adjust_for_weather: false };
  } else if (kind === 'lava') {
    cond['minecraft:spawns_lava'] = {};
    cond['minecraft:distance_filter'] = { min: 12, max: 64 };
  } else if (kind === 'lavawalker') {
    cond['minecraft:spawns_lava'] = {};
  } else {
    cond['minecraft:spawns_on_surface'] = {};
    if (dim === 'overworld') cond['minecraft:spawns_on_block_filter'] = GROUND.concat(kind === 'semi' ? ['minecraft:water'] : []);
    if (pop === 'monster' && dim === 'overworld') cond['minecraft:brightness_filter'] = { min: 0, max: 7, adjust_for_weather: true };
    else if (pop !== 'monster' && dim === 'overworld') cond['minecraft:brightness_filter'] = { min: 7, max: 15, adjust_for_weather: false };
  }
  if (pop === 'monster' && dim === 'overworld') cond['minecraft:difficulty_filter'] = { min: 'easy', max: 'hard' };
  cond['minecraft:weight'] = { default: Math.min(100, weight) };
  cond['minecraft:herd'] = { min_size: sp.min || 1, max_size: sp.max || 1 };
  cond['minecraft:density_limit'] = water ? { underwater: Math.max(4, (sp.max || 1) * 2) } : { surface: Math.max(4, (sp.max || 1) * 2) };
  cond['minecraft:biome_filter'] = filter;
  U.writeJson(path.join(C.BP, 'spawn_rules', NS, `${e.id}.json`), {
    format_version: '1.8.0',
    'minecraft:spawn_rules': { description: { identifier: `${NS}:${e.id}`, population_control: pop }, conditions: [cond] },
  });
  ctx.spawns.push(`${e.id}: ${pop} w${cond['minecraft:weight'].default} ${dim}`);
}

// ---------------------------------------------------------------- loot
function convLoot(node) {
  if (Array.isArray(node)) return node.map(convLoot);
  if (!node || typeof node !== 'object') return node;
  const o = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'name' && typeof v === 'string' && v.includes(':')) o[k] = U.RENAME[v] || v;
    else if (k === 'function' || k === 'condition') o[k] = String(v).replace(/^minecraft:/, '');
    else if (k === 'predicate' && node.condition && /entity_properties/.test(node.condition)) {
      const flags = (v && v.flags) || {};
      o.properties = flags.is_on_fire ? { on_fire: true } : {};
    } else o[k] = convLoot(v);
  }
  if (o.function === 'set_count' && o.count && typeof o.count === 'object' && o.count.min < 0) o.count.min = 0;
  if (o.condition === 'random_chance_with_looting' && o.looting_multiplier === undefined) o.looting_multiplier = 0.01;
  return o;
}
function loot(e, ctx) {
  const f = path.join(C.DATA, 'loot_tables/entities', `${e.id}.json`);
  let table = { pools: [] };
  if (fs.existsSync(f)) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    table = { pools: (j.pools || []).map(p => { const q = convLoot(p); delete q.name; delete q.bonus_rolls; return q; }) };
  }
  U.writeJson(path.join(C.BP, 'loot_tables', NS, 'entities', `${e.id}.json`), table);
  for (const p of table.pools) for (const en of p.entries || []) if (en.name && en.name.startsWith(NS + ':')) ctx.lootItems.add(en.name);
}

// ---------------------------------------------------------------- sounds
function sounds(e, ctx) {
  const ev = {};
  for (const [k, v] of Object.entries(e.sounds || {})) {
    if (v.am) { ev[k] = `${NS}.${v.am}`; ctx.soundEvents.add(v.am); }
  }
  if (Object.keys(ev).length) ctx.entitySounds[`${NS}:${e.id}`] = { volume: 1, pitch: [0.9, 1.1], events: ev };
}

module.exports = { generate, autoKind };
