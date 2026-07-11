import React, { useState, useEffect } from "react";
import { MapPin, CheckCircle, XCircle, AlertTriangle, Crosshair, Save, Settings } from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";

const MySwal = withReactContent(Swal);

// --- KONFIGURASI LOKASI SEKOLAH ---
// Silakan sesuaikan latitude dan longitude dengan lokasi sekolah yang sebenarnya.
const DEFAULT_SCHOOL_LOCATION = {
  latitude: -6.200000, 
  longitude: 106.816666,
  radiusMeters: 100 // Radius toleransi (dalam meter)
};

// Fungsi menghitung jarak antara 2 titik koordinat bumi (Haversine formula)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Jarak dalam meter
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

interface AbsensiGuruPanelProps {
  currentUser?: { username: string; role: string; name: string; gender?: string } | null;
}

export default function AbsensiGuruPanel({ currentUser }: AbsensiGuruPanelProps) {
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [history, setHistory] = useState<any[]>([]);
  const [schoolLocation, setSchoolLocation] = useState(DEFAULT_SCHOOL_LOCATION);
  const [showConfig, setShowConfig] = useState(false);
  const [configLat, setConfigLat] = useState(schoolLocation.latitude.toString());
  const [configLng, setConfigLng] = useState(schoolLocation.longitude.toString());
  const [configRadius, setConfigRadius] = useState(schoolLocation.radiusMeters.toString());

  useEffect(() => {
    // Load local history if any
    const saved = localStorage.getItem("absensi_guru_history");
    if (saved) {
      setHistory(JSON.parse(saved));
    }
    
    // Load custom school location if configured
    const savedLocation = localStorage.getItem("absensi_school_location");
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        setSchoolLocation(parsed);
        setConfigLat(parsed.latitude.toString());
        setConfigLng(parsed.longitude.toString());
        setConfigRadius(parsed.radiusMeters.toString());
      } catch (e) {
        console.error("Failed to parse saved school location", e);
      }
    }
  }, []);

  const handleSaveConfig = () => {
    const newLocation = {
      latitude: parseFloat(configLat),
      longitude: parseFloat(configLng),
      radiusMeters: parseInt(configRadius, 10)
    };
    if (isNaN(newLocation.latitude) || isNaN(newLocation.longitude) || isNaN(newLocation.radiusMeters)) {
      MySwal.fire({
        icon: 'error',
        title: 'Input Tidak Valid',
        text: 'Pastikan Latitude, Longitude, dan Radius berupa angka yang valid.'
      });
      return;
    }
    setSchoolLocation(newLocation);
    localStorage.setItem("absensi_school_location", JSON.stringify(newLocation));
    MySwal.fire({
      icon: 'success',
      title: 'Konfigurasi Tersimpan',
      text: 'Lokasi sekolah berhasil diperbarui.',
      timer: 1500,
      showConfirmButton: false
    });
    setShowConfig(false);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation tidak didukung oleh browser ini.");
      return;
    }
    
    setIsLocating(true);
    setErrorMsg(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ lat: latitude, lng: longitude, accuracy });
        
        const dist = getDistanceFromLatLonInM(
          schoolLocation.latitude, 
          schoolLocation.longitude, 
          latitude, 
          longitude
        );
        setDistance(dist);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMsg("Akses lokasi ditolak. Harap izinkan akses lokasi untuk absensi.");
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMsg("Informasi lokasi tidak tersedia.");
            break;
          case error.TIMEOUT:
            setErrorMsg("Permintaan lokasi timeout.");
            break;
          default:
            setErrorMsg("Terjadi kesalahan yang tidak diketahui saat mengambil lokasi.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSubmitAbsensi = async () => {
    if (!location || distance === null) return;
    
    const statusLokasi = distance <= schoolLocation.radiusMeters ? "Dalam Jangkauan" : "Luar Jangkauan";
    
    if (statusLokasi === "Luar Jangkauan") {
      const confirm = await MySwal.fire({
        icon: 'warning',
        title: 'Di Luar Area Sekolah',
        text: `Anda berada ${Math.round(distance)} meter dari sekolah (Maksimal ${schoolLocation.radiusMeters} meter). Tetap ingin absen?`,
        showCancelButton: true,
        confirmButtonText: 'Ya, Tetap Absen',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#eab308'
      });
      if (!confirm.isConfirmed) return;
    }
    
    setIsSaving(true);
    
    const record = {
      username: currentUser?.username || "unknown",
      nama_guru: currentUser?.name || "Guru",
      waktu_absen: new Date().toISOString(),
      latitude: location.lat,
      longitude: location.lng,
      status_lokasi: statusLokasi,
      keterangan: "Hadir"
    };
    
    // Save to local storage for demo fallback
    const updatedHistory = [record, ...history];
    localStorage.setItem("absensi_guru_history", JSON.stringify(updatedHistory));
    setHistory(updatedHistory);
    
    // Attempt Supabase insert if table exists
    try {
      const { error } = await supabase
        .from('absensi_guru')
        .insert([record]);
        
      if (error) {
        console.warn("Supabase insert failed. Table might not exist yet:", error.message);
      }
    } catch (e) {
      console.warn("Supabase error:", e);
    }
    
    setIsSaving(false);
    
    MySwal.fire({
      icon: 'success',
      title: 'Absensi Berhasil Disimpan!',
      text: statusLokasi === 'Dalam Jangkauan' ? 'Anda tercatat di dalam area sekolah.' : 'Anda tercatat di luar area sekolah.',
      confirmButtonColor: '#10b981',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const sqlCode = `
-- COPY AND PASTE THIS IN YOUR SUPABASE SQL EDITOR --

CREATE TABLE IF NOT EXISTS public.absensi_guru (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    waktu_absen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status_lokasi TEXT,
    keterangan TEXT
);

-- RLS (Row Level Security) - Optional
ALTER TABLE public.absensi_guru ENABLE ROW LEVEL SECURITY;

-- Allow insert
CREATE POLICY "Enable insert for authenticated users only" 
ON public.absensi_guru FOR INSERT 
WITH CHECK (true);

-- Allow select
CREATE POLICY "Enable read access for all users" 
ON public.absensi_guru FOR SELECT 
USING (true);
  `;

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4 animate-fade-in space-y-6">
      
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="text-[#0c66e4]" /> Absensi Kehadiran Guru
          </h2>
          <p className="text-sm text-slate-500 mt-1">Sistem Absensi Berbasis Titik Koordinat Lokasi (GPS)</p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <div>
            <p className="text-xs text-slate-400 font-medium">Pengguna Aktif</p>
            <p className="font-bold text-[#0c66e4] uppercase">{currentUser?.name || "Guru"}</p>
          </div>
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> Konfigurasi Lokasi
            </button>
          )}
        </div>
      </div>

      {/* CONFIGURATION PANEL (ADMIN ONLY) */}
      {showConfig && currentUser?.role === 'admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 animate-fade-in">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0c66e4]" /> Konfigurasi Titik Pusat Sekolah
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
              <input 
                type="text" 
                value={configLat}
                onChange={e => setConfigLat(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="-6.200000"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
              <input 
                type="text" 
                value={configLng}
                onChange={e => setConfigLng(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="106.816666"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Radius (Meter)</label>
              <input 
                type="number" 
                value={configRadius}
                onChange={e => setConfigRadius(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="100"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleSaveConfig}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </div>
      )}

      {/* LOCATION BOX */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        {!location ? (
          <div className="space-y-4">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-[#0c66e4]">
              <Crosshair className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-lg text-slate-700">Dapatkan Lokasi Anda</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Untuk melakukan absensi, sistem perlu mengetahui lokasi Anda saat ini. Pastikan GPS/Location service pada perangkat Anda dalam keadaan aktif.
            </p>
            
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center justify-center gap-2 mt-4">
                <AlertTriangle className="w-4 h-4" /> {errorMsg}
              </div>
            )}
            
            <button 
              onClick={handleGetLocation}
              disabled={isLocating}
              className="mt-6 px-8 py-3 bg-[#0c66e4] hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {isLocating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> 
                  Mencari Titik Lokasi...
                </>
              ) : (
                <>
                  <MapPin className="w-5 h-5" /> 
                  Cek Titik Lokasi Saat Ini
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              
              <div className="text-left space-y-3 flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Lokasi</p>
                {distance !== null && distance <= schoolLocation.radiusMeters ? (
                  <div className="flex items-center gap-2 text-emerald-600 font-black text-lg">
                    <CheckCircle className="w-6 h-6" /> 
                    <span>DALAM JANGKAUAN SEKOLAH</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 font-black text-lg">
                    <XCircle className="w-6 h-6" /> 
                    <span>DI LUAR JANGKAUAN</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-xs text-slate-500">Jarak ke Pusat</p>
                    <p className="font-bold text-slate-800">{distance ? Math.round(distance) : '-'} Meter</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Akurasi GPS</p>
                    <p className="font-bold text-slate-800">{Math.round(location.accuracy)} Meter</p>
                  </div>
                </div>
              </div>
              
            </div>
            
            <div className="flex justify-center gap-4">
              <button 
                onClick={handleGetLocation}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
              >
                Refresh Lokasi
              </button>
              <button 
                onClick={handleSubmitAbsensi}
                disabled={isSaving}
                className={`px-8 py-3 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 ${
                  distance !== null && distance <= schoolLocation.radiusMeters 
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25" 
                    : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
                } disabled:opacity-50`}
              >
                {isSaving ? "Menyimpan..." : (
                  <>
                    <Save className="w-5 h-5" /> 
                    Kirim Data Absensi Kehadiran
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SQL HELPER INFO */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-sm">
        <h3 className="font-bold text-slate-800 mb-2">Instruksi Pengaturan Database Supabase (Untuk Admin)</h3>
        <p className="text-slate-600 mb-4">
          Agar data absensi guru tersimpan ke cloud, jalankan SQL query di bawah ini pada SQL Editor di dashboard Supabase Anda.
        </p>
        <div className="bg-[#1e1e1e] p-4 rounded-lg overflow-x-auto">
          <pre className="text-emerald-400 font-mono text-xs">
            {sqlCode}
          </pre>
        </div>
      </div>

      {/* HISTORY TABLE (LOKAL) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Riwayat Absensi Anda (Perangkat Ini)</h3>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Waktu</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Status Lokasi</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{new Date(h.waktu_absen).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3">{h.nama_guru}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        h.status_lokasi === "Dalam Jangkauan" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {h.status_lokasi}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-blue-500 hover:underline text-xs font-medium"
                      >
                        Lihat Peta
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-sm">Belum ada riwayat absensi.</div>
        )}
      </div>

    </div>
  );
}
