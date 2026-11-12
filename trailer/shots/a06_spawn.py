SCENE = "a06_spawn"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#f4ffd6"),(1.0,"#8fbf2f")], shadow="#2f4a0a", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

roots = []
spots = [(0,0,-90),(1.6,0.9,-80),(-1.8,0.7,-100),(0.6,-1.4,-95),(-0.9,-1.6,-70)]
for i,(x,y,r) in enumerate(spots):
    g = mob("gazelle", "idle", 0, loc=(x,y,0), rot=r); live(g, t0=i*0.4); roots.append(g)
for i,(x,y) in enumerate([(0.9,0.0),(-0.6,-0.4)]):
    b = baby("gazelle", loc=(x,y,0), rot=-85); live(b, t0=i*0.3); roots.append(b)
cam = fit_camera(roots, view=(0,1,0.45), frac=0.62, u=0.0, v=-0.18)
cam_move(cam, 1, N, tuple(cam.location*0.94))
title(cam, "NEW SPAWN RULES", 0, 0.78, f=2, size=0.11)
caption(cam, "herds with babies. right biome, right time.", 0, 0.64, f=B[1], size=0.042)
finish(N)
