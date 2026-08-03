// ── Constants ─────────────────────────────────────────────
const fmt = n => n ? 'Rp\u202F' + n.toLocaleString('id-ID') : '—';

const COLORS = {
  kredivo:   '#FF6B35',
  spaylater: '#3B9EFF',
  sp1:       '#A78BFA',
  sp2:       '#34D399',
  kosan:     '#FBBF24',
  darurat:   '#F472B6',
};
const NAMES = {
  kredivo:   'Kredivo',
  spaylater: 'SPaylater',
  sp1:       'SPayPinjam 1',
  sp2:       'SPayPinjam 2',
  kosan:     'Kosan',
  darurat:   'Dana Darurat',
};
const KEYS        = ['kredivo','spaylater','sp1','sp2','kosan','darurat'];
const CREDIT_KEYS = ['kredivo','spaylater','sp1','sp2'];

// ── Badge definitions ─────────────────────────────────────
// icon: lucide icon name
const BADGE_DEFS = [
  { id:'first',   icon:'award',        label:'Pertama!',    desc:'Bayar tagihan pertama',  req: s => s.totalPaid >= 1 },
  { id:'3streak', icon:'flame',        label:'3 Streak',    desc:'3 bulan lunas berturut', req: s => s.streak >= 3 },
  { id:'5streak', icon:'zap',          label:'5 Streak',    desc:'5 bulan lunas berturut', req: s => s.streak >= 5 },
  { id:'half',    icon:'trending-up',  label:'Setengah!',   desc:'Setengah bulan lunas',   req: s => s.monthsPaid >= Math.ceil(s.total / 2) },
  { id:'almost',  icon:'target',       label:'Hampir!',     desc:'Hampir semua lunas',     req: s => s.total > 1 && s.monthsPaid >= s.total - 1 },
  { id:'done',    icon:'trophy',       label:'LUNAS SEMUA', desc:'Semua bulan lunas',      req: s => s.total > 0 && s.monthsPaid >= s.total },
];

const BADGE_COLORS = {
  first: '#FBBF24', '3streak': '#FF6B35', '5streak': '#A78BFA',
  half: '#34D399', almost: '#3B9EFF', done: '#FF6B35',
};

// ── State ─────────────────────────────────────────────────
const paid = JSON.parse(localStorage.getItem('paid3') || '{}');
function savePaid() { localStorage.setItem('paid3', JSON.stringify(paid)); }

// Default one-time cleanup: kosan dihapus & Juni-Juli 2026 dihapus (sudah lunas)
const DEFAULT_DISABLED = ['kosan'];
const DEFAULT_DELETED  = [0, 1];

let overrides = JSON.parse(localStorage.getItem('overrides3') || 'null');
if (overrides === null) { overrides = {}; localStorage.setItem('overrides3', JSON.stringify(overrides)); }

let disabledKeys = JSON.parse(localStorage.getItem('disabledKeys3') || 'null');
if (disabledKeys === null) { disabledKeys = [...DEFAULT_DISABLED]; localStorage.setItem('disabledKeys3', JSON.stringify(disabledKeys)); }

let deletedMonths = JSON.parse(localStorage.getItem('deletedMonths3') || 'null');
if (deletedMonths === null) { deletedMonths = [...DEFAULT_DELETED]; localStorage.setItem('deletedMonths3', JSON.stringify(deletedMonths)); }

function saveOverrides()  { localStorage.setItem('overrides3', JSON.stringify(overrides)); }
function saveDisabled()   { localStorage.setItem('disabledKeys3', JSON.stringify(disabledKeys)); }
function saveDeleted()    { localStorage.setItem('deletedMonths3', JSON.stringify(deletedMonths)); }

// Pemasukan per bulan
let income = JSON.parse(localStorage.getItem('income3') || '{}');
function saveIncome() { localStorage.setItem('income3', JSON.stringify(income)); }

// Tagihan custom tambahan per bulan: { i: [{id,name,amount}] }
let customBills = JSON.parse(localStorage.getItem('customBills3') || '{}');
function saveCustomBills() { localStorage.setItem('customBills3', JSON.stringify(customBills)); }

// Tanggal jatuh tempo per kategori (1-31)
const DEFAULT_DUE_DAYS = { kredivo: 5, spaylater: 25, sp1: 10, sp2: 15, kosan: 1, darurat: 1 };
let dueDays = JSON.parse(localStorage.getItem('dueDays3') || 'null');
if (dueDays === null) { dueDays = { ...DEFAULT_DUE_DAYS }; localStorage.setItem('dueDays3', JSON.stringify(dueDays)); }
function saveDueDays() { localStorage.setItem('dueDays3', JSON.stringify(dueDays)); }

