-- =============================================================================
-- SKRIP DATABASE SUPABASE: REALISASI CAPAIAN AL-QUR'AN & AL-HADIST (HIMPUNAN)
-- File: /src/sql/09_capaian_quran_hadits.sql
-- =============================================================================

-- 1. TABEL CAPAIAN AL-QUR'AN (SURAT & AYAT -> ESTIMASI HALAMAN MUSHAF)
CREATE TABLE IF NOT EXISTS public.capaian_quran (
    id BIGSERIAL PRIMARY KEY,
    jurnal_id BIGINT,
    kelas_pengajian VARCHAR(100) NOT NULL,
    sesi_id BIGINT,
    ustaz_id VARCHAR(100),
    tanggal DATE NOT NULL,
    surat_awal_no INTEGER NOT NULL,
    surat_awal_nama VARCHAR(150) NOT NULL,
    ayat_awal INTEGER NOT NULL,
    is_bersambung BOOLEAN DEFAULT FALSE,
    surat_akhir_no INTEGER NOT NULL,
    surat_akhir_nama VARCHAR(150) NOT NULL,
    ayat_akhir INTEGER NOT NULL,
    halaman_mulai INTEGER NOT NULL,
    halaman_selesai INTEGER NOT NULL,
    kategori_quran VARCHAR(100),
    ringkasan_teks TEXT,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capaian_quran_jurnal ON public.capaian_quran(jurnal_id);
CREATE INDEX IF NOT EXISTS idx_capaian_quran_kelas_tanggal ON public.capaian_quran(kelas_pengajian, tanggal);

ALTER TABLE public.capaian_quran ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Izinkan semua akses capaian_quran" ON public.capaian_quran;
CREATE POLICY "Izinkan semua akses capaian_quran" 
ON public.capaian_quran FOR ALL 
USING (true) WITH CHECK (true);


-- 2. TABEL CAPAIAN AL-HADIST / HIMPUNAN (KITAB -> HALAMAN -> BARIS)
CREATE TABLE IF NOT EXISTS public.capaian_hadits (
    id BIGSERIAL PRIMARY KEY,
    jurnal_id BIGINT,
    kelas_pengajian VARCHAR(100) NOT NULL,
    sesi_id BIGINT,
    ustaz_id VARCHAR(100),
    tanggal DATE NOT NULL,
    kitab_awal_id BIGINT,
    kitab_awal_nama VARCHAR(255) NOT NULL,
    hal_awal INTEGER NOT NULL,
    baris_awal INTEGER NOT NULL,
    is_bersambung BOOLEAN DEFAULT FALSE,
    kitab_akhir_id BIGINT,
    kitab_akhir_nama VARCHAR(255) NOT NULL,
    hal_akhir INTEGER NOT NULL,
    baris_akhir INTEGER NOT NULL,
    ringkasan_teks TEXT,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capaian_hadits_jurnal ON public.capaian_hadits(jurnal_id);
CREATE INDEX IF NOT EXISTS idx_capaian_hadits_kelas_tanggal ON public.capaian_hadits(kelas_pengajian, tanggal);

ALTER TABLE public.capaian_hadits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Izinkan semua akses capaian_hadits" ON public.capaian_hadits;
CREATE POLICY "Izinkan semua akses capaian_hadits" 
ON public.capaian_hadits FOR ALL 
USING (true) WITH CHECK (true);
