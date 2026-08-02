# Best Bottles - Complete Setup Guide
## Premium Bottle Supplier with "Muted Luxury" Aesthetic

---

## ✅ Setup Checklist

### Step 1: Create Organization
1. Log in to Madison Studio
2. Create new organization
3. Name it: **"Best Bottles"**

### Step 2: Set Industry (CRITICAL!)
1. Go to **Settings → Brand Studio**
2. Select: **"Luxury Goods & Craft"**
3. Select sub-industry: **"Artisan & Craft Goods"**
4. Click **Save**

**⚠️ DO NOT select "Fragrance & Beauty"** - Best Bottles SUPPLIES bottles to perfume brands, they're not a perfume company!

### Step 3: Upload Brand Brain
1. Go to **Settings → Brand Knowledge** or **Onboarding → Brand Knowledge Center**
2. Upload `BEST_BOTTLES_BRAND_BRAIN.md`
3. Wait for processing to complete (this may take 1-2 minutes)

### Step 4: Verify It Worked

Run this in **Supabase SQL Editor**:

```sql
-- Find Best Bottles organization
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.brand_config->'industry_config'->>'id' as industry,
  o.brand_config->'industry_config'->>'sub_industry' as sub_industry
FROM organizations o
WHERE o.name ILIKE '%best bottles%'
ORDER BY o.created_at DESC
LIMIT 1;

-- Check brand knowledge (use org_id from above)
SELECT 
  knowledge_type,
  content->'business_type' as business_type,
  content->'brand_essence' as brand_essence,
  content->'core_philosophy' as core_philosophy
FROM brand_knowledge 
WHERE organization_id = 'ORG_ID_FROM_ABOVE'
AND knowledge_type = 'brandIdentity';

-- Check for pollution (should return ZERO rows)
SELECT knowledge_type, created_at
FROM brand_knowledge
WHERE organization_id = 'ORG_ID_FROM_ABOVE'
AND knowledge_type IN (
  'category_personal_fragrance',
  'category_home_fragrance',
  'category_skincare'
);
```

**Expected Results:**

#### Query 1 (Organization):
- `industry`: `luxury-goods`
- `sub_industry`: `artisan-craft`

#### Query 2 (Brand Identity):
- `business_type`: "Premium Perfume Bottle Supplier & Design Partner"
- `brand_essence`: "Muted Luxury, Sustainability, Craftsmanship, Client-Centricity"
- `core_philosophy`: "The vessel is as vital as the scent it holds"

#### Query 3 (Pollution Check):
- **Should return ZERO rows** (no fragrance categories)

**🚨 Red Flags:**
- Industry is `fragrance-beauty` → Wrong industry selected
- business_type mentions "perfume brand" → Document processed incorrectly
- Query 3 returns rows → Old fragrance data polluting the knowledge base

---

### Step 5: Test Content Generation

Try these prompts in the Madison Editor:

#### Test 1: Homepage Hero Section
**Prompt:** "Write a homepage hero section for Best Bottles"

**✅ Should Include:**
- "Premium bottle supplier" or "luxury glass vessels"
- "Source" or "curate" (not "manufacture")
- "Fragrance brands" (as customers)
- "Flexible MOQs" or "accessible luxury"
- "Muted Luxury" aesthetic

**❌ Should NOT Include:**
- "We manufacture" or "our factory"
- "Our fragrances" or "scent profiles"
- "Indulge" or consumer language
- "Our glassmakers" or "we blow glass"

---

#### Test 2: Product Description
**Prompt:** "Create a product description for our 50ml premium glass bottle"

**✅ Should Include:**
- Technical specs (capacity, material, neck finish)
- MOQ information (100 units for stock, 500 for custom)
- Lead times (2-3 weeks stock, 8-10 weeks custom)
- Available finishes (clear, amber, frosted)
- Closure options (sprayer, cap, dropper)
- B2B tone ("Perfect for niche fragrance brands...")

**❌ Should NOT Include:**
- Fragrance notes or scent descriptions
- Consumer marketing language
- Manufacturing claims ("we mold," "we blow")

---

#### Test 3: Email Pitch
**Prompt:** "Write a B2B email pitch to a niche perfume brand founder about our bottle services"

**✅ Should Include:**
- Professional, warm tone (like "Grace")
- Mention flexible MOQs (100-500 vs. 50,000+)
- Offer design consultation
- Reference "sourcing" or "curated collection"
- Partnership language

**❌ Should NOT Include:**
- Casual language or slang
- Manufacturing claims
- Consumer-focused benefits

---

#### Test 4: Visual Content
**Prompt:** "Generate an image of our premium 50ml perfume bottle on a minimalist background"

