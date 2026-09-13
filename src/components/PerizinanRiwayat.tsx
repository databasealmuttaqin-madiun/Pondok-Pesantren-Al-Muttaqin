import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Clock, RefreshCw, Calendar, Search, Filter, History } from "lucide-react";
import { SearchableSelect } from "./ui/SearchableSelect";

interface RiwayatItem {
  id: number;
  nama_siswa: string;
  kamar?: string;
  kategori_izin: "sakit" | "sambang" | "haid";
  keperluan?: string;
  tujuan?: string;
  diagnosa_keluhan?: string;
  lokasi_rawat?: string;
  tanggal_mulai: string;
  jam_mulai?: string;
  tanggal_kembali?: string;
  status: string;
  created_at: string;
}

export default function PerizinanRiwayat() {
  const [items, setItems] = useState<RiwayatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategori, setFilterKategori] = useState("All");
  
  const fetchRiwayat = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("riwayat_perizinan_view")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (error) {
        throw error;
      }
      
      setItems(data || []);
    } catch (err) {
      console.error("Gagal memuat riwayat", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
  }, []);

  const filteredItems = items.filter(item => {
    if (filterKategori !== "All" && item.kategori_izin !== filterKategori) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.nama_siswa?.toLowerCase().includes(q) && !item.kamar?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-500" />
            Riwayat Perizinan
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Data santri yang sudah kembali, sembuh, atau suci.
          </p>
        </div>
        <button
          onClick={fetchRiwayat}
          disabled={isLoading}
          className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all border border-slate-200/80 dark:border-slate-700/60 cursor-pointer shadow-2xs disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Cari nama atau kelas/kamar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div className="w-full md:w-48">
            <SearchableSelect
              value={filterKategori}
              onChange={setFilterKategori}
              options={[
                { value: "All", label: "Semua Kategori" },
                { value: "sakit", label: "Izin Sakit" },
                { value: "sambang", label: "Izin Sambang" },
                { value: "haid", label: "Izin Haid" },
              ]}
              placeholder="Kategori"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama & Kamar</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Detail</th>
                <th className="py-3 px-4">Waktu Mulai</th>
                <th className="py-3 px-4">Realisasi Kembali</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Tidak ada riwayat perizinan
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={`${item.kategori_izin}-${item.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 text-center font-medium text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white mb-0.5">{item.nama_siswa}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.kamar || "—"}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.kategori_izin === "sakit" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                        item.kategori_izin === "haid" ? "bg-pink-50 text-pink-600 border border-pink-200" :
                        "bg-blue-50 text-blue-600 border border-blue-200"
                      }`}>
                        {item.kategori_izin === "sakit" ? "Sakit" : item.kategori_izin === "haid" ? "Haid" : "Sambang"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {item.kategori_izin === "sakit" ? item.diagnosa_keluhan || item.keperluan : 
                         item.kategori_izin === "haid" ? "Izin Sholat" : 
                         item.tujuan || item.keperluan || "Pulang"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {new Date(item.tanggal_mulai).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {item.tanggal_kembali ? new Date(item.tanggal_kembali).toLocaleDateString("id-ID") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
