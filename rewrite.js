const fs = require('fs');

const oldContent = fs.readFileSync('src/components/RegistrationForm.tsx.bak', 'utf-8');

// The new steps array
const newStepsArr = `  const steps = [
    { num: 1, name: "Cek Identitas", id: "01" },
    { num: 2, name: "Data Pribadi", id: "02" },
    { num: 3, name: "Keluarga", id: "03" },
    { num: 4, name: "Alamat", id: "04" },
  ];`;

// We'll just replace the whole return statement
const returnRegex = /return \(\s*<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="registration_form_container">[\s\S]*?(?=\nexport default)/;

// Wait, the old file exports at the end, but the function closes before export. Or maybe export default function is at the top.
// Let's check where the component starts and ends.
