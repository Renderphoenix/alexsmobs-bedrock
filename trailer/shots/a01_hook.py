SCENE = "a01_hook"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#3a4a9a"),(1.0,"#0b1030")], shadow="#000000", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

g = mob("grizzly_bear", "breathe", 0, rot=-35)
live(g)
cam = fit_camera([g], view=(0.3,1,0.15), frac=0.55, u=0.5, v=-0.1)
cam_move(cam, 1, N, tuple(cam.location*0.92))
title(cam, "WHAT IF", -0.62, 0.3, f=2, size=0.17, align="LEFT")
title(cam, "90 MOBS", -0.62, 0.1, f=H[2], size=0.17, align="LEFT", color="#ffd34d")
caption(cam, "came to bedrock. for real.", -0.62, -0.1, f=H[4], size=0.05, align="LEFT")
finish(N)
