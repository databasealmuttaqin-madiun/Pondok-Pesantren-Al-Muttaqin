import React, { useState, useEffect, useRef } from "react";
import { 
  MapPin, CheckCircle, XCircle, AlertTriangle, Crosshair, Save, Settings,
  User, Phone, Calendar, Camera, IdCard, Search, Edit, Plus, Clock, RefreshCw, Eye, Sparkles,
  BookOpen, ClipboardList, Trash2, Printer, Check, FileText, Users, ChevronRight, Upload, Info,
  GraduationCap, Database, Shield
} from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";

const MySwal = withReactContent(Swal);

// --- KONFIGURASI LOKASI SEKOLAH ---
const DEFAULT_SCHOOL_LOCATION = {
  latitude: -6.200000, 
  longitude: 106.816666,
  radiusMeters: 100 // Radius toleransi (dalam meter)
};

// Jarak antara 2 titik koordinat bumi (Haversine formula)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

interface AbsensiGuruPanelProps {
  currentUser?: { username: string; role: string; name: string; gender?: string } | null;
  initialSubTab?: "absensi" | "mengajar" | "semua_guru";
  onSubTabChange?: (tab: "absensi" | "mengajar" | "semua_guru") => void;
}

interface GuruSekolahProfile {
  id?: string; // uuid primary key dari tabel 'guru'
  created_at?: string; // timestamptz
  nama_lengkap: string; // text NOT NULL
  jenis_kelamin: string; // text ('L' | 'P')
  nik?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  alamat_pribadi?: string;
  nomor_seluler?: string;
  nomor_hp?: string; // text
  kategori_guru: string; // text
  pengguna_id?: string; // uuid foreign key ke tabel 'pengguna'
  username?: string;
  foto_diri?: string;
  mata_pelajaran?: string;
}

