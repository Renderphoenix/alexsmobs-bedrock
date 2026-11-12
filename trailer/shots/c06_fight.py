SCENE = "c06_fight"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#ffe9d6"),(1.0,"#b5562a")], shadow="#4a1a05", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

g = mob("grizzly_bear", "breathe", 0, loc=(1.6,0,0), rot=-90); act(g, "maul", 2)
t = mob("tusklin", "idle", 0, loc=(-1.6,0,0), rot=90); act(t, "gore_l", B[2])
cam = fit_camera([g, t], view=(0.2,1,0.15), frac=0.72, u=0.0, v=-0.15)
cam_move(cam, 1, N, tuple(cam.location*0.85))
title(cam, "THEY FIGHT BACK", 0, 0.78, f=2, size=0.13)
finish(N)
