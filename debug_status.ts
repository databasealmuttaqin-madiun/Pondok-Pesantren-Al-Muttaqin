import fs from 'fs';
const app = fs.readFileSync('src/App.tsx', 'utf-8');
const match = app.match(/try \{\s*const \[activeSambang, activeSakit, activeHaid\] = await Promise\.all\([\s\S]*?\} catch \(err\) \{/);
console.log(match ? match[0] : "Not found");
