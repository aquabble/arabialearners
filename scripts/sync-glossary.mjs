import fs from 'fs';
import path from 'path';
const src = path.resolve('src/lib/Glossary.json');
const destDir = path.resolve('public');
const dest = path.join(destDir, 'Glossary.json');
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[sync-glossary] Copied ${src} -> ${dest}`);
