import { TW, TH, iso, diamond, pine, mountain, hut, grass, sheep, bridge, CREATURE, installDefs, bubble } from './art.js';
import { sleep } from './util.js';
import { drawStop2D } from './stops.js';
import { World } from './world.js';

const STEP_MS = 420;
const SVG = 'http://www.w3.org/2000/svg';

// The scrolling isometric map. The traveller stands on tile `pos` of the road.
//
// Built for phones: the world is drawn once into its own picture layer, and dragging or walking
// only slides layers around (the graphics chip does that), instead of redrawing every
// hand-drawn shape on every frame. The world is only redrawn when you scroll past its edge.
export class JourneyMap extends World {
  constructor(el) {
    super();
    this.kind = '2d';
    this.el = el;
    installDefs();
    el.innerHTML = `<div class="map-layer">
        <svg class="map-svg world-svg" xmlns="${SVG}"><g class="world"></g><g class="labels"></g></svg>
        <svg class="map-svg char-svg" xmlns="${SVG}" width="1" height="1"><g filter="url(#rough)"><g class="flip">${CREATURE}</g></g></svg>
        <svg class="map-svg fx-svg" xmlns="${SVG}" width="1" height="1"></svg>
      </div>`;
    this.layer = el.querySelector('.map-layer');
    this.worldSvg = el.querySelector('.world-svg');
    this.worldG = el.querySelector('.world');
    this.labelsG = el.querySelector('.labels');
    this.charSvg = el.querySelector('.char-svg');
    this.flipG = el.querySelector('.flip');
    this.fxSvg = el.querySelector('.fx-svg');
    this.cam = { X: 0, Y: 0 };
    this.onPan = null;
    this.onStepTap = null;
    this.bindPan();
    this.onResize = () => this.render();
    window.addEventListener('resize', this.onResize);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
  }

  restyle(redraw = true) {
    if (redraw && this.path.length) this.render();
  }

  select(i) {
    this.selected = i;
    this.render();
  }

  jumpTo(pos) {
    this.pos = pos;
    this.placeChar(false);
    this.render();
  }

  // Walk one tile at a time to `pos`, popping a bubble for each new step.
  // The road and footprints are redrawn once at the end, not on every step.
  async walkTo(pos) {
    if (pos <= this.pos) return this.jumpTo(pos);
    while (this.pos < pos) {
      this.pos++;
      this.placeChar(true);
      if (!this.inRendered()) this.render();
      this.pop(this.cats[this.pos - 1]);
      await sleep(STEP_MS);
    }
    this.render();
  }

  recenter() {
    this.placeChar(true);
    if (!this.inRendered()) this.render();
  }

  // ------------------------------------------------------------ helpers

  placeChar(smooth) {
    const p = this.pathAt(this.pos);
    const { X, Y } = iso(p.x, p.y);
    const next = this.pathAt(this.pos + 1);
    this.charSvg.classList.toggle('smooth', smooth);
    this.layer.classList.toggle('smooth', smooth);
    this.charSvg.style.transform = `translate(${X}px, ${Y}px)`;
    this.flipG.setAttribute('transform', next.y > p.y ? 'scale(-1 1)' : '');
    this.cam = { X, Y: Y - 30 };
    this.applyCam();
    this.onPan?.(false);
  }

  // The camera: slide the whole picture layer so (cam.X, cam.Y) sits mid-screen.
  applyCam() {
    const { vw, vh } = this.size();
    this.layer.style.transform = `translate3d(${Math.round(vw / 2 - this.cam.X)}px, ${Math.round(vh / 2 - this.cam.Y)}px, 0)`;
  }

  size() {
    return { vw: this.el.clientWidth || 360, vh: this.el.clientHeight || 640 };
  }

  pop(cat) {
    if (!cat) return;
    const p = this.pathAt(this.pos);
    const { X, Y } = iso(p.x, p.y);
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('transform', `translate(${X + 18} ${Y - 58})`);
    g.innerHTML = `<g class="pop">${bubble(cat, 0, 0, 16)}</g>`;
    this.fxSvg.append(g);
    setTimeout(() => g.remove(), 1600);
  }

