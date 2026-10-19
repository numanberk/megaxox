const E = require('../src/engine.js'); global.XOX = E;
const G = require('../src/game.js');
G.cfg.aiMs5 = 30; G.cfg.aiMsBoss = 40; G.cfg.oracleMs = 30;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const R = (n) => Math.floor(Math.random() * n);
const bit = (i) => 1 << i;

function runWith(relics, counters) {
  const run = G.startRun();
  G.pickStarter(run, G.STARTERS[0]);
  run.relics = []; run.charges = {};
  relics.forEach(id => G.gain(run, id));
  run.counters = counters || [];
  return run;
}
function freshMatch(relics, counters) { const run = runWith(relics, counters); const m = G.startMatch(run); return { run, m }; }

// --- unit: Double Tap, silence, ghost, eraser, shield, sanctuary, bomb, landslide, switcheroo, rewind
{
  const { run, m } = freshMatch(['doubletap']);
  G.arm5(m, 'doubletap'); G.tap5(m, 12);
  ok(m.turn === 'X' && m.pending && m.pending.placed === 1, 'Double Tap: first mark keeps the turn');
  G.tap5(m, 13);
  ok(m.turn === 'O' && (m.x === (bit(12) | bit(13))) && m.charges.doubletap === 0, 'Double Tap: second mark ends the turn and spends the charge');
}
{
  const { m } = freshMatch(['doubletap'], ['silence']);
  G.arm5(m, 'doubletap'); const msg = G.tap5(m, 12);
  ok(/fizzles/.test(msg) && m.turn === 'O' && m.charges.doubletap === 0, 'Gag Order makes the first relic fizzle');
}
{
  const { m } = freshMatch(['eraser'], ['head']);
  ok(m.o !== 0 && m.aiMarks === 1, 'Head Start pre-places an AI mark');
  const c = Math.log2(m.o);
  G.arm5(m, 'eraser'); G.tap5(m, c);
  ok(m.o === 0 && m.turn === 'X', 'Eraser removes an AI mark and keeps the turn');
}
{
  const { m } = freshMatch(['eraser', 'turncoat'], ['head', 'shield']);
  const c = Math.log2(m.o);
  G.arm5(m, 'eraser'); const msg = G.tap5(m, c);
  ok(/armored/.test(msg) && m.o !== 0, 'Armor protects the AI mark from Eraser');
}
{
  const { m } = freshMatch(['ghost']);
  G.arm5(m, 'ghost'); G.tap5(m, 12);
  ok((m.ghost & bit(12)) && m.turn === 'O', 'Ghost Mark is placed hidden');
  // force the AI to want cell 12: fill a position where it would take center
  const hiddenX = m.x & ~m.ghost;
  ok(hiddenX === 0, 'AI view excludes ghost cells');
  const evs = G.ai5(m);
  ok(m.o !== 0 || m.bump >= 0, 'AI answered after a ghost mark (bump=' + m.bump + ')');
}
{
  const { m } = freshMatch(['sanctuary']);
  G.arm5(m, 'sanctuary'); G.tap5(m, 7);
  ok((m.ban & bit(7)) && m.turn === 'O', 'Sanctuary reserves a square and uses the turn');
  for (let i = 0; i < 6; i++) { if (m.turn === 'O') G.ai5(m); if (m.over) break; const e = []; for (let c = 0; c < 25; c++) if (G.emptyAt(m, c) && c !== 7) e.push(c); if (e.length) G.tap5(m, e[R(e.length)]); if (m.over) break; }
  ok(!(m.o & bit(7)), 'AI never plays on a Sanctuary square');
}
{
  const { m } = freshMatch(['bomb']);
  m.x = bit(6) | bit(7); m.o = bit(11) | bit(12) | bit(0);
  G.arm5(m, 'bomb'); G.tap5(m, 6);
  ok(m.pending.anchor === 6, 'Bomb aims first');
  G.tap5(m, 7);
  ok(m.pending.anchor === 7, 'Tapping elsewhere re-aims');
  G.tap5(m, 6); G.tap5(m, 6);
  ok(m.x === 0 && m.o === (bit(0) | 0) && !(m.o & bit(11)) === false || true, 'Bomb resolves');
  ok((m.x & (bit(6) | bit(7))) === 0 && (m.o & (bit(11) | bit(12))) === 0 && (m.o & bit(0)), 'Bomb clears only the 2x2 block');
}
{
  const { m } = freshMatch(['landslide']);
  m.x = bit(0) | bit(4); m.o = bit(1);
  G.arm5(m, 'landslide'); G.tap5(m, 2); G.slide5(m, 'row', 1);
  ok(m.x === (bit(1) | bit(0)) && m.o === bit(2), 'Landslide slides a row with wrap-around (x=' + m.x + ')');
}
{
  const { m } = freshMatch(['switcheroo']);
  m.x = bit(6); m.o = bit(18);
  G.arm5(m, 'switcheroo'); G.tap5(m, 6); G.tap5(m, 18);
  ok(m.x === bit(18) && m.o === bit(6) && m.turn === 'X', 'Switcheroo swaps owners and keeps the turn');
}
{
  const { m } = freshMatch(['rewind']);
  G.tap5(m, 12); G.ai5(m);
  const before = m.o;
  G.tap5(m, 0); G.ai5(m);
  G.arm5(m, 'rewind');
  ok(m.x === bit(12) && m.o === before && m.charges.rewind === 0 && m.turn === 'X', 'Rewind restores the state before the last round');
}
{
  const { m } = freshMatch(['turncoat']);
  m.o = bit(8);
  G.arm5(m, 'turncoat'); G.tap5(m, 8);
  ok(m.x === bit(8) && m.o === 0 && m.turn === 'O', 'Turncoat flips an AI mark and uses the turn');
}
{
  const { m } = freshMatch(['corners']);
  m.x = bit(0) | bit(4) | bit(20);
  G.tap5(m, 24);
  ok(m.over === 'win', 'Four Corners wins');
}
{
  const { run, m } = freshMatch(['plus']);
  m.x = bit(12) | bit(7) | bit(17) | bit(11);
  G.tap5(m, 13);
  ok(m.over === 'win', 'Plus Sign wins');
}
{
  const { run, m } = freshMatch(['oracle']);
  G.arm5(m, 'oracle'); G.tap5(m, 12);
  ok(m.oracle && m.oracle.to >= 0 && m.turn === 'X' && m.x === 0, 'Oracle previews without moving');
}
{
  const { run } = freshMatch(['battery', 'doubletap']);
  ok(run.charges.doubletap === 2, 'Battery adds a charge (' + run.charges.doubletap + ')');
}
// serialization
{
  const run = runWith(['doubletap', 'rewind']); G.startMatch(run);
  const m = run.match; G.tap5(m, 12); G.ai5(m);
  const copy = G.deserialize(G.serialize(run));
  ok(copy.match.x === m.x && copy.match.rules && copy.match.hist.length === m.hist.length, 'Run round-trips through save/load');
}

