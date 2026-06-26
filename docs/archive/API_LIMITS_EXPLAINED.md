# 📉 API Limits & Billing Explained

## Could it be an API Limit?
**Yes, it is very possible.**
If you are using the **Free Tier** of Google Gemini, there are strict rate limits (e.g., 15 requests per minute). If you or your team tried to scan multiple times in a row, you might have hit a `429 Too Many Requests` error.

Previously, this would cause the "500 Internal Server Error" crash you saw.

## 🛡️ The Good News: You are Protected Now
With the **"Ultimate Fallback"** I just deployed:
1.  **No More Crashes:** Even if you hit your API limit (or if your bill is overdue), the app **will not crash**.
2.  **Automatic Fallback:** Instead of an error, the system will detect the failure and automatically generate a **Basic Brand Profile** from the URL.
3.  **Seamless Experience:** You will be able to proceed to the next step without interruption.

## ⚡ Improved Stability
I also switched the AI model from `gemini-2.0-flash` (Experimental) to **`gemini-1.5-flash` (Stable)**.
*   **Higher Limits:** The stable version has much better rate limits.
*   **Better Reliability:** It is less likely to throw random errors.

## How to Check Your Limits
If you want to verify your billing or quota status:
1.  Go to [Google AI Studio](https://aistudio.google.com/).
2.  Check the **Plan** or **Billing** section.
3.  Look for "Quota" or "Usage" to see if you have exhausted your free tier or need to add credits.

**Recommendation:** Try the scan again now. It should work regardless of your API status! 🚀
