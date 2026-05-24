import React, { useState, useEffect } from "react";
import { supabase, SantriData, TABLE_NAME, formatSantriData } from "./supabaseClient";
import RegistrationForm from "./components/RegistrationForm";
import SantriList from "./components/SantriList";
import Dashboard from "./components/Dashboard";
import DatabaseSetupHelper from "./components/DatabaseSetupHelper";
import ManagementPanel from "./components/ManagementPanel";
import PresensiPanel from "./components/PresensiPanel";
import { LayoutDashboard, UserPlus, Database, TableProperties, Sliders, AlertCircle, CheckCircle, Info, RefreshCw, Star, ChevronLeft, ChevronRight, ClipboardList, Moon, Utensils } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"dashboard" | "form" | "list" | "setup" | "management" | "presensi_sholat" | "presensi_doa_malam" | "presensi_makan">("dashboard");
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
    const defaults = ["Kamar Al-Fatih", "Kamar Sultan Agung", "Kamar Gajah Mada", "Kamar Diponegoro"];
    return parsed.filter((item: string) => !defaults.includes(item));
  });

  const [recitationClasses, setRecitationClasses] = useState<string[]>(() => {
    const saved = localStorage.getItem("manajemen_recitation_classes");
    const parsed = saved ? JSON.parse(saved) : [];
    const defaults = ["Kelas Al-Quran Pemula", "Kelas Tajwid & Makhraj", "Kelas Tahfidz Juz 30", "Kelas Kitab Fathul Qorib", "Kelas Hadits Arbain"];
    return parsed.filter((item: string) => !defaults.includes(item));
  });

  const [schoolClasses, setSchoolClasses] = useState<string[]>(() => {
    const saved = localStorage.getItem("manajemen_school_classes");
    const parsed = saved ? JSON.parse(saved) : [];
    const defaults = [
      "Kelas VII-A SMP",
      "Kelas VII-B SMP",
      "Kelas VIII SMP",
      "Kelas IX SMP",
      "Kelas X-MIPA SMA",
      "Kelas XI-IPS SMA",
      "Kelas XII SMA"
    ];
    return parsed.filter((item: string) => !defaults.includes(item));
  });

  const [metadataMap, setMetadataMap] = useState<Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: string }>>(() => {
    const saved = localStorage.getItem("santri_custom_metadata_map");
    return saved ? JSON.parse(saved) : {};
  });

  // Helper to hydrate students with local status overrides
  const hydrateStudentsWithStatus = (list: SantriData[]): SantriData[] => {
    const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
    return list.map((s) => {
      const formatted = formatSantriData(s);
      return {
        ...formatted,
        status: savedStatusMap[s.id || s.nik] || s.status || "Aktif"
      };
    });
  };

  const handleAssignMetadata = (nik: string, key: "kamar" | "kelas_sekolah" | "kelas_pengajian", value: string) => {
    const updated = {
      ...metadataMap,
      [nik]: {
        ...(metadataMap[nik] || {}),
        [key]: value
      }
    };
    setMetadataMap(updated);
    localStorage.setItem("santri_custom_metadata_map", JSON.stringify(updated));
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
        const formattedList = hydrateStudentsWithStatus(data || []);
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

  // Refresh data on load
  useEffect(() => {
    checkConnectionAndLoad();
  }, []);

  // Save or Update a Santri
  const handleFormSubmit = async (data: SantriData): Promise<{ success: boolean; error?: string }> => {
    setIsFormSubmitting(true);
    try {
      const formattedData = formatSantriData(data);
      // Clean undefined fields to keep Supabase happy
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
        status: formattedData.status || "Aktif",
        jenis_kelamin: formattedData.jenis_kelamin || "L",
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
          const { error } = await supabase
            .from(TABLE_NAME)
            .update(payload)
            .eq("id", editingStudent.id);

          if (error) throw error;
          
          triggerNotification(`Berhasil memperbarui data santri ${formattedData.nama_lengkap}!`, "success");
        } else {
          const { error } = await supabase
            .from(TABLE_NAME)
            .insert([payload]);

          if (error) throw error;
          triggerNotification(`Santri baru ${formattedData.nama_lengkap} berhasil terdaftarkan ke cloud database!`, "success");
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

      // 3. Try to update status column in supabase if connected
      if (dbStatus === "connected") {
        const queryField = typeof studentIdOrNik === "number" ? "id" : "nik";
        const { error } = await supabase
          .from(TABLE_NAME)
          .update({ status: newStatus })
          .eq(queryField, studentIdOrNik);

        if (error) {
          console.warn("Supabase update error (probably status column missing in your DB):", error.message);
        } else {
          triggerNotification(`Status diperbarui ke "${newStatus}" di Cloud Database`, "success");
          return;
        }
      }
      triggerNotification(`Status diperbarui ke "${newStatus}"`, "success");
    } catch (e: any) {
      console.error("Status update error:", e);
      triggerNotification(`Status diperbarui menjadi "${newStatus}"`, "success");
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

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden select-none" id="boarding_school_app">
      
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
      <header className="h-14 bg-[#91d1fa] text-[#041e49] flex items-center justify-between px-6 shrink-0 shadow-sm border-b border-[#73baeb]/60 z-40 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#041e49]/10 rounded flex items-center justify-center font-bold text-sm tracking-tighter text-[#041e49]">PP</div>
          <div className="flex flex-col">
            <h1 className="text-sm md:text-base font-bold tracking-tight uppercase leading-none text-[#041e49]">Pondok Pesantren Al-Muttaqin</h1>
            <span className="text-[9px] text-[#041e49]/85 tracking-wider font-mono mt-0.5 uppercase leading-none">Kota Madiun</span>
          </div>
        </div>
      </header>

      {/* 3. MAIN CONTAINER WITH SIDEBAR & CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row relative">
        
        {/* Navigation Sidebar (Desktop view) */}
        <aside 
          className={`${sidebarCollapsed ? "w-16" : "w-60"} bg-[#f0f4f9] border-r border-[#dee4ec] flex flex-col p-0 shrink-0 hidden md:flex transition-all duration-300 overflow-hidden shadow-sm`} 
          id="desktop-sidebar"
        >
          {/* Header area of Sidebar with Hamburger Toggle Button ☰ */}
          <div className={`p-3 bg-[#e9eef6]/50 flex ${sidebarCollapsed ? "justify-center" : "justify-end px-5"} border-b border-[#dee4ec]/60 shrink-0`}>
            <button
              onClick={() => {
                const nextVal = !sidebarCollapsed;
                setSidebarCollapsed(nextVal);
                localStorage.setItem("sidebar_collapsed", String(nextVal));
              }}
              className="p-1.5 bg-white border border-[#dee4ec] shadow-sm rounded-lg hover:bg-[#e1e9f5] text-[#041e49] transition-all cursor-pointer w-8 h-8 flex items-center justify-center select-none"
              title={sidebarCollapsed ? "Buka Sidebar" : "Sembunyikan Sidebar"}
            >
              <span className="text-sm font-black">☰</span>
            </button>
          </div>

          {/* Navigation links - Akkhor custom layout with chevrons on right */}
          <nav className="flex-1 py-3 text-xs select-none">
            {!sidebarCollapsed && (
              <div className="text-[10px] font-black text-[#5f6368] uppercase tracking-widest my-2 px-6">Menu Utama</div>
            )}
            <div className="flex flex-col">
              {[
                { id: "dashboard", label: "Dasbor Ringkasan", icon: LayoutDashboard },
                { id: "list", label: "Database Santri", icon: TableProperties },
                { id: "presensi_sholat", label: "Presensi Sholat", icon: ClipboardList },
                { id: "presensi_doa_malam", label: "Presensi Doa Malam", icon: Moon },
                { id: "presensi_makan", label: "Presensi Makan", icon: Utensils },
                { id: "form", label: editingStudent ? "Edit Santri" : "Pendaftaran Baru", icon: UserPlus },
                { id: "management", label: "Manajemen Unit", icon: Sliders },
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
                          ? "justify-center py-4 px-0 border-b border-[#dee4ec]/40" 
                          : "justify-between px-6 py-3.5 border-b border-[#dee4ec]/40"
                      } ${
                        isActive
                          ? "bg-[#c2e7ff] text-[#001d35] font-bold"
                          : "text-[#444746] hover:bg-[#e1e9f5]/60 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <TabIcon className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? "text-[#001d35] font-bold" : "text-slate-500"
                        }`} />
                        {!sidebarCollapsed && <span className="truncate tracking-wide text-xs">{tab.label}</span>}
                      </div>
                      
                      {/* Akkhor-style chevron on non-collapsed tabs */}
                      {!sidebarCollapsed && (
                        <ChevronRight className={`w-3.5 h-3.5 transition-all ${
                          isActive ? "text-[#001d35] translate-x-0.5" : "text-slate-400 opacity-60"
                        }`} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Bottom section with sync status inside Akkhor-style container */}
          <div className="p-4 border-t border-[#dee4ec] shrink-0">
            {!sidebarCollapsed ? (
              <div className="p-3 bg-white/60 border border-slate-200/85 rounded-2xl shadow-sm">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${dbStatus === "connected" ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`}></span>
                  SINKRONISASI
                </div>
                <div className="text-[10px] font-semibold font-mono text-[#444746] leading-tight select-all">
                  {dbStatus === "connected" ? "live_supabase_active" : "local_persisted_storage"}
                </div>
              </div>
            ) : (
              <div 
                className="flex justify-center" 
                title={dbStatus === "connected" ? "DB Status: Terhubung Online" : "DB Status: Lokal Backup"}
              >
                <span className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${dbStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`}></span>
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

            {activeTab === "presensi_sholat" && (
              <div className="w-full">
                <PresensiPanel students={students} activeMenu="sholat" />
              </div>
            )}

            {activeTab === "presensi_doa_malam" && (
              <div className="w-full">
                <PresensiPanel students={students} activeMenu="doa_malam" />
              </div>
            )}

            {activeTab === "presensi_makan" && (
              <div className="w-full">
                <PresensiPanel students={students} activeMenu="makan" />
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
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-slate-200 text-slate-600 flex overflow-x-auto whitespace-nowrap gap-1 px-2.5 py-1.5 select-none shadow-[0_-2px_10px_rgba(0,0,0,0.05)] scrollbar-none" id="mobile-navigation">
          {[
            { id: "dashboard", label: "Dasbor", icon: LayoutDashboard },
            { id: "list", label: "Database", icon: TableProperties },
            { id: "presensi_sholat", label: "Sholat", icon: ClipboardList },
            { id: "presensi_doa_malam", label: "Doa", icon: Moon },
            { id: "presensi_makan", label: "Makan", icon: Utensils },
            { id: "form", label: editingStudent ? "Edit" : "Daftar", icon: UserPlus },
            { id: "management", label: "Manajemen", icon: Sliders },
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
                  isActive ? "text-sky-600 bg-sky-50 font-black font-extrabold" : "text-slate-500 hover:text-slate-900"
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
