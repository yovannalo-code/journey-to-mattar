// Hand-drawn style SVG pieces, in the black-ink-on-paper look of the reference art.
// Every function returns an SVG markup string. Styling classes live in styles.css:
//   w = white fill + ink outline, o = ink line only, k = ink fill,
//   y = yellow fill, g = grey fill, h = hatched fill, tan = hide colour.

// Three looks for the same map. Colours live in styles.css (.style-sketch / -pixel / -cozy);
// here we only change how wobbly lines are, which filter runs and what trees look like.
export const STYLES = {
  sketch: { label: 'Sketch', note: 'Scratchy ink and hatching on grey paper', rough: 1.7, filter: 'rough', tree: 'pine' },
  pixel: { label: 'Pixel', note: 'Chunky pixels and halftone dots on green', rough: 0.3, filter: 'pixelate', tree: 'pine' },
  cozy: { label: 'Cozy', note: 'Soft pastel, flat cel shading', rough: 0, filter: null, tree: 'round' },
  cozy3d: { label: 'Cozy 3D', note: 'A real 3D toy world you can drag around', rough: 0, filter: null, tree: 'round', renderer: '3d' },
};
export const STYLE = { name: 'sketch', ...STYLES.sketch };
export function setArtStyle(name) {
  if (!STYLES[name]) name = 'sketch';
  Object.assign(STYLE, { name, renderer: '2d' }, STYLES[name]);
}

export const TW = 88; // tile width on screen
export const TH = 44; // tile height on screen
export const iso = (x, y) => ({ X: ((x - y) * TW) / 2, Y: ((x + y) * TH) / 2 });

const f = (n) => Math.round(n * 10) / 10;

// A wobbly line through points, like a pen stroke.
export function sk(pts, r, amt = 0.8, closed = false) {
  let d = '';
  pts.forEach(([x, y], i) => {
    const a = amt * STYLE.rough;
    d += (i ? 'L' : 'M') + f(x + (r() - 0.5) * a * 2) + ' ' + f(y + (r() - 0.5) * a * 2);
  });
  return closed ? d + 'Z' : d;
}

export function diamond(X, Y, cls, inset = 0) {
  const w = TW / 2 - inset, h = TH / 2 - inset / 2;
  return `<path class="${cls}" d="M${f(X)} ${f(Y - h)}L${f(X + w)} ${f(Y)}L${f(X)} ${f(Y + h)}L${f(X - w)} ${f(Y)}Z"/>`;
}

// ---------------------------------------------------------------- scenery

const PINE = [[0, -30], [-7, -18], [-3, -18], [-10, -7], [-4, -7], [-12, 4], [12, 4], [4, -7], [10, -7], [3, -18], [7, -18]];
const PINE_SHADE = [[0, -30], [7, -18], [3, -18], [10, -7], [4, -7], [12, 4], [1, 4]];

export function pine(X, Y, k, r) {
  if (STYLE.tree === 'round') return roundTree(X, Y, k);
  const at = (pts) => pts.map(([a, b]) => [X + a * k, Y + b * k]);
  return (
    `<path class="o trunk-line" d="M${f(X)} ${f(Y + 3 * k)}V${f(Y + 8 * k)}"/>` +
    `<path class="w tree" d="${sk(at(PINE), r, 0.6 * k, true)}"/>` +
    `<path class="h" d="${sk(at(PINE_SHADE), r, 0.5 * k, true)}"/>`
  );
}

