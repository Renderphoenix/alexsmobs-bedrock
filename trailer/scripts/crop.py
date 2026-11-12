# Crop a region of a rendered frame at full resolution (to inspect texture overlap, flicker, edges).
#   blender -b -P crop.py -- <src.png> <x> <y> <w> <h> <out.png>   (x,y from the top-left)
import bpy, sys
a = sys.argv[sys.argv.index('--')+1:]
src, x, y, w, h, out = a[0], int(a[1]), int(a[2]), int(a[3]), int(a[4]), a[5]
img = bpy.data.images.load(src); img.colorspace_settings.name = "Non-Color"
W, H = img.size
px = img.pixels[:]
buf = []
for yy in range(H - y - h, H - y):
    o = (yy * W + x) * 4
    buf += px[o:o + w * 4]
o2 = bpy.data.images.new("c", w, h); o2.colorspace_settings.name = "Non-Color"
o2.pixels = buf; o2.filepath_raw = out; o2.file_format = "PNG"; o2.save()
