import re

with open("src/components/RekapAbsensiPengajianPanel.tsx", "r") as f:
    content = f.read()

old_thead = """              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 w-12">No</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 sticky left-12 bg-slate-50 dark:bg-slate-800 z-10 min-w-[200px]">Nama Santri</th>
                  {jurnals.map((j) => {
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
                  })}
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-blue-50 dark:bg-blue-900/20">H</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-red-50 dark:bg-red-900/20">A</th>
                </tr>
              </thead>"""

new_thead = """              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-xs font-semibold uppercase">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 w-12 align-middle">No</th>
                  <th rowSpan={2} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 sticky left-12 bg-slate-50 dark:bg-slate-800 z-10 min-w-[200px] align-middle">Nama Santri</th>
                  {(() => {
                    const grouped: {tanggal: string, count: number}[] = [];
                    jurnals.forEach(j => {
                      const existing = grouped.find(g => g.tanggal === j.tanggal);
                      if (existing) {
                        existing.count++;
                      } else {
                        grouped.push({ tanggal: j.tanggal, count: 1 });
                      }
                    });
                    
                    return grouped.map(g => {
                      const dateObj = new Date(g.tanggal);
                      return (
                        <th key={g.tanggal} colSpan={g.count} className="px-2 py-2 border-b border-slate-200 dark:border-slate-800 text-center min-w-[50px] border-l first:border-l-0">
                          <span title={g.tanggal} className="font-semibold">{dateObj.getDate()}</span>
                        </th>
                      );
                    });
                  })()}
                  <th rowSpan={2} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-blue-50 dark:bg-blue-900/20 align-middle">H</th>
                  <th rowSpan={2} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-center bg-red-50 dark:bg-red-900/20 align-middle">A</th>
                </tr>
                <tr>
                  {jurnals.map((j) => (
                    <th key={j.key} className="px-1 py-1.5 border-b border-slate-200 dark:border-slate-800 text-center border-l first:border-l-0">
                      <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 whitespace-nowrap overflow-hidden max-w-[60px] text-ellipsis inline-block" title={j.nama_sesi}>
                        {j.nama_sesi}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>"""

content = content.replace(old_thead, new_thead)

with open("src/components/RekapAbsensiPengajianPanel.tsx", "w") as f:
    f.write(content)
