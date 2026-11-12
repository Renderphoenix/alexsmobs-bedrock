# Generates shots/*.py and work/shots.json for the Alex's Mobs 2 trailer (music: Heroic Age, 129 bpm, bars ~1.86 s)
import json, os
HEAD = '''SCENE = "%s"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
'''
P = {  # bottom, top, accent
 "orange": ("#ffe2bd", "#f0803c", "#8a3a10"), "mint": ("#c9f7e4", "#2fbf9b", "#0d4d3d"), "sky": ("#e9f4ff", "#a9d1ff", "#16316b"),
 "gold": ("#fff3c4", "#ffb627", "#5a2a00"), "red": ("#ffe0d6", "#d9483b", "#5a120a"), "violet": ("#efe6ff", "#8b5cf6", "#3b1d7a"),
 "teal": ("#d6f5ff", "#1d8fd1", "#06385a"), "sand": ("#fff0d6", "#d9a066", "#4a2a0a"), "pink": ("#ffe6f2", "#ff5fa2", "#6b0a3a"),
 "lime": ("#f4ffd6", "#8fbf2f", "#2f4a0a"), "rust": ("#ffe9d6", "#b5562a", "#4a1a05"), "night": ("#3a4a9a", "#0b1030", "#000000"),
 "nether": ("#ffb199", "#7a1010", "#2a0505"), "end": ("#e9d8ff", "#3a1a5a", "#12051f"), "deep": ("#7fd3ff", "#0a2a5a", "#021024"),
}


def studio_(p, checker=False, scroll=0.0):
    b, t, a = P[p]
    s = 'studio([(0.0,"%s"),(1.0,"%s")], %sshadow="%s", shadow_strength=0.33, key=(-0.4,1.0,1.5), key_energy=3.0, ambient=1.3)\n' % (
        b, t, 'checker="#ffffff", checker_mix=0.07, checker_scale=9, ' if checker else '', a)
    if scroll:
        s += 'scroll_bg(%s, 0)\n' % scroll
    return s


S = []  # (name, start, end, body)


def shot(name, a, z, body):
    S.append((name, a, z, body))


