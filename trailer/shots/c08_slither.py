SCENE = "c08_slither"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#fff0d6"),(1.0,"#d9a066")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#4a2a0a", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.02, 0)

s = mob("rattlesnake", "walk", 0, rot=-90, scale=2.0); play(s, "walk", 1, N)
cam = fit_camera([s], view=(0,1,0.35), frac=0.6, u=0.0, v=-0.2)
title(cam, "THEY SLITHER", 0, 0.78, f=2, size=0.14)
caption(cam, "snakes move like actual snakes now.", 0, 0.64, f=B[1], size=0.042)
finish(N)
