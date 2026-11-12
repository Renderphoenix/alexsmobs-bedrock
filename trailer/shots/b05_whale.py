SCENE = "b05_whale"
import os
os.environ.setdefault("TRAILER_SKILL_DIR", r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer")
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/head.py", encoding="utf8").read())
exec(open(r"C:/Users/devsuki/Desktop/alexsmobs-bedrock/trailer/scripts/am.py", encoding="utf8").read())
reset(1920, 1080)
hero("cachalot_whale", "CACHALOT WHALE", ('#7fd3ff', '#0a2a5a', '#021024'), cap="yes it is huge. yes it echolocates.", anim="swim", deg=90, end=-50, scale=0.6, frac=0.45)
finish(N)
