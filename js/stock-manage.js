let allMgrRows = [];
let currentFilteredMgrRows = [];
let selectedRowKeys = new Set();
let mgrSortState = { key: null, dir: 'asc' };

const MGR_TABLE_LABELS = {
  Part_Name: 'CARTON PART NO.',
  Type_cartons: 'TYPE_CARTONS',
  LotNo: 'LOT',
  Location_Name: 'LOCATION',
  QtyBalance: 'QTY'
};

const getMgrClient = () => window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

const pickMgrField = (obj, keys, fallback = '-') => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }
  return fallback;
};

const escapeMgrHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMgrDisplayValue = (val) => {
  if (val === null || val === undefined || String(val).trim() === '') return '-';
  const str = String(val).trim();
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})[T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i);
  if (isoMatch) {
    return `${isoMatch[1]} ${isoMatch[2]}`;
  }
  return str;
};

function renderSilentMgrSpinnerHtml(large = false) {
  const sizeClass = large ? 'spinner-ring spinner-ring-lg' : 'spinner-ring';
  const wrapClass = large ? 'spinner-wrap-center' : 'spinner-wrap';
  return `<div class="${wrapClass}" aria-hidden="true"><span class="${sizeClass}"></span></div>`;
}

function showMgrToast(message, isError = false) {
  let toast = document.getElementById('toastBox');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastBox';
    toast.className = 'mono';
    toast.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:70;padding:10px 16px;border-radius:11px;background:var(--bg-surface);font-size:12px;font-weight:600;box-shadow:0 12px 28px rgba(0,0,0,0.22);';
    document.body.appendChild(toast);
  }
  toast.style.border = isError ? '1px solid #e11d48' : '1px solid var(--c-cyan)';
  toast.style.color = isError ? '#e11d48' : 'var(--c-cyan)';
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.add('hidden'), 2400);
}

// หา Primary Key ของแถวในตาราง stock_box อัตโนมัติ
function resolvePrimaryKeyInfo(row) {
  const pkCandidates = ['StockBoxID', 'stock_box_id', 'Row ID', 'rowid', 'row_id', 'id', 'ID'];
  for (const col of pkCandidates) {
    if (row && row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
      return { column: col, value: row[col] };
    }
  }
  return null;
}

function getRowSelectionId(row, fallbackIdx) {
  const pk = resolvePrimaryKeyInfo(row);
  if (pk) return `${pk.column}::${pk.value}`;
  return `idx::${fallbackIdx}`;
}

function generateStockBoxId(len = 8) {
  const chars = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// จับคู่ชื่อคอลัมน์จริงในฐานข้อมูล (รองรับทั้ง PascalCase และ snake_case)
function resolveActualColumnName(sampleRow, candidates, defaultName) {
  if (!sampleRow) return defaultName;
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(sampleRow, c)) {
      return c;
    }
  }
  return defaultName;
}

function copyMgrText(event, text) {
  event.stopPropagation();
  if (!text || text === '-') return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(String(text));
  }
  showMgrToast(`COPIED: ${text}`);
}

function clearMgrFilters() {
  const searchInput = document.getElementById('mgrSearchInput');
  const searchColumn = document.getElementById('mgrSearchColumn');
  const statusFilter = document.getElementById('mgrStatusFilter');

  if (searchInput) searchInput.value = '';
  if (searchColumn) searchColumn.value = 'all';
  if (statusFilter) statusFilter.value = 'all';
  mgrSortState = { key: null, dir: 'asc' };

  renderMgrTable(allMgrRows);
}

function getMgrColumnValue(item, colKey) {
  const map = {
    Part_Name: ['Part_Name', 'part_name', 'Product', 'Carton Part No.'],
    Type_cartons: ['Type_cartons', 'type_cartons', 'TypeCartons', 'Type'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No', 'Lot'],
    Location_Name: ['Location_Name', 'location_name', 'LocationID', 'location_id', 'Location'],
    QtyBalance: ['QtyBalance', 'qty_balance', 'Qty', 'qty']
  };
  const val = pickMgrField(item, map[colKey] || [colKey], '');
  if (colKey === 'QtyBalance') {
    return Number(val) || 0;
  }
  return String(val === '-' ? '' : val).toLowerCase();
}

function sortMgrByColumn(colKey) {
  if (mgrSortState.key === colKey) {
    mgrSortState.dir = mgrSortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    mgrSortState.key = colKey;
    mgrSortState.dir = colKey === 'QtyBalance' ? 'desc' : 'asc';
  }
  renderMgrTable(allMgrRows);
}

function initMgrSortableHeaders() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = [null, 'Part_Name', 'Type_cartons', 'LotNo', 'Location_Name', 'QtyBalance'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.title = 'คลิกเพื่อเรียงลำดับ';
    th.onclick = () => sortMgrByColumn(key);
  });
}

