import re

with open("src/components/SiswaLulusMutasiPanel.tsx", "r") as f:
    content = f.read()

# Remove nik and nisn from SiswaLulus
content = re.sub(r'nik: string;\n', '', content)
content = re.sub(r'nisn\?: string;\n', '', content)

# Remove nik and nisn usages in SiswaLulusMutasiPanel
content = re.sub(r'nik: student\.nik \|\| "-",\n', '', content)
content = re.sub(r'nisn: student\.nisn \|\| "-",\n', '', content)
content = re.sub(r'nik: \?\?,\n', '', content)
content = re.sub(r'nisn: \?\?,\n', '', content)
content = re.sub(r'nik: .*?,\n', '', content)
content = re.sub(r'nisn: .*?,\n', '', content)

content = re.sub(r'studentNik', 'String(editingItem?.id || "")', content)

# delete old td rows
content = re.sub(r'<td className="py-2 text-slate-500">NIK</td>.*?</tr>', '', content, flags=re.DOTALL)
content = re.sub(r'<td className="py-2 text-slate-500">NISN</td>.*?</tr>', '', content, flags=re.DOTALL)

with open("src/components/SiswaLulusMutasiPanel.tsx", "w") as f:
    f.write(content)
