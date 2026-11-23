let parsedReceiveItems = [];

const getImportClient = () => window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

const escapeImpHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function showImpToast(message, isError = false) {
  let toast = document.getElementById('toastBox');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastBox';
    toast.className = 'mono';
    toast.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:60;padding:10px 16px;border-radius:11px;background:var(--bg-surface);font-size:12px;font-weight:600;box-shadow:0 12px 28px rgba(0,0,0,0.22);';
    document.body.appendChild(toast);
  }
  toast.style.border = isError ? '1px solid #e11d48' : '1px solid var(--c-cyan)';
  toast.style.color = isError ? '#e11d48' : 'var(--c-cyan)';
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function generateRandomId(len = 8) {
  const chars = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generateDefaultReceiveNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 90) + 10);
  return `รับเข้าคลัง-${y}${m}${d}-${rnd}`;
}

function setDefaultDateInput() {
  const el = document.getElementById('importReceiveDate');
  if (!el || el.value) return;
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  el.value = new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function pickRowValue(row, keys, fallback = '') {
  const lowerMap = {};
  Object.keys(row || {}).forEach((k) => {
    lowerMap[String(k).trim().toLowerCase()] = row[k];
  });
  for (const key of keys) {
    const val = lowerMap[String(key).trim().toLowerCase()];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return fallback;
}

function renderImportPreview() {
  const tbody = document.getElementById('importPreviewBody');
  const saveBtn = document.getElementById('saveImportReceiveBtn');
  const defaultLoc =
    (document.getElementById('importDefaultLocation')?.value || 'ที่จัดเก็บชั่วคราว').trim() ||
    'ที่จัดเก็บชั่วคราว';

  let totalQty = 0;
  let validCount = 0;

  parsedReceiveItems.forEach((item) => {
    const qty = Number(item.QtyBalance) || 0;
    totalQty += qty;
    if (item.Part_Name && qty > 0) {
      validCount += 1;
    }
  });

  document.getElementById('impKpiRows').textContent = parsedReceiveItems.length.toLocaleString();
  document.getElementById('impKpiQty').textContent = totalQty.toLocaleString();
  document.getElementById('impKpiValid').textContent = validCount.toLocaleString();

  if (saveBtn) {
    saveBtn.disabled = validCount === 0;
  }

  if (!tbody) return;

  if (parsedReceiveItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="txt-muted" style="padding:44px 16px;text-align:center;">เลือกไฟล์ Excel (.xlsx, .xls) หรือ .csv ที่มีหัวคอลัมน์ Part_Name, Type_cartons, LotNo, Location_Name, QtyBalance</td></tr>`;
    return;
  }

  tbody.innerHTML = parsedReceiveItems
    .map((item, idx) => {
      const qty = Number(item.QtyBalance) || 0;
      const loc = item.Location_Name || defaultLoc;
      const isValid = Boolean(item.Part_Name) && qty > 0;
      return `
        <tr style="${isValid ? '' : 'opacity:0.55;'}">
          <td class="mono txt-muted">${idx + 1}</td>
          <td class="mono txt-primary" style="font-weight:700;">${escapeImpHtml(item.Part_Name || '-')}</td>
          <td class="txt-secondary">${escapeImpHtml(item.Type_cartons || '-')}</td>
          <td class="mono txt-secondary">${escapeImpHtml(item.LotNo || '-')}</td>
          <td class="txt-secondary">${escapeImpHtml(loc)}</td>
          <td class="mono ${qty > 0 ? 'txt-emerald' : 'txt-muted'}" style="text-align:right;font-weight:700;">${qty.toLocaleString()}</td>
        </tr>
      `;
    })
    .join('');
}

function handleReceiveFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    showImpToast('ไม่พบไลบรารี XLSX กรุณารีเฟรชหน้า', true);
    return;
  }

  document.getElementById('selectedFileName').textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      parsedReceiveItems = rawRows
        .map((r) => {
          const partName = pickRowValue(r, ['Part_Name', 'part_name', 'PartName'], '');
          const typeCartons = pickRowValue(r, ['Type_cartons', 'type_cartons', 'TypeCartons'], '');
          const lotNo = pickRowValue(r, ['LotNo', 'lot_no', 'Lot_No'], '');
          const locName = pickRowValue(r, ['Location_Name', 'location_name', 'Location'], '');
          const rawQty = pickRowValue(r, ['QtyBalance', 'qty_balance', 'QTY', 'Qty', 'qty'], '0');
          const qtyBalance = Number(String(rawQty).replace(/,/g, '')) || 0;

          return {
            Part_Name: partName,
            Type_cartons: typeCartons,
            LotNo: lotNo,
            Location_Name: locName,
            QtyBalance: qtyBalance
          };
        })
        .filter((x) => x.Part_Name || x.LotNo || x.QtyBalance > 0);

      renderImportPreview();
      showImpToast(`LOADED ${parsedReceiveItems.length} ROWS FROM FILE`);
    } catch (err) {
      console.error('File Parse Error:', err);
      showImpToast('อ่านไฟล์ไม่สำเร็จ กรุณาตรวจสอบรูปแบบไฟล์', true);
    }
  };
  reader.readAsArrayBuffer(file);
}

function clearImportedReceive() {
  parsedReceiveItems = [];
  const fileInput = document.getElementById('receiveFileInput');
  if (fileInput) fileInput.value = '';
  document.getElementById('selectedFileName').textContent = 'ยังไม่ได้เลือกไฟล์';
  renderImportPreview();
}

function downloadReceiveTemplate() {
  if (typeof XLSX === 'undefined') {
    showImpToast('ไม่พบไลบรารี XLSX', true);
    return;
  }
  const headers = ['Part_Name', 'Type_cartons', 'LotNo', 'Location_Name', 'QtyBalance'];
  const sample = [
    {
      Part_Name: '049-018-941',
      Type_cartons: 'EMC Storage',
      LotNo: '2026-10-09',
      Location_Name: 'TB402',
      QtyBalance: 1
    }
  ];
  const ws = XLSX.utils.json_to_sheet(sample, { header: headers });
  ws['!cols'] = headers.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'receive_import_template.xlsx');
}

async function submitReceiveImport() {
  const validItems = parsedReceiveItems.filter((x) => x.Part_Name && (Number(x.QtyBalance) || 0) > 0);
  if (!validItems.length) {
    showImpToast('ไม่มีรายการที่ถูกต้องสำหรับบันทึก', true);
    return;
  }

  const client = getImportClient();
  if (!client) {
    showImpToast('ไม่พบ Supabase client (_supabase)', true);
    return;
  }

  const banner = document.getElementById('importStatusBanner');
  const saveBtn = document.getElementById('saveImportReceiveBtn');

  try {
    banner?.classList.remove('hidden');
    if (banner) banner.textContent = '⟳ SAVING RECEIVE HEADER & DETAILS TO SUPABASE...';
    if (saveBtn) saveBtn.disabled = true;

    const receiveId = generateRandomId(8);
    const receiveNo =
      (document.getElementById('importReceiveNo')?.value || '').trim() || generateDefaultReceiveNo();
    const rawDateInput = document.getElementById('importReceiveDate')?.value;
    const createdAt = rawDateInput ? new Date(rawDateInput).toISOString() : new Date().toISOString();
    const createdBy = (document.getElementById('importCreatedBy')?.value || 'Admin').trim() || 'Admin';
    const defaultLoc =
      (document.getElementById('importDefaultLocation')?.value || 'ที่จัดเก็บชั่วคราว').trim() ||
      'ที่จัดเก็บชั่วคราว';

    const totalQty = validItems.reduce((sum, item) => sum + (Number(item.QtyBalance) || 0), 0);

    const headerPayload = {
      ReceiveID: receiveId,
      ReceiveNo: receiveNo,
      CreatedAt: createdAt,
      CreatedBy: createdBy,
      QTY: totalQty
    };

    const { error: hdrErr } = await client.from('stock_receive').insert([headerPayload]);
    if (hdrErr) throw hdrErr;

    const detailPayloads = validItems.map((item) => ({
      ReceiveDetailID: generateRandomId(8),
      ReceiveID: receiveId,
      Part_Name: item.Part_Name,
      Type_cartons: item.Type_cartons || '-',
      LotNo: item.LotNo || '-',
      Location_Name: item.Location_Name || defaultLoc,
      QTY: Number(item.QtyBalance) || 0,
      QtyBalance: Number(item.QtyBalance) || 0,
      Type: 'กล่องรับเข้าคลัง',
      Processed: false
    }));

    const { error: detErr } = await client.from('stock_receive_detail').insert(detailPayloads);
    if (detErr) throw detErr;

    showImpToast(`IMPORTED ${detailPayloads.length} ITEMS (${receiveNo})`);
    clearImportedReceive();
  } catch (err) {
    console.error('Import Receive Error:', err);
    showImpToast(`ERROR: ${err.message || 'บันทึกไม่สำเร็จ'}`, true);
    if (saveBtn) saveBtn.disabled = false;
  } finally {
    banner?.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDateInput();
  document.getElementById('receiveFileInput')?.addEventListener('change', handleReceiveFileChange);
  document.getElementById('importDefaultLocation')?.addEventListener('input', renderImportPreview);
  renderImportPreview();
});