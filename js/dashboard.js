let allStockRows = [];
let currentFilteredRows = [];
let sortState = { key: null, dir: 'asc' };

const pickField = (obj, keys, fallback = '-') => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }
  return fallback;
};

const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function showToast(message) {
  let toast = document.getElementById('toastBox');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastBox';
    toast.className =
      'fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-cyan-400/50 text-cyan-200 text-xs font-mono shadow-xl transition-all';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

function copyText(event, text) {
  event.stopPropagation();
  if (!text || text === '-') return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(String(text));
  }
  showToast(`COPIED: ${text}`);
}

function clearFilters() {
  const searchInput = document.getElementById('searchInput');
  const searchColumn = document.getElementById('searchColumn');
  const statusFilter = document.getElementById('statusFilter');

  if (searchInput) searchInput.value = '';
  if (searchColumn) searchColumn.value = 'all';
  if (statusFilter) statusFilter.value = 'all';
  sortState = { key: null, dir: 'asc' };

  renderTable(allStockRows);
}

function getColumnValue(item, colKey) {
  const map = {
    StockBoxID: ['StockBoxID', 'stock_box_id', 'Row ID'],
    Part_Name: ['Part_Name', 'part_name', 'Product'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No'],
    Location_Name: ['Location_Name', 'location_name', 'LocationID', 'location_id'],
    QtyBalance: ['QtyBalance', 'qty_balance', 'Qty', 'qty']
  };
  const val = pickField(item, map[colKey] || [colKey], '');
  if (colKey === 'QtyBalance') {
    return Number(val) || 0;
  }
  return String(val === '-' ? '' : val).toLowerCase();
}

function sortByColumn(colKey) {
  if (sortState.key === colKey) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.key = colKey;
    sortState.dir = colKey === 'QtyBalance' ? 'desc' : 'asc';
  }
  renderTable(allStockRows);
}

function initSortableHeaders() {
  const ths = document.querySelectorAll('thead th');
  const keyByIndex = ['StockBoxID', 'Part_Name', 'LotNo', 'Location_Name', 'QtyBalance'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    th.classList.add('cursor-pointer', 'select-none', 'hover:text-cyan-300', 'transition');
    th.title = 'คลิกเพื่อเรียงลำดับ';
    th.onclick = () => sortByColumn(key);
  });
}

function updateSortIndicators() {
  const ths = document.querySelectorAll('thead th');
  const keyByIndex = ['StockBoxID', 'Part_Name', 'LotNo', 'Location_Name', 'QtyBalance'];
  const baseLabels = ['StockBoxID', 'Part_Name', 'LotNo', 'Location', 'QtyBalance'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    let arrow = ' ↕';
    if (sortState.key === key) {
      arrow = sortState.dir === 'asc' ? ' ↑' : ' ↓';
      th.classList.add('text-cyan-300');
    } else {
      th.classList.remove('text-cyan-300');
    }
    th.textContent = `${baseLabels[index]}${arrow}`;
  });
}

async function loadDashboard() {
  const loading = document.getElementById('loadingBanner');
  const icon = document.getElementById('refreshIcon');
  const tbody = document.getElementById('stockTableBody');
  const badge = document.getElementById('dbStatusBadge');

  loading?.classList.remove('hidden');
  icon?.classList.add('animate-spin');

  try {
    if (typeof _supabase === 'undefined') {
      throw new Error('ไม่พบตัวแปร _supabase กรุณาตรวจสอบไฟล์ js/config.js');
    }

    const { data, error } = await _supabase.from('stock_box').select('*');
    if (error) throw error;

    allStockRows = Array.isArray(data) ? data : [];
    updateKPIs(allStockRows);
    renderTable(allStockRows);

    const now = new Date();
    const lastSyncEl = document.getElementById('kpiLastSync');
    const statusTextEl = document.getElementById('kpiStatusText');
    if (lastSyncEl) lastSyncEl.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
    if (statusTextEl) statusTextEl.textContent = 'เชื่อมต่อ Supabase สำเร็จ';

    if (badge) {
      badge.className =
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30';
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>LIVE`;
    }
  } catch (err) {
    console.error('Dashboard Error:', err);
    if (badge) {
      badge.className =
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30';
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>ERROR`;
    }
    const statusTextEl = document.getElementById('kpiStatusText');
    if (statusTextEl) statusTextEl.textContent = err.message || 'โหลดข้อมูลไม่สำเร็จ';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-rose-400 font-mono text-xs">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  } finally {
    loading?.classList.add('hidden');
    icon?.classList.remove('animate-spin');
  }
}

function updateKPIs(rows) {
  let totalQty = 0;
  const locSet = new Set();

  rows.forEach((r) => {
    const qty = Number(pickField(r, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;
    const loc = pickField(r, ['Location_Name', 'location_name', 'LocationID', 'location_id'], '');
    totalQty += qty;
    if (loc) locSet.add(String(loc).trim());
  });

  document.getElementById('kpiTotalBoxes').textContent = rows.length.toLocaleString();
  document.getElementById('kpiTotalQty').textContent = totalQty.toLocaleString();
  document.getElementById('kpiActiveLocs').textContent = locSet.size.toLocaleString();
}

function getFilteredRows(rows) {
  const col = document.getElementById('searchColumn')?.value || 'all';
  const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const status = document.getElementById('statusFilter')?.value || 'all';
  const clearBtn = document.getElementById('clearSearchBtn');

  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !q && col === 'all' && status === 'all' && !sortState.key);
  }

  const colKeyMap = {
    StockBoxID: ['StockBoxID', 'stock_box_id', 'Row ID'],
    Part_Name: ['Part_Name', 'part_name', 'Product'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No'],
    Location_Name: ['Location_Name', 'location_name', 'LocationID', 'location_id']
  };

  let result = rows.filter((r) => {
    const qty = Number(pickField(r, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;
    if (status === 'available' && qty <= 0) return false;
    if (status === 'empty' && qty > 0) return false;

    if (!q) return true;

    if (col === 'all') {
      return JSON.stringify(r).toLowerCase().includes(q);
    }

    const targetVal = String(pickField(r, colKeyMap[col] || [col], '')).toLowerCase();
    return targetVal.includes(q);
  });

  if (sortState.key) {
    const { key, dir } = sortState;
    const factor = dir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      const valA = getColumnValue(a, key);
      const valB = getColumnValue(b, key);
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * factor;
      }
      return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * factor;
    });
  }

  return result;
}

