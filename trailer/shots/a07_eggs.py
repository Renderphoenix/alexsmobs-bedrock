SCENE = "a07_eggs"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#fff3c4"),(1.0,"#ffb627")], shadow="#5a2a00", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

c = mob("crocodile", "breathe", 0, loc=(3.4,-0.8,0), rot=-100); live(c)
eggs = []
for i,(x,y) in enumerate([(-0.6,0.2),(-1.2,-0.3),(-0.3,-0.6)]):
    eg = block("crocodile_egg", loc=(x-0.2,y+1.3,0), rot=15*i, scale=2.6); pop_in(eg, H[i]); eggs.append(eg)
bb = baby("crocodile", "walk", loc=(-2.6,0.6,0), rot=60, scale=0.5); play(bb, "walk", 1, N); pop_in(bb, H[4])
cam = fit_camera([c, bb] + eggs, view=(0,1,0.4), frac=0.6, u=0.0, v=-0.15)
title(cam, "EGGS THAT HATCH", 0, 0.78, f=2, size=0.11)
caption(cam, "crocs lay them. you protect them. or not.", 0, 0.64, f=B[1], size=0.042)
finish(N)
