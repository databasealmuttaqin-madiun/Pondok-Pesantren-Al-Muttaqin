import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { data: d1 } = await supabase.from('izin_sambang').select('status').neq('status', 'Sedang Sambang');
  const { data: d2 } = await supabase.from('izin_sakit').select('status').neq('status', 'Sedang Sakit');
  const { data: d3 } = await supabase.from('izin_haid').select('status').neq('status', 'Sedang Haid');
  
  console.log("Status in Sambang:", d1);
  console.log("Status in Sakit:", d2);
  console.log("Status in Haid:", d3);
}
run();
