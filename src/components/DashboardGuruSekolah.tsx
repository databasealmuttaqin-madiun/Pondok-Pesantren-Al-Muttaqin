import React, { useState, useEffect, useMemo } from "react";
import { 
  MapPin, 
  Clock, 
  Calendar, 
  BookOpen, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  LogIn, 
  LogOut, 
  RefreshCw, 
  AlertTriangle, 
  ChevronRight, 
  FileText,
  AlertCircle
} from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { SantriData, supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

const MySwal = withReactContent(Swal);

// Konfigurasi Default Lokasi Sekolah
const DEFAULT_SCHOOL_LOCATION = {
  latitude: -6.200000, 
  longitude: 106.816666,
  radiusMeters: 50 // Sesuai spesifikasi radius 50m
};

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

interface DashboardProps {
  students?: SantriData[];
  onNavigateToForm?: () => void;
  onNavigateToList?: (filters?: { category?: string; status?: string }) => void;
  onNavigateToAbsensiGuru?: () => void;
  onNavigateToJurnalMengajar?: () => void;
  isDarkMode?: boolean;
  setIsDarkMode?: (val: boolean) => void;
  currentUser?: { username: string; role: string; name: string; id?: string; gender?: string } | null;
  onLogout?: () => void;
}

interface ClassSchedule {
  id: string;
  hari: string;
  jam_ke: number;
  kelas: string;
  mapel: string;
  guru_username: string;
  guru_nama: string;
}

interface LessonPeriod {
  id: string;
  jam_ke: number;
  mulai: string;
  selesai: string;
}

interface AttendanceToday {
  jam_masuk?: string | null;
  jam_pulang?: string | null;
  waktu_absen?: string | null;
  latitude?: number;
  longitude?: number;
  jarak_meter?: number;
}

export default function DashboardGuruSekolah({ 
  currentUser,
  onNavigateToAbsensiGuru,
  onNavigateToJurnalMengajar
}: DashboardProps) {
  // 1. Live Clock State
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Jam Realtime
  const formattedRealtimeClock = useMemo(() => {
    const hours = String(currentDateTime.getHours()).padStart(2, "0");
    const minutes = String(currentDateTime.getMinutes()).padStart(2, "0");
    const seconds = String(currentDateTime.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds} WIB`;
  }, [currentDateTime]);

  // Format Hari & Tanggal Lengkap
  const formattedDate = useMemo(() => {
    return currentDateTime.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, [currentDateTime]);

  // Hari Ini dalam format Indonesia
  const daysId = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const currentDayName = daysId[currentDateTime.getDay()];
  const todayYMD = currentDateTime.toISOString().split("T")[0];

  // State Jadwal & Pengaturan
  const [mySchedules, setMySchedules] = useState<ClassSchedule[]>([]);
  const [periods, setPeriods] = useState<LessonPeriod[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceToday | null>(null);
  const [filledJournalCount, setFilledJournalCount] = useState<number>(0);
  const [totalJournalToday, setTotalJournalToday] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // GPS & Radius State
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmittingPresensi, setIsSubmittingPresensi] = useState(false);

  // Load Dashboard Data
  useEffect(() => {
    loadData();
  }, [currentUser, todayYMD, currentDayName]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Ambil Lesson Periods
      const { data: dbPeriods } = await supabase.from("jam_pelajaran").select("*").order("jam_ke", { ascending: true });
      if (dbPeriods && dbPeriods.length > 0) {
        setPeriods(dbPeriods);
      }

      // 2. Ambil Jadwal Mengajar Guru
      let teacherSchedules: ClassSchedule[] = [];
      if (currentUser?.username) {
        const { data: dbSchedules } = await supabase
          .from("jadwal_pelajaran")
          .select("*")
          .eq("guru_username", currentUser.username);
        
        if (dbSchedules) {
          teacherSchedules = dbSchedules;
          setMySchedules(dbSchedules);
        } else {
          const cached = localStorage.getItem("school_schedules");
          if (cached) {
            const allSch: ClassSchedule[] = JSON.parse(cached);
            teacherSchedules = allSch.filter(s => s.guru_username === currentUser.username);
            setMySchedules(teacherSchedules);
          }
        }
      }

      // Filter jadwal hari ini
      const schedulesToday = teacherSchedules.filter(s => s.hari.toLowerCase() === currentDayName.toLowerCase());
      setTotalJournalToday(schedulesToday.length);

      // 3. Ambil Presensi Guru Hari Ini
      if (currentUser?.username) {
        const { data: attData } = await supabase
          .from("absensi_guru")
          .select("*")
          .eq("username", currentUser.username)
          .eq("tanggal", todayYMD)
          .maybeSingle();

        if (attData) {
          setTodayAttendance(attData);
        } else {
          // Cek localStorage fallback
          const localKey = `absensi_guru_${currentUser.username}_${todayYMD}`;
          const localSaved = localStorage.getItem(localKey);
          if (localSaved) {
            setTodayAttendance(JSON.parse(localSaved));
          } else {
            setTodayAttendance(null);
          }
        }
      }

      // 4. Ambil Jurnal Mengajar Hari Ini
      try {
        let query = supabase.from("jurnal_mengajar").select("id, kelas, mata_pelajaran, tanggal").eq("tanggal", todayYMD);
        if (currentUser?.name) {
          query = query.or(`nama_guru.eq.${currentUser.name},guru_username.eq.${currentUser.username}`);
        }
        const { data: dbJurnals } = await query;
        if (dbJurnals) {
          setFilledJournalCount(dbJurnals.length);
        } else {
          const cachedJurnals = localStorage.getItem("jurnal_mengajar_list");
          if (cachedJurnals) {
            const parsed = JSON.parse(cachedJurnals);
            const count = parsed.filter((j: any) => j.tanggal === todayYMD).length;
            setFilledJournalCount(count);
          }
        }
      } catch (_) {
        // Abaikan jika tabel belum ada
      }

    } catch (e) {
      console.error("Gagal memuat data dashboard guru:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Cek GPS Cepat
  const handleCheckLocation = () => {
    if (!navigator.geolocation) {
      MySwal.fire({
        icon: "error",
        title: "GPS Tidak Didukung",
        text: "Browser atau perangkat Anda tidak mendukung fitur geolokasi GPS.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const currentLat = pos.coords.latitude;
        const currentLng = pos.coords.longitude;
        setLocation({ lat: currentLat, lng: currentLng });

        const dist = getDistanceFromLatLonInM(
          currentLat,
          currentLng,
          DEFAULT_SCHOOL_LOCATION.latitude,
          DEFAULT_SCHOOL_LOCATION.longitude
        );
        setDistance(dist);
        setIsLocating(false);

        const inRadius = dist <= DEFAULT_SCHOOL_LOCATION.radiusMeters;
        if (inRadius) {
          MySwal.fire({
            icon: "success",
            title: "Dalam Radius Sekolah",
            text: `Lokasi Anda terverifikasi akurat (Jarak: ${Math.round(dist)} m). Anda dapat mengirim presensi sekarang.`,
            confirmButtonColor: "#2563eb",
            showCancelButton: true,
            confirmButtonText: !todayAttendance?.jam_masuk ? "Kirim Presensi Masuk" : "Kirim Presensi Pulang",
            cancelButtonText: "Tutup"
          }).then((res) => {
            if (res.isConfirmed) {
              handleSubmitPresensiQuick(!todayAttendance?.jam_masuk ? "Masuk" : "Pulang", currentLat, currentLng, dist);
            }
          });
        } else {
          MySwal.fire({
            icon: "warning",
            title: "Di Luar Radius Sekolah",
            text: `Jarak Anda ${Math.round(dist)} m dari sekolah (Maksimal radius 50m). Silakan mendekat ke area sekolah.`,
            confirmButtonColor: "#2563eb"
          });
        }
      },
      (err) => {
        setIsLocating(false);
        MySwal.fire({
          icon: "error",
          title: "Izin Lokasi Ditolak",
          text: `Pastikan izin lokasi GPS di browser/ponsel Anda aktif. (${err.message})`,
          confirmButtonColor: "#2563eb"
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Submit Presensi Cepat dari Dashboard
  const handleSubmitPresensiQuick = async (
    tipe: "Masuk" | "Pulang", 
    lat: number, 
    lng: number, 
    dist: number
  ) => {
    if (!currentUser?.username) return;
    setIsSubmittingPresensi(true);

    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const payload: any = {
        username: currentUser.username,
        nama_guru: currentUser.name || currentUser.username,
        tanggal: todayYMD,
        waktu_absen: now.toISOString(),
        latitude: lat,
        longitude: lng,
        jarak_meter: Math.round(dist),
        status_lokasi: dist <= DEFAULT_SCHOOL_LOCATION.radiusMeters ? "Dalam Radius" : "Di Luar Radius",
        status: "Hadir"
      };

      if (tipe === "Masuk") {
        payload.jam_masuk = timeStr;
      } else {
        payload.jam_pulang = timeStr;
      }

      // Upsert Supabase
      const { error } = await supabase.from("absensi_guru").upsert(payload, { onConflict: "username,tanggal" });
      
      // Update local state
      const updated = {
        ...todayAttendance,
        ...payload
      };
      setTodayAttendance(updated);
      localStorage.setItem(`absensi_guru_${currentUser.username}_${todayYMD}`, JSON.stringify(updated));

      MySwal.fire({
        icon: "success",
        title: `Presensi ${tipe} Berhasil`,
        text: `Presensi ${tipe} Anda tercatat pada pukul ${timeStr} WIB.`,
        confirmButtonColor: "#2563eb",
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      MySwal.fire({
        icon: "error",
        title: "Gagal Mengirim Presensi",
        text: err?.message || "Terjadi kesalahan koneksi.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setIsSubmittingPresensi(false);
    }
  };

  // Filter Jadwal Terdekat Hari Ini (Maks 2-3 kelas)
  const todaySchedules = useMemo(() => {
    return mySchedules
      .filter((sch) => sch.hari.toLowerCase() === currentDayName.toLowerCase())
      .sort((a, b) => a.jam_ke - b.jam_ke)
      .slice(0, 3);
  }, [mySchedules, currentDayName]);

  return (
    <div className="flex flex-col min-h-full pb-8 pt-2 px-4 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* 1. HEADER STANDAR */}
      <PageHeader 
        category="Portal Pendidik" 
        title="Dashboard Guru" 
        description="Ringkasan agenda mengajar dan presensi cepat hari ini." 
      />

      {/* 2 & 3. DUA KOLOM UTAMA: WIDGET ABSENSI RINGKAS (KIRI) & WIDGET JADWAL MENGAJAR (KANAN) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* WIDGET ABSENSI RINGKAS (Kiri - 5 Kolom) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between space-y-5">
          {/* Header Widget */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Waktu & Tanggal
              </span>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                {formattedRealtimeClock}
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {formattedDate}
              </p>
            </div>

            {/* Badge Status Lokasi GPS (Radius 50m) */}
            <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Radius: 50m</span>
            </div>
          </div>

          {/* Card Indikator Ringkas: Jam Masuk & Jam Pulang */}
          <div className="grid grid-cols-2 gap-3">
            {/* Jam Masuk */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800/60 flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Jam Masuk</span>
                <LogIn className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div>
                {todayAttendance?.jam_masuk ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {todayAttendance.jam_masuk}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Tercatat
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    Belum Absen
                  </span>
                )}
              </div>
            </div>

            {/* Jam Pulang */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800/60 flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Jam Pulang</span>
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div>
                {todayAttendance?.jam_pulang ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {todayAttendance.jam_pulang}
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                      Tercatat
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    Belum Absen
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 1 Tombol Aksi GPS Utama: Cek Titik Lokasi Saat Ini */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleCheckLocation}
              disabled={isLocating || isSubmittingPresensi}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-70"
            >
              {isLocating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Memeriksa GPS...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-white" />
                  <span>Cek Titik Lokasi Saat Ini</span>
                </>
              )}
            </button>

            {/* Link kecil di bawah tombol: "Lihat Riwayat & Pengajuan Izin →" */}
            <div className="text-center">
              <button
                type="button"
                onClick={onNavigateToAbsensiGuru}
                className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors cursor-pointer"
              >
                <span>Lihat Riwayat & Pengajuan Izin</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* WIDGET JADWAL MENGAJAR HARI INI (Kanan - 7 Kolom) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header Widget */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Jadwal Mengajar Hari Ini ({currentDayName})
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {todaySchedules.length} Sesi Terdekat
              </span>
            </div>

            {/* List Jadwal Mengajar (Maksimal 2-3 kelas terdekat) */}
            {todaySchedules.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Tidak ada agenda mengajar hari ini untuk akun Anda.
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Gunakan waktu luang untuk rekap jurnal atau persiapan materi.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todaySchedules.map((item, idx) => {
                  const period = periods.find(p => p.jam_ke === item.jam_ke);
                  const periodTime = period ? `${period.mulai} - ${period.selesai}` : `Jam ke-${item.jam_ke}`;

                  return (
                    <div 
                      key={item.id || idx}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 flex flex-col items-center justify-center font-bold text-xs shrink-0">
                          <span className="text-[9px] uppercase font-medium">Jam</span>
                          <span>{item.jam_ke}</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {item.mapel}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Kelas {item.kelas}</span>
                            <span>•</span>
                            <span className="font-mono text-[11px]">{periodTime}</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        {item.hari}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tombol Shortcut: "Buka Jurnal Mengajar" */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onNavigateToJurnalMengajar}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Buka Jurnal Mengajar</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. BANNER PENGUMUMAN / STATUS JURNAL (Bawah) */}
      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100/70 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Status Pengisian Jurnal Mengajar
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                Hari Ini
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {totalJournalToday > 0 ? (
                <span>
                  <strong className="text-slate-700 dark:text-slate-200">{filledJournalCount}</strong> dari{" "}
                  <strong className="text-slate-700 dark:text-slate-200">{totalJournalToday}</strong> Jurnal Kelas Sudah Diisi.
                </span>
              ) : (
                <span>
                  Tidak ada jadwal kelas wajib untuk hari ini.
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToJurnalMengajar}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors cursor-pointer"
        >
          <span>Isi Jurnal Baru</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

