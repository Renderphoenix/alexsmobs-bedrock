# Alex's Mobs 2 — Bedrock Edition Add-on

A fresh Bedrock port of the Java mod Alex's Mobs (1.22.9 for 1.20.1), **generated** from the mod jar by the
converter in `tools/converter/`. Do not hand-edit `addon/`: change the converter (or `tools/converter/mobs.js`)
and rebuild. Current version: 2.0.0 (`tools/converter/pack.json` holds the version and the pack UUIDs).

## Layout
- `addon/BP`, `addon/RP` — the generated packs (namespace `alexsmobs:`, folders `*/alexsmobs/`).
- `tools/converter/` — Java jar → Bedrock pipeline (node, no npm deps). Entry: `build.js`.
- `tools/preview/` — offline renderer (geometry + texture + animation frame → PNG contact sheet, evaluates Molang).
- `legacy/v1/` — the old hand-made 1.2.x port (BP/RP + its scripts). Reference only; same `alexsmobs:` ids, so never
  enable both on one world.
- `references/` (gitignored) — Actions & Stuff pack, study only. `renders/` — trailer renders/subtitles.
- `.tools/` (gitignored) — extracted jar, javap cache, `extract/mod.json`, `extract/build_report.json`, previews.
- `dist/` (gitignored) — built `.mcaddon` files.
- Java jar: `../forge neoforge/alexsmobs-1.22.9.jar` (override with env `AM_JAR`). JDK 21 `javap` must be on PATH.

## Build / test
- `.\build.ps1` — convert, validate, package `dist/alexsmobs2-v<version>.mcaddon` (forward-slash zip via .NET).
  `-NoConvert` packages as-is, `-Sync` also runs `update.bat`.
- `node tools/converter/build.js [mob ...]` — regenerate (all, or only some mobs without cleaning).
- `node tools/converter/validate.js` — every geometry/texture/animation/controller/sound/item/loot reference, Molang parens.
- `node tools/converter/test_models.js` — interpreter sweep over all 124 Java model classes.
- `node tools/preview/render_preview.js out.png grizzly_bear tiger@animation.alexsmobs.tiger.paw_r@0.4 --cols 4`
  (`VARS='{"v.ls":2,"v.lsa":1,"v.p_sitprogress":10}'` drives Molang poses).
- `update.bat` — sync `addon/` into `development_*_packs/AlexsMobs2_*`.
- No Python on this machine; use node or PowerShell. Avoid `\b`/`\d` inside `node -e "..."` one-liners (the shell
  layer mangles backslashes) — write a script file or use the Edit tool.

## How the converter works (tools/converter)
- `javap.js` parses `javap -c -p -constants` output (cached in `.tools/javap`). `scan.js` is a linear call scanner.
- `interp.js` is a symbolic JVM interpreter for Citadel models: runs `<init>` → bones/cubes; runs `setupAnim`
  symbolically → Molang per bone channel (unknown branches fork and merge as `cond ? a : b`); records `ModelAnimator`
  keyframes from `animate()`. `entsym.js` maps entity getters/fields to Molang (`sitProgress` → `v.p_sitprogress`
  ramped in pre_animation; SRG names like `m_20069_` → `q.is_in_water`).
- Coordinates: Bedrock = (x, 24 − y, z); Java radians → Bedrock degrees, same sign (checked against Blockbench codecs).
  Animation position = (x, −y, z). Block models: x mirrored around the block centre, up/down face UVs flipped.
- `extract.js` → `.tools/extract/mod.json`: registry (ids, hitbox, category), attributes, goals, Citadel animation
  lengths, sounds, renderer textures, spawn biomes (`DefaultBiomes`), weights (`AMConfig`), group sizes, egg colours.
- `gen_mobs.js` (+ `mobs.js` per-mob spec: movement kind, temper, prey, textures/variants, glow) writes geometry,
  animations (pose, Java keyframes, 2 death variants, hurt, idle actions), controllers, client entity, render
  controllers, BP entity, spawn rule, loot. `gen_parts.js` = multipart chains (anaconda, bone serpent, centipede,
  void worm) and the murmur head; `gen_script.js` writes `BP/scripts/main.js` (attack anims on hit, chain follow,
  damage forwarding, bucket catching, egg hatching). `gen_items.js`, `armor.js` (LayerDefinition armour →
  attachables), `gen_blocks.js`, `gen_pack.js` (manifests, 17 languages, sounds), `biomes.js` (Java biome tags →
  Bedrock tags, validated against `biome_tags.json`).
- Script API: `@minecraft/server` 2.4.0 stable, no experiments, `product_type: addon`.

## Not ported yet (follow-ups)
Ranged attacks/projectiles (straddler, mimicube, capuchin darts, skunk spray…), riding/saddles, most special item
abilities (blood sprayer, stink ray, squid grapple, falconry, echolocator…), End Pirate structure blocks, the
void worm beak block, armour models for elytra. Nothing in `addon/` has been tested in-game yet.
