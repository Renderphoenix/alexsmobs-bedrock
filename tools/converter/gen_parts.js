// Multipart creatures (anaconda, bone serpent, cave centipede, void worm, murmur head).
// Java keeps each segment as its own entity that follows the one in front; we do the same:
// one Bedrock part entity per creature whose geometry is picked by the int property alexsmobs:seg,
// positioned every tick by BP/scripts (chain follow) and forwarding its damage to the head.
'use strict';
const path = require('path');
const C = require('./config');
const U = require('./util');
const G = require('./geometry');
const { Interp } = require('./interp');
const A = require('./anims');

const NS = C.NS;
const P = C.PKG;

function texPath(rel) { return `textures/entity/${NS}/${rel}`; }
function copyTex(rel) {
  if (!U.hasTex('entity/' + rel)) return false;
  U.copy(U.jarTex('entity/' + rel), path.join(C.RP, texPath(rel) + '.png'));
  return true;
}

// spec.parts: { entity, count, spacing, segs: [{ model, ctor?, sw?, tex?, glow? }], skin? }
function generateChain(head, spec, headInfo, ctx) {
  const ps = spec.parts;
  const id = ps.entity;
  const full = `${NS}:${id}`;
  const segs = ps.segs;
  const geometry = {}, textures = {};
  const anims = {};
  const animMap = {};
  let partNeck = null;
  segs.forEach((sg, i) => {
    const I = new Interp(`${P}/client/model/${sg.model}`);
    const boxes = I.build(sg.ctor || [], sg.sw || 1);
    const gid = `geometry.${NS}.${id}.s${i}`;
    if (!partNeck) partNeck = G.toGeometry(gid, boxes, I.texW, I.texH).neck;
    const g = G.toGeometry(gid, boxes, I.texW, I.texH, { neck: partNeck });
    U.writeJson(path.join(C.RP, 'models/entity', NS, `${id}.s${i}.geo.json`), g.json);
    geometry['s' + i] = gid;
    if (sg.tex && copyTex(sg.tex)) textures['s' + i] = texPath(sg.tex);
    if (sg.glow && copyTex(sg.glow)) textures['g' + i] = texPath(sg.glow);
    // a slithering sway per segment, phase-shifted by its index (set by the script)
    const bones = g.json['minecraft:geometry'][0].bones;
    const root = bones.find(b => !b.parent);
    if (root) {
      anims[`animation.${NS}.${id}.sway_s${i}`] = {
        loop: true,
        bones: { [root.name]: { rotation: [0, `math.sin(q.life_time * 220 + q.property('${NS}:index') * 55) * 9 * math.clamp(q.ground_speed * 4 + 0.25, 0, 1)`, 0] } },
      };
      animMap['sway_s' + i] = `animation.${NS}.${id}.sway_s${i}`;
    }
  });
  // skins inherited from the head (anaconda: normal/yellow)
  const skins = ps.skin ? headInfo.variants : null;
  if (skins) skins.forEach((t, i) => (textures['k' + i] = texPath(t)));
  U.writeJson(path.join(C.RP, 'animations', NS, `${id}.animation.json`), { format_version: '1.8.0', animations: anims });

  const segIdx = `math.clamp(q.property('${NS}:seg'), 0, ${segs.length - 1})`;
  const texList = skins ? skins.map((_, i) => 'Texture.k' + i) : segs.map((sg, i) => (textures['s' + i] ? 'Texture.s' + i : 'Texture.s0'));
  const texIdx = skins ? `math.clamp(q.property('${NS}:skin'), 0, ${skins.length - 1})` : segIdx;
  const rcId = `controller.render.${NS}.${id}`;
  const rc = {
    [rcId]: {
      arrays: { geometries: { 'Array.geos': segs.map((_, i) => 'Geometry.s' + i) }, textures: { 'Array.skins': texList } },
      geometry: `Array.geos[${segIdx}]`, materials: [{ '*': 'Material.default' }], textures: [`Array.skins[${texIdx}]`],
    },
  };
  const rcs = [rcId];
  if (segs.some(sg => sg.glow)) {
    rc[rcId + '.glow'] = {
      arrays: { geometries: { 'Array.geos': segs.map((_, i) => 'Geometry.s' + i) }, textures: { 'Array.glow': segs.map((sg, i) => (textures['g' + i] ? 'Texture.g' + i : 'Texture.g0')) } },
      geometry: `Array.geos[${segIdx}]`, materials: [{ '*': 'Material.glow' }], textures: [`Array.glow[${segIdx}]`], ignore_lighting: true,
    };
    rcs.push(rcId + '.glow');
  }
  U.writeJson(path.join(C.RP, 'render_controllers', NS, `${id}.render_controllers.json`), { format_version: '1.10.0', render_controllers: rc });
  const animate = segs.map((_, i) => ({ ['sway_s' + i]: `q.property('${NS}:seg') == ${i}` }));
  U.writeJson(path.join(C.RP, 'entity', NS, `${id}.entity.json`), {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: full,
        materials: { default: 'entity_alphatest', glow: 'entity_alphatest' },
        textures, geometry, animations: animMap,
        scripts: { animate },
        render_controllers: rcs,
      },
    },
  });
  writePartBehavior(id, head, spec, { seg: segs.length - 1, skin: skins ? skins.length - 1 : 0 });
  ctx.lang.push(`entity.${full}.name=${head.name}`);
  ctx.chains[`${NS}:${head.id}`] = {
    part: full, count: ps.count, spacing: ps.spacing,
    segs: Array.from({ length: ps.count }, (_, i) => (segs.length === 3 ? (i === 0 ? 0 : i === ps.count - 1 ? 2 : 1) : (i === ps.count - 1 ? segs.length - 1 : 0))),
    skin: !!skins,
    wave: ps.wave || null,
  };
}

