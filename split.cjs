const fs = require('fs');

let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

const s1Start = content.indexOf('{/* STEP 1: PERSONAL DETAILS */}');
const s2Start = content.indexOf('{/* STEP 2: ADDRESS */}');
const s3Start = content.indexOf('{/* STEP 3: PARENTS & CONNECTION ADDRESS */}');
const s4Start = content.indexOf('{/* STEP 4: REVIEW & CONFIRM */}');
const endIdx = content.indexOf('</AnimatePresence>');

let oldStep1 = content.slice(s1Start, s2Start);
let oldStep2 = content.slice(s2Start, s3Start);
let oldStep3 = content.slice(s3Start, s4Start);
let oldStep4 = content.slice(s4Start, endIdx);

// Convert oldStep1 to newStep2
let newStep2 = oldStep1
  .replace('step === 1 &&', 'step === 2 &&')
  .replace('key="step1"', 'key="step2"')
  .replace('Data Identitas Diri', 'Data Pribadi')
  .replace('{/* STEP 1: PERSONAL DETAILS */}', '{/* STEP 2: DATA PRIBADI */}');

// Remove Kategori block
newStep2 = newStep2.replace(/\{\/\* Kategori \*\/\}(.|\n)*?(?=\{\/\* Nama Lengkap & Panggilan \*\/)/g, '');
// Remove NIK block
newStep2 = newStep2.replace(/\{\/\* NIK \*\/\}(.|\n)*?(?=\{\/\* Email \& Nomor HP \*\/\})/g, '');

const newStep1 = `{/* STEP 1: CEK IDENTITAS */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 relative">
                  <label className="text-sm font-medium text-slate-700">
                    Jenis Identitas<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none text-slate-800 font-medium">
                      <option value="NIK">NIK</option>
                      <option value="NISN">NISN</option>
                      <option value="NPSN">NPSN</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Nomor Identitas<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nik}
                    onChange={(e) => setFormData(prev => ({ ...prev, nik: e.target.value.replace(/[^0-9]/g, "").slice(0, 16) }))}
                    placeholder="Nomor Identitas"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium"
                  />
                  {formData.nik && formData.nik.length !== 16 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> NIK harus 16 digit.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 relative">
                  <label className="text-sm font-medium text-slate-700">
                    Daftar Sebagai<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.kategori}
                      onChange={(e) => setFormData(prev => ({ ...prev, kategori: e.target.value as any }))}
                      className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none text-slate-800 font-medium"
                    >
                      <option value="" disabled>Pilih salah satu opsi</option>
                      <option value="SMP">Santri SMP</option>
                      <option value="SMA">Santri SMA</option>
                      <option value="Reguler">Santri Reguler (Mahasiswa/Umum)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
`;

let newStep4 = oldStep2
  .replace('step === 2 &&', 'step === 4 &&')
  .replace('key="step2"', 'key="step4"')
  .replace('{/* STEP 2: ADDRESS */}', '{/* STEP 4: ADDRESS */}');

const newUI = newStep1 + '\n' + newStep2 + oldStep3 + newStep4;

const before = content.slice(0, s1Start);
const after = content.slice(endIdx);

fs.writeFileSync('src/components/RegistrationForm.tsx', before + newUI + after);

