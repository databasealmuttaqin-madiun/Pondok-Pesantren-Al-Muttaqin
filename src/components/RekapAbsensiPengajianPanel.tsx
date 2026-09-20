import React, { useState, useEffect, useMemo } from "react";
import { supabase, SantriData } from "../supabaseClient";
import { 
  ClipboardList, 
  Search, 
  Printer, 
  Calendar, 
  MessageCircle, 
  X, 
  Copy, 
  Send, 
  Check, 
  Share2 
} from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

interface Props {
  recitationClasses: string[];
  onTriggerNotification: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export default function RekapAbsensiPengajianPanel({ recitationClasses, onTriggerNotification }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [santriList, setSantriList] = useState<SantriData[]>([]);
  const [jurnals, setJurnals] = useState<any[]>([]);
  const [absensiMap, setAbsensiMap] = useState<Record<string, Record<string, string>>>({}); // [santriId][date] = status
  
  const [isLoading, setIsLoading] = useState(false);
  
  // WhatsApp Modal States
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [selectedWaDate, setSelectedWaDate] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (selectedClass && selectedMonth) {
      loadData();
    } else {
      setJurnals([]);
      setSantriList([]);
      setAbsensiMap({});
    }
  }, [selectedClass, selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Get Santri for this class
      const cached = localStorage.getItem("santri_data");
      let allSantri: SantriData[] = cached ? JSON.parse(cached) : [];
      const classSantri = allSantri.filter(s => (s as any).kelas_pengajian === selectedClass);
      setSantriList(classSantri);

      // 2. Get Jurnals (Dates) for this month
      const year = selectedMonth.split("-")[0];
      const month = selectedMonth.split("-")[1];
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

      const { data: jurnalData, error: jurnalError } = await supabase
        .from("jurnal_pengajian")
        .select("id, tanggal, sesi_id, sesi_mengaji(nama_sesi)")
        .eq("kelas_pengajian", selectedClass)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .order("tanggal", { ascending: true });

      if (jurnalError) throw jurnalError;
      
      const loadedJurnals = jurnalData || [];
      
      // Group by tanggal AND sesi_id
      const uniqueSessions: any[] = [];
      const sessionMap = new Map();
      
      loadedJurnals.forEach(j => {
        const key = `${j.tanggal}_${j.sesi_id || 'none'}`;
        if (!sessionMap.has(key)) {
          sessionMap.set(key, {
            key,
            tanggal: j.tanggal,
            sesi_id: j.sesi_id,
            nama_sesi: (Array.isArray(j.sesi_mengaji) ? (j.sesi_mengaji[0] as any)?.nama_sesi : (j.sesi_mengaji as any)?.nama_sesi) || "-",
            jurnal_ids: []
          });
          uniqueSessions.push(sessionMap.get(key));
        }
        sessionMap.get(key).jurnal_ids.push(j.id);
      });

      // Sort by date then session
      uniqueSessions.sort((a, b) => {
        if (a.tanggal === b.tanggal) {
          return (a.sesi_id || 0) - (b.sesi_id || 0);
        }
        return a.tanggal.localeCompare(b.tanggal);
      });

      setJurnals(uniqueSessions);

      // Set default WA date to the last session date available or today
      if (uniqueSessions.length > 0) {
        setSelectedWaDate(uniqueSessions[uniqueSessions.length - 1].tanggal);
      } else {
        setSelectedWaDate(new Date().toISOString().slice(0, 10));
      }

      // 3. Get Absensi for those jurnals
      const allJurnalIds = loadedJurnals.map(j => j.id);
      if (allJurnalIds.length > 0) {
        const { data: absData, error: absError } = await supabase
          .from("absensi_pengajian")
          .select("santri_id, status, jurnal_id")
          .in("jurnal_id", allJurnalIds);

        if (absError) throw absError;

        // map status by santri and date
        const newAbsMap: Record<string, Record<string, string>> = {};
        
        absData?.forEach(abs => {
          if (!newAbsMap[abs.santri_id]) newAbsMap[abs.santri_id] = {};
          
          const jurnal = loadedJurnals.find(j => j.id === abs.jurnal_id);
          if (jurnal) {
            const key = `${jurnal.tanggal}_${jurnal.sesi_id || 'none'}`;
            if (!newAbsMap[abs.santri_id][key] || abs.status !== 'hadir') {
                newAbsMap[abs.santri_id][key] = abs.status;
            }
          }
        });
        setAbsensiMap(newAbsMap);
      } else {
        setAbsensiMap({});
      }

    } catch (e: any) {
      console.error(e);
      onTriggerNotification(`Gagal memuat rekap absensi: ${e.message}`, "error");
    }
    setIsLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hadir': return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
      case 'izin': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
      case 'sakit': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300';
      case 'terlambat':
      case 'telat': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
      case 'alpa': return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
      default: return 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
    }
  };
  
  const getStatusInitial = (status: string) => {
    if (!status) return '-';
    if (status === 'terlambat' || status === 'telat') return 'T';
    return status.charAt(0).toUpperCase();
  };

  // Extract unique available dates from loaded jurnals for dropdown
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(jurnals.map(j => j.tanggal))).sort();
    return dates;
  }, [jurnals]);

  // Generate formatting text for WhatsApp
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

    // Get all sessions scheduled on this selected date
    const sessionsOnDate = jurnals.filter(j => j.tanggal === selectedWaDate);

    let countHadir = 0;
    let countSakitIzin = 0;
    let countAlpa = 0;

    const lines = santriList.map((santri, idx) => {
      const statuses = sessionsOnDate.map(sesi => {
        return santri.id && absensiMap[String(santri.id)] ? absensiMap[String(santri.id)][sesi.key] || "hadir" : "hadir";
      });

      const emojis = statuses.map(s => {
        if (s === "hadir") return "✅";
        if (s === "terlambat") return "⚠️";
        if (s === "sakit") return "🤒";
        if (s === "izin") return "✉️";
        if (s === "alpa") return "❌";
        return "✅";
      }).join(" ");

      const hasAlpa = statuses.includes("alpa");
      const hasSickOrLeave = statuses.includes("sakit") || statuses.includes("izin") || statuses.includes("terlambat");

      if (hasAlpa) {
        countAlpa++;
      } else if (hasSickOrLeave) {
        countSakitIzin++;
      } else {
        countHadir++;
      }

      // Collect notes for non-hadir statuses
      const extraNotes: string[] = [];
      statuses.forEach((s, sIdx) => {
        if (s !== "hadir") {
          const sessionName = sessionsOnDate[sIdx]?.nama_sesi || `Sesi ${sIdx + 1}`;
          extraNotes.push(`${s.toUpperCase()} (${sessionName})`);
        }
      });

      const noteStr = extraNotes.length > 0 ? ` - ${extraNotes.join(", ")}` : "";

      return `${idx + 1}. ${santri.nama_lengkap} ${emojis}${noteStr}`;
    });

    const result = `📅 *LAPORAN ABSENSI KELAS ${selectedClass.toUpperCase()}*
_${dayName}, ${formattedDateString}_

*Daftar Kehadiran Siswa:*

${lines.length > 0 ? lines.join("\n") : "Tidak ada data siswa."}

*Ringkasan Kehadiran:*
• Hadir: ${countHadir} Siswa
• Sakit/Izin: ${countSakitIzin} Siswa
• Alpha: ${countAlpa} Siswa`;

    return result;
  }, [selectedWaDate, selectedClass, santriList, jurnals, absensiMap]);

  const handleCopyText = async () => {
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
        timer: 2000,
        timerProgressBar: true
      });
    } catch (err) {
      MySwal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "Gagal menyalin teks!",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6" id="rekap_absensi_pengajian_root">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Rekap Absensi Pengajian
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Lihat laporan absensi santri per kelas dan bulan.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" /> Cetak Rekap
        </button>
      </div>

      {/* FILTER BAR SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kelas Pengajian
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 h-10"
          >
            <option value="">-- Pilih Kelas --</option>
            {recitationClasses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Bulan
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 h-10"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => {
              if (!selectedClass) {
                onTriggerNotification("Pilih kelas terlebih dahulu untuk generate laporan WA", "warning");
                return;
              }
              setIsWaModalOpen(true);
            }}
            className="w-full h-10 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-sm"
          >
            <MessageCircle className="w-4 h-4" /> Laporan WA
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-xs font-semibold uppercase">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 w-12 align-middle">No</th>
                  <th rowSpan={2} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 sticky left-12 bg-slate-50 dark:bg-slate-800 z-10 min-w-[200px] align-middle">Nama Santri</th>
                  {(() => {
                    const grouped: {tanggal: string, count: number}[] = [];
                    jurnals.forEach(j => {
                      const existing = grouped.find(g => g.tanggal === j.tanggal);
                      if (existing) {
                        existing.count++;
                      } else {
                        grouped.push({ tanggal: j.tanggal, count: 1 });
                      }
                    });
                    
                    return grouped.map(g => {
                      const dateObj = new Date(g.tanggal);
                      return (
                        <th key={g.tanggal} colSpan={g.count} className="px-2 py-2 border-b border-slate-200 dark:border-slate-800 text-center min-w-[50px] border-l first:border-l-0">
                          <span title={g.tanggal} className="font-semibold">{dateObj.getDate()}</span>
                        </th>
                      );
                    });
                  })()}
                  <th rowSpan={2} className="px-3 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 align-middle font-bold w-10" title="Total Hadir">H</th>
                  <th rowSpan={2} className="px-3 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 align-middle font-bold w-10" title="Total Telat / Terlambat">T</th>
                  <th rowSpan={2} className="px-3 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 align-middle font-bold w-10" title="Total Izin">I</th>
                  <th rowSpan={2} className="px-3 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 align-middle font-bold w-10" title="Total Sakit">S</th>
                  <th rowSpan={2} className="px-3 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 align-middle font-bold w-10" title="Total Alpa">A</th>
                </tr>
                <tr>
                  {jurnals.map((j) => (
                    <th key={j.key} className="px-1 py-1.5 border-b border-slate-200 dark:border-slate-800 text-center border-l first:border-l-0">
                      <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 whitespace-nowrap overflow-hidden max-w-[60px] text-ellipsis inline-block" title={j.nama_sesi}>
                        {j.nama_sesi}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {santriList.length === 0 ? (
                  <tr>
                    <td colSpan={jurnals.length + 7} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada santri yang terdaftar di kelas ini.
                    </td>
                  </tr>
                ) : jurnals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Belum ada entri jurnal/absensi untuk bulan ini.
                    </td>
                  </tr>
                ) : (
                  santriList.map((santri, index) => {
                    let hadirCount = 0;
                    let telatCount = 0;
                    let izinCount = 0;
                    let sakitCount = 0;
                    let alpaCount = 0;
                    
                    return (
                      <tr key={santri.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-100 dark:border-slate-800">{index + 1}</td>
                        <td className="px-4 py-3 sticky left-12 bg-white dark:bg-slate-900 z-10 border-r border-slate-100 dark:border-slate-800 font-medium">
                          {santri.nama_lengkap}
                        </td>
                        
                        {jurnals.map((j) => {
                          const status = santri.id && absensiMap[String(santri.id)] ? absensiMap[String(santri.id)][j.key] : null;
                          if (status === 'hadir') hadirCount++;
                          else if (status === 'terlambat' || status === 'telat') telatCount++;
                          else if (status === 'izin') izinCount++;
                          else if (status === 'sakit') sakitCount++;
                          else if (status === 'alpa') alpaCount++;
                          
                          return (
                            <td key={j.key} className="px-1 py-3 text-center border-r border-slate-50 dark:border-slate-800/50">
                              <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center text-[10px] font-bold ${status ? getStatusColor(status) : 'text-slate-300'}`}>
                                {getStatusInitial(status || '')}
                              </div>
                            </td>
                          );
                        })}
                        
                        <td className="px-3 py-3 text-center font-bold text-green-600 bg-green-50/50 dark:bg-green-900/10 border-l border-slate-200 dark:border-slate-700">{hadirCount}</td>
                        <td className="px-3 py-3 text-center font-bold text-amber-600 bg-amber-50/50 dark:bg-amber-900/10">{telatCount}</td>
                        <td className="px-3 py-3 text-center font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-900/10">{izinCount}</td>
                        <td className="px-3 py-3 text-center font-bold text-yellow-600 bg-yellow-50/50 dark:bg-yellow-900/10">{sakitCount}</td>
                        <td className="px-3 py-3 text-center font-bold text-red-600 bg-red-50/50 dark:bg-red-900/10">{alpaCount}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1"><div className="w-4 h-4 bg-green-100 text-green-700 rounded flex items-center justify-center">H</div> Hadir</span>
            <span className="flex items-center gap-1"><div className="w-4 h-4 bg-blue-100 text-blue-700 rounded flex items-center justify-center">I</div> Izin</span>
            <span className="flex items-center gap-1"><div className="w-4 h-4 bg-yellow-100 text-yellow-700 rounded flex items-center justify-center">S</div> Sakit</span>
            <span className="flex items-center gap-1"><div className="w-4 h-4 bg-orange-100 text-orange-700 rounded flex items-center justify-center">T</div> Terlambat</span>
            <span className="flex items-center gap-1"><div className="w-4 h-4 bg-red-100 text-red-700 rounded flex items-center justify-center">A</div> Alpa</span>
          </div>
        </div>
      )}

      {/* WHATSAPP GENERATOR MODAL PREVIEW */}
      {isWaModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                  Preview Laporan WhatsApp
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Laporan absensi harian kelas {selectedClass}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWaModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Date Selector Inside Modal */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Pilih Tanggal Laporan
                </label>
                {availableDates.length > 0 ? (
                  <select
                    value={selectedWaDate}
                    onChange={(e) => setSelectedWaDate(e.target.value)}
                    className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {availableDates.map(d => {
                      const parsed = new Date(d);
                      const displayDate = parsed.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                      });
                      return (
                        <option key={d} value={d}>
                          {displayDate}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={selectedWaDate}
                    onChange={(e) => setSelectedWaDate(e.target.value)}
                    className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold p-2.5"
                  />
                )}
                {availableDates.length === 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    * Belum ada riwayat KBM di kelas ini untuk bulan terpilih. Menggunakan tanggal hari ini.
                  </p>
                )}
              </div>

              {/* Text Area Preview */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Teks Pesan WhatsApp
                </label>
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-80 overflow-y-auto shadow-inner select-all">
                  {waFormattedText}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[10px] text-slate-400">
                Gunakan tombol di kanan untuk menyalin teks pesan absensi.
              </span>
              <div className="flex items-center gap-2.5 self-end">
                <button
                  type="button"
                  onClick={() => setIsWaModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? "Tersalin!" : "Salin Teks"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
