# How to Export Madison Training Data from Supabase

## Quick Links

**Your Supabase Project:** `likkskifwsrvszxdvufw`  
**Dashboard URL:** https://supabase.com/dashboard/project/likkskifwsrvszxdvufw

---

## Method 1: SQL Editor (BEST for JSON) ✅ RECOMMENDED

### Step 1: Export `madison_system_config` as JSON

1. **Go to SQL Editor**
   - Direct link: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/sql/new
   - Or navigate: Dashboard → SQL Editor → New Query

2. **Run This Query:**
   ```sql
   SELECT 
     id,
     persona,
     editorial_philosophy,
     writing_influences,
     voice_spectrum,
     forbidden_phrases,
     quality_standards,
     created_at,
     updated_at
   FROM madison_system_config
   ORDER BY created_at DESC;
   ```

3. **Download as JSON**
   - After the query runs, look for the **Download** button (download icon) in the results area
   - Click it and select **JSON** format
   - Save as: `madison_system_config_export.json`

---

### Step 2: Export `madison_training_documents` as JSON

1. **In SQL Editor, Run This Query:**
   ```sql
   SELECT 
     id,
     file_name,
     extracted_content,
     category,
     processing_status,
     created_at,
     updated_at
   FROM madison_training_documents
   WHERE processing_status = 'completed'
   ORDER BY created_at DESC;
   ```

2. **Download as JSON**
   - Click the **Download** button
   - Select **JSON** format
   - Save as: `madison_training_documents_export.json`

**Why SQL Editor?** The Table Editor export only offers CSV/SQL/CLI, but SQL Editor results can be downloaded as JSON.

---

## Method 2: Table Editor (CSV Only) ⚠️

**Note:** Table Editor only offers CSV, SQL, or CLI - no JSON option directly.

### If You Must Use Table Editor:

1. **Export as CSV** (works fine for `madison_system_config`)
   - Click "..." → "Export table as CSV"
   - Save as: `madison_system_config_export.csv`
   - CSV works for smaller text fields

2. **For `madison_training_documents` (with long text):**
   - **Don't use CSV** - it may truncate long `extracted_content` fields
   - **Use SQL Editor method instead** (see Method 1 above)

**What You'll Get:**
- All rows from the table
- All columns including: `id`, `persona`, `editorial_philosophy`, `writing_influences`, `voice_spectrum`, `forbidden_phrases`, `quality_standards`, `created_at`, `updated_at`

---

### Step 2: Export `madison_training_documents` Table

1. **Go to Table Editor**
   - Direct link: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/editor

2. **Open the Table**
   - Find `madison_training_documents` in the table list
   - Click on it to open

3. **Filter for Completed Documents (Optional)**
   - Click the filter icon
   - Filter: `processing_status` = `completed`
   - This ensures you only export processed documents

4. **Export the Data**
   - Click the **"..."** menu (three dots) in the top right
   - Select **"Export"** or **"Download as CSV"**
   - Choose **JSON** format (recommended - CSV may truncate long text fields)

5. **Save the File**
   - Save as: `madison_training_documents_export.json`

**What You'll Get:**
- All training documents
- Columns: `id`, `file_name`, `extracted_content`, `category`, `processing_status`, `created_at`, `updated_at`, etc.

**Note:** The `extracted_content` field may be very long. JSON format handles this better than CSV.

---

## Method 3: Convert CSV to JSON (If You Already Exported CSV)

If you already exported as CSV and need JSON:

### Quick Conversion Options:

**Option A: Online Converter**
- Go to: https://www.convertcsv.com/csv-to-json.htm
- Upload your CSV file
- Download as JSON

**Option B: Using Node.js (if you have it installed)**
```bash
# Install csvtojson if needed
npm install -g csvtojson

# Convert
csvtojson madison_system_config_export.csv > madison_system_config_export.json
```

**Option C: Python Script**
```python
import csv
import json

with open('madison_system_config_export.csv', 'r') as f:
    reader = csv.DictReader(f)
    data = list(reader)

with open('madison_system_config_export.json', 'w') as f:
    json.dump(data, f, indent=2)
```

---

## Method 3: Supabase CLI (For Developers) 💻

If you have Supabase CLI installed:

```bash
# Export madison_system_config
npx supabase db dump --data-only --table madison_system_config -f madison_system_config_export.sql

# Export madison_training_documents
npx supabase db dump --data-only --table madison_training_documents -f madison_training_documents_export.sql
```

**Note:** This requires Supabase CLI to be linked to your project.

---

## What to Do With the Exported Files

### Option 1: Use Directly in Agent
- Include JSON files in your agent deployment package
- Load them programmatically when initializing the agent

### Option 2: Convert to Code
- Extract the values from JSON
- Hardcode into your agent's configuration
- Useful for static deployments

### Option 3: Store in Database
- Import into your new agent's database
- Maintain the same structure
- Allows for updates without code changes

---

## Verification Checklist

After exporting, verify you have:

- [ ] `madison_system_config_export.json` (or `.csv`)
  - [ ] Contains at least 1 row
  - [ ] Has `persona` field populated
  - [ ] Has `editorial_philosophy` field populated
  - [ ] Has `forbidden_phrases` field populated
  - [ ] Has `quality_standards` field populated

- [ ] `madison_training_documents_export.json` (or `.csv`)
  - [ ] Contains all completed documents
  - [ ] Has `extracted_content` field (may be long)
  - [ ] Has `file_name` field
  - [ ] Has `category` field

---

## Troubleshooting

### "Table not found" Error
- Make sure you're in the correct project: `likkskifwsrvszxdvufw`
- Check that you're logged in as the project owner/admin

### "No data" or Empty Export
- Check if the table has any rows
- Run: `SELECT COUNT(*) FROM madison_system_config;` in SQL Editor
- If count is 0, the table may need to be populated first

### "Export failed" or Timeout
- For large `extracted_content` fields, use JSON format (not CSV)
- Try exporting in smaller batches using SQL filters
- Use SQL Editor method instead of Table Editor export

### CSV Truncates Long Text
- Use JSON format instead
- Or export via SQL Editor with JSON output

---

## Quick SQL Queries to Check Data

### Check System Config:
```sql
SELECT 
  id,
  LENGTH(persona) as persona_length,
  LENGTH(editorial_philosophy) as philosophy_length,
  LENGTH(forbidden_phrases) as forbidden_length
FROM madison_system_config;
```

### Check Training Documents:
```sql
SELECT 
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE processing_status = 'completed') as completed_docs,
  COUNT(*) FILTER (WHERE category = 'writing_style') as writing_style_docs,
  COUNT(*) FILTER (WHERE category = 'visual_identity') as visual_identity_docs
FROM madison_training_documents;
```

---

## Recommended Export Format

**For Agent Deployment:**
- Use **JSON** format for both tables
- JSON handles long text fields better
- Easier to parse programmatically
- Maintains data structure

**File Names:**
- `madison_system_config_export.json`
- `madison_training_documents_export.json`

---

## Next Steps

After exporting:

1. ✅ Save files in a secure location
2. ✅ Add to your agent deployment package
3. ✅ Reference in `MADISON_AGENT_DEPLOYMENT_PACKAGE.md`
4. ✅ Test loading the data in your agent initialization

---

**Need Help?** If you encounter any issues, check:
- Supabase Dashboard: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw
- Supabase Docs: https://supabase.com/docs/guides/database

