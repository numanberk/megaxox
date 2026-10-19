/* XOX Pop interface: drag (or tap) a piece onto the board. Classic and a daily challenge. Needs Game. */
(function () {
  'use strict';
  var G = Game, N = G.N;
  var K = {
    classic: 'xoxpop.classic.v2', daily: 'xoxpop.daily.v2', best: 'xoxpop.best.v2', days: 'xoxpop.days.v1',
    mode: 'xoxpop.mode', sound: 'xoxpop.sound', seen: 'xoxpop.seen.v2'
  };
  var app = document.getElementById('app');
  var st = null, mode = 'classic', best = 0, days = {}, soundOn = true, seen = false, today = '';
  var busy = false, sel = -1, press = null, drag = null, armed = 0, shown = 0, tween = 0;
  var els = {}, cellVal = [], ghosts = [];

  /* ---------- storage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage may be unavailable */ } }
  function lsJson(k) { try { return JSON.parse(lsGet(k)); } catch (e) { return null; } }
  function loadGame(m) {
    var s = lsJson(K[m]);
    var okay = s && s.v === 2 && !s.over && s.board && s.board.length === G.CELLS && s.tray && s.tray.length === 3;
    if (okay && m === 'daily' && s.day !== today) okay = false;
    return okay ? s : freshGame(m);
  }
  function freshGame(m) {
    var s = m === 'daily' ? G.newGame(G.dailySeed(today)) : G.newGame();
    s.mode = m; s.day = m === 'daily' ? today : null;
    s.beat = modeBest(m); s.passed = false; /* the score to chase this game */
    return s;
  }
  function save() { lsSet(K[mode], JSON.stringify(st)); }
  function saveDays() {
    var keys = Object.keys(days).sort();
    while (keys.length > 60) delete days[keys.shift()];
    lsSet(K.days, JSON.stringify(days));
  }
  function modeBest(m) { return m === 'daily' ? days[today] || 0 : best; }

  /* ---------- calendar days for the daily challenge and its streak ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function shiftDay(key, n) { var p = key.split('-'); return dayKey(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function dayLabel(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  /* days in a row with a daily game played; it stays alive until today ends */
  function streak() {
    var playedToday = days[today] !== undefined, k = playedToday ? today : shiftDay(today, -1), n = 0;
    while (days[k] !== undefined) { n++; k = shiftDay(k, -1); }
    return { n: n, today: playedToday };
  }

  /* ---------- sound and touch feedback, all generated so it works offline ---------- */
  var ac = null;
  function audio() {
    if (!soundOn) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    var a = audio(); if (!a) return;
    var t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var sfx = {
    pick: function () { tone(420, 0.05, 'sine', 0.08); },
    place: function () { tone(190, 0.08, 'triangle', 0.22, 0, 120); },
    pop: function (lines, streakN) {
      var base = 520 * Math.pow(2, Math.min(streakN - 1, 7) / 6), steps = [1, 1.26, 1.5, 2, 2.52];
      for (var k = 0; k < Math.min(lines, 5); k++) tone(base * steps[k], 0.2, 'triangle', 0.18, k * 0.07, base * steps[k] * 1.5);
    },
    blast: function () { tone(140, 0.4, 'sine', 0.4, 0, 40); tone(900, 0.25, 'triangle', 0.1, 0.05, 300); },
    wipe: function () { tone(260, 0.6, 'triangle', 0.2, 0, 1300); [523, 659, 784, 1047].forEach(function (f, k) { tone(f, 0.35, 'triangle', 0.14, 0.35 + k * 0.05); }); },
    best: function () { [523, 659, 784, 1047, 1319].forEach(function (f, k) { tone(f, 0.18, 'square', 0.06, k * 0.08); }); },
    over: function () { [392, 330, 262, 196].forEach(function (f, k) { tone(f, 0.22, 'triangle', 0.16, k * 0.14); }); }
  };
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ } }

  /* ---------- drawing ---------- */
  var ICON = {
    sound: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9"/>'
  };
  var FLAME = '<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c-4.4 0-7.5-3-7.5-7.2 0-3.6 2.4-5.6 3.6-9.8 2.6 2.2 3.4 4.4 3.1 6.6 1.4-1 2.1-2.4 2.4-4.1 2.8 2.7 4.4 5 4.4 7.6 0 4-3.3 6.9-6 6.9z"/></svg>';
  function svgIcon(id) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[id] + '</svg>'; }
  function mark(m) {
    return m === G.X ? '<svg class="mk" viewBox="0 0 40 40" aria-hidden="true"><path d="M12 12L28 28M28 12L12 28"/></svg>'
      : '<svg class="mk" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="10"/></svg>';
  }
  function mc(m) { return m === G.X ? 'x' : 'o'; }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function pieceHtml(piece, cls, unit) {
    var sz = G.size(piece);
    return '<div class="' + cls + '" style="grid-template-columns:repeat(' + sz.w + ',' + unit + ');grid-template-rows:repeat(' + sz.h + ',' + unit + ')">' +
      piece.map(function (p) { return '<div class="blk ' + mc(p.m) + '" style="grid-area:' + (p.r + 1) + '/' + (p.c + 1) + '">' + mark(p.m) + '</div>'; }).join('') + '</div>';
  }
  function bump(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function build() {
    app.innerHTML =
      '<main class="shell">' +
        '<div class="top">' +
          '<div class="best"><span id="bestlabel">BEST</span><b id="best">0</b></div>' +
          '<div class="score" id="score" aria-live="polite">0</div>' +
          '<div class="tools">' +
            '<button class="icon-btn" id="sound"></button>' +
            '<button class="icon-btn" id="restart" aria-label="Restart">' + svgIcon('restart') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="chase" id="chase" aria-hidden="true"><i id="chasebar"></i></div>' +
        '<div class="modes" role="tablist">' +
          '<button role="tab" data-mode="classic">Classic</button>' +
          '<button role="tab" data-mode="daily">Daily<span class="streak-chip" id="chip"></span></button>' +
        '</div>' +
        '<div class="status" id="status"></div>' +
        '<div class="board-wrap" id="wrap"><div class="board" id="board" role="grid" aria-label="Board" style="--n:' + N + '"></div><div class="fx" id="fx"></div></div>' +
        '<div class="tray" id="tray">' + [0, 1, 2].map(function (i) { return '<div class="slot" data-i="' + i + '"></div>'; }).join('') + '</div>' +
        '<p class="hint" id="hint">Drag a piece onto the board. Three <b class="x">X</b> or three <b class="o">O</b> in a row or column pop. Four <b>blasts</b>!</p>' +
      '</main>';
    ['best', 'bestlabel', 'score', 'sound', 'restart', 'chase', 'chasebar', 'chip', 'status', 'wrap', 'board', 'fx', 'tray', 'hint'].forEach(function (id) { els[id] = document.getElementById(id); });
    els.slots = els.tray.children;
    els.tabs = app.querySelectorAll('.modes button');
    var html = '';
    for (var i = 0; i < G.CELLS; i++) html += '<div class="cell" data-c="' + i + '"></div>';
    els.board.innerHTML = html;
    els.cells = els.board.children;
    cellVal = new Array(G.CELLS).fill(-1);

    els.tray.addEventListener('pointerdown', trayDown);
    els.tray.addEventListener('pointermove', trayMove);
    els.tray.addEventListener('pointerup', trayUp);
    els.tray.addEventListener('pointercancel', trayCancel);
    els.board.addEventListener('click', boardTap);
    els.sound.addEventListener('click', toggleSound);
    els.restart.addEventListener('click', restartTap);
    for (var t = 0; t < els.tabs.length; t++) els.tabs[t].addEventListener('click', function () { switchMode(this.dataset.mode); });
  }

  function drawCell(i, m, extra) {
    var el = els.cells[i];
    el.className = 'cell' + (m ? ' blk ' + mc(m) : '') + (extra ? ' ' + extra : '');
    if (cellVal[i] !== m) { el.innerHTML = m ? mark(m) : ''; cellVal[i] = m; }
  }
  function renderBoard() { for (var i = 0; i < G.CELLS; i++) drawCell(i, st.board[i]); }
  function renderTray(fresh) {
    for (var i = 0; i < 3; i++) {
      var p = st.tray[i], slot = els.slots[i];
      slot.className = 'slot' + (p && !G.fitsAnywhere(st.board, p) ? ' nofit' : '') + (i === sel ? ' selected' : '') + (fresh && p ? ' fresh' : '');
      slot.innerHTML = p ? pieceHtml(p, 'piece', 'var(--pc)') : '';
      slot.setAttribute('aria-label', p ? 'Piece of ' + p.length : 'Empty');
    }
  }
  function renderStatus() {
    var lv = G.level(st.placed);
    els.status.innerHTML = armed ? 'Tap again to restart'
      : st.streak >= 2 ? '<span class="hot">Streak ×' + st.streak + '</span>'
      : mode === 'daily' ? 'Daily · ' + dayLabel(today) + ' · same pieces for everyone'
      : lv ? 'Level ' + (lv + 1) : '';
  }
  function renderBest() {
    els.bestlabel.textContent = mode === 'daily' ? 'TODAY' : 'BEST';
    els.best.textContent = fmt(Math.max(modeBest(mode), st.score));
    var pct = st.beat > 0 ? Math.min(1, st.score / st.beat) : 0;
    els.chase.className = 'chase' + (st.beat > 0 ? '' : ' off') + (st.passed ? ' won' : '');
    els.chasebar.style.transform = 'scaleX(' + (st.passed ? 1 : pct) + ')';
  }
  function renderModes() {
    for (var t = 0; t < els.tabs.length; t++) els.tabs[t].setAttribute('aria-selected', els.tabs[t].dataset.mode === mode ? 'true' : 'false');
    var s = streak();
    els.chip.className = 'streak-chip' + (s.n ? '' : ' none') + (s.today ? '' : ' cold');
    els.chip.innerHTML = s.n ? FLAME + s.n : '';
    els.chip.parentNode.setAttribute('aria-label', 'Daily' + (s.n ? ', ' + s.n + ' day streak' : ''));
  }
  function renderScore(animate) {
    cancelAnimationFrame(tween);
    var target = st.score;
    if (!animate) { shown = target; els.score.textContent = fmt(target); return; }
    var from = shown, t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / 450);
      shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      els.score.textContent = fmt(shown);
      if (k < 1) tween = requestAnimationFrame(step);
    })(t0);
  }
  function renderSound() {
    els.sound.innerHTML = svgIcon(soundOn ? 'sound' : 'mute');
    els.sound.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
  }
  function renderAll() { renderBoard(); renderTray(true); renderStatus(); renderBest(); renderModes(); renderScore(false); renderSound(); els.hint.hidden = seen; }

  /* ---------- geometry ---------- */
  function geo() {
    var a = els.cells[0].getBoundingClientRect(), b = els.cells[1].getBoundingClientRect();
    return { left: a.left, top: a.top, size: a.width, pitch: b.left - a.left };
  }
  function cellCenter(i) {
    var r = els.cells[i].getBoundingClientRect(), w = els.wrap.getBoundingClientRect();
    return { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height / 2 };
  }
  function centroid(list) {
    var x = 0, y = 0;
    list.forEach(function (k) { var p = cellCenter(k); x += p.x; y += p.y; });
    return { x: x / list.length, y: y / list.length };
  }

  /* ---------- ghost preview: where it lands, what pops, what blasts ---------- */
  function clearGhost() {
    ghosts.forEach(function (i) { drawCell(i, st.board[i]); });
    ghosts = [];
    els.board.classList.remove('will-wipe');
  }
  function showGhost(i, r, c) {
    clearGhost();
    var piece = st.tray[i], res = G.preview(st, i, r, c);
    if (!res) return;
    piece.forEach(function (p) { var k = (r + p.r) * N + c + p.c; drawCell(k, p.m, 'ghost'); ghosts.push(k); });
    function mark2(list, cls) { list.forEach(function (k) { els.cells[k].classList.add(cls); if (ghosts.indexOf(k) < 0) ghosts.push(k); }); }
    mark2(res.popped, 'will-pop');
    mark2(res.blasted, 'will-blast');
    if (res.wipe) els.board.classList.add('will-wipe');
  }

  /* ---------- tray input: drag, or tap to select then tap the board ---------- */
  function trayDown(e) {
    if (busy || st.over || drag) return;
    var slot = e.target.closest('.slot'); if (!slot) return;
    var i = +slot.dataset.i; if (!st.tray[i]) return;
    press = { i: i, x: e.clientX, y: e.clientY, id: e.pointerId };
    try { els.tray.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    audio();
  }
  function trayMove(e) {
    if (!press || e.pointerId !== press.id) return;
    if (!drag) {
      if (Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) < 8) return;
      startDrag(press.i);
    }
    moveDrag(e.clientX, e.clientY);
  }
  function trayUp(e) {
    if (!press || e.pointerId !== press.id) return;
    var i = press.i; press = null;
    if (drag) { endDrag(); return; }
    sel = sel === i ? -1 : i; sfx.pick(); renderTray(false);
  }
  function trayCancel() { press = null; if (drag) { drag.target = null; endDrag(); } }

  function startDrag(i) {
    sel = -1; renderTray(false);
    var g = geo(), piece = st.tray[i], sz = G.size(piece);
    var el = document.createElement('div');
    el.innerHTML = pieceHtml(piece, 'float', 'var(--cell)');
    el = el.firstChild;
    document.body.appendChild(el);
    drag = { i: i, el: el, g: g, w: sz.w * g.pitch - (g.pitch - g.size), h: sz.h * g.pitch - (g.pitch - g.size), target: null };
    els.slots[i].classList.add('dragging');
    sfx.pick(); buzz(5);
  }
  function moveDrag(x, y) {
    var d = drag, g = d.g;
    var fx = x - d.w / 2, fy = y - d.h - g.size * 0.75; /* lift the piece above the finger */
    d.el.style.transform = 'translate(' + fx + 'px,' + fy + 'px)';
    var r = Math.round((fy - g.top) / g.pitch), c = Math.round((fx - g.left) / g.pitch);
    var ok = G.fits(st.board, st.tray[d.i], r, c);
    var key = ok ? r + ',' + c : null;
    if (key === (d.target && d.target.key)) return;
    d.target = ok ? { r: r, c: c, key: key } : null;
    if (ok) showGhost(d.i, r, c); else clearGhost();
  }
  function endDrag() {
    var d = drag; drag = null;
    clearGhost();
    if (d.target) { d.el.remove(); place(d.i, d.target.r, d.target.c); return; }
    /* fly back to the tray */
    var s = els.slots[d.i].getBoundingClientRect();
    d.el.classList.add('back');
    d.el.style.transform = 'translate(' + (s.left + s.width / 2 - d.w / 2) + 'px,' + (s.top + s.height / 2 - d.h / 2) + 'px) scale(.62)';
    setTimeout(function () { d.el.remove(); els.slots[d.i].classList.remove('dragging'); }, 190);
  }

  /* tapping the board with a piece selected: put it where it fits, centred on the tap if it can */
  function boardTap(e) {
    if (sel < 0 || busy || st.over) return;
    var cell = e.target.closest('.cell'); if (!cell) return;
    var k = +cell.dataset.c, tr = Math.floor(k / N), tc = k % N, piece = st.tray[sel], sz = G.size(piece);
    var tries = [[tr - Math.floor((sz.h - 1) / 2), tc - Math.floor((sz.w - 1) / 2)]];
    piece.forEach(function (p) { tries.push([tr - p.r, tc - p.c]); });
    for (var t = 0; t < tries.length; t++) {
      if (G.fits(st.board, piece, tries[t][0], tries[t][1])) { var i = sel; sel = -1; place(i, tries[t][0], tries[t][1]); return; }
    }
    buzz(15);
  }

  /* ---------- placing, popping, blasting ---------- */
  function place(i, r, c) {
    var piece = st.tray[i], before = st.board.slice();
    piece.forEach(function (p) { before[(r + p.r) * N + c + p.c] = p.m; });
    var res = G.place(st, i, r, c);
    if (!res) return;
    disarm();
    res.placed.forEach(function (k) { drawCell(k, before[k], 'land'); });
    sfx.place(); buzz(8);
    if (res.lines) {
      busy = true;
      var wait = effects(res, before);
      setTimeout(function () {
        busy = false;
        res.blasted.forEach(function (k) { els.cells[k].style.removeProperty('--d'); });
        renderBoard();
      }, wait);
      if (!seen) { seen = true; lsSet(K.seen, '1'); els.hint.hidden = true; }
    }
    /* records: classic best, today's daily best (playing the daily at all keeps the streak) */
    if (mode === 'classic' && st.score > best) { best = st.score; lsSet(K.best, String(best)); }
    if (mode === 'daily' && (days[today] === undefined || st.score > days[today])) { days[today] = st.score; saveDays(); renderModes(); }
    if (!st.passed && st.beat > 0 && st.score > st.beat) { st.passed = true; setTimeout(newBest, res.lines ? 450 : 0); }
    renderTray(res.refilled);
    renderStatus(); renderBest(); renderScore(true);
    if (res.gained >= 100) bump(els.score, 'bump');
    save();
    if (res.over) setTimeout(gameOver, res.lines ? 1000 : 500);
  }

  function spark(p, color, n, spread) {
    for (var j = 0; j < n; j++) {
      var s = document.createElement('i'), a = Math.random() * Math.PI * 2, dist = spread * (0.5 + Math.random());
      s.className = 'spark';
      s.style.cssText = 'left:' + p.x + 'px;top:' + p.y + 'px;background:' + color + ';--dx:' + Math.cos(a) * dist + 'px;--dy:' + Math.sin(a) * dist + 'px';
      els.fx.appendChild(s);
      setTimeout(s.remove.bind(s), 700);
    }
  }
  function float(cls, text, x, y) {
    var el = document.createElement('div');
    el.className = cls; el.textContent = text;
    if (x !== undefined) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
    els.fx.appendChild(el); setTimeout(el.remove.bind(el), 1300);
  }
  /* returns how long the board animation runs */
  function effects(res, before) {
    var center = centroid(res.popped), maxDelay = 0;
    res.popped.forEach(function (k) { drawCell(k, before[k], 'pop'); spark(cellCenter(k), 'var(--' + mc(before[k]) + ')', 5, 45); });
    res.blasted.forEach(function (k) {
      var p = cellCenter(k), delay = Math.round(Math.min(320, Math.hypot(p.x - center.x, p.y - center.y) * 1.1));
      maxDelay = Math.max(maxDelay, delay);
      drawCell(k, before[k], 'blast');
      els.cells[k].style.setProperty('--d', delay + 'ms');
      setTimeout(function () { spark(p, 'var(--' + mc(before[k]) + ')', 3, 35); }, delay);
    });
    float('gain', '+' + fmt(res.gained), center.x, center.y);
    var word = res.wipe ? 'BOARD WIPE!' : res.blasts >= 2 ? 'MEGA BLAST!' : res.blasts ? 'BLAST!' : res.clean ? 'CLEAN!' :
      res.lines >= 3 ? 'Triple!' : res.lines === 2 ? 'Double!' : res.streak >= 3 ? 'On fire!' : res.streak === 2 ? 'Nice!' : '';
    if (word) float('banner' + (res.wipe || res.blasts ? ' big' : ''), word);
    if (res.clean && (res.wipe || res.blasts)) setTimeout(function () { float('banner small', 'Clean board +' + fmt(G.cfg.cleanBonus * Math.min(res.streak, G.cfg.streakCap))); }, 500);
    if (res.wipe) {
      var fl = document.createElement('div'); fl.className = 'flash'; els.fx.appendChild(fl); setTimeout(fl.remove.bind(fl), 700);
      sfx.wipe(); buzz([40, 40, 40, 40, 90]);
    } else if (res.blasts) { sfx.blast(); sfx.pop(res.lines, res.streak); buzz([30, 30, 60]); }
    else { sfx.pop(res.lines, res.streak); buzz(res.lines >= 2 ? [20, 40, 30] : 20); }
    if (res.blasts || res.wipe) bump(els.board, 'quake'); else if (res.lines >= 2) bump(els.board, 'shake');
    return 360 + maxDelay;
  }

  function newBest() {
    float('banner best', 'NEW BEST!');
    var w = els.wrap.getBoundingClientRect();
    for (var j = 0; j < 4; j++) spark({ x: w.width * (0.2 + 0.2 * j), y: w.height * 0.45 }, 'var(--gold)', 8, 70);
    bump(els.score, 'bump');
    sfx.best(); buzz([20, 30, 20, 30, 40]);
  }

  function gameOver() {
    sfx.over(); buzz([30, 60, 30]);
    var old = st.beat, isBest = st.passed || (old === 0 && st.score > 0), s = streak(), line;
    if (isBest) line = '<span class="newbest">NEW BEST</span>' + (old > 0 ? '<p>' + fmt(st.score - old) + ' more than your old best</p>' : '');
    else if (old > 0 && old - st.score <= old * 0.25) line = '<p class="close">So close! Only <b>' + fmt(old - st.score) + '</b> short of your best.</p>';
    else line = '<p>Best ' + fmt(old) + '</p>';
    var extras = [st.placed + ' pieces', st.pops + ' pops'];
    if (st.blasts) extras.push(st.blasts + (st.blasts === 1 ? ' blast' : ' blasts'));
    if (st.wipes) extras.push(st.wipes + (st.wipes === 1 ? ' wipe' : ' wipes'));
    var daily = '';
    if (mode === 'daily') {
      var dots = '';
      for (var d = 6; d >= 0; d--) {
        var k = shiftDay(today, -d), p = k.split('-');
        dots += '<span class="day' + (days[k] !== undefined ? ' on' : '') + (d === 0 ? ' now' : '') + '"><i></i>' +
          new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { weekday: 'narrow' }) + '</span>';
      }
      daily = '<div class="week">' + dots + '</div><p class="streak-line">' + FLAME + s.n + (s.n === 1 ? ' day' : ' days') + ' in a row · come back tomorrow for new pieces</p>';
    }
    var ov = document.createElement('div');
    ov.className = 'over';
    ov.innerHTML = '<div class="over-card" role="dialog" aria-label="Game over">' +
      '<h2>' + (mode === 'daily' ? 'Daily · ' + dayLabel(today) : 'No more room') + '</h2>' +
      '<div class="big">' + fmt(st.score) + '</div>' + line + daily +
      '<p class="extras">' + extras.join(' · ') + '</p>' +
      '<button class="play" id="again">' + (mode === 'daily' ? 'Try again' : 'Play again') + '</button>' +
      (mode === 'classic' && days[today] === undefined ? '<button class="alt" id="other">' + FLAME + 'Play today\'s daily</button>'
        : mode === 'daily' ? '<button class="alt" id="other">Play classic</button>' : '') +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('again').addEventListener('click', function () { ov.remove(); newGame(); });
    var other = document.getElementById('other');
    if (other) other.addEventListener('click', function () { ov.remove(); switchMode(mode === 'daily' ? 'classic' : 'daily', true); });
  }

  function newGame() { disarm(); st = freshGame(mode); sel = -1; save(); renderAll(); }
  function switchMode(m, fresh) {
    if (m === mode && !fresh) return;
    if (busy || drag) return;
    disarm(); save();
    mode = m; lsSet(K.mode, m);
    today = dayKey();
    st = fresh ? freshGame(m) : loadGame(m); sel = -1; save();
    renderAll();
  }
  /* restart needs two taps so a stray thumb does not wipe a good game */
  function disarm() { if (armed) { clearTimeout(armed); armed = 0; els.restart.classList.remove('armed'); } }
  function restartTap() {
    if (st.placed === 0 || st.over) { newGame(); return; }
    if (armed) { newGame(); return; }
    armed = setTimeout(function () { disarm(); renderStatus(); }, 2500);
    els.restart.classList.add('armed'); renderStatus();
  }
  function toggleSound() {
    soundOn = !soundOn; lsSet(K.sound, soundOn ? '1' : '0'); renderSound();
    if (soundOn) sfx.pick();
  }
  /* a new day while the app sat in the background: fresh daily pieces */
  function checkDay() {
    if (dayKey() === today) return;
    today = dayKey();
    if (mode === 'daily' && !busy && !drag && !document.querySelector('.over')) { st = freshGame('daily'); save(); renderAll(); } else renderModes();
  }

  /* ---------- start ---------- */
  today = dayKey();
  best = +lsGet(K.best) || 0;
  days = lsJson(K.days) || {};
  soundOn = lsGet(K.sound) !== '0';
  seen = lsGet(K.seen) === '1';
  mode = lsGet(K.mode) === 'daily' ? 'daily' : 'classic';
  st = loadGame(mode); save();
  build();
  renderAll();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkDay(); });
  /* offline after the first visit when served over http(s) */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* not available here */ }); });
  }
})();
