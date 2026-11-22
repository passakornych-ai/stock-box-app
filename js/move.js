let allMoveRows = [];
let currentFilteredMoveRows = [];
let moveDetailRows = [];
let moveSortState = { key: null, dir: 'desc' };

const getMoveClient = () => window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

const pickMoveField = (obj, keys, fallback = '-') => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }
  return fallback;
};

const escapeMoveHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function renderAllMoveColumnsList(obj) {
  const entries = Object.entries(obj || {}).filter(([k]) => !k.startsWith('__'));
  return entries
    .map(([k, v]) => {
      const displayVal = v === null || v === undefined || String(v).trim() === '' ? '-' : String(v);
      return `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px dashed var(--border-row);">
          <span class="mono txt-muted" style="font-size:11.5px;flex-shrink:0;">${escapeMoveHtml(k)}</span>
          <span class="mono txt-primary" style="font-size:12px;font-weight:600;text-align:right;word-break:break-all;">${escapeMoveHtml(displayVal)}</span>
        </div>
      `;
    })
    .join('');
}

function showMoveToast(message) {
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

function copyMoveText(event, text) {
  event.stopPropagation();
  if (!text || text === '-') return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(String(text));
  }
  showMoveToast(`COPIED: ${text}`);
}

function clearMoveFilters() {
  const searchInput = document.getElementById('moveSearchInput');
  const searchColumn = document.getElementById('moveSearchColumn');
  const dateFilter = document.getElementById('moveDateFilter');

  if (searchInput) searchInput.value = '';
  if (searchColumn) searchColumn.value = 'all';
  if (dateFilter) dateFilter.value = '';
  moveSortState = { key: null, dir: 'desc' };

  renderMoveTable(allMoveRows);
}

function getMoveColumnValue(item, colKey) {
  const map = {
    MoveID: ['MoveID', 'move_id', 'Move_ID', 'ID', 'Row ID'],
    MoveDate: ['MoveDate', 'move_date', 'Move_Date', 'Date', 'CreatedAt', 'created_at'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No'],
    Part_Name: ['Part_Name', 'part_name', 'Product'],
    FromLoc: ['From_Location', 'from_location', 'FromLoc', 'from_loc', 'Source_Location', 'Location_Name', 'location_name'],
    ToLoc: ['To_Location', 'to_location', 'ToLoc', 'to_loc', 'Target_Location', 'Destination_Location'],
    Qty: ['Qty', 'qty', 'MoveQty', 'move_qty', 'QtyBalance', 'qty_balance']
  };
  const val = pickMoveField(item, map[colKey] || [colKey], '');
  if (colKey === 'Qty') {
    return Number(val) || 0;
  }
  return String(val === '-' ? '' : val).toLowerCase();
}

function sortMoveByColumn(colKey) {
  if (moveSortState.key === colKey) {
    moveSortState.dir = moveSortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    moveSortState.key = colKey;
    moveSortState.dir = colKey === 'Qty' || colKey === 'MoveDate' ? 'desc' : 'asc';
  }
  renderMoveTable(allMoveRows);
}

function initMoveSortableHeaders() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = ['MoveID', 'MoveDate', 'LotNo', 'Part_Name', 'FromLoc', 'ToLoc', 'Qty'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.title = 'คลิกเพื่อเรียงลำดับ';
    th.onclick = () => sortMoveByColumn(key);
  });
}

function updateMoveSortIndicators() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = ['MoveID', 'MoveDate', 'LotNo', 'Part_Name', 'FromLoc', 'ToLoc', 'Qty'];
  const baseLabels = ['MOVE ID', 'MOVE DATE', 'LOTNO', 'PART_NAME', 'FROM LOC', 'TO LOC', 'QTY'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    let arrow = ' ↕';
    if (moveSortState.key === key) {
      arrow = moveSortState.dir === 'asc' ? ' ↑' : ' ↓';
      th.style.color = 'var(--c-cyan)';
    } else {
      th.style.color = 'var(--text-muted)';
    }
    th.textContent = `${baseLabels[index]}${arrow}`;
  });
}

