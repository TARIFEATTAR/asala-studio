# Quick Export Instructions - Copy JSON Method

Since Supabase SQL Editor only allows copying (not downloading), here's the fastest way:

## Method 1: Manual Copy & Save (Simplest) ✅

1. **In SQL Editor, run your query:**
   ```sql
   SELECT * FROM madison_system_config;
   ```

2. **Copy the JSON:**
   - Click the "Copy" button in the results
   - Or select all (Cmd+A) and copy (Cmd+C)

3. **Create and save the file:**
   - In your project, create: `madison_system_config_export.json`
   - Paste the copied JSON
   - Save the file

4. **Repeat for training documents:**
   ```sql
   SELECT * FROM madison_training_documents 
   WHERE processing_status = 'completed';
   ```
   - Copy and save as: `madison_training_documents_export.json`

---

## Method 2: Use Helper Script

### Option A: Node.js Script

1. **Copy JSON from Supabase**

2. **Run the script:**
   ```bash
   node save-json-export.js madison_system_config_export.json
   ```

3. **Paste the JSON** (press Enter, paste, then type "END" and press Enter)

4. **Script will format and save it**

### Option B: Bash Script

1. **Copy JSON from Supabase**

2. **Run:**
   ```bash
   ./save-json-export.sh madison_system_config_export.json
   ```

3. **Paste the JSON** (then press Ctrl+D)

---

## Method 3: Quick Terminal Command

If you have `pbpaste` (Mac) or `xclip` (Linux):

```bash
# Mac
pbpaste > madison_system_config_export.json

# Then format it (if you have jq installed)
jq . madison_system_config_export.json > temp.json && mv temp.json madison_system_config_export.json
```

---

## What the JSON Should Look Like

After copying, your JSON should look like this:

```json
[
  {
    "id": "4abb398e-31cc-435f-a064-f05ff0f0940b",
    "persona": "Madison is a highly skilled editorial director...",
    "editorial_philosophy": "Madison believes in authenticity...",
    "writing_influences": "Inspired by literary storytelling...",
    "forbidden_phrases": "Avoid clichés like...",
    "quality_standards": "Every headline must...",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

## Quick Checklist

- [ ] Run query in SQL Editor
- [ ] Copy the JSON results
- [ ] Create `.json` file in your project
- [ ] Paste and save
- [ ] Verify JSON is valid (should be an array of objects)
- [ ] Repeat for second table

---

**That's it!** The copied JSON is the same data you'd get from a download - just paste it into a file and you're done.




