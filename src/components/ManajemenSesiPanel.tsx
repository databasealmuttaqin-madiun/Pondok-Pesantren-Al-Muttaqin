import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Clock, AlertCircle, CheckCircle2, CalendarDays } from "lucide-react";
import { supabase } from "../supabaseClient";

export interface SessionInfo {
  id: string;
  label: string;
  time: string;
  icon?: string;
  presensi?: string;
}

export default function ManajemenSesiPanel() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<SessionInfo | null>(null);

  // Form Fields
  const [namaSesi, setNamaSesi] = useState("");
  const [jamMulai, setJamMulai] = useState("08:00");
  const [jamSelesai, setJamSelesai] = useState("09:00");
  const [jenisPresensi, setJenisPresensi] = useState("ngaji"); // default value

  const [isLoading, setIsLoading] = useState(false);

  // Load from Supabase (or fallback to local)
  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("sesi_absensi").select("*").order("jam mulai", { ascending: true });
      
      if (error) throw error;

      if (data && data.length > 0) {
        const loadedSessions = data.map((d: any) => ({
          id: d.id ? d.id.toString() : d.sesi.replace(/\s/g, "_"),
          label: d.sesi,
          time: `${String(d["jam mulai"]).replace(":", ".")} - ${String(d["jam selesai"]).replace(":", ".")}`,
          icon: d.ikon || "⏰",
          presensi: d.presensi || "ngaji"
        }));
        setSessions(loadedSessions);
        localStorage.setItem("santri_absensi_sessions", JSON.stringify(loadedSessions));
      } else {
        // Table is empty. We respect the empty state.
        setSessions([]);
        localStorage.setItem("santri_absensi_sessions", JSON.stringify([]));
      }
    } catch (err: any) {
      console.warn("Gagal mengambil tabel sesi_absensi:", err.message);
      // Fallback
      const saved = localStorage.getItem("santri_absensi_sessions");
      if (saved) {
        try { setSessions(JSON.parse(saved)); } catch(e) {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    const channel = supabase.channel('sesi-absensi-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesi_absensi' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, []);

  const handleOpenAdd = () => {
    setEditingSessionId(null);
    setNamaSesi("");
    setJamMulai("08:00");
    setJamSelesai("09:00");
    setJenisPresensi("ngaji");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sess: SessionInfo) => {
    setEditingSessionId(sess.id);
    setNamaSesi(sess.label);
    
    // Parse time, e.g., "04.00 - 10.00" -> ["04:00", "10:00"]
    try {
      const cleanTime = sess.time.replace(/\./g, ":");
      const [start, end] = cleanTime.replace(/\s/g, "").split("-");
      if (start && end) {
        setJamMulai(start.slice(0, 5));
        setJamSelesai(end.slice(0, 5));
      }
    } catch (e) {
      // Use defaults if format is weird
      setJamMulai("08:00");
      setJamSelesai("09:00");
    }
    
    setJenisPresensi(sess.presensi || "ngaji");
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = (sess: SessionInfo) => {
    setSessionToDelete(sess);
  };

  const executeDelete = async () => {
    if (!sessionToDelete) return;
    const { id, label } = sessionToDelete;

    try {
      setIsLoading(true);
      const isNumeric = !isNaN(Number(id)) && String(id).trim() !== "";
      
      let supabaseErr;
      if (isNumeric) {
        const { error } = await supabase.from('sesi_absensi').delete().eq('id', Number(id));
        supabaseErr = error;
      } else {
        const { error } = await supabase.from('sesi_absensi').delete().eq('sesi', label);
        supabaseErr = error;
      }

      if (supabaseErr) throw supabaseErr;

      const updated = sessions.filter(s => s.id !== id);
      setSessions(updated);
      localStorage.setItem("santri_absensi_sessions", JSON.stringify(updated));
      setSessionToDelete(null);
    } catch (err: any) {
      console.warn(err);
      alert("Gagal menghapus sesi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaSesi.trim()) return;

    // Use standard format 'HH:mm' for database for jam mulai and jam selesai!
    // We already have jamMulai and jamSelesai in HH:mm from input type="time"
    try {
      setIsLoading(true);
      if (editingSessionId) {
        // Edit Mode
        const isNumeric = !isNaN(Number(editingSessionId)) && String(editingSessionId).trim() !== "";
        const payload = {
          sesi: namaSesi.trim(),
          "jam mulai": jamMulai,
          "jam selesai": jamSelesai,
          ikon: "⏰",
          presensi: jenisPresensi
        };

        let supabaseErr;
        if (isNumeric) {
          const { error } = await supabase.from("sesi_absensi").update(payload).eq("id", Number(editingSessionId));
          supabaseErr = error;
        } else {
          const { error } = await supabase.from("sesi_absensi").update(payload).eq("sesi", namaSesi.trim()); // Fallback best effort
          supabaseErr = error;
        }
        
        if (supabaseErr) throw supabaseErr;
        await fetchSessions(); // refresh completely
      } else {
        // Add Mode
        const payload = {
          sesi: namaSesi.trim(),
          "jam mulai": jamMulai,
          "jam selesai": jamSelesai,
          ikon: "⏰",
          presensi: jenisPresensi
        };

        const { error } = await supabase.from("sesi_absensi").insert([payload]);
        if (error) throw error;
        await fetchSessions();
      }
      setIsFormOpen(false);
    } catch (error: any) {
      console.warn(error);
      alert("Gagal menyimpan ke database cloud: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full py-6 px-4 space-y-6 flex flex-col items-stretch" id="session_management_root_container">
      
      {/* HEADER COHESIVE BRANDING */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none border-b border-slate-100 dark:border-slate-800 pb-4" id="session_mgr_header">
        <div>
          <h2 className="text-3xl font-black text-[#1d2757] dark:text-white font-display tracking-tight leading-none">
            Manajemen Sesi Absensi
          </h2>
          <p className="text-xs text-[#566580] dark:text-slate-400 font-bold mt-2 flex items-center gap-1.5 uppercase tracking-wide">
            <span>Pondok Pesantren</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
            <span className="text-blue-600 dark:text-blue-400">Al Muttaqin</span>
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-[#3e46ca] hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all transform active:scale-95 cursor-pointer leading-none"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Tambah Sesi</span>
        </button>
      </div>

      {/* FORM OVERLAY MODAL */}
      {isFormOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm z-[100] transition-all"
          onClick={() => setIsFormOpen(false)}
        >
          <div 
            className="w-full max-w-xl bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up z-50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-[#3e46ca] w-full shrink-0"></div>
            
            <form 
              onSubmit={handleSubmit} 
              className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[85vh] relative"
              id="session_form"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <span>{editingSessionId ? "Edit Konfigurasi Sesi" : "Tambah Sesi Absensi Baru"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-slate-400 hover:text-rose-500 font-extrabold text-xs"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Nama Sesi
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kajian Sore, Ba'da Subuh, dll"
                    value={namaSesi}
                    onChange={(e) => setNamaSesi(e.target.value)}
                    className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:bg-white dark:focus:border-[#3e46ca] text-slate-800 dark:text-white transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={jamMulai}
                    onChange={(e) => setJamMulai(e.target.value)}
                    className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:bg-white dark:focus:border-[#3e46ca] text-slate-800 dark:text-white transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    required
                    value={jamSelesai}
                    onChange={(e) => setJamSelesai(e.target.value)}
                    className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:bg-white dark:focus:border-[#3e46ca] text-slate-800 dark:text-white transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Jenis Presensi
                  </label>
                  <select
                    value={jenisPresensi}
                    onChange={(e) => setJenisPresensi(e.target.value)}
                    className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:bg-white dark:focus:border-[#3e46ca] text-slate-800 dark:text-white transition-all shadow-inner cursor-pointer"
                  >
                    <option value="makan">Makan</option>
                    <option value="sholat">Sholat</option>
                    <option value="ngaji">Ngaji</option>
                    <option value="doa malam">Doa Malam</option>
                    <option value="sekolah">Sekolah</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-3 text-xs font-extrabold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`bg-[#22c55e] hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all w-full sm:w-auto ${isLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isLoading ? "Menyimpan..." : "Simpan Sesi"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SESSIONS LIST */}
      <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-extrabold text-[#111827] dark:text-white font-display border-b border-slate-50 dark:border-slate-800 pb-2 flex items-center justify-between">
          <span>Daftar Sesi Aktif</span>
          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 px-3 py-1 rounded-full uppercase tracking-wider font-extrabold">
            {sessions.length} Sesi Terkonfigurasi
          </span>
        </h3>

        {sessions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 select-none flex flex-col items-center justify-center space-y-4">
            <div className="text-4xl">🕰️</div>
            <div>
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">Belum Ada Sesi</h4>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Daftar sesi absensi kosong. Silakan tambah sesi baru untuk memulainya di menu absensi santri.
              </p>
            </div>
            
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("Muat sesi bawaan dari sistem? (Subuh, Dzuhur, Asar, dll)")) return;
                try {
                  setIsLoading(true);
                  const defaultPayloads = [
                    { sesi: "Subuh", "jam mulai": "04:00", "jam selesai": "10:00", ikon: "🌅", presensi: "sholat" },
                    { sesi: "Dzuhur", "jam mulai": "11:30", "jam selesai": "12:30", ikon: "☀️", presensi: "sholat" },
                    { sesi: "Asar", "jam mulai": "14:50", "jam selesai": "15:30", ikon: "🌤️", presensi: "sholat" },
                    { sesi: "Maghrib", "jam mulai": "17:20", "jam selesai": "18:00", ikon: "🌇", presensi: "sholat" },
                    { sesi: "Isya", "jam mulai": "18:40", "jam selesai": "19:30", ikon: "🌌", presensi: "sholat" },
                    { sesi: "Doa Malam", "jam mulai": "03:30", "jam selesai": "04:15", ikon: "🌌", presensi: "doa malam" },
                    { sesi: "Makan Pagi", "jam mulai": "06:00", "jam selesai": "07:15", ikon: "🍳", presensi: "makan" },
                    { sesi: "Makan Siang", "jam mulai": "11:00", "jam selesai": "12:00", ikon: "🍛", presensi: "makan" },
                    { sesi: "Makan Sore", "jam mulai": "16:30", "jam selesai": "17:15", ikon: "🍲", presensi: "makan" }
                  ];
                  await supabase.from("sesi_absensi").insert(defaultPayloads);
                  await fetchSessions();
                } catch (err: any) {
                  alert("Gagal menambahkan sesi bawaan: " + err.message);
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className={`mt-2 px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all flex items-center justify-center gap-2 ${isLoading ? 'opacity-50' : 'cursor-pointer active:scale-95'}`}
            >
              ✨ Muat Sesi Bawaan Sistem
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="sessions_grid">
            {sessions.map((sess) => (
              <div 
                key={sess.id}
                className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/50 dark:hover:bg-slate-800_30 border border-slate-150/40 dark:border-slate-800 rounded-2xl p-4.5 flex items-center justify-between gap-3 shadow-3xs transition-all relative overflow-hidden group"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <h4 className="font-extrabold text-slate-800 dark:text-white text-base leading-snug">
                      {sess.label}
                    </h4>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-450 tracking-wider block mt-1 uppercase flex items-center gap-1">
                      <Clock className="w-3 h-3 stroke-[2.5]" />
                      <span>{sess.time} WIB</span>
                      {sess.presensi && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="text-indigo-500 font-bold">{sess.presensi}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 select-none opacity-85 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(sess)}
                    className="p-2 text-slate-500 hover:text-indigo-650 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 rounded-xl transition-all cursor-pointer"
                    title="Edit Sesi"
                  >
                    <Edit3 className="w-4 h-4 stroke-[2.2]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(sess)}
                    className="p-2 text-slate-500 hover:text-rose-650 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 border border-slate-200 dark:border-slate-700 hover:border-rose-200 rounded-xl transition-all cursor-pointer"
                    title="Hapus Sesi"
                  >
                    <Trash2 className="w-4 h-4 stroke-[2.2]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {sessionToDelete && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm z-[100] transition-all animate-fade-in"
          onClick={() => setSessionToDelete(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up z-50 flex flex-col p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-500 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-450" />
              </div>
              <h3 className="text-base font-black text-slate-850 dark:text-white">
                Konfirmasi Hapus Sesi
              </h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-350 font-medium leading-relaxed">
              Apakah Anda yakin ingin menghapus sesi <span className="font-extrabold text-slate-800 dark:text-white">"{sessionToDelete.label}"</span>? 
              Tindakan ini akan menghapus opsi sesi ini dari daftar presensi harian santri secara permanen.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 select-none">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2.5 text-xs font-extrabold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                BATAL
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={executeDelete}
                className={`bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
              >
                <span>{isLoading ? "Menghapus..." : "Ya, Hapus Sesi"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[9px] text-slate-405 font-bold select-none py-1 border-t border-slate-100 dark:border-slate-850 uppercase tracking-widest mt-2" id="session_mgr_footer">
        <span>SESSION SETUP ACTIVE</span>
        <span>AL MUTTAQIN V1</span>
      </div>
    </div>
  );
}