let notifEnabled = localStorage.getItem('notifEnabled3') === '1';

// Effective value of a bill (after custom edits / category disable)
function emVal(i, k) {
  if (disabledKeys.includes(k)) return 0;
  const ov = overrides[paidKey(i, k)];
  return ov !== undefined ? ov : months[i][k];
}
function emCreditTotal(i) { return CREDIT_KEYS.reduce((a, k) => a + emVal(i, k), 0); }
function emCustomList(i)  { return customBills[i] || []; }
function emCustomTotal(i) { return emCustomList(i).reduce((a, c) => a + c.amount, 0); }
function emTotal(i)       { return KEYS.reduce((a, k) => a + emVal(i, k), 0) + emCustomTotal(i); }
function emIncome(i)      { return income[i] || 0; }
function emSisa(i)        { return emIncome(i) - emTotal(i); }
function visibleMonthIdx() { return months.map((_, i) => i).filter(i => !deletedMonths.includes(i)); }

function currentMonthIndex() {
  const now = new Date();
  return months.findIndex(m => m.date.getFullYear() === now.getFullYear() && m.date.getMonth() === now.getMonth());
}

// Info jatuh tempo (hanya relevan utk bulan berjalan, item belum lunas)
function dueInfo(i, k) {
  if (i !== currentMonthIndex()) return null;
  const day = dueDays[k];
  if (!day) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(now.getFullYear(), now.getMonth(), day);
  const diffDays = Math.round((due - now) / 86400000);
  return { diffDays, overdue: diffDays < 0 };
}

// ── Data generation ───────────────────────────────────────
function generate() {
  const data = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(2026, 5 + i, 1);
    const label     = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    const kredivo   = i < 12 ? 1244220 : 0;
    const spaylater = i < 2 ? 440043 : i < 5 ? 394265 : i < 21 ? 134770 : 0;
    const sp1       = i < 7  ? 497066 : 0;
    const sp2       = i < 11 ? 664721 : 0;
    const kosan     = 900000;
    const darurat   = 200000;
    const creditTotal = kredivo + spaylater + sp1 + sp2;
    const total       = creditTotal + kosan + darurat;
    data.push({ label, date: d, kredivo, spaylater, sp1, sp2, kosan, darurat, total, creditTotal });
  }
  return data;
}

const months          = generate();
const grandCreditTotal = months.reduce((a, m) => a + m.creditTotal, 0);

// ── Helpers ───────────────────────────────────────────────
const paidKey = (i, k) => `${i}-${k}`;

function isCreditPaidMonth(i) {
  return CREDIT_KEYS
    .filter(k => emVal(i, k) > 0)
    .every(k => !!paid[paidKey(i, k)]);
}

// ── Stats & gamification ──────────────────────────────────
function computeStats() {
  let monthsPaid = 0, totalPaid = 0, streak = 0;
  const earnedBadges = JSON.parse(localStorage.getItem('badges') || '[]');

  const vis = visibleMonthIdx();
  for (const i of vis) {
    const active = CREDIT_KEYS.filter(k => emVal(i, k) > 0);
    totalPaid += active.filter(k => !!paid[paidKey(i, k)]).length;
    if (isCreditPaidMonth(i)) monthsPaid++;
  }
  // streak from latest consecutive (among visible months)
  for (let vi = vis.length - 1; vi >= 0; vi--) {
    if (isCreditPaidMonth(vis[vi])) streak++;
    else break;
  }

  const xp        = totalPaid * 10;
  const xpLevel   = Math.floor(xp / 100);
  const xpInLevel = xp % 100;
  const newBadges = [];
  const total     = vis.length;

  BADGE_DEFS.forEach(b => {
    if (b.req({ monthsPaid, streak, totalPaid, total }) && !earnedBadges.includes(b.id)) {
      earnedBadges.push(b.id);
      newBadges.push(b);
    }
  });
  if (newBadges.length) localStorage.setItem('badges', JSON.stringify(earnedBadges));

  return { monthsPaid, streak, totalPaid, xp, xpLevel, xpInLevel, earnedBadges, newBadges, total };
}

// ── Theme ─────────────────────────────────────────────────
function toggleTheme() {
  document.documentElement.classList.toggle('dark');
}

// ── Lucide icon helper ────────────────────────────────────
function iconSVG(name, cls = 'w-4 h-4') {
  return `<i data-lucide="${name}" class="${cls}"></i>`;
}

