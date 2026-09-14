import re

with open("src/components/RekapJurnalPengajianPanel.tsx", "r") as f:
    content = f.read()

# Change the .select() to avoid strict relation failure if it doesn't exist
# Supabase sometimes fails strict hints on TEXT foreign keys. We'll fetch ustaz_id and resolve the name manually.
old_select = '.select("*, materi_pengajian(nama_materi, kelompok), sesi_mengaji(nama_sesi), pengguna!ustaz_id(nama)")'
new_select = '.select("*, materi_pengajian(nama_materi, kelompok), sesi_mengaji(nama_sesi)")'
content = content.replace(old_select, new_select)

fetch_code = """
      const { data, error } = await supabase
        .from("jurnal_pengajian")
        .select("*, materi_pengajian(nama_materi, kelompok), sesi_mengaji(nama_sesi)")
        .eq("kelas_pengajian", selectedClass)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .order("tanggal", { ascending: true });

      if (error) throw error;
      
      const loadedJurnals = data || [];
      
      // Manually fetch and attach pengguna names since relation might not be strictly defined in Postgres
      if (loadedJurnals.length > 0) {
        const ustazIds = Array.from(new Set(loadedJurnals.map(j => j.ustaz_id).filter(id => id)));
        if (ustazIds.length > 0) {
           const { data: usersData } = await supabase.from("pengguna").select("id, nama").in("id", ustazIds);
           if (usersData) {
             const userMap = {};
             usersData.forEach(u => userMap[u.id] = u.nama);
             loadedJurnals.forEach(j => {
               if (j.ustaz_id && userMap[j.ustaz_id]) {
                 j.pengguna = { nama: userMap[j.ustaz_id] };
               }
             });
           }
        }
      }

      setJurnals(loadedJurnals);
"""

# Replace the inner try block of loadData
content = re.sub(r'const \{ data, error \} = await supabase.*?setJurnals\(data \|\| \[\]\);', fetch_code.strip(), content, flags=re.DOTALL)

with open("src/components/RekapJurnalPengajianPanel.tsx", "w") as f:
    f.write(content)

