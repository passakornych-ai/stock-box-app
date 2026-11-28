(function () {
  const STORAGE_KEY = 'stockbox_activity_logs_v1';
  const MAX_LOCAL_LOGS = 2000;

  const getDbClient = () =>
    window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

  function toMonthKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function makeLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function readLocalLogs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalLogs(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_LOCAL_LOGS)));
    } catch (_) {
      // Ignore storage quota errors
    }
  }

  async function logActivity({
    page = 'Unknown',
    action = 'ACTION',
    summary = '',
    actor = 'Admin',
    meta = null,
    timestamp = null
  }) {
    const dt = timestamp ? new Date(timestamp) : new Date();
    const validDt = Number.isNaN(dt.getTime()) ? new Date() : dt;

    const entry = {
      id: makeLogId(),
      created_at: validDt.toISOString(),
      month_key: toMonthKey(validDt),
      page_name: String(page || 'Unknown').trim(),
      action_type: String(action || 'ACTION').trim().toUpperCase(),
      summary: String(summary || '').trim(),
      actor: String(actor || 'Admin').trim(),
      meta_json: meta ?? null
    };

    const currentLocal = readLocalLogs();
    writeLocalLogs([entry, ...currentLocal]);

    try {
      const client = getDbClient();
      if (client) {
        const { error } = await client.from('activity_logs').insert([entry]);
        if (error) {
          // ถ้ายังไม่มีตาราง activity_logs บน Supabase ให้ใช้ localStorage ต่อไปเงียบ ๆ
          console.debug('Activity log fallback to localStorage:', error.message);
        }
      }
    } catch (_) {
      // Fallback to localStorage
    }

    return entry;
  }

  async function fetchAllLogs() {
    const localList = readLocalLogs();
    const mergedMap = new Map();

    localList.forEach((item) => {
      if (item && item.id) mergedMap.set(item.id, item);
    });

    try {
      const client = getDbClient();
      if (client) {
        const { data, error } = await client
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1500);

        if (!error && Array.isArray(data)) {
          data.forEach((row) => {
            if (!row) return;
            const id = row.id || makeLogId();
            const dt = new Date(row.created_at || Date.now());
            mergedMap.set(id, {
              ...row,
              id,
              month_key: row.month_key || toMonthKey(dt)
            });
          });
        }
      }
    } catch (_) {
      // Use localList if remote unavailable
    }

    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  function clearLocalLogs() {
    localStorage.removeItem(STORAGE_KEY);
  }

  window.ActivityLogger = {
    log: logActivity,
    fetchAll: fetchAllLogs,
    clearLocal: clearLocalLogs,
    toMonthKey
  };
})();