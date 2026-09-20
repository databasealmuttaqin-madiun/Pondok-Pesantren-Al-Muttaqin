import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
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

const MySwal = withReactContent(Swal);

export interface GuruSekolahItem {
  id: string;
  guru_id: string;
  nama: string;
  created_at?: string;
}

interface PenggunaUser {
  id: string;
  guru_id?: string | number;
  pengguna_id?: string | number;
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GuruSekolahItem | null>(null);
  const [inputMode, setInputMode] = useState<"select" | "new">("select");
  const [formGuruId, setFormGuruId] = useState("");
  const [newNama, setNewNama] = useState("");
  const [newUsername, setNewUsername] = useState("");

  const showFeedback = (type: "success" | "error", text: string) => {
    if (type === "error") {
      MySwal.fire({
        icon: "error",
        title: "Perhatian",
        text: text,
      });
    }
  };

  /**
   * Memastikan data guru terdaftar di tabel `guru` di database Supabase
   * dan mengembalikan ID numerik dari tabel `guru` agar Foreign Key terpenuhi.
   */
  const resolveOrCreateGuruId = async (options: {
    nama: string;
    username?: string;
    penggunaId?: string | number;
    knownGuruId?: string | number;
  }): Promise<number | string | null> => {
    const { nama, username, penggunaId, knownGuruId } = options;

    // 1. Cek jika knownGuruId ada di tabel `guru`
    if (knownGuruId && !isNaN(Number(knownGuruId))) {
      try {
        const { data: checkId } = await supabase
          .from("guru")
          .select("id")
          .eq("id", Number(knownGuruId))
          .limit(1);
        if (checkId && checkId.length > 0) {
          return checkId[0].id;
        }
      } catch (e) {
        console.warn("Check guru by id notice:", e);
      }
    }

    // 2. Cek di tabel `guru` berdasarkan pengguna_id
    if (penggunaId && !isNaN(Number(penggunaId))) {
      try {
        const { data: byPengguna } = await supabase
          .from("guru")
          .select("id")
          .eq("pengguna_id", Number(penggunaId))
          .limit(1);
        if (byPengguna && byPengguna.length > 0) {
          return byPengguna[0].id;
        }
      } catch (e) {
        console.warn("Check guru by pengguna_id notice:", e);
      }
    }

    // 3. Cek di tabel `guru` berdasarkan username
    if (username && username.trim()) {
      try {
        const { data: byUname } = await supabase
          .from("guru")
          .select("id")
          .eq("username", username.trim())
          .limit(1);
        if (byUname && byUname.length > 0) {
          return byUname[0].id;
        }
      } catch (e) {
        console.warn("Check guru by username notice:", e);
      }
    }

    // 4. Cek di tabel `guru` berdasarkan nama_lengkap atau nama
    if (nama && nama.trim()) {
      try {
        const { data: byName } = await supabase
          .from("guru")
          .select("id, nama_lengkap, nama");
        if (byName && byName.length > 0) {
          const found = byName.find(
            (g: any) =>
              (g.nama_lengkap && g.nama_lengkap.trim().toLowerCase() === nama.trim().toLowerCase()) ||
              (g.nama && g.nama.trim().toLowerCase() === nama.trim().toLowerCase())
          );
          if (found) {
            return found.id;
          }
        }
      } catch (e) {
        console.warn("Check guru by name notice:", e);
      }
    }

    // 5. Jika belum ada di tabel `guru`, buat baris baru di tabel `guru`
    try {
      const payload: any = {
        nama_lengkap: nama.trim(),
        nama: nama.trim(),
        bagian: "Sekolah"
      };
      if (username && username.trim()) payload.username = username.trim();
      if (penggunaId && !isNaN(Number(penggunaId))) payload.pengguna_id = Number(penggunaId);

      const { data: inserted, error: insErr } = await supabase
        .from("guru")
        .insert([payload])
        .select("id");

      if (!insErr && inserted && inserted.length > 0) {
        return inserted[0].id;
      }

      // Fallback minimal insert
      if (insErr) {
        const { data: minInserted } = await supabase
          .from("guru")
          .insert([{ nama_lengkap: nama.trim() }])
          .select("id");
        if (minInserted && minInserted.length > 0) {
          return minInserted[0].id;
        }
      }
    } catch (err) {
      console.error("Failed to insert into guru table:", err);
    }

    return null;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch data SEMUA pengguna dari tabel 'pengguna' & 'guru'
      const gList: PenggunaUser[] = [];
      let dbPenggunaList: any[] = [];
      let dbGuruList: any[] = [];

      try {
        const { data: dbPengguna, error: pErr } = await supabase
          .from("pengguna")
          .select("*")
          .order("nama_lengkap", { ascending: true });
        
        if (!pErr && dbPengguna) {
          dbPenggunaList = dbPengguna;
        } else {
          const { data: pFallback } = await supabase.from("pengguna").select("*");
          if (pFallback) dbPenggunaList = pFallback;
        }
      } catch (errP) {
        console.warn("Notice when fetching pengguna table:", errP);
      }

      try {
        const { data: dbGuru } = await supabase.from("guru").select("*");
        if (dbGuru) dbGuruList = dbGuru;
      } catch (errG) {
        console.warn("Notice when fetching guru table:", errG);
      }

      // Masukkan guru dari tabel guru terlebih dahulu
      dbGuruList.forEach((g: any) => {
        const matchedUser = dbPenggunaList.find(
          (u: any) =>
            (g.pengguna_id && String(u.id) === String(g.pengguna_id)) ||
            (g.username && u.username && u.username.toLowerCase() === g.username.toLowerCase())
        );
        const resolvedName = (g.nama_lengkap || g.nama || matchedUser?.nama_lengkap || matchedUser?.nama || "Guru").trim();
        gList.push({
          id: `guru_${g.id}`,
          guru_id: g.id,
          pengguna_id: g.pengguna_id || matchedUser?.id,
          nama: resolvedName,
          username: g.username || matchedUser?.username
        });
      });

      // Masukkan pengguna yang belum ada di tabel guru
      dbPenggunaList.forEach((u: any) => {
        const resolvedName = (u.nama_lengkap || u.nama || u.username || "Pengguna").trim();
        const alreadyInList = gList.some(
          item =>
            (item.pengguna_id && String(item.pengguna_id) === String(u.id)) ||
            (item.username && u.username && item.username.toLowerCase() === u.username.toLowerCase()) ||
            item.nama.toLowerCase() === resolvedName.toLowerCase()
        );
        if (!alreadyInList) {
          gList.push({
            id: `pengguna_${u.id}`,
            pengguna_id: u.id,
            nama: resolvedName,
            username: u.username
          });
        }
      });

      // Fallback jika kosong untuk demo/testing local
      if (gList.length === 0) {
        gList.push(
          { id: "1", guru_id: 1, nama: "Drs. Bambang Sudarsono M.Pd", username: "bambang" },
          { id: "2", guru_id: 2, nama: "Siti Rahmawati S.Pd", username: "siti" },
          { id: "3", guru_id: 3, nama: "Ahmad Fauzi S.Si", username: "ahmad" },
          { id: "4", guru_id: 4, nama: "Ustaz H. Abdullah S.Pd.I", username: "abdullah" }
        );
      }

      // Filter out duplicate names, prioritizing records with pengguna_id
      const uniqueGList: typeof gList = [];
      const seenNames = new Set<string>();
      const sortedForUniqueness = [...gList].sort((a, b) => {
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

      const sortedGurus = uniqueGList.sort((a, b) => a.nama.localeCompare(b.nama));
      setPenggunaList(sortedGurus);

      // 2. Fetch plotting_guru_sekolah from Supabase
      try {
        const { data: dbPlot, error } = await supabase
          .from("plotting_guru_sekolah")
          .select("*")
          .order("id", { ascending: true });

        if (!error && dbPlot) {
          const mapped: GuruSekolahItem[] = dbPlot.map((item: any) => {
            const rawId = String(item.guru_id || "");
            const explicitName = item.guru_nama || item.nama;

            // Cari dari guru list
            const matchedGuru = sortedGurus.find(
              g => String(g.guru_id) === rawId ||
                   String(g.pengguna_id) === rawId ||
                   g.id === rawId ||
                   (g.username && g.username.toLowerCase() === rawId.toLowerCase()) ||
                   g.nama.toLowerCase() === rawId.toLowerCase()
            );

            // Coba cari dari dbGuru jika guru_id mereferensikan tabel guru
            const matchedDbGuru = dbGuruList.find(
              g => String(g.id) === rawId || 
                   (g.pengguna_id && String(g.pengguna_id) === rawId)
            );
            const fallbackName = matchedDbGuru ? (matchedDbGuru.nama_lengkap || matchedDbGuru.nama) : null;

            return {
              id: String(item.id),
              guru_id: rawId,
              nama: explicitName || (matchedGuru ? matchedGuru.nama : (fallbackName || "Guru Sekolah")),
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
    setInputMode("select");
    setFormGuruId(penggunaList[0]?.id || "");
    setNewNama("");
    setNewUsername("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: GuruSekolahItem) => {
    setEditingItem(item);
    setInputMode("select");
    const matched = penggunaList.find(
      u => String(u.guru_id) === String(item.guru_id) || u.nama.toLowerCase() === item.nama.toLowerCase()
    );
    setFormGuruId(matched?.id || penggunaList[0]?.id || "");
    setNewNama(item.nama);
    setNewUsername("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let targetGuruNama = "";
    let targetUsername = "";
    let targetPenggunaId: string | number | undefined = undefined;
    let targetKnownGuruId: string | number | undefined = undefined;

    if (inputMode === "new") {
      if (!newNama.trim()) {
        showFeedback("error", "Harap isi Nama Guru baru!");
        return;
      }
      targetGuruNama = newNama.trim();
      targetUsername = (newUsername.trim() || targetGuruNama.toLowerCase().replace(/[^a-z0-9]/g, "")).toLowerCase();
    } else {
      if (!formGuruId) {
        showFeedback("error", "Harap pilih nama guru dari daftar!");
        return;
      }
      const selectedPengguna = penggunaList.find(u => u.id === formGuruId);
      targetGuruNama = selectedPengguna ? selectedPengguna.nama : "Guru Sekolah";
      targetUsername = selectedPengguna?.username || "";
      targetPenggunaId = selectedPengguna?.pengguna_id;
      targetKnownGuruId = selectedPengguna?.guru_id;
    }

    // Prevent duplicate teacher assignment
    const duplicate = items.find(
      it => (it.nama.toLowerCase() === targetGuruNama.toLowerCase() || (targetKnownGuruId && String(it.guru_id) === String(targetKnownGuruId))) && 
            (!editingItem || it.id !== editingItem.id)
    );
    if (duplicate) {
      showFeedback("error", `"${targetGuruNama}" sudah terdaftar sebagai Guru Sekolah.`);
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Jika mode tambah baru, simpan akun ke tabel `pengguna` jika belum ada
      if (inputMode === "new") {
        try {
          const { data: newP } = await supabase
            .from("pengguna")
            .insert([{
              nama: targetGuruNama,
              nama_lengkap: targetGuruNama,
              username: targetUsername,
              role: "guru smp",
              peran_utama: "guru_sekolah",
              bagian: "Sekolah",
              status_akun: "aktif"
            }])
            .select("id");

          if (newP && newP[0]) {
            targetPenggunaId = newP[0].id;
          }
        } catch (eP) {
          console.warn("Notice insert pengguna:", eP);
        }
      }

      // 2. Dapatkan atau buat baris di tabel `guru` (KUNCI FOREIGN KEY CONSTRAINT)
      const resolvedGuruId = await resolveOrCreateGuruId({
        nama: targetGuruNama,
        username: targetUsername,
        penggunaId: targetPenggunaId,
        knownGuruId: targetKnownGuruId
      });

      if (!resolvedGuruId) {
        showFeedback("error", "Gagal menghubungkan data ke tabel Guru di database.");
        setIsSubmitting(false);
        return;
      }

      const foreignKeyGuruId = !isNaN(Number(resolvedGuruId)) ? Number(resolvedGuruId) : resolvedGuruId;

      // 3. Simpan ke database Supabase tabel 'plotting_guru_sekolah'
      if (editingItem) {
        let updateSuccess = false;
        let lastErrorMsg = "";

        // Update dengan guru_id
        try {
          const { error: err1 } = await supabase
            .from("plotting_guru_sekolah")
            .update({
              guru_id: foreignKeyGuruId
            })
            .eq("id", editingItem.id);
          if (!err1) {
            updateSuccess = true;
          } else {
            lastErrorMsg = err1.message;
          }
        } catch (e1: any) {
          lastErrorMsg = e1?.message || "";
        }

        if (!updateSuccess && lastErrorMsg) {
          showFeedback("error", `Gagal memperbarui di database: ${lastErrorMsg}`);
          setIsSubmitting(false);
          return;
        }

        showFeedback("success", `Data Guru Sekolah "${targetGuruNama}" berhasil diperbarui di database!`);
        MySwal.fire({
          icon: "success",
          title: "Berhasil Disimpan!",
          text: `Data Guru Sekolah "${targetGuruNama}" berhasil diperbarui di database.`,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        // Insert new record
        let insertSuccess = false;
        let lastErrorMsg = "";

        try {
          const { data: ins1, error: err1 } = await supabase
            .from("plotting_guru_sekolah")
            .insert([{
              guru_id: foreignKeyGuruId
            }])
            .select();

          if (!err1 && ins1 && ins1.length > 0) {
            insertSuccess = true;
          } else if (err1) {
            lastErrorMsg = err1.message;
          }
        } catch (e1: any) {
          lastErrorMsg = e1?.message || "";
        }

        if (!insertSuccess && lastErrorMsg) {
          showFeedback("error", `Gagal menyimpan ke database Supabase: ${lastErrorMsg}`);
          setIsSubmitting(false);
          return;
        }

        showFeedback("success", `Guru Sekolah "${targetGuruNama}" berhasil disimpan ke database!`);
        MySwal.fire({
          icon: "success",
          title: "Berhasil Ditugaskan!",
          text: `Guru Sekolah "${targetGuruNama}" berhasil disimpan ke database.`,
          timer: 2000,
          showConfirmButton: false
        });
      }

      setIsModalOpen(false);
      // Re-fetch straight from Supabase database
      await fetchData();

    } catch (err: any) {
      showFeedback("error", `Terjadi kesalahan saat menyimpan: ${err?.message || "Koneksi database bermasalah"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, guruNama: string) => {
    const res = await MySwal.fire({
      title: "Hapus Penugasan?",
      text: `Apakah Anda yakin ingin menghapus penugasan Guru Sekolah "${guruNama}"?`,
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
    localStorage.setItem("plotting_guru_sekolah_data", JSON.stringify(filtered));

    try {
      await supabase.from("plotting_guru_sekolah").delete().eq("id", id);
    } catch (err: any) {
      console.warn("Supabase delete error:", err?.message);
    }

    showFeedback("success", `Guru Sekolah "${guruNama}" berhasil dihapus.`);
    MySwal.fire({
      icon: "success",
      title: "Berhasil Dihapus",
      text: `Penugasan Guru Sekolah "${guruNama}" telah dihapus.`,
      timer: 1800,
      showConfirmButton: false
    });
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
              {!editingItem && (
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setInputMode("select")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      inputMode === "select"
                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Pilih dari Pengguna
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("new")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      inputMode === "new"
                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    + Input Nama Baru
                  </button>
                </div>
              )}

              {inputMode === "select" && !editingItem ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nama Guru <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formGuruId}
                    onChange={(e) => setFormGuruId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  >
                    <option value="" disabled>-- Pilih Nama Guru --</option>
                    {penggunaList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nama}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nama Lengkap Guru <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newNama}
                      onChange={(e) => setNewNama(e.target.value)}
                      placeholder="Contoh: Drs. Bambang Sudarsono, M.Pd"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      required
                    />
                  </div>
                  {!editingItem && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Username ID (Opsional)
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Contoh: bambang_s"
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}

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
                  <span>{isSubmitting ? "Menyimpan ke Database..." : "Simpan Penugasan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