// ── Summary cards ─────────────────────────────────────────
function buildSummary() {
  const stats = computeStats();
  const vis = visibleMonthIdx();
  const grandCreditTotalNow = vis.reduce((a, i) => a + emCreditTotal(i), 0);
  const sisaCreditTotal = vis
    .filter(i => !isCreditPaidMonth(i))
    .reduce((a, i) => a + emCreditTotal(i), 0);
  const rangeNote = vis.length
    ? `${months[vis[0]].label} – ${months[vis[vis.length - 1]].label}`
    : 'Belum ada tagihan';

  const visUnpaid = vis.filter(i => !isCreditPaidMonth(i));
  const proyeksiVal  = visUnpaid.length === 0 ? 'Lunas!' : months[visUnpaid[visUnpaid.length - 1]].label;
  const proyeksiNote = visUnpaid.length === 0 ? 'semua kredit selesai' : `${visUnpaid.length} bulan tersisa`;

  const cards = [
    {
      label: 'Total Kredit',
      val: fmt(grandCreditTotalNow),
      color: 'text-brand',
      note: 'excl. kosan & dana darurat',
      icon: 'credit-card',
      iconColor: '#FF6B35',
    },
    {
      label: 'Sisa Belum Lunas',
      val: fmt(sisaCreditTotal),
      color: 'text-spaylater',
      note: 'kredit saja',
      icon: 'clock',
      iconColor: '#3B9EFF',
    },
    {
      label: 'Durasi',
      val: `${vis.length} Bulan`,
      color: 'text-sp1',
      note: rangeNote,
      icon: 'calendar',
      iconColor: '#A78BFA',
    },
    {
      label: 'Level XP',
      val: `Lv. ${stats.xpLevel}`,
      color: 'text-sp2',
      note: `${stats.xp} XP total`,
      icon: 'star',
      iconColor: '#34D399',
    },
    {
      label: 'Proyeksi Lunas',
      val: proyeksiVal,
      color: 'text-darurat',
      note: proyeksiNote,
      icon: 'flag',
      iconColor: '#F472B6',
    },
  ];

  document.getElementById('summary').innerHTML = cards.map(c => `
    <div class="bg-white dark:bg-[#13131C] border border-gray-200 dark:border-[#1E1E2A] rounded-xl p-3">
      <div class="flex items-center gap-1.5 mb-1">
        <i data-lucide="${c.icon}" class="w-3 h-3" style="color:${c.iconColor}"></i>
        <p class="text-[9px] tracking-[2px] text-gray-400 dark:text-gray-600 uppercase">${c.label}</p>
      </div>
      <p class="font-sora font-semibold text-base ${c.color}">${c.val}</p>
      <p class="text-[9px] text-gray-400 dark:text-gray-600 mt-0.5">${c.note}</p>
    </div>
  `).join('');
  lucide.createIcons();
  buildAlerts(vis);
  buildTrendChart(vis);
}

// ── Tunggakan alert ────────────────────────────────────────
function buildAlerts(vis) {
  const el = document.getElementById('alerts');
  if (!el) return;
  const curIdx = currentMonthIndex();
  const overdueMonths = curIdx === -1 ? [] : vis.filter(i => i < curIdx && !isCreditPaidMonth(i));
  if (overdueMonths.length === 0) { el.innerHTML = ''; return; }
  const labels = overdueMonths.map(i => months[i].label).join(', ');
  el.innerHTML = `
    <div class="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2.5 mb-4">
      <i data-lucide="alert-triangle" class="w-4 h-4 text-red-500 shrink-0 mt-0.5"></i>
      <p class="text-[11px] text-red-600 dark:text-red-400 leading-relaxed">
        Ada <b>${overdueMonths.length} bulan</b> sebelumnya yang belum lunas: ${labels}
      </p>
    </div>`;
  lucide.createIcons({ nodes: [el] });
}

// ── Tren pengeluaran ───────────────────────────────────────
function buildTrendChart(vis) {
  const el = document.getElementById('trend-chart');
  if (!el) return;
  if (vis.length === 0) { el.innerHTML = ''; return; }
  const totals = vis.map(i => emTotal(i));
  const max = Math.max(...totals, 1);
  el.innerHTML = `
    <div class="flex items-end gap-1.5 overflow-x-auto pb-1" style="min-height:90px">
      ${vis.map((i, idx) => {
        const h = Math.max(4, Math.round(totals[idx] / max * 72));
        const short = months[i].label.split(' ')[0].slice(0, 3);
        return `
          <div class="flex flex-col items-center gap-1 shrink-0" style="width:20px" title="${months[i].label}: ${fmt(totals[idx])}">
            <div style="height:${h}px;width:10px;background:${isCreditPaidMonth(i) ? '#34D399' : '#FF6B35'}" class="rounded-sm"></div>
            <span class="text-[7px] text-gray-400 dark:text-gray-600 rotate-0">${short}</span>
          </div>`;
      }).join('')}
    </div>`;
}

