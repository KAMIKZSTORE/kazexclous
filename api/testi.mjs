import {
  json, readJson, isAdmin, blobReady, dbRead, dbWrite,
  validImgUrl, makeId, makeCode, sortDesc,
} from './_lib.mjs';

const IMG_ERROR = 'Link foto tidak valid — harus diawali http:// atau https://.';

export default async function handler(req, res) {

  /* ===== GET: daftar / cari by kode (publik) ===== */
  if (req.method === 'GET') {
    let items;
    try { items = sortDesc(await dbRead()); }
    catch (e) {
      return json(res, 503, {
        ok: false,
        error: 'Database belum terhubung. Buka Vercel → Project → Storage → buat "Blob" → Connect, lalu Redeploy.',
      });
    }
    const url = new URL(req.url, 'http://x');
    const code = url.searchParams.get('code');
    if (code) {
      const one = items.find(i => i.code === code);
      return one
        ? json(res, 200, { ok: true, count: 1, data: [one] })
        : json(res, 404, { ok: false, error: 'Testimoni tidak ditemukan.' });
    }
    return json(res, 200, { ok: true, count: items.length, data: items });
  }

  /* ===== POST: tambah (admin) ===== */
  if (req.method === 'POST') {
    if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'Sesi habis — login ulang.' });
    const body = await readJson(req);
    const name = String(body.name || '').trim();
    const desc = String(body.desc || '').trim();
    const rating = Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5));
    if (!name || !desc) return json(res, 400, { ok: false, error: 'Nama dan deskripsi wajib diisi.' });

    let img = null;
    if (body.img) {
      if (!validImgUrl(body.img)) return json(res, 400, { ok: false, error: IMG_ERROR });
      img = String(body.img).trim();
    }

    try {
      const items = await dbRead();
      const item = { id: makeId(), code: makeCode(items), name, rating, desc, img, time: Date.now() };
      items.push(item);
      await dbWrite(items);
      return json(res, 200, { ok: true, data: item });
    } catch (e) {
      return json(res, 503, { ok: false, error: 'Gagal menyimpan ke database: ' + (e.message || 'UNKNOWN') });
    }
  }

  /* ===== PUT: edit (admin) ===== */
  if (req.method === 'PUT') {
    if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'Sesi habis — login ulang.' });
    const body = await readJson(req);

    try {
      const items = await dbRead();
      const i = items.findIndex(it => it.id === body.id);
      if (i < 0) return json(res, 404, { ok: false, error: 'Testimoni tidak ditemukan.' });

      const name = String(body.name || '').trim();
      const desc = String(body.desc || '').trim();
      if (!name || !desc) return json(res, 400, { ok: false, error: 'Nama dan deskripsi wajib diisi.' });

      // img dikirim selalu dari form: string URL, atau null/'' untuk menghapus foto
      if ('img' in body) {
        if (body.img === null || body.img === '') {
          items[i].img = null;
        } else if (validImgUrl(body.img)) {
          items[i].img = String(body.img).trim();
        } else {
          return json(res, 400, { ok: false, error: IMG_ERROR });
        }
      }

      items[i].name = name;
      items[i].rating = Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5));
      items[i].desc = desc;
      await dbWrite(items);
      return json(res, 200, { ok: true, data: items[i] });
    } catch (e) {
      return json(res, 503, { ok: false, error: 'Gagal menyimpan ke database: ' + (e.message || 'UNKNOWN') });
    }
  }

  /* ===== DELETE: hapus (admin) ===== */
  if (req.method === 'DELETE') {
    if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'Sesi habis — login ulang.' });
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    try {
      const items = await dbRead();
      const i = items.findIndex(it => it.id === id);
      if (i < 0) return json(res, 404, { ok: false, error: 'Testimoni tidak ditemukan.' });
      items.splice(i, 1);
      await dbWrite(items);
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 503, { ok: false, error: 'Gagal menghapus dari database: ' + (e.message || 'UNKNOWN') });
    }
  }

  return json(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
}
