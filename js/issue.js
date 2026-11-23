let allIssueRows = [];
let currentFilteredIssueRows = [];
let issueDetailRows = [];
let selectedIssueItem = null;
let selectedIssueDetails = [];
let issueSortState = { key: null, dir: 'desc' };

const EXCLUDED_ISSUE_HEADER_KEYS = new Set([
  'rowid', 'row_id', 'row id',
  'issueid', 'issue_id',
  'type',
  'status'
]);

const EXCLUDED_ISSUE_DETAIL_KEYS = new Set([
  'rowid', 'row_id', 'row id',
  'issuedetailid', 'issue_detail_id', 'issuedetail_id',
  'issueid', 'issue_id',
  'stockboxid', 'stock_box_id',
  'processed',
  'processedqty', 'processed_qty',
  'processedstockboxid', 'processed_stock_box_id',
  'editstage', 'edit_stage',
  'edittoken', 'edit_token'
]);

const normalizeKey = (k) => String(k || '').trim().toLowerCase();

const getIssueClient = () => window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

const pickIssueField = (obj, keys, fallback = '-') => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }
  return fallback;
};

const escapeIssueHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function renderFilteredColumnsList(obj, excludedSet) {
  const entries = Object.entries(obj || {}).filter(
    ([k]) => !k.startsWith('__') && !excludedSet.has(normalizeKey(k))
  );
  return entries
    .map(([k, v]) => {
      const displayVal = v === null || v === undefined || String(v).trim() === '' ? '-' : String(v);
      return `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px dashed var(--border-row);">
          <span class="mono txt-muted" style="font-size:11.5px;flex-shrink:0;">${escapeIssueHtml(k)}</span>
          <span class="mono txt-primary" style="font-size:12px;font-weight:600;text-align:right;word-break:break-all;">${escapeIssueHtml(displayVal)}</span>
        </div>
      `;
    })
    .join('');
}

function showIssueToast(message) {
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

function copyIssueText(event, text) {
  event.stopPropagation();
  if (!text || text === '-') return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(String(text));
  }
  showIssueToast(`COPIED: ${text}`);
}

function clearIssueFilters() {
  const searchInput = document.getElementById('issueSearchInput');
  const searchColumn = document.getElementById('issueSearchColumn');
  const dateFilter = document.getElementById('issueDateFilter');

  if (searchInput) searchInput.value = '';
  if (searchColumn) searchColumn.value = 'all';
  if (dateFilter) dateFilter.value = '';
  issueSortState = { key: null, dir: 'desc' };

  renderIssueTable(allIssueRows);
}

function getIssueColumnValue(item, colKey) {
  const map = {
    IssueNo: ['IssueNo', 'issue_no', 'IssueID', 'issue_id', 'Issue_ID', 'Row ID'],
    IssueDate: ['IssueDate', 'issue_date', 'Issue_Date', 'Date', 'CreatedAt', 'created_at'],
    CreatedBy: ['CreatedBy', 'created_by', 'Operator', 'User'],
    Qty: ['Qty', 'qty', 'IssueQty', 'issue_qty', 'QtyBalance', 'qty_balance']
  };
  const val = pickIssueField(item, map[colKey] || [colKey], '');
  if (colKey === 'Qty') {
    return Number(item.__computedQty ?? val) || 0;
  }
  return String(val === '-' ? '' : val).toLowerCase();
}

function sortIssueByColumn(colKey) {
  if (issueSortState.key === colKey) {
    issueSortState.dir = issueSortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    issueSortState.key = colKey;
    issueSortState.dir = colKey === 'Qty' || colKey === 'IssueDate' ? 'desc' : 'asc';
  }
  renderIssueTable(allIssueRows);
}

function initIssueSortableHeaders() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = ['IssueNo', 'IssueDate', 'CreatedBy', 'Qty'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.title = 'คลิกเพื่อเรียงลำดับ';
    th.onclick = () => sortIssueByColumn(key);
  });
}

function updateIssueSortIndicators() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = ['IssueNo', 'IssueDate', 'CreatedBy', 'Qty'];
  const baseLabels = ['เลขที่เบิกใช้ ISSUENO', 'ISSUE DATE', 'ผู้สร้าง', 'QTY'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    let arrow = ' ↕';
    if (issueSortState.key === key) {
      arrow = issueSortState.dir === 'asc' ? ' ↑' : ' ↓';
      th.style.color = 'var(--c-cyan)';
    } else {
      th.style.color = 'var(--text-muted)';
    }
    th.textContent = `${baseLabels[index]}${arrow}`;
  });
}

