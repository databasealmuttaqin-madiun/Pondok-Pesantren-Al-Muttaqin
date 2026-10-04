import React, { useState, useEffect, useMemo } from "react";
import { 
  FileCheck, 
  Search, 
  Filter, 
  Eye, 
  Edit3, 
  ChevronDown, 
  Plus, 
  Send, 
  X, 
  Check, 
  RefreshCw, 
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

export interface PerizinanGuruItem {
  id: string;
  guru_id?: string;
  guru_username: string;
  guru_nama: string;
  tanggal_mulai: string;
  tanggal_selesai?: string;
  lamanya: string;
  alasan: string;
  status: "Menunggu" | "Disetujui" | "Ditolak";
  disetujui_oleh?: string;
  tanggal_pengajuan: string;
  catatan_petugas?: string;
}

interface PerizinanGuruPanelProps {
  currentUser?: any;
  onTriggerNotification?: (msg: string, type: "success" | "error" | "warning") => void;
}

export default function PerizinanGuruPanel({
  currentUser,
  onTriggerNotification
}: PerizinanGuruPanelProps) {
  // Navigation & Sub-Tabs
  const [activeTab, setActiveTab] = useState<"daftar" | "saya">("daftar");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<PerizinanGuruItem | null>(null);

  // Form State
  const [isFilingChecked, setIsFilingChecked] = useState<boolean>(true);
  const [tanggalMulai, setTanggalMulai] = useState<string>(new Date().toISOString().split("T")[0]);
  const [lamanya, setLamanya] = useState<string>("1 Hari");
  const [customLamanya, setCustomLamanya] = useState<string>("");
  const [alasan, setAlasan] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Data State
  const [perizinanList, setPerizinanList] = useState<PerizinanGuruItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("Semua");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [timPerizinanList, setTimPerizinanList] = useState<any[]>([]);

  // Check if current user is part of Tim Perizinan
  const userRole = String(currentUser?.peran_utama || currentUser?.role || "").toLowerCase();
  const tugasTambahan = Array.isArray(currentUser?.tugas_tambahan) ? currentUser.tugas_tambahan : [];

  const isTimPerizinan = useMemo(() => {
    if (!currentUser) return false;
    const isSuper = userRole.includes("super admin") || userRole.includes("superadmin") || userRole === "admin";
    const isPimpinan = userRole.includes("pimpinan") || userRole.includes("pengurus") || userRole.includes("kepala");
    const isTugasTim = tugasTambahan.some((t: string) => String(t).toLowerCase().includes("perizinan") || String(t).toLowerCase().includes("izin"));

    const inPlottingList = timPerizinanList.some((p: any) => {
      const u = (currentUser?.username || "").toLowerCase();
      const n = (currentUser?.nama_lengkap || currentUser?.nama || currentUser?.name || "").toLowerCase();
      return (
        (u && p.guru_username && p.guru_username.toLowerCase() === u) ||
        (n && p.guru_nama && p.guru_nama.toLowerCase() === n) ||
        (currentUser?.id && p.guru_id && String(p.guru_id) === String(currentUser.id))
      );
    });

    return isSuper || isPimpinan || isTugasTim || inPlottingList;
  }, [currentUser, userRole, tugasTambahan, timPerizinanList]);

  useEffect(() => {
    loadPerizinanData();
    loadTimPerizinanData();
  }, []);

  const loadTimPerizinanData = async () => {
    try {
      const { data } = await supabase.from("plotting_tim_perizinan").select("*");
      if (data && data.length > 0) {
        setTimPerizinanList(data);
        localStorage.setItem("plotting_tim_perizinan_data", JSON.stringify(data));
      } else {
        const saved = localStorage.getItem("plotting_tim_perizinan_data");
        if (saved) setTimPerizinanList(JSON.parse(saved));
      }
    } catch (_) {
      const saved = localStorage.getItem("plotting_tim_perizinan_data");
      if (saved) setTimPerizinanList(JSON.parse(saved));
    }
  };

  const loadPerizinanData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("perizinan_guru")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        const formatted: PerizinanGuruItem[] = data.map((item: any) => ({
          id: String(item.id),
          guru_id: item.guru_id ? String(item.guru_id) : undefined,
          guru_username: item.guru_username || item.username || "",
          guru_nama: item.guru_nama || item.nama_guru || item.nama || "Guru",
          tanggal_mulai: item.tanggal_mulai || item.tanggal || new Date().toISOString().split("T")[0],
          tanggal_selesai: item.tanggal_selesai || item.tanggal_mulai,
          lamanya: item.lamanya || "1 Hari",
          alasan: item.alasan || "-",
          status: item.status || "Menunggu",
          disetujui_oleh: item.disetujui_oleh || item.approved_by,
          tanggal_pengajuan: item.tanggal_pengajuan || item.created_at || new Date().toISOString().split("T")[0],
          catatan_petugas: item.catatan_petugas
        }));
        setPerizinanList(formatted);
        localStorage.setItem("perizinan_guru_list_cache", JSON.stringify(formatted));
      } else {
        const saved = localStorage.getItem("perizinan_guru_list_cache");
        if (saved) {
          setPerizinanList(JSON.parse(saved));
        } else {
          setPerizinanList([]);
        }
      }
    } catch (err) {
      console.warn("Notice loading perizinan_guru:", err);
      const saved = localStorage.getItem("perizinan_guru_list_cache");
      if (saved) setPerizinanList(JSON.parse(saved));
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Leave Request Form
  const handleSubmitPengajuan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFilingChecked) {
      MySwal.fire({
        icon: "warning",
        title: "Perhatian",
        text: "Mohon centang opsi 'Saya ingin mengajukan perizinan'.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    if (!alasan.trim()) {
      MySwal.fire({
        icon: "warning",
        title: "Perhatian",
        text: "Isikan alasan perizinan Anda.",
        confirmButtonColor: "#2563eb"
      });
      return;
    }

    const effectiveLamanya = lamanya === "Lainnya" ? customLamanya || "1 Hari" : lamanya;
    const teacherName = currentUser?.nama_lengkap || currentUser?.nama || currentUser?.name || "Guru Sekolah";
    const teacherUsername = currentUser?.username || "guru";

    setIsSubmitting(true);

    const newRecordPayload = {
      guru_username: teacherUsername,
      guru_nama: teacherName,
      tanggal_mulai: tanggalMulai,
      lamanya: effectiveLamanya,
      alasan: alasan.trim(),
      status: "Menunggu",
      tanggal_pengajuan: new Date().toISOString().split("T")[0]
    };

    try {
      const { data: inserted, error } = await supabase
        .from("perizinan_guru")
        .insert([newRecordPayload])
        .select()
        .single();

      let createdItem: PerizinanGuruItem;

      if (!error && inserted) {
        createdItem = {
          id: String(inserted.id),
          guru_username: teacherUsername,
          guru_nama: teacherName,
          tanggal_mulai: tanggalMulai,
          lamanya: effectiveLamanya,
          alasan: alasan.trim(),
          status: "Menunggu",
          tanggal_pengajuan: new Date().toISOString().split("T")[0]
        };
      } else {
        createdItem = {
          id: `pg_${Date.now()}`,
          guru_username: teacherUsername,
          guru_nama: teacherName,
          tanggal_mulai: tanggalMulai,
          lamanya: effectiveLamanya,
          alasan: alasan.trim(),
          status: "Menunggu",
          tanggal_pengajuan: new Date().toISOString().split("T")[0]
        };
      }

      const updatedList = [createdItem, ...perizinanList];
      setPerizinanList(updatedList);
      localStorage.setItem("perizinan_guru_list_cache", JSON.stringify(updatedList));

      MySwal.fire({
        icon: "success",
        title: "Berhasil Diajukan",
        text: "Perizinan Anda telah dikirim ke Tim Perizinan.",
        confirmButtonColor: "#2563eb",
        timer: 2000
      });

      if (onTriggerNotification) {
        onTriggerNotification("Pengajuan perizinan berhasil dikirim!", "success");
      }

      // Reset & close modal
      setAlasan("");
      setLamanya("1 Hari");
      setCustomLamanya("");
      setIsModalOpen(false);
      setActiveTab("saya");

    } catch (err: any) {
      console.error("Error submitting leave request:", err);
      MySwal.fire({
        icon: "error",
        title: "Gagal Mengajukan",
        text: err?.message || "Terjadi kesalahan saat mengajukan perizinan.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve or Reject request
  const handleUpdateStatus = async (item: PerizinanGuruItem, newStatus: "Disetujui" | "Ditolak") => {
    const approverName = currentUser?.nama_lengkap || currentUser?.nama || "Tim Perizinan";

    const confirmRes = await MySwal.fire({
      title: `${newStatus === "Disetujui" ? "Setujui" : "Tolak"} Perizinan?`,
      text: `Apakah Anda yakin ingin ${newStatus.toLowerCase()} perizinan ${item.guru_nama}?`,
      icon: newStatus === "Disetujui" ? "question" : "warning",
      showCancelButton: true,
      confirmButtonColor: newStatus === "Disetujui" ? "#2563eb" : "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: newStatus === "Disetujui" ? "Ya, Setujui" : "Tolak Izin",
      cancelButtonText: "Batal"
    });

    if (!confirmRes.isConfirmed) return;

    try {
      // 1. Update in Supabase
      const { error } = await supabase
        .from("perizinan_guru")
        .update({
          status: newStatus,
          disetujui_oleh: approverName,
          updated_at: new Date().toISOString()
        })
        .eq("id", item.id);

      if (error) {
        console.warn("Notice updating perizinan_guru in Supabase:", error.message);
      }

      // 2. If approved, record "Izin" status in 'absensi_guru'
      if (newStatus === "Disetujui") {
        try {
          const attendanceDate = item.tanggal_mulai;
          const timestamp = `${attendanceDate}T07:00:00.000Z`;

          const { data: existingAtt } = await supabase
            .from("absensi_guru")
            .select("id")
            .eq("username", item.guru_username)
            .gte("waktu_absen", `${attendanceDate}T00:00:00`)
            .lte("waktu_absen", `${attendanceDate}T23:59:59`);

          if (existingAtt && existingAtt.length > 0) {
            await supabase
              .from("absensi_guru")
              .update({
                status: "Izin",
                keterangan: `Izin Guru (${item.lamanya}): ${item.alasan}`,
                petugas: approverName
              })
              .eq("id", existingAtt[0].id);
          } else {
            await supabase
              .from("absensi_guru")
              .insert([{
                username: item.guru_username,
                nama: item.guru_nama,
                waktu_absen: timestamp,
                status: "Izin",
                keterangan: `Izin Guru (${item.lamanya}): ${item.alasan}`,
                petugas: approverName
              }]);
          }

          // LocalStorage fallback for reactivity
          const localKey = `absensi_guru_${item.guru_username}_${attendanceDate}`;
          localStorage.setItem(localKey, JSON.stringify({
            status: "Izin",
            waktu_absen: timestamp,
            keterangan: `Izin Guru (${item.lamanya}): ${item.alasan}`
          }));

        } catch (attErr) {
          console.warn("Notice auto syncing to absensi_guru:", attErr);
        }
      }

      // 3. Update local state
      const updatedList = perizinanList.map((p) => {
        if (p.id === item.id) {
          return {
            ...p,
            status: newStatus,
            disetujui_oleh: approverName
          };
        }
        return p;
      });

      setPerizinanList(updatedList);
      localStorage.setItem("perizinan_guru_list_cache", JSON.stringify(updatedList));

      if (selectedDetailItem && selectedDetailItem.id === item.id) {
        setSelectedDetailItem({
          ...selectedDetailItem,
          status: newStatus,
          disetujui_oleh: approverName
        });
      }

      MySwal.fire({
        icon: "success",
        title: `Izin ${newStatus}`,
        text: `Perizinan ${item.guru_nama} telah ${newStatus.toLowerCase()}.`,
        confirmButtonColor: "#2563eb",
        timer: 1800
      });

      if (onTriggerNotification) {
        onTriggerNotification(`Perizinan ${item.guru_nama} ${newStatus.toLowerCase()}!`, "success");
      }

    } catch (err: any) {
      console.error("Gagal memperbarui status perizinan:", err);
      MySwal.fire({
        icon: "error",
        title: "Gagal Memperbarui",
        text: err?.message || "Gagal memperbarui status perizinan.",
        confirmButtonColor: "#2563eb"
      });
    }
  };

  // Filtered List based on active Tab & Search/Status filters
  const filteredList = useMemo(() => {
    return perizinanList.filter((item) => {
      // Filter by subtab
      if (activeTab === "saya") {
        const u = currentUser?.username;
        if (u && item.guru_username && item.guru_username !== u) {
          return false;
        }
      }

      // Filter by status dropdown
      if (filterStatus !== "Semua" && item.status !== filterStatus) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.guru_nama.toLowerCase().includes(q) ||
          item.alasan.toLowerCase().includes(q) ||
          item.lamanya.toLowerCase().includes(q) ||
          item.tanggal_mulai.includes(q)
        );
      }

      return true;
    });
  }, [perizinanList, activeTab, currentUser, filterStatus, searchQuery]);

  // Pagination calculation
  const totalItems = filteredList.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedList = useMemo(() => {
    return filteredList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredList, startIndex, itemsPerPage]);

  const pendingCount = useMemo(() => perizinanList.filter(p => p.status === "Menunggu").length, [perizinanList]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 animate-fadeIn pb-16 font-sans text-slate-800">
      
      {/* 1. BREADCRUMBS & PAGE HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Perizinan Guru</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-600 font-semibold">Daftar</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Perizinan Guru
          </h1>
        </div>

        {/* TOP RIGHT PRIMARY ACTION BUTTON */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Perizinan</span>
        </button>
      </div>

      {/* 2. CENTER PILL SUB-TAB SELECTOR */}
      <div className="flex justify-center my-2">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-2xs inline-flex items-center gap-1">
          <button
            onClick={() => { setActiveTab("daftar"); setCurrentPage(1); }}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "daftar"
                ? "bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            Daftar Perizinan
          </button>

          <button
            onClick={() => { setActiveTab("saya"); setCurrentPage(1); }}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "saya"
                ? "bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            Perizinan Saya
          </button>
        </div>
      </div>

      {/* 3. MAIN CONTAINER CARD */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        
        {/* CARD HEADER TOOLBAR */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3 bg-white">
          
          {/* SEARCH INPUT */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>

          {/* FILTER BUTTON WITH BADGE */}
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="p-2 border border-slate-200/90 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer relative"
              title="Filter Status"
            >
              <Filter className="w-4 h-4" />
              {filterStatus !== "Semua" && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full text-[9px] w-4 h-4 font-bold flex items-center justify-center">
                  1
                </span>
              )}
            </button>

            {/* Filter Dropdown Menu */}
            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 font-medium text-xs">
                {["Semua", "Menunggu", "Disetujui", "Ditolak"].map((st) => (
                  <button
                    key={st}
                    onClick={() => { setFilterStatus(st); setIsFilterDropdownOpen(false); }}
                    className={`w-full text-left px-3.5 py-1.5 hover:bg-slate-50 transition-colors ${
                      filterStatus === st ? "text-blue-600 font-bold bg-blue-50/50" : "text-slate-700"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* COLUMNS TOGGLE ICON */}
          <button 
            className="p-2 border border-slate-200/90 rounded-xl text-slate-500 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer"
            title="Tampilan Kolom"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* TABLE COMPONENT */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-700 font-bold text-[12px]">
                
                {/* ACTION COLUMN ON FAR LEFT */}
                <th className="py-3.5 px-4 w-24 text-center">Aksi</th>

                <th className="py-3.5 px-4 font-bold">
                  <div className="flex items-center gap-1 cursor-pointer select-none">
                    <span>Nama</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>

                <th className="py-3.5 px-4 font-bold">
                  <div className="flex items-center gap-1 cursor-pointer select-none">
                    <span>Alasan</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>

                <th className="py-3.5 px-4 font-bold">
                  <div className="flex items-center gap-1 cursor-pointer select-none">
                    <span>Lama Izin</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>

                <th className="py-3.5 px-4 font-bold">
                  <div className="flex items-center gap-1 cursor-pointer select-none">
                    <span>Tanggal</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>

                <th className="py-3.5 px-4 font-bold">
                  <div className="flex items-center gap-1 cursor-pointer select-none">
                    <span>Status</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>

                <th className="py-3.5 px-4 font-bold">
                  <div className="flex items-center gap-1 cursor-pointer select-none">
                    <span>Disetujui Oleh</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Memuat data perizinan...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Belum ada data perizinan guru.
                  </td>
                </tr>
              ) : (
                paginatedList.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      
                      {/* ACTION BUTTONS (EYE & BLUE EDIT/APPROVE) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedDetailItem(item)}
                            className="p-1.5 border border-slate-200/90 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isTimPerizinan && item.status === "Menunggu" ? (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(item, "Disetujui")}
                                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-all cursor-pointer"
                                title="Setujui Perizinan"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(item, "Ditolak")}
                                className="p-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Tolak Perizinan"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setSelectedDetailItem(item)}
                              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-all cursor-pointer"
                              title="Detail Action"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* NAMA GURU */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {item.guru_nama}
                      </td>

                      {/* ALASAN */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">
                        {item.alasan}
                      </td>

                      {/* LAMA IZIN */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100/60">
                          {item.lamanya || "1 Hari"}
                        </span>
                      </td>

                      {/* TANGGAL */}
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {item.tanggal_mulai}
                      </td>

                      {/* STATUS BADGE */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                          item.status === "Disetujui"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100/60"
                            : item.status === "Ditolak"
                            ? "bg-rose-50 text-rose-600 border border-rose-100/60"
                            : "bg-amber-50 text-amber-600 border border-amber-100/60"
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* DISETUJUI OLEH */}
                      <td className="py-3.5 px-4 text-slate-400 font-normal whitespace-nowrap">
                        {item.disetujui_oleh || "Belum Ditentukan"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER PAGINATION BAR */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div>
            Menampilkan {totalItems > 0 ? startIndex + 1 : 0} sampai {Math.min(startIndex + itemsPerPage, totalItems)} dari {totalItems} hasil
          </div>

          <div className="flex items-center gap-2">
            <span>per halaman</span>
            <div className="relative">
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white border border-slate-200/90 rounded-xl px-3 py-1 pr-7 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

      </div>

      {/* 4. MODAL FORM: AJUKAN PERIZINAN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
            
            {/* MODAL HEADER */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Ajukan Perizinan Guru
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL FORM BODY */}
            <form onSubmit={handleSubmitPengajuan} className="p-5 space-y-4">
              
              {/* CHECKBOX: AJUKAN PERIZINAN */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="modal_check_ajukan"
                  checked={isFilingChecked}
                  onChange={(e) => setIsFilingChecked(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="modal_check_ajukan" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                  Saya ingin mengajukan perizinan
                </label>
              </div>

              {/* TANGGAL IZIN */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Tanggal Izin <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className="w-full bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* LAMANYA PERIZINAN */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Lamanya Perizinan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={lamanya}
                  onChange={(e) => setLamanya(e.target.value)}
                  className="w-full bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="1 Hari">1 Hari</option>
                  <option value="2 Hari">2 Hari</option>
                  <option value="3 Hari">3 Hari</option>
                  <option value="Setengah Hari">Setengah Hari</option>
                  <option value="Lainnya">Lainnya</option>
                </select>

                {lamanya === "Lainnya" && (
                  <input
                    type="text"
                    placeholder="Contoh: 4 Jam / 5 Hari"
                    value={customLamanya}
                    onChange={(e) => setCustomLamanya(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs text-slate-800 mt-2 focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>

              {/* ALASAN PERIZINAN */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Alasan Perizinan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan alasan perizinan Anda..."
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  className="w-full bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
                  required
                />
              </div>

              {/* MODAL FOOTER BUTTONS */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting || !isFilingChecked}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <span>Ajukan Izin</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DETAIL & APPROVAL ACTION */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
            
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Detail Perizinan Guru
              </h3>
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Nama Guru</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedDetailItem.guru_nama}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Tanggal</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedDetailItem.tanggal_mulai}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Lamanya Perizinan</div>
                <div className="font-bold text-blue-600 mt-0.5">{selectedDetailItem.lamanya}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Alasan Perizinan</div>
                <div className="text-slate-800 font-medium mt-1 leading-relaxed whitespace-pre-wrap">{selectedDetailItem.alasan}</div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Status</div>
                  <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                    selectedDetailItem.status === "Disetujui"
                      ? "bg-emerald-50 text-emerald-600"
                      : selectedDetailItem.status === "Ditolak"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-amber-50 text-amber-600"
                  }`}>
                    {selectedDetailItem.status}
                  </span>
                </div>

                {selectedDetailItem.disetujui_oleh && (
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Disetujui Oleh</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{selectedDetailItem.disetujui_oleh}</div>
                  </div>
                )}
              </div>

              {/* TIM APPROVAL ACTION BUTTONS */}
              {isTimPerizinan && selectedDetailItem.status === "Menunggu" && (
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const item = selectedDetailItem;
                      setSelectedDetailItem(null);
                      handleUpdateStatus(item, "Disetujui");
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer text-center"
                  >
                    Setujui Izin
                  </button>

                  <button
                    onClick={() => {
                      const item = selectedDetailItem;
                      setSelectedDetailItem(null);
                      handleUpdateStatus(item, "Ditolak");
                    }}
                    className="flex-1 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold rounded-xl text-xs transition-all cursor-pointer text-center"
                  >
                    Tolak Izin
                  </button>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
