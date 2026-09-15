import re

def fix_file(filename):
    with open(filename, "r") as f:
        content = f.read()
        
    # Replace s.nik with s.id
    content = re.sub(r's\.nik', 's.id', content)
    content = re.sub(r'student\.nik', 'student.id', content)
    content = re.sub(r'selectedStudent\.nik', 'selectedStudent.id', content)
    content = re.sub(r'profile\.nik', 'profile.id', content)
    content = re.sub(r'guru\.nik', 'guru.id', content)
    content = re.sub(r'matchedStudent\.nik', 'matchedStudent.id', content)
    
    with open(filename, "w") as f:
        f.write(content)

fix_file("src/components/NfcRegisterPanel.tsx")
fix_file("src/components/PerizinanPanel.tsx")
fix_file("src/components/PelanggaranPanel.tsx")
fix_file("src/components/AbsensiGuruPanel.tsx")
