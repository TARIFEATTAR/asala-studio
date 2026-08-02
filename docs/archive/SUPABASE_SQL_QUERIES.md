# Ready-to-Paste SQL Queries for Supabase

Copy and paste these queries directly into Supabase SQL Editor.

---

## Query 1: Export `madison_system_config`

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

**How to use:**
1. Go to: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/sql/new
2. Paste the query above
3. Click "Run" (or press Cmd+Enter)
4. Click the "Copy" button in results
5. Save as JSON file

---

## Query 2: Export `madison_training_documents` (Completed Only)

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

**How to use:**
1. In SQL Editor, paste the query above
2. Click "Run"
3. Click "Copy" button in results
4. Save as JSON file

---

## Query 3: Export ALL `madison_training_documents` (No Filter)

If you want all documents regardless of status:

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
ORDER BY created_at DESC;
```

---

## Query 4: Check What Data Exists (Verification)

Run this first to see what you have:

```sql
-- Check system config
SELECT 
  COUNT(*) as total_records,
  LENGTH(persona) as persona_length,
  LENGTH(editorial_philosophy) as philosophy_length,
  LENGTH(forbidden_phrases) as forbidden_length
FROM madison_system_config;

-- Check training documents
SELECT 
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE processing_status = 'completed') as completed_docs,
  COUNT(*) FILTER (WHERE processing_status = 'pending') as pending_docs,
  COUNT(*) FILTER (WHERE category = 'writing_style') as writing_style_docs,
  COUNT(*) FILTER (WHERE category = 'visual_identity') as visual_identity_docs
FROM madison_training_documents;
```

---

## Quick Copy Instructions

### For `madison_system_config`:

1. **Copy this query:**
```sql
SELECT * FROM madison_system_config;
```

2. **Paste into SQL Editor**
3. **Run it**
4. **Copy the JSON results**
5. **Save as:** `madison_system_config_export.json`

### For `madison_training_documents`:

1. **Copy this query:**
```sql
SELECT * FROM madison_training_documents WHERE processing_status = 'completed';
```

2. **Paste into SQL Editor**
3. **Run it**
4. **Copy the JSON results**
5. **Save as:** `madison_training_documents_export.json`

---

## Simplest Queries (All Columns)

If you want everything, use these:

```sql
-- System Config (all columns)
SELECT * FROM madison_system_config;

-- Training Documents (completed only)
SELECT * FROM madison_training_documents WHERE processing_status = 'completed';
```

---

## Notes

- The `*` selects all columns - this is fine for export
- The `WHERE processing_status = 'completed'` filter ensures you only get processed documents
- Results will be in JSON format when you copy
- You can remove the `WHERE` clause if you want all documents

---

**That's it!** Just copy, paste, run, and copy the results.




