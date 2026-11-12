// Blocks: Java blockstates + block models -> Bedrock custom blocks.
//  - vanilla parents (cube_all, cube_bottom_top, slab, stairs, wall post, ...) are expanded to elements
//  - element models become Bedrock block geometry with per-face UVs (Blockbench's own conversion rules:
//    x mirrored around the block centre, up/down UVs flipped on both axes)
//  - horizontal `facing` becomes the minecraft:placement_direction trait + rotated permutations
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');
const U = require('./util');

const NS = C.NS;
const FULL = [{ from: [0, 0, 0], to: [16, 16, 16], faces: { down: '#down', up: '#up', north: '#north', south: '#south', west: '#west', east: '#east' } }];
const VANILLA = {
  'block/cube': { elements: FULL },
  'block/cube_all': { parent: 'block/cube', textures: { down: '#all', up: '#all', north: '#all', south: '#all', west: '#all', east: '#all', particle: '#all' } },
  'block/cube_bottom_top': { parent: 'block/cube', textures: { down: '#bottom', up: '#top', north: '#side', south: '#side', west: '#side', east: '#side' } },
  'block/cube_top': { parent: 'block/cube', textures: { down: '#side', up: '#top', north: '#side', south: '#side', west: '#side', east: '#side' } },
  'block/cube_column': { parent: 'block/cube', textures: { down: '#end', up: '#end', north: '#side', south: '#side', west: '#side', east: '#side' } },
  'block/orientable': { parent: 'block/cube', textures: { down: '#top', up: '#top', north: '#front', south: '#side', west: '#side', east: '#side' } },
  'block/slab': { elements: [{ from: [0, 0, 0], to: [16, 8, 16], faces: { down: '#bottom', up: '#top', north: '#side', south: '#side', west: '#side', east: '#side' } }] },
  'block/stairs': { elements: [
    { from: [0, 0, 0], to: [16, 8, 16], faces: { down: '#bottom', up: '#top', north: '#side', south: '#side', west: '#side', east: '#side' } },
    { from: [8, 8, 0], to: [16, 16, 16], faces: { up: '#top', north: '#side', south: '#side', west: '#side', east: '#side' } }] },
  'block/template_wall_post': { elements: [{ from: [4, 0, 4], to: [12, 16, 12], faces: { down: '#wall', up: '#wall', north: '#wall', south: '#wall', west: '#wall', east: '#wall' } }] },
  'block/carpet': { elements: [{ from: [0, 0, 0], to: [16, 1, 16], faces: { down: '#wool', up: '#wool', north: '#wool', south: '#wool', west: '#wool', east: '#wool' } }] },
  'block/block': {}, 'block/thin_block': {},
};
const strip = s => s.replace(/^minecraft:/, '').replace(/^alexsmobs:/, 'alexsmobs:');

function loadModel(ref) {
  ref = strip(ref);
  if (!ref.startsWith('alexsmobs:')) return VANILLA[ref.startsWith('block/') ? ref : 'block/' + ref] ? JSON.parse(JSON.stringify(VANILLA[ref.startsWith('block/') ? ref : 'block/' + ref])) : null;
  const f = path.join(C.ASSETS, 'models', ref.slice(10) + '.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
function resolveModel(ref) {
  let elements = null, textures = {}, depth = 0;
  for (let cur = ref; cur && depth < 8; depth++) {
    const m = loadModel(cur);
    if (!m) return null;
    textures = Object.assign({}, m.textures || {}, textures);
    if (!elements && m.elements) elements = m.elements;
    cur = m.parent;
  }
  const res = v => { for (let i = 0; i < 8 && v && v.startsWith('#'); i++) v = textures[v.slice(1)]; return v; };
  if (!elements) return null;
  return { elements, tex: res, textures };
}

function defaultUV(face, from, to) {
  switch (face) {
    case 'north': return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]];
    case 'south': return [from[0], 16 - to[1], to[0], 16 - from[1]];
    case 'west': return [from[2], 16 - to[1], to[2], 16 - from[1]];
    case 'east': return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]];
    case 'up': return [from[0], from[2], to[0], to[2]];
    default: return [from[0], 16 - to[2], to[0], 16 - from[2]];
  }
}

