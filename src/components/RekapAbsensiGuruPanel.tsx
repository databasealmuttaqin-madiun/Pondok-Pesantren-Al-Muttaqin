import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar, Clock, Search, Filter, Download, Printer, RefreshCw,
  MapPin, CheckCircle2, AlertTriangle, User, ShieldCheck,
  ChevronLeft, ChevronRight, ArrowUpDown, FileSpreadsheet,
  TrendingUp, Users, ExternalLink, X, Eye, Sparkles, Building2,
  CalendarDays, Check, Info, Trash2, ArrowUpRight, CheckCircle
} from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

const MySwal = withReactContent(Swal);

export interface AbsensiGuruRecord {
  id: string;
  username: string;
  nama_guru: string;
  waktu_absen: string; // ISO timestamptz
  latitude?: number | null;
  longitude?: number | null;
  status_lokasi?: string | null;
  keterangan?: string | null;
}

interface RekapAbsensiGuruPanelProps {
  currentUser?: { username: string; role: string; name: string; id?: string } | null;
}

// Koordinat referensi sekolah (Al-Muttaqin)
const SCHOOL_COORDINATES = {
  latitude: -7.227800,
  longitude: 111.534500,
  name: "SMP IT Al-Muttaqin"
};

// Formula Haversine hitung jarak
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Format waktu jam:menit WIB
function formatWaktuWIB(isoStr?: string | null) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) + " WIB";
  } catch {
    return "-";
  }
}

// Format tanggal lengkap
function formatTanggalIndo(isoStr?: string | null) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "-";
  }
}

