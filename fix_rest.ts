import fs from 'fs';
let content = fs.readFileSync('src/components/PerizinanPanel.tsx', 'utf-8');

// FIX executeMarkReturned
const regexMarkReturn = /let updateRes = await supabase\s*\.from\("perizinan"\)\s*\.update\(\{/g;
content = content.replace(regexMarkReturn, `const tableName = item.kategori_izin === "sambang" ? "izin_sambang" : item.kategori_izin === "sakit" ? "izin_sakit" : "izin_haid";
      let updateRes = await supabase
        .from(tableName)
        .update({`);

const regexMarkReturnRetry = /updateRes = await supabase\s*\.from\("perizinan"\)\s*\.update\(\{/g;
content = content.replace(regexMarkReturnRetry, `updateRes = await supabase
          .from(tableName)
          .update({`);

// FIX handleSave (inserting into perizinan -> izin_*)
const regexInsert = /const { data, error } = await supabase\s*\.from\("perizinan"\)\s*\.insert\(\[payload\]\)\s*\.select\(\);/;

const newInsert = `let dbPayload: any = { ...payload };
      if (activeSubMenu === "sambang") {
        dbPayload.tujuan = formTujuan;
        dbPayload.keperluan = formKeperluan;
        dbPayload.penjemput = \`\${formTujuan} | Wali: \${formHubunganWali || "Wali"}\`;
        dbPayload.no_hp_penjemput = formNoHp || null;
      } else if (activeSubMenu === "sakit") {
        dbPayload.diagnosa_keluhan = formDiagnosa;
        dbPayload.lokasi_rawat = formLokasiRawat;
      }
      delete dbPayload.kategori_izin; // handled by table name

      const tableName = activeSubMenu === "sambang" ? "izin_sambang" : activeSubMenu === "sakit" ? "izin_sakit" : "izin_haid";
      const { data, error } = await supabase
        .from(tableName)
        .insert([dbPayload])
        .select();`;
content = content.replace(regexInsert, newInsert);

// FIX executeDelete
const regexDelete = /const { error } = await supabase\s*\.from\("perizinan"\)\s*\.delete\(\)\s*\.eq\("id", item.id\);/;
const newDelete = `const tableName = item.kategori_izin === "sambang" ? "izin_sambang" : item.kategori_izin === "sakit" ? "izin_sakit" : "izin_haid";
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", item.id);`;
content = content.replace(regexDelete, newDelete);

fs.writeFileSync('src/components/PerizinanPanel.tsx', content);
