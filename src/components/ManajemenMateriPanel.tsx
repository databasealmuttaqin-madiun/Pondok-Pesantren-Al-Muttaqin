import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { 
  BookOpen, 
  Book, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  X, 
  Save, 
  BookMarked, 
  Layers, 
  Hash, 
  AlignLeft, 
  FileText, 
  Info, 
  Copy, 
  Check, 
  Database,
  Sparkles
} from "lucide-react";
import { showSuccess, showError, showWarning, showToast, showDeleteConfirm } from "../utils/sweetalert";

// Master Kategori Al-Qur'an Interface
export interface QuranKategori {
  id: number;
  nama_kategori: string;
  hal_mulai: number;
  hal_selesai: number;
  total_hal: number;
  cakupan_surat?: string;
  created_at?: string;
}

// Master Kitab Himpunan / Hadits Interface
export interface HaditsKitab {
  id: number;
  urutan: number;
  nama_kitab: string;
  total_hal: number;
  default_max_baris: number;
  created_at?: string;
}

// Default Seed untuk Al-Qur'an (Cepatan & Lambatan)
const DEFAULT_QURAN_DATA: QuranKategori[] = [
  {
    id: 1,
    nama_kategori: "Al Quran Cepatan",
    hal_mulai: 1,
    hal_selesai: 341,
    total_hal: 341,
    cakupan_surat: "Surat Al-Fatihah s/d Surat Al-Kahf / Maryam",
  },
  {
    id: 2,
    nama_kategori: "Al Quran Lambatan",
    hal_mulai: 342,
    hal_selesai: 604,
    total_hal: 263,
    cakupan_surat: "Surat Al-Hajj s/d Surat An-Nas",
  },
];

interface ManajemenMateriPanelProps {
  currentUserRole?: string;
  onTriggerNotification?: (message: string, type: "success" | "error" | "warning") => void;
}

