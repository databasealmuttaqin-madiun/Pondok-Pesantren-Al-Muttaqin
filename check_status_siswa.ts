import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { data, error } = await supabase.from('status_siswa').select('*').ilike('status', '%haid%');
  console.log("status_siswa haid count:", data?.length);
  console.log("status_siswa haid:", data);
}
run();
