import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";

const ATTACK_FAMILIES = new Set([
    "alexsmobs:tiger",
    "alexsmobs:crocodile",
    "alexsmobs:caiman",
    "alexsmobs:grizzly_bear",
    "alexsmobs:elephant",
    "alexsmobs:rhinoceros",
    "alexsmobs:gorilla",
    "alexsmobs:komodo_dragon",
    "alexsmobs:bison",
    "alexsmobs:moose",
    "alexsmobs:tarantula_hawk",
    "alexsmobs:tasmanian_devil",
    "alexsmobs:hammerhead_shark",
    "alexsmobs:frilled_shark",
    "alexsmobs:orca",
    "alexsmobs:crimson_mosquito",
    "alexsmobs:dropbear",
    "alexsmobs:warped_mosco"
]);

const BIRD_TYPES = new Set([
    "alexsmobs:sunbird",
    "alexsmobs:bald_eagle",
    "alexsmobs:toucan",
    "alexsmobs:hummingbird",
    "alexsmobs:crow",
    "alexsmobs:shoebill",
    "alexsmobs:seagull",
    "alexsmobs:blue_jay",
    "alexsmobs:potoo",
    "alexsmobs:soul_vulture"
]);

const CROCODILE_PREY = [
    "minecraft:sheep",
    "minecraft:cow",
    "minecraft:pig",
    "minecraft:chicken",
    "minecraft:rabbit",
    "minecraft:goat",
    "minecraft:frog",
    "minecraft:salmon",
    "minecraft:cod",
    "alexsmobs:gazelle",
    "alexsmobs:platypus",
    "alexsmobs:rain_frog"
];

const TIGER_PREY = [
    "minecraft:sheep",
    "minecraft:cow",
    "minecraft:pig",
    "minecraft:rabbit",
    "minecraft:goat",
    "alexsmobs:gazelle",
    "alexsmobs:kangaroo",
    "alexsmobs:platypus"
];

