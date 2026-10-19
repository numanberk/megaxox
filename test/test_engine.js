const E = require('../src/engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

ok(E.WINDOWS.length === 28, 'window count is 28 (got ' + E.WINDOWS.length + ')');

// rotation identity
{
  let S = E.newSuper({ spin: true });
  const rnd = (n) => Math.floor(Math.random() * n);
  for (let i = 0; i < 10; i++) { const mv = E.superMoves(S); const m = mv[rnd(mv.length)]; S = E.applySuper(S, m[0], m[1], i % 2); }
  let R = S; for (let i = 0; i < 4; i++) R = E.rotateSuper(R);
  ok(Array.from(R.bx).join() === Array.from(S.bx).join() && Array.from(R.bo).join() === Array.from(S.bo).join() && R.next === S.next, 'four rotations are identity');
}

// 5x5: AI as O vs random X
function playRandomX(timeMs, rules) {
  let st = { x: 0, o: 0, b: 0, ban: 0 };
  let times = [];
  for (let turn = 0; turn < 30; turn++) {
    const empt = []; for (let c = 0; c < 25; c++) if (!((st.x | st.o | st.b) & (1 << c))) empt.push(c);
    if (!empt.length) return { r: 'draw', times };
    const c = empt[Math.floor(Math.random() * empt.length)];
    st.x |= 1 << c;
    if (E.lineWon(st.x, rules.lines[0])) return { r: 'X', times };
    const t0 = Date.now();
    const res = E.search5(st, rules, 1, timeMs);
    times.push(Date.now() - t0);
    if (res.move < 0) return { r: 'draw', times };
    st.o |= 1 << res.move;
    if (E.lineWon(st.o, rules.lines[1])) return { r: 'O', times };
  }
  return { r: 'draw', times };
}
{
  const rules = E.makeRules([]);
  let w = { X: 0, O: 0, draw: 0 }, all = [];
  for (let g = 0; g < 25; g++) { const o = playRandomX(80, rules); w[o.r]++; all = all.concat(o.times); }
  console.log('AI(O) vs random X (25 games):', w, 'avg ms/move', Math.round(all.reduce((a, b) => a + b, 0) / all.length), 'max', Math.max(...all));
  ok(w.X === 0, 'AI never loses to random play');
}

// 5x5: AI vs AI at 150ms, first move for X
{
  const rules = E.makeRules([]);
  let out = { X: 0, O: 0, draw: 0 };
  for (let g = 0; g < 6; g++) {
    let st = { x: 0, o: 0, b: 0, ban: 0 }, res = 'draw';
    for (let t = 0; t < 30; t++) {
      const side = t % 2;
      const r = E.search5(st, rules, side, 150);
      if (r.move < 0) break;
      if (side === 0) st.x |= 1 << r.move; else st.o |= 1 << r.move;
      if (E.lineWon(side === 0 ? st.x : st.o, rules.lines[side])) { res = side === 0 ? 'X' : 'O'; break; }
    }
    out[res]++;
  }
  console.log('AI vs AI (6 games):', out);
}

// Super XOX: AI(O) vs random X, move validity
{
  const rnd = (n) => Math.floor(Math.random() * n);
  let w = { X: 0, O: 0, tie: 0 }, times = [], illegal = 0, depths = [];
  for (let g = 0; g < 8; g++) {
    let S = E.newSuper({ spin: g % 2 === 1, cursed: g % 3 === 2 ? 4 : -1 });
    for (let t = 0; t < 90; t++) {
      if (E.superResult(S)) break;
      const mv = E.superMoves(S);
      if (!mv.length) break;
      const m = mv[rnd(mv.length)];
      S = E.applySuper(S, m[0], m[1], 0);
      if (E.superResult(S)) break;
      const t0 = Date.now();
      const r = E.searchSuper(S, 1, 150);
      times.push(Date.now() - t0); depths.push(r.depth);
      if (!E.superMoves(S).some(x => x[0] === r.b && x[1] === r.c)) illegal++;
      S = E.applySuper(S, r.b, r.c, 1);
    }
    const res = E.superResult(S); w[res === 1 ? 'X' : res === 2 ? 'O' : 'tie']++;
  }
  console.log('Super AI(O) vs random X (8 games):', w, 'avg ms', Math.round(times.reduce((a, b) => a + b, 0) / times.length), 'avg depth', (depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1));
  ok(illegal === 0, 'Super AI only plays legal moves');
  ok(w.O >= 5, 'Super AI beats random X most of the time');
}
console.log(fails ? 'FAILED ' + fails : 'ALL PASSED');
process.exit(fails ? 1 : 0);
