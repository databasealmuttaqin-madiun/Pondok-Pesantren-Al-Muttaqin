import React, { useState, useEffect, useRef } from "react";
import { SantriData } from "../supabaseClient";
import { Fingerprint, Search, User, Home, HelpCircle, Check, AlertTriangle, Trash2, Shield, RefreshCw } from "lucide-react";

/**
 * Normalizes an NFC token or UID (serial number) to prevent mismatch due to colons, spaces, or casing
 */
export function normalizeNfcId(id: string): string {
  if (!id) return "";
  return id.replace(/:/g, "").replace(/\s/g, "").trim().toUpperCase();
}

/**
 * Resolves scanned code, checks if it is a Google Form URL or has a student name populated
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
      // e.g., entry.2107021361=SALMAN+FAJRIN+ASABEKT or &entry.2107021361=SALMAN FAJRIN ASABEKT
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
                // Keep extractedName for reference even if not found in db
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

  // Exact matching against nfc_id or nik with normalization
  const cleanCodeNormalized = normalizeNfcId(cleanCode);
  let matchedStudent = students.find((s) => {
    const studentNfcNormalized = normalizeNfcId(s.nfc_id || "");
    const studentNikNormalized = s.nik ? s.nik.trim().toUpperCase() : "";
    return (
      (studentNfcNormalized !== "" && studentNfcNormalized === cleanCodeNormalized) ||
      (studentNikNormalized !== "" && studentNikNormalized === cleanCode.toUpperCase())
    );
  });

  // FALLBACK: If not matched by card ID / NIK, match directly against student name or nickname (e.g., from custom text QR Code)
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
}

export default function NfcRegisterPanel({
  students,
  rooms,
  onUpdateNfc,
  isDarkMode
}: NfcRegisterPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"scan" | "database">("scan");
  
  // Real-time input buffer for physical NFC scanning emulated by USB Readers
  const [scannedCode, setScannedCode] = useState<string>("");
  const [keyBuffer, setKeyBuffer] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(true);

  // Assignment states for unregistered cards
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [assignSearch, setAssignSearch] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Search filter for Registered Database Tab
  const [dbSearch, setDbSearch] = useState<string>("");

  // Web NFC Support checks
  const isNfcSupported = typeof window !== "undefined" && "NDEFReader" in window;
  const [isNfcActive, setIsNfcActive] = useState<boolean>(false);
  const [webNfcError, setWebNfcError] = useState<string | null>(null);

  // Simulated Cards helper list (allows web previewers to simulate cards easily)
  const [simulationCode, setSimulationCode] = useState<string>("");

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
    } else {
      setSelectedRoom(res.matchedStudent.kamar || "");
      setSelectedStudentId(String(res.matchedStudent.id));
    }
  };

  // Trigger registration to database
  const handleAssignCard = async () => {
    if (!scannedCode) return;
    if (!selectedStudentId) {
      alert("Harap pilih nama santri terlebih dahulu.");
      return;
    }

    setIsRegistering(true);
    const studentId = parseInt(selectedStudentId, 10);
    const success = await onUpdateNfc(studentId, scannedCode);
    
    setIsRegistering(false);
    if (success) {
      // Clear form after successful registration
      setSelectedRoom("");
      setSelectedStudentId("");
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
    const matchRoom = selectedRoom ? (s.kamar || "").trim() === selectedRoom.trim() : true;
    const matchSearch = assignSearch ? (s.nama_lengkap || "").toLowerCase().includes(assignSearch.toLowerCase()) || (s.kamar || "").toLowerCase().includes(assignSearch.toLowerCase()) : true;
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

  // Filter registered NFC cards for Database View
  const filteredDbList = studentsWithNfc.filter((s) => {
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
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in relative overflow-hidden" id="nfc_main_header">
        <div className="flex items-center gap-4">
          <div className="w-[54px] h-[54px] rounded-2xl bg-indigo-50 dark:bg-slate-900 flex items-center justify-center text-indigo-505 dark:text-indigo-400 shrink-0">
            <Fingerprint className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-1.5 leading-none">
              Registrasi & Manajemen Kartu NFC
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
              Sistem pendaftaran kartu RFID / NFC dengan keyboard hardware emulator pembaca kartu.
            </p>
          </div>
        </div>

        {/* Tab Switcher inside Header */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-1 border border-slate-200/50 dark:border-slate-800 rounded-2xl h-fit flex items-center shrink-0">
          <button
            onClick={() => setActiveSubTab("scan")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 select-none cursor-pointer ${
              activeSubTab === "scan"
                ? "bg-indigo-600 text-white shadow-sm scale-[1.01]"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Pindai & Daftar
          </button>
          <button
            onClick={() => setActiveSubTab("database")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 select-none cursor-pointer ${
              activeSubTab === "database"
                ? "bg-indigo-600 text-white shadow-sm scale-[1.01]"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Database Kartu ({studentsWithNfc.length})
          </button>
        </div>
      </div>

      {activeSubTab === "scan" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="nfc-scan-tab">
          {/* Card Reader Status / Emulation: Left Column (5 columns) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
              <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 pb-3 flex items-center justify-between">
                <span>STATUS PEMBACA KARTU</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold flex items-center gap-1 border ${
                  isListening 
                    ? "bg-emerald-50 text-[#10b981] border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" 
                    : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:border-amber-805"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isListening ? "bg-[#10b981] animate-ping" : "bg-amber-500"}`}></span>
                  {isListening ? "RFID PEMBACA AKTIF" : "PAUSED"}
                </span>
              </h3>

              {/* Physical Scanning Area Ripple Visual */}
              <div 
                className={`relative h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center overflow-hidden transition-all duration-300 ${
                  isListening || isNfcActive
                    ? "bg-indigo-50/20 border-indigo-200 dark:bg-slate-900/10 dark:border-indigo-800/50 hover:bg-indigo-50/40"
                    : "bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-850"
                }`}
              >
                {/* Simulated Radar Wave / Ripple */}
                {(isListening || isNfcActive) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-36 h-36 border border-indigo-400/25 rounded-full animate-ping absolute"></span>
                    <span className="w-24 h-24 border border-indigo-400/15 rounded-full animate-ping delay-500 absolute"></span>
                  </div>
                )}

                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-inner relative z-10 mb-3 transition-colors duration-300 ${
                  isListening || isNfcActive ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-400" : "bg-slate-200 text-slate-400"
                }`}>
                  <Fingerprint className="w-7 h-7" />
                </div>

                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 relative z-10 break-all px-2">
                  {scannedCode ? `NFC TERDETEKSI: ${scannedCode}` : "Tempelkan Kartu RFID/NFC ke Reader"}
                </p>
                <p className="text-[9.5px] text-slate-550 dark:text-slate-400 mt-1 max-w-[240px] leading-relaxed relative z-10">
                  {isNfcActive 
                    ? "NFC HP Aktif: Tempelkan kartu di belakang body HP Anda." 
                    : isListening 
                    ? "Siap membaca ketikan USB Reader (Fokus bebas). Jangan klik kolom input saat nempelkannya." 
                    : "Sensor scanner paused."}
                </p>
              </div>

              {/* WebNFC mobile sensor controls */}
              {isNfcSupported ? (
                <div className="bg-indigo-50/40 dark:bg-slate-900/40 border border-indigo-100/40 dark:border-indigo-950 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[10.5px] font-black uppercase text-indigo-850 dark:text-indigo-400 tracking-wider">
                        Sensor NFC HP Internal
                      </h4>
                      <p className="text-[9.5px] text-indigo-600/70 dark:text-slate-450">
                        Pindai serial ID langsung menggunakan sensor belakang HP Anda.
                      </p>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${isNfcActive ? "bg-emerald-500 animate-pulse" : "bg-slate-405"}`}></span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsNfcActive(!isNfcActive);
                      if (!isNfcActive) {
                        setIsListening(false); // disable keyboard listener while phone sensor is on to avoid layout double-intercept
                      }
                    }}
                    className={`w-full py-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                      isNfcActive
                        ? "bg-rose-500 hover:bg-rose-600 text-white shadow-sm"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                    }`}
                  >
                    {isNfcActive ? "🔴 Matikan Sensor NFC HP" : "🟢 Aktifkan Sensor NFC HP"}
                  </button>

                  {webNfcError && (
                    <p className="text-[10px] text-rose-500 font-semibold leading-normal bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1.5 rounded-lg border border-rose-100 dark:border-rose-900">
                      {webNfcError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-[#f8fafc] dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-850">
                  <h4 className="text-[10.5px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    Sensor NFC HP Internal
                  </h4>
                  <p className="text-[9.5px] text-slate-500/80 leading-relaxed mt-1">
                    Gunakan **Google Chrome di HP Android** untuk scan serial nomor langsung lewat body handphone.
                  </p>
                </div>
              )}

              {/* USB physical hardware Reader controls */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/85 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-400">USB Reader (Keyboard Emulator)</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${isListening ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsListening(!isListening);
                      if (!isListening) {
                        setIsNfcActive(false); // shut down mobile sensor if enabling keyboard listener
                      }
                    }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all duration-150 select-none cursor-pointer ${
                      isListening
                        ? "bg-white dark:bg-[#111c44] hover:bg-slate-50 border-slate-250 dark:border-slate-800 text-slate-650 dark:text-slate-400"
                        : "bg-slate-700 hover:bg-slate-800 border-slate-700 text-white shadow-sm"
                    }`}
                  >
                    {isListening ? "Pause USB Listener" : "Aktifkan USB Listener"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScannedCode("");
                      setKeyBuffer("");
                      setWebNfcError(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-slate-250 dark:border-slate-800 bg-white dark:bg-[#111c44] text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-all cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Test Simulation Section */}
            <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-wider flex items-center gap-1 border-b border-slate-50 dark:border-slate-800/80 pb-2">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                <span>Alat Simulasi Pasang Kartu</span>
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Gunakan panel simulasi ini jika Anda tidak memiliki hardware card reader fisik untuk menguji. Silakan ketik atau pilih kode contoh:
              </p>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simulationCode}
                    onChange={(e) => setSimulationCode(e.target.value)}
                    placeholder="Contoh: 12345678"
                    className="flex-1 text-[11px] px-3 py-2 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (simulationCode.trim()) {
                        processScan(simulationCode);
                      } else {
                        const randomCode = Math.floor(100000000 + Math.random() * 900000000).toString();
                        setSimulationCode(randomCode);
                        processScan(randomCode);
                      }
                    }}
                    className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900 text-[10.5px] font-bold rounded-xl hover:bg-indigo-100 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Simulasikan Tap
                  </button>
                </div>

                {/* Predefined mock card IDs quick selections */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["882940212", "501928372", "948102391"].map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        setSimulationCode(code);
                        processScan(code);
                      }}
                      className="px-2 py-1 bg-slate-55 dark:bg-slate-900 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-405 text-[9px] font-bold rounded border border-slate-200/40 dark:border-slate-800 transition-all"
                    >
                      Code: {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Registration Details & Form Panel: Right Column (7 columns) */}
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm min-h-[400px] flex flex-col justify-between">
              
              {!scannedCode ? (
                /* Static State: No Scans Yet */
                <div className="my-auto text-center py-12 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 mx-auto">
                    <Fingerprint className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-350">Belum Ada Kartu NFC Terbaca</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Tempelkan kartu RFID / NFC pada reader Anda atau simulasikan ketukan kartu di sebelah kiri. Sistem akan langsung mencocokkan kode kartu dengan database kesiswaan secara real-time.
                  </p>
                </div>
              ) : (
                /* Active State: Card is scanned, perform logic checks */
                <div className="space-y-6">
                  {/* Card Serial Tag Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-3 border border-indigo-100/50 dark:border-indigo-900 rounded-2xl select-all font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                      <span className="text-[10px] uppercase font-black tracking-wider text-indigo-755 dark:text-indigo-400">SERIAL ID KARTU TERDETEKSI:</span>
                    </div>
                    <span className="text-xs font-black text-indigo-900 dark:text-indigo-300 break-all" title={scannedCode}>
                      {scannedCode.length > 40 ? scannedCode.substring(0, 20) + "..." + scannedCode.substring(scannedCode.length - 20) : scannedCode}
                    </span>
                  </div>

                  {parsedResult?.isUrl && (
                    <div className="bg-blue-50/60 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900 rounded-2xl p-4 flex gap-3 text-left">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-extrabold text-sm shadow-sm">i</div>
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-black uppercase text-blue-800 dark:text-blue-400 tracking-wider">FORMAT PRE-FILL GOOGLE FORM TERDETEKSI</h4>
                        <p className="text-[10.5px] text-blue-650 dark:text-blue-400 leading-relaxed font-semibold">
                          Pembaca NFC Anda memindai data tertulis di kartu berupa Link Google Form. 
                          {parsedResult.extractedName ? (
                            <> Sistem mendeteksi nama santri <strong className="text-blue-900 dark:text-blue-200">"{parsedResult.extractedName}"</strong> di dalam parameter link tersebut dan otomatis mencocokkannya!</>
                          ) : (
                            <> Kami akan menyimpan URL unik ini sebagai identitas kartu NFC santri.</>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {matchedStudent ? (
                    /* CASE A: Card is already registered to a student */
                    <div className="space-y-6">
                      <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white shrink-0 shadow">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">KARTU TERDAFTAR (OK)</h4>
                          <p className="text-[10.5px] text-emerald-650 dark:text-emerald-500 leading-normal mt-0.5">
                            Serial kartu NFC ini sudah terdaftar valid milik salah satu siswa atau siswi kami.
                          </p>
                        </div>
                      </div>

                      {/* Display beautiful Profile card of registered student */}
                      <div className="bg-[#f8fafc] dark:bg-slate-900 p-5 rounded-[1.5rem] border border-slate-205 dark:border-slate-800/80 flex flex-col sm:flex-row gap-5 items-center sm:items-start relative overflow-hidden">
                        
                        {/* Student Photo */}
                        <div className="w-24 h-32 bg-[#c22026] rounded border border-slate-350 dark:border-slate-850 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
                          {matchedStudent.foto ? (
                            <img src={matchedStudent.foto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-4xl">
                              {matchedStudent.jenis_kelamin === "P" ? "🧕" : "👳"}
                            </span>
                          )}
                        </div>

                        {/* Student Credentials details */}
                        <div className="flex-1 space-y-3.5 text-center sm:text-left">
                          <div>
                            <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-405 border border-indigo-100 dark:border-indigo-900">
                              {matchedStudent.kategori}
                            </span>
                            <h3 className="text-base font-black text-slate-800 dark:text-white mt-2 leading-tight">
                              {matchedStudent.nama_lengkap}
                            </h3>
                          </div>

                          <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                              <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Kamar: <strong className="text-slate-850 dark:text-slate-300">{matchedStudent.kamar || "Belum diplot"}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Jenkel: <strong className="text-slate-850 dark:text-slate-300">{matchedStudent.jenis_kelamin === "P" ? "Perempuan" : "Laki-laki"}</strong></span>
                            </div>
                            <div className="col-span-2 text-center sm:text-left font-mono text-[10px] text-slate-400">
                              NIK: {matchedStudent.nik || "-"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Deassign action */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeassignCard(matchedStudent.id!, matchedStudent.nama_lengkap)}
                          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus Sambungan Kartu
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* CASE B: Card is unregistered. Offer option to register */
                    <div className="space-y-5 animate-slide-up">
                      <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow">
                          <AlertTriangle className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400">KARTU BELUM TERDAFTAR (BARU)</h4>
                          <p className="text-[10.5px] text-amber-650 dark:text-amber-500 leading-normal mt-0.5">
                            Serial kartu NFC ini masih kosong. Silakan pasangkan kartu ke salah satu siswa di bawah ini.
                          </p>
                        </div>
                      </div>

                      {/* Room and Student Selectors Registration Form */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                          ALOKASIKAN KARTU KE SANTRI
                        </h4>

                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Step 1: Select Room (kamar) */}
                            <div className="space-y-1">
                              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                                1. Pilih Kamar / Rayon
                              </label>
                              <select
                                value={selectedRoom}
                                onChange={(e) => {
                                  setSelectedRoom(e.target.value);
                                  setSelectedStudentId(""); // reset selected student when room changes
                                }}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 dark:text-white transition-all shadow-inner"
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
                            <div className="space-y-1 relative">
                              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                                2. Cari & Pilih Santri
                              </label>
                              <div className="relative w-full">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                                  <Search className="w-3.5 h-3.5" />
                                </span>
                                <input
                                  type="text"
                                  placeholder="Ketik nama santri..."
                                  value={assignSearch}
                                  onChange={(e) => {
                                    setAssignSearch(e.target.value);
                                    setIsDropdownOpen(true);
                                    setSelectedStudentId("");
                                  }}
                                  onFocus={() => setIsDropdownOpen(true)}
                                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                  className="w-full text-xs font-medium pl-9 pr-3 py-2.5 bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 text-slate-800 dark:text-white transition-all shadow-inner"
                                  required={!selectedStudentId}
                                />
                                
                                {isDropdownOpen && (
                                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-auto flex flex-col">
                                    {filteredStudentsForAssign.length > 0 ? (
                                      filteredStudentsForAssign.map((s) => {
                                        const isSelected = selectedStudentId === String(s.id);
                                        return (
                                          <div
                                            key={s.id}
                                            onClick={() => {
                                              setSelectedStudentId(String(s.id));
                                              setAssignSearch(`${s.nama_lengkap} ${s.kamar ? `(Kamar: ${s.kamar})` : ""}`);
                                              setIsDropdownOpen(false);
                                            }}
                                            className={`p-2.5 text-xs font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 last:border-0 ${isSelected ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"}`}
                                          >
                                            {s.nama_lengkap} <span className="text-slate-400 dark:text-slate-500 font-medium ml-1">{s.kamar ? `(Kamar: ${s.kamar})` : ""}</span>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="p-3 text-xs text-center text-slate-500 font-medium">Tidak ada nama santri yang cocok</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Extra Guidance */}
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 p-3 rounded-xl flex items-start gap-2">
                          <span className="text-amber-500 text-xs">💡</span>
                          <span>
                            Setelah memilih santri dan menekan tombol simpan, kode NFC <strong className="font-mono">{scannedCode}</strong> akan otomatis dikunci ke santri tersebut. Anda bisa memakai kartu ini langsung untuk pencatatan absensi harian dan sholat.
                          </span>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={handleAssignCard}
                            disabled={isRegistering || !selectedStudentId}
                            className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md mt-1 cursor-pointer select-none ${
                              !selectedStudentId
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-650 cursor-not-allowed border border-slate-200/20"
                                : "bg-indigo-600 hover:bg-slate-850 text-white hover:bg-indigo-700"
                            }`}
                          >
                            {isRegistering ? (
                              <span className="flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Menyinkronkan ke Database...
                              </span>
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
        </div>
      ) : (
        /* DATABASE TAB VIEW */
        <div className="bg-white dark:bg-[#111c44] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 animate-fade-in" id="nfc-database-tab">
          
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <h3 className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider self-start sm:self-center">
              Daftar Kepemilikan Kartu RFID / NFC ({studentsWithNfc.length})
            </h3>

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
                className="w-full text-xs pl-9 pr-4 py-2 bg-[#f8fafc] dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-505 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-850">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f8fafc] dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-850 text-slate-550 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Foto</th>
                  <th className="p-4">Nama Santri</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Kamar</th>
                  <th className="p-4 font-mono">Kode Tag NFC (Serial)</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {filteredDbList.length > 0 ? (
                  filteredDbList.map((s) => (
                    <tr 
                      key={s.id} 
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-350 transition-all font-semibold"
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
                        <div className="font-extrabold text-slate-850 dark:text-white text-xs">{s.nama_lengkap}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Panggilan: {s.nama_panggilan}</div>
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-slate-200/25">
                          {s.kategori}
                        </span>
                      </td>

                      {/* Room */}
                      <td className="p-4">
                        <span className="font-extrabold text-slate-800 dark:text-slate-300">
                          {s.kamar || "Belum Plotting"}
                        </span>
                      </td>

                      {/* NFC Card ID (mono space code) */}
                      <td className="p-4 font-mono font-bold text-indigo-650 dark:text-indigo-405 select-all">
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
                      {dbSearch ? "Hasil pencarian tidak ditemukan." : "Belum ada kartu NFC yang didaftarkan ke Database."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