function generateFollower(head, spec, ctx) {
  const f = spec.follower;
  const id = f.entity, full = `${NS}:${id}`;
  const I = new Interp(`${P}/client/model/${f.model}`);
  const boxes = I.build();
  const gid = `geometry.${NS}.${id}`;
  const g = G.toGeometry(gid, boxes, I.texW, I.texH);
  U.writeJson(path.join(C.RP, 'models/entity', NS, `${id}.geo.json`), g.json);
  copyTex(f.tex);
  I.setupAnim();
  const MO = require('./motion');
  const loop = MO.buildLoop(MO.activeGaits(I.gaits, MO.stateEnv('ground', [...I.ent.progress.entries()])), { maxL: 5, maxKeys: 90 });
  const poseBones = loop ? MO.toBones(loop, g.names) : {};
  const pose = Object.keys(poseBones).length ? { loop: true, animation_length: loop.length, bones: poseBones } : null;
  const anims = pose ? { [`animation.${NS}.${id}.pose`]: pose } : {};
  U.writeJson(path.join(C.RP, 'animations', NS, `${id}.animation.json`), { format_version: '1.8.0', animations: anims });
  U.writeJson(path.join(C.RP, 'render_controllers', NS, `${id}.render_controllers.json`), {
    format_version: '1.10.0',
    render_controllers: { [`controller.render.${NS}.${id}`]: { geometry: 'Geometry.default', materials: [{ '*': 'Material.default' }], textures: ['Texture.default'] } },
  });
  U.writeJson(path.join(C.RP, 'entity', NS, `${id}.entity.json`), {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: full,
        materials: { default: 'entity_alphatest' },
        textures: { default: texPath(f.tex) },
        geometry: { default: gid },
        animations: pose ? { pose: `animation.${NS}.${id}.pose` } : {},
        scripts: {
          animate: pose ? ['pose'] : [],
        },
        render_controllers: [`controller.render.${NS}.${id}`],
      },
    },
  });
  writePartBehavior(id, head, spec, { seg: 0, skin: 0, follower: true });
  ctx.lang.push(`entity.${full}.name=${head.name}`);
  ctx.followers[`${NS}:${head.id}`] = { part: full, offset: f.offset };
}

function writePartBehavior(id, head, spec, o) {
  const hostile = spec.temper === 'hostile';
  const fire = head.fireImmune || ['lava', 'lavawalker'].includes(spec.kind);
  const comps = {
    'minecraft:type_family': { family: [id, `${head.id}_part`, NS, 'mob', 'inanimate'] },
    'minecraft:collision_box': { width: Math.min(1.5, head.width), height: Math.min(1.5, head.height) },
    'minecraft:health': { value: 1000, max: 1000 },
    'minecraft:physics': { has_gravity: false, has_collision: false },
    'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: false },
    'minecraft:knockback_resistance': { value: 1 },
    'minecraft:damage_sensor': { triggers: [{ cause: 'fall', deals_damage: 'no' }, { cause: 'suffocation', deals_damage: 'no' }, { cause: 'drowning', deals_damage: 'no' }] },
    'minecraft:breathable': { total_supply: 15, suffocate_time: 0, breathes_water: true, breathes_air: true },
    'minecraft:conditional_bandwidth_optimization': {},
    'minecraft:movement': { value: 0 },
  };
  if (fire) comps['minecraft:fire_immune'] = {};
  if (head.attrs && head.attrs.damage && hostile) comps['minecraft:attack'] = { damage: Math.round(head.attrs.damage / 2) };
  U.writeJson(path.join(C.BP, 'entities', NS, `${id}.json`), {
    format_version: '1.21.50',
    'minecraft:entity': {
      description: {
        identifier: `${NS}:${id}`, is_spawnable: false, is_summonable: true, is_experimental: false,
        properties: {
          [`${NS}:seg`]: { type: 'int', range: [0, Math.max(1, o.seg)], default: 0, client_sync: true },
          [`${NS}:skin`]: { type: 'int', range: [0, Math.max(1, o.skin)], default: 0, client_sync: true },
          [`${NS}:index`]: { type: 'int', range: [0, 32], default: 0, client_sync: true },
        },
      },
      components: comps,
      events: {},
    },
  });
}

module.exports = { generateChain, generateFollower };
