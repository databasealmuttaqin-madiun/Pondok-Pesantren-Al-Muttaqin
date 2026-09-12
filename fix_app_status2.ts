import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `        let cloudStatusMap: Record<string, "Aktif" | "Sakit" | "Pulang"> = {};
        const { data: statusOverrides, error: statusErr } = await supabase
          .from("status_siswa")
          .select("nama, status");
                
        if (statusErr) {
          console.warn("Tabel status_siswa tidak ditemukan atau gagal dimuat (Abaikan jika tabel belum ada).");
        } else if (statusOverrides) {
          statusOverrides.forEach((row) => {
            if (row.nama && row.status) {
              const normStatus = row.status.trim().toLowerCase();
              let standardized: "Aktif" | "Sakit" | "Pulang" = "Aktif";
              if (normStatus === "sakit") standardized = "Sakit";
              else if (normStatus === "pulang") standardized = "Pulang";
                            
              cloudStatusMap[row.nama.trim().toLowerCase()] = standardized;
            }
          });
        }`;

const replacement = `        let cloudStatusMap: Record<string, "Aktif" | "Sakit" | "Pulang" | "Haid"> = {};
        
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

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
