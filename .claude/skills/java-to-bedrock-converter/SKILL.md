---
name: java-to-bedrock-converter
description: Convert a Minecraft Java (Forge/NeoForge) mod jar into a Bedrock add-on with this repo's converter - models from compiled Citadel/LayerDefinition model classes, setupAnim compiled to Molang, Citadel keyframe animations, textures, items, armour, blocks, spawns, loot, sounds and languages - and verify the result offline. Use whenever the user wants to port, re-port, fix or extend Alex's Mobs 2 (addon/), add or tune a mob, fix a model/texture/animation/spawn/item that came from the Java mod, or convert another Java mod's mobs to Bedrock, even if they only say "port this mob", "the X looks wrong", "make the animations match Java" or "convert the jar".
---

# Java mod → Bedrock add-on converter

Alex's Mobs 2 is **generated**. The fix for a wrong mob is almost always in `tools/converter/`, never a hand edit of
`addon/` (it is wiped on every full build). Read `CLAUDE.md` first for the layout.

## The pipeline

1. **Extract** (`node tools/converter/extract.js`, run automatically when `.tools/extract/mod.json` is missing).
   Unzips the jar to `.tools/jar`, disassembles classes with `javap` (cached in `.tools/javap`) and writes `mod.json`:
   registry ids, hitbox, category, attributes, goals, Citadel `Animation.create(n)` lengths, sounds, renderer
   textures/models/layers, spawn biomes (`DefaultBiomes`), weights (`AMConfig`), group sizes, spawn-egg colours.
   Delete `mod.json` after changing `extract.js`.
2. **Generate** (`node tools/converter/build.js` or `build.js <mob> ...` for a quick partial run).
3. **Validate** (`node tools/converter/validate.js`) — must print `OK - no errors` before packaging.
4. **Look at it** with the offline renderer (below). Blockbench MCP may be down; the renderer needs nothing.
5. **Package / sync**: `.\build.ps1` (→ `dist/alexsmobs2-v<ver>.mcaddon`), `.\build.ps1 -Sync` or `update.bat`.

## Verifying visually (do this after any model/animation change)

```
node tools/preview/render_preview.js .tools/previews/x.png grizzly_bear tiger --cols 4 --size 260
node tools/preview/render_preview.js .tools/previews/x.png grizzly_bear@animation.alexsmobs.grizzly_bear.maul@0.3
VARS='{"v.ls":2.2,"v.lsa":1}' node tools/preview/render_preview.js .tools/previews/walk.png tiger@animation.alexsmobs.tiger.pose@0
VARS='{"v.p_sitprogress":10}' ...                 # sit pose   VARS='{"v.am_flying":1,"v.p_flyprogress":5}' # flight
```
Then Read the PNG. `id.s0` renders part segment geometries (`anaconda_part.s1`). Check: model upright and facing
-Z, textures not scrambled, limbs move the right way, nothing detached.

## Fixing / tuning a mob

- **Per-mob spec**: `tools/converter/mobs.js` — `kind` (land | water | whale | semi | flyer | hover | lava |
  lavawalker | climber), `temper` (passive | neutral | hostile | predator | skittish), `player`, `prey` (Bedrock
  families), `tex` / `variants` / `variantWeights` / `variantModels`, `states.sleep|angry` textures, `glow`,
  `overlay`, `baby` model + `babyTex`, `nocturnal`, `alwaysFly`, `spawnDim`, `fix` (extra static rotations, e.g.
  giant squid head in water), `parts` (segment chain), `follower` (murmur head), `tagNames`, `breedItems`.
- **Wrong pose variable** (a Java field/getter that should drive a pose): `entsym.js` — `SRG` table for vanilla
  obfuscated names, `STATES` keyword → Molang for booleans and progress targets. Progress fields become
  `v.p_<name>` ramped 1/tick toward the state in `pre_animation` (max = the divisor seen in `progressRotationPrev`).
- **Behaviour components**: `behavior()` in `gen_mobs.js`. Vanilla references for component shapes live in
  `../bedrock-samples-v1.26.50.4-full/behavior_pack/entities` (strip `//` comments before JSON.parse).
- **Spawns**: `biomes.js` maps Java tags/registry names to Bedrock tags; only tags present in `biome_tags.json`
  (Mojang's biome files) are emitted. Pools are OR-ed, entries in a pool AND-ed, `negate` → `operator: "!="`.
- **Items / armour / blocks**: `gen_items.js`, `armor.js`, `gen_blocks.js`. Item properties come from the
  registry lambdas, resolved through `javap -v` BootstrapMethods.

## Conventions that are easy to get wrong

- Java model space is y-down with relative pivots; Bedrock: `(x, 24 − y, z)`, absolute pivots, child pivots are the
  sum of parent offsets. Rotations: radians → degrees, **same sign** for x, y, z (verified against Blockbench's
  modded-entity and Bedrock codecs). Animation position channel = `(x, −y, z)`.
- Molang trig takes degrees: Java `Mth.cos(x)` → `math.cos(x * 57.29578)`.
- Citadel `walk/swing/flap` = `cos(f*speed + offset) * degree * f1 + weight * f1` on X/Y/Z (negated when
  `invert`); `bob` moves rotationPointY; `chainWave/Swing/Flap` offset = `rootOffset*π/(2n)` per index;
  `ModelAnimator` keyframes interpolate with `sin(t·π/2)` easing, `setStaticKeyframe` holds, `resetKeyframe` returns
  to rest. `limbSwing` → `q.modified_distance_moved`, `limbSwingAmount` → `q.modified_move_speed`,
  `ageInTicks` → `q.life_time*20`, `netHeadYaw/headPitch` → `q.target_y/x_rotation`.
- Geometry `texture_width/height` = the Java model's `texWidth/texHeight` (UV space), not the PNG size.
- javap output has `\r\r\n` line ends; strip `\r`. Constructor-time `switch` on enums goes through
  `$SwitchMap` arrays — the interpreter returns `switchCase` for those (multipart models).
- Shell one-liners: `node -e "..."` mangles `\b`, `\d`, `\.` — put regex code in a file or use the Edit tool.
- Bedrock death tilt is applied by the engine; death animations only fold limbs/head/tail within ~1 s.

## Porting another Java mod

The interpreter understands Citadel `AdvancedEntityModel`/`AdvancedModelBox` and vanilla `LayerDefinition`
(armour). For a new mod: point `config.js` (`JAR`, `NS`, `PKG`) at it, adapt `extract.js` (registry class names,
attribute builder, config/spawn classes) and write a `mobs.js` spec. GeckoLib mods ship `.geo.json` +
`.animation.json` already in Bedrock format — copy and remap them instead of interpreting bytecode. Run
`test_models.js` first: every model should report bones/cubes and no WARN.

## Done means

`validate.js` OK, previews look right, `build.ps1` packaged, and the report says plainly what is still not ported
(see the "Not ported yet" list in `CLAUDE.md`) and that in-game testing is still needed.
