import re

with open("src/components/SantriList.tsx", "r") as f:
    content = f.read()

# 1. getDeterministicStats
old_stats = """function getDeterministicStats(name: string, nik: string) {
  // Use sum of char codes from name + nik as seed
  const str = (name || "") + (nik || "");"""

new_stats = """function getDeterministicStats(name: string, id: string | number) {
  // Use sum of char codes from name + id as seed
  const str = (name || "") + String(id || "");"""

content = content.replace(old_stats, new_stats)
content = content.replace("getDeterministicStats(s.nama_lengkap, s.nik)", "getDeterministicStats(s.nama_lengkap, s.id || '')")
content = content.replace("getDeterministicStats(selectedStudent.nama_lengkap, selectedStudent.nik)", "getDeterministicStats(selectedStudent.nama_lengkap, selectedStudent.id || '')")


# 2. searchQuery filter
old_search = """      s.nama_lengkap.toLowerCase().includes(searchQuery) ||
      s.nik.includes(searchQuery) ||
      s.kamar?.toLowerCase().includes(searchQuery) ||
      s.kelas_pengajian?.toLowerCase().includes(searchQuery) ||
      s.kelas_sekolah?.toLowerCase().includes(searchQuery)"""

new_search = """      s.nama_lengkap.toLowerCase().includes(searchQuery) ||
      s.kamar?.toLowerCase().includes(searchQuery) ||
      s.kelas_pengajian?.toLowerCase().includes(searchQuery) ||
      s.kelas_sekolah?.toLowerCase().includes(searchQuery)"""

content = content.replace(old_search, new_search)

# 3. CSV export (id column instead of NIK)
old_csv = """      `"${s.nama_lengkap.replace(/"/g, '""')}"`,
      `'${s.nik}`,
      s.jenis_kelamin,"""

new_csv = """      `"${s.nama_lengkap.replace(/"/g, '""')}"`,
      s.jenis_kelamin,"""

content = content.replace(old_csv, new_csv)
content = content.replace('"NAMA LENGKAP","NIK","JENIS KELAMIN"', '"NAMA LENGKAP","JENIS KELAMIN"')


# 4. Tr keys
content = content.replace("s.id || s.nik || idx", "s.id || idx")


# 5. Old name/id col (Wait, I thought I removed this already?)
# Let's check if it exists:
old_npsn = """{(s.kategori === "Reguler" ? s.npsn : s.nisn) || s.nik || "No ID"}"""
content = content.replace(old_npsn, """{s.id || "No ID"}""")


# 6. Delete Confirm
old_delete = """Apakah Anda yakin ingin menghapus data siswa <strong className="text-slate-900 dark:text-slate-100">{deleteConfirmTarget.nama_lengkap}</strong> {deleteConfirmTarget.nik ? `(NIK: ${deleteConfirmTarget.nik})` : ""} secara permanen dari database pesantren?"""
new_delete = """Apakah Anda yakin ingin menghapus data siswa <strong className="text-slate-900 dark:text-slate-100">{deleteConfirmTarget.nama_lengkap}</strong> secara permanen dari database pesantren?"""
content = content.replace(old_delete, new_delete)

# 7. Print modal nik
old_print_nik = """<span className="font-mono text-xs text-gray-700">{selectedStudent.nik}</span>"""
new_print_nik = """<span className="font-mono text-xs text-gray-700">{selectedStudent.id}</span>"""
content = content.replace(old_print_nik, new_print_nik)
content = content.replace("""{selectedStudent.nik}""", """{selectedStudent.id}""")

with open("src/components/SantriList.tsx", "w") as f:
    f.write(content)