// Cozy style: a soft round tree, lit from the top left, with a cel-shaded right side.
function roundTree(X, Y, k) {
  const R = 11 * k, cy = Y - 14 * k;
  return (
    `<ellipse class="obj-shadow" cx="${f(X + 5 * k)}" cy="${f(Y + 3 * k)}" rx="${f(13 * k)}" ry="${f(4.5 * k)}"/>` +
    `<path class="trunk" d="M${f(X - 2.2 * k)} ${f(Y + 3 * k)}h${f(4.4 * k)}v${f(-10 * k)}h${f(-4.4 * k)}z"/>` +
    `<circle class="w tree" cx="${f(X)}" cy="${f(cy)}" r="${f(R)}"/>` +
    `<path class="h" d="M${f(X)} ${f(cy - R)}A${f(R)} ${f(R)} 0 0 1 ${f(X)} ${f(cy + R)}A${f(R * 0.55)} ${f(R)} 0 0 0 ${f(X)} ${f(cy - R)}Z"/>` +
    `<circle class="hi" cx="${f(X - R * 0.38)}" cy="${f(cy - R * 0.38)}" r="${f(R * 0.3)}"/>`
  );
}

export function mountain(X, Y, k, r) {
  const peak = [X + (r() - 0.5) * 16 * k, Y - 64 * k];
  const L = [X - 50 * k, Y + 12 * k], R = [X + 50 * k, Y + 12 * k];
  const shoulder = [X - 28 * k, Y - 20 * k + r() * 10 * k];
  const mid = [peak[0] + 6 * k + r() * 8 * k, Y - 26 * k];
  const foot = [X + 12 * k, Y + 12 * k];
  let s = `<path class="w mtn" d="${sk([L, shoulder, peak, R], r, 1, true)}"/>`;
  s += `<path class="h" d="${sk([peak, mid, foot, R], r, 0.8, true)}"/>`;
  s += `<path class="o" d="${sk([L, shoulder, peak, R], r, 1.2)}"/>`;
  s += `<path class="o" d="${sk([peak, mid, foot], r, 1.4)}"/>`;
  // loose pen strokes on the lit side, as in the reference
  const strokes = STYLE.name === 'sketch' ? 7 : 3;
  for (let i = 0; i < strokes; i++) {
    const t = 0.3 + (i * 0.55) / strokes;
    const ax = peak[0] + (L[0] - peak[0]) * t + 8 * k, ay = peak[1] + (L[1] - peak[1]) * t + 2 * k;
    s += `<path class="o thin pen-hatch" d="M${f(ax)} ${f(ay)}l${f((7 + r() * 5) * k)} ${f((6 + r() * 3) * k)}"/>`;
  }
  return `<ellipse class="obj-shadow" cx="${f(X + 10 * k)}" cy="${f(Y + 12 * k)}" rx="${f(52 * k)}" ry="${f(12 * k)}"/>` + s;
}

export function hut(X, Y, k, r) {
  return (
    `<ellipse class="obj-shadow" cx="${f(X + 4 * k)}" cy="${f(Y + 2 * k)}" rx="${f(12 * k)}" ry="${f(4 * k)}"/>` +
    `<path class="w wall" d="${sk([[X - 7 * k, Y], [X - 7 * k, Y - 11 * k], [X + 7 * k, Y - 11 * k], [X + 7 * k, Y]], r, 0.5, true)}"/>` +
    `<path class="h" d="${sk([[X + 2 * k, Y], [X + 2 * k, Y - 10 * k], [X + 7 * k, Y - 10 * k], [X + 7 * k, Y]], r, 0.3, true)}"/>` +
    `<path class="w roof" d="${sk([[X - 12 * k, Y - 9 * k], [X, Y - 26 * k], [X + 12 * k, Y - 9 * k]], r, 0.6, true)}"/>` +
    `<path class="h" d="${sk([[X, Y - 25 * k], [X + 11 * k, Y - 9.5 * k], [X + 1 * k, Y - 9.5 * k]], r, 0.4, true)}"/>` +
    `<path class="k" d="M${f(X - 2 * k)} ${f(Y)}v${f(-6 * k)}h${f(4 * k)}v${f(6 * k)}z"/>`
  );
}

export const grass = (X, Y) => `<path class="o thin" d="M${f(X - 2)} ${f(Y)}l-1 -5M${f(X + 1)} ${f(Y)}l1 -5"/>`;

