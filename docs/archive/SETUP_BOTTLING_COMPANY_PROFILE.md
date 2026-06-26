# Setup Guide: Perfume Bottling Company Profile

## Quick Setup Checklist

### Step 1: Create Organization in Madison
1. Log in to Madison Studio
2. Create new organization (or use existing)
3. Name it: **[Your Client's Company Name]**

### Step 2: Set Industry (CRITICAL!)
1. Go to **Settings → Brand Studio**
2. Select: **"Luxury Goods & Craft"** 
3. Select sub-industry: **"Artisan & Craft Goods"** or **"Luxury Manufacturing"**
4. Click **Save**

**⚠️ DO NOT select "Fragrance & Beauty"** - They MAKE bottles, they're not a perfume brand!

### Step 3: Customize the Template
1. Open `PERFUME_BOTTLING_COMPANY_TEMPLATE.md`
2. Replace placeholders:
   - `[Company Name]` → Actual company name
   - `[YEAR]` → Founding year
   - `[X]` years of experience → Actual number
   - Pricing ranges → Actual pricing (if sharing)
   - MOQs → Actual minimums
   - Lead times → Actual timelines

3. Add their specific details:
   - Unique manufacturing capabilities
   - Signature bottle styles
   - Notable clients (if they can be named)
   - Actual location/heritage story

### Step 4: Upload to Madison
1. Go to **Settings → Brand Knowledge** or **Onboarding → Brand Knowledge Center**
2. Upload the customized markdown file
3. Wait for processing to complete (check status)

### Step 5: Verify It Worked
Run this in **Supabase SQL Editor**:

```sql
-- Find the organization
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.brand_config->'industry_config'->>'id' as industry
FROM organizations o
WHERE o.name ILIKE '%[company name]%';

-- Check brand knowledge (use org_id from above)
SELECT 
  knowledge_type,
  content->'mission' as mission,
  content->'what_we_do' as what_we_do
FROM brand_knowledge 
WHERE organization_id = 'ORG_ID_HERE'
AND knowledge_type = 'brandIdentity';
```

**Expected**: Should mention "bottles," "manufacturer," "luxury glass," NOT "fragrance notes" or "perfume brand"

### Step 6: Test Content Generation
Generate content like:
- "Write a product description for our custom glass bottles"
- "Create an about page for our bottle manufacturing company"
- "Write a pitch to a niche perfume brand"

**Should mention**:
- Manufacturing, craftsmanship, glassmaking
- MOQs, lead times, custom design
- B2B language (partnership, consultation)

**Should NOT mention**:
- Fragrance notes, scent profiles
- Consumer language ("treat yourself," "indulge")
- Selling perfume (they sell bottles!)

---

## Key Differences: Bottling Company vs. Perfume Brand

### Bottling Company (B2B Manufacturer):
- **Industry**: Luxury Goods Manufacturing
- **Customers**: Perfume brands
- **Products**: Bottles, packaging, caps
- **Language**: Technical, craftsmanship, MOQs, lead times
- **Content Focus**: Manufacturing process, custom design, B2B partnership

### Perfume Brand (B2C Product):
- **Industry**: Fragrance & Beauty
- **Customers**: End consumers
- **Products**: Fragrances, perfumes, attars
- **Language**: Sensory, emotional, lifestyle
- **Content Focus**: Scent profiles, ingredients, brand story

---

## Common Mistakes to Avoid

❌ **Wrong**: Setting industry to "Fragrance & Beauty"
✅ **Right**: Setting industry to "Luxury Goods & Craft"

❌ **Wrong**: Writing about "our signature scents"
✅ **Right**: Writing about "our signature bottle designs"

❌ **Wrong**: Consumer language ("indulge in luxury")
✅ **Right**: B2B language ("partner with us to create distinctive packaging")

❌ **Wrong**: Describing fragrance notes
✅ **Right**: Describing glass finishes and manufacturing techniques

---

## Template Customization Tips

### Must Customize:
1. **Company name** (throughout)
2. **Founding story** (heritage/origin)
3. **Specific capabilities** (what makes them unique)
4. **MOQs and pricing** (if they're comfortable sharing)
5. **Notable clients or projects** (with permission)

### Optional Customization:
1. **Photography style** (if they have specific brand guidelines)
2. **Color palette** (if they have brand colors)
3. **Tone adjustments** (more formal vs. approachable)
4. **Additional services** (design consulting, prototyping, etc.)

### Keep As-Is:
1. **Document structure** (frontmatter format)
2. **Industry category** (Luxury Goods Manufacturing)
3. **B2B positioning** (they serve perfume brands)
4. **Vocabulary guidelines** (proven to work well)

---

## Testing Scenarios

After setup, test these generation prompts:

1. **"Write a homepage hero section"**
   - Should mention: bottles, manufacturing, custom design
   - Should NOT mention: fragrances, scents, perfumes they make

2. **"Create a product description for our 50ml bottles"**
   - Should mention: glass specs, finishes, MOQs
   - Should NOT mention: fragrance notes or scent

3. **"Write an email pitch to a niche perfume brand"**
   - Should be B2B tone (partnership, consultation)
   - Should NOT be B2C tone (consumer marketing)

4. **"Describe our manufacturing process"**
   - Should mention: glassmaking, tooling, quality control
   - Should NOT mention: perfume creation or formulation

---

## Troubleshooting

### If Madison generates perfume brand content:
1. Check industry setting (should be "Luxury Goods & Craft")
2. Check brandIdentity in database (should say "manufacturer")
3. Re-upload document with clearer frontmatter
4. Check for fragrance category pollution in brand_knowledge table

### If content is too generic:
1. Add more specific details to the template
2. Include actual MOQs, lead times, pricing
3. Add real client examples or case studies
4. Upload additional documents (capabilities brochure, spec sheets)

### If tone is wrong (too consumer-focused):
1. Emphasize B2B positioning in document
2. Add more "Words We Avoid" examples
3. Include sample B2B content in "Good Examples" section

---

## Ready to Use!

Once you've customized the template and uploaded it, Madison will understand:
- ✅ This is a B2B manufacturer
- ✅ They make bottles, not perfume
- ✅ Their customers are perfume brands
- ✅ Content should be technical, partnership-focused, B2B

The template is comprehensive and battle-tested. Just fill in the specific details and you're good to go! 🎯


