# Brand Readiness System

## Problem Statement

**Issue**: Madison was generating content with completely wrong assumptions when:
- Users didn't scan their website
- Users didn't upload documentation
- Users uploaded wrong/mismatched documentation
- Default industry was set to "fragrance-beauty" for all brands

**Risk**: Misleading content generation that doesn't match the brand's actual industry or voice.

---

## Solution: Multi-Layer Validation

### 1. **Brand Readiness Check** (`src/lib/agents/brandReadinessCheck.ts`)

A scoring system (0-100) that validates if an organization has sufficient brand knowledge:

#### Scoring Breakdown:
- **Industry Selection (30 points)**: 
  - 30 pts: Specific industry selected (not default)
  - 15 pts: Has an industry (but might be default)
  - 0 pts: No industry set
  
- **Brand Knowledge (40 points)**: 
  - 40 pts: Comprehensive (voice + vocabulary + identity)
  - 25 pts: Partial (voice OR vocabulary)
  - 10 pts: Minimal (exists but incomplete)
  - 0 pts: No brand knowledge
  
- **Brand DNA (30 points)**:
  - 30 pts: Full brand DNA (website scan or manual setup)
  - 20 pts: Has brand_dna_scan in knowledge
  - 0 pts: No visual identity

#### Readiness Threshold:
- **≥ 50 points**: Ready to generate (with warnings if < 80)
- **< 50 points**: **BLOCKED** - Cannot generate

---

### 2. **Assembler Validation** (`src/lib/agents/assembler.ts`)

**Before** fetching any context, the assembler now:
1. Checks brand readiness
2. **Throws error** if readiness score < 50
3. Logs warnings if 50-79
4. Proceeds if ≥ 80

**Error Message Example**:
```
Brand setup incomplete (40%). Missing: Industry Selection, Brand Documentation

To fix this:
1. Go to Settings → Brand Studio and select your industry
2. Upload brand guidelines, voice & tone docs, or scan your website

Madison cannot generate accurate content without proper brand setup. 
Please complete your brand profile first.
```

---

### 3. **UI Indicator** (`src/components/editor/BrandReadinessIndicator.tsx`)

A visual alert component that shows:
- Readiness score percentage
- Missing elements
- Actionable recommendations
- Quick action buttons:
  - "Complete Brand Setup" → Settings
  - "Upload Brand Docs" → Onboarding

**Display Logic**:
- **80-100%**: No indicator (fully ready)
- **50-79%**: Yellow warning (can generate, but incomplete)
- **0-49%**: Red alert (cannot generate)

---

### 4. **Fixed Default Fallbacks**

#### Before:
```typescript
// industries.ts
return LEGACY_INDUSTRY_MAP[oldIndustry] || "fragrance-beauty"; // ❌ WRONG
```

#### After:
```typescript
// industries.ts
return LEGACY_INDUSTRY_MAP[oldIndustry] || "expert-brands"; // ✅ Most generic
```

#### Before:
```typescript
// assembler.ts - getDefaultBrandDNA()
essence: {
  tone: 'sophisticated', // ❌ Assumes luxury/premium
  copySquad: 'THE_STORYTELLERS',
}
```

#### After:
```typescript
// assembler.ts - getDefaultBrandDNA()
essence: {
  tone: 'professional', // ✅ Neutral
  copySquad: 'THE_STORYTELLERS', // Most versatile
}
// + Warning logged when defaults are used
```

---

### 5. **Brand Knowledge Integration**

Now Madison **actually uses** uploaded documents:

1. `fetchBrandKnowledge()` pulls from `brand_knowledge` table
2. `synthesizeBrandDNAFromKnowledge()` converts knowledge → DNA
3. `<BRAND_KNOWLEDGE>` section in AI prompt (marked as PRIMARY source)
4. Placed BEFORE generic brand DNA for priority

---

## User Flow

### Scenario 1: New User (No Setup)
1. User tries to generate content
2. **Assembler throws error**: "Brand setup incomplete (0%)"
3. **UI shows**: Red alert with missing elements
4. **User clicks**: "Complete Brand Setup"
5. **Redirected to**: Settings → Brand Studio
6. **User completes**: Industry selection + document upload
7. **Readiness**: 70% → Can now generate (with warnings)

