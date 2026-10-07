// Server Express: API + file frontend statis.
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const L = require('./logic');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const sessions = new Map();   // token login -> user id
const resets = new Map();     // token reset password -> user id (simulasi pengganti email)
const fail = (res, code, message, errors) => res.status(code).json({ message, errors });
const ACTIVE = "('Menunggu Pembayaran','Menunggu Konfirmasi','Dikonfirmasi')";

// Middleware: endpoint yang memakai ini wajib login.
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const uid = sessions.get(token);
  if (!uid) return fail(res, 401, 'Silakan login terlebih dahulu.');
  req.token = token;
  req.user = db.prepare('SELECT id,name,email,phone,role FROM users WHERE id=?').get(uid);
  next();
}

// ---------- AUTH ----------
app.post('/api/auth/register', (req, res) => {
  const d = { name: L.clean(req.body.name), email: L.clean(req.body.email).toLowerCase(), phone: L.clean(req.body.phone),
    password: String(req.body.password || ''), confirm: String(req.body.confirm || '') };
  const errors = L.validateRegister(d);
  if (!errors.email && db.prepare('SELECT 1 FROM users WHERE email=?').get(d.email)) errors.email = 'Email sudah terdaftar.';
  if (Object.keys(errors).length) return fail(res, 400, 'Data pendaftaran belum valid.', errors);
  db.prepare('INSERT INTO users(name,email,phone,password) VALUES(?,?,?,?)')
    .run(d.name, d.email, d.phone, bcrypt.hashSync(d.password, 10));
  res.status(201).json({ message: 'Akun berhasil dibuat. Silakan login.' });
});

app.post('/api/auth/login', (req, res) => {
  const email = L.clean(req.body.email).toLowerCase(), password = String(req.body.password || '');
  const errors = L.validateLogin({ email, password });
  if (Object.keys(errors).length) return fail(res, 400, 'Data login belum valid.', errors);
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return fail(res, 401, 'Email atau password yang kamu masukkan tidak sesuai.');
  const token = crypto.randomUUID();
  sessions.set(token, user.id);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
});

app.post('/api/auth/logout', auth, (req, res) => { sessions.delete(req.token); res.json({ message: 'Berhasil keluar.' }); });

// Forgot password: langkah 1 - cek email, keluarkan token reset (simulasi email).
app.post('/api/auth/forgot', (req, res) => {
  const email = L.clean(req.body.email).toLowerCase();
  if (!email) return fail(res, 400, 'Email wajib diisi.', { email: 'Email wajib diisi.' });
  if (!L.isEmail(email)) return fail(res, 400, 'Format email tidak valid.', { email: 'Format email tidak valid.' });
  const user = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (!user) return fail(res, 404, 'Email tidak ditemukan.', { email: 'Email tidak ditemukan.' });
  const token = crypto.randomBytes(16).toString('hex');
  resets.set(token, user.id);
  res.json({ token, message: 'Email terdaftar. Silakan buat password baru.' });
});

// Langkah 2 - simpan password baru.
app.post('/api/auth/reset', (req, res) => {
  const { token, password = '', confirm = '' } = req.body;
  const uid = resets.get(token);
  if (!uid) return fail(res, 400, 'Sesi reset password tidak valid. Ulangi dari awal.');
  const errors = {};
  const pe = password ? L.validatePassword(password) : 'Password baru wajib diisi.';
  if (pe) errors.password = pe;
  if (!confirm) errors.confirm = 'Konfirmasi password wajib diisi.';
  else if (confirm !== password) errors.confirm = 'Konfirmasi password tidak sama.';
  if (Object.keys(errors).length) return fail(res, 400, 'Password baru belum valid.', errors);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(password, 10), uid);
  resets.delete(token);
  res.json({ message: 'Password berhasil diperbarui. Silakan login.' });
});

