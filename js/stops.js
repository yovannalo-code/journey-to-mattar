// The 13 stops along the road to Mattar (shown on stops-preview.html before they go into the game).
// Each stop has a 2D drawing (styled by the Sketch / Pixel / Cozy tokens) and a 3D model.
import { sk, sheep, BUILDINGS, STYLE } from './art.js';

const f = (n) => Math.round(n * 10) / 10;
const P = (X, Y) => (a, b) => [X + a, Y + b];
const poly = (cls, pts, r, amt = 0.5) => `<path class="${cls}" d="${sk(pts, r, amt, true)}"/>`;
const line = (cls, pts, r, amt = 0.4) => `<path class="${cls}" d="${sk(pts, r, amt, false)}"/>`;
const box = (cls, p, x0, y0, x1, y1, r, amt = 0.5) => poly(cls, [p(x0, y0), p(x0, y1), p(x1, y1), p(x1, y0)], r, amt);
const circ = (cls, x, y, rad) => `<circle class="${cls}" cx="${f(x)}" cy="${f(y)}" r="${f(rad)}"/>`;
const ell = (cls, x, y, rx, ry) => `<ellipse class="${cls}" cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"/>`;
// shaded right half of a circle
const halfShade = (x, y, R) => `<path class="h" d="M${f(x)} ${f(y - R)}A${f(R)} ${f(R)} 0 0 1 ${f(x)} ${f(y + R)}Z"/>`;
const roundTree = (x, y, k, r, apples = 0) => {
  const R = 11 * k, cy = y - 18 * k;
  let s = poly('trunk', [[x - 2 * k, y], [x - 2 * k, cy + R * 0.6], [x + 2 * k, cy + R * 0.6], [x + 2 * k, y]], r, 0.2);
  s += circ('w tree', x, cy, R) + halfShade(x, cy, R);
  const spots = [[-0.45, -0.2], [0.3, -0.45], [0.1, 0.3], [-0.2, 0.5], [0.55, 0.15]];
  for (let i = 0; i < apples; i++) s += circ('apple', x + spots[i][0] * R, cy + spots[i][1] * R, 2.2 * k);
  return s;
};

// ---------------------------------------------------------------- 2D drawings for the new stops

