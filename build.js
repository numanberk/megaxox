const fs = require('fs');
const crypto = require('crypto');
const read = f => fs.readFileSync(f, 'utf8');
let html = read('src/template.html');
html = html.replace('/*CSS*/', () => read('src/style.css'))
  .replace('/*GAME*/', () => read('src/game.js'))
  .replace('/*UI*/', () => read('src/ui.js'));
// standalone page: the artifact host adds this wrapper itself, GitHub Pages does not
const cut = html.indexOf('<div id="app">');
const head = html.slice(0, cut), body = html.slice(cut);
const page = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n' +
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n' +
  head + '</head>\n<body>\n' + body + '</body>\n</html>\n';
fs.writeFileSync('index.html', page);
// syntax check the inline script
const m = page.match(/<script>([\s\S]*)<\/script>\s*<\/body>\s*<\/html>\s*$/);
new (require('vm').Script)(m[1]);
// offline cache: a new version name whenever the page changes, so phones pick up updates
const files = ['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const hash = crypto.createHash('sha1');
files.forEach(f => hash.update(fs.readFileSync(f)));
fs.writeFileSync('sw.js', read('src/sw.js').replace('/*VERSION*/', hash.digest('hex').slice(0, 10)).replace('/*FILES*/', JSON.stringify(['./'].concat(files.map(f => './' + f)))));
console.log('built index.html', (page.length / 1024).toFixed(1) + ' KB, script parses; sw.js updated');
