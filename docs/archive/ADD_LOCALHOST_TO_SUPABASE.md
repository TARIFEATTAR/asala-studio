# Add Localhost to Supabase Redirect URLs

## Why This Is Needed
When you click "Continue with Google" on localhost, Supabase checks if the redirect URL is allowed. If `localhost:8080` isn't in the allowed list, it redirects to the default (production site).

## Quick Fix (2 minutes)

### Step 1: Go to Supabase Dashboard
**URL:** https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/auth/url-configuration

### Step 2: Add Localhost Redirect URLs
In the **"Redirect URLs"** section, click **"Add URL"** and add these:

```
http://localhost:8080/**
http://127.0.0.1:8080/**
```

**Important:** Use the `/**` wildcard to allow all paths (like `/auth`, `/onboarding`, etc.)

### Step 3: Save
Click **"Save"** at the bottom of the page.

### Step 4: Test
1. Go to `http://localhost:8080/auth`
2. Click "Continue with Google"
3. Should now redirect to Google (not madisonstudio.io)
4. After Google auth, should come back to `localhost:8080/auth`

## What Should Be in Your Redirect URLs List

**For Production:**
```
https://app.madisonstudio.io/**
```

**For Local Development (add these):**
```
http://localhost:8080/**
http://127.0.0.1:8080/**
```

**Optional (for Vercel previews):**
```
https://madison-studio-cursor-*.vercel.app/**
```

## Troubleshooting

### Still redirecting to production?
1. Make sure you saved the changes in Supabase
2. Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R)
3. Check browser console for any errors
4. Try clearing browser cache

### "Redirect URI mismatch" error?
- Make sure you added `http://localhost:8080/**` (with the wildcard)
- Not just `http://localhost:8080` (without wildcard)









































