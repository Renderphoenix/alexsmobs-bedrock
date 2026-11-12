'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let s = JSON.stringify(obj, null, 2);
  // keep short numeric arrays on one line
  s = s.replace(/\[\s+(-?[\d.e-]+(?:,\s+-?[\d.e-]+){1,3})\s+\]/g, (m, a) => '[' + a.split(/,\s+/).join(', ') + ']');
  fs.writeFileSync(file, s + '\n');
}
function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
const jarTex = rel => path.join(C.ASSETS, 'textures', rel + '.png');
const hasTex = rel => fs.existsSync(jarTex(rel));
const title = id => id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

// --- item / entity tags from the jar (data/<ns>/tags/...)
const RENAME = {
  'minecraft:lily_pad': 'minecraft:waterlily', 'minecraft:melon_slice': 'minecraft:melon_slice', 'minecraft:grass': 'minecraft:short_grass',
  'minecraft:turtle_scute': 'minecraft:turtle_scute', 'minecraft:cooked_porkchop': 'minecraft:cooked_porkchop', 'minecraft:porkchop': 'minecraft:porkchop',
  'minecraft:mushroom_stew': 'minecraft:mushroom_stew', 'minecraft:glistering_melon_slice': 'minecraft:glistering_melon_slice',
  'minecraft:zombie_villager': 'minecraft:zombie_villager_v2', 'minecraft:villager': 'minecraft:villager_v2', 'minecraft:snow_golem': 'minecraft:snow_golem',
  'minecraft:mooshroom': 'minecraft:mooshroom', 'minecraft:dead_bush': 'minecraft:deadbush', 'minecraft:nether_brick': 'minecraft:netherbrick',
};
const VANILLA_ITEM_TAGS = {
  'minecraft:fishes': ['minecraft:cod', 'minecraft:salmon', 'minecraft:tropical_fish', 'minecraft:pufferfish', 'minecraft:cooked_cod', 'minecraft:cooked_salmon'],
  'minecraft:flowers': ['minecraft:dandelion', 'minecraft:poppy', 'minecraft:blue_orchid', 'minecraft:allium', 'minecraft:azure_bluet', 'minecraft:red_tulip', 'minecraft:orange_tulip', 'minecraft:white_tulip', 'minecraft:pink_tulip', 'minecraft:oxeye_daisy', 'minecraft:cornflower', 'minecraft:lily_of_the_valley', 'minecraft:sunflower', 'minecraft:lilac', 'minecraft:rose_bush', 'minecraft:peony'],
  'minecraft:small_flowers': ['minecraft:dandelion', 'minecraft:poppy', 'minecraft:blue_orchid', 'minecraft:allium', 'minecraft:azure_bluet', 'minecraft:red_tulip', 'minecraft:orange_tulip', 'minecraft:white_tulip', 'minecraft:pink_tulip', 'minecraft:oxeye_daisy', 'minecraft:cornflower', 'minecraft:lily_of_the_valley'],
  'minecraft:leaves': ['minecraft:oak_leaves', 'minecraft:spruce_leaves', 'minecraft:birch_leaves', 'minecraft:jungle_leaves', 'minecraft:acacia_leaves', 'minecraft:dark_oak_leaves', 'minecraft:mangrove_leaves', 'minecraft:cherry_leaves', 'minecraft:azalea_leaves'],
  'minecraft:saplings': ['minecraft:oak_sapling', 'minecraft:spruce_sapling', 'minecraft:birch_sapling', 'minecraft:jungle_sapling', 'minecraft:acacia_sapling', 'minecraft:dark_oak_sapling', 'minecraft:cherry_sapling'],
  'minecraft:wool': ['minecraft:white_wool'],
  'forge:seeds': ['minecraft:wheat_seeds', 'minecraft:pumpkin_seeds', 'minecraft:melon_seeds', 'minecraft:beetroot_seeds'],
  'forge:crops/wheat': ['minecraft:wheat'], 'forge:crops': ['minecraft:wheat', 'minecraft:carrot', 'minecraft:potato', 'minecraft:beetroot'],
  'forge:mushrooms': ['minecraft:red_mushroom', 'minecraft:brown_mushroom'], 'forge:eggs': ['minecraft:egg'],
  'forge:rods/blaze': ['minecraft:blaze_rod'], 'forge:raw_fishes': ['minecraft:cod', 'minecraft:salmon', 'minecraft:tropical_fish'],
  'forge:fruits': ['minecraft:apple', 'minecraft:sweet_berries', 'minecraft:glow_berries', 'minecraft:melon_slice'], 'forge:fruits/banana': ['alexsmobs:banana'],
  'forge:vegetables': ['minecraft:carrot', 'minecraft:potato', 'minecraft:beetroot'],
};
function readTag(kind, ref, seen = new Set()) {
  ref = ref.replace(/^#/, '');
  if (seen.has(ref)) return [];
  seen.add(ref);
  const [ns, p] = ref.includes(':') ? ref.split(':') : ['minecraft', ref];
  const f = path.join(C.JAR_DIR, 'data', ns, 'tags', kind, p + '.json');
  let vals = [];
  if (fs.existsSync(f)) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (let v of j.values || []) {
      if (typeof v === 'object') v = v.id;
      if (v.startsWith('#')) vals.push(...readTag(kind, v, seen));
      else vals.push(v);
    }
  }
  if (kind === 'items' && VANILLA_ITEM_TAGS[ref]) vals.push(...VANILLA_ITEM_TAGS[ref]);
  return [...new Set(vals.map(v => RENAME[v] || v))].filter(v => /^(minecraft|alexsmobs):/.test(v));
}
const itemTag = name => readTag('items', name.includes(':') ? name : 'alexsmobs:' + name);
const entityTag = name => readTag('entity_types', name.includes(':') ? name : 'alexsmobs:' + name);

module.exports = { writeJson, copy, jarTex, hasTex, title, itemTag, entityTag, RENAME };
