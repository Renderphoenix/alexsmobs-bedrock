SCENE = "a09_items"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
studio([(0.0,"#d6f5ff"),(1.0,"#1d8fd1")], checker="#ffffff", checker_mix=0.07, checker_scale=9, shadow="#06385a", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)
scroll_bg(0.01, 0)

cam = camera((0,-6,0),(0,0,0), lens=50)
names = ["crocodile_chestplate","froststalker_helmet","roadrunner_boots","centipede_leggings","tarantula_hawk_elytra","moose_headgear","sombrero","fedora",
         "skelewag_sword","ghostly_pickaxe","hemolymph_blaster","squid_grapple","echolocator","music_disc_daze","pocket_sand","animal_dictionary",
         "banana","kangaroo_burger","shrimp_fried_rice","rainbow_jelly","bear_dust","soul_heart","void_worm_eye","straddlite"]
for i, n in enumerate(names):
    r, c = divmod(i, 8)
    item(cam, n, -0.77 + c*0.22, 0.25 - r*0.36, size=0.16, f=1 + i)
title(cam, "ITEMS, ARMOR & BLOCKS", 0, 0.8, f=2, size=0.1)
caption(cam, "137 items. 32 blocks. 81 recipes.", 0, -0.82, f=B[2], size=0.045)
finish(N)
