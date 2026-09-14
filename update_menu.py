import sys

with open("src/App.tsx", "r") as f:
    lines = f.readlines()

new_menu_entry = '    { id: "jurnal_pengajian", group: "PENGAJIAN", isSubmenu: true, subLabel: "Jurnal & Absensi", label: "Jurnal & Absensi Pengajian", shortLabel: "Jurnal", icon: ClipboardEdit, roles: ["super admin", "admin", "guru pondok", "pondok"] },\n'

# find PENGAJIAN section
for i in range(len(lines)):
    if 'group: "PENGAJIAN"' in lines[i] and 'target_pengajian' in lines[i]:
        lines.insert(i + 1, new_menu_entry)
        break

# find the imports, we need ClipboardEdit
# import { BookOpen, Target ... from "lucide-react";
for i in range(len(lines)):
    if 'import {' in lines[i] and 'lucide-react' in lines[i]:
        if 'ClipboardEdit' not in lines[i]:
            lines[i] = lines[i].replace('BookOpen,', 'BookOpen, ClipboardEdit,')
        break

# check imports again if it wasn't on one line
for i in range(len(lines)):
    if 'from "lucide-react"' in lines[i]:
        break

with open("src/App.tsx", "w") as f:
    f.writelines(lines)
