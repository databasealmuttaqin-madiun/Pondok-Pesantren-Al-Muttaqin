import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `    return list.map((s) => {
      const formatted = formatSantriData(s);
      const nameKey = formatted.nama_lengkap.trim().toLowerCase();
      
      // status_siswa overrides has highest priority
      const cloudStatus = cloudStatusMap ? cloudStatusMap[nameKey] : null;
      
      // Local storage overrides (keyed by name, id, or NIK)
      const localStatus = savedStatusMap[formatted.nama_lengkap] || savedStatusMap[s.id || s.nik];

      // Plottings
      const cloudPlot = cloudPlottingMap ? cloudPlottingMap[nameKey] : null;
      const localPlot = savedMetadataMap[s.nik] || {};

      return {
        ...formatted,
        status: cloudStatus || localStatus || formatted.status || "Aktif",
        kamar: cloudPlot?.kamar || localPlot.kamar || formatted.kamar || "",
        kelas_pengajian: cloudPlot?.kelas_pengajian || localPlot.kelas_pengajian || formatted.kelas_pengajian || "",
        kelas_sekolah: cloudPlot?.kelas_sekolah || localPlot.kelas_sekolah || formatted.kelas_sekolah || "",
      };
    });`;

const replacement = `    return list.map((s) => {
      const formatted = formatSantriData(s);
      const nameKey = formatted.nama_lengkap.trim().toLowerCase();
      
      // status_siswa and active izin overrides has highest priority
      const cloudStatus = cloudStatusMap ? cloudStatusMap[nameKey] : null;
      
      // Local storage overrides (keyed by name, id, or NIK)
      const localStatus = savedStatusMap[formatted.nama_lengkap] || savedStatusMap[s.id || s.nik];

      // Plottings
      const cloudPlot = cloudPlottingMap ? cloudPlottingMap[nameKey] : null;
      const localPlot = savedMetadataMap[s.nik] || {};

      return {
        ...formatted,
        status: cloudStatus || localStatus || formatted.status || "Aktif",
        kamar: cloudPlot?.kamar || localPlot.kamar || formatted.kamar || "",
        kelas_pengajian: cloudPlot?.kelas_pengajian || localPlot.kelas_pengajian || formatted.kelas_pengajian || "",
        kelas_sekolah: cloudPlot?.kelas_sekolah || localPlot.kelas_sekolah || formatted.kelas_sekolah || "",
      };
    });`;

if (content.includes(target)) {
   console.log("Found the target to replace");
} else {
   console.log("Could not find the exact target to replace");
}
