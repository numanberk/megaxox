/* Plays many games with simple bots to see how long games last and how often things pop.
   node test/sim.js [games] [cfg as JSON, e.g. '{"diagonals":false}'] */
const G = require('../src/game.js');
const GAMES = +process.argv[2] || 300;
if (process.argv[3]) Object.assign(G.cfg, JSON.parse(process.argv[3]));
const CAP = 1500; /* stop a game that would go on forever */

function moves(st) {
  const out = [];
  st.tray.forEach((p, i) => { if (p) for (let r = 0; r < G.N; r++) for (let c = 0; c < G.N; c++) if (G.fits(st.board, p, r, c)) out.push([i, r, c]); });
  return out;
}
function value(st, m) { const v = G.preview(st, m[0], m[1], m[2]); return v.popped.length + v.blasted.length; }
/* random: a player not thinking at all. greedy: takes the biggest clear it can see. casual: greedy half the time */
const bots = {
  random: (st, ms, rand) => ms[Math.floor(rand() * ms.length)],
  casual: (st, ms, rand) => rand() < 0.5 ? bots.greedy(st, ms, rand) : bots.random(st, ms, rand),
  greedy: (st, ms, rand) => {
    let best = -1, pick = [];
    for (const m of ms) { const v = value(st, m); if (v > best) { best = v; pick = [m]; } else if (v === best) pick.push(m); }
    return pick[Math.floor(rand() * pick.length)];
  }
};
const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
const pct = (n, d) => (100 * n / d).toFixed(0).padStart(3) + '%';
console.log('bot      pieces p10/p50/p90    pop  blast  wipe  crowded  score p50');
for (const name of Object.keys(bots)) {
  const placed = [], score = [], rand = G.rng(7);
  let total = 0, pops = 0, blasts = 0, wipes = 0, crowded = 0, capped = 0;
  for (let g = 0; g < GAMES; g++) {
    const st = G.newGame(g + 1);
    while (!st.over && st.placed < CAP) {
      if (st.board.filter(v => v).length >= G.CELLS * 0.4) crowded++; /* 40% full */
      const m = bots[name](st, moves(st), rand);
      const res = G.place(st, m[0], m[1], m[2]);
      if (res.lines) pops++;
      if (res.blasts) blasts++;
      if (res.wipe) wipes++;
    }
    if (!st.over) capped++;
    total += st.placed; placed.push(st.placed); score.push(st.score);
  }
  console.log(name.padEnd(8), (q(placed, .1) + '/' + q(placed, .5) + '/' + q(placed, .9)).padEnd(19),
    pct(pops, total), ' ' + pct(blasts, total), '  ' + pct(wipes, total), '   ' + pct(crowded, total), '   ' + q(score, .5),
    capped ? '  (' + capped + ' hit ' + CAP + ')' : '');
}
