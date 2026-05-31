import React, { useState, useEffect, useRef } from "react";
import { supabase, SantriData, TABLE_NAME, formatSantriData } from "./supabaseClient";
import RegistrationForm from "./components/RegistrationForm";
import SantriList from "./components/SantriList";
import Dashboard from "./components/Dashboard";
import LoginForm from "./components/LoginForm";
import DatabaseSetupHelper from "./components/DatabaseSetupHelper";
import ManagementPanel from "./components/ManagementPanel";
import PresensiPanel from "./components/PresensiPanel";
import PerizinanPanel from "./components/PerizinanPanel";
import ManajemenSesiPanel from "./components/ManajemenSesiPanel";
import { LayoutDashboard, UserPlus, Database, TableProperties, Sliders, AlertCircle, CheckCircle, Info, RefreshCw, Star, ChevronLeft, ChevronRight, ClipboardList, Moon, Utensils, UserCheck, Clock, Fingerprint } from "lucide-react";
import NfcRegisterPanel from "./components/NfcRegisterPanel";

const DEMO_SANTRI: SantriData[] = [
  {
    id: 1,
    kategori: "SMP",
    nama_lengkap: "Muhammad Ali Syihab",
    nama_panggilan: "Ali",
    nik: "3506121408100001",
    nisn: "0102948576",
    tempat_lahir: "Kediri",
    tanggal_lahir: "2011-08-14",
    alamat: "Jl. Joyoboyo No. 42, Dusun Klopo",
    rt: "002",
    rw: "004",
    desa_kelurahan: "Gampeng",
    kecamatan: "Gampengrejo",
    kabupaten_kota: "Kediri",
    provinsi: "Jawa Timur",
    nama_ayah: "Ahmad Syihabuddin",
    nama_ibu: "Siti Aminah",
    kelompok_sambung: "Kelompok Gampeng",
    desa_sambung: "Gampeng Barat",
    daerah: "Kediri",
    jenis_kelamin: "L",
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
  },
  {
    id: 2,
    kategori: "SMA",
    nama_lengkap: "Salsabila Azzahra",
    nama_panggilan: "Salsa",
    nik: "3506135211090002",
    nisn: "0083948512",
    tempat_lahir: "Malang",
    tanggal_lahir: "2009-11-12",
    alamat: "Dusun Purworejo RT 012 RW 003",
    rt: "012",
    rw: "003",
    desa_kelurahan: "Purworejo",
    kecamatan: "Donomulyo",
    kabupaten_kota: "Malang",
    provinsi: "Jawa Timur",
    nama_ayah: "Joko Susilo",
    nama_ibu: "Tri Wahyuni",
    kelompok_sambung: "Kelompok Purworejo",
    desa_sambung: "Donomulyo",
    daerah: "Malang",
    jenis_kelamin: "P",
    created_at: new Date(Date.now() - 3600000 * 24 * 1).toISOString()
  },
  {
    id: 3,
    kategori: "Reguler",
    nama_lengkap: "Ahmad Dhika Prasetya",
    nama_panggilan: "Dhika",
    nik: "3404111502120003",
    npsn: "20439481",
    tempat_lahir: "Surabaya",
    tanggal_lahir: "2012-02-15",
    alamat: "Gg. Masjid Baiturrohman No. 9",
    rt: "001",
    rw: "002",
    desa_kelurahan: "Wonokromo",
    kecamatan: "Wonokromo",
    kabupaten_kota: "Surabaya",
    provinsi: "Jawa Timur",
    nama_ayah: "Bambang Prasetyo",
    nama_ibu: "Sri Lestari",
    kelompok_sambung: "Kelompok Wonokromo Baru",
    desa_sambung: "Wonokromo Makmur",
    daerah: "Surabaya",
    jenis_kelamin: "L",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 4,
    kategori: "SMA",
    nama_lengkap: "Fatimah Az-Zahra",
    nama_panggilan: "Fatimah",
    nik: "3173054106100004",
    nisn: "0103948518",
    tempat_lahir: "Jakarta Pusat",
    tanggal_lahir: "2010-06-01",
    alamat: "Jl. Kramat Raya No. 101",
    rt: "004",
    rw: "001",
    desa_kelurahan: "Senen",
    kecamatan: "Senen",
    kabupaten_kota: "Jakarta Pusat",
    provinsi: "DKI Jakarta",
    nama_ayah: "Abdurrahman",
    nama_ibu: "Khadijah",
    kelompok_sambung: "Kelompok Senen Barat",
    desa_sambung: "Jakarta Pusat",
    daerah: "Jakarta",
    jenis_kelamin: "P",
    created_at: new Date().toISOString()
  }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string; name: string } | null>(() => {
    const saved = localStorage.getItem("admin_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("admin_theme") === "dark";
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("admin_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("admin_theme", "light");
    }
  }, [isDarkMode]);

  const [activeTab, setActiveTab ] = useState<"dashboard" | "form" | "list" | "setup" | "management" | "absensi" | "manajemen_sesi" | "perizinan" | "nfc">("dashboard");
  const [students, setStudents] = useState<SantriData[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    return saved === "true";
  });
  const [dbStatus, setDbStatus] = useState<"connected" | "missing_table" | "error" | "loading">("loading");
  const [dbErrorMsg, setDbErrorMsg] = useState<string>("");
  const [editingStudent, setEditingStudent] = useState<SantriData | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  // Management categories backing store
  const [rooms, setRooms] = useState<string[]>(() => {
    const saved = localStorage.getItem("manajemen_rooms");
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed;
  });

  const [recitationClasses, setRecitationClasses] = useState<string[]>(() => {
    const saved = localStorage.getItem("manajemen_recitation_classes");
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed;
  });

  const [schoolClasses, setSchoolClasses] = useState<string[]>(() => {
    const saved = localStorage.getItem("manajemen_school_classes");
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed;
  });

  const [metadataMap, setMetadataMap] = useState<Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: string }>>(() => {
    const saved = localStorage.getItem("santri_custom_metadata_map");
    return saved ? JSON.parse(saved) : {};
  });

  // Helper to hydrate students with all status sources including cloud status_siswa, cloud plotting and local storage
  const hydrateWithAllStatusSources = (
    list: SantriData[],
    cloudStatusMap?: Record<string, "Aktif" | "Sakit" | "Pulang">,
    cloudPlottingMap?: Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: string }>,
    cloudNfcMap?: Record<string, string>
  ): SantriData[] => {
    const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
    const savedMetadataMap = JSON.parse(localStorage.getItem("santri_custom_metadata_map") || "{}");
    return list.map((s) => {
      const formatted = formatSantriData(s);
      const nameKey = formatted.nama_lengkap.trim().toLowerCase();
      
      // status_siswa overrides has highest priority
      const cloudStatus = cloudStatusMap ? cloudStatusMap[nameKey] : null;
      
      // Local storage overrides (keyed by name, id, or NIK)
      const localStatus = savedStatusMap[formatted.nama_lengkap] || savedStatusMap[s.id || s.nik];

      // Plottings
      const cloudPlot = cloudPlottingMap ? cloudPlottingMap[nameKey] : null;
      const localPlot = savedMetadataMap[s.nik] || {};
      
      // NFC Mapping override
      const cloudNfcId = cloudNfcMap ? cloudNfcMap[nameKey] : null;
      
      return {
        ...formatted,
        status: cloudStatus || localStatus || formatted.status || "Aktif",
        kamar: (cloudPlot?.kamar !== undefined ? cloudPlot.kamar : (localPlot.kamar !== undefined ? localPlot.kamar : formatted.kamar)) || "",
        kelas_pengajian: (cloudPlot?.kelas_pengajian !== undefined ? cloudPlot.kelas_pengajian : (localPlot.kelas_pengajian !== undefined ? localPlot.kelas_pengajian : formatted.kelas_pengajian)) || "",
        kelas_sekolah: (cloudPlot?.kelas_sekolah !== undefined ? cloudPlot.kelas_sekolah : (localPlot.kelas_sekolah !== undefined ? localPlot.kelas_sekolah : formatted.kelas_sekolah)) || "",
        nfc_id: cloudNfcId || formatted.nfc_id || "",
      };
    });
  };

  // Helper to hydrate students with local status overrides
  const hydrateStudentsWithStatus = (list: SantriData[]): SantriData[] => {
    return hydrateWithAllStatusSources(list);
  };

  const handleAssignMetadata = async (nik: string, key: "kamar" | "kelas_sekolah" | "kelas_pengajian", value: string) => {
    // 1. Update local metadataMap state
    const updated = {
      ...metadataMap,
      [nik]: {
        ...(metadataMap[nik] || {}),
        [key]: value
      }
    };
    setMetadataMap(updated);
    localStorage.setItem("santri_custom_metadata_map", JSON.stringify(updated));

    // Update students state immediately for ultra-fast local reactivity
    setStudents((prev) =>
      prev.map((s) => {
        if (s.nik === nik) {
          return {
            ...s,
            [key]: value
          };
        }
        return s;
      })
    );

    // Try to update database if connected
    if (dbStatus === "connected") {
      const studentObj = students.find((s) => s.nik === nik);
      if (studentObj) {
        const studentName = studentObj.nama_lengkap.trim();
        try {
          if (key === "kamar") {
            // Check if there is already an entry for this student in 'kamar' table
            const { data: existingKamar } = await supabase
              .from("kamar")
              .select("id")
              .eq("nama", studentName);

            if (existingKamar && existingKamar.length > 0) {
              if (value === "") {
                const { error } = await supabase
                  .from("kamar")
                  .delete()
                  .eq("id", existingKamar[0].id);
                if (error) console.warn("Failed to delete kamar entry:", error.message);
              } else {
                const { error } = await supabase
                  .from("kamar")
                  .update({ kamar: value })
                  .eq("id", existingKamar[0].id);
                if (error) console.warn("Failed to update kamar entry:", error.message);
              }
            } else if (value !== "") {
              const { error } = await supabase
                .from("kamar")
                .insert([{ nama: studentName, kamar: value }]);
              if (error) console.warn("Failed to insert kamar entry:", error.message);
            }
            triggerNotification(`Plotting Kamar berhasil disimpan ke "${value || 'Kosong'}"`, "success");

          } else if (key === "kelas_pengajian") {
            // Check if there is already an entry for this student in 'kelas_pengajian' table
            const { data: existingPengajian } = await supabase
              .from("kelas_pengajian")
              .select("id")
              .eq("nama", studentName);

            if (existingPengajian && existingPengajian.length > 0) {
              if (value === "") {
                const { error } = await supabase
                  .from("kelas_pengajian")
                  .delete()
                  .eq("id", existingPengajian[0].id);
                if (error) console.warn("Failed to delete kelas_pengajian entry:", error.message);
              } else {
                const { error } = await supabase
                  .from("kelas_pengajian")
                  .update({ kelas: value })
                  .eq("id", existingPengajian[0].id);
                if (error) console.warn("Failed to update kelas_pengajian entry:", error.message);
              }
            } else if (value !== "") {
              const { error } = await supabase
                .from("kelas_pengajian")
                .insert([{ nama: studentName, kelas: value }]);
              if (error) console.warn("Failed to insert kelas_pengajian entry:", error.message);
            }
            triggerNotification(`Plotting Kelas Pengajian berhasil disimpan ke "${value || 'Kosong'}"`, "success");

          } else if (key === "kelas_sekolah") {
            // Supports both "kelas sekolah" (with space) and "kelas_sekolah" (with underscore)
            const tables = ["kelas sekolah", "kelas_sekolah"];
            let success = false;

            for (const tableName of tables) {
              try {
                const { data: existingSchool, error: selectErr } = await supabase
                  .from(tableName)
                  .select("id")
                  .eq("nama", studentName);

                if (!selectErr && existingSchool) {
                  if (existingSchool.length > 0) {
                    if (value === "") {
                      await supabase.from(tableName).delete().eq("id", existingSchool[0].id);
                    } else {
                      await supabase.from(tableName).update({ kelas: value }).eq("id", existingSchool[0].id);
                    }
                  } else if (value !== "") {
                    await supabase.from(tableName).insert([{ nama: studentName, kelas: value }]);
                  }
                  success = true;
                  break;
                }
              } catch (e) {
                // Try next table
              }
            }
            triggerNotification(`Plotting Kelas Sekolah berhasil disimpan ke "${value || 'Kosong'}"`, "success");
          }
        } catch (err: any) {
          console.warn("Supabase plotting synchronization error:", err?.message);
        }
      }
    } else {
      triggerNotification(`Plotting disimpan di lokal!`, "success");
    }
  };
  
  // Floating Toast Notifications System State
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // Trigger brief floating notifications
  const triggerNotification = (message: string, type: "success" | "error" | "warning") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Check Supabase connectivity and retrieve students
  const checkConnectionAndLoad = async () => {
    setDbStatus("loading");
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .order("id", { ascending: false });

      if (error) {
        // PostGrest database code "42P01" signifies that the table "santri" does not exist yet
        if (error.code === "42P01") {
          setDbStatus("missing_table");
          setDbErrorMsg("Tabel 'santri' tidak ditemukan di database Supabase.");
          loadLocalFallback();
        } else {
          setDbStatus("error");
          setDbErrorMsg(error.message || "Gagal menghubungkan ke Supabase.");
          loadLocalFallback();
        }
      } else {
        setDbStatus("connected");
        
        let cloudStatusMap: Record<string, "Aktif" | "Sakit" | "Pulang"> = {};
        const { data: statusOverrides, error: statusErr } = await supabase
          .from("status_siswa")
          .select("nama, status");
        
        if (statusErr) {
          console.error("Gagal mendapatkan status dari tabel status_siswa:", statusErr.message);
        } else if (statusOverrides) {
          statusOverrides.forEach((row) => {
            if (row.nama && row.status) {
              const normStatus = row.status.trim().toLowerCase();
              let standardized: "Aktif" | "Sakit" | "Pulang" = "Aktif";
              if (normStatus === "sakit") standardized = "Sakit";
              else if (normStatus === "pulang") standardized = "Pulang";
              
              cloudStatusMap[row.nama.trim().toLowerCase()] = standardized;
            }
          });
        }

        // Fetch new plotting table records to merge overrides
        let cloudPlottingMap: Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: string }> = {};
        
        // 1. Load room mappings from 'kamar' table
        try {
          const { data: assignmentsKamar } = await supabase.from("kamar").select("nama, kamar");
          if (assignmentsKamar) {
             assignmentsKamar.forEach((row) => {
               if (row.nama) {
                 const key = row.nama.trim().toLowerCase();
                 if (!cloudPlottingMap[key]) cloudPlottingMap[key] = {};
                 cloudPlottingMap[key].kamar = row.kamar || "";
               }
             });
          }
        } catch (err) {
          console.warn("Table 'kamar' assignment load error:", err);
        }

        // 2. Load recitation class mappings from 'kelas_pengajian' table
        try {
          const { data: assignmentsPengajian } = await supabase.from("kelas_pengajian").select("nama, kelas");
          if (assignmentsPengajian) {
             assignmentsPengajian.forEach((row) => {
               if (row.nama) {
                 const key = row.nama.trim().toLowerCase();
                 if (!cloudPlottingMap[key]) cloudPlottingMap[key] = {};
                 cloudPlottingMap[key].kelas_pengajian = row.kelas || "";
               }
             });
          }
        } catch (err) {
          console.warn("Table 'kelas_pengajian' assignment load error:", err);
        }

        // 3. Load school class mappings from 'kelas sekolah' or 'kelas_sekolah' table (handles space/underscore alternative)
        try {
          let assignmentsSchool = null;
          const { data: dbSpace, error: spaceErr } = await supabase.from("kelas sekolah").select("nama, kelas");
          if (!spaceErr && dbSpace) {
            assignmentsSchool = dbSpace;
          } else {
            const { data: dbUnderline } = await supabase.from("kelas_sekolah").select("nama, kelas");
            if (dbUnderline) {
              assignmentsSchool = dbUnderline;
            }
          }
          if (assignmentsSchool) {
             assignmentsSchool.forEach((row) => {
               if (row.nama) {
                 const key = row.nama.trim().toLowerCase();
                 if (!cloudPlottingMap[key]) cloudPlottingMap[key] = {};
                 cloudPlottingMap[key].kelas_sekolah = row.kelas || "";
               }
             });
          }
        } catch (err) {
          console.warn("Table 'kelas sekolah' school assignment load error:", err);
        }

        // 4. Load master list of kamar from 'plotting' table
        try {
          const { data: plotRooms } = await supabase
            .from("plotting")
            .select("nama")
            .eq("jenis", "kamar");

          if (plotRooms && plotRooms.length > 0) {
            const dbRoomList = plotRooms.map((r) => r.nama).filter(Boolean);
            setRooms(dbRoomList);
            localStorage.setItem("manajemen_rooms", JSON.stringify(dbRoomList));
          }
        } catch (err) {
          console.warn("Gagal memuat master daftar kamar dari plotting:", err);
        }

        // 5. Load master list of kelas pengajian from 'plotting' table
        try {
          const { data: plotRecitation } = await supabase
            .from("plotting")
            .select("nama")
            .eq("jenis", "kelas pengajian");

          if (plotRecitation && plotRecitation.length > 0) {
            const dbRecitationList = plotRecitation.map((r) => r.nama).filter(Boolean);
            setRecitationClasses(dbRecitationList);
            localStorage.setItem("manajemen_recitation_classes", JSON.stringify(dbRecitationList));
          }
        } catch (err) {
          console.warn("Gagal memuat master kelas pengajian dari plotting:", err);
        }

        // 6. Load master list of kelas sekolah from 'plotting' table
        try {
          const { data: plotSchool } = await supabase
            .from("plotting")
            .select("nama")
            .eq("jenis", "kelas sekolah");

          if (plotSchool && plotSchool.length > 0) {
            const dbSchoolListPlot = plotSchool.map((r) => r.nama).filter(Boolean);
            setSchoolClasses(dbSchoolListPlot);
            localStorage.setItem("manajemen_school_classes", JSON.stringify(dbSchoolListPlot));
          }
        } catch (err) {
          console.warn("Gagal memuat master kelas sekolah dari plotting:", err);
        }

        // 7. Load NFC card mapping from 'nfc' table
        let cloudNfcMap: Record<string, string> = {};
        try {
          const { data: dbNfc, error: nfcErr } = await supabase
            .from("nfc")
            .select("nama, serial_number");
          
          if (!nfcErr && dbNfc) {
            dbNfc.forEach((row) => {
              if (row.nama && row.serial_number) {
                cloudNfcMap[row.nama.trim().toLowerCase()] = String(row.serial_number).trim();
              }
            });
          }
        } catch (err) {
          console.warn("Gagal memuat master data NFC dari tabel nfc:", err);
        }

        const formattedList = hydrateWithAllStatusSources(data || [], cloudStatusMap, cloudPlottingMap, cloudNfcMap);
        setStudents(formattedList);
        // Also save to localStorage as a background backup!
        localStorage.setItem("santri_local_backup", JSON.stringify(formattedList));
      }
    } catch (e: any) {
      setDbStatus("error");
      setDbErrorMsg(e.message || "Ada kendala pada jaringan server database.");
      loadLocalFallback();
    }
  };

  // Fallback to offline clientside local storage
  const loadLocalFallback = () => {
    const cached = localStorage.getItem("santri_data");
    const backup = localStorage.getItem("santri_local_backup");
    
    if (cached) {
      const parsed = JSON.parse(cached);
      setStudents(Array.isArray(parsed) ? hydrateStudentsWithStatus(parsed) : []);
    } else if (backup) {
      const parsed = JSON.parse(backup);
      setStudents(Array.isArray(parsed) ? hydrateStudentsWithStatus(parsed) : []);
    } else {
      // Load initial beautiful DEMO_SANTRI for pristine presentation
      const list = hydrateStudentsWithStatus(DEMO_SANTRI);
      setStudents(list);
      localStorage.setItem("santri_data", JSON.stringify(list));
    }
  };

  // Refresh data on load and subscribe to Supabase Realtime channel
  const checkConnectionAndLoadRef = useRef(checkConnectionAndLoad);
  checkConnectionAndLoadRef.current = checkConnectionAndLoad;

  useEffect(() => {
    // Initial fetch of all tables when component mounts
    checkConnectionAndLoadRef.current();

    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log("Mengambil ulang data terbaru dari database cloud (Sync Realtime)...");
        checkConnectionAndLoadRef.current();
      }, 500); // 500ms debounce
    };

    // Subscribing to Supabase Realtime changes on crucial tables
    const realtimeChannel = supabase
      .channel("sub-all-tables-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "santri" }, () => {
        debouncedReload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "status_siswa" }, () => {
        debouncedReload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kamar" }, () => {
        debouncedReload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kelas_pengajian" }, () => {
        debouncedReload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kelas_sekolah" }, () => {
        debouncedReload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kelas sekolah" }, () => {
        debouncedReload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "nfc" }, () => {
        debouncedReload();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "plotting" }, () => {
        debouncedReload();
      })
      .subscribe((status) => {
        console.log("Supabase Realtime subscription status:", status);
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  // Save or Update a Santri
  const handleFormSubmit = async (data: SantriData): Promise<{ success: boolean; error?: string }> => {
    setIsFormSubmitting(true);
    try {
      const formattedData = formatSantriData(data);
      const targetStatus = formattedData.status || "Aktif";
      // Clean undefined fields to keep Supabase happy, exclude removed 'status' column
      const payload: Partial<SantriData> = {
        kategori: formattedData.kategori,
        nama_lengkap: formattedData.nama_lengkap,
        nama_panggilan: formattedData.nama_panggilan,
        nik: formattedData.nik,
        tempat_lahir: formattedData.tempat_lahir,
        tanggal_lahir: formattedData.tanggal_lahir,
        alamat: formattedData.alamat,
        rt: formattedData.rt,
        rw: formattedData.rw,
        desa_kelurahan: formattedData.desa_kelurahan,
        kecamatan: formattedData.kecamatan,
        kabupaten_kota: formattedData.kabupaten_kota,
        provinsi: formattedData.provinsi,
        nama_ayah: formattedData.nama_ayah,
        nama_ibu: formattedData.nama_ibu,
        kelompok_sambung: formattedData.kelompok_sambung,
        desa_sambung: formattedData.desa_sambung,
        daerah: formattedData.daerah,
        kamar: formattedData.kamar || "",
        kelas_pengajian: formattedData.kelas_pengajian || "",
        kelas_sekolah: formattedData.kelas_sekolah || "",
        jenis_kelamin: formattedData.jenis_kelamin || "L",
        foto: formattedData.foto || "",
        nfc_id: formattedData.nfc_id || "",
      };

      if (data.kategori !== "Reguler") {
        payload.nisn = data.nisn;
        payload.npsn = null as any;
      } else {
        payload.npsn = data.npsn;
        payload.nisn = null as any;
      }

      if (dbStatus === "connected") {
        // Attempt Supabase SQL Insert or Update
        if (editingStudent && editingStudent.id) {
          let { error } = await supabase
            .from(TABLE_NAME)
            .update(payload)
            .eq("id", editingStudent.id);

          // If the schema cache misses nfc_id, strip and retry
          if (error && (error.message.includes("nfc_id") || error.message.includes("column"))) {
            console.warn("PostgREST schema cache mismatch. Stripping nfc_id and retrying update...");
            const { nfc_id, ...strippedPayload } = payload;
            const retryRes = await supabase
              .from(TABLE_NAME)
              .update(strippedPayload)
              .eq("id", editingStudent.id);
            error = retryRes.error;
          }

          if (error) throw error;
          
          triggerNotification(`Berhasil memperbarui data santri ${formattedData.nama_lengkap}!`, "success");
        } else {
          let { error } = await supabase
            .from(TABLE_NAME)
            .insert([payload]);

          // If the schema cache misses nfc_id, strip and retry
          if (error && (error.message.includes("nfc_id") || error.message.includes("column"))) {
            console.warn("PostgREST schema cache mismatch. Stripping nfc_id and retrying insert...");
            const { nfc_id, ...strippedPayload } = payload;
            const retryRes = await supabase
              .from(TABLE_NAME)
              .insert([strippedPayload]);
            error = retryRes.error;
          }

          if (error) throw error;
          triggerNotification(`Santri baru ${formattedData.nama_lengkap} berhasil terdaftarkan ke cloud database!`, "success");
        }

        // Save NFC Mapping to 'nfc' table too if nfc_id is provided
        if (formattedData.nfc_id && formattedData.nfc_id.trim() !== "") {
          try {
            const studentName = formattedData.nama_lengkap.trim();
            await supabase.from("nfc").delete().eq("nama", studentName);
            await supabase.from("nfc").delete().eq("serial_number", formattedData.nfc_id.trim());
            await supabase.from("nfc").insert([{
              nama: studentName,
              serial_number: formattedData.nfc_id.trim()
            }]);
          } catch (nfcErr) {
            console.warn("Gagal mensinkronisasikan nfc_id ke tabel nfc:", nfcErr);
          }
        }

        // Upsert / sync status back into "status_siswa" table
        try {
          const { data: existingStatus } = await supabase
            .from("status_siswa")
            .select("id")
            .ilike("nama", formattedData.nama_lengkap.trim());

          if (existingStatus && existingStatus.length > 0) {
            await supabase
              .from("status_siswa")
              .update({ status: targetStatus, created_at: new Date().toISOString() })
              .eq("id", existingStatus[0].id);
          } else {
            // Also test if there is any other match before inserting a duplicate
            const { data: existingExact } = await supabase
              .from("status_siswa")
              .select("id")
              .eq("nama", formattedData.nama_lengkap);

            if (existingExact && existingExact.length > 0) {
              await supabase
                .from("status_siswa")
                .update({ status: targetStatus, created_at: new Date().toISOString() })
                .eq("id", existingExact[0].id);
            } else {
              await supabase
                .from("status_siswa")
                .insert([{ nama: formattedData.nama_lengkap, status: targetStatus }]);
            }
          }
        } catch (statusErr: any) {
          console.warn("Gagal menyinkronkan status ke tabel status_siswa:", statusErr?.message);
        }

        await checkConnectionAndLoad(); // reload
      } else {
        // Offline Fallback - Save to state and Web LocalStorage
        let localList = [...students];
        if (editingStudent && editingStudent.id) {
          // Edit existing
          localList = localList.map((item) =>
            item.id === editingStudent.id ? { ...formattedData, id: editingStudent.id } : item
          );
          triggerNotification(`Profil ${formattedData.nama_lengkap} diperbarui (Penyimpanan Lokal)`, "success");
        } else {
          // Add new as a local mockup item
          const newStudent = {
            ...formattedData,
            id: Math.floor(Math.random() * 1000000), // Random temporary key ID
            created_at: new Date().toISOString()
          };
          localList = [newStudent, ...localList];
          triggerNotification(`Registrasi ${formattedData.nama_lengkap} disimpan offline di browser Anda!`, "success");
        }
        setStudents(localList.map(formatSantriData));
        localStorage.setItem("santri_data", JSON.stringify(localList.map(formatSantriData)));
      }

      // Restore states
      setEditingStudent(null);
      setActiveTab("list");
      return { success: true };
    } catch (e: any) {
      console.error(e);
      triggerNotification(`Gagal menyimpan: ${e.message || "Terganggu jaringan database."}`, "error");
      
      // If server error occurs but the state wasn't 'connected', we can also force temporary offline save
      if (dbStatus !== "connected") {
        return { success: false, error: e.message };
      }
      return { success: false, error: e.message };
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // Update a Santri's status (Aktif/Sakit/Pulang)
  const handleUpdateStudentStatus = async (studentIdOrNik: number | string, newStatus: "Aktif" | "Sakit" | "Pulang") => {
    try {
      // 1. Update status map in localStorage
      const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
      savedStatusMap[studentIdOrNik] = newStatus;
      localStorage.setItem("santri_status_map", JSON.stringify(savedStatusMap));

      // 2. Update status in local memory list state
      const updatedList = students.map((s) => {
        if ((s.id && s.id === studentIdOrNik) || s.nik === studentIdOrNik) {
          return { ...s, status: newStatus };
        }
        return s;
      });
      setStudents(updatedList);
      localStorage.setItem("santri_data", JSON.stringify(updatedList));

      // 3. Try to update status in supabase status_siswa if connected
      if (dbStatus === "connected") {
        const studentObj = students.find((s) => (s.id && s.id === studentIdOrNik) || s.nik === studentIdOrNik);
        const studentName = studentObj ? studentObj.nama_lengkap : "";

        if (studentName) {
          try {
            const { data: existingStatus } = await supabase
              .from("status_siswa")
              .select("id")
              .ilike("nama", studentName.trim());

            if (existingStatus && existingStatus.length > 0) {
              const { error } = await supabase
                .from("status_siswa")
                .update({ status: newStatus, created_at: new Date().toISOString() })
                .eq("id", existingStatus[0].id);

              if (error) {
                console.error("Gagal memperbarui tabel status_siswa:", error.message);
              } else {
                triggerNotification(`Status diperbarui ke "${newStatus}" di Cloud Database`, "success");
                return;
              }
            } else {
              const { error } = await supabase
                .from("status_siswa")
                .insert([{ nama: studentName, status: newStatus, created_at: new Date().toISOString() }]);

              if (error) {
                console.error("Gagal menambahkan ke tabel status_siswa:", error.message);
              } else {
                triggerNotification(`Status ditambahkan ke "${newStatus}" di Cloud Database`, "success");
                return;
              }
            }
          } catch (statusErr: any) {
            console.warn("Supabase status_siswa sync error:", statusErr?.message);
          }
        }
      }
      triggerNotification(`Status diperbarui ke "${newStatus}"`, "success");
    } catch (e: any) {
      console.error("Status update error:", e);
      triggerNotification(`Status diperbarui menjadi "${newStatus}"`, "success");
    }
  };

  // Update students NFC Card ID
  const handleUpdateStudentNfc = async (studentId: number, nfcId: string | null): Promise<boolean> => {
    // Update students immediately in memory for real-time responsiveness
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, nfc_id: nfcId || "" } : s))
    );

    // Save locally
    const currentCached = localStorage.getItem("santri_data");
    if (currentCached) {
      try {
        const parsed = JSON.parse(currentCached);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((s: any) => (s.id === studentId ? { ...s, nfc_id: nfcId || "" } : s));
          localStorage.setItem("santri_data", JSON.stringify(updated));
        }
      } catch (err) {
        console.warn("Local storage update parse error:", err);
      }
    }

    if (dbStatus === "connected") {
      try {
        const targetStudent = students.find((s) => s.id === studentId);
        if (targetStudent) {
          const studentName = targetStudent.nama_lengkap.trim();

          // 1. Delete any existing rows in 'nfc' table with this student's name (nama)
          await supabase
            .from("nfc")
            .delete()
            .eq("nama", studentName);

          // 2. Delete any existing rows in 'nfc' table with this serial number (serial_number) to prevent duplicates
          if (nfcId && nfcId.trim() !== "") {
            await supabase
              .from("nfc")
              .delete()
              .eq("serial_number", nfcId.trim());

            // 3. Insert new row with the updated student mapping
            const { error: insertErr } = await supabase
              .from("nfc")
              .insert([
                {
                  nama: studentName,
                  serial_number: nfcId.trim()
                }
              ]);
            if (insertErr) {
              console.warn("Gagal meregistrasikan ke tabel nfc:", insertErr.message);
            }
          }
        }

        // 4. Update the standard 'nfc_id' in 'santri' table as non-blocking fallback
        try {
          const { error } = await supabase
            .from(TABLE_NAME)
            .update({ nfc_id: nfcId || "" })
            .eq("id", studentId);

          if (error) {
            console.warn("Info: Kolom 'nfc_id' di tabel utama santri belum terdeteksi/terbaca cache. Data kartu berhasil diamankan di tabel relasi NFC.", error.message);
          }
        } catch (updateErr: any) {
          console.warn("Gagal update kolom nfc_id:", updateErr?.message);
        }

        triggerNotification(`Berhasil memperbarui data kartu NFC siswa!`, "success");
        return true;
      } catch (e: any) {
        triggerNotification(`Gagal terhubung ke database: ${e.message}`, "error");
        return false;
      }
    } else {
      triggerNotification(`Tersimpan secara lokal (offline)!`, "success");
      return true;
    }
  };

  // Delete a Santri
  const handleDeleteStudent = async (id: number) => {
    try {
      if (dbStatus === "connected") {
        const { error } = await supabase
          .from(TABLE_NAME)
          .delete()
          .eq("id", id);

        if (error) throw error;
        triggerNotification("Data santri terhapus dari cloud database", "success");
        await checkConnectionAndLoad();
      } else {
        // Offline Fallback remove
        const updated = students.filter((item) => item.id !== id);
        setStudents(updated);
        localStorage.setItem("santri_data", JSON.stringify(updated));
        triggerNotification("Data santri dihapus secara lokal", "warning");
      }
    } catch (e: any) {
      console.error(e);
      triggerNotification(`Tindakan gagal: ${e.message || "Kendala basis data."}`, "error");
    }
  };

  // Handlers for switching tabs with clear resets
  const handleTriggerEdit = (student: SantriData) => {
    setEditingStudent(student);
    setActiveTab("form");
  };

  // Inject beautiful demo entities
  const handleLoadDemoData = () => {
    const listToLoad = [...students];
    DEMO_SANTRI.forEach((demo) => {
      // Check if duplicate NIK
      if (!listToLoad.some((item) => item.nik === demo.nik)) {
        listToLoad.unshift({
          ...demo,
          id: Math.floor(Math.random() * 1000000),
        });
      }
    });

    const formattedList = listToLoad.map(formatSantriData);
    setStudents(formattedList);
    localStorage.setItem("santri_data", JSON.stringify(formattedList));
    triggerNotification("4 Data Santri Demo berhasil dimasukkan! Lihat di menu Database.", "success");
    setActiveTab("list");
  };

  if (!currentUser) {
    return (
      <LoginForm 
        onSuccess={(user) => setCurrentUser(user)} 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#f3f6fc] dark:bg-[#080914] text-slate-800 dark:text-slate-100 font-sans overflow-hidden select-none transition-colors duration-300 relative z-10" id="boarding_school_app">
      
      {/* 0. FLOATING COSMIC BACKGROUND GRADIENTS & SHAPES */}
      <BackgroundDecorations isDarkMode={isDarkMode} />
      
      {/* 1. TOP FLOATING NOTIFICATION BANNER */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-3" id="floating-notifications">
          <div className={`p-3 rounded-lg shadow-md border text-xs ${
            notification.type === "success"
              ? "bg-sky-50 border-sky-300 text-sky-900"
              : notification.type === "warning"
              ? "bg-amber-50 border-amber-300 text-amber-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
              <div className="flex-1 font-medium">{notification.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. HEADER */}
      <header className="h-14 bg-white dark:bg-[#111322] text-slate-800 dark:text-slate-100 flex items-center justify-between px-6 shrink-0 shadow-sm border-b border-slate-200/80 dark:border-[#1d2138] z-40 select-none transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/50 dark:bg-black/30 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200/50 dark:border-slate-800 shadow-sm">
            <img
              src="https://eflhcunxpckcynozywol.supabase.co/storage/v1/object/public/foto_siswa/1779791263491_pbf19o.png"
              alt="Logo Pondok"
              className="w-7 h-7 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm md:text-base font-bold tracking-tight uppercase leading-none text-slate-800 dark:text-slate-100">Pondok Pesantren Al-Muttaqin</h1>
            <span className="text-[14px-small] text-slate-500 dark:text-slate-400 font-semibold tracking-wider font-mono mt-0.5 uppercase leading-none text-[9px]">Kota Madiun</span>
          </div>
        </div>

        {/* Administrator Profile Info & Logout */}
        <div className="flex items-center gap-3.5 text-[#041e49] dark:text-slate-100">
          
          {/* Day/Night Mode Toggle selector switch */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-10 h-10 rounded-xl relative overflow-hidden flex items-center justify-center bg-white/20 dark:bg-slate-805 hover:bg-white/35 dark:hover:bg-slate-800 active:scale-95 transition-all outline-none border-0 cursor-pointer shadow-sm group"
            title={isDarkMode ? "Aktifkan Mode Siang" : "Aktifkan Mode Malam"}
            id="theme-switcher-toggle"
          >
            <div className="absolute inset-x-0 inset-y-0 transition-all duration-300 transform rounded-xl" />
            <span className="text-base select-none z-10 transition-transform duration-300 group-hover:rotate-12">
              {isDarkMode ? "☀️" : "🌙"}
            </span>
          </button>

          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-extrabold">{currentUser?.name}</span>
            <span className="text-[9px] font-mono tracking-wider opacity-80 uppercase font-black">Admin</span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("admin_token");
              localStorage.removeItem("admin_user");
              setCurrentUser(null);
              triggerNotification("Berhasil keluar dari sesi admin", "warning");
            }}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 dark:bg-rose-700 dark:hover:bg-rose-800 text-white font-extrabold text-[11px] rounded-lg tracking-wide shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5 border border-red-700 dark:border-rose-900"
          >
            <span>LOGOUT</span>
          </button>
        </div>
      </header>

      {/* 3. MAIN CONTAINER WITH SIDEBAR & CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row relative">
        
        {/* Navigation Sidebar (Desktop view) */}
        <aside 
          className={`${sidebarCollapsed ? "w-16" : "w-60"} bg-[#f0f4f9] dark:bg-[#0b0d1a] border-r border-[#dee4ec] dark:border-slate-800 flex flex-col p-0 shrink-0 hidden md:flex transition-all duration-300 overflow-hidden shadow-sm`} 
          id="desktop-sidebar"
        >
          {/* Header area of Sidebar with Hamburger Toggle Button ☰ */}
          <div className={`p-3 bg-[#e9eef6]/50 dark:bg-[#0e1222]/85 flex ${sidebarCollapsed ? "justify-center" : "justify-end px-5"} border-b border-[#dee4ec]/60 dark:border-slate-800 shrink-0`}>
            <button
              onClick={() => {
                const nextVal = !sidebarCollapsed;
                setSidebarCollapsed(nextVal);
                localStorage.setItem("sidebar_collapsed", String(nextVal));
              }}
              className="p-1.5 bg-white dark:bg-[#1a233d] border border-[#dee4ec] dark:border-slate-800 shadow-sm rounded-lg hover:bg-[#e1e9f5] dark:hover:bg-[#151930] text-[#041e49] dark:text-slate-100 transition-all cursor-pointer w-8 h-8 flex items-center justify-center select-none"
              title={sidebarCollapsed ? "Buka Sidebar" : "Sembunyikan Sidebar"}
            >
              <span className="text-sm font-black">☰</span>
            </button>
          </div>

          {/* Navigation links - Akkhor custom layout with chevrons on right */}
          <nav className="flex-1 py-3 text-xs select-none">
            {!sidebarCollapsed && (
              <div className="text-[10px] font-black text-[#5f6368] dark:text-slate-400 uppercase tracking-widest my-2 px-6">Menu Utama</div>
            )}
            <div className="flex flex-col">
              {[
                { id: "dashboard", label: "Dasbor Ringkasan", icon: LayoutDashboard },
                { id: "list", label: "Database Santri", icon: TableProperties },
                { id: "perizinan", label: "Perizinan Santri", icon: UserCheck },
                { id: "absensi", label: "Absensi Santri", icon: ClipboardList },
                { id: "manajemen_sesi", label: "Manajemen Sesi", icon: Clock },
                { id: "form", label: editingStudent ? "Edit Santri" : "Pendaftaran Baru", icon: UserPlus },
                { id: "management", label: "Plotting Siswa", icon: Sliders },
                { id: "nfc", label: "Registrasi NFC", icon: Fingerprint },
                { id: "setup", label: "Koneksi & Panduan", icon: Database },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <div key={tab.id} className="w-full">
                    <button
                      onClick={() => {
                        if (tab.id !== "form") setEditingStudent(null);
                        setActiveTab(tab.id as any);
                      }}
                      title={sidebarCollapsed ? tab.label : undefined}
                      className={`w-full flex items-center transition-all ${
                        sidebarCollapsed 
                          ? "justify-center py-4 px-0 border-b border-[#dee4ec]/40 dark:border-slate-800" 
                          : "justify-between px-6 py-3.5 border-b border-[#dee4ec]/40 dark:border-slate-850"
                      } ${
                        isActive
                          ? "bg-[#c2e7ff] dark:bg-[#1a233d] text-[#001d35] dark:text-[#38bdf8] font-bold"
                          : "text-[#444746] dark:text-slate-400 hover:bg-[#e1e9f5]/60 dark:hover:bg-[#151930] hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <TabIcon className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? "text-[#001d35] dark:text-[#38bdf8] font-bold" : "text-slate-500 dark:text-slate-400"
                        }`} />
                        {!sidebarCollapsed && <span className="truncate tracking-wide text-xs">{tab.label}</span>}
                      </div>
                      
                      {/* Akkhor-style chevron on non-collapsed tabs */}
                      {!sidebarCollapsed && (
                        <ChevronRight className={`w-3.5 h-3.5 transition-all ${
                          isActive ? "text-[#001d35] dark:text-[#38bdf8] translate-x-0.5" : "text-slate-400 dark:text-slate-650 opacity-60"
                        }`} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Bottom section with sync status inside Akkhor-style container */}
          <div className="p-4 border-t border-[#dee4ec] dark:border-slate-850 shrink-0">
            {!sidebarCollapsed ? (
              <div className="p-3 bg-white/60 dark:bg-[#151930]/65 border border-slate-200/85 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${dbStatus === "connected" ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`}></span>
                  SINKRONISASI
                </div>
                <div className="text-[10px] font-semibold font-mono text-[#444746] dark:text-slate-350 leading-tight select-all">
                  {dbStatus === "connected" ? "live_supabase_active" : "local_persisted_storage"}
                </div>
              </div>
            ) : (
              <div 
                className="flex justify-center" 
                title={dbStatus === "connected" ? "DB Status: Terhubung Online" : "DB Status: Lokal Backup"}
              >
                <span className={`w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ${dbStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`}></span>
              </div>
            )}
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 bg-slate-50 overflow-y-auto flex flex-col p-4 pb-20 md:p-6" id="santri-sub-pages">
          
          {/* Offline warning banner */}
          {dbStatus !== "connected" && activeTab !== "setup" && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200/60 rounded-lg text-[11px] text-amber-800 leading-tight flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>
                  <strong>Mode Offline Aktif:</strong> Pendaftaran disimpan lokal di web browser ini. Anda dapat melakukan sinkronisasi di menu <strong>Koneksi Cloud</strong>.
                </span>
              </div>
              <button
                onClick={() => setActiveTab("setup")}
                className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded"
              >
                Atur
              </button>
            </div>
          )}

          {/* Current Router Outlet */}
          <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col">
            {activeTab === "dashboard" && (
              <Dashboard
                students={students}
                onNavigateToForm={() => {
                  setEditingStudent(null);
                  setActiveTab("form");
                }}
                onNavigateToList={() => setActiveTab("list")}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
              />
            )}

            {activeTab === "form" && (
              <div className="w-full">
                <RegistrationForm
                  onSubmit={handleFormSubmit}
                  isSubmitting={isFormSubmitting}
                  initialData={editingStudent}
                  rooms={rooms}
                  recitationClasses={recitationClasses}
                  schoolClasses={schoolClasses}
                  students={students}
                  onCancel={() => {
                    setEditingStudent(null);
                    setActiveTab("list");
                  }}
                />
              </div>
            )}

            {activeTab === "list" && (
              <SantriList
                students={students}
                onEdit={handleTriggerEdit}
                onDelete={handleDeleteStudent}
                onUpdateStatus={handleUpdateStudentStatus}
              />
            )}

            {activeTab === "perizinan" && (
              <div className="w-full">
                <PerizinanPanel
                  students={students}
                  rooms={rooms}
                  onRefreshAll={checkConnectionAndLoad}
                  onTriggerNotification={triggerNotification}
                />
              </div>
            )}

            {activeTab === "absensi" && (
              <div className="w-full">
                <PresensiPanel students={students} />
              </div>
            )}

            {activeTab === "manajemen_sesi" && (
              <div className="w-full">
                <ManajemenSesiPanel />
              </div>
            )}

            {activeTab === "management" && (
              <div className="w-full">
                <ManagementPanel
                  students={students}
                  rooms={rooms}
                  setRooms={setRooms}
                  recitationClasses={recitationClasses}
                  setRecitationClasses={setRecitationClasses}
                  schoolClasses={schoolClasses}
                  setSchoolClasses={setSchoolClasses}
                  metadataMap={metadataMap}
                  onAssignMetadata={handleAssignMetadata}
                />
              </div>
            )}

            {activeTab === "nfc" && (
              <div className="w-full">
                <NfcRegisterPanel
                  students={students}
                  rooms={rooms}
                  onUpdateNfc={handleUpdateStudentNfc}
                  isDarkMode={isDarkMode}
                />
              </div>
            )}

            {activeTab === "setup" && (
              <div className="w-full max-w-4xl mx-auto">
                <DatabaseSetupHelper
                  status={dbStatus}
                  errorDetails={dbErrorMsg}
                  onRetry={checkConnectionAndLoad}
                  onLoadDemo={handleLoadDemoData}
                />
              </div>
            )}
          </div>
          
          {/* Spasi pengisi di bawah pada mobile agar konten tidak tertutup oleh bottom navigation yang melayang */}
          <div className="h-24 shrink-0 md:hidden" />
        </section>

        {/* Navigation Bar (Mobile view) */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-[#111425] border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 flex overflow-x-auto whitespace-nowrap gap-1 px-2.5 py-1.5 select-none shadow-[0_-2px_10px_rgba(0,0,0,0.05)] scrollbar-none" id="mobile-navigation">
          {[
            { id: "dashboard", label: "Dasbor", icon: LayoutDashboard },
            { id: "list", label: "Database", icon: TableProperties },
            { id: "perizinan", label: "Izin", icon: UserCheck },
            { id: "absensi", label: "Absensi", icon: ClipboardList },
            { id: "manajemen_sesi", label: "Sesi", icon: Clock },
            { id: "form", label: editingStudent ? "Edit" : "Daftar", icon: UserPlus },
            { id: "management", label: "Plotting", icon: Sliders },
            { id: "nfc", label: "NFC", icon: Fingerprint },
            { id: "setup", label: "Cloud", icon: Database },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id !== "form") setEditingStudent(null);
                  setActiveTab(tab.id as any);
                }}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-lg text-[9px] font-bold tracking-tight transition-all shrink-0 min-w-[54px] ${
                  isActive ? "text-sky-600 dark:text-[#38bdf8] bg-sky-50 dark:bg-[#1a233d] font-black font-extrabold" : "text-slate-500 dark:text-slate-450 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>



    </div>
  );
}

// Gorgeous decorative mesh and tilted pill overlay layers for high-aesthetic light and dark modes
function BackgroundDecorations({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0 opacity-75 dark:opacity-50">
      {/* Dynamic gradient meshes based on theme */}
      {isDarkMode ? (
        <>
          <div className="absolute top-[-15%] left-[-15%] w-[65%] h-[65%] rounded-full bg-blue-950/20 blur-[130px]" />
          <div className="absolute bottom-[-15%] right-[-15%] w-[65%] h-[65%] rounded-full bg-indigo-950/25 blur-[130px]" />
          <div className="absolute top-[40%] right-[20%] w-[45%] h-[45%] rounded-full bg-purple-950/15 blur-[120px]" />
        </>
      ) : (
        <>
          <div className="absolute top-[-15%] left-[-15%] w-[65%] h-[65%] rounded-full bg-[#ff7e30]/4 blur-[130px]" />
          <div className="absolute bottom-[-15%] right-[-15%] w-[65%] h-[65%] rounded-full bg-[#6c8cff]/7 blur-[130px]" />
          <div className="absolute top-[45%] right-[10%] w-[50%] h-[50%] rounded-full bg-purple-200/15 blur-[120px]" />
        </>
      )}

      {/* Tilted capsules exactly matching design specification in the screenshots */}
      {/* 1. Top left capsule */}
      <div 
        className={`absolute top-[12%] left-[8%] w-14 h-44 rounded-full rotate-[25deg] transition-all duration-700 border ${
          isDarkMode 
            ? "bg-gradient-to-b from-[#13172e]/20 to-transparent border-[#24294a]/30" 
            : "bg-gradient-to-b from-white/40 to-transparent border-slate-200/40 shadow-[rgba(108,140,255,0.03)_0px_20px_40px_0px]"
        }`}
      />

      {/* 2. Middle-left tilted long capsule */}
      <div 
        className={`absolute top-[35%] left-[-8%] w-24 h-80 rounded-full rotate-[15deg] transition-all duration-700 border ${
          isDarkMode 
            ? "bg-gradient-to-t from-[#1b1f3c]/15 to-transparent border-[#29305e]/25" 
            : "bg-gradient-to-t from-[#6c8cff]/4 to-transparent border-[#6c8cff]/10 shadow-[rgba(108,140,255,0.04)_0px_25px_50px_-5px]"
        }`}
      />

      {/* 3. Bottom left capsule */}
      <div 
        className={`absolute bottom-[10%] left-[10%] w-16 h-48 rounded-full rotate-[25deg] transition-all duration-700 border ${
          isDarkMode 
            ? "bg-gradient-to-tr from-[#141830]/25 to-transparent border-[#24294d]/25" 
            : "bg-gradient-to-tr from-[#ff4b4b]/2 to-transparent border-slate-200/25"
        }`}
      />

      {/* 4. Top right capsule */}
      <div 
        className={`absolute top-[10%] right-[12%] w-18 h-40 rounded-full rotate-[35deg] transition-all duration-700 border ${
          isDarkMode 
            ? "bg-gradient-to-tr from-[#171a36]/20 to-transparent border-[#2a2f5a]/25" 
            : "bg-gradient-to-tr from-[#ffa42a]/2 to-transparent border-slate-200/25"
        }`}
      />

      {/* 5. Bottom right oblique capsule */}
      <div 
        className={`absolute bottom-[10%] right-[3%] w-24 h-72 rounded-full rotate-[20deg] transition-all duration-700 border ${
          isDarkMode 
            ? "bg-gradient-to-b from-[#111428]/30 to-transparent border-[#1f2444]/25" 
            : "bg-gradient-to-b from-[#6c8cff]/4 to-[#ff7e30]/2 border-slate-200/25 shadow-[rgba(148,163,184,0.03)_0px_30px_60px_-10px]"
        }`}
      />
    </div>
  );
}
