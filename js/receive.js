let allReceiveRows = [];
let currentFilteredRows = [];
let receiveDetailRows = [];
let selectedReceiveItem = null;
let selectedReceiveDetails = [];
let sortState = { key: null, dir: 'desc' };

// =====================================================================
// [1] CONFIG LABEL ที่นี่ (แก้ชื่อที่แสดงใน Drawer ได้ง่ายในอนาคต)
// =====================================================================
const RECEIVE_HEADER_LABELS = {
  receiveno: 'เลขที่ใบรับเข้า',
  receive_no: 'เลขที่ใบรับเข้า',
  receivedate: 'วันที่รับเข้า',
  receive_date: 'วันที่รับเข้า',
  createdat: 'วันที่สร้าง',
  created_at: 'วันที่สร้าง',
  createdby: 'ผู้สร้าง',
  created_by: 'ผู้สร้าง',
  qty: 'จำนวนรวม',
  totalqty: 'จำนวนรวม',
  total_qty: 'จำนวนรวม'
};

const RECEIVE_DETAIL_LABELS = {
  part_name: 'Carton Part No.',
  lotno: 'Lot No.',
  lot_no: 'Lot No.',
  location_name: 'Location',
  qty: 'จำนวน',
  qtybalance: 'จำนวนคงเหลือ',
  qty_balance: 'จำนวนคงเหลือ',
  type: 'ประเภท',
  type_cartons: 'ประเภทกล่อง',
  createdat: 'วันที่สร้าง',
  created_at: 'วันที่สร้าง',
  remark: 'หมายเหตุ',
  remarks: 'หมายเหตุ'
};

const EXCLUDED_RECEIVE_HEADER_KEYS = new Set([
  'rowid', 'row_id', 'row id',
  'receiveid', 'receive_id',
  'type',
  'status'
]);

const EXCLUDED_RECEIVE_DETAIL_KEYS = new Set([
  'rowid', 'row_id', 'row id',
  'receivedetailid', 'receive_detail_id', 'receivedetail_id',
  'receiveid', 'receive_id',
  'processed',
  'processedqty', 'processed_qty',
  'processedpart_name', 'processed_part_name', 'processedpartname',
  'processedlotno', 'processed_lot_no', 'processedlot_no',
  'processedlocation_name', 'processed_location_name', 'processedlocationname',
  'processedtype', 'processed_type',
  'editstage', 'edit_stage',
  'edittoken', 'edit_token',
  'processedtype_cartons', 'processed_type_cartons', 'processedtypecartons'
]);

const normalizeReceiveKey = (k) => String(k || '').trim().toLowerCase();

const getReceiveLabel = (key, labelMap) => labelMap[normalizeReceiveKey(key)] || key;

// แปลงวันที่รูปแบบ ISO เช่น 2026-11-27T11:20:33 -> 2026-11-27 11:20:33 (เว้นตัว T ออก)
const formatReceiveDisplayValue = (val) => {
  if (val === null || val === undefined || String(val).trim() === '') return '-';
  const str = String(val).trim();
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})[T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i);
  if (isoMatch) {
    return `${isoMatch[1]} ${isoMatch[2]}`;
  }
  return str;
};

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

function renderFilteredReceiveColumnsList(obj, excludedSet, labelMap = {}) {
  const entries = Object.entries(obj || {}).filter(
    ([k]) => !k.startsWith('__') && !excludedSet.has(normalizeReceiveKey(k))
  );
  return entries
    .map(([k, v]) => {
      const displayLabel = getReceiveLabel(k, labelMap);
      const displayVal = formatReceiveDisplayValue(v);
      return `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px dashed var(--border-row);">
          <span class="mono txt-muted" style="font-size:11.5px;flex-shrink:0;">${escapeHtml(displayLabel)}</span>
          <span class="mono txt-primary" style="font-size:12px;font-weight:600;text-align:right;word-break:break-all;">${escapeHtml(displayVal)}</span>
        </div>
      `;
    })
    .join('');
}

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

function clearReceiveFilters() {
  const searchInput = document.getElementById('receiveSearchInput');
  const searchColumn = document.getElementById('receiveSearchColumn');
  const dateFilter = document.getElementById('receiveDateFilter');

  if (searchInput) searchInput.value = '';
  if (searchColumn) searchColumn.value = 'all';
  if (dateFilter) dateFilter.value = '';
  sortState = { key: null, dir: 'desc' };

  renderReceiveTable(allReceiveRows);
}

