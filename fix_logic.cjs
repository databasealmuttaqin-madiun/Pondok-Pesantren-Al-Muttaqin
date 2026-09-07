const fs = require('fs');
let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

// Update validateStep
const oldValidateMatch = content.match(/if \(currentStep === 1\) \{[\s\S]*?\} else if \(currentStep === 3\) \{[\s\S]*?\}\n/);
if (oldValidateMatch) {
  const newValidate = `if (currentStep === 1) {
      const fields: (keyof SantriData)[] = ["kategori", "nik"];
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 2) {
      const fields: (keyof SantriData)[] = ["jenis_kelamin", "nama_lengkap", "nama_panggilan", "tempat_lahir", "tanggal_lahir"];
      if (formData.kategori === "SMP" || formData.kategori === "SMA") fields.push("nisn");
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 3) {
      const fields: (keyof SantriData)[] = ["nama_ayah", "nama_ibu", "kelompok_sambung", "desa_sambung", "daerah"];
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 4) {
      const padTarget = (val: string) => (val && /^\\d+$/.test(val)) ? val.padStart(3, "0") : val;
      const paddedRt = padTarget(formData.rt || "");
      const paddedRw = padTarget(formData.rw || "");
      if (paddedRt !== formData.rt || paddedRw !== formData.rw) {
        setFormData((prev) => ({ ...prev, rt: paddedRt, rw: paddedRw }));
      }
      const fields: (keyof SantriData)[] = ["alamat", "rt", "rw", "desa_kelurahan", "kecamatan", "kabupaten_kota", "provinsi"];
      fields.forEach((f) => {
        const val = f === "rt" ? paddedRt : f === "rw" ? paddedRw : (formData[f] || "") as string;
        const err = validateField(f, val, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    }
`;
  content = content.replace(oldValidateMatch[0], newValidate);
}

// Update Submit handler
const submitRegex = /const handleFormSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?await onSubmit\(finalFormData\);\n  \};/;
const newSubmit = `const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalFormData = { ...formData };
    
    // Auto-generate a sequential 10-digit identity number as NPSN for Reguler category
    if (finalFormData.kategori === "Reguler" && !finalFormData.npsn) {
      let nextNpsn = 1000000001;
      
      const regulerStudents = students.filter(
        (s) => s.kategori === "Reguler" && s.npsn && /^\\d{10}$/.test(s.npsn)
      );
      if (regulerStudents.length > 0) {
        const numericNpsns = regulerStudents
          .map((s) => parseInt(s.npsn || "0", 10))
          .filter((num) => !isNaN(num));
          
        if (numericNpsns.length > 0) {
          const maxNpsn = Math.max(...numericNpsns);
          nextNpsn = maxNpsn + 1;
        }
      } else {
        const countReg = students.filter((s) => s.kategori === "Reguler").length;
        nextNpsn = 1000000001 + countReg;
      }
      
      finalFormData.npsn = String(nextNpsn);
      finalFormData.nisn = "";
    }

    if (!validateStep(1)) { setStep(1); return; }
    if (!validateStep(2)) { setStep(2); return; }
    if (!validateStep(3)) { setStep(3); return; }
    if (!validateStep(4)) { setStep(4); return; }
    
    await onSubmit(finalFormData);
  };`;
content = content.replace(submitRegex, newSubmit);

// Update Footer Buttons
const footerRegex = /<div className="mt-8 pt-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">[\s\S]*?<\/form>/;
const newFooter = `<div className="mt-8 pt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={(e) => {
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
                handleFormSubmit(e as any);
              }
            }}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 4 ? (isSubmitting ? "Memproses..." : "Selanjutnya") : "Selanjutnya"}
          </button>
        </div>
      </form>`;
content = content.replace(footerRegex, newFooter);

fs.writeFileSync('src/components/RegistrationForm.tsx', content);
