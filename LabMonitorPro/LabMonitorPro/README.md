# LabMonitor Pro

Aplikasi web manajemen & monitoring laboratorium komputer.

## Cara Menjalankan

Aplikasi ini murni front-end (HTML/CSS/JS) dan sudah berjalan penuh secara
mandiri menggunakan **mock data** yang tersimpan di `localStorage` browser
(lihat `js/api.js`). Tidak perlu instalasi apa pun.

1. Ekstrak folder `LabMonitorPro`.
2. Buka `index.html` langsung di browser, **atau** jalankan server statis
   sederhana agar semua fitur (termasuk fetch relatif) berjalan optimal:

   ```bash
   cd LabMonitorPro
   python -m http.server 8080
   ```

   Lalu buka `http://localhost:8080` di browser.

## Akun Demo

| Peran        | Username   | Password      |
|--------------|-----------|---------------|
| Super Admin  | admin     | admin123      |
| Operator Lab | operator  | operator123   |

Atau pilih **"Lanjutkan sebagai Guest"** untuk mode lihat-saja (read-only,
semua aksi admin disembunyikan/dinonaktifkan otomatis oleh RBAC).

## Menghubungkan ke Backend Flask Sungguhan

Seluruh komunikasi data melewati satu file: `js/api.js`. Untuk beralih dari
mock data ke backend Python Flask sungguhan:

1. Buka `js/api.js`.
2. Ubah `const BASE_URL = "http://localhost:5000/api";` sesuai alamat server Flask.
3. Ubah `const USE_MOCK = true;` menjadi `false`.
4. Implementasikan endpoint REST berikut di Flask agar sesuai kontrak yang
   sudah dipanggil oleh front-end (lihat komentar di setiap fungsi `Api.*`):

   - `GET  /api/pcs?lab=<lab1|lab2>`
   - `GET  /api/pcs/:id`
   - `GET  /api/pcs/summary`
   - `GET  /api/activity`
   - `GET  /api/attendance`
   - `GET  /api/inventory`
   - `GET  /api/pcs/:id/maintenance`
   - `POST /api/pcs/:id/maintenance`
   - `PUT  /api/pcs/:id/asset`
   - `POST /api/pcs/:id/remote/<restart|shutdown|broadcast|kill>`
   - `POST /api/pcs/shutdown-all?lab=<lab1|lab2>`
   - `GET  /api/export/<attendance|maintenance|inventory>` (kembalikan file `.xlsx`)

Tidak ada perubahan yang diperlukan di `app.js`, `floorplan.js`, `modal.js`,
atau `auth.js` — semuanya sudah berkomunikasi lewat objek `Api`.

## Struktur Folder

```
LabMonitorPro/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── app.js        # Inisialisasi, routing, dashboard, tabel
    ├── auth.js        # Login multi-role, session, anti-paste, RBAC
    ├── floorplan.js   # Denah lab & interaksi node PC
    ├── modal.js        # Modal detail PC (6 tab) & modal export
    └── api.js          # Service layer (mock ⇄ Flask REST)
```
