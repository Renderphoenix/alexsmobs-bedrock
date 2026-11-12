# Render shots with background Blender (one process per shot, so a crash only loses that shot).
#   python render.py <trailer.json> <shots_dir> [--fps 24] [--preview] [--only a01_title,b01_cats] [--skip-done]
# Frames go to <work>/render_<fps>/<shot>/, logs next to them. Prints frame count + seconds per shot.
import argparse, json, os, subprocess, sys, time, glob

ap = argparse.ArgumentParser()
ap.add_argument("config"); ap.add_argument("shots_dir")
ap.add_argument("--fps", type=int); ap.add_argument("--preview", action="store_true")
ap.add_argument("--only", default=""); ap.add_argument("--skip-done", action="store_true")
a = ap.parse_args()
cfg = json.load(open(a.config, encoding="utf8"))
fps = a.fps or int(cfg.get("fps", 24))
blender = cfg.get("blender", "blender")
out = os.path.join(cfg["work"], "render_%d" % fps)
os.makedirs(out, exist_ok=True)
plan = json.load(open(os.path.join(cfg["work"], "plan_%d.json" % fps)))
only = set(filter(None, a.only.split(",")))
env = dict(os.environ, TRAILER_CONFIG=os.path.abspath(a.config))
for s in plan["scenes"]:
    n = s["name"]
    if only and n not in only:
        continue
    script = os.path.join(a.shots_dir, n + ".py")
    if not os.path.exists(script):
        print("missing script", script); continue
    d = os.path.join(out, n)
    if a.skip_done and not a.preview and os.path.isdir(d) and len(os.listdir(d)) >= s["len"]:
        print(n, "done already"); continue
    t = time.time()
    with open(os.path.join(out, n + ".log"), "w") as log:
        subprocess.run([blender, "-b", "-P", script, "--", "preview" if a.preview else "render", str(fps)], stdout=log, stderr=subprocess.STDOUT, env=env)
    cnt = len(glob.glob(os.path.join(d, "*"))) if not a.preview else int(os.path.exists(os.path.join(out, n + "_preview.png")))
    print("%-18s %4s %s  %.0fs" % (n, cnt, "preview" if a.preview else "frames/%d" % s["len"], time.time() - t), flush=True)
