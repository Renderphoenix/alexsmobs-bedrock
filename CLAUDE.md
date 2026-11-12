# Alex's Mobs 2 — Bedrock Edition Add-on

A fresh Bedrock port of the Java mod Alex's Mobs (1.22.9 for 1.20.1), **generated** from the mod jar by the
converter in `tools/converter/`. Do not hand-edit `addon/`: change the converter (or `tools/converter/mobs.js`)
and rebuild. Current version: 2.1.0 (`tools/converter/pack.json` holds the version and the pack UUIDs).
Achievement-friendly: `product_type: addon`, stable `@minecraft/server` 2.4.0, no experiments, `pbr` capability.

## Layout
- `addon/BP`, `addon/RP` — the generated packs (namespace `alexsmobs:`, folders `*/alexsmobs/`).
- `tools/converter/` — Java jar → Bedrock pipeline (node, no npm deps). Entry: `build.js`.
- `tools/preview/` — offline renderer: `render_preview.js` (geometry + texture + animation frame → PNG, evaluates
  Molang), `anim_sheet.js` (one animation per mob on a contact sheet).
- `legacy/v1/` — the old hand-made 1.2.x port. Reference only; same `alexsmobs:` ids, never enable both.
- `references/` (gitignored) — Actions & Stuff pack, study only. `renders/` — trailer renders/subtitles.
- `.tools/` (gitignored) — extracted jar, javap cache, `extract/mod.json`, `extract/build_report.json`, previews.
- `dist/` (gitignored) — built `.mcaddon` files.
- Java jar: `../forge neoforge/alexsmobs-1.22.9.jar` (override with env `AM_JAR`). JDK 21 `javap` must be on PATH.
- Vanilla reference: `../bedrock-samples-v1.26.50.4-full` (env `BEDROCK_SAMPLES`), used by `schema_scan.js`.

## Build / test
- `.\build.ps1` — convert, validate, package `dist/alexsmobs2-v<version>.mcaddon` (forward-slash zip via .NET).
  `-NoConvert` packages as-is, `-Sync` also runs `update.bat`. Run `cmd /c <full path>\update.bat` from PowerShell.
- `node tools/converter/build.js [mob ...]` — regenerate (all, or only some mobs without cleaning).
- `node tools/converter/validate.js` — must print `OK - no errors`. Checks every reference plus (validate_deep.js)
  filter tests/operators/damage causes/components against vanilla, component value shapes, doc parameter names
  (warning only: the bundled docs lag the game), Molang variables read but never assigned, `q.property()` names,
  empty `bones`, empty controller `animations`, animated bones missing from the geometry, loot/recipe item ids.
- `node tools/converter/schema_scan.js` — rebuilds `vanilla_schema.json` from bedrock-samples (rerun after changing
  the samples folder). `vanilla_items.json` lists item ids seen in vanilla files.
- `node tools/converter/test_models.js` — interpreter sweep over all 124 Java model classes.
- Previews: `node tools/preview/render_preview.js out.png grizzly_bear tiger@animation.alexsmobs.tiger.walk@0.4`,
  `node tools/preview/anim_sheet.js out.png walk,swim,fly 0.25` (YAW/PITCH env for the camera).
- Blockbench MCP (when connected): `risky_eval` can load a geo + animation file into a Bedrock Entity project
  (`newProject(Formats.bedrock); Codecs.bedrock.parse(json, path); Animator.loadFile({path, name, content})`) — Blockbench's
  own parser then confirms every animation loads. All 95 files / 1185 animations were checked this way.
- `update.bat` — sync `addon/` into `development_*_packs/AlexsMobs2_*`.
- No Python on this machine; use node or PowerShell. Avoid `\b`/`\d`/`\.` inside `node -e "..."` (the shell layer
  mangles backslashes, it even writes literal backspaces) — write a script file or use the Edit tool.

## How the converter works (tools/converter)
- `javap.js` / `scan.js` / `interp.js` / `entsym.js` / `molang.js` read the Java mod: a symbolic JVM interpreter over
  javap output builds the Citadel models (bones/cubes/UVs) and records the mod's **gait data** (walk/swing/flap/bob/
  chain/faceTarget calls with speed, degree, phase and the guard condition they run under) plus the compiled pose
  channels and the `ModelAnimator` keyframes. `extract.js` pulls registry, attributes, goals, sounds, spawn data.
