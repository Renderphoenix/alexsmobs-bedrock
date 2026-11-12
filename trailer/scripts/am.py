# Alex's Mobs 2 trailer helpers (exec'd after head.py)
ITEM = RP + "textures/alexsmobs/item/"


def IDLE(id):
    a = poses_of(id)["anims"]
    if "idle" in a:
        return "idle", [("breathe", 0.0)] if "breathe" in a else []
    return ("breathe" if "breathe" in a else None), []


def I(id, **kw):
    a, l = IDLE(id)
    d = {"id": id, "anim": a, "layers": l}
    d.update(kw)
    return d


def live(root, f0=1, f1=None, t0=0.0, blend=10):
    a, l = IDLE(root["mob"])
    play(root, a, f0, f1 or N, t0=t0, layers=l, blend=blend)


def alen(root, a):
    return poses_of(root["mob"])["anims"][a]["length"]


def act(root, a, f, blend=6, after=True, speed=1.0):
    """idle until f, play one-shot action a, then back to idle (all crossfaded)."""
    ia, il = IDLE(root["mob"])
    play(root, ia, 1, f, layers=il)
    n = int(alen(root, a) * FPS / speed)
    e = min(N, f + n)
    play(root, a, f, e, speed=speed, blend=blend)
    if after and e < N:
        play(root, ia, e, N, layers=il, blend=8)


def spin(root, f0, f1, deg=360.0, ease_kind="LINEAR"):
    z0 = root.rotation_euler[2]
    root.keyframe_insert("rotation_euler", frame=f0)
    root.rotation_euler[2] = z0 + math.radians(deg)
    root.keyframe_insert("rotation_euler", frame=f1)
    ease(root, ease_kind, "EASE_IN_OUT", "rotation_euler")


def orbit(cam, center, f0, f1, deg=60.0):
    e = bpy.data.objects.new("orbit", None)
    bpy.context.collection.objects.link(e)
    e.location = center
    bpy.context.view_layer.update()
    mw = cam.matrix_world.copy()
    cam.parent = e
    cam.matrix_world = mw
    e.keyframe_insert("rotation_euler", frame=f0)
    e.rotation_euler[2] = math.radians(deg)
    e.keyframe_insert("rotation_euler", frame=f1)
    ease(e, "SINE", "EASE_IN_OUT")
    return e


def _icon_mat(name, img):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = img; t.interpolation = "Closest"
    em = nt.nodes.new("ShaderNodeEmission")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    cut = nt.nodes.new("ShaderNodeMath"); cut.operation = "GREATER_THAN"; cut.inputs[1].default_value = 0.5
    nt.links.new(t.outputs[0], em.inputs[0])
    nt.links.new(t.outputs["Alpha"], cut.inputs[0])
    nt.links.new(cut.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    try:
        m.surface_render_method = "DITHERED"
    except Exception:
        pass
    return m


def icon2(cam, path, u, v, size=0.12, dist=2.98, name="icon"):
    """Pixel icon (item texture png) glued to the camera, size = fraction of frame height."""
    img = bpy.data.images.load(path, check_existing=True)
    loc, hw, hh = _local(cam, u, v, dist)
    o = new_plane(name, 1)
    o.parent = cam
    s = size * hh * 2
    w, h = img.size[0], max(1, img.size[1])
    if h > w:
        k = w / h
        for li, d in zip(range(4), o.data.uv_layers[0].data):
            d.uv = (d.uv[0], 1 - k + d.uv[1] * k)
        h = w
    o.scale = (s * w / h, s, 1)
    o.location = loc
    o.data.materials.append(_icon_mat(name + "_m", img))
    return o


def item(cam, n, u, v, size=0.12, f=1):
    o = icon2(cam, ITEM + n + ".png", u, v, size, name="it_" + n)
    pop_in(o, f)
    return o


HEART = ["01100110", "11111111", "11111111", "11111111", "01111110", "00111100", "00011000", "00000000"]


def heart(cam, u, v, size=0.06, f=1):
    img = bpy.data.images.get("heart_px") or pixel_image("heart_px", 8, lambda x, y: (0.93, 0.16, 0.25, 1.0) if HEART[y][x] == "1" else (0, 0, 0, 0))
    loc, hw, hh = _local(cam, u, v, 2.97)
    o = new_plane("heart", 1); o.parent = cam
    s = size * hh * 2; o.scale = (s, s, 1); o.location = loc
    o.data.materials.append(_icon_mat("heart_m", img))
    pop_in(o, f)
    return o


def block(id, loc=(0, 0, 0), rot=0.0, scale=1.0, tex=None):
    return mob("blk_" + id, None, 0, loc=loc, rot=rot, scale=scale, tex=tex or ("alexsmobs/block/" + id))


def baby(id, anim=None, loc=(0, 0, 0), rot=0.0, scale=0.5):
    a = anim or IDLE(id)[0]
    r = mob(id, a, 0, loc=loc, rot=rot, scale=scale, layers=[("baby", 0.0)])
    r["baby"] = True
    return r


def hero(id, title_txt, pal, cap=None, anim=None, deg=200.0, end=-40.0, scale=1.0, frac=0.5, checker=True, layers=None, rot=None):
    """One-bar spin hero: mob turning on a turntable, name in Minecraft Ten."""
    studio([(0.0, pal[0]), (1.0, pal[1])], checker="#ffffff" if checker else None, checker_mix=0.07, checker_scale=9,
           shadow=pal[2], shadow_strength=0.33, key=(-0.4, 1.0, 1.5), key_energy=3.0, ambient=1.3)
    if checker:
        scroll_bg(0.006, 0.0)
    m = mob(id, anim or IDLE(id)[0], 0, rot=end, scale=scale)
    if anim:
        play(m, anim, 1, N, layers=layers or ())
    else:
        live(m)
    m.rotation_euler[2] = math.radians(end + 90)
    a1 = fit_camera([m], view=(0.0, 1, 0.18), frac=frac, u=0.0, v=-0.12); bpy.data.objects.remove(a1)
    m.rotation_euler[2] = math.radians(end)
    cam = fit_camera([m], view=(0.0, 1, 0.18), frac=frac, u=0.0, v=-0.12)
    m.rotation_euler[2] = math.radians(end - deg)
    spin(m, 1, N, deg, "SINE")
    cam_move(cam, 1, N, tuple(cam.location * 0.88))
    orbit(cam, (0, 0, 0), 1, N, -22)
    title(cam, title_txt, 0, 0.78, f=2, size=0.13)
    if cap:
        caption(cam, cap, 0, 0.63, f=B[1], size=0.042)
    return m, cam


def hop(root, f0=1, f1=None, period=0.6, h=0.6, base=None):
    """Kangaroo bounce synced with the baked hop (v.jump_rotation = sin(pi * phase))."""
    base = root.location.z if base is None else base
    for f in range(f0, (f1 or N) + 1):
        ph = ((f - f0) / FPS % period) / period
        root.location.z = base + h * math.sin(math.pi * ph)
        root.keyframe_insert("location", frame=f)


def bank(root, deg=10.0, cycles=1.0):
    """Gentle roll/pitch sway for flyers."""
    r0 = tuple(root.rotation_euler)
    for f in range(1, N + 1):
        a = 2 * math.pi * cycles * f / N
        root.rotation_euler = (r0[0] + math.radians(deg * 0.4 * math.sin(a + 1.3)), r0[1] + math.radians(deg * math.sin(a)), r0[2])
        root.keyframe_insert("rotation_euler", frame=f)
