import { json, readJson, checkCredentials, makeCookie, clearCookie, isAdmin } from './_lib.mjs';

export default async function handler(req, res) {
  // Cek status login
  if (req.method === 'GET') {
    return json(res, 200, { ok: true, authed: isAdmin(req) });
  }
  // Logout
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearCookie());
    return json(res, 200, { ok: true, authed: false });
  }
  // Login
  if (req.method === 'POST') {
    const { username, password } = await readJson(req);
    if (checkCredentials(String(username || ''), String(password || ''))) {
      res.setHeader('Set-Cookie', makeCookie(req));
      return json(res, 200, { ok: true, authed: true });
    }
    await new Promise(r => setTimeout(r, 700)); // perlambat brute force
    return json(res, 401, { ok: false, error: 'Username atau password salah.' });
  }
  return json(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
}
