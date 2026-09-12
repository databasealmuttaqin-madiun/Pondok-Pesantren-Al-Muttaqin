import fs from 'fs';
let content = fs.readFileSync('src/components/SantriList.tsx', 'utf-8');

content = content.replace(/\| "Sakit" \| "Pulang">/g, '| "Sakit" | "Pulang" | "Haid">');

fs.writeFileSync('src/components/SantriList.tsx', content);
