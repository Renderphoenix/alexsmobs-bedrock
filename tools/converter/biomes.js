// Java biome tags / registry names (Alex's Mobs DefaultBiomes) -> Bedrock biome filters.
// Bedrock tags are checked against Mojang's bedrock-samples biome files (biome_tags.json).
'use strict';
const VANILLA = require('./biome_tags.json');
const VALID = new Set(Object.values(VANILLA).flat());

// each value: list of alternatives (any_of); an alternative may be 'a+b' (all of)
const TAGS = {
  'minecraft:is_overworld': ['overworld', 'overworld_generation'],
  'minecraft:is_forest': ['forest', 'flower_forest', 'roofed', 'birch'],
  'minecraft:is_taiga': ['taiga'],
  'minecraft:is_jungle': ['jungle'],
  'minecraft:is_savanna': ['savanna'],
  'minecraft:is_badlands': ['mesa'],
  'minecraft:is_beach': ['beach'],
  'minecraft:is_ocean': ['ocean'],
  'minecraft:is_deep_ocean': ['ocean+deep'],
  'minecraft:is_river': ['river'],
  'minecraft:is_mountain': ['mountains', 'mountain', 'extreme_hills'],
  'minecraft:is_hill': ['hills', 'extreme_hills'],
  'minecraft:is_nether': ['nether'],
  'minecraft:is_end': ['the_end'],
  'minecraft:has_structure/mineshaft': ['overworld'],
  'forge:is_dry': ['desert', 'mesa', 'savanna'],
  'forge:is_dry/overworld': ['desert', 'mesa', 'savanna'],
  'forge:is_hot': ['desert', 'mesa', 'savanna', 'jungle', 'warm'],
  'forge:is_hot/overworld': ['desert', 'mesa', 'savanna', 'jungle'],
  'forge:is_sandy': ['desert', 'mesa', 'beach'],
  'forge:is_desert': ['desert'],
  'forge:is_snowy': ['frozen', 'ice_plains', 'snowy_slopes'],
  'forge:is_cold': ['cold', 'frozen'],
  'forge:is_cold/overworld': ['cold', 'frozen'],
  'forge:is_swamp': ['swamp', 'mangrove_swamp'],
  'forge:is_plains': ['plains'],
  'forge:is_wet': ['swamp', 'mangrove_swamp', 'jungle', 'river'],
  'forge:is_wet/overworld': ['swamp', 'mangrove_swamp', 'jungle', 'river'],
  'forge:is_dense': ['jungle', 'roofed'],
  'forge:is_dense/overworld': ['jungle', 'roofed'],
  'forge:is_sparse': ['savanna', 'plains', 'desert'],
  'forge:is_sparse/overworld': ['savanna', 'plains', 'desert'],
  'forge:is_lush': ['lush_caves'],
  'forge:is_mountain': ['mountains', 'mountain', 'extreme_hills'],
  'forge:is_peak': ['frozen_peaks', 'jagged_peaks'],
  'forge:is_slope': ['snowy_slopes', 'grove'],
  'forge:is_spooky': ['roofed'],
  'forge:is_cave': ['caves'],
  'forge:is_underground': ['caves'],
  'forge:is_void': ['the_end'],
  'forge:is_mushroom': ['mooshroom_island'],
  'forge:is_rare': ['rare'],
  'forge:is_water': ['ocean', 'river'],
  'forge:is_beach': ['beach'],
  'forge:is_plateau': ['plateau'],
  'forge:no_default_monsters': ['mooshroom_island'],
  'alexsmobs:skreechers_can_spawn_wardens': ['deep_dark'],
};
const NAMES = {
  'minecraft:mangrove_swamp': ['mangrove_swamp'], 'minecraft:bamboo_jungle': ['bamboo'], 'minecraft:sparse_jungle': ['jungle+edge'],
  'minecraft:cherry_grove': ['cherry_grove'], 'minecraft:meadow': ['meadow'], 'minecraft:dripstone_caves': ['dripstone_caves'],
  'minecraft:lush_caves': ['lush_caves'], 'minecraft:deep_dark': ['deep_dark'], 'minecraft:crimson_forest': ['crimson_forest'],
  'minecraft:warped_forest': ['warped_forest'], 'minecraft:soul_sand_valley': ['soulsand_valley'], 'minecraft:basalt_deltas': ['basalt_deltas'],
  'minecraft:nether_wastes': ['nether_wastes'], 'minecraft:the_end': ['the_end'], 'minecraft:end_highlands': ['the_end'],
  'minecraft:end_midlands': ['the_end'], 'minecraft:small_end_islands': ['the_end'], 'minecraft:end_barrens': ['the_end'],
  'minecraft:snowy_slopes': ['snowy_slopes'], 'minecraft:jagged_peaks': ['jagged_peaks'], 'minecraft:frozen_peaks': ['frozen_peaks'],
  'minecraft:grove': ['grove'], 'minecraft:stony_peaks': ['mountains'], 'minecraft:windswept_hills': ['extreme_hills'],
  'minecraft:windswept_forest': ['extreme_hills+forest'], 'minecraft:windswept_gravelly_hills': ['extreme_hills+mutated'],
  'minecraft:windswept_savanna': ['savanna+mutated'], 'minecraft:old_growth_pine_taiga': ['mega+taiga'],
  'minecraft:old_growth_spruce_taiga': ['mega+taiga'], 'minecraft:desert': ['desert'], 'minecraft:badlands': ['mesa'],
  'minecraft:wooded_badlands': ['mesa+plateau'], 'minecraft:eroded_badlands': ['mesa+mutated'], 'minecraft:savanna': ['savanna'],
  'minecraft:savanna_plateau': ['savanna+plateau'], 'minecraft:river': ['river'], 'minecraft:frozen_river': ['river+frozen'],
  'minecraft:frozen_ocean': ['ocean+frozen'], 'minecraft:deep_frozen_ocean': ['ocean+frozen+deep'], 'minecraft:warm_ocean': ['ocean+warm'],
  'minecraft:lukewarm_ocean': ['ocean+lukewarm'], 'minecraft:deep_lukewarm_ocean': ['ocean+lukewarm+deep'], 'minecraft:cold_ocean': ['ocean+cold'],
  'minecraft:deep_cold_ocean': ['ocean+cold+deep'], 'minecraft:ocean': ['ocean'], 'minecraft:deep_ocean': ['ocean+deep'],
  'minecraft:mushroom_fields': ['mooshroom_island'], 'minecraft:beach': ['beach'], 'minecraft:snowy_beach': ['beach+cold'],
  'minecraft:stony_shore': ['stone'], 'minecraft:swamp': ['swamp'], 'minecraft:birch_forest': ['birch'],
  'minecraft:old_growth_birch_forest': ['birch+mutated'], 'minecraft:dark_forest': ['roofed'], 'minecraft:flower_forest': ['flower_forest'],
  'minecraft:plains': ['plains'], 'minecraft:sunflower_plains': ['plains+mutated'], 'minecraft:snowy_plains': ['ice_plains'],
  'minecraft:ice_spikes': ['ice_plains+mutated'], 'minecraft:taiga': ['taiga'], 'minecraft:snowy_taiga': ['taiga+cold'],
  'minecraft:jungle': ['jungle'], 'minecraft:forest': ['forest'], 'minecraft:pale_garden': ['pale_garden'],
};

