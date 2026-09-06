import { SearchableSelect } from './ui/SearchableSelect';
import React, { useState, useEffect, useRef, useMemo } from "react";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
const MySwal = withReactContent(Swal);
import { SantriData, supabase } from "../supabaseClient";
import { parseNfcPayload, normalizeNfcId } from "./NfcRegisterPanel";
import { BrowserQRCodeReader, BrowserCodeReader, IScannerControls } from "@zxing/browser";
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
  Video,
  Download,
  X,
  MessageSquare,
  Trash2,
  Send,
  Cpu,
  ArrowRightLeft,
  Usb,
  Sparkles,
  AlertCircle,
  Lock,
  ArrowUpDown,
  FileSpreadsheet,
  Eye,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  ChevronLeft,
  XCircle,
  School,
  BookOpen
} from "lucide-react";
import { useEsp32NfcListener } from "../hooks/useEsp32NfcListener";
import Esp32NfcGuideModal from "./Esp32NfcGuideModal";
import NfcUidConverterModal from "./NfcUidConverterModal";
import { convertNfcUid } from "../utils/nfcConverter";
import RekapSekolahComingSoon from "./RekapSekolahComingSoon";

interface PresensiPanelProps {
  students: SantriData[];
  rooms?: string[];
  viewMode?: "absensi" | "rekap";
  defaultTab?: "input" | "rekap" | "statistik" | "whatsapp";
  activeMenu?: string; // made optional to support seamless transition to unified absensi menu
  currentUserGender?: string;
  defaultRekapSubMenu?: "sholat" | "sekolah";
  onSubMenuChange?: (sub: "sholat" | "sekolah") => void;
}

