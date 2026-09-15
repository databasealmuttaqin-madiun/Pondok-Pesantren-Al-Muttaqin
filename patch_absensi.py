import re

with open("src/components/AbsensiGuruPanel.tsx", "r") as f:
    content = f.read()

content = content.replace("student?.id || student?.nik || idx", "student?.id || idx")

with open("src/components/AbsensiGuruPanel.tsx", "w") as f:
    f.write(content)
