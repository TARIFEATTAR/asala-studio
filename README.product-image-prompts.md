# Best Bottles Product Image Prompt Compiler

This bundle builds SKU-specific prompt records for Best Bottles product reference PNGs. It does not generate images.

## Files

- `docs/product-image-prd.md`: strategy, architecture, and success criteria
- `docs/qa-checklist.md`: output rejection rules
- `config/product_families.json`: product-family geometry modules
- `config/material_modules.json`: material truth modules
- `config/closure_modules.json`: cap/applicator modules
- `config/frame_classes.json`: ecommerce grid framing modules
- `config/negative_rules.json`: global rejection/negative rules and QA keys
- `schema/sku.schema.json`: SKU metadata contract
- `prompts/master_pdp_prompt.md`: universal PDP prompt shell
- `examples/sample_skus.json`: sample input set
- `scripts/generate-prompts.ts`: JSON/CSV to JSONL prompt compiler

## Generate Sample Prompts

```bash
/Users/jordanrichter/.local/bin/node node_modules/tsx/dist/cli.mjs scripts/generate-prompts.ts --input examples/sample_skus.json --out tmp/best-bottles-sample-prompts.jsonl
```

Each JSONL line contains:

- `sku`
- `reference_image_path`
- `product_family`
- `frame_class`
- `final_prompt`
- `qa_checklist`

## Add New SKUs

1. Add a row to a JSON or CSV input file using `schema/sku.schema.json`.
2. Set `product_family` to a key from `config/product_families.json`.
3. Set `body_material` to a key from `config/material_modules.json`.
4. Set `closure_type` to a key from `config/closure_modules.json`.
5. Set `frame_class` to a key from `config/frame_classes.json`.
6. Use a flattened product-truth reference PNG path in `reference_image_path`.
7. Run the generator and inspect the JSONL.

## Safety Rules

- Do not call image generation from this compiler.
- Do not upload files.
- Do not mutate Supabase.
- Do not push to Shopify.
- Treat this as a deterministic prompt-record build step.

## Tests

```bash
/Users/jordanrichter/.local/bin/node node_modules/tsx/dist/cli.mjs --test scripts/generate-prompts.test.ts
```