const EGG_HATCH_MAP = {
    "alexsmobs:crocodile_egg": { mob: "alexsmobs:crocodile", count: 1 },
    "alexsmobs:two_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 2 },
    "alexsmobs:three_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 3 },
    "alexsmobs:four_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 4 },
    "alexsmobs:slightly_cracked_crocodile_egg": { mob: "alexsmobs:crocodile", count: 1 },
    "alexsmobs:two_slightly_cracked_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 2 },
    "alexsmobs:three_slightly_cracked_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 3 },
    "alexsmobs:four_slightly_cracked_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 4 },
    "alexsmobs:very_cracked_crocodile_egg": { mob: "alexsmobs:crocodile", count: 1 },
    "alexsmobs:two_very_cracked_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 2 },
    "alexsmobs:three_very_cracked_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 3 },
    "alexsmobs:four_very_cracked_crocodile_eggs": { mob: "alexsmobs:crocodile", count: 4 },
    "alexsmobs:caiman_egg": { mob: "alexsmobs:caiman", count: 1 },
    "alexsmobs:two_caiman_eggs": { mob: "alexsmobs:caiman", count: 2 },
    "alexsmobs:three_caiman_eggs": { mob: "alexsmobs:caiman", count: 3 },
    "alexsmobs:four_caiman_eggs": { mob: "alexsmobs:caiman", count: 4 },
    "alexsmobs:slightly_cracked_caiman_egg": { mob: "alexsmobs:caiman", count: 1 },
    "alexsmobs:two_slightly_cracked_caiman_eggs": { mob: "alexsmobs:caiman", count: 2 },
    "alexsmobs:three_slightly_cracked_caiman_eggs": { mob: "alexsmobs:caiman", count: 3 },
    "alexsmobs:four_slightly_cracked_caiman_eggs": { mob: "alexsmobs:caiman", count: 4 },
    "alexsmobs:very_cracked_caiman_egg": { mob: "alexsmobs:caiman", count: 1 },
    "alexsmobs:two_very_cracked_caiman_eggs": { mob: "alexsmobs:caiman", count: 2 },
    "alexsmobs:three_very_cracked_caiman_eggs": { mob: "alexsmobs:caiman", count: 3 },
    "alexsmobs:four_very_cracked_caiman_eggs": { mob: "alexsmobs:caiman", count: 4 },
    "alexsmobs:terrapin_egg": { mob: "alexsmobs:terrapin", count: 1 },
    "alexsmobs:two_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 2 },
    "alexsmobs:three_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 3 },
    "alexsmobs:four_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 4 },
    "alexsmobs:slightly_cracked_terrapin_egg": { mob: "alexsmobs:terrapin", count: 1 },
    "alexsmobs:two_slightly_cracked_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 2 },
    "alexsmobs:three_slightly_cracked_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 3 },
    "alexsmobs:four_slightly_cracked_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 4 },
    "alexsmobs:very_cracked_terrapin_egg": { mob: "alexsmobs:terrapin", count: 1 },
    "alexsmobs:two_very_cracked_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 2 },
    "alexsmobs:three_very_cracked_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 3 },
    "alexsmobs:four_very_cracked_terrapin_eggs": { mob: "alexsmobs:terrapin", count: 4 },
    "alexsmobs:platypus_egg": { mob: "alexsmobs:platypus", count: 1 },
    "alexsmobs:two_platypus_eggs": { mob: "alexsmobs:platypus", count: 2 },
    "alexsmobs:three_platypus_eggs": { mob: "alexsmobs:platypus", count: 3 },
    "alexsmobs:four_platypus_eggs": { mob: "alexsmobs:platypus", count: 4 },
    "alexsmobs:slightly_cracked_platypus_egg": { mob: "alexsmobs:platypus", count: 1 },
    "alexsmobs:two_slightly_cracked_platypus_eggs": { mob: "alexsmobs:platypus", count: 2 },
    "alexsmobs:three_slightly_cracked_platypus_eggs": { mob: "alexsmobs:platypus", count: 3 },
    "alexsmobs:four_slightly_cracked_platypus_eggs": { mob: "alexsmobs:platypus", count: 4 },
    "alexsmobs:very_cracked_platypus_egg": { mob: "alexsmobs:platypus", count: 1 },
    "alexsmobs:two_very_cracked_platypus_eggs": { mob: "alexsmobs:platypus", count: 2 },
    "alexsmobs:three_very_cracked_platypus_eggs": { mob: "alexsmobs:platypus", count: 3 },
    "alexsmobs:four_very_cracked_platypus_eggs": { mob: "alexsmobs:platypus", count: 4 },
    "alexsmobs:triops_eggs": { mob: "alexsmobs:triops", count: 2 }
};

const trackedEggs = new Map();

function trackEgg(dimension, location, blockTypeId) {
    const key = `${dimension.id}_${location.x}_${location.y}_${location.z}`;
    if (!trackedEggs.has(key)) {
        trackedEggs.set(key, {
            dimensionId: dimension.id,
            location: { x: location.x, y: location.y, z: location.z },
            blockTypeId,
            hatchTick: system.currentTick + Math.floor(Math.random() * 400 + 400),
            cracked: false
        });
    }
}

function handleScriptStatus(player) {
    try {
        const overworld = world.getDimension("overworld");
        let mobCount = 0;
        if (overworld) {
            const allEntities = overworld.getEntities();
            for (const ent of allEntities) {
                if (ent.typeId && ent.typeId.startsWith("alexsmobs:")) {
                    mobCount++;
                }
            }
        }
        const message = `§a[Alex's Mobs] §fScript Engine: §aONLINE & WORKING§f! Tick: §e${system.currentTick}§f, Active Alex's Mobs: §b${mobCount}, Tracked Eggs: §e${trackedEggs.size}`;
        if (player && player.sendMessage) {
            player.sendMessage(message);
        } else {
            world.sendMessage(message);
        }
    } catch (e) {
        world.sendMessage(`§a[Alex's Mobs] §fScript Engine: §aONLINE & WORKING§f! Tick: §e${system.currentTick}`);
    }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "alexsmobs:test" || event.id === "alexsmobs:status" || event.id === "alexsmobs:ping") {
        handleScriptStatus(event.sourceEntity);
    }
});

world.beforeEvents.chatSend.subscribe((event) => {
    const msg = event.message.trim().toLowerCase();
    if (msg === "!test" || msg === "!alexsmobs" || msg === "!status") {
        event.cancel = true;
        system.run(() => {
            handleScriptStatus(event.sender);
        });
    }
});

