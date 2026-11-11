/* =====================================================
   Lembar Validasi Laporan Proyek – vanilla JS
   ===================================================== */

// >>> KONFIGURASI <<<
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwemt-9YNwUdm5ySApWvP9jBdJdfk12gyxGyK6IUx1LUDuHFkXa4ROpEw2TRe5LeZ4b-A/exec"; // URL Web App (berakhiran /exec)
const SCHOOL_NAME = "SMK TELKOM JAKARTA";                   // tampil di kop PDF
const TAHUN_AJARAN = "2026/2027";                               // tampil di lembar validasi
const REPORT_LABELS = ["Laporan Proyek 1", "Laporan Proyek 2"];              // ubah, mis. ["Laporan Proyek", "Laporan Individu"]
const MAX_MB = 10;                                             // harus sama dengan MAX_BYTES di Code.gs

/* ---------- Helper ---------- */
const $ = (id) => document.getElementById(id);
const isConfigured = () => GOOGLE_APPS_SCRIPT_URL && !GOOGLE_APPS_SCRIPT_URL.startsWith("YOUR_");
const SHORT_BASE = () => location.href.split("#")[0];
const shortUrl = (code) => SHORT_BASE() + "#/" + code;
const fmtDate = (iso) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let state = { nis: "", pin: "", student: null, record: null, up: {}, busy: false, mode: "submit" }; // mode: submit | report

let toastTimer;
function toast(msg, isErr) {
  const t = $("toast"); t.textContent = msg; t.hidden = false; t.classList.toggle("err", !!isErr);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 4000);
}
function show(id) {
  ["s-redirect", "s-nis", "s-confirm", "s-form", "s-result", "s-guru"].forEach((s) => ($(s).hidden = s !== id));
  window.scrollTo(0, 0);
}
function setErr(id, msg) { $(id).hidden = !msg; $(id).textContent = msg || ""; }

/* ---------- API ---------- */
async function api(url, opts) {
  let text;
  try { text = await (await fetch(url, opts)).text(); }
  catch (e) { throw new Error("Tidak bisa terhubung ke server. Cek koneksi internet."); }
  try { return JSON.parse(text); }
  catch (e) { throw new Error("Server mengirim halaman HTML, bukan data. Cek deployment Apps Script (akses 'Anyone' + New version)."); }
}
// text/plain menghindari preflight CORS yang tidak didukung Apps Script
const post = (body) => api(GOOGLE_APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });

/* ---------- QR (digambar ke canvas -> PNG, dipakai di layar & PDF) ---------- */
function qrPng(text, size = 320) {
  const qr = qrcode(0, "M"); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), quiet = 4, scale = Math.max(2, Math.floor(size / (n + quiet * 2)));
  const px = (n + quiet * 2) * scale, c = document.createElement("canvas"); c.width = c.height = px;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, px, px); g.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect((k + quiet) * scale, (r + quiet) * scale, scale, scale);
  return c.toDataURL("image/png");
}

/* ---------- Menu: Kumpulkan Laporan / Laporan Saya ---------- */
function setMode(m) {
  if (state.busy) return;
  state.mode = m;
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
  $("nisTitle").textContent = m === "report" ? "Laporan Saya" : "Masukkan NIS";
  $("nisWarn").hidden = m === "report";
  $("nisHint").textContent = m === "report" ? "Masukkan NIS untuk melihat laporan yang sudah dikumpulkan dan mengunduh ulang lembar validasi." : "";
  resetAll();
  if (m === "guru") guruReset();
}

