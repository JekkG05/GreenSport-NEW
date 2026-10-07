// Koneksi SQLite, pembuatan tabel, dan data dummy awal.
const Database = require('better-sqlite3');
const fs = require('fs'), path = require('path');
const bcrypt = require('bcryptjs');
const { todayStr } = require('./logic');

fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
const db = new Database(process.env.DB_FILE || path.join(__dirname, '../data/greensport.db'));
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer');
CREATE TABLE IF NOT EXISTS courts(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sport_type TEXT NOT NULL, location TEXT NOT NULL,
  price_per_hour INTEGER NOT NULL, facilities TEXT, description TEXT, photo TEXT, status TEXT NOT NULL DEFAULT 'Tersedia');
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY AUTOINCREMENT, booking_code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id), court_id INTEGER NOT NULL REFERENCES courts(id),
  booking_date TEXT NOT NULL, start_time TEXT NOT NULL, duration INTEGER NOT NULL,
  price_per_hour INTEGER NOT NULL, total_price INTEGER NOT NULL, booking_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments(
  id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
  payment_method TEXT, payment_status TEXT NOT NULL DEFAULT 'Belum Dibayar',
  payment_detail TEXT, payment_proof TEXT, paid_at TEXT);
`);

function seed() {
  if (db.prepare('SELECT COUNT(*) n FROM users').get().n > 0) return;
  const hash = p => bcrypt.hashSync(p, 10);
  const addUser = db.prepare('INSERT INTO users(name,email,phone,password) VALUES(?,?,?,?)');
  addUser.run('Rina Customer', 'customer@greensport.test', '081234567890', hash('Customer123!'));
  addUser.run('Budi Santoso', 'budi@greensport.test', '081298765432', hash('Budi12345'));

  const addCourt = db.prepare('INSERT INTO courts(name,sport_type,location,price_per_hour,facilities,description,photo,status) VALUES(?,?,?,?,?,?,?,?)');
  [
    ['Green Arena Futsal', 'Futsal', 'Lowokwaru', 150000, 'Toilet, Musholla, Parkir, Kantin', 'Lapangan futsal indoor berlantai vinyl dengan pencahayaan LED.', 'futsal', 'Tersedia'],
    ['Victory Futsal', 'Futsal', 'Klojen', 120000, 'Toilet, Parkir, Ruang Ganti', 'Lapangan futsal sintetis, cocok untuk latihan rutin.', 'futsal', 'Tersedia'],
    ['Smash Court A', 'Badminton', 'Lowokwaru', 60000, 'Toilet, Parkir, Sewa Raket', 'Lapangan badminton standar dengan lantai karpet.', 'badminton', 'Tersedia'],
    ['Smash Court B', 'Badminton', 'Sukun', 55000, 'Toilet, Parkir', 'Lapangan badminton indoor dengan sirkulasi udara yang baik.', 'badminton', 'Tersedia'],
    ['Green Basket Court', 'Basket', 'Klojen', 100000, 'Toilet, Parkir, Tribun', 'Lapangan basket outdoor dengan ring standar.', 'basket', 'Tersedia'],
    ['Victory Tennis Court', 'Tenis', 'Blimbing', 90000, 'Toilet, Parkir, Ruang Ganti', 'Lapangan tenis hard court. Sedang dalam perbaikan permukaan.', 'tenis', 'Tidak Tersedia'],
  ].forEach(c => addCourt.run(...c));

  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return todayStr(d); };
  const addB = db.prepare('INSERT INTO bookings(booking_code,user_id,court_id,booking_date,start_time,duration,price_per_hour,total_price,booking_status) VALUES(?,?,?,?,?,?,?,?,?)');
  const addP = db.prepare('INSERT INTO payments(booking_id,payment_method,payment_status,payment_detail,payment_proof,paid_at) VALUES(?,?,?,?,?,?)');
  const price = id => db.prepare('SELECT price_per_hour p FROM courts WHERE id=?').get(id).p;
  // [kode, user, court, tanggal, jam, durasi, statusBooking, statusBayar, metode]
  [
    ['GSB-SEED0001', 1, 1, day(1), '10:00', 2, 'Dikonfirmasi', 'Dibayar', 'QRIS'],
    ['GSB-SEED0002', 1, 2, day(2), '19:00', 1, 'Menunggu Pembayaran', 'Belum Dibayar', null],
    ['GSB-SEED0003', 1, 3, day(-3), '16:00', 2, 'Selesai', 'Dibayar', 'E-Wallet'],
    ['GSB-SEED0004', 1, 5, day(5), '08:00', 1, 'Dibatalkan', 'Belum Dibayar', null],
    ['GSB-SEED0005', 2, 1, day(1), '16:00', 2, 'Dikonfirmasi', 'Dibayar', 'Transfer Bank'],
    ['GSB-SEED0006', 2, 3, day(1), '09:00', 1, 'Menunggu Konfirmasi', 'Menunggu Konfirmasi', 'QRIS'],
  ].forEach(([code, u, c, date, st, dur, bs, ps, m]) => {
    const r = addB.run(code, u, c, date, st, dur, price(c), price(c) * dur, bs);
    addP.run(r.lastInsertRowid, m, ps, null, m === 'Transfer Bank' ? 'bukti-seed.jpg' : null, m ? new Date().toISOString() : null);
  });
}
seed();

// Database lama (sebelum ada admin) ditambah kolom role, lalu akun admin dibuat jika belum ada.
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'role'))
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'");
if (!db.prepare('SELECT 1 FROM users WHERE email=?').get('admin@greensport.test'))
  db.prepare("INSERT INTO users(name,email,phone,password,role) VALUES('Admin GreenSport','admin@greensport.test','081200000000',?,'admin')")
    .run(bcrypt.hashSync('Admin123!', 10));

// Booking yang sudah dikonfirmasi dan waktunya lewat otomatis menjadi "Selesai".
db.refreshFinished = () => db.prepare(`UPDATE bookings SET booking_status='Selesai'
  WHERE booking_status='Dikonfirmasi'
  AND datetime(booking_date||' '||start_time,'+'||duration||' hours') <= datetime('now','localtime')`).run();

module.exports = db;
