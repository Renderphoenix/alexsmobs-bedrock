// Alex's Mobs 2 build: Java jar -> Bedrock add-on (addon/BP + addon/RP).
//   node tools/converter/build.js            full rebuild
//   node tools/converter/build.js grizzly_bear tiger   only these mobs (no clean)
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');
const U = require('./util');
const X = require('./extract');
const GM = require('./gen_mobs');
const GI = require('./gen_items');
const GB = require('./gen_blocks');
const AR = require('./armor');
const GS = require('./gen_script');
const GP = require('./gen_pack');
const GR = require('./gen_recipes');
const GE = require('./gen_eggs');

function main() {
  const only = process.argv.slice(2);
  if (!fs.existsSync(path.join(C.OUT_DIR, 'mod.json'))) X.main();
  const mod = JSON.parse(fs.readFileSync(path.join(C.OUT_DIR, 'mod.json'), 'utf8'));
  if (!only.length) {
    for (const d of [C.BP, C.RP]) for (const sub of fs.existsSync(d) ? fs.readdirSync(d) : []) {
      if (/manifest\.json|pack_icon\.png/.test(sub)) continue;
      fs.rmSync(path.join(d, sub), { recursive: true, force: true });
    }
  }
  const oggSeconds = name => {
    try {
      const defs = JSON.parse(fs.readFileSync(path.join(C.ASSETS, 'sounds.json'), 'utf8'));
      const first = defs[name] && defs[name].sounds[0];
      const rel = (typeof first === 'string' ? first : first && first.name || name).replace(/^alexsmobs:/, '');
      const f = path.join(C.ASSETS, 'sounds', rel + '.ogg');
      const buf = fs.readFileSync(f);
      const v = buf.indexOf('vorbis');
      const rate = buf.readUInt32LE(v + 6 + 4 + 1);
      const last = buf.lastIndexOf('OggS');
      const gran = Number(buf.readBigUInt64LE(last + 6));
      return Math.max(30, Math.round(gran / rate));
    } catch { return 180; }
  };
  const ctx = { warn: [], lang: [], attackAnims: {}, spawns: [], lootItems: new Set(), soundEvents: new Set(), entitySounds: {}, results: [], chains: {}, followers: {}, itemLang: [], armor: [], buckets: {}, eggs: {}, renderedIcons: {}, thrown: {}, abilities: { ray: {}, scan: {}, sound: {}, food: {} }, soundRegistry: mod.soundRegistry || {}, recordSeconds: oggSeconds };
  const PARTS = new Set(['anaconda_part', 'bone_serpent_part', 'centipede_body', 'centipede_tail', 'void_worm_part', 'murmur_head']);
  const mobs = mod.entities.filter(e => e.cls && e.category !== 'MISC' && !PARTS.has(e.id) && (e.models && e.models.length || e.guessModel));
  for (const e of mobs) {
    if (only.length && !only.includes(e.id)) continue;
    try {
      const r = GM.generate(e, ctx);
      if (r) ctx.results.push(r);
    } catch (err) {
      ctx.warn.push(`${e.id}: ${err.stack.split('\n').slice(0, 3).join(' | ')}`);
    }
  }
  if (!only.length) {
    const javaLang = JSON.parse(fs.readFileSync(path.join(C.ASSETS, 'lang/en_us.json'), 'utf8'));
    require('./icons').renderModelIcons(ctx);
    const items = GI.generateItems(ctx, javaLang);
    AR.generateArmor(ctx);
    const blocks = GB.generateBlocks(ctx, javaLang);
    const nThrown = GE.generateThrown(ctx);
    GS.generateScript(ctx);
    const rec = GR.generateRecipes(ctx, items.made.concat(blocks));
    ctx.warn.push(...rec.skipped.map(x => 'recipe ' + x));
    const nSounds = GP.sounds(ctx);
    GP.manifests();
    GP.lang(ctx);
    GP.functions(ctx, ctx.results.map(r => r.id), items.made.concat(blocks));
    console.log(`items: ${items.made.length} (no icon: ${items.missingIcon.join(', ') || '-'}), blocks: ${blocks.length}, armor: ${ctx.armor.length}, sounds: ${nSounds}, recipes: ${rec.count}, thrown eggs: ${nThrown}`);
  }
  fs.mkdirSync(C.OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(C.OUT_DIR, 'build_report.json'), JSON.stringify({ warn: ctx.warn, spawns: ctx.spawns, results: ctx.results }, null, 1));
  console.log(`mobs: ${ctx.results.length}/${mobs.length}`);
  for (const w of ctx.warn) console.log('WARN', w);
  return ctx;
}

if (require.main === module) main();
module.exports = { main };
