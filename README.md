# KlipAI ✂️ — AI Video Clipper

Prototipe web untuk mengubah video panjang menjadi **klip-klip vertikal 9:16 bersubtitle otomatis**,
siap upload ke TikTok / Reels / Shorts.

**Cara kerja:** upload video → (opsional) AI mentranskrip & memilih momen terbaik →
kamu review/edit → render di browser → unduh klip MP4.

- **AI:** [Meta Model API](https://dev.meta.ai) (transkripsi `muse-voice-transcribe-1.0` +
  analisis `muse-spark-1.3`). API key **hanya dipakai di server**, tidak pernah ke client.
- **Render:** [ffmpeg.wasm](https://ffmpegwasm.netlify.app) — gratis, 100% jalan di browser.
  Trim presisi → crop 9:16 → scale 1080×1920 → bakar subtitle → normalisasi audio.

---

## Instalasi

Butuh: **Node.js 20.19+** dan npm.

```bash
cd ai-video-clipper
npm install

# Unduh aset biner (font subtitle + ffmpeg.wasm core, disimpan di public/)
npm run fetch-assets

# Pasang API key
cp .env.example .env
# lalu isi MODEL_API_KEY=... di .env dengan key dari https://dev.meta.ai → menu "API keys"

npm run dev
```

Buka http://localhost:3000.

> **Tanpa API key pun bisa:** mode **manual** jalan penuh tanpa key. Mode otomatis (AI)
> akan nonaktif dengan penjelasan di UI.

### Opsional: fitur tempel link

Agar kolom "tempel link" bisa mengunduh video, install di server:

```bash
pip install yt-dlp        # butuh Python 3
```

Tanpa yt-dlp, endpoint `/api/fetch-link` mengembalikan pesan jujur dan mengarahkan
pengguna untuk upload file manual. Catatan: unduhan dari YouTube bersifat **best-effort** —
YouTube bisa memblokir unduhan otomatis kapan saja.

---

## Cara pakai

### Mode Otomatis (AI) 🤖
1. **Input** — seret & letakkan file video (atau tempel link).
2. **Mode** — pilih "Otomatis (AI)", tentukan jumlah klip yang diminta (1–10).
3. **Proses** — audio diekstrak di browser → dikirim per chunk ke AI untuk transkripsi →
   AI memilih momen terbaik + judul + caption.
4. **Review** — daftar saran klip bisa diedit: judul, detik awal/akhir (ketik angka atau
   geser), preview potongan, posisi crop, centang/hapus. Klik segmen transkrip untuk
   melompat ke detik itu. Bisa juga tambah klip manual (hybrid).
5. **Render** — render satu per satu di browser, lalu unduh per klip atau semua sekaligus.

### Mode Manual ✋
1. **Input** — upload file video.
2. **Mode** — pilih "Manual" (tanpa API key tetap jalan).
3. **Review** — geser dua handle di timeline (atau ketik detik), preview potongan,
   isi judul + teks overlay opsional, tambah ke daftar klip. Ulangi untuk klip lain.
4. **Render & unduh** — sama seperti mode otomatis.

---

## Batasan jujur (bukan bug)

- **Subtitle per segmen, bukan per kata.** API transkripsi Meta hanya memberi timestamp
  level segmen/turn — jadi subtitle tampil per kalimat, bukan efek karaoke per kata.
- **Audio > 10 menit otomatis di-chunk** (maks 9,5 menit per chunk) karena batas API.
  Kalimat yang terpotong di batas chunk bisa sedikit tidak mulus.
- **Link YouTube best-effort.** Bisa diblokir YouTube kapan saja; web selalu memberi
  pesan jujur + arahan upload manual, tidak pernah loading tanpa ujung.
- **Render memakai CPU browser** — klip panjang butuh beberapa menit; jangan tutup tab.
- **Crop wajah otomatis belum ada** — posisi crop bisa digeser manual per klip.
- Untuk deploy production (mis. Vercel), perhatikan batas ukuran body request platform —
  chunk 9,5 menit ≈ 18MB; self-host/VPS lebih aman untuk file besar.

## Struktur kode

```
app/
  page.tsx                 # wizard: Input → Mode → Proses → Review → Render
  api/
    status/route.ts        # GET: apakah MODEL_API_KEY terpasang (tanpa membocorkan nilai)
    transcribe/route.ts    # POST: teruskan 1 chunk WAV ke api.meta.ai/v1/asr/transcribe
    analyze/route.ts       # POST: muse-spark-1.3 + json_schema → saran klip
    fetch-link/route.ts    # POST: unduh via yt-dlp (best-effort, pesan jujur saat gagal)
components/                # StepInput, StepMode, StepProcess, ReviewClips, RenderPanel, …
lib/
  audio.ts                 # decode → resample 16kHz mono → WAV → chunk (100% browser)
  ass.ts                   # generator subtitle ASS gaya TikTok
  ffmpegClient.ts          # render via ffmpeg.wasm
  apiClient.ts             # pemanggil API routes dari client
public/
  fonts/Inter-Bold.ttf
  ffmpeg/ffmpeg-core.{js,wasm}
```

## Biaya API (perkiraan)

- Transkripsi: $0,18 / jam audio.
- Analisis: ±$1,25 / 1 jt token input (transkrip video 1 jam ≈ $0,02).
- Satu video 1 jam ≈ **kurang dari Rp 4 ribu**.

## Keamanan

- `MODEL_API_KEY` hanya dibaca di API routes (server). Tidak ada kode client yang
  menyentuh key. Jangan pernah commit file `.env`.

---

## Pemeriksaan kualitas

Sebelum membuat commit atau push:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm audit
```

Workflow `.github/workflows/ci.yml` menjalankan lint, pemeriksaan TypeScript, dan build
otomatis untuk setiap pull request serta push ke branch `main`.

## Upload ke GitHub

Proyek ini sengaja tidak menyertakan `.env`. Pastikan key asli hanya tersimpan lokal
atau di menu **Settings → Secrets and variables** pada platform deployment.

```bash
git init
git add .
git commit -m "chore: prepare KlipAI for GitHub"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

File biner ffmpeg terbesar sekitar 32 MB, masih di bawah batas file GitHub 100 MB.