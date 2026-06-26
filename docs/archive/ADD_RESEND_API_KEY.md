# 🔑 Add RESEND_API_KEY - Final Step

## ✅ Progress So Far
- ✅ Code updated to use custom domain
- ✅ Domain verified: `madisonstudio.io`
- ✅ EMAIL_FROM set: `Madison Studio <hello@madisonstudio.io>`
- ⏳ **RESEND_API_KEY needs to be added**

---

## 📋 Next Step: Add Your Resend API Key

### 1. Get Your Resend API Key

**Option A: If you already have it saved somewhere**
- Find your saved Resend API key (starts with `re_...`)

**Option B: Get it from Resend Dashboard**
1. Go to: https://resend.com/api-keys
2. If you see an existing key, you can't view it again (Resend doesn't show keys after creation)
3. Create a new one:
   - Click "Create API Key"
   - Name: "Madison Studio Production"
   - Permission: "Sending access"
   - Copy the key immediately (you won't see it again!)

### 2. Add the API Key to Supabase

Run this command (replace `YOUR_RESEND_API_KEY` with your actual key):

```bash
supabase secrets set RESEND_API_KEY="YOUR_RESEND_API_KEY"
```

**Example:**
```bash
supabase secrets set RESEND_API_KEY="re_AbCdEfGh123456789"
```

---

## 🚀 After Adding the API Key

Once you've added `RESEND_API_KEY`, deploy the functions:

```bash
./deploy-email-functions.sh
```

Or manually:
```bash
supabase functions deploy send-report-email
supabase functions deploy send-team-invitation
```

---

## ✅ Verification

After deployment, verify both secrets are set:

```bash
supabase secrets list
```

You should see:
- ✅ `EMAIL_FROM`
- ✅ `RESEND_API_KEY`

---

## 🧪 Test

1. Send a test email through your app (trigger a brand audit)
2. Check that email:
   - ✅ Arrives in inbox (not spam)
   - ✅ Shows sender: `Madison Studio <hello@madisonstudio.io>`
   - ✅ Can be replied to

---

**Next Action:** Add your Resend API key using the command above
