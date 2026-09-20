-- ==============================================================================
-- SQL SCRIPT: AKTIFKAN RLS & KEBIJAKAN (POLICIES) UNTUK TABEL pengaturan_sekolah
-- Pondok Pesantren & SMP IT Al-Muttaqin
-- ==============================================================================

-- 1. Pastikan tabel pengaturan_sekolah sudah ada dengan struktur yang benar
CREATE TABLE IF NOT EXISTS public.pengaturan_sekolah (
    id SERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION DEFAULT -7.6549,
    longitude DOUBLE PRECISION DEFAULT 111.5199,
    radius_meters INTEGER DEFAULT 50,
    nama_sekolah TEXT DEFAULT 'SMP IT Al-Muttaqin',
    alamat_pos TEXT DEFAULT 'Yayasan Pondok Pesantren Al-Muttaqin',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Aktifkan Row Level Security (RLS) pada tabel pengaturan_sekolah
ALTER TABLE public.pengaturan_sekolah ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan (Policy) untuk SELECT (Membaca konfigurasi sekolah)
DROP POLICY IF EXISTS "Allow select pengaturan_sekolah" ON public.pengaturan_sekolah;
CREATE POLICY "Allow select pengaturan_sekolah" 
    ON public.pengaturan_sekolah FOR SELECT 
    USING (true);

-- 4. Kebijakan (Policy) untuk INSERT (Menambah konfigurasi sekolah)
DROP POLICY IF EXISTS "Allow insert pengaturan_sekolah" ON public.pengaturan_sekolah;
CREATE POLICY "Allow insert pengaturan_sekolah" 
    ON public.pengaturan_sekolah FOR INSERT 
    WITH CHECK (true);

-- 5. Kebijakan (Policy) untuk UPDATE (Mengubah titik koordinat & radius)
DROP POLICY IF EXISTS "Allow update pengaturan_sekolah" ON public.pengaturan_sekolah;
CREATE POLICY "Allow update pengaturan_sekolah" 
    ON public.pengaturan_sekolah FOR UPDATE 
    USING (true);

-- 6. Kebijakan (Policy) untuk DELETE (Menghapus konfigurasi)
DROP POLICY IF EXISTS "Allow delete pengaturan_sekolah" ON public.pengaturan_sekolah;
CREATE POLICY "Allow delete pengaturan_sekolah" 
    ON public.pengaturan_sekolah FOR DELETE 
    USING (true);

-- 7. Tambahkan ke Realtime Publication (Opsional)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'pengaturan_sekolah'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pengaturan_sekolah;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
