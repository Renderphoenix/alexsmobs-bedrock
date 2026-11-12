# Beat / bar analysis of the trailer music, inside Blender (uses Blender's bundled aud + numpy, no installs).
#   blender -b --python beats.py -- <music.mp3> <out_beats.json>
# Prints tempo and a loudness bar per bar (use it to find intro / build / drop / breakdown sections).
# Output JSON: {dur, tempo, beats[], bars[], bar_rms[]} (seconds). Bars assume 4/4; check the printout:
# if the loud hits land between bar lines, the downbeat phase is off by one or two beats.
import sys, json
import aud, numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
music, out = args[0], args[1]
snd = aud.Sound(music)
sr = int(snd.specs[0])
x = snd.data()
x = x.mean(axis=1) if x.ndim > 1 else x
dur = len(x) / sr
hop, win = 512, 2048
n = (len(x) - win) // hop
w = np.hanning(win)
frames = np.lib.stride_tricks.as_strided(x, shape=(n, win), strides=(x.strides[0] * hop, x.strides[0]))
S = np.log1p(np.abs(np.fft.rfft(frames * w, axis=1)) * 10)
flux = np.concatenate([[0], np.maximum(0, np.diff(S, axis=0)).sum(axis=1)])
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fps = sr / hop
ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
lags = np.arange(len(ac))
bpm = 60 * fps / np.maximum(lags, 1)
mask = (bpm > 70) & (bpm < 180)
period = lags[mask][np.argmax(ac[mask])]
tempo = 60 * fps / period
best_off, best_s = 0, -1e9
for o in np.arange(0, period, 0.5):
    idx = np.round(np.arange(o, len(flux), period)).astype(int)
    idx = idx[idx < len(flux)]
    s = flux[idx].sum()
    if s > best_s:
        best_s, best_off = s, o
beats = [float(i / fps) for i in np.arange(best_off, len(flux), period)]
bf = [flux[min(int(round(b * fps)), len(flux) - 1)] for b in beats]
ph = int(np.argmax([sum(bf[k::4]) for k in range(4)]))
bars = beats[ph::4]
rms = []
for i, b in enumerate(bars):
    e = bars[i + 1] if i + 1 < len(bars) else dur
    seg = x[int(b * sr):int(e * sr)]
    rms.append(float(np.sqrt((seg ** 2).mean())) if len(seg) else 0.0)
print("DUR %.2f s  TEMPO %.1f bpm  BEATS %d  BARS %d  first beat %.3f  downbeat phase %d" % (dur, tempo, len(beats), len(bars), beats[0], ph))
mx = max(rms) or 1
for i, (b, r) in enumerate(zip(bars, rms)):
    print("bar %3d %6.2fs %s" % (i, b, "#" * int(40 * r / mx)))
json.dump({"dur": dur, "tempo": tempo, "beats": beats, "bars": bars, "bar_rms": rms}, open(out, "w"))
