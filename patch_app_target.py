import re

with open("src/App.tsx", "r") as f:
    content = f.read()

content = content.replace("const targetNik = targetStudent?.nik;", "")
content = content.replace("const targetNik = student?.nik ? String(student.nik).trim() : undefined;", "")

with open("src/App.tsx", "w") as f:
    f.write(content)
