# Orphaned local Supabase migrations archived 2026-07-10

These migration files were present locally but absent from the linked production
project's `supabase_migrations.schema_migrations` ledger. On 2026-07-10, the
repository owner explicitly approved moving them out of the active
`supabase/migrations/` directory so they would not be replayed with
`--include-all` ahead of the Best Bottles image reconciliation migration.

No migration version in this archive was marked applied remotely. No SQL in this
archive was executed during the archive operation. The original files are
preserved unchanged beside this README.

## Evidence source

- Linked project: `likkskifwsrvszxdvufw`
- Remote schema-only snapshot: `/tmp/bb-current-remote-schema.sql`
- Snapshot lines: 9,298
- Snapshot SHA-256: `9c84a30500a8a76e0b3f43a0dcb4ac38641a9abddb984e7f8fde3bf6f36375ae`
- Audit basis: exact intended migration effects compared with the current remote
  schema; data/storage-only effects were not inferred from schema.

## Equivalent final schema exists remotely, but ledger entry is absent

These versions were not repaired as applied. Their intended final schema is
present, potentially through manual changes, a later migration, or an unrecorded
historical apply:

- `20260120000000_add_variants_to_product_hubs.sql`
- `20260123000000_librarian_foundation.sql`
- `20260422000000_consistency_set_columns.sql`
- `20260422010000_library_tags_column.sql`
- `20260424000000_prompt_descriptors.sql`
- `20260424010000_paper_doll_approved_assets.sql`
- `20260627002000_allow_flattened_product_truth_reference_source.sql`

## Intended effects are materially missing or conflict with production

These files must not be marked applied. They require an independent product and
schema review before any future replacement migration is written:

- `20260119000000_add_ecommerce_product_fields.sql`
  - Most intended `brand_products` columns and all five indexes are absent.
  - Existing `brand_products.images` is `text[]`, while this old migration expects
    `jsonb`; blindly applying it would conflict with production.
- `20260213000000_create_press_tables.sql`
  - Press/dieline tables, indexes, policies, functions, and triggers are absent.
- `20260213000002_seed_starter_dielines.sql`
  - Its prerequisite `dieline_templates` table is absent.
- `20260213160618_create_packaging_tables.sql`
  - Packaging tables, indexes, policies, and trigger are absent.
- `20260213160619_seed_packaging_templates.sql`
  - Its prerequisite packaging table is absent.
- `20260422030000_pipeline_master_reference.sql`
  - `is_master_reference` and its unique index are absent.
- `20260423140000_paper_doll_pipeline.sql`
  - Its prerequisite rename source and final paper-doll columns/indexes are absent.
- `20260516024622_optimize_generated_images_library_lookup.sql`
  - Both intended partial performance indexes are absent.
- `20260622041500_sanity_connections_and_destinations.sql`
  - All four Sanity tables and their supporting schema are absent.

## Data or Storage effects not provable from the schema-only snapshot

These files were also not marked applied. Their row-level or Storage effects
would require separate live evidence and product intent before any future use:

- `20260123000001_librarian_seed_data.sql`
- `20260123000002_librarian_image_frameworks.sql`
- `20260213000001_press_storage_buckets.sql`
- `20260304000000_dam_assets_bucket_public.sql`
- `20260620120000_tag_legacy_bestbottles_images.sql`

## Active migration following this archive

The candidate migration intentionally left active is:

`supabase/migrations/20260710090000_best_bottles_image_reconciliation.sql`

Before production application it must remain the only pending migration in
`supabase db push --dry-run`, must pass the isolated lifecycle fixture, and must
be backed by a current physical backup plus a schema-only pre-migration dump.
