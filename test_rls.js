import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const env = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { error } = await supabase.from('sesi_mengaji').insert([{nama_sesi: 'test', urutan: 99}]);
  console.log("Insert sesi error:", error);
}
run();
