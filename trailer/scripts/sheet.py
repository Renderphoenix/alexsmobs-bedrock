# Contact sheet of preview stills (or any images) for reviewing many shots at once.
#   blender -b -P sheet.py -- <out.png> <img1.png> <img2.png> ... [--cols 3] [--w 640]
# Also handy: pass rendered frames (render_24/<shot>/0040.png) to check animation moments.
import bpy, sys

a = sys.argv[sys.argv.index("--") + 1:]
cols, W = 3, 640
if "--cols" in a:
    i = a.index("--cols"); cols = int(a[i + 1]); del a[i:i + 2]
if "--w" in a:
    i = a.index("--w"); W = int(a[i + 1]); del a[i:i + 2]
out, imgs = a[0], a[1:]
H = W * 9 // 16
rows = (len(imgs) + cols - 1) // cols
buf = [0.0] * (W * cols * H * rows * 4)
for i, p in enumerate(imgs):
    img = bpy.data.images.load(p)
    img.colorspace_settings.name = "Non-Color"     # keep the colours exactly as saved
    img.scale(W, H)
    px = list(img.pixels)
    cx, cy = (i % cols) * W, (rows - 1 - i // cols) * H
    for y in range(H):
        o = ((cy + y) * W * cols + cx) * 4
        buf[o:o + W * 4] = px[y * W * 4:(y + 1) * W * 4]
    bpy.data.images.remove(img)
o = bpy.data.images.new("sheet", W * cols, H * rows)
o.colorspace_settings.name = "Non-Color"
o.pixels = buf
o.filepath_raw = out; o.file_format = "PNG"; o.save()
print("WROTE", out)
