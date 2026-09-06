import {
  json, readJson, isAdmin, blobReady, dbRead, dbWrite,
  saveImage, deleteImage, makeId, makeCode, sortDesc,
} from './_lib.mjs';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  if (!blobReady()) {
    return json(res, 503, {
      ok: false,
      error: 'Storage belum terhubung. Buka Vercel → Project → Storage → Create "Blob" → Connect, lalu redeploy.',
    });
  }

  /* ===== GET: daftar / cari by kode (publik) ===== */
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://x');
    const code = url.searchParams.get('code');
    const items = sortDesc(await dbRead());
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
    if (body.photo) {
      try { img = await saveImage(body.photo); }
      catch (e) {
        const msg = e.message === 'FORMAT_FOTO' ? 'Format foto tidak didukung.'
          : e.message === 'FOTO_TERLALU_BESAR' ? 'Foto terlalu besar (maks ±4 MB).'
          : 'Gagal mengunggah foto.';
        return json(res, 400, { ok: false, error: msg });
      }
    }

    const items = await dbRead();
    const item = { id: makeId(), code: makeCode(items), name, rating, desc, img, time: Date.now() };
    items.push(item);
    await dbWrite(items);
    return json(res, 200, { ok: true, data: item });
  }

  /* ===== PUT: edit (admin) ===== */
  if (req.method === 'PUT') {
    if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'Sesi habis — login ulang.' });
    const body = await readJson(req);
    const items = await dbRead();
    const i = items.findIndex(it => it.id === body.id);
    if (i < 0) return json(res, 404, { ok: false, error: 'Testimoni tidak ditemukan.' });

    const name = String(body.name || '').trim();
    const desc = String(body.desc || '').trim();
    if (!name || !desc) return json(res, 400, { ok: false, error: 'Nama dan deskripsi wajib diisi.' });

    if (body.photo) {
      try {
        const url = await saveImage(body.photo);
        await deleteImage(items[i].img);
        items[i].img = url;
      } catch (e) {
        const msg = e.message === 'FORMAT_FOTO' ? 'Format foto tidak didukung.'
          : e.message === 'FOTO_TERLALU_BESAR' ? 'Foto terlalu besar (maks ±4 MB).'
          : 'Gagal mengunggah foto.';
        return json(res, 400, { ok: false, error: msg });
      }
    } else if (body.removePhoto) {
      await deleteImage(items[i].img);
      items[i].img = null;
    }

    items[i].name = name;
    items[i].rating = Math.min(5, Math.max(1, parseInt(body.rating, 10) || 5));
    items[i].desc = desc;
    await dbWrite(items);
    return json(res, 200, { ok: true, data: items[i] });
  }

  /* ===== DELETE: hapus (admin) ===== */
  if (req.method === 'DELETE') {
    if (!isAdmin(req)) return json(res, 401, { ok: false, error: 'Sesi habis — login ulang.' });
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    const items = await dbRead();
    const i = items.findIndex(it => it.id === id);
    if (i < 0) return json(res, 404, { ok: false, error: 'Testimoni tidak ditemukan.' });
    await deleteImage(items[i].img);
    items.splice(i, 1);
    await dbWrite(items);
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
}