# ---------------- A: hook + summary (t0 - bar 14, ~27 s, loud build) ----------------
shot("a01_hook", "t:0", "bar:1", studio_("night") + '''
g = mob("grizzly_bear", "breathe", 0, rot=-35)
live(g)
cam = fit_camera([g], view=(0.3,1,0.15), frac=0.55, u=0.5, v=-0.1)
cam_move(cam, 1, N, tuple(cam.location*0.92))
title(cam, "WHAT IF", -0.62, 0.3, f=2, size=0.17, align="LEFT")
title(cam, "90 MOBS", -0.62, 0.1, f=H[2], size=0.17, align="LEFT", color="#ffd34d")
caption(cam, "came to bedrock. for real.", -0.62, -0.1, f=H[4], size=0.05, align="LEFT")
''')
shot("a02_title", "bar:1", "bar:3", studio_("mint") + '''
t = mob("tiger", "walk", 0, rot=-55)
play(t, "walk", 1, N, speed=1.25)
cam = camera((3.0,9.0,1.5),(3.0,0,1.0),lens=42)
cam_move(cam, 1, N, (1.75,6.3,1.25), (1.75,0,1.0))
t1 = label2(cam, "ALEX'S", -0.8, 0.3, size=0.19, font="ten", align="LEFT"); slide_in(t1, 2, dx=-0.25, dy=0, dur=7)
t2 = label2(cam, "MOBS 2", -0.8, 0.08, size=0.19, font="ten", align="LEFT"); slide_in(t2, B[1], dx=-0.25, dy=0, dur=7)
t3 = label2(cam, "the whole java mod, rebuilt for bedrock.", -0.8, -0.12, size=0.045, align="LEFT"); slide_in(t3, B[3], dy=-0.05, dur=7)
t4 = label2(cam, "no cap, every single mob.", -0.8, -0.2, size=0.045, align="LEFT"); slide_in(t4, B[5], dy=-0.05, dur=7)
''')
shot("a03_lineup", "bar:3", "bar:4", studio_("orange") + '''
items = [I("raccoon"), I("capuchin_monkey"), I("emu"), I("gorilla"), I("rhinoceros"), I("elephant")]
roots = row(None, items, gap=0.6, rot=-90, f1=N)
for i, r in enumerate(roots): pop_in(r, max(1, H[i] - 2), dur=6)
cam = fit_camera(roots, view=(0,1,0.12), frac=0.72, u=0.0, v=-0.12)
title(cam, "ONE ADD-ON. 90 MOBS.", 0, 0.75, f=2, size=0.12)
''')
shot("a04_spin", "bar:4", "bar:5", studio_("violet", True, 0.006) + '''
e = mob("elephant", "idle", 0, rot=-40, scale=1.0)
live(e)
cam = fit_camera([e], view=(0.0,1,0.15), frac=0.55, u=0.35, v=-0.1)
e.rotation_euler[2] = math.radians(-220); spin(e, 1, N, 180, "SINE")
title(cam, "EVERY MODEL", -0.86, 0.3, f=2, size=0.11, align="LEFT")
title(cam, "EVERY TEXTURE", -0.86, 0.15, f=H[2], size=0.11, align="LEFT", color="#ffe14d")
caption(cam, "straight from the java mod. 1:1.", -0.86, 0.0, f=B[2], size=0.045, align="LEFT")
''')
shot("a05_anims", "bar:5", "bar:6", studio_("sky", True, 0.02) + '''
k = mob("kangaroo", "run", 0, rot=-90); play(k, "run", 1, N)
e = mob("bald_eagle", "fly", 0, rot=-90, scale=1.2); play(e, "fly", 1, N); bank(e, 10, 1.0)
o = mob("orca", "swim", 0, rot=-90, scale=0.8); play(o, "swim", 1, N)
roots = [k, e, o]
x = 0
for r in roots:
    mn, mx = bbox_of([r]); w = mx.x - mn.x
    r.location.x = -(x + w/2) - ((mn.x+mx.x)/2 - r.location.x); x += w + 0.8
for r in roots: r.location.x += x/2
e.location.z = 1.2; bob(e, 0.12, 1.0, 1.2)
o.location.z = 0.5; bob(o, 0.08, 1.0, 0.5)
hop(k, h=0.55)
cam = fit_camera(roots, view=(0,1,0.1), frac=0.7, u=0.0, v=-0.15)
title(cam, "ALL-NEW ANIMATIONS", 0, 0.78, f=2, size=0.11)
caption(cam, "they hop, swim, fly and breathe. smooth af.", 0, 0.64, f=B[1], size=0.042)
''')
shot("a06_spawn", "bar:6", "bar:7", studio_("lime") + '''
roots = []
spots = [(0,0,-90),(1.6,0.9,-80),(-1.8,0.7,-100),(0.6,-1.4,-95),(-0.9,-1.6,-70)]
for i,(x,y,r) in enumerate(spots):
    g = mob("gazelle", "idle", 0, loc=(x,y,0), rot=r); live(g, t0=i*0.4); roots.append(g)
for i,(x,y) in enumerate([(0.9,0.0),(-0.6,-0.4)]):
    b = baby("gazelle", loc=(x,y,0), rot=-85); live(b, t0=i*0.3); roots.append(b)
cam = fit_camera(roots, view=(0,1,0.45), frac=0.62, u=0.0, v=-0.18)
cam_move(cam, 1, N, tuple(cam.location*0.94))
title(cam, "NEW SPAWN RULES", 0, 0.78, f=2, size=0.11)
caption(cam, "herds with babies. right biome, right time.", 0, 0.64, f=B[1], size=0.042)
''')
shot("a07_eggs", "bar:7", "bar:8", studio_("gold") + '''
c = mob("crocodile", "breathe", 0, loc=(3.4,-0.8,0), rot=-100); live(c)
eggs = []
for i,(x,y) in enumerate([(-0.6,0.2),(-1.2,-0.3),(-0.3,-0.6)]):
    eg = block("crocodile_egg", loc=(x-0.2,y+1.3,0), rot=15*i, scale=2.6); pop_in(eg, H[i]); eggs.append(eg)
bb = baby("crocodile", "walk", loc=(-2.6,0.6,0), rot=60, scale=0.5); play(bb, "walk", 1, N); pop_in(bb, H[4])
cam = fit_camera([c, bb] + eggs, view=(0,1,0.4), frac=0.6, u=0.0, v=-0.15)
title(cam, "EGGS THAT HATCH", 0, 0.78, f=2, size=0.11)
caption(cam, "crocs lay them. you protect them. or not.", 0, 0.64, f=B[1], size=0.042)
''')
shot("a08_tame", "bar:8", "bar:9", studio_("pink") + '''
m = mob("capuchin_monkey", "idle", 0, rot=-60, scale=1.6)
act(m, "headtilt", B[2])
cam = fit_camera([m], view=(0,1,0.15), frac=0.5, u=0.35, v=-0.12)
item(cam, "banana", -0.22, -0.42, size=0.14, f=B[1])
for i,(u,v) in enumerate([(-0.08,0.22),(0.04,0.34),(-0.16,0.36)]): heart(cam, u, v, 0.06, H[5+i])
title(cam, "TAME. FEED.", -0.86, 0.3, f=2, size=0.11, align="LEFT")
title(cam, "BREED.", -0.86, 0.15, f=H[2], size=0.11, align="LEFT", color="#fff06a")
caption(cam, "give the monkey a banana. trust.", -0.86, 0.0, f=B[2], size=0.042, align="LEFT")
''')
shot("a09_items", "bar:9", "bar:10", studio_("teal", True, 0.01) + '''
cam = camera((0,-6,0),(0,0,0), lens=50)
names = ["crocodile_chestplate","froststalker_helmet","roadrunner_boots","centipede_leggings","tarantula_hawk_elytra","moose_headgear","sombrero","fedora",
         "skelewag_sword","ghostly_pickaxe","hemolymph_blaster","squid_grapple","echolocator","music_disc_daze","pocket_sand","animal_dictionary",
         "banana","kangaroo_burger","shrimp_fried_rice","rainbow_jelly","bear_dust","soul_heart","void_worm_eye","straddlite"]
for i, n in enumerate(names):
    r, c = divmod(i, 8)
    item(cam, n, -0.77 + c*0.22, 0.25 - r*0.36, size=0.16, f=1 + i)
title(cam, "ITEMS, ARMOR & BLOCKS", 0, 0.8, f=2, size=0.1)
caption(cam, "137 items. 32 blocks. 81 recipes.", 0, -0.82, f=B[2], size=0.045)
''')
shot("a10_loot", "bar:10", "bar:11", studio_("sand") + '''
items = [I("moose"), I("grizzly_bear"), I("crocodile")]
roots = row(None, items, gap=0.7, rot=-60, f1=N)
cam = fit_camera(roots, view=(0,1,0.15), frac=0.62, u=0.0, v=-0.2)
for i, (r, n) in enumerate(zip(roots, ["moose_antler", "bear_fur", "crocodile_scute"])):
    mn, mx = bbox_of([r]); u, v = screen_uv(cam, ((mn.x+mx.x)/2, (mn.y+mx.y)/2, mx.z))
    item(cam, n, u, v + 0.15, size=0.13, f=H[1 + 2*i])
title(cam, "LOOT FOR EVERY MOB", 0, 0.8, f=2, size=0.11)
''')
shot("a11_achieve", "bar:11", "bar:12", studio_("rust") + '''
g = mob("gorilla", "idle", 0, rot=-55, scale=1.0)
act(g, "poundchest", B[1])
cam = fit_camera([g], view=(0,1,0.15), frac=0.6, u=0.4, v=-0.12)
title(cam, "ACHIEVEMENTS", -0.86, 0.3, f=2, size=0.11, align="LEFT")
title(cam, "STILL WORK", -0.86, 0.15, f=H[2], size=0.11, align="LEFT", color="#ffd34d")
caption(cam, "no experiments. just add it and play.", -0.86, 0.0, f=B[2], size=0.042, align="LEFT")
''')
shot("a12_meet", "bar:12", "bar:14", studio_("orange", True) + '''
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
''')