async function loadStockMove() {
  const loading = document.getElementById('moveLoadingBanner');
  const tbody = document.getElementById('moveTableBody');
  const badge = document.getElementById('moveStatusBadge');

  loading?.classList.remove('hidden');

  try {
    const client = getMoveClient();
    if (!client) {
      throw new Error('ยังไม่ได้สร้าง Supabase client (_supabase) กรุณาเช็กไฟล์ js/config.js');
    }

    const [{ data: movData, error: movErr }, { data: detData, error: detErr }] = await Promise.all([
      client.from('stock_move').select('*'),
      client.from('stock_move_detail').select('*')
    ]);

    if (movErr) throw movErr;
    moveDetailRows = !detErr && Array.isArray(detData) ? detData : [];

    const detailSumByMovId = {};
    moveDetailRows.forEach((d) => {
      const mid = String(pickMoveField(d, ['MoveID', 'move_id', 'Move_ID'], '')).trim();
      const dQty = Number(pickMoveField(d, ['Qty', 'qty', 'MoveQty', 'move_qty', 'QtyBalance'], 0)) || 0;
      if (!mid) return;
      detailSumByMovId[mid] = (detailSumByMovId[mid] || 0) + dQty;
    });

    allMoveRows = (Array.isArray(movData) ? movData : []).map((row) => {
      const mid = String(pickMoveField(row, ['MoveID', 'move_id', 'Move_ID', 'Row ID'], '')).trim();
      const rawQty = pickMoveField(row, ['Qty', 'qty', 'MoveQty', 'move_qty', 'TotalQty', 'QtyBalance'], null);
      const computedQty =
        rawQty !== null && rawQty !== '-' && !Number.isNaN(Number(rawQty))
          ? Number(rawQty)
          : detailSumByMovId[mid] || 0;

      return {
        ...row,
        __computedQty: computedQty
      };
    });

    updateMoveKPIs(allMoveRows);
    renderMoveTable(allMoveRows);

    const now = new Date();
    const lastSyncEl = document.getElementById('movKpiLastSync');
    const statusTextEl = document.getElementById('movKpiStatusText');
    if (lastSyncEl) lastSyncEl.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
    if (statusTextEl) statusTextEl.textContent = 'เชื่อมต่อ Supabase สำเร็จ';

    if (badge) {
      badge.className = 'mono status-pill-active';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.textContent = '● LIVE';
    }
  } catch (err) {
    console.error('Stock Move Error:', err);
    if (badge) {
      badge.className = 'mono status-pill-empty';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.style.color = '#e11d48';
      badge.textContent = '● ERROR';
    }
    const statusTextEl = document.getElementById('movKpiStatusText');
    if (statusTextEl) statusTextEl.textContent = err.message || 'โหลดข้อมูลไม่สำเร็จ';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding:40px 16px;text-align:center;color:#e11d48;font-family:'JetBrains Mono',monospace;font-size:12px;">Error: ${escapeMoveHtml(err.message)}</td></tr>`;
    }
  } finally {
    loading?.classList.add('hidden');
  }
}

function updateMoveKPIs(rows) {
  let totalQty = 0;
  let todayCount = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  rows.forEach((r) => {
    totalQty += Number(r.__computedQty) || 0;
    const rawDate = String(pickMoveField(r, ['MoveDate', 'move_date', 'Move_Date', 'Date', 'CreatedAt', 'created_at'], ''));
    if (rawDate.slice(0, 10) === todayStr) {
      todayCount += 1;
    }
  });

  document.getElementById('movKpiTotalDocs').textContent = rows.length.toLocaleString();
  document.getElementById('movKpiTotalQty').textContent = totalQty.toLocaleString();
  document.getElementById('movKpiTodayDocs').textContent = todayCount.toLocaleString();
}

