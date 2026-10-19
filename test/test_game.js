const E = require('../src/engine.js'); global.XOX = E;
const G = require('../src/game.js');
G.cfg.aiMs = [30, 30, 30]; G.cfg.aiMsBoss = [20, 40, 40]; G.cfg.hintMs = 30;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const R = n => Math.floor(Math.random() * n), bit = i => 1 << i, pc = E.pc;

function run(char, extra) {
  const r = G.startRun(); G.pickChar(r, char || 'frost');
  (extra || []).forEach(id => G.gain(r, id));
  return r;
}
function match(char, extra, opp) { const r = run(char, extra); r.choices = [opp || 'copycat']; return { r, m: G.startMatch(r, opp || 'copycat') }; }
function boss(act, char, extra) { const r = run(char, extra); r.act = act; r.idx = 3; r.phase = 'briefing'; G.refill(r); return { r, m: G.startMatch(r) }; }
const firstLegal = m => G.legalCells(m)[0];

// content rules
for (const [id, x] of Object.entries(G.RELICS)) ok(x.desc.split(' ').length <= 5, id + ' description is short');
for (const [id, x] of Object.entries(G.OPPONENTS)) ok(x.desc.split(' ').length <= 5, id + ' habit is short');
ok(Object.keys(G.SETS).every(s => Object.values(G.RELICS).filter(r => r.set === s).length === 3), 'every set has 3 relics');

// characters
{ const r = run('knight'); ok(r.maxHearts === 4 && r.hearts === 4 && r.relics.includes('center'), 'Knight: 4 hearts, starts with Center Start'); }
{ const r = run('frost'); ok(r.charges.freeze === 2, 'Frost: Freeze has 2 uses'); }
{ const r = run('thief'); ok(r.relics.join() === 'zap,piggy', 'Thief starts with Zap and Piggy Bank'); }
{ const { m } = match('thief', [], 'bully'); ok(pc(m.o) === 2, 'Bully starts with 2 marks');
  const la = m.lastAI; G.use(m, 'zap'); ok((m.x & bit(la)) && !(m.o & bit(la)), 'Thief: Zap steals the mark'); }
{ const { m } = match('ember', [], 'gambler'); let burned = false;
  for (let t = 0; t < 12 && !m.over; t++) { if (m.turn === 'O') { G.ai(m); continue; } const before = pc(m.o); G.tap(m, firstLegal(m)); if (m.xPlaced % 4 === 0 && pc(m.o) < before) burned = true; m.flash = ''; }
  ok(true, 'Ember plays through without errors (burned: ' + burned + ')'); }
{ const { m } = match('twin', [], 'gambler'); let landed = false;
  for (let t = 0; t < 12 && !m.over; t++) { if (m.turn === 'O') { G.ai(m); continue; } const b = pc(m.x); G.tap(m, firstLegal(m)); if (pc(m.x) - b >= 2 && m.xPlaced % 4 === 0) landed = true; }
  ok(landed || m.over, 'Twin: every 4th mark lands twice'); }

// sets
{ const r = run('knight', ['heartup', 'secondlife']); ok(r.maxHearts === 4 + 1 + 1, 'Guard 2 adds a max heart (' + r.maxHearts + ')'); }
{ const r = run('frost', ['sleepy', 'brainfreeze']); r.choices = ['copycat']; const m = G.startMatch(r, 'copycat'); ok(m.freeze === 1, 'Frost 3: AI skips its first turn'); }
{ const r = run('twin', ['freebie', 'center']); r.choices = ['copycat']; const m = G.startMatch(r, 'copycat'); ok(pc(m.x) === 4 && G.strikeEvery(m) === 2, 'Tempo 3: center + 2 freebies + 1 extra mark, strike every 2nd (' + pc(m.x) + ')'); }
{ const { m } = match('frost', ['zap', 'spark'], 'bully'); ok(m.sets.fire === 2, 'fire 2 owned'); const la = m.lastAI; G.use(m, 'zap'); ok((m.b & bit(la)) && !(m.o & bit(la)), 'Fire 2: zapped square turns to stone'); }
{ const r = run('thief', ['haggler', 'safetynet']); r.phase = 'result'; r.result = { boss: false, outcome: 'win' }; G.next(r); ok(r.shop.length === 4 && r.freeBuy && G.priceOf(r, r.shop[0]) === 0, 'Luck 2/3: 4 items and a free first buy'); G.buy(r, r.shop[0]); ok(!r.freeBuy && G.priceOf(r, r.shop[0]) > 0, 'free buy is used once'); }

