import { createClient } from "@supabase/supabase-js";

// Try loading from localStorage first, then default to the hardcoded credentials
const getSupabaseConfig = () => {
  let url = "https://eflhcunxpckcynozywol.supabase.co";
  let key = "sb_publishable_fqZTO3lL9cb88K61NXjKHw_zH8O3TuZ";

  if (typeof window !== "undefined") {
    const localUrl = localStorage.getItem("supabase_url");
    const localKey = localStorage.getItem("supabase_anon_key");
    if (localUrl) {
      // Clean up spaces, quotes, and trailing slashes
      url = localUrl.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");
    }
    if (localKey) {
      key = localKey.trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return { url, key };
};

const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.key);

// Table name where we store santri data
export const TABLE_NAME = "santri";

export interface SantriData {
  id?: number;
  created_at?: string;
  kategori: "SMP" | "SMA" | "Reguler";
  nama_lengkap: string;
  nama_panggilan: string;
  nik: string; // Must be 16 digits
  nisn?: string; // Optional (Required for SMP/SMA)
  npsn?: string; // Optional (Required for Reguler)
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat: string;
  rt: string; // Must be 3 digits (e.g. 001)
  rw: string; // Must be 3 digits (e.g. 001)
  desa_kelurahan: string;
  kecamatan: string;
  kabupaten_kota: string;
  provinsi: string;
  nama_ayah: string;
  nama_ibu: string;
  kelompok_sambung: string;
  desa_sambung: string;
  daerah: string;
  kamar?: string;
  kelas_pengajian?: string;
  kelas_sekolah?: string;
  status?: "Aktif" | "Sakit" | "Pulang";
  jenis_kelamin?: "L" | "P";
  nfc_id?: string;
}

/**
 * Helper to capitalize the first letter of each word (Title Case),
 * preserving specific uppercase structures like SMP, SMA, etc.
 */
export function toTitleCase(str: string | undefined | null): string {
  if (!str) return "";
  const trimmed = str.trim();
  const upper = trimmed.toUpperCase();
  if (upper === "SMP" || upper === "SMA" || upper === "REGULER") {
    return upper;
  }
  return trimmed
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Formats all personal data fields of a SantriData object to Title Case.
 */
export function formatSantriData(s: SantriData): SantriData {
  return {
    ...s,
    nama_lengkap: toTitleCase(s.nama_lengkap),
    nama_panggilan: toTitleCase(s.nama_panggilan),
    tempat_lahir: toTitleCase(s.tempat_lahir),
    alamat: toTitleCase(s.alamat),
    desa_kelurahan: toTitleCase(s.desa_kelurahan),
    kecamatan: toTitleCase(s.kecamatan),
    kabupaten_kota: toTitleCase(s.kabupaten_kota),
    provinsi: toTitleCase(s.provinsi),
    nama_ayah: toTitleCase(s.nama_ayah),
    nama_ibu: toTitleCase(s.nama_ibu),
    kelompok_sambung: toTitleCase(s.kelompok_sambung),
    desa_sambung: toTitleCase(s.desa_sambung),
    daerah: toTitleCase(s.daerah),
    kamar: s.kamar ? toTitleCase(s.kamar) : "",
    kelas_pengajian: s.kelas_pengajian ? toTitleCase(s.kelas_pengajian) : "",
    kelas_sekolah: s.kelas_sekolah ? toTitleCase(s.kelas_sekolah) : "",
    status: s.status || "Aktif",
    jenis_kelamin: s.jenis_kelamin || "L",
    nfc_id: s.nfc_id || "",
  };
}
