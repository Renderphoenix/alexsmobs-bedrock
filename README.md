# Alex's Mobs — Bedrock Edition Addon

A comprehensive Minecraft Bedrock Edition port of the beloved Java mod **Alex's Mobs** by **Alexthe668**, **Carro1001**, and **Paint_Ninja**.

This addon brings an incredible variety of aesthetic, authentic, engaging, and unique creatures to Minecraft Bedrock Edition, complete with custom animations, models, sounds, loot tables, and realistic behaviors.

---

## 🌟 Features

- **80+ Authentic Mobs**:
  - **Overworld Fauna**: Grizzly Bears, Gorillas, Capuchin Monkeys, Elephants, Rhinoceroses, Tigers, Kangaroos, Emus, Moose, Raccoons, Skunks, Tasmanian Devils, Anteaters, and more.
  - **Birds & Flying Creatures**: Bald Eagles, Blue Jays, Toucans, Hummingbirds, Shoebills, Sunbirds, Crows, Potoos, and Flies.
  - **Reptiles & Amphibians**: Crocodiles, Alligator Snapping Turtles, Caimans, Rattlesnakes, Komodo Dragons, Anacondas, Terrapins, Mudskippers, and Rain Frogs.
  - **Aquatic & Marine Life**: Orcas, Cachalot Whales, Giant Squids, Hammerhead Sharks, Frilled Sharks, Seals, Platypuses, Mantis Shrimps, Lobsters, Comb Jelly, Flying Fish, and Catfish.
  - **Nether & End Inhabitants**: Bone Serpents, Crimson Mosquitoes, Warped Toads, Straddlers, Stradpoles, Soul Vultures, Laviathans, Endergrades, and Enderiophages.
  - **Underground & Fantasy**: Cave Centipedes, Rocky Rollers, Underminers, Skreechers, Murmurs, and Farseers.
- **Natural Ecosystems & Biome Spawns**: Mobs spawn organically in their native biomes (savannas, jungles, deserts, oceans, swamps, nether forests, caves, and mountains).
- **Custom Items & Blocks**: Custom food items, drops, materials, weapons, attachables, and utility blocks.
- **Accurate Mob Behaviors & Diets**: Feeding, taming, breeding, and predator-prey dynamics tailored to match the original Java design.

---

## 📁 Repository Structure

```
alexsmobs/
├── BP/                                # Behavior Pack
│   ├── blocks/                        # Custom block definitions
│   ├── entities/                      # Entity behaviors, components & events
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
└── README.md
```

---

## 🚀 Installation Guide

### For Windows 10/11 (Minecraft Bedrock):

1. **Clone or Download** this repository.
2. Press `Win + R`, paste the following path, and hit `Enter`:
   ```cmd
   %localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang
   ```
3. Copy the **`BP`** folder into the `development_behavior_packs` folder (rename to `AlexsMobs_BP` if desired).
4. Copy the **`RP`** folder into the `development_resource_packs` folder (rename to `AlexsMobs_RP` if desired).
5. Open Minecraft Bedrock Edition, create or edit a world, and activate **Alex's Mobs** in both Resource Packs and Behavior Packs.
6. Enable **Beta / Experimental Features** in your world settings:
   - *Holiday Creator Features*
   - *Custom Biomes*
   - *Upcoming Creator Features*
   - *Molang Features*

---

## 📜 Credits & Licensing

- **Original Mod Authors**:
  - **Alexthe668** (Lead Developer & Creator)
  - **Carro1001** (Contributor)
  - **Paint_Ninja** (Contributor)
- **Original Java Mod**: [Alex's Mobs on GitHub](https://github.com/AlexModGuy/AlexsMobs) | [CurseForge Page](https://www.curseforge.com/minecraft/mc-mods/alexs-mobs)
- **License**: This project is licensed under the **GNU Lesser General Public License v3.0 (LGPL-3.0)** in accordance with the original mod license.

---

*Enjoy the wild adventures with Alex's Mobs on Bedrock! 🐾*

