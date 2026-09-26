# LSPGames

A light game platform: date of birth, email, real email OTP, then play.
First game: **RPG INTERCODE** (15 levels of shooter bots, points, guns and upgrades).

## Deploy on Render (Web Service)

1. Push this folder to a GitHub repo.
2. Render dashboard > New > Web Service > pick the repo.
3. Settings:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`   (same as `node server.js`)
   - Health Check Path: `/healthz`
4. Environment variables:
   - `OTP_SECRET` = any long random text
   - `MAIL_FROM` = `LSPGames <your-verified-sender@gmail.com>`
   - `BREVO_API_KEY` = your Brevo API key (recommended)
     or `RESEND_API_KEY` = your Resend key
5. Deploy. Open `https://<your-app>.onrender.com`.

### Getting a free email key (Brevo)
1. Sign up at brevo.com.
2. Senders & IPs > add your Gmail as a sender and verify it.
3. SMTP & API > API Keys > create key > paste into `BREVO_API_KEY`.
4. Use that same verified Gmail in `MAIL_FROM`.

Resend works too, but without your own domain it only sends to your own email.
SMTP (Gmail app password) is supported via `SMTP_HOST/PORT/USER/PASS`, but Render's
free plan may block SMTP ports, so the HTTP API providers above are safer.

## Run locally
```
npm install
cp .env.example .env     # set DEV_SHOW_OTP=true to test without email
npm start                # http://localhost:3000
```

## Notes
- Codes expire in 5 minutes, 5 wrong tries max, 30s resend cooldown, rate limited.
- Logins and codes are kept in server memory. On Render free plan the server sleeps
  when idle, so players may need to log in again after a restart. Game progress
  (points, guns, upgrades) is saved in the player's browser.
