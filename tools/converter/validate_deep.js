// Deep checks that mirror the errors the game's Content Log produced for earlier builds. Called from validate.js.
'use strict';
const fs = require('fs');
const path = require('path');

const S = require('./vanilla_schema.json');
const V = k => new Set(S[k]);

// valid in the game but not used by the vanilla samples we scanned (verified in-game / skill notes)
const EXTRA_COMPONENTS = new Set(['minecraft:behavior.owner_hurt_by_target', 'minecraft:behavior.owner_hurt_target']);
const EXTRA_CAUSES = new Set(['suffocation', 'void', 'suicide', 'wither', 'starve', 'thorns', 'flying_into_wall', 'fireworks', 'sonic_boom', 'campfire', 'soul_campfire']);
const KNOWN_QUERIES = ['is_alive', 'target_x_rotation', 'target_y_rotation', 'state_time', 'hurt_time', 'has_target', 'life_time', 'modified_move_speed', 'modified_distance_moved', 'delta_time', 'any_animation_finished', 'all_animations_finished', 'anim_time', 'ground_speed', 'is_sitting', 'is_in_water', 'is_on_ground', 'is_baby', 'variant', 'is_sneaking', 'is_angry', 'is_wall_climbing', 'position', 'body_y_rotation', 'is_sleeping'];
// parameters verified in-game (Phoenix Mobs pack on 1.26.60) that the bundled 1.26.50 docs do not list yet
const DOC_LAG = new Set(['minecraft:behavior.random_fly.y_offset', 'minecraft:behavior.random_fly.avoid_damage_blocks', 'minecraft:buoyant.simulate_waves', 'minecraft:spawn_entity.entities']);
const BUILTIN_VARS = new Set(['attack_time', 'is_first_person', 'is_paperdoll']);
const rec = (v, fn) => { if (Array.isArray(v)) v.forEach(x => rec(x, fn)); else if (v && typeof v === 'object') { fn(v); Object.values(v).forEach(x => rec(x, fn)); } };

