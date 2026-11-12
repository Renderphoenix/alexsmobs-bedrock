# Minecraft add-on trailer toolkit for Blender 5.x (studio motion-graphics style).
# Loaded with exec() by scene scripts (scripts/head.py does it). Paths come from the trailer config JSON
# pointed to by the TRAILER_CONFIG environment variable (or a global CONFIG_PATH set before exec).
import bpy, math, random, os, json
from mathutils import Vector

_cfg_path = globals().get("CONFIG_PATH") or os.environ.get("TRAILER_CONFIG")
if not _cfg_path:
    raise RuntimeError("Set TRAILER_CONFIG (env) or CONFIG_PATH (global) to the trailer.json config")
CFG = json.load(open(_cfg_path, encoding="utf8"))
S = CFG["work"].rstrip("/\\")
NS = CFG.get("namespace", "rpc")
FONT_TEN = CFG["fonts"]["ten"]
FONT_REG = CFG["fonts"]["regular"]
FPS = 24


def fr(x):
    """A duration written in 24 fps frames, converted to the current frame rate."""
    return max(1, int(round(x * FPS / 24.0)))


def set_fps(f):
    global FPS
    FPS = f
    bpy.context.scene.render.fps = f
AMBIENT = 1.0


def reset(w=1920, h=1080):
    bpy.ops.wm.read_homefile(use_empty=True)
    _last_play.clear()
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.engine = "BLENDER_EEVEE"
    try:
        sc.eevee.taa_render_samples = 64
        sc.eevee.use_shadows = True
    except Exception:
        pass
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.film_transparent = False
    return sc


def hexc(h, a=1.0):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)