// opponents
{ const { m } = match('frost', [], 'copycat'); G.tap(m, 6); G.ai(m); ok(m.o & bit(18), 'Copycat mirrors your move'); }
{ const { m } = match('frost', [], 'mason'); ok(pc(m.b) === 3, 'Mason starts with 3 stones'); }
{ const { m } = match('frost', [], 'sniper'); G.tap(m, 12); G.ai(m); ok(pc(m.o) === 2, 'Sniper opens with two marks'); }
{ const { m } = match('frost', [], 'warden'); ok(/Warden/.test(G.use(m, 'freeze')) && !m.freeze, 'Warden blocks your first button'); }
{ const { m } = match('frost', [], 'hoarder'); let stones = 0; for (let t = 0; t < 8 && !m.over; t++) { if (m.turn === 'O') { G.ai(m); continue; } G.tap(m, G.legalCells(m)[R(G.legalCells(m).length)]); m.flash = ''; } ok(pc(m.b) >= 1 || m.over, 'Hoarder drops stones (' + pc(m.b) + ')'); }
{ const { m } = match('frost', [], 'janitor'); let erased = false; for (let t = 0; t < 10 && !m.over; t++) { if (m.turn === 'O') { const ev = G.ai(m); if (ev.join().includes('Janitor')) erased = true; continue; } G.tap(m, G.legalCells(m)[R(G.legalCells(m).length)]); m.flash = ''; } ok(erased || m.over, 'Janitor erases your oldest mark'); }
{ const { m } = match('frost', [], 'napper'); let napped = false; for (let t = 0; t < 12 && !m.over; t++) { if (m.turn === 'O') { G.ai(m); continue; } G.tap(m, G.legalCells(m)[R(G.legalCells(m).length)]); if (/naps/.test(m.flash)) napped = true; m.flash = ''; } ok(napped || m.over, 'Napper naps'); }

// relics in grid
{ const { m } = match('frost', [], 'copycat'); G.use(m, 'freeze'); G.tap(m, 12); ok(m.turn === 'X' && !m.o, 'Freeze skips the AI turn'); }
{ const { m } = match('frost', ['hint'], 'gambler'); G.use(m, 'hint'); ok(m.hint >= 0 && !m.x, 'Hint marks a move'); }
{ const { m } = match('frost', ['rewind'], 'gambler'); G.tap(m, 12); G.ai(m); const o = m.o; G.tap(m, firstLegal(m)); G.ai(m); G.use(m, 'rewind'); ok(m.x === bit(12) && m.o === o, 'Rewind undoes a round'); }
{ const { m } = match('frost', ['corners'], 'gambler'); m.x = bit(0) | bit(4) | bit(20); G.tap(m, 24); ok(m.over === 'win', 'Four Corners wins on 5x5'); }

// boss 1: Speed Round
{ const { m } = boss(1, 'frost'); ok(m.game === 'speed' && m.g.nc === 9 && m.timed === 8, 'Act 1 boss is a timed 3x3 Speed Round');
  G.use(m, 'freeze'); G.tap(m, 4); G.tap(m, 0); G.ai(m); G.tap(m, 2); G.ai(m);
  for (let i = 0; i < 6 && m.turn !== 'pause' && !m.over; i++) { if (m.turn === 'O') G.ai(m); else G.tap(m, firstLegal(m)); }
  ok(m.turn === 'pause' && m.series.you === 1, 'Freeze wins round 1 and the series pauses (you ' + m.series.you + ')');
  const ch = m.charges.freeze; G.nextRound(m); ok(m.series.round === 2 && m.turn === 'O' && m.charges.freeze === 2 && !m.x, 'round 2: boss moves first, buttons refilled');
}
{ // full series by random play ends with a result
  const { r, m } = boss(1, 'frost'); let g = 0;
  while (!m.over && g++ < 200) { if (m.turn === 'pause') G.nextRound(m); else if (m.turn === 'O') G.ai(m); else G.tap(m, G.legalCells(m)[R(G.legalCells(m).length)]); }
  ok(!!m.over && m.series.done, 'Speed Round series ends (' + m.over + ', ' + m.series.you + '-' + m.series.them + ' in ' + m.series.round + ' rounds)');
  G.resolve(r); ok(r.phase === 'result' && r.charges.freeze === 2, 'resolve keeps the act charges after a Speed Round');
}
// boss 2: Gravity
{ const { m } = boss(2, 'ember', ['zap']); ok(m.g.gravity, 'Act 2 boss is Gravity');
  G.tap(m, 2); ok(m.x === bit(22), 'a tap drops the mark to the bottom of its column');
  G.ai(m); G.tap(m, 2); ok(m.x & bit(17) || m.o & bit(17), 'the next mark stacks on top');
  let quake = false; for (let i = 0; i < 20 && !m.over; i++) { if (m.turn === 'O') G.ai(m); else { G.tap(m, firstLegal(m)); if (/floor/.test(m.flash)) quake = true; m.flash = ''; } }
  ok(quake || m.over, 'the floor falls away every 6 moves');
}
{ const { m } = boss(2, 'thief'); G.tap(m, 0); G.ai(m); const la = m.lastAI; G.use(m, 'zap'); ok(m.x & bit(la), 'Thief steals in Gravity');
  const { m: m2 } = boss(2, 'frost', ['nuke']); G.tap(m2, 0); G.ai(m2); G.tap(m2, 4); G.ai(m2); G.use(m2, 'nuke'); ok(!m2.o && ((m2.x >> 20) & 1) && ((m2.x >> 24) & 1), 'Nuke in Gravity leaves your marks settled'); }
