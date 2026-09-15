import re

with open("src/supabaseClient.ts", "r") as f:
    content = f.read()

old_interface = """export interface SantriData {
  id?: number;
  created_at?: string;
  kategori: "SMP" | "SMA" | "Reguler";
  nama_lengkap: string;
  jenis_kelamin?: "L" | "P";
  
  // Plotted fields
  kamar?: string;
  kelas_pengajian?: string;
  kelas_sekolah?: string;
  
  // Other fields
  status?: "Aktif" | "Sakit" | "Pulang" | "Haid";
  nfc_id?: string;
  foto?: string;
  
  // Deprecated/Optional fields
  nama_panggilan?: string;
  nik?: string;
  nisn?: string;
  npsn?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  alamat?: string;
  rt?: string;
  rw?: string;
  desa_kelurahan?: string;
  kecamatan?: string;
  kabupaten_kota?: string;
  provinsi?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  kelompok_sambung?: string;
  desa_sambung?: string;
  daerah?: string;
  no_hp_ortu?: string;
}"""

new_interface = """export interface SantriData {
  id?: number;
  created_at?: string;
  kategori: "SMP" | "SMA" | "Reguler";
  nama_lengkap: string;
  jenis_kelamin?: "L" | "P";
  
  // Plotted fields
  kamar?: string;
  kelas_pengajian?: string;
  kelas_sekolah?: string;
  
  // Other fields
  status?: "Aktif" | "Sakit" | "Pulang" | "Haid";
  nfc_id?: string;
  foto?: string;
}"""

content = content.replace(old_interface, new_interface)

with open("src/supabaseClient.ts", "w") as f:
    f.write(content)
