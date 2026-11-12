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
const GC = require('./gen_client');
const SP = require('./spawns');
const GL = require('./gen_loot');

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

  // ---- client side: animations, controllers, client entity, render controllers (gen_client.js)
  const kindOf = s.kind || autoKind(e);
  const cl = GC.generateClient({ e, s, id, full, prefix, geos, main, kindOf, variants, sleepTex, angryTex, glow, overlay, babyTex, ctx });
  const { sleeps, nV, attackNames, idleList } = cl;
  out.gait = cl.gait; out.states = cl.states;

  // ---- behavior
  const bp = behavior(e, s, kindOf, { attackAnims: attackNames, sleeps, nV, babyModel: !!s.baby });
  U.writeJson(path.join(C.BP, 'entities', NS, `${id}.json`), bp);
  SP.spawnRule(e, s, kindOf, ctx, /Breed|MateGoal/.test((e.goals || []).map(x => x.goal).join(' ')) && s.temper !== 'hostile');
  loot(e, ctx);
  sounds(e, ctx);
  ctx.lang.push(`entity.${full}.name=${e.name}`, `item.spawn_egg.entity.${full}.name=${e.name} Spawn Egg`);
  if (s.parts) GP.generateChain(e, s, { variants }, ctx);
  if (s.follower) GP.generateFollower(e, s, ctx);
  out.geos = geos.map(g => g.key);
  out.anims = cl.anims;
  out.attack = attackNames;
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
  if (!hostile && e.height < 2.2) C2['minecraft:leashable'] = {};
  if (e.fireImmune || ['lava', 'lavawalker'].includes(kind) || s.lavaOk) C2['minecraft:fire_immune'] = {};
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
        'minecraft:buoyant': { base_buoyancy: 1, apply_gravity: true, big_wave_probability: 0, liquid_blocks: ['minecraft:lava', 'minecraft:flowing_lava'] },
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
  if (hostile || s.player) targets.push({ filters: famTest('player'), max_dist: Math.min(48, a.follow_range || 16) });
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
  // egg layers (crocodile, caiman, platypus, terrapin): mating makes the female pregnant, she then lays an egg block
  // (the vanilla turtle mechanism: causes_pregnancy + behavior.lay_egg); the egg block hatches the baby.
  if (s.lays && adult['minecraft:breedable']) {
    const br = adult['minecraft:breedable'];
    br.causes_pregnancy = true;
    br.breeds_with.breed_event = { event: `${NS}:become_pregnant`, target: 'self' };
    groups[`${NS}:pregnant`] = { 'minecraft:timer': { looping: false, randomInterval: true, time: [30, 80], time_down_event: { event: `${NS}:go_lay_egg`, target: 'self' } } };
    groups[`${NS}:lay_egg`] = { 'minecraft:behavior.lay_egg': { priority: 2, speed_multiplier: 1, search_range: 16, search_height: 4, goal_radius: 1.5, lay_seconds: 8, egg_type: s.lays.egg, target_blocks: s.lays.blocks, on_lay: { event: `${NS}:laid_egg`, target: 'self' } } };
    events[`${NS}:become_pregnant`] = { add: { component_groups: [`${NS}:pregnant`] } };
    events[`${NS}:go_lay_egg`] = { sequence: [{ remove: { component_groups: [`${NS}:pregnant`] } }, { add: { component_groups: [`${NS}:lay_egg`] } }] };
    events[`${NS}:laid_egg`] = { remove: { component_groups: [`${NS}:lay_egg`] } };
  }
  // egg drops (emu, cockroach): adults lay the throwable egg item now and then, like a chicken
  if (s.dropsEgg) adult['minecraft:spawn_entity'] = { entities: [{ min_wait_time: s.dropsEgg.wait[0], max_wait_time: s.dropsEgg.wait[1], spawn_sound: 'plop', spawn_item: s.dropsEgg.item, num_to_spawn: 1 }] };
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
  if (!table.pools.some(p => (p.entries || []).length)) { const o = GL.own(e.id); if (o) table = o; }
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
