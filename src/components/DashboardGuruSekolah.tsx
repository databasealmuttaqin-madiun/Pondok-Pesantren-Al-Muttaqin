import React, { useState, useEffect } from "react";
import { 
  Users, 
  GraduationCap, 
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
    <div className="flex flex-col min-h-full pb-6 pt-4 px-4 md:px-8 space-y-6" id="dashboard_container_id">
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
  );
}