export default function AbsensiGuruPanel({ currentUser, initialSubTab = "absensi", onSubTabChange }: AbsensiGuruPanelProps) {
  // Navigation sub-tab
  const [activeSubTab, setActiveSubTab] = useState<"absensi" | "mengajar" | "semua_guru">(initialSubTab);

  useEffect(() => {
    if (initialSubTab && initialSubTab !== activeSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSelectSubTab = (tab: "absensi" | "mengajar" | "semua_guru") => {
    setActiveSubTab(tab);
    onSubTabChange?.(tab);
  };

  // Location/Presence State
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [schoolLocation, setSchoolLocation] = useState(DEFAULT_SCHOOL_LOCATION);
  const [showConfig, setShowConfig] = useState(false);
  const [configLat, setConfigLat] = useState(schoolLocation.latitude.toString());
  const [configLng, setConfigLng] = useState(schoolLocation.longitude.toString());
  const [configRadius, setConfigRadius] = useState(schoolLocation.radiusMeters.toString());

  // Profile State (Menyesuaikan dengan tabel database 'guru')
  const [profile, setProfile] = useState<GuruSekolahProfile>({
    id: undefined,
    nama_lengkap: currentUser?.name || "",
    jenis_kelamin: currentUser?.gender === "P" ? "P" : "L",
    nomor_hp: "",
    kategori_guru: currentUser?.role === "guru pondok" ? "Guru Pondok" : "Guru SMP",
    pengguna_id: undefined,
    username: currentUser?.username || "",
    foto_diri: "",
    mata_pelajaran: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingProfileModal, setIsEditingProfileModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profileDbError, setProfileDbError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  
  // Teachers directory for Admin/Pengurus
  const [allProfiles, setAllProfiles] = useState<GuruSekolahProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Mengajar / Teaching Module States ---
  const [mengajarTab, setMengajarTab] = useState<"input" | "jurnal_guru" | "jurnal_kelas">("input");
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [journals, setJournals] = useState<any[]>([]);
  const [absensiSekolah, setAbsensiSekolah] = useState<any[]>([]);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Form Jurnal
  const getIndoDay = (dateObj: Date) => {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return days[dateObj.getDay()];
  };
  const [hari, setHari] = useState(getIndoDay(new Date()));
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [kelas, setKelas] = useState("");
  const [semester, setSemester] = useState("Ganjil");
  const [tahunAjaran, setTahunAjaran] = useState(() => {
    const year = new Date().getFullYear();
    return `${year}/${year + 1}`;
  });
  const [jamPelajaran, setJamPelajaran] = useState("Jam ke 1-2 (07:00 - 08:30)");
  const [customJam, setCustomJam] = useState("");
  const [materiPokok, setMateriPokok] = useState("");
  const [tujuanPembelajaran, setTujuanPembelajaran] = useState("");
  const [evaluasi, setEvaluasi] = useState("");
  const [kendala, setKendala] = useState("");
  const [rencanaPerbaikan, setRencanaPerbaikan] = useState("");
  const [fotoPembelajaran, setFotoPembelajaran] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);

  // Attendance state map (id -> status)
  const [attendanceMap, setAttendanceMap] = useState<Record<string, "Hadir" | "Sakit" | "Izin" | "Alfa">>({});

  // Journal View states
  const [selectedJournalClass, setSelectedJournalClass] = useState("Semua Kelas");
  const [selectedJournalTeacher, setSelectedJournalTeacher] = useState("Semua Guru");

  // Master list of school classes loaded from 'plotting' table
  const [plottingSchoolClasses, setPlottingSchoolClasses] = useState<string[]>(() => {
    const saved = localStorage.getItem("manajemen_school_classes");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const fetchPlottingSchoolClasses = async () => {
    try {
      const { data: plotSchool, error } = await supabase
        .from("plotting")
        .select("nama")
        .eq("jenis", "kelas sekolah");
      if (error) throw error;
      if (plotSchool && plotSchool.length > 0) {
        const dbSchoolListPlot = plotSchool.map((r: any) => r.nama).filter(Boolean);
        setPlottingSchoolClasses(dbSchoolListPlot);
        localStorage.setItem("manajemen_school_classes", JSON.stringify(dbSchoolListPlot));
      }
    } catch (err) {
      console.warn("Gagal memuat master kelas sekolah dari plotting:", err);
    }
  };

  // Fetch student data for class lists
  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      // Fetch school class mappings from supabase first
      let schoolAssignments: Record<string, string> = {};
      try {
        const { data: dbSpace, error: spaceErr } = await supabase.from("kelas sekolah").select("nama, kelas");
        if (!spaceErr && dbSpace) {
          dbSpace.forEach((row: any) => {
            if (row.nama) {
              schoolAssignments[row.nama.trim().toLowerCase()] = row.kelas || "";
            }
          });
        } else {
          const { data: dbUnderline } = await supabase.from("kelas_sekolah").select("nama, kelas");
          if (dbUnderline) {
            dbUnderline.forEach((row: any) => {
              if (row.nama) {
                schoolAssignments[row.nama.trim().toLowerCase()] = row.kelas || "";
              }
            });
          }
        }
      } catch (err) {
        console.warn("Gagal memuat mapping kelas sekolah di AbsensiGuruPanel:", err);
      }

      const { data, error } = await supabase
        .from("siswa")
        .select("*")
        .order("nama_lengkap", { ascending: true });
      
      if (data && !error) {
        const savedMetadataMap = JSON.parse(localStorage.getItem("santri_custom_metadata_map") || "{}");
        const mappedStudents = data.map((s: any) => {
          const key = (s.nama_lengkap || "").trim().toLowerCase();
          const localPlot = savedMetadataMap[s.id] || {};
          return {
            ...s,
            kelas_sekolah: schoolAssignments[key] || localPlot.kelas_sekolah || s.kelas_sekolah || ""
          };
        });
        setStudents(mappedStudents);
        localStorage.setItem("santri_data_mapped", JSON.stringify(mappedStudents));
        localStorage.setItem("santri_data", JSON.stringify(data));
      } else {
        throw new Error(error?.message || "No data");
      }
    } catch (e) {
      console.warn("Failed to fetch students from Supabase, loading local fallback", e);
      const cached = localStorage.getItem("santri_data_mapped") || localStorage.getItem("santri_data");
      if (cached) {
        try {
          setStudents(JSON.parse(cached));
        } catch (err) {
          console.error("Failed to parse cached student data", err);
        }
      }
    } finally {
      setLoadingStudents(false);
    }
  };

  // Fetch journals and school attendance
  const fetchJournals = async () => {
    try {
      const { data: dataJurnal, error: errorJurnal } = await supabase
        .from("jurnal_mengajar")
        .select("*")
        .order("tanggal", { ascending: false });
      
      if (dataJurnal && !errorJurnal) {
        setJournals(dataJurnal);
        localStorage.setItem("jurnal_mengajar_history", JSON.stringify(dataJurnal));
      } else {
        const saved = localStorage.getItem("jurnal_mengajar_history");
        if (saved) setJournals(JSON.parse(saved));
      }

      const { data: dataAbsen, error: errorAbsen } = await supabase
        .from("absensi_sekolah")
        .select("*");
      if (dataAbsen && !errorAbsen) {
        setAbsensiSekolah(dataAbsen);
        localStorage.setItem("absensi_sekolah_history", JSON.stringify(dataAbsen));
      } else {
        const saved = localStorage.getItem("absensi_sekolah_history");
        if (saved) setAbsensiSekolah(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to fetch journals from Supabase, loading fallbacks", e);
      const savedJ = localStorage.getItem("jurnal_mengajar_history");
      if (savedJ) setJournals(JSON.parse(savedJ));
      const savedA = localStorage.getItem("absensi_sekolah_history");
      if (savedA) setAbsensiSekolah(JSON.parse(savedA));
    }
  };

  // Update default attendance map when class or students list changes
  useEffect(() => {
    if (kelas && students.length > 0) {
      const classStudents = students.filter(s => s.kelas_sekolah === kelas);
      const initialMap: Record<string, "Hadir" | "Sakit" | "Izin" | "Alfa"> = {};
      classStudents.forEach(s => {
        initialMap[String(s.id || s.nama_lengkap)] = "Hadir";
      });
      setAttendanceMap(initialMap);
    } else {
      setAttendanceMap({});
    }
  }, [kelas, students]);

  // Update Day dynamically when date changes
  useEffect(() => {
    if (tanggal) {
      setHari(getIndoDay(new Date(tanggal)));
    }
  }, [tanggal]);

  // Compression helper
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const max_size = 800; // Keep image compact (max width or height of 800px)
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.6); // 60% compression ratio
          resolve(compressed);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressedBase64 = await compressImage(file);
      setFotoPembelajaran(compressedBase64);
      MySwal.fire({
        icon: 'success',
        title: 'Foto Berhasil Diambil!',
        text: 'Ukuran foto berhasil dikompresi otomatis (max 800px, 60% quality) agar hemat penyimpanan database.',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error("Failed to compress image:", err);
      MySwal.fire({
        icon: 'error',
        title: 'Gagal Memproses Foto',
        text: 'Gagal mengompresi gambar. Coba ambil ulang.',
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kelas) {
      MySwal.fire({
        icon: 'warning',
        title: 'Kelas Belum Dipilih',
        text: 'Silakan pilih kelas terlebih dahulu.',
      });
      return;
    }
    if (!materiPokok.trim()) {
      MySwal.fire({
        icon: 'warning',
        title: 'Materi Pokok Kosong',
        text: 'Silakan isi materi pokok pembelajaran.',
      });
      return;
    }
    if (!fotoPembelajaran) {
      MySwal.fire({
        icon: 'warning',
        title: 'Bukti Foto Pembelajaran Wajib',
        text: 'Harap ambil foto menggunakan kamera sebagai pengesahan laporan mengajar.',
      });
      return;
    }

    setIsSavingJournal(true);
    const activeJam = jamPelajaran === "Lainnya" ? customJam : jamPelajaran;
    const classStudents = students.filter(s => s.kelas_sekolah === kelas);

    let statsHadir = 0;
    let statsSakit = 0;
    let statsIzin = 0;
    let statsAlfa = 0;

    classStudents.forEach(s => {
      const status = attendanceMap[String(s.id || s.nama_lengkap)] || "Hadir";
      if (status === "Hadir") statsHadir++;
      else if (status === "Sakit") statsSakit++;
      else if (status === "Izin") statsIzin++;
      else if (status === "Alfa") statsAlfa++;
    });

    const summaryStr = `Hadir: ${statsHadir}, Sakit: ${statsSakit}, Izin: ${statsIzin}, Alfa: ${statsAlfa}`;

    const payload = {
      hari,
      tanggal,
      kelas,
      semester,
      tahun_ajaran: tahunAjaran,
      jam_pelajaran: activeJam,
      mata_pelajaran: profile.mata_pelajaran || "Semua Mata Pelajaran",
      materi_pokok: materiPokok.trim(),
      tujuan_pembelajaran: tujuanPembelajaran.trim(),
      evaluasi: evaluasi.trim(),
      kendala: kendala.trim(),
      rencana_perbaikan: rencanaPerbaikan.trim(),
      foto_pembelajaran: fotoPembelajaran,
      guru_nama: profile.nama_lengkap || currentUser?.name || "Guru Sekolah",
      guru_username: currentUser?.username || "unknown",
      attendance_summary: summaryStr
    };

    try {
      // 1. Save Jurnal Mengajar
      const { data: inserted, error: errJ } = await supabase
        .from("jurnal_mengajar")
        .insert([payload])
        .select()
        .single();

      if (errJ) throw new Error(errJ.message);

      const jurnalId = inserted.id;

      // 2. Prepare & Save Student Attendance List
      if (classStudents.length > 0) {
        const attendancePayloads = classStudents.map(s => ({
          jurnal_id: jurnalId,
          tanggal,
          kelas,
          santri_id: s.id || 0,
          nama_santri: s.nama_lengkap,
          status: attendanceMap[String(s.id || s.nama_lengkap)] || "Hadir",
          guru_username: currentUser?.username || "unknown",
          mata_pelajaran: profile.mata_pelajaran || "Semua Mata Pelajaran"
        }));

        const { error: errA } = await supabase
          .from("absensi_sekolah")
          .insert(attendancePayloads);

        if (errA) console.warn("Supabase insert absensi_sekolah failed:", errA.message);
      }

      MySwal.fire({
        icon: 'success',
        title: 'Jurnal Berhasil Disimpan!',
        text: 'Laporan mengajar dan absensi kelas telah berhasil disinkronkan ke database cloud.',
        confirmButtonColor: '#0c66e4',
        timer: 2000,
        showConfirmButton: false
      });

      // Reset
      setMateriPokok("");
      setTujuanPembelajaran("");
      setEvaluasi("");
      setKendala("");
      setRencanaPerbaikan("");
      setFotoPembelajaran("");
      
      fetchJournals();

    } catch (err: any) {
      console.warn("Cloud save failed. Storing in local fallbacks instead:", err);

      const currentLocals = JSON.parse(localStorage.getItem("jurnal_mengajar_history") || "[]");
      const localId = Date.now();
      const localJ = { ...payload, id: localId, created_at: new Date().toISOString() };
      const updatedLocals = [localJ, ...currentLocals];
      localStorage.setItem("jurnal_mengajar_history", JSON.stringify(updatedLocals));
      setJournals(updatedLocals);

      const currentLocalAbsen = JSON.parse(localStorage.getItem("absensi_sekolah_history") || "[]");
      const localAttendance = classStudents.map(s => ({
        id: Math.random().toString(36).substr(2, 9),
        jurnal_id: localId,
        tanggal,
        kelas,
        santri_id: s.id || 0,
        nama_santri: s.nama_lengkap,
        status: attendanceMap[String(s.id || s.nama_lengkap)] || "Hadir",
        guru_username: currentUser?.username || "unknown",
        mata_pelajaran: profile.mata_pelajaran || "Semua Mata Pelajaran",
        created_at: new Date().toISOString()
      }));
      const updatedLocalAbsen = [...localAttendance, ...currentLocalAbsen];
      localStorage.setItem("absensi_sekolah_history", JSON.stringify(updatedLocalAbsen));
      setAbsensiSekolah(updatedLocalAbsen);

      MySwal.fire({
        icon: 'success',
        title: 'Jurnal Tersimpan Offline!',
        text: 'Berhasil menyimpan secara lokal di browser karena kegagalan tabel cloud. Sesi Anda aman.',
        confirmButtonColor: '#f59e0b',
        timer: 2000,
        showConfirmButton: false
      });

      setMateriPokok("");
      setTujuanPembelajaran("");
      setEvaluasi("");
      setKendala("");
      setRencanaPerbaikan("");
      setFotoPembelajaran("");
    } finally {
      setIsSavingJournal(false);
    }
  };

  const handleDeleteJournal = async (id: string | number) => {
    const confirm = await MySwal.fire({
      title: 'Hapus Jurnal Mengajar?',
      text: "Data jurnal mengajar dan kehadiran siswa ini akan dihapus permanen.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (confirm.isConfirmed) {
      try {
        await supabase.from("jurnal_mengajar").delete().eq("id", id);
        await supabase.from("absensi_sekolah").delete().eq("jurnal_id", id);
      } catch (e) {
        console.warn("Cloud delete failed. Purging locally.", e);
      }

      const updatedJ = journals.filter(j => j.id !== id);
      localStorage.setItem("jurnal_mengajar_history", JSON.stringify(updatedJ));
      setJournals(updatedJ);

      const updatedA = absensiSekolah.filter(a => a.jurnal_id !== id);
      localStorage.setItem("absensi_sekolah_history", JSON.stringify(updatedA));
      setAbsensiSekolah(updatedA);

      MySwal.fire({
        icon: 'success',
        title: 'Jurnal Berhasil Dihapus',
        text: 'Laporan mengajar telah dibersihkan.',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  useEffect(() => {
    // 1. Load local history if any
    const saved = localStorage.getItem("absensi_guru_history");
    if (saved) {
      setHistory(JSON.parse(saved));
    }

    // 2. Fetch history from Supabase
    fetchHistoryData();

    // 3. Load students & journals
    fetchStudents();
    fetchJournals();

    // 3. Load custom school location if configured locally as fallback
    const savedLocation = localStorage.getItem("absensi_school_location");
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        setSchoolLocation(parsed);
        setConfigLat(parsed.latitude.toString());
        setConfigLng(parsed.longitude.toString());
        setConfigRadius(parsed.radiusMeters.toString());
      } catch (e) {
        console.error("Failed to parse saved school location", e);
      }
    }

    // 4. Fetch globally from Supabase
    fetchGlobalLocation();

    // 5. Fetch current user's profile and all profiles (if admin/pengurus/super admin)
    fetchMyProfile();
    const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'super admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'pengurus';
    if (isAdminUser) {
      fetchAllProfiles();
    }

    // 6. Fetch master school classes from plotting
    fetchPlottingSchoolClasses();
  }, [currentUser]);

  // Sync profile locally from local storage first on user change
  useEffect(() => {
    if (currentUser?.username) {
      const localProfileKey = `guru_profile_${currentUser.username}`;
      const savedProfile = localStorage.getItem(localProfileKey);
      if (savedProfile) {
        try {
          setProfile(JSON.parse(savedProfile));
        } catch (e) {
          console.warn("Error parsing saved profile fallback", e);
        }
      }
    }
  }, [currentUser]);

  const fetchHistoryData = async () => {
    try {
      let query = supabase
        .from("absensi_guru")
        .select("*")
        .order("waktu_absen", { ascending: false });
      
      if (currentUser?.role !== 'admin') {
        query = query.eq("username", currentUser?.username || "");
      }
      
      const { data, error } = await query;
      if (data && !error) {
        setHistory(data);
        localStorage.setItem("absensi_guru_history", JSON.stringify(data));
      }
    } catch (e) {
      console.warn("Failed to fetch history from Supabase", e);
    }
  };

  const fetchGlobalLocation = async () => {
    try {
      const { data, error } = await supabase
        .from("pengaturan_sekolah")
        .select("*")
        .eq("id", 1)
        .single();
      
      if (data && !error) {
        const globalLoc = {
          latitude: data.latitude,
          longitude: data.longitude,
          radiusMeters: data.radius_meters
        };
        setSchoolLocation(globalLoc);
        setConfigLat(globalLoc.latitude.toString());
        setConfigLng(globalLoc.longitude.toString());
        setConfigRadius(globalLoc.radiusMeters.toString());
        localStorage.setItem("absensi_school_location", JSON.stringify(globalLoc));
      }
    } catch (e) {
      console.warn("Failed to fetch global school location", e);
    }
  };

  const fetchMyProfile = async () => {
    if (!currentUser?.username) return;
    try {
      // 1. Dapatkan data akun pengguna dari tabel 'pengguna' untuk mendapatkan pengguna_id (UUID)
      let penggunaId: string | undefined = undefined;
      let dbUser: any = null;

      try {
        const { data: userData } = await supabase
          .from("pengguna")
          .select("id, username, nama, nama_lengkap, gender, no_hp, peran_utama")
          .eq("username", currentUser.username)
          .maybeSingle();
        if (userData) {
          dbUser = userData;
          penggunaId = userData.id;
        }
      } catch (e) {
        console.warn("Notice checking pengguna table:", e);
      }

      if (!penggunaId && (currentUser as any)?.id) {
        penggunaId = String((currentUser as any).id);
      }

      // 2. Cari data guru dari tabel 'guru' (Kolom: id, created_at, nama_lengkap, jenis_kelamin, nomor_hp, kategori_guru, pengguna_id)
      let guruData: any = null;

      // Cari berdasarkan pengguna_id
      if (penggunaId) {
        const { data } = await supabase
          .from("guru")
          .select("*")
          .eq("pengguna_id", penggunaId)
          .maybeSingle();
        if (data) {
          guruData = data;
        }
      }

      // Jika belum ketemu, cari berdasarkan kesesuaian nama_lengkap
      if (!guruData) {
        const targetName = dbUser?.nama_lengkap || dbUser?.nama || currentUser.name;
        if (targetName) {
          const { data } = await supabase
            .from("guru")
            .select("*")
            .ilike("nama_lengkap", targetName.trim())
            .maybeSingle();
          if (data) {
            guruData = data;
          }
        }
      }

      const localProfileKey = `guru_profile_${currentUser.username}`;
      const cached = localStorage.getItem(localProfileKey);
      let localCachedObj: any = {};
      if (cached) {
        try { localCachedObj = JSON.parse(cached); } catch {}
      }

      if (guruData) {
        const mergedData: GuruSekolahProfile = {
          id: guruData.id,
          created_at: guruData.created_at,
          nama_lengkap: guruData.nama_lengkap || currentUser.name || "",
          jenis_kelamin: (guruData.jenis_kelamin === "P" || guruData.jenis_kelamin === "Perempuan") ? "P" : "L",
          nomor_hp: guruData.nomor_hp || dbUser?.no_hp || localCachedObj.nomor_hp || "",
          kategori_guru: guruData.kategori_guru || dbUser?.peran_utama || (currentUser.role === "guru pondok" ? "Guru Pondok" : "Guru SMP"),
          pengguna_id: guruData.pengguna_id || penggunaId,
          username: currentUser.username,
          foto_diri: localCachedObj.foto_diri || "",
          mata_pelajaran: localCachedObj.mata_pelajaran || ""
        };
        setProfile(mergedData);
        setProfileDbError(false);
        localStorage.setItem(localProfileKey, JSON.stringify(mergedData));
        return;
      }

      // Default jika belum ada baris di tabel 'guru'
      const fallbackProfile: GuruSekolahProfile = {
        id: undefined,
        nama_lengkap: dbUser?.nama_lengkap || dbUser?.nama || currentUser.name || "",
        jenis_kelamin: (dbUser?.gender === "P" || currentUser.gender === "P") ? "P" : "L",
        nomor_hp: dbUser?.no_hp || localCachedObj.nomor_hp || "",
        kategori_guru: dbUser?.peran_utama || (currentUser.role === "guru pondok" ? "Guru Pondok" : "Guru SMP"),
        pengguna_id: penggunaId,
        username: currentUser.username,
        foto_diri: localCachedObj.foto_diri || "",
        mata_pelajaran: localCachedObj.mata_pelajaran || ""
      };
      setProfile(fallbackProfile);
      setProfileDbError(false);
    } catch (err: any) {
      console.warn("Network error fetching guru profile:", err);
      setProfileDbError(true);
    }
  };

  const fetchAllProfiles = async () => {
    try {
      // 1. Ambil semua baris dari tabel 'guru' (id, created_at, nama_lengkap, jenis_kelamin, nomor_hp, kategori_guru, pengguna_id)
      const { data: guruData, error: guruErr } = await supabase
        .from("guru")
        .select("*")
        .order("nama_lengkap", { ascending: true });

      // 2. Ambil data akun pengguna dari tabel 'pengguna' untuk tautan profil
      let penggunaData: any[] = [];
      try {
        const { data: pData } = await supabase
          .from("pengguna")
          .select("id, username, nama, nama_lengkap, gender, no_hp, peran_utama");
        if (pData) penggunaData = pData;
      } catch (e) {
        console.warn("Notice fetching pengguna table:", e);
      }

      const pMap = new Map<string, any>();
      penggunaData.forEach((p: any) => {
        if (p.id) pMap.set(p.id, p);
        if (p.username) pMap.set(p.username.toLowerCase(), p);
      });

      let combinedMap = new Map<string, GuruSekolahProfile>();

      if (guruData && guruData.length > 0) {
        guruData.forEach((g: any) => {
          const linkedPengguna = g.pengguna_id ? pMap.get(g.pengguna_id) : null;
          const uname = linkedPengguna?.username || "";
          const key = g.id || (g.pengguna_id ? `uid_${g.pengguna_id}` : (g.nama_lengkap || "").toLowerCase());
          combinedMap.set(key, {
            id: g.id,
            created_at: g.created_at,
            nama_lengkap: g.nama_lengkap || linkedPengguna?.nama_lengkap || linkedPengguna?.nama || "-",
            jenis_kelamin: (g.jenis_kelamin === "P" || g.jenis_kelamin === "Perempuan" || linkedPengguna?.gender === "P") ? "P" : "L",
            nomor_hp: g.nomor_hp || linkedPengguna?.no_hp || "",
            kategori_guru: g.kategori_guru || linkedPengguna?.peran_utama || "Guru SMP",
            pengguna_id: g.pengguna_id,
            username: uname,
            foto_diri: "",
            mata_pelajaran: ""
          });
        });
      }

      // Tambahkan guru dari tabel pengguna yang belum memiliki entri di tabel guru
      penggunaData.forEach((u: any) => {
        const isTeacher =
          u.peran_utama === "guru_pondok" ||
          u.peran_utama === "guru_sekolah" ||
          u.peran_utama === "guru SMP" ||
          (u.jabatan && (u.jabatan.toLowerCase().includes("guru") || u.jabatan.toLowerCase().includes("ustadz")));

        if (isTeacher) {
          const alreadyExists = Array.from(combinedMap.values()).some(
            c => c.pengguna_id === u.id || (u.username && c.username?.toLowerCase() === u.username.toLowerCase())
          );
          if (!alreadyExists) {
            const key = `pengguna_${u.id}`;
            combinedMap.set(key, {
              id: undefined,
              nama_lengkap: u.nama_lengkap || u.nama || u.username,
              jenis_kelamin: u.gender === "P" ? "P" : "L",
              nomor_hp: u.no_hp || "",
              kategori_guru: u.peran_utama === "guru_pondok" ? "Guru Pondok" : "Guru SMP",
              pengguna_id: u.id,
              username: u.username,
              foto_diri: "",
              mata_pelajaran: ""
            });
          }
        }
      });

      const listProfiles = Array.from(combinedMap.values());
      if (listProfiles.length > 0) {
        setAllProfiles(listProfiles);
        localStorage.setItem("guru_sekolah_all_profiles", JSON.stringify(listProfiles));
      }
    } catch (err) {
      console.warn("Failed to fetch all profiles", err);
    }
  };

  const handleSaveConfig = async () => {
    const newLocation = {
      latitude: parseFloat(configLat),
      longitude: parseFloat(configLng),
      radiusMeters: parseInt(configRadius, 10)
    };
    if (isNaN(newLocation.latitude) || isNaN(newLocation.longitude) || isNaN(newLocation.radiusMeters)) {
      MySwal.fire({
        icon: 'error',
        title: 'Input Tidak Valid',
        text: 'Pastikan Latitude, Longitude, dan Radius berupa angka yang valid.'
      });
      return;
    }
    
    setSchoolLocation(newLocation);
    localStorage.setItem("absensi_school_location", JSON.stringify(newLocation));

    try {
      const { error } = await supabase
        .from("pengaturan_sekolah")
        .upsert([{
          id: 1,
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          radius_meters: newLocation.radiusMeters
        }]);
        
      if (error) {
        console.warn("Failed to save to Supabase. Table might not exist yet.", error.message);
      }
    } catch (e) {
      console.warn("Supabase upsert error:", e);
    }

    MySwal.fire({
      icon: 'success',
      title: 'Konfigurasi Tersimpan',
      text: 'Lokasi sekolah berhasil diperbarui untuk semua pengguna.',
      timer: 1500,
      showConfirmButton: false
    });
    setShowConfig(false);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation tidak didukung oleh browser ini.");
      return;
    }
    
    setIsLocating(true);
    setErrorMsg(null);
    
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
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMsg("Akses lokasi ditolak. Harap izinkan akses lokasi untuk absensi.");
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMsg("Informasi lokasi tidak tersedia.");
            break;
          case error.TIMEOUT:
            setErrorMsg("Permintaan lokasi timeout.");
            break;
          default:
            setErrorMsg("Terjadi kesalahan yang tidak diketahui saat mengambil lokasi.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSubmitAbsensi = async () => {
    if (!location || distance === null) return;
    
    const statusLokasi = distance <= schoolLocation.radiusMeters ? "Dalam Jangkauan" : "Luar Jangkauan";
    
    if (statusLokasi === "Luar Jangkauan") {
      const confirm = await MySwal.fire({
        icon: 'warning',
        title: 'Di Luar Area Sekolah',
        text: `Anda berada ${Math.round(distance)} meter dari sekolah (Maksimal ${schoolLocation.radiusMeters} meter). Tetap ingin absen?`,
        showCancelButton: true,
        confirmButtonText: 'Ya, Tetap Absen',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#eab308'
      });
      if (!confirm.isConfirmed) return;
    }
    
    setIsSaving(true);
    
    const record = {
      username: currentUser?.username || "unknown",
      nama_guru: profile.nama_lengkap || currentUser?.name || "Guru",
      waktu_absen: new Date().toISOString(),
      latitude: location.lat,
      longitude: location.lng,
      status_lokasi: statusLokasi,
      keterangan: "Hadir"
    };
    
    const updatedHistory = [record, ...history];
    localStorage.setItem("absensi_guru_history", JSON.stringify(updatedHistory));
    setHistory(updatedHistory);
    
    try {
      const { error } = await supabase
        .from('absensi_guru')
        .insert([record]);
        
      if (error) {
        console.warn("Supabase insert failed. Table might not exist yet:", error.message);
        MySwal.fire({
          icon: 'error',
          title: 'Gagal Menyimpan di Server',
          text: 'Data absen gagal terkirim ke server database (Supabase). ' + error.message,
        });
        setIsSaving(false);
        return;
      }
    } catch (e: any) {
      console.warn("Supabase error:", e);
      MySwal.fire({
        icon: 'error',
        title: 'Gagal Terkoneksi',
        text: 'Tidak dapat menghubungi server. Periksa koneksi internet Anda.',
      });
      setIsSaving(false);
      return;
    }
    
    setIsSaving(false);
    
    MySwal.fire({
      icon: 'success',
      title: 'Absensi Berhasil Disimpan!',
      text: statusLokasi === 'Dalam Jangkauan' ? 'Anda tercatat di dalam area sekolah.' : 'Anda tercatat di luar area sekolah.',
      confirmButtonColor: '#10b981',
      timer: 2000,
      showConfirmButton: false
    });
    
    fetchHistoryData();
  };

  // Profile Save Handler (Menyesuaikan dengan tabel database 'guru')
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    if (!profile.nama_lengkap || !profile.nama_lengkap.trim()) {
      MySwal.fire({
        icon: 'error',
        title: 'Validasi Gagal',
        text: 'Nama Lengkap pendidik wajib diisi.'
      });
      setIsSavingProfile(false);
      return;
    }

    try {
      // 1. Pastikan pengguna_id (UUID) terhubung jika ada akun login
      let linkedPenggunaId = profile.pengguna_id;
      if (!linkedPenggunaId && currentUser?.username) {
        const { data: dbUser } = await supabase
          .from("pengguna")
          .select("id")
          .eq("username", currentUser.username)
          .maybeSingle();
        if (dbUser?.id) {
          linkedPenggunaId = dbUser.id;
        } else if ((currentUser as any)?.id) {
          linkedPenggunaId = String((currentUser as any).id);
        }
      }

      // 2. Siapkan payload sesuai kolom persis tabel 'guru':
      // nama_lengkap, jenis_kelamin, nomor_hp, kategori_guru, pengguna_id
      const guruPayload: {
        nama_lengkap: string;
        jenis_kelamin: string;
        nomor_hp: string | null;
        kategori_guru: string;
        pengguna_id?: string | null;
      } = {
        nama_lengkap: profile.nama_lengkap.trim(),
        jenis_kelamin: profile.jenis_kelamin || "L",
        nomor_hp: profile.nomor_hp ? profile.nomor_hp.trim() : null,
        kategori_guru: profile.kategori_guru ? profile.kategori_guru.trim() : "Guru SMP"
      };

      if (linkedPenggunaId) {
        guruPayload.pengguna_id = linkedPenggunaId;
      }

      let savedGuruId = profile.id;
      let saveError: any = null;

      // 3. Simpan ke tabel 'guru' di Supabase
      if (savedGuruId) {
        // Update berdasarkan ID UUID yang sudah ada
        const { error } = await supabase
          .from("guru")
          .update(guruPayload)
          .eq("id", savedGuruId);
        saveError = error;
      } else if (linkedPenggunaId) {
        // Cek apakah data guru dengan pengguna_id ini sudah ada di database
        const { data: existingGuru } = await supabase
          .from("guru")
          .select("id")
          .eq("pengguna_id", linkedPenggunaId)
          .maybeSingle();

        if (existingGuru?.id) {
          savedGuruId = existingGuru.id;
          const { error } = await supabase
            .from("guru")
            .update(guruPayload)
            .eq("id", existingGuru.id);
          saveError = error;
        } else {
          // Insert baris baru ke tabel guru
          const { data: inserted, error } = await supabase
            .from("guru")
            .insert([guruPayload])
            .select();
          saveError = error;
          if (inserted && inserted[0]?.id) {
            savedGuruId = inserted[0].id;
          }
        }
      } else {
        // Insert data guru baru
        const { data: inserted, error } = await supabase
          .from("guru")
          .insert([guruPayload])
          .select();
        saveError = error;
        if (inserted && inserted[0]?.id) {
          savedGuruId = inserted[0].id;
        }
      }

      // Sinkronkan nama dan no_hp ke tabel pengguna jika akun login terhubung
      if (linkedPenggunaId) {
        try {
          await supabase
            .from("pengguna")
            .update({
              nama_lengkap: profile.nama_lengkap.trim(),
              nama: profile.nama_lengkap.trim(),
              gender: profile.jenis_kelamin,
              no_hp: profile.nomor_hp || null
            })
            .eq("id", linkedPenggunaId);
        } catch (syncErr) {
          console.warn("Notice syncing to pengguna table:", syncErr);
        }
      }

      if (saveError) {
        console.error("Gagal simpan ke tabel guru:", saveError);
        MySwal.fire({
          icon: 'error',
          title: 'Gagal Menyimpan ke Database',
          text: saveError.message || 'Terjadi kesalahan saat menyimpan data profil ke tabel guru.',
          confirmButtonColor: '#ef4444'
        });
      } else {
        setProfileDbError(false);
        const updatedProfile: GuruSekolahProfile = {
          ...profile,
          id: savedGuruId,
          pengguna_id: linkedPenggunaId
        };
        setProfile(updatedProfile);

        const localProfileKey = `guru_profile_${currentUser?.username || "unknown"}`;
        localStorage.setItem(localProfileKey, JSON.stringify(updatedProfile));

        // Update list guru lokal
        const savedAllProfiles = localStorage.getItem("guru_sekolah_all_profiles");
        let listProfiles: GuruSekolahProfile[] = [];
        if (savedAllProfiles) {
          try { listProfiles = JSON.parse(savedAllProfiles); } catch {}
        }
        const index = listProfiles.findIndex(p => (savedGuruId && p.id === savedGuruId) || (p.username && p.username === profile.username));
        if (index >= 0) {
          listProfiles[index] = updatedProfile;
        } else {
          listProfiles.push(updatedProfile);
        }
        localStorage.setItem("guru_sekolah_all_profiles", JSON.stringify(listProfiles));
        setAllProfiles(listProfiles);

        MySwal.fire({
          icon: 'success',
          title: 'Profil Berhasil Disimpan',
          text: 'Data profil guru berhasil disinkronisasi ke tabel database.',
          timer: 1500,
          showConfirmButton: false
        });

        setIsEditing(false);
        setIsEditingProfileModal(false);
        fetchMyProfile();
        fetchAllProfiles();
      }
    } catch (err: any) {
      console.error("Supabase save profile error:", err);
      MySwal.fire({
        icon: 'error',
        title: 'Terjadi Gangguan Koneksi',
        text: err.message || 'Gagal menyimpan profil ke server database.',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Upload photo to Supabase Storage (bucket: foto_siswa, folder: foto_guru)
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      MySwal.fire({
        icon: 'error',
        title: 'File Terlalu Besar',
        text: 'Ukuran foto maksimal adalah 2 MB.'
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      MySwal.fire({
        icon: 'error',
        title: 'Format Salah',
        text: 'File harus berupa gambar (PNG/JPG/JPEG).'
      });
      return;
    }

    setIsUploadingPhoto(true);

    try {
      // Create a unique file name inside foto_guru/ folder
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `foto_guru/${fileName}`;

      const { data, error } = await supabase.storage
        .from("foto_siswa")
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("foto_siswa")
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, foto_diri: publicUrl }));

      MySwal.fire({
        icon: 'success',
        title: 'Foto Terunggah',
        text: 'Foto profil berhasil disimpan di Cloud Storage.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } catch (err: any) {
      console.error("Error uploading guru photo:", err);
      // Fallback to Base64 in case of storage issue (like bucket not exists, offline, or RLS error)
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, foto_diri: reader.result as string }));
        MySwal.fire({
          icon: 'warning',
          title: 'Unggah dengan Fallback',
          text: 'Gagal mengunggah ke Cloud Storage (' + (err?.message || "error") + '). Menggunakan format penyimpanan lokal (Base64) agar tetap dapat disimpan.',
          confirmButtonColor: '#0c66e4'
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Filter profiles based on search
  const filteredProfiles = allProfiles.filter(p => 
    String(p.nama_lengkap || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(p.nomor_hp || "").includes(searchQuery) ||
    String(p.kategori_guru || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(p.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full py-6 px-4 animate-fade-in space-y-6">
      
      {/* HEADER: PROFIL MANDIRI GURU (FULL WIDTH BANNER) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
        {/* Decorative subtle background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-50/40 via-transparent to-transparent rounded-bl-full pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left Area: Photo & Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 w-full md:w-auto">
            
            {/* Foto Diri */}
            <div className="relative shrink-0">
              {profile.foto_diri ? (
                <img 
                  src={profile.foto_diri} 
                  alt="Foto Diri" 
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md ring-1 ring-slate-150"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center border-2 border-dashed border-blue-200 shadow-inner">
                  <User className="w-9 h-9 text-blue-500" />
                </div>
              )}
              <span className="absolute -bottom-1 right-1 bg-emerald-500 border-2 border-white w-5 h-5 rounded-full flex items-center justify-center shadow-sm" title="Guru Aktif">
                <span className="w-2 h-2 bg-white rounded-full animate-ping" />
              </span>
            </div>

            {/* Teacher Details */}
            <div className="text-center sm:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="text-[10px] font-black bg-blue-50 text-[#0c66e4] uppercase tracking-wider px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Pendidik Resmi
                </span>

                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 uppercase tracking-wider px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
                  <GraduationCap className="w-2.5 h-2.5" /> {profile.kategori_guru || "Guru SMP"}
                </span>
                
                {profile.nama_lengkap && profile.id ? (
                  <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 uppercase tracking-wider px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5" /> Terdaftar di Database
                  </span>
                ) : (
                  <span className="text-[10px] font-black bg-amber-50 text-amber-600 uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-100 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Belum Terdaftar di Tabel Guru
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">
                {profile.nama_lengkap || currentUser?.name || "Guru Sekolah"}
              </h2>

              <p className="text-sm font-semibold text-slate-500 mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-y-1 gap-x-3">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Kategori:</span> 
                  <span className="font-bold text-[#0c66e4]">{profile.kategori_guru || "Guru SMP"}</span>
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Akun Login:</span> 
                  <span className="font-mono font-bold text-slate-700">{profile.username || currentUser?.username}</span>
                </span>
                {profile.pengguna_id && (
                  <>
                    <span className="hidden sm:inline text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                      <span>ID Akun: {String(profile.pengguna_id).substring(0, 8)}...</span>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right Area: Action Buttons & Secondary Info */}
          <div className="flex flex-wrap md:flex-col items-center md:items-end gap-3 w-full md:w-auto shrink-0 pt-4 md:pt-0 border-t border-slate-100 md:border-0 justify-center md:justify-start">
            <div className="flex flex-wrap gap-2 justify-center md:justify-end">
              <button
                onClick={() => setIsEditingProfileModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#0c66e4] hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" /> Ubah Profil Guru
              </button>

              {(currentUser?.role === 'admin' || currentUser?.role === 'super admin' || currentUser?.role === 'superadmin') && (
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors cursor-pointer border border-slate-200"
                >
                  <Settings className="w-3.5 h-3.5" /> Atur Lokasi Sekolah
                </button>
              )}
            </div>
            
            <p className="text-[11px] text-slate-400 font-medium">
              Data Profil Guru Sesuai Tabel Database Supabase
            </p>
          </div>
        </div>

        {/* Full Details grid: Kategori Guru, No HP, Kelamin, Database ID */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#0c66e4] shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Guru</span>
              <span className="text-xs font-bold text-slate-700 block truncate">
                {profile.kategori_guru || "Guru SMP"}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nomor HP / WhatsApp</span>
              <span className="text-xs font-bold text-slate-700 block truncate font-mono">
                {profile.nomor_hp ? (
                  <a
                    href={`https://wa.me/${String(profile.nomor_hp).replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:underline"
                  >
                    {profile.nomor_hp}
                  </a>
                ) : (
                  "Belum diisi"
                )}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jenis Kelamin</span>
              <span className="text-xs font-bold text-slate-700 block truncate">
                {profile.jenis_kelamin === "L" ? "Laki-laki" : profile.jenis_kelamin === "P" ? "Perempuan" : "Belum diisi"}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3" title={profile.id || "Belum ada ID (baru)"}>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ID Tabel Guru (UUID)</span>
              <span className="text-xs font-bold text-slate-700 block truncate font-mono">
                {profile.id ? String(profile.id).substring(0, 13) + '...' : "Otomatis dibuat"}
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* CONFIGURATION PANEL (ADMIN ONLY) */}
      {showConfig && (currentUser?.role === 'admin' || currentUser?.role === 'super admin' || currentUser?.role === 'superadmin') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 animate-fade-in">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0c66e4]" /> Konfigurasi Titik Pusat Sekolah
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
              <input 
                type="text" 
                value={configLat}
                onChange={e => setConfigLat(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="-6.200000"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
              <input 
                type="text" 
                value={configLng}
                onChange={e => setConfigLng(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="106.816666"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Radius (Meter)</label>
              <input 
                type="number" 
                value={configRadius}
                onChange={e => setConfigRadius(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button 
              onClick={handleSaveConfig}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </div>
      )}



      {/* CONNECTION ALERT FOR GURU_SEKOLAH */}
      {profileDbError && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-sm animate-fade-in">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="text-amber-600 flex-shrink-0 w-5 h-5" />
            <div>
              <h4 className="font-extrabold text-amber-900 text-xs">Mode Penyimpanan Lokal Sementara (Offline)</h4>
              <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                Data presensi guru saat ini tersimpan di penyimpanan lokal browser.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB Content: ABSENSI KEHADIRAN */}
      {activeSubTab === "absensi" && (
        <div className="space-y-6">
          {/* PROFIL MANDIRI GURU */}
          {false && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <User className="text-[#0c66e4] w-4.5 h-4.5" /> Profil Mandiri Guru
              </h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0c66e4] text-xs font-black rounded-lg transition-all cursor-pointer border border-blue-100/50"
                >
                  <Edit className="w-3 h-3" /> Ubah Data Diri
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    fetchMyProfile(); // Reload
                  }}
                  className="px-2.5 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
              )}
            </div>

            {!isEditing ? (
              /* PREVIEW PROFILE VIEW */
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Photo Display Card */}
                <div className="flex flex-col items-center justify-center text-center space-y-3 md:border-r border-slate-100 md:pr-6 pb-4 md:pb-0">
                  <div className="relative group">
                    {profile.foto_diri ? (
                      <img 
                        src={profile.foto_diri} 
                        alt="Foto Diri" 
                        className="w-24 h-24 rounded-full object-cover border-4 border-blue-50 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200">
                        <Camera className="w-8 h-8 mb-0.5 text-slate-300" />
                        <span className="text-[9px] font-semibold">Belum Ada Foto</span>
                      </div>
                    )}
                    <span className="absolute bottom-0 right-1 bg-slate-800 text-white rounded-full p-1 shadow">
                      <User className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-850 text-base leading-tight">{profile.nama_lengkap || currentUser?.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-1 uppercase bg-slate-100 px-2.5 py-0.5 rounded-full inline-block">
                      {(currentUser?.role === 'admin' || currentUser?.role === 'super admin' || currentUser?.role === 'superadmin') ? 'Administrator' : 'Guru Sekolah'}
                    </p>
                  </div>
                </div>

                {/* Personal Data Grid View */}
                <div className="md:col-span-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-4">
                    
                    {/* 1. Nama Lengkap */}
                    <div className="space-y-0.5 pb-1.5 border-b border-slate-50 text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Nama Lengkap</span>
                      <span className="text-xs font-bold text-slate-800">{profile.nama_lengkap || "-"}</span>
                    </div>

                    {/* 2. NIK */}
                    <div className="space-y-0.5 pb-1.5 border-b border-slate-50 text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">NIK KTP</span>
                      <span className="text-xs font-bold text-slate-800 font-mono tracking-wide">{profile.id || "-"}</span>
                    </div>

                    {/* 3. Jenis Kelamin */}
                    <div className="space-y-0.5 pb-1.5 border-b border-slate-50 text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Jenis Kelamin</span>
                      <span className="text-xs font-bold text-slate-800">
                        {profile.jenis_kelamin === "L" ? "Laki-laki" : profile.jenis_kelamin === "P" ? "Perempuan" : "-"}
                      </span>
                    </div>

                    {/* 4. Tempat & Tanggal Lahir */}
                    <div className="space-y-0.5 pb-1.5 border-b border-slate-50 sm:col-span-2 text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Tempat, Tanggal Lahir</span>
                      <span className="text-xs font-bold text-slate-800">
                        {profile.tempat_lahir ? `${profile.tempat_lahir}, ` : ""}
                        {profile.tanggal_lahir ? new Date(profile.tanggal_lahir).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : "-"}
                      </span>
                    </div>

                    {/* 5. Nomor Seluler */}
                    <div className="space-y-0.5 pb-1.5 border-b border-slate-50 text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">WhatsApp</span>
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        {profile.nomor_seluler ? (
                          <>
                            <Phone className="w-3 h-3 text-emerald-500" />
                            <a 
                              href={`https://wa.me/${String(profile.nomor_seluler || "").replace(/[^0-9]/g, "")}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-emerald-600 hover:underline"
                            >
                              {profile.nomor_seluler}
                            </a>
                          </>
                        ) : "-"}
                      </span>
                    </div>

                    {/* 6. Alamat Pribadi */}
                    <div className="space-y-0.5 pb-1.5 border-b border-slate-50 sm:col-span-2 text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Alamat Pribadi (Sesuai KTP)</span>
                      <span className="text-xs font-bold text-slate-800 leading-normal block">{profile.alamat_pribadi || "-"}</span>
                    </div>

                    {/* 7. Status Foto */}
                    <div className="space-y-0.5 pb-1.5 border-b border-slate-50 text-left">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Status Foto Diri</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block ${profile.foto_diri ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {profile.foto_diri ? "✓ Terunggah" : "⚠️ Belum Ada Foto"}
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            ) : (
              /* EDIT PROFILE FORM INLINE */
              <form onSubmit={handleSaveProfile} className="space-y-6 text-left">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Visual Photo Editor */}
                  <div className="flex flex-col items-center space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                    <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Foto Diri</span>
                    <div className="relative w-28 h-28 group">
                      {isUploadingPhoto ? (
                        <div className="w-full h-full rounded-full bg-slate-100 border-2 border-slate-200 flex flex-col items-center justify-center text-slate-500">
                          <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                          <span className="text-[8px] mt-1 font-bold text-indigo-600 animate-pulse">Mengunggah...</span>
                        </div>
                      ) : profile.foto_diri ? (
                        <img 
                          src={profile.foto_diri} 
                          alt="Preview Foto" 
                          className="w-full h-full rounded-full object-cover border-4 border-white shadow-md"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                          <Camera className="w-6 h-6 text-slate-300" />
                          <span className="text-[8px] mt-0.5 font-semibold">Pilih Foto</span>
                        </div>
                      )}
                      {profile.foto_diri && !isUploadingPhoto && (
                        <button
                          type="button"
                          onClick={() => setProfile(prev => ({ ...prev, foto_diri: "" }))}
                          className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow animate-fade-in"
                          title="Hapus Foto"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="w-full text-center">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handlePhotoChange}
                        ref={fileInputRef}
                        className="hidden"
                        id="profile-foto-file-input"
                        disabled={isUploadingPhoto}
                      />
                      <label 
                        htmlFor="profile-foto-file-input"
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 border text-[10px] font-bold rounded-lg shadow-sm ${
                          isUploadingPhoto 
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                            : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
                        }`}
                      >
                        {isUploadingPhoto ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-slate-400" /> Mengunggah...
                          </>
                        ) : (
                          <>
                            <Camera className="w-3 h-3" /> Unggah Foto
                          </>
                        )}
                      </label>
                      <p className="text-[8px] text-slate-400 mt-1.5">Maksimal 2MB (JPG/PNG)</p>
                    </div>

                    {/* Pas Foto URL Fallback */}
                    <div className="w-full pt-2 border-t border-slate-200">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left">Atau Paste URL Foto</label>
                      <input 
                        type="text" 
                        value={profile.foto_diri && !profile.foto_diri.startsWith("data:") ? profile.foto_diri : ""}
                        onChange={e => setProfile(prev => ({ ...prev, foto_diri: e.target.value }))}
                        className="w-full px-2 py-1 text-[10px] border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="https://example.com/foto.jpg"
                      />
                    </div>
                  </div>

                  {/* Form Inputs */}
                  <div className="md:col-span-2 space-y-3">
                    
                    {/* 1. Nama Lengkap */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text"
                        required
                        value={profile.nama_lengkap}
                        onChange={e => setProfile(prev => ({ ...prev, nama_lengkap: e.target.value }))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold text-slate-800"
                        placeholder="Masukkan nama lengkap"
                      />
                    </div>

                    {/* 2. NIK */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          NIK (KTP) <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="text"
                          required
                          maxLength={16}
                          value={profile.id}
                          onChange={e => setProfile(prev => ({ ...prev, nik: e.target.value.replace(/[^0-9]/g, "") }))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                          placeholder="16 digit KTP"
                        />
                      </div>

                      {/* 3. Jenis Kelamin */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Jenis Kelamin <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <label className={`flex items-center justify-center p-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                            profile.jenis_kelamin === "L" 
                              ? "bg-blue-50 border-blue-500 text-blue-700" 
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}>
                            <input 
                              type="radio" 
                              name="edit_jenis_kelamin" 
                              checked={profile.jenis_kelamin === "L"} 
                              onChange={() => setProfile(prev => ({ ...prev, jenis_kelamin: "L" }))}
                              className="hidden" 
                            />
                            Laki-laki
                          </label>
                          <label className={`flex items-center justify-center p-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                            profile.jenis_kelamin === "P" 
                              ? "bg-pink-50 border-pink-500 text-pink-700" 
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}>
                            <input 
                              type="radio" 
                              name="edit_jenis_kelamin" 
                              checked={profile.jenis_kelamin === "P"} 
                              onChange={() => setProfile(prev => ({ ...prev, jenis_kelamin: "P" }))}
                              className="hidden" 
                            />
                            Perempuan
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Birthplace and Birthday */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tempat Lahir</label>
                        <input 
                          type="text"
                          value={profile.tempat_lahir}
                          onChange={e => setProfile(prev => ({ ...prev, tempat_lahir: e.target.value }))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Contoh: Sleman"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tanggal Lahir</label>
                        <input 
                          type="date"
                          value={profile.tanggal_lahir}
                          onChange={e => setProfile(prev => ({ ...prev, tanggal_lahir: e.target.value }))}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Alamat Pribadi */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Alamat Pribadi (KTP)</label>
                      <textarea 
                        rows={2}
                        value={profile.alamat_pribadi}
                        onChange={e => setProfile(prev => ({ ...prev, alamat_pribadi: e.target.value }))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Masukkan alamat KTP lengkap"
                      />
                    </div>

                    {/* Nomor Seluler */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">No. WhatsApp</label>
                      <input 
                        type="text"
                        value={profile.nomor_seluler}
                        onChange={e => setProfile(prev => ({ ...prev, nomor_seluler: e.target.value.replace(/[^0-9+]/g, "") }))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Contoh: 081234567890"
                      />
                    </div>

                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      fetchMyProfile();
                    }}
                    className="px-3 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" /> Simpan Perubahan
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}
          </div>
          )}

          {/* LOCATION BOX */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
            {!location ? (
              <div className="space-y-4">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-[#0c66e4]">
                  <Crosshair className="w-10 h-10" />
                </div>
                <h3 className="font-bold text-lg text-slate-700">Dapatkan Lokasi Anda</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Untuk melakukan absensi, sistem perlu mengetahui lokasi Anda saat ini. Pastikan GPS/Location service pada perangkat Anda dalam keadaan aktif.
                </p>
                
                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center justify-center gap-2 mt-4">
                    <AlertTriangle className="w-4 h-4" /> {errorMsg}
                  </div>
                )}
                
                <button 
                  onClick={handleGetLocation}
                  disabled={isLocating}
                  className="mt-6 px-8 py-3 bg-[#0c66e4] hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 mx-auto disabled:opacity-50 cursor-pointer"
                >
                  {isLocating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> 
                      Mencari Titik Lokasi...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-5 h-5" /> 
                      Cek Titik Lokasi Saat Ini
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                  
                  <div className="text-left space-y-3 flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Lokasi</p>
                    {distance !== null && distance <= schoolLocation.radiusMeters ? (
                      <div className="flex items-center gap-2 text-emerald-600 font-black text-lg">
                        <CheckCircle className="w-6 h-6" /> 
                        <span>DALAM JANGKAUAN SEKOLAH</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600 font-black text-lg">
                        <XCircle className="w-6 h-6" /> 
                        <span>DI LUAR JANGKAUAN</span>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs text-slate-500">Jarak ke Pusat</p>
                        <p className="font-bold text-slate-800">{distance ? Math.round(distance) : '-'} Meter</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Akurasi GPS</p>
                        <p className="font-bold text-slate-800">{Math.round(location.accuracy)} Meter</p>
                      </div>
                    </div>
                  </div>
                  
                </div>
                
                <div className="flex justify-center gap-4">
                  <button 
                    onClick={handleGetLocation}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Refresh Lokasi
                  </button>
                  <button 
                    onClick={handleSubmitAbsensi}
                    disabled={isSaving}
                    className={`px-8 py-3 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                      distance !== null && distance <= schoolLocation.radiusMeters 
                        ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25" 
                        : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
                    } disabled:opacity-50`}
                  >
                    {isSaving ? "Menyimpan..." : (
                      <>
                        <Save className="w-5 h-5" /> 
                        Kirim Data Absensi Kehadiran
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* HISTORY TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">{(currentUser?.role === 'admin' || currentUser?.role === 'super admin' || currentUser?.role === 'superadmin') ? "Semua Riwayat Absensi" : "Riwayat Absensi Anda"}</h3>
            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Waktu</th>
                      <th className="px-4 py-3">Nama</th>
                      <th className="px-4 py-3">Status Lokasi</th>
                      <th className="px-4 py-3 rounded-tr-lg text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{new Date(h.waktu_absen).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3">{h.nama_guru}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                            h.status_lokasi === "Dalam Jangkauan" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {h.status_lokasi}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-blue-500 hover:underline text-xs font-medium"
                          >
                            Lihat Peta
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm">Belum ada riwayat absensi.</div>
            )}
          </div>

        </div>
      )}

      {/* SUB-TAB Content: TAB MENGAJAR (Laporan KBM, Jurnal Kelas & Jurnal Guru) */}
      {activeSubTab === "mengajar" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* HEADER TAB MENGAJAR */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-4">
              <BookOpen className="w-64 h-64" />
            </div>
            <div className="relative z-10 space-y-2">
              <span className="bg-blue-500/30 text-blue-200 border border-blue-400/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                Sistem Jurnal Mengajar (KBM)
              </span>
              <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-300" /> Laporan & Jurnal Pembelajaran
              </h2>
              <p className="text-xs md:text-sm text-blue-100/90 max-w-2xl leading-relaxed">
                Platform pencatatan kegiatan belajar mengajar bagi guru sekolah. Tulis materi pembelajaran, pantau kehadiran siswa harian, sertakan bukti kamera langsung, serta cetak Jurnal Guru & Kelas dengan mudah.
              </p>
            </div>

            {/* SELECTION INTERNAL TABS */}
            <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-white/10">
              <button
                onClick={() => setMengajarTab("input")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  mengajarTab === "input"
                    ? "bg-white text-indigo-900 shadow-md scale-[1.02]"
                    : "bg-white/10 hover:bg-white/15 text-white"
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Isi Jurnal Baru
              </button>
              <button
                onClick={() => setMengajarTab("jurnal_guru")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  mengajarTab === "jurnal_guru"
                    ? "bg-white text-indigo-900 shadow-md scale-[1.02]"
                    : "bg-white/10 hover:bg-white/15 text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Jurnal Guru
              </button>
              <button
                onClick={() => setMengajarTab("jurnal_kelas")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  mengajarTab === "jurnal_kelas"
                    ? "bg-white text-indigo-900 shadow-md scale-[1.02]"
                    : "bg-white/10 hover:bg-white/15 text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Jurnal Kelas
              </button>
            </div>
          </div>

          {/* TAB MENGAJAR: SUB-VIEW INPUT */}
          {mengajarTab === "input" && (
            <form onSubmit={handleSaveJournal} className="space-y-6">
              
              {/* SECTION 1: INFORMASI UMUM */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold text-sm">1</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Informasi Umum KBM</h3>
                    <p className="text-[11px] text-slate-500">Isi waktu pelaksanaan, kelas sasaran, dan tahun ajaran.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Tanggal */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Tanggal KBM</label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        value={tanggal}
                        onChange={(e) => setTanggal(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Hari */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Hari</label>
                    <input
                      type="text"
                      value={hari}
                      className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 focus:outline-none"
                      disabled
                    />
                  </div>

                  {/* Kelas */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Pilih Kelas</label>
                    <select
                      value={kelas}
                      onChange={(e) => setKelas(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                      required
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {plottingSchoolClasses && plottingSchoolClasses.length > 0 ? (
                        plottingSchoolClasses
                          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                          .map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))
                      ) : (
                        ["7A", "7B", "8A", "8B", "9A", "9B", "10 IPA", "10 IPS", "11 IPA", "11 IPS", "12 IPA", "12 IPS"].map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Semester */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Semester</label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>

                  {/* Tahun Ajaran */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Tahun Ajaran</label>
                    <input
                      type="text"
                      value={tahunAjaran}
                      onChange={(e) => setTahunAjaran(e.target.value)}
                      placeholder="e.g. 2025/2026"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: RINCIAN PEMBELAJARAN */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold text-sm">2</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Rincian Pembelajaran</h3>
                    <p className="text-[11px] text-slate-500">Spesifikasi materi, jam, mata pelajaran, dan tujuan KBM.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Jam Pelajaran */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Jam Pelajaran</label>
                    <select
                      value={jamPelajaran}
                      onChange={(e) => setJamPelajaran(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                    >
                      <option value="Jam ke 1-2 (07:00 - 08:30)">Jam ke 1-2 (07:00 - 08:30)</option>
                      <option value="Jam ke 3-4 (08:30 - 10:00)">Jam ke 3-4 (08:30 - 10:00)</option>
                      <option value="Jam ke 5-6 (10:30 - 12:00)">Jam ke 5-6 (10:30 - 12:00)</option>
                      <option value="Jam ke 7-8 (13:00 - 14:30)">Jam ke 7-8 (13:00 - 14:30)</option>
                      <option value="Lainnya">Lainnya (Jam Custom)</option>
                    </select>

                    {jamPelajaran === "Lainnya" && (
                      <input
                        type="text"
                        value={customJam}
                        onChange={(e) => setCustomJam(e.target.value)}
                        placeholder="Masukkan Jam KBM manual (e.g. 09:00 - 10:30)"
                        className="w-full mt-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                        required
                      />
                    )}
                  </div>

                  {/* Mata Pelajaran */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Mata Pelajaran</label>
                    <input
                      type="text"
                      value={profile.mata_pelajaran || ""}
                      className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 focus:outline-none"
                      disabled
                      placeholder="Mata pelajaran terisi otomatis dari profil Anda"
                    />
                    <p className="text-[10px] text-slate-400">Diambil otomatis dari Mata Pelajaran di Profil Guru.</p>
                  </div>

                  {/* Materi Pokok */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Materi Pokok Pembelajaran</label>
                    <input
                      type="text"
                      value={materiPokok}
                      onChange={(e) => setMateriPokok(e.target.value)}
                      placeholder="e.g. Bab 3: Thaharah (Tata Cara Wudhu & Tayamum)"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                      required
                    />
                  </div>

                  {/* Tujuan Pembelajaran */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Tujuan Pembelajaran</label>
                    <textarea
                      value={tujuanPembelajaran}
                      onChange={(e) => setTujuanPembelajaran(e.target.value)}
                      placeholder="Tuliskan tujuan pokok dari penyampaian materi hari ini..."
                      rows={3}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: DAFTAR KEHADIRAN SISWA */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold text-sm">3</div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Daftar Kehadiran Siswa</h3>
                      <p className="text-[11px] text-slate-500">Semua siswa default Hadir. Ubah keterangan jika ada yang tidak masuk.</p>
                    </div>
                  </div>
                  
                  {kelas && (
                    <div className="relative max-w-xs w-full">
                      <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Cari nama siswa di kelas..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                      />
                    </div>
                  )}
                </div>

                {!kelas ? (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                    <p className="text-xs font-bold text-slate-500">Pilih Kelas Terlebih Dahulu</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Daftar siswa akan dimuat otomatis setelah kelas sasaran KBM dipilih.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Attendance stats summary */}
                    <div className="flex flex-wrap items-center gap-3 bg-blue-50/80 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-100/40">
                      <span className="text-xs font-extrabold text-blue-900 dark:text-blue-300">Ringkasan Absensi Kelas {kelas}:</span>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full border border-emerald-200/50">
                          Hadir: {students.filter(s => s?.kelas_sekolah === kelas).filter(s => (attendanceMap[String(s?.id || s?.nama_lengkap || "")] || "Hadir") === "Hadir").length}
                        </span>
                        <span className="px-2.5 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 rounded-full border border-orange-200/50">
                          Sakit: {students.filter(s => s?.kelas_sekolah === kelas).filter(s => attendanceMap[String(s?.id || s?.nama_lengkap || "")] === "Sakit").length}
                        </span>
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-full border border-amber-200/50">
                          Izin: {students.filter(s => s?.kelas_sekolah === kelas).filter(s => attendanceMap[String(s?.id || s?.nama_lengkap || "")] === "Izin").length}
                        </span>
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-full border border-rose-200/50">
                          Alfa: {students.filter(s => s?.kelas_sekolah === kelas).filter(s => attendanceMap[String(s?.id || s?.nama_lengkap || "")] === "Alfa").length}
                        </span>
                      </div>
                    </div>

                    {/* Student List Grid */}
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-wider border-b border-slate-100 dark:border-slate-800">
                            <th className="py-3 px-4">Nama Siswa</th>
                            <th className="py-3 px-4 text-center w-1/3">Status Kehadiran</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {students
                            .filter(s => s?.kelas_sekolah === kelas)
                            .filter(s => !studentSearchQuery || String(s?.nama_lengkap || "").toLowerCase().includes(studentSearchQuery.toLowerCase()))
                            .map((student, idx) => {
                              const sId = String(student?.id || student?.nama_lengkap || "");
                              const currentStatus = attendanceMap[sId] || "Hadir";
                              return (
                                <tr key={`abs-st-${student?.id || idx}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-slate-600 dark:text-slate-300 uppercase shadow-inner">
                                        {String(student.nama_lengkap || "").substring(0, 2)}
                                      </div>
                                      <div>
                                        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{student.nama_lengkap || "-"}</p>
                                        <p className="text-[10px] text-slate-400 font-semibold">NIK: {student.id || "-"}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center justify-center gap-1.5">
                                      {[
                                        { key: "Hadir", label: "H", bg: "peer-checked:bg-emerald-600 peer-checked:text-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 bg-emerald-50/10 dark:text-emerald-400" },
                                        { key: "Sakit", label: "S", bg: "peer-checked:bg-orange-500 peer-checked:text-white text-orange-600 border-orange-200 hover:bg-orange-50 bg-orange-50/10 dark:text-orange-400" },
                                        { key: "Izin", label: "I", bg: "peer-checked:bg-amber-500 peer-checked:text-white text-amber-600 border-amber-200 hover:bg-amber-50 bg-amber-50/10 dark:text-amber-400" },
                                        { key: "Alfa", label: "A", bg: "peer-checked:bg-rose-600 peer-checked:text-white text-rose-600 border-rose-200 hover:bg-rose-50 bg-rose-50/10 dark:text-rose-400" }
                                      ].map(opt => (
                                        <label key={opt.key} className="cursor-pointer flex-1 max-w-[45px]">
                                          <input
                                            type="radio"
                                            name={`attendance-${sId}`}
                                            value={opt.key}
                                            checked={currentStatus === opt.key}
                                            onChange={() => {
                                              setAttendanceMap(prev => ({
                                                ...prev,
                                                [sId]: opt.key as any
                                              }));
                                            }}
                                            className="peer sr-only"
                                          />
                                          <div className={`py-1 rounded-lg text-[11px] font-black border text-center transition-all ${opt.bg} shadow-sm`}>
                                            {opt.label}
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          }
                          {students.filter(s => s.kelas_sekolah === kelas).length === 0 && (
                            <tr>
                              <td colSpan={2} className="text-center py-6 text-slate-400 text-xs">
                                Tidak ada siswa terplot di kelas {kelas}. Plot siswa terlebih dahulu di menu "Plotting Siswa".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: CATATAN KHUSUS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold text-sm">4</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Catatan Khusus KBM</h3>
                    <p className="text-[11px] text-slate-500">Evaluasi, kendala, dan rencana perbaikan untuk sesi mengajar ini.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Evaluasi Kegiatan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Evaluasi Kegiatan Belajar</label>
                    <textarea
                      value={evaluasi}
                      onChange={(e) => setEvaluasi(e.target.value)}
                      placeholder="e.g. Kegiatan berjalan baik, siswa aktif berdiskusi..."
                      rows={2}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                    />
                  </div>

                  {/* Kendala Mengajar */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Kendala Selama Mengajar</label>
                    <textarea
                      value={kendala}
                      onChange={(e) => setKendala(e.target.value)}
                      placeholder="e.g. Beberapa siswa kurang memahami konsep wudhu, proyektor mati..."
                      rows={2}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                    />
                  </div>

                  {/* Rencana Perbaikan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Rencana Perbaikan Pertemuan Selanjutnya</label>
                    <textarea
                      value={rencanaPerbaikan}
                      onChange={(e) => setRencanaPerbaikan(e.target.value)}
                      placeholder="e.g. Melakukan praktek wudhu langsung di masjid, pengulangan materi di awal..."
                      rows={2}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: PENGESAHAN DENGAN KAMERA LANGSUNG */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold text-sm">5</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Pengesahan Bukti Kamera</h3>
                    <p className="text-[11px] text-slate-500">Ambil foto dokumentasi KBM langsung lewat kamera Anda.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment" // Forces front/back camera on mobile devices instantly
                    ref={cameraInputRef}
                    onChange={handleCameraChange}
                    className="hidden"
                  />

                  {fotoPembelajaran ? (
                    <div className="space-y-3">
                      <div className="relative rounded-2xl overflow-hidden max-w-sm border-2 border-emerald-500 shadow-md">
                        <img
                          src={fotoPembelajaran}
                          alt="Bukti Pembelajaran"
                          className="w-full h-48 object-cover referrerPolicy='no-referrer'"
                        />
                        <div className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg border border-emerald-400/30">
                          ✓ Terverifikasi Kamera
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Ganti Foto
                        </button>
                        <button
                          type="button"
                          onClick={() => setFotoPembelajaran("")}
                          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-md">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isCompressing}
                        className="w-full flex flex-col items-center justify-center py-8 px-4 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl transition-all cursor-pointer group"
                      >
                        <Camera className="w-10 h-10 text-slate-400 group-hover:text-blue-500 transition-colors mb-2 animate-pulse" />
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                          {isCompressing ? "Sedang Mengompresi Foto..." : "Klik untuk Ambil Foto Kamera"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1 leading-relaxed text-center">
                          Sistem membatasi input wajib langsung dari Kamera (bukan galeri file) demi akurasi laporan kehadiran fisik mengajar harian.
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* BUTTON SUBMIT */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSavingJournal}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 cursor-pointer disabled:opacity-50"
                >
                  {isSavingJournal ? "Menyimpan..." : "Simpan & Sinkronkan Laporan Mengajar"}
                </button>
              </div>

            </form>
          )}

          {/* TAB MENGAJAR: SUB-VIEW JURNAL GURU */}
          {mengajarTab === "jurnal_guru" && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                      <FileText className="text-[#0c66e4] w-4.5 h-4.5" /> Jurnal Mengajar Pribadi Guru
                    </h3>
                    <p className="text-xs text-slate-500">Histori dan rekaman digital seluruh kegiatan belajar mengajar Anda.</p>
                  </div>
                  
                  {/* Select class filter for personal journals */}
                  <select
                    value={selectedJournalClass}
                    onChange={(e) => setSelectedJournalClass(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-200"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    {Array.from(new Set(journals.map(j => j.kelas).filter(Boolean))).map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Journal Grid Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {journals
                  .filter(j => j.guru_username === currentUser?.username)
                  .filter(j => selectedJournalClass === "Semua Kelas" || j.kelas === selectedJournalClass)
                  .map((journal) => (
                    <div key={journal.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow">
                      <div className="bg-slate-50 dark:bg-slate-950/60 p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-[#0c66e4] dark:text-blue-300 text-[10px] font-black rounded border border-blue-200/30">
                              Kelas {journal.kelas}
                            </span>
                            <span className="text-[10px] font-extrabold text-slate-500">
                              {journal.jam_pelajaran}
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1.5">
                            {journal.materi_pokok}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                            Mapel: {journal.mata_pelajaran || "Semua"} • {journal.hari}, {journal.tanggal}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] block text-slate-400 font-bold">Semester {journal.semester}</span>
                          <span className="text-[9px] block text-slate-400 font-bold">TA {journal.tahun_ajaran}</span>
                        </div>
                      </div>

                      <div className="p-4 space-y-3 flex-1">
                        <div>
                          <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Tujuan Pembelajaran:</span>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed mt-0.5">
                            {journal.tujuan_pembelajaran || "-"}
                          </p>
                        </div>

                        {/* Attendance Stats badge row */}
                        <div className="bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500">Ketergantungan Absensi:</span>
                          <span className="text-[11px] font-extrabold text-[#0c66e4]">{journal.attendance_summary}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {journal.evaluasi && (
                            <div className="p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/80">
                              <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Evaluasi</span>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-semibold leading-normal">{journal.evaluasi}</p>
                            </div>
                          )}
                          {journal.kendala && (
                            <div className="p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/80">
                              <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">Kendala</span>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-semibold leading-normal">{journal.kendala}</p>
                            </div>
                          )}
                        </div>

                        {journal.foto_pembelajaran && (
                          <div className="pt-2">
                            <span className="text-[9px] block uppercase font-black text-slate-400 tracking-wider mb-1">Foto Pengesahan (Kamera):</span>
                            <div className="w-full h-28 rounded-lg overflow-hidden border border-slate-200">
                              <img
                                src={journal.foto_pembelajaran}
                                alt="Foto Pembelajaran"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/60 p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            // Printing modal / window simulation specifically for this card
                            const printWindow = window.open("", "_blank");
                            if (printWindow) {
                              printWindow.document.write(`
                                <html>
                                  <head>
                                    <title>Cetak Jurnal Guru</title>
                                    <style>
                                      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
                                      .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                                      .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
                                      .section { margin-bottom: 25px; }
                                      .section-title { font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; color: #555; }
                                      .content { font-size: 13px; line-height: 1.6; }
                                      .attendance { font-weight: bold; color: #1e40af; }
                                      img { max-width: 300px; border: 1px solid #ddd; margin-top: 10px; }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="header">
                                      <h2>JURNAL MENGAJAR GURU SEKOLAH</h2>
                                      <p>AL MUTTAQIN ISLAMIC BOARDING SCHOOL</p>
                                    </div>
                                    <div class="meta-grid">
                                      <div>
                                        <p><strong>Guru Pengajar:</strong> ${journal.guru_nama}</p>
                                        <p><strong>Mata Pelajaran:</strong> ${journal.mata_pelajaran || "Semua"}</p>
                                        <p><strong>Hari, Tanggal:</strong> ${journal.hari}, ${journal.tanggal}</p>
                                      </div>
                                      <div>
                                        <p><strong>Kelas:</strong> ${journal.kelas}</p>
                                        <p><strong>Jam Pelajaran:</strong> ${journal.jam_pelajaran}</p>
                                        <p><strong>Semester / TA:</strong> ${journal.semester} / ${journal.tahun_ajaran}</p>
                                      </div>
                                    </div>
                                    <div class="section">
                                      <div class="section-title">Materi Pokok & Tujuan Pembelajaran</div>
                                      <div class="content">
                                        <p><strong>Materi Pokok:</strong> ${journal.materi_pokok}</p>
                                        <p><strong>Tujuan Pembelajaran:</strong> ${journal.tujuan_pembelajaran || "-"}</p>
                                      </div>
                                    </div>
                                    <div class="section">
                                      <div class="section-title">Keterangan Absensi Siswa</div>
                                      <div class="content attendance">${journal.attendance_summary}</div>
                                    </div>
                                    <div class="section">
                                      <div class="section-title">Catatan Kegiatan</div>
                                      <div class="content">
                                        <p><strong>Evaluasi:</strong> ${journal.evaluasi || "-"}</p>
                                        <p><strong>Kendala:</strong> ${journal.kendala || "-"}</p>
                                        <p><strong>Rencana Perbaikan:</strong> ${journal.rencana_perbaikan || "-"}</p>
                                      </div>
                                    </div>
                                    ${journal.foto_pembelajaran ? `
                                    <div class="section">
                                      <div class="section-title">Bukti Pembelajaran</div>
                                      <img src="${journal.foto_pembelajaran}" />
                                    </div>` : ""}
                                    <script>window.print();</script>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }
                          }}
                          className="px-3 py-1.5 text-[#0c66e4] hover:bg-blue-50 text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-blue-100"
                        >
                          <Printer className="w-3.5 h-3.5" /> Cetak Jurnal
                        </button>

                        <button
                          onClick={() => handleDeleteJournal(journal.id)}
                          className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-[11px] font-extrabold rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-rose-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      </div>
                    </div>
                  ))}

                {journals.filter(j => j.guru_username === currentUser?.username).length === 0 && (
                  <div className="lg:col-span-2 text-center py-12 bg-white dark:bg-slate-900 border border-slate-200/80 rounded-3xl">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="font-extrabold text-slate-700 text-sm">Belum Ada Jurnal Pribadi</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-normal">
                      Anda belum pernah menginput data laporan mengajar apa pun. Silakan gunakan tombol "Isi Jurnal Baru" untuk mengawali laporan.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB MENGAJAR: SUB-VIEW JURNAL KELAS */}
          {mengajarTab === "jurnal_kelas" && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                      <Users className="text-[#0c66e4] w-4.5 h-4.5" /> Jurnal Mengajar Guru (Format Lembar Kerja Resmi)
                    </h3>
                    <p className="text-xs text-slate-500">Rekapitulasi KBM persis format fisik / Excel Jurnal Mengajar Guru.</p>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {/* Class Selector Filter */}
                    <select
                      value={selectedJournalClass}
                      onChange={(e) => setSelectedJournalClass(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-200"
                    >
                      <option value="Semua Kelas">-- Pilih Kelas --</option>
                      {Array.from(new Set(journals.map(j => j.kelas).filter(Boolean))).map(cls => (
                        <option key={cls} value={cls}>Kelas {cls}</option>
                      ))}
                    </select>

                    {/* Semester Selector */}
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-200"
                    >
                      <option value="Ganjil">Semester Ganjil</option>
                      <option value="Genap">Semester Genap</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* EXCEL / PHYSICAL SHEET CONTAINER */}
              <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl overflow-hidden shadow-md">
                
                {/* SHEET HEADER TITLE */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
                  <div className="text-center pb-4 border-b border-dashed border-slate-300 dark:border-slate-700">
                    <h2 className="text-base font-black tracking-widest uppercase text-slate-900 dark:text-slate-100">JURNAL MENGAJAR GURU</h2>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">Al Muttaqin Islamic Boarding School</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 text-xs font-bold text-slate-700 dark:text-slate-300 max-w-xl">
                    <div className="flex">
                      <span className="w-32 text-slate-500">Kelas</span>
                      <span className="font-black">: {selectedJournalClass === "Semua Kelas" ? "(Semua Kelas)" : selectedJournalClass}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-slate-500">Semester</span>
                      <span className="font-black">: {semester}</span>
                    </div>
                    <div className="flex">
                      <span className="w-32 text-slate-500">Tahun Pelajaran</span>
                      <span className="font-black">: {tahunAjaran}</span>
                    </div>
                  </div>
                </div>

                {/* TABLE ACCORDING TO PHYSICAL EXCEL FORMAT */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300 dark:border-slate-700 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-black text-center border-b border-slate-300 dark:border-slate-700">
                        <th className="border border-slate-300 dark:border-slate-700 py-3 px-3 w-36">Hari, Tanggal</th>
                        <th className="border border-slate-300 dark:border-slate-700 py-3 px-3 w-24">Jam Ke</th>
                        <th className="border border-slate-300 dark:border-slate-700 py-3 px-3 w-32">Mata Pelajaran</th>
                        <th className="border border-slate-300 dark:border-slate-700 py-3 px-4">Materi Pembelajaran</th>
                        <th className="border border-slate-300 dark:border-slate-700 py-3 px-3 w-40">Keterangan</th>
                        <th className="border border-slate-300 dark:border-slate-700 py-2 px-2" colSpan={3}>
                          Kehadiran Peserta Didik
                        </th>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-black text-center text-[11px] border-b border-slate-300 dark:border-slate-700">
                        <th className="border border-slate-300 dark:border-slate-700 py-1.5 px-2"></th>
                        <th className="border border-slate-300 dark:border-slate-700 py-1.5 px-2"></th>
                        <th className="border border-slate-300 dark:border-slate-700 py-1.5 px-2"></th>
                        <th className="border border-slate-300 dark:border-slate-700 py-1.5 px-2"></th>
                        <th className="border border-slate-300 dark:border-slate-700 py-1.5 px-2"></th>
                        <th className="border border-slate-300 dark:border-slate-700 py-1.5 px-2 w-10 text-orange-600">S</th>
                        <th className="border border-slate-300 dark:border-slate-700 py-1.5 px-2 w-10 text-amber-600">I</th>
                        <th className="border border-slate-300 dark:border-slate-700 py-1.5 px-2 w-10 text-rose-600">A</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 dark:divide-slate-700 font-medium">
                      {journals
                        .filter(j => selectedJournalClass === "Semua Kelas" || j.kelas === selectedJournalClass)
                        .filter(j => selectedJournalTeacher === "Semua Guru" || j.guru_nama === selectedJournalTeacher)
                        .map((j, idx) => {
                          // Extract S, I, A from attendance_summary string e.g. "Hadir: 20, Sakit: 1, Izin: 2, Alfa: 0"
                          const sumStr = j.attendance_summary || "";
                          const sMatch = sumStr.match(/Sakit:\s*(\d+)/i);
                          const iMatch = sumStr.match(/Izin:\s*(\d+)/i);
                          const aMatch = sumStr.match(/Alfa:\s*(\d+)/i);
                          const sakitCount = sMatch ? sMatch[1] : "0";
                          const izinCount = iMatch ? iMatch[1] : "0";
                          const alpaCount = aMatch ? aMatch[1] : "0";

                          return (
                            <tr key={j.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="border border-slate-300 dark:border-slate-700 py-3 px-3 text-center text-xs">
                                <div className="font-bold">{j.hari || "-"}</div>
                                <div className="text-[10px] text-slate-500">{j.tanggal || "-"}</div>
                              </td>
                              <td className="border border-slate-300 dark:border-slate-700 py-3 px-3 text-center text-xs font-semibold">
                                {j.jam_pelajaran || "-"}
                              </td>
                              <td className="border border-slate-300 dark:border-slate-700 py-3 px-3 text-xs font-semibold">
                                {j.mata_pelajaran || "-"}
                                <div className="text-[9px] text-slate-400">Guru: {j.guru_nama}</div>
                              </td>
                              <td className="border border-slate-300 dark:border-slate-700 py-3 px-4 text-xs">
                                <div className="font-extrabold text-slate-800 dark:text-slate-200">{j.materi_pokok}</div>
                                {j.tujuan_pembelajaran && (
                                  <div className="text-[10px] text-slate-500 mt-0.5">Tujuan: {j.tujuan_pembelajaran}</div>
                                )}
                              </td>
                              <td className="border border-slate-300 dark:border-slate-700 py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                                {j.kendala ? `Kendala: ${j.kendala}` : (j.evaluasi ? `Eval: ${j.evaluasi}` : "-")}
                              </td>
                              <td className="border border-slate-300 dark:border-slate-700 py-3 px-2 text-center text-xs font-bold text-orange-600 bg-orange-50/20">
                                {sakitCount}
                              </td>
                              <td className="border border-slate-300 dark:border-slate-700 py-3 px-2 text-center text-xs font-bold text-amber-600 bg-amber-50/20">
                                {izinCount}
                              </td>
                              <td className="border border-slate-300 dark:border-slate-700 py-3 px-2 text-center text-xs font-bold text-rose-600 bg-rose-50/20">
                                {alpaCount}
                              </td>
                            </tr>
                          );
                        })}

                      {/* Empty filler rows to match physical sheet look if less than 5 rows */}
                      {journals.filter(j => selectedJournalClass === "Semua Kelas" || j.kelas === selectedJournalClass).length === 0 && (
                        Array.from({ length: 6 }).map((_, i) => (
                          <tr key={`empty-${i}`} className="h-10">
                            <td className="border border-slate-300 dark:border-slate-700 py-3 px-3 text-center text-slate-300">-</td>
                            <td className="border border-slate-300 dark:border-slate-700 py-3 px-3 text-center text-slate-300">-</td>
                            <td className="border border-slate-300 dark:border-slate-700 py-3 px-3 text-center text-slate-300">-</td>
                            <td className="border border-slate-300 dark:border-slate-700 py-3 px-4 text-center text-slate-300">Belum ada entri jurnal KBM untuk kelas ini.</td>
                            <td className="border border-slate-300 dark:border-slate-700 py-3 px-3 text-center text-slate-300">-</td>
                            <td className="border border-slate-300 dark:border-slate-700 py-3 px-2 text-center text-slate-300">-</td>
                            <td className="border border-slate-300 dark:border-slate-700 py-3 px-2 text-center text-slate-300">-</td>
                            <td className="border border-slate-300 dark:border-slate-700 py-3 px-2 text-center text-slate-300">-</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* FOOTER ACTIONS / EXPORT */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-300 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Menampilkan rekapitulasi sesuai lembar resmi Jurnal Mengajar Guru.
                  </p>
                  <button
                    onClick={() => {
                      const filtered = journals
                        .filter(j => selectedJournalClass === "Semua Kelas" || j.kelas === selectedJournalClass);

                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        let htmlContent = `
                          <html>
                            <head>
                              <title>Cetak Jurnal Mengajar Guru</title>
                              <style>
                                body { font-family: 'Times New Roman', Times, serif; padding: 30px; color: #000; }
                                .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                                .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
                                .header h4 { margin: 5px 0 0; font-size: 13px; font-weight: normal; }
                                .meta { margin-bottom: 20px; font-size: 13px; line-height: 1.6; }
                                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                                th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: middle; }
                                th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
                                .text-center { text-align: center; }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h2>JURNAL MENGAJAR GURU</h2>
                                <h4>AL MUTTAQIN ISLAMIC BOARDING SCHOOL</h4>
                              </div>
                              <div class="meta">
                                <div><strong>Kelas</strong> : ${selectedJournalClass === "Semua Kelas" ? "Semua Kelas" : selectedJournalClass}</div>
                                <div><strong>Semester</strong> : ${semester}</div>
                                <div><strong>Tahun Pelajaran</strong> : ${tahunAjaran}</div>
                              </div>
                              <table>
                                <thead>
                                  <tr>
                                    <th rowspan="2" style="width: 100px;">Hari, Tanggal</th>
                                    <th rowspan="2" style="width: 60px;">Jam Ke</th>
                                    <th rowspan="2" style="width: 110px;">Mata Pelajaran</th>
                                    <th rowspan="2">Materi Pembelajaran</th>
                                    <th rowspan="2" style="width: 120px;">Keterangan</th>
                                    <th colspan="3" class="text-center">Kehadiran Peserta Didik</th>
                                  </tr>
                                  <tr>
                                    <th class="text-center" style="width: 35px;">S</th>
                                    <th class="text-center" style="width: 35px;">I</th>
                                    <th class="text-center" style="width: 35px;">A</th>
                                  </tr>
                                </thead>
                                <tbody>
                        `;

                        filtered.forEach(j => {
                          const sumStr = j.attendance_summary || "";
                          const sMatch = sumStr.match(/Sakit:\s*(\d+)/i);
                          const iMatch = sumStr.match(/Izin:\s*(\d+)/i);
                          const aMatch = sumStr.match(/Alfa:\s*(\d+)/i);
                          const sakitCount = sMatch ? sMatch[1] : "0";
                          const izinCount = iMatch ? iMatch[1] : "0";
                          const alpaCount = aMatch ? aMatch[1] : "0";

                          htmlContent += `
                            <tr>
                              <td class="text-center">${j.hari || "-"},<br/>${j.tanggal || "-"}</td>
                              <td class="text-center">${j.jam_pelajaran || "-"}</td>
                              <td>${j.mata_pelajaran || "-"}<br/><small>(${j.guru_nama})</small></td>
                              <td><b>${j.materi_pokok}</b>${j.tujuan_pembelajaran ? '<br/><small>' + j.tujuan_pembelajaran + '</small>' : ''}</td>
                              <td>${j.kendala || j.evaluasi || "-"}</td>
                              <td class="text-center">${sakitCount}</td>
                              <td class="text-center">${izinCount}</td>
                              <td class="text-center">${alpaCount}</td>
                            </tr>
                          `;
                        });

                        // Add empty rows if less than 8 rows to match physical sheet aesthetic
                        if (filtered.length < 8) {
                          for (let i = 0; i < (8 - filtered.length); i++) {
                            htmlContent += `
                              <tr style="height: 32px;">
                                <td></td><td></td><td></td><td></td><td></td><td class="text-center"></td><td class="text-center"></td><td class="text-center"></td>
                              </tr>
                            `;
                          }
                        }

                        htmlContent += `
                                </tbody>
                              </table>
                              <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
                                <div style="text-align: center;">
                                  <p>Mengetahui,<br/>Kepala Madrasah / Sekolah</p>
                                  <br/><br/><br/>
                                  <p><b>( ......................................... )</b></p>
                                </div>
                                <div style="text-align: center;">
                                  <p>Guru Mata Pelajaran</p>
                                  <br/><br/><br/>
                                  <p><b>( ${currentUser?.name || "........................................."} )</b></p>
                                </div>
                              </div>
                              <script>window.print();</script>
                            </body>
                          </html>
                        `;
                        printWindow.document.write(htmlContent);
                        printWindow.document.close();
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" /> Eksport PDF / Cetak Lembar Kerja Resmi
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB Content: DAFTAR SEMUA GURU (Admin/Pengurus Only) */}
      {activeSubTab === "semua_guru" && (currentUser?.role === 'admin' || currentUser?.role === 'super admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'pengurus') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                <Sparkles className="text-amber-500" /> Direktori Profil Guru Sekolah
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Berikut adalah daftar lengkap data profil mandiri guru yang sudah terdaftar.</p>
            </div>
            
            <button
              onClick={() => {
                fetchAllProfiles();
                fetchHistoryData();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Cari berdasarkan nama lengkap, nomor HP, atau kategori guru..."
            />
          </div>

          {/* Grid of Profiles */}
          {filteredProfiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredProfiles.map((guru, idx) => (
                <div key={`absensi-guru-${guru.id || guru.username || idx}-${idx}`} className="border border-slate-200/80 rounded-2xl p-5 hover:shadow-md transition-all space-y-4 bg-white">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    {guru.foto_diri ? (
                      <img 
                        src={guru.foto_diri} 
                        alt={String(guru.nama_lengkap || "")} 
                        className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold text-xl shadow-inner border border-blue-100 shrink-0">
                        {guru.nama_lengkap ? String(guru.nama_lengkap).charAt(0).toUpperCase() : "G"}
                      </div>
                    )}

                    {/* Basic Info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                          <GraduationCap className="w-2.5 h-2.5" /> {guru.kategori_guru || "Guru SMP"}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          guru.jenis_kelamin === "P" ? "bg-pink-50 text-pink-700 border border-pink-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                        }`}>
                          {guru.jenis_kelamin === "P" ? "Perempuan" : "Laki-laki"}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-slate-800 text-base leading-tight truncate">{guru.nama_lengkap || "-"}</h4>
                      
                      {guru.username && (
                        <p className="text-xs text-slate-400 font-semibold tracking-wide">
                          Akun: <span className="font-mono text-slate-600">{guru.username}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Detailed profile grid matching database schema */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-100 text-slate-600 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">No. WhatsApp</p>
                      {guru.nomor_hp ? (
                        <a 
                          href={`https://wa.me/${String(guru.nomor_hp || "").replace(/[^0-9]/g, "")}`}
                          target="_blank" 
                          rel="noreferrer"
                          className="font-bold text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="w-3 h-3 text-emerald-500 shrink-0" /> {guru.nomor_hp}
                        </a>
                      ) : (
                        <p className="text-slate-400 font-semibold mt-0.5">-</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kategori Guru</p>
                      <p className="font-bold text-slate-700 mt-0.5">{guru.kategori_guru || "Guru SMP"}</p>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>ID: {guru.id ? String(guru.id).substring(0, 18) + '...' : "Tersimpan Lokal"}</span>
                      {guru.pengguna_id && <span>User ID: {String(guru.pengguna_id).substring(0, 8)}...</span>}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <User className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">Tidak ditemukan profil guru yang cocok.</p>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata pencarian Anda.</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL: UBAH PROFIL GURU (SESUAI SKEMA TABEL DATABASE GURU) */}
      {isEditingProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Modal Header: Clean White with Slate Title and Smooth Close Button */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white rounded-t-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Ubah Profil Guru
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Menyesuaikan skema tabel database guru
                </p>
              </div>
              <button
                onClick={() => setIsEditingProfileModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
                title="Tutup Modal"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5 text-left">
              
              {/* Photo uploader (Optional helper) */}
              <div className="flex items-center gap-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
                <div className="relative w-16 h-16 shrink-0">
                  {isUploadingPhoto ? (
                    <div className="w-full h-full rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500">
                      <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                    </div>
                  ) : profile.foto_diri ? (
                    <img 
                      src={profile.foto_diri} 
                      alt="Preview Foto" 
                      className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-blue-50 border-2 border-dashed border-blue-200 flex items-center justify-center text-blue-500">
                      <User className="w-7 h-7 text-blue-400" />
                    </div>
                  )}
                  {profile.foto_diri && !isUploadingPhoto && (
                    <button
                      type="button"
                      onClick={() => setProfile(prev => ({ ...prev, foto_diri: "" }))}
                      className="absolute -top-1 -right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 shadow"
                      title="Hapus Foto"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-700 block">Foto Diri (Opsional)</span>
                  <p className="text-[11px] text-slate-400">Unggah pas foto formal pendidik maksimal 2MB</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handlePhotoChange}
                      ref={fileInputRef}
                      className="hidden"
                      id="modal-guru-foto-input"
                      disabled={isUploadingPhoto}
                    />
                    <label 
                      htmlFor="modal-guru-foto-input"
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                        isUploadingPhoto 
                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-xs"
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" /> {isUploadingPhoto ? "Mengunggah..." : "Pilih Foto"}
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Grid 2-cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 1. Nama Lengkap (Required) */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="text"
                      required
                      value={profile.nama_lengkap}
                      onChange={e => setProfile(prev => ({ ...prev, nama_lengkap: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="Contoh: Ustadz Ahmad Fauzi, S.Pd."
                    />
                  </div>
                </div>

                {/* 2. Jenis Kelamin (Segmented Button / Radio Toggle Card) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Jenis Kelamin <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                      profile.jenis_kelamin === "L" 
                        ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                      <input 
                        type="radio" 
                        name="modal_guru_jk" 
                        checked={profile.jenis_kelamin === "L"} 
                        onChange={() => setProfile(prev => ({ ...prev, jenis_kelamin: "L" }))}
                        className="hidden" 
                      />
                      Laki-laki
                    </label>
                    <label className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                      profile.jenis_kelamin === "P" 
                        ? "bg-pink-50 border-pink-500 text-pink-700 shadow-xs" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                      <input 
                        type="radio" 
                        name="modal_guru_jk" 
                        checked={profile.jenis_kelamin === "P"} 
                        onChange={() => setProfile(prev => ({ ...prev, jenis_kelamin: "P" }))}
                        className="hidden" 
                      />
                      Perempuan
                    </label>
                  </div>
                </div>

                {/* 3. Nomor HP / WhatsApp */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Nomor HP / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="text"
                      value={profile.nomor_hp || ""}
                      onChange={e => setProfile(prev => ({ ...prev, nomor_hp: e.target.value.replace(/[^0-9+]/g, "") }))}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      placeholder="Contoh: 081234567890"
                    />
                  </div>
                </div>

                {/* 4. Kategori Guru (Select Option) */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Kategori Guru <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      value={["Guru SMP", "Guru Pondok", "Guru Madrasah", "Pengajar Tahfidh", "Pengajar Kitab Kuning", "Guru Ekstrakurikuler"].includes(profile.kategori_guru) ? profile.kategori_guru : "Lainnya"}
                      onChange={(e) => {
                        if (e.target.value !== "Lainnya") {
                          setProfile(prev => ({ ...prev, kategori_guru: e.target.value }));
                        } else {
                          setProfile(prev => ({ ...prev, kategori_guru: "" }));
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="Guru SMP">Guru SMP</option>
                      <option value="Guru Pondok">Guru Pondok</option>
                      <option value="Guru Madrasah">Guru Madrasah</option>
                      <option value="Pengajar Tahfidh">Pengajar Tahfidh</option>
                      <option value="Pengajar Kitab Kuning">Pengajar Kitab Kuning</option>
                      <option value="Guru Ekstrakurikuler">Guru Ekstrakurikuler</option>
                      <option value="Lainnya">Lainnya (Ketik Manual)</option>
                    </select>
                  </div>
                  {!["Guru SMP", "Guru Pondok", "Guru Madrasah", "Pengajar Tahfidh", "Pengajar Kitab Kuning", "Guru Ekstrakurikuler"].includes(profile.kategori_guru) && (
                    <input
                      type="text"
                      value={profile.kategori_guru}
                      onChange={e => setProfile(prev => ({ ...prev, kategori_guru: e.target.value }))}
                      className="w-full mt-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="Masukkan nama kategori guru kustom..."
                      autoFocus
                    />
                  )}
                </div>

                {/* 5. Database Info Box (UUID info) */}
                <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-600">
                    <Database className="w-3.5 h-3.5 text-blue-600" />
                    <span>Integrasi Tabel Database 'guru'</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 font-mono">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">id (UUID Guru)</span>
                      <span className="text-slate-700 font-semibold">{profile.id || "(Otomatis dibuat saat disimpan)"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">pengguna_id (UUID Akun)</span>
                      <span className="text-slate-700 font-semibold">{profile.pengguna_id || currentUser?.username || "-"}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Form Footer Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingProfileModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 bg-[#0c66e4] hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isSavingProfile ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Simpan Profil Guru
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