- **Animations are our own** (`motion.js`, `gen_client.js`): gaits are filtered per state (ground / fly / swim) by
  evaluating their guards, then re-authored as clean keyframed loops: `idle` (+ our `breathe`), `walk`/`run`
  (speed-scaled with `anim_time_update`), `swim`, `fly`. Java sit / sleep / stand postures become static pose
  animations. Plus `look`, `baby` (bigger head), `hurt`, two `death_*` (hold last frame), generic idle actions
  (`anims.js`), Java attack/idle keyframes, a generic bite when a hostile has none, slither/hop/hover fallbacks.
  Controllers: `move` (state machine with blend_transition), `idles` (random action after 3-9 s calm), `attack`
  (on `v.attack_time`), `hurt`, `death`. Every variable they read is assigned in `pre_animation`.
- `gen_mobs.js` + `mobs.js` (per-mob spec) write geometry, textures, BP entity, loot; `spawns.js` = our spawn rules
  (rarity tiers, light/time rules, groups with babies, Bedrock-only blocks); `gen_loot.js` = our drops for the 37 mobs
  the Java mod gives none; `gen_parts.js` multipart chains + murmur head.
- Eggs (Bedrock style): egg blocks (`gen_blocks.js`) have a `alexsmobs:hatch` crack state, `minecraft:tick` and the
  script component `alexsmobs:egg` (cracks, hatches a baby, trampling); crocodile/caiman/platypus/terrapin get the
  vanilla turtle mechanism (`causes_pregnancy` → timer → `behavior.lay_egg` with `egg_type`); emu and cockroach drop
  throwable eggs (`minecraft:spawn_entity` + `throwable`/`projectile` items with a projectile entity whose `on_hit.spawn_chance`
  hatches a baby, `gen_eggs.js`). Spawn eggs are the vanilla way: `spawn_egg` colours on the client entity.
- `flap.js`: our bird flight - per bird a wings-out posture + wingbeat axis measured in Blockbench (mirrored x,-y,-z),
  applied to `fly`. `gen_client.js` `RENDER_SCALE`: the Java renderers' `PoseStack.scale` constants as client
  `scripts.scale` (elephant 1.1, orca 1.3, raccoon 0.75...). Mimic octopus has no overlay (Java tints it only while
  mimicking).
- `gen_items.js` (+ `abilities.js`: ray items, scans, food effects, my own designs), `gen_recipes.js` (63+ Java recipes;
  furnace/smoker/campfire merged), `armor.js`, `gen_blocks.js`, `gen_pack.js` (manifests, 17 languages, sounds),
  `biomes.js`, `gen_script.js` (BP/scripts/main.js: chains, buckets, egg component, item abilities, food effects).

## Trailer (trailer/)
Built with the `minecraft-addon-trailer` skill: `gen_shots.py` writes `shots/*.py` (41 shots, music "Heroic Age" by
Kevin MacLeod, CC BY 4.0 - keep the credit), `scripts/` is the skill toolkit patched for this layout (+ `am.py`
helpers, `par.py` parallel renders), `bbrun_am.js` bakes poses (drives `v.jump_rotation` for the kangaroo hop).
Work files, frames and MP4s live on H:/AlexsMobs2_Trailer (`trailer.json`). Review with last-frame stills only.

## Lessons from the game's Content Log (keep these checks in validate_deep.js)
Filter `is_creative` and damage cause `in_wall` do not exist; `minecraft:terracotta` is `minecraft:hardened_clay`;
`minecraft:fire_immune` is `{}`; `minecraft:leashable` is `{}`; animation key `hold_on_last_frame` is a `loop` value;
an empty `"bones": {}` rejects the animation (and the whole file); a variable read but never assigned fails the
expression; two geometries of one entity must carry identical `armor_offset.default_neck` locators.

## Not ported yet (follow-ups)
Ranged attacks/projectiles (straddler, mimicube, capuchin darts, skunk spray…), riding/saddles, falconry/lasso/
straddleboard/dimensional carver items, banner patterns, bison upgrade + mimicream repair recipes, End Pirate blocks,
the void worm beak block, armour model for the elytra. Item abilities are our own simplified versions (see
`abilities.js`). The 2.1.0 build is validated offline and in Blockbench; it still needs an in-game pass.