const DRAW = {
  well(X, Y, r) {
    const p = P(X, Y);
    return [
      line('o', [p(-12, -14), p(-12, -40)], r),
      line('o', [p(12, -14), p(12, -40)], r),
      box('w', p, -15, 0, 15, -14, r),
      box('h', p, 6, -1, 14, -13, r, 0.3),
      line('o thin', [p(-15, -7), p(15, -7)], r),
      line('o thin', [p(-5, 0), p(-5, -7)], r),
      line('o thin', [p(5, -7), p(5, -14)], r),
      ell('w', X, Y - 14, 15, 5),
      ell('k', X, Y - 14, 10, 3),
      line('o', [p(-12, -33), p(12, -33)], r),
      line('o thin', [p(0, -33), p(0, -23)], r),
      poly('tan', [p(-3, -23), p(3, -23), p(2, -17), p(-2, -17)], r, 0.3),
      poly('g', [p(-21, -37), p(0, -51), p(21, -37)], r),
      poly('h', [p(1, -50), p(20, -37.5), p(4, -37.5)], r, 0.3),
    ].join('');
  },
  shepherd(X, Y, r) {
    const p = P(X, Y);
    let s = box('w wall', p, -32, 0, -8, -18, r) + box('h', p, -16, -1, -9, -17, r, 0.3);
    s += poly('w roof', [p(-36, -16), p(-20, -34), p(-4, -16)], r) + poly('h', [p(-19, -33), p(-5, -16.5), p(-16, -16.5)], r, 0.3);
    s += box('k', p, -24, 0, -18, -9, r, 0.2);
    s += sheep(X + 18, Y - 4, false) + sheep(X + 30, Y + 1, true);
    for (const x of [0, 13, 26, 39]) s += line('o', [p(x, 5), p(x, -12)], r);
    s += line('o', [p(-1, -3), p(40, -3)], r) + line('o', [p(-1, -9), p(40, -9)], r);
    return s;
  },
  orchard(X, Y, r) {
    const p = P(X, Y);
    let s = roundTree(X - 4, Y - 10, 0.9, r, 4) + roundTree(X - 24, Y - 2, 1, r, 5) + roundTree(X + 18, Y, 1.05, r, 5);
    s += poly('tan', [p(-6, 0), p(8, 0), p(6, 8), p(-4, 8)], r, 0.3);
    s += circ('apple', X - 2, Y - 1, 2.5) + circ('apple', X + 3, Y - 1.5, 2.5) + circ('apple', X + 0.5, Y - 4, 2.5);
    return s;
  },
  dock(X, Y, r) {
    const p = P(X, Y);
    let s = ell('water', X + 4, Y, 42, 15);
    s += line('o thin glint-line', [p(-20, 6), p(-8, 6)], r) + line('o thin glint-line', [p(20, -8), p(30, -8)], r);
    for (const [x, y] of [[-30, -6], [-4, -6], [-24, 2], [2, 2]]) s += line('o', [p(x, y), p(x, y + 8)], r);
    s += poly('plank', [p(-36, -8), p(-2, -8), p(4, 1), p(-30, 1)], r, 0.4);
    for (let x = -30; x < 0; x += 6) s += line('o thin', [p(x, -8), p(x + 6, 1)], r, 0.2);
    s += poly('tan', [p(12, -2), p(38, -2), p(34, 6), p(16, 6)], r, 0.4);
    s += line('o', [p(24, -2), p(24, -32)], r);
    s += poly('w', [p(24, -31), p(36, -6), p(24, -6)], r, 0.4) + poly('h', [p(26, -26), p(34, -7), p(26, -7)], r, 0.2);
    s += ell('blu', X - 14, Y + 12, 5, 2.4) + poly('blu', [p(-19, 12), p(-23, 9), p(-23, 15)], r, 0.2);
    return s;
  },
  bakery(X, Y, r) {
    const p = P(X, Y);
    return [
      box('w', p, 4, -28, 10, -46, r, 0.3),
      line('o thin', [p(7, -48), p(4, -54), p(9, -58), p(6, -64)], r),
      box('w', p, -26, 0, 16, -24, r),
      box('h', p, 6, -1, 15, -23, r, 0.3),
      poly('g', [p(-30, -22), p(-5, -40), p(20, -22)], r),
      poly('h', [p(-4, -39), p(19, -22.5), p(0, -22.5)], r, 0.3),
      box('w', p, -8, 0, 0, -14, r, 0.3),
      box('y', p, -22, -16, -14, -9, r, 0.3),
      line('o', [p(16, -20), p(28, -20)], r),
      circ('w', X + 28, Y - 13, 6.5),
      ell('tan', X + 28, Y - 13, 4.5, 2.6),
      poly('w', [p(20, 0), p(20, -6), p(34, -6), p(34, 0)], r, 0.3),
      ell('tan', X + 24, Y - 7.5, 3, 1.8),
      ell('tan', X + 30, Y - 7.5, 3, 1.8),
    ].join('');
  },
  dairy(X, Y, r) {
    const p = P(X, Y);
    let s = box('w barn', p, -32, 0, 0, -18, r) + box('h', p, -9, -1, -1, -17, r, 0.3);
    s += poly('g', [p(-35, -16), p(-28, -28), p(-16, -35), p(-4, -28), p(3, -16)], r);
    s += poly('h', [p(-15, -34), p(-5, -27.5), p(2, -16.5), p(-12, -16.5)], r, 0.3);
    s += box('w', p, -22, 0, -10, -14, r, 0.3);
    s += line('o thin', [p(-22, 0), p(-10, -14)], r) + line('o thin', [p(-22, -14), p(-10, 0)], r);
    const can = (x, y) => {
      const q = P(X + x, Y + y);
      return (
        box('w', q, -4.5, 0, 4.5, -11, r, 0.3) +
        box('h', q, 1, -0.5, 4, -10.5, r, 0.1) +
        poly('w', [q(-4.5, -11), q(-2.5, -14), q(2.5, -14), q(4.5, -11)], r, 0.2) +
        box('k', q, -3, -14, 3, -16.5, r, 0.1)
      );
    };
    return s + can(18, -6) + can(11, 1) + can(22, 3);
  },
  smithy(X, Y, r) {
    const p = P(X, Y);
    return [
      box('w', p, -22, -18, -16, -46, r, 0.3),
      line('o thin', [p(-19, -48), p(-22, -54), p(-17, -58), p(-20, -64)], r),
      box('h', p, -28, -2, 10, -24, r, 0.4),
      line('o', [p(-28, 2), p(-28, -26)], r),
      line('o', [p(10, 4), p(10, -26)], r),
      poly('g', [p(-34, -24), p(-14, -38), p(16, -24)], r),
      box('w', p, -26, 0, -10, -10, r, 0.4),
      `<path class="apple" d="M${X - 18} ${Y - 10}q-5-6 0-12q2 5 5 6q1 4-5 6z"/>`,
      `<path class="y" d="M${X - 18} ${Y - 10}q-2-3 0-6q1 3 2 3q0 2-2 3z"/>`,
      poly('k', [p(2, -10), p(18, -10), p(15, -6), p(12, -6), p(13, 0), p(7, 0), p(8, -6), p(4, -6)], r, 0.2),
      line('o', [p(20, -12), p(28, -22)], r),
      box('k', p, 25, -25, 31, -21, r, 0.1),
      `<path class="o" d="M${X - 4} ${Y - 20}a4 4 0 1 1 6 0"/>`,
    ].join('');
  },
  oak(X, Y, r) {
    const p = P(X, Y);
    let s = poly('tan trunk-wood', [p(-7, 2), p(-5, -22), p(-14, -32), p(-3, -27), p(0, -36), p(4, -27), p(14, -32), p(6, -22), p(8, 2)], r, 0.5);
    s += line('o thin', [p(-2, 0), p(-1, -16)], r) + line('o thin', [p(3, -4), p(3, -14)], r);
    for (const [x, y, rad] of [[-18, -40, 14], [16, -40, 14], [0, -50, 17], [-6, -34, 10], [8, -33, 10]]) s += circ('w tree', X + x, Y + y, rad) + halfShade(X + x, Y + y, rad);
    s += line('o thin', [p(15, -31), p(13, -6)], r) + line('o thin', [p(23, -31), p(23, -6)], r);
    s += box('plank', p, 10, -6, 26, -3, r, 0.2);
    s += line('o', [p(-14, 2), p(-9, -1)], r) + line('o', [p(14, 2), p(9, -1)], r);
    return s;
  },
  // The destination: a modern tower with copper fins, a glass corner and a planted plinth.
  tannery(X, Y, r) {
    const W = 36, D = 18, H = 99, FL = 9; // half-width and half-depth on screen, height, floor height
    const L = (t, h) => [X - W * t, Y - D * t - h]; // left face: t = 0 at the front corner, 1 at the far left
    const R = (t, h) => [X + W * t, Y - D * t - h];
    // clear glass: a strip round the corner from the 3rd floor to the roof, plus a band 3 floors tall
    // that stops one floor below the roof; it runs the full right side but only partway along the left
    const bay = 3 * FL, cornerT = 0.22, bandLo = H - 4 * FL, bandHi = H - FL, leftEnd = 0.6;
    const inBand = (F, h, t0) => h >= bandLo && h < bandHi && (F === R || t0 < leftEnd);
    let s = poly('lawn', [[X, Y + 9], [X - W - 12, Y - D + 2], [X, Y - 2 * D - 6], [X + W + 12, Y - D + 2]], r, 0.6);
    // both faces start as the copper frame; the windows are set into it
    s += poly('facade', [L(0, 0), L(1, 0), L(1, H), L(0, H)], r, 0.5);
    s += poly('facade', [R(0, 0), R(1, 0), R(1, H), R(0, H)], r, 0.5);
    s += poly('w', [L(0, H), L(1, H), [X, Y - 2 * D - H], R(1, H)], r, 0.5);
    s += poly('lit', [L(0, 0.5), L(1, 0.5), L(1, FL - 1), L(0, FL - 1)], r, 0.2) + poly('lit', [R(0, 0.5), R(1, 0.5), R(1, FL - 1), R(0, FL - 1)], r, 0.2);
    // one window per bay per floor: dark glass, a few lit from inside
    const cols = STYLE.name === 'pixel' ? 5 : 8;
    for (let h = FL; h < H - 0.5; h += FL) {
      for (let c = 0; c < cols; c++) {
        const t0 = c / cols + 0.018, t1 = (c + 1) / cols - 0.018;
        for (const F of [L, R]) {
          if ((h >= bay && t0 < cornerT) || inBand(F, h, t0)) continue; // the clear glass covers these
          const cls = r() < 0.18 ? 'lit' : 'pane';
          s += poly(cls, [F(t0, h + 1.3), F(t1, h + 1.3), F(t1, h + FL - 1.3), F(t0, h + FL - 1.3)], r, 0.12);
        }
      }
    }
    s += poly('h see-through', [R(0, 0), R(1, 0), R(1, H), R(0, H)], r, 0.3);
    // deeper copper fins at uneven spacing, like the facade in the reference
    for (const t of [0.375, 0.625, 0.875, 1])
      for (const F of [L, R]) {
        if (F === L && t > leftEnd) s += line('fin', [F(t, FL), F(t, H)], r, 0.2);
        else s += line('fin', [F(t, FL), F(t, bandLo)], r, 0.2) + line('fin', [F(t, bandHi), F(t, H)], r, 0.2);
      }
    // the clear glass, with floor lines, mullions and its grey frame
    const glass = [L(leftEnd, bandLo), L(cornerT, bandLo), L(cornerT, bay), L(0, bay), R(cornerT, bay), R(cornerT, bandLo), R(1, bandLo),
      R(1, bandHi), R(cornerT, bandHi), R(cornerT, H), R(0, H), L(cornerT, H), L(cornerT, bandHi), L(leftEnd, bandHi)];
    s += poly('clear', glass, r, 0.3);
    for (let h = bay + FL; h < H - 1; h += FL) {
      const wide = h > bandLo && h < bandHi;
      s += line('o thin', [L(wide ? leftEnd : cornerT, h), L(0, h), R(wide ? 1 : cornerT, h)], r, 0.1);
    }
    s += line('o thin', [L(cornerT / 2, bay), L(cornerT / 2, H)], r, 0.1) + line('o thin', [R(cornerT / 2, bay), R(cornerT / 2, H)], r, 0.1);
    for (const t of [0.4, 0.6, 0.8]) s += line('o thin', [R(t, bandLo), R(t, bandHi)], r, 0.1);
    s += line('o thin', [L(0.41, bandLo), L(0.41, bandHi)], r, 0.1);
    s += poly('frame', glass, r, 0.3);
    // planting: round trees, shrubs and a palm
    s += line('o', [[X + 44, Y - 2], [X + 47, Y - 20], [X + 45, Y - 36]], r, 0.4);
    for (const [dx, dy] of [[-14, 4], [-12, -4], [0, -9], [12, -4], [14, 4]])
      s += poly('w tree', [[X + 45, Y - 36], [X + 45 + dx * 0.6, Y - 36 + dy - 3], [X + 45 + dx, Y - 36 + dy], [X + 45 + dx * 0.5, Y - 36 + dy + 2]], r, 0.3);
    s += roundTree(X - 44, Y - 6, 0.65, r) + roundTree(X - 20, Y + 6, 0.55, r) + roundTree(X + 22, Y + 6, 0.5, r);
    for (const [x, y] of [[-6, 7], [4, 8], [-30, 2], [30, 1]]) s += circ('w tree', X + x, Y + y, 3.5);
    return s;
  },
};

