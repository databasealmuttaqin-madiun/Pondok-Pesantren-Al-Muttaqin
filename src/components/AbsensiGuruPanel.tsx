import React, { useState, useEffect, useRef } from "react";
import { 
  MapPin, CheckCircle, XCircle, AlertTriangle, Crosshair, Save, Settings,
  User, Phone, Calendar, Camera, IdCard, Search, Edit, Plus, Clock, RefreshCw, Eye, Sparkles
} from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";

const MySwal = withReactContent(Swal);

// --- KONFIGURASI LOKASI SEKOLAH ---
const DEFAULT_SCHOOL_LOCATION = {
  latitude: -6.200000, 
  longitude: 106.816666,
  radiusMeters: 100 // Radius toleransi (dalam meter)
};

// Jarak antara 2 titik koordinat bumi (Haversine formula)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

interface AbsensiGuruPanelProps {
  currentUser?: { username: string; role: string; name: string; gender?: string } | null;
}

interface GuruSekolahProfile {
  id?: number;
  username: string;
  nama_lengkap: string;
  nik: string;
  jenis_kelamin: "L" | "P";
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat_pribadi: string;
  nomor_seluler: string;
  foto_diri: string;
  created_at?: string;
}

export default function AbsensiGuruPanel({ currentUser }: AbsensiGuruPanelProps) {
  // Navigation sub-tab
  const [activeSubTab, setActiveSubTab] = useState<"absensi" | "profil" | "semua_guru">("absensi");

  // Location/Presence State
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

  // Profile State
  const [profile, setProfile] = useState<GuruSekolahProfile>({
    username: currentUser?.username || "",
    nama_lengkap: currentUser?.name || "",
    nik: "",
    jenis_kelamin: "L",
    tempat_lahir: "",
    tanggal_lahir: "",
    alamat_pribadi: "",
    nomor_seluler: "",
    foto_diri: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileDbError, setProfileDbError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  
  // Teachers directory for Admin/Pengurus
  const [allProfiles, setAllProfiles] = useState<GuruSekolahProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Load local history if any
    const saved = localStorage.getItem("absensi_guru_history");
    if (saved) {
      setHistory(JSON.parse(saved));
    }

    // 2. Fetch history from Supabase
    fetchHistoryData();

    // 3. Load custom school location if configured locally as fallback
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

    // 4. Fetch globally from Supabase
    fetchGlobalLocation();

    // 5. Fetch current user's profile and all profiles (if admin/pengurus)
    fetchMyProfile();
    if (currentUser?.role === 'admin' || currentUser?.role === 'pengurus') {
      fetchAllProfiles();
    }
  }, [currentUser]);

  // Sync profile locally from local storage first on user change
  useEffect(() => {
    if (currentUser?.username) {
      const localProfileKey = `guru_profile_${currentUser.username}`;
      const savedProfile = localStorage.getItem(localProfileKey);
      if (savedProfile) {
        try {
          setProfile(JSON.parse(savedProfile));
        } catch (e) {
          console.warn("Error parsing saved profile fallback", e);
        }
      }
    }
  }, [currentUser]);

  const fetchHistoryData = async () => {
    try {
      let query = supabase
        .from("absensi_guru")
        .select("*")
        .order("waktu_absen", { ascending: false });
      
      if (currentUser?.role !== 'admin') {
        query = query.eq("username", currentUser?.username || "");
      }
      
      const { data, error } = await query;
      if (data && !error) {
        setHistory(data);
        localStorage.setItem("absensi_guru_history", JSON.stringify(data));
      }
    } catch (e) {
      console.warn("Failed to fetch history from Supabase", e);
    }
  };

  const fetchGlobalLocation = async () => {
    try {
      const { data, error } = await supabase
        .from("pengaturan_sekolah")
        .select("*")
        .eq("id", 1)
        .single();
      
      if (data && !error) {
        const globalLoc = {
          latitude: data.latitude,
          longitude: data.longitude,
          radiusMeters: data.radius_meters
        };
        setSchoolLocation(globalLoc);
        setConfigLat(globalLoc.latitude.toString());
        setConfigLng(globalLoc.longitude.toString());
        setConfigRadius(globalLoc.radiusMeters.toString());
        localStorage.setItem("absensi_school_location", JSON.stringify(globalLoc));
      }
    } catch (e) {
      console.warn("Failed to fetch global school location", e);
    }
  };

  const fetchMyProfile = async () => {
    if (!currentUser?.username) return;
    try {
      const { data, error } = await supabase
        .from("guru_sekolah")
        .select("*")
        .eq("username", currentUser.username)
        .maybeSingle();

      if (error) {
        if (error.code === "PGRST116" || error.message?.includes("relation \"guru_sekolah\" does not exist")) {
          setProfileDbError(true);
        } else {
          console.warn("Error fetching profile:", error.message);
        }
      } else if (data) {
        setProfile(data);
        setProfileDbError(false);
        // Sync local cache
        localStorage.setItem(`guru_profile_${currentUser.username}`, JSON.stringify(data));
      }
    } catch (err: any) {
      console.warn("Network error fetching profile:", err);
      setProfileDbError(true);
    }
  };

  const fetchAllProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("guru_sekolah")
        .select("*")
        .order("nama_lengkap", { ascending: true });

      if (error) {
        if (error.message?.includes("relation \"guru_sekolah\" does not exist")) {
          setProfileDbError(true);
        }
      } else if (data) {
        setAllProfiles(data);
        localStorage.setItem("guru_sekolah_all_profiles", JSON.stringify(data));
      }
    } catch (err) {
      console.warn("Failed to fetch all profiles", err);
    }
  };

  const handleSaveConfig = async () => {
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

    try {
      const { error } = await supabase
        .from("pengaturan_sekolah")
        .upsert([{
          id: 1,
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          radius_meters: newLocation.radiusMeters
        }]);
        
      if (error) {
        console.warn("Failed to save to Supabase. Table might not exist yet.", error.message);
      }
    } catch (e) {
      console.warn("Supabase upsert error:", e);
    }

    MySwal.fire({
      icon: 'success',
      title: 'Konfigurasi Tersimpan',
      text: 'Lokasi sekolah berhasil diperbarui untuk semua pengguna.',
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
      nama_guru: profile.nama_lengkap || currentUser?.name || "Guru",
      waktu_absen: new Date().toISOString(),
      latitude: location.lat,
      longitude: location.lng,
      status_lokasi: statusLokasi,
      keterangan: "Hadir"
    };
    
    const updatedHistory = [record, ...history];
    localStorage.setItem("absensi_guru_history", JSON.stringify(updatedHistory));
    setHistory(updatedHistory);
    
    try {
      const { error } = await supabase
        .from('absensi_guru')
        .insert([record]);
        
      if (error) {
        console.warn("Supabase insert failed. Table might not exist yet:", error.message);
        MySwal.fire({
          icon: 'error',
          title: 'Gagal Menyimpan di Server',
          text: 'Data absen gagal terkirim ke server database (Supabase). ' + error.message,
        });
        setIsSaving(false);
        return;
      }
    } catch (e: any) {
      console.warn("Supabase error:", e);
      MySwal.fire({
        icon: 'error',
        title: 'Gagal Terkoneksi',
        text: 'Tidak dapat menghubungi server. Periksa koneksi internet Anda.',
      });
      setIsSaving(false);
      return;
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
    
    fetchHistoryData();
  };

  // Profile Save Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    const localProfileKey = `guru_profile_${currentUser?.username || "unknown"}`;

    if (!profile.nama_lengkap) {
      MySwal.fire({
        icon: 'error',
        title: 'Validasi Gagal',
        text: 'Nama Lengkap wajib diisi.'
      });
      setIsSavingProfile(false);
      return;
    }

    if (!profile.nik || profile.nik.length !== 16 || !/^\d+$/.test(profile.nik)) {
      MySwal.fire({
        icon: 'warning',
        title: 'Validasi NIK',
        text: 'NIK harus tepat 16 digit angka.',
      });
      setIsSavingProfile(false);
      return;
    }

    // Save locally
    localStorage.setItem(localProfileKey, JSON.stringify(profile));

    // Update all list local
    const savedAllProfiles = localStorage.getItem("guru_sekolah_all_profiles");
    let listProfiles: GuruSekolahProfile[] = [];
    if (savedAllProfiles) {
      try {
        listProfiles = JSON.parse(savedAllProfiles);
      } catch {}
    }
    const index = listProfiles.findIndex(p => p.username === profile.username);
    if (index >= 0) {
      listProfiles[index] = profile;
    } else {
      listProfiles.push(profile);
    }
    localStorage.setItem("guru_sekolah_all_profiles", JSON.stringify(listProfiles));
    setAllProfiles(listProfiles);

    try {
      const { error } = await supabase
        .from("guru_sekolah")
        .upsert([{
          username: profile.username,
          nama_lengkap: profile.nama_lengkap,
          nik: profile.nik,
          jenis_kelamin: profile.jenis_kelamin,
          tempat_lahir: profile.tempat_lahir,
          tanggal_lahir: profile.tanggal_lahir,
          alamat_pribadi: profile.alamat_pribadi,
          nomor_seluler: profile.nomor_seluler,
          foto_diri: profile.foto_diri
        }], { onConflict: "username" });

      if (error) {
        console.warn("Failed to sync profile to Supabase:", error.message);
        if (error.message?.includes("relation \"guru_sekolah\" does not exist")) {
          setProfileDbError(true);
          MySwal.fire({
            icon: 'success',
            title: 'Tersimpan Lokal (Simulasi)',
            text: 'Tabel guru_sekolah belum ada di Supabase. Profil berhasil disimpan sementara di browser Anda.',
            confirmButtonColor: '#0c66e4'
          });
          setIsEditing(false);
        } else {
          MySwal.fire({
            icon: 'error',
            title: 'Gagal Sinkronisasi Cloud',
            text: 'Data disimpan lokal namun gagal disimpan ke Supabase: ' + error.message,
            confirmButtonColor: '#ef4444'
          });
        }
      } else {
        setProfileDbError(false);
        MySwal.fire({
          icon: 'success',
          title: 'Profil Berhasil Diperbarui',
          text: 'Data profil Anda telah disimpan ke server database.',
          timer: 1500,
          showConfirmButton: false
        });
        setIsEditing(false);
        fetchMyProfile();
        if (currentUser?.role === 'admin' || currentUser?.role === 'pengurus') {
          fetchAllProfiles();
        }
      }
    } catch (err: any) {
      console.warn("Supabase upsert profile error:", err);
      MySwal.fire({
        icon: 'success',
        title: 'Tersimpan Lokal',
        text: 'Koneksi bermasalah. Profil berhasil disimpan lokal pada browser ini.',
        confirmButtonColor: '#0c66e4'
      });
      setIsEditing(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // FileReader for local photo selection (convert to base64)
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit to prevent huge base64 strings
      MySwal.fire({
        icon: 'error',
        title: 'File Terlalu Besar',
        text: 'Ukuran foto maksimal adalah 2 MB.'
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      MySwal.fire({
        icon: 'error',
        title: 'Format Salah',
        text: 'File harus berupa gambar (PNG/JPG).'
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile(prev => ({ ...prev, foto_diri: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Filter profiles based on search
  const filteredProfiles = allProfiles.filter(p => 
    p.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.nik.includes(searchQuery) ||
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full py-6 px-4 animate-fade-in space-y-6">
      
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <MapPin className="text-[#0c66e4] w-6 h-6" /> Guru Sekolah
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Absensi Titik GPS &amp; Manajemen Data Diri Guru Resmi</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Pengguna Aktif</p>
            <p className="font-extrabold text-[#0c66e4] uppercase text-sm sm:text-base">
              {profile.nama_lengkap || currentUser?.name || "GURU SEKOLAH"}
            </p>
          </div>
          {currentUser?.role === 'admin' && (
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" /> Atur Lokasi Sekolah
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="-6.200000"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
              <input 
                type="text" 
                value={configLng}
                onChange={e => setConfigLng(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="106.816666"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Radius (Meter)</label>
              <input 
                type="number" 
                value={configRadius}
                onChange={e => setConfigRadius(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button 
              onClick={handleSaveConfig}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB NAVIGATION */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex shadow-sm">
        <button
          onClick={() => setActiveSubTab("absensi")}
          className={`flex-1 py-3 px-4 text-center text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 border-r border-slate-100 transition-all cursor-pointer ${
            activeSubTab === "absensi"
              ? "bg-[#0c66e4] text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Clock className="w-4 h-4" /> Presensi Kehadiran
        </button>
        <button
          onClick={() => setActiveSubTab("profil")}
          className={`flex-1 py-3 px-4 text-center text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 border-r border-slate-100 transition-all cursor-pointer ${
            activeSubTab === "profil"
              ? "bg-[#0c66e4] text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <User className="w-4 h-4" /> Profil Data Diri
        </button>
        {(currentUser?.role === 'admin' || currentUser?.role === 'pengurus') && (
          <button
            onClick={() => setActiveSubTab("semua_guru")}
            className={`flex-1 py-3 px-4 text-center text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "semua_guru"
                ? "bg-[#0c66e4] text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Search className="w-4 h-4" /> Daftar Guru Sekolah
          </button>
        )}
      </div>

      {/* SQL SCHEMA WARNING HELPER BOX (If database table doesn't exist yet) */}
      {profileDbError && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex gap-3">
            <AlertTriangle className="text-amber-600 flex-shrink-0 w-6 h-6 mt-0.5 animate-bounce" />
            <div>
              <h4 className="font-black text-amber-900 text-sm">💡 Tabel 'guru_sekolah' Belum Dibuat di Supabase</h4>
              <p className="text-xs text-amber-800 leading-relaxed mt-1">
                Sistem saat ini menggunakan <strong>Mode Simulasi Offline (Local Browser)</strong>. Untuk mengaktifkan sinkronisasi database cloud Supabase, administrator hanya perlu menyalin query SQL berikut lalu menjalankannya di SQL Editor pada dashboard Supabase Anda.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`-- KODE SQL UNTUK TABEL GURU_SEKOLAH
CREATE TABLE IF NOT EXISTS guru_sekolah (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    username TEXT NOT NULL UNIQUE,
    nama_lengkap TEXT NOT NULL,
    nik TEXT NOT NULL,
    jenis_kelamin TEXT NOT NULL,
    tempat_lahir TEXT NOT NULL,
    tanggal_lahir TEXT NOT NULL,
    alamat_pribadi TEXT NOT NULL,
    nomor_seluler TEXT NOT NULL,
    foto_diri TEXT NOT NULL
);

-- Mengaktifkan Row Level Security (RLS) agar dapat diakses dari frontend web
ALTER TABLE guru_sekolah ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Guru Sekolah Seluruh Operasi" ON guru_sekolah;
CREATE POLICY "Akses Publik Guru Sekolah Seluruh Operasi" ON guru_sekolah 
    AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);`);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              {copiedSql ? "✓ SQL Berhasil Disalin!" : "Salin Query SQL Pembuat Tabel"}
            </button>
            <button
              onClick={() => setShowSqlGuide(!showSqlGuide)}
              className="bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              {showSqlGuide ? "Sembunyikan Panduan 🙈" : "Lihat Petunjuk 📖"}
            </button>
          </div>
          {showSqlGuide && (
            <div className="bg-slate-900 text-slate-200 rounded-xl p-4 text-xs font-mono space-y-2 mt-2 leading-relaxed">
              <p className="font-bold text-amber-400">Petunjuk Pemasangan Tabel Supabase:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>Buka dashboard Supabase proyek Anda.</li>
                <li>Klik ikon <strong className="text-white">"SQL Editor"</strong> di panel sebelah kiri.</li>
                <li>Klik tombol <strong className="text-white">"New Query"</strong>, tempel (paste) kode SQL yang disalin, dan klik tombol <strong className="text-white">"Run"</strong>.</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB Content: ABSENSI KEHADIRAN */}
      {activeSubTab === "absensi" && (
        <div className="space-y-6">
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
                  className="mt-6 px-8 py-3 bg-[#0c66e4] hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 mx-auto disabled:opacity-50 cursor-pointer"
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
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Refresh Lokasi
                  </button>
                  <button 
                    onClick={handleSubmitAbsensi}
                    disabled={isSaving}
                    className={`px-8 py-3 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
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

          {/* HISTORY TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">{currentUser?.role === 'admin' ? "Semua Riwayat Absensi" : "Riwayat Absensi Anda"}</h3>
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
      )}

      {/* SUB-TAB Content: PROFIL DATA DIRI */}
      {activeSubTab === "profil" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-150 pb-4 mb-6">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
              <User className="text-[#0c66e4]" /> Profil Mandiri Guru
            </h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0c66e4] hover:bg-blue-700 text-white text-xs font-extrabold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" /> Lengkapi / Ubah Profil
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsEditing(false);
                  fetchMyProfile(); // Reload
                }}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer"
              >
                Batal
              </button>
            )}
          </div>

          {!isEditing ? (
            /* PREVIEW PROFILE VIEW */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Photo Display Card */}
              <div className="flex flex-col items-center justify-start text-center space-y-4 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6">
                <div className="relative group">
                  {profile.foto_diri ? (
                    <img 
                      src={profile.foto_diri} 
                      alt="Foto Diri" 
                      className="w-36 h-36 rounded-full object-cover border-4 border-blue-50 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-36 h-36 rounded-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200">
                      <Camera className="w-10 h-10 mb-1 text-slate-300" />
                      <span className="text-[10px] font-semibold">Belum Ada Foto</span>
                    </div>
                  )}
                  <span className="absolute bottom-1 right-2 bg-slate-800 text-white rounded-full p-1.5 shadow">
                    <User className="w-3 h-3" />
                  </span>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg leading-tight">{profile.nama_lengkap || currentUser?.name}</h4>
                  <p className="text-xs text-slate-400 font-bold tracking-wide mt-1 uppercase bg-slate-100 px-3 py-0.5 rounded-full inline-block">
                    {currentUser?.role === 'admin' ? 'Administrator' : 'Guru Sekolah'}
                  </p>
                </div>
                <div className="w-full pt-4 text-xs text-slate-400 space-y-1 text-left bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p><strong>Username:</strong> {profile.username}</p>
                  <p><strong>Satus Data:</strong> {profile.nik ? "✅ Lengkap" : "⚠️ Belum Lengkap"}</p>
                </div>
              </div>

              {/* Personal Data Grid View (Sorted 1 to 8 Commonly) */}
              <div className="md:col-span-2 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                  
                  {/* 1. Nama Lengkap */}
                  <div className="space-y-0.5 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Nama Lengkap</span>
                    <span className="text-sm font-bold text-slate-800">{profile.nama_lengkap || "-"}</span>
                  </div>

                  {/* 2. NIK */}
                  <div className="space-y-0.5 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">2. NIK KTP</span>
                    <span className="text-sm font-bold text-slate-800 font-mono tracking-wide">{profile.nik || "-"}</span>
                  </div>

                  {/* 3. Jenis Kelamin */}
                  <div className="space-y-0.5 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">3. Jenis Kelamin</span>
                    <span className="text-sm font-bold text-slate-800">
                      {profile.jenis_kelamin === "L" ? "Laki-laki" : profile.jenis_kelamin === "P" ? "Perempuan" : "-"}
                    </span>
                  </div>

                  {/* 4. Tempat Lahir */}
                  <div className="space-y-0.5 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">4. Tempat Lahir</span>
                    <span className="text-sm font-bold text-slate-800">{profile.tempat_lahir || "-"}</span>
                  </div>

                  {/* 5. Tanggal Lahir */}
                  <div className="space-y-0.5 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">5. Tanggal Lahir</span>
                    <span className="text-sm font-bold text-slate-800">
                      {profile.tanggal_lahir ? new Date(profile.tanggal_lahir).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : "-"}
                    </span>
                  </div>

                  {/* 6. Alamat Pribadi (sesuai KTP) - Moved below commonly */}
                  <div className="space-y-0.5 pb-2 border-b border-slate-50 sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">6. Alamat Pribadi (Sesuai KTP)</span>
                    <span className="text-sm font-bold text-slate-800 leading-relaxed block">{profile.alamat_pribadi || "-"}</span>
                  </div>

                  {/* 7. Nomor Seluler */}
                  <div className="space-y-0.5 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">7. Nomor Seluler / WhatsApp</span>
                    <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {profile.nomor_seluler ? (
                        <>
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          <a 
                            href={`https://wa.me/${profile.nomor_seluler.replace(/[^0-9]/g, "")}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-emerald-600 hover:underline"
                          >
                            {profile.nomor_seluler}
                          </a>
                        </>
                      ) : "-"}
                    </span>
                  </div>

                  {/* 8. Foto Diri (Status) */}
                  <div className="space-y-0.5 pb-2 border-b border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">8. Status Foto Diri</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-block mt-0.5 ${profile.foto_diri ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {profile.foto_diri ? "✓ Terunggah" : "⚠️ Belum Ada Foto"}
                    </span>
                  </div>

                </div>
              </div>
            </div>
          ) : (
            /* EDIT PROFILE FORM */
            <form onSubmit={handleSaveProfile} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visual Photo Editor */}
                <div className="flex flex-col items-center space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">8. Foto Diri</span>
                  <div className="relative w-32 h-32 group">
                    {profile.foto_diri ? (
                      <img 
                        src={profile.foto_diri} 
                        alt="Preview Foto" 
                        className="w-full h-full rounded-full object-cover border-4 border-white shadow-md"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                        <Camera className="w-8 h-8 text-slate-300" />
                        <span className="text-[9px] mt-1 font-semibold">Pilih Foto</span>
                      </div>
                    )}
                    {profile.foto_diri && (
                      <button
                        type="button"
                        onClick={() => setProfile(prev => ({ ...prev, foto_diri: "" }))}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow"
                        title="Hapus Foto"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="w-full text-center">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handlePhotoChange}
                      ref={fileInputRef}
                      className="hidden"
                      id="profile-foto-file-input"
                    />
                    <label 
                      htmlFor="profile-foto-file-input"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-xs font-bold rounded-lg text-slate-700 shadow-sm cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" /> Unggah Foto
                    </label>
                    <p className="text-[9px] text-slate-400 mt-2">Maksimal file 2MB (JPG/PNG)</p>
                  </div>

                  {/* Pas Foto URL Fallback */}
                  <div className="w-full pt-2 border-t border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left">Atau Paste URL Foto</label>
                    <input 
                      type="text" 
                      value={profile.foto_diri && !profile.foto_diri.startsWith("data:") ? profile.foto_diri : ""}
                      onChange={e => setProfile(prev => ({ ...prev, foto_diri: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="https://example.com/foto.jpg"
                    />
                  </div>
                </div>

                {/* Form Inputs (Sorted 1 to 7 Commonly) */}
                <div className="md:col-span-2 space-y-4">
                  
                  {/* 1. Nama Lengkap */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      1. Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text"
                      required
                      value={profile.nama_lengkap}
                      onChange={e => setProfile(prev => ({ ...prev, nama_lengkap: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold text-slate-800"
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  {/* 2. NIK */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        2. NIK (Nomor Induk Kependudukan) <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text"
                        required
                        maxLength={16}
                        value={profile.nik}
                        onChange={e => setProfile(prev => ({ ...prev, nik: e.target.value.replace(/[^0-9]/g, "") }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="16 digit angka KTP"
                      />
                      {profile.nik && profile.nik.length !== 16 && (
                        <p className="text-[10px] text-amber-600 font-semibold">⚠️ Harus tepat 16 digit (saat ini {profile.nik.length}/16)</p>
                      )}
                    </div>

                    {/* 3. Jenis Kelamin */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        3. Jenis Kelamin <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Option L */}
                        <label className={`flex items-center justify-center p-2 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          profile.jenis_kelamin === "L" 
                            ? "bg-blue-50 border-blue-500 text-blue-700" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}>
                          <input 
                            type="radio" 
                            name="edit_jenis_kelamin" 
                            checked={profile.jenis_kelamin === "L"} 
                            onChange={() => setProfile(prev => ({ ...prev, jenis_kelamin: "L" }))}
                            className="hidden" 
                          />
                          Laki-laki
                        </label>
                        {/* Option P */}
                        <label className={`flex items-center justify-center p-2 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          profile.jenis_kelamin === "P" 
                            ? "bg-pink-50 border-pink-500 text-pink-700" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}>
                          <input 
                            type="radio" 
                            name="edit_jenis_kelamin" 
                            checked={profile.jenis_kelamin === "P"} 
                            onChange={() => setProfile(prev => ({ ...prev, jenis_kelamin: "P" }))}
                            className="hidden" 
                          />
                          Perempuan
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Birthplace and Birthday */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 4. Tempat Lahir */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">4. Tempat Lahir</label>
                      <input 
                        type="text"
                        value={profile.tempat_lahir}
                        onChange={e => setProfile(prev => ({ ...prev, tempat_lahir: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Contoh: Sleman"
                      />
                    </div>

                    {/* 5. Tanggal Lahir */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">5. Tanggal Lahir</label>
                      <input 
                        type="date"
                        value={profile.tanggal_lahir}
                        onChange={e => setProfile(prev => ({ ...prev, tanggal_lahir: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* 6. Alamat Pribadi (Sesuai KTP) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">6. Alamat Pribadi (Sesuai KTP)</label>
                    <textarea 
                      rows={3}
                      value={profile.alamat_pribadi}
                      onChange={e => setProfile(prev => ({ ...prev, alamat_pribadi: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Masukkan alamat KTP lengkap dengan RT/RW, Kelurahan, Kecamatan"
                    />
                  </div>

                  {/* 7. Nomor Seluler */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">7. Nomor Seluler / No. WhatsApp</label>
                    <input 
                      type="text"
                      value={profile.nomor_seluler}
                      onChange={e => setProfile(prev => ({ ...prev, nomor_seluler: e.target.value.replace(/[^0-9+]/g, "") }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Contoh: 081234567890"
                    />
                  </div>

                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    fetchMyProfile();
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-sm font-bold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2 bg-[#0c66e4] hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Simpan Perubahan Profil
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>
      )}

      {/* SUB-TAB Content: DAFTAR SEMUA GURU (Admin/Pengurus Only) */}
      {activeSubTab === "semua_guru" && (currentUser?.role === 'admin' || currentUser?.role === 'pengurus') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                <Sparkles className="text-amber-500" /> Direktori Profil Guru Sekolah
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Berikut adalah daftar lengkap data profil mandiri guru yang sudah terdaftar.</p>
            </div>
            
            <button
              onClick={() => {
                fetchAllProfiles();
                fetchHistoryData();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Cari berdasarkan nama lengkap, NIK, atau username..."
            />
          </div>

          {/* Grid of Profiles */}
          {filteredProfiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredProfiles.map((guru) => (
                <div key={guru.id || guru.username} className="border border-slate-150 rounded-xl p-5 hover:shadow-md transition-all space-y-4 bg-slate-50/50">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    {guru.foto_diri ? (
                      <img 
                        src={guru.foto_diri} 
                        alt={guru.nama_lengkap} 
                        className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-extrabold text-xl shadow-inner border border-slate-300">
                        {guru.nama_lengkap ? guru.nama_lengkap.charAt(0).toUpperCase() : "?"}
                      </div>
                    )}

                    {/* Basic Info */}
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-base leading-tight">{guru.nama_lengkap}</h4>
                      <p className="text-xs text-slate-400 font-bold tracking-wide uppercase">ID: {guru.username}</p>
                      
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          guru.jenis_kelamin === "L" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"
                        }`}>
                          {guru.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                        </span>
                        {guru.nik && (
                          <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 rounded">
                            NIK: {guru.nik}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed profile grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-150 text-slate-600 bg-white p-3 rounded-lg border border-slate-100 shadow-inner">
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">TTL</p>
                      <p className="font-semibold text-slate-800">{guru.tempat_lahir || "-"}, {guru.tanggal_lahir ? new Date(guru.tanggal_lahir).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">No. Telepon / WA</p>
                      {guru.nomor_seluler ? (
                        <a 
                          href={`https://wa.me/${guru.nomor_seluler.replace(/[^0-9]/g, "")}`}
                          target="_blank" 
                          rel="noreferrer"
                          className="font-bold text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> {guru.nomor_seluler}
                        </a>
                      ) : (
                        <p className="text-slate-500 font-semibold">-</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Alamat Sesuai KTP</p>
                      <p className="font-semibold text-slate-800 leading-normal">{guru.alamat_pribadi || "-"}</p>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <User className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">Tidak ditemukan profil guru yang cocok.</p>
              <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata pencarian Anda.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
