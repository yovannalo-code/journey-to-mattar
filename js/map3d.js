import { World } from './world.js';
import { bubbleButtonSvg } from './art.js';
import { buildStop3D } from './stops.js';
import { sleep } from './util.js';

// The Cozy 3D map: the same journey as the 2D map, built as a little toy world with Three.js.
// It has the same methods as JourneyMap (set, jumpTo, walkTo, recenter, select, restyle, destroy),
// so the journey screen can use either one.

const THREE_URLS = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
];
let threePromise = null;
function loadThree() {
  threePromise ??= import(THREE_URLS[0]).catch(() => import(THREE_URLS[1]));
  return threePromise;
}

const STEP_MS = 420;
const PX_PER_UNIT = 66; // how big one tile looks on screen
const VIEW = { d: 9, s: 22 }; // how many tiles around the camera get built
const ELEV_SIN = 0.647; // sin of the camera's tilt, for turning screen drags into ground moves

// Pastel palette, after Cozy Island.
const C = {
  grassA: '#a9d38a', grassB: '#a0cc81', road: '#efd39c', roadAhead: '#cfe3b4',
  trunk: '#b98a62', leaves: ['#86c487', '#7dbd80', '#95cd8b', '#a6d48c'],
  rock: '#cdd2dc', snow: '#fbfbff', wall: '#fff4e3', roofs: ['#ef9a82', '#f2b880', '#9cc7ec', '#f2a0a8'],
  water: '#8fd0d4', bank: '#e7f3d8', wood: '#d9b088', woodDark: '#b98a62',
  wool: '#fffaf0', face: '#6b5a50', yellow: '#f6cf6a', coral: '#ef9a82', blue: '#9cc7ec', grassTuft: '#8cc479',
  stone: '#e9e2d6', dark: '#6b5a50', hide: '#f0cf9f',
  savings: '#f6cf6a', tithe: '#ef9a82', initiatives: '#9cc7ec',
};

export class Map3D extends World {
  constructor(el) {
    super();
    this.kind = '3d';
    this.el = el;
    this.onPan = null;
    this.onStepTap = null;
    this.follow = true;
    this.alive = true;
    this.anim = null;
    el.innerHTML = `<div class="map3d-loading">Building the 3D world…</div>`;
    this.ready = loadThree()
      .then((THREE) => {
        if (!this.alive) return;
        this.T = THREE;
        this.init();
      })
      .catch(() => {
        el.innerHTML = `<div class="map3d-loading">The 3D world couldn't load. Check your connection, or pick another look with the palette button.</div>`;
      });
  }

  // ------------------------------------------------------------ public API (same as JourneyMap)

  set(data) {
    super.set(data);
    this.ready.then(() => this.T && this.rebuild(true));
  }

  jumpTo(pos) {
    this.pos = pos;
    this.ready.then(() => {
      if (!this.T) return;
      this.anim = null;
      this.placeSheep();
      this.follow = true;
      this.target.copy(this.sheep.position);
      this.rebuild(true);
    });
  }

  async walkTo(pos) {
    await this.ready;
    if (!this.T) return;
    if (pos <= this.pos) return this.jumpTo(pos);
    this.follow = true;
    this.onPan?.(false);
    while (this.pos < pos && this.alive) {
      const from = this.tilePos(this.pos);
      this.pos++;
      this.anim = { from, to: this.tilePos(this.pos), start: performance.now() };
      this.faceToward(this.pos);
      this.buildRoad();
      this.pop(this.cats[this.pos - 1]);
      await sleep(STEP_MS);
    }
    this.anim = null;
    this.placeSheep();
    this.rebuild();
  }

  recenter() {
    this.follow = true;
    this.onPan?.(false);
  }

  select(i) {
    this.selected = i;
    if (this.T) this.buildRoad();
  }

