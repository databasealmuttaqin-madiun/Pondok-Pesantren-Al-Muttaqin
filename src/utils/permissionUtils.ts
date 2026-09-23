import { useState, useEffect } from "react";
import {
  Home,
  Users,
  BookOpen,
  Building2,
  TrendingUp,
  FileSpreadsheet,
  School,
  Shield,
  Clock,
  HeartPulse,
  Droplets,
  Footprints,
  UserCheck,
  Moon,
  Fingerprint,
  Database,
  GraduationCap,
  ShieldAlert,
  Store,
  Sliders,
  Lock,
  LayoutDashboard
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

// 8 Primary Required Menus from Specification + Key Secondary Menus
export const CORE_SIDEBAR_MENUS: MenuItemCatalog[] = [
  {
    key: "dashboard",
    name: "Dashboard",
    category: "UTAMA",
    description: "Statistik global santri, grafik presensi, dan ringkasan dasbor.",
    icon: Home,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },
  {
    key: "data_santri",
    name: "Data Santri",
    category: "UTAMA",
    description: "Pendaftaran santri baru, formulir biodata, dan edit data profil.",
    icon: Users,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "kelas_pengajian",
    name: "Kelas Pengajian",
    category: "PENGAJIAN",
    description: "Jurnal ngaji weton/sorogan, kurikulum kitab, dan absensi halaqah.",
    icon: BookOpen,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "kamar_asrama",
    name: "Kamar / Asrama",
    category: "MANAJEMEN PONDOK",
    description: "Plotting kamar santri, penugasan wali kamar, dan kontrol asrama.",
    icon: Building2,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "capaian_materi",
    name: "Capaian Materi Santri",
    category: "CAPAIAN MATERI",
    description: "Progress khataman kitab, hafalan Qur'an, dan grafik target santri.",
    icon: TrendingUp,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "rekap_absensi_pengajian",
    name: "Rekap Absensi Pengajian",
    category: "REKAP PRESENSI",
    description: "Rekapitulasi kehadiran sholat berjamaah & ngaji halaqah pondok.",
    icon: Moon,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "rekap_absensi_sekolah",
    name: "Rekap Absensi Sekolah",
    category: "REKAP PRESENSI",
    description: "Laporan presensi siswa per kelas formal (SMP / SMA).",
    icon: School,
    defaultPermissions: { can_view: true, can_input: false, can_edit: false, can_delete: false }
  },
  {
    key: "manajemen_pengguna",
    name: "Manajemen Pengguna",
    category: "MANAJEMEN PONDOK",
    description: "Persetujuan akun registrasi, reset password, dan daftar staf.",
    icon: Shield,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  // Additional comprehensive sidebar menus
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
    description: "Presensi kehadiran guru berbasis GPS dan jam absensi sekolah.",
    icon: Clock,
    defaultPermissions: { can_view: true, can_input: true, can_edit: false, can_delete: false }
  },
  {
    key: "jurnal_mengajar",
    name: "Jurnal Mengajar Guru",
    category: "SEKOLAH",
    description: "Pengisian jurnal tatap muka kelas, materi, dan absensi per jam pelajaran.",
    icon: BookOpen,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "perizinan_sakit",
    name: "Perizinan: Sakit",
    category: "PERIZINAN",
    description: "Formulir santri izin sakit, klinik poskestren, dan riwayat kesehatan.",
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
    description: "Pencatatan siklus uzur syar'i / haid santriwati dan dispensasi sholat.",
    icon: Droplets,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "nfc_daftar",
    name: "Registrasi Kartu NFC",
    category: "REGISTRASI NFC",
    description: "Perekaman UID kartu smartcard/NFC untuk santri dan pengurus.",
    icon: Fingerprint,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "data_warga",
    name: "Data Warga (Staf & Alumni)",
    category: "DATA WARGA",
    description: "Database dewan asatidz, staf pengurus, santri mutasi, dan alumni.",
    icon: GraduationCap,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: false }
  },
  {
    key: "pelanggaran_santri",
    name: "Pelanggaran & Disiplin",
    category: "PELANGGARAN",
    description: "Input poin pelanggaran, catatan tata tertib, dan rekap sanksi santri.",
    icon: ShieldAlert,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "pembukuan_kantin",
    name: "Pembukuan & Kas Kantin",
    category: "KANTIN",
    description: "Input kas masuk, kas keluar, dan laporan saldo keuangan kantin.",
    icon: Store,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "manajemen_sekolah",
    name: "Manajemen Plotting Sekolah",
    category: "MANAJEMEN SEKOLAH",
    description: "Rombel kelas, plotting wali kelas, master mapel, dan jadwal pelajaran.",
    icon: School,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
  },
  {
    key: "manajemen_hak_akses",
    name: "Manajemen Hak Akses & Peran",
    category: "MANAJEMEN PONDOK",
    description: "Pengaturan role permissions base dan kontrol visibilitas menu sidebar.",
    icon: Lock,
    defaultPermissions: { can_view: true, can_input: true, can_edit: true, can_delete: true }
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
 * Calculates Effective Permissions using the Hybrid Formula:
 * Effective_Permission = (Role_Permissions) OR (User_JSONB_Overrides)
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
      overrideMap[key] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
    });
  } else if (typeof userOverrides === "object" && userOverrides !== null) {
    overrideMap = userOverrides;
  }

  CORE_SIDEBAR_MENUS.forEach(menu => {
    const roleP = rolePermissions[menu.key] || {
      can_view: false,
      can_input: false,
      can_edit: false,
      can_delete: false
    };

    const userO = overrideMap[menu.key] || {};

    const rawCombined: PermissionAction = {
      can_view: Boolean(roleP.can_view || userO.can_view),
      can_input: Boolean(roleP.can_input || userO.can_input),
      can_edit: Boolean(roleP.can_edit || userO.can_edit),
      can_delete: Boolean(roleP.can_delete || userO.can_delete)
    };

    effective[menu.key] = normalizePermission(rawCombined);
  });

  return effective;
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
  // Alias mapping to normalize tab IDs or route names to menu keys
  const normalizedKey = normalizeMenuKey(menuName);
  const allPerms = getUserAllEffectivePermissions(user);
  const perm = allPerms[normalizedKey] || { can_view: false, can_input: false, can_edit: false, can_delete: false };

  return {
    canView: perm.can_view,
    canInput: perm.can_input,
    canEdit: perm.can_edit,
    canDelete: perm.can_delete,
    isMenuVisible: perm.can_view // Business Rule: If can_view is false, menu is hidden
  };
}

