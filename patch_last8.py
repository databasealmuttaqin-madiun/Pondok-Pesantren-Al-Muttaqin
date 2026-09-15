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

# RegistrationForm.tsx
patch_file("src/components/RegistrationForm.tsx", [
    (r'rooms: string\[\];', ''),
    (r'recitationClasses: string\[\];', ''),
    (r'schoolClasses: string\[\];', ''),
    (r'students: SantriData\[\];', ''),
])

# ManagementPanel.tsx
patch_file("src/components/ManagementPanel.tsx", [
    (r'\(number\)', '(string)'),
    (r'SetStateAction<string>', 'SetStateAction<number>'),
    (r'SetStateAction<number>', 'SetStateAction<any>'),
    (r'string | number', 'any'),
    (r's\.id === Number\(targetNik\)', 's.id === Number(targetId)'),
])

# ManajemenSekolahPanel.tsx
patch_file("src/components/ManajemenSekolahPanel.tsx", [
    (r's\.id === Number\(targetNik\)', 's.id === Number(targetId)'),
])

# PerizinanPanel.tsx
patch_file("src/components/PerizinanPanel.tsx", [
    (r'SetStateAction<string>', 'SetStateAction<any>'),
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r'string | SiswaLulus', 'any'),
    (r'string | SiswaMutasi', 'any'),
])