async function loadStockIssue() {
  const loading = document.getElementById('issueLoadingBanner');
  const tbody = document.getElementById('issueTableBody');
  const badge = document.getElementById('issueStatusBadge');

  loading?.classList.remove('hidden');

  try {
    const client = getIssueClient();
    if (!client) {
      throw new Error('ยังไม่ได้สร้าง Supabase client (_supabase) กรุณาเช็กไฟล์ js/config.js');
    }

    const [{ data: issData, error: issErr }, { data: detData, error: detErr }] = await Promise.all([
      client.from('stock_issue').select('*'),
      client.from('stock_issue_detail').select('*')
    ]);

    if (issErr) throw issErr;
    issueDetailRows = !detErr && Array.isArray(detData) ? detData : [];

    const detailSumByIssId = {};
    issueDetailRows.forEach((d) => {
      const iid = String(pickIssueField(d, ['IssueID', 'issue_id', 'Issue_ID'], '')).trim();
      const dQty = Number(pickIssueField(d, ['Qty', 'qty', 'IssueQty', 'issue_qty', 'QtyBalance'], 0)) || 0;
      if (!iid) return;
      detailSumByIssId[iid] = (detailSumByIssId[iid] || 0) + dQty;
    });

    allIssueRows = (Array.isArray(issData) ? issData : []).map((row) => {
      const iid = String(pickIssueField(row, ['IssueID', 'issue_id', 'Issue_ID', 'Row ID'], '')).trim();
      const rawQty = pickIssueField(row, ['Qty', 'qty', 'IssueQty', 'issue_qty', 'TotalQty', 'QtyBalance'], null);
      const computedQty =
        rawQty !== null && rawQty !== '-' && !Number.isNaN(Number(rawQty))
          ? Number(rawQty)
          : detailSumByIssId[iid] || 0;

      return {
        ...row,
        __computedQty: computedQty
      };
    });

    updateIssueKPIs(allIssueRows);
    renderIssueTable(allIssueRows);

    const now = new Date();
    const lastSyncEl = document.getElementById('issKpiLastSync');
    const statusTextEl = document.getElementById('issKpiStatusText');
    if (lastSyncEl) lastSyncEl.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
    if (statusTextEl) statusTextEl.textContent = 'เชื่อมต่อ Supabase สำเร็จ';

    if (badge) {
      badge.className = 'mono status-pill-active';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.textContent = '● LIVE';
    }
  } catch (err) {
    console.error('Stock Issue Error:', err);
    if (badge) {
      badge.className = 'mono status-pill-empty';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.style.color = '#e11d48';
      badge.textContent = '● ERROR';
    }
    const statusTextEl = document.getElementById('issKpiStatusText');
    if (statusTextEl) statusTextEl.textContent = err.message || 'โหลดข้อมูลไม่สำเร็จ';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="padding:40px 16px;text-align:center;color:#e11d48;font-family:'JetBrains Mono',monospace;font-size:12px;">Error: ${escapeIssueHtml(err.message)}</td></tr>`;
    }
  } finally {
    loading?.classList.add('hidden');
  }
}

function updateIssueKPIs(rows) {
  let totalQty = 0;
  let todayCount = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  rows.forEach((r) => {
    totalQty += Number(r.__computedQty) || 0;
    const rawDate = String(pickIssueField(r, ['IssueDate', 'issue_date', 'Issue_Date', 'Date', 'CreatedAt', 'created_at'], ''));
    if (rawDate.slice(0, 10) === todayStr) {
      todayCount += 1;
    }
  });

  document.getElementById('issKpiTotalDocs').textContent = rows.length.toLocaleString();
  document.getElementById('issKpiTotalQty').textContent = totalQty.toLocaleString();
  document.getElementById('issKpiTodayDocs').textContent = todayCount.toLocaleString();
}

function getFilteredIssueRows(rows) {
  const col = document.getElementById('issueSearchColumn')?.value || 'all';
  const q = (document.getElementById('issueSearchInput')?.value || '').trim().toLowerCase();
  const dateVal = (document.getElementById('issueDateFilter')?.value || '').trim();
  const clearBtn = document.getElementById('clearIssueSearchBtn');

  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !q && col === 'all' && !dateVal && !issueSortState.key);
  }

  const colKeyMap = {
    IssueNo: ['IssueNo', 'issue_no', 'IssueID', 'issue_id', 'Issue_ID', 'Row ID'],
    CreatedBy: ['CreatedBy', 'created_by', 'Operator', 'User'],
    Part_Name: ['Part_Name', 'part_name', 'Product'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No']
  };

  let result = rows.filter((r) => {
    if (dateVal) {
      const rawDate = String(pickIssueField(r, ['IssueDate', 'issue_date', 'Issue_Date', 'Date', 'CreatedAt', 'created_at'], ''));
      if (!rawDate.startsWith(dateVal)) return false;
    }

    if (!q) return true;

    if (col === 'all') {
      return JSON.stringify(r).toLowerCase().includes(q);
    }

    const targetVal = String(pickIssueField(r, colKeyMap[col] || [col], '')).toLowerCase();
    return targetVal.includes(q);
  });

  if (issueSortState.key) {
    const { key, dir } = issueSortState;
    const factor = dir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      if (key === 'Qty') {
        return ((Number(a.__computedQty) || 0) - (Number(b.__computedQty) || 0)) * factor;
      }
      const valA = getIssueColumnValue(a, key);
      const valB = getIssueColumnValue(b, key);
      return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * factor;
    });
  }

  return result;
}

function renderIssueTable(rows) {
  const tbody = document.getElementById('issueTableBody');
  currentFilteredIssueRows = getFilteredIssueRows(rows);
  updateIssueSortIndicators();
  document.getElementById('issueShowingCount').textContent = currentFilteredIssueRows.length.toLocaleString();

  if (!tbody) return;

  if (currentFilteredIssueRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="txt-muted" style="padding:44px 16px;text-align:center;">ไม่พบรายการเบิกออกตามเงื่อนไข</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  currentFilteredIssueRows.forEach((item, idx) => {
    const issueNo = pickIssueField(item, ['IssueNo', 'issue_no', 'IssueID', 'issue_id', 'Issue_ID', 'Row ID']);
    const issDate = pickIssueField(item, ['IssueDate', 'issue_date', 'Issue_Date', 'Date', 'CreatedAt', 'created_at']);
    const createdBy = pickIssueField(item, ['CreatedBy', 'created_by', 'Operator', 'User']);
    const qty = Number(item.__computedQty) || 0;

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => openIssueDrawerByIndex(idx);

    const safeIssueNo = escapeIssueHtml(issueNo);
    const safeIssDate = escapeIssueHtml(issDate);
    const safeCreatedBy = escapeIssueHtml(createdBy);
    const jsSafeIssueNo = String(issueNo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    tr.innerHTML = `
      <td class="mono txt-primary" style="font-weight:700;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <span>${safeIssueNo}</span>
          <button type="button" onclick="copyIssueText(event, '${jsSafeIssueNo}')" class="btn btn-ghost"
            style="padding:2px 8px;border-radius:6px;font-size:11px;">Copy</button>
        </div>
      </td>
      <td class="mono txt-secondary" style="font-size:12.5px;">${safeIssDate}</td>
      <td class="txt-secondary" style="font-size:13px;">${safeCreatedBy}</td>
      <td class="mono txt-primary" style="text-align:right;font-weight:700;">${qty > 0 ? qty.toLocaleString() : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openIssueDrawerByIndex(index) {
  const item = currentFilteredIssueRows[index];
  if (!item) return;

  selectedIssueItem = item;
  const issId = String(pickIssueField(item, ['IssueID', 'issue_id', 'Issue_ID', 'Row ID'], '-'));
  const displayTitle = String(pickIssueField(item, ['IssueNo', 'issue_no', 'IssueID', 'issue_id', 'Row ID'], '-'));
  document.getElementById('issueDrawerTitle').textContent = displayTitle;

  const fieldsHtml = renderFilteredColumnsList(item, EXCLUDED_ISSUE_HEADER_KEYS);

  selectedIssueDetails = issueDetailRows.filter(
    (d) => String(pickIssueField(d, ['IssueID', 'issue_id', 'Issue_ID'], '')).trim() === issId.trim()
  );

  let detailsSectionHtml = '';
  if (selectedIssueDetails.length > 0) {
    const detailCards = selectedIssueDetails
      .map(
        (d, dIdx) => `
        <div style="padding:12px 14px;border-radius:12px;background:var(--bg-control);border:1px solid var(--border-subtle);">
          <div class="mono txt-amber" style="font-size:11px;font-weight:700;margin-bottom:6px;">
            ITEM #${dIdx + 1}
          </div>
          <div>${renderFilteredColumnsList(d, EXCLUDED_ISSUE_DETAIL_KEYS)}</div>
        </div>
      `
      )
      .join('');

    detailsSectionHtml = `
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle);">
        <div class="mono txt-amber" style="font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:10px;">
          Detail Items (${selectedIssueDetails.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">${detailCards}</div>
      </div>
    `;
  }

  const exportBtn = document.getElementById('exportIssueXlsxBtn');
  if (exportBtn) {
    exportBtn.disabled = selectedIssueDetails.length === 0;
    exportBtn.style.opacity = selectedIssueDetails.length === 0 ? '0.5' : '1';
  }

  document.getElementById('issueDrawerContent').innerHTML = fieldsHtml + detailsSectionHtml;
  document.getElementById('issueDrawer').classList.remove('hidden');
}

function closeIssueDrawer() {
  document.getElementById('issueDrawer')?.classList.add('hidden');
}

function exportSelectedIssueToXLSX() {
  if (!selectedIssueItem) {
    showIssueToast('กรุณาเลือกรายการใบเบิกก่อน');
    return;
  }

  if (!selectedIssueDetails.length) {
    showIssueToast('ใบเบิกนี้ไม่มี Detail Items สำหรับ Export');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showIssueToast('ไม่พบไลบรารี XLSX กรุณารีเฟรชหน้า');
    return;
  }

  const cleanVal = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : v);

  const headers = [
    'order',
    "s'tag",
    'box',
    'location',
    'Remarks',
    'เป่าสติ๊กเกอร์',
    'ติดสติ๊กเกอร์',
    'เปลี่ยนกล่อง',
    'หยิบกล่อง'
  ];

  const excelRows = selectedIssueDetails.map((d) => ({
    order: cleanVal(pickIssueField(d, ['Order_Number', 'order_number', 'Order', 'order'], '-')),
    "s'tag": cleanVal(pickIssueField(d, ['Service_Tag', 'service_tag', "s'tag", 's_tag'], '-')),
    box: cleanVal(pickIssueField(d, ['Part_Name', 'part_name', 'box', 'Box', 'Product'], '-')),
    location: cleanVal(pickIssueField(d, ['Location_Name', 'location_name', 'location', 'Location'], '-')),
    Remarks: cleanVal(pickIssueField(d, ['Remark', 'remark', 'Remarks', 'remarks'], '-')),
    เป่าสติ๊กเกอร์: cleanVal(pickIssueField(d, ['Blow', 'blow', 'เป่าสติ๊กเกอร์'], '-')),
    ติดสติ๊กเกอร์: cleanVal(pickIssueField(d, ['Stick', 'stick', 'ติดสติ๊กเกอร์'], '-')),
    เปลี่ยนกล่อง: cleanVal(pickIssueField(d, ['Change', 'change', 'เปลี่ยนกล่อง'], '-')),
    หยิบกล่อง: cleanVal(pickIssueField(d, ['Pull', 'pull', 'หยิบกล่อง'], '-'))
  }));

  const ws = XLSX.utils.json_to_sheet(excelRows, { header: headers });

  // กำหนดความกว้างทุกคอลัมน์เป็น 12
  ws['!cols'] = headers.map(() => ({ wch: 12 }));

  // ใส่สีให้หัวตารางช่องที่ 1 (A1)
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
    pickIssueField(
      selectedIssueItem,
      ['IssueNo', 'issue_no', 'IssueID', 'issue_id', 'Issue_ID', 'Row ID'],
      'stock_issue'
    )
  ).trim();
  const safeFileName = rawDocName.replace(/[\\/:*?"<>|]+/g, '_') || 'stock_issue';

  XLSX.writeFile(wb, `${safeFileName}.xlsx`);
  showIssueToast(`EXPORTED ${excelRows.length} ITEMS (.XLSX)`);
}

document.addEventListener('DOMContentLoaded', () => {
  initIssueSortableHeaders();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeIssueDrawer();
  });

  document.getElementById('issueSearchInput')?.addEventListener('input', () => renderIssueTable(allIssueRows));
  document.getElementById('issueSearchColumn')?.addEventListener('change', () => renderIssueTable(allIssueRows));
  document.getElementById('issueDateFilter')?.addEventListener('change', () => renderIssueTable(allIssueRows));

  loadStockIssue();
});