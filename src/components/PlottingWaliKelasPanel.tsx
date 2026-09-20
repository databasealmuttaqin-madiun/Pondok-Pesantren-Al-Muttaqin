import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { 
  Users, 
  UserCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  School,
  User,
  GraduationCap
} from "lucide-react";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

const MySwal = withReactContent(Swal);

export interface WaliKelasItem {
  id: string;
  kelas_id?: string;
  kelas_nama: string;
  guru_id?: string;
  guru_nama: string;
  nomor_hp?: string;
  created_at?: string;
}

interface PlottingWaliKelasPanelProps {
  schoolClasses?: string[];
}

export default function PlottingWaliKelasPanel({ schoolClasses = [] }: PlottingWaliKelasPanelProps) {
  const [items, setItems] = useState<WaliKelasItem[]>(() => {
    try {
      const saved = localStorage.getItem("plotting_wali_kelas_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [availableClasses, setAvailableClasses] = useState<{ id: number; nama: string }[]>([]);
  const [guruList, setGuruList] = useState<{ id: string; nama: string; no_hp?: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WaliKelasItem | null>(null);
  const [formKelasId, setFormKelasId] = useState<number | "">("");
  const [formGuruId, setFormGuruId] = useState("");

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
      // 1. Fetch school classes from 'plotting' (jenis = 'kelas sekolah')
      const classesList: { id: number; nama: string }[] = [];
      try {
        const { data: plotClasses } = await supabase
          .from("plotting")
          .select("id, nama")
          .eq("jenis", "kelas sekolah");
        if (plotClasses && plotClasses.length > 0) {
          plotClasses.forEach((c: any) => {
            if (c.nama) {
              classesList.push({
                id: Number(c.id),
                nama: c.nama
              });
            }
          });
        }
      } catch (err) {
        console.warn("Error fetching classes from plotting:", err);
      }

      // If database is empty, fallback using schoolClasses strings to prevent blank screen
      if (classesList.length === 0 && schoolClasses && schoolClasses.length > 0) {
        schoolClasses.forEach((clsName, index) => {
          classesList.push({
            id: 1000 + index,
            nama: clsName
          });
        });
      }

      setAvailableClasses(classesList.sort((a, b) => a.nama.localeCompare(b.nama)));

      // 2. Fetch Wali Kelas from 'guru' and map with 'pengguna' (nama_lengkap)
      const gList: { id: string; nama: string; no_hp?: string; pengguna_id?: string }[] = [];
      try {
        const { data: dbGuru } = await supabase
          .from("guru")
          .select("id, pengguna_id, nama_lengkap, nomor_hp");
        
        const { data: dbPengguna } = await supabase
          .from("pengguna")
          .select("id, username, nama_lengkap, no_hp");
        
        if (dbGuru) {
          dbGuru.forEach((g: any) => {
            const matchedUser = dbPengguna?.find((u: any) => String(u.id) === String(g.pengguna_id));
            const displayName = matchedUser?.nama_lengkap || g.nama_lengkap || matchedUser?.username || "Guru";
            gList.push({
              id: String(g.id),
              nama: displayName,
              no_hp: matchedUser?.no_hp || g.nomor_hp || "",
              pengguna_id: g.pengguna_id ? String(g.pengguna_id) : undefined
            });
          });
        }
      } catch (err) {
        console.warn("Notice when fetching guru and pengguna for wali kelas:", err);
      }

      let filteredGList = gList;
      try {
        const { data: plotGuruSekolah } = await supabase
          .from("plotting_guru_sekolah")
          .select("*");
        
        if (plotGuruSekolah && plotGuruSekolah.length > 0) {
          filteredGList = gList.filter(g => {
            return plotGuruSekolah.some(item => {
              const rawId = String(item.guru_id || "");
              return rawId === String(g.id) || 
                     (g.pengguna_id && rawId === String(g.pengguna_id)) ||
                     (g.nama && g.nama.toLowerCase() === rawId.toLowerCase());
            });
          });
        } else {
          filteredGList = [];
        }
      } catch (err) {
        console.warn("Error filtering with plotting_guru_sekolah:", err);
      }

      if (filteredGList.length === 0 && gList.length > 0) {
        // Fallback only if plotting_guru_sekolah is totally empty in database
        filteredGList = gList;
      }

      if (filteredGList.length === 0) {
        filteredGList.push(
          { id: "1", nama: "Drs. Bambang Sudarsono M.Pd", no_hp: "081234112233" },
          { id: "2", nama: "Siti Rahmawati S.Pd", no_hp: "081234445566" },
          { id: "3", nama: "Ahmad Fauzi S.Si", no_hp: "081234778899" }
        );
      }

      // Unique-fy by name, prioritizing records with pengguna_id
      const uniqueGList: typeof filteredGList = [];
      const seenNames = new Set<string>();
      const sortedForUniqueness = [...filteredGList].sort((a, b) => {
        if (a.pengguna_id && !b.pengguna_id) return -1;
        if (!a.pengguna_id && b.pengguna_id) return 1;
        return 0;
      });
      for (const item of sortedForUniqueness) {
        const normName = item.nama.trim().toLowerCase();
        if (!seenNames.has(normName)) {
          seenNames.add(normName);
          uniqueGList.push(item);
        }
      }

      setGuruList(uniqueGList.sort((a, b) => a.nama.localeCompare(b.nama)));

      // 3. Fetch Plotting Wali Kelas from Supabase
      try {
        const { data: dbWali, error } = await supabase
          .from("plotting_wali_kelas")
          .select("id, kelas_id, kelas_nama, guru_id, created_at");

        if (!error && dbWali) {
          const mapped: WaliKelasItem[] = dbWali.map((item: any) => {
            const matchedGuru = gList.find(g => g.id === String(item.guru_id));
            return {
              id: String(item.id),
              kelas_id: item.kelas_id ? String(item.kelas_id) : undefined,
              kelas_nama: item.kelas_nama || "Kelas",
              guru_id: item.guru_id ? String(item.guru_id) : undefined,
              guru_nama: matchedGuru ? matchedGuru.nama : "Guru Wali Kelas",
              nomor_hp: matchedGuru?.no_hp || "",
              created_at: item.created_at
            };
          });
          setItems(mapped);
          localStorage.setItem("plotting_wali_kelas_data", JSON.stringify(mapped));
        }
      } catch (err) {
        console.warn("Notice when fetching plotting_wali_kelas:", err);
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
    setFormKelasId(availableClasses[0]?.id || "");
    setFormGuruId(guruList[0]?.id || "");
    setIsModalOpen(true);
  };

  const openEditModal = (item: WaliKelasItem) => {
    setEditingItem(item);
    
    const matchedClass = availableClasses.find(
      c => String(c.id) === item.kelas_id || c.nama.toLowerCase() === item.kelas_nama.toLowerCase()
    );
    setFormKelasId(matchedClass ? matchedClass.id : "");

    const matchedGuru = guruList.find(
      g => g.id === item.guru_id || g.nama.toLowerCase() === item.guru_nama.toLowerCase()
    );
    setFormGuruId(matchedGuru?.id || guruList[0]?.id || "");
    
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKelasId || !formGuruId) {
      showFeedback("error", "Harap pilih kelas dan guru wali kelas!");
      return;
    }

    const selectedClass = availableClasses.find(c => c.id === Number(formKelasId));
    const selectedGuru = guruList.find(g => g.id === formGuruId);

    if (!selectedClass || !selectedGuru) {
      showFeedback("error", "Data kelas atau guru tidak valid!");
      return;
    }

    const kelasId = selectedClass.id;
    const kelasNama = selectedClass.nama;
    const guruId = selectedGuru.id;
    const guruNama = selectedGuru.nama;
    const nomorHp = selectedGuru.no_hp || "";

    // Check duplicate kelas (1 kelas = 1 wali kelas)
    const duplicate = items.find(
      it => Number(it.kelas_id) === kelasId && (!editingItem || it.id !== editingItem.id)
    );
    if (duplicate) {
      showFeedback("error", `Kelas "${kelasNama}" sudah memiliki Wali Kelas (${duplicate.guru_nama}).`);
      return;
    }

    setIsSubmitting(true);

    if (editingItem) {
      try {
        const { error: updateErr } = await supabase
          .from("plotting_wali_kelas")
          .update({
            kelas_id: kelasId,
            kelas_nama: kelasNama,
            guru_id: guruId
          })
          .eq("id", editingItem.id);

        if (updateErr) {
          showFeedback("error", `Gagal memperbarui: ${updateErr.message}`);
          setIsSubmitting(false);
          return;
        }

        const updatedItem: WaliKelasItem = {
          id: editingItem.id,
          kelas_id: String(kelasId),
          kelas_nama: kelasNama,
          guru_id: guruId,
          guru_nama: guruNama,
          nomor_hp: nomorHp,
          created_at: editingItem.created_at
        };

        const updatedList = items.map(it => (it.id === editingItem.id ? updatedItem : it));
        setItems(updatedList);
        localStorage.setItem("plotting_wali_kelas_data", JSON.stringify(updatedList));

        showFeedback("success", `Wali Kelas untuk "${kelasNama}" berhasil diperbarui!`);
        MySwal.fire({
          icon: "success",
          title: "Berhasil Disimpan!",
          text: `Wali Kelas untuk "${kelasNama}" berhasil diperbarui.`,
          timer: 2000,
          showConfirmButton: false
        });
        setIsModalOpen(false);
      } catch (err: any) {
        showFeedback("error", `Terjadi kesalahan: ${err?.message}`);
      }
    } else {
      try {
        const { data: insertedData, error: insertErr } = await supabase
          .from("plotting_wali_kelas")
          .insert([{
            kelas_id: kelasId,
            kelas_nama: kelasNama,
            guru_id: guruId
          }])
          .select();

        if (insertErr) {
          showFeedback("error", `Gagal menambahkan: ${insertErr.message}`);
          setIsSubmitting(false);
          return;
        }

        if (insertedData && insertedData.length > 0) {
          const newItem: WaliKelasItem = {
            id: String(insertedData[0].id),
            kelas_id: String(insertedData[0].kelas_id),
            kelas_nama: insertedData[0].kelas_nama,
            guru_id: String(insertedData[0].guru_id),
            guru_nama: guruNama,
            nomor_hp: nomorHp,
            created_at: insertedData[0].created_at
          };
          const nextList = [...items, newItem];
          setItems(nextList);
          localStorage.setItem("plotting_wali_kelas_data", JSON.stringify(nextList));

          showFeedback("success", `Penugasan Wali Kelas untuk "${kelasNama}" berhasil disimpan!`);
          MySwal.fire({
            icon: "success",
            title: "Berhasil Ditugaskan!",
            text: `Penugasan Wali Kelas untuk "${kelasNama}" berhasil disimpan ke database.`,
            timer: 2000,
            showConfirmButton: false
          });
          setIsModalOpen(false);
        }
      } catch (err: any) {
        showFeedback("error", `Terjadi kesalahan: ${err?.message}`);
      }
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (id: string, kelasNama: string) => {
    const res = await MySwal.fire({
      title: "Hapus Penugasan?",
      text: `Apakah Anda yakin ingin menghapus penugasan Wali Kelas untuk "${kelasNama}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal"
    });

    if (!res.isConfirmed) return;

    try {
      const { error } = await supabase.from("plotting_wali_kelas").delete().eq("id", id);
      if (error) {
        showFeedback("error", `Gagal menghapus: ${error.message}`);
        return;
      }

      const filtered = items.filter(it => it.id !== id);
      setItems(filtered);
      localStorage.setItem("plotting_wali_kelas_data", JSON.stringify(filtered));
      showFeedback("success", `Penugasan Wali Kelas untuk "${kelasNama}" berhasil dihapus.`);
      MySwal.fire({
        icon: "success",
        title: "Berhasil Dihapus",
        text: `Penugasan Wali Kelas untuk "${kelasNama}" telah dihapus.`,
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err: any) {
      showFeedback("error", `Terjadi kesalahan: ${err?.message}`);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(
      it =>
        it.kelas_nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.guru_nama.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  return (
    <div className="space-y-6" id="plotting_wali_kelas_module">
      <PageHeader
        category="Plotting Sekolah"
        title="Plotting Wali Kelas"
        actionButton={
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tugaskan Wali Kelas</span>
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <School className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Kelas Terplotting</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{items.length} Rombel</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Guru Wali Kelas</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {new Set(items.map(i => i.guru_nama)).size} Guru
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kelas Belum Ada Wali</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {Math.max(0, availableClasses.length - items.length)} Rombel
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Search */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kelas atau nama guru..."
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
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Kelas</th>
                <th className="py-3 px-4">Wali Kelas</th>
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
                    <div className="flex items-center gap-2">
                       <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        <School className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {item.kelas_nama}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                        <User className="w-3.5 h-3.5" />
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
                        onClick={() => handleDelete(item.id, item.kelas_nama)}
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
                  <td colSpan={4} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <School className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-xs sm:text-sm">
                        {searchQuery
                          ? "Tidak ada hasil yang sesuai dengan pencarian."
                          : "Belum ada data penugasan Wali Kelas. Klik 'Tugaskan Wali Kelas' untuk menambah data."}
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
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingItem ? "Ubah Penugasan Wali Kelas" : "Tugaskan Wali Kelas Baru"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih rombel kelas sekolah dan guru yang bertindak sebagai wali kelas.
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
                  value={formKelasId}
                  onChange={(e) => setFormKelasId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                >
                  <option value="" disabled>-- Pilih Kelas / Rombel --</option>
                  {availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Guru Wali Kelas <span className="text-rose-500">*</span>
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
