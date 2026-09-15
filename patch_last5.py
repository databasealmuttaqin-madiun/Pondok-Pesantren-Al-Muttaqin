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

# RegistrationForm.tsx
patch_file("src/components/RegistrationForm.tsx", [
    (r'rooms: string\[\];\s*', ''),
    (r'recitationClasses: string\[\];\s*', ''),
    (r'schoolClasses: string\[\];\s*', ''),
    (r'students: SantriData\[\];\s*', ''),
    (r'rooms, recitationClasses, schoolClasses, students,', ''),
])

# NfcRegisterPanel.tsx
patch_file("src/components/NfcRegisterPanel.tsx", [
    (r's\.nama_panggilan.*?,', ''),
    (r'trim.*?,', ''),
])

# PerizinanPanel.tsx
patch_file("src/components/PerizinanPanel.tsx", [
    (r's\.nama_panggilan.*?,', ''),
    (r'santri\.no_hp_ortu', '""'),
    (r'santri\.nama_ayah', '""'),
    (r'santri\.nama_ibu', '""'),
    (r's\.nisn.*?,', ''),
    (r's\.daerah.*?,', ''),
    (r'false \|\|', ''),
    (r'\|\| false', ''),
])

# PresensiPanel.tsx
patch_file("src/components/PresensiPanel.tsx", [
    (r'student\.nama_panggilan', '""'),
    (r'student\.no_hp_ortu', '""'),
    (r'false \|\|', ''),
    (r'\|\| false', ''),
])

# RekapAbsensiPengajianPanel.tsx
patch_file("src/components/RekapAbsensiPengajianPanel.tsx", [
    (r'session\.nama_sesi', 'session.id'),
])

# SantriList.tsx
patch_file("src/components/SantriList.tsx", [
    (r's\.nama_panggilan', '""'),
    (r's\.nisn', '""'),
    (r's\.npsn', '""'),
    (r's\.daerah', '""'),
    (r'false ===', '"" ==='),
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r'student\.nik', '""'),
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
    (r'studentNik = student\?.nik', 'studentNik = String(student?.id)'),
])

# ManajemenSekolahPanel.tsx
patch_file("src/components/ManajemenSekolahPanel.tsx", [
    (r'studentNik = student\?.nik', 'studentNik = String(student?.id)'),
])

# AbsensiGuruPanel.tsx
patch_file("src/components/AbsensiGuruPanel.tsx", [
    (r'profile\.nik\.length !== 16', 'false'),
    (r'!/^\d\+$/.test\(profile\.nik\)', 'false'),
])

