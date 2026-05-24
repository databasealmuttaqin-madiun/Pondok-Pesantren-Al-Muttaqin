import React, { useState } from "react";
import { 
  Plus, Trash2, Users, Layers, Compass, Sparkles, BookOpenCheck, 
  UserCheck, GraduationCap, Building, Trash, Notebook, Calendar, Eye 
} from "lucide-react";
import { SantriData } from "../supabaseClient";

interface ManagementPanelProps {
  students: SantriData[];
  
  rooms: string[];
  setRooms: (rooms: string[]) => void;
  
  recitationClasses: string[];
  setRecitationClasses: (classes: string[]) => void;
  
  schoolClasses: string[];
  setSchoolClasses: (classes: string[]) => void;
  
  // Custom metadata mappings saved in state of App.tsx
  metadataMap: Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: string }>;
  onAssignMetadata: (nik: string, key: "kamar" | "kelas_sekolah" | "kelas_pengajian", value: string) => void;
}

// In-app extended storage models for detailed metadata
interface RoomDetail {
  name: string;
  building: string;
  custodian: string;
  capacity: number;
}

interface RecitationDetail {
  name: string;
  level: string;
  teacher: string;
  schedule: string;
}

interface SchoolDetail {
  name: string;
  level: string; // SMP, SMA, Reguler
  homeroomTeacher: string;
  academicYear: string;
}

