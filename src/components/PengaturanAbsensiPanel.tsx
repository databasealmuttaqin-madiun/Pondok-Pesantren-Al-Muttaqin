import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Clock, 
  MapPin, 
  QrCode, 
  Download, 
  Printer, 
  Save, 
  RefreshCw, 
  Copy, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Compass, 
  CheckCircle2, 
  Sliders, 
  Sparkles,
  ExternalLink,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  Sun,
  Moon,
  RotateCcw
} from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

const MySwal = withReactContent(Swal);

export type DayName = "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu" | "Ahad";

export interface JadwalHari {
  hari: DayName;
  aktif: boolean;
  jam_masuk: string;
  toleransi_terlambat: number;
  jam_pulang: string;
  keterangan: string;
}

export interface PengaturanAbsensiData {
  id?: string | number;
  jam_masuk: string;
  toleransi_terlambat: number;
  jam_pulang: string;
  radius_gps: number;
  latitude: number;
  longitude: number;
  qr_token: string;
  nama_sekolah?: string;
  alamat_pos?: string;
  jadwal_harian?: JadwalHari[];
  updated_at?: string;
}

export const DEFAULT_JADWAL_HARIAN: JadwalHari[] = [
  { hari: "Senin", aktif: true, jam_masuk: "06:45", toleransi_terlambat: 15, jam_pulang: "14:00", keterangan: "Apel Pagi & KBM Reguler" },
  { hari: "Selasa", aktif: true, jam_masuk: "07:00", toleransi_terlambat: 15, jam_pulang: "14:00", keterangan: "KBM Penuh Reguler" },
  { hari: "Rabu", aktif: true, jam_masuk: "07:00", toleransi_terlambat: 15, jam_pulang: "14:00", keterangan: "KBM Penuh Reguler" },
  { hari: "Kamis", aktif: true, jam_masuk: "07:00", toleransi_terlambat: 15, jam_pulang: "14:00", keterangan: "KBM & Kajian Sore" },
  { hari: "Jumat", aktif: true, jam_masuk: "07:00", toleransi_terlambat: 15, jam_pulang: "11:30", keterangan: "KBM Singkat & Sholat Jumat" },
  { hari: "Sabtu", aktif: true, jam_masuk: "07:00", toleransi_terlambat: 15, jam_pulang: "12:30", keterangan: "KBM & Ekstrakurikuler" },
  { hari: "Ahad", aktif: false, jam_masuk: "07:00", toleransi_terlambat: 15, jam_pulang: "14:00", keterangan: "Hari Libur Mingguan" }
];

const DEFAULT_PENGATURAN: PengaturanAbsensiData = {
  jam_masuk: "07:00",
  toleransi_terlambat: 15,
  jam_pulang: "14:00",
  radius_gps: 50,
  latitude: -7.629810,
  longitude: 111.523910,
  qr_token: "ALMUTTAQIN_PRESENSI_STATION_PRIMARY",
  nama_sekolah: "SMP IT Al-Muttaqin",
  alamat_pos: "Stasiun Piket & Kantor Utama Yayasan Pondok Pesantren Al-Muttaqin",
  jadwal_harian: DEFAULT_JADWAL_HARIAN
};

const STORAGE_KEY = "pengaturan_absensi";

