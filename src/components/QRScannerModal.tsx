import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Camera, 
  MapPin, 
  ShieldCheck, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Upload, 
  Info,
  QrCode,
  CameraOff,
  ExternalLink,
  Lock,
  Compass
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";

const MySwal = withReactContent(Swal);

// Rumus Haversine: Jarak antara 2 titik koordinat bumi (dalam meter)
export function calculateHaversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371e3; // Radius bumi dalam meter
  const toRad = (angle: number) => (angle * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Token statis bawaan sekolah & Koordinat default Al-Muttaqin
export const DEFAULT_STATIC_QR_TOKEN = "ALMUTTAQIN_PRESENSI_STATION_PRIMARY";
export const DEFAULT_SCHOOL_COORDS = {
  latitude: -7.227800, // Koordinat Al-Muttaqin
  longitude: 111.534500,
  radiusMeters: 50 // Toleransi 50 meter sesuai spesifikasi
};

export interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser?: { 
    username: string; 
    role: string; 
    name: string; 
    id?: string; 
    gender?: string; 
  } | null;
  guruId?: string | null;
  guruNama?: string;
  defaultJenis?: "Masuk" | "Pulang";
  schoolCoords?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  expectedQrToken?: string;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  guruId,
  guruNama,
  defaultJenis = "Masuk",
  schoolCoords = DEFAULT_SCHOOL_COORDS,
  expectedQrToken = DEFAULT_STATIC_QR_TOKEN
}: QRScannerModalProps) {
  const [selectedJenis, setSelectedJenis] = useState<"Masuk" | "Pulang">(defaultJenis);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // GPS State
  const [gpsStatus, setGpsStatus] = useState<"searching" | "connected" | "error">("searching");
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number; accuracy: number; distance: number } | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isProcessingScan = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);

  const isIframe = typeof window !== "undefined" && window.self !== window.top;

  // Sync defaultJenis when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedJenis(defaultJenis);
      isProcessingScan.current = false;
    }
  }, [isOpen, defaultJenis]);

  // Pantau GPS secara berkala saat scanner terbuka
  useEffect(() => {
    if (!isOpen) return;

    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsErrorMsg("GPS tidak didukung oleh browser ini.");
      return;
    }

    setGpsStatus("searching");

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const dist = calculateHaversineDistance(
          userLat,
          userLng,
          schoolCoords.latitude,
          schoolCoords.longitude
        );

        setCurrentGps({
          lat: userLat,
          lng: userLng,
          accuracy: pos.coords.accuracy,
          distance: dist
        });
        setGpsStatus("connected");
        setGpsErrorMsg(null);
      },
      (err) => {
        console.warn("GPS watch notice:", err.message);
        setGpsStatus("error");
        setGpsErrorMsg(err.message || "Izin lokasi tidak diberikan.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen, schoolCoords]);

  // Fungsi untuk menyalakan kamera secara aman
  const startCamera = async () => {
    if (!isMountedRef.current) return;
    setIsStartingCamera(true);
    setCameraError(null);
    setIsPermissionDenied(false);

    try {
      const scannerElementId = "qr-reader-viewfinder";
      const domElem = document.getElementById(scannerElementId);
      if (!domElem) {
        setIsStartingCamera(false);
        return;
      }

      // Bersihkan scanner jika sedang aktif
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (_) {}
      }

      const qrCodeInstance = new Html5Qrcode(scannerElementId);
      scannerRef.current = qrCodeInstance;

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0
      };

      // Cek apakah ada kamera terdeteksi
      let cameraIdOrConfig: any = { facingMode: "environment" };
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCam = cameras.find((c) => 
            /back|rear|belakang|environment/i.test(c.label)
          );
          cameraIdOrConfig = backCam ? backCam.id : cameras[0].id;
        }
      } catch (camListErr) {
        console.warn("Info pendeteksian daftar kamera:", camListErr);
      }

      await qrCodeInstance.start(
        cameraIdOrConfig,
        config,
        (decodedText) => {
          if (isMountedRef.current && !isProcessingScan.current) {
            handleQrCodeDetected(decodedText);
          }
        },
        () => {
          // Frame tanpa QR - diabaikan
        }
      );

      if (isMountedRef.current) {
        setIsCameraActive(true);
        setCameraError(null);
        setIsPermissionDenied(false);
      }
    } catch (err: any) {
      console.warn("Catatan inisialisasi kamera:", err?.name || err?.message || err);
      if (isMountedRef.current) {
        setIsCameraActive(false);
        const errName = err?.name || "";
        const errMsg = String(err?.message || err || "");

        if (
          errName === "NotAllowedError" ||
          errName === "PermissionDeniedError" ||
          errMsg.includes("NotAllowedError") ||
          errMsg.includes("Permission denied") ||
          errMsg.includes("Permission dismissed")
        ) {
          setIsPermissionDenied(true);
          setCameraError("Izin kamera ditolak atau belum diizinkan oleh browser.");
        } else if (errName === "NotFoundError" || errMsg.includes("DevicesNotFoundError")) {
          setCameraError("Tidak ditemukan kamera pada perangkat ini.");
        } else {
          setCameraError(errMsg || "Kamera tidak dapat diakses.");
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsStartingCamera(false);
      }
    }
  };

  // Permintaan izin ulang kamera dengan user gesture
  const handleRequestCameraPermission = async () => {
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        testStream.getTracks().forEach((track) => track.stop());
      }
    } catch (err: any) {
      console.warn("Hasil user gesture izin kamera:", err?.message || err);
    }
    await startCamera();
  };

  // Inisialisasi Kamera dengan Html5Qrcode saat modal terbuka
  useEffect(() => {
    if (!isOpen) {
      isMountedRef.current = false;
      cleanupScanner();
      return;
    }

    isMountedRef.current = true;

    // Jeda singkat memastikan elemen DOM telah ter-mount
    const initTimer = setTimeout(() => {
      startCamera();
    }, 350);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimer);
      cleanupScanner();
    };
  }, [isOpen]);

  // Hentikan scanner saat unmount / close
  const cleanupScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.warn("Scanner cleanup notice:", e);
      } finally {
        scannerRef.current = null;
        setIsCameraActive(false);
      }
    }
  };

  // Logika 5 Langkah Verifikasi Presensi (Scan + GPS)
  const handleQrCodeDetected = async (qrString: string) => {
    if (isProcessingScan.current) return;
    isProcessingScan.current = true;
    setIsVerifying(true);

    // Langkah 1: Validasi string isi QR
    const normalizedQr = qrString.trim();
    if (normalizedQr !== expectedQrToken) {
      setIsVerifying(false);
      await MySwal.fire({
        icon: "error",
        title: "QR Code Tidak Valid!",
        text: `QR Code yang dipindai tidak sesuai dengan token stasiun presensi sekolah.`,
        confirmButtonColor: "#2563eb",
        confirmButtonText: "Pindai Ulang"
      });
      isProcessingScan.current = false;
      return;
    }

    // Langkah 2: Ambil koordinat GPS HP secara akurat
    if (!navigator.geolocation) {
      setIsVerifying(false);
      await MySwal.fire({
        icon: "error",
        title: "GPS Tidak Tersedia",
        text: "Browser Anda tidak mendukung deteksi koordinat GPS.",
        confirmButtonColor: "#2563eb"
      });
      isProcessingScan.current = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Langkah 3: Hitung jarak GPS HP terhadap titik pusat sekolah (Haversine)
        const distanceMeters = calculateHaversineDistance(
          userLat,
          userLng,
          schoolCoords.latitude,
          schoolCoords.longitude
        );

        // Langkah 4 & 5: Evaluasi Radius 50m
        if (distanceMeters <= schoolCoords.radiusMeters) {
          // Langkah 4: Jarak <= 50 meter -> Simpan record presensi ke Supabase
          try {
            await executeSavePresensi(userLat, userLng, distanceMeters);
            
            await MySwal.fire({
              icon: "success",
              title: `Presensi ${selectedJenis} Berhasil!`,
              html: `
                <div class="text-left text-sm space-y-1.5 p-2 bg-slate-50 rounded-lg text-slate-700">
                  <p><strong>Nama:</strong> ${guruNama || currentUser?.name || "-"}</p>
                  <p><strong>Jenis:</strong> Presensi ${selectedJenis}</p>
                  <p><strong>Status GPS:</strong> Terverifikasi (Jarak: ${Math.round(distanceMeters)} m)</p>
                  <p><strong>Waktu:</strong> ${new Date().toLocaleTimeString("id-ID")} WIB</p>
                </div>
              `,
              confirmButtonColor: "#2563eb",
              confirmButtonText: "Selesai"
            });

            onSuccess();
            onClose();
          } catch (dbErr: any) {
            console.error("Gagal simpan presensi:", dbErr);
            await MySwal.fire({
              icon: "error",
              title: "Gagal Menyimpan Presensi",
              text: dbErr.message || "Terjadi kesalahan koneksi database.",
              confirmButtonColor: "#2563eb"
            });
            isProcessingScan.current = false;
          } finally {
            setIsVerifying(false);
          }
        } else {
          // Langkah 5: Jarak > 50 meter -> Batalkan presensi & tampilkan Alert
          setIsVerifying(false);
          await MySwal.fire({
            icon: "error",
            title: "Gagal Presensi!",
            html: `
              <p class="text-slate-700 mb-2">
                Posisi Anda terdeteksi <strong>${Math.round(distanceMeters)} meter</strong> di luar area sekolah.
              </p>
              <p class="text-xs text-slate-500">
                Batas radius maksimal yang diizinkan untuk presensi adalah <strong>${schoolCoords.radiusMeters} meter</strong> dari titik pusat sekolah.
              </p>
            `,
            confirmButtonColor: "#2563eb",
            confirmButtonText: "Mengerti"
          });
          isProcessingScan.current = false;
        }
      },
      async (geoErr) => {
        setIsVerifying(false);
        await MySwal.fire({
          icon: "error",
          title: "Gagal Mendapatkan Koordinat GPS",
          text: `Pastikan GPS aktif dan izin lokasi diizinkan di peramban Anda. (${geoErr.message})`,
          confirmButtonColor: "#2563eb"
        });
        isProcessingScan.current = false;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Simpan record ke Supabase
  const executeSavePresensi = async (lat: number, lng: number, dist: number) => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const timeFormatted = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} WIB`;
    const latLongStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    const effectiveUsername = currentUser?.username || "guru";
    const effectiveNama = guruNama || currentUser?.name || "Guru Al-Muttaqin";

    // 1. Simpan ke tabel absensi_guru
    const payload: any = {
      guru_id: guruId || null,
      username: effectiveUsername,
      nama_guru: effectiveNama,
      tanggal: todayStr,
      waktu_absen: now.toISOString(),
      waktu_presensi: now.toISOString(),
      jenis: selectedJenis.toLowerCase(),
      latitude: lat,
      longitude: lng,
      lat_long: latLongStr,
      jarak_meter: Math.round(dist),
      status_lokasi: "Dalam Radius",
      status: "Hadir",
      keterangan: `Presensi ${selectedJenis} via QR + Geofencing`
    };

    if (selectedJenis === "Masuk") {
      payload.jam_masuk = timeFormatted;
    } else {
      payload.jam_pulang = timeFormatted;
    }

    // Cari apakah sudah ada data hari ini untuk di-update (jika jenis Pulang)
    const { data: existingData } = await supabase
      .from("absensi_guru")
      .select("id, jam_masuk")
      .eq("username", effectiveUsername)
      .eq("tanggal", todayStr)
      .maybeSingle();

    if (existingData && selectedJenis === "Pulang") {
      await supabase
        .from("absensi_guru")
        .update({
          jam_pulang: timeFormatted,
          lat_long: latLongStr,
          latitude: lat,
          longitude: lng,
          jarak_meter: Math.round(dist),
          keterangan: "Hadir Lengkap"
        })
        .eq("id", existingData.id);
    } else {
      await supabase.from("absensi_guru").upsert(payload, { onConflict: "username,tanggal" });
    }

    // Update penyimpanan cadangan di localStorage
    const localKey = `absensi_guru_${effectiveUsername}_${todayStr}`;
    const existingLocal = localStorage.getItem(localKey);
    const merged = existingLocal ? { ...JSON.parse(existingLocal), ...payload } : payload;
    localStorage.setItem(localKey, JSON.stringify(merged));

    // Opsional simpan juga ke presensi_guru jika tabelnya tersedia
    try {
      await supabase.from("presensi_guru").insert([{
        tanggal: todayStr,
        guru_id: guruId ? Number(guruId) : null,
        nama_guru: effectiveNama,
        status_kehadiran: "Hadir",
        materi: `Presensi ${selectedJenis} (QR+GPS)`
      }]);
    } catch (_) {
      // Abaikan jika tabel presensi_guru menggunakan skema berbeda
    }
  };

  // Fallback: Scan gambar QR via file upload (berguna jika kamera iframe bermasalah)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsVerifying(true);
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode("qr-reader-viewfinder");
        scannerRef.current = scanner;
      }
      const decodedText = await scanner.scanFile(file, true);
      handleQrCodeDetected(decodedText);
    } catch (err: any) {
      setIsVerifying(false);
      MySwal.fire({
        icon: "error",
        title: "Gagal Membaca File Gambar",
        text: "Tidak ditemukan pola QR Code yang valid pada gambar tersebut. Pastikan gambar jelas dan tidak terpotong.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      // Reset input value agar dapat memilih file yang sama lagi
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Quick Action: Presensi langsung menggunakan GPS Geofencing (50m) dengan token stasiun sekolah
  const handleDirectGpsAttendance = () => {
    handleQrCodeDetected(expectedQrToken);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      {/* 3. COMPONENT STYLING (MINIMALIST CLEAN UI - bg-white, rounded-2xl) */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Scan QR Presensi Guru
              </h3>
              <p className="text-[11px] text-slate-400">
                Verifikasi QR Statis & GPS Geofencing (50m)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pilihan Jenis Presensi (Masuk / Pulang) */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedJenis("Masuk")}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedJenis === "Masuk"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Presensi Masuk
            </button>
            <button
              type="button"
              onClick={() => setSelectedJenis("Pulang")}
              className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedJenis === "Pulang"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Presensi Pulang
            </button>
          </div>
        </div>

        {/* Area Viewfinder Kamera berbentuk persegi dengan garis sudut penanda fokus */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-[270px] sm:w-[290px] h-[270px] sm:h-[290px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center shadow-inner">
            
            {/* HTML5 QR Container */}
            <div 
              id="qr-reader-viewfinder" 
              className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
            />

            {/* Garis Sudut Penanda Fokus (Square Viewfinder with 4 Corner Brackets) */}
            <div className="absolute inset-5 pointer-events-none z-20 flex flex-col justify-between">
              <div className="flex justify-between">
                {/* Top-Left Corner */}
                <div className="w-7 h-7 border-t-[3.5px] border-l-[3.5px] border-blue-500 rounded-tl-md" />
                {/* Top-Right Corner */}
                <div className="w-7 h-7 border-t-[3.5px] border-r-[3.5px] border-blue-500 rounded-tr-md" />
              </div>
              <div className="flex justify-between">
                {/* Bottom-Left Corner */}
                <div className="w-7 h-7 border-b-[3.5px] border-l-[3.5px] border-blue-500 rounded-bl-md" />
                {/* Bottom-Right Corner */}
                <div className="w-7 h-7 border-b-[3.5px] border-r-[3.5px] border-blue-500 rounded-tr-md" />
              </div>
            </div>

            {/* Laser Line Scanning Indicator */}
            {isCameraActive && !isVerifying && !cameraError && (
              <div className="absolute left-6 right-6 h-0.5 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.9)] z-20 animate-pulse pointer-events-none" />
            )}

            {/* Loading State saat kamera sedang dihidupkan */}
            {isStartingCamera && !cameraError && (
              <div className="absolute inset-0 z-25 bg-slate-950/85 backdrop-blur-2xs flex flex-col items-center justify-center text-white p-4 text-center">
                <RefreshCw className="w-7 h-7 animate-spin text-blue-400 mb-2" />
                <p className="text-xs font-semibold">Menghubungkan Kamera...</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Menyiapkan pemindai QR Code
                </p>
              </div>
            )}

            {/* Overlay saat verifikasi sedang berjalan */}
            {isVerifying && (
              <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-2xs flex flex-col items-center justify-center text-white p-4 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-2" />
                <p className="text-xs font-bold">Memverifikasi Presensi...</p>
                <p className="text-[10px] text-slate-300 mt-1">
                  Mengecek keabsahan token QR dan radius GPS 50m.
                </p>
              </div>
            )}

            {/* Fallback Jika Kamera Belum Aktif / Izin Ditolak */}
            {cameraError && !isVerifying && (
              <div className="absolute inset-0 z-20 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center text-slate-300">
                {isPermissionDenied ? (
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                    <CameraOff className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-2">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                
                <p className="text-xs font-bold text-white">
                  {isPermissionDenied ? "Izin Kamera Dibutuhkan" : "Kamera Tidak Tersedia"}
                </p>
                <p className="text-[10.5px] text-slate-300 mt-1 max-w-[230px] leading-relaxed">
                  {isPermissionDenied 
                    ? "Peramban belum mengizinkan kamera. Klik tombol di bawah untuk meminta izin atau gunakan opsi verifikasi alternatif:" 
                    : cameraError}
                </p>

                <div className="mt-3 flex flex-col gap-1.5 w-full max-w-[210px]">
                  {/* Tombol Minta Izin Ulang Kamera */}
                  <button
                    type="button"
                    onClick={handleRequestCameraPermission}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{isPermissionDenied ? "Minta Izin Kamera" : "Coba Nyalakan Lagi"}</span>
                  </button>

                  {/* Tombol Buka Tab Baru jika di iframe */}
                  {isIframe && (
                    <button
                      type="button"
                      onClick={() => window.open(window.location.href, "_blank")}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-medium transition-colors cursor-pointer border border-slate-700"
                    >
                      <ExternalLink className="w-3 h-3 text-blue-400" />
                      <span>Buka di Tab Penuh</span>
                    </button>
                  )}

                  {/* Tombol Upload Gambar QR */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-medium transition-colors cursor-pointer border border-slate-700"
                  >
                    <Upload className="w-3 h-3 text-emerald-400" />
                    <span>Upload Foto QR</span>
                  </button>

                  {/* Tombol Verifikasi Lokasi GPS Langsung */}
                  <button
                    type="button"
                    onClick={handleDirectGpsAttendance}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-semibold transition-colors cursor-pointer shadow-xs"
                    title="Verifikasi presensi berdasarkan titik GPS 50m dari sekolah"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Presensi Lokasi GPS (50m)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Indikator Status GPS di bawah kamera dengan animasi pulsing green dot */}
          <div className="w-full mt-4 flex flex-col items-center">
            {gpsStatus === "searching" && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span>GPS Terhubung: Mencari Titik Lokasi...</span>
              </div>
            )}

            {gpsStatus === "connected" && currentGps && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  GPS Terkunci: Jarak ±{Math.round(currentGps.distance)}m dari titik sekolah
                </span>
              </div>
            )}

            {gpsStatus === "error" && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-medium text-rose-600">
                <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                <span>GPS Error: {gpsErrorMsg || "Izin lokasi diperlukan"}</span>
              </div>
            )}

            <p className="text-[11px] text-slate-400 text-center mt-2">
              Arahkan kamera ke QR Code stasiun sekolah atau gunakan verifikasi GPS.
            </p>
          </div>
        </div>

        {/* Input File Tersembunyi untuk fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Baris Tombol Aksi Tambahan (Pengujian & Info) */}
        <div className="px-5 pb-2 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Foto QR</span>
          </button>

          <button
            type="button"
            onClick={handleDirectGpsAttendance}
            title="Klik untuk verifikasi presensi dengan GPS radius 50m"
            className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Presensi GPS (50m)</span>
          </button>
        </div>

        {/* Footer: Tombol "Tutup Scanner" yang jelas di bagian bawah */}
        <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          >
            Tutup Scanner
          </button>
        </div>

      </div>
    </div>
  );
}
