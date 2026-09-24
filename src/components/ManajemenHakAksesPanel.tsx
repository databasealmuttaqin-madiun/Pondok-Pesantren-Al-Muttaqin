import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  Check,
  ChevronDown,
  Lock,
  PlusCircle,
  Code2,
  Layers,
  FolderTree,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  Trash2,
  Database
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { showSuccess, showError, showWarning, showDeleteConfirm, showToast } from "../utils/sweetalert";
import {
  CORE_SIDEBAR_MENUS,
  PermissionAction,
  MenuPermissionsMap,
  normalizePermission,
  getDefaultPermissionsForRole
} from "../utils/permissionUtils";

export interface AppRole {
  id: string;
  name: string;
  description?: string;
  is_system_default?: boolean;
  created_at?: string;
}

// Default System Roles
const DEFAULT_SYSTEM_ROLES: AppRole[] = [
  { id: "role-super-admin", name: "Super Admin", description: "Akses penuh tanpa batas ke seluruh menu dan aksi sistem.", is_system_default: true },
  { id: "role-admin", name: "Admin Ponpes", description: "Pengelolaan administrasi santri, perizinan, dan plotting pondok.", is_system_default: true },
  { id: "role-guru-pondok", name: "Guru Pondok", description: "Akses pengajian, capaian materi santri, dan absensi sholat.", is_system_default: true },
  { id: "role-guru-sekolah", name: "Guru Sekolah (SMP/SMA)", description: "Akses presensi guru, jurnal mengajar, dan kelas formal.", is_system_default: true },
  { id: "role-wali-kamar", name: "Wali Kamar / Asrama", description: "Monitoring santri di asrama, perizinan sakit & sambang.", is_system_default: true },
  { id: "role-wali-kelas", name: "Wali Kelas Sekolah", description: "Monitoring absensi rombel kelas dan jurnal kelas sekolah.", is_system_default: true },
  { id: "role-kantin", name: "Petugas Kantin", description: "Pencatatan kas dan transaksi pembukuan kantin pondok.", is_system_default: true },
  { id: "role-pimpinan", name: "Pimpinan / Pengasuh", description: "Hak akses pemantauan (View Only) laporan dan grafik.", is_system_default: true }
];

