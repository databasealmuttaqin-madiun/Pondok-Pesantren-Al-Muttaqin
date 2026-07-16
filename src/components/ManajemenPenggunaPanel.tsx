import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Shield, User, Key, Check, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";

interface PenggunaData {
  id: string;
  username: string;
  nama: string;
  role: string;
  gender?: string;
  bagian?: string;
  jabatan?: string;
  tugas_kamar?: string;
  tugas_kelas_sekolah?: string;
  tugas_kelas_pengajian?: string;
  tugas_mapel?: string;
}

export default function ManajemenPenggunaPanel() {
  const [users, setUsers] = useState<PenggunaData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nama, setNama] = useState("");
  const [role, setRole] = useState("guru_pondok");
  const [gender, setGender] = useState("Semua");

  // Multi-selection states
  const [isPondok, setIsPondok] = useState(true);
  const [isSekolah, setIsSekolah] = useState(true);
  const [selectedJabatans, setSelectedJabatans] = useState<string[]>(["guru_pondok"]);
  
  const [tugasKamar, setTugasKamar] = useState("");
  const [tugasKelasSekolah, setTugasKelasSekolah] = useState("");
  const [tugasKelasPengajian, setTugasKelasPengajian] = useState("");
  const [tugasMapel, setTugasMapel] = useState("");

  // Master options lists
  const [optRooms, setOptRooms] = useState<string[]>([]);
  const [optSchoolClasses, setOptSchoolClasses] = useState<string[]>([]);
  const [optRecitationClasses, setOptRecitationClasses] = useState<string[]>([]);

  const roles = [
    { id: "admin", label: "Admin (Akses Penuh)" },
    { id: "guru_pondok", label: "Guru Pondok" },
    { id: "guru_sekolah", label: "Guru Sekolah" },
    { id: "pengurus", label: "Pengurus" }
  ];

  // Load plotting options on mount
  useEffect(() => {
    const loadOptions = async () => {
      const r = JSON.parse(localStorage.getItem("manajemen_rooms") || "[]");
      const s = JSON.parse(localStorage.getItem("manajemen_school_classes") || "[]");
      const p = JSON.parse(localStorage.getItem("manajemen_recitation_classes") || "[]");
      setOptRooms(r);
      setOptSchoolClasses(s);
      setOptRecitationClasses(p);

      try {
        const { data, error } = await supabase.from("plotting").select("jenis, nama");
        if (!error && data) {
          const roomsDb = data.filter((item: any) => item.jenis === "kamar").map((item: any) => item.nama);
          const schoolDb = data.filter((item: any) => item.jenis === "sekolah").map((item: any) => item.nama);
          const recitationDb = data.filter((item: any) => item.jenis === "pengajian").map((item: any) => item.nama);
          
          if (roomsDb.length > 0) setOptRooms(roomsDb);
          if (schoolDb.length > 0) setOptSchoolClasses(schoolDb);
          if (recitationDb.length > 0) setOptRecitationClasses(recitationDb);
        }
      } catch (err) {
        console.warn("Failed to load options from DB:", err);
      }
    };
    loadOptions();
  }, []);

  // Propose correct system role based on selected jabatans
  useEffect(() => {
    if (selectedJabatans.length > 0) {
      const hasSekolah = selectedJabatans.some(j => ["wali_kelas", "guru_mapel", "kepala_sekolah", "wakil_kepala_sekolah"].includes(j));
      const hasPondok = selectedJabatans.some(j => ["guru_pondok", "wali_kamar"].includes(j));
      
      if (hasSekolah) {
        setRole("guru_sekolah");
      } else if (hasPondok) {
        setRole("guru_pondok");
      }
    }
  }, [selectedJabatans]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const { data, error } = await supabase
        .from("pengguna")
        .select("*")
        .order("created_at", { ascending: false });
      
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      
      if (error) {
        console.warn("Custom columns missing or query failed, using fallback:", error.message);
        const { data: basicData, error: basicError } = await supabase
          .from("pengguna")
          .select("id, username, nama, role, gender")
          .order("created_at", { ascending: false });
        
        if (basicError) throw basicError;
        
        const merged = (basicData || []).map((u: any) => {
          const extra = localDetails[u.username] || {};
          return {
            ...u,
            bagian: extra.bagian || (u.role === "admin" ? "pondok,sekolah" : u.role === "guru_sekolah" ? "sekolah" : "pondok"),
            jabatan: extra.jabatan || (u.role === "admin" ? "pengurus" : u.role === "guru_sekolah" ? "guru_mapel" : "guru_pondok"),
            tugas_kamar: extra.tugas_kamar || "",
            tugas_kelas_sekolah: extra.tugas_kelas_sekolah || "",
            tugas_kelas_pengajian: extra.tugas_kelas_pengajian || "",
            tugas_mapel: extra.tugas_mapel || ""
          };
        });
        setUsers(merged);
      } else {
        const merged = (data || []).map((u: any) => {
          const extra = localDetails[u.username] || {};
          return {
            ...u,
            bagian: u.bagian || extra.bagian || (u.role === "admin" ? "pondok,sekolah" : u.role === "guru_sekolah" ? "sekolah" : "pondok"),
            jabatan: u.jabatan || extra.jabatan || (u.role === "admin" ? "pengurus" : u.role === "guru_sekolah" ? "guru_mapel" : "guru_pondok"),
            tugas_kamar: u.tugas_kamar || extra.tugas_kamar || "",
            tugas_kelas_sekolah: u.tugas_kelas_sekolah || extra.tugas_kelas_sekolah || "",
            tugas_kelas_pengajian: u.tugas_kelas_pengajian || extra.tugas_kelas_pengajian || "",
            tugas_mapel: u.tugas_mapel || extra.tugas_mapel || ""
          };
        });
        setUsers(merged);
      }
    } catch (err: any) {
      if (err.message?.includes("pengguna") && err.message?.includes("cache")) {
         setErrorMessage("Tabel 'pengguna' belum ada di Cloud Database. Silakan masuk ke menu 'Koneksi & Panduan' untuk menyalin script SQL terbaru dan jalankan di Supabase.");
      } else {
         console.warn("Gagal mengambil data pengguna:", err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openForm = (user?: PenggunaData) => {
    if (user) {
      setEditingId(user.id);
      setUsername(user.username);
      setPassword(""); // Don't fetch password, require new one if editing
      setNama(user.nama);
      setRole(user.role);
      setGender(user.gender || "Semua");
      
      const bag = user.bagian || "pondok,sekolah";
      if (bag === "kedua") {
        setIsPondok(true);
        setIsSekolah(true);
      } else {
        setIsPondok(bag.includes("pondok"));
        setIsSekolah(bag.includes("sekolah"));
      }

      const jab = user.jabatan || "guru_pondok";
      const rawJabs = jab.split(",").map(j => j.trim()).filter(Boolean);
      const mappedJList = rawJabs.map(j => {
        if (j === "guru pondok") return "guru_pondok";
        if (j === "guru mapel" || j === "guru mata pelajaran" || j === "guru_mapel") return "guru_mapel";
        if (j === "pamong kamar" || j === "wali kamar" || j === "wali_kamar") return "wali_kamar";
        if (j === "wali kelas" || j === "wali kelas sekolah" || j === "wali_kelas") return "wali_kelas";
        if (j === "kepala sekolah" || j === "kepala_sekolah") return "kepala_sekolah";
        if (j === "wakil kepala sekolah" || j === "wakil_kepala_sekolah") return "wakil_kepala_sekolah";
        return j;
      });
      setSelectedJabatans(mappedJList);

      setTugasKamar(user.tugas_kamar || "");
      setTugasKelasSekolah(user.tugas_kelas_sekolah || "");
      setTugasKelasPengajian(user.tugas_kelas_pengajian || "");
      setTugasMapel(user.tugas_mapel || "");
    } else {
      setEditingId(null);
      setUsername("");
      setPassword("");
      setNama("");
      setRole("guru_pondok");
      setGender("Semua");
      setIsPondok(true);
      setIsSekolah(true);
      setSelectedJabatans(["guru_pondok"]);
      setTugasKamar("");
      setTugasKelasSekolah("");
      setTugasKelasPengajian("");
      setTugasMapel("");
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !nama.trim()) return;
    
    // Require password for new user
    if (!editingId && !password.trim()) {
      alert("Password diperlukan untuk pengguna baru.");
      return;
    }

    try {
      setIsLoading(true);

      // Join multi-select values
      const bList: string[] = [];
      if (isPondok) bList.push("pondok");
      if (isSekolah) bList.push("sekolah");
      const finalBagian = bList.length > 0 ? bList.join(",") : "pondok,sekolah";

      const finalJabatan = selectedJabatans.join(",");
      
      const payload: any = {
        username: username.trim(),
        nama: nama.trim(),
        role: role,
        gender: gender,
        bagian: finalBagian,
        jabatan: finalJabatan,
        tugas_kamar: selectedJabatans.includes("wali_kamar") ? tugasKamar : "",
        tugas_kelas_sekolah: (selectedJabatans.includes("wali_kelas") || selectedJabatans.includes("guru_mapel")) ? tugasKelasSekolah : "",
        tugas_kelas_pengajian: selectedJabatans.includes("guru_pondok") ? tugasKelasPengajian : "",
        tugas_mapel: selectedJabatans.includes("guru_mapel") ? tugasMapel : ""
      };

      if (password.trim()) {
        payload.password = password;
      }

      // 1. Save copy to localStorage custom details map
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      localDetails[username.trim()] = {
        bagian: finalBagian,
        jabatan: finalJabatan,
        tugas_kamar: payload.tugas_kamar,
        tugas_kelas_sekolah: payload.tugas_kelas_sekolah,
        tugas_kelas_pengajian: payload.tugas_kelas_pengajian,
        tugas_mapel: payload.tugas_mapel
      };
      localStorage.setItem("user_additional_details", JSON.stringify(localDetails));

      // 2. Try saving to Supabase
      if (editingId) {
        const { error } = await supabase.from("pengguna").update(payload).eq("id", editingId);
        if (error) {
          console.warn("Update with custom columns failed, attempting basic update fallback:", error.message);
          const basicPayload = {
            username: username.trim(),
            nama: nama.trim(),
            role: role,
            gender: gender
          };
          if (password.trim()) {
            (basicPayload as any).password = password;
          }
          const { error: basicError } = await supabase.from("pengguna").update(basicPayload).eq("id", editingId);
          if (basicError) throw basicError;
        }
      } else {
        const { error } = await supabase.from("pengguna").insert([payload]);
        if (error) {
          console.warn("Insert with custom columns failed, attempting basic insert fallback:", error.message);
          const basicPayload = {
            username: username.trim(),
            nama: nama.trim(),
            role: role,
            gender: gender
          };
          if (password.trim()) {
            (basicPayload as any).password = password;
          }
          const { error: basicError } = await supabase.from("pengguna").insert([basicPayload]);
          if (basicError) throw basicError;
        }
      }

      await fetchUsers();
      closeForm();
    } catch (err: any) {
      alert("Gagal menyimpan pengguna: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, uname: string) => {
    if (!window.confirm(`Yakin ingin menghapus pengguna "${uname}"?`)) return;
    try {
      setIsLoading(true);
      const { error } = await supabase.from("pengguna").delete().eq("id", id);
      if (error) throw error;
      
      // Clean local storage copy as well
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      delete localDetails[uname];
      localStorage.setItem("user_additional_details", JSON.stringify(localDetails));

      await fetchUsers();
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const mapJabatanIdToLabel = (id: string) => {
    if (id === "guru_pondok") return "Guru Pondok";
    if (id === "guru_mapel") return "Guru Mata Pelajaran";
    if (id === "wali_kamar") return "Wali Kamar";
    if (id === "wali_kelas") return "Wali Kelas Sekolah";
    if (id === "kepala_sekolah") return "Kepala Sekolah";
    if (id === "wakil_kepala_sekolah") return "Wakil Kepala Sekolah";
    return id;
  };

  return (
    <div className="w-full pb-24 lg:pb-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#111322] border-b border-slate-200 dark:border-slate-800 px-6 py-6 rounded-t-3xl sm:rounded-3xl sm:shadow-sm sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800/50 shadow-inner">
            <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Manajemen Pengguna</h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Atur akun staf dan hak akses (Admin, Guru, Pengurus).</p>
          </div>
        </div>
        <button
          onClick={() => openForm()}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50 dark:bg-[#0a0c16]">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-500" />
                {editingId ? "Edit Pengguna" : "Tambah Pengguna Baru"}
              </h3>
              <button onClick={closeForm} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Username (ID Custom)</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Misal: satrio.guru"
                  className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Password {editingId && <span className="text-amber-500 font-normal normal-case tracking-normal">(Kosongkan jika tidak ingin mengubah)</span>}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password..."
                  className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama Lengkap Staf"
                  className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Bagian Tugas</label>
                <div className="flex gap-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPondok}
                      onChange={(e) => setIsPondok(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    Pondok (Kepesantrenan)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isSekolah}
                      onChange={(e) => setIsSekolah(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    Sekolah (Formal)
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Tugas / Jabatan (Bisa Pilih Lebih Dari Satu)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900">
                  {[
                    { id: "guru_pondok", label: "Guru Pondok" },
                    { id: "guru_mapel", label: "Guru Mata Pelajaran" },
                    { id: "wali_kamar", label: "Wali Kamar" },
                    { id: "wali_kelas", label: "Wali Kelas Sekolah" },
                    { id: "kepala_sekolah", label: "Kepala Sekolah" },
                    { id: "wakil_kepala_sekolah", label: "Wakil Kepala Sekolah" }
                  ].map(item => {
                    const checked = selectedJabatans.includes(item.id);
                    return (
                      <label key={item.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setSelectedJabatans(selectedJabatans.filter(j => j !== item.id));
                            } else {
                              setSelectedJabatans([...selectedJabatans, item.id]);
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        {item.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Duty Assignment Inputs */}
              {selectedJabatans.includes("guru_mapel") && (
                <div className="space-y-2 p-3.5 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-950/30 animate-in fade-in duration-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">Konfigurasi Guru Mapel</span>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Mata Pelajaran Apa?</label>
                    <input
                      type="text"
                      required
                      value={tugasMapel}
                      onChange={(e) => setTugasMapel(e.target.value)}
                      placeholder="Misal: Matematika, Fisika, PAI"
                      className="w-full text-xs font-bold leading-normal px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Di Kelas Berapa?</label>
                    <select
                      value={tugasKelasSekolah}
                      onChange={(e) => setTugasKelasSekolah(e.target.value)}
                      required
                      className="w-full text-xs font-bold leading-normal px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                    >
                      <option value="">-- Pilih Kelas Sekolah --</option>
                      {optSchoolClasses.map(sc => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {selectedJabatans.includes("wali_kelas") && !selectedJabatans.includes("guru_mapel") && (
                <div className="space-y-2 p-3.5 bg-blue-50/50 dark:bg-blue-950/10 rounded-2xl border border-blue-100/50 dark:border-blue-950/30 animate-in fade-in duration-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block">Konfigurasi Wali Kelas</span>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Tugas Kelas Sekolah</label>
                    <select
                      value={tugasKelasSekolah}
                      onChange={(e) => setTugasKelasSekolah(e.target.value)}
                      required
                      className="w-full text-xs font-bold leading-normal px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                    >
                      <option value="">-- Pilih Kelas Sekolah --</option>
                      {optSchoolClasses.map(sc => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {selectedJabatans.includes("wali_kamar") && (
                <div className="space-y-2 p-3.5 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-950/30 animate-in fade-in duration-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Konfigurasi Wali Kamar</span>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Tugas Kamar Santri</label>
                    <select
                      value={tugasKamar}
                      onChange={(e) => setTugasKamar(e.target.value)}
                      required
                      className="w-full text-xs font-bold leading-normal px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                    >
                      <option value="">-- Pilih Kamar --</option>
                      {optRooms.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {selectedJabatans.includes("guru_pondok") && (
                <div className="space-y-2 p-3.5 bg-purple-50/50 dark:bg-purple-950/10 rounded-2xl border border-purple-100/50 dark:border-purple-950/30 animate-in fade-in duration-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Konfigurasi Guru Pondok</span>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Tugas Kelas Pengajian / Pondok</label>
                    <select
                      value={tugasKelasPengajian}
                      onChange={(e) => setTugasKelasPengajian(e.target.value)}
                      className="w-full text-xs font-bold leading-normal px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                    >
                      <option value="">-- Pilih Kelas Pengajian --</option>
                      {optRecitationClasses.map(rc => (
                        <option key={rc} value={rc}>{rc}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Role / Akses Sistem</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Batasi Akses Santri (Gender)</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full text-xs font-bold leading-normal px-4 py-3 bg-[#f8fafc] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-all shadow-inner"
                >
                  <option value="Semua">Semua Santri (Bisa akses L & P)</option>
                  <option value="L">Khusus Santri Putra (Laki-laki)</option>
                  <option value="P">Khusus Santri Putri (Perempuan)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-850">
                <button type="button" onClick={closeForm} className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  Batal
                </button>
                <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2">
                  {isLoading ? "Menyimpan..." : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white dark:bg-[#111322] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/50 min-h-[400px]">
        {errorMessage ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-xl text-xs flex flex-col gap-2 relative">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1">Akses Tabel Gagal</strong>
                {errorMessage}
              </div>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-slate-400 select-none flex flex-col items-center justify-center space-y-4">
            <Shield className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">Belum Ada Pengguna</h4>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              Anda belum menambahkan akun pengguna lain selain admin utama. Silakan tambahkan pengguna baru.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(user => (
              <div key={user.id} className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 transition-colors relative group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{user.nama}</div>
                      <div className="text-[10px] font-bold text-slate-500">@{user.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openForm(user)} className="p-1.5 bg-slate-200 hover:bg-sky-500 dark:bg-slate-800 dark:hover:bg-sky-600 text-slate-600 hover:text-white dark:text-slate-300 rounded-lg transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(user.id, user.username)} className="p-1.5 bg-slate-200 hover:bg-red-500 dark:bg-slate-800 dark:hover:bg-red-600 text-slate-600 hover:text-white dark:text-slate-300 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bagian, Jabatan, and Tugas Details Panel */}
                <div className="text-xs font-semibold text-slate-650 dark:text-slate-300 space-y-1.5 border-t border-dashed border-slate-200 dark:border-slate-800/80 pt-3 mt-1">
                  <div className="flex justify-between items-start text-[11px] gap-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Bagian:</span>
                    <span className="font-black text-slate-700 dark:text-slate-200 capitalize bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-right">
                      {(() => {
                        const bags = [];
                        if (user.bagian?.includes("pondok") || user.bagian === "kedua") bags.push("Pondok");
                        if (user.bagian?.includes("sekolah") || user.bagian === "kedua") bags.push("Sekolah");
                        return bags.length > 0 ? bags.join(" & ") : "-";
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-[11px] gap-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Jabatan:</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md text-right max-w-[180px] break-all">
                      {user.jabatan ? user.jabatan.split(",").map(mapJabatanIdToLabel).join(", ") : "-"}
                    </span>
                  </div>

                  {user.tugas_mapel && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Mapel Diajar:</span>
                      <span className="font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_mapel}
                      </span>
                    </div>
                  )}

                  {user.tugas_kamar && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Tugas Kamar:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_kamar}
                      </span>
                    </div>
                  )}
                  {user.tugas_kelas_sekolah && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Kelas (Sekolah):</span>
                      <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_kelas_sekolah}
                      </span>
                    </div>
                  )}
                  {user.tugas_kelas_pengajian && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Kelas (Pondok):</span>
                      <span className="font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_kelas_pengajian}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="flex gap-2">
                    <div className="text-[10px] font-black px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md uppercase tracking-wider">
                      {roles.find(r => r.id === user.role)?.label || user.role}
                    </div>
                    {user.gender && user.gender !== 'Semua' && (
                      <div className="text-[10px] font-black px-2 py-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 rounded-md uppercase tracking-wider">
                        {user.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    Custom Auth
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
