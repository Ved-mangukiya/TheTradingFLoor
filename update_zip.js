const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[PACK] Packaging The Trading Floor Championship into portable ZIP...');

const zipPath = path.join(__dirname, 'the-trading-floor.zip');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Use PowerShell Compress-Archive on Windows
const cmd = `powershell -NoProfile -Command "Get-ChildItem -Path . -Exclude 'node_modules', '.git', 'logs', '*.zip' | Compress-Archive -DestinationPath 'the-trading-floor.zip' -Force"`;

try {
  execSync(cmd, { cwd: __dirname, stdio: 'inherit' });
  const stats = fs.statSync(zipPath);
  console.log(`[PACK] Success! Created ${zipPath} (${(stats.size / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('[PACK ERROR]', err.message);
  process.exit(1);
}
