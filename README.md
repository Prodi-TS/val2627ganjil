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

Program Studi, Konsentrasi Keahlian, dan semester (kelas X = 1, XI = 3, XII = 5) otomatis dibaca dari nama kelas lewat fungsi `kelasInfo` di `script.js` (kata kunci TRANSMISI, TJAT, TKJ, RPL, DKV). Tahun ajaran diatur di `TAHUN_AJARAN`.
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

## Unduh ulang lembar validasi
Tidak ada halaman terpisah. Siswa yang sudah pernah mengumpulkan cukup memasukkan NIS (+PIN) di **Kumpulkan Laporan**: situs langsung menampilkan hasil sebelumnya (shortlink, QR) beserta tombol **Unduh PDF**, dan tombol Revisi jika perlu unggah ulang. Tanggal di PDF tetap tanggal pengumpulan asli.

## Rekap untuk wali kelas
1. Setelah Code.gs terpasang, **muat ulang spreadsheet**. Muncul menu **Validasi Laporan → Bangun / perbarui rekap** (pertama kali akan meminta izin). Jalankan setiap daftar siswa berubah.
2. Dua sheet dibuat otomatis:
   - **Rekap**: satu baris per siswa (NIS, nama, kelas, guru, **Status Pengumpulan**, tanggal kumpul, **Status PDF**, jumlah unduh). Merah = belum, hijau = sudah. Ada filter, jadi walas tinggal memfilter kolom Kelas.
   - **Rekap Kelas**: per kelas, berisi jumlah siswa, sudah/belum mengumpulkan, persentase, dan jumlah yang sudah mengunduh PDF.
3. Setelah itu rekap **ikut berubah sendiri** setiap ada siswa yang mengumpulkan atau mengunduh PDF.
4. **Jangan bagikan spreadsheet utama ke walas**, karena sheet Siswa berisi PIN. Cara aman: buat spreadsheet baru, isi sel A1 dengan `=IMPORTRANGE("URL-spreadsheet-utama","Rekap!A:I")` (klik *Allow access*), lalu bagikan spreadsheet baru itu ke walas sebagai *Viewer*. Bisa juga dibuat dashboard Looker Studio dari sheet Rekap dengan filter Kelas.

"Status PDF" = siswa sudah menekan tombol Unduh PDF. Sistem tidak bisa mengetahui apakah PDF sudah dicetak atau ditandatangani guru.

## Halaman "Rekap Guru" (dengan password)
Menu ketiga di bagian atas situs. Guru memasukkan password, lalu melihat:
- kartu per kelas: jumlah siswa yang **sudah** dan **belum** mengumpulkan beserta persentasenya (klik kartu untuk menyaring kelas);
- daftar siswa per kelas dengan status Sudah/Belum (yang belum tampil paling atas), filter status, dan pencarian nama/NIS;
- tombol **Salin daftar yang belum mengumpulkan** (siap ditempel ke grup WhatsApp kelas).

**Mengatur password:** buka spreadsheet → menu **Validasi Laporan → Atur password guru** → isi password (minimal 6 karakter). Jalankan lagi untuk mengganti password.

Keamanan:
- Password tidak ada di kode maupun di GitHub. Server hanya menyimpan hash-nya di Script Properties, dan pemeriksaan dilakukan di server.
- Password hanya ada di memori halaman; berpindah menu, menekan *Keluar*, atau menutup tab membuatnya hilang.
- Ada satu password untuk semua guru, dan password itu membuka data **semua kelas**.
- Setelah 10 kali salah, halaman rekap terkunci 10 menit (untuk semua orang, karena Apps Script tidak bisa mengenali alamat pengguna).
- Jangan bagikan password ke siswa. Siapa pun yang tahu password bisa melihat nama dan status siswa.

## Akun admin
Website tidak punya login admin. "Admin" adalah akun Google yang memiliki spreadsheet dan men-deploy Apps Script. Akun itu yang membuka menu *Validasi Laporan* di spreadsheet, menjalankan Web App (*Execute as: Me*), dan menjadi pemilik folder PDF di Drive. Pastikan spreadsheet, script, dan deployment memakai akun yang sama.

