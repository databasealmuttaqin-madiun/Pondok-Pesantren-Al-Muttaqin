-- 1. Alter public.pengguna
ALTER TABLE public.pengguna 
  RENAME COLUMN role TO peran_utama;

ALTER TABLE public.pengguna 
  ADD COLUMN IF NOT EXISTS nama_lengkap TEXT,
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Convert existing roles to new peran_utama format if needed (optional cleanup)
UPDATE public.pengguna SET peran_utama = 'super_admin' WHERE peran_utama = 'super admin';
UPDATE public.pengguna SET peran_utama = 'guru_pondok' WHERE peran_utama = 'guru pondok';
UPDATE public.pengguna SET peran_utama = 'guru_sekolah' WHERE peran_utama = 'guru SMP' OR peran_utama = 'guru SMA';

-- 2. Alter public.guru to link with pengguna
ALTER TABLE public.guru 
  ADD COLUMN IF NOT EXISTS pengguna_id UUID REFERENCES public.pengguna(id) ON DELETE SET NULL;

-- 3. Create public.pengurus table
CREATE TABLE IF NOT EXISTS public.pengurus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    nama_lengkap TEXT NOT NULL,
    pengguna_id UUID REFERENCES public.pengguna(id) ON DELETE SET NULL,
    jenis_kelamin TEXT,
    nomor_hp TEXT,
    jabatan TEXT
);

ALTER TABLE public.pengurus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select pengurus" ON public.pengurus FOR SELECT USING (true);
CREATE POLICY "Allow public insert pengurus" ON public.pengurus FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update pengurus" ON public.pengurus FOR UPDATE USING (true);
CREATE POLICY "Allow public delete pengurus" ON public.pengurus FOR DELETE USING (true);

-- 4. Create trigger function for automatic sync to Master Data Warga
CREATE OR REPLACE FUNCTION public.sync_pengguna_to_warga()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when status_akun changes to 'approved'
    IF NEW.status_akun = 'approved' AND (OLD.status_akun IS NULL OR OLD.status_akun != 'approved') THEN
        
        -- Sync to guru if peran_utama is guru_pondok or guru_sekolah
        IF NEW.peran_utama IN ('guru_pondok', 'guru_sekolah') THEN
            INSERT INTO public.guru (nama_lengkap, pengguna_id, created_at)
            VALUES (COALESCE(NEW.nama_lengkap, NEW.username), NEW.id, now());
            
        -- Sync to pengurus if peran_utama is pengurus
        ELSIF NEW.peran_utama = 'pengurus' THEN
            INSERT INTO public.pengurus (nama_lengkap, pengguna_id, created_at)
            VALUES (COALESCE(NEW.nama_lengkap, NEW.username), NEW.id, now());
        END IF;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach Trigger to public.pengguna
DROP TRIGGER IF EXISTS trigger_sync_pengguna ON public.pengguna;
CREATE TRIGGER trigger_sync_pengguna
    AFTER UPDATE OF status_akun ON public.pengguna
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_pengguna_to_warga();
