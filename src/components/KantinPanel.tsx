import React, { useState, useEffect, useRef, useMemo } from "react";
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
  ChevronRight,
  Download,
  Loader2,
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

const DEFAULT_KANTIN_LIST = ["kantin pondok", "kantin rusun"];

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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return DEFAULT_KANTIN_LIST;
    } catch {
      return DEFAULT_KANTIN_LIST;
    }
  });

  const allowedKantins: string[] = useMemo(() => {
    const isSuperOrAdmin = !currentUser || currentUser.role === 'super admin' || currentUser.role === 'admin' || currentUser.role === 'superadmin';
    if (isSuperOrAdmin) {
      return kantinList;
    }

    const assigned: string[] = [];
    const rawTugas = currentUser.tugas_tambahan;
    const tugasList: string[] = Array.isArray(rawTugas) ? rawTugas : (rawTugas ? [String(rawTugas)] : []);

    // 1. Match from tugas_tambahan
    tugasList.forEach((t) => {
      const tLower = String(t).toLowerCase().trim();
      const match = kantinList.find(k => k.toLowerCase().trim() === tLower);
      if (match && !assigned.includes(match)) {
        assigned.push(match);
      } else if (tLower.includes("kantin") && !assigned.includes(t)) {
        assigned.push(t);
      }
    });

    // 2. Match from tugas_kantin
    if (assigned.length === 0 && currentUser.tugas_kantin && currentUser.tugas_kantin !== "Semua") {
      const match = kantinList.find(k => k.toLowerCase().trim() === currentUser.tugas_kantin.toLowerCase().trim());
      assigned.push(match || currentUser.tugas_kantin);
    }

    // 3. Match from username or role (e.g. kantin.pondok -> kantin pondok)
    if (assigned.length === 0) {
      const uStr = `${currentUser.username || ""} ${currentUser.name || ""} ${currentUser.role || ""}`.toLowerCase();
      if (uStr.includes("pondok")) {
        const match = kantinList.find(k => k.toLowerCase().includes("pondok"));
        assigned.push(match || "kantin pondok");
      } else if (uStr.includes("rusun")) {
        const match = kantinList.find(k => k.toLowerCase().includes("rusun"));
        assigned.push(match || "kantin rusun");
      }
    }

    return assigned.length > 0 ? assigned : kantinList;
  }, [currentUser, kantinList]);

  const isRestricted = allowedKantins.length < kantinList.length && allowedKantins.length > 0;

  const [selectedKantinInput, setSelectedKantinInput] = useState<string>(() => {
    return allowedKantins.length > 0 ? allowedKantins[0] : (kantinList[0] || "kantin pondok");
  });

  const [filterKantinRekap, setFilterKantinRekap] = useState<string>(() => {
    return allowedKantins.length === 1 ? allowedKantins[0] : "semua";
  });

  useEffect(() => {
    if (isRestricted) {
      if (!allowedKantins.includes(selectedKantinInput) && allowedKantins.length > 0) {
         setSelectedKantinInput(allowedKantins[0]);
      }
      if (filterKantinRekap !== "semua" && !allowedKantins.includes(filterKantinRekap)) {
         setFilterKantinRekap(allowedKantins.length === 1 ? allowedKantins[0] : "semua");
      }
    }
  }, [isRestricted, allowedKantins, selectedKantinInput, filterKantinRekap]);

  const fetchMasterKantin = async () => {
    try {
      const names: string[] = [...DEFAULT_KANTIN_LIST];
      
      // 1. Fetch from tugas_tambahan
      const { data: tugasData } = await supabase
        .from("tugas_tambahan")
        .select("nama, jenis_tugas_tambahan");
      if (tugasData) {
        tugasData
          .filter((t: any) => String(t.jenis_tugas_tambahan || "").toLowerCase() === "kantin" || String(t.nama || "").toLowerCase().includes("kantin"))
          .forEach((t: any) => {
            if (t.nama && !names.some(n => n.toLowerCase() === t.nama.toLowerCase())) {
              names.push(t.nama);
            }
          });
      }

      // 2. Fetch distinct from pembukuan_kantin
      const { data: pbData } = await supabase
        .from("pembukuan_kantin")
        .select("kantin");
      if (pbData) {
        pbData.forEach((p: any) => {
          if (p.kantin && !names.some(n => n.toLowerCase() === p.kantin.toLowerCase())) {
            names.push(p.kantin);
          }
        });
      }

      if (names.length > 0) {
        setKantinList(names);
        localStorage.setItem("master_kantin_list", JSON.stringify(names));
      }
    } catch (e) {
      console.error("Failed to fetch master kantin", e);
    }
  };

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
    fetchMasterKantin();
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
    const uangMasukNum = parseInt(uangMasukStr.replace(/\D/g, "") || "0", 10);
    const uangKeluarNum = parseInt(uangKeluarStr.replace(/\D/g, "") || "0", 10);
    
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
    if (isRestricted && !allowedKantins.map(k => k.toLowerCase().trim()).includes(String(item.kantin || "").toLowerCase().trim())) {
      return false;
    }
    if (filterKantinRekap !== "semua" && String(item.kantin || "").toLowerCase().trim() !== filterKantinRekap.toLowerCase().trim()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.tanggal.includes(q) && !item.keterangan.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const summaryTotals = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    filteredList.forEach((item) => {
      masuk += Number(item.uang_masuk) || 0;
      keluar += Number(item.uang_keluar) || 0;
    });
    const saldoAkhir = filteredList.length > 0 && filteredList[0].jumlah_kas !== undefined
      ? Number(filteredList[0].jumlah_kas)
      : (masuk - keluar);
    return { masuk, keluar, saldoAkhir, count: filteredList.length };
  }, [filteredList]);

  const handleExportPDF = async () => {
    if (filteredList.length === 0) {
      triggerNotification?.("Tidak ada data transaksi yang dapat dicetak.", "warning");
      return;
    }

    try {
      setIsExportingPDF(true);
      const jsPdfModule = await import("jspdf");
      const jsPDF = jsPdfModule.jsPDF || (jsPdfModule as any).default || jsPdfModule;
      
      const autoTableModule: any = await import("jspdf-autotable");
      const autoTable = autoTableModule.default || autoTableModule.autoTable || autoTableModule;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const kantinTitle = filterKantinRekap === "semua" 
        ? "SEMUA KANTIN" 
        : filterKantinRekap.toUpperCase();

      const { masuk: totalUangMasuk, keluar: totalUangKeluar, saldoAkhir } = summaryTotals;

      // Header Judul Laporan
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text("LAPORAN REKAPITULASI PEMBUKUAN KAS KANTIN", 105, 16, { align: "center" });

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text(`Unit: ${kantinTitle}`, 105, 22, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // Slate-500
      const printDateStr = new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      doc.text(`Waktu Cetak: ${printDateStr} WIB`, 14, 30);
      doc.text(`Petugas: ${currentUser?.name || currentUser?.username || "Petugas Kasir"}`, 196, 30, { align: "right" });

      // Garis pemisah header
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(14, 33, 196, 33);

      // Kartu Ringkasan Keuangan
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 36, 182, 17, 2, 2, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 36, 182, 17, 2, 2, "S");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("TOTAL UANG MASUK", 20, 42);
      doc.text("TOTAL UANG KELUAR", 82, 42);
      doc.text("SALDO KAS SAAT INI", 144, 42);

      doc.setFontSize(9.5);
      doc.setTextColor(16, 185, 129); // Emerald-600
      doc.text(formatRupiah(totalUangMasuk), 20, 49);

      doc.setTextColor(225, 29, 72); // Rose-600
      doc.text(formatRupiah(totalUangKeluar), 82, 49);

      doc.setTextColor(37, 99, 235); // Blue-600
      doc.text(formatRupiah(saldoAkhir), 144, 49);

      // Table data
      const tableHead = [
        ["No", "Tanggal", "Kantin", "Uang Masuk", "Uang Keluar", "Saldo Kas", "Keterangan", "Petugas"]
      ];

      const tableBody = filteredList.map((item, index) => [
        index + 1,
        item.tanggal || "-",
        item.kantin || "-",
        item.uang_masuk > 0 ? formatRupiah(item.uang_masuk) : "-",
        item.uang_keluar > 0 ? formatRupiah(item.uang_keluar) : "-",
        formatRupiah(item.jumlah_kas || 0),
        item.keterangan || "-",
        item.petugas || "-"
      ]);

      // Row footer total
      const tableFoot: any[] = [
        [
          { content: "TOTAL", colSpan: 3, styles: { halign: "center", fontStyle: "bold" } },
          { content: formatRupiah(totalUangMasuk), styles: { halign: "right", fontStyle: "bold", textColor: [16, 185, 129] } },
          { content: formatRupiah(totalUangKeluar), styles: { halign: "right", fontStyle: "bold", textColor: [225, 29, 72] } },
          { content: formatRupiah(saldoAkhir), styles: { halign: "right", fontStyle: "bold", textColor: [37, 99, 235] } },
          { content: `${filteredList.length} Transaksi`, colSpan: 2, styles: { halign: "center", fontStyle: "italic", textColor: [100, 116, 139] } }
        ]
      ];

      const tableOptions = {
        startY: 57,
        head: tableHead,
        body: tableBody,
        foot: tableFoot,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2.2,
          valign: "middle",
          textColor: [51, 65, 85]
        },
        headStyles: {
          fillColor: [30, 41, 59], // Slate-800
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center"
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [30, 41, 59],
          fontStyle: "bold",
          fontSize: 8
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 9 },
          1: { halign: "center", cellWidth: 20 },
          2: { halign: "left", cellWidth: 26 },
          3: { halign: "right", cellWidth: 25, textColor: [16, 185, 129] },
          4: { halign: "right", cellWidth: 25, textColor: [225, 29, 72] },
          5: { halign: "right", cellWidth: 25, textColor: [37, 99, 235], fontStyle: "bold" },
          6: { halign: "left" },
          7: { halign: "left", cellWidth: 22 }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 14, right: 14, bottom: 20 },
        didDrawPage: (data: any) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Halaman ${data.pageNumber} dari ${pageCount}`,
            105,
            doc.internal.pageSize.height - 8,
            { align: "center" }
          );
        }
      };

      if (typeof (doc as any).autoTable === "function") {
        (doc as any).autoTable(tableOptions);
      } else if (typeof autoTable === "function") {
        autoTable(doc, tableOptions);
      } else {
        throw new Error("Pustaka autoTable tidak dapat dijalankan.");
      }

      // Signature area
      const finalY = (doc as any).lastAutoTable?.finalY || 160;
      const pageHeight = doc.internal.pageSize.height;
      let signY = finalY + 10;

      if (signY + 35 > pageHeight - 15) {
        doc.addPage();
        signY = 20;
      }

      const todayStr = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      // Signature right column
      doc.text(`Tasikmalaya, ${todayStr}`, 145, signY);
      doc.text("Petugas Kasir Kantin,", 145, signY + 4.5);
      doc.line(145, signY + 22, 185, signY + 22);
      doc.setFont("helvetica", "bold");
      doc.text(currentUser?.name || currentUser?.username || "Petugas Kasir", 145, signY + 26);

      // Signature left column
      doc.setFont("helvetica", "normal");
      doc.text("Mengetahui,", 25, signY + 4.5);
      doc.text("Pengurus / Penanggung Jawab,", 25, signY + 9);
      doc.line(25, signY + 22, 75, signY + 22);
      doc.setFont("helvetica", "bold");
      doc.text("( .................................... )", 25, signY + 26);

      const cleanKantinName = (filterKantinRekap || "semua").replace(/\s+/g, "_").toLowerCase();
      const filename = `Rekap_Kas_Kantin_${cleanKantinName}_${new Date().toISOString().slice(0, 10)}.pdf`;

      // Gunakan trigger download blob langsung untuk reliabilitas tinggi di iframe
      try {
        const blob = doc.output("blob");
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          try {
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
          } catch {}
        }, 3000);
      } catch (blobErr) {
        console.warn("Direct blob download fallback to doc.save:", blobErr);
        doc.save(filename);
      }

      triggerNotification?.("Dokumen PDF rekap kas kantin berhasil diunduh.", "success");
    } catch (err: any) {
      console.error("Gagal cetak PDF kantin:", err);
      triggerNotification?.(
        err?.message || "Gagal mencetak dokumen PDF. Silakan gunakan tombol Cetak Browser sebagai alternatif.",
        "error"
      );
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* HEADER & TABS */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Manajemen Kantin</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-blue-600 dark:text-blue-400">
              {viewMode === "input" ? "Input Rekap" : "Tabel Riwayat"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Rekap Kas Kantin
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTransaksiFromCloud}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-slate-200 dark:border-slate-700/50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
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
                  {allowedKantins.map((kName) => (
                    <button
                      key={kName}
                      type="button"
                      onClick={() => setSelectedKantinInput(kName)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between ${
                        selectedKantinInput === kName
                          ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-2xs"
                          : "bg-slate-50 border-slate-200 dark:border-slate-700/60 text-slate-700"
                      }`}
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
                        const raw = e.target.value.replace(/\D/g, "");
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
                        const raw = e.target.value.replace(/\D/g, "");
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
                disabled={isRestricted && allowedKantins.length === 1}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none"
              >
                {(!isRestricted || allowedKantins.length > 1) && <option value="semua">Semua Kantin</option>}
                {allowedKantins.map((kName) => (
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
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPDF}
                disabled={isExportingPDF || filteredList.length === 0}
                className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
                title="Unduh dokumen PDF Resmi Rekap Kas Kantin"
                id="btn-download-pdf-kantin"
              >
                {isExportingPDF ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membuat PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBrowserPrint}
                disabled={filteredList.length === 0}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-800 dark:bg-slate-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 transition-all cursor-pointer"
                title="Cetak langsung menggunakan printer / dialog cetak browser"
                id="btn-print-browser-kantin"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Print</span>
              </button>
            </div>
          </div>

          {/* Ringkasan Cepat */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Total Masuk</span>
              <span className="font-bold text-emerald-600">{formatRupiah(summaryTotals.masuk)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Total Keluar</span>
              <span className="font-bold text-rose-600">{formatRupiah(summaryTotals.keluar)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Saldo Kas</span>
              <span className="font-bold text-blue-600">{formatRupiah(summaryTotals.saldoAkhir)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Jumlah Data</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{summaryTotals.count} Catatan</span>
            </div>
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
                      {item.uang_masuk > 0 ? `+${formatRupiah(item.uang_masuk)}` : "-"}
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-rose-600 text-right whitespace-nowrap">
                      {item.uang_keluar > 0 ? `-${formatRupiah(item.uang_keluar)}` : "-"}
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
                        className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
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
              {filteredList.length > 0 && (
                <tfoot className="bg-slate-50/80 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700 text-xs">
                  <tr>
                    <td colSpan={2} className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      Total ({filteredList.length} Transaksi)
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 whitespace-nowrap">
                      {formatRupiah(summaryTotals.masuk)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 whitespace-nowrap">
                      {formatRupiah(summaryTotals.keluar)}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-600 whitespace-nowrap">
                      {formatRupiah(summaryTotals.saldoAkhir)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
