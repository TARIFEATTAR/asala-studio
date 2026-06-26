# 🚀 Complete Email Setup - Action Required

## Current Status
- ✅ Code updated (using custom domain)
- ✅ Domain verified in Resend
- ⏳ **Missing environment variables** (ACTION REQUIRED)
- ⏳ Functions need deployment

---

## 🔑 Step 1: Get Your Resend API Key

1. **Go to Resend Dashboard**
   - URL: https://resend.com/api-keys

2. **Create or Copy API Key**
   - If you don't have one, click "Create API Key"
   - Name it: "Madison Studio Production"
   - Permission: "Sending access"
   - Copy the API key (starts with `re_...`)
   - ⚠️ **Save it now** - you won't see it again!

---

## 🔑 Step 2: Check Your Verified Domain

1. **Go to Resend Domains**
   - URL: https://resend.com/domains

2. **Find Your Verified Domain**
   - Look for the green checkmark ✅
   - Note the domain name (e.g., `madisonstudio.io` or `tarifeattar.com`)

---

## ⚙️ Step 3: Add Environment Variables to Supabase

### Option A: Via Supabase CLI (Fastest - 1 minute)

Run these commands in your terminal:

```bash
# Navigate to your project
cd "/Users/jordanrichter/Projects/Madison Studio/madison-app"

# Add RESEND_API_KEY (replace with your actual key)
supabase secrets set RESEND_API_KEY="re_your_actual_api_key_here"

# Add EMAIL_FROM (replace with your verified domain)
supabase secrets set EMAIL_FROM="Madison Studio <hello@madisonstudio.io>"
```

**Important:** Replace:
- `re_your_actual_api_key_here` with your actual Resend API key
- `hello@madisonstudio.io` with an email using your verified domain

### Option B: Via Supabase Dashboard (Alternative - 3 minutes)

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/settings/functions

2. **Navigate to Edge Functions**
   - Click "Edge Functions" in sidebar
   - Scroll to "Secrets" section

3. **Add RESEND_API_KEY**
   - Click "Add new secret"
   - Name: `RESEND_API_KEY`
   - Value: `re_your_actual_api_key_here`
   - Click "Add secret"

4. **Add EMAIL_FROM**
   - Click "Add new secret"
   - Name: `EMAIL_FROM`
   - Value: `Madison Studio <hello@madisonstudio.io>`
   - Click "Add secret"

---

## 🚀 Step 4: Deploy the Functions

After adding the environment variables, deploy the updated functions:

```bash
# Make sure you're in the project directory
cd "/Users/jordanrichter/Projects/Madison Studio/madison-app"

# Deploy both functions
./deploy-email-functions.sh
```

Or deploy manually:

```bash
supabase functions deploy send-report-email
supabase functions deploy send-team-invitation
```

---

## ✅ Step 5: Test Email Delivery

### Send a Test Email

1. **Trigger a brand audit report** through your app
   - Complete a brand scan
   - Email should be sent automatically

2. **Or invite a team member**
   - Go to Settings → Team
   - Invite someone
   - They should receive an invitation email

### Verify Email

Check that the email:
- ✅ Arrives in **inbox** (not spam)
- ✅ Sender shows: `Madison Studio <hello@madisonstudio.io>`
- ✅ You can reply to the email
- ✅ Email headers show SPF/DKIM/DMARC pass

### Check Spam Score

1. Go to: https://www.mail-tester.com/
2. Copy the test email address
3. Send a test email to that address
4. Check your score (should be **8-10/10**, green)

---

## 📧 Choosing Your Sender Email

Based on your verified domain in Resend, choose one:

### If you verified `madisonstudio.io`:
```
Madison Studio <hello@madisonstudio.io>
Madison Studio <support@madisonstudio.io>
Madison Studio <team@madisonstudio.io>
Madison Studio <jordan@madisonstudio.io>
```

### If you verified `tarifeattar.com`:
```
Madison Studio <hello@tarifeattar.com>
Madison Studio <support@tarifeattar.com>
Madison Studio <team@tarifeattar.com>
```

### If you verified another domain:
```
Madison Studio <hello@yourdomain.com>
```

**Avoid:**
- ❌ `noreply@...` - Looks spammy
- ❌ `no-reply@...` - Looks spammy
- ❌ `notifications@...` - Often filtered

---

## 🎯 Quick Checklist

- [ ] Get Resend API key from https://resend.com/api-keys
- [ ] Check verified domain at https://resend.com/domains
- [ ] Add `RESEND_API_KEY` to Supabase secrets
- [ ] Add `EMAIL_FROM` to Supabase secrets
- [ ] Deploy `send-report-email` function
- [ ] Deploy `send-team-invitation` function
- [ ] Send test email
- [ ] Verify email lands in inbox
- [ ] Check spam score at mail-tester.com

---

## 🆘 Troubleshooting

### "RESEND_API_KEY not configured" error
- Make sure you added the secret to Supabase
- Redeploy the functions after adding secrets
- Check the secret name is exactly `RESEND_API_KEY`

### Emails still going to spam
- Verify domain is actually verified in Resend (green checkmark)
- Make sure EMAIL_FROM uses the verified domain
- Check DNS records are still in place
- Test spam score at mail-tester.com

### Deployment fails
```bash
# Make sure you're logged in
supabase login

# Link to your project
supabase link --project-ref likkskifwsrvszxdvufw

# Try deploying again
./deploy-email-functions.sh
```

---

## 📋 Summary

**What you need:**
1. Resend API key (from https://resend.com/api-keys)
2. Your verified domain name (from https://resend.com/domains)

**What to do:**
1. Add both secrets to Supabase
2. Deploy the functions
3. Test email delivery

**Expected result:**
- ✅ Emails land in inbox
- ✅ Professional sender address
- ✅ Users can reply
- ✅ No more spam issues

---

**Estimated Time:** 5-10 minutes

**Next Action:** Get your Resend API key and add both secrets to Supabase
