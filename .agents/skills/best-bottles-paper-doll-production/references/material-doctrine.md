# Material doctrine

| Material | Production method | Required review |
|---|---|---|
| Mirror chrome/gold | Reuse an approved reflection structure when available; otherwise GPT material edit. Clamp to the shared mask. | Sharp vertical reflection bands; thin coating over molded plastic; never solid/machined metal. |
| Matte | GPT material edit or calibrated render with genuinely diffuse micro-rough response. | No inherited mirror bands, brushing, grain, or metallic flake. |
| Glossy black/white | GPT dielectric material edit. | Dielectric Fresnel; smooth coating; no metallic response. |
| Translucent plastic | GPT material edit or physically based render. | Five-body assembly review; transmission and edge density; never auto-approve from brightness. |
| Plastic/metal roller | One shared housing silhouette. Metal changes only the ball to mirror chrome. | Housing pixels/geometry unchanged; exact alpha match between variants. |
| Rhinestone | Generate/render base material, then place registered stones deterministically. | Same stone IDs, order, normalized positions, and sizes on every rerender. |

Caps are molded plastic with thin decorative coatings. Do not prompt for aluminum, anodized, brushed, machined, cast, or solid-metal parts. When supplier substrate is unverified, say so; do not invent a resin grade.

Generated framing, shadows, and alpha are discarded. The authority mask and approved body plates remain the geometry authority.

Material QA is class-specific. Do not reuse one luminance, opacity, or texture threshold across mirror, matte, dielectric, translucent, roller, and rhinestone finishes.
