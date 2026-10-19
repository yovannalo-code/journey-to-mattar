import { STOP_TYPES, drawStop2D, buildStop3D } from './stops.js';
import { STYLES, setArtStyle, installDefs, STYLE } from './art.js';
import { mulberry32, hashStr, esc } from './util.js';

const LOOKS = ['sketch', 'pixel', 'cozy', 'cozy3d'];
document.body.classList.add('preview', 'style-sketch');
installDefs();

// ---------------------------------------------------------------- 2D thumbnails

// The Tannery tower is much taller than the other stops, so it gets a wider frame.
const FRAME_2D = { tannery: '-100 -142 200 150' };
const FRAME_3D = { tannery: { hh: 1.2, y: 0.85 } };

function thumb2D(key, look) {
  setArtStyle(look);
  const r = mulberry32(hashStr(key));
  const filter = STYLE.filter ? ` filter="url(#${STYLE.filter})"` : '';
  const ground =
    `<rect x="-80" y="-140" width="160" height="170" class="ground-base"/>` +
    `<rect x="-80" y="-140" width="160" height="170" class="ground-tex"/>` +
    `<rect x="-80" y="-140" width="160" height="170" fill="url(#grid)"/>` +
    `<ellipse class="obj-shadow" cx="8" cy="2" rx="46" ry="11"/>`;
  const svg = `<svg viewBox="${FRAME_2D[key] || '-58 -80 116 87'}" role="img" aria-label="${esc(STYLES[look].label)}"><g${filter}>${ground}${drawStop2D(key, 0, -2, r)}</g></svg>`;
  setArtStyle('sketch');
  return `<div class="thumb style-${look}" data-look="${look}">${svg}<span class="cap">${STYLES[look].label}</span></div>`;
}

const list = document.getElementById('stops');
list.innerHTML = STOP_TYPES.map(
  (s, i) => `<li class="stop-card${i === 0 || i === STOP_TYPES.length - 1 ? ' ends' : ''}">
    <div class="stop-head"><span class="stop-num">${i + 1}</span><span class="stop-name">${esc(s.name)}</span><span class="stop-blurb">${esc(s.blurb)}</span></div>
    <div class="thumbs">
      ${['sketch', 'pixel', 'cozy'].map((look) => thumb2D(s.key, look)).join('')}
      <div class="thumb style-cozy3d" data-look="cozy3d" data-key="${s.key}"><span class="wait">Building 3D…</span><span class="cap">Cozy 3D</span></div>
    </div>
  </li>`
).join('');

// ---------------------------------------------------------------- look switcher

const page = document.getElementById('page');
document.querySelectorAll('[data-view]').forEach((b) =>
  b.addEventListener('click', () => {
    const view = b.dataset.view;
    document.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    page.classList.toggle('one', view !== 'all');
    document.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('shown', t.dataset.look === view));
  })
);

// ---------------------------------------------------------------- 3D thumbnails (one renderer, a picture per stop)

async function render3D() {
  let T;
  try {
    T = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js');
  } catch {
    try {
      T = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    } catch {
      document.querySelectorAll('[data-key] .wait').forEach((w) => (w.textContent = "3D couldn't load"));
      return;
    }
  }
  const W = 480, H = 360;
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  scene.background = new T.Color('#a9d38a');
  const ramp = new T.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter;
  ramp.needsUpdate = true;
  const mats = new Map();
  const mat = (c) => {
    if (!mats.has(c)) mats.set(c, new T.MeshToonMaterial({ color: c, gradientMap: ramp }));
    return mats.get(c);
  };

  // a little patch of checkered lawn under each stop
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) {
      const tile = new T.Mesh(new T.PlaneGeometry(1, 1), mat((x + z) & 1 ? '#a0cc81' : '#a9d38a'));
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(x, 0, z);
      tile.receiveShadow = true;
      scene.add(tile);
    }
  scene.add(new T.HemisphereLight('#fff6e8', '#8fb879', 0.75));
  const sun = new T.DirectionalLight('#fff0d6', 2.1);
  sun.position.set(-9, 16, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 40 });
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const frame = (key) => {
    const { hh, y } = FRAME_3D[key] || { hh: 0.66, y: 0.4 };
    Object.assign(cam, { top: hh, bottom: -hh, left: (-hh * W) / H, right: (hh * W) / H });
    cam.updateProjectionMatrix();
    const look = new T.Vector3(0.05, y, 0.05);
    cam.position.copy(look).add(new T.Vector3(14, 16.8, 14));
    cam.lookAt(look);
  };

  for (const el of document.querySelectorAll('[data-key]')) {
    frame(el.dataset.key);
    const { group } = buildStop3D(T, el.dataset.key, mat);
    scene.add(group);
    renderer.render(scene, cam);
    const img = new Image();
    img.alt = 'Cozy 3D';
    img.src = renderer.domElement.toDataURL('image/png');
    el.querySelector('.wait').replaceWith(img);
    scene.remove(group);
    await new Promise((r) => setTimeout(r, 0));
  }
  renderer.dispose();
}
render3D();
