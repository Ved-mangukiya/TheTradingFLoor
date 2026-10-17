const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const regex = /id=["']([^"']+)["']/g;
const map = new Map();
let m;
while ((m = regex.exec(html)) !== null) {
  map.set(m[1], (map.get(m[1]) || 0) + 1);
}
const lines = html.split('\n');
const lineMap = new Map();
lines.forEach((line, idx) => {
  const m = line.match(/id=["']([^"']+)["']/);
  if (m) {
    const id = m[1];
    if (!lineMap.has(id)) lineMap.set(id, []);
    lineMap.get(id).push(idx + 1);
  }
});
let duplicates = 0;
for (const [id, lns] of lineMap.entries()) {
  if (lns.length > 1) {
    console.log(`${id}: lines ${lns.join(', ')}`);
    duplicates++;
  }
}
console.log(`Total duplicate IDs: ${duplicates}`);
