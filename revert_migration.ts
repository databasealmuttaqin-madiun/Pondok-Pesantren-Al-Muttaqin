import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log("Menghapus data migrasi usang...");
  
  const res1 = await supabase.from('izin_haid').delete().eq('petugas', 'Sistem Migrasi');
  console.log("Izin Haid revert:", res1.error ? res1.error.message : "Berhasil");

  const res2 = await supabase.from('izin_sakit').delete().eq('petugas', 'Sistem Migrasi');
  console.log("Izin Sakit revert:", res2.error ? res2.error.message : "Berhasil");

  const res3 = await supabase.from('izin_sambang').delete().eq('petugas', 'Sistem Migrasi');
  console.log("Izin Sambang revert:", res3.error ? res3.error.message : "Berhasil");
}

run();
