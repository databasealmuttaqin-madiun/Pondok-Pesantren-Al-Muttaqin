import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import PageHeader from "./PageHeader";
import { 
  BookOpen, 
  BookCheck, 
  Award, 
  Search, 
  Eye, 
  Edit3, 
  CheckSquare, 
  Square, 
  Users, 
  CheckCircle2, 
  Filter, 
  RotateCcw, 
  X, 
  Save, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Sparkles, 
  Shield,
  Layers,
  ArrowRight,
  UserCheck,
  AlertCircle
} from "lucide-react";

export interface MateriItem {
  id: number | string;
  nama_materi: string;
  kelompok?: string;
  jumlah_halaman: number;
  urutan?: number;
}

export interface CapaianSantriRecord {
  id: string; // `${santri_id}_${materi_id}`
  santri_id: string | number;
  santri_nama: string;
  kamar: string;
  kelas_pengajian: string;
  materi_id: number | string;
  materi_nama: string;
  total_halaman: number;
  belum_disampaikan: boolean;
  halaman_dimaknai: number[]; // e.g. [1, 2, 3, 4, 5]
  catatan?: string;
  updated_at: string;
  updated_by?: string;
}

interface CapaianMateriPanelProps {
  initialTab?: "santri" | "agregat";
  currentUserRole?: string;
  userTugasTambahan?: string[];
  currentUser?: any;
  students?: any[];
  recitationClasses?: string[];
  rooms?: string[];
  onTriggerNotification?: (message: string, type: "success" | "error" | "warning") => void;
}

// Default fallback list of materials/books: Juz 1-30 first (Al-Qur'an), then Al-Hadist / Kitab Kuning
const DEFAULT_MATERI_LIST: MateriItem[] = [
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `juz_${i + 1}`,
    nama_materi: `Juz ${i + 1}`,
    kelompok: "alquran",
    jumlah_halaman: i === 29 ? 24 : 20,
    urutan: i + 1
  })),
  { id: "k_ahkam", nama_materi: "K. Ahkam", kelompok: "hadist", jumlah_halaman: 124, urutan: 31 },
  { id: "k_jihad", nama_materi: "K. Jihad", kelompok: "hadist", jumlah_halaman: 63, urutan: 32 },
  { id: "k_hajji", nama_materi: "K. Hajji", kelompok: "hadist", jumlah_halaman: 111, urutan: 33 },
  { id: "k_manasik", nama_materi: "K. Manasiki Hajji", kelompok: "hadist", jumlah_halaman: 113, urutan: 34 },
  { id: "k_imaroh", nama_materi: "K. Imaroh", kelompok: "hadist", jumlah_halaman: 80, urutan: 35 },
  { id: "k_safinah", nama_materi: "Kitab Safinatun Najah", kelompok: "hadist", jumlah_halaman: 35, urutan: 36 },
  { id: "k_talim", nama_materi: "Kitab Ta'lim Muta'allim", kelompok: "hadist", jumlah_halaman: 80, urutan: 37 },
  { id: "k_aqidah", nama_materi: "Kitab Aqidatul Awam", kelompok: "hadist", jumlah_halaman: 30, urutan: 38 },
  { id: "k_mabadi", nama_materi: "Kitab Mabadi Fiqhiyyah", kelompok: "hadist", jumlah_halaman: 50, urutan: 39 },
  { id: "k_hidayatus", nama_materi: "Kitab Hidayatus Shibyan", kelompok: "hadist", jumlah_halaman: 40, urutan: 40 },
];

