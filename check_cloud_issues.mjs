import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eyxvsbqyzeodsjajfqsj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uE5EcDAKSkkb9h0I2hEPEw_RGb7qbgr';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log('Querying Supabase dev_issues table...');
  const { data, error } = await supabase.from('dev_issues').select('*');
  if (error) {
    console.error('Supabase query error:', error.message);
  } else {
    console.log(`Found ${data.length} dev issues:`);
    console.log(JSON.stringify(data, null, 2));
  }

  const { data: events, error: evErr } = await supabase.from('dev_events').select('*');
  if (evErr) {
    console.error('Supabase events query error:', evErr.message);
  } else {
    console.log(`Found ${events.length} dev events:`);
    console.log(JSON.stringify(events, null, 2));
  }
}

check();
