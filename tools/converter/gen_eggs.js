// Thrown eggs (emu egg, cockroach ootheca): the same mechanism as vanilla's chicken egg - a throwable item that
// launches a projectile entity whose on_hit has a chance to spawn the baby creature.
'use strict';
const path = require('path');
const C = require('./config');
const U = require('./util');

const NS = C.NS;

function generateThrown(ctx) {
  for (const [item, t] of Object.entries(ctx.thrown)) {
    const id = `${NS}:${item}_projectile`;
    U.writeJson(path.join(C.BP, 'entities', NS, `${item}_projectile.json`), {
      format_version: '1.21.50',
      'minecraft:entity': {
        description: { identifier: id, is_summonable: true, is_spawnable: false },
        components: {
          'minecraft:type_family': { family: ['projectile', 'egg', item] },
          'minecraft:collision_box': { width: 0.25, height: 0.25 },
          'minecraft:conditional_bandwidth_optimization': { default_values: { max_dropped_ticks: 7, max_optimized_distance: 100.0, use_motion_prediction_hints: true } },
          'minecraft:physics': {},
          'minecraft:projectile': {
            angle_offset: 0.0,
            on_hit: {
              impact_damage: { damage: { min: 0, max: 0 }, knockback: true, destroy_on_hit: true },
              spawn_chance: { first_spawn_chance: 0.125, first_spawn_count: 1, spawn_baby: true, second_spawn_chance: 0.03125, second_spawn_count: 4, spawn_definition: `${NS}:${t.mob}` },
              particle_on_hit: { num_particles: 6, on_other_hit: true, on_entity_hit: true, particle_type: 'snowballpoof' },
              remove_on_hit: {},
            },
            gravity: 0.03,
            power: 1.5,
            isolated_physics: false,
          },
          'minecraft:pushable_by_entity': {},
          'minecraft:pushable_by_block': {},
        },
      },
    });
    U.writeJson(path.join(C.RP, 'entity', NS, `${item}_projectile.entity.json`), {
      format_version: '1.10.0',
      'minecraft:client_entity': {
        description: {
          identifier: id,
          materials: { default: 'snowball' },
          textures: { default: t.icon },
          geometry: { default: 'geometry.item_sprite' },
          render_controllers: ['controller.render.item_sprite'],
          animations: { flying: 'animation.actor.billboard' },
          scripts: { animate: ['flying'] },
        },
      },
    });
  }
  return Object.keys(ctx.thrown).length;
}

module.exports = { generateThrown };
