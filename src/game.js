/* XOX Rogue run logic: relics, matches, run flow. No DOM. Needs XOX (engine.js). */
var Game = (function (E) {
  'use strict';

  var cfg = { aiMs5: 350, aiMsBoss: 600, oracleMs: 200, rng: Math.random };
  function rnd(n) { return Math.floor(cfg.rng() * n); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function BIT(i) { return 1 << i; }
  function has(run, id) { return run.relics.indexOf(id) >= 0; }

  /* ---------- content ---------- */
  var RELICS = {
    doubletap:  { name: 'Double Tap', kind: 'active', charges: 1, price: 6, free: false, desc: 'Place two marks in one turn.', hint: 'Tap two empty squares.' },
    turncoat:   { name: 'Turncoat', kind: 'active', charges: 1, price: 6, free: false, desc: 'Turn one AI mark into yours. Uses your turn.', hint: 'Tap an AI mark.' },
    eraser:     { name: 'Eraser', kind: 'active', charges: 1, price: 4, free: true, desc: 'Remove one AI mark, then place as usual.', hint: 'Tap an AI mark.' },
    switcheroo: { name: 'Switcheroo', kind: 'active', charges: 1, price: 5, free: true, desc: 'Swap two marks of different sides.', hint: 'Tap one of your marks, then an AI mark.' },
    bomb:       { name: 'Bomb', kind: 'active', charges: 1, price: 5, free: false, desc: 'Wipe a 2x2 block, both sides. Uses your turn.', hint: 'Tap a square to aim, tap again to detonate.' },
    landslide:  { name: 'Landslide', kind: 'active', charges: 1, price: 6, free: false, desc: 'Slide a row or column one step, wrapping around. Uses your turn.', hint: 'Tap any square in the row or column.' },
    rewind:     { name: 'Rewind', kind: 'active', modes: 'both', charges: 1, price: 4, free: true, desc: 'Undo the last full round.', hint: '' },
    ghost:      { name: 'Ghost Mark', kind: 'active', charges: 1, price: 5, free: false, desc: 'Place a mark the AI cannot see. If it plays there, it loses its turn.', hint: 'Tap an empty square.' },
    sanctuary:  { name: 'Sanctuary', kind: 'active', charges: 1, price: 5, free: false, desc: 'Reserve a square only you can play. Uses your turn.', hint: 'Tap an empty square.' },
    oracle:     { name: 'Oracle', kind: 'active', modes: 'both', charges: 2, price: 3, free: true, desc: 'See how the AI would answer a move before you play it.', hint: 'Tap the square you are considering.' },
    corners:    { name: 'Four Corners', kind: 'passive', price: 6, desc: 'Holding all four corners wins. The AI knows.' },
    plus:       { name: 'Plus Sign', kind: 'passive', price: 5, desc: 'The center and its four neighbors win. The AI knows.' },
    safetynet:  { name: 'Safety Net', kind: 'passive', price: 5, desc: 'The first draw each act counts as a win.' },
    thickskin:  { name: 'Thick Skin', kind: 'passive', price: 5, desc: 'Block one lost heart each act.' },
    tipjar:     { name: 'Tip Jar', kind: 'passive', price: 4, desc: '+2 gold for every win.' },
    haggler:    { name: 'Haggler', kind: 'passive', price: 3, desc: 'Shop prices drop by 1.' },
    secondwind: { name: 'Second Wind', kind: 'passive', price: 5, desc: '+1 max heart, and heal one now.' },
    battery:    { name: 'Battery', kind: 'passive', price: 8, desc: 'Every relic with charges gets +1 charge each act.' }
  };
  var STARTERS = ['doubletap', 'eraser', 'ghost'];

  var TRICKS = {
    redirect:    { name: 'Redirect', desc: 'After your next move, choose which board the boss must play in.' },
    freepass:    { name: 'Free Pass', desc: 'Play your next move on any board.' },
    landmine:    { name: 'Landmine', desc: 'Mark a board. If the boss is sent there, it loses its turn.' },
    castingvote: { name: 'Casting Vote', desc: 'If the boards end tied, you win.' },
    overplay:    { name: 'Overplay', desc: 'Make two moves in a row.' }
  };
  var BOSSES = [
    { id: 'opener', name: 'The Opener', twist: 'opener', blurb: 'Plays two marks on its first turn.' },
    { id: 'spinner', name: 'The Spinner', twist: 'spin', blurb: 'The whole grid turns 90° every 4 moves.' },
    { id: 'curse', name: 'The Curse', twist: 'curse', blurb: 'One board is cursed. The boss cannot claim it, and winning it costs you a heart.' }
  ];
  var COUNTERS = {
    head:    { name: 'Head Start', desc: 'The AI begins with a mark on the board.' },
    dead:    { name: 'Dead Center', desc: 'The center square is blocked for everyone.' },
    shield:  { name: 'Armor', desc: "The AI's first two marks can't be removed or moved." },
    silence: { name: 'Gag Order', desc: 'Your first relic use each match fizzles.' },
    quick:   { name: 'Quick Draw', desc: 'The AI plays two marks on its first turn.' }
  };

  /* ---------- run ---------- */
  function newRun() {
    return {
      v: 1, phase: 'title', act: 1, idx: 0, hearts: 3, maxHearts: 3, gold: 0,
      relics: [], charges: {}, counters: [], used: { safety: false, thick: false },
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
    if (id === 'secondwind') { run.maxHearts++; run.hearts = Math.min(run.maxHearts, run.hearts + 1); }
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
    var pool = ['head', 'dead', 'shield', 'silence'];
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
      run.act++; run.idx = 0; run.used = { safety: false, thick: false }; refill(run);
    } else run.idx++;
    run.counters = run.idx < 3 ? rollCounters(run.act) : [];
    run.trick = null;
    run.trickChoices = run.idx === 3 ? shuffle(Object.keys(TRICKS)).slice(0, 3) : [];
    run.phase = 'briefing';
  }

  /* after a match is resolved the player taps Continue */
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
      if (o === 'draw' && has(run, 'safetynet') && !run.used.safety) { run.used.safety = true; o = 'win'; out.notes.push('Safety Net turns the draw into a win.'); }
      out.outcome = o;
      if (o === 'win') {
        out.gold = 3;
        if (has(run, 'tipjar')) { out.gold += 2; out.bonuses.push(['Tip Jar', 2]); }
        if (m.xTurns <= 6 && m.over === 'win') { out.gold += 2; out.bonuses.push(['Quick win', 2]); }
        if (!m.usedRelic && m.over === 'win') { out.gold += 2; out.bonuses.push(['Clean win', 2]); }
      } else if (o === 'draw') out.hearts = act === 1 ? 0 : 1;
      else out.hearts = act === 1 ? 1 : 2;
    } else {
      var oBoards = 0; for (var i = 0; i < 9; i++) if (m.S.res[i] === 2) oBoards++;
      out.outcome = o;
      if (o === 'win') {
        out.gold = 6;
        if (has(run, 'tipjar')) { out.gold += 2; out.bonuses.push(['Tip Jar', 2]); }
      } else if (o === 'draw') out.hearts = 1;
      else out.hearts = Math.max(1, Math.min(2, oBoards));
      if (m.curseHearts > 0) { out.hearts += m.curseHearts; out.notes.push('The curse costs you ' + m.curseHearts + (m.curseHearts > 1 ? ' hearts.' : ' heart.')); }
    }
    if (out.hearts > 0 && has(run, 'thickskin') && !run.used.thick) {
      run.used.thick = true; out.hearts--; out.absorbed = 1; out.notes.push('Thick Skin blocks one heart.');
    }
    run.hearts = Math.max(0, run.hearts - out.hearts);
    run.gold += out.gold;
    run.stats.matches++;
    if (out.outcome === 'win') { run.stats.wins++; if (out.boss) run.stats.bossWins++; }
    else if (out.outcome === 'draw') run.stats.draws++; else run.stats.losses++;
    if (m.kind === '5') run.charges = JSON.parse(JSON.stringify(m.charges));
    else ['rewind', 'oracle'].forEach(function (k) { if (m.charges[k] !== undefined) run.charges[k] = m.charges[k]; });
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

  function addAIMark(m, c) {
    m.o |= BIT(c); m.aiMarks++; m.lastAI = c;
    if (m.shieldLeft > 0) { m.shield |= BIT(c); m.shieldLeft--; }
  }
  var SNAP_KEYS = ['x', 'o', 'b', 'ban', 'ghost', 'shield', 'xTurns', 'xMarks', 'aiMarks', 'shieldLeft', 'silenceLeft', 'quickLeft', 'lastAI'];
  function snap5(m) {
    var s = { charges: JSON.parse(JSON.stringify(m.charges)) };
    SNAP_KEYS.forEach(function (k) { s[k] = m[k]; });
    return s;
  }
  function restore5(m, s) {
    SNAP_KEYS.forEach(function (k) { m[k] = s[k]; });
    m.charges = JSON.parse(JSON.stringify(s.charges));
  }
  function pushSnap(m) { m.hist.push(m.kind === '5' ? snap5(m) : snapB(m)); if (m.hist.length > 40) m.hist.shift(); }

  function newMatch5(run) {
    var m = {
      kind: '5', rules: rulesFor(run), x: 0, o: 0, b: 0, ban: 0, ghost: 0, shield: 0,
      turn: 'X', over: null, winMask: 0, counters: run.counters.slice(), charges: {}, usedRelic: false,
      xTurns: 0, xMarks: 0, aiMarks: 0, shieldLeft: 0, silenceLeft: 0, quickLeft: 0,
      pending: null, hist: [], lastAI: -1, oracle: null, note: null
    };
    m.charges = JSON.parse(JSON.stringify(run.charges));
    var cs = m.counters;
    if (cs.indexOf('dead') >= 0) m.b |= BIT(12);
    if (cs.indexOf('shield') >= 0) m.shieldLeft = 2;
    if (cs.indexOf('silence') >= 0) m.silenceLeft = 1;
    if (cs.indexOf('quick') >= 0) m.quickLeft = 1;
    if (cs.indexOf('head') >= 0) {
      var cand = []; for (var c = 0; c < 25; c++) if (c !== 12 && emptyAt(m, c)) cand.push(c);
      addAIMark(m, cand[rnd(cand.length)]);
    }
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
  function canAlter(m) {
    return ['eraser', 'turncoat', 'switcheroo', 'bomb', 'landslide'].some(function (id) { return hasCharge(m, id); });
  }
  function checkDraw(m) {
    if (countEmpty(m) === 0) { m.over = 'draw'; return true; }
    if (!alive(m) && !canAlter(m)) { m.over = 'draw'; return true; }
    return false;
  }
  function endTurn5(m) {
    m.xTurns++; m.pending = null; m.oracle = null;
    if (m.over) return;
    if (checkDraw(m)) return;
    m.turn = 'O';
  }
  function spend(m, id) {
    m.charges[id]--; m.usedRelic = true;
    if (m.silenceLeft > 0) { m.silenceLeft--; return false; }
    return true;
  }
  function placeX(m, c) {
    m.x |= BIT(c); m.xMarks++;
    m.lastX = c;
    checkEnds(m);
  }

  function arm5(m, id) {
    if (m.over || m.turn !== 'X') return 'Wait for your turn.';
    var r = RELICS[id];
    if (!r || r.kind !== 'active') return null;
    if (m.pending && m.pending.id === 'doubletap' && m.pending.placed) return 'Place the second mark.';
    if (m.pending && m.pending.id === id) { m.pending = null; return 'Cancelled.'; }
    if (!hasCharge(m, id)) return 'No charges left.';
    if (id === 'rewind') return rewind(m);
    m.pending = { id: id, placed: 0, a: -1, anchor: -1, cell: -1 };
    return r.hint;
  }
  function cancel5(m) {
    if (m.pending && !(m.pending.id === 'doubletap' && m.pending.placed)) { m.pending = null; return true; }
    return false;
  }

  function rewind(m) {
    if (m.hist.length < 2) return 'Nothing to rewind yet.';
    var left = m.charges.rewind - 1;
    m.hist.pop();
    var s = m.hist.pop();
    if (m.kind === '5') restore5(m, s); else restoreB(m, s);
    m.charges.rewind = left; m.usedRelic = true; m.pending = null; m.oracle = null; m.over = null; m.winMask = 0;
    m.turn = 'X';
    pushSnap(m);
    return 'Time rewinds.';
  }

  function lineCells(kind, idx) { var a = []; for (var k = 0; k < 5; k++) a.push(kind === 'row' ? idx * 5 + k : k * 5 + idx); return a; }
  function slideMask(mask, cells, dir) {
    var out = mask, k;
    for (k = 0; k < 5; k++) out &= ~BIT(cells[k]);
    for (k = 0; k < 5; k++) if (mask & BIT(cells[k])) out |= BIT(cells[(k + dir + 5) % 5]);
    return out;
  }
  function bombMask(anchor) {
    var r = Math.floor(anchor / 5), c = anchor % 5;
    return BIT(r * 5 + c) | BIT(r * 5 + c + 1) | BIT((r + 1) * 5 + c) | BIT((r + 1) * 5 + c + 1);
  }
  function bombAnchor(c) { var r = Math.min(Math.floor(c / 5), 3), col = Math.min(c % 5, 3); return r * 5 + col; }

  /* returns a message string (or null) */
  function tap5(m, c) {
    if (m.over || m.turn !== 'X') return null;
    var p = m.pending, bit = BIT(c);
    if (!p) {
      if (!emptyAt(m, c)) return 'That square is taken.';
      placeX(m, c);
      endTurn5(m);
      return null;
    }
    var id = p.id, aiTarget;
    switch (id) {
      case 'doubletap':
        if (!emptyAt(m, c)) return 'That square is taken.';
        if (!p.placed) {
          if (!spend(m, id)) { placeX(m, c); m.pending = null; endTurn5(m); return 'Gag Order: Double Tap fizzles.'; }
          placeX(m, c); p.placed = 1;
          if (m.over) { m.pending = null; endTurn5(m); return null; }
          return 'Place the second mark.';
        }
        placeX(m, c); m.pending = null; endTurn5(m); return null;
      case 'eraser':
      case 'turncoat':
        if (!(m.o & bit)) return 'Tap an AI mark.';
        if (m.shield & bit) return 'That mark is armored.';
        if (!spend(m, id)) { m.pending = null; return 'Gag Order: ' + RELICS[id].name + ' fizzles.'; }
        m.o &= ~bit;
        m.pending = null;
        if (id === 'turncoat') { m.x |= bit; m.lastX = c; checkEnds(m); endTurn5(m); return m.over ? null : 'The mark switches sides.'; }
        return 'Mark erased. Place yours.';
      case 'switcheroo':
        if (!((m.x | m.o) & bit) || (m.ghost & bit)) return 'Tap a mark.';
        if (m.shield & bit) return 'That mark is armored.';
        if (p.a < 0) { p.a = c; return 'Now tap a mark of the other side.'; }
        if (c === p.a) { p.a = -1; return 'Pick the first mark again.'; }
        if (((m.x & BIT(p.a)) !== 0) === ((m.x & bit) !== 0)) return 'Pick marks of different sides.';
        if (!spend(m, id)) { m.pending = null; return 'Gag Order: Switcheroo fizzles.'; }
        var a = p.a, ax = (m.x & BIT(a)) !== 0;
        if (ax) { m.x = (m.x & ~BIT(a)) | bit; m.o = (m.o & ~bit) | BIT(a); }
        else { m.o = (m.o & ~BIT(a)) | bit; m.x = (m.x & ~bit) | BIT(a); }
        m.pending = null;
        checkEnds(m);
        return m.over ? null : 'Swapped.';
      case 'bomb':
        var an = bombAnchor(c);
        if (p.anchor !== an) { p.anchor = an; return 'Tap the block again to detonate.'; }
        if (!spend(m, id)) { m.pending = null; return 'Gag Order: Bomb fizzles.'; }
        var bm = bombMask(an);
        m.x &= ~bm; m.ghost &= ~bm; m.o &= ~(bm & ~m.shield);
        m.pending = null; endTurn5(m);
        return 'Boom.';
      case 'landslide':
        p.cell = c;
        return 'Choose a direction.';
      case 'ghost':
        if (!emptyAt(m, c)) return 'That square is taken.';
        if (!spend(m, id)) { placeX(m, c); m.pending = null; endTurn5(m); return 'Gag Order: Ghost Mark fizzles.'; }
        placeX(m, c); m.ghost |= bit;
        m.pending = null; endTurn5(m);
        return null;
      case 'sanctuary':
        if (!emptyAt(m, c)) return 'That square is taken.';
        if (!spend(m, id)) { m.pending = null; return 'Gag Order: Sanctuary fizzles.'; }
        m.ban |= bit; m.pending = null; endTurn5(m);
        return 'Square reserved for you.';
      case 'oracle':
        if (!emptyAt(m, c)) return 'Tap an empty square.';
        if (!spend(m, id)) { m.pending = null; return 'Gag Order: Oracle fizzles.'; }
        m.pending = null;
        var hx = (m.x & ~m.ghost) | bit;
        if (E.lineWon(hx, m.rules.lines[0])) { m.oracle = { from: c, to: -1 }; return 'That move wins.'; }
        var res = E.search5({ x: hx, o: m.o, b: m.b, ban: m.ban }, m.rules, 1, cfg.oracleMs);
        m.oracle = { from: c, to: res.move };
        return res.move >= 0 ? 'The AI would answer there.' : 'The AI would have no move.';
    }
    return null;
  }

  function slide5(m, kind, dir) {
    var p = m.pending;
    if (!p || p.id !== 'landslide' || p.cell < 0 || m.over || m.turn !== 'X') return null;
    if (!spend(m, 'landslide')) { m.pending = null; return 'Gag Order: Landslide fizzles.'; }
    var idx = kind === 'row' ? Math.floor(p.cell / 5) : p.cell % 5;
    var cells = lineCells(kind, idx);
    ['x', 'o', 'b', 'ghost', 'shield', 'ban'].forEach(function (k) { m[k] = slideMask(m[k], cells, dir); });
    m.pending = null;
    checkEnds(m);
    endTurn5(m);
    return m.over ? null : 'The ' + kind + ' slides.';
  }

  /* AI move(s). Returns array of event strings. */
  function ai5(m) {
    var ev = [];
    if (m.over || m.turn !== 'O') return ev;
    var n = m.quickLeft > 0 ? 2 : 1;
    if (m.quickLeft > 0) m.quickLeft--;
    m.bump = -1;
    for (var k = 0; k < n; k++) {
      var st = { x: m.x & ~m.ghost, o: m.o, b: m.b, ban: m.ban };
      var res = E.search5(st, m.rules, 1, cfg.aiMs5);
      if (res.move < 0) { ev.push('The AI has no legal move.'); break; }
      var c = res.move;
      if (m.ghost & BIT(c)) { m.ghost &= ~BIT(c); m.bump = c; ev.push('The AI walks into your Ghost Mark and loses its turn.'); break; }
      addAIMark(m, c);
      var ol = E.lineWon(m.o, m.rules.lines[1]);
      if (ol) { m.over = 'loss'; m.winMask = ol; break; }
    }
    if (!m.over && !checkDraw(m)) { m.turn = 'X'; pushSnap(m); }
    return ev;
  }

  /* ---------- boss match (Super XOX) ---------- */
  function hasRelicChargeB(run, id) { return has(run, id); }
  function newMatchBoss(run) {
    var boss = BOSSES[run.act - 1];
    var m = {
      kind: 'boss', boss: boss, twist: boss.twist,
      S: E.newSuper({ spin: boss.twist === 'spin', cursed: boss.twist === 'curse' ? rnd(9) : -1 }),
      turn: 'X', over: null, charges: {}, trick: run.trick, mine: -1, redirectArmed: false, extra: 0,
      openerDone: false, castingVote: run.trick === 'castingvote', curseHearts: 0, pending: null, hist: [],
      last: null, lastAI: null, usedRelic: false, xTurns: 0, oracle: null, rotatedNow: false
    };
    var bat = has(run, 'battery') ? 1 : 0;
    if (run.trick && run.trick !== 'castingvote') m.charges[run.trick] = 1 + bat;
    if (run.charges.rewind !== undefined) m.charges.rewind = run.charges.rewind;
    if (run.charges.oracle !== undefined) m.charges.oracle = run.charges.oracle;
    pushSnap(m);
    return m;
  }
  var SNAP_B = ['S', 'mine', 'openerDone', 'extra', 'redirectArmed', 'curseHearts', 'xTurns', 'last', 'lastAI'];
  function snapB(m) {
    var s = { charges: JSON.parse(JSON.stringify(m.charges)) };
    SNAP_B.forEach(function (k) { s[k] = m[k]; });
    return s;
  }
  function restoreB(m, s) {
    SNAP_B.forEach(function (k) { m[k] = s[k]; });
    m.charges = JSON.parse(JSON.stringify(s.charges));
  }
  function withNext(S, n) { var T = E.cloneSuper(S); T.next = n; return T; }

  function armBoss(m, id) {
    if (m.over || m.turn !== 'X') return 'Wait for your turn.';
    if (m.extra === 2) return 'Make your second move first.';
    if (m.pending && m.pending.id === id) { m.pending = null; return 'Cancelled.'; }
    if (!(m.charges[id] > 0)) return 'No charges left.';
    if (id === 'rewind') return rewind(m);
    if (id === 'oracle') { m.pending = { id: id }; return 'Tap the move you are considering.'; }
    if (id === 'landmine') { m.pending = { id: id }; return 'Tap a board to mine it.'; }
    if (id === 'freepass') {
      if (m.S.next < 0) return 'You can already play anywhere.';
      m.charges[id]--; m.usedRelic = true; m.S = withNext(m.S, -1); return 'Play on any board.';
    }
    if (id === 'redirect') { m.charges[id]--; m.usedRelic = true; m.redirectArmed = true; return 'Redirect armed. Make your move.'; }
    if (id === 'overplay') { m.charges[id]--; m.usedRelic = true; m.extra = 1; return 'Overplay armed. Make two moves.'; }
    return null;
  }
  function cancelBoss(m) { if (m.pending) { m.pending = null; return true; } return false; }

  function legalBoss(m, b, c) { return E.superMoves(m.S).some(function (mv) { return mv[0] === b && mv[1] === c; }); }

  function playBoss(m, b, c, side) {
    var T = E.applySuper(m.S, b, c, side);
    m.S = T; m.last = { b: b, c: c, side: side }; m.rotatedNow = false;
    if (T.rotated) { m.rotatedNow = true; if (m.mine >= 0) m.mine = E.ROT[m.mine]; m.last = { b: E.ROT[b], c: E.ROT[c], side: side }; if (m.lastAI) m.lastAI = { b: E.ROT[m.lastAI.b], c: E.ROT[m.lastAI.c] }; }
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

  function finishPlayerBoss(m) {
    m.xTurns++; m.pending = null; m.oracle = null;
    m.turn = 'O';
  }

  function tapBoss(m, b, c) {
    if (m.over || m.turn !== 'X') return null;
    var p = m.pending;
    if (p) {
      if (p.id === 'landmine') {
        if (m.S.res[b] !== 0) return 'Pick a board still in play.';
        m.charges.landmine--; m.usedRelic = true; m.mine = b; m.pending = null;
        return 'Board mined. Send the boss there.';
      }
      if (p.id === 'redirect') {
        if (m.S.res[b] !== 0) return 'Pick a board still in play.';
        m.S = withNext(m.S, b); m.pending = null; m.redirectArmed = false;
        finishPlayerBoss(m);
        return 'The boss must play in that board.';
      }
      if (p.id === 'oracle') {
        if (!legalBoss(m, b, c)) return 'Tap a legal square.';
        m.charges.oracle--; m.usedRelic = true; m.pending = null;
        var T = E.applySuper(m.S, b, c, 0);
        if (E.superResult(T) === 1) { m.oracle = { from: [b, c], to: null }; return 'That move wins the match.'; }
        var rr = E.searchSuper(T, 1, cfg.oracleMs);
        m.oracle = { from: [b, c], to: rr ? [rr.b, rr.c] : null };
        return 'The boss would answer there.';
      }
    }
    if (!legalBoss(m, b, c)) return m.S.next >= 0 ? 'Play in the highlighted board.' : 'That board is finished.';
    var note = playBoss(m, b, c, 0);
    if (m.over) { m.xTurns++; return note; }
    if (m.extra === 1) { m.extra = 2; return (note ? note + ' ' : '') + 'Play again.'; }
    if (m.extra === 2) m.extra = 0;
    if (m.redirectArmed) { m.pending = { id: 'redirect' }; return (note ? note + ' ' : '') + 'Choose the board the boss must play in.'; }
    finishPlayerBoss(m);
    return note;
  }

  function aiBoss(m) {
    var ev = [];
    if (m.over || m.turn !== 'O') return ev;
    if (m.mine >= 0 && m.S.next === m.mine) {
      m.mine = -1; m.S = withNext(m.S, -1);
      ev.push('The boss steps on your landmine and loses its turn.');
      m.turn = 'X'; pushSnap(m); return ev;
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
    if (run.match && run.match.kind === '5') run.match.rules = rulesFor(run);
    return run;
  }

  return {
    cfg: cfg, RELICS: RELICS, STARTERS: STARTERS, TRICKS: TRICKS, BOSSES: BOSSES, COUNTERS: COUNTERS,
    newRun: newRun, startRun: startRun, pickStarter: pickStarter, startMatch: startMatch, chooseTrick: chooseTrick,
    resolve: resolve, next: next, buy: buy, heal: heal, leaveShop: leaveShop, pickReward: pickReward,
    priceOf: priceOf, healPrice: healPrice, has: has, gain: gain, advance: advance, refill: refill,
    arm5: arm5, cancel5: cancel5, tap5: tap5, slide5: slide5, ai5: ai5,
    armBoss: armBoss, cancelBoss: cancelBoss, tapBoss: tapBoss, aiBoss: aiBoss, legalBoss: legalBoss,
    serialize: serialize, deserialize: deserialize, bombMask: bombMask, bombAnchor: bombAnchor, lineCells: lineCells,
    emptyAt: emptyAt, hasCharge: hasCharge, newMatch5: newMatch5, newMatchBoss: newMatchBoss
  };
})(XOX);
if (typeof module !== 'undefined' && module.exports) module.exports = Game;