function getReceiveColumnValue(item, colKey) {
  const map = {
    ReceiveNo: ['ReceiveNo', 'receive_no', 'ReceiveID', 'receive_id', 'Receive_ID', 'Row ID'],
    ReceiveDate: ['ReceiveDate', 'receive_date', 'Receive_Date', 'Date', 'CreatedAt', 'created_at'],
    CreatedBy: ['CreatedBy', 'created_by', 'Operator', 'User'],
    Qty: ['Qty', 'qty', 'ReceiveQty', 'receive_qty', 'QtyBalance', 'qty_balance']
  };
  const val = pickField(item, map[colKey] || [colKey], '');
  if (colKey === 'Qty') {
    return Number(item.__computedQty ?? val) || 0;
  }
  return String(val === '-' ? '' : val).toLowerCase();
}

function sortReceiveByColumn(colKey) {
  if (sortState.key === colKey) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.key = colKey;
    sortState.dir = colKey === 'Qty' || colKey === 'ReceiveDate' ? 'desc' : 'asc';
  }
  renderReceiveTable(allReceiveRows);
}

function initReceiveSortableHeaders() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = ['ReceiveNo', 'ReceiveDate', 'CreatedBy', 'Qty'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.title = 'คลิกเพื่อเรียงลำดับ';
    th.onclick = () => sortReceiveByColumn(key);
  });
}

function updateReceiveSortIndicators() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = ['ReceiveNo', 'ReceiveDate', 'CreatedBy', 'Qty'];
  const baseLabels = ['เลขที่รับเข้า RECEIVENO', 'RECEIVE DATE', 'ผู้สร้าง', 'QTY'];

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

async function loadStockReceive() {
  const loading = document.getElementById('receiveLoadingBanner');
  const tbody = document.getElementById('receiveTableBody');
  const badge = document.getElementById('receiveStatusBadge') || document.getElementById('dbStatusBadge');

  loading?.classList.remove('hidden');

  try {
    const client = getClient();
    if (!client) {
      throw new Error('ยังไม่ได้สร้าง Supabase client (_supabase) กรุณาเช็กไฟล์ js/config.js');
    }

    const [{ data: recData, error: recErr }, { data: detData, error: detErr }] = await Promise.all([
      client.from('stock_receive').select('*'),
      client.from('stock_receive_detail').select('*')
    ]);

    if (recErr) throw recErr;
    receiveDetailRows = !detErr && Array.isArray(detData) ? detData : [];

    const detailSumByRecId = {};
    receiveDetailRows.forEach((d) => {
      const rid = String(pickField(d, ['ReceiveID', 'receive_id', 'Receive_ID'], '')).trim();
      const dQty = Number(pickField(d, ['QTY', 'Qty', 'qty', 'ReceiveQty', 'receive_qty', 'QtyBalance'], 0)) || 0;
      if (!rid) return;
      detailSumByRecId[rid] = (detailSumByRecId[rid] || 0) + dQty;
    });

    allReceiveRows = (Array.isArray(recData) ? recData : []).map((row) => {
      const rid = String(pickField(row, ['ReceiveID', 'receive_id', 'Receive_ID', 'Row ID'], '')).trim();
      const rawQty = pickField(row, ['QTY', 'Qty', 'qty', 'ReceiveQty', 'receive_qty', 'TotalQty', 'QtyBalance'], null);
      const computedQty =
        rawQty !== null && rawQty !== '-' && !Number.isNaN(Number(rawQty))
          ? Number(rawQty)
          : detailSumByRecId[rid] || 0;

      return {
        ...row,
        __computedQty: computedQty
      };
    });

    updateReceiveKPIs(allReceiveRows);
    renderReceiveTable(allReceiveRows);

    const now = new Date();
    const lastSyncEl = document.getElementById('recKpiLastSync');
    const statusTextEl = document.getElementById('recKpiStatusText');
    if (lastSyncEl) lastSyncEl.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
    if (statusTextEl) statusTextEl.textContent = 'เชื่อมต่อ Supabase สำเร็จ';

    if (badge) {
      badge.className = 'mono status-pill-active';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.textContent = '● LIVE';
    }
  } catch (err) {
    console.error('Stock Receive Error:', err);
    if (badge) {
      badge.className = 'mono status-pill-empty';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.style.color = '#e11d48';
      badge.textContent = '● ERROR';
    }
    const statusTextEl = document.getElementById('recKpiStatusText');
    if (statusTextEl) statusTextEl.textContent = err.message || 'โหลดข้อมูลไม่สำเร็จ';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="padding:40px 16px;text-align:center;color:#e11d48;font-family:'JetBrains Mono',monospace;font-size:12px;">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  } finally {
    loading?.classList.add('hidden');
  }
}

