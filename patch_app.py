import sys

with open("src/App.tsx", "r") as f:
    lines = f.readlines()

new_menus = """    { id: "manajemen_sesi", group: "PLOTTING", isSubmenu: true, subLabel: "Sesi Mengaji", label: "Manajemen Sesi Mengaji", shortLabel: "Sesi", icon: Clock, roles: ["super admin", "admin"] },
"""

for i in range(len(lines)):
    if 'id: "manajemen_pondok"' in lines[i]:
        lines.insert(i + 1, new_menus)
        break

for i in range(len(lines)):
    if '"plotting manajemen pondok sekolah akun pengguna"' in lines[i]:
        lines[i] = lines[i].replace('"plotting manajemen pondok sekolah akun pengguna"', '"plotting manajemen pondok sekolah akun pengguna sesi"')

import_components = """import ManajemenSesiPanel from "./components/ManajemenSesiPanel";
"""

for i in range(len(lines)):
    if 'import ManajemenPenggunaPanel' in lines[i]:
        lines.insert(i + 1, import_components)
        break

render_components = """            {activeTab === "manajemen_sesi" && (
              <div className="w-full">
                <ManajemenSesiPanel />
              </div>
            )}
"""

for i in range(len(lines)):
    if '{activeTab === "pengguna" && (' in lines[i]:
        lines.insert(i, render_components)
        break

with open("src/App.tsx", "w") as f:
    f.writelines(lines)
