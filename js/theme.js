const THEME_STORAGE_KEY = 'stock_box_theme_mode';

function getCurrentTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

function applyTheme(mode) {
  const normalized = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', normalized);
  localStorage.setItem(THEME_STORAGE_KEY, normalized);

  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.innerHTML =
      normalized === 'light'
        ? `<span>🌙</span><span>โหมดมืด</span>`
        : `<span>☀️</span><span>โหมดสว่าง</span>`;
    btn.title = normalized === 'light' ? 'เปลี่ยนเป็นโหมดมืด' : 'เปลี่ยนเป็นโหมดสว่าง';
  }
}

function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

// ใช้ธีมทันทีก่อนเรนเดอร์ลดอาการวาบ
applyTheme(getCurrentTheme());

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getCurrentTheme());
});