// ── Gamification UI ───────────────────────────────────────
function updateGamUI(stats) {
  document.getElementById('xp-bar').style.width   = stats.xpInLevel + '%';
  document.getElementById('xp-label').textContent  = `${stats.xpInLevel} / 100`;
  const totalM = stats.total || 1;
  document.getElementById('month-bar').style.width = (stats.monthsPaid / totalM * 100).toFixed(1) + '%';
  document.getElementById('month-label').textContent = `${stats.monthsPaid} / ${stats.total}`;
  document.getElementById('streak-num').textContent  = stats.streak;

  const pct = stats.total ? stats.monthsPaid / stats.total : 0;
  const titles = [
    [0,    'Mulai perjalananmu'],
    [0.05, 'Bagus, terus jalan!'],
    [0.15, 'Konsisten! Keren'],
    [0.33, 'Setengah jalan, gas!'],
    [0.7,  'Hampir selesai!'],
    [1,    'LUNAS SEMUA! Mantap!'],
  ];
  let title = titles[0][1];
  for (const [min, t] of titles) { if (pct >= min) title = t; }
  document.getElementById('gam-title').textContent = title;

  const badgesEl = document.getElementById('badges');
  badgesEl.innerHTML = '';
  if (stats.earnedBadges.length === 0) {
    badgesEl.innerHTML = `
      <span class="text-[10px] text-gray-400 dark:text-gray-600 flex items-center gap-1">
        <i data-lucide="lock" class="w-3 h-3"></i>
        Belum ada badge — mulai bayar tagihan!
      </span>`;
  } else {
    stats.earnedBadges.forEach(id => {
      const b = BADGE_DEFS.find(x => x.id === id);
      if (!b) return;
      const color = BADGE_COLORS[id] || '#FF6B35';
      badgesEl.innerHTML += `
        <div class="badge-item flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-sora font-semibold"
          style="border-color:${color}20; background:${color}15; color:${color}" title="${b.desc}">
          <i data-lucide="${b.icon}" class="w-3 h-3"></i>
          ${b.label}
        </div>`;
    });
  }
  lucide.createIcons();
}

// ── Confetti ──────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -120,
    r: Math.random() * 6 + 3,
    color: Object.values(COLORS)[Math.floor(Math.random() * 6)],
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    rot: Math.random() * 360,
    vr: (Math.random() - 0.5) * 8,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.06;
    });
    if (++frame < 140) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ── Toast ─────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, iconName = 'check-circle') {
  const t  = document.getElementById('toast');
  const ic = document.getElementById('toast-icon');
  const tx = document.getElementById('toast-text');
  ic.setAttribute('data-lucide', iconName);
  tx.textContent = msg;
  lucide.createIcons();
  t.style.opacity   = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.style.opacity   = '0';
    t.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2400);
}

// ── XP pop ────────────────────────────────────────────────
function showXpPop(x, y) {
  const el = document.createElement('div');
  el.className = 'xp-pop flex items-center gap-1';
  el.innerHTML = `<i data-lucide="zap" class="w-4 h-4"></i>+10 XP`;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  lucide.createIcons({ nodes: [el] });
  setTimeout(() => el.remove(), 900);
}

