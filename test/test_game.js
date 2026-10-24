const G = require('../src/game.js');
let fails = 0;
function ok(cond, name) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; }
const X = G.X, O = G.O, N = G.N;
/* rows of 5: x, o or . ; missing rows are empty */
function board(rows) { const b = new Array(G.CELLS).fill(0); rows.forEach((row, r) => row.split('').forEach((ch, c) => { b[r * N + c] = ch === 'x' ? X : ch === 'o' ? O : 0; })); return b; }
const empty = () => new Array(G.CELLS).fill(0);
const at = (r, c) => r * N + c;
const sorted = a => a.slice().sort((p, q) => p - q).join();
function game(rows, tray) { const st = G.newGame(1); st.board = board(rows); st.tray = tray; return st; }
const one = m => [{ r: 0, c: 0, m: m }];

/* runs */
let b = board(['xxx..']);
ok(G.findRuns(b).lines === 1 && sorted(G.findRuns(b).cells) === '0,1,2', 'three in a row is one run');
b = board(['x', 'x', 'x']);
ok(G.findRuns(b).lines === 1, 'three in a column is one run');
b = board(['o....', '.o...', '..o..']);
ok(G.findRuns(b).lines === 0, 'diagonals do not count');
b = board(['xxo..', 'oox..']);
ok(G.findRuns(b).lines === 0, 'mixed marks do not pop');

/* fitting */
ok(G.fits(empty(), [{ r: 0, c: 0, m: X }, { r: 0, c: 1, m: X }], 0, N - 2), 'domino fits at the edge');
ok(!G.fits(empty(), [{ r: 0, c: 0, m: X }, { r: 0, c: 1, m: X }], 0, N - 1), 'domino does not hang off the board');
b = empty(); b[at(1, 1)] = O;
ok(!G.fits(b, one(X), 1, 1), 'cannot place on a mark');

/* placing and scoring */
let st = game(['xx...'], [one(X), one(O), one(O)]);
let res = G.place(st, 0, 0, 2);
ok(res && res.lines === 1 && res.popped.length === 3 && !res.blasted.length, 'placing the third X pops the line');
ok(st.board.every(v => v === 0), 'popped squares are empty');
ok(res.clean && st.score === 1 + 30 + G.cfg.cleanBonus, 'score: squares placed + 10 per popped square + clean board bonus');
ok(st.tray[0] === null && !res.refilled, 'used piece leaves the tray');
ok(G.place(st, 0, 1, 1) === null, 'used slot cannot be placed again');
G.place(st, 1, 4, 4); res = G.place(st, 2, 4, 0);
ok(res.refilled && st.tray.every(p => p), 'tray refills after all three are used');
ok(st.streak === 0, 'a placement with no pop ends the streak');

st = game(['xx...', '.....', 'oo...', '.....', '....x'], [one(X), one(O), one(O)]);
G.place(st, 0, 0, 2); const s1 = st.score;
G.place(st, 1, 2, 2);
ok(st.streak === 2 && st.score - s1 === 1 + 30 * 2, 'second pop in a row scores double');

/* blasts: 4+ across clears its row and the rows next to it, 4+ down clears columns */
st = game(['o.o.o', 'xx.xo', 'x.o.x', '.....', '.o.xx'], [one(X), one(O), one(O)]);
ok(G.findRuns(st.board).lines === 0, 'blast test board starts with no lines');
res = G.place(st, 0, 1, 2);
ok(res.blasts === 1 && res.popped.length === 4, 'four across blasts');
ok([0, 1, 2].every(r => [0, 1, 2, 3, 4].every(c => st.board[at(r, c)] === 0)), 'the row and the rows above and below are cleared');
ok(st.board[at(4, 4)] === X, 'rows further away stay');
st = game(['.x...', '.x...', '.x...', '.....', 'x.o..'], [one(X), one(O), one(O)]);
res = G.place(st, 0, 3, 1);
ok(res.blasts === 1 && st.board[at(4, 0)] === 0 && st.board[at(4, 2)] === 0, 'four down blasts the columns next to it');
st = game(['xx...', '..x..'], [one(X), one(O), one(O)]);
res = G.place(st, 0, 0, 2);
ok(res.lines === 1 && !res.blasts && st.board[at(1, 2)] === X, 'three is a plain pop, no blast');

/* wipe: a line across and a line down that cross, one of them 4+, clear the board */
st = game(['..x..', '..x..', 'xx.x.', '..x..', 'o.o.o'], [one(X), one(O), one(O)]);
res = G.preview(st, 0, 2, 2);
ok(res.wipe && st.board[at(2, 2)] === 0, 'preview spots the wipe without placing');
res = G.place(st, 0, 2, 2);
ok(res.wipe && res.clean && st.board.every(v => v === 0), 'a cross with a line of 4+ wipes the board');
st = game(['..x..', '..x..', 'xx...', '.....', '....o'], [one(X), one(O), one(O)]);
res = G.place(st, 0, 2, 2);
ok(res.lines === 2 && !res.wipe && st.board[at(4, 4)] === O, 'a cross of two threes pops both but does not wipe');

/* game over */
st = game(['xxoox', 'ooxxo', 'xxoox', 'ooxxo', 'ooxx.'], [one(O), [{ r: 0, c: 0, m: X }, { r: 0, c: 1, m: O }], null]);
ok(G.findRuns(st.board).lines === 0, 'full test board has no lines');
res = G.place(st, 0, 4, 4);
ok(res.over && st.over, 'game ends when nothing fits');

/* replay, daily seed and fairness */
const a = G.newGame(42), c = G.newGame(42);
ok(JSON.stringify(a.tray) === JSON.stringify(c.tray), 'same seed deals the same tray');
ok(G.dailySeed('2026-10-19') === G.dailySeed('2026-10-19') && G.dailySeed('2026-10-19') !== G.dailySeed('2026-10-20'), 'daily seed is fixed per day');
const crowded = board(['xxoox', 'ooxxo', 'xxoox', 'ooxxo', 'xxo..']);
let fair = true;
for (let i = 0; i < 200; i++) { const t = G.newTray(crowded, G.rng(i), 8); if (!t.some(p => G.fitsAnywhere(crowded, p))) fair = false; }
ok(fair, 'a fresh tray always has a piece that fits when one can');
ok(G.level(0) === 0 && G.level(10000) === G.cfg.maxLevel, 'level starts at 0 and caps');

/* whole games with random moves always end and never leave a line behind */
let ended = 0, clean = true;
for (let g = 0; g < 40; g++) {
  const s = G.newGame(100 + g), rand = G.rng(g);
  while (!s.over && s.placed < 3000) {
    const ms = [];
    s.tray.forEach((p, i) => { if (p) for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) if (G.fits(s.board, p, r, cc)) ms.push([i, r, cc]); });
    const m = ms[Math.floor(rand() * ms.length)];
    G.place(s, m[0], m[1], m[2]);
    if (G.findRuns(s.board).lines) { clean = false; break; }
  }
  if (s.over) ended++;
}
ok(ended === 40 && clean, 'random games all end, with no unpopped line left behind');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
