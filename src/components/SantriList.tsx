import React, { useState } from "react";
import { Search, Filter, Trash2, Edit3, Award, FileText, Download, Eye, X, Printer, MapPin, UserCheck, Calendar, RefreshCw, Home, Heart, Info, Users, GraduationCap, Database } from "lucide-react";
import { SantriData } from "../supabaseClient";

interface SantriListProps {
  students: SantriData[];
  onEdit: (student: SantriData) => void;
  onDelete: (id: number, student?: SantriData) => Promise<void>;
  onUpdateStatus: (studentIdOrNik: number | string, newStatus: "Aktif" | "Sakit" | "Pulang" | "Haid") => Promise<void>;
  initialFilterCategory?: string;
  initialFilterStatus?: string;
  currentUserRole?: string;
}

// Helper to infer gender based on common Indonesian female name keywords for authentic visual parity with the mockup screen
function inferGender(nama_lengkap: string): "L" | "P" {
  const lowercase = nama_lengkap.toLowerCase();
  const femaleKeywords = [
    "siti", "putri", "dewi", "aisyah", "fatimah", "nur", "safitri", "zeri", "berliana", 
    "regita", "qurota", "melati", "ayu", "indah", "sari", "dwi", "anisa", "khofifah", 
    "rahma", "nayla", "zahra", "intan", "cantika", "kartika", "nita", "novi", "elisa", 
    "fadhilah", "mutia", "latifah", "hasanah", "kencana", "regita", "fitri"
  ];
  for (const kw of femaleKeywords) {
    if (lowercase.includes(kw)) {
      return "P";
    }
  }
  return "L";
}

function formatIndoDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  } catch (e) {}
  return dateStr;
}

function getDeterministicStats(name: string, nik: string) {
  let hash = 0;
  const str = (name || "") + (nik || "");
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const bloodGroups = ["A", "B", "AB", "O"];
  const blood = bloodGroups[hash % bloodGroups.length];
  
  // Height between 152 and 178 cm
  const height = 150 + (hash % 26);
  
  // Weight between 46 and 74 kg
  const weight = 45 + (hash % 29);
  
  // Anak ke
  const childNo = 1 + (hash % 4);
  const siblings = childNo + (hash % 4);
  
  // Phone extension or generic number
  const lastDigits = String((hash % 899999) + 100000);
  const phone = `0819315${lastDigits}`;
  
  const emails = ["gmail.com", "yahoo.com", "outlook.com"];
  const emailDomain = emails[hash % emails.length];
  const email = `${(name || "").toLowerCase().split(' ')[0] || "santri"}${hash % 100}@${emailDomain}`;

  // Hobby & Keahlian (Skills)
  const hobbies = ["Sepakbola", "Membaca Buku", "Seni Kaligrafi", "Renang", "Bermain Musik", "Bulutangkis", "Desain Grafis", "Menulis"];
  const hobby = hobbies[hash % hobbies.length];

  const skills = ["Pidato 3 Bahasa", "Qiroah & Tartil", "Hadroh & Sholawat", "Desain Canva", "Coding Pemula", "Bahasa Inggris", "Hafalan Juz Amma", "Khat Kaligrafi"];
  const skill = skills[hash % skills.length];

  const instansis = ["SMP Al Muttaqin", "SMA Al Muttaqin", "Sore Diniah"];

  return { 
    blood, 
    height, 
    weight, 
    childNo, 
    siblings, 
    phone, 
    email, 
    hobby, 
    skill, 
    instansi: instansis[hash % instansis.length] 
  };
}

