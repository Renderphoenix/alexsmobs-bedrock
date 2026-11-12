SCENE = "c02_dive"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#7fd3ff"),(1.0,"#0a2a5a")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#021024", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.01, 0)

c = mob("crocodile", "swim", 0, rot=-90, scale=1.0); play(c, "swim", 1, N)
c.rotation_euler[1] = math.radians(-8)
for f in range(1, N+1):
    c.location.z = 0.8 - 0.6*f/N; c.keyframe_insert("location", frame=f)
cam = fit_camera([c], view=(0.3,1,0.25), frac=0.5, u=0.0, v=-0.05)
cam_move(cam, 1, N, (cam.location.x*0.9, cam.location.y*0.9, cam.location.z-0.5))
title(cam, "THEY DIVE", 0, 0.78, f=2, size=0.14)
caption(cam, "crocs actually go underwater now.", 0, 0.64, f=B[1], size=0.042)
finish(N)