def _obj(name, verts, faces, uvs=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs:
        lay = me.uv_layers.new()
        for poly in me.polygons:
            for li, c in zip(poly.loop_indices, [(0, 0), (1, 0), (1, 1), (0, 1)]):
                lay.data[li].uv = c
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def new_plane(name="plane", size=1.0):
    h = size / 2
    return _obj(name, [(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0)], [(0, 1, 2, 3)])


def new_cube(name="cube", size=1.0):
    h = size / 2
    v = [(x, y, z) for z in (-h, h) for y in (-h, h) for x in (-h, h)]
    f = [(4, 5, 7, 6), (0, 2, 3, 1), (0, 1, 5, 4), (3, 2, 6, 7), (2, 0, 4, 6), (1, 3, 7, 5)]
    return _obj(name, v, f)


# ---------- sky ----------
def sky(stops):
    """Screen-space vertical gradient. stops = [(pos 0 bottom..1 top, '#hex'), ...]"""
    w = bpy.data.worlds.new("sky")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    bg = nt.nodes.new("ShaderNodeBackground")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    amb = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(tc.outputs["Window"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    els = ramp.color_ramp.elements
    for i, (p, c) in enumerate(stops):
        e = els[i] if i < len(els) else els.new(p)
        e.position = p
        e.color = hexc(c)
    # camera rays see the gradient, lighting uses a soft neutral ambient
    amb.inputs[0].default_value = hexc(stops[-1][1])
    amb.inputs[1].default_value = AMBIENT
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(amb.outputs[0], mix.inputs[1])
    nt.links.new(bg.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])


def sun(rot=(50, 0, 35), energy=3.5, color="#fff2dd", angle=4):
    d = bpy.data.lights.new("sun", "SUN")
    d.energy = energy
    d.color = hexc(color)[:3]
    d.angle = math.radians(angle)
    o = bpy.data.objects.new("sun", d)
    bpy.context.collection.objects.link(o)
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


def sun_from(direction, energy=3.5, color="#fff2dd", angle=4, name="sun"):
    """Sun shining FROM `direction` (vector pointing at the sun)."""
    d = bpy.data.lights.new(name, "SUN")
    d.energy = energy
    d.color = hexc(color)[:3]
    d.angle = math.radians(angle)
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.rotation_euler = (-Vector(direction)).to_track_quat("-Z", "Y").to_euler()
    return o


def rim(rot=(60, 0, 200), energy=2.0, color="#ffd2a0"):
    return sun(rot, energy, color, 2)


# ---------- pixel textures we paint ourselves ----------
def pixel_image(name, size, fn):
    img = bpy.data.images.new(name, size, size)
    px = []
    for y in range(size):
        for x in range(size):
            px += list(fn(x, size - 1 - y))
    img.pixels = px
    img.pack()
    return img


def pixel_mat(name, img, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Closest"
    nt.links.new(t.outputs[0], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    try:
        bsdf.inputs["Specular IOR Level"].default_value = 0.1
    except Exception:
        pass
    return m


def flat_mat(name, color, emit=0.0, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hexc(color)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = hexc(color)
        b.inputs["Emission Strength"].default_value = emit
    return m


PAL = {
    "grass": ["#5f9c3a", "#6bab41", "#78b84a", "#548c33", "#86c454"],
    "dry": ["#b8a15a", "#c7b066", "#a8914d", "#d2bd72", "#998244"],
    "snow": ["#e8eef5", "#f4f8fc", "#d8e2ee", "#ffffff", "#ccd8e6"],
    "dirt": ["#7a5536", "#8a623f", "#6b492e", "#946c47", "#5e3f27"],
}


VAN = CFG.get("vanilla_blocks", "").rstrip("/\\") + "/"
# vanilla block faces: (top, side, top tint or None, side overlay tint or None)
BLOCKS = {
    "grass": ("grass_carried.png", "grass_side_carried.png", None),
    "savanna": ("grass_top.png", "grass_side_carried.png", "#bfb755"),
    "sand": ("sand.png", "sand.png", None),
    "snow": ("snow.png", "grass_side_snowed.png", None),
    "dirt": ("dirt.png", "dirt.png", None),
}


def tex_mat(name, file, tint=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    img = bpy.data.images.load(VAN + file, check_existing=True)
    m = pixel_mat(name, img)
    if tint:
        nt = m.node_tree
        t = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs[7].default_value = hexc(tint)
        nt.links.new(t.outputs[0], mix.inputs[6])
        nt.links.new(mix.outputs[2], nt.nodes["Principled BSDF"].inputs["Base Color"])
    return m


def block_mats(top="grass", seed=1):
    tf, sf, tint = BLOCKS[top]
    return tex_mat(top + "_top", tf, tint), tex_mat(top + "_side", sf)


def ground(radius=7, top="grass", seed=3, center=(0, 0), hills=None, size=1.0, z=0.0):
    """Disc of blocks (each `size` m). hills: fn(x,y)->extra block height."""
    import bmesh
    me = bpy.data.meshes.new("ground")
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    mt, ms = block_mats(top, seed)
    rnd = random.Random(seed)
    cells = {}
    for ix in range(-radius, radius + 1):
        for iy in range(-radius, radius + 1):
            if ix * ix + iy * iy <= radius * radius + rnd.random() * radius:
                h = hills(ix, iy) if hills else 0
                cells[(ix, iy)] = h
    for (ix, iy), h in cells.items():
        x0, y0 = center[0] + ix * size, center[1] + iy * size
        for k in range(-1, h + 1):
            zz = z - size + k * size
            v = [bm.verts.new((x0 + dx * size - size / 2, y0 + dy * size - size / 2, zz + dz * size)) for dz in (0, 1) for dy in (0, 1) for dx in (0, 1)]
            faces = [((4, 5, 7, 6), 0), ((0, 2, 3, 1), 1), ((0, 1, 5, 4), 1), ((3, 2, 6, 7), 1), ((2, 0, 4, 6), 1), ((1, 3, 7, 5), 1)]
            for idx, mat in faces:
                try:
                    f = bm.faces.new([v[i] for i in idx])
                except ValueError:
                    continue
                f.material_index = mat if k == h else 2
                for l, c in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
                    l[uv].uv = c
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("ground", me)
    bpy.context.collection.objects.link(o)
    me.materials.append(mt)
    me.materials.append(ms)
    me.materials.append(tex_mat("dirt_all", "dirt.png"))
    return o


KINDS = {
    # kind: (top file, side file, tint, alpha)
    "acacia_log": ("log_acacia_top.png", "log_acacia.png", None, False),
    "acacia_leaves": ("leaves_acacia_carried.tga", "leaves_acacia_carried.tga", None, True),
    "oak_log": ("log_oak_top.png", "log_oak.png", None, False),
    "oak_leaves": ("leaves_oak_carried.tga", "leaves_oak_carried.tga", None, True),
    "spruce_log": ("log_spruce_top.png", "log_spruce.png", None, False),
    "spruce_leaves": ("leaves_spruce_carried.tga", "leaves_spruce_carried.tga", None, True),
}


def kind_mats(kind):
    tf, sf, tint, alpha = KINDS[kind]
    out = []
    for nm, f in ((kind + "_t", tf), (kind + "_s", sf)):
        m = tex_mat(nm, f, tint)
        if alpha and not m.get("alpha_done"):
            nt = m.node_tree
            t = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
            nt.links.new(t.outputs["Alpha"], nt.nodes["Principled BSDF"].inputs["Alpha"])
            try:
                m.surface_render_method = "DITHERED"
            except Exception:
                pass
            m["alpha_done"] = 1
        out.append(m)
    return out


def blocks(cells, size=1.0, offset=(0, 0, 0), name="blocks"):
    """cells: {(ix,iy,iz): kind}. Faces between two opaque blocks are culled."""
    import bmesh
    kinds = sorted(set(cells.values()))
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    mats = []
    for k in kinds:
        mats += kind_mats(k)
    dirs = [((0, 0, 1), (4, 5, 7, 6), 0), ((0, 0, -1), (0, 2, 3, 1), 0), ((0, -1, 0), (0, 1, 5, 4), 1),
            ((0, 1, 0), (3, 2, 6, 7), 1), ((-1, 0, 0), (2, 0, 4, 6), 1), ((1, 0, 0), (1, 3, 7, 5), 1)]
    for (ix, iy, iz), k in cells.items():
        alpha = KINDS[k][3]
        x0, y0, z0 = offset[0] + ix * size, offset[1] + iy * size, offset[2] + iz * size
        v = [bm.verts.new((x0 + dx * size, y0 + dy * size, z0 + dz * size)) for dz in (0, 1) for dy in (0, 1) for dx in (0, 1)]
        for d, idx, side in dirs:
            nb = cells.get((ix + d[0], iy + d[1], iz + d[2]))
            if nb and not KINDS[nb][3] and not alpha:
                continue
            f = bm.faces.new([v[i] for i in idx])
            f.material_index = kinds.index(k) * 2 + side
            for l, c in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
                l[uv].uv = c
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def acacia(x, y, z=0, seed=0, size=1.0):
    rnd = random.Random(seed)
    c = {}
    h = rnd.randint(3, 4)
    dx, dy = rnd.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
    px, py = 0, 0
    for k in range(h + 2):
        if k >= h - 1:
            px, py = px + dx, py + dy
        c[(px, py, k)] = "acacia_log"
    top = h + 2
    for ox in range(-2, 3):
        for oy in range(-2, 3):
            if abs(ox) + abs(oy) <= 3:
                c.setdefault((px + ox, py + oy, top), "acacia_leaves")
            if abs(ox) + abs(oy) <= 1:
                c.setdefault((px + ox, py + oy, top + 1), "acacia_leaves")
    return blocks(c, size, (x, y, z), "acacia")


def oak(x, y, z=0, seed=0, size=1.0, kind="oak"):
    rnd = random.Random(seed)
    c = {}
    h = rnd.randint(4, 5)
    for k in range(h):
        c[(0, 0, k)] = kind + "_log"
    for k, r in ((h - 2, 2), (h - 1, 2), (h, 1), (h + 1, 1)):
        for ox in range(-r, r + 1):
            for oy in range(-r, r + 1):
                if r == 2 and abs(ox) == 2 and abs(oy) == 2 and rnd.random() < 0.6:
                    continue
                if r == 1 and k == h + 1 and abs(ox) + abs(oy) == 2:
                    continue
                c.setdefault((ox, oy, k), kind + "_leaves")
    return blocks(c, size, (x, y, z), kind)


def clouds(z=30, seed=5, n=6, spread=60, size=4.0, color="#ffffff"):
    rnd = random.Random(seed)
    m = flat_mat("cloud", color, emit=0.6, rough=1)
    for i in range(n):
        w, d = rnd.randint(3, 7), rnd.randint(2, 4)
        o = new_cube("cloud")
        o.scale = (w * size, d * size, size * 0.5)
        o.location = (rnd.uniform(-spread, spread), rnd.uniform(-spread * 0.3, spread), z + rnd.uniform(-3, 3))
        o.data.materials.append(m)


def tallgrass(n=60, radius=8, seed=2, center=(0, 0), avoid=1.5, keep_out=None):
    img = bpy.data.images.load(VAN + "tallgrass_carried.tga", check_existing=True) if os.path.exists(VAN + "tallgrass_carried.tga") else bpy.data.images.load(VAN + "tallgrass.tga")
    m = pixel_mat("tallgrass", img)
    nt = m.node_tree
    t = [x for x in nt.nodes if x.type == "TEX_IMAGE"][0]
    nt.links.new(t.outputs["Alpha"], nt.nodes["Principled BSDF"].inputs["Alpha"])
    try:
        m.surface_render_method = "DITHERED"
    except Exception:
        pass
    rnd = random.Random(seed)
    for i in range(n):
        x, y = rnd.randint(-radius, radius), rnd.randint(-radius, radius)
        if x * x + y * y > radius * radius or (abs(x) < avoid and abs(y) < avoid):
            continue
        if keep_out and keep_out(x, y):
            continue
        for a in (45, 135):
            o = new_plane("grass", 0.9)
            o.rotation_euler = (math.radians(90), 0, math.radians(a))
            o.location = (center[0] + x, center[1] + y, 0.45)
            o.data.materials.append(m)


# ---------- mobs ----------
RP = CFG["rp"].rstrip("/\\") + "/"
FBX = S + "/fbx/"


def _win_override():
    import contextlib
    if bpy.app.background or not bpy.context.window_manager.windows:
        return contextlib.nullcontext()
    w = bpy.context.window_manager.windows[0]
    return bpy.context.temp_override(window=w, screen=w.screen, area=w.screen.areas[0])


def game_scale(id):
    import json
    if not os.path.exists(RP + "entity/%s/%s.entity.json" % (NS, id)):
        return 1.0
    ce = json.load(open(RP + "entity/%s/%s.entity.json" % (NS, id), encoding="utf8"))["minecraft:client_entity"]["description"]
    try:
        return float((ce.get("scripts") or {}).get("scale", 1))
    except Exception:
        return 1.0


def _layer_paths(id):
    """Extra layers a client entity draws on top of the base texture: 'overlay' (alpha-tested decal, e.g. tusks)
    and 'glow' (emissive eyes/markings). Keys follow the add-on's client entity texture names."""
    import json
    f = RP + "entity/%s/%s.entity.json" % (NS, id)
    if not os.path.exists(f):
        return {}
    t = json.load(open(f, encoding="utf8"))["minecraft:client_entity"]["description"].get("textures", {})
    return {k: RP + t[k] + ".png" for k in ("overlay", "glow") if k in t and os.path.exists(RP + t[k] + ".png")}


def mob_texture(id, variant="default", tex=None):
    """Pixel-exact entity material: base texture as a hard alpha cutout, plus the entity's overlay layer (alpha over)
    and glow layer (emission). Flat (zero-thickness) cubes are thickened in _anti_zfight instead of culling
    back faces, because culling hides mirrored cubes."""
    import json
    layers = {}
    if tex or not os.path.exists(RP + "entity/%s/%s.entity.json" % (NS, id)):
        tex = tex or id
        path = (RP + "textures/" + tex + ".png") if "/" in tex else (RP + "textures/entity/%s/" % NS + tex + ".png")
        variant = tex
    else:
        ce = json.load(open(RP + "entity/%s/%s.entity.json" % (NS, id), encoding="utf8"))["minecraft:client_entity"]["description"]
        path = RP + ce["textures"].get(variant, ce["textures"].get("default") or ce["textures"].get("v0") or list(ce["textures"].values())[0]) + ".png"
        layers = _layer_paths(id)
    name = "tex_%s_%s" % (id, variant)
    m = bpy.data.materials.get(name)
    if m:
        return m
    img = bpy.data.images.load(path, check_existing=True)
    m = pixel_mat(name, img)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    t = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
    uv = nt.nodes.new("ShaderNodeTexCoord")

    def tex_node(file):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(file, check_existing=True)
        n.interpolation = "Closest"
        nt.links.new(uv.outputs["UV"], n.inputs[0])
        return n

    def gt(sock):  # hard 0/1 alpha like Minecraft's alpha test
        c = nt.nodes.new("ShaderNodeMath"); c.operation = "GREATER_THAN"; c.inputs[1].default_value = 0.5
        nt.links.new(sock, c.inputs[0])
        return c.outputs[0]

    color, alpha = t.outputs["Color"], gt(t.outputs["Alpha"])
    if "overlay" in layers:
        o = tex_node(layers["overlay"])
        oa = gt(o.outputs["Alpha"])
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
        nt.links.new(oa, mix.inputs["Factor"]); nt.links.new(color, mix.inputs["A"]); nt.links.new(o.outputs["Color"], mix.inputs["B"])
        mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MAXIMUM"
        nt.links.new(alpha, mx.inputs[0]); nt.links.new(oa, mx.inputs[1])
        color, alpha = mix.outputs["Result"], mx.outputs[0]
    nt.links.new(color, bsdf.inputs["Base Color"])
    nt.links.new(alpha, bsdf.inputs["Alpha"])
    if "glow" in layers:
        g = tex_node(layers["glow"])
        ga = gt(g.outputs["Alpha"])
        k = nt.nodes.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = 2.0
        nt.links.new(ga, k.inputs[0])
        nt.links.new(g.outputs["Color"], bsdf.inputs["Emission Color"])
        nt.links.new(k.outputs[0], bsdf.inputs["Emission Strength"])
    try:
        m.surface_render_method = "DITHERED"
        m.use_transparent_shadow = False
    except Exception:
        pass
    return m
    img = bpy.data.images.load(path, check_existing=True)
    m = pixel_mat(name, img)
    nt = m.node_tree
    t = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
    # Minecraft entity alpha is a hard cutout: fully visible or gone, never see-through
    cut = nt.nodes.new("ShaderNodeMath"); cut.operation = "GREATER_THAN"; cut.inputs[1].default_value = 0.5
    nt.links.new(t.outputs["Alpha"], cut.inputs[0])
    nt.links.new(cut.outputs[0], nt.nodes["Principled BSDF"].inputs["Alpha"])
    try:
        m.surface_render_method = "DITHERED"
        m.use_transparent_shadow = False
    except Exception:
        pass
    return m


POSES = S + "/poses/"
_pose_cache = {}


def poses_of(id):
    import json
    if id not in _pose_cache:
        _pose_cache[id] = json.load(open(POSES + id + ".json"))
    return _pose_cache[id]


def mob(id, anim="idle", t=0.0, loc=(0, 0, 0), rot=0.0, scale=1.0, name=None, variant="default", hide=(), layers=(), tex=None):
    """Import mob FBX (mesh only), RP texture, posed from Blockbench-baked poses: `anim` at time t seconds.
    anim: 'walk', 'run', 'idle', 'attack', 'life.idle_3', ... or None for rest. Faces +Y at rot 0."""
    before_o, before_a = set(bpy.data.objects), set(bpy.data.actions)
    with _win_override():
        bpy.ops.wm.fbx_import(filepath=FBX + id + ".fbx")
    new = [o for o in bpy.data.objects if o not in before_o]
    for a in [a for a in bpy.data.actions if a not in before_a]:
        bpy.data.actions.remove(a)
    root = bpy.data.objects.new(name or ("mob_" + id), None)
    bpy.context.collection.objects.link(root)
    mat = mob_texture(id, variant, tex)
    P = poses_of(id)
    bones = {}
    for o in new:
        if o.animation_data:
            o.animation_data_clear()
        base = o.name.split(".")[0]
        if o.type == "EMPTY" and base in P["rest"] and o.parent is not None:
            bones[base] = o.name
            o.rotation_mode = "XYZ"
        if o.parent is None:
            o.parent = root
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(mat)
    for o in new:
        b0 = o.name.split(".")[0]
        if b0 in hide or any(h.endswith("*") and b0.startswith(h[:-1]) for h in hide):
            for c in [o] + list(o.children_recursive):
                c.hide_render = c.hide_viewport = True
    _anti_zfight([o for o in new if o.type == "MESH"], root)
    root["objs"] = [o.name for o in new]
    root["bones"] = bones
    root["mob"] = id
    root.location = loc
    root.rotation_euler = (0, 0, math.radians(rot))
    scale *= game_scale(id)
    root.scale = (scale, scale, scale)
    pose(root, anim, t, layers)
    return root


ZF_BASE = 0.0025  # metres a cube grows per side (1 px = 0.0625 m)


def _anti_zfight(meshes, root):
    """Coplanar faces of touching/overlapping cubes z-fight. Grow every cube slightly so no two faces share a
    plane; smaller (detail) cubes grow more so they always win over the big body cubes."""
    bpy.context.view_layer.update()
    info = []
    for o in meshes:
        me = o.data
        if me.users > 1:
            o.data = me = me.copy()
        ws = o.matrix_world.to_scale()
        vs = [v.co for v in me.vertices]
        if not vs:
            continue
        mn = Vector([min(v[i] for v in vs) for i in range(3)])
        mx = Vector([max(v[i] for v in vs) for i in range(3)])
        size = Vector([(mx[i] - mn[i]) * abs(ws[i]) for i in range(3)])
        info.append((size.x * size.y * size.z, o, (mn + mx) / 2, ws))
    info.sort(key=lambda x: x[0])  # smallest first: bigger cubes grow more and win shared planes
    for rank, (_, o, c, ws) in enumerate(info):
        d = ZF_BASE * (1 + min(rank, 12) * 0.25)
        for v in o.data.vertices:
            for i in range(3):
                off = v.co[i] - c[i]
                if abs(off) > 1e-6:
                    v.co[i] += (d / max(abs(ws[i]), 1e-9)) * (1 if off > 0 else -1)
        # flat (zero-thickness) cubes: front and back faces share a plane and flicker; split them along their normals
        me = o.data
        for i in range(3):
            vs = [v.co[i] for v in me.vertices]
            if vs and max(vs) - min(vs) < 1e-5:
                eps = 0.6 * d / max(abs(ws[i]), 1e-9)
                moved = set()
                for poly in me.polygons:
                    n = poly.normal[i]
                    if abs(n) > 0.9:
                        for vi in poly.vertices:
                            if vi not in moved:
                                me.vertices[vi].co[i] += eps * (1 if n > 0 else -1)
                                moved.add(vi)
        o.data.update()


def _frame(id, anim, t):
    P = poses_of(id)
    if not anim:
        return P["rest"]
    if anim not in P["anims"]:
        return P["rest"]
    A = P["anims"][anim]
    fr = A["frames"]
    i = int(round(t * P["fps"]))
    i = i % (len(fr) - 1) if (A["loop"] and len(fr) > 1) else min(i, len(fr) - 1)
    return fr[i]


def _apply(root, snap, key=None):
    for b, n in root["bones"].items():
        v = snap.get(b)
        if not v:
            continue
        o = bpy.data.objects[n]
        o.location = (v[0] * 6.25, v[1] * 6.25, v[2] * 6.25)
        o.rotation_euler = [math.radians(x) for x in v[3:6]]
        o.scale = v[6:9]
        if key is not None:
            for p in ("location", "rotation_euler", "scale"):
                o.keyframe_insert(p, frame=key)


def _combine(id, layers):
    """Bedrock-style additive layering: rest + sum(anim - rest). layers = [(anim, t), ...]"""
    rest = poses_of(id)["rest"]
    out = {b: list(v) for b, v in rest.items()}
    for anim, t in layers:
        if not anim:
            continue
        fr = _frame(id, anim, t)
        for b, v in fr.items():
            r = rest.get(b)
            if not r:
                continue
            o = out[b]
            for i in range(6):
                o[i] += v[i] - r[i]
            for i in range(6, 9):
                o[i] *= (v[i] / r[i]) if r[i] else 1
    return out


def pose(root, anim, t=0.0, layers=()):
    """Static pose: animation `anim` at time t seconds, plus extra additive layers [(anim, t), ...]."""
    layers = _auto_layers(root, anim, layers) if "mob" in root else layers
    if layers:
        _apply(root, _combine(root["mob"], [(anim, t)] + list(layers)))
    else:
        _apply(root, _frame(root["mob"], anim, t))
    return root


def animate(root, track, start=1):
    """Keyframe a sequence: track = [(anim, seconds, speed), ...] played back to back from scene frame `start`."""
    f = start
    for anim, dur, *rest in track:
        speed = rest[0] if rest else 1.0
        for k in range(int(round(dur * FPS))):
            _apply(root, _frame(root["mob"], anim, k / FPS * speed), key=f)
            f += 1
    return f


def anims_of(root):
    return sorted(poses_of(root["mob"])["anims"].keys())


# ---------- text ----------
def text(s, loc, size=1.0, font="ten", color="#ffffff", extrude=0.06, shadow="#1a0f08", sh_off=(0.06, -0.06),
         align="CENTER", face_cam=None, emit=0.0, name="txt", outline=None):
    f = bpy.data.fonts.load(FONT_TEN if font == "ten" else FONT_REG, check_existing=True)
    objs = []
    def make(col, off, z, ext, nm, bev=0.0):
        cu = bpy.data.curves.new(nm, "FONT")
        cu.body = s
        cu.font = f
        cu.size = size
        cu.extrude = ext
        cu.bevel_depth = bev
        cu.bevel_resolution = 0
        cu.align_x = align
        cu.align_y = "CENTER"
        o = bpy.data.objects.new(nm, cu)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(flat_mat(nm + "_m", col, emit=emit, rough=0.6))
        o.location = (off[0], off[1], z)
        return o
    holder = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(holder)
    main = make(color, (0, 0), 0, extrude, name + "_main")
    main.parent = holder
    objs.append(main)
    if outline:
        bev = size * 0.05
        oz = extrude - 0.01 - extrude * 0.5 - bev
        ol = make(outline, (0, 0), oz, extrude * 0.5, name + "_outline", bev=bev)
        ol.parent = holder
    if shadow:
        bev = size * 0.05 if outline else 0
        sz = (extrude - 0.03 - extrude * 0.5 - bev) if outline else -max(0.02, extrude * 2.2)
        sh = make(shadow, (sh_off[0] * size, sh_off[1] * size), sz, extrude * 0.5 if outline else max(extrude, 0.001), name + "_shadow", bev=bev)
        sh.parent = holder
    holder.location = loc
    if face_cam is not None:
        holder.rotation_euler = face_cam
    return holder


# ---------- camera ----------
def camera(loc, look, lens=50, name="cam"):
    c = bpy.data.cameras.new(name)
    c.lens = lens
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    o.location = loc
    d = Vector(look) - Vector(loc)
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = o
    return o


def cam_plane(cam, dist):
    """Transform (loc, rot) for a flat item `dist` m in front of the camera, centered. Returns (origin, rot)."""
    m = cam.matrix_world
    fwd = -(m.to_3x3() @ Vector((0, 0, 1)))
    return cam.location + fwd * dist, cam.rotation_euler.copy()


def screen_text(cam, s, u, v, dist=6, size=0.5, **kw):
    """Text placed in screen space: u,v in -1..1 (0,0 center)."""
    bpy.context.view_layer.update()
    cd = cam.data
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    half_w = dist * cd.sensor_width / (2 * cd.lens)
    half_h = half_w / aspect
    m = cam.matrix_world
    p = m @ Vector((u * half_w, v * half_h, -dist))
    h = text(s, p, size=size, face_cam=cam.rotation_euler.copy(), **kw)
    return h


def screen_rect(cam, u, v, w, h, color, dist=6.5, emit=1.0, name="bar"):
    bpy.context.view_layer.update()
    cd = cam.data
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    half_w = dist * cd.sensor_width / (2 * cd.lens)
    half_h = half_w / aspect
    o = new_plane(name, 1)
    o.scale = (w * half_w, h * half_h, 1)
    o.location = cam.matrix_world @ Vector((u * half_w, v * half_h, -dist))
    o.rotation_euler = cam.rotation_euler.copy()
    o.data.materials.append(flat_mat(name + "_m", color, emit=emit))
    return o


def render(path, frame=1):
    sc = bpy.context.scene
    sc.frame_set(frame)
    sc.render.filepath = path
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return path


def at_screen(cam, u, v, dist):
    """World point at screen position u,v (-1..1, 0 = center) and `dist` m in front of the camera."""
    bpy.context.view_layer.update()
    cd = cam.data
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    half_w = dist * cd.sensor_width / (2 * cd.lens)
    half_h = half_w / aspect
    return tuple(cam.matrix_world @ Vector((u * half_w, v * half_h, -dist)))


# ---------- studio look (gradient / checker backdrop, invisible floor with soft shadows) ----------
def _bg_nodes(nt, stops, checker=None, checker_mix=0.12, checker_scale=8.0):
    """Build screen-space gradient (+ optional checker) in node tree nt; returns color output socket."""
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Window"], sep.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(sep.outputs["Y"], ramp.inputs[0])
    els = ramp.color_ramp.elements
    for i, (p, c) in enumerate(stops):
        e = els[i] if i < len(els) else els.new(p)
        e.position = p
        e.color = hexc(c)
    out = ramp.outputs[0]
    if checker:
        comb = nt.nodes.new("ShaderNodeCombineXYZ")
        mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MULTIPLY"; mx.inputs[1].default_value = aspect
        nt.links.new(sep.outputs["X"], mx.inputs[0])
        ax = nt.nodes.new("ShaderNodeMath"); ax.operation = "ADD"; ax.name = "SCROLL_X"; ax.inputs[1].default_value = 0
        ay = nt.nodes.new("ShaderNodeMath"); ay.operation = "ADD"; ay.name = "SCROLL_Y"; ay.inputs[1].default_value = 0
        nt.links.new(mx.outputs[0], ax.inputs[0]); nt.links.new(sep.outputs["Y"], ay.inputs[0])
        nt.links.new(ax.outputs[0], comb.inputs[0])
        nt.links.new(ay.outputs[0], comb.inputs[1])
        ch = nt.nodes.new("ShaderNodeTexChecker")
        ch.inputs["Scale"].default_value = checker_scale
        ch.inputs["Color1"].default_value = (1, 1, 1, 1)
        ch.inputs["Color2"].default_value = (0, 0, 0, 1)
        nt.links.new(comb.outputs[0], ch.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MIX"
        mix.inputs["Factor"].default_value = 0
        fac = nt.nodes.new("ShaderNodeMath"); fac.operation = "MULTIPLY"; fac.inputs[1].default_value = checker_mix
        nt.links.new(ch.outputs["Fac"], fac.inputs[0])
        nt.links.new(fac.outputs[0], mix.inputs["Factor"])
        nt.links.new(out, mix.inputs[6])
        mix.inputs[7].default_value = hexc(checker)
        out = mix.outputs[2]
    return out


def studio(stops, checker=None, checker_mix=0.12, checker_scale=8.0, shadow="#000000", shadow_strength=0.35,
           key=(0.6, 0.9, 1.1), key_energy=3.5, ambient=1.2):
    sc = bpy.context.scene
    _BG.update(stops=list(stops), dark=shadow if shadow and shadow.lower() not in ("#000000", "#000") else None)
    # world: same backdrop for camera rays, neutral light for everything else
    w = bpy.data.worlds.new("studio")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    col = _bg_nodes(nt, stops, checker, checker_mix, checker_scale)
    bg = nt.nodes.new("ShaderNodeBackground"); nt.links.new(col, bg.inputs[0])
    amb = nt.nodes.new("ShaderNodeBackground"); amb.inputs[0].default_value = (1, 1, 1, 1); amb.inputs[1].default_value = ambient
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(amb.outputs[0], mix.inputs[1]); nt.links.new(bg.outputs[0], mix.inputs[2])
    out = nt.nodes.new("ShaderNodeOutputWorld"); nt.links.new(mix.outputs[0], out.inputs[0])
    # key light
    k = sun_from(key, energy=key_energy, color="#ffffff", angle=8, name="key")
    kd = Vector(key).normalized()
    lit = key_energy * max(kd.z, 0.05) + ambient
    # invisible floor: shows the backdrop, darkened only where shadows fall
    fl = new_plane("floor", 200)
    m = bpy.data.materials.new("floor")
    m.use_nodes = True
    fnt = m.node_tree
    fnt.nodes.clear()
    bcol = _bg_nodes(fnt, stops, checker, checker_mix, checker_scale)
    dif = fnt.nodes.new("ShaderNodeBsdfDiffuse"); dif.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = fnt.nodes.new("ShaderNodeShaderToRGB"); fnt.links.new(dif.outputs[0], s2r.inputs[0])
    bw = fnt.nodes.new("ShaderNodeRGBToBW"); fnt.links.new(s2r.outputs[0], bw.inputs[0])
    mr = fnt.nodes.new("ShaderNodeMapRange"); mr.clamp = True
    mr.inputs["From Min"].default_value = ambient * 0.9
    mr.inputs["From Max"].default_value = lit * 0.95
    fnt.links.new(bw.outputs[0], mr.inputs["Value"])
    inv = fnt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
    fnt.links.new(mr.outputs[0], inv.inputs[1])
    st = fnt.nodes.new("ShaderNodeMath"); st.operation = "MULTIPLY"; st.inputs[1].default_value = shadow_strength
    fnt.links.new(inv.outputs[0], st.inputs[0])
    mixc = fnt.nodes.new("ShaderNodeMix"); mixc.data_type = "RGBA"; mixc.blend_type = "MIX"
    fnt.links.new(st.outputs[0], mixc.inputs["Factor"])
    fnt.links.new(bcol, mixc.inputs[6]); mixc.inputs[7].default_value = hexc(shadow)
    em = fnt.nodes.new("ShaderNodeEmission"); fnt.links.new(mixc.outputs[2], em.inputs[0])
    mo = fnt.nodes.new("ShaderNodeOutputMaterial"); fnt.links.new(em.outputs[0], mo.inputs[0])
    fl.data.materials.append(m)
    # calibrate: measure the unshadowed floor brightness from a tiny render of the empty scene
    probe = new_plane("probe_cam_dummy", 0.001)
    cd = bpy.data.cameras.new("probe"); pc = bpy.data.objects.new("probe", cd); bpy.context.collection.objects.link(pc)
    pc.location = (0, 0, 3); pc.rotation_euler = (0, 0, 0)
    old_cam, rx, ry, pct = sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage
    sc.camera = pc; sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 16, 16, 100
    fnt.links.new(bw.outputs[0], em.inputs[0])
    fmt = sc.render.image_settings.file_format
    sc.render.image_settings.file_format = "OPEN_EXR"
    tmp = S + "/_probe_%d.exr" % os.getpid()
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp, check_existing=False)
    px = list(img.pixels)
    v = sum(px[i] for i in range(0, len(px), 4)) / (len(px) // 4)
    bpy.data.images.remove(img)
    sc.render.image_settings.file_format = fmt
    fnt.links.new(mixc.outputs[2], em.inputs[0])
    sc.camera = old_cam; sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = rx, ry, pct
    bpy.data.objects.remove(pc); bpy.data.objects.remove(probe)
    mr.inputs["From Max"].default_value = v * 0.985
    mr.inputs["From Min"].default_value = v * 0.35
    fl["lit"] = v
    # No self-shadowing on mobs (Minecraft never casts part-on-part shadows; soft ones read as see-through
    # "overlapping textures"). Key light: no shadows, excludes the floor. Shadow light: same light, floor only.
    sh = k.copy(); sh.data = k.data.copy(); sh.name = "shadow_key"
    sc.collection.objects.link(sh)
    only = bpy.data.collections.new("floor_only"); only.objects.link(fl)
    sh.light_linking.receiver_collection = only
    k.data.use_shadow = False
    excl = bpy.data.collections.new("no_floor"); excl.objects.link(fl)
    k.light_linking.receiver_collection = excl
    for co in excl.collection_objects:
        co.light_linking.link_state = "EXCLUDE"
    return fl


def emit_mat(name, color, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value = hexc(color)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if alpha < 1:
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        mx = nt.nodes.new("ShaderNodeMixShader"); mx.inputs[0].default_value = alpha
        nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], out.inputs[0])
    else:
        nt.links.new(em.outputs[0], out.inputs[0])
    return m


def label(cam, s, u, v, size=0.1, font="reg", color="#ffffff", align="LEFT", alpha=1.0, dist=3.0, spacing=1.0, name="label"):
    """Flat 2D text in screen space (u,v -1..1), pure colour, no shading."""
    bpy.context.view_layer.update()
    f = bpy.data.fonts.load(FONT_TEN if font == "ten" else FONT_REG, check_existing=True)
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = s
    cu.font = f
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.space_character = spacing
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(emit_mat(name + "_m", color, alpha))
    o.location = at_screen(cam, u, v, dist)
    o.rotation_euler = cam.rotation_euler.copy()
    return o


def rect(cam, u, v, w, h, color, alpha=1.0, dist=3.05, name="rect"):
    """Flat rectangle in screen space: centre u,v; w,h in screen units (-1..1 is full width/height)."""
    bpy.context.view_layer.update()
    cd = cam.data
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    half_w = dist * cd.sensor_width / (2 * cd.lens)
    half_h = half_w / aspect
    o = new_plane(name, 1)
    o.scale = (w * half_w, h * half_h, 1)
    o.location = at_screen(cam, u, v, dist)
    o.rotation_euler = cam.rotation_euler.copy()
    o.data.materials.append(emit_mat(name + "_m", color, alpha))
    return o



# ---------- motion graphics helpers ----------
def _local(cam, u, v, dist):
    sc = bpy.context.scene
    cd = cam.data
    aspect = sc.render.resolution_x / sc.render.resolution_y
    half_w = dist * cd.sensor_width / (2 * cd.lens)
    half_h = half_w / aspect
    return Vector((u * half_w, v * half_h, -dist)), half_w, half_h



# ---------- readable text (WCAG contrast against the gradient behind it) ----------
_BG = {"stops": [(0.0, "#ffffff"), (1.0, "#ffffff")], "dark": None}


def _lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def _lum(h):
    r, g, b = (_lin(x) for x in _rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def bg_at(v):
    """Backdrop colour at screen height v (-1 bottom .. 1 top) of the current studio() gradient."""
    t = max(0.0, min(1.0, (v + 1) / 2))
    st = sorted(_BG["stops"])
    for (p0, c0), (p1, c1) in zip(st, st[1:]):
        if p0 <= t <= p1:
            k = (t - p0) / max(1e-6, p1 - p0)
            a, b = _rgb(c0), _rgb(c1)
            return "#%02x%02x%02x" % tuple(int(round(x + (y - x) * k)) for x, y in zip(a, b))
    return st[0][1] if t < st[0][0] else st[-1][1]


def _darken(h, f):
    return "#%02x%02x%02x" % tuple(int(x * f) for x in _rgb(h))


def readable(color, v, size=0.1):
    """Colour for text at height v: the wanted colour when it reads (4.5:1 small text, 3:1 headlines), else white,
    else the palette's dark accent (darkened until it reads)."""
    bg = bg_at(v)
    need = 4.5 if size < 0.07 else 3.0
    cands = ([color] if color else []) + ["#ffffff"]
    for c in cands:
        if contrast(c, bg) >= need:
            return c
    dark = _BG.get("dark") or "#1a1a2e"
    for f in (1.0, 0.8, 0.6, 0.4, 0.25):
        d = _darken(dark, f)
        if contrast(d, bg) >= need:
            return d
    return "#111111"


def label2(cam, s, u, v, size=0.1, font="reg", color=None, align="LEFT", dist=3.0, spacing=1.0, name="label", auto=True):
    """Flat text glued to the camera (moves with it). u,v -1..1."""
    f = bpy.data.fonts.load(FONT_TEN if font == "ten" else FONT_REG, check_existing=True)
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = s; cu.font = f; cu.size = size; cu.align_x = align; cu.align_y = "CENTER"; cu.space_character = spacing
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(emit_mat(name + "_m", readable(color, v, size) if auto else (color or "#ffffff")))
    o.parent = cam
    o.location, _, _ = _local(cam, u, v, dist)
    return o


def rect2(cam, u, v, w, h, color, dist=3.05, name="rect"):
    loc, hw, hh = _local(cam, u, v, dist)
    o = new_plane(name, 1)
    o.parent = cam
    o.scale = (w * hw, h * hh, 1)
    o.location = loc
    o.data.materials.append(emit_mat(name + "_m", color))
    return o


def _fcurves(idblock):
    ad = idblock.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    try:
        return list(act.fcurves)
    except Exception:
        pass
    out = []
    for layer in act.layers:
        for st in layer.strips:
            cb = st.channelbag(ad.action_slot)
            if cb:
                out += list(cb.fcurves)
    return out


def ease(idblock, interp="BACK", easing="EASE_OUT", path=None):
    for fc in _fcurves(idblock):
        if path and fc.data_path != path:
            continue
        for k in fc.keyframe_points:
            k.interpolation = interp
            k.easing = easing


def pop_in(o, f, dur=8):
    dur = fr(dur)
    """Scale 0 -> full with a small overshoot."""
    full = tuple(o.scale)
    o.scale = (0.0001, 0.0001, 0.0001); o.keyframe_insert("scale", frame=1)
    o.keyframe_insert("scale", frame=f)
    o.scale = full; o.keyframe_insert("scale", frame=f + dur)
    ease(o, "BACK", "EASE_OUT", "scale")


def slide_in(o, f, dx=0.0, dy=-0.15, dur=10):
    dur = fr(dur)
    """Slide from an offset (camera-local metres) into place, hidden before f."""
    end = o.location.copy()
    full = tuple(o.scale)
    o.scale = (0.0001,) * 3; o.keyframe_insert("scale", frame=f - 1)
    o.scale = full; o.keyframe_insert("scale", frame=f)
    for k in _fcurves(o):
        for p in k.keyframe_points:
            p.interpolation = "CONSTANT"
    o.location = end + Vector((dx, dy, 0)); o.keyframe_insert("location", frame=f)
    o.location = end; o.keyframe_insert("location", frame=f + dur)
    ease(o, "EXPO", "EASE_OUT", "location")


def scroll_bg(speed_x=0.0, speed_y=0.0):
    """Scroll the checker (units per frame) in world + floor via drivers."""
    trees = [bpy.context.scene.world.node_tree] + [m.node_tree for m in bpy.data.materials if m.name == "floor"]
    for nt in trees:
        for nm, sp in (("SCROLL_X", speed_x), ("SCROLL_Y", speed_y)):
            n = nt.nodes.get(nm)
            if n and sp:
                d = n.inputs[1].driver_add("default_value").driver
                d.expression = "frame*%f" % (sp * 24.0 / FPS)


def cam_move(cam, f0, f1, end_loc, end_look=None):
    """Linear-ish camera drift from current placement to end_loc (looking at end_look)."""
    cam.keyframe_insert("location", frame=f0)
    cam.keyframe_insert("rotation_euler", frame=f0)
    cam.location = end_loc
    if end_look is not None:
        d = Vector(end_look) - Vector(end_loc)
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.keyframe_insert("location", frame=f1)
    cam.keyframe_insert("rotation_euler", frame=f1)
    ease(cam, "SINE", "EASE_IN_OUT")


_last_play = {}


FLIGHT = ("flap", "glide", "takeoff", "land", "fly")


def _auto_layers(root, anim, layers):
    if "perch" in poses_of(root["mob"])["anims"] and anim not in FLIGHT and anim != "perch" and not any(l[0] == "perch" for l in layers):
        return tuple(layers) + (("perch", 0.0),)
    return tuple(layers)


def _snap_at(root, anim, t, layers=()):
    layers = _auto_layers(root, anim, layers)
    if layers:
        return _combine(root["mob"], [(anim, t)] + [(a, (0.0 if a == "perch" else t + ta)) for a, ta in layers])
    return _frame(root["mob"], anim, t)


def _lerp_snap(a, b, w):
    out = {}
    for k, vb in b.items():
        va = a.get(k)
        out[k] = vb if va is None else [x + (y - x) * w for x, y in zip(va, vb)]
    return out


def play(root, anim, f0, f1, t0=0.0, speed=1.0, layers=(), blend=10):
    blend = fr(blend) if blend else 0
    """Keyframe `anim` on root's bones from frame f0 to f1, starting at time t0. When this mob already played
    something, the previous animation keeps running and crossfades into this one over `blend` frames."""
    prev = _last_play.get(root.name)
    for f in range(f0, f1 + 1):
        t = t0 + (f - f0) / FPS * speed
        snap = _snap_at(root, anim, t, layers)
        if prev and blend and f - f0 < blend:
            pa, pt, ps, pl = prev
            old = _snap_at(root, pa, pt + (f - f0 + 1) / FPS * ps, pl)
            x = (f - f0 + 1) / (blend + 1)
            snap = _lerp_snap(old, snap, x * x * (3 - 2 * x))
        _apply(root, snap, key=f)
    _last_play[root.name] = (anim, t0 + (f1 - f0) / FPS * speed, speed, tuple(layers))
    for n in root["bones"].values():
        ease(bpy.data.objects[n], "LINEAR", "AUTO")


def setup_frames(n, samples=32):
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, n
    try:
        sc.eevee.taa_render_samples = samples
    except Exception:
        pass


def screen_uv(cam, point):
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    c = world_to_camera_view(bpy.context.scene, cam, Vector(point))
    return c.x * 2 - 1, c.y * 2 - 1


def bbox_of(roots):
    bpy.context.view_layer.update()
    pts = []
    for r in roots:
        for o in r.children_recursive:
            if o.type == "MESH" and not o.hide_render:
                pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx


def fit_camera(roots, view=(0.35, 1.0, 0.12), frac=0.55, u=0.0, v=0.0, lens=40, name="cam"):
    """Camera looking along -view at the mobs' bbox, sized so the bbox fills `frac` of the frame height
    (or width, whichever is tighter), with the bbox centre at screen u,v."""
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    mn, mx = bbox_of(roots)
    c = (mn + mx) / 2
    size = mx - mn
    vd = Vector(view).normalized()
    H = size.z
    W = max(size.x, size.y) * 0.9
    k = 36 / (2 * lens)          # half_w = d * k
    d_h = H / (frac * 2 * k / aspect)
    d_w = W / (frac * 2 * k) * 1.1
    d = max(d_h, d_w, 1.5)
    cam = camera(tuple(c + vd * d), tuple(c), lens=lens, name=name)
    bpy.context.view_layer.update()
    half_w = d * k
    half_h = half_w / aspect
    m = cam.matrix_world.to_3x3()
    shift = m @ Vector((-u * half_w, -v * half_h, 0))
    cam.location = cam.location + shift
    return cam



_ROW_LAYERS = {}


def row(cam_view, items, anim="idle", gap=0.5, rot=-90, scale=1.0, t_step=0.37, f0=1, f1=None, ground=True):
    """Line up mobs left->right on screen (camera looks along -Y, so screen-right is -X), spaced by their own
    widths. items: ids or (id, anim) / dicts. Returns roots in screen order."""
    roots = []
    for i, it in enumerate(items):
        if isinstance(it, str):
            it = {"id": it}
        elif isinstance(it, tuple):
            it = {"id": it[0], "anim": it[1]}
        lay = tuple(it.get("layers", ()))
        r = mob(it["id"], it.get("anim", anim), 0, rot=it.get("rot", rot), scale=it.get("scale", scale), name="row%d_%s" % (i, it["id"]), tex=it.get("tex"), hide=it.get("hide", ()), layers=lay)
        r["anim"] = it.get("anim", anim)
        _ROW_LAYERS[r.name] = lay
        r["label"] = it.get("label", it["id"].replace("_", " ").upper())
        r["z"] = it.get("z", 0.0)
        roots.append(r)
    x = 0.0
    bpy.context.view_layer.update()
    for r in roots:
        mn, mx = bbox_of([r])
        w = mx.x - mn.x
        cx = (mn.x + mx.x) / 2 - r.location.x
        r.location.x = -(x + w / 2) - cx
        r.location.z = r["z"]
        x += w + gap
    shift = x / 2 - gap / 2
    for r in roots:
        r.location.x += shift
    if f1:
        for i, r in enumerate(roots):
            play(r, r["anim"], f0, f1, t0=i * t_step, layers=list(_ROW_LAYERS.get(r.name, ())))
    return roots
