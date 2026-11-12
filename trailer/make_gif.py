# Summary GIF of the rendered trailer: a few frames from every shot, small and palette-optimised.
#   python trailer/make_gif.py [width] [frames_per_shot] [ms_per_frame]
import json, os, sys
from PIL import Image
W = int(sys.argv[1]) if len(sys.argv) > 1 else 480
K = int(sys.argv[2]) if len(sys.argv) > 2 else 4
MS = int(sys.argv[3]) if len(sys.argv) > 3 else 110
plan = json.load(open('H:/AlexsMobs2_Trailer/work/plan_60.json'))['scenes']
src = 'H:/AlexsMobs2_Trailer/work/render_60/'
H = round(W * 9 / 16)
frames, durs = [], []
for s in plan:
    n = s['len']
    k = max(2, round(K * min(2.0, n / 112)))          # longer shots get a few more frames
    picks = [round(n * (0.35 + 0.65 * j / (k - 1))) for j in range(k)]  # skip the pop-in, end on the final pose
    for j, f in enumerate(picks):
        im = Image.open(os.path.join(src, s['name'], '%04d.png' % max(1, min(n, f)))).convert('RGB').resize((W, H), Image.LANCZOS)
        frames.append(im.quantize(colors=96, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE))
        durs.append(MS * 3 if j == k - 1 else MS)       # hold each shot's last frame a beat
out = 'renders/trailer_v2.1/alexsmobs2_trailer.gif'
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durs, loop=0, optimize=True, disposal=1)
print(len(frames), 'frames', '%.2f MB' % (os.path.getsize(out) / 1e6), '%.1f s' % (sum(durs) / 1000))
