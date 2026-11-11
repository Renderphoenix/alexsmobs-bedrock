// Offline model preview (no Blockbench needed): renders geometry + texture with box UVs, bone/cube rotations,
// a z-buffer and simple face lighting into a contact sheet PNG. For quick visual checks when the Blockbench MCP
// is unavailable. Usage: node tools/render_preview.js out.png id1 id2 ... [--cols 6] [--size 240]
const fs = require("fs");
const path = require("path");
const { Image, load } = require("./pixel");

const RP = path.join(__dirname, "..", "..", "addon", "RP");
const NS = "alexsmobs";
const texOf = (id) => { const mob = id.split(".")[0]; const e = JSON.parse(fs.readFileSync(path.join(RP, "entity", NS, mob + ".entity.json"), "utf8"))["minecraft:client_entity"].description; return path.join(RP, (process.env.TEX && e.textures[process.env.TEX]) || e.textures.v0 || e.textures[id.includes(".") ? id.split(".")[1] : "default"] || Object.values(e.textures)[0]) + ".png"; };
const rad = (d) => (d * Math.PI) / 180;
const mul = (a, b) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j]; return r; };
const T = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; };
const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; };
const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
const apply = (m, [x, y, z]) => [m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]];
// Bedrock rotations in its own (unmirrored) model space: X and Z inverted, Y standard. Blockbench shows the same thing
// by mirroring X and negating X/Y; the picture is mirrored at the end so it matches the game and Blockbench.
// (Fixed 2026-11-03: Y and Z had the wrong sign, which made the eagle's wing fold point forward into the body in game.)
const rot = (p, r) => (r ? mul(T(...p), mul(Rz(rad(-r[2])), mul(Ry(rad(r[1])), mul(Rx(rad(-r[0])), T(-p[0], -p[1], -p[2]))))) : T(0, 0, 0));

// Molang -> JS for previews. VARS env: JSON like {"v.ls":3,"v.lsa":1,"q.is_sitting":1}
const MATH = { sin: (d) => Math.sin(d * Math.PI / 180), cos: (d) => Math.cos(d * Math.PI / 180), abs: Math.abs, min: Math.min, max: Math.max, clamp: (x, a, b) => Math.min(Math.max(x, a), b), sqrt: Math.sqrt, floor: Math.floor, trunc: Math.trunc, mod: (a, b) => a % b, lerp: (a, b, t) => a + (b - a) * t, pow: Math.pow, atan2: (y, x) => Math.atan2(y, x) * 180 / Math.PI, random: () => 0.5, random_integer: (a) => a };
const VARS = JSON.parse(process.env.VARS || "{}");
function molang(str) {
  const js = str.replace(/(^|[^A-Za-z0-9_.])(v|q|variable|query)[.]([a-z_0-9]+)/gi, (m, p, a, b) => `${p}ENV("${a[0]}.${b}")`).replace(/(^|[^A-Za-z0-9_.])math[.]/gi, (m, p) => p + "MATH.");
  try { return Number(new Function("ENV", "MATH", "return (" + js + ");")((k) => VARS[k] ?? 0, MATH)) || 0; } catch (e) { return 0; }
}
// Sample an animation channel (numbers / {post} keys, linear between keys; molang strings count as 0)
function sample(ch, t) {
  if (!ch) return null;
  const num = (v) => (Array.isArray(v) ? v : v && (v.post || v.pre)) || [0, 0, 0];
  const vec = (v) => (typeof v === "string" || typeof v === "number" ? [v, v, v] : num(v)).map((x) => (typeof x === "number" ? x : typeof x === "string" ? molang(x) : 0));
  if (Array.isArray(ch) || typeof ch === "string" || typeof ch === "number") return vec(ch);
  if (typeof ch !== "object") return null;
  const ks = Object.keys(ch).map(Number).sort((a, b) => a - b);
  const at = (k) => vec(ch[Object.keys(ch).find((x) => Number(x) === k)]);
  if (t <= ks[0]) return at(ks[0]);
  for (let i = 1; i < ks.length; i++) if (t <= ks[i]) { const a = at(ks[i - 1]), b = at(ks[i]), f = (t - ks[i - 1]) / (ks[i] - ks[i - 1]); return a.map((v, j) => v + (b[j] - v) * f); }
  return at(ks[ks.length - 1]);
}

