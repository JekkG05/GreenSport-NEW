// Frontend GreenSport Booking: routing berbasis hash + pemanggilan API.
const $ = id => document.getElementById(id);
const state = { token: localStorage.getItem('token'), user: null, draft: null };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupiah = n => 'Rp' + Number(n).toLocaleString('id-ID');
const pad = n => String(n).padStart(2, '0');
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const slug = s => String(s).toLowerCase().replace(/\s+/g, '-');
const badge = s => `<span class="badge ${slug(s)}">${esc(s)}</span>`;
const view = h => { $('app').innerHTML = h; };
const CLOSE = 22;
const ART = {
  Futsal: ['#2e7d4f', '<rect x="12" y="12" width="176" height="96"/><line x1="100" y1="12" x2="100" y2="108"/><circle cx="100" cy="60" r="18"/><rect x="12" y="38" width="22" height="44"/><rect x="166" y="38" width="22" height="44"/>'],
  Badminton: ['#3b6ea5', '<rect x="22" y="10" width="156" height="100"/><line x1="100" y1="10" x2="100" y2="110"/><line x1="22" y1="28" x2="178" y2="28"/><line x1="22" y1="92" x2="178" y2="92"/><line x1="64" y1="28" x2="64" y2="92"/><line x1="136" y1="28" x2="136" y2="92"/><line x1="22" y1="60" x2="64" y2="60"/><line x1="136" y1="60" x2="178" y2="60"/>'],
  Basket: ['#c9812b', '<rect x="12" y="12" width="176" height="96"/><line x1="100" y1="12" x2="100" y2="108"/><circle cx="100" cy="60" r="16"/><rect x="12" y="40" width="34" height="40"/><rect x="154" y="40" width="34" height="40"/><path d="M46 44a18 18 0 0 1 0 32M154 44a18 18 0 0 0 0 32"/>'],
  Tenis: ['#a4503a', '<rect x="20" y="14" width="160" height="92"/><line x1="20" y1="30" x2="180" y2="30"/><line x1="20" y1="90" x2="180" y2="90"/><line x1="100" y1="14" x2="100" y2="106"/><line x1="50" y1="30" x2="50" y2="90"/><line x1="150" y1="30" x2="150" y2="90"/><line x1="50" y1="60" x2="150" y2="60"/>'],
};
// Foto lapangan dari Unsplash (Unsplash License). Ilustrasi garis lapangan tampil sebagai cadangan jika foto gagal dimuat / offline.
const PHOTOS = { Futsal: ['ndxwXAt0jpg'], Badminton: ['VRqmHMYMq1c', '6PjgrltUGjI'], Basket: ['kqYzyZwKHqw', 'Qpbcm2ZpKCE'], Tenis: ['LqusW4i447A', '0wbYOLZwDPY'] };
const photoUrl = id => `https://unsplash.com/photos/${id}/download?force=true&w=900`;
function courtArt(sport, cls = '', key = 0) {
  const [bg, lines] = ART[sport] || ART.Futsal;
  const ids = PHOTOS[sport] || [], id = ids.length ? ids[key % ids.length] : null;
  return `<div class="ph ${cls}"><svg class="art" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Lapangan ${esc(sport)}" style="background:${bg}"><g stroke="rgba(255,255,255,.8)" stroke-width="2" fill="none">${lines}</g></svg>`
    + (id ? `<img src="${photoUrl(id)}" alt="Lapangan ${esc(sport)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '') + '</div>';
}
function toast(text, type = 'success') {
  let box = $('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; box.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
const skel = () => '<div class="skel"></div><div class="skel"></div><div class="skel s"></div>';
const steps = n => `<ol class="steps">${['Pilih jadwal', 'Konfirmasi', 'Pembayaran', 'Selesai'].map((t, i) => `<li class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}">${i + 1}. ${t}</li>`).join('')}</ol>`;
const courtCard = c => `<a class="court ${c.status === 'Tersedia' ? '' : 'off'}" href="#/courts/${c.id}">${courtArt(c.sport_type, '', c.id)}<div class="cb"><div class="ct"><b>${esc(c.name)}</b>${badge(c.status)}</div>
  <div class="muted">${esc(c.sport_type)} &middot; ${esc(c.location)}</div><div class="fac">${(c.facilities || '').split(',').filter(x => x.trim()).slice(0, 3).map(x => `<span>${esc(x.trim())}</span>`).join('')}</div>
  <div class="cp"><b>${rupiah(c.price_per_hour)}</b><small> /jam</small></div></div></a>`;

async function api(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && state.token) { clearSession(); location.hash = '#/login'; }
  if (!r.ok) throw data;
  return data;
}
function clearSession() { state.token = null; state.user = null; localStorage.removeItem('token'); nav(); }

// ---------- helper form ----------
const input = (label, name, type = 'text', attrs = '') => {
  const field = `<input name="${name}" type="${type}" ${attrs}>`;
  const box = type === 'password' ? `<span class="pwwrap">${field}<button type="button" class="pw-toggle" tabindex="-1">Lihat</button></span>` : field;
  return `<label>${label}${box}<span class="err" data-f="${name}"></span></label>`;
};
const setErrors = (f, errors = {}) => f.querySelectorAll('.err').forEach(e => { e.textContent = errors[e.dataset.f] || ''; });
function showMsg(el, text, type = 'error') { el.className = 'msg ' + type; el.textContent = text; if (type === 'success') toast(text); }
function bindForm(id, handler, required = []) {
  const f = $(id), m = f.querySelector('.msg');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const errs = {};
    required.forEach(k => { if (!String(d[k] || '').trim()) errs[k] = 'Wajib diisi.'; });   // validasi frontend
    setErrors(f, errs); m.className = 'msg'; m.textContent = '';
    if (Object.keys(errs).length) return;
    try { await handler(d, f, m); }
    catch (x) { setErrors(f, x.errors); showMsg(m, x.message || 'Terjadi kesalahan pada server.'); }
  });
}

// ---------- navigasi ----------
function nav() {
  const u = state.user;
  $('nav').innerHTML = `<a class="brand" href="#/">GreenSport Booking</a><div>` + (u && u.role === 'admin'
    ? `<a href="#/admin">Pembayaran</a><a href="#/admin/courts">Kelola Lapangan</a><a href="#" id="logout">Keluar</a>`
    : u
    ? `<a href="#/dashboard">Dashboard</a><a href="#/courts">Lapangan</a><a href="#/bookings">Booking Saya</a><a href="#/profile">Profil</a><a href="#" id="logout">Keluar</a>`
    : `<a href="#/courts">Lapangan</a><a href="#/login">Masuk</a><a href="#/register">Daftar</a>`) + `</div>`;
  const lo = $('logout');
  if (lo) lo.onclick = async e => { e.preventDefault(); try { await api('/auth/logout', 'POST'); } catch (_) {} clearSession(); location.hash = '#/'; };
}

// ---------- halaman ----------
async function pageHome() {
  const courts = await api('/courts').catch(() => []);
  const sports = ['Futsal', 'Badminton', 'Basket', 'Tenis'];
  view(`<section class="hero"><div><h1>Cari lapangan, pilih jam, langsung main.</h1>
    <p class="muted">Cek jadwal kosong di ${courts.length} lapangan futsal, badminton, basket, dan tenis, lalu booking tanpa perlu telepon satu per satu.</p>
    <form id="q" class="quick"><input name="q" placeholder="Nama lapangan, mis. Green"><select name="sport"><option value="">Semua olahraga</option>${sports.map(s => `<option>${s}</option>`).join('')}</select><button class="btn cta">Cari</button></form>
    <p class="muted small">Buka setiap hari 08.00 - 22.00</p></div>${courtArt('Futsal', 'big', 0)}</section>
    <div class="band"><div><b>${courts.length}</b>Lapangan</div><div><b>${new Set(courts.map(c => c.location)).size}</b>Lokasi</div><div><b>${sports.length}</b>Cabang olahraga</div><div><b>08-22</b>Jam buka tiap hari</div></div>
    <h2>Pilih olahraga</h2><div class="sports">${sports.map(s => `<a href="#/courts" data-sport="${s}">${courtArt(s, 'tile')}<span>${s}</span><small>${courts.filter(c => c.sport_type === s).length} lapangan</small></a>`).join('')}</div>
    <h2>Lapangan populer</h2><div class="grid">${courts.filter(c => c.status === 'Tersedia').slice(0, 3).map(courtCard).join('')}</div>
    <h2>Cara booking</h2><ol class="how"><li><b>Cari</b>Pilih lapangan sesuai olahraga, lokasi, dan budget.</li><li><b>Pilih jam</b>Cek jadwal kosong, tentukan jam mulai dan durasi.</li>
    <li><b>Bayar</b>Transfer bank, e-wallet, atau QRIS.</li><li><b>Main</b>Datang sesuai jadwal. Booking bisa dibatalkan sampai 3 jam sebelumnya.</li></ol>
    <h2>Cari berdasarkan lokasi</h2><div class="chips">${[...new Set(courts.map(c => c.location))].map(l => `<a class="chip" href="#/courts" data-loc="${esc(l)}">${esc(l)}</a>`).join('')}</div>
    ${state.user ? '' : '<div class="cta-box"><div><h2>Belum punya akun?</h2><p class="muted">Daftar gratis dan booking lapangan pertamamu hari ini.</p></div><a class="btn cta" href="#/register">Daftar Sekarang</a></div>'}`);
  $('q').onsubmit = e => { e.preventDefault(); state.prefill = Object.fromEntries(new FormData(e.target)); location.hash = '#/courts'; };
  document.querySelectorAll('[data-sport]').forEach(a => { a.onclick = () => { state.prefill = { sport: a.dataset.sport }; }; });
  document.querySelectorAll('[data-loc]').forEach(a => { a.onclick = () => { state.prefill = { location: a.dataset.loc }; }; });
}

function pageLogin() {
  view(`<div class="box narrow auth">${courtArt('Futsal', 'strip')}<h1>Masuk</h1><form id="f" novalidate>${input('Email', 'email', 'email')}${input('Password', 'password', 'password')}
    <div class="msg"></div><button class="btn">Login</button></form>
    <p><a href="#/register">Belum punya akun? Daftar</a><br><a href="#/forgot">Lupa password?</a></p></div>`);
  bindForm('f', async d => {
    const r = await api('/auth/login', 'POST', d);
    state.token = r.token; state.user = r.user; localStorage.setItem('token', r.token);
    location.hash = r.user.role === 'admin' ? '#/admin' : '#/dashboard';
  }, ['email', 'password']);
}

function pageRegister() {
  view(`<div class="box narrow auth">${courtArt('Badminton', 'strip')}<h1>Daftar Akun</h1><form id="f" novalidate>${input('Nama lengkap', 'name')}${input('Email', 'email', 'email')}
    ${input('Nomor HP', 'phone', 'tel', 'placeholder="081234567890"')}${input('Password', 'password', 'password')}${input('Konfirmasi password', 'confirm', 'password')}
    <div class="msg"></div><button class="btn">Daftar</button></form><p><a href="#/login">Sudah punya akun? Masuk</a></p></div>`);
  bindForm('f', async (d, f, m) => {
    const r = await api('/auth/register', 'POST', d);
    showMsg(m, r.message, 'success'); setTimeout(() => { location.hash = '#/login'; }, 1200);
  }, ['name', 'email', 'phone', 'password', 'confirm']);
}

function pageForgot() {
  view(`<div class="box narrow"><h1>Lupa Password</h1><form id="f" novalidate>${input('Email terdaftar', 'email', 'email')}
    <div class="msg"></div><button class="btn">Lanjut</button></form><p><a href="#/login">Kembali ke login</a></p></div>`);
  bindForm('f', async d => {
    const r = await api('/auth/forgot', 'POST', d);
    view(`<div class="box narrow"><h1>Password Baru</h1><p class="muted">${esc(r.message)} (Simulasi: email tidak dikirim sungguhan.)</p>
      <form id="g" novalidate>${input('Password baru', 'password', 'password')}${input('Konfirmasi password baru', 'confirm', 'password')}
      <div class="msg"></div><button class="btn">Simpan Password</button></form></div>`);
    bindForm('g', async (d2, f, m) => {
      const r2 = await api('/auth/reset', 'POST', { ...d2, token: r.token });
      showMsg(m, r2.message, 'success'); setTimeout(() => { location.hash = '#/login'; }, 1200);
    }, ['password', 'confirm']);
  }, ['email']);
}

async function pageDashboard() {
  view(skel());
  const list = await api('/bookings');
  const live = ['Menunggu Pembayaran', 'Menunggu Konfirmasi', 'Dikonfirmasi'];
  const active = list.filter(b => live.includes(b.booking_status)).sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time));
  const unpaid = list.filter(b => b.booking_status === 'Menunggu Pembayaran');
  const spent = list.filter(b => ['Dikonfirmasi', 'Selesai'].includes(b.booking_status)).reduce((t, b) => t + b.total_price, 0);
  const hr = new Date().getHours(), greet = hr < 11 ? 'Selamat pagi' : hr < 15 ? 'Selamat siang' : hr < 18 ? 'Selamat sore' : 'Selamat malam';
  view(`<h1>${greet}, ${esc(state.user.name.split(' ')[0])}</h1>
    ${unpaid.length ? `<div class="alert">Ada ${unpaid.length} booking yang belum dibayar. <a href="#/payment/${unpaid[0].id}">Bayar sekarang</a></div>` : ''}
    <div class="stats"><div class="box"><b>${active.length}</b>Booking aktif</div><div class="box"><b>${list.filter(b => b.booking_status === 'Selesai').length}</b>Sudah selesai</div><div class="box"><b>${rupiah(spent)}</b>Total pembayaran</div></div>
    <h2>Jadwal mendatang</h2><div class="box">${active.length ? active.slice(0, 4).map(b => `<div class="up"><div class="date"><b>${esc(b.booking_date.slice(8))}</b>${new Date(b.booking_date).toLocaleDateString('id-ID', { month: 'short' })}</div>
      <div class="info"><b>${esc(b.court_name)}</b><br><small class="muted">${esc(b.start_time)} &middot; ${b.duration} jam &middot; ${esc(b.booking_code)}</small></div>${badge(b.booking_status)}<a href="#/bookings/${b.id}">Detail</a></div>`).join('')
      : `<div class="empty">${courtArt('Futsal', 'mini')}<p>Belum ada jadwal main. Cari lapangan dan booking jam pertamamu.</p><a class="btn" href="#/courts">Cari Lapangan</a></div>`}</div>
    <div class="actions"><a class="btn" href="#/courts">Cari Lapangan</a><a class="btn alt" href="#/bookings">Semua Booking</a></div>`);
}

async function pageCourts() {
  view(skel());
  const all = await api('/courts');
  const locations = [...new Set(all.map(c => c.location))];
  const f = Object.assign({ q: '', sport: '', location: '', minPrice: '', maxPrice: '' }, state.prefill || {});
  state.prefill = null;
  view(`<h1>Daftar Lapangan</h1><div class="box filters"><input id="q" type="search" placeholder="Cari nama lapangan..." value="${esc(f.q)}">
    <div class="chips" id="chips">${['', 'Futsal', 'Badminton', 'Basket', 'Tenis'].map(s => `<button type="button" class="chip" data-s="${s}">${s || 'Semua'}</button>`).join('')}</div>
    <div class="row"><label>Lokasi<select id="loc"><option value="">Semua</option>${locations.map(l => `<option ${l === f.location ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    <label>Harga min<input id="min" type="number" min="0" value="${esc(f.minPrice)}"></label><label>Harga maks<input id="max" type="number" min="0" value="${esc(f.maxPrice)}"></label>
    <label>Urutkan<select id="sort"><option value="">Default</option><option value="asc">Harga terendah</option><option value="desc">Harga tertinggi</option><option value="name">Nama A-Z</option></select></label></div>
    <div id="msg" class="msg"></div></div><div id="count" class="muted"></div><div id="result"></div>`);
  async function load() {
    f.q = $('q').value; f.location = $('loc').value; f.minPrice = $('min').value; f.maxPrice = $('max').value;
    document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('on', c.dataset.s === f.sport));
    $('msg').className = 'msg'; $('msg').textContent = '';
    let list;
    try { list = await api('/courts?' + new URLSearchParams(f)); }
    catch (e) { showMsg($('msg'), e.message || 'Gagal memuat data.'); $('count').textContent = ''; $('result').innerHTML = ''; return; }
    const sort = $('sort').value;
    if (sort === 'asc') list.sort((a, b) => a.price_per_hour - b.price_per_hour);
    if (sort === 'desc') list.sort((a, b) => b.price_per_hour - a.price_per_hour);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    $('count').textContent = `${list.length} lapangan ditemukan`;
    $('result').innerHTML = list.length ? `<div class="grid">${list.map(courtCard).join('')}</div>`
      : `<div class="box empty">${courtArt('Futsal', 'mini')}<p>Tidak ada lapangan yang cocok dengan pencarianmu.</p><button class="btn alt" id="reset">Reset filter</button></div>`;
    if ($('reset')) $('reset').onclick = () => { Object.assign(f, { q: '', sport: '', location: '', minPrice: '', maxPrice: '' }); ['q', 'loc', 'min', 'max'].forEach(i => { $(i).value = ''; }); load(); };
  }
  let timer; const later = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  ['q', 'min', 'max'].forEach(i => { $(i).oninput = later; }); ['loc', 'sort'].forEach(i => { $(i).onchange = load; });
  document.querySelectorAll('#chips .chip').forEach(c => { c.onclick = () => { f.sport = c.dataset.s; load(); }; });
  load();
}

async function pageCourtDetail(id) {
  const c = await api('/courts/' + id);
  view(`<a href="#/courts" class="back">&larr; Semua lapangan</a><div class="detail">${courtArt(c.sport_type, 'big', c.id)}<div class="box"><h1>${esc(c.name)} ${badge(c.status)}</h1>
    <p class="price">${rupiah(c.price_per_hour)}<small> / jam</small></p><dl><dt>Olahraga</dt><dd>${esc(c.sport_type)}</dd><dt>Lokasi</dt><dd>${esc(c.location)}</dd><dt>Jam buka</dt><dd>08.00 - 22.00</dd><dt>Deskripsi</dt><dd>${esc(c.description)}</dd></dl>
    <div class="fac big">${(c.facilities || '').split(',').filter(x => x.trim()).map(x => `<span>${esc(x.trim())}</span>`).join('')}</div>
    ${c.status !== 'Tersedia' ? '<div class="msg error">Lapangan ini sedang tidak tersedia untuk dibooking.</div>' : ''}
    <div class="actions"><a class="btn" href="#/schedule/${c.id}">Lihat Jadwal &amp; Booking</a></div></div></div>`);
}

async function pageSchedule(id) {
  const court = await api('/courts/' + id);
  let date = today(), start = null, dur = 1, slots = [];
  view(steps(1) + `<h1>Jadwal ${esc(court.name)}</h1><div class="box"><div class="row"><label>Tanggal<input type="date" id="date" min="${today()}" value="${date}"></label>
    <label>Durasi<select id="dur">${[1, 2, 3].map(n => `<option value="${n}">${n} jam</option>`).join('')}</select></label></div>
    <p class="muted">Klik jam mulai yang tersedia. Jam operasional 08.00 - 22.00, durasi 1-3 jam.</p><div id="msg" class="msg"></div><div id="slots"></div><div id="sum"></div></div>`);
  async function load() {
    start = null; $('msg').className = 'msg'; $('msg').textContent = '';
    try { slots = (await api(`/courts/${id}/slots?date=${date}`)).slots; }
    catch (e) { slots = []; showMsg($('msg'), e.message || 'Gagal memuat jadwal.'); }
    draw();
  }
  function draw() {
    const sel = start === null ? [] : Array.from({ length: dur }, (_, i) => start + i);
    $('slots').innerHTML = slots.map(s => { const st = s.status === 'Tersedia' && sel.includes(s.hour) ? 'Dipilih' : s.status;
      return `<button type="button" class="slot ${slug(st)}" data-h="${s.hour}" ${s.status === 'Tersedia' ? '' : 'disabled'}><span>${s.label}</span>${badge(st)}</button>`; }).join('');
    const ok = start !== null && start + dur <= CLOSE && sel.every(h => slots.find(s => s.hour === h)?.status === 'Tersedia');
    if (!slots.length) $('sum').innerHTML = '';
    else if (start === null) $('sum').innerHTML = '<p class="muted">Belum ada jam yang dipilih.</p>';
    else if (!ok) $('sum').innerHTML = '<div class="msg error">Durasi yang dipilih bentrok dengan jadwal lain atau melewati jam tutup.</div>';
    else $('sum').innerHTML = `<p>${pad(start)}.00 - ${pad(start + dur)}.00 &middot; Total <b>${rupiah(court.price_per_hour * dur)}</b></p><button class="btn" id="next">Lanjut ke Form Booking</button>`;
    document.querySelectorAll('.slot').forEach(b => { b.onclick = () => { start = Number(b.dataset.h); draw(); }; });
    if ($('next')) $('next').onclick = () => { state.draft = { court, date, start_time: pad(start) + ':00', duration: dur }; location.hash = '#/booking/new'; };
  }
  $('date').onchange = e => { date = e.target.value; load(); };
  $('dur').onchange = e => { dur = Number(e.target.value); draw(); };
  load();
}

function pageBookingNew() {
  const d = state.draft;
  if (!d) { location.hash = '#/courts'; return; }
  const total = d.court.price_per_hour * d.duration;
  view(steps(2) + `<div class="box narrow"><h1>Konfirmasi Booking</h1><dl><dt>Lapangan</dt><dd>${esc(d.court.name)}</dd><dt>Tanggal</dt><dd>${esc(d.date)}</dd>
    <dt>Jam</dt><dd>${d.start_time} - ${pad(parseInt(d.start_time) + d.duration)}:00</dd><dt>Durasi</dt><dd>${d.duration} jam</dd>
    <dt>Harga per jam</dt><dd>${rupiah(d.court.price_per_hour)}</dd><dt>Total</dt><dd><b>${rupiah(total)}</b></dd></dl>
    <form id="f" novalidate style="margin-top:1rem"><label><input type="checkbox" name="agree" value="1">Data booking sudah benar dan saya setuju dengan aturan pembatalan.</label><span class="err" data-f="agree"></span>
    <div class="msg"></div><div class="actions"><button class="btn">Buat Booking</button><a class="btn alt" href="#/schedule/${d.court.id}">Ubah</a></div></form></div>`);
  bindForm('f', async () => {
    const b = await api('/bookings', 'POST', { court_id: d.court.id, date: d.date, start_time: d.start_time, duration: d.duration });
    state.draft = null; location.hash = '#/payment/' + b.id;
  }, ['agree']);
  document.querySelector('[data-f=agree]').textContent = '';
}

async function pagePayment(id) {
  const b = await api('/bookings/' + id);
  if (b.booking_status !== 'Menunggu Pembayaran') {
    view(`<div class="box narrow"><h1>Pembayaran</h1><p>Booking ${esc(b.booking_code)} berstatus ${badge(b.booking_status)}, tidak perlu dibayar lagi.</p><a class="btn" href="#/bookings/${b.id}">Lihat Detail</a></div>`); return;
  }
  view(steps(3) + `<div class="box narrow"><h1>Pembayaran</h1><dl><dt>Kode booking</dt><dd>${esc(b.booking_code)}</dd><dt>Lapangan</dt><dd>${esc(b.court_name)}</dd>
    <dt>Tanggal</dt><dd>${esc(b.booking_date)}</dd><dt>Jam</dt><dd>${esc(b.start_time)} (${b.duration} jam)</dd><dt>Total bayar</dt><dd><b>${rupiah(b.total_price)}</b></dd></dl>
    <form id="f" novalidate style="margin-top:1rem"><label>Metode pembayaran<select name="method" id="method"><option value="">- Pilih -</option><option>Transfer Bank</option><option>E-Wallet</option><option>QRIS</option></select><span class="err" data-f="method"></span></label>
    <div class="grp" data-m="Transfer Bank" hidden>${input('Nama bank', 'bank')}${input('Nama pemilik rekening', 'account_name')}${input('Bukti transfer', 'proofFile', 'file', 'accept="image/*,.pdf"')}<span class="err" data-f="proof"></span></div>
    <div class="grp" data-m="E-Wallet" hidden><label>E-wallet<select name="wallet"><option value="">- Pilih -</option><option>GoPay</option><option>OVO</option><option>DANA</option></select><span class="err" data-f="wallet"></span></label>${input('Nomor e-wallet', 'wallet_phone', 'tel')}</div>
    <div class="grp" data-m="QRIS" hidden><p class="muted">Scan QRIS di kasir GreenSport, lalu tekan Konfirmasi Pembayaran.</p></div>
    <div class="msg"></div><div class="actions"><button class="btn">Konfirmasi Pembayaran</button><button type="button" class="btn danger" id="cancel">Batalkan Booking</button></div></form></div>`);
  $('method').onchange = e => document.querySelectorAll('.grp').forEach(g => { g.hidden = g.dataset.m !== e.target.value; });
  bindForm('f', async (d, f) => {
    const proof = f.proofFile && f.proofFile.files[0] ? f.proofFile.files[0].name : '';   // hanya nama file (simulasi upload)
    await api(`/bookings/${id}/pay`, 'POST', { ...d, proof });
    location.hash = '#/bookings/' + id;
  });
  $('cancel').onclick = async () => {
    if (!confirm('Batalkan booking ini?')) return;
    try { await api(`/bookings/${id}/cancel`, 'POST'); location.hash = '#/bookings/' + id; } catch (e) { showMsg(document.querySelector('#f .msg'), e.message); }
  };
}

async function pageHistory() {
  const list = await api('/bookings');
  view(`<h1>Riwayat Booking</h1><div class="box scroll">` + (list.length ? `<table><tr><th>Kode</th><th>Lapangan</th><th>Tanggal &amp; jam</th><th>Total</th><th>Pembayaran</th><th>Status</th><th></th></tr>
    ${list.map(b => `<tr><td>${esc(b.booking_code)}</td><td>${esc(b.court_name)}</td><td>${esc(b.booking_date)}<br>${esc(b.start_time)} (${b.duration} jam)</td><td>${rupiah(b.total_price)}</td>
    <td>${badge(b.payment_status)}</td><td>${badge(b.booking_status)}</td><td><a href="#/bookings/${b.id}">Detail</a></td></tr>`).join('')}</table>`
    : '<p class="muted">Kamu belum punya riwayat booking.</p><a class="btn" href="#/courts">Cari Lapangan</a>') + '</div>');
}

async function pageBookingDetail(id) {
  const b = await api('/bookings/' + id);
  view(`<div class="box"><h1>Detail Booking</h1><dl><dt>Kode booking</dt><dd>${esc(b.booking_code)}</dd><dt>Lapangan</dt><dd>${esc(b.court_name)} (${esc(b.location)})</dd>
    <dt>Tanggal</dt><dd>${esc(b.booking_date)}</dd><dt>Jam</dt><dd>${esc(b.start_time)} - ${pad(parseInt(b.start_time) + b.duration)}:00 (${b.duration} jam)</dd>
    <dt>Harga per jam</dt><dd>${rupiah(b.price_per_hour)}</dd><dt>Total</dt><dd><b>${rupiah(b.total_price)}</b></dd><dt>Status booking</dt><dd>${badge(b.booking_status)}</dd>
    <dt>Status pembayaran</dt><dd>${badge(b.payment_status)}</dd><dt>Metode</dt><dd>${esc(b.payment_method || '-')} ${b.payment_detail ? '(' + esc(b.payment_detail) + ')' : ''}</dd>
    <dt>Bukti bayar</dt><dd>${esc(b.payment_proof || '-')}</dd></dl><div class="msg" id="m" style="margin-top:1rem"></div>
    <div class="actions">${b.booking_status === 'Menunggu Pembayaran' ? `<a class="btn" href="#/payment/${b.id}">Bayar Sekarang</a>` : ''}
    ${b.booking_status === 'Menunggu Konfirmasi' ? '<span class="muted">Pembayaran sedang diverifikasi admin.</span>' : ''}
    <button class="btn danger" id="cancel">Batalkan Booking</button><a class="btn alt" href="#/bookings">Kembali</a></div></div>`);
  $('cancel').onclick = async () => {
    if (!confirm('Yakin ingin membatalkan booking ini?')) return;
    try { await api(`/bookings/${id}/cancel`, 'POST'); pageBookingDetail(id); } catch (e) { showMsg($('m'), e.message); }
  };
}

function pageProfile() {
  const u = state.user;
  view(`<div class="box narrow"><h1>Profil</h1><p class="muted">Email: ${esc(u.email)}</p><form id="f" novalidate>${input('Nama lengkap', 'name', 'text', `value="${esc(u.name)}"`)}
    ${input('Nomor HP', 'phone', 'tel', `value="${esc(u.phone)}"`)}<div class="msg"></div><button class="btn">Simpan</button></form></div>`);
  bindForm('f', async (d, f, m) => { const r = await api('/me', 'PUT', d); state.user = r.user; nav(); showMsg(m, r.message, 'success'); }, ['name', 'phone']);
}

// ---------- halaman admin ----------
async function pageAdminBookings() {
  const list = await api('/admin/bookings');
  view(`<h1>Verifikasi Pembayaran</h1><div class="box"><label>Filter status<select id="st"><option value="">Semua</option>
    ${['Menunggu Pembayaran', 'Menunggu Konfirmasi', 'Dikonfirmasi', 'Selesai', 'Dibatalkan'].map(s => `<option>${s}</option>`).join('')}</select></label>
    <div id="m" class="msg"></div><div class="scroll" id="tbl"></div></div>`);
  function draw() {
    const st = $('st').value, rows = list.filter(b => !st || b.booking_status === st);
    $('tbl').innerHTML = rows.length ? `<table><tr><th>Kode</th><th>Customer</th><th>Lapangan</th><th>Jadwal</th><th>Total</th><th>Pembayaran</th><th>Status</th><th></th></tr>` +
      rows.map(b => `<tr><td>${esc(b.booking_code)}</td><td>${esc(b.customer_name)}</td><td>${esc(b.court_name)}</td><td>${esc(b.booking_date)}<br>${esc(b.start_time)} (${b.duration} jam)</td>
      <td>${rupiah(b.total_price)}</td><td>${badge(b.payment_status)}<br><small>${esc(b.payment_method || '-')} ${esc(b.payment_detail || '')}<br>Bukti: ${esc(b.payment_proof || '-')}</small></td><td>${badge(b.booking_status)}</td>
      <td>${b.booking_status === 'Menunggu Konfirmasi' ? `<button class="btn" data-a="verify" data-id="${b.id}">Verifikasi</button> <button class="btn danger" data-a="reject" data-id="${b.id}">Tolak</button>` : ''}</td></tr>`).join('') + '</table>'
      : '<p class="muted">Tidak ada booking dengan status ini.</p>';
    document.querySelectorAll('[data-a]').forEach(btn => { btn.onclick = async () => {
      if (btn.dataset.a === 'reject' && !confirm('Tolak pembayaran ini?')) return;
      try { const r = await api(`/admin/bookings/${btn.dataset.id}/${btn.dataset.a}`, 'POST');
        list.splice(0, list.length, ...await api('/admin/bookings')); draw(); showMsg($('m'), r.message, 'success'); }
      catch (e) { showMsg($('m'), e.message); } }; });
  }
  $('st').onchange = draw; draw();
}

async function pageAdminCourts() {
  let list = await api('/courts'), editId = null;
  view(`<h1>Kelola Lapangan</h1><div class="box"><h2 id="ft">Tambah Lapangan</h2><form id="f" novalidate>${input('Nama lapangan', 'name')}
    <div class="row"><label>Olahraga<select name="sport_type"><option value="">- Pilih -</option>${['Futsal', 'Badminton', 'Basket', 'Tenis'].map(s => `<option>${s}</option>`).join('')}</select><span class="err" data-f="sport_type"></span></label>${input('Lokasi', 'location')}</div>
    <div class="row">${input('Harga per jam (Rp)', 'price_per_hour', 'number')}<label>Status<select name="status"><option>Tersedia</option><option>Tidak Tersedia</option></select><span class="err" data-f="status"></span></label></div>
    ${input('Fasilitas', 'facilities')}${input('Deskripsi', 'description')}<div class="msg"></div>
    <div class="actions"><button class="btn">Simpan</button><button type="button" class="btn alt" id="cancelEdit" hidden>Batal Edit</button></div></form></div><div class="box scroll" id="tbl"></div>`);
  const f = $('f'), m = f.querySelector('.msg');
  const resetEdit = () => { editId = null; f.reset(); setErrors(f); $('ft').textContent = 'Tambah Lapangan'; $('cancelEdit').hidden = true; };
  function draw() {
    $('tbl').innerHTML = `<table><tr><th>Nama</th><th>Olahraga</th><th>Lokasi</th><th>Harga/jam</th><th>Status</th><th></th></tr>` + list.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.sport_type)}</td><td>${esc(c.location)}</td>
      <td>${rupiah(c.price_per_hour)}</td><td>${badge(c.status)}</td><td><button class="btn alt" data-e="${c.id}">Ubah</button> <button class="btn danger" data-d="${c.id}">Hapus</button></td></tr>`).join('') + '</table>';
    document.querySelectorAll('[data-e]').forEach(b => { b.onclick = () => { const c = list.find(x => x.id == b.dataset.e); editId = c.id;
      ['name', 'sport_type', 'location', 'price_per_hour', 'status', 'facilities', 'description'].forEach(k => { f.elements[k].value = c[k] ?? ''; });
      $('ft').textContent = 'Ubah Lapangan'; $('cancelEdit').hidden = false; setErrors(f); window.scrollTo(0, 0); }; });
    document.querySelectorAll('[data-d]').forEach(b => { b.onclick = async () => {
      if (!confirm('Hapus lapangan ini?')) return;
      try { const r = await api('/admin/courts/' + b.dataset.d, 'DELETE'); list = await api('/courts'); draw(); showMsg(m, r.message, 'success'); }
      catch (e) { showMsg(m, e.message); } }; });
  }
  $('cancelEdit').onclick = resetEdit;
  bindForm('f', async d => {
    const r = editId ? await api('/admin/courts/' + editId, 'PUT', d) : await api('/admin/courts', 'POST', d);
    resetEdit(); list = await api('/courts'); draw(); showMsg(m, r.message, 'success');
  }, ['name', 'sport_type', 'location', 'price_per_hour']);
  draw();
}

// ---------- router ----------
const routes = [
  [/^#\/?$/, pageHome], [/^#\/login$/, pageLogin], [/^#\/register$/, pageRegister], [/^#\/forgot$/, pageForgot],
  [/^#\/dashboard$/, pageDashboard, true], [/^#\/courts$/, pageCourts], [/^#\/courts\/(\d+)$/, pageCourtDetail],
  [/^#\/schedule\/(\d+)$/, pageSchedule, true], [/^#\/booking\/new$/, pageBookingNew, true], [/^#\/payment\/(\d+)$/, pagePayment, true],
  [/^#\/bookings$/, pageHistory, true], [/^#\/bookings\/(\d+)$/, pageBookingDetail, true], [/^#\/profile$/, pageProfile, true],
  [/^#\/admin$/, pageAdminBookings, 'admin'], [/^#\/admin\/courts$/, pageAdminCourts, 'admin'],
];
async function route() {
  const h = location.hash || '#/';
  nav();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === h));
  for (const [re, fn, needAuth] of routes) {
    const m = h.match(re);
    if (!m) continue;
    if (needAuth && !state.user) { location.hash = '#/login'; return; }
    if (needAuth === 'admin' && state.user.role !== 'admin') { view('<div class="box"><div class="msg error">Halaman ini khusus admin.</div></div>'); return; }
    try { await fn(...m.slice(1)); } catch (e) { view(`<div class="box"><div class="msg error">${esc(e.message || 'Terjadi kesalahan.')}</div></div>`); }
    return;
  }
  view('<div class="box"><h1>Halaman tidak ditemukan</h1><a href="#/">Ke beranda</a></div>');
}
document.addEventListener('click', e => {
  const b = e.target.closest('.pw-toggle'); if (!b) return;
  const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Lihat' : 'Sembunyikan';
});
window.addEventListener('hashchange', route);
(async () => {
  if (state.token) { try { state.user = await api('/me'); } catch (_) { clearSession(); } }
  route();
})();
