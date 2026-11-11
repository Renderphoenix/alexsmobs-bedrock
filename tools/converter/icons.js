// Icons rendered from converted models (items whose Java icon is a 3D builtin render), and the pack icon badge.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');
const { Interp } = require('./interp');
const G = require('./geometry');
const { load, Image } = require('../preview/pixel');

const MODEL_ICONS = { shield_of_the_deep: ['ModelShieldOfTheDeep', 'armor/shield_of_the_deep'] };

function renderModelIcons(ctx) {
  const { render } = require('../preview/render_preview');
  const tmp = path.join(C.OUT_DIR, 'icon_geo');
  fs.mkdirSync(tmp, { recursive: true });
  for (const [id, [model, tex]] of Object.entries(MODEL_ICONS)) {
    try {
      const I = new Interp(`${C.PKG}/client/model/${model}`);
      const boxes = I.build();
      const g = G.toGeometry(`geometry.icon.${id}`, boxes, I.texW, I.texH);
      const geoFile = path.join(tmp, id + '.geo.json');
      fs.writeFileSync(geoFile, JSON.stringify(g.json));
      process.env.YAW = '70'; process.env.PITCH = '12';
      const img = render(`${geoFile}|${path.join(C.ASSETS, 'textures', tex + '.png')}`, 64, null);
      delete process.env.YAW; delete process.env.PITCH;
      const out = path.join(C.RP, 'textures', C.NS, 'rendered', id + '.png');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      img.save(out);
      ctx.renderedIcons[id] = `rendered/${id}`;
    } catch (e) { ctx.warn.push(`icon ${id}: ${e.message}`); }
  }
}

// 5x7 bitmap digit "2" stamped on a round badge in the corner of the original Alex's Mobs pack icon
function packIcon(src, dst) {
  const img = load(src);
  const S = img.w;
  const cx = S * 0.82, cy = S * 0.82, r = S * 0.16;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < r) img.set(x, y, d > r - S * 0.018 ? [255, 255, 255, 255] : [230, 92, 30, 255]);
  }
  const TWO = ['01110', '10001', '00001', '00110', '01000', '10000', '11111'];
  const px = Math.round(S * 0.03), w = 5 * px, h = 7 * px;
  const ox = Math.round(cx - w / 2), oy = Math.round(cy - h / 2);
  TWO.forEach((row, ry) => [...row].forEach((c, rx) => {
    if (c !== '1') return;
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) img.set(ox + rx * px + x, oy + ry * px + y, [255, 255, 255, 255]);
  }));
  img.save(dst);
}

module.exports = { renderModelIcons, packIcon };
