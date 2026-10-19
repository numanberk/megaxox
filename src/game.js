/* XOX Pop rules: drop X and O pieces on a 7x7 board, three of a kind in a row or column pops. No DOM. */
var Game = (function () {
  'use strict';

  var N = 7, CELLS = N * N, EMPTY = 0, X = 1, O = 2;
  /* tuned with test/sim.js: a random tapper lasts ~30 pieces, a casual player ~100, a careful one ~240.
     mixed: share of multi-square pieces that alternate X and O. big: 4-square shapes, more of them each level.
     fairAll: tries to deal a tray where every piece fits. blastLen: run length that blasts. wipeLen: a cross needs
     one line this long to wipe the board. */
  var cfg = {
    mixedBase: 0.9, mixedStep: 0, mixedMax: 0.9, singleWeight: 2.5, bigStep: 0.5, levelEvery: 15, maxLevel: 8,
    diagonals: false, fairAll: 10, fairTries: 30, blastLen: 4, blastReach: 1, wipe: 'cross', wipeLen: 4, streakCap: 5, cleanBonus: 300
  };

  /* seedable rng so tests and the simulator can replay a game */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* shapes as [row, col] offsets; weight = how often it shows up, big ones grow with the level */
  var SHAPES = [
    { cells: [[0, 0]], weight: 3 },
    { cells: [[0, 0], [0, 1]], weight: 4 },
    { cells: [[0, 0], [1, 0]], weight: 4 },
    { cells: [[0, 0], [0, 1], [0, 2]], weight: 2 },
    { cells: [[0, 0], [1, 0], [2, 0]], weight: 2 },
    { cells: [[0, 0], [1, 0], [1, 1]], weight: 1 },
    { cells: [[0, 0], [0, 1], [1, 0]], weight: 1 },
    { cells: [[0, 0], [0, 1], [1, 1]], weight: 1 },
    { cells: [[0, 1], [1, 0], [1, 1]], weight: 1 },
    { cells: [[0, 0], [0, 1], [1, 0], [1, 1]], weight: 0, big: 1 },
    { cells: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 0, big: 1 },
    { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], weight: 0, big: 1 },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 1]], weight: 0, big: 1 },
    { cells: [[0, 0], [1, 0], [2, 0], [2, 1]], weight: 0, big: 1 },
    { cells: [[0, 1], [0, 2], [1, 0], [1, 1]], weight: 0, big: 1 }
  ];
  function level(placed) { return Math.min(cfg.maxLevel, Math.floor(placed / cfg.levelEvery)); }

  /* a piece is a list of {r, c, m}; a single-mark piece gets one mark, a mixed one alternates */
  function randomPiece(rand, lv) {
    lv = lv || 0;
    var w = SHAPES.map(function (s, k) { return (k === 0 ? cfg.singleWeight : s.weight) + (s.big ? s.big * cfg.bigStep * lv / 2 : 0); });
    var roll = rand() * w.reduce(function (a, b) { return a + b; }, 0), shape = SHAPES[0];
    for (var i = 0; i < SHAPES.length; i++) { roll -= w[i]; if (roll < 0) { shape = SHAPES[i]; break; } }
    var first = rand() < 0.5 ? X : O;
    var mixed = shape.cells.length > 1 && rand() < Math.min(cfg.mixedMax, cfg.mixedBase + cfg.mixedStep * lv);
    return shape.cells.map(function (rc, k) { return { r: rc[0], c: rc[1], m: mixed && k % 2 ? 3 - first : first }; });
  }

  function size(piece) {
    var h = 0, w = 0;
    piece.forEach(function (p) { h = Math.max(h, p.r + 1); w = Math.max(w, p.c + 1); });
    return { h: h, w: w };
  }

  function fits(board, piece, r, c) {
    for (var i = 0; i < piece.length; i++) {
      var rr = r + piece[i].r, cc = c + piece[i].c;
      if (rr < 0 || rr >= N || cc < 0 || cc >= N || board[rr * N + cc] !== EMPTY) return false;
    }
    return true;
  }
  function fitsAnywhere(board, piece) {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (fits(board, piece, r, c)) return true;
    return false;
  }

  /* every run of 3+ equal marks in a row, column or diagonal. d: 0 across, 1 down, 2 and 3 diagonal */
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  function findRuns(board) {
    var runs = [], hit = {};
    for (var d = 0; d < (cfg.diagonals ? 4 : 2); d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var m = board[r * N + c];
        if (m === EMPTY) continue;
        var pr = r - dr, pc = c - dc;
        if (pr >= 0 && pr < N && pc >= 0 && pc < N && board[pr * N + pc] === m) continue; /* not the start of a run */
        var cells = [], rr = r, cc = c;
        while (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr * N + cc] === m) { cells.push(rr * N + cc); rr += dr; cc += dc; }
        if (cells.length >= 3) { runs.push({ d: d, cells: cells }); cells.forEach(function (k) { hit[k] = 1; }); }
      }
    }
    return { runs: runs, cells: Object.keys(hit).map(Number), lines: runs.length };
  }

  /* what a board with fresh runs turns into:
     popped  the runs themselves
     blasted extra squares: a run of 4+ across blasts its row and the rows next to it, down blasts columns,
             a diagonal blasts every square touching it
     wipe    a run across and a run down from the same piece clear the whole board
             (cfg.wipe 'cross': only when the two lines share a square, 'any': whenever both happen) */
  function resolve(board) {
    var found = findRuns(board), popped = found.cells, blast = {}, blasts = 0, across = {}, down = {};
    found.runs.forEach(function (run) {
      if (run.d === 0) run.cells.forEach(function (k) { across[k] = 1; });
      if (run.d === 1) run.cells.forEach(function (k) { down[k] = 1; });
      if (run.cells.length < cfg.blastLen) return;
      blasts++;
      var r0 = Math.floor(run.cells[0] / N), c0 = run.cells[0] % N, k, j;
      if (run.d === 0) { for (k = r0 - cfg.blastReach; k <= r0 + cfg.blastReach; k++) if (k >= 0 && k < N) for (j = 0; j < N; j++) blast[k * N + j] = 1; }
      else if (run.d === 1) { for (k = c0 - cfg.blastReach; k <= c0 + cfg.blastReach; k++) if (k >= 0 && k < N) for (j = 0; j < N; j++) blast[j * N + k] = 1; }
      else run.cells.forEach(function (cell) { around(cell).forEach(function (n) { blast[n] = 1; }); });
    });
    var a = Object.keys(across), dn = Object.keys(down);
    var wipe = (cfg.wipe === 'any' ? a.length > 0 && dn.length > 0 : cfg.wipe === 'cross' && a.some(function (k) { return down[k]; })) &&
      (a.length >= cfg.wipeLen || dn.length >= cfg.wipeLen);
    if (wipe) for (var i = 0; i < CELLS; i++) blast[i] = 1;
    popped.forEach(function (k) { delete blast[k]; });
    var blasted = Object.keys(blast).map(Number).filter(function (k) { return board[k] !== EMPTY; });
    return { popped: popped, blasted: blasted, lines: found.lines, blasts: blasts, wipe: wipe };
  }
  function around(k) {
    var r = Math.floor(k / N), c = k % N, out = [];
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      var rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
    }
    return out;
  }

  /* new tray of three. Mercy: try for a tray where every piece fits (cfg.fairAll tries), then for one where at least one fits */
  function newTray(board, rand, lv) {
    var tray, t, fit = function (p) { return fitsAnywhere(board, p); };
    for (t = 0; t < cfg.fairAll; t++) {
      tray = [randomPiece(rand, lv), randomPiece(rand, lv), randomPiece(rand, lv)];
      if (tray.every(fit)) return tray;
    }
    for (t = 0; t < cfg.fairTries; t++) {
      tray = [randomPiece(rand, lv), randomPiece(rand, lv), randomPiece(rand, lv)];
      if (tray.some(fit)) return tray;
    }
    tray[0] = [{ r: 0, c: 0, m: rand() < 0.5 ? X : O }];
    return tray;
  }

  function newGame(seed) {
    var s = seed === undefined ? (Math.random() * 4294967296) >>> 0 : seed >>> 0;
    var st = { v: 2, board: new Array(CELLS).fill(EMPTY), tray: [], score: 0, streak: 0, placed: 0, pops: 0, blasts: 0, wipes: 0, over: false, seed: s, draws: 0 };
    st.tray = newTray(st.board, trayRand(st), 0);
    return st;
  }
  /* each tray draw gets its own seed so a saved game resumes on the same sequence */
  function trayRand(st) { return rng(st.seed + 0x9E3779B9 * ++st.draws); }

  function canPlay(st) {
    return st.tray.some(function (p) { return p && fitsAnywhere(st.board, p); });
  }

  /* places tray[i] with its top-left at (r, c). Returns null if it does not fit, else what happened. */
  function place(st, i, r, c) {
    var piece = st.tray[i];
    if (st.over || !piece || !fits(st.board, piece, r, c)) return null;
    var placedAt = piece.map(function (p) { var k = (r + p.r) * N + c + p.c; st.board[k] = p.m; return k; });
    var res = resolve(st.board), cleared = res.popped.concat(res.blasted), gained = piece.length, clean = false;
    if (res.lines) {
      st.streak++;
      var mult = res.lines * Math.min(st.streak, cfg.streakCap);
      gained += cleared.length * 10 * mult;
      cleared.forEach(function (k) { st.board[k] = EMPTY; });
      clean = st.board.every(function (v) { return v === EMPTY; });
      if (clean) gained += cfg.cleanBonus * Math.min(st.streak, cfg.streakCap);
      st.pops += res.lines; st.blasts += res.blasts; if (res.wipe) st.wipes++;
    } else st.streak = 0;
    st.score += gained;
    st.placed++;
    st.tray[i] = null;
    var refilled = false;
    if (st.tray.every(function (p) { return !p; })) { st.tray = newTray(st.board, trayRand(st), level(st.placed)); refilled = true; }
    st.over = !canPlay(st);
    return {
      placed: placedAt, popped: res.popped, blasted: res.blasted, cleared: cleared, lines: res.lines, blasts: res.blasts,
      wipe: res.wipe, clean: clean, streak: st.streak, gained: gained, refilled: refilled, over: st.over
    };
  }

  /* what would happen if tray[i] went at (r, c), for the drag preview: {popped, blasted, wipe} or null */
  function preview(st, i, r, c) {
    var piece = st.tray[i];
    if (!piece || !fits(st.board, piece, r, c)) return null;
    var b = st.board.slice();
    piece.forEach(function (p) { b[(r + p.r) * N + c + p.c] = p.m; });
    return resolve(b);
  }

  /* the daily challenge: the same seed for everyone on the same calendar day */
  function dailySeed(day) {
    var h = 2166136261;
    for (var i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  return {
    N: N, CELLS: CELLS, EMPTY: EMPTY, X: X, O: O, cfg: cfg, SHAPES: SHAPES, level: level,
    rng: rng, randomPiece: randomPiece, size: size, fits: fits, fitsAnywhere: fitsAnywhere, findRuns: findRuns, resolve: resolve,
    newTray: newTray, newGame: newGame, canPlay: canPlay, place: place, preview: preview, dailySeed: dailySeed
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Game;