**✅ Should Generate:**
- Photorealistic glass bottle
- Cinematic lighting with dramatic shadows
- Minimalist composition (concrete, marble, or linen background)
- Muted tones (warm off-white, charcoal, muted gold accents)
- Shallow depth of field
- Negative space

**❌ Should NOT Generate:**
- Bright, colorful backgrounds
- Cluttered compositions
- Pure white backgrounds
- Trendy or flashy styling

---

## 🎯 What Madison Should Understand

After successful setup, Madison should have complete knowledge of:

### ✅ Best Bottles IS:
- **A B2B supplier/reseller** (NOT a manufacturer)
- **Sources premium bottles** from global artisan glassmakers
- **Serves perfume brands** as customers (B2B, not B2C)
- **Offers 2,000+ SKUs** in stock catalog
- **Provides flexible MOQs**: 
  - 1-11 units (sampling)
  - 12-143 units (small batch)
  - 144+ units (production)
  - 500+ units (custom molds)
- **Positioned as "Muted Luxury"**: Sophisticated, understated, timeless
- **Has AI concierge "Grace"**: Knowledgeable, warm, professional persona

### ✅ Best Bottles SERVES:
- Niche perfume brands
- Luxury fragrance houses
- Artisan perfumers
- High-end beauty brands
- Private label fragrance companies
- Wellness & aromatherapy brands

### ✅ Visual Identity:
- **Color Palette:**
  - Off-Black/Charcoal (`#1D1D1F`)
  - Warm Off-White/Bone (`#F5F3EF`)
  - Muted Gold/Bronze (`#C5A065`) - sparingly
  - Slate Blue/Grey (`#637588`)
  - Warm Beige (`#EBE7DD`)
- **Typography:**
  - Headings: Serif (Playfair Display, Bodoni)
  - Body: Sans-serif (Inter, Roboto, Lato)
  - Uppercase with wide tracking for labels
- **Imagery:**
  - Cinematic lighting, dramatic shadows
  - Minimalist composition
  - Clean backgrounds (concrete, marble, linen)
  - Negative space crucial

### ✅ Content Should Be:
- **Tone:** "Muted Luxury" - sophisticated, warm, professional
- **Style:** B2B focused, partnership-oriented
- **Details:** Technical (MOQs, lead times, glass specs, stock availability)
- **Focus:** Service and curation (not manufacturing)
- **Sourcing:** Vague ("we work with," "through our network")
- **Pricing:** General tiers, never specific prices
- **Upselling:** Always suggest complementary products

### ❌ Best Bottles is NOT:
- A manufacturer (they source/supply through partners)
- A perfume brand or fragrance company
- Selling fragrances to end consumers
- Creating scent profiles or formulations
- Operating their own glass factory
- Making bottles themselves (except custom molds through partners)

---

## 🚨 Red Flags (If These Appear, Something's Wrong)

If Madison generates content that mentions:

### Manufacturing Claims (WRONG):
- ❌ "We manufacture bottles"
- ❌ "Our factory" or "our facility"
- ❌ "Our glassmakers" or "our master craftsmen"
- ❌ "We blow glass" or "we mold bottles"
- ❌ "Made in our facility"
- ❌ "Hand-crafted by our artisans"

### Fragrance Brand Language (WRONG):
- ❌ "Our signature fragrances"
- ❌ "Scent profiles" or "fragrance notes"
- ❌ "Our perfume collection"
- ❌ Sensory descriptions of fragrances
- ❌ "Indulge in luxury" (consumer language)
- ❌ B2C marketing tone

### Visual Mistakes (WRONG):
- ❌ Bright, colorful backgrounds
- ❌ Pure white (`#FFFFFF`) backgrounds
- ❌ Cluttered compositions
- ❌ Trendy or flashy styling
- ❌ No negative space

---

## 🔧 Troubleshooting

### Problem: Madison says "we manufacture" or "our factory"

**Diagnosis:**
- Brand brain processed incorrectly
- Old manufacturing language in `brand_knowledge`

**Fix:**
1. Check `brandIdentity` in database (Query 2 above)
2. Look for incorrect `business_type` or `what_we_do`
3. Delete all `brand_knowledge` entries for Best Bottles
4. Re-upload `BEST_BOTTLES_BRAND_BRAIN.md`

```sql
-- Delete all brand knowledge for Best Bottles
DELETE FROM brand_knowledge
WHERE organization_id = 'ORG_ID_HERE';

-- Then re-upload the document
```

---

### Problem: Madison talks about fragrances or scent profiles

**Diagnosis:**
- Industry set to "Fragrance & Beauty" instead of "Luxury Goods"
- Old fragrance categories in `brand_knowledge`

