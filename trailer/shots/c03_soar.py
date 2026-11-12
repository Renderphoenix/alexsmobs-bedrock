SCENE = "c03_soar"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#e9f4ff"),(1.0,"#a9d1ff")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#16316b", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.02, 0)

e = mob("bald_eagle", "fly", 0, rot=-70, scale=1.85); play(e, "fly", 1, N)
bob(e, 0.25, 1.0, 1.1); bank(e, 12, 0.8)
cam = camera((3.9,7.4,3.0),(-0.3,0,1.75), lens=40)
cam_move(cam, 1, N, (2.6,6.2,2.4), (-0.3,0,1.6))
title(cam, "THEY SOAR", 0, 0.78, f=2, size=0.14)
tag(cam, "BALD EAGLE", B[1], color="#16316b")
finish(N)