const r4 = n => Math.round(n * 1e4) / 1e4;
function toBedrockGeometry(id, model, texKey) {
  const cubes = [];
  const used = new Set();
  for (const el of model.elements) {
    const [fx, fy, fz] = el.from, [tx, ty, tz] = el.to;
    const cube = { origin: [r4(8 - tx), r4(fy), r4(fz - 8)], size: [r4(tx - fx), r4(ty - fy), r4(tz - fz)], uv: {} };
    for (const [face, fd0] of Object.entries(el.faces || {})) {
      const fd = typeof fd0 === 'string' ? { texture: fd0 } : fd0;
      const tex = model.tex(fd.texture);
      if (!tex) continue;
      const key = texKey(tex);
      used.add(key);
      const uv = fd.uv || defaultUV(face, el.from, el.to);
      let u = [uv[0], uv[1]], s = [uv[2] - uv[0], uv[3] - uv[1]];
      if (face === 'up' || face === 'down') { u = [u[0] + s[0], u[1] + s[1]]; s = [-s[0], -s[1]]; }
      const o = { uv: u.map(r4), uv_size: s.map(r4), material_instance: key };
      if (fd.rotation) o.uv_rotation = fd.rotation;
      cube.uv[face] = o;
    }
    if (el.rotation && el.rotation.angle) {
      const ax = { x: 0, y: 1, z: 2 }[el.rotation.axis];
      const rot = [0, 0, 0];
      rot[ax] = el.rotation.angle;
      cube.pivot = [r4(8 - el.rotation.origin[0]), r4(el.rotation.origin[1]), r4(el.rotation.origin[2] - 8)];
      cube.rotation = [-rot[0], -rot[1], rot[2]];
    }
    cubes.push(cube);
  }
  return {
    used,
    json: { format_version: '1.21.0', 'minecraft:geometry': [{ description: { identifier: id, texture_width: 16, texture_height: 16, visible_bounds_width: 2, visible_bounds_height: 2.5, visible_bounds_offset: [0, 0.75, 0] }, bones: [{ name: 'block', pivot: [0, 0, 0], cubes }] }] },
  };
}

function boundsOf(model) {
  let a = [16, 16, 16], b = [0, 0, 0];
  for (const el of model.elements) for (let i = 0; i < 3; i++) { a[i] = Math.min(a[i], el.from[i]); b[i] = Math.max(b[i], el.to[i]); }
  return { a, b };
}

const SPECIAL = {
  rainbow_glass: { render: 'blend', light: 0, hardness: 0.3 },
  crystalized_banana_slug_mucus: { render: 'blend', hardness: 0.5 },
  banana_slug_slime_block: { render: 'blend', hardness: 0 },
  straddlite_block: { hardness: 5, light: 0 },
  capsid: { render: 'blend', hardness: 1 },
  ender_residue: { render: 'blend', light: 4, hardness: 0.3 },
  leafcutter_anthill: { hardness: 0.6 },
  leafcutter_ant_chamber: { hardness: 0.6 },
  sculk_boomer: { hardness: 1.5 },
  void_worm_effigy: { hardness: 5, light: 15 },
  void_worm_beak: { hardness: 5 },
  skunk_spray: { render: 'alpha_test', hardness: 0, noCollision: true },
  banana_peel: { render: 'alpha_test', hardness: 0, noCollision: true },
  sand_circle: { hardness: 0.5 }, red_sand_circle: { hardness: 0.5 },
};
const EGGS = { crocodile_egg: 'crocodile', caiman_egg: 'caiman', platypus_egg: 'platypus', terrapin_egg: 'terrapin', triops_eggs: 'triops' };

