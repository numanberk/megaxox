const fs = require('fs');
const read = f => fs.readFileSync(f, 'utf8');
let html = read('src/template.html');
html = html.replace('/*CSS*/', () => read('src/style.css'))
  .replace('/*ENGINE*/', () => read('src/engine.js'))
  .replace('/*GAME*/', () => read('src/game.js'))
  .replace('/*UI*/', () => read('src/ui.js'));
fs.mkdirSync('.', { recursive: true });
fs.writeFileSync('index.html', html);
// syntax check the inline script
const m = html.match(/<script>([\s\S]*)<\/script>\s*$/);
new (require('vm').Script)(m[1]);
console.log('built index.html', (html.length / 1024).toFixed(1) + ' KB, script parses');