export default function ManajemenHakAksesPanel() {
  // State: Roles List
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [roleName, setRoleName] = useState<string>("");
  const [roleDescription, setRoleDescription] = useState<string>("");

  // State: Permissions Map per menu
  const [permissionsMap, setPermissionsMap] = useState<MenuPermissionsMap>({});

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("Semua");
  const [expandedKeys, setExpandedKeys] = useState<{ [key: string]: boolean }>({});
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [isNewRoleMode, setIsNewRoleMode] = useState<boolean>(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    CORE_SIDEBAR_MENUS.forEach(m => set.add(m.category));
    return ["Semua", ...Array.from(set)];
  }, []);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return CORE_SIDEBAR_MENUS.filter(item => {
      const matchCat = selectedCategoryFilter === "Semua" || item.category === selectedCategoryFilter;
      const matchQuery =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [selectedCategoryFilter, searchQuery]);

  // Expand all by default
  useEffect(() => {
    const initialExpanded: { [key: string]: boolean } = {};
    CORE_SIDEBAR_MENUS.forEach(m => {
      initialExpanded[m.key] = true;
    });
    setExpandedKeys(initialExpanded);
  }, []);

  // Initialize roles on mount
  useEffect(() => {
    loadRolesAndPermissions();
  }, []);

  const loadRolesAndPermissions = async () => {
    setIsLoading(true);
    try {
      let loadedRoles: AppRole[] = [];
      // 1. Load from Supabase DB
      try {
        const { data: dbRoles, error } = await supabase
          .from("roles")
          .select("*")
          .order("created_at", { ascending: true });

        if (!error && dbRoles && dbRoles.length > 0) {
          loadedRoles = dbRoles.map((r: any) => ({
            id: String(r.id),
            name: r.name,
            description: r.description || "",
            is_system_default: r.is_system_default || false,
            created_at: r.created_at
          }));
        } else if (!error && (!dbRoles || dbRoles.length === 0)) {
          // Table exists but empty, seed default system roles into DB
          try {
            const seedPayload = DEFAULT_SYSTEM_ROLES.map(sr => ({
              name: sr.name,
              description: sr.description,
              is_system_default: true
            }));
            const { data: seeded, error: seedError } = await supabase
              .from("roles")
              .insert(seedPayload)
              .select();

            if (!seedError && seeded && seeded.length > 0) {
              loadedRoles = seeded.map((r: any) => ({
                id: String(r.id),
                name: r.name,
                description: r.description || "",
                is_system_default: r.is_system_default || false,
                created_at: r.created_at
              }));
            }
          } catch (seedErr) {
            console.warn("Seeding default roles to DB skipped:", seedErr);
          }
        }
      } catch (err) {
        console.warn("Roles query fallback to cache:", err);
      }

      const savedLocalRoles = localStorage.getItem("app_custom_roles_list");
      let parsedLocalRoles: AppRole[] = [];
      if (savedLocalRoles) {
        try {
          parsedLocalRoles = JSON.parse(savedLocalRoles);
        } catch {}
      }

      if (loadedRoles.length === 0) {
        const combined = [...DEFAULT_SYSTEM_ROLES];
        parsedLocalRoles.forEach(lr => {
          if (!combined.some(c => c.id === lr.id || c.name.toLowerCase() === lr.name.toLowerCase())) {
            combined.push(lr);
          }
        });
        loadedRoles = combined;
      } else {
        DEFAULT_SYSTEM_ROLES.forEach(defRole => {
          if (!loadedRoles.some(r => r.name.toLowerCase() === defRole.name.toLowerCase())) {
            loadedRoles.push(defRole);
          }
        });
      }

      setRoles(loadedRoles);
      localStorage.setItem("app_custom_roles_list", JSON.stringify(loadedRoles));

      if (loadedRoles.length > 0) {
        const defaultRole = loadedRoles[0];
        setSelectedRoleId(defaultRole.id);
        setRoleName(defaultRole.name);
        setRoleDescription(defaultRole.description || "");
        await loadPermissionsForRole(defaultRole.id, defaultRole.name);
      }
    } catch (e: any) {
      console.error("Error loading roles:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load permissions for a specific role
  const loadPermissionsForRole = async (roleId: string, currentRoleName: string) => {
    setIsLoading(true);
    const newPerms: MenuPermissionsMap = {};

    CORE_SIDEBAR_MENUS.forEach(m => {
      newPerms[m.key] = { can_view: false, can_input: false, can_edit: false, can_delete: false };
    });

    try {
      let foundInDb = false;
      try {
        const { data: dbPerms, error } = await supabase
          .from("role_permissions")
          .select("*")
          .eq("role_id", roleId);

        if (!error && dbPerms && dbPerms.length > 0) {
          foundInDb = true;
          dbPerms.forEach((p: any) => {
            if (newPerms[p.menu_name]) {
              newPerms[p.menu_name] = {
                can_view: Boolean(p.can_view),
                can_input: Boolean(p.can_input),
                can_edit: Boolean(p.can_edit),
                can_delete: Boolean(p.can_delete)
              };
            }
          });
        }
      } catch {}

      if (!foundInDb) {
        const savedPermsKey = `role_perms_cache_${roleId}`;
        const localPerms = localStorage.getItem(savedPermsKey) || localStorage.getItem(`role_perms_cache_${currentRoleName.toLowerCase()}`);
        if (localPerms) {
          try {
            const parsed = JSON.parse(localPerms);
            Object.keys(parsed).forEach(k => {
              if (newPerms[k]) {
                newPerms[k] = parsed[k];
              }
            });
            foundInDb = true;
          } catch {}
        }
      }

      if (!foundInDb) {
        const defaultPreset = getDefaultPermissionsForRole(currentRoleName);
        Object.keys(defaultPreset).forEach(k => {
          if (newPerms[k]) newPerms[k] = defaultPreset[k];
        });
      }

      setPermissionsMap(newPerms);
    } catch (err) {
      console.error("Error loading permissions for role:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Role selection
  const handleSelectRole = (role: AppRole) => {
    setIsNewRoleMode(false);
    setSelectedRoleId(role.id);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    loadPermissionsForRole(role.id, role.name);
  };

  // Handle Add Role
  const handleStartNewRole = () => {
    setIsNewRoleMode(true);
    const tempId = `role-${Date.now()}`;
    setSelectedRoleId(tempId);
    setRoleName("");
    setRoleDescription("");
    const emptyPerms: MenuPermissionsMap = {};
    CORE_SIDEBAR_MENUS.forEach(m => {
      emptyPerms[m.key] = { can_view: false, can_input: false, can_edit: false, can_delete: false };
    });
    setPermissionsMap(emptyPerms);
  };

  // Permission Change Handler with Business Rule Dependencies
  const handlePermissionChange = (
    menuKey: string,
    permissionType: "can_view" | "can_input" | "can_edit" | "can_delete",
    value: boolean
  ) => {
    setPermissionsMap(prev => {
      const current = prev[menuKey] || { can_view: false, can_input: false, can_edit: false, can_delete: false };
      const updated = { ...current, [permissionType]: value };

      // BUSINESS RULES:
      // 1. If Input, Edit, or Delete is turned TRUE, View Only must automatically be TRUE.
      if ((permissionType === "can_input" || permissionType === "can_edit" || permissionType === "can_delete") && value) {
        updated.can_view = true;
      }

      // 2. If View Only is turned FALSE, all others (Input, Edit, Delete) must automatically be FALSE.
      if (permissionType === "can_view" && !value) {
        updated.can_input = false;
        updated.can_edit = false;
        updated.can_delete = false;
      }

      return {
        ...prev,
        [menuKey]: normalizePermission(updated)
      };
    });
  };

  // Toggle All Permissions in a single menu
  const handleToggleMenuAll = (menuKey: string) => {
    const current = permissionsMap[menuKey];
    const isAllChecked = current && current.can_view && current.can_input && current.can_edit && current.can_delete;
    const targetState = !isAllChecked;

    setPermissionsMap(prev => ({
      ...prev,
      [menuKey]: {
        can_view: targetState,
        can_input: targetState,
        can_edit: targetState,
        can_delete: targetState
      }
    }));
  };

  // Global "Pilih Semua" (Select All Across All Menus)
  const isGlobalAllChecked = useMemo(() => {
    return CORE_SIDEBAR_MENUS.every(m => {
      const p = permissionsMap[m.key];
      return p && p.can_view && p.can_input && p.can_edit && p.can_delete;
    });
  }, [permissionsMap]);

  const handleToggleGlobalAll = () => {
    const targetState = !isGlobalAllChecked;
    const newMap: MenuPermissionsMap = {};

    CORE_SIDEBAR_MENUS.forEach(m => {
      newMap[m.key] = {
        can_view: targetState,
        can_input: targetState,
        can_edit: targetState,
        can_delete: targetState
      };
    });

    setPermissionsMap(newMap);
    showToast(targetState ? "Semua izin diaktifkan" : "Semua izin dinonaktifkan", "info");
  };

  // Accordion Expand/Collapse
  const toggleAccordion = (key: string) => {
    setExpandedKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Check if string is valid UUID
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // Sync All Default Roles & Permissions directly to Supabase
  const handleSyncAllToSupabase = async () => {
    setIsSaving(true);
    try {
      showToast("Menyinkronkan semua peran ke database Supabase...", "info");
      
      for (const defRole of DEFAULT_SYSTEM_ROLES) {
        // 1. Get or create role in roles table
        let roleUuid = "";
        const { data: existingRole, error: fetchErr } = await supabase
          .from("roles")
          .select("id")
          .eq("name", defRole.name)
          .maybeSingle();

        if (existingRole?.id) {
          roleUuid = existingRole.id;
        } else {
          const { data: insertedRole, error: insErr } = await supabase
            .from("roles")
            .insert({
              name: defRole.name,
              description: defRole.description,
              is_system_default: true
            })
            .select("id")
            .single();

          if (insertedRole?.id) {
            roleUuid = insertedRole.id;
          } else if (insErr) {
            console.warn(`Could not insert role ${defRole.name}:`, insErr.message);
          }
        }

        // 2. Generate and insert permissions for this role if UUID obtained
        if (roleUuid && isUuid(roleUuid)) {
          const pMap = getDefaultPermissionsForRole(defRole.name);

          const permPayload = Object.entries(pMap).map(([menuKey, perms]) => ({
            role_id: roleUuid,
            menu_name: menuKey,
            can_view: perms.can_view,
            can_input: perms.can_input,
            can_edit: perms.can_edit,
            can_delete: perms.can_delete
          }));

          // Upsert permissions
          await supabase.from("role_permissions").delete().eq("role_id", roleUuid);
          const { error: insPermErr } = await supabase.from("role_permissions").insert(permPayload);
          if (insPermErr) {
            console.warn(`Failed to insert permissions for ${defRole.name}:`, insPermErr.message);
          }
        }
      }

      await loadRolesAndPermissions();
      showSuccess("Sinkronisasi Berhasil", "Semua peran dan matriks izin berhasil disimpan ke database Supabase!");
    } catch (e: any) {
      showError("Sinkronisasi Gagal", e.message || "Gagal sinkronisasi data ke Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  // Save Role & Permissions (Upsert to Supabase)
  const handleSaveRole = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!roleName.trim()) {
      showWarning("Nama Peran Diperlukan", "Silakan isi nama peran terlebih dahulu.");
      return;
    }

    setIsSaving(true);
    try {
      let targetRoleId = selectedRoleId;

      // 1. DB Upsert for 'roles' table and get valid UUID
      let realRoleUuid = isUuid(targetRoleId) ? targetRoleId : "";

      try {
        const payloadToUpsert: any = {
          name: roleName.trim(),
          description: roleDescription.trim(),
          is_system_default: roles.find(r => r.id === targetRoleId)?.is_system_default || false
        };
        if (realRoleUuid) {
          payloadToUpsert.id = realRoleUuid;
        }

        const { data: dbRole, error: roleError } = await supabase
          .from("roles")
          .upsert(payloadToUpsert, { onConflict: "name" })
          .select("id, name, description, is_system_default")
          .single();

        if (roleError) {
          console.warn("Roles upsert with single failed, trying query by name:", roleError.message);
          const { data: fetchedByName } = await supabase
            .from("roles")
            .select("id")
            .eq("name", roleName.trim())
            .maybeSingle();

          if (fetchedByName?.id) {
            realRoleUuid = fetchedByName.id;
          }
        } else if (dbRole?.id) {
          realRoleUuid = String(dbRole.id);
        }
      } catch (err: any) {
        console.warn("DB roles upsert exception:", err.message);
      }

      if (!realRoleUuid) {
        realRoleUuid = isUuid(targetRoleId) ? targetRoleId : targetRoleId;
      }

      targetRoleId = realRoleUuid;

      // 2. Prepare Permissions Array
      const permissionsPayload = Object.entries(permissionsMap).map(([menuKey, perms]) => ({
        role_id: targetRoleId,
        menu_name: menuKey,
        can_view: Boolean(perms.can_view),
        can_input: Boolean(perms.can_input),
        can_edit: Boolean(perms.can_edit),
        can_delete: Boolean(perms.can_delete)
      }));

      // 3. DB Upsert for 'role_permissions' (Only if valid UUID to prevent Postgres format errors)
      if (isUuid(targetRoleId)) {
        try {
          const { error: delErr } = await supabase.from("role_permissions").delete().eq("role_id", targetRoleId);
          if (delErr) console.warn("Delete old role_permissions error:", delErr.message);

          const { error: insErr } = await supabase.from("role_permissions").insert(permissionsPayload);
          if (insErr) {
            console.error("Insert role_permissions error:", insErr.message);
            throw new Error(`Gagal menyimpan ke role_permissions: ${insErr.message}`);
          }
        } catch (err: any) {
          console.warn("DB role_permissions upsert skipped/failed:", err.message);
        }
      }

      // 4. Update Local Storage Cache
      localStorage.setItem(`role_perms_cache_${targetRoleId}`, JSON.stringify(permissionsMap));
      localStorage.setItem(`role_perms_cache_${roleName.trim()}`, JSON.stringify(permissionsMap));
      localStorage.setItem(`role_perms_cache_${roleName.trim().toLowerCase()}`, JSON.stringify(permissionsMap));

      const roleObj: AppRole = {
        id: targetRoleId,
        name: roleName.trim(),
        description: roleDescription.trim(),
        is_system_default: false
      };

      const updatedRoles = [...roles];
      const existingIdx = updatedRoles.findIndex(
        r => r.id === targetRoleId || r.name.toLowerCase() === roleName.trim().toLowerCase()
      );
      if (existingIdx >= 0) {
        updatedRoles[existingIdx] = roleObj;
      } else {
        updatedRoles.push(roleObj);
      }

      setRoles(updatedRoles);
      localStorage.setItem("app_custom_roles_list", JSON.stringify(updatedRoles));
      setSelectedRoleId(targetRoleId);
      setIsNewRoleMode(false);

      const activeCount = Object.values(permissionsMap).filter(
        p => p.can_view || p.can_input || p.can_edit || p.can_delete
      ).length;

      showSuccess(
        "Peran Berhasil Disimpan",
        `Peran "${roleName.trim()}" telah disimpan ke database Supabase dengan ${activeCount} menu aktif di Sidebar.`
      );
    } catch (err: any) {
      showError("Gagal Menyimpan", err.message || "Terjadi kendala saat menyimpan izin peran.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async (role: AppRole) => {
    if (role.is_system_default) {
      showWarning("Peran Bawaan Sistem", "Peran default sistem tidak dapat dihapus.");
      return;
    }

    const isConfirmed = await showDeleteConfirm(`peran "${role.name}"`);
    if (!isConfirmed) return;

    try {
      setIsLoading(true);
      try {
        await supabase.from("role_permissions").delete().eq("role_id", role.id);
        await supabase.from("roles").delete().eq("id", role.id);
      } catch {}

      localStorage.removeItem(`role_perms_cache_${role.id}`);
      localStorage.removeItem(`role_perms_cache_${role.name.toLowerCase()}`);
      const filtered = roles.filter(r => r.id !== role.id);
      setRoles(filtered);
      localStorage.setItem("app_custom_roles_list", JSON.stringify(filtered));

      if (filtered.length > 0) {
        handleSelectRole(filtered[0]);
      }
      showSuccess("Berhasil Dihapus", `Peran "${role.name}" telah dihapus.`);
    } catch (err: any) {
      showError("Gagal Menghapus", err.message || "Gagal menghapus peran.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* ================================================================ */}
      {/* 1. HEADER & INTRO BANNER */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Manajemen Peran Base & Hak Akses
              </h1>
              <span className="text-[10px] uppercase font-black tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800 font-mono">
                Filament RBAC
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Konfigurasi wewenang per menu sidebar (View Only, Input, Edit, Hapus) untuk peran dasar pengguna.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleSyncAllToSupabase}
            disabled={isSaving}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border border-emerald-200/80 dark:border-emerald-800 disabled:opacity-50"
            title="Sinkronisasi semua peran bawaan dan izin ke tabel Supabase"
          >
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isSaving ? "Sinkronisasi..." : "Sinkronkan Database"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Lihat Skrip SQL Database"
          >
            <Code2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Skrip SQL</span>
          </button>

          <button
            type="button"
            onClick={handleStartNewRole}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buat Peran Baru</span>
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 2. ROLE SELECTOR BAR & QUICK SWITCHER */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Pilih Peran Base
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {roles.length} Peran Terdaftar
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {roles.map(r => {
            const isSelected = selectedRoleId === r.id && !isNewRoleMode;
            return (
              <div
                key={r.id}
                onClick={() => handleSelectRole(r)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer border transition-all whitespace-nowrap select-none ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                    : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-white" : "bg-indigo-500"}`} />
                <span>{r.name}</span>
                {r.is_system_default && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}>
                    Default
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ================================================================ */}
      {/* 3. ROLE HEADER & FORM PERAN (Spesifikasi Bagian 1) */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Input Nama Peran */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span>Nama Peran *</span>
              {isNewRoleMode && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold normal-case">
                  (Mode Tambah Peran Baru)
                </span>
              )}
            </label>
            <input
              type="text"
              required
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
              placeholder="Contoh: Admin Ponpes, Wali Kamar, Guru..."
              className="w-full text-xs font-bold leading-normal px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white transition-all shadow-inner"
            />
          </div>

          {/* Deskripsi Peran */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Deskripsi / Wewenang Peran (Opsional)
            </label>
            <input
              type="text"
              value={roleDescription}
              onChange={e => setRoleDescription(e.target.value)}
              placeholder="Contoh: Pengelolaan administrasi santri dan presensi..."
              className="w-full text-xs font-bold leading-normal px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Switch Toggle Global "Pilih Semua" (Spesifikasi Bagian 1) */}
        <div className="p-4.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 tracking-tight">
                Pilih Semua
              </h4>
              <p className="text-[11px] font-semibold text-indigo-700/80 dark:text-indigo-400">
                Aktifkan semua izin yang tersedia untuk peran ini.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isGlobalAllChecked}
              onChange={handleToggleGlobalAll}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            <span className="ml-3 text-xs font-black text-indigo-900 dark:text-indigo-200">
              {isGlobalAllChecked ? "Semua Aktif" : "Aktifkan Semua"}
            </span>
          </label>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama menu..."
                className="w-full pl-9.5 pr-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  Kategori: {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const all: Record<string, boolean> = {};
                CORE_SIDEBAR_MENUS.forEach(m => (all[m.key] = true));
                setExpandedKeys(all);
              }}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Buka Semua
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={() => setExpandedKeys({})}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Tutup Semua
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 4. DAFTAR PERMISSION BERBASIS ACCORDION (Spesifikasi Bagian 2) */}
      {/* ================================================================ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-500" />
            <span>Matriks Izin Menu Sidebar ({filteredMenuItems.length} Menu)</span>
          </h3>
          <span className="text-[11px] font-semibold text-slate-400">
            *Jika tidak ada satupun izin yang dicentang, menu otomatis disembunyikan
          </span>
        </div>

        {filteredMenuItems.map(item => {
          const isExpanded = expandedKeys[item.key] ?? true;
          const currentPerms = permissionsMap[item.key] || {
            can_view: false,
            can_input: false,
            can_edit: false,
            can_delete: false
          };

          const activeCount = [
            currentPerms.can_view,
            currentPerms.can_input,
            currentPerms.can_edit,
            currentPerms.can_delete
          ].filter(Boolean).length;

          const isMenuVisible = activeCount > 0;
          const isMenuFull = activeCount === 4;
          const ItemIcon = item.icon || Layers;

          return (
            <div
              key={item.key}
              className={`bg-white dark:bg-slate-900 border rounded-2xl transition-all shadow-xs overflow-hidden ${
                isMenuVisible
                  ? "border-slate-200/90 dark:border-slate-800"
                  : "border-slate-200/50 dark:border-slate-850 opacity-75"
              }`}
            >
              {/* Accordion Header */}
              <div
                onClick={() => toggleAccordion(item.key)}
                className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-950/40 select-none transition-colors border-b border-transparent"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl border ${
                    isMenuVisible
                      ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                  }`}>
                    <ItemIcon className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        {item.name}
                      </span>
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Status Badge */}
                  {isMenuFull ? (
                    <span className="text-[10px] font-black tracking-wide px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800 font-mono">
                      Akses Penuh (4/4)
                    </span>
                  ) : isMenuVisible ? (
                    <span className="text-[10px] font-black tracking-wide px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800 font-mono">
                      {activeCount}/4 Izin Aktif
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 font-mono">
                      Menu Disembunyikan
                    </span>
                  )}

                  {/* Toggle All in Menu Quick Button */}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleToggleMenuAll(item.key);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors"
                    title={isMenuFull ? "Kosongkan Menu Ini" : "Pilih Semua di Menu Ini"}
                  >
                    {isMenuFull ? <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <Square className="w-4 h-4" />}
                  </button>

                  {/* Chevron Icon */}
                  <div className="p-1 text-slate-400">
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </div>

              {/* Accordion Body: 4 Checkbox Options (Horizontal Grid) */}
              {isExpanded && (
                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 1. View Only */}
                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer select-none transition-all ${
                      currentPerms.can_view
                        ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80 text-indigo-950 dark:text-indigo-200"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}>
                      <input
                        type="checkbox"
                        checked={currentPerms.can_view}
                        onChange={e => handlePermissionChange(item.key, "can_view", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black">View Only</span>
                        <span className="text-[10px] text-slate-400 font-medium">Lihat menu & data</span>
                      </div>
                    </label>

                    {/* 2. Input */}
                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer select-none transition-all ${
                      currentPerms.can_input
                        ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80 text-indigo-950 dark:text-indigo-200"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}>
                      <input
                        type="checkbox"
                        checked={currentPerms.can_input}
                        onChange={e => handlePermissionChange(item.key, "can_input", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black">Input</span>
                        <span className="text-[10px] text-slate-400 font-medium">Tambah record baru</span>
                      </div>
                    </label>

                    {/* 3. Edit */}
                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer select-none transition-all ${
                      currentPerms.can_edit
                        ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80 text-indigo-950 dark:text-indigo-200"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}>
                      <input
                        type="checkbox"
                        checked={currentPerms.can_edit}
                        onChange={e => handlePermissionChange(item.key, "can_edit", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black">Edit</span>
                        <span className="text-[10px] text-slate-400 font-medium">Ubah / perbarui data</span>
                      </div>
                    </label>

                    {/* 4. Hapus */}
                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer select-none transition-all ${
                      currentPerms.can_delete
                        ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/80 text-indigo-950 dark:text-indigo-200"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}>
                      <input
                        type="checkbox"
                        checked={currentPerms.can_delete}
                        onChange={e => handlePermissionChange(item.key, "can_delete", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black">Hapus</span>
                        <span className="text-[10px] text-slate-400 font-medium">Hapus data record</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ================================================================ */}
      {/* 5. FOOTER ACTIONS BAR */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
        <div className="flex items-center gap-3">
          {!roles.find(r => r.id === selectedRoleId)?.is_system_default && !isNewRoleMode && (
            <button
              type="button"
              onClick={() => {
                const cur = roles.find(r => r.id === selectedRoleId);
                if (cur) handleDeleteRole(cur);
              }}
              className="px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-2 cursor-pointer border border-rose-200 dark:border-rose-900/60"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Peran</span>
            </button>
          )}
          <span className="text-xs text-slate-400 font-semibold hidden md:inline">
            Menyimpan akan meng-upsert data ke tabel <code className="font-mono text-slate-600 dark:text-slate-300">roles</code> dan <code className="font-mono text-slate-600 dark:text-slate-300">role_permissions</code>.
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              if (roles.length > 0) {
                handleSelectRole(roles[0]);
              }
            }}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSaveRole}
            disabled={isSaving}
            className="px-6 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            {isSaving ? (
              <>
                <span className="animate-spin text-sm">⏳</span>
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Simpan Peran</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MODAL SKRIP SQL */}
      {/* ================================================================ */}
      {showSqlModal && (
        <div className="fixed inset-0 z-[150] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Code2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  Skrip Migrasi Supabase SQL
                </h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-80 custom-scrollbar select-all">
{`-- 1. Buat Tabel roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Buat Tabel role_permissions (Per-Menu Sidebar)
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    menu_name VARCHAR(100) NOT NULL,
    can_view BOOLEAN DEFAULT FALSE,
    can_input BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, menu_name)
);

-- 3. Tambahkan Kolom ke tabel pengguna
ALTER TABLE pengguna 
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pengguna_role_id ON pengguna(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

-- 4. Kebijakan Keamanan RLS (Supabase)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on roles" ON roles;
CREATE POLICY "Allow all on roles" ON roles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on role_permissions" ON role_permissions;
CREATE POLICY "Allow all on role_permissions" ON role_permissions FOR ALL USING (true) WITH CHECK (true);`}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950/50">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS roles (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    name VARCHAR(100) NOT NULL UNIQUE,\n    description TEXT,\n    is_system_default BOOLEAN DEFAULT FALSE,\n    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n);\n\nCREATE TABLE IF NOT EXISTS role_permissions (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,\n    menu_name VARCHAR(100) NOT NULL,\n    can_view BOOLEAN DEFAULT FALSE,\n    can_input BOOLEAN DEFAULT FALSE,\n    can_edit BOOLEAN DEFAULT FALSE,\n    can_delete BOOLEAN DEFAULT FALSE,\n    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),\n    UNIQUE(role_id, menu_name)\n);\n\nALTER TABLE pengguna \nADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;`);
                  showToast("Skrip SQL disalin ke clipboard!", "success");
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Salin Skrip SQL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
