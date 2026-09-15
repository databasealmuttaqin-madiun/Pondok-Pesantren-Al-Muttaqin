import re

with open("src/components/SantriList.tsx", "r") as f:
    content = f.read()

def replace_csv(match):
    return """    const rows = filteredStudents.map((s) => [
      s.id || "",
      s.kategori,
      s.status || "Aktif",
      `"${s.nama_lengkap.replace(/"/g, '""')}"`,
      s.jenis_kelamin || "L",
      `"${(s.kamar || "").replace(/"/g, '""')}"`,
      `"${(s.kelas_sekolah || "").replace(/"/g, '""')}"`,
      `"${(s.kelas_pengajian || "").replace(/"/g, '""')}"`
    ]);"""

content = re.sub(r'const rows = filteredStudents\.map\(\(s\) => \[.*?\]\);', replace_csv, content, flags=re.DOTALL)

with open("src/components/SantriList.tsx", "w") as f:
    f.write(content)
