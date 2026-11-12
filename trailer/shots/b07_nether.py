SCENE = "b07_nether"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#ffb199"),(1.0,"#7a1010")], shadow="#2a0505", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

items = [{"id":"crimson_mosquito","anim":"fly","scale":1.4},I("stradpole", scale=2.0),I("warped_toad"),I("soul_vulture"),I("warped_mosco", scale=0.8),I("straddler", scale=0.8)]
roots = row(None, items, gap=0.45, rot=-90, f1=N)
cam = fit_camera(roots, view=(0.0, 1, 0.12), frac=0.88, u=0.0, v=-0.12)
cam_move(cam, 1, N, tuple(cam.location*0.92))
orbit(cam, (0, 0, 0), 1, N, -10)
title(cam, 'THE NETHER', 0, 0.8, f=2, size=0.12)
caption(cam, 'lava striders, soul vultures, mosquitoes. yikes.', 0, 0.665, f=B[1], size=0.042)
for i, r in enumerate(roots): tag_under(cam, r, r["label"], H[1+i], "#2a0505", v=-0.74, size=0.026)
finish(N)
