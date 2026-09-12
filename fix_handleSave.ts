import fs from 'fs';
let content = fs.readFileSync('src/components/PerizinanPanel.tsx', 'utf-8');

const target = `let dbPayload: any = {
      siswa_id: formStudent.id ? Number(formStudent.id) : null,
      nama_siswa: formStudent.nama_lengkap,
      jenis_kelamin: formStudent.jenis_kelamin || (activeSubMenu === 'haid' ? 'P' : 'L'),
      kamar: formStudent.kamar || formKamar || "Belum Set",
      tanggal_mulai: formTglMulai,
      jam_mulai: formJamMulai,
      tanggal_selesai: calculatedTglSelesai,
      jam_selesai: formJamSelesai,
      status: initialStatus,
      petugas: currentUserName,`;

const replacement = `let dbPayload: any = {
      siswa_id: formStudent.id ? Number(formStudent.id) : null,
      nama_siswa: formStudent.nama_lengkap,
      jenis_kelamin: formStudent.jenis_kelamin || (activeSubMenu === 'haid' ? 'P' : 'L'),
      kamar: formStudent.kamar || formKamar || "Belum Set",
      tanggal_mulai: formTglMulai || null,
      jam_mulai: formJamMulai || null,
      tanggal_selesai: calculatedTglSelesai || null,
      jam_selesai: formJamSelesai || null,
      status: initialStatus,
      petugas: currentUserName,`;

content = content.replace(target, replacement);

const targetError = `if (error) throw error;`;
const replacementError = `if (error) { console.error("Insert error:", error); throw error; }`;

content = content.replace(targetError, replacementError);

fs.writeFileSync('src/components/PerizinanPanel.tsx', content);
