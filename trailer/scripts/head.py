# Shared header for shot scripts. A shot script is two lines plus its body:
#     SCENE = "b01_cats"
#     exec(open(r"<skill>/scripts/head.py").read())
#     ...body using tlib + the helpers below...
#     finish()
# Run:  blender -b -P shot.py -- render <fps>      (full frames)
#       blender -b -P shot.py -- preview <fps>     (one half-size still, <work>/render_<fps>/<scene>_preview.png)
#       or through the Blender MCP bridge with MODE='preview' set before exec.
# Needs TRAILER_CONFIG (env) or CONFIG_PATH (global) -> trailer.json.
import sys, os, json, math
_here = os.path.dirname(os.path.abspath(globals().get("__file__", ""))) if "__file__" in globals() else None
_skill = globals().get("SKILL_DIR") or os.environ.get("TRAILER_SKILL_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "skills", "minecraft-addon-trailer")
exec(open(os.path.join(_skill, "scripts", "tlib.py"), encoding="utf8").read())
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = globals().get('MODE') or (ARGS[0] if ARGS else 'preview')
FPS = int(globals().get('FPS_OVERRIDE') or (ARGS[1] if len(ARGS) > 1 else CFG.get("fps", 24)))
OUT = os.path.join(S, "render_%d" % FPS) + "/"
os.makedirs(OUT, exist_ok=True)
PLAN = json.load(open(os.path.join(S, "plan_%d.json" % FPS)))
SC = next(s for s in PLAN["scenes"] if s["name"] == SCENE)
N = SC["len"]
B = SC["beats"] + [N + 20] * 20       # beat frames inside this shot (1-based); padded so B[k] never crashes
H = SC["half"] + [N + 20] * 40        # half-beat frames


def finish(preview_frame=None):
    setup_frames(N, CFG.get("samples", 32))
    sc = bpy.context.scene
    sc.render.fps = FPS
    if MODE == 'preview':
        sc.render.resolution_percentage = 50
        render(OUT + SCENE + '_preview.png', preview_frame or int(N * 0.7))
    else:
        fmt = CFG.get("frame_format", "PNG")          # "JPEG" (quality 95) saves ~4x disk at 60 fps
        sc.render.image_settings.file_format = fmt
        if fmt == "PNG":
            sc.render.image_settings.compression = int(CFG.get("png_compression", 15))
        if fmt == "JPEG":
            sc.render.image_settings.quality = 95
        sc.render.resolution_percentage = int(CFG.get("render_pct", 100))
        sc.render.filepath = OUT + SCENE + '/'
        bpy.ops.render.render(animation=True)


def title(cam, text, u=0, v=0.78, f=1, color=None, size=0.18, align="CENTER"):
    t = label2(cam, text, u, v, size=size, font="ten", color=color, align=align); pop_in(t, f); return t


def caption(cam, text, u=0, v=0.635, f=1, color=None, size=0.045, align="CENTER"):
    c = label2(cam, text, u, v, size=size, color=color, align=align); slide_in(c, f, dy=-0.05); return c


def tag(cam, text, f, color="#16316b", u=0, v=-0.82, txt="#ffffff", size=0.035):
    w = 0.53 * size * len(text) + 0.05
    r = rect2(cam, u, v, w, size * 2, color, name="tag_%s_%d" % (text, f)); pop_in(r, f)
    l = label2(cam, text, u, v, size=size, color=txt, align="CENTER", spacing=1.2, name="tagl_%s_%d" % (text, f), auto=False); pop_in(l, f + 2)


def tag_under(cam, root, text, f, color, txt="#ffffff", size=0.03, v=None):
    mn, mx = bbox_of([root])
    p = ((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z)
    u = screen_uv(cam, p)[0]
    vv = v if v is not None else screen_uv(cam, p)[1] - 0.09
    tag(cam, text, f, color=color, u=u, v=vv, txt=txt, size=size)


def bob(root, amp=0.1, cycles=1.0, base=None):
    base = root.location.z if base is None else base
    for f in range(1, N + 1):
        root.location.z = base + amp * math.sin(f / N * 2 * math.pi * cycles)
        root.keyframe_insert("location", frame=f)


def category(name, cap, items, pal, anim="idle", rot=-90, gap=0.45, view=(0.0, 1, 0.12), frac=0.88, v=-0.12,
             tags=True, tag_v=-0.74, scroll=0.0, flyz=None):
    """One-bar category shot: gradient (+ scrolling checker if scroll), a row of mobs side by side, title on the
    cut, caption on beat 1, a name tag under each mob on successive half-beats. pal = (bottom, top, dark accent)."""
    reset(1920, 1080)
    studio([(0.0, pal[0]), (1.0, pal[1])], checker="#ffffff" if scroll else None, checker_mix=0.07, checker_scale=9,
           shadow=pal[2], shadow_strength=0.33, key=(-0.4, 1.0, 1.5), key_energy=3.0, ambient=1.3)
    if scroll:
        scroll_bg(scroll, 0)
    roots = row(None, items, anim=anim, gap=gap, rot=rot, f1=N)
    if flyz is not None:
        for i, r in enumerate(roots):
            bob(r, 0.08, 1.0 + 0.3 * i, flyz)
    cam = fit_camera(roots, view=view, frac=frac, u=0.0, v=v)
    title(cam, name, v=0.8, f=2)
    if cap:
        caption(cam, cap, v=0.665, f=B[1])
    if tags:
        for i, r in enumerate(roots):
            tag_under(cam, r, r["label"], H[1 + i], pal[2], v=tag_v, size=0.026)
    return cam, roots
