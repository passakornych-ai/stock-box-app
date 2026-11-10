// js/config.js

// ⚠️ นำค่า Supabase URL และ Anon Key ของคุณมาใส่ที่นี่
const SUPABASE_URL = 'https://xlzqhvsiyowaryfhqqws.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1HU4qEarxwM7Q7SplsZ1PA_2m3mEYPSห';

// สร้าง Supabase Client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);