// A little grazing sheep: the traveller drawn small, facing either way.
export const sheep = (X, Y, flip = false) =>
  `<g class="mini" transform="translate(${f(X)} ${f(Y)}) scale(${flip ? -0.42 : 0.42} 0.42)">${SHEEP}</g>`;

// ---------------------------------------------------------------- buildings (origin = bottom centre)

function merlons(x0, x1, y, r) {
  let s = '';
  for (let x = x0; x + 4 <= x1 + 0.1; x += 7) s += `<path class="w" d="${sk([[x, y], [x, y - 5], [x + 4, y - 5], [x + 4, y]], r, 0.3, true)}"/>`;
  return s;
}

export const BUILDINGS = {
  camp(X, Y, r) {
    const p = (a, b) => [X + a, Y + b];
    return (
      `<path class="o" d="M${X} ${Y - 30}V${Y - 46}"/>` +
      `<path class="y" d="${sk([p(0, -46), p(14, -42), p(0, -37)], r, 0.5, true)}"/>` +
      `<path class="w" d="${sk([p(-22, 0), p(0, -32), p(22, 0)], r, 0.8, true)}"/>` +
      `<path class="h" d="${sk([p(1, -31), p(21, 0), p(7, 0)], r, 0.5, true)}"/>` +
      `<path class="k" d="${sk([p(-6, 0), p(0, -15), p(6, 0)], r, 0.4, true)}"/>` +
      `<path class="o" d="M${X + 22} ${Y + 4}l12 -5M${X + 23} ${Y - 2}l11 5"/>` +
      `<path class="y" d="M${X + 28} ${Y - 1}q-5-6 0-12q1 5 4 6q2 4-4 6z"/>`
    );
  },
  tannery(X, Y, r) {
    const p = (a, b) => [X + a, Y + b];
    return (
      `<path class="w" d="${sk([p(-4, -40), p(-4, -52), p(2, -52), p(2, -40)], r, 0.3, true)}"/>` +
      `<path class="o thin" d="M${X - 1} ${Y - 55}q-4-5 1-9q5-4 0-9"/>` +
      `<path class="w" d="${sk([p(-28, 0), p(-28, -24), p(6, -24), p(6, 0)], r, 0.7, true)}"/>` +
      `<path class="h" d="${sk([p(-3, 0), p(-3, -23), p(5, -23), p(5, 0)], r, 0.4, true)}"/>` +
      `<path class="g" d="${sk([p(-32, -22), p(-11, -44), p(10, -22)], r, 0.8, true)}"/>` +
      `<path class="w" d="${sk([p(-15, 0), p(-15, -12), p(-7, -12), p(-7, 0)], r, 0.4, true)}"/>` +
      `<path class="k" d="M${X - 25} ${Y - 17}h6v5h-6z"/>` +
      `<path class="o" d="M${X + 12} ${Y + 2}V${Y - 26}M${X + 38} ${Y + 2}V${Y - 26}M${X + 9} ${Y - 24}H${X + 41}"/>` +
      `<path class="tan" d="${sk([p(15, -24), p(14, -10), p(19, -6), p(24, -10), p(23, -24)], r, 0.6, true)}"/>` +
      `<path class="tan" d="${sk([p(27, -24), p(26, -12), p(31, -9), p(36, -13), p(35, -24)], r, 0.6, true)}"/>`
    );
  },
  mill(X, Y, r) {
    const p = (a, b) => [X + a, Y + b];
    const hub = [X, Y - 44];
    let blades = '';
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + 0.45;
      const ux = Math.cos(a), uy = Math.sin(a), nx = -uy * 5, ny = ux * 5;
      const p1 = [hub[0] + ux * 6, hub[1] + uy * 6], p2 = [hub[0] + ux * 34, hub[1] + uy * 34];
      blades += `<path class="w" d="${sk([p1, p2, [p2[0] + nx, p2[1] + ny], [p1[0] + nx, p1[1] + ny]], r, 0.4, true)}"/>`;
      blades += `<path class="o thin" d="M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}"/>`;
    }
    return (
      `<path class="w" d="${sk([p(-13, 0), p(-8, -40), p(8, -40), p(13, 0)], r, 0.6, true)}"/>` +
      `<path class="h" d="${sk([p(2, 0), p(2, -39), p(7, -39), p(12, 0)], r, 0.4, true)}"/>` +
      `<path class="g" d="${sk([p(-11, -39), p(0, -52), p(11, -39)], r, 0.5, true)}"/>` +
      `<path class="w" d="${sk([p(-4, 0), p(-4, -10), p(4, -10), p(4, 0)], r, 0.3, true)}"/>` +
      blades +
      `<circle class="k" cx="${hub[0]}" cy="${hub[1]}" r="3"/>`
    );
  },
  market(X, Y, r) {
    let s = '';
    for (const dx of [-18, 18]) {
      const x = X + dx, y = Y + (dx > 0 ? 6 : -4);
      s +=
        `<path class="o" d="M${x - 12} ${y}V${y - 20}M${x + 12} ${y}V${y - 20}"/>` +
        `<path class="w" d="${sk([[x - 14, y], [x - 14, y - 9], [x + 14, y - 9], [x + 14, y]], r, 0.5, true)}"/>` +
        `<path class="y" d="${sk([[x - 16, y - 18], [x + 16, y - 18], [x + 13, y - 28], [x - 13, y - 28]], r, 0.5, true)}"/>` +
        `<path class="o thin" d="M${x - 5} ${y - 18}l1 -10M${x + 5} ${y - 18}l-1 -10"/>` +
        `<circle class="w" cx="${x - 6}" cy="${y - 11}" r="3"/><circle class="w" cx="${x + 1}" cy="${y - 11}" r="3"/><circle class="tan" cx="${x + 8}" cy="${y - 11}" r="3"/>`;
    }
    return s;
  },
  chapel(X, Y, r) {
    const p = (a, b) => [X + a, Y + b];
    return (
      `<path class="w" d="${sk([p(-20, 0), p(-20, -24), p(16, -24), p(16, 0)], r, 0.6, true)}"/>` +
      `<path class="h" d="${sk([p(7, 0), p(7, -23), p(15, -23), p(15, 0)], r, 0.4, true)}"/>` +
      `<path class="g" d="${sk([p(-24, -22), p(-2, -38), p(20, -22)], r, 0.6, true)}"/>` +
      `<path class="w" d="${sk([p(-7, -28), p(-7, -48), p(3, -48), p(3, -28)], r, 0.4, true)}"/>` +
      `<path class="g" d="${sk([p(-9, -47), p(-2, -60), p(5, -47)], r, 0.4, true)}"/>` +
      `<path class="o" d="M${X - 2} ${Y - 60}v-10M${X - 6} ${Y - 66}h8"/>` +
      `<path class="k" d="M${X - 6} ${Y}v-9q4-6 8 0v9z"/>` +
      `<path class="k" d="M${X - 15} ${Y - 16}h4v6h-4zM${X + 8} ${Y - 16}h4v6h-4z"/>`
    );
  },
  tower(X, Y, r) {
    const p = (a, b) => [X + a, Y + b];
    return (
      `<path class="o" d="M${X + 4} ${Y - 62}V${Y - 88}"/>` +
      `<path class="g" d="${sk([p(4, -88), p(20, -84), p(13, -80), p(4, -77)], r, 0.5, true)}"/>` +
      `<path class="w" d="${sk([p(-13, 2), p(-11, -58), p(11, -58), p(13, 2)], r, 0.7, true)}"/>` +
      `<path class="h" d="${sk([p(3, 2), p(3, -57), p(10, -57), p(12, 2)], r, 0.4, true)}"/>` +
      `<path class="w" d="${sk([p(-15, -56), p(-15, -62), p(15, -62), p(15, -56)], r, 0.4, true)}"/>` +
      merlons(X - 15, X + 15, Y - 62, r) +
      `<path class="k" d="M${X - 2} ${Y - 40}h4v9h-4z"/>` +
      `<path class="o thin" d="M${X - 22} ${Y + 4}q6-6 10-2M${X + 12} ${Y + 2}q6-5 12 0"/>`
    );
  },
  castle(X, Y, r) {
    const p = (a, b) => [X + a, Y + b];
    return (
      `<path class="o" d="M${X} ${Y - 56}V${Y - 82}"/>` +
      `<path class="y" d="M${X} ${Y - 82}q10-4 20 1q-6 4 0 9q-10-4-20 0z"/>` +
      `<path class="w" d="${sk([p(-10, -30), p(-10, -52), p(10, -52), p(10, -30)], r, 0.5, true)}"/>` +
      merlons(X - 10, X + 10, Y - 52, r) +
      `<path class="w" d="${sk([p(-34, 0), p(-34, -42), p(-18, -42), p(-18, 0)], r, 0.6, true)}"/>` +
      merlons(X - 34, X - 18, Y - 42, r) +
      `<path class="w" d="${sk([p(18, 0), p(18, -42), p(34, -42), p(34, 0)], r, 0.6, true)}"/>` +
      `<path class="h" d="${sk([p(26, 0), p(26, -41), p(33, -41), p(33, 0)], r, 0.4, true)}"/>` +
      merlons(X + 18, X + 34, Y - 42, r) +
      `<path class="w" d="${sk([p(-18, 0), p(-18, -28), p(18, -28), p(18, 0)], r, 0.6, true)}"/>` +
      merlons(X - 18, X + 18, Y - 28, r) +
      `<path class="k" d="M${X - 7} ${Y}v-11q7-10 14 0v11z"/>` +
      `<path class="k" d="M${X - 28} ${Y - 30}h3v7h-3zM${X + 25} ${Y - 30}h3v7h-3z"/>`
    );
  },
};

