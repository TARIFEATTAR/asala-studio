# Integrating Madison Data into Emergent

## ✅ What You Have

You've exported:
- ✅ `madison_system_config_export.json` - Core training data
- ⏳ `madison_training_documents_export.json` - Training documents (still need to export)

## 📋 How to Use in Emergent

### Step 1: Extract the Config Object

Your JSON is an array with one object. Extract just the object:

```json
{
  "id": "4abb398e-31cc-435f-a064-f05ff0f0940b",
  "persona": "Madison is a highly skilled editorial director...",
  "editorial_philosophy": "Madison believes in authenticity...",
  "writing_influences": "Inspired by literary storytelling...",
  "forbidden_phrases": "Avoid clichés like...",
  "quality_standards": "Every piece should be authentic...",
  "voice_spectrum": "Madison can adapt from poetic...",
  "updated_at": "2025-11-03 20:05:59.103574+00",
  "updated_by": null,
  "created_at": "2025-11-03 20:05:59.103574+00"
}
```

### Step 2: Use in Your Agent Initialization

**Option A: Direct JSON Import**
```javascript
// In your Emergent agent code
import madisonConfig from './madison_system_config_export.json';

const config = madisonConfig[0]; // Get first (and only) object

const systemPrompt = `
${config.persona}

${config.editorial_philosophy}

${config.writing_influences}

${config.voice_spectrum}

FORBIDDEN PHRASES: ${config.forbidden_phrases}

QUALITY STANDARDS: ${config.quality_standards}
`;
```

**Option B: Hardcode the Values**
```javascript
const madisonConfig = {
  persona: "Madison is a highly skilled editorial director...",
  editorial_philosophy: "Madison believes in authenticity...",
  writing_influences: "Inspired by literary storytelling...",
  forbidden_phrases: "Avoid clichés like...",
  quality_standards: "Every piece should be authentic...",
  voice_spectrum: "Madison can adapt from poetic..."
};
```

### Step 3: Build Complete System Prompt

Your complete Madison agent needs:

1. **System Config** (what you just exported) ✅
2. **Author Profiles** (from codebase files) - See below
3. **Brand Authorities** (from codebase files) - See below
4. **Training Documents** (export from database) ⏳

---

## 📁 Files You Need to Copy to Emergent

### Already Have:
- ✅ `madison_system_config_export.json`

### Still Need:
- ⏳ `madison_training_documents_export.json` (export from database)
- 📄 Author profiles from `prompts/authors/*.md` (8 files)
- 📄 Brand authorities from `prompts/brand-authorities/*.md` (3 files)

### Copy These Files:

**Author Profiles:**
```
prompts/authors/halbert.md
prompts/authors/ogilvy.md
prompts/authors/hopkins.md
prompts/authors/schwartz.md
prompts/authors/collier.md
prompts/authors/peterman.md
prompts/authors/joyner.md
prompts/authors/caples.md
```

**Brand Authorities:**
```
prompts/brand-authorities/wheeler.md
prompts/brand-authorities/neumeier.md
prompts/brand-authorities/clow.md
```

**Core Training:**
```
prompts/madison_core_v1.md
src/knowledge/madison-visual-direction.md
```

---

## 🔧 Complete Integration Example

```javascript
// madison-agent.js (for Emergent)

// 1. Load system config
const systemConfig = require('./madison_system_config_export.json')[0];

// 2. Load author profiles (from markdown files)
const authorProfiles = {
  halbert: require('fs').readFileSync('./prompts/authors/halbert.md', 'utf8'),
  ogilvy: require('fs').readFileSync('./prompts/authors/ogilvy.md', 'utf8'),
  // ... etc
};

// 3. Load brand authorities
const brandAuthorities = {
  wheeler: require('fs').readFileSync('./prompts/brand-authorities/wheeler.md', 'utf8'),
  neumeier: require('fs').readFileSync('./prompts/brand-authorities/neumeier.md', 'utf8'),
  clow: require('fs').readFileSync('./prompts/brand-authorities/clow.md', 'utf8'),
};

// 4. Build complete system prompt
function buildMadisonSystemPrompt() {
  return `
${systemConfig.persona}

${systemConfig.editorial_philosophy}

${systemConfig.writing_influences}

${systemConfig.voice_spectrum}

FORBIDDEN PHRASES: ${systemConfig.forbidden_phrases}

QUALITY STANDARDS: ${systemConfig.quality_standards}

${buildAuthorProfilesSection(authorProfiles)}

${buildBrandAuthoritiesSection(brandAuthorities)}
  `;
}
```

---

## ✅ Quick Checklist

- [x] Exported `madison_system_config_export.json`
- [ ] Export `madison_training_documents_export.json`
- [ ] Copy all author profile `.md` files
- [ ] Copy all brand authority `.md` files
- [ ] Copy core training documents
- [ ] Integrate into Emergent agent initialization
- [ ] Test agent with sample prompts

---

## 💡 Important Notes

1. **The JSON array:** Your export is an array `[{...}]` - extract the first object `[0]` when using it

2. **Training Documents:** Still need to export `madison_training_documents` table - these contain additional training content

3. **Author Profiles:** These are in markdown files, not the database - copy the `.md` files directly

4. **Complete Package:** See `MADISON_AGENT_DEPLOYMENT_PACKAGE.md` for full file list

---

**Yes, you can paste this directly into Emergent!** Just extract the object from the array and use the fields to build your system prompt.