world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) {
        system.runTimeout(() => {
            try {
                if (event.player && event.player.isValid()) {
                    event.player.sendMessage("§6[Alex's Mobs] §aScript Engine initialized! Type §e!test §aor §e/scriptevent alexsmobs:test §ato verify scripts.");
                }
            } catch (e) {}
        }, 40);
    }
});

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    try {
        const block = event.block;
        if (!block || !block.isValid()) return;
        const typeId = block.typeId;
        if (EGG_HATCH_MAP[typeId]) {
            trackEgg(block.dimension, block.location, typeId);
        }
    } catch (e) {}
});

world.afterEvents.itemUse.subscribe((event) => {
    try {
        if (event.itemStack && event.itemStack.typeId === "alexsmobs:emu_egg") {
            const player = event.source;
            if (!player || !player.isValid()) return;
            const dir = player.getViewDirection();
            const head = player.getHeadLocation();
            const dim = player.dimension;
            system.runTimeout(() => {
                try {
                    const spawnLoc = {
                        x: head.x + dir.x * 5,
                        y: head.y + dir.y * 5,
                        z: head.z + dir.z * 5
                    };
                    dim.playSound("block.turtle_egg.crack", spawnLoc);
                    dim.spawnParticle("minecraft:egg_destroy_emitter", spawnLoc);
                    if (Math.random() < 0.3) {
                        const baby = dim.spawnEntity("alexsmobs:emu", spawnLoc);
                        baby.triggerEvent("minecraft:entity_born");
                    }
                } catch (e) {}
            }, 12);
        }
    } catch (e) {}
});

world.afterEvents.entityHurt.subscribe((event) => {
    const victim = event.hurtEntity;
    const attacker = event.damageSource.damagingEntity;
    if (!victim || !victim.isValid()) return;

    const typeId = victim.typeId;
    if (!typeId || !typeId.startsWith("alexsmobs:")) return;

    try {
        const vLoc = victim.location;
        let dx = 0;
        let dz = 0;

        if (attacker && attacker.isValid()) {
            const aLoc = attacker.location;
            dx = aLoc.x - vLoc.x;
            dz = aLoc.z - vLoc.z;
        } else {
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dz = Math.sin(angle);
        }

        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        const normX = dx / dist;
        const normZ = dz / dist;

        if (typeId === "alexsmobs:kangaroo") {
            const retaliate = Math.random() < 0.5;
            if (retaliate && attacker && attacker.isValid() && dist < 12) {
                victim.applyImpulse({ x: normX * 0.45, y: 0.25, z: normZ * 0.45 });
            } else {
                victim.applyImpulse({ x: -normX * 0.55, y: 0.3, z: -normZ * 0.55 });
            }
            return;
        }

        if (typeId === "alexsmobs:elephant") {
            const overworld = victim.dimension;
            const nearby = overworld.getEntities({
                location: vLoc,
                maxDistance: 8,
                excludeTypes: ["alexsmobs:elephant"]
            });
            for (const ent of nearby) {
                if (!ent.isValid() || ent === victim) continue;
                const eLoc = ent.location;
                const edx = eLoc.x - vLoc.x;
                const edz = eLoc.z - vLoc.z;
                const eDist = Math.sqrt(edx * edx + edz * edz) || 1;
                try {
                    ent.applyImpulse({ x: (edx / eDist) * 0.6, y: 0.25, z: (edz / eDist) * 0.6 });
                    ent.addEffect("slowness", 60, { amplifier: 1, showParticles: true });
                } catch (err) {}
            }
            return;
        }

        if (typeId === "alexsmobs:tasmanian_devil") {
            const overworld = victim.dimension;
            const nearby = overworld.getEntities({
                location: vLoc,
                maxDistance: 5,
                excludeTypes: ["alexsmobs:tasmanian_devil"]
            });
            for (const ent of nearby) {
                if (!ent.isValid() || ent === victim) continue;
                try {
                    const eLoc = ent.location;
                    const edx = eLoc.x - vLoc.x;
                    const edz = eLoc.z - vLoc.z;
                    const eDist = Math.sqrt(edx * edx + edz * edz) || 1;
                    ent.applyImpulse({ x: (edx / eDist) * 0.4, y: 0.15, z: (edz / eDist) * 0.4 });
                } catch (err) {}
            }
            victim.applyImpulse({ x: normX * 0.35, y: 0.12, z: normZ * 0.35 });
            return;
        }

        if (typeId === "alexsmobs:skreecher") {
            const overworld = victim.dimension;
            const nearbyPlayers = overworld.getPlayers({
                location: vLoc,
                maxDistance: 12
            });
            for (const p of nearbyPlayers) {
                try {
                    p.addEffect("darkness", 100, { amplifier: 0, showParticles: true });
                    p.addEffect("slowness", 80, { amplifier: 0, showParticles: true });
                } catch (err) {}
            }
            victim.applyImpulse({ x: -normX * 0.4, y: 0.2, z: -normZ * 0.4 });
            return;
        }

        if (typeId === "alexsmobs:komodo_dragon" && attacker && attacker.isValid()) {
            try {
                attacker.addEffect("poison", 100, { amplifier: 1, showParticles: true });
                attacker.addEffect("slowness", 80, { amplifier: 0, showParticles: true });
            } catch (err) {}
            victim.applyImpulse({ x: normX * 0.4, y: 0.1, z: normZ * 0.4 });
            return;
        }

        if (BIRD_TYPES.has(typeId)) {
            victim.applyImpulse({ x: -normX * 0.25, y: 0.35, z: -normZ * 0.25 });
            return;
        }

        if (typeId.includes("cachalot_whale") || typeId.includes("giant_squid")) {
            victim.applyImpulse({ x: -normX * 0.3, y: -0.15, z: -normZ * 0.3 });
            return;
        }

        if (ATTACK_FAMILIES.has(typeId)) {
            if (attacker && attacker.isValid() && dist < 16) {
                victim.applyImpulse({ x: normX * 0.38, y: 0.1, z: normZ * 0.38 });
            }
            return;
        }

        const jitterAngle = (Math.random() - 0.5) * 0.8;
        const escapeX = -(normX * Math.cos(jitterAngle) - normZ * Math.sin(jitterAngle));
        const escapeZ = -(normX * Math.sin(jitterAngle) + normZ * Math.cos(jitterAngle));

        victim.applyImpulse({
            x: escapeX * 0.4,
            y: 0.15,
            z: escapeZ * 0.4
        });
    } catch (e) {}
});

