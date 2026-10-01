import React, { useState, useMemo, useEffect } from "react";
import { 
  Eye, 
  Edit3, 
  Plus, 
  Search, 
  Filter, 
  SlidersHorizontal, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Check, 
  X, 
  Home, 
  Users, 
  UserCheck, 
  Building2, 
  User, 
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { SantriData, supabase } from "../supabaseClient";
import { showSuccess, showError, showWarning, showDeleteConfirm } from "../utils/sweetalert";

interface PlottingKamarPanelProps {
  students: SantriData[];
  rooms: string[];
  setRooms: (rooms: string[]) => void;
  metadataMap?: Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: any }>;
  onAssignMetadata: (nik: string, key: "kamar" | "kelas_sekolah" | "kelas_pengajian", value: string) => void;
  currentUser?: any;
}

export default function PlottingKamarPanel({
  students,
  rooms,
  setRooms,
  onAssignMetadata,
  currentUser
}: PlottingKamarPanelProps) {
  // Navigation & View States: "list" | "detail" | "form"
  const [currentView, setCurrentView] = useState<"list" | "detail" | "form">("list");
  const [activeMainTab, setActiveMainTab] = useState<"daftar" | "unassigned">("daftar");
  const [activeDetailTab, setActiveDetailTab] = useState<"aktif" | "nonaktif">("aktif");

  // Selected Room for Detail / Edit
  const [selectedRoomName, setSelectedRoomName] = useState<string>("");
  const [isEditingForm, setIsEditingForm] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>("");
  const [formGender, setFormGender] = useState<"Campuran" | "Laki-laki" | "Perempuan">("Laki-laki");
  const [formKetua, setFormKetua] = useState<string>("");

  // Wali Kamar / Guru List for Dropdown
  const [waliKamarList, setWaliKamarList] = useState<Array<{ id: string; nama: string; kamar?: string }>>([]);
  const [roomGenderMap, setRoomGenderMap] = useState<Record<string, "Campuran" | "Laki-laki" | "Perempuan">>({});
  const [roomKetuaMap, setRoomKetuaMap] = useState<Record<string, string>>({});
  const [roomAuditMap, setRoomAuditMap] = useState<Record<string, { createdAt: string; createdBy: string; updatedAt: string; updatedBy: string }>>({});

  // Search & Pagination States
  const [searchDaftar, setSearchDaftar] = useState<string>("");
  const [searchUnassigned, setSearchUnassigned] = useState<string>("");
  const [searchDetailMembers, setSearchDetailMembers] = useState<string>("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal State for Quick Plotting / Mutasi
  const [mutasiStudent, setMutasiStudent] = useState<SantriData | null>(null);
  const [selectedMutasiRoom, setSelectedMutasiRoom] = useState<string>("");

  // Load Wali Kamar & Room Details from Supabase & LocalStorage
  useEffect(() => {
    loadRoomDetails();
  }, [rooms]);

  const loadRoomDetails = async () => {
    try {
      // 1. Fetch Wali Kamar from Supabase
      const { data: guruData } = await supabase
        .from("guru")
        .select("id, nama, nama_lengkap");

      const { data: waliData } = await supabase
        .from("plotting_guru_pondok")
        .select("id, guru_nama, nama, kamar, guru_id");

      const waliOptions: Array<{ id: string; nama: string; kamar?: string }> = [];
      const ketuaMapping: Record<string, string> = {};

      if (waliData) {
        waliData.forEach((w: any) => {
          const name = w.guru_nama || w.nama;
          if (name) {
            waliOptions.push({ id: String(w.id || w.guru_id), nama: name, kamar: w.kamar });
            if (w.kamar) {
              ketuaMapping[w.kamar] = name;
            }
          }
        });
      }

      if (guruData) {
        guruData.forEach((g: any) => {
          const name = g.nama_lengkap || g.nama;
          if (name && !waliOptions.some(o => o.nama === name)) {
            waliOptions.push({ id: String(g.id), nama: name });
          }
        });
      }

      setWaliKamarList(waliOptions);

      // Load Room Extra Metadata (Gender, Audit)
      const savedGender = localStorage.getItem("plotting_kamar_gender_map");
      const parsedGender = savedGender ? JSON.parse(savedGender) : {};

      const savedKetua = localStorage.getItem("plotting_kamar_ketua_map");
      const parsedKetua = savedKetua ? JSON.parse(savedKetua) : {};

      const savedAudit = localStorage.getItem("plotting_kamar_audit_map");
      const parsedAudit = savedAudit ? JSON.parse(savedAudit) : {};

      // Merge Supabase ketua mapping
      const finalKetua = { ...parsedKetua, ...ketuaMapping };

      // Auto-assign default gender based on room name keywords
      const finalGender: Record<string, "Campuran" | "Laki-laki" | "Perempuan"> = { ...parsedGender };
      rooms.forEach((r) => {
        if (!finalGender[r]) {
          const lower = r.toLowerCase();
          if (lower.includes("putri") || lower.includes("siswi") || lower.includes("perempuan") || lower.includes("akhas")) {
            finalGender[r] = "Perempuan";
          } else if (lower.includes("putra") || lower.includes("siswa") || lower.includes("laki") || lower.includes("ikhwan")) {
            finalGender[r] = "Laki-laki";
          } else {
            finalGender[r] = "Laki-laki"; // Default fallback
          }
        }
      });

      setRoomGenderMap(finalGender);
      setRoomKetuaMap(finalKetua);
      setRoomAuditMap(parsedAudit);

    } catch (e) {
      console.warn("Notice loading room details:", e);
    }
  };

  // Student room counter
  const roomStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rooms.forEach((r) => (counts[r] = 0));
    students.forEach((s) => {
      const room = s.kamar?.trim();
      if (room) {
        const match = rooms.find((r) => r.trim().toLowerCase() === room.toLowerCase());
        if (match) {
          counts[match]++;
        }
      }
    });
    return counts;
  }, [rooms, students]);

  // Filtered Rooms List
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const name = r.toLowerCase();
      const ketua = (roomKetuaMap[r] || "").toLowerCase();
      const query = searchDaftar.toLowerCase().trim();
      return name.includes(query) || ketua.includes(query);
    });
  }, [rooms, searchDaftar, roomKetuaMap]);

  // Unassigned Students Queue (Belum Terdaftar Kamar)
  const unassignedStudents = useMemo(() => {
    return students.filter((s) => {
      const noRoom = !s.kamar || s.kamar.trim() === "" || s.kamar === "-";
      if (!noRoom) return false;
      if (!searchUnassigned.trim()) return true;
      const q = searchUnassigned.toLowerCase();
      return (
        s.nama_lengkap.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q)) ||
        (s.id && String(s.id).toLowerCase().includes(q))
      );
    });
  }, [students, searchUnassigned]);

  // Members of currently selected room in detail view
  const currentRoomMembers = useMemo(() => {
    if (!selectedRoomName) return [];
    return students.filter((s) => (s.kamar || "").trim().toLowerCase() === selectedRoomName.trim().toLowerCase());
  }, [selectedRoomName, students]);

  const filteredRoomMembers = useMemo(() => {
    return currentRoomMembers.filter((s) => {
      if (!searchDetailMembers.trim()) return true;
      const q = searchDetailMembers.toLowerCase();
      return (
        s.nama_lengkap.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q))
      );
    });
  }, [currentRoomMembers, searchDetailMembers]);

  // Handlers for Views & Actions
  const handleOpenCreateForm = () => {
    setSelectedRoomName("");
    setIsEditingForm(false);
    setFormName("");
    setFormGender("Laki-laki");
    setFormKetua("");
    setCurrentView("form");
  };

  const handleOpenEditForm = (roomName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedRoomName(roomName);
    setIsEditingForm(true);
    setFormName(roomName);
    setFormGender(roomGenderMap[roomName] || "Laki-laki");
    setFormKetua(roomKetuaMap[roomName] || "");
    setCurrentView("form");
  };

  const handleOpenDetail = (roomName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedRoomName(roomName);
    setActiveDetailTab("aktif");
    setSearchDetailMembers("");
    setCurrentView("detail");
  };

  const handleDeleteRoom = async (roomName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const confirmed = await showDeleteConfirm(
      `Kamar "${roomName}"`,
      `Apakah Anda yakin ingin menghapus kamar "${roomName}"? Semua santri di kamar ini akan dikosongkan penempatannya.`
    );
    if (!confirmed) return;

    const updatedRooms = rooms.filter((r) => r.trim().toLowerCase() !== roomName.trim().toLowerCase());
    setRooms(updatedRooms);
    localStorage.setItem("manajemen_rooms", JSON.stringify(updatedRooms));

    // Clear mapping for students
    students.forEach((s) => {
      if ((s.kamar || "").trim().toLowerCase() === roomName.trim().toLowerCase()) {
        onAssignMetadata(String(s.id || ""), "kamar", "");
      }
    });

    // Delete from Supabase
    try {
      await supabase.from("kamar").delete().ilike("kamar", roomName);
      await supabase.from("plotting").delete().eq("jenis", "kamar").ilike("nama", roomName);
    } catch (err) {
      console.warn("Notice delete room remote:", err);
    }

    showSuccess("Berhasil Dihapus", `Kamar "${roomName}" telah dihapus.`);
    if (currentView === "detail" && selectedRoomName === roomName) {
      setCurrentView("list");
    }
  };

  const handleSaveForm = async (keepOpen = false) => {
    if (!formName.trim()) {
      showWarning("Nama Kamar Wajib Diisi", "Silakan masukkan nama kamar.");
      return;
    }

    const trimmedName = formName.trim();
    const adminName = currentUser?.nama_lengkap || currentUser?.nama || currentUser?.username || "Administrator";
    const nowIso = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });

    if (!isEditingForm) {
      // Check duplicate
      if (rooms.some((r) => r.toLowerCase() === trimmedName.toLowerCase())) {
        showWarning("Nama Kamar Sudah Ada", `Kamar dengan nama "${trimmedName}" sudah terdaftar.`);
        return;
      }

      // Add new
      const updatedRooms = [...rooms, trimmedName];
      setRooms(updatedRooms);
      localStorage.setItem("manajemen_rooms", JSON.stringify(updatedRooms));

      // Save metadata
      const newGenderMap = { ...roomGenderMap, [trimmedName]: formGender };
      const newKetuaMap = { ...roomKetuaMap, [trimmedName]: formKetua };
      const newAuditMap = {
        ...roomAuditMap,
        [trimmedName]: {
          createdAt: nowIso,
          createdBy: adminName,
          updatedAt: nowIso,
          updatedBy: adminName
        }
      };

      setRoomGenderMap(newGenderMap);
      setRoomKetuaMap(newKetuaMap);
      setRoomAuditMap(newAuditMap);

      localStorage.setItem("plotting_kamar_gender_map", JSON.stringify(newGenderMap));
      localStorage.setItem("plotting_kamar_ketua_map", JSON.stringify(newKetuaMap));
      localStorage.setItem("plotting_kamar_audit_map", JSON.stringify(newAuditMap));

      // Sync Supabase
      try {
        await supabase.from("plotting").insert([{ jenis: "kamar", nama: trimmedName }]);
      } catch (err) {
        console.warn("Notice insert remote:", err);
      }

      showSuccess("Kamar Berhasil Dibuat", `Kamar "${trimmedName}" berhasil ditambahkan.`);

      if (keepOpen) {
        setFormName("");
        setFormGender("Laki-laki");
        setFormKetua("");
      } else {
        setCurrentView("list");
      }
    } else {
      // Edit existing
      const oldName = selectedRoomName;
      let updatedRooms = [...rooms];

      if (oldName !== trimmedName) {
        updatedRooms = rooms.map((r) => (r === oldName ? trimmedName : r));
        setRooms(updatedRooms);
        localStorage.setItem("manajemen_rooms", JSON.stringify(updatedRooms));

        // Update students room
        students.forEach((s) => {
          if ((s.kamar || "").trim().toLowerCase() === oldName.trim().toLowerCase()) {
            onAssignMetadata(String(s.id || ""), "kamar", trimmedName);
          }
        });
      }

      const newGenderMap = { ...roomGenderMap, [trimmedName]: formGender };
      const newKetuaMap = { ...roomKetuaMap, [trimmedName]: formKetua };
      const oldAudit = roomAuditMap[oldName] || { createdAt: nowIso, createdBy: adminName, updatedAt: nowIso, updatedBy: adminName };
      const newAuditMap = {
        ...roomAuditMap,
        [trimmedName]: {
          ...oldAudit,
          updatedAt: nowIso,
          updatedBy: adminName
        }
      };

      setRoomGenderMap(newGenderMap);
      setRoomKetuaMap(newKetuaMap);
      setRoomAuditMap(newAuditMap);

      localStorage.setItem("plotting_kamar_gender_map", JSON.stringify(newGenderMap));
      localStorage.setItem("plotting_kamar_ketua_map", JSON.stringify(newKetuaMap));
      localStorage.setItem("plotting_kamar_audit_map", JSON.stringify(newAuditMap));

      showSuccess("Perubahan Disimpan", `Data kamar "${trimmedName}" berhasil diperbarui.`);
      setCurrentView("list");
    }
  };

  const handleExecuteMutasi = () => {
    if (!mutasiStudent) return;
    if (!selectedMutasiRoom) {
      showWarning("Pilih Kamar Tujuan", "Silakan pilih kamar asrama tujuan terlebih dahulu.");
      return;
    }

    onAssignMetadata(String(mutasiStudent.id || ""), "kamar", selectedMutasiRoom);
    showSuccess("Mutasi Berhasil", `Santri ${mutasiStudent.nama_lengkap} berhasil diplot ke ${selectedMutasiRoom}.`);
    setMutasiStudent(null);
    setSelectedMutasiRoom("");
  };

  const handleRemoveMemberFromRoom = (student: SantriData) => {
    onAssignMetadata(String(student.id || ""), "kamar", "");
    showSuccess("Berhasil Dikeluarkan", `Santri ${student.nama_lengkap} berhasil dikeluarkan dari kamar ${selectedRoomName}.`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 font-sans text-slate-800 space-y-6">
      
      {/* ========================================================================= */}
      {/* 1. HEADER & BREADCRUMB                                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {/* Small Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Plotting Pondok</span>
            <span>&gt;</span>
            <span className="text-slate-600 font-semibold">Kamar</span>
            <span>&gt;</span>
            <span className="text-blue-600 font-bold capitalize">
              {currentView === "form" 
                ? (isEditingForm ? "Edit" : "Buat") 
                : currentView === "detail" 
                ? "Lihat" 
                : activeMainTab === "daftar" ? "Daftar" : "Belum Terdaftar"}
            </span>
          </nav>

          {/* Large Bold Page Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {currentView === "form" 
              ? (isEditingForm ? `Edit Kamar - ${selectedRoomName}` : "Buat Kamar") 
              : currentView === "detail" 
              ? `Lihat ${selectedRoomName}` 
              : "Kamar Asrama"}
          </h1>
        </div>

        {/* Top Right Action Button */}
        <div>
          {currentView === "list" ? (
            <button
              onClick={handleOpenCreateForm}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Kamar</span>
            </button>
          ) : currentView === "detail" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView("list")}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                onClick={() => handleOpenEditForm(selectedRoomName)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Ubah</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentView("list")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Daftar</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PILLED TAB SWITCHER (Floating Center Control)                          */}
      {/* ========================================================================= */}
      {currentView === "list" && (
        <div className="flex justify-center my-2">
          <div className="bg-slate-200/80 p-1.5 rounded-2xl inline-flex shadow-inner border border-slate-200 gap-1">
            <button
              onClick={() => setActiveMainTab("daftar")}
              className={`px-6 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                activeMainTab === "daftar"
                  ? "bg-white text-blue-600 font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 font-medium"
              }`}
            >
              Daftar Kamar
            </button>
            <button
              onClick={() => setActiveMainTab("unassigned")}
              className={`px-6 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                activeMainTab === "unassigned"
                  ? "bg-white text-blue-600 font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 font-medium"
              }`}
            >
              Belum Terdaftar Kamar
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW TAB 1: DAFTAR KAMAR (Data Table Style)                           */}
      {/* ========================================================================= */}
      {currentView === "list" && activeMainTab === "daftar" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Toolbar Atas Tabel */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-end gap-2.5">
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kamar atau ketua..."
                value={searchDaftar}
                onChange={(e) => setSearchDaftar(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
            
            <button className="p-2 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer relative">
              <Filter className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">0</span>
            </button>

            <button className="p-2 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Tabel Data Bersih */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 w-28 text-center">Aksi</th>
                  <th className="py-3.5 px-4">Nama</th>
                  <th className="py-3.5 px-4">Jenis Kelamin</th>
                  <th className="py-3.5 px-4 text-center">Jumlah Santri</th>
                  <th className="py-3.5 px-4">Ketua / Wali Kamar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {searchDaftar ? "Tidak ada kamar yang cocok dengan pencarian." : "Belum ada kamar asrama yang terdaftar."}
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((roomName) => {
                    const gender = roomGenderMap[roomName] || "Laki-laki";
                    const count = roomStudentCounts[roomName] || 0;
                    const ketua = roomKetuaMap[roomName] || "Belum Ditentukan";

                    return (
                      <tr key={roomName} className="hover:bg-slate-50/80 transition-colors">
                        {/* Aksi */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => handleOpenDetail(roomName, e)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
                              title="Lihat Detail Kamar"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleOpenEditForm(roomName, e)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer"
                              title="Edit Kamar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteRoom(roomName, e)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                              title="Hapus Kamar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                        {/* Nama Kamar */}
                        <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                          {roomName}
                        </td>

                        {/* Jenis Kelamin Badge */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            gender === "Perempuan" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : gender === "Laki-laki" 
                              ? "bg-blue-50 text-blue-700 border-blue-200" 
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}>
                            {gender}
                          </span>
                        </td>

                        {/* Jumlah Santri */}
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-800 font-mono text-xs">
                            {count}
                          </span>
                        </td>

                        {/* Ketua / Wali Kamar */}
                        <td className="py-3 px-4 font-semibold text-slate-600">
                          {ketua}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Tabel (Pagination) */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div>
              Menampilkan <span className="font-bold text-slate-800">{filteredRooms.length}</span> hasil
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>per halaman</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button disabled className="p-1 text-slate-300 cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-bold rounded">1</span>
                <button disabled className="p-1 text-slate-300 cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VIEW TAB 2: BELUM TERDAFTAR KAMAR (Santri Unassigned Queue)            */}
      {/* ========================================================================= */}
      {currentView === "list" && activeMainTab === "unassigned" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Toolbar Atas Tabel */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-semibold">
              Total Santri Belum Ada Kamar: <strong className="text-blue-600 font-bold">{unassignedStudents.length}</strong> Santri
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama santri atau NIS..."
                  value={searchUnassigned}
                  onChange={(e) => setSearchUnassigned(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <button className="p-2 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabel Santri Antrean */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 w-36 text-center">Aksi</th>
                  <th className="py-3.5 px-4">Nama</th>
                  <th className="py-3.5 px-4 text-center w-24">L / P</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {unassignedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-emerald-600 font-bold">
                      🎉 Seluruh santri sudah terdaftar dan mendapatkan kamar asrama.
                    </td>
                  </tr>
                ) : (
                  unassignedStudents.map((s) => (
                    <tr key={s.id || s.nisn} className="hover:bg-slate-50/80 transition-colors">
                      {/* Aksi Mutasi */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setMutasiStudent(s);
                            setSelectedMutasiRoom(rooms[0] || "");
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg border border-blue-200 text-xs transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Mutasi</span>
                        </button>
                      </td>

                      {/* Nama & NIS */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {s.nama_lengkap}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {s.nisn || s.id || "Tanpa NIS"}
                        </div>
                      </td>

                      {/* Gender Badge */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          s.jenis_kelamin === "P"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}>
                          {s.jenis_kelamin === "P" ? "P" : "L"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Tabel */}
          <div className="p-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
            Menampilkan <span className="font-bold text-slate-800">{unassignedStudents.length}</span> santri dalam antrean.
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HALAMAN DETAIL KAMAR ("Lihat Detail Kamar")                            */}
      {/* ========================================================================= */}
      {currentView === "detail" && (
        <div className="space-y-6">

          {/* Tab Switcher Tengah: Santri Aktif vs Santri Nonaktif */}

          {/* Tab Switcher Tengah: Santri Aktif vs Santri Nonaktif */}
          <div className="flex justify-center my-2">
            <div className="bg-slate-200/80 p-1 rounded-2xl inline-flex border border-slate-200 gap-1">
              <button
                onClick={() => setActiveDetailTab("aktif")}
                className={`px-5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                  activeDetailTab === "aktif"
                    ? "bg-white text-blue-600 font-bold shadow-xs"
                    : "text-slate-600 font-medium hover:text-slate-900"
                }`}
              >
                Santri Aktif
              </button>
              <button
                onClick={() => setActiveDetailTab("nonaktif")}
                className={`px-5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                  activeDetailTab === "nonaktif"
                    ? "bg-white text-blue-600 font-bold shadow-xs"
                    : "text-slate-600 font-medium hover:text-slate-900"
                }`}
              >
                Santri Nonaktif
              </button>
            </div>
          </div>

          {/* Tabel Anggota Kamar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            {/* Toolbar Search Dalam Kamar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700">
                Anggota Kamar: <span className="text-blue-600">{filteredRoomMembers.length}</span> Santri
              </div>

              <div className="relative w-full max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari anggota santri..."
                  value={searchDetailMembers}
                  onChange={(e) => setSearchDetailMembers(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Members Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Nama ∨</th>
                    <th className="py-3.5 px-4">Tanggal Masuk / NIS ∨</th>
                    <th className="py-3.5 px-4 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {filteredRoomMembers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-400">
                        {searchDetailMembers ? "Tidak ada santri yang sesuai kata kunci." : "Belum ada santri yang dimasukkan ke dalam kamar ini."}
                      </td>
                    </tr>
                  ) : (
                    filteredRoomMembers.map((s) => (
                      <tr key={s.id || s.nisn} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                          {s.nama_lengkap}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {s.created_at ? s.created_at.slice(0, 10) : (s.nisn || s.id || "—")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleRemoveMemberFromRoom(s)}
                            className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                            title="Keluarkan dari kamar"
                          >
                            Keluarkan
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. HALAMAN FORMULIR ("Buat / Edit Kamar")                                 */}
      {/* ========================================================================= */}
      {currentView === "form" && (
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            
            {/* Field Input "Nama Kamar" */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Nama <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kamar Al-Farabi / Reguler"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {/* Field Input "Jenis Kelamin" Segmented Control */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Jenis Kelamin
                </label>
                <div className="p-1 bg-slate-100 border border-slate-200 rounded-xl inline-flex w-full">
                  <button
                    type="button"
                    onClick={() => setFormGender("Campuran")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formGender === "Campuran" 
                        ? "bg-white text-blue-600 shadow-xs" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Campuran
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormGender("Laki-laki")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formGender === "Laki-laki" 
                        ? "bg-white text-blue-600 shadow-xs" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Laki-laki
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormGender("Perempuan")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formGender === "Perempuan" 
                        ? "bg-white text-blue-600 shadow-xs" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Perempuan
                  </button>
                </div>
              </div>

            </div>

            {/* Field Input "Ketua / Wali Kamar" */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Ketua / Wali Kamar
              </label>
              <select
                value={formKetua}
                onChange={(e) => setFormKetua(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">-- Belum Ditentukan --</option>
                {waliKamarList.map((w) => (
                  <option key={w.id + w.nama} value={w.nama}>
                    {w.nama} {w.kamar ? `(Wali Kamar ${w.kamar})` : ""}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Tombol Aksi di Kiri Bawah */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSaveForm(false)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer"
            >
              {isEditingForm ? "Simpan Perubahan" : "Buat"}
            </button>

            {!isEditingForm && (
              <button
                type="button"
                onClick={() => handleSaveForm(true)}
                className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                Buat &amp; buat lainnya
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentView("list")}
              className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL MUTASI SANTRI (POPUP SELEKSI KAMAR)                              */}
      {/* ========================================================================= */}
      {mutasiStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span>Plotting / Mutasi Kamar Santri</span>
              </h3>
              <button
                onClick={() => setMutasiStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
                <span className="block font-bold text-blue-900">{mutasiStudent.nama_lengkap}</span>
                <span className="text-slate-500 font-mono">NIS: {mutasiStudent.nisn || mutasiStudent.id || "-"}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Kamar Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedMutasiRoom}
                  onChange={(e) => setSelectedMutasiRoom(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="" disabled>-- Pilih Kamar Asrama --</option>
                  {rooms.map((r) => (
                    <option key={r} value={r}>
                      {r} ({roomGenderMap[r] || "Laki-laki"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMutasiStudent(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteMutasi}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Simpan Penempatan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
