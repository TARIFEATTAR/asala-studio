# Asala Brand Knowledge Debug Guide

## Problem
Madison is generating generic "beauty and wellness" content for Asala (an AI creative agency), completely ignoring the uploaded brand documentation.

---

## Root Causes Found

### 1. **brandIdentity Not Being Saved** ❌
- `extract-brand-knowledge` extracts `brandIdentity` (mission, values, target audience)
- `process-brand-document` was **NOT saving** it to the database
- Result: Madison has no brand identity data

### 2. **Old Fragrance Categories Still Being Saved** ❌
- Even though we removed fragrance categories from extraction
- `process-brand-document` was still saving `category_personal_fragrance`, `category_home_fragrance`, `category_skincare`
- Result: Madison might be reading old fragrance data

### 3. **Multiple Duplicate Documents** ⚠️
- 3 copies of `ASALA_BRAND_BRAIN_COMPLETE.md` in database
- May have been uploaded multiple times during testing
- Only the latest should be active

---

## Fixes Applied

### Fix #1: Save brandIdentity to Database
**File**: `supabase/functions/process-brand-document/index.ts`

**Before**:
```typescript
// brandIdentity was extracted but NOT saved ❌
```

**After**:
```typescript
// CRITICAL: Save brandIdentity
if (extractionData.brandIdentity) {
  knowledgeInserts.push({
    organization_id: document.organization_id,
    document_id: documentId,
    knowledge_type: 'brandIdentity', // ✅ Now saved
    content: extractionData.brandIdentity,
    is_active: true,
    version: 1
  });
}
```

### Fix #2: Remove Old Fragrance Categories
**File**: `supabase/functions/process-brand-document/index.ts`

**Before**:
```typescript
// Save category-specific knowledge
if (extractionData.categories) {
  if (extractionData.categories.personal_fragrance?.detected) {
    // Save fragrance data ❌
  }
}
```

**After**:
```typescript
// REMOVED: Old fragrance-specific categories
// These were causing Madison to misinterpret brands
```

---

## Step-by-Step Debugging

### Step 1: Check What's in the Database

Run this in **Supabase SQL Editor**:

```sql
-- 1. Find organization ID (use the one from your screenshot)
SELECT id, name, brand_config 
FROM organizations 
WHERE id = '6efb188c-a5c9-4047-b77a-4267b04';

-- 2. Check what brand knowledge exists
SELECT 
  knowledge_type,
  is_active,
  created_at,
  jsonb_pretty(content::jsonb) as content
FROM brand_knowledge 
WHERE organization_id = '6efb188c-a5c9-4047-b77a-4267b04'
ORDER BY created_at DESC;

-- 3. Check if brandIdentity exists
SELECT COUNT(*) as brandIdentity_count
FROM brand_knowledge 
WHERE organization_id = '6efb188c-a5c9-4047-b77a-4267b04'
AND knowledge_type = 'brandIdentity';
-- Should be > 0 after reprocessing

-- 4. Check for old fragrance categories
SELECT knowledge_type, COUNT(*) 
FROM brand_knowledge 
WHERE organization_id = '6efb188c-a5c9-4047-b77a-4267b04'
AND knowledge_type LIKE 'category_%'
GROUP BY knowledge_type;
-- Should be 0 (or delete these)
```

### Step 2: Clean Up Old Data

```sql
-- Delete old fragrance categories
DELETE FROM brand_knowledge 
WHERE organization_id = '6efb188c-a5c9-4047-b77a-4267b04'
AND knowledge_type IN (
  'category_personal_fragrance',
  'category_home_fragrance',
  'category_skincare'
);

-- Delete duplicate documents (keep only the latest)
DELETE FROM brand_documents 
WHERE id IN (
  SELECT id 
  FROM brand_documents 
  WHERE organization_id = '6efb188c-a5c9-4047-b77a-4267b04'
  AND file_name = 'ASALA_BRAND_BRAIN_COMPLETE.md'
  ORDER BY created_at DESC
  OFFSET 1  -- Keep the newest, delete the rest
);
```

### Step 3: Deploy Fixed Edge Function

```bash
cd "/Users/jordanrichter/Projects/Madison Studio/madison-app"
supabase functions deploy process-brand-document
```

