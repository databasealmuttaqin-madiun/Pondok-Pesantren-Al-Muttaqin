import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { data, error } = await supabase.from('izin_haid').select('*');
  console.log("active haid count:", data?.length);
  if (data?.length) {
     console.log("First item:", data[0]);
  }
}
run();
