import React, { useState, useEffect } from "react";
import { Trash2, Shield, User, Key, Check, AlertCircle, Lock, SlidersHorizontal } from "lucide-react";
import { supabase } from "../supabaseClient";
import { showSuccess, showError, showDeleteConfirm, showConfirm, showToast } from "../utils/sweetalert";
import { fetchRolePermissionsAsync, normalizeRoleSlug } from "../utils/permissionUtils";

interface PenggunaData {
  id: string;
  username: string;
  nama: string;
  nama_lengkap?: string;
  role: string;
  role_id?: string;
  peran_utama?: string;
  permissions?: any;
  status_akun?: string;
  tugas_tambahan?: string[];
  gender?: string;
  bagian?: string;
  jabatan?: string;
  tugas_kamar?: string;
  tugas_kelas_sekolah?: string;
  tugas_kelas_pengajian?: string;
  tugas_mapel?: string;
  tugas_kantin?: string;
}

interface ManajemenPenggunaPanelProps {
  onOpenHakAkses?: (userId: string) => void;
}

const DEFAULT_SYSTEM_ROLES = [
  { id: "5dc38b56-a7cd-459c-9eee-e3ad4d877d51", name: "Guru Pondok", label: "Guru Pondok" },
  { id: "8210ec88-1832-49d0-bb3c-5181b875c6e5", name: "Guru Sekolah", label: "Guru Sekolah" },
  { id: "10c7deeb-3f3c-423f-aa51-2f1269404619", name: "Admin Ponpes", label: "Admin Ponpes" },
  { id: "22a21a1d-80e0-41b8-b396-7fef6bc76134", name: "Super Admin", label: "Super Admin" }
];

