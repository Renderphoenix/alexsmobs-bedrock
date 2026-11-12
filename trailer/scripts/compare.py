# Render one frame of a shot in Cycles or EEVEE at full HD for comparison.
#   blender -b -P compare.py -- <shot> <cycles|eevee> <frame|last> <out.png>
import sys, os, time, bpy
a = sys.argv[sys.argv.index("--") + 1:]
shot, engine, frame, out = a[0], a[1], a[2], a[3]
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, "..", "shots", shot + ".py"), encoding="utf8").read().replace("finish(N)", "setup_frames(N)")
sys.argv = [sys.argv[0], "--", "preview", "24"]
g = {"__name__": "shot"}
exec(src, g)
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, 100
sc.frame_set(g["N"] if frame == "last" else int(frame))
if engine == "cycles":
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for dev in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = dev; prefs.get_devices()
            if any(d.type == dev for d in prefs.devices):
                break
        except Exception:
            pass
    for d in prefs.devices:
        d.use = d.type != "CPU"
    sc.cycles.device = "GPU"
    sc.cycles.samples = 128
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPTIX" if prefs.compute_device_type == "OPTIX" else "OPENIMAGEDENOISE"
    for o in sc.objects:
        if o.type == "MESH" and any(m and m.name == "floor" for m in o.data.materials):
            o.is_shadow_catcher = True
            print("SHADOW CATCHER", o.name)
    print("CYCLES DEVICE", prefs.compute_device_type, [d.name for d in prefs.devices if d.use])
else:
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 32
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = out
t = time.time()
bpy.ops.render.render(write_still=True)
print("RENDERED", engine, "%.1fs" % (time.time() - t))