// ---------------------------------------------------------------- the traveller

// The sheep, side view facing right, feet at (0,0): cream wool, dark face and legs.
const SHEEP = `
  <path class="leg far" d="M-17 -16h4.5v15h-4.5zM6 -16h4.5v15h-4.5z"/>
  <path class="wool" d="M-22 -14Q-29 -15 -28 -22Q-33 -28 -27 -34Q-29 -42 -20 -43Q-15 -49 -7 -45Q-1 -49 5 -45Q12 -48 16 -42Q22 -40 20 -33Q24 -26 19 -20Q20 -12 12 -13Q6 -9 0 -13Q-6 -9 -11 -13Q-17 -9 -22 -14Z"/>
  <path class="h" d="M-23 -16Q-12 -19 0 -17Q12 -18 19 -21Q20 -13 12 -13Q6 -9 0 -13Q-6 -9 -11 -13Q-17 -9 -22 -14Z"/>
  <path class="o thin fleece" d="M-20 -34q2 3 0 6t0 6M-11 -38q2 3 0 6t0 6t0 6M-2 -39q2 3 0 6t0 6t0 6M7 -37q2 3 0 6t0 6"/>
  <path class="leg" d="M-12 -15h4.5v16h-4.5zM11 -15h4.5v16h-4.5z"/>
  <path class="y" d="M11 -37Q17 -35 21 -28L17 -25Q14 -31 9 -33Z"/>
  <path class="y" d="M17 -26L15 -17L20 -19L19 -26Z"/>
  <path class="face" d="M15 -40Q19 -48 26 -45Q34 -42 35 -34Q35 -27 29 -27Q21 -27 16 -31Z"/>
  <path class="face" d="M19 -43Q12 -50 8 -46Q12 -41 18 -40Z"/>
  <path class="wool" d="M16 -42Q18 -50 25 -46Q22 -43 17 -40Z"/>
  <circle cx="27.5" cy="-38" r="2" fill="#fff"/><circle cx="28.2" cy="-38" r="1" class="k"/>`;

