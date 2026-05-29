import React, { useState, useEffect } from "react";
import { SantriData, supabase } from "../supabaseClient";
import { 
  Calendar, 
  Search, 
  Clock, 
  Bell, 
  Smartphone, 
  Check, 
  Database, 
  ShieldAlert, 
  CheckCircle2, 
  Barcode, 
  Users, 
  ChevronRight, 
  Sliders, 
  Undo2,
  AlertTriangle,
  Info,
  Video
} from "lucide-react";

interface PresensiPanelProps {
  students: SantriData[];
  activeMenu: "sholat" | "doa_malam" | "makan";
}

type AttendanceStatus = "hadir" | "terlambat" | "sakit" | "izin" | "alpa" | "unmarked";
type PresensiType = "sholat" | "doa_malam" | "makan";

interface SessionInfo {
  id: string;
  label: string;
  time: string;
  icon: string;
}

function detectSession(timeStr: string, menuType: PresensiType): string {
  try {
    const [curHStr, curMStr] = timeStr.replace(":", ".").split(".");
    const h = Number(curHStr);
    const m = Number(curMStr || 0);
    const totalMinutes = h * 60 + m;

    if (menuType === "sholat") {
      // Sesi Sholat sesuai custom schedule:
      // Subuh: 04.00 - 05.00 (dialokasikan dari tengah malam s/d 08.15)
      if (totalMinutes < 8 * 60 + 15) {
        return "subuh";
      }
      // Dzuhur: 11.30 - 12.30 (dialokasikan dari 08.15 s/d 13.40)
      if (totalMinutes < 13 * 60 + 40) {
        return "dzuhur";
      }
      // Asar: 14.50 - 15.30 (dialokasikan dari 13.40 s/d 16.25)
      if (totalMinutes < 16 * 60 + 25) {
        return "asar";
      }
      // Maghrib: 17.20 - 18.00 (dialokasikan dari 16.25 s/d 18.20)
      if (totalMinutes < 18 * 60 + 20) {
        return "maghrib";
      }
      // Isya: 18.40 - 19.30 (dialokasikan dari 18.20 s/d akhir hari)
      return "isya";
    }

    if (menuType === "makan") {
      // pagi, siang, sore
      if (totalMinutes < 10 * 60) {
        return "pagi";
      }
      if (totalMinutes < 15 * 60) {
        return "siang";
      }
      return "sore";
    }

    if (menuType === "doa_malam") {
      return "doa_malam_sesi";
    }
  } catch (e) {
    // ignore
  }

  if (menuType === "sholat") return "subuh";
  if (menuType === "doa_malam") return "doa_malam_sesi";
  return "pagi";
}