// ---------- PROFIL ----------
app.get('/api/me', auth, (req, res) => res.json(req.user));
app.put('/api/me', auth, (req, res) => {
  const name = L.clean(req.body.name), phone = L.clean(req.body.phone), errors = {};
  if (name.length < 3) errors.name = 'Nama minimal 3 karakter.';
  if (!L.isPhone(phone)) errors.phone = 'Nomor HP harus diawali 08 dan terdiri dari 10-13 digit.';
  if (Object.keys(errors).length) return fail(res, 400, 'Data profil belum valid.', errors);
  db.prepare('UPDATE users SET name=?, phone=? WHERE id=?').run(name, phone, req.user.id);
  res.json({ message: 'Profil berhasil diperbarui.', user: { ...req.user, name, phone } });
});

// ---------- LAPANGAN ----------
app.get('/api/courts', (req, res) => {
  const { q = '', sport = '', location = '', minPrice = '', maxPrice = '' } = req.query;
  const min = minPrice === '' ? null : Number(minPrice), max = maxPrice === '' ? null : Number(maxPrice);
  if ((min !== null && (isNaN(min) || min < 0)) || (max !== null && (isNaN(max) || max < 0)))
    return fail(res, 400, 'Harga harus berupa angka positif.');
  if (min !== null && max !== null && min > max) return fail(res, 400, 'Harga minimum tidak boleh lebih besar dari harga maksimum.');
  let sql = 'SELECT * FROM courts WHERE name LIKE ?';
  const params = [`%${L.clean(q)}%`];
  if (sport) { sql += ' AND sport_type=?'; params.push(sport); }
  if (location) { sql += ' AND location=?'; params.push(location); }
  if (min !== null) { sql += ' AND price_per_hour>=?'; params.push(min); }
  if (max !== null) { sql += ' AND price_per_hour<=?'; params.push(max); }
  res.json(db.prepare(sql + ' ORDER BY id').all(...params));
});

app.get('/api/courts/:id', (req, res) => {
  const court = db.prepare('SELECT * FROM courts WHERE id=?').get(req.params.id);
  if (!court) return fail(res, 404, 'Lapangan tidak ditemukan.');
  res.json(court);
});

app.get('/api/courts/:id/slots', (req, res) => {
  const court = db.prepare('SELECT * FROM courts WHERE id=?').get(req.params.id);
  if (!court) return fail(res, 404, 'Lapangan tidak ditemukan.');
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date))) return fail(res, 400, 'Tanggal tidak valid.');
  if (date < L.todayStr()) return fail(res, 400, 'Tanggal yang sudah lewat tidak dapat dipilih.');
  if (court.status !== 'Tersedia') return fail(res, 409, 'Lapangan ini sedang tidak tersedia untuk dibooking.');
  const booked = db.prepare(`SELECT start_time,duration FROM bookings WHERE court_id=? AND booking_date=? AND booking_status!='Dibatalkan'`).all(court.id, date);
  res.json({ court, date, slots: L.buildSlots(booked, date) });
});

// ---------- BOOKING ----------
const SELECT_BOOKING = `SELECT b.*, c.name court_name, c.sport_type, c.location, p.payment_method, p.payment_status,
  p.payment_proof, p.payment_detail, p.paid_at FROM bookings b JOIN courts c ON c.id=b.court_id
  LEFT JOIN payments p ON p.booking_id=b.id`;
const ownBooking = (id, uid) => db.prepare(SELECT_BOOKING + ' WHERE b.id=? AND b.user_id=?').get(id, uid);

app.post('/api/bookings', auth, (req, res) => {
  const { court_id, date, start_time, duration } = req.body;
  const court = db.prepare('SELECT * FROM courts WHERE id=?').get(court_id);
  if (!court) return fail(res, 404, 'Lapangan tidak ditemukan.');
  if (court.status !== 'Tersedia') return fail(res, 409, 'Lapangan ini sedang tidak tersedia untuk dibooking.');
  const err = L.validateBookingInput({ date, start_time, duration });
  if (err) return fail(res, 400, err);
  const dur = Number(duration), start = parseInt(start_time, 10);
  const existing = db.prepare(`SELECT start_time,duration FROM bookings WHERE court_id=? AND booking_date=? AND booking_status!='Dibatalkan'`).all(court.id, date);
  if (existing.some(b => L.overlaps(start, dur, parseInt(b.start_time, 10), b.duration)))
    return fail(res, 409, 'Jadwal yang kamu pilih bentrok dengan booking lain. Silakan pilih jam yang berbeda.');
  const code = 'GSB-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const total = L.calcTotal(court.price_per_hour, dur);
  const info = db.prepare(`INSERT INTO bookings(booking_code,user_id,court_id,booking_date,start_time,duration,price_per_hour,total_price,booking_status)
    VALUES(?,?,?,?,?,?,?,?,'Menunggu Pembayaran')`).run(code, req.user.id, court.id, date, start_time, dur, court.price_per_hour, total);
  db.prepare("INSERT INTO payments(booking_id,payment_status) VALUES(?,'Belum Dibayar')").run(info.lastInsertRowid);
  res.status(201).json(ownBooking(info.lastInsertRowid, req.user.id));
});

