import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, Lock, CheckCircle2, Shield, Camera, X, ChevronDown, Loader2, ArrowRight, ArrowLeft, Copy, Check, AlertCircle, FileText } from "lucide-react";
import { supabase } from "../supabaseClient";
import MultiSelectTagInput from "./MultiSelectTagInput";

interface GuruRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin?: (user: { username: string; role: string; name: string; gender?: string }) => void;
  isDarkMode?: boolean;
}

export default function GuruRegisterModal({ isOpen, onClose, onSuccessLogin, isDarkMode = false }: GuruRegisterModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // STEP 1: Akun
  const [namaLengkap, setNamaLengkap] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // STEP 2: Pendataan Role & Tugas
  const [status, setStatus] = useState<"sekolah" | "pondok" | "pengurus">("sekolah");
  const [selectedTugas, setSelectedTugas] = useState<string[]>([]);
  
  // Lanjutan tugas
  const [tugasKelasSekolah, setTugasKelasSekolah] = useState<string[]>([]);
  const [tugasMapel, setTugasMapel] = useState("");
  const [tugasKelasPengajian, setTugasKelasPengajian] = useState<string[]>([]);
  const [tugasKamar, setTugasKamar] = useState("");

  // STEP 3: Kelengkapan Data Guru
  const [nik, setNik] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [tempatLahir, setTempatLahir] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [alamatLengkap, setAlamatLengkap] = useState("");
  const [nomorHp, setNomorHp] = useState("");
  const [fotoDiri, setFotoDiri] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // System states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Master options
  const [optRooms, setOptRooms] = useState<string[]>(["Kamar Al-Ghazali", "Kamar Abu Bakar", "Kamar Umar", "Kamar Utsman"]);
  const [optSchoolClasses, setOptSchoolClasses] = useState<string[]>(["VII-A", "VII-B", "VIII-A", "VIII-B", "IX-A", "IX-B", "X-IPA", "X-IPS", "XI-IPA", "XI-IPS", "XII-IPA", "XII-IPS"]);
  const [optRecitationClasses, setOptRecitationClasses] = useState<string[]>(["Kelas Tajwid", "Kelas Makhraj", "Kelas Kitab Safinah", "Kelas Kitab Taqrib", "Tahfidz Juz 30"]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMsg("");
      setSuccessMsg("");
      
      // Load room and class options
      const r = JSON.parse(localStorage.getItem("manajemen_rooms") || "[]");
      const s = JSON.parse(localStorage.getItem("manajemen_school_classes") || "[]");
      const p = JSON.parse(localStorage.getItem("manajemen_recitation_classes") || "[]");
      if (r.length > 0) setOptRooms(r);
      if (s.length > 0) setOptSchoolClasses(s);
      if (p.length > 0) setOptRecitationClasses(p);

      // Try fetching options from Supabase
      supabase.from("plotting").select("jenis, nama").then(({ data, error }) => {
        if (!error && data) {
          const roomsDb = data.filter((item: any) => item.jenis === "kamar").map((item: any) => item.nama);
          const schoolDb = data.filter((item: any) => item.jenis === "sekolah").map((item: any) => item.nama);
          const recitationDb = data.filter((item: any) => item.jenis === "pengajian").map((item: any) => item.nama);
          if (roomsDb.length > 0) setOptRooms(roomsDb);
          if (schoolDb.length > 0) setOptSchoolClasses(schoolDb);
          if (recitationDb.length > 0) setOptRecitationClasses(recitationDb);
        }
      });
    }
  }, [isOpen]);

  // Reset selected tugas when status changes
  useEffect(() => {
    if (status === "sekolah") {
      setSelectedTugas(["guru_mapel"]);
    } else if (status === "pondok") {
      setSelectedTugas(["guru_pondok"]);
    } else {
      setSelectedTugas(["pengurus_pondok"]);
    }
    setTugasKelasSekolah([]);
    setTugasMapel("");
    setTugasKelasPengajian([]);
    setTugasKamar("");
  }, [status]);

  if (!isOpen) return null;

  // Options mapping based on status
  const getTugasOptions = () => {
    if (status === "sekolah") {
      return [
        { id: "kepala_sekolah", label: "Kepala Sekolah" },
        { id: "wali_kelas", label: "Wali Kelas" },
        { id: "guru_mapel", label: "Guru Mata Pelajaran" },
        { id: "operator", label: "Operator" },
        { id: "tata_usaha", label: "Tata Usaha" },
        { id: "perpustakaan", label: "Perpustakaan" }
      ];
    } else if (status === "pondok") {
      return [
        { id: "guru_pondok", label: "Guru Pondok" },
        { id: "wali_kamar", label: "Wali Kamar" }
      ];
    } else {
      return [
        { id: "yayasan", label: "Yayasan" },
        { id: "pengurus_pondok", label: "Pengurus Pondok" }
      ];
    }
  };

  const handleToggleTugas = (tugasId: string) => {
    if (selectedTugas.includes(tugasId)) {
      if (selectedTugas.length > 1) {
        setSelectedTugas(selectedTugas.filter(t => t !== tugasId));
      }
    } else {
      setSelectedTugas([...selectedTugas, tugasId]);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Ukuran foto maksimal 5 MB.");
      return;
    }

    setIsUploadingPhoto(true);
    setErrorMsg("");

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `guru_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("foto_siswa")
        .upload(fileName, file);

      if (error) {
        // Fallback to base64 if storage policy error
        const reader = new FileReader();
        reader.onloadend = () => {
          setFotoDiri(reader.result as string);
          setIsUploadingPhoto(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("foto_siswa")
        .getPublicUrl(fileName);

      setFotoDiri(publicUrl);
    } catch (err: any) {
      console.warn("Upload error, using base64 preview:", err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoDiri(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const validateStep1 = () => {
    if (!namaLengkap.trim()) {
      setErrorMsg("Harap isi Nama Lengkap!");
      return false;
    }
    if (!username.trim()) {
      setErrorMsg("Harap isi Username ID!");
      return false;
    }
    if (username.trim().length < 3) {
      setErrorMsg("Username minimal 3 karakter!");
      return false;
    }
    if (!password.trim()) {
      setErrorMsg("Harap isi Password!");
      return false;
    }
    if (password.length < 4) {
      setErrorMsg("Password minimal 4 karakter!");
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const validateStep2 = () => {
    if (selectedTugas.length === 0) {
      setErrorMsg("Pilih minimal 1 Tugas / Jabatan!");
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const cleanUsername = username.trim().toLowerCase();
      const cleanNama = namaLengkap.trim();

      // Determine main system role
      let mainRole = "guru_sekolah";
      if (status === "pondok") mainRole = "guru_pondok";
      if (status === "pengurus") mainRole = "pengurus";

      // Join strings
      const tugasJoined = selectedTugas.join(",");
      const kelasSekolahJoined = tugasKelasSekolah.join(", ");
      const kelasPengajianJoined = tugasKelasPengajian.join(", ");

      let lanjutanTugasCombined = "";
      if (tugasMapel) lanjutanTugasCombined += `Mapel: ${tugasMapel}. `;
      if (kelasSekolahJoined) lanjutanTugasCombined += `Kelas Sekolah: ${kelasSekolahJoined}. `;
      if (kelasPengajianJoined) lanjutanTugasCombined += `Kelas Pengajian: ${kelasPengajianJoined}. `;
      if (tugasKamar) lanjutanTugasCombined += `Kamar: ${tugasKamar}. `;

      // Build payload for `pengguna`
      const penggunaPayload: any = {
        username: cleanUsername,
        password: password,
        nama: cleanNama, // legacy column compatibility
        nama_lengkap: cleanNama,
        status: status,
        tugas: tugasJoined,
        lanjutan_tugas: lanjutanTugasCombined.trim(),
        role: mainRole,
        gender: jenisKelamin === "L" ? "L" : "P",
        bagian: status,
        jabatan: tugasJoined,
        tugas_kamar: tugasKamar,
        tugas_kelas_sekolah: kelasSekolahJoined,
        tugas_kelas_pengajian: kelasPengajianJoined,
        tugas_mapel: tugasMapel
      };

      // Build payload for `guru`
      const guruPayload: any = {
        username: cleanUsername,
        nama_lengkap: cleanNama,
        nik: nik.trim() || null,
        jenis_kelamin: jenisKelamin,
        tempat_lahir: tempatLahir.trim() || null,
        tanggal_lahir: tanggalLahir || null,
        alamat_lengkap: alamatLengkap.trim() || null,
        nomor_hp: nomorHp.trim() || null,
        foto_diri: fotoDiri || null,
        // Legacy fallback column aliases
        nama: cleanNama,
        telepon: nomorHp.trim() || null,
        foto: fotoDiri || null,
        jabatan: tugasJoined
      };

      // 1. Save local backup to ensure instant login capability even if DB migration is pending
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      localDetails[cleanUsername] = {
        username: cleanUsername,
        password: password,
        nama_lengkap: cleanNama,
        nama: cleanNama,
        status: status,
        role: mainRole,
        gender: jenisKelamin === "L" ? "L" : "P",
        bagian: status,
        jabatan: tugasJoined,
        tugas_kamar: tugasKamar,
        tugas_kelas_sekolah: kelasSekolahJoined,
        tugas_kelas_pengajian: kelasPengajianJoined,
        tugas_mapel: tugasMapel,
        nik: nik,
        alamat_lengkap: alamatLengkap,
        nomor_hp: nomorHp,
        foto_diri: fotoDiri
      };
      localStorage.setItem("user_additional_details", JSON.stringify(localDetails));

      // 2. Insert into `pengguna` table in Supabase
      const { error: errorPengguna } = await supabase.from("pengguna").insert([penggunaPayload]);
      if (errorPengguna) {
        const errStr = (errorPengguna.message || "") + (errorPengguna.code || "");
        if (errStr.includes("duplicate") || errStr.includes("23505") || errStr.includes("already exists")) {
          setErrorMsg(`Username ID '${cleanUsername}' sudah terdaftar! Silakan gunakan username lain.`);
          setIsLoading(false);
          return;
        }
        console.warn("Insert to pengguna with extra columns failed, retrying basic schema insert:", errorPengguna.message);
        // Fallback insert if columns missing
        const basicPengguna = {
          username: cleanUsername,
          password: password,
          nama: cleanNama,
          role: mainRole,
          gender: jenisKelamin
        };
        const { error: basicErr } = await supabase.from("pengguna").insert([basicPengguna]);
        if (basicErr) {
          const bErrStr = (basicErr.message || "") + (basicErr.code || "");
          if (bErrStr.includes("duplicate") || bErrStr.includes("23505")) {
            setErrorMsg(`Username ID '${cleanUsername}' sudah terdaftar! Silakan gunakan username lain.`);
            setIsLoading(false);
            return;
          }
          console.warn("Basic pengguna insert error:", basicErr.message);
        }
      }

      // 3. Insert into `guru` table in Supabase
      const { error: errorGuru } = await supabase.from("guru").insert([guruPayload]);
      if (errorGuru) {
        console.warn("Insert to guru failed or already exists:", errorGuru.message);
      }

      setSuccessMsg("Pendaftaran Akun & Data Guru Berhasil!");
      setIsLoading(false);

      const dbUserVal = {
        username: cleanUsername,
        role: mainRole,
        name: cleanNama,
        gender: jenisKelamin === "L" ? "L" : "P",
        bagian: status,
        jabatan: tugasJoined,
        tugas_kamar: tugasKamar,
        tugas_kelas_sekolah: kelasSekolahJoined,
        tugas_kelas_pengajian: kelasPengajianJoined,
        tugas_mapel: tugasMapel
      };

      localStorage.setItem("admin_token", "session_token_registered_guru");
      localStorage.setItem("admin_user", JSON.stringify(dbUserVal));

      setTimeout(() => {
        if (onSuccessLogin) {
          onSuccessLogin(dbUserVal);
        }
        onClose();
      }, 1800);

    } catch (err: any) {
      console.error("Registration error:", err);
      setErrorMsg(`Gagal mendaftar: ${err.message || "Terjadi kesalahan koneksi"}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 15 }}
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden my-auto ${
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
              <h3 className="font-extrabold text-base tracking-tight">Pendaftaran Akun & Pendataan Guru</h3>
              <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Registrasi mandiri staf & kelengkapan profil guru.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-200 text-slate-500"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Notice */}
          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center animate-pulse flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: AKUN PENGGUNA */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nama Lengkap Guru / Staf *</label>
                <input
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Misal: Ustadz Ahmad Fauzan, S.Pd."
                  className={`w-full text-xs font-semibold px-4 py-3 rounded-xl border outline-none ${
                    isDarkMode ? "bg-[#080914] border-[#1d2138] text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 focus:border-blue-600"
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Username ID Login *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Misal: ahmad.fauzan"
                  className={`w-full text-xs font-mono font-semibold px-4 py-3 rounded-xl border outline-none ${
                    isDarkMode ? "bg-[#080914] border-[#1d2138] text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 focus:border-blue-600"
                  }`}
                />
                <p className="text-[10px] text-slate-400">Gunakan kombinasi huruf kecil tanpa spasi.</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] font-bold text-blue-500 hover:underline"
                  >
                    {showPassword ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password akun..."
                  className={`w-full text-xs font-mono font-semibold px-4 py-3 rounded-xl border outline-none ${
                    isDarkMode ? "bg-[#080914] border-[#1d2138] text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 focus:border-blue-600"
                  }`}
                />
              </div>
            </motion.div>
          )}

          {/* STEP 2: PENDATAAN ROLE & TUGAS */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              
              {/* 1. Status pilihan awal */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">1. Status Instansi / Divisi Utama *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "sekolah", label: "Sekolah (Formal)" },
                    { id: "pondok", label: "Pondok (Pesantren)" },
                    { id: "pengurus", label: "Pengurus (Yayasan)" }
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setStatus(item.id as any)}
                      className={`py-3 px-3 rounded-2xl text-xs font-extrabold border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1 ${
                        status === item.id
                          ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]"
                          : isDarkMode
                          ? "bg-[#080914] border-[#1d2138] text-slate-300 hover:border-slate-700"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Tugas (Sesuai yang dipilih diawal) (Boleh pilih lebih dari 1) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    2. Tugas / Jabatan ({status.toUpperCase()}) *
                  </label>
                  <span className="text-[10px] text-blue-500 font-extrabold">Boleh pilih &gt; 1 tugas</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl border bg-slate-50/50 dark:bg-[#080914]/50 border-slate-200 dark:border-[#1d2138]">
                  {getTugasOptions().map((opt) => {
                    const isSelected = selectedTugas.includes(opt.id);
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => handleToggleTugas(opt.id)}
                        className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                            : isDarkMode
                            ? "bg-[#111322] border-[#1d2138] text-slate-300 hover:bg-slate-800"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Lanjutan dari tugas (Dropdown / Multi-select) */}
              <div className="space-y-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  3. Lanjutan Detail Tugas (Penugasan Spesifik)
                </label>

                {/* Switchers based on selected tasks */}
                {selectedTugas.includes("guru_mapel") && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/30 space-y-2">
                    <span className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 block">Guru Mata Pelajaran</span>
                    <input
                      type="text"
                      value={tugasMapel}
                      onChange={(e) => setTugasMapel(e.target.value)}
                      placeholder="Ketik Mata Pelajaran (misal: Matematika, Fiqih)..."
                      className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border outline-none ${
                        isDarkMode ? "bg-[#080914] border-[#1d2138] text-white" : "bg-white border-slate-200"
                      }`}
                    />
                  </div>
                )}

                {(selectedTugas.includes("wali_kelas") || selectedTugas.includes("guru_mapel")) && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-blue-600 dark:text-blue-400">Tugas Kelas Sekolah</span>
                      <span className="text-[9px] text-slate-400">Bisa pilih lebih dari satu kelas</span>
                    </div>
                    <MultiSelectTagInput
                      selectedValues={tugasKelasSekolah}
                      onChange={setTugasKelasSekolah}
                      options={optSchoolClasses}
                      placeholder="Pilih kelas sekolah..."
                    />
                  </div>
                )}

                {selectedTugas.includes("guru_pondok") && (
                  <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-purple-600 dark:text-purple-400 block">Guru Pondok (Kelas Pengajian)</span>
                      <span className="text-[9px] text-slate-400">Bisa pilih lebih dari satu kelas</span>
                    </div>
                    <MultiSelectTagInput
                      selectedValues={tugasKelasPengajian}
                      onChange={setTugasKelasPengajian}
                      options={optRecitationClasses}
                      placeholder="Pilih kelas pengajian..."
                    />
                  </div>
                )}

                {selectedTugas.includes("wali_kamar") && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 space-y-2">
                    <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">Wali Kamar (Tugas Kamar Santri)</span>
                    <select
                      value={tugasKamar}
                      onChange={(e) => setTugasKamar(e.target.value)}
                      className={`w-full text-xs font-semibold px-3 py-2.5 rounded-xl border outline-none ${
                        isDarkMode ? "bg-[#080914] border-[#1d2138] text-white" : "bg-white border-slate-200"
                      }`}
                    >
                      <option value="">-- Pilih Kamar Santri --</option>
                      {optRooms.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* STEP 3: KELENGKAPAN DATA GURU */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              
              {/* Profile Photo */}
              <div className="p-4 rounded-2xl border bg-slate-50/50 dark:bg-[#080914]/50 border-slate-200 dark:border-[#1d2138] flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  {isUploadingPhoto ? (
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  ) : fotoDiri ? (
                    <img src={fotoDiri} alt="Foto Profil Guru" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold">Foto Diri (Opsional)</h4>
                  <p className="text-[10px] text-slate-400">Unggah foto profil resmi untuk kartu identitas guru.</p>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="guru-foto-upload-input"
                  />
                  <label
                    htmlFor="guru-foto-upload-input"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-xl cursor-pointer transition-all shadow-sm"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{fotoDiri ? "Ganti Foto" : "Unggah Foto"}</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400">NIK (16 Angka)</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    placeholder="350xxxxxxxxxxxxx"
                    className={`w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border outline-none ${
                      isDarkMode ? "bg-[#080914] border-[#1d2138] text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400">Jenis Kelamin</label>
                  <select
                    value={jenisKelamin}
                    onChange={(e) => setJenisKelamin(e.target.value as any)}
                    className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border outline-none ${
                      isDarkMode ? "bg-[#080914] border-[#1d2138] text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400">Tempat Lahir</label>
                  <input
                    type="text"
                    value={tempatLahir}
                    onChange={(e) => setTempatLahir(e.target.value)}
                    placeholder="Kota kelahiran..."
                    className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border outline-none ${
                      isDarkMode ? "bg-[#080914] border-[#1d2138] text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-slate-400">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={tanggalLahir}
                    onChange={(e) => setTanggalLahir(e.target.value)}
                    className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border outline-none ${
                      isDarkMode ? "bg-[#080914] border-[#1d2138] text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Nomor HP / WhatsApp Active</label>
                <input
                  type="text"
                  value={nomorHp}
                  onChange={(e) => setNomorHp(e.target.value)}
                  placeholder="081234567890"
                  className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border outline-none ${
                    isDarkMode ? "bg-[#080914] border-[#1d2138] text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase text-slate-400">Alamat Lengkap Tempat Tinggal</label>
                <textarea
                  rows={2}
                  value={alamatLengkap}
                  onChange={(e) => setAlamatLengkap(e.target.value)}
                  placeholder="Jalan, RT/RW, Desa, Kecamatan, Kabupaten/Kota..."
                  className={`w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border outline-none ${
                    isDarkMode ? "bg-[#080914] border-[#1d2138] text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

            </motion.div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${
          isDarkMode ? "bg-[#161a2e] border-[#20253f]" : "bg-slate-50 border-slate-100"
        }`}>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isDarkMode ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
              </button>
            )}
          </div>

          <div>
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
              >
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteRegistration}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mendaftarkan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selesaikan Pendaftaran</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