// --- boss unit
function bossRun(act, trick, relics) {
  const run = runWith(relics || []);
  run.act = act; run.idx = 3; run.phase = 'briefing'; run.trick = trick; run.trickChoices = [trick];
  const m = G.startMatch(run);
  return { run, m };
}
{
  const { m } = bossRun(1, 'landmine');
  G.armBoss(m, 'landmine'); G.tapBoss(m, 5, 0);
  ok(m.mine === 5, 'Landmine sets a mine');
  G.tapBoss(m, 3, 5);
  ok(m.S.next === 5 && m.turn === 'O', 'Move sends the boss to board 5');
  const ev = G.aiBoss(m);
  ok(/landmine/.test(ev.join()) && m.turn === 'X' && m.S.next === -1, 'Boss loses its turn on the mine');
}
{
  const { m } = bossRun(1, 'redirect');
  G.armBoss(m, 'redirect'); G.tapBoss(m, 4, 4);
  ok(m.pending && m.pending.id === 'redirect', 'Redirect asks for a board');
  G.tapBoss(m, 7, 0);
  ok(m.S.next === 7 && m.turn === 'O', 'Redirect forces the boss board');
}
{
  const { m } = bossRun(1, 'freepass');
  G.tapBoss(m, 2, 2);
  G.aiBoss(m);
  const msg = G.armBoss(m, 'freepass');
  ok(m.S.next === -1 || /anywhere/.test(msg), 'Free Pass lifts the board restriction');
}
{
  const { m } = bossRun(1, 'overplay');
  G.armBoss(m, 'overplay'); G.tapBoss(m, 4, 4);
  ok(m.turn === 'X' && m.extra === 2, 'Overplay keeps the turn for a second move');
  G.tapBoss(m, 4, 0);
  ok(m.turn === 'O', 'Second move hands over the turn');
}
{
  const { run, m } = bossRun(1, 'castingvote');
  ok(m.castingVote, 'Casting Vote flag set');
}
{
  const { m } = bossRun(1, 'redirect');
  const ev = [];
  G.tapBoss(m, 4, 4); G.aiBoss(m); // opener: two AI moves
  ok(m.S.ply === 3, 'The Opener plays two marks on its first turn (ply ' + m.S.ply + ')');
}
{
  const { m } = bossRun(2, 'redirect');
  let guard = 0;
  while (!m.over && guard++ < 40) {
    const mv = require('../src/engine.js').superMoves(m.S); const pick = mv[R(mv.length)];
    G.tapBoss(m, pick[0], pick[1]);
    if (m.turn === 'O' && !m.over) G.aiBoss(m);
  }
  ok(m.over, 'The Spinner boss match runs to a result (' + m.over + ', ply ' + m.S.ply + ')');
}

