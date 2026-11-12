// Contact sheet of one animation per mob at a fraction of its length (side view by default).
//   node tools/preview/anim_sheet.js out.png <anim|a,b,c> <fraction> [mob ...]     (no mobs = every mob)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RP = path.join(__dirname, '..', '..', 'addon', 'RP');
const [out, pref, frac, ...mobs] = process.argv.slice(2);
const prefs = pref.split(',');
const list = mobs.length ? mobs : fs.readdirSync(path.join(RP, 'animations', 'alexsmobs')).map(f => f.replace('.animation.json', ''));
const ids = [];
for (const m of list) {
  const j = JSON.parse(fs.readFileSync(path.join(RP, 'animations', 'alexsmobs', m + '.animation.json'), 'utf8')).animations;
  const a = prefs.find(p => j[`animation.alexsmobs.${m}.${p}`]);
  if (!a) { ids.push(m); continue; }
  const def = j[`animation.alexsmobs.${m}.${a}`];
  ids.push(`${m}@animation.alexsmobs.${m}.${a}@${((def.animation_length || 1) * Number(frac)).toFixed(3)}`);
}
execFileSync('node', [path.join(__dirname, 'render_preview.js'), out, ...ids, '--cols', '10', '--size', '150'], { stdio: 'inherit', env: Object.assign({ YAW: '-90', PITCH: '8' }, process.env) });