/* ---------- Langkah 1: NIS ---------- */
async function onNis(e) {
  e.preventDefault();
  if (state.busy) return;
  const nis = $("nis").value.trim(), pin = $("pin").value.trim();
  setErr("nisError", "");
  if (!/^\d{3,}$/.test(nis)) return setErr("nisError", "NIS harus berupa angka.");
  if (!isConfigured()) return setErr("nisError", "GOOGLE_APPS_SCRIPT_URL belum diisi di script.js.");
  state.busy = true; $("btnNis").disabled = true; $("btnNis").textContent = "Memeriksa…";
  try {
    const d = await post({ action: "lookup", nis, pin });
    if (d.needPin && !d.student) { $("pinWrap").hidden = false; $("pin").focus(); if (d.error) setErr("nisError", d.error); else setErr("nisError", "Masukkan PIN dari guru."); return; }
    if (!d.success) return setErr("nisError", d.error || "Gagal.");
    state.nis = nis; state.pin = pin; state.student = d.student;
    $("confirmInfo").innerHTML = `<dt>NIS</dt><dd>${esc(d.student.nis)}</dd><dt>Nama</dt><dd>${esc(d.student.nama)}</dd><dt>Kelas</dt><dd>${esc(d.student.kelas)}</dd><dt>${esc(REPORT_LABELS[0])}</dt><dd>${esc(d.student.guru[0])}</dd><dt>${esc(REPORT_LABELS[1])}</dt><dd>${esc(d.student.guru[1])}</dd>`;
    if (state.mode === "report") {            // halaman "Laporan Saya": hanya menampilkan & unduh ulang
      if (!d.submitted) return setErr("nisError", "Belum ada laporan yang terkumpul atas NIS ini. Buka menu 'Kumpulkan Laporan'.");
      state.record = d.record; return showResult(true);
    }
    if (d.submitted) { state.record = d.record; showResult(true); } else show("s-confirm");
  } catch (ex) { setErr("nisError", ex.message); }
  finally { state.busy = false; $("btnNis").disabled = false; $("btnNis").textContent = "Lanjut"; }
}

/* ---------- Langkah 2: konfirmasi -> form ---------- */
function onYes() {
  const g = state.student.guru, r = state.record;   // r ada jika siswa sudah pernah mengumpulkan (revisi)
  $("repForm").reset(); setErr("formError", "");
  if (r) { $("judul1").value = r.judul[0] || ""; $("judul2").value = r.judul[1] || ""; }
  $("reviseNote").hidden = !r;
  if (r) $("reviseNote").textContent = `Kamu sudah mengumpulkan pada ${fmtDate(r.timestamp)} (versi ${r.versi || 1}). Gunakan unggah ulang hanya untuk revisi; kiriman baru akan menjadi versi terbaru.`;
  $("lg1").textContent = REPORT_LABELS[0]; $("lg2").textContent = REPORT_LABELS[1];
  $("gt1").textContent = "Guru: " + g[0]; $("gt2").textContent = "Guru: " + g[1];
  const tema = String((state.student && state.student.tema) || "").trim();   // tema dari kolom G sheet Siswa
  $("tema2").hidden = !tema || tema.startsWith("(");
  $("tema2").innerHTML = `💡 Tema proyek kamu: <b>${esc(tema)}</b>. Pastikan laporan dan judul sesuai tema ini.`;
  show("s-form");
}
function resetAll() {
  const mode = state.mode;
  state = { nis: "", pin: "", student: null, record: null, up: {}, busy: false, mode };
  $("nisForm").reset(); $("repForm").reset(); $("pinWrap").hidden = true; setErr("nisError", ""); setErr("formError", ""); show("s-nis");
}