app.get('/api/bookings', auth, (req, res) => {
  db.refreshFinished();
  res.json(db.prepare(SELECT_BOOKING + ' WHERE b.user_id=? ORDER BY b.booking_date DESC, b.start_time DESC').all(req.user.id));
});

app.get('/api/bookings/:id', auth, (req, res) => {
  db.refreshFinished();
  const b = ownBooking(req.params.id, req.user.id);   // hanya milik user yang login
  if (!b) return fail(res, 404, 'Booking tidak ditemukan.');
  res.json({ ...b, cancel: L.canCancel(b) });
});

app.post('/api/bookings/:id/pay', auth, (req, res) => {
  const b = ownBooking(req.params.id, req.user.id);
  if (!b) return fail(res, 404, 'Booking tidak ditemukan.');
  if (b.booking_status !== 'Menunggu Pembayaran') return fail(res, 409, `Booking berstatus "${b.booking_status}" sehingga tidak bisa dibayar.`);
  const p = { method: req.body.method, bank: L.clean(req.body.bank), account_name: L.clean(req.body.account_name),
    proof: L.clean(req.body.proof), wallet: L.clean(req.body.wallet), wallet_phone: L.clean(req.body.wallet_phone) };
  const errors = L.validatePayment(p);
  if (Object.keys(errors).length) return fail(res, 400, 'Data pembayaran belum lengkap.', errors);
  const detail = p.method === 'Transfer Bank' ? `${p.bank} a.n. ${p.account_name}` : p.method === 'E-Wallet' ? `${p.wallet} ${p.wallet_phone}` : 'QRIS';
  db.prepare(`UPDATE payments SET payment_method=?, payment_status='Menunggu Konfirmasi', payment_detail=?, payment_proof=?, paid_at=? WHERE booking_id=?`)
    .run(p.method, detail, p.proof || null, new Date().toISOString(), b.id);
  db.prepare("UPDATE bookings SET booking_status='Menunggu Konfirmasi' WHERE id=?").run(b.id);
  res.json(ownBooking(b.id, req.user.id));
});

app.post('/api/bookings/:id/cancel', auth, (req, res) => {
  db.refreshFinished();
  const b = ownBooking(req.params.id, req.user.id);
  if (!b) return fail(res, 404, 'Booking tidak ditemukan.');
  const check = L.canCancel(b);
  if (!check.ok) return fail(res, 409, check.message);
  db.prepare("UPDATE bookings SET booking_status='Dibatalkan' WHERE id=?").run(b.id);
  res.json(ownBooking(b.id, req.user.id));
});

// ---------- ADMIN ----------
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return fail(res, 403, 'Halaman ini khusus admin.');
  next();
}

app.get('/api/admin/bookings', auth, adminOnly, (req, res) => {
  db.refreshFinished();
  res.json(db.prepare(`SELECT b.*, c.name court_name, u.name customer_name, p.payment_method, p.payment_status,
    p.payment_proof, p.payment_detail FROM bookings b JOIN courts c ON c.id=b.court_id JOIN users u ON u.id=b.user_id
    LEFT JOIN payments p ON p.booking_id=b.id ORDER BY b.id DESC`).all());
});