system.runInterval(() => {
    try {
        const overworld = world.getDimension("overworld");
        if (!overworld) return;

        const crocodiles = overworld.getEntities({ type: "alexsmobs:crocodile" });
        for (const croc of crocodiles) {
            if (!croc.isValid()) continue;
            try {
                const cLoc = croc.location;
                let target = croc.target;

                if (!target || !target.isValid()) {
                    for (const preyType of CROCODILE_PREY) {
                        const nearby = overworld.getEntities({
                            type: preyType,
                            location: cLoc,
                            maxDistance: 14
                        });
                        if (nearby.length > 0) {
                            target = nearby[0];
                            break;
                        }
                    }
                }

                if (target && target.isValid()) {
                    const tLoc = target.location;
                    const dx = tLoc.x - cLoc.x;
                    const dy = tLoc.y - cLoc.y;
                    const dz = tLoc.z - cLoc.z;
                    const distSq = dx * dx + dz * dz;

                    if (distSq < 144 && distSq > 2.5) {
                        const dist = Math.sqrt(distSq);
                        const lungePower = croc.isInWater ? 0.38 : 0.25;
                        croc.applyImpulse({
                            x: (dx / dist) * lungePower,
                            y: Math.max(-0.08, Math.min(0.18, dy * 0.12)),
                            z: (dz / dist) * lungePower
                        });
                    }
                }
            } catch (e) {}
        }

        const tigers = overworld.getEntities({ type: "alexsmobs:tiger" });
        for (const tiger of tigers) {
            if (!tiger.isValid()) continue;
            try {
                const tLoc = tiger.location;
                let target = tiger.target;

                if (!target || !target.isValid()) {
                    for (const preyType of TIGER_PREY) {
                        const nearby = overworld.getEntities({
                            type: preyType,
                            location: tLoc,
                            maxDistance: 16
                        });
                        if (nearby.length > 0) {
                            target = nearby[0];
                            break;
                        }
                    }
                }

                if (target && target.isValid()) {
                    const preyLoc = target.location;
                    const dx = preyLoc.x - tLoc.x;
                    const dz = preyLoc.z - tLoc.z;
                    const distSq = dx * dx + dz * dz;

                    if (distSq < 36 && distSq > 2) {
                        const dist = Math.sqrt(distSq);
                        tiger.applyImpulse({
                            x: (dx / dist) * 0.42,
                            y: 0.15,
                            z: (dz / dist) * 0.42
                        });
                    }
                }
            } catch (e) {}
        }

        for (const type of BIRD_TYPES) {
            const birds = overworld.getEntities({ type });
            for (const b of birds) {
                if (!b.isValid()) continue;
                try {
                    const vel = b.getVelocity();
                    if (vel.y < -0.15) {
                        const rot = b.getRotation();
                        const rad = (rot.y * Math.PI) / 180;
                        const forwardX = -Math.sin(rad) * 0.14;
                        const forwardZ = Math.cos(rad) * 0.14;
                        b.applyImpulse({ x: forwardX, y: 0.12, z: forwardZ });
                    }
                } catch (e) {}
            }
        }

        const whales = overworld.getEntities({ type: "alexsmobs:cachalot_whale" });
        for (const w of whales) {
            if (!w.isValid() || !w.isInWater) continue;
            try {
                const vel = w.getVelocity();
                if (Math.abs(vel.x) > 0.02 || Math.abs(vel.z) > 0.02) {
                    const rot = w.getRotation();
                    const rad = (rot.y * Math.PI) / 180;
                    w.applyImpulse({
                        x: -Math.sin(rad) * 0.08,
                        y: 0.01,
                        z: Math.cos(rad) * 0.08
                    });
                }
            } catch (e) {}
        }

        const flyingFishes = overworld.getEntities({ type: "alexsmobs:flying_fish" });
        for (const ff of flyingFishes) {
            if (!ff.isValid()) continue;
            try {
                const vel = ff.getVelocity();
                if (ff.isInWater && Math.random() < 0.04) {
                    const rot = ff.getRotation();
                    const rad = (rot.y * Math.PI) / 180;
                    ff.applyImpulse({
                        x: -Math.sin(rad) * 0.35,
                        y: 0.38,
                        z: Math.cos(rad) * 0.35
                    });
                }
            } catch (e) {}
        }
    } catch (e) {}
}, 5);

