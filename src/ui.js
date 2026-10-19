/* XOX Rogue interface. Needs XOX and Game. */
(function () {
  'use strict';
  var E = XOX, G = Game;
  var app = document.getElementById('app');
  var SAVE = 'xoxrogue.run.v3', META = 'xoxrogue.meta.v1';
  var run = null;
  var ui = { msg: '', thinking: false, prevX: 0, prevO: 0, meta: null, saved: null, screenKey: '', boardTurn: false, charIdx: 0, timer: null, timerKey: '', timerStart: 0, quake: false };

  /* ---------- storage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage may be unavailable */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function loadSaved() {
    var s = lsGet(SAVE); if (!s) return null;
    try { var r = G.deserialize(s); return r && r.phase && r.phase !== 'end' && r.phase !== 'title' ? r : null; } catch (e) { return null; }
  }
  function loadMeta() {
    var d = { unlocked: ['frost', 'ember'], farthest: 0, victories: 0, runs: 0 };
    var s = lsGet(META);
    if (s) { try { var o = JSON.parse(s); if (Array.isArray(o.unlocked)) d.unlocked = o.unlocked; d.farthest = o.farthest | 0; d.victories = o.victories | 0; d.runs = o.runs | 0; } catch (e) { /* ignore */ } }
    return d;
  }
  function saveMeta() { lsSet(META, JSON.stringify(ui.meta)); }
  function save() { if (run && run.phase !== 'end' && run.phase !== 'title') lsSet(SAVE, G.serialize(run)); }

  /* ---------- glyphs ---------- */
  var GLYPH = {
    frost: '<path d="M20 6v28M7.9 13l24.2 14M32.1 13L7.9 27"/><path d="M15.5 8.5L20 12l4.5-3.5M15.5 31.5L20 28l4.5 3.5"/>',
    ember: '<path d="M20 35c-6.5 0-10.5-4.5-10.5-10.5 0-6 5-9 6.5-16 4 3.5 5 7 4.5 10.5 2-1.5 3-3.5 3.5-6 4 4 6.5 7.5 6.5 11.5 0 6-4 10.5-10.5 10.5z"/>',
    thief: '<path d="M5 16c5-4 10-4 15 0 5-4 10-4 15 0 0 8-4.5 12-9 12-3 0-5-2-6-5-1 3-3 5-6 5-4.5 0-9-4-9-12z"/>',
    twin: '<path d="M7 7l11 11M18 7L7 18M22 22l11 11M33 22L22 33"/>',
    knight: '<path d="M20 5l13 5v10c0 8-6 13.5-13 16-7-2.5-13-8-13-16V10z"/><path d="M20 12v16"/>',
    copycat: '<circle cx="16" cy="20" r="10"/><circle cx="24" cy="20" r="10"/>',
    gambler: '<rect x="8" y="8" width="24" height="24" rx="4"/><circle class="f" cx="15" cy="15" r="2.4"/><circle class="f" cx="25" cy="25" r="2.4"/>',
    napper: '<path d="M27 8a13 13 0 1 0 0 24A10 10 0 0 1 27 8z"/>',
    hoarder: '<path d="M20 7L33 31H7z"/>',
    bully: '<circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="5"/>',
    mason: '<rect x="8" y="8" width="24" height="24"/><path d="M8 20h24M20 8v12M14 20v12M26 20v12"/>',
    sniper: '<circle cx="20" cy="20" r="10"/><path d="M20 4v9M20 27v9M4 20h9M27 20h9"/>',
    janitor: '<path d="M13 8h14l7 12-7 12H13L6 20z"/>',
    warden: '<path d="M20 6L34 20 20 34 6 20z"/>',
    referee: '<path d="M20 6l4 9.5 10 .8-7.6 6.6 2.4 9.8L20 27.4l-8.8 5.3 2.4-9.8L6 16.3l10-.8z"/>',
    avalanche: '<path d="M5 32L16 12l6 10 4-6 9 16z"/>',
    grandmaster: '<path d="M7 31h26M8 31L6 12l8 7 6-10 6 10 8-7-2 19z"/>'
  };
  function gl(id, cls) { return '<svg class="' + (cls || 'm') + '" viewBox="0 0 40 40" aria-hidden="true">' + (GLYPH[id] || '<circle cx="20" cy="20" r="12.5"/>') + '</svg>'; }
  var STONE = '<svg class="m stone" viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="7" width="26" height="26" rx="3"/><path d="M11 29L29 11M11 21L21 11M19 29L29 19"/></svg>';

  var ICONS = {
    freeze: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5L4.2 16.5"/><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
    sleepy: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    brainfreeze: '<path d="M8 9a5 5 0 0 1 8 0 5 5 0 0 1 2 8.5V20H6v-2.5A5 5 0 0 1 8 9z"/><path d="M12 9v11"/>',
    zap: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    nuke: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    strike: '<path d="M4 4l6 6M10 4l-6 6"/><path d="M14 14l6 6M20 14l-6 6"/>',
    freebie: '<rect x="4" y="10" width="16" height="10"/><path d="M3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/>',
    center: '<rect x="3.5" y="3.5" width="17" height="17"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    safetynet: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    piggy: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.5 9.5c-.6-.8-1.5-1.1-2.5-1.1-1.4 0-2.4.7-2.4 1.8 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.6 1.9-1 0-2-.4-2.6-1.2"/>',
    haggler: '<path d="M3.5 12V4.5H11l9.5 9.5-7 7z"/><circle cx="8" cy="9" r="1.3"/>',
    heartup: '<path d="M12 20s-8-4.8-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15.2 12 20 12 20z"/><path d="M12 10.5v5M9.5 13h5"/>',
    ironheart: '<path d="M12 3l7 3v6c0 4.2-3 7.2-7 9-4-1.8-7-4.8-7-9V6z"/>',
    secondlife: '<path d="M12 20s-8-4.8-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15.2 12 20 12 20z"/><path d="M8 13h2l1.2-2.5 1.6 4 1.2-1.5H16"/>',
    hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    rewind: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 3.5V8h4.5"/>',
    corners: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    plus: '<path d="M9 3.5h6V9h5.5v6H15v5.5H9V15H3.5V9H9z"/>',
    battery: '<rect x="3" y="8" width="16" height="8" rx="1.5"/><path d="M21 11v2M7 11v2M11 11v2M15 11v2"/>'
  };
  var HEART = '<path d="M12 20s-8-4.8-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>';
  var ARROW_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var LOCK = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function ic(id) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[id] || '') + '</svg>'; }

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
      for (var k = 0; k < 4; k++) { var n = (a - 1) * 4 + k; out += '<i class="' + (k === 3 ? 'boss ' : '') + (n < cur ? 'done' : (n === cur ? 'now' : '')) + '"></i>'; }
      out += '</div>';
    }
    return out + '</div>';
  }
  function pips(n, max) { var s = ''; for (var i = 0; i < max; i++) s += '<i class="' + (i < n ? 'on' : '') + '"></i>'; return '<span class="pips" aria-hidden="true">' + s + '</span>'; }
  function setChip(set, count) {
    if (!set) return '';
    var dots = ''; for (var i = 0; i < 3; i++) dots += i < count ? '●' : '○';
    return '<span class="set s-' + set + '">' + G.SETS[set].name + (count !== undefined ? ' <b>' + dots + '</b>' : '') + '</span>';
  }
  function useTag(id) { var r = G.RELICS[id]; return r.kind === 'active' ? 'Button · ' + r.charges + (r.charges > 1 ? ' uses' : ' use') + ' per act' : 'Automatic'; }

  /* ---------- title ---------- */
  function screenTitle() {
    var m = ui.meta, s = ui.saved;
    var progress = m.farthest ? 'Furthest: act ' + (Math.floor((m.farthest - 1) / 4) + 1) + (m.victories ? ' · ' + m.victories + (m.victories === 1 ? ' run cleared' : ' runs cleared') : '') : '';
    return '<section class="hero">' +
      '<div class="logo" aria-hidden="true"><span class="lx">X</span><span class="lo">O</span><span class="lx2">X</span></div>' +
      '<h1 class="sub-logo mono">XOX Rogue</h1>' +
      '<p class="lede">Pick a character, collect relics, and break an AI that never blunders.</p>' +
      '<div class="stack">' +
        '<button class="btn primary block" data-act="new">Start a run</button>' +
        (s ? '<button class="btn block" data-act="continue">Continue run <small>' + G.CHARS[s.char].name + ' · ' + whereText(s) + '</small></button>' : '') +
      '</div>' +
      '<p class="mono center">' + m.unlocked.length + ' of 5 characters unlocked' + (progress ? ' · ' + progress : '') + '</p>' +
      '<div class="rules">' +
        '<p><b>Four in a row wins</b> on a 5×5 board. Pick your opponent before each match.</p>' +
        '<p><b>Relics come in sets.</b> Own 2 or 3 of a set for a bonus.</p>' +
        '<p><b>Each act ends with a boss</b> that plays a different game: Speed Round, Gravity, then Super XOX.</p>' +
      '</div></section>';
  }

  /* ---------- character carousel ---------- */
  function charCard(id) {
    var c = G.CHARS[id], locked = ui.meta.unlocked.indexOf(id) < 0;
    return '<article class="cc' + (locked ? ' locked' : '') + '" aria-label="' + c.name + (locked ? ', locked' : '') + '">' +
      '<div class="cc-glyph">' + gl(id, 'gl') + (locked ? LOCK : '') + '</div>' +
      '<h3>' + c.name + '</h3>' +
      '<p class="cc-trait">' + (locked ? esc(c.unlock) + ' to unlock.' : c.trait) + '</p>' +
      '<div class="cc-start">' + c.start.map(function (r) { return '<span class="mini">' + ic(r) + G.RELICS[r].name + '</span>'; }).join('') + '</div>' +
      '<div class="cc-set"><span class="tag-line">Set</span> ' + setChip(c.set) + '</div>' +
      '</article>';
  }
  function screenChar() {
    var ids = G.CHAR_ORDER;
    return header('New run') +
      '<h2>Choose your character</h2>' +
      '<div class="car">' +
        '<button class="car-arrow prev" data-act="carprev" aria-label="Previous character">' + ARROW_L + '</button>' +
        '<div class="car-view" id="carview" tabindex="0" role="group" aria-roledescription="carousel" aria-label="Characters">' +
          '<div class="car-track" id="cartrack">' + ids.map(charCard).join('') + '</div>' +
        '</div>' +
        '<button class="car-arrow next" data-act="carnext" aria-label="Next character">' + ARROW_R + '</button>' +
      '</div>' +
      '<div class="car-dots" id="cardots">' + ids.map(function (id, i) { return '<button data-act="cardot" data-i="' + i + '" aria-label="' + G.CHARS[id].name + '"></button>'; }).join('') + '</div>' +
      '<button class="btn primary block" id="carpick" data-act="pickchar">Play</button>' +
      '<p class="tag-line center">Swipe or use the arrows.</p>';
  }
  function setChar(i, animate) {
    var n = G.CHAR_ORDER.length;
    ui.charIdx = (i + n) % n;
    var track = document.getElementById('cartrack'); if (!track) return;
    track.style.transition = animate === false ? 'none' : '';
    track.style.transform = 'translateX(' + (-100 * ui.charIdx) + '%)';
    var dots = document.querySelectorAll('#cardots button');
    for (var k = 0; k < dots.length; k++) dots[k].setAttribute('aria-current', k === ui.charIdx ? 'true' : 'false');
    var cards = track.children;
    for (var j = 0; j < cards.length; j++) cards[j].setAttribute('aria-hidden', j === ui.charIdx ? 'false' : 'true');
    var id = G.CHAR_ORDER[ui.charIdx], locked = ui.meta.unlocked.indexOf(id) < 0, btn = document.getElementById('carpick');
    btn.disabled = locked;
    btn.textContent = locked ? 'Locked' : 'Play as ' + G.CHARS[id].name;
  }
  function bindCarousel() {
    var view = document.getElementById('carview'); if (!view) return;
    var track = document.getElementById('cartrack'), x0 = null, dx = 0, w = 1;
    setChar(ui.charIdx, false);
    view.addEventListener('pointerdown', function (e) { x0 = e.clientX; dx = 0; w = view.clientWidth || 1; track.style.transition = 'none'; try { view.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } });
    view.addEventListener('pointermove', function (e) {
      if (x0 === null) return;
      dx = e.clientX - x0;
      track.style.transform = 'translateX(calc(' + (-100 * ui.charIdx) + '% + ' + dx + 'px))';
    });
    function end() {
      if (x0 === null) return;
      x0 = null; track.style.transition = '';
      if (Math.abs(dx) > Math.min(60, w * 0.18)) setChar(ui.charIdx + (dx < 0 ? 1 : -1)); else setChar(ui.charIdx);
    }
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
    view.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { setChar(ui.charIdx + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { setChar(ui.charIdx - 1); e.preventDefault(); }
    });
  }

  /* ---------- build panel ---------- */
  function buildPanel() {
    if (!run.relics.length) return '';
    var lv = G.setLevels(run), sets = Object.keys(G.SETS).filter(function (s) { return lv[s] > 0; });
    var out = '<div class="stack"><p class="mono">Your build</p><div class="tray">' + run.relics.map(function (id) {
      var r = G.RELICS[id], act = r.kind === 'active';
      return '<div class="relic static' + (act ? '' : ' passive') + '">' + ic(id) + '<span class="t"><span class="rn">' + r.name + '</span>' + (act ? pips(run.charges[id] || 0, G.maxCharges(run, id)) : '<span class="pl">Automatic</span>') + '</span></div>';
    }).join('') + '</div>';
    if (sets.length) out += '<div class="sets">' + sets.map(function (s) {
      var S = G.SETS[s], n = lv[s];
      return '<div class="setrow">' + setChip(s, n) + '<div><span class="' + (n >= 2 ? 'on' : '') + '">2: ' + S.b2 + '</span><span class="' + (n >= 3 ? 'on' : '') + '">3: ' + S.b3 + '</span></div></div>';
    }).join('') + '</div>';
    return out + '</div>';
  }

  /* ---------- briefing ---------- */
  function screenBriefing() {
    var out = header(whereText(run)) + strip();
    if (run.idx < 3) {
      out += '<h2>Pick your opponent</h2><div class="cards">' + run.choices.map(function (id) {
        var o = G.OPPONENTS[id];
        return '<button class="card opp" data-act="opp" data-id="' + id + '"><span class="oglyph">' + gl(id, 'gl') + '</span><span class="body"><h3>' + o.name + '</h3><p>' + o.desc + '</p></span>' +
          '<span class="foot"><span class="tag-line">Win: +' + (2 + run.act) + ' gold</span><span class="btn sm primary" aria-hidden="true">Play</span></span></button>';
      }).join('') + '</div>';
    } else {
      var b = G.BOSSES[run.act - 1];
      out += '<div class="bosscard"><span class="oglyph big">' + gl(b.id, 'gl') + '</span><div class="body"><p class="tag-line">Boss · ' + b.title + '</p><h2>' + b.name + '</h2>' +
        '<ul>' + b.rules.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul><p class="tag-line">All your relics work here.</p></div></div>' +
        '<button class="btn primary block" data-act="startboss">Fight ' + b.name + '</button>';
    }
    return out + buildPanel();
  }

  /* ---------- match: chips ---------- */
  function until(period, count) { return period - 1 - (count % period); }
  function when(n, unit) { return n === 0 ? (unit === 'mark' ? 'next mark' : 'this turn') : 'in ' + n; }
  function chipsHtml(m) {
    var me = [], them = [];
    if (m.perks.strike) me.push(['tempo', 'Double Strike: ' + when(until(G.strikeEvery(m), m.xTurns))]);
    if (m.perks.spark) me.push(['fire', 'Spark: ' + when(until(5, m.xTurns))]);
    if (m.perks.sleepy) { var k = 4 - (m.aiDue % 4); me.push(['frost', 'AI sleeps: ' + (k === 1 ? 'next turn' : 'in ' + k)]); }
    if (m.char === 'ember') me.push(['fire', 'Burn: ' + when(until(4, m.xPlaced), 'mark')]);
    if (m.char === 'twin') me.push(['tempo', 'Twin: ' + when(until(4, m.xPlaced), 'mark')]);
    if (m.freeze) me.push(['frost', 'AI frozen']);
    var o = m.opp;
    if (o === 'gambler') them.push('Random move: ' + (until(3, m.aiTurns) === 0 ? 'next' : 'in ' + until(3, m.aiTurns)));
    if (o === 'hoarder') them.push('Stone: ' + (until(3, m.aiTurns) === 0 ? 'next' : 'in ' + until(3, m.aiTurns)));
    if (o === 'janitor') them.push('Erase: ' + (until(4, m.aiTurns) === 0 ? 'next' : 'in ' + until(4, m.aiTurns)));
    if (o === 'napper') them.push(m.napDouble ? 'Plays twice next' : 'Nap: ' + (until(5, m.aiDue) === 0 ? 'next' : 'in ' + until(5, m.aiDue)));
    if (o === 'avalanche') them.push('Floor falls in ' + (6 - (m.plies % 6)) + ' moves');
    if (o === 'warden' && m.silenceLeft) them.push('Next button fizzles');
    if (m.kind === 'super') them.push('Phase ' + m.phaseN + ' of 3');
    if (!me.length && !them.length) return '';
    return '<div class="chips">' + me.map(function (c) { return '<span class="chip s-' + c[0] + '">' + c[1] + '</span>'; }).join('') +
      them.map(function (t) { return '<span class="chip enemy">' + t + '</span>'; }).join('') + '</div>';
  }
  function foeBar(m) {
    var name, sub, glyph = m.opp;
    if (m.boss) { var b = G.BOSSES[run.act - 1]; name = b.name; sub = b.title; }
    else { name = G.OPPONENTS[m.opp].name; sub = G.OPPONENTS[m.opp].desc; }
    var score = '';
    if (m.series) score = '<div class="score"><span>Round ' + m.series.round + '</span><span>You <b class="cx">' + m.series.you + '</b></span><span>Them <b class="co">' + m.series.them + '</b></span></div>';
    if (m.kind === 'super') score = '<div class="score"><span>First to 3</span><span>You <b class="cx">' + G.boardsWon(m.S, 1) + '</b></span><span>Boss <b class="co">' + G.boardsWon(m.S, 2) + '</b></span></div>';
    return '<div class="foe"><span class="oglyph">' + gl(glyph, 'gl') + '</span><div class="body"><h3>' + name + '</h3><p class="tag-line">' + sub + '</p></div>' + score + '</div>';
  }

  /* ---------- match: status, tray, result ---------- */
  function statusHtml(m) {
    var text;
    if (run.phase === 'result') {
      var o = run.result;
      if (o.boss) text = o.outcome === 'win' ? 'You beat the boss.' : 'The boss fight is over.';
      else if (m.over === 'win') text = 'You broke the draw.';
      else if (o.outcome === 'win') text = 'Counted as a win.';
      else text = m.over === 'draw' ? 'No line left to win.' : 'The AI made its line.';
    } else if (m.turn === 'pause') text = m.pauseRound === 'win' ? 'You take the round!' : (m.pauseRound === 'loss' ? 'The Referee takes the round.' : 'Round drawn. No point.');
    else if (ui.thinking) text = '<span class="dots">' + (m.boss ? 'The boss is thinking' : 'The AI is thinking') + '</span>';
    else if (ui.msg) text = esc(ui.msg);
    else if (m.bonus) text = 'Place one more mark.';
    else if (G.isStrikeTurn(m) && m.perks.strike) text = 'Double Strike turn: place 2 marks.';
    else if (m.kind === 'super') text = m.S.next >= 0 ? 'Play in the highlighted board.' : 'Play on any open board.';
    else if (m.g.gravity) text = 'Tap a column to drop your mark.';
    else text = 'Your move. ' + m.g.k + ' in a row wins.';
    var timer = m.timed && run.phase === 'match' && m.turn === 'X' && !m.over ? '<div class="tbar" aria-hidden="true"><i id="tbar"></i></div>' : '';
    return '<div class="status" aria-live="polite"><p>' + text + '</p></div>' + timer;
  }
  function trayHtml(m) {
    var live = run.phase === 'match' && m.turn === 'X' && !m.over && !ui.thinking;
    return '<div class="tray">' + run.relics.map(function (id) {
      var r = G.RELICS[id], act = r.kind === 'active', n = m.charges[id] || 0, off = r.only === 'grid' && m.kind !== 'grid';
      var armed = id === 'freeze' && m.freeze > 0;
      return '<button class="relic' + (act ? '' : ' passive') + (act && n < 1 ? ' empty' : '') + (off ? ' off' : '') + '" data-act="relic" data-id="' + id + '" aria-pressed="' + armed + '"' + (act && !live ? ' aria-disabled="true"' : '') + '>' +
        ic(id) + '<span class="t"><span class="rn">' + r.name + '</span>' + (act ? pips(n, G.maxCharges(run, id)) : '<span class="pl">' + (off ? 'Not in this game' : 'Automatic') + '</span>') + '</span></button>';
    }).join('') + '</div>';
  }
  function nextLabel() {
    var o = run.result;
    if (run.hearts <= 0) return 'See results';
    if (o.boss && o.outcome === 'win') return run.act === 3 ? 'See results' : 'Choose a relic';
    if (!o.boss && o.outcome === 'win') return 'Visit the shop';
    return run.idx === 2 ? 'On to the boss' : 'Next match';
  }
  function resultHtml() {
    var o = run.result, win = o.outcome === 'win', rows = '', bonus = 0;
    o.bonuses.forEach(function (b) { bonus += b[1]; });
    if (o.gold - bonus > 0) rows += '<div><span>' + (o.boss ? 'Boss reward' : 'Match won') + '</span><span class="v">+' + (o.gold - bonus) + ' gold</span></div>';
    o.bonuses.forEach(function (b) { rows += '<div><span>' + b[0] + '</span><span class="v">+' + b[1] + ' gold</span></div>'; });
    if (o.hearts) rows += '<div><span>Hearts lost</span><span class="v">−' + o.hearts + '</span></div>';
    if (!o.gold && !o.hearts && o.outcome === 'draw') rows += '<div><span class="n">Act 1 draws cost nothing.</span></div>';
    o.notes.forEach(function (n) { rows += '<div><span class="n">' + esc(n) + '</span></div>'; });
    if (o.unlockNew) rows += '<div class="unlock">' + gl(o.unlock, 'gl') + '<span>New character unlocked: <b>' + G.CHARS[o.unlock].name + '</b></span></div>';
    var title = o.boss ? (win ? 'Boss beaten' : (o.outcome === 'draw' ? 'Boss held on' : 'The boss wins')) : (win ? 'You won' : (o.outcome === 'draw' ? 'Draw' : 'You lost'));
    return '<div class="result ' + (win ? '' : 'loss') + '"><h2>' + title + '</h2><div class="lines">' + rows + '</div>' +
      '<button class="btn primary block" data-act="next">' + nextLabel() + '</button></div>';
  }
  function pauseHtml(m) {
    var s = m.series;
    return '<div class="result' + (m.pauseRound === 'loss' ? ' loss' : '') + '"><h2>Round ' + s.round + ': ' + (m.pauseRound === 'win' ? 'yours' : (m.pauseRound === 'loss' ? 'theirs' : 'draw')) + '</h2>' +
      '<p>You ' + s.you + ' · Them ' + s.them + '. First to ' + s.toWin + ' wins. Your buttons refill.</p>' +
      '<button class="btn primary block" data-act="round">Next round</button></div>';
  }

  /* ---------- boards ---------- */
  function boardGrid(m) {
    var g = m.g, fresh = (m.x & ~ui.prevX) | (m.o & ~ui.prevO), live = run.phase === 'match' && m.turn === 'X' && !m.over && !ui.thinking;
    var leg = live && g.gravity ? G.legal(m) : 0;
    var out = '<div class="board5 w' + g.w + (ui.quake ? ' quake' : '') + (g.gravity ? ' grav' : '') + '" role="group" aria-label="' + g.w + ' by ' + g.h + ' board" style="grid-template-columns:repeat(' + g.w + ',1fr)">';
    for (var i = 0; i < g.nc; i++) {
      var b = 1 << i, cls = 'cell', inner = '', st = 'empty';
      if (m.b & b) { cls += ' stone'; inner = STONE; st = 'stone'; }
      else if (m.x & b) { cls += ' x'; inner = gl(m.char); st = 'your mark'; }
      else if (m.o & b) { cls += ' o'; inner = gl(m.opp); st = 'their mark'; }
      if (fresh & b) cls += ' fresh';
      if (m.winMask & b) cls += ' win';
      if (m.hint === i) cls += ' hint';
      if (leg & b) cls += ' legal';
      if (m.lastAI === i && (m.o & b) && !m.over) { cls += ' last'; inner += '<i class="dot"></i>'; }
      var r = Math.floor(i / g.w) + 1, c = i % g.w + 1;
      var lab = g.gravity ? 'Column ' + c + ', row ' + r + ': ' + st : 'Row ' + r + ', column ' + c + ': ' + st;
      out += '<button class="' + cls + '" data-act="cell" data-i="' + i + '" aria-label="' + lab + '">' + inner + '</button>';
    }
    return out + '</div>';
  }
  function boardSuper(m) {
    var S = m.S, live = run.phase === 'match' && m.turn === 'X' && !m.over && !ui.thinking, legal = {};
    if (live) E.superMoves(S).forEach(function (mv) { legal[mv[0] * 9 + mv[1]] = 1; });
    var out = '<div class="board9' + (ui.boardTurn ? ' turn' : '') + '" role="group" aria-label="Super XOX board">';
    for (var b = 0; b < 9; b++) {
      var res = S.res[b], cls = 'sub';
      if (res === 1) cls += ' won wx'; else if (res === 2) cls += ' won wo'; else if (res === 3) cls += ' dead';
      else if (!m.over && (S.next < 0 || S.next === b)) cls += S.next < 0 ? ' free' : ' live';
      out += '<div class="' + cls + '">';
      for (var c = 0; c < 9; c++) {
        var bit = 1 << c, ccls = 'cell', inner = '';
        if (S.bx[b] & bit) { ccls += ' x'; inner = gl(m.char); } else if (S.bo[b] & bit) { ccls += ' o'; inner = gl(m.opp); }
        if (legal[b * 9 + c]) ccls += ' legal';
        if (m.lastAI && m.lastAI.b === b && m.lastAI.c === c && !m.over) { ccls += ' last'; inner += '<i class="dot sm"></i>'; }
        if (m.hint && m.hint[0] === b && m.hint[1] === c) ccls += ' hint';
        out += '<button class="' + ccls + '" data-act="cell9" data-b="' + b + '" data-c="' + c + '" aria-label="Board ' + (b + 1) + ', square ' + (c + 1) + (S.bx[b] & bit ? ': your mark' : (S.bo[b] & bit ? ': boss mark' : '')) + '">' + inner + '</button>';
      }
      if (res === 1) out += '<span class="big">' + gl(m.char) + '</span>'; else if (res === 2) out += '<span class="big">' + gl(m.opp) + '</span>'; else if (res === 3) out += '<span class="big txt">draw</span>';
      out += '</div>';
    }
    return out + '</div>';
  }
  function screenMatch() {
    var m = run.match;
    var bottom = run.phase === 'result' ? resultHtml() : (m.turn === 'pause' ? pauseHtml(m) : trayHtml(m));
    return header(whereText(run)) + strip() + foeBar(m) + chipsHtml(m) + statusHtml(m) + (m.kind === 'grid' ? boardGrid(m) : boardSuper(m)) + bottom;
  }

  /* ---------- shop, reward, end ---------- */
  function relicCard(id, act, label, price) {
    var r = G.RELICS[id], n = r.set ? G.setCount(run, r.set) : 0;
    var btn = price === undefined ? '<span class="btn sm primary" aria-hidden="true">' + label + '</span>'
      : '<button class="btn sm primary" data-act="buy" data-id="' + id + '"' + (run.gold >= price ? '' : ' disabled') + '>' + (price === 0 ? 'Free' : 'Buy · ' + price + ' gold') + '</button>';
    var inner = ic(id) + '<span class="body"><h3>' + r.name + '</h3><p>' + r.desc + '</p></span>' +
      '<span class="foot"><span class="tags">' + (r.set ? setChip(r.set, n + 1) : '') + '<span class="tag-line">' + useTag(id) + '</span></span>' + btn + '</span>';
    return price === undefined ? '<button class="card" data-act="' + act + '" data-id="' + id + '">' + inner + '</button>' : '<div class="card static">' + inner + '</div>';
  }
  function screenShop() {
    var hp = G.healPrice(run), canHeal = run.hearts < run.maxHearts && run.gold >= hp;
    return header('Shop') + '<h2>Shop</h2>' +
      '<p>' + (run.shop.length ? (run.freeBuy ? 'Luck set: your first buy is free.' : 'Set tags show what you would own after buying.') : 'You bought everything on offer.') + '</p>' +
      '<div class="cards">' + run.shop.map(function (id) { return relicCard(id, null, null, G.priceOf(run, id)); }).join('') + '</div>' +
      '<div class="card static plain"><span class="body"><h3>Heal a heart</h3><p>' + (run.hearts >= run.maxHearts ? 'Your hearts are full.' : 'Hearts: ' + run.hearts + ' of ' + run.maxHearts + '.') + '</p></span><span class="foot"><span></span><button class="btn sm" data-act="heal"' + (canHeal ? '' : ' disabled') + '>Heal · ' + hp + ' gold</button></span></div>' +
      (ui.msg ? '<p class="tag-line" aria-live="polite">' + esc(ui.msg) + '</p>' : '') +
      buildPanel() + '<button class="btn primary block" data-act="leave">Leave the shop</button>';
  }
  function screenReward() {
    return header('Boss reward') + '<h2>Pick a relic</h2><p>Free, for beating the boss.</p>' +
      '<div class="cards">' + run.reward.map(function (id) { return relicCard(id, 'reward', 'Take'); }).join('') + '</div>' + buildPanel();
  }
  function screenEnd() {
    var won = run.over === 'won', s = run.stats;
    return '<div class="endhead">' + gl(run.char, 'gl') + '<div><p class="tag-line">' + G.CHARS[run.char].name + '</p><h2>' + (won ? 'Run cleared' : 'Out of hearts') + '</h2></div></div>' +
      '<p>' + (won ? 'You beat all three bosses.' : 'You fell in ' + whereText(run).replace(' · ', ', ').toLowerCase() + '.') + '</p>' +
      (run.result && run.result.unlockNew ? '<div class="result"><div class="unlock">' + gl(run.result.unlock, 'gl') + '<span>New character unlocked: <b>' + G.CHARS[run.result.unlock].name + '</b></span></div></div>' : '') +
      '<div class="result' + (won ? '' : ' loss') + '"><dl class="sum">' +
      '<dt>Matches played</dt><dd>' + s.matches + '</dd><dt>Wins</dt><dd>' + s.wins + '</dd><dt>Draws</dt><dd>' + s.draws + '</dd><dt>Losses</dt><dd>' + s.losses + '</dd><dt>Bosses beaten</dt><dd>' + s.bossWins + ' of 3</dd><dt>Relics</dt><dd>' + run.relics.length + '</dd></dl></div>' +
      '<div class="stack"><button class="btn primary block" data-act="new">Start a new run</button><button class="btn block" data-act="menu">Back to title</button></div>';
  }

  /* ---------- render ---------- */
  function render() {
    var html;
    if (!run) html = screenTitle();
    else switch (run.phase) {
      case 'char': html = screenChar(); break;
      case 'briefing': html = screenBriefing(); break;
      case 'match': case 'result': html = run.match ? screenMatch() : screenTitle(); break;
      case 'shop': html = screenShop(); break;
      case 'reward': html = screenReward(); break;
      case 'end': html = screenEnd(); break;
      default: html = screenTitle();
    }
    app.innerHTML = '<div class="shell">' + html + '</div>';
    var m = run && run.match;
    if (m && m.kind === 'grid') { ui.prevX = m.x; ui.prevO = m.o; } else { ui.prevX = 0; ui.prevO = 0; }
    ui.boardTurn = false; ui.quake = false;
    if (run && run.phase === 'char') bindCarousel();
    var key = run ? run.phase + ':' + run.act + ':' + run.idx : 'title';
    if (key !== ui.screenKey) { ui.screenKey = key; try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } }
    syncTimer();
  }

  /* Speed Round move timer: when it runs out, a random legal move is played for you */
  function syncTimer() {
    var m = run && run.match, on = m && m.timed && run.phase === 'match' && m.turn === 'X' && !m.over && !ui.thinking;
    if (!on) { if (ui.timer) { clearInterval(ui.timer); ui.timer = null; } ui.timerKey = ''; return; }
    var key = m.series.round + ':' + m.xTurns + ':' + m.bonus + ':' + m.x;
    if (key !== ui.timerKey) { ui.timerKey = key; ui.timerStart = Date.now(); }
    if (ui.timer) clearInterval(ui.timer);
    var tick = function () {
      var left = 1 - (Date.now() - ui.timerStart) / (m.timed * 1000), bar = document.getElementById('tbar');
      if (bar) { bar.style.transform = 'scaleX(' + Math.max(0, left) + ')'; bar.parentNode.classList.toggle('low', left < 0.3); }
      if (left <= 0) {
        clearInterval(ui.timer); ui.timer = null;
        var cells = G.legalCells(m);
        if (cells.length && run.match === m && m.turn === 'X') { ui.msg = 'Too slow! A random move was played.'; var note = G.tap(m, cells[Math.floor(Math.random() * cells.length)]); if (note) ui.msg += ' ' + note; afterAction(); }
      }
    };
    tick();
    ui.timer = setInterval(tick, 100);
  }

  /* ---------- flow ---------- */
  function finishRun() {
    if (run.recorded) return;
    run.recorded = true;
    var me = ui.meta, prog = run.over === 'won' ? 12 : (run.act - 1) * 4 + run.idx + 1;
    me.runs++; if (prog > me.farthest) me.farthest = prog; if (run.over === 'won') me.victories++;
    saveMeta(); lsDel(SAVE); ui.saved = null;
  }
  function afterAction() {
    var m = run.match;
    if (m && m.flash) { ui.msg = (ui.msg ? ui.msg + ' ' : '') + m.flash; m.flash = ''; }
    if (m && m.quake) { ui.quake = true; m.quake = 0; }
    if (m && m.rotatedNow) { ui.boardTurn = true; m.rotatedNow = false; }
    if (run.phase === 'match' && m && m.over) {
      var out = G.resolve(run);
      if (out.unlock && ui.meta.unlocked.indexOf(out.unlock) < 0) { ui.meta.unlocked.push(out.unlock); out.unlockNew = true; saveMeta(); }
    }
    if (run.phase === 'end') finishRun(); else save();
    var needAI = run.phase === 'match' && m && !m.over && m.turn === 'O';
    ui.thinking = !!needAI;
    render();
    if (needAI) scheduleAI();
  }
  function scheduleAI() {
    var r = run, m = r.match;
    setTimeout(function () {
      if (run !== r || r.match !== m || !ui.thinking) return;
      var ev = G.ai(m);
      ui.msg = ev.join(' ');
      afterAction();
    }, m.game === 'speed' ? 260 : 380);
  }
  function canAct() { return run && run.phase === 'match' && run.match && run.match.turn === 'X' && !run.match.over && !ui.thinking; }

  function onAct(a, d) {
    var m = run && run.match;
    switch (a) {
      case 'new': run = G.startRun(); ui.msg = ''; ui.thinking = false; ui.charIdx = 0; render(); break;
      case 'continue':
        if (!ui.saved) return;
        run = ui.saved; ui.saved = null; ui.msg = ''; ui.thinking = false;
        if (run.match && run.match.kind === 'grid') { ui.prevX = run.match.x; ui.prevO = run.match.o; }
        afterAction(); break;
      case 'menu': if (run && run.phase !== 'end' && run.phase !== 'char') save(); run = null; ui.thinking = false; ui.msg = ''; ui.saved = loadSaved(); render(); break;
      case 'carprev': setChar(ui.charIdx - 1); break;
      case 'carnext': setChar(ui.charIdx + 1); break;
      case 'cardot': setChar(+d.i); break;
      case 'pickchar':
        var cid = G.CHAR_ORDER[ui.charIdx];
        if (ui.meta.unlocked.indexOf(cid) < 0) return;
        G.pickChar(run, cid); ui.msg = ''; save(); render(); break;
      case 'opp': ui.msg = ''; if (G.startMatch(run, d.id)) afterAction(); break;
      case 'startboss': ui.msg = ''; if (G.startMatch(run)) afterAction(); break;
      case 'cell': if (!canAct() || m.kind !== 'grid') return; ui.msg = G.tap(m, +d.i) || ''; afterAction(); break;
      case 'cell9': if (!canAct() || m.kind !== 'super') return; ui.msg = G.tap(m, +d.b, +d.c) || ''; afterAction(); break;
      case 'round': if (m && m.turn === 'pause') { G.nextRound(m); ui.msg = 'Round ' + m.series.round + '. ' + (m.turn === 'O' ? 'The Referee goes first.' : 'You go first.'); afterAction(); } break;
      case 'relic':
        if (!m || run.phase !== 'match') return;
        var r = G.RELICS[d.id];
        if (r.kind !== 'active') { ui.msg = r.name + ': ' + (r.only === 'grid' && m.kind !== 'grid' ? 'not used in Super XOX.' : r.desc); render(); return; }
        if (!canAct()) return;
        ui.msg = G.use(m, d.id) || ''; afterAction(); break;
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

  lsDel('xoxrogue.run.v1'); lsDel('xoxrogue.run.v2');
  ui.meta = loadMeta();
  ui.saved = loadSaved();
  render();
})();