function getFilteredMoveRows(rows) {
  const col = document.getElementById('moveSearchColumn')?.value || 'all';
  const q = (document.getElementById('moveSearchInput')?.value || '').trim().toLowerCase();
  const dateVal = (document.getElementById('moveDateFilter')?.value || '').trim();
  const clearBtn = document.getElementById('clearMoveSearchBtn');

  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !q && col === 'all' && !dateVal && !moveSortState.key);
  }

  const colKeyMap = {
    MoveID: ['MoveID', 'move_id', 'Move_ID', 'Row ID'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No'],
    Part_Name: ['Part_Name', 'part_name', 'Product'],
    FromLoc: ['From_Location', 'from_location', 'FromLoc', 'from_loc', 'Source_Location', 'Location_Name', 'location_name'],
    ToLoc: ['To_Location', 'to_location', 'ToLoc', 'to_loc', 'Target_Location', 'Destination_Location']
  };

  let result = rows.filter((r) => {
    if (dateVal) {
      const rawDate = String(pickMoveField(r, ['MoveDate', 'move_date', 'Move_Date', 'Date', 'CreatedAt', 'created_at'], ''));
      if (!rawDate.startsWith(dateVal)) return false;
    }

    if (!q) return true;

    if (col === 'all') {
      return JSON.stringify(r).toLowerCase().includes(q);
    }

    const targetVal = String(pickMoveField(r, colKeyMap[col] || [col], '')).toLowerCase();
    return targetVal.includes(q);
  });

  if (moveSortState.key) {
    const { key, dir } = moveSortState;
    const factor = dir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      if (key === 'Qty') {
        return ((Number(a.__computedQty) || 0) - (Number(b.__computedQty) || 0)) * factor;
      }
      const valA = getMoveColumnValue(a, key);
      const valB = getMoveColumnValue(b, key);
      return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * factor;
    });
  }

  return result;
}

