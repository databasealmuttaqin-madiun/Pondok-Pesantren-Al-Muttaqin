import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  // Ambil semua dari status_siswa yang 'Haid'
  const { data: statusHaid } = await supabase.from('status_siswa').select('*').ilike('status', '%haid%');
  
  if (!statusHaid || statusHaid.length === 0) {
     console.log("Tidak ada data Haid di status_siswa.");
     return;
  }
  
  console.log(`Ditemukan ${statusHaid.length} siswi dengan status Haid di status_siswa. Memigrasi ke izin_haid...`);
  
  let inserted = 0;
  for (const row of statusHaid) {
      const nama = row.nama;
      
      // Ambil id dari tabel santri
      const { data: santriMatch } = await supabase.from('santri').select('id, kamar').ilike('nama_lengkap', nama).single();
      
      const insertData = {
          nama_siswa: nama,
          siswa_id: santriMatch ? santriMatch.id : null,
          kamar: santriMatch ? santriMatch.kamar : '',
          jenis_kelamin: 'P',
          status: 'Sedang Haid',
          petugas: 'Sistem Migrasi',
          catatan: 'Migrasi otomatis dari status_siswa lama',
          tanggal_mulai: new Date().toISOString().split('T')[0],
          jam_mulai: '00:00:00'
      };
      
      const { error } = await supabase.from('izin_haid').insert(insertData);
      if (error) {
          console.error(`Gagal migrasi ${nama}:`, error.message);
      } else {
          inserted++;
          console.log(`Berhasil migrasi ${nama} ke izin_haid`);
      }
  }
  
  console.log(`Berhasil migrasi total ${inserted} siswi ke tabel izin_haid.`);
}

run();
