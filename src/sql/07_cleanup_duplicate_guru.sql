-- ============================================================================
-- SKRIP PEMBERSIHAN DATA GURU GANDA (DUPLIKAT) DI SUPABASE
-- ============================================================================
-- Skrip ini aman dijalankan jika di tabel 'guru' terdapat nama guru yang
-- terinput lebih dari 1 kali akibat import berulang atau plotting masa lalu.
-- 
-- Skrip ini memprioritaskan:
-- 1. Baris yang sudah terhubung dengan 'pengguna_id'
-- 2. Baris dengan ID awal yang valid
-- ============================================================================

-- 1. Update relasi plotting_guru_sekolah agar mengarah ke ID guru utama sebelum menghapus
WITH primary_guru AS (
  SELECT 
    id,
    nama_lengkap,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(REGEXP_REPLACE(nama_lengkap, '(\.|,|S\.Pd\.I|S\.Pd|S\.S|M\.Pd|S\.Kom|S\.Ag|M\.Ag|Lc|Ust\.|Ustadz|Dr\.|Drs\.|Dra\.)', '', 'gi')))
      ORDER BY 
        CASE WHEN pengguna_id IS NOT NULL THEN 0 ELSE 1 END,
        id ASC
    ) as rn
  FROM guru
),
duplicates AS (
  SELECT g.id as dup_id, p.id as primary_id
  FROM guru g
  JOIN primary_guru p ON LOWER(TRIM(REGEXP_REPLACE(g.nama_lengkap, '(\.|,|S\.Pd\.I|S\.Pd|S\.S|M\.Pd|S\.Kom|S\.Ag|M\.Ag|Lc|Ust\.|Ustadz|Dr\.|Drs\.|Dra\.)', '', 'gi'))) = 
                         LOWER(TRIM(REGEXP_REPLACE(p.nama_lengkap, '(\.|,|S\.Pd\.I|S\.Pd|S\.S|M\.Pd|S\.Kom|S\.Ag|M\.Ag|Lc|Ust\.|Ustadz|Dr\.|Drs\.|Dra\.)', '', 'gi')))
  WHERE p.rn = 1 AND g.id <> p.id
)
UPDATE plotting_guru_sekolah
SET guru_id = duplicates.primary_id
FROM duplicates
WHERE plotting_guru_sekolah.guru_id = duplicates.dup_id;

-- 2. Update relasi plotting_guru_pondok
WITH primary_guru AS (
  SELECT 
    id,
    nama_lengkap,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(REGEXP_REPLACE(nama_lengkap, '(\.|,|S\.Pd\.I|S\.Pd|S\.S|M\.Pd|S\.Kom|S\.Ag|M\.Ag|Lc|Ust\.|Ustadz|Dr\.|Drs\.|Dra\.)', '', 'gi')))
      ORDER BY 
        CASE WHEN pengguna_id IS NOT NULL THEN 0 ELSE 1 END,
        id ASC
    ) as rn
  FROM guru
),
duplicates AS (
  SELECT g.id as dup_id, p.id as primary_id
  FROM guru g
  JOIN primary_guru p ON LOWER(TRIM(REGEXP_REPLACE(g.nama_lengkap, '(\.|,|S\.Pd\.I|S\.Pd|S\.S|M\.Pd|S\.Kom|S\.Ag|M\.Ag|Lc|Ust\.|Ustadz|Dr\.|Drs\.|Dra\.)', '', 'gi'))) = 
                         LOWER(TRIM(REGEXP_REPLACE(p.nama_lengkap, '(\.|,|S\.Pd\.I|S\.Pd|S\.S|M\.Pd|S\.Kom|S\.Ag|M\.Ag|Lc|Ust\.|Ustadz|Dr\.|Drs\.|Dra\.)', '', 'gi')))
  WHERE p.rn = 1 AND g.id <> p.id
)
UPDATE plotting_guru_pondok
SET guru_id = duplicates.primary_id
FROM duplicates
WHERE plotting_guru_pondok.guru_id = duplicates.dup_id;

-- 3. Hapus baris duplikat dari tabel guru
WITH ranked_guru AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(REGEXP_REPLACE(nama_lengkap, '(\.|,|S\.Pd\.I|S\.Pd|S\.S|M\.Pd|S\.Kom|S\.Ag|M\.Ag|Lc|Ust\.|Ustadz|Dr\.|Drs\.|Dra\.)', '', 'gi')))
      ORDER BY 
        CASE WHEN pengguna_id IS NOT NULL THEN 0 ELSE 1 END,
        id ASC
    ) as rn
  FROM guru
)
DELETE FROM guru
WHERE id IN (
  SELECT id FROM ranked_guru WHERE rn > 1
);
