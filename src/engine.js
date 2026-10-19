/* XOX Rogue engine: 5x5 four-in-a-row search AI and Super XOX (ultimate tic-tac-toe). No DOM. */
var XOX = (function () {
  'use strict';

  var N = 5, NC = 25, FULL = (1 << 25) - 1;
  var WIN = 100000;

  function pc(x) {
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
  }

  /* ---------- 5x5: lines ---------- */
  var WINDOWS = (function () {
    var out = [], dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) for (var d = 0; d < 4; d++) {
      var dr = dirs[d][0], dc = dirs[d][1];
      var er = r + 3 * dr, ec = c + 3 * dc;
      if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
      var m = 0;
      for (var k = 0; k < 4; k++) m |= 1 << ((r + k * dr) * N + c + k * dc);
      out.push(m);
    }
    return out;
  })();

  var PATTERNS = {
    corners: (1 << 0) | (1 << 4) | (1 << 20) | (1 << 24),
    plus: (1 << 12) | (1 << 7) | (1 << 17) | (1 << 11) | (1 << 13)
  };

  function cellLines(lines) {
    var cl = [];
    for (var c = 0; c < NC; c++) {
      var a = [];
      for (var i = 0; i < lines.length; i++) if (lines[i] & (1 << c)) a.push(lines[i]);
      cl.push(a);
    }
    return cl;
  }

  /* extras: extra winning patterns (bit masks) for X only */
  function makeRules(extras) {
    var lx = WINDOWS.concat(extras || []);
    return { lines: [lx, WINDOWS], cl: [cellLines(lx), cellLines(WINDOWS)] };
  }

  function lineWon(mask, lines) {
    for (var i = 0; i < lines.length; i++) if ((mask & lines[i]) === lines[i]) return lines[i];
    return 0;
  }

  /* ---------- 5x5: search ---------- */
  var CENTER = [];
  for (var ci = 0; ci < NC; ci++) {
    var rr = Math.floor(ci / N), cc = ci % N;
    CENTER.push(4 - (Math.abs(rr - 2) + Math.abs(cc - 2)));
  }
  var W = [0, 1, 5, 25, 120, 0];

  /* st: {x,o,b,ban}. side: 0 = X, 1 = O (the side to move at the root).
     ban = cells only X may use. Returns {move, score, depth, nodes}. */
  function search5(st, rules, side, timeMs, opts) {
    opts = opts || {};
    var lines = rules.lines, cl = rules.cl;
    var blocked = st.b | 0, ban = st.ban | 0;
    var maxDepth = opts.maxDepth || 40;
    var deadline = Date.now() + timeMs;
    var nodes = 0, aborted = false;
    var tt = new Map();
    var lx = lines[0], lo = lines[1];

    function evalX(mx, mo) {
      var s = 0, i, l;
      for (i = 0; i < lx.length; i++) { l = lx[i]; if ((l & blocked) === 0 && (mo & l) === 0) s += W[pc(mx & l)]; }
      for (i = 0; i < lo.length; i++) { l = lo[i]; if ((l & blocked) === 0 && (mx & l) === 0) s -= W[pc(mo & l)]; }
      return s;
    }
    function wins(mask, c, s) {
      var a = cl[s][c], m2 = mask | (1 << c);
      for (var i = 0; i < a.length; i++) if ((m2 & a[i]) === a[i]) return true;
      return false;
    }
    function moveHeur(me, op, c, s) {
      var a = cl[s][c], h = CENTER[c], i, l;
      for (i = 0; i < a.length; i++) { l = a[i]; if ((l & blocked) === 0 && (op & l) === 0) h += W[pc(me & l) + 1] * 2; }
      var b = cl[s ^ 1][c];
      for (i = 0; i < b.length; i++) { l = b[i]; if ((l & blocked) === 0 && (me & l) === 0) h += W[pc(op & l) + 1]; }
      return h;
    }
    function orderedMoves(avail, me, op, s, ttMove) {
      var arr = [];
      for (var c = 0; c < NC; c++) if (avail & (1 << c)) arr.push({ c: c, h: c === ttMove ? 1e9 : moveHeur(me, op, c, s) });
      arr.sort(function (p, q) { return q.h - p.h; });
      return arr;
    }

    function nm(mx, mo, s, d, alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) aborted = true;
      if (aborted) return 0;
      var me = s === 0 ? mx : mo, op = s === 0 ? mo : mx;
      var occ = mx | mo | blocked;
      var availMe = FULL & ~occ; if (s === 1) availMe &= ~ban;
      var availOp = FULL & ~occ; if (s === 0) availOp &= ~ban;
      if (availMe === 0) return 0;
      var c;
      for (c = 0; c < NC; c++) if ((availMe & (1 << c)) && wins(me, c, s)) return WIN - ply;
      var threats = 0, tcount = 0;
      for (c = 0; c < NC; c++) if ((availOp & (1 << c)) && wins(op, c, s ^ 1)) { threats |= 1 << c; tcount++; }
      var forced = -1;
      if (tcount > 0) {
        if (tcount > 1 || (threats & availMe) === 0) return -(WIN - ply - 1);
        forced = 31 - Math.clz32(threats);
      }
      if (d <= 0) { var e = evalX(mx, mo); return s === 0 ? e : -e; }

      var key = (mx * 33554432 + mo) * 2 + s;
      var ent = tt.get(key), ttMove = -1;
      if (ent) {
        ttMove = ent.m;
        if (ent.d >= d) {
          if (ent.f === 0) return ent.v;
          if (ent.f === 1 && ent.v >= beta) return ent.v;
          if (ent.f === 2 && ent.v <= alpha) return ent.v;
        }
      }
      var moves = forced >= 0 ? [{ c: forced }] : orderedMoves(availMe, me, op, s, ttMove);
      var best = -Infinity, bestM = -1, a0 = alpha;
      for (var i = 0; i < moves.length; i++) {
        c = moves[i].c;
        var nx = s === 0 ? mx | (1 << c) : mx, no = s === 1 ? mo | (1 << c) : mo;
        var v = -nm(nx, no, s ^ 1, d - 1, -beta, -alpha, ply + 1);
        if (aborted) return 0;
        if (v > best) { best = v; bestM = c; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      tt.set(key, { d: d, v: best, f: best <= a0 ? 2 : (best >= beta ? 1 : 0), m: bestM });
      return best;
    }

    var mx0 = st.x | 0, mo0 = st.o | 0;
    var me0 = side === 0 ? mx0 : mo0, op0 = side === 0 ? mo0 : mx0;
    var occ0 = mx0 | mo0 | blocked;
    var avail0 = FULL & ~occ0; if (side === 1) avail0 &= ~ban;
    var availOp0 = FULL & ~occ0; if (side === 0) availOp0 &= ~ban;
    if (avail0 === 0) return { move: -1, score: 0, depth: 0, nodes: 0 };
    var c0;
    for (c0 = 0; c0 < NC; c0++) if ((avail0 & (1 << c0)) && wins(me0, c0, side)) return { move: c0, score: WIN, depth: 1, nodes: 1 };
    var thr = [];
    for (c0 = 0; c0 < NC; c0++) if ((availOp0 & (1 << c0)) && wins(op0, c0, side ^ 1)) thr.push(c0);
    if (thr.length === 1 && (avail0 & (1 << thr[0]))) return { move: thr[0], score: 0, depth: 1, nodes: 1, forced: true };

    var roots = orderedMoves(avail0, me0, op0, side, -1);
    var result = { move: roots[0].c, score: 0, depth: 0, nodes: 0 };
    for (var depth = 1; depth <= maxDepth; depth++) {
      var bestScore = -Infinity, ties = [], scores = [];
      for (var r = 0; r < roots.length; r++) {
        var c1 = roots[r].c;
        var nx1 = side === 0 ? mx0 | (1 << c1) : mx0, no1 = side === 1 ? mo0 | (1 << c1) : mo0;
        var lowA = bestScore === -Infinity ? -Infinity : bestScore - 1;
        var v1 = -nm(nx1, no1, side ^ 1, depth - 1, -Infinity, -lowA, 1);
        if (aborted) break;
        scores.push({ c: c1, v: v1 });
        if (v1 > bestScore) { bestScore = v1; ties = [c1]; }
        else if (v1 === bestScore) ties.push(c1);
      }
      if (aborted) break;
      result = { move: ties[Math.floor((opts.rng ? opts.rng() : Math.random()) * ties.length)], score: bestScore, depth: depth, nodes: nodes };
      scores.sort(function (p, q) { return q.v - p.v; });
      roots = scores.map(function (o) { return { c: o.c }; });
      if (Math.abs(bestScore) >= WIN - 60) break;
      if (Date.now() > deadline) break;
    }
    result.nodes = nodes;
    return result;
  }

  /* ---------- Super XOX ---------- */
  var L3 = [7, 56, 448, 73, 146, 292, 273, 84];
  var ROT = [2, 5, 8, 1, 4, 7, 0, 3, 6]; /* new position of old cell i after a 90 degree clockwise turn */
  var ROT9 = (function () {
    var t = new Int16Array(512);
    for (var m = 0; m < 512; m++) { var o = 0; for (var i = 0; i < 9; i++) if (m & (1 << i)) o |= 1 << ROT[i]; t[m] = o; }
    return t;
  })();
  var PC9 = (function () { var t = new Uint8Array(512); for (var m = 0; m < 512; m++) t[m] = pc(m); return t; })();

  function hasLine3(m) { for (var i = 0; i < 8; i++) if ((m & L3[i]) === L3[i]) return true; return false; }

  function newSuper(opts) {
    opts = opts || {};
    return {
      bx: new Int16Array(9), bo: new Int16Array(9), res: new Int8Array(9),
      next: -1, ply: 0,
      cursed: opts.cursed === undefined ? -1 : opts.cursed,
      spin: !!opts.spin
    };
  }

  function cloneSuper(S) {
    return { bx: S.bx.slice(), bo: S.bo.slice(), res: S.res.slice(), next: S.next, ply: S.ply, cursed: S.cursed, spin: S.spin };
  }

  function rotateSuper(S) {
    var bx = new Int16Array(9), bo = new Int16Array(9), res = new Int8Array(9);
    for (var i = 0; i < 9; i++) {
      var j = ROT[i];
      bx[j] = ROT9[S.bx[i]]; bo[j] = ROT9[S.bo[i]]; res[j] = S.res[i];
    }
    return { bx: bx, bo: bo, res: res, next: S.next >= 0 ? ROT[S.next] : -1, ply: S.ply, cursed: S.cursed >= 0 ? ROT[S.cursed] : -1, spin: S.spin };
  }

  /* returns new state; T.rotated tells the caller the grid turned. side: 0 = X, 1 = O */
  function applySuper(S, b, c, side) {
    var bx = S.bx.slice(), bo = S.bo.slice(), res = S.res.slice();
    if (side === 0) bx[b] |= 1 << c; else bo[b] |= 1 << c;
    var m = side === 0 ? bx[b] : bo[b], r = 0;
    if (hasLine3(m)) r = side === 0 ? 1 : 2;
    else if ((bx[b] | bo[b]) === 511) r = 3;
    var cursedVoid = false;
    if (b === S.cursed && r === 2) { r = 3; cursedVoid = true; }
    res[b] = r;
    var T = { bx: bx, bo: bo, res: res, next: res[c] === 0 ? c : -1, ply: S.ply + 1, cursed: S.cursed, spin: S.spin };
    T.won = r === 1 || r === 2 ? b : -1;
    T.cursedVoid = cursedVoid;
    T.rotated = false;
    if (S.spin && T.ply % 4 === 0 && superResult(T) === 0) {
      var won = T.won, cv = T.cursedVoid;
      T = rotateSuper(T); T.rotated = true; T.won = won >= 0 ? ROT[won] : -1; T.cursedVoid = cv;
    }
    return T;
  }

  /* 0 ongoing, 1 X wins, 2 O wins, 3 tie (board count equal) */
  function superResult(S) {
    var mx = 0, mo = 0, open = 0, nx = 0, no = 0;
    for (var i = 0; i < 9; i++) {
      var r = S.res[i];
      if (r === 1) { mx |= 1 << i; nx++; } else if (r === 2) { mo |= 1 << i; no++; } else if (r === 0) open++;
    }
    if (hasLine3(mx)) return 1;
    if (hasLine3(mo)) return 2;
    if (open === 0) return nx > no ? 1 : (no > nx ? 2 : 3);
    return 0;
  }

  function superMoves(S) {
    var out = [], b, c;
    if (S.next >= 0) {
      var occ = S.bx[S.next] | S.bo[S.next];
      for (c = 0; c < 9; c++) if (!(occ & (1 << c))) out.push([S.next, c]);
    } else {
      for (b = 0; b < 9; b++) if (S.res[b] === 0) {
        var oc = S.bx[b] | S.bo[b];
        for (c = 0; c < 9; c++) if (!(oc & (1 << c))) out.push([b, c]);
      }
    }
    return out;
  }

  var BW = [3, 2, 3, 2, 6, 2, 3, 2, 3];
  var MW = [0, 12, 60, 0];
  var LW = [0, 1, 4, 0];
  function evalSuper(S) {
    var mx = 0, mo = 0, md = 0, s = 0, i, l;
    for (i = 0; i < 9; i++) {
      var r = S.res[i];
      if (r === 1) { mx |= 1 << i; s += 25 + BW[i]; }
      else if (r === 2) { mo |= 1 << i; s -= 25 + BW[i]; }
      else if (r === 3) md |= 1 << i;
      else {
        var x = S.bx[i], o = S.bo[i];
        for (var k = 0; k < 8; k++) {
          l = L3[k];
          if (!(o & l)) s += LW[PC9[x & l]] * (1 + BW[i] / 6);
          if (!(x & l)) s -= LW[PC9[o & l]] * (1 + BW[i] / 6);
        }
        if (x & 16) s += 2; if (o & 16) s -= 2;
      }
    }
    for (i = 0; i < 8; i++) {
      l = L3[i];
      if (md & l) continue;
      var cx = PC9[mx & l], co = PC9[mo & l];
      if (!co) s += MW[cx];
      if (!cx) s -= MW[co];
    }
    return s;
  }

  /* side: 0 X, 1 O. Returns {b, c, score, depth, nodes} or null */
  function searchSuper(S, side, timeMs, opts) {
    opts = opts || {};
    var deadline = Date.now() + timeMs, nodes = 0, aborted = false;
    var maxDepth = opts.maxDepth || 30;

    function orderM(Sx, moves, s) {
      var arr = [];
      for (var i = 0; i < moves.length; i++) {
        var b = moves[i][0], c = moves[i][1], h = 0;
        var me = s === 0 ? Sx.bx[b] : Sx.bo[b], op = s === 0 ? Sx.bo[b] : Sx.bx[b];
        if (hasLine3(me | (1 << c))) h += 100;
        if (hasLine3(op | (1 << c))) h += 40;
        if (Sx.res[c] !== 0 || c === b && ((Sx.bx[b] | Sx.bo[b] | (1 << c)) === 511)) h -= 25; /* sends the opponent anywhere */
        else {
          var opm = s === 0 ? Sx.bo[c] : Sx.bx[c], occc = Sx.bx[c] | Sx.bo[c];
          for (var q = 0; q < 9; q++) if (!(occc & (1 << q)) && hasLine3(opm | (1 << q))) { h -= 30; break; } /* hands them a board */
        }
        h += BW[c] + (c === 4 ? 2 : 0);
        arr.push({ b: b, c: c, h: h });
      }
      arr.sort(function (p, q) { return q.h - p.h; });
      return arr;
    }

    function nm(Sx, s, d, alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) aborted = true;
      if (aborted) return 0;
      var r = superResult(Sx);
      if (r !== 0) {
        if (r === 3) return 0;
        var xw = r === 1;
        return ((xw && s === 0) || (!xw && s === 1)) ? WIN - ply : -(WIN - ply);
      }
      if (d <= 0) { var e = evalSuper(Sx); return s === 0 ? e : -e; }
      var moves = orderM(Sx, superMoves(Sx), s);
      if (!moves.length) return 0;
      var best = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var v = -nm(applySuper(Sx, moves[i].b, moves[i].c, s), s ^ 1, d - 1, -beta, -alpha, ply + 1);
        if (aborted) return 0;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }

    var all = superMoves(S);
    if (!all.length) return null;
    var roots = orderM(S, all, side);
    var result = { b: roots[0].b, c: roots[0].c, score: 0, depth: 0, nodes: 0 };
    for (var depth = 1; depth <= maxDepth; depth++) {
      var bestScore = -Infinity, ties = [], scores = [];
      for (var i = 0; i < roots.length; i++) {
        var lowA = bestScore === -Infinity ? -Infinity : bestScore - 1;
        var v = -nm(applySuper(S, roots[i].b, roots[i].c, side), side ^ 1, depth - 1, -Infinity, -lowA, 1);
        if (aborted) break;
        scores.push({ b: roots[i].b, c: roots[i].c, v: v });
        if (v > bestScore) { bestScore = v; ties = [roots[i]]; }
        else if (v === bestScore) ties.push(roots[i]);
      }
      if (aborted) break;
      var pick = ties[Math.floor((opts.rng ? opts.rng() : Math.random()) * ties.length)];
      result = { b: pick.b, c: pick.c, score: bestScore, depth: depth, nodes: nodes };
      scores.sort(function (p, q) { return q.v - p.v; });
      roots = scores;
      if (Math.abs(bestScore) >= WIN - 40) break;
      if (Date.now() > deadline) break;
    }
    result.nodes = nodes;
    return result;
  }

  var api = {
    N: N, NC: NC, FULL: FULL, WIN: WIN, WINDOWS: WINDOWS, PATTERNS: PATTERNS, pc: pc,
    makeRules: makeRules, lineWon: lineWon, search5: search5,
    L3: L3, ROT: ROT, ROT9: ROT9, newSuper: newSuper, cloneSuper: cloneSuper, rotateSuper: rotateSuper,
    applySuper: applySuper, superResult: superResult, superMoves: superMoves, searchSuper: searchSuper, evalSuper: evalSuper
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
