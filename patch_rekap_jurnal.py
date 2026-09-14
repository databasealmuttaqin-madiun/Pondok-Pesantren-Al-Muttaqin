import re

with open("src/components/RekapJurnalPengajianPanel.tsx", "r") as f:
    content = f.read()

# Update the query to fetch sesi_mengaji and pengguna (ustaz) relationships
old_select = '.select("*, materi_pengajian(nama_materi, kelompok)")'
new_select = '.select("*, materi_pengajian(nama_materi, kelompok), sesi_mengaji(nama_sesi), pengguna!ustaz_id(nama)")'
content = content.replace(old_select, new_select)

# Add headers
old_header = """                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Tanggal</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Kelompok</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Materi</th>"""

new_header = """                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Tanggal</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Sesi</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Kelompok</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Materi</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Guru/Ustaz</th>"""
content = content.replace(old_header, new_header)

# Add table cells
old_row = """                      <tr key={jurnal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            jurnal.materi_pengajian?.kelompok === 'alquran' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}>
                            {jurnal.materi_pengajian?.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                          {jurnal.materi_pengajian?.nama_materi}
                        </td>"""

new_row = """                      <tr key={jurnal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {jurnal.sesi_mengaji?.nama_sesi || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            jurnal.materi_pengajian?.kelompok === 'alquran' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}>
                            {jurnal.materi_pengajian?.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                          {jurnal.materi_pengajian?.nama_materi}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {jurnal.pengguna?.nama || "-"}
                        </td>"""

content = content.replace(old_row, new_row)
content = content.replace('colSpan={7}', 'colSpan={9}')

with open("src/components/RekapJurnalPengajianPanel.tsx", "w") as f:
    f.write(content)
