import { world, system } from "@minecraft/server";

// =========================================================================
// Alex's Mobs Bedrock Edition - Advanced AI Behavior Script System
// =========================================================================

// Predator and defensive mobs that fight back when hit
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
    "alexsmobs:dropbear"
]);

// Flying birds list
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

// Prey animals that crocodiles actively hunt
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

// Helper to broadcast script status
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
        const message = `§a[Alex's Mobs] §fScript Engine: §aONLINE & WORKING§f! Tick: §e${system.currentTick}§f, Active Alex's Mobs: §b${mobCount}`;
        if (player && player.sendMessage) {
            player.sendMessage(message);
        } else {
            world.sendMessage(message);
        }
    } catch (e) {
        world.sendMessage(`§a[Alex's Mobs] §fScript Engine: §aONLINE & WORKING§f! Tick: §e${system.currentTick}`);
    }
}

// -------------------------------------------------------------------------
// 1. Script Confirmation Commands
// -------------------------------------------------------------------------

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

// -------------------------------------------------------------------------
// 2. Dynamic Hit Reactions (Attack back vs Panic & Scramble)
// -------------------------------------------------------------------------

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
            // Random direction if environment damage
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dz = Math.sin(angle);
        }

        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        const normX = dx / dist;
        const normZ = dz / dist;

        // CASE A: Kangaroo Reaction (50% Boxing Retaliation, 50% Fast Leap Escape)
        if (typeId === "alexsmobs:kangaroo") {
            const retaliate = Math.random() < 0.5;
            if (retaliate && attacker && attacker.isValid() && dist < 12) {
                // Boxing leap forward at attacker!
                victim.applyImpulse({ x: normX * 0.45, y: 0.25, z: normZ * 0.45 });
            } else {
                // Panic leap away!
                victim.applyImpulse({ x: -normX * 0.55, y: 0.3, z: -normZ * 0.55 });
            }
            return;
        }

        // CASE B: Bird Reaction (Launch into the air and glide away)
        if (BIRD_TYPES.has(typeId)) {
            victim.applyImpulse({ x: -normX * 0.25, y: 0.35, z: -normZ * 0.25 });
            return;
        }

        // CASE C: Marine Giants (Whale / Giant Squid - Dive thrash)
        if (typeId.includes("cachalot_whale") || typeId.includes("giant_squid")) {
            victim.applyImpulse({ x: -normX * 0.3, y: -0.15, z: -normZ * 0.3 });
            return;
        }

        // CASE D: Attack / Predator Mobs (Turn and lunge at attacker)
        if (ATTACK_FAMILIES.has(typeId)) {
            if (attacker && attacker.isValid() && dist < 16) {
                // Charge forward at attacker!
                victim.applyImpulse({ x: normX * 0.38, y: 0.1, z: normZ * 0.38 });
            }
            return;
        }

        // CASE E: Passive Animals (Panic, scramble, and move around away from threat)
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

// -------------------------------------------------------------------------
// 3. Continuous Tick AI Behaviors (Crocodile Hunting, Kangaroo Hopping, Birds)
// -------------------------------------------------------------------------

system.runInterval(() => {
    try {
        const overworld = world.getDimension("overworld");
        if (!overworld) return;

        // --- A. Crocodile Multi-Prey Hunting (Players & Animals) ---
        const crocodiles = overworld.getEntities({ type: "alexsmobs:crocodile" });
        for (const croc of crocodiles) {
            if (!croc.isValid()) continue;
            try {
                const cLoc = croc.location;
                let target = croc.target;

                // If no player target, scan for nearby prey animals
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

                // If prey or player is targeted, execute predator lunge
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

        // --- C. Bird Glide Stabilization ---
        for (const type of BIRD_TYPES) {
            const birds = overworld.getEntities({ type });
            for (const b of birds) {
                if (!b.isValid()) continue;
                try {
                    const vel = b.getVelocity();
                    if (vel.y < -0.12) {
                        const rot = b.getRotation();
                        const rad = (rot.y * Math.PI) / 180;
                        const forwardX = -Math.sin(rad) * 0.15;
                        const forwardZ = Math.cos(rad) * 0.15;
                        b.applyImpulse({ x: forwardX, y: 0.14, z: forwardZ });
                    }
                } catch (e) {}
            }
        }

        // --- D. Jerboa Fast Bounds ---
        const jerboas = overworld.getEntities({ type: "alexsmobs:jerboa" });
        for (const j of jerboas) {
            if (!j.isValid()) continue;
            try {
                const vel = j.getVelocity();
                if (vel.y > 0.04) {
                    const rot = j.getRotation();
                    const rad = (rot.y * Math.PI) / 180;
                    j.applyImpulse({
                        x: -Math.sin(rad) * 0.18,
                        y: 0.04,
                        z: Math.cos(rad) * 0.18
                    });
                }
            } catch (e) {}
        }
    } catch (e) {}
}, 3);