type AttendanceStatus = "hadir" | "terlambat" | "sakit" | "izin" | "alpa" | "unmarked" | "pulang";

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
    let presensi = sess.presensi;
    if (!presensi || presensi === "ngaji") {
      const lblL = (sess.label || "").toLowerCase();
      const idL = (sess.id || "").toLowerCase();
      if (["subuh", "dzuhur", "zuhur", "dhuhur", "asar", "ashar", "maghrib", "isya"].some(p => lblL.includes(p) || idL.includes(p))) {
        presensi = "sholat";
      }
    }
    return {
      sesi: sess.label,
      presensi: presensi || "sholat"
    };
  }

  // Fallback if not found in state
  const idLower = (sessionId || "").toLowerCase();
  
  // Determine "presensi" column value (e.g., sholat, makan)
  let presensi = "sholat";
  if (idLower.includes("makan")) {
    presensi = "makan";
  } else if (idLower.includes("doa")) {
    presensi = "doa malam";
  } else if (idLower.includes("ngaji")) {
    presensi = "ngaji";
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
  const sLower = (dbSesi || "").toLowerCase().trim();
  const pLower = (dbPresensi || "").toLowerCase().trim();

  // 1. Direct match with matching label and presensi
  const sess = sessions.find(s => 
    s.label.toLowerCase().trim() === sLower && 
    (!pLower || !s.presensi || s.presensi.toLowerCase().trim() === pLower)
  );
  if (sess) return sess.id;
  
  // 2. Direct match by label or ID
  const sessByLabel = sessions.find(s => 
    s.label.toLowerCase().trim() === sLower || 
    s.id.toLowerCase().trim() === sLower
  );
  if (sessByLabel) return sessByLabel.id;

  // 3. Normalized names (e.g. ashar <-> asar, zuhur <-> dzuhur)
  const norm = (str: string) => str.toLowerCase()
    .replace(/ashar/g, "asar")
    .replace(/zuhur/g, "dzuhur")
    .replace(/dhuhur/g, "dzuhur")
    .replace(/isya'/g, "isya")
    .trim();
  const normDb = norm(sLower);
  const sessByNorm = sessions.find(s => norm(s.label) === normDb || norm(s.id) === normDb);
  if (sessByNorm) return sessByNorm.id;

  // 4. Meal sessions
  if (sLower === "pagi" || (pLower === "makan" && sLower === "pagi")) {
    return "makan_pagi";
  }
  if (sLower === "siang" || (pLower === "makan" && sLower === "siang")) {
    return "makan_siang";
  }
  if (sLower === "sore" || (pLower === "makan" && sLower === "sore")) {
    return "makan_sore";
  }
  if (sLower === "doa_malam" || sLower === "doa_malam_sesi") {
    return "doa_malam_sesi";
  }

  // 5. Canonical prayer id fallbacks
  if (normDb.includes("subuh")) return "subuh";
  if (normDb.includes("dzuhur")) return "dzuhur";
  if (normDb.includes("asar")) return "asar";
  if (normDb.includes("maghrib")) return "maghrib";
  if (normDb.includes("isya")) return "isya";

  return dbSesi;
}

export default function PresensiPanel({ 
  students, 
  rooms, 
  viewMode = "absensi", 
  defaultTab,
  defaultRekapSubMenu = "sholat",
  onSubMenuChange
}: PresensiPanelProps) {
  // Sub-menu Rekap: "sholat" | "sekolah"
  const [rekapSubMenu, setRekapSubMenu] = useState<"sholat" | "sekolah">(defaultRekapSubMenu || "sholat");

  useEffect(() => {
    if (defaultRekapSubMenu) {
      setRekapSubMenu(defaultRekapSubMenu);
    }
  }, [defaultRekapSubMenu]);

  const handleRekapSubMenuChange = (sub: "sholat" | "sekolah") => {
    setRekapSubMenu(sub);
    if (sub === "sholat") {
      setRekapPresensiType("sholat");
    }
    if (onSubMenuChange) {
      onSubMenuChange(sub);
    }
  };

  // Configured date
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
      { id: "subuh", label: "Subuh", time: "04.00 - 08.00", icon: "🌅", presensi: "sholat" },
      { id: "dzuhur", label: "Dzuhur", time: "11.45 - 12.30", icon: "☀️", presensi: "sholat" },
      { id: "asar", label: "Asar", time: "14.50 - 15.30", icon: "🌤️", presensi: "sholat" },
      { id: "maghrib", label: "Maghrib", time: "17.20 - 18.00", icon: "🌇", presensi: "sholat" },
      { id: "isya", label: "Isya", time: "18.30 - 19.15", icon: "🌌", presensi: "sholat" },
      { id: "doa_malam_sesi", label: "Doa Malam", time: "03.30 - 04.15", icon: "🌌", presensi: "doa malam" },
      { id: "makan_pagi", label: "Makan Pagi", time: "06.00 - 07.15", icon: "🍳", presensi: "makan" },
      { id: "makan_siang", label: "Makan Siang", time: "11.00 - 12.00", icon: "🍛", presensi: "makan" },
      { id: "makan_sore", label: "Makan Sore", time: "16.30 - 17.15", icon: "🍲", presensi: "makan" }
    ];
    return defaults;
  });

  const fetchSessionsFromDb = async () => {
    try {
      const { data, error } = await supabase.from("sesi_absensi").select("*").order("jam mulai", { ascending: true });
      if (error) throw error;
      
      if (data && data.length > 0) {
        const loadedSessions = data.map((d: any) => {
          let presensi = d.presensi;
          if (!presensi) {
            const sLower = (d.sesi || "").toLowerCase();
            if (["subuh", "dzuhur", "zuhur", "asar", "ashar", "maghrib", "isya"].some(p => sLower.includes(p))) {
              presensi = "sholat";
            } else if (sLower.includes("makan")) {
              presensi = "makan";
            } else if (sLower.includes("doa")) {
              presensi = "doa malam";
            } else {
              presensi = "sholat";
            }
          }
          return {
            id: d.id ? d.id.toString() : d.sesi.replace(/\s/g, "_"),
            label: d.sesi,
            time: `${String(d["jam mulai"]).replace(":", ".")} - ${String(d["jam selesai"]).replace(":", ".")}`,
            icon: d.ikon || "⏰",
            presensi
          };
        });
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
  const [attendanceSubTab, setAttendanceSubTab] = useState<"input" | "rekap" | "statistik" | "whatsapp">(
    defaultTab || (viewMode === "rekap" ? "rekap" : "input")
  );

  useEffect(() => {
    if (viewMode === "rekap" && attendanceSubTab === "input") {
      setAttendanceSubTab("rekap");
    } else if (viewMode === "absensi" && attendanceSubTab !== "input") {
      setAttendanceSubTab("input");
    }
  }, [viewMode]);
  
  // WhatsApp notification configuration & logs
  const [waGatewayType, setWaGatewayType] = useState<"manual" | "fonnte" | "custom">(() => {
    return (localStorage.getItem("wa_gateway_type") as "manual" | "fonnte" | "custom") || "manual";
  });
  const [waApiKey, setWaApiKey] = useState<string>(() => {
    return localStorage.getItem("wa_api_key") || "";
  });
  const [waCustomUrl, setWaCustomUrl] = useState<string>(() => {
    return localStorage.getItem("wa_custom_url") || "";
  });
  const [waTemplate, setWaTemplate] = useState<string>(() => {
    return localStorage.getItem("wa_template") || 
      `*LAPORAN KEHADIRAN SANTRI*\n\nAssalamualaikum Wr. Wb.\n\nYth. Orang Tua/Wali dari *{nama}*,\n\nMenginfokan bahwa santri tersebut telah tercatat mengikuti presensi:\n\n- *Sesi*: {sesi}\n- *Kegiatan*: {tipe}\n- *Waktu*: {waktu} WIB\n- *Tanggal*: {tanggal}\n- *Status Kehadiran*: *{status}*\n\nTerima kasih atas perhatian dan dukungannya.\n\n_Pondok Pesantren Al Muttaqin Madiun_`;
  });
  const [isWaAutoSendEnabled, setIsWaAutoSendEnabled] = useState<boolean>(() => {
    return localStorage.getItem("wa_auto_send") !== "false"; // default true
  });
  const [waLogs, setWaLogs] = useState<Array<{
    id: string;
    studentName: string;
    phone: string;
    status: "success" | "failed" | "manual";
    timestamp: string;
    message: string;
    errorMsg?: string;
  }>>(() => {
    const saved = localStorage.getItem("wa_logs");
    return saved ? JSON.parse(saved) : [];
  });

  // Persist WhatsApp Settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("wa_gateway_type", waGatewayType);
  }, [waGatewayType]);
  useEffect(() => {
    localStorage.setItem("wa_api_key", waApiKey);
  }, [waApiKey]);
  useEffect(() => {
    localStorage.setItem("wa_custom_url", waCustomUrl);
  }, [waCustomUrl]);
  useEffect(() => {
    localStorage.setItem("wa_template", waTemplate);
  }, [waTemplate]);
  useEffect(() => {
    localStorage.setItem("wa_auto_send", String(isWaAutoSendEnabled));
  }, [isWaAutoSendEnabled]);
  useEffect(() => {
    localStorage.setItem("wa_logs", JSON.stringify(waLogs));
  }, [waLogs]);

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

  // ESP32 RC522 Reader State & Hook for attendance scanning
  const [showEsp32GuideModal, setShowEsp32GuideModal] = useState(false);
  const [showConverterModal, setShowConverterModal] = useState(false);
  const [converterInitialUid, setConverterInitialUid] = useState("08:08:A1:B2");

  const { wifiStatus, isSerialConnected } = useEsp32NfcListener({
    onCardTapped: (uid) => {
      if (executeScanRef.current) {
        executeScanRef.current(uid, "nfc");
      }
    },
    enabled: true
  });
  const [isManualDate, setIsManualDate] = useState(false);
  const [rekapTimeframe, setRekapTimeframe] = useState<"harian" | "mingguan" | "bulanan">("harian");
  const [rekapPresensiType, setRekapPresensiType] = useState<string>("sholat");
  const [rekapSesiFilter, setRekapSesiFilter] = useState<string>("semua");
  const [rekapBelumAbsenFilter, setRekapBelumAbsenFilter] = useState<"semua" | "belum_absen" | "sudah_absen">("semua");
  const [rekapSortBy, setRekapSortBy] = useState<"ranking" | "terendah" | "nama">("ranking");
  
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  
  // Modal for clicking student name to view detailed 5 prayer sessions
  const [selectedStudentForPrayerDetail, setSelectedStudentForPrayerDetail] = useState<any | null>(null);
  const [studentPrayerRecords, setStudentPrayerRecords] = useState<any[]>([]);
  const [isLoadingPrayerDetail, setIsLoadingPrayerDetail] = useState<boolean>(false);
  const [prayerDetailDate, setPrayerDetailDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [rawAttendanceRows, setRawAttendanceRows] = useState<any[]>([]);

  const [downloadOptions, setDownloadOptions] = useState<{
    kamar: string;
    timeframe: "harian" | "mingguan" | "bulanan";
    tanggal: string;
    filterStatus?: "semua" | "belum_absen" | "sudah_absen";
  }>({
    kamar: "All",
    timeframe: "harian",
    tanggal: new Date().toISOString().slice(0, 10),
    filterStatus: "semua",
  });

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

  // Auto-close attendance popup after 1.5 seconds (1500ms)
  // If next person scans, attendancePopup state changes immediately, replacing with the new student
  useEffect(() => {
    if (!attendancePopup?.isOpen) return;

    const timer = setTimeout(() => {
      setAttendancePopup(null);
    }, 1500);

    return () => clearTimeout(timer);
  }, [attendancePopup]);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
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

  // Helper to normalize phone numbers to international WA standard (e.g., 628xxxxxx)
  const normalizePhoneNumber = (phone: string): string => {
    if (!phone) return "";
    let clean = phone.replace(/\D/g, ""); // remove non-digits
    if (clean.startsWith("00")) {
      clean = clean.slice(2);
    }
    if (clean.startsWith("620")) {
      clean = "62" + clean.slice(3);
    }
    if (clean.startsWith("0")) {
      clean = "62" + clean.slice(1);
    } else if (clean.startsWith("8")) {
      clean = "62" + clean;
    }
    return clean;
  };

  // Helper to construct template message
  const formatNotificationMessage = (
    student: SantriData,
    status: string,
    sessionLabel: string,
    sessionType: string,
    time: string,
    date: string
  ): string => {
    let msg = waTemplate;
    msg = msg.replace(/{nama}/g, student.nama_lengkap || "");
    msg = msg.replace(/{panggilan}/g, student.nama_panggilan || student.nama_lengkap || "");
    msg = msg.replace(/{sesi}/g, sessionLabel);
    msg = msg.replace(/{tipe}/g, sessionType.toUpperCase());
    msg = msg.replace(/{waktu}/g, time);
    msg = msg.replace(/{tanggal}/g, date);
    msg = msg.replace(/{status}/g, status.toUpperCase());
    return msg;
  };

  // Core WhatsApp Sender function
  const triggerWaNotification = async (
    student: SantriData,
    status: string,
    isManualClick = false
  ) => {
    const parentPhone = student.no_hp_ortu ? student.no_hp_ortu.trim() : "";
    if (!parentPhone) {
      if (isManualClick) {
        MySwal.fire({
          icon: "error",
          title: "Gagal Mengirim",
          text: `Santri ${student.nama_lengkap} belum memiliki nomor WhatsApp Orang Tua terdaftar. Silakan edit data santri untuk menambahkannya.`
        });
      }
      return "";
    }

    const cleanPhone = normalizePhoneNumber(parentPhone);
    const sessionLabel = activeSessionObj?.label || "Harian";
    const sessionType = mapLocalSessionToDbSession(activeSessionObj?.id || "", sessions).presensi || "Lainnya";
    
    // Format Date & Time
    const todayStr = new Date(selectedDate).toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    const timeStr = isSimulatingTime ? simulatedTimeVal.replace(".", ":") : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + " WIB";

    const messageText = formatNotificationMessage(
      student,
      status === "hadir" ? "Hadir Tepat Waktu" : status === "terlambat" ? "Terlambat" : status,
      sessionLabel,
      sessionType,
      timeStr,
      todayStr
    );

    const logId = Math.random().toString(36).substring(2, 11);
    const timestampStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ", " + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    // 1. MANUAL REDIRECTION MODE
    if (waGatewayType === "manual") {
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
      
      // Save log
      setWaLogs(prev => [
        {
          id: logId,
          studentName: student.nama_lengkap,
          phone: parentPhone,
          status: "manual",
          timestamp: timestampStr,
          message: messageText
        },
        ...prev.slice(0, 49) // Keep last 50 logs
      ]);

      if (isManualClick) {
        window.open(waUrl, "_blank");
      }
      return waUrl; // Return the URL so popup can trigger it
    }

    // 2. AUTOMATIC FONNTE MODE
    if (waGatewayType === "fonnte") {
      if (!waApiKey) {
        if (isManualClick) {
          MySwal.fire({
            icon: "warning",
            title: "API Token Belum Diset",
            text: "Silakan masukkan Token API Fonnte Anda terlebih dahulu di tab WhatsApp."
          });
        }
        return "";
      }

      try {
        const formDataPayload = new FormData();
        formDataPayload.append("target", cleanPhone);
        formDataPayload.append("message", messageText);
        formDataPayload.append("countryCode", "62"); // default ID country code

        const response = await fetch("https://api.fonnte.com/send", {
          method: "POST",
          headers: {
            "Authorization": waApiKey
          },
          body: formDataPayload
        });

        const resData = await response.json();
        
        if (resData.status || resData.status === true) {
          setWaLogs(prev => [
            {
              id: logId,
              studentName: student.nama_lengkap,
              phone: parentPhone,
              status: "success",
              timestamp: timestampStr,
              message: messageText
            },
            ...prev.slice(0, 49)
          ]);
          if (isManualClick) {
            MySwal.fire({
              icon: "success",
              title: "Terkirim",
              text: `Notifikasi WhatsApp otomatis berhasil dikirim ke orang tua ${student.nama_lengkap}!`
            });
          }
        } else {
          throw new Error(resData.reason || "Ditolak oleh Fonnte. Periksa koneksi perangkat Anda di dashboard Fonnte.");
        }
      } catch (err: any) {
        setWaLogs(prev => [
          {
            id: logId,
            studentName: student.nama_lengkap,
            phone: parentPhone,
            status: "failed",
            timestamp: timestampStr,
            message: messageText,
            errorMsg: err.message
          },
          ...prev.slice(0, 49)
        ]);
        if (isManualClick) {
          MySwal.fire({
            icon: "error",
            title: "Pengiriman Gagal",
            text: `Gagal mengirim via Fonnte: ${err.message}. Pastikan status device Anda 'Connect' di fonnte.com`
          });
        }
      }
      return "";
    }

    // 3. AUTOMATIC CUSTOM POST GATEWAY
    if (waGatewayType === "custom") {
      if (!waCustomUrl) {
        if (isManualClick) {
          MySwal.fire({
            icon: "warning",
            title: "URL Kustom Belum Diset",
            text: "Silakan masukkan URL API Gateway Kustom Anda di tab WhatsApp."
          });
        }
        return "";
      }

      try {
        const response = await fetch(waCustomUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(waApiKey ? { "Authorization": waApiKey } : {})
          },
          body: JSON.stringify({
            phone: cleanPhone,
            target: cleanPhone,
            message: messageText
          })
        });

        if (response.ok) {
          setWaLogs(prev => [
            {
              id: logId,
              studentName: student.nama_lengkap,
              phone: parentPhone,
              status: "success",
              timestamp: timestampStr,
              message: messageText
            },
            ...prev.slice(0, 49)
          ]);
          if (isManualClick) {
            MySwal.fire({
              icon: "success",
              title: "Terkirim",
              text: `Notifikasi WhatsApp kustom berhasil dikirim ke orang tua ${student.nama_lengkap}!`
            });
          }
        } else {
          throw new Error(`HTTP Error ${response.status}`);
        }
      } catch (err: any) {
        setWaLogs(prev => [
          {
            id: logId,
            studentName: student.nama_lengkap,
            phone: parentPhone,
            status: "failed",
            timestamp: timestampStr,
            message: messageText,
            errorMsg: err.message
          },
          ...prev.slice(0, 49)
        ]);
        if (isManualClick) {
          MySwal.fire({
            icon: "error",
            title: "Pengiriman Gagal",
            text: `Gagal mengirim kustom: ${err.message}`
          });
        }
      }
      return "";
    }
    return "";
  };

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

  // Use a ref to always access the latest executeScan function without restarting the camera
  const executeScanRef = useRef<(code: string, medium: string) => void>(undefined);

  // Hook for finding and listing all available camera devices
  useEffect(() => {
    if (isCameraActive) {
      BrowserCodeReader.listVideoInputDevices()
        .then((devices) => {
          const videoDevices = devices.filter((device) => device.deviceId);
          setAvailableCameras(videoDevices);
          
          if (videoDevices.length > 0) {
            // Find rear/back camera
            const backCamera = videoDevices.find((device) => {
              const label = device.label.toLowerCase();
              return (
                label.includes("back") ||
                label.includes("rear") ||
                label.includes("environment") ||
                label.includes("utama") ||
                label.includes("belakang") ||
                label.includes("facing back")
              );
            });
            if (backCamera) {
              setSelectedCameraId(backCamera.deviceId);
            } else {
              // Try choosing the last camera device (typically rear camera on Android)
              setSelectedCameraId(videoDevices[videoDevices.length - 1].deviceId);
            }
          }
        })
        .catch((err) => {
          console.error("Error listing cameras:", err);
        });
    } else {
      setAvailableCameras([]);
      setSelectedCameraId("");
    }
  }, [isCameraActive]);

  // Hook 1: Professional WebRTC Stream Handler with ZXing QR Scanner
  useEffect(() => {
    let controls: IScannerControls | null = null;
    let codeReader: BrowserQRCodeReader | null = null;

    if (isCameraActive && isSessionOpen && videoRef.current) {
      codeReader = new BrowserQRCodeReader();
      
      // Use the selected camera id or let ZXing fallback to default rear camera
      const deviceIdToUse = selectedCameraId || undefined;

      codeReader.decodeFromVideoDevice(deviceIdToUse, videoRef.current, (result, error, controlsResult) => {
        if (controlsResult) {
          controls = controlsResult;
          // Trigger a re-render to hide the "Waiting for Camera..." UI if it's connected
          setVideoStream(new MediaStream()); // Fake stream just for UI loading state
        }
        if (result) {
          const code = result.getText();
          if (executeScanRef.current) {
            executeScanRef.current(code, "camera");
          }
        }
        // ignore errors since it will continuously throw 'not found' on every frame
      }).catch((err) => {
        console.warn("Camera streaming turned off or permission was denied:", err);
      });
    } else {
      setVideoStream(null);
    }

    return () => {
      if (controls) {
        controls.stop();
      }
    };
  }, [isCameraActive, isSessionOpen, selectedCameraId]);

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
      setRawAttendanceRows(allData);

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

  // Raw keyboard simulator scan for USB NFC/RFID Reader (HID Keyboard Emulator)
  useEffect(() => {
    let keyTimer: NodeJS.Timeout | null = null;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid capturing deliberate typing inside input elements
      if (
        document.activeElement?.tagName === "INPUT" || 
        document.activeElement?.tagName === "SELECT" || 
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return; 
      }

      if (e.key === "Enter") {
        if (scannerInputVal.trim()) {
          executeScan(scannerInputVal.trim(), "keyboard_mimic");
          setScannerInputVal("");
        }
      } else if (e.key.length === 1) {
        setScannerInputVal(prev => prev + e.key);
        // Reset typing buffer if user stopped mid-way (e.g. accidental key hits)
        if (keyTimer) clearTimeout(keyTimer);
        keyTimer = setTimeout(() => {
          setScannerInputVal("");
        }, 1200);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (keyTimer) clearTimeout(keyTimer);
    };
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

    // Auto-Send WhatsApp Notification
    if (isWaAutoSendEnabled) {
      triggerWaNotification(foundStudent, determinedStatus, false);
    }

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
      isFemale: foundStudent.jenis_kelamin === "P",
      customMessage: determinedStatus // Pass the recorded status as custom message
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
  const hydratedStudentsList = students.reduce((acc, s) => {
    const isSholatPresensiView = attendanceSubTab === "input"
      ? (mapLocalSessionToDbSession(activeSessionObj?.id || "", sessions).presensi === "sholat" || (() => {
          if (!activeSessionObj || activeSessionObj.id === "none") return false;
          const id = activeSessionObj.id.toLowerCase();
          const label = activeSessionObj.label.toLowerCase();
          const sholatKeywords = ["subuh", "dzuhur", "zuhur", "asar", "ashar", "maghrib", "isya", "sholat", "shalat", "prayer"];
          return sholatKeywords.some(keyword => id.includes(keyword) || label.includes(keyword));
        })())
      : rekapPresensiType === "sholat";
      
    // Exclude female students on "Haid" leave from sholat attendance lists
    if (isSholatPresensiView && s.jenis_kelamin === "P" && s.status === "Haid") {
      return acc;
    }

    let itemStatus = getStatus(s.id || "");
    if (itemStatus === "unmarked") {
      if (s.status === "Sakit") itemStatus = "sakit";
      else if (s.status === "Pulang") itemStatus = "pulang";
    }
    
    acc.push({
      ...s,
      currentStatus: itemStatus,
    });
    return acc;
  }, [] as any);

  const roomsList = (() => {
    let masterRooms: string[] = rooms && rooms.length > 0 ? rooms : [];
    if (masterRooms.length === 0) {
      try {
        const saved = localStorage.getItem("manajemen_rooms");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            masterRooms = parsed;
          }
        }
      } catch {}
    }

    if (masterRooms.length > 0) {
      const map = new Map<string, string>();
      masterRooms.forEach((r) => {
        if (!r) return;
        const trimmed = String(r).trim();
        const key = trimmed.toLowerCase();
        if (key && !map.has(key)) {
          map.set(key, trimmed);
        }
      });
      return Array.from(map.values()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    }

    const set = new Set<string>();
    hydratedStudentsList.forEach((s: any) => {
      if (s.kamar && String(s.kamar).trim()) {
        set.add(String(s.kamar).trim());
      }
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  })();

  const kelasList = Array.from(
    new Set(students.map(s => s.kelas_sekolah).filter(Boolean))
  ).sort();

  const filteredStudents = hydratedStudentsList.filter((s: any) => {
    const term = searchQuery.toLowerCase();
    const matchSearch = 
      (s.nama_lengkap || "").toLowerCase().includes(term) ||
      (s.nama_panggilan || "").toLowerCase().includes(term) ||
      (s.kamar || "").toLowerCase().includes(term);

    const matchCategory = categoryFilter === "All" || s.kategori === categoryFilter;
    const matchRoom = roomFilter === "All" || (s.kamar || "").trim().toLowerCase() === roomFilter.trim().toLowerCase();

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
    let pulang = 0;
    let unmarked = 0;

    statsStudents.forEach((s) => {
      if (s.currentStatus === "hadir") hadir++;
      else if (s.currentStatus === "terlambat") terlambat++;
      else if (s.currentStatus === "sakit") sakit++;
      else if (s.currentStatus === "izin") izin++;
      else if (s.currentStatus === "alpa") alpa++;
      else if (s.currentStatus === "pulang") pulang++;
      else unmarked++;
    });

    const markedCount = total - unmarked;
    const percentPresent = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;

    return { total, hadir, terlambat, sakit, izin, alpa, pulang, unmarked, markedCount, percentPresent };
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
      const determinedStatus = isIqomahActive ? "terlambat" : "hadir";
      updateStudentStatus(studentId, determinedStatus);
      const foundStudent = students.find(s => String(s.id) === String(studentId));
      if (foundStudent) {
        if (isWaAutoSendEnabled) {
          triggerWaNotification(foundStudent, determinedStatus, false);
        }
        setAttendancePopup({
          isOpen: true,
          type: "success",
          studentName: foundStudent.nama_lengkap,
          studentPhoto: foundStudent.foto,
          studentKamar: foundStudent.kamar || "Belum Update",
          isFemale: foundStudent.jenis_kelamin === "P",
          customMessage: determinedStatus
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

  const getPassedSessions = (_dateStr: string) => {
    // Pastikan seluruh 5 waktu sholat (Subuh, Dzuhur, Asar, Maghrib, Isya) selalu terdata dan dievaluasi lengkap
    return sessions.map(s => s.id);
  };

  // Session matcher for Rekap and filtering
  const isSessionMatched = (sess: any, filterVal: string = rekapSesiFilter) => {
    if (!filterVal || filterVal === "semua") return true;
    const f = filterVal.toLowerCase().trim();
    const l = (sess.label || "").toLowerCase();
    const id = (sess.id || "").toLowerCase();
    
    if (id === f || l === f) return true;
    if (l.includes(f) || id.includes(f)) return true;
    if (f.includes(id) || f.includes(l)) return true;
    if (f === "ashar" && (l.includes("asar") || id.includes("asar"))) return true;
    if (f === "asar" && (l.includes("ashar") || id.includes("ashar"))) return true;
    if (f === "dzuhur" && (l.includes("zuhur") || id.includes("zuhur"))) return true;
    if (f === "zuhur" && (l.includes("dzuhur") || id.includes("dzuhur"))) return true;
    return false;
  };

  const isSesiSelected = Boolean(rekapSesiFilter && rekapSesiFilter !== "semua");

  // Dynamic session options matching the chosen presensi type
  const sesiOptions = useMemo(() => {
    const baseOptions = [{ value: "semua", label: "Semua Sesi" }];

    const matched = sessions.filter(s => {
      const mapped = mapLocalSessionToDbSession(s.id, sessions);
      if (mapped.presensi === rekapPresensiType) return true;
      if (rekapPresensiType === "sholat") {
        return ["subuh", "dzuhur", "zuhur", "asar", "ashar", "maghrib", "isya", "doa"].some(k => 
          s.label.toLowerCase().includes(k) || s.id.toLowerCase().includes(k)
        );
      }
      if (rekapPresensiType === "makan") {
        return ["makan", "pagi", "siang", "sore", "malam"].some(k => 
          s.label.toLowerCase().includes(k) || s.id.toLowerCase().includes(k)
        );
      }
      if (rekapPresensiType === "ngaji") {
        return ["ngaji", "quran", "kitab", "pagi", "sore", "malam"].some(k => 
          s.label.toLowerCase().includes(k) || s.id.toLowerCase().includes(k)
        );
      }
      return true;
    });

    if (matched.length > 0) {
      matched.forEach(s => {
        baseOptions.push({
          value: s.id,
          label: `${s.label} (${s.time})`
        });
      });
    } else {
      if (rekapPresensiType === "sholat") {
        baseOptions.push(
          { value: "subuh", label: "Subuh (04.00 - 10.00)" },
          { value: "dzuhur", label: "Dzuhur (11.30 - 12.30)" },
          { value: "ashar", label: "Ashar (14.50 - 15.30)" },
          { value: "maghrib", label: "Maghrib (17.20 - 18.00)" },
          { value: "isya", label: "Isya (18.40 - 19.30)" }
        );
      } else if (rekapPresensiType === "makan") {
        baseOptions.push(
          { value: "pagi", label: "Makan Pagi" },
          { value: "siang", label: "Makan Siang" },
          { value: "sore", label: "Makan Sore / Malam" }
        );
      } else if (rekapPresensiType === "ngaji") {
        baseOptions.push(
          { value: "pagi", label: "Ngaji Pagi" },
          { value: "sore", label: "Ngaji Sore" },
          { value: "malam", label: "Ngaji Malam" }
        );
      }
    }
    return baseOptions;
  }, [sessions, rekapPresensiType]);

  // Check a student's attendance for the selected session
  const getStudentSessionStatus = (studentId: string | number, dateStr: string = selectedDate) => {
    const sId = String(studentId);
    if (!isSesiSelected) {
      return { hasRecorded: false, status: "unmarked", sessionLabel: "" };
    }

    const matchedSessions = sessions.filter(s => isSessionMatched(s, rekapSesiFilter));
    if (matchedSessions.length === 0) {
      const key = `${dateStr}_absensi_${rekapSesiFilter}`;
      const status = attendanceDb[key]?.[sId];
      const hasRec = Boolean(status && status !== "unmarked");
      return {
        hasRecorded: hasRec,
        status: status || "unmarked",
        sessionLabel: rekapSesiFilter
      };
    }

    for (const sess of matchedSessions) {
      const key = `${dateStr}_absensi_${sess.id}`;
      const status = attendanceDb[key]?.[sId];
      if (status && status !== "unmarked") {
        return {
          hasRecorded: true,
          status,
          sessionLabel: sess.label,
          sessionId: sess.id
        };
      }
    }

    return {
      hasRecorded: false,
      status: "unmarked",
      sessionLabel: matchedSessions[0]?.label || rekapSesiFilter,
      sessionId: matchedSessions[0]?.id
    };
  };

  const getStudentPeriodStats = (studentId: string | number, tfOverride?: string, dateOverride?: string, typeOverride?: string) => {
    const tf = tfOverride || rekapTimeframe;
    const date = dateOverride || selectedDate;
    const type = typeOverride || rekapPresensiType;
    
    const sId = String(studentId);
    const student = students.find(s => String(s.id) === sId);
    const globalStatus = student?.status || "Aktif";
    let hadir = 0;
    let terlambat = 0;
    let alpa = 0;
    let sakit = 0;
    let pulang = 0;
    let sessionsData: Record<string, Record<string, string>> = {};

    const resolveStatus = (status: string) => {
      if (status === "unmarked") {
        if (globalStatus === "Sakit") return "sakit";
        if (globalStatus === "Pulang") return "pulang";
      }
      return status;
    };

    if (tf === "harian") {
      sessionsData[date] = {};
      const passedSessionIds = getPassedSessions(date);
      sessions.forEach(sess => {
        if (!passedSessionIds.includes(sess.id)) return;
        const mappedPresensi = mapLocalSessionToDbSession(sess.id, sessions).presensi;
        if (mappedPresensi !== type) return;
        if (!isSessionMatched(sess)) return;
        
        const key = `${date}_absensi_${sess.id}`;
        let status = attendanceDb[key]?.[sId] || "unmarked";
        status = resolveStatus(status) as AttendanceStatus;
        sessionsData[date][sess.id] = status;
        if (status === "hadir") hadir++;
        else if (status === "terlambat") terlambat++;
        else if (status === "sakit") sakit++;
        else if (status === "pulang") pulang++;
        else if (status === "alpa" || status === "unmarked") alpa++;
      });
    } else if (tf === "mingguan") {
      const { monday } = getWeekRange(date);
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
          if (mappedPresensi !== type) return;
          if (!isSessionMatched(sess)) return;
          const key = `${dateStr}_absensi_${sess.id}`;
          let status = attendanceDb[key]?.[sId] || "unmarked";
          status = resolveStatus(status) as AttendanceStatus;
          sessionsData[dateStr][sess.id] = status;
          if (status === "hadir") hadir++;
          else if (status === "terlambat") terlambat++;
          else if (status === "sakit") sakit++;
          else if (status === "pulang") pulang++;
          else if (status === "alpa" || status === "unmarked") alpa++;
        });
      }
    } else if (tf === "bulanan") {
      const d = new Date(date);
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
          if (mappedPresensi !== type) return;
          if (!isSessionMatched(sess)) return;
          const key = `${dateStr}_absensi_${sess.id}`;
          let status = attendanceDb[key]?.[sId] || "unmarked";
          status = resolveStatus(status) as AttendanceStatus;
          sessionsData[dateStr][sess.id] = status;
          if (status === "hadir") hadir++;
          else if (status === "terlambat") terlambat++;
          else if (status === "sakit") sakit++;
          else if (status === "pulang") pulang++;
          else if (status === "alpa" || status === "unmarked") alpa++;
        });
      }
    }

    return { hadir, terlambat, alpa, sakit, pulang, sessionsData };
  };

  // Count unrecorded students for the selected session
  const unrecordedCountForSelectedSession = useMemo(() => {
    if (!isSesiSelected) return 0;
    return filteredStudents.filter((s: any) => {
      const sessionInfo = getStudentSessionStatus(s.id, selectedDate);
      return !sessionInfo.hasRecorded;
    }).length;
  }, [filteredStudents, isSesiSelected, selectedDate, rekapSesiFilter, attendanceDb]);

  // Display list for Rekap Presensi with filters and sorting
  const displayRekapStudents = useMemo(() => {
    let list = filteredStudents.filter((student: any) => {
      if (isSesiSelected) {
        const sessionInfo = getStudentSessionStatus(student.id, selectedDate);
        if (rekapBelumAbsenFilter === "belum_absen") {
          return !sessionInfo.hasRecorded;
        }
        if (rekapBelumAbsenFilter === "sudah_absen") {
          return sessionInfo.hasRecorded;
        }
      }
      return true;
    });

    return list.map((student: any) => {
      const pPeriodStats = getStudentPeriodStats(student.id);
      const totalHadir = pPeriodStats.hadir + pPeriodStats.terlambat;
      return {
        ...student,
        pPeriodStats,
        totalHadir
      };
    }).sort((a: any, b: any) => {
      if (rekapSortBy === "ranking") {
        if (b.totalHadir !== a.totalHadir) return b.totalHadir - a.totalHadir;
        if (b.pPeriodStats.hadir !== a.pPeriodStats.hadir) return b.pPeriodStats.hadir - a.pPeriodStats.hadir;
        if (a.pPeriodStats.alpa !== b.pPeriodStats.alpa) return a.pPeriodStats.alpa - b.pPeriodStats.alpa;
        return (a.nama_lengkap || "").localeCompare(b.nama_lengkap || "");
      } else if (rekapSortBy === "terendah") {
        if (a.totalHadir !== b.totalHadir) return a.totalHadir - b.totalHadir;
        if (a.pPeriodStats.hadir !== b.pPeriodStats.hadir) return a.pPeriodStats.hadir - b.pPeriodStats.hadir;
        if (b.pPeriodStats.alpa !== a.pPeriodStats.alpa) return b.pPeriodStats.alpa - a.pPeriodStats.alpa;
        return (a.nama_lengkap || "").localeCompare(b.nama_lengkap || "");
      } else {
        return (a.nama_lengkap || "").localeCompare(b.nama_lengkap || "");
      }
    });
  }, [filteredStudents, isSesiSelected, rekapBelumAbsenFilter, selectedDate, rekapSesiFilter, attendanceDb, rekapSortBy, rekapTimeframe, rekapPresensiType]);

  // Helper for opening 5 prayers detail modal for a student
  const openStudentPrayerDetail = async (student: any, dateToUse: string = selectedDate) => {
    setSelectedStudentForPrayerDetail(student);
    setPrayerDetailDate(dateToUse);
    setIsLoadingPrayerDetail(true);

    try {
      const { data, error } = await supabase
        .from("absensi")
        .select("*")
        .eq("tanggal", dateToUse)
        .ilike("nama", (student.nama_lengkap || "").trim());

      if (!error && data && data.length > 0) {
        setStudentPrayerRecords(data);
      } else {
        const localMatches = (rawAttendanceRows || []).filter(
          (r: any) => r.tanggal === dateToUse && (r.nama || "").toLowerCase() === (student.nama_lengkap || "").toLowerCase()
        );
        setStudentPrayerRecords(localMatches);
      }
    } catch (err) {
      console.warn("Error fetching student prayer detail:", err);
      const localMatches = (rawAttendanceRows || []).filter(
        (r: any) => r.tanggal === dateToUse && (r.nama || "").toLowerCase() === (student.nama_lengkap || "").toLowerCase()
      );
      setStudentPrayerRecords(localMatches);
    } finally {
      setIsLoadingPrayerDetail(false);
    }
  };

  const handlePrayerDateChange = async (newDate: string) => {
    if (!selectedStudentForPrayerDetail || !newDate) return;
    setPrayerDetailDate(newDate);
    setIsLoadingPrayerDetail(true);

    try {
      const { data, error } = await supabase
        .from("absensi")
        .select("*")
        .eq("tanggal", newDate)
        .ilike("nama", (selectedStudentForPrayerDetail.nama_lengkap || "").trim());

      if (!error && data) {
        setStudentPrayerRecords(data);
      } else {
        setStudentPrayerRecords([]);
      }
    } catch (err) {
      console.warn("Error changing prayer detail date:", err);
      setStudentPrayerRecords([]);
    } finally {
      setIsLoadingPrayerDetail(false);
    }
  };

  // 5 Canonical Prayer times
  const PRAYER_SCHEDULE = [
    { key: "subuh", label: "Subuh", name: "Sholat Subuh", time: "04:00 - 08:00 WIB", icon: "🌅" },
    { key: "dzuhur", label: "Dzuhur", name: "Sholat Dzuhur", time: "11:45 - 12:30 WIB", icon: "☀️" },
    { key: "asar", label: "Asar", name: "Sholat Asar", time: "14:50 - 15:30 WIB", icon: "🌤️" },
    { key: "maghrib", label: "Maghrib", name: "Sholat Maghrib", time: "17:20 - 18:00 WIB", icon: "🌇" },
    { key: "isya", label: "Isya", name: "Sholat Isya", time: "18:30 - 19:15 WIB", icon: "🌌" }
  ];

  const getPrayerDetailForSession = (prayerKey: string, student: any, date: string) => {
    const norm = (s: string) => (s || "").toLowerCase().replace(/ashar/g, "asar").replace(/zuhur/g, "dzuhur").replace(/dhuhur/g, "dzuhur").trim();
    const targetKey = norm(prayerKey);

    // 1. Check in fetched records from Supabase
    const record = studentPrayerRecords.find((r: any) => {
      const dbSesiNorm = norm(r.sesi);
      return dbSesiNorm.includes(targetKey) || targetKey.includes(dbSesiNorm);
    });

    if (record) {
      let status = record.status || "hadir";
      if (status === "telat") status = "terlambat";
      if (status === "alpha") status = "alpa";

      return {
        status,
        waktu: record.waktu || "",
        hasRecord: true,
        source: "database",
        recordId: record.id
      };
    }

    // 2. Fallback to local attendanceDb
    const matchedSession = sessions.find(s => {
      const sNorm = norm(s.label || s.id);
      return sNorm.includes(targetKey) || targetKey.includes(sNorm);
    });

    if (matchedSession) {
      const key = `${date}_absensi_${matchedSession.id}`;
      const statusInDb = attendanceDb[key]?.[student.id];
      if (statusInDb && statusInDb !== "unmarked") {
        return {
          status: statusInDb,
          waktu: "",
          hasRecord: true,
          source: "local_state",
          recordId: null
        };
      }
    }

    return {
      status: "unmarked",
      waktu: "",
      hasRecord: false,
      source: "none",
      recordId: null
    };
  };

  // Download Rekap PDF - Strictly sorted from HIGHEST attendance to LOWEST
  const downloadRekapPDF = () => {
    import("jspdf").then(({ jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF();
        const tf = downloadOptions.timeframe;
        const dt = downloadOptions.tanggal;
        
        const timeframeLabel = tf === "harian" ? "Harian" : tf === "mingguan" ? "Mingguan" : "Bulanan";
        let dateLabel = "";
        if (tf === "harian") {
          dateLabel = formatIndoDate(dt);
        } else if (tf === "mingguan") {
          const { monday, sunday } = getWeekRange(dt);
          dateLabel = `${formatIndoDate(monday.toISOString().slice(0,10))} - ${formatIndoDate(sunday.toISOString().slice(0,10))}`;
        } else {
          dateLabel = formatIndoMonth(dt);
        }

        const sessionObj = isSesiSelected ? sessions.find(s => isSessionMatched(s, rekapSesiFilter)) : null;
        const sessionLabel = sessionObj ? sessionObj.label : (isSesiSelected ? rekapSesiFilter.toUpperCase() : "");
        
        const title = `Rekapitulasi Presensi ${rekapPresensiType === "sholat" ? "Sholat" : rekapPresensiType === "makan" ? "Makan" : "Ngaji"} ${timeframeLabel} - ${downloadOptions.kamar !== "All" ? `Kamar ${downloadOptions.kamar}` : "Semua Kamar"}${sessionLabel ? ` (${sessionLabel})` : ""}`;
        
        doc.setFontSize(13);
        doc.text(title, 14, 15);
        doc.setFontSize(9);
        doc.text(`Periode: ${dateLabel}`, 14, 22);

        let pdfStudents = hydratedStudentsList.filter((s: any) => 
          downloadOptions.kamar === "All" || (s.kamar || "").trim().toLowerCase() === downloadOptions.kamar.trim().toLowerCase()
        );

        // Apply status filter if set in download options
        if (isSesiSelected && downloadOptions.filterStatus === "belum_absen") {
          pdfStudents = pdfStudents.filter((s: any) => !getStudentSessionStatus(s.id, dt).hasRecorded);
        } else if (isSesiSelected && downloadOptions.filterStatus === "sudah_absen") {
          pdfStudents = pdfStudents.filter((s: any) => getStudentSessionStatus(s.id, dt).hasRecorded);
        }

        // Calculate statistics & SORT FROM HIGHEST ATTENDANCE TO LOWEST ATTENDANCE
        const sortedStudentsWithStats = pdfStudents.map((student: any) => {
          const pPeriodStats = getStudentPeriodStats(student.id, tf, dt, rekapPresensiType);
          const total = pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa + pPeriodStats.sakit + pPeriodStats.pulang;
          const totalHadir = pPeriodStats.hadir + pPeriodStats.terlambat;
          const persentase = total > 0 ? Math.round((totalHadir / total) * 100) : 0;
          
          let pagi = "unmarked", siang = "unmarked", sore = "unmarked", countMakan = 0;
          if (rekapPresensiType === "makan" && tf === "harian") {
            const sessionsTodayData = pPeriodStats.sessionsData[dt] || {};
            const getSessionStatus = (keyword: string) => {
              const s = sessions.find(sess => mapLocalSessionToDbSession(sess.id, sessions).presensi === "makan" && sess.label.toLowerCase().includes(keyword));
              if (!s) return "unmarked";
              return sessionsTodayData[s.id] || "unmarked";
            };
            pagi = getSessionStatus("pagi");
            siang = getSessionStatus("siang");
            sore = getSessionStatus("sore");
            countMakan = (pagi === "hadir" ? 1 : 0) + (siang === "hadir" ? 1 : 0) + (sore === "hadir" ? 1 : 0);
          }

          return {
            student,
            pPeriodStats,
            total,
            totalHadir,
            persentase,
            pagi,
            siang,
            sore,
            countMakan
          };
        }).sort((a: any, b: any) => {
          // URUTKAN DARI TINGKAT KEHADIRAN PALING TINGGI KE PALING RENDAH
          if (rekapPresensiType === "makan" && tf === "harian") {
            if (b.countMakan !== a.countMakan) return b.countMakan - a.countMakan;
            return (a.student.nama_lengkap || "").localeCompare(b.student.nama_lengkap || "");
          }
          if (b.totalHadir !== a.totalHadir) {
            return b.totalHadir - a.totalHadir; // Kehadiran terbanyak di atas
          }
          if (b.pPeriodStats.hadir !== a.pPeriodStats.hadir) {
            return b.pPeriodStats.hadir - a.pPeriodStats.hadir; // Hadir tepat waktu terbanyak
          }
          if (b.persentase !== a.persentase) {
            return b.persentase - a.persentase; // Persentase tertinggi
          }
          if (a.pPeriodStats.alpa !== b.pPeriodStats.alpa) {
            return a.pPeriodStats.alpa - b.pPeriodStats.alpa; // Alfa paling sedikit
          }
          return (a.student.nama_lengkap || "").localeCompare(b.student.nama_lengkap || "");
        });

        doc.setTextColor(100);
        doc.text(`* Diurutkan dari tingkat kehadiran tertinggi sampai terendah (${sortedStudentsWithStats.length} Santri)`, 14, 27);

        let tableData: any[][] = [];
        let head: string[][] = [];

        if (rekapPresensiType === "makan" && tf === "harian") {
          head = [["No", "Nama Santri", "Kamar", "Pagi", "Siang", "Sore", "Total Makan"]];
          tableData = sortedStudentsWithStats.map((item: any, idx: number) => [
            idx + 1,
            item.student.nama_lengkap,
            item.student.kamar || "-",
            item.pagi === "hadir" ? "V" : "X",
            item.siang === "hadir" ? "V" : "X",
            item.sore === "hadir" ? "V" : "X",
            item.countMakan
          ]);
        } else {
          head = [["No", "Nama Santri", "Kamar", "Hadir", "Telat", "Izin/Sakit", "Alfa", "Kehadiran (%)"]];
          tableData = sortedStudentsWithStats.map((item: any, idx: number) => [
            idx + 1,
            item.student.nama_lengkap,
            item.student.kamar || "-",
            item.pPeriodStats.hadir,
            item.pPeriodStats.terlambat,
            item.pPeriodStats.sakit + item.pPeriodStats.pulang,
            item.pPeriodStats.alpa,
            `${item.persentase}%`
          ]);
        }

        autoTable(doc, {
          startY: 32,
          head: head,
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [62, 70, 202] },
          styles: { fontSize: 8 }
        });

        doc.save(`Rekap_${rekapPresensiType}_${timeframeLabel}_${dateLabel.replace(/\s+/g, '_')}_UrutKehadiran.pdf`);
        setIsDownloadModalOpen(false);
      });
    });
  };

  // Download Rekap CSV - Strictly sorted from HIGHEST attendance to LOWEST
  const downloadRekapCSV = () => {
    const tf = downloadOptions.timeframe;
    const dt = downloadOptions.tanggal;
    
    const timeframeLabel = tf === "harian" ? "Harian" : tf === "mingguan" ? "Mingguan" : "Bulanan";
    let dateLabel = "";
    if (tf === "harian") {
      dateLabel = formatIndoDate(dt);
    } else if (tf === "mingguan") {
      const { monday, sunday } = getWeekRange(dt);
      dateLabel = `${formatIndoDate(monday.toISOString().slice(0,10))} - ${formatIndoDate(sunday.toISOString().slice(0,10))}`;
    } else {
      dateLabel = formatIndoMonth(dt);
    }

    let pdfStudents = hydratedStudentsList.filter((s: any) => 
      downloadOptions.kamar === "All" || (s.kamar || "").trim().toLowerCase() === downloadOptions.kamar.trim().toLowerCase()
    );

    if (isSesiSelected && downloadOptions.filterStatus === "belum_absen") {
      pdfStudents = pdfStudents.filter((s: any) => !getStudentSessionStatus(s.id, dt).hasRecorded);
    } else if (isSesiSelected && downloadOptions.filterStatus === "sudah_absen") {
      pdfStudents = pdfStudents.filter((s: any) => getStudentSessionStatus(s.id, dt).hasRecorded);
    }

    const sortedStudentsWithStats = pdfStudents.map((student: any) => {
      const pPeriodStats = getStudentPeriodStats(student.id, tf, dt, rekapPresensiType);
      const total = pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa + pPeriodStats.sakit + pPeriodStats.pulang;
      const totalHadir = pPeriodStats.hadir + pPeriodStats.terlambat;
      const persentase = total > 0 ? Math.round((totalHadir / total) * 100) : 0;
      
      let pagi = "unmarked", siang = "unmarked", sore = "unmarked", countMakan = 0;
      if (rekapPresensiType === "makan" && tf === "harian") {
        const sessionsTodayData = pPeriodStats.sessionsData[dt] || {};
        const getSessionStatus = (keyword: string) => {
          const s = sessions.find(sess => mapLocalSessionToDbSession(sess.id, sessions).presensi === "makan" && sess.label.toLowerCase().includes(keyword));
          if (!s) return "unmarked";
          return sessionsTodayData[s.id] || "unmarked";
        };
        pagi = getSessionStatus("pagi");
        siang = getSessionStatus("siang");
        sore = getSessionStatus("sore");
        countMakan = (pagi === "hadir" ? 1 : 0) + (siang === "hadir" ? 1 : 0) + (sore === "hadir" ? 1 : 0);
      }

      return {
        student,
        pPeriodStats,
        total,
        totalHadir,
        persentase,
        pagi,
        siang,
        sore,
        countMakan
      };
    }).sort((a: any, b: any) => {
      // URUTKAN DARI TINGKAT KEHADIRAN PALING TINGGI KE PALING RENDAH
      if (rekapPresensiType === "makan" && tf === "harian") {
        if (b.countMakan !== a.countMakan) return b.countMakan - a.countMakan;
        return (a.student.nama_lengkap || "").localeCompare(b.student.nama_lengkap || "");
      }
      if (b.totalHadir !== a.totalHadir) {
        return b.totalHadir - a.totalHadir;
      }
      if (b.pPeriodStats.hadir !== a.pPeriodStats.hadir) {
        return b.pPeriodStats.hadir - a.pPeriodStats.hadir;
      }
      if (b.persentase !== a.persentase) {
        return b.persentase - a.persentase;
      }
      if (a.pPeriodStats.alpa !== b.pPeriodStats.alpa) {
        return a.pPeriodStats.alpa - b.pPeriodStats.alpa;
      }
      return (a.student.nama_lengkap || "").localeCompare(b.student.nama_lengkap || "");
    });

    let csvContent = "\uFEFF"; // UTF-8 BOM
    if (rekapPresensiType === "makan" && tf === "harian") {
      csvContent += "No,Nama Santri,Kamar,Pagi,Siang,Sore,Total Makan\n";
      sortedStudentsWithStats.forEach((item, idx) => {
        const cleanName = `"${(item.student.nama_lengkap || "").replace(/"/g, '""')}"`;
        const cleanKamar = `"${(item.student.kamar || "-").replace(/"/g, '""')}"`;
        csvContent += `${idx + 1},${cleanName},${cleanKamar},${item.pagi === "hadir" ? "V" : "X"},${item.siang === "hadir" ? "V" : "X"},${item.sore === "hadir" ? "V" : "X"},${item.countMakan}\n`;
      });
    } else {
      csvContent += "No,Nama Santri,Kamar,Hadir,Telat,Izin/Sakit,Alfa,Kehadiran (%)\n";
      sortedStudentsWithStats.forEach((item, idx) => {
        const cleanName = `"${(item.student.nama_lengkap || "").replace(/"/g, '""')}"`;
        const cleanKamar = `"${(item.student.kamar || "-").replace(/"/g, '""')}"`;
        csvContent += `${idx + 1},${cleanName},${cleanKamar},${item.pPeriodStats.hadir},${item.pPeriodStats.terlambat},${item.pPeriodStats.sakit + item.pPeriodStats.pulang},${item.pPeriodStats.alpa},${item.persentase}%\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Rekap_${rekapPresensiType}_${timeframeLabel}_${dateLabel.replace(/\s+/g, '_')}_UrutKehadiran.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsDownloadModalOpen(false);
  };
  executeScanRef.current = executeScan;

  return (
    <div className="w-full py-4 px-2 space-y-6 flex flex-col items-stretch" id="attendance_menu_root">
      
      {/* 1. HEADER BRANDING */}
      <div className="flex flex-col gap-1 pt-2 pb-6 select-none" id="attendance_brand_header">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
          <span>{viewMode === "rekap" ? (rekapSubMenu === "sekolah" ? "Rekap Presensi Sekolah" : "Rekap Presensi Sholat") : "Presensi Santri"}</span>
          <ChevronRight className="w-4 h-4" />
          <span>{viewMode === "rekap" ? (rekapSubMenu === "sekolah" ? "Sekolah (Coming Soon)" : "Sholat 5 Waktu") : "Daftar"}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
            {viewMode === "rekap" ? (rekapSubMenu === "sekolah" ? "Rekap Presensi Sekolah" : "Rekap Presensi Sholat") : "Presensi Santri"}
          </h2>
          {viewMode !== "rekap" && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
              {supabaseSyncStatus === "connected" && (
                <span className="text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-400 px-2 py-1 rounded-lg border border-sky-200 dark:border-sky-800 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                  SINKRON ONLINE (CLOUD)
                </span>
              )}
              {supabaseSyncStatus === "loading" && (
                <span className="text-slate-500 bg-slate-50 dark:bg-slate-900/40 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 animate-pulse shadow-sm">
                  🔄 MENYELARASKAN...
                </span>
              )}
              {supabaseSyncStatus === "disabled" && (
                <span className="text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 shadow-sm" title="Tabel 'absensi' belum aktif di Supabase. Sistem otomatis menyimpannya secara offline aman di Browser Storage Anda.">
                  LOKAL (OFFLINE-OK)
                </span>
              )}
              {supabaseSyncStatus === "error" && (
                <span className="text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800 shadow-sm flex items-center gap-1.5" title="Masalah jaringan database Supabase. Hubungkan wifi/paket data kembali.">
                  ⚠️ KONEKSI TERBATAS
                </span>
              )}
            </div>
          )}
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

            {/* ABSENSI VIEW: ONLY SESI AKTIF + RINGKASAN ANALITIK SESI */}
      {viewMode === "absensi" && (
        <div className="space-y-6 animate-fade-in" id="absensi_siswa_main_section">
          {/* SESI AKTIF CARD */}
          <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in relative overflow-hidden" id="session_card_header">
            <div className="flex items-center gap-4 select-none">
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

          {/* RINGKASAN ANALITIK SESI */}
          <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6" id="attendance_analytic_summary_card">
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
                  { label: "Pulang", count: stats.pulang, color: "bg-fuchsia-400", rawColor: "text-fuchsia-700 bg-fuchsia-50 dark:text-fuchsia-400 dark:bg-fuchsia-950/20" },
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

      {/* REKAP VIEW: RENDER SUB-VIEWS */}
      {viewMode === "rekap" && (
        <>
          {/* SUB-MENU REKAP PRESENSI: SHOLAT & SEKOLAH (COMING SOON) */}
          <div className="bg-white dark:bg-[#111c44] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 animate-fade-in" id="rekap_presensi_submenu_bar">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleRekapSubMenuChange("sholat")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  rekapSubMenu === "sholat"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Sholat</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-extrabold border border-emerald-200 dark:border-emerald-800">
                  5 Waktu
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRekapSubMenuChange("sekolah")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  rekapSubMenu === "sekolah"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <School className="w-4 h-4" />
                <span>Sekolah</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-black tracking-wide border border-amber-200 dark:border-amber-800">
                  Coming Soon
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {rekapSubMenu === "sholat" ? (
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Subuh • Dzuhur • Asar • Maghrib • Isya</span>
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Modul Presensi Sekolah Sedang Dikembangkan</span>
                </span>
              )}
            </div>
          </div>

          {/* B. REKAP DATA VIEW */}
          {attendanceSubTab === "rekap" && (
            rekapSubMenu === "sekolah" ? (
              <RekapSekolahComingSoon onSwitchToSholat={() => handleRekapSubMenuChange("sholat")} />
            ) : (
        <div className="space-y-4 animate-fade-in" id="attendance_rekap_section">

          {/* CLEAN FILTER CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Filter Rekap Presensi</span>
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setRekapTimeframe("harian");
                  setRekapPresensiType("sholat");
                  setRekapSesiFilter("semua");
                  setRekapBelumAbsenFilter("semua");
                  setRekapSortBy("ranking");
                  setSelectedDate(new Date().toISOString().slice(0, 10));
                  setSearchQuery("");
                  setRoomFilter("All");
                  setCategoryFilter("All");
                }}
                className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors cursor-pointer"
              >
                Atur ulang filter
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Periode</label>
                <SearchableSelect
                  value={rekapTimeframe}
                  onChange={(val) => setRekapTimeframe(val as "harian" | "mingguan" | "bulanan")}
                  options={[
                    { value: "harian", label: "Harian" },
                    { value: "mingguan", label: "Mingguan" },
                    { value: "bulanan", label: "Bulanan" }
                  ]}
                  placeholder="Pilih salah satu opsi"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Presensi</label>
                <SearchableSelect
                  value={rekapPresensiType}
                  onChange={(val) => {
                    setRekapPresensiType(val);
                    setRekapSesiFilter("semua");
                    setRekapBelumAbsenFilter("semua");
                  }}
                  options={[
                    { value: "sholat", label: "Presensi Sholat" },
                    { value: "makan", label: "Presensi Makan" },
                    { value: "ngaji", label: "Presensi Ngaji" },
                    { value: "sekolah", label: "Presensi Sekolah" }
                  ]}
                  placeholder="Pilih salah satu opsi"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Sesi / Waktu</span>
                  {isSesiSelected && (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                      Sesi Aktif
                    </span>
                  )}
                </label>
                <SearchableSelect
                  value={rekapSesiFilter}
                  onChange={(val) => {
                    setRekapSesiFilter(val);
                    if (val === "semua") {
                      setRekapBelumAbsenFilter("semua");
                    }
                  }}
                  options={sesiOptions}
                  placeholder="Pilih sesi presensi"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {rekapTimeframe === "harian" ? "Tanggal" : rekapTimeframe === "mingguan" ? "Tanggal Acuan" : "Bulan"}
                </label>
                <input 
                  type={rekapTimeframe === "bulanan" ? "month" : "date"}
                  value={rekapTimeframe === "bulanan" ? selectedDate.slice(0, 7) : selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(rekapTimeframe === "bulanan" ? e.target.value + "-01" : e.target.value);
                      setIsManualDate(true);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-left text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asrama / Kamar</label>
                <SearchableSelect
                  value={roomFilter}
                  onChange={setRoomFilter}
                  options={[
                    { value: "All", label: "Semua Kamar" },
                    ...roomsList.map((r: string) => ({ value: r, label: r }))
                  ]}
                  placeholder="Pilih kamar"
                />
              </div>
            </div>

            {/* BARIS KHUSUS: FILTER BELUM ABSEN (AKTIF KETIKA MEMILIH SESI TERTENTU) & PENGURUTAN */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
                  {isSesiSelected ? (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Status Absensi Sesi:</span>
                </span>

                {isSesiSelected ? (
                  <div className="inline-flex items-center p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs gap-1">
                    <button
                      type="button"
                      onClick={() => setRekapBelumAbsenFilter("semua")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        rekapBelumAbsenFilter === "semua"
                          ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setRekapBelumAbsenFilter("belum_absen")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        rekapBelumAbsenFilter === "belum_absen"
                          ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-300 dark:ring-rose-900"
                          : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      }`}
                    >
                      <span>Belum Absen</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                        rekapBelumAbsenFilter === "belum_absen"
                          ? "bg-white text-rose-700"
                          : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                      }`}>
                        {unrecordedCountForSelectedSession}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRekapBelumAbsenFilter("sudah_absen")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        rekapBelumAbsenFilter === "sudah_absen"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      }`}
                    >
                      Sudah Absen
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Filter &quot;Belum Absen&quot; aktif setelah Anda memilih salah satu <strong>Sesi / Waktu</strong> di atas</span>
                  </div>
                )}
              </div>

              {/* Sorting options */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Urutan:</span>
                </span>
                <select
                  value={rekapSortBy}
                  onChange={(e) => setRekapSortBy(e.target.value as any)}
                  className="text-xs font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ranking">Kehadiran Tertinggi ke Terendah</option>
                  <option value="terendah">Kehadiran Terendah ke Tertinggi</option>
                  <option value="nama">Nama Santri (A - Z)</option>
                </select>
              </div>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => {}}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-xs"
                >
                  Terapkan Filter
                </button>
                {isSesiSelected && rekapBelumAbsenFilter === "belum_absen" && (
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900">
                    Fokus: {displayRekapStudents.length} Santri Belum Absen
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-60">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Cari nama atau kamar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs font-medium pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDownloadOptions({
                      ...downloadOptions,
                      timeframe: rekapTimeframe,
                      tanggal: selectedDate,
                      kamar: roomFilter,
                      filterStatus: isSesiSelected ? rekapBelumAbsenFilter : "semua"
                    });
                    setIsDownloadModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                  title="Unduh Rekap (Otomatis Terurut dari Kehadiran Tertinggi ke Terendah)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Rekap</span>
                </button>
              </div>
            </div>
          </div>

          {/* ACTIVE BELUM ABSEN BANNER IF FILTER IS ON */}
          {isSesiSelected && rekapBelumAbsenFilter === "belum_absen" && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-300 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
                    Menampilkan {displayRekapStudents.length} Santri Belum Melakukan Absensi
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-400 font-medium mt-0.5">
                    Sesi: <strong>{sessions.find(s => isSessionMatched(s, rekapSesiFilter))?.label || rekapSesiFilter.toUpperCase()}</strong> • Tanggal: {formatIndoDate(selectedDate)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRekapBelumAbsenFilter("semua")}
                className="text-xs font-bold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer shrink-0"
              >
                Lihat Semua
              </button>
            </div>
          )}

          {/* MAIN REKAP DATA CARD */}
          <div className="bg-white dark:bg-[#111c44] rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span>Data Presensi {rekapTimeframe === "harian" ? "Harian" : rekapTimeframe === "mingguan" ? "Mingguan" : "Bulanan"}</span>
                  <span className="text-xs font-extrabold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-full">
                    {displayRekapStudents.length} Santri
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  <span>Diurutkan: {rekapSortBy === "ranking" ? "Kehadiran Tertinggi ke Terendah" : rekapSortBy === "terendah" ? "Kehadiran Terendah ke Tertinggi" : "Nama A - Z"}</span>
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {rekapTimeframe === "harian" ? formatIndoDate(selectedDate) : rekapTimeframe === "mingguan" ? `${formatIndoDate(getWeekRange(selectedDate).monday.toISOString().slice(0, 10))} - ${formatIndoDate(getWeekRange(selectedDate).sunday.toISOString().slice(0, 10))}` : formatIndoMonth(selectedDate)}
              </span>
            </div>

            {/* Scrollable list of Rekap */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[550px] overflow-y-auto pr-1">
              {displayRekapStudents.length > 0 ? (
                displayRekapStudents.map((student: any, index: number) => {
                  const isFemale = student.jenis_kelamin === "P";
                  const pPeriodStats = student.pPeriodStats;
                  const totalAbsen = pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa + pPeriodStats.sakit + pPeriodStats.pulang;
                  const persenHadir = totalAbsen > 0 ? Math.round(((pPeriodStats.hadir + pPeriodStats.terlambat) / totalAbsen) * 100) : 0;
                  
                  // Specific session attendance status if session is selected
                  const sessionInfo = isSesiSelected ? getStudentSessionStatus(student.id, selectedDate) : null;

                  return (
                    <div key={student.id} className="py-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs font-semibold hover:bg-slate-50/70 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] font-black text-slate-400 w-6 text-center shrink-0">
                          #{index + 1}
                        </span>
                        <div 
                          onClick={() => openStudentPrayerDetail(student)}
                          className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden relative shrink-0 shadow-xs cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                          title="Klik untuk melihat rincian 5 waktu sholat berjamaah"
                        >
                          {student.foto ? <img src={student.foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg select-none">{isFemale ? "🧕" : "👳"}</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openStudentPrayerDetail(student)}
                              className="font-extrabold text-slate-800 dark:text-white text-sm leading-snug truncate hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline text-left cursor-pointer transition-colors flex items-center gap-1.5 group/btn"
                              title="Klik untuk melihat status 5 waktu sholat berjamaah"
                            >
                              <span>{student.nama_lengkap}</span>
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900 flex items-center gap-1 opacity-80 group-hover/btn:opacity-100 transition-opacity">
                                <Eye className="w-3 h-3" />
                                <span>Rincian Sholat</span>
                              </span>
                            </button>
                            {sessionInfo && (
                              sessionInfo.hasRecorded ? (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-green-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  ✓ Sudah Absen ({sessionInfo.status})
                                </span>
                              ) : (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 animate-pulse">
                                  Belum Absen
                                </span>
                              )
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">KAMAR: <strong className="text-slate-600 dark:text-slate-350">{student.kamar || "Belum Set"}</strong></span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Kehadiran: {persenHadir}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 select-none self-end xl:self-auto">
                        <div className="flex flex-col items-center px-3 py-1 bg-emerald-50 dark:bg-green-950/20 border border-emerald-200/60 dark:border-green-900/40 rounded-xl shadow-3xs" title="Hadir Tepat Waktu">
                          <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Hadir</span>
                          <strong className="text-emerald-800 dark:text-emerald-400 font-black text-xs">{pPeriodStats.hadir}</strong>
                        </div>
                        <div className="flex flex-col items-center px-3 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl shadow-3xs" title="Terlambat">
                          <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Telat</span>
                          <strong className="text-amber-800 dark:text-amber-400 font-black text-xs">{pPeriodStats.terlambat}</strong>
                        </div>
                        <div className="flex flex-col items-center px-3 py-1 bg-sky-50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 rounded-xl shadow-3xs" title="Izin / Sakit">
                          <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Izin/Skt</span>
                          <strong className="text-sky-800 dark:text-sky-400 font-black text-xs">{pPeriodStats.sakit + pPeriodStats.pulang}</strong>
                        </div>
                        <div className="flex flex-col items-center px-3 py-1 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-xl shadow-3xs" title="Alfa / Tanpa Keterangan">
                          <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Alfa</span>
                          <strong className="text-rose-800 dark:text-rose-400 font-black text-xs">{pPeriodStats.alpa}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-2xl text-xs font-bold leading-normal">
                  {isSesiSelected && rekapBelumAbsenFilter === "belum_absen" ? (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-emerald-600">Alhamdulillah! Semua santri sudah melakukan absensi pada sesi ini.</p>
                      <p className="text-xs text-slate-400">Tidak ada santri yang berstatus belum absen.</p>
                    </div>
                  ) : (
                    "Tidak ada data presensi yang cocok dengan filter yang dipilih."
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
            )
      )}

      {/* D. WHATSAPP CONFIGURATION & LOG PANEL */}
      {attendanceSubTab === "whatsapp" && (
        <div className="space-y-6 animate-fade-in" id="attendance_whatsapp_section">
          
          {/* Header Card */}
          <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#25D366]">
                <MessageSquare className="w-5 h-5 fill-current" />
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider font-display">
                  Manajemen Notifikasi WhatsApp Ortu
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                Kirim pesan otomatis atau manual berisi detail presensi (hadir, telat, waktu, sesi) langsung ke WhatsApp orang tua santri secara instan.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200/50 dark:border-slate-800">
              <label className="text-xs font-black text-slate-700 dark:text-slate-350 select-none cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isWaAutoSendEnabled}
                  onChange={(e) => setIsWaAutoSendEnabled(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                Kirim Otomatis Saat Scan Sukses
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* GATEWAY SETTINGS CARD */}
            <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-slate-500" />
                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Konfigurasi WA Gateway
                </h4>
              </div>

              {/* Mode Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-450 dark:text-slate-500">Mode Pengiriman</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "manual", label: "Manual Chat", desc: "WhatsApp Web Link" },
                    { id: "fonnte", label: "Fonnte API", desc: "Automated Gateway" },
                    { id: "custom", label: "Custom REST", desc: "API URL Kustom" }
                  ].map((mode) => {
                    const isActive = waGatewayType === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setWaGatewayType(mode.id as any)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                          isActive
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-[#25D366] text-[#128C7E] dark:text-emerald-400 font-extrabold"
                            : "bg-[#f8fafc] dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100/50"
                        }`}
                      >
                        <span className="text-xs">{mode.label}</span>
                        <span className="text-[8px] opacity-80 leading-none">{mode.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gateway Detail Info Text */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-505 dark:text-slate-400 leading-relaxed">
                {waGatewayType === "manual" && (
                  <p>
                    💡 <strong>Mode Manual:</strong> 100% Gratis & tanpa setup API key. Saat scan berhasil, sebuah tombol chat akan muncul. Klik tombol tersebut untuk membuka WhatsApp Web / Aplikasi WA berisi pesan laporan siap kirim ke orang tua santri.
                  </p>
                )}
                {waGatewayType === "fonnte" && (
                  <p>
                    ⚡ <strong>Mode Fonnte:</strong> Kirim notifikasi secara otomatis di latar belakang (tanpa klik manual). Membutuhkan akun berbayar Fonnte. Masukkan Token API Anda di bawah.
                  </p>
                )}
                {waGatewayType === "custom" && (
                  <p>
                    🛠️ <strong>Mode Custom Gateway:</strong> Kirim JSON POST request ke endpoint server kustom Anda. Format request yang dikirimkan: <code>{"{ phone, message }"}</code>.
                  </p>
                )}
              </div>

              {/* Token API Input (for Fonnte / Custom) */}
              {waGatewayType !== "manual" && (
                <div className="space-y-1.5 animate-scale-up">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                    {waGatewayType === "fonnte" ? "Token API Fonnte" : "API Token / Authorization Header (Opsional)"}
                  </label>
                  <input
                    type="password"
                    placeholder={waGatewayType === "fonnte" ? "Masukkan Token Fonnte Anda..." : "Authorization Token..."}
                    value={waApiKey}
                    onChange={(e) => setWaApiKey(e.target.value)}
                    className="w-full text-xs font-bold px-4 py-2.5 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                  />
                </div>
              )}

              {/* Custom Gateway URL (for Custom) */}
              {waGatewayType === "custom" && (
                <div className="space-y-1.5 animate-scale-up">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">URL REST API Custom Gateway</label>
                  <input
                    type="url"
                    placeholder="https://api.domain.com/send-message"
                    value={waCustomUrl}
                    onChange={(e) => setWaCustomUrl(e.target.value)}
                    className="w-full text-xs font-bold px-4 py-2.5 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                  />
                </div>
              )}
            </div>

            {/* TEMPLATE MESSAGE CARD */}
            <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-slate-500" />
                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Template Isi Pesan
                </h4>
              </div>

              {/* Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Edit Template Pesan</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Reset template ke default?")) {
                        setWaTemplate(`*LAPORAN KEHADIRAN SANTRI*\n\nAssalamualaikum Wr. Wb.\n\nYth. Orang Tua/Wali dari *{nama}*,\n\nMenginfokan bahwa santri tersebut telah tercatat mengikuti presensi:\n\n- *Sesi*: {sesi}\n- *Kegiatan*: {tipe}\n- *Waktu*: {waktu} WIB\n- *Tanggal*: {tanggal}\n- *Status Kehadiran*: *{status}*\n\nTerima kasih atas perhatian dan dukungannya.\n\n_Pondok Pesantren Al Muttaqin Madiun_`);
                      }
                    }}
                    className="text-[9px] font-bold text-[#3e46ca] dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>
                <textarea
                  value={waTemplate}
                  onChange={(e) => setWaTemplate(e.target.value)}
                  rows={7}
                  className="w-full text-xs font-mono font-medium p-3.5 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white leading-relaxed"
                />
              </div>

              {/* Variable tags list */}
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-450">Variabel Dinamis (Salin & Tempel)</label>
                <div className="flex flex-wrap gap-1.5 select-all">
                  {[
                    { tag: "{nama}", desc: "Nama Lengkap" },
                    { tag: "{panggilan}", desc: "Nama Panggilan" },
                    { tag: "{sesi}", desc: "Nama Sesi (misal: Subuh)" },
                    { tag: "{tipe}", desc: "Jenis Sesi (Sholat/Ngaji)" },
                    { tag: "{waktu}", desc: "Jam Presensi" },
                    { tag: "{tanggal}", desc: "Tanggal" },
                    { tag: "{status}", desc: "Hadir / Terlambat" }
                  ].map(item => (
                    <span 
                      key={item.tag} 
                      className="bg-indigo-50/60 dark:bg-slate-900 text-[#3e46ca] dark:text-indigo-450 border border-indigo-100/40 dark:border-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold tracking-tight cursor-help shadow-3xs"
                      title={item.desc}
                    >
                      {item.tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Real-time Interactive Mockup */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Pratinjau Pesan Terkirim (Mockup)</label>
                <div className="bg-[#e5ddd5] dark:bg-slate-950 p-4 rounded-2xl relative shadow-inner overflow-hidden max-h-[220px] overflow-y-auto">
                  {/* WhatsApp chat balloon */}
                  <div className="bg-white dark:bg-[#075e54]/30 rounded-2xl rounded-tl-none p-3 max-w-[85%] border border-slate-200/50 dark:border-slate-900 text-[11px] text-slate-800 dark:text-white whitespace-pre-wrap leading-relaxed shadow-sm font-sans">
                    {formatNotificationMessage(
                      { nama_lengkap: "Zaidan Al Faruq", nama_panggilan: "Zaidan", kamar: "Gaza 3", kategori: "SMP" } as any,
                      "Hadir Tepat Waktu",
                      activeSessionObj?.label || "Sholat Shubuh",
                      mapLocalSessionToDbSession(activeSessionObj?.id || "subuh", sessions).presensi || "sholat",
                      isSimulatingTime ? simulatedTimeVal.replace(".", ":") : "04:30 WIB",
                      new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    )}
                    <span className="text-[8.5px] text-slate-400 block text-right mt-1.5 font-sans font-semibold">
                      04.30 ✓✓
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RECENT NOTIFICATION LOGS TABLE CARD */}
          <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-500" />
                <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Log Notifikasi WhatsApp Terbaru
                </h4>
              </div>
              {waLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Apakah Anda yakin ingin menghapus semua histori log pengiriman WA?")) {
                      setWaLogs([]);
                    }
                  }}
                  className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus Histori Log
                </button>
              )}
            </div>

            {waLogs.length > 0 ? (
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-xs text-left text-slate-505 dark:text-slate-400 font-semibold">
                  <thead className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Waktu</th>
                      <th className="py-3 px-4">Santri</th>
                      <th className="py-3 px-4">No. HP Orang Tua</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Isi Pesan</th>
                      <th className="py-3 px-4 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {waLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/45 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-[10px]">{log.timestamp}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-800 dark:text-white whitespace-nowrap">{log.studentName}</td>
                        <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">{log.phone}</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {log.status === "success" && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/60 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase inline-block">
                              Sukses (API)
                            </span>
                          )}
                          {log.status === "manual" && (
                            <span className="bg-amber-50 dark:bg-amber-955 text-amber-800 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/60 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase inline-block">
                              Menunggu Chat
                            </span>
                          )}
                          {log.status === "failed" && (
                            <span 
                              className="bg-rose-50 dark:bg-rose-955 text-rose-800 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/60 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase inline-block cursor-help"
                              title={log.errorMsg || "Gagal mengirim"}
                            >
                              Gagal (API)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-[10.5px] leading-relaxed" title={log.message}>
                          {log.message}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={async () => {
                              const foundSt = students.find(s => s.nama_lengkap === log.studentName);
                              if (foundSt) {
                                triggerWaNotification(foundSt, "hadir", true);
                              } else {
                                MySwal.fire({
                                  icon: "error",
                                  title: "Gagal Kirim",
                                  text: "Data santri tidak ditemukan di sistem saat ini."
                                });
                              }
                            }}
                            className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-end gap-1 ml-auto cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            Kirim Ulang
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl text-xs font-bold flex flex-col items-center justify-center space-y-1 leading-relaxed">
                <div>📬 Tidak ada log notifikasi WhatsApp terbaru.</div>
                <div className="text-[10px] text-slate-400 font-semibold">Log akan terekam begitu absensi santri sukses diinput/discan.</div>
              </div>
            )}
          </div>

          {/* TUTORIAL CONNECT FONNTE CARD */}
          <div className="bg-white dark:bg-[#111c44] rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Info className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider font-display">
                Panduan Menghubungkan WhatsApp ke Fonnte
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1 & 2 */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center">1</span>
                    <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider font-display">Registrasi Akun Fonnte</h5>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-550 dark:text-slate-400 font-semibold space-y-1 pl-1 leading-relaxed">
                    <li>Kunjungi situs resmi di <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="text-[#3e46ca] dark:text-indigo-400 hover:underline">fonnte.com</a>.</li>
                    <li>Klik tombol <strong className="text-slate-800 dark:text-slate-200">Daftar</strong> dan buat akun menggunakan email aktif Anda.</li>
                    <li>Selesaikan aktivasi akun melalui tautan verifikasi yang dikirimkan ke kotak masuk email Anda.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center">2</span>
                    <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider font-display">Hubungkan Perangkat (Scan QR)</h5>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-550 dark:text-slate-400 font-semibold space-y-1 pl-1 leading-relaxed">
                    <li>Masuk ke Dashboard Fonnte, pilih menu <strong className="text-slate-800 dark:text-slate-200">Devices</strong>.</li>
                    <li>Klik <strong className="text-slate-800 dark:text-slate-200">Add Device</strong> dan masukkan nomor WhatsApp yang akan digunakan sebagai pengirim.</li>
                    <li>Klik ikon <strong className="text-slate-800 dark:text-slate-200">QR Code</strong>, lalu buka WhatsApp di HP Anda, buka <i>Perangkat Tertaut</i>, dan pindai QR Code tersebut untuk menghubungkan device Anda.</li>
                  </ul>
                </div>
              </div>

              {/* Step 3 & 4 */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center">3</span>
                    <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider font-display">Ambil Token API & Tempel di Sini</h5>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-550 dark:text-slate-400 font-semibold space-y-1 pl-1 leading-relaxed">
                    <li>Pada halaman <strong className="text-slate-800 dark:text-slate-200">Devices</strong> di Fonnte, Anda akan melihat baris berisi perangkat Anda dan kolom <strong className="text-slate-800 dark:text-slate-200">Token</strong>.</li>
                    <li>Salin string Token API tersebut secara lengkap.</li>
                    <li>Tempel Token tersebut ke input <strong className="text-slate-800 dark:text-slate-200">Token API Fonnte</strong> di bagian konfigurasi sebelah atas halaman ini.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center">4</span>
                    <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider font-display">Troubleshooting (Masalah & Solusi)</h5>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-550 dark:text-slate-400 font-semibold space-y-1 pl-1 leading-relaxed">
                    <li><strong>Status "Disconnect":</strong> Hubungkan kembali via scan QR code di menu Devices fonnte.com.</li>
                    <li><strong>Notifikasi Sukses tapi Pesan tidak Masuk:</strong> Pastikan HP pengirim memiliki kuota internet aktif, nomor target valid, dan HP tidak dalam mode hemat daya tinggi.</li>
                    <li><strong>Format Nomor HP Ortu:</strong> Pastikan diinput dengan awalan <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-rose-600 dark:text-rose-400">08...</code> atau <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-rose-600 dark:text-rose-400">628...</code> agar dapat dikenali dengan baik oleh Gateway.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
        </>
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
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0a0a1a]/55 backdrop-blur-md transition-opacity duration-200 font-sans cursor-pointer animate-fade-in" 
          id="absensi-custom-popup-overlay"
          onClick={() => setAttendancePopup(null)}
        >
          {attendancePopup.type === "success" ? (
            <div 
              className="relative bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-[#10b981] p-8 max-w-[320px] w-full shadow-2xl text-center pt-8 pb-6 animate-scale-up" 
              id="absensi-success-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setAttendancePopup(null)}
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#10b981] hover:bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white cursor-pointer transition-all hover:scale-110 active:scale-95 z-30"
                aria-label="Tutup"
                title="Tutup (1.5 detik)"
              >
                <Check className="w-5 h-5 stroke-[3]" />
              </button>

              <button
                type="button"
                onClick={() => setAttendancePopup(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>

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

              <div className="space-y-1 mb-3">
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

              {(() => {
                const studentObj = students.find(s => s.nama_lengkap === attendancePopup.studentName);
                if (!studentObj) return null;
                const status = attendancePopup.customMessage || "hadir";
                const parentPhone = studentObj.no_hp_ortu ? studentObj.no_hp_ortu.trim() : "";

                return (
                  <div className="mt-4 mb-5 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-left">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">
                      Notifikasi WhatsApp Ortu
                    </div>
                    {parentPhone ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>{parentPhone}</span>
                        </div>
                        {waGatewayType === "manual" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const url = await triggerWaNotification(studentObj, status, true);
                              if (url) window.open(url, "_blank");
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-extrabold text-[11px] uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.859-4.42 9.863-9.864.002-2.637-1.023-5.116-2.887-6.98a9.803 9.803 0 00-6.97-2.816C6.014 1.945 1.59 6.364 1.586 11.808c-.001 1.693.45 3.344 1.306 4.793l-.99 3.614 3.751-.983zm13.111-7.14c-.29-.145-1.71-.845-1.97-.94-.265-.096-.457-.145-.65.145-.19.29-.74.94-.905 1.13-.165.19-.33.213-.62.069-.29-.145-1.22-.45-2.324-1.435-.86-.767-1.44-1.716-1.61-2.006-.17-.29-.018-.447.127-.59.13-.13.29-.338.435-.507.145-.17.195-.29.29-.483.097-.19.048-.36-.024-.505-.072-.145-.65-1.57-.89-2.15-.233-.566-.47-.49-.65-.5-.165-.008-.354-.01-.544-.01s-.5.07-.76.36c-.26.29-1 .97-1 2.37s1.01 2.75 1.15 2.94c.14.19 1.99 3.04 4.82 4.26.67.29 1.2.47 1.61.6.68.21 1.3.18 1.79.11.54-.08 1.71-.7 1.95-1.37.24-.67.24-1.24.17-1.37-.07-.13-.26-.2-.55-.345z" />
                            </svg>
                            Kirim WA Manual
                          </button>
                        ) : !isWaAutoSendEnabled ? (
                          <div className="space-y-1.5">
                            <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-[10px] font-bold flex items-center justify-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Kirim Otomatis Nonaktif
                            </div>
                            <button
                              type="button"
                              onClick={() => triggerWaNotification(studentObj, status, true)}
                              className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-extrabold text-[11px] uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                            >
                              Kirim Notifikasi WA
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/60 rounded-xl py-1.5 px-3 text-[10px] font-bold flex items-center justify-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Otomatis Terkirim
                            </div>
                            <button
                              type="button"
                              onClick={() => triggerWaNotification(studentObj, status, true)}
                              className="w-full text-indigo-600 dark:text-indigo-400 hover:underline text-[10px] font-bold py-1 text-center cursor-pointer"
                            >
                              Kirim Ulang Notifikasi
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-amber-600 dark:text-amber-400 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/60 rounded-xl py-2 px-3 text-center">
                        ⚠️ No. WA Ortu belum terdaftar di profil santri
                      </div>
                    )}
                  </div>
                );
              })()}

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
              className="relative bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-rose-500 p-8 max-w-[320px] w-full shadow-2xl text-center pt-10 pb-6 animate-scale-up" 
              id="absensi-error-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setAttendancePopup(null)}
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-rose-500 hover:bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-white cursor-pointer transition-all hover:scale-110 active:scale-95 z-30"
                aria-label="Tutup"
                title="Tutup (1.5 detik)"
              >
                <X className="w-5 h-5 stroke-[3]" />
              </button>

              <button
                type="button"
                onClick={() => setAttendancePopup(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>

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

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold px-1 mb-2">
                {attendancePopup.reason === "already_scanned" ? (
                  <>
                    Siswa <span className="text-slate-800 dark:text-white font-extrabold">{attendancePopup.studentName}</span> sudah melakukan absensi sebelumnya pada sesi ini.
                  </>
                ) : attendancePopup.reason === "unregistered_card" ? (
                  <>
                    Kartu belum terdaftar di database kesiswaan. Silakan hubungkan kartu ini ke salah satu santri.
                  </>
                ) : (
                  attendancePopup.customMessage || "Gagal melakukan absensi."
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Download Modal */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-indigo-600 p-5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-black uppercase tracking-wider text-sm">Unduh Rekap Presensi</h3>
                <p className="text-indigo-200 text-[10px] font-bold">Laporan resmi presensi santri</p>
              </div>
              <button 
                onClick={() => setIsDownloadModalOpen(false)}
                className="text-white hover:text-indigo-200 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Notifikasi Pengurutan Sesuai Request */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-start gap-2.5">
                <ArrowUpDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold leading-snug">
                  Data pada rekap yang didownload <strong>diurutkan dari yang paling tinggi kehadirannya sampai yang paling rendah</strong>.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilih Kamar</label>
                <SearchableSelect
                  value={downloadOptions.kamar}
                  onChange={(val) => setDownloadOptions({...downloadOptions, kamar: val})}
                  options={[
                    { value: "All", label: "Semua Kamar" },
                    ...roomsList.map((k: string) => ({ value: k, label: k }))
                  ]}
                  placeholder="Pilih kamar"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rentang Waktu</label>
                <SearchableSelect
                  value={downloadOptions.timeframe}
                  onChange={(val) => setDownloadOptions({...downloadOptions, timeframe: val as "harian" | "mingguan" | "bulanan"})}
                  options={[
                    { value: "harian", label: "Harian" },
                    { value: "mingguan", label: "Mingguan" },
                    { value: "bulanan", label: "Bulanan" }
                  ]}
                  placeholder="Pilih salah satu opsi"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {downloadOptions.timeframe === "harian" ? "Tanggal" : downloadOptions.timeframe === "mingguan" ? "Tanggal dalam Minggu" : "Bulan"}
                </label>
                <input
                  type={downloadOptions.timeframe === "bulanan" ? "month" : "date"}
                  value={downloadOptions.timeframe === "bulanan" ? downloadOptions.tanggal.slice(0, 7) : downloadOptions.tanggal}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDownloadOptions({
                        ...downloadOptions,
                        tanggal: downloadOptions.timeframe === "bulanan" ? `${e.target.value}-01` : e.target.value
                      });
                    }
                  }}
                  className="w-full text-sm font-normal px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {isSesiSelected && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Filter Santri (Sesi: {sessions.find(s => isSessionMatched(s, rekapSesiFilter))?.label || rekapSesiFilter})
                  </label>
                  <SearchableSelect
                    value={downloadOptions.filterStatus || "semua"}
                    onChange={(val) => setDownloadOptions({...downloadOptions, filterStatus: val as any})}
                    options={[
                      { value: "semua", label: "Semua Santri" },
                      { value: "belum_absen", label: `Hanya Belum Absen (${unrecordedCountForSelectedSession} santri)` },
                      { value: "sudah_absen", label: "Hanya yang Sudah Absen" }
                    ]}
                    placeholder="Pilih status siswa"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap justify-end gap-2">
              <button 
                onClick={() => setIsDownloadModalOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={downloadRekapCSV}
                className="px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Download file format CSV / Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>CSV / Excel</span>
              </button>
              <button 
                onClick={downloadRekapPDF}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Download dokumen PDF siap cetak"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESP32 Guide & Wiring Modal */}
      <Esp32NfcGuideModal
        isOpen={showEsp32GuideModal}
        onClose={() => setShowEsp32GuideModal(false)}
        onSimulateTap={(uid) => {
          if (executeScanRef.current) {
            executeScanRef.current(uid, "nfc");
          }
        }}
      />

      {/* NFC UID Format Converter Modal (Hex ⇄ Decimal USB Reader) */}
      <NfcUidConverterModal
        isOpen={showConverterModal}
        onClose={() => setShowConverterModal(false)}
        students={students}
        initialUid={converterInitialUid}
      />

      {/* MODAL RINCIAN 5 WAKTU SHOLAT BERJAMAAH */}
      {selectedStudentForPrayerDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedStudentForPrayerDetail(null);
          }}
        >
          <div className="bg-white dark:bg-[#111c44] border border-slate-200/80 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-scale-up my-auto flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white relative">
              <button
                type="button"
                onClick={() => setSelectedStudentForPrayerDetail(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 border-2 border-white/20 overflow-hidden shrink-0 shadow-md flex items-center justify-center text-3xl">
                  {selectedStudentForPrayerDetail.foto ? (
                    <img 
                      src={selectedStudentForPrayerDetail.foto} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span>{selectedStudentForPrayerDetail.jenis_kelamin === "P" ? "🧕" : "👳"}</span>
                  )}
                </div>

                <div className="min-w-0 pr-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200">
                      Rincian Presensi Sholat
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                      5 Waktu Sholat
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1 leading-snug truncate">
                    {selectedStudentForPrayerDetail.nama_lengkap}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-indigo-200/90 font-medium mt-1 flex-wrap">
                    <span>Kamar: <strong>{selectedStudentForPrayerDetail.kamar || "Belum Set"}</strong></span>
                    {selectedStudentForPrayerDetail.nisn && (
                      <>
                        <span>•</span>
                        <span>NISN: {selectedStudentForPrayerDetail.nisn}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Date navigator bar */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-white/90">
                  <Calendar className="w-4 h-4 text-indigo-300" />
                  <span className="font-bold">{formatIndoDate(prayerDetailDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(prayerDetailDate);
                      d.setDate(d.getDate() - 1);
                      handlePrayerDateChange(d.toISOString().slice(0, 10));
                    }}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1"
                    title="Hari Sebelumnya"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Kemarin</span>
                  </button>
                  <input
                    type="date"
                    value={prayerDetailDate}
                    onChange={(e) => {
                      if (e.target.value) handlePrayerDateChange(e.target.value);
                    }}
                    className="text-xs bg-white/15 border border-white/20 rounded-lg px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-white/40 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(prayerDetailDate);
                      d.setDate(d.getDate() + 1);
                      handlePrayerDateChange(d.toISOString().slice(0, 10));
                    }}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1"
                    title="Hari Selanjutnya"
                  >
                    <span className="hidden sm:inline">Besok</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              {isLoadingPrayerDetail ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold">Memuat rincian sholat santri...</span>
                </div>
              ) : (() => {
                // Calculate detailed statistics for the 5 prayers
                const prayerDetails = PRAYER_SCHEDULE.map(ps => {
                  const detail = getPrayerDetailForSession(ps.key, selectedStudentForPrayerDetail, prayerDetailDate);
                  return {
                    ...ps,
                    ...detail
                  };
                });

                const hadirBerjamaah = prayerDetails.filter(p => p.status === "hadir").length;
                const terlambat = prayerDetails.filter(p => p.status === "terlambat").length;
                const izinSakit = prayerDetails.filter(p => p.status === "sakit" || p.status === "izin" || p.status === "pulang").length;
                const tidakHadir = prayerDetails.filter(p => p.status === "alpa" || p.status === "unmarked").length;
                const persenTuntas = Math.round(((hadirBerjamaah + terlambat) / 5) * 100);

                return (
                  <>
                    {/* Ringkasan 4 Kartu KPI */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 rounded-2xl flex flex-col items-center text-center shadow-3xs">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                          Berjamaah
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="text-xl font-black text-emerald-800 dark:text-emerald-300">{hadirBerjamaah}</strong>
                          <span className="text-[10px] text-emerald-600 font-bold">/ 5</span>
                        </div>
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Tepat Waktu</span>
                      </div>

                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-2xl flex flex-col items-center text-center shadow-3xs">
                        <span className="text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400 tracking-wider">
                          Telat / Masbuk
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="text-xl font-black text-amber-800 dark:text-amber-300">{terlambat}</strong>
                          <span className="text-[10px] text-amber-600 font-bold">/ 5</span>
                        </div>
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">Terlambat</span>
                      </div>

                      <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-900/50 rounded-2xl flex flex-col items-center text-center shadow-3xs">
                        <span className="text-[10px] font-extrabold uppercase text-sky-700 dark:text-sky-400 tracking-wider">
                          Izin / Sakit
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="text-xl font-black text-sky-800 dark:text-sky-300">{izinSakit}</strong>
                          <span className="text-[10px] text-sky-600 font-bold">/ 5</span>
                        </div>
                        <span className="text-[9px] text-sky-600 dark:text-sky-400 font-medium">Udzur Syar'i</span>
                      </div>

                      <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 rounded-2xl flex flex-col items-center text-center shadow-3xs">
                        <span className="text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-400 tracking-wider">
                          Alfa / Belum
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="text-xl font-black text-rose-800 dark:text-rose-300">{tidakHadir}</strong>
                          <span className="text-[10px] text-rose-600 font-bold">/ 5</span>
                        </div>
                        <span className="text-[9px] text-rose-600 dark:text-rose-400 font-medium">Tidak Hadir</span>
                      </div>
                    </div>

                    {/* Evaluasi Status Bar */}
                    <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                      hadirBerjamaah === 5 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                        : terlambat > 0 && tidakHadir === 0
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                        : "bg-indigo-500/10 border-indigo-500/30 text-indigo-800 dark:text-indigo-300"
                    }`}>
                      <div className="flex items-center gap-2">
                        {hadirBerjamaah === 5 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                        <span className="font-semibold">
                          {hadirBerjamaah === 5
                            ? "Alhamdulillah! Santri ini melaksanakan seluruh 5 waktu sholat secara berjamaah tepat waktu."
                            : `Kehadiran Sholat Berjamaah: ${persenTuntas}% (${hadirBerjamaah + terlambat} dari 5 waktu dihadiri).`}
                        </span>
                      </div>
                      <span className="font-black text-sm shrink-0">{persenTuntas}%</span>
                    </div>

                    {/* List 5 Waktu Sholat */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Rincian Status Per Waktu Sholat</span>
                        <span className="text-[11px] font-medium text-slate-400">Jadwal Masjid Pesantren</span>
                      </h4>

                      <div className="space-y-2">
                        {prayerDetails.map((prayer) => {
                          const isHadir = prayer.status === "hadir";
                          const isTelat = prayer.status === "terlambat";
                          const isSakit = prayer.status === "sakit";
                          const isIzin = prayer.status === "izin" || prayer.status === "pulang";
                          const isAlfa = prayer.status === "alpa" || prayer.status === "unmarked";

                          return (
                            <div 
                              key={prayer.key}
                              className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isHadir 
                                  ? "bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200/80 dark:border-emerald-900/40"
                                  : isTelat
                                  ? "bg-amber-50/40 dark:bg-amber-950/15 border-amber-200/80 dark:border-amber-900/40"
                                  : isSakit || isIzin
                                  ? "bg-sky-50/40 dark:bg-sky-950/15 border-sky-200/80 dark:border-sky-900/40"
                                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-lg shrink-0 shadow-3xs">
                                  {prayer.icon}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="text-sm font-extrabold text-slate-800 dark:text-white">
                                      {prayer.name}
                                    </h5>
                                    <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500">
                                      ({prayer.time})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {isHadir && (
                                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Dilaksanakan Berjamaah (Tepat Waktu)
                                      </span>
                                    )}
                                    {isTelat && (
                                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                        Terlambat / Masbuk Pada Jamaah
                                      </span>
                                    )}
                                    {isSakit && (
                                      <span className="text-[11px] text-sky-700 dark:text-sky-400 font-bold flex items-center gap-1">
                                        <Info className="w-3.5 h-3.5 text-sky-600" />
                                        Tidak Sholat Berjamaah (Sakit)
                                      </span>
                                    )}
                                    {isIzin && (
                                      <span className="text-[11px] text-sky-700 dark:text-sky-400 font-bold flex items-center gap-1">
                                        <Info className="w-3.5 h-3.5 text-sky-600" />
                                        Tidak Sholat Berjamaah (Izin/Pulang)
                                      </span>
                                    )}
                                    {isAlfa && (
                                      <span className="text-[11px] text-rose-700 dark:text-rose-400 font-bold flex items-center gap-1">
                                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                        Tidak Mengikuti Berjamaah (Alfa / Belum Absen)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isHadir 
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60"
                                    : isTelat
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60"
                                    : isSakit || isIzin
                                    ? "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-300/60"
                                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300/60"
                                }`}>
                                  {isHadir ? "Berjamaah" : isTelat ? "Terlambat" : isSakit ? "Sakit" : isIzin ? "Izin" : "Alfa"}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {prayer.waktu ? (
                                    <strong>Jam {prayer.waktu} WIB</strong>
                                  ) : (
                                    <span className="italic text-slate-400">Tidak ada jam scan</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Data disinkronkan secara real-time dari mesin absensi & database
              </span>
              <button
                type="button"
                onClick={() => setSelectedStudentForPrayerDetail(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
