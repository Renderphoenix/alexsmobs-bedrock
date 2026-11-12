// Java recipes -> Bedrock recipes (BP/recipes/alexsmobs). Shaped, shapeless, furnace/smoker/campfire (merged into one
// recipe like vanilla's furnace_beef). Tags are mapped to Bedrock items/tags; a recipe whose ingredients cannot be
// expressed (custom Java recipe types, NBT) is skipped and reported.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');
const U = require('./util');

const NS = C.NS;
const EXTRA_VANILLA = new Set(['minecraft:nether_star', 'minecraft:cod', 'minecraft:tropical_fish', 'minecraft:salmon', 'minecraft:pufferfish']);
const DIR = path.join(C.DATA, 'recipes');
const VANILLA = new Set(require('./vanilla_items.json'));

// Java item ids that differ in Bedrock
const ITEM_FIX = {
  'minecraft:nether_brick': 'minecraft:netherbrick', 'minecraft:lily_pad': 'minecraft:waterlily', 'minecraft:grass': 'minecraft:short_grass',
  'minecraft:turtle_helmet': 'minecraft:turtle_helmet', 'minecraft:crossbow': 'minecraft:crossbow', 'minecraft:lead': 'minecraft:lead',
};
// Java tags -> a single Bedrock item or tag
const TAG_FIX = {
  'forge:rods/wooden': { item: 'minecraft:stick' }, 'forge:string': { item: 'minecraft:string' }, 'forge:glass': { item: 'minecraft:glass' },
  'forge:ingots/iron': { item: 'minecraft:iron_ingot' }, 'forge:ingots/netherite': { item: 'minecraft:netherite_ingot' },
  'forge:nuggets/iron': { item: 'minecraft:iron_nugget' }, 'forge:dyes/green': { item: 'minecraft:green_dye' },
  'minecraft:planks': { tag: 'minecraft:planks' }, 'minecraft:sand': { item: 'minecraft:sand' },
};

function ing(x, ctx) {
  if (Array.isArray(x)) x = x[0];
  if (!x) return null;
  if (x.item) {
    const id = ITEM_FIX[x.item] || x.item;
    ctx.items.add(id);
    return { item: id };
  }
  if (x.tag) {
    if (TAG_FIX[x.tag]) { const t = TAG_FIX[x.tag]; if (t.item) ctx.items.add(t.item); return t; }
    return { tagList: U.itemTag(x.tag), tag: x.tag };
  }
  return null;
}

function generateRecipes(ctx, madeIds) {
  const out = path.join(C.BP, 'recipes', NS);
  fs.mkdirSync(out, { recursive: true });
  const known = new Set(madeIds);
  const skipped = [];
  const used = { items: new Set() };
  const furnace = new Map(); // input -> { output, tags, xp }
  let count = 0;
  const write = (name, body) => { U.writeJson(path.join(out, name + '.json'), body); count++; };
  const idOk = id => id.startsWith(NS + ':') ? known.has(id) : VANILLA.has(id) || EXTRA_VANILLA.has(id);

  for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json'))) {
    const name = f.replace('.json', '');
    const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const type = j.type.replace('minecraft:', '');
    const resItem = r => { const id = typeof r === 'string' ? r : r.item; return ITEM_FIX[id] || id; };
    try {
      if (type === 'crafting_shaped' || type === 'crafting_shapeless') {
        const result = { item: resItem(j.result), count: (j.result && j.result.count) || 1 };
        if (!idOk(result.item)) { skipped.push(`${name}: result ${result.item} is not an item here`); continue; }
        let variants = [{}];
        const keyMap = {};
        const entries = type === 'crafting_shaped' ? Object.entries(j.key) : (j.ingredients || []).map((x, i) => [String(i), x]);
        for (const [k, v] of entries) {
          const m = ing(v, used);
          if (!m) throw new Error('ingredient ' + k);
          if (m.tagList) {
            if (!m.tagList.length || m.tagList.length > 20) throw new Error('tag ' + m.tag + ' has ' + m.tagList.length + ' items');
            variants = variants.flatMap(o => m.tagList.map(it => Object.assign({}, o, { [k]: { item: it } })));
          } else variants.forEach(o => (o[k] = m));
        }
        const bad = variants.flatMap(o => Object.values(o)).find(x => x.item && !idOk(x.item));
        if (bad) throw new Error('unknown item ' + bad.item);
        variants.forEach((o, vi) => {
          const nm = variants.length > 1 ? `${name}_${vi}` : name;
          const first = Object.values(o).find(x => x.item);
          const unlock = first ? [{ item: first.item }] : [];
          if (type === 'crafting_shaped') write(nm, { format_version: '1.20.10', 'minecraft:recipe_shaped': { description: { identifier: `${NS}:${nm}` }, tags: ['crafting_table'], pattern: j.pattern, key: o, unlock, result } });
          else write(nm, { format_version: '1.20.10', 'minecraft:recipe_shapeless': { description: { identifier: `${NS}:${nm}` }, tags: ['crafting_table'], ingredients: Object.values(o), unlock, result } });
        });
      } else if (type === 'smelting' || type === 'smoking' || type === 'campfire_cooking') {
        const input = ing(j.ingredient, used).item;
        const output = resItem(j.result);
        if (!idOk(input) || !idOk(output)) throw new Error('unknown item');
        const key = input + '>' + output;
        const e = furnace.get(key) || { input, output, tags: [] };
        e.tags.push(type === 'smelting' ? 'furnace' : type === 'smoking' ? 'smoker' : 'campfire');
        if (type === 'campfire_cooking') e.tags.push('soul_campfire');
        furnace.set(key, e);
      } else skipped.push(`${name}: Java recipe type ${j.type} has no Bedrock equivalent`);
    } catch (err) { skipped.push(`${name}: ${err.message}`); }
  }
  for (const e of furnace.values()) {
    const name = 'furnace_' + e.output.split(':')[1];
    write(name, { format_version: '1.20.10', 'minecraft:recipe_furnace': { description: { identifier: `${NS}:${name}` }, unlock: [{ item: e.input }], tags: [...new Set(e.tags)], input: e.input, output: e.output, priority: 30 } });
  }
  return { count, skipped };
}

module.exports = { generateRecipes };
