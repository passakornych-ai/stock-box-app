let matrixCards = [];
let currentFilter = 'all';

const getClient = () => window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

const pickField = (obj, keys, fallback = '') => {
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

function ensureLocationModal() {
  let modal = document.getElementById('locationDetailModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'locationDetailModal';
  modal.className = 'hidden';
  modal.style.cssText = 'position:fixed;inset:0;z-index:50;';
  modal.innerHTML = `
    <div onclick="closeLocationModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.72);"></div>
    <div style="position:relative;z-index:10;max-width:720px;margin:64px auto 24px;padding:0 16px;">
      <div class="panel" style="overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid rgba(148,163,184,0.16);display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div class="mono" style="font-size:11px;color:#34d399;text-transform:uppercase;">Slot Inventory Inspector</div>
            <h2 id="locModalTitle" class="mono" style="margin:4px 0 0;font-size:18px;font-weight:700;color:#f8fafc;">-</h2>
          </div>
          <button type="button" onclick="closeLocationModal()" class="btn btn-ghost" style="padding:6px 11px;">✕</button>
        </div>

        <div id="locModalSummary" class="mono" style="padding:12px 20px;background:rgba(9,14,26,0.75);border-bottom:1px solid rgba(148,163,184,0.12);display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:#cbd5e1;"></div>

        <div id="locModalBody" style="padding:20px;max-height:58vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;"></div>

        <div style="padding:14px 20px;border-top:1px solid rgba(148,163,184,0.16);background:rgba(9,14,26,0.55);display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <a href="index.html" class="mono" style="font-size:12px;color:#67e8f9;text-decoration:none;">← กลับหน้า Dashboard</a>
          <button type="button" onclick="closeLocationModal()" class="btn btn-ghost">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function openLocationModal(card) {
  const modal = ensureLocationModal();
  document.getElementById('locModalTitle').textContent = `LOCATION: ${card.name}`;

  const summaryEl = document.getElementById('locModalSummary');
  summaryEl.innerHTML = `
    <span style="padding:4px 10px;border-radius:8px;background:${
      card.occupied ? 'rgba(16,185,129,0.16)' : 'rgba(30,41,59,0.85)'
    };color:${card.occupied ? '#6ee7b7' : '#94a3b8'};">${card.occupied ? 'สถานะ: มีของ' : 'สถานะ: ว่าง'}</span>
    <span>จำนวนกล่อง: <strong style="color:#f8fafc;">${card.boxes.toLocaleString()}</strong></span>
    <span>ยอดรวมคงเหลือ: <strong style="color:#6ee7b7;">${card.qty.toLocaleString()}</strong></span>
  `;

  const bodyEl = document.getElementById('locModalBody');
  if (!card.items || card.items.length === 0) {
    bodyEl.innerHTML = `
      <div style="padding:36px 12px;text-align:center;color:#94a3b8;font-size:14px;">
        ไม่มีรายการกล่องจัดเก็บในช่อง <span class="mono" style="color:#f8fafc;">${escapeHtml(card.name)}</span>
      </div>
    `;
  } else {
    bodyEl.innerHTML = card.items
      .map((item) => {
        const boxId = pickField(item, ['StockBoxID', 'stock_box_id', 'Row ID']);
        const partName = pickField(item, ['Part_Name', 'part_name', 'Product']);
        const lotNo = pickField(item, ['LotNo', 'lot_no', 'Lot_No']);
        const qty = Number(pickField(item, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;

        return `
          <div style="padding:14px;border-radius:12px;background:rgba(9,14,26,0.85);border:1px solid rgba(51,65,85,0.75);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
            <div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                <span class="mono" style="font-size:12.5px;font-weight:700;color:#67e8f9;">${escapeHtml(boxId)}</span>
                <span class="mono" style="font-size:12px;color:#94a3b8;">LOT: ${escapeHtml(lotNo)}</span>
              </div>
              <div style="font-size:14px;font-weight:500;color:#f8fafc;">${escapeHtml(partName)}</div>
            </div>
            <div class="mono" style="text-align:right;">
              <div style="font-size:11px;color:#94a3b8;">QTY BALANCE</div>
              <div style="font-size:16px;font-weight:700;color:${qty > 0 ? '#6ee7b7' : '#64748b'};">${qty.toLocaleString()}</div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  modal.classList.remove('hidden');
}

function closeLocationModal() {
  document.getElementById('locationDetailModal')?.classList.add('hidden');
}

async function loadLocationMatrix() {
  const loading = document.getElementById('locLoading');
  const grid = document.getElementById('locationGrid');
  loading?.classList.remove('hidden');
  if (grid) grid.innerHTML = '';

  try {
    const client = getClient();
    if (!client) {
      throw new Error('ยังไม่ได้สร้าง Supabase client (_supabase) กรุณาเช็กไฟล์ js/config.js');
    }

    const [{ data: locRows, error: locErr }, { data: stockRows, error: stockErr }] = await Promise.all([
      client.from('locations').select('*'),
      client.from('stock_box').select('*')
    ]);

    if (locErr) throw locErr;
    if (stockErr) throw stockErr;

    const mapByLoc = {};
    (stockRows || []).forEach((item) => {
      const locKey = String(
        pickField(item, ['Location_Name', 'location_name', 'LocationID', 'location_id'], '')
      )
        .trim()
        .toLowerCase();
      const qty = Number(pickField(item, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;
      if (!locKey) return;
      if (!mapByLoc[locKey]) mapByLoc[locKey] = { count: 0, qty: 0, items: [] };
      mapByLoc[locKey].count += 1;
      mapByLoc[locKey].qty += qty;
      mapByLoc[locKey].items.push(item);
    });

    matrixCards = (locRows || []).map((loc) => {
      const name = String(
        pickField(loc, ['Location_Name', 'location_name', 'LocationID', 'location_id', 'Row ID'], 'UNKNOWN')
      ).trim();
      const info = mapByLoc[name.toLowerCase()] || { count: 0, qty: 0, items: [] };
      return {
        name,
        occupied: info.qty > 0 || info.count > 0,
        boxes: info.count,
        qty: info.qty,
        items: info.items
      };
    });

    const occupiedCount = matrixCards.filter((c) => c.occupied).length;
    document.getElementById('statTotal').textContent = matrixCards.length.toLocaleString();
    document.getElementById('statOccupied').textContent = occupiedCount.toLocaleString();
    document.getElementById('statEmpty').textContent = (matrixCards.length - occupiedCount).toLocaleString();

    renderMatrix();
  } catch (err) {
    console.error('Location Matrix Error:', err);
    if (grid) {
      grid.innerHTML = `<div class="mono" style="grid-column:1/-1;text-align:center;color:#fda4af;font-size:12px;padding:32px 12px;">Error: ${escapeHtml(err.message)}</div>`;
    }
  } finally {
    loading?.classList.add('hidden');
  }
}

function renderMatrix() {
  const grid = document.getElementById('locationGrid');
  if (!grid) return;

  const q = (document.getElementById('locSearch')?.value || '').trim().toLowerCase();
  const highlightParam = (new URLSearchParams(window.location.search).get('highlight') || '').trim().toLowerCase();

  const list = matrixCards.filter((c) => {
    if (currentFilter === 'occupied' && !c.occupied) return false;
    if (currentFilter === 'empty' && c.occupied) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    return true;
  });

  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:32px 12px;font-size:14px;">ไม่พบช่อง Location ตามตัวกรอง</div>`;
    return;
  }

  let highlightedEl = null;

  list.forEach((c) => {
    const isHighlighted = highlightParam && c.name.toLowerCase() === highlightParam;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `slot-card ${c.occupied ? 'slot-occupied' : 'slot-empty'} ${isHighlighted ? 'slot-highlight' : ''}`;
    el.onclick = () => openLocationModal(c);

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <span class="mono" style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${
          c.occupied ? '#a7f3d0' : '#cbd5e1'
        };">${escapeHtml(c.name)}</span>
        <span style="width:8px;height:8px;border-radius:999px;flex-shrink:0;background:${
          c.occupied ? '#34d399' : '#64748b'
        };"></span>
      </div>
      <div class="mono" style="margin-top:8px;font-size:11px;color:${c.occupied ? '#6ee7b7' : '#64748b'};">
        ${c.occupied ? `${c.boxes} กล่อง · ${c.qty.toLocaleString()} ชิ้น` : 'EMPTY'}
      </div>
    `;

    if (isHighlighted && !highlightedEl) {
      highlightedEl = el;
    }

    grid.appendChild(el);
  });

  if (highlightedEl) {
    highlightedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach((b) => {
    const active = b.dataset.filter === currentFilter;
    b.className = active ? 'filter-btn btn btn-cyan' : 'filter-btn btn btn-ghost';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  ensureLocationModal();
  updateFilterButtons();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLocationModal();
  });

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      updateFilterButtons();
      renderMatrix();
    });
  });

  document.getElementById('locSearch')?.addEventListener('input', renderMatrix);
  loadLocationMatrix();
});