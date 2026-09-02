import { SearchableSelect } from './ui/SearchableSelect';
import { PageHeader } from './ui/PageHeader';
import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Award,
  UserMinus,
  Download,
  Eye,
  Edit3,
  Trash2,
  RotateCcw,
  Calendar,
  GraduationCap,
  FileText,
  X,
  Building,
  User,
  Users,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { supabase, SantriData } from "../supabaseClient";

export interface SiswaLulus {
  id: string | number;
  santri_id?: number;
  nama_lengkap: string;
  nik: string;
  nisn?: string;
  jenis_kelamin: "L" | "P";
  kategori: "SMP" | "SMA" | "Reguler";
  tahun_lulus: string;
  tanggal_lulus: string;
  no_ijazah?: string;
  lanjutan_studi?: string;
  keterangan?: string;
  created_at?: string;
}

export interface SiswaMutasi {
  id: string | number;
  santri_id?: number;
  nama_lengkap: string;
  nik: string;
  nisn?: string;
  jenis_kelamin: "L" | "P";
  kategori: "SMP" | "SMA" | "Reguler";
  jenis_mutasi: "Pindah Sekolah" | "Pindah Pondok" | "Keluar/Berhenti" | "Lainnya";
  tanggal_mutasi: string;
  tujuan_mutasi: string;
  alasan_mutasi: string;
  no_surat_mutasi?: string;
  keterangan?: string;
  created_at?: string;
}

interface SiswaLulusMutasiPanelProps {
  currentUserRole?: string;
  viewMode: "lulus" | "mutasi";
  onSwitchMode?: (mode: "lulus" | "mutasi") => void;
  activeStudents?: SantriData[];
  onRestoreStudent?: (student: SantriData) => void;
  onDataChanged?: () => void;
}

