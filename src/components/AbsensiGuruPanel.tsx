import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  MapPin, CheckCircle, XCircle, AlertTriangle, Crosshair, 
  Clock, RefreshCw, Eye, Calendar, LogIn, LogOut, CheckCircle2,
  ExternalLink, ArrowRight, ShieldCheck, Compass, Navigation, Check,
  Download, FileText, Send, UploadCloud, UserCheck, AlertOctagon, HelpCircle,
  Camera, QrCode
} from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";
import QRScannerModal, { DEFAULT_SCHOOL_COORDS, DEFAULT_STATIC_QR_TOKEN } from "./QRScannerModal";
import StationQRPrintModal from "./StationQRPrintModal";

const MySwal = withReactContent(Swal);

// --- KONFIGURASI DEFAULT LOKASI SEKOLAH (Al-Muttaqin) ---
const DEFAULT_SCHOOL_LOCATION = {
  latitude: -7.227800, 
  longitude: 111.534500,
  radiusMeters: 50 // Toleransi 50 meter sesuai spesifikasi geofencing
};

// Jarak antara 2 titik koordinat bumi (Haversine formula)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Format waktu HH:mm WIB
function formatTimeHHmm(dateInput?: string | Date | null) {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes} WIB`;
  } catch (_) {
    return String(dateInput);
  }
}

// Format tanggal lengkap Indonesia (e.g. "Jumat, 18 September 2026")
function formatDateIndo(dateInput?: string | Date | null) {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch (_) {
    return String(dateInput);
  }
}

interface AbsensiGuruPanelProps {
  currentUser?: { username: string; role: string; name: string; id?: string; gender?: string } | null;
  initialSubTab?: "absensi" | "mengajar" | "semua_guru";
  onSubTabChange?: (tab: "absensi" | "mengajar" | "semua_guru") => void;
}

interface AttendanceRecord {
  id?: string | number;
  guru_id?: string | null;
  username: string;
  nama_guru: string;
  tanggal: string; // YYYY-MM-DD
  waktu_absen: string; // ISO
  jam_masuk?: string | null;
  jam_pulang?: string | null;
  latitude?: number;
  longitude?: number;
  status_lokasi?: string;
  status?: string;
  keterangan?: string;
  jarak_meter?: number;
}

export default function AbsensiGuruPanel({ currentUser }: AbsensiGuruPanelProps) {
  // 1. Live Clock State
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Jam Realtime: "07:15:30 WIB - Jumat, 18 September 2026"
  const formattedRealtimeClock = useMemo(() => {
    const hours = String(currentDateTime.getHours()).padStart(2, "0");
    const minutes = String(currentDateTime.getMinutes()).padStart(2, "0");
    const seconds = String(currentDateTime.getSeconds()).padStart(2, "0");
    const timePart = `${hours}:${minutes}:${seconds} WIB`;
    const datePart = currentDateTime.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    return `${timePart} - ${datePart}`;
  }, [currentDateTime]);

  // Today string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // 2. Guru Profile & Database Session State
  const [resolvedGuruId, setResolvedGuruId] = useState<string | null>(null);
  const [resolvedGuruNama, setResolvedGuruNama] = useState<string>(currentUser?.name || "Guru");

  // 3. Location & School Config State
  const [schoolLocation, setSchoolLocation] = useState(DEFAULT_SCHOOL_LOCATION);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // QR Code & Geofencing Modal State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isStationQrModalOpen, setIsStationQrModalOpen] = useState(false);

  // 4. Attendance Actions & History State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<AttendanceRecord | null>(null);

  // Tab State: 1. Riwayat Kehadiran, 2. Form Pengajuan Izin / Sakit
  const [activeTabSection, setActiveTabSection] = useState<"riwayat" | "izin">("riwayat");

  // Month & Year Filter State for Riwayat Kehadiran
  const [filterBulan, setFilterBulan] = useState<number>(new Date().getMonth());
  const [filterTahun, setFilterTahun] = useState<number>(new Date().getFullYear());

  // Form Pengajuan Izin / Sakit State
  const [izinJenis, setIzinJenis] = useState<"Sakit" | "Izin" | "Dinas Luar">("Sakit");
  const [izinTanggalMulai, setIzinTanggalMulai] = useState<string>(new Date().toISOString().split("T")[0]);
  const [izinTanggalSelesai, setIzinTanggalSelesai] = useState<string>(new Date().toISOString().split("T")[0]);
  const [izinAlasan, setIzinAlasan] = useState<string>("");
  const [izinBuktiFile, setIzinBuktiFile] = useState<string | null>(null);
  const [isSubmittingIzin, setIsSubmittingIzin] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve active guru_id and name from Supabase
  useEffect(() => {
    const resolveGuruSession = async () => {
      if (!currentUser?.username) return;

      try {
        let penggunaId: string | undefined = undefined;
        let guruName = currentUser.name || currentUser.username;

        // Cari di tabel 'pengguna'
        const { data: dbUser } = await supabase
          .from("pengguna")
          .select("id, nama, nama_lengkap, username")
          .eq("username", currentUser.username)
          .maybeSingle();

        if (dbUser) {
          penggunaId = dbUser.id;
          if (dbUser.nama_lengkap) guruName = dbUser.nama_lengkap;
          else if (dbUser.nama) guruName = dbUser.nama;
        }

        // Cari di tabel 'guru'
        let dbGuru: any = null;
        if (penggunaId) {
          const { data } = await supabase
            .from("guru")
            .select("id, nama_lengkap, pengguna_id")
            .eq("pengguna_id", penggunaId)
            .maybeSingle();
          if (data) dbGuru = data;
        }

        if (!dbGuru && guruName) {
          const { data } = await supabase
            .from("guru")
            .select("id, nama_lengkap, pengguna_id")
            .ilike("nama_lengkap", guruName.trim())
            .maybeSingle();
          if (data) dbGuru = data;
        }

        if (dbGuru) {
          setResolvedGuruId(dbGuru.id);
          if (dbGuru.nama_lengkap) setResolvedGuruNama(dbGuru.nama_lengkap);
        } else {
          setResolvedGuruNama(guruName);
        }
      } catch (err) {
        console.warn("Gagal mendapatkan relasi guru_id:", err);
      }
    };

    resolveGuruSession();
  }, [currentUser]);

  // Fetch school location from 'pengaturan_sekolah'
  useEffect(() => {
    const fetchSchoolLocation = async () => {
      try {
        const { data, error } = await supabase
          .from("pengaturan_sekolah")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (data && !error) {
          const loc = {
            latitude: Number(data.latitude) || DEFAULT_SCHOOL_LOCATION.latitude,
            longitude: Number(data.longitude) || DEFAULT_SCHOOL_LOCATION.longitude,
            radiusMeters: Number(data.radius_meters) || DEFAULT_SCHOOL_LOCATION.radiusMeters
          };
          setSchoolLocation(loc);
          localStorage.setItem("absensi_school_location", JSON.stringify(loc));
        } else {
          const savedLoc = localStorage.getItem("absensi_school_location");
          if (savedLoc) setSchoolLocation(JSON.parse(savedLoc));
        }
      } catch (e) {
        console.warn("Notice checking school location:", e);
      }
    };

    fetchSchoolLocation();
  }, []);

  // Fetch attendance history
  const fetchAttendanceHistory = async () => {
    setIsLoadingHistory(true);
    try {
      let query = supabase
        .from("absensi_guru")
        .select("*")
        .order("waktu_absen", { ascending: false });

      if (currentUser?.role !== "admin" && currentUser?.role !== "super admin" && currentUser?.role !== "superadmin") {
        query = query.eq("username", currentUser?.username || "");
      }

      const { data, error } = await query;

      if (!error && data) {
        setHistory(data);
        localStorage.setItem("absensi_guru_history", JSON.stringify(data));
      } else {
        const saved = localStorage.getItem("absensi_guru_history");
        if (saved) setHistory(JSON.parse(saved));
      }
    } catch (err) {
      console.warn("Gagal memuat riwayat presensi:", err);
      const saved = localStorage.getItem("absensi_guru_history");
      if (saved) setHistory(JSON.parse(saved));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchAttendanceHistory();
  }, [currentUser]);

  // Today's attendance record for active user
  const todayRecord = useMemo(() => {
    return history.find(r => {
      const matchUser = r.username === currentUser?.username || (resolvedGuruId && r.guru_id === resolvedGuruId);
      if (!matchUser) return false;

      if (r.tanggal === todayStr) return true;
      if (r.waktu_absen) {
        const dStr = new Date(r.waktu_absen).toISOString().split("T")[0];
        return dStr === todayStr;
      }
      return false;
    });
  }, [history, currentUser, resolvedGuruId, todayStr]);

  // Status radius check
  const isWithinRadius = distance !== null && distance <= schoolLocation.radiusMeters;
  const isOutsideRadius = distance !== null && distance > schoolLocation.radiusMeters;

  // Trigger GPS Geolocation
  const handleCheckLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Perangkat atau peramban ini tidak mendukung Geolocation.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ lat: latitude, lng: longitude, accuracy });

        const dist = getDistanceFromLatLonInM(
          schoolLocation.latitude,
          schoolLocation.longitude,
          latitude,
          longitude
        );
        setDistance(dist);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError("Izin akses lokasi (GPS) ditolak. Silakan aktifkan izin lokasi di browser Anda.");
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationError("Informasi lokasi tidak tersedia saat ini.");
            break;
          case err.TIMEOUT:
            setLocationError("Waktu permintaan lokasi habis (timeout). Silakan coba lagi.");
            break;
          default:
            setLocationError("Terjadi kesalahan saat mendeteksi koordinat GPS.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  // Kirim Presensi (Masuk atau Pulang)
  const handleSubmitPresensi = async (tipe: "Masuk" | "Pulang") => {
    if (!location || distance === null) {
      MySwal.fire({
        icon: "warning",
        title: "Lokasi Belum Terdeteksi",
        text: "Silakan tekan tombol Cek Titik Lokasi terlebih dahulu."
      });
      return;
    }

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timeFormatted = `${hours}:${minutes} WIB`;
    const statusLokasi = isWithinRadius ? "Dalam Radius" : "Di Luar Radius";

    if (!isWithinRadius) {
      const confirm = await MySwal.fire({
        icon: "warning",
        title: "Di Luar Radius Sekolah",
        text: `Anda terdeteksi berada ${Math.round(distance)} meter dari sekolah (Radius valid: ${schoolLocation.radiusMeters} meter). Apakah Anda ingin tetap mengirim presensi?`,
        showCancelButton: true,
        confirmButtonText: "Tetap Kirim",
        cancelButtonText: "Batal",
        confirmButtonColor: "#f59e0b"
      });
      if (!confirm.isConfirmed) return;
    }

    setIsSubmitting(true);

    try {
      if (tipe === "Pulang" && todayRecord && todayRecord.id) {
        // Update jam_pulang pada catatan yang sudah ada hari ini
        const updatePayload: any = {
          jam_pulang: timeFormatted,
          keterangan: "Hadir Lengkap"
        };

        const { error: updateErr } = await supabase
          .from("absensi_guru")
          .update(updatePayload)
          .eq("id", todayRecord.id);

        if (updateErr) {
          // Fallback insert baris baru jika kolom tidak kompatibel
          console.warn("Update existing row failed, inserting separate checkout row:", updateErr);
          await supabase.from("absensi_guru").insert([{
            guru_id: resolvedGuruId || null,
            username: currentUser?.username || "guru",
            nama_guru: resolvedGuruNama,
            tanggal: todayStr,
            jam_masuk: todayRecord.jam_masuk || null,
            jam_pulang: timeFormatted,
            waktu_absen: now.toISOString(),
            latitude: location.lat,
            longitude: location.lng,
            status_lokasi: statusLokasi,
            status: "Hadir",
            keterangan: "Presensi Pulang"
          }]);
        }
      } else {
        // Insert presensi masuk baru
        const newRecordPayload = {
          guru_id: resolvedGuruId || null,
          username: currentUser?.username || "guru",
          nama_guru: resolvedGuruNama,
          tanggal: todayStr,
          jam_masuk: tipe === "Masuk" ? timeFormatted : null,
          jam_pulang: tipe === "Pulang" ? timeFormatted : null,
          waktu_absen: now.toISOString(),
          latitude: location.lat,
          longitude: location.lng,
          status_lokasi: statusLokasi,
          status: "Hadir",
          keterangan: `Presensi ${tipe}`
        };

        const { error: insertErr } = await supabase
          .from("absensi_guru")
          .insert([newRecordPayload]);

        if (insertErr) {
          console.warn("Supabase insert absensi_guru warning:", insertErr.message);
        }
      }

      await MySwal.fire({
        icon: "success",
        title: `Presensi ${tipe} Berhasil!`,
        text: `Kehadiran Anda pada pukul ${timeFormatted} telah berhasil dicatat.`,
        timer: 2000,
        showConfirmButton: false
      });

      // Refresh list
      fetchAttendanceHistory();
    } catch (err: any) {
      console.error("Gagal mengirim presensi:", err);
      MySwal.fire({
        icon: "error",
        title: "Gagal Mengirim Presensi",
        text: err.message || "Terjadi kendala saat menyimpan data ke server."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulan-bulan dalam Bahasa Indonesia
  const daftarBulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Filter history based on selected month and year
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const dateStr = item.tanggal || item.waktu_absen;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.getFullYear() === filterTahun && d.getMonth() === filterBulan;
    });
  }, [history, filterBulan, filterTahun]);

  // Statistik Ringkasan Bulan Terpilih (Total Hadir, Terlambat, Izin/Sakit)
  const statsSummary = useMemo(() => {
    let hadir = 0;
    let terlambat = 0;
    let izinSakit = 0;

    filteredHistory.forEach(item => {
      const st = (item.status || "Hadir").toLowerCase();
      if (st.includes("izin") || st.includes("sakit") || st.includes("dinas")) {
        izinSakit++;
      } else {
        hadir++;
        // Cek jika jam masuk lebih dari 07:15 dianggap terlambat
        if (item.jam_masuk) {
          const parts = item.jam_masuk.split(":");
          if (parts.length >= 2) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (h > 7 || (h === 7 && m > 15)) {
              terlambat++;
            }
          }
        }
      }
    });

    return { hadir, terlambat, izinSakit, total: filteredHistory.length };
  }, [filteredHistory]);

  // Handler Unduh Rekap Presensi (CSV Format)
  const handleDownloadRekap = () => {
    if (filteredHistory.length === 0) {
      MySwal.fire({
        icon: "info",
        title: "Tidak Ada Data",
        text: `Belum ada data presensi pada bulan ${daftarBulan[filterBulan]} ${filterTahun}.`,
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    const headers = ["No", "Tanggal", "Jam Masuk", "Jam Pulang", "Status", "Status Lokasi", "Koordinat", "Keterangan"];
    const rows = filteredHistory.map((row, idx) => [
      idx + 1,
      row.tanggal || row.waktu_absen || "-",
      row.jam_masuk || "-",
      row.jam_pulang || "-",
      row.status || "Hadir",
      row.status_lokasi || "-",
      row.latitude ? `"${row.latitude}, ${row.longitude}"` : "-",
      row.keterangan ? `"${row.keterangan.replace(/"/g, '""')}"` : "-"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Presensi_${resolvedGuruNama.replace(/\s+/g, "_")}_${daftarBulan[filterBulan]}_${filterTahun}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler Submit Form Izin / Sakit
  const handleSubmitIzin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!izinAlasan.trim()) {
      MySwal.fire({
        icon: "warning",
        title: "Alasan Wajib Diisi",
        text: "Mohon tuliskan keterangan atau alasan pengajuan izin/sakit.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    setIsSubmittingIzin(true);
    try {
      const now = new Date();
      const payload: any = {
        username: currentUser?.username || "guru",
        nama_guru: resolvedGuruNama,
        tanggal: izinTanggalMulai,
        waktu_absen: now.toISOString(),
        jam_masuk: "-",
        jam_pulang: "-",
        status: izinJenis,
        status_lokasi: "Pengajuan Izin",
        keterangan: `[${izinJenis}] ${izinAlasan} (${izinTanggalMulai} s/d ${izinTanggalSelesai})${izinBuktiFile ? " [Ada Bukti Lampiran]" : ""}`
      };

      // Simpan ke tabel absensi_guru
      const { error } = await supabase.from("absensi_guru").upsert(payload, { onConflict: "username,tanggal" });
      if (error) {
        console.warn("Supabase upsert izin info:", error);
      }

      // Update riwayat lokal
      setHistory(prev => [payload, ...prev]);

      // Reset form
      setIzinAlasan("");
      setIzinBuktiFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      MySwal.fire({
        icon: "success",
        title: "Pengajuan Terkirim",
        text: `Pengajuan ${izinJenis} Anda telah berhasil dicatat untuk tanggal ${izinTanggalMulai}.`,
        confirmButtonColor: "#2563eb"
      });

      // Pindahkan ke tab riwayat
      setActiveTabSection("riwayat");
      fetchAttendanceHistory();
    } catch (err: any) {
      MySwal.fire({
        icon: "error",
        title: "Gagal Mengirim Pengajuan",
        text: err?.message || "Terjadi kesalahan koneksi.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setIsSubmittingIzin(false);
    }
  };

  // Handle File Upload Bukti
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        MySwal.fire({
          icon: "error",
          title: "Ukuran File Terlalu Besar",
          text: "Maksimal ukuran dokumen atau foto bukti adalah 5MB.",
          confirmButtonColor: "#2563eb"
        });
        return;
      }
      setIzinBuktiFile(file.name);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER HALAMAN STANDAR REUSABLE */}
      <PageHeader 
        category="Sekolah & Presensi" 
        title="Absensi Kehadiran Guru" 
        description="Lakukan presensi masuk dan pulang berdasarkan lokasi radius sekolah yang valid." 
      />

      {/* 2. UTAMA - KARTU AKSI ABSENSI (PRESENSI CARD) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header Widget Waktu & Radius (Minimalist Style) */}
        <div className="bg-white dark:bg-slate-900 px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                <span className="h-2 w-2 bg-emerald-500 rounded-full inline-block mr-1.5 shrink-0" />
                <span>Waktu Server & Perangkat Terkini</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {formattedRealtimeClock}
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                Pusat Radius: {schoolLocation.radiusMeters} Meter
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Presensi Hari Ini: 3 Cards Grid */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Status Presensi Hari Ini
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Jam Masuk */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800/60 transition-all">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Jam Masuk
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                    <LogIn className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="mt-1">
                  {todayRecord?.jam_masuk ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {todayRecord.jam_masuk}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/50">
                        Tercatat
                      </span>
                    </div>
                  ) : todayRecord?.waktu_absen ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {formatTimeHHmm(todayRecord.waktu_absen)}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/50">
                        Tercatat
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                      Belum Absen
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Jam Pulang */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800/60 transition-all">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Jam Pulang
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                    <LogOut className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="mt-1">
                  {todayRecord?.jam_pulang ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {todayRecord.jam_pulang}
                      </span>
                      <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/50">
                        Tercatat
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                      Belum Absen
                    </span>
                  )}
                </div>
              </div>

              {/* Card 3: Status Radius */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800/60 transition-all">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Status Radius
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                    <Crosshair className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="mt-1">
                  {isWithinRadius ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
                        <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Dalam Radius
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({Math.round(distance!)} m)
                      </span>
                    </div>
                  ) : isOutsideRadius ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/60">
                        <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        Di Luar Radius
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({Math.round(distance!)} m)
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                      Belum Cek Lokasi
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* HERO SECTION: SCAN QR PRESENSI (METODE STATIC QR + GPS 50M) */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/60 dark:to-slate-800/40 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 text-blue-600" />
                  Metode Terverifikasi: Static QR + GPS Geofencing
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Radius &le; {schoolLocation.radiusMeters} Meter
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Presensi Digital Menggunakan Papan QR Sekolah
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                Arahkan kamera ke QR Code resmi yang ditempel pada stasiun presensi sekolah. Sistem akan memvalidasi keaslian token serta radius GPS 50m secara otomatis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4 text-white" />
                <span>Scan QR Presensi</span>
              </button>

              <button
                type="button"
                onClick={() => setIsStationQrModalOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Lihat / Cetak QR Code Stasiun Sekolah"
              >
                <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>QR Stasiun</span>
              </button>
            </div>
          </div>

          {/* Area Tombol Aksi GPS & Pengiriman Presensi Manual */}
          <div>
            {/* STATE WARNING (Luar Radius Alert) */}
            {isOutsideRadius && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs sm:text-sm">
                  <p className="font-semibold">
                    Anda berada di luar radius lokasi sekolah (Jarak: {Math.round(distance!)} meter).
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Batas toleransi radius sekolah adalah {schoolLocation.radiusMeters} meter.
                  </p>
                </div>
              </div>
            )}

            {/* Error Geolocation Alert */}
            {locationError && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 flex items-start gap-3">
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs sm:text-sm">
                  <p className="font-semibold">Gagal Mendapatkan Lokasi</p>
                  <p className="text-xs text-rose-700 dark:text-rose-300">{locationError}</p>
                </div>
              </div>
            )}

            {/* Tombol Utama Dinamis Berdasarkan State */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* STATE PROCESSING: Loading spinner */}
              {isLocating ? (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600/80 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Mendapatkan Koordinat GPS...</span>
                </button>
              ) : !location ? (
                /* STATE INITIAL: Tombol Solid Blue Cek Titik Lokasi */
                <button
                  type="button"
                  onClick={handleCheckLocation}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-colors cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-white" />
                  <span>Cek Titik Lokasi Saat Ini</span>
                </button>
              ) : isWithinRadius ? (
                /* STATE SUCCESS (Lolos Radius): Kirim Presensi Masuk / Pulang */
                <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
                  {!todayRecord?.jam_masuk && !todayRecord?.waktu_absen ? (
                    <button
                      type="button"
                      onClick={() => handleSubmitPresensi("Masuk")}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-colors cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{isSubmitting ? "Menyimpan..." : "Kirim Presensi Masuk"}</span>
                    </button>
                  ) : !todayRecord?.jam_pulang ? (
                    <button
                      type="button"
                      onClick={() => handleSubmitPresensi("Pulang")}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{isSubmitting ? "Menyimpan..." : "Kirim Presensi Pulang"}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Presensi Hari Ini Lengkap</span>
                    </div>
                  )}

                  {/* Tombol Cek Ulang GPS */}
                  <button
                    type="button"
                    onClick={handleCheckLocation}
                    disabled={isLocating}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? "animate-spin" : ""}`} />
                    <span>Cek Ulang GPS</span>
                  </button>
                </div>
              ) : (
                /* Di Luar Radius: Pilihan Cek Ulang atau Tetap Kirim */
                <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCheckLocation}
                    disabled={isLocating}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`} />
                    <span>Coba Deteksi Ulang Lokasi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmitPresensi(!todayRecord?.jam_masuk ? "Masuk" : "Pulang")}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Tetap Kirim Presensi</span>
                  </button>
                </div>
              )}
            </div>

            {/* Informasi Koordinat Terdeteksi */}
            {location && (
              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Koordinat: <span className="font-mono text-slate-700 dark:text-slate-300">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>
                    Akurasi GPS: <span className="text-slate-700 dark:text-slate-300">±{Math.round(location.accuracy)} m</span>
                  </span>
                </div>

                <a
                  href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Buka di Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TABS NAVIGASI: RIWAYAT KEHADIRAN & PENGAJUAN IZIN */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          type="button"
          onClick={() => setActiveTabSection("riwayat")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTabSection === "riwayat"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Riwayat Kehadiran</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
            activeTabSection === "riwayat" ? "bg-blue-700 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
          }`}>
            {filteredHistory.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabSection("izin")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTabSection === "izin"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Form Pengajuan Izin / Sakit</span>
        </button>
      </div>

      {/* TAB 1: RIWAYAT KEHADIRAN */}
      {activeTabSection === "riwayat" && (
        <div className="space-y-6">
          {/* STATS CARDS: TOTAL HADIR, TERLAMBAT, IZIN/SAKIT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Hadir */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Hadir
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {statsSummary.hadir}
                  </span>
                  <span className="text-xs text-slate-400">Hari</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Terlambat */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Terlambat
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {statsSummary.terlambat}
                  </span>
                  <span className="text-xs text-slate-400">Kali</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* Izin / Sakit */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Izin / Sakit
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {statsSummary.izinSakit}
                  </span>
                  <span className="text-xs text-slate-400">Hari</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* FILTER BULAN, TAHUN & TOMBOL UNDUH REKAP */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Filter Bulan */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bulan:</span>
                  <select
                    value={filterBulan}
                    onChange={(e) => setFilterBulan(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {daftarBulan.map((bln, idx) => (
                      <option key={bln} value={idx}>
                        {bln}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Tahun */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tahun:</span>
                  <select
                    value={filterTahun}
                    onChange={(e) => setFilterTahun(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[2025, 2026, 2027, 2028].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tombol Unduh Rekap & Segarkan */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadRekap}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Rekap</span>
                </button>

                <button
                  type="button"
                  onClick={fetchAttendanceHistory}
                  disabled={isLoadingHistory}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-colors shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>

            {/* TABEL LENGKAP RIWAYAT KEHADIRAN */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Tanggal</th>
                    <th className="py-3.5 px-6">Jam Masuk</th>
                    <th className="py-3.5 px-6">Jam Pulang</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Lokasi & Keterangan</th>
                    <th className="py-3.5 px-6 text-center">Aksi / Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((row, index) => {
                      const displayDate = formatDateIndo(row.tanggal || row.waktu_absen);
                      const displayJamMasuk = row.jam_masuk || (row.waktu_absen ? formatTimeHHmm(row.waktu_absen) : "-");
                      const displayJamPulang = row.jam_pulang || "-";
                      const hasCoords = row.latitude !== undefined && row.longitude !== undefined;
                      const isIzin = (row.status || "").toLowerCase().includes("izin") || (row.status || "").toLowerCase().includes("sakit");

                      return (
                        <tr 
                          key={`history-${row.id || index}`}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Tanggal */}
                          <td className="py-4 px-6 text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                              <span>{displayDate}</span>
                            </div>
                          </td>

                          {/* Jam Masuk */}
                          <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{displayJamMasuk}</span>
                            </div>
                          </td>

                          {/* Jam Pulang */}
                          <td className="py-4 px-6 text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <LogOut className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{displayJamPulang}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6 whitespace-nowrap">
                            {isIzin ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50">
                                <FileText className="w-3 h-3 text-amber-600" />
                                {row.status || "Izin"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50">
                                <Check className="w-3 h-3 text-emerald-600" />
                                {row.status || "Hadir"}
                              </span>
                            )}
                          </td>

                          {/* Lokasi & Keterangan */}
                          <td className="py-4 px-6 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                            {hasCoords ? (
                              <a
                                href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono bg-blue-50/50 dark:bg-blue-950/30 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-900/40"
                              >
                                <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                                <span>{Number(row.latitude).toFixed(5)}, {Number(row.longitude).toFixed(5)}</span>
                              </a>
                            ) : row.keterangan ? (
                              <span className="text-xs text-slate-600 dark:text-slate-400 italic">
                                {row.keterangan}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>

                          {/* Aksi / Detail */}
                          <td className="py-4 px-6 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedDetail(row)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2.5" />
                        <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm">
                          Belum ada catatan presensi pada bulan {daftarBulan[filterBulan]} {filterTahun}.
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Catatan kehadiran Anda akan otomatis tampil di tabel ini setelah melakukan presensi.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORM PENGAJUAN IZIN / SAKIT */}
      {activeTabSection === "izin" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 max-w-3xl">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Form Pengajuan Izin / Sakit Guru</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gunakan formulir ini untuk mengajukan permohonan ketidakhadiran resmi kepada pihak sekolah.
            </p>
          </div>

          <form onSubmit={handleSubmitIzin} className="space-y-5">
            {/* Jenis Izin */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Jenis Pengajuan
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(["Sakit", "Izin", "Dinas Luar"] as const).map((tipe) => (
                  <button
                    key={tipe}
                    type="button"
                    onClick={() => setIzinJenis(tipe)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      izinJenis === tipe
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    {tipe}
                  </button>
                ))}
              </div>
            </div>

            {/* Tanggal Mulai & Tanggal Selesai */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Tanggal Mulai
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={izinTanggalMulai}
                    onChange={(e) => setIzinTanggalMulai(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Tanggal Selesai
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={izinTanggalSelesai}
                    onChange={(e) => setIzinTanggalSelesai(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Alasan / Keterangan */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Alasan / Keterangan Rinci
              </label>
              <textarea
                required
                rows={4}
                value={izinAlasan}
                onChange={(e) => setIzinAlasan(e.target.value)}
                placeholder="Contoh: Mengalami demam dan disarankan dokter istirahat selama 2 hari..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed placeholder:text-slate-400"
              />
            </div>

            {/* Upload Bukti / Surat Dokter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Lampiran Bukti / Surat Dokter (Opsional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-4 h-4 text-slate-400" />
                  <span>{izinBuktiFile ? "Ganti File Lampiran" : "Pilih Dokumen / Foto"}</span>
                </button>
                {izinBuktiFile && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-xs">
                    ✓ {izinBuktiFile}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Format yang didukung: JPG, PNG, atau PDF (Maksimal 5MB).
              </p>
            </div>

            {/* Tombol Kirim */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIzinAlasan("");
                  setIzinBuktiFile(null);
                  setActiveTabSection("riwayat");
                }}
                className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSubmittingIzin}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-70"
              >
                {isSubmittingIzin ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-white" />
                    <span>Kirim Pengajuan Izin</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DETAIL PRESENSI */}
      {selectedDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Detail Presensi Kehadiran
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Informasi lengkap koordinat dan waktu presensi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Nama Guru</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                    {selectedDetail.nama_guru || currentUser?.name || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Username / Akun</span>
                  <p className="font-bold font-mono text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                    {selectedDetail.username || currentUser?.username || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Tanggal</span>
                  <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    {formatDateIndo(selectedDetail.tanggal || selectedDetail.waktu_absen)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Status Kehadiran</span>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {selectedDetail.status || "Hadir"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <LogIn className="w-3 h-3" /> Jam Masuk
                  </span>
                  <p className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-100 mt-1">
                    {selectedDetail.jam_masuk || (selectedDetail.waktu_absen ? formatTimeHHmm(selectedDetail.waktu_absen) : "-")}
                  </p>
                </div>

                <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <LogOut className="w-3 h-3" /> Jam Pulang
                  </span>
                  <p className="text-base font-extrabold font-mono text-slate-800 dark:text-slate-100 mt-1">
                    {selectedDetail.jam_pulang || "-"}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Validasi Lokasi:</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                    selectedDetail.status_lokasi === "Dalam Radius" || selectedDetail.status_lokasi === "Dalam Jangkauan"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  }`}>
                    {selectedDetail.status_lokasi || "Dalam Radius"}
                  </span>
                </div>

                {selectedDetail.latitude !== undefined && selectedDetail.longitude !== undefined && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-400 font-medium">Titik Koordinat:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedDetail.latitude}, {selectedDetail.longitude}
                    </span>
                  </div>
                )}

                {selectedDetail.keterangan && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-400 font-medium">Keterangan:</span>
                    <span className="text-slate-700 dark:text-slate-300">{selectedDetail.keterangan}</span>
                  </div>
                )}
              </div>

              {selectedDetail.latitude !== undefined && selectedDetail.longitude !== undefined && (
                <a
                  href={`https://www.google.com/maps?q=${selectedDetail.latitude},${selectedDetail.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Lihat di Google Maps</span>
                </a>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner QR Presensi (Static QR + GPS Geofencing 50m) */}
      <QRScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onSuccess={() => {
          fetchAttendanceHistory();
        }}
        currentUser={currentUser}
        guruId={resolvedGuruId}
        guruNama={resolvedGuruNama}
        defaultJenis={!todayRecord?.jam_masuk ? "Masuk" : "Pulang"}
        schoolCoords={schoolLocation}
        expectedQrToken={DEFAULT_STATIC_QR_TOKEN}
      />

      {/* Modal Cetak / Tampilkan QR Stasiun Sekolah */}
      <StationQRPrintModal
        isOpen={isStationQrModalOpen}
        onClose={() => setIsStationQrModalOpen(false)}
        token={DEFAULT_STATIC_QR_TOKEN}
      />
    </div>
  );
}
