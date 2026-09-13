import { world, system } from "@minecraft/server";

// Alex's Mobs Bedrock AI Script Enhancer
// Enhances kangaroo hopping, bird gliding, and crocodile predator lunges

system.runInterval(() => {
    try {
        const overworld = world.getDimension("overworld");
        if (!overworld) return;

        // 1. Kangaroo dynamic hopping leap
        const kangaroos = overworld.getEntities({ type: "alexsmobs:kangaroo" });
        for (const k of kangaroos) {
            if (!k.isValid()) continue;
            try {
                const vel = k.getVelocity();
                // When kangaroo is airborne or jumping upward, give forward momentum
                if (vel.y > 0.05 && vel.y < 0.6) {
                    const rot = k.getRotation();
                    const rad = (rot.y * Math.PI) / 180;
                    const forwardX = -Math.sin(rad) * 0.22;
                    const forwardZ = Math.cos(rad) * 0.22;
                    k.applyImpulse({ x: forwardX, y: 0.06, z: forwardZ });
                }
            } catch (e) {}
        }

        // 2. Jerboa quick bounds
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

        // 3. Birds smooth gliding momentum
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
                    // If dropping downward too fast, catch air and glide forward smoothly
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

        // 4. Crocodile predatory water lunge
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
                        // If within 10 blocks, lunge forward at target
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
