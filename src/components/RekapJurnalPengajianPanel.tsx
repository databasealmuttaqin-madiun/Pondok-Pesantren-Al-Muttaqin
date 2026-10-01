import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import {
  FileText,
  Printer,
  Calendar,
  Layers,
  BookOpen,
  Book,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  X,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles
} from "lucide-react";

interface Props {
  recitationClasses: string[];
  onTriggerNotification: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export default function RekapJurnalPengajianPanel({ recitationClasses, onTriggerNotification }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  // Kelompok materi dropdown: "alquran", "hadits", "pegon_bacaan", "pegon", "bacaan", or "semua"
  const [selectedKelompok, setSelectedKelompok] = useState<"alquran" | "hadits" | "pegon_bacaan" | "pegon" | "bacaan" | "semua">("alquran");
  const [selectedSesiFilter, setSelectedSesiFilter] = useState<string>("semua");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Deteksi kelas Pegon & Bacaan
  const isPegonClass = (selectedClass || "").toLowerCase().includes("pegon");
  const isBacaanClass = (selectedClass || "").toLowerCase().includes("bacaan");
  const isPegonOrBacaanClass = isPegonClass || isBacaanClass;
  const isPegonBacaanView = isPegonOrBacaanClass || selectedKelompok === "pegon_bacaan" || selectedKelompok === "pegon" || selectedKelompok === "bacaan";
  
  // Sort field & direction (naik / turun)
  const [sortField, setSortField] = useState<
    "tanggal" | "sesi" | "guru" | "materi" | "hal_mulai" | "hal_selesai" | "status"
  >("tanggal");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const handleSort = (
    field: "tanggal" | "sesi" | "guru" | "materi" | "hal_mulai" | "hal_selesai" | "status"
  ) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const [jurnals, setJurnals] = useState<any[]>([]);
  const [sesiList, setSesiList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDetailJurnal, setSelectedDetailJurnal] = useState<any | null>(null);

  // Load Sesi Pengajian for filter dropdown
  useEffect(() => {
    const fetchSesi = async () => {
      try {
        const { data, error } = await supabase
          .from("sesi_mengaji")
          .select("*")
          .order("id", { ascending: true });
        if (!error && data) {
          setSesiList(data);
        }
      } catch (err) {
        console.warn("Notice: fetch sesi_mengaji:", err);
      }
    };
    fetchSesi();
  }, []);

  // List kelas pengajian yang tersedia (memastikan kelas Pegon & Bacaan selalu tersedia sebagai pilihan)
  const classOptions = useMemo(() => {
    const list = [...recitationClasses];
    if (!list.some(c => c.toLowerCase().includes("pegon") || c.toLowerCase().includes("bacaan"))) {
      list.push("Pegon & Bacaan");
    }
    return list;
  }, [recitationClasses]);

  // Set default class if available
  useEffect(() => {
    if (!selectedClass && classOptions.length > 0) {
      const firstClass = classOptions[0];
      setSelectedClass(firstClass);
      const lower = firstClass.toLowerCase();
      if (lower.includes("pegon") || lower.includes("bacaan")) {
        setSelectedKelompok("pegon_bacaan");
      }
    }
  }, [classOptions]);

  // Load Data on class or month change
  useEffect(() => {
    if (selectedClass && selectedMonth) {
      loadData();
    } else {
      setJurnals([]);
    }
  }, [selectedClass, selectedMonth]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [yearStr, monthStr] = selectedMonth.split("-");
      const yearNum = Number(yearStr);
      const monthNum = Number(monthStr);
      const lastDayNum = new Date(yearNum, monthNum, 0).getDate();
      const lastDayPadded = String(lastDayNum).padStart(2, "0");

      const startDate = `${yearStr}-${monthStr}-01`;
      const endDate = `${yearStr}-${monthStr}-${lastDayPadded}`;

      // 1. Fetch Jurnal Pengajian
      const { data: rawJurnals, error } = await supabase
        .from("jurnal_pengajian")
        .select("*, materi_pengajian(id, nama_materi, kelompok), sesi_mengaji(id, nama_sesi)")
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .order("tanggal", { ascending: true });

      if (error) throw error;
      const cleanKey = (str: string) =>
        (str || "").toLowerCase().trim().replace(/^kelas\s*/i, "").replace(/[^a-z0-9]/g, "");

      const scKey = cleanKey(selectedClass);

      const loadedJurnals = (rawJurnals || []).filter((j: any) => {
        if (!selectedClass) return true;
        const kjKey = cleanKey(j.kelas_pengajian || "");
        if (!kjKey) return false;
        if (kjKey === scKey) return true;
        if (kjKey.includes(scKey) || scKey.includes(kjKey)) {
          if ((scKey.includes("pegon") || scKey.includes("bacaan")) && (kjKey.includes("pegon") || kjKey.includes("bacaan"))) {
            return true;
          }
        }
        return false;
      });

      // 2. Fetch Capaian Al-Qur'an for this class & month
      let capaianQuranList: any[] = [];
      try {
        const { data: cqData } = await supabase
          .from("capaian_quran")
          .select("*")
          .eq("kelas_pengajian", selectedClass)
          .gte("tanggal", startDate)
          .lte("tanggal", endDate);
        if (cqData && cqData.length > 0) {
          capaianQuranList = cqData;
        }
      } catch (eCq) {
        console.warn("Notice fetch capaian_quran:", eCq);
      }
      // Merge with localStorage cache fallback
      try {
        const localCq = JSON.parse(localStorage.getItem("capaian_quran_cache") || "[]");
        localCq.forEach((item: any) => {
          if (
            item.kelas_pengajian === selectedClass &&
            item.tanggal >= startDate &&
            item.tanggal <= endDate
          ) {
            const exists = capaianQuranList.some(
              (c) =>
                (c.jurnal_id && item.jurnal_id && c.jurnal_id === item.jurnal_id) ||
                (c.tanggal === item.tanggal && c.sesi_id === item.sesi_id)
            );
            if (!exists) capaianQuranList.push(item);
          }
        });
      } catch (errCache) {
        console.warn("Notice parse capaian_quran_cache:", errCache);
      }

      // 3. Fetch Capaian Al-Hadist for this class & month
      let capaianHaditsList: any[] = [];
      try {
        const { data: chData } = await supabase
          .from("capaian_hadits")
          .select("*")
          .eq("kelas_pengajian", selectedClass)
          .gte("tanggal", startDate)
          .lte("tanggal", endDate);
        if (chData && chData.length > 0) {
          capaianHaditsList = chData;
        }
      } catch (eCh) {
        console.warn("Notice fetch capaian_hadits:", eCh);
      }
      // Merge with localStorage cache fallback
      try {
        const localCh = JSON.parse(localStorage.getItem("capaian_hadits_cache") || "[]");
        localCh.forEach((item: any) => {
          if (
            item.kelas_pengajian === selectedClass &&
            item.tanggal >= startDate &&
            item.tanggal <= endDate
          ) {
            const exists = capaianHaditsList.some(
              (c) =>
                (c.jurnal_id && item.jurnal_id && c.jurnal_id === item.jurnal_id) ||
                (c.tanggal === item.tanggal && c.sesi_id === item.sesi_id)
            );
            if (!exists) capaianHaditsList.push(item);
          }
        });
      } catch (errCache) {
        console.warn("Notice parse capaian_hadits_cache:", errCache);
      }

      // 4. Fetch Master Hadits Kitab to resolve names if needed
      let masterHaditsList: any[] = [];
      try {
        const { data: hData } = await supabase.from("master_hadits_kitab").select("*").order("urutan");
        if (hData) masterHaditsList = hData;
      } catch (eH) {
        console.warn("Notice fetch master_hadits_kitab:", eH);
      }

      // 5. Fetch Ustaz/Pengguna names
      const userMap: Record<string, string> = {};
      try {
        const { data: usersData } = await supabase.from("pengguna").select("id, nama, nama_lengkap, username");
        if (usersData) {
          usersData.forEach((u: any) => {
            const name = u.nama_lengkap || u.nama;
            if (name) {
              userMap[String(u.id)] = name;
              if (u.username) userMap[u.username.toLowerCase()] = name;
            }
          });
        }
      } catch (eU) {
        console.warn("Notice fetch pengguna:", eU);
      }

      try {
        const { data: guruData } = await supabase.from("guru").select("id, pengguna_id, nama, nama_lengkap, username");
        if (guruData) {
          guruData.forEach((g: any) => {
            const name = g.nama_lengkap || g.nama;
            if (name) {
              userMap[String(g.id)] = name;
              if (g.pengguna_id) userMap[String(g.pengguna_id)] = name;
              if (g.username) userMap[g.username.toLowerCase()] = name;
            }
          });
        }
      } catch (eG) {
        console.warn("Notice fetch guru:", eG);
      }

      try {
        const { data: plotData } = await supabase.from("plotting_guru_pondok").select("*");
        if (plotData) {
          plotData.forEach((p: any) => {
            const name = (p.guru_nama || p.nama || "").trim();
            if (name) {
              if (p.id) userMap[String(p.id)] = name;
              if (p.guru_id) userMap[String(p.guru_id)] = name;
            }
          });
        }
      } catch (eP) {
        console.warn("Notice fetch plotting_guru_pondok:", eP);
      }

      try {
        const cached = localStorage.getItem("plotting_guru_pondok_data");
        if (cached) {
          const plotData = JSON.parse(cached);
          if (Array.isArray(plotData)) {
            plotData.forEach((p: any) => {
              const name = (p.guru_nama || p.nama || "").trim();
              if (name) {
                if (p.id) userMap[String(p.id)] = name;
                if (p.guru_id) userMap[String(p.guru_id)] = name;
              }
            });
          }
        }
      } catch {}

      // 6. Enrich each journal item with structured Al-Qur'an / Al-Hadist details
      const enrichedJurnals = loadedJurnals.map((jurnal) => {
        // Teacher name
        let teacherName = "-";
        if (jurnal.ustaz_id) {
          const key = String(jurnal.ustaz_id).trim();
          if (userMap[key]) {
            teacherName = userMap[key];
          } else if (userMap[key.toLowerCase()]) {
            teacherName = userMap[key.toLowerCase()];
          } else if (isNaN(Number(key)) && key !== "null" && key !== "undefined") {
            teacherName = key;
          }
        }
        if (teacherName === "-" && (jurnal.ustaz_nama || jurnal.guru_nama)) {
          teacherName = jurnal.ustaz_nama || jurnal.guru_nama;
        }
        if (teacherName === "-" && jurnal.pengguna) {
          teacherName = jurnal.pengguna.nama_lengkap || jurnal.pengguna.nama || "-";
        }
        if (teacherName === "-" && jurnal.guru) {
          teacherName = jurnal.guru.nama_lengkap || jurnal.guru.nama || "-";
        }

        // Find matching capaian Al-Qur'an
        const matchedCq = capaianQuranList.find(
          (c) =>
            (c.jurnal_id && Number(c.jurnal_id) === Number(jurnal.id)) ||
            (c.tanggal === jurnal.tanggal && Number(c.sesi_id) === Number(jurnal.sesi_id))
        );

        // Find matching capaian Hadits
        const matchedCh = capaianHaditsList.find(
          (c) =>
            (c.jurnal_id && Number(c.jurnal_id) === Number(jurnal.id)) ||
            (c.tanggal === jurnal.tanggal && Number(c.sesi_id) === Number(jurnal.sesi_id))
        );

        // Detect kelompok: "alquran" or "himpunan" (hadits) or "pegon_bacaan" | "pegon" | "bacaan"
        let kelompok: "alquran" | "himpunan" | "pegon_bacaan" | "pegon" | "bacaan" = "alquran";

        const cat = (jurnal.catatan_kendala || "").toLowerCase();
        const namaMat = (jurnal.materi_pengajian?.nama_materi || "").toLowerCase();
        const kelMat = (jurnal.materi_pengajian?.kelompok || "").toLowerCase();
        const kelasJurnal = (jurnal.kelas_pengajian || "").toLowerCase();

        const matText = (jurnal.materi || "").toLowerCase();
        if (
          matText.includes("pegon") || matText.includes("bacaan") ||
          cat.includes("[materi:") ||
          kelMat === "pegon" || kelMat === "bacaan" || kelMat === "pegon_bacaan" ||
          namaMat.includes("pegon") || namaMat.includes("bacaan") ||
          kelasJurnal.includes("pegon") || kelasJurnal.includes("bacaan")
        ) {
          if ((cat.includes("bacaan") || matText.includes("bacaan")) && !cat.includes("pegon") && !matText.includes("pegon")) {
            kelompok = "bacaan";
          } else if ((cat.includes("pegon") || matText.includes("pegon")) && !cat.includes("bacaan") && !matText.includes("bacaan")) {
            kelompok = "pegon";
          } else {
            kelompok = "pegon_bacaan";
          }
        } else if (matchedCq) {
          kelompok = "alquran";
        } else if (matchedCh) {
          kelompok = "himpunan";
        } else if (jurnal.materi_pengajian?.kelompok) {
          kelompok = jurnal.materi_pengajian.kelompok === "himpunan" ? "himpunan" : "alquran";
        } else if (
          jurnal.catatan_kendala &&
          (jurnal.catatan_kendala.toLowerCase().includes("kitab") ||
            jurnal.catatan_kendala.toLowerCase().includes("baris") ||
            jurnal.catatan_kendala.toLowerCase().includes("hadits"))
        ) {
          kelompok = "himpunan";
        }

        // Details for Al-Qur'an
        let quranDetail = matchedCq;
        if (!quranDetail && kelompok === "alquran") {
          const catatanStr = jurnal.catatan_kendala || "";
          let suratTeks = "";
          let ayatAwalVal = 1;
          let ayatAkhirVal = 1;

          if (catatanStr.includes("QS.")) {
            const match = catatanStr.match(/QS\.\s*([^:\d|()]+)(?::\s*(\d+))?(?:\s*s\/d\s*(?:QS\.\s*)?([^:\d|()]+)(?::\s*(\d+))?)?/i);
            if (match) {
              suratTeks = match[1]?.trim() || "Al-Qur'an";
              ayatAwalVal = match[2] ? parseInt(match[2], 10) : 1;
              if (match[3] && match[3].trim() !== suratTeks) {
                suratTeks = `${suratTeks} s/d ${match[3].trim()}`;
              }
              ayatAkhirVal = match[4] ? parseInt(match[4], 10) : ayatAwalVal;
            }
          }

          const startHal = jurnal.realisasi_halaman_mulai || 1;
          const endHal = jurnal.realisasi_halaman_selesai || startHal;
          quranDetail = {
            surat_awal_nama: suratTeks || jurnal.materi_pengajian?.nama_materi || "Al-Qur'an",
            surat_akhir_nama: suratTeks || jurnal.materi_pengajian?.nama_materi || "Al-Qur'an",
            ayat_awal: ayatAwalVal,
            ayat_akhir: ayatAkhirVal,
            halaman_mulai: startHal,
            halaman_selesai: endHal,
            kategori_quran: endHal <= 341 ? "Cepatan: Hal 1-341" : "Lambatan: Hal 342-604",
            ringkasan_teks: suratTeks || `Halaman ${startHal} s/d ${endHal}`,
          };
        }

        // Details for Al-Hadist
        let haditsDetail = matchedCh;
        if (!haditsDetail && kelompok === "himpunan") {
          const catatanStr = jurnal.catatan_kendala || "";
          let kitabNama = jurnal.materi_pengajian?.nama_materi || "Kitab Himpunan";
          const matchKitab = masterHaditsList.find((k) => k.id === jurnal.materi_id);
          if (matchKitab) kitabNama = matchKitab.nama_kitab;

          let barisAwalVal = 1;
          let barisAkhirVal = 18;
          const barisMatch = catatanStr.match(/Baris\s*(\d+).*?Baris\s*(\d+)/i);
          if (barisMatch) {
            barisAwalVal = parseInt(barisMatch[1], 10) || 1;
            barisAkhirVal = parseInt(barisMatch[2], 10) || 18;
          }

          const startHal = jurnal.realisasi_halaman_mulai || 1;
          const endHal = jurnal.realisasi_halaman_selesai || startHal;
          haditsDetail = {
            kitab_awal_nama: kitabNama,
            kitab_akhir_nama: kitabNama,
            hal_awal: startHal,
            baris_awal: barisAwalVal,
            hal_akhir: endHal,
            baris_akhir: barisAkhirVal,
            ringkasan_teks: catatanStr.split("|")[0]?.trim() || `${kitabNama} Hal. ${startHal} s/d Hal. ${endHal}`,
          };
        }

        return {
          ...jurnal,
          teacherName,
          kelompok,
          capaian_quran: quranDetail,
          capaian_hadits: haditsDetail,
        };
      });

      setJurnals(enrichedJurnals);
    } catch (e: any) {
      console.error(e);
      onTriggerNotification(`Gagal memuat rekap jurnal: ${e.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to extract table fields strictly as requested
  const getTableRowFields = (jurnal: any) => {
    const isPegon =
      jurnal.kelompok === "pegon" ||
      jurnal.kelompok === "bacaan" ||
      jurnal.kelompok === "pegon_bacaan" ||
      isPegonOrBacaanClass ||
      (jurnal.kelas_pengajian || "").toLowerCase().includes("pegon") ||
      (jurnal.kelas_pengajian || "").toLowerCase().includes("bacaan");

    const catatanRaw = jurnal.catatan_kendala || "";

    if (isPegon) {
      let materi = "-";
      let cleanCatatan = "-";

      const matMatch = catatanRaw.match(/\[Materi:\s*([^\]]+)\]/i);
      const capMatch = catatanRaw.match(/Capaian:\s*([^|]+)/i);

      let matPart = matMatch ? matMatch[1].trim() : "";
      let capPart = capMatch ? capMatch[1].trim() : "";

      if (catatanRaw.includes("| Catatan:")) {
        cleanCatatan = catatanRaw.split("| Catatan:")[1]?.trim() || "-";
      } else if (catatanRaw.includes("Catatan:")) {
        cleanCatatan = catatanRaw.split("Catatan:")[1]?.trim() || "-";
      } else if (!matMatch && !capMatch && !catatanRaw.includes("[Materi:")) {
        cleanCatatan = catatanRaw.trim() || "-";
      }

      if (cleanCatatan.includes("[Materi:")) {
        cleanCatatan = cleanCatatan.replace(/\[Materi:\s*[^\]]+\]/gi, "").trim();
      }
      if (!cleanCatatan || cleanCatatan === "|") {
        cleanCatatan = "-";
      }

      if (jurnal.materi && typeof jurnal.materi === "string" && jurnal.materi.trim() !== "") {
        materi = jurnal.materi.trim();
      } else if (matPart && capPart) {
        materi = `${matPart} — ${capPart}`;
      } else if (capPart) {
        materi = capPart;
      } else if (matPart) {
        materi = matPart;
      } else if (catatanRaw && !catatanRaw.includes("Catatan:") && !catatanRaw.includes("[Materi:")) {
        materi = catatanRaw;
      } else {
        const fallMat = (jurnal.materi_pengajian?.nama_materi || "").toLowerCase();
        if (fallMat.includes("pegon") || fallMat.includes("bacaan")) {
          materi = jurnal.materi_pengajian.nama_materi;
        } else {
          materi = "Pegon & Bacaan";
        }
      }

      return {
        materi,
        halMulai: 1,
        ayatAtauBarisMulai: "",
        halSelesai: 1,
        ayatAtauBarisSelesai: "",
        statusText: "Tercapai",
        statusClass: "",
        cleanCatatan: cleanCatatan || "-",
        isQuran: false,
        isPegon: true
      };
    }

    const isQuran = jurnal.kelompok === "alquran";
    const cq = jurnal.capaian_quran;
    const ch = jurnal.capaian_hadits;

    // 1. MATERI:
    // "kalau al quran disi dengan nama surat nya kalau alhadist denga nama hadist nya"
    let materi = "-";
    let halMulai = jurnal.realisasi_halaman_mulai || 1;
    let ayatAtauBarisMulai = "";
    let halSelesai = jurnal.realisasi_halaman_selesai || halMulai;
    let ayatAtauBarisSelesai = "";

    if (isQuran) {
      if (cq) {
        if (cq.surat_awal_nama === cq.surat_akhir_nama || !cq.surat_akhir_nama) {
          materi = cq.surat_awal_nama;
        } else {
          materi = `${cq.surat_awal_nama} s/d ${cq.surat_akhir_nama}`;
        }
        halMulai = cq.halaman_mulai || halMulai;
        ayatAtauBarisMulai = `Ayat ${cq.ayat_awal || 1}`;
        halSelesai = cq.halaman_selesai || halSelesai;
        ayatAtauBarisSelesai = `Ayat ${cq.ayat_akhir || 1}`;
      } else {
        materi = jurnal.materi_pengajian?.nama_materi || "Al-Qur'an";
        ayatAtauBarisMulai = `Ayat 1`;
        ayatAtauBarisSelesai = `Ayat 1`;
      }
    } else {
      if (ch) {
        if (ch.kitab_awal_nama === ch.kitab_akhir_nama || !ch.kitab_akhir_nama) {
          materi = ch.kitab_awal_nama;
        } else {
          materi = `${ch.kitab_awal_nama} s/d ${ch.kitab_akhir_nama}`;
        }
        halMulai = ch.hal_awal || halMulai;
        ayatAtauBarisMulai = `Baris ${ch.baris_awal || 1}`;
        halSelesai = ch.hal_akhir || halSelesai;
        ayatAtauBarisSelesai = `Baris ${ch.baris_akhir || 18}`;
      } else {
        materi = jurnal.materi_pengajian?.nama_materi || "Kitab Himpunan";
        ayatAtauBarisMulai = `Baris 1`;
        ayatAtauBarisSelesai = `Baris 18`;
      }
    }

    // 2. STATUS: (tercapai/tidak tercapai/terlampaui)
    const rawStatus = (jurnal.status_capaian || "tercapai").toLowerCase();
    let statusText = "Tercapai";
    let statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";

    if (rawStatus === "belum_tercapai" || rawStatus === "tidak_tercapai" || rawStatus === "tidak tercapai") {
      statusText = "Tidak Tercapai";
      statusClass = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    } else if (rawStatus === "terlampaui") {
      statusText = "Terlampaui";
      statusClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    } else {
      statusText = "Tercapai";
      statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    }

    // 3. CATATAN:
    let cleanCatatan = catatanRaw;
    if (catatanRaw.includes("| Catatan:")) {
      cleanCatatan = catatanRaw.split("| Catatan:")[1]?.trim();
    } else if (catatanRaw.includes("Catatan:")) {
      cleanCatatan = catatanRaw.split("Catatan:")[1]?.trim();
    } else if (catatanRaw.startsWith("QS.") || catatanRaw.includes("Baris")) {
      cleanCatatan = "-";
    }

    return {
      materi,
      halMulai,
      ayatAtauBarisMulai,
      halSelesai,
      ayatAtauBarisSelesai,
      statusText,
      statusClass,
      cleanCatatan: cleanCatatan && cleanCatatan !== "" ? cleanCatatan : "-",
      isQuran
    };
  };

  const modalFields = useMemo(() => {
    if (!selectedDetailJurnal) return null;
    return getTableRowFields(selectedDetailJurnal);
  }, [selectedDetailJurnal]);

  // Filtered by Kelompok, Sesi, Search, and sorted by selected column (Naik / Turun)
  const filteredJurnals = useMemo(() => {
    const list = jurnals.filter((jurnal) => {
      // 1. Kelompok Filter (Dropdown)
      if (selectedKelompok === "pegon_bacaan") {
        if (jurnal.kelompok === "alquran" || jurnal.kelompok === "himpunan") {
          return false;
        }
      } else if (selectedKelompok === "pegon") {
        if (jurnal.kelompok !== "pegon") {
          return false;
        }
      } else if (selectedKelompok === "bacaan") {
        if (jurnal.kelompok !== "bacaan") {
          return false;
        }
      } else if (selectedKelompok === "alquran") {
        if (jurnal.kelompok !== "alquran") {
          return false;
        }
      } else if (selectedKelompok === "hadits") {
        if (jurnal.kelompok !== "himpunan") {
          return false;
        }
      }

      // 2. Sesi Filter
      if (selectedSesiFilter !== "semua") {
        if (String(jurnal.sesi_id) !== String(selectedSesiFilter)) {
          return false;
        }
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const tName = (jurnal.teacherName || "").toLowerCase();
        const sesi = (jurnal.sesi_mengaji?.nama_sesi || "").toLowerCase();
        const catatan = (jurnal.catatan_kendala || "").toLowerCase();
        const materi = (jurnal.materi_pengajian?.nama_materi || "").toLowerCase();
        const qSurat = (
          (jurnal.capaian_quran?.surat_awal_nama || "") +
          " " +
          (jurnal.capaian_quran?.surat_akhir_nama || "")
        ).toLowerCase();
        const hKitab = (
          (jurnal.capaian_hadits?.kitab_awal_nama || "") +
          " " +
          (jurnal.capaian_hadits?.kitab_akhir_nama || "")
        ).toLowerCase();

        const match =
          tName.includes(q) ||
          sesi.includes(q) ||
          catatan.includes(q) ||
          materi.includes(q) ||
          qSurat.includes(q) ||
          hKitab.includes(q);

        if (!match) return false;
      }

      return true;
    });

    // 4. Dynamic Column Sorting (Naik / Turun)
    return list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "tanggal") {
        cmp = (a.tanggal || "").localeCompare(b.tanggal || "");
        if (cmp === 0) {
          cmp = (Number(a.sesi_id) || 0) - (Number(b.sesi_id) || 0);
        }
      } else if (sortField === "sesi") {
        const sesiA = a.sesi_mengaji?.nama_sesi || "";
        const sesiB = b.sesi_mengaji?.nama_sesi || "";
        cmp = sesiA.localeCompare(sesiB);
      } else if (sortField === "guru") {
        const gA = a.teacherName || "";
        const gB = b.teacherName || "";
        cmp = gA.localeCompare(gB);
      } else if (sortField === "materi") {
        const fA = getTableRowFields(a);
        const fB = getTableRowFields(b);
        cmp = fA.materi.localeCompare(fB.materi);
      } else if (sortField === "hal_mulai") {
        const hA = a.realisasi_halaman_mulai || 1;
        const hB = b.realisasi_halaman_mulai || 1;
        cmp = hA - hB;
      } else if (sortField === "hal_selesai") {
        const hA = a.realisasi_halaman_selesai || 1;
        const hB = b.realisasi_halaman_selesai || 1;
        cmp = hA - hB;
      } else if (sortField === "status") {
        const sA = (a.status_capaian || "").toLowerCase();
        const sB = (b.status_capaian || "").toLowerCase();
        cmp = sA.localeCompare(sB);
      }

      return sortOrder === "desc" ? -cmp : cmp;
    });
  }, [jurnals, selectedKelompok, selectedSesiFilter, searchQuery, sortField, sortOrder]);

  // Render header with subtle chevron sort indicator (like screenshot)
  const renderSortHeader = (
    label: string,
    field: "tanggal" | "sesi" | "guru" | "materi" | "hal_mulai" | "hal_selesai" | "status"
  ) => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1 cursor-pointer select-none group font-bold uppercase text-[11px] text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        title={`Urutkan berdasarkan ${label} (${isActive && sortOrder === "desc" ? "Naik (Terlama / A-Z)" : "Turun (Terbaru / Z-A)"})`}
      >
        <span>{label}</span>
        {isActive ? (
          sortOrder === "desc" ? (
            <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 transition-transform" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 transition-transform" />
          )
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 opacity-60 group-hover:opacity-100 group-hover:text-blue-500 shrink-0 transition-opacity" />
        )}
      </button>
    );
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const totalMeetings = filteredJurnals.length;
    let totalHalaman = 0;
    let countTercapai = 0;
    let countTerlampaui = 0;
    let countTidakTercapai = 0;

    filteredJurnals.forEach((j) => {
      if (j.kelompok === "alquran") {
        const start = j.capaian_quran?.halaman_mulai || j.realisasi_halaman_mulai || 1;
        const end = j.capaian_quran?.halaman_selesai || j.realisasi_halaman_selesai || start;
        totalHalaman += Math.max(1, end - start + 1);
      } else {
        const start = j.capaian_hadits?.hal_awal || j.realisasi_halaman_mulai || 1;
        const end = j.capaian_hadits?.hal_akhir || j.realisasi_halaman_selesai || start;
        totalHalaman += Math.max(1, end - start + 1);
      }

      const st = (j.status_capaian || "tercapai").toLowerCase();
      if (st === "tercapai") countTercapai++;
      else if (st === "terlampaui") countTerlampaui++;
      else countTidakTercapai++;
    });

    const completionRate =
      totalMeetings > 0 ? Math.round(((countTercapai + countTerlampaui) / totalMeetings) * 100) : 0;

    return {
      totalMeetings,
      totalHalaman,
      completionRate,
      countTercapai,
      countTerlampaui,
      countTidakTercapai
    };
  }, [filteredJurnals]);

  const handlePrint = () => {
    window.print();
  };

  const formatTanggalIndo = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getMonthNameIndo = (monthStr: string) => {
    if (!monthStr) return "";
    try {
      const [y, m] = monthStr.split("-");
      const d = new Date(Number(y), Number(m) - 1, 1);
      return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    } catch {
      return monthStr;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* ================================================================ */}
      {/* 1. HEADER SECTION & PRINT ACTION */}
      {/* ================================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <FileText className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                Rekap Jurnal Pengajian
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
                Riwayat dan evaluasi capaian mengajar Al-Qur'an &amp; Al-Hadist terpisah secara spesifik
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-blue-500" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 2. FILTER CARD: KELAS, KELOMPOK (DROP DOWN), BULAN, SESI */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs print:hidden space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-blue-500" />
            <span>Filter Rekap Jurnal</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            Periode: {getMonthNameIndo(selectedMonth)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. KELAS PENGAJIAN */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              Kelas Pengajian
            </label>
            <select
              value={selectedClass}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedClass(val);
                const lower = val.toLowerCase();
                if (lower.includes("pegon") || lower.includes("bacaan")) {
                  setSelectedKelompok("pegon_bacaan");
                } else if (selectedKelompok === "pegon_bacaan" || selectedKelompok === "pegon" || selectedKelompok === "bacaan") {
                  setSelectedKelompok("alquran");
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
            >
              <option value="">-- Pilih Kelas --</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 2. MATERI: DROP DOWN */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Materi <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedKelompok}
              onChange={(e) => setSelectedKelompok(e.target.value as any)}
              className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm outline-none font-bold transition-colors cursor-pointer ${
                selectedKelompok === "pegon_bacaan" || selectedKelompok === "pegon" || selectedKelompok === "bacaan"
                  ? "border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/50"
                  : selectedKelompok === "alquran"
                  ? "border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/50"
                  : selectedKelompok === "hadits"
                  ? "border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400/50"
                  : "border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              }`}
            >
              <option value="pegon">Pegon</option>
              <option value="bacaan">Bacaan</option>
              <option value="alquran">Al Quran</option>
              <option value="hadits">Al Hadist</option>
              <option value="semua">Semua Materi</option>
            </select>
          </div>

          {/* 3. BULAN */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              Bulan
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* 4. SESI MENGAJI */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              Sesi Mengaji
            </label>
            <select
              value={selectedSesiFilter}
              onChange={(e) => setSelectedSesiFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
            >
              <option value="semua">-- Semua Sesi --</option>
              {sesiList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama_sesi} ({s.jam_mulai?.slice(0, 5) || ""}-{s.jam_selesai?.slice(0, 5) || ""})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Search, Filter & Pill Toggles */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Quick Tab Pill for Easy Switching */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex-wrap">
            {isPegonOrBacaanClass ? (
              <>
                <button
                  onClick={() => setSelectedKelompok("pegon_bacaan")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedKelompok === "pegon_bacaan"
                      ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>✍️📖</span>
                  <span>Pegon &amp; Bacaan</span>
                </button>
                <button
                  onClick={() => setSelectedKelompok("pegon")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedKelompok === "pegon"
                      ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>✍️</span>
                  <span>Pegon</span>
                </button>
                <button
                  onClick={() => setSelectedKelompok("bacaan")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedKelompok === "bacaan"
                      ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>📖</span>
                  <span>Bacaan</span>
                </button>
                <button
                  onClick={() => setSelectedKelompok("semua")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedKelompok === "semua"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Semua</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedKelompok("alquran")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedKelompok === "alquran"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Al-Qur'an</span>
                </button>
                <button
                  onClick={() => setSelectedKelompok("hadits")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedKelompok === "hadits"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Book className="w-3.5 h-3.5" />
                  <span>Al-Hadist</span>
                </button>
                <button
                  onClick={() => setSelectedKelompok("semua")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedKelompok === "semua"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Semua</span>
                </button>
              </>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari guru, surat, kitab, sesi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 3. PRINT REPORT HEADER (Only displayed when printing) */}
      {/* ================================================================ */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
          Laporan Rekap Jurnal Pengajian
        </h1>
        <p className="text-sm text-slate-700 font-semibold mt-1">
          Pondok Pesantren Al-Muttaqin
        </p>
        <div className="flex justify-center items-center gap-6 text-xs text-slate-600 mt-2 font-medium">
          <span>Kelas: <strong>{selectedClass || "-"}</strong></span>
          <span>•</span>
          <span>
            Kelompok:{" "}
            <strong>
              {selectedKelompok === "alquran"
                ? "Al-Qur'an (Surat & Ayat)"
                : selectedKelompok === "hadits"
                ? "Al-Hadist (Kitab & Baris)"
                : "Semua Kelompok"}
            </strong>
          </span>
          <span>•</span>
          <span>Bulan: <strong>{getMonthNameIndo(selectedMonth)}</strong></span>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 4. STATISTIC CARDS */}
      {/* ================================================================ */}
      {!isLoading && selectedClass && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Pertemuan
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {stats.totalMeetings} <span className="text-xs font-normal text-slate-400">Jurnal</span>
              </div>
            </div>
          </div>

          {isPegonBacaanView ? (
            <>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Sesi Terlaksana
                  </div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                    {stats.totalMeetings} <span className="text-xs font-normal text-slate-400">Sesi</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Kelas Pengajian
                  </div>
                  <div className="text-lg font-black text-teal-600 dark:text-teal-400">
                    {selectedClass}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Kurikulum Pondok
                  </div>
                  <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    Materi Mandiri
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedKelompok === "alquran"
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                    : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                }`}>
                  {selectedKelompok === "alquran" ? <BookOpen className="w-5 h-5" /> : <Book className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {selectedKelompok === "alquran"
                      ? "Total Halaman Mushaf"
                      : selectedKelompok === "hadits"
                      ? "Total Halaman Kitab"
                      : "Total Halaman"}
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    {stats.totalHalaman} <span className="text-xs font-normal text-slate-400">Halaman</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Target Tercapai
                  </div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {stats.countTercapai + stats.countTerlampaui}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      ({stats.countTerlampaui} terlampaui)
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Ketercapaian
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    {stats.completionRate}%
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* 5. MAIN DATA TABLE                                               */}
      {/* Khusus Pegon & Bacaan: No, Tanggal, Sesi, Guru, Materi, Catatan  */}
      {/* Al-Qur'an / Hadits: 10 Kolom Standar                             */}
      {/* ================================================================ */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="animate-spin w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full mb-3" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Memuat riwayat rekap jurnal pengajian...
          </p>
        </div>
      ) : !selectedClass ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
          <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <p className="text-sm font-semibold">Silakan pilih Kelas Pengajian terlebih dahulu.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Table Header Bar */}
          <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPegonBacaanView ? (
                <span className="text-base">✍️📖</span>
              ) : selectedKelompok === "alquran" ? (
                <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : selectedKelompok === "hadits" ? (
                <Book className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                {isPegonBacaanView
                  ? "Tabel Rekap Jurnal Pegon & Bacaan"
                  : selectedKelompok === "alquran"
                  ? "Tabel Rekap Jurnal Al-Qur'an (Surat & Ayat)"
                  : selectedKelompok === "hadits"
                  ? "Tabel Rekap Jurnal Al-Hadist (Kitab & Baris)"
                  : "Tabel Rekap Jurnal Pengajian (Al-Qur'an & Al-Hadist)"}
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {filteredJurnals.length} pertemuan tercatat
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              {isPegonBacaanView ? (
                /* TABEL KHUSUS PEGON & BACAAN: NO, TANGGAL, SESI, GURU, MATERI, CATATAN */
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold uppercase text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-3 text-center w-12 font-bold uppercase text-[11px]">No</th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {renderSortHeader("Tanggal", "tanggal")}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {renderSortHeader("Sesi", "sesi")}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {renderSortHeader("Guru", "guru")}
                    </th>
                    <th className="px-4 py-3">
                      {renderSortHeader("Materi", "materi")}
                    </th>
                    <th className="px-4 py-3 min-w-[200px] font-bold uppercase text-[11px]">Catatan</th>
                    <th className="px-3 py-3 text-center w-14 font-bold uppercase text-[11px] print:hidden">Aksi</th>
                  </tr>
                </thead>
              ) : (
                /* TABEL KURIKULUM (AL-QUR'AN / HADITS) */
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold uppercase text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-3 text-center w-12 font-bold uppercase text-[11px]">No</th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {renderSortHeader("Tanggal", "tanggal")}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {renderSortHeader("Sesi", "sesi")}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {renderSortHeader("Guru", "guru")}
                    </th>
                    <th className="px-4 py-3">
                      {renderSortHeader("Materi", "materi")}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {renderSortHeader("Halaman Mulai", "hal_mulai")}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {renderSortHeader("Halaman Selesai", "hal_selesai")}
                    </th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex justify-center">
                        {renderSortHeader("Status", "status")}
                      </div>
                    </th>
                    <th className="px-4 py-3 min-w-[180px] font-bold uppercase text-[11px]">Catatan</th>
                    <th className="px-3 py-3 text-center w-14 font-bold uppercase text-[11px] print:hidden">Aksi</th>
                  </tr>
                </thead>
              )}

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredJurnals.length === 0 ? (
                  <tr>
                    <td colSpan={isPegonBacaanView ? 7 : 10} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm">
                          Tidak ada data jurnal pengajian untuk kriteria yang dipilih.
                        </p>
                        <p className="text-xs text-slate-400">
                          Coba ganti bulan, kelas pengajian, atau kelompok materi di atas.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredJurnals.map((jurnal, index) => {
                    const fields = getTableRowFields(jurnal);

                    if (isPegonBacaanView || fields.isPegon) {
                      /* BARIS KHUSUS PEGON & BACAAN: NO, TANGGAL, SESI, GURU, MATERI, CATATAN */
                      return (
                        <tr
                          key={jurnal.id || index}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* 1. NOMOR */}
                          <td className="px-3.5 py-3 text-center font-mono text-slate-400">
                            {index + 1}
                          </td>

                          {/* 2. TANGGAL */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {formatTanggalIndo(jurnal.tanggal)}
                            </span>
                          </td>

                          {/* 3. SESI */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{jurnal.sesi_mengaji?.nama_sesi || "Sesi Mengaji"}</span>
                            </div>
                          </td>

                          {/* 4. GURU */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {jurnal.teacherName}
                            </span>
                          </td>

                          {/* 5. MATERI */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                              <span className="text-sm">✍️</span>
                              <span>{fields.materi}</span>
                            </div>
                          </td>

                          {/* 6. CATATAN */}
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 break-words">
                            {fields.cleanCatatan}
                          </td>

                          {/* 7. AKSI */}
                          <td className="px-3 py-3 text-center whitespace-nowrap print:hidden">
                            <button
                              onClick={() => setSelectedDetailJurnal(jurnal)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Lihat Detail Jurnal"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={jurnal.id || index}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. NOMOR */}
                        <td className="px-3.5 py-3 text-center font-mono text-slate-400">
                          {index + 1}
                        </td>

                        {/* 2. TANGGAL */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {formatTanggalIndo(jurnal.tanggal)}
                          </span>
                        </td>

                        {/* 3. SESI */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                            <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{jurnal.sesi_mengaji?.nama_sesi || "Sesi Mengaji"}</span>
                          </div>
                        </td>

                        {/* 4. GURU */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {jurnal.teacherName}
                          </span>
                        </td>

                        {/* 5. MATERI (Surat untuk Al-Qur'an, Hadits untuk Al-Hadist) */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {fields.isQuran ? (
                              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Book className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            )}
                            <span className={fields.isQuran ? "text-emerald-800 dark:text-emerald-300" : "text-indigo-800 dark:text-indigo-300"}>
                              {fields.materi}
                            </span>
                          </div>
                          {selectedKelompok === "semua" && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {fields.isQuran ? "Al-Qur'an" : "Al-Hadist"}
                            </div>
                          )}
                        </td>

                        {/* 6. HALAMAN MULAI (Ayat / Baris) */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            Hal. {fields.halMulai}
                          </span>{" "}
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            ({fields.ayatAtauBarisMulai})
                          </span>
                        </td>

                        {/* 7. HALAMAN SELESAI (Ayat / Baris) */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            Hal. {fields.halSelesai}
                          </span>{" "}
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            ({fields.ayatAtauBarisSelesai})
                          </span>
                        </td>

                        {/* 8. STATUS (tercapai/tidak tercapai/terlampaui) */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${fields.statusClass}`}
                          >
                            {fields.statusText}
                          </span>
                        </td>

                        {/* 9. CATATAN */}
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 break-words">
                          {fields.cleanCatatan}
                        </td>

                        {/* 10. DETAIL ACTION BUTTON */}
                        <td className="px-3 py-3 text-center whitespace-nowrap print:hidden">
                          <button
                            onClick={() => setSelectedDetailJurnal(jurnal)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Lihat Detail Jurnal"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 6. MODAL DETAIL JURNAL PENGAJIAN                                 */}
      {/* ================================================================ */}
      {selectedDetailJurnal && modalFields && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {modalFields.isPegon ? (
                  <span className="text-lg">✍️📖</span>
                ) : selectedDetailJurnal.kelompok === "alquran" ? (
                  <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Book className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                )}
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Detail Jurnal {modalFields.isPegon ? "Pegon & Bacaan" : selectedDetailJurnal.kelompok === "alquran" ? "Al-Qur'an" : "Al-Hadist"}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetailJurnal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">Tanggal:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatTanggalIndo(selectedDetailJurnal.tanggal)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Sesi:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {selectedDetailJurnal.sesi_mengaji?.nama_sesi || "Sesi Mengaji"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Kelas:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedDetailJurnal.kelas_pengajian}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Guru / Ustaz:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedDetailJurnal.teacherName}
                  </span>
                </div>
              </div>

              {/* Rincian Materi */}
              {modalFields.isPegon ? (
                <div className="p-4 rounded-xl border bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                      <span>✍️</span>
                      <span>Materi &amp; Realisasi Pembelajaran</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      Pegon &amp; Bacaan
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200/60 dark:border-amber-800/60 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {modalFields.materi}
                  </div>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400 italic">
                    Materi diisi secara mandiri/custom oleh guru pengajar karena tidak tertulis dalam kurikulum baku pondok.
                  </p>
                </div>
              ) : (
                <div
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    modalFields.isQuran
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/40"
                      : "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      {modalFields.isQuran ? (
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Book className="w-4 h-4 text-indigo-600" />
                      )}
                      <span>
                        {modalFields.isQuran
                          ? "Materi Al-Qur'an (Surat & Ayat)"
                          : "Materi Al-Hadist (Kitab & Baris)"}
                      </span>
                    </div>
                    <span className="font-bold text-xs uppercase px-2 py-0.5 rounded-md bg-white/70 dark:bg-slate-900/60">
                      {modalFields.materi}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 bg-white/80 dark:bg-slate-900/70 rounded-lg border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                        Halaman Mulai
                      </span>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        Hal. {modalFields.halMulai}{" "}
                        <span className="text-slate-500 text-[11px]">
                          ({modalFields.ayatAtauBarisMulai})
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-white/80 dark:bg-slate-900/70 rounded-lg border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">
                        Halaman Selesai
                      </span>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        Hal. {modalFields.halSelesai}{" "}
                        <span className="text-slate-500 text-[11px]">
                          ({modalFields.ayatAtauBarisSelesai})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status & Catatan */}
              <div className="space-y-2 pt-1">
                {!modalFields.isPegon && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      Status Ketercapaian:
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${modalFields.statusClass}`}>
                      {modalFields.statusText}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                    Catatan Guru:
                  </span>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                    {modalFields.cleanCatatan}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDetailJurnal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
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
