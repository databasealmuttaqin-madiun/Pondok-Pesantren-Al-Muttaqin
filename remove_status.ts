import fs from 'fs';
let content = fs.readFileSync('src/components/RegistrationForm.tsx', 'utf-8');

const statusRegex = /\s*\{\/\* Status Selection \*\/\}\s*<div className="space-y-1">\s*<label htmlFor="status"[\s\S]*?<\/select>\s*<\/div>/;

content = content.replace(statusRegex, "");

fs.writeFileSync('src/components/RegistrationForm.tsx', content);
