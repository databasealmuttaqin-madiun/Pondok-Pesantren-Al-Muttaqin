import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle2, Upload, Camera, Trash2, Building2, User, Phone, Calendar, FileText, Image as ImageIcon } from "lucide-react";
import { SantriData, toTitleCase, supabase } from "../supabaseClient";

interface RegistrationFormProps {
  onSubmit: (data: SantriData, keepOpen?: boolean) => Promise<{ success: boolean; error?: string }>;
  isSubmitting: boolean;
  initialData?: SantriData | null;
  onCancel?: () => void;
  rooms?: string[];
  recitationClasses?: string[];
  schoolClasses?: string[];
  students?: SantriData[];
}

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
  // Default values for options
  const defaultSchoolClasses = schoolClasses.length > 0 
    ? schoolClasses 
    : ["Kelas 7A", "Kelas 7B", "Kelas 8A", "Kelas 8B", "Kelas 9A", "Kelas 9B", "Kelas 10", "Kelas 11", "Kelas 12"];

  const defaultRooms = rooms.length > 0
    ? rooms
    : ["Abu Bakar", "Umar", "Utsman", "Ali", "Khadijah", "Aisyah", "Fathimah"];

  const [formData, setFormData] = useState<SantriData>(() => {
    if (initialData) {
      return {
        ...initialData,
        nama_lengkap: initialData.nama_lengkap || "",
        jenis_kelamin: initialData.jenis_kelamin || "L",
        nisn: initialData.nisn || "",
        nik: initialData.nik || "",
        tempat_lahir: initialData.tempat_lahir || "",
        tanggal_lahir: initialData.tanggal_lahir || "",
        no_hp: initialData.no_hp || "",
        nama_ayah: initialData.nama_ayah || "",
        no_hp_ayah: initialData.no_hp_ayah || "",
        nama_ibu: initialData.nama_ibu || "",
        no_hp_ibu: initialData.no_hp_ibu || "",
        kategori: initialData.kategori || "SMP",
        kelas_sekolah: initialData.kelas_sekolah || defaultSchoolClasses[0],
        status_asrama: initialData.status_asrama || (initialData.kamar ? "Asrama" : "Non-Asrama"),
        kamar: initialData.kamar || "",
        alamat: initialData.alamat || "",
        foto: initialData.foto || "",
        status: initialData.status || "Aktif",
      };
    }
    return {
      nama_lengkap: "",
      jenis_kelamin: "L",
      nisn: "",
      nik: "",
      tempat_lahir: "",
      tanggal_lahir: "",
      no_hp: "",
      nama_ayah: "",
      no_hp_ayah: "",
      nama_ibu: "",
      no_hp_ibu: "",
      kategori: "SMP",
      kelas_sekolah: defaultSchoolClasses[0],
      status_asrama: "Asrama",
      kamar: defaultRooms[0] || "",
      alamat: "",
      foto: "",
      status: "Aktif",
    };
  });

  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        nama_lengkap: initialData.nama_lengkap || "",
        jenis_kelamin: initialData.jenis_kelamin || "L",
        nisn: initialData.nisn || "",
        nik: initialData.nik || "",
        tempat_lahir: initialData.tempat_lahir || "",
        tanggal_lahir: initialData.tanggal_lahir || "",
        no_hp: initialData.no_hp || "",
        nama_ayah: initialData.nama_ayah || "",
        no_hp_ayah: initialData.no_hp_ayah || "",
        nama_ibu: initialData.nama_ibu || "",
        no_hp_ibu: initialData.no_hp_ibu || "",
        kategori: initialData.kategori || "SMP",
        kelas_sekolah: initialData.kelas_sekolah || defaultSchoolClasses[0],
        status_asrama: initialData.status_asrama || (initialData.kamar ? "Asrama" : "Non-Asrama"),
        kamar: initialData.kamar || "",
        alamat: initialData.alamat || "",
        foto: initialData.foto || "",
        status: initialData.status || "Aktif",
      });
    }
  }, [initialData]);

  useEffect(() => {
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  }, []);

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 5 MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setUploadError("Format file harus berupa gambar (JPG, PNG, WebP).");
      return;
    }

    setIsUploadingPhoto(true);
    setUploadError("");

    try {
      // 1. Try uploading to Supabase Storage if available
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("foto_siswa")
        .upload(fileName, file);

      if (!uploadErr && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from("foto_siswa")
          .getPublicUrl(fileName);
        setFormData(prev => ({ ...prev, foto: publicUrl }));
      } else {
        // 2. Fallback to base64 Data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, foto: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, foto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, foto: "" }));
    setUploadError("");
  };

  const handleSave = async (keepOpen = false) => {
    setError("");
    setSuccessMsg("");

    // Validations sesuai field wajib
    if (!formData.nama_lengkap.trim()) {
      setError("Nama lengkap wajib diisi.");
      nameInputRef.current?.focus();
      return;
    }

    if (!formData.jenis_kelamin) {
      setError("Jenis kelamin wajib dipilih.");
      return;
    }

    const finalData: SantriData = {
      ...formData,
      nama_lengkap: toTitleCase(formData.nama_lengkap.trim()),
      nisn: formData.nisn?.trim() || "",
      nik: formData.nik?.trim() || "",
      tempat_lahir: formData.tempat_lahir ? toTitleCase(formData.tempat_lahir.trim()) : "",
      tanggal_lahir: formData.tanggal_lahir?.trim() || "",
      nama_ayah: formData.nama_ayah ? toTitleCase(formData.nama_ayah.trim()) : "",
      nama_ibu: formData.nama_ibu ? toTitleCase(formData.nama_ibu.trim()) : "",
      alamat: formData.alamat?.trim() || "",
      kamar: formData.status_asrama === "Non-Asrama" ? "" : (formData.kamar || defaultRooms[0] || ""),
      no_hp_ortu: formData.no_hp_ayah || formData.no_hp_ibu || formData.no_hp || "",
    };

    const result = await onSubmit(finalData, keepOpen);
    if (!result.success) {
      setError(result.error || "Terjadi kesalahan saat menyimpan data.");
    } else {
      if (keepOpen) {
        setSuccessMsg(`Siswa "${finalData.nama_lengkap}" berhasil didaftarkan! Silakan masukkan siswa berikutnya.`);
        setFormData({
          nama_lengkap: "",
          jenis_kelamin: "L",
          nisn: "",
          nik: "",
          tempat_lahir: "",
          tanggal_lahir: "",
          no_hp: "",
          nama_ayah: "",
          no_hp_ayah: "",
          nama_ibu: "",
          no_hp_ibu: "",
          kategori: formData.kategori,
          kelas_sekolah: formData.kelas_sekolah,
          status_asrama: formData.status_asrama,
          kamar: formData.kamar,
          alamat: "",
          foto: "",
          status: "Aktif",
        });
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && onCancel && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        id="modal-pendaftaran-siswa"
      >
        {/* 1. HEADER MODAL: Latar putih bersih, Judul kiri atas font bold slate, Tombol 'X' kanan atas */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
            {initialData ? "Edit Data Siswa" : "Pendaftaran Siswa Baru"}
          </h3>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              title="Tutup Modal"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Notifikasi / Feedback Banner */}
        <div className="px-6 pt-4 empty:hidden space-y-3 shrink-0">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 rounded-xl text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2 animate-in slide-in-from-top duration-150">
              <span className="text-sm">⚠️</span>
              <p>{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in slide-in-from-top duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p>{successMsg}</p>
            </div>
          )}
        </div>

        {/* 2 & 3. LAYOUT GRID & INPUT FIELD STYLE: 2 Kolom rapi sesuai format form izin sambang */}
        <div className="p-6 space-y-4.5 overflow-y-auto flex-1">
          {/* Baris 1: Nama Lengkap * | Jenis Kelamin * (Segmented Button) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                placeholder="Contoh: Muhammad Fatih"
                value={formData.nama_lengkap}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, nama_lengkap: e.target.value }));
                  if (error) setError("");
                }}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Jenis Kelamin: Segmented Button / Radio Toggle Card */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Jenis Kelamin <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, jenis_kelamin: "L" }))}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                    formData.jenis_kelamin === "L"
                      ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-300 ring-1 ring-blue-500 shadow-2xs"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750"
                  }`}
                >
                  <span>Laki-laki</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, jenis_kelamin: "P" }))}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                    formData.jenis_kelamin === "P"
                      ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-300 ring-1 ring-blue-500 shadow-2xs"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750"
                  }`}
                >
                  <span>Perempuan</span>
                </button>
              </div>
            </div>
          </div>

          {/* Baris 2: Tempat Lahir | Tanggal Lahir */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Tempat Lahir
              </label>
              <input
                type="text"
                placeholder="Contoh: Kediri / Surabaya"
                value={formData.tempat_lahir || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, tempat_lahir: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Tanggal Lahir
              </label>
              <input
                type="date"
                value={formData.tanggal_lahir || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, tanggal_lahir: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Baris 4: No. WhatsApp / HP Siswa | Nama Ayah */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                No. WhatsApp / HP Siswa
              </label>
              <input
                type="tel"
                placeholder="Contoh: 081234567890"
                value={formData.no_hp || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, no_hp: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Nama Ayah
              </label>
              <input
                type="text"
                placeholder="Nama lengkap ayah / wali"
                value={formData.nama_ayah || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, nama_ayah: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Baris 5: No. WhatsApp Ayah | Nama Ibu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                No. WhatsApp Ayah
              </label>
              <input
                type="tel"
                placeholder="Contoh: 081234567890"
                value={formData.no_hp_ayah || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, no_hp_ayah: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Nama Ibu
              </label>
              <input
                type="text"
                placeholder="Nama lengkap ibu kandung"
                value={formData.nama_ibu || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, nama_ibu: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Baris 6: No. WhatsApp Ibu | Jenjang Sekolah */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                No. WhatsApp Ibu
              </label>
              <input
                type="tel"
                placeholder="Contoh: 081234567890"
                value={formData.no_hp_ibu || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, no_hp_ibu: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Jenjang Sekolah <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.kategori}
                onChange={(e) => setFormData(prev => ({ ...prev, kategori: e.target.value as "SMP" | "SMA" | "Reguler" }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
                <option value="SMK">SMK</option>
                <option value="MTs">MTs</option>
                <option value="MA">MA</option>
                <option value="Reguler">Reguler / Pondok</option>
              </select>
            </div>
          </div>

          {/* Baris 7: Kelas Sekolah | Status Asrama */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Kelas Sekolah
              </label>
              <select
                value={formData.kelas_sekolah || defaultSchoolClasses[0]}
                onChange={(e) => setFormData(prev => ({ ...prev, kelas_sekolah: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {defaultSchoolClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Status Asrama
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.status_asrama || "Asrama"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      status_asrama: val,
                      kamar: val === "Non-Asrama" ? "" : (prev.kamar || defaultRooms[0] || "")
                    }));
                  }}
                  className="w-1/2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                >
                  <option value="Asrama">Asrama</option>
                  <option value="Non-Asrama">Non-Asrama</option>
                </select>

                {formData.status_asrama !== "Non-Asrama" && (
                  <select
                    value={formData.kamar || defaultRooms[0]}
                    onChange={(e) => setFormData(prev => ({ ...prev, kamar: e.target.value }))}
                    className="w-1/2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                    title="Pilih Kamar Asrama"
                  >
                    {defaultRooms.map((rm) => (
                      <option key={rm} value={rm}>
                        Kamar {rm}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Alamat Lengkap (Textarea span-2 kolom penuh) */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Alamat Lengkap
            </label>
            <textarea
              rows={3}
              placeholder="Contoh: Jl. Merpati No. 15, RT 03/RW 02, Ds. Sukomoro, Kec. Gurah, Kab. Kediri"
              value={formData.alamat || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, alamat: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
            />
          </div>

          {/* Pas Foto Siswa / Bukti Dokumen (Unggah foto / file pendukung) */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Pas Foto Siswa / Dokumen Pendukung
            </label>
            
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*"
              className="hidden" 
              onChange={handlePhotoUpload}
            />

            {formData.foto ? (
              <div className="flex items-center gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="w-16 h-20 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shrink-0 relative group">
                  <img 
                    src={formData.foto} 
                    alt="Foto Siswa" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    Pas Foto Siswa Terlampir
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    ✓ Siap disimpan ke data siswa
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                    >
                      Ganti Foto
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-blue-50/20 dark:bg-slate-800/30 dark:hover:bg-slate-800/70"
              >
                {isUploadingPhoto ? (
                  <div className="flex flex-col items-center py-2">
                    <Loader2 className="w-7 h-7 text-blue-600 animate-spin mb-1.5" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mengunggah pas foto...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-1">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                      <Camera className="w-5 h-5" />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Klik untuk unggah Pas Foto Siswa
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Format JPG, PNG, atau WebP (Maksimal 5MB)
                    </p>
                  </div>
                )}
              </div>
            )}

            {uploadError && (
              <p className="text-xs text-rose-500 font-medium mt-1.5">
                {uploadError}
              </p>
            )}
          </div>
        </div>

        {/* 4. FOOTER: Tombol "Batal" (putih/abu-abu) dan Tombol "Simpan / Daftarkan Siswa" (biru primer) */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {!initialData && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                Simpan & Buat Lainnya
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>{initialData ? "Simpan Perubahan" : "Simpan / Daftarkan Siswa"}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
