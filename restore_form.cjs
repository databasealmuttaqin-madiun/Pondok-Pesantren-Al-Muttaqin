const fs = require('fs');
let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

const regex = /<\/ul>\s*<\/div>\s*<\/div>\s*<div className="space-y-1\.5">/;

const replacement = `</ul>
        </div>
      </div>
      
      <form onSubmit={handleFormSubmit}>
        <div className="p-5 md:p-8">
          <AnimatePresence mode="wait">
          
          {/* STEP 1: CEK IDENTITAS */}
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
                
                <div className="space-y-1.5">`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/components/RegistrationForm.tsx', content);
