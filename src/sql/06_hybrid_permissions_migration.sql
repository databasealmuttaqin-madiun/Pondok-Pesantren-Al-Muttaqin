-- =============================================================================
-- MIGRASI HYBRID PERMISSIONS (ROLE BASE + USER OVERRIDE) - SUPABASE POSTGRESQL
-- File: /src/sql/06_hybrid_permissions_migration.sql
-- =============================================================================

-- 1. Pastikan Ekstensi UUID Tersedia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Pastikan Tabel 'roles' Tersedia
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Pastikan Tabel 'role_permissions' Tersedia
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    menu_key VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE NOT NULL,
    can_input BOOLEAN DEFAULT FALSE NOT NULL,
    can_edit BOOLEAN DEFAULT FALSE NOT NULL,
    can_delete BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, menu_key)
);

-- 4. Perbarui Struktur Tabel 'pengguna' untuk Mendukung Hybrid Role & Permissions (JSONB)
DO $$
BEGIN
    -- Tambahkan kolom role_id jika belum ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'pengguna' AND column_name = 'role_id'
    ) THEN
        ALTER TABLE public.pengguna ADD COLUMN role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;
    END IF;

    -- Pastikan kolom peran_utama ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'pengguna' AND column_name = 'peran_utama'
    ) THEN
        ALTER TABLE public.pengguna ADD COLUMN peran_utama VARCHAR(100);
    END IF;

    -- Tambahkan kolom role sebagai alias kompatibilitas jika belum ada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'pengguna' AND column_name = 'role'
    ) THEN
        ALTER TABLE public.pengguna ADD COLUMN role VARCHAR(100);
    END IF;

    -- Pastikan kolom permissions bertipe JSONB dengan default '{}'::jsonb
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'pengguna' AND column_name = 'permissions'
    ) THEN
        ALTER TABLE public.pengguna ADD COLUMN permissions JSONB DEFAULT '{}'::jsonb;
    ELSE
        -- Jika kolom permissions sebelumnya adalah array teks / varchar, konversi aman ke JSONB
        BEGIN
            ALTER TABLE public.pengguna ALTER COLUMN permissions SET DATA TYPE JSONB USING (
                CASE 
                    WHEN permissions IS NULL THEN '{}'::jsonb
                    WHEN jsonb_typeof(permissions::jsonb) = 'array' THEN '{}'::jsonb
                    ELSE permissions::jsonb
                END
            );
        EXCEPTION WHEN OTHERS THEN
            -- Fallback jika parsing lama gagal
            ALTER TABLE public.pengguna ALTER COLUMN permissions SET DATA TYPE JSONB USING '{}'::jsonb;
        END;
        ALTER TABLE public.pengguna ALTER COLUMN permissions SET DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 5. Seed Data Master Roles
INSERT INTO public.roles (name, description) VALUES
    ('Super Admin', 'Akses penuh tanpa batas ke seluruh modul sistem'),
    ('Admin Ponpes', 'Administrator pengelola pesantren dan sistem data'),
    ('Guru Pondok', 'Tenaga pendidik kepesantrenan, tahfidz, dan keagamaan'),
    ('Guru Sekolah', 'Guru formal SMP/SMA/Madrasah dan pengajar kurikulum'),
    ('Pengurus Kamar', 'Pengurus asrama, kamar santri, dan ketertiban harian'),
    ('Kantin', 'Petugas pengelola transaksi dan kas pembukuan kantin'),
    ('Pimpinan / Pengasuh', 'Pengasuh pondok dengan akses pemantauan dan laporan eksekutif')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- 6. Skrip SQL Update Relasi role_id pada Tabel pengguna Berdasarkan peran_utama
-- Menghubungkan peran teks yang sudah ada dengan UUID roles yang sesuai:
UPDATE public.pengguna p
SET 
    role_id = r.id,
    peran_utama = r.name,
    role = r.name