// Posed faces of a model in Bedrock's own model space: [{ q: 4 corners, r: uv rect, l: face light }], plus texture size
function buildFaces(id, anim) {
  const geo = JSON.parse(fs.readFileSync(id.includes("|") ? id.split("|")[0] : path.join(RP, "models", "entity", NS, `${id}.geo.json`), "utf8"))["minecraft:geometry"][0];
  const tw = geo.description.texture_width, th = geo.description.texture_height;
  const byName = Object.fromEntries(geo.bones.map((b) => [b.name, b]));
  const world = {};
  const pose = (b) => {
    const ch = anim && anim.bones[b.name];
    const r = sample(ch && ch.rotation, anim ? anim.t : 0), p = sample(ch && ch.position, anim ? anim.t : 0);
    const sc = ch && ch.scale !== undefined ? (typeof ch.scale === "number" ? [ch.scale, ch.scale, ch.scale] : sample(ch.scale, anim ? anim.t : 0)) : null;
    const base = b.rotation || [0, 0, 0];
    const pv = b.pivot || [0, 0, 0];
    let m = rot(pv, r ? base.map((v, i) => v + r[i]) : b.rotation);
    // bone scale about the pivot, applied before the rotation (children inherit it)
    if (sc && sc.some((v) => v !== 0 && v !== 1)) m = mul(m, mul(T(...pv), mul([sc[0] || 1, 0, 0, 0, 0, sc[1] || 1, 0, 0, 0, 0, sc[2] || 1, 0, 0, 0, 0, 1], T(-pv[0], -pv[1], -pv[2]))));
    return p ? mul(T(p[0], p[1], p[2]), m) : m;
  };
  const boneM = (b) => world[b.name] || (world[b.name] = mul(b.parent ? boneM(byName[b.parent]) : T(0, 0, 0), pose(b)));
  const faces = [];
  for (const b of geo.bones) for (const c of b.cubes || []) {
    if (!Array.isArray(c.uv)) continue;
    const m = mul(boneM(b), rot(c.pivot || c.origin, c.rotation));
    const [x0, y0, z0] = c.origin, [w, h, d] = c.size, [x1, y1, z1] = [x0 + w, y0 + h, z0 + d];
    const [u, v] = c.uv, W = Math.ceil(w), H = Math.ceil(h), D = Math.ceil(d);
    const P = (x, y, z) => apply(m, [x, y, z]);
    // quad corners (top-left, top-right, bottom-right, bottom-left as seen in the UV) + uv rect
    faces.push(
      { q: [P(x1, y1, z0), P(x0, y1, z0), P(x0, y0, z0), P(x1, y0, z0)], r: [u + D, v + D, W, H], l: 0.85 }, // north (-z)
      { q: [P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)], r: [u + 2 * D + W, v + D, W, H], l: 0.6 }, // south
      { q: [P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1)], r: [u, v + D, D, H], l: 0.7 }, // east (+x)
      { q: [P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1), P(x0, y0, z0)], r: [u + D + W, v + D, D, H], l: 0.75 }, // west
      { q: [P(x1, y1, z1), P(x0, y1, z1), P(x0, y1, z0), P(x1, y1, z0)], r: [u + D, v, W, D], l: 1.0 }, // up
      { q: [P(x1, y0, z0), P(x0, y0, z0), P(x0, y0, z1), P(x1, y0, z1)], r: [u + D + W, v, W, D], l: 0.45 }, // down
    );
  }
  return { faces, tw, th };
}

