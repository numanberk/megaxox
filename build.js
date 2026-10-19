const fs = require('fs');
const read = f => fs.readFileSync(f, 'utf8');
let html = read('src/template.html');
html = html.replace('/*CSS*/', () => read('src/style.css'))
  .replace('/*ENGINE*/', () => read('src/engine.js'))
  .replace('/*GAME*/', () => read('src/game.js'))
  .replace('/*UI*/', () => read('src/ui.js'));
// standalone page: the artifact host adds this wrapper itself, GitHub Pages does not
const cut = html.indexOf('<div id="app">');
const head = html.slice(0, cut), body = html.slice(cut);
const page = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n' +
  head + '</head>\n<body>\n' + body + '</body>\n</html>\n';
fs.writeFileSync('index.html', page);
html = page;
// syntax check the inline script
const m = html.match(/<script>([\s\S]*)<\/script>\s*(<\/body>\s*<\/html>)?\s*$/);
new (require('vm').Script)(m[1]);
console.log('built index.html', (html.length / 1024).toFixed(1) + ' KB, script parses');
