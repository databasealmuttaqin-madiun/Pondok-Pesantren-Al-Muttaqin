import fs from 'fs';
let content = fs.readFileSync('src/components/PerizinanPanel.tsx', 'utf-8');

const executeDeleteItemStart = `  const executeDeleteItem = async (item: PerizinanItem) => {
    setIsProcessingAction(true);
    // Optimistic UI update
    setItems(prev => prev.filter(it => it.id !== item.id));

    try {
      const tableName = item.kategori_izin === "sambang" ? "izin_sambang" : item.kategori_izin === "sakit" ? "izin_sakit" : "izin_haid";
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", item.id);

      if (error) throw error;`;

const executeDeleteItemNew = `  const executeDeleteItem = async (item: PerizinanItem) => {
    setIsProcessingAction(true);
    // Optimistic UI update
    setItems(prev => prev.filter(it => it.id !== item.id));

    try {
      const tableName = item.kategori_izin === "sambang" ? "izin_sambang" : item.kategori_izin === "sakit" ? "izin_sakit" : "izin_haid";
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      
      // If the item was active ("Sedang..."), revert status back to Aktif
      if (item.status && item.status.toLowerCase().startsWith("sedang")) {
        try {
          await supabase
            .from("status_siswa")
            .upsert({
              nama: item.nama_siswa,
              status: "Aktif",
              created_at: new Date().toISOString()
            }, { onConflict: "nama" });
            
          const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
          savedStatusMap[item.nama_siswa] = "Aktif";
          if (item.siswa_id) savedStatusMap[item.siswa_id] = "Aktif";
          localStorage.setItem("santri_status_map", JSON.stringify(savedStatusMap));
        } catch (e) {
          console.warn("Could not sync status_siswa revert on delete:", e);
        }
      }`;

content = content.replace(executeDeleteItemStart, executeDeleteItemNew);

fs.writeFileSync('src/components/PerizinanPanel.tsx', content);
