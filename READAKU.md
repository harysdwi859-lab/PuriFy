# PuriFy 🎵 – Setup Guide

Spotify-like music web app berbasis Flask + YouTube Music API.

---

## 📁 Struktur File

```
purify-music/
├── index.py              ← Backend Flask (API utama)
├── requirements.txt      ← Dependencies Python
├── vercel.json           ← Config deploy Vercel
├── credentials.json      ← Google Service Account (BUAT SENDIRI)
└── static/
    ├── index.html        ← Halaman utama
    ├── style.css         ← Styling (bebas kamu edit!)
    └── app.js            ← Logika frontend
```

---

## ⚙️ Setup Google Sheets

### 1. Buat Spreadsheet
- Buka Google Sheets, buat spreadsheet baru
- **Sheet1** → kolom A = Username, kolom B = Password (tanpa header, langsung isi dari baris 1)
  ```
  A1: budi    B1: pass123
  A2: ani     B2: rahasia
  ```
- **Sheet2** → Kosongkan. Akan diisi otomatis saat user tambah playlist.
  Format yang tersimpan: `A = username`, `B = data lagu (dipisah ;;)`

### 2. Google Service Account
1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru → Enable **Google Sheets API** dan **Google Drive API**
3. Buat **Service Account** → download key JSON
4. Simpan sebagai `credentials.json` di root project
5. Share spreadsheet ke email service account (dengan role Editor)
6. Copy **Spreadsheet ID** dari URL sheet kamu, paste ke `index.py`:
   ```python
   SHEET_ID = "ISI_SPREADSHEET_ID_KAMU_DISINI"
   ```

---

## 🚀 Jalankan Lokal

```bash
pip install -r requirements.txt
python index.py
```

Buka: http://localhost:5000

---

## ☁️ Deploy ke Vercel

### 1. Set Environment Variable
Di Vercel dashboard → Settings → Environment Variables:
- Key: `GOOGLE_CREDENTIALS_JSON`
- Value: isi dengan isi file `credentials.json` kamu (paste JSON-nya)

### 2. Deploy
```bash
npm i -g vercel
vercel --prod
```

---

## 🎨 Kustomisasi CSS

Edit `static/style.css` — semua variabel warna ada di bagian atas:
```css
:root {
  --accent:  #7c5cfc;   /* warna utama (ungu) */
  --green:   #1db954;   /* hijau spotify */
  --bg:      #0a0a0f;   /* background */
  /* dst... */
}
```

---

## 📋 Fitur Lengkap

| Fitur | Status |
|-------|--------|
| Login via Google Sheets | ✅ |
| Rekomendasi lagu (home) | ✅ |
| Search dengan preview instan | ✅ |
| Play via YouTube IFrame | ✅ |
| Playlist per user di Sheet2 | ✅ |
| Lirik highlight selaras lagu | ✅ |
| Download → PuriFy-namalagu.mp3 | ✅ |
| Context menu klik kanan | ✅ |
| Volume control | ✅ |
| Progress bar klik seek | ✅ |
| Prev / Next lagu | ✅ |
| Responsive mobile | ✅ |

---

## ⚠️ Catatan Penting

- **yt-dlp download** butuh `ffmpeg` terinstall di server. Di Vercel mungkin perlu layer tambahan — lebih mudah pakai VPS/Railway.
- **ytmusicapi** tidak butuh API key (scraping YT Music).
- Lirik dari YouTube Music — tidak semua lagu tersedia.
- Untuk produksi, tambahkan session/JWT yang proper.

---

## 🔗 Link Playlist Manual

Di Sheet2 kolom B, format tiap lagu:
```
NamaLagu|VideoId|NamaArtis
```
Dipisahkan dengan `;;` antar lagu. Contoh:
```
Lagu A|abc123|Artis X;;Lagu B|def456|Artis Y
```
Kamu bisa edit langsung di sheet untuk ubah/tambah lagu secara manual.
