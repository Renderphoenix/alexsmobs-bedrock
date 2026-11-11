// Pack-level files: manifests, language, sounds, pack icons, helper functions.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./config');
const U = require('./util');

const NS = C.NS;
const META_FILE = path.join(__dirname, 'pack.json');

function meta() {
  if (fs.existsSync(META_FILE)) return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  const m = {
    name: "Alex's Mobs 2", version: [2, 0, 0], min_engine_version: [1, 21, 90], script_api: '2.4.0',
    uuid: { bp: crypto.randomUUID(), bp_data: crypto.randomUUID(), bp_script: crypto.randomUUID(), rp: crypto.randomUUID(), rp_res: crypto.randomUUID() },
  };
  fs.writeFileSync(META_FILE, JSON.stringify(m, null, 2) + '\n');
  return m;
}

function manifests() {
  const m = meta();
  const v = m.version;
  const desc = `§aA fresh Bedrock port of Alex's Mobs§r, converted straight from the Java mod: real models, Java animations, spawns and drops.\n§7Original mod: Alexthe668, Carro1001, Paint_Ninja`;
  U.writeJson(path.join(C.BP, 'manifest.json'), {
    format_version: 2,
    header: { name: `§6${m.name} §e[BP] §7v${v.join('.')}`, description: desc, uuid: m.uuid.bp, version: v, min_engine_version: m.min_engine_version },
    modules: [
      { type: 'data', uuid: m.uuid.bp_data, version: v },
      { type: 'script', language: 'javascript', entry: 'scripts/main.js', uuid: m.uuid.bp_script, version: v },
    ],
    dependencies: [{ uuid: m.uuid.rp, version: v }, { module_name: '@minecraft/server', version: m.script_api }],
    metadata: { authors: ['Alexthe668', 'Carro1001', 'Paint_Ninja', 'Renderphoenix', 'devsuki'], product_type: 'addon' },
  });
  U.writeJson(path.join(C.RP, 'manifest.json'), {
    format_version: 2,
    header: { name: `§6${m.name} §e[RP] §7v${v.join('.')}`, description: desc, uuid: m.uuid.rp, version: v, min_engine_version: m.min_engine_version },
    modules: [{ type: 'resources', uuid: m.uuid.rp_res, version: v }],
    dependencies: [{ uuid: m.uuid.bp, version: v }],
    metadata: { authors: ['Alexthe668', 'Carro1001', 'Paint_Ninja', 'Renderphoenix', 'devsuki'], product_type: 'addon' },
  });
  const icon = path.join(C.ROOT, 'tools', 'converter', 'pack_icon.png');
  const src = fs.existsSync(icon) ? icon : path.join(C.ASSETS, '..', '..', 'pack.png');
  for (const d of [C.BP, C.RP]) if (fs.existsSync(src)) U.copy(src, path.join(d, 'pack_icon.png'));
  return m;
}

function sounds(ctx) {
  const jarSounds = JSON.parse(fs.readFileSync(path.join(C.ASSETS, 'sounds.json'), 'utf8'));
  const defs = {};
  const CAT = { neutral: 'neutral', hostile: 'hostile', record: 'record', block: 'block', player: 'player', ambient: 'ambient', master: 'neutral' };
  let n = 0;
  for (const [ev, def] of Object.entries(jarSounds)) {
    const list = [];
    for (let s of def.sounds || []) {
      const o = typeof s === 'string' ? { name: s } : s;
      const rel = o.name.replace(/^alexsmobs:/, '');
      const src = path.join(C.ASSETS, 'sounds', rel + '.ogg');
      if (!fs.existsSync(src)) continue;
      U.copy(src, path.join(C.RP, 'sounds', NS, rel + '.ogg'));
      n++;
      const e = { name: `sounds/${NS}/${rel}` };
      if (o.volume !== undefined) e.volume = o.volume;
      if (o.pitch !== undefined) e.pitch = o.pitch;
      if (o.stream) e.stream = true;
      list.push(e);
    }
    if (list.length) defs[`${NS}.${ev}`] = { category: CAT[def.category] || 'neutral', sounds: list };
  }
  U.writeJson(path.join(C.RP, 'sounds', 'sound_definitions.json'), { format_version: '1.14.0', sound_definitions: defs });
  U.writeJson(path.join(C.RP, 'sounds.json'), { entity_sounds: { entities: ctx.entitySounds } });
  return n;
}