export default function PresensiPanel({ students, activeMenu }: PresensiPanelProps) {
  // Configured date & type & viewMode
  const [viewMode, setViewMode] = useState<"selection" | "attendance">("attendance");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [activeSession, setActiveSession] = useState<string>(() => {
    const today = new Date();
    const h = String(today.getHours()).padStart(2, "0");
    const m = String(today.getMinutes()).padStart(2, "0");
    return detectSession(`${h}.${m}`, activeMenu);
  });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [roomFilter, setRoomFilter] = useState<string>("All");

  // Sub-tabs from the screenshot
  // PRESENSI (input), REKAP DATA (rekap), STATISTIK (statistik)
  const [attendanceSubTab, setAttendanceSubTab] = useState<"input" | "rekap" | "statistik">("input");
  
  // Rekap sub-filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Time & Simulator setup
  const [deviceTime, setDeviceTime] = useState(new Date());
  const [isSimulatingTime, setIsSimulatingTime] = useState(false);
  const [simulatedTimeVal, setSimulatedTimeVal] = useState("04.15"); // default HH.mm

  // Real NFC & Barcode camera states matching professional controls
  const [isNfcActive, setIsNfcActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showNfcErrorModal, setShowNfcErrorModal] = useState(false);
  const [isManualDate, setIsManualDate] = useState(false);
  const [rekapTimeframe, setRekapTimeframe] = useState<"harian" | "mingguan" | "bulanan">("harian");
  const [attendancePopup, setAttendancePopup] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    studentName?: string;
    studentPhoto?: string;
    isFemale?: boolean;
    reason?: "already_scanned" | "unregistered_card" | "custom_error";
    cardCode?: string;
    customMessage?: string;
  } | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const [scannerInputVal, setScannerInputVal] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // Load / Store records
  // Structure: { [key = `${date}_${type}_${session}`]: { [studentId]: "hadir" | "terlambat" | ... } }
  const [attendanceDb, setAttendanceDb] = useState<{ [key: string]: { [studentId: string]: AttendanceStatus } }>(() => {
    const saved = localStorage.getItem("santri_attendance_db");
    return saved ? JSON.parse(saved) : {};
  });

  // Load / Store Iqomah values
  const [iqomahDb, setIqomahDb] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem("santri_iqomah_db");
    return saved ? JSON.parse(saved) : {};
  });

  // Keep device time live
  useEffect(() => {
    const timer = setInterval(() => {
      setDeviceTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format simulated or device time
  const getActiveTimeStr = () => {
    if (isSimulatingTime) {
      return simulatedTimeVal;
    }
    const h = String(deviceTime.getHours()).padStart(2, "0");
    const m = String(deviceTime.getMinutes()).padStart(2, "0");
    return `${h}.${m}`;
  };

  const activeTimeStr = getActiveTimeStr();

  // Sessions configuration
  const sholatSessions: SessionInfo[] = [
    { id: "subuh", label: "Subuh", time: "04.00 - 05.00", icon: "🌅" },
    { id: "dzuhur", label: "Dzuhur", time: "11.30 - 12.30", icon: "☀️" },
    { id: "asar", label: "Asar", time: "14.50 - 15.30", icon: "🌤️" },
    { id: "maghrib", label: "Maghrib", time: "17.20 - 18.00", icon: "🌇" },
    { id: "isya", label: "Isya", time: "18.40 - 19.30", icon: "🌌" }
  ];

  const doaSessions: SessionInfo[] = [
    { id: "doa_malam_sesi", label: "Doa Malam", time: "03.30 - 04.15", icon: "🌌" }
  ];

  const makanSessions: SessionInfo[] = [
    { id: "pagi", label: "Pagi", time: "06.00 - 07.15", icon: "🍳" },
    { id: "siang", label: "Siang", time: "11.00 - 12.00", icon: "🍛" },
    { id: "sore", label: "Sore (Makan Sore)", time: "16.30 - 17.15", icon: "🍲" }
  ];

  const getSessions = (type: PresensiType): SessionInfo[] => {
    switch (type) {
      case "sholat": return sholatSessions;
      case "doa_malam": return doaSessions;
      case "makan": return makanSessions;
      default: return [];
    }
  };

  // Helper check if time in window
  const isTimeInWindow = (current: string, rangeStr: string): boolean => {
    try {
      const [startStr, endStr] = rangeStr.replace(/\s/g, "").split("-");
      const [curH, curM] = current.replace(":", ".").split(".").map(Number);
      const [startH, startM] = startStr.split(".").map(Number);
      const [endH, endM] = endStr.split(".").map(Number);

      const curVal = curH * 60 + curM;
      const startVal = startH * 60 + startM;
      const endVal = endH * 60 + endM;

      return curVal >= startVal && curVal <= endVal;
    } catch (e) {
      return false;
    }
  };

  // Auto-detect session on load/time change
  useEffect(() => {
    const session = detectSession(activeTimeStr, activeMenu);
    setActiveSession(session);
  }, [activeTimeStr, activeMenu]);

  // Keep date updated dynamically on clock update (automatic real-time synchronization)
  useEffect(() => {
    if (!isSimulatingTime && !isManualDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const currentFormattedDate = `${year}-${month}-${day}`;
      if (selectedDate !== currentFormattedDate) {
        setSelectedDate(currentFormattedDate);
      }
    }
  }, [deviceTime, isSimulatingTime, selectedDate, isManualDate]);

  // Target NFC hardware support detection
  const isNfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

  const isInsideTargetWindow = (timeStr: string, sessionId: string, menuType: PresensiType): boolean => {
    if (menuType !== "sholat") return true; 
    
    // Exact official sholat schedule limits requested by the user:
    const sessionRanges: { [key: string]: string } = {
      subuh: "04.00 - 05.00",
      dzuhur: "11.30 - 12.30",
      asar: "14.50 - 15.30",
      maghrib: "17.20 - 18.00",
      isya: "18.40 - 19.30"
    };

    const range = sessionRanges[sessionId];
    if (!range) return false;

    try {
      const [startStr, endStr] = range.replace(/\s/g, "").split("-");
      const [curH, curM] = timeStr.replace(":", ".").split(".").map(Number);
      const [startH, startM] = startStr.split(".").map(Number);
      const [endH, endM] = endStr.split(".").map(Number);

      const curVal = curH * 60 + curM;
      const startVal = startH * 60 + startM;
      const endVal = endH * 60 + endM;

      return curVal >= startVal && curVal <= endVal;
    } catch (e) {
      return false;
    }
  };

  const isSessionOpen = (activeMenu !== "sholat") || isInsideTargetWindow(activeTimeStr, activeSession, activeMenu);

  // Hook 1: Professional WebRTC Stream Handler
  useEffect(() => {
    if (isCameraActive && isSessionOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          setVideoStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Camera streaming turned off or permission was denied:", err);
        });
    } else {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      }
    }
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraActive, isSessionOpen]);

  // Hook 2: Real device NDEFReader Scanner binding (Enterprise RFC execution)
  useEffect(() => {
    if (!isNfcActive || !isSessionOpen || !isNfcSupported) return;

    let ndefReaderInstance: any = null;
    const startNfcScanning = async () => {
      try {
        const NDEFReaderClass = (window as any).NDEFReader;
        ndefReaderInstance = new NDEFReaderClass();
        await ndefReaderInstance.scan();
        
        ndefReaderInstance.onreading = (event: any) => {
          const tagSerial = event.serialNumber;
          executeScan(tagSerial, "nfc");
        };

        ndefReaderInstance.onreadingerror = () => {
          setScanFeedback({
            message: "⚠️ Gagal membaca Kartu NFC. Silakan arahkan kembali kartu Anda.",
            type: "error"
          });
        };
      } catch (err: any) {
        console.warn("NDEF NFC initialization failed:", err.message);
      }
    };

    startNfcScanning();
    return () => {
      // Automatic cleanup handled dynamically by device stack
    };
  }, [isNfcActive, isSessionOpen]);

  // Save DB
  const saveAttendance = (newDb: typeof attendanceDb) => {
    setAttendanceDb(newDb);
    localStorage.setItem("santri_attendance_db", JSON.stringify(newDb));
  };

  // State to track if Supabase Sync is active/working for presensi_santri
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<"connected" | "error" | "loading" | "disabled">("loading");
  const [isSyncing, setIsSyncing] = useState(false);

  // Synchronize dynamic attendance entries from Supabase
  const fetchAttendanceFromSupabase = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSupabaseSyncStatus("loading");

    try {
      let fetchedRows: any[] = [];

      if (activeMenu === "sholat") {
        const dateParts = selectedDate.split("-");
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);

        const localStart = new Date(year, month, day, 0, 0, 0, 0);
        const localEnd = new Date(year, month, day, 23, 59, 59, 999);

        const startIso = localStart.toISOString();
        const endIso = localEnd.toISOString();

        const { data, error } = await supabase
          .from("absen_sholat")
          .select("*")
          .gte("created_at", startIso)
          .lte("created_at", endIso);

        if (error) {
          if (error.code === "42P01") {
            setSupabaseSyncStatus("disabled");
            console.info("Table 'absen_sholat' does not exist yet. Using local storage.");
          } else {
            setSupabaseSyncStatus("error");
            console.warn("Supabase fetch absen_sholat error:", error.message);
          }
          setIsSyncing(false);
          return;
        }

        fetchedRows = (data || []).map((row: any) => ({
          nama: row.nama,
          sesi: row.sholat,
          status: row.kehadiran === "alpha" ? "alpha" : row.kehadiran === "telat" ? "telat" : row.kehadiran,
          tanggal: selectedDate,
          presensi: "sholat"
        }));
      } else {
        const formattedPresensi = activeMenu === "makan" ? "makan" : "doa_malam";
        const { data, error } = await supabase
          .from("presensi_santri")
          .select("*")
          .eq("tanggal", selectedDate)
          .eq("presensi", formattedPresensi);

        if (error) {
          if (error.code === "42P01") {
            setSupabaseSyncStatus("disabled");
            console.info("Table 'presensi_santri' does not exist yet. Using local storage.");
          } else {
            setSupabaseSyncStatus("error");
            console.warn("Supabase fetch error:", error.message);
          }
          setIsSyncing(false);
          return;
        }

        fetchedRows = data || [];
      }

      setSupabaseSyncStatus("connected");

      if (fetchedRows) {
        // Deep copy existing db
        const updatedDb = { ...attendanceDb };

        // We want to update only for this date/menu combinations to make sure we don't clear local data of other days.
        // Initialize keys empty to replace them accurately with supabase truth
        const sessionsForMenu = getSessions(activeMenu);
        sessionsForMenu.forEach((sess) => {
          const key = `${selectedDate}_${activeMenu}_${sess.id}`;
          updatedDb[key] = {};
        });

        fetchedRows.forEach((row: any) => {
          // Find student matching row name
          const matchedStudent = hydStudents.find(
            (s) => s.nama_lengkap.toLowerCase() === (row.nama || "").toLowerCase()
          );

          if (matchedStudent) {
            const studentId = String(matchedStudent.id);
            const rowSession = row.sesi || activeSession;
            const key = `${row.tanggal || selectedDate}_${row.presensi || activeMenu}_${rowSession}`;
            
            // Map remote statuses: 'telat' -> 'terlambat', 'alpha' -> 'alpa', others same
            let localStatus: AttendanceStatus = "unmarked";
            if (row.status === "telat") localStatus = "terlambat";
            else if (row.status === "alpha") localStatus = "alpa";
            else if (["hadir", "sakit", "izin", "alpa", "terlambat"].includes(row.status)) {
              localStatus = row.status as AttendanceStatus;
            } else if (row.status && row.status !== "unmarked") {
              localStatus = "hadir";
            }

            if (!updatedDb[key]) {
              updatedDb[key] = {};
            }
            updatedDb[key][studentId] = localStatus;
          }
        });

        setAttendanceDb(updatedDb);
        localStorage.setItem("santri_attendance_db", JSON.stringify(updatedDb));
      }
    } catch (e: any) {
      setSupabaseSyncStatus("error");
      console.error("Synchronize error:", e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncStudentStatusToSupabase = async (studentId: string, status: AttendanceStatus) => {
    const student = hydStudents.find(s => String(s.id) === studentId);
    if (!student) return;

    const formattedPresensi = activeMenu === "sholat" ? "sholat" : activeMenu === "makan" ? "makan" : "doa_malam";
    const formattedStatus = status === "terlambat" ? "telat" : status === "alpa" ? "alpha" : status;
    const studentKamar = student.kamar || "Belum Set";

    const dateParts = selectedDate.split("-");
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);

    const localStart = new Date(year, month, day, 0, 0, 0, 0);
    const localEnd = new Date(year, month, day, 23, 59, 59, 999);

    const startIso = localStart.toISOString();
    const endIso = localEnd.toISOString();

    try {
      if (activeMenu === "sholat") {
        // 1. Delete previous entry
        await supabase
          .from("absen_sholat")
          .delete()
          .eq("nama", student.nama_lengkap)
          .eq("sholat", activeSession)
          .gte("created_at", startIso)
          .lte("created_at", endIso);

        if (status === "unmarked") {
          return;
        }

        const localNow = new Date();
        const yearN = localNow.getFullYear();
        const monthN = String(localNow.getMonth() + 1).padStart(2, "0");
        const dayN = String(localNow.getDate()).padStart(2, "0");
        const todayStr = `${yearN}-${monthN}-${dayN}`;

        let createdAtStr = localNow.toISOString();
        if (selectedDate !== todayStr) {
          const backdate = new Date(year, month, day, 12, 0, 0, 0);
          createdAtStr = backdate.toISOString();
        }

        // 2. Insert new entry: id, created_at, sholat, nama, kamar, kehadiran
        const payload = {
          nama: student.nama_lengkap,
          sholat: activeSession,
          kamar: studentKamar,
          kehadiran: formattedStatus,
          created_at: createdAtStr
        };

        const { error } = await supabase
          .from("absen_sholat")
          .insert([payload]);

        if (error) {
          throw error;
        }
      } else {
        // 1. If status is unmarked, delete the matching entry
        if (status === "unmarked") {
          await supabase
            .from("presensi_santri")
            .delete()
            .eq("nama", student.nama_lengkap)
            .eq("tanggal", selectedDate)
            .eq("sesi", activeSession)
            .eq("presensi", formattedPresensi);
          return;
        }

        // 2. Otherwise/Check for updates: standard reliable delete-first then insert pattern:
        await supabase
          .from("presensi_santri")
          .delete()
          .eq("nama", student.nama_lengkap)
          .eq("tanggal", selectedDate)
          .eq("sesi", activeSession)
          .eq("presensi", formattedPresensi);

        // Now insert the fresh, updated record:
        const payload = {
          nama: student.nama_lengkap,
          kamar: studentKamar,
          presensi: formattedPresensi,
          status: formattedStatus,
          tanggal: selectedDate,
          sesi: activeSession,
          waktu: activeTimeStr.replace(".", ":")
        };

        const { error } = await supabase
          .from("presensi_santri")
          .insert([payload]);

        if (error) {
          console.warn("Retrying insert with core columns only:", error.message);
          const fallbackPayload = {
            nama: student.nama_lengkap,
            kamar: studentKamar,
            presensi: formattedPresensi,
            status: formattedStatus
          };
          const { error: fallbackError } = await supabase
            .from("presensi_santri")
            .insert([fallbackPayload]);

          if (fallbackError) {
            throw fallbackError;
          }
        }
      }
      setSupabaseSyncStatus("connected");
    } catch (err: any) {
      console.warn("Supabase Write Sync Fail:", err.message);
    }
  };

  const updateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    const dbKey = `${selectedDate}_${activeMenu}_${activeSession}`;
    const currentSessionRecords = attendanceDb[dbKey] || {};
    
    const newDb = {
      ...attendanceDb,
      [dbKey]: {
        ...currentSessionRecords,
        [studentId]: status
      }
    };
    saveAttendance(newDb);

    // Asynchronously synchronize this status to Supabase in the background!
    syncStudentStatusToSupabase(studentId, status);
  };

  // Real-time synchronization trigger
  useEffect(() => {
    if (hydStudents && hydStudents.length > 0) {
      fetchAttendanceFromSupabase();
    }
  }, [selectedDate, activeMenu, students]);

  const toggleIqomah = () => {
    const dbKey = `${selectedDate}_${activeMenu}_${activeSession}`;
    const currentStatus = iqomahDb[dbKey] || false;
    const newDb = {
      ...iqomahDb,
      [dbKey]: !currentStatus
    };
    setIqomahDb(newDb);
    localStorage.setItem("santri_iqomah_db", JSON.stringify(newDb));

    setScanFeedback({
      message: !currentStatus 
        ? "🔔 Status Iqomah diaktifkan! Siswa masuk setelah ini dicatat terlambat otomatis."
        : "🔄 Status Iqomah dinonaktifkan kembali.",
      type: "warning"
    });
  };

  // Helper: check current status
  const getStatus = (studentId: string | number | undefined): AttendanceStatus => {
    if (!studentId) return "unmarked";
    const dbKey = `${selectedDate}_${activeMenu}_${activeSession}`;
    const sessionRecords = attendanceDb[dbKey];
    if (!sessionRecords) return "unmarked";
    return sessionRecords[String(studentId)] || "unmarked";
  };

  // Hydrate students
  const hydStudents = students.map((s) => {
    const fallbackNfc = `Nfc-${String(s.nama_panggilan || "santri").toLowerCase()}-${String(s.nik || s.id).slice(-4)}`;
    return {
      ...s,
      nfc_id: s.nfc_id || fallbackNfc
    };
  });

  // Unique classes/rooms list
  const uniqueRooms = Array.from(
    new Set(hydStudents.map((s) => s.kamar).filter(Boolean))
  ) as string[];

  // Get student room label
  const getStudentClassLabel = (student: SantriData) => {
    return student.kamar || "Belum Set";
  };

  // Fetch initial avatar color based on name
  const getAvatarColorClass = (name: string) => {
    const colors = [
      "bg-indigo-50 border-indigo-150 text-indigo-600",
      "bg-blue-50 border-blue-150 text-blue-600",
      "bg-sky-50 border-sky-150 text-sky-600",
      "bg-violet-50 border-violet-150 text-violet-600",
      "bg-emerald-50 border-emerald-150 text-emerald-600"
    ];
    const charCodeSum = Array.from(name || "").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  // Filter students based on category filter, room filter, and search
  const displayedStudents = hydStudents.filter((s) => {
    const matchesSearch = 
      String(s.nama_lengkap || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.nama_panggilan || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.nik || "").includes(searchQuery) ||
      (s.kamar && s.kamar.toLowerCase().includes(searchQuery.toLowerCase()));

    // Map Category (SMP/SMA/Reguler) or "All"
    const matchesCategory = categoryFilter === "All" || s.kategori === categoryFilter;
    const matchesRoom = roomFilter === "All" || s.kamar === roomFilter;

    return matchesSearch && matchesCategory && matchesRoom;
  });

  // Students pending vs completed
  const studentsPending = displayedStudents.filter(s => getStatus(s.id) === "unmarked");
  const studentsCompleted = displayedStudents.filter(s => getStatus(s.id) !== "unmarked");

  // Filter students for the rekap view
  const rekapFilteredStudents = displayedStudents.filter((student) => {
    if (statusFilter === "all") return true;
    const sStatus = getStatus(student.id);
    return sStatus === statusFilter;
  });

  // Stats
  const dbKey = `${selectedDate}_${activeMenu}_${activeSession}`;
  const isIqomahActive = iqomahDb[dbKey] || false;

  const stats = (() => {
    let hadir = 0;
    let terlambat = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;
    let unmarked = 0;

    displayedStudents.forEach((student) => {
      const status = getStatus(student.id);
      if (status === "hadir") hadir++;
      else if (status === "terlambat") terlambat++;
      else if (status === "sakit") sakit++;
      else if (status === "izin") izin++;
      else if (status === "alpa") alpa++;
      else unmarked++;
    });

    const total = displayedStudents.length;
    const markedCount = total - unmarked;
    const percentPresent = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;

    return { hadir, terlambat, sakit, izin, alpa, unmarked, total, markedCount, percentPresent };
  })();

  const activeSessionObj = getSessions(activeMenu).find(s => s.id === activeSession) || getSessions(activeMenu)[0];

  // Helper to infer gender if not explicitly set
  const inferGenderFallback = (name: string): "L" | "P" => {
    const lowercase = name.toLowerCase();
    const femaleKeywords = [
      "siti", "putri", "dewi", "aisyah", "fatimah", "nur", "safitri", "zeri", "berliana", 
      "regita", "qurota", "melati", "ayu", "indah", "sari", "dwi", "anisa", "khofifah", 
      "rahma", "nayla", "zahra", "intan", "cantika", "kartika", "nita", "novi", "elisa", 
      "fadhilah", "mutia", "latifah", "hasanah", "kencana", "regita", "fitri"
    ];
    for (const kw of femaleKeywords) {
      if (lowercase.includes(kw)) {
        return "P";
      }
    }
    return "L";
  };

  // Execute Simulator Scan
  const executeScan = (inputStr: string, type: "nfc" | "barcode") => {
    if (!isSessionOpen) {
      setAttendancePopup({
        isOpen: true,
        type: "error",
        reason: "custom_error",
        customMessage: `Absensi ditutup! Sesi sholat ${activeSessionObj?.label} hanya diterima pukul ${activeSessionObj?.time}.`
      });
      return;
    }

    const cleanStr = inputStr.trim();
    if (!cleanStr) return;

    let matched: typeof hydStudents[0] | undefined = undefined;

    if (type === "nfc") {
      matched = hydStudents.find(s => s.nfc_id.toLowerCase() === cleanStr.toLowerCase());
    } else {
      matched = hydStudents.find(s => 
         String(s.nama_lengkap || "").toLowerCase() === cleanStr.toLowerCase() ||
         String(s.nama_panggilan || "").toLowerCase() === cleanStr.toLowerCase() ||
         String(s.nik || "") === cleanStr ||
         (s.nisn && String(s.nisn) === cleanStr)
      );
    }

    if (matched) {
      const sId = String(matched.id || "");
      const sStatus = getStatus(matched.id);

      if (sStatus === "unmarked") {
        const finalStatus: AttendanceStatus = (activeMenu === "sholat" && isIqomahActive) 
          ? "terlambat" 
          : "hadir";

        updateStudentStatus(sId, finalStatus);
        
        setAttendancePopup({
          isOpen: true,
          type: "success",
          studentName: matched.nama_lengkap,
          studentPhoto: matched.foto,
          isFemale: (matched.jenis_kelamin || inferGenderFallback(matched.nama_lengkap)) === "P"
        });

        setScanFeedback({
          message: `✔️ Berhasil scan ${type === "nfc" ? "NFC KARTU" : "BARCODE"}: ${matched.nama_lengkap} dicatat sebagai ${finalStatus.toUpperCase()}!`,
          type: "success"
        });
      } else {
        // Double attendance scan error popup!
        setAttendancePopup({
          isOpen: true,
          type: "error",
          reason: "already_scanned",
          studentName: matched.nama_lengkap,
          studentPhoto: matched.foto,
          isFemale: (matched.jenis_kelamin || inferGenderFallback(matched.nama_lengkap)) === "P"
        });

        setScanFeedback({
          message: `⚠️ Siswa ${matched.nama_lengkap} sudah terdaftar mengikut sesi ini.`,
          type: "warning"
        });
      }
      setScannerInputVal("");
    } else {
      // Unregistered card error popup!
      setAttendancePopup({
        isOpen: true,
        type: "error",
        reason: "unregistered_card",
        cardCode: cleanStr
      });

      setScanFeedback({
        message: `❌ ${type === "nfc" ? "Kartu NFC" : "Barcode"} "${cleanStr}" tidak terdaftar di database!`,
        type: "error"
      });
    }
  };

  useEffect(() => {
    if (scanFeedback) {
      const timer = setTimeout(() => {
        setScanFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [scanFeedback]);

  // Hook 5: Success Toast automatic 1.2s modal dismissal
  useEffect(() => {
    if (attendancePopup?.isOpen && attendancePopup.type === "success") {
      const timer = setTimeout(() => {
        setAttendancePopup(null);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [attendancePopup]);

  // Handle student item row click
  const handleToggleRowAttendance = (studentId: string | number) => {
    if (!isSessionOpen) {
      setAttendancePopup({
        isOpen: true,
        type: "error",
        reason: "custom_error",
        customMessage: `Absensi ditutup! Sesi sholat ${activeSessionObj?.label} hanya diterima pukul ${activeSessionObj?.time}.`
      });
      return;
    }

    const sId = String(studentId);
    const firstStatus = getStatus(studentId);
    const studentObj = hydStudents.find(s => String(s.id) === sId);

    if (!studentObj) return;

    if (firstStatus === "unmarked") {
      // Toggle to present (or late if iqomah)
      const finalStatus: AttendanceStatus = (activeMenu === "sholat" && isIqomahActive) 
        ? "terlambat" 
        : "hadir";
      updateStudentStatus(sId, finalStatus);

      setAttendancePopup({
        isOpen: true,
        type: "success",
        studentName: studentObj.nama_lengkap,
        studentPhoto: studentObj.foto,
        isFemale: (studentObj.jenis_kelamin || inferGenderFallback(studentObj.nama_lengkap)) === "P"
      });
    } else {
      // Already marked: Show Double Attendance/Already Scanned Popup
      setAttendancePopup({
        isOpen: true,
        type: "error",
        reason: "already_scanned",
        studentName: studentObj.nama_lengkap,
        studentPhoto: studentObj.foto,
        isFemale: (studentObj.jenis_kelamin || inferGenderFallback(studentObj.nama_lengkap)) === "P"
      });
    }
  };

  // Helper to format Date string to indonesian
  const formatIndoDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const formatIndoMonth = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const getWeekRange = (dateStr: string) => {
    const current = new Date(dateStr);
    const day = current.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diffToMonday));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
  };

  const getPassedSessions = (menuType: PresensiType, dateStr: string): string[] => {
    const sessions = getSessions(menuType);
    
    // Get formatted today date from deviceTime
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    if (dateStr < todayStr) {
      // In the past, all sessions are considered passed
      return sessions.map(s => s.id);
    } else if (dateStr > todayStr) {
      // In the future, no sessions are passed
      return [];
    } else {
      // Target is today. Determine based on current time on simulated or device clock
      const currentH = deviceTime.getHours();
      const currentM = deviceTime.getMinutes();
      const totalMinutes = currentH * 60 + currentM;

      if (menuType === "sholat") {
        const passedIds: string[] = ["subuh"];
        if (totalMinutes >= 8 * 60 + 15) {
          passedIds.push("dzuhur");
        }
        if (totalMinutes >= 13 * 60 + 40) {
          passedIds.push("asar");
        }
        if (totalMinutes >= 16 * 60 + 25) {
          passedIds.push("maghrib");
        }
        if (totalMinutes >= 18 * 60 + 20) {
          passedIds.push("isya");
        }
        return passedIds;
      } else if (menuType === "makan") {
        const passedIds: string[] = ["pagi"];
        if (totalMinutes >= 10 * 60) {
          passedIds.push("siang");
        }
        if (totalMinutes >= 15 * 60) {
          passedIds.push("sore");
        }
        return passedIds;
      } else if (menuType === "doa_malam") {
        return ["doa_malam_sesi"];
      }
      return sessions.map(s => s.id);
    }
  };

  const getStudentPeriodStats = (studentId: string | number) => {
    const sId = String(studentId);
    let hadir = 0;
    let terlambat = 0;
    let alpa = 0;

    const sessions = getSessions(activeMenu);

    if (rekapTimeframe === "harian") {
      const passedSessionIds = getPassedSessions(activeMenu, selectedDate);
      sessions.forEach(sess => {
        if (!passedSessionIds.includes(sess.id)) return;
        const key = `${selectedDate}_${activeMenu}_${sess.id}`;
        const status = attendanceDb[key]?.[sId] || "unmarked";
        if (status === "hadir") hadir++;
        else if (status === "terlambat") terlambat++;
        else if (status === "alpa" || status === "unmarked") alpa++;
      });
    } else if (rekapTimeframe === "mingguan") {
      const { monday } = getWeekRange(selectedDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${day}`;

        const passedSessionIds = getPassedSessions(activeMenu, dateStr);

        sessions.forEach(sess => {
          if (!passedSessionIds.includes(sess.id)) return;
          const key = `${dateStr}_${activeMenu}_${sess.id}`;
          const status = attendanceDb[key]?.[sId] || "unmarked";
          if (status === "hadir") hadir++;
          else if (status === "terlambat") terlambat++;
          else if (status === "alpa" || status === "unmarked") alpa++;
        });
      }
    } else if (rekapTimeframe === "bulanan") {
      const d = new Date(selectedDate);
      const y = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, "0");
      const days = new Date(y, d.getMonth() + 1, 0).getDate();

      for (let day = 1; day <= days; day++) {
        const dateStr = `${y}-${mStr}-${String(day).padStart(2, "0")}`;
        const passedSessionIds = getPassedSessions(activeMenu, dateStr);

        sessions.forEach(sess => {
          if (!passedSessionIds.includes(sess.id)) return;
          const key = `${dateStr}_${activeMenu}_${sess.id}`;
          const status = attendanceDb[key]?.[sId] || "unmarked";
          if (status === "hadir") hadir++;
          else if (status === "terlambat") terlambat++;
          else if (status === "alpa" || status === "unmarked") alpa++;
        });
      }
    }

    return { hadir, terlambat, alpa };
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-4 px-2 space-y-6 flex flex-col items-stretch" id="attendance_menu_root">
      
      {/* 1. HEADER BRANDING */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 select-none pt-2" id="attendance_brand_header">
        <div>
          <h2 className="text-3xl font-black text-[#1d2757] font-display tracking-tight leading-none">
            {activeMenu === "sholat" ? "Absensi Sholat Digital" : activeMenu === "doa_malam" ? "Absensi Doa Malam" : "Absensi Makan Digital"}
          </h2>
          <p className="text-xs text-[#566580] font-bold mt-2.5 flex flex-wrap items-center justify-start gap-1.5 uppercase tracking-wide">
            <span>Pondok Pesantren</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
            <span className="text-[#3b82f6]">Al Muttaqin</span>
            {supabaseSyncStatus === "connected" && (
              <>
                <span className="w-1 h-3 border-l border-slate-200"></span>
                <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-lg text-[9px] font-black border border-sky-100 flex items-center gap-1 shadow-sm">
                  <span className="w-1 h-1 rounded-full bg-sky-500 animate-pulse"></span>
                  SINKRON ONLINE (CLOUD)
                </span>
              </>
            )}
            {supabaseSyncStatus === "loading" && (
              <>
                <span className="w-1 h-3 border-l border-slate-200"></span>
                <span className="text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-lg text-[9px] font-black border border-slate-100 flex items-center gap-1 animate-pulse shadow-sm">
                  🔄 MENYELARASKAN...
                </span>
              </>
            )}
            {supabaseSyncStatus === "disabled" && (
              <>
                <span className="w-1 h-3 border-l border-slate-200"></span>
                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-lg text-[9px] font-black border border-amber-100 shadow-sm" title="Tabel 'presensi_santri' belum aktif di Supabase. Sistem otomatis menyimpannya secara offline aman di Browser Storage Anda.">
                  LOKAL (OFFLINE-OK)
                </span>
              </>
            )}
            {supabaseSyncStatus === "error" && (
              <>
                <span className="w-1 h-3 border-l border-slate-200"></span>
                <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-lg text-[9px] font-black border border-rose-100 shadow-sm flex items-center gap-1" title="Masalah jaringan database Supabase. Hubungkan wifi/paket data kembali.">
                  ⚠️ KONEKSI TERBATAS
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* 2. TAB CONTROLS switcher - PRESENSI, REKAP DATA, STATISTIK */}
      <div className="bg-white p-1 border border-slate-200/60 rounded-2xl shadow-sm flex items-center select-none" id="attendance_tab_selector">
        <button
          onClick={() => setAttendanceSubTab("input")}
          className={`flex-1 py-3 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
            attendanceSubTab === "input"
              ? "bg-[#3e46ca] text-white shadow"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Presensi
        </button>
        <button
          onClick={() => setAttendanceSubTab("rekap")}
          className={`flex-1 py-3 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
            attendanceSubTab === "rekap"
              ? "bg-[#3e46ca] text-white shadow"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Rekap Data
        </button>
        <button
          onClick={() => setAttendanceSubTab("statistik")}
          className={`flex-1 py-3 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
            attendanceSubTab === "statistik"
              ? "bg-[#3e46ca] text-white shadow"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Statistik
        </button>
      </div>



      {/* 3. SESSION CARD INDIVIDUAL LISTENER */}
      <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in relative overflow-hidden" id="session_card_header">
        <div className="flex items-center gap-4 select-none">
          {/* Clock squircle box - Light lavender-blue gradient overlay style */}
          <div className="w-[54px] h-[54px] rounded-2xl bg-[#eef2ff] flex items-center justify-center text-[#5b51ff] shrink-0">
            <Clock className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-extrabold text-[#94a3b8] tracking-[0.1em] leading-none">
              SESSION
            </span>
            <span className="text-2xl font-black text-[#1e1b4b] mt-1.5 leading-none tracking-tight">
              {activeSessionObj?.label || "Aktif"}
            </span>
          </div>
        </div>

        {/* Right status pills inside session bar */}
        <div className="flex flex-wrap items-center gap-3 select-none">
          {/* NFC Hardware Support Status Widget */}
          {!isNfcSupported ? (
            <button
              type="button"
              onClick={() => setShowNfcErrorModal(true)}
              className="bg-[#f8fafc] hover:bg-slate-100 border border-slate-150 text-[#64748b] text-[10.5px] font-black uppercase tracking-wider px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm transition-all duration-150 cursor-pointer select-none"
            >
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span>NFC TIDAK DIDUKUNG</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const nextState = !isNfcActive;
                setIsNfcActive(nextState);
                if (nextState) setIsCameraActive(false);
                setScanFeedback(null);
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-sm ${
                isNfcActive 
                  ? "bg-[#10b981] text-white border-[#10b981] shadow-emerald-100 scale-[1.01]" 
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>NFC: {isNfcActive ? "AKTIF" : "NONAKTIF"}</span>
            </button>
          )}

          {/* Camera Barcode Scanner Trigger Button */}
          <button
            type="button"
            onClick={() => {
              const nextState = !isCameraActive;
              setIsCameraActive(nextState);
              if (nextState) setIsNfcActive(false);
              setScanFeedback(null);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-sm ${
              isCameraActive 
                ? "bg-[#3e46ca] text-white border-[#3e46ca] scale-[1.01]" 
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>BARCODE: {isCameraActive ? "AKTIF" : "NONAKTIF"}</span>
          </button>

          {/* Iqomah Status Pill Row Block */}
          {activeMenu === "sholat" && (
            <div className="flex items-center gap-3.5 bg-slate-50/55 border border-slate-200/20 rounded-2xl pl-5 pr-3 py-1.5 select-none min-h-[48px]">
              <span className="text-[10.5px] font-black text-[#586884] uppercase tracking-wider">
                IQOMAH STATUS
              </span>
              <button
                type="button"
                onClick={toggleIqomah}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10.5px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                  isIqomahActive 
                    ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" 
                    : "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d] hover:bg-[#dcfce7]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isIqomahActive ? "bg-rose-500 animate-pulse" : "bg-[#10b981]"}`}></span>
                <span>{isIqomahActive ? "SUDAH IQOMAH" : "BELUM IQOMAH"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ACTIVE SENSOR OVERLAYS / FEEDBACK PANELS */}
      {(isNfcActive || isCameraActive || scanFeedback) && (
        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm space-y-4 animate-fade-in relative overflow-hidden mt-4" id="active_sensor_panel">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-[11px] font-black text-[#1d2757] uppercase tracking-wider flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Koneksi Sensor Input</span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setIsNfcActive(false);
                setIsCameraActive(false);
                setScanFeedback(null);
              }}
              className="text-slate-400 hover:text-slate-600 font-extrabold text-[10px] uppercase tracking-wider bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-100 cursor-pointer"
            >
              Tutup ✕
            </button>
          </div>

          <div className="max-w-md mx-auto space-y-4">
            {isNfcActive && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center space-y-3 select-none">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#10b981] mx-auto">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10b981]"></span>
                  </span>
                </div>
                <div>
                  <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Mencari Sinyal Kartu NFC...</h5>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Silakan dekatkan kartu santri/wali ke area sensor NFC perangkat Anda.
                  </p>
                </div>
              </div>
            )}

            {isCameraActive && (
              <div className="bg-[#0f172a] rounded-2xl p-4 text-center space-y-3 border border-slate-800">
                <div className="relative w-full aspect-video rounded-xl bg-black border border-slate-800 flex items-center justify-center overflow-hidden shadow-2xl animate-fade-in">
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover opacity-85"
                  />
                  <div className="absolute inset-x-0 w-full h-1 bg-rose-500 shadow-[0_0_15px_4px_rgba(239,68,68,0.9)] animate-pulse" style={{ top: "45%" }}></div>
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-rose-500"></div>
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-rose-500"></div>
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-rose-500"></div>
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-rose-500"></div>
                  {!videoStream && (
                    <div className="z-10 text-[9px] text-[#ffffff85] uppercase tracking-widest font-black animate-pulse text-center px-4">
                      Menunggu Kamera... <br />
                      <span className="text-[8px] text-slate-400">(Izinkan hak akses lensa)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {scanFeedback && (
              <div className={`p-4 rounded-2xl border text-xs font-bold flex items-start gap-3 select-none ${
                scanFeedback.type === "success" 
                  ? "bg-emerald-50 border-emerald-150 text-emerald-800" 
                  : scanFeedback.type === "warning"
                  ? "bg-amber-50 border-amber-150 text-amber-800"
                  : "bg-rose-50 border-rose-150 text-rose-800"
              }`}>
                <span className="text-base shrink-0">
                  {scanFeedback.type === "success" ? "✅" : scanFeedback.type === "warning" ? "⚠️" : "❌"}
                </span>
                <div>
                  <h6 className="font-extrabold uppercase text-[10px] tracking-wider mb-0.5">Respons Sensor</h6>
                  <p>{scanFeedback.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MAIN ACTION VIEWS DEPENDING ON TAB SELECTION */}
      
      {/* A. PRESENSI VIEW (INPUT PRESENSI) */}
      {attendanceSubTab === "input" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* LEFT SIDE: PRESENSI SANTRI LIST & CONTROLS (spans 2 columns on desktop) */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* PRESENSI SANTRI CONTAINER CARD */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
              
              {/* Header section with Dropdown Filter */}
              <div className="flex items-center justify-between select-none">
                <h3 className="text-xl font-extrabold text-[#111827] font-display">
                  Presensi Santri
                </h3>

                {/* Unit Dropdown Filter */}
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm cursor-pointer hover:bg-slate-50 focus:outline-none"
                >
                  <option value="All">Semua Unit</option>
                  <option value="SMP">Unit SMP</option>
                  <option value="SMA">Unit SMA</option>
                  <option value="Reguler">Unit Reguler</option>
                </select>
              </div>

              {/* Input Search Block */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input 
                  type="text"
                  placeholder="Cari nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs font-medium pl-10 pr-4 py-3 bg-[#f8fafc] border border-slate-200/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-505 focus:bg-white text-slate-800 transition-all shadow-inner"
                />
              </div>

              {/* Student List Container — Full-width list items to ensure they display fully on a single line */}
              <div className="grid grid-cols-1 gap-3 max-h-[550px] overflow-y-auto pr-1">
                {studentsPending.length > 0 ? (
                  studentsPending.map((student) => {
                    const sLabel = getStudentClassLabel(student);
                    const avatarColor = getAvatarColorClass(student.nama_lengkap || "");
                    const isFemale = student.jenis_kelamin === "P";

                    return (
                      <div 
                        key={student.id}
                        onClick={() => {
                          if (student.id) handleToggleRowAttendance(student.id);
                        }}
                        className="group bg-[#f8fafc] hover:bg-slate-100/50 transition-all border border-slate-100/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer h-fit"
                      >
                        {/* Left: Avatar & Name */}
                        <div className="flex items-center gap-3 min-w-0">
                          {student.foto ? (
                            <img src={student.foto} alt="" className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0" />
                          ) : (
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 font-extrabold text-sm select-none ${avatarColor}`}>
                              <span>{(student.nama_lengkap || "S").charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="text-[13px] font-extrabold text-slate-800 leading-tight group-hover:text-indigo-950 transition-colors whitespace-nowrap">
                              {student.nama_lengkap}
                            </h4>
                            <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-0.5 block">
                              KAMAR: {student.kamar || "BELUM SET"} • {student.kategori || "Reguler"}
                            </span>
                          </div>
                        </div>

                        {/* Right: Icon Device & Check Trigger */}
                        <div className="flex items-center gap-3 shrink-0 select-none">
                          <Smartphone className="w-4 h-4 text-[#10b981]" />
                          
                          {/* Circular Tick-Box representation */}
                          <div className="w-5.5 h-5.5 rounded-full border-2 border-slate-350 flex items-center justify-center transition-all group-hover:border-indigo-400 bg-white text-transparent group-hover:text-indigo-400">
                            <span className="text-[10px] font-bold block leading-none">✓</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-1 sm:col-span-2 p-12 text-center text-slate-400 select-none flex flex-col items-center justify-center space-y-2">
                    <div className="text-3xl">🎉</div>
                    <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest">Inbox Zero / Selesai!</h4>
                    <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                      Semua santri yang terbit dalam daftar unit/kamar saringan hari ini telah diinput absennya.
                    </p>
                  </div>
                )}
              </div>

              {/* 5. RED TACTILE IQOMAH CONTROL BUTTON */}
              {activeMenu === "sholat" && (
                <button
                  type="button"
                  onClick={toggleIqomah}
                  className={`w-full py-4 rounded-2xl text-center text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md select-none ${
                    isIqomahActive 
                      ? "bg-[#ef4444] hover:bg-rose-600 animate-pulse ring-4 ring-rose-100" 
                      : "bg-[#ff2c55] hover:bg-[#e02047]"
                  }`}
                >
                  🔥 {isIqomahActive ? "STATUS: IQOMAH TELAH BERKUMANDANG" : "TOMBOL IQOMAH"}
                </button>
              )}

            </div>
          </div>

          {/* RIGHT SIDE: STATS & SYSTEM STATUS MODULES (1 column on desktop) */}
          <div className="space-y-6">
            
            {/* 6. LIVE PARTICIPATION CARD */}
            <div className="bg-[#222467] text-white rounded-3xl p-5 shadow-sm space-y-4 select-none animate-fade-in">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-250">
                  LIVE PARTICIPATION
                </span>
                <span className="text-5xl font-extrabold italic font-display text-white mt-1 leading-none">
                  {stats.percentPresent}%
                </span>
              </div>
              
              <hr className="border-white/10" />

              <div className="text-xs font-semibold text-indigo-200">
                {stats.markedCount} dari {stats.total} santri hari ini
              </div>
            </div>

            {/* 7. LATE ARRIVALS CARD */}
            {activeMenu === "sholat" && (
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-2.5 select-none animate-fade-in">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block pb-1">
                  LATE ARRIVALS
                </span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-extrabold italic ${isIqomahActive ? "text-[#ff2c55]" : "text-slate-400"}`}>
                    {isIqomahActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-800 pt-1">
                  Monitoring Sesi {activeSessionObj?.label || "Subuh"}
                </h4>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Santri yang absen setelah iqomah tercatat otomatis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

         {/* B. REKAP DATA VIEW (REKAP DATA) */}
      {attendanceSubTab === "rekap" && (
        <div className="space-y-4 animate-fade-in" id="attendance_rekap_section">
          
          {/* TIMEFRAME SELECTION SWITCHER */}
          <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 select-none animate-fade-in">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
              Pilih Ruang Lingkup Rekapitulasi:
            </h4>
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60 shadow-xs w-full md:max-w-sm" id="rekap_timeframe_switcher">
              {[
                { id: "harian", label: "Harian" },
                { id: "mingguan", label: "Mingguan" },
                { id: "bulanan", label: "Bulanan" }
              ].map((tf) => {
                const active = rekapTimeframe === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => {
                      setRekapTimeframe(tf.id as "harian" | "mingguan" | "bulanan");
                    }}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                      active 
                        ? "bg-[#3e46ca] text-white shadow-sm font-black"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4 animate-fade-in">
            
            {/* Context Header & Date Filters depending on active timeframe */}
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-[#1d2757] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>📁 Laporan Kehadiran</span>
                <span className="text-sky-600 bg-sky-50 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest border border-sky-100">
                  {rekapTimeframe.toUpperCase()}
                </span>
              </h3>

              {rekapTimeframe === "harian" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#3b82f6]">Saring Tanggal Rekap</label>
                    <input 
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value);
                          setIsManualDate(true);
                        }
                      }}
                      className="w-full text-xs font-bold leading-normal px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#3b82f6]">Sesi Sholat Aktif</label>
                    <select
                      value={activeSession}
                      onChange={(e) => setActiveSession(e.target.value)}
                      className="w-full text-xs font-bold px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-slate-800"
                    >
                      {sholatSessions.map(s => (
                        <option key={s.id} value={s.id}>{s.icon} {s.label} ({s.time})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {rekapTimeframe === "mingguan" && (
                <div className="space-y-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#3b82f6]">Pilih Tanggal Acuan Minggu</label>
                    <input 
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value);
                          setIsManualDate(true);
                        }
                      }}
                      className="w-full max-w-sm text-xs font-bold leading-normal px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-slate-800"
                    />
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 flex items-center gap-2.5 text-[11px] font-bold text-slate-600 leading-normal">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                    <span>
                      Minggu Terpilih: <strong className="text-indigo-900">{formatIndoDate(getWeekRange(selectedDate).monday.toISOString().slice(0, 10))}</strong> s.d. <strong className="text-indigo-900">{formatIndoDate(getWeekRange(selectedDate).sunday.toISOString().slice(0, 10))}</strong>
                    </span>
                  </div>
                </div>
              )}

              {rekapTimeframe === "bulanan" && (
                <div className="space-y-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#3b82f6]">Saring Bulan Rekap</label>
                    <input 
                      type="month"
                      value={selectedDate.slice(0, 7)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value + "-01");
                          setIsManualDate(true);
                        }
                      }}
                      className="w-full max-w-sm text-xs font-bold leading-normal px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-slate-800"
                    />
                  </div>
                  <div className="bg-[#10b981]/5 p-3 rounded-2xl border border-emerald-100 flex items-center gap-2.5 text-[11px] font-bold text-slate-600 leading-normal">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0"></span>
                    <span>
                      Bulan Terpilih: <strong className="text-emerald-950 font-extrabold">{formatIndoMonth(selectedDate)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {rekapTimeframe !== "harian" && (
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider py-1">
                📊 Data Rekapitulasi Menyerang Hadir, Telat, dan Tidak Berjamaah (Alfa)
              </div>
            )}

            {/* Filter text input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Pencarian nama atau kamar santri..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[11px] font-medium pl-8.5 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white"
              />
            </div>

            {/* Scrollable list of Rekap */}
            <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto pr-1">
              {(rekapTimeframe === "harian" ? rekapFilteredStudents : displayedStudents).length > 0 ? (
                (rekapTimeframe === "harian" ? rekapFilteredStudents : displayedStudents).map((student) => {
                  const sStatus = getStatus(student.id);
                  const isFemale = student.jenis_kelamin === "P";
                  const pPeriodStats = getStudentPeriodStats(student.id);

                  return (
                    <div key={student.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold">
                      
                      {/* Left Block: Photo & basic student Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-250 overflow-hidden relative shrink-0 shadow-xs">
                          {student.foto ? (
                            <img src={student.foto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg select-none">
                              {isFemale ? "🧕" : "👳"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 block text-sm leading-snug truncate whitespace-nowrap">{student.nama_lengkap}</span>
                          <span className="text-[10px] text-slate-400 font-bold block mt-0.5 animate-fade-in">
                            KAMAR: <strong className="text-slate-600">{student.kamar || "Belum Set"}</strong> • <span className="text-indigo-600 bg-indigo-50 px-1 rounded-sm text-[8px] font-black">{student.kategori || "Reguler"}</span>
                          </span>
                        </div>
                      </div>

                      {/* Right Block: Clean counters for Hadir, Telat, and Alfa */}
                      <div className="flex items-center gap-2 select-none self-end md:self-auto">
                        {/* Hadir statistic */}
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200/60 rounded-2xl shadow-3xs animate-fade-in">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span className="text-slate-500 text-[10px] font-extrabold uppercase">Hadir:</span>
                          <strong className="text-emerald-800 font-black text-xs">{pPeriodStats.hadir}</strong>
                        </div>

                        {/* Terlambat statistic */}
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-250/60 rounded-2xl shadow-3xs animate-fade-in">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span className="text-slate-500 text-[10px] font-extrabold uppercase">Telat:</span>
                          <strong className="text-amber-800 font-black text-xs">{pPeriodStats.terlambat}</strong>
                        </div>

                        {/* Alfa statistic */}
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-250/60 rounded-2xl shadow-3xs animate-fade-in">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span className="text-slate-500 text-[10px] font-extrabold uppercase">Alfa:</span>
                          <strong className="text-rose-800 font-black text-xs">{pPeriodStats.alpa}</strong>
                        </div>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl text-xs font-bold leading-normal">
                  Tidak ada data kehadiran yang cocok dengan saringan dan kata kunci terpilih saat ini.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* C. STATISTIK VIEW (STATISTICS) */}
      {attendanceSubTab === "statistik" && (
        <div className="space-y-4 animate-fade-in" id="attendance_statistik_section">
          
          {/* Radial progress & Breakdown widget */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wider text-center border-b border-slate-50 pb-2">
              Ringkasan Analitik Sesi
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Radial gauge on left or column on mobile */}
              <div className="flex flex-col items-center justify-center py-2 text-center border-b md:border-b-0 md:border-r border-slate-100 md:pr-4">
                <div className="relative flex items-center justify-center w-36 h-36 mb-4">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-slate-100"
                      strokeWidth="11"
                      fill="transparent"
                    />
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-[#3e46ca] transition-all duration-500 ease-out"
                      strokeWidth="11"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 60}
                      strokeDashoffset={2 * Math.PI * 60 * (1 - stats.percentPresent / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-slate-900 leading-none">{stats.percentPresent}%</span>
                    <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black mt-2">Kehadiran</span>
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-650">
                  Selesai Input: <span className="font-extrabold text-[#3e46ca]">{stats.markedCount}</span> dari <span className="font-extrabold text-slate-900">{stats.total}</span> santri
                </div>
              </div>

              {/* Breakdown item bars on right */}
              <div className="space-y-3.5">
                {[
                  { label: "Hadir", count: stats.hadir, color: "bg-emerald-500", rawColor: "text-emerald-700 bg-emerald-50" },
                  { label: "Terlambat", count: stats.terlambat, color: "bg-amber-400 animate-pulse", rawColor: "text-[#854d0e] bg-amber-50" },
                  { label: "Sakit", count: stats.sakit, color: "bg-yellow-400", rawColor: "text-yellow-700 bg-yellow-50" },
                  { label: "Izin", count: stats.izin, color: "bg-blue-400", rawColor: "text-blue-700 bg-blue-50" },
                  { label: "Alpa (Tanpa Keterangan)", count: stats.alpa, color: "bg-rose-400", rawColor: "text-rose-700 bg-rose-50" },
                  { label: "Belum Absen", count: stats.unmarked, color: "bg-slate-300", rawColor: "text-slate-500 bg-slate-50" },
                ].map((item) => {
                  const ratio = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-600">{item.label}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-mono leading-none ${item.rawColor}`}>
                          {item.count} santri ({Math.round(ratio)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${ratio}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 9. BOTTOM FOOTER */}
      <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold select-none py-1 border-t border-slate-100 uppercase tracking-widest mt-2" id="attendance_panel_footer">
        <span>CONNECTED • DB ACTIVE</span>
        <span>AL MUTTAQIN V1</span>
      </div>

      {/* NFC INVALID/NOT SUPPORTED DIALOG MODAL */}
      {showNfcErrorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200" id="nfc-dialog-overlay">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-105 shadow-2xl text-center space-y-4 animate-scale-up" id="nfc-dialog-card">
            <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 mx-auto">
              <Smartphone className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                NFC Tidak Tersedia
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                NFC tidak didukung di browser ini. Gunakan Chrome di Android.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNfcErrorModal(false)}
              className="w-full bg-[#3e46ca] hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ABSENSI CUSTOM STATUS POPUP OVERLAY */}
      {attendancePopup?.isOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0a0a1a]/55 backdrop-blur-md transition-opacity duration-300 font-sans" 
          id="absensi-custom-popup-overlay"
          onClick={() => {
            if (attendancePopup.type === "success") {
              setAttendancePopup(null);
            }
          }}
        >
          {attendancePopup.type === "success" ? (
            /* SUCCESS MODAL (GREEN COMPLIANT WITH SCREENSHOT) */
            <div 
              className="relative bg-white rounded-[2rem] border-2 border-[#10b981] p-8 max-w-[320px] w-full shadow-2xl text-center pt-10 pb-6 animate-scale-up" 
              id="absensi-success-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Absoluted Top circular check badge */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#10b981] border-2 border-white shadow-md flex items-center justify-center text-white">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>

              {/* Large Check indicator inside */}
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
              </div>

              {/* Success Title */}
              <div className="space-y-1 mb-4">
                <h3 className="text-xl font-black text-emerald-600 tracking-tight leading-none uppercase">
                  Berhasil
                </h3>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                  Absensi Tercatat!
                </p>
              </div>

              {/* Student Photo */}
              <div className="w-24 h-28 bg-slate-50 border border-slate-200 rounded-2xl mx-auto overflow-hidden relative shadow-sm mb-4">
                {attendancePopup.studentPhoto ? (
                  <img src={attendancePopup.studentPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-sky-50 text-indigo-950">
                    <span className="text-4xl filter saturate-100 drop-shadow">
                      {attendancePopup.isFemale ? "🧕" : "👳"}
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 py-0.5 bg-emerald-500 text-[8px] text-white font-black tracking-widest uppercase">
                  ACTIVE
                </div>
              </div>

              {/* Student Name */}
              <h4 className="text-sm font-extrabold text-slate-800 leading-snug px-2 truncate mb-6" title={attendancePopup.studentName}>
                {attendancePopup.studentName}
              </h4>

              {/* Green box-padded button labeled 'Lanjutkan' */}
              <button
                type="button"
                onClick={() => setAttendancePopup(null)}
                className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-2xl transition-all shadow-md hover:shadow-lg cursor-pointer transform active:scale-[0.98]"
              >
                Lanjutkan
              </button>
            </div>
          ) : (
            /* FAILED/ERROR MODAL (RED COMPLIANT WITH SCREENSHOT) */
            <div 
              className="relative bg-white rounded-[2rem] border-2 border-rose-500 p-8 max-w-[320px] w-full shadow-2xl text-center pt-10 pb-6 animate-scale-up" 
              id="absensi-error-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Absoluted Top circular close badge */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-rose-500 border-2 border-white shadow-md flex items-center justify-center text-white">
                <svg className="w-5 h-5 stroke-[3]" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              {/* Main Illustration Block */}
              <div className="mb-4">
                {attendancePopup.reason === "already_scanned" ? (
                  /* Double Absen: Show student photo inside a red-glowing badge */
                  <div className="w-24 h-28 bg-rose-50 border-2 border-rose-200 rounded-2xl mx-auto overflow-hidden relative shadow-sm">
                    {attendancePopup.studentPhoto ? (
                      <img src={attendancePopup.studentPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-indigo-950">
                        <span className="text-4xl filter saturate-75 drop-shadow">
                          {attendancePopup.isFemale ? "🧕" : "👳"}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 py-0.5 bg-rose-500 text-[8px] text-white font-black tracking-widest uppercase animate-pulse">
                      DOUBLE
                    </div>
                  </div>
                ) : (
                  /* Unregistered Card: Show Custom pointing-fingers shy SVG */
                  <div className="w-32 h-28 flex items-center justify-center mx-auto">
                    <svg viewBox="0 0 120 120" className="w-28 h-28 drop-shadow-sm select-none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="60" cy="38" r="23" stroke="#cbd5e1" strokeWidth="2.5" fill="#f8fafc" />
                      <circle cx="51" cy="36" r="2.5" fill="#475569" />
                      <circle cx="69" cy="36" r="2.5" fill="#475569" />
                      <path d="M 54 48 Q 60 52 66 48" stroke="#475569" strokeWidth="2" fill="none" strokeLinecap="round" />
                      <path d="M 32 85 C 32 68 88 68 88 85" stroke="#cbd5e1" strokeWidth="2.5" fill="none" />
                      <path d="M 36 78 Q 48 83 55 83" stroke="#475569" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                      <path d="M 55 83 L 59 83" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                      <path d="M 84 78 Q 72 83 65 83" stroke="#475569" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                      <path d="M 65 83 L 61 83" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                      <circle cx="60" cy="83" r="1.5" fill="black" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Title Header */}
              <h3 className="text-xl font-black text-rose-500 tracking-tight leading-none uppercase mb-2">
                {attendancePopup.reason === "already_scanned" ? "SUDAH ABSEN" : "ID TIDAK DIKENAL"}
              </h3>

              {/* Description explanation */}
              <p className="text-xs text-slate-500 leading-relaxed font-bold px-1 mb-6">
                {attendancePopup.reason === "already_scanned" ? (
                  <>
                    Siswa <span className="text-slate-800 font-extrabold">{attendancePopup.studentName}</span> sudah melakukan absensi sebelumnya pada sesi ini.
                  </>
                ) : attendancePopup.reason === "unregistered_card" ? (
                  "Maaf kartu Anda belum terdaftar, silakan menghubungi admin."
                ) : (
                  attendancePopup.customMessage || "Gagal melakukan absensi."
                )}
              </p>

              {/* Red box-padded button labeled 'Ulangi' */}
              <button
                type="button"
                onClick={() => setAttendancePopup(null)}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-2xl transition-all shadow-md hover:shadow-lg cursor-pointer transform active:scale-[0.98]"
              >
                Ulangi
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
