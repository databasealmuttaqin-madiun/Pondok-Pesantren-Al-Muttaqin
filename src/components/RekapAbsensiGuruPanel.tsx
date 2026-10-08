import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar, Clock, Search, Filter, Download, Printer, RefreshCw,
  MapPin, CheckCircle2, AlertTriangle, User, ShieldCheck,
  ChevronLeft, ChevronRight, ArrowUpDown, FileSpreadsheet,
  TrendingUp, Users, ExternalLink, X, Eye, Sparkles, Building2,
  CalendarDays, Check, Info, Trash2, ArrowUpRight, CheckCircle,
  FileText, ArrowLeft, ArrowRight, UserCheck, AlertCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

export interface RekapHarianGuru {
  id: string;
  username: string;
  nama_guru: string;
  tanggal: string; // YYYY-MM-DD
  hari: string; // "Senin", "Selasa", dll
  tanggalFormatted: string; // "Senin, 28 Sep 2026"
  jamMasuk: string | null;
  jamMasukRaw: string | null;
  jamPulang: string | null;
  jamPulangRaw: string | null;
  status: "Tepat Waktu" | "Telat" | "Belum Masuk";
  terlambatMenit: number;
  jadwalMasuk: string;
  jadwalPulang: string;
  lokasiMasuk?: string | null;
  lokasiPulang?: string | null;
  logs: AbsensiGuruRecord[];
}

interface RekapAbsensiGuruPanelProps {
  currentUser?: { username: string; role: string; name: string; id?: string } | null;
}

// Jadwal Masuk Standar per Hari (diambil dari plotting atau default Al-Muttaqin)
const DEFAULT_SCHEDULES: Record<string, { jam_masuk: string; toleransi: number; jam_pulang: string }> = {
  "Senin": { jam_masuk: "06:45", toleransi: 15, jam_pulang: "14:00" },
  "Selasa": { jam_masuk: "07:00", toleransi: 15, jam_pulang: "14:00" },
  "Rabu": { jam_masuk: "07:00", toleransi: 15, jam_pulang: "14:00" },
  "Kamis": { jam_masuk: "07:00", toleransi: 15, jam_pulang: "14:00" },
  "Jumat": { jam_masuk: "07:00", toleransi: 15, jam_pulang: "11:30" },
  "Sabtu": { jam_masuk: "07:00", toleransi: 15, jam_pulang: "13:00" },
  "Ahad": { jam_masuk: "07:00", toleransi: 15, jam_pulang: "12:00" }
};

const HARI_NAMES = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Helper: Format waktu jam:menit:detik WIB (Zona Waktu Indonesia Barat)
function formatWaktuWIB(isoStr?: string | null): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).replace(/\./g, ":") + " WIB";
  } catch {
    return "-";
  }
}

// Helper: Format tanggal lengkap Indonesia (WIB)
function formatTanggalIndo(dateStrOrIso?: string | null): string {
  if (!dateStrOrIso) return "-";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrOrIso)) {
      const [y, m, d] = dateStrOrIso.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return date.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }
    const d = new Date(dateStrOrIso);
    if (isNaN(d.getTime())) return String(dateStrOrIso);
    return d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "-";
  }
}

// Helper: Dapatkan YYYY-MM-DD dalam Waktu Indonesia Barat (Asia/Jakarta)
function getWIBDateString(dateObjOrIso: Date | string): string {
  try {
    const d = typeof dateObjOrIso === "string" ? new Date(dateObjOrIso) : dateObjOrIso;
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
  } catch {
    const d = typeof dateObjOrIso === "string" ? new Date(dateObjOrIso) : dateObjOrIso;
    return d.toISOString().split("T")[0];
  }
}

