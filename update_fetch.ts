import fs from 'fs';
let content = fs.readFileSync('src/components/PerizinanPanel.tsx', 'utf-8');

const oldFetch = `    try {
      const { data, error } = await supabase
        .from("perizinan")
        .select("*")
        .order("id", { ascending: false });

      if (error) {
        console.error("Supabase error fetching perizinan:", error);
        throw error;
      }
      setItems(data || []);
      setHasFetched(true);`;

const newFetch = `    try {
      const [sambangRes, sakitRes, haidRes] = await Promise.all([
        supabase.from("izin_sambang").select("*").order("id", { ascending: false }),
        supabase.from("izin_sakit").select("*").order("id", { ascending: false }),
        supabase.from("izin_haid").select("*").order("id", { ascending: false }),
      ]);

      if (sambangRes.error) console.error("Error fetching sambang:", sambangRes.error);
      if (sakitRes.error) console.error("Error fetching sakit:", sakitRes.error);
      if (haidRes.error) console.error("Error fetching haid:", haidRes.error);

      let allItems: any[] = [];
      if (sambangRes.data) {
        allItems = allItems.concat(sambangRes.data.map(d => ({ 
          ...d, 
          kategori_izin: "sambang",
          keperluan: d.keperluan ? \`\${d.keperluan} (Tujuan: \${d.tujuan})\` : d.tujuan
        })));
      }
      if (sakitRes.data) {
        allItems = allItems.concat(sakitRes.data.map(d => ({ ...d, kategori_izin: "sakit" })));
      }
      if (haidRes.data) {
        allItems = allItems.concat(haidRes.data.map(d => ({ ...d, kategori_izin: "haid" })));
      }

      setItems(allItems);
      setHasFetched(true);`;

if (content.includes('const { data, error } = await supabase\n        .from("perizinan")\n        .select("*")\n        .order("id", { ascending: false });')) {
  console.log('Match found for fetch!');
}
