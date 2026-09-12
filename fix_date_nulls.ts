import fs from 'fs';
let content = fs.readFileSync('src/components/PerizinanPanel.tsx', 'utf-8');

const target = `let dbPayload: any = {
      siswa_id: formStudent.id ? Number(formStudent.id) : null,
      nama_siswa: formStudent.nama_lengkap,
      jenis_kelamin: formStudent.jenis_kelamin || (activeSubMenu === 'haid' ? 'P' : 'L'),
      kamar: formStudent.kamar || formKamar || "Belum Set",
      tanggal_mulai: formTglMulai || null,
      jam_mulai: formJamMulai || null,
      tanggal_selesai: calculatedTglSelesai || null,
      jam_selesai: formJamSelesai || null,
      status: initialStatus,
      petugas: currentUserName,
      catatan: [`;

const replacement = `let dbPayload: any = {
      siswa_id: formStudent.id ? Number(formStudent.id) : null,
      nama_siswa: formStudent.nama_lengkap,
      jenis_kelamin: formStudent.jenis_kelamin || (activeSubMenu === 'haid' ? 'P' : 'L'),
      kamar: formStudent.kamar || formKamar || "Belum Set",
      status: initialStatus,
      petugas: currentUserName,
      catatan: [`;

content = content.replace(target, replacement);

const target2 = `created_at: new Date().toISOString()
    };`;

const replacement2 = `created_at: new Date().toISOString()
    };
    if (formTglMulai) dbPayload.tanggal_mulai = formTglMulai;
    if (formJamMulai) dbPayload.jam_mulai = formJamMulai;
    if (calculatedTglSelesai) dbPayload.tanggal_selesai = calculatedTglSelesai;
    if (formJamSelesai) dbPayload.jam_selesai = formJamSelesai;
`;

content = content.replace(target2, replacement2);

fs.writeFileSync('src/components/PerizinanPanel.tsx', content);