// ---------------------------------------------------------------- 3D models

const C3 = {
  wall: '#fff4e3', coral: '#ef9a82', blue: '#9cc7ec', yellow: '#f6cf6a', pink: '#f2a0a8', orange: '#f2b880',
  stone: '#e9e2d6', rock: '#cdd2dc', dark: '#6b5a50', wood: '#d9b088', woodDark: '#b98a62', hide: '#f0cf9f',
  leaves: '#86c487', leaves2: '#95cd8b', water: '#8fd0d4', wool: '#fffaf0', face: '#6b5a50', white: '#ffffff', stem: '#7db86a',
  glass: '#bccdd6', glassTop: '#d6e3e9', slab: '#9aa6ad', lit: '#f6dfa6', copper: '#b8642f', pane: '#7f98a6', mullion: '#c9d6dd', clear: '#f1f7fa', frame: '#7b8790', lawn: '#9ccb7e', palm: '#6fae6a',
};

const BUILD = {
  camp({ part, flag }) {
    part('cone4', C3.wall, 0, 0.25, 0, 0.36, 0.5, 0.36, Math.PI / 4);
    part('box', C3.dark, 0.2, 0.1, 0.12, 0.02, 0.18, 0.12, Math.PI / 4);
    flag(0, 0.45, 0, C3.yellow);
    part('cyl', C3.woodDark, 0.45, 0.03, 0.15, 0.08, 0.05, 0.08);
    part('cone', C3.coral, 0.45, 0.13, 0.15, 0.06, 0.16, 0.06);
    part('cone', C3.yellow, 0.45, 0.11, 0.15, 0.035, 0.1, 0.035);
  },
  well({ part }) {
    part('cyl', C3.stone, 0, 0.12, 0, 0.24, 0.24, 0.24);
    part('cyl', C3.water, 0, 0.245, 0, 0.18, 0.02, 0.18);
    for (const z of [-0.2, 0.2]) part('box', C3.woodDark, 0, 0.42, z, 0.04, 0.6, 0.04);
    part('cyl', C3.woodDark, 0, 0.6, 0, 0.02, 0.44, 0.02, 0, Math.PI / 2);
    part('cyl', C3.wood, 0, 0.42, 0, 0.05, 0.07, 0.05);
    part('cone4', C3.coral, 0, 0.8, 0, 0.36, 0.22, 0.36, Math.PI / 4);
  },
  shepherd({ part, sheep }) {
    part('box', C3.wall, -0.2, 0.15, -0.15, 0.34, 0.3, 0.32);
    part('cone4', C3.blue, -0.2, 0.4, -0.15, 0.3, 0.22, 0.3, Math.PI / 4);
    part('box', C3.dark, -0.03, 0.09, -0.15, 0.02, 0.17, 0.09);
    const posts = [[0.05, 0.05], [0.45, 0.05], [0.45, 0.45], [0.05, 0.45]];
    for (const [x, z] of posts) part('cyl', C3.woodDark, x, 0.1, z, 0.018, 0.2, 0.018);
    for (const h of [0.08, 0.16]) {
      part('box', C3.wood, 0.25, h, 0.05, 0.4, 0.02, 0.02);
      part('box', C3.wood, 0.25, h, 0.45, 0.4, 0.02, 0.02);
      part('box', C3.wood, 0.45, h, 0.25, 0.02, 0.02, 0.4);
      part('box', C3.wood, 0.05, h, 0.25, 0.02, 0.02, 0.4);
    }
    sheep(0.22, 0.22, 0.75, 0.4);
    sheep(0.33, 0.33, 0.7, -1.2);
  },
  mill({ part, T, g, spin }) {
    part('cyl', C3.wall, 0, 0.4, 0, 0.22, 0.8, 0.22);
    part('cone', C3.coral, 0, 0.92, 0, 0.27, 0.26, 0.27);
    part('box', C3.dark, 0.2, 0.1, 0.08, 0.04, 0.18, 0.1, Math.PI / 4);
    const hub = new T.Group(); // faces the sails outward
    hub.position.set(0.22, 0.68, 0.22);
    hub.rotation.y = -Math.PI / 4;
    const sails = new T.Group(); // turns around the hub's own axis
    hub.add(sails);
    for (let i = 0; i < 4; i++) part('box', C3.stone, 0, Math.cos((i * Math.PI) / 2) * 0.27, Math.sin((i * Math.PI) / 2) * 0.27, 0.02, 0.5, 0.1, 0, (i * Math.PI) / 2, 0, sails);
    g.add(hub);
    spin.push(sails);
  },
  orchard({ part }) {
    const trees = [[-0.25, -0.2, 1], [0.2, -0.25, 0.9], [-0.15, 0.25, 0.95]];
    for (const [x, z, k] of trees) {
      part('cyl', C3.woodDark, x, 0.12 * k, z, 0.04 * k, 0.24 * k, 0.04 * k);
      part('ball', C3.leaves, x, 0.38 * k, z, 0.2 * k, 0.19 * k, 0.2 * k);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1, y = 0.36 * k + Math.sin(i * 2.3) * 0.08;
        part('ball', C3.coral, x + Math.cos(a) * 0.18 * k, y, z + Math.sin(a) * 0.18 * k, 0.03, 0.03, 0.03);
      }
    }
    part('cyl', C3.wood, 0.25, 0.05, 0.2, 0.09, 0.1, 0.09);
    for (const [x, z] of [[0.22, 0.18], [0.28, 0.22], [0.25, 0.15]]) part('ball', C3.coral, x, 0.12, z, 0.035, 0.035, 0.035);
  },
  dock({ part }) {
    part('cyl', C3.water, 0.1, 0.01, 0.1, 0.55, 0.02, 0.45);
    part('box', C3.wood, -0.2, 0.08, 0, 0.6, 0.04, 0.2);
    for (const [x, z] of [[-0.45, -0.1], [-0.45, 0.1], [0.05, -0.1], [0.05, 0.1]]) part('cyl', C3.woodDark, x, 0.05, z, 0.025, 0.12, 0.025);
    part('ball', C3.orange, 0.3, 0.06, 0.25, 0.2, 0.07, 0.09);
    part('cyl', C3.woodDark, 0.3, 0.3, 0.25, 0.012, 0.45, 0.012);
    part('cone4', C3.wall, 0.3, 0.32, 0.25, 0.012, 0.36, 0.14, 0, 0, 0);
    part('ball', C3.blue, 0.4, 0.05, -0.2, 0.06, 0.03, 0.025, 0.4);
  },
  market({ part }) {
    for (const [ox, oz, c] of [[-0.25, 0.2, C3.yellow], [0.25, -0.2, C3.coral]]) {
      part('box', C3.wood, ox, 0.1, oz, 0.4, 0.2, 0.26);
      for (const [px, pz] of [[-0.18, -0.11], [0.18, -0.11], [-0.18, 0.11], [0.18, 0.11]]) part('cyl', C3.woodDark, ox + px, 0.22, oz + pz, 0.015, 0.44, 0.015);
      part('box', c, ox, 0.46, oz, 0.46, 0.05, 0.32);
      part('ball', C3.coral, ox - 0.1, 0.23, oz, 0.04, 0.04, 0.04);
      part('ball', C3.yellow, ox + 0.02, 0.23, oz, 0.04, 0.04, 0.04);
      part('ball', C3.leaves, ox + 0.12, 0.23, oz, 0.04, 0.04, 0.04);
    }
  },
  bakery({ part }) {
    part('box', C3.stone, 0.12, 0.55, -0.12, 0.08, 0.3, 0.08);
    part('box', C3.wall, 0, 0.2, 0, 0.5, 0.4, 0.4);
    part('cone4', C3.coral, 0, 0.53, 0, 0.38, 0.26, 0.34, Math.PI / 4);
    part('box', C3.yellow, 0.251, 0.22, -0.1, 0.01, 0.1, 0.1);
    part('box', C3.dark, 0.251, 0.1, 0.08, 0.01, 0.2, 0.1);
    part('cyl', C3.wall, 0.12, 0.3, 0.26, 0.09, 0.015, 0.09, 0, Math.PI / 2);
    part('ball', C3.hide, 0.12, 0.3, 0.27, 0.055, 0.03, 0.02);
    for (const [y, s] of [[0.72, 0.04], [0.8, 0.05], [0.9, 0.06]]) part('ball', C3.white, 0.12, y, -0.12, s, s, s);
  },
  dairy({ part }) {
    part('box', C3.coral, -0.1, 0.16, 0, 0.5, 0.32, 0.38);
    part('box', C3.wall, -0.1, 0.32, 0, 0.54, 0.24, 0.24, 0, Math.PI / 4);
    part('box', C3.wall, 0.151, 0.1, 0, 0.01, 0.2, 0.16);
    for (const [x, z] of [[0.3, 0.15], [0.38, 0.28], [0.25, 0.32]]) {
      part('cyl', C3.stone, x, 0.07, z, 0.045, 0.14, 0.045);
      part('cyl', C3.stone, x, 0.16, z, 0.025, 0.05, 0.025);
      part('cyl', C3.dark, x, 0.19, z, 0.03, 0.02, 0.03);
    }
  },
  smithy({ part }) {
    part('box', C3.stone, -0.2, 0.5, -0.2, 0.1, 0.5, 0.1);
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) part('cyl', C3.woodDark, x, 0.22, z, 0.02, 0.44, 0.02);
    part('box', C3.wood, 0, 0.46, 0, 0.62, 0.04, 0.62, 0, 0, 0.12);
    part('box', C3.stone, -0.15, 0.1, -0.1, 0.24, 0.2, 0.2);
    part('cone', C3.coral, -0.15, 0.26, -0.1, 0.07, 0.14, 0.07);
    part('cone', C3.yellow, -0.15, 0.23, -0.1, 0.04, 0.09, 0.04);
    part('box', C3.dark, 0.15, 0.06, 0.12, 0.08, 0.12, 0.06);
    part('box', C3.dark, 0.15, 0.14, 0.12, 0.16, 0.04, 0.07);
  },
  oak({ part }) {
    part('cyl', C3.woodDark, 0, 0.25, 0, 0.09, 0.5, 0.09);
    part('cyl', C3.woodDark, 0.12, 0.5, 0, 0.04, 0.3, 0.04, 0, 0, -0.9);
    part('cyl', C3.woodDark, -0.1, 0.52, 0.05, 0.035, 0.25, 0.035, 0, 0.5, 0.8);
    for (const [x, y, z, s] of [[0, 0.75, 0, 0.32], [0.25, 0.62, 0.05, 0.22], [-0.22, 0.65, 0, 0.22], [0, 0.65, 0.22, 0.2], [0.05, 0.68, -0.22, 0.2]])
      part('ball', x > 0.2 ? C3.leaves2 : C3.leaves, x, y, z, s, s * 0.9, s);
    for (const z of [0.18, 0.32]) part('cyl', C3.dark, 0.3, 0.3, z, 0.006, 0.36, 0.006);
    part('box', C3.wood, 0.3, 0.12, 0.25, 0.08, 0.02, 0.18);
  },
  tower({ part, flag }) {
    part('cyl', C3.stone, 0, 0.55, 0, 0.18, 1.1, 0.18);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      part('box', C3.stone, Math.cos(a) * 0.17, 1.14, Math.sin(a) * 0.17, 0.07, 0.08, 0.07, -a);
    }
    part('box', C3.dark, 0.13, 0.7, 0.13, 0.02, 0.12, 0.04, Math.PI / 4);
    flag(0, 1.1, 0, C3.blue);
  },
  // A modern tower: glass box, copper fins on the two faces we see, a lit glass corner, planted plinth.
  tannery({ part, T, g }) {
    const w = 0.64, d = 0.52, H = 1.7, FL = 0.125, roof = H + 0.05;
    // clear glass: corner strip from bayY0 to the roof, plus a 3-floor band stopping one floor below the roof;
    // full length on the +x face (right on screen), partway along the +z face (left on screen)
    const bandLo = roof - 4 * FL, bandHi = roof - FL, bayY0 = 0.55, leftLen = 0.6 * w;
    part('box', C3.lawn, 0, 0.025, 0, 1.05, 0.05, 0.95);
    part('box', C3.pane, 0, H / 2 + 0.05, 0, w, H, d);
    part('box', C3.lit, 0, 0.13, 0, w + 0.01, 0.15, d + 0.01);
    // copper band at every floor: with the fins below, it frames each window
    for (let y = 0.21; y < roof; y += FL) part('box', C3.copper, 0, y, 0, w + 0.02, 0.03, d + 0.02);
    part('box', C3.slab, 0, H + 0.06, 0, w + 0.04, 0.025, d + 0.04);
    const finH = roof - 0.21;
    // thin pale mullions split each face into window bays
    const cols = 8;
    for (let c = 1; c < cols; c++) {
      const u = -0.5 + c / cols;
      part('box', C3.mullion, w / 2 + 0.006, 0.21 + finH / 2, u * d, 0.008, finH, 0.008);
      part('box', C3.mullion, u * w, 0.21 + finH / 2, d / 2 + 0.006, 0.008, finH, 0.008);
    }
    // some windows lit from inside (a fixed pattern so it looks the same every time)
    let n = 0;
    for (let y = 0.21; y + FL <= roof; y += FL)
      for (let c = 0; c < cols; c++) {
        n = (n * 37 + 11) % 100;
        if (n > 22) continue;
        const u = -0.5 + (c + 0.5) / cols;
        if (n % 2) part('box', C3.lit, w / 2 + 0.004, y + FL / 2, u * d, 0.006, FL - 0.04, d / cols - 0.02);
        else part('box', C3.lit, u * w, y + FL / 2, d / 2 + 0.004, w / cols - 0.02, FL - 0.04, 0.006);
      }
    // deeper copper fins at uneven spacing; they break where the clear band crosses
    const fin = (x, z, sx, sz, y0, y1) => part('box', C3.copper, x, (y0 + y1) / 2, z, sx, y1 - y0, sz);
    for (const z of [-0.26, -0.13, 0.0, 0.13]) {
      fin(w / 2 + 0.02, z, 0.035, 0.016, 0.21, bandLo);
      fin(w / 2 + 0.02, z, 0.035, 0.016, bandHi, roof);
    }
    for (const x of [-0.32, -0.16, 0.0, 0.16]) {
      if (x < w / 2 - leftLen) fin(x, d / 2 + 0.02, 0.016, 0.035, 0.21, roof);
      else {
        fin(x, d / 2 + 0.02, 0.016, 0.035, 0.21, bandLo);
        fin(x, d / 2 + 0.02, 0.016, 0.035, bandHi, roof);
      }
    }
    // the clear glass: corner strip, sitting just outside the corner so it reads as a bay wrapping it
    const bayH = roof - bayY0;
    const bayBox = part('box', C3.clear, w / 2 + 0.012, bayY0 + bayH / 2, d / 2 + 0.012, 0.3, bayH, 0.03, Math.PI / 4);
    bayBox.castShadow = false;
    for (let y = bayY0 + FL; y < roof; y += FL) part('box', C3.mullion, w / 2 + 0.03, y, d / 2 + 0.03, 0.3, 0.01, 0.01, Math.PI / 4);
    // ... and the band: full length on +x, partway along +z from the corner
    const bandH = bandHi - bandLo, lenX = d - 0.1, midY = bandLo + bandH / 2;
    const xz = [
      { x: w / 2 + 0.03, z: -d / 2 + lenX / 2, sx: 0.02, sz: lenX, end: [w / 2 + 0.045, -d / 2 - 0.005] },
      { x: w / 2 - leftLen / 2, z: d / 2 + 0.03, sx: leftLen, sz: 0.02, end: [w / 2 - leftLen - 0.005, d / 2 + 0.045] },
    ];
    for (const b of xz) {
      part('box', C3.clear, b.x, midY, b.z, b.sx, bandH, b.sz);
      for (let y = bandLo + FL; y < bandHi - 0.01; y += FL) part('box', C3.mullion, b.x + (b.sx < 0.05 ? 0.012 : 0), y, b.z + (b.sz < 0.05 ? 0.012 : 0), Math.max(b.sx, 0.006), 0.01, Math.max(b.sz, 0.006));
      // grey frame: top, bottom and the far end of the band
      for (const y of [bandLo, bandHi]) part('box', C3.frame, b.x + (b.sx < 0.05 ? 0.015 : 0), y, b.z + (b.sz < 0.05 ? 0.015 : 0), b.sx < 0.05 ? 0.03 : b.sx + 0.02, 0.03, b.sz < 0.05 ? 0.03 : b.sz + 0.02);
      part('box', C3.frame, b.end[0], midY, b.end[1], 0.03, bandH, 0.03);
    }
    const o = 0.3 / 2 / Math.SQRT2; // half the corner strip's width, along each face
    for (const [x, z] of [[w / 2 + 0.012 + o, d / 2 + 0.012 - o], [w / 2 + 0.012 - o, d / 2 + 0.012 + o]]) part('box', C3.frame, x, bayY0 + bayH / 2, z, 0.03, bayH, 0.03);
    part('box', C3.frame, w / 2 + 0.012, bayY0, d / 2 + 0.012, 0.32, 0.03, 0.045, Math.PI / 4);
    // planting
    for (const [x, z, s] of [[0.45, 0.1, 0.07], [0.45, -0.25, 0.06], [0.1, 0.4, 0.07], [-0.3, 0.42, 0.06], [0.42, 0.38, 0.05]]) part('ball', C3.leaves, x, s, z, s, s, s);
    for (const [x, z, k] of [[-0.45, 0.35, 0.8], [0.4, -0.4, 0.7]]) {
      part('cyl', C3.woodDark, x, 0.12 * k, z, 0.03 * k, 0.24 * k, 0.03 * k);
      part('ball', C3.leaves2, x, 0.34 * k, z, 0.16 * k, 0.15 * k, 0.16 * k);
    }
    const palm = new T.Group();
    palm.position.set(0.45, 0, 0.42);
    part('cyl', C3.woodDark, 0, 0.32, 0, 0.022, 0.64, 0.022, 0, 0, 0.08, palm);
    for (let i = 0; i < 6; i++) part('box', C3.palm, 0, 0.64, 0, 0.3, 0.012, 0.06, (i * Math.PI) / 3, 0, -0.35, palm).geometry;
    palm.children.slice(1).forEach((leaf, i) => {
      const a = (i * Math.PI) / 3;
      leaf.position.set(Math.cos(a) * 0.12, 0.62, -Math.sin(a) * 0.12);
    });
    g.add(palm);
  },
};

