/* Plays many games with simple bots to see how long a game lasts.
   node test/sim.js [games] [cfg as JSON, e.g. '{"diagonals":false}'] */
const G = require('../src/game.js');
const GAMES = +process.argv[2] || 300;
if (process.argv[3]) Object.assign(G.cfg, JSON.parse(process.argv[3]));

function moves(st) {
  const out = [];
  st.tray.forEach((p, i) => { if (p) for (let r = 0; r < G.N; r++) for (let c = 0; c < G.N; c++) if (G.fits(st.board, p, r, c)) out.push([i, r, c]); });
  return out;
}
/* random: a player not thinking at all. greedy: takes the biggest pop it can see. casual: greedy half the time */
const bots = {
  random: (st, ms, rand) => ms[Math.floor(rand() * ms.length)],
  casual: (st, ms, rand) => rand() < 0.5 ? bots.greedy(st, ms, rand) : bots.random(st, ms, rand),
  greedy: (st, ms, rand) => {
    let best = -1, pick = [];
    for (const m of ms) { const v = G.preview(st, m[0], m[1], m[2]).length; if (v > best) { best = v; pick = [m]; } else if (v === best) pick.push(m); }
    return pick[Math.floor(rand() * pick.length)];
  }
};
const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.floor(f * (a.length - 1))];
for (const name of Object.keys(bots)) {
  const placed = [], score = [], rand = G.rng(7);
  for (let g = 0; g < GAMES; g++) {
    const st = G.newGame(g + 1);
    while (!st.over && st.placed < 2000) { const m = bots[name](st, moves(st), rand); G.place(st, m[0], m[1], m[2]); }
    placed.push(st.placed); score.push(st.score);
  }
  console.log(name.padEnd(7), 'moves p10/p50/p90', q(placed, .1), q(placed, .5), q(placed, .9), '  score p50', q(score, .5));
}
