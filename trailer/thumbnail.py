# YouTube thumbnail: a "group photo" of the cast seen through a camera viewfinder.
#   blender -b -P trailer/thumbnail.py -- <out.png>
import os, sys, math
CONFIG_PATH = r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/trailer.json"
D = r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/"
exec(open(D + "tlib.py", encoding="utf8").read())
N, B, H = 1, [1] * 20, [1] * 40
exec(open(D + "am.py", encoding="utf8").read())
OUTP = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else S + "/thumbnail.png"

reset(1920, 1080)
studio([(0.0, "#fff3c4"), (1.0, "#ff9a2e")], shadow="#6a2a00", shadow_strength=0.35, key=(-0.3, 1.0, 1.4), key_energy=3.2, ambient=1.35)


def lineup(items, y, z=0.0, gap=0.25):
    roots = row(None, items, gap=gap, rot=0)
    for r in roots:
        r.location.y = y
        r.location.z = z
    return roots

def P(id, anim=None, t=0.0, **kw):
    a, l = IDLE(id)
    return dict({"id": id, "anim": anim or a, "layers": [] if anim else l}, **kw)

back = lineup([P("moose", rot=8), P("rhinoceros", rot=-6), P("elephant", "trumpet_0", 0.6), P("bison", rot=6), P("froststalker", rot=-8)], -7.5, gap=0.2)
mid = lineup([P("komodo_dragon", rot=20), P("grizzly_bear", "pose_stand", rot=10), P("tiger", rot=-8), P("gorilla", "poundchest", 0.5), P("kangaroo", "pose_stand"), P("snow_leopard", rot=-15), P("bunfungus", rot=-12)], -4.2, gap=0.15)
front = lineup([P("emu", rot=15), P("gazelle", rot=-10), P("capuchin_monkey", "pose_sit"), P("raccoon", "pose_stand"), P("tasmanian_devil", rot=-10), P("warped_toad"), P("mimic_octopus", rot=-20)], -1.4, gap=0.2)
tiny = lineup([P("rain_frog", scale=1.8), P("jerboa", scale=1.8), P("cockroach", scale=2.2), P("banana_slug", scale=1.8), P("platypus"), P("blobfish", scale=1.4)], 1.0, gap=0.3)
birds = []
for id, x, z, s, rz in (("bald_eagle", 2.2, 4.3, 1.5, -25), ("toucan", -2.8, 4.4, 1.8, 30), ("blue_jay", 0.2, 4.8, 2.0, 10), ("hummingbird", -5.2, 3.9, 2.6, 35), ("seagull", 5.4, 4.0, 1.5, -35)):
    b = mob(id, "fly", 0.13, loc=(x, -3.0, z), rot=rz, scale=s)
    birds.append(b)
allr = back + mid + front + tiny + birds
cam = fit_camera(allr, view=(0, 1, 0.05), frac=0.84, u=0.0, v=0.1, lens=50)

# viewfinder overlay: corner brackets, focus marks, REC
W = "#ffffff"
for su in (-1, 1):
    for sv in (-1, 1):
        u0, v0 = 0.9 * su, 0.84 * sv
        rect2(cam, u0 - 0.035 * su, v0, 0.09, 0.012 * 16 / 9, W, name="br_h")
        rect2(cam, u0, v0 - 0.06 * sv, 0.007, 0.13, W, name="br_v")
setup_frames(1, 64)
render(OUTP, 1)
print("WROTE", OUTP)
