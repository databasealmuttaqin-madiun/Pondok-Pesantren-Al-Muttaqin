import React, { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, 
  GraduationCap, 
  School, 
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
  UserCheck,
  User,
  Filter
} from "lucide-react";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";
import { MataPelajaranItem } from "./MasterMataPelajaranPanel";

export interface GuruMapelItem {
  id: string;
  guru_id?: string;
  guru_nama: string;
  mapel_id?: string;
  mapel_kode?: string;
  mapel_nama: string;
  kelas_id?: string;
  kelas_nama: string;
  created_at?: string;
}

interface PlottingGuruMapelPanelProps {
  schoolClasses?: string[];
}

export default function PlottingGuruMapelPanel({ schoolClasses = [] }: PlottingGuruMapelPanelProps) {
  const [items, setItems] = useState<GuruMapelItem[]>(() => {
    try {
      const saved = localStorage.getItem("plotting_guru_mapel_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [availableClasses, setAvailableClasses] = useState<string[]>(schoolClasses);
  const [guruList, setGuruList] = useState<{ id: string; nama: string; no_hp?: string }[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaranItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKelasFilter, setSelectedKelasFilter] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GuruMapelItem | null>(null);
  const [formGuruId, setFormGuruId] = useState("");
  const [formMapelId, setFormMapelId] = useState("");
  const [formKelas, setFormKelas] = useState("");

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Classes
      const classSet = new Set<string>(schoolClasses);
      try {
        const { data: plotClasses } = await supabase
          .from("plotting")
          .select("nama")
          .eq("jenis", "kelas sekolah");
        if (plotClasses) {
          plotClasses.forEach((c: any) => { if (c.nama) classSet.add(c.nama); });
        }
      } catch (err) {
        console.warn("Error fetching classes:", err);
      }
      const sortedClasses = Array.from(classSet).sort();
      setAvailableClasses(sortedClasses);

      // 2. Fetch Teachers
      const gList: { id: string; nama: string; no_hp?: string }[] = [];
      try {
        const { data: dbGuru } = await supabase
          .from("guru")
          .select("id, nama_lengkap, nomor_hp");
        if (dbGuru) {
          dbGuru.forEach((g: any) => {
            gList.push({ id: String(g.id), nama: g.nama_lengkap, no_hp: g.nomor_hp });
          });
        }
      } catch (err) {
        console.warn("Notice when fetching guru:", err);
      }

      try {
        const { data: dbPengguna } = await supabase
          .from("pengguna")
          .select("id, username, nama_lengkap, no_hp, peran_utama");
        if (dbPengguna) {
          dbPengguna.forEach((u: any) => {
            const role = String(u.peran_utama || "").toLowerCase();
            if (role.includes("guru") || role.includes("smp") || role.includes("sekolah")) {
              const displayName = u.nama_lengkap || u.username;
              if (!gList.some(g => g.nama.toLowerCase() === displayName.toLowerCase())) {
                gList.push({ id: String(u.id), nama: displayName, no_hp: u.no_hp });
              }
            }
          });
        }
      } catch (err) {
        console.warn("Notice when fetching pengguna for guru mapel:", err);
      }

      if (gList.length === 0) {
        gList.push(
          { id: "1", nama: "Drs. Bambang Sudarsono M.Pd" },
          { id: "2", nama: "Siti Rahmawati S.Pd" },
          { id: "3", nama: "Ahmad Fauzi S.Si" },
          { id: "4", nama: "Ustaz H. Abdullah S.Pd.I" }
        );
      }
      setGuruList(gList.sort((a, b) => a.nama.localeCompare(b.nama)));

      // 3. Fetch Mata Pelajaran
      let mList: MataPelajaranItem[] = [];
      try {
        const { data: dbMapel } = await supabase
          .from("mata_pelajaran")
          .select("id, kode_mapel, nama_mapel, kategori");
        if (dbMapel && dbMapel.length > 0) {
          mList = dbMapel.map((m: any) => ({
            id: String(m.id),
            kode_mapel: m.kode_mapel,
            nama_mapel: m.nama_mapel,
            kategori: (m.kategori === "SMA" ? "SMA" : "SMP") as "SMP" | "SMA"
          }));
        }
      } catch (err) {
        console.warn("Notice when fetching mata_pelajaran:", err);
      }

      if (mList.length === 0) {
        try {
          const localSaved = localStorage.getItem("master_mata_pelajaran_data");
          if (localSaved) mList = JSON.parse(localSaved);
        } catch {}
      }

      if (mList.length === 0) {
        mList = [
          { id: "1", kode_mapel: "MTK-SMP", nama_mapel: "Matematika", kategori: "SMP" },
          { id: "2", kode_mapel: "IPA-SMP", nama_mapel: "Ilmu Pengetahuan Alam", kategori: "SMP" },
          { id: "3", kode_mapel: "BIG-SMP", nama_mapel: "Bahasa Inggris", kategori: "SMP" },
          { id: "4", kode_mapel: "PAI", nama_mapel: "Pendidikan Agama Islam", kategori: "SMP" }
        ];
      }
      setMapelList(mList);

      // 4. Fetch plotting_guru_mapel from Supabase
      try {
        const { data: dbPlot, error } = await supabase
          .from("plotting_guru_mapel")
          .select("id, guru_id, mapel_id, kelas_id, created_at");

        if (!error && dbPlot && dbPlot.length > 0) {
          const mapped: GuruMapelItem[] = dbPlot.map((item: any) => {
            const matchedGuru = gList.find(g => g.id === String(item.guru_id));
            const matchedMapel = mList.find(m => m.id === String(item.mapel_id));
            return {
              id: String(item.id),
              guru_id: item.guru_id,
              guru_nama: matchedGuru ? matchedGuru.nama : "Guru",
              mapel_id: item.mapel_id,
              mapel_kode: matchedMapel?.kode_mapel,
              mapel_nama: matchedMapel ? matchedMapel.nama_mapel : "Mata Pelajaran",
              kelas_id: item.kelas_id,
              kelas_nama: item.kelas_nama || item.kelas_id || "Kelas",
              created_at: item.created_at
            };
          });
          setItems(mapped);
          localStorage.setItem("plotting_guru_mapel_data", JSON.stringify(mapped));
        }
      } catch (err) {
        console.warn("Notice when fetching plotting_guru_mapel:", err);
      }

    } catch (e: any) {
      console.warn("Overall fetch error:", e?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [schoolClasses]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormGuruId(guruList[0]?.id || "");
    setFormMapelId(mapelList[0]?.id || "");
    setFormKelas(availableClasses[0] || "");
    setIsModalOpen(true);
  };

  const openEditModal = (item: GuruMapelItem) => {
    setEditingItem(item);
    const matchedGuru = guruList.find(g => g.nama.toLowerCase() === item.guru_nama.toLowerCase() || g.id === item.guru_id);
    const matchedMapel = mapelList.find(m => m.nama_mapel.toLowerCase() === item.mapel_nama.toLowerCase() || m.id === item.mapel_id);
    setFormGuruId(matchedGuru?.id || guruList[0]?.id || "");
    setFormMapelId(matchedMapel?.id || mapelList[0]?.id || "");
    setFormKelas(item.kelas_nama);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formGuruId || !formMapelId || !formKelas) {
      showFeedback("error", "Harap lengkapi pilihan Guru, Mata Pelajaran, dan Kelas!");
      return;
    }

    const selectedGuru = guruList.find(g => g.id === formGuruId);
    const selectedMapel = mapelList.find(m => m.id === formMapelId);

    const guruNama = selectedGuru ? selectedGuru.nama : "Guru";
    const mapelNama = selectedMapel ? selectedMapel.nama_mapel : "Mata Pelajaran";
    const mapelKode = selectedMapel ? selectedMapel.kode_mapel : "";

    // Check duplicate: UNIQUE(mapel_id, kelas_id) -> 1 Mapel in 1 Kelas only has 1 Guru
    const duplicate = items.find(
      it =>
        it.kelas_nama.toLowerCase() === formKelas.toLowerCase() &&
        it.mapel_nama.toLowerCase() === mapelNama.toLowerCase() &&
        (!editingItem || it.id !== editingItem.id)
    );
    if (duplicate) {
      showFeedback("error", `Mata pelajaran "${mapelNama}" di kelas "${formKelas}" sudah diampu oleh ${duplicate.guru_nama}!`);
      return;
    }

    setIsSubmitting(true);

    if (editingItem) {
      const updatedList = items.map(it => {
        if (it.id === editingItem.id) {
          return {
            ...it,
            guru_id: formGuruId,
            guru_nama: guruNama,
            mapel_id: formMapelId,
            mapel_kode: mapelKode,
            mapel_nama: mapelNama,
            kelas_nama: formKelas
          };
        }
        return it;
      });
      setItems(updatedList);
      localStorage.setItem("plotting_guru_mapel_data", JSON.stringify(updatedList));

      try {
        await supabase
          .from("plotting_guru_mapel")
          .update({
            guru_id: formGuruId,
            mapel_id: formMapelId
          })
          .eq("id", editingItem.id);
      } catch (err: any) {
        console.warn("Supabase update error:", err?.message);
      }

      showFeedback("success", `Penugasan "${mapelNama}" di kelas "${formKelas}" berhasil diperbarui!`);
    } else {
      const newItem: GuruMapelItem = {
        id: "gm_" + Date.now(),
        guru_id: formGuruId,
        guru_nama: guruNama,
        mapel_id: formMapelId,
        mapel_kode: mapelKode,
        mapel_nama: mapelNama,
        kelas_nama: formKelas,
        created_at: new Date().toISOString()
      };
      const nextList = [...items, newItem];
      setItems(nextList);
      localStorage.setItem("plotting_guru_mapel_data", JSON.stringify(nextList));

      try {
        await supabase
          .from("plotting_guru_mapel")
          .insert([{
            guru_id: formGuruId,
            mapel_id: formMapelId
          }]);
      } catch (err: any) {
        console.warn("Supabase insert error:", err?.message);
      }

      showFeedback("success", `Penugasan "${guruNama}" mengampu "${mapelNama}" (${formKelas}) berhasil disimpan!`);
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, mapelNama: string, kelasNama: string) => {
    if (!confirm(`Hapus penugasan mapel "${mapelNama}" di kelas "${kelasNama}"?`)) return;

    const filtered = items.filter(it => it.id !== id);
    setItems(filtered);
    localStorage.setItem("plotting_guru_mapel_data", JSON.stringify(filtered));

    try {
      await supabase.from("plotting_guru_mapel").delete().eq("id", id);
    } catch (err: any) {
      console.warn("Supabase delete error:", err?.message);
    }

    showFeedback("success", `Penugasan mapel "${mapelNama}" di "${kelasNama}" berhasil dihapus.`);
  };

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const matchSearch =
        it.guru_nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.mapel_nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (it.mapel_kode && it.mapel_kode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        it.kelas_nama.toLowerCase().includes(searchQuery.toLowerCase());
      const matchKelas = selectedKelasFilter === "All" || it.kelas_nama === selectedKelasFilter;
      return matchSearch && matchKelas;
    });
  }, [items, searchQuery, selectedKelasFilter]);

  return (
    <div className="space-y-6" id="plotting_guru_mapel_module">
      <PageHeader
        category="Plotting Sekolah"
        title="Plotting Guru Mata Pelajaran"
        actionButton={
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tugaskan Guru Mapel</span>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Penugasan Mapel</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{items.length} Penugasan</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Guru Pengampu</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {new Set(items.map(i => i.guru_nama)).size} Guru
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <School className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kelas Terjangkau</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {new Set(items.map(i => i.kelas_nama)).size} Kelas
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
                placeholder="Cari guru, mapel, atau kelas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedKelasFilter}
                onChange={(e) => setSelectedKelasFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="All">Semua Kelas</option>
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
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
                <th className="py-3 px-4">Kelas / Rombel</th>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-4">Guru Pengampu</th>
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
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
                      <School className="w-3.5 h-3.5" />
                      {item.kelas_nama}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{item.mapel_nama}</p>
                      {item.mapel_kode && (
                        <p className="text-[11px] font-mono text-slate-400">{item.mapel_kode}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                        <GraduationCap className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.guru_nama}
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
                        onClick={() => handleDelete(item.id, item.mapel_nama, item.kelas_nama)}
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
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-xs sm:text-sm">
                        {searchQuery
                          ? "Tidak ada hasil yang sesuai dengan pencarian."
                          : "Belum ada Guru Mata Pelajaran terdaftar. Klik 'Tugaskan Guru Mapel' untuk menambah data."}
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
                    {editingItem ? "Ubah Penugasan Guru Mapel" : "Tugaskan Guru Mata Pelajaran"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Plotting guru pengampu mata pelajaran untuk kelas/rombel tertentu.
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
                  Kelas / Rombel <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formKelas}
                  onChange={(e) => setFormKelas(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                >
                  <option value="" disabled>-- Pilih Kelas / Rombel --</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formMapelId}
                  onChange={(e) => setFormMapelId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                >
                  <option value="" disabled>-- Pilih Mata Pelajaran --</option>
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.kode_mapel}] {m.nama_mapel} ({m.kategori})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Guru Pengampu <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formGuruId}
                  onChange={(e) => setFormGuruId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                >
                  <option value="" disabled>-- Pilih Guru --</option>
                  {guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama}
                    </option>
                  ))}
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