// ── Build month list ──────────────────────────────────────
function buildList() {
  const list = document.getElementById('list');
  list.innerHTML = '';

  months.forEach((m, i) => {
    if (deletedMonths.includes(i)) return;

    const allPaid    = isCreditPaidMonth(i);
    const cTotal      = emCreditTotal(i);
    const tTotal       = emTotal(i);
    const activeKeys = KEYS.filter(k => !disabledKeys.includes(k) && emVal(i, k) > 0);

    const barSegs = activeKeys.map(k =>
      `<div style="width:${(emVal(i,k)/(tTotal||1)*100).toFixed(1)}%;background:${COLORS[k]}" class="h-full"></div>`
    ).join('') + emCustomList(i).map(c =>
      `<div style="width:${(c.amount/(tTotal||1)*100).toFixed(1)}%;background:#9CA3AF" class="h-full"></div>`
    ).join('');

    const rows = activeKeys.map(k => {
      const isPaid  = !!paid[paidKey(i, k)];
      const isKosan = k === 'kosan';
      const isDar   = k === 'darurat';
      const isEdited = overrides[paidKey(i, k)] !== undefined;
      const badgeEl = isKosan
        ? `<span class="text-[9px] text-kosan ml-1 flex items-center gap-0.5">
             <i data-lucide="home" class="w-2.5 h-2.5"></i>tetap</span>`
        : isDar
        ? `<span class="text-[9px] text-darurat ml-1 flex items-center gap-0.5">
             <i data-lucide="piggy-bank" class="w-2.5 h-2.5"></i>tabungan</span>`
        : '';
      const editedDot = isEdited
        ? `<span class="w-1.5 h-1.5 rounded-full bg-brand ml-1" title="Nilai custom"></span>` : '';
      const due = !isPaid ? dueInfo(i, k) : null;
      const dueEl = (due && due.diffDays <= 5)
        ? due.overdue
          ? `<span class="text-[9px] text-red-500 ml-1 flex items-center gap-0.5"><i data-lucide="alert-circle" class="w-2.5 h-2.5"></i>Telat ${Math.abs(due.diffDays)}h</span>`
          : `<span class="text-[9px] text-orange-500 ml-1 flex items-center gap-0.5"><i data-lucide="bell" class="w-2.5 h-2.5"></i>H-${due.diffDays}</span>`
        : '';

      return `
        <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#1e1e2a]
          last:border-0 ${isPaid ? 'paid-row' : ''}" id="row-${i}-${k}">
          <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
            <input type="checkbox" ${isPaid ? 'checked' : ''}
              onchange="togglePaid(event,${i},'${k}')"
              class="rounded w-[18px] h-[18px] shrink-0" style="accent-color:#FF6B35" />
            <span class="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1 flex-wrap
              ${isPaid ? 'paid-label' : ''}" id="lbl-${i}-${k}">
              ${NAMES[k]}${badgeEl}${editedDot}${dueEl}
            </span>
          </label>
          <button type="button" onclick="editAmount(event,${i},'${k}')"
            class="p-1 text-gray-300 dark:text-gray-600 hover:text-brand shrink-0" aria-label="Edit">
            <i data-lucide="pencil" class="w-3 h-3"></i>
          </button>
          <span class="text-[12px] font-medium ml-1 shrink-0" style="color:${COLORS[k]}">${fmt(emVal(i,k))}</span>
        </div>`;
    }).join('');

    const customRows = emCustomList(i).map(c => {
      const cKey = `custom-${c.id}`;
      const isPaid = !!paid[paidKey(i, cKey)];
      return `
        <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#1e1e2a]
          last:border-0 ${isPaid ? 'paid-row' : ''}" id="row-${i}-${cKey}">
          <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
            <input type="checkbox" ${isPaid ? 'checked' : ''}
              onchange="toggleCustomPaid(event,${i},'${c.id}')"
              class="rounded w-[18px] h-[18px] shrink-0" style="accent-color:#FF6B35" />
            <span class="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1 flex-wrap
              ${isPaid ? 'paid-label' : ''}" id="lbl-${i}-${cKey}">
              ${c.name}<span class="text-[9px] text-gray-400 ml-1">custom</span>
            </span>
          </label>
          <button type="button" onclick="editCustomBill(event,${i},'${c.id}')"
            class="p-1 text-gray-300 dark:text-gray-600 hover:text-brand shrink-0" aria-label="Edit"><i data-lucide="pencil" class="w-3 h-3"></i></button>
          <button type="button" onclick="deleteCustomBill(event,${i},'${c.id}')"
            class="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 shrink-0" aria-label="Hapus"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
          <span class="text-[12px] font-medium ml-1 shrink-0 text-gray-700 dark:text-gray-300">${fmt(c.amount)}</span>
        </div>`;
    }).join('');

    const addRow = `
      <button type="button" onclick="addCustomBill(event,${i})"
        class="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-gray-400 dark:text-gray-500 hover:text-brand border-b border-gray-100 dark:border-[#1e1e2a] last:border-0">
        <i data-lucide="plus" class="w-3 h-3"></i>Tambah tagihan custom
      </button>`;

    const inc = emIncome(i);
    const sisa = emSisa(i);
    const incomeRow = `
      <div class="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 dark:border-[#1e1e2a]">
        <span class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
          <i data-lucide="wallet" class="w-3 h-3"></i>Pemasukan
        </span>
        <button type="button" onclick="editIncome(event,${i})" class="flex items-center gap-1 text-[12px] font-medium text-sp2">
          ${fmt(inc)}<i data-lucide="pencil" class="w-2.5 h-2.5 text-gray-300"></i>
        </button>
      </div>
      ${inc > 0 ? `
      <div class="flex justify-between pt-1">
        <span class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">Sisa</span>
        <span class="font-sora font-semibold text-sm ${sisa >= 0 ? 'text-sp2' : 'text-red-500'}">${fmt(sisa)}</span>
      </div>` : ''}`;

    const creditTotalRow = `
      <div class="flex justify-between pt-2 mt-1 border-t border-gray-100 dark:border-[#1e1e2a]">
        <span class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
          <i data-lucide="credit-card" class="w-3 h-3"></i>Total Kredit
        </span>
        <span class="font-sora font-bold text-sm text-brand">${fmt(cTotal)}</span>
      </div>
      <div class="flex justify-between pt-1.5">
        <span class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
          <i data-lucide="receipt" class="w-3 h-3"></i>Total Semua
        </span>
        <span class="font-sora font-semibold text-sm text-gray-900 dark:text-white">${fmt(tTotal)}</span>
      </div>`;

    const paidBadgeHTML = allPaid
      ? `<span class="paid-badge-el ml-2 text-[9px] bg-green-100 dark:bg-green-900/40
           text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full
           tracking-wider font-sora font-semibold flex items-center gap-0.5">
           <i data-lucide="check" class="w-2.5 h-2.5"></i>LUNAS</span>` : '';

    const card = document.createElement('details');
    card.className = `card-enter bg-white dark:bg-[#13131C] border rounded-xl overflow-hidden transition-all duration-200
      ${allPaid ? 'border-green-300 dark:border-green-800' : 'border-gray-200 dark:border-[#1E1E2A]'}`;
    card.id = `card-${i}`;
    card.innerHTML = `
      <summary class="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none active:opacity-75">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1 flex-wrap">
            <span class="font-sora font-semibold text-sm text-gray-900 dark:text-gray-100">${m.label}</span>
            ${paidBadgeHTML}
          </div>
          <div class="h-1.5 rounded-full overflow-hidden flex mt-2 bg-gray-100 dark:bg-[#0f0f13]">${barSegs}</div>
        </div>
        <div class="text-right ml-4 flex-shrink-0 flex flex-col items-end gap-0.5">
          <div class="font-sora font-bold text-sm text-brand">${fmt(cTotal)}</div>
          <div class="text-[9px] text-gray-400 dark:text-gray-600">${fmt(tTotal)} total</div>
          <div class="flex items-center gap-1 mt-0.5">
            <button type="button" onclick="deleteMonth(event,${i})"
              class="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500" aria-label="Hapus bulan">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
            <i data-lucide="chevron-down" class="chevron w-3.5 h-3.5 text-gray-400"></i>
          </div>
        </div>
      </summary>
      <div class="px-4 pb-3 border-t border-gray-100 dark:border-[#1e1e2a] pt-1">
        ${rows}
        ${customRows}
        ${addRow}
        ${creditTotalRow}
        ${incomeRow}
      </div>
    `;
    list.appendChild(card);
  });

  lucide.createIcons();
}

