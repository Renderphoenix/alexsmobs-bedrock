// Builds tools/converter/vanilla_schema.json from Mojang's bedrock-samples: every component / filter test / damage
// cause / event action / Molang query / loot function / item+block component that vanilla files use. validate.js
// flags anything we emit that vanilla never uses (the game rejects unknown ones and drops the whole entity/file).
//   node tools/converter/schema_scan.js [path-to-bedrock-samples]
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');

const SAMPLES = process.argv[2] || process.env.BEDROCK_SAMPLES || path.resolve(C.ROOT, '..', 'bedrock-samples-v1.26.50.4-full');
const walk = (d, out = []) => { if (!fs.existsSync(d)) return out; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/(^|[^:"\\])\/\/[^\n"]*$/gm, '$1')); } catch { return null; } };
const S = () => new Set();
const compTypes = {};
const typeOf = v => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
const out = { entityComponents: S(), itemComponents: S(), blockComponents: S(), spawnComponents: S(), filterTests: S(), damageCauses: S(), queries: S(), mathFns: S(), lootFunctions: S(), lootConditions: S(), clientKeys: S(), animKeys: S(), controllerStateKeys: S(), renderKeys: S(), eventActions: S(), filterOperators: S(), filterSubjects: S(), filterDomains: S(), materials: S(), blockTraits: S(), itemTags: S() };

const rec = (v, fn) => { if (Array.isArray(v)) v.forEach(x => rec(x, fn)); else if (v && typeof v === 'object') { fn(v); Object.values(v).forEach(x => rec(x, fn)); } };

for (const f of walk(path.join(SAMPLES, 'behavior_pack')).filter(x => x.endsWith('.json'))) {
  const j = readJson(f);
  if (!j) continue;
  const rel = path.relative(path.join(SAMPLES, 'behavior_pack'), f).replace(/\\/g, '/');
  if (j['minecraft:entity']) {
    const e = j['minecraft:entity'];
    for (const c of [e.components || {}, ...Object.values(e.component_groups || {})]) Object.keys(c).forEach(k => { out.entityComponents.add(k); (compTypes[k] = compTypes[k] || new Set()).add(typeOf(c[k])); });
    for (const ev of Object.values(e.events || {})) rec(ev, o => Object.keys(o).forEach(k => out.eventActions.add(k)));
  }
  if (j['minecraft:item']) Object.keys(j['minecraft:item'].components || {}).forEach(k => out.itemComponents.add(k));
  if (j['minecraft:block']) {
    const b = j['minecraft:block'];
    Object.keys(b.components || {}).forEach(k => out.blockComponents.add(k));
    for (const p of b.permutations || []) Object.keys(p.components || {}).forEach(k => out.blockComponents.add(k));
    Object.keys((b.description || {}).traits || {}).forEach(k => out.blockTraits.add(k));
  }
  if (j['minecraft:spawn_rules']) for (const c of j['minecraft:spawn_rules'].conditions || []) Object.keys(c).forEach(k => out.spawnComponents.add(k));
  if (rel.startsWith('loot_tables')) rec(j, o => { if (o.function) out.lootFunctions.add(o.function); if (o.condition) out.lootConditions.add(o.condition); });
  rec(j, o => {
    if (typeof o.test === 'string') { out.filterTests.add(o.test); if (o.operator) out.filterOperators.add(o.operator); if (o.subject) out.filterSubjects.add(o.subject); if (o.domain) out.filterDomains.add(o.domain); }
    if (typeof o.cause === 'string') out.damageCauses.add(o.cause);
  });
}
const queryRe = /\b(?:query|q)\.([a-z_0-9]+)/gi;
const mathRe = /\b(?:math|Math)\.([a-z_0-9]+)/gi;
const scanStrings = (v) => rec(v, o => { for (const s of Object.values(o)) if (typeof s === 'string') { for (const m of s.matchAll(queryRe)) out.queries.add(m[1].toLowerCase()); for (const m of s.matchAll(mathRe)) out.mathFns.add(m[1].toLowerCase()); } });
for (const f of walk(path.join(SAMPLES, 'resource_pack')).filter(x => x.endsWith('.json'))) {
  const j = readJson(f);
  if (!j) continue;
  scanStrings(j);
  if (j['minecraft:client_entity']) Object.keys(j['minecraft:client_entity'].description || {}).forEach(k => out.clientKeys.add(k));
  if (j['minecraft:client_entity']) Object.values((j['minecraft:client_entity'].description || {}).materials || {}).forEach(m => out.materials.add(m));
  for (const a of Object.values(j.animations || {})) if (a && typeof a === 'object') Object.keys(a).forEach(k => out.animKeys.add(k));
  for (const c of Object.values(j.animation_controllers || {})) for (const s of Object.values(c.states || {})) Object.keys(s).forEach(k => out.controllerStateKeys.add(k));
  for (const r of Object.values(j.render_controllers || {})) Object.keys(r).forEach(k => out.renderKeys.add(k));
}
// ---- documentation: parameters per component (documentation/*.html shipped with bedrock-samples)
function parseDocs(file) {
  const f = path.join(SAMPLES, 'documentation', file);
  if (!fs.existsSync(f)) return {};
  const html = fs.readFileSync(f, 'utf8');
  const out = {};
  const parts = html.split(/<h2><p id="/);
  for (const part of parts.slice(1)) {
    const name = part.slice(0, part.indexOf('"'));
    const params = [];
    for (const m of part.matchAll(/<tr>\s*<td[^>]*>([A-Za-z0-9_.:-]+)<\/td>\s*<td/g)) params.push(m[1]);
    out[name] = [...new Set(params)];
  }
  return out;
}
const docs = { entity: parseDocs('Entities.html'), item: parseDocs('Item.html'), block: parseDocs('Blocks.html') };
const arr = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
arr.docs = docs;
arr.compTypes = Object.fromEntries(Object.entries(compTypes).map(([k, v]) => [k, [...v]]));
fs.writeFileSync(path.join(__dirname, 'vanilla_schema.json'), JSON.stringify(arr));
for (const k of Object.keys(docs)) console.log('docs', k, Object.keys(docs[k]).length, 'sections');
console.log(Object.entries(arr).filter(([k]) => k !== 'docs' && k !== 'compTypes').map(([k, v]) => `${k}:${v.length}`).join(' '));
