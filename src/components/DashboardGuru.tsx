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
  ChevronRight, 
  FileText,
  Camera,
  QrCode
} from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";
import QRScannerModal, { DEFAULT_SCHOOL_COORDS, DEFAULT_STATIC_QR_TOKEN } from "./QRScannerModal";

const MySwal = withReactContent(Swal);

// Konfigurasi Lokasi Sekolah Al-Muttaqin (Radius 50m)
const SCHOOL_COORDINATES = {
  latitude: -7.227800, 
  longitude: 111.534500,
  radiusMeters: 50
};

function calculateDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
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

export interface DashboardGuruProps {
  currentUser?: { 
    username: string; 
    role: string; 
    name: string; 
    id?: string; 
    gender?: string; 
  } | null;
  onNavigateToPresensi?: () => void;
  onNavigateToJurnal?: () => void;
  // Fallbacks for existing router props
  onNavigateToAbsensiGuru?: () => void;
  onNavigateToJurnalMengajar?: () => void;
}

interface ScheduleItem {
  id: string;
  hari: string;
  jam_ke: number;
  kelas: string;
  mapel: string;
  guru_username: string;
}

interface LessonPeriod {
  id: string;
  jam_ke: number;
  mulai: string;
  selesai: string;
}

interface TodayAttendanceRecord {
  jam_masuk?: string | null;
  jam_pulang?: string | null;
  waktu_absen?: string | null;
  latitude?: number;
  longitude?: number;
  jarak_meter?: number;
}

