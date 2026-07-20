-- Add e-commerce fields to brand_products for marketplace sync
-- This enables full Shopify/Etsy product data sync including SKU, pricing, variants, images

-- SKU and basic pricing
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10,2);
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS cost_per_item DECIMAL(10,2);

-- Inventory
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS inventory_quantity INTEGER DEFAULT 0;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS inventory_policy TEXT DEFAULT 'deny'; -- deny or continue (overselling)
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT true;

-- Physical dimensions
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS weight DECIMAL(10,2);
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'lb'; -- lb, kg, g, oz
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT true;

-- Variants (JSONB array for multiple variants)
-- Each variant: { id, title, sku, price, compare_at_price, inventory_quantity, option1, option2, option3, barcode, weight, shopify_variant_id, etsy_variation_id }
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- Product options (e.g., Size, Color, Scent)
-- Format: [{ name: "Size", values: ["50ml", "100ml"] }, { name: "Color", values: ["Gold", "Black"] }]
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;

-- Images (JSONB array)
-- Format: [{ id, src, position, alt, width, height, shopify_image_id }]
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS featured_image_url TEXT;

-- Vendor/brand info
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS brand TEXT;

-- SEO
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- Status
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'; -- active, draft, archived
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Etsy-specific fields
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS etsy_listing_id TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS etsy_shop_id TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS etsy_state TEXT; -- draft, active, sold_out, inactive, expired
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS etsy_sync_status TEXT; -- synced, pending, error
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS last_etsy_sync TIMESTAMPTZ;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS etsy_taxonomy_id INTEGER;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS etsy_who_made TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS etsy_when_made TEXT;
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS etsy_is_supply BOOLEAN;

-- Tags for marketplace
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS materials TEXT[];

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_brand_products_sku ON brand_products(sku);
CREATE INDEX IF NOT EXISTS idx_brand_products_shopify_id ON brand_products(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_brand_products_etsy_id ON brand_products(etsy_listing_id);
CREATE INDEX IF NOT EXISTS idx_brand_products_status ON brand_products(status);
CREATE INDEX IF NOT EXISTS idx_brand_products_vendor ON brand_products(vendor);

-- Add comment for documentation
COMMENT ON COLUMN brand_products.variants IS 'JSONB array of product variants with SKU, price, inventory per variant';
COMMENT ON COLUMN brand_products.options IS 'Product options like Size, Color with available values';
COMMENT ON COLUMN brand_products.images IS 'JSONB array of product images with URLs and metadata';
