SCENE = "b02_predators"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#ffe0d6"),(1.0,"#d9483b")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#5a120a", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.012, 0)

items = [{"id":"tasmanian_devil","anim":"walk","scale":1.3},{"id":"maned_wolf","anim":"walk"},{"id":"snow_leopard","anim":"walk"},{"id":"tiger","anim":"walk"},{"id":"komodo_dragon","anim":"walk"},{"id":"grizzly_bear","anim":"walk"}]
roots = row(None, items, gap=0.5, rot=-90, f1=N)
cam = fit_camera(roots, view=(0.0, 1, 0.12), frac=0.88, u=0.0, v=-0.12)
cam_move(cam, 1, N, tuple(cam.location*0.92))
orbit(cam, (0, 0, 0), 1, N, -10)
title(cam, 'PREDATORS', 0, 0.8, f=2, size=0.12)
caption(cam, 'they will hunt you. respectfully.', 0, 0.665, f=B[1], size=0.042)
for i, r in enumerate(roots): tag_under(cam, r, r["label"], H[1+i], "#5a120a", v=-0.74, size=0.026)
finish(N)
