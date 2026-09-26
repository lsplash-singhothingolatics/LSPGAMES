require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.OTP_SECRET || crypto.randomBytes(32).toString('hex');
const MAIL_FROM = process.env.MAIL_FROM || 'LSPGames <onboarding@resend.dev>';
const DEV_SHOW_OTP = process.env.DEV_SHOW_OTP === 'true';

const OTP_TTL = 5 * 60 * 1000;          // code valid 5 minutes
const RESEND_GAP = 30 * 1000;           // 30s between sends per email
const MAX_ATTEMPTS = 5;                 // wrong guesses per code
const SESSION_TTL = 30 * 24 * 3600 * 1000; // stay logged in 30 days

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// In-memory stores (reset when the server restarts)
const otps = new Map();     // email -> { hash, exp, attempts, dob, age }
const sessions = new Map(); // token -> { email, dob, exp }
const ipLog = new Map();
const emailLog = new Map();

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();
const hashCode = (email, code) =>
  crypto.createHmac('sha256', SECRET).update(email + ':' + code).digest('hex');

function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function allow(map, key, limit, windowMs) {
  const now = Date.now();
  const arr = (map.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { map.set(key, arr); return false; }
  arr.push(now);
  map.set(key, arr);
  return true;
}

function parseDob(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d)) age--;
  if (age < 5 || age > 120) return null;
  return { dob: s, age };
}

// ---------- Email providers ----------
let smtp = null;
if (process.env.SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT || 587);
  smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function provider() {
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.RESEND_API_KEY) return 'resend';
  if (smtp) return 'smtp';
  return null;
}

function fromParts() {
  const m = /^(.*)<([^>]+)>\s*$/.exec(MAIL_FROM);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, '') || 'LSPGames', email: m[2].trim() };
  return { name: 'LSPGames', email: MAIL_FROM.trim() };
}

async function sendOtpEmail(to, code) {
  const subject = `${code} is your LSPGames code`;
  const text = `Your LSPGames verification code is ${code}. It expires in 5 minutes. If you didn't ask for this code, you can ignore this email.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f3f6fc;padding:32px">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border:2px solid #dfe5f1;border-radius:20px;padding:28px">
      <div style="font-size:24px;font-weight:bold;color:#16203d">🎮 LSPGames</div>
      <p style="color:#66708f;font-size:15px">Use this code to finish signing in:</p>
      <div style="font-size:38px;letter-spacing:10px;font-weight:bold;color:#2f6bff;background:#eef3ff;border-radius:14px;padding:16px;text-align:center">${code}</div>
      <p style="color:#66708f;font-size:13px">It expires in 5 minutes. If you didn't ask for this code, you can ignore this email.</p>
    </div>
  </div>`;

  const p = provider();
  if (p === 'brevo') {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: fromParts(), to: [{ email: to }], subject, htmlContent: html, textContent: text }),
    });
    if (!r.ok) throw new Error('Brevo error ' + r.status + ': ' + (await r.text()));
    return;
  }
  if (p === 'resend') {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text }),
    });
    if (!r.ok) throw new Error('Resend error ' + r.status + ': ' + (await r.text()));
    return;
  }
  if (p === 'smtp') {
    await smtp.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return;
  }
  if (DEV_SHOW_OTP) {
    console.log(`[DEV] OTP for ${to}: ${code}`);
    return;
  }
  throw new Error('No email provider configured. Set BREVO_API_KEY, RESEND_API_KEY or SMTP_* variables.');
}

// ---------- API ----------
app.get('/healthz', (req, res) => res.json({ ok: true }));

app.post('/api/send-otp', async (req, res) => {
  const email = normEmail(req.body.email);
  const dob = parseDob(req.body.dob);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!dob) return res.status(400).json({ error: 'Enter a valid date of birth (age 5 or older).' });
  if (!allow(ipLog, req.ip, 20, 3600 * 1000)) return res.status(429).json({ error: 'Too many requests. Try again in an hour.' });

  const existing = otps.get(email);
  if (existing && Date.now() - existing.sentAt < RESEND_GAP) {
    const wait = Math.ceil((RESEND_GAP - (Date.now() - existing.sentAt)) / 1000);
    return res.status(429).json({ error: `Wait ${wait}s before asking for a new code.` });
  }
  if (!allow(emailLog, email, 5, 3600 * 1000)) return res.status(429).json({ error: 'Too many codes for this email. Try again in an hour.' });

  const code = String(crypto.randomInt(100000, 1000000));
  otps.set(email, { hash: hashCode(email, code), exp: Date.now() + OTP_TTL, attempts: 0, sentAt: Date.now(), dob: dob.dob });

  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    console.error('Email send failed:', err.message);
    otps.delete(email);
    return res.status(500).json({ error: "Couldn't send the email. Check the server's email settings and try again." });
  }

  const out = { ok: true, expiresIn: OTP_TTL / 1000 };
  if (DEV_SHOW_OTP) out.devCode = code;
  res.json(out);
});

app.post('/api/verify-otp', (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const rec = otps.get(email);
  if (!rec) return res.status(400).json({ error: 'No code found for this email. Ask for a new one.' });
  if (Date.now() > rec.exp) { otps.delete(email); return res.status(400).json({ error: 'That code expired. Ask for a new one.' }); }
  if (rec.attempts >= MAX_ATTEMPTS) { otps.delete(email); return res.status(429).json({ error: 'Too many wrong tries. Ask for a new code.' }); }
  if (!/^\d{6}$/.test(code) || !safeEqual(hashCode(email, code), rec.hash)) {
    rec.attempts++;
    const left = MAX_ATTEMPTS - rec.attempts;
    return res.status(400).json({ error: left > 0 ? `Wrong code. ${left} tries left.` : 'Wrong code. Ask for a new one.' });
  }
  otps.delete(email);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email, dob: rec.dob, exp: Date.now() + SESSION_TTL });
  res.json({ token, email, dob: rec.dob });
});

function auth(req, res, next) {
  const m = /^Bearer (\w+)$/.exec(req.get('Authorization') || '');
  const s = m && sessions.get(m[1]);
  if (!s || Date.now() > s.exp) return res.status(401).json({ error: 'Please sign in again.' });
  req.session = s; req.token = m[1];
  next();
}

app.get('/api/me', auth, (req, res) => res.json({ email: req.session.email, dob: req.session.dob }));
app.post('/api/logout', auth, (req, res) => { sessions.delete(req.token); res.json({ ok: true }); });

// Clean up expired data every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otps) if (now > v.exp) otps.delete(k);
  for (const [k, v] of sessions) if (now > v.exp) sessions.delete(k);
}, 10 * 60 * 1000).unref();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LSPGames running on port ${PORT}`);
  console.log(`Email provider: ${provider() || (DEV_SHOW_OTP ? 'none (DEV mode, codes in log)' : 'NONE CONFIGURED')}`);
});
