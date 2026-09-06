import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Edit3,
  Printer,
  Download,
  Check,
  AlertCircle,
  Building,
  RefreshCw,
  Coins,
  FileSpreadsheet,
  X,
  Copy,
} from "lucide-react";
import { supabase } from "../supabaseClient";

export interface TransaksiKantin {
  id: string | number;
  tanggal: string;
  kantin: string;
  jenis: "masuk" | "keluar";
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
  currentUser?: {
    username: string;
    role: string;
    name: string;
    gender?: string;
    tugas_kantin?: string;
  } | null;
  triggerNotification?: (message: string, type: "success" | "warning" | "error") => void;
  isDarkMode?: boolean;
}

const DEFAULT_KANTIN_LIST = ["Kantin Utama", "Kantin Putra", "Kantin Putri"];

const KATEGORI_MASUK = [
  "Penjualan Makanan",
  "Penjualan Minuman & Snack",
  "Titipan Dagangan",
  "Modal Kas Awal",
  "Pemasukan Lainnya",
];

const KATEGORI_KELUAR = [
  "Belanja Bahan Pokok / Kulakan",
  "Belanja Minuman & Es Batu",
  "Gas Elpiji & Listrik",
  "Operasional & Kebersihan",
  "Bagi Hasil Titipan",
  "Pengeluaran Lainnya",
];

