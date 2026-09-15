import re

with open("src/components/SantriList.tsx", "r") as f:
    content = f.read()

# Remove ALAMAT SAMBUNG header
old_headers = """                  <th className="p-4 py-3.5 pl-6">NAMA LENGKAP</th>
                  <th className="p-4 py-3.5">KAMAR & KELAS</th>
                  <th className="p-4 py-3.5">KATEGORI</th>
                  <th className="p-4 py-3.5">ALAMAT SAMBUNG</th>
                  <th className="p-4 py-3.5">STATUS</th>
                  <th className="p-4 py-3.5">JENIS KELAMIN</th>
                  <th className="p-4 py-3.5 text-right pr-6 w-52">AKSI</th>"""

new_headers = """                  <th className="p-4 py-3.5 pl-6">NAMA LENGKAP</th>
                  <th className="p-4 py-3.5">KAMAR & KELAS</th>
                  <th className="p-4 py-3.5">KATEGORI</th>
                  <th className="p-4 py-3.5">STATUS</th>
                  <th className="p-4 py-3.5">JENIS KELAMIN</th>
                  <th className="p-4 py-3.5 text-right pr-6 w-52">AKSI</th>"""

content = content.replace(old_headers, new_headers)

# Remove ALAMAT SAMBUNG cell
old_cell = """                      {/* Destination (Alamat Sambung) */}
                      <td className="p-4 py-3 max-w-xs truncate whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700 text-xs">{s.kelompok_sambung || "-"}</span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">{s.daerah || "-"}</span>
                        </div>
                      </td>"""

content = content.replace(old_cell, "")

# NIK and ID fallbacks removal from Nama Lengkap column
old_name_col = """                      {/* Nama Lengkap & Identifier */}
                      <td className="p-4 py-3 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${bgColor} ${textColor}`}>
                            {getInitials(s.nama_lengkap)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-800 text-sm truncate">{s.nama_lengkap}</span>
                            <span className="text-[10px] text-slate-400 font-mono tracking-wider font-semibold truncate">
                              {(s.kategori === "Reguler" ? s.npsn : s.nisn) || s.nik || "No ID"}
                            </span>
                          </div>
                        </div>
                      </td>"""

new_name_col = """                      {/* Nama Lengkap */}
                      <td className="p-4 py-3 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${bgColor} ${textColor}`}>
                            {getInitials(s.nama_lengkap)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-800 text-sm truncate">{s.nama_lengkap}</span>
                          </div>
                        </div>
                      </td>"""

content = content.replace(old_name_col, new_name_col)


with open("src/components/SantriList.tsx", "w") as f:
    f.write(content)