function updateMgrSortIndicators() {
  const ths = document.querySelectorAll('.data-table thead th');
  const keyByIndex = [null, 'Part_Name', 'Type_cartons', 'LotNo', 'Location_Name', 'QtyBalance'];

  ths.forEach((th, index) => {
    const key = keyByIndex[index];
    if (!key) return;
    const baseLabel = MGR_TABLE_LABELS[key] || key;
    let arrow = ' ↕';
    if (mgrSortState.key === key) {
      arrow = mgrSortState.dir === 'asc' ? ' ↑' : ' ↓';
      th.style.color = 'var(--c-cyan)';
    } else {
      th.style.color = 'var(--text-muted)';
    }
    th.textContent = `${baseLabel}${arrow}`;
  });
}

async function loadLocationDatalist() {
  try {
    const client = getMgrClient();
    if (!client) return;
    const { data } = await client.from('locations').select('*');
    const dl = document.getElementById('locationOptionsList');
    if (!dl || !Array.isArray(data)) return;

    const names = Array.from(
      new Set(
        data
          .map((r) => String(pickMgrField(r, ['Location_Name', 'location_name', 'LocationID', 'location_id'], '')).trim())
          .filter((v) => v && v !== '-')
      )
    ).sort();

    dl.innerHTML = names.map((name) => `<option value="${escapeMgrHtml(name)}"></option>`).join('');
  } catch (e) {
    console.warn('Location datalist load skipped:', e);
  }
}

async function loadStockManage() {
  const loading = document.getElementById('mgrLoadingBanner');
  const tbody = document.getElementById('mgrTableBody');
  const badge = document.getElementById('dbStatusBadge');

  if (loading) {
    loading.innerHTML = `<span class="spinner-ring"></span>`;
    loading.classList.remove('hidden');
  }
  if (tbody && allMgrRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">${renderSilentMgrSpinnerHtml(true)}</td></tr>`;
  }

  try {
    const client = getMgrClient();
    if (!client) {
      throw new Error('ยังไม่ได้สร้าง Supabase client (_supabase) กรุณาเช็กไฟล์ js/config.js');
    }

    const { data, error } = await client.from('stock_box').select('*');
    if (error) throw error;

    allMgrRows = Array.isArray(data) ? data : [];
    selectedRowKeys.clear();
    updateSelectionUI();
    updateMgrKPIs(allMgrRows);
    renderMgrTable(allMgrRows);

    const now = new Date();
    const lastSyncEl = document.getElementById('mgrKpiLastSync');
    const statusTextEl = document.getElementById('mgrKpiStatusText');
    if (lastSyncEl) lastSyncEl.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
    if (statusTextEl) statusTextEl.textContent = 'เชื่อมต่อ Supabase สำเร็จ';

    if (badge) {
      badge.className = 'mono status-pill-active';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.textContent = '● LIVE';
    }
  } catch (err) {
    console.error('Stock Manage Error:', err);
    if (badge) {
      badge.className = 'mono status-pill-empty';
      badge.style.padding = '2px 9px';
      badge.style.fontSize = '11px';
      badge.style.color = '#e11d48';
      badge.textContent = '● ERROR';
    }
    const statusTextEl = document.getElementById('mgrKpiStatusText');
    if (statusTextEl) statusTextEl.textContent = err.message || 'โหลดข้อมูลไม่สำเร็จ';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding:40px 16px;text-align:center;color:#e11d48;font-family:'JetBrains Mono',monospace;font-size:12px;">Error: ${escapeMgrHtml(err.message)}</td></tr>`;
    }
  } finally {
    loading?.classList.add('hidden');
  }
}