// Hanya booking "Menunggu Konfirmasi" yang bisa diverifikasi atau ditolak.
function pendingBooking(req, res) {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!b) { fail(res, 404, 'Booking tidak ditemukan.'); return null; }
  if (b.booking_status !== 'Menunggu Konfirmasi') { fail(res, 409, 'Hanya booking berstatus "Menunggu Konfirmasi" yang bisa diproses.'); return null; }
  return b;
}
app.post('/api/admin/bookings/:id/verify', auth, adminOnly, (req, res) => {
  const b = pendingBooking(req, res); if (!b) return;
  db.prepare("UPDATE bookings SET booking_status='Dikonfirmasi' WHERE id=?").run(b.id);
  db.prepare("UPDATE payments SET payment_status='Dibayar' WHERE booking_id=?").run(b.id);
  res.json({ message: 'Pembayaran diverifikasi. Booking dikonfirmasi.' });
});
app.post('/api/admin/bookings/:id/reject', auth, adminOnly, (req, res) => {
  const b = pendingBooking(req, res); if (!b) return;
  db.prepare("UPDATE bookings SET booking_status='Menunggu Pembayaran' WHERE id=?").run(b.id);
  db.prepare("UPDATE payments SET payment_status='Belum Dibayar', payment_method=NULL, payment_detail=NULL, payment_proof=NULL, paid_at=NULL WHERE booking_id=?").run(b.id);
  res.json({ message: 'Pembayaran ditolak. Customer diminta membayar ulang.' });
});

const readCourt = b => ({ name: L.clean(b.name), sport_type: L.clean(b.sport_type), location: L.clean(b.location),
  price_per_hour: Number(b.price_per_hour), facilities: L.clean(b.facilities), description: L.clean(b.description), status: L.clean(b.status) });
function courtErrors(c, id) {
  const errors = L.validateCourt(c);
  if (!errors.name && db.prepare('SELECT 1 FROM courts WHERE name=? AND id!=?').get(c.name, id)) errors.name = 'Nama lapangan sudah dipakai.';
  return errors;
}
app.post('/api/admin/courts', auth, adminOnly, (req, res) => {
  const c = readCourt(req.body), errors = courtErrors(c, 0);
  if (Object.keys(errors).length) return fail(res, 400, 'Data lapangan belum valid.', errors);
  const info = db.prepare('INSERT INTO courts(name,sport_type,location,price_per_hour,facilities,description,photo,status) VALUES(?,?,?,?,?,?,?,?)')
    .run(c.name, c.sport_type, c.location, c.price_per_hour, c.facilities, c.description, c.sport_type.toLowerCase(), c.status);
  res.status(201).json({ message: 'Lapangan berhasil ditambahkan.', id: info.lastInsertRowid });
});
app.put('/api/admin/courts/:id', auth, adminOnly, (req, res) => {
  if (!db.prepare('SELECT 1 FROM courts WHERE id=?').get(req.params.id)) return fail(res, 404, 'Lapangan tidak ditemukan.');
  const c = readCourt(req.body), errors = courtErrors(c, Number(req.params.id));
  if (Object.keys(errors).length) return fail(res, 400, 'Data lapangan belum valid.', errors);
  db.prepare('UPDATE courts SET name=?,sport_type=?,location=?,price_per_hour=?,facilities=?,description=?,status=? WHERE id=?')
    .run(c.name, c.sport_type, c.location, c.price_per_hour, c.facilities, c.description, c.status, req.params.id);
  res.json({ message: 'Data lapangan berhasil diperbarui.' });
});
app.delete('/api/admin/courts/:id', auth, adminOnly, (req, res) => {
  if (!db.prepare('SELECT 1 FROM courts WHERE id=?').get(req.params.id)) return fail(res, 404, 'Lapangan tidak ditemukan.');
  if (db.prepare('SELECT COUNT(*) n FROM bookings WHERE court_id=?').get(req.params.id).n > 0)
    return fail(res, 409, 'Lapangan sudah punya riwayat booking dan tidak bisa dihapus. Ubah statusnya menjadi Tidak Tersedia.');
  db.prepare('DELETE FROM courts WHERE id=?').run(req.params.id);
  res.json({ message: 'Lapangan berhasil dihapus.' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`GreenSport Booking berjalan di http://localhost:${PORT}`));
module.exports = app;
