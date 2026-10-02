# Using LSP-Pay (recommended)

LSPGames speaks LSP-Pay's Business Gateway API directly
(https://lsp-pay.onrender.com/developers).

Render environment variables for LSPGames:

| Key | Value |
|---|---|
| `GATEWAY_MODE` | `lsppay` |
| `LSP_PAY_URL` | `https://lsp-pay.onrender.com` |
| `LSP_PAY_KEY_ID` | Your key ID, `lsp_test_...` |
| `LSP_PAY_SECRET` | Your secret, `lsps_...` (never share it) |
| `LSP_WEBHOOK_SECRET` | The webhook secret from LSP-Pay |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `PUBLIC_URL` | `https://lspgames.onrender.com` |

In LSP-Pay, set the webhook URL to:

    https://lspgames.onrender.com/api/pay/lsp-webhook

How it works: LSPGames creates an LSP-Pay order (with an Idempotency-Key and
`reference` = the LSPGames order id), opens `checkoutUrl` in a new tab, and adds
points when a verified `order.paid` webhook arrives, or when its own polling of
`GET /api/v1/orders/:id` sees `paid`. Points are added once. An `order.refunded`
webhook removes the points again.

---

# Using a different gateway (GATEWAY_MODE=live)


LSPGames and your gateway talk in 3 steps. Every message is signed with a shared
secret (`GATEWAY_SECRET`) using HMAC-SHA256, so nobody can fake a payment.

## 1. LSPGames asks your gateway to start a payment

LSPGames sends:

```
POST  <GATEWAY_CREATE_URL>
Content-Type: application/json
X-LSP-Signature: <hex HMAC-SHA256 of the raw body, key = GATEWAY_SECRET>
Authorization: Bearer <GATEWAY_API_KEY>        (only if you set one)

{
  "order_id": "LSPMUQJ1NOC6A6D3121",
  "amount": 160900,                 // in PAISE (₹1,609.00)
  "currency": "INR",
  "description": "40,000 LSP points",
  "customer_email": "player@gmail.com",
  "return_url": "https://lspgames.onrender.com/?payment=LSPMUQJ1NOC6A6D3121",
  "webhook_url": "https://lspgames.onrender.com/api/pay/webhook"
}
```

Your gateway must:
- Check `X-LSP-Signature` matches (reject with 401 if not).
- Reply `200` with JSON: `{ "payment_url": "https://your-gateway/pay/abc123", "payment_id": "abc123" }`
  (`payment_url` must start with `https://`; `payment_id` is optional.)

The player is then sent to `payment_url` to pay.

## 2. Your gateway tells LSPGames the result (webhook)

When the payment succeeds or fails, your gateway sends:

```
POST  https://lspgames.onrender.com/api/pay/webhook
Content-Type: application/json
X-Gateway-Signature: <hex HMAC-SHA256 of the raw body, key = GATEWAY_SECRET>

{ "order_id": "LSPMUQJ1NOC6A6D3121", "status": "paid", "amount": 160900, "currency": "INR", "payment_id": "abc123" }
```

- `status` is `"paid"` or `"failed"`.
- `amount` must be the exact paise amount from step 1, or LSPGames rejects it.
- LSPGames replies `200 {"ok":true}`. If you get anything else (or no reply), retry later.
  Sending the same webhook twice is safe: points are only added once.
- Only send `"paid"` after the money has really arrived.

## 3. Your gateway sends the player back

After paying, redirect the player's browser to `return_url`. LSPGames shows
"Checking your payment..." and then the result.

## Signing example (Node.js)

```js
const crypto = require('crypto');
const SECRET = process.env.GATEWAY_SECRET; // same value as in LSPGames
const sign = (rawBody) => crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');

// Sending the webhook:
const body = JSON.stringify({ order_id, status: 'paid', amount, currency: 'INR', payment_id });
await fetch(webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gateway-Signature': sign(body) }, body });

// Checking LSPGames' create request (use the RAW body string, not re-stringified JSON):
const ok = crypto.timingSafeEqual(Buffer.from(sign(rawBody)), Buffer.from(req.headers['x-lsp-signature'] || ''.padEnd(64)));
```

## Render environment variables

| Key | Value |
|---|---|
| `GATEWAY_MODE` | `off` (store hidden), `demo` (fake payments for testing), or `live` |
| `GATEWAY_CREATE_URL` | Your gateway's create-payment URL (step 1) |
| `GATEWAY_SECRET` | A long random string. Put the SAME value in your gateway. |
| `GATEWAY_API_KEY` | Optional extra key your gateway checks |
| `GATEWAY_NAME` | Name shown to players, e.g. `LSP Pay` |
| `PUBLIC_URL` | `https://lspgames.onrender.com` |
| `MONGODB_URI` | Your MongoDB Atlas connection string (required for real payments) |

Prices live in `server.js` (`PACKS`, `RATE`, `MIN_RS`, `MAX_RS`).
