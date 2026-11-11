// Extracts everything the Bedrock generator needs from the Alex's Mobs jar into
// .tools/extract/mod.json. Run: node tools/converter/extract.js
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config');
const J = require('./javap');
const { scan } = require('./scan');

const P = C.PKG;
const cls = n => J.parseClass(/^(com|net|java)\//.test(n) ? n : `${P}/${n}`);
const method = (c, name) => c.methods.find(m => m.name === name);
const camel = id => id.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
const pascal = id => camel(id).replace(/^./, ch => ch.toUpperCase());
const exists = n => fs.existsSync(path.join(C.JAR_DIR, n + '.class'));

const ATTR = {
  f_22276_: 'health', f_22277_: 'follow_range', f_22278_: 'knockback_resistance', f_22279_: 'speed',
  f_22280_: 'flying_speed', f_22281_: 'damage', f_22282_: 'attack_knockback', f_22283_: 'attack_speed',
  f_22284_: 'armor', f_22285_: 'armor_toughness',
};

function ensureJar() {
  if (fs.existsSync(path.join(C.JAR_DIR, 'assets'))) return;
  const { execFileSync } = require('child_process');
  fs.mkdirSync(C.JAR_DIR, { recursive: true });
  execFileSync('unzip', ['-q', '-o', C.JAR, '-d', C.JAR_DIR]);
}

function registry() {
  const reg = cls('entity/AMEntityRegistry');
  const out = [];
  for (const m of reg.methods.filter(mm => /^lambda\$static\$\d+$/.test(mm.name))) {
    const { calls } = scan(m);
    const rc = calls.find(c => c.name === 'registerEntity');
    if (!rc) continue;
    const name = rc.args[1] && rc.args[1].v;
    const e = { id: name, category: 'CREATURE', width: 0.6, height: 1.8, fireImmune: false };
    for (const c of calls) {
      if (c.name === 'm_20704_' && c.args[1] && c.args[1].t === 'static') e.category = c.args[1].name;
      if (c.name === 'm_20699_') { e.width = c.args[0]; e.height = c.args[1]; }
      if (c.name === 'm_20719_') e.fireImmune = true;
    }
    out.push(e);
  }
  // registration order + field names
  const { puts, calls } = scan(method(reg, '<clinit>'));
  const order = new Map();
  for (const c of calls) if (c.name === 'register' && c.args[0] && c.args[0].t === 'str') order.set(c.pc, c.args[0].v);
  const fieldOf = new Map();
  for (const p of puts) {
    if (p.value && p.value.t === 'call' && p.value.name === 'register') fieldOf.set(p.value.args[0].v, p.name);
  }
  // attributes -> class
  const ia = scan(method(reg, 'initializeAttributes')).calls;
  const classOfField = new Map();
  let pending = null;
  for (const c of ia) {
    if (c.name === 'get' && c.recv && c.recv.t === 'static') pending = c.recv.name;
    else if (c.op === 'invokestatic' && c.owner && c.owner.startsWith(P + '/entity/') && pending) { classOfField.set(pending, c.owner); pending = null; }
  }
  for (const e of out) {
    e.field = fieldOf.get(e.id);
    e.cls = classOfField.get(e.field) || (exists(`${P}/entity/Entity${pascal(e.id)}`) ? `${P}/entity/Entity${pascal(e.id)}` : null);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function chainOf(c) {
  const chain = [];
  for (let k = c; k && k.ok; k = k.superName ? J.parseClass(k.superName) : null) {
    chain.push({ name: k.name, interfaces: k.interfaces || [] });
    if (!k.name.startsWith(P)) break;
  }
  // continue with the first vanilla superclass name only
  const last = chain[chain.length - 1];
  return chain.map(x => x.name.split('/').pop()).concat(last && last.name.startsWith(P) ? [] : []);
}

function entityInfo(e) {
  const c = J.parseClass(e.cls);
  const info = { supers: [], interfaces: [], attrs: {}, animations: {}, goals: [], targets: [], sounds: {} };
  for (let k = c; k && k.ok; k = k.superName ? J.parseClass(k.superName) : null) {
    info.supers.push(k.name.split('/').pop());
    info.interfaces.push(...(k.interfaces || []));
    if (k.superName && !k.superName.startsWith(P)) { info.supers.push(k.superName.split('/').pop()); break; }
  }
  // attributes
  for (let k = c; k && k.ok && k.name.startsWith(P); k = J.parseClass(k.superName)) {
    const bm = k.methods.find(m => m.isStatic && /AttributeSupplier\$Builder/.test(m.decl) && m.params.length === 0);
    if (bm) {
      for (const call of scan(bm).calls) {
        if ((call.name === 'm_22268_' || call.name === 'm_22266_') && call.args[0] && call.args[0].t === 'static') {
          const a = ATTR[call.args[0].name];
          if (a) info.attrs[a] = typeof call.args[1] === 'number' ? call.args[1] : (info.attrs[a] || null);
        }
      }
      info.attrBase = scan(bm).calls[0] && scan(bm).calls[0].owner.split('/').pop();
      break;
    }
  }
  // Citadel animations
  for (let k = c; k && k.ok && k.name.startsWith(P); k = J.parseClass(k.superName)) {
    const ci = method(k, '<clinit>');
    if (!ci) continue;
    for (const p of scan(ci).puts) {
      if (p.value && p.value.t === 'call' && p.value.name === 'create' && /Animation$/.test(p.value.owner || '')) {
        info.animations[p.name] = typeof p.value.args[0] === 'number' ? p.value.args[0] : 20;
      }
    }
  }
  // goals
  for (let k = c; k && k.ok && k.name.startsWith(P); k = J.parseClass(k.superName)) {
    const g = method(k, 'm_8099_');
    if (!g) continue;
    for (const call of scan(g).calls) {
      if (call.name === 'm_25352_' && call.args[1] && call.args[1].t === 'new') {
        const goal = call.args[1];
        const sel = call.recv && call.recv.name === 'f_21346_' ? 'target' : 'goal';
        const simple = (goal.cls || '').split('/').pop();
        const args = (goal.args || []).map(a => (typeof a === 'number' ? a : a && a.t === 'class' ? 'class:' + a.name.split('/').pop() : a && a.t === 'static' ? 'static:' + a.name : a && a.t === 'str' ? a.v : a && a.t === 'arr' ? 'arr:' + a.items.map(x => (x && x.t === 'class' ? x.name.split('/').pop() : '?')).join(',') : null));
        info.goals.push({ sel, pri: call.args[0], goal: simple, args });
      }
    }
    break;
  }
  // sounds
  const SND = { m_7515_: 'ambient', m_7975_: 'hurt', m_5592_: 'death' };
  for (let k = c; k && k.ok && k.name.startsWith(P); k = J.parseClass(k.superName)) {
    for (const [mn, key] of Object.entries(SND)) {
      if (info.sounds[key]) continue;
      const m = method(k, mn);
      if (!m) continue;
      const st = m.code.find(i => i.op === 'getstatic' && i.ref && i.ref.owner);
      if (st) info.sounds[key] = { owner: st.ref.owner.split('/').pop(), field: st.ref.name };
    }
  }
  return info;
}

function soundRegistry() {
  const c = cls('misc/AMSoundRegistry');
  const map = {};
  const ci = method(c, '<clinit>');
  if (!ci) return map;
  const { calls, puts } = scan(ci);
  for (const p of puts) {
    // value is a call createSoundEvent("name")
    const v = p.value;
    if (v && v.t === 'call') {
      const s = v.args.find(a => a && a.t === 'str');
      if (s) map[p.name] = s.v;
    }
  }
  return map;
}

// Vanilla SoundEvents SRG -> Bedrock sound event names, only the ones AM uses as fallbacks.
function rendererInfo(e) {
  const RN = { EntityMurmur: 'MurmurBody', EntityVoidWorm: 'VoidWormHead', EntityVoidWormPart: 'VoidWormBody' };
  const short = RN[e.cls.split('/').pop()] || e.cls.split('/').pop().replace(/^Entity/, '');
  const rn = `${P}/client/render/Render${short}`;
  const r = { renderer: null, models: [], textures: [], layerTextures: [], scale: null, shadow: null };
  if (!exists(rn)) return r;
  r.renderer = rn;
  const rc = J.parseClass(rn);
  const strings = new Set();
  const collect = k => {
    for (const m of k.methods) for (const i of m.code) {
      if (i.ref && i.ref.kind === 'string' && /textures\//.test(i.ref.value)) strings.add(i.ref.value);
    }
  };
  collect(rc);
  // nested classes of the renderer (layers declared inside)
  const dir = path.join(C.JAR_DIR, P, 'client/render');
  for (const f of fs.readdirSync(dir)) if (f.startsWith(`Render${short}$`)) collect(J.parseClass(`${P}/client/render/${f.replace('.class', '')}`));
  r.textures = [...strings];
  if (exists(`${P}/client/model/Model${short}`)) r.guessModel = `${P}/client/model/Model${short}`;
  const init = rc.methods.filter(m => m.name === '<init>');
  for (const m of init) {
    for (const call of scan(m).calls) {
      if (call.name === '<init>' && call.owner && call.owner.includes('/client/model/') && !r.models.includes(call.owner)) r.models.push(call.owner);
      if (call.name === '<init>' && call.owner && call.owner.includes('/client/render/layer/')) {
        const lc = J.parseClass(call.owner);
        const ls = new Set();
        for (const mm of lc.methods) for (const i of mm.code) if (i.ref && i.ref.kind === 'string' && /textures\//.test(i.ref.value)) ls.add(i.ref.value);
        const lmodels = [];
        for (const mm of lc.methods.filter(x => x.name === '<init>')) for (const cc of scan(mm).calls) if (cc.name === '<init>' && cc.owner && cc.owner.includes('/client/model/')) lmodels.push(cc.owner);
        r.layerTextures.push({ layer: call.owner.split('/').pop(), textures: [...ls], models: lmodels });
      }
      if (call.name === '<init>' && call.owner === rn.replace(/\/[^/]+$/, '') + '/' && false) { /* */ }
    }
    for (const i of m.code) if (i.op === 'ldc' || i.op === 'ldc_w') { /* shadow is passed to super(ctx, model, shadow) */ }
    const sup = scan(m).calls.find(c => c.name === '<init>' && c.recv && c.recv.t === 'local' && c.recv.n === 0);
    if (sup) { const f = sup.args.filter(a => typeof a === 'number'); if (f.length) r.shadow = f[f.length - 1]; }
  }
  const sm = rc.methods.find(m => m.name === 'm_7546_' && m.params.length === 3);
  if (sm) {
    const sc = scan(sm).calls.find(c => c.name === 'm_85841_');
    if (sc && sc.args.every(a => typeof a === 'number')) r.scale = sc.args;
  }
  return r;
}

function spawnData() {
  // BiomeConfig: field -> DefaultBiomes name
  const bc = scan(method(cls('config/BiomeConfig'), '<clinit>')).puts;
  const biomeOf = {};
  for (const p of bc) if (p.value && p.value.t === 'call' && p.value.name === 'of') {
    const d = p.value.args.find(a => a && a.t === 'static');
    biomeOf[p.name] = d ? d.name : null;
  }
  // DefaultBiomes: name -> pools
  const db = scan(method(cls('config/DefaultBiomes'), '<clinit>'));
  const sets = {};
  let prevPc = -1;
  for (const p of db.puts) {
    const entries = db.calls.filter(c => c.name === 'addBiomeEntry' && c.pc > prevPc && c.pc < p.pc).map(c => ({
      type: c.args[0] && c.args[0].name, negate: !!c.args[1], value: c.args[2] && c.args[2].v, pool: c.args[3],
    }));
    sets[p.name] = entries;
    prevPc = p.pc;
  }
  // AMConfig defaults
  const ac = scan(method(cls('config/AMConfig'), '<clinit>')).puts;
  const cfg = {};
  for (const p of ac) if (typeof p.value === 'number') cfg[p.name] = p.value;
  // AMWorldRegistry group sizes + category
  const ws = scan(method(cls('world/AMWorldRegistry'), 'addBiomeSpawns')).calls;
  const groups = {};
  let cat = null;
  for (const c of ws) {
    if (c.name === 'getSpawner' && c.args[0] && c.args[0].t === 'static') cat = c.args[0].name;
    if (c.name === '<init>' && /SpawnerData$/.test(c.owner)) {
      const f = c.args[0] && c.args[0].t === 'call' && c.args[0].recv && c.args[0].recv.name;
      if (f) groups[f] = { category: cat, min: c.args[2], max: c.args[3] };
    }
  }
  return { biomeOf, sets, cfg, groups };
}

function eggColors() {
  const c = cls('item/AMItemRegistry');
  const out = {};
  for (const m of c.methods.filter(mm => mm.name.startsWith('lambda$initSpawnEggs'))) {
    const { calls } = scan(m);
    const ctor = calls.find(x => x.name === '<init>' && /SpawnEggItem$/.test(x.owner));
    if (!ctor) continue;
    const f = ctor.args[0] && ctor.args[0].name;
    out[f] = [ctor.args[1], ctor.args[2]].map(n => '#' + (n >>> 0).toString(16).padStart(6, '0'));
  }
  return out;
}

function main() {
  ensureJar();
  const lang = JSON.parse(fs.readFileSync(path.join(C.ASSETS, 'lang/en_us.json'), 'utf8'));
  const sounds = soundRegistry();
  const spawn = spawnData();
  const eggs = eggColors();
  const ents = registry();
  for (const e of ents) {
    e.name = lang[`entity.alexsmobs.${e.id}`] || e.id;
    if (!e.cls) { e.missing = true; continue; }
    Object.assign(e, entityInfo(e));
    Object.assign(e, rendererInfo(e));
    const key = ({ centipede_head: 'caveCentipede' })[e.id] || camel(e.id);
    const bkey = [key, e.id, e.id.split('_')[0]].find(k => spawn.biomeOf[k] !== undefined);
    const set = bkey && spawn.biomeOf[bkey];
    if (set) {
      e.spawn = {
        biomes: spawn.sets[set] || [], set,
        weight: spawn.cfg[key + 'SpawnWeight'], rolls: spawn.cfg[key + 'SpawnRolls'],
        ...(spawn.groups[e.field] || {}),
      };
    }
    e.egg = eggs[e.field] || null;
    for (const k of Object.keys(e.sounds || {})) {
      const s = e.sounds[k];
      e.sounds[k] = s.owner === 'AMSoundRegistry' ? { am: sounds[s.field] || s.field.toLowerCase() } : { vanilla: s.field, owner: s.owner };
    }
  }
  fs.mkdirSync(C.OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(C.OUT_DIR, 'mod.json'), JSON.stringify({ entities: ents, soundRegistry: sounds }, null, 1));
  console.log(`entities: ${ents.length}, with class: ${ents.filter(e => e.cls).length}, with renderer: ${ents.filter(e => e.renderer).length}, spawning: ${ents.filter(e => e.spawn && e.spawn.weight > 0).length}`);
}

if (require.main === module) main();
module.exports = { main };
