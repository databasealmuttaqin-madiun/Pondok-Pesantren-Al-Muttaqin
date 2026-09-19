import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FileText, Search, Printer, Calendar } from "lucide-react";

interface Props {
  recitationClasses: string[];
  onTriggerNotification: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export default function RekapJurnalPengajianPanel({ recitationClasses, onTriggerNotification }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [jurnals, setJurnals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedClass && selectedMonth) {
      loadData();
    } else {
      setJurnals([]);
    }
  }, [selectedClass, selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const year = selectedMonth.split("-")[0];
      const month = selectedMonth.split("-")[1];
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("jurnal_pengajian")
        .select("*, materi_pengajian(nama_materi, kelompok), sesi_mengaji(nama_sesi)")
        .eq("kelas_pengajian", selectedClass)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .order("tanggal", { ascending: true });

      if (error) throw error;
      
      const loadedJurnals = data || [];
      
      // Manually fetch and attach ustaz/pengguna names
      if (loadedJurnals.length > 0) {
        const ustazIds = Array.from(new Set(loadedJurnals.map(j => j.ustaz_id).filter(id => id)));
        if (ustazIds.length > 0) {
          const userMap: Record<string, string> = {};

          try {
            const { data: usersData } = await supabase.from("pengguna").select("id, nama, nama_lengkap");
            if (usersData) {
              usersData.forEach((u: any) => {
                userMap[String(u.id)] = u.nama_lengkap || u.nama;
              });
            }
          } catch (eU) {
            console.warn("Notice fetch pengguna:", eU);
          }

          try {
            const { data: guruData } = await supabase.from("guru").select("id, pengguna_id, nama, nama_lengkap");
            if (guruData) {
              guruData.forEach((g: any) => {
                const name = g.nama_lengkap || g.nama;
                userMap[String(g.id)] = name;
                if (g.pengguna_id && !userMap[String(g.pengguna_id)]) {
                  userMap[String(g.pengguna_id)] = name;
                }
              });
            }
          } catch (eG) {
            console.warn("Notice fetch guru:", eG);
          }

          loadedJurnals.forEach(j => {
            if (j.ustaz_id && userMap[String(j.ustaz_id)]) {
              j.pengguna = { nama: userMap[String(j.ustaz_id)] };
            }
          });
        }
      }

      setJurnals(loadedJurnals);
    } catch (e: any) {
      console.error(e);
      onTriggerNotification(`Gagal memuat rekap jurnal: ${e.message}`, "error");
    }
    setIsLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Rekap Jurnal Pengajian
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Lihat riwayat jurnal harian per kelas dan bulan.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
        >
          <Printer className="w-4 h-4" /> Cetak Laporan
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
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Tanggal</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Sesi</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Materi</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Guru/Ustaz</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Hal Mulai</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Hal Selesai</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Status</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {jurnals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada data jurnal untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  jurnals.map((jurnal) => (
                    <tr key={jurnal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 whitespace-nowrap">{jurnal.tanggal}</td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {jurnal.sesi_mengaji?.nama_sesi || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {jurnal.materi_pengajian?.nama_materi || "-"} 
                        {jurnal.materi_pengajian?.kelompok ? ` (${jurnal.materi_pengajian.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"})` : ""}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {jurnal.pengguna?.nama || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">{jurnal.realisasi_halaman_mulai}</td>
                      <td className="px-4 py-3 text-center">{jurnal.realisasi_halaman_selesai}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          jurnal.status_capaian === 'tercapai' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                          jurnal.status_capaian === 'terlampaui' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                          jurnal.status_capaian === 'belum_tercapai' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {jurnal.status_capaian ? jurnal.status_capaian.replace('_', ' ') : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{jurnal.catatan_kendala || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
