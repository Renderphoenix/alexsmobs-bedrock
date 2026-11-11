// Armour: vanilla LayerDefinition armour models (AM client/model/layered/*) and plain armour textures
// -> Bedrock attachable geometry bound to the player's bones.
'use strict';
const path = require('path');
const C = require('./config');
const U = require('./util');
const J = require('./javap');
const G = require('./geometry');
const { parseDesc } = require('./interp');

const NS = C.NS;
const P = C.PKG;
const BONE = { head: 'head', hat: 'hat', body: 'body', right_arm: 'rightArm', left_arm: 'leftArm', right_leg: 'rightLeg', left_leg: 'leftLeg' };
const SLOT_BONES = { HELMET: ['head', 'hat'], CHESTPLATE: ['body', 'right_arm', 'left_arm'], LEGGINGS: ['body', 'right_leg', 'left_leg'], BOOTS: ['right_leg', 'left_leg'] };
const SLOT_INFLATE = { HELMET: 1, CHESTPLATE: 1, LEGGINGS: 0.5, BOOTS: 1 };
const CUSTOM = {
  fedora: 'ModelFedora', frontier_cap: 'ModelFrontierCap', froststalker_helmet: 'ModelFroststalkerHelmet', moose_headgear: 'ModelMooseHeadgear',
  novelty_hat: 'ModelNoveltyHat', roadrunner_boots: 'ModelRoadrunnerBoots', rocky_chestplate: 'ModelRockyChestplate', flying_fish_boots: 'ModelFlyingFishBoots',
};

let ID = 0;
const part = (name) => ({ t: 'part', id: ++ID, name, cubes: [], pose: [0, 0, 0, 0, 0, 0], children: new Map() });

function humanoidMesh(def, yOff = 0) {
  const root = part('root');
  const add = (name, u, v, box, pose, inflate, mirror) => {
    const p = part(name);
    p.cubes.push({ uv: [u, v], from: box.slice(0, 3), size: box.slice(3), inflate, mirror: !!mirror });
    p.pose = pose;
    root.children.set(name, p);
  };
  add('head', 0, 0, [-4, -8, -4, 8, 8, 8], [0, yOff, 0, 0, 0, 0], def);
  add('hat', 32, 0, [-4, -8, -4, 8, 8, 8], [0, yOff, 0, 0, 0, 0], def + 0.5);
  add('body', 16, 16, [-4, 0, -2, 8, 12, 4], [0, yOff, 0, 0, 0, 0], def);
  add('right_arm', 40, 16, [-3, -2, -2, 4, 12, 4], [-5, 2 + yOff, 0, 0, 0, 0], def);
  add('left_arm', 40, 16, [-1, -2, -2, 4, 12, 4], [5, 2 + yOff, 0, 0, 0, 0], def, true);
  add('right_leg', 0, 16, [-2, 0, -2, 4, 12, 4], [-1.9, 12 + yOff, 0, 0, 0, 0], def);
  add('left_leg', 0, 16, [-2, 0, -2, 4, 12, 4], [1.9, 12 + yOff, 0, 0, 0, 0], def, true);
  return { t: 'mesh', root };
}

