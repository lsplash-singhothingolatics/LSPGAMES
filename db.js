/* Storage for users, sessions, wallets and payment orders.
   Uses MongoDB when MONGODB_URI is set (needed on Render, so nothing is lost on restart).
   Without it, falls back to a local JSON file (fine for testing on your own computer only). */
const fs = require('fs');
const path = require('path');

const POINTS_MAX = 10000000;
const dayKey = () => new Date().toISOString().slice(0, 10);

async function connect() {
  if (process.env.MONGODB_URI) return mongoStore();
  console.warn('MONGODB_URI not set: using local file storage. Data will be LOST on Render restarts. Do not take real payments like this.');
  return fileStore();
}

/* ---------------- MongoDB ---------------- */
async function mongoStore() {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'lspgames');
  const users = db.collection('users'), sessions = db.collection('sessions'), orders = db.collection('orders');
  await users.createIndex({ email: 1 }, { unique: true });
  await sessions.createIndex({ token: 1 }, { unique: true });
  await sessions.createIndex({ exp: 1 }, { expireAfterSeconds: 0 });
  await orders.createIndex({ orderId: 1 }, { unique: true });
  await orders.createIndex({ email: 1, createdAt: -1 });

  return {
    kind: 'mongodb',
    async upsertUser(email, dob) {
      await users.updateOne({ email }, { $setOnInsert: { email, points: 0, createdAt: new Date(), migrated: false, earned: { day: dayKey(), n: 0 } }, $set: { dob } }, { upsert: true });
      return users.findOne({ email });
    },
    getUser: (email) => users.findOne({ email }),
    createSession: (token, email, dob, exp) => sessions.insertOne({ token, email, dob, exp: new Date(exp) }),
    async getSession(token) { const s = await sessions.findOne({ token }); return s && s.exp > new Date() ? s : null; },
    deleteSession: (token) => sessions.deleteOne({ token }),
    /* Adds up to n points, respecting the 10M max. Returns { added, points }. */
    async addPoints(email, n, dailyCap) {
      const u = await users.findOne({ email }); if (!u) return null;
      const today = dayKey(), earnedToday = u.earned && u.earned.day === today ? u.earned.n : 0;
      let add = Math.min(n, POINTS_MAX - u.points);
      if (dailyCap != null) add = Math.min(add, Math.max(0, dailyCap - earnedToday));
      add = Math.max(0, Math.floor(add));
      if (!add) return { added: 0, points: u.points };
      const upd = { $inc: { points: add } };
      if (dailyCap != null) upd.$set = { earned: { day: today, n: earnedToday + add } };
      const r = await users.findOneAndUpdate({ email, points: { $lte: POINTS_MAX - add } }, upd, { returnDocument: 'after' });
      const doc = r && r.value !== undefined ? r.value : r;
      return doc ? { added: add, points: doc.points } : { added: 0, points: (await users.findOne({ email })).points };
    },
    async spendPoints(email, n) {
      const r = await users.findOneAndUpdate({ email, points: { $gte: n } }, { $inc: { points: -n } }, { returnDocument: 'after' });
      const doc = r && r.value !== undefined ? r.value : r;
      if (doc) return { ok: true, points: doc.points };
      const u = await users.findOne({ email }); return { ok: false, points: u ? u.points : 0 };
    },
    async markMigrated(email) { const r = await users.updateOne({ email, migrated: { $ne: true } }, { $set: { migrated: true } }); return r.modifiedCount === 1; },
    createOrder: (o) => orders.insertOne(o),
    getOrder: (orderId) => orders.findOne({ orderId }),
    getOrderByGateway: (gid) => orders.findOne({ gatewayOrderId: gid }),
    async markRefunded(orderId) { const r = await orders.findOneAndUpdate({ orderId, status: 'paid' }, { $set: { status: 'refunded', refundedAt: new Date() } }, { returnDocument: 'after' }); return r && r.value !== undefined ? r.value : r; },
    listOrders: (email) => orders.find({ email }).sort({ createdAt: -1 }).limit(20).toArray(),
    /* Moves an order from pending to paid exactly once. Returns the order if THIS call did it. */
    async claimPaid(orderId, info) {
      const r = await orders.findOneAndUpdate({ orderId, status: 'pending' }, { $set: { status: 'paid', paidAt: new Date(), ...info } }, { returnDocument: 'after' });
      return r && r.value !== undefined ? r.value : r;
    },
    setOrder: (orderId, fields) => orders.updateOne({ orderId, status: 'pending' }, { $set: fields }),
    async takePoints(email, n) { const u = await users.findOne({ email }); if (!u) return 0; const t = Math.min(n, u.points); if (t > 0) await users.updateOne({ email }, { $inc: { points: -t } }); return t; },
  };
}

