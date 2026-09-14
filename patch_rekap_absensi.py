import re

with open("src/components/RekapAbsensiPengajianPanel.tsx", "r") as f:
    content = f.read()

# Update the query to fetch sesi_id and sesi_mengaji(nama_sesi)
old_query = """      const { data: jurnalData, error: jurnalError } = await supabase
        .from("jurnal_pengajian")
        .select("id, tanggal")
        .eq("kelas_pengajian", selectedClass)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .order("tanggal", { ascending: true });"""

new_query = """      const { data: jurnalData, error: jurnalError } = await supabase
        .from("jurnal_pengajian")
        .select("id, tanggal, sesi_id, sesi_mengaji(nama_sesi)")
        .eq("kelas_pengajian", selectedClass)
        .gte("tanggal", startDate)
        .lte("tanggal", endDate)
        .order("tanggal", { ascending: true });"""

content = content.replace(old_query, new_query)

# Update the grouping logic
old_grouping = """      const uniqueDates = Array.from(new Set(loadedJurnals.map(j => j.tanggal))).sort();
      
      const jurnalsByDate: any[] = uniqueDates.map(date => ({
        tanggal: date,
        jurnal_ids: loadedJurnals.filter(j => j.tanggal === date).map(j => j.id)
      }));

      setJurnals(jurnalsByDate);"""

new_grouping = """      // Group by tanggal AND sesi_id
      const uniqueSessions = [];
      const sessionMap = new Map();
      
      loadedJurnals.forEach(j => {
        const key = `${j.tanggal}_${j.sesi_id || 'none'}`;
        if (!sessionMap.has(key)) {
          sessionMap.set(key, {
            key,
            tanggal: j.tanggal,
            sesi_id: j.sesi_id,
            nama_sesi: j.sesi_mengaji?.nama_sesi || "-",
            jurnal_ids: []
          });
          uniqueSessions.push(sessionMap.get(key));
        }
        sessionMap.get(key).jurnal_ids.push(j.id);
      });

      // Sort by date then session
      uniqueSessions.sort((a, b) => {
        if (a.tanggal === b.tanggal) {
          return (a.sesi_id || 0) - (b.sesi_id || 0);
        }
        return a.tanggal.localeCompare(b.tanggal);
      });

      setJurnals(uniqueSessions);"""

content = content.replace(old_grouping, new_grouping)

# Update the absensi mapping logic to use key instead of just tanggal
old_mapping = """        absData?.forEach(abs => {
          if (!newAbsMap[abs.santri_id]) newAbsMap[abs.santri_id] = {};
          
          // find the date for this jurnal
          const jurnal = loadedJurnals.find(j => j.id === abs.jurnal_id);
          if (jurnal) {
             // what if multiple jurnals on the same date?
             // we will just overwrite with latest or we can merge. We just overwrite for now.
             newAbsMap[abs.santri_id][jurnal.tanggal] = abs.status;
          }
        });"""

new_mapping = """        absData?.forEach(abs => {
          if (!newAbsMap[abs.santri_id]) newAbsMap[abs.santri_id] = {};
          
          const jurnal = loadedJurnals.find(j => j.id === abs.jurnal_id);
          if (jurnal) {
             const key = `${jurnal.tanggal}_${jurnal.sesi_id || 'none'}`;
             newAbsMap[abs.santri_id][key] = abs.status;
          }
        });"""

content = content.replace(old_mapping, new_mapping)

# Update the table headers
old_thead = """                  {jurnals.map((j: any) => {
                    const dateObj = new Date(j.tanggal);
                    return (
                      <th key={j.tanggal} className="px-2 py-3 border-b border-slate-200 dark:border-slate-800 text-center min-w-[40px]" title={j.tanggal}>
                        {dateObj.getDate()}
                      </th>
                    );
                  })}"""

new_thead = """                  {jurnals.map((j: any) => {
                    const dateObj = new Date(j.tanggal);
                    return (
                      <th key={j.key} className="px-2 py-2 border-b border-slate-200 dark:border-slate-800 text-center min-w-[50px]">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span title={j.tanggal} className="font-semibold">{dateObj.getDate()}</span>
                          <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 whitespace-nowrap overflow-hidden max-w-[60px] text-ellipsis" title={j.nama_sesi}>
                            {j.nama_sesi}
                          </span>
                        </div>
                      </th>
                    );
                  })}"""

content = content.replace(old_thead, new_thead)

# Update the table body mapping
old_tbody_mapping = """                        {jurnals.map((j) => {
                          const status = santri.id && absensiMap[santri.id] ? absensiMap[santri.id][j.tanggal] : null;
                          if (status === 'hadir') hadirCount++;
                          if (status === 'alpa') alpaCount++;
                          
                          return (
                            <td key={j.tanggal} className="px-1 py-3 text-center border-r border-slate-50 dark:border-slate-800/50">"""

new_tbody_mapping = """                        {jurnals.map((j) => {
                          const status = santri.id && absensiMap[santri.id] ? absensiMap[santri.id][j.key] : null;
                          if (status === 'hadir') hadirCount++;
                          if (status === 'alpa') alpaCount++;
                          
                          return (
                            <td key={j.key} className="px-1 py-3 text-center border-r border-slate-50 dark:border-slate-800/50">"""

content = content.replace(old_tbody_mapping, new_tbody_mapping)

with open("src/components/RekapAbsensiPengajianPanel.tsx", "w") as f:
    f.write(content)
