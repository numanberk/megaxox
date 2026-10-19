/* Renders icon.svg to the PNG icons phones want. Run once after changing the icon: node test/icons.js */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const svg = fs.readFileSync('icon.svg', 'utf8');
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent('<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>' + svg);
    await page.screenshot({ path: 'icon-' + size + '.png' });
  }
  await browser.close();
  console.log('wrote icon-192.png, icon-512.png');
})();
