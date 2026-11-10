// js/main.js

// เรียกฟังก์ชันเมื่อโหลดหน้าเว็บเสร็จสมบูรณ์
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

async function loadDashboard() {
    const loadingEl = document.getElementById('loadingState');
    const tableBody = document.getElementById('stockTableBody');

    // แสดงสถานะ Loading
    if (loadingEl) loadingEl.classList.remove('hidden');

    // 1. ดึงข้อมูลสถิติและอัปเดต Card ตัวเลข
    const stats = await getDashboardStats();
    document.getElementById('statStock').textContent = `${stats.totalStock} รายการ`;
    document.getElementById('statReceive').textContent = `${stats.totalReceive} บิล`;
    document.getElementById('statIssue').textContent = `${stats.totalIssue} บิล`;
    document.getElementById('statLocation').textContent = `${stats.totalLocations} ช่อง`;

    // 2. ดึงข้อมูลตาราง Stock Box ล่าสุด
    const stockList = await getRecentStockBox(10);

    // ซ่อนสถานะ Loading
    if (loadingEl) loadingEl.classList.add('hidden');

    // 3. วนลูปแสดงผลในตาราง
    tableBody.innerHTML = '';

    if (stockList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-400">
                    ยังไม่มีข้อมูลในตาราง stock_box หรือชื่อคอลัมน์ไม่ตรงกัน
                </td>
            </tr>
        `;
        return;
    }

    stockList.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition border-b border-gray-100';

        row.innerHTML = `
            <td class="px-6 py-4 font-mono font-semibold text-blue-600">
                ${item.StockBoxID || item.stockbox_id || '-'}
            </td>
            <td class="px-6 py-4 font-medium text-gray-900">
                ${item.Part_Name || item.part_name || '-'}
            </td>
            <td class="px-6 py-4 text-gray-600">
                ${item.LotNo || item.lot_no || '-'}
            </td>
            <td class="px-6 py-4 font-medium text-emerald-600">
                ${item.Location_Name || item.location_name || '-'}
            </td>
            <td class="px-6 py-4 font-bold text-gray-800">
                ${item.QtyBalance ?? item.qty_balance ?? 0}
            </td>
            <td class="px-6 py-4">
                <span class="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold">
                    ${item.Status || item.status || 'Active'}
                </span>
            </td>
        `;

        tableBody.appendChild(row);
    });
}