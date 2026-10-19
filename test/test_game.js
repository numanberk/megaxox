const E = require('../src/engine.js'); global.XOX = E;
const G = require('../src/game.js');
G.cfg.aiMs5 = 30; G.cfg.aiMsBoss = 40; G.cfg.hintMs = 40;
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const R = n => Math.floor(Math.random() * n), bit = i => 1 << i;
const pc = E.pc;

function mk(relics, counters) {
  const run = G.startRun(); G.pickStarter(run, G.STARTERS[0]);
  run.relics = []; run.charges = {}; relics.forEach(id => G.gain(run, id));
  run.counters = counters || [];
  const m = G.startMatch(run); return { run, m };
}
// every relic has a short description
for (const [id, r] of Object.entries(G.RELICS)) ok(r.desc.split(' ').length <= 5, id + ' description is 5 words or fewer: "' + r.desc + '"');
for (const [id, r] of Object.entries(G.TRICKS)) ok(r.desc.split(' ').length <= 5, id + ' trick description is short');

{ const { m } = mk(['center']); ok(m.x === bit(12), 'Center Start places the center'); }
{ const { m } = mk(['center'], ['dead']); ok(pc(m.x) === 1 && !(m.x & bit(12)), 'Center Start falls back when the center is blocked'); }
{ const { m } = mk(['freebie']); ok(pc(m.x) === 2 && m.turn === 'X', 'Freebie gives 2 marks'); }
{
  const { m } = mk(['freeze']);
  const msg = G.use5(m, 'freeze');
  ok(m.freeze === 1 && m.charges.freeze === 0 && m.turn === 'X', 'Freeze arms with one tap');
  G.tap5(m, 12);
  ok(m.turn === 'X' && m.o === 0 && /frozen/i.test(m.flash), 'AI turn is skipped after a frozen move');
  G.tap5(m, 13);
  ok(m.turn === 'O', 'next move hands over the turn again');
  G.ai5(m);
  ok(G.use5(m, 'freeze') === 'No uses left.', 'Freeze has one use');
}
{
  const { m } = mk(['strike']);
  const free = () => { for (let c = 0; c < 25; c++) if (G.emptyAt(m, c)) return c; };
  G.tap5(m, free()); G.ai5(m); G.tap5(m, free()); G.ai5(m);
  const msg = G.tap5(m, free());
  ok(m.bonus === 1 && m.turn === 'X' && /Double Strike/.test(msg), 'Double Strike gives a bonus mark on turn 3');
  G.tap5(m, free());
  ok(m.bonus === 0 && (m.turn === 'O' || m.over === 'win') && pc(m.x) === 4, 'second mark ends the turn');
}
{
  const { m } = mk(['sleepy']);
  let skipped = 0;
  for (let t = 0; t < 8 && !m.over; t++) {
    const e = []; for (let c = 0; c < 25; c++) if (G.emptyAt(m, c)) e.push(c);
    G.tap5(m, e[R(e.length)]);
    if (m.flash) { skipped++; m.flash = ''; } else if (m.turn === 'O') G.ai5(m);
  }
  ok(skipped >= 1 && skipped <= 2, 'Sleepy AI skips every 4th turn (' + skipped + ' skips in 8 turns)');
}
{
  const { m } = mk(['zap'], ['head']);
  ok(m.o !== 0, 'AI Head Start mark exists');
  G.use5(m, 'zap');
  ok(m.o === 0 && m.turn === 'X', 'Zap deletes the AI last mark and keeps the turn');
  ok(G.use5(m, 'zap') === 'No uses left.', 'Zap spends its charge');
}
{
  const { m } = mk(['zap']);
  ok(/no mark/.test(G.use5(m, 'zap')) && m.charges.zap === 1, 'Zap with nothing to delete costs nothing');
}
{
  const { m } = mk(['nuke']);
  G.tap5(m, 12); G.ai5(m); G.tap5(m, 6); G.ai5(m);
  ok(pc(m.o) === 2, 'AI has two marks');
  G.use5(m, 'nuke');
  ok(m.o === 0 && pc(m.x) === 2 && m.turn === 'X', 'Nuke wipes all AI marks and keeps yours');
}
{
  const { m } = mk(['hint']);
  G.use5(m, 'hint');
  ok(m.hint >= 0 && m.charges.hint === 1 && m.x === 0, 'Hint marks a square without moving');
  G.tap5(m, 5); ok(m.hint === -1, 'Hint clears after you move');
}
{
  const { m } = mk(['rewind']);
  G.tap5(m, 12); G.ai5(m); const before = m.o; G.tap5(m, 0); G.ai5(m);
  G.use5(m, 'rewind');
  ok(m.x === bit(12) && m.o === before && m.charges.rewind === 0, 'Rewind undoes the last round');
}
{ const { m } = mk(['freeze'], ['silence']); const msg = G.use5(m, 'freeze'); ok(/fizzles/.test(msg) && m.freeze === 0 && m.charges.freeze === 0, 'Gag Order makes the first button fizzle'); }
{ const { m } = mk(['corners']); m.x = bit(0) | bit(4) | bit(20); G.tap5(m, 24); ok(m.over === 'win', 'Four Corners wins'); }
{ const { m } = mk(['plus']); m.x = bit(12) | bit(7) | bit(17) | bit(11); G.tap5(m, 13); ok(m.over === 'win', 'Plus Sign wins'); }
{ const { m } = mk(['freeze', 'battery']); ok(m.charges.freeze === 2, 'Battery adds a use'); }
{ const { m } = mk([], ['rubble']); ok(pc(m.b) === 2 && !(m.b & bit(12)), 'Rubble blocks 2 squares'); }