function updateReceiveKPIs(rows) {
  let totalQty = 0;
  let todayCount = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  rows.forEach((r) => {
    totalQty += Number(r.__computedQty) || 0;
    const rawDate = String(pickField(r, ['ReceiveDate', 'receive_date', 'Receive_Date', 'Date', 'CreatedAt', 'created_at'], ''));
    if (rawDate.slice(0, 10) === todayStr) {
      todayCount += 1;
    }
  });

  document.getElementById('recKpiTotalDocs').textContent = rows.length.toLocaleString();
  document.getElementById('recKpiTotalQty').textContent = totalQty.toLocaleString();
  document.getElementById('recKpiTodayDocs').textContent = todayCount.toLocaleString();
}

function getFilteredReceiveRows(rows) {
  const col = document.getElementById('receiveSearchColumn')?.value || 'all';
  const q = (document.getElementById('receiveSearchInput')?.value || '').trim().toLowerCase();
  const dateVal = (document.getElementById('receiveDateFilter')?.value || '').trim();
  const clearBtn = document.getElementById('clearReceiveSearchBtn');

  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !q && col === 'all' && !dateVal && !sortState.key);
  }

  const colKeyMap = {
    ReceiveNo: ['ReceiveNo', 'receive_no', 'ReceiveID', 'receive_id', 'Receive_ID', 'Row ID'],
    CreatedBy: ['CreatedBy', 'created_by', 'Operator', 'User'],
    Part_Name: ['Part_Name', 'part_name', 'Product'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No']
  };

  let result = rows.filter((r) => {
    if (dateVal) {
      const rawDate = String(pickField(r, ['ReceiveDate', 'receive_date', 'Receive_Date', 'Date', 'CreatedAt', 'created_at'], ''));
      if (!rawDate.startsWith(dateVal)) return false;
    }

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
      if (key === 'Qty') {
        return ((Number(a.__computedQty) || 0) - (Number(b.__computedQty) || 0)) * factor;
      }
      const valA = getReceiveColumnValue(a, key);
      const valB = getReceiveColumnValue(b, key);
      return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * factor;
    });
  }

  return result;
}

