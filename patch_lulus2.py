import re

with open("src/components/SiswaLulusMutasiPanel.tsx", "r") as f:
    content = f.read()

content = re.sub(r'nik: string;\n', '', content)
content = re.sub(r'nisn\?: string;\n', '', content)
content = re.sub(r'const studentNik = .*?;\n', '', content)
content = re.sub(r'const studentNisn = .*?;\n', '', content)
content = re.sub(r'nik: studentNik,\n', '', content)
content = re.sub(r'nisn: studentNisn,\n', '', content)
content = re.sub(r'setFormNik\(.*?\);\n', '', content)
content = re.sub(r'setFormNisn\(.*?\);\n', '', content)

with open("src/components/SiswaLulusMutasiPanel.tsx", "w") as f:
    f.write(content)
