const fs = require('fs');

let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

// Replace the steps array
const oldStepsRegex = /const steps = \[\s*\{\s*num: 1, name: "Data Diri", icon: User \},\s*\{\s*num: 2, name: "Alamat Rumah", icon: MapPin \},\s*\{\s*num: 3, name: "Orang Tua & Sambung", icon: Users \},\s*\{\s*num: 4, name: "Konfirmasi", icon: CheckCircle2 \},\s*\];/;
const newSteps = `const steps = [
    { num: 1, name: "Cek Identitas" },
    { num: 2, name: "Data Pribadi" },
    { num: 3, name: "Keluarga" },
    { num: 4, name: "Alamat" },
  ];`;
content = content.replace(oldStepsRegex, newSteps);

// Replace the header UI
const oldHeaderRegex = /<div className="bg-\[#91d1fa\] px-5 py-4 text-\[#041e49\] relative">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newHeader = `<div className="px-6 py-6 pb-2">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 tracking-tight" id="form-heading">
          {initialData ? \`Perbarui Profil: \${initialData.nama_lengkap}\` : "Pendaftaran"}
        </h2>
        
        {/* Progress Tracker (Chevron Style) */}
        <div className="flex w-full border border-slate-200 rounded-lg overflow-hidden bg-white">
          {steps.map((s, index) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            const isPast = isCompleted || isActive;
            
            return (
              <div 
                key={s.num} 
                onClick={() => {
                  if (s.num < step) {
                    setStep(s.num);
                  } else if (s.num > step) {
                    let valid = true;
                    for (let check = step; check < s.num; check++) {
                      if (!validateStep(check)) {
                        valid = false;
                        break;
                      }
                    }
                    if (valid) setStep(s.num);
                  }
                }}
                className={\`flex-1 relative flex items-center justify-center py-3 px-4 cursor-pointer transition-colors \${
                  index !== 0 ? "border-l border-slate-200" : ""
                }\`}
              >
                {/* Chevron Shape (for borders) - using clip-path or absolute borders */}
                {index !== 0 && (
                  <div className="absolute left-0 top-0 bottom-0 w-4 bg-white" style={{ 
                    clipPath: "polygon(0 0, 100% 50%, 0 100%, 1px 100%, calc(100% - 1px) 50%, 1px 0)"
                  }} />
                )}
                
                <div className="flex items-center gap-3 z-10">
                  <div className={\`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border \${
                    isActive 
                      ? "border-blue-600 text-blue-600" 
                      : isCompleted
                      ? "border-slate-300 text-slate-700 bg-slate-50"
                      : "border-slate-300 text-slate-400"
                  }\`}>
                    0{s.num}
                  </div>
                  <span className={\`text-sm font-medium hidden md:block \${
                    isActive ? "text-blue-600" : isCompleted ? "text-slate-700" : "text-slate-500"
                  }\`}>
                    {s.name}
                  </span>
                </div>
                
                {/* Right chevron overlay */}
                {index !== steps.length - 1 && (
                  <div className="absolute -right-3 top-0 bottom-0 w-3 z-20 overflow-hidden">
                    <div className="w-6 h-6 border-t border-r border-slate-200 bg-white transform rotate-45 absolute -left-4 top-1/2 -translate-y-1/2"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>`;

content = content.replace(oldHeaderRegex, newHeader);

fs.writeFileSync('src/components/RegistrationForm.tsx', content);
