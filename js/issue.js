let allIssueRows = [];
let currentFilteredIssueRows = [];
let issueDetailRows = [];
let issueSortState = { key: null, dir: 'desc' };

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

function renderAllColumnsList(obj) {
  const entries = Object.entries(obj || {}).filter(([k]) => !k.startsWith('__'));
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
    IssueID: ['IssueID', 'issue_id', 'Issue_ID', 'ID', 'Row ID'],
    IssueDate: ['IssueDate', 'issue_date', 'Issue_Date', 'Date', 'CreatedAt', 'created_at'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No'],
    Part_Name: ['Part_Name', 'part_name', 'Product'],
    Location_Name: ['Location_Name', 'location_name', 'LocationID', 'location_id', 'From_Location'],
    Qty: ['Qty', 'qty', 'IssueQty', 'issue_qty', 'QtyBalance', 'qty_balance']
  };
  const val = pickIssueField(item, map[colKey] || [colKey], '');
  if (colKey === 'Qty') {
    return Number(val) || 0;
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
  const keyByIndex = ['IssueID', 'IssueDate', 'LotNo', 'Part_Name', 'Location_Name', 'Qty'];

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
  const keyByIndex = ['IssueID', 'IssueDate', 'LotNo', 'Part_Name', 'Location_Name', 'Qty'];
  const baseLabels = ['ISSUE ID', 'ISSUE DATE', 'LOTNO', 'PART_NAME', 'LOCATION', 'QTY'];

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
      tbody.innerHTML = `<tr><td colspan="6" style="padding:40px 16px;text-align:center;color:#e11d48;font-family:'JetBrains Mono',monospace;font-size:12px;">Error: ${escapeIssueHtml(err.message)}</td></tr>`;
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
    IssueID: ['IssueID', 'issue_id', 'Issue_ID', 'Row ID'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No'],
    Part_Name: ['Part_Name', 'part_name', 'Product'],
    Location_Name: ['Location_Name', 'location_name', 'LocationID', 'location_id', 'From_Location']
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
    tbody.innerHTML = `<tr><td colspan="6" class="txt-muted" style="padding:44px 16px;text-align:center;">ไม่พบรายการเบิกออกตามเงื่อนไข</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  currentFilteredIssueRows.forEach((item, idx) => {
    const issId = pickIssueField(item, ['IssueID', 'issue_id', 'Issue_ID', 'Row ID']);
    const issDate = pickIssueField(item, ['IssueDate', 'issue_date', 'Issue_Date', 'Date', 'CreatedAt', 'created_at']);
    const lotNo = pickIssueField(item, ['LotNo', 'lot_no', 'Lot_No']);
    const partName = pickIssueField(item, ['Part_Name', 'part_name', 'Product']);
    const loc = pickIssueField(item, ['Location_Name', 'location_name', 'LocationID', 'location_id', 'From_Location']);
    const qty = Number(item.__computedQty) || 0;

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => openIssueDrawerByIndex(idx);

    const safeIssId = escapeIssueHtml(issId);
    const safeIssDate = escapeIssueHtml(issDate);
    const safeLotNo = escapeIssueHtml(lotNo);
    const safePartName = escapeIssueHtml(partName);
    const safeLoc = escapeIssueHtml(loc);
    const jsSafeIssId = String(issId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    tr.innerHTML = `
      <td class="mono txt-cyan" style="font-weight:700;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <span>${safeIssId}</span>
          <button type="button" onclick="copyIssueText(event, '${jsSafeIssId}')" class="btn btn-ghost"
            style="padding:2px 8px;border-radius:6px;font-size:11px;">Copy</button>
        </div>
      </td>
      <td class="mono txt-secondary" style="font-size:12.5px;">${safeIssDate}</td>
      <td class="mono txt-secondary" style="font-size:12.5px;">${safeLotNo}</td>
      <td class="txt-primary" style="font-weight:600;">${safePartName}</td>
      <td>
        ${
          loc !== '-'
            ? `<a href="location.html?highlight=${encodeURIComponent(String(loc))}" onclick="event.stopPropagation()" class="mono loc-pill">${safeLoc} ↗</a>`
            : `<span class="txt-muted">-</span>`
        }
      </td>
      <td class="mono txt-amber" style="text-align:right;font-weight:700;">-${qty.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openIssueDrawerByIndex(index) {
  const item = currentFilteredIssueRows[index];
  if (!item) return;

  const issId = String(pickIssueField(item, ['IssueID', 'issue_id', 'Issue_ID', 'Row ID'], '-'));
  document.getElementById('issueDrawerTitle').textContent = issId;

  const cleanEntries = Object.entries(item).filter(([k]) => !k.startsWith('__'));
  const fieldsHtml = cleanEntries
    .map(
      ([key, val]) => `
      <div class="detail-row">
        <dt class="mono txt-muted" style="font-size:12px;">${escapeIssueHtml(key)}</dt>
        <dd class="mono txt-primary" style="font-size:12px;font-weight:600;text-align:right;word-break:break-all;margin:0;">${escapeIssueHtml(val ?? '-')}</dd>
      </div>
    `
    )
    .join('');

  const matchedDetails = issueDetailRows.filter(
    (d) => String(pickIssueField(d, ['IssueID', 'issue_id', 'Issue_ID'], '')).trim() === issId.trim()
  );

  let detailsSectionHtml = '';
  if (matchedDetails.length > 0) {
    const detailCards = matchedDetails
      .map(
        (d, dIdx) => `
        <div style="padding:12px 14px;border-radius:12px;background:var(--bg-control);border:1px solid var(--border-subtle);">
          <div class="mono txt-amber" style="font-size:11px;font-weight:700;margin-bottom:6px;">
            ITEM #${dIdx + 1}
          </div>
          <div>${renderAllColumnsList(d)}</div>
        </div>
      `
      )
      .join('');

    detailsSectionHtml = `
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle);">
        <div class="mono txt-amber" style="font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:10px;">
          Detail Items (${matchedDetails.length})
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">${detailCards}</div>
      </div>
    `;
  }

  document.getElementById('issueDrawerContent').innerHTML = fieldsHtml + detailsSectionHtml;
  document.getElementById('issueDrawer').classList.remove('hidden');
}

function closeIssueDrawer() {
  document.getElementById('issueDrawer')?.classList.add('hidden');
}

function exportIssueToCSV() {
  if (!currentFilteredIssueRows.length) {
    showIssueToast('ไม่มีข้อมูลสำหรับ Export');
    return;
  }

  const headers = ['IssueID', 'IssueDate', 'LotNo', 'Part_Name', 'Location_Name', 'Qty'];
  const escapeCSV = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const lines = [
    headers.map(escapeCSV).join(','),
    ...currentFilteredIssueRows.map((item) => {
      const issId = pickIssueField(item, ['IssueID', 'issue_id', 'Issue_ID', 'Row ID']);
      const issDate = pickIssueField(item, ['IssueDate', 'issue_date', 'Issue_Date', 'Date', 'CreatedAt', 'created_at']);
      const lotNo = pickIssueField(item, ['LotNo', 'lot_no', 'Lot_No']);
      const partName = pickIssueField(item, ['Part_Name', 'part_name', 'Product']);
      const loc = pickIssueField(item, ['Location_Name', 'location_name', 'LocationID', 'location_id', 'From_Location']);
      const qty = Number(item.__computedQty) || 0;
      return [issId, issDate, lotNo, partName, loc, qty].map(escapeCSV).join(',');
    })
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `stock_issue_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showIssueToast(`EXPORTED ${currentFilteredIssueRows.length} ROWS`);
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