export const DAY_NAMES_ORDER: DayName[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Ahad"];

export default function PengaturanAbsensiPanel() {
  const [formData, setFormData] = useState<PengaturanAbsensiData>(DEFAULT_PENGATURAN);
  const [selectedDayTab, setSelectedDayTab] = useState<DayName>("Senin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Determine current day of week (WIB)
  const currentDayName = useMemo<DayName>(() => {
    const dayIdx = new Date().getDay(); // 0 = Ahad, 1 = Senin, ...
    const mapping: DayName[] = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return mapping[dayIdx] || "Senin";
  }, []);

  // Initialize selected tab with current day on first load
  useEffect(() => {
    setSelectedDayTab(currentDayName);
  }, [currentDayName]);

  // Load existing settings from Supabase / localStorage on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    let loadedData: PengaturanAbsensiData = { ...DEFAULT_PENGATURAN };

    // 1. Try to load cached local settings first
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        loadedData = { 
          ...loadedData, 
          ...parsed,
          jadwal_harian: parsed.jadwal_harian && Array.isArray(parsed.jadwal_harian) && parsed.jadwal_harian.length === 7
            ? parsed.jadwal_harian
            : DEFAULT_JADWAL_HARIAN
        };
      }
    } catch (err) {
      console.warn("Gagal memuat cache pengaturan lokal:", err);
    }

    // 2. Try to fetch from Supabase
    try {
      const { data, error } = await supabase
        .from("pengaturan_absensi")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        let parsedJadwal = DEFAULT_JADWAL_HARIAN;
        if (data.jadwal_harian) {
          try {
            parsedJadwal = typeof data.jadwal_harian === "string" ? JSON.parse(data.jadwal_harian) : data.jadwal_harian;
          } catch {}
        } else if (loadedData.jadwal_harian) {
          parsedJadwal = loadedData.jadwal_harian;
        }

        loadedData = {
          ...loadedData,
          id: data.id,
          jam_masuk: data.jam_masuk || loadedData.jam_masuk,
          toleransi_terlambat: Number(data.toleransi_terlambat ?? loadedData.toleransi_terlambat),
          jam_pulang: data.jam_pulang || loadedData.jam_pulang,
          radius_gps: Number(data.radius_gps ?? loadedData.radius_gps),
          latitude: Number(data.latitude ?? loadedData.latitude),
          longitude: Number(data.longitude ?? loadedData.longitude),
          qr_token: data.qr_token || loadedData.qr_token,
          nama_sekolah: data.nama_sekolah || loadedData.nama_sekolah,
          alamat_pos: data.alamat_pos || loadedData.alamat_pos,
          jadwal_harian: parsedJadwal,
          updated_at: data.updated_at
        };
        // Update local storage cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedData));
      }
    } catch (err) {
      console.info("Info: Tabel pengaturan_absensi belum aktif di database, menggunakan penyimpanan lokal.", err);
    } finally {
      setFormData(loadedData);
      setLoading(false);
    }
  };

  // Helper to get day schedule for selected tab
  const currentDaySchedule = useMemo<JadwalHari>(() => {
    const list = formData.jadwal_harian || DEFAULT_JADWAL_HARIAN;
    const found = list.find(j => j.hari === selectedDayTab);
    return found || {
      hari: selectedDayTab,
      aktif: selectedDayTab !== "Ahad",
      jam_masuk: formData.jam_masuk || "07:00",
      toleransi_terlambat: formData.toleransi_terlambat || 15,
      jam_pulang: formData.jam_pulang || "14:00",
      keterangan: selectedDayTab === "Ahad" ? "Hari Libur" : "KBM Reguler"
    };
  }, [formData.jadwal_harian, selectedDayTab, formData.jam_masuk, formData.toleransi_terlambat, formData.jam_pulang]);

  const handleUpdateDaySchedule = (updatedField: Partial<JadwalHari>) => {
    setFormData(prev => {
      const existingList = prev.jadwal_harian || [...DEFAULT_JADWAL_HARIAN];
      const nextList = existingList.map(item => {
        if (item.hari === selectedDayTab) {
          return { ...item, ...updatedField };
        }
        return item;
      });
      return {
        ...prev,
        jadwal_harian: nextList
      };
    });
  };

  // Action: Salin Jam Hari Terpilih ke Seluruh Hari Kerja (Senin - Kamis & Sabtu)
  const handleCopyScheduleToWeekdays = () => {
    const source = currentDaySchedule;
    setFormData(prev => {
      const existingList = prev.jadwal_harian || [...DEFAULT_JADWAL_HARIAN];
      const nextList = existingList.map(item => {
        if (item.hari !== "Jumat" && item.hari !== "Ahad") {
          return {
            ...item,
            jam_masuk: source.jam_masuk,
            toleransi_terlambat: source.toleransi_terlambat,
            jam_pulang: source.jam_pulang,
            aktif: true
          };
        }
        return item;
      });
      return { ...prev, jadwal_harian: nextList };
    });

    MySwal.fire({
      icon: "success",
      title: "Jadwal Disalin",
      text: `Jam masuk (${source.jam_masuk}) & pulang (${source.jam_pulang}) berhasil diterapkan ke hari Senin, Selasa, Rabu, Kamis, dan Sabtu.`,
      timer: 2000,
      showConfirmButton: false
    });
  };

  // Action: Reset Jadwal ke Standar Al-Muttaqin
  const handleResetToDefaultSchedule = () => {
    MySwal.fire({
      title: "Reset Jadwal Harian?",
      text: "Jadwal absensi Senin-Ahad akan dikembalikan ke jam standar resmi SMP IT Al-Muttaqin.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Reset",
      cancelButtonText: "Batal"
    }).then((result) => {
      if (result.isConfirmed) {
        setFormData(prev => ({
          ...prev,
          jadwal_harian: [...DEFAULT_JADWAL_HARIAN]
        }));
        MySwal.fire({
          icon: "success",
          title: "Jadwal Direset",
          text: "Jadwal harian kembali ke standar Al-Muttaqin.",
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  // Helper: Ambil Koordinat Saat Ini dari Perangkat Admin
  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      MySwal.fire({
        icon: "warning",
        title: "GPS Tidak Didukung",
        text: "Peramban web ini tidak mendukung fitur Geolocation GPS.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    setFetchingGps(true);
    setFeedback({
      type: "info",
      message: "Sedang mendeteksi titik koordinat GPS presisi tinggi..."
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const acc = Math.round(position.coords.accuracy);

        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng
        }));
        setGpsAccuracy(acc);
        setFetchingGps(false);
        setFeedback({
          type: "success",
          message: `Koordinat GPS berhasil didapatkan! (Lat: ${lat}, Lng: ${lng}, Akurasi ±${acc}m)`
        });
      },
      (error) => {
        setFetchingGps(false);
        let errorMsg = "Gagal mendapatkan titik koordinat.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Izin akses lokasi (GPS) ditolak oleh browser. Silakan aktifkan izin lokasi di peramban Anda.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "Informasi lokasi tidak tersedia pada perangkat ini.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "Waktu pencarian koordinat GPS habis. Coba lagi di tempat terbuka.";
        }

        setFeedback({
          type: "error",
          message: errorMsg
        });

        MySwal.fire({
          icon: "error",
          title: "Akses GPS Gagal",
          text: errorMsg,
          confirmButtonColor: "#2563eb"
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Generate random fresh QR token
  const handleGenerateRandomToken = () => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newToken = `ALMUTTAQIN_PRESENSI_${randomHex}`;
    setFormData(prev => ({ ...prev, qr_token: newToken }));
    setFeedback({
      type: "info",
      message: `Token QR baru dibuat: ${newToken}. Jangan lupa klik "Simpan Pengaturan" agar berlaku!`
    });
  };

  // Copy token to clipboard
  const handleCopyToken = () => {
    if (!formData.qr_token) return;
    navigator.clipboard.writeText(formData.qr_token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Save Settings to Supabase + LocalStorage
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const activeList = formData.jadwal_harian && formData.jadwal_harian.length === 7
      ? formData.jadwal_harian
      : DEFAULT_JADWAL_HARIAN;

    const seninSchedule = activeList.find(j => j.hari === "Senin") || DEFAULT_JADWAL_HARIAN[0];

    const payload: PengaturanAbsensiData = {
      ...formData,
      jam_masuk: seninSchedule.jam_masuk,
      toleransi_terlambat: Number(seninSchedule.toleransi_terlambat) || 15,
      jam_pulang: seninSchedule.jam_pulang,
      radius_gps: Number(formData.radius_gps) || 50,
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      qr_token: formData.qr_token.trim() || DEFAULT_PENGATURAN.qr_token,
      nama_sekolah: formData.nama_sekolah?.trim() || DEFAULT_PENGATURAN.nama_sekolah,
      alamat_pos: formData.alamat_pos?.trim() || DEFAULT_PENGATURAN.alamat_pos,
      jadwal_harian: activeList,
      updated_at: new Date().toISOString()
    };

    // Save to local storage first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    let savedToCloud = false;

    // Try to upsert into Supabase table if it exists
    try {
      const { error } = await supabase
        .from("pengaturan_absensi")
        .upsert(
          {
            id: payload.id || 1,
            jam_masuk: payload.jam_masuk,
            toleransi_terlambat: payload.toleransi_terlambat,
            jam_pulang: payload.jam_pulang,
            radius_gps: payload.radius_gps,
            latitude: payload.latitude,
            longitude: payload.longitude,
            qr_token: payload.qr_token,
            nama_sekolah: payload.nama_sekolah,
            alamat_pos: payload.alamat_pos,
            jadwal_harian: payload.jadwal_harian,
            updated_at: payload.updated_at
          },
          { onConflict: "id" }
        );

      if (!error) {
        savedToCloud = true;
      }
    } catch (err) {
      console.warn("Catatan: Tidak dapat terhubung ke tabel pengaturan_absensi Supabase, disimpan di penyimpanan lokal browser.", err);
    }

    setSaving(false);
    setFormData(payload);

    MySwal.fire({
      icon: "success",
      title: "Pengaturan & Jadwal Harian Disimpan!",
      text: savedToCloud 
        ? "Konfigurasi jadwal absensi 7 hari, radius GPS, dan Kode QR telah tersinkronisasi ke server dan lokal."
        : "Konfigurasi jadwal absensi tersimpan di sistem lokal dan langsung aktif pada perangkat presensi guru.",
      confirmButtonColor: "#2563eb",
      timer: 2500
    });
  };

  // Download QR Code as high-res PNG image
  const handleDownloadQrPng = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) {
      MySwal.fire({
        icon: "error",
        title: "Gagal Mengunduh",
        text: "Kanvas QR Code belum siap untuk diunduh.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    // Create higher resolution canvas with frame and label
    const highResCanvas = document.createElement("canvas");
    const padding = 40;
    const qrSize = 400;
    highResCanvas.width = qrSize + padding * 2;
    highResCanvas.height = qrSize + padding * 2 + 100;

    const ctx = highResCanvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, highResCanvas.width, highResCanvas.height);

    // Border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, highResCanvas.width - 20, highResCanvas.height - 20);

    // Header Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STASIUN PRESENSI GURU", highResCanvas.width / 2, 50);

    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.fillText(formData.nama_sekolah || "Yayasan Pondok Pesantren Al-Muttaqin", highResCanvas.width / 2, 75);

    // Draw QR image
    ctx.drawImage(canvas, padding, 100, qrSize, qrSize);

    // Footer Info
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`TOKEN: ${formData.qr_token}`, highResCanvas.width / 2, highResCanvas.height - 45);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Radius Geofencing: Max ${formData.radius_gps} Meter dari Titik Pusat Sekolah`, highResCanvas.width / 2, highResCanvas.height - 22);

    const link = document.createElement("a");
    link.download = `QR_Presensi_${(formData.nama_sekolah || "Sekolah").replace(/\s+/g, "_")}.png`;
    link.href = highResCanvas.toDataURL("image/png");
    link.click();
  };

  // Open Print Modal for Physical Paper Printing
  const handlePrint = () => {
    setShowPrintModal(true);
  };

  if (loading) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Memuat konfigurasi absensi...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* 1. HEADER HALAMAN STANDAR */}
      <PageHeader 
        category="Plotting sekolah" 
        title="Manajemen Absensi Guru" 
        description="Atur jadwal presensi sesuai hari (Senin - Ahad), batas jam kerja, toleransi keterlambatan, koordinat radius lokasi, serta cetak Kode QR Presensi." 
      />

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed transition-all ${
          feedback.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200" 
            : feedback.type === "error"
            ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200"
            : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200"
        }`}>
          {feedback.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
          {feedback.type === "error" && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
          {feedback.type === "info" && <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
          <div className="flex-1 font-medium">{feedback.message}</div>
          <button 
            type="button" 
            onClick={() => setFeedback(null)} 
            className="text-slate-400 hover:text-slate-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* GRID 2 KOLOM: FORM PENGATURAN (LEFT) & GENERATOR QR (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================================= */}
        {/* SEKSI 1: FORM PENGATURAN JADWAL HARIAN & RADIUS GPS (LEFT CARD - 7 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Jadwal Presensi Sesuai Hari & Lokasi GPS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atur jam masuk, jam pulang, dan toleransi keterlambatan spesifik untuk masing-masing hari.
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* SUB-SEKSI 1: TABEL/PILIHAN HARI JADWAL HARIAN */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  1. Jadwal Presensi Guru Sesuai Hari
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefaultSchedule}
                    className="text-[11px] text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Kembalikan semua hari ke jadwal standar Al-Muttaqin"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Standar</span>
                  </button>
                </div>
              </div>

              {/* Day Selector Pill Buttons (Senin s/d Ahad) */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                {DAY_NAMES_ORDER.map(day => {
                  const dayItem = (formData.jadwal_harian || DEFAULT_JADWAL_HARIAN).find(j => j.hari === day);
                  const isSelected = selectedDayTab === day;
                  const isToday = currentDayName === day;
                  const isAktif = dayItem ? dayItem.aktif : day !== "Ahad";

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDayTab(day)}
                      className={`relative py-2 px-1 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        isSelected 
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700" 
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {day}
                        {isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" title="Hari Ini" />
                        )}
                      </span>
                      <span className={`text-[9px] font-semibold px-1 rounded ${
                        isAktif 
                          ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300" 
                          : "text-slate-400 bg-slate-200/60 dark:bg-slate-800"
                      }`}>
                        {isAktif ? (dayItem?.jam_masuk || "07:00") : "Libur"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Card Detail Pengaturan Hari yang Dipilih */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-white">
                      Hari {selectedDayTab}
                    </span>
                    {currentDayName === selectedDayTab && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  {/* Toggle Aktif / Libur */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {currentDaySchedule.aktif ? "Hari Aktif Presensi" : "Hari Libur (Tidak Ada Presensi)"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateDaySchedule({ aktif: !currentDaySchedule.aktif })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        currentDaySchedule.aktif ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          currentDaySchedule.aktif ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {currentDaySchedule.aktif ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* Jam Masuk */}
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          Jam Masuk {selectedDayTab}
                        </label>
                        <input
                          type="time"
                          required
                          value={currentDaySchedule.jam_masuk}
                          onChange={(e) => handleUpdateDaySchedule({ jam_masuk: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          {selectedDayTab === "Senin" ? "Misal: 06:45 untuk apel" : "Standar jam kehadiran"}
                        </p>
                      </div>

                      {/* Toleransi Terlambat */}
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          Toleransi Terlambat
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="120"
                            required
                            value={currentDaySchedule.toleransi_terlambat}
                            onChange={(e) => handleUpdateDaySchedule({ toleransi_terlambat: Number(e.target.value) || 0 })}
                            className="w-full pl-3 pr-12 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium pointer-events-none">
                            menit
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Batas aman sebelum terlambat</p>
                      </div>

                      {/* Jam Pulang */}
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          Jam Pulang {selectedDayTab}
                        </label>
                        <input
                          type="time"
                          required
                          value={currentDaySchedule.jam_pulang}
                          onChange={(e) => handleUpdateDaySchedule({ jam_pulang: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          {selectedDayTab === "Jumat" ? "Misal: 11:30 (Sholat Jumat)" : "Waktu minimal presensi pulang"}
                        </p>
                      </div>
                    </div>

                    {/* Keterangan Aktivitas Hari */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Keterangan Aktivitas Hari {selectedDayTab}
                      </label>
                      <input
                        type="text"
                        value={currentDaySchedule.keterangan || ""}
                        onChange={(e) => handleUpdateDaySchedule({ keterangan: e.target.value })}
                        placeholder="Contoh: KBM Penuh Reguler / Upacara & KBM / KBM & Sholat Jumat"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Action Helper: Salin ke Hari Kerja Lainnya */}
                    {selectedDayTab !== "Jumat" && selectedDayTab !== "Ahad" && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleCopyScheduleToWeekdays}
                          className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Terapkan jam {selectedDayTab} ke seluruh hari kerja (Senin-Kamis & Sabtu)</span>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-500">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Hari {selectedDayTab} ditandai sebagai Hari Libur.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Guru tidak diwajibkan melakukan presensi pada hari ini.</p>
                  </div>
                )}
              </div>
            </div>

            {/* SUB-SEKSI 2: RADIUS GEOFENCING & KOORDINAT */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-3">
                2. Geofencing GPS & Titik Koordinat Sekolah
              </label>

              {/* Batas Radius GPS Masuk */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    Batas Radius GPS Presensi
                  </span>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    Maksimal {formData.radius_gps} Meter
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="5"
                    value={formData.radius_gps}
                    onChange={(e) => setFormData(prev => ({ ...prev, radius_gps: Number(e.target.value) }))}
                    className="flex-1 accent-blue-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <div className="w-24 relative shrink-0">
                    <input
                      type="number"
                      min="5"
                      max="1000"
                      required
                      value={formData.radius_gps}
                      onChange={(e) => setFormData(prev => ({ ...prev, radius_gps: Number(e.target.value) || 50 }))}
                      className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold pointer-events-none">
                      m
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Guru wajib berada di dalam radius {formData.radius_gps}m dari titik koordinat sekolah saat melakukan scan QR.
                </p>
              </div>

              {/* Titik Koordinat: Latitude & Longitude */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                {/* Input Latitude */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    Latitude Sekolah
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="-7.629810"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Input Longitude */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    Longitude Sekolah
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="111.523910"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Tombol Helper GPS & Google Maps link */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleGetGpsLocation}
                  disabled={fetchingGps}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  <MapPin className={`w-3.5 h-3.5 text-rose-600 ${fetchingGps ? "animate-bounce" : ""}`} />
                  <span>{fetchingGps ? "Mencari Titik GPS..." : "Ambil Koordinat Saya Saat Ini"}</span>
                  {gpsAccuracy !== null && !fetchingGps && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold ml-1">
                      ±{gpsAccuracy}m
                    </span>
                  )}
                </button>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${formData.latitude},${formData.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  <span>Cek di Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* SUB-SEKSI 3: NAMA & KETERANGAN POS */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-3">
                3. Identitas Stasiun Presensi
              </label>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Nama Lembaga / Sekolah
                  </label>
                  <input
                    type="text"
                    value={formData.nama_sekolah || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, nama_sekolah: e.target.value }))}
                    placeholder="Contoh: SMP IT Al-Muttaqin"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Lokasi Penempelan Stiker / Poster QR
                  </label>
                  <input
                    type="text"
                    value={formData.alamat_pos || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, alamat_pos: e.target.value }))}
                    placeholder="Contoh: Meja Piket Guru / Dinding Kantor Utama"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* TOMBOL SIMPAN PENGATURAN */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan Pengaturan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Jadwal & Pengaturan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* SEKSI 2: GENERATOR KODE QR & TABEL JADWAL HARIAN (RIGHT CARD - 5 COLS)     */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card QR Code Preview */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
            
            {/* Header Card QR */}
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Cetak Kode QR Presensi Sekolah
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
              Cetak Kode QR ini dan tempelkan di meja piket / dinding kantor sekolah untuk di-scan oleh guru.
            </p>

            {/* Tampilan Frame QR Code Preview */}
            <div className="my-5 p-4 bg-white border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs flex flex-col items-center justify-center relative group">
              
              {/* Canvas QR */}
              <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                <QRCodeCanvas
                  ref={qrCanvasRef}
                  value={formData.qr_token || DEFAULT_PENGATURAN.qr_token}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* School label badge under QR */}
              <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-[11px] font-bold text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>{formData.nama_sekolah || "SMP IT Al-Muttaqin"}</span>
              </div>
            </div>

            {/* Value String Token QR Box */}
            <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 mb-5 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Token Keamanan Stasiun:
                </label>
                <button
                  type="button"
                  onClick={handleGenerateRandomToken}
                  className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  title="Buat token acak baru"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Acak Token</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.qr_token}
                  onChange={(e) => setFormData(prev => ({ ...prev, qr_token: e.target.value }))}
                  placeholder="ALMUTTAQIN_PRESENSI_STATION_PRIMARY"
                  className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Salin Token"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] text-emerald-600 font-bold">Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[11px]">Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tombol Aksi Download & Print */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownloadQrPng}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh PNG</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Lembar QR</span>
              </button>
            </div>

          </div>

          {/* Card Ringkasan Jadwal 7 Hari */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Ringkasan Jadwal Presensi Mingguan
                </h3>
              </div>
            </div>

            <div className="space-y-2">
              {DAY_NAMES_ORDER.map(day => {
                const item = (formData.jadwal_harian || DEFAULT_JADWAL_HARIAN).find(j => j.hari === day);
                const isToday = currentDayName === day;
                const isAktif = item ? item.aktif : day !== "Ahad";

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDayTab(day)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      isToday 
                        ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" 
                        : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isAktif ? (isToday ? "bg-blue-600 animate-ping" : "bg-emerald-500") : "bg-slate-300"}`} />
                      <span className="font-bold text-slate-800 dark:text-slate-200">{day}</span>
                      {isToday && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                          Hari Ini
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      {isAktif ? (
                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {item?.jam_masuk || "07:00"} - {item?.jam_pulang || "14:00"}
                          <span className="text-[10px] text-slate-400 font-sans font-normal ml-1">
                            (±{item?.toleransi_terlambat || 15}m)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">
                          Hari Libur
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL PRINT PREVIEW POSTER PAPAN QR (PRINT READY) */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:p-0 max-h-[95vh] overflow-y-auto">
            
            {/* Modal Actions Header (Hidden in Print) */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-800">Pratinjau Cetak Lembar Presensi</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* PRINTABLE SHEET CONTAINER (Styled for high clarity A4 print) */}
            <div className="p-8 flex flex-col items-center text-center bg-white text-slate-900">
              {/* Header Lembaga */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4 w-full">
                <h1 className="text-xl font-extrabold uppercase tracking-wider">
                  {formData.nama_sekolah || "SMP IT AL-MUTTAQIN"}
                </h1>
                <p className="text-xs text-slate-600 font-semibold tracking-wide mt-0.5">
                  STASIUN PRESENSI KEHADIRAN GURU & ASATIDZ
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {formData.alamat_pos || "Lokasi: Meja Piket & Kantor Utama Yayasan Al-Muttaqin"}
                </p>
              </div>

              {/* Large QR Display */}
              <div className="p-5 bg-white border-4 border-slate-900 rounded-3xl my-2 shadow-sm">
                <QRCodeSVG
                  value={formData.qr_token || DEFAULT_PENGATURAN.qr_token}
                  size={210}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Security Token Label */}
              <div className="mt-3 px-4 py-1 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800">
                TOKEN: {formData.qr_token}
              </div>

              {/* Table Jadwal Presensi Harian (Senin - Ahad) */}
              <div className="mt-4 w-full border border-slate-300 rounded-xl overflow-hidden text-left">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  <span>JADWAL PRESENSI GURU (SENIN - AHAD):</span>
                </div>
                <div className="divide-y divide-slate-200 text-[10px]">
                  {DAY_NAMES_ORDER.map(day => {
                    const item = (formData.jadwal_harian || DEFAULT_JADWAL_HARIAN).find(j => j.hari === day);
                    const isAktif = item ? item.aktif : day !== "Ahad";
                    return (
                      <div key={day} className="px-3 py-1.5 flex items-center justify-between">
                        <span className="font-bold text-slate-800 w-16">{day}</span>
                        {isAktif ? (
                          <span className="font-medium text-slate-700">
                            Masuk: <b>{item?.jam_masuk}</b> (Tol: {item?.toleransi_terlambat}m) • Pulang: <b>{item?.jam_pulang}</b>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold italic">Hari Libur</span>
                        )}
                        <span className="text-slate-500 text-[9px] truncate max-w-[120px]">{item?.keterangan || "-"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 w-full text-left">
                <h4 className="text-[11px] font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Info className="w-3 h-3 text-blue-600" />
                  Petunjuk Presensi Guru:
                </h4>
                <ol className="text-[10px] text-slate-600 space-y-1 list-decimal pl-4 font-medium leading-relaxed">
                  <li>Buka aplikasi Sistem Informasi Sekolah di smartphone/laptop Anda.</li>
                  <li>Pilih menu <strong>Presensi Guru</strong> dan aktifkan izin kamera & GPS.</li>
                  <li>Arahkan kamera ke Kode QR di atas untuk mencatat jam kehadiran.</li>
                  <li>Pastikan Anda berada di area sekolah (radius maksimal {formData.radius_gps}m).</li>
                </ol>
              </div>

              <div className="mt-4 text-[9px] text-slate-400 italic">
                Dicetak pada {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
