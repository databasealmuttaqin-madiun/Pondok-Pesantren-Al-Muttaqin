import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { 
  Target, Plus, Edit2, Trash2, Search, X, Calendar, Save, 
  BookOpen, Book, Sparkles, Database, Copy, Check, Info, Layers, AlignLeft
} from "lucide-react";
import { SearchableSelect } from "./ui/SearchableSelect";
import { showSuccess, showError, showWarning, showToast, showDeleteConfirm } from "../utils/sweetalert";
import { QURAN_SURAHS, calculateQuranPageRange } from "../data/quranSurahData";

export interface TargetPengajian {
  id: number;
  kelas_pengajian: string;
  materi_id: number;
  tanggal: string;
  pertemuan_ke: number;
  target_halaman_mulai: number;
  target_halaman_selesai: number;
  materi_pengajian?: {
    nama_materi: string;
    kelompok: string;
    jumlah_halaman: number;
  };
  // Optional relations
  target_quran_detail?: {
    surah_awal_id: number;
    ayat_awal: number;
    surah_akhir_id: number;
    ayat_akhir: number;
  };
  target_hadits_detail?: {
    kitab_awal_id: number;
    hal_awal: number;
    baris_awal: number;
    kitab_akhir_id: number;
    hal_akhir: number;
    baris_akhir: number;
  };
}

interface MateriItem {
  id: number;
  nama_materi: string;
  kelompok: string;
  jumlah_halaman: number;
}

interface TargetPengajianPanelProps {
  currentUserRole?: string;
  userTugasTambahan?: string[];
  recitationClasses: string[];
  onTriggerNotification?: (message: string, type: "success" | "error" | "warning") => void;
}

