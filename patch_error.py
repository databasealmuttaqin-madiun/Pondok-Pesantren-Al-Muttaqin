import re

with open("src/components/ManajemenSesiPanel.tsx", "r") as f:
    content = f.read()

# Add dbError state
content = content.replace('const [showAddForm, setShowAddForm] = useState(false);', 'const [showAddForm, setShowAddForm] = useState(false);\n  const [dbError, setDbError] = useState(false);')

# Update fetchSesi
fetch_mod = """
  const fetchSesi = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("sesi_mengaji")
      .select("*")
      .order("urutan", { ascending: true });
    
    if (error) {
      console.error(error);
      if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
        setDbError(true);
      } else {
        alert("Error: " + error.message);
      }
    } else {
      setSesiList(data || []);
      setDbError(false);
    }
    setIsLoading(false);
  };
"""
content = re.sub(r'const fetchSesi = async \(\) => \{.*?\setIsLoading\(false\);\n  \};', fetch_mod.strip(), content, flags=re.DOTALL)

# Add error UI
error_ui = """
      {dbError && (
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800 mb-6">
          <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Perhatian: Tabel Database Belum Dibuat!</h3>
          <p className="text-sm text-red-700 dark:text-red-400 mb-4">
            Sistem mendeteksi bahwa tabel <strong>sesi_mengaji</strong> belum ada di database Supabase Anda. Anda perlu menjalankan kode SQL berikut di <strong>SQL Editor Supabase</strong>:
          </p>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto select-all">
{`-- 1. Buat Tabel Sesi Mengaji
CREATE TABLE public.sesi_mengaji (
    id SERIAL PRIMARY KEY,
    nama_sesi TEXT NOT NULL,
    urutan INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tambahkan kolom sesi_id ke jurnal_pengajian
ALTER TABLE public.jurnal_pengajian 
ADD COLUMN sesi_id INT REFERENCES public.sesi_mengaji(id) ON DELETE SET NULL;

-- 3. Set RLS (Row Level Security) agar tabel bisa diakses
ALTER TABLE public.sesi_mengaji ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bisa dibaca oleh semua" ON public.sesi_mengaji FOR SELECT USING (true);
CREATE POLICY "Bisa diubah oleh pengguna login" ON public.sesi_mengaji USING (auth.role() = 'authenticated');

-- 4. Isi Data Sesi Awal
INSERT INTO public.sesi_mengaji (nama_sesi, urutan) VALUES 
('Sesi 1 (Subuh)', 1),
('Sesi 2 (Sore)', 2),
('Sesi 3 (Malam)', 3);`}
          </pre>
          <p className="text-xs text-red-600 dark:text-red-400 mt-3 font-semibold">
            Setelah Anda menjalankan SQL di atas di Supabase, silakan refresh halaman ini.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
"""

content = content.replace('<div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">', error_ui.strip())

with open("src/components/ManajemenSesiPanel.tsx", "w") as f:
    f.write(content)
