-- Add variants JSONB field to product_hubs for storing variant data
-- This enables variant-level SKU storage (like Shopify sync does)

ALTER TABLE public.product_hubs
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.product_hubs
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.product_hubs.variants IS 'JSONB array of product variants with SKU, price, inventory per variant. Format: [{ id, title, sku, price, compare_at_price, inventory_quantity, option1, option2, option3, barcode, weight, position }]';
COMMENT ON COLUMN public.product_hubs.options IS 'JSONB array of product options (Size, Color, etc.). Format: [{ name: "Size", values: ["6ml", "12ml"], position: 1 }]';
