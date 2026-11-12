SCENE = "a08_tame"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#ffe6f2"),(1.0,"#ff5fa2")], shadow="#6b0a3a", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

m = mob("capuchin_monkey", "idle", 0, rot=-60, scale=1.6)
act(m, "headtilt", B[2])
cam = fit_camera([m], view=(0,1,0.15), frac=0.5, u=0.35, v=-0.12)
item(cam, "banana", -0.22, -0.42, size=0.14, f=B[1])
for i,(u,v) in enumerate([(-0.08,0.22),(0.04,0.34),(-0.16,0.36)]): heart(cam, u, v, 0.06, H[5+i])
title(cam, "TAME. FEED.", -0.86, 0.3, f=2, size=0.11, align="LEFT")
title(cam, "BREED.", -0.86, 0.15, f=H[2], size=0.11, align="LEFT", color="#fff06a")
caption(cam, "give the monkey a banana. trust.", -0.86, 0.0, f=B[2], size=0.042, align="LEFT")
finish(N)