export default function RekapAbsensiGuruPanel({ currentUser }: RekapAbsensiGuruPanelProps) {
  const isAdmin = useMemo(() => {
    const role = (currentUser?.role || "").toLowerCase();
    return role.includes("admin") || role.includes("super") || role.includes("pimpinan");
  }, [currentUser]);

  // Data states
  const [records, setRecords] = useState<AbsensiGuruRecord[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, { jam_masuk: string; toleransi: number; jam_pulang: string }>>(DEFAULT_SCHEDULES);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRekap, setSelectedRekap] = useState<RekapHarianGuru | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Tab View Mode:
  // "rekap_harian" = TABEL UTAMA REKAP PRESENSI GURU (Nama, Tanggal, Jam Masuk, Jam Pulang, Status)
  // "rekap_guru"   = Akumulasi per Guru
  // "log_detail"   = Log Scan GPS & QR Mentah
  const [viewMode, setViewMode] = useState<"rekap_harian" | "rekap_guru" | "log_detail">("rekap_harian");

  // Filter Presets & Modes:
  // "hari" | "minggu" | "bulan" | "semua" | "kustom"
  const [filterMode, setFilterMode] = useState<"hari" | "minggu" | "bulan" | "semua" | "kustom">("hari");

  // Date selection states (Zona Waktu Indonesia Barat)
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getWIBDateString(new Date()), []);

  const [selectedDay, setSelectedDay] = useState<string>(todayStr); // Untuk filter "hari"
  const [selectedWeekDate, setSelectedWeekDate] = useState<string>(todayStr); // Untuk filter "minggu"
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Jadwal harian untuk hari yang dipilih
  const selectedDayHari = useMemo(() => {
    try {
      const d = new Date(selectedDay + "T00:00:00+07:00");
      return HARI_NAMES[d.getDay()] || "Senin";
    } catch {
      return "Senin";
    }
  }, [selectedDay]);

  const currentHariSchedule = useMemo(() => {
    return schedulesMap[selectedDayHari] || DEFAULT_SCHEDULES[selectedDayHari] || { jam_masuk: "07:00", toleransi: 15, jam_pulang: "14:00" };
  }, [schedulesMap, selectedDayHari]);

  // Other filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGuru, setFilterGuru] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL"); // "ALL" | "TEPAT" | "TELAT"

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Database connection check state
  const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "error">("checking");
  const [dbPingTime, setDbPingTime] = useState<number | null>(null);

  // 1. Fetch data dari database Supabase (tabel absensi_guru & plotting_jam_absensi)
  const fetchAbsensiGuru = async (showToast = false) => {
    if (showToast) setIsRefreshing(true);
    else setIsLoading(true);

    const startTime = performance.now();
    try {
      // Ambil data absensi
      const { data, error } = await supabase
        .from("absensi_guru")
        .select("*")
        .order("waktu_absen", { ascending: false });

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

      // Ambil jadwal plotting jam jika ada di database
      try {
        const { data: schedData } = await supabase
          .from("plotting_jam_absensi")
          .select("*");
        if (schedData && schedData.length > 0) {
          const map: Record<string, { jam_masuk: string; toleransi: number; jam_pulang: string }> = { ...DEFAULT_SCHEDULES };
          schedData.forEach((s: any) => {
            if (s.hari) {
              map[s.hari] = {
                jam_masuk: s.jam_masuk || "07:00",
                toleransi: Number(s.toleransi_menit ?? 15),
                jam_pulang: s.jam_pulang || "14:00"
              };
            }
          });
          setSchedulesMap(map);
        }
      } catch (errSched) {
        console.warn("Notice loading plotting_jam_absensi:", errSched);
      }
    } catch (err: any) {
      console.warn("Menggunakan cache lokal absensi_guru:", err);
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

  // Initial load and Realtime Supabase Subscription
  useEffect(() => {
    fetchAbsensiGuru();

    const channel = supabase
      .channel("realtime-absensi-guru-rekap")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "absensi_guru" },
        () => {
          fetchAbsensiGuru();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Hitung rentang tanggal efektif berdasarkan filterMode
  const { dateRangeStart, dateRangeEnd, periodeLabel } = useMemo(() => {
    if (filterMode === "hari") {
      const d = new Date(selectedDay + "T00:00:00");
      const label = formatTanggalIndo(selectedDay);
      return {
        dateRangeStart: selectedDay,
        dateRangeEnd: selectedDay,
        periodeLabel: label
      };
    }

    if (filterMode === "minggu") {
      const current = new Date(selectedWeekDate + "T00:00:00");
      const day = current.getDay();
      const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(current.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const startStr = getWIBDateString(monday);
      const endStr = getWIBDateString(sunday);
      const label = `${monday.getDate()} ${BULAN_NAMES[monday.getMonth()].substring(0, 3)} - ${sunday.getDate()} ${BULAN_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;

      return {
        dateRangeStart: startStr,
        dateRangeEnd: endStr,
        periodeLabel: `Minggu (${label})`
      };
    }

    if (filterMode === "bulan") {
      const startStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const label = `${BULAN_NAMES[selectedMonth]} ${selectedYear}`;

      return {
        dateRangeStart: startStr,
        dateRangeEnd: endStr,
        periodeLabel: `Bulan ${label}`
      };
    }

    if (filterMode === "kustom") {
      return {
        dateRangeStart: customStartDate,
        dateRangeEnd: customEndDate,
        periodeLabel: `${customStartDate} s/d ${customEndDate}`
      };
    }

    // "semua"
    return {
      dateRangeStart: "2025-01-01",
      dateRangeEnd: "2030-12-31",
      periodeLabel: "Semua Waktu"
    };
  }, [filterMode, selectedDay, selectedWeekDate, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Daftar nama guru unik untuk dropdown filter
  const daftarGuruList = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach(r => {
      if (r.username && r.nama_guru) {
        map.set(r.username, r.nama_guru);
      }
    });
    return Array.from(map.entries())
      .map(([username, nama_guru]) => ({ username, nama_guru }))
      .sort((a, b) => a.nama_guru.localeCompare(b.nama_guru));
  }, [records]);

  // =====================================================================
  // AGREGASI: REKAP PRESENSI HARIAN PER GURU
  // Menghasilkan daftar baris: [Nama Guru, Tanggal, Jam Masuk, Jam Pulang, Status]
  // =====================================================================
  const allRekapHarian = useMemo(() => {
    // Kelompokkan data berdasarkan `${tanggalWIB}_${username}`
    const grouped = new Map<string, {
      username: string;
      nama_guru: string;
      tanggal: string;
      logs: AbsensiGuruRecord[];
    }>();

    records.forEach(rec => {
      if (!rec.waktu_absen) return;
      const recDate = new Date(rec.waktu_absen);
      if (isNaN(recDate.getTime())) return;

      // Konversi waktu absensi ke tanggal resmi zona WIB (Asia/Jakarta)
      const dateStr = getWIBDateString(rec.waktu_absen);
      const u = rec.username || rec.nama_guru || "unknown";
      const key = `${dateStr}_${u}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          username: u,
          nama_guru: rec.nama_guru || u,
          tanggal: dateStr,
          logs: []
        });
      }

      grouped.get(key)!.logs.push(rec);
    });

    // Proses setiap grup menjadi baris RekapHarianGuru
    const list: RekapHarianGuru[] = [];

    grouped.forEach((group, key) => {
      const { username, nama_guru, tanggal, logs } = group;
      const d = new Date(tanggal + "T00:00:00+07:00");
      const dayIdx = d.getDay();
      const hari = HARI_NAMES[dayIdx] || "Senin";
      const schedule = schedulesMap[hari] || DEFAULT_SCHEDULES[hari] || { jam_masuk: "07:00", toleransi: 15, jam_pulang: "14:00" };

      // Cari log masuk dan pulang
      let masukLog: AbsensiGuruRecord | null = null;
      let pulangLog: AbsensiGuruRecord | null = null;

      // Urutkan logs kronologis
      logs.sort((a, b) => new Date(a.waktu_absen).getTime() - new Date(b.waktu_absen).getTime());

      // 1. Prioritas Utama: Cocokkan langsung kolom 'keterangan' ('Masuk' vs 'Pulang')
      const masukCandidates = logs.filter(l => {
        const ket = (l.keterangan || "").trim().toLowerCase();
        return ket === "masuk" || ket.includes("masuk");
      });
      const pulangCandidates = logs.filter(l => {
        const ket = (l.keterangan || "").trim().toLowerCase();
        return ket === "pulang" || ket.includes("pulang");
      });

      if (masukCandidates.length > 0) {
        masukLog = masukCandidates[0]; // Scan masuk yang paling awal
      }
      if (pulangCandidates.length > 0) {
        pulangLog = pulangCandidates[pulangCandidates.length - 1]; // Scan pulang yang paling akhir
      }

      // 2. Fallback jika ada log tanpa keterangan eksplisit
      if (!masukLog && !pulangLog && logs.length > 0) {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).formatToParts(new Date(logs[0].waktu_absen));
        const hourWIB = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
        if (hourWIB < 12) {
          masukLog = logs[0];
          if (logs.length > 1) {
            pulangLog = logs[logs.length - 1];
          }
        } else {
          pulangLog = logs[logs.length - 1];
        }
      } else if (!pulangLog && logs.length > 1 && masukLog) {
        const lastLog = logs[logs.length - 1];
        if (lastLog.id !== masukLog.id) {
          const diffMs = new Date(lastLog.waktu_absen).getTime() - new Date(masukLog.waktu_absen).getTime();
          if (diffMs > 30 * 60 * 1000) {
            pulangLog = lastLog;
          }
        }
      }

      // Hitung keterlambatan dan status (Tepat Waktu vs Telat)
      let status: "Tepat Waktu" | "Telat" | "Belum Masuk" = "Tepat Waktu";
      let terlambatMenit = 0;

      if (masukLog) {
        const mDate = new Date(masukLog.waktu_absen);
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Jakarta",
          hour: "numeric",
          minute: "numeric",
          hour12: false
        }).formatToParts(mDate);
        const actualH = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
        const actualM = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
        const actualMinutes = actualH * 60 + actualM;

        const [schH, schM] = schedule.jam_masuk.split(":").map(Number);
        const targetMinutes = schH * 60 + schM;

        const diff = actualMinutes - targetMinutes;
        if (diff > schedule.toleransi) {
          status = "Telat";
          terlambatMenit = diff;
        } else if (diff > 0) {
          status = diff > schedule.toleransi ? "Telat" : "Tepat Waktu";
          terlambatMenit = diff;
        } else {
          status = "Tepat Waktu";
          terlambatMenit = 0;
        }
      } else {
        status = "Belum Masuk";
      }

      list.push({
        id: key,
        username,
        nama_guru,
        tanggal,
        hari,
        tanggalFormatted: formatTanggalIndo(tanggal),
        jamMasuk: masukLog ? formatWaktuWIB(masukLog.waktu_absen) : null,
        jamMasukRaw: masukLog ? masukLog.waktu_absen : null,
        jamPulang: pulangLog ? formatWaktuWIB(pulangLog.waktu_absen) : null,
        jamPulangRaw: pulangLog ? pulangLog.waktu_absen : null,
        status,
        terlambatMenit,
        jadwalMasuk: schedule.jam_masuk,
        jadwalPulang: schedule.jam_pulang,
        lokasiMasuk: masukLog?.status_lokasi || null,
        lokasiPulang: pulangLog?.status_lokasi || null,
        logs
      });
    });

    // Urutkan berdasarkan tanggal terbaru lalu nama guru
    list.sort((a, b) => {
      const cmpDate = b.tanggal.localeCompare(a.tanggal);
      if (cmpDate !== 0) return cmpDate;
      return a.nama_guru.localeCompare(b.nama_guru);
    });

    return list;
  }, [records, schedulesMap]);

  // =====================================================================
  // FILTERING REKAP HARIAN (Berdasarkan Periode, Guru, Status, Pencarian)
  // =====================================================================
  const filteredRekapHarian = useMemo(() => {
    return allRekapHarian.filter(item => {
      // 1. Filter Tanggal
      if (filterMode !== "semua") {
        if (item.tanggal < dateRangeStart || item.tanggal > dateRangeEnd) {
          return false;
        }
      }

      // 2. Filter Guru
      if (filterGuru !== "ALL" && item.username !== filterGuru) {
        return false;
      }

      // 3. Filter Status (Tepat Waktu / Telat)
      if (filterStatus === "TEPAT" && item.status !== "Tepat Waktu") return false;
      if (filterStatus === "TELAT" && item.status !== "Telat") return false;

      // 4. Pencarian Teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nama = item.nama_guru.toLowerCase();
        const user = item.username.toLowerCase();
        const tgl = item.tanggalFormatted.toLowerCase();
        const stat = item.status.toLowerCase();
        return nama.includes(q) || user.includes(q) || tgl.includes(q) || stat.includes(q);
      }

      return true;
    });
  }, [allRekapHarian, filterMode, dateRangeStart, dateRangeEnd, filterGuru, filterStatus, searchQuery]);

  // Filtered raw records untuk tab log detail
  const filteredRawRecords = useMemo(() => {
    return records.filter(r => {
      if (!r.waktu_absen) return false;
      const recDate = getWIBDateString(r.waktu_absen);

      if (filterMode !== "semua") {
        if (recDate < dateRangeStart || recDate > dateRangeEnd) return false;
      }
      if (filterGuru !== "ALL" && r.username !== filterGuru) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nama = (r.nama_guru || "").toLowerCase();
        const user = (r.username || "").toLowerCase();
        const ket = (r.keterangan || "").toLowerCase();
        return nama.includes(q) || user.includes(q) || ket.includes(q);
      }
      return true;
    });
  }, [records, filterMode, dateRangeStart, dateRangeEnd, filterGuru, searchQuery]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = filteredRekapHarian.length;
    let tepatWaktu = 0;
    let telat = 0;
    let belumMasuk = 0;
    let pulangTercatat = 0;
    const uniqueGurus = new Set<string>();

    filteredRekapHarian.forEach(item => {
      uniqueGurus.add(item.username);
      if (item.status === "Tepat Waktu") tepatWaktu++;
      else if (item.status === "Telat") telat++;
      else belumMasuk++;

      if (item.jamPulang) pulangTercatat++;
    });

    return {
      totalKehadiran: total,
      guruCount: uniqueGurus.size,
      tepatWaktu,
      telat,
      belumMasuk,
      pulangTercatat,
      persenTepat: total > 0 ? Math.round((tepatWaktu / total) * 100) : 0,
      persenTelat: total > 0 ? Math.round((telat / total) * 100) : 0
    };
  }, [filteredRekapHarian]);

  // Rekapitulasi Akumulasi per Guru
  const rekapPerGuru = useMemo(() => {
    const map = new Map<string, {
      username: string;
      nama_guru: string;
      totalHari: number;
      tepatWaktu: number;
      telat: number;
      pulangLengkap: number;
      terakhirMasuk: string | null;
    }>();

    filteredRekapHarian.forEach(item => {
      if (!map.has(item.username)) {
        map.set(item.username, {
          username: item.username,
          nama_guru: item.nama_guru,
          totalHari: 0,
          tepatWaktu: 0,
          telat: 0,
          pulangLengkap: 0,
          terakhirMasuk: null
        });
      }

      const g = map.get(item.username)!;
      g.totalHari += 1;
      if (item.status === "Tepat Waktu") g.tepatWaktu += 1;
      if (item.status === "Telat") g.telat += 1;
      if (item.jamPulang) g.pulangLengkap += 1;
      if (!g.terakhirMasuk && item.jamMasuk) {
        g.terakhirMasuk = `${item.tanggalFormatted} (${item.jamMasuk})`;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalHari - a.totalHari);
  }, [filteredRekapHarian]);

  // Pagination untuk Rekap Harian
  const totalPages = Math.ceil(filteredRekapHarian.length / itemsPerPage) || 1;
  const paginatedRekap = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRekapHarian.slice(start, start + itemsPerPage);
  }, [filteredRekapHarian, currentPage, itemsPerPage]);

  // Navigasi tanggal cepat (Hari / Minggu / Bulan)
  const handleNavigateDate = (direction: -1 | 1) => {
    if (filterMode === "hari") {
      const d = new Date(selectedDay + "T00:00:00");
      d.setDate(d.getDate() + direction);
      setSelectedDay(getWIBDateString(d));
    } else if (filterMode === "minggu") {
      const d = new Date(selectedWeekDate + "T00:00:00");
      d.setDate(d.getDate() + (direction * 7));
      setSelectedWeekDate(getWIBDateString(d));
    } else if (filterMode === "bulan") {
      let m = selectedMonth + direction;
      let y = selectedYear;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      setSelectedMonth(m);
      setSelectedYear(y);
    }
  };

  // =====================================================================
  // FITUR DOWNLOAD EXCEL (.XLSX)
  // =====================================================================
  const handleDownloadExcel = () => {
    if (filteredRekapHarian.length === 0) {
      MySwal.fire({
        icon: "warning",
        title: "Tidak Ada Data",
        text: "Tidak ada data presensi guru yang cocok untuk diekspor pada filter ini.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    setIsExportingExcel(true);
    try {
      const aoa: any[][] = [];
      // Header Kop Resmi
      aoa.push(["YAYASAN MUTTAQIN KOTA MADIUN"]);
      aoa.push(["SMP AL MUTTAQIN"]);
      aoa.push(["LAPORAN REKAPITULASI PRESENSI DEWAN GURU"]);
      aoa.push(["Sistem Informasi Presensi & Manajemen Kehadiran"]);
      aoa.push([]);

      if (filterMode === "hari") {
        // Mode PER HARI: Header Per Hari Lengkap
        aoa.push(["HARI / TANGGAL:", formatTanggalIndo(selectedDay).toUpperCase()]);
        aoa.push(["Jadwal Kerja:", `Masuk: ${currentHariSchedule.jam_masuk} WIB (Toleransi: ${currentHariSchedule.toleransi} Menit) | Pulang: ${currentHariSchedule.jam_pulang} WIB`]);
        aoa.push(["Ringkasan Kehadiran:", `Total: ${filteredRekapHarian.length} Guru | Tepat Waktu: ${stats.tepatWaktu} | Telat: ${stats.telat} | Sudah Absen Pulang: ${stats.pulangTercatat}`]);
        aoa.push(["Dicetak pada:", `${formatTanggalIndo(todayStr)} ${formatWaktuWIB(new Date().toISOString())}`]);
        aoa.push([]);
        // Kolom Tabel Rekap Harian
        aoa.push(["No", "Nama Guru", "Username", "Jam Masuk", "Jam Pulang", "Status Kehadiran", "Keterlambatan", "Jadwal Masuk", "Jadwal Pulang", "Keterangan"]);

        filteredRekapHarian.forEach((item, idx) => {
          const pulangText = item.jamPulang ? item.jamPulang : (item.tanggal === todayStr ? "Belum Pulang" : "Tidak Absen Pulang");
          aoa.push([
            idx + 1,
            item.nama_guru,
            item.username,
            item.jamMasuk || "-",
            pulangText,
            item.status,
            item.status === "Telat" ? `${item.terlambatMenit} Menit` : "Tepat Waktu",
            `${item.jadwalMasuk} WIB`,
            `${item.jadwalPulang} WIB`,
            item.status === "Telat" ? `Terlambat ${item.terlambatMenit} menit` : "Hadir Tepat Waktu"
          ]);
        });
      } else {
        // Mode Multi-Hari (Minggu / Bulan / Semua): Dikelompokkan dengan Header Per Hari untuk setiap tanggal
        aoa.push(["Periode:", periodeLabel]);
        aoa.push(["Ringkasan Keseluruhan:", `Total: ${stats.totalKehadiran} data | Guru Tercatat: ${stats.guruCount} orang | Tepat Waktu: ${stats.tepatWaktu} | Telat: ${stats.telat}`]);
        aoa.push(["Dicetak pada:", `${formatTanggalIndo(todayStr)} ${formatWaktuWIB(new Date().toISOString())}`]);
        aoa.push([]);

        // Kelompokkan data per tanggal
        const dateGroups = new Map<string, RekapHarianGuru[]>();
        filteredRekapHarian.forEach(item => {
          if (!dateGroups.has(item.tanggal)) dateGroups.set(item.tanggal, []);
          dateGroups.get(item.tanggal)!.push(item);
        });

        const sortedDates = Array.from(dateGroups.keys()).sort((a, b) => b.localeCompare(a));

        sortedDates.forEach(dateKey => {
          const groupItems = dateGroups.get(dateKey)!;
          const first = groupItems[0];

          // Subheader per Hari
          aoa.push([`=== HARI / TANGGAL: ${first.hari.toUpperCase()}, ${first.tanggalFormatted.toUpperCase()} (Jadwal: ${first.jadwalMasuk} - ${first.jadwalPulang} WIB) — ${groupItems.length} GURU ===`]);
          aoa.push(["No", "Nama Guru", "Username", "Jam Masuk", "Jam Pulang", "Status Kehadiran", "Keterlambatan", "Keterangan"]);

          groupItems.forEach((teacher, idx) => {
            const pulangText = teacher.jamPulang ? teacher.jamPulang : (teacher.tanggal === todayStr ? "Belum Pulang" : "Tidak Absen Pulang");
            aoa.push([
              idx + 1,
              teacher.nama_guru,
              teacher.username,
              teacher.jamMasuk || "-",
              pulangText,
              teacher.status,
              teacher.status === "Telat" ? `${teacher.terlambatMenit} Menit` : "Tepat Waktu",
              teacher.status === "Telat" ? `Terlambat ${teacher.terlambatMenit} menit` : "Hadir Tepat Waktu"
            ]);
          });

          aoa.push([]); // baris kosong pemisah antar hari
        });
      }

      // Buat worksheet dari array of arrays
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Atur lebar kolom agar rapi
      ws["!cols"] = [
        { wch: 6 },  // No
        { wch: 32 }, // Nama Guru
        { wch: 20 }, // Username
        { wch: 18 }, // Jam Masuk
        { wch: 18 }, // Jam Pulang
        { wch: 18 }, // Status Kehadiran
        { wch: 18 }, // Keterlambatan
        { wch: 16 }, // Jadwal Masuk
        { wch: 16 }, // Jadwal Pulang
        { wch: 24 }  // Keterangan
      ];

      // Buat workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Presensi Guru");

      // Nama file berdasarkan periode
      const cleanLabel = periodeLabel.replace(/[/\\?%*:|"<>]/g, "_");
      const filename = `Rekap_Presensi_Guru_${cleanLabel}.xlsx`;

      XLSX.writeFile(wb, filename);

      MySwal.fire({
        icon: "success",
        title: "Excel Berhasil Diunduh!",
        html: `File <b>${filename}</b> berisi rekapan presensi <b>SMP AL MUTTAQIN</b> siap dibuka.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error("Gagal export excel:", err);
      MySwal.fire({
        icon: "error",
        title: "Gagal Mengunduh Excel",
        text: err?.message || "Terjadi kendala saat menyusun file Excel.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // =====================================================================
  // FITUR DOWNLOAD PDF (.PDF)
  // =====================================================================
  const handleDownloadPDF = () => {
    if (filteredRekapHarian.length === 0) {
      MySwal.fire({
        icon: "warning",
        title: "Tidak Ada Data",
        text: "Tidak ada data presensi guru yang cocok untuk dicetak ke PDF.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    setIsExportingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // 1. KOP SURAT RESMI
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("SMP AL MUTTAQIN", 105, 15, { align: "center" });

      doc.setFontSize(10.5);
      doc.setFont("helvetica", "normal");
      doc.text("YAYASAN MUTTAQIN KOTA MADIUN", 105, 20.5, { align: "center" });
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("Sistem Informasi Presensi & Manajemen Kehadiran Dewan Guru", 105, 25, { align: "center" });

      // Garis ganda pembatas KOP
      doc.setLineWidth(0.8);
      doc.line(14, 27.5, 196, 27.5);
      doc.setLineWidth(0.2);
      doc.line(14, 28.5, 196, 28.5);

      // 2. JUDUL LAPORAN
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("LAPORAN REKAPITULASI PRESENSI GURU", 105, 36, { align: "center" });

      let lastTableY = 54;

      if (filterMode === "hari") {
        // 3A. HEADER PER HARI UNTUK MODE HARIAN
        doc.setFillColor(241, 245, 249); // slate-100
        doc.roundedRect(14, 41, 182, 14, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 58, 138); // blue-900
        doc.text(`HARI / TANGGAL : ${formatTanggalIndo(selectedDay).toUpperCase()}`, 18, 46.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(51, 65, 85); // slate-700
        doc.text(`Jadwal Kerja: Masuk ${currentHariSchedule.jam_masuk} WIB (Toleransi ${currentHariSchedule.toleransi} mnt) | Pulang ${currentHariSchedule.jam_pulang} WIB`, 18, 51.5);
        doc.text(`Total Hadir: ${filteredRekapHarian.length} Guru | Tepat: ${stats.tepatWaktu} | Telat: ${stats.telat}`, 192, 51.5, { align: "right" });

        const tableHead = [["No", "Nama Guru", "Jam Masuk", "Jam Pulang", "Status Kehadiran", "Keterangan"]];
        const tableBody = filteredRekapHarian.map((item, idx) => {
          const pulangText = item.jamPulang ? item.jamPulang : (item.tanggal === todayStr ? "Belum Pulang" : "Tidak Absen Pulang");
          let statusText: string = item.status;
          let ketText = "Hadir Tepat Waktu";
          if (item.status === "Telat") {
            statusText = `Telat (${item.terlambatMenit} mnt)`;
            ketText = `Terlambat ${item.terlambatMenit} mnt`;
          }
          return [
            idx + 1,
            item.nama_guru,
            item.jamMasuk || "-",
            pulangText,
            statusText,
            ketText
          ];
        });

        autoTable(doc, {
          startY: 58,
          head: tableHead,
          body: tableBody,
          theme: "striped",
          headStyles: {
            fillColor: [30, 58, 138], // Navy blue #1e3a8a
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: "bold",
            halign: "center"
          },
          styles: {
            fontSize: 8,
            cellPadding: 2.2,
            valign: "middle"
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { cellWidth: 58 },
            2: { halign: "center", cellWidth: 28 },
            3: { halign: "center", cellWidth: 28 },
            4: { halign: "center", cellWidth: 28 },
            5: { cellWidth: 30 }
          },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 4) {
              const rawText = String(data.cell.raw);
              if (rawText.includes("Tepat Waktu")) {
                data.cell.styles.textColor = [16, 149, 106];
                data.cell.styles.fontStyle = "bold";
              } else if (rawText.includes("Telat")) {
                data.cell.styles.textColor = [225, 29, 72];
                data.cell.styles.fontStyle = "bold";
              }
            }
          },
          margin: { left: 14, right: 14 }
        });

        lastTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 180;
      } else {
        // 3B. MODE MULTI-HARI: GROUPING DENGAN HEADER PER HARI
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text(`Periode Laporan: ${periodeLabel}`, 14, 43);
        doc.text(`Total Kehadiran: ${stats.totalKehadiran} data | Guru Tercatat: ${stats.guruCount} orang | Tepat: ${stats.tepatWaktu} | Telat: ${stats.telat}`, 14, 47.5);
        doc.text(`Dicetak: ${formatTanggalIndo(todayStr)} ${formatWaktuWIB(new Date().toISOString())}`, 196, 47.5, { align: "right" });

        // Kelompokkan data per tanggal
        const dateGroups = new Map<string, RekapHarianGuru[]>();
        filteredRekapHarian.forEach(item => {
          if (!dateGroups.has(item.tanggal)) dateGroups.set(item.tanggal, []);
          dateGroups.get(item.tanggal)!.push(item);
        });
        const sortedDates = Array.from(dateGroups.keys()).sort((a, b) => b.localeCompare(a));

        let currentY = 52;

        sortedDates.forEach((dateKey) => {
          const groupItems = dateGroups.get(dateKey)!;
          const first = groupItems[0];

          // Cek sisa tinggi halaman, jika mepet buat halaman baru
          if (currentY + 35 > doc.internal.pageSize.height) {
            doc.addPage();
            currentY = 20;
          }

          // Header Per Hari bar untuk tiap tanggal
          doc.setFillColor(241, 245, 249);
          doc.roundedRect(14, currentY, 182, 7.5, 1.5, 1.5, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(30, 58, 138);
          doc.text(`HARI / TANGGAL : ${first.hari.toUpperCase()}, ${first.tanggalFormatted.toUpperCase()} (Jadwal: ${first.jadwalMasuk} - ${first.jadwalPulang} WIB)`, 18, currentY + 5.2);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          doc.text(`${groupItems.length} Guru`, 192, currentY + 5.2, { align: "right" });

          const tableHead = [["No", "Nama Guru", "Jam Masuk", "Jam Pulang", "Status Kehadiran", "Keterangan"]];
          const tableBody = groupItems.map((item, idx) => {
            const pulangText = item.jamPulang ? item.jamPulang : (item.tanggal === todayStr ? "Belum Pulang" : "Tidak Absen Pulang");
            let statusText: string = item.status;
            let ketText = "Hadir Tepat Waktu";
            if (item.status === "Telat") {
              statusText = `Telat (${item.terlambatMenit} mnt)`;
              ketText = `Terlambat ${item.terlambatMenit} mnt`;
            }
            return [
              idx + 1,
              item.nama_guru,
              item.jamMasuk || "-",
              pulangText,
              statusText,
              ketText
            ];
          });

          autoTable(doc, {
            startY: currentY + 9,
            head: tableHead,
            body: tableBody,
            theme: "striped",
            headStyles: {
              fillColor: [51, 65, 85], // slate-700
              textColor: [255, 255, 255],
              fontSize: 8,
              fontStyle: "bold",
              halign: "center"
            },
            styles: {
              fontSize: 7.5,
              cellPadding: 2,
              valign: "middle"
            },
            columnStyles: {
              0: { halign: "center", cellWidth: 10 },
              1: { cellWidth: 58 },
              2: { halign: "center", cellWidth: 28 },
              3: { halign: "center", cellWidth: 28 },
              4: { halign: "center", cellWidth: 28 },
              5: { cellWidth: 30 }
            },
            didParseCell: (data) => {
              if (data.section === "body" && data.column.index === 4) {
                const rawText = String(data.cell.raw);
                if (rawText.includes("Tepat Waktu")) {
                  data.cell.styles.textColor = [16, 149, 106];
                  data.cell.styles.fontStyle = "bold";
                } else if (rawText.includes("Telat")) {
                  data.cell.styles.textColor = [225, 29, 72];
                  data.cell.styles.fontStyle = "bold";
                }
              }
            },
            margin: { left: 14, right: 14 }
          });

          currentY = (doc as any).lastAutoTable.finalY + 7;
        });

        lastTableY = currentY;
      }

      // 4. BAGIAN TANDA TANGAN DI AKHIR HALAMAN
      const finalY = lastTableY + 12;
      const pageHeight = doc.internal.pageSize.height;

      // Jika ruang tidak cukup untuk tanda tangan, tambahkan halaman baru
      if (finalY + 35 > pageHeight) {
        doc.addPage();
      }

      const signY = finalY + 35 > pageHeight ? 25 : finalY;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);

      // Kiri: Petugas Presensi
      doc.text("Petugas Presensi / Admin,", 25, signY);
      doc.text("( .................................................... )", 25, signY + 22);

      // Kanan: Mengetahui Kepala Sekolah
      doc.text("Mengetahui,", 145, signY);
      doc.text("Kepala SMP Al Muttaqin", 145, signY + 4.5);
      doc.text("( .................................................... )", 145, signY + 22);

      const cleanLabel = periodeLabel.replace(/[/\\?%*:|"<>]/g, "_");
      const filename = `Rekap_Presensi_Guru_${cleanLabel}.pdf`;
      doc.save(filename);

      MySwal.fire({
        icon: "success",
        title: "PDF Berhasil Diunduh!",
        html: `File dokumen <b>${filename}</b> resmi SMP AL MUTTAQIN siap dicetak.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error("Gagal export PDF:", err);
      MySwal.fire({
        icon: "error",
        title: "Gagal Mengunduh PDF",
        text: err?.message || "Terjadi kendala saat menyusun file PDF.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="rekap_absensi_guru_panel">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          category="SMP AL MUTTAQIN • YAYASAN MUTTAQIN KOTA MADIUN"
          title="Rekapitulasi Presensi Guru"
          description="Rekap data kehadiran guru harian mencakup jam masuk, jam pulang, serta status tepat waktu / telat secara otomatis."
        />

        {/* Action Buttons: Sinkronisasi, Download Excel & PDF */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Database Live Status Indicator */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
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
                ? `Database Aktif ${dbPingTime ? `(${dbPingTime}ms)` : ""}`
                : dbStatus === "checking"
                ? "Memeriksa..."
                : "Offline"}
            </span>
          </div>

          {/* TOMBOL CIRCULAR REFRESH */}
          <button
            type="button"
            onClick={() => fetchAbsensiGuru(true)}
            disabled={isRefreshing}
            className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 hover:border-blue-200 transition-all flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            title="Refresh Data Tabel"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>

          {/* TOMBOL UNDUH EXCEL */}
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExportingExcel || isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            title="Download rekapan presensi format Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingExcel ? "Menyiapkan Excel..." : "Unduh Excel"}</span>
          </button>

          {/* TOMBOL UNDUH PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPdf || isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            title="Download dokumen laporan resmi format PDF"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPdf ? "Menyiapkan PDF..." : "Unduh PDF"}</span>
          </button>
        </div>
      </div>

      {/* 2. STATISTIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Kehadiran */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Kehadiran</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.totalKehadiran}
            </span>
            <span className="text-xs font-semibold text-slate-400">rekaman</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Periode: {periodeLabel}
          </p>
        </div>

        {/* Guru Terekam */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Guru Terekam</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.guruCount}
            </span>
            <span className="text-xs font-semibold text-slate-400">orang guru</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Presensi pulang tercatat: {stats.pulangTercatat}
          </p>
        </div>

        {/* Tepat Waktu */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tepat Waktu</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.tepatWaktu}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
              {stats.persenTepat}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Masuk sebelum jam batas
          </p>
        </div>

        {/* Telat */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Telat / Terlambat</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.telat}
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
              {stats.persenTelat}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Masuk setelah toleransi
          </p>
        </div>
      </div>

      {/* 3. FILTER BAR: PER HARI, PER MINGGU, PER BULAN */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Baris Atas: Tabs Mode Tampilan + Segmented Filter Periode */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* TAB TAMPILAN */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setViewMode("rekap_harian"); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "rekap_harian"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Rekap Presensi Guru ({filteredRekapHarian.length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setViewMode("rekap_guru"); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "rekap_guru"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Akumulasi per Guru ({rekapPerGuru.length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setViewMode("log_detail"); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "log_detail"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Log Scan Detail ({filteredRawRecords.length})</span>
            </button>
          </div>

          {/* FILTER PERIODE (PER HARI / PER MINGGU / PER BULAN) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Pilih Periode:</span>
            </span>

            {[
              { id: "hari", label: "Per Hari" },
              { id: "minggu", label: "Per Minggu" },
              { id: "bulan", label: "Per Bulan" },
              { id: "semua", label: "Semua" },
              { id: "kustom", label: "Kustom" }
            ].map((p) => {
              const isActive = filterMode === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setFilterMode(p.id as any);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Baris Tengah: Controller Khusus Sesuai Mode Periode */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* 1. Mode PER HARI */}
          {filterMode === "hari" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleNavigateDate(-1)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Hari Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Kemarin</span>
              </button>

              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-900 dark:text-white">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer font-semibold"
                />
              </div>

              <button
                type="button"
                onClick={() => handleNavigateDate(1)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Hari Berikutnya"
              >
                <span className="hidden sm:inline">Besok</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedDay(todayStr)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  selectedDay === todayStr
                    ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                Hari Ini
              </button>
            </div>
          )}

          {/* 2. Mode PER MINGGU */}
          {filterMode === "minggu" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleNavigateDate(-1)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Minggu Lalu"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Minggu Lalu</span>
              </button>

              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                <span>{periodeLabel}</span>
              </div>

              <button
                type="button"
                onClick={() => handleNavigateDate(1)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Minggu Depan"
              >
                <span>Minggu Depan</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedWeekDate(todayStr)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Minggu Ini
              </button>
            </div>
          )}

          {/* 3. Mode PER BULAN */}
          {filterMode === "bulan" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleNavigateDate(-1)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Bulan Lalu"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Bulan Lalu</span>
              </button>

              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  {BULAN_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleNavigateDate(1)}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Bulan Depan"
              >
                <span>Bulan Depan</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMonth(today.getMonth());
                  setSelectedYear(today.getFullYear());
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  selectedMonth === today.getMonth() && selectedYear === today.getFullYear()
                    ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                Bulan Ini
              </button>
            </div>
          )}

          {/* 4. Mode KUSTOM */}
          {filterMode === "kustom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white outline-none"
              />
              <span className="font-semibold text-slate-600 dark:text-slate-400">Sampai:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white outline-none"
              />
            </div>
          )}

          {/* Informasi Periode Aktif */}
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>Menampilkan data:</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">{periodeLabel}</span>
          </div>
        </div>

        {/* Baris Bawah: Pencarian, Filter Guru, Filter Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Pencarian Nama Guru */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama guru atau username..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Dropdown Filter Guru */}
          <div>
            <select
              value={filterGuru}
              onChange={(e) => { setFilterGuru(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Guru ({daftarGuruList.length})</option>
              {daftarGuruList.map(g => (
                <option key={g.username} value={g.username}>
                  {g.nama_guru}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Filter Status (Tepat Waktu / Telat) */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status Presensi</option>
              <option value="TEPAT">✓ Hanya Tepat Waktu</option>
              <option value="TELAT">⏰ Hanya Telat / Terlambat</option>
            </select>
          </div>

          {/* Tombol Reset Filter */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterMode("bulan");
                setSelectedMonth(today.getMonth());
                setSelectedYear(today.getFullYear());
                setSearchQuery("");
                setFilterGuru("ALL");
                setFilterStatus("ALL");
                setCurrentPage(1);
              }}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer text-center"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT DISPLAY: SESUAI VIEW MODE */}
      {viewMode === "rekap_harian" ? (
        /* =================================================================== */
        /* TABEL REKAP PRESENSI GURU (NAMA, TANGGAL, JAM MASUK, JAM PULANG, STATUS) */
        /* =================================================================== */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
              <p className="text-sm font-semibold">Memuat Data Rekap Presensi Guru...</p>
              <p className="text-xs text-slate-400 mt-1">Mengagregasikan data masuk, pulang, dan status keterlambatan</p>
            </div>
          ) : filteredRekapHarian.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Tidak Ada Data Presensi
              </h4>
              <p className="text-xs max-w-sm mx-auto text-slate-400">
                Tidak ditemukan rekaman presensi guru untuk periode <b>{periodeLabel}</b> dengan filter yang dipilih.
              </p>
            </div>
          ) : (
            <div>
              {/* HEADER PER HARI BANNER KHUSUS MODE HARIAN */}
              {filterMode === "hari" && (
                <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-slate-50 dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-900 px-5 py-3.5 border-b border-blue-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
                          Header Presensi Harian
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          SMP Al Muttaqin • Yayasan Muttaqin Kota Madiun
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white capitalize mt-0.5">
                        {formatTanggalIndo(selectedDay)}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs">
                      {stats.tepatWaktu} Tepat Waktu
                    </span>
                    {stats.telat > 0 && (
                      <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold shadow-2xs">
                        {stats.telat} Telat
                      </span>
                    )}
                    <span className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold shadow-2xs">
                      {filteredRekapHarian.length} Total Guru
                    </span>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">No</th>
                      <th className="py-3.5 px-4">Nama Guru</th>
                      <th className="py-3.5 px-4">Tanggal</th>
                      <th className="py-3.5 px-4 text-center">Jam Masuk</th>
                      <th className="py-3.5 px-4 text-center">Jam Pulang</th>
                      <th className="py-3.5 px-4 text-center">Status Kehadiran</th>
                      <th className="py-3.5 px-4 text-center w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedRekap.map((item, index) => {
                      const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                      const isTepat = item.status === "Tepat Waktu";
                      const isTelat = item.status === "Telat";
                      const showDaySeparator = filterMode !== "hari" && (index === 0 || item.tanggal !== paginatedRekap[index - 1].tanggal);

                      return (
                        <React.Fragment key={item.id}>
                          {showDaySeparator && (
                            <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-y border-slate-200 dark:border-slate-700">
                              <td colSpan={7} className="py-2.5 px-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 text-xs">
                                    <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span>{item.tanggalFormatted}</span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 shadow-2xs">
                                    Hari {item.hari}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr 
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            {/* 1. NO */}
                            <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                              {rowNumber}
                            </td>

                            {/* 2. NAMA GURU */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs shrink-0">
                                  {item.nama_guru.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white text-xs">
                                    {item.nama_guru}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 3. TANGGAL */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {item.tanggalFormatted}
                              </div>
                            </td>

                            {/* 4. JAM MASUK */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {item.jamMasuk ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>{item.jamMasuk}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs italic">-</span>
                              )}
                            </td>

                            {/* 5. JAM PULANG */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {item.jamPulang ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                                  <span>{item.jamPulang}</span>
                                </span>
                              ) : item.tanggal === todayStr ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800" title="KBM sedang berlangsung, menunggu jadwal presensi pulang (Target 14:00 WIB)">
                                  <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                                  <span>Belum Pulang</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700" title="Tidak ada scan presensi pulang di database pada tanggal ini">
                                  Tidak Absen Pulang
                                </span>
                              )}
                            </td>

                            {/* 6. STATUS (TEPAT WAKTU / TELAT) */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {isTepat ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Tepat Waktu</span>
                                </span>
                              ) : isTelat ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title={`Terlambat ${item.terlambatMenit} menit`}>
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  <span>Telat {item.terlambatMenit > 0 ? `(${item.terlambatMenit}m)` : ""}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Belum Masuk
                                </span>
                              )}
                            </td>

                            {/* 7. AKSI DETAIL */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedRekap(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Lihat rincian log GPS dan jam"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Footer */}
          {!isLoading && filteredRekapHarian.length > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span>Menampilkan</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>dari <strong>{filteredRekapHarian.length}</strong> total baris rekapitulasi</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Halaman Sebelumnya"
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
                  title="Halaman Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : viewMode === "rekap_guru" ? (
        /* =================================================================== */
        /* TAB 2: AKUMULASI KEHADIRAN PER GURU (CARD SUMMARY)                 */
        /* =================================================================== */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rekapPerGuru.map((item, idx) => {
              const persenTepat = item.totalHari > 0 ? Math.round((item.tepatWaktu / item.totalHari) * 100) : 0;
              return (
                <div 
                  key={item.username || idx}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4 hover:border-blue-300 dark:hover:border-blue-800 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-sm shrink-0">
                          {item.nama_guru.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {item.nama_guru}
                          </h4>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                        {item.totalHari} Kehadiran
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                        <span className="text-[10.5px] text-emerald-800 dark:text-emerald-300 block font-semibold">
                          Tepat Waktu
                        </span>
                        <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                          {item.tepatWaktu} <span className="text-xs font-normal text-slate-500">kali</span>
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                        <span className="text-[10.5px] text-amber-800 dark:text-amber-300 block font-semibold">
                          Telat / Terlambat
                        </span>
                        <span className="text-base font-black text-amber-700 dark:text-amber-400">
                          {item.telat} <span className="text-xs font-normal text-slate-500">kali</span>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Ketepatan Waktu</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{persenTepat}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${persenTepat}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">Terakhir: {item.terakhirMasuk || "-"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterGuru(item.username);
                        setViewMode("rekap_harian");
                        setCurrentPage(1);
                      }}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer shrink-0 ml-2"
                    >
                      <span>Lihat Rekap</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* TAB 3: LOG SCAN DETAIL (AUDIT RAW GPS & WAKTU SCAN)               */
        /* =================================================================== */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Waktu Scan</th>
                  <th className="py-3 px-4">Nama Guru</th>
                  <th className="py-3 px-4">Status Lokasi</th>
                  <th className="py-3 px-4">Koordinat GPS</th>
                  <th className="py-3 px-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredRawRecords.slice(0, 50).map((rec, index) => {
                  const isWithin = (rec.status_lokasi || "").toLowerCase().includes("dalam");
                  return (
                    <tr key={rec.id || index} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-center text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{formatWaktuWIB(rec.waktu_absen)}</div>
                        <div className="text-[11px] text-slate-400">{formatTanggalIndo(rec.waktu_absen)}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{rec.nama_guru}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${isWithin ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                          {rec.status_lokasi || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {rec.latitude && rec.longitude ? `${rec.latitude.toFixed(5)}, ${rec.longitude.toFixed(5)}` : "-"}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {rec.keterangan || "Masuk"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETAIL REKAP HARIAN GURU */}
      {selectedRekap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Detail Presensi: {selectedRekap.nama_guru}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedRekap.tanggalFormatted}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRekap(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* Ringkasan Status */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Status Kehadiran</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                    selectedRekap.status === "Tepat Waktu"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {selectedRekap.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Jam Masuk Tercatat</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedRekap.jamMasuk || "Belum Absen Masuk"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Jam Pulang Tercatat</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {selectedRekap.jamPulang || "Belum Absen Pulang"}
                  </span>
                </div>
                {selectedRekap.status === "Telat" && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400">
                    <span className="font-medium">Keterlambatan</span>
                    <span className="font-bold">+{selectedRekap.terlambatMenit} Menit</span>
                  </div>
                )}
              </div>

              {/* Rincian Log Scan Mentah */}
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Riwayat Log Scan pada Hari Ini ({selectedRekap.logs.length})
                </h4>
                <div className="space-y-2">
                  {selectedRekap.logs.map((log, idx) => (
                    <div key={log.id || idx} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatWaktuWIB(log.waktu_absen)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {log.keterangan || "Presensi"} • {log.status_lokasi || "Lokasi Valid"}
                        </div>
                      </div>
                      {log.latitude && log.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold text-[11px] flex items-center gap-1 hover:underline"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Peta</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRekap(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl"
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