# ---------------- B: the cast (bars 14 - 28, calmer) ----------------
def cat(name, a, z, ttl, cap, items, pal, rot=-90, gap=0.45, frac=0.88, v=-0.12, scroll=0.0, flyz=None, view=(0.0, 1, 0.12)):
    body = studio_(pal, bool(scroll), scroll) + '''
items = [%s]
roots = row(None, items, gap=%s, rot=%s, f1=N)
''' % (",".join(items), gap, rot)
    if flyz is not None:
        body += 'for i, r in enumerate(roots): r.location.z = %s; bob(r, 0.08, 1.0 + 0.3*i, %s)\n' % (flyz, flyz)
    body += '''cam = fit_camera(roots, view=%r, frac=%s, u=0.0, v=%s)
cam_move(cam, 1, N, tuple(cam.location*0.92))
orbit(cam, (0, 0, 0), 1, N, -10)
title(cam, %r, 0, 0.8, f=2, size=0.12)
caption(cam, %r, 0, 0.665, f=B[1], size=0.042)
for i, r in enumerate(roots): tag_under(cam, r, r["label"], H[1+i], "%s", v=-0.74, size=0.026)
''' % (view, frac, v, ttl, cap, P[pal][2])
    shot(name, a, z, body)


cat("b01_savanna", "bar:14", "bar:16", "THE SAVANNA", "big, bigger, biggest.",
    ['I("roadrunner")', 'I("gazelle")', 'I("kangaroo")', 'I("emu")', 'I("rhinoceros")', 'I("elephant")'], "gold", gap=0.5)
