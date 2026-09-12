import { supabase, formatSantriData } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { data, error } = await supabase.from('santri').select('*').ilike('nama_lengkap', '%Ahmad Nur Khoirul Hasan%');
  console.log("From santri table:", data);
  if (data && data[0]) {
      const formatted = formatSantriData(data[0]);
      console.log("Formatted nameKey:", formatted.nama_lengkap.trim().toLowerCase());
  }
}
run();
