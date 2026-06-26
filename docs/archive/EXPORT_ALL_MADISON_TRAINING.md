# Export ALL Madison Training Data - Simple Guide

## What You Need to Export

Madison's training comes from **2 places**:
1. **Database** (2 tables)
2. **Files** (markdown files in your project)

---

## PART 1: Export from Database

### Step 1: Export `madison_system_config`

1. Go to: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/sql/new

2. Paste this query:
   ```sql
   SELECT * FROM madison_system_config;
   ```

3. Click **"Run"**

4. Click **"Copy"** button (copies JSON to clipboard)

5. Create file: `madison_system_config_export.json`
   - Paste the copied JSON
   - Save

---

### Step 2: Export `madison_training_documents`

1. In SQL Editor, paste this query:
   ```sql
   SELECT * FROM madison_training_documents WHERE processing_status = 'completed';
   ```

2. Click **"Run"**

3. Click **"Copy"** button

4. Create file: `madison_training_documents_export.json`
   - Paste the copied JSON
   - Save

---

## PART 2: Copy Files from Project

These files are already in your project - just copy them:

### Author Profiles (8 files)
Copy these files:
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

### Brand Authorities (3 files)
Copy these files:
```
prompts/brand-authorities/wheeler.md
prompts/brand-authorities/neumeier.md
prompts/brand-authorities/clow.md
```

### Core Training Files
Copy these files:
```
prompts/madison_core_v1.md
prompts/madison_hybrid_engine.md
prompts/madison_style_matrix.md
src/knowledge/madison-visual-direction.md
```

---

## Complete Checklist

### Database Exports:
- [ ] `madison_system_config_export.json` (from SQL Editor)
- [ ] `madison_training_documents_export.json` (from SQL Editor)

### Author Profiles (8 files):
- [ ] `halbert.md`
- [ ] `ogilvy.md`
- [ ] `hopkins.md`
- [ ] `schwartz.md`
- [ ] `collier.md`
- [ ] `peterman.md`
- [ ] `joyner.md`
- [ ] `caples.md`

### Brand Authorities (3 files):
- [ ] `wheeler.md`
- [ ] `neumeier.md`
- [ ] `clow.md`

### Core Training (4 files):
- [ ] `madison_core_v1.md`
- [ ] `madison_hybrid_engine.md`
- [ ] `madison_style_matrix.md`
- [ ] `madison-visual-direction.md`

---

## That's It!

**Total:** 2 JSON files + 15 markdown files = **17 files total**

All of Madison's training data is in these files.

---

## Quick Reference

**SQL Editor:** https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/sql/new

**Queries:**
- System Config: `SELECT * FROM madison_system_config;`
- Training Docs: `SELECT * FROM madison_training_documents WHERE processing_status = 'completed';`

**File Locations:**
- Authors: `prompts/authors/`
- Brand Authorities: `prompts/brand-authorities/`
- Core Training: `prompts/` and `src/knowledge/`




