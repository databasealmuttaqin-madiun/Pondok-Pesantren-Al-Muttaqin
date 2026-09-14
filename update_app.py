import sys

with open("src/App.tsx", "r") as f:
    lines = f.readlines()

import_line = 'import JurnalPengajianPanel from "./components/JurnalPengajianPanel";\n'

for i in range(len(lines)):
    if 'import TargetPengajianPanel' in lines[i]:
        lines.insert(i + 1, import_line)
        break

render_block = """            {activeTab === "jurnal_pengajian" && (
              <div className="w-full">
                <JurnalPengajianPanel
                  currentUserRole={userRole}
                  userTugasTambahan={currentUser?.tugas_tambahan}
                  recitationClasses={recitationClasses}
                  onTriggerNotification={triggerNotification}
                  currentUser={currentUser}
                />
              </div>
            )}
"""

for i in range(len(lines)):
    if '{activeTab === "target_pengajian" && (' in lines[i]:
        # we found target_pengajian
        # look for its end
        pass
    if '            {(activeTab === "nfc_daftar"' in lines[i]:
        lines.insert(i, render_block)
        break

with open("src/App.tsx", "w") as f:
    f.writelines(lines)
