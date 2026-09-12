import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /let cloudStatusMap: Record<string, "Aktif" \| "Sakit" \| "Pulang"> = \{\};[\s\S]*?cloudStatusMap\[row.nama.trim\(\).toLowerCase\(\)\] = standardized;\s*\}\s*\}\);\s*\}/;

const replacement = `let cloudStatusMap: Record<string, "Aktif" | "Sakit" | "Pulang" | "Haid"> = {};
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
          console.warn("Gagal mengecek tabel perizinan aktif:", err);
        }`;

if(regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Success");
} else {
    console.log("Regex not matched");
}
