const fs = require('fs');
let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

const oldHeaderRegex = /<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="registration_form_container">\s*\{\/\* Header section with branding and status \*\/\}\s*<div className="px-6 py-6 pb-2">\s*<h2 className="text-2xl font-bold text-slate-900 mb-6 tracking-tight" id="form-heading">\s*\{initialData \? \`Perbarui Profil: \$\{initialData.nama_lengkap\}\` : "Pendaftaran"\}\s*<\/h2>\s*\{\/\* Progress Tracker \(Chevron Style\) \*\/\}/;

const newHeader = `<div id="registration_form_container" className="space-y-6">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight" id="form-heading">
        {initialData ? \`Perbarui Profil: \${initialData.nama_lengkap}\` : "Pendaftaran"}
      </h2>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header section with branding and status */}
        <div className="px-6 pt-6 pb-2">
          {/* Progress Tracker (Chevron Style) */}`;

content = content.replace(oldHeaderRegex, newHeader);

// Now we need to add an extra </div> at the end to close the new container wrapper.
// Let's find the end of the form.
const endRegex = /<\/div>\s*<\/form>\s*<\/div>\s*\)$/;
const newEnd = `</div>\n      </form>\n      </div>\n    </div>\n  )`;
content = content.replace(endRegex, newEnd);

fs.writeFileSync('src/components/RegistrationForm.tsx', content);
