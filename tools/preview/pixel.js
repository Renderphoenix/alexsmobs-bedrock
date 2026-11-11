// Tiny pixel-art helpers: RGBA image, PNG writer, box-UV face painter.
const fs = require("fs");
const zlib = require("zlib");

function hex(c) {
  const n = parseInt(c.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

class Image {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4); // transparent
  }
  set(x, y, color) {
    if (!color || x < 0 || y < 0 || x >= this.w) return;
    // Writes below the image land in a scratch area (cat_rig paints full-length legs there, then splits them).
    if (y >= this.h) { (this.over = this.over || new Map()).set(y * 65536 + x, typeof color === "string" ? hex(color) : color); return; }
    const [r, g, b, a] = typeof color === "string" ? hex(color) : color;
    const i = (y * this.w + x) * 4;
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = a;
  }
  get(x, y) {
    if (y >= this.h) return (this.over && this.over.get(y * 65536 + x)) || [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [...this.data.subarray(i, i + 4)];
  }
  // Grow the canvas (keeps pixels at the same coordinates).
  resize(w, h) {
    const d = Buffer.alloc(w * h * 4);
    for (let y = 0; y < Math.min(h, this.h); y++) this.data.copy(d, y * w * 4, y * this.w * 4, y * this.w * 4 + Math.min(w, this.w) * 4);
    this.w = w; this.h = h; this.data = d;
  }
  colorCount() {
    const s = new Set();
    for (let i = 0; i < this.data.length; i += 4) if (this.data[i + 3]) s.add(this.data.readUInt32BE(i));
    return s.size;
  }
  save(file) {
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    const crc = (buf) => {
      let c = 0xffffffff;
      for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
    const chunk = (type, body) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
      const tb = Buffer.concat([Buffer.from(type), body]);
      const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb));
      return Buffer.concat([len, tb, c]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      this.data.copy(raw, y * (this.w * 4 + 1) + 1, y * this.w * 4, (y + 1) * this.w * 4);
    }
    fs.writeFileSync(file, Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]));
  }
}

// Load any non-interlaced PNG (gray, RGB, palette, gray+alpha, RGBA; 1-16 bit) into an RGBA Image.
function load(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, w = 0, h = 0, depth = 8, ctype = 6, interlace = 0, plte = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; ctype = body[9]; interlace = body[12]; }
    else if (type === 'PLTE') plte = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  if (interlace) throw new Error(file + ': interlaced PNG not supported');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const bpp = Math.max(1, (ch * depth) >> 3);
  const stride = Math.ceil((w * ch * depth) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const img = new Image(w, h);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      line[i] = (line[i] + pred) & 255;
    }
    const sample = (x, k) => {
      if (depth === 8) return line[x * ch + k];
      if (depth === 16) return line[(x * ch + k) * 2];
      const bitPos = (x * ch + k) * depth;
      const v = (line[bitPos >> 3] >> (8 - depth - (bitPos & 7))) & ((1 << depth) - 1);
      return ctype === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1));
    };
    for (let x = 0; x < w; x++) {
      let r, g, bl, al = 255;
      if (ctype === 6) { r = sample(x, 0); g = sample(x, 1); bl = sample(x, 2); al = sample(x, 3); }
      else if (ctype === 2) { r = sample(x, 0); g = sample(x, 1); bl = sample(x, 2); }
      else if (ctype === 0) { r = g = bl = sample(x, 0); }
      else if (ctype === 4) { r = g = bl = sample(x, 0); al = sample(x, 1); }
      else { const i = sample(x, 0); r = plte[i * 3]; g = plte[i * 3 + 1]; bl = plte[i * 3 + 2]; al = trns && i < trns.length ? trns[i] : 255; }
      img.set(x, y, [r, g, bl, al]);
    }
    prev = line;
  }
  return img;
}

// Paint a Bedrock box-UV cube of size [w,h,d] at uv [u,v].
// faces: { north, south, east, west, up, down } -> fn(info) returning a color.
// info: { x, y, fw, fh, t, s } where for side/top/bottom faces t = distance from the front (north) edge
// and s = distance from the top edge (sides) so painters can think in "front/back, top/bottom" terms.
function paintBox(img, [u, v], [w, h, d], faces) {
  const run = (fn, ox, oy, fw, fh, tOf) => {
    if (!fn) return;
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++)
        img.set(ox + x, oy + y, fn({ x, y, fw, fh, ...tOf(x, y) }));
  };
  run(faces.up, u + d, v, w, d, (x, y) => ({ t: d - 1 - y, s: 0 }));
  run(faces.down, u + d + w, v, w, d, (x, y) => ({ t: d - 1 - y, s: 0 }));
  run(faces.east, u, v + d, d, h, (x, y) => ({ t: d - 1 - x, s: y }));
  run(faces.north, u + d, v + d, w, h, (x, y) => ({ t: 0, s: y }));
  run(faces.west, u + d + w, v + d, d, h, (x, y) => ({ t: x, s: y }));
  run(faces.south, u + 2 * d + w, v + d, w, h, (x, y) => ({ t: d - 1, s: y }));
}

// Same painter for both side faces.
const sides = (fn) => ({ east: fn, west: fn });

module.exports = { Image, load, paintBox, sides, hex };