// ── Toggle paid ───────────────────────────────────────────
function togglePaid(event, i, k) {
  paid[paidKey(i, k)] = event.target.checked;
  savePaid();

  const row = document.getElementById(`row-${i}-${k}`);
  const lbl = document.getElementById(`lbl-${i}-${k}`);
  if (paid[paidKey(i, k)]) {
    row.classList.add('paid-row');
    lbl.classList.add('paid-label');
    const rect = event.target.getBoundingClientRect();
    showXpPop(rect.left + window.scrollX - 8, rect.top + window.scrollY - 12);
  } else {
    row.classList.remove('paid-row');
    lbl.classList.remove('paid-label');
  }

  const allPaid = isCreditPaidMonth(i);
  const card    = document.getElementById(`card-${i}`);

  // Update card border
  if (allPaid) {
    card.classList.remove('border-gray-200', 'dark:border-[#1E1E2A]');
    card.classList.add('border-green-300', 'dark:border-green-800');
  } else {
    card.classList.remove('border-green-300', 'dark:border-green-800');
    card.classList.add('border-gray-200', 'dark:border-[#1E1E2A]');
  }

  // Update LUNAS badge in summary
  const summaryEl  = card.querySelector('summary');
  const existBadge = summaryEl.querySelector('.paid-badge-el');
  if (allPaid && !existBadge) {
    const b = document.createElement('span');
    b.className = 'paid-badge-el ml-2 text-[9px] bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full tracking-wider font-sora font-semibold flex items-center gap-0.5';
    b.innerHTML = `<i data-lucide="check" class="w-2.5 h-2.5"></i>LUNAS`;
    summaryEl.querySelector('.flex.items-center.gap-1').appendChild(b);
    lucide.createIcons({ nodes: [b] });
    launchConfetti();
    showToast(months[i].label + ' LUNAS!', 'party-popper');
  } else if (!allPaid && existBadge) {
    existBadge.remove();
  }

  const stats = computeStats();
  updateGamUI(stats);
  buildSummary();

  stats.newBadges.forEach((b, idx) => {
    setTimeout(() => showToast('Badge baru: ' + b.label, b.icon), 700 + idx * 800);
  });
}

// ── Edit / delete actions ─────────────────────────────────
function refreshAll() {
  buildSummary();
  buildList();
  updateGamUI(computeStats());
  updateLegend();
}

