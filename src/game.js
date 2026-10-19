/* XOX Rogue run logic: relics, matches, run flow. No DOM. Needs XOX (engine.js).
   Relics are deliberately simple: automatic perks, one-tap buttons with no aiming, and plain bonuses. */
var Game = (function (E) {
  'use strict';

  var cfg = { aiMs5: 350, aiMsBoss: 600, hintMs: 250, rng: Math.random };
  function rnd(n) { return Math.floor(cfg.rng() * n); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function BIT(i) { return 1 << i; }
  function has(run, id) { return run.relics.indexOf(id) >= 0; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- content ---------- */
  var RELICS = {
    freeze:     { name: 'Freeze', kind: 'active', charges: 1, price: 6, desc: 'AI skips its next turn.' },
    zap:        { name: 'Zap', kind: 'active', charges: 1, price: 4, desc: "Delete the AI's last mark." },
    nuke:       { name: 'Nuke', kind: 'active', charges: 1, price: 8, desc: 'Wipe every AI mark.' },
    hint:       { name: 'Hint', kind: 'active', charges: 2, price: 3, desc: 'Shows your best move.' },
    rewind:     { name: 'Rewind', kind: 'active', charges: 1, price: 4, desc: 'Undo the last round.' },
    center:     { name: 'Center Start', kind: 'passive', price: 7, desc: 'Start with the center.' },
    freebie:    { name: 'Freebie', kind: 'passive', price: 4, desc: 'Start with 2 free marks.' },
    strike:     { name: 'Double Strike', kind: 'passive', price: 6, desc: 'Every 3rd turn, place 2.' },
    sleepy:     { name: 'Sleepy AI', kind: 'passive', price: 7, desc: 'AI skips every 4th turn.' },
    corners:    { name: 'Four Corners', kind: 'passive', price: 6, desc: 'All 4 corners win.' },
    plus:       { name: 'Plus Sign', kind: 'passive', price: 5, desc: 'Center + 4 sides win.' },
    safetynet:  { name: 'Lucky Draw', kind: 'passive', price: 5, desc: 'First draw each act wins.' },
    heartup:    { name: 'Heart Up', kind: 'passive', price: 5, desc: '+1 heart.' },
    ironheart:  { name: 'Iron Heart', kind: 'passive', price: 5, desc: 'Block 1 hit per act.' },
    secondlife: { name: 'Second Life', kind: 'passive', price: 8, desc: 'Survive one defeat.' },
    piggy:      { name: 'Piggy Bank', kind: 'passive', price: 4, desc: '+2 gold per win.' },
    haggler:    { name: 'Haggler', kind: 'passive', price: 3, desc: 'Shop prices −1.' },
    battery:    { name: 'Battery', kind: 'passive', price: 8, desc: 'Buttons get +1 use.' }
  };
  var STARTERS = ['freeze', 'center', 'strike'];

  var TRICKS = {
    overplay:    { name: 'Overplay', desc: 'Play twice in a row.' },
    freepass:    { name: 'Free Pass', desc: 'Play on any board.' },
    castingvote: { name: 'Casting Vote', desc: 'Tied boards? You win.' },
    sneak:       { name: 'Sneak Attack', desc: 'Boss skips its first move.' }
  };
  var BOSSES = [
    { id: 'opener', name: 'The Opener', twist: 'opener', blurb: 'Plays two marks on its first turn.' },
    { id: 'spinner', name: 'The Spinner', twist: 'spin', blurb: 'The grid turns 90° every 4 moves.' },
    { id: 'curse', name: 'The Curse', twist: 'curse', blurb: 'One board is cursed. Winning it costs you a heart.' }
  ];
  var COUNTERS = {
    head:    { name: 'Head Start', desc: 'AI starts with a mark.' },
    dead:    { name: 'Dead Center', desc: 'The center is blocked.' },
    rubble:  { name: 'Rubble', desc: 'Two squares are blocked.' },
    silence: { name: 'Gag Order', desc: 'Your first button fizzles.' },
    quick:   { name: 'Quick Draw', desc: 'AI plays two marks first.' }
  };

  /* ---------- run ---------- */
  function newRun() {
    return {
      v: 2, phase: 'title', act: 1, idx: 0, hearts: 3, maxHearts: 3, gold: 0,
      relics: [], charges: {}, counters: [], used: { safety: false, thick: false, life: false },
      trick: null, trickChoices: [], shop: [], reward: [], starters: STARTERS.slice(),
      match: null, result: null, over: null,
      stats: { wins: 0, draws: 0, losses: 0, bossWins: 0, matches: 0 }
    };
  }
  function startRun() { var r = newRun(); r.phase = 'starter'; return r; }

  function gain(run, id) {
    if (has(run, id)) return;
    run.relics.push(id);
    var r = RELICS[id];
    if (r.kind === 'active') run.charges[id] = r.charges + (has(run, 'battery') ? 1 : 0);
    if (id === 'battery') Object.keys(run.charges).forEach(function (k) { run.charges[k]++; });
    if (id === 'heartup') { run.maxHearts++; run.hearts = Math.min(run.maxHearts, run.hearts + 1); }
  }
  function refill(run) {
    run.charges = {};
    run.relics.forEach(function (id) {
      var r = RELICS[id];
      if (r.kind === 'active') run.charges[id] = r.charges + (has(run, 'battery') ? 1 : 0);
    });
  }
  function pickStarter(run, id) {
    if (run.starters.indexOf(id) < 0) return;
    gain(run, id);
    run.counters = []; run.trick = null; run.idx = 0; run.act = 1;
    run.phase = 'briefing';
  }
  function rollCounters(act) {
    if (act <= 1) return [];
    var pool = ['head', 'dead', 'rubble', 'silence'];
    if (act >= 3) pool.push('quick');
    return shuffle(pool).slice(0, act === 2 ? 1 : 2);
  }
  function offer(run, n) {
    var pool = Object.keys(RELICS).filter(function (id) { return !has(run, id); });
    return shuffle(pool).slice(0, n);
  }
  function priceOf(run, id) { return Math.max(1, RELICS[id].price - (has(run, 'haggler') ? 1 : 0)); }
  function healPrice(run) { return Math.max(1, 4 - (has(run, 'haggler') ? 1 : 0)); }

  function buy(run, id) {
    if (run.phase !== 'shop' || run.shop.indexOf(id) < 0) return 'Not for sale.';
    var p = priceOf(run, id);
    if (run.gold < p) return 'Not enough gold.';
    run.gold -= p; gain(run, id); run.shop.splice(run.shop.indexOf(id), 1);
    return 'Bought ' + RELICS[id].name + '.';
  }
  function heal(run) {
    var p = healPrice(run);
    if (run.hearts >= run.maxHearts) return 'Hearts are full.';
    if (run.gold < p) return 'Not enough gold.';
    run.gold -= p; run.hearts++;
    return 'Healed a heart.';
  }
  function leaveShop(run) { advance(run); }
  function pickReward(run, id) {
    if (run.phase !== 'reward' || run.reward.indexOf(id) < 0) return;
    gain(run, id); advance(run);
  }
  function chooseTrick(run, id) { if (run.trickChoices.indexOf(id) >= 0) run.trick = id; }

  function advance(run) {
    run.match = null; run.result = null;
    if (run.idx === 3) {
      if (run.act === 3) { run.over = 'won'; run.phase = 'end'; return; }
      run.act++; run.idx = 0; run.used.safety = false; run.used.thick = false; refill(run);
    } else run.idx++;
    run.counters = run.idx < 3 ? rollCounters(run.act) : [];
    run.trick = null;
    run.trickChoices = run.idx === 3 ? shuffle(Object.keys(TRICKS)).slice(0, 3) : [];
    run.phase = 'briefing';
  }

  function next(run) {
    if (run.phase !== 'result') return;
    var out = run.result;
    if (run.hearts <= 0) { run.over = 'dead'; run.phase = 'end'; run.match = null; return; }
    if (out.boss) {
      if (out.outcome === 'win') { run.reward = offer(run, 3); run.match = null; run.phase = 'reward'; return; }
      advance(run); return;
    }
    if (out.outcome === 'win') { run.shop = offer(run, 3); run.match = null; run.phase = 'shop'; return; }
    advance(run);
  }

  function startMatch(run) {
    if (run.phase !== 'briefing') return null;
    if (run.idx === 3) { if (!run.trick) return null; run.match = newMatchBoss(run); }
    else run.match = newMatch5(run);
    run.phase = 'match';
    return run.match;
  }

  function resolve(run) {
    var m = run.match, act = run.act;
    var out = { boss: m.kind === 'boss', outcome: null, gold: 0, hearts: 0, bonuses: [], notes: [], absorbed: 0 };
    var o = m.over;
    if (m.kind === '5') {
      if (o === 'draw' && has(run, 'safetynet') && !run.used.safety) { run.used.safety = true; o = 'win'; out.notes.push('Lucky Draw turns the draw into a win.'); }
      out.outcome = o;
      if (o === 'win') {
        out.gold = 3;
        if (has(run, 'piggy')) { out.gold += 2; out.bonuses.push(['Piggy Bank', 2]); }
        if (m.xTurns <= 6 && m.over === 'win') { out.gold += 2; out.bonuses.push(['Quick win', 2]); }
        if (!m.usedRelic && m.over === 'win') { out.gold += 2; out.bonuses.push(['No buttons used', 2]); }
      } else if (o === 'draw') out.hearts = act === 1 ? 0 : 1;
      else out.hearts = act === 1 ? 1 : 2;
    } else {
      var oBoards = 0; for (var i = 0; i < 9; i++) if (m.S.res[i] === 2) oBoards++;
      out.outcome = o;
      if (o === 'win') {
        out.gold = 6;
        if (has(run, 'piggy')) { out.gold += 2; out.bonuses.push(['Piggy Bank', 2]); }
      } else if (o === 'draw') out.hearts = 1;
      else out.hearts = Math.max(1, Math.min(2, oBoards));
      if (m.curseHearts > 0) { out.hearts += m.curseHearts; out.notes.push('The curse costs you ' + m.curseHearts + (m.curseHearts > 1 ? ' hearts.' : ' heart.')); }
    }
    if (out.hearts > 0 && has(run, 'ironheart') && !run.used.thick) {
      run.used.thick = true; out.hearts--; out.absorbed = 1; out.notes.push('Iron Heart blocks one heart.');
    }
    run.hearts = Math.max(0, run.hearts - out.hearts);
    if (run.hearts <= 0 && has(run, 'secondlife') && !run.used.life) {
      run.used.life = true; run.hearts = 1; out.notes.push('Second Life saves you with 1 heart.');
    }
    run.gold += out.gold;
    run.stats.matches++;
    if (out.outcome === 'win') { run.stats.wins++; if (out.boss) run.stats.bossWins++; }
    else if (out.outcome === 'draw') run.stats.draws++; else run.stats.losses++;
    if (m.kind === '5') run.charges = copy(m.charges);
    else ['rewind', 'hint'].forEach(function (k) { if (m.charges[k] !== undefined) run.charges[k] = m.charges[k]; });
    run.result = out; run.phase = 'result';
    return out;
  }

  /* ---------- 5x5 match ---------- */
  function rulesFor(run) {
    var ex = [];
    if (has(run, 'corners')) ex.push(E.PATTERNS.corners);
    if (has(run, 'plus')) ex.push(E.PATTERNS.plus);
    return E.makeRules(ex);
  }
  function emptyAt(m, c) { return !((m.x | m.o | m.b) & BIT(c)); }
  function countEmpty(m) { var n = 0; for (var c = 0; c < 25; c++) if (emptyAt(m, c)) n++; return n; }
  function hasCharge(m, id) { return (m.charges[id] || 0) > 0; }
  function randEmpty(m, n, skip) {
    var a = []; for (var c = 0; c < 25; c++) if (c !== skip && emptyAt(m, c)) a.push(c);
    return shuffle(a).slice(0, n);
  }
  function addAIMark(m, c) { m.o |= BIT(c); m.aiMarks++; m.lastAI = c; }

  var SNAP_KEYS = ['x', 'o', 'b', 'xTurns', 'aiMarks', 'silenceLeft', 'quickLeft', 'lastAI', 'freeze', 'aiDue', 'bonus', 'hint'];
  function snap5(m) { var s = { charges: copy(m.charges) }; SNAP_KEYS.forEach(function (k) { s[k] = m[k]; }); return s; }
  function restore5(m, s) { SNAP_KEYS.forEach(function (k) { m[k] = s[k]; }); m.charges = copy(s.charges); }
  function pushSnap(m) { m.hist.push(m.kind === '5' ? snap5(m) : snapB(m)); if (m.hist.length > 40) m.hist.shift(); }

  function newMatch5(run) {
    var perks = {};
    run.relics.forEach(function (id) { perks[id] = 1; });
    var m = {
      kind: '5', rules: rulesFor(run), x: 0, o: 0, b: 0, turn: 'X', over: null, winMask: 0,
      counters: run.counters.slice(), charges: copy(run.charges), perks: perks, usedRelic: false,
      xTurns: 0, aiMarks: 0, silenceLeft: 0, quickLeft: 0, freeze: 0, aiDue: 0, bonus: 0,
      hist: [], lastAI: -1, hint: -1, flash: ''
    };
    var cs = m.counters;
    if (cs.indexOf('dead') >= 0) m.b |= BIT(12);
    if (cs.indexOf('rubble') >= 0) randEmpty(m, 2, 12).forEach(function (c) { m.b |= BIT(c); });
    if (cs.indexOf('silence') >= 0) m.silenceLeft = 1;
    if (cs.indexOf('quick') >= 0) m.quickLeft = 1;
    if (cs.indexOf('head') >= 0) addAIMark(m, randEmpty(m, 1, 12)[0]);
    if (perks.center) {
      var order = [12, 7, 11, 13, 17, 6, 8, 16, 18];
      for (var i = 0; i < order.length; i++) if (emptyAt(m, order[i])) { m.x |= BIT(order[i]); break; }
    }
    if (perks.freebie) randEmpty(m, 2, -1).forEach(function (c) { m.x |= BIT(c); });
    pushSnap(m);
    return m;
  }

  function checkEnds(m) {
    var xl = E.lineWon(m.x, m.rules.lines[0]);
    if (xl) { m.over = 'win'; m.winMask = xl; return true; }
    var ol = E.lineWon(m.o, m.rules.lines[1]);
    if (ol) { m.over = 'loss'; m.winMask = ol; return true; }
    return false;
  }
  function alive(m) {
    var lx = m.rules.lines[0], lo = m.rules.lines[1], i, l;
    for (i = 0; i < lx.length; i++) { l = lx[i]; if (!(l & m.b) && !(l & m.o)) return true; }
    for (i = 0; i < lo.length; i++) { l = lo[i]; if (!(l & m.b) && !(l & m.x)) return true; }
    return false;
  }
  function checkDraw(m) {
    if (countEmpty(m) === 0) { m.over = 'draw'; return true; }
    if (!alive(m) && !hasCharge(m, 'zap') && !hasCharge(m, 'nuke')) { m.over = 'draw'; return true; }
    return false;
  }

  /* called when the player's turn ends: handles skipped AI turns */
  function endTurn5(m) {
    m.xTurns++; m.hint = -1;
    if (m.over) return;
    if (checkDraw(m)) return;
    m.aiDue++;
    var why = '';
    if (m.freeze > 0) { m.freeze = 0; why = 'The AI is frozen and skips its turn.'; }
    else if (m.perks.sleepy && m.aiDue % 4 === 0) why = 'Sleepy AI skips its turn.';
    if (why) { m.flash = why; m.turn = 'X'; pushSnap(m); return; }
    m.turn = 'O';
  }
  function spend(m, id) {
    m.charges[id]--; m.usedRelic = true;
    if (m.silenceLeft > 0) { m.silenceLeft--; return false; }
    return true;
  }
  function rewind(m) {
    if (m.hist.length < 2) return 'Nothing to rewind yet.';
    var left = m.charges.rewind - 1;
    m.hist.pop();
    var s = m.hist.pop();
    if (m.kind === '5') restore5(m, s); else restoreB(m, s);
    m.charges.rewind = left; m.usedRelic = true; m.over = null; m.winMask = 0; m.turn = 'X';
    m.hint = m.kind === '5' ? -1 : null;
    pushSnap(m);
    return 'Time rewinds.';
  }

  /* one-tap buttons. Returns a message. */
  function use5(m, id) {
    if (m.over || m.turn !== 'X') return 'Wait for your turn.';
    var r = RELICS[id];
    if (!r || r.kind !== 'active') return null;
    if (m.bonus) return 'Place your second mark first.';
    if (!hasCharge(m, id)) return 'No uses left.';
    if (id === 'rewind') return rewind(m);
    if (id === 'freeze' && m.freeze) return 'The AI is already frozen.';
    if (id === 'zap' && !(m.lastAI >= 0 && (m.o & BIT(m.lastAI)))) return 'The AI has no mark to zap.';
    if (id === 'nuke' && !m.o) return 'The AI has no marks yet.';
    if (!spend(m, id)) return 'Gag Order: ' + r.name + ' fizzles.';
    switch (id) {
      case 'freeze': m.freeze = 1; return 'Frozen! You get two moves.';
      case 'zap': m.o &= ~BIT(m.lastAI); m.lastAI = -1; return 'Zapped. Your move.';
      case 'nuke': m.o = 0; m.lastAI = -1; return 'All AI marks wiped. Your move.';
      case 'hint':
        var res = E.search5({ x: m.x, o: m.o, b: m.b, ban: 0 }, m.rules, 0, cfg.hintMs);
        m.hint = res.move;
        return res.move >= 0 ? 'Best move marked.' : 'No moves left.';
    }
    return null;
  }

  function tap5(m, c) {
    if (m.over || m.turn !== 'X') return null;
    if (!emptyAt(m, c)) return 'That square is taken.';
    m.x |= BIT(c); m.hint = -1; m.lastX = c;
    checkEnds(m);
    if (m.over || m.bonus) { m.bonus = 0; endTurn5(m); return null; }
    if (m.perks.strike && m.xTurns % 3 === 2 && countEmpty(m) > 0) { m.bonus = 1; return 'Double Strike! Place one more.'; }
    endTurn5(m);
    return null;
  }

  function ai5(m) {
    var ev = [];
    if (m.over || m.turn !== 'O') return ev;
    var n = m.quickLeft > 0 ? 2 : 1;
    if (m.quickLeft > 0) m.quickLeft--;
    for (var k = 0; k < n; k++) {
      var res = E.search5({ x: m.x, o: m.o, b: m.b, ban: 0 }, m.rules, 1, cfg.aiMs5);
      if (res.move < 0) { ev.push('The AI has no legal move.'); break; }
      addAIMark(m, res.move);
      var ol = E.lineWon(m.o, m.rules.lines[1]);
      if (ol) { m.over = 'loss'; m.winMask = ol; break; }
    }
    if (!m.over && !checkDraw(m)) { m.turn = 'X'; pushSnap(m); }
    return ev;
  }

  /* ---------- boss match (Super XOX) ---------- */
  function newMatchBoss(run) {
    var boss = BOSSES[run.act - 1];
    var m = {
      kind: 'boss', boss: boss, twist: boss.twist,
      S: E.newSuper({ spin: boss.twist === 'spin', cursed: boss.twist === 'curse' ? rnd(9) : -1 }),
      turn: 'X', over: null, charges: {}, trick: run.trick, extra: 0, openerDone: false,
      sneak: run.trick === 'sneak', sneakUsed: false, castingVote: run.trick === 'castingvote',
      curseHearts: 0, hist: [], last: null, lastAI: null, usedRelic: false, xTurns: 0, hint: null, rotatedNow: false, flash: ''
    };
    var bat = has(run, 'battery') ? 1 : 0;
    if (run.trick === 'overplay' || run.trick === 'freepass') m.charges[run.trick] = 1 + bat;
    ['rewind', 'hint'].forEach(function (k) { if (run.charges[k] !== undefined) m.charges[k] = run.charges[k]; });
    pushSnap(m);
    return m;
  }
  var SNAP_B = ['S', 'extra', 'openerDone', 'sneakUsed', 'curseHearts', 'xTurns', 'last', 'lastAI', 'hint'];
  function snapB(m) { var s = { charges: copy(m.charges) }; SNAP_B.forEach(function (k) { s[k] = m[k]; }); return s; }
  function restoreB(m, s) { SNAP_B.forEach(function (k) { m[k] = s[k]; }); m.charges = copy(s.charges); }
  function withNext(S, n) { var T = E.cloneSuper(S); T.next = n; return T; }

  function useBoss(m, id) {
    if (m.over || m.turn !== 'X') return 'Wait for your turn.';
    if (m.extra === 2) return 'Make your second move first.';
    if (!(m.charges[id] > 0)) return 'No uses left.';
    if (id === 'rewind') return rewind(m);
    if (id === 'hint') {
      m.charges.hint--; m.usedRelic = true;
      var r = E.searchSuper(m.S, 0, cfg.hintMs);
      m.hint = r ? [r.b, r.c] : null;
      return r ? 'Best move marked.' : 'No moves left.';
    }
    if (id === 'freepass') {
      if (m.S.next < 0) return 'You can already play anywhere.';
      m.charges[id]--; m.usedRelic = true; m.S = withNext(m.S, -1); return 'Play on any board.';
    }
    if (id === 'overplay') {
      if (m.extra) return 'Already armed. Make your moves.';
      m.charges[id]--; m.usedRelic = true; m.extra = 1; return 'Play twice this turn.';
    }
    return null;
  }

  function legalBoss(m, b, c) { return E.superMoves(m.S).some(function (mv) { return mv[0] === b && mv[1] === c; }); }

  function playBoss(m, b, c, side) {
    var T = E.applySuper(m.S, b, c, side);
    m.S = T; m.last = { b: b, c: c, side: side }; m.rotatedNow = false;
    if (T.rotated) {
      m.rotatedNow = true;
      m.last = { b: E.ROT[b], c: E.ROT[c], side: side };
      if (m.lastAI) m.lastAI = { b: E.ROT[m.lastAI.b], c: E.ROT[m.lastAI.c] };
    }
    var notes = [];
    if (side === 0 && T.won >= 0 && T.won === T.cursed && T.res[T.won] === 1) { m.curseHearts++; notes.push('You won the cursed board. That costs a heart.'); }
    if (T.cursedVoid) notes.push('The curse voids the boss win.');
    if (T.rotated) notes.push('The grid turns.');
    var r = E.superResult(T);
    if (r !== 0) {
      if (r === 3 && m.castingVote) r = 1;
      m.over = r === 1 ? 'win' : (r === 2 ? 'loss' : 'draw');
    }
    return notes.join(' ') || null;
  }

  function tapBoss(m, b, c) {
    if (m.over || m.turn !== 'X') return null;
    if (!legalBoss(m, b, c)) return m.S.next >= 0 ? 'Play in the highlighted board.' : 'That board is finished.';
    var note = playBoss(m, b, c, 0);
    m.hint = null;
    if (m.over) { m.xTurns++; return note; }
    if (m.extra === 1) { m.extra = 2; return (note ? note + ' ' : '') + 'Play again.'; }
    if (m.extra === 2) m.extra = 0;
    m.xTurns++; m.turn = 'O';
    return note;
  }

  function aiBoss(m) {
    var ev = [];
    if (m.over || m.turn !== 'O') return ev;
    if (m.sneak && !m.sneakUsed) {
      m.sneakUsed = true; m.turn = 'X'; pushSnap(m);
      return ['Sneak Attack! The boss skips its first move.'];
    }
    var n = (m.twist === 'opener' && !m.openerDone) ? 2 : 1;
    m.openerDone = true;
    for (var k = 0; k < n; k++) {
      var res = E.searchSuper(m.S, 1, cfg.aiMsBoss);
      if (!res) break;
      var note = playBoss(m, res.b, res.c, 1);
      m.lastAI = { b: m.last.b, c: m.last.c };
      if (note) ev.push(note);
      if (m.over) break;
    }
    if (!m.over) { m.turn = 'X'; pushSnap(m); }
    return ev;
  }

  /* ---------- save / load ---------- */
  function serialize(run) {
    return JSON.stringify(run, function (k, v) {
      if (k === 'rules') return undefined;
      if (v && (v instanceof Int16Array || v instanceof Int8Array)) return { __ta: v instanceof Int16Array ? 16 : 8, a: Array.prototype.slice.call(v) };
      return v;
    });
  }
  function deserialize(str) {
    var run = JSON.parse(str, function (k, v) {
      if (v && v.__ta) return v.__ta === 16 ? new Int16Array(v.a) : new Int8Array(v.a);
      return v;
    });
    if (run.v !== 2) throw new Error('old save');
    if (run.match && run.match.kind === '5') run.match.rules = rulesFor(run);
    return run;
  }

  return {
    cfg: cfg, RELICS: RELICS, STARTERS: STARTERS, TRICKS: TRICKS, BOSSES: BOSSES, COUNTERS: COUNTERS,
    newRun: newRun, startRun: startRun, pickStarter: pickStarter, startMatch: startMatch, chooseTrick: chooseTrick,
    resolve: resolve, next: next, buy: buy, heal: heal, leaveShop: leaveShop, pickReward: pickReward,
    priceOf: priceOf, healPrice: healPrice, has: has, gain: gain, advance: advance, refill: refill,
    use5: use5, tap5: tap5, ai5: ai5, useBoss: useBoss, tapBoss: tapBoss, aiBoss: aiBoss, legalBoss: legalBoss,
    serialize: serialize, deserialize: deserialize, emptyAt: emptyAt, hasCharge: hasCharge,
    newMatch5: newMatch5, newMatchBoss: newMatchBoss
  };
})(XOX);
if (typeof module !== 'undefined' && module.exports) module.exports = Game;
