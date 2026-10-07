const test = require('node:test');
const assert = require('node:assert');
const L = require('./logic');

const now = new Date('2026-10-01T09:00:00');
test('total harga = harga x durasi', () => assert.strictEqual(L.calcTotal(150000, 2), 300000));
test('jadwal bentrok terdeteksi', () => assert.ok(L.overlaps(10, 2, 11, 1)));
test('jadwal berurutan tidak bentrok', () => assert.ok(!L.overlaps(10, 1, 11, 1)));
test('durasi 4 jam ditolak', () => assert.ok(L.validateBookingInput({ date: '2026-10-02', start_time: '10:00', duration: 4 }, now)));
test('lewat jam tutup ditolak', () => assert.ok(L.validateBookingInput({ date: '2026-10-02', start_time: '21:00', duration: 2 }, now)));
test('tanggal lampau ditolak', () => assert.ok(L.validateBookingInput({ date: '2026-09-30', start_time: '10:00', duration: 1 }, now)));
test('booking valid', () => assert.strictEqual(L.validateBookingInput({ date: '2026-10-02', start_time: '10:00', duration: 2 }, now), null));
test('batal < 3 jam ditolak', () => assert.strictEqual(L.canCancel({ booking_status: 'Dikonfirmasi', booking_date: '2026-10-01', start_time: '11:00' }, now).ok, false));
test('batal booking selesai ditolak', () => assert.strictEqual(L.canCancel({ booking_status: 'Selesai', booking_date: '2026-09-01', start_time: '11:00' }, now).ok, false));
test('password lemah ditolak', () => assert.ok(L.validatePassword('abc')));

const court = { name: 'Lapangan X', sport_type: 'Futsal', location: 'Klojen', price_per_hour: 100000, status: 'Tersedia' };
test('lapangan valid', () => assert.deepStrictEqual(L.validateCourt(court), {}));
test('harga 9999 ditolak', () => assert.ok(L.validateCourt({ ...court, price_per_hour: 9999 }).price_per_hour));
test('harga 10000 diterima', () => assert.ok(!L.validateCourt({ ...court, price_per_hour: 10000 }).price_per_hour));
test('harga 1000001 ditolak', () => assert.ok(L.validateCourt({ ...court, price_per_hour: 1000001 }).price_per_hour));
test('olahraga tidak dikenal ditolak', () => assert.ok(L.validateCourt({ ...court, sport_type: 'Golf' }).sport_type));
