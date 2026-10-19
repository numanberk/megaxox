/* XOX Rogue run logic: characters, relic sets, named opponents, three boss games. No DOM. Needs XOX (engine.js).
   Every relic works in every game: they act on turns and marks, not on a specific board. */
var Game = (function (E) {
  'use strict';

  var cfg = { aiMs: [200, 300, 400], aiMsBoss: [80, 300, 600], hintMs: 250, rng: Math.random };
  function rnd(n) { return Math.floor(cfg.rng() * n); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a.length ? a[rnd(a.length)] : -1; }
  function BIT(i) { return 1 << i; }
  function bits(mask, n) { var a = []; for (var i = 0; i < n; i++) if (mask & (1 << i)) a.push(i); return a; }
  function has(run, id) { return run.relics.indexOf(id) >= 0; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- content ---------- */
  var SETS = {
    frost: { name: 'Frost', b2: 'Skipped AI turns pay 1 gold.', b3: 'AI skips its first turn.' },
    fire:  { name: 'Fire', b2: 'Burned squares turn to stone.', b3: 'Zap and Nuke refill each match.' },
    tempo: { name: 'Tempo', b2: 'Double Strike every 2nd turn.', b3: 'Start with 1 more mark.' },
    luck:  { name: 'Luck', b2: 'Shops show 4 items.', b3: 'First buy in each shop is free.' },
    guard: { name: 'Guard', b2: '+1 max heart.', b3: 'Heal 1 heart after each win.' }
  };
  var RELICS = {
    freeze:      { name: 'Freeze', set: 'frost', kind: 'active', charges: 1, price: 6, desc: 'AI skips its next turn.' },
    sleepy:      { name: 'Sleepy AI', set: 'frost', kind: 'passive', price: 7, desc: 'AI skips every 4th turn.' },
    brainfreeze: { name: 'Brain Freeze', set: 'frost', kind: 'passive', price: 4, desc: "AI's first move is random." },
    zap:         { name: 'Zap', set: 'fire', kind: 'active', charges: 1, price: 4, desc: "Delete the AI's last mark." },
    nuke:        { name: 'Nuke', set: 'fire', kind: 'active', charges: 1, price: 8, desc: 'Wipe every AI mark.' },
    spark:       { name: 'Spark', set: 'fire', kind: 'passive', price: 5, desc: 'Every 5th turn, burn one.' },
    strike:      { name: 'Double Strike', set: 'tempo', kind: 'passive', price: 6, desc: 'Every 3rd turn, place 2.' },
    freebie:     { name: 'Freebie', set: 'tempo', kind: 'passive', price: 4, desc: 'Start with 2 free marks.' },
    center:      { name: 'Center Start', set: 'tempo', kind: 'passive', price: 7, desc: 'Start with the center.' },
    safetynet:   { name: 'Lucky Draw', set: 'luck', kind: 'passive', price: 5, desc: 'First draw each act wins.' },
    piggy:       { name: 'Piggy Bank', set: 'luck', kind: 'passive', price: 4, desc: '+2 gold per win.' },
    haggler:     { name: 'Haggler', set: 'luck', kind: 'passive', price: 3, desc: 'Shop prices −1.' },
    heartup:     { name: 'Heart Up', set: 'guard', kind: 'passive', price: 5, desc: '+1 heart.' },
    ironheart:   { name: 'Iron Heart', set: 'guard', kind: 'passive', price: 5, desc: 'Block 1 hit per act.' },
    secondlife:  { name: 'Second Life', set: 'guard', kind: 'passive', price: 8, desc: 'Survive one defeat.' },
    hint:        { name: 'Hint', set: null, kind: 'active', charges: 2, price: 3, desc: 'Shows your best move.' },
    rewind:      { name: 'Rewind', set: null, kind: 'active', charges: 1, price: 4, desc: 'Undo the last round.' },
    corners:     { name: 'Four Corners', set: null, kind: 'passive', price: 6, desc: 'All 4 corners win.', only: 'grid' },
    plus:        { name: 'Plus Sign', set: null, kind: 'passive', price: 5, desc: 'Center + 4 sides win.', only: 'grid' },
    battery:     { name: 'Battery', set: null, kind: 'passive', price: 8, desc: 'Buttons get +1 use.' }
  };
  var CHARS = {
    frost:  { name: 'Frost', set: 'frost', start: ['freeze'], trait: 'Freeze gets +1 use.', unlock: null },
    ember:  { name: 'Ember', set: 'fire', start: ['spark'], trait: 'Every 4th mark burns a neighbor.', unlock: null },
    thief:  { name: 'Thief', set: 'luck', start: ['zap', 'piggy'], trait: 'Zap steals the mark instead.', unlock: 'Beat the Act 1 boss' },
    twin:   { name: 'Twin', set: 'tempo', start: ['strike'], trait: 'Every 4th mark lands twice.', unlock: 'Beat the Act 2 boss' },
    knight: { name: 'Knight', set: 'guard', start: ['center', 'ironheart'], trait: 'Starts with 4 hearts.', unlock: 'Win a run' }
  };
  var CHAR_ORDER = ['frost', 'ember', 'thief', 'twin', 'knight'];

  var OPPONENTS = {
    copycat: { name: 'The Copycat', act: 1, desc: 'Copies your moves.' },
    gambler: { name: 'The Gambler', act: 1, desc: 'Every 3rd move is random.' },
    napper:  { name: 'The Napper', act: 1, desc: 'Naps, then plays twice.' },
    hoarder: { name: 'The Hoarder', act: 2, desc: 'Drops stones every 3rd turn.' },
    bully:   { name: 'The Bully', act: 2, desc: 'Starts with 2 marks.' },
    mason:   { name: 'The Mason', act: 2, desc: 'Starts with 3 stones.' },
    sniper:  { name: 'The Sniper', act: 3, desc: 'Opens with two marks.' },
    janitor: { name: 'The Janitor', act: 3, desc: 'Erases your oldest mark.' },
    warden:  { name: 'The Warden', act: 3, desc: 'Your first button fizzles.' }
  };
  var BOSSES = [
    { id: 'referee', name: 'The Referee', game: 'speed', title: 'Speed Round', rules: ['Best of 3 on a 3×3 board.', '8 seconds per move.', 'Your buttons refill each round.'] },
    { id: 'avalanche', name: 'The Avalanche', game: 'gravity', title: 'Gravity', rules: ['Marks drop to the bottom.', 'Every 6 moves the floor falls away.', 'Four in a row wins.'] },
    { id: 'grandmaster', name: 'The Grandmaster', game: 'super', title: 'Super XOX', rules: ['Win 3 small boards to win.', 'Your square sends it to that board.', 'It gets stronger as you win boards.'] }
  ];
  var GAMES = { std: { w: 5, h: 5, k: 4 }, speed: { w: 3, h: 3, k: 3 }, gravity: { w: 5, h: 5, k: 4, gravity: true } };

  /* ---------- sets and charges ---------- */
  function setCount(run, set) { var n = 0; run.relics.forEach(function (id) { if (RELICS[id].set === set) n++; }); return n; }
  function setLevels(run) { var o = {}; Object.keys(SETS).forEach(function (k) { o[k] = setCount(run, k); }); return o; }
  function maxCharges(run, id) {
    var r = RELICS[id]; if (!r || r.kind !== 'active') return 0;
    return r.charges + (has(run, 'battery') ? 1 : 0) + (run.char === 'frost' && id === 'freeze' ? 1 : 0);
  }
  function refill(run) {
    run.charges = {};
    run.relics.forEach(function (id) { if (RELICS[id].kind === 'active') run.charges[id] = maxCharges(run, id); });
  }

  /* ---------- run ---------- */
  function newRun() {
    return {
      v: 3, phase: 'title', act: 1, idx: 0, hearts: 3, maxHearts: 3, gold: 0, char: null,
      relics: [], charges: {}, used: { safety: false, thick: false, life: false },
      choices: [], faced: [], shop: [], reward: [], freeBuy: false,
      match: null, result: null, over: null,
      stats: { wins: 0, draws: 0, losses: 0, bossWins: 0, matches: 0 }
    };
  }
  function startRun() { var r = newRun(); r.phase = 'char'; return r; }

  function gain(run, id) {
    if (has(run, id) || !RELICS[id]) return;
    var before = RELICS[id].set ? setCount(run, RELICS[id].set) : 0;
    run.relics.push(id);
    if (RELICS[id].kind === 'active') run.charges[id] = maxCharges(run, id);
    if (id === 'battery') Object.keys(run.charges).forEach(function (k) { run.charges[k]++; });
    if (id === 'heartup') { run.maxHearts++; run.hearts = Math.min(run.maxHearts, run.hearts + 1); }
    if (RELICS[id].set === 'guard' && before === 1) { run.maxHearts++; run.hearts++; }
  }
  function pickChar(run, id) {
    if (!CHARS[id] || run.phase !== 'char') return;
    run.char = id;
    if (id === 'knight') { run.maxHearts = 4; run.hearts = 4; }
    CHARS[id].start.forEach(function (r) { gain(run, r); });
    run.act = 1; run.idx = 0;
    setupBriefing(run);
  }
  function setupBriefing(run) {
    run.match = null; run.result = null;
    if (run.idx < 3) {
      var pool = Object.keys(OPPONENTS).filter(function (k) { return OPPONENTS[k].act === run.act && run.faced.indexOf(k) < 0; });
      if (pool.length < 2) pool = Object.keys(OPPONENTS).filter(function (k) { return OPPONENTS[k].act === run.act; });
      run.choices = shuffle(pool).slice(0, 2);
    } else run.choices = [];
    run.phase = 'briefing';
  }
  /* shop and reward offers lean toward your character's set */
  function offer(run, n, favorSet) {
    var pool = Object.keys(RELICS).filter(function (id) { return !has(run, id); });
    var out = [], lean = pool.filter(function (id) { return RELICS[id].set === favorSet; });
    if (lean.length) out.push(pick(lean));
    shuffle(pool).forEach(function (id) { if (out.length < n && out.indexOf(id) < 0) out.push(id); });
    return shuffle(out);
  }
  function priceOf(run, id) {
    if (run.freeBuy) return 0;
    return Math.max(1, RELICS[id].price - (has(run, 'haggler') ? 1 : 0));
  }
  function healPrice(run) { return Math.max(1, 4 - (has(run, 'haggler') ? 1 : 0)); }
  function buy(run, id) {
    if (run.phase !== 'shop' || run.shop.indexOf(id) < 0) return 'Not for sale.';
    var p = priceOf(run, id);
    if (run.gold < p) return 'Not enough gold.';
    run.gold -= p; run.freeBuy = false; gain(run, id); run.shop.splice(run.shop.indexOf(id), 1);
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
  function advance(run) {
    if (run.idx === 3) {
      if (run.act === 3) { run.over = 'won'; run.phase = 'end'; run.match = null; return; }
      run.act++; run.idx = 0; run.used.safety = false; run.used.thick = false; refill(run);
    } else run.idx++;
    setupBriefing(run);
  }
  function next(run) {
    if (run.phase !== 'result') return;
    var out = run.result;
    if (run.hearts <= 0) { run.over = 'dead'; run.phase = 'end'; run.match = null; return; }
    if (out.boss && out.outcome === 'win') {
      if (run.act === 3) { run.over = 'won'; run.phase = 'end'; run.match = null; return; }
      run.reward = offer(run, 3, CHARS[run.char].set); run.match = null; run.phase = 'reward'; return;
    }
    if (!out.boss && out.outcome === 'win') {
      run.shop = offer(run, setCount(run, 'luck') >= 2 ? 4 : 3, CHARS[run.char].set);
      run.freeBuy = setCount(run, 'luck') >= 3;
      run.match = null; run.phase = 'shop'; return;
    }
    advance(run);
  }
  function startMatch(run, oppId) {
    if (run.phase !== 'briefing') return null;
    if (run.idx < 3) {
      if (run.choices.indexOf(oppId) < 0) return null;
      run.faced.push(oppId);
      run.match = newGrid(run, 'std', oppId);
    } else {
      var boss = BOSSES[run.act - 1];
      run.match = boss.game === 'super' ? newSuperMatch(run, boss) : newGrid(run, boss.game, boss.id);
    }
    run.phase = 'match';
    return run.match;
  }

  /* ---------- resolve ---------- */
  function resolve(run) {
    var m = run.match, act = run.act;
    var out = { boss: !!m.boss, outcome: null, gold: 0, hearts: 0, bonuses: [], notes: [], unlock: null };
    var o = m.over;
    if (!m.boss && o === 'draw' && has(run, 'safetynet') && !run.used.safety) { run.used.safety = true; o = 'win'; out.notes.push('Lucky Draw turns the draw into a win.'); }
    out.outcome = o;
    if (o === 'win') {
      out.gold = m.boss ? 6 : 2 + act;
      if (has(run, 'piggy')) { out.gold += 2; out.bonuses.push(['Piggy Bank', 2]); }
      if (!m.boss && m.xTurns <= 6 && m.over === 'win') { out.gold += 2; out.bonuses.push(['Quick win', 2]); }
      if (!m.boss && !m.usedRelic && m.over === 'win') { out.gold += 2; out.bonuses.push(['No buttons used', 2]); }
      if (m.boss) { out.unlock = ['thief', 'twin', 'knight'][act - 1]; run.stats.bossWins++; }
    } else if (o === 'draw') out.hearts = (!m.boss && act === 1) ? 0 : 1;
    else out.hearts = (!m.boss && act === 1) ? 1 : 2;
    if (m.skips && setCount(run, 'frost') >= 2) { out.gold += m.skips; out.bonuses.push(['Frost: skipped turns', m.skips]); }
    if (out.hearts > 0 && has(run, 'ironheart') && !run.used.thick) { run.used.thick = true; out.hearts--; out.notes.push('Iron Heart blocks one heart.'); }
    run.hearts = Math.max(0, run.hearts - out.hearts);
    if (run.hearts <= 0 && has(run, 'secondlife') && !run.used.life) { run.used.life = true; run.hearts = 1; out.notes.push('Second Life saves you with 1 heart.'); }
    if (o === 'win' && setCount(run, 'guard') >= 3 && run.hearts < run.maxHearts) { run.hearts++; out.notes.push('Guard heals 1 heart.'); }
    run.gold += out.gold;
    run.stats.matches++;
    if (o === 'win') run.stats.wins++; else if (o === 'draw') run.stats.draws++; else run.stats.losses++;
    var keep = copy(m.baseCharges || m.charges);
    if (m.game !== 'speed') keep = copy(m.charges);
    if (setCount(run, 'fire') >= 3) ['zap', 'nuke'].forEach(function (k) { if (keep[k] !== undefined) keep[k] = maxCharges(run, k); });
    run.charges = keep;
    run.result = out; run.phase = 'result';
    return out;
  }

  /* ---------- shared match setup ---------- */
  function baseMatch(run, kind) {
    var perks = {}; run.relics.forEach(function (id) { perks[id] = 1; });
    var charges = copy(run.charges);
    if (setCount(run, 'fire') >= 3) ['zap', 'nuke'].forEach(function (k) { if (charges[k] !== undefined) charges[k] = maxCharges(run, k); });
    return {
      kind: kind, char: run.char, perks: perks, sets: setLevels(run), act: run.act, charges: charges,
      turn: 'X', over: null, usedRelic: false, xTurns: 0, aiTurns: 0, aiDue: 0, freeze: 0, bonus: 0,
      skips: 0, xPlaced: 0, hist: [], flash: '', silenceLeft: 0, quickLeft: 0, napDouble: 0, brainLeft: perks.brainfreeze ? 1 : 0
    };
  }
  function strikeEvery(m) { return m.sets.tempo >= 2 ? 2 : 3; }
  function isStrikeTurn(m) { var iv = strikeEvery(m); return m.perks.strike && m.xTurns % iv === iv - 1; }
  /* AI turn skipping shared by every game. Returns a message or ''. */
  function skipCheck(m) {
    m.aiDue++;
    var why = '';
    if (m.freeze > 0) { m.freeze = 0; why = 'Frozen! The AI skips its turn.'; }
    else if (m.perks.sleepy && m.aiDue % 4 === 0) why = 'Sleepy AI skips its turn.';
    else if (m.opp === 'napper' && m.aiDue % 5 === 0) { m.napDouble = 1; why = 'The Napper naps. It will play twice next.'; }
    if (why && why.indexOf('Napper') < 0) m.skips++;  /* a nap is the opponent's habit, not your skip */
    return why;
  }

  /* ---------- grid games: 5x5 matches, Speed Round, Gravity ---------- */
  function rulesFor(m) {
    var g0 = E.makeGame(GAMES[m.game]), p = E.patterns(g0), ex = [];
    if (m.perks.corners) ex.push(p.corners);
    if (m.perks.plus && p.plus) ex.push(p.plus);
    return ex.length ? E.makeGame(GAMES[m.game], ex) : g0;
  }
  function legal(m) { return E.legalMask(m.g, m.x | m.o | m.b); }
  function legalCells(m) { return bits(legal(m), m.g.nc); }
  function emptyAt(m, c) { return !((m.x | m.o | m.b) & BIT(c)); }
  function neighbors(m, c) {
    var w = m.g.w, h = m.g.h, r = Math.floor(c / w), col = c % w, out = [];
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      var rr = r + dr, cc = col + dc;
      if (rr >= 0 && rr < h && cc >= 0 && cc < w) out.push(rr * w + cc);
    }
    return out;
  }
  function dropCell(m, col) {
    var leg = legal(m);
    for (var r = m.g.h - 1; r >= 0; r--) { var c = r * m.g.w + col; if (leg & BIT(c)) return c; }
    return -1;
  }
  /* gravity: everything falls to the lowest free square in its column */
  function settle(m) {
    if (!m.g.gravity) return;
    var w = m.g.w, h = m.g.h, nx = 0, no = 0, nb = 0;
    for (var col = 0; col < w; col++) {
      var r2 = h - 1;
      for (var r = h - 1; r >= 0; r--) {
        var c = r * w + col, t = BIT(r2 * w + col);
        if (m.x & BIT(c)) { nx |= t; r2--; } else if (m.o & BIT(c)) { no |= t; r2--; } else if (m.b & BIT(c)) { nb |= t; r2--; }
      }
    }
    m.x = nx; m.o = no; m.b = nb;
  }
  function burnO(m, c) {
    m.o &= ~BIT(c);
    if (m.sets.fire >= 2) m.b |= BIT(c); else settle(m);
    if (m.lastAI === c) m.lastAI = -1;
  }

  var SNAP = ['x', 'o', 'b', 'xTurns', 'aiTurns', 'aiDue', 'freeze', 'bonus', 'hint', 'lastAI', 'lastX', 'skips', 'xPlaced',
    'silenceLeft', 'quickLeft', 'napDouble', 'brainLeft', 'plies', 'turn'];
  function snapGrid(m) { var s = { charges: copy(m.charges), xOrder: m.xOrder.slice() }; SNAP.forEach(function (k) { s[k] = m[k]; }); return s; }
  function restoreGrid(m, s) { SNAP.forEach(function (k) { m[k] = s[k]; }); m.charges = copy(s.charges); m.xOrder = s.xOrder.slice(); }

  function newGrid(run, game, oppId) {
    var m = baseMatch(run, 'grid');
    m.game = game; m.opp = oppId; m.boss = game !== 'std';
    m.g = rulesFor(m);
    m.series = game === 'speed' ? { round: 1, you: 0, them: 0, toWin: 2, max: 5, log: [] } : null;
    m.timed = game === 'speed' ? 8 : 0;
    m.baseCharges = copy(m.charges);
    if (oppId === 'sniper') m.quickLeft = 1;
    if (oppId === 'warden') m.silenceLeft = 1;
    resetBoard(m);
    return m;
  }
  function resetBoard(m) {
    m.x = 0; m.o = 0; m.b = 0; m.over = null; m.winMask = 0; m.hint = -1; m.lastAI = -1; m.lastX = -1; m.xOrder = [];
    m.xTurns = 0; m.aiTurns = 0; m.aiDue = 0; m.bonus = 0; m.plies = 0; m.xPlaced = 0; m.pauseRound = null; m.hist = [];
    m.freeze = m.sets.frost >= 3 ? 1 : 0;
    var g = m.g;
    if (m.opp === 'mason') shuffle(bits(legal(m), g.nc)).slice(0, 3).forEach(function (c) { m.b |= BIT(c); });
    if (m.opp === 'bully') shuffle(legalCells(m).filter(function (c) { return g.center[c] < Math.max.apply(null, g.center); })).slice(0, 2).forEach(function (c) { m.o |= BIT(c); m.lastAI = c; });
    if (m.perks.center) {
      var best = -1; legalCells(m).forEach(function (c) { if (best < 0 || g.center[c] > g.center[best]) best = c; });
      if (best >= 0) m.x |= BIT(best);
    }
    var free = (m.perks.freebie ? (m.game === 'speed' ? 1 : 2) : 0) + (m.sets.tempo >= 3 ? 1 : 0);
    for (var i = 0; i < free; i++) { var c = pick(legalCells(m)); if (c >= 0) m.x |= BIT(c); }
    if (E.lineWon(m.x, g.lines[0])) { /* a free start must never win outright */ m.x = m.x & (m.x - 1); }
    if (m.series && m.series.round % 2 === 0) m.turn = 'O'; else m.turn = 'X';
    m.hist.push(snapGrid(m));
  }

  function checkEnds(m) {
    var xl = E.lineWon(m.x, m.g.lines[0]);
    if (xl) { m.over = 'win'; m.winMask = xl; return true; }
    var ol = E.lineWon(m.o, m.g.lines[1]);
    if (ol) { m.over = 'loss'; m.winMask = ol; return true; }
    return false;
  }
  function alive(m) {
    var lx = m.g.lines[0], lo = m.g.lines[1], i, l;
    for (i = 0; i < lx.length; i++) { l = lx[i]; if (!(l & m.b) && !(l & m.o)) return true; }
    for (i = 0; i < lo.length; i++) { l = lo[i]; if (!(l & m.b) && !(l & m.x)) return true; }
    return false;
  }
  function checkDraw(m) {
    if (!legal(m)) { m.over = 'draw'; return true; }
    if (!alive(m) && !(m.charges.zap > 0) && !(m.charges.nuke > 0)) { m.over = 'draw'; return true; }
    return false;
  }
  /* Avalanche: every 6 moves the bottom row falls away */
  function afterPly(m) {
    m.plies++;
    if (m.opp === 'avalanche' && !m.over && m.plies % 6 === 0) {
      var f = m.g.full, w = m.g.w;
      m.x = (m.x << w) & f; m.o = (m.o << w) & f; m.b = (m.b << w) & f;
      m.lastAI = m.lastAI >= 0 && m.lastAI + w < m.g.nc ? m.lastAI + w : -1;
      m.quake = 1;
      m.flash = (m.flash ? m.flash + ' ' : '') + 'The floor falls away!';
    }
  }
  /* rounds of the Speed Round */
  function seriesCheck(m) {
    var s = m.series;
    if (!s || !m.over || m.pauseRound) return;
    var r = m.over;
    s.log.push(r);
    if (r === 'win') s.you++; else if (r === 'loss') s.them++;
    var final = null;
    if (s.you >= s.toWin) final = 'win';
    else if (s.them >= s.toWin) final = 'loss';
    else if (s.round >= s.max) final = s.you > s.them ? 'win' : (s.them > s.you ? 'loss' : 'draw');
    if (final) { m.over = final; s.done = true; return; }
    m.pauseRound = r; m.over = null; m.turn = 'pause';
  }
  function nextRound(m) {
    if (!m.series || !m.pauseRound) return;
    m.series.round++;
    m.charges = copy(m.baseCharges);
    resetBoard(m);
  }

  function endTurnGrid(m) {
    m.xTurns++; m.hint = -1;
    if (m.over) return seriesCheck(m);
    if (checkDraw(m)) return seriesCheck(m);
    if (m.perks.spark && m.xTurns % 5 === 0) {
      var t = pick(bits(m.o, m.g.nc));
      if (t >= 0) { burnO(m, t); m.flash = (m.flash ? m.flash + ' ' : '') + 'Spark burns an AI mark.'; if (checkEnds(m)) return seriesCheck(m); }
    }
    var why = skipCheck(m);
    if (why) { m.flash = (m.flash ? m.flash + ' ' : '') + why; m.turn = 'X'; m.hist.push(snapGrid(m)); return; }
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
    if (m.kind === 'grid') restoreGrid(m, s); else restoreSuper(m, s);
    m.charges.rewind = left; m.usedRelic = true; m.over = null; m.winMask = 0; m.turn = 'X';
    m.hist.push(m.kind === 'grid' ? snapGrid(m) : snapSuper(m));
    return 'Time rewinds.';
  }

  function useGrid(m, id) {
    if (m.over || m.turn !== 'X') return 'Wait for your turn.';
    var r = RELICS[id];
    if (!r || r.kind !== 'active') return null;
    if (m.bonus) return 'Place your second mark first.';
    if (!(m.charges[id] > 0)) return 'No uses left.';
    if (id === 'rewind') return rewind(m);
    if (id === 'freeze' && m.freeze) return 'The AI is already frozen.';
    if (id === 'zap' && !(m.lastAI >= 0 && (m.o & BIT(m.lastAI)))) return 'The AI has no mark to zap.';
    if (id === 'nuke' && !m.o) return 'The AI has no marks yet.';
    if (!spend(m, id)) return 'The Warden blocks ' + r.name + '.';
    switch (id) {
      case 'freeze': m.freeze = 1; return 'Frozen! You get two moves.';
      case 'zap':
        if (m.char === 'thief') {
          m.o &= ~BIT(m.lastAI); m.x |= BIT(m.lastAI); m.lastAI = -1;
          if (checkEnds(m)) { endTurnGrid(m); return 'Stolen, and it wins!'; }
          return 'Stolen! That mark is yours now.';
        }
        burnO(m, m.lastAI); if (checkEnds(m)) { endTurnGrid(m); return null; }
        return 'Zapped. Your move.';
      case 'nuke': m.o = 0; m.lastAI = -1; settle(m); if (checkEnds(m)) { endTurnGrid(m); return null; } return 'All AI marks wiped. Your move.';
      case 'hint':
        var res = E.search({ x: m.x, o: m.o, b: m.b }, m.g, 0, cfg.hintMs);
        m.hint = res.move;
        return res.move >= 0 ? 'Best move marked.' : 'No moves left.';
    }
    return null;
  }

  function tapGrid(m, c) {
    if (m.over || m.turn !== 'X') return null;
    if (m.g.gravity) { c = dropCell(m, c % m.g.w); if (c < 0) return 'That column is full.'; }
    if (!(legal(m) & BIT(c))) return 'That square is taken.';
    m.x |= BIT(c); m.hint = -1; m.lastX = c; m.xOrder.push(c); m.xPlaced++;
    var note = null;
    if (m.xPlaced % 4 === 0 && m.char === 'ember') {
      var t = pick(neighbors(m, c).filter(function (n) { return m.o & BIT(n); }));
      if (t >= 0) { burnO(m, t); note = 'Ember burns a neighbor.'; }
    }
    if (m.xPlaced % 4 === 0 && m.char === 'twin') {
      var leg = legal(m), t2 = pick(neighbors(m, c).filter(function (n) { return leg & BIT(n); }));
      if (t2 < 0) t2 = pick(legalCells(m));
      if (t2 >= 0) { m.x |= BIT(t2); m.xOrder.push(t2); note = 'Twin lands twice.'; }
    }
    checkEnds(m);
    afterPly(m);
    if (m.over || m.bonus) { m.bonus = 0; endTurnGrid(m); return note; }
    if (isStrikeTurn(m) && legal(m)) { m.bonus = 1; return (note ? note + ' ' : '') + 'Double Strike! Place one more.'; }
    endTurnGrid(m);
    return note;
  }

  function aiMoveGrid(m) {
    var leg = legal(m), cells = bits(leg, m.g.nc);
    if (!cells.length) return -1;
    var win1 = cells.filter(function (c) { return E.lineWon(m.o | BIT(c), m.g.lines[1]); });
    if (m.brainLeft > 0) { m.brainLeft--; return win1.length ? win1[0] : pick(cells); }
    if (m.opp === 'gambler' && m.aiTurns % 3 === 2 && !win1.length) return pick(cells);
    if (m.opp === 'copycat' && !win1.length && m.lastX >= 0) {
      var block = cells.filter(function (c) { return E.lineWon(m.x | BIT(c), m.g.lines[0]); });
      var mirror = m.g.nc - 1 - m.lastX;
      if (!block.length && (leg & BIT(mirror))) return mirror;
    }
    var ms = m.boss ? cfg.aiMsBoss[m.act - 1] : cfg.aiMs[m.act - 1];
    return E.search({ x: m.x, o: m.o, b: m.b }, m.g, 1, ms).move;
  }
  function aiGrid(m) {
    var ev = [];
    if (m.over || m.turn !== 'O') return ev;
    var n = 1;
    if (m.quickLeft > 0) { m.quickLeft--; n = 2; }
    if (m.napDouble) { m.napDouble = 0; n = 2; }
    for (var k = 0; k < n; k++) {
      var c = aiMoveGrid(m);
      if (c < 0) break;
      m.o |= BIT(c); m.lastAI = c;
      if (checkEnds(m)) break;
      afterPly(m);
      if (m.over || !legal(m)) break;
    }
    if (!m.over && m.opp === 'hoarder' && m.aiTurns % 3 === 2) {
      var s = pick(legalCells(m).filter(function (c) { return !m.g.gravity; }));
      if (s >= 0) { m.b |= BIT(s); ev.push('The Hoarder drops a stone.'); }
    }
    if (!m.over && m.opp === 'janitor' && m.aiTurns % 4 === 3) {
      while (m.xOrder.length) { var old = m.xOrder.shift(); if (m.x & BIT(old)) { m.x &= ~BIT(old); ev.push('The Janitor erases your oldest mark.'); break; } }
    }
    m.aiTurns++;
    if (m.flash) { ev.push(m.flash); m.flash = ''; }
    if (!m.over && !checkDraw(m)) { m.turn = 'X'; m.hist.push(snapGrid(m)); }
    seriesCheck(m);
    return ev;
  }

  /* ---------- Super XOX (Act 3 boss) ---------- */
  function newSuperMatch(run, boss) {
    var m = baseMatch(run, 'super');
    m.game = 'super'; m.opp = boss.id; m.boss = true;
    m.S = E.newSuper({ target: 3 });
    m.phaseN = 1; m.bossDouble = 0; m.hint = null; m.lastAI = null; m.last = null;
    m.freeze = m.sets.frost >= 3 ? 1 : 0;
    var S = m.S;
    if (m.perks.center) S.bx[4] |= 16;
    var free = (m.perks.freebie ? 2 : 0) + (m.sets.tempo >= 3 ? 1 : 0);
    var boards = shuffle([0, 1, 2, 3, 5, 6, 7, 8]).slice(0, free);
    boards.forEach(function (b) { S.bx[b] |= BIT(rnd(9)); });
    m.hist.push(snapSuper(m));
    return m;
  }
  var SNAP_S = ['S', 'xTurns', 'aiTurns', 'aiDue', 'freeze', 'bonus', 'hint', 'lastAI', 'last', 'skips', 'xPlaced', 'phaseN', 'bossDouble', 'brainLeft', 'turn'];
  function snapSuper(m) { var s = { charges: copy(m.charges) }; SNAP_S.forEach(function (k) { s[k] = k === 'S' ? E.cloneSuper(m.S) : m[k]; }); return s; }
  function restoreSuper(m, s) { SNAP_S.forEach(function (k) { m[k] = k === 'S' ? E.cloneSuper(s.S) : s[k]; }); m.charges = copy(s.charges); }
  function recompute(S, b) {
    if (S.res[b] !== 0) return;
    if (E.hasLine3(S.bx[b])) S.res[b] = 1; else if (E.hasLine3(S.bo[b])) S.res[b] = 2; else if ((S.bx[b] | S.bo[b]) === 511) S.res[b] = 3;
  }
  function superOver(m) {
    var r = E.superResult(m.S);
    if (r) m.over = r === 1 ? 'win' : (r === 2 ? 'loss' : 'draw');
    return !!r;
  }
  function boardsWon(S, v) { var n = 0; for (var i = 0; i < 9; i++) if (S.res[i] === v) n++; return n; }
  function phaseCheck(m) {
    var nx = boardsWon(m.S, 1);
    if (nx >= 1 && m.phaseN === 1) { m.phaseN = 2; m.S.spin = true; m.flash = (m.flash ? m.flash + ' ' : '') + 'Phase 2: the grid now turns every 4 moves.'; }
    if (nx >= 2 && m.phaseN === 2) { m.phaseN = 3; m.bossDouble = 1; m.flash = (m.flash ? m.flash + ' ' : '') + 'Phase 3: the Grandmaster plays twice.'; }
  }
  function oMarksOpen(S) { var a = []; for (var b = 0; b < 9; b++) if (S.res[b] === 0) for (var c = 0; c < 9; c++) if (S.bo[b] & BIT(c)) a.push([b, c]); return a; }
  function nb3(c) { var r = Math.floor(c / 3), k = c % 3, out = []; for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; var rr = r + dr, cc = k + dc; if (rr >= 0 && rr < 3 && cc >= 0 && cc < 3) out.push(rr * 3 + cc); } return out; }

  function endTurnSuper(m) {
    m.xTurns++; m.hint = null;
    if (m.over) return;
    if (m.perks.spark && m.xTurns % 5 === 0) {
      var t = pick(oMarksOpen(m.S));
      if (t !== -1) { m.S = E.cloneSuper(m.S); m.S.bo[t[0]] &= ~BIT(t[1]); m.flash = (m.flash ? m.flash + ' ' : '') + 'Spark burns a boss mark.'; }
    }
    var why = skipCheck(m);
    if (why) { m.flash = (m.flash ? m.flash + ' ' : '') + why; m.turn = 'X'; m.hist.push(snapSuper(m)); return; }
    m.turn = 'O';
  }
  function legalSuper(m, b, c) { return E.superMoves(m.S).some(function (mv) { return mv[0] === b && mv[1] === c; }); }
  function tapSuper(m, b, c) {
    if (m.over || m.turn !== 'X') return null;
    if (!legalSuper(m, b, c)) return m.S.next >= 0 ? 'Play in the highlighted board.' : 'That board is finished.';
    var T = E.applySuper(m.S, b, c, 0), note = null;
    m.xPlaced++;
    if (T.res[b] === 0 && m.xPlaced % 4 === 0 && m.char === 'ember') {
      var t = pick(nb3(c).filter(function (n) { return T.bo[b] & BIT(n); }));
      if (t >= 0) { T.bo[b] &= ~BIT(t); note = 'Ember burns a neighbor.'; }
    }
    if (T.res[b] === 0 && m.xPlaced % 4 === 0 && m.char === 'twin') {
      var t2 = pick(nb3(c).filter(function (n) { return !((T.bx[b] | T.bo[b]) & BIT(n)); }));
      if (t2 >= 0) { T.bx[b] |= BIT(t2); recompute(T, b); if (T.res[b] !== 0 && T.next === b) T.next = -1; note = 'Twin lands twice.'; }
    }
    m.S = T; m.hint = null;
    if (T.rotated && m.lastAI) m.lastAI = { b: E.ROT[m.lastAI.b], c: E.ROT[m.lastAI.c] };
    if (superOver(m)) { m.xTurns++; return note; }
    phaseCheck(m);
    if (m.bonus) { m.bonus = 0; endTurnSuper(m); return note; }
    if (isStrikeTurn(m)) { m.bonus = 1; return (note ? note + ' ' : '') + 'Double Strike! Move again.'; }
    endTurnSuper(m);
    return note;
  }
  function useSuper(m, id) {
    if (m.over || m.turn !== 'X') return 'Wait for your turn.';
    var r = RELICS[id];
    if (!r || r.kind !== 'active') return null;
    if (m.bonus) return 'Make your second move first.';
    if (!(m.charges[id] > 0)) return 'No uses left.';
    if (id === 'rewind') return rewind(m);
    if (id === 'freeze' && m.freeze) return 'The boss is already frozen.';
    var la = m.lastAI;
    if (id === 'zap' && !(la && m.S.res[la.b] === 0 && (m.S.bo[la.b] & BIT(la.c)))) return 'Nothing to zap on an open board.';
    if (id === 'nuke' && !oMarksOpen(m.S).length) return 'No boss marks on open boards.';
    spend(m, id);
    switch (id) {
      case 'freeze': m.freeze = 1; return 'Frozen! You get two moves.';
      case 'zap':
        m.S = E.cloneSuper(m.S); m.S.bo[la.b] &= ~BIT(la.c); m.lastAI = null;
        if (m.char === 'thief') { m.S.bx[la.b] |= BIT(la.c); recompute(m.S, la.b); if (superOver(m)) { m.xTurns++; return 'Stolen, and it wins!'; } phaseCheck(m); return 'Stolen! That mark is yours now.'; }
        return 'Zapped. Your move.';
      case 'nuke':
        m.S = E.cloneSuper(m.S); for (var b = 0; b < 9; b++) if (m.S.res[b] === 0) m.S.bo[b] = 0;
        m.lastAI = null; return 'Boss marks wiped from open boards.';
      case 'hint':
        var h = E.searchSuper(m.S, 0, cfg.hintMs); m.hint = h ? [h.b, h.c] : null;
        return h ? 'Best move marked.' : 'No moves left.';
    }
    return null;
  }
  function aiSuper(m) {
    var ev = [];
    if (m.over || m.turn !== 'O') return ev;
    var n = 1 + (m.bossDouble ? 1 : 0); m.bossDouble = 0;
    for (var k = 0; k < n; k++) {
      var mv;
      if (m.brainLeft > 0) { m.brainLeft--; var all = E.superMoves(m.S); var p = all[rnd(all.length)]; mv = p ? { b: p[0], c: p[1] } : null; }
      else mv = E.searchSuper(m.S, 1, cfg.aiMsBoss[2]);
      if (!mv) break;
      var T = E.applySuper(m.S, mv.b, mv.c, 1);
      m.S = T;
      m.lastAI = T.rotated ? { b: E.ROT[mv.b], c: E.ROT[mv.c] } : { b: mv.b, c: mv.c };
      if (T.rotated) { m.rotatedNow = true; ev.push('The grid turns.'); }
      if (superOver(m)) break;
    }
    m.aiTurns++;
    if (m.flash) { ev.push(m.flash); m.flash = ''; }
    if (!m.over) { m.turn = 'X'; m.hist.push(snapSuper(m)); }
    return ev;
  }

  /* ---------- public dispatch ---------- */
  function tap(m, a, b) { return m.kind === 'grid' ? tapGrid(m, a) : tapSuper(m, a, b); }
  function use(m, id) { return m.kind === 'grid' ? useGrid(m, id) : useSuper(m, id); }
  function ai(m) { return m.kind === 'grid' ? aiGrid(m) : aiSuper(m); }

  /* ---------- save / load ---------- */
  function serialize(run) {
    return JSON.stringify(run, function (k, v) {
      if (k === 'g') return undefined;
      if (v && (v instanceof Int16Array || v instanceof Int8Array)) return { __ta: v instanceof Int16Array ? 16 : 8, a: Array.prototype.slice.call(v) };
      return v;
    });
  }
  function deserialize(str) {
    var run = JSON.parse(str, function (k, v) {
      if (v && v.__ta) return v.__ta === 16 ? new Int16Array(v.a) : new Int8Array(v.a);
      return v;
    });
    if (run.v !== 3) throw new Error('old save');
    if (run.match && run.match.kind === 'grid') run.match.g = rulesFor(run.match);
    return run;
  }

  return {
    cfg: cfg, SETS: SETS, RELICS: RELICS, CHARS: CHARS, CHAR_ORDER: CHAR_ORDER, OPPONENTS: OPPONENTS, BOSSES: BOSSES, GAMES: GAMES,
    newRun: newRun, startRun: startRun, pickChar: pickChar, startMatch: startMatch, resolve: resolve, next: next,
    buy: buy, heal: heal, leaveShop: leaveShop, pickReward: pickReward, priceOf: priceOf, healPrice: healPrice,
    has: has, gain: gain, advance: advance, refill: refill, setCount: setCount, setLevels: setLevels, maxCharges: maxCharges,
    tap: tap, use: use, ai: ai, nextRound: nextRound, legal: legal, legalCells: legalCells, dropCell: dropCell, emptyAt: emptyAt,
    isStrikeTurn: isStrikeTurn, strikeEvery: strikeEvery, legalSuper: legalSuper, boardsWon: boardsWon,
    serialize: serialize, deserialize: deserialize
  };
})(XOX);
if (typeof module !== 'undefined' && module.exports) module.exports = Game;
