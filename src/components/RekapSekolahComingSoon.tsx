import React from "react";
import { 
  School, 
  GraduationCap, 
  Clock, 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  Sparkles, 
  ArrowLeft, 
  Users, 
  ShieldCheck, 
  FileSpreadsheet,
  Moon
} from "lucide-react";

interface RekapSekolahComingSoonProps {
  onSwitchToSholat: () => void;
}

export default function RekapSekolahComingSoon({ onSwitchToSholat }: RekapSekolahComingSoonProps) {
  const upcomingFeatures = [
    {
      icon: Clock,
      title: "Presensi Gerbang & Apel Pagi",
      desc: "Pencatatan jam kedatangan (06:45 - 07:15 WIB) dan jam kepulangan KBM (14:00 WIB) melalui sensor tap kartu RFID/NFC di gerbang sekolah.",
      badge: "Gerbang & Apel"
    },
    {
      icon: BookOpen,
      title: "Jurnal & Mata Pelajaran",
      desc: "Pencatatan presensi siswa per mata pelajaran yang disinkronkan langsung dari dashboard input Guru SMP dan jurnal mengajar.",
      badge: "Per Mata Pelajaran"
    },
    {
      icon: Users,
      title: "Rekapitulasi Kelas & Wali Kelas",
      desc: "Laporan kehadiran terpilah per rombel (Kelas VII A/B, VIII A/B, IX A/B) dengan rekap ketidakhadiran (Sakit, Izin, Alfa) per semester.",
      badge: "Wali Kelas"
    },
    {
      icon: FileSpreadsheet,
      title: "Ekspor Rapor & Rekap Bulanan",
      desc: "Cetak dokumen rekap kehadiran format resmi Kurikulum Merdeka / Dapodik untuk evaluasi bulanan dan buku rapor siswa.",
      badge: "Format Rapor"
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in" id="rekap_sekolah_coming_soon">
      {/* HERO BANNER CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-indigo-900/40 shadow-xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SUB MENU REKAP PRESENSI</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
              <School className="w-3.5 h-3.5" />
              <span>SMP IT AL MUTTAQIN</span>
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Coming Soon
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Rekap Presensi Siswa Sekolah
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Modul rekapitulasi kehadiran formal sekolah sedang disiapkan untuk menghubungkan data absensi gerbang sekolah, 
            jurnal mengajar guru mata pelajaran, serta buku kehadiran wali kelas dalam satu ekosistem terpadu.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSwitchToSholat}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Moon className="w-4 h-4 text-indigo-600" />
              <span>Buka Rekap Presensi Sholat (5 Waktu)</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-indigo-200/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Data presensi sholat fardhu tetap aktif berjalan normal</span>
            </div>
          </div>
        </div>
      </div>

      {/* PLANNED FEATURES PREVIEW */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Fitur yang Akan Hadir di Rekap Sekolah</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Roadmap Pengembangan 2026
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {upcomingFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-3 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {feat.badge}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      {feat.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tahap Desain & Integrasi</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK INFO NOTIFICATION */}
      <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5 sm:mt-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Butuh melihat kehadiran mengajar guru saat ini?
            </h4>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
              Anda dapat menggunakan menu <strong className="font-semibold">Guru Sekolah & Jurnal</strong> di sidebar untuk melihat absensi harian dan jadwal mengajar guru SMP.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSwitchToSholat}
          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Rekap Sholat</span>
        </button>
      </div>
    </div>
  );
}
