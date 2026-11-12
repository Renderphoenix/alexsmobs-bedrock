// Our own spawn rules. Biomes come from the Java mod's rules (mapped to real Bedrock biome tags in biomes.js); the
// numbers are ours: rarity tiers instead of scaled Java weights, light/time rules per temperament, group sizes with
// the occasional baby, and only blocks that exist in Bedrock.
//   per-mob override in mobs.js:  spawn: { weight, herd:[min,max], height:[min,max], blocks:[...], light:'any'|'day'|'dark', dim }
'use strict';
const path = require('path');
const C = require('./config');
const U = require('./util');
const B = require('./biomes');

const NS = C.NS;
const POP = { CREATURE: 'animal', MONSTER: 'monster', WATER_CREATURE: 'water_animal', WATER_AMBIENT: 'water_animal', AMBIENT: 'ambient', UNDERGROUND_WATER_CREATURE: 'water_animal', AXOLOTLS: 'water_animal' };
// every block that exists in Bedrock and that land animals can stand on in the biomes we use
const GROUND = ['minecraft:grass_block', 'minecraft:podzol', 'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:sand', 'minecraft:red_sand',
  'minecraft:snow', 'minecraft:snow_layer', 'minecraft:mud', 'minecraft:moss_block', 'minecraft:gravel', 'minecraft:stone', 'minecraft:clay',
  'minecraft:mycelium', 'minecraft:hardened_clay', 'minecraft:grass_path', 'minecraft:rooted_dirt', 'minecraft:mangrove_roots'];
const NETHER_GROUND = ['minecraft:netherrack', 'minecraft:soul_sand', 'minecraft:soul_soil', 'minecraft:crimson_nylium', 'minecraft:warped_nylium', 'minecraft:basalt', 'minecraft:blackstone'];
const END_GROUND = ['minecraft:end_stone'];

// Java spawn weight -> our rarity tier
const tier = w => (w <= 3 ? 1 : w <= 8 ? 3 : w <= 15 ? 5 : w <= 30 ? 8 : 11);

function spawnRule(e, s, kind, ctx, breedable) {
  const sp = e.spawn;
  const o = s.spawn || {};
  if (!sp || !sp.weight || !sp.biomes || !sp.biomes.length) return;
  const filter = B.biomeFilter(sp.biomes);
  if (!filter) { ctx.warn.push(`${e.id}: no Bedrock biome for spawn set ${sp.set}`); return; }
  const dim = o.dim || s.spawnDim || B.dimensionOf(sp.biomes, filter);
  const cat = sp.category || e.category;
  const pop = POP[cat] || 'animal';
  const water = ['water', 'whale'].includes(kind) || (kind === 'semi' && /WATER/.test(cat));
  const hostile = pop === 'monster' || s.temper === 'hostile';
  const j = sp.weight;
  let weight = o.weight;
  if (weight === undefined) {
    if (hostile) weight = dim === 'overworld' || dim === 'cave' ? Math.max(3, Math.min(40, Math.round(j * 0.8))) : Math.max(4, Math.min(50, j));
    else weight = water ? Math.min(10, tier(j)) : tier(j);
  }
  const herd = o.herd || [Math.max(1, sp.min || 1), Math.max(1, sp.max || 1)];
  const cond = {};
  if (water) {
    cond['minecraft:spawns_underwater'] = {};
    cond['minecraft:height_filter'] = o.height ? { min: o.height[0], max: o.height[1] } : /DEEP_SEA/i.test(sp.set) || e.id === 'giant_squid' ? { min: -20, max: 45 } : { min: 30, max: 64 };
    cond['minecraft:distance_filter'] = { min: 12, max: 32 };
  } else if (dim === 'cave') {
    cond['minecraft:spawns_underground'] = {};
    cond['minecraft:height_filter'] = o.height ? { min: o.height[0], max: o.height[1] } : { min: -60, max: 45 };
    cond['minecraft:brightness_filter'] = { min: 0, max: 7, adjust_for_weather: false };
  } else if (kind === 'lava' || kind === 'lavawalker') {
    cond['minecraft:spawns_lava'] = {};
    cond['minecraft:distance_filter'] = { min: 12, max: 64 };
  } else {
    cond['minecraft:spawns_on_surface'] = {};
    cond['minecraft:spawns_on_block_filter'] = o.blocks || (dim === 'nether' ? NETHER_GROUND : dim === 'end' ? END_GROUND : GROUND);
    if (dim === 'overworld') {
      const light = o.light || (hostile ? 'dark' : s.nocturnal ? 'any' : 'day');
      if (light === 'dark') cond['minecraft:brightness_filter'] = { min: 0, max: 7, adjust_for_weather: true };
      else if (light === 'day') cond['minecraft:brightness_filter'] = { min: 7, max: 15, adjust_for_weather: false };
    }
    if (o.height) cond['minecraft:height_filter'] = { min: o.height[0], max: o.height[1] };
  }
  if (hostile && (dim === 'overworld' || dim === 'cave')) cond['minecraft:difficulty_filter'] = { min: 'easy', max: 'hard' };
  cond['minecraft:weight'] = { default: Math.max(1, Math.min(100, Math.round(weight))) };
  cond['minecraft:herd'] = Object.assign({ min_size: herd[0], max_size: herd[1] }, breedable && herd[1] >= 3 ? { event: 'minecraft:entity_born', event_skip_count: herd[1] - 1 } : {});
  cond['minecraft:density_limit'] = water ? { underwater: Math.max(3, herd[1] * 2) } : { surface: Math.max(3, herd[1] * 2) };
  cond['minecraft:biome_filter'] = filter;
  U.writeJson(path.join(C.BP, 'spawn_rules', NS, `${e.id}.json`), {
    format_version: '1.8.0',
    'minecraft:spawn_rules': { description: { identifier: `${NS}:${e.id}`, population_control: pop }, conditions: [cond] },
  });
  ctx.spawns.push(`${e.id}: ${pop} w${cond['minecraft:weight'].default} herd ${herd[0]}-${herd[1]} ${dim}`);
}

module.exports = { spawnRule, GROUND };
