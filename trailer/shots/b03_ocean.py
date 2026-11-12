SCENE = "b03_ocean"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#7fd3ff"),(1.0,"#0a2a5a")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#021024", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.006, 0)

items = [{"id":"mantis_shrimp","anim":"swim","scale":1.3},{"id":"frilled_shark","anim":"swim"},{"id":"hammerhead_shark","anim":"swim"},{"id":"giant_squid","anim":"swim","scale":0.5},{"id":"orca","anim":"swim"},{"id":"cachalot_whale","anim":"swim","scale":0.28}]
roots = row(None, items, gap=0.5, rot=-90, f1=N)
for i, r in enumerate(roots): r.location.z = 0.6; bob(r, 0.08, 1.0 + 0.3*i, 0.6)
cam = fit_camera(roots, view=(0.0, 1, 0.12), frac=0.88, u=0.0, v=-0.12)
cam_move(cam, 1, N, tuple(cam.location*0.92))
orbit(cam, (0, 0, 0), 1, N, -10)
title(cam, 'THE DEEP', 0, 0.8, f=2, size=0.12)
caption(cam, 'orcas, sharks and a whole giant squid.', 0, 0.665, f=B[1], size=0.042)
for i, r in enumerate(roots): tag_under(cam, r, r["label"], H[1+i], "#021024", v=-0.74, size=0.026)
finish(N)
