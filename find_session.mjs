import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function find() {
  const { data, error } = await supabase.from('dev_sessions').select('*').eq('issue_id', 'iss_1788132031507_65z7');
  console.log('Result:', error ? error.message : data);
}

find();
