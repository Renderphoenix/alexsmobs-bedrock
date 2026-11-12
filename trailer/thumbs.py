# Thumbnail variants: front-view "group photos" through a viewfinder, every mob frozen at a moment of one of its
# own animations (no text). Poses = (anim, fraction of that animation's length).
#   blender -b -P trailer/thumbs.py -- <variant> <out.png>
import os, sys, math
CONFIG_PATH = r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/trailer.json"
D = r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/"
exec(open(D + "tlib.py", encoding="utf8").read())
N, B, H = 1, [1] * 20, [1] * 40
exec(open(D + "am.py", encoding="utf8").read())
args = sys.argv[sys.argv.index("--") + 1:]
VAR, OUTP = args[0], args[1]


def M(id, anim=None, tf=0.45, scale=1.0, rot=0.0, dz=0.0):
    return dict(id=id, anim=anim, tf=tf, scale=scale, rot=rot, dz=dz)


V = {
    # everyone, posing for the class photo
    "squad": dict(pal=("#fff3c4", "#ff9a2e", "#6a2a00"), rows=[
        (-7.5, 0.2, [M("moose", "attack", .4, rot=10), M("rhinoceros", "lg_idle_snort", .4, rot=-8), M("elephant", "trumpet_0", .5), M("bison", "lg_shake", .3, rot=8), M("froststalker", "speak", .5, rot=-10)]),
        (-4.2, 0.15, [M("komodo_dragon", "attack_bite", .45, rot=20), M("grizzly_bear", "pose_stand"), M("tiger", "lg_idle_roar", .45, rot=-8), M("gorilla", "poundchest", .5), M("kangaroo", "lg_box", .4), M("snow_leopard", "attack_r", .4, rot=-15), M("bunfungus", "belly", .5, rot=-12)]),
        (-1.4, 0.2, [M("emu", "puzzled", .5, rot=15), M("gazelle", "flick_ears", .5, rot=-10), M("capuchin_monkey", "headtilt", .5), M("raccoon", "pose_stand"), M("tasmanian_devil", "howl", .5, rot=-10), M("warped_toad"), M("mimic_octopus", "attack_bite", .45, rot=-20)]),
        (1.0, 0.3, [M("rain_frog", scale=1.8), M("jerboa", scale=1.8), M("cockroach", scale=2.2), M("banana_slug", scale=1.8), M("platypus"), M("blobfish", scale=1.4)]),
    ], fly=[("bald_eagle", 2.2, -5, 4.3, 1.5, -25, .1), ("toucan", -2.8, -5, 4.4, 1.8, 30, .2), ("blue_jay", 0.2, -5, 4.8, 2.0, 10, .1), ("hummingbird", -5.2, -5, 3.9, 2.6, 35, .3), ("seagull", 5.4, -5, 4.0, 1.5, -35, .2)],
        frac=0.84, v=0.1),
    # the hunters, mid-attack
    "predators": dict(pal=("#ffe0d6", "#d9483b", "#5a120a"), rows=[
        (-6.5, 0.2, [M("grizzly_bear", "pose_stand", rot=12), M("gorilla", "poundchest", .55), M("froststalker", "speak", .5, rot=-15), M("tusklin", "gore_l", .3, rot=-30)]),
        (-3.2, 0.15, [M("crocodile", "lunge", .45, rot=35), M("tiger", "leap", .4, rot=-20), M("snow_leopard", "attack_l", .4, rot=15), M("komodo_dragon", "attack_bite", .45, rot=-30)]),
        (-0.4, 0.3, [M("dropbear", "swipe_l", .4, rot=15), M("tasmanian_devil", "attack", .5, scale=1.2), M("anteater", "lg_threat", .5, rot=-20), M("maned_wolf", rot=-15)]),
    ], fly=[("soul_vulture", 0.0, -5, 4.8, 1.2, 0, .2)], frac=0.84, v=0.16),
    # the deep: everyone swims
    "ocean": dict(pal=("#7fd3ff", "#0a2a5a", "#021024"), floor=False, rows=[
        (-14.0, 0.6, [M("cachalot_whale", "swim", .3, scale=0.42, rot=-75, dz=2.6)]),
        (-6.0, 0.3, [M("hammerhead_shark", "attack_bite", .4, rot=-60, dz=1.2), M("orca", "bite", .5, rot=-35, dz=0.8), M("frilled_shark", "attack", .4, rot=55, dz=1.6)]),
        (-2.5, 0.35, [M("sea_bear", "point", .5, rot=20, dz=0.4), M("mimic_octopus", "attack_bite", .45, rot=-10), M("mantis_shrimp", "attack_bite", .4, scale=1.4, rot=25), M("lobster", "attack_bite", .45, scale=1.8, rot=-20)]),
        (0.8, 0.35, [M("blobfish", scale=1.6, rot=15), M("devils_hole_pupfish", "swim", .3, scale=3.0, rot=-50, dz=0.5), M("catfish", "swim", .4, scale=1.3, rot=40, dz=0.3), M("flying_fish", "swim", .3, scale=2.0, rot=-40, dz=0.8), M("triops", scale=3.0)]),
    ], fly=[], frac=0.86, v=0.02),
    # birds in flight, eagle front and centre
    "skies": dict(pal=("#e9f4ff", "#5aa8ff", "#16316b"), floor=False, rows=[], fly=[
        ("bald_eagle", 0.0, 1.0, 2.0, 2.6, -30, .15), ("seagull", -3.6, -1.5, 3.2, 2.2, 40, .5), ("toucan", 3.6, -1.5, 3.0, 2.6, -40, .3),
        ("blue_jay", -2.0, -3, 4.4, 2.8, 25, .7), ("crow", 2.2, -3, 4.5, 2.6, -25, .2), ("hummingbird", -5.2, -3, 4.8, 3.4, 40, .1),
        ("shoebill", 5.2, -4, 4.6, 1.4, -40, .6)],
        frac=0.92, v=0.0),
    # weird dimension crew
    "nether_end": dict(pal=("#ff9f7a", "#3a0a3f", "#12051f"), rows=[
        (-6.5, 0.2, [M("warped_mosco", "slam", .45, scale=0.9, rot=12), M("straddler", "launch", .4, rot=-10), M("farseer", "emerge", .6, rot=8), M("underminer", rot=-10), M("skreecher", rot=15)]),
        (-3.2, 0.25, [M("laviathan", scale=0.45, rot=30), M("warped_toad", "attack_bite", .45, rot=-10), M("mimicube", scale=1.3), M("endergrade", "fly", .3, scale=1.2, rot=-20, dz=0.6), M("murmur", rot=10)]),
        (-0.4, 0.35, [M("stradpole", scale=2.0, rot=20), M("enderiophage", "fly", .3, scale=1.3, dz=0.4), M("cosmic_cod", scale=2.4, rot=-30, dz=0.6), M("rocky_roller", "attack_bite", .45, rot=-15), M("mungus", rot=10)]),
    ], fly=[("crimson_mosquito", -3.6, -4, 4.4, 1.4, 30, .2), ("soul_vulture", 3.6, -4, 4.6, 1.2, -30, .5), ("cosmaw", 0.0, -8, 5.6, 0.9, 0, .3), ("spectre", -6.0, -10, 6.0, 0.35, 20, .4)],
        frac=0.86, v=0.06),
    # monkey business: primates + friends goofing around
    "monkeys": dict(pal=("#ffe6f2", "#ff5fa2", "#6b0a3a"), rows=[
        (-5.5, 0.25, [M("elephant", "trumpet_0", .5, rot=12), M("gorilla", "poundchest", .4), M("gelada_monkey", "chest", .5, rot=-12), M("kangaroo", "lg_dropkick", .5, rot=-25)]),
        (-2.2, 0.25, [M("raccoon", "pose_stand", rot=15), M("capuchin_monkey", "throw", .5, scale=1.3), M("emu", "puzzled", .4, rot=-15), M("sugar_glider", scale=1.6), M("jerboa", scale=1.8, rot=-20)]),
        (0.8, 0.35, [M("capuchin_monkey", "headtilt", .55, scale=1.6)]),
    ], fly=[("toucan", -2.6, -4, 4.4, 2.0, 30, .3), ("blue_jay", 2.6, -4, 4.6, 2.2, -30, .6)], frac=0.78, v=0.2),
}

