const E = require('../src/engine.js'); global.XOX = E;
const G = require('../src/game.js'); G.cfg.aiMs5 = 150;
const N = +process.argv[2] || 8;
function setup(starter, counters) {
  const run = G.startRun(); G.pickStarter(run, starter); run.counters = counters || [];
  return G.startMatch(run);
}
const best = m => E.search5({ x: m.x, o: m.o, b: m.b, ban: 0 }, m.rules, 0, 120).move;
function play(starter, counters) {
  const m = setup(starter, counters);
  if (starter === 'freeze') G.use5(m, 'freeze'); // a player would use it early
  let g = 0;
  while (!m.over && g++ < 40) {
    if (m.turn === 'O') { G.ai5(m); continue; }
    const mv = best(m); if (mv < 0) break;
    G.tap5(m, mv); m.flash = '';
  }
  return { r: m.over || 'draw', turns: m.xTurns };
}
for (const starter of G.STARTERS) for (const [label, counters] of [['Act 1', []], ['Act 2 head start', ['head']], ['Act 3 dead center + head', ['dead', 'head']]]) {
  const res = { win: 0, draw: 0, loss: 0 }; let t = [];
  for (let i = 0; i < N; i++) { const o = play(starter, counters); res[o.r]++; if (o.r === 'win') t.push(o.turns); }
  console.log(starter.padEnd(7), label.padEnd(26), JSON.stringify(res), 'avg win turn', t.length ? (t.reduce((a, b) => a + b, 0) / t.length).toFixed(1) : '-');
}
