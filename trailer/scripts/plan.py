# Turn a shot list into a frame-exact, beat-synced plan for one frame rate.
#   python plan.py <trailer.json> [fps]
# Reads <work>/beats.json (from beats.py) and <work>/shots.json, writes <work>/plan_<fps>.json.
#
# shots.json: [["a01_title", "t:0", "bar:2"], ["b01_cats", "bar:2", "bar:3"], ["g01_rhino", "bar:35", "half:35"], ...,
#              ["z01_end", "bar:39", "end"]]
#   "bar:N"  = start of bar N,  "half:N" = middle of bar N,  "beat:N" = beat N,  "t:SEC" = seconds,  "end" = music end
# Each plan entry: name, start (global frame), len (frames), beats[] / half[] (local frame numbers, 1-based, inside the shot).
import json, sys, os

cfg = json.load(open(sys.argv[1], encoding="utf8"))
fps = int(sys.argv[2]) if len(sys.argv) > 2 else int(cfg.get("fps", 24))
work = cfg["work"]
b = json.load(open(os.path.join(work, "beats.json")))
bars, beats, dur = b["bars"], b["beats"], b["dur"]


def t_of(s):
    if s == "end":
        return dur
    kind, v = s.split(":")
    if kind == "t":
        return float(v)
    i = int(v)
    if kind == "beat":
        return beats[i] if i < len(beats) else dur
    bar = lambda k: bars[k] if k < len(bars) else dur
    return bar(i) if kind == "bar" else (bar(i) + bar(i + 1)) / 2


fr = lambda t: int(round(t * fps)) + 1
halfbeats = sorted(beats + [(beats[i] + beats[i + 1]) / 2 for i in range(len(beats) - 1)])
shots = json.load(open(os.path.join(work, "shots.json")))
plan, prev_end = [], None
for name, a, z in shots:
    ta, tz = t_of(a), t_of(z)
    f0, f1 = fr(ta), fr(tz)
    if prev_end is not None and f0 != prev_end:
        print("warning: gap/overlap before", name, "(%d vs %d)" % (prev_end, f0))
    prev_end = f1
    plan.append({"name": name, "start": f0, "len": f1 - f0,
                 "beats": [fr(t) - f0 + 1 for t in beats if ta - 0.02 <= t < tz - 0.02],
                 "half": [fr(t) - f0 + 1 for t in halfbeats if ta - 0.02 <= t < tz - 0.02]})
json.dump({"fps": fps, "dur": dur, "total": fr(dur), "scenes": plan}, open(os.path.join(work, "plan_%d.json" % fps), "w"), indent=1)
print(len(plan), "shots, %.1f s:" % dur, " ".join("%s:%d" % (p["name"], p["len"]) for p in plan))
