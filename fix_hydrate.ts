import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const hydrateStart = `  const hydrateWithAllStatusSources = (
    list: SantriData[],
    cloudStatusMap?: Record<string, "Aktif" | "Sakit" | "Pulang">,`;

const hydrateNew = `  const hydrateWithAllStatusSources = (
    list: SantriData[],
    cloudStatusMap?: Record<string, "Aktif" | "Sakit" | "Pulang" | "Haid">,`;

content = content.replace(hydrateStart, hydrateNew);

const statusMergeStart = `      // status_siswa overrides has highest priority
      const cloudStatus = cloudStatusMap ? cloudStatusMap[nameKey] : null;`;

const statusMergeNew = `      // status_siswa and active izin overrides has highest priority
      const cloudStatus = cloudStatusMap ? cloudStatusMap[nameKey] : null;`;

content = content.replace(statusMergeStart, statusMergeNew);

fs.writeFileSync('src/App.tsx', content);
