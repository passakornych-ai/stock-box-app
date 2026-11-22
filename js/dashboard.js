let allStockRows = [];
let currentFilteredRows = [];
let sortState = { key: null, dir: 'asc' };

const getClient = () => window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

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
    toast.className = 'mono';
    toast.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:60;padding:10px 16px;border-radius:11px;background:var(--bg-surface);border:1px solid var(--c-cyan);color:var(--c-cyan);font-size:12px;font-weight:600;box-shadow:0 12px 28px rgba(0,0,0,0.22);';
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
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = ['StockBoxID', 'Part_Name', 'LotNo', 'Location_Name', 'QtyBalance'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.title = 'คลิกเพื่อเรียงลำดับ';
    th.onclick = () => sortByColumn(key);
  });
}

function updateSortIndicators() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = ['StockBoxID', 'Part_Name', 'LotNo', 'Location_Name', 'QtyBalance'];
  const baseLabels = ['STOCKBOXID', 'PART_NAME', 'LOTNO', 'LOCATION', 'QTYBALANCE'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    let arrow = ' ↕';
    if (sortState.key === key) {
      arrow = sortState.dir === 'asc' ? ' ↑' : ' ↓';
      th.style.color = 'var(--c-cyan)';
    } else {
      th.style.color = 'var(--text-muted)';
    }
    th.textContent = `${baseLabels[index]}${arrow}`;
  });
}

async function loadDashboard() {
  const loading = document.getElementById('loadingBanner');
  const tbody = document.getElementById('stockTableBody');
  const badge = document.getElementById('dbStatusBadge');

  loading?.classList.remove('hidden');

  try {
    const client = getClient();
    if (!client) {
      throw new Error('ยังไม่ได้สร้าง Supabase client (_supabase) กรุณาเช็กไฟล์ js/config.js');
    }

    const { data, error } = await client.from('stock_box').select('*');
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
      badge.className = 'mono status-pill-active';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.textContent = '● LIVE';
    }
  } catch (err) {
    console.error('Dashboard Error:', err);
    if (badge) {
      badge.className = 'mono status-pill-empty';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.style.color = '#e11d48';
      badge.textContent = '● ERROR';
    }
    const statusTextEl = document.getElementById('kpiStatusText');
    if (statusTextEl) statusTextEl.textContent = err.message || 'โหลดข้อมูลไม่สำเร็จ';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:40px 16px;text-align:center;color:#e11d48;font-family:'JetBrains Mono',monospace;font-size:12px;">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  } finally {
    loading?.classList.add('hidden');
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
    tbody.innerHTML = `<tr><td colspan="6" class="txt-muted" style="padding:44px 16px;text-align:center;">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
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
    tr.style.cursor = 'pointer';
    tr.onclick = () => openDrawerByIndex(idx);

    const safeBoxId = escapeHtml(boxId);
    const safePartName = escapeHtml(partName);
    const safeLotNo = escapeHtml(lotNo);
    const safeLoc = escapeHtml(loc);
    const jsSafeBoxId = String(boxId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    tr.innerHTML = `
      <td class="mono txt-cyan" style="font-weight:700;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <span>${safeBoxId}</span>
          <button type="button" onclick="copyText(event, '${jsSafeBoxId}')" class="btn btn-ghost"
            style="padding:2px 8px;border-radius:6px;font-size:11px;">Copy</button>
        </div>
      </td>
      <td class="txt-primary" style="font-weight:600;">${safePartName}</td>
      <td class="mono txt-secondary" style="font-size:12.5px;">${safeLotNo}</td>
      <td>
        <a href="location.html?highlight=${encodeURIComponent(String(loc))}" onclick="event.stopPropagation()" class="mono loc-pill">
          ${safeLoc} ↗
        </a>
      </td>
      <td class="mono ${qty > 0 ? 'txt-emerald' : 'txt-muted'}" style="text-align:right;font-weight:700;">${qty.toLocaleString()}</td>
      <td style="text-align:center;">
        <span class="${qty > 0 ? 'status-pill-active' : 'status-pill-empty'}">${qty > 0 ? 'พร้อมใช้' : 'หมด'}</span>
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
      <div class="detail-row">
        <dt class="mono txt-muted" style="font-size:12px;">${escapeHtml(key)}</dt>
        <dd class="mono txt-primary" style="font-size:12px;font-weight:600;text-align:right;word-break:break-all;margin:0;">${escapeHtml(val ?? '-')}</dd>
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