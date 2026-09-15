import re

def patch_file(filepath, replacements):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        for old, new in replacements:
            content = re.sub(old, new, content)
        with open(filepath, 'w') as f:
            f.write(content)
    except Exception as e:
        print(f"Failed to patch {filepath}: {e}")

# ManagementPanel.tsx
patch_file("src/components/ManagementPanel.tsx", [
    (r's\.nik', 's.id'),
    (r'student\.nik', 'student.id'),
    (r'profile\.nik', 'profile.id'),
])

# ManajemenSekolahPanel.tsx
patch_file("src/components/ManajemenSekolahPanel.tsx", [
    (r's\.nik', 's.id'),
    (r'student\.nik', 'student.id'),
    (r'profile\.nik', 'profile.id'),
])

# NfcRegisterPanel.tsx
patch_file("src/components/NfcRegisterPanel.tsx", [
    (r'\(s\.nama_panggilan && s\.nama_panggilan\.toLowerCase\(\)\.includes\([a-zA-Z]\)\) \|\|', ''),
    (r's\.nik \? s\.nik\.trim\(\)\.toUpperCase\(\) : ""', '""'),
])

# PerizinanPanel.tsx
patch_file("src/components/PerizinanPanel.tsx", [
    (r'const hasOrtu = Boolean\(santri\.no_hp_ortu\);', 'const hasOrtu = false;'),
    (r'const parentPhone = santri\.no_hp_ortu \|\| "";', 'const parentPhone = "";'),
    (r'const parentName = santri\.nama_ayah \|\| santri\.nama_ibu \|\| "Orang Tua/Wali";', 'const parentName = "Orang Tua/Wali";'),
    (r'String\(s\.id\)\.includes\([a-zA-Z]\) \|\|', 'false ||'),
    (r'\(s\.nisn && s\.nisn\.includes\([a-zA-Z]\)\)', 'false'),
])

# SantriList.tsx
patch_file("src/components/SantriList.tsx", [
    (r'\(s\.nama_panggilan && s\.nama_panggilan\.toLowerCase\(\)\.includes\(searchQuery\)\) \|\|', ''),
    (r's\.nik\.includes\(searchQuery\) \|\|', 'String(s.id).includes(searchQuery) ||'),
    (r'\(s\.nisn && s\.nisn\.includes\(searchQuery\)\) \|\|', ''),
    (r'\(s\.npsn && s\.npsn\.includes\(searchQuery\)\) \|\|', ''),
    (r's\.daerah\?\.toLowerCase\(\)\.includes\(searchQuery\)', 'false'),
    (r's\.daerah \? ` - \$\{s\.daerah\}` : ""', '""'),
    (r'selectedStudent\.nisn', '""'),
    (r'selectedStudent\.npsn', '""'),
    (r'selectedStudent\.daerah', '""'),
    (r'selectedStudent\.kelompok_sambung', '""'),
    (r'selectedStudent\.desa_sambung', '""'),
    (r'selectedStudent\.tempat_lahir', '""'),
    (r'selectedStudent\.tanggal_lahir', '""'),
    (r'selectedStudent\.alamat', '""'),
    (r'selectedStudent\.rt', '""'),
    (r'selectedStudent\.rw', '""'),
    (r'selectedStudent\.desa_kelurahan', '""'),
    (r'selectedStudent\.kecamatan', '""'),
    (r'selectedStudent\.kabupaten_kota', '""'),
    (r'selectedStudent\.provinsi', '""'),
    (r'selectedStudent\.nama_ayah', '""'),
    (r'selectedStudent\.nama_ibu', '""'),
    (r'selectedStudent\.no_hp_ortu', '""'),
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r'nisn: editingItem\.nisn,', ''),
    (r'nisn: \?\?,', ''),
    (r'nisn: matchedStudent\.nisn \|\| formNisn,', ''),
    (r'nisn: student\.nisn \|\| "-",', ''),
    (r'nisn: editingItem\?\.nisn,', ''),
    (r'const studentNisn = undefined;', ''),
])