export default function ManagementPanel({ 
  students, 
  rooms, 
  setRooms, 
  recitationClasses, 
  setRecitationClasses, 
  schoolClasses, 
  setSchoolClasses,
  metadataMap,
  onAssignMetadata
}: ManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<"kamar" | "pengajian" | "sekolah">("kamar");
  
  // Detailed metadata states loaded/backed by localStorage
  const [roomDetails, setRoomDetails] = useState<RoomDetail[]>(() => {
    const saved = localStorage.getItem("manajemen_room_details");
    const parsed = saved ? JSON.parse(saved) : [];
    const defaultNames = ["Kamar Al-Fatih", "Kamar Sultan Agung", "Kamar Gajah Mada", "Kamar Diponegoro"];
    return parsed.filter((r: RoomDetail) => !defaultNames.includes(r.name));
  });

  const [recitationDetails, setRecitationDetails] = useState<RecitationDetail[]>(() => {
    const saved = localStorage.getItem("manajemen_recitation_details");
    const parsed = saved ? JSON.parse(saved) : [];
    const defaultNames = ["Kelas Al-Quran Pemula", "Kelas Tajwid & Makhraj", "Kelas Tahfidz Juz 30", "Kelas Kitab Fathul Qorib", "Kelas Hadits Arbain"];
    return parsed.filter((rd: RecitationDetail) => !defaultNames.includes(rd.name));
  });

  const [schoolDetails, setSchoolDetails] = useState<SchoolDetail[]>(() => {
    const saved = localStorage.getItem("manajemen_school_details");
    const parsed = saved ? JSON.parse(saved) : [];
    const defaultNames = [
      "Kelas VII-A SMP",
      "Kelas VII-B SMP",
      "Kelas VIII SMP",
      "Kelas IX SMP",
      "Kelas X-MIPA SMA",
      "Kelas XI-IPS SMA",
      "Kelas XII SMA"
    ];
    return parsed.filter((sd: SchoolDetail) => !defaultNames.includes(sd.name));
  });

  // Modal State to view assigned students
  const [selectedEntityForModal, setSelectedEntityForModal] = useState<{
    type: "kamar" | "pengajian" | "sekolah";
    name: string;
  } | null>(null);

  // Form Inputs
  const [roomInput, setRoomInput] = useState({ name: "", building: "", custodian: "", capacity: 100 });
  const [recitationInput, setRecitationInput] = useState({ name: "", level: "SMP", teacher: "", schedule: "" });
  const [schoolInput, setSchoolInput] = useState({ name: "", level: "SMP", homeroomTeacher: "", academicYear: "" });

  // Notifications inside management view
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setLocalFeedback(msg);
    setTimeout(() => setLocalFeedback(null), 3000);
  };

  // Helper selectors to compute occupied stats
  const countAssigned = (type: "kamar" | "kelas_pengajian" | "kelas_sekolah", name: string) => {
    return students.filter((s) => {
      // Check in direct student data (if column exists)
      const directVal = s[type as keyof SantriData];
      if (directVal === name) return true;
      
      // Check in metadataMap
      const mapped = metadataMap[s.nik];
      if (mapped) {
        if (type === "kamar" && mapped.kamar === name) return true;
        if (type === "kelas_pengajian" && mapped.kelas_pengajian === name) return true;
        if (type === "kelas_sekolah" && mapped.kelas_sekolah === name) return true;
      }
      return false;
    }).length;
  };

  const getAssignedStudents = (type: "kamar" | "kelas_pengajian" | "kelas_sekolah", name: string) => {
    return students.filter((s) => {
      const directVal = s[type as keyof SantriData];
      if (directVal === name) return true;
      
      const mapped = metadataMap[s.nik];
      if (mapped) {
        if (type === "kamar" && mapped.kamar === name) return true;
        if (type === "kelas_pengajian" && mapped.kelas_pengajian === name) return true;
        if (type === "kelas_sekolah" && mapped.kelas_sekolah === name) return true;
      }
      return false;
    });
  };

  // 1. ADD KAMAR
  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.name.trim()) return;
    
    const formattedName = roomInput.name.trim();
    if (rooms.includes(formattedName)) {
      showFeedback("Nama kamar sudah terdaftar!");
      return;
    }

    const updatedRooms = [...rooms, formattedName];
    setRooms(updatedRooms);
    localStorage.setItem("manajemen_rooms", JSON.stringify(updatedRooms));

    const updatedDetails = [...roomDetails, {
      name: formattedName,
      building: roomInput.building.trim() || "Gedung Umum",
      custodian: "",
      capacity: 100
    }];
    setRoomDetails(updatedDetails);
    localStorage.setItem("manajemen_room_details", JSON.stringify(updatedDetails));

    setRoomInput({ name: "", building: "", custodian: "", capacity: 100 });
    showFeedback(`Kamar "${formattedName}" berhasil ditambahkan!`);
  };

  // DELETE KAMAR
  const handleDeleteRoom = (nameToDelete: string) => {
    const confirmVal = window.confirm(`Apakah Anda yakin ingin menghapus "${nameToDelete}" dari data manajemen kamar?`);
    if (!confirmVal) return;

    const updatedRooms = rooms.filter((r) => r !== nameToDelete);
    setRooms(updatedRooms);
    localStorage.setItem("manajemen_rooms", JSON.stringify(updatedRooms));

    const updatedDetails = roomDetails.filter((r) => r.name !== nameToDelete);
    setRoomDetails(updatedDetails);
    localStorage.setItem("manajemen_room_details", JSON.stringify(updatedDetails));
    
    showFeedback(`Kamar "${nameToDelete}" berhasil dihapus.`);
  };

  // 2. ADD RECITATION CLASS
  const handleAddRecitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recitationInput.name.trim()) return;

    const formattedName = recitationInput.name.trim();
    if (recitationClasses.includes(formattedName)) {
      showFeedback("Nama kelas pengajian sudah terdaftar!");
      return;
    }

    const updatedClasses = [...recitationClasses, formattedName];
    setRecitationClasses(updatedClasses);
    localStorage.setItem("manajemen_recitation_classes", JSON.stringify(updatedClasses));

    const updatedDetails = [...recitationDetails, {
      name: formattedName,
      level: recitationInput.level || "SMP",
      teacher: "",
      schedule: ""
    }];
    setRecitationDetails(updatedDetails);
    localStorage.setItem("manajemen_recitation_details", JSON.stringify(updatedDetails));

    setRecitationInput({ name: "", level: "SMP", teacher: "", schedule: "" });
    showFeedback(`Kelas pengajian "${formattedName}" berhasil ditambahkan!`);
  };

  // DELETE RECITATION CLASS
  const handleDeleteRecitation = (nameToDelete: string) => {
    const confirmVal = window.confirm(`Apakah Anda yakin ingin menghapus kelas "${nameToDelete}"?`);
    if (!confirmVal) return;

    const updatedClasses = recitationClasses.filter((c) => c !== nameToDelete);
    setRecitationClasses(updatedClasses);
    localStorage.setItem("manajemen_recitation_classes", JSON.stringify(updatedClasses));

    const updatedDetails = recitationDetails.filter((c) => c.name !== nameToDelete);
    setRoomDetails(updatedDetails); // Keep reference
    setRecitationDetails(updatedDetails);
    localStorage.setItem("manajemen_recitation_details", JSON.stringify(updatedDetails));

    showFeedback(`Kelas pengajian "${nameToDelete}" berhasil dihapus.`);
  };

  // 3. ADD SCHOOL CLASS
  const handleAddSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolInput.name.trim()) return;

    const formattedName = schoolInput.name.trim();
    if (schoolClasses.includes(formattedName)) {
      showFeedback("Nama kelas sekolah sudah terdaftar!");
      return;
    }

    const updatedClasses = [...schoolClasses, formattedName];
    setSchoolClasses(updatedClasses);
    localStorage.setItem("manajemen_school_classes", JSON.stringify(updatedClasses));

    const updatedDetails = [...schoolDetails, {
      name: formattedName,
      level: schoolInput.level || "SMP",
      homeroomTeacher: "",
      academicYear: ""
    }];
    setSchoolDetails(updatedDetails);
    localStorage.setItem("manajemen_school_details", JSON.stringify(updatedDetails));

    setSchoolInput({ name: "", level: "SMP", homeroomTeacher: "", academicYear: "" });
    showFeedback(`Kelas sekolah "${formattedName}" berhasil ditambahkan!`);
  };

  // DELETE SCHOOL CLASS
  const handleDeleteSchool = (nameToDelete: string) => {
    const confirmVal = window.confirm(`Apakah Anda yakin ingin menghapus kelas sekolah "${nameToDelete}"?`);
    if (!confirmVal) return;

    const updatedClasses = schoolClasses.filter((c) => c !== nameToDelete);
    setSchoolClasses(updatedClasses);
    localStorage.setItem("manajemen_school_classes", JSON.stringify(updatedClasses));

    const updatedDetails = schoolDetails.filter((c) => c.name !== nameToDelete);
    setSchoolDetails(updatedDetails);
    localStorage.setItem("manajemen_school_details", JSON.stringify(updatedDetails));

    showFeedback(`Kelas sekolah "${nameToDelete}" ditiadakan.`);
  };

  // Find detailed match or construct fallback
  const findRoomDetail = (name: string): RoomDetail => {
    return roomDetails.find((r) => r.name === name) || { name, building: "Gedung Utama", custodian: "", capacity: 100 };
  };

  const findRecitationDetail = (name: string): RecitationDetail => {
    return recitationDetails.find((c) => c.name === name) || { name, level: "SMP", teacher: "", schedule: "" };
  };

  const findSchoolDetail = (name: string): SchoolDetail => {
    return schoolDetails.find((c) => c.name === name) || { name, level: "SMP", homeroomTeacher: "", academicYear: "" };
  };

  // Total Assignments overall
  const countTotalCategoryAssignments = (type: "kamar" | "kelas_pengajian" | "kelas_sekolah") => {
    return students.filter((s) => {
      const direct = s[type as keyof SantriData];
      if (direct) return true;
      const mapped = metadataMap[s.nik];
      return !!(mapped && mapped[type === "kelas_pengajian" ? "kelas_pengajian" : type === "kelas_sekolah" ? "kelas_sekolah" : "kamar"]);
    }).length;
  };

  return (
    <div className="space-y-5" id="management_panel_module">
      
      {/* HEADER BANNER */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-44 h-44 bg-sky-50 rounded-full blur-2xl opacity-70 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 select-none">
            <span className="bg-sky-50 text-sky-700 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-sky-100 block w-fit">
              ADMINISTRATIVE HUB
            </span>
            <h2 className="text-sm md:text-base font-extrabold tracking-tight text-slate-800 uppercase" id="management-hub-title">
              MANAJEMEN INTEGRASI pondok pesantren
            </h2>
            <p className="text-slate-500 text-[11px] leading-tight max-w-2xl font-medium">
              Kelola entitas kepengasuhan santri. Atur pembagian Kamar Asrama, Kelas Pengajian (Diniyah Al-Quran), serta Kelas Sekolah Formal bagi para santri yang terdaftar secara digital.
            </p>
          </div>

          <div className="flex gap-2 shrink-0 md:self-center">
            <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl text-center min-w-16">
              <span className="block text-xl font-extrabold text-sky-700">{rooms.length}</span>
              <span className="block text-[8px] text-slate-400 font-bold uppercase">Kamar</span>
            </div>
            <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl text-center min-w-16">
              <span className="block text-xl font-extrabold text-indigo-600">{recitationClasses.length}</span>
              <span className="block text-[8px] text-slate-400 font-bold uppercase">Ngaji</span>
            </div>
            <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl text-center min-w-16">
              <span className="block text-xl font-extrabold text-blue-600">{schoolClasses.length}</span>
              <span className="block text-[8px] text-slate-400 font-bold uppercase">Sekolah</span>
            </div>
          </div>
        </div>

        {localFeedback && (
          <div className="mt-4 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg text-center animate-fade-in">
            ✅ {localFeedback}
          </div>
        )}
      </div>

      {/* THREE-WAY SUB NAVIGATION */}
      <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-sm" id="management-tabs">
        <button
          onClick={() => setActiveTab("kamar")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "kamar"
              ? "bg-sky-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>🛏️ Manajemen Kamar ({rooms.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("pengajian")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "pengajian"
              ? "bg-sky-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Notebook className="w-3.5 h-3.5" />
          <span>📖 Kelas Pengajian ({recitationClasses.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("sekolah")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "sekolah"
              ? "bg-sky-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>🏫 Kelas Sekolah ({schoolClasses.length})</span>
        </button>
      </div>

      {/* TAB CONTENTS - TWO COLUMNS BENTO LAYOUT (Add Form Left, Detailed Grid Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COMPONENT COLUMN: INPUT FORM (4 Columns) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-fit">
          <div className="border-b border-light-100 pb-2 mb-4">
            <h3 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-sky-600" />
              {activeTab === "kamar" && "Formulir Tambah Kamar"}
              {activeTab === "pengajian" && "Formulir Tambah Kelas Pengajian"}
              {activeTab === "sekolah" && "Formulir Tambah Kelas Sekolah"}
            </h3>
            <p className="text-[10px] text-slate-405 font-medium mt-0.5">
              Masukkan informasi detail di bawah untuk merekam unit manajemen baru.
            </p>
          </div>

          {/* 1. ROOM ADD FORM */}
          {activeTab === "kamar" && (
            <form onSubmit={handleAddRoom} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Nama Kamar Asrama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={roomInput.name}
                  onChange={(e) => setRoomInput({ ...roomInput, name: e.target.value })}
                  placeholder="Contoh: Kamar Al-Ghozali"
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Cakupan Gedung
                </label>
                <input
                  type="text"
                  value={roomInput.building}
                  onChange={(e) => setRoomInput({ ...roomInput, building: e.target.value })}
                  placeholder="Contoh: Gedung Umar LT 2"
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow transition-colors block text-center cursor-pointer mt-3"
              >
                Simpan & Daftarkan Kamar
              </button>
            </form>
          )}

          {/* 2. RECITATION ADD FORM */}
          {activeTab === "pengajian" && (
            <form onSubmit={handleAddRecitation} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Kategori Santri <span className="text-red-500">*</span>
                </label>
                <select
                  value={recitationInput.level}
                  onChange={(e) => setRecitationInput({ ...recitationInput, level: e.target.value })}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white font-semibold"
                >
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                  <option value="Reguler">Reguler</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Nama Kelas Pengajian <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={recitationInput.name}
                  onChange={(e) => setRecitationInput({ ...recitationInput, name: e.target.value })}
                  placeholder="Contoh: Kelas Al-Quran Pemula"
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow transition-colors block text-center cursor-pointer mt-3"
              >
                Simpan & Daftarkan Kelas Ngaji
              </button>
            </form>
          )}

          {/* 3. SCHOOL ADD FORM */}
          {activeTab === "sekolah" && (
            <form onSubmit={handleAddSchool} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Kategori Santri <span className="text-red-500">*</span>
                </label>
                <select
                  value={schoolInput.level}
                  onChange={(e) => setSchoolInput({ ...schoolInput, level: e.target.value })}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white font-semibold"
                >
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                  <option value="Reguler">Reguler</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Nama Kelas Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={schoolInput.name}
                  onChange={(e) => setSchoolInput({ ...schoolInput, name: e.target.value })}
                  placeholder="Contoh: Kelas VII-A SMP"
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow transition-colors block text-center cursor-pointer mt-3"
              >
                Simpan & Daftarkan Kelas Sekolah
              </button>
            </form>
          )}
        </div>

        {/* RIGHT COMPONENT COLUMN: INTERACTIVE LISTINGS & STATS (8 Columns) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between min-h-[400px]">
          
          <div className="space-y-3">
            <div className="border-b border-light-100 pb-2 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5 leading-none">
                {activeTab === "kamar" && <Building className="w-4 h-4 text-sky-600" />}
                {activeTab === "pengajian" && <Notebook className="w-4 h-4 text-sky-600" />}
                {activeTab === "sekolah" && <GraduationCap className="w-4 h-4 text-sky-600" />}
                <span>Daftar Unit Terdaftar & Kepadatan Santri</span>
              </h3>
              
              <span className="text-[9px] bg-slate-50 text-slate-500 border border-slate-150 px-2 py-0.5 rounded font-mono font-bold uppercase">
                {activeTab === "kamar" && `Total: ${rooms.length} Kamar`}
                {activeTab === "pengajian" && `Total: ${recitationClasses.length} Pengajian`}
                {activeTab === "sekolah" && `Total: ${schoolClasses.length} Kelas`}
              </span>
            </div>

            {/* ERROR / EMPTY STATE */}
            {((activeTab === "kamar" && rooms.length === 0) ||
              (activeTab === "pengajian" && recitationClasses.length === 0) ||
              (activeTab === "sekolah" && schoolClasses.length === 0)) && (
              <div className="text-center py-12 text-slate-400 italic text-xs">
                ⚠️ Belum ada entitas yang dibuat. Silakan tambahkan pada formulir di sebelah kiri.
              </div>
            )}

            {/* 1. ROOMS DENSE TABLE LISTING */}
            {activeTab === "kamar" && rooms.length > 0 && (
              <div className="overflow-x-auto select-none rounded-lg border border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-black border-b border-slate-100">
                      <th className="p-2.5">Nama Kamar</th>
                      <th className="p-2.5">Lokasi / Gedung</th>
                      <th className="p-2.5 text-center">Santri Terisi</th>
                      <th className="p-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rooms.map((roomName) => {
                      const detail = findRoomDetail(roomName);
                      const assignedCount = countAssigned("kamar", roomName);
                      return (
                        <tr key={roomName} className="hover:bg-slate-50/40 transition-colors group">
                          <td className="p-2.5 font-bold text-slate-800">
                            🏢 {roomName}
                          </td>
                          <td className="p-2.5 text-slate-500">{detail.building}</td>
                          <td className="p-2.5 text-center">
                            <span 
                              onClick={() => assignedCount > 0 && setSelectedEntityForModal({ type: "kamar", name: roomName })}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono font-bold text-[10px] cursor-pointer ${
                                assignedCount > 0 
                                  ? "bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100/50" 
                                  : "bg-slate-50 text-slate-400 border border-slate-200"
                              }`}
                              title="Klik untuk melihat daftar santri di kamar ini"
                            >
                              {assignedCount} anak
                              <Eye className="w-3 h-3 text-slate-400" />
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => handleDeleteRoom(roomName)}
                              className="text-slate-400 hover:text-red-650 p-1 hover:bg-red-50 rounded transition-colors inline-block"
                              title="Hapus Kamar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. RECITATION DETAILS LISTING */}
            {activeTab === "pengajian" && recitationClasses.length > 0 && (
              <div className="overflow-x-auto select-none rounded-lg border border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-black border-b border-slate-100">
                      <th className="p-2.5">Nama Kelas Ngaji</th>
                      <th className="p-2.5 text-center">Kategori</th>
                      <th className="p-2.5 text-center">Santri</th>
                      <th className="p-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {recitationClasses.map((className) => {
                      const detail = findRecitationDetail(className);
                      const assignedCount = countAssigned("kelas_pengajian", className);
                      return (
                        <tr key={className} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-2.5 font-bold text-slate-800">
                            📖 {className}
                          </td>
                          <td className="p-2.5 text-center font-bold text-indigo-700">
                            <span className="bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full text-[9px] uppercase">
                              {detail.level}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span 
                              onClick={() => assignedCount > 0 && setSelectedEntityForModal({ type: "pengajian", name: className })}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold text-[10px] cursor-pointer ${
                                assignedCount > 0 
                                  ? "bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100/50" 
                                  : "bg-slate-50 text-slate-400 border border-slate-200"
                              }`}
                              title="Klik untuk melihat santri"
                            >
                              {assignedCount} anak
                              <Eye className="w-3 h-3 text-slate-400" />
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => handleDeleteRecitation(className)}
                              className="text-slate-400 hover:text-red-650 p-1 hover:bg-red-50 rounded transition-colors inline-block"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. SCHOOL DETAILS LISTING */}
            {activeTab === "sekolah" && schoolClasses.length > 0 && (
              <div className="overflow-x-auto select-none rounded-lg border border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-black border-b border-slate-100">
                      <th className="p-2.5">Nama Kelas Sekolah</th>
                      <th className="p-2.5 text-center">Kategori</th>
                      <th className="p-2.5 text-center">Santri</th>
                      <th className="p-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {schoolClasses.map((className) => {
                      const detail = findSchoolDetail(className);
                      const assignedCount = countAssigned("kelas_sekolah", className);
                      return (
                        <tr key={className} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-2.5 font-bold text-slate-800">
                            🏫 {className}
                          </td>
                          <td className="p-2.5 text-center font-bold text-blue-700">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              detail.level === "SMP" 
                                ? "bg-blue-50 border border-blue-150 text-blue-700"
                                : detail.level === "SMA"
                                ? "bg-indigo-50 border border-indigo-150 text-indigo-700"
                                : "bg-amber-50 border border-amber-150 text-amber-700"
                            }`}>
                              {detail.level}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span 
                              onClick={() => assignedCount > 0 && setSelectedEntityForModal({ type: "sekolah", name: className })}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold text-[10px] cursor-pointer ${
                                assignedCount > 0 
                                  ? "bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100/50" 
                                  : "bg-slate-50 text-slate-400 border border-slate-200"
                              }`}
                              title="Klik untuk melihat santri"
                            >
                              {assignedCount} anak
                              <Eye className="w-3 h-3 text-slate-400" />
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() => handleDeleteSchool(className)}
                              className="text-slate-400 hover:text-red-650 p-1 hover:bg-red-50 rounded transition-colors inline-block"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2 select-none">
            <span className="font-semibold flex items-center gap-1">
              💡 <span>Tip:</span> Anda dapat langsung memetakan santri ke unit-unit di atas saat mengisi <strong>Formulir Registrasi</strong>.
            </span>
            <span className="bg-slate-50 text-slate-450 border border-slate-100 px-2 py-1 rounded font-mono font-bold text-right shrink-0">
              Sinkronisasi: OK (Local-Storage & Cloud-Ready)
            </span>
          </div>
        </div>

      </div>

      {/* VIEW ASSIGNED STUDENTS MODAL DIALOG */}
      {selectedEntityForModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full overflow-hidden shadow-xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-sky-600 px-4 py-3.5 text-white flex justify-between items-center">
              <div>
                <span className="bg-sky-750/70 text-sky-100 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                  {selectedEntityForModal.type === "kamar" && "Anggota Kamar Asrama"}
                  {selectedEntityForModal.type === "pengajian" && "Daftar Absensi Mengaji"}
                  {selectedEntityForModal.type === "sekolah" && "Daftar Absensi Sekolah Formal"}
                </span>
                <h3 className="font-extrabold text-sm uppercase tracking-tight mt-1 leading-none">
                  {selectedEntityForModal.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedEntityForModal(null)}
                className="text-white/85 hover:text-white font-black text-xs hover:bg-white/10 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Student list */}
            <div className="p-4 max-h-[300px] overflow-y-auto divide-y divide-slate-100">
              {getAssignedStudents(
                selectedEntityForModal.type === "kamar" 
                  ? "kamar" 
                  : selectedEntityForModal.type === "pengajian" 
                  ? "kelas_pengajian" 
                  : "kelas_sekolah",
                selectedEntityForModal.name
              ).map((student, idx) => (
                <div key={student.nik} className="py-2 flex items-center justify-between text-xs font-semibold hover:bg-slate-50/50 rounded-lg px-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 select-none font-mono">#{idx+1}</span>
                    <span className="text-slate-800 font-bold">{student.nama_lengkap}</span>
                  </div>
                  <span className="text-[9px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-mono font-bold tracking-tight">
                    {student.kategori}
                  </span>
                </div>
              ))}
              
              {getAssignedStudents(
                selectedEntityForModal.type === "kamar" 
                  ? "kamar" 
                  : selectedEntityForModal.type === "pengajian" 
                  ? "kelas_pengajian" 
                  : "kelas_sekolah",
                selectedEntityForModal.name
              ).length === 0 && (
                <p className="text-center py-6 text-slate-400 italic text-xs">Belum ada santri yang dimasukkan.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-150 flex justify-end">
              <button
                onClick={() => setSelectedEntityForModal(null)}
                className="px-4 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-bold tracking-wide cursor-pointer shadow-sm transition-all"
              >
                Tutup Jendela
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
