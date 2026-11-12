SCENE = "c04_hop"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#fff3c4"),(1.0,"#ffb627")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#5a2a00", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.03, 0)

k = mob("kangaroo", "run", 0, rot=90, scale=1.0); play(k, "run", 1, N)
cam = fit_camera([k], view=(0,1,0.1), frac=0.5, u=0.0, v=-0.2)
hop(k, h=0.7)
cam_move(cam, 1, N, tuple(cam.location*0.9))
title(cam, "THEY HOP", 0, 0.78, f=2, size=0.14)
caption(cam, "kangaroos were rebuilt from scratch. boing.", 0, 0.64, f=B[1], size=0.042)
finish(N)
