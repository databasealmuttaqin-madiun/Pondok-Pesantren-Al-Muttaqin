import React, { useState, useEffect } from "react";
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  Clock, 
  Megaphone, 
  Sliders, 
  CheckCircle2, 
  BookOpen, 
  User, 
  ChevronRight, 
  Search,
  BookMarked
} from "lucide-react";
import { supabase, SantriData } from "../supabaseClient";

interface ManajemenSekolahPanelProps {
  students: SantriData[];
  schoolClasses: string[];
  setSchoolClasses: (classes: string[]) => void;
  metadataMap: Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: string }>;
  onAssignMetadata: (nik: string, key: "kamar" | "kelas_sekolah" | "kelas_pengajian", value: string) => void;
}

// Interfaces for our custom features
interface LessonPeriod {
  id: string;
  jam_ke: number;
  mulai: string;
  selesai: string;
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

interface TeacherAnnouncement {
  id: string;
  judul: string;
  isi: string;
  tanggal: string;
  dibuat_oleh: string;
}

export default function ManajemenSekolahPanel({
  students,
  schoolClasses,
  setSchoolClasses,
  metadataMap,
  onAssignMetadata
}: ManajemenSekolahPanelProps) {
  // Navigation tabs for Manajemen Sekolah
  const [activeSubTab, setActiveSubTab] = useState<
    "plotting" | "buat_kelas" | "jam_pelajaran" | "jadwal_pelajaran" | "pengumuman"
  >("plotting");

  const [teachers, setTeachers] = useState<{ username: string; nama: string }[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Plotting states
  const [selectedNik, setSelectedNik] = useState("");
  const [selectedTargetClass, setSelectedTargetClass] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [movingStudent, setMovingStudent] = useState<{ nik: string; name: string; currentVal: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState("");

  // Buat kelas states
  const [newClassName, setNewClassName] = useState("");

  // Jam Pelajaran states
  const [lessonPeriods, setLessonPeriods] = useState<LessonPeriod[]>([]);
  const [isPeriodFormOpen, setIsPeriodFormOpen] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [formJamKe, setFormJamKe] = useState<number>(1);
  const [formMulai, setFormMulai] = useState("07:00");
  const [formSelesai, setFormSelesai] = useState("07:45");

  // Jadwal Pelajaran states
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [scheduleViewMode, setScheduleViewMode] = useState<"kelas" | "guru">("kelas");
  const [filterClass, setFilterClass] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  
  // Schedule Form fields
  const [formHari, setFormHari] = useState("Senin");
  const [formScheduleJamKe, setFormScheduleJamKe] = useState<number>(1);
  const [formScheduleKelas, setFormScheduleKelas] = useState("");
  const [formMapel, setFormMapel] = useState("");
  const [formTeacherUsername, setFormTeacherUsername] = useState("");

  // Pengumuman states
  const [announcements, setAnnouncements] = useState<TeacherAnnouncement[]>([]);
  const [isAnnouncementFormOpen, setIsAnnouncementFormOpen] = useState(false);
  const [formJudul, setFormJudul] = useState("");
  const [formIsi, setFormIsi] = useState("");

  // Sync state for empty cloud jam_pelajaran
  const [isCloudPeriodsEmpty, setIsCloudPeriodsEmpty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const triggerFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3000);
  };

  // On mount, load options, teachers, periods, schedules, announcements
  useEffect(() => {
    fetchTeachers();
    fetchPeriods();
    fetchSchedules();
    fetchAnnouncements();
  }, []);

  const fetchTeachers = async () => {
    try {
      let teacherMap = new Map<string, { username: string; nama: string }>();

      // 1. Fetch from 'guru' table
      const { data: dbGuru } = await supabase.from("guru").select("username, nama_lengkap, nama");
      if (dbGuru && dbGuru.length > 0) {
        dbGuru.forEach((g: any) => {
          if (g.username) {
            teacherMap.set(g.username.toLowerCase(), {
              username: g.username,
              nama: g.nama_lengkap || g.nama || g.username
            });
          }
        });
      }

      // 2. Fetch from 'pengguna' table
      const { data: dbPengguna } = await supabase
        .from("pengguna")
        .select("username, nama, role, jabatan");

      if (dbPengguna && dbPengguna.length > 0) {
        dbPengguna.forEach((u: any) => {
          const isTeacher =
            u.role === "guru SMP" ||
            u.role === "guru pondok" ||
            (u.jabatan && (u.jabatan.toLowerCase().includes("guru") || u.jabatan.toLowerCase().includes("ustadz")));

          if (isTeacher && u.username) {
            const key = u.username.toLowerCase();
            if (!teacherMap.has(key)) {
              teacherMap.set(key, {
                username: u.username,
                nama: u.nama || u.username
              });
            }
          }
        });
      }

      const list = Array.from(teacherMap.values());
      if (list.length > 0) {
        setTeachers(list);
      }
    } catch (e) {
      console.warn("Failed to fetch teachers:", e);
    }
  };

  // Jam Pelajaran DB operations
  const fetchPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from("jam_pelajaran")
        .select("*")
        .order("jam_ke", { ascending: true });
      if (!error && data) {
        if (data.length > 0) {
          setLessonPeriods(data);
          localStorage.setItem("school_lesson_periods", JSON.stringify(data));
          setIsCloudPeriodsEmpty(false);
        } else {
          // Cloud table is empty, but connected successfully
          setIsCloudPeriodsEmpty(true);
          const cached = localStorage.getItem("school_lesson_periods");
          if (cached) {
            setLessonPeriods(JSON.parse(cached));
          } else {
            const defaultPeriods = [
              { id: "p1", jam_ke: 1, mulai: "07:30", selesai: "08:45" },
              { id: "p2", jam_ke: 2, mulai: "07:45", selesai: "08:30" },
              { id: "p3", jam_ke: 3, mulai: "08:30", selesai: "09:15" },
              { id: "p4", jam_ke: 4, mulai: "09:45", selesai: "10:30" },
              { id: "p5", jam_ke: 5, mulai: "10:30", selesai: "11:15" }
            ];
            setLessonPeriods(defaultPeriods);
            localStorage.setItem("school_lesson_periods", JSON.stringify(defaultPeriods));
          }
        }
      } else {
        setIsCloudPeriodsEmpty(false);
        const cached = localStorage.getItem("school_lesson_periods");
        if (cached) setLessonPeriods(JSON.parse(cached));
        else {
          const defaultPeriods = [
            { id: "p1", jam_ke: 1, mulai: "07:30", selesai: "08:45" },
            { id: "p2", jam_ke: 2, mulai: "07:45", selesai: "08:30" },
            { id: "p3", jam_ke: 3, mulai: "08:30", selesai: "09:15" },
            { id: "p4", jam_ke: 4, mulai: "09:45", selesai: "10:30" },
            { id: "p5", jam_ke: 5, mulai: "10:30", selesai: "11:15" }
          ];
          setLessonPeriods(defaultPeriods);
          localStorage.setItem("school_lesson_periods", JSON.stringify(defaultPeriods));
        }
      }
    } catch (e) {
      setIsCloudPeriodsEmpty(false);
      const cached = localStorage.getItem("school_lesson_periods");
      if (cached) setLessonPeriods(JSON.parse(cached));
    }
  };