  bindPan() {
    let drag = null;
    const el = this.el;
    el.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, X: this.cam.X, Y: this.cam.Y, moved: false };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      this.layer.classList.remove('smooth');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      this.cam = { X: drag.X - dx, Y: drag.Y - dy };
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(() => {
        this.applyCam();
        if (!this.inRendered()) this.render();
      });
    });
    const end = (e) => {
      if (!drag) return;
      if (!drag.moved && e.type === 'pointerup') {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-step]');
        if (hit) this.onStepTap?.(+hit.dataset.step);
      }
      if (drag.moved) {
        this.applyCam();
        if (!this.inRendered()) this.render();
        const p = this.pathAt(this.pos), { X, Y } = iso(p.x, p.y);
        this.onPan?.(Math.hypot(this.cam.X - X, this.cam.Y - Y + 30) > 120);
      }
      drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  inRendered() {
    const r = this.rendered;
    if (!r) return false;
    const { vw, vh } = this.size();
    return this.cam.X - vw / 2 > r.X0 && this.cam.X + vw / 2 < r.X1 && this.cam.Y - vh / 2 > r.Y0 && this.cam.Y + vh / 2 < r.Y1;
  }

  // ------------------------------------------------------------ drawing

  render() {
    this.applyCam();
    const { vw, vh } = this.size();
    // draw a margin past the screen edges, so short drags never need a redraw
    const mx = vw * 0.45, my = vh * 0.45;
    const X0 = this.cam.X - mx - vw / 2, X1 = this.cam.X + mx + vw / 2, Y0 = this.cam.Y - my - vh / 2, Y1 = this.cam.Y + my + vh / 2;
    this.rendered = { X0, X1, Y0, Y1 };
    const dMin = Math.floor(X0 / (TW / 2)) - 2, dMax = Math.ceil(X1 / (TW / 2)) + 2;
    const sMin = Math.floor(Y0 / (TH / 2)) - 2, sMax = Math.ceil(Y1 / (TH / 2)) + 6;

    // the world picture covers exactly the drawn area, placed at its spot on the layer
    const bx = Math.floor(X0 - TW), by = Math.floor(Y0 - TH), bw = Math.ceil(X1 - X0 + 2 * TW), bh = Math.ceil(Y1 - Y0 + 2 * TH);
    Object.assign(this.worldSvg.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
    this.worldSvg.setAttribute('viewBox', `${bx} ${by} ${bw} ${bh}`);

    // Ground: paper grid, the road, footprints coloured by category, the next tile.
    const box = `x="${bx}" y="${by}" width="${bw}" height="${bh}"`;
    let ground = `<rect ${box} class="ground-base"/><rect ${box} fill="url(#grid)"/>`;
    this.labelBuf = '';
    for (const rv of this.rivers) {
      if (rv.s0 < sMin - 12 || rv.s0 > sMax + 12) continue;
      let d = '';
      for (let k = dMin - 2; k <= dMax + 2; k += 0.5) d += (d ? 'L' : 'M') + ((k * TW) / 2).toFixed(1) + ' ' + ((this.riverS(rv, k) * TH) / 2).toFixed(1);
      ground += `<path class="river-bank" d="${d}"/><path class="river-water" d="${d}"/>`;
      ground += `<path class="river-glint" transform="translate(0 -6)" d="${d}"/><path class="river-glint" transform="translate(9 6)" d="${d}"/>`;
    }
    const lo = Math.max(0, sMin), hi = Math.min(this.path.length - 1, sMax, this.endIndex);
    const pts = (a, b) => {
      let d = '';
      for (let i = a; i <= b; i++) {
        const { X, Y } = iso(this.pathAt(i).x, this.pathAt(i).y);
        d += (i === a ? 'M' : 'L') + X + ' ' + Y;
      }
      return d;
    };
    if (hi >= lo) {
      const split = Math.min(Math.max(this.pos, lo), hi);
      ground += `<path class="trail-todo" d="${pts(split, hi)}"/>`;
      if (this.pos > lo) ground += `<path class="trail-done" d="${pts(lo, split)}"/>`;
      for (let i = Math.max(1, lo); i <= Math.min(this.pos, hi); i++) {
        const { X, Y } = iso(this.pathAt(i).x, this.pathAt(i).y);
        ground += `<circle class="step-dot ${this.cats[i - 1] || ''}" cx="${X}" cy="${Y}" r="4.5"/>`;
        if (i === this.selected) ground += `<circle class="step-sel" cx="${X}" cy="${Y}" r="10"/>`;
      }
    }
    if (this.pos < this.endIndex) {
      const n = this.pathAt(this.pos + 1), { X, Y } = iso(n.x, n.y);
      ground += diamond(X, Y, 'next-tile', 6);
    }

    // Objects, back to front.
    let objs = '';
    for (let s = sMin; s <= sMax; s++) {
      for (let d = dMin; d <= dMax; d++) {
        if ((s + d) & 1) continue;
        objs += this.tileArt((s + d) / 2, (s - d) / 2);
      }
    }
    let hits = '';
    for (let i = Math.max(1, lo); i <= Math.min(this.pos, hi); i++) {
      const { X, Y } = iso(this.pathAt(i).x, this.pathAt(i).y);
      hits += `<circle class="step-hit" data-step="${i}" cx="${X}" cy="${Y}" r="16"/>`;
    }
    this.worldG.innerHTML = ground + objs + hits;
    this.labelsG.innerHTML = this.labelBuf;
  }

  tileArt(x, y) {
    const r = this.tileRng(x, y);
    const t = this.describe(x, y, r);
    if (!t) return '';
    const { X, Y } = iso(x, y);
    const at = (u, v) => {
      const o = iso(u, v);
      return [X + o.X, Y + o.Y];
    };
    switch (t.kind) {
      case 'stop': {
        const { stop } = t;
        const ahead = iso(t.dx, t.dy);
        const bx = X + t.side * 62 + ahead.X, by = Y - 4 + ahead.Y;
        // labels live in their own layer so the pixel filter never blurs the text
        this.labelBuf += `<text class="stop-label${stop.reached ? ' reached' : ''}" x="${bx}" y="${by + 26}">${stop.name}</text>`;
        return `<g class="stop${stop.reached ? ' reached' : ''}"><ellipse class="obj-shadow" cx="${bx + 8}" cy="${by + 8}" rx="40" ry="10"/>${drawStop2D(stop.key, bx, by + 6, r)}</g>`;
      }
      case 'bridge': {
        const u = iso(t.dx, t.dy);
        return bridge(X, Y, u.X, u.Y, r);
      }
      case 'flock':
        return t.sheep.map((sh) => sheep(...at(sh.u, sh.v), sh.flip)).join('');
      case 'grass':
        return grass(...at(t.u, t.v));
      case 'forest':
        return t.trees.map((tr) => pine(...at(tr.u, tr.v), tr.k, r)).join('');
      case 'mountain':
        return mountain(X, Y, t.k, r);
      case 'village':
        return t.huts.map((h) => hut(...at(h.u, h.v), h.k, r)).join('');
    }
    return '';
  }
}