cat("b02_predators", "bar:16", "bar:18", "PREDATORS", "they will hunt you. respectfully.",
    ['{"id":"tasmanian_devil","anim":"walk","scale":1.3}', '{"id":"maned_wolf","anim":"walk"}', '{"id":"snow_leopard","anim":"walk"}', '{"id":"tiger","anim":"walk"}', '{"id":"komodo_dragon","anim":"walk"}', '{"id":"grizzly_bear","anim":"walk"}'], "red", gap=0.5, scroll=0.012)
cat("b03_ocean", "bar:18", "bar:20", "THE DEEP", "orcas, sharks and a whole giant squid.",
    ['{"id":"mantis_shrimp","anim":"swim","scale":1.3}', '{"id":"frilled_shark","anim":"swim"}', '{"id":"hammerhead_shark","anim":"swim"}', '{"id":"giant_squid","anim":"swim","scale":0.5}', '{"id":"orca","anim":"swim"}', '{"id":"cachalot_whale","anim":"swim","scale":0.28}'], "deep", gap=0.5, flyz=0.6, scroll=0.006)
cat("b04_skies", "bar:20", "bar:21", "THE SKIES", "eagles, toucans, crows. birbs.",
    ['{"id":"hummingbird","anim":"fly","scale":3.0}', '{"id":"blue_jay","anim":"fly","scale":2.2}', '{"id":"crow","anim":"fly","scale":1.8}', '{"id":"toucan","anim":"fly","scale":1.8}', '{"id":"seagull","anim":"fly","scale":1.4}', '{"id":"bald_eagle","anim":"fly"}'], "sky", gap=0.45, flyz=1.0, scroll=0.006)
shot("b05_whale", "bar:21", "bar:22", 'hero("cachalot_whale", "CACHALOT WHALE", %r, cap="yes it is huge. yes it echolocates.", anim="swim", deg=90, end=-50, scale=0.6, frac=0.45)\n' % (P["deep"],))
cat("b06_tiny", "bar:22", "bar:24", "TINY CRITTERS", "the cockroach dances. we don't know why.",
    ['I("fly", scale=6)', 'I("leafcutter_ant", scale=4)', 'I("cockroach", scale=4)', 'I("rain_frog", scale=4)', 'I("banana_slug", scale=3.5)', 'I("jerboa", scale=3)', 'I("sugar_glider", scale=2.5)'], "lime", gap=0.15, view=(0.0, 1, 0.3))
cat("b07_nether", "bar:24", "bar:26", "THE NETHER", "lava striders, soul vultures, mosquitoes. yikes.",
    ['{"id":"crimson_mosquito","anim":"fly","scale":1.4}', 'I("stradpole", scale=2.0)', 'I("warped_toad")', 'I("soul_vulture")', 'I("warped_mosco", scale=0.8)', 'I("straddler", scale=0.8)'], "nether", gap=0.45)
cat("b08_end", "bar:26", "bar:28", "CAVES & THE END", "the weird ones. we love them.",
    ['I("cosmic_cod", scale=2.2)', 'I("endergrade", scale=1.1)', 'I("enderiophage", scale=1.4)', 'I("mimicube")', 'I("murmur")', 'I("skreecher")', 'I("underminer")'], "end", gap=0.45)

