const E = require('../src/engine.js'); global.XOX = E;
const G = require('../src/game.js');
G.cfg.aiMs5 = 150;
const bit = (i) => 1 << i;
const N = +process.argv[2] || 6;

function newRunMatch(starter) {
  const run = G.startRun(); G.pickStarter(run, starter);
  run.relics = []; run.charges = {}; G.gain(run, starter);
  run.counters = [];
  return { run, m: G.startMatch(run) };
}
function normalX(m, ms) {
  // X's best move on the TRUE board
  const r = E.search5({ x: m.x, o: m.o, b: m.b, ban: m.ban }, m.rules, 0, ms);
  return r.move;
}

function playDoubleTap() {
  const { m } = newRunMatch('doubletap');
  G.arm5(m, 'doubletap'); G.tap5(m, 12); G.tap5(m, 13);
  let guard = 0;
  while (!m.over && guard++ < 30) {
    if (m.turn === 'O') { G.ai5(m); continue; }
    G.tap5(m, normalX(m, 120));
  }
  return { r: m.over, turns: m.xTurns };
}
function playGhost() {
  const { m } = newRunMatch('ghost');
  G.arm5(m, 'ghost'); G.tap5(m, 12);
  let guard = 0;
  while (!m.over && guard++ < 30) {
    if (m.turn === 'O') { G.ai5(m); continue; }
    G.tap5(m, normalX(m, 120));
  }
  return { r: m.over, turns: m.xTurns };
}
function playEraser() {
  const { m } = newRunMatch('eraser');
  let guard = 0, used = false;
  while (!m.over && guard++ < 30) {
    if (m.turn === 'O') { G.ai5(m); continue; }
    if (!used && m.xTurns >= 2) {
      // look for erase + place that forces a win
      let found = null;
      for (let e = 0; e < 25 && !found; e++) if (m.o & bit(e)) {
        for (let c = 0; c < 25 && !found; c++) {
          if (c === e || !(G.emptyAt(m, c) || c === e)) continue;
          const st = { x: m.x | bit(c), o: m.o & ~bit(e), b: m.b, ban: 0 };
          if (E.lineWon(st.x, m.rules.lines[0])) { found = [e, c]; break; }
          const r = E.search5(st, m.rules, 1, 25, { maxDepth: 8 });
          if (r.score <= -(E.WIN - 60)) found = [e, c];
        }
      }
      if (found) { G.arm5(m, 'eraser'); G.tap5(m, found[0]); G.tap5(m, found[1]); used = true; continue; }
    }
    G.tap5(m, normalX(m, 120));
  }
  return { r: m.over, turns: m.xTurns, used };
}
for (const [name, fn] of [['Double Tap (center + neighbor on turn 1)', playDoubleTap], ['Ghost Mark (center on turn 1)', playGhost], ['Eraser (used when it forces a win)', playEraser]]) {
  const t0 = Date.now(); const res = { win: 0, draw: 0, loss: 0 };
  let turns = [];
  for (let g = 0; g < N; g++) { const o = fn(); res[o.r || 'draw']++; if (o.r === 'win') turns.push(o.turns); }
  console.log(name, JSON.stringify(res), 'avg win turns', turns.length ? (turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1) : '-', Math.round((Date.now() - t0) / 1000) + 's');
}
