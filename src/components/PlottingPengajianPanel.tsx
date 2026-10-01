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
  BookOpen, 
  Users, 
  UserCheck, 
  User, 
  ArrowLeft
} from "lucide-react";
import { SantriData, supabase } from "../supabaseClient";
import { showSuccess, showError, showWarning, showDeleteConfirm } from "../utils/sweetalert";

interface PlottingPengajianPanelProps {
  students: SantriData[];
  recitationClasses: string[];
  setRecitationClasses: (classes: string[]) => void;
  metadataMap?: Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: any }>;
  onAssignMetadata: (nik: string, key: "kamar" | "kelas_sekolah" | "kelas_pengajian", value: string) => void;
  currentUser?: any;
}

export default function PlottingPengajianPanel({
  students,
  recitationClasses,
  setRecitationClasses,
  onAssignMetadata,
  currentUser
}: PlottingPengajianPanelProps) {
  // Navigation & View States: "list" | "detail" | "form"
  const [currentView, setCurrentView] = useState<"list" | "detail" | "form">("list");
  const [activeMainTab, setActiveMainTab] = useState<"daftar" | "unassigned">("daftar");
  const [activeDetailTab, setActiveDetailTab] = useState<"aktif" | "nonaktif">("aktif");

  // Selected Class for Detail / Edit
  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [isEditingForm, setIsEditingForm] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>("");
  const [formKategori, setFormKategori] = useState<string>("Reguler");
  const [formKetuaLaki, setFormKetuaLaki] = useState<string>("");
  const [formKetuaPerempuan, setFormKetuaPerempuan] = useState<string>("");

  // Teacher / Ustaz / Ustazah options
  const [ustazList, setUstazList] = useState<Array<{ id: string; nama: string; gender?: string }>>([]);
  const [classKategoriMap, setClassKategoriMap] = useState<Record<string, string>>({});
  const [classKetuaLakiMap, setClassKetuaLakiMap] = useState<Record<string, string>>({});
  const [classKetuaPerempuanMap, setClassKetuaPerempuanMap] = useState<Record<string, string>>({});

  // Search & Pagination States
  const [searchDaftar, setSearchDaftar] = useState<string>("");
  const [searchUnassigned, setSearchUnassigned] = useState<string>("");
  const [searchDetailMembers, setSearchDetailMembers] = useState<string>("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Modal State for Quick Plotting / Mutasi
  const [mutasiStudent, setMutasiStudent] = useState<SantriData | null>(null);
  const [selectedMutasiClass, setSelectedMutasiClass] = useState<string>("");

  // Load Metadata & Teachers from Supabase / LocalStorage
  useEffect(() => {
    loadClassDetails();
  }, [recitationClasses]);

  const loadClassDetails = async () => {
    try {
      // 1. Fetch Ustaz & Ustazah from Supabase
      const { data: guruData } = await supabase
        .from("guru")
        .select("id, nama, nama_lengkap, jenis_kelamin");

      const { data: waliData } = await supabase
        .from("plotting_guru_pondok")
        .select("id, guru_nama, nama, kelas_pengajian, guru_id");

      const ustazOptions: Array<{ id: string; nama: string; gender?: string }> = [];

      if (guruData) {
        guruData.forEach((g: any) => {
          const name = g.nama_lengkap || g.nama;
          if (name) {
            ustazOptions.push({ id: String(g.id), nama: name, gender: g.jenis_kelamin });
          }
        });
      }

      if (waliData) {
        waliData.forEach((w: any) => {
          const name = w.guru_nama || w.nama;
          if (name && !ustazOptions.some((o) => o.nama === name)) {
            ustazOptions.push({ id: String(w.id || w.guru_id), nama: name });
          }
        });
      }

      setUstazList(ustazOptions);

      // Load Saved Extra Metadata
      const savedKategori = localStorage.getItem("plotting_pengajian_kategori_map");
      const parsedKategori = savedKategori ? JSON.parse(savedKategori) : {};

      const savedKetuaLaki = localStorage.getItem("plotting_pengajian_ketua_laki_map");
      const parsedKetuaLaki = savedKetuaLaki ? JSON.parse(savedKetuaLaki) : {};

      const savedKetuaPerempuan = localStorage.getItem("plotting_pengajian_ketua_perempuan_map");
      const parsedKetuaPerempuan = savedKetuaPerempuan ? JSON.parse(savedKetuaPerempuan) : {};

      // Defaults for default recitation classes
      const finalKategori: Record<string, string> = { ...parsedKategori };
      recitationClasses.forEach((c) => {
        if (!finalKategori[c]) {
          finalKategori[c] = "Reguler";
        }
      });

      setClassKategoriMap(finalKategori);
      setClassKetuaLakiMap(parsedKetuaLaki);
      setClassKetuaPerempuanMap(parsedKetuaPerempuan);
    } catch (e) {
      console.warn("Notice loading recitation class details:", e);
    }
  };

  // Student counts per recitation class split by gender
  const classStudentCounts = useMemo(() => {
    const counts: Record<string, { laki: number; perempuan: number }> = {};
    recitationClasses.forEach((c) => (counts[c] = { laki: 0, perempuan: 0 }));

    students.forEach((s) => {
      const cls = s.kelas_pengajian?.trim();
      if (cls && counts[cls] !== undefined) {
        if (s.jenis_kelamin === "P") {
          counts[cls].perempuan++;
        } else {
          counts[cls].laki++;
        }
      }
    });

    return counts;
  }, [recitationClasses, students]);

  // Filtered Recitation Classes List
  const filteredClasses = useMemo(() => {
    return recitationClasses.filter((c) => {
      const name = c.toLowerCase();
      const kat = (classKategoriMap[c] || "reguler").toLowerCase();
      const ketuaLaki = (classKetuaLakiMap[c] || "").toLowerCase();
      const ketuaPerempuan = (classKetuaPerempuanMap[c] || "").toLowerCase();
      const query = searchDaftar.toLowerCase().trim();
      return (
        name.includes(query) ||
        kat.includes(query) ||
        ketuaLaki.includes(query) ||
        ketuaPerempuan.includes(query)
      );
    });
  }, [recitationClasses, searchDaftar, classKategoriMap, classKetuaLakiMap, classKetuaPerempuanMap]);

  // Unassigned Students Queue (Belum Terdaftar Kelas)
  const unassignedStudents = useMemo(() => {
    return students.filter((s) => {
      const noClass = !s.kelas_pengajian || s.kelas_pengajian.trim() === "" || s.kelas_pengajian === "-";
      if (!noClass) return false;
      if (!searchUnassigned.trim()) return true;
      const q = searchUnassigned.toLowerCase();
      return (
        s.nama_lengkap.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q)) ||
        (s.id && String(s.id).toLowerCase().includes(q))
      );
    });
  }, [students, searchUnassigned]);

  // Members of currently selected class in detail view
  const currentClassMembers = useMemo(() => {
    if (!selectedClassName) return [];
    return students.filter(
      (s) => (s.kelas_pengajian || "").trim().toLowerCase() === selectedClassName.trim().toLowerCase()
    );
  }, [selectedClassName, students]);

  const filteredClassMembers = useMemo(() => {
    return currentClassMembers.filter((s) => {
      if (!searchDetailMembers.trim()) return true;
      const q = searchDetailMembers.toLowerCase();
      return (
        s.nama_lengkap.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q))
      );
    });
  }, [currentClassMembers, searchDetailMembers]);

  // Handlers for Views & Actions
  const handleOpenCreateForm = () => {
    setSelectedClassName("");
    setIsEditingForm(false);
    setFormName("");
    setFormKategori("Reguler");
    setFormKetuaLaki("");
    setFormKetuaPerempuan("");
    setCurrentView("form");
  };

  const handleOpenEditForm = (className: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedClassName(className);
    setIsEditingForm(true);
    setFormName(className);
    setFormKategori(classKategoriMap[className] || "Reguler");
    setFormKetuaLaki(classKetuaLakiMap[className] || "");
    setFormKetuaPerempuan(classKetuaPerempuanMap[className] || "");
    setCurrentView("form");
  };

  const handleOpenDetail = (className: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedClassName(className);
    setActiveDetailTab("aktif");
    setSearchDetailMembers("");
    setCurrentView("detail");
  };

  const handleDeleteClass = async (className: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const confirmed = await showDeleteConfirm(
      `Kelas "${className}"`,
      `Apakah Anda yakin ingin menghapus kelas pengajian "${className}"? Semua santri di kelas ini akan dikosongkan penempatannya.`
    );
    if (!confirmed) return;

    const updatedClasses = recitationClasses.filter(
      (c) => c.trim().toLowerCase() !== className.trim().toLowerCase()
    );
    setRecitationClasses(updatedClasses);
    localStorage.setItem("manajemen_recitation_classes", JSON.stringify(updatedClasses));

    // Clear mapping for students
    students.forEach((s) => {
      if ((s.kelas_pengajian || "").trim().toLowerCase() === className.trim().toLowerCase()) {
        onAssignMetadata(String(s.id || ""), "kelas_pengajian", "");
      }
    });

    // Delete from Supabase
    try {
      await supabase.from("kelas_pengajian").delete().ilike("nama_kelas", className);
      await supabase.from("plotting").delete().eq("jenis", "pengajian").ilike("nama", className);
    } catch (err) {
      console.warn("Notice delete recitation class remote:", err);
    }

    showSuccess("Berhasil Dihapus", `Kelas "${className}" telah dihapus.`);
    if (currentView === "detail" && selectedClassName === className) {
      setCurrentView("list");
    }
  };

  const handleSaveForm = async (keepOpen = false) => {
    if (!formName.trim()) {
      showWarning("Nama Kelas Wajib Diisi", "Silakan masukkan nama kelas pengajian.");
      return;
    }

    const trimmedName = formName.trim();

    if (!isEditingForm) {
      // Check duplicate
      if (recitationClasses.some((c) => c.toLowerCase() === trimmedName.toLowerCase())) {
        showWarning("Nama Kelas Sudah Ada", `Kelas dengan nama "${trimmedName}" sudah terdaftar.`);
        return;
      }

      // Add new
      const updatedClasses = [...recitationClasses, trimmedName];
      setRecitationClasses(updatedClasses);
      localStorage.setItem("manajemen_recitation_classes", JSON.stringify(updatedClasses));

      // Save extra metadata
      const newKategoriMap = { ...classKategoriMap, [trimmedName]: formKategori || "Reguler" };
      const newKetuaLakiMap = { ...classKetuaLakiMap, [trimmedName]: formKetuaLaki };
      const newKetuaPerempuanMap = { ...classKetuaPerempuanMap, [trimmedName]: formKetuaPerempuan };

      setClassKategoriMap(newKategoriMap);
      setClassKetuaLakiMap(newKetuaLakiMap);
      setClassKetuaPerempuanMap(newKetuaPerempuanMap);

      localStorage.setItem("plotting_pengajian_kategori_map", JSON.stringify(newKategoriMap));
      localStorage.setItem("plotting_pengajian_ketua_laki_map", JSON.stringify(newKetuaLakiMap));
      localStorage.setItem("plotting_pengajian_ketua_perempuan_map", JSON.stringify(newKetuaPerempuanMap));

      // Sync Supabase
      try {
        await supabase.from("plotting").insert([{ jenis: "pengajian", nama: trimmedName }]);
      } catch (err) {
        console.warn("Notice insert remote:", err);
      }

      showSuccess("Kelas Berhasil Dibuat", `Kelas "${trimmedName}" berhasil ditambahkan.`);

      if (keepOpen) {
        setFormName("");
        setFormKategori("Reguler");
        setFormKetuaLaki("");
        setFormKetuaPerempuan("");
      } else {
        setCurrentView("list");
      }
    } else {
      // Edit existing
      const oldName = selectedClassName;
      let updatedClasses = [...recitationClasses];

      if (oldName !== trimmedName) {
        updatedClasses = recitationClasses.map((c) => (c === oldName ? trimmedName : c));
        setRecitationClasses(updatedClasses);
        localStorage.setItem("manajemen_recitation_classes", JSON.stringify(updatedClasses));

        // Update students class
        students.forEach((s) => {
          if ((s.kelas_pengajian || "").trim().toLowerCase() === oldName.trim().toLowerCase()) {
            onAssignMetadata(String(s.id || ""), "kelas_pengajian", trimmedName);
          }
        });
      }

      const newKategoriMap = { ...classKategoriMap, [trimmedName]: formKategori || "Reguler" };
      const newKetuaLakiMap = { ...classKetuaLakiMap, [trimmedName]: formKetuaLaki };
      const newKetuaPerempuanMap = { ...classKetuaPerempuanMap, [trimmedName]: formKetuaPerempuan };

      setClassKategoriMap(newKategoriMap);
      setClassKetuaLakiMap(newKetuaLakiMap);
      setClassKetuaPerempuanMap(newKetuaPerempuanMap);

      localStorage.setItem("plotting_pengajian_kategori_map", JSON.stringify(newKategoriMap));
      localStorage.setItem("plotting_pengajian_ketua_laki_map", JSON.stringify(newKetuaLakiMap));
      localStorage.setItem("plotting_pengajian_ketua_perempuan_map", JSON.stringify(newKetuaPerempuanMap));

      showSuccess("Perubahan Disimpan", `Data kelas "${trimmedName}" berhasil diperbarui.`);
      setCurrentView("list");
    }
  };

  const handleExecuteMutasi = () => {
    if (!mutasiStudent) return;
    if (!selectedMutasiClass) {
      showWarning("Pilih Kelas Tujuan", "Silakan pilih kelas pengajian tujuan terlebih dahulu.");
      return;
    }

    onAssignMetadata(String(mutasiStudent.id || ""), "kelas_pengajian", selectedMutasiClass);
    showSuccess(
      "Plotting Berhasil",
      `Santri ${mutasiStudent.nama_lengkap} berhasil diplot ke ${selectedMutasiClass}.`
    );
    setMutasiStudent(null);
    setSelectedMutasiClass("");
  };

  const handleRemoveMemberFromClass = (student: SantriData) => {
    onAssignMetadata(String(student.id || ""), "kelas_pengajian", "");
    showSuccess(
      "Berhasil Dikeluarkan",
      `Santri ${student.nama_lengkap} berhasil dikeluarkan dari kelas ${selectedClassName}.`
    );
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
            <span>Kelas</span>
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
              ? (isEditingForm ? `Edit Kelas - ${selectedClassName}` : "Buat Kelas") 
              : currentView === "detail" 
              ? `Lihat ${selectedClassName}` 
              : "Kelas"}
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
              <span>Buat Kelas</span>
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
                onClick={() => handleOpenEditForm(selectedClassName)}
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
              Daftar Kelas
            </button>
            <button
              onClick={() => setActiveMainTab("unassigned")}
              className={`px-6 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                activeMainTab === "unassigned"
                  ? "bg-white text-blue-600 font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 font-medium"
              }`}
            >
              Belum Terdaftar Kelas
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW TAB 1: DAFTAR KELAS (Data Table Style)                           */}
      {/* ========================================================================= */}
      {currentView === "list" && activeMainTab === "daftar" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Toolbar Atas Tabel */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-end gap-2.5">
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari..."
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
                  <th className="py-3.5 px-4">Nama ∨</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4 text-center">Santri Laki-laki ∨</th>
                  <th className="py-3.5 px-4 text-center">Santri Perempuan ∨</th>
                  <th className="py-3.5 px-4">Ketua Laki-laki ∨</th>
                  <th className="py-3.5 px-4">Ketua Perempuan ∨</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      {searchDaftar ? "Tidak ada kelas yang cocok dengan pencarian." : "Belum ada kelas pengajian yang terdaftar."}
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((className) => {
                    const counts = classStudentCounts[className] || { laki: 0, perempuan: 0 };
                    const kategori = classKategoriMap[className] || "Reguler";
                    const ketuaLaki = classKetuaLakiMap[className] || "Belum Ditentukan";
                    const ketuaPerempuan = classKetuaPerempuanMap[className] || "Belum Ditentukan";

                    return (
                      <tr key={className} className="hover:bg-slate-50/80 transition-colors">
                        {/* Aksi */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => handleOpenDetail(className, e)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all cursor-pointer"
                              title="Lihat Detail Kelas"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleOpenEditForm(className, e)}
                              className="p-1.5 text-blue-600 hover:text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all cursor-pointer"
                              title="Edit Kelas"
                            >
                              <Edit3 className="w-4 h-4 text-white" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClass(className, e)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                        {/* Nama Kelas */}
                        <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                          {className}
                        </td>

                        {/* Kategori Badge */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                            {kategori}
                          </span>
                        </td>

                        {/* Santri Laki-laki */}
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {counts.laki}
                        </td>

                        {/* Santri Perempuan */}
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {counts.perempuan}
                        </td>

                        {/* Ketua Laki-laki */}
                        <td className="py-3 px-4 text-slate-400 font-medium">
                          {ketuaLaki}
                        </td>

                        {/* Ketua Perempuan */}
                        <td className="py-3 px-4 text-slate-400 font-medium">
                          {ketuaPerempuan}
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
              Menampilkan <span className="font-bold text-slate-800">1 sampai {filteredClasses.length}</span> dari <span className="font-bold text-slate-800">{filteredClasses.length}</span> hasil
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
      {/* 4. VIEW TAB 2: BELUM TERDAFTAR KELAS (Santri Unassigned Queue)            */}
      {/* ========================================================================= */}
      {currentView === "list" && activeMainTab === "unassigned" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Toolbar Atas Tabel */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-semibold">
              Total Santri Belum Ada Kelas: <strong className="text-blue-600 font-bold">{unassignedStudents.length}</strong> Santri
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari..."
                  value={searchUnassigned}
                  onChange={(e) => setSearchUnassigned(e.target.value)}
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
          </div>

          {/* Tabel Santri Antrean */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 w-36 text-center">Aksi</th>
                  <th className="py-3.5 px-4">Nama ∨</th>
                  <th className="py-3.5 px-4 text-center w-24">L/P ∨</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {unassignedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-emerald-600 font-bold">
                      🎉 Seluruh santri sudah terdaftar dan mendapatkan kelas pengajian.
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
                            setSelectedMutasiClass(recitationClasses[0] || "");
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
      {/* 5. HALAMAN DETAIL KELAS ("Lihat Detail Kelas")                            */}
      {/* ========================================================================= */}
      {currentView === "detail" && (
        <div className="space-y-6">

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

          {/* Tabel Anggota Kelas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            {/* Toolbar Search Dalam Kelas */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700">
                Anggota Kelas: <span className="text-blue-600">{filteredClassMembers.length}</span> Santri
              </div>

              <div className="relative w-full max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari..."
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
                    <th className="py-3.5 px-4">Tanggal Masuk ∨</th>
                    <th className="py-3.5 px-4 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {filteredClassMembers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-slate-400">
                        {searchDetailMembers ? "Tidak ada santri yang sesuai kata kunci." : "Belum ada santri yang dimasukkan ke dalam kelas ini."}
                      </td>
                    </tr>
                  ) : (
                    filteredClassMembers.map((s) => (
                      <tr key={s.id || s.nisn} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                          {s.nama_lengkap}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {s.created_at ? s.created_at.slice(0, 10) : (s.nisn || s.id || "—")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleRemoveMemberFromClass(s)}
                            className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                            title="Keluarkan dari kelas"
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
      {/* 6. HALAMAN FORMULIR ("Buat / Edit Kelas")                                 */}
      {/* ========================================================================= */}
      {currentView === "form" && (
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            
            {/* Field Input "Nama Kelas" & "Kategori" */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Nama <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pegon SMP / Bacaan SMP"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Kategori
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Reguler"
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>

            </div>

            {/* Field "Ketua Laki-laki" & "Ketua Perempuan" */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Ketua Laki-laki
                </label>
                <select
                  value={formKetuaLaki}
                  onChange={(e) => setFormKetuaLaki(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {ustazList.map((u) => (
                    <option key={"laki_" + u.id + u.nama} value={u.nama}>
                      {u.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Ketua Perempuan
                </label>
                <select
                  value={formKetuaPerempuan}
                  onChange={(e) => setFormKetuaPerempuan(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {ustazList.map((u) => (
                    <option key={"p_" + u.id + u.nama} value={u.nama}>
                      {u.nama}
                    </option>
                  ))}
                </select>
              </div>

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
      {/* 7. MODAL MUTASI SANTRI (POPUP SELEKSI KELAS)                              */}
      {/* ========================================================================= */}
      {mutasiStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span>Plotting / Mutasi Kelas Pengajian</span>
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
                  Pilih Kelas Pengajian Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedMutasiClass}
                  onChange={(e) => setSelectedMutasiClass(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="" disabled>-- Pilih Kelas Pengajian --</option>
                  {recitationClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
