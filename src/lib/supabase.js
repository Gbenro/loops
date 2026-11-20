import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const supabaseAnonKey = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

import { idbStorage } from './authStorage.js';
export { idbStorage } from './authStorage.js';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: idbStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
