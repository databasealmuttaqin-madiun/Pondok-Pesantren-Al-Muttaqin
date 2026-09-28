// Dataset Standar 114 Surat Al-Qur'an (Mushaf Standar Madinah / Depag RI 604 Halaman)

export interface QuranSurah {
  nomor: number;
  nama: string;
  arti?: string;
  jumlah_ayat: number;
  halaman_mulai: number;
  halaman_selesai: number;
}

export const QURAN_SURAHS: QuranSurah[] = [
  { nomor: 1, nama: "Al-Fatihah", jumlah_ayat: 7, halaman_mulai: 1, halaman_selesai: 1 },
  { nomor: 2, nama: "Al-Baqarah", jumlah_ayat: 286, halaman_mulai: 2, halaman_selesai: 49 },
  { nomor: 3, nama: "Ali 'Imran", jumlah_ayat: 200, halaman_mulai: 50, halaman_selesai: 76 },
  { nomor: 4, nama: "An-Nisa'", jumlah_ayat: 176, halaman_mulai: 77, halaman_selesai: 106 },
  { nomor: 5, nama: "Al-Ma'idah", jumlah_ayat: 120, halaman_mulai: 106, halaman_selesai: 127 },
  { nomor: 6, nama: "Al-An'am", jumlah_ayat: 165, halaman_mulai: 128, halaman_selesai: 150 },
  { nomor: 7, nama: "Al-A'raf", jumlah_ayat: 206, halaman_mulai: 151, halaman_selesai: 176 },
  { nomor: 8, nama: "Al-Anfal", jumlah_ayat: 75, halaman_mulai: 177, halaman_selesai: 186 },
  { nomor: 9, nama: "At-Taubah", jumlah_ayat: 129, halaman_mulai: 187, halaman_selesai: 207 },
  { nomor: 10, nama: "Yunus", jumlah_ayat: 109, halaman_mulai: 208, halaman_selesai: 221 },
  { nomor: 11, nama: "Hud", jumlah_ayat: 123, halaman_mulai: 221, halaman_selesai: 235 },
  { nomor: 12, nama: "Yusuf", jumlah_ayat: 111, halaman_mulai: 235, halaman_selesai: 248 },
  { nomor: 13, nama: "Ar-Ra'd", jumlah_ayat: 43, halaman_mulai: 249, halaman_selesai: 255 },
  { nomor: 14, nama: "Ibrahim", jumlah_ayat: 52, halaman_mulai: 255, halaman_selesai: 261 },
  { nomor: 15, nama: "Al-Hijr", jumlah_ayat: 99, halaman_mulai: 262, halaman_selesai: 267 },
  { nomor: 16, nama: "An-Nahl", jumlah_ayat: 128, halaman_mulai: 267, halaman_selesai: 281 },
  { nomor: 17, nama: "Al-Isra'", jumlah_ayat: 111, halaman_mulai: 282, halaman_selesai: 293 },
  { nomor: 18, nama: "Al-Kahf", jumlah_ayat: 110, halaman_mulai: 293, halaman_selesai: 304 },
  { nomor: 19, nama: "Maryam", jumlah_ayat: 98, halaman_mulai: 305, halaman_selesai: 312 },
  { nomor: 20, nama: "Ta Ha", jumlah_ayat: 135, halaman_mulai: 312, halaman_selesai: 321 },
  { nomor: 21, nama: "Al-Anbiya'", jumlah_ayat: 112, halaman_mulai: 322, halaman_selesai: 341 },
  { nomor: 22, nama: "Al-Hajj", jumlah_ayat: 78, halaman_mulai: 342, halaman_selesai: 351 },
  { nomor: 23, nama: "Al-Mu'minun", jumlah_ayat: 118, halaman_mulai: 352, halaman_selesai: 359 },
  { nomor: 24, nama: "An-Nur", jumlah_ayat: 64, halaman_mulai: 350, halaman_selesai: 359 },
  { nomor: 25, nama: "Al-Furqan", jumlah_ayat: 77, halaman_mulai: 359, halaman_selesai: 366 },
  { nomor: 26, nama: "Asy-Syu'ara'", jumlah_ayat: 227, halaman_mulai: 367, halaman_selesai: 376 },
  { nomor: 27, nama: "An-Naml", jumlah_ayat: 93, halaman_mulai: 377, halaman_selesai: 385 },
  { nomor: 28, nama: "Al-Qasas", jumlah_ayat: 88, halaman_mulai: 385, halaman_selesai: 396 },
  { nomor: 29, nama: "Al-'Ankabut", jumlah_ayat: 69, halaman_mulai: 396, halaman_selesai: 404 },
  { nomor: 30, nama: "Ar-Rum", jumlah_ayat: 60, halaman_mulai: 404, halaman_selesai: 410 },
  { nomor: 31, nama: "Luqman", jumlah_ayat: 34, halaman_mulai: 411, halaman_selesai: 414 },
  { nomor: 32, nama: "As-Sajdah", jumlah_ayat: 30, halaman_mulai: 415, halaman_selesai: 417 },
  { nomor: 33, nama: "Al-Ahzab", jumlah_ayat: 73, halaman_mulai: 418, halaman_selesai: 427 },
  { nomor: 34, nama: "Saba'", jumlah_ayat: 54, halaman_mulai: 428, halaman_selesai: 434 },
  { nomor: 35, nama: "Fatir", jumlah_ayat: 45, halaman_mulai: 434, halaman_selesai: 440 },
  { nomor: 36, nama: "Ya Sin", jumlah_ayat: 83, halaman_mulai: 440, halaman_selesai: 445 },
  { nomor: 37, nama: "As-Saffat", jumlah_ayat: 182, halaman_mulai: 446, halaman_selesai: 452 },
  { nomor: 38, nama: "Sad", jumlah_ayat: 88, halaman_mulai: 453, halaman_selesai: 458 },
  { nomor: 39, nama: "Az-Zumar", jumlah_ayat: 75, halaman_mulai: 458, halaman_selesai: 467 },
  { nomor: 40, nama: "Ghafir", jumlah_ayat: 85, halaman_mulai: 467, halaman_selesai: 476 },
  { nomor: 41, nama: "Fussilat", jumlah_ayat: 54, halaman_mulai: 477, halaman_selesai: 482 },
  { nomor: 42, nama: "Asy-Syura", jumlah_ayat: 53, halaman_mulai: 483, halaman_selesai: 489 },
  { nomor: 43, nama: "Az-Zukhruf", jumlah_ayat: 89, halaman_mulai: 489, halaman_selesai: 495 },
  { nomor: 44, nama: "Ad-Dukhan", jumlah_ayat: 59, halaman_mulai: 496, halaman_selesai: 498 },
  { nomor: 45, nama: "Al-Jasiyah", jumlah_ayat: 37, halaman_mulai: 499, halaman_selesai: 502 },
  { nomor: 46, nama: "Al-Ahqaf", jumlah_ayat: 35, halaman_mulai: 502, halaman_selesai: 506 },
  { nomor: 47, nama: "Muhammad", jumlah_ayat: 38, halaman_mulai: 507, halaman_selesai: 510 },
  { nomor: 48, nama: "Al-Fath", jumlah_ayat: 29, halaman_mulai: 511, halaman_selesai: 515 },
  { nomor: 49, nama: "Al-Hujurat", jumlah_ayat: 18, halaman_mulai: 515, halaman_selesai: 517 },
  { nomor: 50, nama: "Qaf", jumlah_ayat: 45, halaman_mulai: 518, halaman_selesai: 520 },
  { nomor: 51, nama: "Az-Zariyat", jumlah_ayat: 60, halaman_mulai: 520, halaman_selesai: 523 },
  { nomor: 52, nama: "At-Tur", jumlah_ayat: 49, halaman_mulai: 523, halaman_selesai: 525 },
  { nomor: 53, nama: "An-Najm", jumlah_ayat: 62, halaman_mulai: 526, halaman_selesai: 528 },
  { nomor: 54, nama: "Al-Qamar", jumlah_ayat: 55, halaman_mulai: 528, halaman_selesai: 531 },
  { nomor: 55, nama: "Ar-Rahman", jumlah_ayat: 78, halaman_mulai: 531, halaman_selesai: 534 },
  { nomor: 56, nama: "Al-Waqi'ah", jumlah_ayat: 96, halaman_mulai: 534, halaman_selesai: 537 },
  { nomor: 57, nama: "Al-Hadid", jumlah_ayat: 29, halaman_mulai: 537, halaman_selesai: 541 },
  { nomor: 58, nama: "Al-Mujadilah", jumlah_ayat: 22, halaman_mulai: 542, halaman_selesai: 544 },
  { nomor: 59, nama: "Al-Hasyr", jumlah_ayat: 24, halaman_mulai: 545, halaman_selesai: 548 },
  { nomor: 60, nama: "Al-Mumtahanah", jumlah_ayat: 13, halaman_mulai: 549, halaman_selesai: 551 },
  { nomor: 61, nama: "As-Saff", jumlah_ayat: 14, halaman_mulai: 551, halaman_selesai: 552 },
  { nomor: 62, nama: "Al-Jumu'ah", jumlah_ayat: 11, halaman_mulai: 553, halaman_selesai: 554 },
  { nomor: 63, nama: "Al-Munafiqun", jumlah_ayat: 11, halaman_mulai: 554, halaman_selesai: 555 },
  { nomor: 64, nama: "At-Taghabun", jumlah_ayat: 18, halaman_mulai: 556, halaman_selesai: 557 },
  { nomor: 65, nama: "At-Talaq", jumlah_ayat: 12, halaman_mulai: 558, halaman_selesai: 559 },
  { nomor: 66, nama: "At-Tahrim", jumlah_ayat: 12, halaman_mulai: 560, halaman_selesai: 561 },
  { nomor: 67, nama: "Al-Mulk", jumlah_ayat: 30, halaman_mulai: 562, halaman_selesai: 564 },
  { nomor: 68, nama: "Al-Qalam", jumlah_ayat: 52, halaman_mulai: 564, halaman_selesai: 566 },
  { nomor: 69, nama: "Al-Haqqah", jumlah_ayat: 52, halaman_mulai: 566, halaman_selesai: 568 },
  { nomor: 70, nama: "Al-Ma'arij", jumlah_ayat: 44, halaman_mulai: 568, halaman_selesai: 570 },
  { nomor: 71, nama: "Nuh", jumlah_ayat: 28, halaman_mulai: 570, halaman_selesai: 571 },
  { nomor: 72, nama: "Al-Jinn", jumlah_ayat: 28, halaman_mulai: 572, halaman_selesai: 573 },
  { nomor: 73, nama: "Al-Muzzammil", jumlah_ayat: 20, halaman_mulai: 574, halaman_selesai: 575 },
  { nomor: 74, nama: "Al-Muddassir", jumlah_ayat: 56, halaman_mulai: 575, halaman_selesai: 577 },
  { nomor: 75, nama: "Al-Qiyamah", jumlah_ayat: 40, halaman_mulai: 577, halaman_selesai: 578 },
  { nomor: 76, nama: "Al-Insan", jumlah_ayat: 31, halaman_mulai: 578, halaman_selesai: 580 },
  { nomor: 77, nama: "Al-Mursalat", jumlah_ayat: 50, halaman_mulai: 580, halaman_selesai: 581 },
  { nomor: 78, nama: "An-Naba'", jumlah_ayat: 40, halaman_mulai: 582, halaman_selesai: 583 },
  { nomor: 79, nama: "An-Nazi'at", jumlah_ayat: 46, halaman_mulai: 583, halaman_selesai: 584 },
  { nomor: 80, nama: "'Abasa", jumlah_ayat: 42, halaman_mulai: 585, halaman_selesai: 586 },
  { nomor: 81, nama: "At-Takwir", jumlah_ayat: 29, halaman_mulai: 586, halaman_selesai: 586 },
  { nomor: 82, nama: "Al-Infitar", jumlah_ayat: 19, halaman_mulai: 587, halaman_selesai: 587 },
  { nomor: 83, nama: "Al-Mutaffifin", jumlah_ayat: 36, halaman_mulai: 587, halaman_selesai: 589 },
  { nomor: 84, nama: "Al-Insyiqaq", jumlah_ayat: 25, halaman_mulai: 589, halaman_selesai: 590 },
  { nomor: 85, nama: "Al-Buruj", jumlah_ayat: 22, halaman_mulai: 590, halaman_selesai: 590 },
  { nomor: 86, nama: "At-Tariq", jumlah_ayat: 17, halaman_mulai: 591, halaman_selesai: 591 },
  { nomor: 87, nama: "Al-A'la", jumlah_ayat: 19, halaman_mulai: 591, halaman_selesai: 592 },
  { nomor: 88, nama: "Al-Ghasyiyah", jumlah_ayat: 26, halaman_mulai: 592, halaman_selesai: 593 },
  { nomor: 89, nama: "Al-Fajr", jumlah_ayat: 30, halaman_mulai: 593, halaman_selesai: 594 },
  { nomor: 90, nama: "Al-Balad", jumlah_ayat: 20, halaman_mulai: 594, halaman_selesai: 595 },
  { nomor: 91, nama: "Asy-Syams", jumlah_ayat: 15, halaman_mulai: 595, halaman_selesai: 595 },
  { nomor: 92, nama: "Al-Lail", jumlah_ayat: 21, halaman_mulai: 595, halaman_selesai: 596 },
  { nomor: 93, nama: "Ad-Duha", jumlah_ayat: 11, halaman_mulai: 596, halaman_selesai: 596 },
  { nomor: 94, nama: "Asy-Syarh", jumlah_ayat: 8, halaman_mulai: 596, halaman_selesai: 596 },
  { nomor: 95, nama: "At-Tin", jumlah_ayat: 8, halaman_mulai: 597, halaman_selesai: 597 },
  { nomor: 96, nama: "Al-'Alaq", jumlah_ayat: 19, halaman_mulai: 597, halaman_selesai: 598 },
  { nomor: 97, nama: "Al-Qadr", jumlah_ayat: 5, halaman_mulai: 598, halaman_selesai: 598 },
  { nomor: 98, nama: "Al-Bayyinah", jumlah_ayat: 8, halaman_mulai: 598, halaman_selesai: 599 },
  { nomor: 99, nama: "Az-Zalzalah", jumlah_ayat: 8, halaman_mulai: 599, halaman_selesai: 599 },
  { nomor: 100, nama: "Al-'Adiyat", jumlah_ayat: 11, halaman_mulai: 599, halaman_selesai: 600 },
  { nomor: 101, nama: "Al-Qari'ah", jumlah_ayat: 11, halaman_mulai: 600, halaman_selesai: 600 },
  { nomor: 102, nama: "At-Takasur", jumlah_ayat: 8, halaman_mulai: 600, halaman_selesai: 600 },
  { nomor: 103, nama: "Al-'Asr", jumlah_ayat: 3, halaman_mulai: 601, halaman_selesai: 601 },
  { nomor: 104, nama: "Al-Humazah", jumlah_ayat: 9, halaman_mulai: 601, halaman_selesai: 601 },
  { nomor: 105, nama: "Al-Fil", jumlah_ayat: 5, halaman_mulai: 601, halaman_selesai: 601 },
  { nomor: 106, nama: "Quraisy", jumlah_ayat: 4, halaman_mulai: 602, halaman_selesai: 602 },
  { nomor: 107, nama: "Al-Ma'un", jumlah_ayat: 7, halaman_mulai: 602, halaman_selesai: 602 },
  { nomor: 108, nama: "Al-Kausar", jumlah_ayat: 3, halaman_mulai: 602, halaman_selesai: 602 },
  { nomor: 109, nama: "Al-Kafirun", jumlah_ayat: 6, halaman_mulai: 603, halaman_selesai: 603 },
  { nomor: 110, nama: "An-Nasr", jumlah_ayat: 3, halaman_mulai: 603, halaman_selesai: 603 },
  { nomor: 111, nama: "Al-Lahab", jumlah_ayat: 5, halaman_mulai: 603, halaman_selesai: 603 },
  { nomor: 112, nama: "Al-Ikhlas", jumlah_ayat: 4, halaman_mulai: 604, halaman_selesai: 604 },
  { nomor: 113, nama: "Al-Falaq", jumlah_ayat: 5, halaman_mulai: 604, halaman_selesai: 604 },
  { nomor: 114, nama: "An-Nas", jumlah_ayat: 6, halaman_mulai: 604, halaman_selesai: 604 },
];

