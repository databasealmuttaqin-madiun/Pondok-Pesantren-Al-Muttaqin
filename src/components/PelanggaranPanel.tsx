import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  PlusCircle,
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  Filter,
  User,
  Calendar,
  ShieldAlert,
  X,
  ChevronDown,
  UserCheck,
  Check,
  Award,
  AlertCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import { supabase, SantriData } from "../supabaseClient";

export interface PelanggaranData {
  id: string;
  created_at: string;
  tanggal: string;
  santri_id?: number | string;
  nama_siswa: string;
  nik?: string;
  nisn?: string;
  kamar?: string;
  kelas_sekolah?: string;
  kelas_pengajian?: string;
  jenis_pelanggaran: "Ringan" | "Sedang" | "Berat";
  kategori: string;
  nama_pelanggaran: string;
  poin: number;
  hukuman: string;
  status_sanksi: "Belum Ditindak" | "Proses Takzir" | "Selesai Takzir";
  pencatat: string;
  catatan?: string;
}

interface PelanggaranPanelProps {
  viewMode: "input" | "rekap";
  onSwitchMode: (mode: "input" | "rekap") => void;
  students: SantriData[];
  rooms?: string[];
  schoolClasses?: string[];
  recitationClasses?: string[];
  triggerNotification?: (msg: string, type?: "success" | "warning" | "error") => void;
  currentUser?: any;
}

const KATEGORI_OPTIONS = [
  "Kedisiplinan & Waktu",
  "Perizinan & Kehadiran",
  "Ketertiban & Kebersihan",
  "Etika & Akhlak",
  "Barang Terlarang & Elektronik",
  "Kelakuan & Perkelahian",
  "Lainnya",
];

const PRESET_PELANGGARAN: {
  nama: string;
  jenis: "Ringan" | "Sedang" | "Berat";
  kategori: string;
  poin: number;
  hukuman: string;
}[] = [
  {
    nama: "Terlambat Sholat Berjamaah di Masjid",
    jenis: "Ringan",
    kategori: "Kedisiplinan & Waktu",
    poin: 5,
    hukuman: "Membaca Al-Qur'an 1 Halaman di Teras Masjid",
  },
  {
    nama: "Kamar atau Lemari Berantakan Saat Sidak Kebersihan",
    jenis: "Ringan",
    kategori: "Ketertiban & Kebersihan",
    poin: 5,
    hukuman: "Membersihkan Kamar & Lorong Sektor",
  },
  {
    nama: "Tidak Memakai Seragam / Atribut Pesantren Sesuai Jadwal",
    jenis: "Ringan",
    kategori: "Kedisiplinan & Waktu",
    poin: 10,
    hukuman: "Teguran Tertulis & Rapikan Pakaian",
  },
  {
    nama: "Makan/Minum Sambil Berdiri / Tidak Sesuai Adab",
    jenis: "Ringan",
    kategori: "Etika & Akhlak",
    poin: 5,
    hukuman: "Hafalan Adab Makan & Setor Piket",
  },
  {
    nama: "Kabur / Tidak Mengikuti Pengajian / Madrasah",
    jenis: "Sedang",
    kategori: "Perizinan & Kehadiran",
    poin: 25,
    hukuman: "Membaca Surat Yasin / Al-Waqi'ah & Melengkapi Catatan",
  },
  {
    nama: "Membawa / Menggunakan HP atau Elektronik Tanpa Izin",
    jenis: "Sedang",
    kategori: "Barang Terlarang & Elektronik",
    poin: 35,
    hukuman: "Penyitaan HP 1 Bulan & Tugas Piket Khusus",
  },
  {
    nama: "Keluar Area Pesantren Tanpa Surat Izin Resmi",
    jenis: "Sedang",
    kategori: "Perizinan & Kehadiran",
    poin: 30,
    hukuman: "Bersihkan Teras Masjid & Panggilan Wali Santri",
  },
  {
    nama: "Merokok atau Membawa Rokok/Vape di Lingkungan Pesantren",
    jenis: "Sedang",
    kategori: "Barang Terlarang & Elektronik",
    poin: 40,
    hukuman: "Membersihkan WC Masjid 3 Hari & Peringatan Tertulis",
  },
  {
    nama: "Keluar Malam Tanpa Izin (Kabur dari Kompleks Pondok)",
    jenis: "Berat",
    kategori: "Perizinan & Kehadiran",
    poin: 75,
    hukuman: "Skorsing / Pemanggilan Orang Tua & Surat Peringatan II",
  },
  {
    nama: "Berkelahi / Tindak Kekerasan Fisik Antar Santri",
    jenis: "Berat",
    kategori: "Kelakuan & Perkelahian",
    poin: 80,
    hukuman: "Panggilan Orang Tua + Takzir Khusus Kedisiplinan",
  },
  {
    nama: "Mencuri atau Mengambil Barang/Uang Santri Lain",
    jenis: "Berat",
    kategori: "Etika & Akhlak",
    poin: 100,
    hukuman: "Mengembalikan Barang + Surat Peringatan Keras (SP III)",
  },
  {
    nama: "Merusak Fasilitas / Inventaris Utama Pesantren",
    jenis: "Berat",
    kategori: "Ketertiban & Kebersihan",
    poin: 60,
    hukuman: "Mengganti Kerusakan & Denda Poin",
  },
];

