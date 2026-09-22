import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { BookOpen, Book, Plus, Edit2, Trash2, Search, X, Check, BookMarked, Save } from "lucide-react";
import { showSuccess, showError, showWarning, showToast, showDeleteConfirm } from "../utils/sweetalert";

export interface MateriPengajian {
  id: number;
  kelompok: "alquran" | "himpunan";
  nama_materi: string;
  jumlah_halaman: number;
  urutan: number;
  created_at?: string;
}

interface ManajemenMateriPanelProps {
  currentUserRole?: string;
  onTriggerNotification?: (message: string, type: "success" | "error" | "warning") => void;
}

export default function ManajemenMateriPanel({ currentUserRole = "viewer", onTriggerNotification }: ManajemenMateriPanelProps) {
  const [materi, setMateri] = useState<MateriPengajian[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"alquran" | "himpunan">("alquran");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MateriPengajian | null>(null);
  
  // Form State
  const [formKelompok, setFormKelompok] = useState<"alquran" | "himpunan">("alquran");
  const [formNama, setFormNama] = useState("");
  const [formHalaman, setFormHalaman] = useState<number>(0);
  const [formUrutan, setFormUrutan] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isAdmin = currentUserRole.toLowerCase().includes("admin");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("materi_pengajian")
        .select("*")
        .order("urutan", { ascending: true });
        
      if (error) throw error;
      setMateri(data || []);
    } catch (err: any) {
      console.error(err);
      if (onTriggerNotification) onTriggerNotification("Gagal memuat data materi: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (item?: MateriPengajian) => {
    if (item) {
      setEditingItem(item);
      setFormKelompok(item.kelompok);
      setFormNama(item.nama_materi);
      setFormHalaman(item.jumlah_halaman);
      setFormUrutan(item.urutan);
    } else {
      setEditingItem(null);
      setFormKelompok(activeTab);
      setFormNama("");
      setFormHalaman(0);
      // Auto-increment urutan based on existing
      const existingInTab = materi.filter(m => m.kelompok === activeTab);
      const maxUrut = existingInTab.length > 0 ? Math.max(...existingInTab.map(m => m.urutan)) : 0;
      setFormUrutan(maxUrut + 1);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      showWarning("Nama Materi Diperlukan", "Nama materi wajib diisi");
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("materi_pengajian")
          .update({
            kelompok: formKelompok,
            nama_materi: formNama.trim(),
            jumlah_halaman: formHalaman,
            urutan: formUrutan
          })
          .eq("id", editingItem.id);
          
        if (error) throw error;
        showSuccess("Berhasil", `Materi "${formNama}" berhasil diperbarui.`);
      } else {
        const { error } = await supabase
          .from("materi_pengajian")
          .insert({
            kelompok: formKelompok,
            nama_materi: formNama.trim(),
            jumlah_halaman: formHalaman,
            urutan: formUrutan
          });
          
        if (error) throw error;
        showSuccess("Berhasil", `Materi "${formNama}" berhasil ditambahkan.`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menyimpan", err.message || "Terjadi kesalahan saat menyimpan materi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    const isConfirmed = await showDeleteConfirm(`materi "${nama}"`);
    if (!isConfirmed) return;
    
    try {
      const { error } = await supabase.from("materi_pengajian").delete().eq("id", id);
      if (error) throw error;
      
      showToast(`Materi "${nama}" berhasil dihapus`, "success");
      loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menghapus", err.message || "Terjadi kesalahan saat menghapus materi.");
    }
  };

  const filteredMateri = materi
    .filter(m => m.kelompok === activeTab)
    .filter(m => m.nama_materi.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.urutan - b.urutan);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookMarked className="w-6 h-6 text-indigo-500" />
              Master Materi Pengajian
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Kelola daftar Al-Qur'an dan Kitab Himpunan beserta jumlah halamannya
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Materi</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER & TABS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs flex flex-col sm:flex-row items-center gap-4">
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("alquran")}
            className={`flex-1 sm:w-32 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "alquran" 
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs" 
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Al-Qur'an
          </button>
          <button
            onClick={() => setActiveTab("himpunan")}
            className={`flex-1 sm:w-40 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "himpunan" 
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs" 
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Book className="w-4 h-4" />
            Himpunan
          </button>
        </div>

        <div className="relative flex-1 w-full sm:px-2">
          <div className="absolute inset-y-0 left-3 sm:left-5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama materi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* LIST CONTENT */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Memuat data...</div>
        ) : filteredMateri.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <BookMarked className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Tidak Ada Data</h3>
            <p className="text-slate-500 text-sm">
              Belum ada materi {activeTab === "alquran" ? "Al-Qur'an" : "Kitab Himpunan"} yang ditambahkan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 w-16 text-center">Urutan</th>
                  <th className="py-3 px-4">Nama Materi</th>
                  <th className="py-3 px-4 text-center">Jml. Halaman</th>
                  {isAdmin && <th className="py-3 px-4 text-center w-24">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMateri.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center mx-auto">
                        {item.urutan}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {item.nama_materi}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                        {item.kelompok === "alquran" ? "Al-Qur'an" : "Kitab Himpunan"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                        {item.jumlah_halaman} Halaman
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.nama_materi)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                {editingItem ? <Edit2 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
                {editingItem ? "Edit Materi" : "Tambah Materi Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kategori
                </label>
                <div className="flex gap-3">
                  <label className="flex-1 flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <input 
                      type="radio" 
                      name="kelompok"
                      value="alquran"
                      checked={formKelompok === "alquran"}
                      onChange={() => setFormKelompok("alquran")}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">Al-Qur'an</span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <input 
                      type="radio" 
                      name="kelompok"
                      value="himpunan"
                      checked={formKelompok === "himpunan"}
                      onChange={() => setFormKelompok("himpunan")}
                      className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">Himpunan</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Materi
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={e => setFormNama(e.target.value)}
                  placeholder="Misal: Juz 1 atau Kitab Shalat"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Urutan
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formUrutan}
                    onChange={e => setFormUrutan(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Jml. Halaman
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formHalaman}
                    onChange={e => setFormHalaman(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingItem ? "Simpan Perubahan" : "Tambahkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
