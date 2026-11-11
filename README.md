# Alex's Mobs 2 — Bedrock Edition

A brand-new Bedrock port of **Alex's Mobs** by **Alexthe668**, **Carro1001** and **Paint_Ninja**.
Instead of rebuilding each creature by hand, this port is **converted straight from the Java mod**: a converter
reads the mod's compiled model code, so every model, texture mapping and Java animation is the original one.

## What's inside (v2.0.0)

- **90 creatures** with their exact Java models (bones, cubes, UVs) and textures, including variants
  (lobster colours, capuchin coats, white tigers, albino cachalots, terrapin patterns, …) and glowing eye layers.
- **Java animations**: walk/swim/fly cycles, look-at, sitting, standing, sleeping and flying poses are compiled from
  the mod's `setupAnim` code; attack animations (maul, swipes, kicks, punches, lunges, gores, …) are the mod's own
  keyframes, played when the creature hits something.
- **New Bedrock animations**: two random death animations per creature, hurt flinches, and idle actions
  (looking around, sniffing, shaking off, wing stretches, tail swishes, plus the mod's own idles like the elephant
  trumpet, gorilla chest pound and gazelle ear flick).
- **Multipart creatures**: anacondas, bone serpents, cave centipedes and void worms are real segment chains that follow
  the head and pass damage to it; the murmur keeps its floating head.
- **Behaviour from the mod**: health, speed, damage, armour, follow range, predators and prey (from the mod's target
  tags), breeding/taming/tempt foods (from the mod's item tags), babies, swimming/amphibious/flying/hovering/lava
  movement, sleep schedules (nocturnal mobs sleep by day), angry textures.
- **Spawning from the mod's defaults**: biome rules, spawn weights and group sizes come from Alex's Mobs' own config.
- **137 items** (foods, materials, buckets that place creatures, armour with its custom 3D models, weapons) and
  **32 blocks** (purpur planks set, bison fur, banana slug slime, rainbow glass, eggs that hatch, …).
- **571 original sounds** and **17 languages** taken from the mod's translations.

No experimental toggles are needed (stable Script API 2.4.0, achievement-friendly).

## Install

- Double-click `dist/alexsmobs2-v2.0.0.mcaddon` (after building), or run `update.bat` to copy `addon/BP` and
  `addon/RP` into Minecraft's development pack folders, then enable **Alex's Mobs 2** (BP + RP) on a world.
- Do not enable the old 1.2.x Alex's Mobs packs on the same world: both use the `alexsmobs:` identifiers.

Commands (cheats on): `/function alexsmobs/summon_all`, `/function alexsmobs/give_items`,
`/function alexsmobs/kill_all`, `/function alexsmobs/help`.

## Building from the Java mod

Needs node and a JDK (for `javap`). The jar is read from `../forge neoforge/alexsmobs-1.22.9.jar`
(or `AM_JAR`).

```
.\build.ps1            # convert, validate, package dist\alexsmobs2-v<version>.mcaddon
.\build.ps1 -Sync      # ...and copy into the development pack folders
```

See `CLAUDE.md` for how the converter works and `.claude/skills/java-to-bedrock-converter/SKILL.md` for the
step-by-step porting workflow.

## Repository

```
addon/BP, addon/RP     generated packs (do not hand-edit)
tools/converter/       Java jar -> Bedrock converter (node)
tools/preview/         offline model/animation renderer for checks
legacy/v1/             the previous hand-made port (1.2.x), kept for reference
renders/               trailer renders and subtitles
```

## Credits & licensing

- Original mod: **Alexthe668**, **Carro1001**, **Paint_Ninja** —
  [GitHub](https://github.com/AlexModGuy/AlexsMobs) · [CurseForge](https://www.curseforge.com/minecraft/mc-mods/alexs-mobs)
- Bedrock port: Renderphoenix & devsuki. Models, textures, sounds and translations belong to the original authors;
  see `LICENSE`.
