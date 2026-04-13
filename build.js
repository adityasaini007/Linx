const fs = require('fs');
const path = require('path');

const SUPPORTED_BROWSERS = ['chrome'];

function clean(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function build(browser) {
  const manifestPath = path.join('manifests', `${browser}.json`);
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: manifests/${browser}.json not found.`);
    process.exit(1);
  }

  const outDir = path.join('dist', browser);
  console.log(`Building ${browser} → ${outDir}/`);

  clean(outDir);
  copyDir('src', outDir);
  fs.copyFileSync(manifestPath, path.join(outDir, 'manifest.json'));

  console.log(`✓ ${browser} done`);
}

const target = process.argv[2];

if (target) {
  if (!SUPPORTED_BROWSERS.includes(target)) {
    console.error(`Error: Unknown browser "${target}". Supported: ${SUPPORTED_BROWSERS.join(', ')}`);
    process.exit(1);
  }
  build(target);
} else {
  for (const browser of SUPPORTED_BROWSERS) {
    build(browser);
  }
}