# ---------------- C: finale (bars 28 - 47, loud) ----------------
shot("c01_hunt", "bar:28", "bar:29", studio_("red", True, 0.035) + '''
g = mob("gazelle", "run", 0, loc=(-2.6,0,0), rot=90); play(g, "run", 1, N, speed=1.3)
t = mob("tiger", "run", 0, loc=(0.6,0,0), rot=90); play(t, "run", 1, N, speed=1.3)
for f in range(1, N+1):
    t.location.x = 0.6 - 0.9*math.sin(f/N*math.pi*0.9); t.keyframe_insert("location", frame=f)
cam = fit_camera([g, t], view=(0.25,1,0.12), frac=0.75, u=0.0, v=-0.15)
cam_move(cam, 1, N, tuple(cam.location*0.85))
title(cam, "THEY HUNT", 0, 0.78, f=2, size=0.14)
''')
shot("c02_dive", "bar:29", "bar:30", studio_("deep", True, 0.01) + '''
c = mob("crocodile", "swim", 0, rot=-90, scale=1.0); play(c, "swim", 1, N)
c.rotation_euler[1] = math.radians(-8)
for f in range(1, N+1):
    c.location.z = 0.8 - 0.6*f/N; c.keyframe_insert("location", frame=f)
cam = fit_camera([c], view=(0.3,1,0.25), frac=0.5, u=0.0, v=-0.05)
cam_move(cam, 1, N, (cam.location.x*0.9, cam.location.y*0.9, cam.location.z-0.5))
title(cam, "THEY DIVE", 0, 0.78, f=2, size=0.14)
caption(cam, "crocs actually go underwater now.", 0, 0.64, f=B[1], size=0.042)
''')
shot("c03_soar", "bar:30", "bar:31", studio_("sky", True, 0.02) + '''
e = mob("bald_eagle", "fly", 0, rot=-70, scale=1.85); play(e, "fly", 1, N)
bob(e, 0.25, 1.0, 1.1); bank(e, 12, 0.8)
cam = camera((3.9,7.4,3.0),(-0.3,0,1.75), lens=40)
cam_move(cam, 1, N, (2.6,6.2,2.4), (-0.3,0,1.6))
title(cam, "THEY SOAR", 0, 0.78, f=2, size=0.14)
tag(cam, "BALD EAGLE", B[1], color="#16316b")
''')
shot("c04_hop", "bar:31", "bar:32", studio_("gold", True, 0.03) + '''
k = mob("kangaroo", "run", 0, rot=90, scale=1.0); play(k, "run", 1, N)
cam = fit_camera([k], view=(0,1,0.1), frac=0.5, u=0.0, v=-0.2)
hop(k, h=0.7)
cam_move(cam, 1, N, tuple(cam.location*0.9))
title(cam, "THEY HOP", 0, 0.78, f=2, size=0.14)
caption(cam, "kangaroos were rebuilt from scratch. boing.", 0, 0.64, f=B[1], size=0.042)
''')
shot("c05_alive", "bar:32", "bar:34", studio_("mint") + '''
items = [I("raccoon"), I("gorilla"), I("elephant"), I("emu"), I("tasmanian_devil")]
roots = row(None, items, gap=0.55, rot=-60, f1=None)
acts = ["idle_look", "poundchest", "trumpet_0", "peck_ground", "howl"]
for i, (r, a) in enumerate(zip(roots, acts)):
    act(r, a, B[1 + i])
cam = fit_camera(roots, view=(0,1,0.15), frac=0.8, u=0.0, v=-0.15)
title(cam, "THEY'RE ALIVE", 0, 0.8, f=2, size=0.12)
caption(cam, "sniffing, stomping, trumpeting. just vibing.", 0, 0.665, f=B[1], size=0.042)
''')
shot("c06_fight", "bar:34", "bar:35", studio_("rust") + '''
g = mob("grizzly_bear", "breathe", 0, loc=(1.6,0,0), rot=-90); act(g, "maul", 2)
t = mob("tusklin", "idle", 0, loc=(-1.6,0,0), rot=90); act(t, "gore_l", B[2])
cam = fit_camera([g, t], view=(0.2,1,0.15), frac=0.72, u=0.0, v=-0.15)
cam_move(cam, 1, N, tuple(cam.location*0.85))
title(cam, "THEY FIGHT BACK", 0, 0.78, f=2, size=0.13)
''')
shot("c07_death", "bar:35", "bar:36", studio_("night") + '''
e = mob("emu", "walk", 0, rot=-60, scale=1.2); play(e, "walk", 1, B[2])
play(e, "death_0", B[2], N, blend=4)
cam = fit_camera([e], view=(0,1,0.15), frac=0.5, u=0.0, v=-0.15)
title(cam, "AND DIE", 0, 0.78, f=2, size=0.14)
caption(cam, "dramatically. two death anims per mob.", 0, 0.64, f=B[3], size=0.042)
''')
shot("c08_slither", "bar:36", "bar:37", studio_("sand", True, 0.02) + '''
s = mob("rattlesnake", "walk", 0, rot=-90, scale=2.0); play(s, "walk", 1, N)
cam = fit_camera([s], view=(0,1,0.35), frac=0.6, u=0.0, v=-0.2)
title(cam, "THEY SLITHER", 0, 0.78, f=2, size=0.14)
caption(cam, "snakes move like actual snakes now.", 0, 0.64, f=B[1], size=0.042)
''')
heroes = [("d01_moose", "moose", "MOOSE", "pink", "walk"), ("d02_rhino", "rhinoceros", "RHINOCEROS", "orange", None),
          ("d03_orca", "orca", "ORCA", "teal", "swim"), ("d04_komodo", "komodo_dragon", "KOMODO DRAGON", "lime", "walk"),
          ("d05_leopard", "snow_leopard", "SNOW LEOPARD", "sky", None), ("d06_platypus", "platypus", "PLATYPUS", "mint", None),
          ("d07_toad", "warped_toad", "WARPED TOAD", "nether", None), ("d08_octopus", "mimic_octopus", "MIMIC OCTOPUS", "violet", None)]
