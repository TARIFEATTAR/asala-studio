# 📋 Email Spam Fix Checklist

Use this checklist to track your progress fixing the email spam issue.

## ✅ Phase 1: Code Updates (COMPLETED)

- [x] Updated `send-report-email/index.ts` to use custom domain
- [x] Updated `send-team-invitation/index.ts` to use custom domain
- [x] Added `EMAIL_FROM` environment variable support
- [x] Added `reply_to` field to emails
- [x] Created documentation

## ⏳ Phase 2: Resend Domain Setup (YOUR ACTION REQUIRED)

- [ ] **Go to Resend Dashboard**
  - URL: https://resend.com/domains
  - Login with your Resend account

- [ ] **Add Domain**
  - Click "Add Domain"
  - Enter: `madisonstudio.io`
  - Click "Add"

- [ ] **Copy DNS Records**
  - Resend will show you 3-4 DNS records
  - Copy each record (Type, Name, Value)
  - Keep this tab open for reference

## ⏳ Phase 3: DNS Configuration (YOUR ACTION REQUIRED)

- [ ] **Log in to Domain Registrar**
  - Where did you buy `madisonstudio.io`?
    - [ ] GoDaddy
    - [ ] Namecheap
    - [ ] Cloudflare
    - [ ] Google Domains
    - [ ] Other: _______________

- [ ] **Add SPF Record**
  - Type: TXT
  - Name: @ (or root)
  - Value: `v=spf1 include:resend.com ~all`
  - TTL: 3600 (or default)

- [ ] **Add DKIM Record**
  - Type: TXT
  - Name: `resend._domainkey` (or as shown in Resend)
  - Value: [Copy from Resend dashboard]
  - TTL: 3600 (or default)

- [ ] **Add DMARC Record**
  - Type: TXT
  - Name: `_dmarc`
  - Value: `v=DMARC1; p=none; rua=mailto:dmarc@madisonstudio.io`
  - TTL: 3600 (or default)

- [ ] **Save DNS Changes**

## ⏳ Phase 4: Wait for Verification (24-48 hours)

- [ ] **Check DNS Propagation**
  - Use: https://dnschecker.org/
  - Search for: `madisonstudio.io`
  - Type: TXT
  - Verify records appear globally

- [ ] **Wait for Resend Verification**
  - Check Resend dashboard periodically
  - Look for green checkmark ✅
  - May take up to 48 hours

- [ ] **Domain Verified in Resend**
  - Green checkmark appears
  - Status shows "Verified"

## ⏳ Phase 5: Supabase Configuration (YOUR ACTION REQUIRED)

- [ ] **Go to Supabase Dashboard**
  - URL: https://supabase.com/dashboard
  - Select your Madison Studio project

- [ ] **Navigate to Edge Functions Secrets**
  - Click: Project Settings
  - Click: Edge Functions
  - Scroll to: Secrets

- [ ] **Add EMAIL_FROM Variable**
  - Click "New Secret"
  - Key: `EMAIL_FROM`
  - Value: `Madison Studio <hello@madisonstudio.io>`
  - Click "Add Secret"

- [ ] **Verify Secret Added**
  - `EMAIL_FROM` appears in secrets list

## ⏳ Phase 6: Deploy Functions (YOUR ACTION REQUIRED)

- [ ] **Open Terminal**
  - Navigate to project directory

- [ ] **Login to Supabase CLI** (if not already)
  ```bash
  supabase login
  ```

- [ ] **Deploy Functions**
  - Option A: Use deployment script
    ```bash
    ./deploy-email-functions.sh
    ```
  
  - Option B: Deploy manually
    ```bash
    supabase functions deploy send-report-email
    supabase functions deploy send-team-invitation
    ```

- [ ] **Verify Deployment Success**
  - Both functions show "Deployed successfully"
  - No errors in output

## ⏳ Phase 7: Testing (YOUR ACTION REQUIRED)

- [ ] **Send Test Email**
  - Trigger a brand audit report email
  - Or invite a team member

- [ ] **Check Email Received**
  - Email arrives in inbox (not spam)
  - Sender shows: `Madison Studio <hello@madisonstudio.io>`

- [ ] **Check Email Headers**
  - Open email
  - Click "Show Original" or "View Headers"
  - Verify:
    - [ ] `From: hello@madisonstudio.io`
    - [ ] `SPF: PASS`
    - [ ] `DKIM: PASS`
    - [ ] `DMARC: PASS`

- [ ] **Test Spam Score**
  - Go to: https://www.mail-tester.com/
  - Send test email to provided address
  - Check score (should be 8-10/10, green)

- [ ] **Test Reply Functionality**
  - Reply to test email
  - Verify reply goes to correct address

## 🎉 Phase 8: Verification & Monitoring

- [ ] **Monitor Deliverability**
  - Check Resend dashboard for delivery stats
  - Monitor bounce rates
  - Check spam complaint rates

- [ ] **User Feedback**
  - Ask users if emails are arriving
  - Check if any still going to spam

- [ ] **Warm Up Domain** (if needed)
  - Start with low volume (10-20 emails/day)
  - Gradually increase over 2-4 weeks
  - Monitor deliverability rates

## 📊 Success Criteria

Your email setup is successful when:

- ✅ Emails land in inbox (not spam)
- ✅ Sender shows `hello@madisonstudio.io`
- ✅ SPF/DKIM/DMARC all pass
- ✅ Spam score is 8-10/10 (green)
- ✅ Users can reply to emails
- ✅ Deliverability rate > 95%

## 🆘 Troubleshooting

If emails still go to spam:

- [ ] Verify domain shows verified in Resend
- [ ] Check DNS records are correct
- [ ] Verify EMAIL_FROM is set in Supabase
- [ ] Check functions are deployed
- [ ] Review email content for spam triggers
- [ ] Check Resend dashboard for errors

## 📚 Resources

- [ ] Read: `/docs/FIX_EMAIL_SPAM_ISSUES.md`
- [ ] Review: `/docs/EMAIL_FLOW_DIAGRAM.md`
- [ ] Check: `/EMAIL_SPAM_FIX_SUMMARY.md`

## 📝 Notes

Use this space to track any issues or questions:

```
Date: _______________
Issue: _______________________________________________
Resolution: ___________________________________________

Date: _______________
Issue: _______________________________________________
Resolution: ___________________________________________
```

---

**Current Status:** Phase 1 Complete ✅ | Phases 2-8 Pending ⏳

**Estimated Time to Complete:** 2-3 days (mostly waiting for DNS propagation)

**Next Action:** Go to https://resend.com/domains and add your domain