/* ---------- Langkah 3: validasi, upload, kirim ---------- */
async function isPdf(file) { return (await file.slice(0, 5).text()) === "%PDF-"; }
function toBase64(file) {
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = () => no(new Error("Gagal membaca file.")); r.readAsDataURL(file); });
}
async function validateForm() {
  for (const n of [1, 2]) {
    if ($("judul" + n).value.trim().length < 5) return `Judul ${REPORT_LABELS[n - 1]} minimal 5 karakter.`;
    const f = $("file" + n).files[0];
    if (!f) return `Pilih file PDF untuk ${REPORT_LABELS[n - 1]}.`;
    if (f.size > MAX_MB * 1024 * 1024) return `${REPORT_LABELS[n - 1]} lebih dari ${MAX_MB} MB.`;
    if (!(await isPdf(f))) return `${REPORT_LABELS[n - 1]} bukan file PDF yang valid.`;
  }
  if ($("file1").files[0].name === $("file2").files[0].name && $("file1").files[0].size === $("file2").files[0].size) return "File laporan 1 dan 2 tampaknya sama. Pilih dua file berbeda.";
  return "";
}
async function onSend(e) {
  e.preventDefault();
  if (state.busy) return;
  setErr("formError", "");
  const err = await validateForm();
  if (err) return setErr("formError", err);

  state.busy = true; $("btnSend").disabled = true; $("progress").hidden = false;
  try {
    for (const n of [1, 2]) {
      const f = $("file" + n).files[0];
      if (state.up[n] && state.up[n].file === f) continue; // sudah terunggah (saat coba ulang)
      $("progress").textContent = `Mengunggah ${REPORT_LABELS[n - 1]} (${n}/2)…`;
      const d = await post({ action: "upload", nis: state.nis, pin: state.pin, part: n, judul: $("judul" + n).value.trim(), data: await toBase64(f) });
      if (!d.success) throw new Error(d.error || "Upload gagal.");
      state.up[n] = { file: f, id: d.fileId };
    }
    $("progress").textContent = "Menyimpan data…";
    const d = await post({ action: "submit", nis: state.nis, pin: state.pin, judul1: $("judul1").value.trim(), judul2: $("judul2").value.trim(), fileId1: state.up[1].id, fileId2: state.up[2].id });
    if (!d.success) throw new Error(d.error || "Gagal menyimpan.");
    state.record = d.record; state.up = {}; showResult(false);
  } catch (ex) { setErr("formError", ex.message + " Kamu bisa menekan Kirim lagi (file yang sudah terunggah tidak diulang)."); }
  finally { state.busy = false; $("btnSend").disabled = false; $("progress").hidden = true; }
}

/* ---------- Langkah 4: hasil (tautan, QR, PDF) ---------- */
function showResult(already) {
  const r = state.record;
  $("resultTitle").textContent = already ? "✅ Laporan sudah dikumpulkan" : "✅ Laporan terkumpul";
  $("resultInfo").innerHTML = `<dt>NIS</dt><dd>${esc(r.nis)}</dd><dt>Nama</dt><dd>${esc(r.nama)}</dd><dt>Kelas</dt><dd>${esc(r.kelas)}</dd><dt>Tanggal</dt><dd>${fmtDate(r.timestamp)}</dd><dt>Versi kiriman</dt><dd>${r.versi || 1}</dd>`;
  $("links").innerHTML = r.codes.map((c, i) => `<div class="link-card"><img alt="QR ${esc(REPORT_LABELS[i])}" src="${qrPng(shortUrl(c))}"><div><b>${esc(REPORT_LABELS[i])}</b><small>Judul: ${esc(r.judul[i])}</small><small>Guru: ${esc(r.guru[i])}</small><code>${esc(shortUrl(c))}</code><br><button type="button" data-copy="${i}">Salin tautan</button></div></div>`).join("");
  $("links").querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shortUrl(r.codes[b.dataset.copy])); toast("Tautan disalin ✓"); } catch (e) { toast("Salin manual dari teks tautan.", true); }
  }));
  show("s-result");
}

/* ---------- PDF lembar validasi (A4) ---------- */
// Program Studi, Konsentrasi Keahlian, dan semester diprogram dari nama kelas (tidak disimpan di sheet)
function kelasInfo(kelas) {
  const k = String(kelas || "").toUpperCase(), TJKT = "TEKNIK JARINGAN KOMPUTER DAN TELEKOMUNIKASI";
  let p = { prodi: "", konsentrasi: "" };
  if (/\bTRANSMISI\b/.test(k)) p = { prodi: TJKT, konsentrasi: "Teknik Transmisi Telekomunikasi" };
  else if (/\bTJAT\b/.test(k)) p = { prodi: TJKT, konsentrasi: "Teknik Jaringan Akses Telekomunikasi" };
  else if (/\bTKJ\b/.test(k)) p = { prodi: TJKT, konsentrasi: "Teknik Komputer dan Jaringan" };
  else if (/\bRPL\b/.test(k)) p = { prodi: "PENGEMBANGAN PERANGKAT LUNAK DAN GIM", konsentrasi: "Rekayasa Perangkat Lunak" };
  else if (/\bDKV\b/.test(k)) p = { prodi: "DESAIN KOMUNIKASI VISUAL", konsentrasi: "Desain Komunikasi Visual" };
  const kaprodi = { TJKT: "Assa Kesthy Rohana, S.Pd., Gr.", PPLG: "Adythia Esha Nugraha, S.Kom., Gr.", DKV: "Aditya Wardana, S.Kom., Gr." };
  p.kaprodi = p.prodi === TJKT ? kaprodi.TJKT : p.prodi.startsWith("PENGEMBANGAN") ? kaprodi.PPLG : p.prodi.startsWith("DESAIN") ? kaprodi.DKV : "";
  const t = /^\s*XII\b/.test(k) ? "5 (lima)" : /^\s*XI\b/.test(k) ? "3 (tiga)" : /^\s*X\b/.test(k) ? "1 (satu)" : "";
  return Object.assign(p, { semester: t });
}