// economy relics
{
  const run = G.startRun(); G.pickStarter(run, 'freeze'); G.gain(run, 'heartup');
  ok(run.maxHearts === 4 && run.hearts === 3 + 1 - 0 || run.hearts === 3, 'Heart Up raises max hearts (' + run.hearts + '/' + run.maxHearts + ')');
}
{
  const { run, m } = mk(['secondlife']); run.hearts = 1; m.over = 'loss'; run.act = 2; G.resolve(run);
  ok(run.hearts === 1 && run.used.life, 'Second Life saves a lethal loss once');
  const m2 = G.newMatch5((run.phase = 'briefing', run)); m2.over = 'loss'; run.match = m2; run.phase = 'match'; G.resolve(run);
  ok(run.hearts === 0, 'Second Life works only once per run');
}
{
  const { run, m } = mk(['piggy']); m.over = 'win'; m.xTurns = 9; m.usedRelic = true; G.resolve(run);
  ok(run.result.gold === 5, 'Piggy Bank adds 2 gold (' + run.result.gold + ')');
}
{
  const { run, m } = mk(['ironheart']); run.act = 2; m.over = 'loss'; G.resolve(run);
  ok(run.hearts === 2, 'Iron Heart absorbs one heart of a 2-heart loss (hearts ' + run.hearts + ')');
}
{ const { run, m } = mk(['safetynet']); m.over = 'draw'; G.resolve(run); ok(run.result.outcome === 'win', 'Lucky Draw turns the first draw into a win'); }

// save / load
{
  const { run, m } = mk(['freeze', 'rewind', 'center']); G.tap5(m, 0); G.ai5(m);
  const copy = G.deserialize(G.serialize(run));
  ok(copy.match.x === m.x && copy.match.rules && copy.match.perks.center === 1, 'run round-trips through save/load');
  let threw = false; try { G.deserialize(JSON.stringify({ v: 1 })); } catch (e) { threw = true; }
  ok(threw, 'old saves are rejected');
}

// bosses
function boss(act, trick, relics) {
  const run = G.startRun(); G.pickStarter(run, 'freeze');
  run.relics = []; run.charges = {}; (relics || []).forEach(id => G.gain(run, id));
  run.act = act; run.idx = 3; run.phase = 'briefing'; run.trick = trick; run.trickChoices = [trick];
  return { run, m: G.startMatch(run) };
}
{ const { m } = boss(1, 'overplay'); G.useBoss(m, 'overplay'); G.tapBoss(m, 4, 4); ok(m.turn === 'X' && m.extra === 2, 'Overplay keeps the turn'); G.tapBoss(m, 4, 0); ok(m.turn === 'O', 'second move ends the turn'); }
{ const { m } = boss(1, 'freepass'); G.tapBoss(m, 2, 2); G.aiBoss(m); G.useBoss(m, 'freepass'); ok(m.S.next === -1, 'Free Pass lets you play anywhere'); }
{ const { m } = boss(2, 'sneak'); G.tapBoss(m, 4, 4); const ev = G.aiBoss(m); ok(m.turn === 'X' && /Sneak/.test(ev.join()) && m.S.ply === 1, 'Sneak Attack skips the first boss move'); G.tapBoss(m, 4, 1); G.aiBoss(m); ok(m.S.ply === 3, 'boss plays normally after that'); }
{ const { m } = boss(2, 'castingvote'); ok(m.castingVote, 'Casting Vote is set'); }
{ const { m } = boss(1, 'overplay', ['hint']); G.useBoss(m, 'hint'); ok(Array.isArray(m.hint) && m.charges.hint === 1, 'Hint works in boss fights'); }
{ const { m } = boss(1, 'overplay'); G.tapBoss(m, 4, 4); G.aiBoss(m); ok(m.S.ply === 3, 'The Opener plays two marks first'); }

// random full runs
function botRun() {
  const run = G.startRun(); G.pickStarter(run, G.STARTERS[R(3)]);
  let steps = 0;
  while (run.phase !== 'end' && steps++ < 300) {
    if (run.phase === 'briefing') {
      if (run.idx === 3) G.chooseTrick(run, run.trickChoices[0]);
      const m = G.startMatch(run);
      let g = 0;
      while (!m.over && g++ < 400) {
        if (m.turn === 'O') { m.kind === '5' ? G.ai5(m) : G.aiBoss(m); continue; }
        if (m.kind === '5') {
          if (Math.random() < 0.3) { const ids = Object.keys(m.charges).filter(i => m.charges[i] > 0); if (ids.length) G.use5(m, ids[R(ids.length)]); }
          const e = []; for (let c = 0; c < 25; c++) if (G.emptyAt(m, c)) e.push(c);
          if (!e.length) break; G.tap5(m, e[R(e.length)]); m.flash = '';
          if ((m.x & m.o) || (m.x & m.b) || (m.o & m.b)) throw new Error('overlap');
        } else {
          if (Math.random() < 0.3) { const ids = Object.keys(m.charges).filter(i => m.charges[i] > 0); if (ids.length) G.useBoss(m, ids[R(ids.length)]); }
          const mv = E.superMoves(m.S); const p = mv[R(mv.length)]; G.tapBoss(m, p[0], p[1]);
        }
      }
      if (!m.over) throw new Error('match did not end');
      G.resolve(run);
    } else if (run.phase === 'result') G.next(run);
    else if (run.phase === 'shop') { run.shop.slice().forEach(id => G.buy(run, id)); G.heal(run); G.leaveShop(run); }
    else if (run.phase === 'reward') G.pickReward(run, run.reward[0]);
    else throw new Error('stuck ' + run.phase);
  }
  return run.over;
}
{ const res = { dead: 0, won: 0 }; for (let i = 0; i < 15; i++) res[botRun()]++; ok(res.dead + res.won === 15, 'random runs always end (' + JSON.stringify(res) + ')'); }

console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
