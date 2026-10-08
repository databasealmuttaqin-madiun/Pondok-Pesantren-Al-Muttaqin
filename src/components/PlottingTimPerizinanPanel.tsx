import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  User, 
  Check, 
  X,
  FileCheck,
  UserCheck
} from "lucide-react";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

const MySwal = withReactContent(Swal);

export interface TimPerizinanItem {
  id: string;
  guru_id?: string;
  guru_username: string;
  guru_nama: string;
  jabatan: string;
  no_hp?: string;
  created_at?: string;
}

interface TeacherOption {
  id: string;
  guru_id?: string;
  pengguna_id?: string;
  nama: string;
  username: string;
  no_hp?: string;
}

export default function PlottingTimPerizinanPanel() {
  const [items, setItems] = useState<TimPerizinanItem[]>(() => {
    try {
      const saved = localStorage.getItem("plotting_tim_perizinan_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [teacherList, setTeacherList] = useState<TeacherOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TimPerizinanItem | null>(null);
  const [selectedGuruUsername, setSelectedGuruUsername] = useState("");
  const [formJabatan, setFormJabatan] = useState("Anggota Tim Perizinan");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch teachers from 'guru' & 'pengguna' tables
      const tList: TeacherOption[] = [];
      let dbGuruList: any[] = [];
      let dbPenggunaList: any[] = [];

      try {
        const { data: dbPengguna } = await supabase
          .from("pengguna")
          .select("*")
          .order("nama_lengkap", { ascending: true });
        if (dbPengguna) dbPenggunaList = dbPengguna;
      } catch (err) {
        console.warn("Notice fetching pengguna table:", err);
      }

      try {
        const { data: dbGuru } = await supabase.from("guru").select("*");
        if (dbGuru) dbGuruList = dbGuru;
      } catch (err) {
        console.warn("Notice fetching guru table:", err);
      }

      // Merge teachers
      dbGuruList.forEach((g: any) => {
        const matchedUser = dbPenggunaList.find(
          (u: any) =>
            (g.pengguna_id && String(u.id) === String(g.pengguna_id)) ||
            (g.username && u.username && u.username.toLowerCase() === g.username.toLowerCase())
        );
        const resolvedName = (g.nama_lengkap || g.nama || matchedUser?.nama_lengkap || matchedUser?.nama || "Guru").trim();
        const resolvedUname = g.username || matchedUser?.username || `guru_${g.id}`;

        tList.push({
          id: String(g.id),
          guru_id: String(g.id),
          pengguna_id: g.pengguna_id ? String(g.pengguna_id) : matchedUser?.id ? String(matchedUser.id) : undefined,
          nama: resolvedName,
          username: resolvedUname,
          no_hp: g.nomor_hp || matchedUser?.no_hp || ""
        });
      });

      dbPenggunaList.forEach((u: any) => {
        const resolvedName = (u.nama_lengkap || u.nama || u.username || "Guru").trim();
        const resolvedUname = u.username || `user_${u.id}`;
        const alreadyInList = tList.some(
          item =>
            (item.pengguna_id && String(item.pengguna_id) === String(u.id)) ||
            (item.username && item.username.toLowerCase() === resolvedUname.toLowerCase()) ||
            item.nama.toLowerCase() === resolvedName.toLowerCase()
        );
        if (!alreadyInList) {
          tList.push({
            id: String(u.id),
            pengguna_id: String(u.id),
            nama: resolvedName,
            username: resolvedUname,
            no_hp: u.no_hp || ""
          });
        }
      });

      // Filter unique teachers by name
      const uniqueTList: TeacherOption[] = [];
      const seenNames = new Set<string>();
      for (const t of tList) {
        const norm = t.nama.toLowerCase();
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          uniqueTList.push(t);
        }
      }

      const sortedTeachers = uniqueTList.sort((a, b) => a.nama.localeCompare(b.nama));
      setTeacherList(sortedTeachers);

      // 2. Fetch plotting_tim_perizinan from Supabase
      try {
        const { data: dbTim, error } = await supabase
          .from("plotting_tim_perizinan")
          .select("*")
          .order("id", { ascending: true });

        if (!error && dbTim && dbTim.length > 0) {
          const mapped: TimPerizinanItem[] = dbTim.map((item: any) => {
            const rawUname = item.guru_username || item.username || "";
            const matchedT = sortedTeachers.find(
              t => (rawUname && t.username.toLowerCase() === rawUname.toLowerCase()) ||
                   (item.guru_nama && t.nama.toLowerCase() === item.guru_nama.toLowerCase()) ||
                   (item.guru_id && String(t.guru_id) === String(item.guru_id))
            );

            return {
              id: String(item.id),
              guru_id: item.guru_id ? String(item.guru_id) : matchedT?.guru_id,
              guru_username: rawUname || matchedT?.username || "guru",
              guru_nama: item.guru_nama || item.nama || matchedT?.nama || "Guru Sekolah",
              jabatan: item.jabatan || "Anggota Tim Perizinan",
              no_hp: item.no_hp || matchedT?.no_hp || "",
              created_at: item.created_at
            };
          });
          setItems(mapped);
          localStorage.setItem("plotting_tim_perizinan_data", JSON.stringify(mapped));
        } else {
          const saved = localStorage.getItem("plotting_tim_perizinan_data");
          if (saved) setItems(JSON.parse(saved));
        }
      } catch (err) {
        console.warn("Notice fetching plotting_tim_perizinan:", err);
        const saved = localStorage.getItem("plotting_tim_perizinan_data");
        if (saved) setItems(JSON.parse(saved));
      }

    } catch (e: any) {
      console.warn("Fetch data error:", e?.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setSelectedGuruUsername(teacherList[0]?.username || "");
    setFormJabatan("Anggota Tim Perizinan");
    setIsModalOpen(true);
  };

  const openEditModal = (item: TimPerizinanItem) => {
    setEditingItem(item);
    setSelectedGuruUsername(item.guru_username);
    setFormJabatan(item.jabatan || "Anggota Tim Perizinan");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGuruUsername) {
      MySwal.fire({
        icon: "warning",
        title: "Perhatian",
        text: "Pilih guru yang bertugas terlebih dahulu.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    const matchedTeacher = teacherList.find(t => t.username === selectedGuruUsername);
    const teacherName = matchedTeacher ? matchedTeacher.nama : "Guru Sekolah";

    // Duplicate check
    const duplicate = items.find(
      it => it.guru_username.toLowerCase() === selectedGuruUsername.toLowerCase() &&
            (!editingItem || it.id !== editingItem.id)
    );

    if (duplicate) {
      MySwal.fire({
        icon: "warning",
        title: "Guru Sudah Terdaftar",
        text: `${teacherName} sudah terdaftar sebagai anggota Tim Perizinan.`,
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      guru_id: matchedTeacher?.guru_id || matchedTeacher?.id || null,
      guru_username: selectedGuruUsername,
      guru_nama: teacherName,
      jabatan: formJabatan,
      no_hp: matchedTeacher?.no_hp || ""
    };

    try {
      if (editingItem) {
        // Update in Supabase
        const { error } = await supabase
          .from("plotting_tim_perizinan")
          .update(payload)
          .eq("id", editingItem.id);

        if (error) {
          console.warn("Notice updating plotting_tim_perizinan:", error.message);
        }

        const updatedList = items.map(it => {
          if (it.id === editingItem.id) {
            return {
              ...it,
              ...payload
            };
          }
          return it;
        });

        setItems(updatedList);
        localStorage.setItem("plotting_tim_perizinan_data", JSON.stringify(updatedList));

      } else {
        // Insert into Supabase
        const { data: inserted, error } = await supabase
          .from("plotting_tim_perizinan")
          .insert([payload])
          .select()
          .single();

        let newItem: TimPerizinanItem;
        if (!error && inserted) {
          newItem = {
            id: String(inserted.id),
            ...payload
          };
        } else {
          newItem = {
            id: `tp_${Date.now()}`,
            ...payload
          };
        }

        const updatedList = [...items, newItem];
        setItems(updatedList);
        localStorage.setItem("plotting_tim_perizinan_data", JSON.stringify(updatedList));
      }

      MySwal.fire({
        icon: "success",
        title: "Berhasil Disimpan",
        text: `${teacherName} telah ditunjuk sebagai Tim Perizinan Guru.`,
        confirmButtonColor: "#2563eb",
        timer: 2000
      });

      setIsModalOpen(false);

    } catch (err: any) {
      console.error("Gagal menyimpan tim perizinan:", err);
      MySwal.fire({
        icon: "error",
        title: "Gagal Menyimpan",
        text: err?.message || "Terjadi kesalahan saat menyimpan data.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: TimPerizinanItem) => {
    const confirmRes = await MySwal.fire({
      title: "Hapus Anggota Tim?",
      text: `Apakah Anda yakin ingin menghapus ${item.guru_nama} dari Tim Perizinan?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal"
    });

    if (!confirmRes.isConfirmed) return;

    try {
      await supabase.from("plotting_tim_perizinan").delete().eq("id", item.id);
    } catch (_) {}

    const updatedList = items.filter(it => it.id !== item.id);
    setItems(updatedList);
    localStorage.setItem("plotting_tim_perizinan_data", JSON.stringify(updatedList));

    MySwal.fire({
      icon: "success",
      title: "Berhasil Dihapus",
      text: `${item.guru_nama} telah dihapus dari Tim Perizinan.`,
      confirmButtonColor: "#2563eb",
      timer: 1800
    });
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      it =>
        it.guru_nama.toLowerCase().includes(q) ||
        it.guru_username.toLowerCase().includes(q) ||
        it.jabatan.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fadeIn pb-16">
      
      {/* HEADER SECTION */}
      <PageHeader
        category="Plotting Sekolah"
        title="Tim Perizinan Guru"
      />

      {/* TOOLBAR & MAIN CARD */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Top Action Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama guru atau jabatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* CIRCULAR REFRESH BUTTON */}
            <button
              onClick={() => fetchData()}
              disabled={isLoading}
              className="p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs disabled:opacity-50"
              title="Refresh Data Tabel"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>

            {/* Add Member Button */}
            <button
              onClick={openAddModal}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Anggota Tim</span>
            </button>
          </div>
        </div>

        {/* TABLE TIM PERIZINAN */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Guru</th>
                <th className="py-3 px-4">Jabatan Tim</th>
                <th className="py-3 px-4 text-center">Hak Akses Approve</th>
                <th className="py-3 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <div className="inline-flex items-center gap-2 text-slate-400 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Memuat data tim perizinan...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    {searchQuery ? "Tidak ada anggota tim yang cocok dengan pencarian." : "Belum ada guru yang ditunjuk sebagai Tim Perizinan."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* No */}
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Nama Guru */}
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{item.guru_nama}</div>
                    </td>

                    {/* Jabatan Tim */}
                    <td className="py-3 px-4 text-slate-700">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        {item.jabatan}
                      </span>
                    </td>

                    {/* Hak Akses Approve */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Diberikan Akses</span>
                      </span>
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
                          title="Edit Anggota"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                          title="Hapus Anggota"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INPUT / EDIT TIM PERIZINAN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-blue-600" />
                <span>{editingItem ? "Edit Anggota Tim Perizinan" : "Penunjukan Tim Perizinan Guru"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              
              {/* Pilih Guru */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Pilih Guru yang Ditunjuk <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedGuruUsername}
                  onChange={(e) => setSelectedGuruUsername(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
                  required
                >
                  {teacherList.map((t) => (
                    <option key={t.id} value={t.username}>
                      {t.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Jabatan Tim */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Jabatan dalam Tim Perizinan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formJabatan}
                  onChange={(e) => setFormJabatan(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
                >
                  <option value="Ketua Tim Perizinan">Ketua Tim Perizinan</option>
                  <option value="Anggota Tim Perizinan">Anggota Tim Perizinan</option>
                  <option value="Penanggung Jawab Absensi">Penanggung Jawab Absensi</option>
                  <option value="Sekretaris Tim">Sekretaris Tim</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan Penunjukan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
