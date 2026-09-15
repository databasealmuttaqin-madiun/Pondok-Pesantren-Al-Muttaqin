import re

with open("src/supabaseClient.ts", "r") as f:
    content = f.read()

def replace_format(match):
    return """export function formatSantriData(s: SantriData): SantriData {
  return {
    ...s,
    nama_lengkap: toTitleCase(s.nama_lengkap),
    kamar: s.kamar ? toTitleCase(s.kamar) : "",
    kelas_pengajian: s.kelas_pengajian ? toTitleCase(s.kelas_pengajian) : "",
    kelas_sekolah: s.kelas_sekolah ? toTitleCase(s.kelas_sekolah) : "",
    status: s.status || "Aktif",
    jenis_kelamin: s.jenis_kelamin || "L",
  };
}"""

content = re.sub(r'export function formatSantriData\(s: SantriData\): SantriData \{[\s\S]*?\}', replace_format, content)

with open("src/supabaseClient.ts", "w") as f:
    f.write(content)
