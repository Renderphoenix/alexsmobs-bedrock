SCENE = "d01_moose"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
hero('moose', 'MOOSE', ('#ffe6f2', '#ff5fa2', '#6b0a3a'), anim='walk', scale=1.0)
finish(N)