/**
 * Menghitung estimasi rentang halaman mushaf berdasarkan nomor surat dan ayat
 */
export function calculateQuranPageRange(
  suratAwalNo: number,
  ayatAwal: number,
  suratAkhirNo: number,
  ayatAkhir: number
): {
  halamanMulai: number;
  halamanSelesai: number;
  totalHalaman: number;
  kategoriLabel: "Cepatan: Hal 1-341" | "Lambatan: Hal 342-604" | "Lintas Kategori (Cepatan & Lambatan)";
  targetTeks: string;
  ringkasanTeks: string;
} {
  const surahAwal = QURAN_SURAHS.find((s) => s.nomor === suratAwalNo) || QURAN_SURAHS[0];
  const surahAkhir = QURAN_SURAHS.find((s) => s.nomor === suratAkhirNo) || surahAwal;

  // Interpolasi proporsi halaman dalam surat awal
  const spanAwal = surahAwal.halaman_selesai - surahAwal.halaman_mulai;
  const safeAyatAwal = Math.max(1, Math.min(ayatAwal, surahAwal.jumlah_ayat));
  const pageOffsetAwal = spanAwal > 0 
    ? Math.floor(((safeAyatAwal - 1) / surahAwal.jumlah_ayat) * (spanAwal + 1))
    : 0;
  const halamanMulai = Math.min(surahAwal.halaman_selesai, surahAwal.halaman_mulai + pageOffsetAwal);

  // Interpolasi proporsi halaman dalam surat akhir
  const spanAkhir = surahAkhir.halaman_selesai - surahAkhir.halaman_mulai;
  const safeAyatAkhir = Math.max(1, Math.min(ayatAkhir, surahAkhir.jumlah_ayat));
  let pageOffsetAkhir = 0;
  if (spanAkhir > 0) {
    if (surahAkhir.nomor === 22 && safeAyatAkhir <= 20) {
      pageOffsetAkhir = safeAyatAkhir <= 10 ? 0 : 1;
    } else {
      pageOffsetAkhir = Math.floor(((safeAyatAkhir - 1) / surahAkhir.jumlah_ayat) * spanAkhir);
    }
  }
  let halamanSelesai = Math.min(surahAkhir.halaman_selesai, surahAkhir.halaman_mulai + pageOffsetAkhir);

  // Jika surat akhir di belakang surat awal atau halaman terhitung lebih kecil, sesuaikan
  if (halamanSelesai < halamanMulai) {
    halamanSelesai = halamanMulai;
  }

  const totalHalaman = Math.max(1, halamanSelesai - halamanMulai + 1);

  // Kategori: Cepatan (1 - 341), Lambatan (342 - 604)
  let kategoriLabel: "Cepatan: Hal 1-341" | "Lambatan: Hal 342-604" | "Lintas Kategori (Cepatan & Lambatan)";
  if (halamanMulai <= 341 && halamanSelesai <= 341) {
    kategoriLabel = "Cepatan: Hal 1-341";
  } else if (halamanMulai >= 342) {
    kategoriLabel = "Lambatan: Hal 342-604";
  } else {
    kategoriLabel = "Lintas Kategori (Cepatan & Lambatan)";
  }

  const targetTeks = `Target Halaman: ${halamanMulai} s/d ${halamanSelesai} (Total: ${totalHalaman} Hal)`;
  const ringkasanTeks = `Capaian: Halaman ${halamanMulai} s/d ${halamanSelesai} (${totalHalaman} Halaman) - ${kategoriLabel}`;

  return {
    halamanMulai,
    halamanSelesai,
    totalHalaman,
    kategoriLabel,
    targetTeks,
    ringkasanTeks,
  };
}
