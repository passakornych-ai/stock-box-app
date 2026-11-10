async function loadDashboard() {
    try {
        const loadingEl = document.getElementById('loadingState');
        if (loadingEl) loadingEl.classList.remove('hidden');

        // ดึงข้อมูลจากตาราง stock_box
        const { data: stockList, error } = await _supabase
            .from('stock_box')
            .select('*');

        if (error) throw error;

        const tbody = document.getElementById('stockTableBody');
        tbody.innerHTML = '';

        if (!stockList || stockList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-400">ยังไม่มีข้อมูลในตาราง stock_box</td></tr>`;
            return;
        }

        // วนลูปแสดงข้อมูล โดยอ้างอิงชื่อคอลัมน์ให้ตรงเป๊ะกับภาพ Supabase
        stockList.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition';
            
            // ใช้ชื่อคอลัมน์ตามโครงสร้างจริงใน Supabase ของคุณ
            const boxId = item.StockBoxID || item.stock_box_id || '-';
            const partName = item.Part_Name || item.part_name || '-';
            const lotNo = item.LotNo || item.lot_no || '-';
            const location = item.Location_Name || item.location_name || '-';
            const qty = item.QtyBalance ?? item.qty_balance ?? 0;

            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900">${boxId}</td>
                <td class="px-6 py-4 text-gray-700">${partName}</td>
                <td class="px-6 py-4 text-gray-600">${lotNo}</td>
                <td class="px-6 py-4 text-gray-600 font-semibold">${location}</td>
                <td class="px-6 py-4 text-gray-800 font-bold">${qty}</td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">ปกติ</span>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // อัปเดตตัวเลขสถิติภาพรวม
        document.getElementById('statStock').textContent = stockList.length + ' รายการ';
        
        if (loadingEl) loadingEl.classList.add('hidden');

    } catch (err) {
        console.error("Error loading dashboard:", err.message);
        const loadingEl = document.getElementById('loadingState');
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

// เรียกใช้งานเมื่อโหลดหน้าเว็บ
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});