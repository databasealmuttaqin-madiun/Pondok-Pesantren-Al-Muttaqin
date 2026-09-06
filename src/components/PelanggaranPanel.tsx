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
  Calendar,
  ShieldAlert,
  X,
  ChevronDown,
  UserCheck,
  RefreshCw,
  Database,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { supabase, SantriData } from "../supabaseClient";
import { SearchableSelect } from "./ui/SearchableSelect";
import { PageHeader } from "./ui/PageHeader";

export interface PelanggaranData {
  id: number | string;
  created_at?: string;
  nama_siswa: string;
  pelanggaran: string;
  tanggal: string;
  status: "Belum Selesai" | "Selesai";
  isLocalOnly?: boolean;
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

const CONTOH_PELANGGARAN_PRESET = [
  "Terlambat Sholat Berjamaah di Masjid",
  "Kamar atau Lemari Berantakan Saat Sidak",
  "Tidak Mengikuti Pengajian / Madrasah",
  "Membawa HP / Barang Elektronik Tanpa Izin",
  "Keluar Area Pondok Tanpa Surat Izin Resmi",
  "Merokok / Membawa Rokok atau Vape",
  "Keluar Malam Hari Tanpa Izin",
  "Berkelahi / Tindakan Kekerasan Fisik",
  "Tidak Mengenakan Busana / Seragam Sesuai Jadwal",
  "Makan / Minum Sambil Berdiri (Melanggar Adab)",
];

export const PelanggaranPanel: React.FC<PelanggaranPanelProps> = ({
  viewMode,
  onSwitchMode,
  students = [],
  rooms = [],
  triggerNotification,
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [rlsErrorDetected, setRlsErrorDetected] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Load data dari Supabase tabel pelanggaran (versi ringkas)
  const fetchPelanggaran = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pelanggaran")
        .select("*")
        .order("id", { ascending: false });

      if (error) {
        console.warn("Gagal memuat tabel pelanggaran Supabase:", error.message);
        if (error.code === "42501" || error.message.toLowerCase().includes("row-level security")) {
          setRlsErrorDetected(true);
        }
      } else if (data) {
        setRlsErrorDetected(false);
        // Normalisasi data dari database
        const cloudRows: PelanggaranData[] = data.map((row: any) => ({
          id: row.id,
          created_at: row.created_at || new Date().toISOString(),
          nama_siswa: row.nama_siswa || "-",
          pelanggaran: row.pelanggaran || row.nama_pelanggaran || "-",
          tanggal: row.tanggal || new Date().toISOString().split("T")[0],
          status:
            row.status === "Selesai" || row.status_sanksi === "Selesai Takzir"
              ? "Selesai"
              : "Belum Selesai",
          isLocalOnly: false,
        }));

        // Pertahankan data lokal yang belum tersinkronisasi ke cloud
        const saved = localStorage.getItem("pelanggaran_siswa_data");
        let pendingLocal: PelanggaranData[] = [];
        if (saved) {
          try {
            const parsed: PelanggaranData[] = JSON.parse(saved);
            pendingLocal = parsed.filter(
              (item) => item.isLocalOnly && !cloudRows.some(
                (cr) => cr.nama_siswa === item.nama_siswa && cr.pelanggaran === item.pelanggaran && cr.tanggal === item.tanggal
              )
            );
          } catch {
            pendingLocal = [];
          }
        }

        const merged = [...pendingLocal, ...cloudRows];
        setPelanggaranList(merged);
        localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(merged));
      }
    } catch (err) {
      console.warn("Table pelanggaran fallback to localStorage");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Fungsi sinkronisasi manual atau otomatis untuk data lokal yang belum masuk ke database Supabase
  const syncPendingLocalRecords = async () => {
    const pending = pelanggaranList.filter((item) => item.isLocalOnly);
    setIsSyncing(true);

    try {
      // 1. Tes koneksi baca/tulis tabel pelanggaran terlebih dahulu
      if (pending.length === 0) {
        await fetchPelanggaran();
        if (triggerNotification) {
          triggerNotification("Koneksi database aktif. Seluruh data telah tersinkron!", "success");
        }
        return;
      }

      const recordsToInsert = pending.map((p) => ({
        nama_siswa: p.nama_siswa,
        pelanggaran: p.pelanggaran,
        tanggal: p.tanggal,
        status: p.status,
      }));

      // Coba insert dengan select, atau fallback tanpa select
      let insertRes = await supabase.from("pelanggaran").insert(recordsToInsert).select();
      if (insertRes.error) {
        insertRes = await supabase.from("pelanggaran").insert(recordsToInsert);
      }

      if (!insertRes.error) {
        setRlsErrorDetected(false);
        if (triggerNotification) {
          triggerNotification(
            `Berhasil menyinkronkan ${pending.length} data pelanggaran lokal ke Supabase!`,
            "success"
          );
        }
        await fetchPelanggaran(true);
      } else {
        console.warn("Gagal sinkron data lokal ke Supabase:", insertRes.error.message);
        if (
          insertRes.error.code === "42501" ||
          insertRes.error.message.toLowerCase().includes("row-level security")
        ) {
          setRlsErrorDetected(true);
        }
        if (triggerNotification) {
          triggerNotification(
            `Sinkronisasi gagal: ${insertRes.error.message}. Pastikan izin RLS telah dinonaktifkan.`,
            "error"
          );
        }
      }
    } catch (e: any) {
      console.warn("Error saat sinkronisasi:", e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopySql = () => {
    const sql = "ALTER TABLE public.pelanggaran DISABLE ROW LEVEL SECURITY;";
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
    if (triggerNotification) {
      triggerNotification("Perintah SQL berhasil disalin ke clipboard!", "success");
    }
  };

  useEffect(() => {
    fetchPelanggaran();
  }, []);

  // Form State: 4 Kolom Utama
  // 1. Nama Siswa (bisa pilih dari santri atau ketik manual)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [manualStudentName, setManualStudentName] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // 2. Pelanggarannya
  const [pelanggaranText, setPelanggaranText] = useState("");

  // 3. Tanggal
  const [tanggal, setTanggal] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // 4. Status (sudah selesai atau belum prosesnya)
  const [status, setStatus] = useState<"Belum Selesai" | "Selesai">("Belum Selesai");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter & Search Rekap List
  const [rekapSearch, setRekapSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("semua");

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState<PelanggaranData | null>(null);

  // Helper untuk mencari data santri berdasarkan nama (untuk display kamar/kelas)
  const studentMetaMap = useMemo(() => {
    const map = new Map<string, SantriData>();
    students.forEach((s) => {
      if (s.nama_lengkap) map.set(s.nama_lengkap.trim().toLowerCase(), s);
    });
    return map;
  }, [students]);

  // Handle pilih siswa dari dropdown
  const handleSelectStudent = (s: SantriData) => {
    if (!selectedStudents.includes(s.nama_lengkap)) {
      setSelectedStudents([...selectedStudents, s.nama_lengkap]);
    }
    setStudentSearch("");
    setShowStudentDropdown(false);
  };

  // Handle tambah siswa manual jika nama tidak ada di database
  const handleAddManualStudent = () => {
    const trimmed = (studentSearch || manualStudentName).trim();
    if (trimmed && !selectedStudents.includes(trimmed)) {
      setSelectedStudents([...selectedStudents, trimmed]);
      setStudentSearch("");
      setManualStudentName("");
      setShowStudentDropdown(false);
    }
  };

  const handleRemoveStudent = (name: string) => {
    setSelectedStudents(selectedStudents.filter((item) => item !== name));
  };

  // Filter kandidat siswa di dropdown
  const filteredCandidateStudents = useMemo(() => {
    const available = students.filter((s) => !selectedStudents.includes(s.nama_lengkap));
    if (!studentSearch.trim()) return available.slice(0, 10);
    const q = studentSearch.toLowerCase().trim();
    return available
      .filter(
        (s) =>
          s.nama_lengkap.toLowerCase().includes(q) ||
          (s.kamar && s.kamar.toLowerCase().includes(q)) ||
          (s.kelas_sekolah && s.kelas_sekolah.toLowerCase().includes(q)) ||
          (s.kelas_pengajian && s.kelas_pengajian.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [students, studentSearch, selectedStudents]);

  // Submit Form Pelanggaran ke Supabase
  const handleSubmitPelanggaran = async (e: React.FormEvent) => {
    e.preventDefault();

    // Gabungkan siswa yang dipilih atau nama yang sedang diketik
    const namesToSubmit = [...selectedStudents];
    if (namesToSubmit.length === 0 && studentSearch.trim()) {
      namesToSubmit.push(studentSearch.trim());
    }

    if (namesToSubmit.length === 0) {
      if (triggerNotification) {
        triggerNotification("Tulis atau pilih minimal 1 nama siswa!", "warning");
      }
      return;
    }

    if (!pelanggaranText.trim()) {
      if (triggerNotification) {
        triggerNotification("Uraian pelanggaran wajib diisi!", "warning");
      }
      return;
    }

    setIsSubmitting(true);

    // Siapkan data sesuai 4 kolom ringkas Supabase
    const newRecords = namesToSubmit.map((nama) => ({
      nama_siswa: nama.trim(),
      pelanggaran: pelanggaranText.trim(),
      tanggal: tanggal || new Date().toISOString().split("T")[0],
      status: status,
    }));

    try {
      let insertedData: PelanggaranData[] = [];
      let savedToCloud = false;

      // 1. Coba insert dengan .select()
      const resWithSelect = await supabase
        .from("pelanggaran")
        .insert(newRecords)
        .select();

      if (!resWithSelect.error && resWithSelect.data && resWithSelect.data.length > 0) {
        insertedData = resWithSelect.data.map((row: any) => ({
          id: row.id,
          created_at: row.created_at || new Date().toISOString(),
          nama_siswa: row.nama_siswa,
          pelanggaran: row.pelanggaran,
          tanggal: row.tanggal,
          status: row.status === "Selesai" ? "Selesai" : "Belum Selesai",
          isLocalOnly: false,
        }));
        savedToCloud = true;
        setRlsErrorDetected(false);
      } else {
        // 2. Jika select() ditolak (misal policy SELECT berbeda), coba insert langsung
        console.warn("Insert dengan .select() dialihkan ke insert standar");
        const resWithoutSelect = await supabase
          .from("pelanggaran")
          .insert(newRecords);

        if (!resWithoutSelect.error) {
          savedToCloud = true;
          setRlsErrorDetected(false);
          const refetch = await supabase
            .from("pelanggaran")
            .select("*")
            .order("id", { ascending: false })
            .limit(newRecords.length);

          if (refetch.data && refetch.data.length > 0) {
            insertedData = refetch.data.map((row: any) => ({
              id: row.id,
              created_at: row.created_at || new Date().toISOString(),
              nama_siswa: row.nama_siswa,
              pelanggaran: row.pelanggaran,
              tanggal: row.tanggal,
              status: row.status === "Selesai" ? "Selesai" : "Belum Selesai",
              isLocalOnly: false,
            }));
          } else {
            insertedData = newRecords.map((r, i) => ({
              id: Date.now() + i,
              created_at: new Date().toISOString(),
              nama_siswa: r.nama_siswa,
              pelanggaran: r.pelanggaran,
              tanggal: r.tanggal,
              status: r.status as "Belum Selesai" | "Selesai",
              isLocalOnly: false,
            }));
          }
        } else {
          // 3. Jika koneksi atau RLS Supabase menolak insert
          const err = resWithoutSelect.error || resWithSelect.error;
          console.warn("Pemberitahuan izin Supabase:", err?.message);
          if (err?.code === "42501" || err?.message?.toLowerCase().includes("row-level security")) {
            setRlsErrorDetected(true);
          }
          // Simpan ke local state sebagai fallback aman
          insertedData = newRecords.map((r, i) => ({
            id: Date.now() + i,
            created_at: new Date().toISOString(),
            nama_siswa: r.nama_siswa,
            pelanggaran: r.pelanggaran,
            tanggal: r.tanggal,
            status: r.status as "Belum Selesai" | "Selesai",
            isLocalOnly: true,
          }));
        }
      }

      const updated = [...insertedData, ...pelanggaranList];
      setPelanggaranList(updated);
      localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(updated));

      if (triggerNotification) {
        if (savedToCloud) {
          triggerNotification(
            `Data pelanggaran untuk ${namesToSubmit.length} siswa berhasil disimpan ke database!`,
            "success"
          );
        } else {
          triggerNotification(
            `Data tersimpan secara lokal (${namesToSubmit.length} siswa). Klik sinkronisasi setelah izin RLS aktif.`,
            "warning"
          );
        }
      }

      // Reset form
      setSelectedStudents([]);
      setStudentSearch("");
      setManualStudentName("");
      setPelanggaranText("");
      setStatus("Belum Selesai");
    } catch (err: any) {
      console.warn("Peringatan submitting pelanggaran:", err?.message || err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle status langsung di tabel (Belum Selesai <-> Selesai)
  const handleToggleStatus = async (item: PelanggaranData) => {
    const nextStatus: "Belum Selesai" | "Selesai" = item.status === "Selesai" ? "Belum Selesai" : "Selesai";

    const updatedList = pelanggaranList.map((rec) =>
      rec.id === item.id ? { ...rec, status: nextStatus } : rec
    );
    setPelanggaranList(updatedList);
    localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(updatedList));

    try {
      const { error } = await supabase
        .from("pelanggaran")
        .update({ status: nextStatus })
        .eq("id", item.id);

      if (error) {
        console.warn("Gagal update status di Supabase:", error.message);
      } else if (triggerNotification) {
        triggerNotification(
          `Status pelanggaran ${item.nama_siswa} diubah menjadi "${nextStatus}"`,
          "success"
        );
      }
    } catch (err) {
      console.warn("Update status offline fallback");
    }
  };

  // Hapus catatan pelanggaran
  const handleDeleteRecord = async (id: number | string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus catatan pelanggaran untuk "${name}"?`)) return;

    const updatedList = pelanggaranList.filter((rec) => rec.id !== id);
    setPelanggaranList(updatedList);
    localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(updatedList));

    try {
      const { error } = await supabase.from("pelanggaran").delete().eq("id", id);
      if (error) console.warn("Gagal hapus dari Supabase:", error.message);
    } catch {}

    if (triggerNotification) {
      triggerNotification(`Catatan pelanggaran ${name} telah dihapus dari database`, "warning");
    }
  };

  // Simpan hasil edit modal ke Supabase
  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    const updatedList = pelanggaranList.map((rec) =>
      rec.id === editingRecord.id ? editingRecord : rec
    );
    setPelanggaranList(updatedList);
    localStorage.setItem("pelanggaran_siswa_data", JSON.stringify(updatedList));

    try {
      const { error } = await supabase
        .from("pelanggaran")
        .update({
          nama_siswa: editingRecord.nama_siswa.trim(),
          pelanggaran: editingRecord.pelanggaran.trim(),
          tanggal: editingRecord.tanggal,
          status: editingRecord.status,
        })
        .eq("id", editingRecord.id);

      if (error) {
        console.warn("Gagal update edit di Supabase:", error.message);
      }
    } catch {}

    const savedName = editingRecord.nama_siswa;
    setEditingRecord(null);
    if (triggerNotification) {
      triggerNotification(`Perubahan pelanggaran ${savedName} berhasil disimpan`, "success");
    }
  };

  // Filter daftar rekap
  const filteredRekapList = useMemo(() => {
    return pelanggaranList.filter((item) => {
      // Search text
      if (rekapSearch.trim()) {
        const q = rekapSearch.toLowerCase();
        const matchNama = item.nama_siswa.toLowerCase().includes(q);
        const matchPelanggaran = item.pelanggaran.toLowerCase().includes(q);
        if (!matchNama && !matchPelanggaran) return false;
      }
      // Status filter
      if (filterStatus !== "semua" && item.status !== filterStatus) return false;

      return true;
    });
  }, [pelanggaranList, rekapSearch, filterStatus]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const total = pelanggaranList.length;
    const belumSelesai = pelanggaranList.filter((p) => p.status === "Belum Selesai").length;
    const selesai = pelanggaranList.filter((p) => p.status === "Selesai").length;
    const todayStr = new Date().toISOString().split("T")[0];
    const hariIni = pelanggaranList.filter((p) => p.tanggal === todayStr).length;
    return { total, belumSelesai, selesai, hariIni };
  }, [pelanggaranList]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* BANNER JIKA MEMERLUKAN AKSES RLS SUPABASE */}
      {rlsErrorDetected && !isBannerDismissed && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 rounded-2xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 shadow-xs">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm">
                Izin Akses Tabel Pelanggaran (Supabase RLS)
              </div>
              <button
                onClick={() => setIsBannerDismissed(true)}
                className="text-amber-500 hover:text-amber-800 dark:hover:text-amber-200 p-1 rounded-md"
                title="Tutup pemberitahuan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
              Tabel <code className="font-mono bg-amber-200/60 dark:bg-amber-900/60 px-1 py-0.5 rounded">public.pelanggaran</code> berhasil terhubung. Jika penulisan data dibatasi oleh aturan RLS (Row-Level Security), data Anda tetap tersimpan aman di perangkat dan dapat disinkronkan. Untuk membuka izin tulis penuh di Supabase, jalankan di <strong>SQL Editor</strong> Supabase:
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 p-2 bg-slate-900 text-amber-200 font-mono text-[11px] rounded-xl select-all overflow-x-auto">
                ALTER TABLE public.pelanggaran DISABLE ROW LEVEL SECURITY;
              </div>
              <button
                onClick={handleCopySql}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-2xs"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? "Tersalin!" : "Salin SQL"}</span>
              </button>
              <button
                onClick={syncPendingLocalRecords}
                disabled={isSyncing}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Memeriksa..." : "Tes & Sinkronkan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total Pelanggaran</span>
          <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 block">{stats.total}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-500 block">Belum Selesai</span>
          <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 block">{stats.belumSelesai}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">Sudah Selesai</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">{stats.selesai}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 block">Hari Ini</span>
          <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1 block">{stats.hariIni}</span>
        </div>
      </div>

      {/* VIEW MODE 1: FORM INPUT PELANGGARAN */}
      {viewMode === "input" && (
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Form Input Pelanggaran Santri
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tersinkronisasi langsung dengan tabel database Supabase <code className="font-mono text-sky-600 dark:text-sky-400 font-semibold">pelanggaran</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchMode("rekap")}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              Lihat Rekap Data
            </button>
          </div>

          <form onSubmit={handleSubmitPelanggaran} className="space-y-5">
            {/* NAMA SISWA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nama Siswa <span className="text-rose-500">*</span>
                </label>
                {selectedStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStudents([])}
                    className="text-[11px] font-medium text-rose-500 hover:underline"
                  >
                    Reset Pilihan ({selectedStudents.length})
                  </button>
                )}
              </div>

              {/* Multi-chip selector wrapper */}
              <div className="relative">
                <div
                  onClick={() => setShowStudentDropdown(true)}
                  className="w-full min-h-[44px] px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white flex flex-wrap items-center gap-2 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 transition-all cursor-text"
                >
                  {/* Selected Student Chips */}
                  {selectedStudents.map((name) => (
                    <span
                      key={name}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStudent(name);
                        }}
                        className="text-slate-400 hover:text-rose-600 rounded p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}

                  {/* Input Search or Manual Entry */}
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setShowStudentDropdown(true);
                    }}
                    onFocus={() => setShowStudentDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddManualStudent();
                      }
                    }}
                    placeholder={
                      selectedStudents.length === 0
                        ? "Ketik nama santri atau pilih dari database..."
                        : "Tambah siswa lain..."
                    }
                    className="flex-1 min-w-[160px] text-xs font-medium bg-transparent outline-none text-slate-800 dark:text-white placeholder:text-slate-400 py-1"
                  />
                </div>

                {/* Dropdown Hasil Pencarian */}
                {showStudentDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowStudentDropdown(false)}
                    />
                    <div className="absolute z-30 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto p-1.5">
                      {filteredCandidateStudents.length > 0 ? (
                        <>
                          <div className="px-3 py-1 text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                            Pilih Dari Database Santri:
                          </div>
                          {filteredCandidateStudents.map((s) => (
                            <div
                              key={s.id || s.nik || s.nama_lengkap}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectStudent(s);
                              }}
                              className="p-2.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-xs my-0.5"
                            >
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-100">
                                  {s.nama_lengkap}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>Kamar: {s.kamar || "-"}</span>
                                  <span>•</span>
                                  <span>Kelas: {s.kelas_sekolah || s.kelas_pengajian || "-"}</span>
                                </div>
                              </div>
                              <span className="text-sky-600 dark:text-sky-400 font-medium text-xs">
                                Pilih
                              </span>
                            </div>
                          ))}
                        </>
                      ) : null}

                      {/* Opsi masukkan nama manual jika tidak ditemukan */}
                      {studentSearch.trim() && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddManualStudent();
                          }}
                          className="p-2.5 border-t border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-sky-600 dark:text-sky-400 font-semibold flex items-center justify-between"
                        >
                          <span>Gunakan nama: &quot;{studentSearch.trim()}&quot;</span>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded">
                            Enter
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* URAIAN PELANGGARAN */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Masukkan Pelanggaran <span className="text-rose-500">*</span>
              </label>

              <textarea
                rows={3}
                required
                value={pelanggaranText}
                onChange={(e) => setPelanggaranText(e.target.value)}
                placeholder="Masukkan pelanggaran..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-normal focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none leading-relaxed"
              />
            </div>

            {/* TANGGAL & STATUS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Tanggal */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tanggal Pelanggaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Status Penanganan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus("Belum Selesai")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                      status === "Belum Selesai"
                        ? "bg-rose-500 text-white border-rose-500"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    Belum Selesai
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus("Selesai")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                      status === "Selesai"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>

            {/* TOMBOL SIMPAN */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Catatan Pelanggaran</span>
              )}
            </button>
          </form>
        </div>
      )}

      {/* VIEW MODE 2: REKAP DATA PELANGGARAN */}
      {viewMode === "rekap" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                Rekap Data Pelanggaran Siswa
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Daftar semua pelanggaran yang tercatat di tabel database Supabase.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pelanggaranList.some((p) => p.isLocalOnly) && (
                <button
                  onClick={syncPendingLocalRecords}
                  disabled={isSyncing}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs animate-pulse"
                  title="Sinkronkan data yang masih tersimpan di perangkat lokal ke Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>Sinkronkan Cloud ({pelanggaranList.filter((p) => p.isLocalOnly).length})</span>
                </button>
              )}
              <button
                onClick={() => fetchPelanggaran()}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors flex items-center gap-1.5"
                title="Muat ulang dari Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>Segarkan</span>
              </button>
              <button
                onClick={() => onSwitchMode("input")}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Input Baru</span>
              </button>
            </div>
          </div>

          {/* FILTER & PENCARIAN BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={rekapSearch}
                onChange={(e) => setRekapSearch(e.target.value)}
                placeholder="Cari berdasarkan nama siswa atau uraian pelanggaran..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="semua">Semua Status</option>
                <option value="Belum Selesai">Belum Selesai</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>
          </div>

          {/* TABEL REKAP */}
          {filteredRekapList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Belum ada catatan pelanggaran ditemukan.
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {rekapSearch || filterStatus !== "semua"
                  ? "Coba sesuaikan kata kunci pencarian atau filter status."
                  : "Klik tombol 'Input Baru' untuk menambah catatan pelanggaran siswa."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3.5">Tanggal</th>
                    <th className="py-3 px-3.5">Nama Siswa</th>
                    <th className="py-3 px-3.5">Pelanggarannya</th>
                    <th className="py-3 px-3.5 text-center">Status (Klik untuk Ubah)</th>
                    <th className="py-3 px-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredRekapList.map((item) => {
                    const studentMeta = studentMetaMap.get(item.nama_siswa.trim().toLowerCase());
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3.5 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {item.tanggal}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              {item.nama_siswa}
                            </span>
                            {item.isLocalOnly && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80"
                                title="Data ini tersimpan di memori perangkat lokal dan menunggu disinkronkan ke Supabase"
                              >
                                💾 Lokal
                              </span>
                            )}
                          </div>
                          {studentMeta && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>Kamar: {studentMeta.kamar || "-"}</span>
                              <span>•</span>
                              <span>{studentMeta.kategori}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 max-w-md">
                          <div className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                            {item.pelanggaran}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(item)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                              item.status === "Selesai"
                                ? "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                                : "bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/70 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300"
                            }`}
                            title="Klik untuk mengubah status"
                          >
                            {item.status === "Selesai" ? "Selesai" : "Belum Selesai"}
                          </button>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingRecord(item)}
                              className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit Catatan"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(item.id, item.nama_siswa)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Catatan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-600" />
                Edit Catatan Pelanggaran
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Nama Siswa */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Nama Siswa *
                </label>
                <input
                  type="text"
                  required
                  value={editingRecord.nama_siswa}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, nama_siswa: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Pelanggaran */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Pelanggarannya *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingRecord.pelanggaran}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, pelanggaran: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-slate-800 dark:text-slate-100 resize-none leading-relaxed"
                />
              </div>

              {/* Tanggal */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Tanggal *
                </label>
                <input
                  type="date"
                  required
                  value={editingRecord.tanggal}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, tanggal: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Status Proses *
                </label>
                <select
                  value={editingRecord.status}
                  onChange={(e) =>
                    setEditingRecord({
                      ...editingRecord,
                      status: e.target.value as "Belum Selesai" | "Selesai",
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="Belum Selesai">Belum Selesai</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors"
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
