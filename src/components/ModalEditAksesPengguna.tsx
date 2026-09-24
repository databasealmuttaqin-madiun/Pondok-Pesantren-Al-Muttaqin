import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  Check,
  X,
  Lock,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  Key,
  User,
  CheckSquare,
  Square,
  Search,
  Sliders,
  AlertCircle
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { showSuccess, showError, showWarning, showToast } from "../utils/sweetalert";
import {
  CORE_SIDEBAR_MENUS,
  PermissionAction,
  MenuPermissionsMap,
  normalizePermission,
  getDefaultPermissionsForRole
} from "../utils/permissionUtils";

interface ModalEditAksesPenggunaProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: any) => void;
}

interface AppRole {
  id: string;
  name: string;
  description?: string;
  is_system_default?: boolean;
}

export default function ModalEditAksesPengguna({
  user,
  isOpen,
  onClose,
  onSuccess
}: ModalEditAksesPenggunaProps) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [rolePermissions, setRolePermissions] = useState<MenuPermissionsMap>({});
  const [userOverrides, setUserOverrides] = useState<Record<string, Partial<PermissionAction>>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("Semua");
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  // Categories list
  const categories = useMemo(() => {
    const s = new Set<string>();
    CORE_SIDEBAR_MENUS.forEach(m => s.add(m.category));
    return ["Semua", ...Array.from(s)];
  }, []);

  // Filtered menus
  const filteredMenus = useMemo(() => {
    return CORE_SIDEBAR_MENUS.filter(m => {
      const matchCat = filterCategory === "Semua" || m.category === filterCategory;
      const matchQuery =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [filterCategory, searchQuery]);

  // Expand all by default
  useEffect(() => {
    const exp: Record<string, boolean> = {};
    CORE_SIDEBAR_MENUS.forEach(m => (exp[m.key] = true));
    setExpandedMenus(exp);
  }, []);

  // Load roles & user's current permissions when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadInitialData();
    }
  }, [isOpen, user]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Load Roles from DB or localStorage
      let loadedRoles: AppRole[] = [];
      try {
        const { data: dbRoles, error } = await supabase.from("roles").select("*").order("name");
        if (!error && dbRoles && dbRoles.length > 0) {
          loadedRoles = dbRoles.map((r: any) => ({
            id: String(r.id),
            name: r.name,
            description: r.description,
            is_system_default: r.is_system_default
          }));
        }
      } catch (e) {
        console.warn("Could not load roles from DB:", e);
      }

      if (loadedRoles.length === 0) {
        const cached = localStorage.getItem("app_custom_roles_list");
        if (cached) {
          try {
            loadedRoles = JSON.parse(cached);
          } catch {}
        }
      }

      if (loadedRoles.length === 0) {
        loadedRoles = [
          { id: "role-super-admin", name: "Super Admin", is_system_default: true },
          { id: "role-admin", name: "Admin Ponpes", is_system_default: true },
          { id: "role-guru-pondok", name: "Guru Pondok", is_system_default: true },
          { id: "role-guru-sekolah", name: "Guru Sekolah (SMP/SMA)", is_system_default: true },
          { id: "role-wali-kamar", name: "Wali Kamar / Asrama", is_system_default: true },
          { id: "role-kantin", name: "Petugas Kantin", is_system_default: true },
          { id: "role-pimpinan", name: "Pimpinan / Pengasuh", is_system_default: true }
        ];
      }

      setRoles(loadedRoles);

      // 2. Fetch fresh user details from Supabase & local cache
      let userRoleRef = user.role_id || user.peran_utama || user.role || "";
      let rawOverrides: any = user.permissions;

      // Check local cache first for latest unsynced edits
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      const localUser = user.username ? localDetails[user.username] : null;
      if (localUser) {
        if (localUser.role_id || localUser.peran_utama || localUser.role) {
          userRoleRef = localUser.role_id || localUser.peran_utama || localUser.role;
        }
        if (localUser.permissions && Object.keys(localUser.permissions).length > 0) {
          rawOverrides = localUser.permissions;
        }
      }

      // Check Supabase
      try {
        let userQuery = supabase.from("pengguna").select("role_id, role, peran_utama, permissions");
        if (user.id) {
          userQuery = userQuery.eq("id", user.id);
        } else if (user.username) {
          userQuery = userQuery.eq("username", user.username);
        }
        const { data: freshUser, error: freshErr } = await userQuery.maybeSingle();
        if (!freshErr && freshUser) {
          if (freshUser.role_id) userRoleRef = freshUser.role_id;
          else if (freshUser.peran_utama || freshUser.role) userRoleRef = freshUser.peran_utama || freshUser.role;
          if (freshUser.permissions && Object.keys(freshUser.permissions).length > 0) {
            rawOverrides = freshUser.permissions;
          }
        }
      } catch (fErr) {
        console.warn("Could not query fresh user record:", fErr);
      }

      // 3. Match Role in loadedRoles using smart matching
      const matchUserToRole = (
        targetUser: any,
        roleRef: string,
        allRoles: AppRole[]
      ): AppRole => {
        if (!allRoles || allRoles.length === 0) {
          return { id: "role-guru-pondok", name: "Guru Pondok", is_system_default: true };
        }

        // 1. Direct match by ID
        if (roleRef) {
          const directId = allRoles.find(r => r.id === roleRef);
          if (directId) return directId;
        }

        // Collect candidate strings from user object
        const candidates = [
          roleRef,
          targetUser?.role_id,
          targetUser?.peran_utama,
          targetUser?.role,
          targetUser?.jabatan,
          targetUser?.bagian
        ]
          .filter(Boolean)
          .map(s => String(s).toLowerCase().replace(/_/g, " ").replace(/-/g, " ").trim());

        // 2. Exact name match
        for (const cand of candidates) {
          if (!cand) continue;
          const exact = allRoles.find(r => {
            const rNorm = r.name.toLowerCase().replace(/_/g, " ").replace(/-/g, " ").trim();
            return rNorm === cand;
          });
          if (exact) return exact;
        }

        // 3. Keyword / semantic matching
        for (const cand of candidates) {
          if (!cand) continue;
          if (cand.includes("super admin") || cand.includes("superadmin")) {
            const found = allRoles.find(r => r.name.toLowerCase().includes("super admin"));
            if (found) return found;
          }
          if (cand.includes("admin") && !cand.includes("guru") && !cand.includes("sekolah")) {
            const found = allRoles.find(r => r.name.toLowerCase().includes("admin") && !r.name.toLowerCase().includes("super"));
            if (found) return found;
          }
          if (cand.includes("guru sekolah") || cand.includes("sekolah") || cand.includes("smp") || cand.includes("sma") || cand.includes("ma") || cand.includes("mapel")) {
            const found = allRoles.find(r => r.name.toLowerCase().includes("sekolah") || r.name.toLowerCase().includes("formal"));
            if (found) return found;
          }
          if (cand.includes("guru") || cand.includes("pondok") || cand.includes("pengajian") || cand.includes("ustadz")) {
            const found = allRoles.find(r => r.name.toLowerCase().includes("pondok") || r.name.toLowerCase().includes("guru"));
            if (found) return found;
          }
          if (cand.includes("kamar") || cand.includes("asrama")) {
            const found = allRoles.find(r => r.name.toLowerCase().includes("kamar") || r.name.toLowerCase().includes("asrama"));
            if (found) return found;
          }
          if (cand.includes("kantin")) {
            const found = allRoles.find(r => r.name.toLowerCase().includes("kantin"));
            if (found) return found;
          }
          if (cand.includes("pimpinan") || cand.includes("pengasuh") || cand.includes("kyai")) {
            const found = allRoles.find(r => r.name.toLowerCase().includes("pimpinan") || r.name.toLowerCase().includes("pengasuh"));
            if (found) return found;
          }
        }

        // 4. Safe fallback: If user belongs to school vs pondok
        const isSchool = candidates.some(c => c.includes("sekolah") || c.includes("smp") || c.includes("sma"));
        if (isSchool) {
          const schoolRole = allRoles.find(r => r.name.toLowerCase().includes("sekolah") || r.name.toLowerCase().includes("formal"));
          if (schoolRole) return schoolRole;
        }

        const defaultGuruPondok = allRoles.find(r => r.name.toLowerCase().includes("pondok") || r.name.toLowerCase().includes("guru"));
        if (defaultGuruPondok) return defaultGuruPondok;

        const nonAdminRole = allRoles.find(r => !r.name.toLowerCase().includes("admin"));
        if (nonAdminRole) return nonAdminRole;

        return allRoles[0];
      };

      const matchedRole = matchUserToRole(user, userRoleRef, loadedRoles);

      const activeRoleId = matchedRole?.id || loadedRoles[0]?.id || "";
      setSelectedRoleId(activeRoleId);

      // 4. Load Role Base Permissions
      await fetchRoleBasePermissions(activeRoleId, matchedRole?.name || "", loadedRoles);

      // 5. Parse User Custom Overrides (JSONB)
      let parsedOverrides: Record<string, Partial<PermissionAction>> = {};
      if (Array.isArray(rawOverrides)) {
        // Legacy array of menu strings -> convert to structured object
        rawOverrides.forEach((key: string) => {
          parsedOverrides[key] = { can_view: true, can_input: true, can_edit: true, can_delete: false };
        });
      } else if (typeof rawOverrides === "object" && rawOverrides !== null) {
        parsedOverrides = { ...rawOverrides };
      }

      setUserOverrides(parsedOverrides);
    } catch (err) {
      console.error("Error loading user permission data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Base Permissions for Selected Role
  const fetchRoleBasePermissions = async (
    roleId: string,
    roleName: string,
    allRoles: AppRole[]
  ) => {
    const perms: MenuPermissionsMap = {};
    CORE_SIDEBAR_MENUS.forEach(m => {
      perms[m.key] = { can_view: false, can_input: false, can_edit: false, can_delete: false };
    });

    try {
      // 1. Try DB
      let found = false;
      try {
        const { data, error } = await supabase
          .from("role_permissions")
          .select("*")
          .eq("role_id", roleId);

        if (!error && data && data.length > 0) {
          found = true;
          data.forEach((p: any) => {
            if (perms[p.menu_name]) {
              perms[p.menu_name] = {
                can_view: Boolean(p.can_view),
                can_input: Boolean(p.can_input),
                can_edit: Boolean(p.can_edit),
                can_delete: Boolean(p.can_delete)
              };
            }
          });
        }
      } catch {}

      // 2. Try Cache
      if (!found) {
        const cached = localStorage.getItem(`role_perms_cache_${roleId}`) || localStorage.getItem(`role_perms_cache_${roleName.toLowerCase()}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            Object.keys(parsed).forEach(k => {
              if (perms[k]) perms[k] = parsed[k];
            });
            found = true;
          } catch {}
        }
      }

      // 3. Fallback standard presets
      if (!found) {
        const defaultPreset = getDefaultPermissionsForRole(roleName);
        Object.keys(defaultPreset).forEach(k => {
          if (perms[k]) perms[k] = defaultPreset[k];
        });
      }

      setRolePermissions(perms);
    } catch (e) {
      console.error("Error fetching role base permissions:", e);
    }
  };

  // Handle Role Selection Change
  const handleRoleChange = async (newRoleId: string) => {
    setSelectedRoleId(newRoleId);
    const selected = roles.find(r => r.id === newRoleId);
    if (selected) {
      await fetchRoleBasePermissions(newRoleId, selected.name, roles);
    }
  };

  // Toggle Override Checkbox for a specific menu and action
  const handleToggleOverride = (
    menuKey: string,
    action: "can_view" | "can_input" | "can_edit" | "can_delete"
  ) => {
    const roleVal = Boolean(rolePermissions[menuKey]?.[action]);
    const currentOverride = userOverrides[menuKey] || {};
    const effectiveCurrent = Boolean(currentOverride[action] ?? roleVal);
    const newTargetValue = !effectiveCurrent;

    setUserOverrides(prev => {
      const existing = { ...(prev[menuKey] || {}) };
      existing[action] = newTargetValue;

      // BUSINESS RULES:
      // 1. If Input, Edit, or Delete is set to TRUE, View Only must automatically be TRUE.
      if ((action === "can_input" || action === "can_edit" || action === "can_delete") && newTargetValue) {
        existing.can_view = true;
      }

      // 2. If View Only is set to FALSE, all actions must be FALSE.
      if (action === "can_view" && !newTargetValue) {
        existing.can_input = false;
        existing.can_edit = false;
        existing.can_delete = false;
      }

      return {
        ...prev,
        [menuKey]: existing
      };
    });
  };

  // Reset User Overrides to inherit exactly from Base Role
  const handleResetToRoleDefault = () => {
    setUserOverrides({});
    showToast("Override dihapus: Hak akses diselaraskan penuh dengan Peran Bawaan.", "info");
  };

  // Save changes to Supabase and Local Storage
  const handleSaveUserPermissions = async () => {
    setIsSaving(true);
    try {
      const selectedRoleObj = roles.find(r => r.id === selectedRoleId);
      const roleName = selectedRoleObj?.name || user.role || "guru_pondok";

      // 1. Clean and normalize overrides map
      const cleanedOverrides: Record<string, Partial<PermissionAction>> = {};
      Object.entries(userOverrides).forEach(([k, perms]) => {
        if (perms && Object.values(perms).some(v => v !== undefined)) {
          cleanedOverrides[k] = normalizePermission(perms);
        }
      });

      // 2. Resolve valid UUID for role_id
      let validRoleId: string | null = null;
      const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      if (isUuid(selectedRoleId)) {
        validRoleId = selectedRoleId;
      } else {
        // Try looking up or inserting role in database
        try {
          const { data: dbRole } = await supabase
            .from("roles")
            .select("id")
            .eq("name", roleName)
            .maybeSingle();

          if (dbRole?.id) {
            validRoleId = String(dbRole.id);
          } else {
            const { data: newRole } = await supabase
              .from("roles")
              .insert({ name: roleName, description: `Peran ${roleName}` })
              .select("id")
              .maybeSingle();

            if (newRole?.id) {
              validRoleId = String(newRole.id);
            }
          }
        } catch (rErr) {
          console.warn("Could not resolve role UUID:", rErr);
        }
      }

      // 3. Update 'pengguna' table in Supabase
      const payload: any = {
        role_id: validRoleId,
        peran_utama: roleName,
        role: roleName,
        permissions: cleanedOverrides
      };

      let dbSaveSuccess = false;
      try {
        let updateQuery = supabase.from("pengguna").update(payload);
        if (user.id) {
          updateQuery = updateQuery.eq("id", user.id);
        } else if (user.username) {
          updateQuery = updateQuery.eq("username", user.username);
        }

        const { error: updateErr, data: updatedData } = await updateQuery.select();

        if (updateErr) {
          console.warn("Supabase update error on pengguna with role_id, trying fallback without role_id:", updateErr.message);
          // Fallback 1: Try without role_id in case foreign key or role_id column failed
          const fallbackPayload = {
            peran_utama: roleName,
            role: roleName,
            permissions: cleanedOverrides
          };
          let fbQuery = supabase.from("pengguna").update(fallbackPayload);
          if (user.id) fbQuery = fbQuery.eq("id", user.id);
          else if (user.username) fbQuery = fbQuery.eq("username", user.username);

          const { error: fbErr } = await fbQuery.select();
          if (!fbErr) {
            dbSaveSuccess = true;
          } else if (user.username) {
            // Fallback 2: Try by username specifically
            const { error: fbErr2 } = await supabase
              .from("pengguna")
              .update(fallbackPayload)
              .eq("username", user.username);
            if (!fbErr2) dbSaveSuccess = true;
          }
        } else {
          dbSaveSuccess = true;
        }
      } catch (err: any) {
        console.warn("DB update exception:", err.message);
      }

      // 4. Local Storage Sync (High Resilience)
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      localDetails[user.username] = {
        ...(localDetails[user.username] || {}),
        role_id: validRoleId || selectedRoleId,
        role: roleName,
        peran_utama: roleName,
        permissions: cleanedOverrides
      };
      localStorage.setItem("user_additional_details", JSON.stringify(localDetails));

      // Update current logged in session if editing own account
      const currentLoggedIn = JSON.parse(localStorage.getItem("admin_user") || "{}");
      if (currentLoggedIn.id === user.id || currentLoggedIn.username === user.username) {
        const updatedSelf = {
          ...currentLoggedIn,
          role_id: validRoleId || selectedRoleId,
          role: roleName,
          peran_utama: roleName,
          permissions: cleanedOverrides
        };
        localStorage.setItem("admin_user", JSON.stringify(updatedSelf));
      }

      const updatedUserResult = {
        ...user,
        role_id: validRoleId || selectedRoleId,
        role: roleName,
        peran_utama: roleName,
        permissions: cleanedOverrides
      };

      showSuccess(
        "Hak Akses Diperbarui",
        `Hak akses pengguna "${user.nama_lengkap || user.username}" berhasil disimpan!`
      );

      onSuccess(updatedUserResult);
      onClose();
    } catch (err: any) {
      showError("Gagal Menyimpan", err.message || "Gagal memperbarui hak akses pengguna.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* ================================================================ */}
        {/* 1. MODAL HEADER */}
        {/* ================================================================ */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Kelola Hak Akses: {user.nama_lengkap || user.nama || user.username}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  @{user.username}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Pilih peran dasar dan berikan izin tambahan khusus (*Custom Override*) per menu sidebar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================================================================ */}
        {/* 2. ROLE SELECTOR & LEGEND BAR */}
        {/* ================================================================ */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Dropdown Role Utama */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-500" />
                <span>Pilih Peran Utama (Base Role) *</span>
              </label>
              <div className="relative">
                <select
                  value={selectedRoleId}
                  onChange={e => handleRoleChange(e.target.value)}
                  className="w-full text-xs font-bold leading-normal px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.is_system_default ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Helper / Reset */}
            <div className="flex sm:justify-end items-center gap-2 pt-2 sm:pt-4">
              <button
                type="button"
                onClick={handleResetToRoleDefault}
                className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Hapus semua override dan gunakan izin standar dari peran"
              >
                Reset ke Standar Peran
              </button>
            </div>
          </div>

          {/* Visual Legend: Inherited vs Custom Override */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="font-bold text-slate-600 dark:text-slate-300">
                Indikator Hak Akses Efektif:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Diwarisi dari Role
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Izin Khusus (Override)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Tidak Ada Izin
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 3. SEARCH & CATEGORY FILTER */}
        {/* ================================================================ */}
        <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari menu sidebar..."
              className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            />
          </div>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                Kategori: {c}
              </option>
            ))}
          </select>
        </div>

        {/* ================================================================ */}
        {/* 4. PERMISSIONS LIST ACCORDION */}
        {/* ================================================================ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {filteredMenus.map(menu => {
            const isExpanded = expandedMenus[menu.key] ?? true;
            const rolePerm = rolePermissions[menu.key] || {
              can_view: false,
              can_input: false,
              can_edit: false,
              can_delete: false
            };
            const userOvr = userOverrides[menu.key] || {};

            // Calculate Effective Status for Each Action
            const effView = Boolean(userOvr.can_view ?? rolePerm.can_view);
            const effInput = Boolean(userOvr.can_input ?? rolePerm.can_input);
            const effEdit = Boolean(userOvr.can_edit ?? rolePerm.can_edit);
            const effDelete = Boolean(userOvr.can_delete ?? rolePerm.can_delete);

            const hasCustomOverride = Object.keys(userOvr).length > 0;
            const isMenuVisible = effView || effInput || effEdit || effDelete;
            const MenuIcon = menu.icon || Layers;

            return (
              <div
                key={menu.key}
                className={`bg-white dark:bg-slate-900 border rounded-2xl transition-all overflow-hidden ${
                  isMenuVisible
                    ? "border-slate-200/90 dark:border-slate-800"
                    : "border-slate-200/40 dark:border-slate-850 opacity-70"
                }`}
              >
                {/* Header Accordion */}
                <div
                  onClick={() =>
                    setExpandedMenus(prev => ({ ...prev, [menu.key]: !prev[menu.key] }))
                  }
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-950/40 select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${
                      isMenuVisible
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                    }`}>
                      <MenuIcon className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                          {menu.name}
                        </span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                          {menu.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium line-clamp-1">
                        {menu.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {hasCustomOverride && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-mono">
                        Override Aktif
                      </span>
                    )}

                    {!isMenuVisible ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono">
                        Disembunyikan
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-mono">
                        Aktif di Sidebar
                      </span>
                    )}

                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Grid Checkbox Actions */}
                {isExpanded && (
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* 1. View Only */}
                      <ActionCheckboxItem
                        label="View Only"
                        description="Melihat data"
                        checked={effView}
                        isInherited={rolePerm.can_view}
                        isOverridden={userOvr.can_view !== undefined}
                        onChange={() => handleToggleOverride(menu.key, "can_view")}
                      />

                      {/* 2. Input */}
                      <ActionCheckboxItem
                        label="Input"
                        description="Tambah baru"
                        checked={effInput}
                        isInherited={rolePerm.can_input}
                        isOverridden={userOvr.can_input !== undefined}
                        onChange={() => handleToggleOverride(menu.key, "can_input")}
                      />

                      {/* 3. Edit */}
                      <ActionCheckboxItem
                        label="Edit"
                        description="Ubah data"
                        checked={effEdit}
                        isInherited={rolePerm.can_edit}
                        isOverridden={userOvr.can_edit !== undefined}
                        onChange={() => handleToggleOverride(menu.key, "can_edit")}
                      />

                      {/* 4. Hapus */}
                      <ActionCheckboxItem
                        label="Hapus"
                        description="Hapus data"
                        checked={effDelete}
                        isInherited={rolePerm.can_delete}
                        isOverridden={userOvr.can_delete !== undefined}
                        onChange={() => handleToggleOverride(menu.key, "can_delete")}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* 5. MODAL FOOTER */}
        {/* ================================================================ */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:block">
            *Izin kustom akan disimpan sebagai JSONB pada profil pengguna.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveUserPermissions}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan Akses</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Checkbox Item with Visual Badges for Inherited vs Override
function ActionCheckboxItem({
  label,
  description,
  checked,
  isInherited,
  isOverridden,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  isInherited: boolean;
  isOverridden: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer select-none text-left transition-all w-full ${
        checked
          ? isOverridden
            ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-700 text-indigo-950 dark:text-indigo-200 shadow-xs"
            : "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 shadow-xs"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
            checked
              ? isOverridden
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-emerald-600 border-emerald-600 text-white"
              : "border-slate-300 dark:border-slate-600 bg-transparent"
          }`}
        >
          {checked && <Check className="w-3 h-3 stroke-[3]" />}
        </div>
        <div className="flex flex-col truncate">
          <span className="text-[11px] font-black truncate leading-tight">{label}</span>
          <span className="text-[9px] text-slate-400 font-medium truncate leading-tight mt-0.5">{description}</span>
        </div>
      </div>

      {/* Visual Indicator Pill */}
      {checked && (
        <span
          className={`text-[8px] font-black px-1.5 py-0.5 rounded font-mono shrink-0 ${
            isOverridden
              ? "bg-indigo-600 text-white"
              : "bg-emerald-600 text-white"
          }`}
          title={isOverridden ? "Izin khusus (Custom Override)" : "Diwarisi dari Peran Dasar"}
        >
          {isOverridden ? "OVR" : "ROLE"}
        </span>
      )}
    </button>
  );
}
