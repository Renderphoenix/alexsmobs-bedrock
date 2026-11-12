SCENE = "b04_skies"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#e9f4ff"),(1.0,"#a9d1ff")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#16316b", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.006, 0)

items = [{"id":"hummingbird","anim":"fly","scale":3.0},{"id":"blue_jay","anim":"fly","scale":2.2},{"id":"crow","anim":"fly","scale":1.8},{"id":"toucan","anim":"fly","scale":1.8},{"id":"seagull","anim":"fly","scale":1.4},{"id":"bald_eagle","anim":"fly"}]
roots = row(None, items, gap=0.45, rot=-90, f1=N)
for i, r in enumerate(roots): r.location.z = 1.0; bob(r, 0.08, 1.0 + 0.3*i, 1.0)
cam = fit_camera(roots, view=(0.0, 1, 0.12), frac=0.88, u=0.0, v=-0.12)
cam_move(cam, 1, N, tuple(cam.location*0.92))
orbit(cam, (0, 0, 0), 1, N, -10)
title(cam, 'THE SKIES', 0, 0.8, f=2, size=0.12)
caption(cam, 'eagles, toucans, crows. birbs.', 0, 0.665, f=B[1], size=0.042)
for i, r in enumerate(roots): tag_under(cam, r, r["label"], H[1+i], "#16316b", v=-0.74, size=0.026)
finish(N)
