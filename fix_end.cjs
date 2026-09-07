const fs = require('fs');
let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');
content = content.replace(/-e\s*<\/div>\s*\);\s*\}/, '  </div>\n  );\n}');
fs.writeFileSync('src/components/RegistrationForm.tsx', content);
