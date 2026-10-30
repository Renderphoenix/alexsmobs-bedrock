# Alex's Mobs — Bedrock Edition Addon

Bedrock port of the Java mod Alex's Mobs. Two packs: `BP/` (behavior) and `RP/` (resource). Current version: 1.2.1.

## Layout
- `BP/entities`, `BP/spawn_rules`, `BP/loot_tables`, `BP/items`, `BP/recipes`, `BP/functions` — gameplay data.
- `BP/scripts/main.js` — Script API logic (egg laying/hatching, predator targeting, density caps). Uses stable @minecraft/server 1.10.0 (no experiments; manifests have product_type addon, so achievements stay enabled).
- `RP/entity/*.entity.json` — client entity defs (geometry, texture, animations, render controller).
- `RP/models/entity/*.geo.json`, `RP/animations`, `RP/animation_controllers`, `RP/textures/entity`.
- Reference-only, gitignored: `Actions And Stuff 1.9/`, Java jars/sources.

## Conventions
- Client entity files share a pattern: `walk` + `idle` animations, a `controller.animation.<mob>.move` controller, and a `look_at_target` animation that drives the head bone with `query.target_x/y_rotation`, weighted by movement speed.
- Geometry `texture_width/height` must match the UV layout used by the cubes (not necessarily the PNG's pixel size). A mismatch with the texture scales UVs wrongly.
- Model variants are separate geo/texture pairs (e.g. `underminer`, `underminer_dwarf`, `lobster_*`).
- JSON files are mostly machine-generated with wide indentation; keep edits minimal and match the surrounding style.
- No Python on this machine; use node or PowerShell for scripting.

## Releasing
1. Bump `header.version` in both `BP/manifest.json` and `RP/manifest.json` (keep them equal).
2. Build `alexsmobs-bedrock-v<version>.mcaddon`: a zip with `BP/` and `RP/` at the top level, forward-slash entry paths (build with .NET `ZipFile` in PowerShell; Git-Bash `tar` does not produce a valid zip). `*.mcaddon` is gitignored.
3. `update.bat` syncs BP/RP into the local Minecraft `development_*_packs` folders for testing.
4. `validate_animations.ps1` checks animation files.

## Known open issues
- `cave_centipede.geo.json` only contains the head; body segments and legs are missing (the `centipede_body/head/tail` models are player-shaped placeholders and nothing spawns them).
- Hostile purple-tunic villager-like mob reported headless — not yet identified.
- Underminer now uses `underminer_dwarf.png`; unverified in-game.
- Bald eagle / crow look-at animation is disabled while airborne; unverified in-game.
