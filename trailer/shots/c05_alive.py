SCENE = "c05_alive"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#c9f7e4"),(1.0,"#2fbf9b")], shadow="#0d4d3d", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

items = [I("raccoon"), I("gorilla"), I("elephant"), I("emu"), I("tasmanian_devil")]
roots = row(None, items, gap=0.55, rot=-60, f1=None)
acts = ["idle_look", "poundchest", "trumpet_0", "peck_ground", "howl"]
for i, (r, a) in enumerate(zip(roots, acts)):
    act(r, a, B[1 + i])
cam = fit_camera(roots, view=(0,1,0.15), frac=0.8, u=0.0, v=-0.15)
title(cam, "THEY'RE ALIVE", 0, 0.8, f=2, size=0.12)
caption(cam, "sniffing, stomping, trumpeting. just vibing.", 0, 0.665, f=B[1], size=0.042)
finish(N)
