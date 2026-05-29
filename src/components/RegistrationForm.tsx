import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, MapPin, Users, HeartHandshake, CheckCircle2, ArrowRight, ArrowLeft, Send, Sparkles, Camera, Upload, X, Loader2 } from "lucide-react";
import { SantriData, formatSantriData, supabase } from "../supabaseClient";

interface RegistrationFormProps {
  onSubmit: (data: SantriData) => Promise<{ success: boolean; error?: string }>;
  isSubmitting: boolean;
  initialData?: SantriData | null;
  onCancel?: () => void;
  rooms?: string[];
  recitationClasses?: string[];
  schoolClasses?: string[];
}

const REGIONS = {
  provinsi: ["Jawa Timur", "Jawa Tengah", "Jawa Barat", "DKI Jakarta", "Banten", "DI Yogyakarta", "Sumatera Utara", "Sumatera Selatan", "Sulawesi Selatan", "Kalimantan Timur", "Lainnya"],
  daerah: ["Kediri", "Surabaya", "Malang", "Jogjakarta", "Solo", "Semarang", "Jakarta", "Bandung", "Banyuwangi", "Jember", "Nganjuk", "Madiun", "Lainnya"]
};

export default function RegistrationForm({ 
  onSubmit, 
  isSubmitting, 
  initialData, 
  onCancel,
  rooms = [],
  recitationClasses = [],
  schoolClasses = []
}: RegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<SantriData>(() => {
    if (initialData) {
      return {
        ...initialData,
        kamar: initialData.kamar || "",
        kelas_pengajian: initialData.kelas_pengajian || "",
        kelas_sekolah: initialData.kelas_sekolah || "",
        jenis_kelamin: initialData.jenis_kelamin || "L",
      };
    }
    return {
      kategori: "SMP",
      nama_lengkap: "",
      nama_panggilan: "",
      nik: "",
      nisn: "",
      npsn: "",
      tempat_lahir: "",
      tanggal_lahir: "",
      alamat: "",
      rt: "",
      rw: "",
      desa_kelurahan: "",
      kecamatan: "",
      kabupaten_kota: "",
      provinsi: "Jawa Timur",
      nama_ayah: "",
      nama_ibu: "",
      kelompok_sambung: "",
      desa_sambung: "",
      daerah: "",
      kamar: "",
      kelas_pengajian: "",
      kelas_sekolah: "",
      jenis_kelamin: "L",
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchStatus, setTouchStatus] = useState<Record<string, boolean>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automatically format all fields to Title Case when entering confirmation step (Step 4)
  React.useEffect(() => {
    if (step === 4) {
      setFormData((prev) => formatSantriData(prev));
    }
  }, [step]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadError("Ukuran foto maksimal 5 MB.");
      return;
    }
    
    if (!file.type.startsWith("image/")) {
      setUploadError("Format file harus berupa gambar (JPEG, PNG).");
      return;
    }

    setIsUploadingPhoto(true);
    setUploadError("");

    try {
      // Create a unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from("foto_siswa")
        .upload(filePath, file);

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("foto_siswa")
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, foto: publicUrl }));
    } catch (err: any) {
      console.error("Error uploading photo:", err);
      // If error is RLS related
      if (err?.message?.includes("row-level security")) {
        setUploadError("Gagal: Kebijakan Keamanan (RLS) pada tabel/bucket belum diatur. Silakan buka menu 'Koneksi Cloud' lalu jalankan SQL untuk Opsi C (RLS).");
      } else {
        setUploadError(`Gagal mengunggah foto. Pastikan internet stabil dan format didukung. (${err?.message || ""})`);
      }
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Real-time Validation Helper
  const validateField = (name: keyof SantriData, value: string, category: string): string => {
    if (!value && name !== "nisn" && name !== "npsn") {
      return "Wajib diisi";
    }

    if (name === "nik") {
      if (!/^\d+$/.test(value)) return "NIK harus berupa angka saja";
      if (value.length !== 16) return `NIK harus tepat 16 angka (saat ini ${value.length}/16)`;
    }

    if (name === "rt" || name === "rw") {
      if (!/^\d+$/.test(value)) return "Harus berupa angka";
      if (value.length !== 3) return `Harus 3 angka (contoh: 003)`;
    }

    if (name === "nisn" && (category === "SMP" || category === "SMA")) {
      if (!value) return "NISN wajib diisi untuk kategori SMP/SMA";
      if (!/^\d+$/.test(value)) return "NISN harus berupa angka";
    }

    if (name === "npsn" && category === "Reguler") {
      if (!value) return "NPSN wajib diisi untuk kategori Reguler";
      if (!/^\d+$/.test(value)) return "NPSN harus berupa angka";
    }

    return "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const key = name as keyof SantriData;

    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      
      // Clear fields based on category switch
      if (key === "kategori") {
        if (value === "Reguler") {
          updated.nisn = "";
        } else {
          updated.npsn = "";
        }
      }
      return updated;
    });

    if (touchStatus[key]) {
      const fieldError = validateField(key, value, formData.kategori);
      setErrors((prev) => ({ ...prev, [key]: fieldError }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const key = name as keyof SantriData;
    setTouchStatus((prev) => ({ ...prev, [key]: true }));
    const fieldError = validateField(key, value, formData.kategori);
    setErrors((prev) => ({ ...prev, [key]: fieldError }));
  };

  // Validate current step
  const validateStep = (currentStep: number): boolean => {
    const stepErrors: Record<string, string> = {};
    const touchList: string[] = [];

    if (currentStep === 1) {
      // Step 1: Personal Data
      const fields: (keyof SantriData)[] = ["kategori", "nama_lengkap", "nama_panggilan", "nik", "tempat_lahir", "tanggal_lahir"];
      if (formData.kategori === "SMP" || formData.kategori === "SMA") {
        fields.push("nisn");
      } else {
        fields.push("npsn");
      }

      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 2) {
      // Step 2: Address Data
      const fields: (keyof SantriData)[] = ["alamat", "rt", "rw", "desa_kelurahan", "kecamatan", "kabupaten_kota", "provinsi"];
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 3) {
      // Step 3: Parents & Connection Address details
      const fields: (keyof SantriData)[] = ["nama_ayah", "nama_ibu", "kelompok_sambung", "desa_sambung", "daerah"];
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    }

    setErrors((prev) => ({ ...prev, ...stepErrors }));
    
    // Mark validated fields as touched for visual feedback
    const nextTouchStatus = { ...touchStatus };
    touchList.forEach((f) => {
      nextTouchStatus[f] = true;
    });
    setTouchStatus(nextTouchStatus);

    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) {
      setStep(3); // Go back to validate parental/connection data
      return;
    }
    
    const isStep1Val = validateStep(1);
    const isStep2Val = validateStep(2);
    
    if (!isStep1Val) {
      setStep(1);
      return;
    }
    if (!isStep2Val) {
      setStep(2);
      return;
    }

    await onSubmit(formData);
  };

  const steps = [
    { num: 1, name: "Data Diri", icon: User },
    { num: 2, name: "Alamat Rumah", icon: MapPin },
    { num: 3, name: "Orang Tua & Sambung", icon: Users },
    { num: 4, name: "Konfirmasi", icon: CheckCircle2 },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="registration_form_container">
      {/* Header section with branding and status */}
      <div className="bg-[#91d1fa] px-5 py-4 text-[#041e49] relative">
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
          <Sparkles size={100} />
        </div>
        <span className="bg-[#041e49]/10 border border-[#041e49]/20 text-[#041e49] text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          {initialData ? "Edit Data Santri" : "Formulir Digital Santri"}
        </span>
        <h2 className="text-base md:text-lg font-bold mt-1 uppercase tracking-tight" id="form-heading">
          {initialData ? `Perbarui Profil: ${initialData.nama_lengkap}` : "Pendaftaran & Input Data Santri Baru"}
        </h2>
        <p className="text-[#041e49]/80 text-[11px] mt-0.5 leading-tight">
          Harap isi informasi di bawah ini dengan lengkap dan benar sesuai KTP, KK, atau akta kelahiran yang sah.
        </p>
 
        {/* Progress Tracker */}
        <div className="grid grid-cols-4 gap-2 mt-4 relative z-10">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  // Only allow jumping back or to reachable steps
                  if (s.num < step) {
                    setStep(s.num);
                  } else if (s.num > step) {
                    // check steps before it
                    let valid = true;
                    for (let check = step; check < s.num; check++) {
                      if (!validateStep(check)) {
                        valid = false;
                        break;
                      }
                    }
                    if (valid) setStep(s.num);
                  }
                }}
                className={`flex flex-col items-center justify-center p-1.5 rounded transition-all duration-200 ${
                  isActive
                    ? "bg-white/40 border border-[#041e49]/20 text-[#041e49] font-bold shadow-sm"
                    : isCompleted
                    ? "text-[#041e49]/80 hover:text-[#041e49]"
                    : "text-[#041e49]/50 hover:text-[#041e49]/70"
                }`}
                id={`step-indicator-${s.num}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] ${isActive ? "bg-[#041e49] text-white font-bold" : isCompleted ? "bg-[#041e49]/40 text-[#041e49]" : "bg-[#041e49]/15 text-[#041e49]/50"}`}>
                    {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : s.num}
                  </span>
                  <span className="hidden md:inline text-[10px] font-medium">{s.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
 
      <form onSubmit={handleFormSubmit} className="p-4 md:p-5" id="santri-registration-form">
        <AnimatePresence mode="wait">
          {/* STEP 1: PERSONAL DETAILS */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <h3 className="text-xs font-bold text-sky-600 uppercase border-b border-sky-100 pb-2 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span> Data Identitas Diri
              </h3>

              {/* Photo Upload Section */}
              <div className="flex flex-col md:flex-row items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="relative w-20 h-20 rounded-full bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                  {isUploadingPhoto ? (
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                  ) : formData.foto ? (
                    <img src={formData.foto} alt="Foto Profil Santri" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-300" />
                  )}
                  {formData.foto && !isUploadingPhoto && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, foto: "" }))}
                      className="absolute bottom-0 right-0 left-0 bg-red-500/80 text-white py-0.5 flex items-center justify-center hover:bg-red-600 transition-colors"
                      title="Hapus Foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 text-center md:text-left flex-1">
                  <h4 className="text-xs font-bold text-slate-700">Foto Profil / Pas Foto (Opsional)</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-sm">
                    Unggah pas foto untuk ID Card &amp; administrasi. Format JPG/PNG (Maks. 5MB).
                  </p>
                  <div className="mt-2 pt-1 inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="upload-foto-btn"
                      disabled={isUploadingPhoto}
                    />
                    <label
                      htmlFor="upload-foto-btn"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded flex-shrink-0 cursor-pointer transition-all ${
                        isUploadingPhoto
                          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-sky-700 shadow-sm"
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {isUploadingPhoto ? "Mengunggah..." : formData.foto ? "Perbarui Foto" : "Pilih Foto"}
                    </label>
                  </div>
                  {uploadError && <p className="text-[10px] text-red-500 font-medium">⚠️ {uploadError}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Kategori */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                    Kategori Pendidikan <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["SMP", "SMA", "Reguler"].map((cat) => (
                      <label
                        key={cat}
                        className={`flex items-center justify-center py-1.5 px-2 rounded border text-xs font-semibold cursor-pointer transition-all duration-150 ${
                          formData.kategori === cat
                            ? "bg-sky-50 border-sky-600 text-sky-700 font-bold"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        id={`category-label-${cat}`}
                      >
                        <input
                          type="radio"
                          name="kategori"
                          value={cat}
                          checked={formData.kategori === cat}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Jenis Kelamin */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                    Jenis Kelamin <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { code: "L", label: "Laki-laki (L)" },
                      { code: "P", label: "Perempuan (P)" }
                    ].map((gender) => (
                      <label
                        key={gender.code}
                        className={`flex items-center justify-center py-1.5 px-2 rounded border text-xs font-semibold cursor-pointer transition-all duration-150 ${
                          formData.jenis_kelamin === gender.code
                            ? "bg-sky-50 border-sky-600 text-sky-700 font-bold"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        id={`gender-label-${gender.code}`}
                      >
                        <input
                          type="radio"
                          name="jenis_kelamin"
                          value={gender.code}
                          checked={formData.jenis_kelamin === gender.code}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        {gender.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* NIK */}
                <div className="space-y-1">
                  <label htmlFor="nik" className="text-[11px] font-semibold text-slate-500 flex justify-between uppercase tracking-wider">
                    <span>NIK (16 Angka) <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    id="nik"
                    name="nik"
                    maxLength={16}
                    value={formData.nik}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="320xxxxxxxxxxxxx"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded font-mono transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.nik && touchStatus.nik
                        ? "border-red-300 bg-red-50/10 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.nik && touchStatus.nik && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.nik}</p>
                  )}
                </div>

                {/* Nama Lengkap */}
                <div className="space-y-1">
                  <label htmlFor="nama_lengkap" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nama_lengkap"
                    name="nama_lengkap"
                    value={formData.nama_lengkap}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Ahmad Fauzan Ramadhan"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.nama_lengkap && touchStatus.nama_lengkap
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.nama_lengkap && touchStatus.nama_lengkap && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.nama_lengkap}</p>
                  )}
                </div>

                {/* Nama Panggilan */}
                <div className="space-y-1">
                  <label htmlFor="nama_panggilan" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Nama Panggilan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nama_panggilan"
                    name="nama_panggilan"
                    value={formData.nama_panggilan}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Ahmad"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.nama_panggilan && touchStatus.nama_panggilan
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.nama_panggilan && touchStatus.nama_panggilan && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.nama_panggilan}</p>
                  )}
                </div>

                {/* NISN / NPSN (Conditional) */}
                {formData.kategori !== "Reguler" ? (
                  <div className="space-y-1">
                    <label htmlFor="nisn" className="text-[11px] font-semibold text-slate-500 flex justify-between uppercase tracking-wider">
                      <span>NISN <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      type="text"
                      id="nisn"
                      name="nisn"
                      value={formData.nisn || ""}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="0087123456"
                      className={`w-full p-2 text-xs bg-slate-50 border rounded font-mono transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        errors.nisn && touchStatus.nisn
                          ? "border-red-300 focus:border-red-500"
                          : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                    {errors.nisn && touchStatus.nisn && (
                      <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.nisn}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label htmlFor="npsn" className="text-[11px] font-semibold text-slate-500 flex justify-between uppercase tracking-wider">
                      <span>NPSN <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      type="text"
                      id="npsn"
                      name="npsn"
                      value={formData.npsn || ""}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="20439481"
                      className={`w-full p-2 text-xs bg-slate-50 border rounded font-mono transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        errors.npsn && touchStatus.npsn
                          ? "border-red-300 focus:border-red-500"
                          : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                    {errors.npsn && touchStatus.npsn && (
                      <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.npsn}</p>
                    )}
                  </div>
                )}

                {/* Tempat Lahir */}
                <div className="space-y-1">
                  <label htmlFor="tempat_lahir" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Tempat Lahir <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="tempat_lahir"
                    name="tempat_lahir"
                    value={formData.tempat_lahir}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Kota Kelahiran"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.tempat_lahir && touchStatus.tempat_lahir
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.tempat_lahir && touchStatus.tempat_lahir && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.tempat_lahir}</p>
                  )}
                </div>

                {/* Tanggal Lahir */}
                <div className="space-y-1">
                  <label htmlFor="tanggal_lahir" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Tanggal Lahir <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="tanggal_lahir"
                    name="tanggal_lahir"
                    value={formData.tanggal_lahir}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.tanggal_lahir && touchStatus.tanggal_lahir
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.tanggal_lahir && touchStatus.tanggal_lahir && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.tanggal_lahir}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: ADDRESS */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h3 className="text-xs font-bold text-sky-600 uppercase border-b border-sky-100 pb-2 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span> Data Alamat Lengkap Asal
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Alamat (Jalan / Dusun) */}
                <div className="md:col-span-3 space-y-1">
                  <label htmlFor="alamat" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Alamat Lengkap (Jalan / Dusun) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="alamat"
                    name="alamat"
                    value={formData.alamat}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Jl. Sunan Ampel No. 45, RT 003 / RW 002"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.alamat && touchStatus.alamat
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.alamat && touchStatus.alamat && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.alamat}</p>
                  )}
                </div>

                {/* RT */}
                <div className="space-y-1">
                  <label htmlFor="rt" className="text-[11px] font-semibold text-slate-500 flex justify-between uppercase tracking-wider">
                    <span>RT <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    id="rt"
                    name="rt"
                    maxLength={3}
                    value={formData.rt}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="003"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded text-center font-mono transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.rt && touchStatus.rt
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.rt && touchStatus.rt && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.rt}</p>
                  )}
                </div>

                {/* RW */}
                <div className="space-y-1">
                  <label htmlFor="rw" className="text-[11px] font-semibold text-slate-500 flex justify-between uppercase tracking-wider">
                    <span>RW <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    id="rw"
                    name="rw"
                    maxLength={3}
                    value={formData.rw}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="001"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded text-center font-mono transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.rw && touchStatus.rw
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.rw && touchStatus.rw && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.rw}</p>
                  )}
                </div>

                {/* Desa / Kelurahan */}
                <div className="space-y-1">
                  <label htmlFor="desa_kelurahan" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Desa / Kelurahan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="desa_kelurahan"
                    name="desa_kelurahan"
                    value={formData.desa_kelurahan}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Gampeng"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.desa_kelurahan && touchStatus.desa_kelurahan
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.desa_kelurahan && touchStatus.desa_kelurahan && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.desa_kelurahan}</p>
                  )}
                </div>

                {/* Kecamatan */}
                <div className="space-y-1">
                  <label htmlFor="kecamatan" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Kecamatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="kecamatan"
                    name="kecamatan"
                    value={formData.kecamatan}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Gampengrejo"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.kecamatan && touchStatus.kecamatan
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.kecamatan && touchStatus.kecamatan && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.kecamatan}</p>
                  )}
                </div>

                {/* Kabupaten / Kota */}
                <div className="space-y-1">
                  <label htmlFor="kabupaten_kota" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Kabupaten / Kota <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="kabupaten_kota"
                    name="kabupaten_kota"
                    value={formData.kabupaten_kota}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Kediri"
                    className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      errors.kabupaten_kota && touchStatus.kabupaten_kota
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.kabupaten_kota && touchStatus.kabupaten_kota && (
                    <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.kabupaten_kota}</p>
                  )}
                </div>

                {/* Provinsi */}
                <div className="space-y-1">
                  <label htmlFor="provinsi" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Provinsi <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="provinsi"
                    name="provinsi"
                    value={formData.provinsi}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full p-2 text-xs bg-slate-50 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    {REGIONS.provinsi.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: PARENTS & CONNECTION ADDRESS */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Parent Data Block */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-sky-600 uppercase border-b border-sky-100 pb-2 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span> Data Orang Tua / Wali
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Nama Ayah */}
                  <div className="space-y-1">
                    <label htmlFor="nama_ayah" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Nama Lengkap Ayah Kandung <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="nama_ayah"
                      name="nama_ayah"
                      value={formData.nama_ayah}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Sastro Wardoyo"
                      className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        errors.nama_ayah && touchStatus.nama_ayah
                          ? "border-red-300 focus:border-red-500"
                          : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                    {errors.nama_ayah && touchStatus.nama_ayah && (
                      <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.nama_ayah}</p>
                    )}
                  </div>

                  {/* Nama Ibu */}
                  <div className="space-y-1">
                    <label htmlFor="nama_ibu" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Nama Lengkap Ibu Kandung <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="nama_ibu"
                      name="nama_ibu"
                      value={formData.nama_ibu}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Siti Rahayu"
                      className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        errors.nama_ibu && touchStatus.nama_ibu
                          ? "border-red-300 focus:border-red-500"
                          : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                    {errors.nama_ibu && touchStatus.nama_ibu && (
                      <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.nama_ibu}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Connection Address Block */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-sky-600 uppercase border-b border-sky-100 pb-2 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span> Data Alamat Sambung & Daerah
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Kelompok Sambung */}
                  <div className="space-y-1">
                    <label htmlFor="kelompok_sambung" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Kelompok Sambung <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="kelompok_sambung"
                      name="kelompok_sambung"
                      value={formData.kelompok_sambung}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Kelompok Gampeng"
                      className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        errors.kelompok_sambung && touchStatus.kelompok_sambung
                          ? "border-red-300 focus:border-red-500"
                          : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                    {errors.kelompok_sambung && touchStatus.kelompok_sambung && (
                      <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.kelompok_sambung}</p>
                    )}
                  </div>

                  {/* Desa Sambung */}
                  <div className="space-y-1">
                    <label htmlFor="desa_sambung" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Desa Sambung <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="desa_sambung"
                      name="desa_sambung"
                      value={formData.desa_sambung}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Desa Gampeng Barat"
                      className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        errors.desa_sambung && touchStatus.desa_sambung
                          ? "border-red-300 focus:border-red-500"
                          : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                    {errors.desa_sambung && touchStatus.desa_sambung && (
                      <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.desa_sambung}</p>
                    )}
                  </div>

                  {/* Daerah */}
                  <div className="space-y-1">
                    <label htmlFor="daerah" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Daerah <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="daerah"
                      name="daerah"
                      value={formData.daerah}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Contoh: Kediri Kota"
                      className={`w-full p-2 text-xs bg-slate-50 border rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        errors.daerah && touchStatus.daerah
                          ? "border-red-300 focus:border-red-500"
                          : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                    {errors.daerah && touchStatus.daerah && (
                      <p className="text-[10px] text-red-500 font-medium">⚠️ {errors.daerah}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Placement & Academic Block */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-bold text-sky-600 uppercase border-b border-sky-100 pb-2 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span> Data Penempatan (Asrama & Pembelajaran)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Kamar Selection */}
                  <div className="space-y-1">
                    <label htmlFor="kamar" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Pilihan Kamar Asrama (Opsional)
                    </label>
                    <select
                      id="kamar"
                      name="kamar"
                      value={formData.kamar || ""}
                      onChange={handleChange}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="">-- Belum Ditentukan --</option>
                      {rooms.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Kelas Pengajian */}
                  <div className="space-y-1">
                    <label htmlFor="kelas_pengajian" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Kelas Pengajian (Opsional)
                    </label>
                    <select
                      id="kelas_pengajian"
                      name="kelas_pengajian"
                      value={formData.kelas_pengajian || ""}
                      onChange={handleChange}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="">-- Belum Ditentukan --</option>
                      {recitationClasses.map((recClass) => (
                        <option key={recClass} value={recClass}>
                          {recClass}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Kelas Sekolah */}
                  <div className="space-y-1">
                    <label htmlFor="kelas_sekolah" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Kelas Sekolah Formal (Opsional)
                    </label>
                    <select
                      id="kelas_sekolah"
                      name="kelas_sekolah"
                      value={formData.kelas_sekolah || ""}
                      onChange={handleChange}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="">-- Belum Ditentukan --</option>
                      {schoolClasses.map((schClass) => (
                        <option key={schClass} value={schClass}>
                          {schClass}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* NFC ID Input */}
                <div className="space-y-1 mt-4">
                  <label htmlFor="nfc_id" className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                    ID Serial Number Kartu NFC Siswa (Membaca kolom nfc_id)
                  </label>
                  <input
                    type="text"
                    id="nfc_id"
                    name="nfc_id"
                    placeholder="Masukkan Serial Number NFC Siswa (contoh: NFC_ID_001)"
                    value={formData.nfc_id || ""}
                    onChange={handleChange}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    ID NFC ini diisikan dengan serial number kartu nfc masing-masing santri untuk mendukung tap presensi cepat.
                  </p>
                </div>

              </div>
            </motion.div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <div className="p-2 bg-sky-50 rounded-lg text-sky-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">Konfirmasi Data Santri</h3>
                  <p className="text-gray-500 text-xs">Periksa kembali data sebelum disimpan ke database</p>
                </div>
              </div>

              {/* Review summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2 scrollbar-thin">
                {/* 1. Data Diri */}
                <div className="bg-sky-50/40 rounded-xl p-4 border border-sky-500/10">
                  <h4 className="text-sm font-bold text-sky-900 flex items-center gap-1.5 mb-3 border-b border-sky-200/30 pb-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    I. IDENTITAS DIRI
                  </h4>
                  <dl className="grid grid-cols-3 gap-y-2 gap-x-2 text-sm text-gray-700">
                    <dt className="text-gray-400 font-medium">Kategori</dt>
                    <dd className="col-span-2 font-semibold text-sky-800 bg-sky-100/50 px-2 py-0.5 rounded w-fit text-xs">{formData.kategori}</dd>

                    <dt className="text-gray-400 font-medium">Gender</dt>
                    <dd className="col-span-2 font-bold text-gray-800">
                      {formData.jenis_kelamin === "P" ? "🚺 Perempuan (P)" : "🚹 Laki-laki (L)"}
                    </dd>

                    <dt className="text-gray-400 font-medium">Nama</dt>
                    <dd className="col-span-2 font-semibold text-gray-900">{formData.nama_lengkap}</dd>

                    <dt className="text-gray-400 font-medium">Panggilan</dt>
                    <dd className="col-span-2">{formData.nama_panggilan}</dd>

                    <dt className="text-gray-400 font-medium">NIK</dt>
                    <dd className="col-span-2 font-mono font-medium tracking-wider">{formData.nik}</dd>

                    {formData.kategori !== "Reguler" ? (
                      <>
                        <dt className="text-gray-400 font-medium">NISN</dt>
                        <dd className="col-span-2 font-mono font-medium">{formData.nisn || "-"}</dd>
                      </>
                    ) : (
                      <>
                        <dt className="text-gray-400 font-medium">NPSN</dt>
                        <dd className="col-span-2 font-mono font-medium">{formData.npsn || "-"}</dd>
                      </>
                    )}

                    <dt className="text-gray-400 font-medium font-sans">Lahir</dt>
                    <dd className="col-span-2">{formData.tempat_lahir}, {formData.tanggal_lahir}</dd>
                  </dl>
                </div>

                {/* 2. Alamat */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3 border-b border-gray-200/50 pb-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    II. ALAMAT ASAL
                  </h4>
                  <dl className="grid grid-cols-3 gap-y-2 gap-x-2 text-sm text-gray-700">
                    <dt className="text-gray-400 font-medium">Alamat</dt>
                    <dd className="col-span-2 italic text-gray-800">"{formData.alamat}"</dd>

                    <dt className="text-gray-400 font-medium font-mono">RT / RW</dt>
                    <dd className="col-span-2 font-mono font-medium">{formData.rt} / {formData.rw}</dd>

                    <dt className="text-gray-400 font-medium">Desa</dt>
                    <dd className="col-span-2">{formData.desa_kelurahan}</dd>

                    <dt className="text-gray-400 font-medium">Kecamatan</dt>
                    <dd className="col-span-2">{formData.kecamatan}</dd>

                    <dt className="text-gray-400 font-medium">Kota/Kab</dt>
                    <dd className="col-span-2">{formData.kabupaten_kota}</dd>

                    <dt className="text-gray-400 font-medium">Provinsi</dt>
                    <dd className="col-span-2">{formData.provinsi}</dd>
                  </dl>
                </div>

                {/* 3. Wali / Orang Tua */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3 border-b border-gray-200/50 pb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    III. ORANG TUA
                  </h4>
                  <dl className="grid grid-cols-3 gap-y-2 gap-x-2 text-sm text-gray-700">
                    <dt className="text-gray-400 font-medium">Ayah</dt>
                    <dd className="col-span-2 font-medium text-gray-900">{formData.nama_ayah}</dd>

                    <dt className="text-gray-400 font-medium">Ibu</dt>
                    <dd className="col-span-2 font-medium text-gray-900">{formData.nama_ibu}</dd>
                  </dl>
                </div>

                {/* 4. Alamat Sambung */}
                <div className="bg-sky-50/40 rounded-xl p-4 border border-sky-500/10">
                  <h4 className="text-sm font-bold text-sky-900 flex items-center gap-1.5 mb-3 border-b border-sky-200/30 pb-2">
                    <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                    IV. ALAMAT SAMBUNG
                  </h4>
                  <dl className="grid grid-cols-3 gap-y-2 gap-x-2 text-sm text-gray-700">
                    <dt className="text-gray-400 font-medium">Kelompok</dt>
                    <dd className="col-span-2 font-medium text-sky-900">{formData.kelompok_sambung}</dd>

                    <dt className="text-gray-400 font-medium">Desa</dt>
                    <dd className="col-span-2">{formData.desa_sambung}</dd>

                    <dt className="text-gray-400 font-medium">Daerah</dt>
                    <dd className="col-span-2 font-bold text-sky-850 bg-sky-100/50 px-2 py-0.5 rounded w-fit text-xs">{formData.daerah}</dd>

                    <dt className="text-slate-400 font-bold text-[10px] uppercase tracking-wider col-span-3 border-t border-slate-150 pt-2 mt-1">Penempatan Asrama & Kelas</dt>
                    
                    <dt className="text-gray-400 font-medium">Kamar</dt>
                    <dd className="col-span-2 font-semibold text-slate-800">{formData.kamar || "Belum Ditentukan"}</dd>

                    <dt className="text-gray-400 font-medium">Ngaji</dt>
                    <dd className="col-span-2 font-semibold text-slate-800">{formData.kelas_pengajian || "Belum Ditentukan"}</dd>

                    <dt className="text-gray-400 font-medium">Sekolah</dt>
                    <dd className="col-span-2 font-semibold text-slate-800">{formData.kelas_sekolah || "Belum Ditentukan"}</dd>

                    <dt className="text-gray-400 font-medium">Kartu NFC ID</dt>
                    <dd className="col-span-2 font-mono text-xs text-blue-700 font-black">{formData.nfc_id || "(Belum Ditentukan / Kosong)"}</dd>
                  </dl>
                </div>
              </div>

              {/* Informative notice */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-250/20 text-xs text-amber-900/80 leading-relaxed">
                📢 <strong>Pernyataan Kebenaran Data:</strong> Dengan menekan tombol Simpan, data di atas akan direkam dalam basis data digital Pondok Pesantren dan akan digunakan untuk kebutuhan administratif pelaporan santri secara resmi.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-100" id="form-actions-row">
          <div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
              >
                Batal
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50"
                id="btn-form-prev"
              >
                <ArrowLeft className="w-4 h-4" /> Kembali
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm px-6 py-2.5 rounded-xl shadow-sm hover:shadow active:scale-98 transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
                id="btn-form-next"
              >
                Lanjutkan <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-sky-600 hover:bg-sky-700 active:bg-sky-850 text-white font-semibold text-sm px-7 py-2.5 rounded-xl shadow-md active:scale-98 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                id="btn-form-submit"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Simpan Ke Database
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
