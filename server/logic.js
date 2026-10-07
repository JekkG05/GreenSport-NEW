// Business logic murni (tanpa akses database) supaya mudah diuji (unit test / white-box).
const OPEN_HOUR = 8, CLOSE_HOUR = 22;          // jam operasional 08.00 - 22.00
const MIN_DURATION = 1, MAX_DURATION = 3;      // durasi booking (jam)
const CANCEL_LIMIT_HOURS = 3;                  // batal minimal 3 jam sebelum main
const METHODS = ['Transfer Bank', 'E-Wallet', 'QRIS'];

const clean = s => String(s ?? '').replace(/[<>]/g, '').trim();   // sanitasi sederhana
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const isPhone = p => /^08\d{8,11}$/.test(p);
const pad = n => String(n).padStart(2, '0');
const hourOf = t => parseInt(String(t).split(':')[0], 10);
const toDate = (date, time) => new Date(`${date}T${time}`);
const todayStr = (now = new Date()) => new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function validatePassword(p) {
  if (p.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/\d/.test(p))
    return 'Password harus mengandung huruf besar, huruf kecil, dan angka.';
  return null;
}

function validateLogin({ email, password }) {
  const e = {};
  if (!email) e.email = 'Email wajib diisi.';
  else if (!isEmail(email)) e.email = 'Format email tidak valid.';
  if (!password) e.password = 'Password wajib diisi.';
  return e;
}

function validateRegister(d) {
  const e = {};
  if (!d.name) e.name = 'Nama lengkap wajib diisi.';
  else if (d.name.length < 3) e.name = 'Nama minimal 3 karakter.';
  if (!d.email) e.email = 'Email wajib diisi.';
  else if (!isEmail(d.email)) e.email = 'Format email tidak valid.';
  if (!d.phone) e.phone = 'Nomor HP wajib diisi.';
  else if (!isPhone(d.phone)) e.phone = 'Nomor HP harus diawali 08 dan terdiri dari 10-13 digit.';
  const pe = d.password ? validatePassword(d.password) : 'Password wajib diisi.';
  if (pe) e.password = pe;
  if (!d.confirm) e.confirm = 'Konfirmasi password wajib diisi.';
  else if (d.confirm !== d.password) e.confirm = 'Konfirmasi password tidak sama.';
  return e;
}

// Mengembalikan pesan error (string) atau null jika input booking valid.
function validateBookingInput({ date, start_time, duration }, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || isNaN(new Date(date))) return 'Tanggal tidak valid.';
  if (!/^\d{2}:00$/.test(start_time || '')) return 'Jam mulai tidak valid.';
  const dur = Number(duration);
  if (!Number.isInteger(dur) || dur < MIN_DURATION || dur > MAX_DURATION)
    return `Durasi harus antara ${MIN_DURATION} sampai ${MAX_DURATION} jam.`;
  const h = hourOf(start_time);
  if (h < OPEN_HOUR || h + dur > CLOSE_HOUR)
    return `Jam booking harus berada dalam jam operasional (${pad(OPEN_HOUR)}.00 - ${CLOSE_HOUR}.00).`;
  if (toDate(date, start_time) <= now) return 'Tanggal dan jam booking tidak boleh di masa lalu.';
  return null;
}

const calcTotal = (pricePerHour, duration) => pricePerHour * duration;

// Dua rentang jam bentrok jika saling tumpang tindih.
const overlaps = (aStart, aDur, bStart, bDur) => aStart < bStart + bDur && bStart < aStart + aDur;

function buildSlots(booked, date, now = new Date()) {
  const slots = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    let status = 'Tersedia';
    if (booked.some(b => overlaps(h, 1, hourOf(b.start_time), b.duration))) status = 'Sudah Dibooking';
    else if (toDate(date, `${pad(h)}:00`) <= now) status = 'Lewat';
    slots.push({ hour: h, label: `${pad(h)}.00 - ${pad(h + 1)}.00`, status });
  }
  return slots;
}

function canCancel(b, now = new Date()) {
  if (b.booking_status === 'Selesai') return { ok: false, message: 'Booking yang sudah selesai tidak dapat dibatalkan.' };
  if (b.booking_status === 'Dibatalkan') return { ok: false, message: 'Booking ini sudah dibatalkan.' };
  const hoursLeft = (toDate(b.booking_date, b.start_time) - now) / 3600000;
  if (hoursLeft < CANCEL_LIMIT_HOURS)
    return { ok: false, message: `Pembatalan hanya bisa dilakukan minimal ${CANCEL_LIMIT_HOURS} jam sebelum jadwal main.` };
  return { ok: true };
}

function validatePayment(p) {
  const e = {};
  if (!METHODS.includes(p.method)) { e.method = 'Pilih metode pembayaran.'; return e; }
  if (p.method === 'Transfer Bank') {
    if (!p.bank) e.bank = 'Nama bank wajib diisi.';
    if (!p.account_name) e.account_name = 'Nama pemilik rekening wajib diisi.';
    if (!p.proof) e.proof = 'Bukti transfer wajib diunggah.';
  } else if (p.method === 'E-Wallet') {
    if (!p.wallet) e.wallet = 'Pilih e-wallet.';
    if (!isPhone(p.wallet_phone || '')) e.wallet_phone = 'Nomor e-wallet tidak valid (contoh 081234567890).';
  }
  return e; // QRIS tidak butuh data tambahan
}

const SPORTS = ['Futsal', 'Badminton', 'Basket', 'Tenis'];
const MIN_PRICE = 10000, MAX_PRICE = 1000000;

// Validasi data lapangan (dipakai admin saat tambah/ubah lapangan).
function validateCourt(c) {
  const e = {};
  if (!c.name) e.name = 'Nama lapangan wajib diisi.';
  else if (c.name.length < 3) e.name = 'Nama minimal 3 karakter.';
  if (!SPORTS.includes(c.sport_type)) e.sport_type = 'Pilih jenis olahraga.';
  if (!c.location) e.location = 'Lokasi wajib diisi.';
  if (!Number.isInteger(c.price_per_hour)) e.price_per_hour = 'Harga harus berupa angka bulat.';
  else if (c.price_per_hour < MIN_PRICE || c.price_per_hour > MAX_PRICE) e.price_per_hour = 'Harga harus antara Rp10.000 dan Rp1.000.000 per jam.';
  if (!['Tersedia', 'Tidak Tersedia'].includes(c.status)) e.status = 'Pilih status lapangan.';
  return e;
}

module.exports = { validateCourt, SPORTS, OPEN_HOUR, CLOSE_HOUR, METHODS, clean, isEmail, isPhone, validatePassword, validateLogin,
  validateRegister, validateBookingInput, calcTotal, overlaps, buildSlots, canCancel, validatePayment, todayStr, pad };