function updateLegend() {
  KEYS.forEach(k => {
    const el = document.querySelector(`[data-legend="${k}"]`);
    if (el) el.style.display = disabledKeys.includes(k) ? 'none' : '';
  });
}

function editAmount(event, i, k) {
  event.stopPropagation();
  event.preventDefault();
  const current = emVal(i, k);
  const input = prompt(`Edit jumlah ${NAMES[k]} — ${months[i].label}\n(kosongkan & OK untuk reset ke default)`, current);
  if (input === null) return; // batal
  const trimmed = input.trim();
  if (trimmed === '') {
    delete overrides[paidKey(i, k)];
    saveOverrides();
    showToast('Dikembalikan ke default', 'rotate-ccw');
    refreshAll();
    return;
  }
  const val = parseInt(trimmed.replace(/[^\d]/g, ''), 10);
  if (isNaN(val) || val < 0) {
    showToast('Nilai tidak valid', 'alert-triangle');
    return;
  }
  overrides[paidKey(i, k)] = val;
  saveOverrides();
  showToast('Tagihan diperbarui', 'pencil');
  refreshAll();
}

function deleteMonth(event, i) {
  event.stopPropagation();
  event.preventDefault();
  if (!confirm(`Hapus tagihan ${months[i].label}? Bisa dimunculkan lagi lewat Pengaturan.`)) return;
  if (!deletedMonths.includes(i)) deletedMonths.push(i);
  saveDeleted();
  showToast(months[i].label + ' dihapus', 'trash-2');
  refreshAll();
}

function editIncome(event, i) {
  event.stopPropagation();
  event.preventDefault();
  const input = prompt(`Pemasukan — ${months[i].label}`, emIncome(i) || '');
  if (input === null) return;
  const val = parseInt(input.replace(/[^\d]/g, ''), 10);
  income[i] = isNaN(val) ? 0 : val;
  saveIncome();
  showToast('Pemasukan diperbarui', 'wallet');
  refreshAll();
}

function addCustomBill(event, i) {
  event.stopPropagation();
  event.preventDefault();
  const name = prompt('Nama tagihan baru:');
  if (!name || !name.trim()) return;
  const amountStr = prompt(`Jumlah untuk "${name.trim()}":`);
  if (amountStr === null) return;
  const amount = parseInt(amountStr.replace(/[^\d]/g, ''), 10);
  if (isNaN(amount) || amount < 0) { showToast('Nilai tidak valid', 'alert-triangle'); return; }
  if (!customBills[i]) customBills[i] = [];
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  customBills[i].push({ id, name: name.trim(), amount });
  saveCustomBills();
  showToast('Tagihan custom ditambahkan', 'plus');
  refreshAll();
}

function editCustomBill(event, i, id) {
  event.stopPropagation();
  event.preventDefault();
  const bill = (customBills[i] || []).find(c => c.id === id);
  if (!bill) return;
  const amountStr = prompt(`Edit jumlah "${bill.name}":`, bill.amount);
  if (amountStr === null) return;
  const val = parseInt(amountStr.replace(/[^\d]/g, ''), 10);
  if (isNaN(val) || val < 0) { showToast('Nilai tidak valid', 'alert-triangle'); return; }
  bill.amount = val;
  saveCustomBills();
  showToast('Tagihan custom diperbarui', 'pencil');
  refreshAll();
}

function deleteCustomBill(event, i, id) {
  event.stopPropagation();
  event.preventDefault();
  if (!confirm('Hapus tagihan custom ini?')) return;
  customBills[i] = (customBills[i] || []).filter(c => c.id !== id);
  saveCustomBills();
  showToast('Tagihan custom dihapus', 'trash-2');
  refreshAll();
}

function toggleCustomPaid(event, i, id) {
  const cKey = `custom-${id}`;
  paid[paidKey(i, cKey)] = event.target.checked;
  savePaid();
  const row = document.getElementById(`row-${i}-${cKey}`);
  const lbl = document.getElementById(`lbl-${i}-${cKey}`);
  if (paid[paidKey(i, cKey)]) { row.classList.add('paid-row'); lbl.classList.add('paid-label'); }
  else { row.classList.remove('paid-row'); lbl.classList.remove('paid-label'); }
}