function renderMoveTable(rows) {
  const tbody = document.getElementById('moveTableBody');
  currentFilteredMoveRows = getFilteredMoveRows(rows);
  updateMoveSortIndicators();
  document.getElementById('moveShowingCount').textContent = currentFilteredMoveRows.length.toLocaleString();

  if (!tbody) return;

  if (currentFilteredMoveRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="txt-muted" style="padding:44px 16px;text-align:center;">ไม่พบรายการย้ายสินค้าตามเงื่อนไข</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  currentFilteredMoveRows.forEach((item, idx) => {
    const movId = pickMoveField(item, ['MoveID', 'move_id', 'Move_ID', 'Row ID']);
    const movDate = pickMoveField(item, ['MoveDate', 'move_date', 'Move_Date', 'Date', 'CreatedAt', 'created_at']);
    const lotNo = pickMoveField(item, ['LotNo', 'lot_no', 'Lot_No']);
    const partName = pickMoveField(item, ['Part_Name', 'part_name', 'Product']);
    const fromLoc = pickMoveField(item, ['From_Location', 'from_location', 'FromLoc', 'from_loc', 'Source_Location', 'Location_Name', 'location_name']);
    const toLoc = pickMoveField(item, ['To_Location', 'to_location', 'ToLoc', 'to_loc', 'Target_Location', 'Destination_Location']);
    const qty = Number(item.__computedQty) || 0;

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => openMoveDrawerByIndex(idx);

    const safeMovId = escapeMoveHtml(movId);
    const safeMovDate = escapeMoveHtml(movDate);
    const safeLotNo = escapeMoveHtml(lotNo);
    const safePartName = escapeMoveHtml(partName);
    const safeFromLoc = escapeMoveHtml(fromLoc);
    const safeToLoc = escapeMoveHtml(toLoc);
    const jsSafeMovId = String(movId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    tr.innerHTML = `
      <td class="mono txt-cyan" style="font-weight:700;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <span>${safeMovId}</span>
          <button type="button" onclick="copyMoveText(event, '${jsSafeMovId}')" class="btn btn-ghost"
            style="padding:2px 8px;border-radius:6px;font-size:11px;">Copy</button>
        </div>
      </td>
      <td class="mono txt-secondary" style="font-size:12.5px;">${safeMovDate}</td>
      <td class="mono txt-secondary" style="font-size:12.5px;">${safeLotNo}</td>
      <td class="txt-primary" style="font-weight:600;">${safePartName}</td>
      <td>
        ${
          fromLoc !== '-'
            ? `<a href="location.html?highlight=${encodeURIComponent(String(fromLoc))}" onclick="event.stopPropagation()" class="mono loc-pill">${safeFromLoc} ↗</a>`
            : `<span class="txt-muted">-</span>`
        }
      </td>
      <td>
        ${
          toLoc !== '-'
            ? `<a href="location.html?highlight=${encodeURIComponent(String(toLoc))}" onclick="event.stopPropagation()" class="mono status-pill-active" style="border-radius:8px;text-decoration:none;">${safeToLoc} ↗</a>`
            : `<span class="txt-muted">-</span>`
        }
      </td>
      <td class="mono txt-indigo" style="text-align:right;font-weight:700;">${qty.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openMoveDrawerByIndex(index) {
  const item = currentFilteredMoveRows[index];
  if (!item) return;

  const movId = String(pickMoveField(item, ['MoveID', 'move_id', 'Move_ID', 'Row ID'], '-'));
  document.getElementById('moveDrawerTitle').textContent = movId;

  const cleanEntries = Object.entries(item).filter(([k]) => !k.startsWith('__'));
  const fieldsHtml = cleanEntries
    .map(
      ([key, val]) => `
      <div class="detail-row">
        <dt class="mono txt-muted" style="font-size:12px;">${escapeMoveHtml(key)}</dt>
        <dd class="mono txt-primary" style="font-size:12px;font-weight:600;text-align:right;word-break:break-all;margin:0;">${escapeMoveHtml(val ?? '-')}</dd>
      </div>
    `
    )
    .join('');

  const matchedDetails = moveDetailRows.filter(
    (d) => String(pickMoveField(d, ['MoveID', 'move_id', 'Move_ID'], '')).trim() === movId.trim()
  );

  let detailsSectionHtml = '';
  if (matchedDetails.length > 0) {
    const detailCards = matchedDetails
      .map(
        (d, dIdx) => `
        <div style="padding:12px 14px;border-radius:12px;background:var(--bg-control);border:1px solid var(--border-subtle);">
          <div class="mono txt-indigo" style="font-size:11px;font-weight:700;margin-bottom:6px;">
            ITEM #${dIdx + 1}
          </div>
          <div>${renderAllMoveColumnsList(d)}</div>
        </div>
      `
      )
      .join('');

    detailsSectionHtml = `
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle);">
        <div class="mono txt-indigo" style="font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:10px;">
          Detail Items (${matchedDetails.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">${detailCards}</div>
      </div>
    `;
  }

  document.getElementById('moveDrawerContent').innerHTML = fieldsHtml + detailsSectionHtml;
  document.getElementById('moveDrawer').classList.remove('hidden');
}

function closeMoveDrawer() {
  document.getElementById('moveDrawer')?.classList.add('hidden');
}

function exportMoveToCSV() {
  if (!currentFilteredMoveRows.length) {
    showMoveToast('ไม่มีข้อมูลสำหรับ Export');
    return;
  }

  const headers = ['MoveID', 'MoveDate', 'LotNo', 'Part_Name', 'From_Location', 'To_Location', 'Qty'];
  const escapeCSV = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const lines = [
    headers.map(escapeCSV).join(','),
    ...currentFilteredMoveRows.map((item) => {
      const movId = pickMoveField(item, ['MoveID', 'move_id', 'Move_ID', 'Row ID']);
      const movDate = pickMoveField(item, ['MoveDate', 'move_date', 'Move_Date', 'Date', 'CreatedAt', 'created_at']);
      const lotNo = pickMoveField(item, ['LotNo', 'lot_no', 'Lot_No']);
      const partName = pickMoveField(item, ['Part_Name', 'part_name', 'Product']);
      const fromLoc = pickMoveField(item, ['From_Location', 'from_location', 'FromLoc', 'from_loc', 'Source_Location', 'Location_Name', 'location_name']);
      const toLoc = pickMoveField(item, ['To_Location', 'to_location', 'ToLoc', 'to_loc', 'Target_Location', 'Destination_Location']);
      const qty = Number(item.__computedQty) || 0;
      return [movId, movDate, lotNo, partName, fromLoc, toLoc, qty].map(escapeCSV).join(',');
    })
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `stock_move_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showMoveToast(`EXPORTED ${currentFilteredMoveRows.length} ROWS`);
}

document.addEventListener('DOMContentLoaded', () => {
  initMoveSortableHeaders();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMoveDrawer();
  });

  document.getElementById('moveSearchInput')?.addEventListener('input', () => renderMoveTable(allMoveRows));
  document.getElementById('moveSearchColumn')?.addEventListener('change', () => renderMoveTable(allMoveRows));
  document.getElementById('moveDateFilter')?.addEventListener('change', () => renderMoveTable(allMoveRows));

  loadStockMove();
});