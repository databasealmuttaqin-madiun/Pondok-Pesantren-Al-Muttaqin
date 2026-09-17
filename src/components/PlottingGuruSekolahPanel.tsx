import React, { useState, useEffect, useMemo } from "react";
import { 
  GraduationCap, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  User, 
  Check
} from "lucide-react";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

export interface GuruSekolahItem {
  id: string;
  guru_id: string;
  nama: string;
  created_at?: string;
}

interface PenggunaUser {
  id: string;
  nama: string;
  username?: string;
}

export default function PlottingGuruSekolahPanel() {
  const [items, setItems] = useState<GuruSekolahItem[]>(() => {
    try {
      const saved = localStorage.getItem("plotting_guru_sekolah_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [penggunaList, setPenggunaList] = useState<PenggunaUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GuruSekolahItem | null>(null);
  const [formGuruId, setFormGuruId] = useState("");

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch data guru dan pengguna untuk digabungkan
      const gList: PenggunaUser[] = [];
      try {
        const { data: dbGuru } = await supabase.from("guru").select("*");
        const { data: dbPengguna } = await supabase.from("pengguna").select("*");

        if (dbGuru && dbGuru.length > 0) {
          dbGuru.forEach((g: any) => {
            const matchedUser = dbPengguna?.find((u: any) => String(u.id) === String(g.pengguna_id));
            const resolvedName = matchedUser?.nama_lengkap || g.nama_lengkap || matchedUser?.nama || "Guru";
            gList.push({
              id: String(g.id),
              nama: resolvedName,
              username: matchedUser?.username
            });
          });
        }
      } catch (err) {
        console.warn("Notice when fetching guru or pengguna table:", err);
      }

      // Fallback jika kosong untuk demo/testing local
      if (gList.length === 0) {
        gList.push(
          { id: "1", nama: "Drs. Bambang Sudarsono M.Pd", username: "bambang" },
          { id: "2", nama: "Siti Rahmawati S.Pd", username: "siti" },
          { id: "3", nama: "Ahmad Fauzi S.Si", username: "ahmad" },
          { id: "4", nama: "Ustaz H. Abdullah S.Pd.I", username: "abdullah" }
        );
      }

      const sortedGurus = gList.sort((a, b) => a.nama.localeCompare(b.nama));
      setPenggunaList(sortedGurus);

      // 2. Fetch plotting_guru_sekolah from Supabase (id, guru_id, created_at)
      try {
        const { data: dbPlot, error } = await supabase
          .from("plotting_guru_sekolah")
          .select("id, guru_id, created_at");

        if (!error && dbPlot) {
          const mapped: GuruSekolahItem[] = dbPlot.map((item: any) => {
            const matchedGuru = sortedGurus.find(g => g.id === String(item.guru_id));
            return {
              id: String(item.id),
              guru_id: String(item.guru_id),
              nama: matchedGuru ? matchedGuru.nama : "Guru Sekolah",
              created_at: item.created_at
            };
          });
          setItems(mapped);
          localStorage.setItem("plotting_guru_sekolah_data", JSON.stringify(mapped));
        }
      } catch (err) {
        console.warn("Notice when fetching plotting_guru_sekolah:", err);
      }

    } catch (e: any) {
      console.warn("Overall fetch error:", e?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormGuruId(penggunaList[0]?.id || "");
    setIsModalOpen(true);
  };

  const openEditModal = (item: GuruSekolahItem) => {
    setEditingItem(item);
    setFormGuruId(item.guru_id || penggunaList[0]?.id || "");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formGuruId) {
      showFeedback("error", "Harap pilih nama!");
      return;
    }

    const selectedPengguna = penggunaList.find(u => u.id === formGuruId);
    const guruNama = selectedPengguna ? selectedPengguna.nama : "Guru Sekolah";

    // Prevent duplicate teacher assignment
    const duplicate = items.find(
      it => it.guru_id === formGuruId && (!editingItem || it.id !== editingItem.id)
    );
    if (duplicate) {
      showFeedback("error", `"${guruNama}" sudah terdaftar sebagai Guru Sekolah.`);
      return;
    }

    setIsSubmitting(true);

    if (editingItem) {
      // Update
      const updatedList = items.map(it => {
        if (it.id === editingItem.id) {
          return {
            ...it,
            guru_id: formGuruId,
            nama: guruNama
          };
        }
        return it;
      });
      setItems(updatedList);
      localStorage.setItem("plotting_guru_sekolah_data", JSON.stringify(updatedList));

      try {
        await supabase
          .from("plotting_guru_sekolah")
          .update({
            guru_id: formGuruId
          })
          .eq("id", editingItem.id);
      } catch (err: any) {
        console.warn("Supabase update error:", err?.message);
      }

      showFeedback("success", `Data Guru Sekolah "${guruNama}" berhasil diperbarui!`);
    } else {
      // Create new
      const newItem: GuruSekolahItem = {
        id: "gs_" + Date.now(),
        guru_id: formGuruId,
        nama: guruNama,
        created_at: new Date().toISOString()
      };
      const nextList = [...items, newItem];
      setItems(nextList);
      localStorage.setItem("plotting_guru_sekolah_data", JSON.stringify(nextList));

      try {
        const { data: inserted, error: insertError } = await supabase
          .from("plotting_guru_sekolah")
          .insert([{
            guru_id: formGuruId
          }])
          .select();

        if (!insertError && inserted && inserted[0]) {
          newItem.id = String(inserted[0].id);
          localStorage.setItem("plotting_guru_sekolah_data", JSON.stringify(nextList));
        }
      } catch (err: any) {
        console.warn("Supabase insert error:", err?.message);
      }

      showFeedback("success", `Guru Sekolah "${guruNama}" berhasil ditugaskan!`);
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, guruNama: string) => {
    if (!confirm(`Hapus penugasan Guru Sekolah "${guruNama}"?`)) return;

    const filtered = items.filter(it => it.id !== id);
    setItems(filtered);
    localStorage.setItem("plotting_guru_sekolah_data", JSON.stringify(filtered));

    try {
      await supabase.from("plotting_guru_sekolah").delete().eq("id", id);
    } catch (err: any) {
      console.warn("Supabase delete error:", err?.message);
    }

    showFeedback("success", `Guru Sekolah "${guruNama}" berhasil dihapus.`);
  };

  const filteredItems = useMemo(() => {
    return items.filter(it =>
      it.nama.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  return (
    <div className="space-y-6" id="plotting_guru_sekolah_module">
      <PageHeader
        category="Plotting Sekolah"
        title="Plotting Guru Sekolah"
        actionButton={
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tugaskan Guru Sekolah</span>
          </button>
        }
      />

      {feedback && (
        <div
          className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Search Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-100"
            />
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
                <th className="py-3 px-4 w-14 text-center">No</th>
                <th className="py-3 px-4">Nama</th>
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
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.nama}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Edit Penugasan"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.nama)}
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Penugasan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <GraduationCap className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-xs sm:text-sm">
                        {searchQuery
                          ? "Tidak ada hasil yang sesuai dengan pencarian."
                          : "Belum ada Guru Sekolah terdaftar. Klik 'Tugaskan Guru Sekolah' untuk menambah data."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clean White Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingItem ? "Ubah Penugasan Guru Sekolah" : "Tugaskan Guru Sekolah"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih nama guru yang ditugaskan sebagai Guru Sekolah.
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

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formGuruId}
                  onChange={(e) => setFormGuruId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                >
                  <option value="" disabled>-- Pilih Nama --</option>
                  {penggunaList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modal Footer */}
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
                  <span>{isSubmitting ? "Menyimpan..." : "Simpan Penugasan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
