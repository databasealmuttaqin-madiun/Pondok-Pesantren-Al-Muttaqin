export const DAYS_OF_WEEK = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export interface LessonPeriod {
  id: string;
  jam_ke: number;
  hari: string;
  nama: string;
  kode: string;
  mulai: string;
  selesai: string;
}

export interface ParsedPeriod {
  id: string;
  jam_ke: number;
  hari: string;
  nama: string;
  kode: string;
  mulai: string;
  selesai: string;
}

export function parsePeriod(p: any): ParsedPeriod {
  if (!p) {
    return {
      id: "",
      jam_ke: 0,
      hari: "Senin",
      nama: "",
      kode: "",
      mulai: "07:00",
      selesai: "07:45"
    };
  }

  // If the new native table columns are present, return them directly!
  if (p.hari && p.nama && p.kode) {
    return {
      id: p.id || "",
      jam_ke: p.jam_ke || 0,
      hari: p.hari,
      nama: p.nama,
      kode: p.kode,
      mulai: p.mulai || "07:00",
      selesai: p.selesai || "07:45"
    };
  }

  // Fallback if data is inside a JSON string
  if (p.mulai && p.mulai.startsWith("{")) {
    try {
      const parsed = JSON.parse(p.mulai);
      return {
        id: p.id || "",
        jam_ke: p.jam_ke || 0,
        hari: parsed.hari || "Senin",
        nama: parsed.nama || `Jam Pelajaran Ke-${p.jam_ke}`,
        kode: parsed.kode || `JP-${String(p.jam_ke).padStart(2, '0')}`,
        mulai: parsed.mulai || "07:00",
        selesai: parsed.selesai || p.selesai || "07:45"
      };
    } catch (e) {
      console.error("Error parsing serialized period JSON:", e);
    }
  }

  // General legacy fallback
  return {
    id: p.id || "",
    jam_ke: p.jam_ke || 0,
    hari: p.hari || "Senin",
    nama: p.nama || `Jam Pelajaran Ke-${p.jam_ke}`,
    kode: p.kode || `JP-${String(p.jam_ke).padStart(2, '0')}`,
    mulai: p.mulai || "07:00",
    selesai: p.selesai || "07:45"
  };
}

export function getPeriodDisplayTime(p: any, day?: string): string {
  if (!p) return "--:--";
  const parsed = parsePeriod(p);
  return `${parsed.mulai} - ${parsed.selesai}`;
}

export function formatPeriodSchedule(p: any) {
  const parsed = parsePeriod(p);
  return [
    {
      label: parsed.hari,
      mulai: parsed.mulai,
      selesai: parsed.selesai
    }
  ];
}
