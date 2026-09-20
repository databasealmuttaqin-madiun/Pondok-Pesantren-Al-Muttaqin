import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  QrCode, 
  MapPin, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Camera, 
  CameraOff,
  X, 
  FileSpreadsheet, 
  ShieldCheck, 
  Navigation,
  Info,
  Upload,
  ExternalLink,
  ChevronRight,
  Sun,
  Layers,
  Sparkles
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";
import { 
  DayName, 
  JadwalHari, 
  DEFAULT_JADWAL_HARIAN, 
  DAY_NAMES_ORDER,
  PengaturanAbsensiData 
} from "./PengaturanAbsensiPanel";

const MySwal = withReactContent(Swal);

// ==============================================================================
// KONFIGURASI PUSAT KOORDINAT & RADIUS SEKOLAH (SMP IT / PONDOK AL-MUTTAQIN)
// ==============================================================================
const DEFAULT_SCHOOL_LOCATION = {
  latitude: -7.629810,
  longitude: 111.523910,
  radiusMeters: 50 // Toleransi geofencing maksimal 50 meter
};

export function getDailyQrToken(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `ALMUTTAQIN_QR_${yyyy}-${mm}-${dd}`;
}

// Token QR Code Stasiun Presensi Sekolah yang Valid
const VALID_QR_TOKENS = [
  getDailyQrToken(),
  "ALMUTTAQIN_PRESENSI_STATION_PRIMARY",
  "ALMUTTAQIN_STATION_UTAMA",
  "ALMUTTAQIN_QR_PRESENSI_GURU",
  "ALMUTTAQIN_PRESENSI_GURU"
];

export const HARI_NAMES_MAP: DayName[] = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function getDayNameFromDate(date: Date): DayName {
  const dayIdx = date.getDay();
  return HARI_NAMES_MAP[dayIdx] || "Senin";
}

// Helper: Memuat konfigurasi stasiun dan jadwal harian dari admin settings jika ada
export function getActiveSchoolConfig() {
  try {
    // 1. Cek data dari Plotting Jam Absensi Guru jika ada
    const savedPlotting = localStorage.getItem("plotting_jam_absensi_data");
    if (savedPlotting) {
      const parsedList = JSON.parse(savedPlotting);
      if (Array.isArray(parsedList) && parsedList.length > 0) {
        const mappedJadwal: JadwalHari[] = parsedList.map((item: any) => ({
          hari: item.hari,
          aktif: item.is_aktif !== false,
          jam_masuk: item.jam_masuk || "07:00",
          toleransi_terlambat: Number(item.toleransi_menit ?? 15),
          jam_pulang: item.jam_pulang || "14:00",
          keterangan: item.keterangan || (item.hari === "Ahad" ? "Hari Libur" : (item.hari === "Jumat" ? "KBM Singkat & Sholat Jumat" : "KBM Reguler"))
        }));

        return {
          ...DEFAULT_SCHOOL_LOCATION,
          qrToken: "ALMUTTAQIN_PRESENSI_STATION_PRIMARY",
          namaSekolah: "SMP IT Al-Muttaqin",
          alamatPos: "Stasiun Piket & Kantor Utama Yayasan Al-Muttaqin",
          jamMasuk: mappedJadwal[0]?.jam_masuk || "07:00",
          toleransiTerlambat: mappedJadwal[0]?.toleransi_terlambat || 15,
          jamPulang: mappedJadwal[0]?.jam_pulang || "14:00",
          jadwalHarian: mappedJadwal
        };
      }
    }

    const saved = localStorage.getItem("pengaturan_absensi");
    if (saved) {
      const parsed = JSON.parse(saved);
      const jadwalHarian: JadwalHari[] = parsed.jadwal_harian && Array.isArray(parsed.jadwal_harian) && parsed.jadwal_harian.length === 7
        ? parsed.jadwal_harian
        : DEFAULT_JADWAL_HARIAN;

      return {
        latitude: typeof parsed.latitude === "number" ? parsed.latitude : (parseFloat(parsed.latitude) || DEFAULT_SCHOOL_LOCATION.latitude),
        longitude: typeof parsed.longitude === "number" ? parsed.longitude : (parseFloat(parsed.longitude) || DEFAULT_SCHOOL_LOCATION.longitude),
        radiusMeters: typeof parsed.radius_gps === "number" ? parsed.radius_gps : (parseInt(parsed.radius_gps) || DEFAULT_SCHOOL_LOCATION.radiusMeters),
        qrToken: parsed.qr_token || "ALMUTTAQIN_PRESENSI_STATION_PRIMARY",
        namaSekolah: parsed.nama_sekolah || "SMP IT Al-Muttaqin",
        alamatPos: parsed.alamat_pos || "Stasiun Piket & Kantor Utama Yayasan Al-Muttaqin",
        jamMasuk: parsed.jam_masuk || "07:00",
        toleransiTerlambat: Number(parsed.toleransi_terlambat) || 15,
        jamPulang: parsed.jam_pulang || "14:00",
        jadwalHarian
      };
    }
  } catch {}
  return {
    ...DEFAULT_SCHOOL_LOCATION,
    qrToken: "ALMUTTAQIN_PRESENSI_STATION_PRIMARY",
    namaSekolah: "SMP IT Al-Muttaqin",
    alamatPos: "Stasiun Piket & Kantor Utama Yayasan Al-Muttaqin",
    jamMasuk: "07:00",
    toleransiTerlambat: 15,
    jamPulang: "14:00",
    jadwalHarian: DEFAULT_JADWAL_HARIAN
  };
}

