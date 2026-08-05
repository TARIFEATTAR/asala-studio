"""CYL-9ML family scene builder — one locked Blender scene for the paper-doll factory.

Builds every 17-415 9 ml component as parametric lathe geometry in a single scene
with the locked orthographic camera and emission-panel studio (conventions carried
over from render_cyl9_cap_family.py). Components live in per-slot collections so a
batch renderer can toggle visibility + swap materials to produce every catalog
configuration from identical meshes.

Canonical dimensions (docs/best-bottles-canonical-truth, 2026-07-12):
  body 70.0 x 20.0 mm, 17-415 neck; roll-on assembled 83.0 mm; spray assembled 98.0 mm.
Cap: 19.5 x 28.5 mm (docs/paper-doll-rig/cyl9-cap-family-recipe.json, verified:false).

Usage:
  blender --background --python build_cyl9_family_scene.py -- --build [--proof]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy

REPO = Path(__file__).resolve().parents[3]
OUT_DIR = REPO / "outputs" / "paper-doll-blender"
BLEND_PATH = OUT_DIR / "cyl9-family-v0.blend"
PROOF_DIR = OUT_DIR / "proofs"

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []

# ---------------------------------------------------------------- dimensions (mm)
BODY_HEIGHT = 70.0
BODY_DIAMETER = 20.0
GLASS_WALL = 1.6
GLASS_BASE = 5.0
NECK_OD = 17.0        # 17-415 finish
NECK_HEIGHT = 8.0     # above shoulder
SHOULDER_Z = BODY_HEIGHT - NECK_HEIGHT

CAP_OD = 19.5
CAP_HEIGHT = 28.5
ROLLON_TOTAL = 83.0                    # canonical assembled height
CAP_SEAT_Z = ROLLON_TOTAL - CAP_HEIGHT # cap bottom edge

BALL_DIAMETER = 9.5
ROLLER_COLLAR_OD = 16.6
ROLLER_COLLAR_H = 6.5

SPRAY_TOTAL = 98.0
SPRAY_TRIM_OD = 17.4
SPRAY_TRIM_H = 9.0
SPRAY_HEAD_OD = 13.6
DIP_TUBE_OD = 1.6

LOTION_TOTAL = 98.0   # parametric placeholder; verified:false — confirm vs photo masters

SEGMENTS = 128

# Studio + camera conventions carried from render_cyl9_cap_family.py
WORLD_COLOR = (0.780, 0.756, 0.716, 1.0)
WORLD_STRENGTH = 0.42
PANELS = [
    {"name": "key",  "location": (118, -34, 44), "rot": (90, 0, -64), "scale": (96, 150), "strength": 5.0},
    {"name": "fill", "location": (-112, -46, 44), "rot": (90, 0, 62), "scale": (84, 140), "strength": 1.2},
    {"name": "top",  "location": (0, -18, 140), "rot": (0, 0, 0), "scale": (130, 130), "strength": 2.2},
    {"name": "edge", "location": (-58, 78, 50), "rot": (90, 0, 158), "scale": (22, 120), "strength": 3.2},
]
TOP_ARC_RATIO = 0.02
FRAME_MULT = 1.16
OUTPUT_ASPECT = 2080.0 / 2288.0  # locked canvas 10:11

FINISHES = {
    "mirror-silver": {"base": (0.82, 0.83, 0.86, 1.0), "metallic": 1.0, "rough": 0.035, "coat": 0.18},
    "matte-silver":  {"base": (0.60, 0.61, 0.64, 1.0), "metallic": 1.0, "rough": 0.38,  "coat": 0.0},
    "mirror-gold":   {"base": (0.83, 0.50, 0.12, 1.0), "metallic": 1.0, "rough": 0.05,  "coat": 0.16},
    "matte-gold":    {"base": (0.68, 0.37, 0.08, 1.0), "metallic": 1.0, "rough": 0.40,  "coat": 0.0},
    "glossy-black":  {"base": (0.008, 0.009, 0.011, 1.0), "metallic": 0.0, "rough": 0.12, "coat": 0.42},
    "matte-copper":  {"base": (0.54, 0.17, 0.055, 1.0), "metallic": 1.0, "rough": 0.43, "coat": 0.0},
    "glossy-white":  {"base": (0.93, 0.91, 0.87, 1.0), "metallic": 0.0, "rough": 0.14, "coat": 0.38},
    "matte-pink":    {"base": (0.72, 0.26, 0.36, 1.0), "metallic": 0.0, "rough": 0.38, "coat": 0.0},
    "actuator-white": {"base": (0.90, 0.895, 0.88, 1.0), "metallic": 0.0, "rough": 0.42, "coat": 0.05},
    "trim-black":    {"base": (0.010, 0.011, 0.013, 1.0), "metallic": 0.0, "rough": 0.22, "coat": 0.2},
    "trim-red":      {"base": (0.45, 0.03, 0.035, 1.0), "metallic": 0.6, "rough": 0.34, "coat": 0.1},
    "trim-turquoise": {"base": (0.05, 0.42, 0.45, 1.0), "metallic": 0.6, "rough": 0.34, "coat": 0.1},
    "steel-ball":    {"base": (0.75, 0.76, 0.78, 1.0), "metallic": 1.0, "rough": 0.08, "coat": 0.0},
    "plastic-ball":  {"base": (0.92, 0.92, 0.90, 1.0), "metallic": 0.0, "rough": 0.18, "coat": 0.3},
}


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "MILLIMETERS"
    scene.unit_settings.scale_length = 0.001


def make_material(name: str, spec: dict) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = spec["base"]
    bsdf.inputs["Metallic"].default_value = spec["metallic"]
    bsdf.inputs["Roughness"].default_value = spec["rough"]
    for coat_key in ("Coat Weight", "Coat"):
        if coat_key in bsdf.inputs:
            bsdf.inputs[coat_key].default_value = spec["coat"]
            break
    return mat


def make_glass_material() -> bpy.types.Material:
    """Packshot glass: Fresnel-mixed Transparent + Glossy, no refraction.

    True dielectric refraction through a 20 mm cylinder lenses the entire
    environment into dark flanks (verified: flanks render at ~30% brightness
    with physically-correct glass — the catalog look is optically a cheat).
    Product plates want the background passing straight through with edge
    definition from reflections only. Beauty renders can use true glass later.
    """
    mat = bpy.data.materials.new("cyl9_clear_glass")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    fresnel = nt.nodes.new("ShaderNodeFresnel")
    fresnel.inputs["IOR"].default_value = 1.45
    transparent = nt.nodes.new("ShaderNodeBsdfTransparent")
    transparent.inputs["Color"].default_value = (0.985, 0.985, 0.98, 1.0)
    glossy = nt.nodes.new("ShaderNodeBsdfGlossy")
    glossy.inputs["Roughness"].default_value = 0.04
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fresnel.outputs["Fac"], mix.inputs["Fac"])
    nt.links.new(transparent.outputs["BSDF"], mix.inputs[1])
    nt.links.new(glossy.outputs["BSDF"], mix.inputs[2])
    # Parametric edge definition: a facing-ramp darkening at the last degrees
    # of curvature. Deterministic — no studio furniture involved.
    layer = nt.nodes.new("ShaderNodeLayerWeight")
    layer.inputs["Blend"].default_value = 0.5
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.62
    ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    ramp.color_ramp.elements[1].position = 0.92
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
    edge_shader = nt.nodes.new("ShaderNodeBsdfDiffuse")
    edge_shader.inputs["Color"].default_value = (0.30, 0.30, 0.305, 1.0)
    edge_mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(ramp.outputs["Color"], edge_mix.inputs["Fac"])
    nt.links.new(layer.outputs["Facing"], ramp.inputs["Fac"])
    nt.links.new(mix.outputs["Shader"], edge_mix.inputs[1])
    nt.links.new(edge_shader.outputs["BSDF"], edge_mix.inputs[2])
    # Single-sided: backfaces are pure transparent. An open shell's interior
    # faces otherwise form a grazing-angle mirror hall that darkens the flanks.
    geom = nt.nodes.new("ShaderNodeNewGeometry")
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    clear.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    side_mix = nt.nodes.new("ShaderNodeMixShader")
    output = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(geom.outputs["Backfacing"], side_mix.inputs["Fac"])
    nt.links.new(edge_mix.outputs["Shader"], side_mix.inputs[1])
    nt.links.new(clear.outputs["BSDF"], side_mix.inputs[2])
    nt.links.new(side_mix.outputs["Shader"], output.inputs["Surface"])
    return mat


def lathe(name: str, profile: list[tuple[float, float]], collection: bpy.types.Collection,
          material: bpy.types.Material, segments: int = SEGMENTS) -> bpy.types.Object:
    """Revolve an (radius, z) profile around Z. Zero-radius endpoints become poles."""
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    ring_index: list[int | None] = []
    pole_index: list[int | None] = []
    for radius, z in profile:
        if radius <= 1e-6:
            pole_index.append(len(verts))
            ring_index.append(None)
            verts.append((0.0, 0.0, z))
        else:
            ring_index.append(len(verts))
            pole_index.append(None)
            for s in range(segments):
                a = 2.0 * math.pi * s / segments
                verts.append((radius * math.cos(a), radius * math.sin(a), z))
    for i in range(len(profile) - 1):
        r0, p0, r1, p1 = ring_index[i], pole_index[i], ring_index[i + 1], pole_index[i + 1]
        for s in range(segments):
            s_next = (s + 1) % segments
            if r0 is not None and r1 is not None:
                faces.append((r0 + s, r0 + s_next, r1 + s_next, r1 + s))
            elif r0 is not None and p1 is not None:
                faces.append((r0 + s, r0 + s_next, p1))
            elif p0 is not None and r1 is not None:
                faces.append((p0, r1 + s_next, r1 + s))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    # Refractive shading requires consistent outward normals; hand-wound
    # lathe faces are not guaranteed consistent.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(material)
    collection.objects.link(obj)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


def collection(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def build_body(col: bpy.types.Collection) -> None:
    glass = make_glass_material()
    r_out = BODY_DIAMETER / 2
    r_neck = NECK_OD / 2
    r_in = r_out - GLASS_WALL
    r_bore = r_neck - 1.8
    lip = 0.6

    # Silhouette-first geometry: if a derived profile exists (extracted row by
    # row from the approved frozen plate), the photograph IS the mesh source.
    derived_path = OUT_DIR / "derived-body-profile.json"
    if derived_path.exists():
        import json
        derived = json.loads(derived_path.read_text())
        outer_profile = [(0.0, 0.0)] + [(r, z) for r, z in derived["profile"]]
        print(f"[body] derived silhouette profile: {len(outer_profile)} pts, "
              f"height {derived['heightMm']}mm from {derived['source']}")
    else:
        outer_profile = [
            (0.0, 0.0),
            (r_out - 1.4, 0.0),
            (r_out, 1.4),
            (r_out, SHOULDER_Z - 1.5),
            (r_neck + 0.6, SHOULDER_Z + 1.2),
            (r_neck, SHOULDER_Z + 2.0),
            (r_neck, BODY_HEIGHT),
            (r_bore, BODY_HEIGHT),
        ]
    lathe("body__clear", outer_profile, col, glass)

    inner = bpy.data.materials.new("cyl9_glass_inner")
    inner.use_nodes = True
    nt = inner.node_tree
    nt.nodes.clear()
    t = nt.nodes.new("ShaderNodeBsdfTransparent")
    t.inputs["Color"].default_value = (0.988, 0.988, 0.985, 1.0)  # faint wall hint
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(t.outputs["BSDF"], o.inputs["Surface"])
    top_z = outer_profile[-1][1]
    inner_profile = [
        (r_bore, top_z),
        (r_bore, GLASS_BASE + lip),
        (r_in - 1.0, GLASS_BASE),
        (0.0, GLASS_BASE),
    ]
    lathe("body__clear_inner", inner_profile, col, inner)


def build_rollon_cap(col: bpy.types.Collection) -> None:
    # Profile carried from cap-family authority (flat top, shallow corner roll)
    normalized = [
        (0.5000, 0.0000), (0.5000, 0.9000), (0.4980, 0.9450), (0.4920, 0.9660),
        (0.4800, 0.9820), (0.4560, 0.9930), (0.4100, 0.9980), (0.0000, 1.0000),
    ]
    profile = [(nr * CAP_OD, CAP_SEAT_Z + nz * CAP_HEIGHT) for nr, nz in normalized]
    profile.insert(0, (CAP_OD * 0.5 - 0.9, CAP_SEAT_Z))  # open bottom edge inward
    lathe("cap__rollon", profile, col, make_material("cap_finish", FINISHES["mirror-silver"]))


def build_rollers(col: bpy.types.Collection) -> None:
    r_collar = ROLLER_COLLAR_OD / 2
    collar_top = BODY_HEIGHT + ROLLER_COLLAR_H
    collar_profile = [
        (NECK_OD / 2 - 0.4, BODY_HEIGHT - 0.5),
        (r_collar, BODY_HEIGHT + 0.8),
        (r_collar, collar_top - 1.8),
        (BALL_DIAMETER / 2 - 0.6, collar_top),
    ]
    ball_z = collar_top + BALL_DIAMETER * 0.18
    for kind, ball_mat in (("metal", "steel-ball"), ("plastic", "plastic-ball")):
        sub = bpy.data.collections.new(f"roller__{kind}")
        col.children.link(sub)
        lathe(f"roller_collar__{kind}", collar_profile, sub,
              make_material(f"collar_{kind}", FINISHES["plastic-ball" if kind == "plastic" else "matte-silver"]))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=BALL_DIAMETER / 2, location=(0, 0, ball_z),
                                             segments=64, ring_count=32)
        ball = bpy.context.active_object
        ball.name = f"roller_ball__{kind}"
        ball.data.materials.append(make_material(f"ball_{kind}", FINISHES[f"{kind.replace('metal','steel')}-ball"]))
        for c in ball.users_collection:
            c.objects.unlink(ball)
        sub.objects.link(ball)
        bpy.ops.object.shade_smooth()


def build_sprayer(col: bpy.types.Collection) -> None:
    r_trim = SPRAY_TRIM_OD / 2
    trim_top = BODY_HEIGHT + SPRAY_TRIM_H
    trim_profile = [
        (NECK_OD / 2 - 0.4, BODY_HEIGHT - 0.5),
        (r_trim, BODY_HEIGHT + 0.6),
        (r_trim, trim_top - 1.0),
        (SPRAY_HEAD_OD / 2 - 0.5, trim_top),
    ]
    lathe("sprayer_trim", trim_profile, col, make_material("trim", FINISHES["matte-silver"]))
    r_head = SPRAY_HEAD_OD / 2
    head_profile = [
        (r_head - 0.5, trim_top),
        (r_head, trim_top + 1.0),
        (r_head, SPRAY_TOTAL - 2.2),
        (r_head - 1.2, SPRAY_TOTAL - 0.6),
        (r_head - 3.2, SPRAY_TOTAL),
        (0.0, SPRAY_TOTAL),
    ]
    lathe("sprayer_head", head_profile, col, make_material("actuator", FINISHES["actuator-white"]))
    tube_profile = [(DIP_TUBE_OD / 2, GLASS_BASE + 0.8), (DIP_TUBE_OD / 2, BODY_HEIGHT)]
    lathe("sprayer_tube", tube_profile, col, make_material("tube", FINISHES["actuator-white"]))


def build_pump(col: bpy.types.Collection) -> None:
    r_trim = SPRAY_TRIM_OD / 2
    trim_top = BODY_HEIGHT + SPRAY_TRIM_H
    lathe("pump_trim", [
        (NECK_OD / 2 - 0.4, BODY_HEIGHT - 0.5),
        (r_trim, BODY_HEIGHT + 0.6),
        (r_trim, trim_top - 1.0),
        (5.2, trim_top),
    ], col, make_material("pump_trim", FINISHES["matte-silver"]))
    stem_top = LOTION_TOTAL - 6.0
    lathe("pump_stem", [(5.2, trim_top), (5.2, stem_top - 4.0), (6.8, stem_top - 2.0), (6.8, stem_top)],
          col, make_material("pump_actuator", FINISHES["actuator-white"]))
    # spout: horizontal cylinder
    bpy.ops.mesh.primitive_cylinder_add(radius=2.6, depth=10.0, location=(6.0, 0, LOTION_TOTAL - 3.0),
                                        rotation=(0, math.radians(90), 0))
    spout = bpy.context.active_object
    spout.name = "pump_spout"
    spout.data.materials.append(make_material("pump_spout", FINISHES["actuator-white"]))
    for c in spout.users_collection:
        c.objects.unlink(spout)
    col.objects.link(spout)
    lathe("pump_tube", [(DIP_TUBE_OD / 2, GLASS_BASE + 0.8), (DIP_TUBE_OD / 2, BODY_HEIGHT)],
          col, make_material("pump_tube", FINISHES["actuator-white"]))


def emission_plane(name: str, location, rot_deg, scale, color, strength,
                   camera_visible: bool = False) -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(size=1, location=location,
                                     rotation=[math.radians(v) for v in rot_deg])
    panel = bpy.context.active_object
    panel.name = name
    panel.scale = (scale[0], scale[1], 1)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = strength
    output = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    panel.data.materials.append(mat)
    panel.visible_camera = camera_visible
    return panel


BONE_LINEAR = (0.924, 0.905, 0.869, 1.0)  # #F5F3EF in linear-ish space

# Plate framing measured from the frozen clear plate:
# wall 366px on 2080 canvas, centerX 1041, body base at 91.1% frame height.
PLATE_FRAME_HEIGHT_MM = 125.7  # 2288px / 18.2 px-per-mm, plate-exact
PLATE_BASE_MARGIN_MM = 11.15   # glass base row 2085 → (2288-2085)/18.2


def build_camera_and_studio() -> None:
    cam_data = bpy.data.cameras.new("cyl9_family_camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = PLATE_FRAME_HEIGHT_MM
    cam = bpy.data.objects.new("cyl9_family_camera", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    elevation = math.atan(2.0 * TOP_ARC_RATIO)
    distance = 400.0
    target_z = PLATE_FRAME_HEIGHT_MM / 2.0 - PLATE_BASE_MARGIN_MM
    cam.location = (0.0, -distance * math.cos(elevation), target_z + distance * math.sin(elevation))
    cam.rotation_euler = (math.radians(90.0) - elevation, 0.0, 0.0)
    bpy.context.scene.camera = cam

    # Bright-field glass lighting: the environment IS bright Bone everywhere;
    # edges and highlights come from small deviations, not from drama.
    world = bpy.data.worlds.new("cyl9_world")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = BONE_LINEAR
    bg.inputs[1].default_value = 1.0
    bpy.context.scene.world = world

    # -- glass studio -------------------------------------------------------
    # Empty bright field: the cylinder panoramically compresses EVERYTHING
    # around it — any studio furniture becomes wide bands on the glass. All
    # edge contrast comes from Fresnel against the uniform Bone world. The
    # top light exists only for opaque parts + the contact shadow, and is
    # invisible to glossy/transmission so it never images on the glass.
    top = emission_plane("studio_top", (0, -14, 150), (0, 0, 0), (120, 120),
                         (1.0, 1.0, 1.0, 1.0), 1.3)
    top.visible_transmission = False
    top.visible_glossy = False
    for side, x in (("left", -70.0), ("right", 70.0)):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, 6, 46),
                                         rotation=(math.radians(90), 0, math.radians(90)))
        card = bpy.context.active_object
        card.name = f"studio_edge_card_{side}"
        card.scale = (10, 170, 1)
        dark = bpy.data.materials.new(card.name)
        dark.use_nodes = True
        bsdf = dark.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (0.42, 0.42, 0.425, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.9
        card.data.materials.append(dark)
        card.visible_camera = False
        card.visible_transmission = False

    # Shadow catcher floor → real ambient contact shadow carried in alpha.
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "studio_shadow_floor"
    floor.scale = (200, 200, 1)
    floor.is_shadow_catcher = True
    # The floor exists ONLY to catch the contact shadow for camera rays.
    # Through-glass and reflected rays must not image it (it renders black).
    floor.visible_transmission = False
    floor.visible_glossy = False
    floor.visible_diffuse = False


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.cycles.max_bounces = 64
    scene.cycles.transmission_bounces = 64
    scene.cycles.transparent_max_bounces = 128
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.render.film_transparent = True
    scene.cycles.film_transparent_glass = True
    scene.cycles.film_transparent_roughness = 0.35
    scene.render.resolution_x = 1040
    scene.render.resolution_y = 1144
    scene.view_settings.view_transform = "Standard"


def set_visible(visible_collections: set[str]) -> None:
    def walk(col: bpy.types.Collection):
        yield col
        for child in col.children:
            yield from walk(child)
    for col in walk(bpy.context.scene.collection):
        if col.name in ("Scene Collection",):
            continue
        hide = col.name not in visible_collections and col.name.split("__")[0] in (
            "slot", "roller", "cap", "sprayer", "pump", "body")
        col.hide_render = hide
        col.hide_viewport = hide


def main() -> None:
    reset_scene()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    body_col = collection("slot__body")
    cap_col = collection("slot__cap")
    roller_col = collection("slot__roller")
    spray_col = collection("slot__sprayer")
    pump_col = collection("slot__pump")
    build_body(body_col)
    build_rollon_cap(cap_col)
    build_rollers(roller_col)
    build_sprayer(spray_col)
    build_pump(pump_col)
    build_camera_and_studio()
    configure_render()

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"[scene] saved {BLEND_PATH}")

    if "--plate" in ARGS:
        PROOF_DIR.mkdir(parents=True, exist_ok=True)
        bpy.context.scene.render.film_transparent = False
        set_visible({"slot__body"})
        bpy.context.scene.render.filepath = str(PROOF_DIR / "plate__body-clear.png")
        bpy.ops.render.render(write_still=True)
        print("[plate] body-clear rendered")

    if "--proof" in ARGS:
        PROOF_DIR.mkdir(parents=True, exist_ok=True)
        proofs = [
            ("rollon-capped", {"slot__body", "slot__cap"}),
            ("rollon-open-metal", {"slot__body", "slot__roller", "roller__metal"}),
            ("spray", {"slot__body", "slot__sprayer"}),
            ("lotion", {"slot__body", "slot__pump"}),
        ]
        for name, visible in proofs:
            set_visible(visible)
            bpy.context.scene.render.filepath = str(PROOF_DIR / f"proof__{name}.png")
            bpy.ops.render.render(write_still=True)
            print(f"[proof] {name}")


main()