export const CREATURE = `
<ellipse class="shadow" cx="0" cy="1" rx="28" ry="7"/>
<g class="bob">${SHEEP}</g>`;

export const creatureSvg = (size) =>
  `<svg class="creature-svg" width="${size}" height="${size}" viewBox="-38 -56 78 62">${CREATURE}</svg>`;

// A wooden footbridge centred on (X, Y), running along screen direction (ux, uy).
export function bridge(X, Y, ux, uy, r) {
  const L = Math.hypot(ux, uy);
  ux /= L; uy /= L;
  // the other iso axis, so the deck sits flat on the grid
  const vx = -ux, vy = uy;
  const a = 34, b = 12, lift = -4;
  const P = (s, t, h = 0) => [X + ux * s + vx * t, Y + uy * s + vy * t + lift + h];
  const back = vy * b < 0 ? b : -b; // the rail further up the screen is drawn first
  const rail = (t) =>
    `<path class="o" d="${sk([P(-a, t, -9), P(a, t, -9)], r, 0.6)}"/>` +
    [-a, -a / 3, a / 3, a].map((s) => `<path class="o" d="${sk([P(s, t), P(s, t, -10)], r, 0.3)}"/>`).join('');
  let planks = '';
  for (let s = -a + 6; s < a; s += 7) planks += `<path class="o thin" d="${sk([P(s, -b), P(s, b)], r, 0.3)}"/>`;
  return (
    rail(back) +
    `<path class="plank" d="${sk([P(-a, -b), P(a, -b), P(a, b), P(-a, b)], r, 0.6, true)}"/>` +
    planks +
    rail(-back)
  );
}

