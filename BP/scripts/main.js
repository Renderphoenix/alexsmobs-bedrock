import { world, system } from "@minecraft/server";

// Alex's Mobs Bedrock AI Script Enhancer
// Enhances kangaroo hopping, bird gliding, and crocodile predator lunges

// Helper to broadcast status verification
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
        const message = `§a[Alex's Mobs] §fScript Engine: §aONLINE & WORKING§f! Server Tick: §e${system.currentTick}§f, Active Alex's Mobs: §b${mobCount}`;
        if (player && player.sendMessage) {
            player.sendMessage(message);
        } else {
            world.sendMessage(message);
        }
    } catch (e) {
        world.sendMessage(`§a[Alex's Mobs] §fScript Engine: §aONLINE & WORKING§f! Server Tick: §e${system.currentTick}`);
    }
}

// 1. Command confirmation via Bedrock ScriptEvent: /scriptevent alexsmobs:test or /scriptevent alexsmobs:status
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "alexsmobs:test" || event.id === "alexsmobs:status" || event.id === "alexsmobs:ping") {
        const player = event.sourceEntity;
        handleScriptStatus(player);
    }
});

// 2. Chat command confirmation: type !test or !alexsmobs or !status in chat
world.beforeEvents.chatSend.subscribe((event) => {
    const msg = event.message.trim().toLowerCase();
    if (msg === "!test" || msg === "!alexsmobs" || msg === "!status") {
        event.cancel = true;
        system.run(() => {
            handleScriptStatus(event.sender);
        });
    }
});

// 3. Welcome notification on player join
world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) {
        system.runTimeout(() => {
            try {
                if (event.player && event.player.isValid()) {
                    event.player.sendMessage("§6[Alex's Mobs] §aScript Engine initialized! Type §e!test §aor §e/scriptevent alexsmobs:test §ato confirm scripts are active.");
                }
            } catch (e) {}
        }, 40);
    }
});

// 4. Continuous AI physics enhancement loop (kangaroo hopping, bird gliding, croc lunging)
system.runInterval(() => {
    try {
        const overworld = world.getDimension("overworld");
        if (!overworld) return;

        // Kangaroo dynamic hopping leap
        const kangaroos = overworld.getEntities({ type: "alexsmobs:kangaroo" });
        for (const k of kangaroos) {
            if (!k.isValid()) continue;
            try {
                const vel = k.getVelocity();
                if (vel.y > 0.05 && vel.y < 0.6) {
                    const rot = k.getRotation();
                    const rad = (rot.y * Math.PI) / 180;
                    const forwardX = -Math.sin(rad) * 0.22;
                    const forwardZ = Math.cos(rad) * 0.22;
                    k.applyImpulse({ x: forwardX, y: 0.06, z: forwardZ });
                }
            } catch (e) {}
        }

        // Jerboa quick bounds
        const jerboas = overworld.getEntities({ type: "alexsmobs:jerboa" });
        for (const j of jerboas) {
            if (!j.isValid()) continue;
            try {
                const vel = j.getVelocity();
                if (vel.y > 0.05) {
                    const rot = j.getRotation();
                    const rad = (rot.y * Math.PI) / 180;
                    const forwardX = -Math.sin(rad) * 0.16;
                    const forwardZ = Math.cos(rad) * 0.16;
                    j.applyImpulse({ x: forwardX, y: 0.04, z: forwardZ });
                }
            } catch (e) {}
        }

        // Birds smooth gliding momentum
        const birdTypes = [
            "alexsmobs:sunbird",
            "alexsmobs:bald_eagle",
            "alexsmobs:toucan",
            "alexsmobs:hummingbird",
            "alexsmobs:crow",
            "alexsmobs:shoebill",
            "alexsmobs:seagull",
            "alexsmobs:blue_jay"
        ];
        for (const type of birdTypes) {
            const birds = overworld.getEntities({ type });
            for (const b of birds) {
                if (!b.isValid()) continue;
                try {
                    const vel = b.getVelocity();
                    if (vel.y < -0.15) {
                        const rot = b.getRotation();
                        const rad = (rot.y * Math.PI) / 180;
                        const forwardX = -Math.sin(rad) * 0.12;
                        const forwardZ = Math.cos(rad) * 0.12;
                        b.applyImpulse({ x: forwardX, y: 0.12, z: forwardZ });
                    }
                } catch (e) {}
            }
        }

        // Crocodile predatory water lunge
        const crocodiles = overworld.getEntities({ type: "alexsmobs:crocodile" });
        for (const c of crocodiles) {
            if (!c.isValid()) continue;
            try {
                if (c.isInWater) {
                    const target = c.target;
                    if (target && target.isValid()) {
                        const cLoc = c.location;
                        const tLoc = target.location;
                        const dx = tLoc.x - cLoc.x;
                        const dy = tLoc.y - cLoc.y;
                        const dz = tLoc.z - cLoc.z;
                        const distSq = dx * dx + dz * dz;
                        if (distSq < 100 && distSq > 3) {
                            const dist = Math.sqrt(distSq);
                            c.applyImpulse({
                                x: (dx / dist) * 0.32,
                                y: Math.max(-0.1, Math.min(0.15, dy * 0.1)),
                                z: (dz / dist) * 0.32
                            });
                        }
                    }
                }
            } catch (e) {}
        }
    } catch (e) {}
}, 3);
