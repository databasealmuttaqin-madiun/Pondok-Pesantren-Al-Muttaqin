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

# RegistrationFormProps - remove rooms, recitationClasses, schoolClasses, students from props definition
patch_file("src/components/RegistrationForm.tsx", [
    (r'rooms.*?;', ''),
    (r'recitationClasses.*?;', ''),
    (r'schoolClasses.*?;', ''),
    (r'students.*?;', ''),
])

# NfcRegisterPanel.tsx
patch_file("src/components/NfcRegisterPanel.tsx", [
    (r'\(s\.nama_panggilan && s\.nama_panggilan\.toLowerCase\(\)\.includes\([a-zA-Z]\)\) \|\|', ''),
    (r's\.nik \? s\.nik\.trim\(\)\.toUpperCase\(\) : ""', '""'),
    (r'\(s\.nama_panggilan && s\.nama_panggilan\.toLowerCase\(\)\.includes\(q\)\) \|\|', ''),
])

# PerizinanPanel.tsx
patch_file("src/components/PerizinanPanel.tsx", [
    (r'santri\.no_hp_ortu', '""'),
    (r'santri\.nama_ayah', '""'),
    (r'santri\.nama_ibu', '""'),
    (r'String\(s\.id\)\.includes\(q\) \|\|', ''),
    (r'\(s\.nisn && s\.nisn\.includes\(q\)\)', 'false'),
    (r's\.nisn', '""'),
    (r's\.daerah', '""'),
    (r'\(s\.nama_panggilan && s\.nama_panggilan\.toLowerCase\(\)\.includes\(q\)\) \|\|', ''),
    (r'false \|\|', ''),
    (r'\|\| false', ''),
])

# PresensiPanel.tsx
patch_file("src/components/PresensiPanel.tsx", [
    (r'student\.nama_panggilan', '""'),
    (r'student\.no_hp_ortu', '""'),
    (r'\|\| ""\.toLowerCase\(\)\.includes\(q\)', ''),
    (r'"" \|\|', ''),
])

# SantriList.tsx
patch_file("src/components/SantriList.tsx", [
    (r's\.nama_panggilan', '""'),
    (r's\.nisn', '""'),
    (r's\.npsn', '""'),
    (r's\.daerah', '""'),
    (r's\.tempat_lahir', '""'),
    (r's\.tanggal_lahir', '""'),
    (r's\.alamat', '""'),
    (r's\.rt', '""'),
    (r's\.rw', '""'),
    (r's\.desa_kelurahan', '""'),
    (r's\.kecamatan', '""'),
    (r's\.kabupaten_kota', '""'),
    (r's\.provinsi', '""'),
    (r's\.nama_ayah', '""'),
    (r's\.nama_ibu', '""'),
    (r's\.no_hp_ortu', '""'),
    (r's\.kelompok_sambung', '""'),
    (r's\.desa_sambung', '""'),
    (r'selectedStudent\.nisn', '""'),
    (r'selectedStudent\.npsn', '""'),
    (r'\|\| ""', ''),
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r'nisn: "" \|\| formNisn,', ''),
    (r'nisn: "" \|\| "-",', ''),
    (r'nisn: editingItem\?\.nisn,', ''),
    (r'nisn: \?\?,', ''),
    (r'student\.nisn', '""'),
    (r'matchedStudent\?\.nisn', '""'),
    (r'matchedStudent\?\.nik', '""'),
    (r's\.nik', '""'),
    (r'item\.nik', '""'),
    (r'deleteConfirmTarget\.nik', '""'),
    (r'editingItem\.nik', '""'),
    (r'nik: String\(editingItem\.id\),', ''),
])

# ManagementPanel.tsx
patch_file("src/components/ManagementPanel.tsx", [
    (r's\.nik', 'String(s.id)'),
    (r'student\.nik', 'String(student.id)'),
    (r'profile\.nik', 'String(profile.id)'),
    (r'nik: String\(profile\.id\),', ''),
    (r'studentNik = student\?.nik', 'studentNik = student?.id'),
    (r'String\(s\.id\) === targetNik', 's.id === Number(targetNik)'),
    (r's\.id\.toString\(\) === studentIdOrNik \|\| String\(s\.id\) === studentIdOrNik', 's.id === Number(studentIdOrNik)'),
])

# ManajemenSekolahPanel.tsx
patch_file("src/components/ManajemenSekolahPanel.tsx", [
    (r's\.nik', 'String(s.id)'),
    (r'student\.nik', 'String(student.id)'),
    (r'profile\.nik', 'String(profile.id)'),
    (r'nik: String\(profile\.id\),', ''),
    (r'studentNik = student\?.nik', 'studentNik = student?.id'),
    (r'String\(s\.id\) === targetNik', 's.id === Number(targetNik)'),
    (r's\.id\.toString\(\) === studentIdOrNik \|\| String\(s\.id\) === studentIdOrNik', 's.id === Number(studentIdOrNik)'),
])

# JurnalPengajianPanel.tsx
patch_file("src/components/JurnalPengajianPanel.tsx", [
    (r'santri\.nisn \|\| santri\.nik', 'santri.id'),
])

# AbsensiGuruPanel.tsx
patch_file("src/components/AbsensiGuruPanel.tsx", [
    (r'profile\.nik\.length !== 16', 'false'),
    (r'!/^\d\+$/.test\(profile\.nik\)', 'false'),
])

