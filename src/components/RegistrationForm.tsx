import React, { useState } from "react";
import { User, Sparkles, Send, X, Loader2 } from "lucide-react";
import { SantriData, toTitleCase } from "../supabaseClient";

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

export default function RegistrationForm({ 
  onSubmit, 
  isSubmitting, 
  initialData, 
  onCancel
}: RegistrationFormProps) {
  const [formData, setFormData] = useState<SantriData>(() => {
    if (initialData) {
      return {
        ...initialData,
        nama_lengkap: initialData.nama_lengkap || "",
        kategori: initialData.kategori || "SMP",
        jenis_kelamin: initialData.jenis_kelamin || "L",
        status: initialData.status || "Aktif",
      };
    }
    return {
      nama_lengkap: "",
      kategori: "SMP",
      jenis_kelamin: "L",
      status: "Aktif",
    };
  });
  
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_lengkap.trim()) {
      setError("Nama lengkap harus diisi");
      return;
    }
    
    // Ensure title case
    const finalData = {
      ...formData,
      nama_lengkap: toTitleCase(formData.nama_lengkap),
    };
    
    const result = await onSubmit(finalData);
    if (!result.success) {
      setError(result.error || "Terjadi kesalahan saat menyimpan data");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white flex flex-col relative shrink-0">
        {onCancel && (
          <button 
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
            <User className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Data Siswa</h2>
        </div>
        <p className="text-blue-100 mt-1 max-w-md text-sm">
          {initialData ? "Perbarui informasi siswa." : "Masukkan informasi siswa baru."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
        {error && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium flex items-start gap-2">
            <span className="shrink-0">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Masukkan nama lengkap siswa..."
              value={formData.nama_lengkap}
              onChange={(e) => setFormData(prev => ({ ...prev, nama_lengkap: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Jenis Kelamin <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.jenis_kelamin === 'L' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <input
                    type="radio"
                    name="jenis_kelamin"
                    className="sr-only"
                    checked={formData.jenis_kelamin === 'L'}
                    onChange={() => setFormData(prev => ({ ...prev, jenis_kelamin: 'L' }))}
                  />
                  <span className="font-medium text-sm">Laki-laki</span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.jenis_kelamin === 'P' ? 'bg-pink-50 border-pink-200 text-pink-700 dark:bg-pink-900/20 dark:border-pink-800' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <input
                    type="radio"
                    name="jenis_kelamin"
                    className="sr-only"
                    checked={formData.jenis_kelamin === 'P'}
                    onChange={() => setFormData(prev => ({ ...prev, jenis_kelamin: 'P' }))}
                  />
                  <span className="font-medium text-sm">Perempuan</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                value={formData.kategori}
                onChange={(e) => setFormData(prev => ({ ...prev, kategori: e.target.value as "SMP" | "SMA" | "Reguler" }))}
              >
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
                <option value="Reguler">Reguler</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex-1"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 shadow-sm shadow-blue-200 dark:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Simpan Data</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
