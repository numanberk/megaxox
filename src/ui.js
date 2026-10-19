/* XOX Pop interface: drag (or tap) a piece onto the board. Needs Game. */
(function () {
  'use strict';
  var G = Game, N = G.N;
  var KEY = 'xoxpop.game.v1', BEST = 'xoxpop.best', SOUND = 'xoxpop.sound', SEEN = 'xoxpop.seen';
  var app = document.getElementById('app');
  var st = null, best = 0, soundOn = true, seen = false;
  var busy = false, sel = -1, press = null, drag = null, armed = 0, shown = 0, tween = 0;
  var els = {}, cellVal = [], ghosts = [];

  /* ---------- storage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage may be unavailable */ } }
  function loadGame() {
    try {
      var s = JSON.parse(lsGet(KEY));
      if (s && s.v === 1 && !s.over && s.board && s.board.length === G.CELLS && s.tray && s.tray.length === 3) return s;
    } catch (e) { /* start fresh */ }
    return G.newGame();
  }
  function save() { lsSet(KEY, JSON.stringify(st)); }

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
    pop: function (lines, streak) {
      var base = 520 * Math.pow(2, Math.min(streak - 1, 7) / 6), steps = [1, 1.26, 1.5, 2, 2.52];
      for (var k = 0; k < Math.min(lines, 5); k++) tone(base * steps[k], 0.2, 'triangle', 0.18, k * 0.07, base * steps[k] * 1.5);
    },
    over: function () { [392, 330, 262, 196].forEach(function (f, k) { tone(f, 0.22, 'triangle', 0.16, k * 0.14); }); }
  };
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ } }

  /* ---------- drawing ---------- */
  var ICON = {
    sound: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9"/>'
  };
  function svgIcon(id) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[id] + '</svg>'; }
  function mark(m) {
    return m === G.X ? '<svg class="mk x" viewBox="0 0 40 40" aria-hidden="true"><path d="M11 11L29 29M29 11L11 29"/></svg>'
      : '<svg class="mk o" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="11"/></svg>';
  }
  function mc(m) { return m === G.X ? 'x' : 'o'; }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function pieceHtml(piece, cls, unit) {
    var sz = G.size(piece);
    return '<div class="' + cls + '" style="grid-template-columns:repeat(' + sz.w + ',' + unit + ');grid-template-rows:repeat(' + sz.h + ',' + unit + ')">' +
      piece.map(function (p) { return '<div class="pcell ' + mc(p.m) + '" style="grid-area:' + (p.r + 1) + '/' + (p.c + 1) + '">' + mark(p.m) + '</div>'; }).join('') + '</div>';
  }

  function build() {
    app.innerHTML =
      '<main class="shell">' +
        '<div class="top">' +
          '<div class="best">BEST<b id="best">0</b></div>' +
          '<div class="score" id="score" aria-live="polite">0</div>' +
          '<div class="tools">' +
            '<button class="icon-btn" id="sound"></button>' +
            '<button class="icon-btn" id="restart" aria-label="Restart">' + svgIcon('restart') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="status" id="status"></div>' +
        '<div class="board-wrap" id="wrap"><div class="board" id="board" role="grid" aria-label="Board"></div><div class="fx" id="fx"></div></div>' +
        '<div class="tray" id="tray">' + [0, 1, 2].map(function (i) { return '<div class="slot" data-i="' + i + '"></div>'; }).join('') + '</div>' +
        '<p class="hint" id="hint">Drag a piece onto the board. Three <b class="x">X</b> or three <b class="o">O</b> in a line pop.</p>' +
      '</main>';
    ['best', 'score', 'sound', 'restart', 'status', 'wrap', 'board', 'fx', 'tray', 'hint'].forEach(function (id) { els[id] = document.getElementById(id); });
    els.slots = els.tray.children;
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
  }

  function drawCell(i, m, extra) {
    var el = els.cells[i];
    el.className = 'cell' + (m ? ' ' + mc(m) : '') + (extra ? ' ' + extra : '');
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
      : st.streak >= 2 ? '<span class="streak">Streak ×' + st.streak + '</span>'
      : lv ? 'Level ' + (lv + 1) : '';
  }
  function renderBest() { els.best.textContent = fmt(Math.max(best, st.score)); }
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
  function renderAll() { renderBoard(); renderTray(true); renderStatus(); renderBest(); renderScore(false); renderSound(); els.hint.hidden = seen; }

  /* ---------- geometry ---------- */
  function geo() {
    var a = els.cells[0].getBoundingClientRect(), b = els.cells[1].getBoundingClientRect();
    return { left: a.left, top: a.top, size: a.width, pitch: b.left - a.left };
  }
  function cellCenter(i) {
    var r = els.cells[i].getBoundingClientRect(), w = els.wrap.getBoundingClientRect();
    return { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height / 2 };
  }

  /* ---------- ghost preview ---------- */
  function clearGhost() {
    ghosts.forEach(function (i) { drawCell(i, st.board[i]); });
    ghosts = [];
  }
  function showGhost(i, r, c) {
    clearGhost();
    var piece = st.tray[i], pops = G.preview(st, i, r, c);
    if (!pops) return;
    piece.forEach(function (p) { var k = (r + p.r) * N + c + p.c; drawCell(k, p.m, 'ghost-' + mc(p.m)); ghosts.push(k); });
    pops.forEach(function (k) { els.cells[k].classList.add('will-pop'); if (ghosts.indexOf(k) < 0) ghosts.push(k); });
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

  /* ---------- placing and popping ---------- */
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
      res.cleared.forEach(function (k) { drawCell(k, before[k], 'pop'); });
      setTimeout(function () { busy = false; renderBoard(); }, 340);
      effects(res, before);
      if (!seen) { seen = true; lsSet(SEEN, '1'); els.hint.hidden = true; }
    }
    renderTray(res.refilled);
    renderStatus(); renderBest(); renderScore(true);
    if (res.gained >= 100) { els.score.classList.remove('bump'); void els.score.offsetWidth; els.score.classList.add('bump'); }
    if (st.score > best) { best = st.score; lsSet(BEST, String(best)); }
    save();
    if (res.over) setTimeout(gameOver, res.lines ? 800 : 500);
  }

  function effects(res, before) {
    var fx = els.fx, sx = 0, sy = 0;
    res.cleared.forEach(function (k) {
      var p = cellCenter(k); sx += p.x; sy += p.y;
      for (var n = 0; n < 5; n++) {
        var s = document.createElement('i'), a = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 40;
        s.className = 'spark';
        s.style.cssText = 'left:' + p.x + 'px;top:' + p.y + 'px;background:var(--' + mc(before[k]) + ');--dx:' + Math.cos(a) * dist + 'px;--dy:' + Math.sin(a) * dist + 'px';
        fx.appendChild(s);
        setTimeout(s.remove.bind(s), 600);
      }
    });
    var gain = document.createElement('div');
    gain.className = 'gain';
    gain.textContent = '+' + fmt(res.gained);
    gain.style.left = sx / res.cleared.length + 'px'; gain.style.top = sy / res.cleared.length + 'px';
    fx.appendChild(gain); setTimeout(gain.remove.bind(gain), 950);
    var word = res.lines >= 4 ? 'Mega!' : res.lines === 3 ? 'Triple!' : res.lines === 2 ? 'Double!' : res.streak >= 3 ? 'On fire!' : res.streak === 2 ? 'Nice!' : '';
    if (word) {
      var b = document.createElement('div');
      b.className = 'banner'; b.textContent = word;
      fx.appendChild(b); setTimeout(b.remove.bind(b), 950);
    }
    if (res.lines >= 2) { els.board.classList.remove('shake'); void els.board.offsetWidth; els.board.classList.add('shake'); }
    sfx.pop(res.lines, res.streak);
    buzz(res.lines >= 2 ? [20, 40, 30] : 20);
  }

  function gameOver() {
    sfx.over(); buzz([30, 60, 30]);
    var isBest = st.score > 0 && st.score >= best;
    var ov = document.createElement('div');
    ov.className = 'over';
    ov.innerHTML = '<div class="over-card" role="dialog" aria-label="Game over">' +
      '<h2>No more room</h2>' +
      '<div class="big">' + fmt(st.score) + '</div>' +
      (isBest ? '<span class="newbest">NEW BEST</span>' : '<p>Best ' + fmt(best) + '</p>') +
      '<p>' + st.placed + ' pieces · ' + st.pops + ' pops</p>' +
      '<button class="play" id="again">Play again</button></div>';
    document.body.appendChild(ov);
    var btn = document.getElementById('again');
    btn.addEventListener('click', function () { ov.remove(); newGame(); });
  }

  function newGame() {
    disarm(); st = G.newGame(); sel = -1; save(); renderAll();
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
    soundOn = !soundOn; lsSet(SOUND, soundOn ? '1' : '0'); renderSound();
    if (soundOn) sfx.pick();
  }

  /* ---------- start ---------- */
  best = +lsGet(BEST) || 0;
  soundOn = lsGet(SOUND) !== '0';
  seen = lsGet(SEEN) === '1';
  st = loadGame(); save();
  build();
  renderAll();
  /* offline after the first visit when served over http(s) */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* not available here */ }); });
  }
})();
