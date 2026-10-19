const G = require('../src/game.js');
let fails = 0;
function ok(cond, name) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; }
const X = G.X, O = G.O;
function board(rows) { return rows.join('').split('').map(ch => ch === 'x' ? X : ch === 'o' ? O : 0); }
const empty = () => new Array(36).fill(0);

/* runs */
let b = board(['xxx...', '......', '......', '......', '......', '......']);
ok(G.findRuns(b).lines === 1 && G.findRuns(b).cells.join() === '0,1,2', 'three in a row is one run');
b = board(['xxxx..', '......', '......', '......', '......', '......']);
ok(G.findRuns(b).lines === 1 && G.findRuns(b).cells.length === 4, 'four in a row is one run of four');
b = board(['o.....', '.o....', '..o...', '......', '......', '......']);
ok(G.findRuns(b).lines === 1, 'diagonal counts');
b = board(['..o...', '.o....', 'o.....', '......', '......', '......']);
ok(G.findRuns(b).lines === 1, 'anti-diagonal counts');
b = board(['xxo...', 'oox...', '......', '......', '......', '......']);
ok(G.findRuns(b).lines === 0, 'mixed marks do not pop');
b = board(['xxx...', 'x.....', 'x.....', '......', '......', '......']);
ok(G.findRuns(b).lines === 2 && G.findRuns(b).cells.length === 5, 'crossing runs share a cell');

/* fitting */
ok(G.fits(empty(), [{ r: 0, c: 0, m: X }, { r: 0, c: 1, m: X }], 0, 4), 'domino fits at the edge');
ok(!G.fits(empty(), [{ r: 0, c: 0, m: X }, { r: 0, c: 1, m: X }], 0, 5), 'domino does not hang off the board');
b = empty(); b[7] = O;
ok(!G.fits(b, [{ r: 0, c: 0, m: X }], 1, 1), 'cannot place on a mark');

/* placing and scoring */
let st = G.newGame(1);
st.board = board(['xx....', '......', '......', '......', '......', '......']);
st.tray = [[{ r: 0, c: 0, m: X }], [{ r: 0, c: 0, m: O }], [{ r: 0, c: 0, m: O }]];
let res = G.place(st, 0, 0, 2);
ok(res && res.lines === 1 && res.cleared.length === 3, 'placing the third X pops the line');
ok(st.board.every(v => v === 0), 'popped cells are empty');
ok(st.score === 1 + 30 && st.streak === 1, 'score is cells placed plus 10 per popped cell');
ok(st.tray[0] === null && !res.refilled, 'used piece leaves the tray');
ok(G.place(st, 0, 1, 1) === null, 'used slot cannot be placed again');
G.place(st, 1, 5, 5); res = G.place(st, 2, 5, 0);
ok(res.refilled && st.tray.every(p => p), 'tray refills after all three are used');
ok(st.streak === 0, 'a placement with no pop ends the streak');

st = G.newGame(2);
st.board = board(['xx....', '......', 'oo....', '......', '......', '......']);
st.tray = [[{ r: 0, c: 0, m: X }], [{ r: 0, c: 0, m: O }], [{ r: 0, c: 0, m: X }]];
G.place(st, 0, 0, 2); const s1 = st.score;
G.place(st, 1, 2, 2);
ok(st.streak === 2 && st.score - s1 === 1 + 30 * 2, 'second pop in a row scores double');

/* preview does not change the game */
st = G.newGame(3);
st.board = board(['xx....', '......', '......', '......', '......', '......']);
st.tray = [[{ r: 0, c: 0, m: X }], null, null];
const pv = G.preview(st, 0, 0, 2);
ok(pv.length === 3 && st.board[2] === 0 && st.score === 0, 'preview shows the pop without placing');

/* game over */
st = G.newGame(4);
st.board = board(['xxooxx', 'ooxxoo', 'xxooxx', 'ooxxoo', 'xxooxx', 'ooxxo.']);
ok(G.findRuns(st.board).lines === 0, 'full test board has no lines');
st.tray = [[{ r: 0, c: 0, m: O }], [{ r: 0, c: 0, m: X }, { r: 0, c: 1, m: X }], null];
res = G.place(st, 0, 5, 5);
ok(res.over && st.over, 'game ends when nothing fits');

/* replay and fairness */
const a = G.newGame(42), c = G.newGame(42);
ok(JSON.stringify(a.tray) === JSON.stringify(c.tray), 'same seed deals the same tray');
const crowded = board(['xxooxx', 'ooxxoo', 'xxooxx', 'ooxxoo', 'xxooxx', 'ooxx..']);
let fair = true;
for (let i = 0; i < 200; i++) { const t = G.newTray(crowded, G.rng(i), 15); if (!t.some(p => G.fitsAnywhere(crowded, p))) fair = false; }
ok(fair, 'a fresh tray always has a piece that fits when one can');
ok(G.level(0) === 0 && G.level(10000) === G.cfg.maxLevel, 'level starts at 0 and caps');

/* a whole game with random moves always ends and keeps the board legal */
let ended = 0, clean = true;
for (let g = 0; g < 30; g++) {
  const s = G.newGame(100 + g), rand = G.rng(g);
  while (!s.over && s.placed < 3000) {
    const ms = [];
    s.tray.forEach((p, i) => { if (p) for (let r = 0; r < 6; r++) for (let cc = 0; cc < 6; cc++) if (G.fits(s.board, p, r, cc)) ms.push([i, r, cc]); });
    const m = ms[Math.floor(rand() * ms.length)];
    G.place(s, m[0], m[1], m[2]);
    if (G.findRuns(s.board).lines) { clean = false; break; }
  }
  if (s.over) ended++;
}
ok(ended === 30 && clean, 'random games all end, with no unpopped line left behind');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
