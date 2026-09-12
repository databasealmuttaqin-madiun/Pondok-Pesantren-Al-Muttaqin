import fs from 'fs';
let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

// 1. Add status to initialization from initialData
content = content.replace(/kamar: initialData\.kamar \|\| "",/g, 
  'status: initialData.status || "Aktif",\n        kamar: initialData.kamar || "",');

// 2. Add status to empty form initialization
content = content.replace(/kamar: "",/g,
  'status: "Aktif",\n      kamar: "",');

// 3. Add UI field
const fieldRegex = /(<div className="grid grid-cols-1 md:grid-cols-3 gap-3">[\s\S]*?<div className="space-y-1">[\s\S]*?<label htmlFor="kamar"[\s\S]*?<\/select>\n\s*<\/div>)/;

const newField = `$1

                  {/* Status Selection */}
                  <div className="space-y-1">
                    <label htmlFor="status" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Status Siswa
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status || "Aktif"}
                      onChange={handleChange}
                      className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Sakit">Sakit</option>
                      <option value="Pulang">Pulang</option>
                      <option value="Haid">Haid</option>
                    </select>
                  </div>`;

content = content.replace(fieldRegex, newField);

fs.writeFileSync('src/components/RegistrationForm.tsx', content);
