const E = require('../src/engine.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const R = n => Math.floor(Math.random() * n);
const G5 = E.makeGame({ w: 5, h: 5, k: 4 }), G3 = E.makeGame({ w: 3, h: 3, k: 3 }), GG = E.makeGame({ w: 5, h: 5, k: 4, gravity: true });
ok(G5.windows.length === 28 && G3.windows.length === 8, 'line counts 28 and 8');
ok(E.legalMask(GG, 0) === (0b11111 << 20), 'gravity: only the bottom row is legal on an empty board');
ok(E.legalMask(GG, 1 << 22) === ((0b11011 << 20) | (1 << 17)), 'gravity: a filled square makes the one above legal');
ok(E.patterns(G3).plus === (1<<4|1<<1|1<<7|1<<3|1<<5), '3x3 plus pattern');
function vsRandom(g, ms, games) {
  const res = { X: 0, O: 0, d: 0 }; let maxMs = 0;
  for (let i = 0; i < games; i++) {
    let x = 0, o = 0, out = 'd';
    while (true) {
      const leg = E.legalMask(g, x | o); if (!leg) break;
      const cells = []; for (let c = 0; c < g.nc; c++) if (leg & (1 << c)) cells.push(c);
      x |= 1 << cells[R(cells.length)];
      if (E.lineWon(x, g.lines[0])) { out = 'X'; break; }
      if (!E.legalMask(g, x | o)) break;
      const t = Date.now(); const r = E.search({ x, o, b: 0 }, g, 1, ms); maxMs = Math.max(maxMs, Date.now() - t);
      if (!(E.legalMask(g, x | o) & (1 << r.move))) { out = 'ILLEGAL'; break; }
      o |= 1 << r.move;
      if (E.lineWon(o, g.lines[1])) { out = 'O'; break; }
    }
    res[out] = (res[out] || 0) + 1;
  }
  return { res, maxMs };
}
let r = vsRandom(G3, 50, 30); ok(!r.res.X && !r.res.ILLEGAL, '3x3 AI never loses to random play ' + JSON.stringify(r));
r = vsRandom(GG, 150, 15); ok(!r.res.X && !r.res.ILLEGAL, 'gravity AI only plays legal drops and never loses to random play ' + JSON.stringify(r) + ' max ' + r.maxMs + 'ms');
r = vsRandom(G5, 100, 10); ok(!r.res.X, '5x5 AI still holds ' + JSON.stringify(r));
// 3x3 perfect self-play is a draw
let d = 0; for (let i = 0; i < 6; i++) { let x = 0, o = 0, s = 0, res = 'd'; for (let t = 0; t < 9; t++) { const m = E.search({ x, o, b: 0 }, G3, s, 100).move; if (m < 0) break; if (s === 0) x |= 1 << m; else o |= 1 << m; if (E.lineWon(s ? o : x, G3.windows)) { res = s ? 'O' : 'X'; break; } s ^= 1; } if (res === 'd') d++; }
ok(d === 6, '3x3 perfect self-play always draws');
// super target
let S = E.newSuper({ target: 3 }); S.res[0] = 1; S.res[4] = 1; S.res[5] = 1; ok(E.superResult(S) === 1, 'Super XOX: 3 boards wins with target 3');
S = E.applySuper(E.newSuper({ target: 3 }), 4, 4, 0); ok(S.target === 3, 'target survives a move');
console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