  const handleSyncDefaultPeriodsToCloud = async () => {
    setIsSyncing(true);
    try {
      // Clear out string IDs to let DB assign incrementing id / uuid
      const periodsToInsert = lessonPeriods.map(p => ({
        jam_ke: p.jam_ke,
        mulai: p.mulai,
        selesai: p.selesai
      }));

      // Try to clear existing just in case (neq "jam_ke" -99 is a safe catch-all delete)
      await supabase.from("jam_pelajaran").delete().neq("jam_ke", -99);

      const { error } = await supabase
        .from("jam_pelajaran")
        .insert(periodsToInsert);

      if (error) throw error;

      triggerFeedback("success", "Berhasil menyinkronkan jam pelajaran ke Cloud Database!");
      setIsCloudPeriodsEmpty(false);
      await fetchPeriods();
    } catch (err: any) {
      console.error(err);
      triggerFeedback("error", `Gagal sinkronisasi: ${err.message || "Pastikan tabel 'jam_pelajaran' sudah dibuat di database Anda."}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const periodData = {
      jam_ke: Number(formJamKe),
      mulai: formMulai,
      selesai: formSelesai
    };

    try {
      if (editingPeriodId) {
        const { error } = await supabase
          .from("jam_pelajaran")
          .update(periodData)
          .eq("id", editingPeriodId);
        if (error) throw error;
        triggerFeedback("success", "Jam pelajaran berhasil diperbarui");
      } else {
        // Prevent duplicate jam_ke
        if (lessonPeriods.some(p => p.jam_ke === periodData.jam_ke)) {
          triggerFeedback("error", `Jam Ke-${periodData.jam_ke} sudah ada!`);
          return;
        }
        const { error } = await supabase
          .from("jam_pelajaran")
          .insert([periodData]);
        if (error) throw error;
        triggerFeedback("success", "Jam pelajaran baru ditambahkan");
      }
    } catch (err) {
      // Local fallback edit/save
      let updated = [...lessonPeriods];
      if (editingPeriodId) {
        updated = updated.map(p => p.id === editingPeriodId ? { ...p, ...periodData } : p);
      } else {
        updated.push({ id: String(Date.now()), ...periodData });
      }
      updated.sort((a, b) => a.jam_ke - b.jam_ke);
      setLessonPeriods(updated);
      localStorage.setItem("school_lesson_periods", JSON.stringify(updated));
      triggerFeedback("success", "Disimpan secara offline!");
    }
    setIsPeriodFormOpen(false);
    setEditingPeriodId(null);
    fetchPeriods();
  };

  const handleDeletePeriod = async (id: string) => {
    if (!confirm("Hapus jam pelajaran ini?")) return;
    try {
      const { error } = await supabase.from("jam_pelajaran").delete().eq("id", id);
      if (error) throw error;
      triggerFeedback("success", "Jam pelajaran dihapus");
    } catch (err) {
      const updated = lessonPeriods.filter(p => p.id !== id);
      setLessonPeriods(updated);
      localStorage.setItem("school_lesson_periods", JSON.stringify(updated));
      triggerFeedback("success", "Dihapus secara offline!");
    }
    fetchPeriods();
  };

  // Jadwal Pelajaran DB operations
  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from("jadwal_pelajaran")
        .select("*")
        .order("jam_ke", { ascending: true });
      if (!error && data) {
        setSchedules(data);
        localStorage.setItem("school_schedules", JSON.stringify(data));
      } else {
        const cached = localStorage.getItem("school_schedules");
        if (cached) setSchedules(JSON.parse(cached));
      }
    } catch (e) {
      const cached = localStorage.getItem("school_schedules");
      if (cached) setSchedules(JSON.parse(cached));
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedTeacher = teachers.find(t => t.username === formTeacherUsername);
    const teacherName = matchedTeacher ? matchedTeacher.nama : "Belum ditentukan";

    const scheduleData = {
      hari: formHari,
      jam_ke: Number(formScheduleJamKe),
      kelas: formScheduleKelas,
      mapel: formMapel,
      guru_username: formTeacherUsername,
      guru_nama: teacherName
    };

    // Check collision for Class, Day, and Period
    const classCollide = schedules.some(
      s => s.hari === formHari && s.jam_ke === Number(formScheduleJamKe) && s.kelas === formScheduleKelas
    );
    if (classCollide) {
      triggerFeedback("error", `Kelas ${formScheduleKelas} sudah memiliki jadwal pada ${formHari} Jam ke-${formScheduleJamKe}`);
      return;
    }

    // Check collision for Teacher, Day, and Period (Teacher can't teach in two classes simultaneously)
    if (formTeacherUsername) {
      const teacherCollide = schedules.some(
        s => s.hari === formHari && s.jam_ke === Number(formScheduleJamKe) && s.guru_username === formTeacherUsername
      );
      if (teacherCollide) {
        triggerFeedback("error", `${teacherName} sudah mengajar kelas lain pada ${formHari} Jam ke-${formScheduleJamKe}`);
        return;
      }
    }

    try {
      const { error } = await supabase.from("jadwal_pelajaran").insert([scheduleData]);
      if (error) throw error;
      triggerFeedback("success", "Jadwal pelajaran berhasil ditambahkan");
    } catch (err) {
      const updated = [...schedules, { id: String(Date.now()), ...scheduleData }];
      setSchedules(updated);
      localStorage.setItem("school_schedules", JSON.stringify(updated));
      triggerFeedback("success", "Jadwal disimpan secara offline!");
    }
    setIsScheduleFormOpen(false);
    fetchSchedules();
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Hapus jadwal ini?")) return;
    try {
      const { error } = await supabase.from("jadwal_pelajaran").delete().eq("id", id);
      if (error) throw error;
      triggerFeedback("success", "Jadwal berhasil dihapus");
    } catch (err) {
      const updated = schedules.filter(s => s.id !== id);
      setSchedules(updated);
      localStorage.setItem("school_schedules", JSON.stringify(updated));
      triggerFeedback("success", "Jadwal offline dihapus!");
    }
    fetchSchedules();
  };

  // Pengumuman DB operations
  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from("pengumuman_guru")
        .select("*")
        .order("tanggal", { ascending: false });
      if (!error && data) {
        setAnnouncements(data);
        localStorage.setItem("school_announcements", JSON.stringify(data));
      } else {
        const cached = localStorage.getItem("school_announcements");
        if (cached) setAnnouncements(JSON.parse(cached));
      }
    } catch (e) {
      const cached = localStorage.getItem("school_announcements");
      if (cached) setAnnouncements(JSON.parse(cached));
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const announcementData = {
      judul: formJudul,
      isi: formIsi,
      tanggal: new Date().toISOString().split("T")[0],
      dibuat_oleh: "Administrator"
    };

    try {
      const { error } = await supabase.from("pengumuman_guru").insert([announcementData]);
      if (error) throw error;
      triggerFeedback("success", "Pengumuman berhasil dipublish");
    } catch (err) {
      const updated = [{ id: String(Date.now()), ...announcementData }, ...announcements];
      setAnnouncements(updated);
      localStorage.setItem("school_announcements", JSON.stringify(updated));
      triggerFeedback("success", "Pengumuman offline dipublish!");
    }
    setIsAnnouncementFormOpen(false);
    setFormJudul("");
    setFormIsi("");
    fetchAnnouncements();
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Hapus pengumuman ini?")) return;
    try {
      const { error } = await supabase.from("pengumuman_guru").delete().eq("id", id);
      if (error) throw error;
      triggerFeedback("success", "Pengumuman berhasil dihapus");
    } catch (err) {
      const updated = announcements.filter(a => a.id !== id);
      setAnnouncements(updated);
      localStorage.setItem("school_announcements", JSON.stringify(updated));
      triggerFeedback("success", "Dihapus offline!");
    }
    fetchAnnouncements();
  };

  // Buat kelas master DB operations
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const formatted = newClassName.trim().toUpperCase();

    if (schoolClasses.includes(formatted)) {
      triggerFeedback("error", "Kelas ini sudah ada!");
      return;
    }

    const updated = [...schoolClasses, formatted];
    setSchoolClasses(updated);
    localStorage.setItem("manajemen_school_classes", JSON.stringify(updated));

    try {
      const { error } = await supabase
        .from("plotting")
        .insert([{ jenis: "kelas sekolah", nama: formatted }]);
      if (error) throw error;
      triggerFeedback("success", `Kelas ${formatted} berhasil dibuat`);
    } catch (err) {
      triggerFeedback("success", `Kelas ${formatted} dibuat offline!`);
    }
    setNewClassName("");
  };

  const handleDeleteClass = async (classNameToDelete: string) => {
    if (!confirm(`Hapus kelas "${classNameToDelete}"? Semua siswa yang diplot di kelas ini akan kehilangan penempatannya.`)) return;

    const updated = schoolClasses.filter(c => c !== classNameToDelete);
    setSchoolClasses(updated);
    localStorage.setItem("manajemen_school_classes", JSON.stringify(updated));

    try {
      await supabase.from("plotting").delete().eq("nama", classNameToDelete).eq("jenis", "kelas sekolah");
      triggerFeedback("success", `Kelas ${classNameToDelete} berhasil dihapus`);
    } catch (err) {
      triggerFeedback("success", `Kelas dihapus offline!`);
    }
  };

  // Plotting students
  const handleSavePlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNik) {
      triggerFeedback("error", "Silakan cari dan pilih siswa terlebih dahulu.");
      return;
    }
    if (!selectedTargetClass) {
      triggerFeedback("error", "Silakan pilih kelas sekolah tujuan.");
      return;
    }

    onAssignMetadata(selectedNik, "kelas_sekolah", selectedTargetClass);
    
    const matched = students.find(s => s.nik === selectedNik);
    const sName = matched ? matched.nama_lengkap : "Siswa";
    
    triggerFeedback("success", `Berhasil memplot ${sName} ke Kelas ${selectedTargetClass}`);
    setSelectedNik("");
    setSelectedTargetClass("");
    setSearchQuery("");
  };

  const handleMoveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingStudent || !moveTarget) return;

    onAssignMetadata(movingStudent.nik, "kelas_sekolah", moveTarget);
    triggerFeedback("success", `Siswa ${movingStudent.name} dipindahkan ke Kelas ${moveTarget}`);
    setMovingStudent(null);
    setMoveTarget("");
  };

  const daysList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  return (
    <div className="space-y-6" id="manajemen_sekolah_module">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight uppercase flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-indigo-600" />
            Manajemen Sekolah Reguler
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold leading-relaxed max-w-2xl">
            Pusat pengelolaan kegiatan belajar formal sekolah, penentuan kelas santri, pembuatan master kelas, pemetaan jam pelajaran, pembuatan jadwal pelajaran, dan media pengumuman guru.
          </p>
        </div>
      </div>

      {/* Main Tab bar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-inner max-w-5xl">
        <button
          onClick={() => setActiveSubTab("plotting")}
          className={`px-4 py-2.5 text-xs font-black rounded-xl text-center cursor-pointer transition-all flex items-center gap-2 ${
            activeSubTab === "plotting"
              ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Users className="w-4 h-4" /> Plotting Kelas
        </button>
        <button
          onClick={() => setActiveSubTab("buat_kelas")}
          className={`px-4 py-2.5 text-xs font-black rounded-xl text-center cursor-pointer transition-all flex items-center gap-2 ${
            activeSubTab === "buat_kelas"
              ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Plus className="w-4 h-4" /> Buat Kelas Sekolah
        </button>
        <button
          onClick={() => setActiveSubTab("jam_pelajaran")}
          className={`px-4 py-2.5 text-xs font-black rounded-xl text-center cursor-pointer transition-all flex items-center gap-2 ${
            activeSubTab === "jam_pelajaran"
              ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Clock className="w-4 h-4" /> Jam Pelajaran
        </button>
        <button
          onClick={() => setActiveSubTab("jadwal_pelajaran")}
          className={`px-4 py-2.5 text-xs font-black rounded-xl text-center cursor-pointer transition-all flex items-center gap-2 ${
            activeSubTab === "jadwal_pelajaran"
              ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Calendar className="w-4 h-4" /> Jadwal Pelajaran & Mengajar
        </button>
        <button
          onClick={() => setActiveSubTab("pengumuman")}
          className={`px-4 py-2.5 text-xs font-black rounded-xl text-center cursor-pointer transition-all flex items-center gap-2 ${
            activeSubTab === "pengumuman"
              ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Megaphone className="w-4 h-4" /> Pengumuman Guru
        </button>
      </div>

      {/* Floating feedback */}
      {feedback && (
        <div 
          className={`fixed bottom-6 right-6 px-5 py-3.5 rounded-xl border shadow-xl z-50 flex items-center gap-2.5 animate-bounce ${
            feedback.type === "success" 
              ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/80 border-rose-200 text-rose-800 dark:text-rose-300"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-xs font-extrabold uppercase tracking-wide">{feedback.text}</span>
        </div>
      )}

      {/* Tab: PLOTTING KELAS */}
      {activeSubTab === "plotting" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Plot form */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase leading-none">
                Plotting Kelas Siswa
              </h3>
              <p className="text-[10px] text-slate-450 font-bold mt-1 uppercase">
                Petakan siswa ke kelas masing-masing
              </p>
            </div>

            <form onSubmit={handleSavePlot} className="space-y-4">
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                  Cari & Pilih Siswa
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ketik nama siswa..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      setSelectedNik("");
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 dark:text-slate-200"
                    required={!selectedNik}
                  />
                  
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-auto flex flex-col">
                      {students.filter(s => s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                        students.filter(s => s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase())).map((student, sIdx) => {
                          const clsVal = student.kelas_sekolah || "Belum ada kelas";
                          const isSelected = selectedNik === student.nik;
                          return (
                            <div
                              key={`sch-st-dd-${student.nik || student.id || sIdx}-${sIdx}`}
                              onClick={() => {
                                setSelectedNik(student.nik);
                                setSearchQuery(`${student.nama_lengkap} (${clsVal})`);
                                setIsDropdownOpen(false);
                              }}
                              className={`p-2.5 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-150 dark:border-slate-850 last:border-0 ${isSelected ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"}`}
                            >
                              {student.nama_lengkap} <span className="text-slate-400 font-medium ml-1">({clsVal})</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-3 text-xs text-center text-slate-500 font-medium">Tidak ada siswa yang cocok</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                  Pilih Kelas Tujuan
                </label>
                <select
                  required
                  value={selectedTargetClass}
                  onChange={(e) => setSelectedTargetClass(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- PILIH KELAS --</option>
                  {schoolClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all text-center cursor-pointer uppercase tracking-wider"
              >
                Simpan Plotting Kelas
              </button>
            </form>
          </div>

          {/* Plot summary grid */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm min-h-[400px] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                  Ringkasan Penempatan Kelas Siswa
                </h3>
                <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900 font-bold px-2 py-0.5 rounded font-mono uppercase">
                  Total {schoolClasses.length} Kelas
                </span>
              </div>

              {schoolClasses.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-semibold text-xs italic">
                  Belum ada kelas sekolah yang dibuat. Silakan tambahkan kelas baru terlebih dahulu pada menu "Buat Kelas Sekolah".
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schoolClasses.map((clsName) => {
                    const mapped = students.filter(s => s.kelas_sekolah === clsName);
                    return (
                      <div key={clsName} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/20 dark:bg-slate-950/40 hover:bg-slate-50/50 transition-all flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 block">
                              Kelas {clsName}
                            </span>
                            <span className="text-[10px] text-indigo-650 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full font-mono">
                              {mapped.length} Siswa
                            </span>
                          </div>

                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {mapped.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic py-1 font-medium">Kosong (belum ada siswa)</p>
                            ) : (
                              mapped.map((siswa, idx) => (
                                <div key={`sch-cls-st-${siswa.nik || siswa.id || idx}-${idx}`} className="flex justify-between items-center text-[11px] py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                    {idx + 1}. {siswa.nama_lengkap}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setMoveTarget(clsName);
                                      setMovingStudent({
                                        nik: siswa.nik,
                                        name: siswa.nama_lengkap,
                                        currentVal: clsName
                                      });
                                    }}
                                    className="text-[9px] text-indigo-600 hover:text-indigo-800 font-extrabold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400 px-2 py-0.5 rounded leading-none transition-colors"
                                  >
                                    Pindah
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: BUAT KELAS SEKOLAH */}
      {activeSubTab === "buat_kelas" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase leading-none">
                Buat Kelas Baru
              </h3>
              <p className="text-[10px] text-slate-450 font-bold mt-1 uppercase">
                Tambahkan daftar kelas master sekolah formal
              </p>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                  Nama Kelas Sekolah
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 7A, 10 IPA 1, 12 IPS"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all text-center cursor-pointer uppercase tracking-wider"
              >
                Buat Kelas Master
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase leading-none">
                Daftar Kelas Master Terdaftar
              </h3>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-950 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-bold px-2 py-0.5 rounded font-mono">
                {schoolClasses.length} Terdaftar
              </span>
            </div>

            {schoolClasses.length === 0 ? (
              <p className="text-center py-16 text-xs text-slate-400 italic">Belum ada kelas master dibuat.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {schoolClasses.map((cls) => (
                  <div key={cls} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-850 rounded-2xl hover:border-slate-300 transition-colors">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                      Kelas {cls}
                    </span>
                    <button
                      onClick={() => handleDeleteClass(cls)}
                      className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Kelas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: JAM PELAJARAN */}
      {activeSubTab === "jam_pelajaran" && (
        <div className="space-y-6 w-full">
          {/* Cloud Database Sync Status Alert Banner */}
          {isCloudPeriodsEmpty && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="space-y-1 text-amber-800 dark:text-amber-400 text-left">
                <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <span>⚠️</span> Sinkronisasi Database Diperlukan
                </p>
                <p className="font-semibold leading-relaxed">
                  Database Anda terhubung tetapi tabel <code className="font-mono bg-amber-100/50 dark:bg-amber-900/30 px-1 py-0.5 rounded">jam_pelajaran</code> di cloud masih kosong, sementara aplikasi menampilkan sesi default dari memori lokal. Sinkronkan sesi di bawah agar tersimpan ke cloud database Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncDefaultPeriodsToCloud}
                disabled={isSyncing}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 border-none self-start md:self-auto"
              >
                {isSyncing ? "Menyinkronkan..." : "⚡ Sinkronkan ke Cloud"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Jam form */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase leading-none">
                {editingPeriodId ? "Edit Jam Pelajaran" : "Tambah Jam Pelajaran"}
              </h3>
              <p className="text-[10px] text-slate-450 font-bold mt-1 uppercase">
                Atur rentang jam pelajaran sekolah
              </p>
            </div>

            <form onSubmit={handleSavePeriod} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                  Jam Ke- (Angka)
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={formJamKe}
                  onChange={(e) => setFormJamKe(Number(e.target.value))}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={formMulai}
                    onChange={(e) => setFormMulai(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={formSelesai}
                    onChange={(e) => setFormSelesai(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {editingPeriodId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPeriodId(null);
                      setFormJamKe(1);
                      setFormMulai("07:00");
                      setFormSelesai("07:45");
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl"
                >
                  {editingPeriodId ? "Simpan Perubahan" : "Simpan Jam Pelajaran"}
                </button>
              </div>
            </form>
          </div>

          {/* Jam periods listing */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase leading-none">
                Daftar Rentang Jam Pelajaran
              </h3>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded font-mono">
                {lessonPeriods.length} Sesi Terdaftar
              </span>
            </div>

            {lessonPeriods.length === 0 ? (
              <p className="text-center py-16 text-xs text-slate-400 italic">Belum ada jam pelajaran yang diinput.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {lessonPeriods.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/10 px-2 transition-colors rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-black text-xs">
                        {p.jam_ke}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          Jam Pelajaran Ke-{p.jam_ke}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Pukul {p.mulai} - {p.selesai}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingPeriodId(p.id);
                          setFormJamKe(p.jam_ke);
                          setFormMulai(p.mulai);
                          setFormSelesai(p.selesai);
                        }}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                        title="Edit Jam"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePeriod(p.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Hapus Jam"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Tab: JADWAL PELAJARAN */}
      {activeSubTab === "jadwal_pelajaran" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Pengaturan Jadwal Pelajaran & Mengajar
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Atur jam, guru, dan mata pelajaran pada setiap kelas secara sistematis.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5">
                  <button
                    onClick={() => setScheduleViewMode("kelas")}
                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg ${scheduleViewMode === "kelas" ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm" : "text-slate-650"}`}
                  >
                    Per Kelas
                  </button>
                  <button
                    onClick={() => setScheduleViewMode("guru")}
                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg ${scheduleViewMode === "guru" ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm" : "text-slate-650"}`}
                  >
                    Per Guru (Jadwal Mengajar)
                  </button>
                </div>

                <button
                  onClick={() => setIsScheduleFormOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Sesi Mengajar
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 pb-2">
              {scheduleViewMode === "kelas" ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Pilih Kelas untuk Ditampilkan</label>
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Semua Kelas --</option>
                    {schoolClasses.map(c => <option key={c} value={c}>Kelas {c}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Pilih Guru untuk Ditampilkan</label>
                  <select
                    value={filterTeacher}
                    onChange={(e) => setFilterTeacher(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Semua Guru --</option>
                    {teachers.map(t => <option key={t.username} value={t.username}>{t.nama}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Timetable schedule grid view */}
            <div className="mt-4 overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850 text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                    <th className="p-3">Hari</th>
                    <th className="p-3">Jam Ke</th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Kelas</th>
                    <th className="p-3">Mata Pelajaran</th>
                    <th className="p-3">Guru Pengampu</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150/50 dark:divide-slate-850 text-xs">
                  {schedules
                    .filter(s => {
                      if (scheduleViewMode === "kelas" && filterClass) return s.kelas === filterClass;
                      if (scheduleViewMode === "guru" && filterTeacher) return s.guru_username === filterTeacher;
                      return true;
                    })
                    .sort((a, b) => {
                      const dayOrderA = daysList.indexOf(a.hari);
                      const dayOrderB = daysList.indexOf(b.hari);
                      if (dayOrderA !== dayOrderB) return dayOrderA - dayOrderB;
                      return a.jam_ke - b.jam_ke;
                    })
                    .map((sch) => {
                      const periodTime = lessonPeriods.find(p => p.jam_ke === sch.jam_ke);
                      const displayTime = periodTime ? `${periodTime.mulai} - ${periodTime.selesai}` : "--:--";
                      return (
                        <tr key={sch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="p-3 font-extrabold text-indigo-700 dark:text-indigo-400 uppercase">{sch.hari}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-black">
                              Ke-{sch.jam_ke}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">{displayTime}</td>
                          <td className="p-3 font-extrabold text-slate-800 dark:text-slate-200">Kelas {sch.kelas}</td>
                          <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{sch.mapel}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 font-semibold">{sch.guru_nama}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteSchedule(sch.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {schedules.filter(s => {
                    if (scheduleViewMode === "kelas" && filterClass) return s.kelas === filterClass;
                    if (scheduleViewMode === "guru" && filterTeacher) return s.guru_username === filterTeacher;
                    return true;
                  }).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                        Tidak ada data jadwal yang sesuai filter atau belum dimasukkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sesi Mengajar form modal overlay */}
          {isScheduleFormOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-slate-50 text-sm uppercase">Tambah Jadwal Mengajar</h3>
                    <p className="text-[10px] text-slate-500 font-semibold">Tentukan pemetaan mata pelajaran baru</p>
                  </div>
                  <button
                    onClick={() => setIsScheduleFormOpen(false)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl"
                  >
                    ✖
                  </button>
                </div>

                <form onSubmit={handleSaveSchedule} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Hari</label>
                      <select
                        value={formHari}
                        onChange={(e) => setFormHari(e.target.value)}
                        className="w-full p-2 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs"
                      >
                        {daysList.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase">Jam Pelajaran Ke</label>
                      <select
                        value={formScheduleJamKe}
                        onChange={(e) => setFormScheduleJamKe(Number(e.target.value))}
                        className="w-full p-2 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs"
                      >
                        {lessonPeriods.map(p => (
                          <option key={p.id} value={p.jam_ke}>Jam Ke-{p.jam_ke} ({p.mulai}-{p.selesai})</option>
                        ))}
                        {lessonPeriods.length === 0 && (
                          <option value="1">Jam Ke-1 (07:00-07:45)</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Kelas Sekolah</label>
                      <select
                        required
                        value={formScheduleKelas}
                        onChange={(e) => setFormScheduleKelas(e.target.value)}
                        className="w-full p-2 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs"
                      >
                        <option value="">-- Pilih --</option>
                        {schoolClasses.map(c => <option key={c} value={c}>Kelas {c}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase">Mata Pelajaran</label>
                      <input
                        type="text"
                        placeholder="Contoh: Matematika, Fisika"
                        value={formMapel}
                        onChange={(e) => setFormMapel(e.target.value)}
                        className="w-full p-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Guru Pengampu</label>
                    <select
                      required
                      value={formTeacherUsername}
                      onChange={(e) => setFormTeacherUsername(e.target.value)}
                      className="w-full p-2.5 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs"
                    >
                      <option value="">-- Pilih Guru Sekolah --</option>
                      {teachers.map(t => (
                        <option key={t.username} value={t.username}>{t.nama} ({t.username})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsScheduleFormOpen(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                    >
                      Simpan Jadwal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: PENGUMUMAN GURU */}
      {activeSubTab === "pengumuman" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create announcement */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase leading-none">
                Publish Pengumuman Baru
              </h3>
              <p className="text-[10px] text-slate-450 font-bold mt-1 uppercase">
                Bagi pengumuman atau instruksi penting kepada semua guru
              </p>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                  Judul Pengumuman
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Rapat Koordinasi Kurikulum"
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                  Isi Pengumuman
                </label>
                <textarea
                  placeholder="Ketik rincian pengumuman disini..."
                  value={formIsi}
                  onChange={(e) => setFormIsi(e.target.value)}
                  rows={4}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all text-center cursor-pointer uppercase tracking-wider"
              >
                Publish Pengumuman
              </button>
            </form>
          </div>

          {/* Announcement history list */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase leading-none">
                Riwayat Pengumuman Terbit
              </h3>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-300 font-bold px-2 py-0.5 rounded font-mono">
                {announcements.length} Pengumuman
              </span>
            </div>

            {announcements.length === 0 ? (
              <p className="text-center py-16 text-xs text-slate-400 italic">Belum ada pengumuman guru terbit.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-4 border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/20 dark:bg-slate-950/20 space-y-2 hover:border-slate-300 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-50">{ann.judul}</h4>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Pengumuman"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-wrap">
                      {ann.isi}
                    </p>

                    <div className="flex justify-between items-center pt-2 text-[9px] font-black text-slate-400 uppercase tracking-wider border-t border-slate-100 dark:border-slate-850">
                      <span>Oleh: {ann.dibuat_oleh}</span>
                      <span>{ann.tanggal}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Move student modal overlay */}
      {movingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-50 text-sm uppercase">Pindahkan Siswa</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Siswa: {movingStudent.name}</p>
              </div>
              <button
                onClick={() => setMovingStudent(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl"
              >
                ✖
              </button>
            </div>

            <form onSubmit={handleMoveStudent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">
                  Pilih Kelas Tujuan Baru
                </label>
                <select
                  required
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
                >
                  <option value="">-- PILIH KELAS BARU --</option>
                  {schoolClasses
                    .filter(c => c !== movingStudent.currentVal)
                    .map(c => (
                      <option key={c} value={c}>Kelas {c}</option>
                    ))
                  }
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovingStudent(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                >
                  Pindahkan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