const EGG_LAYERS = [
    { type: "alexsmobs:crocodile", egg: "alexsmobs:crocodile_egg", rate: 0.08 },
    { type: "alexsmobs:caiman", egg: "alexsmobs:caiman_egg", rate: 0.08 },
    { type: "alexsmobs:terrapin", egg: "alexsmobs:terrapin_egg", rate: 0.08 },
    { type: "alexsmobs:platypus", egg: "alexsmobs:platypus_egg", rate: 0.08 }
];

system.runInterval(() => {
    try {
        const overworld = world.getDimension("overworld");
        if (!overworld) return;

        for (const layer of EGG_LAYERS) {
            const entities = overworld.getEntities({ type: layer.type });
            for (const ent of entities) {
                if (!ent.isValid() || ent.hasComponent("minecraft:is_baby")) continue;
                if (Math.random() < layer.rate) {
                    const loc = ent.location;
                    const bx = Math.floor(loc.x);
                    const by = Math.floor(loc.y);
                    const bz = Math.floor(loc.z);
                    const blk = overworld.getBlock({ x: bx, y: by, z: bz });
                    const ground = overworld.getBlock({ x: bx, y: by - 1, z: bz });
                    if (ground && ground.isValid() && !ground.isAir && !ground.isLiquid && blk && blk.isValid() && blk.isAir) {
                        blk.setPermutation(BlockPermutation.resolve(layer.egg));
                        overworld.playSound("block.turtle_egg.drop", { x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
                        overworld.spawnParticle("minecraft:egg_destroy_emitter", { x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
                        trackEgg(overworld, { x: bx, y: by, z: bz }, layer.egg);
                    }
                }
            }
        }

        const triopsList = overworld.getEntities({ type: "alexsmobs:triops" });
        for (const triops of triopsList) {
            if (!triops.isValid() || triops.hasComponent("minecraft:is_baby")) continue;
            if (Math.random() < 0.07) {
                const loc = triops.location;
                const bx = Math.floor(loc.x);
                const by = Math.floor(loc.y);
                const bz = Math.floor(loc.z);
                const blk = overworld.getBlock({ x: bx, y: by, z: bz });
                const ground = overworld.getBlock({ x: bx, y: by - 1, z: bz });
                if (ground && ground.isValid() && !ground.isAir && blk && blk.isValid() && (blk.isAir || blk.typeId === "minecraft:water")) {
                    blk.setPermutation(BlockPermutation.resolve("alexsmobs:triops_eggs"));
                    overworld.playSound("block.turtle_egg.drop", { x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
                    trackEgg(overworld, { x: bx, y: by, z: bz }, "alexsmobs:triops_eggs");
                }
            }
        }

        const emuList = overworld.getEntities({ type: "alexsmobs:emu" });
        for (const emu of emuList) {
            if (!emu.isValid() || emu.hasComponent("minecraft:is_baby")) continue;
            if (Math.random() < 0.06) {
                const loc = emu.location;
                try {
                    overworld.spawnItem(new ItemStack("alexsmobs:emu_egg", 1), loc);
                    overworld.playSound("mob.chicken.plop", loc);
                } catch (e) {}
            }
        }

        const players = overworld.getPlayers();
        for (const p of players) {
            if (!p.isValid()) continue;
            const pLoc = p.location;
            const px = Math.floor(pLoc.x);
            const py = Math.floor(pLoc.y);
            const pz = Math.floor(pLoc.z);
            for (let rx = -3; rx <= 3; rx += 3) {
                for (let rz = -3; rz <= 3; rz += 3) {
                    for (let ry = -2; ry <= 2; ry++) {
                        const checkLoc = { x: px + rx, y: py + ry, z: pz + rz };
                        const checkBlk = overworld.getBlock(checkLoc);
                        if (checkBlk && checkBlk.isValid() && EGG_HATCH_MAP[checkBlk.typeId]) {
                            trackEgg(overworld, checkLoc, checkBlk.typeId);
                        }
                    }
                }
            }
        }
    } catch (e) {}
}, 100);

system.runInterval(() => {
    try {
        if (trackedEggs.size === 0) return;
        const currentTick = system.currentTick;
        for (const [key, egg] of trackedEggs.entries()) {
            try {
                const dim = world.getDimension(egg.dimensionId);
                if (!dim) {
                    trackedEggs.delete(key);
                    continue;
                }
                const blk = dim.getBlock(egg.location);
                if (!blk || !blk.isValid() || !EGG_HATCH_MAP[blk.typeId]) {
                    trackedEggs.delete(key);
                    continue;
                }
                const eggInfo = EGG_HATCH_MAP[blk.typeId];
                if (currentTick >= egg.hatchTick) {
                    const center = {
                        x: egg.location.x + 0.5,
                        y: egg.location.y + 0.2,
                        z: egg.location.z + 0.5
                    };
                    blk.setPermutation(BlockPermutation.resolve("minecraft:air"));
                    dim.playSound("block.turtle_egg.hatch", center);
                    dim.spawnParticle("minecraft:egg_destroy_emitter", center);
                    for (let i = 0; i < eggInfo.count; i++) {
                        const spawnLoc = {
                            x: center.x + (Math.random() - 0.5) * 0.4,
                            y: center.y,
                            z: center.z + (Math.random() - 0.5) * 0.4
                        };
                        const baby = dim.spawnEntity(eggInfo.mob, spawnLoc);
                        baby.triggerEvent("minecraft:entity_born");
                    }
                    trackedEggs.delete(key);
                } else if (egg.hatchTick - currentTick <= 100 && !egg.cracked) {
                    egg.cracked = true;
                    const center = {
                        x: egg.location.x + 0.5,
                        y: egg.location.y + 0.5,
                        z: egg.location.z + 0.5
                    };
                    dim.playSound("block.turtle_egg.crack", center);
                    dim.spawnParticle("minecraft:egg_destroy_emitter", center);
                }
            } catch (err) {
                trackedEggs.delete(key);
            }
        }
    } catch (e) {}
}, 20);
