import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { data, error } = await supabase.from('izin_haid').select('*');
  console.log("Data izin_haid:");
  console.log(data);
}
run();
