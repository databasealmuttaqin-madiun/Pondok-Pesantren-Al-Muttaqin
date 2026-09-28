-- =============================================================================
-- SKRIP DATABASE SUPABASE: TARGET CAPAIAN AL-QUR'AN & AL-HADIST (HIMPUNAN)
-- File: /src/sql/10_target_quran_hadits.sql
-- =============================================================================

-- 1. TABEL TARGET AL-QUR'AN (SURAT & AYAT -> HALAMAN MUSHAF)
CREATE TABLE IF NOT EXISTS public.target_quran (
    id BIGSERIAL PRIMARY KEY,
    target_pengajian_id BIGINT,
    tanggal DATE NOT NULL,
    pertemuan_ke INTEGER NOT NULL DEFAULT 1,
    kelas_id VARCHAR(100) NOT NULL,
    surah_awal_id INTEGER NOT NULL,
    ayat_awal INTEGER NOT NULL,
    surah_akhir_id INTEGER NOT NULL,
    ayat_akhir INTEGER NOT NULL,
    halaman_awal INTEGER NOT NULL,
    halaman_akhir INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_target_quran_kelas_tanggal ON public.target_quran(kelas_id, tanggal);

ALTER TABLE public.target_quran ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Izinkan semua akses target_quran" ON public.target_quran;
CREATE POLICY "Izinkan semua akses target_quran" 
ON public.target_quran FOR ALL 
USING (true) WITH CHECK (true);


-- 2. TABEL TARGET AL-HADIST (KITAB -> HALAMAN -> BARIS)
CREATE TABLE IF NOT EXISTS public.target_hadits (
    id BIGSERIAL PRIMARY KEY,
    target_pengajian_id BIGINT,
    tanggal DATE NOT NULL,
    pertemuan_ke INTEGER NOT NULL DEFAULT 1,
    kelas_id VARCHAR(100) NOT NULL,
    kitab_awal_id BIGINT NOT NULL,
    hal_awal INTEGER NOT NULL,
    baris_awal INTEGER NOT NULL DEFAULT 1,
    kitab_akhir_id BIGINT NOT NULL,
    hal_akhir INTEGER NOT NULL,
    baris_akhir INTEGER NOT NULL DEFAULT 18,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_target_hadits_kelas_tanggal ON public.target_hadits(kelas_id, tanggal);

ALTER TABLE public.target_hadits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Izinkan semua akses target_hadits" ON public.target_hadits;
CREATE POLICY "Izinkan semua akses target_hadits" 
ON public.target_hadits FOR ALL 
USING (true) WITH CHECK (true);
