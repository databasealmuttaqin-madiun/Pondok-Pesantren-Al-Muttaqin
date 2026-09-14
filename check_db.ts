import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { data, error } = await supabase.from('kelas_pengajian').select('*').limit(1);
  console.log("kelas_pengajian error:", error?.message);
}
run();