function updateMgrKPIs(rows) {
  let totalQty = 0;
  let emptyCount = 0;

  rows.forEach((r) => {
    const qty = Number(pickMgrField(r, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;
    totalQty += qty;
    if (qty <= 0) emptyCount += 1;
  });

  document.getElementById('mgrKpiTotalBoxes').textContent = rows.length.toLocaleString();
  document.getElementById('mgrKpiTotalQty').textContent = totalQty.toLocaleString();
  document.getElementById('mgrKpiEmptyCount').textContent = emptyCount.toLocaleString();
}

function getFilteredMgrRows(rows) {
  const col = document.getElementById('mgrSearchColumn')?.value || 'all';
  const q = (document.getElementById('mgrSearchInput')?.value || '').trim().toLowerCase();
  const status = document.getElementById('mgrStatusFilter')?.value || 'all';
  const clearBtn = document.getElementById('clearMgrSearchBtn');

  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !q && col === 'all' && status === 'all' && !mgrSortState.key);
  }

  const colKeyMap = {
    Part_Name: ['Part_Name', 'part_name', 'Product', 'Carton Part No.'],
    Type_cartons: ['Type_cartons', 'type_cartons', 'TypeCartons', 'Type'],
    LotNo: ['LotNo', 'lot_no', 'Lot_No', 'Lot'],
    Location_Name: ['Location_Name', 'location_name', 'LocationID', 'location_id', 'Location']
  };

  let result = rows.filter((r) => {
    const qty = Number(pickMgrField(r, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;
    if (status === 'available' && qty <= 0) return false;
    if (status === 'empty' && qty > 0) return false;

    if (!q) return true;

    if (col === 'all') {
      return JSON.stringify(r).toLowerCase().includes(q);
    }

    const targetVal = String(pickMgrField(r, colKeyMap[col] || [col], '')).toLowerCase();
    return targetVal.includes(q);
  });

  if (mgrSortState.key) {
    const { key, dir } = mgrSortState;
    const factor = dir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      const valA = getMgrColumnValue(a, key);
      const valB = getMgrColumnValue(b, key);
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * factor;
      }
      return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * factor;
    });
  }

  return result;
}

