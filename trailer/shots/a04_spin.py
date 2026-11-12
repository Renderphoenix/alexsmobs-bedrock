SCENE = "a04_spin"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#efe6ff"),(1.0,"#8b5cf6")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#3b1d7a", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.006, 0)

e = mob("elephant", "idle", 0, rot=-40, scale=1.0)
live(e)
cam = fit_camera([e], view=(0.0,1,0.15), frac=0.55, u=0.35, v=-0.1)
e.rotation_euler[2] = math.radians(-220); spin(e, 1, N, 180, "SINE")
title(cam, "EVERY MODEL", -0.86, 0.3, f=2, size=0.11, align="LEFT")
title(cam, "EVERY TEXTURE", -0.86, 0.15, f=H[2], size=0.11, align="LEFT", color="#ffe14d")
caption(cam, "straight from the java mod. 1:1.", -0.86, 0.0, f=B[2], size=0.045, align="LEFT")
finish(N)
