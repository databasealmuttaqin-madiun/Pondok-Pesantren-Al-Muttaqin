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
          keperluan: d.keperluan ? \`\${d.keperluan} (Tujuan: \${d.tujuan || 'Tidak ada'})\` : (d.tujuan || 'Sambang')
        })));
      }
      if (sakitRes.data) {
        allItems = allItems.concat(sakitRes.data.map(d => ({ ...d, kategori_izin: "sakit" })));
      }
      if (haidRes.data) {
        allItems = allItems.concat(haidRes.data.map(d => ({ ...d, kategori_izin: "haid", keperluan: "Berhalangan Sholat / Haid" })));
      }

      setItems(allItems.sort((a, b) => b.id - a.id));
      setHasFetched(true);`;

content = content.replace(oldFetch, newFetch);

const oldSave = `    const payload: Partial<PerizinanItem> = {
      siswa_id: formStudent.id ? Number(formStudent.id) : null,
      nama_siswa: formStudent.nama_lengkap,
      jenis_kelamin: formStudent.jenis_kelamin || "L",
      kamar: formStudent.kamar || formKamar || "Belum Set",
      kategori_izin: activeSubMenu,
      keperluan: activeSubMenu === "sambang" 
        ? \`\${formKeperluan} (Tujuan: \${formTujuan})\` 
        : (activeSubMenu === "sakit" ? formDiagnosa : "Berhalangan Sholat / Haid"),
      diagnosa_keluhan: activeSubMenu === "sakit" ? formDiagnosa : undefined,
      lokasi_rawat: activeSubMenu === "sakit" ? formLokasiRawat : undefined,
      penjemput: activeSubMenu === "sambang" 
        ? \`\${formTujuan} | Wali: \${formHubunganWali || "Wali"}\` 
        : undefined,
      no_hp_penjemput: formNoHp || undefined,
      tanggal_mulai: formTglMulai,
      jam_mulai: formJamMulai,
      tanggal_selesai: calculatedTglSelesai,
      jam_selesai: formJamSelesai,
      status: initialStatus,
      petugas: currentUserName,
      catatan: [
        activeSubMenu === "sambang" && formDurasiSambang ? \`Lama Sambang: \${formDurasiSambang} Hari (Batas: \${calculatedTglSelesai})\` : "",
        formSudahKonfirmasi ? \`[Sudah Konfirmasi Wali: \${formHubunganWali}]\` : \`[Belum Konfirmasi]\`,
        formCatatan
      ].filter(Boolean).join(" | "),
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from("perizinan")
        .insert([payload])
        .select();`;

const newSave = `    let dbPayload: any = {
      siswa_id: formStudent.id ? Number(formStudent.id) : null,
      nama_siswa: formStudent.nama_lengkap,
      jenis_kelamin: formStudent.jenis_kelamin || (activeSubMenu === 'haid' ? 'P' : 'L'),
      kamar: formStudent.kamar || formKamar || "Belum Set",
      tanggal_mulai: formTglMulai,
      jam_mulai: formJamMulai,
      tanggal_selesai: calculatedTglSelesai,
      jam_selesai: formJamSelesai,
      status: initialStatus,
      petugas: currentUserName,
      catatan: [
        activeSubMenu === "sambang" && formDurasiSambang ? \`Lama Sambang: \${formDurasiSambang} Hari (Batas: \${calculatedTglSelesai})\` : "",
        formSudahKonfirmasi ? \`[Sudah Konfirmasi Wali: \${formHubunganWali}]\` : \`[Belum Konfirmasi]\`,
        formCatatan
      ].filter(Boolean).join(" | "),
      created_at: new Date().toISOString()
    };

    if (activeSubMenu === "sambang") {
      dbPayload.tujuan = formTujuan;
      dbPayload.keperluan = formKeperluan;
      dbPayload.penjemput = \`\${formTujuan} | Wali: \${formHubunganWali || "Wali"}\`;
      dbPayload.no_hp_penjemput = formNoHp || null;
    } else if (activeSubMenu === "sakit") {
      dbPayload.diagnosa_keluhan = formDiagnosa;
      dbPayload.lokasi_rawat = formLokasiRawat;
    }

    const tableName = activeSubMenu === "sambang" ? "izin_sambang" : activeSubMenu === "sakit" ? "izin_sakit" : "izin_haid";

    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert([dbPayload])
        .select();`;

content = content.replace(oldSave, newSave);

const oldReturn = `    try {
      // 1. Update Supabase perizinan
      let updateRes = await supabase
        .from("perizinan")
        .update({
          status: returnStatus,
          tanggal_kembali: nowIso
        })
        .eq("id", item.id);
        
      // Try again with different timestamp format if it fails (Supabase issue fallback)
      if (updateRes.error) {
        console.warn("Retrying with date string format:", updateRes.error.message);
        updateRes = await supabase
          .from("perizinan")
          .update({
            status: returnStatus,
            tanggal_kembali: todayDate
          })
          .eq("id", item.id);
      }

      if (updateRes.error) throw updateRes.error;`;

const newReturn = `    try {
      const tableName = item.kategori_izin === "sambang" ? "izin_sambang" : item.kategori_izin === "sakit" ? "izin_sakit" : "izin_haid";
      // 1. Update Supabase perizinan
      let updateRes = await supabase
        .from(tableName)
        .update({
          status: returnStatus,
          tanggal_kembali: nowIso
        })
        .eq("id", item.id);
        
      // Try again with different timestamp format if it fails (Supabase issue fallback)
      if (updateRes.error) {
        console.warn("Retrying with date string format:", updateRes.error.message);
        updateRes = await supabase
          .from(tableName)
          .update({
            status: returnStatus,
            tanggal_kembali: todayDate
          })
          .eq("id", item.id);
      }

      if (updateRes.error) throw updateRes.error;`;

content = content.replace(oldReturn, newReturn);

const oldDelete = `    try {
      const { error } = await supabase
        .from("perizinan")
        .delete()
        .eq("id", item.id);`;

const newDelete = `    try {
      const tableName = item.kategori_izin === "sambang" ? "izin_sambang" : item.kategori_izin === "sakit" ? "izin_sakit" : "izin_haid";
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", item.id);`;

content = content.replace(oldDelete, newDelete);

fs.writeFileSync('src/components/PerizinanPanel.tsx', content);
