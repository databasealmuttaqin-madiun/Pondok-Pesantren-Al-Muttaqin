import React, { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  Layers,
  Sparkles,
  Filter
} from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";
import { showSuccess, showError, showWarning, showToast, showDeleteConfirm } from "../utils/sweetalert";

const MySwal = withReactContent(Swal);

export interface MataPelajaranItem {
  id: string;
  kode_mapel: string;
  nama_mapel: string;
  kategori: "SMP" | "SMA";
  created_at?: string;
}

export default function MasterMataPelajaranPanel() {
  const [items, setItems] = useState<MataPelajaranItem[]>(() => {
    try {
      const saved = localStorage.getItem("master_mata_pelajaran_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState<"All" | "SMP" | "SMA">("All");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MataPelajaranItem | null>(null);
  const [formKode, setFormKode] = useState("");
  const [formNama, setFormNama] = useState("");
  const [formKategori, setFormKategori] = useState<"SMP" | "SMA">("SMP");

  const showFeedback = (type: "success" | "error", text: string) => {
    if (type === "error") {
      MySwal.fire({
        icon: "error",
        title: "Perhatian",
        text: text,
      });
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("mata_pelajaran")
        .select("id, kode_mapel, nama_mapel, kategori, created_at")
        .order("kode_mapel", { ascending: true });

      if (!error && data) {
        const mapped: MataPelajaranItem[] = data.map((d: any) => ({
          id: String(d.id),
          kode_mapel: d.kode_mapel,
          nama_mapel: d.nama_mapel,
          kategori: (d.kategori === "SMA" ? "SMA" : "SMP") as "SMP" | "SMA",
          created_at: d.created_at
        }));
        setItems(mapped);
        localStorage.setItem("master_mata_pelajaran_data", JSON.stringify(mapped));
      }
    } catch (err: any) {
      console.warn("Notice when fetching mata_pelajaran:", err?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormKode("");
    setFormNama("");
    setFormKategori("SMP");
    setIsModalOpen(true);
  };

  const openEditModal = (item: MataPelajaranItem) => {
    setEditingItem(item);
    setFormKode(item.kode_mapel);
    setFormNama(item.nama_mapel);
    setFormKategori(item.kategori);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKode = formKode.trim().toUpperCase();
    const cleanNama = formNama.trim();

    if (!cleanKode || !cleanNama) {
      showFeedback("error", "Kode Mapel dan Nama Mapel wajib diisi!");
      return;
    }

    // Check duplicate kode mapel
    const duplicate = items.find(
      it => it.kode_mapel.toUpperCase() === cleanKode && (!editingItem || it.id !== editingItem.id)
    );
    if (duplicate) {
      showFeedback("error", `Kode Mapel "${cleanKode}" sudah digunakan oleh "${duplicate.nama_mapel}"!`);
      return;
    }

    setIsSubmitting(true);

    if (editingItem) {
      try {
        const { data: updatedData, error: updateErr } = await supabase
          .from("mata_pelajaran")
          .update({
            kode_mapel: cleanKode,
            nama_mapel: cleanNama,
            kategori: formKategori
          })
          .eq("id", editingItem.id)
          .select();

        if (updateErr) {
          showFeedback("error", `Gagal memperbarui: ${updateErr.message}`);
          setIsSubmitting(false);
          return;
        }

        const updatedItem: MataPelajaranItem = {
          id: editingItem.id,
          kode_mapel: cleanKode,
          nama_mapel: cleanNama,
          kategori: formKategori,
          created_at: editingItem.created_at
        };

        const updatedList = items.map(it => (it.id === editingItem.id ? updatedItem : it));
        setItems(updatedList);
        localStorage.setItem("master_mata_pelajaran_data", JSON.stringify(updatedList));

        showFeedback("success", `Mata pelajaran "${cleanNama}" berhasil diperbarui!`);
        setIsModalOpen(false);
      } catch (err: any) {
        showFeedback("error", `Terjadi kesalahan: ${err?.message}`);
      }
    } else {
      try {
        const { data: insertedData, error: insertErr } = await supabase
          .from("mata_pelajaran")
          .insert([{
            kode_mapel: cleanKode,
            nama_mapel: cleanNama,
            kategori: formKategori
          }])
          .select();

        if (insertErr) {
          showFeedback("error", `Gagal menambahkan: ${insertErr.message}`);
          setIsSubmitting(false);
          return;
        }

        if (insertedData && insertedData.length > 0) {
          const newItem: MataPelajaranItem = {
            id: String(insertedData[0].id),
            kode_mapel: insertedData[0].kode_mapel,
            nama_mapel: insertedData[0].nama_mapel,
            kategori: (insertedData[0].kategori === "SMA" ? "SMA" : "SMP") as "SMP" | "SMA",
            created_at: insertedData[0].created_at
          };
          const nextList = [...items, newItem];
          setItems(nextList);
          localStorage.setItem("master_mata_pelajaran_data", JSON.stringify(nextList));

          showFeedback("success", `Mata pelajaran "${cleanNama}" berhasil ditambahkan!`);
          setIsModalOpen(false);
        }
      } catch (err: any) {
        showFeedback("error", `Terjadi kesalahan: ${err?.message}`);
      }
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (id: string, namaMapel: string) => {
    const isConfirmed = await showDeleteConfirm(`mata pelajaran "${namaMapel}"`);
    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from("mata_pelajaran").delete().eq("id", id);
      if (error) {
        showError("Gagal Menghapus", error.message);
        return;
      }

      const filtered = items.filter(it => it.id !== id);
      setItems(filtered);
      localStorage.setItem("master_mata_pelajaran_data", JSON.stringify(filtered));
      showToast(`Mata pelajaran "${namaMapel}" berhasil dihapus`, "success");
    } catch (err: any) {
      showError("Terjadi Kesalahan", err?.message);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const matchSearch =
        it.kode_mapel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.nama_mapel.toLowerCase().includes(searchQuery.toLowerCase());
      const matchKategori = kategoriFilter === "All" || it.kategori === kategoriFilter;
      return matchSearch && matchKategori;
    });
  }, [items, searchQuery, kategoriFilter]);

  return (
    <div className="space-y-6" id="master_mata_pelajaran_module">
      <PageHeader
        category="Plotting Sekolah"
        title="Master Mata Pelajaran"
        actionButton={
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Mata Pelajaran</span>
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Mapel</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{items.length} Mapel</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kategori SMP</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {items.filter(i => i.kategori === "SMP").length} Mapel
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kategori SMA</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {items.filter(i => i.kategori === "SMA").length} Mapel
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Search & Filter Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kode atau nama mapel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(["All", "SMP", "SMA"] as const).map((kat) => (
                <button
                  key={kat}
                  onClick={() => setKategoriFilter(kat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    kategoriFilter === kat
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {kat === "All" ? "Semua" : kat}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4 w-32">Kode Mapel</th>
                <th className="py-3 px-4">Nama Mata Pelajaran</th>
                <th className="py-3 px-4 text-center w-32">Kategori</th>
                <th className="py-3 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700">
                      {item.kode_mapel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-100">
                    {item.nama_mapel}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        item.kategori === "SMP"
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                          : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                      }`}
                    >
                      {item.kategori}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Edit Mapel"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.nama_mapel)}
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Mapel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-xs sm:text-sm">
                        {searchQuery
                          ? "Tidak ada hasil yang sesuai dengan pencarian."
                          : "Belum ada Mata Pelajaran terdaftar. Klik 'Tambah Mata Pelajaran' untuk menambah data."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clean White Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingItem ? "Ubah Mata Pelajaran" : "Tambah Mata Pelajaran Baru"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Daftarkan kode dan nama mata pelajaran sekolah.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kode Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Misal: MTK-SMP, IPA-7, B-ARAB"
                  value={formKode}
                  onChange={(e) => setFormKode(e.target.value.toUpperCase())}
                  className="w-full font-mono px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Misal: Matematika, Ilmu Pengetahuan Alam, Bahasa Arab"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kategori Jenjang <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value as "SMP" | "SMA")}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  required
                >
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 mt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? "Menyimpan..." : "Simpan Mapel"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
