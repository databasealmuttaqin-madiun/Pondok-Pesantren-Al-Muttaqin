-- ====================================================================
-- SKRIP DATABASE SUPABASE: CAPAIAN MATERI & MAKNA KITAB
-- Sistem Informasi Pondok Pesantren / Sekolah Al-Muttaqin
-- ====================================================================

-- 1. TABEL MASTER MATERI PENGAJIAN
CREATE TABLE IF NOT EXISTS public.materi_pengajian (
    id BIGSERIAL PRIMARY KEY,
    nama_materi VARCHAR(255) NOT NULL,
    kelompok VARCHAR(100) DEFAULT 'Kitab/Al-Qur''an',
    jumlah_halaman INTEGER DEFAULT 40 CHECK (jumlah_halaman > 0),
    urutan INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing urutan materi
CREATE INDEX IF NOT EXISTS idx_materi_pengajian_urutan ON public.materi_pengajian(urutan ASC);

-- Insert Data Awal (Seed Data Materi Kitab/Al-Qur'an)
INSERT INTO public.materi_pengajian (id, nama_materi, kelompok, jumlah_halaman, urutan)
VALUES 
    (1, 'Al-Qur''an 30 Juz', 'Al-Qur''an', 604, 1),
    (2, 'Kitab Hadits Shahih Bukhari', 'Hadits', 120, 2),
    (3, 'Kitab Safinatun Najah', 'Fiqih', 40, 3),
    (4, 'Kitab Aqidatul Awam', 'Aqidah', 32, 4),
    (5, 'Kitab Ta''lim Muta''allim', 'Akhlaq', 60, 5)
ON CONFLICT (id) DO UPDATE 
SET nama_materi = EXCLUDED.nama_materi,
    jumlah_halaman = EXCLUDED.jumlah_halaman;


-- 2. TABEL UTAMA CAPAIAN SANTRI
CREATE TABLE IF NOT EXISTS public.capaian_santri (
    id VARCHAR(255) PRIMARY KEY, -- Kombinasi `${santri_id}_${materi_id}`
    santri_id VARCHAR(255) NOT NULL,
    santri_nama VARCHAR(255),
    kamar VARCHAR(100),
    kelas_pengajian VARCHAR(100),
    materi_id BIGINT,
    materi_nama VARCHAR(255),
    total_halaman INTEGER DEFAULT 40,
    belum_disampaikan BOOLEAN DEFAULT FALSE,
    halaman_dimaknai JSONB DEFAULT '[]'::jsonb, -- Array integer halaman yang dimaknai e.g. [1, 2, 3]
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(255)
);

-- Indexing untuk performa pencarian dan agregasi
CREATE INDEX IF NOT EXISTS idx_capaian_santri_id ON public.capaian_santri(santri_id);
CREATE INDEX IF NOT EXISTS idx_capaian_materi_id ON public.capaian_santri(materi_id);
CREATE INDEX IF NOT EXISTS idx_capaian_kamar ON public.capaian_santri(kamar);
CREATE INDEX IF NOT EXISTS idx_capaian_kelas_pengajian ON public.capaian_santri(kelas_pengajian);


-- 3. ROW LEVEL SECURITY (RLS) & POLICIES FOR PUBLIC / ANON ACCESS
-- Mengizinkan operasi SELECT, INSERT, UPDATE, DELETE baik via Anon Key maupun Auth
ALTER TABLE public.materi_pengajian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capaian_santri ENABLE ROW LEVEL SECURITY;

-- Policy Materi Pengajian
DROP POLICY IF EXISTS "Izinkan akses materi_pengajian" ON public.materi_pengajian;
DROP POLICY IF EXISTS "Izinkan baca materi_pengajian untuk semua" ON public.materi_pengajian;
DROP POLICY IF EXISTS "Izinkan kelola materi_pengajian untuk admin" ON public.materi_pengajian;

CREATE POLICY "Izinkan semua akses materi_pengajian" 
ON public.materi_pengajian FOR ALL 
USING (true)
WITH CHECK (true);

-- Policy Capaian Santri
DROP POLICY IF EXISTS "Izinkan akses capaian_santri" ON public.capaian_santri;
DROP POLICY IF EXISTS "Izinkan baca capaian_santri" ON public.capaian_santri;
DROP POLICY IF EXISTS "Izinkan simpan dan update capaian_santri" ON public.capaian_santri;

CREATE POLICY "Izinkan semua akses capaian_santri" 
ON public.capaian_santri FOR ALL 
USING (true)
WITH CHECK (true);


-- 4. TRIGGER OTOMATIS UPDATE `updated_at`
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_capaian_santri_updated_at ON public.capaian_santri;
CREATE TRIGGER trigger_capaian_santri_updated_at
BEFORE UPDATE ON public.capaian_santri
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();


-- 5. VIEW AGREGAT RATA-RATA CAPAIAN PER KAMAR
CREATE OR REPLACE VIEW view_capaian_agregat_kamar AS
SELECT 
    c.kamar,
    c.materi_id,
    c.materi_nama,
    c.total_halaman,
    COUNT(DISTINCT c.santri_id) AS total_santri,
    SUM(
        CASE 
            WHEN c.belum_disampaikan = true THEN 0
            WHEN c.halaman_dimaknai IS NULL THEN 0
            ELSE jsonb_array_length(c.halaman_dimaknai)
        END
    ) AS total_halaman_dimaknai_semua,
    ROUND(
        (
            SUM(
                CASE 
                    WHEN c.belum_disampaikan = true THEN 0
                    WHEN c.halaman_dimaknai IS NULL THEN 0
                    ELSE jsonb_array_length(c.halaman_dimaknai)
                END
            )::DECIMAL / 
            NULLIF(COUNT(DISTINCT c.santri_id) * c.total_halaman, 0)
        ) * 100, 
        2
    ) AS rata_rata_persentase
FROM public.capaian_santri c
WHERE c.kamar IS NOT NULL AND c.kamar <> ''
GROUP BY c.kamar, c.materi_id, c.materi_nama, c.total_halaman;


-- 6. VIEW AGREGAT RATA-RATA CAPAIAN PER KELAS PENGAJIAN
CREATE OR REPLACE VIEW view_capaian_agregat_kelas AS
SELECT 
    c.kelas_pengajian,
    c.materi_id,
    c.materi_nama,
    c.total_halaman,
    COUNT(DISTINCT c.santri_id) AS total_santri,
    SUM(
        CASE 
            WHEN c.belum_disampaikan = true THEN 0
            WHEN c.halaman_dimaknai IS NULL THEN 0
            ELSE jsonb_array_length(c.halaman_dimaknai)
        END
    ) AS total_halaman_dimaknai_semua,
    ROUND(
        (
            SUM(
                CASE 
                    WHEN c.belum_disampaikan = true THEN 0
                    WHEN c.halaman_dimaknai IS NULL THEN 0
                    ELSE jsonb_array_length(c.halaman_dimaknai)
                END
            )::DECIMAL / 
            NULLIF(COUNT(DISTINCT c.santri_id) * c.total_halaman, 0)
        ) * 100, 
        2
    ) AS rata_rata_persentase
FROM public.capaian_santri c
WHERE c.kelas_pengajian IS NOT NULL AND c.kelas_pengajian <> ''
GROUP BY c.kelas_pengajian, c.materi_id, c.materi_nama, c.total_halaman;