module.exports = function deep({ errors, warns, json, of, rel, C }) {
  const comps = V('entityComponents'), tests = V('filterTests'), ops = V('filterOperators'), causes = V('damageCauses'), queries = V('queries');
  EXTRA_COMPONENTS.forEach(c => comps.add(c));
  KNOWN_QUERIES.forEach(q => queries.add(q));
  EXTRA_CAUSES.forEach(c => causes.add(c));
  const seenWarn = new Set();
  const warnOnce = m => { if (!seenWarn.has(m)) { seenWarn.add(m); warns.push(m); } };

  // ---- behavior entities: components, filters, damage causes, properties
  const props = new Map();
  for (const [f, j] of of(path.join(C.BP, 'entities'))) {
    const e = j['minecraft:entity'];
    const id = e.description.identifier;
    props.set(id, new Set(Object.keys(e.description.properties || {})));
    for (const c of [e.components || {}, ...Object.values(e.component_groups || {})]) for (const k of Object.keys(c)) if (!comps.has(k)) errors.push(`${rel(f)}: component ${k} is not used by any vanilla entity (the whole entity would fail to load if it is invalid)`);
    rec(j, o => {
      if (typeof o.test === 'string' && !tests.has(o.test)) errors.push(`${rel(f)}: filter test '${o.test}' does not exist`);
      if (typeof o.test === 'string' && o.operator && !ops.has(o.operator)) errors.push(`${rel(f)}: filter operator '${o.operator}' does not exist`);
      if (typeof o.cause === 'string' && !causes.has(o.cause)) errors.push(`${rel(f)}: damage cause '${o.cause}' does not exist`);
    });
    // parameter names against the game's own documentation ("child 'x' not valid here" fails the whole entity)
    for (const [gname, c] of [['components', e.components || {}], ...Object.entries(e.component_groups || {})]) {
      for (const [k, v] of Object.entries(c)) {
        const allowed = S.docs && S.docs.entity && S.docs.entity[k];
        if (!allowed || !allowed.length || !v || typeof v !== 'object' || Array.isArray(v)) continue;
        for (const p of Object.keys(v)) if (p !== 'priority' && !allowed.includes(p) && !DOC_LAG.has(k + '.' + p)) warnOnce(`${k} parameter '${p}' is not in the bundled game docs (docs lag the game; verify in-game): ${allowed.join(', ')}`);
      }
    }
    // value shape (object / boolean / number ...) must be one vanilla uses for that component
    for (const [gname, c] of [['components', e.components || {}], ...Object.entries(e.component_groups || {})]) {
      for (const [k, val] of Object.entries(c)) {
        const seen = S.compTypes && S.compTypes[k];
        const t = Array.isArray(val) ? 'array' : val === null ? 'null' : typeof val;
        if (seen && seen.length && !seen.includes(t)) errors.push(`${rel(f)}: ${k} is a ${t} in ${gname}, vanilla only uses ${seen.join('/')}`);
      }
    }
    const lead = e.components['minecraft:leashable'];
    if (lead && Object.keys(lead).length) errors.push(`${rel(f)}: minecraft:leashable must be {} (distance fields are rejected)`);
    // events referencing component groups / properties
    const groups = new Set(Object.keys(e.component_groups || {}));
    rec(e.events || {}, o => {
      for (const k of ['add', 'remove']) for (const g of (o[k] && o[k].component_groups) || []) if (!groups.has(g)) errors.push(`${rel(f)}: event uses missing group ${g}`);
      for (const k of Object.keys(o.set_property || {})) if (!props.get(id).has(k)) errors.push(`${rel(f)}: set_property ${k} is not declared in description.properties`);
    });
  }

  // ---- blocks / items (errors seen in the game's Content Log)
  for (const [f, j] of of(path.join(C.BP, 'blocks'))) {
    const b = j['minecraft:block'];
    const ver = String(j.format_version).split('.').map(Number);
    if (b.components['minecraft:custom_components'] && (ver[0] > 1 || ver[1] >= 21 && ver[2] >= 90)) errors.push(`${rel(f)}: minecraft:custom_components is not valid from 1.21.90 (list the component by name instead)`);
    for (const k of Object.keys(b.components)) if (k.includes(':') && !k.startsWith('minecraft:') && !(j.format_version >= '1.21.90')) errors.push(`${rel(f)}: custom component ${k} needs format_version 1.21.90 or newer`);
  }
  for (const [f, j] of of(path.join(C.BP, 'items'))) if (j['minecraft:item'].components['minecraft:record']) errors.push(`${rel(f)}: minecraft:record only accepts vanilla sound events`);
  for (const [f, j] of of(path.join(C.RP, 'entity'))) { const g = Object.keys(j['minecraft:client_entity'].description.geometry || {}); if (g.length > 1 && !/_part\.|centipede_body|void_worm_part|bone_serpent_part/.test(f)) warnOnce(`${rel(f)}: several geometries on one entity make the engine's armor locators clash`); }

  // ---- spawn rules: only vanilla spawn components, valid blocks
  const spawnOk = V('spawnComponents');
  for (const [f, j] of of(path.join(C.BP, 'spawn_rules'))) for (const c of j['minecraft:spawn_rules'].conditions) {
    for (const k of Object.keys(c)) if (!spawnOk.has(k)) errors.push(`${rel(f)}: spawn component ${k} is not used by vanilla spawn rules`);
    for (const b of (c['minecraft:spawns_on_block_filter'] || [])) if (/terracotta$/.test(b) && b !== 'minecraft:hardened_clay' && !/stained|glazed/.test(b)) errors.push(`${rel(f)}: block ${b} does not exist in Bedrock (use minecraft:hardened_clay)`);
  }

  // ---- client entities: geometry bones, variables, properties, controllers
  const geoBones = new Map();
  for (const [, j] of of(path.join(C.RP, 'models'))) for (const g of j['minecraft:geometry'] || []) geoBones.set(g.description.identifier, new Set((g.bones || []).map(b => b.name)));
  const ctrlFiles = new Map();
  for (const [f, j] of of(path.join(C.RP, 'animation_controllers'))) for (const id of Object.keys(j.animation_controllers || {})) ctrlFiles.set(id, j.animation_controllers[id]);
  const animDefs = new Map();
  for (const [f, j] of of(path.join(C.RP, 'animations'))) for (const [id, a] of Object.entries(j.animations || {})) animDefs.set(id, a);
  const rcDefs = new Map();
  for (const [f, j] of of(path.join(C.RP, 'render_controllers'))) for (const [id, r] of Object.entries(j.render_controllers || {})) rcDefs.set(id, r);

  for (const [f, j] of of(path.join(C.RP, 'entity'))) {
    const d = j['minecraft:client_entity'].description;
    const id = d.identifier;
    const strings = [];
    const collect = v => rec(v, o => { for (const x of Object.values(o)) if (typeof x === 'string') strings.push(x); else if (Array.isArray(x)) x.forEach(y => typeof y === 'string' && strings.push(y)); });
    collect(d.scripts || {});
    // gather everything this entity runs
    const usedAnim = [];
    for (const a of Object.values(d.animations || {})) {
      if (ctrlFiles.has(a)) {
        const c = ctrlFiles.get(a);
        collect(c);
        for (const st of Object.values(c.states || {})) for (const x of st.animations || []) { const k = typeof x === 'string' ? x : Object.keys(x)[0]; if (!d.animations[k]) errors.push(`${rel(f)}: controller ${a} uses animation '${k}' which is not in the entity`); usedAnim.push(d.animations[k]); }
      } else if (animDefs.has(a)) { usedAnim.push(a); collect(animDefs.get(a)); }
    }
    for (const r of d.render_controllers || []) { const k = typeof r === 'string' ? r : Object.keys(r)[0]; if (rcDefs.has(k)) collect(rcDefs.get(k)); if (typeof r === 'object') strings.push(Object.values(r)[0]); }
    // variables read without ever being assigned (the game fails the whole expression)
    const assigned = new Set(BUILTIN_VARS);
    for (const s of strings) for (const m of s.matchAll(/\b(?:v|variable)\.([a-z_0-9]+)\s*=(?!=)/gi)) assigned.add(m[1].toLowerCase());
    const reported = new Set();
    for (const s of strings) for (const m of s.matchAll(/\b(?:v|variable)\.([a-z_0-9]+)\b(\s*\?\?)?(\s*=(?!=))?/gi)) {
      if (m[2] || m[3]) continue;
      const n = m[1].toLowerCase();
      if (!assigned.has(n) && !reported.has(n)) { reported.add(n); errors.push(`${rel(f)}: variable v.${n} is read but never assigned`); }
    }
    // q.property('x') must exist on the behavior entity
    const p = props.get(id) || new Set();
    for (const s of strings) for (const m of s.matchAll(/q(?:uery)?\.property\(\s*'([^']+)'\s*\)/gi)) if (!p.has(m[1])) errors.push(`${rel(f)}: q.property('${m[1]}') is not declared on ${id}`);
    for (const s of strings) for (const m of s.matchAll(/\b(?:q|query)\.([a-z_0-9]+)/gi)) if (!queries.has(m[1].toLowerCase()) && m[1].toLowerCase() !== 'property') warnOnce(`query q.${m[1].toLowerCase()} is not used by vanilla files (check it exists)`);
    // animated bones must exist in at least one of the entity's geometries
    const bones = new Set();
    for (const g of Object.values(d.geometry || {})) (geoBones.get(g) || new Set()).forEach(b => bones.add(b));
    const missing = new Set();
    for (const a of usedAnim) for (const b of Object.keys((animDefs.get(a) || {}).bones || {})) if (!bones.has(b)) missing.add(b);
    if (missing.size) errors.push(`${rel(f)}: animations move bones that do not exist in the geometry: ${[...missing].slice(0, 6).join(', ')}`);
  }

  // ---- animation files: empty bones, empty controller animation lists
  for (const [f, j] of of(path.join(C.RP, 'animations'))) for (const [n, a] of Object.entries(j.animations || {})) {
    if (a.bones && !Object.keys(a.bones).length) errors.push(`${n}: empty "bones" (omit it for timer-only animations)`);
    for (const [b, ch] of Object.entries(a.bones || {})) if (!Object.keys(ch).length) errors.push(`${n}/${b}: bone entry has no channels`);
    if (a.loop === undefined && !a.animation_length && !a.bones) warnOnce(`${n}: animation without length or bones`);
  }
  for (const [f, j] of of(path.join(C.RP, 'animation_controllers'))) for (const [n, c] of Object.entries(j.animation_controllers || {})) {
    if (!c.states[c.initial_state || 'default']) errors.push(`${n}: initial_state missing`);
    for (const [sn, st] of Object.entries(c.states)) if (Array.isArray(st.animations) && !st.animations.length) errors.push(`${n}.${sn}: empty "animations" array rejects the whole controller file`);
  }

  // ---- vanilla item ids used by loot / recipes / entities must exist in Bedrock (checked against ids found in the vanilla samples)
  const VI = new Set(require('./vanilla_items.json').concat(['minecraft:cod', 'minecraft:tropical_fish', 'minecraft:salmon', 'minecraft:pufferfish', 'minecraft:bee_nest', 'minecraft:deadbush', 'minecraft:nether_star', 'minecraft:chorus_flower', 'minecraft:melon_slice', 'minecraft:spore_blossom', 'minecraft:magma', 'minecraft:magma_block', 'minecraft:shroomlight']));
  const checkId = (where, id) => { if (typeof id === 'string' && id.startsWith('minecraft:') && !VI.has(id)) warnOnce(`${where}: item ${id} not found in the vanilla samples (check the Bedrock id)`); };
  for (const [f, j] of of(path.join(C.BP, 'loot_tables'))) rec(j, o => { if (o.name) checkId(rel(f), o.name); });
  for (const [f, j] of of(path.join(C.BP, 'recipes'))) rec(j, o => { if (o.item) checkId(rel(f), o.item); if (typeof o.input === 'string') checkId(rel(f), o.input); if (typeof o.output === 'string') checkId(rel(f), o.output); });
  for (const [f, j] of of(path.join(C.BP, 'entities'))) rec(j, o => { for (const k of ['items', 'breed_items', 'feed_items', 'tame_items']) for (const it of (Array.isArray(o[k]) ? o[k] : [])) checkId(rel(f), typeof it === 'string' ? it : it.item); });

  // ---- loot tables: only vanilla functions / conditions
  const fns = V('lootFunctions'), conds = V('lootConditions');
  for (const [f, j] of of(path.join(C.BP, 'loot_tables'))) rec(j, o => {
    if (typeof o.function === 'string' && !fns.has(o.function)) errors.push(`${rel(f)}: loot function ${o.function} is not a Bedrock function`);
    if (typeof o.condition === 'string' && !conds.has(o.condition)) errors.push(`${rel(f)}: loot condition ${o.condition} is not a Bedrock condition`);
  });
};
