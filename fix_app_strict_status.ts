import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target1 = `        let cloudStatusMap: Record<string, "Aktif" | "Sakit" | "Pulang" | "Haid"> = {};
        
        // 1. Dapatkan status dari tabel status_siswa sebagai fallback
        const { data: statusOverrides, error: statusErr } = await supabase
          .from("status_siswa")
          .select("nama, status");
                
        if (statusErr) {
          console.warn("Tabel status_siswa tidak ditemukan atau gagal dimuat (Abaikan jika tabel belum ada).");
        } else if (statusOverrides) {
          statusOverrides.forEach((row) => {
            if (row.nama && row.status) {
              const normStatus = row.status.trim().toLowerCase();
              let standardized: "Aktif" | "Sakit" | "Pulang" | "Haid" = "Aktif";
              if (normStatus === "sakit") standardized = "Sakit";
              else if (normStatus === "pulang" || normStatus.includes("sambang")) standardized = "Pulang";
              else if (normStatus === "haid") standardized = "Haid";
                            
              cloudStatusMap[row.nama.trim().toLowerCase()] = standardized;
            }
          });
        }
        
        // 2. Dapatkan status real-time absolut langsung dari tabel perizinan aktif (OVERRIDE status_siswa jika ada perbedaan)
        try {
          const [activeSambang, activeSakit, activeHaid] = await Promise.all([
            supabase.from("izin_sambang").select("nama_siswa").ilike("status", "%sedang%"),
            supabase.from("izin_sakit").select("nama_siswa").ilike("status", "%sedang%"),
            supabase.from("izin_haid").select("nama_siswa").ilike("status", "%sedang%")
          ]);
          
          if (activeSambang.data) {
            activeSambang.data.forEach(row => {
              if (row.nama_siswa) cloudStatusMap[row.nama_siswa.trim().toLowerCase()] = "Pulang";
            });
          }
          if (activeSakit.data) {
            activeSakit.data.forEach(row => {
              if (row.nama_siswa) cloudStatusMap[row.nama_siswa.trim().toLowerCase()] = "Sakit";
            });
          }
          if (activeHaid.data) {
            activeHaid.data.forEach(row => {
              if (row.nama_siswa) cloudStatusMap[row.nama_siswa.trim().toLowerCase()] = "Haid";
            });
          }
        } catch (err) {
          console.warn("Gagal mengecek tabel perizinan aktif untuk sinkronisasi status:", err);
        }`;

const replacement1 = `        let cloudStatusMap: Record<string, "Aktif" | "Sakit" | "Pulang" | "Haid"> = {};
        
        // SYNC ABSOLUT: Dapatkan status real-time langsung dari tabel perizinan aktif
        // Abaikan tabel status_siswa karena status dikunci lewat menu perizinan
        try {
          const [activeSambang, activeSakit, activeHaid] = await Promise.all([
            supabase.from("izin_sambang").select("nama_siswa").ilike("status", "%sedang%"),
            supabase.from("izin_sakit").select("nama_siswa").ilike("status", "%sedang%"),
            supabase.from("izin_haid").select("nama_siswa").ilike("status", "%sedang%")
          ]);
          
          if (activeSambang.data) {
            activeSambang.data.forEach(row => {
              if (row.nama_siswa) cloudStatusMap[row.nama_siswa.trim().toLowerCase()] = "Pulang";
            });
          }
          if (activeSakit.data) {
            activeSakit.data.forEach(row => {
              if (row.nama_siswa) cloudStatusMap[row.nama_siswa.trim().toLowerCase()] = "Sakit";
            });
          }
          if (activeHaid.data) {
            activeHaid.data.forEach(row => {
              if (row.nama_siswa) cloudStatusMap[row.nama_siswa.trim().toLowerCase()] = "Haid";
            });
          }
        } catch (err) {
          console.warn("Gagal mengecek tabel perizinan aktif untuk sinkronisasi status:", err);
        }`;

const target2 = `    const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
    const savedMetadataMap = JSON.parse(localStorage.getItem("santri_custom_metadata_map") || "{}");
    return list.map((s) => {
      const formatted = formatSantriData(s);
      const nameKey = formatted.nama_lengkap.trim().toLowerCase();
      
      // status_siswa and active izin overrides has highest priority
      const cloudStatus = cloudStatusMap ? cloudStatusMap[nameKey] : null;
      
      // Local storage overrides (keyed by name, id, or NIK)
      const localStatus = savedStatusMap[formatted.nama_lengkap] || savedStatusMap[s.id || s.nik];

      // Plottings
      const cloudPlot = cloudPlottingMap ? cloudPlottingMap[nameKey] : null;
      const localPlot = savedMetadataMap[s.nik] || {};
      
      // NFC Mapping override
      const cloudNfcId = cloudNfcMap ? cloudNfcMap[nameKey] : null;
      
      return {
        ...formatted,
        status: cloudStatus || localStatus || formatted.status || "Aktif",`;

const replacement2 = `    const savedMetadataMap = JSON.parse(localStorage.getItem("santri_custom_metadata_map") || "{}");
    return list.map((s) => {
      const formatted = formatSantriData(s);
      const nameKey = formatted.nama_lengkap.trim().toLowerCase();
      
      // Strict Override: Jika cloudStatusMap tersedia, maka siswa WAJIB Aktif kecuali terdaftar Sakit/Pulang/Haid di cloudStatusMap
      const cloudStatus = cloudStatusMap ? (cloudStatusMap[nameKey] || "Aktif") : null;

      // Plottings
      const cloudPlot = cloudPlottingMap ? cloudPlottingMap[nameKey] : null;
      const localPlot = savedMetadataMap[s.nik] || {};
      
      // NFC Mapping override
      const cloudNfcId = cloudNfcMap ? cloudNfcMap[nameKey] : null;
      
      return {
        ...formatted,
        status: cloudStatus || "Aktif",`;

content = content.replace(target1, replacement1);
content = content.replace(target2, replacement2);

fs.writeFileSync('src/App.tsx', content);
