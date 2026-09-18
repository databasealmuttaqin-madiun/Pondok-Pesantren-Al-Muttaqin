-- ==============================================================================
-- STRUKTUR DATABASE SUPABASE: ABSENSI & PRESENSI GURU
-- Pondok Pesantren & SMP IT Al-Muttaqin
-- ==============================================================================

-- 1. HAPUS TABEL LAMA (JIKA ADA)
DROP TABLE IF EXISTS public.absensi_guru CASCADE;

-- 2. BUAT TABEL ABSENSI GURU BARU
CREATE TABLE public.absensi_guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    waktu_absen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status_lokasi TEXT DEFAULT 'Dalam Jangkauan',
    keterangan TEXT DEFAULT 'Hadir',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEX UNTUK PERFORMA QUERY & FILTER CEPAT
CREATE INDEX IF NOT EXISTS idx_absensi_guru_waktu ON public.absensi_guru (waktu_absen DESC);
CREATE INDEX IF NOT EXISTS idx_absensi_guru_username ON public.absensi_guru (username);
CREATE INDEX IF NOT EXISTS idx_absensi_guru_nama ON public.absensi_guru (nama_guru);
CREATE INDEX IF NOT EXISTS idx_absensi_guru_status_lokasi ON public.absensi_guru (status_lokasi);

-- 4. TRIGGER OTOMATIS UPDATED_AT
CREATE OR REPLACE FUNCTION public.handle_absensi_guru_updated_at() 
RETURNS TRIGGER AS $$
BEGIN 
    NEW.updated_at = NOW(); 
    RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_absensi_guru_updated_at ON public.absensi_guru;
CREATE TRIGGER trg_absensi_guru_updated_at 
    BEFORE UPDATE ON public.absensi_guru 
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_absensi_guru_updated_at();

-- 5. PENGATURAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.absensi_guru ENABLE ROW LEVEL SECURITY;

-- Izinkan SELECT (Baca semua log)
DROP POLICY IF EXISTS "Allow select absensi_guru" ON public.absensi_guru;
CREATE POLICY "Allow select absensi_guru" 
    ON public.absensi_guru FOR SELECT 
    USING (true);

-- Izinkan INSERT (Catat absensi guru)
DROP POLICY IF EXISTS "Allow insert absensi_guru" ON public.absensi_guru;
CREATE POLICY "Allow insert absensi_guru" 
    ON public.absensi_guru FOR INSERT 
    WITH CHECK (true);

-- Izinkan UPDATE (Ubah status/keterangan)
DROP POLICY IF EXISTS "Allow update absensi_guru" ON public.absensi_guru;
CREATE POLICY "Allow update absensi_guru" 
    ON public.absensi_guru FOR UPDATE 
    USING (true);

-- Izinkan DELETE (Hapus catatan - Admin)
DROP POLICY IF EXISTS "Allow delete absensi_guru" ON public.absensi_guru;
CREATE POLICY "Allow delete absensi_guru" 
    ON public.absensi_guru FOR DELETE 
    USING (true);

-- 6. AKTIFKAN SUPABASE REALTIME
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'absensi_guru'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.absensi_guru;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
