# How to Deploy the `process-brand-document` Function

## What is Deployment?

**Deployment** means uploading the function code from your computer to Supabase's servers so it can run in the cloud.

- ✅ **Function code exists** in your project at: `supabase/functions/process-brand-document/index.ts`
- ❌ **Function is NOT deployed** to Supabase yet (that's why you don't see it in the dashboard)

## Step-by-Step Deployment

### Step 1: Open Your Terminal

Open Terminal (Mac) or Command Prompt (Windows) and navigate to your project:

```bash
cd "/Users/jordanrichter/Projects/Madison Studio/madison-app"
```

### Step 2: Log In to Supabase

Run this command:

```bash
npx supabase login
```

This will:
- Open a browser window
- Ask you to log in to Supabase
- Authorize the CLI to access your projects

### Step 3: Deploy the Function

Once logged in, run this command:

```bash
npx supabase functions deploy process-brand-document \
  --project-ref likkskifwsrvszxdvufw \
  --no-verify-jwt
```

**What this does:**
- Takes the function code from `supabase/functions/process-brand-document/index.ts`
- Uploads it to your Supabase project
- Makes it available to call from your app

### Step 4: Verify Deployment

1. Go to your Supabase Dashboard:
   https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/functions

2. You should now see **`process-brand-document`** in the list of functions

3. Click on it to see details, logs, and settings

## Alternative: Use the Script

Instead of running the command manually, you can use the script I created:

```bash
./deploy-process-brand-document.sh
```

This script does the same thing but with helpful messages.

## Troubleshooting

### "Not logged in" error
- Run `npx supabase login` first

### "Project not found" error
- Verify your project ID is correct: `likkskifwsrvszxdvufw`
- Check you have access to this project in Supabase

### "Permission denied" error
- Make sure you're logged in with an account that has deploy permissions
- Check your Supabase project settings

## After Deployment

Once deployed, the function will:
- ✅ Process PDF documents
- ✅ Process text (.txt) files
- ✅ Process markdown (.md) files
- ✅ Extract brand knowledge
- ✅ Work with the CORS fixes I made

You can then upload brand documents in Settings and they should process successfully!

## Need Help?

If you get stuck, share the error message and I'll help you fix it.

