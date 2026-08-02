# ⚡ Fast Track Setup - Domain Already Verified!

Great news! Since your domain is already verified in Resend, you only need to complete 3 quick steps:

## Step 1: Add EMAIL_FROM Environment Variable

### Option A: Via Supabase Dashboard (Recommended - 2 minutes)

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/likkskifwsrvszxdvufw/settings/functions
   - (Your project: Asala)

2. **Navigate to Edge Functions Secrets**
   - Click: "Edge Functions" in the left sidebar
   - Scroll down to: "Secrets" section

3. **Add New Secret**
   - Click: "Add new secret"
   - **Name:** `EMAIL_FROM`
   - **Value:** Choose one based on your verified domain in Resend:
     
     If you verified `madisonstudio.io`:
     ```
     Madison Studio <hello@madisonstudio.io>
     ```
     
     Or if you verified a different domain:
     ```
     Madison Studio <hello@yourdomain.com>
     ```

4. **Save**
   - Click "Add secret" or "Save"

### Option B: Via Supabase CLI (Alternative)

```bash
# Set the environment variable
supabase secrets set EMAIL_FROM="Madison Studio <hello@madisonstudio.io>"
```

---

## Step 2: Deploy the Updated Functions

Run the deployment script:

```bash
cd "/Users/jordanrichter/Projects/Madison Studio/madison-app"
./deploy-email-functions.sh
```

Or deploy manually:

```bash
supabase functions deploy send-report-email
supabase functions deploy send-team-invitation
```

---

## Step 3: Test Email Delivery

### Send a Test Email

1. Trigger a brand audit report email through your app
2. Or invite a team member to test the invitation email

### Verify Email

Check that the email:
- ✅ Arrives in inbox (not spam)
- ✅ Shows sender as: `hello@madisonstudio.io` (or your domain)
- ✅ Has proper authentication (SPF/DKIM/DMARC pass)

### Check Spam Score (Optional but Recommended)

1. Go to: https://www.mail-tester.com/
2. Copy the test email address they provide
3. Send a test email to that address
4. Check your score (should be 8-10/10, green)

---

## 🎯 Quick Checklist

- [ ] Add `EMAIL_FROM` to Supabase secrets
- [ ] Deploy `send-report-email` function
- [ ] Deploy `send-team-invitation` function
- [ ] Send test email
- [ ] Verify email lands in inbox
- [ ] Check spam score (optional)

---

## 🔍 What Domain Did You Verify?

If you're not sure which email address to use, check your Resend dashboard:

1. Go to: https://resend.com/domains
2. Look for the verified domain (green checkmark)
3. Use that domain in your EMAIL_FROM value

**Common options:**
- `Madison Studio <hello@madisonstudio.io>`
- `Madison Studio <support@madisonstudio.io>`
- `Madison Studio <team@madisonstudio.io>`
- `Madison Studio <jordan@madisonstudio.io>`

---

## 🆘 Troubleshooting

### If deployment fails:
```bash
# Make sure you're logged in
supabase login

# Link to your project (if needed)
supabase link --project-ref likkskifwsrvszxdvufw
```

### If emails still use old sender:
- Make sure EMAIL_FROM is set in Supabase
- Redeploy the functions
- Clear any caches

---

**Estimated Time:** 5-10 minutes total

**Next Action:** Add EMAIL_FROM to Supabase Dashboard
