SCENE = "c07_death"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#3a4a9a"),(1.0,"#0b1030")], shadow="#000000", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

e = mob("emu", "walk", 0, rot=-60, scale=1.2); play(e, "walk", 1, B[2])
play(e, "death_0", B[2], N, blend=4)
cam = fit_camera([e], view=(0,1,0.15), frac=0.5, u=0.0, v=-0.15)
title(cam, "AND DIE", 0, 0.78, f=2, size=0.14)
caption(cam, "dramatically. two death anims per mob.", 0, 0.64, f=B[3], size=0.042)
finish(N)
