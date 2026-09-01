import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase, SantriData, TABLE_NAME, formatSantriData } from "./supabaseClient";
import RegistrationForm from "./components/RegistrationForm";
import SantriList from "./components/SantriList";
import Dashboard from "./components/Dashboard";
import DashboardGuruSekolah from "./components/DashboardGuruSekolah";
import DashboardGuruPondok from "./components/DashboardGuruPondok";
import AbsensiGuruPanel from "./components/AbsensiGuruPanel";
import LoginForm from "./components/LoginForm";
import ManagementPanel from "./components/ManagementPanel";
import PresensiPanel from "./components/PresensiPanel";
import PerizinanPanel from "./components/PerizinanPanel";
import ManajemenSesiPanel from "./components/ManajemenSesiPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import ManajemenPenggunaPanel from "./components/ManajemenPenggunaPanel";
import ManajemenPondokPanel from "./components/ManajemenPondokPanel";
import ManajemenSekolahPanel from "./components/ManajemenSekolahPanel";
import { LayoutDashboard, UserPlus, Database, TableProperties, Sliders, AlertCircle, CheckCircle, Info, RefreshCw, Star, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, Search, ClipboardList, Moon, Sun, Utensils, UserCheck, Clock, Fingerprint, Shield, Menu, X, LogOut, MapPin, GraduationCap, Home, BookMarked, Building2, User, Users, UserMinus, Award, ShieldAlert, Bell, FileText } from "lucide-react";
import NfcRegisterPanel from "./components/NfcRegisterPanel";
import DaftarWargaPanel from "./components/DaftarWargaPanel";
import SiswaLulusMutasiPanel from "./components/SiswaLulusMutasiPanel";
import PelanggaranPanel from "./components/PelanggaranPanel";

const DEMO_SANTRI: SantriData[] = [];

