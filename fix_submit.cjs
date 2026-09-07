const fs = require('fs');
let code = fs.readFileSync('src/components/KantinPanel.tsx', 'utf-8');

const submitRegex = /const handleFormSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?triggerNotification\?\.\("Catatan transaksi kas kantin berhasil disimpan\.", "success"\);\n\n    \/\/ 2\. Sync asynchronously to Supabase/m;

const newSubmit = `const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uangMasukNum = parseInt(uangMasukStr.replace(/\\D/g, "") || "0", 10);
    const uangKeluarNum = parseInt(uangKeluarStr.replace(/\\D/g, "") || "0", 10);
    
    if (uangMasukNum === 0 && uangKeluarNum === 0) {
      alert("Harap masukkan nominal uang masuk atau keluar!");
      return;
    }

    if (!keterangan.trim()) {
      alert("Harap masukkan keterangan transaksi!");
      return;
    }

    setIsSubmitting(true);
    const finalJumlahKas = proyeksiKas;

    const newRecord: TransaksiKantin = {
      id: "local_" + Date.now(),
      tanggal,
      kantin: selectedKantinInput,
      jenis: "rekap",
      uang_masuk: uangMasukNum,
      uang_keluar: uangKeluarNum,
      jumlah_kas: finalJumlahKas,
      keterangan: keterangan.trim(),
      kategori: "Rekap Harian",
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

    // 2. Sync asynchronously to Supabase`;

code = code.replace(submitRegex, newSubmit);
fs.writeFileSync('src/components/KantinPanel.tsx', code);
