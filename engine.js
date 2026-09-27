// Pawdoku engine: generator, uniqueness validator, human-style logic solver/grader.
const PawEngine = (() => {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function nb4(i, n) {
    const r = (i / n) | 0, c = i % n, out = [];
    if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
    return out;
  }

  // Random valid cat layout: one per row/col, no two touching (incl. diagonal).
  function randomSolution(n, rnd) {
    const sol = new Array(n), used = new Array(n).fill(false);
    function bt(r) {
      if (r === n) return true;
      for (const c of shuffle([...Array(n).keys()], rnd)) {
        if (used[c] || (r > 0 && Math.abs(c - sol[r - 1]) < 2)) continue;
        used[c] = true; sol[r] = c;
        if (bt(r + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    return bt(0) ? sol : null;
  }

  // Grow n contiguous color regions outward from the cat cells.
  function growRegions(n, sol, rnd, even, minSize = 1) {
    const N = n * n, reg = new Int8Array(N).fill(-1);
    for (let r = 0; r < n; r++) reg[r * n + sol[r]] = r;
    const w = Array.from({ length: n }, () => even ? 0.7 + rnd() * 0.8 : 0.25 + rnd() * 2);
    let left = N - n;
    // first give every region its minimum size
    const size = new Array(n).fill(1);
    for (let pass = 1; pass < minSize; pass++) for (const g of shuffle([...Array(n).keys()], rnd)) {
      if (size[g] > pass) continue;
      const fr = [];
      for (let i = 0; i < N; i++) if (reg[i] === g) for (const j of nb4(i, n)) if (reg[j] < 0) fr.push(j);
      if (!fr.length) return null;
      reg[fr[Math.floor(rnd() * fr.length)]] = g; size[g]++; left--;
    }
    while (left > 0) {
      const cand = []; let tot = 0;
      for (let i = 0; i < N; i++) if (reg[i] < 0)
        for (const j of nb4(i, n)) if (reg[j] >= 0) { cand.push(i, reg[j]); tot += w[reg[j]]; }
      let x = rnd() * tot, k = 0;
      for (; k < cand.length - 2; k += 2) { x -= w[cand[k + 1]]; if (x <= 0) break; }
      reg[cand[k]] = cand[k + 1]; left--;
    }
    return reg;
  }

  function connectedWithout(n, reg, g, skip) {
    const cells = []; for (let i = 0; i < n * n; i++) if (reg[i] === g && i !== skip) cells.push(i);
    if (!cells.length) return false;
    const seen = new Set([cells[0]]), st = [cells[0]];
    while (st.length) { const i = st.pop(); for (const j of nb4(i, n)) if (j !== skip && reg[j] === g && !seen.has(j)) { seen.add(j); st.push(j); } }
    return seen.size === cells.length;
  }

  // Exact solver: constraint propagation + branch on the most-constrained unit. Returns up to `limit` solutions.
  function solveAll(n, reg, limit) {
    const ctx = makeCtx(n, reg, false), N = n * n, U = 3 * n, res = [];
    const cand = new Uint8Array(N).fill(1), sat = new Uint8Array(U), sol = new Array(n);
    const trail = [];
    function put(c) {
      sol[(c / n) | 0] = c % n;
      for (const u of ctx.cellUnits[c]) { sat[u] = 1; trail.push(-1 - u); }
      if (cand[c]) { cand[c] = 0; trail.push(c); }
      for (const d of ctx.confList[c]) if (cand[d]) { cand[d] = 0; trail.push(d); }
    }
    function undo(mark) {
      while (trail.length > mark) { const x = trail.pop(); if (x < 0) sat[-1 - x] = 0; else cand[x] = 1; }
    }
    (function bt(placed) {
      if (placed === n) { res.push(sol.slice()); return res.length >= limit; }
      let best = -1, bestCnt = 1e9;
      for (let u = 0; u < U; u++) {
        if (sat[u]) continue;
        let k = 0; for (const c of ctx.units[u]) if (cand[c]) k++;
        if (k === 0) return false;
        if (k < bestCnt) { bestCnt = k; best = u; if (k === 1) break; }
      }
      for (const c of ctx.units[best]) {
        if (!cand[c]) continue;
        const mark = trail.length;
        put(c);
        if (bt(placed + 1)) return true;
        undo(mark);
        cand[c] = 0; trail.push(c); // exclude c for sibling branches
      }
      return false;
    })(0);
    return res;
  }

  // Build a region map whose ONLY solution is `sol` (repairs ambiguity iteratively).
  function regionSizes(n, reg) { const z = new Array(n).fill(0); for (let i = 0; i < n * n; i++) z[reg[i]]++; return z; }
  function makeUnique(n, rnd, minSize = 1) {
    const sol = randomSolution(n, rnd); if (!sol) return null;
    const reg = growRegions(n, sol, rnd, minSize > 1, minSize);
    if (!reg) return null;
    const size = regionSizes(n, reg);
    const isCat = i => sol[(i / n) | 0] === i % n;
    for (let it = 0; it < 400; it++) {
      const sols = solveAll(n, reg, 2);
      const alt = sols.find(s => s.some((c, r) => c !== sol[r]));
      if (!alt) return { n, sol, reg };
      const cells = shuffle(alt.map((c, r) => r * n + c).filter(i => !isCat(i)), rnd);
      let fixed = false;
      for (const i of cells) {
        const from = reg[i];
        for (const j of shuffle(nb4(i, n), rnd)) {
          const to = reg[j];
          if (to === from || size[from] <= minSize || !connectedWithout(n, reg, from, i)) continue;
          reg[i] = to; size[from]--; size[to]++; fixed = true; break;
        }
        if (fixed) break;
      }
      if (!fixed) {
        // stuck: random border move elsewhere to shake the layout, then keep repairing
        for (let t = 0; t < 50 && !fixed; t++) {
          const i = Math.floor(rnd() * n * n); if (isCat(i)) continue;
          const from = reg[i];
          if (size[from] <= minSize) continue;
          const nbs = nb4(i, n).filter(j => reg[j] !== from); if (!nbs.length) continue;
          if (!connectedWithout(n, reg, from, i)) continue;
          const to = reg[nbs[Math.floor(rnd() * nbs.length)]];
          reg[i] = to; size[from]--; size[to]++; fixed = true;
        }
        if (!fixed) return null;
      }
    }
    return null;
  }

  // ---------- Logic solver ----------
  function makeCtx(n, reg, withMatrix = true) {
    const N = n * n, confList = [], cellUnits = [], units = [], members = [];
    for (let u = 0; u < 3 * n; u++) units.push([]);
    for (let g = 0; g < n; g++) members.push([]);
    for (let i = 0; i < N; i++) members[reg[i]].push(i);
    const stamp = new Int32Array(N).fill(-1);
    for (let a = 0; a < N; a++) {
      const r1 = (a / n) | 0, c1 = a % n, l = [];
      const add = b => { if (b !== a && stamp[b] !== a) { stamp[b] = a; l.push(b); } };
      for (let k = 0; k < n; k++) { add(r1 * n + k); add(k * n + c1); }
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const r = r1 + dr, c = c1 + dc; if (r >= 0 && r < n && c >= 0 && c < n) add(r * n + c);
      }
      for (const b of members[reg[a]]) add(b);
      confList.push(l);
      cellUnits.push([r1, n + c1, 2 * n + reg[a]]);
      units[r1].push(a); units[n + c1].push(a); units[2 * n + reg[a]].push(a);
    }
    let conf = null;
    if (withMatrix) { conf = new Uint8Array(N * N); for (let a = 0; a < N; a++) for (const b of confList[a]) conf[a * N + b] = 1; }
    return { n, N, reg, conf, confList, cellUnits, units };
  }
  const newState = ctx => ({ cand: new Uint8Array(ctx.N).fill(1), cat: new Uint8Array(ctx.N) });
  const clone = s => ({ cand: s.cand.slice(), cat: s.cat.slice() });
  function place(ctx, s, c) { s.cat[c] = 1; s.cand[c] = 0; for (const d of ctx.confList[c]) s.cand[d] = 0; }
  function infos(ctx, s) {
    return ctx.units.map(cells => {
      let sat = false; const cands = [];
      for (const c of cells) { if (s.cat[c]) sat = true; else if (s.cand[c]) cands.push(c); }
      return { sat, cands };
    });
  }
  function combos(arr, k, fn) {
    const pick = [];
    (function rec(start) {
      if (pick.length === k) return fn(pick);
      for (let i = start; i < arr.length; i++) { pick.push(arr[i]); if (rec(i + 1)) return true; pick.pop(); }
      return false;
    })(0);
  }

  function findStep(ctx, s, maxLevel = 4) {
    const { n, N, conf, cellUnits } = ctx, inf = infos(ctx, s);
    for (let u = 0; u < inf.length; u++) if (!inf[u].sat && !inf[u].cands.length) return { contradiction: true, unit: u };
    for (let u = 0; u < inf.length; u++) if (!inf[u].sat && inf[u].cands.length === 1)
      return { level: 1, type: 'place', cells: [inf[u].cands[0]], unit: u };
    if (maxLevel < 2) return null;
    // L2: a cell attacked by every candidate of some unit.
    for (let u = 0; u < inf.length; u++) {
      if (inf[u].sat) continue;
      const C = inf[u].cands, el = [];
      for (let d = 0; d < N; d++) {
        if (!s.cand[d] || cellUnits[d].includes(u)) continue;
        let all = true; for (const c of C) if (!conf[c * N + d]) { all = false; break; }
        if (all) el.push(d);
      }
      if (el.length) return { level: 2, type: 'elim', cells: el, unit: u };
    }
    if (maxLevel < 3) return null;
    // L3: k units of one kind confined to k units of another kind.
    const kinds = [[2, 0], [2, 1], [0, 2], [1, 2], [0, 1], [1, 0]];
    for (let k = 2; k <= Math.min(4, n - 2); k++) for (const [ka, kb] of kinds) {
      const A = []; for (let i = 0; i < n; i++) if (!inf[ka * n + i].sat) A.push(ka * n + i);
      let found = null;
      combos(A, k, pick => {
        const B = new Set();
        for (const u of pick) { for (const c of inf[u].cands) B.add(cellUnits[c][kb]); if (B.size > k) return false; }
        if (B.size !== k) return false;
        const el = [];
        for (const b of B) for (const d of inf[b].cands) if (!pick.includes(cellUnits[d][ka])) el.push(d);
        if (el.length) { found = { level: 3, type: 'elim', cells: el, unit: pick[0], units: pick.slice(), into: [...B] }; return true; }
        return false;
      });
      if (found) return found;
    }
    if (maxLevel < 4) return null;
    // L4: placing here forces a chain of singles into a contradiction.
    for (let c = 0; c < N; c++) {
      if (!s.cand[c]) continue;
      const t = clone(s); place(ctx, t, c);
      for (let guard = 0; guard < n + 2; guard++) {
        const st = findStep(ctx, t, 1);
        if (st && st.contradiction) return { level: 4, type: 'elim', cells: [c], unit: ctx.cellUnits[c][2] };
        if (!st) break;
        place(ctx, t, st.cells[0]);
      }
    }
    return null;
  }
  function apply(ctx, s, st) {
    if (st.type === 'place') place(ctx, s, st.cells[0]); else for (const d of st.cells) s.cand[d] = 0;
  }
  function grade(ctx) {
    const s = newState(ctx), counts = [0, 0, 0, 0, 0]; let maxL = 0, cats = 0;
    while (cats < ctx.n) {
      const st = findStep(ctx, s, 4);
      if (!st || st.contradiction) return { solved: false, maxL, counts };
      apply(ctx, s, st); counts[st.level]++; maxL = Math.max(maxL, st.level);
      if (st.type === 'place') cats++;
    }
    return { solved: true, maxL, counts };
  }

  // Difficulty targets. minReg = smallest color region allowed; c4 = forcing-chain steps required.
  function spec(n, diff) {
    return {
      easy:   { minReg: 1, test: g => g.maxL <= 2 },
      medium: { minReg: 1, test: g => g.maxL === 3 },
      hard:   { minReg: 2, test: g => g.maxL === 4 && g.counts[4] >= 2 && g.counts[4] < expertC4(n) },
      expert: { minReg: n >= 6 ? 3 : 2, test: g => g.maxL === 4 && g.counts[4] >= expertC4(n) },
    }[diff];
  }
  function expertC4(n) { return n <= 6 ? 4 : n <= 8 ? 5 : 6; }
  const RANK = { easy: 2, medium: 3, hard: 4, expert: 5 };
  function score(g, n) { return g.maxL <= 2 ? 2 : g.maxL === 3 ? 3 : g.counts[4] >= expertC4(n) ? 5 : 4; }
  const minRegion = (n, reg) => Math.min(...regionSizes(n, reg));
  function hardness(g) { return g.maxL * 1000 + g.counts[4] * 60 + g.counts[3] * 15 + g.counts[2] * 2; }

  // Local search: move border cells between regions, keeping uniqueness + logic-solvability + min region size, climbing difficulty.
  function harden(n, p, target, rnd, deadline) {
    const sp = spec(n, target);
    let reg = Int8Array.from(p.reg), g = p.grade;
    const size = regionSizes(n, reg);
    const isCat = i => p.sol[(i / n) | 0] === i % n;
    const done = () => sp.test(g) && Math.min(...size) >= sp.minReg;
    while (Date.now() < deadline && !done()) {
      if (target === 'hard' && g.counts[4] >= expertC4(n) && Math.min(...size) >= sp.minReg) break;
      const i = Math.floor(rnd() * n * n); if (isCat(i)) continue;
      const nbs = nb4(i, n).filter(j => reg[j] !== reg[i]); if (!nbs.length) continue;
      const to = reg[nbs[Math.floor(rnd() * nbs.length)]];
      const from = reg[i];
      // never shrink a region below the minimum; growing undersized regions is always welcome
      if (size[from] <= sp.minReg) continue;
      if (!connectedWithout(n, reg, from, i)) continue;
      const helpsSize = size[to] < sp.minReg;
      reg[i] = to;
      const sols = solveAll(n, reg, 2);
      let ok = sols.length === 1, ng = null;
      if (ok) { ng = grade(makeCtx(n, reg)); ok = ng.solved && (helpsSize || hardness(ng) >= hardness(g)); }
      if (ok) { g = ng; size[from]--; size[to]++; } else reg[i] = from;
    }
    return { ...p, reg: Array.from(reg), grade: g, rating: ratingOf(g, n) };
  }

  // Generate a unique, logic-solvable puzzle for size n / difficulty. Deterministic per seed (budget aside).
  // budgetMs caps search time; if no exact difficulty match is found, returns the closest valid puzzle.
  function generate(n, diff = 'medium', seed = (Math.random() * 2 ** 32) >>> 0, budgetMs = 8000) {
    const sp = spec(n, diff), rnd = mulberry32(seed), t0 = Date.now(), deadline = t0 + budgetMs;
    let best = null, bestD = 99;
    for (let a = 0; a < 2000; a++) {
      if (best && Date.now() > t0 + budgetMs * 0.4) break;
      if (Date.now() > t0 + budgetMs * 1.5 && a > 0) break;
      const p = makeUnique(n, rnd, sp.minReg); if (!p) continue;
      const g = grade(makeCtx(n, p.reg));
      if (!g.solved) continue;
      const mr = minRegion(n, p.reg);
      const out = { n, sol: p.sol, reg: Array.from(p.reg), grade: g, diff, rating: ratingOf(g, n), seed };
      if (sp.test(g) && mr >= sp.minReg) return out;
      const d = Math.abs(score(g, n) - RANK[diff]) + (mr < sp.minReg ? 10 : 0);
      if (d < bestD || (d === bestD && hardness(g) > hardness(best.grade))) { bestD = d; best = out; }
    }
    if (best && (RANK[diff] > score(best.grade, n) || minRegion(n, best.reg) < sp.minReg || !sp.test(best.grade))) best = harden(n, best, diff, rnd, deadline);
    return best;
  }
  function ratingOf(g, n) { const k = score(g, n); return k <= 2 ? 'easy' : k === 3 ? 'medium' : k === 4 ? 'hard' : 'expert'; }
  // Independent check used before a puzzle is shown.
  function validate(p) {
    const sols = solveAll(p.n, Int8Array.from(p.reg), 2);
    return sols.length === 1 && sols[0].every((c, r) => c === p.sol[r]) && grade(makeCtx(p.n, Int8Array.from(p.reg))).solved;
  }
  return { generate, validate, makeCtx, newState, place, findStep, apply, solveAll };
})();
if (typeof module !== 'undefined') module.exports = PawEngine;
