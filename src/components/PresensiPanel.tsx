import React, { useState, useEffect, useRef } from "react";
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
  Sparkles
} from "lucide-react";
import { useEsp32NfcListener } from "../hooks/useEsp32NfcListener";
import Esp32NfcGuideModal from "./Esp32NfcGuideModal";
import NfcUidConverterModal from "./NfcUidConverterModal";
import { convertNfcUid } from "../utils/nfcConverter";

interface PresensiPanelProps {
  students: SantriData[];
  rooms?: string[];
  viewMode?: "absensi" | "rekap";
  defaultTab?: "input" | "rekap" | "statistik" | "whatsapp";
  activeMenu?: string; // made optional to support seamless transition to unified absensi menu
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

export default function PresensiPanel({ students, rooms, viewMode = "absensi", defaultTab }: PresensiPanelProps) {
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
  
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState<{
    kamar: string;
    timeframe: "harian" | "mingguan" | "bulanan";
    tanggal: string;
  }>({
    kamar: "All",
    timeframe: "harian",
    tanggal: new Date().toISOString().slice(0, 10),
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
        
        const title = `Rekapitulasi Presensi ${rekapPresensiType === "sholat" ? "Sholat" : rekapPresensiType === "makan" ? "Makan" : "Ngaji"} ${timeframeLabel} - ${downloadOptions.kamar !== "All" ? `Kamar ${downloadOptions.kamar}` : "Semua Kamar"}`;
        
        doc.setFontSize(14);
        doc.text(title, 14, 15);
        doc.setFontSize(10);
        doc.text(`Periode: ${dateLabel}`, 14, 22);
        
        let tableData: any[][] = [];
        let head: string[][] = [];

        const pdfStudents = hydratedStudentsList.filter((s: any) => 
          downloadOptions.kamar === "All" || (s.kamar || "").trim().toLowerCase() === downloadOptions.kamar.trim().toLowerCase()
        );
        
        if (rekapPresensiType === "makan" && tf === "harian") {
          head = [["No", "Nama Santri", "Kamar", "Pagi", "Siang", "Sore", "Total"]];
          tableData = pdfStudents.map((student: any, idx: number) => {
            const pPeriodStats = getStudentPeriodStats(student.id, tf, dt, rekapPresensiType);
            const sessionsTodayData = pPeriodStats.sessionsData[dt] || {};
            const getSessionStatus = (keyword: string) => {
                const s = sessions.find(sess => mapLocalSessionToDbSession(sess.id, sessions).presensi === "makan" && sess.label.toLowerCase().includes(keyword));
                if (!s) return "unmarked";
                return sessionsTodayData[s.id] || "unmarked";
            };
            const pagi = getSessionStatus("pagi");
            const siang = getSessionStatus("siang");
            const sore = getSessionStatus("sore");
            const countMakan = (pagi==="hadir"?1:0) + (siang==="hadir"?1:0) + (sore==="hadir"?1:0);
            return [
              idx + 1,
              student.nama_lengkap,
              student.kamar || "-",
              pagi === "hadir" ? "V" : "X",
              siang === "hadir" ? "V" : "X",
              sore === "hadir" ? "V" : "X",
              countMakan
            ];
          });
        } else {
          head = [["No", "Nama Santri", "Kamar", "Hadir/Makan", "Sakit/Izin", "Tidak/Alpa", "Persentase"]];
          tableData = pdfStudents.map((student: any, idx: number) => {
            const pPeriodStats = getStudentPeriodStats(student.id, tf, dt, rekapPresensiType);
            const total = pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa + pPeriodStats.sakit + pPeriodStats.pulang;
            const persentase = total > 0 ? Math.round(((pPeriodStats.hadir + pPeriodStats.terlambat) / total) * 100) : 0;
            return [
              idx + 1,
              student.nama_lengkap,
              student.kamar || "-",
              pPeriodStats.hadir + pPeriodStats.terlambat,
              pPeriodStats.sakit + pPeriodStats.pulang,
              pPeriodStats.alpa,
              `${persentase}%`
            ];
          });
        }

        autoTable(doc, {
          startY: 28,
          head: head,
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [62, 70, 202] }
        });

        doc.save(`Rekap_${rekapPresensiType}_${timeframeLabel}_${dateLabel.replace(/\s+/g, '_')}.pdf`);
        setIsDownloadModalOpen(false);
      });
    });
  };
  executeScanRef.current = executeScan;

  return (
    <div className="w-full py-4 px-2 space-y-6 flex flex-col items-stretch" id="attendance_menu_root">
      
      {/* 1. HEADER BRANDING */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 select-none pt-2" id="attendance_brand_header">
        <div>
          <h2 className="text-3xl font-black text-[#1d2757] dark:text-white font-display tracking-tight leading-none">
            {viewMode === "rekap" ? "Rekap Presensi Santri" : "Absensi Siswa"}
          </h2>
          <p className="text-xs text-[#566580] dark:text-slate-400 font-bold mt-2.5 flex flex-wrap items-center justify-start gap-1.5 uppercase tracking-wide">
            {viewMode === "rekap" ? (
              <span>Laporan Kehadiran Santri Harian, Mingguan, Bulanan & Ekspor PDF</span>
            ) : (
              <>
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

      {/* REKAP VIEW: TAB SELECTOR (Rekap Data | Statistik | WhatsApp) */}
      {viewMode === "rekap" && (
        <div className="bg-white dark:bg-[#111c44] p-1 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm flex items-center select-none" id="attendance_tab_selector">
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
          <button
            onClick={() => setAttendanceSubTab("whatsapp")}
            className={`flex-1 py-3 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer ${
              attendanceSubTab === "whatsapp"
                ? "bg-[#3e46ca] text-white shadow"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            WhatsApp
          </button>
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
          {/* B. REKAP DATA VIEW */}
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

            {/* Filter and Download row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Pencarian nama atau kamar santri..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-[11px] font-medium pl-8.5 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                />
              </div>
              <button
                onClick={() => setIsDownloadModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Laporan PDF</span>
              </button>
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
                      const total = pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa + pPeriodStats.sakit + pPeriodStats.pulang;
                      const persentase = total > 0 ? Math.round(((pPeriodStats.hadir + pPeriodStats.terlambat) / total) * 100) : 0;
                      return (
                        <div key={student.id} className="py-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs font-semibold">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 overflow-hidden relative shrink-0 shadow-xs">
                              {student.foto ? <img src={student.foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg select-none">{isFemale ? "🧕" : "👳"}</div>}
                            </div>
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-800 dark:text-white block text-sm leading-snug truncate whitespace-nowrap">{student.nama_lengkap}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">KAMAR: <strong className="text-slate-600 dark:text-slate-350">{student.kamar || "Belum Set"}</strong></span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 select-none self-end xl:self-auto">
                            <div className="flex flex-col items-center px-3 py-1 bg-emerald-50 dark:bg-green-950/20 border border-emerald-200/60 dark:border-green-900/40 rounded-xl">
                              <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Hadir/Makan</span>
                              <strong className="text-emerald-800 dark:text-emerald-400 font-black text-xs">{pPeriodStats.hadir + pPeriodStats.terlambat}</strong>
                            </div>
                            <div className="flex flex-col items-center px-3 py-1 bg-sky-50 dark:bg-sky-950/20 border border-sky-250/60 dark:border-sky-900/40 rounded-xl shadow-3xs">
                              <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Skt/Iz</span>
                              <strong className="text-sky-800 dark:text-sky-400 font-black text-xs">{pPeriodStats.sakit + pPeriodStats.pulang}</strong>
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
                    const total = pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa + pPeriodStats.sakit + pPeriodStats.pulang;
                    const persentase = (pPeriodStats.hadir + pPeriodStats.terlambat + pPeriodStats.alpa + pPeriodStats.sakit + pPeriodStats.pulang) > 0 ? Math.round(((pPeriodStats.hadir + pPeriodStats.terlambat) / total) * 100) : 0;
                    return (
                      <div key={student.id} className="py-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs font-semibold">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 overflow-hidden relative shrink-0 shadow-xs">
                            {student.foto ? <img src={student.foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg select-none">{isFemale ? "🧕" : "👳"}</div>}
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-slate-800 dark:text-white block text-sm leading-snug truncate whitespace-nowrap">{student.nama_lengkap}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">KAMAR: <strong className="text-slate-600 dark:text-slate-350">{student.kamar || "Belum Set"}</strong></span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 select-none self-end xl:self-auto">
                          <div className="flex flex-col items-center px-3 py-1 bg-emerald-50 dark:bg-green-950/20 border border-emerald-200/60 dark:border-green-900/40 rounded-xl shadow-3xs">
                            <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Hadir</span>
                            <strong className="text-emerald-800 dark:text-emerald-400 font-black text-xs">{pPeriodStats.hadir}</strong>
                          </div>
                          <div className="flex flex-col items-center px-3 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-250/60 dark:border-amber-900/40 rounded-xl shadow-3xs">
                            <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Telat</span>
                            <strong className="text-amber-800 dark:text-amber-400 font-black text-xs">{pPeriodStats.terlambat}</strong>
                          </div>
                          <div className="flex flex-col items-center px-3 py-1 bg-sky-50 dark:bg-sky-950/20 border border-sky-250/60 dark:border-sky-900/40 rounded-xl shadow-3xs">
                            <span className="text-slate-500 dark:text-slate-400 text-[9px] font-extrabold uppercase mb-0.5">Skt/Iz</span>
                            <strong className="text-sky-800 dark:text-sky-400 font-black text-xs">{pPeriodStats.sakit + pPeriodStats.pulang}</strong>
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-indigo-600 p-5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-black uppercase tracking-wider text-sm">Unduh PDF</h3>
                <p className="text-indigo-200 text-[10px] font-bold">Atur parameter laporan sebelum mengunduh</p>
              </div>
              <button 
                onClick={() => setIsDownloadModalOpen(false)}
                className="text-white hover:text-indigo-200 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Pilih Kamar</label>
                <select
                  value={downloadOptions.kamar}
                  onChange={(e) => setDownloadOptions({...downloadOptions, kamar: e.target.value})}
                  className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="All">Semua Kamar</option>
                  {roomsList.map((k: string) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Rentang Waktu</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700">
                  {[
                    { id: "harian", label: "Harian" },
                    { id: "mingguan", label: "Mingguan" },
                    { id: "bulanan", label: "Bulanan" }
                  ].map((tf) => (
                    <button
                      key={tf.id}
                      onClick={() => setDownloadOptions({...downloadOptions, timeframe: tf.id as "harian" | "mingguan" | "bulanan"})}
                      className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        downloadOptions.timeframe === tf.id 
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
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
                  className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button 
                onClick={() => setIsDownloadModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={downloadRekapPDF}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh PDF
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

    </div>
  );
}
