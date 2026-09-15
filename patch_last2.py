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
])

# PresensiPanel.tsx
patch_file("src/components/PresensiPanel.tsx", [
    (r'student\.nama_panggilan', '""'),
    (r'student\.no_hp_ortu', '""'),
])

# RekapAbsensiPengajianPanel.tsx
patch_file("src/components/RekapAbsensiPengajianPanel.tsx", [
    (r'session\.nama_sesi', 'session.id'),
])

# SantriList.tsx
patch_file("src/components/SantriList.tsx", [
    (r's\.nama_panggilan', '""'),
    (r's\.nik', 'String(s.id)'),
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
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r'student\.nik', 'String(student.id)'),
    (r'matchedStudent\?\.nisn', '""'),
    (r'matchedStudent\?\.nik', 'String(matchedStudent?.id)'),
    (r's\.nik', 'String(s.id)'),
    (r'item\.nik', 'String(item.id)'),
    (r'nisn: "" \|\| formNisn,', ''),
    (r'nisn: "" \|\| "-",', ''),
    (r'nisn: editingItem\?\.nisn,', ''),
    (r'nisn: \?\?,', ''),
    (r'deleteConfirmTarget\.nik', 'String(deleteConfirmTarget.id)'),
    (r'editingItem\.nik', 'String(editingItem.id)'),
    (r'nik: String\(editingItem\.id\),', ''),
])

