# Alex's Mobs — Bedrock Edition Addon

A comprehensive Minecraft Bedrock Edition port of the beloved Java mod **Alex's Mobs** by **Alexthe668**, **Carro1001**, and **Paint_Ninja**.

This addon brings an incredible variety of aesthetic, authentic, engaging, and unique creatures to Minecraft Bedrock Edition, complete with custom animations, models, sounds, loot tables, and realistic behaviors.

---

## Features

- **80+ Authentic Mobs**:
  - **Overworld Fauna**: Grizzly Bears, Gorillas, Capuchin Monkeys, Elephants, Rhinoceroses, Tigers, Kangaroos, Emus, Moose, Raccoons, Skunks, Tasmanian Devils, Anteaters, and more.
  - **Birds & Flying Creatures**: Bald Eagles, Blue Jays, Toucans, Hummingbirds, Shoebills, Sunbirds, Crows, Potoos, and Flies.
  - **Reptiles & Amphibians**: Crocodiles, Alligator Snapping Turtles, Caimans, Rattlesnakes, Komodo Dragons, Anacondas, Terrapins, Mudskippers, and Rain Frogs.
  - **Aquatic & Marine Life**: Orcas, Cachalot Whales, Giant Squids, Hammerhead Sharks, Frilled Sharks, Seals, Platypuses, Mantis Shrimps, Lobsters, Comb Jelly, Flying Fish, and Catfish.
  - **Nether & End Inhabitants**: Crimson Mosquitoes, Warped Toads, Straddlers, Stradpoles, Soul Vultures, Laviathans, Endergrades, and Enderiophages.
  - **Underground & Fantasy**: Cave Centipedes, Rocky Rollers, Underminers, Skreechers, Murmurs, and Farseers.
- **Natural Ecosystems & Biome Spawns**: Mobs spawn organically in their native biomes (savannas, jungles, deserts, oceans, swamps, nether forests, caves, and mountains).
- **Custom Items & Blocks**: Custom food items, drops, materials, weapons, attachables, and utility blocks.
- **Accurate Mob Behaviors & Diets**: Feeding, taming, breeding, and predator-prey dynamics tailored to match the original Java design.

---

## Useful Commands & Functions

Use these built-in functions in-game (cheats must be enabled):

- **Get all custom items** (326 items):
  ```
  /function give_all_items
  ```
- **Get all custom blocks** (148 blocks):
  ```
  /function give_all_blocks
  ```
- **Summon all authentic creatures** (89 mobs):
  ```
  /function summon_all_mobs
  ```
- **Command help**:
  ```
  /function help
  ```

---

## Repository Structure

```
alexsmobs/
├── BP/                                # Behavior Pack
│   ├── blocks/                        # Custom block definitions
│   ├── entities/                      # Entity behaviors, components & events
│   ├── functions/                     # Custom in-game mcfunction files
│   ├── items/                         # Custom item behaviors
│   ├── loot_tables/                   # Entity & block loot drop tables
│   ├── recipes/                       # Crafting & smelting recipes
│   ├── spawn_rules/                   # Natural biome spawning rules
│   └── manifest.json                  # BP metadata and dependencies
│
├── RP/                                # Resource Pack
│   ├── animations/                    # Skeletal mob animation files
│   ├── animation_controllers/         # State machines for animations
│   ├── attachables/                   # 3D handheld and worn item attachables
│   ├── entity/                        # Client-side render definitions & spawn eggs
│   ├── models/                        # Bedrock geometry models (entity & blocks)
│   ├── render_controllers/            # Render controllers for materials & textures
│   ├── texts/                         # Localization & display names
│   ├── textures/                      # Mob, item, and block textures
│   └── manifest.json                  # RP metadata
│
├── update.bat                         # Automatic sync script for Bedrock dev packs
└── README.md
```

---

## Installation & Development Setup

### Quick Setup with update.bat

To sync the latest Behavior Pack and Resource Pack directly into your Minecraft Bedrock development folders:

1. Simply run `update.bat` (double-click or run from command prompt):
   ```cmd
   update.bat
   ```
2. The script copies `BP` and `RP` into:
   - `development_behavior_packs\AlexsMobs_BP`
   - `development_resource_packs\AlexsMobs_RP`
3. Launch Minecraft Bedrock Edition, create or edit a world, and activate **Alex's Mobs** in both Resource Packs and Behavior Packs.

### Manual Installation

1. Copy the **`BP`** folder into your `development_behavior_packs` directory.
2. Copy the **`RP`** folder into your `development_resource_packs` directory.
3. Open Minecraft Bedrock Edition and activate the packs on your world.

### Important: Enable Experimental Features

In your world settings, make sure to enable:
- *Holiday Creator Features*
- *Custom Biomes*
- *Upcoming Creator Features*
- *Molang Features*

---

## Credits & Licensing

- **Original Mod Authors**:
  - **Alexthe668** (Lead Developer & Creator)
  - **Carro1001** (Contributor)
  - **Paint_Ninja** (Contributor)
- **Original Java Mod**: [Alex's Mobs on GitHub](https://github.com/AlexModGuy/AlexsMobs) | [CurseForge Page](https://www.curseforge.com/minecraft/mc-mods/alexs-mobs)
- **License**: This project is licensed under the **GNU Lesser General Public License v3.0 (LGPL-3.0)** in accordance with the original mod license.

---

*Enjoy the wild adventures with Alex's Mobs on Bedrock!*
