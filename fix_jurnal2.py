import sys

with open("src/components/JurnalPengajianPanel.tsx", "r") as f:
    content = f.read()

# Add states
old_states = """  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [targetInfo, setTargetInfo] = useState<any>(null);"""

new_states = """  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMateri, setSelectedMateri] = useState<number | "">("");
  
  const [materiList, setMateriList] = useState<any[]>([]);
  const [targetInfo, setTargetInfo] = useState<any>(null);"""

content = content.replace(old_states, new_states)

# Fetch materi on mount
use_effect_deps = """  // Load target & santri when class or date changes
  useEffect(() => {
    if (selectedClass && selectedDate) {"""

use_effect_new = """  useEffect(() => {
    const fetchMateri = async () => {
      const { data } = await supabase.from("materi_pengajian").select("*").order("urutan", { ascending: true });
      if (data) setMateriList(data);
    };
    fetchMateri();
  }, []);

  // Load target & santri when class or date changes
  useEffect(() => {
    if (selectedClass && selectedDate && selectedMateri) {"""

content = content.replace(use_effect_deps, use_effect_new)

# Dep array for useEffect
content = content.replace('  }, [selectedClass, selectedDate]);', '  }, [selectedClass, selectedDate, selectedMateri]);')

# Fetch jurnal logic
old_fetch_jurnal = """      // 2. Check if Jurnal already exists for this class and date
      const { data: jurnalData, error: jurnalError } = await supabase
        .from("jurnal_pengajian")
        .select("*")
        .eq("kelas_pengajian", selectedClass)
        .eq("tanggal", selectedDate)
        .maybeSingle();"""

new_fetch_jurnal = """      // 2. Check if Jurnal already exists
      const { data: jurnalData, error: jurnalError } = await supabase
        .from("jurnal_pengajian")
        .select("*")
        .eq("kelas_pengajian", selectedClass)
        .eq("tanggal", selectedDate)
        .eq("materi_id", selectedMateri)
        .maybeSingle();"""
content = content.replace(old_fetch_jurnal, new_fetch_jurnal)

# Fetch target logic
old_fetch_target = """      // 3. Get Target for this date
      const { data: targetData, error: targetError } = await supabase
        .from("target_pengajian")
        .select("*, materi_pengajian(nama_kitab, pengarang)")
        .eq("kelas_pengajian", selectedClass)
        .eq("tanggal", selectedDate)
        .maybeSingle();"""

new_fetch_target = """      // 3. Get Target for this date
      const { data: targetData, error: targetError } = await supabase
        .from("target_pengajian")
        .select("*, materi_pengajian(nama_materi, kelompok)")
        .eq("kelas_pengajian", selectedClass)
        .eq("tanggal", selectedDate)
        .eq("materi_id", selectedMateri)
        .maybeSingle();"""
content = content.replace(old_fetch_target, new_fetch_target)

# Payload logic
old_payload = """      const payload = {
        target_id: targetInfo ? targetInfo.id : null,
        kelas_pengajian: selectedClass,"""
new_payload = """      const payload = {
        target_id: targetInfo ? targetInfo.id : null,
        materi_id: selectedMateri,
        kelas_pengajian: selectedClass,"""
content = content.replace(old_payload, new_payload)

# Handle Validation message
old_val = """    if (!selectedClass || !selectedDate) {
      onTriggerNotification("Pilih kelas dan tanggal terlebih dahulu", "warning");
      return;
    }"""
new_val = """    if (!selectedClass || !selectedDate || !selectedMateri) {
      onTriggerNotification("Pilih kelas, tanggal, dan materi terlebih dahulu", "warning");
      return;
    }"""
content = content.replace(old_val, new_val)

# Update HTML fields
old_grid = """      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kelas Pengajian
          </label>"""
new_grid = """      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kelas Pengajian
          </label>"""
content = content.replace(old_grid, new_grid)

# Add Materi dropdown
dropdown = """        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Materi
          </label>
          <select
            value={selectedMateri}
            onChange={(e) => setSelectedMateri(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">-- Pilih Materi --</option>
            {materiList.map(m => (
              <option key={m.id} value={m.id}>
                {m.nama_materi} ({m.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"})
              </option>
            ))}
          </select>
        </div>"""

old_date = """        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Tanggal"""
content = content.replace(old_date, dropdown + "\n" + old_date)

# Render logic condition
old_render = """      {selectedClass && selectedDate && !isLoading && ("""
new_render = """      {selectedClass && selectedDate && selectedMateri && !isLoading && ("""
content = content.replace(old_render, new_render)

# Update target display
old_materi_disp = """                  <p><strong>Materi:</strong> {targetInfo.materi_pengajian?.nama_kitab}</p>"""
new_materi_disp = """                  <p><strong>Materi:</strong> {targetInfo.materi_pengajian?.nama_materi} ({targetInfo.materi_pengajian?.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"})</p>"""
content = content.replace(old_materi_disp, new_materi_disp)


with open("src/components/JurnalPengajianPanel.tsx", "w") as f:
    f.write(content)