export default function CapaianMateriPanel({
  initialTab = "santri",
  currentUserRole = "viewer",
  userTugasTambahan = [],
  currentUser = null,
  students = [],
  recitationClasses = [],
  rooms = [],
  onTriggerNotification
}: CapaianMateriPanelProps) {
  // Main Tab: "santri" (Capaian Materi Siswa) or "agregat" (Capaian Materi Kelas / Asrama)
  const [activeMainTab, setActiveMainTab] = useState<"santri" | "agregat">(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveMainTab(initialTab);
    }
  }, [initialTab]);

  // Master Data
  const [materiList, setMateriList] = useState<MateriItem[]>(DEFAULT_MATERI_LIST);
  const [capaianRecords, setCapaianRecords] = useState<Record<string, CapaianSantriRecord>>({});
  const [assignedKamarIds, setAssignedKamarIds] = useState<string[]>([]);
  const [waliKamarMapping, setWaliKamarMapping] = useState<Record<string, string>>({});
  const [masterRecitationClasses, setMasterRecitationClasses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("manajemen_recitation_classes");
      if (saved) return JSON.parse(saved);
    } catch {}
    return recitationClasses || [];
  });
  const [masterRooms, setMasterRooms] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("manajemen_rooms");
      if (saved) return JSON.parse(saved);
    } catch {}
    return rooms || [];
  });
  const [isLoading, setIsLoading] = useState(false);

  // Filters for Tab 1 (Capaian Per Santri)
  const [filterKamar, setFilterKamar] = useState<string>("All");
  const [filterKelas, setFilterKelas] = useState<string>("All");
  const [selectedMateriId, setSelectedMateriId] = useState<number | string>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filters for Tab 2 (Agregat Rata-rata)
  const [agregatMateriId, setAgregatMateriId] = useState<number | string>(1);
  const [agregatTahun, setAgregatTahun] = useState<string>("2025/2026");
  const [agregatGroupMode, setAgregatGroupMode] = useState<"kamar" | "kelas">("kamar");

  // Modal State Update
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [formBelumDisampaikan, setFormBelumDisampaikan] = useState(false);
  const [formHalamanDimaknai, setFormHalamanDimaknai] = useState<number[]>([]);
  const [formCatatan, setFormCatatan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageRangeStart, setPageRangeStart] = useState<number>(1); // For book pagination ranges e.g. 1-100

  // Modal State View Detail
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<any | null>(null);

  // RBAC Role checks
  const roleLower = String(currentUserRole || "").toLowerCase();
  const userPeran = String(currentUser?.peran_utama || currentUser?.role || "").toLowerCase();
  const tugasList = userTugasTambahan.map(t => String(t).toLowerCase());

  const isAdminOrPengasuh = 
    roleLower.includes("admin") || 
    roleLower.includes("super") || 
    roleLower.includes("pimpinan") || 
    userPeran.includes("admin") ||
    userPeran.includes("super") ||
    tugasList.some(t => t.includes("pengasuh") || t.includes("pembina") || t.includes("pondok"));

  const isWaliKamarUser = 
    !isAdminOrPengasuh && 
    (roleLower.includes("wali") || roleLower.includes("kamar") || userPeran.includes("wali") || tugasList.some(t => t.includes("wali") || t.includes("kamar")));

  // 1. Initial Load: Fetch Plotting Wali Kamar, Materi, and Capaian Records
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // A. Load Materi Pengajian
      const { data: dbMateri } = await supabase
        .from("materi_pengajian")
        .select("id, nama_materi, kelompok, jumlah_halaman, urutan")
        .order("urutan", { ascending: true });

      if (dbMateri && dbMateri.length > 0) {
        setMateriList(dbMateri);
        if (dbMateri[0]?.id) {
          setSelectedMateriId(dbMateri[0].id);
          setAgregatMateriId(dbMateri[0].id);
        }
      }

      // B. Load Plotting Wali Kamar
      let plottingList: any[] = [];
      const { data: dbPlotting } = await supabase
        .from("plotting_wali_kamar")
        .select("id, pengguna_id, nama, kamar");

      if (dbPlotting && dbPlotting.length > 0) {
        plottingList = dbPlotting;
      } else {
        try {
          const saved = localStorage.getItem("plotting_wali_kamar_data");
          if (saved) plottingList = JSON.parse(saved);
        } catch (e) {}
      }

      // Load master list of kelas pengajian strictly from 'plotting' table
      try {
        const { data: plotRecitation } = await supabase
          .from("plotting")
          .select("nama")
          .eq("jenis", "kelas pengajian");

        if (plotRecitation && plotRecitation.length > 0) {
          const classMap = new Map<string, string>();
          plotRecitation.forEach((r: any) => {
            if (r.nama && String(r.nama).trim()) {
              const raw = String(r.nama).trim();
              const key = raw.toLowerCase();
              if (!classMap.has(key)) {
                classMap.set(key, raw);
              }
            }
          });
          const dbRecitationList = Array.from(classMap.values()).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
          );
          setMasterRecitationClasses(dbRecitationList);
          localStorage.setItem("manajemen_recitation_classes", JSON.stringify(dbRecitationList));
        }
      } catch (err) {
        console.warn("Notice fetch plotting kelas pengajian:", err);
      }

      // Load master list of kamar strictly from 'plotting' table
      try {
        const { data: plotRooms } = await supabase
          .from("plotting")
          .select("nama")
          .eq("jenis", "kamar");

        if (plotRooms && plotRooms.length > 0) {
          const roomMap = new Map<string, string>();
          plotRooms.forEach((r: any) => {
            if (r.nama && String(r.nama).trim()) {
              const raw = String(r.nama).trim();
              const key = raw.toLowerCase();
              if (!roomMap.has(key)) {
                roomMap.set(key, raw);
              }
            }
          });
          const dbRoomList = Array.from(roomMap.values()).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
          );
          setMasterRooms(dbRoomList);
          localStorage.setItem("manajemen_rooms", JSON.stringify(dbRoomList));
        }
      } catch (err) {
        console.warn("Notice fetch plotting kamar:", err);
      }

      // Build Wali Kamar Name Mapping per Room
      const waliMap: Record<string, string> = {};
      const myRooms: string[] = [];
      const myUserId = String(currentUser?.id || "");
      const myName = String(currentUser?.nama || currentUser?.nama_lengkap || "").toLowerCase();

      plottingList.forEach((item: any) => {
        if (item.kamar) {
          waliMap[item.kamar] = item.nama || "Wali Kamar";
        }
        // Check match with current logged-in user
        const itemUserId = String(item.pengguna_id || "");
        const itemNama = String(item.nama || "").toLowerCase();

        if (
          (myUserId && itemUserId === myUserId) ||
          (myName && itemNama.includes(myName)) ||
          (myName && myName.includes(itemNama))
        ) {
          if (item.kamar && !myRooms.includes(item.kamar)) {
            myRooms.push(item.kamar);
          }
        }
      });

      setWaliKamarMapping(waliMap);
      setAssignedKamarIds(myRooms);

      if (isWaliKamarUser && myRooms.length > 0) {
        setFilterKamar(myRooms[0]);
      }

      // C. Load Capaian Records
      let localRecords: Record<string, CapaianSantriRecord> = {};
      try {
        const savedCap = localStorage.getItem("capaian_materi_santri_data");
        if (savedCap) {
          localRecords = JSON.parse(savedCap);
        }
      } catch (e) {}

      // Try load from Supabase if table exists
      try {
        const { data: dbCap, error: capErr } = await supabase.from("capaian_santri").select("*");
        if (capErr) {
          console.warn("Supabase fetch capaian_santri warning:", capErr.message);
        } else if (dbCap && dbCap.length > 0) {
          dbCap.forEach((rec: any) => {
            const key = `${rec.santri_id}_${rec.materi_id}`;
            localRecords[key] = {
              id: key,
              santri_id: rec.santri_id,
              santri_nama: rec.santri_nama || "",
              kamar: rec.kamar || "",
              kelas_pengajian: rec.kelas_pengajian || "",
              materi_id: rec.materi_id,
              materi_nama: rec.materi_nama || "",
              total_halaman: Number(rec.total_halaman) || 40,
              belum_disampaikan: Boolean(rec.belum_disampaikan),
              halaman_dimaknai: Array.isArray(rec.halaman_dimaknai) ? rec.halaman_dimaknai : [],
              catatan: rec.catatan || "",
              updated_at: rec.updated_at || new Date().toISOString(),
              updated_by: rec.updated_by || "Guru / Wali Kamar"
            };
          });
        }
      } catch (e) {
        // Table might not exist yet, fallback cleanly to localRecords
      }

      setCapaianRecords(localRecords);
    } catch (err) {
      console.warn("Notice loading capaian materi data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [currentUser, isWaliKamarUser]);

  // Selected Material object
  const currentMateri = useMemo(() => {
    return materiList.find(m => String(m.id) === String(selectedMateriId)) || materiList[0] || DEFAULT_MATERI_LIST[0];
  }, [materiList, selectedMateriId]);

  const agregatMateri = useMemo(() => {
    return materiList.find(m => String(m.id) === String(agregatMateriId)) || materiList[0] || DEFAULT_MATERI_LIST[0];
  }, [materiList, agregatMateriId]);

  // Canonical resolvers to ensure names match strictly with plotting table
  const getCanonicalRecitationClass = (rawName: string | undefined | null): string => {
    if (!rawName) return "Tanpa Kelas";
    const trimmed = String(rawName).trim();
    if (!trimmed) return "Tanpa Kelas";
    
    // Check masterRecitationClasses loaded from plotting table
    const found = masterRecitationClasses.find(
      (c) => c && c.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (found) return found.trim();

    // Check props
    const foundProp = recitationClasses.find(
      (c) => c && c.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (foundProp) return foundProp.trim();

    return trimmed;
  };

  const getCanonicalRoom = (rawName: string | undefined | null): string => {
    if (!rawName) return "Tanpa Kamar";
    const trimmed = String(rawName).trim();
    if (!trimmed) return "Tanpa Kamar";
    
    const found = masterRooms.find(
      (r) => r && r.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (found) return found.trim();

    const foundProp = rooms.find(
      (r) => r && r.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (foundProp) return foundProp.trim();

    return trimmed;
  };

  // Unique lists of rooms and classes
  const availableRooms = useMemo(() => {
    if (isWaliKamarUser && assignedKamarIds.length > 0) {
      return assignedKamarIds;
    }
    const roomMap = new Map<string, string>();
    masterRooms.forEach((r) => {
      if (r && r.trim()) {
        const key = r.trim().toLowerCase();
        if (!roomMap.has(key)) roomMap.set(key, r.trim());
      }
    });
    rooms.forEach((r) => {
      if (r && r.trim()) {
        const key = r.trim().toLowerCase();
        if (!roomMap.has(key)) roomMap.set(key, r.trim());
      }
    });
    students.forEach((s) => {
      if (s.kamar && s.kamar.trim()) {
        const canonical = getCanonicalRoom(s.kamar);
        const key = canonical.toLowerCase();
        if (!roomMap.has(key)) roomMap.set(key, canonical);
      }
    });
    return Array.from(roomMap.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [masterRooms, rooms, students, isWaliKamarUser, assignedKamarIds]);

  const availableClasses = useMemo(() => {
    const classMap = new Map<string, string>();
    // 1. Priority: Plotting table master recitation classes
    masterRecitationClasses.forEach((c) => {
      if (c && c.trim()) {
        const key = c.trim().toLowerCase();
        if (!classMap.has(key)) classMap.set(key, c.trim());
      }
    });
    // 2. Props / Cache
    recitationClasses.forEach((c) => {
      if (c && c.trim()) {
        const key = c.trim().toLowerCase();
        if (!classMap.has(key)) classMap.set(key, c.trim());
      }
    });
    // 3. Fallback from students
    students.forEach((s) => {
      if (s.kelas_pengajian && s.kelas_pengajian.trim()) {
        const canonical = getCanonicalRecitationClass(s.kelas_pengajian);
        const key = canonical.toLowerCase();
        if (!classMap.has(key)) classMap.set(key, canonical);
      }
    });
    return Array.from(classMap.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [masterRecitationClasses, recitationClasses, students]);

  // Filtered Students list according to RBAC and search
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. RBAC Wali Kamar Restriction
      if (isWaliKamarUser && assignedKamarIds.length > 0) {
        const studentKamar = student.kamar || "";
        if (!assignedKamarIds.includes(studentKamar)) return false;
      }

      // 2. Room Dropdown Filter
      if (filterKamar !== "All") {
        const studentRoomCanonical = getCanonicalRoom(student.kamar).toLowerCase();
        const targetRoomCanonical = filterKamar.trim().toLowerCase();
        const rawRoom = (student.kamar || "").trim().toLowerCase();
        if (studentRoomCanonical !== targetRoomCanonical && rawRoom !== targetRoomCanonical) {
          return false;
        }
      }

      // 3. Class Dropdown Filter (Case-insensitive & Canonical match)
      if (filterKelas !== "All") {
        const studentClassCanonical = getCanonicalRecitationClass(student.kelas_pengajian).toLowerCase();
        const targetClassCanonical = filterKelas.trim().toLowerCase();
        const rawClass = (student.kelas_pengajian || "").trim().toLowerCase();
        if (studentClassCanonical !== targetClassCanonical && rawClass !== targetClassCanonical) {
          return false;
        }
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nama = (student.nama_lengkap || student.nama || "").toLowerCase();
        if (!nama.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [students, isWaliKamarUser, assignedKamarIds, filterKamar, filterKelas, searchQuery, masterRecitationClasses, masterRooms]);

  // Helper to compute progress percentage for a student & book
  const getCapaianData = (studentId: string | number, materiId: string | number) => {
    const key = `${studentId}_${materiId}`;
    const rec = capaianRecords[key];
    const totalPages = currentMateri?.jumlah_halaman || 40;

    if (!rec) {
      return {
        key,
        belum_disampaikan: false,
        halaman_dimaknai: [] as number[],
        count: 0,
        totalPages,
        percentage: 0,
        catatan: "",
        updated_at: "-",
        updated_by: "-"
      };
    }

    if (rec.belum_disampaikan) {
      return {
        key,
        belum_disampaikan: true,
        halaman_dimaknai: [],
        count: 0,
        totalPages: rec.total_halaman || totalPages,
        percentage: 0,
        catatan: rec.catatan || "",
        updated_at: rec.updated_at,
        updated_by: rec.updated_by
      };
    }

    const count = rec.halaman_dimaknai ? rec.halaman_dimaknai.length : 0;
    const maxPages = rec.total_halaman || totalPages;
    const percentage = maxPages > 0 ? Math.min(100, Math.round((count / maxPages) * 1000) / 10) : 0;

    return {
      key,
      belum_disampaikan: false,
      halaman_dimaknai: rec.halaman_dimaknai || [],
      count,
      totalPages: maxPages,
      percentage,
      catatan: rec.catatan || "",
      updated_at: rec.updated_at,
      updated_by: rec.updated_by
    };
  };

  // Helper for Al-Qur'an Progress (%)
  const getAlQuranProgress = (studentId: string | number) => {
    const quranItems = materiList.filter(m => m.kelompok === 'alquran' || String(m.nama_materi).toLowerCase().includes("juz") || String(m.nama_materi).toLowerCase().includes("qur'an"));
    const totalPages = 604;
    let completedPages = 0;
    quranItems.forEach(q => {
      const key = `${studentId}_${q.id}`;
      const rec = capaianRecords[key];
      if (rec && !rec.belum_disampaikan && rec.halaman_dimaknai) {
        completedPages += rec.halaman_dimaknai.length;
      }
    });
    const percentage = totalPages > 0 ? Math.min(100, Math.round((completedPages / totalPages) * 1000) / 10) : 0;
    return { count: completedPages, total: totalPages, percentage };
  };

  // Helper for Al-Hadist / Kitab Progress (%)
  const getAlHadistProgress = (student: any) => {
    const kitabItems = materiList.filter(m => m.kelompok !== 'alquran' && !String(m.nama_materi).toLowerCase().includes("juz") && !String(m.nama_materi).toLowerCase().includes("qur'an"));
    if (kitabItems.length === 0) return { count: 0, total: 100, percentage: 0 };
    
    let totalPagesSum = 0;
    let completedPagesSum = 0;
    
    kitabItems.forEach(kitab => {
      const total = kitab.jumlah_halaman || 40;
      totalPagesSum += total;
      const key = `${student.id}_${kitab.id}`;
      const rec = capaianRecords[key];
      if (rec && !rec.belum_disampaikan && rec.halaman_dimaknai) {
        completedPagesSum += rec.halaman_dimaknai.length;
      }
    });

    const percentage = totalPagesSum > 0 ? Math.min(100, Math.round((completedPagesSum / totalPagesSum) * 1000) / 10) : 0;
    return { count: completedPagesSum, total: totalPagesSum, percentage };
  };

  const [studentCapacities, setStudentCapacities] = useState<Record<string, { halaman_dimaknai: number[], belum_disampaikan: boolean, catatan: string }>>({});

  // Open Edit Page (dedicated sub-page view)
  const handleOpenEditModal = (student: any) => {
    setEditingStudent(student);
    const caps: Record<string, { halaman_dimaknai: number[], belum_disampaikan: boolean, catatan: string }> = {};
    materiList.forEach(m => {
      const key = `${student.id}_${m.id}`;
      const rec = capaianRecords[key];
      caps[m.id] = {
        halaman_dimaknai: rec?.halaman_dimaknai ? [...rec.halaman_dimaknai] : [],
        belum_disampaikan: rec ? Boolean(rec.belum_disampaikan) : false,
        catatan: rec?.catatan || ""
      };
    });
    setStudentCapacities(caps);
  };

  // Open View Modal
  const handleOpenViewModal = (student: any) => {
    setViewingStudent(student);
    setIsViewModalOpen(true);
  };

  // Bulk Select All / Unselect All
  const handleSelectAllPages = () => {
    const total = currentMateri?.jumlah_halaman || 40;
    const allPages = Array.from({ length: total }, (_, i) => i + 1);
    setFormHalamanDimaknai(allPages);
    setFormBelumDisampaikan(false);
  };

  const handleClearAllPages = () => {
    setFormHalamanDimaknai([]);
  };

  // Toggle single page
  const handleTogglePage = (pageNum: number) => {
    if (formBelumDisampaikan) return;
    setFormHalamanDimaknai(prev => {
      if (prev.includes(pageNum)) {
        return prev.filter(p => p !== pageNum);
      } else {
        return [...prev, pageNum].sort((a, b) => a - b);
      }
    });
  };

  // Toggle range of pages (e.g., select page range)
  const handleSelectRange = (start: number, end: number, value: boolean) => {
    if (formBelumDisampaikan) return;
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setFormHalamanDimaknai(prev => {
      const setP = new Set(prev);
      range.forEach(p => {
        if (value) setP.add(p);
        else setP.delete(p);
      });
      return Array.from(setP).sort((a, b) => a - b);
    });
  };

  // Save All Capaian Progress for all materials in 1 page
  const handleSaveAllCapacities = async () => {
    if (!editingStudent) return;
    setIsSubmitting(true);
    try {
      const updatedRecords = { ...capaianRecords };
      const nowIso = new Date().toISOString();
      const updaterName = currentUser?.nama || currentUser?.nama_lengkap || (isWaliKamarUser ? "Wali Kamar" : "Guru Pengasuh");

      for (const m of materiList) {
        const capData = studentCapacities[m.id] || { halaman_dimaknai: [], belum_disampaikan: false, catatan: "" };
        const key = `${editingStudent.id}_${m.id}`;
        const totalPages = m.jumlah_halaman || 40;

        const newRec: CapaianSantriRecord = {
          id: key,
          santri_id: editingStudent.id,
          santri_nama: editingStudent.nama_lengkap || editingStudent.nama || "",
          kamar: editingStudent.kamar || "",
          kelas_pengajian: editingStudent.kelas_pengajian || "",
          materi_id: m.id,
          materi_nama: m.nama_materi,
          total_halaman: totalPages,
          belum_disampaikan: capData.belum_disampaikan,
          halaman_dimaknai: capData.belum_disampaikan ? [] : capData.halaman_dimaknai,
          catatan: capData.catatan,
          updated_at: nowIso,
          updated_by: updaterName
        };

        updatedRecords[key] = newRec;

        try {
          await supabase.from("capaian_santri").upsert({
            id: String(key),
            santri_id: String(editingStudent.id),
            santri_nama: editingStudent.nama_lengkap || editingStudent.nama || "",
            kamar: editingStudent.kamar || "",
            kelas_pengajian: editingStudent.kelas_pengajian || "",
            materi_id: m.id,
            materi_nama: m.nama_materi,
            total_halaman: totalPages,
            belum_disampaikan: capData.belum_disampaikan,
            halaman_dimaknai: capData.belum_disampaikan ? [] : capData.halaman_dimaknai,
            catatan: capData.catatan,
            updated_at: nowIso,
            updated_by: updaterName
          }, { onConflict: 'id' });
        } catch (err) {}
      }

      setCapaianRecords(updatedRecords);
      localStorage.setItem("capaian_materi_santri_data", JSON.stringify(updatedRecords));
      if (onTriggerNotification) {
        onTriggerNotification("Capaian seluruh materi santri berhasil disimpan ke Supabase!", "success");
      }
      setEditingStudent(null);
    } catch (err: any) {
      if (onTriggerNotification) {
        onTriggerNotification("Gagal menyimpan capaian materi: " + err?.message, "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grouped Agregat Data for Tab 2
  const agregatCardsData = useMemo(() => {
    const totalPages = agregatMateri?.jumlah_halaman || 40;
    const groupsMap: Record<string, {
      name: string;
      wali: string;
      students: any[];
      totalPagesSum: number;
      completedPagesSum: number;
    }> = {};

    students.forEach(student => {
      // Filter for Wali Kamar role in Tab 2 as well
      if (isWaliKamarUser && assignedKamarIds.length > 0) {
        if (!assignedKamarIds.includes(student.kamar || "")) return;
      }

      const groupName = agregatGroupMode === "kamar" 
        ? getCanonicalRoom(student.kamar)
        : getCanonicalRecitationClass(student.kelas_pengajian);

      if (!groupsMap[groupName]) {
        groupsMap[groupName] = {
          name: groupName,
          wali: agregatGroupMode === "kamar" 
            ? (waliKamarMapping[groupName] || waliKamarMapping[student.kamar || ""] || "Belum Dibatasi") 
            : "Pengajar Kelas",
          students: [],
          totalPagesSum: 0,
          completedPagesSum: 0
        };
      }

      groupsMap[groupName].students.push(student);

      const capData = getCapaianData(student.id, agregatMateri.id);
      groupsMap[groupName].completedPagesSum += capData.count;
      groupsMap[groupName].totalPagesSum += totalPages;
    });

    return Object.values(groupsMap).map(grp => {
      const studentCount = grp.students.length;
      const maxPossiblePages = studentCount * totalPages;
      const avgPercentage = maxPossiblePages > 0 
        ? Math.min(100, Math.round((grp.completedPagesSum / maxPossiblePages) * 1000) / 10) 
        : 0;

      const avgPageNumber = studentCount > 0 
        ? Math.round(grp.completedPagesSum / studentCount) 
        : 0;

      return {
        groupName: grp.name,
        waliName: grp.wali,
        studentCount,
        avgPercentage,
        avgPageNumber,
        totalPages
      };
    }).sort((a, b) => a.groupName.localeCompare(b.groupName, undefined, { numeric: true, sensitivity: "base" }));
  }, [students, isWaliKamarUser, assignedKamarIds, agregatGroupMode, agregatMateri, waliKamarMapping, capaianRecords, masterRecitationClasses, masterRooms]);

  // Pagination for book page grid if pages exceed 100
  const maxPagesToDisplay = currentMateri?.jumlah_halaman || 40;
  const pageRanges = useMemo(() => {
    if (maxPagesToDisplay <= 100) return [];
    const ranges: { start: number; end: number; label: string }[] = [];
    for (let i = 1; i <= maxPagesToDisplay; i += 100) {
      const end = Math.min(i + 99, maxPagesToDisplay);
      ranges.push({
        start: i,
        end,
        label: `Hal ${i} - ${end}`
      });
    }
    return ranges;
  }, [maxPagesToDisplay]);

  const activePageEnd = useMemo(() => {
    if (maxPagesToDisplay <= 100) return maxPagesToDisplay;
    return Math.min(pageRangeStart + 99, maxPagesToDisplay);
  }, [pageRangeStart, maxPagesToDisplay]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in" id="capaian_materi_module">
      {/* 1. PAGE HEADER */}
      <PageHeader 
        category="Pembelajaran & Asrama" 
        title={activeMainTab === "santri" ? "Capaian Materi Siswa" : "Capaian Materi Kelas / Asrama"} 
        description={activeMainTab === "santri" 
          ? "Pantau dan perbarui perkembangan makna kitab dan Juz Al-Qur'an santri secara perorangan."
          : "Pantau rata-rata capaian halaman materi dan makna kitab per kelas pengajian atau asrama kamar."
        }
        actionButton={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Terhubung Supabase
            </span>

            <button
              type="button"
              onClick={loadInitialData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Sinkronisasi & Muat Ulang Data dari Supabase"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-500" : ""}`} />
              <span>{isLoading ? "Memuat..." : "Refresh Database"}</span>
            </button>
          </div>
        }
      />

      {/* Wali Kamar Restriction Banner Notice if active */}
      {isWaliKamarUser && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-200 text-xs sm:text-sm">
          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Akses Wali Kamar Aktif:</span> Menampilkan dan mengelola khusus santri di kamar binaan Anda ({assignedKamarIds.join(", ") || "Kamar Anda"}).
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* 2. DEDICATED EDIT PAGE: JIKA SEDANG INPUT / UBAH CAPAIAN SANTRI */}
      {/* ======================================================================== */}
      {editingStudent ? (
        <div className="space-y-6 animate-fade-in pb-12">
          {/* Top Header & Breadcrumb */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Data Santri / Ubah Capaian Makna
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {editingStudent.nama_lengkap || editingStudent.nama}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kamar: <strong className="text-slate-700 dark:text-slate-300">{editingStudent.kamar || "—"}</strong> • NISN: {editingStudent.nisn || "—"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal / Kembali
              </button>
              <button
                type="button"
                onClick={handleSaveAllCapacities}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? "Menyimpan..." : "Simpan Semua Capaian"}</span>
              </button>
            </div>
          </div>

          {/* Section Notice */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <strong>Formulir Pengisian Lengkap (1 Halaman):</strong> Silakan centang halaman yang sudah dimaknai untuk setiap Juz Al-Qur'an (Juz 1–30) terlebih dahulu, kemudian Kitab-kitab Al-Hadist / Kuning di bawahnya.
            </div>
          </div>

          {/* All Materials List in 1 Page */}
          <div className="space-y-4">
            {materiList.map((materi, idx) => {
              const capData = studentCapacities[materi.id] || { halaman_dimaknai: [], belum_disampaikan: false, catatan: "" };
              const totalPages = materi.jumlah_halaman || 40;
              const selectedCount = capData.halaman_dimaknai.length;
              const percentage = totalPages > 0 ? Math.min(100, Math.round((selectedCount / totalPages) * 1000) / 10) : 0;

              return (
                <div 
                  key={materi.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4"
                >
                  {/* Header Kitab / Juz */}
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                          {materi.nama_materi}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Total: {totalPages} Halaman • Capaian: <strong className="text-emerald-600 dark:text-emerald-400">{percentage}%</strong> ({selectedCount}/{totalPages} Hal)
                        </p>
                      </div>
                    </div>

                    {/* Checkbox Belum Disampaikan */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`belum_${materi.id}`}
                        checked={capData.belum_disampaikan}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setStudentCapacities(prev => ({
                            ...prev,
                            [materi.id]: {
                              ...capData,
                              belum_disampaikan: checked,
                              halaman_dimaknai: checked ? [] : capData.halaman_dimaknai
                            }
                          }));
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                      <label htmlFor={`belum_${materi.id}`} className="text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                        Belum Disampaikan
                      </label>
                    </div>
                  </div>

                  {!capData.belum_disampaikan && (
                    <div className="space-y-3 pt-1">
                      {/* Bulk Actions */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Pilih Halaman Yang Sudah Dimaknai:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
                              setStudentCapacities(prev => ({
                                ...prev,
                                [materi.id]: { ...capData, halaman_dimaknai: allPages }
                              }));
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Pilih Semua</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStudentCapacities(prev => ({
                                ...prev,
                                [materi.id]: { ...capData, halaman_dimaknai: [] }
                              }));
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>Hapus Semua</span>
                          </button>
                        </div>
                      </div>

                      {/* Numeric Buttons Grid */}
                      <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-2 max-h-56 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 justify-items-center">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
                          const isChecked = capData.halaman_dimaknai.includes(num);
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => {
                                const currentArr = capData.halaman_dimaknai;
                                const newArr = isChecked 
                                  ? currentArr.filter(p => p !== num) 
                                  : [...currentArr, num].sort((a, b) => a - b);
                                setStudentCapacities(prev => ({
                                  ...prev,
                                  [materi.id]: { ...capData, halaman_dimaknai: newArr }
                                }));
                              }}
                              className={`w-8 h-8 text-xs font-bold rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                isChecked
                                  ? "bg-emerald-500 text-white shadow-xs hover:bg-emerald-600"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Catatan / Keterangan */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Catatan / Keterangan ({materi.nama_materi})
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Lancar, tajwid baik..."
                      value={capData.catatan}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStudentCapacities(prev => ({
                          ...prev,
                          [materi.id]: { ...capData, catatan: val }
                        }));
                      }}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveAllCapacities}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Semua Capaian"}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ======================================================================== */}
          {/* TAB 1: CAPAIAN PER SANTRI */}
          {/* ======================================================================== */}
          {activeMainTab === "santri" && (
        <div className="space-y-6">
          {/* FILTER BAR TAB 1 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Dropdown 1: Pilih Kamar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Kamar
                </label>
                <select
                  value={filterKamar}
                  disabled={isWaliKamarUser && assignedKamarIds.length === 1}
                  onChange={(e) => setFilterKamar(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-900"
                >
                  {!isWaliKamarUser && <option value="All">Semua Kamar</option>}
                  {availableRooms.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown 2: Kelas Pengajian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kelas Pengajian
                </label>
                <select
                  value={filterKelas}
                  onChange={(e) => setFilterKelas(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="All">Semua Kelas Pengajian</option>
                  {availableClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown 3: Pilih Kitab / Materi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Kitab / Materi
                </label>
                <select
                  value={selectedMateriId}
                  onChange={(e) => setSelectedMateriId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {materiList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama_materi} ({m.jumlah_halaman} Hal)
                    </option>
                  ))}
                </select>
              </div>

              {/* Input 4: Search Santri / NISN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cari Santri
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Nama santri / NISN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TABEL DAFTAR CAPAIAN SANTRI */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BookCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                  Matriks Capaian {currentMateri?.nama_materi}
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">
                Total: {filteredStudents.length} Santri
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] font-bold">
                    <th className="py-3 px-4 w-12 text-center">NO</th>
                    <th className="py-3 px-4">NAMA SANTRI & NISN</th>
                    <th className="py-3 px-4">KAMAR</th>
                    <th className="py-3 px-4 w-44 text-center">CAPAIAN AL-QUR'AN (%)</th>
                    <th className="py-3 px-4 w-44 text-center">CAPAIAN AL-HADIST (%)</th>
                    <th className="py-3 px-4 w-36 text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student, idx) => {
                      const quranProg = getAlQuranProgress(student.id);
                      const hadistProg = getAlHadistProgress(student);

                      return (
                        <tr 
                          key={student.id || idx}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-center font-semibold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-100">
                                  {student.nama_lengkap || student.nama}
                                </div>
                                <div className="text-xs text-slate-400 font-medium">
                                  NISN: {student.nisn || student.nis || "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                              {student.kamar || "—"}
                            </span>
                          </td>
                          {/* Kolom 1: Capaian Al-Qur'an (%) */}
                          <td className="py-3 px-4 text-center">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                                <span className="text-emerald-600 dark:text-emerald-400">{quranProg.percentage}%</span>
                                <span className="text-[11px] font-normal text-slate-400">
                                  {quranProg.count}/{quranProg.total} Hal
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${quranProg.percentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          {/* Kolom 2: Capaian Al-Hadist (%) */}
                          <td className="py-3 px-4 text-center">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                                <span className="text-blue-600 dark:text-blue-400">{hadistProg.percentage}%</span>
                                <span className="text-[11px] font-normal text-slate-400">
                                  {hadistProg.count}/{hadistProg.total} Hal
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${hadistProg.percentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Lihat Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenViewModal(student)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                title="Lihat Detail Capaian"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Lihat</span>
                              </button>

                              {/* Ubah Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(student)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                                title="Ubah Capaian Halaman"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Ubah</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Tidak ada data santri yang sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 2: CAPAIAN PER KELAS / ASRAMA (RATA-RATA AGREGAT) */}
      {/* ======================================================================== */}
      {activeMainTab === "agregat" && (
        <div className="space-y-6">
          {/* FILTER BAR TAB 2 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Dropdown 1: Pilih Kitab / Materi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Kitab / Materi
                </label>
                <select
                  value={agregatMateriId}
                  onChange={(e) => setAgregatMateriId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {materiList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama_materi} ({m.jumlah_halaman} Hal)
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown 2: Tahun Ajaran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tahun Ajaran
                </label>
                <select
                  value={agregatTahun}
                  onChange={(e) => setAgregatTahun(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="2025/2026">2025 / 2026</option>
                  <option value="2026/2027">2026 / 2027</option>
                </select>
              </div>

              {/* Toggle View Mode: Per Kamar vs Per Kelas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kelompokkan Berdasarkan
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAgregatGroupMode("kamar")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      agregatGroupMode === "kamar"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Per Asrama / Kamar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgregatGroupMode("kelas")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      agregatGroupMode === "kelas"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Per Kelas Pengajian
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* GRID CARD KELAS / ASRAMA */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agregatCardsData.length > 0 ? (
              agregatCardsData.map((card) => (
                <div
                  key={card.groupName}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header Card */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                          {card.groupName}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Pembimbing: <span className="font-semibold text-slate-700 dark:text-slate-300">{card.waliName}</span>
                        </p>
                      </div>
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg">
                        {card.studentCount} Santri
                      </span>
                    </div>

                    {/* Progress Percentage Display */}
                    <div className="space-y-1.5 pt-2">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Rata-rata Capaian {agregatMateri?.nama_materi}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                          {card.avgPercentage}%
                        </span>
                      </div>

                      {/* Smooth Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${card.avgPercentage}%` }}
                        />
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                        Rata-rata berada di <strong className="text-slate-800 dark:text-slate-200">Halaman {card.avgPageNumber}</strong> dari {card.totalPages} Halaman
                      </p>
                    </div>
                  </div>

                  {/* Button Detail Santri */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (agregatGroupMode === "kamar") {
                          setFilterKamar(card.groupName);
                        } else {
                          setFilterKelas(card.groupName);
                        }
                        setSelectedMateriId(agregatMateri.id);
                        setActiveMainTab("santri");
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <span>Detail Santri</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-400">
                Belum ada data kelompok kelas / kamar yang tersedia.
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* ======================================================================== */}
      {/* MODAL 2: DETAIL CAPAIAN VIEW-ONLY ("LIHAT CAPAIAN") */}
      {/* ======================================================================== */}
      {isViewModalOpen && viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Detail Capaian Makna
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {viewingStudent.nama_lengkap || viewingStudent.nama}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kamar: {viewingStudent.kamar || "—"} • Kelas: {viewingStudent.kelas_pengajian || "—"}
                </p>
              </div>

              {(() => {
                const cap = getCapaianData(viewingStudent.id, currentMateri.id);
                return (
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Kitab: {currentMateri.nama_materi}
                      </span>
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        {cap.percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2.5 rounded-full"
                        style={{ width: `${cap.percentage}%` }}
                      />
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 pt-1 space-y-1">
                      <p>
                        • <strong>Halaman Selesai:</strong> {cap.count} dari {cap.totalPages} Halaman
                      </p>
                      <p>
                        • <strong>Status:</strong> {cap.belum_disampaikan ? "Belum Disampaikan" : "Aktif Dimaknai"}
                      </p>
                      {cap.catatan && (
                        <p className="italic text-slate-500 pt-1">
                          "Catatan: {cap.catatan}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
