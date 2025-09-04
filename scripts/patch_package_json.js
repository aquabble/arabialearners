// scripts/patch_package_json.js
// Injects predev/prebuild hooks to run apply_all_patches.js automatically.
const fs = require('fs');
const path = require('path');
const pkgPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found'); process.exit(0);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const hook = "node scripts/apply_all_patches.js || true";
pkg.scripts.predev = hook;
pkg.scripts.prebuild = hook;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
console.log('Added predev/prebuild to package.json');
