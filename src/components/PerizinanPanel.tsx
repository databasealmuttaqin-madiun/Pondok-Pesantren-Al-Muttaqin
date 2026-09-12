import React, { useState, useEffect, useRef, useMemo } from "react";
import { SantriData, supabase } from "../supabaseClient";
import { 
  UserCheck, 
  RefreshCw, 
  Calendar, 
  Search, 
  CheckCircle2, 
  Database,
  FileText,
  Clock,
  HeartPulse,
  Droplets,
  Footprints,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Copy,
  CheckCheck,
  Filter,
  X,
  Phone,
  User,
  Home,
  ChevronDown,
  ChevronRight,
  Download,
  CreditCard,
  Radio,
  Lock
} from "lucide-react";
import { SearchableSelect } from "./ui/SearchableSelect";

export type SubMenuPerizinan = "sakit" | "sambang" | "haid";

export interface PerizinanItem {
  id: number;
  siswa_id?: number | null;
  nama_siswa: string;
  jenis_kelamin: "L" | "P" | string;
  kamar?: string;
  kategori_izin: "sakit" | "sambang" | "haid";
  keperluan?: string;
  tujuan?: string;
  diagnosa_keluhan?: string;
  lokasi_rawat?: string;
  penjemput?: string;
  no_hp_penjemput?: string;
  tanggal_mulai: string;
  jam_mulai?: string;
  tanggal_selesai?: string;
  jam_selesai?: string;
  tanggal_kembali?: string | null;
  status: string; // 'Sedang Berlangsung' | 'Sedang Sambang' | 'Sedang Sakit' | 'Sedang Haid' | 'Sudah Kembali' | 'Sudah Sembuh' | 'Sudah Suci'
  petugas?: string;
  catatan?: string;
  created_at?: string;
}

// Helper untuk mengekstrak Tujuan secara bersih
export const getItemTujuan = (item: PerizinanItem): string => {
  if (item.tujuan && item.tujuan.trim()) {
    return item.tujuan.trim();
  }
  // Cek jika tersimpan dalam format "... (Tujuan: XYZ)" pada kolom keperluan
  if (item.keperluan) {
    const match = item.keperluan.match(/\(Tujuan:\s*([^)]+)\)/i);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  }
  // Cek jika tersimpan pada kolom penjemput dalam format "Tujuan | Wali: ..."
  if (item.penjemput) {
    const parts = item.penjemput.split("|");
    if (parts[0] && parts[0].trim() && !parts[0].toLowerCase().includes("wali:")) {
      return parts[0].trim();
    }
  }
  return "—";
};

// Helper untuk mengekstrak Keperluan secara bersih (terpisah dari tujuan)
export const getItemKeperluan = (item: PerizinanItem): string => {
  if (!item.keperluan || !item.keperluan.trim()) {
    return "Sambang / Kunjungan";
  }
  // Hapus bagian (Tujuan: ...) jika ada agar keperluan berdiri sendiri
  const cleaned = item.keperluan.replace(/\s*\(Tujuan:[^)]+\)/gi, "").trim();
  return cleaned || item.keperluan;
};

interface PerizinanPanelProps {
  students: SantriData[];
  rooms: string[];
  onRefreshAll: () => Promise<void>;
  onTriggerNotification: (message: string, type: "success" | "error" | "warning") => void;
  initialSubMenu?: SubMenuPerizinan;
  onSubMenuChange?: (sub: SubMenuPerizinan) => void;
  currentUserName?: string;
}

