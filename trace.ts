import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { data: statusOverrides } = await supabase.from("status_siswa").select("nama, status").ilike("nama", "%Callysta%");
  console.log("status_siswa Callysta:", statusOverrides);
  
  const { data: santriData } = await supabase.from("santri").select("nama_lengkap, status").ilike("nama_lengkap", "%Callysta%");
  console.log("santri Callysta:", santriData);
}
run();