const getInitials = (name?: string) => {
  if (!name) return "A";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: string;
    name: string;
    gender?: string;
    bagian?: string;
    jabatan?: string;
    tugas_kamar?: string;
    tugas_kelas_sekolah?: string;
    tugas_kelas_pengajian?: string;
  } | null>(() => {
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

  const [activeTab, setActiveTab ] = useState<"dashboard" | "form" | "list" | "warga_guru" | "warga_pengurus" | "warga_mutasi" | "warga_lulus" | "management" | "absensi" | "rekap_presensi" | "manajemen_sesi" | "perizinan" | "nfc" | "pengguna" | "absensi_guru" | "manajemen_pondok" | "manajemen_sekolah" | "pelanggaran_input" | "pelanggaran_rekap">("dashboard");
  const [isDataWargaExpanded, setIsDataWargaExpanded] = useState(true);
  const [isPelanggaranExpanded, setIsPelanggaranExpanded] = useState(false);
  const [isManajemenExpanded, setIsManajemenExpanded] = useState(false);
  const [hoveredFlyout, setHoveredFlyout] = useState<"data_warga" | "pelanggaran" | "manajemen" | null>(null);
  const [mobileDataWargaOpen, setMobileDataWargaOpen] = useState(true);
  const [mobilePelanggaranOpen, setMobilePelanggaranOpen] = useState(false);
  const [mobileManajemenOpen, setMobileManajemenOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [listFilters, setListFilters] = useState<{ category?: string; status?: string }>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [students, setStudents] = useState<SantriData[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    return saved === "true";
  });
  const [dbStatus, setDbStatus] = useState<"connected" | "missing_table" | "error" | "loading">("loading");
  const [dbErrorMsg, setDbErrorMsg] = useState<string>("");
  const [isDbConfigModalOpen, setIsDbConfigModalOpen] = useState(false);
  const [modalDbUrl, setModalDbUrl] = useState(() => localStorage.getItem("supabase_url") || "");
  const [modalDbKey, setModalDbKey] = useState(() => localStorage.getItem("supabase_anon_key") || "");
  const [modalSuccessMsg, setModalSuccessMsg] = useState("");
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

  const [lulusList, setLulusList] = useState<any[]>(() => {
    const saved = localStorage.getItem("siswa_lulus_data");
    if (!saved) return [];
    try {
      return JSON.parse(saved) || [];
    } catch {
      return [];
    }
  });

  const [mutasiList, setMutasiList] = useState<any[]>(() => {
    const saved = localStorage.getItem("siswa_mutasi_data");
    if (!saved) return [];
    try {
      return JSON.parse(saved) || [];
    } catch {
      return [];
    }
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
          console.warn("Tabel status_siswa tidak ditemukan atau gagal dimuat (Abaikan jika tabel belum ada).");
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

        // 8. Load Siswa Lulus data
        try {
          let { data: dbLulus } = await supabase.from("siswa_lulus").select("*");
          if (!dbLulus || dbLulus.length === 0) {
            const { data: altLulus } = await supabase.from("lulus").select("*");
            if (altLulus) dbLulus = altLulus;
          }
          if (dbLulus) {
            setLulusList(dbLulus);
            localStorage.setItem("siswa_lulus_data", JSON.stringify(dbLulus));
          }
        } catch (err) {
          console.warn("Gagal memuat data siswa_lulus:", err);
        }

        // 9. Load Siswa Mutasi data
        try {
          let { data: dbMutasi } = await supabase.from("siswa_mutasi").select("*");
          if (!dbMutasi || dbMutasi.length === 0) {
            const { data: altMutasi } = await supabase.from("mutasi").select("*");
            if (altMutasi) dbMutasi = altMutasi;
          }
          if (dbMutasi) {
            setMutasiList(dbMutasi);
            localStorage.setItem("siswa_mutasi_data", JSON.stringify(dbMutasi));
          }
        } catch (err) {
          console.warn("Gagal memuat data siswa_mutasi:", err);
        }

        const formattedList = hydrateWithAllStatusSources(data || [], cloudStatusMap, cloudPlottingMap, cloudNfcMap);
        setStudents(formattedList);
        // Also save to localStorage as background backup!
        localStorage.setItem("santri_data", JSON.stringify(formattedList));
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
    const demoNiks = ["3506121408100001", "3506135211090002", "3404111502120003", "3173054106100004"];
    
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const filtered = Array.isArray(parsed) ? parsed.filter((s: any) => !demoNiks.includes(s.nik)) : [];
        setStudents(hydrateStudentsWithStatus(filtered));
      } catch {
        setStudents([]);
      }
    } else if (backup) {
      try {
        const parsed = JSON.parse(backup);
        const filtered = Array.isArray(parsed) ? parsed.filter((s: any) => !demoNiks.includes(s.nik)) : [];
        setStudents(hydrateStudentsWithStatus(filtered));
      } catch {
        setStudents([]);
      }
    } else {
      setStudents([]);
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

  // Close mobile sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

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
        no_hp_ortu: formattedData.no_hp_ortu || "",
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

          // Retry logic if there are column cache mismatches (nfc_id or no_hp_ortu)
          if (error && (error.message.includes("column") || error.message.includes("does not exist") || error.message.includes("nfc_id") || error.message.includes("no_hp_ortu"))) {
            console.warn("PostgREST schema cache mismatch. Stripping missing columns and retrying...");
            let strippedPayload = { ...payload };
            let hasNoHpOrtuError = error.message.includes("no_hp_ortu");
            
            if (error.message.includes("no_hp_ortu")) {
              const { no_hp_ortu, ...rest } = strippedPayload;
              strippedPayload = rest;
            }
            if (error.message.includes("nfc_id")) {
              const { nfc_id, ...rest } = strippedPayload;
              strippedPayload = rest;
            }
            
            // In case of a generic column error, let's try stripping no_hp_ortu first then nfc_id
            if (!error.message.includes("no_hp_ortu") && !error.message.includes("nfc_id")) {
              const { no_hp_ortu, nfc_id, ...rest } = strippedPayload;
              strippedPayload = rest;
              hasNoHpOrtuError = true;
            }

            const retryRes = await supabase
              .from(TABLE_NAME)
              .update(strippedPayload)
              .eq("id", editingStudent.id);
            
            error = retryRes.error;
            
            if (!error && hasNoHpOrtuError) {
              triggerNotification("Peringatan: Data tersimpan tanpa No. HP Ortu karena API Supabase belum diperbarui. Silakan klik 'Reload schema' di API Docs Supabase Dashboard Anda.", "warning");
            }
          }

          if (error) throw error;
          
          triggerNotification(`Berhasil memperbarui data siswa ${formattedData.nama_lengkap}!`, "success");
        } else {
          let { error } = await supabase
            .from(TABLE_NAME)
            .insert([payload]);

          // Retry logic if there are column cache mismatches (nfc_id or no_hp_ortu)
          if (error && (error.message.includes("column") || error.message.includes("does not exist") || error.message.includes("nfc_id") || error.message.includes("no_hp_ortu"))) {
            console.warn("PostgREST schema cache mismatch. Stripping missing columns and retrying...");
            let strippedPayload = { ...payload };
            let hasNoHpOrtuError = error.message.includes("no_hp_ortu");
            
            if (error.message.includes("no_hp_ortu")) {
              const { no_hp_ortu, ...rest } = strippedPayload;
              strippedPayload = rest;
            }
            if (error.message.includes("nfc_id")) {
              const { nfc_id, ...rest } = strippedPayload;
              strippedPayload = rest;
            }
            
            // In case of a generic column error, let's try stripping no_hp_ortu first then nfc_id
            if (!error.message.includes("no_hp_ortu") && !error.message.includes("nfc_id")) {
              const { no_hp_ortu, nfc_id, ...rest } = strippedPayload;
              strippedPayload = rest;
              hasNoHpOrtuError = true;
            }

            const retryRes = await supabase
              .from(TABLE_NAME)
              .insert([strippedPayload]);
            
            error = retryRes.error;
            
            if (!error && hasNoHpOrtuError) {
              triggerNotification("Peringatan: Data tersimpan tanpa No. HP Ortu karena API Supabase belum diperbarui. Silakan klik 'Reload schema' di API Docs Supabase Dashboard Anda.", "warning");
            }
          }

          if (error) throw error;
          triggerNotification(`Siswa baru ${formattedData.nama_lengkap} berhasil terdaftarkan ke cloud database!`, "success");
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
  const handleUpdateStudentStatus = async (studentIdOrNik: number | string, newStatus: "Aktif" | "Sakit" | "Pulang" | "Haid") => {
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
                console.warn("Gagal memperbarui tabel status_siswa:", error.message);
              } else {
                triggerNotification(`Status diperbarui ke "${newStatus}" di Cloud Database`, "success");
                return;
              }
            } else {
              const { error } = await supabase
                .from("status_siswa")
                .insert([{ nama: studentName, status: newStatus, created_at: new Date().toISOString() }]);

              if (error) {
                console.warn("Gagal menambahkan ke tabel status_siswa:", error.message);
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
  const handleDeleteStudent = async (id?: number, student?: SantriData) => {
    try {
      const targetId = id && id > 0 ? id : student?.id;
      const targetNik = student?.nik;
      const targetName = student?.nama_lengkap?.trim();

      if (!targetId && !targetNik && !targetName) {
        triggerNotification("Gagal menghapus: Identitas santri tidak valid", "error");
        return;
      }

      // 1. Immediately update local state & storage for snappy UI response
      const filterOut = (item: SantriData) => {
        if (targetId && item.id === targetId) return false;
        if (targetNik && item.nik === targetNik) return false;
        if (targetName && item.nama_lengkap?.trim().toLowerCase() === targetName.toLowerCase()) return false;
        return true;
      };

      const updated = students.filter(filterOut);
      setStudents(updated);
      localStorage.setItem("santri_data", JSON.stringify(updated));
      localStorage.setItem("santri_local_backup", JSON.stringify(updated));

      // Clean up local metadata & status override maps
      if (targetNik) {
        try {
          const metaMap = JSON.parse(localStorage.getItem("santri_custom_metadata_map") || "{}");
          delete metaMap[targetNik];
          localStorage.setItem("santri_custom_metadata_map", JSON.stringify(metaMap));
        } catch {}
      }
      if (targetName) {
        try {
          const statusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
          delete statusMap[targetName.toLowerCase()];
          delete statusMap[targetName];
          localStorage.setItem("santri_status_map", JSON.stringify(statusMap));
        } catch {}
      }

      // 2. Perform deletion on Supabase Cloud Database if connected
      if (dbStatus === "connected") {
        let isDeleted = false;
        let deleteError: any = null;

        // Clean up auxiliary tables first to avoid foreign key or reference leftovers
        if (targetName) {
          await Promise.allSettled([
            supabase.from("kamar").delete().ilike("nama", targetName),
            supabase.from("kelas_pengajian").delete().ilike("nama", targetName),
            supabase.from("kelas_sekolah").delete().ilike("nama", targetName),
            supabase.from("kelas sekolah").delete().ilike("nama", targetName),
            supabase.from("nfc").delete().ilike("nama", targetName),
            supabase.from("status_siswa").delete().ilike("nama", targetName),
          ]);
        }

        // Try Delete by ID
        if (targetId) {
          const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq("id", targetId);

          if (!error) {
            isDeleted = true;
          } else {
            console.warn("Supabase delete by ID error:", error);
            deleteError = error;
          }
        }

        // Try Delete by NIK fallback
        if (!isDeleted && targetNik) {
          const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq("nik", targetNik);

          if (!error) {
            isDeleted = true;
          } else {
            console.warn("Supabase delete by NIK error:", error);
            if (!deleteError) deleteError = error;
          }
        }

        // Try Delete by Nama Lengkap fallback
        if (!isDeleted && targetName) {
          const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .ilike("nama_lengkap", targetName);

          if (!error) {
            isDeleted = true;
          } else {
            console.warn("Supabase delete by Nama error:", error);
            if (!deleteError) deleteError = error;
          }
        }

        if (!isDeleted && deleteError) {
          triggerNotification(`Gagal menghapus di database (${deleteError.code || 'RLS'}): ${deleteError.message || 'Izin database dibatasi (RLS Policy)'}`, "error");
        } else {
          triggerNotification(`Data santri "${targetName || 'terpilih'}" berhasil dihapus secara permanen`, "success");
        }

        // Re-sync with cloud database
        await checkConnectionAndLoad();
      } else {
        triggerNotification(`Data santri "${targetName || 'terpilih'}" dihapus dari penyimpanan lokal`, "warning");
      }
    } catch (e: any) {
      console.error("Gagal menghapus santri:", e);
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

  const userRole = currentUser?.role || "admin";
  const userGenderAccess = currentUser?.gender || "Semua";

  const displayedStudents = useMemo(() => {
    const excludedSantriIds = new Set<number>();
    const excludedNiks = new Set<string>();
    const excludedNisns = new Set<string>();
    const excludedNames = new Set<string>();

    const processItem = (item: any) => {
      if (!item) return;
      if (item.santri_id) excludedSantriIds.add(Number(item.santri_id));
      if (item.nik && String(item.nik).trim()) excludedNiks.add(String(item.nik).trim().toLowerCase());
      if (item.nisn && String(item.nisn).trim()) excludedNisns.add(String(item.nisn).trim().toLowerCase());
      if (item.nama_lengkap && String(item.nama_lengkap).trim()) {
        excludedNames.add(String(item.nama_lengkap).trim().toLowerCase());
      }
    };

    lulusList.forEach(processItem);
    mutasiList.forEach(processItem);

    try {
      const savedLulus = localStorage.getItem("siswa_lulus_data");
      if (savedLulus) JSON.parse(savedLulus).forEach(processItem);
    } catch {}

    try {
      const savedMutasi = localStorage.getItem("siswa_mutasi_data");
      if (savedMutasi) JSON.parse(savedMutasi).forEach(processItem);
    } catch {}

    return students.filter((s) => {
      if (s.id && excludedSantriIds.has(Number(s.id))) return false;
      if (s.nik && excludedNiks.has(String(s.nik).trim().toLowerCase())) return false;
      if (s.nisn && excludedNisns.has(String(s.nisn).trim().toLowerCase())) return false;
      if (s.nama_lengkap && excludedNames.has(String(s.nama_lengkap).trim().toLowerCase())) return false;
      return true;
    });
  }, [students, lulusList, mutasiList]);

  const allTabs = [
    { id: "dashboard", group: "UTAMA", label: "Dasbor", shortLabel: "Dasbor", icon: Home, roles: ["admin", "guru_pondok", "guru_sekolah", "pengurus"] },
    { id: "form", group: "UTAMA", label: editingStudent ? "Edit Siswa" : "Pendaftaran", shortLabel: editingStudent ? "Edit" : "Daftar", icon: UserPlus, roles: ["admin", "guru_pondok", "pengurus"] },
    { id: "perizinan", group: "UTAMA", label: "Perizinan Siswa", shortLabel: "Izin", icon: Clock, roles: ["admin", "guru_pondok", "pengurus"] },
    { id: "absensi", group: "UTAMA", label: "Absensi Siswa", shortLabel: "Absensi", icon: ClipboardList, roles: ["admin", "guru_pondok", "pengurus"] },
    { id: "rekap_presensi", group: "UTAMA", label: "Rekap Presensi", shortLabel: "Rekap", icon: TableProperties, roles: ["admin", "guru_pondok", "pengurus"] },
    { id: "absensi_guru", group: "UTAMA", label: "Guru Sekolah & Jurnal", shortLabel: "Guru Sekolah", icon: GraduationCap, roles: ["admin", "guru_pondok", "guru_sekolah", "pengurus"] },
    { id: "nfc", group: "UTAMA", label: "Registrasi NFC", shortLabel: "NFC", icon: Fingerprint, roles: ["admin", "pengurus"] },
    
    // DATA WARGA GROUP WITH SUBMENUS
    { id: "list", group: "DATA WARGA", isSubmenu: true, subLabel: "Santri", label: "Santri", shortLabel: "Santri", icon: Users, roles: ["admin", "guru_pondok", "guru_sekolah", "pengurus"] },
    { id: "warga_guru", group: "DATA WARGA", isSubmenu: true, subLabel: "Guru", label: "Guru", shortLabel: "Guru", icon: GraduationCap, roles: ["admin", "guru_pondok", "guru_sekolah", "pengurus"] },
    { id: "warga_pengurus", group: "DATA WARGA", isSubmenu: true, subLabel: "Pengurus", label: "Pengurus", shortLabel: "Pengurus", icon: Shield, roles: ["admin", "guru_pondok", "guru_sekolah", "pengurus"] },
    { id: "warga_mutasi", group: "DATA WARGA", isSubmenu: true, subLabel: "Mutasi", label: "Mutasi", shortLabel: "Mutasi", icon: UserMinus, roles: ["admin", "guru_pondok", "guru_sekolah", "pengurus"] },
    { id: "warga_lulus", group: "DATA WARGA", isSubmenu: true, subLabel: "Alumni / Lulus", label: "Alumni / Lulus", shortLabel: "Lulus", icon: Award, roles: ["admin", "guru_pondok", "guru_sekolah", "pengurus"] },
    
    // PELANGGARAN GROUP WITH SUBMENUS
    { id: "pelanggaran_input", group: "PELANGGARAN", isSubmenu: true, subLabel: "Input Pelanggaran", label: "Input Pelanggaran", shortLabel: "Input Pelanggaran", icon: ShieldAlert, roles: ["admin", "guru_pondok", "pengurus"] },
    { id: "pelanggaran_rekap", group: "PELANGGARAN", isSubmenu: true, subLabel: "Daftar Pelanggaran", label: "Daftar Pelanggaran", shortLabel: "Rekap Pelanggaran", icon: ClipboardList, roles: ["admin", "guru_pondok", "pengurus"] },
    
    // PLOTTING / MANAJEMEN AKADEMIK
    { id: "manajemen_pondok", group: "PLOTTING", isSubmenu: true, subLabel: "Manajemen Pondok", label: "Manajemen Pondok", shortLabel: "Pondok", icon: Building2, roles: ["admin", "pengurus"] },
    { id: "manajemen_sekolah", group: "PLOTTING", isSubmenu: true, subLabel: "Manajemen Sekolah", label: "Manajemen Sekolah", shortLabel: "Sekolah", icon: BookMarked, roles: ["admin", "pengurus"] },
    { id: "pengguna", group: "PLOTTING", isSubmenu: true, subLabel: "Manajemen Akun", label: "Manajemen Akun", shortLabel: "Akun", icon: Shield, roles: ["admin"] },
  ];
  
  const accessibleTabs = allTabs.filter(t => t.roles.includes(userRole));

  useEffect(() => {
    if (currentUser) {
      if (!allTabs.find(t => t.id === activeTab)?.roles.includes(userRole)) {
        setActiveTab("dashboard");
      }
    }
  }, [currentUser, activeTab, userRole]);

  if (!currentUser) {
    return (
      <LoginForm 
        onSuccess={(user) => {
          setCurrentUser(user);
          setActiveTab("dashboard");
        }} 
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

      {/* Database connection configuration modal */}
      {isDbConfigModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Konfigurasi Database Supabase
              </h3>
              <button
                onClick={() => {
                  setIsDbConfigModalOpen(false);
                  setModalSuccessMsg("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-extrabold text-sm p-1 cursor-pointer outline-none border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            <div className={`p-3 rounded-2xl border text-xs leading-relaxed font-semibold transition-colors ${
              isDarkMode ? "bg-blue-950/20 border-blue-900/30 text-blue-300" : "bg-blue-50 border-blue-100 text-blue-800"
            }`}>
              {dbStatus === "connected" ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  ● Status: Terhubung ke Database Cloud Anda.
                </span>
              ) : (
                <span>
                  ● Status: <strong>Offline</strong> ({dbErrorMsg || "Koneksi terputus"}). Masukkan kredensial database Anda sendiri untuk mengaktifkan sinkronisasi otomatis.
                </span>
              )}
            </div>

            {modalSuccessMsg && (
              <div className="p-2 text-center text-xs font-bold text-emerald-500 bg-emerald-500/10 rounded-xl animate-pulse">
                {modalSuccessMsg}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (modalDbUrl.trim()) {
                  localStorage.setItem("supabase_url", modalDbUrl.trim());
                } else {
                  localStorage.removeItem("supabase_url");
                }
                if (modalDbKey.trim()) {
                  localStorage.setItem("supabase_anon_key", modalDbKey.trim());
                } else {
                  localStorage.removeItem("supabase_anon_key");
                }
                setModalSuccessMsg("Konfigurasi disimpan! Memuat ulang sistem...");
                setTimeout(() => {
                  window.location.reload();
                }, 1500);
              }}
              className="space-y-4 text-left"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                  SUPABASE PROJECT URL
                </label>
                <input
                  type="url"
                  value={modalDbUrl}
                  onChange={(e) => setModalDbUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co"
                  className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                  SUPABASE ANON KEY
                </label>
                <input
                  type="password"
                  value={modalDbKey}
                  onChange={(e) => setModalDbKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              {dbStatus === "missing_table" && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-[10px] text-red-700 dark:text-red-300 space-y-1">
                  <div className="font-bold uppercase text-[9px] tracking-wide">Pemberitahuan Database:</div>
                  <p>Tabel <code className="font-mono bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">santri</code> belum siap di database Anda.</p>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDbConfigModalOpen(false);
                    setModalSuccessMsg("");
                  }}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] py-2.5 px-3 rounded-xl uppercase tracking-wider cursor-pointer transition-all border-0"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-2.5 px-3 rounded-xl uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center justify-center gap-1 border-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                  Simpan
                </button>
                {(localStorage.getItem("supabase_url") || localStorage.getItem("supabase_anon_key")) && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("supabase_url");
                      localStorage.removeItem("supabase_anon_key");
                      setModalDbUrl("");
                      setModalDbKey("");
                      setModalSuccessMsg("Koneksi dikembalikan ke default! Memuat ulang...");
                      setTimeout(() => {
                        window.location.reload();
                      }, 1500);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] py-2.5 px-3 rounded-xl uppercase tracking-wider cursor-pointer shadow transition-all border-0"
                    title="Reset ke Default"
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MAIN CONTAINER WITH SIDEBAR & CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row relative">
        
        {/* Navigation Sidebar (Desktop view) */}
        <aside 
          className={`${sidebarCollapsed ? "w-[72px]" : "w-64"} bg-[#f8fafc] dark:bg-[#0b0f19] border-r border-slate-200/80 dark:border-slate-800/80 hidden md:flex md:flex-col p-0 shrink-0 transition-all duration-300 shadow-xs text-slate-800 dark:text-slate-100 z-20 select-none overflow-x-hidden no-scrollbar`} 
          id="desktop-sidebar"
        >
          {/* Top Header section with Logo Pondok, Generus Title & Toggle */}
          <div className="shrink-0 p-3 border-b border-slate-200/70 dark:border-slate-800/70 overflow-x-hidden">
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs p-1 flex items-center justify-center">
                  <img
                    src="https://eflhcunxpckcynozywol.supabase.co/storage/v1/object/public/foto_siswa/1779791263491_pbf19o.png"
                    alt="Logo Pondok"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <button
                  onClick={() => {
                    const nextVal = false;
                    setSidebarCollapsed(nextVal);
                    localStorage.setItem("sidebar_collapsed", "false");
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Buka Sidebar"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs p-1 shrink-0 flex items-center justify-center">
                    <img
                      src="https://eflhcunxpckcynozywol.supabase.co/storage/v1/object/public/foto_siswa/1779791263491_pbf19o.png"
                      alt="Logo Pondok"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none truncate">
                      Generus
                    </h1>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const nextVal = true;
                    setSidebarCollapsed(nextVal);
                    localStorage.setItem("sidebar_collapsed", "true");
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Ciutkan Sidebar"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Search Input Area */}
            {!sidebarCollapsed && (
              <div className="mt-3">
                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all shadow-2xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Cari Menu..."
                    value={sidebarSearchQuery}
                    onChange={(e) => setSidebarSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 ml-2 w-full font-medium"
                  />
                  {sidebarSearchQuery && (
                    <button onClick={() => setSidebarSearchQuery("")} className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs font-mono ml-1">✕</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation links */}
          <nav className="flex-1 px-2.5 py-2 text-xs select-none overflow-y-auto overflow-x-hidden no-scrollbar space-y-1">
            {/* 1. STANDALONE MAIN MENUS (Dasbor, Pendaftaran, Perizinan, Absensi, dll) */}
            {accessibleTabs
              .filter(t => t.group === "UTAMA" && (!sidebarSearchQuery || t.label.toLowerCase().includes(sidebarSearchQuery.toLowerCase())))
              .map(tab => {
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
                      className={`w-full flex items-center transition-all rounded-xl ${
                        sidebarCollapsed ? "justify-center py-2.5 px-2" : "justify-start px-3 py-2.5 gap-3"
                      } ${
                        isActive
                          ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <TabIcon className={`w-4.5 h-4.5 shrink-0 transition-colors ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                      {!sidebarCollapsed && <span className="truncate tracking-normal text-xs">{tab.label}</span>}
                    </button>
                  </div>
                );
              })}

            {/* 2. DATA WARGA GROUP (ACCORDION) */}
            {accessibleTabs.some(t => t.group === "DATA WARGA") && (!sidebarSearchQuery || "data warga santri guru pengurus mutasi lulus".includes(sidebarSearchQuery.toLowerCase())) && (
              <div 
                className="w-full pt-1.5 relative group/flyout"
                onMouseEnter={() => setHoveredFlyout("data_warga")}
                onMouseLeave={() => setHoveredFlyout(null)}
              >
                {!sidebarCollapsed ? (
                  <div
                    onClick={() => setIsDataWargaExpanded(!isDataWargaExpanded)}
                    className="px-3 pt-2 pb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none transition-colors"
                  >
                    <span>Data Warga</span>
                    {isDataWargaExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                ) : (
                  <div className="w-full flex justify-center py-1">
                    <button
                      onClick={() => setIsDataWargaExpanded(!isDataWargaExpanded)}
                      className={`p-2 rounded-xl transition-colors ${
                        ["list", "warga_guru", "warga_pengurus", "warga_mutasi", "warga_lulus"].includes(activeTab)
                          ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                          : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                      }`}
                      title="Data Warga"
                    >
                      <Users className="w-4.5 h-4.5" />
                    </button>
                  </div>
                )}

                {/* Expanded Inline Submenu */}
                {!sidebarCollapsed && isDataWargaExpanded && (
                  <div className="space-y-0.5 mt-0.5">
                    {accessibleTabs.filter(t => t.group === "DATA WARGA").map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            if (sub.id === "list") setListFilters({});
                            setActiveTab(sub.id as any);
                          }}
                          className={`w-full flex items-center justify-start px-3 py-2 gap-3 rounded-xl transition-all text-xs ${
                            isSubActive
                              ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed Flyout Popover */}
                {sidebarCollapsed && hoveredFlyout === "data_warga" && (
                  <div className="absolute left-full top-0 ml-2 z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      Data Warga
                    </div>
                    {accessibleTabs.filter(t => t.group === "DATA WARGA").map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            if (sub.id === "list") setListFilters({});
                            setActiveTab(sub.id as any);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            isSubActive
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <SubIcon className="w-4 h-4 text-slate-400" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. PELANGGARAN GROUP (ACCORDION) */}
            {accessibleTabs.some(t => t.group === "PELANGGARAN") && (!sidebarSearchQuery || "pelanggaran input daftar sanksi".includes(sidebarSearchQuery.toLowerCase())) && (
              <div 
                className="w-full pt-1.5 relative group/flyout"
                onMouseEnter={() => setHoveredFlyout("pelanggaran")}
                onMouseLeave={() => setHoveredFlyout(null)}
              >
                {!sidebarCollapsed ? (
                  <div
                    onClick={() => setIsPelanggaranExpanded(!isPelanggaranExpanded)}
                    className="px-3 pt-2 pb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none transition-colors"
                  >
                    <span>Pelanggaran</span>
                    {isPelanggaranExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                ) : (
                  <div className="w-full flex justify-center py-1">
                    <button
                      onClick={() => setIsPelanggaranExpanded(!isPelanggaranExpanded)}
                      className={`p-2 rounded-xl transition-colors ${
                        ["pelanggaran_input", "pelanggaran_rekap"].includes(activeTab)
                          ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                          : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                      }`}
                      title="Pelanggaran"
                    >
                      <ShieldAlert className="w-4.5 h-4.5" />
                    </button>
                  </div>
                )}

                {/* Expanded Inline Submenu */}
                {!sidebarCollapsed && isPelanggaranExpanded && (
                  <div className="space-y-0.5 mt-0.5">
                    {accessibleTabs.filter(t => t.group === "PELANGGARAN").map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTab(sub.id as any)}
                          className={`w-full flex items-center justify-start px-3 py-2 gap-3 rounded-xl transition-all text-xs ${
                            isSubActive
                              ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed Flyout Popover */}
                {sidebarCollapsed && hoveredFlyout === "pelanggaran" && (
                  <div className="absolute left-full top-0 ml-2 z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      Pelanggaran
                    </div>
                    {accessibleTabs.filter(t => t.group === "PELANGGARAN").map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTab(sub.id as any)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            isSubActive
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <SubIcon className="w-4 h-4 text-slate-400" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. PLOTTING / MANAJEMEN GROUP (ACCORDION) */}
            {accessibleTabs.some(t => t.group === "PLOTTING") && (!sidebarSearchQuery || "plotting manajemen pondok sekolah akun pengguna".includes(sidebarSearchQuery.toLowerCase())) && (
              <div 
                className="w-full pt-1.5 relative group/flyout"
                onMouseEnter={() => setHoveredFlyout("manajemen")}
                onMouseLeave={() => setHoveredFlyout(null)}
              >
                {!sidebarCollapsed ? (
                  <div
                    onClick={() => setIsManajemenExpanded(!isManajemenExpanded)}
                    className="px-3 pt-2 pb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none transition-colors"
                  >
                    <span>Plotting</span>
                    {isManajemenExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                ) : (
                  <div className="w-full flex justify-center py-1">
                    <button
                      onClick={() => setIsManajemenExpanded(!isManajemenExpanded)}
                      className={`p-2 rounded-xl transition-colors ${
                        ["manajemen_pondok", "manajemen_sekolah", "pengguna"].includes(activeTab)
                          ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                          : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                      }`}
                      title="Plotting"
                    >
                      <Building2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                )}

                {/* Expanded Inline Submenu */}
                {!sidebarCollapsed && isManajemenExpanded && (
                  <div className="space-y-0.5 mt-0.5">
                    {accessibleTabs.filter(t => t.group === "PLOTTING").map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTab(sub.id as any)}
                          className={`w-full flex items-center justify-start px-3 py-2 gap-3 rounded-xl transition-all text-xs ${
                            isSubActive
                              ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed Flyout Popover */}
                {sidebarCollapsed && hoveredFlyout === "manajemen" && (
                  <div className="absolute left-full top-0 ml-2 z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      Plotting
                    </div>
                    {accessibleTabs.filter(t => t.group === "PLOTTING").map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTab(sub.id as any)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            isSubActive
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <SubIcon className="w-4 h-4 text-slate-400" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
          
          {/* Bottom actions: Theme Toggle & Logout */}
          <div className="flex flex-col gap-1 p-2.5 mt-auto shrink-0 border-t border-slate-200/70 dark:border-slate-800/70">
            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-full flex items-center transition-all rounded-xl ${
                sidebarCollapsed ? "justify-center py-2 px-2" : "justify-start px-3 py-2 gap-3"
              } text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50`}
              title={isDarkMode ? "Aktifkan Mode Siang" : "Aktifkan Mode Malam"}
            >
              <span className="w-4.5 h-4.5 flex items-center justify-center text-sm">
                {isDarkMode ? "☀️" : "🌙"}
              </span>
              {!sidebarCollapsed && <span className="truncate text-xs font-normal">{isDarkMode ? "Mode Siang" : "Mode Malam"}</span>}
            </button>

            {/* Logout */}
            <button
              onClick={() => {
                localStorage.removeItem("admin_token");
                localStorage.removeItem("admin_user");
                setCurrentUser(null);
                triggerNotification("Berhasil keluar dari sesi admin", "warning");
              }}
              className={`w-full flex items-center transition-all rounded-xl ${
                sidebarCollapsed ? "justify-center py-2 px-2" : "justify-start px-3 py-2 gap-3"
              } text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400`}
              title="Logout"
            >
              <LogOut className="w-4.5 h-4.5 shrink-0 transition-colors" />
              {!sidebarCollapsed && <span className="truncate text-xs font-normal">Keluar Sesi</span>}
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 bg-slate-50 dark:bg-[#0b0f19] overflow-y-auto flex flex-col" id="santri-sub-pages">
          
          {/* Top Header Banner with Search Bar & Round Profile Avatar */}
          <header className="bg-white dark:bg-[#111827] border-b border-slate-200/80 dark:border-slate-800 px-4 md:px-8 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs transition-colors duration-300">
            {/* Left: Mobile menu toggle + Search Bar */}
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <button 
                className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl outline-none transition-colors cursor-pointer"
                onClick={() => setMobileMenuOpen(true)}
                title="Buka Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Search Bar Input Column */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari..."
                  value={sidebarSearchQuery}
                  onChange={(e) => setSidebarSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-full text-xs font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                {sidebarSearchQuery && (
                  <button
                    onClick={() => setSidebarSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Right: DB status, Theme switcher, Bell Icon, Round Profile Avatar */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {/* Database Connection Pill */}
              <button
                onClick={() => setIsDbConfigModalOpen(true)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider shadow-2xs transition-all border outline-none cursor-pointer ${
                  dbStatus === "connected"
                    ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : dbStatus === "loading"
                    ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20"
                }`}
                title="Klik untuk konfigurasi database Supabase"
              >
                <span className={`w-2 h-2 rounded-full ${
                  dbStatus === "connected"
                    ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                    : dbStatus === "loading"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                }`} />
                <span>{dbStatus === "connected" ? "Terhubung" : dbStatus === "loading" ? "Koneksi..." : "Offline"}</span>
              </button>

              {/* Day/Night Mode Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer text-sm shadow-2xs"
                title={isDarkMode ? "Aktifkan Mode Siang" : "Aktifkan Mode Malam"}
              >
                {isDarkMode ? "☀️" : "🌙"}
              </button>

              {/* Notification Bell */}
              <button
                onClick={() => triggerNotification("Sistem berjalan normal", "success")}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer relative shadow-2xs"
                title="Notifikasi"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              </button>

              {/* Round Profile Avatar Circle (Samping kanan atas) */}
              <div className="relative group">
                <button
                  type="button"
                  className="w-9 h-9 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs flex items-center justify-center shadow-xs hover:scale-105 transition-transform cursor-pointer border border-slate-300 dark:border-slate-700"
                  title={currentUser?.name || "Profil User"}
                >
                  {getInitials(currentUser?.name)}
                </button>

                {/* Profile Card Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                  <div className="flex items-center gap-3 pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {getInitials(currentUser?.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {currentUser?.name || "Administrator"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 capitalize truncate mt-0.5">
                        {currentUser?.role?.replace('_', ' ') || "Admin"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.removeItem("admin_token");
                      localStorage.removeItem("admin_user");
                      setCurrentUser(null);
                      triggerNotification("Berhasil keluar dari sesi admin", "warning");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Sesi</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Inner Content Area */}
          <div className={`flex-1 w-full flex flex-col ${activeTab === 'dashboard' ? '' : 'p-4 pb-20 md:p-6'}`}>
            {/* Offline warning banner */}
            {dbStatus !== "connected" && (
              <div className={`mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-400 leading-tight flex items-center justify-between gap-4 ${activeTab === 'dashboard' ? 'mx-4 mt-4 md:mx-6 md:mt-6' : ''}`}>
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>
                    <strong>Mode Offline Aktif:</strong> Database belum terhubung ({dbErrorMsg || "Mencoba menghubungkan..."}). Data disimpan lokal di browser ini.
                  </span>
                </div>
                <button
                  onClick={() => setIsDbConfigModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer uppercase tracking-wider"
                >
                  Atur Koneksi Database
                </button>
              </div>
            )}

          {/* Current Router Outlet */}
          <div className="flex-1 w-full flex flex-col">
            <ErrorBoundary key={activeTab}>
            {activeTab === "dashboard" && userRole === "guru_sekolah" && (
              <DashboardGuruSekolah
                students={displayedStudents}
                onNavigateToForm={() => {
                  setEditingStudent(null);
                  setActiveTab("form");
                }}
                onNavigateToList={(filters) => {
                  setListFilters(filters || {});
                  setActiveTab("list");
                }}
                onNavigateToAbsensiGuru={() => setActiveTab("absensi_guru")}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
                currentUser={currentUser}
                onLogout={() => {
                  localStorage.removeItem("admin_token");
                  localStorage.removeItem("admin_user");
                  setCurrentUser(null);
                  triggerNotification("Berhasil keluar dari sesi admin", "warning");
                }}
              />
            )}

            {activeTab === "dashboard" && userRole === "guru_pondok" && (
              <DashboardGuruPondok
                students={displayedStudents}
                onNavigateToForm={() => {
                  setEditingStudent(null);
                  setActiveTab("form");
                }}
                onNavigateToList={(filters) => {
                  setListFilters(filters || {});
                  setActiveTab("list");
                }}
                onNavigateToAbsensiGuru={() => setActiveTab("absensi_guru")}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
                currentUser={currentUser}
                onLogout={() => {
                  localStorage.removeItem("admin_token");
                  localStorage.removeItem("admin_user");
                  setCurrentUser(null);
                  triggerNotification("Berhasil keluar dari sesi admin", "warning");
                }}
              />
            )}

            {activeTab === "dashboard" && (userRole === "admin" || userRole === "pengurus") && (
              <Dashboard
                students={displayedStudents}
                onNavigateToForm={() => {
                  setEditingStudent(null);
                  setActiveTab("form");
                }}
                onNavigateToList={(filters) => {
                  setListFilters(filters || {});
                  setActiveTab("list");
                }}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
                currentUser={currentUser}
                onLogout={() => {
                  localStorage.removeItem("admin_token");
                  localStorage.removeItem("admin_user");
                  setCurrentUser(null);
                  triggerNotification("Berhasil keluar dari sesi admin", "warning");
                }}
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
                  students={displayedStudents}
                  onCancel={() => {
                    setEditingStudent(null);
                    setListFilters({});
                    setActiveTab("list");
                  }}
                />
              </div>
            )}

            {activeTab === "list" && (
              <SantriList
                students={displayedStudents}
                onEdit={handleTriggerEdit}
                onDelete={handleDeleteStudent}
                onUpdateStatus={handleUpdateStudentStatus}
                initialFilterCategory={listFilters.category || "All"}
                initialFilterStatus={listFilters.status || "All"}
                currentUserRole={userRole}
              />
            )}

            {activeTab === "warga_guru" && (
              <div className="w-full">
                <DaftarWargaPanel
                  viewType="guru"
                  onSwitchType={(type) => setActiveTab(type === "guru" ? "warga_guru" : "warga_pengurus")}
                  onNavigateToUserManagement={userRole === "admin" ? () => setActiveTab("pengguna") : undefined}
                />
              </div>
            )}

            {activeTab === "warga_pengurus" && (
              <div className="w-full">
                <DaftarWargaPanel
                  viewType="pengurus"
                  onSwitchType={(type) => setActiveTab(type === "guru" ? "warga_guru" : "warga_pengurus")}
                  onNavigateToUserManagement={userRole === "admin" ? () => setActiveTab("pengguna") : undefined}
                />
              </div>
            )}

            {activeTab === "warga_mutasi" && (
              <div className="w-full">
                <SiswaLulusMutasiPanel
                  viewMode="mutasi"
                  onSwitchMode={(mode) => setActiveTab(mode === "lulus" ? "warga_lulus" : "warga_mutasi")}
                  activeStudents={displayedStudents}
                  onDataChanged={checkConnectionAndLoad}
                />
              </div>
            )}

            {activeTab === "warga_lulus" && (
              <div className="w-full">
                <SiswaLulusMutasiPanel
                  viewMode="lulus"
                  onSwitchMode={(mode) => setActiveTab(mode === "lulus" ? "warga_lulus" : "warga_mutasi")}
                  activeStudents={displayedStudents}
                  onDataChanged={checkConnectionAndLoad}
                />
              </div>
            )}

            {activeTab === "perizinan" && (
              <div className="w-full">
                <PerizinanPanel
                  students={displayedStudents}
                  rooms={rooms}
                  onRefreshAll={checkConnectionAndLoad}
                  onTriggerNotification={triggerNotification}
                />
              </div>
            )}

            {activeTab === "absensi" && (
              <div className="w-full">
                <PresensiPanel students={displayedStudents} rooms={rooms} viewMode="absensi" />
              </div>
            )}

            {activeTab === "rekap_presensi" && (
              <div className="w-full">
                <PresensiPanel students={displayedStudents} rooms={rooms} viewMode="rekap" />
              </div>
            )}

            {activeTab === "absensi_guru" && (
              <div className="w-full">
                <AbsensiGuruPanel currentUser={currentUser} />
              </div>
            )}

            {activeTab === "manajemen_pondok" && (
              <div className="w-full">
                <ManajemenPondokPanel
                  students={displayedStudents}
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

            {activeTab === "manajemen_sekolah" && (
              <div className="w-full">
                <ManajemenSekolahPanel
                  students={displayedStudents}
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
                  students={displayedStudents}
                  rooms={rooms}
                  onUpdateNfc={handleUpdateStudentNfc}
                  isDarkMode={isDarkMode}
                />
              </div>
            )}

            {(activeTab === "pelanggaran_input" || activeTab === "pelanggaran_rekap") && (
              <div className="w-full">
                <PelanggaranPanel
                  viewMode={activeTab === "pelanggaran_input" ? "input" : "rekap"}
                  onSwitchMode={(mode) => setActiveTab(mode === "input" ? "pelanggaran_input" : "pelanggaran_rekap")}
                  students={displayedStudents}
                  rooms={rooms}
                  schoolClasses={schoolClasses}
                  recitationClasses={recitationClasses}
                  triggerNotification={triggerNotification}
                  currentUser={currentUser}
                />
              </div>
            )}


            {activeTab === "pengguna" && (
              <div className="w-full max-w-6xl mx-auto h-full overflow-y-auto pr-2 custom-scrollbar pb-24">
                <ManajemenPenggunaPanel />
              </div>
            )}
            </ErrorBoundary>
          </div>
          </div>
          
        </section>
        
        {/* Navigation Sidebar (Mobile view - Off-canvas overlay) */}
        <div 
          className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Backdrop */}
          <div 
            className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${
              mobileMenuOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Sidebar Panel */}
          <div 
            className={`absolute top-0 left-0 bottom-0 w-[270px] bg-[#f8fafc] dark:bg-[#0b0f19] shadow-2xl flex flex-col transition-transform duration-300 ${
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Mobile Header */}
            <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs p-1 flex items-center justify-center">
                  <img
                    src="https://eflhcunxpckcynozywol.supabase.co/storage/v1/object/public/foto_siswa/1779791263491_pbf19o.png"
                    alt="Logo Pondok"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-slate-100">Generus</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg outline-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1 custom-scrollbar">
              {/* Standalone Main Menus */}
              {accessibleTabs
                .filter(t => t.group === "UTAMA")
                .map(tab => {
                  const TabIcon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (tab.id !== "form") setEditingStudent(null);
                        setActiveTab(tab.id as any);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-xs ${
                        isActive
                          ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <TabIcon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}

              {/* DATA WARGA GROUP */}
              {accessibleTabs.some(t => t.group === "DATA WARGA") && (
                <div className="pt-1.5">
                  <div
                    onClick={() => setMobileDataWargaOpen(!mobileDataWargaOpen)}
                    className="px-3 pt-2 pb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none transition-colors"
                  >
                    <span>Data Warga</span>
                    {mobileDataWargaOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>

                  {mobileDataWargaOpen && (
                    <div className="space-y-0.5 mt-0.5">
                      {accessibleTabs.filter(t => t.group === "DATA WARGA").map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = activeTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              if (sub.id === "list") setListFilters({});
                              setActiveTab(sub.id as any);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs ${
                              isSubActive
                                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* PELANGGARAN GROUP */}
              {accessibleTabs.some(t => t.group === "PELANGGARAN") && (
                <div className="pt-1.5">
                  <div
                    onClick={() => setMobilePelanggaranOpen(!mobilePelanggaranOpen)}
                    className="px-3 pt-2 pb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none transition-colors"
                  >
                    <span>Pelanggaran</span>
                    {mobilePelanggaranOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>

                  {mobilePelanggaranOpen && (
                    <div className="space-y-0.5 mt-0.5">
                      {accessibleTabs.filter(t => t.group === "PELANGGARAN").map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = activeTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setActiveTab(sub.id as any);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs ${
                              isSubActive
                                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* PLOTTING GROUP */}
              {accessibleTabs.some(t => t.group === "PLOTTING") && (
                <div className="pt-1.5">
                  <div
                    onClick={() => setIsManajemenExpanded(!isManajemenExpanded)}
                    className="px-3 pt-2 pb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none transition-colors"
                  >
                    <span>Plotting</span>
                    {isManajemenExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>

                  {isManajemenExpanded && (
                    <div className="space-y-0.5 mt-0.5">
                      {accessibleTabs.filter(t => t.group === "PLOTTING").map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = activeTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setActiveTab(sub.id as any);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs ${
                              isSubActive
                                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Sidebar Footer */}
            <div className="flex flex-col gap-1 p-2.5 mt-auto shrink-0 border-t border-slate-200/80 dark:border-slate-800">
              {/* Theme Toggle */}
              <button
                onClick={() => {
                  setIsDarkMode(!isDarkMode);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all text-xs"
              >
                <span className="w-4.5 h-4.5 flex items-center justify-center text-sm">
                  {isDarkMode ? "☀️" : "🌙"}
                </span>
                <span className="truncate">{isDarkMode ? "Mode Siang" : "Mode Malam"}</span>
              </button>

              {/* Logout */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  localStorage.removeItem("admin_token");
                  localStorage.removeItem("admin_user");
                  setCurrentUser(null);
                  triggerNotification("Berhasil keluar dari sesi admin", "warning");
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all text-xs"
              >
                <LogOut className="w-4.5 h-4.5 shrink-0" />
                <span className="truncate">Keluar Sesi</span>
              </button>
            </div>
          </div>
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
