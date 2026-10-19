import { mulberry32, hash2, hashStr, vnoise } from './util.js';

// What stands where on the map. Both the 2D map (map.js) and the 3D map (map3d.js)
// draw from this, so a group's forests, rivers and villages are the same in every look.
// Tiles are (x, y) on the grid; the road's tile i has x + y = i.
// Offsets inside a tile (u, v) run from -0.5 to 0.5 along x and y.
export class World {
  constructor() {
    this.pos = 0;
    this.path = [];
    this.stops = [];
    this.stopAt = new Map();
    this.cats = [];
    this.seed = 1;
    this.rivers = [];
    this.selected = 0;
  }

  set({ seed, path, stops, cats }) {
    this.seed = hashStr(seed);
    this.path = path;
    this.stops = stops;
    this.stopAt = new Map(stops.map((s) => [s.index, s]));
    this.cats = cats;
    this.endIndex = stops.length ? stops[stops.length - 1].index : Infinity; // the road ends here
    this.rivers = this.makeRivers();
  }

  pathAt(i) {
    if (i >= 0 && i < this.path.length) return this.path[i];
    if (i < 0) {
      const x = Math.floor(i / 2);
      return { x, y: i - x };
    }
    const last = this.path[this.path.length - 1] || { x: 0, y: 0 };
    const extra = i - (this.path.length - 1);
    const x = last.x + Math.ceil(extra / 2);
    return { x, y: i - x };
  }

  // Rivers wander across the map and cross the road on a bridge, never right at a stop.
  makeRivers() {
    const r = mulberry32(this.seed ^ 0x5eed);
    const rivers = [];
    for (let s0 = 14 + Math.floor(r() * 8); s0 < this.path.length - 20; s0 += 26 + Math.floor(r() * 14)) {
      const river = { s0, slope: (r() - 0.5) * 0.7, amp: 1 + r() * 1.5, ph: r() * 6.3, ph2: r() * 6.3 };
      let best = null;
      for (let i = s0 - 15; i <= s0 + 15; i++) {
        const p = this.pathAt(i), gap = Math.abs(i - this.riverS(river, p.x - p.y));
        if (i > 0 && (!best || gap < best.gap)) best = { i, gap };
      }
      if (!best || this.stops.some((st) => Math.abs(st.index - best.i) < 5)) continue;
      river.bridge = best.i;
      // shift the river so it passes exactly through the bridge tile
      const p = this.pathAt(best.i);
      river.s0 += best.i - this.riverS(river, p.x - p.y);
      rivers.push(river);
    }
    return rivers;
  }

  // The river's centre line: for each d = x - y, the s = x + y it sits at.
  riverS(rv, d) {
    return rv.s0 + rv.slope * d + rv.amp * Math.sin(d * 0.3 + rv.ph) + 0.6 * Math.sin(d * 0.8 + rv.ph2);
  }

  // How far (in tiles) this tile is from the nearest river's centre line.
  riverDist(x, y) {
    const s = x + y, d = x - y;
    let best = 9;
    for (const rv of this.rivers) {
      if (Math.abs(rv.s0 - s) > 30) continue;
      best = Math.min(best, Math.abs(s - this.riverS(rv, d)));
    }
    return best;
  }

  nearRoad(x, y) {
    const s = x + y;
    for (let k = s - 2; k <= s + 2; k++) {
      const p = this.pathAt(k);
      if (Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1) return true;
    }
    for (const st of this.stops) {
      const p = this.pathAt(st.index === this.endIndex ? st.index + 2 : st.index);
      if (Math.abs(p.x - x) <= 2 && Math.abs(p.y - y) <= 2) return true;
    }
    return false;
  }

  tileRng(x, y) {
    return mulberry32((hash2(x, y, this.seed) * 4294967296) >>> 0);
  }

  // Describe what is on tile (x, y), or null for open ground.
  // `r` is the tile's own random stream; the art functions keep using it afterwards.
  describe(x, y, r) {
    const s = x + y;
    const p = this.pathAt(s);
    if (p.x === x && p.y === y) {
      const stop = s >= 0 && this.stopAt.get(s);
      if (stop) {
        // Stand the building beside the road, on the side the road isn't bending toward.
        const bend = this.pathAt(s - 3).x - this.pathAt(s - 3).y + this.pathAt(s + 3).x - this.pathAt(s + 3).y - 2 * (x - y);
        // the final stop sits where the road leads into it, two tiles past the end
        if (s === this.endIndex) {
          const e = this.pathAt(s + 2);
          return { kind: 'stop', stop, side: 0, dx: e.x - x, dy: e.y - y };
        }
        return { kind: 'stop', stop, side: bend > 0 ? -1 : 1, dx: 0, dy: 0 };
      }
      if (this.riverDist(x, y) > 0.6) return null;
      const n = this.pathAt(s + 1);
      return { kind: 'bridge', dx: n.x - x, dy: n.y - y };
    }

    const h = hash2(x, y, this.seed + 7);
    const wet = this.riverDist(x, y);
    if (wet < 1.15) return null;
    const spot = (spread) => ({ u: (r() - 0.5) * spread, v: (r() - 0.5) * spread });
    const flock = () => {
      const n = 1 + Math.floor(r() * 3);
      const sheep = [];
      for (let i = 0; i < n; i++) sheep.push({ ...spot(0.6), flip: r() < 0.5 });
      return { kind: 'flock', sheep: sheep.sort((a, b) => a.u + a.v - (b.u + b.v)) };
    };
    if (this.nearRoad(x, y) || wet < 2) {
      if (h < 0.07) return flock();
      if (h < 0.4) return { kind: 'grass', ...spot(0.5) };
      return null;
    }

    const n = vnoise(x / 5, y / 5, this.seed);
    const v = vnoise(x / 3 + 40, y / 3 - 40, this.seed + 3);
    if (n < 0.4) {
      const count = 3 + Math.floor(r() * 2);
      const trees = [];
      for (let i = 0; i < count; i++) trees.push({ ...spot(0.84), k: 0.8 + r() * 0.35 });
      return { kind: 'forest', trees: trees.sort((a, b) => a.u + a.v - (b.u + b.v)) };
    }
    if (n > 0.68) return h < 0.7 ? { kind: 'mountain', k: 0.75 + r() * 0.5 } : null;
    if (v > 0.64) {
      const count = 4 + Math.floor(r() * 3);
      const huts = [];
      for (let i = 0; i < count; i++) huts.push({ ...spot(0.66), k: 0.8 + r() * 0.35 });
      return { kind: 'village', huts: huts.sort((a, b) => a.u + a.v - (b.u + b.v)) };
    }
    if (h < 0.09) return flock();
    if (h < 0.3) return { kind: 'grass', ...spot(0.5) };
    return null;
  }
}
