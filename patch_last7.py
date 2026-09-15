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

# App.tsx
patch_file("src/App.tsx", [
    (r'targetNik', 'targetId'),
])

# ManagementPanel.tsx
patch_file("src/components/ManagementPanel.tsx", [
    (r'studentNik = String\(student\?\.id\)', 'studentId = String(student?.id)'),
    (r'setStudentIdOrNik\(Number\(targetNik\) \|\| 0\);', 'setStudentIdOrNik(Number(targetId) || 0);'),
    (r'setStudentIdOrNik\(Number\(profile\.id\) \|\| 0\);', 'setStudentIdOrNik(Number(profile.id) || 0);'),
    (r'\{ nik: string; name: string; currentVal: string; \}', 'string'),
    (r'Key', 'string'),
])

# ManajemenSekolahPanel.tsx
patch_file("src/components/ManajemenSekolahPanel.tsx", [
    (r'studentNik = String\(student\?\.id\)', 'studentId = String(student?.id)'),
    (r'setStudentIdOrNik\(Number\(targetNik\) \|\| 0\);', 'setStudentIdOrNik(Number(targetId) || 0);'),
    (r'setStudentIdOrNik\(Number\(profile\.id\) \|\| 0\);', 'setStudentIdOrNik(Number(profile.id) || 0);'),
    (r'\{ nik: string; name: string; currentVal: string; \}', 'string'),
])

# NfcRegisterPanel.tsx
patch_file("src/components/NfcRegisterPanel.tsx", [
    (r'trim.*?,', ''),
    (r'\(s\.id && s\.id\.toLowerCase\(\)\.includes\(q\)\)', 'String(s.id).toLowerCase().includes(q)'),
    (r's\.id \? String\(s\.id\)\.trim\(\)\.toUpperCase\(\) : ""', '""'),
])

# PerizinanPanel.tsx
patch_file("src/components/PerizinanPanel.tsx", [
    (r'santri\.id', 'String(santri.id)'),
    (r's\.id', 'String(s.id)'),
])

# RekapAbsensiPengajianPanel.tsx
patch_file("src/components/RekapAbsensiPengajianPanel.tsx", [
    (r'session\.nama_sesi', 'session.id'),
])

# SantriList.tsx
patch_file("src/components/SantriList.tsx", [
    (r'false ===', '"" ==='),
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r'\(string \| SiswaLulus\)', 'string'),
    (r'\(string \| SiswaMutasi\)', 'string'),
    (r'ReactNode', 'string'),
])

