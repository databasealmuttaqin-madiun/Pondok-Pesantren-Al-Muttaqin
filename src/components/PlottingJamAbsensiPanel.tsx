import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Clock, 
  QrCode, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Download, 
  Printer, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Info,
  Sliders,
  Sparkles,
  ChevronRight,
  Sun,
  Copy
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

const MySwal = withReactContent(Swal);

export interface JamAbsensiItem {
  id: string;
  hari: string;
  jam_masuk: string;
  toleransi_menit: number;
  jam_pulang: string;
  is_aktif: boolean;
  keterangan?: string;
  created_at?: string;
}

export const DEFAULT_JAM_ABSENSI: JamAbsensiItem[] = [
  { id: "1", hari: "Senin", jam_masuk: "07:00", toleransi_menit: 15, jam_pulang: "14:00", is_aktif: true, keterangan: "Apel Pagi & KBM Reguler" },
  { id: "2", hari: "Selasa", jam_masuk: "07:00", toleransi_menit: 15, jam_pulang: "14:00", is_aktif: true, keterangan: "KBM Reguler" },
  { id: "3", hari: "Rabu", jam_masuk: "07:00", toleransi_menit: 15, jam_pulang: "14:00", is_aktif: true, keterangan: "KBM Reguler" },
  { id: "4", hari: "Kamis", jam_masuk: "07:00", toleransi_menit: 15, jam_pulang: "14:00", is_aktif: true, keterangan: "KBM Reguler" },
  { id: "5", hari: "Jumat", jam_masuk: "07:00", toleransi_menit: 15, jam_pulang: "11:30", is_aktif: true, keterangan: "KBM Singkat & Sholat Jumat" },
  { id: "6", hari: "Sabtu", jam_masuk: "07:00", toleransi_menit: 15, jam_pulang: "13:00", is_aktif: true, keterangan: "Ekstrakurikuler & Pembinaan" },
  { id: "7", hari: "Ahad", jam_masuk: "07:00", toleransi_menit: 15, jam_pulang: "12:00", is_aktif: false, keterangan: "Hari Libur Mingguan" }
];

export const HARI_OPTIONS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Ahad"
];

const LOCAL_STORAGE_KEY = "plotting_jam_absensi_data";
const QR_TOKEN_DEFAULT = "ALMUTTAQIN_PRESENSI_STATION_PRIMARY";