**Fix:**
1. Go to **Settings → Brand Studio**
2. Change industry to **"Luxury Goods & Craft"** → **"Artisan & Craft Goods"**
3. Run Query 3 (pollution check) - if it returns rows, delete them:

```sql
-- Delete fragrance pollution
DELETE FROM brand_knowledge
WHERE organization_id = 'ORG_ID_HERE'
AND knowledge_type IN (
  'category_personal_fragrance',
  'category_home_fragrance',
  'category_skincare'
);
```

---

### Problem: Tone is too casual or uses wrong colors

**Diagnosis:**
- Visual identity not extracted correctly
- Brand voice not in `brand_knowledge`

**Fix:**
1. Check for `brand_voice` entry:

```sql
SELECT content
FROM brand_knowledge
WHERE organization_id = 'ORG_ID_HERE'
AND knowledge_type = 'brand_voice';
```

2. If missing or incorrect, re-upload brand brain
3. In prompts, explicitly remind Madison: "Use the Muted Luxury aesthetic with warm off-white backgrounds and muted tones"

---

### Problem: Madison quotes specific prices

**Diagnosis:**
- Not following pricing rules from brand brain

**Fix:**
- In prompt, add: "Refer to bulk pricing tiers generally, don't quote specific prices"
- Check that brand brain has pricing philosophy section

---

## 📊 Expected Database State

After successful setup, your `brand_knowledge` table should contain:

```sql
-- Expected knowledge_type entries:
knowledge_type              | Should Contain
----------------------------|------------------
brandIdentity               | "supplier," "source," "B2B," "Muted Luxury"
brand_voice                 | "sophisticated," "warm," "professional," "Grace"
vocabulary                  | "MOQ," "lead time," "sourcing," "curated"
writing_examples            | B2B examples (email pitches, product descriptions)
structural_guidelines       | Professional, detailed, specific, technical
```

**Should NOT contain:**
- ❌ `category_personal_fragrance`
- ❌ `category_home_fragrance`
- ❌ `category_skincare`
- ❌ Any fragrance-specific categories

---

## 💡 Pro Tips

### 1. Use B2B-Focused Prompts
**Good:**
- "Write a capabilities brochure for Best Bottles"
- "Create a case study for a luxury perfume brand client"
- "Draft an email to a potential niche fragrance brand"
- "Write a product description for our 9ml roll-on bottles targeting artisan perfumers"

**Avoid:**
- "Write a product description" (too vague)
- "Create Instagram captions" (unless specifically B2B audience)
- "Write for customers" (ambiguous - customers are brands, not consumers)

### 2. Remind Madison of Aesthetic
If visual content doesn't match "Muted Luxury":
- Add to prompt: "Use cinematic lighting, minimalist composition, warm off-white background, muted tones"

### 3. Emphasize Sourcing, Not Manufacturing
If Madison slips into manufacturing language:
- Add to prompt: "Remember, Best Bottles sources bottles from global partners - we don't manufacture them ourselves"

### 4. Test with Edge Cases
Try prompts that might confuse Madison:
- "Describe our manufacturing process" → Should say "sourcing process" or "partner network"
- "Tell me about our fragrances" → Should clarify "we supply bottles TO fragrance brands"
- "What makes our perfumes special?" → Should redirect to "what makes our bottles special"

---

## 🎉 You're Ready!

Once you've completed the setup checklist and verified with the SQL queries, Best Bottles is ready to use!

### Madison Will Understand:
✅ Best Bottles is a premium bottle **supplier** (not manufacturer)  
✅ Content should be **B2B focused** (serving fragrance brands)  
✅ Sourcing should be **vague** ("we work with," "through our network")  
✅ Technical details **matter** (MOQs, lead times, specs, stock availability)  
✅ Tone should be **"Muted Luxury"** (sophisticated, warm, professional)  
✅ Visual content should use **specific color palette** and **cinematic lighting**  
✅ Never claim **manufacturing capabilities**  
✅ Always suggest **complementary products** (upselling)  
✅ Pricing should be **general tiers**, not specific quotes  

### Madison Will Avoid:
❌ Manufacturing claims ("we make," "our factory")  
❌ Fragrance brand language ("our perfumes," "scent profiles")  
❌ Consumer marketing tone ("indulge," "treat yourself")  
❌ Bright, cluttered visuals  
❌ Specific price quotes  

---

## 📞 Need Help?

If you encounter issues:

1. **Check industry setting** (should be "Luxury Goods & Craft")
2. **Run SQL verification queries** (see Step 4)
3. **Look for pollution** (fragrance categories in brand_knowledge)
4. **Re-upload brand brain** if needed
5. **Test with specific prompts** (see Test Content Generation section)

Test it out and let me know if you see any issues! 🚀


