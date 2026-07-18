import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, Lock, Chrome, Shield, AlertCircle, Check, Sun, Moon, Laptop, Database, Settings, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "../supabaseClient";

interface LoginFormProps {
  onSuccess: (user: { username: string; role: string; name: string; gender?: string }) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export default function LoginForm({ onSuccess, isDarkMode, setIsDarkMode }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Database Connection states
  const [showDbSettings, setShowDbSettings] = useState(false);
  const [customDbUrl, setCustomDbUrl] = useState(() => localStorage.getItem("supabase_url") || "");
  const [customDbKey, setCustomDbKey] = useState(() => localStorage.getItem("supabase_anon_key") || "");
  const [dbSuccessMsg, setDbSuccessMsg] = useState("");

  const handleSaveDbSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (customDbUrl.trim()) {
      localStorage.setItem("supabase_url", customDbUrl.trim());
    } else {
      localStorage.removeItem("supabase_url");
    }
    if (customDbKey.trim()) {
      localStorage.setItem("supabase_anon_key", customDbKey.trim());
    } else {
      localStorage.removeItem("supabase_anon_key");
    }
    setDbSuccessMsg("Konfigurasi disimpan! Memuat ulang sistem...");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleResetDbSettings = () => {
    localStorage.removeItem("supabase_url");
    localStorage.removeItem("supabase_anon_key");
    setCustomDbUrl("");
    setCustomDbKey("");
    setDbSuccessMsg("Koneksi dikembalikan ke default! Memuat ulang...");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("Harap masukkan ID Pengguna dan Password!");
      return;
    }

    setErrorMsg("");
    setIsLoading(true);

    try {
      // Check database first!
      const { data, error } = await supabase
        .from("pengguna")
        .select("*")
        .eq("username", username)
        .eq("password", password);

      if (data && data.length > 0) {
        const user = data[0];
        
        // Merge with local fallback details in case columns aren't present in remote Supabase table yet
        const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
        const extra = localDetails[user.username] || {};

        const dbUserVal = {
          username: user.username,
          role: user.role,
          name: user.nama,
          gender: user.gender || 'Semua',
          bagian: user.bagian || extra.bagian || (user.role === "admin" ? "kedua" : user.role === "guru_sekolah" ? "sekolah" : "pondok"),
          jabatan: user.jabatan || extra.jabatan || (user.role === "admin" ? "pengurus" : user.role === "guru_sekolah" ? "guru mapel" : "guru pondok"),
          tugas_kamar: user.tugas_kamar || extra.tugas_kamar || "",
          tugas_kelas_sekolah: user.tugas_kelas_sekolah || extra.tugas_kelas_sekolah || "",
          tugas_kelas_pengajian: user.tugas_kelas_pengajian || extra.tugas_kelas_pengajian || ""
        };
        
        setIsSuccess(true);
        setIsLoading(false);
        localStorage.setItem("admin_token", "session_token_custom_db");
        localStorage.setItem("admin_user", JSON.stringify(dbUserVal));
        setTimeout(() => onSuccess(dbUserVal), 2200);
        return;
      }
    } catch (err: any) {
      console.warn("DB login check failed", err);
    }

    // Try express backend API next for backwards compatibility (the old hardcoded API login or fallback)
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsSuccess(true);
          setIsLoading(false);
          
          localStorage.setItem("admin_token", data.token);
          localStorage.setItem("admin_user", JSON.stringify(data.user));

          setTimeout(() => {
            onSuccess(data.user);
          }, 2200);
          return;
        } else {
          // If express auth rejected but maybe client fallback allowed? Let's check below.
        }
      }
    } catch (err: any) {
      console.warn("Backend auth failed or unreachable; utilizing client-side fallback authentication:", err);
    }

    // Client-side fallback authentication (ensures 100% success on any deployment environment: static/server-side)
    if (username === "angie.seprisa" && password === "pssleman") {
      setIsSuccess(true);
      setIsLoading(false);
      
      const guestUser = {
        username: "angie.seprisa",
        role: "admin",
        name: "Angie Seprisa"
      };

      localStorage.setItem("admin_token", "session_token_admin_pp_almuttaqin_2026");
      localStorage.setItem("admin_user", JSON.stringify(guestUser));

      setTimeout(() => {
        onSuccess(guestUser);
      }, 2200);
    } else {
      setIsLoading(false);
      setErrorMsg("ID Pengguna atau Password salah!");
    }
  };

  const handleGoogleSignIn = () => {
    setErrorMsg("Sign in dengan Google hanya tersedia untuk akun terafiliasi resmi.");
  };

  return (
    <div className={`relative min-h-screen w-full flex items-center justify-center overflow-hidden font-sans p-4 transition-all duration-750 ${
      isDarkMode 
        ? "bg-[#080914] text-[#f1f5f9]" 
        : "bg-[#f3f6fc] text-[#1e293b]"
    }`} id="login_screen_root">
      
      {/* FLOATING STYLE MODE SELECTOR IN TOP-RIGHT (Matches sun/monitor/moon in screenshot) */}
      <div className={`absolute top-6 right-6 flex items-center p-1 rounded-full border backdrop-blur-md shadow-sm select-none z-30 transition-all duration-300 ${
        isDarkMode 
          ? "bg-[#13172b]/80 border-[#252b4d]/70" 
          : "bg-white/80 border-slate-250"
      }`}>
        <button
          type="button"
          onClick={() => setIsDarkMode(false)}
          className={`p-2 rounded-full transition-all cursor-pointer ${
            !isDarkMode 
              ? "bg-[#2563eb] text-white shadow-sm" 
              : "text-[#566185] hover:text-[#b1bcdd]"
          }`}
          title="Mode Siang"
        >
          <Sun className="w-3.5 h-3.5" />
        </button>
        <div className={`p-2 rounded-full text-[#566185] dark:text-[#566185]/70`}>
          <Laptop className="w-3.5 h-3.5" />
        </div>
        <button
          type="button"
          onClick={() => setIsDarkMode(true)}
          className={`p-2 rounded-full transition-all cursor-pointer ${
            isDarkMode 
              ? "bg-[#2563eb] text-white shadow-sm" 
              : "text-[#566185] hover:text-[#1e293b]"
          }`}
          title="Mode Malam"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. FLOATING BACKGROUND DECORATIONS (The beautiful tilted capsule shapes from the screenshot) */}
      <div className="absolute inset-0 pointer-events-none select-none z-0">
        {/* Radial ambient background lights */}
        {isDarkMode ? (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/15 blur-[120px]" />
          </>
        ) : (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-400/5 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/8 blur-[120px]" />
          </>
        )}
        
        {/* Capsule 1: Top-left tilted pill (Sunset warm gradient in light mode, cosmic sky in dark) */}
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-[8%] left-[8%] w-14 h-40 rounded-full rotate-[25deg] border blur-[0.5px] hidden sm:block transition-colors duration-500 ${
            isDarkMode 
              ? "bg-gradient-to-b from-[#13172e]/20 to-transparent border-white/5" 
              : "bg-gradient-to-b from-orange-400/15 to-transparent border-orange-200/30 shadow-[rgba(255,126,48,0.02)_0px_20px_40px_0px]"
          }`}
        />
        
        {/* Capsule 2: Large tilted pill at bottom left */}
        <motion.div 
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute bottom-[10%] left-[6%] w-20 h-56 rounded-full -rotate-[15deg] border blur-[1px] hidden sm:block transition-colors duration-500 ${
            isDarkMode 
              ? "bg-gradient-to-t from-indigo-500/10 to-transparent border-white/5" 
              : "bg-gradient-to-t from-blue-300/15 to-transparent border-blue-200/20 shadow-[rgba(108,140,255,0.03)_0px_25px_50px_0px]"
          }`}
        />
        
        {/* Capsule 3: Top-right tilted pill */}
        <motion.div 
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-[10%] right-[10%] w-16 h-44 rounded-full rotate-[35deg] border blur-[0.5px] hidden md:block transition-colors duration-500 ${
            isDarkMode 
              ? "bg-gradient-to-tr from-[#3b82f6]/10 to-transparent border-white/5" 
              : "bg-gradient-to-tr from-purple-300/15 to-transparent border-purple-200/20"
          }`}
        />
        
        {/* Capsule 4: Bottom right tilted soft pill */}
        <motion.div 
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute bottom-[15%] right-[4%] w-12 h-36 rounded-full rotate-[45deg] border blur-[1px] hidden sm:block transition-colors duration-500 ${
            isDarkMode 
              ? "bg-gradient-to-b from-indigo-600/15 to-transparent border-white/5" 
              : "bg-gradient-to-b from-indigo-300/15 to-transparent border-indigo-200/20 scrap-element"
          }`}
        />
      </div>

      <AnimatePresence mode="wait">
        {!isSuccess ? (
          /* --- LOGIN FORM CARD --- */
          <motion.div
            key="login-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className={`w-full max-w-[420px] p-7 sm:p-9 rounded-[2rem] border backdrop-blur-xl z-10 flex flex-col items-center text-center select-none transition-all duration-300 ${
              isDarkMode 
                ? "bg-[#111322]/90 border-[#1c1f36]/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]" 
                : "bg-white/95 border-slate-200/60 shadow-[0_20px_45px_-12px_rgba(37,99,235,0.06)]"
            }`}
            id="login_card_container"
          >
            {/* Header Badge */}
            <motion.div 
              initial={{ y: -15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-6 relative group border transition-all duration-300 bg-gradient-to-b overflow-hidden ${
                isDarkMode 
                  ? "from-[#1d2345] to-[#12162d] border-[#2b3363]" 
                  : "from-white to-slate-50 border-slate-200/50"
              }`}
            >
              <div className="absolute inset-0 bg-blue-500/5 blur-md rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
              <img
                src="https://eflhcunxpckcynozywol.supabase.co/storage/v1/object/public/foto_siswa/1779791263491_pbf19o.png"
                alt="Logo Pondok"
                className="w-12 h-12 object-contain relative z-10"
              />
            </motion.div>

            {/* Captions */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="space-y-1 mb-8"
            >
              <h2 className={`text-2xl font-extrabold font-display tracking-tight leading-tight transition-colors duration-300 ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                Assalamualaikum
              </h2>
              <p className={`text-xs font-semibold tracking-wide transition-colors duration-300 ${
                isDarkMode ? "text-[#8c98bd]" : "text-slate-500"
              }`}>
                Silahkan masuk untuk melanjutkan.
              </p>
            </motion.div>

            {/* Error Message Panel */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`w-full p-3 mb-5 rounded-2xl border text-[11px] font-semibold text-left flex items-start gap-2.5 shadow-sm ${
                    isDarkMode 
                      ? "bg-red-950/40 border-red-500/35 text-red-300" 
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-5 text-left">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-black tracking-widest uppercase leading-none pl-1 transition-colors duration-300 ${
                  isDarkMode ? "text-[#8c98bd]" : "text-slate-400"
                }`}>
                  EMAIL, NO. TELEPON, ATAU USERNAME
                </label>
                <div className="relative group">
                  <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                    isDarkMode ? "text-[#566185] group-focus-within:text-sky-400" : "text-slate-400 group-focus-within:text-blue-600"
                  }`}>
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username admin..."
                    className={`w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl transition-all duration-200 outline-none focus:ring-1 border font-mono shadow-inner ${
                      isDarkMode 
                        ? "bg-[#0b0c16] border-[#1d2138] text-white placeholder-[#454c6c] focus:border-sky-500/80 focus:ring-sky-500/30" 
                        : "bg-[#eef2fc] border-[#d2dff6] text-slate-800 placeholder-[#8a99c5] focus:border-blue-500 focus:ring-blue-500/20"
                    }`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className={`text-[10px] font-black tracking-widest uppercase leading-none transition-colors duration-300 ${
                    isDarkMode ? "text-[#8c98bd]" : "text-slate-400"
                  }`}>
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`text-[10px] font-extrabold transition-colors bg-transparent border-0 cursor-pointer ${
                      isDarkMode ? "text-[#3b82f6] hover:text-[#5f9bff]" : "text-blue-600 hover:text-blue-700"
                    }`}
                  >
                    {showPassword ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>
                <div className="relative group">
                  <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                    isDarkMode ? "text-[#566185] group-focus-within:text-sky-400" : "text-slate-400 group-focus-within:text-blue-600"
                  }`}>
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password..."
                    className={`w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl transition-all duration-200 outline-none focus:ring-1 border font-mono shadow-inner ${
                      isDarkMode 
                        ? "bg-[#0b0c16] border-[#1d2138] text-white placeholder-[#454c6c] focus:border-sky-500/80 focus:ring-sky-500/30" 
                        : "bg-[#eef2fc] border-[#d2dff6] text-slate-800 placeholder-[#8a99c5] focus:border-blue-500 focus:ring-blue-500/20"
                    }`}
                  />
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end pr-0.5">
                <a 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setErrorMsg("Untuk bantuan setel ulang kata sandi admin pondok, harap hubungi divisi IT Al Muttaqin.");
                  }}
                  className={`text-[10px] font-bold transition-colors ${
                    isDarkMode ? "text-[#8c98bd] hover:text-sky-400" : "text-slate-500 hover:text-blue-600"
                  }`}
                >
                  Lupa Password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`relative w-full overflow-hidden font-bold text-xs tracking-wider uppercase py-3.5 rounded-xl cursor-pointer shadow-lg transition-all duration-300 disabled:opacity-90 flex items-center justify-center ${
                  isLoading 
                    ? "bg-slate-205 border border-slate-300"
                    : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white hover:scale-[1.01] active:scale-[0.99] active:duration-75 shadow-blue-500/10"
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Memproses...</span>
                  </div>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {/* Info / Note */}
            <div className={`mt-5 text-center text-[11px] font-semibold tracking-wide py-3 px-4 rounded-xl border transition-colors duration-300 w-full ${
              isDarkMode 
                ? "bg-[#141829] border-[#20253f] text-[#8c98bd]" 
                : "bg-slate-50 border-slate-200/50 text-slate-500 shadow-inner"
            }`}>
              Silakan hubungi admin pondok untuk mendapatkan hak akses login.
            </div>

            {/* Database Connection Settings Accordion */}
            <div className="w-full mt-4 text-left border-t border-slate-100/50 dark:border-slate-800/50 pt-4">
              <button
                type="button"
                onClick={() => setShowDbSettings(!showDbSettings)}
                className={`w-full flex items-center justify-between text-xs font-black uppercase tracking-wider py-1.5 focus:outline-none transition-colors cursor-pointer ${
                  isDarkMode ? "text-[#8c98bd] hover:text-white" : "text-slate-500 hover:text-slate-850"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-blue-500" />
                  Koneksi Database (Supabase)
                </span>
                <span>{showDbSettings ? "▲" : "▼"}</span>
              </button>

              {showDbSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 space-y-3"
                >
                  <div className={`p-3 rounded-xl border text-[10px] leading-relaxed font-semibold transition-colors ${
                    isDarkMode ? "bg-blue-950/20 border-blue-900/30 text-blue-300" : "bg-blue-50 border-blue-100 text-blue-800"
                  }`}>
                    Ganti URL dan API key di bawah untuk menghubungkan aplikasi dengan database Supabase milik Anda sendiri.
                  </div>

                  {dbSuccessMsg && (
                    <div className="p-2 text-center text-[11px] font-bold text-emerald-500 bg-emerald-500/10 rounded-xl animate-pulse">
                      {dbSuccessMsg}
                    </div>
                  )}

                  <form onSubmit={handleSaveDbSettings} className="space-y-3">
                    <div className="space-y-1">
                      <label className={`text-[9px] font-bold uppercase ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                        SUPABASE PROJECT URL
                      </label>
                      <input
                        type="url"
                        value={customDbUrl}
                        onChange={(e) => setCustomDbUrl(e.target.value)}
                        placeholder="https://xyz.supabase.co"
                        className={`w-full text-xs font-mono px-3 py-2.5 rounded-xl border outline-none focus:ring-1 ${
                          isDarkMode
                            ? "bg-[#0b0c16] border-[#1d2138] text-white focus:border-sky-500/80 focus:ring-sky-500/30"
                            : "bg-[#eef2fc] border-[#d2dff6] text-slate-800 focus:border-blue-500 focus:ring-blue-500/20"
                        }`}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[9px] font-bold uppercase ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                        SUPABASE ANON KEY (PUBLIC API KEY)
                      </label>
                      <input
                        type="password"
                        value={customDbKey}
                        onChange={(e) => setCustomDbKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className={`w-full text-xs font-mono px-3 py-2.5 rounded-xl border outline-none focus:ring-1 ${
                          isDarkMode
                            ? "bg-[#0b0c16] border-[#1d2138] text-white focus:border-sky-500/80 focus:ring-sky-500/30"
                            : "bg-[#eef2fc] border-[#d2dff6] text-slate-800 focus:border-blue-500 focus:ring-blue-500/20"
                        }`}
                        required
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-2.5 px-3 rounded-xl uppercase tracking-wider cursor-pointer shadow transition-all flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                        Simpan & Hubungkan
                      </button>
                      {(localStorage.getItem("supabase_url") || localStorage.getItem("supabase_anon_key")) && (
                        <button
                          type="button"
                          onClick={handleResetDbSettings}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] py-2.5 px-3 rounded-xl uppercase tracking-wider cursor-pointer shadow transition-all flex items-center justify-center gap-1"
                          title="Reset ke Default"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      )}
                    </div>
                  </form>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          /* --- WELCOME SCREEN (Animated transition from the video) --- */
          <motion.div
            key="welcome-screen"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center z-10 space-y-3 p-6"
            id="login_welcome_banner"
          >
            {/* Animated Success Check Halo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 100, damping: 10 }}
              className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-6 relative"
            >
              <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full animate-ping opacity-60" />
              <Check className="w-10 h-10 text-emerald-400" />
            </motion.div>

            <motion.h3
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className={`text-4xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}
            >
              Selamat Datang
            </motion.h3>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55 }}
              className={`text-xs font-semibold tracking-wide ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
            >
              Anda akan diarahkan ke dashboard...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
