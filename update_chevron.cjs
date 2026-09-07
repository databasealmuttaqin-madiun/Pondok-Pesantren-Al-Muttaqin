const fs = require('fs');
let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

const oldHeaderRegex = /<div className="flex w-full border border-slate-200 rounded-lg overflow-hidden bg-white">[\s\S]*?<\/div>\s*<\/div>/;

const newHeader = `<div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <ul className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {steps.map((s, index) => {
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              
              return (
                <li key={s.num} className="relative flex-1">
                  <button 
                    type="button"
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
                    className="flex w-full items-center px-4 py-4 sm:px-6 hover:bg-slate-50 transition-colors focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className={\`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border \${
                        isActive 
                          ? "border-blue-600 text-blue-600" 
                          : isCompleted
                          ? "border-slate-300 text-slate-700 bg-slate-50"
                          : "border-slate-300 text-slate-400"
                      }\`}>
                        <span className="text-sm font-medium">0{s.num}</span>
                      </div>
                      <span className={\`text-sm font-medium \${
                        isActive ? "text-blue-600" : isCompleted ? "text-slate-700" : "text-slate-500"
                      }\`}>
                        {s.name}
                      </span>
                    </div>
                  </button>
                  
                  {/* Arrow separator for md screens and up */}
                  {index !== steps.length - 1 ? (
                    <div className="hidden md:block absolute right-0 top-0 h-full w-5" aria-hidden="true">
                      <svg className="h-full w-full text-slate-200" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                        <path d="M0 -2L20 40L0 82" vectorEffect="non-scaling-stroke" stroke="currentcolor" strokeLinejoin="round" strokeWidth="1" />
                      </svg>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>`;

content = content.replace(oldHeaderRegex, newHeader);
fs.writeFileSync('src/components/RegistrationForm.tsx', content);