for i, (n, id, t, p, a) in enumerate(heroes):
    sc = 1.0
    shot(n, "bar:%d" % (37 + i), "bar:%d" % (38 + i), 'hero(%r, %r, %r, anim=%r, scale=%s)\n' % (id, t, P[p], a, sc))
quick = [("e01_seabear", "sea_bear", "SEA BEAR", "deep"), ("e02_bunfungus", "bunfungus", "BUNFUNGUS", "pink"),
         ("e03_froststalker", "froststalker", "FROSTSTALKER", "sky"), ("e04_tusklin", "tusklin", "TUSKLIN", "red")]
for i, (n, id, t, p) in enumerate(quick):
    a = ("half:%d" if i % 2 else "bar:%d") % (45 + i // 2)
    z = ("bar:%d" % (46 + i // 2)) if i % 2 else ("half:%d" % (45 + i // 2))
    shot(n, a, z, 'hero(%r, %r, %r, deg=120, frac=0.5)\n' % (id, t, P[p]))
shot("z01_end", "bar:47", "end", studio_("night") + '''
items = [I("raccoon"), I("tiger"), I("gorilla"), I("kangaroo"), I("emu"), I("capuchin_monkey")]
roots = row(None, items, gap=0.45, rot=-90, f1=N)
cam = fit_camera(roots, view=(0,1,0.1), frac=0.72, u=0.0, v=-0.42)
title(cam, "ALEX'S MOBS 2", 0, 0.55, f=2, size=0.17)
caption(cam, "minecraft bedrock add-on. an unofficial port of the java mod.", 0, 0.38, f=B[1], size=0.036)
caption(cam, "ORIGINAL MOD: ALEX'S MOBS BY ALEXTHE666", 0, 0.2, f=B[3], size=0.04, color="#ffd34d")
caption(cam, "all creatures, models, textures and ideas belong to the original authors.", 0, 0.11, f=B[3], size=0.03)
caption(cam, "music: Heroic Age by Kevin MacLeod (incompetech.com), CC BY 4.0", 0, -0.92, f=B[5], size=0.026, color="#c8d0ff")
''')

os.makedirs("shots", exist_ok=True)
for f in os.listdir("shots"):
    if f.endswith(".py"):
        os.remove(os.path.join("shots", f))
for n, a, z, body in S:
    open(os.path.join("shots", n + ".py"), "w", encoding="utf8").write(HEAD % n + body + "finish(N)\n")
json.dump([[n, a, z] for n, a, z, _ in S], open("H:/AlexsMobs2_Trailer/work/shots.json", "w"), indent=0)
print(len(S), "shots")
