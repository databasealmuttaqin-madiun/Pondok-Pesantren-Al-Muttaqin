-- SQL Schema for Siswa Lulus & Siswa Mutasi
-- Run this script in your Supabase SQL Editor if the tables are not yet created

-- 1. Table: siswa_lulus
CREATE TABLE IF NOT EXISTS public.siswa_lulus (
    id BIGSERIAL PRIMARY KEY,
    santri_id BIGINT,
    nama_lengkap TEXT NOT NULL,
    jenis_kelamin VARCHAR(5) DEFAULT 'L',
    kategori VARCHAR(50) DEFAULT 'SMP',
    tahun_lulus VARCHAR(20),
    tanggal_lulus DATE DEFAULT CURRENT_DATE,
    no_ijazah TEXT,
    lanjutan_studi TEXT,
    keterangan TEXT,
    nisn TEXT,
    nik TEXT,
    kamar TEXT,
    kelas_sekolah TEXT,
    kelas_pengajian TEXT,
    desa_sambung TEXT,
    kelompok_sambung TEXT,
    daerah TEXT,
    no_hp_ortu TEXT,
    status_asrama TEXT,
    alamat TEXT,
    nama_ayah TEXT,
    nama_ibu TEXT,
    foto TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: siswa_mutasi
CREATE TABLE IF NOT EXISTS public.siswa_mutasi (
    id BIGSERIAL PRIMARY KEY,
    santri_id BIGINT,
    nama_lengkap TEXT NOT NULL,
    jenis_kelamin VARCHAR(5) DEFAULT 'L',
    kategori VARCHAR(50) DEFAULT 'SMP',
    jenis_mutasi VARCHAR(100) DEFAULT 'Pindah Sekolah',
    tanggal_mutasi DATE DEFAULT CURRENT_DATE,
    tujuan_mutasi TEXT,
    alasan_mutasi TEXT,
    no_surat_mutasi TEXT,
    keterangan TEXT,
    nisn TEXT,
    nik TEXT,
    kamar TEXT,
    kelas_sekolah TEXT,
    kelas_pengajian TEXT,
    desa_sambung TEXT,
    kelompok_sambung TEXT,
    daerah TEXT,
    no_hp_ortu TEXT,
    status_asrama TEXT,
    alamat TEXT,
    nama_ayah TEXT,
    nama_ibu TEXT,
    foto TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and public access policies
ALTER TABLE public.siswa_lulus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa_mutasi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on siswa_lulus" ON public.siswa_lulus;
CREATE POLICY "Allow all access on siswa_lulus" ON public.siswa_lulus FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access on siswa_mutasi" ON public.siswa_mutasi;
CREATE POLICY "Allow all access on siswa_mutasi" ON public.siswa_mutasi FOR ALL USING (true) WITH CHECK (true);
