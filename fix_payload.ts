import fs from 'fs';
let content = fs.readFileSync('src/components/PerizinanPanel.tsx', 'utf-8');

content = content.replace(/\(payload as any\)/g, "(dbPayload as any)");

fs.writeFileSync('src/components/PerizinanPanel.tsx', content);
