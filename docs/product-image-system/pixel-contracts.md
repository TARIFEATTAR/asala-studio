# Pixel contracts — pipeline

Single reference for **actual pixel sizes** at each stage. When `geometry_spec` / manifest disagree with a row, trust the row for that ingest; this table is the **default contract** the org agreed on.

| Source | Dimensions (W×H) | Ratio |
|--------|-------------------|--------|
| Current image-gen output (pipeline `image-gen/grid-images/output/openai/raw/*.png`) | **2080 × 2288** | 10:11 ≈ **0.909** |
| Sample CDN hero (Sanity) from a live paper-doll group | **928 × 1152** | ≈ **4:5** |
| Paper-doll composition canvas (local script → `manifest.json` → `geometry_spec`) | **2080 × 2288** | **10:11** |

## Best Bottles Canvas Tiers

Best Bottles PDP/catalog generations now have three routed production canvas tiers so low/wide products do not float inside the portrait master, and round/square products do not crowd the side margins.

| Tier | Dimensions (W×H) | Ratio | Primary families |
|------|-------------------|--------|------------------|
| Tall Portrait | **2080 × 2288** | **10:11** | Cylinder, Sleek, Slim, Empire, Elegant, Diva, Dropper, Vial, rectangular/tall families |
| Square / Round | **2048 × 2048** | **1:1** | Circle, Round, Square, Atomizer, Cap/Closure, Royal, Flair, Tulip |
| Wide / Low | **1536 × 1024** | **3:2** | Cream Jar, Heart 4ml, other low/wide products |

## Code

- Constants: `src/config/productImageDimensions.ts` (`PIPELINE_OPENAI_RAW_PX`, `SANITY_HERO_SAMPLE_PX`, `PAPER_DOLL_CANVAS_PX`).
- Best Bottles canvas-tier resolver: `src/config/productImageCanvasTiers.ts`.
- Handoff spec: `docs/product-image-system/local-script-handoff.md` (manifest `canonicalCanvas` must match exported PNGs).

## Notes

- **OpenAI raw** is the grid/pipeline generation size; **not** the same as the paper-doll ingest canvas.
- **Sanity heroes** are downstream web delivery; expect downscale and a more square-leaning ratio than 10:11.
- **2080 × 2288** is the current paper-doll **composition** canvas; QC against `geometry_spec.canonicalCanvas` uses whatever was ingested for that row.
