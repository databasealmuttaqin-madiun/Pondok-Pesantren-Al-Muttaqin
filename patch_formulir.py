import re

with open("src/components/SantriList.tsx", "r") as f:
    content = f.read()

old_formulir = """                        <div className="space-y-6">
                          {/* Top row with photo */}
                          <div className="flex flex-col md:flex-row gap-6 items-start">
                            {/* Photo (Red background for authentic Indonesian passphoto aspect) */}
                            <div className="flex flex-col items-center gap-1 shrink-0 self-center md:self-start">
                              <div className="w-[110px] h-[145px] bg-[#c22026] rounded border border-gray-300 shadow-sm flex items-center justify-center overflow-hidden relative">
                                {selectedStudent.foto ? (
                                  <img src={selectedStudent.foto} alt="Foto Santri" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-5xl filter saturate-75 drop-shadow-md select-none">
                                    {isFemale ? "🧕" : "👳"}
                                  </span>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-black/40 text-[7px] text-white py-1 font-bold tracking-widest text-center uppercase">
                                  PASFOTO
                                </div>
                              </div>
                              <span className="text-[8px] font-mono font-bold text-gray-400 uppercase tracking-widest">3x4 Resmi</span>
                            </div>

                            {/* A. DATA SISWA list */}
                            <div className="flex-1 w-full space-y-0.5">
                              {renderFormRow("Nama Lengkap", selectedStudent.nama_lengkap)}
                              {renderFormRow("Nama Panggilan", selectedStudent.nama_panggilan)}
                              {renderFormRow("Jenis Kelamin", isFemale ? "Perempuan" : "Laki-laki")}
                              {renderFormRow("Tempat, Tgl Lahir", `${selectedStudent.tempat_lahir}, ${selectedStudent.tanggal_lahir ? formatIndoDate(selectedStudent.tanggal_lahir) : "—"}`)}
                              {renderFormRow("Kategori Data", selectedStudent.kategori)}
                              {renderFormRow("NIK", selectedStudent.nik)}
                              {renderFormRow(selectedStudent.kategori === "Reguler" ? "NPSN" : "NISN", selectedStudent.kategori === "Reguler" ? selectedStudent.npsn : selectedStudent.nisn)}
                            </div>
                          </div>

                          {/* B. STATUS PENDIDIKAN & ASRAMA */}
                          <div>
                            <div className="bg-[#104e7a] text-white py-1.5 px-3 rounded flex items-center gap-2 text-[11px] md:text-xs font-bold shadow-sm mb-3">
                              <GraduationCap className="w-4 h-4 text-sky-200" />
                              <span>B. STATUS PENDIDIKAN & ASRAMA</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5">
                              <div>
                                {renderFormRow("Kamar", selectedStudent.kamar)}
                                {renderFormRow("Status", selectedStudent.status || "Aktif")}
                              </div>
                              <div>
                                {renderFormRow("Kelas Pengajian", selectedStudent.kelas_pengajian)}
                                {renderFormRow("Kelas Sekolah", selectedStudent.kelas_sekolah)}
                              </div>
                            </div>
                          </div>

                          {/* C. ALAMAT LENGKAP */}
                          <div>
                            <div className="bg-[#104e7a] text-white py-1.5 px-3 rounded flex items-center gap-2 text-[11px] md:text-xs font-bold shadow-sm mb-3">
                              <Home className="w-4 h-4 text-sky-200" />
                              <span>C. ALAMAT LENGKAP</span>
                            </div>
                            <div className="space-y-0.5">
                              {renderFormRow("Alamat Lengkap", selectedStudent.alamat)}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5 mt-0.5">
                              <div>
                                {renderFormRow("RT / RW", `${selectedStudent.rt || "—"} / ${selectedStudent.rw || "—"}`)}
                                {renderFormRow("Desa/Kelurahan", selectedStudent.desa_kelurahan)}
                              </div>
                              <div>
                                {renderFormRow("Kecamatan", selectedStudent.kecamatan)}
                                {renderFormRow("Kab./Kota", selectedStudent.kabupaten_kota)}
                                {renderFormRow("Provinsi", selectedStudent.provinsi)}
                              </div>
                            </div>
                          </div>
                          
                          {/* D. ALAMAT SAMBUNG */}
                          <div>
                            <div className="bg-[#104e7a] text-white py-1.5 px-3 rounded flex items-center gap-2 text-[11px] md:text-xs font-bold shadow-sm mb-3">
                              <MapPin className="w-4 h-4 text-sky-200" />
                              <span>D. ALAMAT SAMBUNG</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5">
                              <div>
                                {renderFormRow("Kelompok Sambung", selectedStudent.kelompok_sambung)}
                                {renderFormRow("Daerah", selectedStudent.daerah)}
                              </div>
                              <div>
                                {renderFormRow("Desa Sambung", selectedStudent.desa_sambung)}
                              </div>
                            </div>
                          </div>

                          {/* E. ORANG TUA */}
                          <div>
                            <div className="bg-[#104e7a] text-white py-1.5 px-3 rounded flex items-center gap-2 text-[11px] md:text-xs font-bold shadow-sm mb-2">
                              <Users className="w-4 h-4 text-sky-200" />
                              <span>E. ORANG TUA & WA</span>
                            </div>
                            <div className="grid grid-cols-1 gap-y-0.5">
                              {renderFormRow("Nama Ayah", selectedStudent.nama_ayah)}
                              {renderFormRow("Nama Ibu", selectedStudent.nama_ibu)}
                              {renderFormRow("No. WA Ortu", selectedStudent.no_hp_ortu || "-")}
                            </div>
                          </div>

                          {/* Cursive italic fine footer styling */}
                          <div className="text-right text-[9px] text-gray-400 italic pt-6 border-t border-gray-100 select-none">
                            Dicetak pada tanggal: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        </div>"""

new_formulir = """                        <div className="space-y-6">
                          {/* Top row with photo */}
                          <div className="flex flex-col md:flex-row gap-6 items-start">
                            {/* Photo (Red background for authentic Indonesian passphoto aspect) */}
                            <div className="flex flex-col items-center gap-1 shrink-0 self-center md:self-start">
                              <div className="w-[110px] h-[145px] bg-[#c22026] rounded border border-gray-300 shadow-sm flex items-center justify-center overflow-hidden relative">
                                {selectedStudent.foto ? (
                                  <img src={selectedStudent.foto} alt="Foto Santri" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-5xl filter saturate-75 drop-shadow-md select-none">
                                    {isFemale ? "🧕" : "👳"}
                                  </span>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-black/40 text-[7px] text-white py-1 font-bold tracking-widest text-center uppercase">
                                  PASFOTO
                                </div>
                              </div>
                              <span className="text-[8px] font-mono font-bold text-gray-400 uppercase tracking-widest">3x4 Resmi</span>
                            </div>

                            {/* A. DATA SISWA list */}
                            <div className="flex-1 w-full space-y-0.5">
                              {renderFormRow("Nama Lengkap", selectedStudent.nama_lengkap)}
                              {renderFormRow("Jenis Kelamin", isFemale ? "Perempuan" : "Laki-laki")}
                              {renderFormRow("Kategori Data", selectedStudent.kategori)}
                            </div>
                          </div>

                          {/* Cursive italic fine footer styling */}
                          <div className="text-right text-[9px] text-gray-400 italic pt-6 border-t border-gray-100 select-none">
                            Dicetak pada tanggal: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        </div>"""

content = content.replace(old_formulir, new_formulir)

with open("src/components/SantriList.tsx", "w") as f:
    f.write(content)
