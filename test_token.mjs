import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('dev_sessions').select('*').eq('token', 'dtk_gig3bgms3yjj3x9j2ljm1j');
  console.log('Lookup result:', error ? error.message : data);
}

test();
