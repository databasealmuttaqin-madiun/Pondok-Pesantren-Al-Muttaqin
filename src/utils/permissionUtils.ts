import { useState, useEffect } from "react";
import {
  Home,
  UserPlus,
  ClipboardList,
  LayoutDashboard,
  Clock,
  BookOpen,
  FileSpreadsheet,
  HeartPulse,
  Footprints,
  Droplets,
  UserCheck,
  Moon,
  School,
  Fingerprint,
  Database,
  Users,
  GraduationCap,
  Shield,
  UserMinus,
  Award,
  ShieldAlert,
  Store,
  Receipt,
  Sliders,
  Plus,
  Calendar,
  Megaphone,
  QrCode,
  Target,
  ClipboardEdit,
  FileText,
  Lock,
  TrendingUp
} from "lucide-react";

export interface PermissionAction {
  can_view: boolean;
  can_input: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export type MenuPermissionsMap = Record<string, PermissionAction>;

export interface MenuItemCatalog {
  key: string;
  name: string;
  category: string;
  description: string;
  icon: any;
  defaultPermissions?: PermissionAction;
}

// Complete 1-to-1 Sidebar Menu Catalog (Matches all Sidebar groups and submenus)
export const CORE_SIDEBAR_MENUS: MenuItemCatalog[] = [
  // 1. UTAMA
  {
    key: "dashboard",
    name: "Dasbor Utama",
    category: "UTAMA",
    description: "Statistik global santri, grafik presensi, dan ringkasan dasbor.",
    icon: Home,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },
  {
    key: "form",
    name: "Pendaftaran Siswa / Form",
    category: "UTAMA",
    description: "Formulir pendaftaran santri baru dan input data awal santri.",
    icon: UserPlus,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "absensi",
    name: "Absensi Siswa (Harian)",
    category: "UTAMA",
    description: "Scan presensi kartu santri dan pencatatan absensi harian.",
    icon: ClipboardList,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },

  // 2. SEKOLAH
  {
    key: "dashboard_guru",
    name: "Dashboard Guru",
    category: "SEKOLAH",
    description: "Dasbor aktivitas harian mengajar dan jadwal sekolah guru.",
    icon: LayoutDashboard,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },
  {
    key: "presensi_guru",
    name: "Presensi Guru",
    category: "SEKOLAH",
    description: "Presensi kehadiran guru berbasis jam absensi sekolah.",
    icon: Clock,
    defaultPermissions: { can_view: true, can_input: true, can_edit: false, can_delete: false }
  },
  {
    key: "jurnal_mengajar",
    name: "Jurnal Mengajar",
    category: "SEKOLAH",
    description: "Pengisian jurnal tatap muka kelas, materi, dan absensi jam pelajaran.",
    icon: BookOpen,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "rekap_absensi_guru",
    name: "Rekap Absensi Guru",
    category: "SEKOLAH",
    description: "Laporan rekapitulasi kehadiran dan jam mengajar guru formal.",
    icon: FileSpreadsheet,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },

  // 3. PERIZINAN
  {
    key: "perizinan_sakit",
    name: "Perizinan: Sakit",
    category: "PERIZINAN",
    description: "Formulir izin santri sakit, klinik poskestren, dan riwayat medis.",
    icon: HeartPulse,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "perizinan_sambang",
    name: "Perizinan: Sambang / Pulang",
    category: "PERIZINAN",
    description: "Izin kunjungan wali santri, izin pulang, dan cetak surat jalan.",
    icon: Footprints,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "perizinan_haid",
    name: "Perizinan: Haid (Santriwati)",
    category: "PERIZINAN",
    description: "Pencatatan siklus uzur syar'i / haid santriwati dan dispensasi ibadah.",
    icon: Droplets,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "perizinan_riwayat",
    name: "Perizinan: Riwayat Perizinan",
    category: "PERIZINAN",
    description: "Arsip dan log lengkap seluruh riwayat izin keluar/masuk santri.",
    icon: Clock,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },

  // 4. REKAP PRESENSI
  {
    key: "rekap_guru",
    name: "Rekap: Presensi Guru",
    category: "REKAP PRESENSI",
    description: "Laporan presensi guru pondok & sekolah per periode bulan.",
    icon: UserCheck,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },
  {
    key: "rekap_sholat",
    name: "Rekap: Sholat Berjamaah",
    category: "REKAP PRESENSI",
    description: "Rekap kehadiran sholat fardhu berjamaah dan kegiatan asrama.",
    icon: Moon,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "rekap_sekolah",
    name: "Rekap: Siswa Sekolah",
    category: "REKAP PRESENSI",
    description: "Rekapitulasi absensi santri di sekolah formal (SMP/SMA).",
    icon: School,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },

  // 5. REGISTRASI NFC
  {
    key: "nfc_daftar",
    name: "Registrasi: Daftar Kartu NFC",
    category: "REGISTRASI NFC",
    description: "Perekaman UID chip smartcard RFID / NFC santri baru.",
    icon: Fingerprint,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "nfc_database",
    name: "Registrasi: Database Kartu",
    category: "REGISTRASI NFC",
    description: "Daftar seluruh kartu NFC terdaftar dan status kepemilikan.",
    icon: Database,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },

  // 6. DATA WARGA
  {
    key: "list",
    name: "Data Warga: Siswa / Santri",
    category: "DATA WARGA",
    description: "Database seluruh santri aktif, biodata, dan profil lengkap.",
    icon: Users,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "warga_guru",
    name: "Data Warga: Guru",
    category: "DATA WARGA",
    description: "Database dewan asatidz & guru pengajar pondok maupun formal.",
    icon: GraduationCap,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "warga_pengurus",
    name: "Data Warga: Pengurus",
    category: "DATA WARGA",
    description: "Database staf pengurus asrama, bagian keamanan, dan pimpinan.",
    icon: Shield,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "warga_mutasi",
    name: "Data Warga: Mutasi",
    category: "DATA WARGA",
    description: "Daftar santri mutasi, pindah pondok, atau keluar.",
    icon: UserMinus,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "warga_lulus",
    name: "Data Warga: Alumni / Lulus",
    category: "DATA WARGA",
    description: "Arsip data santri yang telah lulus / alumni pesantren.",
    icon: Award,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },

  // 7. PELANGGARAN
  {
    key: "pelanggaran_input",
    name: "Pelanggaran: Input Pelanggaran",
    category: "PELANGGARAN",
    description: "Pencatatan poin pelanggaran tata tertib dan tindakan indisipliner santri.",
    icon: ShieldAlert,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "pelanggaran_rekap",
    name: "Pelanggaran: Daftar Pelanggaran",
    category: "PELANGGARAN",
    description: "Laporan rekapitulasi poin pelanggaran santri dan status sanksi.",
    icon: ClipboardList,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },

  // 8. KANTIN
  {
    key: "kantin_input",
    name: "Kantin: Input Kas",
    category: "KANTIN",
    description: "Pencatatan transaksi kas masuk dan kas keluar harian kantin.",
    icon: Receipt,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "kantin_rekap",
    name: "Kantin: Rekap Pembukuan",
    category: "KANTIN",
    description: "Laporan pembukuan keuangan, rekap laba rugi, dan saldo kas kantin.",
    icon: Store,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },

  // 9. MANAJEMEN PONDOK
  {
    key: "pondok_sesi",
    name: "Pondok: Sesi Mengaji",
    category: "MANAJEMEN PONDOK",
    description: "Konfigurasi jadwal waktu sesi ngaji subuh, sore, dan malam.",
    icon: Clock,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "pondok_kamar",
    name: "Pondok: Plotting Kamar",
    category: "MANAJEMEN PONDOK",
    description: "Plotting pembagian santri ke kamar asrama pondok.",
    icon: Home,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "pondok_pengajian_plotting",
    name: "Pondok: Kelas Pengajian",
    category: "MANAJEMEN PONDOK",
    description: "Plotting santri ke rombel / halaqah ngaji weton & sorogan.",
    icon: BookOpen,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "pondok_wali_kamar",
    name: "Pondok: Wali Kamar",
    category: "MANAJEMEN PONDOK",
    description: "Penugasan ustaz/pengurus sebagai pembimbing wali kamar santri.",
    icon: UserCheck,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "pondok_guru",
    name: "Pondok: Guru Pondok",
    category: "MANAJEMEN PONDOK",
    description: "Manajemen data penugasan dewan guru asatidz pengajian pondok.",
    icon: GraduationCap,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "pondok_kantin",
    name: "Pondok: Master Kantin",
    category: "MANAJEMEN PONDOK",
    description: "Pengaturan master kantin pondok dan penugasan pengelola.",
    icon: Store,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "pengguna",
    name: "Pondok: Manajemen Akun",
    category: "MANAJEMEN PONDOK",
    description: "Persetujuan akun registrasi staf, reset password, dan daftar pengguna.",
    icon: Shield,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "hak_akses",
    name: "Pondok: Hak Akses & Peran",
    category: "MANAJEMEN PONDOK",
    description: "Pengaturan role permissions base dan kontrol visibilitas sidebar.",
    icon: Lock,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },

  // 10. MANAJEMEN SEKOLAH
  {
    key: "sekolah_plotting",
    name: "Sekolah: Plotting Kelas",
    category: "MANAJEMEN SEKOLAH",
    description: "Penempatan rombel siswa ke kelas formal (SMP/SMA).",
    icon: Sliders,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_wali_kelas",
    name: "Sekolah: Wali Kelas",
    category: "MANAJEMEN SEKOLAH",
    description: "Penugasan guru sebagai wali kelas formal.",
    icon: UserCheck,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_guru_sekolah",
    name: "Sekolah: Guru Sekolah",
    category: "MANAJEMEN SEKOLAH",
    description: "Data penugasan dan daftar guru sekolah formal.",
    icon: GraduationCap,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_mapel",
    name: "Sekolah: Mata Pelajaran",
    category: "MANAJEMEN SEKOLAH",
    description: "Master kurikulum mata pelajaran sekolah formal.",
    icon: BookOpen,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_guru_mapel",
    name: "Sekolah: Guru Mapel",
    category: "MANAJEMEN SEKOLAH",
    description: "Plotting guru pengampu untuk setiap mata pelajaran dan kelas.",
    icon: GraduationCap,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_buat_kelas",
    name: "Sekolah: Buat Kelas",
    category: "MANAJEMEN SEKOLAH",
    description: "Pembuatan tingkatan kelas baru (7A, 8B, 9C, dsb).",
    icon: Plus,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_jam",
    name: "Sekolah: Jam Pelajaran",
    category: "MANAJEMEN SEKOLAH",
    description: "Pengaturan sesi jam ke-1, ke-2, istirahat, dsb.",
    icon: Clock,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_jadwal",
    name: "Sekolah: Jadwal Pelajaran",
    category: "MANAJEMEN SEKOLAH",
    description: "Penyusunan jadwal KBM mingguan kelas sekolah formal.",
    icon: Calendar,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_pengumuman",
    name: "Sekolah: Pengumuman",
    category: "MANAJEMEN SEKOLAH",
    description: "Publikasi agenda pengumuman akademik sekolah formal.",
    icon: Megaphone,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "sekolah_jam_absensi",
    name: "Sekolah: Plotting Jam Absensi",
    category: "MANAJEMEN SEKOLAH",
    description: "Plotting batas jam masuk & pulang absensi guru sekolah.",
    icon: QrCode,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },

  // 11. CAPAIAN MATERI
  {
    key: "capaian_materi",
    name: "Capaian: Siswa / Santri",
    category: "CAPAIAN MATERI",
    description: "Progress khataman kitab, hafalan Qur'an, dan target perorangan santri.",
    icon: Award,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "capaian_materi_kelas",
    name: "Capaian: Kelas / Asrama",
    category: "CAPAIAN MATERI",
    description: "Grafik capaian materi pengajian per rombel kelas / kamar asrama.",
    icon: TrendingUp,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },

  // 12. PENGAJIAN
  {
    key: "manajemen_materi",
    name: "Pengajian: Master Materi",
    category: "PENGAJIAN",
    description: "Master kitab kuning, bab pengajian, dan target kurikulum pondok.",
    icon: BookOpen,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "target_pengajian",
    name: "Pengajian: Target Capaian",
    category: "PENGAJIAN",
    description: "Setting target khataman per semester untuk masing-masing kelas ngaji.",
    icon: Target,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "jurnal_pengajian",
    name: "Pengajian: Jurnal & Absensi",
    category: "PENGAJIAN",
    description: "Input jurnal materi ngaji dan presensi santri per halaqah pengajian.",
    icon: ClipboardEdit,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "rekap_jurnal",
    name: "Pengajian: Rekap Jurnal",
    category: "PENGAJIAN",
    description: "Laporan rekapitulasi materi ngaji yang telah diajarkan guru pengajian.",
    icon: FileText,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },
  {
    key: "rekap_absensi",
    name: "Pengajian: Rekap Absensi",
    category: "PENGAJIAN",
    description: "Laporan rekapitulasi kehadiran santri dalam kegiatan pengajian pondok.",
    icon: ClipboardList,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  }
];

/**
 * Normalizes and enforces hierarchical permission dependency rules:
 * Rule 1: If can_input, can_edit, or can_delete is true, can_view MUST be true.
 * Rule 2: If can_view is false, all actions MUST be false.
 */
export function normalizePermission(action: Partial<PermissionAction>): PermissionAction {
  const can_input = Boolean(action.can_input);
  const can_edit = Boolean(action.can_edit);
  const can_delete = Boolean(action.can_delete);
  let can_view = Boolean(action.can_view);

  if (can_input || can_edit || can_delete) {
    can_view = true;
  }

  if (!can_view) {
    return { can_view: false, can_input: false, can_edit: false, can_delete: false };
  }

  return {
    can_view,
    can_input,
    can_edit,
    can_delete
  };
}

/**
 * Core Hybrid Permission Evaluator
 * Uses Nullish Coalescing (??) so userOverrides (especially explicit false) takes absolute precedence over rolePermissions.
 */
export function getEffectivePermission(
  menuName: string,
  rolePermissions: Record<string, PermissionAction> = {}, // dari tabel role_permissions
  userOverrides: Record<string, PermissionAction | Partial<PermissionAction>> = {} // dari pengguna.permissions (JSONB)
): PermissionAction {
  const normalizedKey = normalizeMenuKey(menuName);

  // 1. Resolve user override by key, normalized key, or friendly name
  let userOverride: Partial<PermissionAction> | undefined =
    userOverrides?.[menuName] ?? userOverrides?.[normalizedKey];

  if (!userOverride && typeof userOverrides === "object" && userOverrides !== null) {
    const catalogItem = CORE_SIDEBAR_MENUS.find(
      m => m.key === menuName || m.key === normalizedKey || m.name.toLowerCase() === menuName.toLowerCase()
    );
    if (catalogItem) {
      userOverride = userOverrides[catalogItem.name] ?? userOverrides[catalogItem.key];
    }
  }

  // 2. Resolve role permission by key, normalized key, or friendly name
  let rolePerm: PermissionAction | undefined =
    rolePermissions?.[menuName] ?? rolePermissions?.[normalizedKey];

  if (!rolePerm && typeof rolePermissions === "object" && rolePermissions !== null) {
    const catalogItem = CORE_SIDEBAR_MENUS.find(
      m => m.key === menuName || m.key === normalizedKey || m.name.toLowerCase() === menuName.toLowerCase()
    );
    if (catalogItem) {
      rolePerm = rolePermissions[catalogItem.name] ?? rolePermissions[catalogItem.key];
    }
  }

  return {
    // Nullish coalescing (??) memastikan bahwa jika userOverride.can_view = false, 
    // maka nilai false TERSEBUT YANG DIPAKAI, bukan fallback ke rolePerm.
    can_view: userOverride?.can_view ?? rolePerm?.can_view ?? false,
    can_input: userOverride?.can_input ?? rolePerm?.can_input ?? false,
    can_edit: userOverride?.can_edit ?? rolePerm?.can_edit ?? false,
    can_delete: userOverride?.can_delete ?? rolePerm?.can_delete ?? false,
  };
}

/**
 * Calculates Effective Permissions using the Hybrid Formula:
 * User explicit overrides take strict precedence via getEffectivePermission
 */
export function calculateEffectivePermissions(
  rolePermissions: MenuPermissionsMap = {},
  userOverrides: Record<string, Partial<PermissionAction>> | string[] | any = {}
): MenuPermissionsMap {
  const effective: MenuPermissionsMap = {};

  // Parse user overrides if stored as legacy array of strings or object
  let overrideMap: Record<string, Partial<PermissionAction>> = {};
  if (Array.isArray(userOverrides)) {
    userOverrides.forEach(key => {
      const norm = normalizeMenuKey(key);
      overrideMap[norm] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
      overrideMap[key] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    });
  } else if (typeof userOverrides === "object" && userOverrides !== null) {
    overrideMap = userOverrides;
  }

  CORE_SIDEBAR_MENUS.forEach(menu => {
    const calculated = getEffectivePermission(menu.key, rolePermissions, overrideMap as any);
    effective[menu.key] = normalizePermission(calculated);
  });

  return effective;
}

/**
 * Generate sensible default permissions based on role name
 */
export function getDefaultPermissionsForRole(roleName: string): MenuPermissionsMap {
  const perms: MenuPermissionsMap = {};
  const lower = roleName.toLowerCase();

  CORE_SIDEBAR_MENUS.forEach(m => {
    perms[m.key] = { can_view: false, can_input: false, can_edit: false, can_delete: false };
  });

  if (lower.includes("super admin") || lower.includes("super_admin") || lower.includes("superadmin")) {
    CORE_SIDEBAR_MENUS.forEach(m => {
      perms[m.key] = { can_view: true, can_input: true, can_edit: true, can_delete: true };
    });
  } else if (lower.includes("admin")) {
    CORE_SIDEBAR_MENUS.forEach(m => {
      perms[m.key] = { can_view: true, can_input: true, can_edit: true, can_delete: m.key !== "hak_akses" };
    });
  } else if (lower.includes("guru sekolah") || lower.includes("guru smp") || lower.includes("sekolah")) {
    // Sekolah defaults
    perms["dashboard"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["dashboard_guru"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["presensi_guru"] = { can_view: true, can_input: true, can_edit: false, can_delete: false };
    perms["jurnal_mengajar"] = { can_view: true, can_input: true, can_edit: true, can_delete: true };
    perms["rekap_absensi_guru"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["rekap_sekolah"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["list"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["warga_guru"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["pelanggaran_input"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["pelanggaran_rekap"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["sekolah_plotting"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_wali_kelas"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_guru_sekolah"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_mapel"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_guru_mapel"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_buat_kelas"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_jam"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_jadwal"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_pengumuman"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["sekolah_jam_absensi"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
  } else if (lower.includes("guru") || lower.includes("pondok") || lower.includes("ustadz")) {
    // Guru Pondok defaults
    perms["dashboard"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["form"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["absensi"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["perizinan_sakit"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["perizinan_sambang"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["perizinan_haid"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["perizinan_riwayat"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["rekap_sholat"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["rekap_sekolah"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["rekap_guru"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["nfc_daftar"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["nfc_database"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["list"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["warga_guru"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["warga_pengurus"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["warga_mutasi"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["warga_lulus"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["pelanggaran_input"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["pelanggaran_rekap"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["capaian_materi"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["capaian_materi_kelas"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["target_pengajian"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["jurnal_pengajian"] = { can_view: true, can_input: true, can_edit: true, can_delete: true };
    perms["rekap_jurnal"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["rekap_absensi"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
  } else if (lower.includes("kamar") || lower.includes("asrama") || lower.includes("pengurus")) {
    // Pengurus / Kamar
    perms["dashboard"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["absensi"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["perizinan_sakit"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["perizinan_sambang"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["perizinan_haid"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["perizinan_riwayat"] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    perms["rekap_sholat"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["list"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["pelanggaran_input"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["pelanggaran_rekap"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["capaian_materi"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    perms["capaian_materi_kelas"] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
  } else if (lower.includes("kantin")) {
    perms["kantin_input"] = { can_view: true, can_input: true, can_edit: true, can_delete: true };
    perms["kantin_rekap"] = { can_view: true, can_input: true, can_edit: true, can_delete: true };
  } else if (lower.includes("pimpinan") || lower.includes("pengasuh") || lower.includes("kyai")) {
    CORE_SIDEBAR_MENUS.forEach(m => {
      perms[m.key] = { can_view: true, can_input: false, can_edit: false, can_delete: false };
    });
  }

  return perms;
}

/**
 * Get the effective permissions of the active user for all menus
 */
export function getUserAllEffectivePermissions(user?: any): MenuPermissionsMap {
  if (!user) {
    const defaultMap: MenuPermissionsMap = {};
    CORE_SIDEBAR_MENUS.forEach(m => {
      defaultMap[m.key] = { can_view: false, can_input: false, can_edit: false, can_delete: false };
    });
    return defaultMap;
  }

  const roleName = String(user.peran_utama || user.role || "").toLowerCase();
  
  // Super admin always has full privileges
  if (roleName.includes("super admin") || roleName.includes("super_admin") || roleName.includes("superadmin")) {
    const fullMap: MenuPermissionsMap = {};
    CORE_SIDEBAR_MENUS.forEach(m => {
      fullMap[m.key] = { can_view: true, can_input: true, can_edit: true, can_delete: true };
    });
    return fullMap;
  }

  // 1. Fetch base role permissions from cache/storage
  const roleId = user.role_id || user.peran_utama || user.role;
  let baseRolePerms: MenuPermissionsMap = {};
  
  if (roleId) {
    const cachedByRoleId = localStorage.getItem(`role_perms_cache_${roleId}`);
    const cachedByRoleName = localStorage.getItem(`role_perms_cache_${roleName}`);
    if (cachedByRoleId) {
      try {
        baseRolePerms = JSON.parse(cachedByRoleId);
      } catch {}
    } else if (cachedByRoleName) {
      try {
        baseRolePerms = JSON.parse(cachedByRoleName);
      } catch {}
    }
  }

  // If no base role permissions found in cache, generate defaults
  if (Object.keys(baseRolePerms).length === 0) {
    baseRolePerms = getDefaultPermissionsForRole(roleName);
  }

  // 2. Fetch User Custom Overrides (from user.permissions JSONB or localStorage)
  let userOverrides: any = user.permissions;
  if (!userOverrides && user.username) {
    try {
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      if (localDetails[user.username]?.permissions) {
        userOverrides = localDetails[user.username].permissions;
      }
    } catch {}
  }

  return calculateEffectivePermissions(baseRolePerms, userOverrides);
}

/**
 * Helper to map various tab IDs to standard permission menu keys
 */
export function normalizeMenuKey(tabOrRoute: string): string {
  const key = tabOrRoute.toLowerCase().replace(/^[/#]/, "").trim();

  // Direct alias compatibility
  if (key === "dashboard" || key === "dasbor") return "dashboard";
  if (key === "data_santri" || key === "santri") return "list";
  if (key === "rekap_absensi_pengajian") return "rekap_absensi";
  if (key === "rekap_absensi_sekolah") return "rekap_sekolah";
  if (key === "manajemen_pengguna") return "pengguna";
  if (key === "manajemen_hak_akses") return "hak_akses";
  if (key === "absensi_guru") return "presensi_guru";
  if (key === "data_warga") return "list";
  if (key === "pelanggaran_santri") return "pelanggaran_rekap";
  if (key === "pembukuan_kantin") return "kantin_rekap";
  if (key === "manajemen_sekolah") return "sekolah_plotting";
  if (key === "kamar_asrama") return "pondok_kamar";
  if (key === "kelas_pengajian") return "pondok_pengajian_plotting";

  return key;
}

/**
 * Pure function: Evaluates permission for a specific menu
 */
export function evaluateUserPermission(
  menuName: string,
  user?: any
): {
  canView: boolean;
  canInput: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isMenuVisible: boolean;
} {
  const normalizedKey = normalizeMenuKey(menuName);
  const allPerms = getUserAllEffectivePermissions(user);
  const perm = allPerms[normalizedKey] || allPerms[menuName] || { can_view: false, can_input: false, can_edit: false, can_delete: false };

  return {
    canView: perm.can_view,
    canInput: perm.can_input,
    canEdit: perm.can_edit,
    canDelete: perm.can_delete,
    isMenuVisible: perm.can_view // Business Rule: If can_view is false, menu is hidden
  };
}

/**
 * Custom React Hook: useUserPermission(menuName)
 * Returns { canView, canInput, canEdit, canDelete, isMenuVisible }
 */
export function useUserPermission(menuName: string) {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("admin_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [permission, setPermission] = useState(() => evaluateUserPermission(menuName, currentUser));

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem("admin_user");
        const u = saved ? JSON.parse(saved) : null;
        setCurrentUser(u);
        setPermission(evaluateUserPermission(menuName, u));
      } catch {}
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("permissions_updated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("permissions_updated", handleStorageChange);
    };
  }, [menuName]);

  return permission;
}
