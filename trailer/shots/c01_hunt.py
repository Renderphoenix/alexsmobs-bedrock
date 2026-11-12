SCENE = "c01_hunt"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#ffe0d6"),(1.0,"#d9483b")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#5a120a", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.035, 0)

g = mob("gazelle", "run", 0, loc=(-2.6,0,0), rot=90); play(g, "run", 1, N, speed=1.3)
t = mob("tiger", "run", 0, loc=(0.6,0,0), rot=90); play(t, "run", 1, N, speed=1.3)
for f in range(1, N+1):
    t.location.x = 0.6 - 0.9*math.sin(f/N*math.pi*0.9); t.keyframe_insert("location", frame=f)
cam = fit_camera([g, t], view=(0.25,1,0.12), frac=0.75, u=0.0, v=-0.15)
cam_move(cam, 1, N, tuple(cam.location*0.85))
title(cam, "THEY HUNT", 0, 0.78, f=2, size=0.14)
finish(N)