## Unggah ulang (revisi) dan riwayat kiriman
- Petunjuk di web: **upload cukup 1 kali**; unggah ulang hanya jika perlu revisi, supaya data tidak menumpuk. Meski begitu, siswa **tetap bisa mengunggah ulang** lewat menu *Kumpulkan Laporan* (atau tombol **Revisi (unggah ulang)** di halaman hasil). Judul sebelumnya terisi otomatis.
- Setiap kiriman **menambah satu baris** di sheet **Laporan** (riwayat, tidak ada yang dihapus). Kolom **Versi** menunjukkan urutan kiriman siswa itu.
- **Yang dipakai selalu kiriman terbaru** (berdasarkan Timestamp, jadi aman walau barisnya diurutkan ulang): tampilan hasil pengumpulan, PDF lembar validasi, sheet Rekap, Rekap Kelas, dan halaman Rekap Guru.
- Sheet **Rekap** memiliki kolom **Jumlah Pengumpulan** (berapa kali siswa mengirim), dan halaman Rekap Guru memberi tanda `v2`, `v3`, dst. untuk siswa yang pernah merevisi.
- Shortlink dan QR **lama tetap membuka file lama** (arsip), sedangkan kiriman baru mendapat kode baru. Jadi lembar validasi yang sudah ditandatangani guru tetap menunjuk file yang saat itu dinilai. Setelah revisi, siswa perlu **mencetak ulang lembar validasi** dan meminta tanda tangan guru lagi.
- File PDF semua versi tetap ada di folder Drive siswa (nama file memuat tanggal dan jam kiriman).
- Untuk Looker Studio: sheet **Laporan** berisi semua versi. Pakai sheet **Rekap** (satu baris per siswa, kiriman terbaru), atau saring Laporan agar hanya mengambil versi terbaru.

## Catatan
- Batas 10 MB per PDF (ubah `MAX_BYTES` di Code.gs dan `MAX_MB` di script.js).
- Kuota Drive: 1.400 PDF × 5 MB ≈ 7 GB. Pakai akun yang kuotanya cukup.
- Jika Workspace sekolah melarang berbagi publik, script otomatis memakai akses "siapa saja di domain"; QR hanya terbuka untuk akun sekolah.
- NIS tanpa PIN mudah ditebak. Isi kolom PIN untuk keamanan lebih.
- Apps Script melayani sekitar 30 permintaan bersamaan. Jadwalkan pengumpulan per kelas.
- Library PDF/QR dimuat dari cdnjs. Jika jaringan sekolah memblokirnya, unduh `jspdf.umd.min.js` dan `qrcode.min.js` ke folder `lib/` lalu ubah alamat di `index.html`.

## Catatan kolom sheet Laporan
Judul laporan 1 ada di kolom **Judul Laporan 1** (kolom E), judul laporan 2 di kolom **Judul Laporan 2** (kolom P), dan nomor kiriman di kolom **Versi** (kolom Q). Kolom ini sengaja ditaruh di akhir agar susunan kolom lain tidak bergeser. Di Looker Studio, keduanya bisa dipakai sebagai dimensi terpisah.

## Rekap Guru: dua tampilan
Di halaman Rekap Guru ada pilihan **Per kelas (walas)** dan **Per guru Proyek 2**. Tampilan kelas menampilkan guru Proyek 1 di tiap kartu kelas (dianggap sama dalam satu kelas). Tampilan guru Proyek 2 mengelompokkan siswa berdasarkan kolom *Guru Laporan 2*, lengkap dengan kelasnya. Tombol salin daftar yang belum mengumpulkan mengikuti tampilan dan pilihan yang aktif. Perlu deploy ulang `Code.gs` (New version).

Pada tampilan **Per guru Proyek 2** ada filter **Tema** (dari kolom G sheet Siswa, "Tema Proyek Rekayasa Teknologi"). Kartu guru, daftar siswa, dan tombol salin ikut menyesuaikan tema yang dipilih, berguna bila satu guru mengajar beda jenjang atau tema. Siswa tanpa tema tampil sebagai "Tanpa tema". Perlu deploy ulang `Code.gs`.

## Lampiran portofolio (opsional)
Di formulir, di bawah Laporan Proyek 2, ada pertanyaan **"Apakah kamu ingin upload lampiran portofolio?"** dengan pilihan **Ya / Tidak**. Siswa wajib memilih salah satu.
- **Ya:** kolom unggah PDF lampiran muncul (maks. 10 MB). Di lembar validasi, blok Laporan Proyek 2 mendapat kolom tambahan berisi QR dan tautan "Lampiran Portofolio" di samping QR laporan. Kotak tanda tangan menyempit menyesuaikan.
- **Tidak:** tidak ada unggahan tambahan. Tampilan lembar tetap seperti semula dan tertulis **Lampiran Portofolio : -** di blok Laporan Proyek 2.
- **Revisi:** jika sebelumnya ada lampiran, pilihan Ya terpilih otomatis dan lampiran lama tetap dipakai kecuali siswa memilih file baru. Memilih **Tidak** membuang lampiran dari kiriman terbaru.
- **Sheet Laporan:** tiga kolom baru di paling kanan (`Link Lampiran`, `Kode Lampiran`, `File ID Lampiran`) ditambahkan otomatis. Perlu deploy ulang `Code.gs` (New version).
