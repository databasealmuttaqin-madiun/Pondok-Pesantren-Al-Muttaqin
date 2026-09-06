import { PageHeader } from './ui/PageHeader';
import React, { useState, useEffect, useRef } from "react";
import { SantriData } from "../supabaseClient";
import { Fingerprint, Search, User, Home, HelpCircle, Check, AlertTriangle, Trash2, Shield, RefreshCw, Cpu, Wifi, Usb, Radio, ArrowRightLeft, Copy, Sparkles, CheckCircle2, X } from "lucide-react";
import { useEsp32NfcListener } from "../hooks/useEsp32NfcListener";
import Esp32NfcGuideModal from "./Esp32NfcGuideModal";
import NfcUidConverterModal from "./NfcUidConverterModal";
import { isNfcMatch, convertNfcUid, cleanCodeString, NfcConversionResult } from "../utils/nfcConverter";

/**
 * Normalizes an NFC token or UID (serial number) to prevent mismatch due to colons, spaces, or casing
 */
export function normalizeNfcId(id: string): string {
  if (!id) return "";
  return cleanCodeString(id);
}

/**
 * Resolves scanned code, checks if it is a Google Form URL or has a student name populated
 * Uses bidirectional multi-format matching (Hex, Decimal Big-Endian, Decimal Little-Endian)
 */
