// Our own item abilities and food effects (the Java versions are client/server Java code with no Bedrock equivalent).
// Consumed by gen_items.js (cooldowns/durability) and gen_script.js (written into BP/scripts/main.js).
'use strict';

// "ray" items: on use, entities in the player's view direction within `range` get the effects.
//   effects: [effect, seconds, amplifier]   damage: hearts*2   pull: impulse towards the player
const RAY = {
  pocket_sand:       { range: 6,  cooldown: 30, effects: [['blindness', 8, 0], ['slowness', 4, 1]], sound: 'dig.sand', durability: true },
  stink_ray:         { range: 10, cooldown: 40, effects: [['nausea', 10, 0], ['weakness', 10, 0], ['slowness', 5, 0]], sound: 'alexsmobs.skunk_spray', durability: true },
  blood_sprayer:     { range: 8,  cooldown: 30, effects: [['mining_fatigue', 10, 0], ['hunger', 8, 1]], sound: 'bubble.pop', durability: true },
  hemolymph_blaster: { range: 14, cooldown: 25, effects: [['poison', 5, 0], ['slowness', 5, 1]], damage: 3, sound: 'mob.slime.big', durability: true },
  squid_grapple:     { range: 16, cooldown: 50, effects: [], pull: 1.1, sound: 'mob.squid.ambient', durability: true },
};
// "scan" items: report nearby creatures on the action bar
const SCAN = {
  echolocator:     { radius: 64, label: 'Echolocation', family: 'alexsmobs' },
  endolocator:     { radius: 96, label: 'Endolocation', types: ['minecraft:enderman', 'alexsmobs:enderiophage', 'alexsmobs:endergrade', 'alexsmobs:cosmaw', 'alexsmobs:farseer', 'alexsmobs:spectre'] },
  pupfish_locator: { radius: 128, label: 'Pupfish locator', types: ['alexsmobs:devils_hole_pupfish'] },
};
// items that just play a sound when used
const SOUND = { maraca: { sound: 'alexsmobs.maraca', cooldown: 8 } };
// food effects after eating: [effect, seconds, amplifier]
const FOOD = {
  blobfish: [['nausea', 12, 0]],
  cosmic_cod: [['slow_falling', 20, 0]],
  rainbow_jelly: [['regeneration', 6, 0]],
  mosquito_repellent_stew: [['resistance', 60, 0]],
  raw_catfish: [['hunger', 8, 0]],
  lobster_tail: [['hunger', 6, 0]],
};

module.exports = { RAY, SCAN, SOUND, FOOD };
