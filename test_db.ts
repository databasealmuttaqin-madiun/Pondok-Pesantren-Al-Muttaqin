import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { data, error } = await supabase.from('izin_sakit').select('nama_siswa, status');
  console.log("Izin Sakit Data:");
  console.log(data);
}
run();