function renderReceiveTable(rows) {
  const tbody = document.getElementById('receiveTableBody');
  currentFilteredRows = getFilteredReceiveRows(rows);
  updateReceiveSortIndicators();
  document.getElementById('receiveShowingCount').textContent = currentFilteredRows.length.toLocaleString();

  if (!tbody) return;

  if (currentFilteredRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="txt-muted" style="padding:44px 16px;text-align:center;">ไม่พบรายการรับเข้าตามเงื่อนไข</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  currentFilteredRows.forEach((item, idx) => {
    const receiveNo = pickField(item, ['ReceiveNo', 'receive_no', 'ReceiveID', 'receive_id', 'Receive_ID', 'Row ID']);
    const recDate = formatReceiveDisplayValue(
      pickField(item, ['ReceiveDate', 'receive_date', 'Receive_Date', 'Date', 'CreatedAt', 'created_at'])
    );
    const createdBy = pickField(item, ['CreatedBy', 'created_by', 'Operator', 'User']);
    const qty = Number(item.__computedQty) || 0;

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => openReceiveDrawerByIndex(idx);

    const safeReceiveNo = escapeHtml(receiveNo);
    const safeRecDate = escapeHtml(recDate);
    const safeCreatedBy = escapeHtml(createdBy);
    const jsSafeReceiveNo = String(receiveNo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    tr.innerHTML = `
      <td class="mono txt-primary" style="font-weight:700;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <span>${safeReceiveNo}</span>
          <button type="button" onclick="copyText(event, '${jsSafeReceiveNo}')" class="btn btn-ghost"
            style="padding:2px 8px;border-radius:6px;font-size:11px;">Copy</button>
        </div>
      </td>
      <td class="mono txt-secondary" style="font-size:12.5px;">${safeRecDate}</td>
      <td class="txt-secondary" style="font-size:13px;">${safeCreatedBy}</td>
      <td class="mono txt-primary" style="text-align:right;font-weight:700;">${qty > 0 ? qty.toLocaleString() : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openReceiveDrawerByIndex(index) {
  const item = currentFilteredRows[index];
  if (!item) return;

  selectedReceiveItem = item;
  const recId = String(pickField(item, ['ReceiveID', 'receive_id', 'Receive_ID', 'Row ID'], '-'));
  const displayTitle = String(pickField(item, ['ReceiveNo', 'receive_no', 'ReceiveID', 'receive_id', 'Row ID'], '-'));
  document.getElementById('receiveDrawerTitle').textContent = displayTitle;

  const fieldsHtml = renderFilteredReceiveColumnsList(item, EXCLUDED_RECEIVE_HEADER_KEYS, RECEIVE_HEADER_LABELS);

  selectedReceiveDetails = receiveDetailRows.filter(
    (d) => String(pickField(d, ['ReceiveID', 'receive_id', 'Receive_ID'], '')).trim() === recId.trim()
  );

  let detailsSectionHtml = '';
  if (selectedReceiveDetails.length > 0) {
    const detailCards = selectedReceiveDetails
      .map(
        (d, dIdx) => `
        <div style="padding:12px 14px;border-radius:12px;background:var(--bg-control);border:1px solid var(--border-subtle);">
          <div class="mono txt-emerald" style="font-size:11px;font-weight:700;margin-bottom:6px;">
            ITEM #${dIdx + 1}
          </div>
          <div>${renderFilteredReceiveColumnsList(d, EXCLUDED_RECEIVE_DETAIL_KEYS, RECEIVE_DETAIL_LABELS)}</div>
        </div>
      `
      )
      .join('');

    detailsSectionHtml = `
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle);">
        <div class="mono txt-emerald" style="font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:10px;">
          Detail Items (${selectedReceiveDetails.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">${detailCards}</div>
      </div>
    `;
  }

  const exportBtn = document.getElementById('exportReceiveXlsxBtn');
  if (exportBtn) {
    exportBtn.disabled = selectedReceiveDetails.length === 0;
    exportBtn.style.opacity = selectedReceiveDetails.length === 0 ? '0.5' : '1';
  }

  document.getElementById('receiveDrawerContent').innerHTML = fieldsHtml + detailsSectionHtml;
  document.getElementById('receiveDrawer').classList.remove('hidden');
}

function closeReceiveDrawer() {
  document.getElementById('receiveDrawer')?.classList.add('hidden');
}

function exportSelectedReceiveToXLSX() {
  if (!selectedReceiveItem) {
    showToast('กรุณาเลือกรายการใบรับเข้าก่อน');
    return;
  }

  if (!selectedReceiveDetails.length) {
    showToast('ใบรับเข้านี้ไม่มี Detail Items สำหรับ Export');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showToast('ไม่พบไลบรารี XLSX กรุณารีเฟรชหน้า');
    return;
  }

  const cleanVal = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : formatReceiveDisplayValue(v));

  const headers = [
    'Part_Name',
    'LotNo',
    'Location_Name',
    'QTY',
    'Type',
    'Type_cartons'
  ];

  const excelRows = selectedReceiveDetails.map((d) => ({
    Part_Name: cleanVal(pickField(d, ['Part_Name', 'part_name', 'Product'], '-')),
    LotNo: cleanVal(pickField(d, ['LotNo', 'lot_no', 'Lot_No'], '-')),
    Location_Name: cleanVal(pickField(d, ['Location_Name', 'location_name', 'Location'], '-')),
    QTY: Number(pickField(d, ['QTY', 'Qty', 'qty', 'ReceiveQty', 'receive_qty'], 0)) || 0,
    Type: cleanVal(pickField(d, ['Type', 'type'], '-')),
    Type_cartons: cleanVal(pickField(d, ['Type_cartons', 'type_cartons', 'TypeCartons'], '-'))
  }));

  const ws = XLSX.utils.json_to_sheet(excelRows, { header: headers });
  ws['!cols'] = headers.map(() => ({ wch: 12 }));

  if (ws['A1']) {
    ws['A1'].s = {
      fill: {
        patternType: 'solid',
        fgColor: { rgb: 'D9E1F2' }
      },
      font: {
        bold: true,
        color: { rgb: '0F172A' }
      }
    };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const rawDocName = String(
    pickField(
      selectedReceiveItem,
      ['ReceiveNo', 'receive_no', 'ReceiveID', 'receive_id', 'Receive_ID', 'Row ID'],
      'stock_receive'
    )
  ).trim();
  const safeFileName = rawDocName.replace(/[\\/:*?"<>|]+/g, '_') || 'stock_receive';

  XLSX.writeFile(wb, `${safeFileName}.xlsx`);
  showToast(`EXPORTED ${excelRows.length} ITEMS (.XLSX)`);
}

document.addEventListener('DOMContentLoaded', () => {
  initReceiveSortableHeaders();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeReceiveDrawer();
  });

  document.getElementById('receiveSearchInput')?.addEventListener('input', () => renderReceiveTable(allReceiveRows));
  document.getElementById('receiveSearchColumn')?.addEventListener('change', () => renderReceiveTable(allReceiveRows));
  document.getElementById('receiveDateFilter')?.addEventListener('change', () => renderReceiveTable(allReceiveRows));

  loadStockReceive();
});
