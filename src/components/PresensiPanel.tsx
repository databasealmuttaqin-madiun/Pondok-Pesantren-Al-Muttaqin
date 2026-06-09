import React, { useState, useEffect, useRef } from "react";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
const MySwal = withReactContent(Swal);
import { SantriData, supabase } from "../supabaseClient";
import { parseNfcPayload, normalizeNfcId } from "./NfcRegisterPanel";
import { 
  Calendar, 
  Search, 
  Clock, 
  Smartphone, 
  Check, 
  Database, 
  ShieldAlert, 
  CheckCircle2, 
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
  activeMenu?: string; // made optional to support seamless transition to unified absensi menu
}

type AttendanceStatus = "hadir" | "terlambat" | "sakit" | "izin" | "alpa" | "unmarked";

export interface SessionInfo {
  id: string;
  label: string;
  time: string;
  icon: string;
  presensi?: string;
}

function detectSession(timeStr: string, sessions: SessionInfo[]): string {
  try {
    const [curHStr, curMStr] = timeStr.replace(":", ".").split(".");
    const h = Number(curHStr);
    const m = Number(curMStr || 0);
    const totalMinutes = h * 60 + m;

    for (const sess of sessions) {
      if (!sess.time) continue;
      const [startStr, endStr] = sess.time.replace(/\s/g, "").split("-");
      const [startH, startM] = startStr.split(".").map(Number);
      const [endH, endM] = endStr.split(".").map(Number);

      const startVal = startH * 60 + startM;
      const endVal = endH * 60 + endM;

      if (totalMinutes >= startVal && totalMinutes <= endVal) {
        return sess.id;
      }
    }
  } catch (e) {
    // ignore
  }
  return "none";
}

// Map local session ID (e.g. "makan_pagi", "subuh") to supabase "sesi" and "presensi" columns
function mapLocalSessionToDbSession(sessionId: string, sessions: SessionInfo[]): { sesi: string; presensi: string } {
  const sess = sessions.find(s => s.id === sessionId);
  if (sess) {
    return {
      sesi: sess.label,
      presensi: sess.presensi || "ngaji"
    };
  }

  // Fallback if not found in state
  const idLower = (sessionId || "").toLowerCase();
  
  // Determine "presensi" column value (e.g., sholat, makan)
  let presensi = "sholat";
  if (idLower.includes("makan")) {
    presensi = "makan";
  } else if (idLower.includes("doa")) {
    presensi = "doa";
  }

  // Determine "sesi" column value
  let sesi = sessionId;
  if (idLower === "makan_pagi" || idLower === "pagi") {
    sesi = "pagi";
  } else if (idLower === "makan_siang" || idLower === "siang") {
    sesi = "siang";
  } else if (idLower === "makan_sore" || idLower === "sore") {
    sesi = "sore";
  } else if (idLower === "doa_malam_sesi") {
    sesi = "doa_malam";
  }

  return { sesi, presensi };
}

// Map supabase database "sesi" and "presensi" columns back to local session ID
function mapDbSessionToLocalSession(dbSesi: string, dbPresensi: string | undefined, sessions: SessionInfo[]): string {
  const sess = sessions.find(s => s.label === dbSesi && s.presensi === dbPresensi);
  if (sess) return sess.id;
  
  // Also try to find just by label if presensi was omitted or null in older records
  const sessByLabel = sessions.find(s => s.label === dbSesi);
  if (sessByLabel) return sessByLabel.id;

  const sesiLower = (dbSesi || "").toLowerCase();
  const presensiLower = (dbPresensi || "").toLowerCase();

  if (sesiLower === "pagi" || (presensiLower === "makan" && sesiLower === "pagi")) {
    return "makan_pagi";
  }
  if (sesiLower === "siang" || (presensiLower === "makan" && sesiLower === "siang")) {
    return "makan_siang";
  }
  if (sesiLower === "sore" || (presensiLower === "makan" && sesiLower === "sore")) {
    return "makan_sore";
  }
  if (sesiLower === "doa_malam" || sesiLower === "doa_malam_sesi") {
    return "doa_malam_sesi";
  }
  return dbSesi;
}

