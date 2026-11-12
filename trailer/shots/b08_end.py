SCENE = "b08_end"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#e9d8ff"),(1.0,"#3a1a5a")], shadow="#12051f", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

items = [I("cosmic_cod", scale=2.2),I("endergrade", scale=1.1),I("enderiophage", scale=1.4),I("mimicube"),I("murmur"),I("skreecher"),I("underminer")]
roots = row(None, items, gap=0.45, rot=-90, f1=N)
cam = fit_camera(roots, view=(0.0, 1, 0.12), frac=0.88, u=0.0, v=-0.12)
cam_move(cam, 1, N, tuple(cam.location*0.92))
orbit(cam, (0, 0, 0), 1, N, -10)
title(cam, 'CAVES & THE END', 0, 0.8, f=2, size=0.12)
caption(cam, 'the weird ones. we love them.', 0, 0.665, f=B[1], size=0.042)
for i, r in enumerate(roots): tag_under(cam, r, r["label"], H[1+i], "#12051f", v=-0.74, size=0.026)
finish(N)
