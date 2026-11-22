let matrixCards = [];
let currentFilter = 'all';

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
  modal.className = 'fixed inset-0 z-50 hidden';
  modal.innerHTML = `
    <div onclick="closeLocationModal()" class="absolute inset-0 bg-black/70"></div>
    <div class="relative z-10 max-w-2xl mx-auto mt-14 sm:mt-20 px-4">
      <div class="glass-panel rounded-2xl border border-slate-700/80 overflow-hidden shadow-2xl">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <span class="text-[11px] font-mono text-emerald-400 uppercase">Slot Inventory Inspector</span>
            <h2 id="locModalTitle" class="text-lg font-bold font-mono text-white">-</h2>
          </div>
          <button type="button" onclick="closeLocationModal()"
            class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer">✕</button>
        </div>

        <div id="locModalSummary" class="px-5 py-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300"></div>

        <div id="locModalBody" class="p-5 max-h-[60vh] overflow-y-auto space-y-3"></div>

        <div class="px-5 py-3.5 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900/40">
          <a id="locModalDashboardLink" href="index.html"
            class="text-xs font-mono text-cyan-300 hover:text-cyan-200 underline">เปิดดูในหน้า Dashboard →</a>
          <button type="button" onclick="closeLocationModal()"
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer">ปิดหน้าต่าง</button>
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
    <span class="px-2.5 py-1 rounded-lg ${
      card.occupied
        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
        : 'bg-slate-800 text-slate-400 border border-slate-700'
    }">${card.occupied ? 'สถานะ: มีของ' : 'สถานะ: ว่าง'}</span>
    <span>จำนวนกล่อง: <strong class="text-white">${card.boxes.toLocaleString()}</strong></span>
    <span>ยอดรวมคงเหลือ: <strong class="text-emerald-300">${card.qty.toLocaleString()}</strong></span>
  `;

  const bodyEl = document.getElementById('locModalBody');
  if (!card.items || card.items.length === 0) {
    bodyEl.innerHTML = `
      <div class="py-10 text-center text-slate-400 text-sm">
        ไม่มีรายการกล่องจัดเก็บในช่อง <span class="font-mono text-slate-200">${escapeHtml(card.name)}</span>
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
          <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-bold text-cyan-300">${escapeHtml(boxId)}</span>
                <span class="text-xs font-mono text-slate-400">LOT: ${escapeHtml(lotNo)}</span>
              </div>
              <p class="text-sm font-medium text-slate-100">${escapeHtml(partName)}</p>
            </div>
            <div class="sm:text-right font-mono">
              <span class="text-xs text-slate-400 block">QTY BALANCE</span>
              <span class="text-base font-bold ${qty > 0 ? 'text-emerald-300' : 'text-slate-500'}">${qty.toLocaleString()}</span>
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
    if (typeof _supabase === 'undefined') {
      throw new Error('ไม่พบตัวแปร _supabase กรุณาตรวจสอบไฟล์ js/config.js');
    }

    const [{ data: locRows, error: locErr }, { data: stockRows, error: stockErr }] = await Promise.all([
      _supabase.from('locations').select('*'),
      _supabase.from('stock_box').select('*')
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
      grid.innerHTML = `<p class="col-span-full text-center text-rose-400 font-mono text-xs py-8">Error: ${escapeHtml(err.message)}</p>`;
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
    grid.innerHTML = `<p class="col-span-full text-center text-slate-400 py-8 text-sm">ไม่พบช่อง Location ตามตัวกรอง</p>`;
    return;
  }

  let highlightedEl = null;

  list.forEach((c) => {
    const isHighlighted = highlightParam && c.name.toLowerCase() === highlightParam;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `text-left p-3.5 rounded-xl transition flex flex-col justify-between min-h-[84px] cursor-pointer ${
      c.occupied ? 'slot-occupied' : 'slot-empty'
    } ${isHighlighted ? 'slot-highlight' : ''}`;
    el.onclick = () => openLocationModal(c);

    el.innerHTML = `
      <div class="flex items-center justify-between gap-1">
        <span class="font-mono text-xs font-bold truncate ${c.occupied ? 'text-emerald-200' : 'text-slate-400'}">${escapeHtml(c.name)}</span>
        <span class="w-2 h-2 rounded-full shrink-0 ${c.occupied ? 'bg-emerald-400' : 'bg-slate-600'}"></span>
      </div>
      <div class="mt-2 text-[11px] font-mono ${c.occupied ? 'text-emerald-300/90' : 'text-slate-500'}">
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

document.addEventListener('DOMContentLoaded', () => {
  ensureLocationModal();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLocationModal();
  });

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach((b) => {
        b.className =
          b.dataset.filter === currentFilter
            ? 'filter-btn px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-400 text-slate-950 cursor-pointer'
            : 'filter-btn px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer';
      });
      renderMatrix();
    });
  });

  document.getElementById('locSearch')?.addEventListener('input', renderMatrix);
  loadLocationMatrix();
});