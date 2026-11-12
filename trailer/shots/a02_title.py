SCENE = "a02_title"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#c9f7e4"),(1.0,"#2fbf9b")], shadow="#0d4d3d", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

t = mob("tiger", "walk", 0, rot=-55)
play(t, "walk", 1, N, speed=1.25)
cam = camera((3.0,9.0,1.5),(3.0,0,1.0),lens=42)
cam_move(cam, 1, N, (1.75,6.3,1.25), (1.75,0,1.0))
t1 = label2(cam, "ALEX'S", -0.8, 0.3, size=0.19, font="ten", align="LEFT"); slide_in(t1, 2, dx=-0.25, dy=0, dur=7)
t2 = label2(cam, "MOBS 2", -0.8, 0.08, size=0.19, font="ten", align="LEFT"); slide_in(t2, B[1], dx=-0.25, dy=0, dur=7)
t3 = label2(cam, "the whole java mod, rebuilt for bedrock.", -0.8, -0.12, size=0.045, align="LEFT"); slide_in(t3, B[3], dy=-0.05, dur=7)
t4 = label2(cam, "no cap, every single mob.", -0.8, -0.2, size=0.045, align="LEFT"); slide_in(t4, B[5], dy=-0.05, dur=7)
finish(N)
