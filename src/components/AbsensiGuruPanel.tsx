import React, { useState, useEffect, useRef } from "react";
import { 
  MapPin, CheckCircle, XCircle, AlertTriangle, Crosshair, Save, Settings,
  User, Phone, Calendar, Camera, IdCard, Search, Edit, Plus, Clock, RefreshCw, Eye, Sparkles,
  BookOpen, ClipboardList, Trash2, Printer, Check, FileText, Users, ChevronRight, Upload, Info
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
}

interface GuruSekolahProfile {
  id?: number;
  username: string;
  nama_lengkap: string;
  nik: string;
  jenis_kelamin: "L" | "P";
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat_pribadi: string;
  nomor_seluler: string;
  foto_diri: string;
  mata_pelajaran?: string;
  created_at?: string;
}

export default function AbsensiGuruPanel({ currentUser }: AbsensiGuruPanelProps) {
  // Navigation sub-tab
  const [activeSubTab, setActiveSubTab] = useState<"absensi" | "mengajar" | "semua_guru">("absensi");

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

  // Profile State
  const [profile, setProfile] = useState<GuruSekolahProfile>({
    username: currentUser?.username || "",
    nama_lengkap: currentUser?.name || "",
    nik: "",
    jenis_kelamin: "L",
    tempat_lahir: "",
    tanggal_lahir: "",
    alamat_pribadi: "",
    nomor_seluler: "",
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
        .from("santri")
        .select("*")
        .order("nama_lengkap", { ascending: true });
      
      if (data && !error) {
        const savedMetadataMap = JSON.parse(localStorage.getItem("santri_custom_metadata_map") || "{}");
        const mappedStudents = data.map((s: any) => {
          const key = (s.nama_lengkap || "").trim().toLowerCase();
          const localPlot = savedMetadataMap[s.nik] || {};
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

    // 5. Fetch current user's profile and all profiles (if admin/pengurus)
    fetchMyProfile();
    if (currentUser?.role === 'admin' || currentUser?.role === 'pengurus') {
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
      const { data, error } = await supabase
        .from("guru_sekolah")
        .select("*")
        .eq("username", currentUser.username)
        .maybeSingle();

      if (error) {
        if (error.code === "PGRST116" || error.message?.includes("relation \"guru_sekolah\" does not exist")) {
          setProfileDbError(true);
        } else {
          console.warn("Error fetching profile:", error.message);
        }
      } else if (data) {
        const localProfileKey = `guru_profile_${currentUser.username}`;
        const cached = localStorage.getItem(localProfileKey);
        let localMapel = "";
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            localMapel = parsed.mata_pelajaran || "";
          } catch {}
        }
        const mergedData = {
          ...data,
          mata_pelajaran: data.mata_pelajaran || localMapel || ""
        };
        setProfile(mergedData);
        setProfileDbError(false);
        localStorage.setItem(localProfileKey, JSON.stringify(mergedData));
      }
    } catch (err: any) {
      console.warn("Network error fetching profile:", err);
      setProfileDbError(true);
    }
  };

  const fetchAllProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("guru_sekolah")
        .select("*")
        .order("nama_lengkap", { ascending: true });

      if (error) {
        if (error.message?.includes("relation \"guru_sekolah\" does not exist")) {
          setProfileDbError(true);
        }
      } else if (data) {
        setAllProfiles(data);
        localStorage.setItem("guru_sekolah_all_profiles", JSON.stringify(data));
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

  // Profile Save Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    const localProfileKey = `guru_profile_${currentUser?.username || "unknown"}`;

    if (!profile.nama_lengkap) {
      MySwal.fire({
        icon: 'error',
        title: 'Validasi Gagal',
        text: 'Nama Lengkap wajib diisi.'
      });
      setIsSavingProfile(false);
      return;
    }

    if (!profile.nik || profile.nik.length !== 16 || !/^\d+$/.test(profile.nik)) {
      MySwal.fire({
        icon: 'warning',
        title: 'Validasi NIK',
        text: 'NIK harus tepat 16 digit angka.',
      });
      setIsSavingProfile(false);
      return;
    }

    // Save locally
    localStorage.setItem(localProfileKey, JSON.stringify(profile));

    // Update all list local
    const savedAllProfiles = localStorage.getItem("guru_sekolah_all_profiles");
    let listProfiles: GuruSekolahProfile[] = [];
    if (savedAllProfiles) {
      try {
        listProfiles = JSON.parse(savedAllProfiles);
      } catch {}
    }
    const index = listProfiles.findIndex(p => p.username === profile.username);
    if (index >= 0) {
      listProfiles[index] = profile;
    } else {
      listProfiles.push(profile);
    }
    localStorage.setItem("guru_sekolah_all_profiles", JSON.stringify(listProfiles));
    setAllProfiles(listProfiles);

    try {
      const payload: any = {
        username: profile.username,
        nama_lengkap: profile.nama_lengkap,
        nik: profile.nik,
        jenis_kelamin: profile.jenis_kelamin,
        tempat_lahir: profile.tempat_lahir,
        tanggal_lahir: profile.tanggal_lahir,
        alamat_pribadi: profile.alamat_pribadi,
        nomor_seluler: profile.nomor_seluler,
        foto_diri: profile.foto_diri,
        mata_pelajaran: profile.mata_pelajaran || ""
      };

      let { error } = await supabase
        .from("guru_sekolah")
        .upsert([payload], { onConflict: "username" });

      if (error && (error.message?.includes("column") || error.message?.includes("mata_pelajaran"))) {
        console.warn("Retrying profile upsert without mata_pelajaran column...");
        const fallbackPayload = { ...payload };
        delete fallbackPayload.mata_pelajaran;
        const retryResult = await supabase
          .from("guru_sekolah")
          .upsert([fallbackPayload], { onConflict: "username" });
        error = retryResult.error;
      }

      if (error) {
        console.warn("Failed to sync profile to Supabase:", error.message);
        if (error.message?.includes("relation \"guru_sekolah\" does not exist")) {
          setProfileDbError(true);
          MySwal.fire({
            icon: 'success',
            title: 'Tersimpan Lokal (Simulasi)',
            text: 'Tabel guru_sekolah belum ada di Supabase. Profil berhasil disimpan sementara di browser Anda.',
            confirmButtonColor: '#0c66e4'
          });
          setIsEditing(false);
          setIsEditingProfileModal(false);
        } else {
          MySwal.fire({
            icon: 'error',
            title: 'Gagal Sinkronisasi Cloud',
            text: 'Data disimpan lokal namun gagal disimpan ke Supabase: ' + error.message,
            confirmButtonColor: '#ef4444'
          });
        }
      } else {
        setProfileDbError(false);
        MySwal.fire({
          icon: 'success',
          title: 'Profil Berhasil Diperbarui',
          text: 'Data profil Anda telah disimpan ke server database.',
          timer: 1500,
          showConfirmButton: false
        });
        setIsEditing(false);
        setIsEditingProfileModal(false);
        fetchMyProfile();
        if (currentUser?.role === 'admin' || currentUser?.role === 'pengurus') {
          fetchAllProfiles();
        }
      }
    } catch (err: any) {
      console.warn("Supabase upsert profile error:", err);
      MySwal.fire({
        icon: 'success',
        title: 'Tersimpan Lokal',
        text: 'Koneksi bermasalah. Profil berhasil disimpan lokal pada browser ini.',
        confirmButtonColor: '#0c66e4'
      });
      setIsEditing(false);
      setIsEditingProfileModal(false);
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
    String(p.nik || "").includes(searchQuery) ||
    String(p.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full py-6 px-4 animate-fade-in space-y-6">
      
      {/* HEADER: PROFIL MANDIRI GURU (FULL WIDTH BANNER) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
        {/* Decorative subtle background gradient/pattern or spark */}
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
                
                {profile.nama_lengkap && profile.nik ? (
                  <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 uppercase tracking-wider px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5" /> Profil Lengkap
                  </span>
                ) : (
                  <span className="text-[10px] font-black bg-amber-50 text-amber-600 uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-100 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Profil Belum Lengkap
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight">
                {profile.nama_lengkap || currentUser?.name || "Guru Sekolah"}
              </h2>

              <p className="text-sm font-semibold text-slate-500 mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-y-1 gap-x-3">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Mapel:</span> 
                  <span className="font-bold text-[#0c66e4]">{profile.mata_pelajaran || "Semua Mata Pelajaran"}</span>
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Username/ID:</span> 
                  <span className="font-mono font-bold text-slate-700">{profile.username || currentUser?.username}</span>
                </span>
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
                <Edit className="w-3.5 h-3.5" /> Lengkapi &amp; Ubah Profil
              </button>

              {currentUser?.role === 'admin' && (
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors cursor-pointer border border-slate-200"
                >
                  <Settings className="w-3.5 h-3.5" /> Atur Lokasi Sekolah
                </button>
              )}
            </div>
            
            <p className="text-[11px] text-slate-400 font-medium">
              Absensi Titik GPS &amp; Manajemen Data Diri Guru Terintegrasi
            </p>
          </div>
        </div>

        {/* Full Details grid: NIK, WA, Kelamin, dll - "Isinya penuh bukan hanya kartu kecil" */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#0c66e4] shrink-0">
              <IdCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">NIK KTP</span>
              <span className="text-xs font-bold text-slate-700 block truncate font-mono">
                {profile.nik || "Belum diisi"}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">No. WhatsApp</span>
              <span className="text-xs font-bold text-slate-700 block truncate font-mono">
                {profile.nomor_seluler || "Belum diisi"}
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

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tempat/Tgl Lahir</span>
              <span className="text-xs font-bold text-slate-700 block truncate">
                {profile.tempat_lahir || profile.tanggal_lahir 
                  ? `${profile.tempat_lahir || "-"}, ${profile.tanggal_lahir || "-"}` 
                  : "Belum diisi"}
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* CONFIGURATION PANEL (ADMIN ONLY) */}
      {showConfig && currentUser?.role === 'admin' && (
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

      {/* SUB-TAB NAVIGATION */}
      <div className="flex flex-col sm:flex-row items-center justify-center p-1.5 bg-slate-100/90 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm max-w-4xl mx-auto gap-1.5 backdrop-blur-sm mb-6">
        <button
          onClick={() => setActiveSubTab("absensi")}
          className={`w-full sm:flex-1 py-3 px-5 text-center text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 rounded-xl transition-all duration-300 cursor-pointer ${
            activeSubTab === "absensi"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/40"
          }`}
        >
          <Clock className={`w-4.5 h-4.5 transition-transform duration-300 ${activeSubTab === "absensi" ? "scale-110" : ""}`} /> 
          <span>Presensi Kehadiran</span>
        </button>
        <button
          onClick={() => setActiveSubTab("mengajar")}
          className={`w-full sm:flex-1 py-3 px-5 text-center text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 rounded-xl transition-all duration-300 cursor-pointer ${
            activeSubTab === "mengajar"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/40"
          }`}
        >
          <BookOpen className={`w-4.5 h-4.5 transition-transform duration-300 ${activeSubTab === "mengajar" ? "scale-110" : ""}`} /> 
          <span>Tab Mengajar</span>
        </button>
        {(currentUser?.role === 'admin' || currentUser?.role === 'pengurus') && (
          <button
            onClick={() => setActiveSubTab("semua_guru")}
            className={`w-full sm:flex-1 py-3 px-5 text-center text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 rounded-xl transition-all duration-300 cursor-pointer ${
              activeSubTab === "semua_guru"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 scale-[1.01]"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/40"
            }`}
          >
            <Search className={`w-4.5 h-4.5 transition-transform duration-300 ${activeSubTab === "semua_guru" ? "scale-110" : ""}`} /> 
            <span>Daftar Guru Sekolah</span>
          </button>
        )}
      </div>

      {/* SQL SCHEMA WARNING HELPER BOX (If database table doesn't exist yet) */}
      {profileDbError && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex gap-3">
            <AlertTriangle className="text-amber-600 flex-shrink-0 w-6 h-6 mt-0.5 animate-bounce" />
            <div>
              <h4 className="font-black text-amber-900 text-sm">💡 Tabel 'guru_sekolah' Belum Dibuat di Supabase</h4>
              <p className="text-xs text-amber-800 leading-relaxed mt-1">
                Sistem saat ini menggunakan <strong>Mode Simulasi Offline (Local Browser)</strong>. Untuk mengaktifkan sinkronisasi database cloud Supabase, administrator hanya perlu menyalin query SQL berikut lalu menjalankannya di SQL Editor pada dashboard Supabase Anda.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`-- KODE SQL UNTUK TABEL GURU_SEKOLAH
CREATE TABLE IF NOT EXISTS guru_sekolah (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    username TEXT NOT NULL UNIQUE,
    nama_lengkap TEXT NOT NULL,
    nik TEXT NOT NULL,
    jenis_kelamin TEXT NOT NULL,
    tempat_lahir TEXT NOT NULL,
    tanggal_lahir TEXT NOT NULL,
    alamat_pribadi TEXT NOT NULL,
    nomor_seluler TEXT NOT NULL,
    foto_diri TEXT NOT NULL
);

-- Mengaktifkan Row Level Security (RLS) agar dapat diakses dari frontend web
ALTER TABLE guru_sekolah ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Guru Sekolah Seluruh Operasi" ON guru_sekolah;
CREATE POLICY "Akses Publik Guru Sekolah Seluruh Operasi" ON guru_sekolah 
    AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);`);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              {copiedSql ? "✓ SQL Berhasil Disalin!" : "Salin Query SQL Pembuat Tabel"}
            </button>
            <button
              onClick={() => setShowSqlGuide(!showSqlGuide)}
              className="bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              {showSqlGuide ? "Sembunyikan Panduan 🙈" : "Lihat Petunjuk 📖"}
            </button>
          </div>
          {showSqlGuide && (
            <div className="bg-slate-900 text-slate-200 rounded-xl p-4 text-xs font-mono space-y-2 mt-2 leading-relaxed">
              <p className="font-bold text-amber-400">Petunjuk Pemasangan Tabel Supabase:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>Buka dashboard Supabase proyek Anda.</li>
                <li>Klik ikon <strong className="text-white">"SQL Editor"</strong> di panel sebelah kiri.</li>
                <li>Klik tombol <strong className="text-white">"New Query"</strong>, tempel (paste) kode SQL yang disalin, dan klik tombol <strong className="text-white">"Run"</strong>.</li>
              </ol>
            </div>
          )}
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
                      {currentUser?.role === 'admin' ? 'Administrator' : 'Guru Sekolah'}
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
                      <span className="text-xs font-bold text-slate-800 font-mono tracking-wide">{profile.nik || "-"}</span>
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
                              href={`https://wa.me/${profile.nomor_seluler.replace(/[^0-9]/g, "")}`} 
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
                          value={profile.nik}
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
            <h3 className="font-bold text-slate-800 mb-4">{currentUser?.role === 'admin' ? "Semua Riwayat Absensi" : "Riwayat Absensi Anda"}</h3>
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

          {/* PETUNJUK & PERSIAPAN DATABASE HELPER ACCORDION */}
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Info className="text-blue-600 dark:text-blue-400 w-5 h-5 flex-shrink-0" />
                <div>
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">💡 Panduan Persiapan Database & Sinkronisasi Cloud</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Petunjuk penting untuk administrator dalam menyiapkan tabel Supabase agar fitur tab mengajar sinkron otomatis.</p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlGuide(!showSqlGuide)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0c66e4] text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                {showSqlGuide ? "Sembunyikan SQL" : "Tampilkan SQL"}
              </button>
            </div>

            {showSqlGuide && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Jika Anda menggunakan database Cloud Supabase, jalankan script SQL di bawah ini pada menu <strong>SQL Editor</strong> di dashboard Supabase Anda. Apabila tabel belum dibuat, sistem secara cerdas akan menyimpan seluruh laporan mengajar dan absensi secara offline di memori browser guru.
                </p>
                <div className="relative">
                  <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-[10px] md:text-xs font-mono overflow-x-auto max-h-60 leading-relaxed shadow-inner">
{`-- SQL UNTUK FITUR TAB MENGAJAR & ABSENSI SEKOLAH
CREATE TABLE IF NOT EXISTS jurnal_mengajar (
  id BIGSERIAL PRIMARY KEY,
  hari TEXT NOT NULL,
  tanggal DATE NOT NULL,
  kelas TEXT NOT NULL,
  semester TEXT NOT NULL,
  tahun_ajaran TEXT NOT NULL,
  jam_pelajaran TEXT NOT NULL,
  mata_pelajaran TEXT,
  materi_pokok TEXT NOT NULL,
  tujuan_pembelajaran TEXT,
  evaluasi TEXT,
  kendala TEXT,
  rencana_perbaikan TEXT,
  foto_pembelajaran TEXT, -- Menyimpan Base64 Image terkompresi
  guru_nama TEXT NOT NULL,
  guru_username TEXT NOT NULL,
  attendance_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS absensi_sekolah (
  id BIGSERIAL PRIMARY KEY,
  jurnal_id BIGINT REFERENCES jurnal_mengajar(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  kelas TEXT NOT NULL,
  santri_id BIGINT NOT NULL,
  nama_santri TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alfa')),
  guru_username TEXT NOT NULL,
  mata_pelajaran TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AKTIFKAN ROW LEVEL SECURITY (RLS) UNTUK KEAMANAN
ALTER TABLE jurnal_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE absensi_sekolah ENABLE ROW LEVEL SECURITY;

-- BUAT POLICY AKSES PUBLIK OPERASI LENGKAP (SESUAI DENGAN DESAIN SIMPLE APP)
CREATE POLICY "Akses Publik Jurnal Seluruh Operasi" ON jurnal_mengajar FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Akses Publik Absensi Sekolah Seluruh Operasi" ON absensi_sekolah FOR ALL TO public USING (true) WITH CHECK (true);`}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS jurnal_mengajar (
  id BIGSERIAL PRIMARY KEY,
  hari TEXT NOT NULL,
  tanggal DATE NOT NULL,
  kelas TEXT NOT NULL,
  semester TEXT NOT NULL,
  tahun_ajaran TEXT NOT NULL,
  jam_pelajaran TEXT NOT NULL,
  mata_pelajaran TEXT,
  materi_pokok TEXT NOT NULL,
  tujuan_pembelajaran TEXT,
  evaluasi TEXT,
  kendala TEXT,
  rencana_perbaikan TEXT,
  foto_pembelajaran TEXT,
  guru_nama TEXT NOT NULL,
  guru_username TEXT NOT NULL,
  attendance_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS absensi_sekolah (
  id BIGSERIAL PRIMARY KEY,
  jurnal_id BIGINT REFERENCES jurnal_mengajar(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  kelas TEXT NOT NULL,
  santri_id BIGINT NOT NULL,
  nama_santri TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alfa')),
  guru_username TEXT NOT NULL,
  mata_pelajaran TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE jurnal_mengajar ENABLE ROW LEVEL SECURITY;
ALTER TABLE absensi_sekolah ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Akses Publik Jurnal Seluruh Operasi" ON jurnal_mengajar FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Akses Publik Absensi Sekolah Seluruh Operasi" ON absensi_sekolah FOR ALL TO public USING (true) WITH CHECK (true);`);
                      MySwal.fire({
                        icon: "success",
                        title: "Query SQL Berhasil Disalin!",
                        text: "Silakan paste query ini di SQL Editor dashboard Supabase Anda.",
                        timer: 2000,
                        showConfirmButton: false
                      });
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer border border-slate-700"
                  >
                    Salin Script SQL
                  </button>
                </div>
              </div>
            )}
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
                                <tr key={student.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs text-slate-600 dark:text-slate-300 uppercase shadow-inner">
                                        {String(student.nama_lengkap || "").substring(0, 2)}
                                      </div>
                                      <div>
                                        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{student.nama_lengkap || "-"}</p>
                                        <p className="text-[10px] text-slate-400 font-semibold">NIK: {student.nik || "-"}</p>
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
                      <Users className="text-[#0c66e4] w-4.5 h-4.5" /> Jurnal Mengajar Kelas & Guru Sekolah
                    </h3>
                    <p className="text-xs text-slate-500">Kumpulan digital jurnal kelas terintegrasi lintas seluruh guru pengajar.</p>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {/* Class Selector Filter */}
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

                    {/* Teacher Selector Filter */}
                    <select
                      value={selectedJournalTeacher}
                      onChange={(e) => setSelectedJournalTeacher(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-200"
                    >
                      <option value="Semua Guru">Semua Guru</option>
                      {Array.from(new Set(journals.map(j => j.guru_nama).filter(Boolean))).map(teach => (
                        <option key={teach} value={teach}>{teach}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Jurnal Kelas Table / Document List */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">Arsip Pembelajaran Jurnal Kelas</span>
                  <button
                    onClick={() => {
                      // print all filtered journals
                      const filtered = journals
                        .filter(j => selectedJournalClass === "Semua Kelas" || j.kelas === selectedJournalClass)
                        .filter(j => selectedJournalTeacher === "Semua Guru" || j.guru_nama === selectedJournalTeacher);

                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        let htmlContent = `
                          <html>
                            <head>
                              <title>Cetak Rekap Jurnal Kelas</title>
                              <style>
                                body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #333; }
                                .title { text-align: center; border-bottom: 3px double #333; padding-bottom: 10px; margin-bottom: 25px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
                                th, td { border: 1px solid #aaa; padding: 8px; text-align: left; }
                                th { background-color: #f2f2f2; font-weight: bold; }
                                .badge { font-weight: bold; color: #1e3a8a; }
                              </style>
                            </head>
                            <body>
                              <div class="title">
                                <h2>REKAPITULASI JURNAL KELAS & GURU SEKOLAH</h2>
                                <h4>Al Muttaqin Islamic Boarding School</h4>
                                <p>Filter: Kelas [${selectedJournalClass}] | Guru [${selectedJournalTeacher}]</p>
                              </div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Tanggal/Hari</th>
                                    <th>Kelas</th>
                                    <th>Guru / Mapel</th>
                                    <th>Materi Pokok</th>
                                    <th>Tujuan Pembelajaran</th>
                                    <th>Kehadiran Siswa</th>
                                    <th>Catatan / Evaluasi</th>
                                  </tr>
                                </thead>
                                <tbody>
                        `;
                        
                        filtered.forEach(j => {
                          htmlContent += `
                            <tr>
                              <td>${j.tanggal}<br/>(${j.hari})</td>
                              <td><b>Kelas ${j.kelas}</b><br/>${j.jam_pelajaran}</td>
                              <td><b>${j.guru_nama}</b><br/>Mapel: ${j.mata_pelajaran || "-"}</td>
                              <td>${j.materi_pokok}</td>
                              <td>${j.tujuan_pembelajaran || "-"}</td>
                              <td class="badge">${j.attendance_summary || "-"}</td>
                              <td><b>Eval:</b> ${j.evaluasi || "-"}<br/><b>Kendala:</b> ${j.kendala || "-"}</td>
                            </tr>
                          `;
                        });

                        htmlContent += `
                                </tbody>
                              </table>
                              <script>window.print();</script>
                            </body>
                          </html>
                        `;
                        printWindow.document.write(htmlContent);
                        printWindow.document.close();
                      }
                    }}
                    className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0c66e4] text-[11px] font-black rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-blue-100/50"
                  >
                    <Printer className="w-3.5 h-3.5" /> Cetak Rekap Kelas ({
                      journals
                        .filter(j => selectedJournalClass === "Semua Kelas" || j.kelas === selectedJournalClass)
                        .filter(j => selectedJournalTeacher === "Semua Guru" || j.guru_nama === selectedJournalTeacher)
                        .length
                    })
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 text-[10px] uppercase font-black border-b border-slate-100 dark:border-slate-800">
                        <th className="py-3.5 px-4 w-1/6">Hari / Tanggal</th>
                        <th className="py-3.5 px-4 w-[12%]">Kelas / Jam</th>
                        <th className="py-3.5 px-4 w-[20%]">Guru / Mapel</th>
                        <th className="py-3.5 px-4">Materi Pokok & Tujuan</th>
                        <th className="py-3.5 px-4 text-center w-[18%]">Keterangan Absensi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {journals
                        .filter(j => selectedJournalClass === "Semua Kelas" || j.kelas === selectedJournalClass)
                        .filter(j => selectedJournalTeacher === "Semua Guru" || j.guru_nama === selectedJournalTeacher)
                        .map((j) => (
                          <tr key={j.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">{j.tanggal}</span>
                              <span className="text-[10px] font-bold text-slate-400 block">{j.hari}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-slate-300 text-[10px] font-extrabold rounded-lg border border-indigo-100/30">
                                Kelas {j.kelas}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold block mt-1.5">{j.jam_pelajaran}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">{j.guru_nama}</span>
                              <span className="text-[10px] font-bold text-slate-400 block">Mapel: {j.mata_pelajaran || "-"}</span>
                            </td>
                            <td className="py-3.5 px-4 space-y-1">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100">{j.materi_pokok}</p>
                              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{j.tujuan_pembelajaran || "-"}</p>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-100/30 text-[#0c66e4] dark:text-blue-300 text-[11px] font-extrabold rounded-xl shadow-sm">
                                {j.attendance_summary || "-"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {journals
                        .filter(j => selectedJournalClass === "Semua Kelas" || j.kelas === selectedJournalClass)
                        .filter(j => selectedJournalTeacher === "Semua Guru" || j.guru_nama === selectedJournalTeacher)
                        .length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                            Tidak ditemukan data jurnal kelas yang cocok dengan kriteria filter saat ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB Content: DAFTAR SEMUA GURU (Admin/Pengurus Only) */}
      {activeSubTab === "semua_guru" && (currentUser?.role === 'admin' || currentUser?.role === 'pengurus') && (
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
              placeholder="Cari berdasarkan nama lengkap, NIK, atau username..."
            />
          </div>

          {/* Grid of Profiles */}
          {filteredProfiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredProfiles.map((guru) => (
                <div key={guru.id || guru.username} className="border border-slate-150 rounded-xl p-5 hover:shadow-md transition-all space-y-4 bg-slate-50/50">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    {guru.foto_diri ? (
                      <img 
                        src={guru.foto_diri} 
                        alt={String(guru.nama_lengkap || "")} 
                        className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-extrabold text-xl shadow-inner border border-slate-300">
                        {guru.nama_lengkap ? String(guru.nama_lengkap).charAt(0).toUpperCase() : "?"}
                      </div>
                    )}

                    {/* Basic Info */}
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-base leading-tight">{guru.nama_lengkap || "-"}</h4>
                      <p className="text-xs text-slate-400 font-bold tracking-wide uppercase">ID: {guru.username}</p>
                      <p className="text-xs text-slate-600 font-medium">
                        Mapel: <span className="font-bold text-[#0c66e4]">{guru.mata_pelajaran || "Semua Mata Pelajaran"}</span>
                      </p>
                      
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          guru.jenis_kelamin === "L" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"
                        }`}>
                          {guru.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                        </span>
                        {guru.nik && (
                          <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 rounded">
                            NIK: {guru.nik}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed profile grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-150 text-slate-600 bg-white p-3 rounded-lg border border-slate-100 shadow-inner">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">TTL</p>
                      <p className="font-semibold text-slate-800">{guru.tempat_lahir || "-"}, {guru.tanggal_lahir ? new Date(guru.tanggal_lahir).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">No. Telepon / WA</p>
                      {guru.nomor_seluler ? (
                        <a 
                          href={`https://wa.me/${guru.nomor_seluler.replace(/[^0-9]/g, "")}`}
                          target="_blank" 
                          rel="noreferrer"
                          className="font-bold text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> {guru.nomor_seluler}
                        </a>
                      ) : (
                        <p className="text-slate-500 font-semibold">-</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Alamat Sesuai KTP</p>
                      <p className="font-semibold text-slate-800 leading-normal">{guru.alamat_pribadi || "-"}</p>
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

      {/* MODAL: LENGKAPI / UBAH DATA DIRI */}
      {isEditingProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                <User className="text-[#0c66e4] w-5 h-5" /> Ubah Profil Mandiri Guru
              </h3>
              <button
                onClick={() => setIsEditingProfileModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-150 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-6 text-left">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Foto Diri Upload */}
                <div className="flex flex-col items-center space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Foto Diri</span>
                  <div className="relative w-28 h-28 group">
                    {isUploadingPhoto ? (
                      <div className="w-full h-full rounded-full bg-slate-100 border-2 border-slate-200 flex flex-col items-center justify-center text-slate-500">
                        <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                        <span className="text-[9px] mt-1.5 font-bold text-indigo-600 animate-pulse">Uploading...</span>
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
                        <span className="text-[9px] mt-1 font-semibold">Pilih Foto</span>
                      </div>
                    )}
                    {profile.foto_diri && !isUploadingPhoto && (
                      <button
                        type="button"
                        onClick={() => setProfile(prev => ({ ...prev, foto_diri: "" }))}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow"
                        title="Hapus Foto"
                      >
                        <XCircle className="w-4 h-4" />
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
                      id="modal-foto-file-input"
                      disabled={isUploadingPhoto}
                    />
                    <label 
                      htmlFor="modal-foto-file-input"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold rounded-lg shadow-sm ${
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
                    <p className="text-[8px] text-slate-400 mt-1.5">Maksimal file 2MB (JPG/PNG)</p>
                  </div>

                  {/* Pas Foto URL Fallback */}
                  <div className="w-full pt-2 border-t border-slate-200 text-left">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Atau Paste URL Foto</label>
                    <input 
                      type="text" 
                      value={profile.foto_diri && !profile.foto_diri.startsWith("data:") ? profile.foto_diri : ""}
                      onChange={e => setProfile(prev => ({ ...prev, foto_diri: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="https://example.com/foto.jpg"
                    />
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="md:col-span-2 space-y-4">
                  
                  {/* Nama Lengkap */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      value={profile.nama_lengkap}
                      onChange={e => setProfile(prev => ({ ...prev, nama_lengkap: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  {/* NIK and Gender */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        NIK KTP <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text"
                        required
                        maxLength={16}
                        value={profile.nik}
                        onChange={e => setProfile(prev => ({ ...prev, nik: e.target.value.replace(/[^0-9]/g, "") }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="16 digit angka KTP"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Jenis Kelamin <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center justify-center p-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          profile.jenis_kelamin === "L" 
                            ? "bg-blue-50 border-blue-500 text-blue-700" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}>
                          <input 
                            type="radio" 
                            name="modal_jenis_kelamin" 
                            checked={profile.jenis_kelamin === "L"} 
                            onChange={() => setProfile(prev => ({ ...prev, jenis_kelamin: "L" }))}
                            className="hidden" 
                          />
                          Laki-laki
                        </label>
                        <label className={`flex items-center justify-center p-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          profile.jenis_kelamin === "P" 
                            ? "bg-pink-50 border-pink-500 text-pink-700" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}>
                          <input 
                            type="radio" 
                            name="modal_jenis_kelamin" 
                            checked={profile.jenis_kelamin === "P"} 
                            onChange={() => setProfile(prev => ({ ...prev, jenis_kelamin: "P" }))}
                            className="hidden" 
                          />
                          Perempuan
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Mata Pelajaran */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Mata Pelajaran yang Diampu
                    </label>
                    <input 
                      type="text"
                      value={profile.mata_pelajaran || ""}
                      onChange={e => setProfile(prev => ({ ...prev, mata_pelajaran: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                      placeholder="Contoh: Matematika, Bahasa Arab, Fiqih"
                    />
                  </div>

                  {/* Birthplace and Birthday */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tempat Lahir</label>
                      <input 
                        type="text"
                        value={profile.tempat_lahir}
                        onChange={e => setProfile(prev => ({ ...prev, tempat_lahir: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Contoh: Sleman"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tanggal Lahir</label>
                      <input 
                        type="date"
                        value={profile.tanggal_lahir}
                        onChange={e => setProfile(prev => ({ ...prev, tanggal_lahir: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Alamat Pribadi */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Alamat Pribadi (Sesuai KTP)</label>
                    <textarea 
                      rows={2}
                      value={profile.alamat_pribadi}
                      onChange={e => setProfile(prev => ({ ...prev, alamat_pribadi: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Contoh: 081234567890"
                    />
                  </div>

                </div>
              </div>

              {/* Form Footer Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingProfileModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 bg-[#0c66e4] hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Simpan Profil
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
