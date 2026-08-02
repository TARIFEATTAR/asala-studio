# Simple SQL Export Instructions

## Step-by-Step: Export Data from Supabase SQL Editor

---

## Export `madison_system_config`

### Step 1: Open SQL Editor
- Go to: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/sql/new
- Or: Dashboard → SQL Editor → New Query

### Step 2: Paste This Query
```sql
SELECT * FROM madison_system_config;
```

### Step 3: Run Query
- Click the **"Run"** button (or press Cmd+Enter)

### Step 4: Copy Results
- Click the **"Copy"** button in the results area
- This copies the JSON to your clipboard

### Step 5: Save File
- Create new file: `madison_system_config_export.json`
- Paste the copied JSON
- Save

**Done!** ✅

---

## Export `madison_training_documents`

### Step 1: In SQL Editor, Paste This Query
```sql
SELECT * FROM madison_training_documents WHERE processing_status = 'completed';
```

### Step 2: Run Query
- Click **"Run"**

### Step 3: Copy Results
- Click **"Copy"** button

### Step 4: Save File
- Create new file: `madison_training_documents_export.json`
- Paste the copied JSON
- Save

**Done!** ✅

---

## That's It!

1. Paste query
2. Run
3. Copy
4. Save as .json file

No downloads needed - just copy and paste into a file!




