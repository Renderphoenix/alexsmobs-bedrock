// Cross-checks the generated add-on: JSON parses, every referenced geometry/texture/animation/
// controller/render controller/sound/item/loot table exists, Molang parentheses balance.
//   node tools/converter/validate.js
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');

const errors = [], warns = [];
const walk = (d, out = []) => { if (!fs.existsSync(d)) return out; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const rel = p => path.relative(C.ROOT, p).replace(/\\/g, '/');
const json = {};
for (const f of [...walk(C.BP), ...walk(C.RP)].filter(f => f.endsWith('.json'))) {
  try { json[f] = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { errors.push(`bad JSON ${rel(f)}: ${e.message}`); }
}
const of = (dir) => Object.entries(json).filter(([f]) => f.startsWith(dir));

// registries
const geos = new Set(), anims = new Set(), ctrls = new Set(), rcs = new Set(), entities = new Set(), items = new Set(), blocks = new Set();
for (const [, j] of of(path.join(C.RP, 'models'))) for (const g of j['minecraft:geometry'] || []) geos.add(g.description.identifier);
for (const [, j] of of(path.join(C.RP, 'animations'))) Object.keys(j.animations || {}).forEach(k => anims.add(k));
for (const [, j] of of(path.join(C.RP, 'animation_controllers'))) Object.keys(j.animation_controllers || {}).forEach(k => ctrls.add(k));
for (const [, j] of of(path.join(C.RP, 'render_controllers'))) Object.keys(j.render_controllers || {}).forEach(k => rcs.add(k));
for (const [, j] of of(path.join(C.BP, 'entities'))) entities.add(j['minecraft:entity'].description.identifier);
for (const [, j] of of(path.join(C.BP, 'items'))) items.add(j['minecraft:item'].description.identifier);
for (const [, j] of of(path.join(C.BP, 'blocks'))) blocks.add(j['minecraft:block'].description.identifier);
const VANILLA_RC = new Set(['controller.render.armor', 'controller.render.default', 'controller.render.item_sprite']);
const VANILLA_ANIM = new Set(['animation.actor.billboard']);
const texExists = t => fs.existsSync(path.join(C.RP, t + '.png')) || fs.existsSync(path.join(C.RP, t + '.tga')) || /^textures\/(misc|blocks|items)\//.test(t);

function molang(s, where) {
  if (typeof s !== 'string') return;
  let d = 0;
  for (const ch of s) { if (ch === '(') d++; else if (ch === ')') d--; if (d < 0) break; }
  if (d !== 0) errors.push(`unbalanced Molang in ${where}: ${s.slice(0, 80)}`);
  if (/\bundefined\b|NaN|\[object/.test(s)) errors.push(`bad token in Molang ${where}: ${s.slice(0, 80)}`);
}

// client entities + attachables
for (const [f, j] of [...of(path.join(C.RP, 'entity')), ...of(path.join(C.RP, 'attachables'))]) {
  const d = (j['minecraft:client_entity'] || j['minecraft:attachable']).description;
  for (const g of Object.values(d.geometry || {})) if (!geos.has(g) && !/^geometry\.(player|humanoid|item_sprite)/.test(g)) errors.push(`${rel(f)}: missing geometry ${g}`);
  for (const t of Object.values(d.textures || {})) if (!texExists(t)) errors.push(`${rel(f)}: missing texture ${t}`);
  for (const [k, a] of Object.entries(d.animations || {})) if (!anims.has(a) && !ctrls.has(a) && !VANILLA_ANIM.has(a)) errors.push(`${rel(f)}: missing animation ${k} -> ${a}`);
  for (const r of d.render_controllers || []) { const id = typeof r === 'string' ? r : Object.keys(r)[0]; if (!rcs.has(id) && !VANILLA_RC.has(id)) errors.push(`${rel(f)}: missing render controller ${id}`); }
  const sc = d.scripts || {};
  for (const s of [].concat(sc.pre_animation || [])) molang(s, rel(f));
  for (const a of sc.animate || []) { const k = typeof a === 'string' ? a : Object.keys(a)[0]; if (!(d.animations || {})[k]) errors.push(`${rel(f)}: animate ${k} not in animations`); if (typeof a === 'object') molang(Object.values(a)[0], rel(f)); }
  if (j['minecraft:client_entity'] && !entities.has(d.identifier)) errors.push(`${rel(f)}: no BP entity for ${d.identifier}`);
}
// animations: molang + bones exist (warn)
const ANIM_KEYS = new Set(['loop', 'animation_length', 'bones', 'anim_time_update', 'blend_weight', 'override_previous_animation', 'start_delay', 'loop_delay', 'sound_effects', 'particle_effects', 'timeline']);
for (const [f, j] of of(path.join(C.RP, 'animations'))) for (const [n, a] of Object.entries(j.animations || {})) {
  for (const k of Object.keys(a)) if (!ANIM_KEYS.has(k)) errors.push(`${n}: '${k}' is not a valid animation key`);
  if (a.loop !== undefined && ![true, false, 'hold_on_last_frame'].includes(a.loop)) errors.push(`${n}: bad loop value ${a.loop}`);
  for (const [b, ch] of Object.entries(a.bones || {})) for (const v of Object.values(ch)) {
    const vals = Array.isArray(v) ? v : typeof v === 'object' ? Object.values(v).flat() : [v];
    vals.forEach(x => molang(x, `${n}/${b}`));
  }
}
for (const [f, j] of of(path.join(C.RP, 'animation_controllers'))) for (const [n, c] of Object.entries(j.animation_controllers || {})) {
  for (const [sn, st] of Object.entries(c.states)) {
    for (const t of st.transitions || []) { const [to, cond] = Object.entries(t)[0]; if (!c.states[to]) errors.push(`${n}: transition to missing state ${to}`); molang(cond, `${n}.${sn}`); }
    (st.on_entry || []).forEach(x => molang(x, `${n}.${sn}`));
  }
}
// BP entities
const lootOk = t => fs.existsSync(path.join(C.BP, t));
const known = id => !id.startsWith(C.NS + ':') || items.has(id) || blocks.has(id) || /_spawn_egg$/.test(id);
for (const [f, j] of of(path.join(C.BP, 'entities'))) {
  const e = j['minecraft:entity'];
  const all = [e.components, ...Object.values(e.component_groups || {})];
  for (const c of all) {
    if (c['minecraft:loot'] && !lootOk(c['minecraft:loot'].table)) errors.push(`${rel(f)}: missing loot ${c['minecraft:loot'].table}`);
    for (const k of ['minecraft:behavior.tempt', 'minecraft:breedable', 'minecraft:ageable', 'minecraft:tameable']) {
      const list = c[k] && (c[k].items || c[k].breed_items || c[k].feed_items || c[k].tame_items);
      for (const it of list || []) if (!known(typeof it === 'string' ? it : it.item)) errors.push(`${rel(f)}: ${k} unknown item ${it}`);
    }
  }
  const groups = new Set(Object.keys(e.component_groups || {}));
  const checkEv = (ev, name) => {
    if (!ev || typeof ev !== 'object') return;
    for (const k of ['add', 'remove']) for (const g of (ev[k] && ev[k].component_groups) || []) if (!groups.has(g)) errors.push(`${rel(f)}: event ${name} uses missing group ${g}`);
    for (const s of ev.sequence || []) checkEv(s, name);
    for (const s of ev.randomize || []) checkEv(s, name);
  };
  for (const [n, ev] of Object.entries(e.events || {})) checkEv(ev, n);
}
// loot tables -> items
for (const [f, j] of of(path.join(C.BP, 'loot_tables'))) for (const p of j.pools || []) for (const en of p.entries || []) if (en.name && !known(en.name)) errors.push(`${rel(f)}: unknown loot item ${en.name}`);
// spawn rules
for (const [f, j] of of(path.join(C.BP, 'spawn_rules'))) { const id = j['minecraft:spawn_rules'].description.identifier; if (!entities.has(id)) errors.push(`${rel(f)}: spawn rule for unknown ${id}`); }
// items / blocks textures
const itemTex = (json[path.join(C.RP, 'textures', 'item_texture.json')] || {}).texture_data || {};
for (const [k, v] of Object.entries(itemTex)) if (!texExists(v.textures)) errors.push(`item_texture ${k}: missing ${v.textures}`);
for (const [f, j] of of(path.join(C.BP, 'items'))) { const ic = j['minecraft:item'].components['minecraft:icon']; const k = ic && ic.textures && ic.textures.default; if (!itemTex[k]) errors.push(`${rel(f)}: icon ${k} not in item_texture.json`); }
const terr = (json[path.join(C.RP, 'textures', 'terrain_texture.json')] || {}).texture_data || {};
for (const [k, v] of Object.entries(terr)) if (!texExists(v.textures)) warns.push(`terrain ${k}: missing ${v.textures}`);
for (const [f, j] of of(path.join(C.BP, 'blocks'))) for (const m of Object.values(j['minecraft:block'].components['minecraft:material_instances'] || {})) if (!terr[m.texture]) errors.push(`${rel(f)}: material texture ${m.texture} not in terrain_texture.json`);
// sounds
const sd = (json[path.join(C.RP, 'sounds', 'sound_definitions.json')] || {}).sound_definitions || {};
for (const [k, v] of Object.entries(sd)) for (const s of v.sounds) if (!fs.existsSync(path.join(C.RP, s.name + '.ogg'))) errors.push(`sound ${k}: missing ${s.name}.ogg`);
const es = ((json[path.join(C.RP, 'sounds.json')] || {}).entity_sounds || {}).entities || {};
for (const [e, v] of Object.entries(es)) for (const s of Object.values(v.events)) if (!sd[s]) errors.push(`sounds.json ${e}: unknown sound ${s}`);

require('./validate_deep')({ errors, warns, json, of, rel, C });

console.log(`entities ${entities.size}, items ${items.size}, blocks ${blocks.size}, geometries ${geos.size}, animations ${anims.size}, controllers ${ctrls.size}`);
for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
console.log(errors.length ? `${errors.length} errors` : 'OK - no errors');
process.exitCode = errors.length ? 1 : 0;
