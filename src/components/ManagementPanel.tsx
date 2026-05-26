import React, { useState } from "react";
import { SantriData, supabase } from "../supabaseClient";

interface ManagementPanelProps {
  students: SantriData[];
  
  rooms: string[];
  setRooms: (rooms: string[]) => void;
  
  recitationClasses: string[];
  setRecitationClasses: (classes: string[]) => void;
  
  schoolClasses: string[];
  setSchoolClasses: (classes: string[]) => void;
  
  metadataMap: Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: string }>;
  onAssignMetadata: (nik: string, key: "kamar" | "kelas_sekolah" | "kelas_pengajian", value: string) => void;
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
  // Current plotting mode: "kamar", "pengajian", "sekolah"
  const [activeMode, setActiveMode] = useState<"kamar" | "pengajian" | "sekolah">("kamar");

  // State for quick creation modal popups/forms
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddRecitation, setShowAddRecitation] = useState(false);
  const [showAddSchool, setShowAddSchool] = useState(false);

  // Quick form input states
  const [roomName, setRoomName] = useState("");
  const [roomBuilding, setRoomBuilding] = useState("");

  const [recitationName, setRecitationName] = useState("");
  const [recitationCategory, setRecitationCategory] = useState("SMP");

  const [schoolName, setSchoolName] = useState("");
  const [schoolCategory, setSchoolCategory] = useState("SMP");

  // Plotting selection inputs
  const [selectedNik, setSelectedNik] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");

  // Feedback notifications
  const [feedback, setFeedback] = useState<string | null>(null);

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Helper to retrieve current mapping for a student
  const getStudentCurrentPlot = (student: SantriData, mode: "kamar" | "pengajian" | "sekolah") => {
    if (mode === "kamar") {
      return student.kamar || "";
    }
    if (mode === "pengajian") {
      return student.kelas_pengajian || "";
    }
    return student.kelas_sekolah || "";
  };

  // Get active lists based on the selected mode
  const getModeLabelKey = () => {
    switch (activeMode) {
      case "kamar": return { key: "kamar" as const, label: "Kamar", options: rooms };
      case "pengajian": return { key: "kelas_pengajian" as const, label: "Kelas Pengajian", options: recitationClasses };
      case "sekolah": return { key: "kelas_sekolah" as const, label: "Kelas Sekolah", options: schoolClasses };
    }
  };

  const modeInfo = getModeLabelKey();

  // Handle student plotting submission
  const handleSavePlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNik) {
      triggerFeedback("Silakan pilih siswa terlebih dahulu.");
      return;
    }
    if (!selectedTarget) {
      triggerFeedback(`Silakan pilih target ${modeInfo.label} terlebih dahulu.`);
      return;
    }

    onAssignMetadata(selectedNik, modeInfo.key, selectedTarget);
    
    // Find student name for custom helpful message
    const matched = students.find((s) => s.nik === selectedNik);
    const sName = matched ? matched.nama_lengkap : "Siswa";
    
    triggerFeedback(`Berhasil memplot ${sName} ke ${modeInfo.label} "${selectedTarget}"`);
    setSelectedNik("");
    setSelectedTarget("");
  };

  // Quick Action: Add Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    const formatted = roomName.trim();
    if (rooms.includes(formatted)) {
      alert("Nama kamar sudah terdaftar!");
      return;
    }

    // 1. Update local states
    const updated = [...rooms, formatted];
    setRooms(updated);
    localStorage.setItem("manajemen_rooms", JSON.stringify(updated));

    // Save empty or custom buildings in local details too
    const savedDetails = localStorage.getItem("manajemen_room_details");
    const parsed = savedDetails ? JSON.parse(savedDetails) : [];
    const updatedDetails = [...parsed, { name: formatted, building: roomBuilding.trim() || "Gedung Utama" }];
    localStorage.setItem("manajemen_room_details", JSON.stringify(updatedDetails));

    // 2. Sync to Supabase in parallel
    try {
      // Masuk ke tabel 'plotting'
      const { error: errPlot } = await supabase
        .from("plotting")
        .insert([{ jenis: "kamar", nama: formatted }]);

      if (errPlot) console.warn("Supabase plotting insert warning:", errPlot.message);
    } catch (dbErr: any) {
      console.warn("Database offline / connection warning:", dbErr?.message);
    }

    setRoomName("");
    setRoomBuilding("");
    setShowAddRoom(false);
    triggerFeedback(`Kamar "${formatted}" berhasil dibuat & disinkronkan ke database.`);
  };

  // Quick Action: Add Recitation
  const handleCreateRecitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recitationName.trim()) return;

    const formatted = recitationName.trim();
    if (recitationClasses.includes(formatted)) {
      alert("Nama kelas pengajian sudah terdaftar!");
      return;
    }

    // 1. Update local states
    const updated = [...recitationClasses, formatted];
    setRecitationClasses(updated);
    localStorage.setItem("manajemen_recitation_classes", JSON.stringify(updated));

    const savedDetails = localStorage.getItem("manajemen_recitation_details");
    const parsed = savedDetails ? JSON.parse(savedDetails) : [];
    const updatedDetails = [...parsed, { name: formatted, level: recitationCategory }];
    localStorage.setItem("manajemen_recitation_details", JSON.stringify(updatedDetails));

    // 2. Sync to Supabase
    try {
      // Masuk ke tabel 'plotting'
      const { error: errPlot } = await supabase
        .from("plotting")
        .insert([{ jenis: "kelas pengajian", nama: formatted }]);

      if (errPlot) console.warn("Supabase plotting insert warning:", errPlot.message);
    } catch (dbErr: any) {
      console.warn("Database offline / connection warning:", dbErr?.message);
    }

    setRecitationName("");
    setShowAddRecitation(false);
    triggerFeedback(`Kelas Pengajian "${formatted}" berhasil dibuat & disinkronkan.`);
  };

  // Quick Action: Add School Class
  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) return;

    const formatted = schoolName.trim();
    if (schoolClasses.includes(formatted)) {
      alert("Nama kelas sekolah sudah terdaftar!");
      return;
    }

    // 1. Update local states
    const updated = [...schoolClasses, formatted];
    setSchoolClasses(updated);
    localStorage.setItem("manajemen_school_classes", JSON.stringify(updated));

    const savedDetails = localStorage.getItem("manajemen_school_details");
    const parsed = savedDetails ? JSON.parse(savedDetails) : [];
    const updatedDetails = [...parsed, { name: formatted, level: schoolCategory }];
    localStorage.setItem("manajemen_school_details", JSON.stringify(updatedDetails));

    // 2. Sync to Supabase
    try {
      // Masuk ke tabel 'plotting'
      const { error: errPlot } = await supabase
        .from("plotting")
        .insert([{ jenis: "kelas sekolah", nama: formatted }]);

      if (errPlot) console.warn("Supabase plotting insert warning:", errPlot.message);
    } catch (dbErr: any) {
      console.warn("Database offline / connection warning:", dbErr?.message);
    }

    setSchoolName("");
    setShowAddSchool(false);
    triggerFeedback(`Kelas Sekolah "${formatted}" berhasil dibuat & disinkronkan.`);
  };

  // Delete Entity Options completely
  const handleDeleteOption = async (itemToDelete: string) => {
    const confirmVal = window.confirm(`Apakah Anda yakin ingin menghapus ${modeInfo.label} "${itemToDelete}"? Semua siswa yang di-plot ke sini akan dikosongkan pemetaannya.`);
    if (!confirmVal) return;

    // 1. Local storage removal
    if (activeMode === "kamar") {
      const updated = rooms.filter((r) => r !== itemToDelete);
      setRooms(updated);
      localStorage.setItem("manajemen_rooms", JSON.stringify(updated));

      // Database delete
      try {
        await supabase.from("kamar").delete().eq("kamar", itemToDelete);
        await supabase.from("plotting").delete().eq("nama", itemToDelete).eq("jenis", "kamar");
      } catch (e: any) {
        console.warn("Supabase delete error:", e.message);
      }

    } else if (activeMode === "pengajian") {
      const updated = recitationClasses.filter((r) => r !== itemToDelete);
      setRecitationClasses(updated);
      localStorage.setItem("manajemen_recitation_classes", JSON.stringify(updated));

      // Database delete
      try {
        await supabase.from("kelas_pengajian").delete().eq("kelas", itemToDelete);
        await supabase.from("plotting").delete().eq("nama", itemToDelete).eq("jenis", "kelas pengajian");
      } catch (e: any) {
        console.warn("Supabase delete error:", e.message);
      }

    } else if (activeMode === "sekolah") {
      const updated = schoolClasses.filter((r) => r !== itemToDelete);
      setSchoolClasses(updated);
      localStorage.setItem("manajemen_school_classes", JSON.stringify(updated));

      // Database delete (supports both space and underscore tables)
      try {
        await supabase.from("kelas sekolah").delete().eq("kelas", itemToDelete);
      } catch {}
      try {
        await supabase.from("kelas_sekolah").delete().eq("kelas", itemToDelete);
      } catch {}
      try {
        await supabase.from("plotting").delete().eq("nama", itemToDelete).eq("jenis", "kelas sekolah");
      } catch (e: any) {
        console.warn("Supabase delete error:", e.message);
      }
    }

    // Reset students that mapped into this to empty locally and remote
    students.forEach((s) => {
      const plottedVal = getStudentCurrentPlot(s, activeMode);
      if (plottedVal === itemToDelete) {
        onAssignMetadata(s.nik, modeInfo.key, "");
      }
    });

    triggerFeedback(`Berhasil menghapus ${modeInfo.label} "${itemToDelete}" dari sistem & database.`);
  };

  // Un-plot or remove single student from their current target
  const handleClearStudentPlot = (sNik: string, sName: string, destinationLabel: string) => {
    onAssignMetadata(sNik, modeInfo.key, "");
    triggerFeedback(`Berhasil mengeluarkan ${sName} dari ${modeInfo.label} "${destinationLabel}"`);
  };

  return (
    <div className="space-y-6" id="plotting_siswa_panel_module">
      
      {/* HEADER BAR AND QUICK ACTION BUTTONS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="bg-slate-100 text-slate-800 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-200 w-fit block">
            Pusat Pemetaan
          </span>
          <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">
            Plotting Siswa
          </h2>
          <p className="text-slate-550 text-xs leading-relaxed max-w-2xl font-medium">
            Atur dan petakan penempatan asrama kamar tidur santri, pengelompokan kelas pengajian Al-Quran, serta pencatatan kelas sekolah reguler formal dalam satu dasbor terpadu.
          </p>
        </div>

        {/* 6. RIGHT TOP QUICK ACTIONS FOR NEW CREATION */}
        <div className="flex flex-wrap gap-2 shrink-0 self-start md:self-center">
          <button
            onClick={() => setShowAddRoom(true)}
            className="bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            + Buat Kamar
          </button>
          <button
            onClick={() => setShowAddRecitation(true)}
            className="bg-sky-650 hover:bg-sky-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            + Buat Kelas Diniyah
          </button>
          <button
            onClick={() => setShowAddSchool(true)}
            className="bg-blue-650 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            + Buat Kelas Formal
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-250 text-emerald-900 text-xs font-bold rounded-xl animate-fade-in text-center shadow-sm">
          Sistem Notifikasi: {feedback}
        </div>
      )}

      {/* QUICK FLOATING MODALS FOR CREATIONS (PLAIN TEXT BASED, ICONLESS) */}
      {showAddRoom && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
              Buat Kamar Asrama Baru
            </h3>
            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-505 uppercase block">Nama Kamar</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kamar Al-Ghazali"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 font-semibold text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-505 uppercase block">Lokasi / Gedung</label>
                <input
                  type="text"
                  placeholder="Contoh: Gedung Abu Bakar LT 1"
                  value={roomBuilding}
                  onChange={(e) => setRoomBuilding(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoom(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-650 font-bold text-xs rounded-xl hover:bg-slate-205 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-650 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 cursor-pointer"
                >
                  Simpan Kamar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddRecitation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
              Buat Kelas Pengajian (Ngaji)
            </h3>
            <form onSubmit={handleCreateRecitation} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-505 uppercase block">Nama Kelas Pengajian</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kelas Makhraj & Tajwid"
                  value={recitationName}
                  onChange={(e) => setRecitationName(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 font-semibold text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-505 uppercase block">Jenjang / Kategori</label>
                <select
                  value={recitationCategory}
                  onChange={(e) => setRecitationCategory(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                  <option value="Reguler">Reguler</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRecitation(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-650 font-bold text-xs rounded-xl hover:bg-slate-205 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-655 text-white font-bold text-xs rounded-xl hover:bg-sky-700 cursor-pointer"
                >
                  Simpan Kelas Ngaji
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSchool && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
              Buat Kelas Sekolah Formal
            </h3>
            <form onSubmit={handleCreateSchool} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-505 uppercase block">Nama Kelas Formal</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kelas X-IPA 2 SMA"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 font-semibold text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-505 uppercase block">Jenjang Sekolah</label>
                <select
                  value={schoolCategory}
                  onChange={(e) => setSchoolCategory(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                  <option value="Reguler">Reguler</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSchool(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-650 font-bold text-xs rounded-xl hover:bg-slate-205 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-655 text-white font-bold text-xs rounded-xl hover:bg-blue-700 cursor-pointer"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SELECT LABELS (1. KAMAR, PLOTTING SELECTIONS, ICONLESS) */}
      <div className="grid grid-cols-3 bg-slate-100/80 rounded-2xl p-1 border border-slate-200 shadow-inner">
        <button
          onClick={() => {
            setActiveMode("kamar");
            setSelectedNik("");
            setSelectedTarget("");
          }}
          className={`py-3 text-xs font-black rounded-xl text-center cursor-pointer transition-all ${
            activeMode === "kamar"
              ? "bg-white text-indigo-705 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Kamar
        </button>
        <button
          onClick={() => {
            setActiveMode("pengajian");
            setSelectedNik("");
            setSelectedTarget("");
          }}
          className={`py-3 text-xs font-black rounded-xl text-center cursor-pointer transition-all ${
            activeMode === "pengajian"
              ? "bg-white text-indigo-705 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Kelas Pengajian
        </button>
        <button
          onClick={() => {
            setActiveMode("sekolah");
            setSelectedNik("");
            setSelectedTarget("");
          }}
          className={`py-3 text-xs font-black rounded-xl text-center cursor-pointer transition-all ${
            activeMode === "sekolah"
              ? "bg-white text-indigo-705 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Kelas Sekolah
        </button>
      </div>

      {/* TWO COLUMNS WORKSPACE BENTO LAYOUT (No Icons allowed) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COMPONENT: PLOTTING ASSIGNER CONTROLLER FORM */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black text-slate-800 uppercase leading-none">
              Formulir Alokasi Plotting
            </h3>
            <p className="text-[10px] text-slate-450 font-bold mt-1 uppercase">
              Mode Aktif: {modeInfo.label}
            </p>
          </div>

          <form onSubmit={handleSavePlot} className="space-y-4">
            
            {/* Step 1: Select Student */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-550 uppercase tracking-wider block">
                Langkah 1: Pilih Siswa / Santri
              </label>
              <select
                required
                value={selectedNik}
                onChange={(e) => setSelectedNik(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 bg-white"
              >
                <option value="">-- PILIH NAMA SISWA --</option>
                {students.map((student) => {
                  const currentPlotted = getStudentCurrentPlot(student, activeMode);
                  const suffix = currentPlotted ? `(${currentPlotted})` : "(Belum di-plot)";
                  return (
                    <option key={student.nik} value={student.nik}>
                      {student.nama_lengkap} {suffix}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Step 2: Select Designation */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-550 uppercase tracking-wider block">
                Langkah 2: Pilih Tujuan {modeInfo.label}
              </label>
              <select
                required
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 bg-white"
              >
                <option value="">-- PILIH TUJUAN {modeInfo.label.toUpperCase()} --</option>
                {modeInfo.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-850 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all text-center cursor-pointer uppercase tracking-wider"
            >
              Simpan Pemetaan Plotting
            </button>
          </form>
        </div>

        {/* RIGHT COMPONENT: DETAILED GRID GROUPS OF ASSIGNMENTS */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-h-[400px] flex flex-col justify-between">
          
          <div className="space-y-4">
            
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                Ringkasan Penempatan {modeInfo.label} Santri
              </h3>
              <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded font-mono uppercase">
                Menampilkan {modeInfo.options.length} {modeInfo.label}
              </span>
            </div>

            {modeInfo.options.length === 0 && (
              <div className="text-center py-16 text-slate-405 font-semibold text-xs italic">
                Pemberitahuan: Belum ada data {modeInfo.label.toLowerCase()} yang dibuat. Silakan tambahkan terlebih dahulu dengan opsi di kanan atas.
              </div>
            )}

            {modeInfo.options.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modeInfo.options.map((groupName) => {
                  // Filter students assigned into this item group
                  const mappedStudents = students.filter((s) => {
                    const plottedVal = getStudentCurrentPlot(s, activeMode);
                    return plottedVal === groupName;
                  });

                  return (
                    <div 
                      key={groupName} 
                      className="border border-slate-200 rounded-2xl p-4 bg-slate-50/20 hover:bg-slate-55/10 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-1.5">
                          <span className="font-extrabold text-xs text-slate-900 block truncate">
                            {groupName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                            {mappedStudents.length} siswa
                          </span>
                        </div>

                        {/* Student listing under this category */}
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {mappedStudents.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic font-medium py-1">Kosong (belum ada siswa)</p>
                          ) : (
                            mappedStudents.map((siswa, idx) => (
                              <div 
                                key={siswa.nik} 
                                className="flex justify-between items-center text-[11px] py-1 hover:bg-slate-50 rounded px-1 group"
                              >
                                <span className="font-semibold text-slate-700 truncate">
                                  {idx + 1}. {siswa.nama_lengkap}
                                </span>
                                
                                <button
                                  onClick={() => handleClearStudentPlot(siswa.nik, siswa.nama_lengkap, groupName)}
                                  className="text-[9px] text-red-600 hover:text-red-800 hover:underline font-bold bg-red-50 hover:bg-red-100 px-1.5 py-0.5 rounded cursor-pointer leading-tight"
                                  title="Keluarkan dari group ini"
                                >
                                  Keluarkan
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Group controller footer */}
                      <div className="pt-2 border-t border-slate-100/60 flex justify-end">
                        <button
                          onClick={() => handleDeleteOption(groupName)}
                          className="text-[10px] text-slate-500 hover:text-red-700 font-bold hover:underline cursor-pointer"
                        >
                          Hapus {modeInfo.label}
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

          <div className="mt-6 pt-3 border-t border-slate-150 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2 font-semibold">
            <span>
              Info: Sinkronisasi database lokal & cloud plotting berjalan otomatis penuh.
            </span>
            <span className="bg-slate-100 text-slate-650 px-2.5 py-1 rounded font-mono font-bold uppercase border border-slate-205">
              Status Sinkronisasi Supabase: Terhubung
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
