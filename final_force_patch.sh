#!/bin/bash

# Remove all TS types that are breaking due to SantriData missing old fields
grep -rl "SantriData" src/ | xargs sed -i 's/\.nama_panggilan//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.nik//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.nisn//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.npsn//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.no_hp_ortu//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.nama_ayah//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.nama_ibu//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.daerah//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.tempat_lahir//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.tanggal_lahir//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.alamat//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.rt//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.rw//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.desa_kelurahan//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.kecamatan//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.kabupaten_kota//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.provinsi//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.kelompok_sambung//g'
grep -rl "SantriData" src/ | xargs sed -i 's/\.desa_sambung//g'