function renderTable(rows) {
  const tbody = document.getElementById('stockTableBody');
  currentFilteredRows = getFilteredRows(rows);
  updateSortIndicators();
  document.getElementById('showingCount').textContent = currentFilteredRows.length.toLocaleString();

  if (!tbody) return;

  if (currentFilteredRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-slate-400">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  currentFilteredRows.forEach((item, idx) => {
    const boxId = pickField(item, ['StockBoxID', 'stock_box_id', 'Row ID']);
    const partName = pickField(item, ['Part_Name', 'part_name', 'Product']);
    const lotNo = pickField(item, ['LotNo', 'lot_no', 'Lot_No']);
    const loc = pickField(item, ['Location_Name', 'location_name', 'LocationID', 'location_id']);
    const qty = Number(pickField(item, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-cyan-500/5 transition cursor-pointer group';
    tr.onclick = () => openDrawerByIndex(idx);

    const safeBoxId = escapeHtml(boxId);
    const safePartName = escapeHtml(partName);
    const safeLotNo = escapeHtml(lotNo);
    const safeLoc = escapeHtml(loc);
    const jsSafeBoxId = String(boxId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    tr.innerHTML = `
      <td class="py-3.5 px-4 font-mono text-xs sm:text-sm font-semibold text-cyan-300 group-hover:text-cyan-200">
        <div class="inline-flex items-center gap-2">
          <span>${safeBoxId}</span>
          <button type="button" onclick="copyText(event, '${jsSafeBoxId}')" title="คัดลอกรหัส"
            class="opacity-70 hover:opacity-100 text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 cursor-pointer">Copy</button>
        </div>
      </td>
      <td class="py-3.5 px-4 text-slate-100 font-medium">${safePartName}</td>
      <td class="py-3.5 px-4 font-mono text-xs text-slate-300">${safeLotNo}</td>
      <td class="py-3.5 px-4">
        <a href="location.html?highlight=${encodeURIComponent(String(loc))}" onclick="event.stopPropagation()"
          class="px-2.5 py-1 rounded-lg font-mono text-xs bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-400/25 inline-block transition">
          ${safeLoc} ↗
        </a>
      </td>
      <td class="py-3.5 px-4 text-right font-mono font-bold ${qty > 0 ? 'text-emerald-300' : 'text-slate-500'}">${qty.toLocaleString()}</td>
      <td class="py-3.5 px-4 text-center">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${
          qty > 0
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            : 'bg-slate-800 text-slate-400 border border-slate-700'
        }">${qty > 0 ? 'พร้อมใช้' : 'หมด'}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openDrawerByIndex(index) {
  const item = currentFilteredRows[index];
  if (!item) return;
  const title = pickField(item, ['StockBoxID', 'stock_box_id', 'Row ID']);
  document.getElementById('drawerTitle').textContent = title;
  const dl = document.getElementById('drawerContent');
  dl.innerHTML = Object.entries(item)
    .map(
      ([key, val]) => `
      <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-3">
        <dt class="text-xs font-mono text-slate-400">${escapeHtml(key)}</dt>
        <dd class="text-xs font-mono text-slate-100 text-right break-all">${escapeHtml(val ?? '-')}</dd>
      </div>
    `
    )
    .join('');
  document.getElementById('detailDrawer').classList.remove('hidden');
}

function closeDrawer() {
  document.getElementById('detailDrawer')?.classList.add('hidden');
}

function exportFilteredToCSV() {
  if (!currentFilteredRows.length) {
    showToast('ไม่มีข้อมูลสำหรับ Export');
    return;
  }

  const headers = ['StockBoxID', 'Part_Name', 'LotNo', 'Location_Name', 'QtyBalance', 'Status'];
  const escapeCSV = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const lines = [
    headers.map(escapeCSV).join(','),
    ...currentFilteredRows.map((item) => {
      const boxId = pickField(item, ['StockBoxID', 'stock_box_id', 'Row ID']);
      const partName = pickField(item, ['Part_Name', 'part_name', 'Product']);
      const lotNo = pickField(item, ['LotNo', 'lot_no', 'Lot_No']);
      const loc = pickField(item, ['Location_Name', 'location_name', 'LocationID', 'location_id']);
      const qty = Number(pickField(item, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;
      const status = qty > 0 ? 'พร้อมใช้' : 'หมด';
      return [boxId, partName, lotNo, loc, qty, status].map(escapeCSV).join(',');
    })
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `stock_box_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`EXPORTED ${currentFilteredRows.length} ROWS`);
}

document.addEventListener('DOMContentLoaded', () => {
  initSortableHeaders();
  document.getElementById('searchInput')?.addEventListener('input', () => renderTable(allStockRows));
  document.getElementById('searchColumn')?.addEventListener('change', () => renderTable(allStockRows));
  document.getElementById('statusFilter')?.addEventListener('change', () => renderTable(allStockRows));
  loadDashboard();
});