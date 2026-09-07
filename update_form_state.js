const fs = require('fs');

let code = fs.readFileSync('src/components/KantinPanel.tsx', 'utf-8');

// Replace state
code = code.replace(
  /const \[jenis, setJenis\] = useState<"masuk" \| "keluar">.*?\n.*?\n.*?\n/,
  `const [uangMasukStr, setUangMasukStr] = useState<string>("");
  const [uangKeluarStr, setUangKeluarStr] = useState<string>("");
`
);

// Replace submit function logic
const submitRegex = /const handleFormSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?triggerNotification\?\.\("Catatan transaksi kas kantin berhasil disimpan\.", "success"\);\n  \};/;
const newSubmit = `const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uangMasukNum = parseInt(uangMasukStr.replace(/[^0-9]/g, ""), 10) || 0;
    const uangKeluarNum = parseInt(uangKeluarStr.replace(/[^0-9]/g, ""), 10) || 0;
    
    if (uangMasukNum === 0 && uangKeluarNum === 0) {
      alert("Harap masukkan nominal uang masuk atau keluar!");
      return;
    }

    setIsSubmitting(true);
    // Asumsikan kita butuh menghitung kas dari transaksi sebelumnya.
    // Proyeksi kas akhir:
    let baseKas = 0;
    const kData = transaksiList.filter(t => t.kantin === selectedKantinInput);
    if (kData.length > 0) {
      baseKas = kData[0].jumlah_kas || 0;
    }
    const finalJumlahKas = baseKas + uangMasukNum - uangKeluarNum;

    const newRecord: TransaksiKantin = {
      id: "local_" + Date.now(),
      tanggal,
      kantin: selectedKantinInput,
      jenis: "rekap",
      uang_masuk: uangMasukNum,
      uang_keluar: uangKeluarNum,
      jumlah_kas: finalJumlahKas,
      keterangan: keterangan.trim() || "Rekap Harian",
      kategori: "Rekap",
      petugas: currentUser?.name || currentUser?.username || "Petugas Kantin",
      created_at: new Date().toISOString(),
      isLocalOnly: true,
    };

    // 1. Simpan langsung ke state & localStorage (cepat tanpa delay)
    const updated = [newRecord, ...transaksiList];
    setTransaksiList(updated);
    localStorage.setItem("pembukuan_kantin_data", JSON.stringify(updated));

    // Reset Form
    setUangMasukStr("");
    setUangKeluarStr("");
    setKeterangan("");
    setIsSubmitting(false);
    triggerNotification?.("Rekap harian kantin berhasil disimpan.", "success");
  };`;
code = code.replace(submitRegex, newSubmit);

fs.writeFileSync('src/components/KantinPanel.tsx', code);
