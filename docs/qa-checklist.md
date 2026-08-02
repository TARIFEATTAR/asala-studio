# Best Bottles Product Image QA Checklist

Reject a generated image if any rule below fails.

## Identity

- Reject if the product family changes.
- Reject if body geometry, silhouette, body width, body height, shoulder shape, base shape, or neck finish changes.
- Reject if swirl, facet, panel, embossing, or decorative geometry changes.
- Reject if product orientation changes from the reference.

## Cap And Applicator

- Reject if cap, actuator, nozzle, pump, roller ball, dropper, reducer, bulb, hose, tassel, or collar mutates.
- Reject if cap state changes from the reference.
- Reject if detached components disappear.
- Reject if extra caps, duplicate caps, ghost cap outlines, or extra cap-like cylinders appear.
- Reject if white, clear, translucent, or pale caps disappear into the Bone background.
- Reject if pale cap rims, top ellipses, sidewalls, nozzle faces, or contact edges are not readable.

## Material Truth

- Reject if glass becomes plastic, plastic becomes glass, metal becomes glass, fabric becomes paper, or paperboard becomes plastic.
- Reject if clear plastic becomes smoky glass.
- Reject if glass becomes cloudy, blotchy, milky, or a blank white void.
- Reject if aluminum or atomizer shells become transparent or show liquid/interior detail.
- Reject if paperboard receives glass caustics, metal grain, fabric weave, or transparency.
- Reject if fabric becomes glossy plastic, paperboard, metal, or glass.

## Framing

- Reject if the product is off-center.
- Reject if baseline drifts within a family.
- Reject if the product scale changes relative to family siblings.
- Reject if cap, base, detached components, tassel, hose, or shadow touches or exits the canvas.
- Reject if tall products become tiny because of transparent padding.

## Background And Shadow

- Reject if the background is not seamless warm Bone around `#F5F3EF`.
- Reject if there is a horizon line, tabletop edge, floor plane, paper edge, vignette, texture patch, or visible rectangle.
- Reject if the shadow is heavy, long, hard, smeared, directional, or detached from the product.
- Reject if the background has blotchy discoloration or side stains.

## Content Pollution

- Reject if labels, text, logos, watermarks, badges, UI pills, props, hands, flowers, lifestyle scenes, wood tables, curtains, or brand assets appear unless already present in the reference and required by the SKU.

## Output Contract

- Reject if output is not a 2080 x 2288 portrait PDP canvas when that size is requested.
- Reject if the product is visibly lower quality than the reference.
- Reject if the image looks like a legacy catalog cutout rather than premium editorial ecommerce product photography.
