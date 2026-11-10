// js/api.js

/**
 * ดึงสถิติภาพรวมจำนวนข้อมูลจากทุกตาราง
 */
async function getDashboardStats() {
    try {
        const [stockRes, receiveRes, issueRes, locRes] = await Promise.all([
            _supabase.from('stock_box').select('*', { count: 'exact', head: true }),
            _supabase.from('stock_receive').select('*', { count: 'exact', head: true }),
            _supabase.from('stock_issue').select('*', { count: 'exact', head: true }),
            _supabase.from('locations').select('*', { count: 'exact', head: true }),
        ]);

        return {
            totalStock: stockRes.count || 0,
            totalReceive: receiveRes.count || 0,
            totalIssue: issueRes.count || 0,
            totalLocations: locRes.count || 0,
        };
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return { totalStock: 0, totalReceive: 0, totalIssue: 0, totalLocations: 0 };
    }
}

/**
 * ดึงรายการ Stock Box ล่าสุด (จำกัด 10 รายการ)
 */
async function getRecentStockBox(limit = 10) {
    try {
        const { data, error } = await _supabase
            .from('stock_box')
            .select('*')
            .order('CreatedAt', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching stock_box:', error.message);
        return [];
    }
}