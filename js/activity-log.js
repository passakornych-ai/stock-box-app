let allActivityLogs = [];
let currentFilteredLogs = [];
let selectedMonthKey = 'all';

const THAI_MONTH_NAMES = {
  '01': 'มกราคม',
  '02': 'กุมภาพันธ์',
  '03': 'มีนาคม',
  '04': 'เมษายน',
  '05': 'พฤษภาคม',
  '06': 'มิถุนายน',
  '07': 'กรกฎาคม',
  '08': 'สิงหาคม',
  '09': 'กันยายน',
  '10': 'ตุลาคม',
  '11': 'พฤศจิกายน',
  '12': 'ธันวาคม'
};

const escapeLogHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey === 'all') return 'ทุกเดือน (ALL MONTHS)';
  const parts = String(monthKey).split('-');
  if (parts.length !== 2) return monthKey;
  const yearAd = Number(parts[0]);
  const monthName = THAI_MONTH_NAMES[parts[1]] || parts[1];
  const yearBe = Number.isNaN(yearAd) ? '' : ` (${yearAd + 543})`;
  return `${monthName} ${parts[0]}${yearBe}`;
}

function formatLogTimestamp(isoStr) {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr || '-');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function getActionBadgeStyle(actionType) {
  const act = String(actionType || '').toUpperCase();
  if (act.includes('DELETE') || act.includes('REMOVE')) {
    return 'background:rgba(225,29,72,0.12);color:#e11d48;border:1px solid rgba(225,29,72,0.3);';
  }
  if (act.includes('CREATE') || act.includes('ADD') || act.includes('IMPORT')) {
    return 'var(--c-emerald-soft-bg);color:var(--c-emerald);border:1px solid var(--c-emerald-soft-border);'.replace(
      /^var\(--c-emerald-soft-bg\);/,
      'background:var(--c-emerald-soft-bg);'
    );
  }
  if (act.includes('UPDATE') || act.includes('EDIT')) {
    return 'background:var(--c-cyan-soft-bg);color:var(--c-cyan);border:1px solid var(--c-cyan-soft-border);';
  }
  if (act.includes('UNLOCK') || act.includes('PIN')) {
    return 'background:rgba(217,119,6,0.12);color:var(--c-amber);border:1px solid rgba(217,119,6,0.3);';
  }
  return 'background:var(--bg-subtle);color:var(--text-secondary);border:1px solid var(--border-subtle);';
}

function populateMonthControls(logs) {
  const selectEl = document.getElementById('logMonthFilter');
  const tabsEl = document.getElementById('monthQuickTabs');
  if (!selectEl || !tabsEl) return;

  const months = Array.from(
    new Set(
      logs
        .map((r) => r.month_key || (r.created_at ? String(r.created_at).slice(0, 7) : ''))
        .filter(Boolean)
    )
  ).sort((a, b) => b.localeCompare(a));

  if (selectedMonthKey !== 'all' && !months.includes(selectedMonthKey)) {
    selectedMonthKey = 'all';
  }

  selectEl.innerHTML =
    `<option value="all">ทุกเดือน (${months.length} เดือน)</option>` +
    months
      .map((m) => `<option value="${escapeLogHtml(m)}">${escapeLogHtml(formatMonthLabel(m))}</option>`)
      .join('');
  selectEl.value = selectedMonthKey;

  const countByMonth = {};
  logs.forEach((r) => {
    const mk = r.month_key || (r.created_at ? String(r.created_at).slice(0, 7) : 'unknown');
    countByMonth[mk] = (countByMonth[mk] || 0) + 1;
  });

  const allTabClass = selectedMonthKey === 'all' ? 'btn btn-cyan' : 'btn btn-ghost';
  const monthTabsHtml = months
    .map((m) => {
      const active = selectedMonthKey === m;
      const cls = active ? 'btn btn-cyan' : 'btn btn-ghost';
      return `
        <button type="button" onclick="selectMonthFilter('${escapeLogHtml(m)}')" class="${cls}" style="padding:6px 12px;font-size:12px;">
          <span>${escapeLogHtml(formatMonthLabel(m))}</span>
          <span class="mono" style="opacity:0.8;">(${countByMonth[m] || 0})</span>
        </button>
      `;
    })
    .join('');

  tabsEl.innerHTML =
    `<button type="button" onclick="selectMonthFilter('all')" class="${allTabClass}" style="padding:6px 12px;font-size:12px;">
      <span>ทุกเดือน</span>
      <span class="mono" style="opacity:0.8;">(${logs.length})</span>
    </button>` + monthTabsHtml;
}

