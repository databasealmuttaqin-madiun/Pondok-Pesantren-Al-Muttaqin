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
    (r'activeTab === "rekap_jurnal"', 'false'),
    (r'activeTab === "rekap_absensi"', 'false'),
    (r'activeTab === "jurnal_pengajian"', 'false'),
])

# AbsensiGuruPanel.tsx
patch_file("src/components/AbsensiGuruPanel.tsx", [
    (r'profile\.id\.length !== 16', 'false'),
])

# ManagementPanel.tsx
patch_file("src/components/ManagementPanel.tsx", [
    (r'String\(s\.id\) === targetNik', 's.id === Number(targetNik)'),
    (r's\.id\.toString\(\) === studentIdOrNik \|\| String\(s\.id\) === studentIdOrNik', 's.id === Number(studentIdOrNik)'),
    (r'setStudentIdOrNik\(targetNik\);', 'setStudentIdOrNik(Number(targetNik) || 0);'),
    (r'setStudentIdOrNik\(profile\.id\);', 'setStudentIdOrNik(Number(profile.id) || 0);'),
    (r'key=\{profile\.id\}', 'key={String(profile.id)}'),
])

# ManajemenSekolahPanel.tsx
patch_file("src/components/ManajemenSekolahPanel.tsx", [
    (r'String\(s\.id\) === targetNik', 's.id === Number(targetNik)'),
    (r's\.id\.toString\(\) === studentIdOrNik \|\| String\(s\.id\) === studentIdOrNik', 's.id === Number(studentIdOrNik)'),
    (r'setStudentIdOrNik\(targetNik\);', 'setStudentIdOrNik(Number(targetNik) || 0);'),
    (r'setStudentIdOrNik\(profile\.id\);', 'setStudentIdOrNik(Number(profile.id) || 0);'),
])

# PerizinanPanel.tsx
patch_file("src/components/PerizinanPanel.tsx", [
    (r'\(s\.id && s\.id\.toLowerCase\(\)\.includes\(q\)\)', 'String(s.id).toLowerCase().includes(q)'),
    (r's\.id\.trim\(\)', 'String(s.id).trim()'),
    (r'String\(s\.id\)\.includes\(q\) \|\|', 'false ||'),
])

# SantriList.tsx
patch_file("src/components/SantriList.tsx", [
    (r'"" ===', 'false ==='),
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r's\.id\.includes', 'String(s.id).includes'),
    (r'item\.id', 'String(item.id)'),
    (r'deleteConfirmTarget\.id', 'String(deleteConfirmTarget.id)'),
    (r'editingItem\.id', 'String(editingItem.id)'),
    (r'editingItem\?\.id', 'String(editingItem?.id)'),
    (r'student\.id', 'String(student.id)'),
])

# JurnalPengajianPanel.tsx
patch_file("src/components/JurnalPengajianPanel.tsx", [
    (r'santri\.id', 'String(santri.id)'),
])

