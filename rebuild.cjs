const fs = require('fs');

const content = fs.readFileSync('src/components/RegistrationForm.tsx.bak', 'utf-8');

// 1. Replace steps array
let newContent = content.replace(
  /const steps = \[\s*\{\s*num: 1, name: "Data Diri", icon: User\s*},\s*\{\s*num: 2, name: "Alamat Rumah", icon: MapPin\s*},\s*\{\s*num: 3, name: "Orang Tua & Sambung", icon: Users\s*},\s*\{\s*num: 4, name: "Konfirmasi", icon: CheckCircle2\s*},\s*\];/,
  `const steps = [
    { num: 1, name: "Cek Identitas", id: "01" },
    { num: 2, name: "Data Pribadi", id: "02" },
    { num: 3, name: "Keluarga", id: "03" },
    { num: 4, name: "Alamat", id: "04" },
  ];`
);

// 2. Rewrite validateStep
const oldValidate = `if (currentStep === 1) {
      // Step 1: Personal Data
      const fields: (keyof SantriData)[] = ["kategori", "jenis_kelamin", "nama_lengkap", "nama_panggilan", "nik", "tempat_lahir", "tanggal_lahir"];
      if (formData.kategori === "SMP" || formData.kategori === "SMA") {
        fields.push("nisn");
      }

      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 2) {
      // Step 2: Address Data
      // Auto-pad rt and rw under local vars for validation, and sync state asynchronously
      const padTarget = (val: string) => (val && /^\\d+$/.test(val)) ? val.padStart(3, "0") : val;
      const paddedRt = padTarget(formData.rt || "");
      const paddedRw = padTarget(formData.rw || "");

      if (paddedRt !== formData.rt || paddedRw !== formData.rw) {
        setFormData((prev) => ({
          ...prev,
          rt: paddedRt,
          rw: paddedRw,
        }));
      }

      const fields: (keyof SantriData)[] = ["alamat", "rt", "rw", "desa_kelurahan", "kecamatan", "kabupaten_kota", "provinsi"];
      fields.forEach((f) => {
        const val = f === "rt" ? paddedRt : f === "rw" ? paddedRw : (formData[f] || "") as string;
        const err = validateField(f, val, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    } else if (currentStep === 3) {
      // Step 3: Parents & Connection Address details
      const fields: (keyof SantriData)[] = ["nama_ayah", "nama_ibu", "kelompok_sambung", "desa_sambung", "daerah"];
      fields.forEach((f) => {
        const err = validateField(f, (formData[f] || "") as string, formData.kategori);
        if (err) stepErrors[f] = err;
        touchList.push(f);
      });
    }`;

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
    }`;

newContent = newContent.replace(oldValidate, newValidate);

// 3. Rewrite Submit Handler flow
const oldSubmitFlow = `if (step < 4) {
      const isStepValid = validateStep(step);
      if (isStepValid) {
        setStep((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        triggerShake();
        setSubmitError("Mohon lengkapi semua field wajib sebelum melanjutkan.");
      }
      return;
    }

    if (!isStep2Val) {
      setStep(2);
      return;
    }

    await onSubmit(finalFormData);`;

const newSubmitFlow = `if (step < 4) {
      const isStepValid = validateStep(step);
      if (isStepValid) {
        setStep((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        triggerShake();
        setSubmitError("Mohon lengkapi semua field wajib sebelum melanjutkan.");
      }
      return;
    }

    if (!validateStep(1)) { setStep(1); return; }
    if (!validateStep(2)) { setStep(2); return; }
    if (!validateStep(3)) { setStep(3); return; }
    if (!validateStep(4)) { setStep(4); return; }

    await onSubmit(finalFormData);`;

// Find where submit flow is and replace it. Wait, the oldSubmitFlow might not perfectly match because of some other code.
// Let's use regex for submit flow
newContent = newContent.replace(/if \(step < 4\) \{[\s\S]*?await onSubmit\(finalFormData\);/, newSubmitFlow);

fs.writeFileSync('src/components/RegistrationForm.tsx', newContent);
