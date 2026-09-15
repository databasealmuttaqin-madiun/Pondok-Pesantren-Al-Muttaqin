import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { 
  Save, AlertCircle, Plus, Edit, Trash2, Calendar, BookOpen, 
  Users, CheckCircle, Clock, XCircle, Info, ClipboardEdit, Target,
  User as UserIcon
} from "lucide-react";
import { SantriData } from "../supabaseClient";

interface Props {
  currentUserRole: string;
  userTugasTambahan?: string[];
  recitationClasses: string[];
  onTriggerNotification: (msg: string, type: "success" | "error" | "warning" | "info") => void;
  currentUser?: any;
}

export default function JurnalPengajianPanel({
  currentUserRole,
  userTugasTambahan,
  recitationClasses,
  onTriggerNotification,
  currentUser
}: Props) {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedKelompok, setSelectedKelompok] = useState<string>("");
  const [selectedSesi, setSelectedSesi] = useState<string>("");
  const [sesiList, setSesiList] = useState<any[]>([]);
  
  const [materiList, setMateriList] = useState<any[]>([]);
  const [ustazList, setUstazList] = useState<any[]>([]);
  const [targetInfo, setTargetInfo] = useState<any>(null);
  const [santriList, setSantriList] = useState<SantriData[]>([]);
  
  // Realisasi
  const [selectedMateri, setSelectedMateri] = useState<number | "">("");
  const [selectedUstaz, setSelectedUstaz] = useState<string>("");
  const [realisasiMulai, setRealisasiMulai] = useState<number | "">("");
  const [realisasiSelesai, setRealisasiSelesai] = useState<number | "">("");
  const [catatan, setCatatan] = useState<string>("");
  
  const [absensiMap, setAbsensiMap] = useState<Record<string, { status: string, keterangan: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingJurnal, setExistingJurnal] = useState<any>(null);
  const [dbMissing, setDbMissing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      
      // Fetch Sesi
      const { data: sesiData, error: sesiError } = await supabase.from("sesi_mengaji").select("*").order("urutan", { ascending: true });
      if (sesiError && (sesiError.code === 'PGRST205' || sesiError.message.includes('table'))) {
        setDbMissing(true);
      }
      if (sesiData) {
        setSesiList(sesiData);
        if (sesiData.length > 0) setSelectedSesi(sesiData[0].id.toString());
      }

      // Fetch Materi
      const { data: materiData } = await supabase.from("materi_pengajian").select("*").order("urutan", { ascending: true });
      if (materiData) setMateriList(materiData);

      // Fetch Ustaz (Pengguna with role/tugas_tambahan containing 'guru' or 'pengasuh')
      const { data: penggunaData } = await supabase.from("pengguna").select("id, nama, role, tugas_tambahan");
      if (penggunaData) {
        const filteredUstaz = penggunaData.filter(u => {
          const r = String(u.role || "").toLowerCase();
          const tt = Array.isArray(u.tugas_tambahan) ? u.tugas_tambahan.map(x => String(x).toLowerCase()) : [];
          return r.includes("guru") || r.includes("pengasuh") || r.includes("pondok") || tt.some(x => x.includes("guru"));
        });
        setUstazList(filteredUstaz);
      }
    };
    fetchData();
  }, []);
  
  // Set default selectedUstaz when ustazList or currentUser changes
  useEffect(() => {
    if (currentUser?.id && !selectedUstaz) {
      setSelectedUstaz(currentUser.id.toString());
    }
  }, [currentUser, ustazList]);

  // Load target & santri when class, date, or kelompok changes
  useEffect(() => {
    if (selectedClass && selectedDate && selectedKelompok && selectedSesi) {
      loadData();
    } else {
      setTargetInfo(null);
      setSantriList([]);
      setAbsensiMap({});
      setExistingJurnal(null);
    }
  }, [selectedClass, selectedDate, selectedKelompok, selectedSesi]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Get Target for this date & class & kelompok
      const { data: targetData, error: targetError } = await supabase
        .from("target_pengajian")
        .select("*, materi_pengajian!inner(nama_materi, kelompok)")
        .eq("kelas_pengajian", selectedClass)
        .eq("tanggal", selectedDate)
        .eq("materi_pengajian.kelompok", selectedKelompok)
        .maybeSingle();
        
      setTargetInfo(targetData || null);
      
      // If target exists, try to pre-select materi if it's not selected yet
      if (targetData && !selectedMateri) {
        setSelectedMateri(targetData.materi_id);
      }

      
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


      // 4. Get Santri for this class
      const cached = localStorage.getItem("santri_data");
      let allSantri: SantriData[] = cached ? JSON.parse(cached) : [];
      const classSantri = allSantri.filter(s => (s as any).kelas_pengajian === selectedClass);
      
      setSantriList(classSantri);
      
      // If no existing jurnal, init absensi to 'hadir'
      if (!jurnalData) {
        const initAbs = {};
        classSantri.forEach(s => {
          if (s.id) {
            initAbs[s.id] = { status: 'hadir', keterangan: '' };
          }
        });
        setAbsensiMap(initAbs);
      }

    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleStatusChange = (santriId: number, status: string) => {
    setAbsensiMap(prev => ({
      ...prev,
      [santriId]: { ...prev[santriId], status }
    }));
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedDate || !selectedKelompok || !selectedSesi) {
      onTriggerNotification("Pilih kelas, kelompok, dan tanggal terlebih dahulu", "warning");
      return;
    }
    if (!selectedMateri) {
      onTriggerNotification("Detail Materi harus dipilih", "warning");
      return;
    }
    if (realisasiMulai === "" || realisasiSelesai === "") {
      onTriggerNotification("Halaman mulai dan selesai harus diisi", "warning");
      return;
    }

    setIsSaving(true);
    try {      
      let jurnalId;

      const payload = {
        target_id: targetInfo ? targetInfo.id : null,
        materi_id: selectedMateri,
        kelas_pengajian: selectedClass,
        sesi_id: selectedSesi || null,
        ustaz_id: selectedUstaz || null,
        tanggal: selectedDate,
        realisasi_halaman_mulai: realisasiMulai,
        realisasi_halaman_selesai: realisasiSelesai,
        catatan_kendala: catatan,
      };

      if (existingJurnal) {
        // Update
        const { data, error } = await supabase
          .from("jurnal_pengajian")
          .update(payload)
          .eq("id", existingJurnal.id)
          .select()
          .single();
          
        if (error) throw error;
        jurnalId = data.id;
      } else {
        // Insert
        const { data, error } = await supabase
          .from("jurnal_pengajian")
          .insert([payload])
          .select()
          .single();
          
        if (error) throw error;
        jurnalId = data.id;
        setExistingJurnal(data);
      }

      // Save absensi
      await supabase.from("absensi_pengajian").delete().eq("jurnal_id", jurnalId);
      
      const absensiPayloads = Object.keys(absensiMap).map(sId => ({
        jurnal_id: jurnalId,
        santri_id: sId,
        sesi_id: selectedSesi || null,
        status: absensiMap[sId].status,
        keterangan: absensiMap[sId].keterangan
      }));
      
      if (absensiPayloads.length > 0) {
        const { error: absError } = await supabase
          .from("absensi_pengajian")
          .insert(absensiPayloads);
        if (absError) throw absError;
      }

      onTriggerNotification("Jurnal dan absensi berhasil disimpan", "success");
      loadData(); // reload to get status_capaian from trigger
    } catch (e: any) {
      console.error(e);
      onTriggerNotification(`Gagal menyimpan: ${e.message}`, "error");
    }
    setIsSaving(false);
  };

  const filteredMateri = materiList.filter(m => m.kelompok === selectedKelompok);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ClipboardEdit className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Jurnal & Absensi Pengajian
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Catat realisasi mengajar dan absensi santri harian.
        </p>
      </div>

      {dbMissing && (
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800 mb-6">
          <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Tabel Sesi Belum Dibuat di Database</h3>
          <p className="text-sm text-red-700 dark:text-red-400 mb-4">
            Fitur Jurnal Pengajian tidak dapat dimuat karena tabel <strong>sesi_mengaji</strong> belum ditambahkan ke Supabase.
            Silakan buka menu <strong>Manajemen Pondok &gt; Sesi Mengaji</strong> untuk menyalin kode SQL pembuatan tabelnya.
          </p>
        </div>
      )}

      {/* FILTER BAR ATAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
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

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kelas Pengajian
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">-- Pilih Kelas --</option>
            {recitationClasses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kelompok Materi
          </label>
          <select
            value={selectedKelompok}
            onChange={(e) => {
              setSelectedKelompok(e.target.value);
              setSelectedMateri(""); // Reset detail materi on kelompok change
            }}
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">-- Pilih Kelompok --</option>
            <option value="alquran">Al-Qur'an</option>
            <option value="himpunan">Al-Hadist (Himpunan)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Tanggal
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {selectedClass && selectedDate && selectedKelompok && selectedSesi && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Jurnal */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Target Hari Ini Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3">
                <Target className="w-5 h-5" /> Target Hari Ini
              </h3>
              {targetInfo ? (
                <div className="space-y-2 text-sm text-blue-900 dark:text-blue-200">
                  <p><strong>Materi:</strong> {targetInfo.materi_pengajian?.nama_materi} ({targetInfo.materi_pengajian?.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"})</p>
                  <p><strong>Pertemuan:</strong> Ke-{targetInfo.pertemuan_ke}</p>
                  <p><strong>Target Hal:</strong> {targetInfo.target_halaman_mulai} s/d {targetInfo.target_halaman_selesai}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">Belum ada target di-set untuk hari ini pada kelompok {selectedKelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"}.</p>
              )}
            </div>

            {/* Realisasi Mengajar Card */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-slate-500" /> Realisasi Mengajar
              </h3>
              
              <div className="space-y-3">
                {/* Detail Materi */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Detail Materi {selectedKelompok === 'alquran' ? "(Juz)" : "(Kitab)"}
                  </label>
                  <select
                    value={selectedMateri}
                    onChange={(e) => setSelectedMateri(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih {selectedKelompok === 'alquran' ? "Juz" : "Kitab"} --</option>
                    {filteredMateri.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nama_materi}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Guru Pengajar */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Guru Pengajar</label>
                  <select
                    value={selectedUstaz}
                    onChange={(e) => setSelectedUstaz(e.target.value)}
                    className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Ustaz --</option>
                    {ustazList.map(u => (
                      <option key={u.id} value={u.id}>{u.nama}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mulai Hal.</label>
                  <input
                    type="number"
                    value={realisasiMulai}
                    onChange={(e) => setRealisasiMulai(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Mulai"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Sampai Hal.</label>
                  <input
                    type="number"
                    value={realisasiSelesai}
                    onChange={(e) => setRealisasiSelesai(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Selesai"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Catatan/Kendala (Opsional)</label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Misal: Santri kurang fokus..."
                />
              </div>
              
              {existingJurnal && existingJurnal.status_capaian && (
                <div className={`p-2 rounded-md text-xs font-medium border ${
                  existingJurnal.status_capaian === 'tercapai' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                  existingJurnal.status_capaian === 'terlampaui' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' :
                  'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800'
                }`}>
                  Status Capaian: {existingJurnal.status_capaian.replace('_', ' ').toUpperCase()}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving || realisasiMulai === "" || realisasiSelesai === "" || !selectedMateri}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? <span className="animate-pulse">Menyimpan...</span> : <><Save className="w-4 h-4" /> Simpan Jurnal</>}
              </button>
            </div>
          </div>

          {/* Absensi Santri */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-500" />
                  Absensi Santri
                </h3>
                <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-1 rounded-full">
                  {santriList.length} Santri
                </span>
              </div>
              
              {santriList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Info className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Tidak ada data santri untuk kelas ini.</p>
                  <p className="text-xs mt-1">Pastikan santri telah di-plot ke kelas pengajian.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
                  {santriList.map((santri) => {
                    if (!String(String(santri.id || ""))) return null;
                    const absensi = absensiMap[santri.id || 0] || { status: 'hadir', keterangan: '' };
                    return (
                      <div key={santri.id || santri.nama_lengkap} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{santri.nama_lengkap}</p>
                          {santri.id && <p className="text-xs text-slate-500">ID: {santri.id}</p>}
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                          {[
                            { value: 'hadir', label: 'H', color: 'text-green-600 bg-green-100 dark:bg-green-900/40 dark:text-green-400 border-green-200 dark:border-green-800' },
                            { value: 'izin', label: 'I', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
                            { value: 'sakit', label: 'S', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
                            { value: 'terlambat', label: 'T', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
                            { value: 'alpa', label: 'A', color: 'text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800' }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => handleStatusChange(Number(santri.id) || 0, opt.value)}
                              className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all border ${
                                absensi.status === opt.value 
                                  ? opt.color + " shadow-sm scale-110 z-10" 
                                  : "text-slate-500 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                              title={opt.value.toUpperCase()}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