cfg = V[VAR]
pal = cfg["pal"]
reset(1920, 1080)
studio([(0.0, pal[0]), (1.0, pal[1])], shadow=pal[2], shadow_strength=0.0 if cfg.get("floor") is False else 0.35,
       key=(-0.3, 1.0, 1.4), key_energy=3.2, ambient=1.35)


def posed(m, name):
    a = m["anim"]
    lay = []
    if not a:
        a, lay = IDLE(m["id"])
        t = 1.0
    else:
        t = poses_of(m["id"])["anims"].get(a, {"length": 1})["length"] * m["tf"]
    r = mob(m["id"], a, t, rot=m["rot"], scale=m["scale"], name=name, layers=lay)
    return r


allr = []
for ri, (y, gap, items) in enumerate(cfg["rows"]):
    roots = [posed(m, "r%d_%d_%s" % (ri, i, m["id"])) for i, m in enumerate(items)]
    bpy.context.view_layer.update()
    x = 0.0
    for r in roots:
        mn, mx = bbox_of([r]); w = mx.x - mn.x
        r.location.x = -(x + w / 2) - ((mn.x + mx.x) / 2 - r.location.x)
        x += w + gap
    for r, m in zip(roots, items):
        r.location.x += x / 2 - gap / 2
        r.location.y = y
        r.location.z = m["dz"]
    allr += roots
for id, x, y, z, s, rz, tf in cfg["fly"]:
    an = "fly" if "fly" in poses_of(id)["anims"] else IDLE(id)[0]
    L = poses_of(id)["anims"].get(an, {"length": 1})["length"]
    allr.append(mob(id, an, L * tf, loc=(x, y, z), rot=rz, scale=s))

cam = fit_camera(allr, view=(0, 1, 0.05), frac=cfg["frac"], u=0.0, v=cfg["v"], lens=50)
for su in (-1, 1):
    for sv in (-1, 1):
        u0, v0 = 0.9 * su, 0.84 * sv
        rect2(cam, u0 - 0.035 * su, v0, 0.09, 0.012 * 16 / 9, "#ffffff", name="br_h")
        rect2(cam, u0, v0 - 0.06 * sv, 0.007, 0.13, "#ffffff", name="br_v")
setup_frames(1, 64)
render(OUTP, 1)
print("WROTE", OUTP)
