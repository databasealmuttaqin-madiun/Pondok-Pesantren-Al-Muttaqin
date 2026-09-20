import { supabase } from './src/supabaseClient';
async function run() {
  const { data, error } = await supabase.from('jam_pelajaran').select('*').limit(1);
  if (error) {
    console.error("Error fetching jam_pelajaran:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Existing columns:", Object.keys(data[0]));
  } else {
    console.log("No records found to extract keys, let's inspect metadata.");
  }
}
run();
