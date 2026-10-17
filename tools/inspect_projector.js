const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const lines = html.split('\n');

let startProj = -1;
let endProj = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('id="projectorView"')) startProj = i;
  if (startProj !== -1 && lines[i].includes('id="winnerPresentationView"')) {
    endProj = i;
    break;
  }
}

console.log(`projectorView spans lines ${startProj + 1} to ${endProj + 1}`);

for (let i = startProj; i < endProj; i++) {
  const line = lines[i];
  if (line.includes('news') || line.includes('News') || line.includes('marquee') || line.includes('ticker') || line.includes('projPauseBanner') || line.includes('projScene')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}