export default function PlottingJamAbsensiPanel() {
  const [items, setItems] = useState<JamAbsensiItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_JAM_ABSENSI;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal QR Code State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrToken, setQrToken] = useState(QR_TOKEN_DEFAULT);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // Modal Form State (Tambah / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<JamAbsensiItem | null>(null);
  
  // Form input fields
  const [formHari, setFormHari] = useState("Senin");
  const [formJamMasuk, setFormJamMasuk] = useState("07:00");
  const [formToleransi, setFormToleransi] = useState<number>(15);
  const [formJamPulang, setFormJamPulang] = useState("14:00");
  const [formIsAktif, setFormIsAktif] = useState(true);
  const [formKeterangan, setFormKeterangan] = useState("");

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Fetch from Supabase
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("plotting_jam_absensi")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        // Fallback gracefully to localStorage or default
        console.warn("Info: tabel plotting_jam_absensi menggunakan local cache:", error.message);
      } else if (data && data.length > 0) {
        const mapped: JamAbsensiItem[] = data.map((d: any) => ({
          id: String(d.id),
          hari: d.hari || "Senin",
          jam_masuk: d.jam_masuk || "07:00",
          toleransi_menit: Number(d.toleransi_menit ?? 15),
          jam_pulang: d.jam_pulang || "14:00",
          is_aktif: d.is_aktif !== false,
          keterangan: d.keterangan || "",
          created_at: d.created_at
        }));
        
        // Urutkan sesuai urutan hari standar
        const sorted = [...mapped].sort((a, b) => {
          const idxA = HARI_OPTIONS.indexOf(a.hari);
          const idxB = HARI_OPTIONS.indexOf(b.hari);
          return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        });

        setItems(sorted);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));
      }
    } catch (err: any) {
      console.warn("Gagal membaca plotting_jam_absensi:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save changes to localStorage and Supabase
  const persistItems = async (newItems: JamAbsensiItem[]) => {
    // Sort items logically by day
    const sorted = [...newItems].sort((a, b) => {
      const idxA = HARI_OPTIONS.indexOf(a.hari);
      const idxB = HARI_OPTIONS.indexOf(b.hari);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    setItems(sorted);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));

    // Also update absensi settings cache for seamless integration with Presensi Guru
    try {
      const jadwalHarianObj: Record<string, any> = {};
      sorted.forEach(item => {
        jadwalHarianObj[item.hari] = {
          jam_masuk: item.jam_masuk,
          toleransi_menit: item.toleransi_menit,
          jam_pulang: item.jam_pulang,
          is_aktif: item.is_aktif,
          keterangan: item.keterangan || ""
        };
      });
      localStorage.setItem("pengaturan_absensi_guru", JSON.stringify({
        jadwal_harian: jadwalHarianObj,
        last_updated: new Date().toISOString()
      }));
    } catch {}

    return sorted;
  };

  // Open Form for Create
  const handleOpenCreate = () => {
    setEditingItem(null);
    // Cari hari pertama yang belum ada di daftar
    const usedDays = items.map(i => i.hari);
    const firstUnusedDay = HARI_OPTIONS.find(h => !usedDays.includes(h)) || "Senin";
    
    setFormHari(firstUnusedDay);
    setFormJamMasuk("07:00");
    setFormToleransi(15);
    setFormJamPulang("14:00");
    setFormIsAktif(true);
    setFormKeterangan("");
    setIsFormModalOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (item: JamAbsensiItem) => {
    setEditingItem(item);
    setFormHari(item.hari);
    setFormJamMasuk(item.jam_masuk || "07:00");
    setFormToleransi(item.toleransi_menit ?? 15);
    setFormJamPulang(item.jam_pulang || "14:00");
    setFormIsAktif(item.is_aktif !== false);
    setFormKeterangan(item.keterangan || "");
    setIsFormModalOpen(true);
  };

  // Submit Form (Create / Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHari) {
      showFeedback("error", "Harap pilih hari terlebih dahulu");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        // UPDATE
        const updatedItem: JamAbsensiItem = {
          ...editingItem,
          hari: formHari,
          jam_masuk: formJamMasuk,
          toleransi_menit: Number(formToleransi),
          jam_pulang: formJamPulang,
          is_aktif: formIsAktif,
          keterangan: formKeterangan
        };

        const newItems = items.map(i => i.id === editingItem.id ? updatedItem : i);
        await persistItems(newItems);

        // Try supabase update
        try {
          await supabase
            .from("plotting_jam_absensi")
            .update({
              hari: formHari,
              jam_masuk: formJamMasuk,
              toleransi_menit: Number(formToleransi),
              jam_pulang: formJamPulang,
              is_aktif: formIsAktif,
              keterangan: formKeterangan
            })
            .eq("id", editingItem.id);
        } catch {}

        showFeedback("success", `Jadwal absensi hari ${formHari} berhasil diperbarui`);
      } else {
        // CREATE
        const newId = Date.now().toString();
        const newItem: JamAbsensiItem = {
          id: newId,
          hari: formHari,
          jam_masuk: formJamMasuk,
          toleransi_menit: Number(formToleransi),
          jam_pulang: formJamPulang,
          is_aktif: formIsAktif,
          keterangan: formKeterangan,
          created_at: new Date().toISOString()
        };

        const newItems = [...items.filter(i => i.hari !== formHari), newItem];
        await persistItems(newItems);

        // Try supabase insert
        try {
          await supabase
            .from("plotting_jam_absensi")
            .insert({
              hari: formHari,
              jam_masuk: formJamMasuk,
              toleransi_menit: Number(formToleransi),
              jam_pulang: formJamPulang,
              is_aktif: formIsAktif,
              keterangan: formKeterangan
            });
        } catch {}

        showFeedback("success", `Jadwal absensi hari ${formHari} berhasil dibuat`);
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      showFeedback("error", `Gagal menyimpan jadwal: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Item
  const handleDelete = async (item: JamAbsensiItem) => {
    const result = await MySwal.fire({
      title: `<span class="text-lg font-bold text-slate-900">Hapus Jam Absensi ${item.hari}?</span>`,
      html: `<p class="text-sm text-slate-600">Pengaturan jadwal masuk dan pulang untuk hari <b>${item.hari}</b> akan dihapus dari sistem.</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      reverseButtons: true,
      customClass: {
        popup: "rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800"
      }
    });

    if (result.isConfirmed) {
      try {
        const newItems = items.filter(i => i.id !== item.id);
        await persistItems(newItems);

        // Try supabase delete
        try {
          await supabase
            .from("plotting_jam_absensi")
            .delete()
            .eq("id", item.id);
        } catch {}

        showFeedback("success", `Jadwal absensi hari ${item.hari} telah dihapus`);
      } catch (err: any) {
        showFeedback("error", `Gagal menghapus data: ${err.message}`);
      }
    }
  };

  // Download QR Code as PNG
  const handleDownloadQrPng = () => {
    try {
      const canvas = qrCanvasRef.current?.querySelector("canvas");
      if (!canvas) {
        showFeedback("error", "Elemen QR Code belum siap untuk diunduh");
        return;
      }
      
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR_Presensi_Sekolah_AlMuttaqin.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      showFeedback("success", "Gambar QR Code berhasil diunduh (.PNG)");
    } catch (err: any) {
      showFeedback("error", "Gagal mengunduh gambar QR Code");
    }
  };

  // Print QR Sheet / Board
  const handlePrintQr = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showFeedback("error", "Pop-up printer diblokir browser, mohon izinkan pop-up");
      return;
    }

    const canvas = qrCanvasRef.current?.querySelector("canvas");
    const qrDataUrl = canvas ? canvas.toDataURL("image/png") : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Papan QR Presensi Guru - SMP IT Al-Muttaqin</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              text-align: center;
              box-sizing: border-box;
            }
            .poster-box {
              border: 3px solid #1e293b;
              border-radius: 20px;
              padding: 30px;
              max-width: 520px;
              width: 100%;
              background: #ffffff;
            }
            .header-title {
              font-size: 22px;
              font-weight: 800;
              margin: 0 0 4px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .sub-title {
              font-size: 14px;
              color: #64748b;
              margin: 0 0 20px 0;
              font-weight: 600;
            }
            .qr-image-wrapper {
              background: #f8fafc;
              border: 2px dashed #cbd5e1;
              border-radius: 16px;
              padding: 20px;
              display: inline-block;
              margin-bottom: 20px;
            }
            .qr-image {
              width: 240px;
              height: 240px;
              display: block;
            }
            .badge {
              display: inline-block;
              background: #ecfdf5;
              color: #065f46;
              border: 1px solid #a7f3d0;
              font-weight: 700;
              font-size: 12px;
              padding: 4px 12px;
              border-radius: 9999px;
              margin-bottom: 12px;
            }
            .instructions {
              font-size: 13px;
              color: #475569;
              line-height: 1.6;
              margin: 0;
            }
            .footer-note {
              margin-top: 24px;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="poster-box">
            <h1 class="header-title">STASIUN PRESENSI GURU</h1>
            <p class="sub-title">SMP IT & PONDOK PESANTREN AL-MUTTAQIN</p>
            
            <div class="qr-image-wrapper">
              <img src="${qrDataUrl}" alt="QR Code Presensi" class="qr-image" />
            </div>

            <div>
              <span class="badge">📍 Radius GPS Terikat: 50 Meter</span>
            </div>

            <p class="instructions">
              Buka menu <b>Presensi Guru</b> pada aplikasi Al-Muttaqin, lalu arahkan kamera HP Anda ke Kode QR ini untuk melakukan presensi Masuk / Pulang.
            </p>

            <div class="footer-note">
              ID Token: ${qrToken} • Dicetak otomatis dari Panel Plotting Sekolah
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Filtered table items
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => 
      item.hari.toLowerCase().includes(q) ||
      item.jam_masuk.toLowerCase().includes(q) ||
      item.jam_pulang.toLowerCase().includes(q) ||
      (item.keterangan && item.keterangan.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 select-none animate-in fade-in duration-200" id="plotting-jam-absensi-root">
      
      {/* 1. HEADER & TOMBOL AKSI ATAS */}
      <PageHeader
        category="Plotting Sekolah"
        title="Plotting Jam Absensi Guru"
        description="Kelola jam masuk, toleransi keterlambatan, dan jam kepulangan guru per hari kerja."
        actionButton={
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            {/* Tombol 1: Aksi QR Code (Outline/Secondary) */}
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all shadow-xs cursor-pointer active:scale-95"
              title="Tampilkan & Cetak Kode QR Stasiun Presensi"
            >
              <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Kode QR</span>
            </button>

            {/* Tombol 2: Aksi Tambah (Solid Primary) */}
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
              title="Buat Pengaturan Jam Absensi Baru"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Jam Absensi</span>
            </button>
          </div>
        }
      />

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between transition-all ${
          feedback.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
            : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. TABEL UTAMA - JAM ABSENSI PER HARI (MINIMALIS & MONOKROM) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Area Atas Tabel: Bar Pencarian / Filter Mini & Segarkan */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari hari atau jam..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
              title="Segarkan data dari database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : "text-slate-400"}`} />
              <span>{isLoading ? "Memuat..." : "Segarkan"}</span>
            </button>
          </div>
        </div>

        {/* Tabel Data Minimalis & Bersih */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-6 w-16 text-center">No</th>
                <th className="py-3.5 px-6">Hari</th>
                <th className="py-3.5 px-6">Jam Masuk</th>
                <th className="py-3.5 px-6">Toleransi Telat</th>
                <th className="py-3.5 px-6">Jam Pulang</th>
                <th className="py-3.5 px-6 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium">Tidak ada data jadwal absensi yang ditemukan</p>
                      <button
                        onClick={handleOpenCreate}
                        className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                      >
                        + Buat Jadwal Baru
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  return (
                    <tr 
                      key={item.id || index}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Kolom 1 (NO): Teks biasa font-medium text-slate-400 */}
                      <td className="py-4 px-6 text-center font-medium text-slate-400 text-xs sm:text-sm">
                        {index + 1}
                      </td>

                      {/* Kolom 2 (HARI): Teks nama hari polos font-semibold text-slate-800 */}
                      <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-100">
                        {item.hari}
                      </td>

                      {/* Kolom 3 (JAM MASUK): Teks polos biasa font-medium text-slate-700 */}
                      <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300">
                        {item.jam_masuk || "07:00"} WIB
                      </td>

                      {/* Kolom 4 (TOLERANSI TELAT): Teks polos biasa font-medium text-slate-700 */}
                      <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300">
                        {item.toleransi_menit ?? 15} Menit
                      </td>

                      {/* Kolom 5 (JAM PULANG): Teks polos biasa font-medium text-slate-700 */}
                      <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300">
                        {item.jam_pulang || "14:00"} WIB
                      </td>

                      {/* Kolom 6 (AKSI): Icon minimalis Edit & Hapus */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Icon Edit Pensil (Warna Biru) */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                            title={`Edit jam absensi hari ${item.hari}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Icon Hapus Tong Sampah (Warna Merah) */}
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                            title={`Hapus jam absensi hari ${item.hari}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info box */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            <span>Jadwal yang tersimpan otomatis menjadi acuan batas kehadiran pada modul Presensi Guru.</span>
          </div>
          <span className="font-semibold text-slate-600 dark:text-slate-400">{items.length} Hari Terdaftar</span>
        </div>
      </div>

      {/* 3. MODAL POP-UP KODE QR */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full mx-auto shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <QrCode className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Kode QR Presensi Sekolah</h3>
                  <p className="text-[11px] text-slate-400">SMP IT & Pondok Pesantren Al-Muttaqin</p>
                </div>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten Modal */}
            <div className="flex flex-col items-center text-center space-y-4 pt-1">
              
              {/* Display Render QR Code menggunakan qrcode.react (Size: 220x220px) */}
              <div 
                ref={qrCanvasRef}
                className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-inner flex items-center justify-center"
              >
                <QRCodeCanvas
                  value={qrToken}
                  size={220}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>

              {/* Token String QR */}
              <div className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-left">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Token String QR</div>
                <div className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                  {qrToken}
                </div>
              </div>

              {/* Keterangan Singkat & Status GPS Terikat */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Titik Radius Sekolah: 50 Meter</span>
                </div>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                  Cetak Kode QR ini dan tempelkan di dinding kantor/piket sekolah untuk di-scan oleh guru.
                </p>
              </div>
            </div>

            {/* Footer Modal / Tombol Aksi */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              {/* Tombol Utama: Unduh PNG */}
              <button
                onClick={handleDownloadQrPng}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Gambar QR (.PNG)</span>
              </button>

              {/* Tombol Sekunder: Cetak PDF/Print */}
              <button
                onClick={handlePrintQr}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Papan QR</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. MODAL POP-UP FORM "+ BUAT JAM ABSENSI" */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full mx-auto shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal Form */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Clock className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingItem ? `Edit Jam Absensi (${editingItem.hari})` : "Buat Jam Absensi Baru"}
                  </h3>
                  <p className="text-[11px] text-slate-400">Atur jam operasional presensi guru per hari</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Tutup Form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Inputs */}
            <form onSubmit={handleSubmitForm} className="space-y-4">
              
              {/* 1. Pilih Hari */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pilih Hari <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formHari}
                  onChange={(e) => setFormHari(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  required
                >
                  {HARI_OPTIONS.map((hari) => (
                    <option key={hari} value={hari}>
                      {hari}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2 & 3. Jam Masuk & Toleransi Telat (Grid 2 Kolom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Jam Masuk */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Jam Masuk <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={formJamMasuk}
                      onChange={(e) => setFormJamMasuk(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">Format 24 Jam (misal 07:00)</span>
                </div>

                {/* Toleransi Telat */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Toleransi Telat (Menit) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={formToleransi}
                      onChange={(e) => setFormToleransi(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Batas telat: {calculateLateLimit(formJamMasuk, formToleransi)} WIB
                  </span>
                </div>
              </div>

              {/* 4. Jam Pulang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Jam Pulang <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={formJamPulang}
                    onChange={(e) => setFormJamPulang(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400">Presensi pulang dibuka mulai waktu ini</span>
              </div>

              {/* 5. Keterangan / Aktivitas */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Keterangan Aktivitas (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: KBM Reguler, Sholat Jumat, dll"
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* 6. Status Hari Aktif Switch */}
              <div className="pt-1 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Status Hari Aktif</div>
                  <div className="text-[11px] text-slate-400">Jika nonaktif, hari ini dianggap hari libur presensi</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsAktif}
                    onChange={(e) => setFormIsAktif(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Form Buttons: Batal & Simpan */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Jam Absensi"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

// Helper untuk menghitung jam batas toleransi keterlambatan
function calculateLateLimit(jamMasuk: string = "07:00", toleransiMenit: number = 15): string {
  try {
    const [hStr, mStr] = jamMasuk.split(":");
    let h = parseInt(hStr, 10) || 7;
    let m = (parseInt(mStr, 10) || 0) + toleransiMenit;
    
    h += Math.floor(m / 60);
    m = m % 60;
    
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } catch {
    return jamMasuk;
  }
}
