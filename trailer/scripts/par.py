# Parallel render: split the plan's shots into K balanced groups and run render.py on each at the same time.
#   python par.py <trailer.json> <shots_dir> [--workers 5] [--fps 24] [--preview] [--only a,b] [--skip-done]
import argparse, json, os, subprocess, sys, time
ap = argparse.ArgumentParser()
ap.add_argument("config"); ap.add_argument("shots_dir")
ap.add_argument("--workers", type=int, default=5); ap.add_argument("--fps", type=int, default=24)
ap.add_argument("--preview", action="store_true"); ap.add_argument("--only", default=""); ap.add_argument("--skip-done", action="store_true")
a = ap.parse_args()
cfg = json.load(open(a.config, encoding="utf8"))
plan = json.load(open(os.path.join(cfg["work"], "plan_%d.json" % a.fps)))["scenes"]
only = set(filter(None, a.only.split(",")))
todo = [s for s in plan if not only or s["name"] in only]
todo.sort(key=lambda s: -(1 if a.preview else s["len"]))
groups, w = [[] for _ in range(a.workers)], [0] * a.workers
for s in todo:
    i = w.index(min(w)); groups[i].append(s["name"]); w[i] += 1 if a.preview else s["len"]
here = os.path.dirname(os.path.abspath(__file__))
t = time.time(); procs = []
for i, g in enumerate(groups):
    if not g: continue
    cmd = [sys.executable, os.path.join(here, "render.py"), a.config, a.shots_dir, "--fps", str(a.fps), "--only", ",".join(g)]
    if a.preview: cmd.append("--preview")
    if a.skip_done: cmd.append("--skip-done")
    procs.append(subprocess.Popen(cmd, stdout=open(os.path.join(cfg["work"], "par_%d.log" % i), "w"), stderr=subprocess.STDOUT))
for p in procs: p.wait()
print("%d shots on %d workers in %.0fs" % (len(todo), len(procs), time.time() - t))
