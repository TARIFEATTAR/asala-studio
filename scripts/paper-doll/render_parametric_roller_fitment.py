"""Render one shared roller-fitment geometry with plastic and metal ball variants.

The recipe owns the dimensional profile. Blender owns only the deterministic
mesh, camera, studio, and object mask. Material renders remain review inputs;
the geometry mask is the only alpha authority candidate and still requires
named approval before any production lock.
"""

from __future__ import annotations

import hashlib
import json
import math
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


RECIPE_PATH = Path(cli_value(
    "recipe",
    "docs/paper-doll-rig/boston-round-roller-fitment-20-400-family-recipe.json",
))
OUT_DIR = Path(cli_value(
    "out",
    "outputs/paper-doll-parametric-fitments/20-400-roller-fitment/blender-v1",
))
SAMPLES = int(cli_value("samples", "128"))

with RECIPE_PATH.open("r", encoding="utf8") as handle:
    RECIPE = json.load(handle)

GEOMETRY = RECIPE["geometry"]
RENDER = RECIPE["render"]
VARIANTS = RECIPE["variants"]
VISIBLE_HEIGHT = float(GEOMETRY["visibleHeightMm"])
OUTPUT_ASPECT = float(RENDER["widthPx"]) / float(RENDER["heightPx"])
TARGET_OCCUPIED_HEIGHT = int(RENDER["targetOccupiedHeightPx"])

CAMERA_RECIPE = {
    "type": "orthographic",
    "topArcRatio": float(RENDER["topArcRatio"]),
    "targetZMm": VISIBLE_HEIGHT / 2.0,
    "orthoScaleMm": VISIBLE_HEIGHT * float(RENDER["heightPx"]) / TARGET_OCCUPIED_HEIGHT,
    "outputAspect": OUTPUT_ASPECT,
}

STUDIO_RECIPE = {
    "worldColor": [0.78, 0.756, 0.716, 1.0],
    "worldStrength": 0.38,
    "panels": [
        {"name": "key", "location": [72, -32, 18], "rotationDeg": [90, 0, -64], "scale": [48, 74], "strength": 4.8},
        {"name": "fill", "location": [-68, -40, 18], "rotationDeg": [90, 0, 62], "scale": [42, 70], "strength": 1.15},
        {"name": "top", "location": [0, -12, 64], "rotationDeg": [0, 0, 0], "scale": [64, 64], "strength": 2.0},
        {"name": "edge", "location": [-38, 56, 18], "rotationDeg": [90, 0, 158], "scale": [12, 64], "strength": 3.0},
    ],
}

MASK_RECIPE = {
    "sameObjects": True,
    "sameCamera": True,
    "transparentFilm": True,
    "occupiedRgba": [255, 255, 255, 255],
    "backgroundRgba": [0, 0, 0, 0],
}


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


def smooth_object(obj: bpy.types.Object) -> None:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def add_bevel(obj: bpy.types.Object, width: float, segments: int = 4) -> None:
    modifier = obj.modifiers.new(name="manufactured_edge_roll", type="BEVEL")
    modifier.width = width
    modifier.segments = segments


def build_frustum(name: str, bottom_radius: float, top_radius: float, bottom_z: float, top_z: float) -> bpy.types.Object:
    segments = 192
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for z_value, radius in ((bottom_z, bottom_radius), (top_z, top_radius)):
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z_value))
    for segment in range(segments):
        next_segment = (segment + 1) % segments
        faces.append((segment, next_segment, segments + next_segment, segments + segment))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    smooth_object(obj)
    return obj


def build_geometry() -> tuple[list[bpy.types.Object], bpy.types.Object, dict]:
    flange_diameter = float(GEOMETRY["flangeOutsideDiameterMm"])
    flange_thickness = float(GEOMETRY["flangeThicknessMm"])
    housing_diameter = float(GEOMETRY["housingOutsideDiameterMm"])
    housing_height = float(GEOMETRY["housingCylinderHeightMm"])
    shoulder_height = float(GEOMETRY["shoulderHeightMm"])
    ball_diameter = float(GEOMETRY["ballDiameterMm"])
    ball_center_z = float(GEOMETRY["ballCenterZMm"])

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=256,
        radius=flange_diameter / 2.0,
        depth=flange_thickness,
        location=(0.0, 0.0, flange_thickness / 2.0),
    )
    flange = bpy.context.active_object
    flange.name = "roller_fitment_flange"
    smooth_object(flange)
    add_bevel(flange, min(0.16, flange_thickness * 0.08), 5)

    housing_bottom_z = flange_thickness * 0.55
    housing_top_z = housing_bottom_z + housing_height
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=256,
        radius=housing_diameter / 2.0,
        depth=housing_height,
        location=(0.0, 0.0, housing_bottom_z + housing_height / 2.0),
    )
    housing = bpy.context.active_object
    housing.name = "roller_fitment_housing"
    smooth_object(housing)
    add_bevel(housing, min(0.24, housing_diameter * 0.016), 6)

    shoulder = build_frustum(
        "roller_fitment_shoulder",
        housing_diameter / 2.0,
        ball_diameter * 0.51,
        housing_top_z - 0.08,
        housing_top_z + shoulder_height,
    )

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=256,
        ring_count=128,
        radius=ball_diameter / 2.0,
        location=(0.0, 0.0, ball_center_z),
    )
    ball = bpy.context.active_object
    ball.name = "roller_ball"
    smooth_object(ball)

    housing_objects = [flange, housing, shoulder]
    return housing_objects, ball, {
        "flangeOutsideDiameterMm": flange_diameter,
        "flangeThicknessMm": flange_thickness,
        "housingOutsideDiameterMm": housing_diameter,
        "housingCylinderHeightMm": housing_height,
        "shoulderHeightMm": shoulder_height,
        "ballDiameterMm": ball_diameter,
        "ballCenterZMm": ball_center_z,
        "visibleHeightMm": VISIBLE_HEIGHT,
        "objectCount": 4,
        "evidenceState": RECIPE["geometryCalibration"]["evidenceState"],
    }


