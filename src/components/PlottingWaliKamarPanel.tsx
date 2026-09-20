import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { 
  Home, 
  UserCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  User, 
  Building2,
  Check
} from "lucide-react";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

const MySwal = withReactContent(Swal);

export interface WaliKamarItem {
  id: string;
  pengguna_id?: string;
  nama: string;
  kamar: string;
  created_at?: string;
}

interface PenggunaUser {
  id: string;
  nama: string;
  username?: string;
}

interface PlottingWaliKamarPanelProps {
  rooms?: string[];
}

export default function PlottingWaliKamarPanel({ rooms = [] }: PlottingWaliKamarPanelProps) {
  const [items, setItems] = useState<WaliKamarItem[]>(() => {
    try {
      const saved = localStorage.getItem("plotting_wali_kamar_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [availableRooms, setAvailableRooms] = useState<string[]>(rooms);
  const [penggunaList, setPenggunaList] = useState<PenggunaUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WaliKamarItem | null>(null);
  const [formKamar, setFormKamar] = useState("");
  const [formPenggunaId, setFormPenggunaId] = useState("");

  const showFeedback = (type: "success" | "error", text: string) => {
    if (type === "error") {
      MySwal.fire({
        icon: "error",
        title: "Perhatian",
        text: text,
      });
    }
  };

  // Fetch Pengguna & Rooms & Wali Kamar
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Rooms from 'plotting' (jenis = 'kamar') or rooms prop
      const roomsSet = new Set<string>(rooms);
      try {
        const { data: plotRooms } = await supabase
          .from("plotting")
          .select("nama")
          .eq("jenis", "kamar");
        if (plotRooms) {
          plotRooms.forEach((r: any) => { if (r.nama) roomsSet.add(r.nama); });
        }
      } catch (err) {
        console.warn("Error fetching rooms from plotting:", err);
      }
      setAvailableRooms(Array.from(roomsSet).sort());

      // 2. Fetch data nama lengkap pengguna langsung dari tabel 'pengguna'
      const uList: PenggunaUser[] = [];
      try {
        const { data: dbPengguna, error: errPengguna } = await supabase
          .from("pengguna")
          .select("*");
        
        if (!errPengguna && dbPengguna && dbPengguna.length > 0) {
          dbPengguna.forEach((u: any) => {
            const displayName = u.nama_lengkap || u.nama || u.username || "Pengguna";
            uList.push({
              id: String(u.id),
              nama: displayName,
              username: u.username
            });
          });
        }
      } catch (err) {
        console.warn("Notice when fetching pengguna table:", err);
      }

      let filteredUList = uList;
      try {
        const { data: dbGuru } = await supabase
          .from("guru")
          .select("id, pengguna_id, nama_lengkap");

        const { data: plotGuruPondok } = await supabase
          .from("plotting_guru_pondok")
          .select("*");
        
        if (plotGuruPondok && plotGuruPondok.length > 0) {
          filteredUList = uList.filter(u => {
            const matchedGuru = dbGuru?.find(g => String(g.pengguna_id) === String(u.id));
            return plotGuruPondok.some(item => {
              const rawId = String(item.guru_id || "");
              return rawId === String(u.id) || 
                     (matchedGuru && rawId === String(matchedGuru.id)) ||
                     (u.nama && u.nama.toLowerCase() === rawId.toLowerCase());
            });
          });
        } else {
          filteredUList = [];
        }
      } catch (err) {
        console.warn("Error filtering with plotting_guru_pondok:", err);
      }

      if (filteredUList.length === 0 && uList.length > 0) {
        // Fallback only if database plotting is empty
        filteredUList = uList;
      }

      // Unique-fy by name
      const uniqueUList: typeof filteredUList = [];
      const seenNames = new Set<string>();
      for (const item of filteredUList) {
        const normName = item.nama.trim().toLowerCase();
        if (!seenNames.has(normName)) {
          seenNames.add(normName);
          uniqueUList.push(item);
        }
      }

      setPenggunaList(uniqueUList.sort((a, b) => a.nama.localeCompare(b.nama)));

      // 3. Fetch data dari tabel 'plotting_wali_kamar' (hanya nama dan kamar)
      try {
        const { data: dbWali, error } = await supabase
          .from("plotting_wali_kamar")
          .select("id, pengguna_id, nama, kamar, created_at");

        if (!error && dbWali) {
          const mapped: WaliKamarItem[] = dbWali.map((item: any) => ({
            id: String(item.id),
            pengguna_id: item.pengguna_id ? String(item.pengguna_id) : undefined,
            nama: item.nama || "Wali Kamar",
            kamar: item.kamar || "Kamar",
            created_at: item.created_at
          }));
          setItems(mapped);
          localStorage.setItem("plotting_wali_kamar_data", JSON.stringify(mapped));
        }
      } catch (err) {
        console.warn("Notice when fetching plotting_wali_kamar:", err);
      }

    } catch (e: any) {
      console.warn("Overall fetch error:", e?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [rooms]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormKamar(availableRooms[0] || "");
    setFormPenggunaId(penggunaList[0]?.id || "");
    setIsModalOpen(true);
  };

  const openEditModal = (item: WaliKamarItem) => {
    setEditingItem(item);
    setFormKamar(item.kamar);
    const matched = penggunaList.find(u => u.id === item.pengguna_id || u.nama.toLowerCase() === item.nama.toLowerCase());
    setFormPenggunaId(matched?.id || penggunaList[0]?.id || "");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKamar || !formPenggunaId) {
      showFeedback("error", "Harap pilih nama dan kamar!");
      return;
    }

    const selectedPengguna = penggunaList.find(u => u.id === formPenggunaId);
    const waliNama = selectedPengguna ? selectedPengguna.nama : "Wali Kamar";

    // Check duplicate room (1 room = 1 wali kamar)
    const duplicate = items.find(
      it => it.kamar.toLowerCase() === formKamar.toLowerCase() && (!editingItem || it.id !== editingItem.id)
    );
    if (duplicate) {
      showFeedback("error", `Kamar "${formKamar}" sudah memiliki Wali Kamar (${duplicate.nama}). Edit data yang ada jika ingin mengubah.`);
      return;
    }

    setIsSubmitting(true);

    if (editingItem) {
      // Update
      const updatedList = items.map(it => {
        if (it.id === editingItem.id) {
          return {
            ...it,
            kamar: formKamar,
            pengguna_id: formPenggunaId,
            nama: waliNama
          };
        }
        return it;
      });
      setItems(updatedList);
      localStorage.setItem("plotting_wali_kamar_data", JSON.stringify(updatedList));

      try {
        await supabase
          .from("plotting_wali_kamar")
          .update({
            pengguna_id: formPenggunaId,
            nama: waliNama,
            kamar: formKamar
          })
          .eq("id", editingItem.id);
      } catch (err: any) {
        console.warn("Supabase update error:", err?.message);
      }

      showFeedback("success", `Wali kamar untuk "${formKamar}" berhasil diperbarui!`);
      MySwal.fire({
        icon: "success",
        title: "Berhasil Disimpan!",
        text: `Wali kamar untuk "${formKamar}" berhasil diperbarui.`,
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      // Create new
      const newItem: WaliKamarItem = {
        id: "wk_" + Date.now(),
        pengguna_id: formPenggunaId,
        nama: waliNama,
        kamar: formKamar,
        created_at: new Date().toISOString()
      };
      const nextList = [...items, newItem];
      setItems(nextList);
      localStorage.setItem("plotting_wali_kamar_data", JSON.stringify(nextList));

      try {
        const { data: inserted, error: insertError } = await supabase
          .from("plotting_wali_kamar")
          .insert([{
            pengguna_id: formPenggunaId,
            nama: waliNama,
            kamar: formKamar
          }])
          .select();

        if (!insertError && inserted && inserted[0]) {
          newItem.id = String(inserted[0].id);
          localStorage.setItem("plotting_wali_kamar_data", JSON.stringify(nextList));
        }
      } catch (err: any) {
        console.warn("Supabase insert error:", err?.message);
      }

      showFeedback("success", `Penugasan Wali Kamar untuk "${formKamar}" berhasil disimpan!`);
      MySwal.fire({
        icon: "success",
        title: "Berhasil Ditugaskan!",
        text: `Penugasan Wali Kamar untuk "${formKamar}" berhasil disimpan ke database.`,
        timer: 2000,
        showConfirmButton: false
      });
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, kamarNama: string) => {
    const res = await MySwal.fire({
      title: "Hapus Penugasan?",
      text: `Apakah Anda yakin ingin menghapus penugasan Wali Kamar untuk kamar "${kamarNama}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal"
    });

    if (!res.isConfirmed) return;

    const filtered = items.filter(it => it.id !== id);
    setItems(filtered);
    localStorage.setItem("plotting_wali_kamar_data", JSON.stringify(filtered));

    try {
      await supabase.from("plotting_wali_kamar").delete().eq("id", id);
    } catch (err: any) {
      console.warn("Supabase delete error:", err?.message);
    }

    showFeedback("success", `Penugasan Wali Kamar untuk "${kamarNama}" berhasil dihapus.`);
    MySwal.fire({
      icon: "success",
      title: "Berhasil Dihapus",
      text: `Penugasan Wali Kamar untuk kamar "${kamarNama}" telah dihapus.`,
      timer: 1800,
      showConfirmButton: false
    });
  };

  const filteredItems = useMemo(() => {
    return items.filter(
      it =>
        it.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.kamar.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  return (
    <div className="space-y-6" id="plotting_wali_kamar_module">
      <PageHeader
        category="Plotting Pondok"
        title="Plotting Wali Kamar"
        actionButton={
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tugaskan Wali Kamar</span>
          </button>
        }
      />

      {/* Stats and Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Kamar Terplotting</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{items.length} Asrama</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Wali Kamar Bertugas</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {new Set(items.map(i => i.nama)).size} Orang
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kamar Belum Ada Wali</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {Math.max(0, availableRooms.length - items.length)} Asrama
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Search Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau kamar..."
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

        {/* Table - Hanya Nama dan Kamar */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4 w-14 text-center">No</th>
                <th className="py-3 px-4">Nama</th>
                <th className="py-3 px-4">Kamar</th>
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
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        <Home className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {item.kamar}
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
                        onClick={() => handleDelete(item.id, item.kamar)}
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
                      <Home className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-xs sm:text-sm">
                        {searchQuery
                          ? "Tidak ada hasil yang sesuai dengan pencarian."
                          : "Belum ada data penugasan Wali Kamar. Klik 'Tugaskan Wali Kamar' untuk menambah data."}
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
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingItem ? "Ubah Penugasan Wali Kamar" : "Tugaskan Wali Kamar"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih nama dan kamar yang ditugaskan.
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
                  value={formPenggunaId}
                  onChange={(e) => setFormPenggunaId(e.target.value)}
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

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kamar <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formKamar}
                  onChange={(e) => setFormKamar(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                >
                  <option value="" disabled>-- Pilih Kamar --</option>
                  {availableRooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
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