export default function PerizinanPanel({
  students,
  rooms,
  onRefreshAll,
  onTriggerNotification,
  initialSubMenu = "sambang",
  onSubMenuChange,
  currentUserName = "Petugas"
}: PerizinanPanelProps) {
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenuPerizinan>(initialSubMenu);
  const [items, setItems] = useState<PerizinanItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKamar, setFilterKamar] = useState("All");
  const [filterGender, setFilterGender] = useState("All");
  const [filterKategoriSub, setFilterKategoriSub] = useState("All");
  const [filterDaerah, setFilterDaerah] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  
  // Modal State for New Input
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form Inputs (Sesuaikan dengan Form Sambang & Sakit)
  const [formKamar, setFormKamar] = useState("");
  const [formStudent, setFormStudent] = useState<SantriData | null>(null);
  const [formTglMulai, setFormTglMulai] = useState(new Date().toISOString().split("T")[0]);
  const [formJamMulai, setFormJamMulai] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [formTglSelesai, setFormTglSelesai] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [formJamSelesai, setFormJamSelesai] = useState("17:00");
  const [formTujuan, setFormTujuan] = useState("");
  const [formKeperluan, setFormKeperluan] = useState("");
  const [formDurasiSambang, setFormDurasiSambang] = useState<number>(1);
  const [formPenjemput, setFormPenjemput] = useState("");
  const [formNoHp, setFormNoHp] = useState("");
  const [formHubunganWali, setFormHubunganWali] = useState("Ayah");
  const [formSudahKonfirmasi, setFormSudahKonfirmasi] = useState(false);
  const [formDiagnosa, setFormDiagnosa] = useState("");
  const [formLokasiRawat, setFormLokasiRawat] = useState("Kamar Santri");
  const [formCatatan, setFormCatatan] = useState("");

  // State pencarian & Tap Kartu RFID Santri
  const [formSearchSantri, setFormSearchSantri] = useState("");
  const [isSantriDropdownOpen, setIsSantriDropdownOpen] = useState(false);
  const [cardScannedSuccess, setCardScannedSuccess] = useState<string | null>(null);
  const santriInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Helper pilih santri & otomatis isi kamar & info wali
  const handleSelectStudent = (student: SantriData | null) => {
    setFormStudent(student);
    if (student) {
      setFormKamar(student.kamar || "");
      if (student.no_hp_ortu) {
        setFormNoHp(student.no_hp_ortu);
      }
      if (student.nama_ayah) {
        setFormHubunganWali("Ayah");
        setFormPenjemput(student.nama_ayah);
      } else if (student.nama_ibu) {
        setFormHubunganWali("Ibu");
        setFormPenjemput(student.nama_ibu);
      }
      setFormSearchSantri(student.nama_lengkap);
      setIsSantriDropdownOpen(false);
    } else {
      setFormKamar("");
      setFormSearchSantri("");
    }
  };

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        santriInputRef.current &&
        !santriInputRef.current.contains(e.target as Node)
      ) {
        setIsSantriDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global RFID/Barcode card tap listener saat modal terbuka
  useEffect(() => {
    if (!isModalOpen) return;
    let scanBuffer = "";
    let lastKeyTime = 0;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyTime > 120) {
        scanBuffer = "";
      }
      lastKeyTime = now;

      if (e.key === "Enter") {
        const code = scanBuffer.trim();
        if (code.length >= 3) {
          const matched = students.find(s => 
            (s.nfc_id && s.nfc_id.toLowerCase() === code.toLowerCase()) ||
            (s.nik && s.nik === code) ||
            (s.nisn && s.nisn === code)
          );
          if (matched) {
            handleSelectStudent(matched);
            setCardScannedSuccess(`Kartu Terbaca: ${matched.nama_lengkap} (Kamar ${matched.kamar || "-"})`);
            setTimeout(() => setCardScannedSuccess(null), 4000);
          }
        }
        scanBuffer = "";
      } else if (e.key.length === 1) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [isModalOpen, students]);

  // Otomatis sinkron batas waktu (tanggal selesai) berdasarkan durasi sambang
  useEffect(() => {
    if (activeSubMenu === "sambang" && formTglMulai) {
      try {
        const d = new Date(formTglMulai);
        const days = Math.max(1, Number(formDurasiSambang || 1));
        d.setDate(d.getDate() + days);
        setFormTglSelesai(d.toISOString().split("T")[0]);
      } catch (err) {
        console.warn(err);
      }
    }
  }, [formDurasiSambang, formTglMulai, activeSubMenu]);

  // SQL Modal State
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [tableMissingWarning, setTableMissingWarning] = useState(false);

  // In-app Action Confirmation states (avoids blocked window.confirm in iframe)
  const [actionItemToReturn, setActionItemToReturn] = useState<PerizinanItem | null>(null);
  const [actionItemToDelete, setActionItemToDelete] = useState<PerizinanItem | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Sync prop changes
  useEffect(() => {
    if (initialSubMenu && initialSubMenu !== activeSubMenu) {
      setActiveSubMenu(initialSubMenu);
    }
  }, [initialSubMenu]);

  const handleTabSwitch = (menu: SubMenuPerizinan) => {
    setActiveSubMenu(menu);
    setFilterKategoriSub("All");
    if (onSubMenuChange) {
      onSubMenuChange(menu);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterKamar("All");
    setFilterGender("All");
    setFilterKategoriSub("All");
    setFilterDaerah("All");
    setFilterStatus("All");
  };

  // Rooms list derived from props or students
  const allRooms = useMemo(() => {
    if (rooms && rooms.length > 0) {
      return Array.from(new Set(rooms.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    }
    return Array.from(
      new Set(students.map(s => s.kamar).filter((k): k is string => !!k))
    ).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [rooms, students]);

  // Fetch Perizinan Data from Supabase
  const fetchPerizinanData = async () => {
    setIsLoading(true);
    setTableMissingWarning(false);
    try {
      const [sambangRes, sakitRes, haidRes] = await Promise.all([
        supabase.from("izin_sambang").select("*").order("id", { ascending: false }),
        supabase.from("izin_sakit").select("*").order("id", { ascending: false }),
        supabase.from("izin_haid").select("*").order("id", { ascending: false }),
      ]);

      const err = sambangRes.error || sakitRes.error || haidRes.error;
      if (err) {
        if (err.code === "42P01" || err.code === "PGRST205" || err.message.includes("does not exist")) {
          setTableMissingWarning(true);
        }
        throw err;
      }

      let allItems: any[] = [];
      if (sambangRes.data) {
        allItems = allItems.concat(sambangRes.data.map(d => ({ 
          ...d, 
          kategori_izin: "sambang",
          keperluan: d.keperluan ? `${d.keperluan} (Tujuan: ${d.tujuan || 'Tidak ada'})` : (d.tujuan || 'Sambang')
        })));
      }
      if (sakitRes.data) {
        allItems = allItems.concat(sakitRes.data.map(d => ({ ...d, kategori_izin: "sakit" })));
      }
      if (haidRes.data) {
        allItems = allItems.concat(haidRes.data.map(d => ({ ...d, kategori_izin: "haid", keperluan: "Berhalangan Sholat / Haid" })));
      }

      setItems(allItems.sort((a, b) => {
         const dA = new Date(a.created_at || a.tanggal_mulai).getTime();
         const dB = new Date(b.created_at || b.tanggal_mulai).getTime();
         return dB - dA;
      }) as PerizinanItem[]);
    } catch (err: any) {
      console.warn("Gagal load perizinan dari Supabase:", err.message);
      // Fallback: read from localStorage
      const localData = localStorage.getItem("local_perizinan_records");
      if (localData) {
        try {
          setItems(JSON.parse(localData));
        } catch {
          setItems([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };  const fetchPerizinanDataRef = useRef(fetchPerizinanData);
  fetchPerizinanDataRef.current = fetchPerizinanData;

  useEffect(() => {
    fetchPerizinanDataRef.current();

    // Setup Realtime subscription on perizinan tables
    const perizinanChannel = supabase
      .channel("realtime-perizinan-modul")
      .on("postgres_changes", { event: "*", schema: "public", table: "izin_sambang" }, () => {
        fetchPerizinanDataRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "izin_sakit" }, () => {
        fetchPerizinanDataRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "izin_haid" }, () => {
        fetchPerizinanDataRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(perizinanChannel);
    };
  }, []);

  // Filter items by active submenu (sakit, sambang, haid)
  const currentCategoryItems = useMemo(() => {
    return items.filter(item => item.kategori_izin === activeSubMenu);
  }, [items, activeSubMenu]);

  // Check if an item is considered "Melewati Batas" (Overdue)
  const isItemOverdue = (item: PerizinanItem): boolean => {
    const isReturned = ["sudah kembali", "sudah sembuh", "sudah suci"].includes(item.status.toLowerCase());
    if (isReturned) return false;
    
    if (item.kategori_izin === "haid") {
      // Masa haid normal fiqih: jika > 7 hari dihitung perhatian khusus/melewati batas umum
      if (!item.tanggal_mulai) return false;
      const start = new Date(item.tanggal_mulai).getTime();
      const now = new Date().getTime();
      const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 7;
    }

    if (!item.tanggal_selesai) return false;
    
    const finishDateStr = `${item.tanggal_selesai}T${item.jam_selesai || "23:59:59"}`;
    const finishTime = new Date(finishDateStr).getTime();
    const nowTime = new Date().getTime();
    return nowTime > finishTime;
  };

  // BANNER STATS COMPUTATION FOR THE 4 EXACT CARDS (shown in image.png)
  const bannerStats = useMemo(() => {
    const catItems = currentCategoryItems;
    
    // Active items (Belum kembali/sembuh/suci)
    const activeItems = catItems.filter(item => {
      const st = (item.status || "").toLowerCase();
      return !["sudah kembali", "sudah sembuh", "sudah suci"].includes(st);
    });

    const activePutra = activeItems.filter(item => item.jenis_kelamin === "L").length;
    const activePutri = activeItems.filter(item => item.jenis_kelamin === "P").length;

    // Overdue items
    const overdueItems = activeItems.filter(isItemOverdue);
    const overduePutra = overdueItems.filter(item => item.jenis_kelamin === "L").length;
    const overduePutri = overdueItems.filter(item => item.jenis_kelamin === "P").length;

    // Returned items (Sudah Kembali / Sudah Sembuh / Sudah Suci)
    const returnedItems = catItems.filter(item => {
      const st = (item.status || "").toLowerCase();
      return ["sudah kembali", "sudah sembuh", "sudah suci"].includes(st);
    });

    // Haid specific stats
    let haidPhase1 = 0; // hari 1 - 3
    let haidPhase2 = 0; // hari 4 - 7
    let haidOver7 = 0; // > 7 hari
    if (activeSubMenu === "haid") {
      const now = new Date().getTime();
      activeItems.forEach(it => {
        const start = new Date(it.tanggal_mulai).getTime();
        const days = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);
        if (days <= 3) haidPhase1++;
        else if (days <= 7) haidPhase2++;
        else haidOver7++;
      });
    }

    return {
      activeTotal: activeItems.length,
      activePutra,
      activePutri,
      overduePutra,
      overduePutri,
      returnedTotal: returnedItems.length,
      haidPhase1,
      haidPhase2,
      haidOver7
    };
  }, [currentCategoryItems, activeSubMenu]);

  // Students mapping and options for 6-field filter card
  const studentsMap = useMemo(() => {
    const map = new Map<string, SantriData>();
    students.forEach(s => {
      map.set(s.nama_lengkap.toLowerCase(), s);
      if (s.id) map.set(String(s.id), s);
    });
    return map;
  }, [students]);

  const uniqueDaerah = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.daerah) set.add(s.daerah.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const kamarOptions = useMemo(() => [
    { value: "All", label: "Semua Kamar" },
    ...allRooms.map(r => ({ value: r, label: r }))
  ], [allRooms]);

  const genderOptions = useMemo(() => [
    { value: "All", label: "Semua Gender" },
    { value: "L", label: "Laki-laki (Putra)" },
    { value: "P", label: "Perempuan (Putri)" }
  ], []);

  const kategoriSubOptions = useMemo(() => {
    if (activeSubMenu === "sakit") {
      return [
        { value: "All", label: "Semua Lokasi" },
        { value: "Kamar Santri", label: "Kamar Santri" },
        { value: "UKS Pondok", label: "UKS Pondok" },
        { value: "Pulang ke Rumah", label: "Pulang ke Rumah" },
        { value: "Rumah Sakit", label: "Rumah Sakit" },
      ];
    }
    if (activeSubMenu === "sambang") {
      return [
        { value: "All", label: "Semua Keperluan" },
        { value: "Sambang Wali Santri", label: "Sambang Wali Santri" },
        { value: "Izin Keluar Sebentar", label: "Izin Keluar Sebentar" },
        { value: "Pulang Bersama Keluarga", label: "Pulang Bersama Keluarga" },
        { value: "Keperluan Luar / Mendesak", label: "Keperluan Luar / Mendesak" },
      ];
    }
    return [
      { value: "All", label: "Semua Fase" },
      { value: "fase_awal", label: "Hari 1 - 3 (Awal)" },
      { value: "fase_normal", label: "Hari 4 - 7 (Normal)" },
      { value: "fase_lebih", label: "> 7 Hari (Pantauan)" },
    ];
  }, [activeSubMenu]);

  const daerahOptions = useMemo(() => [
    { value: "All", label: "Semua Daerah" },
    ...uniqueDaerah.map(d => ({ value: d, label: d }))
  ], [uniqueDaerah]);

  const statusOptions = useMemo(() => [
    { value: "All", label: "Semua Status" },
    { value: "aktif", label: activeSubMenu === "sakit" ? "Sedang Sakit" : activeSubMenu === "sambang" ? "Sedang Sambang" : "Sedang Haid" },
    { value: "terlambat", label: activeSubMenu === "haid" ? "> 7 Hari Haid" : "Melewati Batas Waktu" },
    { value: "selesai", label: activeSubMenu === "sakit" ? "Sudah Sembuh" : activeSubMenu === "sambang" ? "Sudah Kembali" : "Sudah Suci" },
  ], [activeSubMenu]);

  // Filtered items for the list using 6 filters
  const filteredList = useMemo(() => {
    return currentCategoryItems.filter(item => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSearch = 
          (item.nama_siswa || "").toLowerCase().includes(q) ||
          (item.kamar || "").toLowerCase().includes(q) ||
          (item.keperluan || "").toLowerCase().includes(q) ||
          (item.penjemput || "").toLowerCase().includes(q) ||
          (item.no_hp_penjemput || "").toLowerCase().includes(q) ||
          (item.diagnosa_keluhan || "").toLowerCase().includes(q) ||
          (item.catatan || "").toLowerCase().includes(q);
        if (!matchSearch) return false;
      }

      // 2. Kamar Filter
      if (filterKamar !== "All") {
        if ((item.kamar || "Belum Set") !== filterKamar) return false;
      }

      // 3. Gender Filter
      if (activeSubMenu === "haid") {
        if (item.jenis_kelamin !== "P") return false;
      } else if (filterGender !== "All") {
        if (item.jenis_kelamin !== filterGender) return false;
      }

      // 4. Kategori / Keperluan / Lokasi Filter (Hanya untuk Sakit & Haid)
      if (activeSubMenu !== "sambang" && filterKategoriSub !== "All") {
        if (activeSubMenu === "sakit") {
          if ((item.lokasi_rawat || "Kamar Santri") !== filterKategoriSub) return false;
        } else if (activeSubMenu === "haid") {
          const start = new Date(item.tanggal_mulai).getTime();
          const now = new Date().getTime();
          const days = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);
          if (filterKategoriSub === "fase_awal" && days > 3) return false;
          if (filterKategoriSub === "fase_normal" && (days < 4 || days > 7)) return false;
          if (filterKategoriSub === "fase_lebih" && days <= 7) return false;
        }
      }

      // 5. Daerah Filter (Hanya untuk Sakit & Haid)
      if (activeSubMenu !== "sambang" && filterDaerah !== "All") {
        const student = (item.siswa_id ? studentsMap.get(String(item.siswa_id)) : null) || studentsMap.get((item.nama_siswa || "").toLowerCase());
        if (!student || (student.daerah || "").trim() !== filterDaerah) return false;
      }

      // 6. Status Filter
      const isReturned = ["sudah kembali", "sudah sembuh", "sudah suci"].includes(item.status.toLowerCase());
      const isOverdue = isItemOverdue(item);

      if (filterStatus === "aktif") {
        if (isReturned) return false;
      } else if (filterStatus === "terlambat") {
        if (!isOverdue || isReturned) return false;
      } else if (filterStatus === "selesai") {
        if (!isReturned) return false;
      }

      return true;
    });
  }, [currentCategoryItems, searchQuery, filterKamar, filterGender, filterKategoriSub, filterDaerah, filterStatus, activeSubMenu, studentsMap]);

  // Export filtered perizinan to CSV
  const exportToCSV = () => {
    if (filteredList.length === 0) return;

    const headers = [
      "No",
      "Nama Santri",
      "Jenis Kelamin",
      "Kamar",
      "Kategori Izin",
      "Keperluan / Diagnosa",
      "Penjemput / Lokasi Rawat",
      "No. HP Penjemput",
      "Tanggal Mulai",
      "Jam Mulai",
      "Batas Estimasi Kembali",
      "Jam Selesai",
      "Realisasi Tanggal Kembali",
      "Status",
      "Petugas",
      "Catatan"
    ];

    const rows = filteredList.map((item, idx) => [
      idx + 1,
      `"${(item.nama_siswa || "").replace(/"/g, '""')}"`,
      item.jenis_kelamin === "P" ? "Perempuan" : "Laki-laki",
      `"${(item.kamar || "-").replace(/"/g, '""')}"`,
      item.kategori_izin.toUpperCase(),
      `"${(item.diagnosa_keluhan || item.keperluan || "-").replace(/"/g, '""')}"`,
      `"${(item.penjemput || item.lokasi_rawat || "-").replace(/"/g, '""')}"`,
      `"${(item.no_hp_penjemput || "-").replace(/"/g, '""')}"`,
      item.tanggal_mulai || "-",
      item.jam_mulai || "-",
      item.tanggal_selesai || "-",
      item.jam_selesai || "-",
      item.tanggal_kembali ? new Date(item.tanggal_kembali).toLocaleDateString("id-ID") : "-",
      `"${(item.status || "-").replace(/"/g, '""')}"`,
      `"${(item.petugas || "-").replace(/"/g, '""')}"`,
      `"${(item.catatan || "-").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `Data_Perizinan_${activeSubMenu.toUpperCase()}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Buka modal dengan preset sesuai sub-menu
  const handleOpenModal = () => {
    setFormStudent(null);
    setFormKamar("");
    setFormSearchSantri("");
    setCardScannedSuccess(null);
    setIsSantriDropdownOpen(false);
    setFormTglMulai(new Date().toISOString().split("T")[0]);
    const d = new Date();
    setFormJamMulai(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    
    if (activeSubMenu === "sambang") {
      setFormDurasiSambang(1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setFormTglSelesai(tomorrow.toISOString().split("T")[0]);
      setFormJamSelesai("17:00");
      setFormTujuan("");
      setFormKeperluan("");
      setFormHubunganWali("Ayah");
      setFormSudahKonfirmasi(false);
    } else if (activeSubMenu === "sakit") {
      const est = new Date();
      est.setDate(est.getDate() + 2);
      setFormTglSelesai(est.toISOString().split("T")[0]);
      setFormJamSelesai("12:00");
      setFormDiagnosa("");
      setFormLokasiRawat("Kamar Santri");
      setFormHubunganWali("Ayah");
      setFormSudahKonfirmasi(false);
    } else {
      // Haid: estimasi 7 hari
      const est = new Date();
      est.setDate(est.getDate() + 7);
      setFormTglSelesai(est.toISOString().split("T")[0]);
      setFormJamSelesai("18:00");
    }

    setFormPenjemput("");
    setFormNoHp("");
    setFormCatatan("");
    setIsModalOpen(true);
  };

  // Simpan Data Perizinan Baru (Mendukung "Buat" & "Buat & buat lainnya")
  const handleSave = async (keepOpen: boolean = false) => {
    if (!formStudent) {
      onTriggerNotification(
        activeSubMenu === "sambang"
          ? "Pilih nama siswa atau tap kartu terlebih dahulu!"
          : "Pilih nama santri atau tap kartu RFID terlebih dahulu!",
        "warning"
      );
      return;
    }

    // Gender check for Haid
    if (activeSubMenu === "haid" && formStudent.jenis_kelamin === "L") {
      onTriggerNotification("Izin Haid hanya berlaku untuk santriwati (Putri)!", "error");
      return;
    }

    // Validasi field wajib Sambang
    if (activeSubMenu === "sambang") {
      if (!formTujuan.trim()) {
        onTriggerNotification("Tujuan sambang wajib diisi!", "warning");
        return;
      }
      if (!formKeperluan.trim()) {
        onTriggerNotification("Keperluan sambang wajib diisi!", "warning");
        return;
      }
    }

    // Validasi field wajib Sakit
    if (activeSubMenu === "sakit") {
      if (!formDiagnosa.trim()) {
        onTriggerNotification("Keterangan sakit / keluhan wajib diisi!", "warning");
        return;
      }
    }

    setIsSubmitting(true);
    const initialStatus = 
      activeSubMenu === "sambang" ? "Sedang Sambang" :
      activeSubMenu === "sakit" ? "Sedang Sakit" : "Sedang Haid";

    // Hitung tanggal batas selesai otomatis jika durasi diisi
    let calculatedTglSelesai = formTglSelesai;
    if (activeSubMenu === "sambang" && formTglMulai) {
      try {
        const d = new Date(formTglMulai);
        const days = Math.max(1, Number(formDurasiSambang || 1));
        d.setDate(d.getDate() + days);
        calculatedTglSelesai = d.toISOString().split("T")[0];
      } catch {
        calculatedTglSelesai = formTglSelesai;
      }
    }

    let dbPayload: any = {
      siswa_id: formStudent.id ? Number(formStudent.id) : null,
      nama_siswa: formStudent.nama_lengkap,
      jenis_kelamin: formStudent.jenis_kelamin || (activeSubMenu === 'haid' ? 'P' : 'L'),
      kamar: formStudent.kamar || formKamar || "Belum Set",
      status: initialStatus,
      petugas: currentUserName,
      catatan: [
        activeSubMenu === "sambang" && formDurasiSambang ? `Lama Sambang: ${formDurasiSambang} Hari (Batas: ${calculatedTglSelesai})` : "",
        formSudahKonfirmasi ? `[Sudah Konfirmasi Wali: ${formHubunganWali}]` : `[Belum Konfirmasi]`,
        formCatatan
      ].filter(Boolean).join(" | "),
      created_at: new Date().toISOString()
    };
    if (formTglMulai) dbPayload.tanggal_mulai = formTglMulai;
    if (formJamMulai) dbPayload.jam_mulai = formJamMulai;
    if (calculatedTglSelesai) dbPayload.tanggal_selesai = calculatedTglSelesai;
    if (formJamSelesai) dbPayload.jam_selesai = formJamSelesai;


    if (activeSubMenu === "sambang") {
      dbPayload.tujuan = formTujuan;
      dbPayload.keperluan = formKeperluan;
      dbPayload.penjemput = `${formTujuan} | Wali: ${formHubunganWali || "Wali"}`;
      dbPayload.no_hp_penjemput = formNoHp || null;
    } else if (activeSubMenu === "sakit") {
      dbPayload.diagnosa_keluhan = formDiagnosa;
      dbPayload.lokasi_rawat = formLokasiRawat;
    }

    const tableName = activeSubMenu === "sambang" ? "izin_sambang" : activeSubMenu === "sakit" ? "izin_sakit" : "izin_haid";

    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert([dbPayload])
        .select();

      if (error) { console.error("Insert error:", error); throw error; }

      // Update status_siswa for backward compatibility & global views sync
      const syncStatusName = 
        activeSubMenu === "sambang" ? "Pulang" :
        activeSubMenu === "sakit" ? "Sakit" : "Haid";

      try {
        await supabase
          .from("status_siswa")
          .upsert({
            nama: formStudent.nama_lengkap,
            status: syncStatusName,
            created_at: new Date().toISOString()
          }, { onConflict: "nama" });
      } catch (e) {
        console.warn("Could not sync status_siswa:", e);
      }

      // Update localStorage map for rapid offline / local reactivity
      const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
      savedStatusMap[formStudent.nama_lengkap] = syncStatusName;
      if (formStudent.id) savedStatusMap[formStudent.id] = syncStatusName;
      localStorage.setItem("santri_status_map", JSON.stringify(savedStatusMap));

      onTriggerNotification(`Berhasil membuat pengajuan ${activeSubMenu} untuk ${formStudent.nama_lengkap}`, "success");
      await fetchPerizinanData();
      await onRefreshAll();

      if (keepOpen) {
        // Reset formulir untuk input santri berikutnya tanpa menutup modal
        setFormStudent(null);
        setFormKamar("");
        setFormSearchSantri("");
        setCardScannedSuccess(null);
        setIsSantriDropdownOpen(false);
        if (activeSubMenu === "sambang") {
          setFormTujuan("");
          setFormKeperluan("");
          setFormCatatan("");
          setFormSudahKonfirmasi(false);
        } else if (activeSubMenu === "sakit") {
          setFormDiagnosa("");
          setFormCatatan("");
          setFormSudahKonfirmasi(false);
        }
        setTimeout(() => santriInputRef.current?.focus(), 150);
      } else {
        setIsModalOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      // Offline fallback: save in localStorage
      const newId = Date.now();
      const localItem: PerizinanItem = {
        id: newId,
        ...(dbPayload as any)
      };
      const updatedLocal = [localItem, ...items];
      setItems(updatedLocal);
      localStorage.setItem("local_perizinan_records", JSON.stringify(updatedLocal));

      onTriggerNotification(`Tersimpan lokal: Izin ${activeSubMenu} untuk ${formStudent.nama_lengkap}`, "success");
      if (keepOpen) {
        setFormStudent(null);
        setFormKamar("");
        setFormSearchSantri("");
      } else {
        setIsModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open In-App Confirmation to mark Returned / Healed / Pure
  const handleMarkReturned = (item: PerizinanItem) => {
    setActionItemToReturn(item);
  };

  // Execute Mark status as Returned / Healed / Pure
  const executeMarkReturned = async (item: PerizinanItem) => {
    setIsProcessingAction(true);
    const returnStatus = 
      item.kategori_izin === "sakit" ? "Sudah Sembuh" :
      item.kategori_izin === "haid" ? "Sudah Suci" : "Sudah Kembali";
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split("T")[0];

    // Optimistic UI update: instantly reflect status in frontend
    setItems(prev => prev.map(it => it.id === item.id ? { 
      ...it, 
      status: returnStatus, 
      tanggal_kembali: nowIso 
    } : it));

    try {
      // 1. Update Supabase perizinan
      const tableName = item.kategori_izin === "sambang" ? "izin_sambang" : item.kategori_izin === "sakit" ? "izin_sakit" : "izin_haid";
      let updateRes = await supabase
        .from(tableName)
        .update({
          status: returnStatus,
          tanggal_kembali: nowIso
        })
        .eq("id", item.id);

      if (updateRes.error) {
        console.warn("Retrying with date string format:", updateRes.error.message);
        updateRes = await supabase
          .from(tableName)
          .update({
            status: returnStatus,
            tanggal_kembali: todayDate
          })
          .eq("id", item.id);
      }

      // 2. Revert status_siswa back to Aktif
      try {
        await supabase
          .from("status_siswa")
          .upsert({
            nama: item.nama_siswa,
            status: "Aktif",
            created_at: nowIso
          }, { onConflict: "nama" });
      } catch (e) {
        console.warn("Could not sync status_siswa revert:", e);
      }

      // 3. Update localStorage status map
      const savedStatusMap = JSON.parse(localStorage.getItem("santri_status_map") || "{}");
      savedStatusMap[item.nama_siswa] = "Aktif";
      if (item.siswa_id) savedStatusMap[item.siswa_id] = "Aktif";
      localStorage.setItem("santri_status_map", JSON.stringify(savedStatusMap));

      // 4. Update localStorage cached records
      const currentCache = JSON.parse(localStorage.getItem("local_perizinan_records") || "[]");
      const updatedCache = currentCache.map((it: PerizinanItem) => 
        it.id === item.id ? { ...it, status: returnStatus, tanggal_kembali: nowIso } : it
      );
      localStorage.setItem("local_perizinan_records", JSON.stringify(updatedCache));

      onTriggerNotification(`Status ${item.nama_siswa} berhasil diperbarui: "${returnStatus}"`, "success");
      await fetchPerizinanData();
      await onRefreshAll();
    } catch (err: any) {
      console.error("Execute mark returned error:", err);
      // Ensure local state is preserved even if network or schema issue
      const updated = items.map(it => it.id === item.id ? { ...it, status: returnStatus, tanggal_kembali: nowIso } : it);
      setItems(updated);
      localStorage.setItem("local_perizinan_records", JSON.stringify(updated));
      onTriggerNotification(`Status "${returnStatus}" diperbarui (disimpan lokal)`, "success");
    } finally {
      setIsProcessingAction(false);
      setActionItemToReturn(null);
    }
  };

  // Open In-App Confirmation to Delete Record
  const handleDeleteItem = (item: PerizinanItem) => {
    setActionItemToDelete(item);
  };

  // Execute Delete Record
  const executeDeleteItem = async (item: PerizinanItem) => {
    setIsProcessingAction(true);
    // Optimistic UI update
    setItems(prev => prev.filter(it => it.id !== item.id));

    try {
      const tableName = item.kategori_izin === "sambang" ? "izin_sambang" : item.kategori_izin === "sakit" ? "izin_sakit" : "izin_haid";
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      
      const currentCache = JSON.parse(localStorage.getItem("local_perizinan_records") || "[]");
      const updatedCache = currentCache.filter((it: PerizinanItem) => it.id !== item.id);
      localStorage.setItem("local_perizinan_records", JSON.stringify(updatedCache));

      onTriggerNotification(`Catatan perizinan berhasil dihapus`, "success");
      await fetchPerizinanData();
    } catch (err: any) {
      console.error(err);
      const updated = items.filter(it => it.id !== item.id);
      setItems(updated);
      localStorage.setItem("local_perizinan_records", JSON.stringify(updated));
      onTriggerNotification("Catatan dihapus dari penyimpanan lokal", "success");
    } finally {
      setIsProcessingAction(false);
      setActionItemToDelete(null);
    }
  };

  // SQL Schema Script string for copying
  const sqlScriptContent = `-- ==============================================================================
-- STRUKTUR DATABASE SUPABASE: MANAJEMEN PERIZINAN SISWA
-- Modul: SAKIT, SAMBANG, HAID (Tabel Terpisah)
-- Pondok Pesantren Al-Muttaqin
-- ==============================================================================

-- ==============================================================================
-- 1. TABEL IZIN SAMBANG
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.izin_sambang (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    siswa_id BIGINT REFERENCES public.santri(id) ON DELETE SET NULL,
    nama_siswa TEXT NOT NULL,
    jenis_kelamin VARCHAR(10) DEFAULT 'L' CHECK (jenis_kelamin IN ('L', 'P')),
    kamar TEXT,
    tujuan TEXT,
    keperluan TEXT,
    penjemput TEXT,
    no_hp_penjemput TEXT,
    tanggal_mulai DATE NOT NULL DEFAULT CURRENT_DATE,
    jam_mulai TIME DEFAULT CURRENT_TIME,
    tanggal_selesai DATE,
    jam_selesai TIME DEFAULT '17:00:00',
    tanggal_kembali TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'Sedang Sambang' CHECK (status IN ('Sedang Sambang', 'Sudah Kembali')),
    petugas TEXT,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sambang_status ON public.izin_sambang (status);
CREATE INDEX IF NOT EXISTS idx_sambang_tgl_mulai ON public.izin_sambang (tanggal_mulai);
CREATE INDEX IF NOT EXISTS idx_sambang_nama ON public.izin_sambang (nama_siswa);
CREATE INDEX IF NOT EXISTS idx_sambang_jk ON public.izin_sambang (jenis_kelamin);

CREATE OR REPLACE FUNCTION public.handle_sambang_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sambang_updated_at ON public.izin_sambang;
CREATE TRIGGER trg_sambang_updated_at BEFORE UPDATE ON public.izin_sambang FOR EACH ROW EXECUTE FUNCTION public.handle_sambang_updated_at();

ALTER TABLE public.izin_sambang ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select sambang" ON public.izin_sambang;
CREATE POLICY "Allow select sambang" ON public.izin_sambang FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert sambang" ON public.izin_sambang;
CREATE POLICY "Allow insert sambang" ON public.izin_sambang FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update sambang" ON public.izin_sambang;
CREATE POLICY "Allow update sambang" ON public.izin_sambang FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete sambang" ON public.izin_sambang;
CREATE POLICY "Allow delete sambang" ON public.izin_sambang FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.izin_sambang;

-- ==============================================================================
-- 2. TABEL IZIN SAKIT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.izin_sakit (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    siswa_id BIGINT REFERENCES public.santri(id) ON DELETE SET NULL,
    nama_siswa TEXT NOT NULL,
    jenis_kelamin VARCHAR(10) DEFAULT 'L' CHECK (jenis_kelamin IN ('L', 'P')),
    kamar TEXT,
    diagnosa_keluhan TEXT,
    lokasi_rawat TEXT DEFAULT 'Kamar Santri',
    tanggal_mulai DATE NOT NULL DEFAULT CURRENT_DATE,
    jam_mulai TIME DEFAULT CURRENT_TIME,
    tanggal_selesai DATE,
    jam_selesai TIME DEFAULT '17:00:00',
    tanggal_kembali TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'Sedang Sakit' CHECK (status IN ('Sedang Sakit', 'Sudah Sembuh')),
    petugas TEXT,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sakit_status ON public.izin_sakit (status);
CREATE INDEX IF NOT EXISTS idx_sakit_tgl_mulai ON public.izin_sakit (tanggal_mulai);
CREATE INDEX IF NOT EXISTS idx_sakit_nama ON public.izin_sakit (nama_siswa);
CREATE INDEX IF NOT EXISTS idx_sakit_jk ON public.izin_sakit (jenis_kelamin);

CREATE OR REPLACE FUNCTION public.handle_sakit_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sakit_updated_at ON public.izin_sakit;
CREATE TRIGGER trg_sakit_updated_at BEFORE UPDATE ON public.izin_sakit FOR EACH ROW EXECUTE FUNCTION public.handle_sakit_updated_at();

ALTER TABLE public.izin_sakit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select sakit" ON public.izin_sakit;
CREATE POLICY "Allow select sakit" ON public.izin_sakit FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert sakit" ON public.izin_sakit;
CREATE POLICY "Allow insert sakit" ON public.izin_sakit FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update sakit" ON public.izin_sakit;
CREATE POLICY "Allow update sakit" ON public.izin_sakit FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete sakit" ON public.izin_sakit;
CREATE POLICY "Allow delete sakit" ON public.izin_sakit FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.izin_sakit;

-- ==============================================================================
-- 3. TABEL IZIN HAID
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.izin_haid (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    siswa_id BIGINT REFERENCES public.santri(id) ON DELETE SET NULL,
    nama_siswa TEXT NOT NULL,
    jenis_kelamin VARCHAR(10) DEFAULT 'P' CHECK (jenis_kelamin = 'P'),
    kamar TEXT,
    tanggal_mulai DATE NOT NULL DEFAULT CURRENT_DATE,
    jam_mulai TIME DEFAULT CURRENT_TIME,
    tanggal_selesai DATE,
    jam_selesai TIME DEFAULT '17:00:00',
    tanggal_kembali TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'Sedang Haid' CHECK (status IN ('Sedang Haid', 'Sudah Suci')),
    petugas TEXT,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_haid_status ON public.izin_haid (status);
CREATE INDEX IF NOT EXISTS idx_haid_tgl_mulai ON public.izin_haid (tanggal_mulai);
CREATE INDEX IF NOT EXISTS idx_haid_nama ON public.izin_haid (nama_siswa);

CREATE OR REPLACE FUNCTION public.handle_haid_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_haid_updated_at ON public.izin_haid;
CREATE TRIGGER trg_haid_updated_at BEFORE UPDATE ON public.izin_haid FOR EACH ROW EXECUTE FUNCTION public.handle_haid_updated_at();

ALTER TABLE public.izin_haid ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select haid" ON public.izin_haid;
CREATE POLICY "Allow select haid" ON public.izin_haid FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert haid" ON public.izin_haid;
CREATE POLICY "Allow insert haid" ON public.izin_haid FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update haid" ON public.izin_haid;
CREATE POLICY "Allow update haid" ON public.izin_haid FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete haid" ON public.izin_haid;
CREATE POLICY "Allow delete haid" ON public.izin_haid FOR DELETE USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.izin_haid;
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScriptContent);
    setCopiedSql(true);
    onTriggerNotification("Kode SQL Perizinan berhasil disalin ke clipboard!", "success");
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Filter students for modal selection
  const modalEligibleStudents = useMemo(() => {
    let list = students;
    if (activeSubMenu === "haid") {
      list = list.filter(s => s.jenis_kelamin === "P");
    }
    if (formKamar && formKamar !== "Semua Kamar") {
      list = list.filter(s => (s.kamar || "Belum Set") === formKamar);
    }
    return list;
  }, [students, activeSubMenu, formKamar]);

  // Filter students for tap card / search input
  const searchedModalStudents = useMemo(() => {
    let list = students;
    if (activeSubMenu === "haid") {
      list = list.filter(s => s.jenis_kelamin === "P");
    }
    if (!formSearchSantri.trim()) return list.slice(0, 30);
    const q = formSearchSantri.toLowerCase().trim();
    return list.filter(s => 
      (s.nama_lengkap || "").toLowerCase().includes(q) ||
      (s.nama_panggilan || "").toLowerCase().includes(q) ||
      (s.nfc_id || "").toLowerCase().includes(q) ||
      (s.nik || "").includes(q) ||
      (s.nisn || "").includes(q) ||
      (s.kamar || "").toLowerCase().includes(q)
    ).slice(0, 40);
  }, [students, activeSubMenu, formSearchSantri]);

  return (
    <div className="space-y-5" id="perizinan-container">
      {/* 1. TOP HEADER BRANDING (MATCHES OTHER MENUS: BREADCRUMBS + DISPLAY TITLE + ACTIONS) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none pb-1" id="perizinan-brand-header">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
            <span>Perizinan Santri</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>
              {activeSubMenu === "sakit" ? "Izin Sakit" : activeSubMenu === "sambang" ? "Izin Sambang" : "Izin Haid"}
            </span>
          </div>
          <h2 className="text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-none mt-1.5">
            {activeSubMenu === "sakit" ? "Perizinan Sakit" : activeSubMenu === "sambang" ? "Perizinan Sambang" : "Perizinan Haid"}
          </h2>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchPerizinanData();
              onRefreshAll();
            }}
            disabled={isLoading}
            className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all border border-slate-200/80 dark:border-slate-700/60 cursor-pointer shadow-2xs disabled:opacity-50"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* Primary Action: Tambah Izin Baru */}
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Input Izin {activeSubMenu === "sakit" ? "Sakit" : activeSubMenu === "sambang" ? "Sambang" : "Haid"}</span>
          </button>
        </div>
      </div>

      {/* SQL WARNING ALERT IF TABLE MISSING / SCHEMA CACHE ERROR */}
      {tableMissingWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold">Tabel "perizinan" belum dibuat, atau Schema Cache Supabase perlu di-reload (Error PGRST205).</span>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                Buka SQL Editor di dasbor Supabase, jalankan skrip SQL di bawah ini. Jika tabel sudah ada tapi masih error, jalankan perintah <code className="bg-amber-200/50 px-1 py-0.5 rounded font-mono text-[10px]">NOTIFY pgrst, 'reload schema';</code> di SQL Editor.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSqlModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer transition-all shadow-xs"
          >
            Buka Kode SQL
          </button>
        </div>
      )}

      {/* 2. THE 4 BANNER CARDS (EXACT MATCH TO image.png) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeSubMenu === "sambang" ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-4 select-none`}>
        
        {/* CARD 1: Sedang Sambang / Sedang Sakit / Sedang Haid (Orange/Amber Underline) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden border-b-[3px] border-b-amber-400 dark:border-b-amber-500 min-h-[115px]">
          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-[13px] font-medium tracking-normal block">
              {activeSubMenu === "sambang" && "Sedang Sambang"}
              {activeSubMenu === "sakit" && "Sedang Sakit"}
              {activeSubMenu === "haid" && "Sedang Haid"}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 mb-2 tracking-tight">
              {bannerStats.activeTotal}
            </div>
          </div>
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span>
              {activeSubMenu === "haid" 
                ? `${bannerStats.activePutri} santriwati berhalangan`
                : `${bannerStats.activePutra} putra, ${bannerStats.activePutri} putri`
              }
            </span>
            <span className="text-[11px] font-mono tracking-tighter opacity-90">[→</span>
          </div>
        </div>

        {/* CARD 2: Sambang Putra (Blue Underline) */}
        {activeSubMenu === "sambang" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden border-b-[3px] border-b-blue-500 dark:border-b-blue-400 min-h-[115px]">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-[13px] font-medium tracking-normal block">
                Sambang Putra
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 mb-2 tracking-tight">
                {bannerStats.activePutra}
              </div>
            </div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between">
              <span>
                {`${bannerStats.overduePutra} melewati batas`}
              </span>
              <span className="text-sm font-bold opacity-90">
                ♂
              </span>
            </div>
          </div>
        )}

        {/* CARD 3: Sambang Putri (Red/Rose Underline) */}
        {activeSubMenu === "sambang" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden border-b-[3px] border-b-rose-500 dark:border-b-rose-400 min-h-[115px]">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-[13px] font-medium tracking-normal block">
                Sambang Putri
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 mb-2 tracking-tight">
                {bannerStats.activePutri}
              </div>
            </div>
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-between">
              <span>
                {`${bannerStats.overduePutri} melewati batas`}
              </span>
              <span className="text-sm font-bold opacity-90">♀</span>
            </div>
          </div>
        )}

        {/* CARD 4: Sudah Kembali / Sudah Sembuh / Sudah Suci (Green/Emerald Underline) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between relative overflow-hidden border-b-[3px] border-b-emerald-500 dark:border-b-emerald-400 min-h-[115px]">
          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-[13px] font-medium tracking-normal block">
              {activeSubMenu === "sambang" && "Sudah Kembali"}
              {activeSubMenu === "sakit" && "Sudah Sembuh"}
              {activeSubMenu === "haid" && "Sudah Suci"}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 mb-2 tracking-tight">
              {bannerStats.returnedTotal}
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span className="truncate pr-1">
              {activeSubMenu === "haid"
                ? "Total sudah mandi & sholat"
                : "Total perizinan yang sudah kembali"
              }
            </span>
            <span className="text-[11px] font-mono tracking-tighter opacity-90 shrink-0">→]</span>
          </div>
        </div>

      </div>

      {/* 3. SEARCH & FILTER CARD (EXACT MATCH TO DATA SANTRI / PELANGGARAN FILTER IN image.png) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filter Data Perizinan</span>
          </h3>
          <button 
            type="button"
            onClick={handleResetFilters}
            className="text-red-500 hover:text-red-600 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          >
            Atur ulang filter
          </button>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeSubMenu === "sambang" ? "lg:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-6"} gap-4`}>
          {/* 1. Pencarian */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
              {activeSubMenu === "sambang" ? "Pencarian Siswa" : "Pencarian"}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={activeSubMenu === "sambang" ? "Cari nama siswa..." : "Cari nama,..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>

          {/* 2. Kamar / Kelas */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span>{activeSubMenu === "sambang" ? "Kelas" : "Kelas / Kamar"}</span>
              {filterKamar !== "All" && (
                <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              )}
            </label>
            <SearchableSelect
              value={filterKamar}
              onChange={setFilterKamar}
              options={kamarOptions}
              placeholder={activeSubMenu === "sambang" ? "Semua Kelas" : "Semua Kamar"}
            />
          </div>

          {/* 3. Jenis Kelamin */}
          {activeSubMenu === "sambang" && (
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Kelamin</label>
              <SearchableSelect
                value={filterGender}
                onChange={setFilterGender}
                options={genderOptions}
                placeholder="Semua Gender"
              />
            </div>
          )}

          {/* 6. Status */}
          {activeSubMenu !== "haid" && (
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <SearchableSelect
                value={filterStatus}
                onChange={setFilterStatus}
                options={statusOptions}
                placeholder="Semua Status"
              />
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button 
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shadow-xs w-fit cursor-pointer"
          >
            Terapkan filter
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium mr-2">
              Menampilkan <strong className="text-slate-800 dark:text-white font-semibold">{filteredList.length}</strong> dari <strong className="text-slate-800 dark:text-white font-semibold">{currentCategoryItems.length}</strong> {activeSubMenu === "haid" ? "santriwati" : "santri"}
            </span>
            <button
              onClick={exportToCSV}
              disabled={filteredList.length === 0}
              className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              id="export-csv-btn"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. PERIZINAN DATA TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">{activeSubMenu === "haid" ? "Nama" : activeSubMenu === "sambang" ? "Nama Siswa" : "Nama Santri"}</th>
                <th className="py-3 px-4">{activeSubMenu === "sambang" ? "Kelas" : "Kamar"}</th>
                {activeSubMenu === "sambang" && <th className="py-3 px-4">Tujuan</th>}
                {activeSubMenu === "sambang" && <th className="py-3 px-4">Keperluan</th>}
                {activeSubMenu === "sakit" && <th className="py-3 px-4">Keterangan Sakit</th>}
                <th className="py-3 px-4">Waktu Mulai</th>
                {activeSubMenu === "sambang" && (
                  <th className="py-3 px-4">Kembali</th>
                )}
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Memuat data perizinan...</span>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Tidak ada data izin {activeSubMenu} yang cocok
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Klik tombol &quot;Input Izin {activeSubMenu === "sakit" ? "Sakit" : activeSubMenu === "sambang" ? "Sambang" : "Haid"}&quot; untuk membuat catatan baru.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => {
                  const isReturned = ["sudah kembali", "sudah sembuh", "sudah suci"].includes(item.status.toLowerCase());
                  const isOverdue = isItemOverdue(item);

                  // Compute Haid days
                  let haidDays = 1;
                  if (item.kategori_izin === "haid" && item.tanggal_mulai) {
                    const start = new Date(item.tanggal_mulai).getTime();
                    const end = item.tanggal_kembali ? new Date(item.tanggal_kembali).getTime() : new Date().getTime();
                    haidDays = Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            item.jenis_kelamin === "P" 
                              ? "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          }`}>
                            {item.jenis_kelamin === "P" ? "♀" : "♂"}
                          </span>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              {item.nama_siswa}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Petugas: {item.petugas || "Ustadz Pondok"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">
                        {item.kamar || "—"}
                      </td>

                      {/* Detail Column Sambang: Tujuan */}
                      {activeSubMenu === "sambang" && (
                        <td className="py-3 px-4">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {getItemTujuan(item)}
                          </span>
                        </td>
                      )}

                      {/* Detail Column Sambang: Hanya berisi Keperluan saja */}
                      {activeSubMenu === "sambang" && (
                        <td className="py-3 px-4">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {getItemKeperluan(item)}
                          </span>
                        </td>
                      )}

                      {/* Detail Column Sakit */}
                      {activeSubMenu === "sakit" && (
                        <td className="py-3 px-4">
                          <span className="font-bold text-amber-700 dark:text-amber-400 block">
                            {item.diagnosa_keluhan || item.keperluan || "Keluhan Sakit"}
                          </span>
                        </td>
                      )}

                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        <div>{item.tanggal_mulai}</div>
                        {item.jam_mulai && (
                          <div className="text-[10px] text-slate-400">{item.jam_mulai} WIB</div>
                        )}
                      </td>

                      {activeSubMenu === "sambang" && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isReturned ? (
                            <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                              <span className="text-[10px] block text-slate-400">Realisasi:</span>
                              {item.tanggal_kembali ? new Date(item.tanggal_kembali).toLocaleDateString("id-ID") : "Selesai"}
                            </div>
                          ) : (
                            <div>
                              <div className={`font-semibold ${isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-700 dark:text-slate-300"}`}>
                                {item.tanggal_selesai || "—"}
                              </div>
                              {item.jam_selesai && (
                                <div className="text-[10px] text-slate-400">{item.jam_selesai} WIB</div>
                              )}
                              {isOverdue && (
                                <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block">
                                  ⚠️ Melewati Batas
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      )}

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{item.status}</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <AlertCircle className="w-3 h-3" />
                            <span>Melewati Batas</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>{item.status || "Sedang Izin"}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isReturned && (
                            <button
                              onClick={() => handleMarkReturned(item)}
                              className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                              title={
                                activeSubMenu === "sakit" ? "Tandai Sembuh" :
                                activeSubMenu === "haid" ? "Tandai Suci & Sholat" : "Tandai Sudah Kembali"
                              }
                            >
                              <Check className="w-3 h-3" />
                              <span>
                                {activeSubMenu === "sakit" ? "Sembuh" : activeSubMenu === "haid" ? "Suci" : "Kembali"}
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL FORM INPUT IZIN BARU (SESUAI CONTOH FORM IZIN SAKIT & SAMBANG) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                {activeSubMenu === "sambang" 
                  ? "Buat Pengajuan Sambang" 
                  : activeSubMenu === "sakit" 
                  ? "Buat Pengajuan Sakit" 
                  : "Buat Pengajuan Izin Haid"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alert banner jika kartu RFID sukses terbaca */}
            {cardScannedSuccess && (
              <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in slide-in-from-top duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{cardScannedSuccess}</span>
              </div>
            )}

            {/* Modal Body Form */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* === KHUSUS FORM SAMBANG === */}
              {activeSubMenu === "sambang" && (
                <div className="space-y-4">
                  {/* Baris 1: Siswa & Tujuan */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Siswa (Ketik / Tap Kartu) */}
                    <div className="relative">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Siswa <span className="text-rose-500">*</span>
                      </label>

                      {!formStudent ? (
                        <div className="relative">
                          <input
                            ref={santriInputRef}
                            type="text"
                            placeholder="Pilih salah satu opsi (ketik / tap kartu)"
                            value={formSearchSantri}
                            onFocus={() => setIsSantriDropdownOpen(true)}
                            onChange={(e) => {
                              setFormSearchSantri(e.target.value);
                              setIsSantriDropdownOpen(true);
                            }}
                            className="w-full px-3.5 py-2.5 pr-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none text-slate-400">
                            <span title="Sensor Tap Kartu Aktif" className="flex items-center">
                              <Radio className="w-4 h-4 text-blue-500 animate-pulse" />
                            </span>
                            <ChevronDown className="w-4 h-4" />
                          </div>

                          {/* Dropdown list siswa */}
                          {isSantriDropdownOpen && (
                            <div 
                              ref={dropdownRef}
                              className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-700/60"
                            >
                              <div className="p-2 bg-slate-50 dark:bg-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                                <span>{searchedModalStudents.length} siswa ditemukan</span>
                                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                  <Radio className="w-3 h-3" /> Tap kartu langsung
                                </span>
                              </div>
                              {searchedModalStudents.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400">
                                  Tidak ada siswa yang cocok
                                </div>
                              ) : (
                                searchedModalStudents.map((s) => (
                                  <button
                                    key={s.id || s.nik}
                                    type="button"
                                    onClick={() => handleSelectStudent(s)}
                                    className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between transition-colors cursor-pointer"
                                  >
                                    <div>
                                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        {s.nama_lengkap}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Kelas: {s.kelas_sekolah || s.kelas_pengajian || s.kategori || "Belum Set"} | {s.jenis_kelamin === "P" ? "Siswi (♀)" : "Siswa (♂)"}
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                      {s.kelas_sekolah || s.kelas_pengajian || s.kategori || "No Kelas"}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="font-semibold text-blue-900 dark:text-blue-300 truncate">
                              {formStudent.nama_lengkap}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 bg-blue-200/80 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md font-medium shrink-0">
                              {formStudent.jenis_kelamin === "P" ? "Siswi" : "Siswa"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormStudent(null);
                              setFormKamar("");
                              setFormSearchSantri("");
                              setTimeout(() => santriInputRef.current?.focus(), 100);
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-rose-600 font-semibold cursor-pointer underline ml-2 shrink-0"
                          >
                            Ganti
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Tujuan */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Tujuan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Rumah Orang Tua / Malang"
                        value={formTujuan}
                        onChange={(e) => setFormTujuan(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Baris 2: Keperluan & Tanggal Sambang */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Keperluan */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Keperluan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Sambang keluarga & belanja keperluan"
                        value={formKeperluan}
                        onChange={(e) => setFormKeperluan(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Tanggal Sambang */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Tanggal Sambang <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formTglMulai}
                        onChange={(e) => setFormTglMulai(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Baris 3: Lama Sambang & Kelas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Lama Sambang */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Lama Sambang <span className="text-rose-500">*</span>
                        </label>
                        {formTglMulai && (
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                            Batas: {formTglSelesai}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={formDurasiSambang}
                          onChange={(e) => setFormDurasiSambang(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        />
                        <span className="text-sm font-medium text-slate-500 shrink-0">Hari</span>
                      </div>
                    </div>

                    {/* Kelas */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Kelas
                      </label>
                      <div className="flex items-center px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300">
                        <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                        <span className="font-semibold truncate">
                          {formStudent 
                            ? (formStudent.kelas_sekolah || formStudent.kelas_pengajian || formStudent.kategori || "Kelas belum diatur") 
                            : "Terisi otomatis saat siswa dipilih"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === KHUSUS FORM SAKIT === */}
              {activeSubMenu === "sakit" && (
                <div className="space-y-4">
                  {/* Baris 1: Nama Santri & Kamar */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nama (Ketik / Tap Kartu) */}
                    <div className="relative">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Nama Santri <span className="text-rose-500">*</span>
                      </label>

                      {!formStudent ? (
                        <div className="relative">
                          <input
                            ref={santriInputRef}
                            type="text"
                            placeholder="Pilih salah satu opsi (ketik / tap kartu)"
                            value={formSearchSantri}
                            onFocus={() => setIsSantriDropdownOpen(true)}
                            onChange={(e) => {
                              setFormSearchSantri(e.target.value);
                              setIsSantriDropdownOpen(true);
                            }}
                            className="w-full px-3.5 py-2.5 pr-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none text-slate-400">
                            <span title="Sensor Tap Kartu Aktif" className="flex items-center">
                              <Radio className="w-4 h-4 text-blue-500 animate-pulse" />
                            </span>
                            <ChevronDown className="w-4 h-4" />
                          </div>

                          {/* Dropdown list santri */}
                          {isSantriDropdownOpen && (
                            <div 
                              ref={dropdownRef}
                              className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-700/60"
                            >
                              <div className="p-2 bg-slate-50 dark:bg-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                                <span>{searchedModalStudents.length} santri tersedia</span>
                                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                  <Radio className="w-3 h-3" /> Tap kartu langsung
                                </span>
                              </div>
                              {searchedModalStudents.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400">
                                  Tidak ada santri yang cocok
                                </div>
                              ) : (
                                searchedModalStudents.map((s) => (
                                  <button
                                    key={s.id || s.nik}
                                    type="button"
                                    onClick={() => handleSelectStudent(s)}
                                    className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between transition-colors cursor-pointer"
                                  >
                                    <div>
                                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                        {s.nama_lengkap}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Kamar: {s.kamar || "Belum Set"} | {s.jenis_kelamin === "P" ? "Putri (♀)" : "Putra (♂)"}
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                      {s.kamar || "No Kamar"}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="font-semibold text-blue-900 dark:text-blue-300 truncate">
                              {formStudent.nama_lengkap}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 bg-blue-200/80 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md font-medium shrink-0">
                              {formStudent.jenis_kelamin === "P" ? "Putri" : "Putra"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormStudent(null);
                              setFormKamar("");
                              setFormSearchSantri("");
                              setTimeout(() => santriInputRef.current?.focus(), 100);
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-rose-600 font-semibold cursor-pointer underline ml-2 shrink-0"
                          >
                            Ganti
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Kamar (Terisi Otomatis) */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Kamar (Terisi Otomatis)
                      </label>
                      <div className="flex items-center px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300">
                        <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                        <span className="font-semibold truncate">
                          {formStudent ? (formStudent.kamar || "Kamar belum diatur") : "Terisi otomatis saat santri dipilih"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Baris 2: Tanggal & Keterangan Sakit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tanggal */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Tanggal Sakit <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formTglMulai}
                        onChange={(e) => setFormTglMulai(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Keterangan Sakit */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Keterangan Sakit <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Demam tinggi 38.5°C, Flu berat, Maag kambuh"
                        value={formDiagnosa}
                        onChange={(e) => setFormDiagnosa(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* === KHUSUS FORM HAID (SANTRIWATI) === */}
              {activeSubMenu === "haid" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Santriwati */}
                    <div className="relative">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Santriwati (Putri) <span className="text-rose-500">*</span>
                      </label>
                      {!formStudent ? (
                        <div className="relative">
                          <input
                            ref={santriInputRef}
                            type="text"
                            placeholder="Ketik nama / tap kartu santriwati"
                            value={formSearchSantri}
                            onFocus={() => setIsSantriDropdownOpen(true)}
                            onChange={(e) => {
                              setFormSearchSantri(e.target.value);
                              setIsSantriDropdownOpen(true);
                            }}
                            className="w-full px-3.5 py-2.5 pr-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none text-slate-400">
                            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                            <ChevronDown className="w-4 h-4" />
                          </div>

                          {isSantriDropdownOpen && (
                            <div 
                              ref={dropdownRef}
                              className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-700/60"
                            >
                              {searchedModalStudents.map((s) => (
                                <button
                                  key={s.id || s.nik}
                                  type="button"
                                  onClick={() => handleSelectStudent(s)}
                                  className="w-full px-3.5 py-2.5 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-between transition-colors cursor-pointer"
                                >
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.nama_lengkap}</div>
                                    <div className="text-[11px] text-slate-500">Kamar: {s.kamar || "Belum Set"}</div>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Putri</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-sm">
                          <span className="font-semibold text-rose-900 dark:text-rose-300">{formStudent.nama_lengkap}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormStudent(null);
                              setFormKamar("");
                              setFormSearchSantri("");
                            }}
                            className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                          >
                            Ganti
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Kamar */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                        Kamar (Terisi Otomatis)
                      </label>
                      <div className="flex items-center px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 font-semibold">
                        <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                        {formStudent ? (formStudent.kamar || "Kamar belum diatur") : "Terisi otomatis"}
                      </div>
                    </div>
                  </div>

                  {/* Tanggal Mulai Haid */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                      Tanggal Mulai Haid (Bebas Sholat)
                    </label>
                    <input
                      type="date"
                      value={formTglMulai}
                      onChange={(e) => setFormTglMulai(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}



              {/* Catatan (Hanya tampil untuk Sambang dan Haid) */}
              {activeSubMenu !== "sakit" && (
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                    Catatan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tambahkan catatan jika diperlukan..."
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white resize-y"
                  />
                </div>
              )}

              {/* Action Buttons (Sesuai Posisi & Gaya di Gambar: Buat, Buat & buat lainnya, Batal) */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Buat</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  Buat & buat lainnya
                </button>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  Batal
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL KODE SQL SUPABASE */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                    Kode SQL Database Perizinan (Supabase)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Jalankan skrip ini di menu SQL Editor Supabase untuk membuat tabel perizinan.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed max-h-[50vh] overflow-y-auto border border-slate-800 select-all">
                <pre>{sqlScriptContent}</pre>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  💡 Skrip ini mencakup tabel <code className="text-blue-500 font-bold">perizinan</code>, indeks, trigger update, RLS policies, dan publikasi realtime.
                </p>
                <button
                  onClick={handleCopySql}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      <span>Berhasil Disalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Semua Kode SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL KONFIRMASI KEMBALI / SEMBUH / SUCI */}
      {actionItemToReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">
                    {actionItemToReturn.kategori_izin === "sakit" ? "Konfirmasi Sembuh" :
                     actionItemToReturn.kategori_izin === "haid" ? "Konfirmasi Selesai Haid" : 
                     "Konfirmasi Siswa Kembali"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Perbarui status perizinan dan presensi siswa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionItemToReturn(null)}
                disabled={isProcessingAction}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    {actionItemToReturn.kategori_izin === "sambang" ? "Nama Siswa:" : "Nama Santri:"}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {actionItemToReturn.nama_siswa}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    {actionItemToReturn.kategori_izin === "sambang" ? "Kelas:" : "Kamar:"}
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {actionItemToReturn.kamar || "—"}
                  </span>
                </div>
                {actionItemToReturn.keperluan && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Keperluan:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-right truncate max-w-[200px]">
                      {actionItemToReturn.keperluan}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {actionItemToReturn.kategori_izin === "sakit"
                  ? `Tandai ${actionItemToReturn.nama_siswa} sudah sembuh & kembali aktif berkegiatan di pondok?`
                  : actionItemToReturn.kategori_izin === "haid"
                  ? `Tandai ${actionItemToReturn.nama_siswa} sudah suci (mandi wajib) & kembali melaksanakan sholat berjamaah?`
                  : `Tandai ${actionItemToReturn.nama_siswa} sudah selesai sambang dan kembali ke pondok? Status presensi akan dikembalikan menjadi Aktif.`}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActionItemToReturn(null)}
                  disabled={isProcessingAction}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => executeMarkReturned(actionItemToReturn)}
                  disabled={isProcessingAction}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAction ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {actionItemToReturn.kategori_izin === "sakit" ? "Ya, Tandai Sembuh" :
                         actionItemToReturn.kategori_izin === "haid" ? "Ya, Tandai Suci" : 
                         "Ya, Tandai Sudah Kembali"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL KONFIRMASI HAPUS CATATAN */}
      {actionItemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                    Hapus Catatan Izin
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Konfirmasi penghapusan data
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionItemToDelete(null)}
                disabled={isProcessingAction}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus catatan izin {actionItemToDelete.kategori_izin} untuk <strong className="text-slate-900 dark:text-white">{actionItemToDelete.nama_siswa}</strong>?
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActionItemToDelete(null)}
                  disabled={isProcessingAction}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => executeDeleteItem(actionItemToDelete)}
                  disabled={isProcessingAction}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAction ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Permanen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