export default function SiswaLulusMutasiPanel({ currentUserRole,
  viewMode,
  onSwitchMode,
  activeStudents = [],
  onDataChanged,
}: SiswaLulusMutasiPanelProps) {
  // State for Lulus & Mutasi records - initialize with empty arrays and clean mock data
  const [lulusList, setLulusList] = useState<SiswaLulus[]>(() => {
    const saved = localStorage.getItem("siswa_lulus_data");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((i: any) => !String(i.id).startsWith("lul_")) : [];
    } catch {
      return [];
    }
  });

  const [mutasiList, setMutasiList] = useState<SiswaMutasi[]>(() => {
    const saved = localStorage.getItem("siswa_mutasi_data");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((i: any) => !String(i.id).startsWith("mut_")) : [];
    } catch {
      return [];
    }
  });

  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterGender, setFilterGender] = useState<string>("All");
  const [filterTahunLulus, setFilterTahunLulus] = useState<string>("All");
  const [filterJenisMutasi, setFilterJenisMutasi] = useState<string>("All");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSelectActiveModal, setShowSelectActiveModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SiswaLulus | SiswaMutasi | null>(null);
  const [viewingItem, setViewingItem] = useState<SiswaLulus | SiswaMutasi | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiswaLulus | SiswaMutasi | null>(null);

  // Active Student Selection Search
  const [activeSearch, setActiveSearch] = useState("");

  // Form Fields
  const [formNama, setFormNama] = useState("");
  const [formNik, setFormNik] = useState("");
  const [formNisn, setFormNisn] = useState("");
  const [formGender, setFormGender] = useState<"L" | "P">("L");
  const [formKategori, setFormKategori] = useState<"SMP" | "SMA" | "Reguler">("SMP");
  
  // Lulus Form Fields
  const [formTahunLulus, setFormTahunLulus] = useState(new Date().getFullYear().toString());
  const [formTanggalLulus, setFormTanggalLulus] = useState(new Date().toISOString().split("T")[0]);
  const [formNoIjazah, setFormNoIjazah] = useState("");
  const [formLanjutanStudi, setFormLanjutanStudi] = useState("");
  
  // Mutasi Form Fields
  const [formJenisMutasi, setFormJenisMutasi] = useState<"Pindah Sekolah" | "Pindah Pondok" | "Keluar/Berhenti" | "Lainnya">("Pindah Sekolah");
  const [formTanggalMutasi, setFormTanggalMutasi] = useState(new Date().toISOString().split("T")[0]);
  const [formTujuanMutasi, setFormTujuanMutasi] = useState("");
  const [formAlasanMutasi, setFormAlasanMutasi] = useState("");
  const [formNoSuratMutasi, setFormNoSuratMutasi] = useState("");
  
  const [formKeterangan, setFormKeterangan] = useState("");

  // Load real data from Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchFromSupabase = async () => {
      setIsLoadingDb(true);

      // 1. Fetch LULUS
      try {
        let { data: dbLulus, error: errLulus } = await supabase
          .from("siswa_lulus")
          .select("*")
          .order("id", { ascending: false });

        if (errLulus || !dbLulus) {
          const { data: altLulus } = await supabase
            .from("lulus")
            .select("*")
            .order("id", { ascending: false });
          if (altLulus) dbLulus = altLulus;
        }

        if (isMounted && dbLulus) {
          setLulusList(dbLulus);
          localStorage.setItem("siswa_lulus_data", JSON.stringify(dbLulus));
        }
      } catch (err) {
        console.warn("Could not load siswa_lulus from Supabase:", err);
      }

      // 2. Fetch MUTASI
      try {
        let { data: dbMutasi, error: errMutasi } = await supabase
          .from("siswa_mutasi")
          .select("*")
          .order("id", { ascending: false });

        if (errMutasi || !dbMutasi) {
          const { data: altMutasi } = await supabase
            .from("mutasi")
            .select("*")
            .order("id", { ascending: false });
          if (altMutasi) dbMutasi = altMutasi;
        }

        if (isMounted && dbMutasi) {
          setMutasiList(dbMutasi);
          localStorage.setItem("siswa_mutasi_data", JSON.stringify(dbMutasi));
        }
      } catch (err) {
        console.warn("Could not load siswa_mutasi from Supabase:", err);
      } finally {
        if (isMounted) setIsLoadingDb(false);
      }
    };

    fetchFromSupabase();

    return () => {
      isMounted = false;
    };
  }, []);

  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [showPredictions, setShowPredictions] = useState<boolean>(false);

  // Filter active students for live predictions as user types in formNama
  const predictedStudents = React.useMemo(() => {
    if (!formNama.trim() || editingItem) return [];
    const q = formNama.toLowerCase().trim();
    return activeStudents
      .filter(
        (s) =>
          s.nama_lengkap.toLowerCase().includes(q) ||
          (s.nama_panggilan && s.nama_panggilan.toLowerCase().includes(q)) ||
          s.nik.includes(q) ||
          (s.nisn && s.nisn.includes(q))
      )
      .slice(0, 6);
  }, [formNama, activeStudents, editingItem]);

  // Persist to local storage as fallback
  useEffect(() => {
    localStorage.setItem("siswa_lulus_data", JSON.stringify(lulusList));
  }, [lulusList]);

  useEffect(() => {
    localStorage.setItem("siswa_mutasi_data", JSON.stringify(mutasiList));
  }, [mutasiList]);

  // Select student from dropdown in add form
  const handleSelectStudentFromDropdown = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (!studentId) return;
    const student = activeStudents.find(
      (s) => String(s.id) === studentId || s.nik === studentId
    );
    if (student) {
      setFormNama(student.nama_lengkap);
      setFormNik(student.nik);
      setFormNisn(student.nisn || "");
      setFormGender(student.jenis_kelamin === "P" ? "P" : "L");
      setFormKategori(student.kategori);
      setFormKeterangan(
        `Diambil dari data siswa aktif (Kamar: ${student.kamar || "-"}, Kelas: ${
          student.kelas_sekolah || student.kelas_pengajian || "-"
        })`
      );
    }
  };

  // Open add modal for a selected active student
  const handleSelectActiveStudent = (student: SantriData) => {
    setShowSelectActiveModal(false);
    setEditingItem(null);
    setSelectedStudentId(String(student.id || student.nik));
    setFormNama(student.nama_lengkap);
    setFormNik(student.nik);
    setFormNisn(student.nisn || "");
    setFormGender(student.jenis_kelamin === "P" ? "P" : "L");
    setFormKategori(student.kategori);
    setFormKeterangan(`Diubah dari siswa aktif (Kamar: ${student.kamar || "-"}, Kelas: ${student.kelas_sekolah || student.kelas_pengajian || "-"})`);
    setShowAddModal(true);
  };

  // Open new add modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setSelectedStudentId("");
    setFormNama("");
    setFormNik("");
    setFormNisn("");
    setFormGender("L");
    setFormKategori("SMP");
    setFormTahunLulus(new Date().getFullYear().toString());
    setFormTanggalLulus(new Date().toISOString().split("T")[0]);
    setFormNoIjazah("");
    setFormLanjutanStudi("");
    setFormJenisMutasi("Pindah Sekolah");
    setFormTanggalMutasi(new Date().toISOString().split("T")[0]);
    setFormTujuanMutasi("");
    setFormAlasanMutasi("");
    setFormNoSuratMutasi("");
    setFormKeterangan("");
    setShowAddModal(true);
  };

  // Open edit modal
  const handleOpenEditModal = (item: SiswaLulus | SiswaMutasi) => {
    setEditingItem(item);
    setFormNama(item.nama_lengkap);
    setFormNik(item.nik);
    setFormNisn(item.nisn || "");
    setFormGender(item.jenis_kelamin);
    setFormKategori(item.kategori);
    setFormKeterangan(item.keterangan || "");

    if (viewMode === "lulus") {
      const l = item as SiswaLulus;
      setFormTahunLulus(l.tahun_lulus || new Date().getFullYear().toString());
      setFormTanggalLulus(l.tanggal_lulus || "");
      setFormNoIjazah(l.no_ijazah || "");
      setFormLanjutanStudi(l.lanjutan_studi || "");
    } else {
      const m = item as SiswaMutasi;
      setFormJenisMutasi(m.jenis_mutasi || "Pindah Sekolah");
      setFormTanggalMutasi(m.tanggal_mutasi || "");
      setFormTujuanMutasi(m.tujuan_mutasi || "");
      setFormAlasanMutasi(m.alasan_mutasi || "");
      setFormNoSuratMutasi(m.no_surat_mutasi || "");
    }
    setShowAddModal(true);
  };

  // Save submit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) return;

    if (viewMode === "lulus") {
      const payload: Partial<SiswaLulus> = {
        nama_lengkap: formNama.trim(),
        nik: formNik.trim(),
        nisn: formNisn.trim() || undefined,
        jenis_kelamin: formGender,
        kategori: formKategori,
        tahun_lulus: formTahunLulus.trim(),
        tanggal_lulus: formTanggalLulus,
        no_ijazah: formNoIjazah.trim() || undefined,
        lanjutan_studi: formLanjutanStudi.trim() || undefined,
        keterangan: formKeterangan.trim() || undefined,
      };

      if (editingItem) {
        setLulusList((prev) =>
          prev.map((item) =>
            item.id === editingItem.id ? { ...item, ...payload } : item
          )
        );

        try {
          const { error } = await supabase
            .from("siswa_lulus")
            .update(payload)
            .eq("id", editingItem.id);

          if (error) {
            await supabase.from("lulus").update(payload).eq("id", editingItem.id);
          }
        } catch (err) {
          console.warn("Gagal update data siswa_lulus ke Supabase:", err);
        }
      } else {
        const tempId = `lul_${Date.now()}`;
        const newItem: SiswaLulus = {
          id: tempId,
          ...payload,
          created_at: new Date().toISOString(),
        } as SiswaLulus;

        setLulusList((prev) => [newItem, ...prev]);

        try {
          const { data, error } = await supabase
            .from("siswa_lulus")
            .insert([payload])
            .select();

          if (error) {
            const { data: dataAlt } = await supabase
              .from("lulus")
              .insert([payload])
              .select();
            if (dataAlt && dataAlt[0]) {
              setLulusList((prev) =>
                prev.map((item) => (item.id === tempId ? dataAlt[0] : item))
              );
            }
          } else if (data && data[0]) {
            setLulusList((prev) =>
              prev.map((item) => (item.id === tempId ? data[0] : item))
            );
          }
        } catch (err) {
          console.warn("Gagal insert data siswa_lulus ke Supabase:", err);
        }
      }
    } else {
      const payload: Partial<SiswaMutasi> = {
        nama_lengkap: formNama.trim(),
        nik: formNik.trim(),
        nisn: formNisn.trim() || undefined,
        jenis_kelamin: formGender,
        kategori: formKategori,
        jenis_mutasi: formJenisMutasi,
        tanggal_mutasi: formTanggalMutasi,
        tujuan_mutasi: formTujuanMutasi.trim(),
        alasan_mutasi: formAlasanMutasi.trim(),
        no_surat_mutasi: formNoSuratMutasi.trim() || undefined,
        keterangan: formKeterangan.trim() || undefined,
      };

      if (editingItem) {
        setMutasiList((prev) =>
          prev.map((item) =>
            item.id === editingItem.id ? { ...item, ...payload } : item
          )
        );

        try {
          const { error } = await supabase
            .from("siswa_mutasi")
            .update(payload)
            .eq("id", editingItem.id);

          if (error) {
            await supabase.from("mutasi").update(payload).eq("id", editingItem.id);
          }
        } catch (err) {
          console.warn("Gagal update data siswa_mutasi ke Supabase:", err);
        }
      } else {
        const tempId = `mut_${Date.now()}`;
        const newItem: SiswaMutasi = {
          id: tempId,
          ...payload,
          created_at: new Date().toISOString(),
        } as SiswaMutasi;

        setMutasiList((prev) => [newItem, ...prev]);

        try {
          const { data, error } = await supabase
            .from("siswa_mutasi")
            .insert([payload])
            .select();

          if (error) {
            const { data: dataAlt } = await supabase
              .from("mutasi")
              .insert([payload])
              .select();
            if (dataAlt && dataAlt[0]) {
              setMutasiList((prev) =>
                prev.map((item) => (item.id === tempId ? dataAlt[0] : item))
              );
            }
          } else if (data && data[0]) {
            setMutasiList((prev) =>
              prev.map((item) => (item.id === tempId ? data[0] : item))
            );
          }
        } catch (err) {
          console.warn("Gagal insert data siswa_mutasi ke Supabase:", err);
        }
      }
    }

    setShowAddModal(false);
    if (onDataChanged) onDataChanged();
  };

  // Delete action
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;

    if (viewMode === "lulus") {
      setLulusList((prev) => prev.filter((item) => item.id !== targetId));
      try {
        const { error } = await supabase.from("siswa_lulus").delete().eq("id", targetId);
        if (error) {
          await supabase.from("lulus").delete().eq("id", targetId);
        }
      } catch (err) {
        console.warn("Gagal hapus data siswa_lulus dari Supabase:", err);
      }
    } else {
      setMutasiList((prev) => prev.filter((item) => item.id !== targetId));
      try {
        const { error } = await supabase.from("siswa_mutasi").delete().eq("id", targetId);
        if (error) {
          await supabase.from("mutasi").delete().eq("id", targetId);
        }
      } catch (err) {
        console.warn("Gagal hapus data siswa_mutasi dari Supabase:", err);
      }
    }
    setDeleteTarget(null);
    if (onDataChanged) onDataChanged();
  };

  // Export CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (viewMode === "lulus") {
      headers = ["Nama Lengkap", "Gender", "NIK", "NISN", "Kategori", "Tahun Lulus", "Tanggal Lulus", "No Ijazah", "Lanjutan Studi", "Keterangan"];
      rows = filteredLulus.map((item) => [
        item.nama_lengkap,
        item.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan",
        item.nik,
        item.nisn || "",
        item.kategori,
        item.tahun_lulus,
        item.tanggal_lulus,
        item.no_ijazah || "",
        item.lanjutan_studi || "",
        item.keterangan || "",
      ]);
    } else {
      headers = ["Nama Lengkap", "Gender", "NIK", "NISN", "Kategori", "Jenis Mutasi", "Tanggal Mutasi", "Tujuan Mutasi", "Alasan Mutasi", "No Surat", "Keterangan"];
      rows = filteredMutasi.map((item) => [
        item.nama_lengkap,
        item.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan",
        item.nik,
        item.nisn || "",
        item.kategori,
        item.jenis_mutasi,
        item.tanggal_mutasi,
        item.tujuan_mutasi,
        item.alasan_mutasi,
        item.no_surat_mutasi || "",
        item.keterangan || "",
      ]);
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `data_siswa_${viewMode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered lists
  const filteredLulus = lulusList.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      item.nama_lengkap.toLowerCase().includes(q) ||
      item.nik.includes(q) ||
      (item.nisn && item.nisn.includes(q)) ||
      (item.no_ijazah && item.no_ijazah.toLowerCase().includes(q)) ||
      (item.lanjutan_studi && item.lanjutan_studi.toLowerCase().includes(q));

    const matchCategory = filterCategory === "All" || item.kategori === filterCategory;
    const matchGender = filterGender === "All" || item.jenis_kelamin === filterGender;
    const matchTahun = filterTahunLulus === "All" || item.tahun_lulus === filterTahunLulus;

    return matchSearch && matchCategory && matchGender && matchTahun;
  });

  const filteredMutasi = mutasiList.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      item.nama_lengkap.toLowerCase().includes(q) ||
      item.nik.includes(q) ||
      (item.nisn && item.nisn.includes(q)) ||
      item.tujuan_mutasi.toLowerCase().includes(q) ||
      item.alasan_mutasi.toLowerCase().includes(q);

    const matchCategory = filterCategory === "All" || item.kategori === filterCategory;
    const matchGender = filterGender === "All" || item.jenis_kelamin === filterGender;
    const matchJenis = filterJenisMutasi === "All" || item.jenis_mutasi === filterJenisMutasi;

    return matchSearch && matchCategory && matchGender && matchJenis;
  });

  // Unique years for Lulus dropdown
  const uniqueTahunLulus = Array.from(new Set(lulusList.map((i) => i.tahun_lulus))).filter(Boolean);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-700/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl ${viewMode === "lulus" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-sky-500/10 text-sky-600 dark:text-sky-400"}`}>
              {viewMode === "lulus" ? <Award className="w-8 h-8" /> : <UserMinus className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {viewMode === "lulus" ? "Data Siswa Lulus / Alumni" : "Data Mutasi Siswa"}
                </h1>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${viewMode === "lulus" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"}`}>
                  {viewMode === "lulus" ? "Kelulusan" : "Mutasi / Pindah"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {viewMode === "lulus"
                  ? "Arsip data resmi santri & siswa yang telah menyelesaikan pendidikan dan lulus dari Al Muttaqin."
                  : "Catatan riwayat mutasi, kepindahan, atau siswa keluar dari lembaga pendidikan."}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {onSwitchMode && (
              <div className="flex bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
                <button
                  onClick={() => onSwitchMode("lulus")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "lulus"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Award className="w-3.5 h-3.5" /> Data Lulus
                </button>
                <button
                  onClick={() => onSwitchMode("mutasi")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === "mutasi"
                      ? "bg-sky-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <UserMinus className="w-3.5 h-3.5" /> Data Mutasi
                </button>
              </div>
            )}

            <button
              onClick={handleOpenAddModal}
              className={`flex items-center gap-2 px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
                viewMode === "lulus" ? "bg-amber-600 hover:bg-amber-700" : "bg-sky-600 hover:bg-sky-700"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{viewMode === "lulus" ? "Tambah Siswa Lulus" : "Tambah Siswa Mutasi"}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-700/60">
          <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Total {viewMode === "lulus" ? "Lulus" : "Mutasi"}</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
              {viewMode === "lulus" ? lulusList.length : mutasiList.length} Siswa
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Kategori SMP</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
              {viewMode === "lulus"
                ? lulusList.filter((i) => i.kategori === "SMP").length
                : mutasiList.filter((i) => i.kategori === "SMP").length}{" "}
              Siswa
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">Kategori SMA</span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
              {viewMode === "lulus"
                ? lulusList.filter((i) => i.kategori === "SMA").length
                : mutasiList.filter((i) => i.kategori === "SMA").length}{" "}
              Siswa
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">
              {viewMode === "lulus" ? "Siswa Perempuan (Siswi)" : "Pindah Sekolah"}
            </span>
            <span className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
              {viewMode === "lulus"
                ? lulusList.filter((i) => i.jenis_kelamin === "P").length
                : mutasiList.filter((i) => i.jenis_mutasi === "Pindah Sekolah").length}{" "}
              Siswa
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={viewMode === "lulus" ? "Cari nama, NIK, NISN, no. ijazah..." : "Cari nama, NIK, tujuan mutasi..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600">
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Gender Filter */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <User className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer text-xs"
            >
              <option value="All">Gender: Semua (Siswa & Siswi)</option>
              <option value="L">Laki-laki (Siswa)</option>
              <option value="P">Perempuan (Siswi)</option>
            </select>
          </div>

          {/* Kategori Filter */}
          <div className="flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer text-xs"
            >
              <option value="All">Kategori: Semua</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
              <option value="Reguler">Reguler</option>
            </select>
          </div>

          {/* Special Filter based on mode */}
          {viewMode === "lulus" ? (
            <div className="flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                value={filterTahunLulus}
                onChange={(e) => setFilterTahunLulus(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer text-xs"
              >
                <option value="All">Tahun Lulus: Semua</option>
                {uniqueTahunLulus.map((th) => (
                  <option key={th} value={th}>
                    Tahun {th}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                value={filterJenisMutasi}
                onChange={(e) => setFilterJenisMutasi(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 outline-none cursor-pointer text-xs"
              >
                <option value="All">Jenis Mutasi: Semua</option>
                <option value="Pindah Sekolah">Pindah Sekolah</option>
                <option value="Pindah Pondok">Pindah Pondok</option>
                <option value="Keluar/Berhenti">Keluar / Berhenti</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer ml-auto"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
        {viewMode === "lulus" ? (
          /* LULUS TABLE */
          filteredLulus.length === 0 ? (
            <div className="py-16 text-center">
              <Award className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Belum Ada Data Siswa Lulus</h3>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan pencarian atau tambahkan data lulus baru.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">No</th>
                    <th className="py-3.5 px-4">Nama Siswa</th>
                    <th className="py-3.5 px-4">NIK / NISN</th>
                    <th className="py-3.5 px-4">Kategori</th>
                    <th className="py-3.5 px-4">Thn & Tgl Lulus</th>
                    <th className="py-3.5 px-4">No. Ijazah</th>
                    <th className="py-3.5 px-4">Lanjutan Studi / Pekerjaan</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredLulus.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono font-semibold">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${item.jenis_kelamin === "P" ? "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"}`}>
                            {item.jenis_kelamin === "P" ? "🧕" : "👳"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{item.nama_lengkap}</div>
                            <span className="text-[10px] text-slate-400">{item.jenis_kelamin === "P" ? "Perempuan (Siswi)" : "Laki-laki (Siswa)"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{item.nik}</div>
                        {item.nisn && <div className="text-[10px] text-slate-400 font-mono">NISN: {item.nisn}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                          {item.kategori}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">Tahun {item.tahun_lulus}</div>
                        <div className="text-[10px] text-slate-400">{item.tanggal_lulus}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {item.no_ijazah || <span className="text-slate-400 font-sans italic">-</span>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {item.lanjutan_studi || <span className="text-slate-400 italic">-</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingItem(item)}
                            className="p-1.5 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Detail Siswa Lulus"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {currentUserRole !== "guru SMP" && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Edit Data"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Hapus Data"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* MUTASI TABLE */
          filteredMutasi.length === 0 ? (
            <div className="py-16 text-center">
              <UserMinus className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Belum Ada Data Siswa Mutasi</h3>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan pencarian atau tambahkan data mutasi baru.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 w-12 text-center">No</th>
                    <th className="py-3.5 px-4">Nama Siswa</th>
                    <th className="py-3.5 px-4">NIK / NISN</th>
                    <th className="py-3.5 px-4">Jenis Mutasi</th>
                    <th className="py-3.5 px-4">Tgl Mutasi</th>
                    <th className="py-3.5 px-4">Tujuan Mutasi</th>
                    <th className="py-3.5 px-4">Alasan & No. Surat</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredMutasi.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono font-semibold">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${item.jenis_kelamin === "P" ? "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"}`}>
                            {item.jenis_kelamin === "P" ? "🧕" : "👳"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{item.nama_lengkap}</div>
                            <span className="text-[10px] text-slate-400">{item.jenis_kelamin === "P" ? "Perempuan (Siswi)" : "Laki-laki (Siswa)"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{item.nik}</div>
                        {item.nisn && <div className="text-[10px] text-slate-400 font-mono">NISN: {item.nisn}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40">
                          {item.jenis_mutasi}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {item.tanggal_mutasi}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {item.tujuan_mutasi}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        <div className="truncate max-w-xs">{item.alasan_mutasi}</div>
                        {item.no_surat_mutasi && <div className="text-[10px] font-mono text-slate-400">Surat: {item.no_surat_mutasi}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingItem(item)}
                            className="p-1.5 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Detail Mutasi"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {currentUserRole !== "guru SMP" && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Edit Data"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Hapus Data"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* MODAL: ADD / EDIT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingItem
                  ? `Edit ${viewMode === "lulus" ? "Data Siswa Lulus" : "Data Mutasi Siswa"}`
                  : `Tambah ${viewMode === "lulus" ? "Siswa Lulus Baru" : "Siswa Mutasi Baru"}`}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div className="relative">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Nama Lengkap Siswa *</span>
                  {predictedStudents.length > 0 && showPredictions && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      💡 {predictedStudents.length} Prediksi Siswa Ditemukan
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ketik nama siswa (akan otomatis diprediksi)..."
                    value={formNama}
                    onChange={(e) => {
                      setFormNama(e.target.value);
                      setShowPredictions(true);
                    }}
                    onFocus={() => setShowPredictions(true)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {formNama && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormNama("");
                        setShowPredictions(false);
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Floating Prediction Dropdown */}
                {showPredictions && predictedStudents.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                      Klik nama siswa di bawah untuk isi otomatis:
                    </div>
                    {predictedStudents.map((student) => (
                      <button
                        key={student.id || student.nik}
                        type="button"
                        onClick={() => {
                          setFormNama(student.nama_lengkap);
                          setFormNik(student.nik);
                          setFormNisn(student.nisn || "");
                          setFormGender(student.jenis_kelamin === "P" ? "P" : "L");
                          setFormKategori(student.kategori);
                          setSelectedStudentId(String(student.id || student.nik));
                          setFormKeterangan(
                            `Diambil dari data siswa aktif (Kamar: ${student.kamar || "-"}, Kelas: ${
                              student.kelas_sekolah || student.kelas_pengajian || "-"
                            })`
                          );
                          setShowPredictions(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 text-xs">
                            {student.nama_lengkap}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                              NIK: {student.nik}
                            </span>
                            <span>•</span>
                            <span>{student.jenis_kelamin === "P" ? "Siswi (Perempuan)" : "Siswa (Laki-laki)"}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 shrink-0">
                          {student.kategori}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">NIK (16 digit) *</label>
                  <input
                    type="text"
                    required
                    placeholder="NIK siswa"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">NISN (Opsional)</label>
                  <input
                    type="text"
                    placeholder="NISN"
                    value={formNisn}
                    onChange={(e) => setFormNisn(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Jenis Kelamin</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as "L" | "P")}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="L">Laki-laki (Siswa)</option>
                    <option value="P">Perempuan (Siswi)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="SMP">SMP</option>
                    <option value="SMA">SMA</option>
                    <option value="Reguler">Reguler</option>
                  </select>
                </div>
              </div>

              {/* Specific fields for LULUS */}
              {viewMode === "lulus" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tahun Lulus *</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: 2025"
                        value={formTahunLulus}
                        onChange={(e) => setFormTahunLulus(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal Lulus</label>
                      <input
                        type="date"
                        value={formTanggalLulus}
                        onChange={(e) => setFormTanggalLulus(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nomor Ijazah</label>
                    <input
                      type="text"
                      placeholder="Nomor Ijazah resmi"
                      value={formNoIjazah}
                      onChange={(e) => setFormNoIjazah(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Lanjutan Studi / Pekerjaan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Universitas Airlangga / Bekerja"
                      value={formLanjutanStudi}
                      onChange={(e) => setFormLanjutanStudi(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </>
              )}

              {/* Specific fields for MUTASI */}
              {viewMode === "mutasi" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Jenis Mutasi *</label>
                      <select
                        value={formJenisMutasi}
                        onChange={(e) => setFormJenisMutasi(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                      >
                        <option value="Pindah Sekolah">Pindah Sekolah</option>
                        <option value="Pindah Pondok">Pindah Pondok</option>
                        <option value="Keluar/Berhenti">Keluar / Berhenti</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal Mutasi</label>
                      <input
                        type="date"
                        value={formTanggalMutasi}
                        onChange={(e) => setFormTanggalMutasi(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tujuan Mutasi *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: SMP Negeri 1 Surabaya / Pondok Gontor"
                      value={formTujuanMutasi}
                      onChange={(e) => setFormTujuanMutasi(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Alasan Mutasi</label>
                      <input
                        type="text"
                        placeholder="Alasan mutasi"
                        value={formAlasanMutasi}
                        onChange={(e) => setFormAlasanMutasi(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">No. Surat Mutasi</label>
                      <input
                        type="text"
                        placeholder="No. Surat Resmi"
                        value={formNoSuratMutasi}
                        onChange={(e) => setFormNoSuratMutasi(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan / Keterangan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan..."
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-white font-bold cursor-pointer transition-all ${
                    viewMode === "lulus" ? "bg-amber-600 hover:bg-amber-700" : "bg-sky-600 hover:bg-sky-700"
                  }`}
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SELECT FROM ACTIVE STUDENTS */}
      {showSelectActiveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Pilih Siswa Aktif untuk Di-{viewMode === "lulus" ? "luluskan" : "mutasikan"}
                </h3>
                <p className="text-xs text-slate-400">Pilih dari daftar siswa aktif terdaftar saat ini</p>
              </div>
              <button onClick={() => setShowSelectActiveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari siswa berdasarkan nama atau NIK..."
                  value={activeSearch}
                  onChange={(e) => setActiveSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[250px]">
              {activeStudents
                .filter(
                  (s) =>
                    s.nama_lengkap.toLowerCase().includes(activeSearch.toLowerCase()) ||
                    s.nik.includes(activeSearch)
                )
                .map((student) => (
                  <div
                    key={student.id || student.nik}
                    onClick={() => handleSelectActiveStudent(student)}
                    className="p-3 bg-slate-50 hover:bg-amber-50/60 dark:bg-slate-900/50 dark:hover:bg-slate-700/60 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${student.jenis_kelamin === "P" ? "bg-pink-100 text-pink-700" : "bg-sky-100 text-sky-700"}`}>
                        {student.jenis_kelamin === "P" ? "🧕" : "力"}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">{student.nama_lengkap}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          NIK: {student.nik} • {student.jenis_kelamin === "P" ? "Perempuan" : "Laki-laki"} • {student.kategori}
                        </div>
                      </div>
                    </div>

                    <button className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg transition-colors">
                      Pilih
                    </button>
                  </div>
                ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setShowSelectActiveModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DETAIL */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Detail Siswa {viewMode === "lulus" ? "Lulus" : "Mutasi"}
              </h3>
              <button onClick={() => setViewingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${viewingItem.jenis_kelamin === "P" ? "bg-pink-100 text-pink-700" : "bg-sky-100 text-sky-700"}`}>
                  {viewingItem.jenis_kelamin === "P" ? "🧕" : "👳"}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{viewingItem.nama_lengkap}</h4>
                  <div className="text-[11px] text-slate-500 font-mono">NIK: {viewingItem.nik}</div>
                  <div className="text-[10px] text-slate-400">
                    {viewingItem.jenis_kelamin === "P" ? "Perempuan (Siswi)" : "Laki-laki (Siswa)"} • Kategori {viewingItem.kategori}
                  </div>
                </div>
              </div>

              {viewMode === "lulus" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-bold">Tahun Lulus</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">Tahun {(viewingItem as SiswaLulus).tahun_lulus}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-bold">Tanggal Lulus</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{(viewingItem as SiswaLulus).tanggal_lulus || "-"}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold">No. Ijazah Resmi</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{(viewingItem as SiswaLulus).no_ijazah || "-"}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold">Lanjutan Studi / Pekerjaan</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{(viewingItem as SiswaLulus).lanjutan_studi || "-"}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-bold">Jenis Mutasi</span>
                      <span className="font-extrabold text-sky-600 dark:text-sky-400">{(viewingItem as SiswaMutasi).jenis_mutasi}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-400 block font-bold">Tanggal Mutasi</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{(viewingItem as SiswaMutasi).tanggal_mutasi || "-"}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold">Tujuan Mutasi</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{(viewingItem as SiswaMutasi).tujuan_mutasi}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold">Alasan Mutasi</span>
                    <span className="text-slate-800 dark:text-slate-200">{(viewingItem as SiswaMutasi).alasan_mutasi}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-[10px] text-slate-400 block font-bold">No. Surat Resmi</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{(viewingItem as SiswaMutasi).no_surat_mutasi || "-"}</span>
                  </div>
                </>
              )}

              {viewingItem.keterangan && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-bold">Keterangan</span>
                  <span className="text-slate-700 dark:text-slate-300">{viewingItem.keterangan}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setViewingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Konfirmasi Hapus</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Apakah Anda yakin ingin menghapus data <strong>{deleteTarget.nama_lengkap}</strong> dari daftar {viewMode}?
            </p>

            <div className="flex justify-center gap-2 mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
