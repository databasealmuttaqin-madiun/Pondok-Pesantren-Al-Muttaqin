import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase, SantriData } from "../supabaseClient";
import { 
  Save, AlertCircle, Plus, Edit, Trash2, Calendar, BookOpen, 
  Users, CheckCircle, Clock, XCircle, Info, ClipboardEdit, Target,
  User as UserIcon, Search, ArrowRight, Book, Layers, AlignLeft,
  Sparkles, CheckSquare, Square, ChevronRight, Hash, Database, Copy, Check, X
} from "lucide-react";
import { QURAN_SURAHS, calculateQuranPageRange } from "../data/quranSurahData";

const MySwal = withReactContent(Swal);

interface Props {
  currentUserRole: string;
  userTugasTambahan?: string[];
  recitationClasses: string[];
  onTriggerNotification: (msg: string, type: "success" | "error" | "warning" | "info") => void;
  currentUser?: any;
}

export default function JurnalPengajianPanel({
  currentUserRole,
  userTugasTambahan,
  recitationClasses,
  onTriggerNotification,
  currentUser
}: Props) {
  // Filter Atas
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedKelompok, setSelectedKelompok] = useState<"alquran" | "himpunan" | "">("alquran");
  const [selectedSesi, setSelectedSesi] = useState<string>("");
  
  // Data master
  const [sesiList, setSesiList] = useState<any[]>([]);
  const [materiList, setMateriList] = useState<any[]>([]);
  const [haditsKitabList, setHaditsKitabList] = useState<any[]>([]);
  const [ustazList, setUstazList] = useState<any[]>([]);
  const [targetInfo, setTargetInfo] = useState<any>(null);
  const [santriList, setSantriList] = useState<SantriData[]>([]);
  const [searchSantri, setSearchSantri] = useState("");
  
  // Form State Umum
  const [selectedUstaz, setSelectedUstaz] = useState<string>("");
  const [catatan, setCatatan] = useState<string>("");
  const [absensiMap, setAbsensiMap] = useState<Record<string, { status: string, keterangan: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingJurnal, setExistingJurnal] = useState<any>(null);
  const [dbMissing, setDbMissing] = useState(false);

  // =========================================================
  // STATE KHUSUS FORM AL-QUR'AN
  // =========================================================
  const [quranSuratAwal, setQuranSuratAwal] = useState<number>(1);
  const [quranAyatAwal, setQuranAyatAwal] = useState<number | "">(1);
  const [isQuranBersambung, setIsQuranBersambung] = useState<boolean>(false);
  const [quranSuratAkhir, setQuranSuratAkhir] = useState<number>(1);
  const [quranAyatAkhir, setQuranAyatAkhir] = useState<number | "">(7);

  // =========================================================
  // STATE KHUSUS FORM AL-HADIST (HIMPUNAN)
  // =========================================================
  const [haditsKitabAwal, setHaditsKitabAwal] = useState<number | "">("");
  const [haditsHalAwal, setHaditsHalAwal] = useState<number | "">(1);
  const [haditsBarisAwal, setHaditsBarisAwal] = useState<number | "">(1);
  const [isHaditsBersambung, setIsHaditsBersambung] = useState<boolean>(false);
  const [haditsKitabAkhir, setHaditsKitabAkhir] = useState<number | "">("");
  const [haditsHalAkhir, setHaditsHalAkhir] = useState<number | "">(1);
  const [haditsBarisAkhir, setHaditsBarisAkhir] = useState<number | "">(18);

  // Database Connection State & SQL Modal
  const [hasLiveDb, setHasLiveDb] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // 1. Fetch Sesi, Materi, Hadits Kitab, dan Ustaz
  useEffect(() => {
    const fetchData = async () => {
      // Fetch Sesi
      try {
        const { data: sesiData, error: sesiError } = await supabase
          .from("sesi_mengaji")
          .select("*")
          .order("urutan", { ascending: true });
        if (sesiError && (sesiError.code === 'PGRST205' || sesiError.message.includes('table'))) {
          setDbMissing(true);
        }
        if (sesiData) {
          setSesiList(sesiData);
          if (sesiData.length > 0 && !selectedSesi) setSelectedSesi(sesiData[0].id.toString());
        }
      } catch (e) {
        console.warn("Error fetching sesi:", e);
      }

      // Fetch Materi Pengajian (Umum)
      try {
        const { data: materiData } = await supabase
          .from("materi_pengajian")
          .select("*")
          .order("urutan", { ascending: true });
        if (materiData) setMateriList(materiData);
      } catch (e) {
        console.warn("Error fetching materi:", e);
      }

      // Fetch Master Hadits Kitab
      try {
        let loadedHadits: any[] = [];
        const { data: hData, error: hErr } = await supabase
          .from("master_hadits_kitab")
          .select("*")
          .order("urutan", { ascending: true });

        if (!hErr && hData && hData.length > 0) {
          loadedHadits = hData;
        } else {
          // Fallback dari materi_pengajian kelompok himpunan
          const { data: mpData } = await supabase
            .from("materi_pengajian")
            .select("*")
            .eq("kelompok", "himpunan")
            .order("urutan", { ascending: true });
          if (mpData && mpData.length > 0) {
            loadedHadits = mpData.map(item => ({
              id: item.id,
              urutan: item.urutan || 1,
              nama_kitab: item.nama_materi,
              total_hal: item.jumlah_halaman || 40,
              default_max_baris: 18
            }));
          }
        }
        setHaditsKitabList(loadedHadits);
        if (loadedHadits.length > 0 && !haditsKitabAwal) {
          setHaditsKitabAwal(loadedHadits[0].id);
          setHaditsKitabAkhir(loadedHadits[0].id);
        }
      } catch (e) {
        console.warn("Error fetching hadits kitab:", e);
      }

      // Fetch Ustaz
      try {
        let dbPlot: any[] = [];
        let dbGuru: any[] = [];
        let dbPengguna: any[] = [];

        try {
          const { data: pData } = await supabase.from("plotting_guru_pondok").select("*").order("id", { ascending: true });
          if (pData && pData.length > 0) dbPlot = pData;
        } catch {
          const cached = localStorage.getItem("plotting_guru_pondok_data");
          if (cached) dbPlot = JSON.parse(cached);
        }

        try {
          const { data: gData } = await supabase.from("guru").select("*");
          if (gData) dbGuru = gData;
        } catch {}

        try {
          const { data: uData } = await supabase.from("pengguna").select("*");
          if (uData) dbPengguna = uData;
        } catch {}

        if (dbPlot && dbPlot.length > 0) {
          const mappedUstaz: any[] = [];
          const seenNames = new Set<string>();

          dbPlot.forEach(plot => {
            const rawId = String(plot.guru_id || plot.id || "");
            const explicitName = (plot.guru_nama || plot.nama || "").trim();

            const matchedGuru = dbGuru.find(
              g =>
                String(g.id) === rawId ||
                (g.pengguna_id && String(g.pengguna_id) === rawId) ||
                (g.username && rawId && g.username.toLowerCase() === rawId.toLowerCase()) ||
                (explicitName && g.nama_lengkap && g.nama_lengkap.trim().toLowerCase() === explicitName.toLowerCase()) ||
                (explicitName && g.nama && g.nama.trim().toLowerCase() === explicitName.toLowerCase())
            );

            const matchedUser = dbPengguna.find(
              u =>
                (matchedGuru?.pengguna_id && String(u.id) === String(matchedGuru.pengguna_id)) ||
                String(u.id) === rawId ||
                (matchedGuru?.username && u.username && u.username.toLowerCase() === matchedGuru.username.toLowerCase()) ||
                (explicitName && u.nama_lengkap && u.nama_lengkap.trim().toLowerCase() === explicitName.toLowerCase()) ||
                (explicitName && u.nama && u.nama.trim().toLowerCase() === explicitName.toLowerCase())
            );

            const resolvedName = (
              matchedUser?.nama_lengkap ||
              matchedUser?.nama ||
              matchedGuru?.nama_lengkap ||
              matchedGuru?.nama ||
              explicitName ||
              "Guru Pondok"
            ).trim();

            const primaryId = String(matchedUser?.id || matchedGuru?.pengguna_id || matchedGuru?.id || plot.guru_id || plot.id);

            if (resolvedName && !seenNames.has(resolvedName.toLowerCase())) {
              seenNames.add(resolvedName.toLowerCase());
              mappedUstaz.push({
                id: primaryId,
                pengguna_id: matchedUser?.id,
                guru_id: matchedGuru?.id,
                nama: resolvedName,
                username: matchedUser?.username || matchedGuru?.username || ""
              });
            }
          });

          mappedUstaz.sort((a, b) => a.nama.localeCompare(b.nama));
          if (mappedUstaz.length > 0) setUstazList(mappedUstaz);
        }
      } catch (err) {
        console.warn("Error loading ustaz list:", err);
      }
    };

    fetchData();
  }, []);

  // Set default selectedUstaz
  useEffect(() => {
    if (currentUser?.id && ustazList.length > 0 && !selectedUstaz) {
      const matched = ustazList.find(
        u =>
          String(u.id) === String(currentUser.id) ||
          String(u.pengguna_id) === String(currentUser.id) ||
          (currentUser.nama && u.nama.toLowerCase() === currentUser.nama.toLowerCase()) ||
          (currentUser.username && u.username && u.username.toLowerCase() === currentUser.username.toLowerCase())
      );
      if (matched) setSelectedUstaz(matched.id);
    }
  }, [currentUser, ustazList]);

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

  // Kalkulasi Otomatis Al-Qur'an (Halaman Mushaf & Kategori)
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

  // Load target & existing journal & santri
  useEffect(() => {
    if (selectedClass && selectedDate && selectedKelompok && selectedSesi) {
      loadData();
    } else {
      setTargetInfo(null);
      setSantriList([]);
      setAbsensiMap({});
      setExistingJurnal(null);
    }
  }, [selectedClass, selectedDate, selectedKelompok, selectedSesi]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Get Target dari target_pengajian
      const { data: targetData } = await supabase
        .from("target_pengajian")
        .select("*, materi_pengajian!inner(nama_materi, kelompok)")
        .eq("kelas_pengajian", selectedClass)
        .eq("tanggal", selectedDate)
        .eq("materi_pengajian.kelompok", selectedKelompok)
        .maybeSingle();

      let enhancedTarget: any = targetData ? { ...targetData } : null;
      let hasLive = false;

      // Hubungkan detail dari tabel target_quran (Supabase)
      if (selectedKelompok === "alquran") {
        try {
          let tq = null;
          if (targetData?.id) {
            const { data: tqData, error: err1 } = await supabase
              .from("target_quran")
              .select("*")
              .eq("target_pengajian_id", targetData.id)
              .maybeSingle();
            if (!err1 && tqData) tq = tqData;
          }
          if (!tq) {
            const { data: tqData, error: err2 } = await supabase
              .from("target_quran")
              .select("*")
              .eq("kelas_id", selectedClass)
              .eq("tanggal", selectedDate)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!err2 && tqData) tq = tqData;
          }

          if (tq) {
            hasLive = true;
            if (!enhancedTarget) {
              enhancedTarget = {
                id: tq.target_pengajian_id || 0,
                kelas_pengajian: selectedClass,
                tanggal: selectedDate,
                pertemuan_ke: tq.pertemuan_ke || 1,
                target_halaman_mulai: tq.halaman_awal,
                target_halaman_selesai: tq.halaman_akhir,
                materi_pengajian: {
                  nama_materi: tq.halaman_awal <= 341 ? "Al Quran Cepatan" : "Al Quran Lambatan",
                  kelompok: "alquran"
                }
              };
            }
            enhancedTarget.target_quran_detail = tq;
          }
        } catch (errQ) {
          console.warn("Notice loading target_quran:", errQ);
        }
      } else {
        // Hubungkan detail dari tabel target_hadits (Supabase)
        try {
          let th = null;
          if (targetData?.id) {
            const { data: thData, error: err1 } = await supabase
              .from("target_hadits")
              .select("*")
              .eq("target_pengajian_id", targetData.id)
              .maybeSingle();
            if (!err1 && thData) th = thData;
          }
          if (!th) {
            const { data: thData, error: err2 } = await supabase
              .from("target_hadits")
              .select("*")
              .eq("kelas_id", selectedClass)
              .eq("tanggal", selectedDate)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!err2 && thData) th = thData;
          }

          if (th) {
            hasLive = true;
            const matchingKitab = haditsKitabList.find(k => k.id === th.kitab_awal_id);
            if (!enhancedTarget) {
              enhancedTarget = {
                id: th.target_pengajian_id || 0,
                kelas_pengajian: selectedClass,
                tanggal: selectedDate,
                pertemuan_ke: th.pertemuan_ke || 1,
                target_halaman_mulai: th.hal_awal,
                target_halaman_selesai: th.hal_akhir,
                materi_pengajian: {
                  nama_materi: matchingKitab?.nama_kitab || "Kitab Himpunan",
                  kelompok: "himpunan"
                }
              };
            }
            enhancedTarget.target_hadits_detail = th;
          }
        } catch (errH) {
          console.warn("Notice loading target_hadits:", errH);
        }
      }

      setHasLiveDb(hasLive);
      setTargetInfo(enhancedTarget || null);

      // 2. Check if Jurnal already exists
      const { data: jurnalData } = await supabase
        .from("jurnal_pengajian")
        .select("*, materi_pengajian!inner(kelompok)")
        .eq("kelas_pengajian", selectedClass)
        .eq("tanggal", selectedDate)
        .eq("sesi_id", selectedSesi)
        .eq("materi_pengajian.kelompok", selectedKelompok)
        .maybeSingle();

      if (jurnalData) {
        setExistingJurnal(jurnalData);
        setSelectedUstaz(jurnalData.ustaz_id ? jurnalData.ustaz_id.toString() : (currentUser?.id?.toString() || ""));
        setCatatan(jurnalData.catatan_kendala || "");

        // Cek apakah ada record di capaian_quran
        if (selectedKelompok === "alquran") {
          try {
            const { data: cqData } = await supabase
              .from("capaian_quran")
              .select("*")
              .eq("jurnal_id", jurnalData.id)
              .maybeSingle();

            if (cqData) {
              setQuranSuratAwal(cqData.surat_awal_no || 1);
              setQuranAyatAwal(cqData.ayat_awal || 1);
              setIsQuranBersambung(Boolean(cqData.is_bersambung));
              setQuranSuratAkhir(cqData.surat_akhir_no || cqData.surat_awal_no || 1);
              setQuranAyatAkhir(cqData.ayat_akhir || 7);
            }
          } catch {
            // Abaikan jika tabel belum ada
          }
        }

        // Cek apakah ada record di capaian_hadits
        if (selectedKelompok === "himpunan") {
          try {
            const { data: chData } = await supabase
              .from("capaian_hadits")
              .select("*")
              .eq("jurnal_id", jurnalData.id)
              .maybeSingle();

            if (chData) {
              setHaditsKitabAwal(chData.kitab_awal_id || haditsKitabList[0]?.id || "");
              setHaditsHalAwal(chData.hal_awal || 1);
              setHaditsBarisAwal(chData.baris_awal || 1);
              setIsHaditsBersambung(Boolean(chData.is_bersambung));
              setHaditsKitabAkhir(chData.kitab_akhir_id || chData.kitab_awal_id || haditsKitabList[0]?.id || "");
              setHaditsHalAkhir(chData.hal_akhir || 1);
              setHaditsBarisAkhir(chData.baris_akhir || 18);
            } else {
              setHaditsHalAwal(jurnalData.realisasi_halaman_mulai || 1);
              setHaditsHalAkhir(jurnalData.realisasi_halaman_selesai || 1);
            }
          } catch {
            // Abaikan jika tabel belum ada
          }
        }

        // Load absensi for this jurnal
        const { data: absData } = await supabase
          .from("absensi_pengajian")
          .select("*")
          .eq("jurnal_id", jurnalData.id);

        if (absData) {
          const loadedAbs: any = {};
          absData.forEach(a => {
            loadedAbs[a.santri_id] = { status: a.status, keterangan: a.keterangan || "" };
          });
          setAbsensiMap(loadedAbs);
        }
      } else {
        setExistingJurnal(null);
        setCatatan("");

        // Auto-fill dari target yang sudah ditetapkan jika jurnal baru
        if (selectedKelompok === "alquran" && enhancedTarget?.target_quran_detail) {
          const tq = enhancedTarget.target_quran_detail;
          setQuranSuratAwal(tq.surah_awal_id);
          setQuranAyatAwal(tq.ayat_awal);
          setQuranSuratAkhir(tq.surah_akhir_id);
          setQuranAyatAkhir(tq.ayat_akhir);
          setIsQuranBersambung(tq.surah_awal_id !== tq.surah_akhir_id);
        } else if (selectedKelompok === "himpunan" && enhancedTarget?.target_hadits_detail) {
          const th = enhancedTarget.target_hadits_detail;
          setHaditsKitabAwal(th.kitab_awal_id);
          setHaditsHalAwal(th.hal_awal);
          setHaditsBarisAwal(th.baris_awal || 1);
          setHaditsKitabAkhir(th.kitab_akhir_id || th.kitab_awal_id);
          setHaditsHalAkhir(th.hal_akhir);
          setHaditsBarisAkhir(th.baris_akhir || 18);
          setIsHaditsBersambung(th.kitab_awal_id !== th.kitab_akhir_id);
        } else if (selectedKelompok === "alquran") {
          // Auto-fill kelanjutan dari pertemuan sebelumnya
          try {
            const { data: prevCq } = await supabase
              .from("capaian_quran")
              .select("*")
              .eq("kelas_pengajian", selectedClass)
              .lte("tanggal", selectedDate)
              .order("tanggal", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (prevCq) {
              const surahPrev = QURAN_SURAHS.find(s => s.nomor === prevCq.surat_akhir_no);
              const nextAyat = prevCq.ayat_akhir + 1;
              if (surahPrev && nextAyat <= surahPrev.jumlah_ayat) {
                setQuranSuratAwal(prevCq.surat_akhir_no);
                setQuranAyatAwal(nextAyat);
                setQuranSuratAkhir(prevCq.surat_akhir_no);
                setQuranAyatAkhir(Math.min(surahPrev.jumlah_ayat, nextAyat + 5));
              } else if (prevCq.surat_akhir_no < 114) {
                const nextSurat = prevCq.surat_akhir_no + 1;
                const nextSuratObj = QURAN_SURAHS.find(s => s.nomor === nextSurat);
                setQuranSuratAwal(nextSurat);
                setQuranAyatAwal(1);
                setQuranSuratAkhir(nextSurat);
                setQuranAyatAkhir(Math.min(nextSuratObj?.jumlah_ayat || 10, 10));
              }
            }
          } catch {}
        } else if (selectedKelompok === "himpunan") {
          try {
            const { data: prevCh } = await supabase
              .from("capaian_hadits")
              .select("*")
              .eq("kelas_pengajian", selectedClass)
              .lte("tanggal", selectedDate)
              .order("tanggal", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (prevCh) {
              setHaditsKitabAwal(prevCh.kitab_akhir_id || haditsKitabList[0]?.id || "");
              setHaditsKitabAkhir(prevCh.kitab_akhir_id || haditsKitabList[0]?.id || "");
              setHaditsHalAwal(prevCh.hal_akhir || 1);
              setHaditsBarisAwal((prevCh.baris_akhir || 1) + 1);
              setHaditsHalAkhir((prevCh.hal_akhir || 1) + 1);
              setHaditsBarisAkhir(18);
            }
          } catch {}
        }
      }

      // Load Santri for this class
      const cached = localStorage.getItem("santri_data");
      let allSantri: SantriData[] = cached ? JSON.parse(cached) : [];
      const classSantri = allSantri.filter(s => (s as any).kelas_pengajian === selectedClass);
      setSantriList(classSantri);

      // Inisialisasi absensi default jika jurnal baru
      if (!jurnalData) {
        const initAbs: Record<string, { status: string, keterangan: string }> = {};
        classSantri.forEach(s => {
          if (s.id) {
            let defaultStatus = 'hadir';
            if (s.status === 'Sakit') defaultStatus = 'sakit';
            if (s.status === 'Pulang') defaultStatus = 'izin';
            initAbs[s.id] = { status: defaultStatus, keterangan: '' };
          }
        });
        setAbsensiMap(initAbs);
      }
    } catch (e) {
      console.error("Error loadData:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (santriId: number, status: string) => {
    setAbsensiMap(prev => ({
      ...prev,
      [santriId]: { ...prev[santriId], status }
    }));
  };

  const handleMarkAllHadir = () => {
    setAbsensiMap(prev => {
      const updated = { ...prev };
      santriList.forEach(s => {
        if (s.id) {
          updated[s.id] = {
            status: "hadir",
            keterangan: prev[s.id]?.keterangan || ""
          };
        }
      });
      return updated;
    });
  };

  const absensiCounts = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;
    santriList.forEach(s => {
      if (!s.id) return;
      const status = absensiMap[s.id]?.status || "hadir";
      if (status === "hadir") hadir++;
      else if (status === "izin") izin++;
      else if (status === "sakit") sakit++;
      else if (status === "alpa") alpa++;
    });
    return { hadir, izin, sakit, alpa };
  }, [santriList, absensiMap]);

  // Salin Target Kurikulum ke Form Realisasi Mengajar
  const handleApplyTargetToRealisasi = () => {
    if (!targetInfo) {
      onTriggerNotification("Belum ada target pengajian untuk kelas dan tanggal ini", "warning");
      return;
    }

    if (selectedKelompok === "alquran" && targetInfo.target_quran_detail) {
      const tq = targetInfo.target_quran_detail;
      setQuranSuratAwal(tq.surah_awal_id);
      setQuranAyatAwal(tq.ayat_awal);
      setQuranSuratAkhir(tq.surah_akhir_id);
      setQuranAyatAkhir(tq.ayat_akhir);
      setIsQuranBersambung(tq.surah_awal_id !== tq.surah_akhir_id);
      onTriggerNotification("Target Al-Qur'an berhasil diterapkan ke form realisasi", "success");
    } else if (selectedKelompok === "himpunan" && targetInfo.target_hadits_detail) {
      const th = targetInfo.target_hadits_detail;
      setHaditsKitabAwal(th.kitab_awal_id);
      setHaditsHalAwal(th.hal_awal);
      setHaditsBarisAwal(th.baris_awal || 1);
      setHaditsKitabAkhir(th.kitab_akhir_id || th.kitab_awal_id);
      setHaditsHalAkhir(th.hal_akhir);
      setHaditsBarisAkhir(th.baris_akhir || 18);
      setIsHaditsBersambung(th.kitab_awal_id !== th.kitab_akhir_id);
      onTriggerNotification("Target Hadits berhasil diterapkan ke form realisasi", "success");
    } else if (targetInfo.target_halaman_mulai && targetInfo.target_halaman_selesai) {
      if (selectedKelompok === "himpunan") {
        setHaditsHalAwal(targetInfo.target_halaman_mulai);
        setHaditsHalAkhir(targetInfo.target_halaman_selesai);
      }
      onTriggerNotification("Target halaman berhasil diterapkan ke form realisasi", "success");
    }
  };

  // Simpan Jurnal & Capaian (Sesuai Skema Aktif)
  const handleSave = async () => {
    if (!selectedClass || !selectedDate || !selectedKelompok || !selectedSesi) {
      onTriggerNotification("Pilih sesi, kelas, kelompok materi, dan tanggal terlebih dahulu", "warning");
      return;
    }
    if (!selectedUstaz) {
      onTriggerNotification("Guru pengajar harus dipilih", "warning");
      return;
    }

    // Validasi & Siapkan data spesifik per kelompok
    let realisasiMulaiHal = 1;
    let realisasiSelesaiHal = 1;
    let materiIdToSave = 1;
    let ringkasanInfo = "";

    if (selectedKelompok === "alquran") {
      const sAwal = QURAN_SURAHS.find(s => s.nomor === quranSuratAwal);
      const sAkhir = QURAN_SURAHS.find(s => s.nomor === quranSuratAkhir);

      if (!sAwal || !sAkhir) {
        onTriggerNotification("Pilihan surat tidak valid", "warning");
        return;
      }
      const ayatAwalNum = Number(quranAyatAwal) || 1;
      const ayatAkhirNum = Number(quranAyatAkhir) || 1;
      if (ayatAwalNum <= 0 || ayatAwalNum > sAwal.jumlah_ayat) {
        onTriggerNotification(`Ayat awal harus antara 1 s/d ${sAwal.jumlah_ayat} untuk ${sAwal.nama}`, "warning");
        return;
      }
      if (ayatAkhirNum <= 0 || ayatAkhirNum > sAkhir.jumlah_ayat) {
        onTriggerNotification(`Ayat akhir harus antara 1 s/d ${sAkhir.jumlah_ayat} untuk ${sAkhir.nama}`, "warning");
        return;
      }
      if (quranSuratAwal === quranSuratAkhir && ayatAwalNum > ayatAkhirNum) {
        onTriggerNotification("Ayat akhir tidak boleh lebih kecil dari ayat awal", "warning");
        return;
      }

      realisasiMulaiHal = quranCalculated.halamanMulai;
      realisasiSelesaiHal = quranCalculated.halamanSelesai;
      ringkasanInfo = `QS. ${sAwal.nama}:${quranAyatAwal} s/d QS. ${sAkhir.nama}:${quranAyatAkhir} (${quranCalculated.ringkasanTeks})`;

      // Cari materi_id Al-Qur'an (Cepatan atau Lambatan)
      const quranMateri = materiList.find(m => 
        m.kelompok === "alquran" && 
        (realisasiMulaiHal <= 341 ? m.nama_materi.toLowerCase().includes("cepatan") : m.nama_materi.toLowerCase().includes("lambatan"))
      ) || materiList.find(m => m.kelompok === "alquran");

      if (quranMateri) materiIdToSave = quranMateri.id;
    } else {
      // Kelompok Himpunan
      if (!haditsKitabAwal) {
        onTriggerNotification("Pilih Kitab Awal terlebih dahulu", "warning");
        return;
      }
      const kAwal = haditsKitabList.find(k => k.id === haditsKitabAwal);
      const kAkhir = haditsKitabList.find(k => k.id === (haditsKitabAkhir || haditsKitabAwal)) || kAwal;

      const halAwalNum = Number(haditsHalAwal) || 1;
      const halAkhirNum = Number(haditsHalAkhir) || 1;

      if (halAwalNum <= 0 || (kAwal && halAwalNum > kAwal.total_hal)) {
        onTriggerNotification(`Halaman awal tidak boleh melebihi total halaman kitab (${kAwal?.total_hal || 40} Hal)`, "warning");
        return;
      }
      if (halAkhirNum <= 0 || (kAkhir && halAkhirNum > kAkhir.total_hal)) {
        onTriggerNotification(`Halaman akhir tidak boleh melebihi total halaman kitab (${kAkhir?.total_hal || 40} Hal)`, "warning");
        return;
      }

      realisasiMulaiHal = halAwalNum;
      realisasiSelesaiHal = halAkhirNum;
      materiIdToSave = Number(haditsKitabAwal);
      ringkasanInfo = haditsCalculated.ringkasanTeks;
    }

    setIsSaving(true);
    try {
      let jurnalId: number;

      // 1. Simpan ke jurnal_pengajian
      const payloadJurnal = {
        target_id: targetInfo ? targetInfo.id : null,
        materi_id: materiIdToSave,
        kelas_pengajian: selectedClass,
        sesi_id: selectedSesi || null,
        ustaz_id: selectedUstaz || null,
        tanggal: selectedDate,
        realisasi_halaman_mulai: realisasiMulaiHal,
        realisasi_halaman_selesai: realisasiSelesaiHal,
        catatan_kendala: catatan ? `${ringkasanInfo} | Catatan: ${catatan}` : ringkasanInfo,
      };

      if (existingJurnal) {
        const { data, error } = await supabase
          .from("jurnal_pengajian")
          .update(payloadJurnal)
          .eq("id", existingJurnal.id)
          .select()
          .single();
        if (error) throw error;
        jurnalId = data.id;
      } else {
        const { data, error } = await supabase
          .from("jurnal_pengajian")
          .insert([payloadJurnal])
          .select()
          .single();
        if (error) throw error;
        jurnalId = data.id;
        setExistingJurnal(data);
      }

      // 2. Simpan Payload JSON sesuai skema tabel capaian aktif
      if (selectedKelompok === "alquran") {
        const sAwal = QURAN_SURAHS.find(s => s.nomor === quranSuratAwal);
        const sAkhir = QURAN_SURAHS.find(s => s.nomor === quranSuratAkhir);

        const payloadCapaianQuran = {
          jurnal_id: jurnalId,
          kelas_pengajian: selectedClass,
          sesi_id: selectedSesi ? Number(selectedSesi) : null,
          ustaz_id: selectedUstaz,
          tanggal: selectedDate,
          surat_awal_no: quranSuratAwal,
          surat_awal_nama: sAwal?.nama || "Al-Fatihah",
          ayat_awal: Number(quranAyatAwal) || 1,
          is_bersambung: isQuranBersambung,
          surat_akhir_no: quranSuratAkhir,
          surat_akhir_nama: sAkhir?.nama || sAwal?.nama || "Al-Fatihah",
          ayat_akhir: Number(quranAyatAkhir) || 1,
          halaman_mulai: realisasiMulaiHal,
          halaman_selesai: realisasiSelesaiHal,
          kategori_quran: quranCalculated.kategoriLabel,
          ringkasan_teks: ringkasanInfo,
          catatan: catatan || null
        };

        try {
          // Hapus entri lama jika update, lalu insert
          await supabase.from("capaian_quran").delete().eq("jurnal_id", jurnalId);
          await supabase.from("capaian_quran").insert([payloadCapaianQuran]);
        } catch (errCq) {
          console.warn("Notice: tabel capaian_quran belum dibuat di Supabase, menyimpan ke cache lokal", errCq);
          const localCache = JSON.parse(localStorage.getItem("capaian_quran_cache") || "[]");
          localCache.push({ ...payloadCapaianQuran, saved_at: new Date().toISOString() });
          localStorage.setItem("capaian_quran_cache", JSON.stringify(localCache));
        }
      } else {
        // Kelompok Himpunan / Hadits
        const kAwal = haditsKitabList.find(k => k.id === haditsKitabAwal);
        const kAkhir = haditsKitabList.find(k => k.id === (haditsKitabAkhir || haditsKitabAwal)) || kAwal;

        const payloadCapaianHadits = {
          jurnal_id: jurnalId,
          kelas_pengajian: selectedClass,
          sesi_id: selectedSesi ? Number(selectedSesi) : null,
          ustaz_id: selectedUstaz,
          tanggal: selectedDate,
          kitab_awal_id: haditsKitabAwal,
          kitab_awal_nama: kAwal?.nama_kitab || "Kitab",
          hal_awal: Number(haditsHalAwal) || 1,
          baris_awal: Number(haditsBarisAwal) || 1,
          is_bersambung: isHaditsBersambung,
          kitab_akhir_id: haditsKitabAkhir || haditsKitabAwal,
          kitab_akhir_nama: kAkhir?.nama_kitab || kAwal?.nama_kitab || "Kitab",
          hal_akhir: Number(haditsHalAkhir) || 1,
          baris_akhir: Number(haditsBarisAkhir) || 1,
          ringkasan_teks: ringkasanInfo,
          catatan: catatan || null
        };

        try {
          await supabase.from("capaian_hadits").delete().eq("jurnal_id", jurnalId);
          await supabase.from("capaian_hadits").insert([payloadCapaianHadits]);
        } catch (errCh) {
          console.warn("Notice: tabel capaian_hadits belum dibuat di Supabase, menyimpan ke cache lokal", errCh);
          const localCache = JSON.parse(localStorage.getItem("capaian_hadits_cache") || "[]");
          localCache.push({ ...payloadCapaianHadits, saved_at: new Date().toISOString() });
          localStorage.setItem("capaian_hadits_cache", JSON.stringify(localCache));
        }
      }

      // 3. Simpan Absensi Santri
      await supabase.from("absensi_pengajian").delete().eq("jurnal_id", jurnalId);
      const absensiPayloads = Object.keys(absensiMap).map(sId => ({
        jurnal_id: jurnalId,
        santri_id: sId,
        sesi_id: selectedSesi || null,
        status: absensiMap[sId].status,
        keterangan: absensiMap[sId].keterangan
      }));

      if (absensiPayloads.length > 0) {
        const { error: absError } = await supabase.from("absensi_pengajian").insert(absensiPayloads);
        if (absError) throw absError;
      }

      onTriggerNotification("Jurnal pengajian dan absensi berhasil disimpan", "success");
      MySwal.fire({
        icon: "success",
        title: "Berhasil Disimpan!",
        text: `Realisasi ${selectedKelompok === 'alquran' ? "Al-Qur'an" : "Al-Hadist"} dan data presensi santri berhasil disimpan ke database.`,
        timer: 2200,
        showConfirmButton: false
      });

      loadData();
    } catch (e: any) {
      console.error(e);
      onTriggerNotification(`Gagal menyimpan: ${e.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const currentSurahAwalObj = QURAN_SURAHS.find(s => s.nomor === quranSuratAwal);
  const currentSurahAkhirObj = QURAN_SURAHS.find(s => s.nomor === quranSuratAkhir);

  const sqlCapaianScript = `-- Skrip SQL: Tabel capaian_quran & capaian_hadits
-- Jalankan di SQL Editor Supabase jika ingin menyimpan detail ayat/baris ke database

CREATE TABLE IF NOT EXISTS public.capaian_quran (
    id BIGSERIAL PRIMARY KEY,
    jurnal_id BIGINT,
    kelas_pengajian VARCHAR(100) NOT NULL,
    sesi_id BIGINT,
    ustaz_id VARCHAR(100),
    tanggal DATE NOT NULL,
    surat_awal_no INTEGER NOT NULL,
    surat_awal_nama VARCHAR(150) NOT NULL,
    ayat_awal INTEGER NOT NULL,
    is_bersambung BOOLEAN DEFAULT FALSE,
    surat_akhir_no INTEGER NOT NULL,
    surat_akhir_nama VARCHAR(150) NOT NULL,
    ayat_akhir INTEGER NOT NULL,
    halaman_mulai INTEGER NOT NULL,
    halaman_selesai INTEGER NOT NULL,
    kategori_quran VARCHAR(100),
    ringkasan_teks TEXT,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.capaian_quran ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Izinkan semua akses capaian_quran" ON public.capaian_quran;
CREATE POLICY "Izinkan semua akses capaian_quran" ON public.capaian_quran FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.capaian_hadits (
    id BIGSERIAL PRIMARY KEY,
    jurnal_id BIGINT,
    kelas_pengajian VARCHAR(100) NOT NULL,
    sesi_id BIGINT,
    ustaz_id VARCHAR(100),
    tanggal DATE NOT NULL,
    kitab_awal_id BIGINT,
    kitab_awal_nama VARCHAR(255) NOT NULL,
    hal_awal INTEGER NOT NULL,
    baris_awal INTEGER NOT NULL,
    is_bersambung BOOLEAN DEFAULT FALSE,
    kitab_akhir_id BIGINT,
    kitab_akhir_nama VARCHAR(255) NOT NULL,
    hal_akhir INTEGER NOT NULL,
    baris_akhir INTEGER NOT NULL,
    ringkasan_teks TEXT,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.capaian_hadits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Izinkan semua akses capaian_hadits" ON public.capaian_hadits;
CREATE POLICY "Izinkan semua akses capaian_hadits" ON public.capaian_hadits FOR ALL USING (true) WITH CHECK (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCapaianScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <ClipboardEdit className="w-6 h-6" />
            </span>
            Jurnal Pengajian
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Form dinamis pencatatan realisasi mengajar Al-Qur'an (Surat &amp; Ayat) dan Al-Hadist (Kitab &amp; Baris)
          </p>
        </div>

        {/* Indikator Kelompok & Database */}
        <div className="flex items-center gap-2 flex-wrap">
          {hasLiveDb && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Target Terhubung</span>
            </span>
          )}

          <button
            onClick={() => setIsSqlModalOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
            title="Lihat Skrip SQL Tabel capaian_quran & capaian_hadits"
          >
            <Database className="w-4 h-4 text-blue-500" />
            <span>Skrip SQL Capaian</span>
          </button>

          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-xs ${
            selectedKelompok === "alquran" 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : selectedKelompok === "himpunan"
              ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
          }`}>
            {selectedKelompok === "alquran" ? <BookOpen className="w-4 h-4 text-emerald-600" /> : <Book className="w-4 h-4 text-indigo-600" />}
            <span>Mode: {selectedKelompok === "alquran" ? "Al-Qur'an" : selectedKelompok === "himpunan" ? "Al-Hadist / Himpunan" : "Belum Dipilih"}</span>
          </span>
        </div>
      </div>

      {dbMissing && (
        <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-2xl border border-red-200 dark:border-red-800">
          <h3 className="text-sm font-bold text-red-800 dark:text-red-300 mb-1 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Tabel Sesi Belum Dibuat di Database
          </h3>
          <p className="text-xs text-red-700 dark:text-red-400">
            Fitur Jurnal Pengajian memerlukan tabel <strong>sesi_mengaji</strong>. Silakan buka menu <strong>Manajemen Pondok &gt; Sesi Mengaji</strong> untuk menyalin skrip SQL-nya.
          </p>
        </div>
      )}

      {/* FILTER BAR ATAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            Sesi Mengaji
          </label>
          <select
            value={selectedSesi}
            onChange={(e) => setSelectedSesi(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
          >
            {sesiList.map(s => (
              <option key={s.id} value={s.id}>{s.nama_sesi}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            Kelas Pengajian
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="">-- Pilih Kelas --</option>
            {recitationClasses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            Kelompok Materi
          </label>
          <select
            value={selectedKelompok}
            onChange={(e) => setSelectedKelompok(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-semibold text-indigo-600 dark:text-indigo-400"
          >
            <option value="alquran">📖 Al-Qur'an</option>
            <option value="himpunan">📚 Al-Hadist (Himpunan)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            Tanggal
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mb-3" />
          <p className="text-xs">Memuat data jurnal &amp; presensi santri...</p>
        </div>
      )}

      {selectedClass && selectedDate && selectedKelompok && selectedSesi && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* KOLOM KIRI: TARGET & REALISASI (5 COLUMNS) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* ========================================================= */}
            {/* 4. WIDGET "TARGET HARI INI" (KARTU KIRI ATAS)              */}
            {/* ========================================================= */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 dark:from-blue-950/30 dark:to-indigo-950/20 p-4 sm:p-5 rounded-2xl border border-blue-200/80 dark:border-blue-800/50 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 text-sm">
                  <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Target Kurikulum Hari Ini</span>
                </h3>
                {targetInfo && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-bold">
                    Pertemuan {targetInfo.pertemuan_ke}
                  </span>
                )}
              </div>

              {targetInfo ? (
                <div className="space-y-2.5 text-xs text-blue-950 dark:text-blue-200">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200/50 dark:border-blue-800/40">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Materi Pokok:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {targetInfo.materi_pengajian?.nama_materi || "Materi Kurikulum"}
                    </span>
                  </div>

                  {/* Target Spesifik Al-Qur'an */}
                  {selectedKelompok === "alquran" && (
                    <>
                      {targetInfo.target_quran_detail ? (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              Target Surat &amp; Ayat Terjadwal:
                            </span>
                            <span className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-200 font-bold">
                              Hal. {targetInfo.target_halaman_mulai} s/d {targetInfo.target_halaman_selesai}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                            QS. {QURAN_SURAHS.find(s => s.nomor === targetInfo.target_quran_detail?.surah_awal_id)?.nama || `Surat ${targetInfo.target_quran_detail.surah_awal_id}`} Ayat {targetInfo.target_quran_detail.ayat_awal}
                            {" "}s/d{" "}
                            QS. {QURAN_SURAHS.find(s => s.nomor === targetInfo.target_quran_detail?.surah_akhir_id)?.nama || `Surat ${targetInfo.target_quran_detail.surah_akhir_id}`} Ayat {targetInfo.target_quran_detail.ayat_akhir}
                          </div>
                          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                            {targetInfo.target_halaman_mulai <= 341 ? "Kategori Cepatan (Hal 1-341)" : "Kategori Lambatan (Hal 342-604)"}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between pb-2 border-b border-blue-200/50 dark:border-blue-800/40">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Target Halaman:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 px-2 py-0.5 rounded font-mono">
                              Hal. {targetInfo.target_halaman_mulai} s/d {targetInfo.target_halaman_selesai}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-blue-100 dark:border-blue-900/30 text-[11px] leading-relaxed">
                            <div className="font-semibold text-blue-800 dark:text-blue-300 mb-0.5">Estimasi Surat &amp; Ayat:</div>
                            <div className="text-slate-600 dark:text-slate-300">
                              {targetInfo.target_halaman_mulai <= 341 
                                ? "Kategori Cepatan (Surat Al-Fatihah s/d Al-Kahf / Maryam)"
                                : "Kategori Lambatan (Surat Al-Hajj s/d An-Nas)"}
                            </div>
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={handleApplyTargetToRealisasi}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                        title="Salin Surat dan Ayat target ini ke form Realisasi Mengajar"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Terapkan Target ke Realisasi</span>
                      </button>
                    </>
                  )}

                  {/* Target Spesifik Al-Hadist / Himpunan */}
                  {selectedKelompok === "himpunan" && (
                    <>
                      {targetInfo.target_hadits_detail ? (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-800/50 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">
                            <span className="flex items-center gap-1">
                              <Book className="w-3.5 h-3.5" />
                              Target Kitab &amp; Baris Terjadwal:
                            </span>
                            <span className="font-mono bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded text-indigo-800 dark:text-indigo-200 font-bold">
                              Hal. {targetInfo.target_hadits_detail.hal_awal} s/d {targetInfo.target_hadits_detail.hal_akhir}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                            {haditsKitabList.find(k => k.id === targetInfo.target_hadits_detail?.kitab_awal_id)?.nama_kitab || targetInfo.materi_pengajian?.nama_materi || "Kitab"} Hal. {targetInfo.target_hadits_detail.hal_awal} B.{targetInfo.target_hadits_detail.baris_awal}
                            {" "}s/d{" "}
                            {haditsKitabList.find(k => k.id === targetInfo.target_hadits_detail?.kitab_akhir_id)?.nama_kitab || targetInfo.materi_pengajian?.nama_materi || "Kitab"} Hal. {targetInfo.target_hadits_detail.hal_akhir} B.{targetInfo.target_hadits_detail.baris_akhir}
                          </div>
                          <div className="text-[10px] text-indigo-700/80 dark:text-indigo-400">
                            Standar 18 Baris / Halaman
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between pb-2 border-b border-blue-200/50 dark:border-blue-800/40">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Target Kitab:</span>
                            <span className="font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/60 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                              {targetInfo.materi_pengajian?.nama_materi || "Kitab Himpunan"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pb-2 border-b border-blue-200/50 dark:border-blue-800/40">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Rentang Halaman:</span>
                            <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                              Hal. {targetInfo.target_halaman_mulai} s/d {targetInfo.target_halaman_selesai}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-blue-100 dark:border-blue-900/30 text-[11px] leading-relaxed flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Target Baris:</span>
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              Standar 18 Baris / Halaman
                            </span>
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={handleApplyTargetToRealisasi}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                        title="Salin Kitab dan Baris target ini ke form Realisasi Mengajar"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Terapkan Target ke Realisasi</span>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl text-xs text-slate-500 dark:text-slate-400 italic">
                  Belum ada target pengajian kurikulum yang di-set untuk tanggal dan kelas ini pada kelompok {selectedKelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"}.
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* KARTU "REALISASI MENGAJAR" (DINAMIS AL-QUR'AN VS HADITS)   */}
            {/* ========================================================= */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  {selectedKelompok === "alquran" ? (
                    <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Book className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  )}
                  <span>Realisasi Mengajar</span>
                </h3>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {selectedKelompok === "alquran" ? "Al-Qur'an" : "Al-Hadist"}
                </span>
              </div>

              {/* 1. GURU PENGAJAR */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                  Guru Pengajar <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUstaz}
                  onChange={(e) => setSelectedUstaz(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Pilih Ustaz / Guru --</option>
                  {ustazList.map(u => (
                    <option key={u.id} value={u.id}>{u.nama}</option>
                  ))}
                </select>
              </div>

              {/* ========================================================= */}
              {/* 2. FORM JIKA KELOMPOK MATERI = AL-QUR'AN                  */}
              {/* ========================================================= */}
              {selectedKelompok === "alquran" && (
                <div className="space-y-4 pt-1">
                  {/* Titik Awal: Surat Awal & Ayat Awal */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Titik Awal Pembelajaran
                    </div>
                    <div className="grid grid-cols-12 gap-2.5">
                      <div className="col-span-8">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Surat Awal
                        </label>
                        <select
                          value={quranSuratAwal}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setQuranSuratAwal(val);
                            if (!isQuranBersambung) setQuranSuratAkhir(val);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        >
                          {QURAN_SURAHS.map((s) => (
                            <option key={s.nomor} value={s.nomor}>
                              {s.nomor}. {s.nama} ({s.jumlah_ayat} Ayat)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
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
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Checkbox: Lanjut Bersambung ke Surat Berikutnya */}
                  <div className="px-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isQuranBersambung}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsQuranBersambung(checked);
                          if (!checked) {
                            setQuranSuratAkhir(quranSuratAwal);
                          }
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Lanjut Bersambung ke Surat Berikutnya
                      </span>
                    </label>
                  </div>

                  {/* Titik Akhir: Surat Akhir & Ayat Akhir */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Titik Akhir Pembelajaran
                    </div>
                    <div className="grid grid-cols-12 gap-2.5">
                      <div className="col-span-8">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Surat Akhir {isQuranBersambung ? "" : "(Terkunci Sama)"}
                        </label>
                        <select
                          disabled={!isQuranBersambung}
                          value={quranSuratAkhir}
                          onChange={(e) => setQuranSuratAkhir(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 disabled:bg-slate-100 dark:disabled:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        >
                          {QURAN_SURAHS.filter(s => !isQuranBersambung || s.nomor >= quranSuratAwal).map((s) => (
                            <option key={s.nomor} value={s.nomor}>
                              {s.nomor}. {s.nama} ({s.jumlah_ayat} Ayat)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
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
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. WIDGET RINGKASAN OTOMATIS AL-QUR'AN (READ-ONLY) */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Kalkulasi Otomatis Mushaf
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        quranCalculated.halamanMulai <= 341
                          ? "bg-emerald-600 text-white"
                          : "bg-indigo-600 text-white"
                      }`}>
                        {quranCalculated.kategoriLabel}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span>Capaian:</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-mono">
                        Halaman {quranCalculated.halamanMulai} s/d {quranCalculated.halamanSelesai}
                      </span>
                      <span className="text-xs text-slate-500 font-normal">
                        ({quranCalculated.totalHalaman} Halaman)
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      QS. {currentSurahAwalObj?.nama}:{quranAyatAwal} s/d QS. {currentSurahAkhirObj?.nama}:{quranAyatAkhir}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* 3. FORM JIKA KELOMPOK MATERI = AL-HADIST (HIMPUNAN)       */}
              {/* ========================================================= */}
              {selectedKelompok === "himpunan" && (
                <div className="space-y-4 pt-1">
                  {/* Titik Awal: Kitab Awal, Hal Awal, Baris Awal */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Titik Awal (Kitab &rarr; Halaman &rarr; Baris)
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Kitab Awal
                      </label>
                      <select
                        value={haditsKitabAwal}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setHaditsKitabAwal(val);
                          if (!isHaditsBersambung) setHaditsKitabAkhir(val);
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        {haditsKitabList.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.urutan}. {k.nama_kitab} ({k.total_hal} Hal)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
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
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
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
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Checkbox: Lanjut Bersambung ke Kitab Berikutnya */}
                  <div className="px-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isHaditsBersambung}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsHaditsBersambung(checked);
                          if (!checked) {
                            setHaditsKitabAkhir(haditsKitabAwal);
                          }
                        }}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Lanjut Bersambung ke Kitab Berikutnya
                      </span>
                    </label>
                  </div>

                  {/* Titik Akhir: Kitab Akhir, Hal Akhir, Baris Akhir */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Titik Akhir (Kitab &rarr; Halaman &rarr; Baris)
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Kitab Akhir {isHaditsBersambung ? "" : "(Terkunci Sama)"}
                      </label>
                      <select
                        disabled={!isHaditsBersambung}
                        value={haditsKitabAkhir}
                        onChange={(e) => setHaditsKitabAkhir(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 disabled:bg-slate-100 dark:disabled:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                      >
                        {haditsKitabList.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.urutan}. {k.nama_kitab} ({k.total_hal} Hal)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
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
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
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
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. WIDGET RINGKASAN OTOMATIS HADITS (READ-ONLY) */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 space-y-1.5">
                    <div className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Ringkasan Materi Himpunan
                    </div>
                    <div className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 leading-relaxed font-mono">
                      {haditsCalculated.ringkasanTeks}
                    </div>
                  </div>
                </div>
              )}

              {/* 6. CATATAN / KENDALA */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan / Kendala Mengajar (Opsional)
                </label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                  placeholder="Misal: Santri menyimak aktif, hafalan lancar..."
                />
              </div>

              {/* STATUS CAPAIAN BADGE */}
              {existingJurnal && existingJurnal.status_capaian && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold border flex items-center justify-between ${
                  existingJurnal.status_capaian === 'tercapai' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' :
                  existingJurnal.status_capaian === 'terlampaui' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' :
                  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                }`}>
                  <span>Status Capaian:</span>
                  <span className="uppercase tracking-wider">{existingJurnal.status_capaian.replace('_', ' ')}</span>
                </div>
              )}

              {/* TOMBOL SIMPAN JURNAL */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                {isSaving ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{existingJurnal ? "Perbarui Jurnal Pengajian" : "Simpan Jurnal Pengajian"}</span>
              </button>
            </div>
          </div>

          {/* KOLOM KANAN: PRESENSI SANTRI (7 COLUMNS) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col max-h-[760px]">
            {/* Header Presensi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Presensi Kehadiran Santri</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kelas: <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedClass}</span> &bull; Total: <span className="font-semibold text-slate-700 dark:text-slate-200">{santriList.length} Santri</span>
                </p>
              </div>

              {/* Search Santri */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari santri..."
                  value={searchSantri}
                  onChange={(e) => setSearchSantri(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick Action & Statistik Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-1 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                  Hadir: {absensiCounts.hadir}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
                  Izin: {absensiCounts.izin}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                  Sakit: {absensiCounts.sakit}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/40">
                  Alpa: {absensiCounts.alpa}
                </span>
              </div>

              {santriList.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllHadir}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1"
                  title="Tandai semua santri hadir"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Semua Hadir</span>
                </button>
              )}
            </div>

            {/* Scrollable Table Container */}
            {santriList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Tidak ada santri yang terdaftar di kelas pengajian {selectedClass}.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl min-h-[300px] max-h-[580px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-xs">
                    <tr className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 w-12 text-center bg-slate-50 dark:bg-slate-800">No</th>
                      <th className="py-2.5 px-3 bg-slate-50 dark:bg-slate-800">Nama Santri</th>
                      <th className="py-2.5 px-3 text-center bg-slate-50 dark:bg-slate-800">Status Kehadiran</th>
                      <th className="py-2.5 px-3 bg-slate-50 dark:bg-slate-800">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {santriList
                      .filter(s => s.nama_lengkap.toLowerCase().includes(searchSantri.toLowerCase()))
                      .map((santri, idx) => {
                        const currentAbs = santri.id ? absensiMap[santri.id] : null;
                        const statusVal = currentAbs?.status || 'hadir';

                        return (
                          <tr key={santri.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {santri.nama_lengkap}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {santri.kamar || "Kamar -"}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {[
                                  { key: "hadir", label: "H", color: "text-emerald-700 bg-emerald-100 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" },
                                  { key: "izin", label: "I", color: "text-blue-700 bg-blue-100 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800" },
                                  { key: "sakit", label: "S", color: "text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800" },
                                  { key: "alpa", label: "A", color: "text-red-700 bg-red-100 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800" },
                                ].map((opt) => (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => santri.id && handleStatusChange(santri.id, opt.key)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border ${
                                      statusVal === opt.key
                                        ? `${opt.color} shadow-xs scale-105`
                                        : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                                    }`}
                                    title={opt.key.toUpperCase()}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                placeholder="Keterangan..."
                                value={currentAbs?.keterangan || ""}
                                onChange={(e) => {
                                  if (!santri.id) return;
                                  const text = e.target.value;
                                  setAbsensiMap(prev => ({
                                    ...prev,
                                    [santri.id!]: { ...prev[santri.id!], keterangan: text }
                                  }));
                                }}
                                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer Summary Info */}
            <div className="pt-2 px-1 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
              <span>Scroll untuk melihat seluruh santri ({santriList.length} terdaftar)</span>
              <span>H: Hadir | I: Izin | S: Sakit | A: Alpa</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL SKRIP SQL DATABASE (CAPAIAN QURAN & HADITS)          */}
      {/* ========================================================= */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Database className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Skrip SQL: Tabel capaian_quran &amp; capaian_hadits
                  </h3>
                  <p className="text-xs text-slate-500">
                    File migrasi Supabase: <code className="text-blue-600 dark:text-blue-400 font-mono">/src/sql/09_capaian_quran_hadits.sql</code>
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

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Tabel <code className="font-mono font-bold bg-white dark:bg-slate-900 px-1 py-0.5 rounded">target_quran</code> dan <code className="font-mono font-bold bg-white dark:bg-slate-900 px-1 py-0.5 rounded">target_hadits</code> sudah terhubung.
                  Jika ingin menyimpan rekapitulasi capaian realisasi detail per ayat &amp; baris ke database Supabase, jalankan skrip berikut di <strong>SQL Editor</strong> Supabase:
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Skrip SQL Lengkap:
                  </span>
                  <button
                    onClick={handleCopySql}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? "Tersalin!" : "Salin Skrip SQL"}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-72 border border-slate-800 leading-relaxed select-all">
                  {sqlCapaianScript}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
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