function renderMgrTable(rows) {
  const tbody = document.getElementById('mgrTableBody');
  currentFilteredMgrRows = getFilteredMgrRows(rows);
  updateMgrSortIndicators();
  document.getElementById('mgrShowingCount').textContent = currentFilteredMgrRows.length.toLocaleString();

  if (!tbody) return;

  if (currentFilteredMgrRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="txt-muted" style="padding:44px 16px;text-align:center;">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
    updateSelectionUI();
    return;
  }

  tbody.innerHTML = '';
  currentFilteredMgrRows.forEach((item, idx) => {
    const selId = getRowSelectionId(item, idx);
    const isChecked = selectedRowKeys.has(selId);

    const partName = pickMgrField(item, ['Part_Name', 'part_name', 'Product', 'Carton Part No.']);
    const typeCartons = pickMgrField(item, ['Type_cartons', 'type_cartons', 'TypeCartons', 'Type']);
    const lotNo = formatMgrDisplayValue(pickMgrField(item, ['LotNo', 'lot_no', 'Lot_No', 'Lot']));
    const loc = pickMgrField(item, ['Location_Name', 'location_name', 'LocationID', 'location_id', 'Location']);
    const qty = Number(pickMgrField(item, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => openStockEditModal(idx);

    const safePartName = escapeMgrHtml(partName);
    const safeTypeCartons = escapeMgrHtml(typeCartons);
    const safeLotNo = escapeMgrHtml(lotNo);
    const safeLoc = escapeMgrHtml(loc);
    const jsSafePartName = String(partName).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const jsSafeSelId = String(selId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    tr.innerHTML = `
      <td style="text-align:center;" onclick="event.stopPropagation()">
        <input type="checkbox" ${isChecked ? 'checked' : ''}
          onchange="toggleSingleRowSelection('${jsSafeSelId}', this.checked)"
          style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-cyan);" />
      </td>
      <td class="mono txt-primary" style="font-weight:700;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <span>${safePartName}</span>
          <button type="button" onclick="copyMgrText(event, '${jsSafePartName}')" class="btn btn-ghost"
            style="padding:2px 8px;border-radius:6px;font-size:11px;">Copy</button>
        </div>
      </td>
      <td class="txt-secondary" style="font-size:13px;">${safeTypeCartons}</td>
      <td class="mono txt-secondary" style="font-size:12.5px;">${safeLotNo}</td>
      <td>
        <a href="../location/?highlight=${encodeURIComponent(String(loc))}" onclick="event.stopPropagation()" class="mono loc-pill">
          ${safeLoc} ↗
        </a>
      </td>
      <td class="mono ${qty > 0 ? 'txt-emerald' : 'txt-muted'}" style="text-align:right;font-weight:700;">${qty.toLocaleString()}</td>
      <td style="text-align:center;">
        <span class="${qty > 0 ? 'status-pill-active' : 'status-pill-empty'}">${qty > 0 ? 'พร้อมใช้' : 'หมด'}</span>
      </td>
      <td style="text-align:right;white-space:nowrap;" onclick="event.stopPropagation()">
        <div style="display:inline-flex;align-items:center;gap:6px;">
          <button type="button" onclick="openStockEditModal(${idx})" class="btn btn-ghost"
            style="padding:4px 10px;border-radius:7px;font-size:11.5px;">แก้ไข</button>
          <button type="button" onclick="deleteSingleStockRow(${idx})" class="btn btn-ghost"
            style="padding:4px 10px;border-radius:7px;font-size:11.5px;color:#e11d48;border-color:rgba(225,29,72,0.28);">ลบ</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateSelectionUI();
}

function toggleSingleRowSelection(selId, checked) {
  if (checked) {
    selectedRowKeys.add(selId);
  } else {
    selectedRowKeys.delete(selId);
  }
  updateSelectionUI();
}

function toggleSelectAllRows(checked) {
  currentFilteredMgrRows.forEach((item, idx) => {
    const selId = getRowSelectionId(item, idx);
    if (checked) {
      selectedRowKeys.add(selId);
    } else {
      selectedRowKeys.delete(selId);
    }
  });
  renderMgrTable(allMgrRows);
}

function updateSelectionUI() {
  const bulkBtn = document.getElementById('bulkDeleteBtn');
  const countEl = document.getElementById('selectedRowsCount');
  const selectAllCb = document.getElementById('selectAllRowsCheckbox');

  if (countEl) countEl.textContent = selectedRowKeys.size.toLocaleString();
  if (bulkBtn) bulkBtn.classList.toggle('hidden', selectedRowKeys.size === 0);

  if (selectAllCb) {
    if (currentFilteredMgrRows.length === 0) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    } else {
      const selectedInView = currentFilteredMgrRows.filter((item, idx) =>
        selectedRowKeys.has(getRowSelectionId(item, idx))
      ).length;
      selectAllCb.checked = selectedInView === currentFilteredMgrRows.length;
      selectAllCb.indeterminate = selectedInView > 0 && selectedInView < currentFilteredMgrRows.length;
    }
  }
}

function openStockEditModal(filteredIndex) {
  const modal = document.getElementById('stockEditModal');
  const badge = document.getElementById('editModalBadge');
  const title = document.getElementById('editModalTitle');
  const idxInput = document.getElementById('editRowIndex');

  const partInput = document.getElementById('fieldPartName');
  const typeInput = document.getElementById('fieldTypeCartons');
  const lotInput = document.getElementById('fieldLotNo');
  const locInput = document.getElementById('fieldLocationName');
  const qtyInput = document.getElementById('fieldQtyBalance');
  const remarkInput = document.getElementById('fieldRemark');

  if (filteredIndex === null || filteredIndex === undefined) {
    idxInput.value = '';
    badge.textContent = 'NEW RECORD // STOCK_BOX';
    title.textContent = 'เพิ่มรายการกล่องใหม่';
    partInput.value = '';
    typeInput.value = '';
    lotInput.value = new Date().toISOString().slice(0, 10);
    locInput.value = 'ที่จัดเก็บชั่วคราว';
    qtyInput.value = '1';
    remarkInput.value = '';
  } else {
    const item = currentFilteredMgrRows[filteredIndex];
    if (!item) return;

    idxInput.value = String(filteredIndex);
    const pk = resolvePrimaryKeyInfo(item);
    badge.textContent = pk ? `EDIT // ${pk.column}: ${pk.value}` : 'EDIT // STOCK_BOX';
    title.textContent = `แก้ไข: ${pickMgrField(item, ['Part_Name', 'part_name'], 'รายการสต็อก')}`;

    partInput.value = pickMgrField(item, ['Part_Name', 'part_name', 'Product'], '');
    typeInput.value = pickMgrField(item, ['Type_cartons', 'type_cartons', 'TypeCartons', 'Type'], '');
    const rawLot = pickMgrField(item, ['LotNo', 'lot_no', 'Lot_No', 'Lot'], '');
    lotInput.value = rawLot === '-' ? '' : formatMgrDisplayValue(rawLot);
    locInput.value = pickMgrField(item, ['Location_Name', 'location_name', 'LocationID', 'location_id', 'Location'], '');
    qtyInput.value = String(Number(pickMgrField(item, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0);
    const rawRemark = pickMgrField(item, ['Remark', 'remark', 'Remarks', 'remarks'], '');
    remarkInput.value = rawRemark === '-' ? '' : rawRemark;
  }

  modal?.classList.remove('hidden');
  setTimeout(() => partInput?.focus(), 30);
}

function closeStockEditModal() {
  document.getElementById('stockEditModal')?.classList.add('hidden');
}

async function saveStockBoxRecord(event) {
  event.preventDefault();
  const client = getMgrClient();
  if (!client) {
    showMgrToast('ไม่พบ Supabase client (_supabase)', true);
    return;
  }

  const saveBtn = document.getElementById('saveStockModalBtn');
  const idxVal = document.getElementById('editRowIndex').value;
  const isEdit = idxVal !== '';
  const targetRow = isEdit ? currentFilteredMgrRows[Number(idxVal)] : null;
  const sampleRow = targetRow || allMgrRows[0] || null;

  const partName = document.getElementById('fieldPartName').value.trim();
  const typeCartons = document.getElementById('fieldTypeCartons').value.trim();
  const lotNo = document.getElementById('fieldLotNo').value.trim();
  const locationName = document.getElementById('fieldLocationName').value.trim();
  const qtyBalance = Math.max(0, Math.floor(Number(document.getElementById('fieldQtyBalance').value) || 0));
  const remark = document.getElementById('fieldRemark').value.trim();

  if (!partName || !locationName) {
    showMgrToast('กรุณากรอก Carton Part No. และ Location', true);
    return;
  }

  const colPart = resolveActualColumnName(sampleRow, ['Part_Name', 'part_name'], 'Part_Name');
  const colType = resolveActualColumnName(sampleRow, ['Type_cartons', 'type_cartons'], 'Type_cartons');
  const colLot = resolveActualColumnName(sampleRow, ['LotNo', 'lot_no', 'Lot_No'], 'LotNo');
  const colLoc = resolveActualColumnName(sampleRow, ['Location_Name', 'location_name'], 'Location_Name');
  const colQty = resolveActualColumnName(sampleRow, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 'QtyBalance');

  const payload = {
    [colPart]: partName,
    [colType]: typeCartons || '-',
    [colLot]: lotNo || '-',
    [colLoc]: locationName,
    [colQty]: qtyBalance
  };

  if (sampleRow) {
    if (Object.prototype.hasOwnProperty.call(sampleRow, 'Remark')) payload.Remark = remark || null;
    else if (Object.prototype.hasOwnProperty.call(sampleRow, 'remark')) payload.remark = remark || null;
    else if (Object.prototype.hasOwnProperty.call(sampleRow, 'Remarks')) payload.Remarks = remark || null;
  } else if (remark) {
    payload.Remark = remark;
  }

  try {
    if (saveBtn) saveBtn.disabled = true;

    if (isEdit && targetRow) {
      const pk = resolvePrimaryKeyInfo(targetRow);
      if (!pk) {
        throw new Error('ไม่พบ Primary Key (StockBoxID / Row ID) สำหรับอัปเดตแถวนี้');
      }
      const { error } = await client.from('stock_box').update(payload).eq(pk.column, pk.value);
      if (error) throw error;
      showMgrToast(`UPDATED: ${partName}`);
    } else {
      const idCol = resolveActualColumnName(sampleRow, ['StockBoxID', 'stock_box_id'], 'StockBoxID');
      if (!sampleRow || Object.prototype.hasOwnProperty.call(sampleRow, idCol)) {
        payload[idCol] = generateStockBoxId(8);
      }
      const { error } = await client.from('stock_box').insert([payload]);
      if (error) throw error;
      showMgrToast(`ADDED: ${partName}`);
    }

    closeStockEditModal();
    await loadStockManage();
    if (isEdit && targetRow) {
      const pk = resolvePrimaryKeyInfo(targetRow);
      if (!pk) {
        throw new Error('ไม่พบ Primary Key (StockBoxID / Row ID) สำหรับอัปเดตแถวนี้');
      }
      const { error } = await client.from('stock_box').update(payload).eq(pk.column, pk.value);
      if (error) throw error;

      await window.ActivityLogger?.log({
        page: 'Stock Manage',
        action: 'UPDATE',
        actor: 'Admin',
        summary: `แก้ไขกล่อง ${partName} (Lot: ${lotNo || '-'}, Location: ${locationName}, Qty: ${qtyBalance})`,
        meta: { id: pk.value, partName, typeCartons, lotNo, locationName, qtyBalance, remark }
      });

      showMgrToast(`UPDATED: ${partName}`);
    } else {
      const idCol = resolveActualColumnName(sampleRow, ['StockBoxID', 'stock_box_id'], 'StockBoxID');
      const newId = generateStockBoxId(8);
      if (!sampleRow || Object.prototype.hasOwnProperty.call(sampleRow, idCol)) {
        payload[idCol] = newId;
      }
      const { error } = await client.from('stock_box').insert([payload]);
      if (error) throw error;

      await window.ActivityLogger?.log({
        page: 'Stock Manage',
        action: 'CREATE',
        actor: 'Admin',
        summary: `เพิ่มกล่องใหม่ ${partName} (Lot: ${lotNo || '-'}, Location: ${locationName}, Qty: ${qtyBalance})`,
        meta: { id: newId, partName, typeCartons, lotNo, locationName, qtyBalance, remark }
      });

      showMgrToast(`ADDED: ${partName}`);
    }
  } catch (err) {
    console.error('Save Stock Box Error:', err);
    showMgrToast(`ERROR: ${err.message || 'บันทึกไม่สำเร็จ'}`, true);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function deleteSingleStockRow(filteredIndex) {
  
  const item = currentFilteredMgrRows[filteredIndex];
  if (!item) return;

  const partName = pickMgrField(item, ['Part_Name', 'part_name'], 'รายการนี้');
  const loc = pickMgrField(item, ['Location_Name', 'location_name'], '-');
  const confirmed = await openCustomDeleteConfirm(
    `ยืนยันการลบ "${partName}" (Location: ${loc}) ออกจากตาราง stock_box ?`
  );
  if (!confirmed) return;

  const pk = resolvePrimaryKeyInfo(item);
  if (!pk) {
    showMgrToast('ไม่พบ Primary Key สำหรับลบรายการนี้', true);
    return;
  }

  try {
    const client = getMgrClient();
    const { error } = await client.from('stock_box').delete().eq(pk.column, pk.value);
    if (error) throw error;
    await window.ActivityLogger?.log({
      page: 'Stock Manage',
      action: 'DELETE',
      actor: 'Admin',
      summary: `ลบกล่อง ${partName} (Lot: ${lotNo || '-'}, Location: ${locationName}, Qty: ${qtyBalance})`,
      meta: { id: pk.value, partName, typeCartons, lotNo, locationName, qtyBalance, remark }
    });
    showMgrToast(`DELETED: ${partName}`);
    await loadStockManage();
  } catch (err) {
    console.error('Delete Row Error:', err);
    showMgrToast(`ERROR: ${err.message || 'ลบไม่สำเร็จ'}`, true);
  }
}

async function deleteSelectedStockRows() {
  for (const col of pkColumns) {
      const { error } = await client.from('stock_box').delete().in(col, groupedByPkCol[col]);
      if (error) throw error;
    }

    const previewNames = targets
      .slice(0, 5)
      .map((r) => pickMgrField(r, ['Part_Name', 'part_name'], '-'))
      .join(', ');
    const extraCount = targets.length > 5 ? ` และอีก ${targets.length - 5} รายการ` : '';

    await window.ActivityLogger?.log({
      page: 'Stock Manage',
      action: 'DELETE',
      actor: 'Admin',
      summary: `ลบข้อมูลแบบหลายรายการ ${targets.length} แถว (${previewNames}${extraCount}) ออกจาก stock_box`,
      meta: { count: targets.length, items: previewNames }
    });

    showMgrToast(`DELETED ${targets.length} ROWS`);
    await loadStockManage();
  if (selectedRowKeys.size === 0) return;

  const targets = currentFilteredMgrRows.filter((item, idx) =>
    selectedRowKeys.has(getRowSelectionId(item, idx))
  );

  if (!targets.length) return;
  const confirmed = await openCustomDeleteConfirm(
    `ยืนยันการลบข้อมูลที่เลือกทั้งหมด ${targets.length} รายการ ออกจากตาราง stock_box ?`
  );
  if (!confirmed) return;

  try {
    const client = getMgrClient();
    const groupedByPkCol = {};

    targets.forEach((row) => {
      const pk = resolvePrimaryKeyInfo(row);
      if (!pk) return;
      if (!groupedByPkCol[pk.column]) groupedByPkCol[pk.column] = [];
      groupedByPkCol[pk.column].push(pk.value);
    });

    const pkColumns = Object.keys(groupedByPkCol);
    if (pkColumns.length === 0) {
      throw new Error('ไม่พบ Primary Key ในรายการที่เลือก');
    }

    for (const col of pkColumns) {
      const { error } = await client.from('stock_box').delete().in(col, groupedByPkCol[col]);
      if (error) throw error;
    }

    showMgrToast(`DELETED ${targets.length} ROWS`);
    await loadStockManage();
  } catch (err) {
    console.error('Bulk Delete Error:', err);
    showMgrToast(`ERROR: ${err.message || 'ลบหลายรายการไม่สำเร็จ'}`, true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMgrSortableHeaders();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeStockEditModal();
  });

  document.getElementById('mgrSearchInput')?.addEventListener('input', () => renderMgrTable(allMgrRows));
  document.getElementById('mgrSearchColumn')?.addEventListener('change', () => renderMgrTable(allMgrRows));
  document.getElementById('mgrStatusFilter')?.addEventListener('change', () => renderMgrTable(allMgrRows));

  loadLocationDatalist();
  loadStockManage();
});

// เปลี่ยนรหัส PIN ตรงนี้ (ให้ตรงกับหน้า Dashboard)
  const ACTION_PIN_CODE = '1234';
  let pendingPinCallback = null;
  let pendingDeleteResolver = null;

  function openPinActionModal(event, onSuccess, titleText = 'กรอกรหัส PIN') {
    if (event) event.preventDefault();
    pendingPinCallback = typeof onSuccess === 'function' ? onSuccess : null;

    const modal = document.getElementById('pinGuardModal');
    const input = document.getElementById('pinGuardInput');
    const errEl = document.getElementById('pinGuardError');
    const titleEl = document.getElementById('pinGuardTitle');

    if (titleEl) titleEl.textContent = titleText;
    if (errEl) errEl.classList.add('hidden');
    if (input) {
      input.value = '';
      modal?.classList.remove('hidden');
      setTimeout(() => input.focus(), 30);
    }
    return false;
  }

  function closePinGuardModal() {
    pendingPinCallback = null;
    document.getElementById('pinGuardModal')?.classList.add('hidden');
  }

  function verifyPinGuard() {
    const input = document.getElementById('pinGuardInput');
    const errEl = document.getElementById('pinGuardError');
    const entered = (input?.value || '').trim();

    if (entered === ACTION_PIN_CODE) {
      const cb = pendingPinCallback;
      closePinGuardModal();
      if (cb) cb();
    } else {
      errEl?.classList.remove('hidden');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  function openCustomDeleteConfirm(message) {
    return new Promise((resolve) => {
      pendingDeleteResolver = resolve;
      const msgEl = document.getElementById('confirmDeleteMessage');
      if (msgEl) msgEl.textContent = message;
      document.getElementById('confirmDeleteModal')?.classList.remove('hidden');
    });
  }

  function resolveDeleteConfirm(confirmed) {
    document.getElementById('confirmDeleteModal')?.classList.add('hidden');
    if (typeof pendingDeleteResolver === 'function') {
      const fn = pendingDeleteResolver;
      pendingDeleteResolver = null;
      fn(Boolean(confirmed));
    }
  }