export default function PresensiPanel({ students }: PresensiPanelProps) {
  // Configured date & viewMode
  const [viewMode, setViewMode] = useState<"selection" | "attendance">("attendance");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  // Dynamic Sessions State from Supabase
  const [sessions, setSessions] = useState<SessionInfo[]>(() => {
    const saved = localStorage.getItem("santri_absensi_sessions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    // Standard defaults
    const defaults = [
      { id: "subuh", label: "Subuh", time: "04.00 - 10.00", icon: "🌅" },
      { id: "dzuhur", label: "Dzuhur", time: "11.30 - 12.30", icon: "☀️" },
      { id: "asar", label: "Asar", time: "14.50 - 15.30", icon: "🌤️" },
      { id: "maghrib", label: "Maghrib", time: "17.20 - 18.00", icon: "🌇" },
      { id: "isya", label: "Isya", time: "18.40 - 19.30", icon: "🌌" },
      { id: "doa_malam_sesi", label: "Doa Malam", time: "03.30 - 04.15", icon: "🌌" },
      { id: "makan_pagi", label: "Makan Pagi", time: "06.00 - 07.15", icon: "🍳" },
      { id: "makan_siang", label: "Makan Siang", time: "11.00 - 12.00", icon: "🍛" },
      { id: "makan_sore", label: "Makan Sore", time: "16.30 - 17.15", icon: "🍲" }
    ];
    return defaults;
  });

  const fetchSessionsFromDb = async () => {
    try {
      const { data, error } = await supabase.from("sesi_absensi").select("*").order("jam mulai", { ascending: true });
      if (error) throw error;
      
      if (data && data.length > 0) {
        const loadedSessions = data.map((d: any) => ({
          id: d.id ? d.id.toString() : d.sesi.replace(/\s/g, "_"),
          label: d.sesi,
          time: `${String(d["jam mulai"]).replace(":", ".")} - ${String(d["jam selesai"]).replace(":", ".")}`,
          icon: d.ikon || "⏰",
          presensi: d.presensi || "ngaji"
        }));
        setSessions(loadedSessions);
        localStorage.setItem("santri_absensi_sessions", JSON.stringify(loadedSessions));
      } else {
        // Table is empty. We respect the empty state.
        setSessions([]);
        localStorage.setItem("santri_absensi_sessions", JSON.stringify([]));
      }
    } catch (err: any) {
      console.warn("Failed to load sessions from DB:", err);
    }
  };

  // Keep state synced in case they added new ones
  useEffect(() => {
    fetchSessionsFromDb();

    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedReloadSesi = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchSessionsFromDb();
      }, 500);
    };

    const sesiChannel = supabase
      .channel("sub-sesi-absensi-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sesi_absensi" }, () => {
        debouncedReloadSesi();
      })
      .subscribe();

    const handleStorageChange = () => {
      const saved = localStorage.getItem("santri_absensi_sessions");
      if (saved) {
        try {
          setSessions(JSON.parse(saved));
        } catch (e) {}
      }
    };
    window.addEventListener("storage", handleStorageChange);
    // Poll localstorage in case it changes during same session
    const interval = setInterval(handleStorageChange, 2000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(sesiChannel);
    };
  }, []);

  const [activeSession, setActiveSession] = useState<string>(() => {
    const today = new Date();
    const h = String(today.getHours()).padStart(2, "0");
    const m = String(today.getMinutes()).padStart(2, "0");
    return detectSession(`${h}.${m}`, sessions);
  });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [roomFilter, setRoomFilter] = useState<string>("All");

  // Sub-tabs
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
  const [rekapPresensiType, setRekapPresensiType] = useState<string>("sholat");
  const [attendancePopup, setAttendancePopup] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    studentName?: string;
    studentPhoto?: string;
    studentKamar?: string;
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
  // Structure: { [key = `${date}_absensi_${session}`]: { [studentId]: "hadir" | "terlambat" | ... } }
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
    const session = detectSession(activeTimeStr, sessions);
    setActiveSession(session);
  }, [activeTimeStr, sessions]);

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

  const isInsideTargetWindow = (timeStr: string, sessionId: string): boolean => {
    const sess = sessions.find(s => s.id === sessionId);
    if (!sess) return true;
    return isTimeInWindow(timeStr, sess.time);
  };

  const isSessionOpen = isInsideTargetWindow(activeTimeStr, activeSession);

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

  // Hook 2: Real device NDEFReader Scanner binding
  useEffect(() => {
    if (!isNfcActive || !isNfcSupported) return;

    let ndefReaderInstance: any = null;
    let isMounted = true;

    const startNfcScanning = async () => {
      try {
        const NDEFReaderClass = (window as any).NDEFReader;
        ndefReaderInstance = new NDEFReaderClass();
        await ndefReaderInstance.scan();
        
        if (!isMounted) return;

        ndefReaderInstance.onreading = (event: any) => {
          if (!isMounted) return;
          const tagSerial = event.serialNumber;
          if (tagSerial) {
            executeScan(String(tagSerial).toUpperCase(), "nfc");
          }
        };

        ndefReaderInstance.onreadingerror = () => {
          if (!isMounted) return;
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
      isMounted = false;
    };
  }, [isNfcActive, isNfcSupported]);

  // Save DB
  const updateLocalAttendance = (key: string, studentId: string, status: AttendanceStatus) => {
    setAttendanceDb((prev) => {
      const dayDb = { ...(prev[key] || {}) };
      dayDb[studentId] = status;
      const newDb = { ...prev, [key]: dayDb };
      localStorage.setItem("santri_attendance_db", JSON.stringify(newDb));
      return newDb;
    });
  };

  // State to track if Supabase Sync is active/working for absensi
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<"connected" | "error" | "loading" | "disabled">("loading");
  const [supabaseErrorMsg, setSupabaseErrorMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Synchronize dynamic attendance entries from Supabase
  const fetchAttendanceFromSupabase = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSupabaseSyncStatus("loading");
    setSupabaseErrorMsg(null);

    try {
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("absensi")
          .select("*")
          .eq("tanggal", selectedDate)
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error) {
          if (error.code === "42P01") {
            setSupabaseSyncStatus("disabled");
            console.info("Table 'absensi' does not exist yet. Using local storage.");
          } else {
            setSupabaseSyncStatus("error");
            setSupabaseErrorMsg(error.message);
            console.warn("Supabase fetch error:", error.message);
          }
          setIsSyncing(false);
          return;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < 1000) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      setSupabaseSyncStatus("connected");

      if (allData.length > 0 || page === 0) {
        setAttendanceDb(prevDb => {
          const updatedDb = { ...prevDb };

          // Wipe current date keys for a fresh sync
          sessions.forEach((sess) => {
            const key = `${selectedDate}_absensi_${sess.id}`;
            updatedDb[key] = {};
          });

          // Populate from Supabase records
          allData.forEach((row: any) => {
            const matchedStudent = students.find(
              (s) => s.nama_lengkap.toLowerCase() === (row.nama || "").toLowerCase()
            );

            if (matchedStudent) {
              const studentId = String(matchedStudent.id);
              const mappedLocalSess = mapDbSessionToLocalSession(row.sesi || "", row.presensi || "", sessions);
              const key = `${row.tanggal || selectedDate}_absensi_${mappedLocalSess}`;
              
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

          localStorage.setItem("santri_attendance_db", JSON.stringify(updatedDb));
          return updatedDb;
        });
      }
    } catch (e: any) {
      setSupabaseSyncStatus("error");
      console.error("Synchronize error:", e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncStudentStatusToSupabase = async (studentId: string, status: AttendanceStatus) => {
    const student = students.find(s => String(s.id) === studentId);
    if (!student) return;

    const { sesi: dbSesi, presensi: dbPresensi } = mapLocalSessionToDbSession(activeSession, sessions);
    const formattedStatus = status === "terlambat" ? "telat" : status === "alpa" ? "alpha" : status;
    const studentKamar = student.kamar || "Belum Set";

    const cleanTime = activeTimeStr.replace(".", ":");
    const [hourVal, minVal] = cleanTime.split(":");
    const secondsVal = isSimulatingTime ? "00" : String(deviceTime.getSeconds()).padStart(2, "0");
    const dbWaktu = `${(hourVal || "00").padStart(2, "0")}:${(minVal || "00").padStart(2, "0")}:${secondsVal}`;

    try {
      if (status === "unmarked") {
        await supabase
          .from("absensi")
          .delete()
          .eq("nama", student.nama_lengkap)
          .eq("tanggal", selectedDate)
          .eq("sesi", dbSesi)
          .eq("presensi", dbPresensi);
        return;
      }

      // 1. Check if previous entry exists
      const { data: existing } = await supabase
        .from("absensi")
        .select("id")
        .eq("nama", student.nama_lengkap)
        .eq("tanggal", selectedDate)
        .eq("sesi", dbSesi)
        .eq("presensi", dbPresensi)
        .limit(1);

      // 2. Insert or update record mapping directly to supabase columns
      const payload = {
        nama: student.nama_lengkap,
        kamar: studentKamar,
        presensi: dbPresensi,
        status: formattedStatus,
        tanggal: selectedDate,
        sesi: dbSesi,
        waktu: dbWaktu
      };

      let error;
      if (existing && existing.length > 0) {
        const updateRes = await supabase
          .from("absensi")
          .update(payload)
          .eq("id", existing[0].id);
        error = updateRes.error;
      } else {
        const insertRes = await supabase
          .from("absensi")
          .insert([payload]);
        error = insertRes.error;
      }

      if (error) {
        console.warn("Fallback raw insert:", error.message);
      }
    } catch (err: any) {
      console.warn("Supabase local offline sync save pattern:", err.message);
    }
  };

  // Refresh on mount/date change/active tab change and subscribe to realtime absensi changes
  const fetchAttendanceRef = useRef(fetchAttendanceFromSupabase);
  fetchAttendanceRef.current = fetchAttendanceFromSupabase;

  useEffect(() => {
    fetchAttendanceRef.current();

    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log("Realtime update detected for absensi table. Reloading log...");
        fetchAttendanceRef.current();
      }, 400); // 400ms debounce
    };

    const absensiChannel = supabase
      .channel("sub-absensi-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, () => {
        debouncedReload();
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(absensiChannel);
    };
  }, [selectedDate]);

  // Derived Active Session Details
  const activeSessionObj = sessions.find((s) => s.id === activeSession) || { id: "none", label: "Tidak Ada Sesi", time: "-", icon: "⛔" };

  const isSholatActive = (() => {
    if (!activeSessionObj || activeSessionObj.id === "none") return false;
    const id = activeSessionObj.id.toLowerCase();
    const label = activeSessionObj.label.toLowerCase();
    const sholatKeywords = ["subuh", "dzuhur", "zuhur", "asar", "ashar", "maghrib", "isya", "sholat", "shalat", "prayer"];
    return sholatKeywords.some(keyword => id.includes(keyword) || label.includes(keyword));
  })();

  const toggleIqomah = () => {
    const key = `${selectedDate}_absensi_${activeSession}`;
    const currentValue = !!iqomahDb[key];
    const updated = { ...iqomahDb, [key]: !currentValue };
    setIqomahDb(updated);
    localStorage.setItem("santri_iqomah_db", JSON.stringify(updated));
  };

  const isIqomahActive = !!iqomahDb[`${selectedDate}_absensi_${activeSession}`];

  // Raw keyboard simulator scan
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") {
        return; 
      }
      if (e.key === "Enter") {
        if (scannerInputVal.trim()) {
          executeScan(scannerInputVal.trim(), "keyboard_mimic");
          setScannerInputVal("");
        }
      } else if (e.key.length === 1) {
        setScannerInputVal(prev => prev + e.key);
      }
    };
    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [scannerInputVal, activeSession, selectedDate]);

  // Execute NFC / Barcode Logic
  const executeScan = (code: string, medium: string) => {
    if (activeSession === "none") {
      MySwal.fire({
        icon: 'error',
        title: 'MAAF TIDAK ADA SESI YANG AKTIF',
        text: 'Silakan tunggu atau pilih sesi absensi terlebih dahulu.',
        confirmButtonText: 'Try Again',
        confirmButtonColor: '#f87171',
        customClass: {
          popup: 'rounded-[2rem]',
        }
      });
      return;
    }

    if (!isSessionOpen) {
      const cleanTime = activeTimeStr.replace(".", ":");
      setScanFeedback({
        message: `🔴 Gagal melakukan absensi. Sesi ini ditutup. Jam sekarang ${cleanTime} WIB berada di luar range Sesi ${activeSessionObj?.label} (${activeSessionObj?.time}).`,
        type: "error"
      });
      setAttendancePopup({
        isOpen: true,
        type: "error",
        reason: "custom_error",
        customMessage: `Sesi ${activeSessionObj?.label || "aktif"} sudah ditutup untuk input jam sekarang.`
      });
      return;
    }

    // Process Google Form NDEF URL parsing or card ID / NIK exact match
    const scanRes = parseNfcPayload(code, students);
    const foundStudent = scanRes.matchedStudent || null;

    if (!foundStudent) {
      setScanFeedback({
        message: `❌ ID kartu '${code}' tidak dikenal dalam sistem absensi Al Muttaqin.`,
        type: "error"
      });
      setAttendancePopup({
        isOpen: true,
        type: "error",
        reason: "unregistered_card",
        cardCode: code
      });
      return;
    }

    const sId = String(foundStudent.id);
    const key = `${selectedDate}_absensi_${activeSession}`;
    const currentStatus = attendanceDb[key]?.[sId] || "unmarked";

    if (currentStatus !== "unmarked" && currentStatus !== "alpa") {
      setScanFeedback({
        message: `⚠️ Siswa ${foundStudent.nama_lengkap} sudah tercatat '${currentStatus}' sebelumnya.`,
        type: "warning"
      });
      setAttendancePopup({
        isOpen: true,
        type: "error",
        reason: "already_scanned",
        studentName: foundStudent.nama_lengkap,
        studentPhoto: foundStudent.foto,
        isFemale: foundStudent.jenis_kelamin === "P"
      });
      return;
    }

    // Record attendance: If iqomah button is clicked active, student is recorded as terlambat
    const determinedStatus: AttendanceStatus = isIqomahActive ? "terlambat" : "hadir";
    
    // Save locally
    updateLocalAttendance(key, sId, determinedStatus);

    // Save remote Sync
    syncStudentStatusToSupabase(sId, determinedStatus);

    setScanFeedback({
      message: `✅ Berhasil mencatat ${foundStudent.nama_lengkap} sebagai '${determinedStatus.toUpperCase()}'!`,
      type: "success"
    });

    setAttendancePopup({
      isOpen: true,
      type: "success",
      studentName: foundStudent.nama_lengkap,
      studentPhoto: foundStudent.foto,
      studentKamar: foundStudent.kamar || "Belum Update",
      isFemale: foundStudent.jenis_kelamin === "P"
    });
  };

  const getStatus = (studentId: string | number): AttendanceStatus => {
    const sId = String(studentId);
    const key = `${selectedDate}_absensi_${activeSession}`;
    return attendanceDb[key]?.[sId] || "unmarked";
  };

  const updateStudentStatus = async (studentId: string | number, nextStatus: AttendanceStatus) => {
    const sId = String(studentId);
    const key = `${selectedDate}_absensi_${activeSession}`;
    
    updateLocalAttendance(key, sId, nextStatus);

    // Sync cloud Database
    await syncStudentStatusToSupabase(sId, nextStatus);
  };

  // Sorting & Filtration criteria
  // Only students with unmarked/alpa status show up in pending section
  const hydratedStudentsList = students.map((s) => {
    const itemStatus = getStatus(s.id || "");
    return {
      ...s,
      currentStatus: itemStatus,
    };
  });

  const roomsList = Array.from(
    new Set(hydratedStudentsList.map((s) => s.kamar).filter(Boolean))
  ).sort();

  const filteredStudents = hydratedStudentsList.filter((s) => {
    const term = searchQuery.toLowerCase();
    const matchSearch = 
      (s.nama_lengkap || "").toLowerCase().includes(term) ||
      (s.nama_panggilan || "").toLowerCase().includes(term) ||
      (s.kamar || "").toLowerCase().includes(term);

    const matchCategory = categoryFilter === "All" || s.kategori === categoryFilter;
    const matchRoom = roomFilter === "All" || s.kamar === roomFilter;

    return matchSearch && matchCategory && matchRoom;
  });

  const rekapFilteredStudents = filteredStudents.filter((s) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "unmarked") return s.currentStatus === "unmarked";
    return s.currentStatus === statusFilter;
  });

  // Students available to check attendance (unmarked)
  const studentsPending = filteredStudents.filter(s => s.currentStatus === "unmarked");

  // Statistics Calculation
  const getStats = () => {
    const statsStudents = hydratedStudentsList.filter((s) => {
      const matchCategory = categoryFilter === "All" || s.kategori === categoryFilter;
      const matchRoom = roomFilter === "All" || s.kamar === roomFilter;
      return matchCategory && matchRoom;
    });

    const total = statsStudents.length;
    let hadir = 0;
    let terlambat = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;
    let unmarked = 0;

    statsStudents.forEach((s) => {
      if (s.currentStatus === "hadir") hadir++;
      else if (s.currentStatus === "terlambat") terlambat++;
      else if (s.currentStatus === "sakit") sakit++;
      else if (s.currentStatus === "izin") izin++;
      else if (s.currentStatus === "alpa") alpa++;
      else unmarked++;
    });

    const markedCount = total - unmarked;
    const percentPresent = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;

    return { total, hadir, terlambat, sakit, izin, alpa, unmarked, markedCount, percentPresent };
  };

  const stats = getStats();

  const handleToggleRowAttendance = (studentId: string | number) => {
    if (activeSession === "none") {
      MySwal.fire({
        icon: 'error',
        title: 'MAAF TIDAK ADA SESI YANG AKTIF',
        text: 'Silakan tunggu atau set sesi absensi terlebih dahulu.',
        confirmButtonText: 'Try Again',
        confirmButtonColor: '#f87171',
        customClass: {
          popup: 'rounded-[2rem]',
        }
      });
      return;
    }

    const current = getStatus(studentId);
    if (current === "unmarked" || current === "alpa") {
      updateStudentStatus(studentId, isIqomahActive ? "terlambat" : "hadir");
      const foundStudent = students.find(s => String(s.id) === String(studentId));
      if (foundStudent) {
        setAttendancePopup({
          isOpen: true,
          type: "success",
          studentName: foundStudent.nama_lengkap,
          studentPhoto: foundStudent.foto,
          studentKamar: foundStudent.kamar || "Belum Update",
          isFemale: foundStudent.jenis_kelamin === "P"
        });
      }
    } else {
      updateStudentStatus(studentId, "unmarked");
    }
  };

  // Date Formatting helper Indonesian locale representation
  const formatIndoDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return dateString;
    }
  };

  const formatIndoMonth = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return dateString;
    }
  };

  // Week helper ranges
  const getWeekRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
  };

  const getPassedSessions = (dateStr: string) => {
    if (dateStr !== selectedDate) {
      return sessions.map(s => s.id);
    } else {
      if (!isSimulatingTime) {
        const now = new Date();
        const curH = now.getHours();
        const curM = now.getMinutes();
        const totalMinutes = curH * 60 + curM;
        const passedIds: string[] = [];

        sessions.forEach(sess => {
          try {
            const [startStr] = sess.time.replace(/\s/g, "").split("-");
            const [h, m] = startStr.split(".").map(Number);
            if (totalMinutes >= (h * 60 + m)) {
              passedIds.push(sess.id);
            }
          } catch(e) {}
        });
        return passedIds;
      }
      return sessions.map(s => s.id);
    }
  };

  const getStudentPeriodStats = (studentId: string | number) => {
    const sId = String(studentId);
    let hadir = 0;
    let terlambat = 0;
    let alpa = 0;
    let sessionsData: Record<string, Record<string, string>> = {};

    if (rekapTimeframe === "harian") {
      sessionsData[selectedDate] = {};
      const passedSessionIds = getPassedSessions(selectedDate);
      sessions.forEach(sess => {
        if (!passedSessionIds.includes(sess.id)) return;
        const mappedPresensi = mapLocalSessionToDbSession(sess.id, sessions).presensi;
        if (mappedPresensi !== rekapPresensiType) return;
        const key = `${selectedDate}_absensi_${sess.id}`;
        const status = attendanceDb[key]?.[sId] || "unmarked";
        sessionsData[selectedDate][sess.id] = status;
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
        sessionsData[dateStr] = {};

        const passedSessionIds = getPassedSessions(dateStr);

        sessions.forEach(sess => {
          if (!passedSessionIds.includes(sess.id)) return;
          const mappedPresensi = mapLocalSessionToDbSession(sess.id, sessions).presensi;
          if (mappedPresensi !== rekapPresensiType) return;
          const key = `${dateStr}_absensi_${sess.id}`;
          const status = attendanceDb[key]?.[sId] || "unmarked";
          sessionsData[dateStr][sess.id] = status;
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
        sessionsData[dateStr] = {};
        const passedSessionIds = getPassedSessions(dateStr);

        sessions.forEach(sess => {
          if (!passedSessionIds.includes(sess.id)) return;
          const mappedPresensi = mapLocalSessionToDbSession(sess.id, sessions).presensi;
          if (mappedPresensi !== rekapPresensiType) return;
          const key = `${dateStr}_absensi_${sess.id}`;
          const status = attendanceDb[key]?.[sId] || "unmarked";
          sessionsData[dateStr][sess.id] = status;
          if (status === "hadir") hadir++;
          else if (status === "terlambat") terlambat++;
          else if (status === "alpa" || status === "unmarked") alpa++;
        });
      }
    }

    return { hadir, terlambat, alpa, sessionsData };
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-4 px-2 space-y-6 flex flex-col items-stretch" id="attendance_menu_root">
      
      {/* 1. HEADER BRANDING */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 select-none pt-2" id="attendance_brand_header">
        <div>
          <h2 className="text-3xl font-black text-[#1d2757] dark:text-white font-display tracking-tight leading-none">
            Absensi Santri Digital
          </h2>
          <p className="text-xs text-[#566580] dark:text-slate-400 font-bold mt-2.5 flex flex-wrap items-center justify-start gap-1.5 uppercase tracking-wide">
            <span>Pondok Pesantren</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
            <span className="text-[#3b82f6]">Al Muttaqin</span>
            {supabaseSyncStatus === "connected" && (
              <>
                <span className="w-1 h-3 border-l border-slate-200 dark:border-slate-800"></span>
                <span className="text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900 px-1.5 py-0.5 rounded-lg text-[9px] font-black border border-sky-100 flex items-center gap-1 shadow-sm">
                  <span className="w-1 h-1 rounded-full bg-sky-500 animate-pulse"></span>
                  SINKRON ONLINE (CLOUD)
                </span>
              </>
            )}
            {supabaseSyncStatus === "loading" && (
              <>
                <span className="w-1 h-3 border-l border-slate-200 dark:border-slate-800"></span>
                <span className="text-slate-500 bg-slate-50 dark:bg-slate-900/40 px-1.5 py-0.5 rounded-lg text-[9px] font-black border border-slate-100 dark:border-slate-800 flex items-center gap-1 animate-pulse shadow-sm">
                  🔄 MENYELARASKAN...
                </span>
              </>
            )}
            {supabaseSyncStatus === "disabled" && (
              <>
                <span className="w-1 h-3 border-l border-slate-200 dark:border-slate-800"></span>
                <span className="text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900 px-1.5 py-0.5 rounded-lg text-[9px] font-black border border-amber-100 shadow-sm" title="Tabel 'absensi' belum aktif di Supabase. Sistem otomatis menyimpannya secara offline aman di Browser Storage Anda.">
                  LOKAL (OFFLINE-OK)
                </span>
              </>
            )}
            {supabaseSyncStatus === "error" && (
              <>
                <span className="w-1 h-3 border-l border-slate-200 dark:border-slate-800"></span>
                <span className="text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900 px-1.5 py-0.5 rounded-lg text-[9px] font-black border border-rose-100 shadow-sm flex items-center gap-1" title="Masalah jaringan database Supabase. Hubungkan wifi/paket data kembali.">
                  ⚠️ KONEKSI TERBATAS
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {supabaseSyncStatus === "error" && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 rounded-3xl p-5 md:p-6 space-y-4 shadow-sm" id="sync_error_alert">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">⚠️</span>
            <div className="space-y-1">
              <h4 className="font-extrabold text-base text-rose-800 dark:text-rose-300">
                Peringatan Sinkronisasi Supabase (Izin RLS Terkunci)
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
                Presensi saat ini tersimpan dengan aman secara <strong className="font-bold">LOKAL (Offline di Browser)</strong>, namun gagal dikirim ke tabel <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-rose-100 dark:border-slate-800 font-mono text-[11px] font-bold">absensi</code> di Supabase. Hal ini biasanya dikarenakan kebijakan Row Level Security (RLS) di Supabase yang belum dikonfigurasi / belum diizinkan untuk diakses publik.
              </p>
              {supabaseErrorMsg && (
                <div className="mt-2 text-[11px] font-mono bg-[#fff5f5] dark:bg-slate-900 p-2.5 rounded-xl border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 select-all overflow-x-auto">
                  Detail Error: {supabaseErrorMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. TAB CONTROLS switcher - PRESENSI, REKAP DATA, STATISTIK */}
      <div className="bg-white dark:bg-[#111c44] p-1 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm flex items-center select-none" id="attendance_tab_selector">
        <button
          onClick={() => setAttendanceSubTab("input")}
          className={`flex-1 py-3 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
            attendanceSubTab === "input"
              ? "bg-[#3e46ca] text-white shadow"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Presensi
        </button>
        <button
          onClick={() => setAttendanceSubTab("rekap")}
          className={`flex-1 py-3 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
            attendanceSubTab === "rekap"
              ? "bg-[#3e46ca] text-white shadow"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Rekap Data
        </button>
        <button
          onClick={() => setAttendanceSubTab("statistik")}
          className={`flex-1 py-3 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
            attendanceSubTab === "statistik"
              ? "bg-[#3e46ca] text-white shadow"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Statistik
        </button>
      </div>

      {/* 3. SESSION CARD INDIVIDUAL LISTENER */}
      <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in relative overflow-hidden" id="session_card_header">
        <div className="flex items-center gap-4 select-none">
          {/* Clock squircle box */}
          <div className="w-[54px] h-[54px] rounded-2xl bg-[#eef2ff] dark:bg-slate-900 flex items-center justify-center text-[#5b51ff] shrink-0">
            <Clock className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-extrabold text-[#94a3b8] tracking-[0.1em] leading-none mb-1.5">
              Sesi Aktif
            </span>
            <div className="text-2xl font-black text-[#1e1b4b] dark:text-white leading-none tracking-tight flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {activeSession !== "none" ? (
                <>
                  <span className="text-2xl shrink-0">{activeSessionObj.icon}</span>
                  <span>{activeSessionObj.label}</span>
                  <span className="text-xs uppercase font-extrabold px-2.5 py-1 rounded-xl font-mono bg-indigo-50/60 dark:bg-purple-950/30 border border-indigo-100/50 dark:border-slate-800 text-[#3e46ca] dark:text-indigo-300 ml-1.5 shadow-xs">
                    {activeSessionObj.time}
                  </span>
                </>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 font-bold text-lg flex items-center gap-1.5">
                  ⛔ Tidak ada sesi
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right status pills inside session bar */}
        <div className="flex flex-wrap items-center gap-3 select-none">
          {/* NFC Hardware Support Status Widget */}
          {!isNfcSupported ? (
            <button
              type="button"
              onClick={() => setShowNfcErrorModal(true)}
              className="bg-[#f8fafc] dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-150 dark:border-slate-800 text-[#64748b] dark:text-slate-400 text-[10.5px] font-black uppercase tracking-wider px-5 py-3 rounded-2xl flex items-center gap-2 shadow-sm transition-all duration-150 cursor-pointer select-none"
            >
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span>NFC TIDAK DIDUKUNG</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const nextState = !isNfcActive;
                if (nextState && activeSession === "none") {
                  MySwal.fire({
                    icon: 'error',
                    title: 'MAAF TIDAK ADA SESI YANG AKTIF',
                    text: 'Silakan tunggu atau set sesi absensi terlebih dahulu.',
                    confirmButtonText: 'Tutup',
                    confirmButtonColor: '#f87171',
                    customClass: {
                      popup: 'rounded-[2rem]',
                    }
                  });
                  return;
                }
                setIsNfcActive(nextState);
                if (nextState) setIsCameraActive(false);
                setScanFeedback(null);
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-sm ${
                isNfcActive 
                  ? "bg-[#10b981] text-white border-[#10b981] shadow-emerald-100 scale-[1.01]" 
                  : "bg-white dark:bg-[#111c44] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
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
              if (nextState && activeSession === "none") {
                MySwal.fire({
                  icon: 'error',
                  title: 'MAAF TIDAK ADA SESI YANG AKTIF',
                  text: 'Silakan tunggu atau set sesi absensi terlebih dahulu.',
                  confirmButtonText: 'Tutup',
                  confirmButtonColor: '#f87171',
                  customClass: {
                    popup: 'rounded-[2rem]',
                  }
                });
                return;
              }
              setIsCameraActive(nextState);
              if (nextState) setIsNfcActive(false);
              setScanFeedback(null);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer shadow-sm ${
              isCameraActive 
                ? "bg-[#3e46ca] text-white border-[#3e46ca] scale-[1.01]" 
                : "bg-white dark:bg-[#111c44] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>BARCODE: {isCameraActive ? "AKTIF" : "NONAKTIF"}</span>
          </button>

          {/* Iqomah Status Pill Row Block */}
          {isSholatActive && (
            <div className="flex items-center gap-3.5 bg-slate-50/55 dark:bg-slate-900 border border-slate-200/20 dark:border-slate-800 rounded-2xl pl-5 pr-3 py-1.5 select-none min-h-[48px]">
              <span className="text-[10.5px] font-black text-[#586884] dark:text-slate-400 uppercase tracking-wider">
                IQOMAH STATUS
              </span>
              <button
                type="button"
                onClick={toggleIqomah}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10.5px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                  isIqomahActive 
                    ? "bg-rose-50 dark:bg-rose-955 border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-105" 
                    : "bg-[#f0fdf4] dark:bg-green-955 border-[#bbf7d0] dark:border-green-900 text-[#15803d] dark:text-[#dcfce7] hover:bg-[#dcfce7]"
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
        <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm space-y-4 animate-fade-in relative overflow-hidden mt-4" id="active_sensor_panel">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h4 className="text-[11px] font-black text-[#1d2757] dark:text-white uppercase tracking-wider flex items-center gap-2">
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
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-extrabold text-[10px] uppercase tracking-wider bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer"
            >
              Tutup ✕
            </button>
          </div>

          <div className="max-w-md mx-auto space-y-4">
            {isNfcActive && (
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3 select-none">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#10b981] mx-auto">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10b981]"></span>
                  </span>
                </div>
                <div>
                  <h5 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Mencari Sinyal Kartu NFC...</h5>
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
            <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 space-y-4">
              
              {/* Header section with Dropdown Filter */}
              <div className="flex items-center justify-between select-none">
                <h3 className="text-xl font-extrabold text-[#111827] dark:text-white font-display">
                  Presensi Santri
                </h3>

                {/* Unit Dropdown Filter */}
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none"
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
                  className="w-full text-xs font-medium pl-10 pr-4 py-3 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-505 focus:bg-white dark:focus:bg-slate-850 text-slate-800 dark:text-white transition-all shadow-inner"
                />
              </div>

              {/* Student List Container */}
              <div className="grid grid-cols-1 gap-3 max-h-[550px] overflow-y-auto pr-1">
                {studentsPending.length > 0 ? (
                  studentsPending.map((student) => {
                    const avatarColor = "bg-indigo-50 text-indigo-700 dark:bg-slate-900 dark:text-slate-350";
                    const isFemale = student.jenis_kelamin === "P";

                    return (
                      <div 
                        key={student.id}
                        onClick={() => {
                          if (student.id) handleToggleRowAttendance(student.id);
                        }}
                        className="group bg-[#f8fafc] dark:bg-slate-900 hover:bg-slate-100/50 dark:hover:bg-slate-800/55 transition-all border border-slate-100/30 dark:border-slate-800/50 rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer h-fit"
                      >
                        {/* Left: Avatar & Name */}
                        <div className="flex items-center gap-3 min-w-0">
                          {student.foto ? (
                            <img src={student.foto} alt="" className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 object-cover shrink-0" />
                          ) : (
                            <div className={`w-10 h-10 rounded-full border dark:border-slate-850 flex items-center justify-center shrink-0 font-extrabold text-sm select-none ${avatarColor}`}>
                              <span>{(student.nama_lengkap || "S").charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="text-[13px] font-extrabold text-slate-800 dark:text-white leading-tight group-hover:text-[#3e46ca] dark:group-hover:text-indigo-400 transition-colors whitespace-nowrap">
                              {student.nama_lengkap}
                            </h4>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-0.5 block">
                              KAMAR: {student.kamar || "BELUM SET"} • {student.kategori || "Reguler"}
                            </span>
                          </div>
                        </div>

                        {/* Right: Icon Device & Check Trigger */}
                        <div className="flex items-center gap-3 shrink-0 select-none">
                          <Smartphone className="w-4 h-4 text-[#10b981]" />
                          
                          {/* Circular Tick-Box representation */}
                          <div className="w-5.5 h-5.5 rounded-full border-2 border-slate-350 dark:border-slate-700 flex items-center justify-center transition-all group-hover:border-indigo-400 bg-white dark:bg-slate-805 text-transparent group-hover:text-indigo-400">
                            <span className="text-[10px] font-bold block leading-none">✓</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-1 sm:col-span-2 p-12 text-center text-slate-400 select-none flex flex-col items-center justify-center space-y-2">
                    <div className="text-3xl">🎉</div>
                    <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">Inbox Zero / Selesai!</h4>
                    <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                      Semua santri yang terbit dalam daftar sandingan hari ini telah diinput absennya.
                    </p>
                  </div>
                )}
              </div>

              {/* Red Tactile Button */}
              {isSholatActive && (
                <button
                  type="button"
                  onClick={toggleIqomah}
                  className={`w-full py-4 rounded-2xl text-center text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md select-none ${
                    isIqomahActive 
                      ? "bg-[#ef4444] hover:bg-rose-600 animate-pulse ring-4 ring-rose-100 dark:ring-rose-950/40" 
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
            <div className="bg-indigo-50 dark:bg-[#111c44] text-indigo-900 dark:text-white rounded-3xl p-5 shadow-sm space-y-4 select-none animate-fade-in border border-indigo-100/60 dark:border-slate-800">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#4f46e5] dark:text-indigo-250">
                  KEHADIRAN LIVE SESI
                </span>
                <span className="text-5xl font-extrabold italic font-display text-indigo-950 dark:text-white mt-1 leading-none">
                  {stats.percentPresent}%
                </span>
              </div>
              
              <hr className="border-indigo-100/80 dark:border-slate-800" />

              <div className="text-xs font-semibold text-slate-700 dark:text-indigo-200">
                {stats.markedCount} dari {stats.total} santri hari ini
              </div>
            </div>

            {/* 7. LATE ARRIVALS CARD & STATUS MONITOR */}
            <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2.5 select-none animate-fade-in">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block pb-1">
                {isSholatActive ? "LATE ARRIVALS MONITOR" : "STATUS MONITOR PRESENSI"}
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-extrabold italic ${isSholatActive ? (isIqomahActive ? "text-[#ff2c55]" : "text-slate-400") : "text-indigo-500"}`}>
                  {isSholatActive ? (isIqomahActive ? "Aktif" : "Nonaktif") : "Berjalan"}
                </span>
              </div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 pt-1">
                Monitoring Sesi {activeSessionObj?.label}
              </h4>
              <p className="text-[10px] text-slate-400 leading-normal">
                {isSholatActive 
                  ? "Santri yang absen setelah iqomah tercatat otomatis sebagai terlambat."
                  : (() => {
                      const pType = mapLocalSessionToDbSession(activeSessionObj?.id || "", sessions).presensi;
                      if (pType === "makan") return "Pemindaian akan mencatat status pengambilan makan santri pada sesi ini.";
                      if (pType === "ngaji") return "Pemindaian akan mencatat kehadiran ngaji santri pada sesi ini.";
                      if (pType === "sekolah") return "Pemindaian akan mencatat kehadiran sekolah santri pada sesi ini.";
                      return `Pemindaian akan otomatis mencatat kehadiran santri untuk sesi ${activeSessionObj?.label}.`;
                    })()
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* B. REKAP DATA VIEW (REKAP DATA) */}
      {attendanceSubTab === "rekap" && (
        <div className="space-y-4 animate-fade-in" id="attendance_rekap_section">
          
          {/* TIMEFRAME SELECTION SWITCHER */}
          <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 select-none animate-fade-in animate-fade-in">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
              Pilih Ruang Lingkup Rekapitulasi:
            </h4>
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xs w-full md:max-w-sm" id="rekap_timeframe_switcher">
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
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4 animate-fade-in">
            
            {/* Context Header & Date Filters depending on active timeframe */}
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-[#1d2757] dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>📁 Laporan Kehadiran</span>
                <span className="text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-400 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest border border-sky-100 dark:border-sky-900">
                  {rekapTimeframe.toUpperCase()}
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 mb-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#3b82f6]">Jenis Rekapitulasi</label>
                  <select
                    value={rekapPresensiType}
                    onChange={(e) => setRekapPresensiType(e.target.value)}
                    className="w-full text-xs font-bold px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                  >
                    <option value="sholat">🕌 Presensi Sholat</option>
                    <option value="makan">🍽️ Presensi Makan</option>
                    <option value="ngaji">📖 Presensi Ngaji</option>
                    <option value="sekolah">🎒 Presensi Sekolah</option>
                  </select>
                </div>
              </div>

              {rekapTimeframe === "harian" && (
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
                    className="w-full max-w-sm text-xs font-bold leading-normal px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                  />
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
                      className="w-full max-w-sm text-xs font-bold leading-normal px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900 flex items-center gap-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-350 leading-normal">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                    <span>
                      Minggu Terpilih: <strong className="text-indigo-900 dark:text-indigo-400">{formatIndoDate(getWeekRange(selectedDate).monday.toISOString().slice(0, 10))}</strong> s.d. <strong className="text-indigo-900 dark:text-indigo-400">{formatIndoDate(getWeekRange(selectedDate).sunday.toISOString().slice(0, 10))}</strong>
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
                      className="w-full max-w-sm text-xs font-bold leading-normal px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="bg-[#10b981]/5 dark:bg-green-950/30 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/60 flex items-center gap-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-350 leading-normal">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0"></span>
                    <span>
                      Bulan Terpilih: <strong className="text-emerald-950 dark:text-emerald-400 font-extrabold">{formatIndoMonth(selectedDate)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {rekapTimeframe !== "harian" && (
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider py-1">
                📊 Data Rekapitulasi Menyerang Hadir, Telat, dan Alfa
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
                className="w-full text-[11px] font-medium pl-8.5 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            {/* Scrollable list of Rekap */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[550px] overflow-y-auto pr-1">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const isFemale = student.jenis_kelamin === "P";
                  const pPeriodStats = getStudentPeriodStats(student.id);

                  if (rekapPresensiType === "makan") {
                    if (rekapTimeframe === "harian") {
                      const sessionsTodayData = pPeriodStats.sessionsData[selectedDate] || {};
                      const getSessionStatus = (keyword: string) => {
                          const s = sessions.find(sess => mapLocalSessionToDbSession(sess.id, sessions).presensi === "makan" && sess.label.toLowerCase().includes(keyword));
                          if (!s) return "unmarked";
                          return sessionsTodayData[s.id] || "unmarked";
                      };
                      const pagi = getSessionStatus("pagi");
                      const siang = getSessionStatus("siang");
                      const sore = getSessionStatus("sore");
                      const countMakan = (pagi==="hadir"?1:0) + (siang==="hadir"?1:0) + (sore==="hadir"?1:0);

                      return (
                        <div key={student.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 overflow-hidden relative shrink-0 shadow-xs">
                              {student.foto ? <img src={student.foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg select-none">{isFemale ? "🧕" : "👳"}</div>}
                            </div>
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-800 dark:text-white block text-sm leading-snug truncate whitespace-nowrap">{student.nama_lengkap}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">KAMAR: <strong className="text-slate-600 dark:text-slate-350">{student.kamar || "Belum Set"}</strong></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 select-none self-end md:self-auto">
                            <div className="flex flex-col items-center px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-3xs">
                              <span className="text-slate-400 text-[9px] font-extrabold uppercase">Pagi</span>
                              <span className="text-sm">{pagi === "hadir" ? "✅" : "❌"}</span>
                            </div>
                            <div className="flex flex-col items-center px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-3xs">
                              <span className="text-slate-400 text-[9px] font-extrabold uppercase">Siang</span>
                              <span className="text-sm">{siang === "hadir" ? "✅" : "❌"}</span>
                            </div>
                            <div className="flex flex-col items-center px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-3xs">
                              <span className="text-slate-400 text-[9px] font-extrabold uppercase">Sore</span>
                              <span className="text-sm">{sore === "hadir" ? "✅" : "❌"}</span>
                            </div>
                            <div className="flex flex-col items-center px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-3xs ml-2">
                              <span className="text-indigo-600 dark:text-indigo-400 text-[9px] font-extrabold uppercase">Rekap</span>
                              <strong className="text-indigo-800 dark:text-indigo-300 font-black text-sm">{countMakan}x</strong>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const total = pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa;
                      const persentase = total > 0 ? Math.round(((pPeriodStats.hadir + pPeriodStats.terlambat) / total) * 100) : 0;
                      return (
                        <div key={student.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 overflow-hidden relative shrink-0 shadow-xs">
                              {student.foto ? <img src={student.foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg select-none">{isFemale ? "🧕" : "👳"}</div>}
                            </div>
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-800 dark:text-white block text-sm leading-snug truncate whitespace-nowrap">{student.nama_lengkap}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">KAMAR: <strong className="text-slate-600 dark:text-slate-350">{student.kamar || "Belum Set"}</strong></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 select-none self-end md:self-auto">
                            <div className="flex flex-col items-center px-3 py-1 bg-emerald-50 dark:bg-green-950/20 border border-emerald-200/60 dark:border-green-900/40 rounded-xl">
                              <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Hadir/Makan</span>
                              <strong className="text-emerald-800 dark:text-emerald-400 font-black text-xs">{pPeriodStats.hadir + pPeriodStats.terlambat}</strong>
                            </div>
                            <div className="flex flex-col items-center px-3 py-1 bg-rose-50 dark:bg-rose-950/20 border border-rose-250/60 dark:border-rose-900/40 rounded-xl">
                              <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Tidak Makan</span>
                              <strong className="text-rose-800 dark:text-rose-400 font-black text-xs">{pPeriodStats.alpa}</strong>
                            </div>
                            <div className="flex items-center justify-center px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-[#3e46ca] dark:text-indigo-400 font-mono text-sm ml-2 w-16 text-center">
                              {persentase}%
                            </div>
                          </div>
                        </div>
                      );
                    }
                  } else {
                    // Default / Sholat logic
                    const total = pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa;
                    const persentase = total > 0 ? Math.round(((pPeriodStats.hadir + pPeriodStats.terlambat) / total) * 100) : 0;
                    return (
                      <div key={student.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 overflow-hidden relative shrink-0 shadow-xs">
                            {student.foto ? <img src={student.foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg select-none">{isFemale ? "🧕" : "👳"}</div>}
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-slate-800 dark:text-white block text-sm leading-snug truncate whitespace-nowrap">{student.nama_lengkap}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">KAMAR: <strong className="text-slate-600 dark:text-slate-350">{student.kamar || "Belum Set"}</strong></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 select-none self-end md:self-auto">
                          <div className="flex flex-col items-center px-3 py-1 bg-emerald-50 dark:bg-green-950/20 border border-emerald-200/60 dark:border-green-900/40 rounded-xl shadow-3xs">
                            <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Hadir</span>
                            <strong className="text-emerald-800 dark:text-emerald-400 font-black text-xs">{pPeriodStats.hadir}</strong>
                          </div>
                          <div className="flex flex-col items-center px-3 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-250/60 dark:border-amber-900/40 rounded-xl shadow-3xs">
                            <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Telat</span>
                            <strong className="text-amber-800 dark:text-amber-400 font-black text-xs">{pPeriodStats.terlambat}</strong>
                          </div>
                          <div className="flex flex-col items-center px-3 py-1 bg-rose-50 dark:bg-rose-950/20 border border-rose-250/60 dark:border-rose-900/40 rounded-xl shadow-3xs">
                            <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Alfa</span>
                            <strong className="text-rose-800 dark:text-rose-400 font-black text-xs">{pPeriodStats.alpa}</strong>
                          </div>
                          <div className="flex flex-col items-center justify-center px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ml-2 w-16 text-center">
                            <span className="text-slate-500 dark:text-slate-400 text-[8px] font-extrabold uppercase mb-0.5 leading-none">Rasio</span>
                            <strong className="text-[#3e46ca] dark:text-indigo-400 font-mono text-sm leading-none">{persentase}%</strong>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })
              ) : (
                <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-2xl text-xs font-bold leading-normal">
                  Tidak ada data yang cocok.
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
          <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6">
            <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider text-center border-b border-slate-55 dark:border-slate-800 pb-2">
              Ringkasan Analitik Sesi
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Radial gauge on left or column on mobile */}
              <div className="flex flex-col items-center justify-center py-2 text-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 md:pr-4">
                <div className="relative flex items-center justify-center w-36 h-36 mb-4">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      className="stroke-slate-100 dark:stroke-slate-800"
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
                    <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">{stats.percentPresent}%</span>
                    <span className="text-[8px] text-slate-400 uppercase tracking-widest font-black mt-2">Kehadiran</span>
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-650 dark:text-slate-300">
                  Selesai Input: <span className="font-extrabold text-[#3e46ca] dark:text-indigo-400">{stats.markedCount}</span> dari <span className="font-extrabold text-slate-900 dark:text-white">{stats.total}</span> santri
                </div>
              </div>

              {/* Breakdown item bars on right */}
              <div className="space-y-3.5">
                {[
                  { label: "Hadir", count: stats.hadir, color: "bg-emerald-500", rawColor: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-green-950/20" },
                  { label: "Terlambat", count: stats.terlambat, color: "bg-amber-400 animate-pulse", rawColor: "text-[#854d0e] bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20" },
                  { label: "Sakit", count: stats.sakit, color: "bg-yellow-400", rawColor: "text-yellow-700 bg-yellow-50 dark:text-yellow-450 dark:bg-yellow-950/20" },
                  { label: "Izin", count: stats.izin, color: "bg-blue-400", rawColor: "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20" },
                  { label: "Alpa (Tanpa Keterangan)", count: stats.alpa, color: "bg-rose-400", rawColor: "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20" },
                  { label: "Belum Absen", count: stats.unmarked, color: "bg-slate-300 dark:bg-slate-700", rawColor: "text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-900" },
                ].map((item) => {
                  const ratio = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-mono leading-none ${item.rawColor}`}>
                          {item.count} santri ({Math.round(ratio)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-50 dark:bg-slate-900 h-2 rounded-full overflow-hidden">
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
      <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold select-none py-1 border-t border-slate-100 dark:border-slate-800 uppercase tracking-widest mt-2" id="attendance_panel_footer">
        <span>CONNECTED • SYSTEM ONLINE</span>
        <span>AL MUTTAQIN V1</span>
      </div>

      {/* NFC INVALID/NOT SUPPORTED DIALOG MODAL */}
      {showNfcErrorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 cursor-pointer" id="nfc-dialog-overlay" onClick={() => setShowNfcErrorModal(false)}>
          <div className="bg-white dark:bg-[#111c44] rounded-3xl p-6 max-w-sm w-full border border-slate-105 dark:border-slate-800 shadow-2xl text-center space-y-4 animate-scale-up" id="nfc-dialog-card" onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-505 mx-auto">
              <Smartphone className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                NFC Tidak Tersedia
              </h3>
              <p className="text-[11px] text-slate-505 dark:text-slate-400 leading-relaxed font-semibold">
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
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0a0a1a]/55 backdrop-blur-md transition-opacity duration-300 font-sans cursor-pointer" 
          id="absensi-custom-popup-overlay"
          onClick={() => {
            if (attendancePopup.type === "success") {
              setAttendancePopup(null);
            }
          }}
        >
          {attendancePopup.type === "success" ? (
            <div 
              className="relative bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-[#10b981] p-8 max-w-[320px] w-full shadow-2xl text-center pt-8 pb-6 animate-scale-up" 
              id="absensi-success-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#10b981] border-2 border-white shadow-md flex items-center justify-center text-white">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>

              <div className="w-24 h-28 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-auto overflow-hidden relative shadow-sm mb-4">
                {attendancePopup.studentPhoto ? (
                  <img src={attendancePopup.studentPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(attendancePopup.studentName || 'Student')}&background=random&size=150`} alt="" className="w-full h-full object-cover bg-slate-100" />
                )}
                <div className="absolute inset-x-0 bottom-0 py-0.5 bg-emerald-500 text-[8px] text-white font-black tracking-widest uppercase">
                  AKTIF
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="text-2xl font-black text-[#10b981] tracking-tight leading-none uppercase">
                  BERHASIL
                </h3>
                <h4 className="text-lg font-bold text-slate-800 dark:text-white leading-snug px-2 truncate mt-3" title={attendancePopup.studentName}>
                  {attendancePopup.studentName}
                </h4>
                <p className="text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full w-fit mx-auto mt-2">
                  Kamar: {attendancePopup.studentKamar}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAttendancePopup(null)}
                className="w-full bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-sm uppercase tracking-widest py-3.5 rounded-2xl transition-all shadow-md hover:shadow-lg cursor-pointer transform active:scale-[0.98]"
              >
                Lanjutkan
              </button>
            </div>
          ) : attendancePopup.type === "error" && (
            <div 
              className="relative bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-rose-500 p-8 max-w-[320px] w-full shadow-2xl text-center pt-10 pb-6 animate-scale-up border-rose-500" 
              id="absensi-error-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-rose-500 border-2 border-white shadow-md flex items-center justify-center text-white">
                <svg className="w-5 h-5 stroke-[3]" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              <div className="mb-4">
                {attendancePopup.reason === "already_scanned" ? (
                  <div className="w-24 h-28 bg-rose-50 dark:bg-rose-955 border-2 border-rose-200 dark:border-rose-900 rounded-2xl mx-auto overflow-hidden relative shadow-sm">
                    {attendancePopup.studentPhoto ? (
                      <img src={attendancePopup.studentPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 dark:bg-rose-900 text-indigo-950">
                        <span className="text-4xl filter saturate-75 drop-shadow">
                          {attendancePopup.isFemale ? "🧕" : "👳"}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 py-0.5 bg-rose-505 bg-rose-500 text-[8px] text-white font-black tracking-widest uppercase animate-pulse">
                      DOUBLE
                    </div>
                  </div>
                ) : (
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

              <h3 className="text-xl font-black text-rose-550 text-rose-500 tracking-tight leading-none uppercase mb-2">
                {attendancePopup.reason === "already_scanned" ? "SUDAH ABSEN" : "ID TIDAK DIKENAL"}
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold px-1 mb-6">
                {attendancePopup.reason === "already_scanned" ? (
                  <>
                    Siswa <span className="text-slate-800 dark:text-white font-extrabold">{attendancePopup.studentName}</span> sudah melakukan absensi sebelumnya pada sesi ini.
                  </>
                ) : attendancePopup.reason === "unregistered_card" ? (
                  "Maaf kartu Anda belum terdaftar, silakan menghubungi admin."
                ) : (
                  attendancePopup.customMessage || "Gagal melakukan absensi."
                )}
              </p>

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
