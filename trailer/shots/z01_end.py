SCENE = "z01_end"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#3a4a9a"),(1.0,"#0b1030")], shadow="#000000", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

items = [I("raccoon"), I("tiger"), I("gorilla"), I("kangaroo"), I("emu"), I("capuchin_monkey")]
roots = row(None, items, gap=0.45, rot=-90, f1=N)
cam = fit_camera(roots, view=(0,1,0.1), frac=0.72, u=0.0, v=-0.42)
title(cam, "ALEX'S MOBS 2", 0, 0.55, f=2, size=0.17)
caption(cam, "minecraft bedrock add-on. an unofficial port of the java mod.", 0, 0.38, f=B[1], size=0.036)
caption(cam, "ORIGINAL MOD: ALEX'S MOBS BY ALEXTHE666", 0, 0.2, f=B[3], size=0.04, color="#ffd34d")
caption(cam, "all creatures, models, textures and ideas belong to the original authors.", 0, 0.11, f=B[3], size=0.03)
caption(cam, "music: Heroic Age by Kevin MacLeod (incompetech.com), CC BY 4.0", 0, -0.92, f=B[5], size=0.026, color="#c8d0ff")
finish(N)
