const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../public/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const regex = /id=["']([^"']+)["']/g;
const counts = {};
const duplicates = [];
let match;

while ((match = regex.exec(html)) !== null) {
  const id = match[1];
  if (counts[id]) {
    counts[id]++;
    duplicates.push(id);
  } else {
    counts[id] = 1;
  }
}

console.log(`Total unique IDs: ${Object.keys(counts).length}`);
console.log(`Total duplicate ID occurrences: ${duplicates.length}`);
if (duplicates.length > 0) {
  console.log('Duplicate IDs found:', [...new Set(duplicates)]);
} else {
  console.log('Zero duplicate IDs found!');
}