export const PelanggaranPanel: React.FC<PelanggaranPanelProps> = ({
  viewMode,
  onSwitchMode,
  students = [],
  rooms = [],
  schoolClasses = [],
  recitationClasses = [],
  triggerNotification,
  currentUser,
}) => {
  const [pelanggaranList, setPelanggaranList] = useState<PelanggaranData[]>(() => {
    const saved = localStorage.getItem("pelanggaran_siswa_data");
    if (!saved) return [];
    try {
      return JSON.parse(saved) || [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);

  // Load from Supabase on mount
  const fetchPelanggaran = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("pelanggaran").select("*").order("created_at", { ascending: false });
      if (error) {
        console.warn("Gagal memuat tabel pelanggaran Supabase:", error.message);
      } else if (data) {
        setPelanggaranList(data);
        localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(data));
      }
    } catch (err) {
      console.warn("Table pelanggaran fallback to localStorage");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPelanggaran();
  }, []);

  // Form State for Input Pelanggaran (Supports Multi-Select)
  const [selectedStudents, setSelectedStudents] = useState<SantriData[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  const handleSelectStudent = (s: SantriData) => {
    const exists = selectedStudents.some(
      (item) => (item.id && item.id === s.id) || (item.nik && item.nik === s.nik && item.nama_lengkap === s.nama_lengkap)
    );
    if (!exists) {
      setSelectedStudents([...selectedStudents, s]);
    }
    setStudentSearch("");
  };

  const handleRemoveStudent = (s: SantriData) => {
    setSelectedStudents(
      selectedStudents.filter(
        (item) => !((item.id && item.id === s.id) || (item.nik && item.nik === s.nik && item.nama_lengkap === s.nama_lengkap))
      )
    );
  };

  const [tanggal, setTanggal] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [jenisPelanggaran, setJenisPelanggaran] = useState<"Ringan" | "Sedang" | "Berat">("Ringan");
  const [kategori, setKategori] = useState("Kedisiplinan & Waktu");
  const [namaPelanggaran, setNamaPelanggaran] = useState("");
  const [poin, setPoin] = useState<number>(10);
  const [hukuman, setHukuman] = useState("");
  const [statusSanksi, setStatusSanksi] = useState<"Belum Ditindak" | "Proses Takzir" | "Selesai Takzir">("Belum Ditindak");
  const [pencatat, setPencatat] = useState<string>(currentUser?.nama || "Pengurus / Keamanan");
  const [catatan, setCatatan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters for Rekap Pelanggaran
  const [rekapSearch, setRekapSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState<string>("semua");
  const [filterStatus, setFilterStatus] = useState<string>("semua");
  const [filterKamar, setFilterKamar] = useState<string>("semua");

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<PelanggaranData | null>(null);

  // Auto set recommended points when changing level
  const handleJenisChange = (jenis: "Ringan" | "Sedang" | "Berat") => {
    setJenisPelanggaran(jenis);
    if (jenis === "Ringan") setPoin(10);
    else if (jenis === "Sedang") setPoin(30);
    else if (jenis === "Berat") setPoin(75);
  };

  // Apply preset to form
  const handleApplyPreset = (preset: (typeof PRESET_PELANGGARAN)[0]) => {
    setNamaPelanggaran(preset.nama);
    setJenisPelanggaran(preset.jenis);
    setKategori(preset.kategori);
    setPoin(preset.poin);
    setHukuman(preset.hukuman);
  };

  // Student filtering for selector (excluding already selected students)
  const filteredStudents = useMemo(() => {
    const availableStudents = students.filter(
      (s) =>
        !selectedStudents.some(
          (selected) =>
            (selected.id && selected.id === s.id) ||
            (selected.nik && selected.nik === s.nik && selected.nama_lengkap === s.nama_lengkap)
        )
    );

    if (!studentSearch.trim()) return availableStudents.slice(0, 10);
    const q = studentSearch.toLowerCase().trim();
    return availableStudents.filter(
      (s) =>
        s.nama_lengkap.toLowerCase().includes(q) ||
        (s.nik && s.nik.includes(q)) ||
        (s.nisn && s.nisn.includes(q)) ||
        (s.kamar && s.kamar.toLowerCase().includes(q)) ||
        (s.kelas_sekolah && s.kelas_sekolah.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [students, studentSearch, selectedStudents]);

  // Submit new Pelanggaran (Batch insert for selected students)
  const handleSubmitPelanggaran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0) {
      if (triggerNotification) triggerNotification("Pilih minimal 1 santri / siswa terlebih dahulu!", "warning");
      return;
    }
    if (!namaPelanggaran.trim()) {
      if (triggerNotification) triggerNotification("Isi uraian nama pelanggaran!", "warning");
      return;
    }

    setIsSubmitting(true);

    const newRecords: PelanggaranData[] = selectedStudents.map((student, idx) => ({
      id: "PLG-" + Date.now() + "-" + idx + "-" + Math.floor(Math.random() * 1000),
      created_at: new Date().toISOString(),
      tanggal,
      santri_id: student.id,
      nama_siswa: student.nama_lengkap,
      nik: student.nik || "",
      nisn: student.nisn || "",
      kamar: student.kamar || "Belum Set",
      kelas_sekolah: student.kelas_sekolah || "",
      kelas_pengajian: student.kelas_pengajian || "",
      jenis_pelanggaran: jenisPelanggaran,
      kategori,
      nama_pelanggaran: namaPelanggaran.trim(),
      poin: Number(poin) || 0,
      hukuman: hukuman.trim() || "Teguran lisan & pengawasan",
      status_sanksi: statusSanksi,
      pencatat: pencatat.trim() || "Pengurus Keamanan",
      catatan: catatan.trim(),
    }));

    // Save to LocalStorage immediately
    const updatedList = [...newRecords, ...pelanggaranList];
    setPelanggaranList(updatedList);
    localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(updatedList));

    // Try sync to Supabase
    try {
      const { error } = await supabase.from("pelanggaran").insert(newRecords);
      if (error) console.warn("Notice: Saved locally, Supabase insert warning:", error.message);
    } catch (err) {
      console.warn("Supabase insert fallback local state saved");
    }

    if (triggerNotification) {
      if (selectedStudents.length === 1) {
        triggerNotification(`Pelanggaran untuk ${selectedStudents[0].nama_lengkap} berhasil dicatat! (+${poin} poin)`, "success");
      } else {
        triggerNotification(`Pelanggaran untuk ${selectedStudents.length} santri/siswa berhasil dicatat masing-masing! (+${poin} poin/anak)`, "success");
      }
    }

    // Reset Form fields
    setSelectedStudents([]);
    setStudentSearch("");
    setNamaPelanggaran("");
    setHukuman("");
    setCatatan("");

    setIsSubmitting(false);
  };

  // Toggle Sanksi status (e.g., mark as Selesai Takzir)
  const handleToggleStatus = async (item: PelanggaranData, nextStatus: "Belum Ditindak" | "Proses Takzir" | "Selesai Takzir") => {
    const updatedList = pelanggaranList.map((rec) => (rec.id === item.id ? { ...rec, status_sanksi: nextStatus } : rec));
    setPelanggaranList(updatedList);
    localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(updatedList));

    try {
      await supabase.from("pelanggaran").update({ status_sanksi: nextStatus }).eq("id", item.id);
    } catch {}

    if (triggerNotification) {
      triggerNotification(`Status takzir ${item.nama_siswa} diubah ke "${nextStatus}"`, "success");
    }
  };

  // Delete Pelanggaran Record
  const handleDeleteRecord = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus catatan pelanggaran untuk "${name}"?`)) return;

    const updatedList = pelanggaranList.filter((rec) => rec.id !== id);
    setPelanggaranList(updatedList);
    localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(updatedList));

    try {
      await supabase.from("pelanggaran").delete().eq("id", id);
    } catch {}

    if (triggerNotification) {
      triggerNotification(`Catatan pelanggaran ${name} telah dihapus`, "warning");
    }
  };

  // Save Edit Record
  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    const updatedList = pelanggaranList.map((rec) => (rec.id === editingRecord.id ? editingRecord : rec));
    setPelanggaranList(updatedList);
    localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(updatedList));

    try {
      await supabase.from("pelanggaran").update(editingRecord).eq("id", editingRecord.id);
    } catch {}

    setEditingRecord(null);
    if (triggerNotification) {
      triggerNotification(`Perubahan pelanggaran ${editingRecord.nama_siswa} disimpan`, "success");
    }
  };

  // Filtering Rekap List
  const filteredRekapList = useMemo(() => {
    return pelanggaranList.filter((item) => {
      // Search
      if (rekapSearch.trim()) {
        const q = rekapSearch.toLowerCase();
        const matchesName = item.nama_siswa.toLowerCase().includes(q);
        const matchesPelanggaran = item.nama_pelanggaran.toLowerCase().includes(q);
        const matchesKamar = item.kamar?.toLowerCase().includes(q);
        const matchesPencatat = item.pencatat.toLowerCase().includes(q);
        if (!matchesName && !matchesPelanggaran && !matchesKamar && !matchesPencatat) return false;
      }
      // Jenis
      if (filterJenis !== "semua" && item.jenis_pelanggaran !== filterJenis) return false;
      // Status
      if (filterStatus !== "semua" && item.status_sanksi !== filterStatus) return false;
      // Kamar
      if (filterKamar !== "semua" && item.kamar !== filterKamar) return false;

      return true;
    });
  }, [pelanggaranList, rekapSearch, filterJenis, filterStatus, filterKamar]);

  // Summary stats
  const stats = useMemo(() => {
    const totalCount = pelanggaranList.length;
    const totalPoints = pelanggaranList.reduce((acc, curr) => acc + (curr.poin || 0), 0);
    const ringanCount = pelanggaranList.filter((p) => p.jenis_pelanggaran === "Ringan").length;
    const sedangCount = pelanggaranList.filter((p) => p.jenis_pelanggaran === "Sedang").length;
    const beratCount = pelanggaranList.filter((p) => p.jenis_pelanggaran === "Berat").length;
    const belumSelesaiCount = pelanggaranList.filter((p) => p.status_sanksi !== "Selesai Takzir").length;
    return { totalCount, totalPoints, ringanCount, sedangCount, beratCount, belumSelesaiCount };
  }, [pelanggaranList]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Pelanggaran</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.totalCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
            📝
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">Pelanggaran Ringan</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.ringanCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold text-xs">
            🟡
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 block">Sedang / Berat</span>
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
              {stats.sedangCount + stats.beratCount}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center font-bold text-xs">
            🔴
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block">Perlu Takzir / Proses</span>
            <span className="text-2xl font-black text-red-600 dark:text-red-400">{stats.belumSelesaiCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center font-bold text-xs">
            ⚠️
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: FORM INPUT PELANGGARAN */}
      {viewMode === "input" && (
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600" />
              Form Input Pelanggaran
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Isi nama siswa, detail pelanggaran, tanggal, lalu klik simpan.
            </p>
          </div>

          <form onSubmit={handleSubmitPelanggaran} className="space-y-6">
            {/* LANGKAH 1: INPUT NAMA (MULTI-SELECT) */}
            <div className="space-y-3 p-4 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">1</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Input Nama / Pilih Siswa Santri *
                  </h4>
                </div>
                {selectedStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStudents([])}
                    className="text-[11px] font-bold text-red-500 hover:text-red-600 hover:underline transition-all cursor-pointer"
                  >
                    Hapus Semua ({selectedStudents.length})
                  </button>
                )}
              </div>

              {/* Multi-Select Field Wrapper */}
              <div className="relative">
                <div
                  onClick={() => setShowStudentDropdown(true)}
                  className="w-full min-h-[48px] p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white flex flex-wrap items-center gap-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all cursor-text"
                >
                  {/* Selected Pills / Chips */}
                  {selectedStudents.map((s) => (
                    <span
                      key={s.id || s.nik || s.nama_lengkap}
                      className="px-3 py-1 bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs animate-in zoom-in-95 duration-150"
                    >
                      <span>{s.nama_lengkap}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStudent(s);
                        }}
                        className="p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-900/60 rounded-sm transition-colors text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
                        title="Hapus"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}

                  {/* Search Input */}
                  <div className="flex-1 min-w-[140px] flex items-center gap-2 px-1 py-0.5">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        setShowStudentDropdown(true);
                      }}
                      onFocus={() => setShowStudentDropdown(true)}
                      placeholder={selectedStudents.length === 0 ? "Ketik Nama Siswa, NIK, Kamar, atau Kelas..." : "Cari/tambah siswa lain..."}
                      className="w-full text-xs font-semibold bg-transparent outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
                    />
                  </div>

                  <ChevronDown className="w-4 h-4 text-slate-400 ml-auto mr-1 shrink-0 pointer-events-none" />
                </div>

                {/* Dropdown Candidate list */}
                {showStudentDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowStudentDropdown(false)}
                    />
                    <div className="absolute z-30 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto p-1.5">
                      {filteredStudents.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center font-medium">
                          Siswa tidak ditemukan atau sudah dipilih.
                        </div>
                      ) : (
                        filteredStudents.map((s) => (
                          <div
                            key={s.id || s.nik || s.nama_lengkap}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStudent(s);
                            }}
                            className="p-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs my-0.5"
                          >
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-100">{s.nama_lengkap}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>Kamar: {s.kamar || "Belum Set"}</span>
                                <span>•</span>
                                <span>Kelas: {s.kelas_sekolah || s.kelas_pengajian || "-"}</span>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold rounded-lg text-[10px] hover:bg-blue-600 hover:text-white transition-colors">
                              + Pilih
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Info summary */}
              {selectedStudents.length > 0 && (
                <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 pt-0.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{selectedStudents.length} siswa terpilih. Sistem akan mencatat data pelanggaran untuk masing-masing siswa.</span>
                </div>
              )}
            </div>

            {/* LANGKAH 2: INPUT PELANGGARAN & TANGGAL */}
            <div className="space-y-4 p-4 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">2</span>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Input Pelanggaran & Tanggal *
                </h4>
              </div>

              {/* Nama Pelanggaran */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider">
                  Nama / Uraian Pelanggaran *
                </label>
                <input
                  type="text"
                  value={namaPelanggaran}
                  onChange={(e) => setNamaPelanggaran(e.target.value)}
                  placeholder="Contoh: Terlambat Sholat Berjamaah / Membawa HP Tanpa Izin..."
                  className="w-full text-xs font-semibold px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Tanggal */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider">
                  Tanggal Kejadian *
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* LANGKAH 3: SIMPAN */}
            <div className="space-y-3 p-4 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">3</span>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Simpan Pelanggaran
                </h4>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2 border-0 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Pelanggaran...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>SIMPAN PELANGGARAN</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW MODE 2: REKAP & DAFTAR PELANGGARAN */}
      {viewMode === "rekap" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rekapSearch}
                onChange={(e) => setRekapSearch(e.target.value)}
                placeholder="Cari nama santri, kamar, jenis pelanggaran, atau pelapor..."
                className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-white outline-none focus:border-red-500"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="semua">Semua Tingkat</option>
                <option value="Ringan">Ringan</option>
                <option value="Sedang">Sedang</option>
                <option value="Berat">Berat</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="semua">Semua Status Takzir</option>
                <option value="Belum Ditindak">Belum Ditindak</option>
                <option value="Proses Takzir">Proses Takzir</option>
                <option value="Selesai Takzir">Selesai Takzir</option>
              </select>

              <select
                value={filterKamar}
                onChange={(e) => setFilterKamar(e.target.value)}
                className="text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 outline-none max-w-[140px]"
              >
                <option value="semua">Semua Kamar</option>
                {rooms.map((rm) => (
                  <option key={rm} value={rm}>
                    {rm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TABLE LIST */}
          {filteredRekapList.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center text-2xl">
                🛡️
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Belum ada data pelanggaran ditemukan.
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {rekapSearch || filterJenis !== "semua" || filterStatus !== "semua"
                  ? "Coba ubah kata kunci pencarian atau filter yang digunakan."
                  : "Klik tombol 'Input Pelanggaran' di atas untuk menambah catatan pelanggaran baru."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3">Nama Santri</th>
                    <th className="py-3 px-3">Kamar / Kelas</th>
                    <th className="py-3 px-3">Pelanggaran & Kategori</th>
                    <th className="py-3 px-3 text-center">Tingkat & Poin</th>
                    <th className="py-3 px-3">Takzir / Sanksi</th>
                    <th className="py-3 px-3 text-center">Status Takzir</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredRekapList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-500 whitespace-nowrap">
                        {item.tanggal}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-slate-800 dark:text-slate-100">{item.nama_siswa}</div>
                        {item.nik && <div className="text-[10px] font-mono text-slate-400">{item.nik}</div>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">🛏️ {item.kamar || "-"}</div>
                        <div className="text-[10px] text-slate-400">{item.kelas_sekolah || item.kelas_pengajian || "-"}</div>
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{item.nama_pelanggaran}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{item.kategori}</div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black ${
                            item.jenis_pelanggaran === "Ringan"
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                              : item.jenis_pelanggaran === "Sedang"
                              ? "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400"
                              : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {item.jenis_pelanggaran} (+{item.poin})
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-xs font-medium text-slate-700 dark:text-slate-300">
                        {item.hukuman || "Teguran Lisan"}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {item.status_sanksi === "Selesai Takzir" ? (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              🟢 Selesai
                            </span>
                          ) : item.status_sanksi === "Proses Takzir" ? (
                            <button
                              onClick={() => handleToggleStatus(item, "Selesai Takzir")}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors cursor-pointer"
                              title="Klik untuk tandai selesai"
                            >
                              🟡 Proses (Tandai Selesai)
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(item, "Proses Takzir")}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 hover:bg-red-200 transition-colors cursor-pointer"
                              title="Klik untuk proses takzir"
                            >
                              🔴 Belum Ditindak
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingRecord(item)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit Catatan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(item.id, item.nama_siswa)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                Edit Catatan Pelanggaran
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nama Siswa</label>
                <div className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                  {editingRecord.nama_siswa}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Tingkat</label>
                  <select
                    value={editingRecord.jenis_pelanggaran}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, jenis_pelanggaran: e.target.value as any })
                    }
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
                  >
                    <option value="Ringan">Ringan</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Berat">Berat</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Poin</label>
                  <input
                    type="number"
                    value={editingRecord.poin}
                    onChange={(e) => setEditingRecord({ ...editingRecord, poin: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nama Pelanggaran</label>
                <input
                  type="text"
                  value={editingRecord.nama_pelanggaran}
                  onChange={(e) => setEditingRecord({ ...editingRecord, nama_pelanggaran: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Hukuman / Takzir</label>
                <input
                  type="text"
                  value={editingRecord.hukuman}
                  onChange={(e) => setEditingRecord({ ...editingRecord, hukuman: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Status Sanksi</label>
                <select
                  value={editingRecord.status_sanksi}
                  onChange={(e) => setEditingRecord({ ...editingRecord, status_sanksi: e.target.value as any })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
                >
                  <option value="Belum Ditindak">Belum Ditindak</option>
                  <option value="Proses Takzir">Proses Takzir</option>
                  <option value="Selesai Takzir">Selesai Takzir</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PelanggaranPanel;
