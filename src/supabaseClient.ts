import { createClient } from "@supabase/supabase-js";

export const DEFAULT_SUPABASE_URL = "https://eflhcunxpckcynozywol.supabase.co";
export const DEFAULT_SUPABASE_KEY = "sb_publishable_fqZTO3lL9cb88K61NXjKHw_zH8O3TuZ";

// Try loading from localStorage if explicitly set and matches the project, otherwise default to primary credentials
const getSupabaseConfig = () => {
  let url = DEFAULT_SUPABASE_URL;
  let key = DEFAULT_SUPABASE_KEY;

  if (typeof window !== "undefined") {
    const localUrl = localStorage.getItem("supabase_url");
    const localKey = localStorage.getItem("supabase_anon_key");
    
    // If user has old/different url in localStorage that is not eflhcunxpckcynozywol, clear it to connect to real db
    if (localUrl && !localUrl.includes("eflhcunxpckcynozywol")) {
      localStorage.removeItem("supabase_url");
      localStorage.removeItem("supabase_anon_key");
    } else {
      if (localUrl) {
        url = localUrl.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");
      }
      if (localKey) {
        key = localKey.trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }
  return { url, key };
};

const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.key);

export const resetToDefaultSupabase = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("supabase_url");
    localStorage.removeItem("supabase_anon_key");
  }
};

// Table name where we store student data (diambil dari tabel siswa)
export const TABLE_NAME = "siswa";

export interface SantriData {
  id?: number;
  created_at?: string;
  kategori: "SMP" | "SMA" | "Reguler";
  nama_lengkap: string;
  jenis_kelamin?: "L" | "P";
  kelompok_sambung?: string;
  desa_sambung?: string;
  daerah?: string;
  no_hp_ortu?: string;
  
  // Plotted fields
  kamar?: string;
  kelas_pengajian?: string;
  kelas_sekolah?: string;
  
  // Other fields
  status?: "Aktif" | "Sakit" | "Pulang" | "Haid";
  nfc_id?: string;
  foto?: string;

  // Additional detail fields
  nisn?: string;
  nik?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  no_hp?: string;
  nama_ayah?: string;
  no_hp_ayah?: string;
  nama_ibu?: string;
  no_hp_ibu?: string;
  alamat?: string;
  status_asrama?: string;
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
    kamar: s.kamar ? toTitleCase(s.kamar) : "",
    kelas_pengajian: s.kelas_pengajian ? toTitleCase(s.kelas_pengajian) : "",
    kelas_sekolah: s.kelas_sekolah ? toTitleCase(s.kelas_sekolah) : "",
    kelompok_sambung: s.kelompok_sambung ? toTitleCase(s.kelompok_sambung) : "",
    desa_sambung: s.desa_sambung ? toTitleCase(s.desa_sambung) : "",
    daerah: s.daerah ? toTitleCase(s.daerah) : "",
    nama_ayah: s.nama_ayah ? toTitleCase(s.nama_ayah) : "",
    nama_ibu: s.nama_ibu ? toTitleCase(s.nama_ibu) : "",
    tempat_lahir: s.tempat_lahir ? toTitleCase(s.tempat_lahir) : "",
    status: s.status || "Aktif",
    jenis_kelamin: s.jenis_kelamin || "L",
  };
}
