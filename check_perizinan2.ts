import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { data, error } = await supabase.from('perizinan').select('*').eq('kategori_izin', 'haid');
  console.log("Old perizinan Haid by kategori:");
  console.log(data);
}
run();
