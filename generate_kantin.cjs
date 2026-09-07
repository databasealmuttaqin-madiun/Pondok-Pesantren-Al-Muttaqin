const fs = require('fs');

const code = `import React, { useState, useEffect, useRef } from "react";
import {
  Store,
  Wallet,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Search,
  Filter,
  Plus,
  Trash2,
  Printer,
  Check,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "../supabaseClient";

export interface TransaksiKantin {
  id: string | number;
  tanggal: string;
  kantin: string;
  jenis: "masuk" | "keluar" | "rekap";
  uang_masuk: number;
  uang_keluar: number;
  jumlah_kas?: number;
  keterangan: string;
  kategori: string;
  petugas: string;
  created_at?: string;
  isLocalOnly?: boolean;
}

interface KantinPanelProps {
  viewMode: "input" | "rekap";
  onSwitchMode: (mode: "input" | "rekap") => void;
  currentUser?: any;
  triggerNotification?: (message: string, type: "success" | "warning" | "error") => void;
  isDarkMode?: boolean;
}

const DEFAULT_KANTIN_LIST = ["Kantin Utama", "Kantin Putra", "Kantin Putri"];

export default function KantinPanel({
  viewMode,
  onSwitchMode,
  currentUser,
  triggerNotification,
  isDarkMode = false,
}: KantinPanelProps) {
  const [kantinList, setKantinList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("master_kantin_list");
      return saved ? JSON.parse(saved) : DEFAULT_KANTIN_LIST;
    } catch {
      return DEFAULT_KANTIN_LIST;
    }
  });

  const assignedKantin = currentUser?.tugas_kantin && currentUser.tugas_kantin !== "Semua" ? currentUser.tugas_kantin : null;

  const [selectedKantinInput, setSelectedKantinInput] = useState<string>(() => {
    return assignedKantin || kantinList[0] || "Kantin Utama";
  });

  const [filterKantinRekap, setFilterKantinRekap] = useState<string>(() => {
    return assignedKantin || "semua";
  });

  const [transaksiList, setTransaksiList] = useState<TransaksiKantin[]>(() => {
    try {
      const saved = localStorage.getItem("pembukuan_kantin_data");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split("T")[0]);
  const [uangMasukStr, setUangMasukStr] = useState<string>("");
  const [uangKeluarStr, setUangKeluarStr] = useState<string>("");
  const [keterangan, setKeterangan] = useState<string>("Rekap Harian");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchTransaksiFromCloud = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pembukuan_kantin")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("id", { ascending: false });

      if (data) {
        const cloudRows: TransaksiKantin[] = data.map((row: any) => ({
          id: row.id,
          tanggal: row.tanggal,
          kantin: row.kantin,
          jenis: row.jenis || "rekap",
          uang_masuk: Number(row.uang_masuk || 0),
          uang_keluar: Number(row.uang_keluar || 0),
          jumlah_kas: Number(row.jumlah_kas || 0),
          keterangan: row.keterangan || "",
          kategori: row.kategori || "Rekap",
          petugas: row.petugas || "-",
          created_at: row.created_at,
          isLocalOnly: false,
        }));
        
        let localPending: TransaksiKantin[] = [];
        const saved = localStorage.getItem("pembukuan_kantin_data");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            localPending = parsed.filter((item: any) => item.isLocalOnly);
          } catch {}
        }
        
        const merged = [...localPending, ...cloudRows];
        setTransaksiList(merged);
        localStorage.setItem("pembukuan_kantin_data", JSON.stringify(merged));
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTransaksiFromCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(angka || 0);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uangMasukNum = parseInt(uangMasukStr.replace(/\\D/g, "") || "0", 10);
    const uangKeluarNum = parseInt(uangKeluarStr.replace(/\\D/g, "") || "0", 10);
    
    if (uangMasukNum === 0 && uangKeluarNum === 0) {
      alert("Harap masukkan nominal uang masuk atau keluar!");
      return;
    }

    setIsSubmitting(true);
    let baseKas = 0;
    const kData = transaksiList.filter(t => t.kantin === selectedKantinInput);
    if (kData.length > 0) {
      baseKas = kData[0].jumlah_kas || 0;
    }
    const finalJumlahKas = baseKas + uangMasukNum - uangKeluarNum;

    const newRecord: TransaksiKantin = {
      id: "local_" + Date.now(),
      tanggal,
      kantin: selectedKantinInput,
      jenis: "rekap",
      uang_masuk: uangMasukNum,
      uang_keluar: uangKeluarNum,
      jumlah_kas: finalJumlahKas,
      keterangan: keterangan.trim() || "Rekap Harian",
      kategori: "Rekap Harian",
      petugas: currentUser?.name || currentUser?.username || "Petugas Kantin",
      created_at: new Date().toISOString(),
      isLocalOnly: true,
    };

    const updated = [newRecord, ...transaksiList];
    setTransaksiList(updated);
    localStorage.setItem("pembukuan_kantin_data", JSON.stringify(updated));

    setUangMasukStr("");
    setUangKeluarStr("");
    setIsSubmitting(false);
    triggerNotification?.("Rekap harian kantin berhasil disimpan.", "success");

    try {
      await supabase.from("pembukuan_kantin").insert([{
        tanggal: newRecord.tanggal,
        kantin: newRecord.kantin,
        jenis: newRecord.jenis,
        uang_masuk: newRecord.uang_masuk,
        uang_keluar: newRecord.uang_keluar,
        jumlah_kas: newRecord.jumlah_kas,
        keterangan: newRecord.keterangan,
        kategori: newRecord.kategori,
        petugas: newRecord.petugas,
      }]);
      const latestData = [...updated];
      const idx = latestData.findIndex((t) => t.id === newRecord.id);
      if (idx !== -1) {
        latestData[idx].isLocalOnly = false;
        setTransaksiList([...latestData]);
        localStorage.setItem("pembukuan_kantin_data", JSON.stringify(latestData));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
    try {
      const item = transaksiList.find((t) => t.id === id);
      const updated = transaksiList.filter((t) => t.id !== id);
      setTransaksiList(updated);
      localStorage.setItem("pembukuan_kantin_data", JSON.stringify(updated));
      
      if (item && !item.isLocalOnly) {
        await supabase.from("pembukuan_kantin").delete().eq("id", id);
      }
      triggerNotification?.("Data berhasil dihapus", "success");
    } catch (error) {
      console.error(error);
    }
  };

  const filteredList = transaksiList.filter(item => {
    if (filterKantinRekap !== "semua" && item.kantin !== filterKantinRekap) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.tanggal.includes(q) && !item.keterangan.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER & TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            Rekap Kas Kantin
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Catat rekapitulasi harian uang masuk dan keluar kantin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center shrink-0">
            <button
              onClick={() => onSwitchMode("input")}
              className={\`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 \${
                viewMode === "input"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }\`}
            >
              <Plus className="w-4 h-4" />
              <span>Input Rekap</span>
            </button>
            <button
              onClick={() => onSwitchMode("rekap")}
              className={\`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 \${
                viewMode === "rekap"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }\`}
            >
              <Receipt className="w-4 h-4" />
              <span>Tabel Riwayat</span>
            </button>
          </div>
          <button
            onClick={fetchTransaksiFromCloud}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
          >
            <RefreshCw className={\`w-4 h-4 \${isLoading ? "animate-spin" : ""}\`} />
          </button>
        </div>
      </div>

      {viewMode === "input" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Form Rekap Harian
            </h2>
            <form onSubmit={handleFormSubmit} className="space-y-5">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pilih Kantin</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {kantinList.map((kName) => (
                    <button
                      key={kName}
                      type="button"
                      disabled={!!assignedKantin && assignedKantin !== kName}
                      onClick={() => setSelectedKantinInput(kName)}
                      className={\`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between \${
                        selectedKantinInput === kName
                          ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-2xs"
                          : "bg-slate-50 border-slate-200 dark:border-slate-700/60 text-slate-700"
                      }\`}
                    >
                      <span className="truncate">{kName}</span>
                      {selectedKantinInput === kName && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tanggal Rekap</label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Uang Masuk (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="text"
                      placeholder="0"
                      value={uangMasukStr}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\\D/g, "");
                        setUangMasukStr(raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "");
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs font-bold focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Uang Keluar (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="text"
                      placeholder="0"
                      value={uangKeluarStr}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\\D/g, "");
                        setUangKeluarStr(raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "");
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-rose-50/50 border border-rose-200 text-xs font-bold focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Keterangan Tambahan</label>
                <textarea
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Rekap</span>
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-slate-500" />
                Riwayat Hari Ini ({selectedKantinInput})
              </h3>
              <div className="space-y-3">
                {transaksiList
                  .filter(t => t.kantin === selectedKantinInput && t.tanggal === new Date().toISOString().split("T")[0])
                  .map(t => (
                    <div key={t.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 text-xs">
                       <div className="flex justify-between items-center mb-1">
                         <span className="font-semibold">{t.keterangan}</span>
                         <span className="text-emerald-600 font-bold">In: {formatRupiah(t.uang_masuk)}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-[10px] text-slate-500">{t.petugas}</span>
                         <span className="text-rose-600 font-bold">Out: {formatRupiah(t.uang_keluar)}</span>
                       </div>
                    </div>
                  ))}
                  {transaksiList.filter(t => t.kantin === selectedKantinInput && t.tanggal === new Date().toISOString().split("T")[0]).length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-4">Belum ada rekap untuk hari ini.</div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === "rekap" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={filterKantinRekap}
                onChange={(e) => setFilterKantinRekap(e.target.value)}
                disabled={!!assignedKantin && assignedKantin !== "semua"}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none"
              >
                <option value="semua">Semua Kantin</option>
                {kantinList.map((kName) => (
                  <option key={kName} value={kName}>{kName}</option>
                ))}
              </select>
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari tanggal / keterangan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <button
              onClick={() => window.print()}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-xl shadow-xs flex items-center gap-2 hover:bg-slate-700"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak PDF
            </button>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 text-xs font-semibold w-24">Tanggal</th>
                  <th className="py-3 px-4 text-xs font-semibold">Kantin</th>
                  <th className="py-3 px-4 text-xs font-semibold text-right">Uang Masuk</th>
                  <th className="py-3 px-4 text-xs font-semibold text-right">Uang Keluar</th>
                  <th className="py-3 px-4 text-xs font-semibold text-right">Saldo Kas</th>
                  <th className="py-3 px-4 text-xs font-semibold">Keterangan</th>
                  <th className="py-3 px-4 text-xs font-semibold text-center print:hidden w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {item.tanggal}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {item.kantin}
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-emerald-600 text-right whitespace-nowrap">
                      {item.uang_masuk > 0 ? \`+\${formatRupiah(item.uang_masuk)}\` : "-"}
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-rose-600 text-right whitespace-nowrap">
                      {item.uang_keluar > 0 ? \`-\${formatRupiah(item.uang_keluar)}\` : "-"}
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-blue-600 text-right whitespace-nowrap">
                      {formatRupiah(item.jumlah_kas || 0)}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400">
                      {item.keterangan}
                      <div className="mt-0.5 text-[10px] text-slate-400">By: {item.petugas}</div>
                    </td>
                    <td className="py-3 px-4 text-center print:hidden">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      Tidak ada data ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
`;
fs.writeFileSync('src/components/KantinPanel.tsx', code);
