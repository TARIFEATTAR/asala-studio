# Best Bottles Product Image Prompt System PRD

## Goal

Build a reusable, schema-driven prompt builder for Best Bottles SKU reference PNGs. The system generates one SKU-specific prompt per reference image so each product can be recreated as a premium photorealistic editorial ecommerce image without redesigning the product.

The prompt builder is a compiler. It combines:

- universal PDP style rules
- product family geometry rules
- material truth rules
- closure/applicator rules
- frame/alignment rules
- SKU-specific identity lock
- negative prompt and QA rules

It must not generate images. It prepares deterministic prompt records for later image generation.

## Visual Standard

Final generated images should read as premium ecommerce product photography. The product must match the reference PNG exactly: silhouette, component count, closure state, material identity, body color, cap color, trim finish, orientation, and relative scale.

The improvement should come from better lighting, cleaner material separation, sharper edges, subtle contact shadow, and a seamless warm Bone background. It must not come from redesigning the product.

Canvas standard:

- 2080 x 2288 pixels
- 10:11 portrait
- seamless warm Bone background around `#F5F3EF`
- consistent family centerline, baseline, top air, side margins, and detached component placement

## System Inputs

Each SKU row must follow `schema/sku.schema.json`.

Required identity fields include:

- `sku`
- `filename`
- `product_family`
- `frame_class`
- `body_shape`
- `body_material`
- `body_color`
- `closure_type`
- `closure_material`
- `cap_color`
- `collar_material`
- `applicator_type`
- `detached_components`
- `orientation`
- `transparency_type`
- `special_geometry_notes`
- `reference_image_path`
- `output_canvas_width`
- `output_canvas_height`

The canonical reference source is a flattened product-truth PNG named by exact SKU where possible.

## Module Files

### Product Families

`config/product_families.json` defines geometry and family identity. It answers: what shape is this product and what must never mutate?

Families include roll-on, Cylinder, Boston Round, rectangular, Empire, classic spray, fine mist sprayer, atomizer, dropper, vial, orifice reducer, splash bottle, vintage bulb sprayer, decorative bottle, apothecary bottle, lotion pump, aluminum bottle, cream jar, bag, box, and accessory.

Family modules must describe:

- preserved geometry
- prohibited mutations
- prompt lines
- QA keys

### Material Modules

`config/material_modules.json` defines material truth. It prevents glass language from leaking into plastic, aluminum, paper, or fabric prompts.

Material examples:

- clear glass can use wall thickness, rim glints, controlled refraction, and small caustics
- clear molded plastic must avoid heavy glass caustics and crystal thickness
- brushed aluminum must be opaque and never transparent
- paperboard must use carton panel and fold language, not refraction
- fabric must use weave, pile, fold, and tactile texture language

### Closure Modules

`config/closure_modules.json` defines cap/applicator truth. This is separate from family because many families can share a closure.

Closure modules protect:

- cap state
- actuator/nozzle shape
- dip tube requirements
- roller ball plug state
- detached over-cap behavior
- pale cap visibility against Bone
- component count

### Frame Classes

`config/frame_classes.json` defines ecommerce grid behavior. It controls centerline, baseline, safe zone, detached component behavior, and scale logic.

Frame classes include:

- `tall_narrow`
- `medium_upright`
- `wide_bottle`
- `low_wide_jar`
- `grouped_accessory`
- `box_or_bag`
- `decorative_silhouette`

## Prompt Assembly

`prompts/master_pdp_prompt.md` is the universal PDP shell. The generator fills:

- SKU lock
- module prompt
- output canvas dimensions

`scripts/generate-prompts.ts` loads SKU rows from JSON or CSV, resolves modules, creates final prompts, and writes JSONL records with:

- `sku`
- `reference_image_path`
- `product_family`
- `frame_class`
- `final_prompt`
- `qa_checklist`

## QA Requirements

Every output prompt record carries QA checklist keys derived from default rules and module rules. The QA checklist should be used after generation to reject images with:

- changed geometry
- mutated cap/applicator
- wrong material
- clear plastic rendered as smoky glass
- glass rendered cloudy or blotchy
- white/clear caps disappearing into Bone
- heavy shadows
- off-center framing
- family baseline drift
- missing detached components
- extra props, labels, text, or decorative details

## Non-Goals

This system does not:

- call OpenAI, GPT Image 2, Higgsfield, or any image API
- upload files
- mutate Supabase rows or storage
- publish to Shopify
- replace live Madison generation until explicitly wired in later

## Success Criteria

- The sample SKU set generates valid JSONL.
- Each final prompt includes SKU lock, family, material, closure, frame, and QA sections.
- Material language remains scoped to the SKU material.
- Pale cap visibility is explicit for relevant closures.
- Product families preserve their geometry and reject family-changing mutations.
