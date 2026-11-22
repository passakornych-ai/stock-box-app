
const SUPABASE_URL = 'https://xlzqhvsiyowaryfhqqws.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1HU4qEarxwM7Q7SplsZ1PA_2m3mEYPS';

if (!window._supabase && window.supabase && typeof window.supabase.createClient === 'function') {
  window._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const _supabase = window._supabase;