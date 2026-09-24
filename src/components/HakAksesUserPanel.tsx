import React, { useState, useEffect } from "react";
import { 
  Shield, 
  Check, 
  X, 
  Lock, 
  ChevronDown, 
  ChevronUp, 
  ArrowLeft, 
  Save, 
  CheckSquare, 
  Square, 
  Search,
  Sliders,
  AlertCircle,
  Layers,
  Sparkles,
  User
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { showSuccess, showError, showToast } from "../utils/sweetalert";
import { CORE_SIDEBAR_MENUS, PermissionAction, MenuPermissionsMap } from "../utils/permissionUtils";

interface HakAksesUserPanelProps {
  userId: string;
  onBack: () => void;
}

export default function HakAksesUserPanel({ userId, onBack }: HakAksesUserPanelProps) {
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, PermissionAction>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Initialize all sections as expanded
  useEffect(() => {
    const exp: Record<string, boolean> = {};
    CORE_SIDEBAR_MENUS.forEach(m => {
      exp[m.key] = true;
    });
    setExpandedSections(exp);
  }, []);

  // Fetch User and Permissions
  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      let data: any = null;

      // 1. Try eq("id", userId)
      const { data: res1 } = await supabase
        .from("pengguna")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (res1) {
        data = res1;
      } else {
        // 2. Try eq("username", userId)
        const { data: res2 } = await supabase
          .from("pengguna")
          .select("*")
          .eq("username", userId)
          .maybeSingle();
        if (res2) {
          data = res2;
        } else {
          // 3. Fallback select all
          const { data: allUsers } = await supabase
            .from("pengguna")
            .select("*");
          if (allUsers) {
            data = allUsers.find((u: any) => String(u.id) === String(userId) || u.username === userId);
          }
        }
      }

      if (!data) {
        // Fallback to localStorage
        const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
        const foundKey = Object.keys(localDetails).find(k => k === userId || localDetails[k]?.id === userId);
        if (foundKey) {
          data = { username: foundKey, ...localDetails[foundKey] };
        } else {
          data = { id: userId, username: userId, nama_lengkap: userId, role: "guru_pondok" };
        }
      }

      if (data) {
        setUserData(data);
        
        // Load existing permissions or set defaults
        let existingPerms: Record<string, PermissionAction> = {};
        if (data.permissions && typeof data.permissions === "object") {
          existingPerms = data.permissions;
        } else {
          // Fallback from localStorage cache
          const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
          const cached = localDetails[data.username]?.permissions;
          if (cached) existingPerms = cached;
        }

        // Ensure every menu has permission action structure
        const initialMap: Record<string, PermissionAction> = {};
        CORE_SIDEBAR_MENUS.forEach(menu => {
          const userAction = existingPerms[menu.key] || menu.defaultPermissions || {
            can_view: true,
            can_input: false,
            can_edit: false,
            can_delete: false
          };
          initialMap[menu.key] = {
            can_view: Boolean(userAction.can_view),
            can_input: Boolean(userAction.can_input),
            can_edit: Boolean(userAction.can_edit),
            can_delete: Boolean(userAction.can_delete)
          };
        });

        setPermissionsMap(initialMap);
      }
    } catch (err: any) {
      console.error("Gagal memuat data pengguna:", err);
      showError("Gagal Memuat", "Tidak dapat mengambil data hak akses pengguna.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePermission = (menuKey: string, actionType: keyof PermissionAction) => {
    setPermissionsMap(prev => ({
      ...prev,
      [menuKey]: {
        ...prev[menuKey],
        [actionType]: !prev[menuKey]?.[actionType]
      }
    }));
  };

  const handleSelectAllForMenu = (menuKey: string, select: boolean) => {
    setPermissionsMap(prev => ({
      ...prev,
      [menuKey]: {
        can_view: select,
        can_input: select,
        can_edit: select,
        can_delete: select
      }
    }));
  };

  const handleSave = async () => {
    if (!userData) return;
    setIsSaving(true);
    try {
      // 1. Update Supabase
      const { error } = await supabase
        .from("pengguna")
        .update({
          permissions: permissionsMap,
          updated_at: new Date().toISOString()
        })
        .eq("id", userData.id);

      if (error) {
        console.warn("Supabase update permissions notice:", error.message);
      }

      // 2. Update Local Storage Cache
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      if (!localDetails[userData.username]) {
        localDetails[userData.username] = {};
      }
      localDetails[userData.username].permissions = permissionsMap;
      localStorage.setItem("user_additional_details", JSON.stringify(localDetails));

      showSuccess("Berhasil!", `Hak akses untuk ${userData.nama_lengkap || userData.nama || userData.username} berhasil disimpan.`);
      onBack();
    } catch (err: any) {
      console.error("Gagal menyimpan hak akses:", err);
      showError("Gagal", err.message || "Terjadi kesalahan saat menyimpan hak akses.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMenus = CORE_SIDEBAR_MENUS.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by category
  const categoriesMap = filteredMenus.reduce((acc: Record<string, typeof CORE_SIDEBAR_MENUS>, menu) => {
    if (!acc[menu.category]) acc[menu.category] = [];
    acc[menu.category].push(menu);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Memuat data hak akses...</p>
        </div>
      </div>
    );
  }

  const totalMenus = CORE_SIDEBAR_MENUS.length;
  const activeMenusCount = Object.values(permissionsMap).filter(p => p.can_view).length;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
      
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Kembali ke Manajemen Pengguna"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Pengaturan Hak Akses & Peran
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-xs font-black uppercase tracking-wider border border-indigo-200/50">
                {userData?.role || userData?.peran_utama || "User"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kelola izin akses modul dan tindakan untuk <strong className="text-slate-800 dark:text-white">{userData?.nama_lengkap || userData?.nama || userData?.username}</strong>
            </p>
          </div>
        </div>

        {/* SUMMARY STATS BADGES (Video reference style) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400">Sumber Daya:</span>
            <span className="font-black text-blue-600 dark:text-blue-400">{totalMenus}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400">Halaman Aktif:</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400">{activeMenusCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400">Widget:</span>
            <span className="font-black text-purple-600 dark:text-purple-400">4</span>
          </div>
        </div>
      </div>

      {/* 2. SEARCH BAR & QUICK ACTIONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-3.5 rounded-2xl shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari modul atau menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => {
              const allOn: Record<string, PermissionAction> = {};
              CORE_SIDEBAR_MENUS.forEach(m => {
                allOn[m.key] = { can_view: true, can_input: true, can_edit: true, can_delete: true };
              });
              setPermissionsMap(allOn);
            }}
            className="px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl border border-blue-200/50 dark:border-blue-800/50 transition-colors cursor-pointer"
          >
            Pilih Semua Akses
          </button>
          <button
            onClick={() => {
              const allOff: Record<string, PermissionAction> = {};
              CORE_SIDEBAR_MENUS.forEach(m => {
                allOff[m.key] = { can_view: false, can_input: false, can_edit: false, can_delete: false };
              });
              setPermissionsMap(allOff);
            }}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            Reset Semua
          </button>
        </div>
      </div>

      {/* 3. ACCORDION MODULE CARDS & CHECKBOX GRID (Video Reference Design) */}
      <div className="space-y-4">
        {Object.entries(categoriesMap).map(([categoryName, menus]) => {
          const isCategoryExpanded = expandedSections[categoryName] !== false;

          return (
            <div 
              key={categoryName}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all"
            >
              {/* Category Header Bar */}
              <div 
                onClick={() => setExpandedSections(prev => ({ ...prev, [categoryName]: !isCategoryExpanded }))}
                className="px-6 py-4 bg-slate-50/80 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">
                    {categoryName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                      {categoryName}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {menus.length} Modul / Fitur dalam kategori ini
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
                    {menus.filter(m => permissionsMap[m.key]?.can_view).length} dari {menus.length} Aktif
                  </span>
                  <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
                    {isCategoryExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Menu Items List inside Category */}
              {isCategoryExpanded && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {menus.map((menu) => {
                    const currentPerm = permissionsMap[menu.key] || { can_view: false, can_input: false, can_edit: false, can_delete: false };
                    const isAllSelected = currentPerm.can_view && currentPerm.can_input && currentPerm.can_edit && currentPerm.can_delete;

                    return (
                      <div 
                        key={menu.key}
                        className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors"
                      >
                        {/* Menu Title & Description (Clean, NO technical technical paths like App\Models...) */}
                        <div className="space-y-1 md:w-1/3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                              {menu.name}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {menu.description}
                          </p>
                        </div>

                        {/* Checkbox Grid (Video Reference Style: Lihat, Buat, Ubah, Hapus, Pilih Semua) */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:w-2/3 justify-end">
                          
                          {/* Select All / Bulk for this menu */}
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-600 transition-colors">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={(e) => handleSelectAllForMenu(menu.key, e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700"
                            />
                            <span>Pilih Semua</span>
                          </label>

                          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

                          {/* Lihat */}
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={currentPerm.can_view}
                              onChange={() => handleTogglePermission(menu.key, "can_view")}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700"
                            />
                            <span>Lihat</span>
                          </label>

                          {/* Buat / Input */}
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={currentPerm.can_input}
                              onChange={() => handleTogglePermission(menu.key, "can_input")}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700"
                            />
                            <span>Buat</span>
                          </label>

                          {/* Ubah / Edit */}
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={currentPerm.can_edit}
                              onChange={() => handleTogglePermission(menu.key, "can_edit")}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700"
                            />
                            <span>Ubah</span>
                          </label>

                          {/* Hapus */}
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={currentPerm.can_delete}
                              onChange={() => handleTogglePermission(menu.key, "can_delete")}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700"
                            />
                            <span>Hapus</span>
                          </label>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. BOTTOM ACTION BAR (Simpan Perubahan & Kembali) */}
      <div className="sticky bottom-4 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
        >
          Batal / Kembali
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 text-xs sm:text-sm font-extrabold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Menyimpan..." : "Simpan Perubahan Akses"}</span>
        </button>
      </div>

    </div>
  );
}
