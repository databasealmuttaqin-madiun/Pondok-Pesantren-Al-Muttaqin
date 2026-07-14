import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Shield, User, Key, Check, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";

interface PenggunaData {
  id: string;
  username: string;
  nama: string;
  role: string;
  gender?: string;
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

  const roles = [
    { id: "admin", label: "Admin (Akses Penuh)" },
    { id: "guru_pondok", label: "Guru Pondok" },
    { id: "guru_sekolah", label: "Guru Sekolah" },
    { id: "pengurus", label: "Pengurus" }
  ];

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const { data, error } = await supabase.from("pengguna").select("id, username, nama, role, gender").order("created_at", { ascending: false });
      if (error) throw error;
      setUsers(data || []);
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
    } else {
      setEditingId(null);
      setUsername("");
      setPassword("");
      setNama("");
      setRole("guru_pondok");
      setGender("Semua");
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
      
      const payload: any = {
        username: username.trim(),
        nama: nama.trim(),
        role: role,
        gender: gender
      };

      if (password.trim()) {
        payload.password = password; // Should hash ideally, but plain text for simplicity as requested
      }

      if (editingId) {
        const { error } = await supabase.from("pengguna").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pengguna").insert([payload]);
        if (error) throw error;
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
      await fetchUsers();
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    } finally {
      setIsLoading(false);
    }
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

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Role / Akses</label>
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

              <div className="pt-4 flex justify-end gap-3">
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
