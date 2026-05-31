import React, { useState, useEffect, useRef } from "react";
import { SantriData, supabase } from "../supabaseClient";
import { 
  Home, 
  UserCheck, 
  Check, 
  RefreshCw, 
  Calendar, 
  Users, 
  Clock, 
  Search, 
  ArrowRight,
  Sparkles,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileCheck
} from "lucide-react";

interface PerizinanPanelProps {
  students: SantriData[];
  rooms: string[];
  onRefreshAll: () => Promise<void>;
  onTriggerNotification: (message: string, type: "success" | "error" | "warning") => void;
}

interface StatusSiswaRow {
  id?: number;
  created_at?: string;
  nama: string;
  status: string;
}

export default function PerizinanPanel({
  students,
  rooms,
  onRefreshAll,
  onTriggerNotification
}: PerizinanPanelProps) {
  const [selectedKamar, setSelectedKamar] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<SantriData | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"Aktif" | "Sakit" | "Pulang" | "">("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusSiswaRow[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Consolidate rooms: defaults from props + any custom ones found on assigned students
  const allRooms = Array.from(
    new Set([
      ...rooms, 
      ...students.map(s => s.kamar).filter((k): k is string => !!k)
    ])
  ).sort();

  // Load status history records from status_siswa table
  const fetchStatusHistory = async () => {
    setIsLoadingHistory(true);
    setConnectionError(null);
    try {
      const { data, error } = await supabase
        .from("status_siswa")
        .select("*")
        .order("id", { ascending: false });

      if (error) {
        throw error;
      }
      setStatusHistory(data || []);
      setConnectionError(null);
    } catch (e: any) {
      console.error("Gagal mengambil data status_siswa:", e);
      setConnectionError(e.message || "Tabel status_siswa tidak terhubung / tidak ditemukan");
      // Fallback local storage
      const savedOverwrites = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
      const mappedLocal: StatusSiswaRow[] = Object.entries(savedOverwrites).map(([nameOrId, stat]) => ({
        created_at: new Date().toISOString(),
        nama: String(nameOrId),
        status: String(stat)
      }));
      setStatusHistory(mappedLocal);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Synchronize status history in real-time
  const fetchStatusHistoryRef = useRef(fetchStatusHistory);
  fetchStatusHistoryRef.current = fetchStatusHistory;

  useEffect(() => {
    fetchStatusHistoryRef.current();

    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log("Realtime update detected for status_siswa table. Reloading log...");
        fetchStatusHistoryRef.current();
      }, 400);
    };

    const statusChannel = supabase
      .channel("sub-status-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "status_siswa" }, () => {
        debouncedReload();
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(statusChannel);
    };
  }, []);

  // Students belonging to the chosen Kamar
  const filteredStudentsByKamar = students.filter(s => {
    const sRoom = s.kamar || "Belum Set";
    // Standardize comparison
    const normSRoom = sRoom.trim().toLowerCase();
    const normSelRoom = selectedKamar.trim().toLowerCase();
    
    // Group "Belum Set" or empty kamar under a special group if requested,
    // otherwise exact match or match empty if selected "Belum Set"
    if (selectedKamar === "Belum Set") {
      return !s.kamar || s.kamar === "—" || normSRoom === "" || normSRoom === "belum set";
    }
    return normSRoom === normSelRoom;
  });

  // Apply name search query filter
  const filteredStudents = filteredStudentsByKamar.filter(s => 
    s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nama_panggilan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle saving the status change
  const handleSaveStatus = async () => {
    if (!selectedStudent) {
      onTriggerNotification("Pilih nama santri terlebih dahulu", "warning");
      return;
    }
    if (!selectedStatus) {
      onTriggerNotification("Pilih status perizinan yang ingin ditetapkan", "warning");
      return;
    }

    setIsSubmitting(true);
    const studentName = selectedStudent.nama_lengkap;
    const newStatus = selectedStatus;

    try {
      // 1. Update/Write to "status_siswa" Table (using Upsert to prevent duplicate names if needed or updating historical log)
      // Check if entry with this name exists first to modify it (or insert if non-existent)
      const { data: existing, error: checkError } = await supabase
        .from("status_siswa")
        .select("id")
        .eq("nama", studentName);

      if (checkError) {
        console.warn("Error querying status_siswa, inserting new row:", checkError.message);
      }

      const existingRecord = existing && existing.length > 0 ? existing[0] : null;

      if (existingRecord) {
        // Update
        const { error: updateError } = await supabase
          .from("status_siswa")
          .update({
            status: newStatus,
            created_at: new Date().toISOString()
          })
          .eq("id", existingRecord.id);

        if (updateError) throw updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from("status_siswa")
          .insert([
            { nama: studentName, status: newStatus, created_at: new Date().toISOString() }
          ]);

        if (insertError) throw insertError;
      }

      // 3. Update localStorage for instant local reactivity
      const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
      savedStatusMap[studentName] = newStatus;
      if (selectedStudent.id) {
        savedStatusMap[selectedStudent.id] = newStatus;
      }
      localStorage.setItem("santri_status_map", JSON.stringify(savedStatusMap));

      // Success feedback
      onTriggerNotification(`Berhasil menetapkan status "${newStatus}" untuk ${studentName}`, "success");
      
      // Reset form variables
      setSelectedStatus("");
      setSelectedStudent(null);
      setSearchQuery("");
      
      // Refresh database tables
      await onRefreshAll();
      await fetchStatusHistory();

    } catch (e: any) {
      console.error(e);
      onTriggerNotification(`Terjadi kesalahan: ${e.message || "Gagal menghubungi database"}`, "error");
      
      // Offline fallback
      const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
      savedStatusMap[studentName] = newStatus;
      if (selectedStudent.id) {
        savedStatusMap[selectedStudent.id] = newStatus;
      }
      localStorage.setItem("santri_status_map", JSON.stringify(savedStatusMap));
      onTriggerNotification(`Status disimpan secara lokal: ${studentName} -> ${newStatus}`, "success");
      
      setSelectedStatus("");
      setSelectedStudent(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHistoryRow = async (id: number, nama: string) => {
    if (!window.confirm(`Hapus status perizinan dari ${nama}?`)) return;
    try {
      const { error } = await supabase
        .from("status_siswa")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      onTriggerNotification(`Catatan status untuk ${nama} berhasil dihapus`, "success");
      fetchStatusHistory();
      onRefreshAll();
    } catch (e: any) {
      console.error(e);
      onTriggerNotification("Gagal menghapus catatan dari cloud database", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-[#104e7a] text-white p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-white/15 rounded-lg text-sky-200">
              <UserCheck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-extrabold tracking-tight">Manajemen Perizinan & Status</h2>
          </div>
          <p className="text-[11px] md:text-xs text-sky-100/90 font-medium">
            Atur status pemondokan, perizinan pulang, atau santri sakit terintegrasi dengan tabel <span className="font-mono bg-sky-950/40 px-1 py-0.5 rounded">status_siswa</span>.
          </p>
        </div>
        <button
          onClick={() => {
            fetchStatusHistory();
            onRefreshAll();
          }}
          className="bg-white/10 hover:bg-white/20 transition-all text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 border border-white/10"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* CONNECTION STATUS ALERT FOR STATUS_SISWA */}
      {connectionError && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 text-amber-900 space-y-3 animate-fade-in" id="status-siswa-connection-alert">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-amber-100 rounded-xl text-amber-700 font-bold shrink-0 text-lg">⚠️</span>
            <div>
              <h4 className="font-extrabold text-amber-950 text-sm">
                Tabel 'status_siswa' Belum Aktif / Terhubung di Supabase Anda!
              </h4>
              <p className="text-xs leading-relaxed font-semibold text-amber-800 mt-1">
                Koneksi database utama berjalan, tetapi sistem mendeteksi kendala pada tabel khusus <strong className="font-mono bg-amber-150 px-1 py-0.5 rounded text-amber-950">status_siswa</strong>. 
                Sistem saat ini beralih ke <strong className="text-amber-950">Mode Penyimpanan Lokal Sementara (Offline Backup)</strong> agar Anda tetap dapat mengedit status perizinan.
              </p>
              <div className="text-[10px] bg-white border border-amber-250 p-2 rounded text-slate-500 font-mono mt-2">
                Pesan Error: {connectionError}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/50">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`-- KODE SQL PEMBUAT TABEL STATUS_SISWA
CREATE TABLE IF NOT EXISTS status_siswa (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    nama TEXT NOT NULL,
    status TEXT NOT NULL
);

-- Mengaktifkan Row Level Security (RLS) agar web diizinkan mengakses data secara publik
ALTER TABLE status_siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Status Siswa Seluruh Operasi" ON status_siswa;
CREATE POLICY "Akses Publik Status Siswa Seluruh Operasi" ON status_siswa 
    AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);`);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              {copiedSql ? "✓ Berhasil Disalin!" : "Salin Query SQL Solusi"}
            </button>
            <button
              onClick={() => setShowSqlGuide(!showSqlGuide)}
              className="bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              {showSqlGuide ? "Sembunyikan Panduan 🙈" : "Lihat SQL & Panduan 📖"}
            </button>
          </div>

          {showSqlGuide && (
            <div className="bg-slate-900 text-slate-200 rounded-xl p-4 text-xs font-mono space-y-2 mt-2 leading-relaxed max-h-64 overflow-y-auto">
              <p className="font-bold text-amber-400">Ikuti 3 Langkah Sederhana Ini:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Buka di tab baru dashboard Supabase Anda.</li>
                <li>Pilih proyek Anda, lalu klik menu <strong className="text-white">"SQL Editor"</strong> di sebelah kiri.</li>
                <li>Klik tombol <strong className="text-white">"New Query"</strong>, tempel kode SQL berikut, lalu klik tombol <strong className="text-white">"Run"</strong> di kanan bawah.</li>
              </ol>
              <pre className="text-[11px] bg-slate-950 p-3 rounded border border-slate-800 text-[#8be9fd] overflow-x-auto select-all pt-2.5 font-semibold leading-relaxed">
{`CREATE TABLE IF NOT EXISTS status_siswa (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    nama TEXT NOT NULL,
    status TEXT NOT NULL
);

ALTER TABLE status_siswa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Akses Publik Status Siswa Seluruh Operasi" ON status_siswa 
    AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);`}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* QUICK STATUS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
        <div className="bg-emerald-50 border border-emerald-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 block">🟢 AKTIF DI PONDOK</span>
            <span className="text-2xl font-black text-emerald-900 mt-1 block">
              {students.filter(s => s.status === "Aktif").length} Santri
            </span>
          </div>
          <span className="text-3xl">🏡</span>
        </div>
        <div className="bg-amber-50 border border-amber-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 block">🟡 SAKIT / RAWAT</span>
            <span className="text-2xl font-black text-amber-900 mt-1 block">
              {students.filter(s => s.status === "Sakit").length} Santri
            </span>
          </div>
          <span className="text-3xl">🤒</span>
        </div>
        <div className="bg-rose-50 border border-rose-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-rose-600 block">🔴 PULANG / IZIN</span>
            <span className="text-2xl font-black text-rose-900 mt-1 block">
              {students.filter(s => s.status === "Pulang").length} Santri
            </span>
          </div>
          <span className="text-3xl">🎒</span>
        </div>
      </div>

      {/* MAIN STEPPED INTERACTION ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: THE INTERACTIVE STEP FORM (7 columns) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-[#104e7a] text-sm flex items-center gap-2 uppercase tracking-wider">
              <FileCheck className="w-4 h-4 text-[#104e7a]" /> Form Pembaruan Dokumen Perizinan
            </h3>
            <span className="text-[10px] font-black tracking-widest text-[#104e7a] bg-sky-50 px-2.5 py-1 rounded-full uppercase">
              Proses Cepat
            </span>
          </div>

          <div className="space-y-6">
            {/* STEP 1: CHOOSE BEDROOM / PILIH KAMAR */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                <span className="bg-sky-900 text-white w-5 h-5 text-[10px] font-black rounded-full flex items-center justify-center">1</span>
                PILIH KAMAR / ASRAMA
              </label>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allRooms.map((room) => {
                  const studentInRoomCount = students.filter(s => s.kamar === room).length;
                  const isSelected = selectedKamar === room;
                  return (
                    <button
                      key={room}
                      type="button"
                      onClick={() => {
                        setSelectedKamar(room);
                        setSelectedStudent(null); // Reset student context when room changes
                        setSelectedStatus("");
                      }}
                      className={`text-left p-3 rounded-2xl border text-xs leading-tight transition-all flex flex-col justify-between h-18 cursor-pointer select-none ${
                        isSelected 
                          ? "bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-300 font-bold" 
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span className="font-extrabold truncate block">{room}</span>
                      <span className={`text-[10px] mt-2 block font-medium ${isSelected ? "text-sky-600 font-bold" : "text-slate-400"}`}>
                        👥 {studentInRoomCount} Santri
                      </span>
                    </button>
                  );
                })}
                
                {/* Special Unassigned Group */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKamar("Belum Set");
                    setSelectedStudent(null);
                    setSelectedStatus("");
                  }}
                  className={`text-left p-3 rounded-2xl border text-xs leading-tight transition-all flex flex-col justify-between h-18 cursor-pointer select-none ${
                    selectedKamar === "Belum Set"
                      ? "bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-300 font-bold"
                      : "bg-slate-50 border-slate-200 hover:bg-rose-50/50 text-slate-700"
                  }`}
                >
                  <span className="font-extrabold truncate block">Belum Set Kamar</span>
                  <span className={`text-[10px] mt-2 block font-medium ${selectedKamar === "Belum Set" ? "text-sky-600 font-bold" : "text-slate-400"}`}>
                    👥 {students.filter(s => !s.kamar || s.kamar === "—").length} Santri
                  </span>
                </button>
              </div>
            </div>

            {/* STEP 2: CHOOSE STUDENT / PILIH NAMA SANTRI (Only available after Step 1) */}
            {selectedKamar && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <span className="bg-sky-900 text-white w-5 h-5 text-[10px] font-black rounded-full flex items-center justify-center">2</span>
                    PILIH NAMA SANTRI ({filteredStudents.length} tersedia)
                  </label>
                  
                  {/* Quick Filter Name Bar */}
                  <div className="relative w-full sm:w-56 shrink-0">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Cari nama..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-250 rounded-lg text-[11px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                    />
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <p className="text-xs text-slate-400 font-medium">Tidak ada santri yang cocok atau terdaftar di kamar ini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {filteredStudents.map((student) => {
                      const isSelected = selectedStudent?.nama_lengkap === student.nama_lengkap;
                      const statusColorClass = 
                        student.status === "Sakit" ? "bg-amber-100 text-amber-800" :
                        student.status === "Pulang" ? "bg-rose-100 text-rose-800" :
                        "bg-emerald-100 text-emerald-800";
                      
                      return (
                        <button
                          key={student.id || student.nik}
                          type="button"
                          onClick={() => {
                            setSelectedStudent(student);
                            setSelectedStatus(student.status || "Aktif");
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all cursor-pointer text-left select-none ${
                            isSelected 
                              ? "bg-emerald-50/50 border-emerald-400 text-slate-900 ring-2 ring-emerald-300 font-bold" 
                              : "bg-white border-slate-150 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {student.foto ? (
                              <img src={student.foto} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className="text-base">{student.jenis_kelamin === "P" ? "🧕" : "👳"}</span>
                            )}
                            <div className="min-w-0">
                              <span className="block font-bold truncate text-slate-800 leading-tight">{student.nama_lengkap}</span>
                              <span className="text-[10px] text-slate-400 truncate block mt-0.5">{student.kategori} | NIK: {student.nik}</span>
                            </div>
                          </div>
                          
                          {/* Right Icon Checkmark or Current Status */}
                          {isSelected ? (
                            <span className="bg-emerald-500 text-white rounded-full p-0.5">
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            </span>
                          ) : (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase font-mono shrink-0 ${statusColorClass}`}>
                              {student.status || "Aktif"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: SELECT PERMISSION STATUS (Only available after Step 2) */}
            {selectedStudent && (
              <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <span className="bg-sky-900 text-white w-5 h-5 text-[10px] font-black rounded-full flex items-center justify-center">3</span>
                  PILIH STATUS / PERIZINAN BARU
                </label>

                {/* Status Options Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* AKTIF */}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("Aktif")}
                    className={`p-4 rounded-2xl border text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-1.5 ${
                      selectedStatus === "Aktif"
                        ? "bg-emerald-500 text-white border-emerald-600 shadow-md font-bold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-emerald-50/20"
                    }`}
                  >
                    <span className="text-xs font-bold font-mono">AKTIF</span>
                  </button>

                  {/* SAKIT */}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("Sakit")}
                    className={`p-4 rounded-2xl border text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-1.5 ${
                      selectedStatus === "Sakit"
                        ? "bg-amber-500 text-white border-amber-600 shadow-md font-bold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-amber-50/20"
                    }`}
                  >
                    <span className="text-xs font-bold font-mono">SAKIT</span>
                  </button>

                  {/* PULANG */}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("Pulang")}
                    className={`p-4 rounded-2xl border text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-1.5 ${
                      selectedStatus === "Pulang"
                        ? "bg-rose-500 text-white border-rose-600 shadow-md font-bold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-rose-50/20"
                    }`}
                  >
                    <span className="text-xs font-bold font-mono">PULANG</span>
                  </button>
                </div>

                {/* SUBMIT BUTTON CONTROL */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveStatus}
                    className="w-full bg-[#104e7a] hover:bg-sky-800 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menyimpan Dokumen...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Simpan Status Baru perizinan untuk {selectedStudent.nama_lengkap}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: INFORMATION ACCENTS AND STATUS HISTORY (5 columns) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* QUICK DIRECTIVE INFO */}
          <div className="bg-sky-50 border border-sky-100 rounded-3xl p-5 space-y-3 shadow-inner select-none">
            <h4 className="font-extrabold text-[#104e7a] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" /> Alur Informasi
            </h4>
            <p className="text-[11px] text-[#104e7a] leading-relaxed font-semibold">
              Sistem perizinan sekarang dihubungkan langsung ke tabel terpisah <span className="font-mono bg-sky-200/50 px-1 py-0.5 rounded">status_siswa</span> untuk pembagian modul yang optimal. Data ini akan selalu disinkronisasikan ke dalam server cloud database secara otomatis.
            </p>
          </div>

          {/* LIST HISTORY LOGS OF STATUS_SISWA */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 select-none">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#104e7a] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#104e7a]" /> Riwayat Status_Siswa
              </span>
              <span className="bg-slate-100 text-slate-600 text-[9px] font-mono font-black rounded-lg px-2 py-0.5 uppercase">
                Cloud-sync
              </span>
            </div>

            {isLoadingHistory ? (
              <div className="text-center py-10 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
                <p className="text-[11px] text-slate-400 font-medium">Meload database cloud...</p>
              </div>
            ) : statusHistory.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-100 rounded-2xl">
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Belum ada pembaruan status baru di tabel status_siswa.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {statusHistory.map((row) => {
                  const sColor = 
                    row.status === "Sakit" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    row.status === "Pulang" ? "bg-rose-50 text-rose-700 border-rose-200" :
                    "bg-emerald-50 text-emerald-700 border-emerald-250";

                  return (
                    <div 
                      key={row.id || row.nama} 
                      className="p-3 bg-slate-50/50 border border-slate-150 rounded-xl flex items-center justify-between text-xs hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1 pr-2">
                        <span className="font-extrabold text-slate-800 tracking-wide block truncate">{row.nama}</span>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold">
                          <Clock className="w-3 h-3 text-slate-300" /> 
                          <span>{row.created_at ? new Date(row.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB" : "—"}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-black uppercase font-mono px-2 py-0.5 rounded border ${sColor}`}>
                          {row.status}
                        </span>
                        {row.id && (
                          <button
                            onClick={() => handleDeleteHistoryRow(row.id!, row.nama)}
                            className="text-slate-300 hover:text-red-500 cursor-pointer p-0.5 transition-all text-[11px]"
                            title="Hapus Log"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
