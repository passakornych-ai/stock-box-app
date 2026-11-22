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
      ).trim();
      const qty = Number(pickField(item, ['QtyBalance', 'qty_balance', 'Qty', 'qty'], 0)) || 0;
      if (!locKey) return;
      if (!mapByLoc[locKey]) mapByLoc[locKey] = { count: 0, qty: 0 };
      mapByLoc[locKey].count += 1;
      mapByLoc[locKey].qty += qty;
    });

    matrixCards = (locRows || []).map((loc) => {
      const name = String(
        pickField(loc, ['Location_Name', 'location_name', 'LocationID', 'location_id', 'Row ID'], 'UNKNOWN')
      ).trim();
      const info = mapByLoc[name] || { count: 0, qty: 0 };
      return {
        name,
        occupied: info.qty > 0 || info.count > 0,
        boxes: info.count,
        qty: info.qty
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
    const el = document.createElement('div');
    el.className = `p-3.5 rounded-xl transition flex flex-col justify-between min-h-[84px] ${
      c.occupied ? 'slot-occupied' : 'slot-empty'
    } ${isHighlighted ? 'slot-highlight' : ''}`;

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