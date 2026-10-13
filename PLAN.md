# Landing page untuk Omni Studio (gabung 2 app, halaman terpisah)

## Context

Repo `omni-studio` berisi dua AI Studio app independen (`omni-product-studio`, `omni-transition-studio`), masing-masing dengan Express server sendiri di port 3000 dan tidak ada tooling root. User ingin satu landing page yang menampilkan kedua produk, dengan tiap app tetap sebagai "halaman terpisah" — bukan dilebur jadi satu codebase.

Trade-off yang dipilih: **satu origin publik dengan path bersih** (`/product-studio`, `/transition-studio`) lewat reverse proxy, karena ini yang masuk akal untuk sebuah "landing page" produk nyata (bisa di-deploy ke satu domain, link tidak loncat port). Konsekuensinya: perlu edit mekanis kecil di kedua app agar aset dan `fetch('/api/...')` mereka jalan benar di bawah subpath — tapi dirancang agar **mode standalone tiap app tetap bekerja persis seperti sekarang** (default behavior tidak berubah, hanya aktif saat env var di-set).

## Perubahan per bagian

### 1. `omni-product-studio/` dan `omni-transition-studio/` — bikin subpath-aware (keduanya, pola identik)

**`vite.config.ts`**: tambah `base: process.env.VITE_BASE_PATH || '/'`. Default tetap `/` (standalone tidak berubah). Saat dijalankan di bawah landing, akan di-set ke `/product-studio/` atau `/transition-studio/`.

**`server.ts`**:
- Ubah `const PORT = 3000` → `const PORT = Number(process.env.PORT) || 3000`, supaya tiap app bisa dijalankan di port berbeda saat didampingkan (product-studio=3001, transition-studio=3002, landing=3000).
- Bungkus semua route (`app.post('/api/...')`, `app.get('/api/...')`, static/SPA fallback) dengan `express.Router()` yang di-mount lewat `app.use(process.env.BASE_PATH || '', router)`. Default `''` → behavior saat ini tidak berubah sama sekali.

**Frontend fetch calls** (gunakan `import.meta.env.BASE_URL`, yang otomatis diisi Vite dari `base` config — tidak perlu env var baru di sisi klien):
- Tambah helper kecil, misal `src/apiBase.ts`: `export const API_BASE = import.meta.env.BASE_URL;` (selalu berakhir `/`).
- `omni-product-studio/src/App.tsx` (baris ~89, 100, 160, 189, 204, 234) dan `src/components/ImageUploader.tsx` (baris ~45): ganti `fetch('/api/...')` → `` fetch(`${API_BASE}api/...`) `` dan `videoUrl: \`/api/video/${fileId}\`` → pakai `API_BASE` juga.
- `omni-transition-studio/src/App.tsx` (baris ~196, 201, 238, 294): pola sama.

Ini murni mekanis — logika AI/generation di `server.ts` (prompt, system instructions, model calls) **tidak disentuh**.

### 2. `landing/` — app baru

Stack sama dengan 2 app lain (Vite + React 19 + TS + Tailwind v4) supaya konsisten secara visual & tooling:
- `landing/src/App.tsx`: landing page sederhana — hero + 2 kartu (Omni Product Studio, Omni Transition Studio) dengan deskripsi dari `metadata.json` masing-masing app, link ke `/product-studio` dan `/transition-studio` (same-origin, jadi link `<a>` biasa).
- `landing/server.ts`: Express app di `PORT` (default 3000) yang:
  - Serve landing sendiri di `/` (sama pola dev/prod seperti app lain: Vite middleware mode saat dev, `dist/` statis saat `NODE_ENV=production`).
  - Reverse-proxy `/product-studio/*` → `http://localhost:${PRODUCT_STUDIO_PORT||3001}` dan `/transition-studio/*` → `http://localhost:${TRANSITION_STUDIO_PORT||3002}`, pakai `http-proxy-middleware` (ditambahkan sebagai dependency baru).
- `landing/package.json`, `tsconfig.json`, `vite.config.ts`: disalin pola dari 2 app existing (scripts `dev`/`build`/`start`/`lint`/`clean` identik).

### 3. Root — kenyamanan menjalankan 3 server sekaligus

Tambah `package.json` minimal di root (`/home/bang/projects/omni-studio/package.json`) dengan `concurrently` sebagai dev dependency dan satu script:
```json
"scripts": { "dev": "concurrently -n landing,product,transition \"npm --prefix landing run dev\" \"npm --prefix omni-product-studio run dev\" \"npm --prefix omni-transition-studio run dev\"" }
```
Set env port lewat script atau `.env` per app (`PORT=3001` di `omni-product-studio/.env.local`, dst) — didokumentasikan di CLAUDE.md, bukan di-hardcode di source.

### 4. Update `CLAUDE.md`

Tambah bagian baru menjelaskan `landing/`, cara menjalankan ketiganya bersamaan (`npm run dev` di root), konvensi `BASE_PATH`/`VITE_BASE_PATH`/`PORT`, dan bahwa tiap app tetap bisa dijalankan standalone tanpa env var apa pun (unchanged default).

## Verifikasi

1. **Standalone tidak regresi**: di masing-masing `omni-product-studio/` dan `omni-transition-studio/`, jalankan `npm run dev` tanpa env var apa pun → pastikan jalan di port 3000 persis seperti sebelumnya (buka browser, test generate image/video flow sekali).
2. **Mode gabungan**: dari root, `npm run dev` → buka `http://localhost:3000/` lihat landing, klik ke `/product-studio` dan `/transition-studio`, pastikan asset (JS/CSS) ke-load dari subpath yang benar (cek Network tab tidak ada 404), dan satu alur generate (upload gambar → generate) di tiap app berhasil end-to-end lewat proxy (memverifikasi `fetch` `API_BASE` prefix bekerja).
3. **Build production**: `npm run build` di ketiga app, jalankan dengan `NODE_ENV=production`, ulangi test #2 di atas.
