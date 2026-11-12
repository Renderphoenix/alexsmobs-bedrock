// Citadel bone tree -> Bedrock geometry (format 1.12.0).
// Java model space: y down, pivot chain relative; Bedrock: y up, absolute pivots.
//   bedrock = (x, 24 - y, z); rotations radians -> degrees with the same sign (verified against Blockbench codecs).
'use strict';
const DEG = 180 / Math.PI;
const r5 = n => Math.round(n * 1e4) / 1e4 || 0;

function absPivot(box) {
  const p = [0, 0, 0];
  for (let b = box; b; b = b.parent) { p[0] += b.pivot[0]; p[1] += b.pivot[1]; p[2] += b.pivot[2]; }
  return p;
}

function toGeometry(id, boxes, texW, texH, opts = {}) {
  // only boxes reachable as part of a tree with at least one cube somewhere
  const names = new Map();
  const used = new Set();
  const nameOf = b => {
    if (names.has(b.id)) return names.get(b.id);
    let n = (b.name || b.fieldName || 'bone' + b.id).replace(/[^A-Za-z0-9_]/g, '_');
    let k = n, i = 2;
    while (used.has(k.toLowerCase())) k = n + '_' + i++;
    used.add(k.toLowerCase());
    names.set(b.id, k);
    return k;
  };
  const hasCubes = b => b.cubes.length > 0 || b.children.some(hasCubes);
  const keep = boxes.filter(b => hasCubes(b) || (opts.keepEmpty && opts.keepEmpty.has(b.id)));
  // stable order: parents before children
  const ordered = [];
  const seen = new Set();
  const visit = b => { if (seen.has(b.id)) return; if (b.parent) visit(b.parent); seen.add(b.id); ordered.push(b); };
  keep.forEach(visit);
  let minY = Infinity, maxY = -Infinity, maxXZ = 0;
  const bones = ordered.map(b => {
    const P = absPivot(b);
    const bone = { name: nameOf(b), pivot: [r5(P[0]), r5(24 - P[1]), r5(P[2])] };
    if (b.parent) bone.parent = nameOf(b.parent);
    if (b.rot.some(x => Math.abs(x) > 1e-6)) bone.rotation = b.rot.map(x => r5(x * DEG));
    if (b.cubes.length) {
      bone.cubes = b.cubes.map(c => {
        const o = [P[0] + c.from[0], 24 - (P[1] + c.from[1] + c.size[1]), P[2] + c.from[2]];
        minY = Math.min(minY, o[1]); maxY = Math.max(maxY, o[1] + c.size[1]);
        maxXZ = Math.max(maxXZ, Math.abs(o[0]), Math.abs(o[0] + c.size[0]), Math.abs(o[2]), Math.abs(o[2] + c.size[2]));
        const cube = { origin: o.map(r5), size: c.size.map(r5), uv: c.uv.slice() };
        if (c.inflate) cube.inflate = r5(c.inflate);
        if (c.mirror) cube.mirror = true;
        return cube;
      });
    }
    return bone;
  });
  if (!isFinite(minY)) { minY = 0; maxY = 16; }
  // one explicit neck locator, identical across every geometry of an entity, so Bedrock doesn't
  // auto-generate mismatching ones ("model already has a locator armor_offset.default_neck")
  if (opts.neck) { const root = bones.find(b => !b.parent); if (root) root.locators = { 'armor_offset.default_neck': opts.neck }; }
  const neck = (() => { const h = bones.find(b => /^(head|neck|skull)/i.test(b.name)); return h ? h.pivot.slice() : [0, r5(maxY), 0]; })();
  const scale = opts.scale || 1;
  const w = Math.max(1, Math.ceil(((maxXZ * 2) / 16) * scale * 1.5 + 1));
  const h = Math.max(1, Math.ceil(((maxY - Math.min(0, minY)) / 16) * scale * 1.5 + 1));
  return {
    names, neck,
    json: {
      format_version: '1.12.0',
      'minecraft:geometry': [{
        description: {
          identifier: id,
          texture_width: texW,
          texture_height: texH,
          visible_bounds_width: w,
          visible_bounds_height: h,
          visible_bounds_offset: [0, r5(h / 2 - 0.5), 0],
        },
        bones,
      }],
    },
    bounds: { minY, maxY, maxXZ },
  };
}

module.exports = { toGeometry, absPivot, DEG };