FROM public.roles r
WHERE 
    (
        -- Pemetaan guru_sekolah / guru SMP
        (LOWER(COALESCE(p.peran_utama, '')) IN ('guru_sekolah', 'guru smp', 'guru_smp', 'sekolah', 'guru formal') AND r.name = 'Guru Sekolah')
        OR
        -- Pemetaan guru_pondok / guru
        (LOWER(COALESCE(p.peran_utama, '')) IN ('guru_pondok', 'guru', 'ustadz', 'pondok') AND r.name = 'Guru Pondok')
        OR
        -- Pemetaan admin
        (LOWER(COALESCE(p.peran_utama, '')) IN ('admin', 'admin_ponpes', 'administrator') AND r.name = 'Admin Ponpes')
        OR
        -- Pemetaan super admin
        (LOWER(COALESCE(p.peran_utama, '')) IN ('super admin', 'superadmin', 'super_admin') AND r.name = 'Super Admin')
        OR
        -- Pemetaan pengurus
        (LOWER(COALESCE(p.peran_utama, '')) IN ('pengurus', 'wali_kamar', 'wali kamar', 'kamar', 'asrama') AND r.name = 'Pengurus Kamar')
        OR
        -- Pemetaan kantin
        (LOWER(COALESCE(p.peran_utama, '')) IN ('kantin', 'petugas kantin', 'kasir') AND r.name = 'Kantin')
        OR
        -- Pemetaan pimpinan
        (LOWER(COALESCE(p.peran_utama, '')) IN ('pimpinan', 'pengasuh', 'kyai') AND r.name = 'Pimpinan / Pengasuh')
    );

-- Jika masih ada pengguna yang role_id-nya NULL, pasangkan ke Guru Pondok secara default
UPDATE public.pengguna p
SET role_id = (SELECT id FROM public.roles WHERE name = 'Guru Pondok' LIMIT 1)
WHERE p.role_id IS NULL;

-- 7. Bersihkan & Standarkan format JSONB pada pengguna.permissions
-- Menjamin setiap data yang tersimpan berupa JSON Object Key-Value eksplisit:
-- {
--   "capaian_materi": { "can_view": false, "can_input": false, "can_edit": false, "can_delete": false },
--   "list": { "can_view": true, "can_input": false, "can_edit": false, "can_delete": false }
-- }
UPDATE public.pengguna
SET permissions = '{}'::jsonb
WHERE permissions IS NULL OR jsonb_typeof(permissions) != 'object';

-- 8. Seed Default Role Permissions
DO $$
DECLARE
    role_super_id UUID;
    role_admin_id UUID;
    role_sekolah_id UUID;
    role_pondok_id UUID;
    m_key TEXT;
    all_menus TEXT[] := ARRAY[
        'dashboard', 'form', 'absensi', 'dashboard_guru', 'presensi_guru',
        'jurnal_mengajar', 'rekap_absensi_guru', 'perizinan_sakit', 'perizinan_sambang',
        'perizinan_haid', 'perizinan_riwayat', 'rekap_guru', 'rekap_sholat',
        'rekap_sekolah', 'nfc_daftar', 'nfc_database', 'list', 'warga_guru',
        'warga_pengurus', 'warga_mutasi', 'warga_lulus', 'pelanggaran_input',
        'pelanggaran_rekap', 'kantin_input', 'kantin_rekap', 'pondok_sesi',
        'pondok_kamar', 'pondok_pengajian_plotting', 'pondok_wali_kamar', 'pondok_guru',
        'pondok_kantin', 'pengguna', 'hak_akses', 'sekolah_plotting', 'sekolah_wali_kelas',
        'sekolah_guru_sekolah', 'sekolah_mapel', 'sekolah_guru_mapel', 'sekolah_buat_kelas',
        'sekolah_jam', 'sekolah_jadwal', 'sekolah_pengumuman', 'sekolah_jam_absensi',
        'capaian_materi', 'capaian_materi_kelas', 'manajemen_materi', 'target_pengajian',
        'jurnal_pengajian', 'rekap_jurnal', 'rekap_absensi'
    ];
