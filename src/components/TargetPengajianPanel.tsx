import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Target, Plus, Edit2, Trash2, Search, X, Calendar, Filter, Save, BookOpen } from "lucide-react";
import { SearchableSelect } from "./ui/SearchableSelect";
import { showSuccess, showError, showWarning, showToast, showDeleteConfirm } from "../utils/sweetalert";

export interface TargetPengajian {
  id: number;
  kelas_pengajian: string;
  materi_id: number;
  tanggal: string;
  pertemuan_ke: number;
  target_halaman_mulai: number;
  target_halaman_selesai: number;
  materi_pengajian?: {
    nama_materi: string;
    kelompok: string;
    jumlah_halaman: number;
  };
}

interface MateriItem {
  id: number;
  nama_materi: string;
  kelompok: string;
  jumlah_halaman: number;
}

interface TargetPengajianPanelProps {
  currentUserRole?: string;
  userTugasTambahan?: string[];
  recitationClasses: string[];
  onTriggerNotification?: (message: string, type: "success" | "error" | "warning") => void;
}

export default function TargetPengajianPanel({ 
  currentUserRole = "viewer", 
  userTugasTambahan = [],
  recitationClasses = [],
  onTriggerNotification 
}: TargetPengajianPanelProps) {
  const [targets, setTargets] = useState<TargetPengajian[]>([]);
  const [materiList, setMateriList] = useState<MateriItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters
  const [filterKelas, setFilterKelas] = useState("All");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TargetPengajian | null>(null);
  
  // Form State
  const [formKelas, setFormKelas] = useState("");
  const [formMateriId, setFormMateriId] = useState<number>(0);
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [formPertemuanKe, setFormPertemuanKe] = useState<number>(1);
  const [formHalMulai, setFormHalMulai] = useState<number>(1);
  const [formHalSelesai, setFormHalSelesai] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const roleLower = currentUserRole.toLowerCase();
  const isAdminOrPengurus = roleLower.includes("admin") || roleLower.includes("super admin") || 
                            userTugasTambahan.some(t => t.toLowerCase().includes("pengasuh") || t.toLowerCase().includes("pamong") || t.toLowerCase().includes("pondok"));

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Materi for Dropdowns
      const { data: dataMateri, error: errMateri } = await supabase
        .from("materi_pengajian")
        .select("id, nama_materi, kelompok, jumlah_halaman")
        .order("urutan", { ascending: true });
        
      if (errMateri) throw errMateri;
      setMateriList(dataMateri || []);

      // 2. Fetch Targets with relations
      const { data: dataTarget, error: errTarget } = await supabase
        .from("target_pengajian")
        .select(`
          *,
          materi_pengajian (nama_materi, kelompok, jumlah_halaman)
        `)
        .order("tanggal", { ascending: false })
        .order("kelas_pengajian", { ascending: true });
        
      if (errTarget) throw errTarget;
      setTargets(dataTarget || []);
    } catch (err: any) {
      console.error(err);
      if (onTriggerNotification) onTriggerNotification("Gagal memuat data: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (item?: TargetPengajian) => {
    if (item) {
      setEditingItem(item);
      setFormKelas(item.kelas_pengajian);
      setFormMateriId(item.materi_id);
      setFormTanggal(item.tanggal);
      setFormPertemuanKe(item.pertemuan_ke);
      setFormHalMulai(item.target_halaman_mulai);
      setFormHalSelesai(item.target_halaman_selesai);
    } else {
      setEditingItem(null);
      setFormKelas(recitationClasses.length > 0 ? recitationClasses[0] : "");
      setFormMateriId(materiList.length > 0 ? materiList[0].id : 0);
      setFormTanggal(new Date().toISOString().split("T")[0]);
      setFormPertemuanKe(1);
      setFormHalMulai(1);
      setFormHalSelesai(5);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKelas || !formMateriId) {
      if (onTriggerNotification) onTriggerNotification("Mohon lengkapi pilihan kelas dan materi", "warning");
      return;
    }
    
    // Validation Logic
    const selectedMateri = materiList.find(m => m.id === formMateriId);
    if (selectedMateri) {
      if (formHalSelesai > selectedMateri.jumlah_halaman) {
        showWarning("Halaman Tidak Valid", `Halaman selesai tidak boleh melebihi jumlah halaman materi (${selectedMateri.jumlah_halaman} Hal)`);
        if (onTriggerNotification) onTriggerNotification(`Halaman selesai tidak boleh melebihi jumlah halaman materi (${selectedMateri.jumlah_halaman} Hal)`, "error");
        return;
      }
      if (formHalMulai > formHalSelesai) {
        showWarning("Halaman Tidak Valid", "Halaman mulai tidak boleh lebih besar dari halaman selesai");
        if (onTriggerNotification) onTriggerNotification("Halaman mulai tidak boleh lebih besar dari halaman selesai", "error");
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        kelas_pengajian: formKelas,
        materi_id: formMateriId,
        tanggal: formTanggal,
        pertemuan_ke: formPertemuanKe,
        target_halaman_mulai: formHalMulai,
        target_halaman_selesai: formHalSelesai
      };

      if (editingItem) {
        const { error } = await supabase
          .from("target_pengajian")
          .update(payload)
          .eq("id", editingItem.id);
          
        if (error) throw error;
        showSuccess("Berhasil", "Target capaian pengajian berhasil diperbarui.");
        if (onTriggerNotification) onTriggerNotification(`Berhasil mengupdate target`, "success");
      } else {
        const { error } = await supabase
          .from("target_pengajian")
          .insert(payload);
          
        if (error) throw error;
        showSuccess("Berhasil", "Target capaian pengajian berhasil ditambahkan.");
        if (onTriggerNotification) onTriggerNotification(`Berhasil menambahkan target baru`, "success");
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menyimpan", err.message || "Terjadi kesalahan saat menyimpan target.");
      if (onTriggerNotification) onTriggerNotification("Gagal menyimpan data: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const isConfirmed = await showDeleteConfirm("target capaian ini");
    if (!isConfirmed) return;
    
    try {
      const { error } = await supabase.from("target_pengajian").delete().eq("id", id);
      if (error) throw error;
      
      showToast("Target capaian berhasil dihapus", "success");
      if (onTriggerNotification) onTriggerNotification(`Target berhasil dihapus`, "success");
      loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menghapus", err.message || "Terjadi kesalahan saat menghapus target.");
      if (onTriggerNotification) onTriggerNotification("Gagal menghapus data: " + err.message, "error");
    }
  };

  const filteredTargets = targets
    .filter(t => filterKelas === "All" || t.kelas_pengajian === filterKelas)
    .filter(t => !filterTanggal || t.tanggal === filterTanggal)
    .filter(t => !searchQuery || t.materi_pengajian?.nama_materi.toLowerCase().includes(searchQuery.toLowerCase()));

  const classOptions = [
    { value: "All", label: "Semua Kelas" },
    ...recitationClasses.map(c => ({ value: c, label: c }))
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-emerald-500" />
              Target Capaian Pengajian
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Atur dan pantau target halaman per kelas untuk setiap pertemuan
            </p>
          </div>
          {isAdminOrPengurus && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Target Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-center gap-4">
        
        <div className="w-full lg:w-64">
          <SearchableSelect
            value={filterKelas}
            onChange={setFilterKelas}
            options={classOptions}
            placeholder="Filter Kelas..."
          />
        </div>

        <div className="w-full lg:w-48 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="date"
            value={filterTanggal}
            onChange={e => setFilterTanggal(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          {filterTanggal && (
            <button onClick={() => setFilterTanggal("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama materi target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* TABLE CONTENT */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Memuat data...</div>
        ) : filteredTargets.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Belum Ada Target</h3>
            <p className="text-slate-500 text-sm">
              Tidak ada data target capaian yang cocok dengan pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 text-center">Pertemuan Ke</th>
                  <th className="py-3 px-4">Tanggal & Kelas</th>
                  <th className="py-3 px-4">Materi</th>
                  <th className="py-3 px-4 text-center">Target Halaman</th>
                  <th className="py-3 px-4 text-center">Total Target</th>
                  {isAdminOrPengurus && <th className="py-3 px-4 text-center w-24">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTargets.map((item, idx) => {
                  const jumlahHal = (item.target_halaman_selesai - item.target_halaman_mulai) + 1;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-500 text-xs">{idx + 1}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                          {item.pertemuan_ke}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.kelas_pengajian}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.materi_pengajian?.nama_materi || "Materi Dihapus"}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-bold mt-0.5">
                          {item.materi_pengajian?.kelompok === "alquran" ? "Al-Qur'an" : item.materi_pengajian?.kelompok === "himpunan" ? "Himpunan" : "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-xs">
                          Hal. {item.target_halaman_mulai} - {item.target_halaman_selesai}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                          {jumlahHal} Halaman
                        </span>
                      </td>
                      {isAdminOrPengurus && (
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
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
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
                {editingItem ? <Edit2 className="w-5 h-5 text-emerald-500" /> : <Plus className="w-5 h-5 text-emerald-500" />}
                {editingItem ? "Edit Target Capaian" : "Buat Target Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={e => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Pertemuan Ke
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formPertemuanKe}
                    onChange={e => setFormPertemuanKe(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kelas Pengajian
                </label>
                {recitationClasses.length > 0 ? (
                  <select
                    value={formKelas}
                    onChange={e => setFormKelas(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  >
                    <option value="" disabled>-- Pilih Kelas --</option>
                    {recitationClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formKelas}
                    onChange={e => setFormKelas(e.target.value)}
                    placeholder="Masukkan nama kelas"
                    required
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Materi
                </label>
                <select
                  value={formMateriId}
                  onChange={e => {
                    const newId = Number(e.target.value);
                    setFormMateriId(newId);
                    // Reset target max when materi changes
                    const match = materiList.find(m => m.id === newId);
                    if (match && formHalSelesai > match.jumlah_halaman) {
                      setFormHalSelesai(match.jumlah_halaman);
                    }
                  }}
                  required
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                >
                  <option value={0} disabled>-- Pilih Materi --</option>
                  {materiList.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nama_materi} ({m.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"} - {m.jumlah_halaman} Hal)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Halaman Mulai
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formHalMulai}
                    onChange={e => setFormHalMulai(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Halaman Selesai
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formHalSelesai}
                    onChange={e => setFormHalSelesai(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
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
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingItem ? "Simpan" : "Buat Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