// ---------------------------------------------------------------- the list

export const STOP_TYPES = [
  { key: 'camp', name: 'Base Camp', blurb: 'Pack your bags. Every journey starts with one step.' },
  { key: 'well', name: 'The Village Well', blurb: 'Fill up before the long road.' },
  { key: 'shepherd', name: "Shepherd's Hut", blurb: 'Where the flock is counted, one by one.' },
  { key: 'mill', name: 'The Windmill', blurb: 'Small turns, steady work.' },
  { key: 'orchard', name: 'Apple Orchard', blurb: 'What you planted starts to grow.' },
  { key: 'dock', name: 'Fishing Dock', blurb: 'Patience on the water.' },
  { key: 'market', name: 'Market Town', blurb: 'Spend wisely, save the rest.' },
  { key: 'bakery', name: 'The Bakery', blurb: 'Daily bread, shared around.' },
  { key: 'dairy', name: 'Dairy Farm', blurb: 'Milk cans and early mornings.' },
  { key: 'smithy', name: 'The Blacksmith', blurb: 'Shaped by heat and hard work.' },
  { key: 'oak', name: 'The Old Oak', blurb: 'Deep roots, wide branches.' },
  { key: 'tower', name: 'The Watchtower', blurb: 'Look back at how far you came. Mattar is in sight.' },
  { key: 'tannery', name: 'Tannery', blurb: 'Journey complete. Well done, flock!' },
];

