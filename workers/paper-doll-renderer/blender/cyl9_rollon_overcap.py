import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from materials import build_mask_material, build_stone_material, build_surface_material


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--stone-layout", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--scale", type=int, default=100)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(argv)


def load_json(path):
    with open(path, "r", encoding="utf8") as handle:
        return json.load(handle)


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) / 255.0 for index in (0, 2, 4))


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def build_lathed_cap(profile, segments):
    bottom_center = 0
    vertices = [(0.0, 0.0, float(profile[0][1]))]
    rings = []
    for radius, height in profile[1:-1]:
        ring = []
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            ring.append(len(vertices))
            vertices.append((float(radius) * math.cos(angle), float(radius) * math.sin(angle), float(height)))
        rings.append(ring)
    top_center = len(vertices)
    vertices.append((0.0, 0.0, float(profile[-1][1])))

    faces = []
    first = rings[0]
    for segment in range(segments):
        next_segment = (segment + 1) % segments
        faces.append((bottom_center, first[segment], first[next_segment]))
    for lower, upper in zip(rings, rings[1:]):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append((lower[segment], upper[segment], upper[next_segment], lower[next_segment]))
    last = rings[-1]
    for segment in range(segments):
        next_segment = (segment + 1) % segments
        faces.append((last[segment], top_center, last[next_segment]))

    mesh = bpy.data.meshes.new("cyl9-rollon-overcap-authority")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=True)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    cap = bpy.data.objects.new("CYL9_ROLLON_OVERCAP_AUTHORITY", mesh)
    bpy.context.collection.objects.link(cap)
    return cap


def build_stones(layout, cap_height, cap_diameter):
    stones = []
    barrel_radius = cap_diameter / 2.0 - 0.18
    for entry in layout["stones"]:
        angle = 2.0 * math.pi * float(entry["u"])
        stone_radius = float(entry["radius"]) * cap_diameter
        normal = Vector((math.sin(angle), -math.cos(angle), 0.0))
        bezel_center = barrel_radius + stone_radius * 0.12
        gem_center = barrel_radius + stone_radius * 0.38
        z = float(entry["v"]) * cap_height
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=stone_radius * 1.12,
            depth=stone_radius * 0.32,
            location=(bezel_center * normal.x, bezel_center * normal.y, z),
        )
        bezel = bpy.context.active_object
        bezel.name = f"STONE_BEZEL_{entry['id']}"
        bezel.rotation_euler = normal.to_track_quat("Z", "Y").to_euler()
        bezel["stone_role"] = "bezel"
        bezel["front_visible"] = math.cos(angle) >= 0.0
        stones.append(bezel)
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=3,
            radius=stone_radius * 0.92,
            location=(gem_center * normal.x, gem_center * normal.y, z),
        )
        stone = bpy.context.active_object
        stone.name = f"STONE_GEM_{entry['id']}"
        stone["stone_role"] = "gem"
        stone["front_visible"] = math.cos(angle) >= 0.0
        stones.append(stone)
    return stones


def add_area_light(name, location, energy, size, size_y, target):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = energy
    light_data.shape = "RECTANGLE"
    light_data.size = size
    light_data.size_y = size_y
    light = bpy.data.objects.new(name, light_data)
    bpy.context.collection.objects.link(light)
    light.location = location
    point_at(light, target)
    return light


def configure_scene(config, base_offset):
    scene = bpy.context.scene
    canvas = config["canvas"]
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = int(canvas["widthPx"])
    scene.render.resolution_y = int(canvas["heightPx"])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = bool(canvas["transparent"])
    scene.render.use_file_extension = True
    scene.render.resolution_percentage = max(1, min(100, ARGS.scale))
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    world = bpy.data.worlds.new("CYL9_STUDIO_WORLD") if bpy.context.scene.world is None else bpy.context.scene.world
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    rgb = hex_rgb(config["lighting"]["worldHex"])
    background.inputs["Color"].default_value = (*rgb, 1.0)
    background.inputs["Strength"].default_value = float(config["lighting"]["worldStrength"])

    camera_data = bpy.data.cameras.new("CYL9_ORTHO_AUTHORITY")
    camera = bpy.data.objects.new("CYL9_ORTHO_AUTHORITY", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = float(config["camera"]["orthoScale"])
    camera.location = tuple(config["camera"]["position"])
    point_at(camera, tuple(config["camera"]["lookAt"]))
    scene.camera = camera

    target = (0.0, 0.0, base_offset + config["imageContract"]["heightMmEquivalent"] * 0.56)
    add_area_light("KEY_RIGHT", (35.0, -42.0, base_offset + 31.0), 950.0, 10.0, 52.0, target)
    add_area_light("FILL_LEFT", (-31.0, -34.0, base_offset + 25.0), 360.0, 18.0, 42.0, target)
    add_area_light("EDGE_RIGHT", (18.0, 8.0, base_offset + 24.0), 520.0, 7.0, 48.0, target)
    return scene


def render_to(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def assign_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def main():
    config = load_json(os.path.abspath(ARGS.config))
    stone_layout = load_json(os.path.abspath(ARGS.stone_layout))
    output_dir = os.path.abspath(ARGS.output)
    os.makedirs(output_dir, exist_ok=True)
    clear_scene()

    ppm = float(config["imageContract"]["pixelsPerMm"])
    canvas = config["canvas"]
    placement = config["placement"]
    x_offset = (float(placement["mountAxisXPx"]) - float(canvas["widthPx"]) / 2.0) / ppm
    base_offset = (float(canvas["heightPx"]) / 2.0 - float(placement["seatYPx"])) / ppm

    cap = build_lathed_cap(config["geometry"]["profileMmEquivalent"], int(config["geometry"]["radialSegments"]))
    cap.location = (x_offset, 0.0, base_offset)
    cap_height = float(config["imageContract"]["heightMmEquivalent"])
    cap_diameter = float(config["imageContract"]["outerDiameterMmEquivalent"])
    stones = build_stones(stone_layout, cap_height, cap_diameter)
    for stone in stones:
        stone.location.x += x_offset
        stone.location.z += base_offset

    scene = configure_scene(config, base_offset)
    result = {
        "rendererVersion": config["rendererVersion"],
        "blenderVersion": bpy.app.version_string,
        "scalePercent": ARGS.scale,
        "beautyFiles": {},
        "authoritativeMaskRaw": "authoritative-mask-raw.png",
        "stoneMaskRaw": "stone-mask-raw.png",
    }

    for variant in config["variants"]:
        assign_material(cap, build_surface_material(variant["materialKey"]))
        stone_color = variant.get("stoneColor")
        for stone in stones:
            stone.hide_render = stone_color is None
            if stone_color is not None:
                color_key = "bezel" if stone["stone_role"] == "bezel" else stone_color
                assign_material(stone, build_stone_material(color_key))
        filename = f"beauty-{variant['variantKey']}.png"
        render_to(scene, os.path.join(output_dir, filename))
        result["beautyFiles"][variant["variantKey"]] = filename

    mask_material = build_mask_material()
    assign_material(cap, mask_material)
    cap.hide_render = False
    for stone in stones:
        stone.hide_render = True
    render_to(scene, os.path.join(output_dir, result["authoritativeMaskRaw"]))

    cap.hide_render = True
    for stone in stones:
        stone.hide_render = not bool(stone["front_visible"])
        assign_material(stone, mask_material)
    render_to(scene, os.path.join(output_dir, result["stoneMaskRaw"]))

    with open(os.path.join(output_dir, "renderer-result.json"), "w", encoding="utf8") as handle:
        json.dump(result, handle, indent=2)


ARGS = parse_args()
main()