function lang(ctx) {
  const jl = JSON.parse(fs.readFileSync(path.join(C.ASSETS, 'lang/en_us.json'), 'utf8'));
  const lines = [`## Alex's Mobs 2`, ...new Set(ctx.lang)];
  for (const l of ctx.itemLang || []) lines.push(l);
  lines.push(`pack.name=Alex's Mobs 2`, `pack.description=A fresh Bedrock port of Alex's Mobs`);
  fs.mkdirSync(path.join(C.RP, 'texts'), { recursive: true });
  fs.writeFileSync(path.join(C.RP, 'texts', 'en_US.lang'), lines.join('\n') + '\n');
  // other languages straight from the mod's own translations (falls back to English per key)
  const LOCALES = { de_de: 'de_DE', es_es: 'es_ES', es_mx: 'es_MX', fr_fr: 'fr_FR', it_it: 'it_IT', ja_jp: 'ja_JP', ko_kr: 'ko_KR', pl_pl: 'pl_PL', pt_br: 'pt_BR', ru_ru: 'ru_RU', sv_se: 'sv_SE', tr_tr: 'tr_TR', uk_ua: 'uk_UA', zh_cn: 'zh_CN', zh_tw: 'zh_TW', cz_sk: 'cs_CZ' };
  const javaKey = k => {
    let m;
    if ((m = k.match(/^entity\.alexsmobs:(\w+)\.name$/))) return [`entity.${NS}.${m[1]}`];
    if ((m = k.match(/^item\.spawn_egg\.entity\.alexsmobs:(\w+)\.name$/))) return [`item.${NS}.spawn_egg_${m[1]}`, `item.${NS}.spawn_egg_${m[1].replace(/_head$/, '')}`, `item.${NS}.spawn_egg_cave_centipede`];
    if ((m = k.match(/^tile\.alexsmobs:(\w+)\.name$/))) return [`block.${NS}.${m[1]}`];
    if (/^item\.alexsmobs\./.test(k)) return [k];
    return [];
  };
  const langs = ['en_US'];
  for (const [jf, bl] of Object.entries(LOCALES)) {
    const file = path.join(C.ASSETS, 'lang', jf + '.json');
    if (!fs.existsSync(file)) continue;
    let tr;
    try { tr = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/,(\s*[}\]])/g, '$1')); } catch (e) {
      // some community translations are not strict JSON: fall back to a line scan of "key": "value"
      tr = {};
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) tr[m[1]] = m[2].replace(/\\"/g, '"');
    }
    const out = lines.map(l => {
      const i = l.indexOf('=');
      if (i < 0 || l.startsWith('#')) return l;
      const k = l.slice(0, i);
      const hit = javaKey(k).find(j => tr[j]);
      return hit ? `${k}=${tr[hit]}` : l;
    });
    fs.writeFileSync(path.join(C.RP, 'texts', bl + '.lang'), out.join('\n') + '\n');
    langs.push(bl);
  }
  U.writeJson(path.join(C.RP, 'texts', 'languages.json'), langs);
  fs.mkdirSync(path.join(C.BP, 'texts'), { recursive: true });
  fs.writeFileSync(path.join(C.BP, 'texts', 'en_US.lang'), `pack.name=Alex's Mobs 2\npack.description=A fresh Bedrock port of Alex's Mobs\n`);
  U.writeJson(path.join(C.BP, 'texts', 'languages.json'), ['en_US']);
  return jl;
}

function functions(ctx, mobIds, itemIds) {
  const dir = path.join(C.BP, 'functions', NS);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'summon_all.mcfunction'), mobIds.map((id, i) => `summon ${NS}:${id} ~${(i % 10) * 4 - 18} ~ ~${Math.floor(i / 10) * 4 + 4}`).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'give_items.mcfunction'), itemIds.map(id => `give @s ${id}`).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'kill_all.mcfunction'), `kill @e[family=${NS}]\n`);
  fs.writeFileSync(path.join(dir, 'help.mcfunction'), [
    `tellraw @s {"rawtext":[{"text":"§6Alex's Mobs 2§r commands:"}]}`,
    `tellraw @s {"rawtext":[{"text":"/function ${NS}/summon_all  - every creature in a grid"}]}`,
    `tellraw @s {"rawtext":[{"text":"/function ${NS}/give_items  - every item"}]}`,
    `tellraw @s {"rawtext":[{"text":"/function ${NS}/kill_all    - remove all Alex's Mobs creatures"}]}`,
  ].join('\n') + '\n');
}

module.exports = { manifests, sounds, lang, functions, meta };