export default function KantinPanel({
  viewMode,
  onSwitchMode,
  currentUser,
  triggerNotification,
  isDarkMode = false,
}: KantinPanelProps) {
  // Master Kantin List
  const [kantinList, setKantinList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("master_kantin_list");
      return saved ? JSON.parse(saved) : DEFAULT_KANTIN_LIST;
    } catch {
      return DEFAULT_KANTIN_LIST;
    }
  });

  // User role checking
  const userRole = currentUser?.role?.toLowerCase() || "kantin";
  const isAdmin = userRole === "admin" || userRole === "super admin" || userRole === "superadmin";
  const assignedKantin = currentUser?.tugas_kantin && currentUser.tugas_kantin !== "Semua" ? currentUser.tugas_kantin : null;

  // Active Kantin for input
  const [selectedKantinInput, setSelectedKantinInput] = useState<string>(() => {
    if (assignedKantin) return assignedKantin;
    return kantinList[0] || "Kantin Utama";
  });

  // Active Kantin filter for rekap
  const [filterKantinRekap, setFilterKantinRekap] = useState<string>(() => {
    if (assignedKantin) return assignedKantin;
    return "semua";
  });

  // Data Transaksi
  const [transaksiList, setTransaksiList] = useState<TransaksiKantin[]>(() => {
    try {
      const saved = localStorage.getItem("pembukuan_kantin_data");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Form Input State
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split("T")[0]);
  const [jenis, setJenis] = useState<"masuk" | "keluar">("masuk");
  const [nominalStr, setNominalStr] = useState<string>("");
  const [kategori, setKategori] = useState<string>(KATEGORI_MASUK[0]);
  const [keterangan, setKeterangan] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<TransaksiKantin | null>(null);

  // Add New Kantin Modal
  const [showAddKantinModal, setShowAddKantinModal] = useState(false);
  const [newKantinName, setNewKantinName] = useState("");

  // Filters for Rekap
  const [filterTanggalRange, setFilterTanggalRange] = useState<"semua" | "hari_ini" | "7_hari" | "bulan_ini" | "custom">("bulan_ini");
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [filterJenis, setFilterJenis] = useState<"semua" | "masuk" | "keluar">("semua");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Print ref
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Synchronize with assigned kantin if restricted
  useEffect(() => {
    if (assignedKantin) {
      setSelectedKantinInput(assignedKantin);
      setFilterKantinRekap(assignedKantin);
    }
  }, [assignedKantin]);

  // Load from Supabase on mount
  const fetchTransaksiFromCloud = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pembukuan_kantin")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("id", { ascending: false });

      if (error) {
        // Table doesn't exist yet or permission error
        console.warn("Supabase pembukuan_kantin:", error.message);
      } else if (data) {
        const cloudRows: TransaksiKantin[] = data.map((row: any) => ({
          id: row.id,
          tanggal: row.tanggal,
          kantin: row.kantin,
          jenis: row.jenis || (row.uang_masuk > 0 ? "masuk" : "keluar"),
          uang_masuk: Number(row.uang_masuk || 0),
          uang_keluar: Number(row.uang_keluar || 0),
          jumlah_kas: Number(row.jumlah_kas || 0),
          keterangan: row.keterangan || "",
          kategori: row.kategori || "Umum",
          petugas: row.petugas || "-",
          created_at: row.created_at,
          isLocalOnly: false,
        }));

        // Merge local data that hasn't synced
        const saved = localStorage.getItem("pembukuan_kantin_data");
        let localPending: TransaksiKantin[] = [];
        if (saved) {
          try {
            const parsed: TransaksiKantin[] = JSON.parse(saved);
            localPending = parsed.filter((item) => item.isLocalOnly);
          } catch {
            localPending = [];
          }
        }

        const merged = [...localPending, ...cloudRows];
        setTransaksiList(merged);
        localStorage.setItem("pembukuan_kantin_data", JSON.stringify(merged));
      }
    } catch (err) {
      console.warn("Gagal menghubungi Supabase untuk kantin:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransaksiFromCloud();
  }, []);

  // Save master kantin list
  const handleSaveNewKantin = () => {
    const trimmed = newKantinName.trim();
    if (!trimmed) return;
    if (kantinList.includes(trimmed)) {
      alert("Nama kantin sudah ada!");
      return;
    }
    const updated = [...kantinList, trimmed];
    setKantinList(updated);
    localStorage.setItem("master_kantin_list", JSON.stringify(updated));
    setNewKantinName("");
    setShowAddKantinModal(false);
    triggerNotification?.(`Kantin "${trimmed}" berhasil ditambahkan.`, "success");
  };

  // Helper format currency
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Hitung saldo kas berjalan saat ini untuk kantin yang dipilih di form
  const currentKasSelectedKantin = useMemo(() => {
    const kantinItems = transaksiList.filter((t) => t.kantin === selectedKantinInput);
    const totalMasuk = kantinItems.reduce((acc, curr) => acc + (curr.uang_masuk || 0), 0);
    const totalKeluar = kantinItems.reduce((acc, curr) => acc + (curr.uang_keluar || 0), 0);
    return totalMasuk - totalKeluar;
  }, [transaksiList, selectedKantinInput]);

  // Proyeksi kas setelah nominal input disimpan
  const nominalNumber = parseInt(nominalStr.replace(/\D/g, "") || "0", 10);
  const proyeksiKas = useMemo(() => {
    if (jenis === "masuk") {
      return currentKasSelectedKantin + nominalNumber;
    } else {
      return currentKasSelectedKantin - nominalNumber;
    }
  }, [currentKasSelectedKantin, nominalNumber, jenis]);

  // Handle Input Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nominalNumber <= 0) {
      alert("Nominal uang harus lebih dari 0!");
      return;
    }
    if (!keterangan.trim()) {
      alert("Harap masukkan keterangan transaksi!");
      return;
    }

    setIsSubmitting(true);
    const uangMasuk = jenis === "masuk" ? nominalNumber : 0;
    const uangKeluar = jenis === "keluar" ? nominalNumber : 0;
    const finalJumlahKas = proyeksiKas;

    const newRecord: TransaksiKantin = {
      id: "local_" + Date.now(),
      tanggal,
      kantin: selectedKantinInput,
      jenis,
      uang_masuk: uangMasuk,
      uang_keluar: uangKeluar,
      jumlah_kas: finalJumlahKas,
      keterangan: keterangan.trim(),
      kategori,
      petugas: currentUser?.name || currentUser?.username || "Petugas Kantin",
      created_at: new Date().toISOString(),
      isLocalOnly: true,
    };

    // 1. Simpan langsung ke state & localStorage (cepat tanpa delay)
    const updated = [newRecord, ...transaksiList];
    setTransaksiList(updated);
    localStorage.setItem("pembukuan_kantin_data", JSON.stringify(updated));

    // Reset Form
    setNominalStr("");
    setKeterangan("");
    setIsSubmitting(false);
    triggerNotification?.("Catatan transaksi kas kantin berhasil disimpan.", "success");

    // 2. Sync asynchronously to Supabase
    try {
      const { data, error } = await supabase
        .from("pembukuan_kantin")
        .insert([
          {
            tanggal: newRecord.tanggal,
            kantin: newRecord.kantin,
            jenis: newRecord.jenis,
            uang_masuk: newRecord.uang_masuk,
            uang_keluar: newRecord.uang_keluar,
            jumlah_kas: newRecord.jumlah_kas,
            keterangan: newRecord.keterangan,
            kategori: newRecord.kategori,
            petugas: newRecord.petugas,
          },
        ])
        .select();

      if (!error && data && data.length > 0) {
        // Ganti ID lokal dengan ID database
        const syncedId = data[0].id;
        const finalized = updated.map((t) =>
          t.id === newRecord.id ? { ...t, id: syncedId, isLocalOnly: false } : t
        );
        setTransaksiList(finalized);
        localStorage.setItem("pembukuan_kantin_data", JSON.stringify(finalized));
      }
    } catch (err) {
      console.warn("Gagal simpan ke Supabase, tetap tersimpan lokal:", err);
    }
  };

  // Handle Edit Save
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const uangMasuk = editingItem.jenis === "masuk" ? editingItem.uang_masuk : 0;
    const uangKeluar = editingItem.jenis === "keluar" ? editingItem.uang_keluar : 0;

    const updatedItem = {
      ...editingItem,
      uang_masuk: uangMasuk,
      uang_keluar: uangKeluar,
    };

    const updatedList = transaksiList.map((t) => (t.id === editingItem.id ? updatedItem : t));
    setTransaksiList(updatedList);
    localStorage.setItem("pembukuan_kantin_data", JSON.stringify(updatedList));
    setEditingItem(null);
    triggerNotification?.("Perubahan transaksi berhasil disimpan.", "success");

    // Sync to Supabase
    if (typeof editingItem.id === "number" || !String(editingItem.id).startsWith("local_")) {
      try {
        await supabase
          .from("pembukuan_kantin")
          .update({
            tanggal: updatedItem.tanggal,
            kantin: updatedItem.kantin,
            jenis: updatedItem.jenis,
            uang_masuk: updatedItem.uang_masuk,
            uang_keluar: updatedItem.uang_keluar,
            keterangan: updatedItem.keterangan,
            kategori: updatedItem.kategori,
          })
          .eq("id", editingItem.id);
      } catch (err) {
        console.warn("Sync update error:", err);
      }
    }
  };

  // Handle Delete
  const handleDelete = async (item: TransaksiKantin) => {
    if (!confirm(`Hapus transaksi kas "${item.keterangan}" (${formatRupiah(item.uang_masuk || item.uang_keluar)})?`)) {
      return;
    }

    const updated = transaksiList.filter((t) => t.id !== item.id);
    setTransaksiList(updated);
    localStorage.setItem("pembukuan_kantin_data", JSON.stringify(updated));
    triggerNotification?.("Transaksi berhasil dihapus.", "success");

    if (typeof item.id === "number" || !String(item.id).startsWith("local_")) {
      try {
        await supabase.from("pembukuan_kantin").delete().eq("id", item.id);
      } catch (err) {
        console.warn("Gagal hapus dari cloud:", err);
      }
    }
  };

  // Filtered List for Rekap
  const filteredRekapList = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const currentMonthPrefix = today.slice(0, 7);

    return transaksiList.filter((item) => {
      // 1. Filter Kantin
      if (assignedKantin) {
        if (item.kantin !== assignedKantin) return false;
      } else if (filterKantinRekap !== "semua") {
        if (item.kantin !== filterKantinRekap) return false;
      }

      // 2. Filter Tanggal
      if (filterTanggalRange === "hari_ini" && item.tanggal !== today) return false;
      if (filterTanggalRange === "7_hari" && (item.tanggal < sevenDaysAgo || item.tanggal > today)) return false;
      if (filterTanggalRange === "bulan_ini" && !item.tanggal.startsWith(currentMonthPrefix)) return false;
      if (filterTanggalRange === "custom") {
        if (item.tanggal < customStartDate || item.tanggal > customEndDate) return false;
      }

      // 3. Filter Jenis
      if (filterJenis !== "semua" && item.jenis !== filterJenis) return false;

      // 4. Pencarian teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${item.keterangan} ${item.kategori} ${item.petugas} ${item.kantin}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [
    transaksiList,
    assignedKantin,
    filterKantinRekap,
    filterTanggalRange,
    customStartDate,
    customEndDate,
    filterJenis,
    searchQuery,
  ]);

  // Rekap Totals
  const rekapTotals = useMemo(() => {
    let totalMasuk = 0;
    let totalKeluar = 0;

    filteredRekapList.forEach((item) => {
      totalMasuk += item.uang_masuk || 0;
      totalKeluar += item.uang_keluar || 0;
    });

    const saldo = totalMasuk - totalKeluar;
    return {
      totalMasuk,
      totalKeluar,
      saldo,
      count: filteredRekapList.length,
    };
  }, [filteredRekapList]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRekapList.length === 0) {
      alert("Tidak ada data untuk diekspor!");
      return;
    }

    const headers = ["No", "Tanggal", "Kantin", "Jenis", "Kategori", "Keterangan", "Uang Masuk (Rp)", "Uang Keluar (Rp)", "Petugas"];
    const rows = filteredRekapList.map((item, idx) => [
      idx + 1,
      item.tanggal,
      `"${item.kantin.replace(/"/g, '""')}"`,
      item.jenis === "masuk" ? "Uang Masuk" : "Uang Keluar",
      `"${(item.kategori || "-").replace(/"/g, '""')}"`,
      `"${(item.keterangan || "-").replace(/"/g, '""')}"`,
      item.uang_masuk || 0,
      item.uang_keluar || 0,
      `"${(item.petugas || "-").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Kas_Kantin_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  // SQL Script for creating Supabase table
  const sqlCreateScript = `-- Jalankan di Supabase SQL Editor jika belum membuat tabel pembukuan_kantin:
CREATE TABLE IF NOT EXISTS public.pembukuan_kantin (
  id BIGSERIAL PRIMARY KEY,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  kantin TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'masuk',
  uang_masuk NUMERIC DEFAULT 0,
  uang_keluar NUMERIC DEFAULT 0,
  jumlah_kas NUMERIC DEFAULT 0,
  keterangan TEXT,
  kategori TEXT DEFAULT 'Umum',
  petugas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pembukuan_kantin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.pembukuan_kantin FOR ALL USING (true) WITH CHECK (true);`;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Pembukuan Kas Kantin
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pencatatan uang masuk, uang keluar, dan saldo kas harian per kantin
                {assignedKantin ? ` • Khusus: ${assignedKantin}` : " • Seluruh Unit Kantin"}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => onSwitchMode("input")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                viewMode === "input"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Input Kas</span>
            </button>
            <button
              onClick={() => onSwitchMode("rekap")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                viewMode === "rekap"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Rekap Kas</span>
            </button>
          </div>

          <button
            onClick={() => fetchTransaksiFromCloud()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Muat Ulang / Sinkronisasi"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* VIEW: MODE INPUT KAS */}
      {viewMode === "input" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Form Input Transaksi */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Formulir Transaksi Kas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Isi rincian mutasi kas masuk atau keluar sesuai kantin
                </p>
              </div>

              {/* Tag Status Kantin */}
              <div className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <span>{selectedKantinInput}</span>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* 1. Pilih Kantin */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pilih Kantin <span className="text-rose-500">*</span>
                  </label>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAddKantinModal(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Kantin Baru</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {kantinList.map((kName) => {
                    const isSelected = selectedKantinInput === kName;
                    const isLocked = assignedKantin && assignedKantin !== kName;
                    return (
                      <button
                        key={kName}
                        type="button"
                        disabled={isLocked}
                        onClick={() => setSelectedKantinInput(kName)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-2xs"
                            : isLocked
                            ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400"
                            : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                        }`}
                      >
                        <span className="truncate">{kName}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Jenis Transaksi: Masuk vs Keluar */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Jenis Transaksi <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setJenis("masuk");
                      setKategori(KATEGORI_MASUK[0]);
                    }}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      jenis === "masuk"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-2xs"
                        : "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        jenis === "masuk"
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold">Uang Masuk</div>
                      <div className="text-[11px] opacity-75">Pemasukan kas / penjualan</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setJenis("keluar");
                      setKategori(KATEGORI_KELUAR[0]);
                    }}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      jenis === "keluar"
                        ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-800 dark:text-rose-300 shadow-2xs"
                        : "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        jenis === "keluar"
                          ? "bg-rose-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold">Uang Keluar</div>
                      <div className="text-[11px] opacity-75">Belanja, kulakan & operasional</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Tanggal & Nominal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tanggal Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nominal Rupiah (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={nominalStr}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setNominalStr(raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "");
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Kategori Transaksi */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kategori
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {(jenis === "masuk" ? KATEGORI_MASUK : KATEGORI_KELUAR).map((kat) => (
                    <option key={kat} value={kat}>
                      {kat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Keterangan */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Keterangan / Rincian <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Hasil penjualan sarapan pagi, belanja telur 5 kg dan minyak goreng, dll..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                />
              </div>

              {/* Action Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Catatan Kas</span>
                </button>
              </div>
            </form>
          </div>

          {/* Kolom Kanan: Ringkasan & Kalkulator Kas */}
          <div className="space-y-4">
            {/* Box Kas Terkini & Proyeksi */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Wallet className="w-4 h-4 text-blue-600" />
                <span>Status Kas {selectedKantinInput}</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Kas Saat Ini:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatRupiah(currentKasSelectedKantin)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    {jenis === "masuk" ? "Tambah Uang Masuk:" : "Kurangi Uang Keluar:"}
                  </span>
                  <span
                    className={`font-bold ${
                      jenis === "masuk" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {jenis === "masuk" ? "+" : "-"} {formatRupiah(nominalNumber)}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Proyeksi Kas Akhir:
                  </span>
                  <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                    {formatRupiah(proyeksiKas)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Pencatatan kas dihitung otomatis berdasarkan akumulasi uang masuk dan uang keluar untuk{" "}
                <strong className="text-slate-700 dark:text-slate-300">{selectedKantinInput}</strong>.
              </div>
            </div>

            {/* Riwayat Terakhir untuk Kantin Terpilih */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span>Transaksi Terakhir</span>
                <button
                  type="button"
                  onClick={() => onSwitchMode("rekap")}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-normal"
                >
                  Lihat Semua
                </button>
              </div>

              <div className="space-y-2">
                {transaksiList
                  .filter((t) => t.kantin === selectedKantinInput)
                  .slice(0, 4)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {t.keterangan}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {t.tanggal} • {t.kategori}
                        </div>
                      </div>
                      <div
                        className={`font-bold shrink-0 text-xs ${
                          t.jenis === "masuk" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {t.jenis === "masuk" ? "+" : "-"} {formatRupiah(t.uang_masuk || t.uang_keluar)}
                      </div>
                    </div>
                  ))}

                {transaksiList.filter((t) => t.kantin === selectedKantinInput).length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Belum ada transaksi di {selectedKantinInput}.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: MODE REKAP PEMBUKUAN */}
      {viewMode === "rekap" && (
        <div className="space-y-6">
          {/* STATS KARTU RINGKASAN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Uang Masuk */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Uang Masuk</span>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatRupiah(rekapTotals.totalMasuk)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Pemasukan kas terfilter</div>
            </div>

            {/* Card 2: Total Uang Keluar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Uang Keluar</span>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-lg font-extrabold text-rose-600 dark:text-rose-400">
                {formatRupiah(rekapTotals.totalKeluar)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Pengeluaran kas terfilter</div>
            </div>

            {/* Card 3: Saldo Kas */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Sisa Kas Terkini</span>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-lg font-extrabold text-blue-600 dark:text-blue-400">
                {formatRupiah(rekapTotals.saldo)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Selisih Masuk - Keluar</div>
            </div>

            {/* Card 4: Total Transaksi */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Jumlah Transaksi</span>
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-lg font-extrabold text-slate-800 dark:text-slate-100">
                {rekapTotals.count}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Catatan transaksi kas</div>
            </div>
          </div>

          {/* FILTER BAR & ACTION BUTTONS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Filter Kantin */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Unit Kantin
                </label>
                <select
                  value={filterKantinRekap}
                  disabled={Boolean(assignedKantin)}
                  onChange={(e) => setFilterKantinRekap(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {isAdmin && <option value="semua">Semua Kantin (Admin)</option>}
                  {kantinList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tanggal */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Rentang Waktu
                </label>
                <select
                  value={filterTanggalRange}
                  onChange={(e) => setFilterTanggalRange(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="bulan_ini">Bulan Ini</option>
                  <option value="hari_ini">Hari Ini</option>
                  <option value="7_hari">7 Hari Terakhir</option>
                  <option value="semua">Semua Tanggal</option>
                  <option value="custom">Pilih Tanggal Manual</option>
                </select>
              </div>

              {/* Filter Jenis */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Jenis Transaksi
                </label>
                <select
                  value={filterJenis}
                  onChange={(e) => setFilterJenis(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="semua">Semua Transaksi</option>
                  <option value="masuk">Hanya Uang Masuk</option>
                  <option value="keluar">Hanya Uang Keluar</option>
                </select>
              </div>

              {/* Pencarian Keterangan */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Cari Keterangan / Petugas
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik kata kunci..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Custom Date Range Picker jika dipilih */}
            {filterTanggalRange === "custom" && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500">Dari:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                />
                <span className="text-xs text-slate-500">Sampai:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            {/* Action Bar (Print & Export) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Menampilkan <strong className="text-slate-800 dark:text-slate-200">{filteredRekapList.length}</strong> transaksi kas
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ekspor Excel / CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Laporan</span>
                </button>
              </div>
            </div>
          </div>

          {/* TABEL REKAP KAS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Kantin</th>
                    <th className="py-3 px-4">Kategori & Keterangan</th>
                    <th className="py-3 px-4 text-right">Uang Masuk</th>
                    <th className="py-3 px-4 text-right">Uang Keluar</th>
                    <th className="py-3 px-4">Petugas</th>
                    <th className="py-3 px-4 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRekapList.length > 0 ? (
                    filteredRekapList.map((item, index) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                          {item.tanggal}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                            {item.kantin}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {item.keterangan}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {item.kategori || "Umum"}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                          {item.uang_masuk > 0 ? formatRupiah(item.uang_masuk) : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 whitespace-nowrap">
                          {item.uang_keluar > 0 ? formatRupiah(item.uang_keluar) : "-"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                          {item.petugas || "-"}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit Transaksi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Tidak ada transaksi kas yang sesuai dengan kriteria filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SQL DATABASE GUIDE BANNER (COLLAPSIBLE FOR ADMIN) */}
      {isAdmin && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs">
          <div
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className="flex items-center justify-between cursor-pointer font-semibold text-slate-700 dark:text-slate-300"
          >
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-500" />
              <span>Informasi Tabel Supabase Cloud (Opsional)</span>
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-400">
              {showSqlGuide ? "Sembunyikan SQL" : "Lihat Script SQL Tabel"}
            </span>
          </div>

          {showSqlGuide && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Aplikasi ini otomatis menyimpan data kas ke memori lokal browser. Jika ingin menyimpan data ke database Supabase, salin dan jalankan script SQL ini pada Supabase SQL Editor Anda:
              </p>
              <div className="relative">
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[10px] font-mono leading-relaxed">
                  {sqlCreateScript}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sqlCreateScript);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-sm"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedSql ? "Tersalin!" : "Salin SQL"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL EDIT TRANSAKSI */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Edit Catatan Transaksi Kas
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 dark:text-slate-400">Kantin</label>
                <select
                  value={editingItem.kantin}
                  onChange={(e) => setEditingItem({ ...editingItem, kantin: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                >
                  {kantinList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Tanggal</label>
                  <input
                    type="date"
                    value={editingItem.tanggal}
                    onChange={(e) => setEditingItem({ ...editingItem, tanggal: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 dark:text-slate-400">Jenis</label>
                  <select
                    value={editingItem.jenis}
                    onChange={(e) => setEditingItem({ ...editingItem, jenis: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="masuk">Uang Masuk</option>
                    <option value="keluar">Uang Keluar</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600 dark:text-slate-400">
                  Nominal (Rp)
                </label>
                <input
                  type="number"
                  value={editingItem.jenis === "masuk" ? editingItem.uang_masuk : editingItem.uang_keluar}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 0;
                    if (editingItem.jenis === "masuk") {
                      setEditingItem({ ...editingItem, uang_masuk: num, uang_keluar: 0 });
                    } else {
                      setEditingItem({ ...editingItem, uang_keluar: num, uang_masuk: 0 });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600 dark:text-slate-400">Keterangan</label>
                <textarea
                  rows={2}
                  value={editingItem.keterangan}
                  onChange={(e) => setEditingItem({ ...editingItem, keterangan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH KANTIN BARU (UNTUK ADMIN) */}
      {showAddKantinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" />
                <span>Tambah Unit Kantin Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddKantinModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Nama Unit Kantin
              </label>
              <input
                type="text"
                placeholder="Contoh: Kantin Koperasi, Kantin Asrama..."
                value={newKantinName}
                onChange={(e) => setNewKantinName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddKantinModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNewKantin}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
              >
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY VIEW: FORMAT CETAK RESMI LAPORAN KAS */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 z-[9999]">
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h2 className="text-xl font-bold uppercase tracking-wider">
            PONDOK PESANTREN & SMP AL MUTTAQIN
          </h2>
          <h3 className="text-base font-semibold">
            LAPORAN REKAP PEMBUKUAN KAS KANTIN
          </h3>
          <p className="text-xs text-gray-600 mt-1">
            Unit: {filterKantinRekap === "semua" ? "Seluruh Unit Kantin" : filterKantinRekap} • Tanggal Cetak: {new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}
          </p>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-xs border p-3 rounded">
          <div>
            <span className="text-gray-600">Total Uang Masuk:</span>
            <div className="font-bold text-sm text-green-700">{formatRupiah(rekapTotals.totalMasuk)}</div>
          </div>
          <div>
            <span className="text-gray-600">Total Uang Keluar:</span>
            <div className="font-bold text-sm text-red-700">{formatRupiah(rekapTotals.totalKeluar)}</div>
          </div>
          <div>
            <span className="text-gray-600">Sisa Saldo Kas:</span>
            <div className="font-bold text-sm text-blue-700">{formatRupiah(rekapTotals.saldo)}</div>
          </div>
        </div>

        {/* Tabel Data Cetak */}
        <table className="w-full text-xs border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400">
              <th className="border border-gray-400 p-2 text-center w-8">No</th>
              <th className="border border-gray-400 p-2 text-left">Tanggal</th>
              <th className="border border-gray-400 p-2 text-left">Kantin</th>
              <th className="border border-gray-400 p-2 text-left">Keterangan</th>
              <th className="border border-gray-400 p-2 text-right">Uang Masuk</th>
              <th className="border border-gray-400 p-2 text-right">Uang Keluar</th>
              <th className="border border-gray-400 p-2 text-left">Petugas</th>
            </tr>
          </thead>
          <tbody>
            {filteredRekapList.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                <td className="border border-gray-400 p-2">{item.tanggal}</td>
                <td className="border border-gray-400 p-2">{item.kantin}</td>
                <td className="border border-gray-400 p-2">{item.keterangan}</td>
                <td className="border border-gray-400 p-2 text-right font-mono">
                  {item.uang_masuk > 0 ? formatRupiah(item.uang_masuk) : "-"}
                </td>
                <td className="border border-gray-400 p-2 text-right font-mono">
                  {item.uang_keluar > 0 ? formatRupiah(item.uang_keluar) : "-"}
                </td>
                <td className="border border-gray-400 p-2">{item.petugas || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tanda Tangan */}
        <div className="mt-12 flex justify-between text-xs px-10">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-bold mt-16">Pengelola Kantin</p>
          </div>
          <div className="text-center">
            <p>Tasikmalaya, {new Date().toLocaleDateString("id-ID")}</p>
            <p className="font-bold mt-16">Bendahara Pondok</p>
          </div>
        </div>
      </div>
    </div>
  );
}