### Step 4: Reprocess the Document

**Option A: Via UI**
1. Go to Settings → Brand Knowledge
2. Find `ASALA_BRAND_BRAIN_COMPLETE.md`
3. Click "Reprocess" or "Delete and Re-upload"

**Option B: Via SQL**
```sql
-- Trigger reprocessing
UPDATE brand_documents 
SET processing_status = 'pending'
WHERE organization_id = '6efb188c-a5c9-4047-b77a-4267b04'
AND file_name = 'ASALA_BRAND_BRAIN_COMPLETE.md'
AND id = (
  SELECT id 
  FROM brand_documents 
  WHERE organization_id = '6efb188c-a5c9-4047-b77a-4267b04'
  AND file_name = 'ASALA_BRAND_BRAIN_COMPLETE.md'
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Then manually trigger the function
-- (You'll need to call the Edge Function with the document ID)
```

### Step 5: Verify brandIdentity Was Saved

```sql
-- Check if brandIdentity exists now
SELECT 
  knowledge_type,
  content->'mission' as mission,
  content->'values' as values,
  content->'targetAudience' as target_audience,
  content->'uniquePositioning' as positioning
FROM brand_knowledge 
WHERE organization_id = '6efb188c-a5c9-4047-b77a-4267b04'
AND knowledge_type = 'brandIdentity';
```

**Expected Result:**
- Mission should mention AI/creative agency
- Values should be relevant to Asala
- Target audience should NOT be "beauty consumers"

### Step 6: Test Content Generation

1. Go to Madison Editor or Dark Room
2. Generate content: "Write an about page for Asala"
3. **Expected**: Should mention AI, creative agency, branding
4. **NOT Expected**: Should NOT mention beauty, wellness, fragrance

---

## Verification Checklist

- [ ] Deployed `process-brand-document` Edge Function
- [ ] Deleted old fragrance categories from `brand_knowledge`
- [ ] Deleted duplicate Asala documents
- [ ] Reprocessed the latest Asala document
- [ ] Verified `brandIdentity` exists in database
- [ ] Verified `brandIdentity` contains correct mission/values
- [ ] Tested content generation
- [ ] Generated content matches Asala's actual brand (AI agency, not beauty)

---

## If Still Not Working

### Check Console Logs

**Frontend (Browser DevTools)**:
```
[Assembler] Found X brand knowledge entries
[Assembler] Loaded Y master docs, Z writing examples, brand knowledge found, industry: expert-brands
```

**Backend (Supabase Edge Function Logs)**:
```
[CHECKPOINT] Extracting structured brand knowledge with AI...
Organization industry: expert-brands
Successfully extracted structured brand knowledge
✓ Saved X structured brand knowledge entries
```

### Check Assembler is Fetching Knowledge

Add this to your generation code temporarily:

```typescript
// In src/lib/agents/assembler.ts, after line 93
console.log('[DEBUG] Brand Knowledge:', JSON.stringify(brandKnowledge, null, 2));
```

This will show you exactly what Madison is receiving.

---

## Expected Database State (After Fix)

```sql
-- brand_knowledge entries for Asala:
knowledge_type          | count
------------------------|------
brand_voice             | 1
vocabulary              | 1
brandIdentity           | 1  ← CRITICAL (was missing)
writing_examples        | 1
structural_guidelines   | 1
category_personal_fragrance | 0  ← Should be 0 (removed)
category_home_fragrance     | 0  ← Should be 0 (removed)
category_skincare           | 0  ← Should be 0 (removed)
```

---

## Summary

**The Problem**: Madison was generating generic beauty content because:
1. `brandIdentity` (mission, values, positioning) was extracted but **never saved** to the database
2. Old fragrance categories were still being saved, polluting the brand knowledge
3. Madison had no idea what Asala actually does

**The Fix**:
1. ✅ Save `brandIdentity` to database
2. ✅ Remove old fragrance category saving
3. ✅ Reprocess documents with fixed function
4. ✅ Madison will now have correct brand identity data

**Next Steps**:
1. Deploy the fixed Edge Function
2. Clean up old data
3. Reprocess Asala documents
4. Verify `brandIdentity` is saved
5. Test generation - should now be accurate!
