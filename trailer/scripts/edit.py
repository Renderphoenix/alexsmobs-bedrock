# Cut the rendered shots to the music and encode the final MP4 (Blender video sequencer, H.264 + AAC).
#   blender -b -P edit.py -- <trailer.json> <fps> [output.mp4]
# Shots are placed at their planned start frames (hard cuts on the beat grid); music starts at frame 1.
import bpy, os, json, sys

args = sys.argv[sys.argv.index("--") + 1:]
cfg = json.load(open(args[0], encoding="utf8"))
fps = int(args[1])
out = args[2] if len(args) > 2 else cfg.get("output", os.path.join(cfg["work"], "trailer_%dfps.mp4" % fps)).replace("{fps}", str(fps))
R = os.path.join(cfg["work"], "render_%d" % fps)
plan = json.load(open(os.path.join(cfg["work"], "plan_%d.json" % fps)))
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, 100
sc.render.fps = fps
se = sc.sequence_editor_create()
coll = se.strips if hasattr(se, "strips") else se.sequences
last = 0
for i, s in enumerate(plan["scenes"]):
    d = os.path.join(R, s["name"])
    files = sorted(f for f in os.listdir(d) if f.lower().endswith((".png", ".jpg", ".jpeg")))
    st = coll.new_image(name=s["name"], filepath=os.path.join(d, files[0]), channel=1 + (i % 2), frame_start=s["start"])
    for f in files[1:]:
        st.elements.append(f)
    last = max(last, st.frame_final_end)
end = last - 1
if cfg.get("music"):
    snd = coll.new_sound(name="music", filepath=cfg["music"], channel=4, frame_start=1)
    end = min(last, snd.frame_final_end) - 1
sc.frame_start, sc.frame_end = 1, end
sc.render.image_settings.media_type = "VIDEO"      # Blender 5: must be set before choosing FFMPEG
sc.render.image_settings.file_format = "FFMPEG"
sc.render.ffmpeg.format = "MPEG4"
sc.render.ffmpeg.codec = "H264"
sc.render.ffmpeg.constant_rate_factor = "HIGH"
sc.render.ffmpeg.ffmpeg_preset = "GOOD"
sc.render.ffmpeg.audio_codec = "AAC"
sc.render.ffmpeg.audio_bitrate = 192
sc.render.ffmpeg.audio_channels = "STEREO"
sc.render.filepath = out
sc.render.use_sequencer = True
bpy.ops.render.render(animation=True)
print("WROTE", out, "FRAMES", end, "SECONDS %.2f" % (end / fps))