function makePdf(r) {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 15, W = 180, info = kelasInfo(r.kelas);
  // Kop mengikuti contoh sekolah
  try { if (typeof LOGO_DATA !== "undefined") doc.addImage(LOGO_DATA, "PNG", L, 6, 21, 21 * LOGO_RATIO); } catch (e) {}   // logo kiri atas
  doc.setFont("helvetica", "bold").setFontSize(12).text(SCHOOL_NAME, 105, 16, { align: "center" });
  doc.setFontSize(15).text("LEMBAR VALIDASI PROYEK", 105, 24, { align: "center" });
  doc.setLineWidth(0.6).line(L, 28, L + W, 28);
  doc.setFont("helvetica", "normal").setFontSize(10.5).text("Laporan proyek yang disusun oleh:", L, 36);
  let y = 43;
  const row = (k, v) => {
    doc.setFont("helvetica", "normal").setFontSize(10.5).text(k, L, y); doc.text(":", L + 40, y);
    doc.setFont("helvetica", "bold"); const lines = doc.splitTextToSize(String(v || "-"), W - 46); doc.text(lines, L + 44, y); y += 5.8 * lines.length;
  };
  row("NAMA", r.nama); row("KELAS", r.kelas); row("NIS", r.nis);
  row("Program Studi", info.prodi); row("Konsentrasi Keahlian", String(info.konsentrasi).toUpperCase());
  doc.setFont("helvetica", "normal").setFontSize(10.5);
  y += 1; doc.text(`pada semester ${info.semester || "-"} tahun ajaran ${TAHUN_AJARAN} dengan rincian sebagai berikut:`, L, y);

  // Dua blok laporan: QR di kiri, kotak tanda tangan guru di kanan
  const top = y + 6, blockH = 74;
  r.codes.forEach((code, i) => {
    const by = top + i * (blockH + 5), url = shortUrl(code);
    doc.setDrawColor(120).setLineWidth(0.3).rect(L, by, W, blockH);
    doc.setFont("helvetica", "bold").setFontSize(12).text(`${REPORT_LABELS[i]}`, L + 4, by + 8);
    const tema = String((state.student && state.student.tema) || "").trim();   // tema proyek (kolom G sheet Siswa) di blok Laporan Proyek 2
    if (i === 1 && tema && !tema.startsWith("(")) doc.setFont("helvetica", "normal").setFontSize(9).text(doc.splitTextToSize("Tema: " + tema, 100).slice(0, 1), L + W - 4, by + 8, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(10).text("Guru: " + r.guru[i], L + 4, by + 14);
    doc.setFont("helvetica", "bold").text(doc.splitTextToSize("Judul: " + r.judul[i], W - 8).slice(0, 2), L + 4, by + 20);
    doc.setFont("helvetica", "normal");
    doc.addImage(qrPng(url, 400), "PNG", L + 4, by + 28, 34, 34);
    doc.setFontSize(7.5).text(doc.splitTextToSize(url, 58), L + 4, by + 65);
    doc.setFontSize(7).text("Pindai QR / buka tautan untuk melihat laporan", L + 4, by + 71);
    const sx = L + 62, sw = W - 66;
    doc.setFontSize(10).text("Validasi Guru", sx, by + 29);
    doc.rect(sx, by + 31, sw, 24);
    doc.setFontSize(9).text("Tanda tangan", sx + 2, by + 35);
    doc.line(sx, by + 61, sx + sw * 0.7, by + 61);
    doc.text(`( ${r.guru[i]} )`, sx, by + 66);
    doc.text("Tanggal: ........................", sx, by + 71);
  });

  // Validasi Kepala Program Studi (tanpa QR)
  const ky = top + 2 * (blockH + 5), kh = 38;
  doc.setDrawColor(120).setLineWidth(0.3).rect(L, ky, W, kh);
  doc.setFont("helvetica", "bold").setFontSize(12).text("Validasi Kepala Program Studi", L + 4, ky + 8);
  doc.setFont("helvetica", "normal").setFontSize(9).text(doc.splitTextToSize(info.prodi || "-", 56), L + 4, ky + 14);
  const kx = L + 62, kw = W - 66;
  doc.rect(kx, ky + 3, kw, 20);
  doc.setFontSize(9).text("Tanda tangan", kx + 2, ky + 7);
  doc.line(kx, ky + 29, kx + kw * 0.7, ky + 29);
  doc.text(`( ${info.kaprodi || "Kepala Program Studi"} )`, kx, ky + 33);
  doc.text("Tanggal: ........................", kx, ky + 37);
  doc.setFontSize(8).setTextColor(100).text("Dokumen dibuat otomatis oleh sistem. Cetak dan minta tanda tangan guru yang bersangkutan.", 105, 289, { align: "center" });
  doc.save(`Lembar-Validasi_${r.nis}_${String(r.nama).replace(/\s+/g, "-")}.pdf`);
}

/* ---------- Rekap Guru (dilindungi password) ---------- */
// Password hanya disimpan di memori halaman ini (hilang saat tab ditutup/diganti) dan diperiksa di server.
function guruReset() {
  state.gpw = ""; state.rekap = null;
  $("guruForm").reset(); setErr("guruError", "");
  $("guruLoginBox").hidden = false; $("rekapBox").hidden = true; show("s-guru");
}
async function loadRekap(pw) {
  const d = await post({ action: "report", password: pw });
  if (!d.success) throw new Error(d.error || "Gagal memuat rekap.");
  state.rekap = d; state.gpw = pw; renderRekap();
}
async function onGuru(e) {
  e.preventDefault();
  if (state.busy) return;
  const pw = $("gpw").value;
  setErr("guruError", "");
  if (!pw) return setErr("guruError", "Masukkan password.");
  if (!isConfigured()) return setErr("guruError", "GOOGLE_APPS_SCRIPT_URL belum diisi di script.js.");
  state.busy = true; $("btnGuru").disabled = true; $("btnGuru").textContent = "Memeriksa…";
  try { await loadRekap(pw); } catch (ex) { setErr("guruError", ex.message); }
  finally { state.busy = false; $("btnGuru").disabled = false; $("btnGuru").textContent = "Lihat rekap"; }
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
function renderRekap() {
  const d = state.rekap, sel = $("gKelas").value;
  $("guruLoginBox").hidden = true; $("rekapBox").hidden = false;
  $("rekapTime").textContent = "Diperbarui: " + new Date(d.generatedAt).toLocaleString("id-ID");
  const all = d.classes.reduce((a, c) => ({ kelas: "Semua kelas", total: a.total + c.total, sudah: a.sudah + c.sudah, belum: a.belum + c.belum }), { total: 0, sudah: 0, belum: 0 });
  const card = (c, key) => `<button type="button" class="class-card${sel === key ? " on" : ""}" data-k="${esc(key)}"><b>${esc(c.kelas)}</b><span>${c.sudah} dari ${c.total} sudah</span><i class="bar"><i style="width:${pct(c.sudah, c.total)}%"></i></i><small>${c.belum} belum · ${pct(c.sudah, c.total)}%</small></button>`;
  $("classCards").innerHTML = card(all, "") + d.classes.map((c) => card(c, c.kelas)).join("");
  $("classCards").querySelectorAll(".class-card").forEach((b) => b.addEventListener("click", () => { $("gKelas").value = b.dataset.k; renderRekap(); }));
  $("gKelas").innerHTML = `<option value="">Semua kelas</option>` + d.classes.map((c) => `<option>${esc(c.kelas)}</option>`).join("");
  $("gKelas").value = d.classes.some((c) => c.kelas === sel) ? sel : "";
  renderRekapList();
}
function filteredRekap() {
  const k = $("gKelas").value, st = $("gStatus").value, q = $("gSearch").value.trim().toLowerCase();
  return state.rekap.students
    .filter((s) => (!k || s.kelas === k) && (!st || (st === "sudah") === s.sudah) && (!q || (s.nama + " " + s.nis).toLowerCase().includes(q)))
    .sort((a, b) => a.sudah - b.sudah || a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama)); // yang belum di atas
}
function renderRekapList() {
  const rows = filteredRekap();
  $("gCount").textContent = `${rows.length} siswa ditampilkan`;
  $("gList").innerHTML = rows.length
    ? rows.map((s) => `<li><span><b>${esc(s.nama)}</b><small>${esc(s.kelas)} · ${esc(s.nis)}</small></span><span class="badge ${s.sudah ? "ok" : "no"}">${s.sudah ? "Sudah" + (s.pdf ? " · PDF ✓" : "") + (s.versi > 1 ? " · v" + s.versi : "") : "Belum"}</span></li>`).join("")
    : `<li><span class="hint">Tidak ada siswa yang cocok.</span></li>`;
}
function belumText() {
  const k = $("gKelas").value;
  const rows = state.rekap.students.filter((s) => !s.sudah && (!k || s.kelas === k)).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  return `Belum mengumpulkan laporan ${k || "(semua kelas)"}: ${rows.length} siswa\n` + rows.map((s, i) => `${i + 1}. ${s.nama}${k ? "" : " (" + s.kelas + ")"}`).join("\n");
}

/* ---------- Shortlink (#/KODE) -> alihkan ke Drive ---------- */
async function handleHash() {
  const m = location.hash.match(/^#\/([A-Za-z0-9]{6})$/);
  if (!m) return false;
  show("s-redirect");
  try {
    const d = await api(GOOGLE_APPS_SCRIPT_URL + "?action=resolve&code=" + m[1].toUpperCase());
    if (!d.success) throw new Error(d.error);
    location.replace(d.url);
  } catch (ex) { $("redirectMsg").textContent = "Tautan tidak ditemukan atau server bermasalah: " + ex.message; }
  return true;
}

/* ---------- Inisialisasi ---------- */
function init() {
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  $("nisForm").addEventListener("submit", onNis);
  $("btnYes").addEventListener("click", onYes);
  $("btnNotMe").addEventListener("click", resetAll);
  $("repForm").addEventListener("submit", onSend);
  $("btnPdf").addEventListener("click", () => {
    try { makePdf(state.record); } catch (ex) { return toast("Gagal membuat PDF: " + ex.message, true); }
    post({ action: "pdf", nis: state.nis, pin: state.pin }).catch(() => {}); // catat unduhan untuk rekap walas (gagal pun tidak mengganggu)
  });
  $("btnDone").addEventListener("click", resetAll);
  $("btnRevise").addEventListener("click", onYes);
  $("guruForm").addEventListener("submit", onGuru);
  $("btnLogout").addEventListener("click", guruReset);
  $("btnRefresh").addEventListener("click", async () => { try { await loadRekap(state.gpw); toast("Rekap diperbarui ✓"); } catch (ex) { toast(ex.message, true); } });
  ["gKelas", "gStatus"].forEach((id) => $(id).addEventListener("change", renderRekap));
  $("gSearch").addEventListener("input", renderRekapList);
  $("btnCopyBelum").addEventListener("click", async () => { try { await navigator.clipboard.writeText(belumText()); toast("Daftar disalin ✓"); } catch (e) { toast("Gagal menyalin. Salin manual dari daftar.", true); } });
  window.addEventListener("hashchange", handleHash);
  handleHash();
}
init();
