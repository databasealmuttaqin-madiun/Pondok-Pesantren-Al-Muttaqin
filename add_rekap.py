import sys

with open("src/App.tsx", "r") as f:
    lines = f.readlines()

new_menus = """    { id: "rekap_jurnal", group: "PENGAJIAN", isSubmenu: true, subLabel: "Rekap Jurnal", label: "Rekap Jurnal Pengajian", shortLabel: "Rekap Jurnal", icon: FileText, roles: ["super admin", "admin", "pimpinan", "guru pondok", "pondok"] },
    { id: "rekap_absensi", group: "PENGAJIAN", isSubmenu: true, subLabel: "Rekap Absensi", label: "Rekap Absensi Pengajian", shortLabel: "Rekap Absen", icon: ClipboardList, roles: ["super admin", "admin", "pimpinan", "guru pondok", "pondok"] },
"""

for i in range(len(lines)):
    if 'id: "jurnal_pengajian"' in lines[i]:
        lines.insert(i + 1, new_menus)
        break

# Also, update sidebar filter strings
for i in range(len(lines)):
    if '"pengajian materi target capaian"' in lines[i]:
        lines[i] = lines[i].replace('"pengajian materi target capaian"', '"pengajian materi target capaian jurnal absensi rekap"')

import_components = """import RekapJurnalPengajianPanel from "./components/RekapJurnalPengajianPanel";
import RekapAbsensiPengajianPanel from "./components/RekapAbsensiPengajianPanel";
"""

for i in range(len(lines)):
    if 'import JurnalPengajianPanel' in lines[i]:
        lines.insert(i + 1, import_components)
        break

render_components = """            {activeTab === "rekap_jurnal" && (
              <div className="w-full">
                <RekapJurnalPengajianPanel
                  recitationClasses={recitationClasses}
                  onTriggerNotification={triggerNotification}
                />
              </div>
            )}
            {activeTab === "rekap_absensi" && (
              <div className="w-full">
                <RekapAbsensiPengajianPanel
                  recitationClasses={recitationClasses}
                  onTriggerNotification={triggerNotification}
                />
              </div>
            )}
"""

for i in range(len(lines)):
    if '{activeTab === "jurnal_pengajian" && (' in lines[i]:
        lines.insert(i, render_components)
        break

with open("src/App.tsx", "w") as f:
    f.writelines(lines)
