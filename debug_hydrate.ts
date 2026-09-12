import fs from 'fs';
const app = fs.readFileSync('src/App.tsx', 'utf-8');
const match = app.match(/const hydrateWithAllStatusSources = \([\s\S]*?return \{[\s\S]*?\};\s*\}\);/);
console.log(match ? match[0] : "Not found");