/**
 * Helper to map various tab IDs to standard permission menu keys
 */
export function normalizeMenuKey(tabOrRoute: string): string {
  const key = tabOrRoute.toLowerCase().replace(/^[/#]/, "").trim();

  if (key === "dashboard" || key === "dasbor") return "dashboard";
  if (key === "data_santri" || key === "santri" || key === "list" || key === "form") return "data_santri";
  if (key === "kelas_pengajian" || key === "pengajian" || key === "jurnal_pengajian" || key === "target_pengajian" || key === "manajemen_materi") return "kelas_pengajian";
  if (key === "kamar_asrama" || key === "kamar" || key === "pondok_kamar" || key === "pondok_sesi" || key === "pondok_wali_kamar" || key === "manajemen_pondok") return "kamar_asrama";
  if (key === "capaian_materi" || key === "capaian_materi_kelas") return "capaian_materi";
  if (key === "rekap_absensi_pengajian" || key === "rekap_sholat" || key === "rekap_presensi" || key === "rekap_jurnal" || key === "rekap_absensi") return "rekap_absensi_pengajian";
  if (key === "rekap_absensi_sekolah" || key === "rekap_sekolah") return "rekap_absensi_sekolah";
  if (key === "manajemen_pengguna" || key === "pengguna") return "manajemen_pengguna";
  if (key === "manajemen_hak_akses" || key === "hak_akses" || key === "hak-akses") return "manajemen_hak_akses";
  if (key === "dashboard_guru") return "dashboard_guru";
  if (key === "presensi_guru" || key === "absensi_guru") return "presensi_guru";
  if (key === "jurnal_mengajar") return "jurnal_mengajar";
  if (key === "perizinan_sakit") return "perizinan_sakit";
  if (key === "perizinan_sambang" || key === "perizinan") return "perizinan_sambang";
  if (key === "perizinan_haid") return "perizinan_haid";
  if (key === "nfc_daftar" || key === "nfc_database" || key === "nfc") return "nfc_daftar";
  if (key === "data_warga" || key.startsWith("warga_")) return "data_warga";
  if (key === "pelanggaran_santri" || key.startsWith("pelanggaran_")) return "pelanggaran_santri";
  if (key === "pembukuan_kantin" || key.startsWith("kantin_")) return "pembukuan_kantin";
  if (key === "manajemen_sekolah" || key.startsWith("sekolah_")) return "manajemen_sekolah";

  return key;
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
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [menuName]);

  return permission;
}
