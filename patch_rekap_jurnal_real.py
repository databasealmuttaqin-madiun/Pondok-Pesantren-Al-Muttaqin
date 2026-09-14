import re

with open("src/components/RekapJurnalPengajianPanel.tsx", "r") as f:
    content = f.read()

old_thead = """<thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Tanggal</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Materi</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Hal Mulai</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Hal Selesai</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Status</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Catatan</th>
                </tr>
              </thead>"""

new_thead = """<thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Tanggal</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Sesi</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Materi</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Guru/Ustaz</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Hal Mulai</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Hal Selesai</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Status</th>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Catatan</th>
                </tr>
              </thead>"""

content = content.replace(old_thead, new_thead)

# Now for the tbody
old_tbody = """jurnals.map((jurnal) => (
                    <tr key={jurnal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 whitespace-nowrap">{jurnal.tanggal}</td>
                      <td className="px-4 py-3">
                        {jurnal.materi_pengajian?.nama_materi || "-"} 
                        {jurnal.materi_pengajian?.kelompok ? ` (${jurnal.materi_pengajian.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"})` : ""}
                      </td>
                      <td className="px-4 py-3 text-center">{jurnal.realisasi_halaman_mulai}</td>
                      <td className="px-4 py-3 text-center">{jurnal.realisasi_halaman_selesai}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          jurnal.status_capaian === 'TERCAPAI' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {jurnal.status_capaian}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{jurnal.catatan_kendala || "-"}</td>
                    </tr>
                  ))"""

new_tbody = """jurnals.map((jurnal) => (
                    <tr key={jurnal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 whitespace-nowrap">{jurnal.tanggal}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                        {jurnal.sesi_mengaji?.nama_sesi || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {jurnal.materi_pengajian?.nama_materi || "-"} 
                        {jurnal.materi_pengajian?.kelompok ? ` (${jurnal.materi_pengajian.kelompok === 'alquran' ? "Al-Qur'an" : "Himpunan"})` : ""}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {jurnal.pengguna?.nama || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">{jurnal.realisasi_halaman_mulai}</td>
                      <td className="px-4 py-3 text-center">{jurnal.realisasi_halaman_selesai}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          jurnal.status_capaian === 'TERCAPAI' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {jurnal.status_capaian}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{jurnal.catatan_kendala || "-"}</td>
                    </tr>
                  ))"""

content = content.replace(old_tbody, new_tbody)
content = content.replace('colSpan={6}', 'colSpan={8}')

with open("src/components/RekapJurnalPengajianPanel.tsx", "w") as f:
    f.write(content)
