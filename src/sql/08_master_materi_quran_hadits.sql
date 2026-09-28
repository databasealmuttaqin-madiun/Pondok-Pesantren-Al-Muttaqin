-- =============================================================================
-- SKRIP DATABASE SUPABASE: MASTER MATERI PENGAJIAN (AL-QUR'AN & HIMPUNAN HADITS)
-- File: /src/sql/08_master_materi_quran_hadits.sql
-- =============================================================================

-- 1. TABEL MASTER KATEGORI AL-QUR'AN
-- Mendukung konsep rentang halaman berkelanjutan (Cepatan 1-341, Lambatan 342-604)
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

-- RLS untuk master_quran_kategori
ALTER TABLE public.master_quran_kategori ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Izinkan semua akses master_quran_kategori" ON public.master_quran_kategori;
CREATE POLICY "Izinkan semua akses master_quran_kategori" 
ON public.master_quran_kategori FOR ALL 
USING (true)
WITH CHECK (true);

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
-- Menyimpan detail kurikulum himpunan: urutan, nama kitab, total halaman, dan standar baris per halaman
CREATE TABLE IF NOT EXISTS public.master_hadits_kitab (
    id BIGSERIAL PRIMARY KEY,
    urutan INTEGER NOT NULL DEFAULT 1,
    nama_kitab VARCHAR(255) NOT NULL,
    total_hal INTEGER NOT NULL DEFAULT 40,
    default_max_baris INTEGER NOT NULL DEFAULT 18,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing urutan kitab
CREATE INDEX IF NOT EXISTS idx_master_hadits_kitab_urutan ON public.master_hadits_kitab(urutan ASC);

-- RLS untuk master_hadits_kitab
ALTER TABLE public.master_hadits_kitab ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Izinkan semua akses master_hadits_kitab" ON public.master_hadits_kitab;
CREATE POLICY "Izinkan semua akses master_hadits_kitab" 
ON public.master_hadits_kitab FOR ALL 
USING (true)
WITH CHECK (true);

-- Migrasikan data himpunan dari materi_pengajian jika ada
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'materi_pengajian'
    ) THEN
        INSERT INTO public.master_hadits_kitab (urutan, nama_kitab, total_hal, default_max_baris)
        SELECT 
            COALESCE(urutan, 1), 
            nama_materi, 
            COALESCE(jumlah_halaman, 40), 
            18
        FROM public.materi_pengajian
        WHERE kelompok = 'himpunan'
        ORDER BY urutan ASC
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
