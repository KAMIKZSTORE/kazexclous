import crypto from 'crypto';
import { put, list, del } from '@vercel/blob';

const DB_PATH = 'db/testimoni.json';
const ADMIN_USER = process.env.ADMIN_USER || 'kazex';
const ADMIN_PASS = process.env.ADMIN_PASS || 'kazex5791';
const SECRET = process.env.ADMIN_SECRET || ('kazex-sign::' + ADMIN_PASS);

/* ---------- respons JSON ---------- */
export function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export async function readJson(req) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return {}; }
}

/* ---------- auth: cookie bertanda tangan HMAC ---------- */
function sign(exp) {
  return crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
}
export function makeCookie() {
  const exp = Date.now() + 7 * 24 * 3600 * 1000; // 7 hari
  return `kazex_admin=${exp}.${sign(exp)}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=604800`;
}
export function clearCookie() {
  return 'kazex_admin=; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0';
}
export function isAdmin(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find(v => v.startsWith('kazex_admin='));
  if (!raw) return false;
  const [exp, sig] = raw.slice('kazex_admin='.length).split('.');
  const n = Number(exp);
  if (!n || n < Date.now() || !sig) return false;
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(n))); }
  catch { return false; }
}
export function checkCredentials(u, p) {
  return u === ADMIN_USER && p === ADMIN_PASS;
}

/* ---------- database JSON di Vercel Blob ---------- */
export function blobReady() { return Boolean(process.env.BLOB_READ_WRITE_TOKEN); }

export async function dbRead() {
  if (!blobReady()) return [];
  const { blobs } = await list({ prefix: DB_PATH });
  const b = blobs.sort((a, z) => new Date(z.uploadedAt) - new Date(a.uploadedAt))[0];
  if (!b) return [];
  const r = await fetch(b.url, { cache: 'no-store' });
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}

export async function dbWrite(items) {
  if (!blobReady()) throw new Error('NO_BLOB');
  await put(DB_PATH, JSON.stringify(items), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

/* ---------- foto testimoni -> folder /testi/ di Blob ---------- */
export async function saveImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new Error('FORMAT_FOTO');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) throw new Error('FOTO_TERLALU_BESAR');
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  const name = `testi/testi_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const b = await put(name, buf, { access: 'public', contentType: m[1], addRandomSuffix: false });
  return b.url;
}
export async function deleteImage(url) {
  if (!url || typeof url !== 'string' || !/^https:\/\//.test(url)) return;
  try { await del(url); } catch {}
}

/* ---------- id & kode share 16 digit ---------- */
export function makeId() { return crypto.randomBytes(6).toString('hex'); }
export function makeCode(existing = []) {
  const taken = new Set(existing.map(i => i.code));
  for (let i = 0; i < 30; i++) {
    let c = '';
    for (let k = 0; k < 16; k++) c += crypto.randomInt(0, 10);
    if (!taken.has(c)) return c;
  }
  return String(Date.now()).padEnd(16, '0').slice(0, 16);
}

export function sortDesc(items) {
  return [...items].sort((a, b) => (b.time || 0) - (a.time || 0));
}
