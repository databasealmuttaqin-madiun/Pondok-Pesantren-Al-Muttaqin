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

# ManagementPanel.tsx, ManajemenSekolahPanel.tsx
patch_file("src/components/ManagementPanel.tsx", [
    (r'setStudentIdOrNik\(Number\(targetId\) \|\| 0\);', 'setStudentIdOrNik(targetId);'),
    (r'setStudentIdOrNik\(Number\(profile\.id\) \|\| 0\);', 'setStudentIdOrNik(String(profile.id));'),
    (r'setStudentIdOrNik: React\.Dispatch<SetStateAction<any>>', 'setStudentIdOrNik: React.Dispatch<SetStateAction<string>>'),
    (r's\.id === Number\(targetId\)', 'String(s.id) === targetId'),
    (r's\.id\.toString\(\) === studentIdOrNik \|\| String\(s\.id\) === studentIdOrNik', 'String(s.id) === studentIdOrNik'),
    (r'studentNik = String\(student\?\.id\)', 'studentNik = String(student?.id || "")'),
])
patch_file("src/components/ManajemenSekolahPanel.tsx", [
    (r'setStudentIdOrNik\(Number\(targetId\) \|\| 0\);', 'setStudentIdOrNik(targetId);'),
    (r'setStudentIdOrNik\(Number\(profile\.id\) \|\| 0\);', 'setStudentIdOrNik(String(profile.id));'),
    (r'setStudentIdOrNik: React\.Dispatch<SetStateAction<any>>', 'setStudentIdOrNik: React.Dispatch<SetStateAction<string>>'),
    (r's\.id === Number\(targetId\)', 'String(s.id) === targetId'),
    (r's\.id\.toString\(\) === studentIdOrNik \|\| String\(s\.id\) === studentIdOrNik', 'String(s.id) === studentIdOrNik'),
    (r'studentNik = String\(student\?\.id\)', 'studentNik = String(student?.id || "")'),
])

# NfcRegisterPanel.tsx
patch_file("src/components/NfcRegisterPanel.tsx", [
    (r's\.id \? String\(s\.id\)\.trim\(\)\.toUpperCase\(\) : ""', 'String(s.id || "").trim().toUpperCase()'),
    (r'studentNameNormalized === scanNormalized', 'studentNameNormalized === scanNormalized || String(s.id || "").trim() === scanNormalized'),
])

# PerizinanPanel.tsx
patch_file("src/components/PerizinanPanel.tsx", [
    (r'santri\.id', 'String(santri.id || "")'),
    (r's\.id', 'String(s.id || "")'),
])

# SantriList.tsx
patch_file("src/components/SantriList.tsx", [
    (r'String\(s\.id\)\.includes\(searchQuery\)', 'String(s.id || "").includes(searchQuery)'),
])

# JurnalPengajianPanel.tsx
patch_file("src/components/JurnalPengajianPanel.tsx", [
    (r'santri\.id', 'String(santri.id || "")'),
])

# AbsensiGuruPanel.tsx
patch_file("src/components/AbsensiGuruPanel.tsx", [
    (r'profile\.id\.length !== 16', 'false'),
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r'student\.id', 'String(student.id || "")'),
    (r's\.id', 'String(s.id || "")'),
    (r'item\.id', 'String(item.id || "")'),
    (r'editingItem\.id', 'String(editingItem.id || "")'),
    (r'editingItem\?\.id', 'String(editingItem?.id || "")'),
    (r'matchedStudent\?\.id', 'String(matchedStudent?.id || "")'),
    (r'deleteConfirmTarget\.id', 'String(deleteConfirmTarget.id || "")'),
])

# App.tsx
patch_file("src/App.tsx", [
    (r'targetId', 'targetNik'),
    (r'targetNik = targetStudent\?\.nik;', 'targetNik = String(targetStudent?.id || "");'),
    (r'targetNik = student\?\.nik \? String\(student\.nik\)\.trim\(\) : undefined;', 'targetNik = String(student?.id || "").trim() || undefined;'),
])

