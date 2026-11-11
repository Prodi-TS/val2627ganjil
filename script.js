/* =====================================================
   Lembar Validasi Laporan Proyek – vanilla JS
   ===================================================== */

// >>> KONFIGURASI <<<
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwemt-9YNwUdm5ySApWvP9jBdJdfk12gyxGyK6IUx1LUDuHFkXa4ROpEw2TRe5LeZ4b-A/exec"; // URL Web App (berakhiran /exec)
const SCHOOL_NAME = "NAMA SEKOLAH";                            // tampil di kop PDF
const REPORT_LABELS = ["Laporan 1", "Laporan 2"];              // ubah, mis. ["Laporan Proyek", "Laporan Individu"]
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
  ["s-redirect", "s-nis", "s-confirm", "s-form", "s-result"].forEach((s) => ($(s).hidden = s !== id));
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
  const g = state.student.guru;
  $("lg1").textContent = REPORT_LABELS[0]; $("lg2").textContent = REPORT_LABELS[1];
  $("gt1").textContent = "Guru: " + g[0]; $("gt2").textContent = "Guru: " + g[1];
  show("s-form");
}
function resetAll() {
  const mode = state.mode;
  state = { nis: "", pin: "", student: null, record: null, up: {}, busy: false, mode };
  $("nisForm").reset(); $("repForm").reset(); $("btnSend").disabled = true; $("pinWrap").hidden = true; setErr("nisError", ""); setErr("formError", ""); show("s-nis");
}

/* ---------- Langkah 3: validasi, upload, kirim ---------- */
async function isPdf(file) { return (await file.slice(0, 5).text()) === "%PDF-"; }
function toBase64(file) {
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = () => no(new Error("Gagal membaca file.")); r.readAsDataURL(file); });
}
async function validateForm() {
  if (!$("agree").checked) return "Centang pernyataan bahwa laporan hanya bisa diunggah 1 kali.";
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
    state.record = d.record; showResult(false);
  } catch (ex) { setErr("formError", ex.message + " Kamu bisa menekan Kirim lagi (file yang sudah terunggah tidak diulang)."); }
  finally { state.busy = false; $("btnSend").disabled = !$("agree").checked; $("progress").hidden = true; }
}

/* ---------- Langkah 4: hasil (tautan, QR, PDF) ---------- */
function showResult(already) {
  const r = state.record;
  $("resultTitle").textContent = already ? "✅ Laporan sudah dikumpulkan" : "✅ Laporan terkumpul";
  $("resultInfo").innerHTML = `<dt>NIS</dt><dd>${esc(r.nis)}</dd><dt>Nama</dt><dd>${esc(r.nama)}</dd><dt>Kelas</dt><dd>${esc(r.kelas)}</dd><dt>Tanggal</dt><dd>${fmtDate(r.timestamp)}</dd>`;
  $("links").innerHTML = r.codes.map((c, i) => `<div class="link-card"><img alt="QR ${esc(REPORT_LABELS[i])}" src="${qrPng(shortUrl(c))}"><div><b>${esc(REPORT_LABELS[i])}</b><small>Judul: ${esc(r.judul[i])}</small><small>Guru: ${esc(r.guru[i])}</small><code>${esc(shortUrl(c))}</code><br><button type="button" data-copy="${i}">Salin tautan</button></div></div>`).join("");
  $("links").querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shortUrl(r.codes[b.dataset.copy])); toast("Tautan disalin ✓"); } catch (e) { toast("Salin manual dari teks tautan.", true); }
  }));
  show("s-result");
}

/* ---------- PDF lembar validasi (A4) ---------- */
function makePdf(r) {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 15, W = 180;
  doc.setFont("helvetica", "bold").setFontSize(12).text(SCHOOL_NAME, 105, 18, { align: "center" });
  doc.setFontSize(14).text("LEMBAR VALIDASI PENGUMPULAN LAPORAN PROYEK", 105, 26, { align: "center" });
  doc.setLineWidth(0.6).line(L, 30, L + W, 30);

  // Identitas siswa
  let y = 40;
  const row = (k, v) => {
    doc.setFont("helvetica", "normal").setFontSize(11).text(k, L, y); doc.text(":", L + 38, y);
    doc.setFont("helvetica", "bold"); const lines = doc.splitTextToSize(String(v), W - 44); doc.text(lines, L + 42, y); y += 6.5 * lines.length;
  };
  row("NIS", r.nis); row("Nama", r.nama); row("Kelas", r.kelas); row("Tanggal Pengumpulan", fmtDate(r.timestamp));

  // Dua blok laporan: QR di kiri, kotak tanda tangan guru di kanan
  const top = y + 6, blockH = 92;
  r.codes.forEach((code, i) => {
    const by = top + i * (blockH + 6), url = shortUrl(code);
    doc.setDrawColor(120).setLineWidth(0.3).rect(L, by, W, blockH);
    doc.setFont("helvetica", "bold").setFontSize(12).text(`${REPORT_LABELS[i]}`, L + 4, by + 8);
    doc.setFont("helvetica", "normal").setFontSize(10).text("Guru: " + r.guru[i], L + 4, by + 14);
    doc.setFont("helvetica", "bold").text(doc.splitTextToSize("Judul: " + r.judul[i], W - 8).slice(0, 2), L + 4, by + 20); // judul tiap laporan
    doc.setFont("helvetica", "normal");
    doc.addImage(qrPng(url, 400), "PNG", L + 4, by + 31, 44, 44);
    doc.setFontSize(8).text(doc.splitTextToSize(url, 58), L + 4, by + 79);
    doc.text("Pindai QR / buka tautan untuk melihat laporan", L + 4, by + 87);
    // kotak tanda tangan (kosong, ditandatangani basah setelah dicetak)
    const sx = L + 62, sw = W - 66;
    doc.setFontSize(10).text("Validasi Guru", sx, by + 33);
    doc.rect(sx, by + 36, sw, 34);
    doc.setFontSize(9).text("Tanda tangan", sx + 2, by + 40);
    doc.line(sx, by + 78, sx + sw * 0.7, by + 78);
    doc.setFontSize(9).text(`( ${r.guru[i]} )`, sx, by + 83);
    doc.text("Tanggal: ........................", sx, by + 89);
  });
  doc.setFontSize(8).setTextColor(100).text("Dokumen dibuat otomatis oleh sistem. Cetak dan minta tanda tangan guru yang bersangkutan.", 105, 289, { align: "center" });
  doc.save(`Lembar-Validasi_${r.nis}_${String(r.nama).replace(/\s+/g, "-")}.pdf`);
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
  $("agree").addEventListener("change", () => ($("btnSend").disabled = !$("agree").checked)); // tombol Kirim aktif setelah dicentang
  $("btnPdf").addEventListener("click", () => {
    try { makePdf(state.record); } catch (ex) { return toast("Gagal membuat PDF: " + ex.message, true); }
    post({ action: "pdf", nis: state.nis, pin: state.pin }).catch(() => {}); // catat unduhan untuk rekap walas (gagal pun tidak mengganggu)
  });
  $("btnDone").addEventListener("click", resetAll);
  window.addEventListener("hashchange", handleHash);
  handleHash();
}
init();
