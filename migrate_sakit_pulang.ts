import { supabase } from './src/supabaseClient.ts';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { data: statusSakit } = await supabase.from('status_siswa').select('*').ilike('status', '%sakit%');
  if (statusSakit && statusSakit.length > 0) {
      for (const row of statusSakit) {
          const { data: exists } = await supabase.from('izin_sakit').select('id').eq('nama_siswa', row.nama).ilike('status', '%sedang%');
          if (!exists || exists.length === 0) {
              const { data: santriMatch } = await supabase.from('santri').select('id, kamar, jenis_kelamin').ilike('nama_lengkap', row.nama).single();
              await supabase.from('izin_sakit').insert({
                  nama_siswa: row.nama,
                  siswa_id: santriMatch?.id,
                  kamar: santriMatch?.kamar || '',
                  jenis_kelamin: santriMatch?.jenis_kelamin || 'L',
                  status: 'Sedang Sakit',
                  petugas: 'Sistem Migrasi',
                  catatan: 'Migrasi otomatis',
                  tanggal_mulai: new Date().toISOString().split('T')[0],
              });
              console.log(`Migrated ${row.nama} to izin_sakit`);
          }
      }
  }
  
  const { data: statusPulang } = await supabase.from('status_siswa').select('*').ilike('status', '%pulang%');
  if (statusPulang && statusPulang.length > 0) {
      for (const row of statusPulang) {
          const { data: exists } = await supabase.from('izin_sambang').select('id').eq('nama_siswa', row.nama).ilike('status', '%sedang%');
          if (!exists || exists.length === 0) {
              const { data: santriMatch } = await supabase.from('santri').select('id, kamar, jenis_kelamin').ilike('nama_lengkap', row.nama).single();
              await supabase.from('izin_sambang').insert({
                  nama_siswa: row.nama,
                  siswa_id: santriMatch?.id,
                  kamar: santriMatch?.kamar || '',
                  jenis_kelamin: santriMatch?.jenis_kelamin || 'L',
                  status: 'Sedang Sambang',
                  tujuan: 'Pulang (Migrasi)',
                  petugas: 'Sistem Migrasi',
                  tanggal_mulai: new Date().toISOString().split('T')[0],
              });
              console.log(`Migrated ${row.nama} to izin_sambang`);
          }
      }
  }
}
run();
