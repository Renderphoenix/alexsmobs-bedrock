import sys, os, time, bpy
a = sys.argv[sys.argv.index("--") + 1:]
shot = a[0]
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, "..", "shots", shot + ".py"), encoding="utf8").read().replace("finish(N)", "setup_frames(N, 32)")
sys.argv = [sys.argv[0], "--", "render", "60"]
t0 = time.time(); g = {"__name__": "shot"}; exec(src, g); print("SETUP %.1fs" % (time.time() - t0))
sc = bpy.context.scene; ee = sc.eevee
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, 100
print("EEVEE", {k: getattr(ee, k) for k in ("use_shadows", "use_raytracing", "shadow_ray_count", "shadow_step_count", "taa_render_samples", "use_volumetric_shadows", "fast_gi_method") if hasattr(ee, k)})
def tf(label, n=4, save=False, comp=15):
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.compression = comp
    t = time.time()
    for f in range(10, 10 + n):
        sc.frame_set(f)
        bpy.ops.render.render(write_still=save) if save else bpy.ops.render.render()
        if save: pass
    print("%-28s %.2fs/frame" % (label, (time.time() - t) / n))
sc.render.filepath = "H:/AlexsMobs2_Trailer/work/_prof.png"
t = time.time()
for f in range(10, 14): sc.frame_set(f)
print("%-28s %.3fs/frame" % ("frame_set only", (time.time() - t) / 4))
tf("render 32spp no save")
tf("render+save png c15", save=True, comp=15)
tf("render+save png c0", save=True, comp=0)
ee.taa_render_samples = 16; tf("render 16spp no save")
ee.taa_render_samples = 64; tf("render 64spp no save")
