// Our own drops for creatures that have no loot table in the Java mod (they would drop nothing in Bedrock).
// Entry: [item, min, max, chance?]  - chance (0-1) makes it a separate rare pool boosted by looting.
// Raw meat cooks when the mob dies on fire (furnace_smelt), like vanilla.
'use strict';

const COOKS = new Set(['minecraft:beef', 'minecraft:porkchop', 'minecraft:chicken', 'minecraft:mutton', 'minecraft:rabbit', 'minecraft:cod', 'minecraft:salmon']);
const L = 'minecraft:leather', BONE = 'minecraft:bone', FEATHER = 'minecraft:feather', BEEF = 'minecraft:beef', COD = 'minecraft:cod';

const DROPS = {
  alligator_snapping_turtle: [['alexsmobs:spiked_scute', 1, 2], [BONE, 0, 1]],
  anaconda: [['alexsmobs:shed_snake_skin', 0, 2], [L, 0, 1]],
  anteater: [[L, 0, 2], [BONE, 0, 1]],
  cachalot_whale: [['alexsmobs:cachalot_whale_tooth', 1, 4], [BONE, 2, 5], ['alexsmobs:ambergris', 1, 1, 0.12]],
  caiman: [[L, 0, 1], [BONE, 0, 1], ['alexsmobs:crocodile_scute', 1, 1, 0.25]],
  capuchin_monkey: [[L, 0, 1], [BONE, 0, 1]],
  devils_hole_pupfish: [['alexsmobs:fish_bones', 0, 1]],
  elephant: [[L, 1, 3], [BEEF, 2, 4], [BONE, 1, 3]],
  endergrade: [['minecraft:chorus_fruit', 0, 2]],
  frilled_shark: [['alexsmobs:serrated_shark_tooth', 0, 2], [COD, 1, 2]],
  gelada_monkey: [[L, 0, 1], [BONE, 0, 1]],
  gorilla: [[L, 1, 2], [BEEF, 1, 2], [BONE, 0, 2]],
  hammerhead_shark: [['alexsmobs:shark_tooth', 1, 3], [COD, 1, 2]],
  hummingbird: [[FEATHER, 0, 1]],
  jerboa: [['minecraft:rabbit_hide', 0, 1], ['minecraft:rabbit_foot', 1, 1, 0.04]],
  komodo_dragon: [[L, 0, 2], ['minecraft:rotten_flesh', 1, 2], [BONE, 0, 2]],
  leafcutter_ant: [['minecraft:string', 0, 1]],
  maned_wolf: [[L, 0, 1], [BONE, 0, 2]],
  mantis_shrimp: [['alexsmobs:lobster_tail', 0, 2], ['minecraft:prismarine_shard', 0, 1]],
  mungus: [['alexsmobs:mungal_spores', 0, 2]],
  orca: [[COD, 2, 4], [BONE, 2, 4]],
  platypus: [[L, 0, 1], [FEATHER, 0, 1]],
  rain_frog: [['minecraft:slime_ball', 0, 1]],
  rhinoceros: [[L, 1, 3], [BEEF, 1, 3], [BONE, 0, 2]],
  seal: [[L, 1, 2], [COD, 0, 1]],
  sea_bear: [[BONE, 2, 4], [L, 1, 2], ['minecraft:prismarine_crystals', 0, 2]],
  skunk: [[L, 0, 1], ['minecraft:fermented_spider_eye', 1, 1, 0.06]],
  snow_leopard: [[L, 0, 2], [BONE, 0, 1]],
  spectre: [['minecraft:phantom_membrane', 0, 2]],
  stradpole: [['minecraft:magma_cream', 0, 1]],
  sugar_glider: [['minecraft:sugar', 0, 1], [FEATHER, 0, 1]],
  sunbird: [[FEATHER, 1, 2], ['minecraft:blaze_powder', 0, 1], ['minecraft:glowstone_dust', 0, 1]],
  tasmanian_devil: [[L, 0, 1], [BONE, 0, 1]],
  terrapin: [['alexsmobs:spiked_scute', 1, 1, 0.2], [BONE, 0, 1]],
  tiger: [[L, 1, 2], [BONE, 0, 2], [BEEF, 1, 2]],
  triops: [['alexsmobs:fish_bones', 0, 1]],
  underminer: [['minecraft:coal', 0, 1], ['minecraft:iron_nugget', 0, 2]],
};

function own(id) {
  const list = DROPS[id];
  if (!list) return null;
  const pools = list.map(([item, min, max, chance]) => {
    const functions = [{ function: 'set_count', count: { min, max } }];
    if (COOKS.has(item)) functions.push({ function: 'furnace_smelt', conditions: [{ condition: 'entity_properties', entity: 'this', properties: { on_fire: true } }] });
    functions.push({ function: 'looting_enchant', count: { min: 0, max: 1 } });
    const pool = { rolls: 1, entries: [{ type: 'item', name: item, weight: 1, functions }] };
    if (chance) {
      pool.conditions = [{ condition: 'killed_by_player' }, { condition: 'random_chance_with_looting', chance, looting_multiplier: 0.02 }];
      pool.entries[0].functions = [{ function: 'set_count', count: { min, max } }];
    }
    return pool;
  });
  return { pools };
}

module.exports = { own, DROPS };
