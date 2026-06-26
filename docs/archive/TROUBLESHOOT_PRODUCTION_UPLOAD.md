# Troubleshooting Production Document Upload Failure

## The Problem
✅ Works on localhost
❌ Fails on production (main application)

## Most Likely Causes

### 1. Edge Function Not Deployed to Production
The `process-brand-document` function was deployed, but might need to be verified or redeployed.

### 2. Environment Variables Missing in Production
Production (Vercel) needs the same environment variables as localhost.

### 3. CORS Configuration
Production domain might need to be added to CORS allowed origins.

---

## Step-by-Step Fix

### Step 1: Verify Edge Function is Deployed

**Check Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/functions
2. Look for `process-brand-document` in the list
3. Check status: Should show "Active" or "Deployed"

**If it's missing or shows errors:**
```bash
# Redeploy the function
npx supabase functions deploy process-brand-document \
  --project-ref likkskifwsrvszxdvufw \
  --no-verify-jwt
```

---

### Step 2: Check Production Environment Variables

**In Vercel Dashboard:**
1. Go to: Your Project → Settings → Environment Variables
2. Verify these exist:
   - ✅ `VITE_SUPABASE_URL` = `https://likkskifwsrvszxdvufw.supabase.co`
   - ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` = (your anon key)

**Important:**
- Must be enabled for **Production** environment
- Must have `VITE_` prefix
- Values must match your Supabase project

**If missing:**
1. Click "Add New"
2. Add `VITE_SUPABASE_URL` with your Supabase URL
3. Add `VITE_SUPABASE_PUBLISHABLE_KEY` with your anon key
4. Enable for Production, Preview, and Development
5. **Redeploy** your application

---

### Step 3: Check Browser Console for Errors

**On your production site:**
1. Open browser console (F12)
2. Try uploading a document
3. Look for errors:
   - CORS errors?
   - Network errors?
   - Function not found errors?
   - Environment variable errors?

**Common errors:**

**"Failed to load resource" or CORS error:**
- Edge function CORS might need production domain
- Check function logs in Supabase Dashboard

**"process-brand-document function not found":**
- Function not deployed
- Wrong project reference

**"Missing environment variables":**
- Vercel env vars not set correctly
- Need to redeploy after adding vars

---

### Step 4: Check Function Logs

**In Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/functions/process-brand-document
2. Click "Logs" tab
3. Try uploading a document
4. Check for errors in logs

**Look for:**
- CORS errors
- Missing environment variables
- Database connection errors
- File download errors

---

### Step 5: Verify Production Domain

**Check if production domain is allowed:**
1. The function uses `Access-Control-Allow-Origin: '*'` (allows all)
2. But verify your production domain can reach Supabase

**Test from production:**
```javascript
// Run in browser console on production site
fetch('https://likkskifwsrvszxdvufw.supabase.co/functions/v1/process-brand-document', {
  method: 'OPTIONS',
  headers: {
    'Content-Type': 'application/json'
  }
}).then(r => console.log('CORS OK:', r.status))
```

---

## Quick Fix Checklist

- [ ] Edge function deployed to Supabase
- [ ] Environment variables set in Vercel (with `VITE_` prefix)
- [ ] Environment variables enabled for Production
- [ ] Application redeployed after adding env vars
- [ ] Checked browser console for specific errors
- [ ] Checked Supabase function logs
- [ ] Verified Supabase project ID matches

---

## Most Common Fix

**90% of the time, it's missing environment variables in Vercel:**

1. Go to Vercel → Settings → Environment Variables
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Enable for Production
4. Redeploy

---

## Still Not Working?

Share:
1. Browser console error message
2. Supabase function logs
3. Vercel deployment logs
4. What exactly happens when you try to upload













































