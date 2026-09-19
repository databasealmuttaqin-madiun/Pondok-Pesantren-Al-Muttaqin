import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  GraduationCap, 
  Shield, 
  User, 
  Phone, 
  UserCheck, 
  Plus, 
  RefreshCw, 
  ChevronDown, 
  Eye, 
  X, 
  MapPin, 
  Calendar, 
  Home, 
  BookOpen,
  SlidersHorizontal,
  ExternalLink
} from "lucide-react";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";

export interface WargaPerson {
  id: string;
  nama: string;
  username: string;
  gender: "L" | "P";
  roleLabel: string;
  roleStyle: string;
  isSekolah: boolean;
  isPondok: boolean;
  no_hp?: string;
  nik?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  alamat_pribadi?: string;
  foto_diri?: string;
  jabatan?: string;
  bagian?: string;
  tugas_kamar?: string;
  tugas_kelas_sekolah?: string;
  tugas_kelas_pengajian?: string;
  tugas_mapel?: string;
}

interface Props {
  viewType: "guru" | "pengurus";
  onSwitchType?: (type: "guru" | "pengurus") => void;
  onNavigateToUserManagement?: () => void;
}

export default function DaftarWargaPanel({ viewType, onSwitchType, onNavigateToUserManagement }: Props) {
  const [people, setPeople] = useState<WargaPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGender, setFilterGender] = useState<"Semua" | "L" | "P">("Semua");
  const [filterRole, setFilterRole] = useState<string>("Semua");
  const [selectedDetail, setSelectedDetail] = useState<WargaPerson | null>(null);

  useEffect(() => {
    loadPeople();
  }, [viewType]);

  const loadPeople = async () => {
    setIsLoading(true);
    try {
      if (viewType === "guru") {
        let dbGuruList: any[] = [];
        let dbPenggunaList: any[] = [];
        const sekolahPlottingSet = new Set<string>();
        const pondokPlottingSet = new Set<string>();

        // 1. Fetch data dari tabel 'plotting_guru_sekolah' & 'plotting_guru_pondok' untuk mapping relasi
        try {
          const { data: sPlotting } = await supabase
            .from("plotting_guru_sekolah")
            .select("id, guru_id, guru_nama");
          if (sPlotting && sPlotting.length > 0) {
            sPlotting.forEach((item: any) => {
              if (item.guru_id) sekolahPlottingSet.add(String(item.guru_id));
              if (item.guru_nama) sekolahPlottingSet.add(String(item.guru_nama).toLowerCase().trim());
            });
          }
        } catch (errS) {
          console.warn("Notice fetch plotting_guru_sekolah:", errS);
        }

        try {
          const { data: pPlotting } = await supabase
            .from("plotting_guru_pondok")
            .select("id, guru_id, guru_nama");
          if (pPlotting && pPlotting.length > 0) {
            pPlotting.forEach((item: any) => {
              if (item.guru_id) pondokPlottingSet.add(String(item.guru_id));
              if (item.guru_nama) pondokPlottingSet.add(String(item.guru_nama).toLowerCase().trim());
            });
          }
        } catch (errP) {
          console.warn("Notice fetch plotting_guru_pondok:", errP);
        }

        // 2. Query tabel utama 'guru' dengan join relasi ke 'plotting_guru_sekolah' dan 'plotting_guru_pondok'
        try {
          const { data: guruData, error: guruErr } = await supabase
            .from("guru")
            .select(`
              *,
              plotting_guru_sekolah (id),
              plotting_guru_pondok (id)
            `)
            .order("id", { ascending: true });

          if (!guruErr && guruData) {
            dbGuruList = guruData;
          } else {
            // Fallback select * jika foreign key join relasi belum didefinisikan secara eksplisit di DDL
            const { data: simpleGuru } = await supabase
              .from("guru")
              .select("*")
              .order("id", { ascending: true });
            if (simpleGuru) dbGuruList = simpleGuru;
          }
        } catch (errGuru) {
          console.warn("Notice fetch guru table:", errGuru);
        }

        // 3. Fetch data akun 'pengguna' untuk sinkronisasi username/kontak/jabatan
        try {
          const { data: dbPengguna } = await supabase
            .from("pengguna")
            .select("*");
          if (dbPengguna) {
            dbPenggunaList = dbPengguna;
          }
        } catch (errPengguna) {
          console.warn("Notice fetch pengguna table:", errPengguna);
        }

        // 4. Transform dan petakan ke format WargaPerson dengan Dynamic Role Detection
        const mapByUsername = new Map<string, WargaPerson>();

        dbGuruList.forEach((g: any) => {
          const linkedUser = g.pengguna_id ? dbPenggunaList.find(p => p.id === g.pengguna_id) : null;
          const uname = (g.username || linkedUser?.username || "").trim();
          const fullName = g.nama_lengkap || g.nama || linkedUser?.nama_lengkap || linkedUser?.nama || uname || "Guru";
          const guruIdStr = String(g.id || "");
          const cleanName = fullName.toLowerCase().trim();

          // DYNAMIC ROLE DETECTION:
          // Cek dari hasil query nested join atau dari mapping relasi plotting_guru_sekolah & plotting_guru_pondok
          const isSekolah = Boolean(
            (g.plotting_guru_sekolah && Array.isArray(g.plotting_guru_sekolah) && g.plotting_guru_sekolah.length > 0) ||
            sekolahPlottingSet.has(guruIdStr) ||
            sekolahPlottingSet.has(cleanName) ||
            (uname && sekolahPlottingSet.has(uname.toLowerCase())) ||
            (g.bagian && g.bagian.toLowerCase().includes("sekolah"))
          );

          const isPondok = Boolean(
            (g.plotting_guru_pondok && Array.isArray(g.plotting_guru_pondok) && g.plotting_guru_pondok.length > 0) ||
            pondokPlottingSet.has(guruIdStr) ||
            pondokPlottingSet.has(cleanName) ||
            (uname && pondokPlottingSet.has(uname.toLowerCase())) ||
            (g.bagian && g.bagian.toLowerCase().includes("pondok"))
          );

          let roleLabel = "Belum Diplotting";
          let roleStyle = "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";

          if (isSekolah && isPondok) {
            roleLabel = "Guru Sekolah & Pondok";
            roleStyle = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
          } else if (isSekolah) {
            roleLabel = "Guru Sekolah";
            roleStyle = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
          } else if (isPondok) {
            roleLabel = "Guru Pondok";
            roleStyle = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
          }

          const genderVal: "L" | "P" = (g.jenis_kelamin === "P" || g.gender === "P" || linkedUser?.gender === "P") ? "P" : "L";
          const key = uname.toLowerCase() || (g.id ? `id_${g.id}` : `nama_${cleanName}`);

          mapByUsername.set(key, {
            id: String(g.id || uname || Math.random()),
            nama: fullName,
            username: uname,
            gender: genderVal,
            roleLabel,
            roleStyle,
            isSekolah,
            isPondok,
            no_hp: g.nomor_hp || g.nomor_seluler || g.no_hp || linkedUser?.no_hp || "",
            nik: g.nik || "",
            tempat_lahir: g.tempat_lahir || "",
            tanggal_lahir: g.tanggal_lahir || "",
            alamat_pribadi: g.alamat_pribadi || "",
            foto_diri: g.foto_diri || g.foto || "",
            jabatan: g.jabatan || linkedUser?.jabatan || roleLabel,
            bagian: isSekolah && isPondok ? "Sekolah & Pondok" : isSekolah ? "Sekolah" : isPondok ? "Pondok" : "-",
            tugas_kamar: g.tugas_kamar || linkedUser?.tugas_kamar || "",
            tugas_kelas_sekolah: g.tugas_kelas_sekolah || linkedUser?.tugas_kelas_sekolah || "",
            tugas_kelas_pengajian: g.tugas_kelas_pengajian || linkedUser?.tugas_kelas_pengajian || "",
            tugas_mapel: g.mata_pelajaran || g.tugas_mapel || linkedUser?.tugas_mapel || ""
          });
        });

        // Sertakan juga akun 'pengguna' dengan peran guru yang belum ada di tabel guru
        dbPenggunaList.forEach((u: any) => {
          const r = String(u.role || "").toLowerCase();
          const pu = String(u.peran_utama || "").toLowerCase();
          const uIdStr = String(u.id || "");
          const uname = (u.username || "").trim();
          const fullName = u.nama_lengkap || u.nama || uname;
          const cleanName = fullName.toLowerCase().trim();

          const isPlotted = Boolean(
            sekolahPlottingSet.has(uIdStr) ||
            pondokPlottingSet.has(uIdStr) ||
            sekolahPlottingSet.has(cleanName) ||
            pondokPlottingSet.has(cleanName) ||
            (uname && (sekolahPlottingSet.has(uname.toLowerCase()) || pondokPlottingSet.has(uname.toLowerCase())))
          );

          const isTeacher = pu.includes("guru") || r.includes("guru") || (u.jabatan && u.jabatan.toLowerCase().includes("guru")) || isPlotted;

          if (isTeacher) {
            const key = uname.toLowerCase() || `pengguna_${u.id}`;

            if (!mapByUsername.has(key)) {
              const isSekolah = Boolean(
                sekolahPlottingSet.has(uIdStr) ||
                sekolahPlottingSet.has(cleanName) ||
                (uname && sekolahPlottingSet.has(uname.toLowerCase())) ||
                pu === "guru_sekolah" ||
                r === "guru smp" ||
                (u.bagian && u.bagian.toLowerCase().includes("sekolah"))
              );

              const isPondok = Boolean(
                pondokPlottingSet.has(uIdStr) ||
                pondokPlottingSet.has(cleanName) ||
                (uname && pondokPlottingSet.has(uname.toLowerCase())) ||
                pu === "guru_pondok" ||
                r === "guru pondok" ||
                (u.bagian && u.bagian.toLowerCase().includes("pondok"))
              );

              let roleLabel = "Belum Diplotting";
              let roleStyle = "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";

              if (isSekolah && isPondok) {
                roleLabel = "Guru Sekolah & Pondok";
                roleStyle = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
              } else if (isSekolah) {
                roleLabel = "Guru Sekolah";
                roleStyle = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
              } else if (isPondok) {
                roleLabel = "Guru Pondok";
                roleStyle = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
              }

              mapByUsername.set(key, {
                id: String(u.id || uname),
                nama: fullName,
                username: uname,
                gender: (u.gender === "P" ? "P" : "L"),
                roleLabel,
                roleStyle,
                isSekolah,
                isPondok,
                no_hp: u.no_hp || u.phone || "",
                jabatan: u.jabatan || roleLabel,
                bagian: isSekolah && isPondok ? "Sekolah & Pondok" : isSekolah ? "Sekolah" : isPondok ? "Pondok" : "-",
                tugas_kamar: u.tugas_kamar || "",
                tugas_kelas_sekolah: u.tugas_kelas_sekolah || "",
                tugas_kelas_pengajian: u.tugas_kelas_pengajian || "",
                tugas_mapel: u.tugas_mapel || ""
              });
            }
          }
        });

        setPeople(Array.from(mapByUsername.values()));
      } else {
        // viewType === "pengurus"
        let allDbUsers: any[] = [];
        try {
          const { data, error } = await supabase.from("pengguna").select("*");
          if (!error && data) {
            allDbUsers = data;
          }
        } catch (errDb) {
          console.warn("Notice fetching pengguna table:", errDb);
        }

        const pengurusList: WargaPerson[] = allDbUsers
          .filter(u => {
            const r = String(u.role || "").toLowerCase();
            const pu = String(u.peran_utama || "").toLowerCase();
            return pu === "pengurus" || pu === "admin" || pu === "super_admin" || r === "pengurus" || r === "admin" || r === "super admin";
          })
          .map(u => ({
            id: String(u.id || u.username),
            nama: u.nama_lengkap || u.nama || u.username,
            username: u.username || "",
            gender: (u.gender === "P" ? "P" : "L"),
            roleLabel: u.role === "admin" || u.role === "super admin" ? "Administrator" : "Pengurus Pondok",
            roleStyle: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
            isSekolah: false,
            isPondok: true,
            no_hp: u.no_hp || "",
            jabatan: u.jabatan || "Pengurus Pondok",
            bagian: u.bagian || "Pondok"
          }));

        setPeople(pengurusList);
      }
    } catch (e) {
      console.warn("Error fetching data for Data Guru/Pegawai:", e);
      setPeople([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter Data
  const filteredPeople = useMemo(() => {
    return people.filter((person) => {
      // 1. Search filter
      const matchSearch =
        searchQuery === "" ||
        person.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.roleLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (person.no_hp && person.no_hp.includes(searchQuery));

      // 2. Gender filter
      const matchGender =
        filterGender === "Semua" || person.gender === filterGender;

      // 3. Role filter
      const matchRole =
        filterRole === "Semua" || person.roleLabel === filterRole;

      return matchSearch && matchGender && matchRole;
    });
  }, [people, searchQuery, filterGender, filterRole]);

  // Statistik Ringkas
  const totalCount = people.length;
  const countSekolah = people.filter(p => p.isSekolah && !p.isPondok).length;
  const countPondok = people.filter(p => p.isPondok && !p.isSekolah).length;
  const countKeduanya = people.filter(p => p.isSekolah && p.isPondok).length;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. PAGE HEADER & AKSI UTAMA */}
      <PageHeader
        category="Data Warga"
        title={viewType === "guru" ? "Data Guru / Pegawai" : "Data Pengurus Pondok"}
        description={
          viewType === "guru"
            ? "Kelola data direktori guru dan pantau penugasan peran sekolah & pondok secara otomatis."
            : "Kelola data direktori pengurus dan jajaran administrasi pesantren."
        }
        actionButton={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Toggle Switch Antara Guru & Pengurus */}
            {onSwitchType && (
              <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => onSwitchType("guru")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewType === "guru"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                >
                  Guru
                </button>
                <button
                  onClick={() => onSwitchType("pengurus")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewType === "pengurus"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                >
                  Pengurus
                </button>
              </div>
            )}

            {/* Tombol Kelola Akun */}
            {onNavigateToUserManagement && (
              <button
                onClick={onNavigateToUserManagement}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Kelola Akun</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. STATS OVERVIEW CARDS (KHUSUS DATA GURU) */}
      {viewType === "guru" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Guru
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {totalCount} <span className="text-xs font-normal text-slate-400">Orang</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Guru Sekolah
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {countSekolah} <span className="text-xs font-normal text-slate-400">Orang</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Guru Pondok
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {countPondok} <span className="text-xs font-normal text-slate-400">Orang</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Sekolah & Pondok
            </div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {countKeduanya} <span className="text-xs font-normal text-slate-400">Orang</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. KONTROL FILTER & PENCARIAN */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Input Pencarian */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama, peran, atau kontak..."
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

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap justify-end">
          {/* Filter Gender */}
          <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700">
            <User className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0 pointer-events-none" />
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value as "Semua" | "L" | "P")}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer pr-5 appearance-none"
            >
              <option value="Semua" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Gender: Semua</option>
              <option value="L" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Laki-laki (L)</option>
              <option value="P" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Perempuan (P)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Filter Peran (Hanya pada tampilan Guru) */}
          {viewType === "guru" && (
            <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0 pointer-events-none" />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer pr-5 appearance-none"
              >
                <option value="Semua" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Peran: Semua</option>
                <option value="Guru Sekolah" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Guru Sekolah</option>
                <option value="Guru Pondok" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Guru Pondok</option>
                <option value="Guru Sekolah & Pondok" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Guru Sekolah & Pondok</option>
                <option value="Belum Diplotting" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Belum Diplotting</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
            </div>
          )}

          {/* Tombol Segarkan Data */}
          <button
            onClick={loadPeople}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
            title="Segarkan data dari database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : "text-slate-400"}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>
        </div>
      </div>

      {/* 4. TABEL UTAMA: DATA GURU / PEGAWAI (RINGKAS & MINIMALIS) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 sm:px-6 w-16 text-center">NO</th>
                <th className="py-3.5 px-4 sm:px-6">NAMA LENGKAP</th>
                <th className="py-3.5 px-4 sm:px-6 text-center w-24">GENDER</th>
                <th className="py-3.5 px-4 sm:px-6">PERAN (ROLE)</th>
                <th className="py-3.5 px-4 sm:px-6">KONTAK</th>
                <th className="py-3.5 px-4 sm:px-6 text-center w-28">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      <p className="text-xs font-medium">Memuat data direktori...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium">Tidak ada data yang ditemukan</p>
                      <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau pengaturan filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPeople.map((person, index) => {
                  return (
                    <tr
                      key={person.id || person.username || index}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* KOLOM 1: NO */}
                      <td className="py-4 px-4 sm:px-6 text-center font-medium text-slate-400 text-xs sm:text-sm">
                        {index + 1}
                      </td>

                      {/* KOLOM 2: NAMA LENGKAP */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">
                          {person.nama}
                        </div>
                      </td>

                      {/* KOLOM 3: GENDER */}
                      <td className="py-4 px-4 sm:px-6 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                          person.gender === "L"
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}>
                          {person.gender === "L" ? "L" : "P"}
                        </span>
                      </td>

                      {/* KOLOM 4: PERAN (ROLE) DENGAN DYNAMIC ROLE BADGE */}
                      <td className="py-4 px-4 sm:px-6">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 ${person.roleStyle}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            person.isSekolah && person.isPondok
                              ? "bg-purple-500"
                              : person.isSekolah
                              ? "bg-blue-500"
                              : person.isPondok
                              ? "bg-emerald-500"
                              : "bg-slate-400"
                          }`} />
                          <span>{person.roleLabel}</span>
                        </span>
                      </td>

                      {/* KOLOM 5: KONTAK */}
                      <td className="py-4 px-4 sm:px-6 font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        {person.no_hp ? (
                          <a
                            href={`https://wa.me/${person.no_hp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="Hubungi via WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{person.no_hp}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-xs">-</span>
                        )}
                      </td>

                      {/* KOLOM 6: AKSI */}
                      <td className="py-4 px-4 sm:px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol WhatsApp Cepat */}
                          {person.no_hp && (
                            <a
                              href={`https://wa.me/${person.no_hp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                              title="Chat WhatsApp"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}

                          {/* Tombol Lihat Detail */}
                          <button
                            onClick={() => setSelectedDetail(person)}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Detail Profil & Penugasan"
                          >
                            <Eye className="w-4 h-4" />
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
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Menampilkan {filteredPeople.length} dari total {people.length} orang</span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {viewType === "guru" ? "Direktori Guru Sekolah & Pondok" : "Direktori Pengurus Pondok"}
          </span>
        </div>
      </div>

      {/* 5. MODAL DETAIL PROFIL & PENUGASAN GURU */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
                  {selectedDetail.nama.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDetail.nama}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    @{selectedDetail.username || "guru"} • Gender: {selectedDetail.gender === "L" ? "Laki-laki (Ustadz)" : "Perempuan (Ustadzah)"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badge Peran */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Status Peran Guru:</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${selectedDetail.roleStyle}`}>
                {selectedDetail.roleLabel}
              </span>
            </div>

            {/* Detail Grid */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Nomor Kontak / WhatsApp</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                    {selectedDetail.no_hp || "-"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">NIK</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                    {selectedDetail.nik || "-"}
                  </span>
                </div>
              </div>

              {selectedDetail.tempat_lahir && (
                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Tempat / Tanggal Lahir</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedDetail.tempat_lahir} {selectedDetail.tanggal_lahir ? `, ${selectedDetail.tanggal_lahir}` : ""}
                  </span>
                </div>
              )}

              {selectedDetail.alamat_pribadi && (
                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase">Alamat Domisili</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedDetail.alamat_pribadi}
                  </span>
                </div>
              )}

              {/* Detail Penugasan Tambahan jika ada */}
              {(selectedDetail.tugas_mapel || selectedDetail.tugas_kelas_sekolah || selectedDetail.tugas_kelas_pengajian || selectedDetail.tugas_kamar) && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Penugasan Tambahan
                  </span>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    {selectedDetail.tugas_mapel && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Mata Pelajaran:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedDetail.tugas_mapel}</span>
                      </div>
                    )}
                    {selectedDetail.tugas_kelas_sekolah && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Kelas Sekolah:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedDetail.tugas_kelas_sekolah}</span>
                      </div>
                    )}
                    {selectedDetail.tugas_kelas_pengajian && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Kelas Pengajian:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedDetail.tugas_kelas_pengajian}</span>
                      </div>
                    )}
                    {selectedDetail.tugas_kamar && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Kamar / Asrama:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedDetail.tugas_kamar}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              {selectedDetail.no_hp && (
                <a
                  href={`https://wa.me/${selectedDetail.no_hp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Kirim WhatsApp</span>
                </a>
              )}
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
