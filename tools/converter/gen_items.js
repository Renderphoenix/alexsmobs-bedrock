// Items: Java AMItemRegistry -> Bedrock items (BP/items + RP textures/item_texture.json).
// Each registry entry is `register("name", () -> new X(new Item.Properties()...))`; the supplier lambda is
// resolved through the class's BootstrapMethods table (javap -v) and scanned for its properties.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./config');
const U = require('./util');
const J = require('./javap');
const { scan } = require('./scan');
const AB = require('./abilities');
const THROWN = { emu_egg: 'emu', cockroach_ootheca: 'cockroach' };

const NS = C.NS;
const P = C.PKG;

function bootstrapLambdas(fqcn) {
  const file = path.join(C.JAVAP_DIR, fqcn.replace(/[/.$]/g, '_') + '_v.txt');
  let txt;
  if (fs.existsSync(file)) txt = fs.readFileSync(file, 'utf8');
  else {
    txt = execFileSync('javap', ['-v', '-p', '-cp', C.JAR_DIR, fqcn.replace(/\//g, '.')], { encoding: 'utf8', maxBuffer: 64 << 20 });
    fs.writeFileSync(file, txt);
  }
  const lines = txt.replace(/\r/g, '').split('\n');
  const start = lines.findIndex(l => l.startsWith('BootstrapMethods:'));
  const map = new Map();
  let cur = null;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^\s+(\d+): #\d+ REF_invokeStatic/);
    if (m) { cur = +m[1]; continue; }
    const l = lines[i].match(/REF_invoke\w+ [\w/$]+\.(lambda\$[\w$]+):/);
    if (l && cur !== null && !map.has(cur)) map.set(cur, l[1]);
  }
  return map;
}

const FOOD = { m_38760_: 'nutrition', m_38758_: 'saturation', m_38757_: 'meat', m_38765_: 'always', m_38766_: 'fast' };

function registryItems(regClass) {
  const cls = J.parseClass(regClass);
  const bsm = bootstrapLambdas(regClass);
  const lambdas = new Map(cls.methods.filter(m => m.name.startsWith('lambda$')).map(m => [m.name, m]));
  const items = [];
  const scanAll = (m) => {
    const out = [];
    for (const c of scan(m).calls) out.push(c);
    return out;
  };
  for (const m of cls.methods) {
    const { calls } = scan(m);
    for (const c of calls) {
      if (c.name !== 'register' || !c.args[0] || c.args[0].t !== 'str' || !c.args[1] || c.args[1].t !== 'indy') continue;
      const lname = bsm.get(c.args[1].bsm);
      const lam = lambdas.get(lname);
      const it = { id: c.args[0].v, cls: null, stack: 64, food: null, durability: 0, fire: false, args: [] };
      if (lam) {
        const lc = scanAll(lam);
        const ctor = lc.filter(x => x.name === '<init>' && x.owner && !/Properties|Builder|MobEffectInstance/.test(x.owner)).pop();
        if (ctor) { it.cls = ctor.owner.split('/').pop(); it.args = ctor.args.map(a => (typeof a === 'number' ? a : a && a.t === 'static' ? String(a.owner || '').split('/').pop() + '.' + a.name : a && a.t === 'str' ? a.v : null)); }
        for (const x of lc) {
          if (x.name === 'm_41487_') it.stack = x.args[0];
          if (x.name === 'm_41503_') { it.durability = x.args[0]; it.stack = 1; }
          if (x.name === 'm_41486_') it.fire = true;
          if (FOOD[x.name]) { it.food = it.food || {}; it.food[FOOD[x.name]] = x.args.length ? x.args[0] : true; }
          if (/m_3876[23]_/.test(x.name)) { it.food = it.food || {}; it.food.effect = true; }
        }
      }
      items.push(it);
    }
  }
  return items;
}

// item icon: models/item/<id>.json -> layer0, else textures/item/<id>.png
function iconFor(id) {
  const mdir = path.join(C.ASSETS, 'models/item');
  for (let name = id, d = 0; name && d < 4; d++) {
    const f = path.join(mdir, name.replace(/^alexsmobs:(item\/)?/, '').replace(/^item\//, '') + '.json');
    if (!fs.existsSync(f)) break;
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (j.textures && j.textures.layer0) {
      const layers = Object.keys(j.textures).filter(k => /^layer\d+$/.test(k)).sort().map(k => j.textures[k].replace(/^alexsmobs:/, ''));
      if (layers.length > 1 && layers.every(l => U.hasTex(l))) return { layers, id };
      return layers[0];
    }
    if (j.parent && /^alexsmobs:item\//.test(j.parent)) { name = j.parent.split('/').pop(); continue; }
    const particle = j.textures && j.textures.particle && j.textures.particle.replace(/^alexsmobs:/, '');
    if (particle && particle.startsWith('item/') && U.hasTex(particle)) return particle;
    break;
  }
  if (U.hasTex('item/' + id)) return 'item/' + id;
  return null;
}

const ARMOR_SLOT = { HELMET: ['slot.armor.head', 'head'], CHESTPLATE: ['slot.armor.chest', 'chest'], LEGGINGS: ['slot.armor.legs', 'legs'], BOOTS: ['slot.armor.feet', 'feet'] };

function generateItems(ctx, javaLang) {
  const items = registryItems(`${P}/item/AMItemRegistry`);
  const itemTex = {};
  const made = [];
  const missingIcon = [];
  for (const it of items) {
    if (/^spawn_egg_/.test(it.id) || it.cls === 'BannerPatternItem' || it.cls === 'ItemInventoryOnly' || it.id === 'tab_icon') continue;
    const id = `${NS}:${it.id}`;
    let icon = iconFor(it.id);
    if (!icon && ctx.renderedIcons && ctx.renderedIcons[it.id]) icon = ctx.renderedIcons[it.id];
    if (!icon) { missingIcon.push(it.id); continue; }
    let texRel = icon;
    if (typeof icon === 'object') {
      // layered generated item (fish buckets): composite the layers into one icon
      const { load } = require('../preview/pixel');
      const base = load(U.jarTex(icon.layers[0]));
      for (const l of icon.layers.slice(1)) {
        const top = load(U.jarTex(l));
        for (let y = 0; y < Math.min(base.h, top.h); y++) for (let x = 0; x < Math.min(base.w, top.w); x++) {
          const t = top.get(x, y);
          if (!t[3]) continue;
          const b = base.get(x, y), a = t[3] / 255;
          base.set(x, y, [0, 1, 2].map(i => Math.round(t[i] * a + b[i] * (1 - a))).concat([Math.max(b[3], t[3])]));
        }
      }
      texRel = `item/composite/${icon.id}`;
      fs.mkdirSync(path.join(C.RP, 'textures', NS, 'item/composite'), { recursive: true });
      base.save(path.join(C.RP, 'textures', NS, texRel + '.png'));
    } else if (!icon.startsWith('rendered/')) U.copy(U.jarTex(icon), path.join(C.RP, 'textures', NS, texRel + '.png'));
    itemTex[`${NS}_${it.id}`] = { textures: `textures/${NS}/${texRel}` };
    const comps = {
      'minecraft:icon': { textures: { default: `${NS}_${it.id}` } },
      'minecraft:display_name': { value: `item.${NS}.${it.id}` },
      'minecraft:max_stack_size': it.durability ? 1 : Math.max(1, Math.min(64, it.stack || 64)),
    };
    const name = javaLang[`item.${NS}.${it.id}`] || U.title(it.id);
    ctx.itemLang.push(`item.${NS}.${it.id}=${name}`);

    if (it.food && it.food.nutrition !== undefined) {
      comps['minecraft:food'] = { nutrition: it.food.nutrition, saturation_modifier: +(it.food.saturation || 0.3).toFixed(2), can_always_eat: !!it.food.always };
      comps['minecraft:use_animation'] = 'eat';
      comps['minecraft:use_modifiers'] = { use_duration: it.food.fast ? 0.8 : 1.6, movement_modifier: 0.35 };
      if (it.cls === 'BowlFoodItem') comps['minecraft:food'].using_converts_to = 'minecraft:bowl';
    }
    if (it.durability) comps['minecraft:durability'] = { max_durability: it.durability };
    // armour
    const armorSlot = it.cls === 'ItemModArmor' || /ArmorItem|Elytra/.test(it.cls || '') ? (it.args.find(a => a && /ArmorItem\$Type\.|EquipmentSlot\./.test(a)) || '').split('.').pop() : null;
    if (armorSlot && ARMOR_SLOT[armorSlot]) {
      comps['minecraft:wearable'] = { slot: ARMOR_SLOT[armorSlot][0], protection: { HELMET: 2, CHESTPLATE: 6, LEGGINGS: 5, BOOTS: 2 }[armorSlot] };
      comps['minecraft:durability'] = comps['minecraft:durability'] || { max_durability: { HELMET: 200, CHESTPLATE: 280, LEGGINGS: 260, BOOTS: 220 }[armorSlot] };
      comps['minecraft:max_stack_size'] = 1;
      comps['minecraft:enchantable'] = { slot: { HELMET: 'armor_head', CHESTPLATE: 'armor_torso', LEGGINGS: 'armor_legs', BOOTS: 'armor_feet' }[armorSlot], value: 12 };
      ctx.armor.push({ id: it.id, slot: armorSlot });
    }
    // weapons
    if (/Sword|Tendon|Ghostly/.test(it.cls || '')) {
      comps['minecraft:damage'] = { value: /Sword/.test(it.cls) ? 7 : 4 };
      comps['minecraft:hand_equipped'] = { value: true };
      comps['minecraft:durability'] = comps['minecraft:durability'] || { max_durability: 600 };
      comps['minecraft:max_stack_size'] = 1;
    }
    if (it.cls === 'ItemGhostlyPickaxe') {
      comps['minecraft:digger'] = { use_efficiency: true, destroy_speeds: [{ block: { tags: "q.any_tag('stone', 'metal', 'diamond_pick_diggable', 'iron_pick_diggable', 'stone_pick_diggable')" }, speed: 8 }] };
    }
    // fish buckets -> place the creature back
    if (it.cls === 'ItemModFishBucket' || it.cls === 'ItemCosmicCodBucket') {
      const field = (it.args.find(a => a && a.startsWith('AMEntityRegistry.')) || '').split('.').pop();
      const mob = field ? field.toLowerCase() : it.id.replace(/_bucket$/, '');
      comps['minecraft:entity_placer'] = { entity: `${NS}:${mob}` };
      comps['minecraft:max_stack_size'] = 1;
      ctx.buckets[`${NS}:${mob}`] = id;
    }
    if (it.cls === 'ItemFuel') comps['minecraft:fuel'] = { duration: 100 };
    if (it.cls === 'RecordItem') {
      comps['minecraft:max_stack_size'] = 1;
      const field = (it.args.find(a => a && /AMSoundRegistry./.test(a)) || '').split('.').pop();
      const snd = (ctx.soundRegistry || {})[field] || it.id;
      ctx.abilities.sound[id] = { sound: `${NS}.${snd}`, cooldown: 400 };
      comps['minecraft:cooldown'] = { category: `${NS}_${it.id}`, duration: 20 };
    }
    if (THROWN[it.id]) {
      comps['minecraft:projectile'] = { projectile_entity: `${NS}:${it.id}_projectile` };
      comps['minecraft:throwable'] = { do_swing_animation: true, launch_power_scale: 1.0, max_launch_power: 1.0 };
      comps['minecraft:max_stack_size'] = it.id === 'emu_egg' ? 8 : 64;
      ctx.thrown[it.id] = { mob: THROWN[it.id], icon: `textures/${NS}/${texRel}` };
    }
    if (AB.RAY[it.id] || AB.SOUND[it.id]) { const a = AB.RAY[it.id] || AB.SOUND[it.id]; comps['minecraft:cooldown'] = { category: `${NS}_${it.id}`, duration: a.cooldown / 20 }; }
    if (AB.RAY[it.id]) ctx.abilities.ray[id] = AB.RAY[it.id];
    if (AB.SCAN[it.id]) ctx.abilities.scan[id] = AB.SCAN[it.id];
    if (AB.SOUND[it.id]) ctx.abilities.sound[id] = AB.SOUND[it.id];
    if (AB.FOOD[it.id] && comps['minecraft:food']) ctx.abilities.food[id] = AB.FOOD[it.id];
    U.writeJson(path.join(C.BP, 'items', NS, `${it.id}.json`), {
      format_version: '1.21.40',
      'minecraft:item': { description: { identifier: id, menu_category: { category: comps['minecraft:food'] ? 'nature' : comps['minecraft:wearable'] || comps['minecraft:damage'] ? 'equipment' : 'items' } }, components: comps },
    });
    made.push(id);
  }
  U.writeJson(path.join(C.RP, 'textures', 'item_texture.json'), { resource_pack_name: NS, texture_name: 'atlas.items', texture_data: itemTex });
  return { made, missingIcon, all: items };
}

module.exports = { generateItems, registryItems, iconFor, bootstrapLambdas };
