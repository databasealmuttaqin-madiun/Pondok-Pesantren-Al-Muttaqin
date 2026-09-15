import os
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

# SantriList.tsx
patch_file("src/components/SantriList.tsx", [
    (r's\.nama_panggilan.*?,', ''),
    (r's\.nik.*?,', ''),
    (r's\.nisn.*?,', ''),
    (r's\.npsn.*?,', ''),
    (r's\.tempat_lahir.*?,', ''),
    (r's\.tanggal_lahir.*?,', ''),
    (r's\.alamat.*?,', ''),
    (r's\.rt.*?,', ''),
    (r's\.rw.*?,', ''),
    (r's\.desa_kelurahan.*?,', ''),
    (r's\.kecamatan.*?,', ''),
    (r's\.kabupaten_kota.*?,', ''),
    (r's\.provinsi.*?,', ''),
    (r's\.nama_ayah.*?,', ''),
    (r's\.nama_ibu.*?,', ''),
    (r's\.no_hp_ortu.*?,', ''),
    (r's\.kelompok_sambung.*?,', ''),
    (r's\.desa_sambung.*?,', ''),
    (r's\.daerah.*?,', ''),
    
    (r'\(s\.kategori === "Reguler" \? s\.npsn : s\.nisn\)', '""'),
    (r'\{renderFormRow\("Daerah", selectedStudent\.daerah\)\}', ''),
    (r'\{renderFormRow\("Kelompok Sambung", selectedStudent\.kelompok_sambung\)\}', ''),
    (r'\{renderFormRow\("Desa Sambung", selectedStudent\.desa_sambung\)\}', ''),
])

# SiswaLulusMutasiPanel.tsx
patch_file("src/components/SiswaLulusMutasiPanel.tsx", [
    (r'nik: string;\n', ''),
    (r'nisn\?: string;\n', ''),
    (r'studentNik', 'String(editingItem?.id || "")'),
    (r'studentNisn', 'undefined'),
    (r'nik: matchedStudent\?\.nik \|\| formNik \|\| \(editingItem \? editingItem\.nik : `ID_\$\{Date\.now\(\)\}`\),', ''),
    (r'nisn: matchedStudent\?\.nisn \|\| formNisn \|\| \(editingItem \? editingItem\.nisn : undefined\),', ''),
    (r'<div>\s*<p className="text-xs text-slate-500 mb-1">NIK</p>\s*<p className="font-semibold text-slate-800">\{selectedStudent.nik || "-"\}</p>\s*</div>', ''),
    (r'<div>\s*<p className="text-xs text-slate-500 mb-1">NISN / NPSN</p>\s*<p className="font-semibold text-slate-800">\{selectedStudent.nisn || "-"\}</p>\s*</div>', ''),
    (r'<tr>\s*<td className="py-2 text-slate-500">NIK</td>\s*<td className="py-2 font-medium text-slate-800">\{student\.nik \|\| "-"\}</td>\s*</tr>', ''),
    (r'<tr>\s*<td className="py-2 text-slate-500">NISN</td>\s*<td className="py-2 font-medium text-slate-800">\{student\.nisn \|\| "-"\}</td>\s*</tr>', ''),
    (r's\.nik', 'String(s.id)'),
    (r'student\.nik', 'String(student.id)'),
    (r'deleteConfirmTarget\.nik', 'String(deleteConfirmTarget.id)'),
    (r'item\.nik', 'String(item.id)'),
    (r'editingItem\.nik', 'String(editingItem.id)'),
])

# PerizinanPanel.tsx
patch_file("src/components/PerizinanPanel.tsx", [
    (r'\(s\.nama_panggilan && s\.nama_panggilan\.toLowerCase\(\)\.includes\([a-zA-Z]\)\) \|\|', ''),
    (r'\(s\.nisn && s\.nisn\.toLowerCase\(\)\.includes\([a-zA-Z]\)\) \|\|', ''),
    (r's\.daerah\.toLowerCase\(\)\.includes\([a-zA-Z]\)', 'false'),
    (r's\.daerah \? ` - \$\{s\.daerah\}` : ""', '""'),
])

# PresensiPanel.tsx
patch_file("src/components/PresensiPanel.tsx", [
    (r'\(student\.nama_panggilan && student\.nama_panggilan\.toLowerCase\(\)\.includes\(q\)\) \|\|', ''),
    (r'student\.no_hp_ortu', '""'),
])