export default function TargetPengajianPanel({ 
  currentUserRole = "viewer", 
  userTugasTambahan = [],
  recitationClasses = [],
  onTriggerNotification 
}: TargetPengajianPanelProps) {
  const [targets, setTargets] = useState<TargetPengajian[]>([]);
  const [materiList, setMateriList] = useState<MateriItem[]>([]);
  const [haditsKitabList, setHaditsKitabList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filters
  const [filterKelas, setFilterKelas] = useState("All");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TargetPengajian | null>(null);
  
  // Form State Umum
  const [formKelas, setFormKelas] = useState("");
  const [formMateriId, setFormMateriId] = useState<number>(0);
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [formPertemuanKe, setFormPertemuanKe] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =========================================================
  // STATE KHUSUS FORM TARGET AL-QUR'AN
  // =========================================================
  const [quranSuratAwal, setQuranSuratAwal] = useState<number>(1);
  const [quranAyatAwal, setQuranAyatAwal] = useState<number | "">(1);
  const [isQuranBersambung, setIsQuranBersambung] = useState<boolean>(false);
  const [quranSuratAkhir, setQuranSuratAkhir] = useState<number>(1);
  const [quranAyatAkhir, setQuranAyatAkhir] = useState<number | "">(7);

  // =========================================================
  // STATE KHUSUS FORM TARGET AL-HADIST (HIMPUNAN)
  // =========================================================
  const [haditsKitabAwal, setHaditsKitabAwal] = useState<number | "">("");
  const [haditsHalAwal, setHaditsHalAwal] = useState<number | "">(1);
  const [haditsBarisAwal, setHaditsBarisAwal] = useState<number | "">(1);
  const [isHaditsBersambung, setIsHaditsBersambung] = useState<boolean>(false);
  const [haditsKitabAkhir, setHaditsKitabAkhir] = useState<number | "">("");
  const [haditsHalAkhir, setHaditsHalAkhir] = useState<number | "">(5);
  const [haditsBarisAkhir, setHaditsBarisAkhir] = useState<number | "">(18);

  // Modal SQL Target
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [hasCustomDbTable, setHasCustomDbTable] = useState(false);
  
  const roleLower = currentUserRole.toLowerCase();
  const isAdminOrPengurus = roleLower.includes("admin") || roleLower.includes("super admin") || 
                            userTugasTambahan.some(t => t.toLowerCase().includes("pengasuh") || t.toLowerCase().includes("pamong") || t.toLowerCase().includes("pondok"));

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Materi for Dropdowns
      const { data: dataMateri, error: errMateri } = await supabase
        .from("materi_pengajian")
        .select("id, nama_materi, kelompok, jumlah_halaman")
        .order("urutan", { ascending: true });
        
      if (errMateri) throw errMateri;
      setMateriList(dataMateri || []);

      // 2. Fetch Master Hadits Kitab
      try {
        const { data: dataHadits } = await supabase
          .from("master_hadits_kitab")
          .select("*")
          .order("urutan", { ascending: true });
        if (dataHadits && dataHadits.length > 0) {
          setHaditsKitabList(dataHadits);
        } else {
          // Fallback dari materi kelompok himpunan
          const fallback = (dataMateri || []).filter(m => m.kelompok === "himpunan").map(m => ({
            id: m.id,
            nama_kitab: m.nama_materi,
            total_hal: m.jumlah_halaman,
            default_max_baris: 18
          }));
          setHaditsKitabList(fallback);
        }
      } catch (err) {
        console.warn("Notice load hadits kitab:", err);
      }

      // 3. Fetch Targets with relations
      const { data: dataTarget, error: errTarget } = await supabase
        .from("target_pengajian")
        .select(`
          *,
          materi_pengajian (nama_materi, kelompok, jumlah_halaman)
        `)
        .order("tanggal", { ascending: false })
        .order("kelas_pengajian", { ascending: true });
        
      if (errTarget) throw errTarget;

      // Coba gabungkan detail target_quran & target_hadits jika tabel ada
      let quranMap: Record<string, any> = {};
      let haditsMap: Record<string, any> = {};
      let hasLiveTable = false;

      try {
        const { data: tqData, error: tqErr } = await supabase.from("target_quran").select("*");
        if (!tqErr && tqData) {
          hasLiveTable = true;
          tqData.forEach((t: any) => {
            if (t.target_pengajian_id) quranMap[`id_${t.target_pengajian_id}`] = t;
            if (t.kelas_id && t.tanggal) quranMap[`kt_${t.kelas_id}_${t.tanggal}`] = t;
          });
        }
      } catch {}

      try {
        const { data: thData, error: thErr } = await supabase.from("target_hadits").select("*");
        if (!thErr && thData) {
          hasLiveTable = true;
          thData.forEach((t: any) => {
            if (t.target_pengajian_id) haditsMap[`id_${t.target_pengajian_id}`] = t;
            if (t.kelas_id && t.tanggal) haditsMap[`kt_${t.kelas_id}_${t.tanggal}`] = t;
          });
        }
      } catch {}

      setHasCustomDbTable(hasLiveTable);

      const enhancedTargets: TargetPengajian[] = (dataTarget || []).map((item: any) => ({
        ...item,
        target_quran_detail: quranMap[`id_${item.id}`] || quranMap[`kt_${item.kelas_pengajian}_${item.tanggal}`] || null,
        target_hadits_detail: haditsMap[`id_${item.id}`] || haditsMap[`kt_${item.kelas_pengajian}_${item.tanggal}`] || null
      }));

      setTargets(enhancedTargets);
    } catch (err: any) {
      console.error(err);
      if (onTriggerNotification) onTriggerNotification("Gagal memuat data: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cek apakah materi yang dipilih bertipe Al-Qur'an
  const selectedMateriObj = useMemo(() => {
    return materiList.find(m => m.id === formMateriId);
  }, [materiList, formMateriId]);

  const isSelectedQuran = useMemo(() => {
    if (!selectedMateriObj) return false;
    return selectedMateriObj.kelompok === "alquran" || selectedMateriObj.nama_materi.toLowerCase().includes("quran");
  }, [selectedMateriObj]);

  const isSelectedLambatan = useMemo(() => {
    if (!selectedMateriObj) return false;
    return selectedMateriObj.nama_materi.toLowerCase().includes("lambatan");
  }, [selectedMateriObj]);

  // Sync Surat Akhir jika tidak bersambung
  useEffect(() => {
    if (!isQuranBersambung) {
      setQuranSuratAkhir(quranSuratAwal);
    }
  }, [isQuranBersambung, quranSuratAwal]);

  // Sync Kitab Akhir jika tidak bersambung
  useEffect(() => {
    if (!isHaditsBersambung && haditsKitabAwal) {
      setHaditsKitabAkhir(haditsKitabAwal);
    }
  }, [isHaditsBersambung, haditsKitabAwal]);

  // Kalkulasi Otomatis Al-Qur'an (Mushaf Madinah 1-604)
  const quranCalculated = useMemo(() => {
    return calculateQuranPageRange(
      quranSuratAwal,
      Number(quranAyatAwal) || 1,
      quranSuratAkhir,
      Number(quranAyatAkhir) || 1
    );
  }, [quranSuratAwal, quranAyatAwal, quranSuratAkhir, quranAyatAkhir]);

  // Ringkasan Otomatis Al-Hadist
  const haditsCalculated = useMemo(() => {
    const kAwal = haditsKitabList.find(k => k.id === haditsKitabAwal);
    const kAkhir = haditsKitabList.find(k => k.id === haditsKitabAkhir) || kAwal;
    const namaAwal = kAwal?.nama_kitab || "Kitab";
    const namaAkhir = kAkhir?.nama_kitab || namaAwal;

    const halAwalNum = Number(haditsHalAwal) || 1;
    const barisAwalText = haditsBarisAwal === "" ? "" : haditsBarisAwal;
    const halAkhirNum = Number(haditsHalAkhir) || 1;
    const barisAkhirText = haditsBarisAkhir === "" ? "" : haditsBarisAkhir;

    let ringkasan = "";
    if (haditsKitabAwal === haditsKitabAkhir || !isHaditsBersambung) {
      ringkasan = `${namaAwal} Hal. ${haditsHalAwal || 1} Baris ${barisAwalText || 1} s/d Hal. ${haditsHalAkhir || 1} Baris ${barisAkhirText || 1}`;
    } else {
      ringkasan = `${namaAwal} Hal. ${haditsHalAwal || 1} Baris ${barisAwalText || 1} s/d ${namaAkhir} Hal. ${haditsHalAkhir || 1} Baris ${barisAkhirText || 1}`;
    }

    const totalHal = haditsKitabAwal === haditsKitabAkhir 
      ? Math.max(1, halAkhirNum - halAwalNum + 1)
      : Math.max(1, (kAwal?.total_hal || 40) - halAwalNum + halAkhirNum);

    return {
      namaAwal,
      namaAkhir,
      ringkasanTeks: ringkasan,
      totalHal
    };
  }, [haditsKitabAwal, haditsHalAwal, haditsBarisAwal, haditsKitabAkhir, haditsHalAkhir, haditsBarisAkhir, isHaditsBersambung, haditsKitabList]);

  // Saat materi berganti, inisialisasi default yang relevan
  const handleMateriChange = (newId: number) => {
    setFormMateriId(newId);
    const match = materiList.find(m => m.id === newId);
    if (!match) return;

    if (match.kelompok === "alquran" || match.nama_materi.toLowerCase().includes("quran")) {
      const isLambatan = match.nama_materi.toLowerCase().includes("lambatan");
      if (isLambatan) {
        // Al-Quran Lambatan: Surat 22 (Al-Hajj) Ayat 1 - 20 (Halaman 342 s/d 343)
        setQuranSuratAwal(22);
        setQuranAyatAwal(1);
        setIsQuranBersambung(false);
        setQuranSuratAkhir(22);
        setQuranAyatAkhir(20);
      } else {
        // Al-Quran Cepatan: Surat 1 (Al-Fatihah)
        setQuranSuratAwal(1);
        setQuranAyatAwal(1);
        setIsQuranBersambung(false);
        setQuranSuratAkhir(1);
        setQuranAyatAkhir(7);
      }
    } else {
      // Himpunan / Hadits
      const matchingKitab = haditsKitabList.find(k => k.id === newId) || haditsKitabList[0];
      if (matchingKitab) {
        setHaditsKitabAwal(matchingKitab.id);
        setHaditsKitabAkhir(matchingKitab.id);
        setHaditsHalAwal(1);
        setHaditsBarisAwal(1);
        setHaditsHalAkhir(Math.min(5, matchingKitab.total_hal || 5));
        setHaditsBarisAkhir(18);
        setIsHaditsBersambung(false);
      }
    }
  };

  const handleOpenModal = (item?: TargetPengajian) => {
    if (item) {
      setEditingItem(item);
      setFormKelas(item.kelas_pengajian);
      setFormMateriId(item.materi_id);
      setFormTanggal(item.tanggal);
      setFormPertemuanKe(item.pertemuan_ke);

      const m = materiList.find(mat => mat.id === item.materi_id);
      const isQ = m ? (m.kelompok === "alquran" || m.nama_materi.toLowerCase().includes("quran")) : false;

      if (isQ) {
        if (item.target_quran_detail) {
          setQuranSuratAwal(item.target_quran_detail.surah_awal_id || 1);
          setQuranAyatAwal(item.target_quran_detail.ayat_awal || 1);
          setQuranSuratAkhir(item.target_quran_detail.surah_akhir_id || item.target_quran_detail.surah_awal_id || 1);
          setQuranAyatAkhir(item.target_quran_detail.ayat_akhir || 7);
          setIsQuranBersambung(item.target_quran_detail.surah_awal_id !== item.target_quran_detail.surah_akhir_id);
        } else {
          // Fallback dari nomor halaman
          if (item.target_halaman_mulai >= 342) {
            setQuranSuratAwal(22);
            setQuranAyatAwal(1);
            setQuranSuratAkhir(22);
            setQuranAyatAkhir(20);
          } else {
            setQuranSuratAwal(1);
            setQuranAyatAwal(1);
            setQuranSuratAkhir(1);
            setQuranAyatAkhir(7);
          }
        }
      } else {
        if (item.target_hadits_detail) {
          setHaditsKitabAwal(item.target_hadits_detail.kitab_awal_id || item.materi_id);
          setHaditsHalAwal(item.target_hadits_detail.hal_awal || item.target_halaman_mulai || 1);
          setHaditsBarisAwal(item.target_hadits_detail.baris_awal || 1);
          setHaditsKitabAkhir(item.target_hadits_detail.kitab_akhir_id || item.materi_id);
          setHaditsHalAkhir(item.target_hadits_detail.hal_akhir || item.target_halaman_selesai || 5);
          setHaditsBarisAkhir(item.target_hadits_detail.baris_akhir || 18);
          setIsHaditsBersambung(item.target_hadits_detail.kitab_awal_id !== item.target_hadits_detail.kitab_akhir_id);
        } else {
          setHaditsKitabAwal(item.materi_id);
          setHaditsKitabAkhir(item.materi_id);
          setHaditsHalAwal(item.target_halaman_mulai || 1);
          setHaditsBarisAwal(1);
          setHaditsHalAkhir(item.target_halaman_selesai || 5);
          setHaditsBarisAkhir(18);
          setIsHaditsBersambung(false);
        }
      }
    } else {
      setEditingItem(null);
      setFormKelas(recitationClasses.length > 0 ? recitationClasses[0] : "");
      setFormTanggal(new Date().toISOString().split("T")[0]);
      setFormPertemuanKe(1);

      // Default Materi
      if (materiList.length > 0) {
        handleMateriChange(materiList[0].id);
      }
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKelas || !formMateriId) {
      showWarning("Data Belum Lengkap", "Mohon pilih kelas dan materi pengajian!");
      return;
    }

    let calculatedHalMulai = 1;
    let calculatedHalSelesai = 1;

    // 1. Validasi & Hitung Rentang Halaman
    if (isSelectedQuran) {
      const sAwal = QURAN_SURAHS.find(s => s.nomor === quranSuratAwal);
      const sAkhir = QURAN_SURAHS.find(s => s.nomor === quranSuratAkhir);

      if (!sAwal || !sAkhir) {
        showWarning("Surat Tidak Valid", "Pilihan surat awal atau akhir tidak valid!");
        return;
      }
      const ayatAwalNum = Number(quranAyatAwal) || 1;
      const ayatAkhirNum = Number(quranAyatAkhir) || 1;
      if (ayatAwalNum <= 0 || ayatAwalNum > sAwal.jumlah_ayat) {
        showWarning("Ayat Tidak Valid", `Ayat awal harus antara 1 s/d ${sAwal.jumlah_ayat} untuk ${sAwal.nama}`);
        return;
      }
      if (ayatAkhirNum <= 0 || ayatAkhirNum > sAkhir.jumlah_ayat) {
        showWarning("Ayat Tidak Valid", `Ayat akhir harus antara 1 s/d ${sAkhir.jumlah_ayat} untuk ${sAkhir.nama}`);
        return;
      }
      if (quranSuratAwal === quranSuratAkhir && ayatAwalNum > ayatAkhirNum) {
        showWarning("Urutan Ayat Tidak Valid", "Ayat awal tidak boleh lebih besar dari ayat akhir pada surat yang sama!");
        return;
      }

      calculatedHalMulai = quranCalculated.halamanMulai;
      calculatedHalSelesai = quranCalculated.halamanSelesai;
    } else {
      // Hadits
      const kAwal = haditsKitabList.find(k => k.id === haditsKitabAwal);
      const kAkhir = haditsKitabList.find(k => k.id === (haditsKitabAkhir || haditsKitabAwal)) || kAwal;

      const halAwalNum = Number(haditsHalAwal) || 1;
      const halAkhirNum = Number(haditsHalAkhir) || 1;

      if (halAwalNum <= 0 || (kAwal && halAwalNum > kAwal.total_hal)) {
        showWarning("Halaman Tidak Valid", `Halaman awal tidak boleh melebihi total halaman kitab (${kAwal?.total_hal || 40} Hal)`);
        return;
      }
      if (halAkhirNum <= 0 || (kAkhir && halAkhirNum > kAkhir.total_hal)) {
        showWarning("Halaman Tidak Valid", `Halaman akhir tidak boleh melebihi total halaman kitab (${kAkhir?.total_hal || 40} Hal)`);
        return;
      }
      if (haditsKitabAwal === haditsKitabAkhir && halAwalNum > halAkhirNum) {
        showWarning("Halaman Tidak Valid", "Halaman awal tidak boleh lebih besar dari halaman akhir pada kitab yang sama!");
        return;
      }

      calculatedHalMulai = halAwalNum;
      calculatedHalSelesai = halAkhirNum;
    }
    
    setIsSubmitting(true);
    try {
      // 1. Simpan ke target_pengajian (kompatibilitas menyeluruh)
      const payload = {
        kelas_pengajian: formKelas,
        materi_id: formMateriId,
        tanggal: formTanggal,
        pertemuan_ke: formPertemuanKe,
        target_halaman_mulai: calculatedHalMulai,
        target_halaman_selesai: calculatedHalSelesai
      };

      let targetId: number;

      if (editingItem) {
        const { error } = await supabase
          .from("target_pengajian")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
        targetId = editingItem.id;
        showSuccess("Berhasil", "Target capaian pengajian berhasil diperbarui.");
      } else {
        const { data: insData, error } = await supabase
          .from("target_pengajian")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        targetId = insData.id;
        showSuccess("Berhasil", "Target capaian pengajian baru berhasil dibuat.");
      }

      // 2. Kirim payload spesifik Al-Qur'an atau Hadits ke backend
      if (isSelectedQuran) {
        const payloadQuran = {
          target_pengajian_id: targetId,
          tanggal: formTanggal,
          pertemuan_ke: formPertemuanKe,
          kelas_id: formKelas,
          surah_awal_id: quranSuratAwal,
          ayat_awal: Number(quranAyatAwal) || 1,
          surah_akhir_id: quranSuratAkhir,
          ayat_akhir: Number(quranAyatAkhir) || 1,
          halaman_awal: calculatedHalMulai,
          halaman_akhir: calculatedHalSelesai
        };

        try {
          await supabase.from("target_quran").delete().eq("target_pengajian_id", targetId);
          await supabase.from("target_quran").insert([payloadQuran]);
        } catch (errQ) {
          console.warn("Notice: target_quran table belum ada di database, disimpan ke cache lokal", errQ);
          const c = JSON.parse(localStorage.getItem("target_quran_cache") || "[]");
          c.push({ ...payloadQuran, saved_at: new Date().toISOString() });
          localStorage.setItem("target_quran_cache", JSON.stringify(c));
        }
      } else {
        const payloadHadits = {
          target_pengajian_id: targetId,
          tanggal: formTanggal,
          pertemuan_ke: formPertemuanKe,
          kelas_id: formKelas,
          kitab_awal_id: haditsKitabAwal || formMateriId,
          hal_awal: Number(haditsHalAwal) || 1,
          baris_awal: Number(haditsBarisAwal) || 1,
          kitab_akhir_id: haditsKitabAkhir || haditsKitabAwal || formMateriId,
          hal_akhir: Number(haditsHalAkhir) || 1,
          baris_akhir: Number(haditsBarisAkhir) || 1
        };

        try {
          await supabase.from("target_hadits").delete().eq("target_pengajian_id", targetId);
          await supabase.from("target_hadits").insert([payloadHadits]);
        } catch (errH) {
          console.warn("Notice: target_hadits table belum ada di database, disimpan ke cache lokal", errH);
          const c = JSON.parse(localStorage.getItem("target_hadits_cache") || "[]");
          c.push({ ...payloadHadits, saved_at: new Date().toISOString() });
          localStorage.setItem("target_hadits_cache", JSON.stringify(c));
        }
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menyimpan", err.message || "Terjadi kesalahan saat menyimpan target.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const isConfirmed = await showDeleteConfirm("target capaian ini");
    if (!isConfirmed) return;
    
    try {
      // Hapus dari target_pengajian
      const { error } = await supabase.from("target_pengajian").delete().eq("id", id);
      if (error) throw error;

      // Hapus juga dari child tables jika ada
      try { await supabase.from("target_quran").delete().eq("target_pengajian_id", id); } catch {}
      try { await supabase.from("target_hadits").delete().eq("target_pengajian_id", id); } catch {}
      
      showToast("Target capaian berhasil dihapus", "success");
      loadData();
    } catch (err: any) {
      console.error(err);
      showError("Gagal Menghapus", err.message || "Terjadi kesalahan saat menghapus target.");
    }
  };

  const filteredTargets = targets
    .filter(t => filterKelas === "All" || t.kelas_pengajian === filterKelas)
    .filter(t => !filterTanggal || t.tanggal === filterTanggal)
    .filter(t => !searchQuery || t.materi_pengajian?.nama_materi.toLowerCase().includes(searchQuery.toLowerCase()));

  const classOptions = [
    { value: "All", label: "Semua Kelas" },
    ...recitationClasses.map(c => ({ value: c, label: c }))
  ];

  const sqlTargetScript = `-- Skrip SQL: Tabel target_quran & target_hadits
CREATE TABLE IF NOT EXISTS public.target_quran (
    id BIGSERIAL PRIMARY KEY,
    target_pengajian_id BIGINT,
    tanggal DATE NOT NULL,
    pertemuan_ke INTEGER NOT NULL DEFAULT 1,
    kelas_id VARCHAR(100) NOT NULL,
    surah_awal_id INTEGER NOT NULL,
    ayat_awal INTEGER NOT NULL,
    surah_akhir_id INTEGER NOT NULL,
    ayat_akhir INTEGER NOT NULL,
    halaman_awal INTEGER NOT NULL,
    halaman_akhir INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.target_hadits (
    id BIGSERIAL PRIMARY KEY,
    target_pengajian_id BIGINT,
    tanggal DATE NOT NULL,
    pertemuan_ke INTEGER NOT NULL DEFAULT 1,
    kelas_id VARCHAR(100) NOT NULL,
    kitab_awal_id BIGINT NOT NULL,
    hal_awal INTEGER NOT NULL,
    baris_awal INTEGER NOT NULL DEFAULT 1,
    kitab_akhir_id BIGINT NOT NULL,
    hal_akhir INTEGER NOT NULL,
    baris_akhir INTEGER NOT NULL DEFAULT 18,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.target_quran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_hadits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Izinkan semua akses target_quran" ON public.target_quran FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Izinkan semua akses target_hadits" ON public.target_hadits FOR ALL USING (true) WITH CHECK (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlTargetScript);
    setCopiedSql(true);
    showToast("Skrip SQL Target berhasil disalin", "success");
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const currentSurahAwalObj = QURAN_SURAHS.find(s => s.nomor === quranSuratAwal);
  const currentSurahAkhirObj = QURAN_SURAHS.find(s => s.nomor === quranSuratAkhir);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <Target className="w-6 h-6" />
              </span>
              Target Pengajian
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Atur dan pantau target Surat/Ayat Al-Qur'an dan Kitab/Baris Hadits per pertemuan kelas
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasCustomDbTable && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase DB Aktif</span>
              </span>
            )}

            <button
              onClick={() => setIsSqlModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              title="Lihat Skrip SQL Tabel target_quran & target_hadits"
            >
              <Database className="w-4 h-4 text-emerald-500" />
              <span>Skrip SQL Target</span>
            </button>

            {isAdminOrPengurus && (
              <button
                onClick={() => handleOpenModal()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Target Baru</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-center gap-4">
        <div className="w-full lg:w-64">
          <SearchableSelect
            value={filterKelas}
            onChange={setFilterKelas}
            options={classOptions}
            placeholder="Filter Kelas..."
          />
        </div>

        <div className="w-full lg:w-48 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="date"
            value={filterTanggal}
            onChange={e => setFilterTanggal(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          {filterTanggal && (
            <button onClick={() => setFilterTanggal("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama materi target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* TABLE CONTENT */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Memuat data target...</div>
        ) : filteredTargets.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Belum Ada Target</h3>
            <p className="text-slate-500 text-sm">
              Tidak ada data target capaian yang cocok dengan pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 text-center">Pertemuan Ke</th>
                  <th className="py-3 px-4">Tanggal &amp; Kelas</th>
                  <th className="py-3 px-4">Materi &amp; Detail Target</th>
                  <th className="py-3 px-4 text-center">Target Halaman</th>
                  <th className="py-3 px-4 text-center">Total Target</th>
                  {isAdminOrPengurus && <th className="py-3 px-4 text-center w-24">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTargets.map((item, idx) => {
                  const jumlahHal = (item.target_halaman_selesai - item.target_halaman_mulai) + 1;
                  const isQuran = item.materi_pengajian?.kelompok === "alquran" || item.materi_pengajian?.nama_materi.toLowerCase().includes("quran");

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-500 text-xs">{idx + 1}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
                          Ke-{item.pertemuan_ke}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.kelas_pengajian}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                          {isQuran ? (
                            <BookOpen className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Book className="w-4 h-4 text-indigo-500" />
                          )}
                          <span>{item.materi_pengajian?.nama_materi || "Materi"}</span>
                        </div>
                        
                        {/* Sub Detail Surat / Ayat atau Kitab / Baris */}
                        {isQuran && item.target_quran_detail ? (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                            QS. {QURAN_SURAHS.find(s => s.nomor === item.target_quran_detail?.surah_awal_id)?.nama || item.target_quran_detail.surah_awal_id}:{item.target_quran_detail.ayat_awal} s/d {QURAN_SURAHS.find(s => s.nomor === item.target_quran_detail?.surah_akhir_id)?.nama || item.target_quran_detail.surah_akhir_id}:{item.target_quran_detail.ayat_akhir}
                          </div>
                        ) : !isQuran && item.target_hadits_detail ? (
                          <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold mt-0.5 font-mono">
                            Hal. {item.target_hadits_detail.hal_awal} B.{item.target_hadits_detail.baris_awal} s/d Hal. {item.target_hadits_detail.hal_akhir} B.{item.target_hadits_detail.baris_akhir}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                            {isQuran ? "Al-Qur'an" : "Himpunan Hadits"}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold font-mono shadow-xs">
                          Hal. {item.target_halaman_mulai} s/d {item.target_halaman_selesai}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/50 dark:border-emerald-800/40">
                          {jumlahHal} Halaman
                        </span>
                      </td>
                      {isAdminOrPengurus && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenModal(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL FORM BUAT / EDIT TARGET CAPAIAN (DYNAMIC MATERI)    */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                {editingItem ? <Edit2 className="w-5 h-5 text-emerald-500" /> : <Plus className="w-5 h-5 text-emerald-500" />}
                {editingItem ? "Edit Target Capaian" : "Buat Target Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
              
              {/* Tanggal & Pertemuan Ke */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    Tanggal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formTanggal}
                    onChange={e => setFormTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-emerald-500" />
                    Pertemuan Ke <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formPertemuanKe}
                    onChange={e => setFormPertemuanKe(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Kelas Pengajian */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kelas Pengajian <span className="text-red-500">*</span>
                </label>
                {recitationClasses.length > 0 ? (
                  <select
                    value={formKelas}
                    onChange={e => setFormKelas(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value="" disabled>-- Pilih Kelas --</option>
                    {recitationClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formKelas}
                    onChange={e => setFormKelas(e.target.value)}
                    placeholder="Masukkan nama kelas"
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              {/* Materi (Dropdown Penentu Form Dinamis) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    Materi Pengajian <span className="text-red-500">*</span>
                  </span>
                  {selectedMateriObj && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isSelectedQuran 
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                    }`}>
                      {isSelectedQuran ? "Al-Qur'an" : "Himpunan Hadits"}
                    </span>
                  )}
                </label>
                <select
                  value={formMateriId}
                  onChange={e => handleMateriChange(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                >
                  <option value={0} disabled>-- Pilih Materi Pengajian --</option>
                  <optgroup label="Al-Qur'an">
                    {materiList.filter(m => m.kelompok === "alquran" || m.nama_materi.toLowerCase().includes("quran")).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nama_materi} ({m.jumlah_halaman} Hal)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Al-Hadist / Kitab Himpunan">
                    {materiList.filter(m => m.kelompok === "himpunan" && !m.nama_materi.toLowerCase().includes("quran")).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nama_materi} ({m.jumlah_halaman} Hal)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* ========================================================= */}
              {/* A. JIKA MATERI = AL-QUR'AN (CEPATAN / LAMBATAN)            */}
              {/* ========================================================= */}
              {isSelectedQuran && (
                <div className="space-y-3.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-500" />
                      Detail Target Al-Qur'an (Surat &amp; Ayat)
                    </span>
                    {isSelectedLambatan && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/50">
                        Dimulai Hal. 342
                      </span>
                    )}
                  </div>

                  {/* 1. Titik Awal Target */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Titik Awal Target
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-8">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Surat Awal
                        </label>
                        <select
                          value={quranSuratAwal}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setQuranSuratAwal(v);
                            if (!isQuranBersambung) setQuranSuratAkhir(v);
                          }}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        >
                          {QURAN_SURAHS.map((s) => (
                            <option key={s.nomor} value={s.nomor}>
                              {s.nomor}. {s.nama} ({s.jumlah_ayat} Ayat)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Ayat Awal
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max={currentSurahAwalObj?.jumlah_ayat || 286}
                          value={quranAyatAwal}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setQuranAyatAwal("");
                            } else {
                              const num = parseInt(raw, 10);
                              setQuranAyatAwal(isNaN(num) ? "" : num);
                            }
                          }}
                          onBlur={() => {
                            if (quranAyatAwal === "" || Number(quranAyatAwal) < 1) {
                              setQuranAyatAwal(1);
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Checkbox: Lanjut Bersambung ke Surat Berikutnya */}
                  <label className="flex items-center gap-2 cursor-pointer select-none px-1">
                    <input
                      type="checkbox"
                      checked={isQuranBersambung}
                      onChange={(e) => {
                        const c = e.target.checked;
                        setIsQuranBersambung(c);
                        if (!c) setQuranSuratAkhir(quranSuratAwal);
                      }}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Lanjut Bersambung ke Surat Berikutnya
                    </span>
                  </label>

                  {/* 3. Titik Akhir Target */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Titik Akhir Target
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-8">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Surat Akhir {isQuranBersambung ? "" : "(Terkunci Sama)"}
                        </label>
                        <select
                          disabled={!isQuranBersambung}
                          value={quranSuratAkhir}
                          onChange={(e) => setQuranSuratAkhir(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 disabled:bg-slate-100 dark:disabled:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        >
                          {QURAN_SURAHS.filter(s => !isQuranBersambung || s.nomor >= quranSuratAwal).map((s) => (
                            <option key={s.nomor} value={s.nomor}>
                              {s.nomor}. {s.nama} ({s.jumlah_ayat} Ayat)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Ayat Akhir
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max={currentSurahAkhirObj?.jumlah_ayat || 286}
                          value={quranAyatAkhir}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setQuranAyatAkhir("");
                            } else {
                              const num = parseInt(raw, 10);
                              setQuranAyatAkhir(isNaN(num) ? "" : num);
                            }
                          }}
                          onBlur={() => {
                            if (quranAyatAkhir === "" || Number(quranAyatAkhir) < 1) {
                              setQuranAyatAkhir(1);
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Ringkasan & Kalkulasi Halaman Otomatis (Read-Only Widget) */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Hasil Kalkulasi Target Mushaf
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                        {quranCalculated.kategoriLabel}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200 font-mono">
                      {quranCalculated.targetTeks}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      QS. {currentSurahAwalObj?.nama}:{quranAyatAwal} s/d QS. {currentSurahAkhirObj?.nama}:{quranAyatAkhir}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* B. JIKA MATERI = AL-HADIST / HIMPUNAN                     */}
              {/* ========================================================= */}
              {!isSelectedQuran && selectedMateriObj && (
                <div className="space-y-3.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Book className="w-4 h-4 text-indigo-500" />
                    Detail Target Kitab, Halaman &amp; Baris
                  </div>

                  {/* 1. Titik Awal Target */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Titik Awal Target
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Kitab Awal
                      </label>
                      <select
                        value={haditsKitabAwal}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setHaditsKitabAwal(val);
                          if (!isHaditsBersambung) setHaditsKitabAkhir(val);
                        }}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        {haditsKitabList.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama_kitab} ({k.total_hal} Hal)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Hal. Awal
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={haditsHalAwal}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setHaditsHalAwal("");
                            } else {
                              const num = parseInt(raw, 10);
                              setHaditsHalAwal(isNaN(num) ? "" : num);
                            }
                          }}
                          onBlur={() => {
                            if (haditsHalAwal === "" || Number(haditsHalAwal) < 1) {
                              setHaditsHalAwal(1);
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Baris Awal
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="40"
                          value={haditsBarisAwal}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setHaditsBarisAwal("");
                            } else {
                              const num = parseInt(raw, 10);
                              setHaditsBarisAwal(isNaN(num) ? "" : num);
                            }
                          }}
                          onBlur={() => {
                            if (haditsBarisAwal === "" || Number(haditsBarisAwal) < 1) {
                              setHaditsBarisAwal(1);
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Checkbox: Lanjut Bersambung ke Kitab Berikutnya */}
                  <label className="flex items-center gap-2 cursor-pointer select-none px-1">
                    <input
                      type="checkbox"
                      checked={isHaditsBersambung}
                      onChange={(e) => {
                        const c = e.target.checked;
                        setIsHaditsBersambung(c);
                        if (!c) setHaditsKitabAkhir(haditsKitabAwal);
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Lanjut Bersambung ke Kitab Berikutnya
                    </span>
                  </label>

                  {/* 3. Titik Akhir Target */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Titik Akhir Target
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Kitab Akhir {isHaditsBersambung ? "" : "(Terkunci Sama)"}
                      </label>
                      <select
                        disabled={!isHaditsBersambung}
                        value={haditsKitabAkhir}
                        onChange={(e) => setHaditsKitabAkhir(Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 disabled:bg-slate-100 dark:disabled:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        {haditsKitabList.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama_kitab} ({k.total_hal} Hal)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Hal. Akhir
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={haditsHalAkhir}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setHaditsHalAkhir("");
                            } else {
                              const num = parseInt(raw, 10);
                              setHaditsHalAkhir(isNaN(num) ? "" : num);
                            }
                          }}
                          onBlur={() => {
                            if (haditsHalAkhir === "" || Number(haditsHalAkhir) < 1) {
                              setHaditsHalAkhir(1);
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Baris Akhir
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="40"
                          value={haditsBarisAkhir}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setHaditsBarisAkhir("");
                            } else {
                              const num = parseInt(raw, 10);
                              setHaditsBarisAkhir(isNaN(num) ? "" : num);
                            }
                          }}
                          onBlur={() => {
                            if (haditsBarisAkhir === "" || Number(haditsBarisAkhir) < 1) {
                              setHaditsBarisAkhir(1);
                            }
                          }}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Ringkasan Target Hadits (Read-Only Widget) */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        Preview Target Hadits
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                        Total {haditsCalculated.totalHal} Halaman
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 font-mono leading-relaxed">
                      {haditsCalculated.ringkasanTeks}
                    </div>
                  </div>
                </div>
              )}

              {/* FOOTER ACTIONS */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{editingItem ? "Simpan Perubahan" : "Buat Target"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL SKRIP SQL TARGET SUPABASE                           */}
      {/* ========================================================= */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Skrip SQL Supabase: Target Qur'an &amp; Hadits
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tabel target_quran &amp; target_hadits
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Jalankan skrip SQL ini di <strong>SQL Editor</strong> Supabase Dashboard untuk mengaktifkan tabel <code className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.5 rounded">target_quran</code> dan <code className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.5 rounded">target_hadits</code>:
              </p>

              <div className="relative">
                <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto max-h-80 border border-slate-800 leading-relaxed">
                  {sqlTargetScript}
                </pre>
                <button
                  onClick={handleCopySql}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? "Tersalin!" : "Salin SQL"}</span>
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
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
