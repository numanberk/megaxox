const E = require('../src/engine.js'); global.XOX = E;
const G = require('../src/game.js');
G.cfg.aiMs5 = 20; G.cfg.aiMsBoss = 30;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const R = n => Math.floor(Math.random() * n);
// Force-win normal matches to walk every phase through to victory; play bosses with a random bot.
const run = G.startRun(); G.pickStarter(run, 'doubletap'); run.hearts = 3;
const phases = new Set(); let guard = 0, bossesSeen = 0, rewards = 0, shops = 0;
while (run.phase !== 'end' && guard++ < 100) {
  phases.add(run.phase);
  if (run.phase === 'briefing') {
    if (run.idx === 3) { G.chooseTrick(run, run.trickChoices[0]); }
    const m = G.startMatch(run);
    if (m.kind === '5') { m.over = 'win'; m.xTurns = 3; m.usedRelic = false; }
    else {
      bossesSeen++;
      let g2 = 0; while (!m.over && g2++ < 300) {
        if (m.turn === 'O') { G.aiBoss(m); continue; }
        const mv = E.superMoves(m.S); const p = mv[R(mv.length)]; G.tapBoss(m, p[0], p[1]);
      }
      if (bossesSeen === 1) { m.over = 'win'; } // make sure the reward path runs
    }
    G.resolve(run);
    run.hearts = Math.max(run.hearts, 1);
  } else if (run.phase === 'result') G.next(run);
  else if (run.phase === 'shop') { shops++; const id = run.shop[0]; G.buy(run, id); G.heal(run); G.leaveShop(run); }
  else if (run.phase === 'reward') { rewards++; G.pickReward(run, run.reward[0]); }
}
ok(run.over === 'won', 'forced run reaches victory (over=' + run.over + ', act ' + run.act + ', idx ' + run.idx + ')');
ok(bossesSeen === 3, 'three bosses fought (' + bossesSeen + ')');
ok(shops === 9, 'nine shop visits (' + shops + ')');
ok(rewards >= 1, 'boss reward offered (' + rewards + ')');
ok(['briefing', 'result', 'shop', 'reward', 'end'].every(p => phases.has(p) || p === 'end'), 'visited phases: ' + [...phases].join(','));
// counters roll by act
const c2 = []; for (let i = 0; i < 50; i++) c2.push(G.advance.length);
console.log('relics at end:', run.relics.join(','), 'gold', run.gold, 'hearts', run.hearts + '/' + run.maxHearts);
console.log(fails ? 'FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
