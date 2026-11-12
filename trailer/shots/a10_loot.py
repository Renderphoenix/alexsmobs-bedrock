SCENE = "a10_loot"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#fff0d6"),(1.0,"#d9a066")], shadow="#4a2a0a", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)

items = [I("moose"), I("grizzly_bear"), I("crocodile")]
roots = row(None, items, gap=0.7, rot=-60, f1=N)
cam = fit_camera(roots, view=(0,1,0.15), frac=0.62, u=0.0, v=-0.2)
for i, (r, n) in enumerate(zip(roots, ["moose_antler", "bear_fur", "crocodile_scute"])):
    mn, mx = bbox_of([r]); u, v = screen_uv(cam, ((mn.x+mx.x)/2, (mn.y+mx.y)/2, mx.z))
    item(cam, n, u, v + 0.15, size=0.13, f=H[1 + 2*i])
title(cam, "LOOT FOR EVERY MOB", 0, 0.8, f=2, size=0.11)
finish(N)
