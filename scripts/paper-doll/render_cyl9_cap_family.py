"""Render the CYL-9ML roll-on over-cap family from one Blender authority mesh.

The script is intentionally headless and deterministic. Geometry, camera, studio,
and mask recipes are hashed into a manifest so a material variant cannot silently
drift away from the shiny-silver authority.
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
if any(key != "SSLV" for key in REQUESTED_VARIANTS):
    raise ValueError("The calibrated-master milestone currently renders SSLV only.")

DIAMETER = float(RECIPE["nominalDimensionsMm"]["outsideDiameter"])
HEIGHT = float(RECIPE["nominalDimensionsMm"]["height"])
RADIUS = DIAMETER / 2.0
RENDER = RECIPE["render"]

# Normalized revolved half-profile. This is deliberately flatter and less bulbous
# at the top than the v1 generic beveled cylinder. The small taper and shallow
# corner roll match the approved shiny-silver photographic silhouette.
PROFILE_NORMALIZED = [
    [0.5000, 0.0000],
    [0.5000, 0.9000],
    [0.4980, 0.9450],
    [0.4920, 0.9660],
    [0.4800, 0.9820],
    [0.4560, 0.9930],
    [0.4100, 0.9980],
    [0.0000, 1.0000],
]

CAMERA_RECIPE = {
    "type": "orthographic",
    "topArcRatio": float(RENDER["topArcRatio"]),
    "frameHeightMultiplier": 1.22,
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


def build_cap_mesh(recipe: dict) -> bpy.types.Object:
    """Return the single v2 over-cap geometry authority."""
    segments = 256
    profile = [(radius_ratio * DIAMETER, height_ratio * HEIGHT) for radius_ratio, height_ratio in PROFILE_NORMALIZED]
    ring_profile = profile[:-1]
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []

    for radius, z_value in ring_profile:
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z_value))

    for ring_index in range(len(ring_profile) - 1):
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
    top_ring = (len(ring_profile) - 1) * segments
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
    return cap


def build_camera(recipe: dict) -> bpy.types.Object:
    camera_data = bpy.data.cameras.new("cyl9_cap_camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = HEIGHT * CAMERA_RECIPE["frameHeightMultiplier"]
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


def create_principled_material(name: str) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.92, 0.92, 0.94, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.04
    bsdf.inputs["IOR"].default_value = 1.5
    return material


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
cap = build_cap_mesh(RECIPE)
camera = build_camera(RECIPE)
scene.camera = camera
studio = build_studio(RECIPE)

mirror_silver = create_principled_material("mirror_silver_phenolic_finish")
cap.data.materials.append(mirror_silver)

isolated_dir = OUT_DIR / "isolated"
render_records = []
provenance = {
    "meshRecipeHash": canonical_hash({"profile": PROFILE_NORMALIZED, "diameter": DIAMETER, "height": HEIGHT}),
    "cameraRecipeHash": canonical_hash(CAMERA_RECIPE),
    "studioRecipeHash": canonical_hash(STUDIO_RECIPE),
    "maskRecipeHash": canonical_hash(MASK_RECIPE),
}

for variant_key in REQUESTED_VARIANTS:
    render_path = isolated_dir / f"{variant_key}.png"
    cap.data.materials[0] = mirror_silver
    render_to(render_path)
    render_records.append({
        "variantKey": variant_key,
        "path": str(render_path.relative_to(OUT_DIR)),
        "provenance": provenance,
        "crystals": [],
    })

mask_path = OUT_DIR / "geometry-mask.png"
cap.data.materials[0] = create_mask_material()
for panel in studio.values():
    panel.hide_render = True
render_to(mask_path)

manifest = {
    "schemaVersion": 1,
    "geometryFamilyId": RECIPE["geometryFamilyId"],
    "blenderVersion": bpy.app.version_string,
    "maskPath": str(mask_path.relative_to(OUT_DIR)),
    "sharedProvenance": provenance,
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
