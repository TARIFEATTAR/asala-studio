# 🚀 Email Spam Fix - Quick Reference Card

## 🎯 The Problem
Emails using `onboarding@resend.dev` → Landing in spam ❌

## ✅ The Solution
Use verified custom domain `hello@madisonstudio.io` → Land in inbox ✅

---

## 📋 Quick Action Items

### 1️⃣ Add Domain to Resend (5 min)
🔗 https://resend.com/domains
- Add `madisonstudio.io`
- Copy DNS records

### 2️⃣ Add DNS Records (10 min)
Go to your domain registrar and add:
- **SPF**: `v=spf1 include:resend.com ~all`
- **DKIM**: [Copy from Resend]
- **DMARC**: `v=DMARC1; p=none; rua=mailto:dmarc@madisonstudio.io`

### 3️⃣ Wait for Verification (24-48 hrs)
⏳ DNS propagation takes time
✅ Check Resend dashboard for green checkmark

### 4️⃣ Add Environment Variable (2 min)
Supabase → Project Settings → Edge Functions → Secrets
```
EMAIL_FROM = Madison Studio <hello@madisonstudio.io>
```

### 5️⃣ Deploy Functions (2 min)
```bash
./deploy-email-functions.sh
```

### 6️⃣ Test (5 min)
- Send test email
- Check it lands in inbox
- Verify sender is `hello@madisonstudio.io`

---

## 🔗 Important Links

| Resource | URL |
|----------|-----|
| Resend Dashboard | https://resend.com/domains |
| DNS Checker | https://dnschecker.org/ |
| Spam Score Test | https://www.mail-tester.com/ |
| Supabase Dashboard | https://supabase.com/dashboard |

---

## 📁 Documentation Files

| File | Purpose |
|------|---------|
| `EMAIL_SPAM_FIX_SUMMARY.md` | Quick overview |
| `docs/FIX_EMAIL_SPAM_ISSUES.md` | Complete guide |
| `docs/EMAIL_FLOW_DIAGRAM.md` | Visual diagrams |
| `EMAIL_SPAM_FIX_CHECKLIST.md` | Step-by-step checklist |
| `deploy-email-functions.sh` | Deployment script |

---

## 🎨 DNS Records Template

Copy this to your domain registrar:

```
Record 1:
Type: TXT
Name: @
Value: v=spf1 include:resend.com ~all

Record 2:
Type: TXT
Name: resend._domainkey
Value: [GET FROM RESEND DASHBOARD]

Record 3:
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@madisonstudio.io
```

---

## ✅ Success Indicators

Your setup is working when you see:

- ✅ Resend dashboard shows green checkmark
- ✅ Email from: `hello@madisonstudio.io`
- ✅ Email lands in inbox (not spam)
- ✅ SPF: PASS
- ✅ DKIM: PASS
- ✅ DMARC: PASS
- ✅ Spam score: 8-10/10 (green)

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| DNS not propagating | Wait 24-48 hours, check dnschecker.org |
| Domain not verified | Check DNS records are correct |
| Still going to spam | Verify EMAIL_FROM is set, functions deployed |
| Deployment fails | Run `supabase login` first |

---

## 💡 Pro Tips

1. **Use `hello@` instead of `noreply@`** - More friendly, less spammy
2. **Add reply_to field** - Already done ✅
3. **Monitor deliverability** - Check Resend dashboard weekly
4. **Warm up domain** - Start with low volume if new domain
5. **Keep content clean** - Avoid spam trigger words

---

## 🎯 Current Status

- ✅ Code updated
- ⏳ Domain setup pending
- ⏳ DNS records pending
- ⏳ Deployment pending

**Next Action:** Go to https://resend.com/domains

---

## 📞 Need Help?

1. Check `/docs/FIX_EMAIL_SPAM_ISSUES.md` for detailed guide
2. Review `/EMAIL_SPAM_FIX_CHECKLIST.md` for step-by-step
3. Check Resend documentation: https://resend.com/docs

---

**Estimated Time to Complete:** 2-3 days (mostly DNS propagation)

**Difficulty:** Easy ⭐⭐☆☆☆

**Impact:** High 🚀🚀🚀 (Fixes spam issue completely)
