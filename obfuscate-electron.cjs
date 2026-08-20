const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const srcDir = path.join(__dirname, 'electron');
const destDir = path.join(__dirname, 'build-electron');

// Ensure destination directory is clean
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy resources
console.log('Copying electron source files to build-electron...');
copyRecursiveSync(srcDir, destDir);

// Obfuscate specific JS/CJS files
const filesToObfuscate = ['main.cjs', 'dbInit.cjs', 'preload.cjs'];

filesToObfuscate.forEach((fileName) => {
  const filePath = path.join(destDir, fileName);
  if (!fs.existsSync(filePath)) return;

  console.log(`Obfuscating ${fileName}...`);
  const rawCode = fs.readFileSync(filePath, 'utf8');
  
  const obfuscatedResult = JavaScriptObfuscator.obfuscate(rawCode, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayCallsTransform: false,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false,
    // Preserve string literals matching the IPC routing channels
    reservedStrings: [
      '^lic-.*',
      '^db-.*',
      '^win-.*',
      '^upd-.*',
      'electronAPI'
    ]
  });

  fs.writeFileSync(filePath, obfuscatedResult.getObfuscatedCode(), 'utf8');
});

console.log('Electron files obfuscated successfully.');
