SCENE = "a03_lineup"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#ffe2bd"),(1.0,"#f0803c")], shadow="#8a3a10", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

items = [I("raccoon"), I("capuchin_monkey"), I("emu"), I("gorilla"), I("rhinoceros"), I("elephant")]
roots = row(None, items, gap=0.6, rot=-90, f1=N)
for i, r in enumerate(roots): pop_in(r, max(1, H[i] - 2), dur=6)
cam = fit_camera(roots, view=(0,1,0.12), frac=0.72, u=0.0, v=-0.12)
title(cam, "ONE ADD-ON. 90 MOBS.", 0, 0.75, f=2, size=0.12)
finish(N)
