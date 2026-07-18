import React, { useState, useEffect } from "react";
import { 
  Users, 
  GraduationCap, 
  Map, 
  Calendar, 
  ArrowUpRight, 
  TrendingUp, 
  BookOpen, 
  Quote, 
  LogOut, 
  MessageCircle, 
  Headphones,
  Clock,
  Megaphone,
  BookMarked
} from "lucide-react";
import { SantriData, supabase } from "../supabaseClient";

interface DashboardProps {
  students: SantriData[];
  onNavigateToForm: () => void;
  onNavigateToList: (filters?: { category?: string; status?: string }) => void;
  onNavigateToAbsensiGuru?: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  currentUser?: { username: string; role: string; name: string; gender?: string } | null;
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

interface TeacherAnnouncement {
  id: string;
  judul: string;
  isi: string;
  tanggal: string;
  dibuat_oleh: string;
}

export default function DashboardGuruSekolah({ students, onNavigateToForm, onNavigateToList, onNavigateToAbsensiGuru, isDarkMode, setIsDarkMode, currentUser, onLogout }: DashboardProps) {
  const [mySchedules, setMySchedules] = useState<ClassSchedule[]>([]);
  const [periods, setPeriods] = useState<LessonPeriod[]>([]);
  const [announcements, setAnnouncements] = useState<TeacherAnnouncement[]>([]);

  // Compute basic metrics
  const totalCount = students.length;
  const smpCount = students.filter((s) => s.kategori === "SMP").length;
  const smaCount = students.filter((s) => s.kategori === "SMA").length;
  const regulerCount = students.filter((s) => s.kategori === "Reguler").length;

  const aktifCount = students.filter((s) => (s.status || "Aktif") === "Aktif").length;
  const sakitCount = students.filter((s) => (s.status || "Aktif") === "Sakit").length;
  const pulangCount = students.filter((s) => (s.status || "Aktif") === "Pulang").length;
  const haidCount = students.filter((s) => (s.status || "Aktif") === "Haid").length;

  // Compute percentages
  const smpPercent = totalCount ? Math.round((smpCount / totalCount) * 100) : 0;
  const smaPercent = totalCount ? Math.round((smaCount / totalCount) * 100) : 0;
  const regulerPercent = totalCount ? Math.round((regulerCount / totalCount) * 100) : 0;
  const aktifPercent = totalCount ? Math.round((aktifCount / totalCount) * 100) : 0;
  const sakitPercent = totalCount ? Math.round((sakitCount / totalCount) * 100) : 0;
  const pulangPercent = totalCount ? Math.round((pulangCount / totalCount) * 100) : 0;
  const haidPercent = totalCount ? Math.round((haidCount / totalCount) * 100) : 0;

  // Group by daerah
  const daerahCounts = students.reduce((acc, current) => {
    const d = current.daerah || "Lainnya";
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedDaerah = Object.entries(daerahCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Recent 4 registrations
  const recentStudents = [...students]
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 4);

  // Date calculation
  const d = new Date();
  const daysId = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthsId = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const currentDateFormatted = `${daysId[d.getDay()]}, ${d.getDate()} ${monthsId[d.getMonth()]} ${d.getFullYear()}`;
  const currentDayEn = daysEn[d.getDay()];

  // Fetch teaching schedules and announcements specifically for the logged in teacher
  useEffect(() => {
    const loadDashboardData = async () => {
      // 1. Fetch lesson periods
      try {
        const { data: dbPeriods } = await supabase.from("jam_pelajaran").select("*").order("jam_ke", { ascending: true });
        if (dbPeriods && dbPeriods.length > 0) {
          setPeriods(dbPeriods);
        } else {
          const cached = localStorage.getItem("school_lesson_periods");
          if (cached) setPeriods(JSON.parse(cached));
        }
      } catch (e) {
        const cached = localStorage.getItem("school_lesson_periods");
        if (cached) setPeriods(JSON.parse(cached));
      }

      // 2. Fetch schedules filtered by logged in teacher's username
      if (currentUser?.username) {
        try {
          const { data: dbSchedules } = await supabase
            .from("jadwal_pelajaran")
            .select("*")
            .eq("guru_username", currentUser.username);
          if (dbSchedules) {
            setMySchedules(dbSchedules);
          } else {
            const cached = localStorage.getItem("school_schedules");
            if (cached) {
              const allSch: ClassSchedule[] = JSON.parse(cached);
              setMySchedules(allSch.filter(s => s.guru_username === currentUser.username));
            }
          }
        } catch (e) {
          const cached = localStorage.getItem("school_schedules");
          if (cached) {
            const allSch: ClassSchedule[] = JSON.parse(cached);
            setMySchedules(allSch.filter(s => s.guru_username === currentUser.username));
          }
        }
      }

      // 3. Fetch announcements
      try {
        const { data: dbAnn } = await supabase.from("pengumuman_guru").select("*").order("tanggal", { ascending: false });
        if (dbAnn) {
          setAnnouncements(dbAnn);
        } else {
          const cached = localStorage.getItem("school_announcements");
          if (cached) setAnnouncements(JSON.parse(cached));
        }
      } catch (e) {
        const cached = localStorage.getItem("school_announcements");
        if (cached) setAnnouncements(JSON.parse(cached));
      }
    };

    loadDashboardData();
  }, [currentUser]);

  const daysList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  return (
    <div className="flex flex-col min-h-full pb-6" id="dashboard_container_id">
      {/* Blue Header Section */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 px-6 pt-6 pb-28 md:px-10 md:pt-8 md:pb-32 relative shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Dashboard Guru Sekolah</h1>
            <p className="text-blue-50 font-medium text-sm mt-1">{currentDateFormatted}</p>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white px-4 py-2 rounded shadow-sm font-bold text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>

        {/* Banner Card */}
        <div className="absolute left-6 right-6 -bottom-10 md:left-10 md:right-10 md:-bottom-8 bg-gradient-to-r from-white to-blue-50/30 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col md:flex-row overflow-hidden border border-slate-100 z-10">
          {/* Left side text/buttons */}
          <div className="flex-1 p-4 md:p-5 flex flex-col justify-center">
            <h2 className="text-lg md:text-xl font-normal text-slate-900">Halo, <span className="font-bold text-[#0c66e4] uppercase">{currentUser?.name || "ADMIN"}</span></h2>
            <p className="text-slate-500 mt-0.5 text-xs font-medium">Have a Nice {currentDayEn}!</p>
            
            <div className="flex flex-wrap items-center gap-2 mt-3.5">
              <button 
                onClick={onNavigateToAbsensiGuru}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-3 py-1.5 rounded font-bold text-[10px] transition-colors shadow-sm"
              >
                <Map className="w-3.5 h-3.5" /> Absensi Anda
              </button>
              <button className="flex items-center gap-1.5 bg-gradient-to-r from-[#0c66e4] to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white px-3 py-1.5 rounded font-bold text-[10px] transition-colors shadow-sm">
                <Calendar className="w-3.5 h-3.5" /> Pengumuman & Kalender
              </button>
              <button className="flex items-center gap-1.5 bg-gradient-to-r from-[#4285F4] to-blue-500 hover:from-blue-600 hover:to-blue-600 text-white px-3 py-1.5 rounded font-bold text-[10px] transition-colors shadow-sm">
                <MessageCircle className="w-3.5 h-3.5" /> Grup Chat
              </button>
              <button className="flex items-center gap-1.5 bg-gradient-to-r from-[#FBD148] to-[#fbc531] hover:from-yellow-500 hover:to-yellow-500 text-slate-900 px-3 py-1.5 rounded font-bold text-[10px] transition-colors shadow-sm">
                <Headphones className="w-3.5 h-3.5" /> Bantuan
              </button>
            </div>
          </div>
          
          {/* Right side illustration area */}
          <div className="hidden md:flex w-64 bg-gradient-to-r from-transparent to-[#e8f0fe] relative overflow-hidden shrink-0 items-center justify-end">
             {/* Gradient overlay to smoothly blend the image with the left section */}
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-blue-50/30 via-white/80 to-transparent z-10" />
            <img 
              src="https://img.freepik.com/free-vector/modern-business-team-working-open-office-space_74855-5541.jpg" 
              alt="Illustration" 
              className="h-[120%] object-cover mix-blend-multiply opacity-75 transform -translate-y-2 translate-x-4" 
            />
          </div>
        </div>
      </div>

      {/* Main Content Area (Metrics etc) */}
      <div className="px-6 mt-16 md:mt-14 md:px-10 flex-1 space-y-6">
        {/* 2. Numerical Metrics Stats Bento-Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" id="stats-bento-grid">
        {/* STAT 1: TOTAL */}
        <div 
          onClick={() => onNavigateToList()}
          className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-2 hover:translate-y-[-1px] transition-transform duration-150 flex flex-col justify-between cursor-pointer hover:border-sky-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Total Santri</span>
            <div className="p-1.5 bg-sky-50 rounded text-sky-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900 tracking-tight block">{totalCount}</span>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Terdaftar Database</span>
          </div>
        </div> 

        {/* STAT 2: SMP */}
        <div 
          onClick={() => onNavigateToList({ category: "SMP" })}
          className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-2 hover:translate-y-[-1px] transition-transform duration-150 flex flex-col justify-between cursor-pointer hover:border-blue-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Jenjang SMP</span>
            <div className="p-1.5 bg-blue-50 rounded text-blue-700">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 tracking-tight">{smpCount}</span>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded font-mono">{smpPercent}%</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Smp Ponpes</span>
          </div>
        </div> 

        {/* STAT 3: SMA */}
        <div 
          onClick={() => onNavigateToList({ category: "SMA" })}
          className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-2 hover:translate-y-[-1px] transition-transform duration-150 flex flex-col justify-between cursor-pointer hover:border-indigo-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Jenjang SMA</span>
            <div className="p-1.5 bg-indigo-50 rounded text-indigo-700">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 tracking-tight">{smaCount}</span>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded font-mono">{smaPercent}%</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Sma Ponpes</span>
          </div>
        </div> 

        {/* STAT 4: REGULER */}
        <div 
          onClick={() => onNavigateToList({ category: "Reguler" })}
          className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-2 hover:translate-y-[-1px] transition-transform duration-150 flex flex-col justify-between cursor-pointer hover:border-amber-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Kategori Reguler</span>
            <div className="p-1.5 bg-amber-50 rounded text-amber-700">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 tracking-tight">{regulerCount}</span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded font-mono">{regulerPercent}%</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Luar Formal</span>
          </div>
        </div>
      </div> 

      {/* Row 2: Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* STAT: AKTIF */}
        <div 
          onClick={() => onNavigateToList({ status: "Aktif" })}
          className="bg-white rounded-xl border border-emerald-100 p-3.5 shadow-sm space-y-2 hover:translate-y-[-1px] transition-transform duration-150 flex flex-col justify-between cursor-pointer hover:border-emerald-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-600 uppercase font-black tracking-wider">Status Aktif</span>
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-600">
              <span className="w-3 h-3 rounded-full bg-emerald-500 block"></span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 tracking-tight">{aktifCount}</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded font-mono">{aktifPercent}%</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Santri Mukim</span>
          </div>
        </div>
        
        {/* STAT: SAKIT */}
        <div 
          onClick={() => onNavigateToList({ status: "Sakit" })}
          className="bg-white rounded-xl border border-amber-100 p-3.5 shadow-sm space-y-2 hover:translate-y-[-1px] transition-transform duration-150 flex flex-col justify-between cursor-pointer hover:border-amber-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-600 uppercase font-black tracking-wider">Status Sakit</span>
            <div className="p-1.5 bg-amber-50 rounded text-amber-500">
              <span className="w-3 h-3 rounded-full bg-amber-400 block"></span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 tracking-tight">{sakitCount}</span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded font-mono">{sakitPercent}%</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Perawatan / Istirahat</span>
          </div>
        </div>

        {/* STAT: PULANG */}
        <div 
          onClick={() => onNavigateToList({ status: "Pulang" })}
          className="bg-white rounded-xl border border-rose-100 p-3.5 shadow-sm space-y-2 hover:translate-y-[-1px] transition-transform duration-150 flex flex-col justify-between cursor-pointer hover:border-rose-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-600 uppercase font-black tracking-wider">Status Pulang</span>
            <div className="p-1.5 bg-rose-50 rounded text-rose-500">
              <span className="w-3 h-3 rounded-full bg-rose-500 block"></span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 tracking-tight">{pulangCount}</span>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded font-mono">{pulangPercent}%</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Izin / Kembali</span>
          </div>
        </div>

        {/* STAT: HAID */}
        <div 
          onClick={() => onNavigateToList({ status: "Haid" })}
          className="bg-white rounded-xl border border-pink-100 p-3.5 shadow-sm space-y-2 hover:translate-y-[-1px] transition-transform duration-150 flex flex-col justify-between cursor-pointer hover:border-pink-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-pink-600 uppercase font-black tracking-wider">Status Haid</span>
            <div className="p-1.5 bg-pink-50 rounded text-pink-500">
              <span className="w-3 h-3 rounded-full bg-pink-500 block"></span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 tracking-tight">{haidCount}</span>
              <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-1 rounded font-mono">{haidPercent}%</span>
            </div>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider font-sans">Izin Sholat</span>
          </div>
        </div>
      </div>

      {/* 3. Graphical Breakdown & Recent Submissions Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="dashboard-tables-layout">
        {/* GAUGE STATS & REGION LISTING (Left: 5 columns) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Regional distribution table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Map className="w-3.5 h-3.5 text-sky-600" /> Daerah Sambung
            </h3>
            
            {sortedDaerah.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-3 italic">Belum ada sebaran wilayah.</p>
            ) : (
              <div className="space-y-2">
                {sortedDaerah.map(([daerah, count]) => {
                  const percent = totalCount ? Math.round((count / totalCount) * 100) : 0;
                  return (
                    <div key={daerah} className="flex items-center justify-between text-[11px] py-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                        <span className="font-semibold text-slate-600">Daerah {daerah}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 font-mono">{count} anak</span>
                        <span className="bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-mono border border-slate-100">{percent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div> 

        {/* RECENT SUBMISSIONS LISTING (Right: 7 columns) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" /> Registrasi Santri Terbaru
              </h3>
              <button
                onClick={() => onNavigateToList()}
                className="text-sky-600 text-[11px] hover:underline font-bold cursor-pointer"
              >
                Lihat Semua
              </button>
            </div> 

            {recentStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic">
                Belum ada pendaftaran terekam dalam sistem.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentStudents.map((s) => (
                  <div key={s.id || s.nik} className="py-2.5 flex items-center justify-between gap-3 group/item">
                    <div className="flex items-center gap-2.5">
                      {s.foto ? (
                        <img src={s.foto} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-150" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center font-bold text-[10px] text-slate-600 group-hover/item:bg-sky-50 group-hover/item:text-sky-600 transition-colors shrink-0">
                          {s.nama_lengkap.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-xs text-slate-800 group-hover/item:text-sky-900 truncate max-w-[150px] md:max-w-[240px]">
                          {s.nama_lengkap}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-medium">
                          NIK: <code className="font-mono">{s.nik}</code>
                        </span>
                      </div>
                    </div> 

                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span
                        className={`text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                          s.kategori === "SMP"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : s.kategori === "SMA"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {s.kategori}
                      </span>
                      <span className="text-[8px] text-slate-400 font-bold">{s.daerah}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div> 

          <div className="pt-2 border-t border-slate-100 flex justify-center">
            <button
              onClick={onNavigateToForm}
              className="bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] px-3.5 py-1.5 rounded transition-all flex items-center gap-1 cursor-pointer animate-pulse"
            >
              🚀 Tambah Santri
            </button>
          </div>
        </div> 

      </div>

      {/* Row 4: Jadwal Mengajar Guru & Pengumuman Guru */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" id="teacher-info-section">
        {/* Jadwal Mengajar Anda */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#0c66e4]" /> Jadwal Mengajar Anda
            </h3>
            <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded font-mono">
              {mySchedules.length} Sesi Mengajar
            </span>
          </div>

          {mySchedules.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs italic">
              Tidak ada jadwal mengajar terdaftar untuk akun Anda ({currentUser?.username || "Guest"}).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-extrabold uppercase text-slate-450">
                    <th className="p-2">Hari</th>
                    <th className="p-2">Jam Ke</th>
                    <th className="p-2">Waktu</th>
                    <th className="p-2">Kelas</th>
                    <th className="p-2">Mapel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {mySchedules
                    .sort((a, b) => {
                      const dayOrderA = daysList.indexOf(a.hari);
                      const dayOrderB = daysList.indexOf(b.hari);
                      if (dayOrderA !== dayOrderB) return dayOrderA - dayOrderB;
                      return a.jam_ke - b.jam_ke;
                    })
                    .map((sch) => {
                      const period = periods.find(p => p.jam_ke === sch.jam_ke);
                      const timeStr = period ? `${period.mulai} - ${period.selesai}` : "--:--";
                      return (
                        <tr key={sch.id} className="hover:bg-slate-50/50">
                          <td className="p-2 font-black text-blue-700 uppercase">{sch.hari}</td>
                          <td className="p-2">Ke-{sch.jam_ke}</td>
                          <td className="p-2 font-mono text-[10px] text-slate-500">{timeStr}</td>
                          <td className="p-2 font-bold text-slate-900">Kelas {sch.kelas}</td>
                          <td className="p-2 font-semibold text-slate-800">{sch.mapel}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pengumuman Guru */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-orange-500" /> Pengumuman Resmi Guru
            </h3>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs italic">
              Belum ada pengumuman guru diterbitkan.
            </div>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-3 border border-slate-150 rounded-xl bg-orange-50/10 space-y-1 hover:border-orange-200 transition-colors">
                  <div className="flex justify-between items-center gap-2">
                    <h4 className="font-bold text-xs text-slate-900">{ann.judul}</h4>
                    <span className="text-[9px] text-slate-400 font-bold">{ann.tanggal}</span>
                  </div>
                  <p className="text-[11px] text-slate-650 leading-relaxed whitespace-pre-wrap font-medium">
                    {ann.isi}
                  </p>
                  <div className="text-[8px] font-extrabold uppercase tracking-wide text-slate-400 pt-1 border-t border-slate-100/50">
                    Oleh: {ann.dibuat_oleh}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </div>
    </div>
  );
}
