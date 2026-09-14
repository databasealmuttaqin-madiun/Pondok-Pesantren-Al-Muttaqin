import sys

with open("src/components/JurnalPengajianPanel.tsx", "r") as f:
    content = f.read()

content = content.replace('''
      // 1. Get Kelas Pengajian ID
      const { data: kelasData, error: kelasError } = await supabase
        .from("kelas_pengajian")
        .select("id")
        .eq("nama_kelas", selectedClass)
        .single();
        
      if (kelasError || !kelasData) {
        setTargetInfo(null);
        setSantriList([]);
        setIsLoading(false);
        return;
      }
      
      const kelasId = kelasData.id;
''', '')

content = content.replace('.eq("kelas_pengajian_id", kelasId)', '.eq("kelas_pengajian", selectedClass)')

content = content.replace('''
      const { data: kelasData } = await supabase
        .from("kelas_pengajian")
        .select("id")
        .eq("nama_kelas", selectedClass)
        .single();
        
      if (!kelasData) throw new Error("Kelas tidak ditemukan");
''', '')

content = content.replace('kelas_pengajian_id: kelasData.id,', 'kelas_pengajian: selectedClass,')

with open("src/components/JurnalPengajianPanel.tsx", "w") as f:
    f.write(content)

