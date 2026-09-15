import re

with open("src/App.tsx", "r") as f:
    content = f.read()

old_payload = """      const payload: Partial<SantriData> = {
        kategori: formattedData.kategori,
        nama_lengkap: formattedData.nama_lengkap,
        jenis_kelamin: formattedData.jenis_kelamin || "L",
        
        // Retain plotting and identity data
        kamar: formattedData.kamar || "",
        kelas_pengajian: formattedData.kelas_pengajian || "",
        kelas_sekolah: formattedData.kelas_sekolah || "",
        foto: formattedData.foto || "",
        nfc_id: formattedData.nfc_id || "",
        
        // Fallback for removed fields to satisfy DB constraints
        nama_panggilan: "",
        nik: "",
        tempat_lahir: "",
        tanggal_lahir: "2000-01-01",
        alamat: "",
        rt: "001",
        rw: "001",
        desa_kelurahan: "",
        kecamatan: "",
        kabupaten_kota: "",
        provinsi: "",
        nama_ayah: "",
        nama_ibu: "",
        kelompok_sambung: "",
        desa_sambung: "",
        daerah: "",
        no_hp_ortu: "",
        nisn: null as any,
        npsn: null as any
      };"""

new_payload = """      const payload: Partial<SantriData> = {
        kategori: formattedData.kategori,
        nama_lengkap: formattedData.nama_lengkap,
        jenis_kelamin: formattedData.jenis_kelamin || "L",
        kamar: formattedData.kamar || "",
        kelas_pengajian: formattedData.kelas_pengajian || "",
        kelas_sekolah: formattedData.kelas_sekolah || "",
        foto: formattedData.foto || "",
        nfc_id: formattedData.nfc_id || "",
      };"""

content = content.replace(old_payload, new_payload)

with open("src/App.tsx", "w") as f:
    f.write(content)
