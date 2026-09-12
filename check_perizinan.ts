import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const { data, error } = await supabase.from('perizinan').select('*').ilike('status', '%haid%');
  console.log("Old perizinan Haid:");
  console.log(data);
}
run();