export function parseNfcPayload(code: string, students: SantriData[]) {
  const cleanCode = code.trim();
  let isUrl = false;
  let extractedName = "";
  
  // Check if it's a URL
  if (
    cleanCode.startsWith("http://") || 
    cleanCode.startsWith("https://") || 
    cleanCode.includes("docs.google.com") || 
    cleanCode.includes("form")
  ) {
    isUrl = true;
    try {
      const decodedUrl = decodeURIComponent(cleanCode);
      // Attempt to extract from standard google form entry URL queries
      const matches = decodedUrl.match(/entry\.\d+=([^&?]+)/gi);
      if (matches) {
        for (const match of matches) {
          const parts = match.split("=");
          if (parts.length === 2) {
            const val = parts[1].replace(/\+/g, " ").trim();
            if (val && val.length > 3) {
              // Verify if there is a student that matches this name (case-insensitive)
              const matchedByName = students.find(
                (s) =>
                  s.nama_lengkap.trim().toLowerCase() === val.toLowerCase() ||
                  s.nama_panggilan.trim().toLowerCase() === val.toLowerCase()
              );
              if (matchedByName) {
                extractedName = val;
                return {
                  isUrl: true,
                  rawCode: cleanCode,
                  extractedName,
                  matchedStudent: matchedByName,
                };
              } else {
                extractedName = val;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Parsing URL error:", e);
    }
  }

  // Bidirectional universal matching against nfc_id (Hex & Decimal both Little-Endian / Big-Endian) or nik
  let matchedStudent = students.find((s) => {
    if (s.nfc_id && isNfcMatch(cleanCode, s.nfc_id)) {
      return true;
    }
    const studentNikNormalized = s.nik ? s.nik.trim().toUpperCase() : "";
    return studentNikNormalized !== "" && studentNikNormalized === cleanCode.toUpperCase();
  });

  // FALLBACK: If not matched by card ID / NIK, match directly against student name or nickname
  if (!matchedStudent && cleanCode.length > 2) {
    const cleanAndNormalizeString = (str: string) => {
      return str.trim().toLowerCase().replace(/\s+/g, " ");
    };
    const scanNormalized = cleanAndNormalizeString(cleanCode);
    
    matchedStudent = students.find((s) => {
      const studentNameNormalized = cleanAndNormalizeString(s.nama_lengkap);
      const studentNickNormalized = s.nama_panggilan ? cleanAndNormalizeString(s.nama_panggilan) : "";
      return (
        studentNameNormalized === scanNormalized ||
        studentNickNormalized === scanNormalized
      );
    });
  }

  return {
    isUrl,
    rawCode: cleanCode,
    extractedName,
    matchedStudent,
  };
}

interface NfcRegisterPanelProps {
  students: SantriData[];
  rooms: string[];
  onUpdateNfc: (studentId: number, nfcId: string | null) => Promise<boolean>;
  isDarkMode: boolean;
  viewMode?: "scan" | "database";
}

export default function NfcRegisterPanel({
  students,
  rooms,
  onUpdateNfc,
  isDarkMode,
  viewMode = "scan"
}: NfcRegisterPanelProps) {
  const activeSubTab = viewMode;
  
  // Real-time input buffer for physical NFC scanning emulated by USB Readers
  const [scannedCode, setScannedCode] = useState<string>("");
  const [keyBuffer, setKeyBuffer] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(true);

  // Assignment states for unregistered cards
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<SantriData | null>(null);
  const [assignSearch, setAssignSearch] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search filter for Registered Database Tab
  const [dbSearch, setDbSearch] = useState<string>("");
  const [dbStatusFilter, setDbStatusFilter] = useState<"Aktif" | "Mubaligh" | "Nonaktif">("Aktif");

  // Web NFC Support checks
  const isNfcSupported = typeof window !== "undefined" && "NDEFReader" in window;
  const [isNfcActive, setIsNfcActive] = useState<boolean>(false);
  const [webNfcError, setWebNfcError] = useState<string | null>(null);

  // Simulated Cards helper list (allows web previewers to simulate cards easily)
  const [simulationCode, setSimulationCode] = useState<string>("");

  // ESP32 RC522 Reader Integration
  const [showEsp32GuideModal, setShowEsp32GuideModal] = useState<boolean>(false);

  // UID Converter Modal
  const [showConverterModal, setShowConverterModal] = useState<boolean>(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const {
    wifiStatus,
    lastTap,
    isWebSerialSupported,
    isSerialConnected,
    serialError,
    connectWebSerial,
    disconnectWebSerial,
    triggerSimulatedTap
  } = useEsp32NfcListener({
    onCardTapped: (uid) => {
      processScan(uid);
    },
    enabled: activeSubTab === "scan"
  });

  // Hook for real device NDEFReader Scanner binding for mobile phones
  useEffect(() => {
    if (!isNfcActive || !isNfcSupported) return;

    let ndefReaderInstance: any = null;
    let isMounted = true;

    const startNfcScanning = async () => {
      try {
        setWebNfcError(null);
        const NDEFReaderClass = (window as any).NDEFReader;
        ndefReaderInstance = new NDEFReaderClass();
        await ndefReaderInstance.scan();
        
        if (!isMounted) return;

        ndefReaderInstance.onreading = (event: any) => {
          if (!isMounted) return;
          const tagSerial = event.serialNumber;
          if (tagSerial) {
            // Standardize raw token (colons, uppercase)
            const uppercaseSerial = String(tagSerial).toUpperCase();
            processScan(uppercaseSerial);
            // Vibrate mobile device for haptic feedback
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
          }
        };

        ndefReaderInstance.onreadingerror = () => {
          if (!isMounted) return;
          setWebNfcError("Gagal membaca sinyal kartu NFC. Coba dekatkan kartu kembali.");
        };
      } catch (err: any) {
        console.warn("NFC hardware scan permission error or failed initialization:", err);
        if (isMounted) {
          setIsNfcActive(false);
          setWebNfcError(`Gagal mengaktifkan NFC: ${err.message || err}`);
        }
      }
    };

    startNfcScanning();
    return () => {
      isMounted = false;
    };
  }, [isNfcActive, isNfcSupported]);

  // Listening for background keystrokes mimicking an NFC/RFID USB keyboard emulator reader
  useEffect(() => {
    if (!isListening || activeSubTab !== "scan") return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Avoid intercepting deliberate input typing inside text fields or dropdown selects
      if (
        document.activeElement?.tagName === "INPUT" || 
        document.activeElement?.tagName === "SELECT" || 
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Enter") {
        if (keyBuffer.trim()) {
          processScan(keyBuffer.trim());
          setKeyBuffer("");
        }
      } else if (e.key.length === 1) {
        setKeyBuffer((prev) => prev + e.key);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [keyBuffer, isListening, activeSubTab]);

  // Determine matching student based on currently captured NFC ID or Google Form payload
  const parsedResult = scannedCode ? parseNfcPayload(scannedCode, students) : null;
  const matchedStudent = parsedResult?.matchedStudent || null;

  // Process a newly read NFC Serial Card Number
  const processScan = (code: string) => {
    const cleanCode = code.trim();
    setScannedCode(cleanCode);
    
    // Auto-prefill assignment form based on existing records if unmatched
    const res = parseNfcPayload(cleanCode, students);

    if (!res.matchedStudent) {
      setSelectedRoom("");
      setSelectedStudentId("");
      setSelectedStudent(null);
      setAssignSearch("");
    } else {
      setSelectedRoom(res.matchedStudent.kamar || "");
      setSelectedStudentId(String(res.matchedStudent.id ?? res.matchedStudent.nik));
      setSelectedStudent(res.matchedStudent);
      setAssignSearch(res.matchedStudent.nama_lengkap);
    }
  };

  // Select student handler
  const handleSelectStudent = (s: SantriData) => {
    setSelectedStudent(s);
    setSelectedStudentId(String(s.id ?? s.nik));
    setAssignSearch(s.nama_lengkap);
    setIsDropdownOpen(false);
  };

  // Trigger registration to database
  const handleAssignCard = async () => {
    if (!scannedCode) return;
    const target = selectedStudent || students.find(s => String(s.id) === selectedStudentId || (s.nik && s.nik === selectedStudentId));
    if (!target) {
      alert("Harap cari dan pilih nama santri terlebih dahulu.");
      return;
    }

    setIsRegistering(true);
    const studentId = Number(target.id) || (target.id as any);
    const success = await onUpdateNfc(studentId, scannedCode);
    
    setIsRegistering(false);
    if (success) {
      // Clear form after successful registration
      setSelectedRoom("");
      setSelectedStudentId("");
      setSelectedStudent(null);
      setAssignSearch("");
    }
  };

  // Remove the card binding
  const handleDeassignCard = async (studentId: number, studentName: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus serial kartu NFC dari ${studentName}?`)) {
      await onUpdateNfc(studentId, null);
      if (scannedCode) {
        // Clear screen if deleting the currently scanned card
        const updatedStudent = students.find(s => s.id === studentId);
        if (updatedStudent && updatedStudent.nfc_id === scannedCode) {
          setScannedCode("");
        }
      }
    }
  };

  // Get student list filtered by the selected room and search text (for assignment form)
  const filteredStudentsForAssign = students.filter((s) => {
    const matchRoom = selectedRoom ? (s.kamar || "").trim().toLowerCase() === selectedRoom.trim().toLowerCase() : true;
    const query = assignSearch.trim().toLowerCase();
    const matchSearch = query
      ? (s.nama_lengkap || "").toLowerCase().includes(query) ||
        (s.nama_panggilan || "").toLowerCase().includes(query) ||
        (s.nik || "").toLowerCase().includes(query) ||
        (s.kamar || "").toLowerCase().includes(query) ||
        (s.kelas_sekolah || "").toLowerCase().includes(query) ||
        (s.kelas_pengajian || "").toLowerCase().includes(query)
      : true;
    return matchRoom && matchSearch;
  });

  // Derive rooms dynamically from active rooms list
  const derivedRooms = (() => {
    if (rooms && rooms.length > 0) {
      return Array.from(new Set(rooms.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    }
    return Array.from(
      new Set(students.map((s) => s.kamar || "").filter(Boolean))
    ).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  })();

  // Get list of all students that already have registered NFC cards
  const studentsWithNfc = students.filter(
    (s) => s.nfc_id && s.nfc_id.trim() !== ""
  );

  // Filter registered NFC cards for Database View based on status filter & search
  const filteredDbList = studentsWithNfc.filter((s) => {
    const katStr = String(s.kategori || "");
    const statusStr = String((s as any).status || "");

    // 1. Status Filter
    if (dbStatusFilter === "Aktif") {
      const isMubaligh = katStr === "Mubaligh" || katStr.toLowerCase().includes("mubaligh") || statusStr === "Mubaligh";
      const isNonaktif = statusStr === "Nonaktif" || statusStr === "Mutasi" || statusStr === "Lulus";
      if (isMubaligh || isNonaktif) return false;
    } else if (dbStatusFilter === "Mubaligh") {
      const isMubaligh = katStr === "Mubaligh" || katStr.toLowerCase().includes("mubaligh") || statusStr === "Mubaligh";
      if (!isMubaligh) return false;
    } else if (dbStatusFilter === "Nonaktif") {
      const isNonaktif = statusStr === "Nonaktif" || statusStr === "Mutasi" || statusStr === "Lulus";
      if (!isNonaktif) return false;
    }

    // 2. Text Search
    const query = dbSearch.toLowerCase();
    return (
      s.nama_lengkap.toLowerCase().includes(query) ||
      s.nama_panggilan.toLowerCase().includes(query) ||
      (s.kamar || "").toLowerCase().includes(query) ||
      s.nfc_id?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6" id="nfc-comprehensive-panel">
      <PageHeader 
        breadcrumbs={["Registrasi NFC", activeSubTab === "scan" ? "Daftar Kartu" : "Database Kartu"]}
        title={activeSubTab === "scan" ? "Pendaftaran Kartu NFC" : "Database Kartu NFC"}
      />
      
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setShowConverterModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer shadow-sm"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Kalkulator UID</span>
        </button>
      </div>

      {activeSubTab === "scan" ? (
        <div className="w-full" id="nfc-scan-tab">
          {/* Main Registration & Allocation Card */}
          <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm min-h-[420px] flex flex-col justify-between">
            
            {!scannedCode ? (
              /* Waiting / Ready State */
              <div className="my-auto text-center py-10 space-y-5 max-w-xl mx-auto">
                <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto shadow-xs">
                  <Fingerprint className="w-10 h-10 animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-base font-bold text-slate-800 dark:text-white">
                    Siap Membaca Kartu RFID / NFC
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Silakan tempelkan kartu pada USB Reader atau masukkan kode serial kartu di bawah untuk mendaftarkan dan menghubungkan kartu ke santri.
                  </p>
                </div>

                {/* Input manual / simulasi cepat */}
                <div className="pt-3 max-w-md mx-auto">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={simulationCode}
                      onChange={(e) => setSimulationCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && simulationCode.trim()) {
                          processScan(simulationCode);
                        }
                      }}
                      placeholder="Ketik/tempel kode serial kartu..."
                      className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (simulationCode.trim()) {
                          processScan(simulationCode);
                        }
                      }}
                      disabled={!simulationCode.trim()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      Proses Kartu
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Active State: Card is scanned, perform logic checks */
              <div className="space-y-6">
                {/* Reset / Scan Ulang Bar */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setScannedCode("");
                      setSimulationCode("");
                      setKeyBuffer("");
                    }}
                    className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Ganti / Scan Ulang
                  </button>
                </div>

                {parsedResult?.isUrl && (
                  <div className="bg-blue-50/60 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900 rounded-2xl p-4 flex gap-3 text-left">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-extrabold text-sm shadow-sm">i</div>
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-bold uppercase text-blue-800 dark:text-blue-400 tracking-wider">FORMAT PRE-FILL GOOGLE FORM TERDETEKSI</h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        Pembaca NFC memindai data tertulis berupa Link Google Form. 
                        {parsedResult.extractedName ? (
                          <> Terdeteksi nama santri <strong className="text-blue-900 dark:text-blue-100">"{parsedResult.extractedName}"</strong> di dalam parameter link tersebut!</>
                        ) : (
                          <> Menyimpan parameter unik ini sebagai identitas kartu NFC.</>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {matchedStudent ? (
                  /* CASE A: Card is already registered to a student */
                  <div className="space-y-6">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">KARTU SUDAH TERDAFTAR</h4>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-500 leading-normal mt-0.5">
                          Serial kartu NFC ini sudah terpasang dan valid milik santri di bawah ini.
                        </p>
                      </div>
                    </div>

                    {/* Display Profile card of registered student */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                      
                      {/* Student Photo */}
                      <div className="w-24 h-32 bg-[#c22026] rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {matchedStudent.foto ? (
                          <img src={matchedStudent.foto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl">
                            {matchedStudent.jenis_kelamin === "P" ? "🧕" : "👳"}
                          </span>
                        )}
                      </div>

                      {/* Student Credentials details */}
                      <div className="flex-1 space-y-3 text-center sm:text-left">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800">
                            {matchedStudent.kategori}
                          </span>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-1.5 leading-tight">
                            {matchedStudent.nama_lengkap}
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                            <Home className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>Kamar: <strong className="text-slate-800 dark:text-slate-200">{matchedStudent.kamar || "Belum diplot"}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>Jenkel: <strong className="text-slate-800 dark:text-slate-200">{matchedStudent.jenis_kelamin === "P" ? "Perempuan" : "Laki-laki"}</strong></span>
                          </div>
                          <div className="col-span-2 text-center sm:text-left font-mono text-xs text-slate-400">
                            NIK: {matchedStudent.nik || "-"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Deassign action */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeassignCard(matchedStudent.id!, matchedStudent.nama_lengkap)}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        Hapus Sambungan Kartu
                      </button>
                    </div>
                  </div>
                ) : (
                  /* CASE B: Card is unregistered. Offer option to register */
                  <div className="space-y-5 animate-slide-up">
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                        <AlertTriangle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400">KARTU BELUM TERDAFTAR</h4>
                        <p className="text-[11px] text-amber-700 dark:text-amber-500 leading-normal mt-0.5">
                          Serial kartu NFC ini belum terhubung ke santri manapun. Silakan pilih santri untuk mengalokasikannya.
                        </p>
                      </div>
                    </div>

                    {/* Room and Student Selectors Registration Form */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                        ALOKASIKAN KARTU KE SANTRI
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Step 1: Select Room (kamar) */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            1. Filter Kamar (Opsional)
                          </label>
                          <select
                            value={selectedRoom}
                            onChange={(e) => {
                              setSelectedRoom(e.target.value);
                              setSelectedStudentId("");
                              setSelectedStudent(null);
                            }}
                            className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white transition-all shadow-inner"
                          >
                            <option value="">-- SEMUA KAMAR --</option>
                            {derivedRooms.map((r) => (
                              <option key={r} value={r}>
                                KAMAR: {r}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Step 2: Search and Select Student */}
                        <div className="space-y-1 relative" ref={dropdownRef}>
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                              2. Cari & Pilih Santri <span className="text-rose-500">*</span>
                            </label>
                            {selectedStudent && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Terpilih
                              </span>
                            )}
                          </div>
                          
                          <div className="relative w-full">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                              <Search className="w-3.5 h-3.5" />
                            </span>
                            <input
                              type="text"
                              placeholder="Ketik nama lengkap / panggilan / NIK..."
                              value={assignSearch}
                              onChange={(e) => {
                                setAssignSearch(e.target.value);
                                setIsDropdownOpen(true);
                                if (selectedStudent && e.target.value !== selectedStudent.nama_lengkap) {
                                  setSelectedStudent(null);
                                  setSelectedStudentId("");
                                }
                              }}
                              onFocus={() => setIsDropdownOpen(true)}
                              onClick={() => setIsDropdownOpen(true)}
                              className="w-full text-xs font-medium pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white transition-all shadow-inner"
                              required={!selectedStudentId}
                            />
                            {assignSearch && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignSearch("");
                                  setSelectedStudent(null);
                                  setSelectedStudentId("");
                                  setIsDropdownOpen(false);
                                }}
                                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                title="Hapus pencarian"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            
                            {isDropdownOpen && (
                              <div 
                                onMouseDown={(e) => e.preventDefault()}
                                className="absolute z-20 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                              >
                                {filteredStudentsForAssign.length > 0 ? (
                                  filteredStudentsForAssign.slice(0, 40).map((s) => {
                                    const isSelected = selectedStudentId === String(s.id ?? s.nik);
                                    return (
                                      <div
                                        key={s.id ?? s.nik}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleSelectStudent(s);
                                        }}
                                        onClick={() => handleSelectStudent(s)}
                                        className={`p-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between gap-2.5 ${
                                          isSelected 
                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold" 
                                            : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                                            {s.foto ? (
                                              <img src={s.foto} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              <span>{s.jenis_kelamin === "P" ? "🧕" : "👳"}</span>
                                            )}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                                              {s.nama_lengkap}
                                            </div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 truncate">
                                              <span>{s.kategori}</span>
                                              {s.kamar && <span>• Kamar: {s.kamar}</span>}
                                              {s.kelas_sekolah && <span>• {s.kelas_sekolah}</span>}
                                              {s.nik && <span className="font-mono">• NIK: {s.nik}</span>}
                                            </div>
                                          </div>
                                        </div>

                                        {isSelected ? (
                                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                                            <Check className="w-3 h-3" />
                                          </div>
                                        ) : s.nfc_id ? (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium shrink-0">
                                            Ada Kartu
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="p-4 text-xs text-center text-slate-500 font-medium">
                                    Tidak ada nama santri yang cocok
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Selected Student Confirmation Card */}
                      {selectedStudent && (
                        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs animate-slide-up">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 border border-emerald-200 dark:border-emerald-800 overflow-hidden shadow-xs">
                              {selectedStudent.foto ? (
                                <img src={selectedStudent.foto} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{selectedStudent.jenis_kelamin === "P" ? "🧕" : "👳"}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9.5px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                                  Santri Terpilih
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {selectedStudent.kategori}
                                </span>
                              </div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                                {selectedStudent.nama_lengkap}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                                <span>Kamar: <strong className="text-slate-800 dark:text-slate-200">{selectedStudent.kamar || "Belum diplot"}</strong></span>
                                {selectedStudent.kelas_sekolah && <span>• Kelas: <strong>{selectedStudent.kelas_sekolah}</strong></span>}
                                {selectedStudent.nik && <span>• NIK: <span className="font-mono">{selectedStudent.nik}</span></span>}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudent(null);
                              setSelectedStudentId("");
                              setAssignSearch("");
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 rounded-xl transition-all shrink-0 cursor-pointer"
                          >
                            Ganti Santri
                          </button>
                        </div>
                      )}

                      {/* Guidance note */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex items-start gap-2">
                        <span className="text-blue-500 text-sm">💡</span>
                        <span>
                          Setelah menekan tombol simpan, kode NFC <strong className="font-mono text-slate-800 dark:text-slate-200">{scannedCode}</strong> akan otomatis tersimpan dan aktif untuk presensi maupun perizinan santri.
                        </span>
                      </div>

                      {/* Submit Button */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleAssignCard}
                          disabled={isRegistering || !selectedStudentId}
                          className={`w-full py-3 rounded-2xl text-xs font-bold transition-all shadow-md mt-1 cursor-pointer select-none ${
                            !selectedStudentId
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          {isRegistering ? (
                            <span className="flex items-center justify-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Menyinkronkan ke Database...
                            </span>
                          ) : selectedStudent ? (
                            `Hubungkan & Daftarkan Kartu untuk ${selectedStudent.nama_lengkap}`
                          ) : (
                            "Hubungkan & Daftarkan Kartu ini"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* DATABASE TAB VIEW */
        <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 animate-fade-in" id="nfc-database-tab">
          
          {/* Header & Status Filter Pills & Search Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Pills Matching User Reference Image */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs self-start">
              <button
                type="button"
                onClick={() => setDbStatusFilter("Aktif")}
                className={`px-4 py-1.5 rounded-xl text-xs transition-all cursor-pointer select-none ${
                  dbStatusFilter === "Aktif"
                    ? "bg-[#edf5ff] dark:bg-blue-950/60 text-[#1a73e8] dark:text-blue-400 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
                }`}
              >
                Aktif
              </button>

              <button
                type="button"
                onClick={() => setDbStatusFilter("Mubaligh")}
                className={`px-4 py-1.5 rounded-xl text-xs transition-all cursor-pointer select-none ${
                  dbStatusFilter === "Mubaligh"
                    ? "bg-[#edf5ff] dark:bg-blue-950/60 text-[#1a73e8] dark:text-blue-400 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
                }`}
              >
                Mubaligh
              </button>

              <button
                type="button"
                onClick={() => setDbStatusFilter("Nonaktif")}
                className={`px-4 py-1.5 rounded-xl text-xs transition-all cursor-pointer select-none ${
                  dbStatusFilter === "Nonaktif"
                    ? "bg-[#edf5ff] dark:bg-blue-950/60 text-[#1a73e8] dark:text-blue-400 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
                }`}
              >
                Nonaktif
              </button>
            </div>

            {/* Simple Search */}
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
                placeholder="Cari nama, kamar, or nfc..."
                className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Foto</th>
                  <th className="p-4">Nama Santri</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Kamar</th>
                  <th className="p-4 font-mono">Kode Tag NFC (Serial)</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDbList.length > 0 ? (
                  filteredDbList.map((s) => (
                    <tr 
                      key={s.id} 
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 transition-all font-medium"
                    >
                      {/* Photo Thumbnail */}
                      <td className="p-4">
                        <div className="w-9 h-11 bg-[#c22026] rounded overflow-hidden shadow-sm flex items-center justify-center text-xs">
                          {s.foto ? (
                            <img src={s.foto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">
                              {s.jenis_kelamin === "P" ? "🧕" : "👳"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="p-4">
                        <div className="font-bold text-slate-850 dark:text-white text-xs">{s.nama_lengkap}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Panggilan: {s.nama_panggilan}</div>
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50">
                          {s.kategori}
                        </span>
                      </td>

                      {/* Room */}
                      <td className="p-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.kamar || "Belum Plotting"}
                        </span>
                      </td>

                      {/* NFC Card ID (mono space code) */}
                      <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400 select-all">
                        {s.nfc_id}
                      </td>

                      {/* Unlink Row Action Button */}
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeassignCard(s.id!, s.nama_lengkap)}
                          className="p-2 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 text-slate-400 dark:text-slate-500 rounded-lg transition-all cursor-pointer inline-flex items-center"
                          title="Hapus / Unlink Kartu dari Santri ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 dark:text-slate-400 font-medium">
                      {dbSearch ? "Hasil pencarian tidak ditemukan." : `Belum ada kartu NFC pada kategori ${dbStatusFilter}.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ESP32 NFC Guide & Code Modal */}
      <Esp32NfcGuideModal
        isOpen={showEsp32GuideModal}
        onClose={() => setShowEsp32GuideModal(false)}
        onSimulateTap={(uid) => processScan(uid)}
      />

      {/* NFC UID Format Converter Modal (Hex ⇄ Decimal USB Reader) */}
      <NfcUidConverterModal
        isOpen={showConverterModal}
        onClose={() => setShowConverterModal(false)}
        students={students}
        initialUid={scannedCode || "08:08:A1:B2"}
        onApplyUid={(uid) => processScan(uid)}
      />
    </div>
  );
}
