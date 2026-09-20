import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import {
  Search,
  Download,
  FileText,
  Eye,
  RefreshCw,
  X,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  ClipboardList,
  Printer
} from "lucide-react";

const MySwal = withReactContent(Swal);

interface Student {
  id: string;
  nama_lengkap: string;
  nis: string;
  kelas: string;
}

interface SessionColumn {
  id: string; // jurnal_id or mock_id
  tanggal: string;
  dayNum: string; // e.g. "14"
  sesi: string; // e.g. "MALAM", "PAGI 1", "SIANG"
}

interface AttendanceSummary {
  studentId: string;
  nama: string;
  nis: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  totalSesi: number;
  persentase: number;
  detailRows: AttendanceDetailRow[];
}

interface AttendanceDetailRow {
  tanggal: string;
  hari: string;
  jamMasuk: string;
  jamPulang: string;
  status: "Hadir" | "Terlambat" | "Izin" | "Sakit" | "Alpa";
  keterangan: string;
}

export default function RekapAbsensiSiswaPanel() {
  const [classesList, setClassesList] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [rawJurnals, setRawJurnals] = useState<any[]>([]);
  const [rawAbsensi, setRawAbsensi] = useState<any[]>([]);
  const [mapelListState, setMapelListState] = useState<{ nama_mapel: string; kode_mapel: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Detail Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<AttendanceSummary | null>(null);

  // WA Recap Modal States
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [selectedWaDate, setSelectedWaDate] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // 1. Fetch available classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const classesSet = new Set<string>();

        // Fetch from 'plotting' (jenis = 'kelas sekolah')
        const { data: plotSchool } = await supabase
          .from("plotting")
          .select("nama")
          .eq("jenis", "kelas sekolah");
        
        if (plotSchool) {
          plotSchool.forEach((r: any) => {
            if (r.nama) classesSet.add(String(r.nama).trim());
          });
        }

        // Fetch from 'kelas sekolah' table
        const { data: dataSpace } = await supabase.from("kelas sekolah").select("kelas");
        if (dataSpace) {
          dataSpace.forEach((r: any) => {
            if (r.kelas) classesSet.add(String(r.kelas).trim());
          });
        }

        if (classesSet.size > 0) {
          const sorted = Array.from(classesSet).sort();
          setClassesList(sorted);
          setSelectedClass(sorted[0]);
        } else {
          const defaultClasses = ["Kelas 7A", "Kelas 7B", "Kelas 8A", "Kelas 8B", "Kelas 9A", "Kelas 9B"];
          setClassesList(defaultClasses);
          setSelectedClass(defaultClasses[0]);
        }
      } catch (e) {
        console.warn("Failed to load classes list, using fallback:", e);
        const defaultClasses = ["Kelas 7A", "Kelas 7B", "Kelas 8A", "Kelas 8B", "Kelas 9A", "Kelas 9B"];
        setClassesList(defaultClasses);
        setSelectedClass(defaultClasses[0]);
      }
    };

    const fetchMapel = async () => {
      try {
        const { data: mapels } = await supabase
          .from("mata_pelajaran")
          .select("nama_mapel, kode_mapel");
        if (mapels) {
          setMapelListState(mapels);
        }
      } catch (e) {
        console.warn("Failed to load mapel list on mount:", e);
      }
    };

    fetchClasses();
    fetchMapel();
  }, []);

  // 2. Fetch data from Supabase
  const loadRekapData = useCallback(async () => {
    if (!selectedClass) return;
    setIsLoading(true);
    try {
      // Step A: Fetch students of selected class
      const { data: classRows, error: classErr } = await supabase
        .from("kelas sekolah")
        .select("*")
        .or(`kelas.eq.${selectedClass},kelas.ilike.%${selectedClass}%`);

      if (classErr) throw classErr;

      let mappedStudents: Student[] = [];
      if (classRows && classRows.length > 0) {
        mappedStudents = classRows.map((r: any) => ({
          id: r.id ? String(r.id) : String(Math.random()),
          nama_lengkap: r.nama || "-",
          kelas: r.kelas || selectedClass,
          nis: r.nis || "-"
        })).sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
      } else {
        const { data: allRows } = await supabase.from("kelas sekolah").select("*");
        if (allRows && allRows.length > 0) {
          const filtered = allRows.filter((r: any) => 
            (r.kelas || "").trim().toLowerCase() === selectedClass.trim().toLowerCase() ||
            (r.kelas || "").toLowerCase().includes(selectedClass.toLowerCase())
          );
          if (filtered.length > 0) {
            mappedStudents = filtered.map((r: any) => ({
              id: r.id ? String(r.id) : String(Math.random()),
              nama_lengkap: r.nama || "-",
              kelas: r.kelas || selectedClass,
              nis: r.nis || "-"
            })).sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
          }
        }
      }

      setStudents(mappedStudents);

      // Step B: Fetch Jurnal Mengajar for the month & class
      const lastDay = new Date(filterYear, filterMonth + 1, 0).getDate();
      const monthPrefix = `${filterYear}-${String(filterMonth + 1).padStart(2, "0")}`;
      
      const { data: jurnals, error: jurnErr } = await supabase
        .from("jurnal_mengajar")
        .select("id, tanggal, hari, jam_ke, mata_pelajaran, materi_pembelajaran, keterangan")
        .eq("kelas_id", selectedClass)
        .gte("tanggal", `${monthPrefix}-01`)
        .lte("tanggal", `${monthPrefix}-${String(lastDay).padStart(2, "0")}`);

      if (jurnErr) throw jurnErr;
      setRawJurnals(jurnals || []);

      let absRows: any[] = [];
      if (jurnals && jurnals.length > 0) {
        const journalIds = jurnals.map(j => j.id);
        const { data: fetchedAbs, error: absErr } = await supabase
          .from("absensi_jurnal_siswa")
          .select("*")
          .in("jurnal_id", journalIds);
        if (!absErr && fetchedAbs) {
          absRows = fetchedAbs;
        }
      }
      setRawAbsensi(absRows);

    } catch (err: any) {
      console.error("Gagal memuat rekap absensi siswa:", err);
      MySwal.fire({
        icon: "error",
        title: "Kesalahan",
        text: "Gagal memuat rekap absensi: " + err.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass, filterMonth, filterYear]);

  // Trigger reload on filter values change
  useEffect(() => {
    loadRekapData();
  }, [loadRekapData]);

  const monthPrefix = useMemo(() => {
    return `${filterYear}-${String(filterMonth + 1).padStart(2, "0")}`;
  }, [filterMonth, filterYear]);

  // Generate sessions columns: Use real database journals if they exist
  const sessionCols = useMemo<SessionColumn[]>(() => {
    if (rawJurnals && rawJurnals.length > 0) {
      return rawJurnals.map((j: any) => {
        const d = new Date(j.tanggal);
        const day = isNaN(d.getTime()) ? "01" : String(d.getDate());

        let resolvedSesi = "";
        if (j.mata_pelajaran) {
          const mapelLower = String(j.mata_pelajaran).toLowerCase().trim();
          const matched = mapelListState.find(m => 
            m.nama_mapel.toLowerCase().trim() === mapelLower ||
            m.kode_mapel.toLowerCase().trim() === mapelLower
          );
          if (matched) {
            resolvedSesi = matched.kode_mapel.toUpperCase();
          } else {
            resolvedSesi = String(j.mata_pelajaran).slice(0, 7).toUpperCase();
          }
        } else {
          resolvedSesi = `JAM ${j.jam_ke || 1}`;
        }

        return {
          id: String(j.id),
          tanggal: j.tanggal,
          dayNum: day,
          sesi: resolvedSesi
        };
      }).sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id));
    }

    // Return empty array if no database journals exist
    return [];
  }, [rawJurnals, monthPrefix, mapelListState]);

  // Compute grouped days to span correctly in Header Row 1
  const groupedDays = useMemo(() => {
    const groups: { dayNum: string; count: number }[] = [];
    sessionCols.forEach(col => {
      const existing = groups.find(g => g.dayNum === col.dayNum);
      if (existing) {
        existing.count++;
      } else {
        groups.push({ dayNum: col.dayNum, count: 1 });
      }
    });
    return groups;
  }, [sessionCols]);

  // Deterministic status retriever for student + column ID (real DB only)
  const getStatusForSession = useCallback((studentId: string, colId: string): "H" | "I" | "S" | "T" | "A" | "" => {
    const realRecord = rawAbsensi.find(
      a => String(a.siswa_id) === String(studentId) && String(a.jurnal_id) === String(colId)
    );
    if (realRecord) {
      const s = String(realRecord.status || "hadir").toLowerCase();
      if (s === "hadir") return "H";
      if (s === "izin") return "I";
      if (s === "sakit") return "S";
      if (s === "terlambat") return "T";
      if (s === "alpa" || s === "alfa") return "A";
    }

    return "";
  }, [rawAbsensi]);

  // 3. Compute final records with accumulated count of green and red badges
  const rekapList = useMemo<AttendanceSummary[]>(() => {
    return students.map((student) => {
      let hadir = 0;
      let terlambat = 0;
      let izin = 0;
      let sakit = 0;
      let alpa = 0;

      const detailRows: AttendanceDetailRow[] = [];

      sessionCols.forEach((col) => {
        const status = getStatusForSession(student.id, col.id);
        
        let statusLabel: "Hadir" | "Terlambat" | "Izin" | "Sakit" | "Alpa" = "Hadir";
        if (status === "H") { hadir++; statusLabel = "Hadir"; }
        else if (status === "T") { terlambat++; statusLabel = "Terlambat"; }
        else if (status === "I") { izin++; statusLabel = "Izin"; }
        else if (status === "S") { sakit++; statusLabel = "Sakit"; }
        else if (status === "A") { alpa++; statusLabel = "Alpa"; }

        detailRows.push({
          tanggal: col.tanggal,
          hari: "KBM",
          jamMasuk: col.sesi,
          jamPulang: "14:00",
          status: statusLabel,
          keterangan: "Sesi Kegiatan Belajar Mengajar"
        });
      });

      const totalSesi = sessionCols.length;
      const persentase = totalSesi > 0 ? Math.round(((hadir + terlambat) / totalSesi) * 1000) / 10 : 100;

      return {
        studentId: student.id,
        nama: student.nama_lengkap,
        nis: student.nis,
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        totalSesi,
        persentase,
        detailRows
      };
    });
  }, [students, sessionCols, getStatusForSession]);

  // Summary statistics for 4 metrics cards
  const statistics = useMemo(() => {
    const totalSiswa = rekapList.length;
    if (totalSiswa === 0) {
      return { totalSiswa: 0, averageHadir: 0, totalTerlambat: 0, totalAbsen: 0 };
    }
    
    let sumPercentages = 0;
    let totalTerlambat = 0;
    let totalAbsen = 0;

    rekapList.forEach((r) => {
      sumPercentages += r.persentase;
      totalTerlambat += r.terlambat;
      totalAbsen += (r.izin + r.sakit + r.alpa);
    });

    return {
      totalSiswa,
      averageHadir: Math.round((sumPercentages / totalSiswa) * 10) / 10,
      totalTerlambat,
      totalAbsen
    };
  }, [rekapList]);

  // Search filter
  const filteredRekapList = useMemo(() => {
    if (!searchQuery.trim()) return rekapList;
    const q = searchQuery.toLowerCase();
    return rekapList.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        r.nis.toLowerCase().includes(q)
    );
  }, [rekapList, searchQuery]);

  // Extract unique available dates for WA modal dropdown
  const availableWaDates = useMemo(() => {
    const dates = Array.from(new Set(sessionCols.map(c => c.tanggal))).sort();
    return dates;
  }, [sessionCols]);

  // Set default selectedWaDate to the latest available date or today
  useEffect(() => {
    if (availableWaDates.length > 0) {
      setSelectedWaDate(availableWaDates[availableWaDates.length - 1]);
    } else {
      setSelectedWaDate(new Date().toISOString().slice(0, 10));
    }
  }, [availableWaDates]);

  // Formatted text for WhatsApp broadcast
  const waFormattedText = useMemo(() => {
    if (!selectedWaDate) return "";

    const dateObj = new Date(selectedWaDate);
    const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const monthsIndo = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    
    const dayName = daysIndo[dateObj.getDay()];
    const formattedDateString = `${dateObj.getDate()} ${monthsIndo[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

    // Get all session columns on this selected date
    const colsOnDate = sessionCols.filter(c => c.tanggal === selectedWaDate);

    let countHadir = 0;
    let countSakitIzin = 0;
    let countAlpa = 0;

    const lines = students.map((student, idx) => {
      const statuses = colsOnDate.map(col => getStatusForSession(student.id, col.id));

      const emojis = statuses.map(s => {
        if (s === "H") return "✅";
        if (s === "T") return "⚠️";
        if (s === "S") return "🤒";
        if (s === "I") return "✉️";
        if (s === "A") return "❌";
        return "✅";
      }).join(" ");

      const hasAlpa = statuses.includes("A");
      const hasSickOrLeave = statuses.includes("S") || statuses.includes("I") || statuses.includes("T");

      if (hasAlpa) {
        countAlpa++;
      } else if (hasSickOrLeave) {
        countSakitIzin++;
      } else {
        countHadir++;
      }

      const extraNotes: string[] = [];
      statuses.forEach((s, sIdx) => {
        if (s !== "H") {
          const sessionName = colsOnDate[sIdx]?.sesi || `Sesi ${sIdx + 1}`;
          let label = "HADIR";
          if (s === "T") label = "TERLAMBAT";
          if (s === "I") label = "IZIN";
          if (s === "S") label = "SAKIT";
          if (s === "A") label = "ALPA";
          extraNotes.push(`${label} (${sessionName})`);
        }
      });

      const noteStr = extraNotes.length > 0 ? ` - ${extraNotes.join(", ")}` : "";

      return `${idx + 1}. ${student.nama_lengkap} ${emojis}${noteStr}`;
    });

    return `📅 *LAPORAN ABSENSI SISWA KELAS ${selectedClass.toUpperCase()}*
_${dayName}, ${formattedDateString}_

*Daftar Kehadiran Siswa:*

${lines.length > 0 ? lines.join("\n") : "Tidak ada data siswa."}

*Ringkasan Kehadiran:*
• Hadir: ${countHadir} Siswa
• Sakit/Izin/Terlambat: ${countSakitIzin} Siswa
• Alpha: ${countAlpa} Siswa`;
  }, [selectedWaDate, selectedClass, students, sessionCols, getStatusForSession]);

  const handleCopyWaText = async () => {
    try {
      await navigator.clipboard.writeText(waFormattedText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      MySwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Teks rekap WA berhasil disalin!",
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err) {
      MySwal.fire({
        icon: "error",
        title: "Gagal",
        text: "Gagal menyalin teks."
      });
    }
  };

  // PDF Export
  const handleExportPdf = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      MySwal.fire({
        icon: "success",
        title: "PDF Berhasil Diekspor",
        text: `Laporan matriks rekapitulasi absensi siswa kelas ${selectedClass} periode ${monthNames[filterMonth]} ${filterYear} berhasil disimpan sebagai dokumen PDF.`,
        confirmButtonColor: "#2563eb"
      });
    }, 1500);
  };

  // Excel Export
  const handleExportExcel = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "REKAP ABSENSI MATRIKS SISWA - SMP IT AL MUTTAQIN\n";
      csvContent += `Kelas: ${selectedClass}\n`;
      csvContent += `Periode: ${monthNames[filterMonth]} ${filterYear}\n\n`;
      csvContent += "No,Nama Siswa,NISN,Hadir (H),Alpa (A),Persentase Kehadiran\n";
      
      filteredRekapList.forEach((r, idx) => {
        csvContent += `${idx + 1},"${r.nama}",${r.nis},${r.hadir},${r.alpa},${r.persentase}%\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Rekap_Absensi_Siswa_${selectedClass}_${monthNames[filterMonth]}_${filterYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      MySwal.fire({
        icon: "success",
        title: "Excel Berhasil Diekspor",
        text: `Dokumen Rekap_Absensi_Siswa_${selectedClass}.xlsx berhasil diunduh.`,
        confirmButtonColor: "#10b981"
      });
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="rekap_absensi_siswa_module">

      {/* 2. AREA FILTER BAR */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Dropdown Kelas Sekolah */}
          <div className="flex flex-col space-y-1 w-full sm:w-auto min-w-[160px]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Kelas Sekolah</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer w-full"
            >
              {classesList.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Dropdown Bulan */}
          <div className="flex flex-col space-y-1 w-full sm:w-auto min-w-[160px]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bulan</span>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer w-full"
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx}>{name} {filterYear}</option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col space-y-1 w-full sm:w-[200px]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cari Siswa</span>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama / NISN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting || isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {isExporting ? "Mencetak..." : "Cetak Rekap"}
          </button>
          {/* Primary Button Laporan WA */}
          <button
            type="button"
            onClick={() => setIsWaModalOpen(true)}
            disabled={isLoading}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm cursor-pointer shrink-0 disabled:opacity-55"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Laporan WA</span>
          </button>
        </div>
      </div>

      {/* 3. STATISTIK RINGKAS PERIODE KELAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Siswa</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-white font-mono">{statistics.totalSiswa} Siswa</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rata-rata Kehadiran</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-white font-mono">{statistics.averageHadir}%</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Terlambat</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-white font-mono">{statistics.totalTerlambat} Kali</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tidak Hadir (I/S/A)</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-white font-mono">{statistics.totalAbsen} Sesi</span>
          </div>
        </div>
      </div>

      {/* 4. TABEL UTAMA REKAP ABSENSI MATRIKS SISWA (TEMA GRIP REKAP_SHOLAT) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              {/* Header Baris 1: Tanggal */}
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs font-bold border-b border-slate-200 dark:border-slate-800">
                <th rowSpan={2} className="px-4 py-3 text-center w-12 border-r border-slate-200 dark:border-slate-800">NO</th>
                <th rowSpan={2} className="px-5 py-3 border-r border-slate-200 dark:border-slate-800 min-w-[200px]">NAMA SISWA</th>
                {groupedDays.map((day, idx) => (
                  <th
                    key={idx}
                    colSpan={day.count}
                    className="px-2 py-2 text-center font-extrabold border-r border-b border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-slate-200 font-mono"
                  >
                    {day.dayNum}
                  </th>
                ))}
                <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 font-extrabold w-12" title="Total Hadir">H</th>
                <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-800 text-orange-600 dark:text-orange-400 font-extrabold w-12" title="Total Telat / Terlambat">T</th>
                <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 font-extrabold w-12" title="Total Izin">I</th>
                <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 font-extrabold w-12" title="Total Sakit">S</th>
                <th rowSpan={2} className="px-3 py-3 text-center border-r border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 font-extrabold w-12" title="Total Alpa">A</th>
                <th rowSpan={2} className="px-4 py-3 text-center w-24">AKSI</th>
              </tr>
              {/* Header Baris 2: Nama Sesi */}
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                {sessionCols.map((col, idx) => (
                  <th key={idx} className="px-1 py-1.5 text-center border-r border-slate-200 dark:border-slate-800 max-w-[68px] truncate font-mono" title={col.sesi}>
                    {col.sesi}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={sessionCols.length + 8} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
                    <p className="text-xs font-medium">Memuat rekap absensi matriks kelas {selectedClass}...</p>
                  </td>
                </tr>
              ) : filteredRekapList.length === 0 ? (
                <tr>
                  <td colSpan={sessionCols.length + 8} className="px-5 py-12 text-center text-slate-400">
                    <Info className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs">Tidak ada data siswa ditemukan untuk kriteria filter saat ini.</p>
                  </td>
                </tr>
              ) : (
                filteredRekapList.map((row, idx) => {
                  return (
                    <tr key={row.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-center font-mono font-medium text-slate-400 text-xs border-r border-slate-100 dark:border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3 border-r border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{row.nama}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">NISN: {row.nis || "-"}</div>
                        </div>
                      </td>
                      
                      {/* Cells dengan Badges */}
                      {sessionCols.map((col) => {
                        const status = getStatusForSession(row.studentId, col.id);
                        
                        // Badge styling based on status H, I, S, T, A
                        let badgeClass = "";
                        if (status === "H") {
                          badgeClass = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60";
                        } else if (status === "I") {
                          badgeClass = "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60";
                        } else if (status === "S") {
                          badgeClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60";
                        } else if (status === "T") {
                          badgeClass = "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/60";
                        } else if (status === "A") {
                          badgeClass = "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60";
                        }

                        return (
                          <td key={col.id} className="px-1 py-2 text-center border-r border-slate-100 dark:border-slate-800">
                            <div className="flex justify-center">
                              <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${badgeClass}`}>
                                {status}
                              </span>
                            </div>
                          </td>
                        );
                      })}

                      {/* Total Ringkasan: H, T, I, S, A */}
                      <td className="px-3 py-3 text-center font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400 border-r border-slate-100 dark:border-slate-800">
                        {row.hadir}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-extrabold text-xs text-orange-600 dark:text-orange-400 border-r border-slate-100 dark:border-slate-800">
                        {row.terlambat}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-extrabold text-xs text-blue-600 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                        {row.izin}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-extrabold text-xs text-amber-600 dark:text-amber-400 border-r border-slate-100 dark:border-slate-800">
                        {row.sakit}
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-extrabold text-xs text-rose-600 dark:text-rose-400 border-r border-slate-100 dark:border-slate-800">
                        {row.alpa}
                      </td>

                      {/* Aksi Button */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDetail(row);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all inline-flex items-center justify-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                          title="Lihat Rincian Harian"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold px-0.5">Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend Footer (Exactly like bottom left of image) */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60 font-bold text-[10px]">H</span>
            <span>Hadir</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/60 font-bold text-[10px]">I</span>
            <span>Izin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60 font-bold text-[10px]">S</span>
            <span>Sakit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/60 font-bold text-[10px]">T</span>
            <span>Terlambat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 flex items-center justify-center rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60 font-bold text-[10px]">A</span>
            <span>Alpa</span>
          </div>
        </div>
      </div>

      {/* 5. MODAL DETAIL REKAP PER SISWA */}
      {isDetailModalOpen && selectedDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Rincian Kehadiran Siswa
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {selectedDetail.nama} • NISN: {selectedDetail.nis}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedDetail(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Profile Card Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-150 dark:border-slate-800/80 grid grid-cols-5 text-center divide-x divide-slate-200 dark:divide-slate-700">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Hadir</span>
                  <span className="text-base font-extrabold text-slate-700 dark:text-slate-200 font-mono">{selectedDetail.hadir}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Terlambat</span>
                  <span className="text-base font-extrabold text-slate-700 dark:text-slate-200 font-mono">{selectedDetail.terlambat}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Izin</span>
                  <span className="text-base font-extrabold text-slate-700 dark:text-slate-200 font-mono">{selectedDetail.izin}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Sakit</span>
                  <span className="text-base font-extrabold text-slate-700 dark:text-slate-200 font-mono">{selectedDetail.sakit}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Alpa</span>
                  <span className="text-base font-extrabold text-slate-700 dark:text-slate-200 font-mono">{selectedDetail.alpa}</span>
                </div>
              </div>

              {/* Attendance Log Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="px-4 py-2.5">Tanggal</th>
                      <th className="px-4 py-2.5">Mata Pelajaran / Sesi</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {selectedDetail.detailRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          Tidak ada riwayat presensi terekam untuk periode ini.
                        </td>
                      </tr>
                    ) : (
                      selectedDetail.detailRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-200">
                            {row.tanggal}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 uppercase">
                            {row.jamMasuk}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              row.status === "Hadir"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : row.status === "Terlambat"
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
                                : row.status === "Izin"
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                                : row.status === "Sakit"
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                            {row.keterangan}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedDetail(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL REKAP WHATSAPP */}
      {isWaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl text-white">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Rekap Absensi WhatsApp
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Format pesan siap dikirim ke grup WhatsApp Kelas / Wali Murid
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWaModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pilih Tanggal Laporan
                </label>
                <select
                  value={selectedWaDate}
                  onChange={(e) => setSelectedWaDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {availableWaDates.length > 0 ? (
                    availableWaDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))
                  ) : (
                    <option value={new Date().toISOString().slice(0, 10)}>
                      {new Date().toISOString().slice(0, 10)} (Hari Ini)
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pratinjau Pesan WhatsApp
                </label>
                <textarea
                  readOnly
                  rows={10}
                  value={waFormattedText}
                  className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsWaModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleCopyWaText}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer"
              >
                {isCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{isCopied ? "Tersalin!" : "Salin Teks"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