  restyle() {}

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.renderer?.dispose();
  }

  // ------------------------------------------------------------ setup

  init() {
    const T = this.T;
    this.el.innerHTML = '';
    const renderer = (this.renderer = new T.WebGLRenderer({ antialias: true }));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.className = 'map3d-canvas';
    this.el.append(renderer.domElement);
    this.overlay = document.createElement('div');
    this.overlay.className = 'map3d-overlay';
    this.el.append(this.overlay);

    const scene = (this.scene = new T.Scene());
    scene.background = new T.Color(C.grassA);

    // fixed isometric angle; +x runs down-right on screen, +z (the grid's y) down-left
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.camOffset = new T.Vector3(14, 16.8, 14);
    this.target = new T.Vector3();

    scene.add(new T.HemisphereLight('#fff6e8', '#8fb879', 0.75));
    const sun = (this.sun = new T.DirectionalLight('#fff0d6', 2.1));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.sunOffset = new T.Vector3(-9, 16, -1);
    scene.add(sun, sun.target);

    // three-step toon shading: lit, mid, shade
    const ramp = new T.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, T.RedFormat);
    ramp.minFilter = ramp.magFilter = T.NearestFilter;
    ramp.needsUpdate = true;
    this.ramp = ramp;
    this.mats = new Map();

    this.geo = {
      ball: new T.IcosahedronGeometry(1, 3),
      cyl: new T.CylinderGeometry(1, 1, 1, 12),
      cone: new T.ConeGeometry(1, 1, 9),
      cone4: new T.ConeGeometry(1, 1, 4),
      box: new T.BoxGeometry(1, 1, 1),
      disc: new T.CylinderGeometry(1, 1, 1, 20),
    };

    this.addGround();
    this.layers = { scenery: new T.Group(), road: new T.Group(), stops: new T.Group() };
    for (const g of Object.values(this.layers)) scene.add(g);

    this.sheep = this.makeSheep(2.3, true);
    scene.add(this.sheep);

    const ring = new T.Mesh(new T.TorusGeometry(0.3, 0.035, 8, 32), this.mat(C.dark));
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    this.selRing = ring;
    scene.add(ring);

    this.nextMarker = this.makeNextMarker();
    scene.add(this.nextMarker);

    this.raycaster = new T.Raycaster();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.bindPan();
    this.placeSheep();
    this.target.copy(this.sheep.position);
    if (this.path.length) this.rebuild(true);
    const loop = (t) => {
      if (!this.alive) return;
      this.tick(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  mat(color) {
    if (!this.mats.has(color)) this.mats.set(color, new this.T.MeshToonMaterial({ color, gradientMap: this.ramp }));
    return this.mats.get(color);
  }

  addGround() {
    const T = this.T;
    // a soft two-tone checker, one square per tile, like a garden lawn
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const g = c.getContext('2d');
    g.fillStyle = C.grassA;
    g.fillRect(0, 0, 2, 2);
    g.fillStyle = C.grassB;
    g.fillRect(0, 0, 1, 1);
    g.fillRect(1, 1, 1, 1);
    const tex = new T.CanvasTexture(c);
    tex.magFilter = tex.minFilter = T.NearestFilter;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = T.SRGBColorSpace;
    const N = 1600;
    tex.repeat.set(N / 2, N / 2);
    const ground = new T.Mesh(new T.PlaneGeometry(N, N), new T.MeshToonMaterial({ map: tex, gradientMap: this.ramp }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(300.5, 0, 300.5); // edges on half-tiles so squares sit under tiles
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  resize() {
    const w = this.el.clientWidth || 360, h = this.el.clientHeight || 640;
    this.renderer.setSize(w, h, false);
    const hw = w / 2 / PX_PER_UNIT, hh = h / 2 / PX_PER_UNIT;
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
  }

  // grid tile (x, y) → 3D point; the grid's y is 3D z
  tilePos(i) {
    const p = this.pathAt(i);
    return new this.T.Vector3(p.x, 0, p.y);
  }

  placeSheep() {
    this.sheep.position.copy(this.tilePos(this.pos));
    this.faceToward(this.pos);
  }

  faceToward(i) {
    const a = this.pathAt(i), b = this.pathAt(i + 1);
    // the sheep's nose points along local +x
    this.sheep.rotation.y = b.x > a.x ? 0 : -Math.PI / 2;
  }

  // ------------------------------------------------------------ frame loop

  tick(t) {
    const T = this.T;
    if (this.anim) {
      const k = Math.min(1, (t - this.anim.start) / (STEP_MS * 0.85));
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.sheep.position.lerpVectors(this.anim.from, this.anim.to, e);
      this.sheep.position.y = Math.sin(k * Math.PI) * 0.28;
    } else {
      this.sheep.position.y = Math.abs(Math.sin(t / 420)) * 0.03;
    }
    if (this.follow) this.target.lerp(new T.Vector3(this.sheep.position.x, 0, this.sheep.position.z), 0.12);
    this.camera.position.copy(this.target).add(this.camOffset);
    this.camera.lookAt(this.target);
    this.sun.position.copy(this.target).add(this.sunOffset);
    this.sun.target.position.copy(this.target);

    for (const blade of this.spinners || []) blade.rotation.x = t / 900;
    this.nextMarker.position.y = 0.06 + Math.sin(t / 300) * 0.03;
    this.nextMarker.rotation.y = Math.sin(t / 900) * 0.08;

    // rebuild scenery when the camera drifts away from what was built
    const c = this.builtAt;
    if (c && Math.hypot(this.target.x - c.x, this.target.z - c.z) > 5) this.rebuild();

    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  }

  // screen position of a 3D point
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.el.clientWidth, y: ((1 - p.y) / 2) * this.el.clientHeight };
  }

  placeLabels() {
    for (const lab of this.labels || []) {
      const { x, y } = this.toScreen(lab.at);
      lab.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, 0)`;
    }
  }

  pop(cat) {
    if (!cat) return;
    const wrap = document.createElement('div');
    wrap.className = 'map3d-pop';
    const head = this.sheep.position.clone().add(new this.T.Vector3(0, 1.2, 0));
    const { x, y } = this.toScreen(head);
    wrap.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-30%, -100%)`;
    wrap.innerHTML = `<div class="pop3d">${bubbleButtonSvg(cat, 48)}</div>`;
    this.overlay.append(wrap);
    setTimeout(() => wrap.remove(), 1600);
  }

  // ------------------------------------------------------------ building the world

  rebuild(force = false) {
    if (!this.T || !this.path.length) return;
    const cx = Math.round(this.target.x), cz = Math.round(this.target.z);
    if (!force && this.builtAt && this.builtAt.x === cx && this.builtAt.z === cz) return;
    this.builtAt = { x: cx, z: cz };
    this.buildScenery(cx, cz);
    this.buildRoad();
  }

  clear(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child.isInstancedMesh) child.dispose();
    }
  }

  // Many copies of one shape drawn in one go (fast on phones).
  batch() {
    const T = this.T;
    const lists = new Map();
    const m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    const api = {
      // add a shape at position p (Vector3) with scale s (Vector3), turned by rotY, in a colour
      add: (geo, color, p, s, rotY = 0, tiltX = 0) => {
        if (!lists.has(geo)) lists.set(geo, []);
        q.setFromAxisAngle(up, rotY);
        if (tiltX) q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), tiltX));
        lists.get(geo).push([m.compose(p, q, s).clone(), color]);
      },
      build: (group) => {
        const white = this.mat('#ffffff');
        for (const [geo, items] of lists) {
          const mesh = new T.InstancedMesh(geo, white, items.length);
          const col = new T.Color();
          items.forEach(([mx, c], i) => {
            mesh.setMatrixAt(i, mx);
            mesh.setColorAt(i, col.set(c));
          });
          mesh.castShadow = mesh.receiveShadow = true;
          group.add(mesh);
        }
      },
    };
    return api;
  }

  buildScenery(cx, cz) {
    const T = this.T, G = this.geo, V = (x, y, z) => new T.Vector3(x, y, z);
    this.clear(this.layers.scenery);
    this.clear(this.layers.stops);
    this.overlay.querySelectorAll('.map3d-label').forEach((n) => n.remove());
    this.labels = [];
    this.spinners = [];
    const B = this.batch();
    const s0 = cx + cz, d0 = cx - cz;

    for (let s = s0 - VIEW.s; s <= s0 + VIEW.s; s++) {
      for (let d = d0 - VIEW.d * 2; d <= d0 + VIEW.d * 2; d++) {
        if ((s + d) & 1) continue;
        const x = (s + d) / 2, y = (s - d) / 2;
        const r = this.tileRng(x, y);
        const t = this.describe(x, y, r);
        if (!t) continue;
        const pick = (arr) => arr[Math.floor(r() * arr.length)];
        switch (t.kind) {
          case 'forest':
            for (const tr of t.trees) {
              const px = x + tr.u, pz = y + tr.v, k = tr.k;
              B.add(G.cyl, C.trunk, V(px, 0.12 * k, pz), V(0.04 * k, 0.24 * k, 0.04 * k));
              const leaf = pick(C.leaves);
              B.add(G.ball, leaf, V(px, 0.36 * k, pz), V(0.2 * k, 0.19 * k, 0.2 * k));
              if (r() < 0.45) B.add(G.ball, leaf, V(px + 0.02, 0.52 * k, pz - 0.02), V(0.12 * k, 0.12 * k, 0.12 * k));
            }
            break;
          case 'mountain': {
            const k = t.k, rot = r() * 6;
            B.add(G.cone, C.rock, V(x, 0.55 * k, y), V(0.62 * k, 1.1 * k, 0.62 * k), rot);
            B.add(G.cone, C.snow, V(x, 0.97 * k, y), V(0.25 * k, 0.28 * k, 0.25 * k), rot);
            if (r() < 0.6) B.add(G.cone, C.rock, V(x + 0.35, 0.33 * k, y - 0.25), V(0.38 * k, 0.66 * k, 0.38 * k), rot + 1);
            break;
          }
          case 'village':
            for (const h of t.huts) {
              const px = x + h.u, pz = y + h.v, k = h.k, rot = r() * 0.6;
              B.add(G.box, C.wall, V(px, 0.09 * k, pz), V(0.2 * k, 0.18 * k, 0.2 * k), rot);
              B.add(G.cone4, pick(C.roofs), V(px, 0.27 * k, pz), V(0.2 * k, 0.18 * k, 0.2 * k), rot + Math.PI / 4);
            }
            break;
          case 'flock':
            for (const sh of t.sheep) this.addSheep(B, x + sh.u, y + sh.v, 0.75, sh.flip ? Math.PI : 0);
            break;
          case 'grass':
            for (let i = 0; i < 3; i++)
              B.add(G.cone4, C.grassTuft, V(x + t.u + (i - 1) * 0.05, 0.04, y + t.v + (r() - 0.5) * 0.04), V(0.025, 0.09 + r() * 0.04, 0.025));
            break;
          case 'bridge':
            this.addBridge(B, x, y, t.dx);
            break;
          case 'stop':
            this.addStop(x + t.dx + t.side * 0.7, y + t.dy - t.side * 0.7, t.stop);
            break;
        }
      }
    }
    this.addRivers(B, s0, d0);
    B.build(this.layers.scenery);
  }

  addSheep(B, x, z, k, rot) {
    const T = this.T, G = this.geo;
    const base = new T.Matrix4().compose(new T.Vector3(x, 0, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rot), new T.Vector3(k, k, k));
    const part = (geo, color, px, py, pz, sx, sy, sz) => {
      const m = base.clone().multiply(new T.Matrix4().compose(new T.Vector3(px, py, pz), new T.Quaternion(), new T.Vector3(sx, sy, sz)));
      const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
      m.decompose(p, q, s);
      B.add(geo, color, p, s, rot);
    };
    for (const [lx, lz] of [[-0.07, -0.05], [-0.07, 0.05], [0.07, -0.05], [0.07, 0.05]]) part(G.cyl, C.face, lx, 0.05, lz, 0.018, 0.1, 0.018);
    part(G.ball, C.wool, 0, 0.16, 0, 0.15, 0.1, 0.11);
    part(G.ball, C.face, 0.14, 0.2, 0, 0.055, 0.05, 0.045);
  }

  // The traveller: a real group of meshes so it can hop and turn.
  makeSheep(k) {
    const T = this.T, G = this.geo;
    const g = new T.Group();
    const add = (geo, color, x, y, z, sx, sy, sz) => {
      const m = new T.Mesh(geo, this.mat(color));
      m.position.set(x * k, y * k, z * k);
      m.scale.set(sx * k, sy * k, sz * k);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    for (const [lx, lz] of [[-0.07, -0.05], [-0.07, 0.05], [0.07, -0.05], [0.07, 0.05]]) add(G.cyl, C.face, lx, 0.05, lz, 0.02, 0.1, 0.02);
    add(G.ball, C.wool, 0, 0.17, 0, 0.16, 0.11, 0.12);
    add(G.ball, C.wool, -0.06, 0.24, 0, 0.09, 0.07, 0.09);
    add(G.ball, C.wool, 0.05, 0.25, 0.02, 0.08, 0.06, 0.08);
    add(G.ball, C.face, 0.16, 0.22, 0, 0.06, 0.055, 0.05);
    const earL = add(G.ball, C.face, 0.14, 0.26, 0.055, 0.03, 0.012, 0.018);
    earL.rotation.x = -0.6;
    const earR = add(G.ball, C.face, 0.14, 0.26, -0.055, 0.03, 0.012, 0.018);
    earR.rotation.x = 0.6;
    add(G.ball, '#ffffff', 0.205, 0.235, 0.022, 0.012, 0.012, 0.012);
    add(G.ball, '#ffffff', 0.205, 0.235, -0.022, 0.012, 0.012, 0.012);
    const scarf = new T.Mesh(new T.TorusGeometry(0.075 * k, 0.02 * k, 8, 20), this.mat(C.yellow));
    scarf.position.set(0.12 * k, 0.2 * k, 0);
    scarf.rotation.y = Math.PI / 2;
    scarf.castShadow = true;
    g.add(scarf);
    return g;
  }

  makeNextMarker() {
    const T = this.T;
    const g = new T.Group();
    const m = this.mat(C.yellow);
    for (let i = 0; i < 4; i++) {
      const bar = new T.Mesh(this.geo.box, m);
      bar.scale.set(0.78, 0.04, 0.06);
      const a = (i * Math.PI) / 2;
      bar.position.set(Math.sin(a) * 0.39, 0, Math.cos(a) * 0.39);
      bar.rotation.y = a;
      g.add(bar);
    }
    return g;
  }

  addBridge(B, x, z, dx) {
    const T = this.T, G = this.geo, V = (a, b, c) => new T.Vector3(a, b, c);
    const rot = dx ? 0 : Math.PI / 2; // along x, or along the grid's y (3D z)
    const along = (a, side, h) => (dx ? V(x + a, h, z + side) : V(x + side, h, z + a));
    B.add(G.box, C.wood, V(x, 0.07, z), V(1.25, 0.06, 0.42), rot);
    for (const side of [-0.19, 0.19]) {
      B.add(G.box, C.woodDark, along(0, side, 0.2), V(1.25, 0.03, 0.03), rot);
      for (const a of [-0.55, 0, 0.55]) B.add(G.box, C.woodDark, along(a, side, 0.13), V(0.04, 0.13, 0.04));
    }
  }

  addRivers(B, s0, d0) {
    const T = this.T;
    for (const rv of this.rivers) {
      if (Math.abs(rv.s0 - s0) > VIEW.s + 12) continue;
      for (const [width, color, h] of [[1.3, C.bank, 0.004], [1.0, C.water, 0.012]]) {
        const pos = [];
        const pt = (d) => {
          const s = this.riverS(rv, d);
          return new T.Vector2((s + d) / 2, (s - d) / 2);
        };
        // left and right banks, each offset along the curve's own normal so the edges stay smooth
        const edges = [];
        for (let d = d0 - VIEW.d * 2 - 4; d <= d0 + VIEW.d * 2 + 4; d += 0.2) {
          const a = pt(d - 0.1), b = pt(d + 0.1), c = pt(d);
          const n = new T.Vector2(-(b.y - a.y), b.x - a.x).normalize().multiplyScalar(width / 2);
          edges.push([c.clone().add(n), c.clone().sub(n)]);
        }
        for (let i = 0; i + 1 < edges.length; i++) {
          const [l0, r0] = edges[i], [l1, r1] = edges[i + 1];
          pos.push(l0.x, h, l0.y, r0.x, h, r0.y, l1.x, h, l1.y);
          pos.push(l1.x, h, l1.y, r0.x, h, r0.y, r1.x, h, r1.y);
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        const mesh = new T.Mesh(geo, new T.MeshToonMaterial({ color, gradientMap: this.ramp, side: T.DoubleSide }));
        mesh.receiveShadow = true;
        this.layers.scenery.add(mesh);
      }
    }
  }

  // ------------------------------------------------------------ the road and footprints

  buildRoad() {
    if (!this.builtAt) return;
    const T = this.T, G = this.geo, V = (a, b, c) => new T.Vector3(a, b, c);
    this.clear(this.layers.road);
    const s0 = this.builtAt.x + this.builtAt.z;
    const lo = Math.max(0, s0 - VIEW.s - 4), hi = Math.min(this.path.length - 1, s0 + VIEW.s + 4, this.endIndex);
    const B = this.batch();
    this.roadSteps = [];
    for (let i = lo; i <= hi; i++) {
      const p = this.pathAt(i), walked = i <= this.pos;
      B.add(G.disc, walked ? C.road : C.roadAhead, V(p.x, 0.008, p.y), V(0.52, 0.016, 0.52));
      if (i >= 1 && i <= this.pos) B.add(G.cyl, C[this.cats[i - 1]] || C.stone, V(p.x, 0.03, p.y), V(0.1, 0.03, 0.1));
    }
    B.build(this.layers.road);
    // the first instanced mesh is the road discs, in path order: remember which step each is
    this.roadMesh = this.layers.road.children[0];
    this.roadLo = lo;

    const n = this.pathAt(this.pos + 1);
    this.nextMarker.position.set(n.x, 0.06, n.y);
    this.nextMarker.visible = this.pos < this.endIndex;
    if (this.selected) {
      const p = this.pathAt(this.selected);
      this.selRing.position.set(p.x, 0.06, p.y);
    }
    this.selRing.visible = !!this.selected;
  }

  // ------------------------------------------------------------ stops (buildings)

  addStop(x, z, stop) {
    const T = this.T;
    const g = new T.Group();
    g.position.set(x, 0, z);
    const built = buildStop3D(T, stop.key, (c) => this.mat(c));
    g.add(built.group);
    this.spinners.push(...built.spin);
    if (!stop.reached) g.traverse((m) => m.isMesh && (m.material = this.fade(m.material)));
    this.layers.stops.add(g);

    const label = document.createElement('div');
    label.className = 'map3d-label' + (stop.reached ? ' reached' : '');
    label.textContent = stop.name;
    this.overlay.append(label);
    this.labels.push({ el: label, at: new T.Vector3(x, 0, z + 0.05) });
  }

  // a paler copy of a material, for stops the group hasn't reached yet
  fade(mat) {
    const key = 'fade:' + mat.color.getHexString();
    if (!this.mats.has(key)) {
      const c = mat.color.clone().lerp(new this.T.Color('#ffffff'), 0.45);
      this.mats.set(key, new this.T.MeshToonMaterial({ color: c, gradientMap: this.ramp }));
    }
    return this.mats.get(key);
  }

  // ------------------------------------------------------------ dragging and tapping

  bindPan() {
    const T = this.T;
    const el = this.renderer.domElement;
    const right = new T.Vector3(1, 0, -1).normalize(), down = new T.Vector3(1, 0, 1).normalize();
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, start: this.target.clone(), moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      this.follow = false;
      this.target
        .copy(drag.start)
        .addScaledVector(right, -dx / PX_PER_UNIT)
        .addScaledVector(down, -dy / PX_PER_UNIT / ELEV_SIN);
    });
    const end = (e) => {
      if (!drag) return;
      if (!drag.moved && e.type === 'pointerup') this.tap(e);
      if (drag.moved) {
        const off = Math.hypot(this.target.x - this.sheep.position.x, this.target.z - this.sheep.position.z) > 2;
        this.onPan?.(off);
      }
      drag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  tap(e) {
    if (!this.roadMesh) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new this.T.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.roadMesh)[0];
    if (!hit) return;
    const step = this.roadLo + hit.instanceId;
    if (step >= 1 && step <= this.pos) this.onStepTap?.(step);
  }
}