// ---------------------------------------------------------------- category icons + speech bubbles

const star = (() => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? 4.2 : 9.5;
    d += (i ? 'L' : 'M') + f(12 + Math.cos(a) * rad) + ' ' + f(13 + Math.sin(a) * rad);
  }
  return d + 'Z';
})();

export const ICONS = {
  savings:
    '<path class="k" d="M5 8v9a7 2.8 0 0 0 14 0V8z"/><ellipse class="k" cx="12" cy="8" rx="7" ry="2.8"/>' +
    '<path d="M5 11.5a7 2.8 0 0 0 14 0M5 14.5a7 2.8 0 0 0 14 0" fill="none" stroke="#fff" stroke-width="1.1"/>' +
    '<ellipse cx="12" cy="8" rx="4.5" ry="1.4" fill="none" stroke="#fff" stroke-width="1"/>',
  tithe: '<path class="k" d="M12 20.5C4 14.5 3 9.5 5.8 6.8C8.3 4.5 11 5.5 12 8.2C13 5.5 15.7 4.5 18.2 6.8C21 9.5 20 14.5 12 20.5Z"/>',
  initiatives: `<path class="k" d="${star}"/>`,
};

export const iconSvg = (cat, size = 28) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[cat]}</svg>`;

// Speech bubble whose tail points at (X, Y), like the ones in the reference art.
export function bubble(cat, X, Y, R = 15) {
  const cy = Y - R - 9;
  const s = (R * 1.35) / 24;
  return (
    `<path class="bub ${cat}" d="M${f(X - 7)} ${f(cy + R - 4)}L${f(X - 1)} ${f(Y)}L${f(X + 6)} ${f(cy + R - 2)}Z"/>` +
    `<circle class="bub ${cat}" cx="${f(X)}" cy="${f(cy)}" r="${R}"/>` +
    `<g transform="translate(${f(X - 12 * s)} ${f(cy - 12 * s)}) scale(${f(s * 100) / 100})">${ICONS[cat]}</g>`
  );
}

// Bubble-shaped button face for the UI (HTML), matching the map bubbles.
export const bubbleButtonSvg = (cat, size = 58) =>
  `<svg width="${size}" height="${size}" viewBox="-30 -58 60 62" aria-hidden="true"><g class="bubble-art">${bubble(cat, 0, 0, 24)}</g></svg>`;

// Pixel filter: samples one point in every 3x3 block and blows it up into a chunky pixel.
// The sampling grid starts at (x, y), which must lie inside whatever the filter is applied to.
export const pixelFilter = (id, x, y) => `<filter id="${id}" x="-2%" y="-2%" width="104%" height="104%">
  <feFlood x="${x + 1}" y="${y + 1}" width="1" height="1"/>
  <feComposite x="${x}" y="${y}" width="3" height="3"/>
  <feTile result="grid"/>
  <feComposite in="SourceGraphic" in2="grid" operator="in"/>
  <feMorphology operator="dilate" radius="1"/>
