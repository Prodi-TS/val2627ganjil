# Validasi Laporan Proyek Siswa

GitHub Pages (halaman siswa) + Google Apps Script (API) + Google Sheets (data) + Google Drive (penyimpanan PDF).

```
index.html  style.css  script.js        <- website (isi konfigurasi di bagian atas script.js)
apps-script/Code.gs                     <- tempel di Apps Script
Template-Data-Validasi.xlsx             <- template daftar siswa & guru
```

## 1. Spreadsheet (sudah dibuat)
Spreadsheet data sudah dibuat di Google Drive akun yang terhubung dan tautannya sudah dipasang di `apps-script/Code.gs`:

`https://docs.google.com/spreadsheets/d/1umK8HZnkFJPdJuooaNsyjYX6lyBtMqWvuka2Gpx7Kdo/edit`

1. Buka spreadsheet itu. Sheet **Siswa** berisi 3 data contoh (NIS 1234501–1234503). Hapus data contoh, lalu isi 700 siswa dengan kolom `NIS | Nama | Kelas | PIN | Guru Laporan 1 | Guru Laporan 2`.
2. **Format kolom NIS dan PIN sebagai teks** (*Format → Number → Plain text*) **sebelum** menempel data, agar angka 0 di depan tidak hilang. PIN boleh dikosongkan.
3. Tab **Laporan** dan **Rekap** dibuat otomatis oleh script (menu *Siapkan sheet awal* dan *Bangun / perbarui rekap*).

## 2. Pasang Apps Script
1. Buka spreadsheet di atas → **Extensions → Apps Script** (buat script dari sini agar menu *Validasi Laporan* muncul di spreadsheet). Tempel seluruh `apps-script/Code.gs`, **Save**.
2. Pilih fungsi `setupSheets` di editor, klik **Run**, dan setujui izin akses Drive & Sheets.
3. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone** → Deploy. Salin URL `/exec`.
4. Setiap mengubah `Code.gs`: **Deploy → Manage deployments → Edit → New version**.

## 3. Hubungkan website
Di `script.js` bagian atas, isi:
- `GOOGLE_APPS_SCRIPT_URL` dengan URL `/exec`
- `SCHOOL_NAME` dengan nama sekolah (kop PDF)
- `REPORT_LABELS` dengan nama kedua laporan

## 4. GitHub Pages
Upload `index.html`, `style.css`, `script.js` ke repository → **Settings → Pages → Deploy from a branch → main / root**. Alamat situs = alamat shortlink dasar (`https://USER.github.io/REPO/#/KODE`).

## Cara kerja
- Siswa memasukkan NIS (+PIN bila ada) → konfirmasi nama/kelas → isi **judul tiap laporan** dan unggah 2 PDF (guru terisi otomatis dari daftar siswa).
- PDF disimpan di Drive: `Laporan Proyek Siswa / <Kelas> / <NIS - Nama>/`, dengan akses "siapa saja yang punya link".
- Tiap laporan mendapat kode 6 karakter. Shortlink `situs/#/KODE` membuka Apps Script, lalu dialihkan ke file Drive. QR berisi shortlink itu.
- Tombol **Unduh PDF** membuat lembar validasi di browser: identitas, 2 shortlink, 2 QR, dan kotak tanda tangan kosong untuk guru (ditandatangani basah setelah dicetak).

## Halaman "Laporan Saya"
Menu kedua di bagian atas situs. Siswa memasukkan NIS (+PIN) untuk melihat laporan yang sudah terkumpul, menyalin shortlink, melihat QR, dan **mengunduh ulang PDF lembar validasi** kapan saja (tanggal di PDF tetap tanggal pengumpulan asli).

## Rekap untuk wali kelas
1. Setelah Code.gs terpasang, **muat ulang spreadsheet**. Muncul menu **Validasi Laporan → Bangun / perbarui rekap** (pertama kali akan meminta izin). Jalankan setiap daftar siswa berubah.
2. Dua sheet dibuat otomatis:
   - **Rekap**: satu baris per siswa (NIS, nama, kelas, guru, **Status Pengumpulan**, tanggal kumpul, **Status PDF**, jumlah unduh). Merah = belum, hijau = sudah. Ada filter, jadi walas tinggal memfilter kolom Kelas.
   - **Rekap Kelas**: per kelas, berisi jumlah siswa, sudah/belum mengumpulkan, persentase, dan jumlah yang sudah mengunduh PDF.
3. Setelah itu rekap **ikut berubah sendiri** setiap ada siswa yang mengumpulkan atau mengunduh PDF.
4. **Jangan bagikan spreadsheet utama ke walas**, karena sheet Siswa berisi PIN. Cara aman: buat spreadsheet baru, isi sel A1 dengan `=IMPORTRANGE("URL-spreadsheet-utama","Rekap!A:I")` (klik *Allow access*), lalu bagikan spreadsheet baru itu ke walas sebagai *Viewer*. Bisa juga dibuat dashboard Looker Studio dari sheet Rekap dengan filter Kelas.

"Status PDF" = siswa sudah menekan tombol Unduh PDF. Sistem tidak bisa mengetahui apakah PDF sudah dicetak atau ditandatangani guru.

## Admin
- **Membuka kunci siswa** (salah ketik, ganti file): menu **Validasi Laporan → Buka kunci siswa**, masukkan NIS. Baris di sheet Laporan dihapus, Rekap diperbarui, lalu siswa bisa mengunggah ulang lewat menu *Kumpulkan Laporan*.
  - File lama tetap ada di Drive sebagai arsip, tetapi aksesnya dimatikan. Shortlink dan QR lama tidak berlaku lagi; siswa mendapat kode baru.
  - Lembar validasi lama perlu dicetak ulang dan ditandatangani ulang guru.
  - Jika Anda menghapus baris Laporan secara manual, jalankan **Bangun / perbarui rekap** agar Rekap ikut benar.
- **Rekap**: sheet Laporan bisa langsung dipakai pivot atau Looker Studio.

## Catatan
- Siswa bisa 1 kali kirim. Batas 10 MB per PDF (ubah `MAX_BYTES` di Code.gs dan `MAX_MB` di script.js).
- Kuota Drive: 1.400 PDF × 5 MB ≈ 7 GB. Pakai akun yang kuotanya cukup.
- Jika Workspace sekolah melarang berbagi publik, script otomatis memakai akses "siapa saja di domain"; QR hanya terbuka untuk akun sekolah.
- NIS tanpa PIN mudah ditebak. Isi kolom PIN untuk keamanan lebih.
- Apps Script melayani sekitar 30 permintaan bersamaan. Jadwalkan pengumpulan per kelas.
- Library PDF/QR dimuat dari cdnjs. Jika jaringan sekolah memblokirnya, unduh `jspdf.umd.min.js` dan `qrcode.min.js` ke folder `lib/` lalu ubah alamat di `index.html`.

## Catatan kolom sheet Laporan
Judul laporan 1 ada di kolom **Judul Laporan 1** (kolom E), judul laporan 2 di kolom **Judul Laporan 2** (kolom terakhir/P). Kolom ini sengaja ditaruh di akhir agar susunan kolom lain tidak bergeser. Di Looker Studio, keduanya bisa dipakai sebagai dimensi terpisah.
