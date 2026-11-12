SCENE = "a11_achieve"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#ffe9d6"),(1.0,"#b5562a")], shadow="#4a1a05", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

g = mob("gorilla", "idle", 0, rot=-55, scale=1.0)
act(g, "poundchest", B[1])
cam = fit_camera([g], view=(0,1,0.15), frac=0.6, u=0.4, v=-0.12)
title(cam, "ACHIEVEMENTS", -0.86, 0.3, f=2, size=0.11, align="LEFT")
title(cam, "STILL WORK", -0.86, 0.15, f=H[2], size=0.11, align="LEFT", color="#ffd34d")
caption(cam, "no experiments. just add it and play.", -0.86, 0.0, f=B[2], size=0.042, align="LEFT")
finish(N)
