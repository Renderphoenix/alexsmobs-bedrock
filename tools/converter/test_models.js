// Sweep: run the interpreter over every Citadel model class in the jar and report bones/cubes,
// compiled setupAnim size and keyframed animation count. Use after touching interp.js.
//   node tools/converter/test_models.js [ModelName ...]
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');
const { Interp } = require('./interp');
const M = require('./molang');

const dir = path.join(C.JAR_DIR, C.PKG, 'client/model');
const only = process.argv.slice(2);
let bad = 0;
for (const f of fs.readdirSync(dir).filter(x => /^Model\w+\.class$/.test(x))) {
  const n = f.replace('.class', '');
  if (only.length && !only.includes(n)) continue;
  const t = Date.now();
  try {
    const I = new Interp(`${C.PKG}/client/model/${n}`);
    const b = I.build();
    let r = null, total = 0;
    try { r = I.setupAnim(); if (r) for (const v of r.chan.values()) total += M.str(v).length; } catch (e) { bad++; console.log(n, 'SETUPANIM ERROR', e.message); }
    let an = new Map();
    try { an = I.animator(); } catch (e) { bad++; console.log(n, 'ANIMATOR ERROR', e.message); }
    const warn = [...new Set(I.warn)];
    if (warn.length) bad++;
    console.log(`${n.padEnd(32)} bones ${String(b.length).padStart(3)} cubes ${String(b.reduce((a, x) => a + x.cubes.length, 0)).padStart(3)} tex ${I.texW}x${I.texH} pose ${r ? r.chan.size : 0}ch/${total}c anims ${an.size} ${Date.now() - t}ms ${warn.length ? 'WARN ' + warn.join('; ').slice(0, 120) : ''}`);
  } catch (e) { bad++; console.log(n, 'BUILD ERROR', e.message); }
}
console.log(bad ? `${bad} models with problems` : 'all models OK');
