import re

with open("src/components/JurnalPengajianPanel.tsx", "r") as f:
    content = f.read()

old_payload = """      const absensiPayloads = Object.keys(absensiMap).map(sId => ({
        jurnal_id: jurnalId,
        santri_id: sId,
        status: absensiMap[sId].status,
        keterangan: absensiMap[sId].keterangan
      }));"""

new_payload = """      const absensiPayloads = Object.keys(absensiMap).map(sId => ({
        jurnal_id: jurnalId,
        santri_id: sId,
        sesi_id: selectedSesi || null,
        status: absensiMap[sId].status,
        keterangan: absensiMap[sId].keterangan
      }));"""

content = content.replace(old_payload, new_payload)

with open("src/components/JurnalPengajianPanel.tsx", "w") as f:
    f.write(content)
