/* XOX Rogue interface: renders the run state to the page. Needs XOX and Game. */
(function () {
  'use strict';
  var E = XOX, G = Game;
  var app = document.getElementById('app');
  var SAVE = 'xoxrogue.run.v2', BEST = 'xoxrogue.best.v1';
  var FULL = (1 << 25) - 1;
  var run = null;
  var ui = { msg: '', thinking: false, prevX: 0, prevO: 0, prevKey: '', best: null, saved: null, screenKey: '', boardTurn: false };

  /* ---------- storage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage may be unavailable */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function loadSaved() {
    var s = lsGet(SAVE); if (!s) return null;
    try { var r = G.deserialize(s); return r && r.phase && r.phase !== 'end' && r.phase !== 'title' ? r : null; } catch (e) { return null; }
  }
  function loadBest() {
    var s = lsGet(BEST), d = { farthest: 0, victories: 0, runs: 0 };
    if (s) { try { var o = JSON.parse(s); d.farthest = o.farthest | 0; d.victories = o.victories | 0; d.runs = o.runs | 0; } catch (e) { /* ignore */ } }
    return d;
  }
  function save() { if (run && run.phase !== 'end' && run.phase !== 'title') lsSet(SAVE, G.serialize(run)); }

  /* ---------- icons ---------- */
  var ICONS = {
    freeze: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5L4.2 16.5"/><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
    zap: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    nuke: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    rewind: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 3.5V8h4.5"/>',
    center: '<rect x="3.5" y="3.5" width="17" height="17"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    freebie: '<rect x="4" y="10" width="16" height="10"/><path d="M3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/>',
    strike: '<path d="M4 4l6 6M10 4l-6 6"/><path d="M14 14l6 6M20 14l-6 6"/>',
    sleepy: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    corners: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    plus: '<path d="M9 3.5h6V9h5.5v6H15v5.5H9V15H3.5V9H9z"/>',
    safetynet: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    heartup: '<path d="M12 20s-8-4.8-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15.2 12 20 12 20z"/><path d="M12 10.5v5M9.5 13h5"/>',
    ironheart: '<path d="M12 3l7 3v6c0 4.2-3 7.2-7 9-4-1.8-7-4.8-7-9V6z"/>',
    secondlife: '<path d="M12 20s-8-4.8-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15.2 12 20 12 20z"/><path d="M8 13h2l1.2-2.5 1.6 4 1.2-1.5H16"/>',
    piggy: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.5 9.5c-.6-.8-1.5-1.1-2.5-1.1-1.4 0-2.4.7-2.4 1.8 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.6 1.9-1 0-2-.4-2.6-1.2"/>',
    haggler: '<path d="M3.5 12V4.5H11l9.5 9.5-7 7z"/><circle cx="8" cy="9" r="1.3"/>',
    battery: '<rect x="3" y="8" width="16" height="8" rx="1.5"/><path d="M21 11v2M7 11v2M11 11v2M15 11v2"/>',
    overplay: '<path d="M5 5l7 7-7 7M12 5l7 7-7 7"/>',
    freepass: '<path d="M3.5 8h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4z"/><path d="M14 8v10" stroke-dasharray="2 2"/>',
    castingvote: '<rect x="4" y="12" width="16" height="8"/><path d="M8 12V9l4-4 4 4v3M9.5 16h5"/>',
    sneak: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><path d="M4 4l16 16"/>'
  };
  var HEART = '<path d="M12 20s-8-4.8-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>';
  var XM = '<svg class="m" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 8L32 32"/><path d="M32 8L8 32"/></svg>';
  var OM = '<svg class="m" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12.5"/></svg>';
  var STONE = '<svg class="m" viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="7" width="26" height="26" rx="3"/><path d="M11 29L29 11M11 21L21 11M19 29L29 19"/></svg>';
  var BIGX = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 6L34 34M34 6L6 34"/></svg>';
  var BIGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15"/></svg>';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function ic(id) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[id] || '') + '</svg>'; }
  function info(id) { return G.RELICS[id] || G.TRICKS[id] || G.COUNTERS[id] || { name: id, desc: '' }; }

  /* ---------- shared pieces ---------- */
  function whereText(r) { return 'Act ' + r.act + ' · ' + (r.idx === 3 ? 'Boss' : 'Match ' + (r.idx + 1) + ' of 3'); }
  function heartsHtml() {
    var s = '';
    for (var i = 0; i < run.maxHearts; i++) s += '<svg class="heart ' + (i < run.hearts ? 'full' : 'empty') + '" viewBox="0 0 24 24" aria-hidden="true">' + HEART + '</svg>';
    return '<span class="hearts" role="img" aria-label="' + run.hearts + ' of ' + run.maxHearts + ' hearts">' + s + '</span>';
  }
  function goldHtml() {
    return '<span class="gold" aria-label="' + run.gold + ' gold"><svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>' + run.gold + '</span>';
  }
  function header(label) {
    return '<header class="top"><button class="link" data-act="menu">Menu</button><div class="where">' + label + '</div><div class="stats">' + heartsHtml() + goldHtml() + '</div></header>';
  }
  function strip() {
    var cur = (run.act - 1) * 4 + run.idx, out = '<div class="strip" role="img" aria-label="Run progress, ' + whereText(run) + '">';
    for (var a = 1; a <= 3; a++) {
      out += '<div class="act"><span class="al">A' + a + '</span>';
      for (var k = 0; k < 4; k++) {
        var n = (a - 1) * 4 + k;
        out += '<i class="' + (k === 3 ? 'boss ' : '') + (n < cur ? 'done' : (n === cur ? 'now' : '')) + '"></i>';
      }
      out += '</div>';
    }
    return out + '</div>';
  }
  function maxCharges(id) { return (G.RELICS[id].charges || 0) + (G.has(run, 'battery') ? 1 : 0); }
  function pips(n, max) { var s = ''; for (var i = 0; i < max; i++) s += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return '<span class="pips" aria-hidden="true">' + s + '</span>'; }

  /* ---------- screens ---------- */
  function screenTitle() {
    var b = ui.best, s = ui.saved;
    var farthest = b.farthest ? 'Furthest so far: act ' + (Math.floor((b.farthest - 1) / 4) + 1) + ', ' + (((b.farthest - 1) % 4) === 3 ? 'boss' : 'match ' + (((b.farthest - 1) % 4) + 1)) + (b.victories ? ' · ' + b.victories + (b.victories === 1 ? ' run cleared' : ' runs cleared') : '') : '';
    return '<section class="hero">' +
      '<div class="logo" aria-hidden="true"><span class="lx">X</span><span class="lo">O</span><span class="lx2">X</span></div>' +
      '<h1 class="sub-logo mono" style="font-size:13px;font-weight:600;letter-spacing:.14em">XOX Rogue</h1>' +
      '<p class="lede">Tic-tac-toe against an AI that never blunders. You cannot outplay it, so out-build it.</p>' +
      '<div class="stack">' +
        '<button class="btn primary block" data-act="new">Start a run</button>' +
        (s ? '<button class="btn block" data-act="continue">Continue run <small>' + whereText(s) + '</small></button>' : '') +
      '</div>' +
      (farthest ? '<p class="mono" style="text-align:center">' + farthest + '</p>' : '') +
      '<div class="rules">' +
        '<p><b>Four in a row wins</b> on a 5×5 board. You move first. A plain game is a draw.</p>' +
        '<p><b>Relics bend the rules.</b> Their charges refill at the start of each act, so spend them where they count.</p>' +
        '<p><b>Win matches to earn gold</b> and buy more relics. Hearts run out when you draw or lose.</p>' +
        '<p><b>Each act ends in Super XOX:</b> nine small boards, where your move sends the boss to the matching board.</p>' +
      '</div></section>';
  }

  function useTag(id) {
    var r = G.RELICS[id];
    if (!r) return 'Boss trick';
    return r.kind === 'active' ? 'Button \u00B7 ' + r.charges + (r.charges > 1 ? ' uses' : ' use') + ' per act' : 'Automatic';
  }

  function relicCardBtn(id, act, label) {
    var r = info(id);
    return '<button class="card" data-act="' + act + '" data-id="' + id + '">' + ic(id) +
      '<span class="body"><h3>' + r.name + '</h3><p>' + r.desc + '</p></span>' +
      '<span class="foot"><span class="tag-line">' + useTag(id) + '</span><span class="btn sm primary" aria-hidden="true">' + label + '</span></span></button>';
  }

  function screenStarter() {
    return header('New run') +
      '<h2>Pick your first relic</h2>' +
      '<p>Each one is a way to beat the AI. You can buy more after every win.</p>' +
      '<div class="cards">' + run.starters.map(function (id) { return relicCardBtn(id, 'starter', 'Take'); }).join('') + '</div>';
  }

  function ownedRelics() {
    if (!run.relics.length) return '';
    return '<div class="stack"><p class="mono">Your relics</p><div class="tray">' + run.relics.map(function (id) {
      var r = G.RELICS[id], act = r.kind === 'active';
      return '<div class="relic ' + (act ? '' : 'passive') + '" style="cursor:default">' + ic(id) + '<span class="t"><span class="rn">' + r.name + '</span>' + (act ? pips(run.charges[id] || 0, maxCharges(id)) : '<span class="pl">Automatic</span>') + '</span></div>';
    }).join('') + '</div></div>';
  }

  function screenBriefing() {
    var boss = run.idx === 3, out = header(whereText(run)) + strip();
    if (!boss) {
      out += '<h2>' + whereText(run) + '</h2>';
      if (run.counters.length) {
        out += '<div class="stack"><p class="mono">AI relics this match</p><div class="cards">' + run.counters.map(function (id) {
          return '<div class="card counter"><span class="body"><h3>' + G.COUNTERS[id].name + '</h3><p>' + G.COUNTERS[id].desc + '</p></span></div>';
        }).join('') + '</div></div>';
      } else {
        out += '<p>The AI has no relics yet. Act 2 gives it one per match.</p>';
      }
      out += ownedRelics() + '<button class="btn primary block" data-act="startmatch">Start match</button>';
    } else {
      var b = G.BOSSES[run.act - 1];
      out += '<h2>Boss: ' + b.name + '</h2>' +
        '<div class="card boss"><span class="body"><p class="tag-line">Super XOX</p><p style="color:var(--ink);font-size:16px">Nine small boards. Win three in a row to win the match. The square you play in sends the boss to the board in the same position. ' + b.blurb + '</p></span></div>' +
        '<div class="stack"><p class="mono">Pick one trick for this fight</p><div class="cards">' + run.trickChoices.map(function (id) {
          var t = G.TRICKS[id], on = run.trick === id;
          return '<button class="card" data-act="trick" data-id="' + id + '" aria-pressed="' + on + '">' + ic(id) + '<span class="body"><h3>' + t.name + '</h3><p>' + t.desc + '</p></span></button>';
        }).join('') + '</div></div>' +
        (run.relics.some(function (id) { return id === 'rewind' || id === 'hint'; }) ? '<p class="tag-line">Rewind and Hint also work here.</p>' : '') +
        '<button class="btn primary block" data-act="startmatch"' + (run.trick ? '' : ' disabled') + '>' + (run.trick ? 'Start the boss fight' : 'Pick a trick first') + '</button>';
    }
    return out;
  }

  /* ----- 5x5 ----- */
  function cellLabel(m, i) {
    var b = 1 << i, st = 'empty';
    if (m.b & b) st = 'blocked'; else if (m.x & b) st = 'your mark'; else if (m.o & b) st = 'AI mark';
    return 'Row ' + (Math.floor(i / 5) + 1) + ', column ' + (i % 5 + 1) + ': ' + st;
  }
  function board5(m) {
    var fresh = (m.x & ~ui.prevX) | (m.o & ~ui.prevO), out = '<div class="board5" role="group" aria-label="5 by 5 board">';
    for (var i = 0; i < 25; i++) {
      var b = 1 << i, cls = 'cell', inner = '';
      if (m.b & b) { cls += ' stone'; inner = STONE; }
      else if (m.x & b) { cls += ' x'; inner = XM; }
      else if (m.o & b) { cls += ' o'; inner = OM; }
      if (fresh & b) cls += ' fresh';
      if (m.winMask & b) cls += ' win';
      if (m.hint === i) cls += ' hint';
      if (m.lastAI === i && (m.o & b) && !m.over) { cls += ' last'; inner += '<i class="dot"></i>'; }
      out += '<button class="' + cls + '" data-act="cell" data-i="' + i + '" aria-label="' + cellLabel(m, i) + '">' + inner + '</button>';
    }
    return out + '</div>';
  }

  function statusHtml(m) {
    var text;
    if (run.phase === 'result') {
      var o = run.result;
      if (o.boss) text = o.outcome === 'win' ? 'You took the boss down.' : 'The boss fight is over.';
      else if (m.over === 'win') text = 'You broke the draw.';
      else if (o.outcome === 'win') text = 'Counted as a win.';
      else text = m.over === 'draw' ? 'No line left to win.' : 'The AI got four in a row.';
    } else if (ui.thinking) text = '<span class="dots">The AI is thinking</span>';
    else if (ui.msg) text = esc(ui.msg);
    else if (m.kind === '5' && m.perks.strike && m.xTurns % 3 === 2) text = 'Double Strike turn: place 2 marks.';
    else if (m.kind === '5') text = 'Your move. Four in a row wins.';
    else if (m.extra > 0) text = 'Overplay: you move twice.';
    else text = m.S.next >= 0 ? 'Play in the highlighted board.' : 'The boss sent you anywhere. Play on any open board.';
    return '<div class="status" aria-live="polite"><p>' + text + '</p></div>';
  }

  function trayHtml(m) {
    var live = run.phase === 'match' && m.turn === 'X' && !m.over && !ui.thinking, items = [];
    if (m.kind === '5') {
      run.relics.forEach(function (id) {
        var r = G.RELICS[id];
        if (r.kind === 'active') items.push({ id: id, active: true, n: m.charges[id] || 0, max: maxCharges(id) });
        else items.push({ id: id, active: false });
      });
    } else {
      if (m.trick === 'overplay' || m.trick === 'freepass') items.push({ id: m.trick, active: true, n: m.charges[m.trick] || 0, max: 1 + (G.has(run, 'battery') ? 1 : 0) });
      else if (m.trick) items.push({ id: m.trick, active: false, trick: true });
      ['rewind', 'hint'].forEach(function (id) { if (m.charges[id] !== undefined) items.push({ id: id, active: true, n: m.charges[id], max: maxCharges(id) }); });
    }
    if (!items.length) return '';
    return '<div class="tray">' + items.map(function (it) {
      var r = info(it.id), empty = it.active && it.n < 1;
      var armed = (it.id === 'freeze' && m.kind === '5' && m.freeze > 0) || (it.id === 'overplay' && m.kind === 'boss' && m.extra > 0);
      return '<button class="relic' + (it.active ? '' : ' passive') + (empty ? ' empty' : '') + '" data-act="relic" data-id="' + it.id + '" aria-pressed="' + (armed ? 'true' : 'false') + '" title="' + esc(r.desc) + '"' + (it.active && !live ? ' aria-disabled="true"' : '') + '>' +
        ic(it.id) + '<span class="t"><span class="rn">' + r.name + '</span>' + (it.active ? pips(it.n, it.max) : '<span class="pl">' + (it.trick ? 'Boss trick' : 'Automatic') + '</span>') + '</span></button>';
    }).join('') + '</div>';
  }

  function nextLabel() {
    var o = run.result;
    if (run.hearts <= 0) return 'See results';
    if (o.boss && o.outcome === 'win') return 'Choose a relic';
    if (!o.boss && o.outcome === 'win') return 'Visit the shop';
    if (run.idx === 3 && run.act === 3) return 'See results';
    return run.idx === 2 ? 'On to the boss' : 'Next match';
  }
  function resultHtml() {
    var o = run.result, win = o.outcome === 'win', rows = '', bonus = 0;
    o.bonuses.forEach(function (b) { bonus += b[1]; });
    if (o.gold) rows += '<div><span>' + (o.boss ? 'Boss reward' : 'Match won') + '</span><span class="v">+' + (o.gold - bonus) + ' gold</span></div>';
    o.bonuses.forEach(function (b) { rows += '<div><span>' + b[0] + '</span><span class="v">+' + b[1] + ' gold</span></div>'; });
    if (o.hearts) rows += '<div><span>Hearts lost</span><span class="v">−' + o.hearts + '</span></div>';
    if (!o.gold && !o.hearts) rows += '<div><span>' + (o.outcome === 'draw' ? 'Act 1 draws cost nothing.' : '') + '</span><span class="v"></span></div>';
    o.notes.forEach(function (n) { rows += '<div><span class="n">' + esc(n) + '</span><span class="v"></span></div>'; });
    var title = o.boss ? (win ? 'Boss beaten' : (o.outcome === 'draw' ? 'Boss held on' : 'The boss wins')) : (win ? 'You won' : (o.outcome === 'draw' ? 'Draw' : 'You lost'));
    return '<div class="result ' + (win ? '' : 'loss') + '"><h2>' + title + '</h2><div class="lines">' + rows + '</div>' +
      '<button class="btn primary block" data-act="next">' + nextLabel() + '</button></div>';
  }

  function counterBar(m) {
    var out = '';
    if (m.counters && m.counters.length) out += '<div class="chips"><span class="mono">AI relics</span>' + m.counters.map(function (id) { return '<span class="chip" title="' + esc(G.COUNTERS[id].desc) + '">' + G.COUNTERS[id].name + '</span>'; }).join('') + '</div>';
    var p = [];
    if (m.perks && m.perks.strike) { var n = (3 - m.xTurns % 3) % 3; p.push('Double Strike: ' + (n === 0 ? 'this turn' : 'in ' + n)); }
    if (m.perks && m.perks.sleepy) { var k = 4 - (m.aiDue % 4); p.push('AI sleeps: ' + (k === 1 ? 'next turn' : 'in ' + k)); }
    if (p.length) out += '<div class="chips">' + p.map(function (t) { return '<span class="chip good">' + t + '</span>'; }).join('') + '</div>';
    return out;
  }

  function screenMatch5() {
    var m = run.match;
    return header(whereText(run)) + strip() + counterBar(m) + statusHtml(m) + board5(m) +
      (run.phase === 'result' ? resultHtml() : trayHtml(m));
  }

  /* ----- boss (Super XOX) ----- */
  function board9(m) {
    var S = m.S, myTurn = run.phase === 'match' && m.turn === 'X' && !m.over && !ui.thinking;
    var legal = {};
    if (myTurn) E.superMoves(S).forEach(function (mv) { legal[mv[0] * 9 + mv[1]] = 1; });
    var out = '<div class="board9' + (ui.boardTurn ? ' turn' : '') + '" role="group" aria-label="Super XOX board">';
    for (var b = 0; b < 9; b++) {
      var res = S.res[b], cls = 'sub';
      if (res === 1) cls += ' won wx'; else if (res === 2) cls += ' won wo'; else if (res === 3) cls += ' dead';
      else if (!m.over && (S.next < 0 || S.next === b)) cls += S.next < 0 ? ' free' : ' live';
      out += '<div class="' + cls + '" data-b="' + b + '">';
      if (S.cursed === b) out += '<span class="badge">CURSED</span>';
      for (var c = 0; c < 9; c++) {
        var bit = 1 << c, ccls = 'cell', inner = '';
        if (S.bx[b] & bit) { ccls += ' x'; inner = XM; } else if (S.bo[b] & bit) { ccls += ' o'; inner = OM; }
        if (legal[b * 9 + c]) ccls += ' legal';
        if (m.lastAI && m.lastAI.b === b && m.lastAI.c === c && !m.over) { ccls += ' last'; inner += '<i class="dot" style="top:3px;left:3px;width:6px;height:6px"></i>'; }
        if (m.hint && m.hint[0] === b && m.hint[1] === c) ccls += ' hint';
        var lab = 'Board ' + (b + 1) + ', square ' + (c + 1) + (S.bx[b] & bit ? ': your mark' : (S.bo[b] & bit ? ': boss mark' : ''));
        out += '<button class="' + ccls + '" data-act="cell9" data-b="' + b + '" data-c="' + c + '" aria-label="' + lab + '">' + inner + '</button>';
      }
      if (res === 1) out += '<span class="big">' + BIGX + '</span>'; else if (res === 2) out += '<span class="big">' + BIGO + '</span>'; else if (res === 3) out += '<span class="big">draw</span>';
      out += '</div>';
    }
    return out + '</div>';
  }
  function screenBoss() {
    var m = run.match, S = m.S, nx = 0, no = 0;
    for (var i = 0; i < 9; i++) { if (S.res[i] === 1) nx++; else if (S.res[i] === 2) no++; }
    return header(whereText(run)) + strip() +
      '<div class="boss-head"><h3>' + m.boss.name + '</h3><div class="score"><span>You <b style="color:var(--x)">' + nx + '</b></span><span>Boss <b style="color:var(--o)">' + no + '</b></span></div></div>' +
      '<p class="tag-line" style="margin-top:-8px">' + m.boss.blurb + '</p>' +
      statusHtml(m) + board9(m) + (run.phase === 'result' ? resultHtml() : trayHtml(m));
  }

  /* ----- shop, reward, end ----- */
  function screenShop() {
    var cards = run.shop.map(function (id) {
      var r = G.RELICS[id], p = G.priceOf(run, id), can = run.gold >= p;
      return '<div class="card static">' + ic(id) + '<span class="body"><h3>' + r.name + '</h3><p>' + r.desc + '</p></span><span class="foot"><span class="tag-line">' + useTag(id) + '</span>' +
        '<button class="btn sm primary" data-act="buy" data-id="' + id + '"' + (can ? '' : ' disabled') + '>Buy · ' + p + ' gold</button></span></div>';
    }).join('');
    var hp = G.healPrice(run), canHeal = run.hearts < run.maxHearts && run.gold >= hp;
    return header('Shop') + '<h2>Shop</h2>' +
      '<p>' + (run.shop.length ? 'Buy what you can afford. Unsold relics are gone when you leave.' : 'You bought everything on offer.') + '</p>' +
      '<div class="cards">' + cards + '</div>' +
      '<div class="card static" style="grid-template-columns:1fr"><span class="body"><h3>Heal a heart</h3><p>' + (run.hearts >= run.maxHearts ? 'Your hearts are full.' : 'Hearts: ' + run.hearts + ' of ' + run.maxHearts + '.') + '</p></span><span class="foot"><span></span><button class="btn sm" data-act="heal"' + (canHeal ? '' : ' disabled') + '>Heal · ' + hp + ' gold</button></span></div>' +
      (ui.msg ? '<p class="tag-line" aria-live="polite">' + esc(ui.msg) + '</p>' : '') +
      ownedRelics() +
      '<button class="btn primary block" data-act="leave">Leave the shop</button>';
  }
  function screenReward() {
    return header('Boss reward') + '<h2>Pick a relic</h2><p>Free, for beating the boss.</p>' +
      '<div class="cards">' + run.reward.map(function (id) { return relicCardBtn(id, 'reward', 'Take'); }).join('') + '</div>';
  }
  function screenEnd() {
    var won = run.over === 'won', s = run.stats;
    return '<h2>' + (won ? 'Run cleared' : 'Out of hearts') + '</h2>' +
      '<p>' + (won ? 'You beat all three bosses with ' + run.hearts + (run.hearts === 1 ? ' heart' : ' hearts') + ' left.' : 'You fell in ' + whereText(run).replace(' · ', ', ').toLowerCase() + '.') + '</p>' +
      '<div class="result' + (won ? '' : ' loss') + '"><dl class="sum">' +
      '<dt>Matches played</dt><dd>' + s.matches + '</dd><dt>Wins</dt><dd>' + s.wins + '</dd><dt>Draws</dt><dd>' + s.draws + '</dd><dt>Losses</dt><dd>' + s.losses + '</dd><dt>Bosses beaten</dt><dd>' + s.bossWins + ' of 3</dd><dt>Relics</dt><dd>' + run.relics.length + '</dd></dl></div>' +
      (run.relics.length ? '<p class="tag-line">' + run.relics.map(function (id) { return G.RELICS[id].name; }).join(' · ') + '</p>' : '') +
      '<div class="stack"><button class="btn primary block" data-act="new">Start a new run</button><button class="btn block" data-act="menu">Back to title</button></div>';
  }

  /* ---------- render ---------- */
  function render() {
    var html;
    if (!run) html = screenTitle();
    else switch (run.phase) {
      case 'starter': html = screenStarter(); break;
      case 'briefing': html = screenBriefing(); break;
      case 'match': case 'result': html = run.match ? (run.match.kind === '5' ? screenMatch5() : screenBoss()) : screenTitle(); break;
      case 'shop': html = screenShop(); break;
      case 'reward': html = screenReward(); break;
      case 'end': html = screenEnd(); break;
      default: html = screenTitle();
    }
    app.innerHTML = '<div class="shell">' + html + '</div>';
    var m = run && run.match;
    if (m && m.kind === '5') { ui.prevX = m.x; ui.prevO = m.o; } else { ui.prevX = 0; ui.prevO = 0; }
    if (m) m.rotatedNow = false;
    ui.boardTurn = false;
    var key = run ? run.phase + ':' + run.act + ':' + run.idx : 'title';
    if (key !== ui.screenKey) { ui.screenKey = key; try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } }
  }

  /* ---------- flow ---------- */
  function finishRun() {
    if (run.recorded) return;
    run.recorded = true;
    var b = ui.best, prog = run.over === 'won' ? 12 : (run.act - 1) * 4 + run.idx + 1;
    b.runs++; if (prog > b.farthest) b.farthest = prog; if (run.over === 'won') b.victories++;
    lsSet(BEST, JSON.stringify(b));
    lsDel(SAVE); ui.saved = null;
  }
  function afterAction() {
    var m = run.match;
    if (m && m.flash) { ui.msg = (ui.msg ? ui.msg + ' ' : '') + m.flash; m.flash = ''; }
    if (run.phase === 'match' && m && m.over) G.resolve(run);
    if (run.phase === 'end') finishRun(); else save();
    var needAI = run.phase === 'match' && m && !m.over && m.turn === 'O';
    ui.thinking = !!needAI;
    if (m && m.kind === 'boss' && m.rotatedNow) ui.boardTurn = true;
    render();
    if (needAI) scheduleAI();
  }
  function scheduleAI() {
    var r = run, m = r.match;
    setTimeout(function () {
      if (run !== r || r.match !== m || !ui.thinking) return;
      var ev = m.kind === '5' ? G.ai5(m) : G.aiBoss(m);
      ui.msg = ev.join(' ');
      afterAction();
    }, 420);
  }
  function canAct() { return run && run.phase === 'match' && run.match && run.match.turn === 'X' && !run.match.over && !ui.thinking; }

  function onAct(a, d) {
    var m = run && run.match, msg;
    switch (a) {
      case 'new': run = G.startRun(); ui.msg = ''; ui.thinking = false; save(); render(); break;
      case 'continue':
        if (!ui.saved) return;
        run = ui.saved; ui.saved = null; ui.msg = ''; ui.thinking = false;
        ui.prevX = run.match && run.match.kind === '5' ? run.match.x : 0; ui.prevO = run.match && run.match.kind === '5' ? run.match.o : 0;
        afterAction(); break;
      case 'menu': if (run && run.phase !== 'end') save(); run = null; ui.thinking = false; ui.msg = ''; ui.saved = loadSaved(); render(); break;
      case 'starter': G.pickStarter(run, d.id); ui.msg = ''; save(); render(); break;
      case 'trick': G.chooseTrick(run, d.id); render(); break;
      case 'startmatch': ui.msg = ''; ui.prevX = 0; ui.prevO = 0; if (G.startMatch(run)) afterAction(); break;
      case 'cell':
        if (!canAct() || m.kind !== '5') return;
        ui.msg = G.tap5(m, +d.i) || ''; afterAction(); break;
      case 'cell9':
        if (!canAct() || m.kind !== 'boss') return;
        ui.msg = G.tapBoss(m, +d.b, +d.c) || ''; afterAction(); break;
      case 'relic':
        if (!m || run.phase !== 'match') return;
        var id = d.id, r = G.RELICS[id] || G.TRICKS[id];
        var isActive = G.RELICS[id] ? G.RELICS[id].kind === 'active' : (id === 'overplay' || id === 'freepass');
        if (!isActive) { ui.msg = r.name + ': ' + r.desc; render(); return; }
        if (!canAct()) return;
        ui.msg = (m.kind === '5' ? G.use5(m, id) : G.useBoss(m, id)) || ''; afterAction(); break;
      case 'next': G.next(run); ui.msg = ''; afterAction(); break;
      case 'buy': ui.msg = G.buy(run, d.id); save(); render(); break;
      case 'heal': ui.msg = G.heal(run); save(); render(); break;
      case 'leave': G.leaveShop(run); ui.msg = ''; afterAction(); break;
      case 'reward': G.pickReward(run, d.id); ui.msg = ''; afterAction(); break;
    }
  }

  app.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !t.dataset.act || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    onAct(t.dataset.act, t.dataset);
  });

  lsDel('xoxrogue.run.v1');
  ui.best = loadBest();
  ui.saved = loadSaved();
  render();
})();
