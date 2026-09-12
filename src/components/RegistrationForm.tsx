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
  students?: SantriData[];
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
  schoolClasses = [],
  students = []
}: RegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<SantriData>(() => {
    if (initialData) {
      return {
        ...initialData,
        nama_lengkap: initialData.nama_lengkap || "",
        nama_panggilan: initialData.nama_panggilan || "",
        nik: initialData.nik || "",
        nisn: initialData.nisn || "",
        npsn: initialData.npsn || "",
        tempat_lahir: initialData.tempat_lahir || "",
        tanggal_lahir: initialData.tanggal_lahir || "",
        alamat: initialData.alamat || "",
        rt: initialData.rt || "",
        rw: initialData.rw || "",
        desa_kelurahan: initialData.desa_kelurahan || "",
        kecamatan: initialData.kecamatan || "",
        kabupaten_kota: initialData.kabupaten_kota || "",
        provinsi: initialData.provinsi || "Jawa Timur",
        nama_ayah: initialData.nama_ayah || "",
        nama_ibu: initialData.nama_ibu || "",
        kelompok_sambung: initialData.kelompok_sambung || "",
        desa_sambung: initialData.desa_sambung || "",
        daerah: initialData.daerah || "",
        status: initialData.status || "Aktif",
        kamar: initialData.kamar || "",
        kelas_pengajian: initialData.kelas_pengajian || "",
        kelas_sekolah: initialData.kelas_sekolah || "",
        jenis_kelamin: initialData.jenis_kelamin || "L",
        no_hp_ortu: initialData.no_hp_ortu || "",
        nfc_id: initialData.nfc_id || "",
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
      status: "Aktif",
      kamar: "",
      kelas_pengajian: "",
      kelas_sekolah: "",
      jenis_kelamin: "L",
      no_hp_ortu: "",
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
      setUploadError(`Gagal mengunggah foto. Pastikan internet stabil dan format file didukung.`);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Real-time Validation Helper
  const validateField = (name: keyof SantriData, value: string, category: string): string => {
    const isRequired = name === "kategori" || name === "jenis_kelamin" || name === "nama_lengkap";
    if (!value) {
      if (isRequired) {
        return "Wajib diisi";
      }
      return "";
    }

    if (name === "nik") {
      if (!/^\d+$/.test(value)) return "NIK harus berupa angka saja";
      if (value.length !== 16) return `NIK harus tepat 16 angka (saat ini ${value.length}/16)`;
    }

    if (name === "rt" || name === "rw") {
      if (!/^\d+$/.test(value)) return "Harus berupa angka";
      if (value.length > 3) return "Maksimal 3 angka";
    }

    if (name === "nisn" && (category === "SMP" || category === "SMA")) {
      if (!/^\d+$/.test(value)) return "NISN harus berupa angka";
    }

    if (name === "npsn" && category === "Reguler") {
      // Automatic generation, no validation on input
      return "";
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
    
    let finalValue = value;
    if ((key === "rt" || key === "rw") && /^\d+$/.test(value) && value.length > 0) {
      finalValue = value.padStart(3, "0");
      setFormData((prev) => ({ ...prev, [key]: finalValue }));
    }

    setTouchStatus((prev) => ({ ...prev, [key]: true }));
    const fieldError = validateField(key, finalValue, formData.kategori);
    setErrors((prev) => ({ ...prev, [key]: fieldError }));
  };

  // Validate current step
  const validateStep = (currentStep: number): boolean => {
    const stepErrors: Record<string, string> = {};
    const touchList: string[] = [];

    if (currentStep === 1) {
      const fields: (keyof SantriData)[] = ["kategori", "nik"];
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 2) {
      const fields: (keyof SantriData)[] = ["jenis_kelamin", "nama_lengkap", "nama_panggilan", "tempat_lahir", "tanggal_lahir"];
      if (formData.kategori === "SMP" || formData.kategori === "SMA") fields.push("nisn");
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 3) {
      const fields: (keyof SantriData)[] = ["nama_ayah", "nama_ibu", "kelompok_sambung", "desa_sambung", "daerah"];
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 4) {
      const padTarget = (val: string) => (val && /^\d+$/.test(val)) ? val.padStart(3, "0") : val;
      const paddedRt = padTarget(formData.rt || "");
      const paddedRw = padTarget(formData.rw || "");
      if (paddedRt !== formData.rt || paddedRw !== formData.rw) {
        setFormData((prev) => ({ ...prev, rt: paddedRt, rw: paddedRw }));
      }
      const fields: (keyof SantriData)[] = ["alamat", "rt", "rw", "desa_kelurahan", "kecamatan", "kabupaten_kota", "provinsi"];
      fields.forEach((f) => {
        const val = f === "rt" ? paddedRt : f === "rw" ? paddedRw : (formData[f] || "") as string;
        const err = validateField(f, val, formData.kategori);
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
    
    const finalFormData = { ...formData };
    
    // Auto-generate a sequential 10-digit identity number as NPSN for Reguler category
    if (finalFormData.kategori === "Reguler" && !finalFormData.npsn) {
      let nextNpsn = 1000000001;
      
      const regulerStudents = students.filter(
        (s) => s.kategori === "Reguler" && s.npsn && /^\d{10}$/.test(s.npsn)
      );
      if (regulerStudents.length > 0) {
        const numericNpsns = regulerStudents
          .map((s) => parseInt(s.npsn || "0", 10))
          .filter((num) => !isNaN(num));
          
        if (numericNpsns.length > 0) {
          const maxNpsn = Math.max(...numericNpsns);
          nextNpsn = maxNpsn + 1;
        }
      } else {
        const countReg = students.filter((s) => s.kategori === "Reguler").length;
        nextNpsn = 1000000001 + countReg;
      }
      
      finalFormData.npsn = String(nextNpsn);
      finalFormData.nisn = "";
    }

    if (!validateStep(1)) { setStep(1); return; }
    if (!validateStep(2)) { setStep(2); return; }
    if (!validateStep(3)) { setStep(3); return; }
    if (!validateStep(4)) { setStep(4); return; }
    
    await onSubmit(finalFormData);
  };

  const steps = [
    { num: 1, name: "Cek Identitas" },
    { num: 2, name: "Data Pribadi" },
    { num: 3, name: "Keluarga" },
    { num: 4, name: "Alamat" },
  ];

  return (
    <div id="registration_form_container" className="space-y-6">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight" id="form-heading">
        {initialData ? `Perbarui Profil: ${initialData.nama_lengkap}` : "Pendaftaran"}
      </h2>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header section with branding and status */}
        <div className="px-6 pt-6 pb-2">
          {/* Progress Tracker (Chevron Style) */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <ul className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {steps.map((s, index) => {
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              
              return (
                <li key={s.num} className="relative flex-1">
                  <button 
                    type="button"
                    onClick={() => {
                      if (s.num < step) {
                        setStep(s.num);
                      } else if (s.num > step) {
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
                    className="flex w-full items-center px-4 py-4 sm:px-6 hover:bg-slate-50 transition-colors focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        isActive 
                          ? "border-blue-600 text-blue-600" 
                          : isCompleted
                          ? "border-slate-300 text-slate-700 bg-slate-50"
                          : "border-slate-300 text-slate-400"
                      }`}>
                        <span className="text-sm font-medium">0{s.num}</span>
                      </div>
                      <span className={`text-sm font-medium ${
                        isActive ? "text-blue-600" : isCompleted ? "text-slate-700" : "text-slate-500"
                      }`}>
                        {s.name}
                      </span>
                    </div>
                  </button>
                  
                  {/* Arrow separator for md screens and up */}
                  {index !== steps.length - 1 ? (
                    <div className="hidden md:block absolute right-0 top-0 h-full w-5" aria-hidden="true">
                      <svg className="h-full w-full text-slate-200" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                        <path d="M0 -2L20 40L0 82" vectorEffect="non-scaling-stroke" stroke="currentcolor" strokeLinejoin="round" strokeWidth="1" />
                      </svg>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      
      <form onSubmit={handleFormSubmit}>
        <div className="p-5 md:p-8">
          <AnimatePresence mode="wait">
          
          {/* STEP 1: CEK IDENTITAS */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 relative">
                  <label className="text-sm font-medium text-slate-700">
                    Jenis Identitas<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none text-slate-800 font-medium">
                      <option value="NIK">NIK</option>
                      <option value="NISN">NISN</option>
                      <option value="NPSN">NPSN</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Nomor Identitas<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nik}
                    onChange={(e) => setFormData(prev => ({ ...prev, nik: e.target.value.replace(/[^0-9]/g, "").slice(0, 16) }))}
                    placeholder="Nomor Identitas"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium"
                  />
                  {formData.nik && formData.nik.length !== 16 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> NIK harus 16 digit.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 relative">
                  <label className="text-sm font-medium text-slate-700">
                    Daftar Sebagai<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.kategori}
                      onChange={(e) => setFormData(prev => ({ ...prev, kategori: e.target.value as any }))}
                      className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none text-slate-800 font-medium"
                    >
                      <option value="" disabled>Pilih salah satu opsi</option>
                      <option value="SMP">Santri SMP</option>
                      <option value="SMA">Santri SMA</option>
                      <option value="Reguler">Santri Reguler (Mahasiswa/Umum)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

{/* STEP 2: DATA PRIBADI */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <h3 className="text-xs font-bold text-sky-600 uppercase border-b border-sky-100 pb-2 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span> Data Pribadi
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
                    <span>NIK (16 Angka)</span>
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
                    Nama Panggilan
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
                      <span>NISN</span>
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
                  <div className="space-y-1 bg-slate-100/60 p-2 text-left rounded-xl border border-slate-200/50 flex flex-col justify-center min-h-[52px]">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                      Nomor Identitas (NPSN)
                    </span>
                    <div className="text-xs font-bold text-sky-700 font-mono mt-0.5 flex flex-wrap items-center gap-1">
                      <span>✨ Otomatis Digenerate</span>
                      <span className="text-[9px] text-slate-600 font-medium">(10 digit berurutan)</span>
                    </div>
                  </div>
                )}

                {/* Tempat Lahir */}
                <div className="space-y-1">
                  <label htmlFor="tempat_lahir" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Tempat Lahir
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
                    Tanggal Lahir
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
                      Nama Lengkap Ayah Kandung
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
                      Nama Lengkap Ibu Kandung
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

                  {/* Nomor WhatsApp Orang Tua */}
                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <label htmlFor="no_hp_ortu" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Nomor WhatsApp Orang Tua (Aktif)
                    </label>
                    <input
                      type="text"
                      id="no_hp_ortu"
                      name="no_hp_ortu"
                      value={formData.no_hp_ortu || ""}
                      onChange={handleChange}
                      placeholder="Contoh: 081234567890"
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Digunakan untuk pengiriman notifikasi/laporan absensi otomatis maupun manual via WhatsApp ke Wali Santri.
                    </p>
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
                      Kelompok Sambung
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
                      Desa Sambung
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
                      Daerah
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

                  {/* Status Selection */}
                  <div className="space-y-1">
                    <label htmlFor="status" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Status Siswa
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status || "Aktif"}
                      onChange={handleChange}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Sakit">Sakit</option>
                      <option value="Pulang">Pulang</option>
                      <option value="Haid">Haid</option>
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
                    ID NFC ini diisikan dengan serial number kartu nfc masing-masing siswa untuk mendukung tap presensi cepat.
                  </p>
                </div>

              </div>
            </motion.div>
          )}

          {/* STEP 4: ADDRESS */}
          {step === 4 && (
            <motion.div
              key="step4"
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
                    Alamat Lengkap (Jalan / Dusun)
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
                    <span>RT</span>
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
                    <span>RW</span>
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
                    Desa / Kelurahan
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
                    Kecamatan
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
                    Kabupaten / Kota
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
                    Provinsi
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
        </div>
      </form>
    </div>
  </div>
  );
}
