import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { data, error } = await supabase.from('riwayat_perizinan_view').select('*').limit(5);
  console.log("Error:", error?.message);
  console.log("Data count:", data?.length);
}
run();
