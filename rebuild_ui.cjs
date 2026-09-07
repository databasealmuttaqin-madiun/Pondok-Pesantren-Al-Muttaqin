const fs = require('fs');

const content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

// The file currently has:
// step === 1 (old Data Diri)
// step === 2 (old Alamat)
// step === 3 (old Ortu)
// step === 4 (old Konfirmasi)

const step1Regex = /\{step === 1 && \(\s*<motion\.div[\s\S]*?(?=\{step === 2 &&)/;
const step2Regex = /\{step === 2 && \(\s*<motion\.div[\s\S]*?(?=\{step === 3 &&)/;
const step3Regex = /\{step === 3 && \(\s*<motion\.div[\s\S]*?(?=\{step === 4 &&)/;
const step4Regex = /\{step === 4 && \(\s*<motion\.div[\s\S]*?(?=<\/AnimatePresence>)/;

const step1Match = content.match(step1Regex);
const step2Match = content.match(step2Regex);
const step3Match = content.match(step3Regex);
const step4Match = content.match(step4Regex);

if (!step1Match || !step2Match || !step3Match || !step4Match) {
  console.log("Failed to match steps");
  process.exit(1);
}

let oldStep1 = step1Match[0];
let oldStep2 = step2Match[0];
let oldStep3 = step3Match[0];
let oldStep4 = step4Match[0];

// NEW STEP 1: Cek Identitas
const newStep1 = `{step === 1 && (
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

// NEW STEP 2: Data Pribadi (everything from old Step 1, minus NIK and Kategori)
// We'll just take oldStep1, change `step === 1` to `step === 2`, key="step2", change title, and remove NIK and Kategori blocks.
let newStep2 = oldStep1
  .replace('step === 1 &&', 'step === 2 &&')
  .replace('key="step1"', 'key="step2"')
  .replace(/<span className="w-1.5 h-1.5 bg-sky-500 rounded-full"><\/span> Data Identitas Diri/, '<span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span> Data Pribadi');

// Remove Kategori block
newStep2 = newStep2.replace(/\{\/\* Kategori \*\/\}(.|\n)*?(?=\{\/\* Nama Lengkap & Panggilan \*\/)/g, '');

// Remove NIK block
newStep2 = newStep2.replace(/\{\/\* NIK \*\/\}(.|\n)*?(?=\{\/\* Email \& Nomor HP \*\/\})/g, '');


// NEW STEP 3: Keluarga (Same as old Step 3)
let newStep3 = oldStep3;

// NEW STEP 4: Alamat (Old Step 2)
let newStep4 = oldStep2
  .replace('step === 2 &&', 'step === 4 &&')
  .replace('key="step2"', 'key="step4"');

const newUI = newStep1 + '\n' + newStep2 + '\n' + newStep3 + '\n' + newStep4 + '\n';

// Replace the entire block in content
let finalContent = content.replace(
  /\{step === 1 && \(\s*<motion\.div[\s\S]*?(?=<\/AnimatePresence>)/,
  newUI
);

// We need to update the bottom navigation bar (Selanjutnya button) to match the new image style
// Currently it's a fixed div at the bottom of the form.
const oldFooterRegex = /<div className="mt-8 pt-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">[\s\S]*?<\/form>/;
const newFooter = `<div className="mt-8 pt-5 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                if (step < 4) {
                  const isStepValid = validateStep(step);
                  if (isStepValid) {
                    setStep((prev) => prev + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    triggerShake();
                    setSubmitError("Mohon lengkapi semua field wajib sebelum melanjutkan.");
                  }
                } else {
                  handleFormSubmit(new Event('submit') as any);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
            >
              {step === 4 ? (isSubmitting ? "Memproses..." : "Daftar") : "Selanjutnya"}
            </button>
          </div>
        </form>`;

finalContent = finalContent.replace(oldFooterRegex, newFooter);

fs.writeFileSync('src/components/RegistrationForm.tsx', finalContent);