export default function ManajemenPenggunaPanel({ onOpenHakAkses }: ManajemenPenggunaPanelProps) {
  const [users, setUsers] = useState<PenggunaData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Database Roles State
  const [dbRoles, setDbRoles] = useState<any[]>(DEFAULT_SYSTEM_ROLES);

  const roles = [
    { id: "super admin", label: "Super Admin" },
    { id: "admin", label: "Admin" },
    { id: "guru_pondok", label: "Guru Pondok" },
    { id: "guru_sekolah", label: "Guru Sekolah (SMP/SMA)" },
    { id: "pengurus", label: "Pengurus" },
    { id: "kantin", label: "Petugas Kantin" },
    { id: "guru pondok", label: "Guru Pondok (Legacy)" },
    { id: "guru SMP", label: "Guru SMP (Legacy)" },
    { id: "pondok", label: "Pondok (Legacy)" },
    { id: "SMA", label: "SMA (Legacy)" },
    { id: "SMP", label: "SMP (Legacy)" }
  ];

  const fetchRolesFromDb = async () => {
    try {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        const clean = data.filter((r: any) => 
          !String(r.name || "").toLowerCase().includes("kantin") &&
          !String(r.name || "").toLowerCase().includes("pengurus")
        );
        if (clean.length > 0) {
          setDbRoles(clean);
        }
      }
    } catch (e) {
      console.warn("Notice fetch roles in ManajemenPengguna:", e);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const { data, error } = await supabase
        .from("pengguna")
        .select("*")
        .order("created_at", { ascending: false });
      
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      
      const processUserList = (rawList: any[]) => {
        return (rawList || []).map((u: any) => {
          const extra = localDetails[u.username] || {};
          const peran = u.peran_utama || u.role || extra.peran_utama || extra.role || "Guru Pondok";
          const roleId = u.role_id || extra.role_id || "";
          const rawPermissions = u.permissions ?? extra.permissions ?? {};
          const rawTugasTambahan = u.tugas_tambahan || extra.tugas_tambahan || [];
          const userTugasTambahan = Array.isArray(rawTugasTambahan) ? rawTugasTambahan : [];

          return {
            ...u,
            nama: u.nama_lengkap || u.nama || extra.nama_lengkap || extra.nama || u.username,
            nama_lengkap: u.nama_lengkap || u.nama || extra.nama_lengkap || extra.nama || u.username,
            peran_utama: peran,
            role: peran,
            role_id: roleId,
            status_akun: u.status_akun || extra.status_akun || "approved",
            permissions: rawPermissions,
            tugas_tambahan: userTugasTambahan,
            gender: u.gender || extra.gender || "Semua",
            bagian: u.bagian || extra.bagian || (peran.toLowerCase().includes("sekolah") ? "sekolah" : "pondok"),
            jabatan: u.jabatan || extra.jabatan || peran,
            tugas_kamar: u.tugas_kamar || extra.tugas_kamar || "",
            tugas_kelas_sekolah: u.tugas_kelas_sekolah || extra.tugas_kelas_sekolah || "",
            tugas_kelas_pengajian: u.tugas_kelas_pengajian || extra.tugas_kelas_pengajian || "",
            tugas_mapel: u.tugas_mapel || extra.tugas_mapel || "",
            tugas_kantin: u.tugas_kantin || extra.tugas_kantin || ""
          };
        });
      };

      if (error) {
        console.warn("Custom columns query failed, trying basic select fallback:", error.message);
        const { data: basicData, error: basicError } = await supabase
          .from("pengguna")
          .select("id, username, nama, gender")
          .order("created_at", { ascending: false });
        
        if (basicError) throw basicError;
        setUsers(processUserList(basicData || []));
      } else {
        setUsers(processUserList(data || []));
      }
    } catch (err: any) {
      console.warn("Gagal mengambil data pengguna:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesFromDb();
    fetchUsers();
  }, []);

  const handleDelete = async (id: string, uname: string) => {
    const isConfirmed = await showDeleteConfirm(`pengguna "${uname}"`);
    if (!isConfirmed) return;
    try {
      setIsLoading(true);
      const { error } = await supabase.from("pengguna").delete().eq("id", id);
      if (error) throw error;
      
      // Clean local storage copy as well
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      delete localDetails[uname];
      localStorage.setItem("user_additional_details", JSON.stringify(localDetails));

      await fetchUsers();
      showToast(`Pengguna "${uname}" berhasil dihapus`, "success");
    } catch (err: any) {
      showError("Gagal Menghapus", err.message || "Terjadi kesalahan saat menghapus pengguna.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveUser = async (user: PenggunaData) => {
    const displayName = user.nama_lengkap || user.nama || user.username;
    const rawRole = user.peran_utama || user.role || 'Guru Pondok';
    const matched = dbRoles.find(r => 
      (user.role_id && r.id === user.role_id) ||
      r.name.toLowerCase() === rawRole.toLowerCase() ||
      normalizeRoleSlug(r.name) === normalizeRoleSlug(rawRole)
    ) || dbRoles[0];

    const isConfirmed = await showConfirm({
      title: "Setujui Akun Pengguna?",
      html: `
        <div class="text-left space-y-2 mt-2">
          <p class="text-sm">Apakah Anda yakin ingin menyetujui akun ini?</p>
          <div class="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl space-y-1.5 text-xs border border-slate-200 dark:border-slate-700">
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Nama:</span> <strong class="text-slate-700 dark:text-slate-200">${displayName}</strong></div>
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Username:</span> <span class="font-mono text-slate-600 dark:text-slate-300">@${user.username}</span></div>
            <div class="flex justify-between"><span class="text-slate-400 font-semibold">Peran:</span> <span class="text-emerald-600 dark:text-emerald-400 font-bold">${matched.name}</span></div>
          </div>
          <p class="text-[11px] text-slate-500 italic pt-1">* Hak akses menu dapat dikonfigurasi sewaktu-waktu di halaman <strong>Hak Akses</strong>.</p>
        </div>
      `,
      icon: "question",
      confirmButtonText: "Iya, Setujui",
      cancelButtonText: "Tidak",
      confirmButtonColor: "#059669",
    });

    if (!isConfirmed) return;

    try {
      setIsLoading(true);

      // Fetch standard role permissions if user permissions are not already set
      let finalPerms = user.permissions;
      if (!finalPerms || Object.keys(finalPerms).length === 0) {
        finalPerms = await fetchRolePermissionsAsync(matched.id, matched.name);
      }

      const updatePayload: any = {
        status_akun: 'approved',
        peran_utama: matched.name,
        role: matched.name,
        role_id: matched.id,
        permissions: finalPerms
      };

      const { error } = await supabase
        .from('pengguna')
        .update(updatePayload)
        .eq('id', user.id);
        
      if (error) throw error;
      
      // Update local storage backup as well
      const localDetails = JSON.parse(localStorage.getItem("user_additional_details") || "{}");
      if (!localDetails[user.username]) localDetails[user.username] = {};
      localDetails[user.username] = {
        ...localDetails[user.username],
        status: 'approved',
        status_akun: 'approved',
        peran_utama: matched.name,
        role: matched.name,
        role_id: matched.id,
        permissions: finalPerms
      };
      localStorage.setItem("user_additional_details", JSON.stringify(localDetails));

      showSuccess(
        "Akun Berhasil Disetujui",
        `Akun "${displayName}" telah disetujui sebagai ${matched.name}.`
      );
      await fetchUsers();
    } catch (error: any) {
      console.error("Gagal melakukan approval:", error);
      showError("Terjadi Kesalahan", error.message || "Gagal menyetujui akun pengguna.");
    } finally {
      setIsLoading(false);
    }
  };

  const mapJabatanIdToLabel = (id: string) => {
    if (id === "guru pondok") return "Guru Pondok";
    if (id === "guru_mapel") return "Guru Mata Pelajaran";
    if (id === "wali_kamar") return "Wali Kamar";
    if (id === "wali_kelas") return "Wali Kelas Sekolah";
    if (id === "kepala_sekolah") return "Kepala Sekolah";
    if (id === "wakil_kepala_sekolah") return "Wakil Kepala Sekolah";
    if (id === "kantin") return "Petugas Kantin";
    return id;
  };

  return (
    <div className="w-full pb-24 lg:pb-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Header */}
      <div className="bg-white dark:bg-[#111322] border-b border-slate-200 dark:border-slate-800 px-6 py-6 rounded-t-3xl sm:rounded-3xl sm:shadow-sm sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800/50 shadow-inner">
            <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Manajemen Pengguna</h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">Daftar akun staf, hak akses, dan persetujuan akun.</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-[#111322] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/50 min-h-[400px]">
        {errorMessage ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-xl text-xs flex flex-col gap-2 relative">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1">Akses Tabel Gagal</strong>
                {errorMessage}
              </div>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-slate-400 select-none flex flex-col items-center justify-center space-y-4">
            <Shield className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">Belum Ada Pengguna</h4>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              Anda belum menambahkan akun pengguna lain selain admin utama. Silakan tambahkan pengguna baru.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user, idx) => (
              <div key={`user-${user.id || user.username || idx}-${idx}`} className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 transition-colors relative group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {user.nama}
                        {user.status_akun === 'pending' && (
                          <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">Pending</span>
                        )}
                        {user.status_akun === 'approved' && (
                          <span className="bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">Approved</span>
                        )}
                        {user.status_akun === 'rejected' && (
                          <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">Rejected</span>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500">@{user.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const targetId = user.id || user.username;
                        console.log("Akses & Role clicked for user ID:", targetId);
                        if (targetId) {
                          if (typeof window !== "undefined") {
                            window.history.pushState({}, "", `/manajemen-pengguna/${targetId}/hak-akses`);
                          }
                          if (onOpenHakAkses) {
                            onOpenHakAkses(targetId);
                          } else {
                            window.dispatchEvent(new CustomEvent('open-hak-akses', { detail: targetId }));
                          }
                        }
                      }}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 dark:text-indigo-400 dark:hover:text-white rounded-lg transition-colors"
                      title="Kelola Peran & Izin Khusus"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                    {user.status_akun === 'pending' && (
                      <button 
                        type="button"
                        onClick={() => handleApproveUser(user)} 
                        className="p-1.5 bg-emerald-100 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/60 dark:hover:bg-emerald-600 dark:text-emerald-400 dark:hover:text-white rounded-lg transition-colors cursor-pointer" 
                        title="Setujui Akun (Approve)"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(user.id, user.username)} className="p-1.5 bg-slate-200 hover:bg-red-500 dark:bg-slate-800 dark:hover:bg-red-600 text-slate-600 hover:text-white dark:text-slate-300 rounded-lg transition-colors" title="Hapus Pengguna">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Bagian, Jabatan, and Tugas Details Panel */}
                <div className="text-xs font-semibold text-slate-650 dark:text-slate-300 space-y-1.5 border-t border-dashed border-slate-200 dark:border-slate-800/80 pt-3 mt-1">
                  <div className="flex justify-between items-start text-[11px] gap-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Bagian:</span>
                    <span className="font-black text-slate-700 dark:text-slate-200 capitalize bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-right">
                      {(() => {
                        const bags = [];
                        if (user.bagian?.includes("pondok") || user.bagian === "kedua") bags.push("Pondok");
                        if (user.bagian?.includes("sekolah") || user.bagian === "kedua") bags.push("Sekolah");
                        return bags.length > 0 ? bags.join(" & ") : "-";
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-[11px] gap-2">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Jabatan:</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md text-right max-w-[180px] break-all">
                      {user.jabatan ? user.jabatan.split(",").map(mapJabatanIdToLabel).join(", ") : "-"}
                    </span>
                  </div>

                  {user.tugas_mapel && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Mapel Diajar:</span>
                      <span className="font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_mapel}
                      </span>
                    </div>
                  )}

                  {user.tugas_tambahan && user.tugas_tambahan.length > 0 && (
                    <div className="flex justify-between items-start text-[11px] gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px] shrink-0 mt-0.5">Tugas Tambahan:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md text-right max-w-[180px] break-all">
                        {user.tugas_tambahan.join(", ")}
                      </span>
                    </div>
                  )}

                  {user.tugas_kamar && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Tugas Kamar:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_kamar}
                      </span>
                    </div>
                  )}
                  {user.tugas_kelas_sekolah && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Kelas (Sekolah):</span>
                      <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_kelas_sekolah}
                      </span>
                    </div>
                  )}
                  {user.tugas_kelas_pengajian && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Kelas (Pondok):</span>
                      <span className="font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_kelas_pengajian}
                      </span>
                    </div>
                  )}
                  {user.tugas_kantin && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Tugas Kantin:</span>
                      <span className="font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded-md">
                        {user.tugas_kantin}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="flex gap-2 items-center">
                    <div className="text-[10px] font-black px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md uppercase tracking-wider">
                      {roles.find(r => r.id === user.role)?.label || user.role}
                    </div>
                    {user.gender && user.gender !== 'Semua' && (
                      <div className="text-[10px] font-black px-2 py-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 rounded-md uppercase tracking-wider">
                        {user.gender === 'L' ? 'L' : user.gender === 'P' ? 'P' : user.gender}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const targetId = user.id || user.username;
                      console.log("Akses & Role text button clicked for user ID:", targetId);
                      if (targetId) {
                        if (typeof window !== "undefined") {
                          window.history.pushState({}, "", `/manajemen-pengguna/${targetId}/hak-akses`);
                        }
                        if (onOpenHakAkses) {
                          onOpenHakAkses(targetId);
                        } else {
                          window.dispatchEvent(new CustomEvent('open-hak-akses', { detail: targetId }));
                        }
                      }
                    }}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer border border-indigo-200/50 dark:border-indigo-800/50"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Akses & Role</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