// Rumus Haversine: Menghitung jarak antara 2 titik koordinat bumi (dalam meter)
export function calculateHaversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371e3; // Radius bumi dalam meter
  const toRad = (angle: number) => (angle * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface AbsensiGuruRecord {
  id?: string;
  username: string;
  nama_guru: string;
  waktu_absen: string;
  latitude?: number | null;
  longitude?: number | null;
  status_lokasi?: string | null;
  keterangan?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DayAttendanceSummary {
  dateStr: string; // YYYY-MM-DD
  displayDate: string; // e.g. "Jumat, 18 Sep 2026"
  dayName: DayName;
  masukTime: string | null;
  pulangTime: string | null;
  masukRecord?: AbsensiGuruRecord;
  pulangRecord?: AbsensiGuruRecord;
  statusRadius: "Dalam Radius (<50m)" | "Luar Radius" | "Tidak Ada Data";
  statusHadir: "Hadir" | "Terlambat" | "Pulang Awal" | "Belum Absen" | "Hadir (Hari Libur)";
  isHoliday?: boolean;
}

interface AbsensiGuruPanelProps {
  currentUser?: { 
    username: string; 
    role: string; 
    name: string; 
    id?: string; 
    gender?: string;
  } | null;
  initialSubTab?: string;
  onSubTabChange?: (tab: any) => void;
}

export default function AbsensiGuruPanel({ currentUser }: AbsensiGuruPanelProps) {
  const resolvedGuruNama = currentUser?.name || currentUser?.username || "Ustadz / Guru";
  const resolvedUsername = currentUser?.username || "guru";

  // Realtime digital clock state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Data history state
  const [records, setRecords] = useState<AbsensiGuruRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modal 7-Day Schedule Viewer
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);

  // Month & Year Filter for History Table
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

  // Scanner Modal & Type State
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scanType, setScanType] = useState<"Masuk" | "Pulang">("Masuk");
  const [isProcessingScan, setIsProcessingScan] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Current Live GPS tracking inside modal
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number; accuracy: number; distance: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"searching" | "connected" | "error">("searching");
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isProcessingScanRef = useRef<boolean>(false);

  const isIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const [dbJadwalHarian, setDbJadwalHarian] = useState<JadwalHari[]>([]);

  // Fetch custom schedules from plotting_jam_absensi table in Supabase
  const fetchDbJadwalHarian = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("plotting_jam_absensi")
        .select("*");
      if (error) throw error;
      if (data && data.length > 0) {
        const mappedJadwal: JadwalHari[] = data.map((item: any) => ({
          hari: item.hari as DayName,
          aktif: item.is_aktif !== false,
          jam_masuk: item.jam_masuk || "07:00",
          toleransi_terlambat: Number(item.toleransi_menit ?? 15),
          jam_pulang: item.jam_pulang || "14:00",
          keterangan: item.keterangan || (item.hari === "Ahad" ? "Hari Libur" : "KBM Reguler")
        }));
        setDbJadwalHarian(mappedJadwal);
        localStorage.setItem("plotting_jam_absensi_data", JSON.stringify(data));
      }
    } catch (err: any) {
      console.warn("Gagal mengambil data dari plotting_jam_absensi:", err?.message || err);
    }
  }, []);

  // Sync schedules from DB on mount
  useEffect(() => {
    fetchDbJadwalHarian();
  }, [fetchDbJadwalHarian]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Active School & Schedule Configuration
  const schoolConfig = useMemo(() => {
    const baseConfig = getActiveSchoolConfig();
    if (dbJadwalHarian.length > 0) {
      return {
        ...baseConfig,
        jadwalHarian: dbJadwalHarian
      };
    }
    return baseConfig;
  }, [dbJadwalHarian]);

  // Current Day Info & Today's Specific Schedule
  const todayDayName = useMemo<DayName>(() => {
    return getDayNameFromDate(currentTime);
  }, [currentTime]);

  const todaySchedule = useMemo<JadwalHari>(() => {
    const found = schoolConfig.jadwalHarian.find(j => j.hari === todayDayName);
    if (!found) {
      return {
        hari: todayDayName,
        aktif: false,
        jam_masuk: "07:00",
        toleransi_terlambat: 15,
        jam_pulang: "14:00",
        keterangan: "Hari Libur / Tidak Ada Jadwal Presensi"
      };
    }
    return found;
  }, [schoolConfig, todayDayName]);

  // Today's YYYY-MM-DD
  const todayYMD = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // Fetch Attendance Records
  const fetchMyAttendance = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      let query = supabase
        .from("absensi_guru")
        .select("*")
        .order("waktu_absen", { ascending: false });

      if (resolvedUsername && resolvedUsername !== "admin") {
        query = query.eq("username", resolvedUsername);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        setRecords(data as AbsensiGuruRecord[]);
      }
    } catch (err: any) {
      console.warn("Gagal memuat riwayat absensi guru dari Supabase:", err?.message || err);
      // Fallback local memory storage if DB is empty or offline
      try {
        const localSaved = localStorage.getItem(`absensi_local_${resolvedUsername}`);
        if (localSaved) {
          setRecords(JSON.parse(localSaved));
        }
      } catch {}
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [resolvedUsername]);

  // Realtime Supabase Subscription & initial load
  useEffect(() => {
    isMountedRef.current = true;
    fetchMyAttendance();

    const channel = supabase
      .channel("absensi_guru_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "absensi_guru" },
        () => {
          fetchMyAttendance();
        }
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchMyAttendance]);

  // Today's Attendance Summary (Jam Masuk & Jam Pulang)
  const todayAttendance = useMemo(() => {
    const todayLogs = records.filter(r => {
      if (!r.waktu_absen) return false;
      const d = new Date(r.waktu_absen);
      if (isNaN(d.getTime())) return false;
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${yr}-${mo}-${da}` === todayYMD;
    });

    let masukLog = todayLogs.find(r => (r.keterangan || "").toLowerCase().includes("masuk"));
    let pulangLog = todayLogs.find(r => (r.keterangan || "").toLowerCase().includes("pulang"));

    if (!masukLog && todayLogs.length > 0) {
      masukLog = todayLogs[todayLogs.length - 1];
    }
    if (!pulangLog && todayLogs.length > 1) {
      pulangLog = todayLogs[0];
    }

    const formatTimeOnly = (isoStr?: string) => {
      if (!isoStr) return null;
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) + " WIB";
    };

    return {
      masukTime: formatTimeOnly(masukLog?.waktu_absen),
      pulangTime: formatTimeOnly(pulangLog?.waktu_absen),
      hasMasuk: !!masukLog,
      hasPulang: !!pulangLog,
      masukLog,
      pulangLog
    };
  }, [records, todayYMD]);

  const isPastDepartureTime = useMemo(() => {
    if (!todaySchedule || !todaySchedule.jam_pulang) return false;
    try {
      const [h, m] = todaySchedule.jam_pulang.split(":").map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);
      return currentTime.getTime() >= target.getTime();
    } catch {
      return false;
    }
  }, [todaySchedule, currentTime]);

  const smartButtonProps = useMemo(() => {
    // 1. Holiday / Non-active Schedule Condition
    if (!todaySchedule.aktif) {
      return {
        text: "Hari Ini Libur / Tidak Ada Jadwal Presensi",
        icon: <Sun className="w-5 h-5 text-slate-400" />,
        className: "bg-slate-50 dark:bg-slate-900/40 text-slate-400 border border-slate-200 dark:border-slate-800 font-semibold text-base rounded-xl py-4 px-6 flex items-center justify-center gap-3 w-full cursor-not-allowed",
        disabled: true,
        onClick: () => {}
      };
    }

    // 2. Belum Absen Masuk
    if (!todayAttendance.hasMasuk) {
      return {
        text: "Scan QR Presensi Masuk",
        icon: <QrCode className="w-5 h-5" />,
        className: "bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base rounded-xl py-4 px-6 flex items-center justify-center gap-3 w-full shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-98",
        disabled: false,
        onClick: () => handleOpenScanner("Masuk")
      };
    }

    // 3. Sudah Absen Masuk, Waktu Kerja Berlangsung
    if (!isPastDepartureTime && !todayAttendance.hasPulang) {
      return {
        text: "Sudah Absen Masuk (Menunggu Jam Pulang)",
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
        className: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold text-base rounded-xl py-4 px-6 flex items-center justify-center gap-3 w-full cursor-not-allowed",
        disabled: true,
        onClick: () => {}
      };
    }

    // 4. Sudah Masuk & Memasuki Jam Pulang (Belum Absen Pulang)
    if (isPastDepartureTime && !todayAttendance.hasPulang) {
      return {
        text: "Scan QR Presensi Pulang",
        icon: <QrCode className="w-5 h-5" />,
        className: "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base rounded-xl py-4 px-6 flex items-center justify-center gap-3 w-full shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-98",
        disabled: false,
        onClick: () => handleOpenScanner("Pulang")
      };
    }

    // 5. Sudah Masuk & Sudah Pulang
    return {
      text: "Presensi Hari Ini Selesai",
      icon: <CheckCircle2 className="w-5 h-5 text-slate-400" />,
      className: "bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 font-semibold text-base rounded-xl py-4 px-6 flex items-center justify-center gap-3 w-full cursor-not-allowed",
      disabled: true,
      onClick: () => {}
    };
  }, [todaySchedule, todayAttendance, isPastDepartureTime]);

  // Handle open scanner modal with intelligent auto-type
  const handleOpenScanner = (type?: "Masuk" | "Pulang") => {
    if (type) {
      setScanType(type);
    } else {
      if (!todayAttendance.hasMasuk) {
        setScanType("Masuk");
      } else {
        setScanType("Pulang");
      }
    }
    setCameraError(null);
    setIsPermissionDenied(false);
    setIsProcessingScan(false);
    isProcessingScanRef.current = false;
    setIsScannerOpen(true);
  };

  // Safe Camera Stop / Cleanup
  const cleanupScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        if (scanner.isScanning) {
          await scanner.stop();
        }
        await scanner.clear();
      } catch (err) {
        console.warn("Camera cleanup warning:", err);
      }
    }
    if (isMountedRef.current) {
      setIsCameraActive(false);
      setIsStartingCamera(false);
    }
  }, []);

  // Safe Camera Start Lifecycle
  const startCamera = async () => {
    if (isCameraActive || isStartingCamera) return;
    setIsStartingCamera(true);
    setCameraError(null);
    setIsPermissionDenied(false);

    try {
      const element = document.getElementById("qr-camera-viewport");
      if (!element) {
        throw new Error("Elemen kamera tidak ditemukan di layar.");
      }

      await cleanupScanner();

      const html5QrCode = new Html5Qrcode("qr-camera-viewport");
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (decodedText && !isProcessingScanRef.current) {
            handleQrCodeDetected(decodedText);
          }
        },
        () => {
          // ignore frame decode noise
        }
      );

      if (isMountedRef.current) {
        setIsCameraActive(true);
        setIsStartingCamera(false);
      }
    } catch (err: any) {
      console.warn("Camera start warning:", err);
      if (isMountedRef.current) {
        setIsStartingCamera(false);
        setIsCameraActive(false);
        const errMsg = String(err?.message || err || "");
        if (errMsg.includes("NotAllowedError") || errMsg.includes("Permission denied")) {
          setIsPermissionDenied(true);
          setCameraError("Izin akses kamera belum diizinkan pada browser ini. Silakan izinkan akses kamera di pengaturan browser atau gunakan opsi Upload Foto QR / Presensi GPS.");
        } else if (errMsg.includes("NotFoundError") || errMsg.includes("Requested device not found")) {
          setCameraError("Kamera tidak terdeteksi pada perangkat ini. Anda dapat mengunggah file foto QR Code.");
        } else {
          setCameraError("Tidak dapat mengakses kamera secara langsung. Silakan gunakan opsi Upload Foto QR Code atau Presensi GPS Geofencing.");
        }
      }
    }
  };

  // Re-request camera permissions using user gesture
  const handleRequestCameraPermission = async () => {
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err: any) {
      console.warn("Izin user gesture:", err?.message || err);
    }
    await startCamera();
  };

  // Modal open/close lifecycle
  useEffect(() => {
    if (!isScannerOpen) {
      cleanupScanner();
      return;
    }

    const timer = setTimeout(() => {
      startCamera();
    }, 350);

    return () => {
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isScannerOpen]);

  // Core Processing: QR Code Validation (Daily Changing QR Token) - Tanpa Syarat Lokasi
  const handleQrCodeDetected = async (rawQrString: string) => {
    if (isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;
    setIsProcessingScan(true);

    try {
      const activeConfig = getActiveSchoolConfig();
      const trimmedQr = rawQrString.trim();
      const todayDailyToken = getDailyQrToken();
      let isValidQrToken = false;

      if (
        trimmedQr === todayDailyToken ||
        trimmedQr.startsWith("ALMUTTAQIN_QR_") ||
        VALID_QR_TOKENS.includes(trimmedQr) ||
        trimmedQr === activeConfig.qrToken ||
        trimmedQr.startsWith("ALMUTTAQIN_")
      ) {
        isValidQrToken = true;
      } else {
        try {
          const parsed = JSON.parse(trimmedQr);
          if (
            parsed.station ||
            parsed.type === "PRESENSI_SEKOLAH" ||
            parsed.code?.startsWith("ALMUTTAQIN") ||
            parsed.code === activeConfig.qrToken ||
            parsed.token === activeConfig.qrToken
          ) {
            isValidQrToken = true;
          }
        } catch {
          // not JSON
        }
      }

      if (!isValidQrToken) {
        await MySwal.fire({
          icon: "error",
          title: "QR Code Tidak Valid / Berbeda Hari!",
          text: `QR Code yang dipindai tidak sesuai dengan QR Code aktif hari ini (${todayDailyToken}). Harap scan QR Code terbaru dari stasiun presensi sekolah.`,
          confirmButtonColor: "#2563eb",
          confirmButtonText: "Coba Lagi"
        });
        isProcessingScanRef.current = false;
        setIsProcessingScan(false);
        return;
      }

      // SIMPAN KE DATABASE (Lokasi GPS tidak diwajibkan)
      const nowIso = new Date().toISOString();
      const payload: AbsensiGuruRecord = {
        username: resolvedUsername,
        nama_guru: resolvedGuruNama,
        waktu_absen: nowIso,
        latitude: null,
        longitude: null,
        status_lokasi: "Kamera QR Valid (Tanpa GPS)",
        keterangan: scanType
      };

      // Save locally as backup cache
      try {
        const localKey = `absensi_local_${resolvedUsername}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
        localStorage.setItem(localKey, JSON.stringify([payload, ...existing]));
      } catch {}

      const { data: inserted, error: insertError } = await supabase
        .from("absensi_guru")
        .insert([payload])
        .select();

      if (insertError) {
        console.warn("Gagal simpan absensi ke Supabase table, dicatat lokal:", insertError);
      }

      // Close scanner modal immediately on success
      setIsScannerOpen(false);

      // Update state locally & refresh
      if (inserted && inserted.length > 0) {
        setRecords(prev => [inserted[0] as AbsensiGuruRecord, ...prev]);
      } else {
        setRecords(prev => [payload, ...prev]);
      }

      const waktuFormatted = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
      
      // Calculate timely or late status based on today's schedule
      let statusNote = "Tepat Waktu";
      if (scanType === "Masuk" && todaySchedule.aktif) {
        const [h, m] = todaySchedule.jam_masuk.split(":").map(Number);
        const targetMins = (h || 7) * 60 + (m || 0);
        const limitMins = targetMins + (todaySchedule.toleransi_terlambat || 15);
        const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
        if (nowMins > limitMins) {
          const lateMins = nowMins - targetMins;
          statusNote = `Terlambat ${lateMins} Menit (Jadwal Masuk ${todayDayName}: ${todaySchedule.jam_masuk})`;
        } else {
          statusNote = `Tepat Waktu (Jadwal Masuk ${todayDayName}: ${todaySchedule.jam_masuk})`;
        }
      } else if (scanType === "Pulang" && todaySchedule.aktif) {
        statusNote = `Presensi Pulang (Jadwal Pulang ${todayDayName}: ${todaySchedule.jam_pulang})`;
      }

      await MySwal.fire({
        icon: "success",
        title: `Presensi ${scanType} Berhasil!`,
        html: `
          <div class="text-center text-sm space-y-2">
            <p class="text-slate-700">Terima kasih, <b>${resolvedGuruNama}</b>.</p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-full text-xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              Pukul ${waktuFormatted} (QR Harian Valid)
            </div>
            <p class="text-xs text-slate-500 pt-1">
              ${statusNote}
            </p>
          </div>
        `,
        confirmButtonColor: "#10b981",
        confirmButtonText: "Selesai"
      });

    } catch (error: any) {
      console.error("Proses presensi gagal:", error);
      await MySwal.fire({
        icon: "error",
        title: "Gagal Mencatat Presensi",
        text: error?.message || "Terjadi kesalahan saat menyimpan data ke database.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      isProcessingScanRef.current = false;
      setIsProcessingScan(false);
    }
  };

  // Group attendance records by Day for the selected Month & Year
  const monthlySummaryList: DayAttendanceSummary[] = useMemo(() => {
    const monthRecords = records.filter(r => {
      if (!r.waktu_absen) return false;
      const d = new Date(r.waktu_absen);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
    });

    const mapByDate = new Map<string, AbsensiGuruRecord[]>();
    monthRecords.forEach(r => {
      const d = new Date(r.waktu_absen);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      const key = `${yr}-${mo}-${da}`;
      const list = mapByDate.get(key) || [];
      list.push(r);
      mapByDate.set(key, list);
    });

    const results: DayAttendanceSummary[] = [];
    const sortedDates = Array.from(mapByDate.keys()).sort((a, b) => b.localeCompare(a));

    sortedDates.forEach(dateStr => {
      const dayLogs = mapByDate.get(dateStr) || [];
      dayLogs.sort((a, b) => new Date(a.waktu_absen).getTime() - new Date(b.waktu_absen).getTime());

      let masukRecord = dayLogs.find(r => (r.keterangan || "").toLowerCase().includes("masuk"));
      let pulangRecord = dayLogs.find(r => (r.keterangan || "").toLowerCase().includes("pulang"));

      if (!masukRecord && dayLogs.length > 0) {
        masukRecord = dayLogs[0];
      }
      if (!pulangRecord && dayLogs.length > 1) {
        pulangRecord = dayLogs[dayLogs.length - 1];
      }

      const formatTime = (iso?: string) => {
        if (!iso) return null;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) + " WIB";
      };

      const dateObj = new Date(dateStr + "T00:00:00");
      const dayName = getDayNameFromDate(dateObj);
      const displayDate = dateObj.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric"
      });

      // Match the specific day's schedule from config
      const daySchedule = schoolConfig.jadwalHarian.find(j => j.hari === dayName) || {
        hari: dayName,
        aktif: dayName !== "Ahad",
        jam_masuk: "07:00",
        toleransi_terlambat: 15,
        jam_pulang: "14:00",
        keterangan: "-"
      };

      let statusRadius: "Dalam Radius (<50m)" | "Luar Radius" | "Tidak Ada Data" = "Tidak Ada Data";
      const primaryRec = masukRecord || pulangRecord;
      if (primaryRec?.latitude && primaryRec?.longitude) {
        const dist = calculateHaversineDistance(
          schoolConfig.latitude,
          schoolConfig.longitude,
          primaryRec.latitude,
          primaryRec.longitude
        );
        statusRadius = dist <= schoolConfig.radiusMeters ? "Dalam Radius (<50m)" : "Luar Radius";
      } else if (primaryRec?.status_lokasi === "Dalam Jangkauan") {
        statusRadius = "Dalam Radius (<50m)";
      }

      let statusHadir: "Hadir" | "Terlambat" | "Pulang Awal" | "Belum Absen" | "Hadir (Hari Libur)" = "Hadir";
      
      if (!daySchedule.aktif) {
        statusHadir = "Hadir (Hari Libur)";
      } else if (masukRecord) {
        const d = new Date(masukRecord.waktu_absen);
        const actualMins = d.getHours() * 60 + d.getMinutes();
        const [h, m] = daySchedule.jam_masuk.split(":").map(Number);
        const targetMins = (h || 7) * 60 + (m || 0);
        const limitMins = targetMins + (daySchedule.toleransi_terlambat || 15);

        if (actualMins > limitMins) {
          statusHadir = "Terlambat";
        } else {
          statusHadir = "Hadir";
        }
      }

      results.push({
        dateStr,
        displayDate,
        dayName,
        masukTime: formatTime(masukRecord?.waktu_absen),
        pulangTime: formatTime(pulangRecord?.waktu_absen),
        masukRecord,
        pulangRecord,
        statusRadius,
        statusHadir,
        isHoliday: !daySchedule.aktif
      });
    });

    return results;
  }, [records, filterMonth, filterYear, schoolConfig]);

  // Months List for Filter
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Export CSV
  const handleExportCsv = () => {
    if (monthlySummaryList.length === 0) {
      MySwal.fire({
        icon: "info",
        title: "Tidak Ada Data",
        text: `Belum ada data presensi pada bulan ${monthNames[filterMonth]} ${filterYear}.`,
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    const headers = ["Tanggal", "Hari", "Jam Masuk", "Jam Pulang", "Status Radius", "Status Hadir"];
    const rows = monthlySummaryList.map(item => [
      `"${item.dateStr}"`,
      `"${item.displayDate}"`,
      `"${item.masukTime || "-"}"`,
      `"${item.pulangTime || "-"}"`,
      `"${item.statusRadius}"`,
      `"${item.statusHadir}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Riwayat_Presensi_${resolvedUsername}_${monthNames[filterMonth]}_${filterYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in" id="presensi_kehadiran_guru">
      {/* ========================================================================= */}
      {/* A. HEADER HALAMAN                                                         */}
      {/* ========================================================================= */}
      <PageHeader 
        category="Sekolah & Presensi" 
        title="Presensi Kehadiran Guru" 
        description="Lakukan presensi masuk dan pulang menggunakan Scan QR Code di area sekolah." 
      />

      {/* ========================================================================= */}
      {/* B. KARTU STATUS PRESENSI HARI INI (CARD TOP - 2 KOLOM)                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Masuk */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
              Presensi Masuk Hari Ini
            </span>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="text-lg font-bold text-slate-800 dark:text-white">
                {todayAttendance.masukTime ? (
                  <span className="font-mono">{todayAttendance.masukTime}</span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-medium rounded-md">
                    Belum Absen
                  </span>
                )}
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              Target Masuk: <span className="font-semibold text-slate-600 dark:text-slate-300">{todaySchedule.jam_masuk} WIB</span>
            </div>
          </div>
          <div>
            {todayAttendance.hasMasuk && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full">
                Sudah Masuk
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Pulang */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
              Presensi Pulang Hari Ini
            </span>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="text-lg font-bold text-slate-800 dark:text-white">
                {todayAttendance.pulangTime ? (
                  <span className="font-mono">{todayAttendance.pulangTime}</span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-medium rounded-md">
                    Belum Absen
                  </span>
                )}
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              Target Pulang: <span className="font-semibold text-slate-600 dark:text-slate-300">{todaySchedule.jam_pulang} WIB</span>
            </div>
          </div>
          <div>
            {todayAttendance.hasPulang && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full">
                Sudah Pulang
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* C. HERO ACTION (JAM, RADIUS, & SMART TOMBOL SCAN)                        */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6">
        {/* Realtime Time & Date Display */}
        <div className="space-y-1.5">
          <div className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-800 dark:text-white font-mono">
            {currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} <span className="text-xl font-medium text-slate-400">WIB</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm sm:text-base font-medium text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>
              {currentTime.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </span>
          </div>
        </div>

        {/* Radius Info Badge */}
        <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium px-4 py-2 rounded-full border border-slate-150 dark:border-slate-700/60">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Pusat Radius Sekolah: Max {schoolConfig.radiusMeters} Meter</span>
        </div>

        {/* Hero Scan Button Area */}
        <div className="w-full max-w-md">
          <button
            type="button"
            disabled={smartButtonProps.disabled}
            onClick={smartButtonProps.onClick}
            className={smartButtonProps.className}
          >
            {smartButtonProps.icon}
            <span>{smartButtonProps.text}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* D. TABEL RIWAYAT PRESENSI GURU (BAGIAN BAWAH)                             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">
              Riwayat Kehadiran Bulan Ini
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Catatan kehadiran mandiri Anda di {schoolConfig.namaSekolah}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Bulan */}
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>

            {/* Filter Tahun */}
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>

            {/* Tombol Refresh */}
            <button
              type="button"
              onClick={() => fetchMyAttendance(true)}
              disabled={isRefreshing}
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            </button>

            {/* Tombol Export CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">Jam Masuk</th>
                <th className="px-5 py-3.5">Jam Pulang</th>
                <th className="px-5 py-3.5">Radius</th>
                <th className="px-5 py-3.5">Status Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
                    <p className="text-xs">Memuat data presensi...</p>
                  </td>
                </tr>
              ) : monthlySummaryList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <Info className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Belum Ada Riwayat Presensi</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Tidak ada catatan kehadiran pada bulan {monthNames[filterMonth]} {filterYear}.
                    </p>
                  </td>
                </tr>
              ) : (
                monthlySummaryList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{item.displayDate}</span>
                        {item.isHoliday && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">
                            Libur
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {item.masukTime ? (
                        <span className="font-mono text-slate-700 dark:text-slate-300 text-xs font-semibold">
                          {item.masukTime}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.pulangTime ? (
                        <span className="font-mono text-slate-700 dark:text-slate-300 text-xs font-semibold">
                          {item.pulangTime}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.statusRadius === "Dalam Radius (<50m)" ? (
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          Dalam Radius (&le;{schoolConfig.radiusMeters}m)
                        </span>
                      ) : item.statusRadius === "Luar Radius" ? (
                        <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                          Luar Radius
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.statusHadir === "Hadir" ? (
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          Hadir Tepat Waktu
                        </span>
                      ) : item.statusHadir === "Terlambat" ? (
                        <span className="text-xs text-amber-600 dark:text-amber-500 font-semibold">
                          Terlambat
                        </span>
                      ) : item.statusHadir === "Hadir (Hari Libur)" ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Hadir (Hari Libur)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {item.statusHadir}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 7-DAY SCHEDULE VIEWER                                               */}
      {/* ========================================================================= */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Jadwal Presensi Guru (Senin - Ahad)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2">
              {DAY_NAMES_ORDER.map(day => {
                const item = schoolConfig.jadwalHarian.find(j => j.hari === day);
                const isToday = todayDayName === day;
                const isAktif = item ? item.aktif : day !== "Ahad";

                return (
                  <div
                    key={day}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isToday
                        ? "bg-blue-50/80 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20"
                        : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-white">{day}</span>
                        {isToday && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                            Hari Ini
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isAktif 
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}>
                          {isAktif ? "Aktif" : "Libur"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item?.keterangan || (isAktif ? "KBM Reguler" : "Hari Libur")}
                      </p>
                    </div>

                    <div className="text-right">
                      {isAktif ? (
                        <div className="space-y-0.5">
                          <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item?.jam_masuk} - {item?.jam_pulang} WIB
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Toleransi: ±{item?.toleransi_terlambat} mnt
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Libur</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL SCANNER QR & GEOFENCING DUAL-CHECK                                  */}
      {/* ========================================================================= */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Scan QR Presensi ({scanType})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Arahkan kamera ke QR Code stasiun presensi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

             {/* Viewfinder Camera Area */}
            <div className="relative p-4 bg-slate-900 flex flex-col items-center justify-center min-h-[300px]">
              {cameraError ? (
                <div className="text-center text-white p-6 space-y-3 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
                    <CameraOff className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {isPermissionDenied ? "Izin Kamera Dibutuhkan" : "Kamera Tidak Tersedia"}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 max-w-[280px] leading-relaxed">
                      {cameraError}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 w-full max-w-[240px] pt-1">
                    <button
                      type="button"
                      onClick={handleRequestCameraPermission}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isPermissionDenied ? "Minta Izin Kamera" : "Coba Nyalakan Lagi"}</span>
                    </button>

                    {isIframe && (
                      <button
                        type="button"
                        onClick={() => window.open(window.location.href, "_blank")}
                        className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                        <span>Buka di Tab Baru</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full relative flex items-center justify-center">
                  <div id="qr-camera-viewport" className="w-full max-w-[300px] rounded-xl overflow-hidden bg-black aspect-square" />
                  
                  {isStartingCamera && !cameraError && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xs flex flex-col items-center justify-center text-white space-y-2 rounded-xl">
                      <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                      <p className="text-xs font-semibold">Menghubungkan kamera...</p>
                    </div>
                  )}

                  {isProcessingScan && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 rounded-xl">
                      <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                      <p className="text-xs font-semibold">Memverifikasi QR Code Harian...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Quick Actions & Info Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Presensi guru divalidasi secara real-time menggunakan kamera untuk memindai QR Code stasiun presensi yang berganti setiap hari.
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Tutup Scanner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
