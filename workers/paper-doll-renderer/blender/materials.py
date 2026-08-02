import bpy


PRESETS = {
    "mirror-silver": {"kind": "mirror", "tint": (0.92, 0.94, 0.96, 1.0)},
    "mirror-gold": {"kind": "mirror", "tint": (0.83, 0.56, 0.16, 1.0)},
    "matte-copper": {"kind": "matte", "color": (0.58, 0.22, 0.09, 1.0), "roughness": 0.48},
    "glossy-black": {"kind": "gloss", "color": (0.008, 0.009, 0.012, 1.0), "roughness": 0.14},
    "matte-silver": {"kind": "matte", "color": (0.42, 0.45, 0.49, 1.0), "roughness": 0.52},
    "matte-gold": {"kind": "matte", "color": (0.68, 0.42, 0.09, 1.0), "roughness": 0.5},
    "glossy-white": {"kind": "gloss", "color": (1.0, 0.98, 0.93, 1.0), "roughness": 0.16},
}

STONE_COLORS = {
    "silver": (0.85, 0.9, 0.98, 1.0),
    "black": (0.008, 0.01, 0.018, 1.0),
    "pink": (0.72, 0.08, 0.24, 1.0),
    "bezel": (0.025, 0.03, 0.04, 1.0),
}


def _input(node, *names):
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            return socket
    raise KeyError(f"Unsupported Principled input names: {names}")


def _principled(name):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material, shader


def _tinted(value, tint):
    return (
        min(1.0, value * tint[0]),
        min(1.0, value * tint[1]),
        min(1.0, value * tint[2]),
        1.0,
    )


def _build_mirror(name, tint):
    material, shader = _principled(name)
    nodes = material.node_tree.nodes
    coordinates = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "LINEAR"
    stops = [
        (0.0, 0.34),
        (0.1, 0.52),
        (0.115, 0.12),
        (0.29, 0.08),
        (0.305, 0.62),
        (0.53, 0.78),
        (0.545, 0.9),
        (0.76, 1.0),
        (0.775, 0.035),
        (0.9, 0.02),
        (0.915, 0.38),
        (1.0, 0.54),
    ]
    while len(ramp.color_ramp.elements) < len(stops):
        ramp.color_ramp.elements.new(0.5)
    for element, (position, value) in zip(ramp.color_ramp.elements, stops):
        element.position = position
        element.color = _tinted(value, tint)
    material.node_tree.links.new(coordinates.outputs["Generated"], separate.inputs["Vector"])
    material.node_tree.links.new(separate.outputs["X"], ramp.inputs["Fac"])
    material.node_tree.links.new(ramp.outputs["Color"], _input(shader, "Base Color"))
    _input(shader, "Metallic").default_value = 0.78
    _input(shader, "Roughness").default_value = 0.075
    coat = shader.inputs.get("Coat Weight") or shader.inputs.get("Clearcoat")
    if coat is not None:
        coat.default_value = 0.3
    return material


def _build_tonal_ramp(material, shader, color, kind):
    nodes = material.node_tree.nodes
    coordinates = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    if kind == "gloss" and max(color[:3]) < 0.1:
        stops = [(0.0, 0.3), (0.52, 0.45), (0.72, 1.0), (0.82, 0.5), (1.0, 0.24)]
    elif kind == "gloss":
        stops = [(0.0, 0.64), (0.42, 0.84), (0.72, 1.0), (0.9, 0.78), (1.0, 0.58)]
    else:
        stops = [(0.0, 0.62), (0.3, 0.8), (0.68, 1.0), (0.9, 0.78), (1.0, 0.58)]
    while len(ramp.color_ramp.elements) < len(stops):
        ramp.color_ramp.elements.new(0.5)
    for element, (position, factor) in zip(ramp.color_ramp.elements, stops):
        element.position = position
        element.color = (
            min(1.0, color[0] * factor),
            min(1.0, color[1] * factor),
            min(1.0, color[2] * factor),
            1.0,
        )
    material.node_tree.links.new(coordinates.outputs["Generated"], separate.inputs["Vector"])
    material.node_tree.links.new(separate.outputs["X"], ramp.inputs["Fac"])
    material.node_tree.links.new(ramp.outputs["Color"], _input(shader, "Base Color"))


def build_surface_material(preset_key):
    preset = PRESETS[preset_key]
    if preset["kind"] == "mirror":
        return _build_mirror(f"surface-{preset_key}", preset["tint"])
    material, shader = _principled(f"surface-{preset_key}")
    _build_tonal_ramp(material, shader, preset["color"], preset["kind"])
    _input(shader, "Roughness").default_value = preset["roughness"]
    _input(shader, "Metallic").default_value = 0.0
    specular = shader.inputs.get("Specular IOR Level") or shader.inputs.get("Specular")
    if specular is not None:
        specular.default_value = 0.5 if preset["kind"] == "gloss" else 0.3
    coat = shader.inputs.get("Coat Weight") or shader.inputs.get("Clearcoat")
    if coat is not None:
        coat.default_value = 0.35 if preset["kind"] == "gloss" else 0.0
    return material


def build_stone_material(color_key):
    material, shader = _principled(f"stone-{color_key}")
    _input(shader, "Base Color").default_value = STONE_COLORS[color_key]
    _input(shader, "Roughness").default_value = 0.08
    _input(shader, "Metallic").default_value = 0.25 if color_key in ("silver", "bezel") else 0.0
    transmission = shader.inputs.get("Transmission Weight") or shader.inputs.get("Transmission")
    if transmission is not None:
        transmission.default_value = 0.35
    _input(shader, "IOR").default_value = 1.52
    return material


def build_mask_material():
    material = bpy.data.materials.new(name="authority-mask-white")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    emission.inputs["Strength"].default_value = 1.0
    material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return material
