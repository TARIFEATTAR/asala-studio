"""
Paper-Doll Rig — parametric closure renders (Blender headless).

WHY THIS EXISTS: generating each colourway independently produced ten different
caps (71% aspect spread, worst silhouette IoU 0.3475 against a required 0.985).
Colourway variants must be the SAME part. Here they are the same mesh with a
different material, so silhouette identity is guaranteed by construction rather
than gated after the fact.

Renders with a TRANSPARENT film, so output is an alpha cutout already — no ML
matting, no colour-keying through a mirror, no graded background to defeat the
QA detector. That removes the single largest source of measurement error in the
generation lane.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/paper-doll/render_closure.py -- \
    --out outputs/paper-doll-3d --elevation 6.0 [--samples 128] [--only silver]
"""
import bpy, sys, math, os

# ── args after "--"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index("--" + name) + 1] if "--" + name in argv else default

OUT       = arg("out", "outputs/paper-doll-3d")
ELEVATION = float(arg("elevation", "6.0"))   # camera height above cap top, mm
SAMPLES   = int(arg("samples", "128"))
ONLY      = arg("only")
# Studio contrast ratio is the lever that decides whether the mirror clips.
# A near-black surround gives sharp bands that crush to 0; a cream surround with
# a modest panel ratio gives sharp bands that bottom out at a deep warm grey.
WORLD_S   = float(arg("world", "0.42"))
KEY_S     = float(arg("key", "5.0"))
RES_X, RES_Y = 1400, 2050

# ── Canon geometry (mm). Cap OD from the body-scale rule: closure sizing derives
#    from body width, NEVER the neck — canon calls the 17-415 neck 17mm but every
#    plate and the source PSD measure the thread crest at 14.8mm.
OD      = 19.5
HEIGHT  = 28.5          # from measured source aspect 0.684 (19.5 / 0.684)
WALL    = 1.2
RIM_BEV = 0.9           # filleted top rim

# ── Colourways: same mesh, different material.
#    The roll-on over-caps are moulded phenolic plastic with a vacuum-metallized
#    finish. Metallic=1 + very low roughness reproduces the mirror; the matte
#    variants raise roughness only. NOT aluminium — no brushed/anisotropic grain.
COLORWAYS = {
    "silver":     dict(base=(0.92, 0.92, 0.94), rough=0.04, metallic=1.0),
    "gold":       dict(base=(1.00, 0.80, 0.42), rough=0.04, metallic=1.0),
    "copper":     dict(base=(0.96, 0.62, 0.46), rough=0.05, metallic=1.0),
    "matte-silver": dict(base=(0.82, 0.82, 0.84), rough=0.42, metallic=1.0),
    "matte-gold": dict(base=(0.90, 0.72, 0.40), rough=0.42, metallic=1.0),
    "black":      dict(base=(0.045, 0.045, 0.05), rough=0.06, metallic=0.0),
    "white":      dict(base=(0.90, 0.90, 0.89), rough=0.35, metallic=0.0),
    "pink":       dict(base=(0.90, 0.72, 0.75), rough=0.40, metallic=1.0),
    # Pilot names make the physical finish explicit. These remain the same
    # frozen mesh; only Principled BSDF parameters change.
    "glossy-black": dict(base=(0.018, 0.018, 0.022), rough=0.055, metallic=0.0,
                         coat=0.32, coat_rough=0.035, ior=1.49),
    "matte-white": dict(base=(0.93, 0.925, 0.91), rough=0.46, metallic=0.0,
                        coat=0.0, ior=1.49),
    "translucent-frosted": dict(base=(0.82, 0.88, 0.88), rough=0.30,
                                metallic=0.0, transmission=0.48,
                                coat=0.12, coat_rough=0.18, ior=1.47),
}

# ── Clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
try:
    scene.cycles.device = "GPU"
except Exception:
    pass
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.film_transparent = True          # alpha cutout straight out
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
# View transform: "Standard" clips hard, which is what pinned p99 at 255 and
# reproduced the exact blown-highlight defect we are trying to remove. Khronos
# PBR Neutral is purpose-built for product rendering — it preserves hue and rolls
# highlights off the way a real camera does. Fall back through AgX/Filmic.
for _vt in ("Khronos PBR Neutral", "AgX", "Filmic", "Standard"):
    try:
        scene.view_settings.view_transform = _vt
        print(f"VIEW_TRANSFORM {_vt}")
        break
    except TypeError:
        continue
scene.view_settings.exposure = float(arg("exposure", "0.0"))

# ── Cap mesh: hollow cylinder, open at the bottom, filleted top rim.
bpy.ops.mesh.primitive_cylinder_add(vertices=256, radius=OD / 2, depth=HEIGHT,
                                    location=(0, 0, HEIGHT / 2))
cap = bpy.context.active_object
cap.name = "over_cap"

solid = cap.modifiers.new("solidify", "SOLIDIFY")
solid.thickness = WALL
solid.offset = 1.0

bev = cap.modifiers.new("bevel", "BEVEL")
bev.width = RIM_BEV
bev.segments = 12
bev.limit_method = "ANGLE"
bev.angle_limit = math.radians(35)

# Smooth shading with an angle split: the barrel reads as a continuous curve
# while the filleted rim keeps its edge. use_auto_smooth was removed in 4.1+,
# so use the shade_auto_smooth operator when present.
bpy.ops.object.shade_smooth()
if hasattr(bpy.ops.object, "shade_auto_smooth"):
    bpy.ops.object.shade_auto_smooth(angle=math.radians(40))

