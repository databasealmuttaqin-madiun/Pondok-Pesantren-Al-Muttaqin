import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { data } = await supabase.from('kelas_pengajian').select('*').limit(2);
  console.log("kelas_pengajian data:", data);
}
run();
