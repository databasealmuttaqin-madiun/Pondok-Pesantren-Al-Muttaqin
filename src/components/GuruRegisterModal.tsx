import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, Lock, CheckCircle2, Shield, X, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../supabaseClient";

interface GuruRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin?: (user: { username: string; role: string; name: string; gender?: string }) => void;
  isDarkMode?: boolean;
}

export default function GuruRegisterModal({ isOpen, onClose, onSuccessLogin, isDarkMode = false }: GuruRegisterModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"guru pondok" | "guru SMP" | "siswa">("guru SMP");
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setUsername("");
      setPassword("");
      setSelectedRole("guru SMP");
      setErrorMsg("");
      setSuccessMsg("");
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    
    const cleanUsername = username.trim().toLowerCase();
    
    if (!cleanUsername) {
      setErrorMsg("Harap isi Username ID!");
      return;
    }
    if (cleanUsername.length < 3) {
      setErrorMsg("Username minimal 3 karakter!");
      return;
    }
    if (!password.trim()) {
      setErrorMsg("Harap isi Password!");
      return;
    }
    if (password.length < 4) {
      setErrorMsg("Password minimal 4 karakter!");
      return;
    }
    
    setIsLoading(true);

    try {
      const dbPengguna = {
        username: cleanUsername,
        password: password,
        role: selectedRole,
      };

      // 1. Save local backup to ensure instant login capability in case of network issues
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      localDetails[cleanUsername] = {
        ...dbPengguna,
        status: selectedRole === "guru SMP" ? "sekolah" : selectedRole === "guru pondok" ? "pondok" : "siswa",
        bagian: selectedRole === "guru SMP" ? "sekolah" : selectedRole === "guru pondok" ? "pondok" : "siswa"
      };
      localStorage.setItem("user_additional_details", JSON.stringify(localDetails));

      // 2. Insert into `pengguna` table in Supabase
      const { error: basicErr } = await supabase.from("pengguna").insert([dbPengguna]);
      
      if (basicErr) {
        const bErrStr = (basicErr.message || "") + (basicErr.code || "");
        if (bErrStr.includes("duplicate") || bErrStr.includes("23505") || bErrStr.includes("already exists")) {
          setErrorMsg(`Username ID '${cleanUsername}' sudah terdaftar! Silakan gunakan username lain.`);
        } else {
          setErrorMsg(`Gagal mendaftar ke database: ${basicErr.message}`);
          console.error("Database insert error:", basicErr);
        }
        setIsLoading(false);
        return;
      }

      setSuccessMsg("Pendaftaran Akun Berhasil!");
      setIsLoading(false);

      const dbUserVal = {
        username: cleanUsername,
        role: selectedRole,
        name: cleanUsername,
        gender: "Semua",
        bagian: selectedRole === "guru SMP" ? "sekolah" : selectedRole === "guru pondok" ? "pondok" : "siswa"
      };

      // Auto login after success
      setTimeout(() => {
        if (onSuccessLogin) {
          onSuccessLogin(dbUserVal);
        }
        onClose();
      }, 1400);

    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(`Pendaftaran gagal: ${err.message || "Terjadi kesalahan internal"}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 15 }}
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden my-auto ${
          isDarkMode ? "bg-[#111322] border-[#20253f] text-white" : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Modal Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isDarkMode ? "bg-[#161a2e] border-[#20253f]" : "bg-slate-50 border-slate-100"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Pendaftaran Akun</h3>
              <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Buat akun pengguna baru
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDarkMode ? "bg-[#1d2138] hover:bg-red-500/20 hover:text-red-400" : "bg-slate-200 hover:bg-red-100 hover:text-red-600"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className={`p-6 ${isDarkMode ? "bg-[#111322]" : "bg-white"}`}>
          <AnimatePresence mode="wait">
            {successMsg ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-extrabold">{successMsg}</h4>
                  <p className={`text-sm mt-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Mengarahkan ke Dashboard...
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleCompleteRegistration}
                className="space-y-5"
              >
                {errorMsg && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{errorMsg}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Username ID *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4.5 h-4.5" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm font-semibold transition-all focus:ring-2 focus:ring-blue-500/50 outline-none ${
                          isDarkMode 
                            ? "bg-[#0a0c16] border-[#1d2138] focus:border-blue-500 text-white placeholder-slate-600" 
                            : "bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                        }`}
                        placeholder="Contoh: ahmad.123"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Password Akses *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4.5 h-4.5" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full pl-10 pr-12 py-3 rounded-2xl border text-sm font-semibold transition-all focus:ring-2 focus:ring-blue-500/50 outline-none ${
                          isDarkMode 
                            ? "bg-[#0a0c16] border-[#1d2138] focus:border-blue-500 text-white placeholder-slate-600" 
                            : "bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                        }`}
                        placeholder="Minimal 4 karakter"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-extrabold text-blue-500 hover:text-blue-600"
                      >
                        {showPassword ? "SEMBUNYIKAN" : "LIHAT"}
                      </button>
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Role / Hak Akses *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Shield className="w-4.5 h-4.5" />
                      </div>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as any)}
                        className={`w-full pl-10 pr-10 py-3 rounded-2xl border text-sm font-semibold transition-all focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none cursor-pointer ${
                          isDarkMode 
                            ? "bg-[#0a0c16] border-[#1d2138] focus:border-blue-500 text-white" 
                            : "bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-800"
                        }`}
                      >
                        <option value="guru SMP">Guru SMP</option>
                        <option value="guru pondok">Guru Pondok</option>
                        <option value="siswa">Siswa / Siswi</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`pt-4 border-t ${isDarkMode ? "border-[#20253f]" : "border-slate-100"}`}>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        MEMPROSES...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        DAFTAR SEKARANG
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
