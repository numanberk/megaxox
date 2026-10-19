/* XOX Pop rules: drop X and O pieces on a 6x6 board, three of a kind in a row pops. No DOM. */
var Game = (function () {
  'use strict';

  var N = 6, CELLS = N * N, EMPTY = 0, X = 1, O = 2;
  /* the game gets harder every `levelEvery` pieces: more mixed pieces and more big shapes */
  var cfg = { mixedBase: 0.1, mixedStep: 0.08, mixedMax: 0.9, bigStep: 2, levelEvery: 15, maxLevel: 15, diagonals: true, fairTries: 30 };

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
    var w = SHAPES.map(function (s) { return s.weight + (s.big ? s.big * cfg.bigStep * lv / 2 : 0); });
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

  /* every run of 3+ equal marks in a row, column or diagonal. Returns {cells: [...unique], lines: n} */
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  function findRuns(board) {
    var hit = {}, lines = 0;
    for (var d = 0; d < (cfg.diagonals ? 4 : 2); d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
        var m = board[r * N + c];
        if (m === EMPTY) continue;
        var pr = r - dr, pc = c - dc;
        if (pr >= 0 && pr < N && pc >= 0 && pc < N && board[pr * N + pc] === m) continue; /* not the start of a run */
        var len = 0, rr = r, cc = c;
        while (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr * N + cc] === m) { len++; rr += dr; cc += dc; }
        if (len >= 3) {
          lines++;
          for (var k = 0; k < len; k++) hit[(r + k * dr) * N + c + k * dc] = 1;
        }
      }
    }
    return { cells: Object.keys(hit).map(Number), lines: lines };
  }

  /* new tray of three; at least one piece fits if any shape can */
  function newTray(board, rand, lv) {
    var tray;
    for (var t = 0; t < cfg.fairTries; t++) {
      tray = [randomPiece(rand, lv), randomPiece(rand, lv), randomPiece(rand, lv)];
      if (tray.some(function (p) { return fitsAnywhere(board, p); })) return tray;
    }
    tray[0] = [{ r: 0, c: 0, m: rand() < 0.5 ? X : O }];
    return tray;
  }

  function newGame(seed) {
    var s = seed === undefined ? (Math.random() * 4294967296) >>> 0 : seed >>> 0;
    var st = { v: 1, board: new Array(CELLS).fill(EMPTY), tray: [], score: 0, streak: 0, placed: 0, pops: 0, best: 0, over: false, seed: s, draws: 0 };
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
    var runs = findRuns(st.board);
    var gained = piece.length;
    if (runs.lines) {
      st.streak++;
      gained += runs.cells.length * 10 * runs.lines * Math.min(st.streak, 5);
      runs.cells.forEach(function (k) { st.board[k] = EMPTY; });
      st.pops += runs.lines;
    } else st.streak = 0;
    st.score += gained;
    st.placed++;
    st.tray[i] = null;
    var refilled = false;
    if (st.tray.every(function (p) { return !p; })) { st.tray = newTray(st.board, trayRand(st), level(st.placed)); refilled = true; }
    st.over = !canPlay(st);
    return { placed: placedAt, cleared: runs.cells, lines: runs.lines, streak: st.streak, gained: gained, refilled: refilled, over: st.over };
  }

  /* cells that would pop if tray[i] went at (r, c), for the drag preview */
  function preview(st, i, r, c) {
    var piece = st.tray[i];
    if (!piece || !fits(st.board, piece, r, c)) return null;
    var b = st.board.slice();
    piece.forEach(function (p) { b[(r + p.r) * N + c + p.c] = p.m; });
    return findRuns(b).cells;
  }

  return {
    N: N, CELLS: CELLS, EMPTY: EMPTY, X: X, O: O, cfg: cfg, SHAPES: SHAPES, level: level,
    rng: rng, randomPiece: randomPiece, size: size, fits: fits, fitsAnywhere: fitsAnywhere, findRuns: findRuns,
    newTray: newTray, newGame: newGame, canPlay: canPlay, place: place, preview: preview
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Game;