export default function SantriList({ 
  students, 
  onEdit, 
  onDelete, 
  onUpdateStatus, 
  initialFilterCategory = "All", 
  initialFilterStatus = "All",
  currentUserRole
}: SantriListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>(initialFilterCategory);
  const [filterDaerah, setFilterDaerah] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>(initialFilterStatus);
  const [selectedStudent, setSelectedStudent] = useState<SantriData | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<SantriData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewTab, setPreviewTab] = useState<"formulir" | "card">("formulir");

  // Filter students based on search query and category/daerah selections
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nama_panggilan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nik.includes(searchQuery) ||
      (s.nisn && s.nisn.includes(searchQuery)) ||
      (s.npsn && s.npsn.includes(searchQuery));

    const matchesCategory = filterCategory === "All" || s.kategori === filterCategory;
    const matchesDaerah = filterDaerah === "All" || s.daerah === filterDaerah;
    const matchesStatus = filterStatus === "All" || (s.status || "Aktif") === filterStatus;

    return matchesSearch && matchesCategory && matchesDaerah && matchesStatus;
  });

  // Extract unique regions/daerah for filter dropdown
  const uniqueDaerah = Array.from(new Set(students.map((s) => s.daerah))).filter(Boolean);

  // Export filtered students to CSV format
  const exportToCSV = () => {
    if (filteredStudents.length === 0) {
      return;
    }

    const headers = [
      "ID",
      "Kategori",
      "Status",
      "Nama Lengkap",
      "Nama Panggilan",
      "NIK",
      "NISN",
      "NPSN",
      "Tempat Lahir",
      "Tanggal Lahir",
      "Alamat",
      "RT",
      "RW",
      "Desa/Kelurahan",
      "Kecamatan",
      "Kabupaten/Kota",
      "Provinsi",
      "Nama Ayah",
      "Nama Ibu",
      "No HP Ortu",
      "Kelompok Sambung",
      "Desa Sambung",
      "Daerah",
    ];

    const rows = filteredStudents.map((s) => [
      s.id || "",
      s.kategori,
      s.status || "Aktif",
      `"${s.nama_lengkap.replace(/"/g, '""')}"`,
      `"${s.nama_panggilan.replace(/"/g, '""')}"`,
      `'${s.nik}`,
      s.nisn ? `'${s.nisn}` : "",
      s.npsn ? `'${s.npsn}` : "",
      s.tempat_lahir,
      s.tanggal_lahir,
      `"${s.alamat.replace(/"/g, '""')}"`,
      s.rt,
      s.rw,
      s.desa_kelurahan,
      s.kecamatan,
      s.kabupaten_kota,
      s.provinsi,
      `"${s.nama_ayah.replace(/"/g, '""')}"`,
      `"${s.nama_ibu.replace(/"/g, '""')}"`,
      `"${(s.no_hp_ortu || "").replace(/"/g, '""')}"`,
      `"${s.kelompok_sambung.replace(/"/g, '""')}"`,
      `"${s.desa_sambung.replace(/"/g, '""')}"`,
      s.daerah,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `data_santri_pesantren_digital_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteClick = (student: SantriData) => {
    setDeleteConfirmTarget(student);
  };

  const confirmDelete = async () => {
    if (deleteConfirmTarget) {
      setIsDeleting(true);
      try {
        await onDelete(deleteConfirmTarget.id || 0, deleteConfirmTarget);
      } catch (err) {
        console.error("Gagal menghapus santri:", err);
      } finally {
        setIsDeleting(false);
        setDeleteConfirmTarget(null);
      }
    }
  };

  const handlePrint = () => {
    const isFormulir = previewTab === "formulir";
    const printId = isFormulir ? "printable-formulir-id" : "printable-card-id";
    const printContent = document.getElementById(printId);
    if (!printContent) return;

    const printStyle = isFormulir ? `
      <style>
        body { 
          background: white !important; 
          font-family: 'Inter', sans-serif; 
          padding: 30px; 
          margin: 0; 
          color: black !important;
        }
        .text-center { text-align: center !important; }
        .flex { display: flex !important; }
        .flex-col { flex-direction: column !important; }
        .flex-row { flex-direction: row !important; }
        .grid { display: grid !important; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .gap-x-8 { column-gap: 2rem !important; }
        .gap-y-2 { row-gap: 0.5rem !important; }
        .gap-y-1.5 { row-gap: 0.375rem !important; }
        .text-xs { font-size: 11px !important; }
        .text-sm { font-size: 13px !important; }
        .font-normal { font-weight: 400 !important; }
        .font-semibold { font-weight: 600 !important; }
        .font-bold { font-weight: 700 !important; }
        .font-extrabold { font-weight: 800 !important; }
        .border-b { border-bottom-width: 1px !important; }
        .border-dotted { border-style: dotted !important; }
        .border-slate-200 { border-color: #cbd5e1 !important; }
        .pb-1 { padding-bottom: 0.25rem !important; }
        .pb-1.5 { padding-bottom: 0.375rem !important; }
        .text-slate-500 { color: #64748b !important; }
        .text-slate-900 { color: #0f172a !important; }
        .mb-1.5 { margin-bottom: 0.375rem !important; }
        .w-32 { width: 8rem !important; }
        .bg-[#104e7a] { 
          background-color: #104e7a !important; 
          color: white !important;
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact;
        }
        .print-no-shadow { box-shadow: none !important; border: none !important; }
      </style>
    ` : `
      <style>
        body { background: white !important; font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .no-print { display: none !important; }
        .card-print-wrap { border: 2px solid #0284c7; border-radius: 16px; padding: 24px; min-width: 500px; box-shadow: none !important; color: black !important; }
        .sky-banner { background-color: #0284c7 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${isFormulir ? "Formulir_Santri_" : "Kartu_Santri_"}${selectedStudent?.nama_lengkap}</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            ${printStyle}
          </head>
          <body>
            <div class="${isFormulir ? "print-no-shadow" : "card-print-wrap"}">
              ${printContent.innerHTML}
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-4" id="santri_list_section">
      {/* Search & Filter Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama, NIK, NISN, atau NPSN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded bg-slate-50 border border-slate-200 focus:border-sky-500 focus:outline-none transition-all duration-150 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center bg-slate-50 rounded px-2.5 py-1 border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-transparent border-none text-[11px] font-semibold focus:outline-none text-slate-700 cursor-pointer"
              >
                <option value="All">Kategori: Semua</option>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
                <option value="Reguler">Reguler</option>
              </select>
            </div>

             {/* Daerah Filter */}
            <div className="flex items-center bg-slate-50 rounded px-2.5 py-1 border border-slate-200">
              <MapPin className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
              <select
                value={filterDaerah}
                onChange={(e) => setFilterDaerah(e.target.value)}
                className="bg-transparent border-none text-[11px] font-semibold focus:outline-none text-slate-700 cursor-pointer"
              >
                <option value="All">Daerah: Semua</option>
                {uniqueDaerah.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-slate-50 rounded px-2.5 py-1 border border-slate-200">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent border-none text-[11px] font-semibold focus:outline-none text-slate-700 cursor-pointer"
              >
                <option value="All">Status: Semua</option>
                <option value="Aktif">🟢 Aktif</option>
                <option value="Sakit">🟡 Sakit</option>
                <option value="Pulang">🔴 Pulang</option>
                <option value="Haid">🩷 Haid</option>
              </select>
            </div>

            {/* Export To Excel/CSV */}
            <button
              onClick={exportToCSV}
              disabled={filteredStudents.length === 0}
              className="bg-sky-600 hover:bg-sky-700 active:scale-98 transition-all text-white text-[11px] font-bold px-3 py-2 rounded flex items-center gap-1 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              id="export-csv-btn"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor CSV
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-450 font-medium px-1">
          <span>Menampilkan <strong className="text-slate-800">{filteredStudents.length}</strong> dari <strong className="text-slate-805">{students.length}</strong> santri terdaftarkan</span>
          {searchQuery || filterCategory !== "All" || filterDaerah !== "All" || filterStatus !== "All" ? (
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterCategory("All");
                setFilterDaerah("All");
                setFilterStatus("All");
              }}
              className="text-sky-600 hover:underline font-bold text-[11px]"
            >
              Reset Filter
            </button>
          ) : null}
        </div>
      </div>

      {/* High-Fidelity Table View inspired by Mockup Design */}
      {students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm space-y-4 max-w-xl mx-auto my-8 animate-fade-in" id="empty-database-instructions">
          <div className="mx-auto w-16 h-16 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100 shadow-sm">
            <Database className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-slate-900 text-base md:text-lg">Koneksi Berhasil, Data Masih Kosong</h3>
            <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
              Berhasil menghubungkan ke database Supabase Anda, namun tabel <code className="font-mono bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-800">santri</code> belum memiliki baris data atau record apa pun. Silakan tambahkan santri baru atau gunakan data simulasi offline!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <span className="text-xs text-slate-500 font-bold block w-full mb-1">
              Solusi Cepat:
            </span>
            <div className="p-3.5 bg-slate-50 border rounded-xl text-left w-full text-[11px] text-slate-600 leading-normal mb-1">
              💡 <strong>Ingin menguji sistem sekarang?</strong> Buka tab <strong>Koneksi Cloud</strong> pada menu samping dan klik tombol <strong>"Masukkan 4 Data Demo"</strong>, atau isi formulir di menu <strong>Pendaftaran Baru</strong> untuk menyimpannya di database Anda!
            </div>
          </div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-200">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-tight">Tidak Menemukan Data Santri</h3>
            <p className="text-slate-500 text-[11px] max-w-sm mx-auto mt-0.5">
              Sesuaikan kata kunci pencarian atau filter Anda, atau tambahkan santri baru dengan formulir digital pendaftaran.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="santri-table-container">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[1100px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase bg-slate-50/50 select-none tracking-wider">
                  <th className="p-4 py-3.5 pl-6">NAMA LENGKAP</th>
                  <th className="p-4 py-3.5">KAMAR & PENGAJIAN</th>
                  <th className="p-4 py-3.5">KATEGORI</th>
                  <th className="p-4 py-3.5">ALAMAT SAMBUNG</th>
                  <th className="p-4 py-3.5">STATUS</th>
                  <th className="p-4 py-3.5">JENIS KELAMIN</th>
                  <th className="p-4 py-3.5 text-right pr-6 w-52">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredStudents.map((s) => {
                  const studentGender = s.jenis_kelamin || inferGender(s.nama_lengkap);
                  const isPulang = (s.status || "Aktif") === "Pulang";
                  const isSakit = (s.status || "Aktif") === "Sakit";
                  const isHaid = (s.status || "Aktif") === "Haid";

                  // Dynamic row bg style matching the mockup's colored rows for different statuses
                  let rowBgClass = "bg-white hover:bg-slate-50/30";
                  if (isPulang) {
                    rowBgClass = "bg-[#FFF5F7] hover:bg-[#FDF2F4] transition-colors duration-150";
                  } else if (isHaid) {
                    rowBgClass = "bg-[#FFF0F5] hover:bg-[#FFEBFA] transition-colors duration-150";
                  } else if (isSakit) {
                    rowBgClass = "bg-[#FFFDF5] hover:bg-[#FFFDF0] transition-colors duration-150";
                  }

                  return (
                    <tr 
                      key={s.id || s.nik} 
                      className={`${rowBgClass} transition-colors duration-150 group`}
                    >
                      {/* Name with circular avatar */}
                      <td className="p-4 py-3 pl-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {/* Circle Profile Avatar */}
                          <div className={`w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center select-none shadow-sm transition-transform duration-150 group-hover:scale-105 ${
                            studentGender === "P" 
                              ? "bg-rose-100/70 border border-rose-200 text-rose-500" 
                              : "bg-sky-100/70 border border-sky-200 text-sky-500"
                          }`}>
                            {s.foto ? (
                              <img src={s.foto} alt="" className="w-full h-full object-cover" />
                            ) : studentGender === "P" ? (
                              <span className="text-base filter saturate-100 drop-shadow">🧕</span>
                            ) : (
                              <span className="text-base filter saturate-100 drop-shadow">👳</span>
                            )}
                          </div>

                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 text-sm tracking-tight leading-snug">
                              {s.nama_lengkap}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono tracking-wider font-medium mt-0.5">
                              {(s.kategori === "Reguler" ? s.npsn : s.nisn) || s.nik || "No ID"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kamar & Pengajian (representing policy amount / description) */}
                      <td className="p-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-xs">
                            {s.kamar ? `🛏️ ${s.kamar}` : <span className="text-slate-400 font-normal">Belum Set Kamar</span>}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {s.kelas_pengajian ? `📖 ${s.kelas_pengajian}` : "Tanpa Kelas Ngaji"}
                          </span>
                        </div>
                      </td>

                      {/* Policy Status (representing Kategori with dot indicator) */}
                      <td className="p-4 py-3 whitespace-nowrap">
                        <div className="flex items-center animate-fade-in">
                          {s.kategori === "SMP" && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                              <span className="text-emerald-650 font-semibold text-xs uppercase">SMP</span>
                            </>
                          )}
                          {s.kategori === "SMA" && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></span>
                              <span className="text-blue-650 font-semibold text-xs uppercase">SMA</span>
                            </>
                          )}
                          {s.kategori === "Reguler" && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
                              <span className="text-amber-650 font-semibold text-xs uppercase">Reguler</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Destination (Alamat Sambung) */}
                      <td className="p-4 py-3 max-w-xs truncate whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700 text-xs">{s.kelompok_sambung || "-"}</span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">{s.daerah || "-"}</span>
                        </div>
                      </td>

                      {/* Status Santri (Interactive Dropdown Indicator) */}
                      <td className="p-4 py-3 whitespace-nowrap">
                        <div className="relative group/status rounded-full inline-block" title="Ubah status">
                          <select
                            value={s.status || "Aktif"}
                            onChange={(e) => {
                               if (s.id || s.nik) onUpdateStatus(s.id || s.nik, e.target.value as any);
                            }}
                            className={`appearance-none font-extrabold text-[11px] uppercase tracking-wider py-1.5 pl-6 pr-7 rounded-full border outline-none cursor-pointer transition-all shadow-sm ${
                              (s.status || "Aktif") === "Haid"
                                ? "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100 focus:ring-2 focus:ring-pink-500/30"
                                : (s.status || "Aktif") === "Sakit"
                                ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 focus:ring-2 focus:ring-amber-500/30"
                                : (s.status || "Aktif") === "Pulang"
                                ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 focus:ring-2 focus:ring-rose-500/30"
                                : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 focus:ring-2 focus:ring-emerald-500/30"
                            }`}
                          >
                            <option value="Aktif" className="font-semibold text-emerald-700 bg-white">Aktif</option>
                            <option value="Sakit" className="font-semibold text-amber-700 bg-white">Sakit</option>
                            <option value="Pulang" className="font-semibold text-rose-700 bg-white">Pulang</option>
                            {studentGender === "P" && <option value="Haid" className="font-semibold text-pink-700 bg-white">Haid</option>}
                          </select>
                          
                          {/* Custom Dot Layer */}
                          <div className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shadow-sm pointer-events-none ${
                            (s.status || "Aktif") === "Haid" ? "bg-pink-500" : (s.status || "Aktif") === "Sakit" ? "bg-amber-500" : (s.status || "Aktif") === "Pulang" ? "bg-rose-500" : "bg-emerald-500"
                          }`}></div>
                          
                          {/* Dropdown Arrow Indicator */}
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center opacity-70 group-hover/status:opacity-100 transition-opacity">
                            <svg className={`w-3 h-3 ${
                              (s.status || "Aktif") === "Haid" ? "text-pink-500" : (s.status || "Aktif") === "Sakit" ? "text-amber-500" : (s.status || "Aktif") === "Pulang" ? "text-rose-500" : "text-emerald-500"
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                          </div>
                        </div>
                      </td>

                      {/* Progress (representing L/P with elegant colorful dots and text status like in the mockup) */}
                      <td className="p-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {studentGender === "P" ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2"></span>
                              <span className="text-rose-500 font-semibold text-xs">Perempuan</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-2"></span>
                              <span className="text-sky-600 font-semibold text-xs">Laki-laki</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Right Controls - Modern mockup circles */}
                      <td className="p-4 py-3 whitespace-nowrap text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview Print digital card */}
                          <button
                            onClick={() => {
                              setSelectedStudent(s);
                              setPreviewTab("formulir");
                              setShowCardModal(true);
                            }}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-650 hover:bg-indigo-50/50 rounded-full transition-all cursor-pointer"
                            title="Pratinjau Kartu"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedStudent(s);
                              setPreviewTab("formulir");
                              setTimeout(() => {
                                handlePrint();
                              }, 110);
                            }}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-sky-650 hover:bg-sky-50/50 rounded-full transition-all cursor-pointer"
                            title="Cetak Kartu"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* 1. Edit Elegant light cyan circle with dark blue pen */}
                          {currentUserRole !== "guru_sekolah" && (
                            <button
                              onClick={() => onEdit(s)}
                              className="w-8 h-8 flex items-center justify-center bg-[#E6F4FA] hover:bg-[#d0edfa] text-[#00a5ec] rounded-full transition-all cursor-pointer shadow-sm shadow-sky-100"
                              title="Ubah Data"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* 2. Trash bin */}
                          {currentUserRole !== "guru_sekolah" && (
                            <button
                              onClick={() => handleDeleteClick(s)}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50/55 rounded-full transition-all cursor-pointer"
                              title="Hapus Data"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1. DELETE CONFIRMATION MODAL */}
      {deleteConfirmTarget !== null && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500/75 transition-opacity" aria-hidden="true" onClick={() => setDeleteConfirmTarget(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-50 text-red-600 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">Hapus Data Santri</h3>
                    <div className="mt-2 text-sm text-gray-500 space-y-1">
                      <p>
                        Apakah Anda yakin ingin menghapus data santri <strong className="text-slate-900">{deleteConfirmTarget.nama_lengkap}</strong> {deleteConfirmTarget.nik ? `(NIK: ${deleteConfirmTarget.nik})` : ""} secara permanen dari database pesantren?
                      </p>
                      <p className="text-red-600 text-xs font-semibold mt-1">
                        Tindakan ini tidak dapat dibatalkan.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2.5 bg-red-600 text-base font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? "Menghapus..." : "Ya, Hapus Permanen"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:w-auto sm:text-sm cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. KARTU DIGITAL SANTRI PREVIEW & CETAK MODAL */}
      {showCardModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 transition-opacity" onClick={() => setShowCardModal(false)}></div>
          <div className="relative bg-white rounded-3xl text-left shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-sky-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-sky-300" /> Pratinjau Dokumen Santri
              </h3>
              <button
                onClick={() => setShowCardModal(false)}
                className="text-sky-200 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs inside Modal */}
            <div className="flex border-b border-gray-200 bg-white px-6 shrink-0">
              <button
                onClick={() => setPreviewTab("formulir")}
                className={`py-3 px-5 font-bold text-xs md:text-sm border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewTab === "formulir"
                    ? "border-sky-600 text-sky-600 font-black"
                    : "border-transparent text-gray-500 hover:text-gray-750"
                }`}
              >
                <FileText className="w-4 h-4" /> Pratinjau Formulir Data Pribadi
              </button>
              <button
                onClick={() => setPreviewTab("card")}
                className={`py-3 px-5 font-bold text-xs md:text-sm border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewTab === "card"
                    ? "border-sky-600 text-sky-600 font-black"
                    : "border-transparent text-gray-500 hover:text-gray-750"
                }`}
              >
                <Award className="w-4 h-4" /> Smart Card Digital
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-8 bg-slate-100 flex flex-col items-center justify-start flex-1 overflow-y-auto w-full">
                {previewTab === "formulir" ? (
                  /* TAB 1: FORMULIR DATA PRIBADI SANTRI */
                  <div className="w-full max-w-[800px] bg-white border border-gray-200 rounded-xl shadow-lg p-5 md:p-8 shrink-0" id="printable-formulir-id">
                    {/* Header / Kop Pondok Pesantren */}
                    <div className="flex flex-row items-center gap-4 pb-4 border-b-4 border-black">
                      {/* Logo */}
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center shadow-inner shrink-0">
                        <span className="text-3xl md:text-4xl">🕌</span>
                       </div>
                      {/* Kop text */}
                      <div className="flex-1 text-center md:pr-10">
                        <h2 className="text-[#104e7a] text-[16px] md:text-[20px] font-extrabold tracking-tight font-serif uppercase leading-tight select-none">
                          Pondok Pesantren Al Muttaqin Kota Madiun
                        </h2>
                        <p className="text-[10px] md:text-[11px] text-gray-650 font-medium tracking-wide mt-1">
                          Jl.Nogososro No.26, RT 11/RW 4, Josenan, Taman, Kota Madiun, Jawa Timur
                        </p>
                        <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5">
                          Telepon: 085785028124
                        </p>
                      </div>
                    </div>

                    {/* Document Title section */}
                    <div className="text-center mt-5 mb-6">
                      <h3 className="text-[#104e7a] text-sm md:text-base font-extrabold tracking-widest underline uppercase">
                        Formulir Data Pribadi Santri
                      </h3>
                      <p className="text-[10px] text-gray-500 font-semibold mt-1">
                        Nomor Induk: {selectedStudent.nisn || selectedStudent.npsn || "2509088" + String(selectedStudent.id || "").padStart(3, "0")} | Tahun Ajaran 2026/2027
                      </p>
                    </div>

                    {/* Personal core profile and passport photo */}
                    {(() => {
                      const isFemale = (selectedStudent.jenis_kelamin || inferGender(selectedStudent.nama_lengkap)) === "P";
                      
                      const renderFormRow = (label: string, value: string | undefined | null) => (
                        <div className="flex items-baseline text-[11px] md:text-xs py-1 hover:bg-slate-50 border-b border-dotted border-gray-200">
                          <span className="w-32 md:w-36 text-gray-500 font-medium shrink-0">{label}</span>
                          <span className="mr-2 text-gray-400 font-bold">:</span>
                          <span className="font-extrabold text-slate-800 flex-1 whitespace-pre-wrap">{value || "—"}</span>
                        </div>
                      );

                      return (
                        <div className="space-y-6">
                          {/* Top row with photo */}
                          <div className="flex flex-col md:flex-row gap-6 items-start">
                            {/* Photo (Red background for authentic Indonesian passphoto aspect) */}
                            <div className="flex flex-col items-center gap-1 shrink-0 self-center md:self-start">
                              <div className="w-[110px] h-[145px] bg-[#c22026] rounded border border-gray-300 shadow-sm flex items-center justify-center overflow-hidden relative">
                                {selectedStudent.foto ? (
                                  <img src={selectedStudent.foto} alt="Foto Santri" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-5xl filter saturate-75 drop-shadow-md select-none">
                                    {isFemale ? "🧕" : "👳"}
                                  </span>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-black/40 text-[7px] text-white py-1 font-bold tracking-widest text-center uppercase">
                                  PASFOTO
                                </div>
                              </div>
                              <span className="text-[8px] font-mono font-bold text-gray-400 uppercase tracking-widest">3x4 Resmi</span>
                            </div>

                            {/* A. DATA SISWA list */}
                            <div className="flex-1 w-full space-y-0.5">
                              {renderFormRow("Nama Lengkap", selectedStudent.nama_lengkap)}
                              {renderFormRow("Nama Panggilan", selectedStudent.nama_panggilan)}
                              {renderFormRow("Jenis Kelamin", isFemale ? "Perempuan" : "Laki-laki")}
                              {renderFormRow("Tempat, Tgl Lahir", `${selectedStudent.tempat_lahir}, ${selectedStudent.tanggal_lahir ? formatIndoDate(selectedStudent.tanggal_lahir) : "—"}`)}
                              {renderFormRow("Kategori Data", selectedStudent.kategori)}
                              {renderFormRow("NIK", selectedStudent.nik)}
                              {renderFormRow(selectedStudent.kategori === "Reguler" ? "NPSN" : "NISN", selectedStudent.kategori === "Reguler" ? selectedStudent.npsn : selectedStudent.nisn)}
                            </div>
                          </div>

                          {/* B. STATUS PENDIDIKAN & ASRAMA */}
                          <div>
                            <div className="bg-[#104e7a] text-white py-1.5 px-3 rounded flex items-center gap-2 text-[11px] md:text-xs font-bold shadow-sm mb-3">
                              <GraduationCap className="w-4 h-4 text-sky-200" />
                              <span>B. STATUS PENDIDIKAN & ASRAMA</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5">
                              <div>
                                {renderFormRow("Kamar", selectedStudent.kamar)}
                                {renderFormRow("Status", selectedStudent.status || "Aktif")}
                              </div>
                              <div>
                                {renderFormRow("Kelas Pengajian", selectedStudent.kelas_pengajian)}
                                {renderFormRow("Kelas Sekolah", selectedStudent.kelas_sekolah)}
                              </div>
                            </div>
                          </div>

                          {/* C. ALAMAT LENGKAP */}
                          <div>
                            <div className="bg-[#104e7a] text-white py-1.5 px-3 rounded flex items-center gap-2 text-[11px] md:text-xs font-bold shadow-sm mb-3">
                              <Home className="w-4 h-4 text-sky-200" />
                              <span>C. ALAMAT LENGKAP</span>
                            </div>
                            <div className="space-y-0.5">
                              {renderFormRow("Alamat Lengkap", selectedStudent.alamat)}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5 mt-0.5">
                              <div>
                                {renderFormRow("RT / RW", `${selectedStudent.rt || "—"} / ${selectedStudent.rw || "—"}`)}
                                {renderFormRow("Desa/Kelurahan", selectedStudent.desa_kelurahan)}
                              </div>
                              <div>
                                {renderFormRow("Kecamatan", selectedStudent.kecamatan)}
                                {renderFormRow("Kab./Kota", selectedStudent.kabupaten_kota)}
                                {renderFormRow("Provinsi", selectedStudent.provinsi)}
                              </div>
                            </div>
                          </div>
                          
                          {/* D. ALAMAT SAMBUNG */}
                          <div>
                            <div className="bg-[#104e7a] text-white py-1.5 px-3 rounded flex items-center gap-2 text-[11px] md:text-xs font-bold shadow-sm mb-3">
                              <MapPin className="w-4 h-4 text-sky-200" />
                              <span>D. ALAMAT SAMBUNG</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5">
                              <div>
                                {renderFormRow("Kelompok Sambung", selectedStudent.kelompok_sambung)}
                                {renderFormRow("Daerah", selectedStudent.daerah)}
                              </div>
                              <div>
                                {renderFormRow("Desa Sambung", selectedStudent.desa_sambung)}
                              </div>
                            </div>
                          </div>

                          {/* E. ORANG TUA */}
                          <div>
                            <div className="bg-[#104e7a] text-white py-1.5 px-3 rounded flex items-center gap-2 text-[11px] md:text-xs font-bold shadow-sm mb-2">
                              <Users className="w-4 h-4 text-sky-200" />
                              <span>E. ORANG TUA & WA</span>
                            </div>
                            <div className="grid grid-cols-1 gap-y-0.5">
                              {renderFormRow("Nama Ayah", selectedStudent.nama_ayah)}
                              {renderFormRow("Nama Ibu", selectedStudent.nama_ibu)}
                              {renderFormRow("No. WA Ortu", selectedStudent.no_hp_ortu || "-")}
                            </div>
                          </div>

                          {/* Cursive italic fine footer styling */}
                          <div className="text-right text-[9px] text-gray-400 italic pt-6 border-t border-gray-100 select-none">
                            Dicetak pada tanggal: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* TAB 2: SMART CARD PREVIEW */
                  <div className="w-full flex flex-col items-center">
                    {/* ID SMART CARD WRAPPER */}
                    <div
                      id="printable-card-id"
                      className="w-full max-w-[500px] bg-white rounded-2xl shadow-xl border border-gray-250/70 overflow-hidden relative"
                    >
                      {/* Decorative Islamic Background Elements */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50/40 rounded-full blur-2xl -z-1 pointer-events-none"></div>
                      
                      {/* Card Header (Islamic Boarding Identity) */}
                      <div className="sky-banner bg-[#91d1fa] px-6 py-4 flex items-center justify-between text-[#041e49] border-b border-[#73baeb]/60">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-white/60 border border-[#041e49]/15 flex items-center justify-center shadow-inner">
                            <span className="font-serif text-white font-black text-sm">🕌</span>
                          </div>
                          <div>
                            <h4 className="font-serif font-black tracking-wider text-sm select-none">AL-MUTTAQIN</h4>
                            <p className="text-[9px] text-[#041e49]/80 uppercase font-mono tracking-widest font-black leading-none">Pondok Pesantren Digital</p>
                          </div>
                        </div>
                        <span className="bg-[#041e49]/10 border border-[#041e49]/20 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest text-[#041e49]">
                          Smart Card
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="p-6 grid grid-cols-12 gap-5 relative z-10 bg-white">
                        {/* Portrait Placeholder */}
                        <div className="col-span-4 flex flex-col items-center space-y-1.5 pt-1">
                          <div className="w-28 h-36 bg-gray-50 border-2 border-sky-700/25 rounded-md flex flex-col items-center justify-center text-center p-3 relative overflow-hidden group/pic">
                            {selectedStudent.foto ? (
                              <img src={selectedStudent.foto} alt="Foto Santri" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <span className="text-3xl filter saturate-50">
                                {(selectedStudent.jenis_kelamin || inferGender(selectedStudent.nama_lengkap)) === "P" ? "🧕" : "👳"}
                              </span>
                            )}
                            <div className="absolute inset-x-0 bottom-0 py-1 bg-sky-700/90 text-[8px] text-sky-100 font-black tracking-wider uppercase">
                              STUDENT
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-gray-400">PASFOTO</span>
                        </div>

                        {/* Santri Data Profile information */}
                        <div className="col-span-8 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div>
                              <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Nama Lengkap</span>
                              <span className="font-extrabold text-gray-900 text-sm">{selectedStudent.nama_lengkap}</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Kategori</span>
                                <span className="font-bold text-[10px] text-sky-850 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded w-fit block mt-0.5">
                                  {selectedStudent.kategori}
                                </span>
                              </div>

                              <div>
                                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Status</span>
                                <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded border block w-fit mt-0.5 ${
                                  (selectedStudent.status || "Aktif") === "Haid"
                                    ? "bg-pink-50 text-pink-700 border-pink-200"
                                    : (selectedStudent.status || "Aktif") === "Sakit"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : (selectedStudent.status || "Aktif") === "Pulang"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}>
                                  {(selectedStudent.status || "Aktif") === "Haid" ? "🩷 Haid" : (selectedStudent.status || "Aktif") === "Sakit" ? "🟡 Sakit" : (selectedStudent.status || "Aktif") === "Pulang" ? "🔴 Pulang" : "🟢 Aktif"}
                                </span>
                              </div>

                              <div>
                                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                                  {selectedStudent.kategori === "Reguler" ? "NPSN" : "NISN"}
                                </span>
                                <span className="font-mono text-xs font-bold text-gray-800 block mt-0.5">
                                  {selectedStudent.kategori === "Reguler" ? selectedStudent.npsn : selectedStudent.nisn}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">NIK Santri</span>
                                <span className="font-mono text-xs text-gray-700">{selectedStudent.nik}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Daerah</span>
                                <span className="text-xs font-bold text-gray-850 mt-0.5 block truncate">{selectedStudent.daerah}</span>
                              </div>
                            </div>

                            <div>
                              <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Kelompok Sambung</span>
                              <span className="text-xs text-gray-600 block">{selectedStudent.kelompok_sambung} - {selectedStudent.desa_sambung}</span>
                            </div>

                            {/* Custom placement display */}
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 mt-2">
                              <div>
                                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Kamar Asrama</span>
                                <span className="text-[11px] font-bold text-slate-800 block mt-0.5">
                                  🛏️ {selectedStudent.kamar || "Belum Set"}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Diniyah / Ngaji</span>
                                <span className="text-[11px] font-bold text-slate-800 block mt-0.5 truncate" title={selectedStudent.kelas_pengajian || "Belum Set"}>
                                  📖 {selectedStudent.kelas_pengajian || "Belum Set"}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-gray-400 font-bold uppercase tracking-widest">Sekolah Formal</span>
                                <span className="text-[11px] font-bold text-slate-800 block mt-0.5 truncate" title={selectedStudent.kelas_sekolah || "Belum Set"}>
                                  🏫 {selectedStudent.kelas_sekolah || "Belum Set"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="bg-sky-900 px-6 py-3 border-t border-gray-150 flex items-center justify-between text-[8px] text-sky-100/70 select-none">
                        <span className="font-sans">Tanggal Berdiri: 2026-05-20</span>
                        <span className="font-serif italic font-bold">Terpercaya & Berakhlakul Karimah</span>
                      </div>
                    </div>

                    {/* Petunjuk Kustomisasi Foto Bawaan / Upload */}
                    <div className="mt-5 w-full max-w-[500px] bg-sky-50 border border-sky-200 rounded-xl p-4 text-left text-xs text-sky-950 space-y-2">
                      <h5 className="font-bold flex items-center gap-1 text-sky-850 text-[11px]">
                        💡 Panduan Upload / Ganti Foto & Aset Visual Unit:
                      </h5>
                      <ul className="list-disc list-inside space-y-1.5 text-sky-900 leading-relaxed text-[10px]">
                        <li><strong>Logo Pesantren (Digital)</strong>: Anda dapat menyalin file logo asli pesantren milik Anda ke <code className="bg-sky-100 px-1 rounded font-mono">/src/assets/logo.png</code> atau menggunakan URL gambar statis online dengan mengganti ikon masjid <code className="bg-sky-100 px-1 text-sky-800 rounded">🕌</code> di atas menjadi tag <code className="bg-sky-100 px-1 rounded font-mono">&lt;img src="https://link-logo-anda.com/logo.png" className="w-9 h-9" /&gt;</code>.</li>
                        <li><strong>Background Kartu & Aplikasi</strong>: Sistem menggunakan warna flat <code className="bg-sky-100 px-1 rounded font-mono">bg-sky-900</code>. Anda bisa menyematkan latar visual bertekstur islami kustom dengan menyalin gambar latar lalu mengakses styling <code className="bg-sky-100 px-1 rounded font-mono">style={`{{ backgroundImage: 'url(/bg-pondok.jpg)' }}`}</code> di wrapper kartu.</li>
                        <li><strong>Pasfoto Asli Santri</strong>: Profil memakai representasi emoji <code className="bg-sky-100 px-1 rounded font-mono">👳</code>. Anda bisa me-link foto santri jika Anda mengunggah pasfoto ke penyimpanan cloud Supabase Storage bucket, kemudian ditarik melalui field baru <code className="bg-sky-100 px-1 rounded font-mono">foto_url</code> di database.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Print Guidance */}
                <p className="text-[10px] text-gray-500 mt-4 max-w-sm text-center leading-relaxed font-medium select-none">
                  Gunakan tombol cetak di bawah ini untuk mencetak dokumen/kartu langsung ke kertas fisik atau file PDF.
                </p>
              </div>

              {/* Modal Footer Controls */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3.5 border-t border-gray-150 shrink-0">
                <button
                  onClick={() => setShowCardModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-250 text-sm font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={handlePrint}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Cetak {previewTab === "formulir" ? "Formulir Santri" : "Kartu Santri"}
                </button>
              </div>

            </div>
        </div>
      )}

    </div>
  );
}