# Open the bottom: delete the bottom cap face so the skirt reads hollow.
import bmesh
bm = bmesh.new(); bm.from_mesh(cap.data)
for f in list(bm.faces):
    if abs(f.normal.z + 1.0) < 0.05 and f.calc_center_median().z < 0.5:
        bm.faces.remove(f)
bm.to_mesh(cap.data); bm.free()

# ── LIGHT CONTRACT, as an actual rig.
#
#    KEY INSIGHT: for a mirror finish the reflection IS the lighting design. A
#    chrome cap in a featureless environment renders as flat grey, because a
#    mirror can only show what is around it. The sharp vertical bands in real
#    product photography are reflections of softboxes separated by dark studio.
#    So the environment is built as bright emissive panels against a dark
#    surround, and the bands fall out of the physics instead of being prompted.
#
#    Film is transparent, so the world affects reflection and lighting ONLY —
#    the dark surround never reaches the output background.
world = bpy.data.worlds.new("studio"); scene.world = world
world.use_nodes = True
bgn = world.node_tree.nodes["Background"]
bgn.inputs[0].default_value = (0.780, 0.756, 0.716, 1.0)   # warm cream studio surround
bgn.inputs[1].default_value = WORLD_S

def panel(name, loc, rot, sx, sy, strength, warm=(1.0, 0.985, 0.96)):
    """Emissive plane — reads as a softbox in the mirror AND lights the scene."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    o.scale = (sx, sy, 1.0)
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.remove(nt.nodes["Principled BSDF"])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*warm, 1.0)
    em.inputs[1].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs[0])
    o.data.materials.append(m)
    return o

# KEY: tall bright panel to the RIGHT — the broad brilliant band.
panel("key",  (118, -34, 14), (math.radians(90), 0, math.radians(-64)), 96, 150, KEY_S)
# FILL: dimmer panel LEFT — the softer secondary band.
panel("fill", (-112, -46, 14), (math.radians(90), 0, math.radians(62)), 84, 140, KEY_S * 0.24)
# TOP: skims the rim and gives the top face something bright to hold.
panel("top",  (0, -18, 96), (0, 0, 0), 130, 130, 2.2)
# EDGE: narrow strip that becomes the crisp bright line near the left turn.
panel("edge", (-58, 78, 20), (math.radians(90), 0, math.radians(158)), 22, 120, KEY_S * 0.64)

# ── Camera.
#    Elevation is expressed as an ANGLE, because that is what actually controls
#    how much of the top face is visible: for a cylinder of diameter d seen from
#    angle a above horizontal, the top ellipse's minor axis is d*sin(a). The
#    source PSD measures a ~6% top arc, so a = asin(0.06) ~= 3.44 degrees.
#    In the generation lane this was something a prompt had to be talked into and
#    kept getting wrong; here it is one number.
TOP_ARC_TARGET = float(arg("top-arc", "0.062"))
elev_rad = math.asin(max(0.0, min(0.5, TOP_ARC_TARGET)))

cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 400.0                    # long lens -> near-orthographic, no barrel
cam_d.sensor_fit = "VERTICAL"
# With VERTICAL fit Blender reads sensor_HEIGHT, not sensor_width. Setting only
# sensor_width leaves height at its 24mm default and the object overflows frame.
cam_d.sensor_height = 36.0
cam_d.sensor_width = 36.0
# Frame height with margin, then solve the distance that produces it:
#   frame_height = sensor * D / lens  ->  D = lens * frame_height / sensor
FRAME_H = HEIGHT * 1.22
DIST = cam_d.lens * FRAME_H / cam_d.sensor_height

cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
target_z = HEIGHT / 2
cam.location = (0.0, -DIST * math.cos(elev_rad), target_z + DIST * math.sin(elev_rad))
cam.rotation_euler = (math.radians(90) - elev_rad, 0.0, 0.0)

# ── Render each colourway off the SAME mesh.
mat = bpy.data.materials.new("closure"); mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
cap.data.materials.append(mat)

os.makedirs(OUT, exist_ok=True)
todo = {ONLY: COLORWAYS[ONLY]} if ONLY and ONLY in COLORWAYS else COLORWAYS
for name, spec in todo.items():
    bsdf.inputs["Base Color"].default_value = (*spec["base"], 1.0)
    bsdf.inputs["Roughness"].default_value = spec["rough"]
    bsdf.inputs["Metallic"].default_value = spec["metallic"]
    bsdf.inputs["IOR"].default_value = spec.get("ior", 1.5)
    bsdf.inputs["Transmission Weight"].default_value = spec.get("transmission", 0.0)
    bsdf.inputs["Coat Weight"].default_value = spec.get("coat", 0.0)
    bsdf.inputs["Coat Roughness"].default_value = spec.get("coat_rough", 0.03)
    scene.render.filepath = os.path.join(OUT, f"cap_17-415_{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {name} -> {scene.render.filepath}")

# Self-check: project the mesh bounds into camera space and report the object's
# share of the frame. A silent framing failure (object larger than frame) looks
# like a flat grey render, which is exactly how this went wrong twice.
from bpy_extras.object_utils import world_to_camera_view
deps = bpy.context.evaluated_depsgraph_get()
ev = cap.evaluated_get(deps)
xs, ys = [], []
for v in ev.data.vertices:
    co = world_to_camera_view(scene, cam, cap.matrix_world @ v.co)
    xs.append(co.x); ys.append(co.y)
print(f"FRAME_CHECK x {min(xs):.3f}..{max(xs):.3f}  y {min(ys):.3f}..{max(ys):.3f}"
      f"  {'OK' if min(xs)>0 and max(xs)<1 and min(ys)>0 and max(ys)<1 else 'OVERFLOWS FRAME'}")
print("DONE")