function generateBlocks(ctx, javaLang) {
  const dir = path.join(C.ASSETS, 'blockstates');
  const terrain = {};
  const made = [];
  for (const f of fs.readdirSync(dir)) {
    const id = f.replace('.json', '');
    const st = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    let entry = null, facing = false;
    if (st.variants) {
      const keys = Object.keys(st.variants);
      facing = keys.some(k => /facing=(north|east|south|west)/.test(k)) && !keys.some(k => /facing=(up|down)/.test(k));
      const k = keys.find(x => x === '') || keys.find(x => /facing=north/.test(x) && !/half=top|type=top|open=true|eggs=[2-9]|hatch=[12]/.test(x)) || keys.find(x => !/half=top|type=top|open=true/.test(x)) || keys[0];
      entry = st.variants[k];
    } else if (st.multipart) entry = st.multipart[0].apply;
    if (Array.isArray(entry)) entry = entry[0];
    if (!entry || !entry.model) continue;
    const model = resolveModel(entry.model);
    if (!model) { ctx.warn.push(`block ${id}: unsupported model ${entry.model}`); continue; }
    // textures -> terrain_texture keys
    const texKey = tex => {
      const rel = tex.replace(/^alexsmobs:/, '').replace(/^minecraft:/, 'minecraft/');
      const key = `${NS}_${rel.replace(/[/]/g, '_')}`;
      if (!terrain[key]) {
        if (tex.startsWith('minecraft:') || !tex.includes(':')) terrain[key] = { textures: `textures/blocks/${rel.replace(/^minecraft\//, '').replace(/^block\//, '')}` };
        else {
          if (U.hasTex(rel)) U.copy(U.jarTex(rel), path.join(C.RP, 'textures', NS, rel + '.png'));
          terrain[key] = { textures: `textures/${NS}/${rel}` };
        }
      }
      return key;
    };
    const sp = SPECIAL[id] || {};
    const gid = `geometry.${NS}.block.${id}`;
    const isFull = model.elements.length === 1 && model.elements[0].from.every(v => v === 0) && model.elements[0].to.every(v => v === 16) && !model.elements[0].rotation;
    const comps = {};
    const mats = {};
    if (isFull) {
      const el = model.elements[0];
      const faceTex = {};
      for (const [face, fd0] of Object.entries(el.faces || {})) {
        const fd = typeof fd0 === 'string' ? { texture: fd0 } : fd0;
        const t = model.tex(fd.texture);
        if (t) faceTex[face] = texKey(t);
      }
      const first = Object.values(faceTex)[0];
      comps['minecraft:geometry'] = 'minecraft:geometry.full_block';
      mats['*'] = { texture: faceTex.north || first, render_method: sp.render || 'opaque' };
      for (const [face, k] of Object.entries(faceTex)) if (k !== mats['*'].texture) mats[face] = { texture: k, render_method: sp.render || 'opaque' };
    } else {
      const g = toBedrockGeometry(gid, model, texKey);
      U.writeJson(path.join(C.RP, 'models/blocks', NS, `${id}.geo.json`), g.json);
      comps['minecraft:geometry'] = gid;
      const keys = [...g.used];
      mats['*'] = { texture: keys[0], render_method: sp.render || 'alpha_test' };
      for (const k of keys) mats[k] = { texture: k, render_method: sp.render || 'alpha_test' };
      const { a, b } = boundsOf(model);
      const box = { origin: [r4(Math.max(-8, 8 - b[0])), r4(Math.max(0, a[1])), r4(Math.max(-8, a[2] - 8))], size: [r4(Math.min(16, b[0] - a[0])), r4(Math.min(16, Math.max(0.1, b[1] - a[1]))), r4(Math.min(16, b[2] - a[2]))] };
      comps['minecraft:selection_box'] = box;
      comps['minecraft:collision_box'] = sp.noCollision ? false : box;
      if (box.size[1] < 16 || box.size[0] < 16 || box.size[2] < 16) comps['minecraft:light_dampening'] = 0;
    }
    comps['minecraft:material_instances'] = mats;
    comps['minecraft:destructible_by_mining'] = { seconds_to_destroy: sp.hardness !== undefined ? sp.hardness : 1 };
    comps['minecraft:destructible_by_explosion'] = { explosion_resistance: sp.hardness !== undefined ? Math.max(0.5, sp.hardness * 3) : 3 };
    if (sp.light) comps['minecraft:light_emission'] = sp.light;
    if (sp.render === 'blend') comps['minecraft:light_dampening'] = 0;
    comps['minecraft:display_name'] = `tile.${NS}:${id}.name`;
    const desc = { identifier: `${NS}:${id}`, menu_category: { category: /egg/.test(id) ? 'nature' : 'construction' } };
    const block = { format_version: '1.21.40', 'minecraft:block': { description: desc, components: comps } };
    if (facing) {
      desc.traits = { 'minecraft:placement_direction': { enabled_states: ['minecraft:cardinal_direction'], y_rotation_offset: 180 } };
      block['minecraft:block'].permutations = [
        { condition: "q.block_state('minecraft:cardinal_direction') == 'north'", components: { 'minecraft:transformation': { rotation: [0, 0, 0] } } },
        { condition: "q.block_state('minecraft:cardinal_direction') == 'west'", components: { 'minecraft:transformation': { rotation: [0, 90, 0] } } },
        { condition: "q.block_state('minecraft:cardinal_direction') == 'south'", components: { 'minecraft:transformation': { rotation: [0, 180, 0] } } },
        { condition: "q.block_state('minecraft:cardinal_direction') == 'east'", components: { 'minecraft:transformation': { rotation: [0, 270, 0] } } },
      ];
    }
    if (EGGS[id]) {
      // Egg blocks work like the turtle egg: a crack state (0..2) advanced by the egg's script component until it hatches.
      block.format_version = '1.21.90';
      desc.states = { [`${NS}:hatch`]: [0, 1, 2] };
      comps[`${NS}:egg`] = {};
      comps['minecraft:tick'] = { interval_range: [80, 160], looping: true };
      const perms = block['minecraft:block'].permutations || [];
      [[1, 'slightly_cracked_'], [2, 'very_cracked_']].forEach(([n, pre]) => {
        const cm = resolveModel(`alexsmobs:block/${pre}${id}`);
        const ct = cm && cm.tex('#all');
        if (!ct) return;
        const ck = texKey(ct);
        const crackMats = {};
        for (const k of Object.keys(mats)) crackMats[k] = { texture: ck, render_method: mats[k].render_method };
        perms.push({ condition: `q.block_state('${NS}:hatch') == ${n}`, components: { 'minecraft:material_instances': crackMats } });
      });
      if (perms.length) block['minecraft:block'].permutations = perms;
    }
    U.writeJson(path.join(C.BP, 'blocks', NS, `${id}.json`), block);
    const name = javaLang[`block.${NS}.${id}`] || U.title(id);
    ctx.itemLang.push(`tile.${NS}:${id}.name=${name}`);
    if (EGGS[id]) ctx.eggs[`${NS}:${id}`] = `${NS}:${EGGS[id]}`;
    made.push(`${NS}:${id}`);
  }
  U.writeJson(path.join(C.RP, 'textures', 'terrain_texture.json'), { resource_pack_name: NS, texture_name: 'atlas.terrain', padding: 8, num_mip_levels: 4, texture_data: terrain });
  return made;
}

module.exports = { generateBlocks, resolveModel };
