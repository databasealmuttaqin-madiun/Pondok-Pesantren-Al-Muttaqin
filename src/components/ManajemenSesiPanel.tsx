import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Clock, AlertCircle, CheckCircle2, CalendarDays } from "lucide-react";
import { supabase } from "../supabaseClient";

export interface SessionInfo {
  id: string;
  label: string;
  time: string;
  icon?: string;
}

export default function ManajemenSesiPanel() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  // Form Fields
  const [namaSesi, setNamaSesi] = useState("");
  const [jamMulai, setJamMulai] = useState("08:00");
  const [jamSelesai, setJamSelesai] = useState("09:00");
  const [ikonSesi, setIkonSesi] = useState("⏰");

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
          icon: d.ikon || "⏰"
        }));
        setSessions(loadedSessions);
        localStorage.setItem("santri_absensi_sessions", JSON.stringify(loadedSessions));
      } else {
        // Fallback to defaults or local if empty
        const saved = localStorage.getItem("santri_absensi_sessions");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.length > 0) setSessions(parsed);
          } catch(e) {}
        }
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
    setIkonSesi("⏰");
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
        setJamMulai(start);
        setJamSelesai(end);
      }
    } catch (e) {
      // Use defaults if format is weird
      setJamMulai("08:00");
      setJamSelesai("09:00");
    }
    
    setIkonSesi(sess.icon || "⏰");
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, label: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus sesi "${label}"?`)) {
      try {
        setIsLoading(true);
        // Supabase DB modification
        // If id is numeric it means it comes from DB, but we pass toString() 
        // We actually map "sesi" to identify because user uses id.toString()
        const isNumeric = !isNaN(Number(id)) && String(id).trim() !== "";
        if (isNumeric) {
          const { error } = await supabase.from('sesi_absensi').delete().eq('id', Number(id));
          if (error) throw error;
        } else {
          // If it was fallback local session id, try delete by 'sesi' label
          const { error } = await supabase.from('sesi_absensi').delete().eq('sesi', label);
          if (error) throw error;
        }

        const updated = sessions.filter(s => s.id !== id);
        setSessions(updated);
        localStorage.setItem("santri_absensi_sessions", JSON.stringify(updated));
      } catch (err) {
        console.warn(err);
        alert("Gagal menghapus sesi. Pastikan izin database diatur dengan benar.");
      } finally {
        setIsLoading(false);
      }
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
          ikon: ikonSesi
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
          ikon: ikonSesi
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

  const emojis = ["🌅", "🌞", "☀️", "🌤️", "🌇", "🌌", "🌙", "🍽️", "🍳", "🍛", "🍲", "⏰", "📖", "🕌", "🧕", "👳", "💬", "✏️", "🎒"];

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 space-y-6 flex flex-col items-stretch" id="session_management_root_container">
      
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

      {isFormOpen && (
        <form 
          onSubmit={handleSubmit} 
          className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-lg space-y-5 animate-fade-in relative overflow-hidden"
          id="session_form"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-[#3e46ca]"></div>
          
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>{editingSessionId ? "Edit Konfigurasi Sesi" : "Tambah Sesi Absensi Baru"}</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 font-extrabold text-xs bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer"
            >
              Batal ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Nama Sesi
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Kajian Sore, Ba'da Subuh, dll"
                value={namaSesi}
                onChange={(e) => setNamaSesi(e.target.value)}
                className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white transition-all shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ikon Sesi
              </label>
              <div className="flex flex-wrap gap-1 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-2xl max-h-[110px] overflow-y-auto">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIkonSesi(emoji)}
                    className={`text-lg p-1.5 rounded-lg transition-transform hover:scale-125 cursor-pointer ${
                      ikonSesi === emoji ? "bg-indigo-100 border border-indigo-200 scale-110" : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
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
                className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white transition-all shadow-inner"
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
                className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-850 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className={`bg-[#22c55e] hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isLoading ? "Menyimpan..." : "Simpan Sesi"}</span>
            </button>
          </div>
        </form>
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
          <div className="py-12 text-center text-slate-400 select-none flex flex-col items-center justify-center space-y-2">
            <div className="text-4xl">🕰️</div>
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Belum Ada Sesi</h4>
            <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
              Daftar sesi absensi kosong. Silakan tambah sesi baru untuk memulainya di menu absensi santri.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="sessions_grid">
            {sessions.map((sess) => (
              <div 
                key={sess.id}
                className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-100/50 dark:hover:bg-slate-800_30 border border-slate-150/40 dark:border-slate-800 rounded-2xl p-4.5 flex items-center justify-between gap-3 shadow-3xs transition-all relative overflow-hidden group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-2xl shadow-3xs border border-indigo-100 dark:border-indigo-900 shrink-0">
                    {sess.icon || "⏰"}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 dark:text-white text-base leading-snug">
                      {sess.label}
                    </h4>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-450 tracking-wider block mt-1 uppercase flex items-center gap-1">
                      <Clock className="w-3 w-3 stroke-[2.5]" />
                      <span>{sess.time} WIB</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 select-none opacity-85 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenEdit(sess)}
                    className="p-2 text-slate-500 hover:text-indigo-650 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 rounded-xl transition-all cursor-pointer"
                    title="Edit Sesi"
                  >
                    <Edit3 className="w-4 h-4 stroke-[2.2]" />
                  </button>
                  <button
                    onClick={() => handleDelete(sess.id, sess.label)}
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

      <div className="flex items-center justify-between text-[9px] text-slate-405 font-bold select-none py-1 border-t border-slate-100 dark:border-slate-850 uppercase tracking-widest mt-2" id="session_mgr_footer">
        <span>SESSION SETUP ACTIVE</span>
        <span>AL MUTTAQIN V1</span>
      </div>
    </div>
  );
}