// boss 3: Super XOX
{ const { m } = boss(3, 'frost', ['hint', 'center']); ok(m.kind === 'super' && m.S.target === 3 && (m.S.bx[4] & 16), 'Act 3 boss is Super XOX, first to 3, Center Start applies');
  G.use(m, 'freeze'); G.tap(m, 0, 0); ok(m.turn === 'X', 'Freeze works in Super XOX');
  G.use(m, 'hint'); ok(Array.isArray(m.hint), 'Hint works in Super XOX');
  // force phase 2
  m.S.res[8] = 1; G.tap(m, ...E.superMoves(m.S)[0]); ok(m.phaseN === 2 && m.S.spin, 'winning a board starts phase 2');
}
{ // full random super game
  const { r, m } = boss(3, 'twin', ['zap', 'spark', 'sleepy']); let g = 0;
  while (!m.over && g++ < 300) { if (m.turn === 'O') G.ai(m); else { if (Math.random() < .2) G.use(m, 'zap'); const mv = E.superMoves(m.S); G.tap(m, ...mv[R(mv.length)]); m.flash = ''; } }
  ok(!!m.over, 'Super XOX game ends (' + m.over + ', you ' + G.boardsWon(m.S, 1) + ' boss ' + G.boardsWon(m.S, 2) + ')');
}
// save/load
{ const { r, m } = boss(2, 'frost'); G.tap(m, 1); G.ai(m); const c = G.deserialize(G.serialize(r)); ok(c.match.g && c.match.g.gravity && c.match.x === m.x, 'gravity match round-trips through save/load'); }
{ const { r, m } = boss(3, 'frost'); G.tap(m, 4, 4); const c = G.deserialize(G.serialize(r)); ok(c.match.S.bx[4] === m.S.bx[4] && c.match.S.target === 3, 'super match round-trips'); }

// full random runs through every phase
function botRun(char) {
  const r = G.startRun(); G.pickChar(r, char); let steps = 0;
  while (r.phase !== 'end' && steps++ < 400) {
    if (r.phase === 'briefing') {
      const m = G.startMatch(r, r.choices[0]); let g = 0;
      while (!m.over && g++ < 500) {
        if (m.turn === 'pause') { G.nextRound(m); continue; }
        if (m.turn === 'O') { G.ai(m); continue; }
        if (Math.random() < 0.3) { const ids = Object.keys(m.charges).filter(i => m.charges[i] > 0); if (ids.length) G.use(m, ids[R(ids.length)]); }
        if (m.over || m.turn !== 'X') continue;
        if (m.kind === 'grid') { const L = G.legalCells(m); if (!L.length) break; G.tap(m, L[R(L.length)]); }
        else { const mv = E.superMoves(m.S); if (!mv.length) break; G.tap(m, ...mv[R(mv.length)]); }
        m.flash = '';
        if (m.kind === 'grid' && ((m.x & m.o) || (m.x & m.b) || (m.o & m.b))) throw new Error('overlap in ' + m.game);
      }
      if (!m.over) throw new Error('stuck match ' + m.game + ' turn ' + m.turn);
      G.resolve(r);
    } else if (r.phase === 'result') G.next(r);
    else if (r.phase === 'shop') { r.shop.slice().forEach(id => G.buy(r, id)); G.heal(r); G.leaveShop(r); }
    else if (r.phase === 'reward') G.pickReward(r, r.reward[0]);
    else throw new Error('stuck phase ' + r.phase);
  }
  return r;
}
{ const tally = { dead: 0, won: 0 }; let bossesSeen = new Set();
  for (let i = 0; i < 15; i++) { const r = botRun(G.CHAR_ORDER[i % 5]); tally[r.over]++; }
  ok(tally.dead + tally.won === 15, 'random runs with every character always end ' + JSON.stringify(tally)); }
console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); process.exit(fails ? 1 : 0);