export default function ManajemenMateriPanel({ currentUserRole = "viewer", onTriggerNotification }: ManajemenMateriPanelProps) {
  const [activeTab, setActiveTab] = useState<"alquran" | "himpunan">("alquran");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Data States
  const [quranList, setQuranList] = useState<QuranKategori[]>(DEFAULT_QURAN_DATA);
  const [haditsList, setHaditsList] = useState<HaditsKitab[]>([]);
  const [hasCustomDbTable, setHasCustomDbTable] = useState<boolean | null>(null);

  // Modal State Hadits
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHadits, setEditingHadits] = useState<HaditsKitab | null>(null);
  
  // Form State Hadits
  const [formUrutan, setFormUrutan] = useState<number>(1);
  const [formNamaKitab, setFormNamaKitab] = useState<string>("");
  const [formTotalHal, setFormTotalHal] = useState<number>(40);
  const [formDefaultMaxBaris, setFormDefaultMaxBaris] = useState<number>(18);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State Edit Al-Qur'an
  const [isQuranModalOpen, setIsQuranModalOpen] = useState(false);
  const [editingQuran, setEditingQuran] = useState<QuranKategori | null>(null);
  const [formQuranNama, setFormQuranNama] = useState("");
  const [formQuranHalMulai, setFormQuranHalMulai] = useState(1);
  const [formQuranHalSelesai, setFormQuranHalSelesai] = useState(341);
  const [formQuranTotalHal, setFormQuranTotalHal] = useState(341);
  const [formQuranCakupan, setFormQuranCakupan] = useState("");

  // Modal SQL Schema Info
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const isAdmin = currentUserRole.toLowerCase().includes("admin") || 
                  currentUserRole.toLowerCase().includes("pengurus") || 
                  currentUserRole.toLowerCase().includes("guru");

  // Load Data dari Supabase (dengan fallback ke tabel materi_pengajian / localStorage)
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Master Al-Qur'an
      let quranLoaded: QuranKategori[] = [];
      try {
        const { data: qData, error: qErr } = await supabase
          .from("master_quran_kategori")
          .select("*")
          .order("hal_mulai", { ascending: true });

        if (!qErr && qData && qData.length > 0) {
          quranLoaded = qData;
          setHasCustomDbTable(true);
        }
      } catch {
        // Table doesn't exist yet in Supabase
      }

      if (quranLoaded.length === 0) {
        // Cek localStorage
        const cachedQuran = localStorage.getItem("master_quran_kategori_data");
        if (cachedQuran) {
          try {
            quranLoaded = JSON.parse(cachedQuran);
          } catch {
            quranLoaded = DEFAULT_QURAN_DATA;
          }
        } else {
          quranLoaded = DEFAULT_QURAN_DATA;
        }
      }
      setQuranList(quranLoaded);

      // 2. Fetch Master Hadits / Himpunan
      let haditsLoaded: HaditsKitab[] = [];
      let loadedFromNewTable = false;
      try {
        const { data: hData, error: hErr } = await supabase
          .from("master_hadits_kitab")
          .select("*")
          .order("urutan", { ascending: true });

        if (!hErr && hData && hData.length > 0) {
          haditsLoaded = hData;
          loadedFromNewTable = true;
          setHasCustomDbTable(true);
        }
      } catch {
        // Table doesn't exist yet in Supabase
      }

      // Jika tabel master_hadits_kitab belum ada atau kosong, coba ambil dari materi_pengajian (kelompok: himpunan)
      if (!loadedFromNewTable) {
        try {
          const { data: mpData, error: mpErr } = await supabase
            .from("materi_pengajian")
            .select("*")
            .eq("kelompok", "himpunan")
            .order("urutan", { ascending: true });

          if (!mpErr && mpData && mpData.length > 0) {
            haditsLoaded = mpData.map((item) => ({
              id: item.id,
              urutan: item.urutan || 1,
              nama_kitab: item.nama_materi,
              total_hal: item.jumlah_halaman || 40,
              default_max_baris: 18,
              created_at: item.created_at,
            }));
          }
        } catch (mpError) {
          console.warn("Fallback materi_pengajian error:", mpError);
        }

        // Cek juga localStorage fallback
        const localHadits = localStorage.getItem("master_hadits_kitab_data");
        if (localHadits && haditsLoaded.length === 0) {
          try {
            haditsLoaded = JSON.parse(localHadits);
          } catch (e) {
            console.error(e);
          }
        }
      }

      setHaditsList(haditsLoaded);
    } catch (err: any) {
      console.error("Gagal memuat master materi:", err);
      if (onTriggerNotification) {
        onTriggerNotification("Gagal memuat data master materi: " + err.message, "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handler Open Modal Tambah/Edit Hadits
  const handleOpenHaditsModal = (item?: HaditsKitab) => {
    if (item) {
      setEditingHadits(item);
      setFormUrutan(item.urutan);
      setFormNamaKitab(item.nama_kitab);
      setFormTotalHal(item.total_hal);
      setFormDefaultMaxBaris(item.default_max_baris || 18);
    } else {
      setEditingHadits(null);
      // Auto sequence urutan
      const maxUrutan = haditsList.length > 0 ? Math.max(...haditsList.map((h) => h.urutan)) : 0;
      setFormUrutan(maxUrutan + 1);
      setFormNamaKitab("");
      setFormTotalHal(40);
      setFormDefaultMaxBaris(18);
    }
    setIsModalOpen(true);
  };

  // Handler Simpan Kitab Hadits (Tambah / Edit)
  const handleSaveHadits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaKitab.trim()) {
      showWarning("Nama Kitab Diperlukan", "Nama Kitab / Himpunan wajib diisi!");
      return;
    }
    if (formTotalHal <= 0) {
      showWarning("Jumlah Halaman Invalid", "Jumlah halaman harus lebih dari 0!");
      return;
    }
    if (formDefaultMaxBaris <= 0) {
      showWarning("Standar Baris Invalid", "Rata-rata baris per halaman harus lebih dari 0!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadNew = {
        urutan: formUrutan,
        nama_kitab: formNamaKitab.trim(),
        total_hal: formTotalHal,
        default_max_baris: formDefaultMaxBaris,
      };

      let savedToDb = false;

      if (editingHadits) {
        // Coba update ke master_hadits_kitab
        try {
          const { error: hErr } = await supabase
            .from("master_hadits_kitab")
            .update(payloadNew)
            .eq("id", editingHadits.id);
          if (!hErr) savedToDb = true;
        } catch {
          // Table doesn't exist
        }

        // Coba sinkronkan juga ke materi_pengajian untuk backward compatibility
        try {
          await supabase
            .from("materi_pengajian")
            .update({
              kelompok: "himpunan",
              nama_materi: formNamaKitab.trim(),
              jumlah_halaman: formTotalHal,
              urutan: formUrutan,
            })
            .eq("id", editingHadits.id);
        } catch {
          // Ignore
        }

        // Update state lokal & localStorage
        const updated = haditsList.map((h) =>
          h.id === editingHadits.id ? { ...h, ...payloadNew } : h
        ).sort((a, b) => a.urutan - b.urutan);
        setHaditsList(updated);
        localStorage.setItem("master_hadits_kitab_data", JSON.stringify(updated));

        showSuccess("Berhasil", `Kitab "${formNamaKitab}" berhasil diperbarui.`);
      } else {
        // Tambah Kitab Baru
        let newId = Date.now();
        try {
          const { data: insData, error: insErr } = await supabase
            .from("master_hadits_kitab")
            .insert([payloadNew])
            .select();
          if (!insErr && insData && insData[0]) {
            newId = insData[0].id;
            savedToDb = true;
          }
        } catch {
          // Table doesn't exist
        }

        // Sinkronkan ke materi_pengajian
        try {
          const { data: mpIns } = await supabase
            .from("materi_pengajian")
            .insert([
              {
                kelompok: "himpunan",
                nama_materi: formNamaKitab.trim(),
                jumlah_halaman: formTotalHal,
                urutan: formUrutan,
              },
            ])
            .select();
          if (mpIns && mpIns[0] && !savedToDb) {
            newId = mpIns[0].id;
          }
        } catch {
          // Ignore
        }

        const newItem: HaditsKitab = {
          id: newId,
          ...payloadNew,
          created_at: new Date().toISOString(),
        };
        const updated = [...haditsList, newItem].sort((a, b) => a.urutan - b.urutan);
        setHaditsList(updated);
        localStorage.setItem("master_hadits_kitab_data", JSON.stringify(updated));

        showSuccess("Berhasil", `Kitab "${formNamaKitab}" berhasil ditambahkan ke kurikulum.`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menyimpan", err.message || "Terjadi kesalahan saat menyimpan data kitab.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Hapus Kitab Hadits
  const handleDeleteHadits = async (id: number, nama: string) => {
    const isConfirmed = await showDeleteConfirm(`Kitab "${nama}"`);
    if (!isConfirmed) return;

    try {
      // Hapus dari master_hadits_kitab
      try {
        await supabase.from("master_hadits_kitab").delete().eq("id", id);
      } catch {
        // Ignore
      }

      // Hapus dari materi_pengajian
      try {
        await supabase.from("materi_pengajian").delete().eq("id", id);
      } catch {
        // Ignore
      }

      const updated = haditsList.filter((h) => h.id !== id);
      setHaditsList(updated);
      localStorage.setItem("master_hadits_kitab_data", JSON.stringify(updated));

      showToast(`Kitab "${nama}" berhasil dihapus`, "success");
      await loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menghapus", err.message || "Gagal menghapus data kitab.");
    }
  };

  // Handler Open Modal Edit Al-Qur'an
  const handleOpenQuranModal = (item: QuranKategori) => {
    setEditingQuran(item);
    setFormQuranNama(item.nama_kategori);
    setFormQuranHalMulai(item.hal_mulai);
    setFormQuranHalSelesai(item.hal_selesai);
    setFormQuranTotalHal(item.total_hal);
    setFormQuranCakupan(item.cakupan_surat || "");
    setIsQuranModalOpen(true);
  };

  // Handler Simpan Perubahan Al-Qur'an
  const handleSaveQuran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuran) return;

    setIsSubmitting(true);
    try {
      const computedTotal = formQuranHalSelesai - formQuranHalMulai + 1;
      const payload = {
        nama_kategori: formQuranNama.trim(),
        hal_mulai: formQuranHalMulai,
        hal_selesai: formQuranHalSelesai,
        total_hal: computedTotal > 0 ? computedTotal : formQuranTotalHal,
        cakupan_surat: formQuranCakupan.trim(),
      };

      // Coba simpan ke master_quran_kategori
      try {
        await supabase
          .from("master_quran_kategori")
          .update(payload)
          .eq("id", editingQuran.id);
      } catch {
        // Ignore
      }

      // Update state lokal & localStorage
      const updated = quranList.map((q) =>
        q.id === editingQuran.id ? { ...q, ...payload } : q
      );
      setQuranList(updated);
      localStorage.setItem("master_quran_kategori_data", JSON.stringify(updated));

      showSuccess("Berhasil", `Kategori Al-Qur'an "${payload.nama_kategori}" berhasil diperbarui.`);
      setIsQuranModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menyimpan", err.message || "Gagal memperbarui kategori Al-Qur'an.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy SQL Schema
  const sqlScriptContent = `-- =============================================================================
-- SKRIP DATABASE SUPABASE: MASTER MATERI PENGAJIAN (AL-QUR'AN & HIMPUNAN HADITS)
-- File: /src/sql/08_master_materi_quran_hadits.sql
-- =============================================================================

-- 1. TABEL MASTER KATEGORI AL-QUR'AN
CREATE TABLE IF NOT EXISTS public.master_quran_kategori (
    id BIGSERIAL PRIMARY KEY,
    nama_kategori VARCHAR(255) NOT NULL,
    hal_mulai INTEGER NOT NULL,
    hal_selesai INTEGER NOT NULL,
    total_hal INTEGER NOT NULL,
    cakupan_surat TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.master_quran_kategori ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Izinkan semua akses master_quran_kategori" ON public.master_quran_kategori;
CREATE POLICY "Izinkan semua akses master_quran_kategori" 
ON public.master_quran_kategori FOR ALL 
USING (true) WITH CHECK (true);

-- Seed Data Awal Al-Qur'an (Cepatan & Lambatan)
INSERT INTO public.master_quran_kategori (id, nama_kategori, hal_mulai, hal_selesai, total_hal, cakupan_surat)
VALUES 
    (1, 'Al Quran Cepatan', 1, 341, 341, 'Surat Al-Fatihah s/d Surat Al-Kahf / Maryam'),
    (2, 'Al Quran Lambatan', 342, 604, 263, 'Surat Al-Hajj s/d Surat An-Nas')
ON CONFLICT (id) DO UPDATE 
SET nama_kategori = EXCLUDED.nama_kategori,
    hal_mulai = EXCLUDED.hal_mulai,
    hal_selesai = EXCLUDED.hal_selesai,
    total_hal = EXCLUDED.total_hal,
    cakupan_surat = EXCLUDED.cakupan_surat;

-- 2. TABEL MASTER KITAB HIMPUNAN / HADITS
CREATE TABLE IF NOT EXISTS public.master_hadits_kitab (
    id BIGSERIAL PRIMARY KEY,
    urutan INTEGER NOT NULL DEFAULT 1,
    nama_kitab VARCHAR(255) NOT NULL,
    total_hal INTEGER NOT NULL DEFAULT 40,
    default_max_baris INTEGER NOT NULL DEFAULT 18,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_hadits_kitab_urutan ON public.master_hadits_kitab(urutan ASC);

ALTER TABLE public.master_hadits_kitab ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Izinkan semua akses master_hadits_kitab" ON public.master_hadits_kitab;
CREATE POLICY "Izinkan semua akses master_hadits_kitab" 
ON public.master_hadits_kitab FOR ALL 
USING (true) WITH CHECK (true);

-- Migrasikan data himpunan dari materi_pengajian jika ada
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'materi_pengajian'
    ) THEN
        INSERT INTO public.master_hadits_kitab (urutan, nama_kitab, total_hal, default_max_baris)
        SELECT COALESCE(urutan, 1), nama_materi, COALESCE(jumlah_halaman, 40), 18
        FROM public.materi_pengajian
        WHERE kelompok = 'himpunan'
        ORDER BY urutan ASC
        ON CONFLICT DO NOTHING;
    END IF;
END $$;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScriptContent);
    setCopiedSql(true);
    showToast("Skrip SQL berhasil disalin ke clipboard", "success");
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Filter Hadits berdasarkan pencarian
  const filteredHadits = haditsList
    .filter((item) =>
      item.nama_kitab.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.urutan - b.urutan);

  // Filter Al-Qur'an berdasarkan pencarian
  const filteredQuran = quranList.filter(
    (item) =>
      item.nama_kategori.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.cakupan_surat && item.cakupan_surat.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <BookMarked className="w-6 h-6" />
              </span>
              Master Materi Pengajian
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Kelola kategori Al-Qur'an (Cepatan &amp; Lambatan berkesinambungan) serta Daftar Kitab Himpunan Hadits
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasCustomDbTable && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Supabase DB Aktif</span>
              </span>
            )}

            <button
              onClick={() => setIsSqlModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              title="Lihat Struktur Skrip SQL Supabase"
            >
              <Database className="w-4 h-4 text-emerald-500" />
              <span>Skrip SQL Tabel</span>
            </button>

            {isAdmin && activeTab === "himpunan" && (
              <button
                onClick={() => handleOpenHaditsModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kitab</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & TABS NAVIGATOR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs flex flex-col sm:flex-row items-center gap-4">
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("alquran")}
            className={`flex-1 sm:w-44 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "alquran"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Al-Qur'an (2 Kategori)</span>
          </button>
          <button
            onClick={() => setActiveTab("himpunan")}
            className={`flex-1 sm:w-48 flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "himpunan"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Book className="w-4 h-4" />
            <span>Himpunan / Hadits ({haditsList.length})</span>
          </button>
        </div>

        <div className="relative flex-1 w-full sm:px-2">
          <div className="absolute inset-y-0 left-3 sm:left-5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder={
              activeTab === "alquran"
                ? "Cari kategori Al-Qur'an atau nama surat..."
                : "Cari nama kitab / himpunan hadits..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TAB AL-QUR'AN (MASTER DATA)                                            */}
      {/* ========================================================================= */}
      {activeTab === "alquran" && (
        <div className="space-y-6">
          {/* NOTICE BANNER: KONSEP RENTANG HALAMAN BERKELANJUTAN */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-indigo-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-3 bg-emerald-600 text-white rounded-xl shrink-0 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Aturan Penomoran Halaman Al-Qur'an (Mushaf Standar 604 Halaman)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Meskipun <strong>Al Quran Lambatan</strong> memiliki total <strong>263 Halaman</strong>, nomor halaman di database tetap dimulai dari <strong>Halaman 342 sampai 604</strong> secara berkesinambungan (tidak mengulang dari halaman 1).
              </p>
            </div>
          </div>

          {/* DUA KARTU UTAMA AL-QUR'AN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Al Quran Cepatan Card */}
            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 mb-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    Kategori Utama 1
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Al Quran Cepatan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Materi pengajian Al-Qur'an bagian pertama
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      const cepatan = quranList.find((q) => q.id === 1) || quranList[0];
                      if (cepatan) handleOpenQuranModal(cepatan);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Data Rentang"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Jumlah Halaman
                  </div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    341 <span className="text-xs font-normal text-slate-500">Hal</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Rentang Halaman
                  </div>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1">
                    Hal 1 s/d 341
                  </div>
                </div>
              </div>

              <div className="mt-3 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Cakupan Surat
                </div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Surat Al-Fatihah s/d Surat Al-Kahf / Maryam
                </div>
              </div>
            </div>

            {/* 2. Al Quran Lambatan Card */}
            <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-indigo-500/20 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 mb-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    Kategori Utama 2
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Al Quran Lambatan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Materi pengajian Al-Qur'an bagian lanjutan
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      const lambatan = quranList.find((q) => q.id === 2) || quranList[1];
                      if (lambatan) handleOpenQuranModal(lambatan);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Data Rentang"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Jumlah Halaman
                  </div>
                  <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    263 <span className="text-xs font-normal text-slate-500">Hal</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Rentang Halaman
                  </div>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1">
                    Hal 342 s/d 604
                  </div>
                </div>
              </div>

              <div className="mt-3 p-3 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <div className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Cakupan Surat
                </div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Surat Al-Hajj s/d Surat An-Nas
                </div>
              </div>
            </div>
          </div>

          {/* TABEL MASTER AL-QUR'AN DENGAN KOLOM RENTANG HALAMAN */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  Tabel Master Al-Qur'an &amp; Rentang Halaman
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Representasi skema master_quran_kategori di database
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4 w-16 text-center">ID</th>
                    <th className="py-3 px-4">Kategori Al-Qur'an</th>
                    <th className="py-3 px-4 text-center">Jumlah Halaman</th>
                    <th className="py-3 px-4 text-center">Rentang Halaman</th>
                    <th className="py-3 px-4">Cakupan Surat</th>
                    {isAdmin && <th className="py-3 px-4 text-center w-24">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredQuran.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center mx-auto">
                          {item.id}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.nama_kategori}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.id === 1 ? "Materi Dasar / Cepatan" : "Materi Lanjutan / Lambatan"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/50 dark:border-emerald-800/40">
                          {item.total_hal} Halaman
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200/50 dark:border-indigo-800/40 font-mono">
                          Halaman {item.hal_mulai} s/d {item.hal_selesai}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {item.cakupan_surat || "—"}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenQuranModal(item)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                            title="Edit Rentang Kategori"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB HIMPUNAN / HADITS (MASTER DATA CRUD)                               */}
      {/* ========================================================================= */}
      {activeTab === "himpunan" && (
        <div className="space-y-6">
          {/* STATISTIK RINGKAS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                <Book className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Kitab Terdaftar</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{haditsList.length} Kitab</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Halaman Himpunan</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {haditsList.reduce((acc, curr) => acc + (curr.total_hal || 0), 0)} Halaman
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center gap-3">
              <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
                <AlignLeft className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Std. Rata-rata Baris</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">18 Baris / Halaman</div>
              </div>
            </div>
          </div>

          {/* TABEL MASTER HIMPUNAN */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Book className="w-4 h-4 text-indigo-500" />
                  Daftar Kitab Himpunan Hadits
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tabel master kurikulum kitab himpunan hadits beserta standar baris
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => handleOpenHaditsModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Kitab</span>
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-slate-500">Memuat data master kitab...</div>
            ) : filteredHadits.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Book className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  Tidak Ada Data Kitab
                </h3>
                <p className="text-slate-500 text-sm max-w-sm">
                  {searchQuery
                    ? `Tidak ditemukan kitab dengan kata kunci "${searchQuery}".`
                    : "Belum ada kitab himpunan yang ditambahkan ke kurikulum."}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => handleOpenHaditsModal()}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Kitab Sekarang</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4 w-16 text-center">Urutan</th>
                      <th className="py-3 px-4">Nama Kitab</th>
                      <th className="py-3 px-4 text-center">Jml. Halaman</th>
                      <th className="py-3 px-4 text-center">Std. Baris/Hal</th>
                      {isAdmin && <th className="py-3 px-4 text-center w-28">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHadits.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center mx-auto border border-indigo-200/50 dark:border-indigo-800/50">
                            {item.urutan}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {item.nama_kitab}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Kitab Himpunan Ke-{item.urutan}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                            {item.total_hal} Halaman
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                            {item.default_max_baris || 18} Baris / Hal
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenHaditsModal(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Edit Kitab"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteHadits(item.id, item.nama_kitab)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Hapus Kitab"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FORM TAMBAH / EDIT KITAB HIMPUNAN                                   */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                {editingHadits ? <Edit2 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
                {editingHadits ? "Edit Kitab Himpunan" : "Tambah Kitab Himpunan Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHadits} className="p-5 space-y-4">
              {/* 1. Urutan Kitab */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-500" />
                  Urutan Kitab (INT) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formUrutan}
                  onChange={(e) => setFormUrutan(Number(e.target.value))}
                  placeholder="Contoh: 1, 2, 3..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Urutan pembelajaran kitab dalam kurikulum pondok
                </p>
              </div>

              {/* 2. Nama Kitab / Himpunan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Book className="w-3.5 h-3.5 text-indigo-500" />
                  Nama Kitab / Himpunan (VARCHAR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNamaKitab}
                  onChange={(e) => setFormNamaKitab(e.target.value)}
                  placeholder="Contoh: Kitabush Sholah"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                />
              </div>

              {/* 3. Jumlah Halaman & 4. Rata-rata Baris per Halaman */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    Jumlah Halaman (INT) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formTotalHal}
                    onChange={(e) => setFormTotalHal(Number(e.target.value))}
                    placeholder="Contoh: 45"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5 text-amber-500" />
                    Std. Baris/Hal (INT) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formDefaultMaxBaris}
                    onChange={(e) => setFormDefaultMaxBaris(Number(e.target.value))}
                    placeholder="Contoh: 18"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingHadits ? "Simpan Perubahan" : "Tambahkan Kitab"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL EDIT KATEGORI AL-QUR'AN                                             */}
      {/* ========================================================================= */}
      {isQuranModalOpen && editingQuran && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-500" />
                Edit Kategori Al-Qur'an
              </h3>
              <button
                onClick={() => setIsQuranModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuran} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  required
                  value={formQuranNama}
                  onChange={(e) => setFormQuranNama(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Halaman Mulai
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="604"
                    required
                    value={formQuranHalMulai}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setFormQuranHalMulai(v);
                      if (formQuranHalSelesai >= v) {
                        setFormQuranTotalHal(formQuranHalSelesai - v + 1);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Halaman Selesai
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="604"
                    required
                    value={formQuranHalSelesai}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setFormQuranHalSelesai(v);
                      if (v >= formQuranHalMulai) {
                        setFormQuranTotalHal(v - formQuranHalMulai + 1);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Total Halaman Terhitung
                </label>
                <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formQuranHalSelesai >= formQuranHalMulai ? formQuranHalSelesai - formQuranHalMulai + 1 : 0} Halaman
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cakupan Surat
                </label>
                <textarea
                  rows={2}
                  value={formQuranCakupan}
                  onChange={(e) => setFormQuranCakupan(e.target.value)}
                  placeholder="Contoh: Surat Al-Fatihah s/d Surat Al-Kahf / Maryam"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-5">
                <button
                  type="button"
                  onClick={() => setIsQuranModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL SKRIP SQL SUPABASE                                                  */}
      {/* ========================================================================= */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Skrip SQL Supabase: Master Materi Pengajian
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tabel master_quran_kategori &amp; master_hadits_kitab
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Salin skrip SQL di bawah ini dan jalankan pada <strong>SQL Editor</strong> di Supabase Dashboard untuk membuat tabel <code className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.5 rounded">master_quran_kategori</code> dan <code className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.5 rounded">master_hadits_kitab</code> secara permanen beserta RLS Policies:
              </p>

              <div className="relative">
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto max-h-80 border border-slate-800 leading-relaxed">
                  {sqlScriptContent}
                </pre>
                <button
                  onClick={handleCopySql}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? "Tersalin!" : "Salin SQL"}</span>
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