// ── Settings panel (kelola kategori & bulan) ──────────────
function openSettings() {
  renderSettings();
  document.getElementById('settings-overlay').classList.remove('hidden');
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
}
function toggleCategory(key) {
  const idx = disabledKeys.indexOf(key);
  if (idx === -1) {
    if (!confirm(`Nonaktifkan semua tagihan ${NAMES[key]} di semua bulan?`)) return;
    disabledKeys.push(key);
  } else {
    disabledKeys.splice(idx, 1);
  }
  saveDisabled();
  refreshAll();
  renderSettings();
}
function toggleMonthVisibility(i) {
  const idx = deletedMonths.indexOf(i);
  if (idx === -1) deletedMonths.push(i);
  else deletedMonths.splice(idx, 1);
  saveDeleted();
  refreshAll();
  renderSettings();
}
function renderSettings() {
  const catEl = document.getElementById('settings-categories');
  catEl.innerHTML = KEYS.map(k => `
    <label class="flex items-center justify-between py-1.5 text-[12px] cursor-pointer">
      <span class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${COLORS[k]}"></span>
        ${NAMES[k]}
      </span>
      <input type="checkbox" ${disabledKeys.includes(k) ? '' : 'checked'}
        onchange="toggleCategory('${k}')" style="accent-color:#FF6B35" class="w-4 h-4" />
    </label>
  `).join('');

  const moEl = document.getElementById('settings-months');
  moEl.innerHTML = months.map((m, i) => `
    <label class="flex items-center justify-between py-1.5 text-[12px] cursor-pointer">
      <span>${m.label}</span>
      <input type="checkbox" ${deletedMonths.includes(i) ? '' : 'checked'}
        onchange="toggleMonthVisibility(${i})" style="accent-color:#FF6B35" class="w-4 h-4" />
    </label>
  `).join('');

  const dueEl = document.getElementById('settings-due');
  dueEl.innerHTML = KEYS.filter(k => !disabledKeys.includes(k)).map(k => `
    <div class="flex items-center justify-between py-1.5 text-[12px]">
      <span class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${COLORS[k]}"></span>
        ${NAMES[k]}
      </span>
      <input type="number" min="1" max="31" value="${dueDays[k] || ''}"
        onchange="setDueDay('${k}', this.value)"
        class="w-14 text-right text-[12px] px-2 py-1 rounded-md border border-gray-200 dark:border-[#1E1E2A] bg-transparent" />
    </div>
  `).join('');

  const notifBtn = document.getElementById('notif-toggle-label');
  if (notifBtn) notifBtn.textContent = notifEnabled ? 'Notifikasi: Aktif' : 'Aktifkan Notifikasi';

  lucide.createIcons();
}

function setDueDay(k, val) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1 || n > 31) { delete dueDays[k]; } else { dueDays[k] = n; }
  saveDueDays();
  refreshAll();
}

// ── Notifikasi browser (H-1 tagihan bulan berjalan) ───────
async function toggleNotif() {
  if (!('Notification' in window)) { showToast('Browser tidak mendukung notifikasi', 'alert-triangle'); return; }
  if (!notifEnabled) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { showToast('Izin notifikasi ditolak', 'alert-triangle'); return; }
    notifEnabled = true;
  } else {
    notifEnabled = false;
  }
  localStorage.setItem('notifEnabled3', notifEnabled ? '1' : '0');
  renderSettings();
  checkDueNotifications();
}

function checkDueNotifications() {
  if (!notifEnabled || Notification.permission !== 'granted') return;
  const today = new Date().toDateString();
  if (localStorage.getItem('notifiedDate3') === today) return;
  const i = currentMonthIndex();
  if (i === -1 || deletedMonths.includes(i)) return;
  const due = KEYS.filter(k => !disabledKeys.includes(k) && emVal(i, k) > 0 && !paid[paidKey(i, k)])
    .map(k => ({ k, info: dueInfo(i, k) }))
    .filter(x => x.info && x.info.diffDays <= 1);
  if (due.length === 0) return;
  due.forEach(x => {
    new Notification('Tagihan jatuh tempo', {
      body: `${NAMES[x.k]} — ${x.info.overdue ? 'sudah lewat jatuh tempo' : 'jatuh tempo besok/hari ini'}`,
    });
  });
  localStorage.setItem('notifiedDate3', today);
}

// ── Export / Import data ──────────────────────────────────
function exportData() {
  const payload = {
    paid3: paid, overrides3: overrides, disabledKeys3: disabledKeys,
    deletedMonths3: deletedMonths, income3: income, customBills3: customBills,
    dueDays3: dueDays, badges: JSON.parse(localStorage.getItem('badges') || '[]'),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tagihan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup diunduh', 'download');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Object.entries(data).forEach(([key, val]) => localStorage.setItem(key, JSON.stringify(val)));
      showToast('Data dipulihkan, memuat ulang...', 'check-circle');
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      showToast('File tidak valid', 'alert-triangle');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── Init ──────────────────────────────────────────────────
buildSummary();
buildList();
updateGamUI(computeStats());
updateLegend();
checkDueNotifications();