/* ---------------- Local file (testing only) ---------------- */
function fileStore() {
  const file = process.env.DATA_FILE || path.join(__dirname, 'data.json');
  let data = { users: {}, sessions: {}, orders: {} };
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  let t = null;
  const persist = () => { clearTimeout(t); t = setTimeout(() => fs.writeFile(file, JSON.stringify(data), () => {}), 200); };
  const clone = (x) => (x ? JSON.parse(JSON.stringify(x)) : null);
  return {
    kind: 'file',
    async upsertUser(email, dob) {
      if (!data.users[email]) data.users[email] = { email, points: 0, createdAt: new Date().toISOString(), migrated: false, earned: { day: dayKey(), n: 0 } };
      data.users[email].dob = dob; persist(); return clone(data.users[email]);
    },
    async getUser(email) { return clone(data.users[email]); },
    async createSession(token, email, dob, exp) { data.sessions[token] = { token, email, dob, exp }; persist(); },
    async getSession(token) { const s = data.sessions[token]; return s && s.exp > Date.now() ? clone(s) : null; },
    async deleteSession(token) { delete data.sessions[token]; persist(); },
    async addPoints(email, n, dailyCap) {
      const u = data.users[email]; if (!u) return null;
      const today = dayKey(); if (!u.earned || u.earned.day !== today) u.earned = { day: today, n: 0 };
      let add = Math.min(n, POINTS_MAX - u.points);
      if (dailyCap != null) add = Math.min(add, Math.max(0, dailyCap - u.earned.n));
      add = Math.max(0, Math.floor(add));
      u.points += add; if (dailyCap != null) u.earned.n += add; persist();
      return { added: add, points: u.points };
    },
    async spendPoints(email, n) { const u = data.users[email]; if (!u || u.points < n) return { ok: false, points: u ? u.points : 0 }; u.points -= n; persist(); return { ok: true, points: u.points }; },
    async markMigrated(email) { const u = data.users[email]; if (!u || u.migrated) return false; u.migrated = true; persist(); return true; },
    async createOrder(o) { data.orders[o.orderId] = { ...o, createdAt: new Date(o.createdAt).toISOString() }; persist(); },
    async getOrder(id) { return clone(data.orders[id]); },
    async getOrderByGateway(gid) { return clone(Object.values(data.orders).find((o) => o.gatewayOrderId === gid)); },
    async markRefunded(id) { const o = data.orders[id]; if (!o || o.status !== 'paid') return null; o.status = 'refunded'; o.refundedAt = new Date().toISOString(); persist(); return clone(o); },
    async listOrders(email) { return Object.values(data.orders).filter((o) => o.email === email).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 20).map(clone); },
    async claimPaid(id, info) { const o = data.orders[id]; if (!o || o.status !== 'pending') return null; Object.assign(o, { status: 'paid', paidAt: new Date().toISOString() }, info); persist(); return clone(o); },
    async takePoints(email, n) { const u = data.users[email]; if (!u) return 0; const t = Math.min(n, u.points); u.points -= t; persist(); return t; },
    async setOrder(id, fields) { const o = data.orders[id]; if (o && o.status === 'pending') { Object.assign(o, fields); persist(); } },
  };
}

module.exports = { connect, POINTS_MAX };