// run the model's static createArmorLayer(CubeDeformation) linearly
function runLayer(modelCls, inflate) {
  const cls = J.parseClass(`${P}/client/model/layered/${modelCls}`);
  const m = cls.methods.find(mm => mm.isStatic && /LayerDefinition/.test(mm.decl));
  if (!m) return null;
  const S = [], L = [inflate];
  let result = null;
  const num = v => (typeof v === 'number' ? v : 0);
  for (const ins of m.code) {
    const op = ins.op;
    let mm;
    if ((mm = op.match(/^([ifdal])const_(m1|\d)$/))) { S.push(mm[2] === 'm1' ? -1 : +mm[2]); continue; }
    if ((mm = op.match(/^([ifdal])load(?:_(\d))?$/))) { S.push(L[mm[2] !== undefined ? +mm[2] : +ins.args[0]]); continue; }
    if ((mm = op.match(/^([ifdal])store(?:_(\d))?$/))) { L[mm[2] !== undefined ? +mm[2] : +ins.args[0]] = S.pop(); continue; }
    switch (op) {
      case 'bipush': case 'sipush': S.push(+ins.args[0]); continue;
      case 'ldc': case 'ldc_w': case 'ldc2_w': S.push(ins.ref && ins.ref.kind === 'num' ? ins.ref.value : ins.ref && ins.ref.kind === 'string' ? { t: 'str', v: ins.ref.value } : null); continue;
      case 'fneg': S.push(-num(S.pop())); continue;
      case 'fadd': { const b = S.pop(), a = S.pop(); S.push(num(a) + num(b)); continue; }
      case 'fsub': { const b = S.pop(), a = S.pop(); S.push(num(a) - num(b)); continue; }
      case 'fmul': { const b = S.pop(), a = S.pop(); S.push(num(a) * num(b)); continue; }
      case 'fdiv': { const b = S.pop(), a = S.pop(); S.push(num(b) ? num(a) / num(b) : 0); continue; }
      case 'dup': S.push(S[S.length - 1]); continue;
      case 'pop': S.pop(); continue;
      case 'new': S.push({ t: 'new', cls: ins.ref.name }); continue;
      case 'getstatic': S.push(/CubeDeformation/.test(ins.ref.owner || '') ? 0 : /PartPose/.test(ins.ref.owner || '') ? [0, 0, 0, 0, 0, 0] : null); continue;
      case 'areturn': result = S.pop(); continue;
      case 'checkcast': continue;
    }
    if (/^invoke/.test(op)) {
      const r = ins.ref, d = parseDesc(r.desc);
      const args = [];
      for (let i = d.args.length - 1; i >= 0; i--) args[i] = S.pop();
      const recv = op === 'invokestatic' ? null : S.pop();
      const owner = (r.owner || '').split('/').pop();
      let res;
      if (owner === 'HumanoidModel' && r.name === 'm_170681_') res = humanoidMesh(num(args[0]), num(args[1]));
      else if (owner === 'MeshDefinition' && r.name === '<init>') { recv.t = 'mesh'; recv.root = part('root'); }
      else if (owner === 'MeshDefinition') res = recv.root;
      else if (owner === 'PartDefinition' && d.args.length === 1) res = recv.children.get(args[0].v) || (recv.children.set(args[0].v, part(args[0].v)), recv.children.get(args[0].v));
      else if (owner === 'PartDefinition' && d.args.length === 3) {
        const p = part(args[0].v);
        const b = args[1] || { cubes: [] };
        p.cubes = b.cubes || [];
        p.pose = Array.isArray(args[2]) ? args[2] : [0, 0, 0, 0, 0, 0];
        const old = recv.children.get(p.name);
        if (old) for (const [k, v] of old.children) p.children.set(k, v);
        recv.children.set(p.name, p);
        res = p;
      } else if (owner === 'CubeListBuilder') {
        const b = recv && recv.t === 'clb' ? recv : { t: 'clb', u: 0, v: 0, mirror: false, cubes: [] };
        if (r.name === 'm_171558_') res = { t: 'clb', u: 0, v: 0, mirror: false, cubes: [] };
        else if (r.name === 'm_171514_') { b.u = num(args[0]); b.v = num(args[1]); res = b; }
        else if (r.name === 'm_171480_') { b.mirror = true; res = b; }
        else if (r.name === 'm_171555_') { b.mirror = !!args[0]; res = b; }
        else {
          const f = args.filter((a, i) => d.args[i] === 'F').map(num);
          if (f.length >= 6) {
            const defArg = args.find((a, i) => /CubeDeformation/.test(d.args[i]));
            const ints = args.filter((a, i) => d.args[i] === 'I');
            const uv = ints.length >= 2 ? [ints[0], ints[1]] : [b.u, b.v];
            b.cubes.push({ uv, from: f.slice(0, 3), size: f.slice(3, 6), inflate: typeof defArg === 'number' ? defArg : 0, mirror: b.mirror });
          }
          res = b;
        }
      } else if (owner === 'CubeDeformation') {
        if (r.name === '<init>') { const v = num(args[0]); for (let i = S.length - 1; i >= 0; i--) if (S[i] === recv) S[i] = v; }
        else res = num(recv) + num(args[0]);
      } else if (owner === 'PartPose') {
        if (r.name === 'm_171419_') res = [num(args[0]), num(args[1]), num(args[2]), 0, 0, 0];
        else if (r.name === 'm_171423_') res = args.map(num);
        else res = [0, 0, 0, ...args.map(num)].slice(-6);
      } else if (owner === 'LayerDefinition') res = { t: 'layer', mesh: args[0], w: num(args[1]), h: num(args[2]) };
      if (d.ret !== 'V') S.push(res === undefined ? null : res);
      continue;
    }
  }
  return result;
}

// mesh -> Citadel-like boxes for geometry.js
function meshBoxes(mesh, keep) {
  const boxes = [];
  const walk = (p, parent, top) => {
    const name = top ? BONE[p.name] || p.name : p.name;
    const b = { id: p.id, name, parent, children: [], pivot: p.pose.slice(0, 3), rot: p.pose.slice(3, 6), cubes: p.cubes, scale: [1, 1, 1] };
    if (parent) parent.children.push(b);
    boxes.push(b);
    for (const c of p.children.values()) walk(c, b, false);
  };
  for (const [n, p] of mesh.root.children) if (keep.includes(n)) walk(p, null, true);
  return boxes;
}

function generateArmor(ctx) {
  for (const a of ctx.armor) {
    const tex = `armor/${a.id}`;
    if (!U.hasTex(tex)) { ctx.warn.push(`armor ${a.id}: no texture`); continue; }
    U.copy(U.jarTex(tex), path.join(C.RP, 'textures', NS, tex + '.png'));
    let layer = CUSTOM[a.id] ? runLayer(CUSTOM[a.id], SLOT_INFLATE[a.slot]) : null;
    if (!layer) layer = { mesh: humanoidMesh(SLOT_INFLATE[a.slot]), w: 64, h: 32 };
    const boxes = meshBoxes(layer.mesh, SLOT_BONES[a.slot]);
    const gid = `geometry.${NS}.armor.${a.id}`;
    const g = G.toGeometry(gid, boxes, layer.w || 64, layer.h || 32);
    U.writeJson(path.join(C.RP, 'models/entity', NS, 'armor', `${a.id}.geo.json`), g.json);
    const hide = { HELMET: 'helmet', CHESTPLATE: 'chest', LEGGINGS: 'leg', BOOTS: 'boot' }[a.slot];
    U.writeJson(path.join(C.RP, 'attachables', NS, `${a.id}.json`), {
      format_version: '1.10.0',
      'minecraft:attachable': {
        description: {
          identifier: `${NS}:${a.id}`,
          materials: { default: 'armor', enchanted: 'armor_enchanted' },
          textures: { default: `textures/${NS}/${tex}`, enchanted: 'textures/misc/enchanted_actor_glint' },
          geometry: { default: gid },
          scripts: { parent_setup: `v.${hide}_layer_visible = 0.0;` },
          render_controllers: ['controller.render.armor'],
        },
      },
    });
  }
}

module.exports = { generateArmor, runLayer, humanoidMesh };
