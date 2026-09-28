import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle2, Camera, Trash2, User, Phone, Image as ImageIcon, Sparkles } from "lucide-react";
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
}: RegistrationFormProps) {
  // Master opsi kategori yang ada di tabel siswa
  const standardCategories: Array<"SMP" | "SMA" | "Reguler"> = ["SMP", "SMA", "Reguler"];

  const [formData, setFormData] = useState<SantriData>(() => {
    if (initialData) {
      return {
        ...initialData,
        kategori: initialData.kategori || "SMP",
        nama_lengkap: initialData.nama_lengkap || "",
        jenis_kelamin: initialData.jenis_kelamin || "L",
        no_hp_ortu: initialData.no_hp_ortu || "",
        foto: initialData.foto || "",
        status: initialData.status || "Aktif",
      };
    }
    return {
      kategori: "SMP",
      nama_lengkap: "",
      jenis_kelamin: "L",
      no_hp_ortu: "",
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
        kategori: initialData.kategori || "SMP",
        nama_lengkap: initialData.nama_lengkap || "",
        jenis_kelamin: initialData.jenis_kelamin || "L",
        no_hp_ortu: initialData.no_hp_ortu || "",
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

  // Handle Photo Upload ke Supabase Storage (bucket: foto_siswa) dengan fallback DataURL
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
      // 1. Coba upload ke Supabase Storage jika bucket tersedia
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
        // 2. Fallback jika bucket belum ada / RLS: simpan sebagai base64 Data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, foto: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    } catch {
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

    // Validasi field wajib
    if (!formData.nama_lengkap.trim()) {
      setError("Nama lengkap wajib diisi.");
      nameInputRef.current?.focus();
      return;
    }

    if (!formData.jenis_kelamin) {
      setError("Jenis kelamin wajib dipilih.");
      return;
    }

    if (!formData.kategori) {
      setError("Kategori siswa wajib dipilih.");
      return;
    }

    const finalData: SantriData = {
      ...(initialData || {}),
      nama_lengkap: toTitleCase(formData.nama_lengkap.trim()),
      kategori: formData.kategori,
      jenis_kelamin: formData.jenis_kelamin,
      no_hp_ortu: formData.no_hp_ortu?.trim() || "",
      foto: formData.foto || "",
      status: formData.status || "Aktif",
    };

    const result = await onSubmit(finalData, keepOpen);
    if (!result.success) {
      setError(result.error || "Terjadi kesalahan saat menyimpan data.");
    } else {
      if (keepOpen) {
        setSuccessMsg(`Siswa "${finalData.nama_lengkap}" berhasil didaftarkan! Silakan masukkan data siswa berikutnya.`);
        setFormData({
          kategori: formData.kategori,
          nama_lengkap: "",
          jenis_kelamin: "L",
          no_hp_ortu: "",
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
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        id="modal-pendaftaran-siswa"
      >
        {/* HEADER MODAL */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <User className="w-4 h-4" />
              </span>
              <span>{initialData ? "Edit Data Siswa" : "Pendaftaran Siswa Baru"}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Struktur tabel database siswa (Kategori, Nama, Jenis Kelamin, No WA Ortu, Foto)
            </p>
          </div>
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
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 rounded-xl text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2.5 animate-in slide-in-from-top duration-150">
              <span className="text-sm shrink-0 mt-0.5">⚠️</span>
              <p className="leading-relaxed">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-start gap-2 animate-in slide-in-from-top duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{successMsg}</p>
            </div>
          )}
        </div>

        {/* BODY FORM: SESUAI 5 KOLOM DATABASE SISWA */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Baris 1: Kategori * & Jenis Kelamin * */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Kategori */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Kategori <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.kategori}
                onChange={(e) => setFormData(prev => ({ ...prev, kategori: e.target.value as "SMP" | "SMA" | "Reguler" }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
              >
                {standardCategories.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
                {/* Fallback jika kategori sebelumnya di luar opsi standar */}
                {!standardCategories.includes(formData.kategori) && formData.kategori && (
                  <option value={formData.kategori}>
                    {formData.kategori}
                  </option>
                )}
              </select>
            </div>

            {/* 3. Jenis Kelamin (Segmented Button L / P) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Jenis Kelamin <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, jenis_kelamin: "L" }))}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                    formData.jenis_kelamin === "L"
                      ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>Laki-laki (L)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, jenis_kelamin: "P" }))}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                    formData.jenis_kelamin === "P"
                      ? "bg-pink-600 border-pink-600 text-white shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>Perempuan (P)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Baris 2: Nama Lengkap * */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Nama Lengkap <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
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
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          {/* Baris 3: No. WA Orang Tua */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span>No. WhatsApp / HP Orang Tua</span>
              <span className="text-[11px] font-normal text-slate-400">Tersimpan ke no_hp_ortu</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                placeholder="Contoh: 081234567890"
                value={formData.no_hp_ortu || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, no_hp_ortu: e.target.value }))}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
              />
            </div>
          </div>

          {/* Baris 4: Foto Siswa */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span>Foto Siswa</span>
              <span className="text-[11px] font-normal text-slate-400">Tersimpan ke foto</span>
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
                <div className="w-16 h-20 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shrink-0 relative shadow-2xs">
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
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Siap disimpan ke database
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
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/60 hover:bg-blue-50/20 dark:bg-slate-800/30 dark:hover:bg-slate-800/70"
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

        {/* FOOTER MODAL */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
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
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Simpan &amp; Buat Lainnya
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