function render(id, S, anim) {
  const { faces, tw, th } = buildFaces(id, anim);
  const tex = load(id.includes("|") ? id.split("|")[1] : texOf(id));
  const sx = tex.w / tw, sy = tex.h / th;
  // camera: from the front-left, above
  const yaw = rad(Number(process.env.YAW || -145)), pitch = rad(Number(process.env.PITCH || 28));
  const view = (p) => { const [x, y, z] = p; const X = x * Math.cos(yaw) - z * Math.sin(yaw), Z = x * Math.sin(yaw) + z * Math.cos(yaw);
    return [X, y * Math.cos(pitch) - Z * Math.sin(pitch), y * Math.sin(pitch) + Z * Math.cos(pitch)]; };
  const pts = faces.flatMap((f) => f.q.map(view));
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  const k = (S - 20) / Math.max(maxX - minX, maxY - minY, 1);
  const img = new Image(S, S), zb = new Float32Array(S * S).fill(-1e9);
  const scr = (p) => { const [X, Y, Z] = view(p); return [S - ((X - minX) * k + (S - (maxX - minX) * k) / 2), S - ((Y - minY) * k + (S - (maxY - minY) * k) / 2), Z]; };
  for (const f of faces) {
    const q = f.q.map(scr);
    const [ru, rv, rw, rh] = f.r;
    if (rw <= 0 || rh <= 0) continue;
    for (const tri of [[0, 1, 2], [0, 2, 3]]) {
      const [a, b, c] = tri.map((i) => q[i]);
      const uvs = tri.map((i) => [[0, 0], [1, 0], [1, 1], [0, 1]][i]);
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(area) < 1e-6) continue;
      const xs = [a[0], b[0], c[0]], ys = [a[1], b[1], c[1]];
      for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(S - 1, Math.ceil(Math.max(...ys))); y++)
        for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(S - 1, Math.ceil(Math.max(...xs))); x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
          const w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
          const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
          if (z <= zb[y * S + x]) continue;
          const s = w0 * uvs[0][0] + w1 * uvs[1][0] + w2 * uvs[2][0], t = w0 * uvs[0][1] + w1 * uvs[1][1] + w2 * uvs[2][1];
          const tx = Math.floor((ru + Math.min(0.999, s) * rw) * sx), ty = Math.floor((rv + Math.min(0.999, t) * rh) * sy);
          if (tx < 0 || ty < 0 || tx >= tex.w || ty >= tex.h) continue;
          const col = tex.get(tx, ty);
          if (!col[3]) continue;
          zb[y * S + x] = z;
          img.set(x, y, [col[0] * f.l, col[1] * f.l, col[2] * f.l, 255].map(Math.round));
        }
    }
  }
  return img;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = Number(args[i + 1]); args.splice(i, 2); return v; };
  const cols = opt("--cols", 6), S = opt("--size", 240);
  const [out, ...ids] = args;
  // id may be "mob@animation.name@time" to render a moment of an animation
  const loadAnim = (mob, name, t) => {
    const dir = path.join(RP, "animations", NS);
    for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(mob + "."))) {
      const a = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).animations[name];
      if (a) return { bones: a.bones || {}, t };
    }
    return null;
  };
  const sheet = new Image(cols * S, Math.ceil(ids.length / cols) * S);
  for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.set(x, y, ((x / S | 0) + (y / S | 0)) % 2 ? [104, 120, 90, 255] : [96, 112, 84, 255]);
  ids.forEach((id, i) => {
    try {
      const [mob, name, t] = id.split("@");
      const img = render(mob, S, name ? loadAnim(mob.split(".")[0], name, Number(t || 0)) : null);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const p = img.get(x, y); if (p[3]) sheet.set((i % cols) * S + x, Math.floor(i / cols) * S + y, p); }
    } catch (e) { console.warn(id, e.message); }
  });
  sheet.save(out);
  console.log(`rendered ${ids.length} models to ${out}`);
}

module.exports = { render, buildFaces, sample };
