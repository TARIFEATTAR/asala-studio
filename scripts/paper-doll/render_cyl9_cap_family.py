"""Render a parametric roll-on over-cap family from one Blender authority mesh.

The historical filename remains for backwards compatibility with the CYL-9ML
pipeline. Geometry is now recipe-owned so other measured over-cap families can
reuse the renderer without inheriting the 17-415 profile by accident. The script
is intentionally headless and deterministic. Geometry, camera, studio, and mask
recipes are hashed into a manifest so a material variant cannot silently drift.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import sys
from pathlib import Path

import bpy


def cli_value(name: str, default: str | None = None) -> str | None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    flag = f"--{name}"
    return argv[argv.index(flag) + 1] if flag in argv else default


def canonical_hash(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf8")
    return hashlib.sha256(encoded).hexdigest()


RECIPE_PATH = Path(cli_value("recipe", "docs/paper-doll-rig/cyl9-cap-family-recipe.json"))
OUT_DIR = Path(cli_value("out", "outputs/paper-doll-cyl9-cap-family/candidate-v2"))
SAMPLES = int(cli_value("samples", "128"))
REQUESTED_VARIANTS = [
    value.strip() for value in str(cli_value("variants", "SSLV")).split(",") if value.strip()
]

with RECIPE_PATH.open("r", encoding="utf8") as handle:
    RECIPE = json.load(handle)

VARIANTS = {entry["variantKey"]: entry for entry in RECIPE["variants"]}
unsupported = [key for key in REQUESTED_VARIANTS if key not in VARIANTS]
if unsupported:
    raise ValueError(f"Unknown CYL-9ML cap variants: {', '.join(unsupported)}")

DIAMETER = float(RECIPE["nominalDimensionsMm"]["outsideDiameter"])
NOMINAL_HEIGHT = float(RECIPE["nominalDimensionsMm"]["height"])
HEIGHT_SCALE = float(RECIPE["geometryCalibration"]["heightScale"])
HEIGHT = NOMINAL_HEIGHT * HEIGHT_SCALE
RADIUS = DIAMETER / 2.0
RENDER = RECIPE["render"]
OUTPUT_ASPECT = float(RENDER["widthPx"]) / float(RENDER["heightPx"])
FRAMING_VERTICAL_EXTENT = max(HEIGHT, DIAMETER / OUTPUT_ASPECT)

# Normalized revolved half-profile. This is deliberately flatter and less bulbous
# at the top than the v1 generic beveled cylinder. The small taper and shallow
# corner roll match the approved shiny-silver photographic silhouette.
DEFAULT_PROFILE_NORMALIZED = [
    [0.5000, 0.0000],
    [0.5000, 0.9000],
    [0.4980, 0.9450],
    [0.4920, 0.9660],
    [0.4800, 0.9820],
    [0.4560, 0.9930],
    [0.4100, 0.9980],
    [0.0000, 1.0000],
]
PROFILE_NORMALIZED = RECIPE.get("profileNormalized", DEFAULT_PROFILE_NORMALIZED)
SURFACE_PROFILE = RECIPE.get("surfaceProfile", {"kind": "smooth"})

CAMERA_RECIPE = {
    "type": "orthographic",
    "topArcRatio": float(RENDER["topArcRatio"]),
    "frameHeightMultiplier": 1.22,
    "outputAspect": OUTPUT_ASPECT,
    "framingVerticalExtentMm": FRAMING_VERTICAL_EXTENT,
    "targetZRatio": 0.5,
}

STUDIO_RECIPE = {
    "worldColor": [0.780, 0.756, 0.716, 1.0],
    "worldStrength": 0.42,
    "panels": [
        {"name": "key", "location": [118, -34, 14], "rotationDeg": [90, 0, -64], "scale": [96, 150], "strength": 5.0},
        {"name": "fill", "location": [-112, -46, 14], "rotationDeg": [90, 0, 62], "scale": [84, 140], "strength": 1.2},
        {"name": "top", "location": [0, -18, 96], "rotationDeg": [0, 0, 0], "scale": [130, 130], "strength": 2.2},
        {"name": "edge", "location": [-58, 78, 20], "rotationDeg": [90, 0, 158], "scale": [22, 120], "strength": 3.2},
    ],
}

MASK_RECIPE = {
    "sameEvaluatedMesh": True,
    "sameCamera": True,
    "transparentFilm": True,
    "occupiedRgba": [255, 255, 255, 255],
    "backgroundRgba": [0, 0, 0, 0],
}

MATERIAL_PRESETS = {
    "mirror-silver": {
        "baseColor": [0.82, 0.83, 0.86, 1.0],
        "metallic": 1.0,
        "roughness": 0.035,
        "coatWeight": 0.18,
    },
    "matte-silver": {
        "baseColor": [0.60, 0.61, 0.64, 1.0],
        "metallic": 1.0,
        "roughness": 0.38,
        "coatWeight": 0.0,
    },
    "mirror-gold": {
        "baseColor": [0.83, 0.50, 0.12, 1.0],
        "metallic": 1.0,
        "roughness": 0.05,
        "coatWeight": 0.16,
    },
    "matte-gold": {
        "baseColor": [0.68, 0.37, 0.08, 1.0],
        "metallic": 1.0,
        "roughness": 0.40,
        "coatWeight": 0.0,
    },
    "glossy-black": {
        "baseColor": [0.008, 0.009, 0.011, 1.0],
        "metallic": 0.0,
        "roughness": 0.12,
        "coatWeight": 0.42,
    },
    "matte-copper": {
        "baseColor": [0.54, 0.17, 0.055, 1.0],
        "metallic": 1.0,
        "roughness": 0.43,
        "coatWeight": 0.0,
    },
    "glossy-white": {
        "baseColor": [0.93, 0.91, 0.87, 1.0],
        "metallic": 0.0,
        "roughness": 0.14,
        "coatWeight": 0.38,
    },
    "matte-pink": {
        "baseColor": [0.72, 0.26, 0.36, 1.0],
        "metallic": 0.0,
        "roughness": 0.38,
        "coatWeight": 0.0,
    },
}


def smoothstep(value: float) -> float:
    clamped = max(0.0, min(1.0, value))
    return clamped * clamped * (3.0 - 2.0 * clamped)


def profile_radius_at(height_ratio: float) -> float:
    for index in range(len(PROFILE_NORMALIZED) - 1):
        left_radius, left_height = PROFILE_NORMALIZED[index]
        right_radius, right_height = PROFILE_NORMALIZED[index + 1]
        if left_height <= height_ratio <= right_height:
            span = right_height - left_height
            mix = 0.0 if span == 0 else (height_ratio - left_height) / span
            return (left_radius + (right_radius - left_radius) * mix) * DIAMETER
    return float(PROFILE_NORMALIZED[-1][0]) * DIAMETER


def flute_radial_delta(angle: float, height_ratio: float, base_radius: float) -> float:
    if SURFACE_PROFILE["kind"] != "recessed-vertical-flutes":
        return 0.0
    start = float(SURFACE_PROFILE["startHeightRatio"])
    end = float(SURFACE_PROFILE["endHeightRatio"])
    fade = float(SURFACE_PROFILE["fadeRatio"])
    if height_ratio < start or height_ratio > end:
        return 0.0
    envelope = smoothstep((height_ratio - start) / fade) * smoothstep((end - height_ratio) / fade)
    phase = math.radians(float(SURFACE_PROFILE["phaseDeg"]))
    flute_count = int(SURFACE_PROFILE["fluteCount"])
    narrow_recess = ((1.0 - math.cos(flute_count * angle + phase)) * 0.5) ** 4
    return -base_radius * float(SURFACE_PROFILE["fluteDepthRatio"]) * envelope * narrow_recess


def build_cap_mesh(recipe: dict) -> tuple[bpy.types.Object, dict]:
    """Return one recipe-owned over-cap mesh and measured construction evidence."""
    flute_count = int(SURFACE_PROFILE.get("fluteCount", 0))
    segments = max(256, flute_count * 12)
    axial_ratios = {float(height_ratio) for _, height_ratio in PROFILE_NORMALIZED[:-1]}
    if SURFACE_PROFILE["kind"] == "recessed-vertical-flutes":
        start = float(SURFACE_PROFILE["startHeightRatio"])
        end = float(SURFACE_PROFILE["endHeightRatio"])
        fade = float(SURFACE_PROFILE["fadeRatio"])
        axial_ratios.update({start, start + fade, end - fade, end})
    ring_height_ratios = sorted(axial_ratios)
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    recessed_vertex_count = 0
    minimum_radial_delta = 0.0
    maximum_radius = 0.0

    for height_ratio in ring_height_ratios:
        base_radius = profile_radius_at(height_ratio)
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            radial_delta = flute_radial_delta(angle, height_ratio, base_radius)
            radius = base_radius + radial_delta
            if radial_delta < -1e-9:
                recessed_vertex_count += 1
            minimum_radial_delta = min(minimum_radial_delta, radial_delta)
            maximum_radius = max(maximum_radius, radius)
            z_value = height_ratio * HEIGHT
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z_value))

    for ring_index in range(len(ring_height_ratios) - 1):
        current = ring_index * segments
        following = (ring_index + 1) * segments
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append((
                current + segment,
                current + next_segment,
                following + next_segment,
                following + segment,
            ))

    top_center_index = len(vertices)
    vertices.append((0.0, 0.0, HEIGHT))
    top_ring = (len(ring_height_ratios) - 1) * segments
    for segment in range(segments):
        next_segment = (segment + 1) % segments
        faces.append((top_ring + segment, top_ring + next_segment, top_center_index))

    mesh = bpy.data.meshes.new("cyl9_rollon_overcap_v2_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    cap = bpy.data.objects.new("cyl9_rollon_overcap_v2", mesh)
    bpy.context.collection.objects.link(cap)

    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return cap, {
        "surfaceProfileKind": SURFACE_PROFILE["kind"],
        "fluteCount": flute_count,
        "segmentCount": segments,
        "ringCount": len(ring_height_ratios),
        "vertexCount": len(vertices),
        "faceCount": len(faces),
        "recessedVertexCount": recessed_vertex_count,
        "minimumRadialDeltaMm": minimum_radial_delta,
        "maximumRadiusMm": maximum_radius,
    }


def build_camera(recipe: dict) -> bpy.types.Object:
    camera_data = bpy.data.cameras.new("cyl9_cap_camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = FRAMING_VERTICAL_EXTENT * CAMERA_RECIPE["frameHeightMultiplier"]
    camera = bpy.data.objects.new("cyl9_cap_camera", camera_data)
    bpy.context.collection.objects.link(camera)

    elevation = math.asin(max(0.0, min(0.1, CAMERA_RECIPE["topArcRatio"])))
    distance = 120.0
    target_z = HEIGHT * CAMERA_RECIPE["targetZRatio"]
    camera.location = (0.0, -distance * math.cos(elevation), target_z + distance * math.sin(elevation))
    camera.rotation_euler = (math.radians(90.0) - elevation, 0.0, 0.0)
    return camera


def emission_panel(spec: dict) -> bpy.types.Object:
    location = tuple(spec["location"])
    rotation = tuple(math.radians(value) for value in spec["rotationDeg"])
    bpy.ops.mesh.primitive_plane_add(size=1, location=location, rotation=rotation)
    panel = bpy.context.active_object
    panel.name = f"studio_{spec['name']}"
    panel.scale = (*spec["scale"], 1.0)

    material = bpy.data.materials.new(f"studio_{spec['name']}_material")
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1.0, 0.985, 0.96, 1.0)
    emission.inputs["Strength"].default_value = spec["strength"]
    material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    panel.data.materials.append(material)
    return panel


def build_studio(recipe: dict) -> dict[str, bpy.types.Object]:
    world = bpy.data.worlds.new("cyl9_cap_studio")
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = STUDIO_RECIPE["worldColor"]
    background.inputs["Strength"].default_value = STUDIO_RECIPE["worldStrength"]
    bpy.context.scene.world = world
    return {spec["name"]: emission_panel(spec) for spec in STUDIO_RECIPE["panels"]}


def create_finish_material(material_key: str) -> bpy.types.Material:
    preset = MATERIAL_PRESETS[material_key]
    material = bpy.data.materials.new(f"cyl9_{material_key}_phenolic_finish")
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = preset["baseColor"]
    bsdf.inputs["Metallic"].default_value = preset["metallic"]
    bsdf.inputs["Roughness"].default_value = preset["roughness"]
    bsdf.inputs["IOR"].default_value = 1.5
    coat = bsdf.inputs.get("Coat Weight")
    if coat is not None:
        coat.default_value = preset["coatWeight"]
    return material


def create_crystal_material() -> bpy.types.Material:
    material = bpy.data.materials.new("cyl9_crystal_v1")
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.94, 0.98, 1.0, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.22
    bsdf.inputs["Roughness"].default_value = 0.045
    bsdf.inputs["IOR"].default_value = 1.46
    transmission = bsdf.inputs.get("Transmission Weight")
    if transmission is not None:
        transmission.default_value = 0.52
    coat = bsdf.inputs.get("Coat Weight")
    if coat is not None:
        coat.default_value = 0.24
    return material


def build_crystals(recipe: dict) -> list[bpy.types.Object]:
    material = create_crystal_material()
    crystals = []
    for spec in recipe["crystalLayout"]:
        angle = math.radians(float(spec["angleDeg"]))
        radius = DIAMETER * float(spec["scaleRatio"])
        surface_radius = RADIUS + radius * 0.14
        location = (
            surface_radius * math.sin(angle),
            -surface_radius * math.cos(angle),
            HEIGHT * float(spec["heightRatio"]),
        )
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=12,
            radius=radius,
            depth=radius * 0.42,
            location=location,
            rotation=(math.radians(90.0), 0.0, -angle),
        )
        crystal = bpy.context.active_object
        crystal.name = f"crystal_{spec['id']}"
        crystal.data.materials.append(material)
        bevel = crystal.modifiers.new(name="shallow_faceted_crown", type="BEVEL")
        bevel.width = radius * 0.24
        bevel.segments = 1
        crystal.hide_render = True
        crystals.append(crystal)
    return crystals


def set_crystal_visibility(crystals: list[bpy.types.Object], visible: bool) -> None:
    for crystal in crystals:
        crystal.hide_render = not visible


def create_mask_material() -> bpy.types.Material:
    material = bpy.data.materials.new("cyl9_cap_object_mask")
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    emission.inputs["Strength"].default_value = 1.0
    material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return material


def configure_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.resolution_x = int(RENDER["widthPx"])
    scene.render.resolution_y = int(RENDER["heightPx"])
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    for transform in ("Khronos PBR Neutral", "AgX", "Filmic", "Standard"):
        try:
            scene.view_settings.view_transform = transform
            break
        except TypeError:
            continue
    return scene


def render_to(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


scene = configure_scene()
cap, geometry_stats = build_cap_mesh(RECIPE)
camera = build_camera(RECIPE)
scene.camera = camera
studio = build_studio(RECIPE)
crystals = build_crystals(RECIPE)

finish_materials = {
    material_key: create_finish_material(material_key)
    for material_key in MATERIAL_PRESETS
}
cap.data.materials.append(finish_materials["mirror-silver"])

isolated_dir = OUT_DIR / "isolated"
render_records = []
provenance = {
    "meshRecipeHash": canonical_hash({
        "profile": PROFILE_NORMALIZED,
        "diameter": DIAMETER,
        "nominalHeight": NOMINAL_HEIGHT,
        "heightScale": HEIGHT_SCALE,
        "calibratedHeight": HEIGHT,
        "surfaceProfile": SURFACE_PROFILE,
    }),
    "cameraRecipeHash": canonical_hash(CAMERA_RECIPE),
    "studioRecipeHash": canonical_hash(STUDIO_RECIPE),
    "maskRecipeHash": canonical_hash(MASK_RECIPE),
}

for variant_key in REQUESTED_VARIANTS:
    variant = VARIANTS[variant_key]
    render_path = isolated_dir / f"{variant_key}.png"
    cap.data.materials[0] = finish_materials[variant["material"]]
    decorated = variant["decoration"] == "crystal-v1"
    set_crystal_visibility(crystals, decorated)
    render_to(render_path)
    render_records.append({
        "variantKey": variant_key,
        "path": str(render_path.relative_to(OUT_DIR)),
        "provenance": provenance,
        "crystals": [dict(item) for item in RECIPE["crystalLayout"]] if decorated else [],
    })

mask_path = OUT_DIR / "geometry-mask.png"
cap.data.materials[0] = create_mask_material()
set_crystal_visibility(crystals, False)
for panel in studio.values():
    panel.hide_render = True
render_to(mask_path)

manifest = {
    "schemaVersion": 1,
    "geometryFamilyId": RECIPE["geometryFamilyId"],
    "blenderVersion": bpy.app.version_string,
    "maskPath": str(mask_path.relative_to(OUT_DIR)),
    "sharedProvenance": provenance,
    "geometryStats": geometry_stats,
    "renders": render_records,
}
OUT_DIR.mkdir(parents=True, exist_ok=True)
with (OUT_DIR / "blender-manifest.json").open("w", encoding="utf8") as handle:
    json.dump(manifest, handle, indent=2, sort_keys=True)
    handle.write("\n")

print(json.dumps({
    "status": "rendered",
    "outputDirectory": str(OUT_DIR),
    "variants": REQUESTED_VARIANTS,
    "provenance": provenance,
}, sort_keys=True))
