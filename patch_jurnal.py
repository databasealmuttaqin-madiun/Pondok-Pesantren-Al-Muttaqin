import re

with open("src/components/JurnalPengajianPanel.tsx", "r") as f:
    content = f.read()

# 1. Add sesi_id to states
content = content.replace('const [selectedKelompok, setSelectedKelompok] = useState<string>("");', 'const [selectedKelompok, setSelectedKelompok] = useState<string>("");\n  const [selectedSesi, setSelectedSesi] = useState<string>("");\n  const [sesiList, setSesiList] = useState<any[]>([]);')

# 2. Add fetchSesi inside useEffect
fetch_sesi_code = """
      // Fetch Sesi
      const { data: sesiData } = await supabase.from("sesi_mengaji").select("*").order("urutan", { ascending: true });
      if (sesiData) {
        setSesiList(sesiData);
        if (sesiData.length > 0) setSelectedSesi(sesiData[0].id.toString());
      }
"""
content = content.replace('// Fetch Materi', fetch_sesi_code + '\n      // Fetch Materi')

# 3. Add selectedSesi to the dependency array of the main loadData useEffect
content = content.replace('useEffect(() => {\n    if (selectedClass && selectedDate && selectedKelompok) {', 'useEffect(() => {\n    if (selectedClass && selectedDate && selectedKelompok && selectedSesi) {')
content = content.replace('}, [selectedClass, selectedDate, selectedKelompok]);', '}, [selectedClass, selectedDate, selectedKelompok, selectedSesi]);')

# 4. Modify loadData to use selectedSesi and fetch previous page
loadData_mod = """
      // 2. Check if Jurnal already exists for this kelompok AND sesi
      const { data: jurnalData, error: jurnalError } = await supabase
        .from("jurnal_pengajian")
        .select("*, materi_pengajian!inner(kelompok)")
        .eq("kelas_pengajian", selectedClass)
        .eq("tanggal", selectedDate)
        .eq("sesi_id", selectedSesi)
        .eq("materi_pengajian.kelompok", selectedKelompok)
        .maybeSingle();

      if (jurnalData) {
        setExistingJurnal(jurnalData);
        setSelectedMateri(jurnalData.materi_id || "");
        setSelectedUstaz(jurnalData.ustaz_id ? jurnalData.ustaz_id.toString() : (currentUser?.id?.toString() || ""));
        setRealisasiMulai(jurnalData.realisasi_halaman_mulai);
        setRealisasiSelesai(jurnalData.realisasi_halaman_selesai);
        setCatatan(jurnalData.catatan_kendala || "");
        
        // Load absensi for this jurnal
        const { data: absData } = await supabase
          .from("absensi_pengajian")
          .select("*")
          .eq("jurnal_id", jurnalData.id);
          
        if (absData) {
          const loadedAbs = {};
          absData.forEach(a => {
            loadedAbs[a.santri_id] = { status: a.status, keterangan: a.keterangan || "" };
          });
          setAbsensiMap(loadedAbs);
        }
      } else {
        setExistingJurnal(null);
        setRealisasiSelesai("");
        setCatatan("");
        
        // AUTO-FILL MULAI HALAMAN
        // Get the latest jurnal for this class and kelompok (prioritizing earlier today, or previous dates)
        const { data: prevJurnal } = await supabase
          .from("jurnal_pengajian")
          .select("realisasi_halaman_selesai, materi_pengajian!inner(kelompok)")
          .eq("kelas_pengajian", selectedClass)
          .eq("materi_pengajian.kelompok", selectedKelompok)
          .lte("tanggal", selectedDate)
          .order("tanggal", { ascending: false })
          .order("sesi_id", { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (prevJurnal && prevJurnal.realisasi_halaman_selesai) {
          setRealisasiMulai(prevJurnal.realisasi_halaman_selesai);
        } else {
          setRealisasiMulai("");
        }
      }
"""
content = re.sub(r'// 2\. Check if Jurnal already exists.*?} else \{\n.*?setRealisasiMulai\(""\);\n.*?setRealisasiSelesai\(""\);\n.*?setCatatan\(""\);\n.*?\}', loadData_mod, content, flags=re.DOTALL)

# 5. Add selectedSesi to payload in handleSave
content = content.replace('kelas_pengajian: selectedClass,', 'kelas_pengajian: selectedClass,\n        sesi_id: selectedSesi || null,')

# 6. Add Dropdown to UI (Filter Bar Atas)
dropdown_sesi = """        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Sesi Mengaji
          </label>
          <select
            value={selectedSesi}
            onChange={(e) => setSelectedSesi(e.target.value)}
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {sesiList.map(s => (
              <option key={s.id} value={s.id}>{s.nama_sesi}</option>
            ))}
          </select>
        </div>
"""
content = content.replace('      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">', '      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">\n' + dropdown_sesi)

# 7. Modify null checks in handleSave and UI rendering to include selectedSesi
content = content.replace('if (!selectedClass || !selectedDate || !selectedKelompok)', 'if (!selectedClass || !selectedDate || !selectedKelompok || !selectedSesi)')
content = content.replace('{selectedClass && selectedDate && selectedKelompok && !isLoading && (', '{selectedClass && selectedDate && selectedKelompok && selectedSesi && !isLoading && (')

with open("src/components/JurnalPengajianPanel.tsx", "w") as f:
    f.write(content)