function selectMonthFilter(monthKey) {
  selectedMonthKey = monthKey || 'all';
  const selectEl = document.getElementById('logMonthFilter');
  if (selectEl) selectEl.value = selectedMonthKey;
  renderMonthlyLogs(allActivityLogs);
}

function clearLogFilters() {
  selectedMonthKey = 'all';
  const mEl = document.getElementById('logMonthFilter');
  const pEl = document.getElementById('logPageFilter');
  const aEl = document.getElementById('logActionFilter');
  const sEl = document.getElementById('logSearchInput');

  if (mEl) mEl.value = 'all';
  if (pEl) pEl.value = 'all';
  if (aEl) aEl.value = 'all';
  if (sEl) sEl.value = '';

  renderMonthlyLogs(allActivityLogs);
}

function getFilteredLogs(logs) {
  const pageFilter = document.getElementById('logPageFilter')?.value || 'all';
  const actionFilter = document.getElementById('logActionFilter')?.value || 'all';
  const q = (document.getElementById('logSearchInput')?.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('clearLogSearchBtn');

  if (clearBtn) {
    clearBtn.classList.toggle(
      'hidden',
      !q && selectedMonthKey === 'all' && pageFilter === 'all' && actionFilter === 'all'
    );
  }

  return logs.filter((item) => {
    const mk = item.month_key || (item.created_at ? String(item.created_at).slice(0, 7) : '');
    if (selectedMonthKey !== 'all' && mk !== selectedMonthKey) return false;

    if (pageFilter !== 'all') {
      const pName = String(item.page_name || '').toLowerCase();
      if (!pName.includes(pageFilter.toLowerCase())) return false;
    }

    if (actionFilter !== 'all') {
      const act = String(item.action_type || '').toUpperCase();
      if (!act.includes(actionFilter.toUpperCase())) return false;
    }

    if (!q) return true;
    const blob = `${item.page_name || ''} ${item.action_type || ''} ${item.summary || ''} ${item.actor || ''} ${JSON.stringify(item.meta_json || '')}`.toLowerCase();
    return blob.includes(q);
  });
}

function renderMonthlyLogs(logs) {
  populateMonthControls(logs);
  currentFilteredLogs = getFilteredLogs(logs);

  const container = document.getElementById('monthlyLogSections');
  const totalEl = document.getElementById('logKpiTotal');
  const monthsEl = document.getElementById('logKpiMonths');
  const curMonthEl = document.getElementById('logKpiCurrentMonth');
  const showingEl = document.getElementById('logShowingCount');

  if (totalEl) totalEl.textContent = currentFilteredLogs.length.toLocaleString();
  if (showingEl) showingEl.textContent = currentFilteredLogs.length.toLocaleString();
  if (curMonthEl) {
    curMonthEl.textContent =
      selectedMonthKey === 'all' ? 'ทุกเดือน' : formatMonthLabel(selectedMonthKey);
  }

  if (!container) return;

  if (currentFilteredLogs.length === 0) {
    if (monthsEl) monthsEl.textContent = '0';
    container.innerHTML = `
      <section class="panel" style="padding:44px 16px;text-align:center;">
        <div class="txt-muted" style="font-size:14px;">ไม่พบประวัติการใช้งานตามเงื่อนไขที่เลือก</div>
      </section>
    `;
    return;
  }

  const groups = new Map();
  currentFilteredLogs.forEach((row) => {
    const mk = row.month_key || (row.created_at ? String(row.created_at).slice(0, 7) : 'unknown');
    if (!groups.has(mk)) groups.set(mk, []);
    groups.get(mk).push(row);
  });

  if (monthsEl) monthsEl.textContent = groups.size.toLocaleString();

  const sortedMonthKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  container.innerHTML = sortedMonthKeys
    .map((mk) => {
      const rows = groups.get(mk) || [];
      const rowsHtml = rows
        .map((r) => {
          const ts = formatLogTimestamp(r.created_at);
          const pageName = escapeLogHtml(r.page_name || '-');
          const actionType = escapeLogHtml(r.action_type || 'ACTION');
          const summary = escapeLogHtml(r.summary || '-');
          const actor = escapeLogHtml(r.actor || 'Admin');
          const badgeStyle = getActionBadgeStyle(r.action_type);

          return `
            <tr>
              <td class="mono txt-secondary" style="font-size:12px;white-space:nowrap;">${escapeLogHtml(ts)}</td>
              <td>
                <span class="mono loc-pill" style="font-size:11.5px;">${pageName}</span>
              </td>
              <td>
                <span class="mono" style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;${badgeStyle}">
                  ${actionType}
                </span>
              </td>
              <td class="txt-primary" style="font-size:13px;font-weight:500;">${summary}</td>
              <td class="mono txt-muted" style="font-size:12px;text-align:right;white-space:nowrap;">${actor}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <section class="panel" style="overflow:hidden;">
          <div style="padding:14px 18px;background:var(--bg-table-head);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="mono txt-cyan" style="font-size:12px;font-weight:700;padding:3px 9px;border-radius:8px;background:var(--c-cyan-soft-bg);border:1px solid var(--c-cyan-soft-border);">
                ${escapeLogHtml(mk)}
              </span>
              <h2 class="txt-primary" style="margin:0;font-size:15px;font-weight:700;">
                ${escapeLogHtml(formatMonthLabel(mk))}
              </h2>
            </div>
            <span class="mono txt-secondary" style="font-size:12px;font-weight:600;">
              ${rows.length.toLocaleString()} รายการ
            </span>
          </div>

          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>PAGE</th>
                  <th>ACTION</th>
                  <th>DETAIL / WHAT HAPPENED</th>
                  <th style="text-align:right;">USER</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join('');
}

async function loadActivityLogs() {
  const loading = document.getElementById('logLoadingBanner');
  loading?.classList.remove('hidden');

  try {
    allActivityLogs = window.ActivityLogger ? await window.ActivityLogger.fetchAll() : [];
    renderMonthlyLogs(allActivityLogs);

    const now = new Date();
    const syncEl = document.getElementById('logKpiLastSync');
    const statusEl = document.getElementById('logKpiStatusText');
    if (syncEl) syncEl.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
    if (statusEl) statusEl.textContent = 'อัปเดตประวัติเรียบร้อย';
  } finally {
    loading?.classList.add('hidden');
  }
}

function exportLogsToExcel() {
  if (!currentFilteredLogs.length) return;
  if (typeof XLSX === 'undefined') return;

  const headers = ['Month', 'Timestamp', 'Page', 'Action', 'Detail', 'User'];
  const rows = currentFilteredLogs.map((r) => ({
    Month: r.month_key || '',
    Timestamp: formatLogTimestamp(r.created_at),
    Page: r.page_name || '-',
    Action: r.action_type || '-',
    Detail: r.summary || '-',
    User: r.actor || 'Admin'
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 48 },
    { wch: 14 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ActivityLog');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `activity_log_${stamp}.xlsx`);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logMonthFilter')?.addEventListener('change', (e) => {
    selectedMonthKey = e.target.value || 'all';
    renderMonthlyLogs(allActivityLogs);
  });
  document.getElementById('logPageFilter')?.addEventListener('change', () => renderMonthlyLogs(allActivityLogs));
  document.getElementById('logActionFilter')?.addEventListener('change', () => renderMonthlyLogs(allActivityLogs));
  document.getElementById('logSearchInput')?.addEventListener('input', () => renderMonthlyLogs(allActivityLogs));

  loadActivityLogs();
});