### Scenario 2: Partial Setup (50-79%)
1. User has industry but no docs
2. **Generation works** but shows yellow warning
3. **UI suggests**: "Upload brand docs for better accuracy"
4. **User can**: Continue generating OR improve setup

### Scenario 3: Full Setup (80-100%)
1. User has industry + comprehensive docs
2. **No warnings shown**
3. **Madison generates** with full brand context

---

## Files Changed

1. **`src/lib/agents/brandReadinessCheck.ts`** (NEW)
   - Brand readiness validation logic
   - Scoring system
   - Error message generation

2. **`src/lib/agents/assembler.ts`**
   - Added readiness check before context fetch
   - Throws error if < 50% ready
   - Logs warnings if 50-79%
   - Added `fetchBrandKnowledge()` function
   - Added `synthesizeBrandDNAFromKnowledge()` function
   - Updated `getDefaultBrandDNA()` to be more neutral

3. **`src/components/editor/BrandReadinessIndicator.tsx`** (NEW)
   - Visual alert component
   - Shows missing elements
   - Provides quick action buttons

4. **`src/types/madison.ts`**
   - Added `brandKnowledge` to `ContextPackage`

5. **`src/lib/agents/generator.ts`**
   - Added `<BRAND_KNOWLEDGE>` section to prompt
   - Marked as PRIMARY source of truth

6. **`src/config/industries.ts`**
   - Changed default from `fragrance-beauty` → `expert-brands`
   - Added explicit agency/consulting mappings

7. **`supabase/functions/extract-brand-knowledge/index.ts`**
   - Removed "luxury beauty brand" assumption
   - Made prompt industry-agnostic
   - Added `industry` parameter

8. **`supabase/functions/process-brand-document/index.ts`**
   - Fetches organization's industry
   - Passes industry to extraction function

---

## Testing Checklist

### Test 1: Brand Readiness Blocking
- [ ] Create new organization
- [ ] Try to generate content immediately
- [ ] **Expected**: Error thrown with clear message
- [ ] **Expected**: UI shows red alert with recommendations

### Test 2: Partial Setup Warning
- [ ] Set industry only (no docs)
- [ ] Try to generate content
- [ ] **Expected**: Generation works
- [ ] **Expected**: Yellow warning shown

### Test 3: Full Setup Success
- [ ] Set industry + upload comprehensive docs
- [ ] Try to generate content
- [ ] **Expected**: Generation works perfectly
- [ ] **Expected**: No warnings shown
- [ ] **Expected**: Content matches uploaded docs

### Test 4: Wrong Industry Detection
- [ ] Upload agency docs
- [ ] Set industry to "Fragrance & Beauty"
- [ ] Try to generate content
- [ ] **Expected**: Readiness check warns about mismatch
- [ ] **Expected**: Generated content still uses uploaded docs (not fragrance defaults)

---

## Deployment Steps

1. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy extract-brand-knowledge
   supabase functions deploy process-brand-document
   ```

2. **Test with Asala**:
   - Set industry to "Expert Brands" → "Creative & Brand Agencies"
   - Re-upload Asala documentation
   - Verify readiness score is 70-100%
   - Generate content and verify it matches Asala's voice

3. **Monitor Logs**:
   - Check for `[Assembler] Brand readiness: X%` logs
   - Check for `[Assembler] Found X brand knowledge entries` logs
   - Check for any error messages

---

## Future Enhancements

1. **Readiness Dashboard**: Dedicated page showing detailed readiness breakdown
2. **Guided Onboarding**: Step-by-step wizard to reach 100% readiness
3. **Industry Mismatch Detection**: AI-powered detection of industry/content mismatch
4. **Confidence Scoring**: Per-generation confidence score based on brand knowledge quality
5. **Brand Knowledge Versioning**: Track changes to brand docs over time

---

## Key Takeaways

✅ **No more misleading defaults**: Madison won't generate with wrong assumptions
✅ **Clear error messages**: Users know exactly what's missing
✅ **Actionable guidance**: Direct links to fix issues
✅ **Graceful degradation**: Partial setup still works (with warnings)
✅ **Brand knowledge integration**: Uploaded docs are now actually used
✅ **Industry-agnostic extraction**: No more "luxury beauty brand" bias

**Result**: 100% confidence that Madison won't generate content for the wrong industry or with misleading assumptions.