// 2D: an SVG markup string, bottom centre at (X, Y)
export function drawStop2D(key, X, Y, r) {
  if (DRAW[key]) return DRAW[key](X, Y, r);
  return BUILDINGS[key](X, Y, r);
}

// 3D: a Three.js group with its own meshes; `mat(color)` returns a shared toon material.
// Returns { group, spin } where spin lists parts that turn (windmill sails).
const geoCache = new WeakMap();
export function buildStop3D(T, key, mat) {
  if (!geoCache.has(T))
    geoCache.set(T, {
      ball: new T.IcosahedronGeometry(1, 3),
      cyl: new T.CylinderGeometry(1, 1, 1, 14),
      cone: new T.ConeGeometry(1, 1, 10),
      cone4: new T.ConeGeometry(1, 1, 4),
      box: new T.BoxGeometry(1, 1, 1),
    });
  const G = geoCache.get(T);
  const g = new T.Group();
  const spin = [];
  const part = (shape, color, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, parent = g) => {
    const m = new T.Mesh(G[shape], mat(color));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const flag = (x, y, z, color) => {
    part('cyl', C3.dark, x, y + 0.25, z, 0.012, 0.5, 0.012);
    part('box', color, x + 0.08, y + 0.42, z + 0.08, 0.015, 0.12, 0.22, -Math.PI / 4);
  };
  const sheep = (x, z, k, rot) => {
    const s = new T.Group();
    s.position.set(x, 0, z);
    s.rotation.y = rot;
    s.scale.setScalar(k);
    for (const [lx, lz] of [[-0.07, -0.05], [-0.07, 0.05], [0.07, -0.05], [0.07, 0.05]]) part('cyl', C3.face, lx, 0.05, lz, 0.018, 0.1, 0.018, 0, 0, 0, s);
    part('ball', C3.wool, 0, 0.16, 0, 0.15, 0.1, 0.11, 0, 0, 0, s);
    part('ball', C3.face, 0.14, 0.2, 0, 0.055, 0.05, 0.045, 0, 0, 0, s);
    g.add(s);
  };
  BUILD[key]({ T, g, part, flag, sheep, spin });
  return { group: g, spin };
}
