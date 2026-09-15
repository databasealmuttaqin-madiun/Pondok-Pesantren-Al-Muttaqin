import re

with open("src/components/SiswaLulusMutasiPanel.tsx", "r") as f:
    content = f.read()

# Replace nik and nisn usages
content = re.sub(r'\(s\.nama_panggilan && s\.nama_panggilan\.toLowerCase\(\)\.includes\(q\)\) \|\|', '', content)
content = re.sub(r's\.nik\.includes\(q\) \|\|', 'String(s.id).includes(q)', content)
content = re.sub(r'\(s\.nisn && s\.nisn\.includes\(q\)\)', 'false', content)

content = content.replace("s.nik === studentId", "String(s.id) === studentId")
content = content.replace("student.nik", "String(student.id || '')")
content = content.replace("setFormNisn(student.nisn || \"\");", "")
content = content.replace("student.id || student.nik", "student.id")

# Lulus mutasi logic has formNik, formNisn
content = re.sub(r'setFormNik\(.*?\);', '', content)
content = re.sub(r'setFormNisn\(.*?\);', '', content)

with open("src/components/SiswaLulusMutasiPanel.tsx", "w") as f:
    f.write(content)
