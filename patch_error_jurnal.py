import re

with open("src/components/JurnalPengajianPanel.tsx", "r") as f:
    content = f.read()

# Add dbMissing state
content = content.replace('const [existingJurnal, setExistingJurnal] = useState<any>(null);', 'const [existingJurnal, setExistingJurnal] = useState<any>(null);\n  const [dbMissing, setDbMissing] = useState(false);')

# Update fetchSesi error handling
fetch_sesi_code = """
      // Fetch Sesi
      const { data: sesiData, error: sesiError } = await supabase.from("sesi_mengaji").select("*").order("urutan", { ascending: true });
      if (sesiError && (sesiError.code === 'PGRST205' || sesiError.message.includes('table'))) {
        setDbMissing(true);
      }
      if (sesiData) {
        setSesiList(sesiData);
        if (sesiData.length > 0) setSelectedSesi(sesiData[0].id.toString());
      }
"""
content = re.sub(r'// Fetch Sesi.*?if \(sesiData\) \{.*?\}', fetch_sesi_code.strip(), content, flags=re.DOTALL)

# Add error UI
error_ui = """
      {dbMissing && (
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800 mb-6">
          <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Tabel Sesi Belum Dibuat di Database</h3>
          <p className="text-sm text-red-700 dark:text-red-400 mb-4">
            Fitur Jurnal Pengajian tidak dapat dimuat karena tabel <strong>sesi_mengaji</strong> belum ditambahkan ke Supabase.
            Silakan buka menu <strong>Manajemen Pondok &gt; Sesi Mengaji</strong> untuk menyalin kode SQL pembuatan tabelnya.
          </p>
        </div>
      )}
"""
content = content.replace('{/* FILTER BAR ATAS */}', error_ui.strip() + '\n\n      {/* FILTER BAR ATAS */}')

with open("src/components/JurnalPengajianPanel.tsx", "w") as f:
    f.write(content)