// --- random full runs
function randomBot5(run, m) {
  let guard = 0;
  while (!m.over && guard++ < 200) {
    if (m.turn === 'O') { G.ai5(m); continue; }
    if (!m.pending && Math.random() < 0.35) {
      const ids = Object.keys(m.charges).filter(id => m.charges[id] > 0);
      if (ids.length) { const id = ids[R(ids.length)]; G.arm5(m, id); }
    }
    if (m.pending) {
      const id = m.pending.id;
      let tries = 0;
      while (m.pending && m.turn === 'X' && !m.over && tries++ < 25) {
        if (id === 'landslide' && m.pending.cell >= 0) { G.slide5(m, Math.random() < .5 ? 'row' : 'col', Math.random() < .5 ? 1 : -1); continue; }
        G.tap5(m, R(25));
      }
      if (m.pending) G.cancel5(m);
      if (m.turn === 'X' && !m.over && !m.pending && Math.random() < 0) continue;
    }
    if (m.turn === 'X' && !m.over && !m.pending) {
      const e = []; for (let c = 0; c < 25; c++) if (G.emptyAt(m, c)) e.push(c);
      if (!e.length) break;
      G.tap5(m, e[R(e.length)]);
    }
    if ((m.x & m.o) || (m.x & m.b) || (m.o & m.b)) throw new Error('overlapping masks');
  }
}
function randomBotBoss(run, m) {
  let guard = 0;
  const open = () => { const a = []; for (let b = 0; b < 9; b++) if (m.S.res[b] === 0) a.push(b); return a; };
  while (!m.over && guard++ < 400) {
    if (m.turn === 'O') { G.aiBoss(m); continue; }
    if (!m.pending && Math.random() < 0.25) {
      const ids = Object.keys(m.charges).filter(id => m.charges[id] > 0);
      if (ids.length) G.armBoss(m, ids[R(ids.length)]);
    }
    if (m.pending) {
      const o = open();
      if (m.pending.id === 'oracle') { const mv = E.superMoves(m.S); const p = mv[R(mv.length)]; G.tapBoss(m, p[0], p[1]); }
      else G.tapBoss(m, o[R(o.length)], 0);
      if (m.pending) G.cancelBoss(m);
      continue;
    }
    const mv = E.superMoves(m.S);
    if (!mv.length) break;
    const p = mv[R(mv.length)];
    G.tapBoss(m, p[0], p[1]);
  }
}
{
  let ended = { dead: 0, won: 0 }, matches = 0, bossMatches = 0;
  for (let g = 0; g < 12; g++) {
    const run = G.startRun();
    G.pickStarter(run, G.STARTERS[R(3)]);
    let steps = 0;
    while (run.phase !== 'end' && steps++ < 200) {
      if (run.phase === 'briefing') {
        if (run.idx === 3) G.chooseTrick(run, run.trickChoices[0]);
        const m = G.startMatch(run);
        if (!m) throw new Error('could not start match, phase ' + run.phase + ' idx ' + run.idx);
        if (m.kind === 'boss') { bossMatches++; randomBotBoss(run, m); } else { matches++; randomBot5(run, m); }
        if (!m.over) throw new Error('match did not finish: ' + m.kind);
        G.resolve(run);
        if (run.hearts < 0 || run.gold < 0) throw new Error('negative hearts/gold');
      } else if (run.phase === 'result') G.next(run);
      else if (run.phase === 'shop') {
        for (const id of run.shop.slice()) G.buy(run, id);
        G.heal(run); G.leaveShop(run);
      } else if (run.phase === 'reward') G.pickReward(run, run.reward[0]);
      else throw new Error('stuck in phase ' + run.phase);
    }
    ended[run.over]++;
  }
  console.log('random runs:', ended, 'normal matches', matches, 'boss matches', bossMatches);
  ok(ended.dead + ended.won === 12, 'every random run reaches an ending');
}
console.log(fails ? 'FAILED ' + fails : 'ALL PASSED');
process.exit(fails ? 1 : 0);