def build_camera() -> bpy.types.Object:
    data = bpy.data.cameras.new("roller_fitment_camera")
    data.type = "ORTHO"
    data.ortho_scale = CAMERA_RECIPE["orthoScaleMm"]
    camera = bpy.data.objects.new("roller_fitment_camera", data)
    bpy.context.collection.objects.link(camera)
    elevation = math.asin(max(0.0, min(0.1, CAMERA_RECIPE["topArcRatio"])))
    distance = 96.0
    target_z = CAMERA_RECIPE["targetZMm"]
    camera.location = (0.0, -distance * math.cos(elevation), target_z + distance * math.sin(elevation))
    camera.rotation_euler = (math.radians(90.0) - elevation, 0.0, 0.0)
    return camera


def emission_panel(spec: dict) -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(
        size=1,
        location=tuple(spec["location"]),
        rotation=tuple(math.radians(value) for value in spec["rotationDeg"]),
    )
    panel = bpy.context.active_object
    panel.name = f"studio_{spec['name']}"
    panel.scale = (*spec["scale"], 1.0)
    material = bpy.data.materials.new(f"studio_{spec['name']}_material")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1.0, 0.985, 0.96, 1.0)
    emission.inputs["Strength"].default_value = spec["strength"]
    material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    panel.data.materials.append(material)
    return panel


def build_studio() -> dict[str, bpy.types.Object]:
    world = bpy.data.worlds.new("roller_fitment_studio")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = STUDIO_RECIPE["worldColor"]
    background.inputs["Strength"].default_value = STUDIO_RECIPE["worldStrength"]
    bpy.context.scene.world = world
    return {spec["name"]: emission_panel(spec) for spec in STUDIO_RECIPE["panels"]}


def natural_plastic_material() -> bpy.types.Material:
    material = bpy.data.materials.new("natural_molded_plastic")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.92, 0.94, 0.95, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.23
    bsdf.inputs["IOR"].default_value = 1.47
    transmission = bsdf.inputs.get("Transmission Weight")
    if transmission is not None:
        transmission.default_value = 0.18
    coat = bsdf.inputs.get("Coat Weight")
    if coat is not None:
        coat.default_value = 0.08
    return material


def mirror_chrome_material() -> bpy.types.Material:
    material = bpy.data.materials.new("mirror_chrome_ball")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.78, 0.80, 0.84, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.025
    coat = bsdf.inputs.get("Coat Weight")
    if coat is not None:
        coat.default_value = 0.18
    return material


def mask_material() -> bpy.types.Material:
    material = bpy.data.materials.new("roller_fitment_object_mask")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    emission.inputs["Strength"].default_value = 1.0
    material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return material


def assign_material(objects: list[bpy.types.Object], material: bpy.types.Material) -> None:
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(material)


def render_to(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


scene = configure_scene()
housing_objects, ball, geometry_stats = build_geometry()
camera = build_camera()
scene.camera = camera
studio = build_studio()

plastic = natural_plastic_material()
chrome = mirror_chrome_material()
assign_material(housing_objects, plastic)

provenance = {
    "meshRecipeHash": canonical_hash({
        "geometry": GEOMETRY,
        "calibration": RECIPE["geometryCalibration"],
        "objectRecipe": "flange-cylinder+hollow-appearance-cylinder+shoulder-frustum+roller-sphere-v1",
    }),
    "cameraRecipeHash": canonical_hash(CAMERA_RECIPE),
    "studioRecipeHash": canonical_hash(STUDIO_RECIPE),
    "maskRecipeHash": canonical_hash(MASK_RECIPE),
}

isolated_dir = OUT_DIR / "isolated"
render_records = []
for variant in VARIANTS:
    ball.data.materials.clear()
    ball.data.materials.append(plastic if variant["ballMaterial"] == "natural-molded-plastic" else chrome)
    render_path = isolated_dir / f"{variant['variantKey']}.png"
    render_to(render_path)
    render_records.append({
        "variantKey": variant["variantKey"],
        "componentId": variant["componentId"],
        "path": str(render_path.relative_to(OUT_DIR)),
        "provenance": provenance,
        "materialAssignment": {
            "housingMaterial": variant["housingMaterial"],
            "ballMaterial": variant["ballMaterial"],
        },
    })

object_mask = mask_material()
assign_material([*housing_objects, ball], object_mask)
for panel in studio.values():
    panel.hide_render = True
mask_path = OUT_DIR / "geometry-mask.png"
render_to(mask_path)

manifest = {
    "schemaVersion": 1,
    "recipeId": RECIPE["recipeId"],
    "geometryFamilyId": RECIPE["geometryFamilyId"],
    "authorityState": RECIPE["authorityState"],
    "blenderVersion": bpy.app.version_string,
    "maskPath": str(mask_path.relative_to(OUT_DIR)),
    "sharedProvenance": provenance,
    "geometryStats": geometry_stats,
    "renders": render_records,
    "mutationPolicy": RECIPE["mutationPolicy"],
}
OUT_DIR.mkdir(parents=True, exist_ok=True)
with (OUT_DIR / "blender-manifest.json").open("w", encoding="utf8") as handle:
    json.dump(manifest, handle, indent=2, sort_keys=True)
    handle.write("\n")

print(json.dumps({
    "status": "rendered",
    "outputDirectory": str(OUT_DIR),
    "variantKeys": [variant["variantKey"] for variant in VARIANTS],
    "provenance": provenance,
}, sort_keys=True))
