import React, { useState, useEffect } from "react";
import { supabase, SantriData } from "../supabaseClient";
import { ClipboardList, Search, Printer, Calendar } from "lucide-react";

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
            nama_sesi: j.sesi_mengaji?.nama_sesi || "-",
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

      // 3. Get Absensi for those jurnals
      const allJurnalIds = loadedJurnals.map(j => j.id);
      if (allJurnalIds.length > 0) {
        const { data: absData, error: absError } = await supabase
          .from("absensi_pengajian")
          .select("santri_id, status, jurnal_id")
          .in("jurnal_id", allJurnalIds);

        if (absError) throw absError;

        // map status by santri and date. If multiple per date, we could prioritize worst status or just take first.
        const newAbsMap: Record<string, Record<string, string>> = {};
        
        absData?.forEach(abs => {
          if (!newAbsMap[abs.santri_id]) newAbsMap[abs.santri_id] = {};
          
          const jurnal = loadedJurnals.find(j => j.id === abs.jurnal_id);
          if (jurnal) {
            const key = `${jurnal.tanggal}_${jurnal.sesi_id || 'none'}`;
            // If already set for this date/sesi, only override if new status is worse (alpa > sakit > izin > terlambat > hadir)
            // But for simplicity, let's just take whatever if it's not set.
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
      case 'hadir': return 'bg-green-100 text-green-700';
      case 'izin': return 'bg-blue-100 text-blue-700';
      case 'sakit': return 'bg-yellow-100 text-yellow-700';
      case 'terlambat': return 'bg-orange-100 text-orange-700';
      case 'alpa': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-400';
    }
  };
  
  const getStatusInitial = (status: string) => {
    if (!status) return '-';
    if (status === 'terlambat') return 'T';
    return status.charAt(0).toUpperCase();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
        >
          <Printer className="w-4 h-4" /> Cetak Rekap
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kelas Pengajian
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
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
                  <th rowSpan={2} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-blue-50 dark:bg-blue-900/20 align-middle">H</th>
                  <th rowSpan={2} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-red-50 dark:bg-red-900/20 align-middle">A</th>
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
                    <td colSpan={jurnals.length + 4} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada santri yang terdaftar di kelas ini.
                    </td>
                  </tr>
                ) : jurnals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Belum ada entri jurnal/absensi untuk bulan ini.
                    </td>
                  </tr>
                ) : (
                  santriList.map((santri, index) => {
                    let hadirCount = 0;
                    let alpaCount = 0;
                    
                    return (
                      <tr key={santri.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-100 dark:border-slate-800">{index + 1}</td>
                        <td className="px-4 py-3 sticky left-12 bg-white dark:bg-slate-900 z-10 border-r border-slate-100 dark:border-slate-800 font-medium">
                          {santri.nama_lengkap}
                        </td>
                        
                        {jurnals.map((j) => {
                          const status = santri.id && absensiMap[santri.id] ? absensiMap[santri.id][j.key] : null;
                          if (status === 'hadir') hadirCount++;
                          if (status === 'alpa') alpaCount++;
                          
                          return (
                            <td key={j.key} className="px-1 py-3 text-center border-r border-slate-50 dark:border-slate-800/50">
                              <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center text-[10px] font-bold ${status ? getStatusColor(status) : 'text-slate-300'}`}>
                                {getStatusInitial(status || '')}
                              </div>
                            </td>
                          );
                        })}
                        
                        <td className="px-4 py-3 text-center font-bold text-green-600 bg-blue-50/50 dark:bg-blue-900/10 border-l border-slate-200 dark:border-slate-700">{hadirCount}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-600 bg-red-50/50 dark:bg-red-900/10">{alpaCount}</td>
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
    </div>
  );
}