</filter>`;

// Patterns and filters, added once to the page so the map and the style previews share them.
export const MAP_DEFS = `
<pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
  <rect width="4" height="4" class="hatch-bg"/><path d="M0 0V4" class="hatch-line"/>
</pattern>
<pattern id="hatch-clear" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
  <path d="M0 0V5" class="hatch-line"/>
</pattern>
<pattern id="dots-clear" width="6" height="6" patternUnits="userSpaceOnUse">
  <rect width="3" height="3" class="dots-fg"/>
</pattern>
<pattern id="halftone" width="6" height="6" patternUnits="userSpaceOnUse">
  <rect width="6" height="6" class="dots-bg"/><rect width="3" height="3" class="dots-fg"/>
</pattern>
<pattern id="grid" width="${TW}" height="${TH}" patternUnits="userSpaceOnUse" x="${-TW / 2}" y="${-TH / 2}">
  <path d="M${TW / 2} 0L${TW} ${TH / 2}L${TW / 2} ${TH}L0 ${TH / 2}Z" class="grid-line"/>
</pattern>
<pattern id="bgdots" width="12" height="12" patternUnits="userSpaceOnUse">
  <rect width="12" height="12" class="ground-a"/>
  <rect width="3" height="3" class="ground-b"/><rect x="6" y="6" width="3" height="3" class="ground-b"/>
  <rect x="6" width="3" height="3" class="ground-c"/>
</pattern>
<filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7"/>
  <feDisplacementMap in="SourceGraphic" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
</filter>
${pixelFilter('pixelate', 0, 0)}
${pixelFilter('pixelate-bub', 0, -30)}
${pixelFilter('pixelate-ico', 12, 12)}`;

export function installDefs() {
  if (document.getElementById('mattar-defs')) return;
  const holder = document.createElement('div');
  holder.innerHTML = `<svg id="mattar-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${MAP_DEFS}</defs></svg>`;
  document.body.prepend(holder.firstElementChild);
}

// A tiny scene for the style picker: a tree, a hut, a mountain and the sheep.
export function stylePreview(name) {
  const saved = STYLE.name;
  setArtStyle(name);
  const r = (() => {
    let a = 7;
    return () => ((a = (a * 16807) % 2147483647) / 2147483647);
  })();
  const scene =
    `<rect x="-90" y="-80" width="180" height="110" class="ground-base"/><rect x="-90" y="-80" width="180" height="110" class="ground-tex"/>` +
    mountain(-52, -18, 0.6, r) + pine(-62, 10, 0.9, r) + pine(-44, 16, 0.8, r) + hut(54, -4, 1, r) + hut(68, 8, 0.9, r) +
    `<g transform="translate(6 16)">${CREATURE}</g>`;
  const filter = STYLE.filter ? ` filter="url(#${STYLE.filter})"` : '';
  setArtStyle(saved);
  return `<svg viewBox="-90 -80 180 110" class="style-preview-svg"><g${filter}>${scene}</g></svg>`;
}
