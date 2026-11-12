SCENE = "a05_anims"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#e9f4ff"),(1.0,"#a9d1ff")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#16316b", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.02, 0)

k = mob("kangaroo", "run", 0, rot=-90); play(k, "run", 1, N)
e = mob("bald_eagle", "fly", 0, rot=-90, scale=1.2); play(e, "fly", 1, N); bank(e, 10, 1.0)
o = mob("orca", "swim", 0, rot=-90, scale=0.8); play(o, "swim", 1, N)
roots = [k, e, o]
x = 0
for r in roots:
    mn, mx = bbox_of([r]); w = mx.x - mn.x
    r.location.x = -(x + w/2) - ((mn.x+mx.x)/2 - r.location.x); x += w + 0.8
for r in roots: r.location.x += x/2
e.location.z = 1.2; bob(e, 0.12, 1.0, 1.2)
o.location.z = 0.5; bob(o, 0.08, 1.0, 0.5)
hop(k, h=0.55)
cam = fit_camera(roots, view=(0,1,0.1), frac=0.7, u=0.0, v=-0.15)
title(cam, "ALL-NEW ANIMATIONS", 0, 0.78, f=2, size=0.11)
caption(cam, "they hop, swim, fly and breathe. smooth af.", 0, 0.64, f=B[1], size=0.042)
finish(N)
