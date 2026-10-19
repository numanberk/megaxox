const E = require('../src/engine.js'); global.XOX = E;
const G = require('../src/game.js'); G.cfg.aiMs = [200, 300, 400]; G.cfg.aiMsBoss = [80, 300, 500];
const N = +process.argv[2] || 4;
// bot: uses buttons early, plays the search's best move
function play(r, opp) {
  r.choices = opp ? [opp] : []; r.phase = 'briefing';
  const m = G.startMatch(r, opp); let g = 0;
  while (!m.over && g++ < 300) {
    if (m.turn === 'pause') { G.nextRound(m); continue; }
    if (m.turn === 'O') { G.ai(m); continue; }
    for (const id of ['freeze', 'zap', 'nuke']) if (m.charges[id] > 0 && (m.xTurns >= 1 || id === 'freeze')) G.use(m, id);
    if (m.over || m.turn !== 'X') continue;
    if (m.kind === 'grid') { const mv = E.search({ x: m.x, o: m.o, b: m.b }, m.g, 0, 120).move; if (mv < 0) break; G.tap(m, mv); }
    else { const mv = E.searchSuper(m.S, 0, 200); if (!mv) break; G.tap(m, mv.b, mv.c); }
    m.flash = '';
  }
  return m.over || 'draw';
}
const rows = [];
for (const ch of (process.argv[3] ? process.argv[3].split(',') : G.CHAR_ORDER)) {
  const line = [ch.padEnd(7)];
  for (const opp of [...Object.keys(G.OPPONENTS), 'BOSS1', 'BOSS2', 'BOSS3']) {
    let w = 0, d = 0, l = 0;
    for (let i = 0; i < N; i++) {
      const r = G.startRun(); G.pickChar(r, ch);
      let res;
      if (opp.startsWith('BOSS')) { r.act = +opp[4]; r.idx = 3; G.refill(r); res = play(r); }
      else { r.act = G.OPPONENTS[opp].act; G.refill(r); res = play(r, opp); }
      if (res === 'win') w++; else if (res === 'draw') d++; else l++;
    }
    line.push(opp.slice(0, 7).padEnd(8) + w + '/' + d + '/' + l);
  }
  console.log(line.join(' '));
}