export default function RekapAbsensiGuruPanel({ currentUser }: RekapAbsensiGuruPanelProps) {
  const isAdmin = useMemo(() => {
    const role = (currentUser?.role || "").toLowerCase();
    return role.includes("admin") || role.includes("super") || role.includes("pimpinan");
  }, [currentUser]);

  // Data states
  const [records, setRecords] = useState<AbsensiGuruRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AbsensiGuruRecord | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGuru, setFilterGuru] = useState<string>("ALL");
  const [filterLokasi, setFilterLokasi] = useState<string>("ALL");
  const [filterKeterangan, setFilterKeterangan] = useState<string>("ALL");
  
  // Date range presets: "today" | "week" | "month" | "all" | "custom"
  const [datePreset, setDatePreset] = useState<"today" | "week" | "month" | "all" | "custom">("month");
  
  const todayYMD = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const firstDayOfMonthYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  const [startDate, setStartDate] = useState<string>(firstDayOfMonthYMD);
  const [endDate, setEndDate] = useState<string>(todayYMD);

  // Tab mode: "table" | "rekap_guru" | "timeline"
  const [viewMode, setViewMode] = useState<"table" | "rekap_guru" | "timeline">("table");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Database connection check state
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "error">("checking");
  const [dbPingTime, setDbPingTime] = useState<number | null>(null);
  const [isTestingInsert, setIsTestingInsert] = useState(false);

  // Fetch data dari database Supabase (tabel absensi_guru)
  const fetchAbsensiGuru = async (showToast = false) => {
    if (showToast) setIsRefreshing(true);
    else setIsLoading(true);

    const startTime = performance.now();
    try {
      let query = supabase
        .from("absensi_guru")
        .select("*")
        .order("waktu_absen", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Gagal mengambil data absensi_guru:", error);
        setDbStatus("error");
        throw error;
      }

      const elapsed = Math.round(performance.now() - startTime);
      setDbPingTime(elapsed);
      setDbStatus("connected");

      if (data) {
        setRecords(data as AbsensiGuruRecord[]);
        localStorage.setItem("cache_rekap_absensi_guru", JSON.stringify(data));
      }
    } catch (err: any) {
      console.warn("Menggunakan cache lokal:", err);
      setDbStatus("error");
      const cached = localStorage.getItem("cache_rekap_absensi_guru");
      if (cached) {
        setRecords(JSON.parse(cached));
      }
      if (showToast) {
        MySwal.fire({
          icon: "error",
          title: "Koneksi Database Bermasalah",
          text: err?.message || "Gagal menghubungi tabel absensi_guru di Supabase.",
          confirmButtonColor: "#2563eb"
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Function to run a live connection test
  const handleTestDatabaseConnection = async () => {
    setIsTestingInsert(true);
    const testUsername = currentUser?.username || "guru.test";
    const testNama = currentUser?.name || "Ustadz Ahmad (Uji Coba)";
    
    try {
      const testPayload = {
        username: testUsername,
        nama_guru: testNama,
        waktu_absen: new Date().toISOString(),
        latitude: -7.2278,
        longitude: 111.5345,
        status_lokasi: "Dalam Jangkauan",
        keterangan: "Presensi Uji Coba Koneksi Database"
      };

      const { data, error } = await supabase
        .from("absensi_guru")
        .insert([testPayload])
        .select();

      if (error) {
        throw error;
      }

      setDbStatus("connected");
      await fetchAbsensiGuru();

      MySwal.fire({
        icon: "success",
        title: "Koneksi Database Berhasil!",
        html: `
          <div class="text-left text-sm space-y-2 mt-2">
            <p class="text-emerald-700 dark:text-emerald-300 font-semibold">Tabel <code>absensi_guru</code> di Supabase 100% aktif dan terhubung!</p>
            <p class="text-xs text-slate-600 dark:text-slate-400">Data uji coba kehadiran atas nama <b>${testNama}</b> telah berhasil disimpan dan langsung masuk ke tabel rekapan.</p>
          </div>
        `,
        confirmButtonColor: "#10b981",
        confirmButtonText: "Tutup"
      });
    } catch (err: any) {
      console.error("Test database failed:", err);
      setDbStatus("error");
      MySwal.fire({
        icon: "error",
        title: "Uji Koneksi Gagal",
        text: err?.message || "Tabel absensi_guru belum dapat diakses di database Supabase.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setIsTestingInsert(false);
    }
  };

  // Initial load and Realtime Supabase Subscription
  useEffect(() => {
    fetchAbsensiGuru();

    // Setup realtime subscription
    const channel = supabase
      .channel("realtime-absensi-guru")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "absensi_guru" },
        (payload) => {
          console.log("Realtime event on absensi_guru:", payload);
          fetchAbsensiGuru();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update date filter based on presets
  const handleDatePresetChange = (preset: "today" | "week" | "month" | "all" | "custom") => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === "today") {
      const todayStr = now.toISOString().split("T")[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "week") {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Senin
      d.setDate(diff);
      const startWeek = d.toISOString().split("T")[0];
      setStartDate(startWeek);
      setEndDate(now.toISOString().split("T")[0]);
    } else if (preset === "month") {
      const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      setStartDate(startMonth);
      setEndDate(now.toISOString().split("T")[0]);
    } else if (preset === "all") {
      setStartDate("2026-01-01");
      setEndDate(now.toISOString().split("T")[0]);
    }
  };

  // Daftar nama guru unik untuk dropdown filter
  const daftarGuruList = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach(r => {
      if (r.username && r.nama_guru) {
        map.set(r.username, r.nama_guru);
      }
    });
    return Array.from(map.entries()).map(([username, nama_guru]) => ({ username, nama_guru }));
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // 1. Date filter
      if (datePreset !== "all") {
        if (!record.waktu_absen) return false;
        const recDate = new Date(record.waktu_absen).toISOString().split("T")[0];
        if (startDate && recDate < startDate) return false;
        if (endDate && recDate > endDate) return false;
      }

      // 2. Guru filter
      if (filterGuru !== "ALL" && record.username !== filterGuru) {
        return false;
      }

      // 3. Status Lokasi filter
      if (filterLokasi !== "ALL") {
        const loc = (record.status_lokasi || "").toLowerCase();
        if (filterLokasi === "DALAM" && !loc.includes("dalam")) return false;
        if (filterLokasi === "LUAR" && !loc.includes("luar")) return false;
        if (filterLokasi === "IZIN" && !loc.includes("izin")) return false;
      }

      // 4. Keterangan filter
      if (filterKeterangan !== "ALL") {
        const ket = (record.keterangan || "").toLowerCase();
        if (filterKeterangan === "MASUK" && !ket.includes("masuk")) return false;
        if (filterKeterangan === "PULANG" && !ket.includes("pulang")) return false;
        if (filterKeterangan === "HADIR" && !ket.includes("hadir") && !ket.includes("masuk")) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nama = (record.nama_guru || "").toLowerCase();
        const user = (record.username || "").toLowerCase();
        const ket = (record.keterangan || "").toLowerCase();
        const stat = (record.status_lokasi || "").toLowerCase();
        return nama.includes(q) || user.includes(q) || ket.includes(q) || stat.includes(q);
      }

      return true;
    });
  }, [records, datePreset, startDate, endDate, filterGuru, filterLokasi, filterKeterangan, searchQuery]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    let dalamJangkauan = 0;
    let luarJangkauan = 0;
    let masukCount = 0;
    let pulangCount = 0;
    const uniqueGurus = new Set<string>();

    filteredRecords.forEach(r => {
      if (r.username) uniqueGurus.add(r.username);
      const loc = (r.status_lokasi || "").toLowerCase();
      if (loc.includes("dalam")) dalamJangkauan++;
      else if (loc.includes("luar")) luarJangkauan++;

      const ket = (r.keterangan || "").toLowerCase();
      if (ket.includes("masuk")) masukCount++;
      if (ket.includes("pulang")) pulangCount++;
    });

    return {
      total,
      guruCount: uniqueGurus.size,
      dalamJangkauan,
      luarJangkauan,
      masukCount,
      pulangCount,
      persenDalam: total > 0 ? Math.round((dalamJangkauan / total) * 100) : 0
    };
  }, [filteredRecords]);

  // Rekapitulasi agregasi per Guru
  const rekapPerGuru = useMemo(() => {
    const guruMap = new Map<string, {
      username: string;
      nama_guru: string;
      totalAbsen: number;
      totalMasuk: number;
      totalPulang: number;
      dalamJangkauan: number;
      luarJangkauan: number;
      lastAbsen: string;
      records: AbsensiGuruRecord[];
    }>();

    filteredRecords.forEach(r => {
      const u = r.username || "unknown";
      if (!guruMap.has(u)) {
        guruMap.set(u, {
          username: u,
          nama_guru: r.nama_guru || u,
          totalAbsen: 0,
          totalMasuk: 0,
          totalPulang: 0,
          dalamJangkauan: 0,
          luarJangkauan: 0,
          lastAbsen: r.waktu_absen,
          records: []
        });
      }

      const item = guruMap.get(u)!;
      item.totalAbsen += 1;
      item.records.push(r);

      const ket = (r.keterangan || "").toLowerCase();
      if (ket.includes("masuk")) item.totalMasuk += 1;
      if (ket.includes("pulang")) item.totalPulang += 1;

      const loc = (r.status_lokasi || "").toLowerCase();
      if (loc.includes("dalam")) item.dalamJangkauan += 1;
      else if (loc.includes("luar")) item.luarJangkauan += 1;

      if (new Date(r.waktu_absen) > new Date(item.lastAbsen)) {
        item.lastAbsen = r.waktu_absen;
      }
    });

    return Array.from(guruMap.values()).sort((a, b) => b.totalAbsen - a.totalAbsen);
  }, [filteredRecords]);

  // Pagination logic
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      MySwal.fire({
        icon: "warning",
        title: "Tidak Ada Data",
        text: "Tidak ada baris data yang cocok dengan filter untuk diekspor.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    const headers = [
      "ID",
      "Waktu Absen (WIB)",
      "Tanggal",
      "Nama Guru",
      "Username",
      "Status Lokasi",
      "Latitude",
      "Longitude",
      "Keterangan"
    ];

    const rows = filteredRecords.map(r => [
      `"${r.id || ""}"`,
      `"${formatWaktuWIB(r.waktu_absen)}"`,
      `"${formatTanggalIndo(r.waktu_absen)}"`,
      `"${(r.nama_guru || "").replace(/"/g, '""')}"`,
      `"${r.username || ""}"`,
      `"${r.status_lokasi || ""}"`,
      r.latitude ? `${r.latitude}` : '""',
      r.longitude ? `${r.longitude}` : '""',
      `"${(r.keterangan || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Absensi_Guru_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    MySwal.fire({
      icon: "success",
      title: "File Berhasil Diunduh",
      text: `Data ${filteredRecords.length} baris telah diekspor ke file CSV.`,
      timer: 1800,
      showConfirmButton: false
    });
  };

  // Cetak / Print Laporan
  const handlePrint = () => {
    window.print();
  };

  // Delete handler (Admin only)
  const handleDeleteRecord = async (record: AbsensiGuruRecord) => {
    if (!isAdmin) return;

    const res = await MySwal.fire({
      icon: "warning",
      title: "Hapus Log Absensi?",
      html: `Apakah Anda yakin ingin menghapus data absensi <b>${record.nama_guru}</b> pada <i>${formatTanggalIndo(record.waktu_absen)} ${formatWaktuWIB(record.waktu_absen)}</i>?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#e11d48"
    });

    if (!res.isConfirmed) return;

    try {
      const { error } = await supabase
        .from("absensi_guru")
        .delete()
        .eq("id", record.id);

      if (error) throw error;

      setRecords(prev => prev.filter(r => r.id !== record.id));
      if (selectedRecord?.id === record.id) setSelectedRecord(null);

      MySwal.fire({
        icon: "success",
        title: "Data Dihapus",
        text: "Catatan absensi telah berhasil dihapus dari database.",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err: any) {
      MySwal.fire({
        icon: "error",
        title: "Gagal Menghapus",
        text: err?.message || "Terjadi kendala saat menghapus data.",
        confirmButtonColor: "#2563eb"
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="rekap_absensi_guru_panel">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          category="SEKOLAH & PRESENSI"
          title="Rekapan Absensi Guru"
          description="Laporan rekapitulasi kehadiran dan log absensi seluruh dewan guru berbasis database real-time."
        />

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Database Live Status Indicator */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
            dbStatus === "connected"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              : dbStatus === "checking"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              dbStatus === "connected" ? "bg-emerald-500 animate-pulse" : dbStatus === "checking" ? "bg-amber-500 animate-ping" : "bg-rose-500"
            }`} />
            <span>
              {dbStatus === "connected"
                ? `Supabase DB: Terhubung ${dbPingTime ? `(${dbPingTime}ms)` : ""}`
                : dbStatus === "checking"
                ? "Memeriksa Koneksi..."
                : "Gagal Terhubung"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleTestDatabaseConnection}
            disabled={isTestingInsert}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-60"
            title="Kirim 1 catatan uji coba untuk memverifikasi tabel absensi_guru"
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isTestingInsert ? "animate-spin" : ""}`} />
            <span>{isTestingInsert ? "Menguji..." : "Tes Koneksi DB"}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchAbsensiGuru(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-xs"
            title="Muat ulang data dari database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            <span>{isRefreshing ? "Sinkronisasi..." : "Perbarui Data"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Download rekapan format CSV / Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            title="Cetak laporan resmi"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Dokumen</span>
          </button>
        </div>
      </div>

      {/* 2. STATISTIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Presensi */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Log Absen
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.total}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                kali
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Jumlah Guru Aktif */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Guru Terekam
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.guruCount}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                orang
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Dalam Jangkauan (Radius Valid) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Dalam Jangkauan
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {stats.dalamJangkauan}
              </span>
              <span className="text-[11px] font-bold text-emerald-600/90 dark:text-emerald-400/90">
                ({stats.persenDalam}%)
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Luar Jangkauan */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Luar Jangkauan
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {stats.luarJangkauan}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                log
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FILTER & VIEW MODE BAR */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Top: View Mode Tabs & Date Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start">
            <button
              type="button"
              onClick={() => { setViewMode("table"); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Tabel Log Absensi ({filteredRecords.length})
            </button>
            <button
              type="button"
              onClick={() => { setViewMode("rekap_guru"); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "rekap_guru"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Rekapitulasi per Guru ({rekapPerGuru.length})
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Periode:</span>
            </span>

            {(["today", "week", "month", "all", "custom"] as const).map(preset => {
              const labels = {
                today: "Hari Ini",
                week: "Minggu Ini",
                month: "Bulan Ini",
                all: "Semua",
                custom: "Kustom"
              };
              const isActive = datePreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleDatePresetChange(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Inputs (if custom / active) */}
        {datePreset === "custom" && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          </div>
        )}

        {/* Search & Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* 1. Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari guru, username, atau catatan..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          {/* 2. Filter Guru */}
          <div>
            <select
              value={filterGuru}
              onChange={(e) => { setFilterGuru(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="ALL">Semua Guru ({daftarGuruList.length})</option>
              {daftarGuruList.map(g => (
                <option key={g.username} value={g.username}>
                  {g.nama_guru} ({g.username})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter Status Lokasi */}
          <div>
            <select
              value={filterLokasi}
              onChange={(e) => { setFilterLokasi(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="ALL">Semua Status Lokasi</option>
              <option value="DALAM">Dalam Jangkauan</option>
              <option value="LUAR">Luar Jangkauan</option>
              <option value="IZIN">Pengajuan Izin</option>
            </select>
          </div>

          {/* 4. Filter Keterangan */}
          <div>
            <select
              value={filterKeterangan}
              onChange={(e) => { setFilterKeterangan(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="ALL">Semua Keterangan / Jenis</option>
              <option value="MASUK">Presensi Masuk</option>
              <option value="PULANG">Presensi Pulang</option>
              <option value="HADIR">Hadir / Lainnya</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. CONTENT DISPLAY BASED ON VIEW MODE */}
      {viewMode === "table" ? (
        /* TABEL LOG ABSENSI GURU */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
              <p className="text-sm font-semibold">Memuat Data Absensi Guru dari Database...</p>
              <p className="text-xs text-slate-400 mt-1">Mengambil rekaman tabel absensi_guru Supabase</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Tidak Ada Data Absensi
              </h4>
              <p className="text-xs max-w-sm mx-auto text-slate-400">
                Tidak ditemukan rekaman absensi yang cocok dengan kriteria filter tanggal atau pencarian yang dipilih.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Waktu Absen</th>
                    <th className="py-3 px-4">Nama Guru</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Status Lokasi</th>
                    <th className="py-3 px-4">Koordinat GPS</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedRecords.map((rec, index) => {
                    const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                    const isWithin = (rec.status_lokasi || "").toLowerCase().includes("dalam");
                    const isOutside = (rec.status_lokasi || "").toLowerCase().includes("luar");
                    const isIzin = (rec.status_lokasi || "").toLowerCase().includes("izin");

                    return (
                      <tr 
                        key={rec.id || index}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 text-center font-medium text-slate-400">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {formatWaktuWIB(rec.waktu_absen)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatTanggalIndo(rec.waktu_absen)}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                            <span>{rec.nama_guru || "Guru"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          @{rec.username}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isWithin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Dalam Jangkauan</span>
                            </span>
                          ) : isOutside ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Luar Jangkauan</span>
                            </span>
                          ) : isIzin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <Info className="w-3 h-3" />
                              <span>Pengajuan Izin</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {rec.status_lokasi || "-"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {rec.latitude && rec.longitude ? (
                            <a
                              href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                              title="Buka titik koordinat di Google Maps"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>{rec.latitude.toFixed(5)}, {rec.longitude.toFixed(5)}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 max-w-[200px] truncate" title={rec.keterangan || ""}>
                            {rec.keterangan || "Hadir"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(rec)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 transition-colors cursor-pointer"
                              title="Lihat Detail Absensi"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(rec)}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400 transition-colors cursor-pointer"
                                title="Hapus Catatan (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!isLoading && filteredRecords.length > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span>Menampilkan</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>dari <strong>{filteredRecords.length}</strong> total baris</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 font-bold text-slate-800 dark:text-slate-200">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* REKAPITULASI PER GURU (SUMMARY MATRIX) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rekapPerGuru.map((item, idx) => {
              const persenValid = item.totalAbsen > 0 
                ? Math.round((item.dalamJangkauan / item.totalAbsen) * 100) 
                : 0;

              return (
                <div 
                  key={item.username || idx}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 hover:border-blue-300 dark:hover:border-blue-800 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {item.nama_guru}
                        </h4>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">
                          @{item.username}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                        {item.totalAbsen} Absen
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block font-medium">
                          Presensi Masuk
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.totalMasuk} kali
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block font-medium">
                          Presensi Pulang
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.totalPulang} kali
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Validitas Jangkauan</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {item.dalamJangkauan} / {item.totalAbsen} ({persenValid}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${persenValid}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Terakhir: {formatTanggalIndo(item.lastAbsen)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterGuru(item.username);
                        setViewMode("table");
                        setCurrentPage(1);
                      }}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Lihat Log</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. MODAL DETAIL ABSENSI INTERAKTIF */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-zoom-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Detail Presensi Guru
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ID Log: <span className="font-mono">{selectedRecord.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Profile Guru */}
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0">
                  {selectedRecord.nama_guru?.charAt(0)?.toUpperCase() || "G"}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {selectedRecord.nama_guru}
                  </h4>
                  <p className="text-xs font-mono text-blue-600 dark:text-blue-400">
                    @{selectedRecord.username}
                  </p>
                </div>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Waktu Absen</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatWaktuWIB(selectedRecord.waktu_absen)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatTanggalIndo(selectedRecord.waktu_absen)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Status Lokasi</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {selectedRecord.status_lokasi || "-"}
                  </p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    (selectedRecord.status_lokasi || "").toLowerCase().includes("dalam")
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}>
                    {(selectedRecord.status_lokasi || "").toLowerCase().includes("dalam") ? "Radius &le; 50m" : "Luar Radius"}
                  </span>
                </div>
              </div>

              {/* Koordinat & Google Maps Link */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <span className="text-[11px] text-slate-400 block font-medium">Titik Koordinat GPS</span>
                {selectedRecord.latitude && selectedRecord.longitude ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
                      Lat: {selectedRecord.latitude} <br />
                      Lng: {selectedRecord.longitude}
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${selectedRecord.latitude},${selectedRecord.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shrink-0 cursor-pointer shadow-xs"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Buka Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Koordinat lokasi tidak tersimpan (Izin / Manual).</p>
                )}
              </div>

              {/* Keterangan */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <span className="text-[11px] text-slate-400 block font-medium">Keterangan / Catatan</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedRecord.keterangan || "Presensi Kehadiran Guru"}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
