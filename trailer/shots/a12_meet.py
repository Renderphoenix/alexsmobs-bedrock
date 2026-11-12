SCENE = "a12_meet"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#ffe2bd"),(1.0,"#f0803c")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#8a3a10", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

ids = ["tiger","elephant","kangaroo","gorilla","emu","rhinoceros","snow_leopard","moose","komodo_dragon","raccoon"]
roots = []
import math as _m
for i, id in enumerate(ids):
    a = 2*_m.pi*i/len(ids); R = 4.2
    r = mob(id, IDLE(id)[0], 0, loc=(R*_m.cos(a), R*_m.sin(a), 0), rot=_m.degrees(a)+90, scale=1.0)
    live(r, t0=i*0.37); roots.append(r)
cam = fit_camera(roots, view=(0,1,0.45), frac=0.6, u=0.0, v=-0.12, lens=32)
orbit(cam, (0,0,0), 1, N, 70)
title(cam, "LET'S MEET THEM.", 0, 0.8, f=B[2], size=0.13)
finish(N)