export default function DashboardGuru({
  currentUser,
  onNavigateToPresensi,
  onNavigateToJurnal,
  onNavigateToAbsensiGuru,
  onNavigateToJurnalMengajar
}: DashboardGuruProps) {
  // Navigation helper mappings
  const handleGoToPresensi = onNavigateToPresensi || onNavigateToAbsensiGuru;
  const handleGoToJurnal = onNavigateToJurnal || onNavigateToJurnalMengajar;

  // 1. Live Realtime Clock
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedRealtimeClock = useMemo(() => {
    const hours = String(currentDateTime.getHours()).padStart(2, "0");
    const minutes = String(currentDateTime.getMinutes()).padStart(2, "0");
    const seconds = String(currentDateTime.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds} WIB`;
  }, [currentDateTime]);

  const formattedDate = useMemo(() => {
    return currentDateTime.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, [currentDateTime]);

  const daysId = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const currentDayName = daysId[currentDateTime.getDay()];
  const todayYMD = currentDateTime.toISOString().split("T")[0];

  // Data States
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [periods, setPeriods] = useState<LessonPeriod[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendanceRecord | null>(null);
  const [filledJournalCount, setFilledJournalCount] = useState<number>(0);
  const [totalJournalToday, setTotalJournalToday] = useState<number>(0);

  // GPS & QR State
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);

  // Fetch Data
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        // Fetch Jam Pelajaran
        const { data: dbPeriods } = await supabase
          .from("jam_pelajaran")
          .select("*")
          .order("jam_ke", { ascending: true });
        
        if (isMounted && dbPeriods && dbPeriods.length > 0) {
          setPeriods(dbPeriods);
        }

        // Fetch Jadwal Mengajar Guru
        let teacherSchedules: ScheduleItem[] = [];
        if (currentUser?.username) {
          const { data: dbSchedules } = await supabase
            .from("jadwal_pelajaran")
            .select("*")
            .eq("guru_username", currentUser.username);

          if (dbSchedules) {
            teacherSchedules = dbSchedules;
          } else {
            const cached = localStorage.getItem("school_schedules");
            if (cached) {
              const all: ScheduleItem[] = JSON.parse(cached);
              teacherSchedules = all.filter(s => s.guru_username === currentUser.username);
            }
          }
        }

        if (isMounted) {
          setSchedules(teacherSchedules);
          const schedulesToday = teacherSchedules.filter(
            s => s.hari.toLowerCase() === currentDayName.toLowerCase()
          );
          setTotalJournalToday(schedulesToday.length);
        }

        // Fetch Absensi Hari Ini
        if (currentUser?.username) {
          const { data: attData } = await supabase
            .from("absensi_guru")
            .select("*")
            .eq("username", currentUser.username)
            .eq("tanggal", todayYMD)
            .maybeSingle();

          if (isMounted) {
            if (attData) {
              setTodayAttendance(attData);
            } else {
              const localKey = `absensi_guru_${currentUser.username}_${todayYMD}`;
              const localSaved = localStorage.getItem(localKey);
              if (localSaved) {
                setTodayAttendance(JSON.parse(localSaved));
              } else {
                setTodayAttendance(null);
              }
            }
          }
        }

        // Fetch Jurnal Terisi Hari Ini
        let query = supabase.from("jurnal_mengajar").select("id, tanggal").eq("tanggal", todayYMD);
        if (currentUser?.name) {
          query = query.or(`nama_guru.eq.${currentUser.name},guru_username.eq.${currentUser.username}`);
        }
        const { data: dbJurnals } = await query;
        if (isMounted && dbJurnals) {
          setFilledJournalCount(dbJurnals.length);
        }
      } catch (err) {
        console.error("Gagal memuat dashboard guru:", err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [currentUser, todayYMD, currentDayName]);

  // Cek Lokasi GPS Cepat
  const handleCheckLocation = () => {
    if (!navigator.geolocation) {
      MySwal.fire({
        icon: "error",
        title: "GPS Tidak Didukung",
        text: "Browser perangkat Anda tidak mendukung fitur lokasi GPS.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const currentLat = pos.coords.latitude;
        const currentLng = pos.coords.longitude;
        const dist = calculateDistanceInMeters(
          currentLat,
          currentLng,
          SCHOOL_COORDINATES.latitude,
          SCHOOL_COORDINATES.longitude
        );

        setIsLocating(false);
        const inRadius = dist <= SCHOOL_COORDINATES.radiusMeters;

        if (inRadius) {
          MySwal.fire({
            icon: "success",
            title: "Dalam Radius Sekolah",
            text: `Lokasi terverifikasi (Jarak: ${Math.round(dist)} m). Anda dapat melakukan presensi sekarang.`,
            confirmButtonColor: "#2563eb",
            showCancelButton: true,
            confirmButtonText: !todayAttendance?.jam_masuk ? "Kirim Presensi Masuk" : "Kirim Presensi Pulang",
            cancelButtonText: "Batal"
          }).then((res) => {
            if (res.isConfirmed) {
              submitQuickPresensi(!todayAttendance?.jam_masuk ? "Masuk" : "Pulang", currentLat, currentLng, dist);
            }
          });
        } else {
          MySwal.fire({
            icon: "warning",
            title: "Di Luar Radius Sekolah",
            text: `Jarak Anda saat ini ${Math.round(dist)} m dari sekolah. Maksimal radius yang diizinkan adalah ${SCHOOL_COORDINATES.radiusMeters} meter.`,
            confirmButtonColor: "#2563eb"
          });
        }
      },
      (err) => {
        setIsLocating(false);
        MySwal.fire({
          icon: "error",
          title: "Izin Lokasi Ditolak",
          text: `Aktifkan izin GPS lokasi di peramban Anda untuk melakukan presensi. (${err.message})`,
          confirmButtonColor: "#2563eb"
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Submit Presensi
  const submitQuickPresensi = async (
    tipe: "Masuk" | "Pulang", 
    lat: number, 
    lng: number, 
    dist: number
  ) => {
    if (!currentUser?.username) return;
    setIsSubmitting(true);

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
        status_lokasi: dist <= SCHOOL_COORDINATES.radiusMeters ? "Dalam Radius" : "Di Luar Radius",
        status: "Hadir"
      };

      if (tipe === "Masuk") {
        payload.jam_masuk = timeStr;
      } else {
        payload.jam_pulang = timeStr;
      }

      await supabase.from("absensi_guru").upsert(payload, { onConflict: "username,tanggal" });

      const updated = { ...todayAttendance, ...payload };
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
        text: err?.message || "Terjadi kendala koneksi.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter 2-3 kelas terdekat hari ini
  const todayUpcomingSchedules = useMemo(() => {
    return schedules
      .filter((s) => s.hari.toLowerCase() === currentDayName.toLowerCase())
      .sort((a, b) => a.jam_ke - b.jam_ke)
      .slice(0, 3);
  }, [schedules, currentDayName]);

  return (
    <div className="flex flex-col min-h-full pb-8 pt-2 px-4 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* 1. HEADER */}
      <PageHeader 
        category="Portal Pendidik" 
        title="Dashboard Guru" 
        description="Ringkasan agenda mengajar dan presensi cepat hari ini." 
      />

      {/* 2 & 3. DUA WIDGET UTAMA (KIRI & KANAN) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* WIDGET ABSENSI RINGKAS (Kiri - 5 Kolom) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5">
          {/* Header Widget */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Waktu & Tanggal
              </span>
              <p className="text-2xl font-bold text-slate-800 tracking-tight">
                {formattedRealtimeClock}
              </p>
              <p className="text-xs font-medium text-slate-500">
                {formattedDate}
              </p>
            </div>

            {/* Badge Status Lokasi GPS (Radius 50m) */}
            <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Radius: 50m</span>
            </div>
          </div>

          {/* Card Indikator Ringkas: Jam Masuk & Jam Pulang */}
          <div className="grid grid-cols-2 gap-3">
            {/* Jam Masuk */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium">Jam Masuk</span>
                <LogIn className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div>
                {todayAttendance?.jam_masuk ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-slate-800">
                      {todayAttendance.jam_masuk}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      Tercatat
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-slate-400">
                    Belum Absen
                  </span>
                )}
              </div>
            </div>

            {/* Jam Pulang */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium">Jam Pulang</span>
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div>
                {todayAttendance?.jam_pulang ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-slate-800">
                      {todayAttendance.jam_pulang}
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold">
                      Tercatat
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-slate-400">
                    Belum Absen
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tombol Aksi Presensi: Scan QR Presensi Utama & Cek Titik Lokasi */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-bold shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>Scan QR Presensi (QR + GPS 50m)</span>
            </button>

            <button
              type="button"
              onClick={handleCheckLocation}
              disabled={isLocating || isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-70"
            >
              {isLocating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  <span>Memeriksa Titik GPS...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cek Titik Lokasi Manual</span>
                </>
              )}
            </button>

            {/* Link kecil di bawah tombol: "Lihat Riwayat & Pengajuan Izin →" */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleGoToPresensi}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 font-medium transition-colors cursor-pointer"
              >
                <span>Lihat Riwayat & Pengajuan Izin</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* WIDGET JADWAL MENGAJAR HARI INI (Kanan - 7 Kolom) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header Widget */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Jadwal Mengajar Hari Ini ({currentDayName})
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {todayUpcomingSchedules.length} Sesi Terdekat
              </span>
            </div>

            {/* List Jadwal Mengajar (Maksimal 2-3 kelas terdekat) */}
            {todayUpcomingSchedules.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-500">
                  Tidak ada agenda mengajar hari ini untuk akun Anda.
                </p>
                <p className="text-[11px] text-slate-400">
                  Gunakan waktu luang untuk rekap jurnal atau persiapan materi.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayUpcomingSchedules.map((item, idx) => {
                  const period = periods.find(p => p.jam_ke === item.jam_ke);
                  const periodTime = period ? `${period.mulai} - ${period.selesai}` : `Jam ke-${item.jam_ke}`;

                  return (
                    <div 
                      key={item.id || idx}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex flex-col items-center justify-center font-bold text-xs shrink-0">
                          <span className="text-[9px] uppercase font-medium">Jam</span>
                          <span>{item.jam_ke}</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">
                            {item.mapel}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">Kelas {item.kelas}</span>
                            <span>•</span>
                            <span className="font-mono text-[11px]">{periodTime}</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-medium text-slate-400">
                        {item.hari}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tombol Shortcut: "Buka Jurnal Mengajar" */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleGoToJurnal}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Buka Jurnal Mengajar</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. BANNER PENGUMUMAN / STATUS JURNAL (Bawah) */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                Status Pengisian Jurnal Mengajar
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                Hari Ini
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalJournalToday > 0 ? (
                <span>
                  <strong className="text-slate-700">{filledJournalCount}</strong> dari{" "}
                  <strong className="text-slate-700">{totalJournalToday}</strong> Jurnal Kelas Sudah Diisi.
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
          onClick={handleGoToJurnal}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
        >
          <span>Isi Jurnal Baru</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Modal Scanner QR Presensi */}
      <QRScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onSuccess={() => {
          // Refresh status presensi
          if (currentUser?.username) {
            supabase
              .from("absensi_guru")
              .select("*")
              .eq("username", currentUser.username)
              .eq("tanggal", todayYMD)
              .maybeSingle()
              .then(({ data }) => {
                if (data) setTodayAttendance(data);
              });
          }
        }}
        currentUser={currentUser}
        defaultJenis={!todayAttendance?.jam_masuk ? "Masuk" : "Pulang"}
        schoolCoords={SCHOOL_COORDINATES}
        expectedQrToken={DEFAULT_STATIC_QR_TOKEN}
      />
    </div>
  );
}
