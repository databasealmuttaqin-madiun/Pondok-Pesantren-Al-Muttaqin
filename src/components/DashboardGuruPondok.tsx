import React from "react";
import { Users, GraduationCap, Map, Calendar, ArrowUpRight, TrendingUp, BookOpen, Quote, LogOut, MessageCircle, Headphones } from "lucide-react";
import { SantriData } from "../supabaseClient";

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

export default function DashboardGuruPondok({ students, onNavigateToForm, onNavigateToList, onNavigateToAbsensiGuru, isDarkMode, setIsDarkMode, currentUser, onLogout }: DashboardProps) {
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
                {recentStudents.map((s, idx) => (
                  <div key={`dash-gp-${s.id || s.nik || idx}-${idx}`} className="py-2.5 flex items-center justify-between gap-3 group/item">
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
    </div>
  );
}
