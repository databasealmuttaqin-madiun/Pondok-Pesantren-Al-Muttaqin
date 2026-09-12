import fs from 'fs';
let content = fs.readFileSync('src/components/PerizinanPanel.tsx', 'utf-8');

const regexFetch = /const fetchPerizinanData = async \(\) => \{[\s\S]*?  \};/m;

const fetchCode = `const fetchPerizinanData = async () => {
    setIsLoading(true);
    setTableMissingWarning(false);
    try {
      const [sambangRes, sakitRes, haidRes] = await Promise.all([
        supabase.from("izin_sambang").select("*").order("id", { ascending: false }),
        supabase.from("izin_sakit").select("*").order("id", { ascending: false }),
        supabase.from("izin_haid").select("*").order("id", { ascending: false }),
      ]);

      const err = sambangRes.error || sakitRes.error || haidRes.error;
      if (err) {
        if (err.code === "42P01" || err.code === "PGRST205" || err.message.includes("does not exist")) {
          setTableMissingWarning(true);
        }
        throw err;
      }

      let allItems: any[] = [];
      if (sambangRes.data) {
        allItems = allItems.concat(sambangRes.data.map(d => ({ 
          ...d, 
          kategori_izin: "sambang",
          keperluan: d.keperluan ? \`\${d.keperluan} (Tujuan: \${d.tujuan || 'Tidak ada'})\` : (d.tujuan || 'Sambang')
        })));
      }
      if (sakitRes.data) {
        allItems = allItems.concat(sakitRes.data.map(d => ({ ...d, kategori_izin: "sakit" })));
      }
      if (haidRes.data) {
        allItems = allItems.concat(haidRes.data.map(d => ({ ...d, kategori_izin: "haid", keperluan: "Berhalangan Sholat / Haid" })));
      }

      setItems(allItems.sort((a, b) => {
         const dA = new Date(a.created_at || a.tanggal_mulai).getTime();
         const dB = new Date(b.created_at || b.tanggal_mulai).getTime();
         return dB - dA;
      }) as PerizinanItem[]);
    } catch (err: any) {
      console.warn("Gagal load perizinan dari Supabase:", err.message);
      // Fallback: read from localStorage
      const localData = localStorage.getItem("local_perizinan_records");
      if (localData) {
        try {
          setItems(JSON.parse(localData));
        } catch {
          setItems([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };`;

// replace the old fetchPerizinanData
const newContent = content.substring(0, content.indexOf('const fetchPerizinanData = async () => {')) 
  + fetchCode 
  + content.substring(content.indexOf('  const fetchPerizinanDataRef = useRef(fetchPerizinanData);'));

fs.writeFileSync('src/components/PerizinanPanel.tsx', newContent);
