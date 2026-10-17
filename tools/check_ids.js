const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const idRegex = /\bid=["']([^"']+)["']/g;
const ids = {};
const lines = {};
const htmlLines = html.split('\n');

htmlLines.forEach((line, lineIdx) => {
  let m;
  const lineRegex = /\bid=["']([^"']+)["']/g;
  while ((m = lineRegex.exec(line)) !== null) {
    const id = m[1];
    ids[id] = (ids[id] || 0) + 1;
    if (!lines[id]) lines[id] = [];
    lines[id].push(lineIdx + 1);
  }
});

const duplicates = Object.entries(ids).filter(([id, count]) => count > 1);
console.log('Total unique IDs in public/index.html:', Object.keys(ids).length);
console.log('Total duplicate IDs count:', duplicates.length);
duplicates.forEach(([id, count]) => {
  console.log(`  - ID: "${id}" (appears ${count} times on lines: ${lines[id].join(', ')})`);
});