BEGIN
    SELECT id INTO role_super_id FROM public.roles WHERE name = 'Super Admin' LIMIT 1;
    SELECT id INTO role_admin_id FROM public.roles WHERE name = 'Admin Ponpes' LIMIT 1;
    SELECT id INTO role_sekolah_id FROM public.roles WHERE name = 'Guru Sekolah' LIMIT 1;
    SELECT id INTO role_pondok_id FROM public.roles WHERE name = 'Guru Pondok' LIMIT 1;

    -- Super Admin: Full Permissions
    IF role_super_id IS NOT NULL THEN
        FOREACH m_key IN ARRAY all_menus LOOP
            INSERT INTO public.role_permissions (role_id, menu_key, can_view, can_input, can_edit, can_delete)
            VALUES (role_super_id, m_key, TRUE, TRUE, TRUE, TRUE)
            ON CONFLICT (role_id, menu_key) DO UPDATE SET
                can_view = TRUE, can_input = TRUE, can_edit = TRUE, can_delete = TRUE;
        END LOOP;
    END IF;

    -- Guru Sekolah Base Permissions
    IF role_sekolah_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, menu_key, can_view, can_input, can_edit, can_delete)
        VALUES 
            (role_sekolah_id, 'dashboard', TRUE, FALSE, FALSE, FALSE),
            (role_sekolah_id, 'dashboard_guru', TRUE, FALSE, FALSE, FALSE),
            (role_sekolah_id, 'presensi_guru', TRUE, TRUE, FALSE, FALSE),
            (role_sekolah_id, 'jurnal_mengajar', TRUE, TRUE, TRUE, TRUE),
            (role_sekolah_id, 'rekap_absensi_guru', TRUE, FALSE, FALSE, FALSE),
            (role_sekolah_id, 'rekap_sekolah', TRUE, FALSE, FALSE, FALSE),
            (role_sekolah_id, 'list', TRUE, FALSE, FALSE, FALSE),
            (role_sekolah_id, 'warga_guru', TRUE, FALSE, FALSE, FALSE),
            (role_sekolah_id, 'pelanggaran_input', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'pelanggaran_rekap', TRUE, FALSE, FALSE, FALSE),
            (role_sekolah_id, 'sekolah_plotting', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_wali_kelas', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_guru_sekolah', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_mapel', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_guru_mapel', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_buat_kelas', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_jam', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_jadwal', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_pengumuman', TRUE, TRUE, TRUE, FALSE),
            (role_sekolah_id, 'sekolah_jam_absensi', TRUE, TRUE, TRUE, FALSE)
        ON CONFLICT (role_id, menu_key) DO UPDATE SET
            can_view = EXCLUDED.can_view,
            can_input = EXCLUDED.can_input,
            can_edit = EXCLUDED.can_edit,
            can_delete = EXCLUDED.can_delete;
    END IF;

    -- Guru Pondok Base Permissions
    IF role_pondok_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, menu_key, can_view, can_input, can_edit, can_delete)
        VALUES 
            (role_pondok_id, 'dashboard', TRUE, FALSE, FALSE, FALSE),
            (role_pondok_id, 'form', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'absensi', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'perizinan_sakit', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'perizinan_sambang', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'perizinan_haid', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'perizinan_riwayat', TRUE, FALSE, FALSE, FALSE),
            (role_pondok_id, 'rekap_sholat', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'rekap_sekolah', TRUE, FALSE, FALSE, FALSE),
            (role_pondok_id, 'rekap_guru', TRUE, FALSE, FALSE, FALSE),
            (role_pondok_id, 'nfc_daftar', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'nfc_database', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'list', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'warga_guru', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'warga_pengurus', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'warga_mutasi', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'warga_lulus', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'pelanggaran_input', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'pelanggaran_rekap', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'capaian_materi', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'capaian_materi_kelas', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'target_pengajian', TRUE, TRUE, TRUE, FALSE),
            (role_pondok_id, 'jurnal_pengajian', TRUE, TRUE, TRUE, TRUE),
            (role_pondok_id, 'rekap_jurnal', TRUE, FALSE, FALSE, FALSE),
            (role_pondok_id, 'rekap_absensi', TRUE, TRUE, TRUE, FALSE)
        ON CONFLICT (role_id, menu_key) DO UPDATE SET
            can_view = EXCLUDED.can_view,
            can_input = EXCLUDED.can_input,
            can_edit = EXCLUDED.can_edit,
            can_delete = EXCLUDED.can_delete;
    END IF;
END $$;
