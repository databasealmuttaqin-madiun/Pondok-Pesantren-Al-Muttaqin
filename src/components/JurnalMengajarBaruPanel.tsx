import React, { useState, useEffect } from "react";
import { Plus, BookOpen, Calendar, Clock, Trash2, Edit3, X, CheckCircle2, AlertCircle, Printer, Search } from "lucide-react";
import { supabase } from "../supabaseClient";
import { parsePeriod } from "../lib/periodHelper";
import { showSuccess, showError, showWarning, showToast, showDeleteConfirm } from "../utils/sweetalert";

interface JurnalMengajarBaruPanelProps {
  currentUser: any;
  onTriggerNotification: (msg: string, type: "success" | "error") => void;
  students?: any[];
  schoolClasses?: string[];
}

export default function JurnalMengajarBaruPanel({
  currentUser,
  onTriggerNotification,
  students: studentsProp,
  schoolClasses: schoolClassesProp
}: JurnalMengajarBaruPanelProps) {
  const [jurnals, setJurnals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter state
  const [filterKelas, setFilterKelas] = useState("Semua");
  const [filterSemester, setFilterSemester] = useState("Ganjil");

  // Form state
  const [kelas, setKelas] = useState("7A");
  const [semester, setSemester] = useState("Ganjil");
  const [tahunPelajaran] = useState("2026/2027");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [hari, setHari] = useState("Senin");
  const [jamKe, setJamKe] = useState("");
  const [mataPelajaran, setMataPelajaran] = useState("");
  const [materiPembelajaran, setMateriPembelajaran] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const [students, setStudents] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [classList, setclassList] = useState<string[]>(["7A", "7B", "8A", "8B", "9A", "9B", "10A", "11A", "12A"]);

  // DB source states
  const [selectedGuruId, setSelectedGuruId] = useState<string>("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [plottingGuruMapel, setPlottingGuruMapel] = useState<any[]>([]);
  const [dbGurusList, setDbGurusList] = useState<any[]>([]);

  useEffect(() => {
    fetchJurnals();
    fetchClasses();
    loadFormData();
  }, [filterSemester]);

  useEffect(() => {
    if (currentUser) {
      setSelectedGuruId(currentUser.id || "");
    } else if (teachers.length > 0) {
      setSelectedGuruId(teachers[0].id);
    }
  }, [isModalOpen, currentUser, teachers]);

  const normalizeClassKey = (str: string): string => {
    if (!str) return "";
    return str.toLowerCase().replace(/^kelas\s*/i, "").replace(/[^a-z0-9]/g, "");
  };

  const formatClassLabel = (str: string): string => {
    if (!str) return "";
    const clean = str.trim();
    const withoutPrefix = clean.replace(/^kelas\s*/i, "").trim();
    
    const match = withoutPrefix.match(/^(\d+)\s*[-_]?\s*([a-zA-Z]+)$/);
    if (match) {
      const num = match[1];
      const letter = match[2].toUpperCase();
      return `Kelas ${num}-${letter}`;
    }
    
    if (/^\d+$/.test(withoutPrefix)) {
      return `Kelas ${withoutPrefix}`;
    }
    
    return clean.toLowerCase().startsWith("kelas") ? clean : `Kelas ${clean}`;
  };

  const isSameClass = (c1: string, c2: string): boolean => {
    if (!c1 || !c2) return false;
    return normalizeClassKey(c1) === normalizeClassKey(c2);
  };

  const getFilteredSubjects = () => {
    if (!selectedGuruId || !kelas) return [];

    // Find matching guru record to map pengguna.id -> guru.id
    const activeGuruRecord = dbGurusList.find(g => 
      String(g.pengguna_id) === String(selectedGuruId) || String(g.id) === String(selectedGuruId)
    );

    const activePlottings = plottingGuruMapel.filter(p => {
      const teacherMatched = 
        String(p.guru_id) === String(selectedGuruId) || 
        (activeGuruRecord && String(p.guru_id) === String(activeGuruRecord.id));

      const classMatched = isSameClass(String(p.kelas_nama || ""), kelas);
      return teacherMatched && classMatched;
    });

    if (activePlottings.length === 0) return [];

    return subjects.filter(sub =>
      activePlottings.some(p => String(p.mapel_id) === String(sub.id))
    );
  };

  useEffect(() => {
    const filtered = getFilteredSubjects();
    if (filtered.length > 0) {
      if (!filtered.some(s => s.nama_mapel === mataPelajaran)) {
        setMataPelajaran(filtered[0].nama_mapel);
      }
    } else {
      setMataPelajaran("");
    }
  }, [selectedGuruId, kelas, plottingGuruMapel, subjects, dbGurusList]);

  const loadFormData = async () => {
    try {
      // 1. Fetch teachers from plotting_guru_sekolah
      const { data: plotData } = await supabase
        .from("plotting_guru_sekolah")
        .select("*");

      // Fetch fallback all gurus
      const { data: dbGurus } = await supabase
        .from("guru")
        .select("*");

      if (dbGurus) {
        setDbGurusList(dbGurus);
      }

      // Fetch fallback all pengguna
      const { data: dbPengguna } = await supabase
        .from("pengguna")
        .select("*");

      const mappedTeachersList: any[] = [];
      const usedUsernamesOrIds = new Set<string>();
      const usedNames = new Set<string>();

      if (plotData && plotData.length > 0) {
        plotData.forEach((item: any) => {
          const rawId = String(item.guru_id || "");
          const matchedGuru = dbGurus?.find(g => String(g.id) === rawId || (g.pengguna_id && String(g.pengguna_id) === rawId));
          const matchedUser = dbPengguna?.find(u => String(u.id) === rawId || String(u.id) === String(matchedGuru?.pengguna_id));

          const resolvedId = matchedUser?.id || matchedGuru?.id || rawId;
          const resolvedName = matchedGuru?.nama_lengkap || matchedGuru?.nama || matchedUser?.nama_lengkap || matchedUser?.nama || `Guru (${rawId})`;

          const normName = resolvedName.trim().toLowerCase();
          if (resolvedId && !usedUsernamesOrIds.has(resolvedId) && !usedNames.has(normName)) {
            usedUsernamesOrIds.add(resolvedId);
            usedNames.add(normName);
            mappedTeachersList.push({
              id: resolvedId,
              nama: resolvedName
            });
          }
        });
      }

      setTeachers(mappedTeachersList.sort((a, b) => a.nama.localeCompare(b.nama)));

      // 2. Fetch master subjects
      const { data: mapelData } = await supabase
        .from("mata_pelajaran")
        .select("*")
        .order("nama_mapel", { ascending: true });

      if (mapelData && mapelData.length > 0) {
        setSubjects(mapelData);
      } else {
        setSubjects([
          { id: "s1", nama_mapel: "Matematika", kode_mapel: "MTK" },
          { id: "s2", nama_mapel: "Bahasa Indonesia", kode_mapel: "BIN" },
          { id: "s3", nama_mapel: "Bahasa Inggris", kode_mapel: "BIG" },
          { id: "s4", nama_mapel: "Fisika", kode_mapel: "FIS" },
          { id: "s5", nama_mapel: "Kimia", kode_mapel: "KIM" },
          { id: "s6", nama_mapel: "Biologi", kode_mapel: "BIO" },
          { id: "s7", nama_mapel: "Pendidikan Agama Islam", kode_mapel: "PAI" }
        ]);
      }

      // 3. Fetch lesson periods
      const { data: periodData } = await supabase
        .from("jam_pelajaran")
        .select("*")
        .order("jam_ke", { ascending: true });

      if (periodData && periodData.length > 0) {
        setPeriods(periodData);
      } else {
        setPeriods([
          { id: "p1", jam_ke: 1, hari: "Senin", nama: "Jam Pelajaran Ke-1", kode: "JP-01", mulai: "07:00", selesai: "07:45" },
          { id: "p2", jam_ke: 2, hari: "Senin", nama: "Jam Pelajaran Ke-2", kode: "JP-02", mulai: "07:45", selesai: "08:30" },
          { id: "p3", jam_ke: 3, hari: "Senin", nama: "Jam Pelajaran Ke-3", kode: "JP-03", mulai: "08:30", selesai: "09:15" },
          { id: "p4", jam_ke: 4, hari: "Senin", nama: "Jam Pelajaran Ke-4", kode: "JP-04", mulai: "09:35", selesai: "10:20" }
        ]);
      }

      // 4. Fetch plotting_guru_mapel
      const { data: plotMapelData } = await supabase
        .from("plotting_guru_mapel")
        .select("*");
      if (plotMapelData) {
        setPlottingGuruMapel(plotMapelData);
      }

    } catch (e) {
      console.warn("Failed to load select parameters from database:", e);
    }
  };

  const fetchClasses = async () => {
    try {
      const classMap = new Map<string, string>();

      const addClass = (rawName: string) => {
        if (!rawName || !rawName.trim()) return;
        const key = normalizeClassKey(rawName);
        if (key && !classMap.has(key)) {
          classMap.set(key, formatClassLabel(rawName));
        }
      };

      // 0. Use schoolClassesProp if available
      if (schoolClassesProp && schoolClassesProp.length > 0) {
        schoolClassesProp.forEach(addClass);
      }

      // 1. Fetch classes strictly from 'plotting' where jenis = 'kelas sekolah' as single source of truth
      try {
        const { data: plotSchool, error: plotErr } = await supabase
          .from("plotting")
          .select("nama")
          .eq("jenis", "kelas sekolah");
        
        if (!plotErr && plotSchool && plotSchool.length > 0) {
          plotSchool.forEach((r: any) => {
            if (r.nama) addClass(String(r.nama));
          });
        } else {
          // Fallback only if offline / plotting query failed
          const saved = localStorage.getItem("manajemen_school_classes");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) parsed.forEach(addClass);
            } catch {}
          }
        }
      } catch (e) {}

      if (classMap.size > 0) {
        const sortedClasses = Array.from(classMap.values()).sort((a, b) => {
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
        });
        setclassList(sortedClasses);
        setKelas((prev) => {
          const exists = sortedClasses.find(c => isSameClass(c, prev));
          return exists || sortedClasses[0];
        });
      } else {
        const defaultClasses = ["Kelas 7-A", "Kelas 7-B", "Kelas 8-A", "Kelas 8-B", "Kelas 9-A", "Kelas 9-B"];
        setclassList(defaultClasses);
        setKelas(defaultClasses[0]);
      }
    } catch (e) {
      console.warn("Failed to fetch classes from plotting:", e);
    }
  };

  useEffect(() => {
    if (tanggal) {
      const d = new Date(tanggal);
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const computedDay = days[d.getDay()];
      setHari(computedDay);
      
      // Auto set first valid period of the day
      if (periods.length > 0) {
        const dayPeriods = periods.filter(p => parsePeriod(p).hari.toLowerCase() === computedDay.toLowerCase());
        if (dayPeriods.length > 0) {
          setJamKe(parsePeriod(dayPeriods[0]).kode);
        } else {
          setJamKe("");
        }
      }
    }
  }, [tanggal, periods]);

  useEffect(() => {
    if (isModalOpen && kelas) {
      fetchStudents(kelas);
    }
  }, [isModalOpen, kelas, studentsProp]);

  const fetchJurnals = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("jurnal_mengajar")
        .select("*, absensi_jurnal_siswa(*)")
        .order("tanggal", { ascending: false });

      if (filterSemester !== "Semua") {
        query = query.eq("semester", filterSemester);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Table jurnal_mengajar not found or error, using localStorage fallback:", error.message);
        const saved = localStorage.getItem("jurnal_mengajar_baru_list");
        if (saved) setJurnals(JSON.parse(saved));
        return;
      }
      setJurnals(data || []);
    } catch (err: any) {
      const saved = localStorage.getItem("jurnal_mengajar_baru_list");
      if (saved) setJurnals(JSON.parse(saved));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async (selectedClass: string) => {
    try {
      // Priority 1: Use students prop passed from App.tsx (the hydrated source of truth for active students and school plotting)
      if (studentsProp && studentsProp.length > 0) {
        const matched = studentsProp.filter((s: any) => {
          if (s.status && s.status !== "Aktif") return false;
          const cls = s.kelas_sekolah || "";
          return isSameClass(cls, selectedClass);
        });

        const mapped = matched.map((s: any) => ({
          id: String(s.id || s.nik || s.nama_lengkap),
          raw_id: String(s.id || ""),
          nama_lengkap: s.nama_lengkap || s.nama || "-",
          kelas: selectedClass,
          nis: s.nisn || s.nis || s.nik || "-"
        })).sort((a: any, b: any) => a.nama_lengkap.localeCompare(b.nama_lengkap));

        setStudents(mapped);
        const initial: Record<string, string> = {};
        mapped.forEach((s: any) => { initial[s.id] = "hadir"; });
        setAttendanceMap(initial);
        return;
      }

      // Priority 2: Fallback / Database Query strictly prioritizing 'kelas_sekolah' plotting
      const studentMap = new Map<string, any>();
      const plottingMapByName = new Map<string, string>();
      const plottingMapById = new Map<string, string>();

      // Load custom metadata map from local storage if available
      try {
        const savedMeta = JSON.parse(localStorage.getItem("santri_custom_metadata_map") || "{}");
        Object.entries(savedMeta).forEach(([idOrNik, meta]: [string, any]) => {
          if (meta?.kelas_sekolah) {
            plottingMapById.set(idOrNik, meta.kelas_sekolah);
          }
        });
      } catch (e) {}

      // Query 'kelas_sekolah' table
      try {
        const { data: classRowsUnder } = await supabase.from("kelas_sekolah").select("*");
        if (classRowsUnder && classRowsUnder.length > 0) {
          classRowsUnder.forEach((r: any) => {
            const nameKey = (r.nama || r.nama_lengkap || "").trim().toLowerCase();
            const sid = String(r.santri_id || r.siswa_id || r.id || "");
            const cls = r.kelas || "";
            if (nameKey && cls) plottingMapByName.set(nameKey, cls);
            if (sid && cls) plottingMapById.set(sid, cls);
          });
        }
      } catch (e) {}

      // Query 'kelas sekolah' table (alternative table name)
      try {
        const { data: classRowsSpace } = await supabase.from("kelas sekolah").select("*");
        if (classRowsSpace && classRowsSpace.length > 0) {
          classRowsSpace.forEach((r: any) => {
            const nameKey = (r.nama || r.nama_lengkap || "").trim().toLowerCase();
            const sid = String(r.santri_id || r.siswa_id || r.id || "");
            const cls = r.kelas || "";
            if (nameKey && cls) plottingMapByName.set(nameKey, cls);
            if (sid && cls) plottingMapById.set(sid, cls);
          });
        }
      } catch (e) {}

      // Query 'siswa' table and match ONLY if effective class matches selectedClass
      try {
        const { data: siswaRows } = await supabase.from("siswa").select("*");
        if (siswaRows && siswaRows.length > 0) {
          siswaRows.forEach((r: any) => {
            const nameKey = (r.nama_lengkap || r.nama || "").trim().toLowerCase();
            const sid = String(r.id || r.nik || "");
            
            // Plotted class has 100% precedence over static/default siswa.kelas
            const effectiveClass = 
              plottingMapByName.get(nameKey) ||
              (sid ? plottingMapById.get(sid) : "") ||
              r.kelas_sekolah ||
              "";

            if (effectiveClass) {
              if (isSameClass(effectiveClass, selectedClass) && nameKey && !studentMap.has(nameKey)) {
                studentMap.set(nameKey, {
                  id: String(r.id || r.nik || nameKey),
                  raw_id: String(r.id || ""),
                  nama_lengkap: r.nama_lengkap || r.nama || "-",
                  kelas: selectedClass,
                  nis: r.nisn || r.nis || r.nik || "-"
                });
              }
            } else if (r.kelas && isSameClass(r.kelas, selectedClass)) {
              if (nameKey && !studentMap.has(nameKey)) {
                studentMap.set(nameKey, {
                  id: String(r.id || r.nik || nameKey),
                  raw_id: String(r.id || ""),
                  nama_lengkap: r.nama_lengkap || r.nama || "-",
                  kelas: selectedClass,
                  nis: r.nisn || r.nis || r.nik || "-"
                });
              }
            }
          });
        }
      } catch (e) {}

      // Also add students who only exist in plotting table for this class
      plottingMapByName.forEach((cls, nameKey) => {
        if (isSameClass(cls, selectedClass) && !studentMap.has(nameKey)) {
          studentMap.set(nameKey, {
            id: nameKey,
            raw_id: "",
            nama_lengkap: nameKey.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
            kelas: selectedClass,
            nis: "-"
          });
        }
      });

      let resultList = Array.from(studentMap.values()).sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));

      setStudents(resultList);
      const initial: Record<string, string> = {};
      resultList.forEach(s => { initial[s.id] = "hadir"; });
      setAttendanceMap(initial);
    } catch (e) {
      console.warn("Error fetching students for journal:", e);
    }
  };

  const totalSakit = Object.values(attendanceMap).filter(v => v === "sakit").length;
  const totalIzin = Object.values(attendanceMap).filter(v => v === "izin").length;
  const totalAlpa = Object.values(attendanceMap).filter(v => v === "alpa").length;
  const totalTelat = Object.values(attendanceMap).filter(v => v === "telat" || v === "terlambat").length;
  const totalHadir = Object.values(attendanceMap).filter(v => v === "hadir" || v === "telat" || v === "terlambat").length;

  const handleSaveJurnal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materiPembelajaran.trim()) {
      onTriggerNotification("Materi pembelajaran wajib diisi!", "error");
      return;
    }
    if (!mataPelajaran) {
      onTriggerNotification("Silakan pilih mata pelajaran!", "error");
      return;
    }
    if (!jamKe) {
      onTriggerNotification("Silakan pilih jam pelajaran!", "error");
      return;
    }

    const payload = {
      guru_id: selectedGuruId || currentUser?.id || null,
      kelas_id: kelas,
      semester,
      tahun_pelajaran: tahunPelajaran,
      tanggal,
      hari,
      jam_ke: jamKe,
      mata_pelajaran: mataPelajaran,
      materi_pembelajaran: materiPembelajaran,
      keterangan,
      total_sakit: totalSakit,
      total_izin: totalIzin,
      total_alpa: totalAlpa
    };

    try {
      const { data: insertedJurnal, error: errJ } = await supabase
        .from("jurnal_mengajar")
        .insert([payload])
        .select()
        .single();

      if (errJ) throw errJ;

      const jurnalId = insertedJurnal.id;

      const absensiPayloads = students.map(s => ({
        jurnal_id: jurnalId,
        siswa_id: s.id,
        status: attendanceMap[s.id] || "hadir"
      }));

      try {
        await supabase
          .from("absensi_jurnal_siswa")
          .insert(absensiPayloads);
      } catch (eA) {
        console.warn("Notice: could not bulk insert absensi_jurnal_siswa to supabase:", eA);
      }

      // Update local storage backup
      const newJurnal = {
        ...insertedJurnal,
        absensi_jurnal_siswa: absensiPayloads
      };
      const existingCached = localStorage.getItem("jurnal_mengajar_baru_list");
      const list = existingCached ? JSON.parse(existingCached) : [];
      const updatedList = [newJurnal, ...list.filter((j: any) => j.id !== jurnalId)];
      localStorage.setItem("jurnal_mengajar_baru_list", JSON.stringify(updatedList));

      onTriggerNotification("Jurnal Mengajar dan Presensi Siswa berhasil disimpan!", "success");
      setIsModalOpen(false);
      fetchJurnals();
    } catch (err: any) {
      console.warn("Gagal simpan ke Supabase, menyimpan ke local fallback:", err);
      // Fallback local
      const newJurnal = {
        id: Date.now().toString(),
        ...payload,
        absensi_jurnal_siswa: students.map(s => ({ siswa_id: s.id, status: attendanceMap[s.id] || "hadir" }))
      };
      const updated = [newJurnal, ...jurnals];
      setJurnals(updated);
      localStorage.setItem("jurnal_mengajar_baru_list", JSON.stringify(updated));
      onTriggerNotification("Jurnal berhasil disimpan secara lokal!", "success");
      setIsModalOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await showDeleteConfirm("jurnal mengajar ini beserta data absensinya");
    if (isConfirmed) {
      try {
        await supabase.from("jurnal_mengajar").delete().eq("id", id);
      } catch (e) {}
      const updated = jurnals.filter(j => j.id !== id);
      setJurnals(updated);
      localStorage.setItem("jurnal_mengajar_baru_list", JSON.stringify(updated));
      showToast("Jurnal berhasil dihapus.", "success");
      onTriggerNotification("Jurnal berhasil dihapus.", "success");
    }
  };

  const filteredJurnals = jurnals.filter(j => {
    if (filterKelas !== "Semua" && !isSameClass(j.kelas_id, filterKelas)) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" /> Jurnal Mengajar Guru
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Pencatatan kegiatan belajar mengajar (KBM) dan rekapitulasi kehadiran siswa.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Kelas */}
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="Semua">Semua Kelas</option>
            {classList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Filter Semester */}
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="Semua">Semua Semester</option>
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tambahkan Jurnal Baru
          </button>
        </div>
      </div>

      {/* Tabel Rekapitulasi Jurnal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Lembar Kerja Rekapitulasi Jurnal ({filteredJurnals.length} Entri)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-black text-center border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 w-36">Hari, Tanggal</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 w-48">Nama Guru</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 w-24">Jam Ke</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 w-32">Mata Pelajaran</th>
                <th className="py-3 px-4 border-r border-slate-200 dark:border-slate-800">Materi Pembelajaran</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 w-36">Keterangan</th>
                <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 w-12 text-orange-600 bg-orange-50/30">S</th>
                <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 w-12 text-amber-600 bg-amber-50/30">I</th>
                <th className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 w-12 text-rose-600 bg-rose-50/30">A</th>
                <th className="py-3 px-3 w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {filteredJurnals.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-center">
                    <span className="font-bold block">{j.hari}</span>
                    <span className="text-[10px] text-slate-400">{j.tanggal}</span>
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-850 dark:text-slate-250">
                    {teachers.find(t => t.id === j.guru_id)?.nama || "Guru Sekolah"}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-center font-bold">
                    {j.jam_ke}
                    <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">Kelas {j.kelas_id}</div>
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 font-semibold">
                    {j.mata_pelajaran}
                  </td>
                  <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    {j.materi_pembelajaran}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-slate-500 text-[11px]">
                    {j.keterangan || "-"}
                  </td>
                  <td className="py-3 px-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-orange-600 bg-orange-50/10">
                    {j.total_sakit || 0}
                  </td>
                  <td className="py-3 px-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-amber-600 bg-amber-50/10">
                    {j.total_izin || 0}
                  </td>
                  <td className="py-3 px-2 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-rose-600 bg-rose-50/10">
                    {j.total_alpa || 0}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleDelete(j.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Jurnal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredJurnals.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 text-xs">
                    Belum ada data jurnal mengajar yang tercatat. Silakan klik tombol "Tambahkan Jurnal Baru".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL INPUT JURNAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-2xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Input Jurnal Mengajar Guru</h3>
                  <p className="text-xs text-slate-500 font-medium">Form pencatatan KBM dan absensi siswa berstandar lembar resmi.</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveJurnal} className="p-6 space-y-6">
              
              {/* Header Section (Grid 3 Cols) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Kelas *</label>
                  <select
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {classList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Semester *</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tahun Pelajaran *</label>
                  <input
                    type="text"
                    value={tahunPelajaran}
                    readOnly
                    className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Detail KBM Section (Grid 2 Cols) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Hari, Tanggal *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={hari}
                      readOnly
                      className="w-1/3 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 text-center"
                    />
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className="w-2/3 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nama Guru Pengajar *</label>
                  <select
                    value={selectedGuruId}
                    onChange={(e) => setSelectedGuruId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Guru --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 font-sans">Mata Pelajaran * (Sesuai Plotting Kelas & Guru)</label>
                  <select
                    value={mataPelajaran}
                    onChange={(e) => setMataPelajaran(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getFilteredSubjects().length === 0 ? (
                      <option value="">-- Tidak ada mapel terplotting untuk guru di kelas ini --</option>
                    ) : (
                      <>
                        <option value="">-- Pilih Mata Pelajaran --</option>
                        {getFilteredSubjects().map(s => (
                          <option key={s.id} value={s.nama_mapel}>
                            {s.nama_mapel} ({s.kode_mapel || "MAPEL"})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Jam Pelajaran * (Disesuaikan hari {hari})</label>
                  <select
                    value={jamKe}
                    onChange={(e) => setJamKe(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {periods.filter(p => parsePeriod(p).hari.toLowerCase() === hari.toLowerCase()).length === 0 ? (
                      <option value="">-- Tidak ada jam pelajaran untuk hari {hari} --</option>
                    ) : (
                      <>
                        <option value="">-- Pilih Jam Pelajaran --</option>
                        {periods.filter(p => parsePeriod(p).hari.toLowerCase() === hari.toLowerCase()).map(p => {
                          const pr = parsePeriod(p);
                          return (
                            <option key={p.id} value={pr.kode}>
                              {pr.kode} - {pr.nama} ({pr.mulai} - {pr.selesai})
                            </option>
                          );
                        })}
                      </>
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Materi Pembelajaran *</label>
                  <textarea
                    rows={2}
                    placeholder="Uraikan materi pembelajaran hari ini..."
                    value={materiPembelajaran}
                    onChange={(e) => setMateriPembelajaran(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Keterangan / Kendala KBM (Opsional)</label>
                  <textarea
                    rows={2}
                    placeholder="Catatan kendala atau evaluasi KBM kelas..."
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>
              </div>

              {/* Kehadiran Peserta Didik Section */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Presensi & Ringkasan Siswa</h4>
                    <p className="text-[10px] text-slate-500">Jumlah Siswa {formatClassLabel(kelas)}: {students.length} anak</p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-extrabold" title="Status Hadir total (termasuk Telat)">
                      Hadir: {totalHadir}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-extrabold" title="Telat dicatat untuk Rekap Absensi Siswa, pada Jurnal tetap dihitung sebagai Hadir">
                      Telat: {totalTelat}
                    </span>
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-extrabold">
                      Sakit: {totalSakit}
                    </span>
                    <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-[10px] font-extrabold">
                      Izin: {totalIzin}
                    </span>
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-extrabold">
                      Alpa: {totalAlpa}
                    </span>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {students.map((s, idx) => (
                    <div key={s.id || idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{idx + 1}. {s.nama_lengkap}</span>
                        <span className="text-[10px] text-slate-400 block">NIS: {s.nis || s.nisn || s.no_induk || "-"}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {(["hadir", "telat", "sakit", "izin", "alpa"] as const).map(st => {
                          const isActive = (attendanceMap[s.id] || "hadir") === st || (st === "telat" && attendanceMap[s.id] === "terlambat");
                          let activeStyle = "bg-blue-600 text-white shadow-xs";
                          if (st === "telat") activeStyle = "bg-amber-500 text-white shadow-xs";
                          if (st === "sakit") activeStyle = "bg-orange-500 text-white shadow-xs";
                          if (st === "izin") activeStyle = "bg-yellow-500 text-white shadow-xs";
                          if (st === "alpa") activeStyle = "bg-rose-600 text-white shadow-xs";

                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setAttendanceMap(prev => ({ ...prev, [s.id]: st }))}
                              className={`w-7 h-7 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer flex items-center justify-center ${
                                isActive ? activeStyle : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                              title={st === "telat" ? "Telat (Tercatat di Rekap Absensi Siswa, di Jurnal dihitung Hadir)" : st.toUpperCase()}
                            >
                              {st === "hadir" ? "H" : st === "telat" ? "T" : st === "sakit" ? "S" : st === "izin" ? "I" : "A"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  Simpan Jurnal & Presensi
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
