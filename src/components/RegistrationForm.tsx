import React, { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, Camera, Trash2, Phone, RotateCcw, Send, Layers, User, UserCheck, MapPin, ArrowLeft } from "lucide-react";
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
  const standardCategories: Array<"SMP" | "SMA" | "Reguler"> = ["SMP", "SMA", "Reguler"];

  const [formData, setFormData] = useState<SantriData & { alamat?: string }>(() => {
    if (initialData) {
      return {
        ...initialData,
        kategori: initialData.kategori || "SMP",
        nama_lengkap: initialData.nama_lengkap || "",
        jenis_kelamin: initialData.jenis_kelamin || "L",
        no_hp_ortu: initialData.no_hp_ortu || "",
        foto: initialData.foto || "",
        status: initialData.status || "Aktif",
        alamat: (initialData as any).alamat || "",
      };
    }
    return {
      kategori: "SMP",
      nama_lengkap: "",
      jenis_kelamin: "L",
      no_hp_ortu: "",
      foto: "",
      status: "Aktif",
      alamat: "",
    };
  });

  const [activeCard, setActiveCard] = useState<number>(1);
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
        alamat: (initialData as any).alamat || "",
      });
    }
  }, [initialData]);

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

  const handleReset = () => {
    setFormData({
      kategori: "SMP",
      nama_lengkap: "",
      jenis_kelamin: "L",
      no_hp_ortu: "",
      foto: "",
      status: "Aktif",
      alamat: "",
    });
    setError("");
    setSuccessMsg("");
    setUploadError("");
    setActiveCard(1);
  };

  const handleSave = async () => {
    setError("");
    setSuccessMsg("");

    if (!formData.nama_lengkap.trim()) {
      setError("Nama lengkap santri wajib diisi.");
      setActiveCard(2);
      nameInputRef.current?.focus();
      return;
    }

    if (!formData.jenis_kelamin) {
      setError("Jenis kelamin wajib dipilih.");
      setActiveCard(3);
      return;
    }

    if (!formData.kategori) {
      setError("Kategori pendaftaran wajib dipilih.");
      setActiveCard(1);
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

    const result = await onSubmit(finalData, false);
    if (!result.success) {
      setError(result.error || "Terjadi kesalahan saat menyimpan pendaftaran.");
    } else {
      setSuccessMsg(`Pendaftaran atas nama "${finalData.nama_lengkap}" berhasil dikirim!`);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f0f4f8] py-8 sm:py-12 px-3 sm:px-6 font-sans text-slate-800 flex justify-center items-start">
      {/* STANDALONE FULL PAGE CONTAINER (max-w-2xl ~ 672px) */}
      <div className="w-full max-w-2xl mx-auto space-y-5">
        
        {/* TOMBOL KEMBALI JIKA DIPANGGIL DARI PORTAL */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs cursor-pointer mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>
        )}

        {/* KARTU 1: HEADER UTAMA (AL-MUTTAQIN UNIFIED EMERALD THEME) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
          {/* Top Banner Accent Color: Hijau Al-Muttaqin #059669 */}
          <div className="h-3.5 bg-emerald-600" />
          
          <div className="p-6 sm:p-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Portal Resmi Pendaftaran Al-Muttaqin Madiun
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Pendaftaran Siswa Baru - Al Muttaqin
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed">
              Silakan isi formulir pendaftaran santri baru Al-Muttaqin Madiun di bawah ini secara lengkap dengan data yang benar dan valid.
            </p>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
              <span className="text-rose-600">* Menunjukkan bidang wajib diisi</span>
              {initialData ? (
                <span className="text-emerald-700 font-bold">(Mode Edit Data)</span>
              ) : (
                <span className="text-slate-400 font-medium">Tahun Ajaran 2026/2027</span>
              )}
            </div>
          </div>
        </div>

        {/* FEEDBACK ALERT BANNER */}
        {error && (
          <div className="bg-rose-50 border-l-4 border-l-rose-600 border border-rose-200 rounded-xl p-4 text-xs sm:text-sm font-semibold text-rose-800 flex items-start gap-3 shadow-2xs animate-in slide-in-from-top duration-150">
            <span className="text-base shrink-0 mt-0.5">⚠️</span>
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border-l-4 border-l-emerald-600 border border-emerald-200 rounded-xl p-4 text-xs sm:text-sm font-semibold text-emerald-800 flex items-start gap-3 shadow-2xs animate-in slide-in-from-top duration-150">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Pendaftaran Berhasil!</p>
              <p className="leading-relaxed text-xs">{successMsg}</p>
            </div>
          </div>
        )}

        {/* KARTU 2: KATEGORI PENDAFTARAN */}
        <div 
          onClick={() => setActiveCard(1)}
          className={`bg-white rounded-2xl p-6 border transition-all duration-200 shadow-sm cursor-pointer ${
            activeCard === 1 
              ? "border-l-[5px] border-l-emerald-600 border-slate-300 shadow-md ring-1 ring-emerald-500/10" 
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <label className="block text-sm sm:text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Kategori Pendaftaran</span>
            <span className="text-rose-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-4">Pilih jenjang pendidikan / program santri yang didaftarkan.</p>

          <div className="space-y-2.5">
            {standardCategories.map((kat) => {
              const isSelected = formData.kategori === kat;
              return (
                <label 
                  key={kat}
                  onClick={() => setFormData(prev => ({ ...prev, kategori: kat }))}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? "bg-emerald-50/80 border-emerald-600 text-emerald-950 font-bold shadow-2xs" 
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <input 
                    type="radio" 
                    name="kategori_pendaftaran" 
                    value={kat}
                    checked={isSelected}
                    onChange={() => setFormData(prev => ({ ...prev, kategori: kat }))}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                  />
                  <span className="text-sm">Tingkat {kat}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* KARTU 3: NAMA LENGKAP SANTRI */}
        <div 
          onClick={() => setActiveCard(2)}
          className={`bg-white rounded-2xl p-6 border transition-all duration-200 shadow-sm cursor-pointer ${
            activeCard === 2 
              ? "border-l-[5px] border-l-emerald-600 border-slate-300 shadow-md ring-1 ring-emerald-500/10" 
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <label className="block text-sm sm:text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            <span>Nama Lengkap Santri</span>
            <span className="text-rose-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">Isikan nama lengkap santri sesuai akta kelahiran / ijazah resmi.</p>
          <input
            ref={nameInputRef}
            type="text"
            required
            placeholder="Ketik nama lengkap di sini..."
            value={formData.nama_lengkap}
            onFocus={() => setActiveCard(2)}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, nama_lengkap: e.target.value }));
              if (error) setError("");
            }}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        {/* KARTU 4: JENIS KELAMIN */}
        <div 
          onClick={() => setActiveCard(3)}
          className={`bg-white rounded-2xl p-6 border transition-all duration-200 shadow-sm cursor-pointer ${
            activeCard === 3 
              ? "border-l-[5px] border-l-emerald-600 border-slate-300 shadow-md ring-1 ring-emerald-500/10" 
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <label className="block text-sm sm:text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Jenis Kelamin</span>
            <span className="text-rose-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-4">Pilih jenis kelamin santri untuk penempatan kelas &amp; asrama.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label 
              onClick={() => setFormData(prev => ({ ...prev, jenis_kelamin: "L" }))}
              className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                formData.jenis_kelamin === "L" 
                  ? "bg-emerald-50/80 border-emerald-600 text-emerald-950 font-bold shadow-2xs" 
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <input 
                type="radio" 
                name="jenis_kelamin" 
                value="L"
                checked={formData.jenis_kelamin === "L"}
                onChange={() => setFormData(prev => ({ ...prev, jenis_kelamin: "L" }))}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
              />
              <span className="text-sm">Laki-laki (Siswa / Putra)</span>
            </label>

            <label 
              onClick={() => setFormData(prev => ({ ...prev, jenis_kelamin: "P" }))}
              className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                formData.jenis_kelamin === "P" 
                  ? "bg-emerald-50/80 border-emerald-600 text-emerald-950 font-bold shadow-2xs" 
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <input 
                type="radio" 
                name="jenis_kelamin" 
                value="P"
                checked={formData.jenis_kelamin === "P"}
                onChange={() => setFormData(prev => ({ ...prev, jenis_kelamin: "P" }))}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
              />
              <span className="text-sm">Perempuan (Siswi / Putri)</span>
            </label>
          </div>
        </div>

        {/* KARTU 5: NOMOR WA ORANG TUA / WALI */}
        <div 
          onClick={() => setActiveCard(4)}
          className={`bg-white rounded-2xl p-6 border transition-all duration-200 shadow-sm cursor-pointer ${
            activeCard === 4 
              ? "border-l-[5px] border-l-emerald-600 border-slate-300 shadow-md ring-1 ring-emerald-500/10" 
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <label className="block text-sm sm:text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>Nomor WhatsApp Orang Tua / Wali</span>
            <span className="text-rose-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">Nomor WhatsApp aktif untuk pengiriman laporan absensi &amp; informasi pondok.</p>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600 font-bold">
              💬
            </div>
            <input
              type="tel"
              placeholder="Misal: 081234567890"
              value={formData.no_hp_ortu || ""}
              onFocus={() => setActiveCard(4)}
              onChange={(e) => setFormData(prev => ({ ...prev, no_hp_ortu: e.target.value }))}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
            />
          </div>
        </div>

        {/* KARTU 6: ALAMAT LENGKAP SANTRI */}
        <div 
          onClick={() => setActiveCard(6)}
          className={`bg-white rounded-2xl p-6 border transition-all duration-200 shadow-sm cursor-pointer ${
            activeCard === 6 
              ? "border-l-[5px] border-l-emerald-600 border-slate-300 shadow-md ring-1 ring-emerald-500/10" 
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <label className="block text-sm sm:text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Alamat Lengkap Domisili</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">Isikan alamat domisili orang tua / wali santri secara lengkap (RT/RW, Desa, Kec., Kab/Kota).</p>
          <textarea
            rows={3}
            placeholder="Ketik alamat domisili lengkap di sini..."
            value={formData.alamat || ""}
            onFocus={() => setActiveCard(6)}
            onChange={(e) => setFormData(prev => ({ ...prev, alamat: e.target.value }))}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
          />
        </div>

        {/* KARTU 7: UNGGAH FOTO SANTRI */}
        <div 
          onClick={() => setActiveCard(5)}
          className={`bg-white rounded-2xl p-6 border transition-all duration-200 shadow-sm cursor-pointer ${
            activeCard === 5 
              ? "border-l-[5px] border-l-emerald-600 border-slate-300 shadow-md ring-1 ring-emerald-500/10" 
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <label className="block text-sm sm:text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>Unggah Pas Foto Santri</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">Pas foto formal terbaru santri (Format JPG, PNG, WebP maks 5MB).</p>

          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*"
            className="hidden" 
            onChange={handlePhotoUpload}
          />

          {formData.foto ? (
            <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="w-20 h-24 rounded-xl overflow-hidden border border-slate-300 bg-white shrink-0 relative shadow-sm">
                <img 
                  src={formData.foto} 
                  alt="Pas Foto Santri" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">Pas Foto Santri Terlampir</p>
                <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Foto siap digunakan
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Ganti Foto
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Foto
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50 hover:bg-emerald-50/20"
            >
              {isUploadingPhoto ? (
                <div className="flex flex-col items-center py-2">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
                  <span className="text-xs font-bold text-slate-700">Mengunggah pas foto...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 font-bold text-xl">
                    📷
                  </div>
                  <p className="text-sm font-bold text-slate-800">Klik di sini untuk memilih Pas Foto</p>
                  <p className="text-xs text-slate-400 mt-1">Format JPG, PNG, atau WebP (Maksimal 5MB)</p>
                </div>
              )}
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-rose-600 font-semibold mt-2">
              {uploadError}
            </p>
          )}
        </div>

        {/* FOOTER TOMBOL AKSI & INTERAKSI */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Formulir</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengirim Pendaftaran...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Kirim Pendaftaran</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}