function alternatives(entry) {
  const map = entry.type === 'BIOME_TAG' ? TAGS : NAMES;
  const alts = map[entry.value];
  if (!alts) return null;
  const ok = alts.map(a => a.split('+')).filter(parts => parts.every(t => VALID.has(t)));
  return ok.length ? ok : null;
}

const tagTest = (t, neg) => (neg ? { test: 'has_biome_tag', operator: '!=', value: t } : { test: 'has_biome_tag', value: t });

// pools: entries with same pool index are AND-ed, pools OR-ed.
function biomeFilter(entries) {
  const pools = new Map();
  for (const e of entries) {
    if (!pools.has(e.pool)) pools.set(e.pool, []);
    pools.get(e.pool).push(e);
  }
  const anyOf = [];
  for (const list of pools.values()) {
    const all = [];
    let dead = false;
    for (const e of list) {
      const alts = alternatives(e);
      if (!alts) { if (!e.negate) dead = true; continue; }
      if (e.negate) {
        // NOT(any alt) = all of (NOT alt); NOT(a&b) approximated as NOT a when single-tag
        for (const a of alts) if (a.length === 1) all.push(tagTest(a[0], true));
      } else if (alts.length === 1) {
        for (const t of alts[0]) all.push(tagTest(t));
      } else {
        all.push({ any_of: alts.map(a => (a.length === 1 ? tagTest(a[0]) : { all_of: a.map(t => tagTest(t)) })) });
      }
    }
    if (dead) continue;
    if (!all.some(x => !(x.operator === '!='))) all.unshift(tagTest('overworld'));
    // the generic overworld test is implied by every specific tag except in all-overworld pools
    const isOw = x => x.any_of && JSON.stringify(x).includes('"overworld"') && JSON.stringify(x).includes('overworld_generation');
    const otherPositive = all.some(x => !isOw(x) && x.operator !== '!=');
    const filtered = otherPositive ? all.filter(x => !isOw(x)) : all;
    anyOf.push(filtered.length === 1 ? filtered[0] : { all_of: filtered });
  }
  // dedupe
  const seen = new Set();
  const uniq = anyOf.filter(f => { const k = JSON.stringify(f); if (seen.has(k)) return false; seen.add(k); return true; });
  if (!uniq.length) return null;
  return uniq.length === 1 ? uniq[0] : { any_of: uniq };
}

const NETHER = new Set(['nether', 'crimson_forest', 'warped_forest', 'soulsand_valley', 'basalt_deltas', 'nether_wastes', 'netherwart_forest']);
const CAVE = new Set(['caves', 'lush_caves', 'dripstone_caves', 'deep_dark']);
function dimensionOf(entries, filter) {
  const tags = [];
  JSON.stringify(filter || {}, (k, v) => { if (v && v.test === 'has_biome_tag' && v.operator !== '!=') tags.push(v.value); return v; });
  if (tags.some(t => NETHER.has(t))) return 'nether';
  if (tags.includes('the_end')) return 'end';
  const javaCave = entries.some(e => !e.negate && /cave/.test(e.value));
  if (tags.length && tags.every(t => CAVE.has(t) || /^overworld/.test(t)) && (tags.some(t => CAVE.has(t)) || javaCave)) return 'cave';
  return 'overworld';
}

module.exports = { biomeFilter, dimensionOf, VALID };
