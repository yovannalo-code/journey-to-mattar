// The finale: a full-screen celebration when the flock reaches the Tannery.
import { creatureSvg, bubbleButtonSvg, STYLE, CREATURE } from './art.js';
import { CATEGORIES, STOPS, FINAL_STOP } from './journey.js';
import { esc } from './util.js';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- confetti

function confetti(canvas) {
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.body);
  const colors = ['--cat-savings', '--cat-tithe', '--cat-initiatives', '--yellow', '--coral']
    .map((v) => css.getPropertyValue(v).trim())
    .filter(Boolean);
  const ink = css.getPropertyValue('--ink').trim() || '#222';
  const look = STYLE.name;
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  };
  resize();
  window.addEventListener('resize', resize);

  const bits = [];
  const burst = (x, y, n, spread, power) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const v = power * (0.55 + Math.random() * 0.6);
      bits.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: Math.random() * 6.3,
        vr: (Math.random() - 0.5) * 0.3,
        size: 6 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        round: Math.random() < 0.35,
        wobble: Math.random() * 6.3,
      });
    }
  };
  // three big bursts, then a gentle drizzle while the screen is open
  const schedule = [
    [0, () => burst(W * 0.15, H, 90, 1.1, 17)],
    [0, () => burst(W * 0.85, H, 90, 1.1, 17)],
    [450, () => burst(W * 0.5, H * 0.95, 140, 1.5, 20)],
    [1100, () => burst(W * 0.3, H, 70, 0.9, 16)],
    [1300, () => burst(W * 0.7, H, 70, 0.9, 16)],
  ];
  const timers = schedule.map(([ms, fn]) => setTimeout(fn, ms));
  const drizzle = setInterval(() => {
    if (bits.length < 120) for (let i = 0; i < 3; i++) bits.push({ ...pick(), x: Math.random() * W, y: -10, vx: 0, vy: 1.5 });
  }, 260);
  function pick() {
    return {
      rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.2, size: 6 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)], round: Math.random() < 0.35, wobble: Math.random() * 6.3,
    };
  }

  let raf;
  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.vy += 0.32;
      b.vx *= 0.985;
      b.vy = Math.min(b.vy, 4.2);
      b.wobble += 0.08;
      b.x += b.vx + Math.sin(b.wobble) * 0.6;
      b.y += b.vy;
      b.rot += b.vr;
      if (b.y > H + 30) {
        bits.splice(i, 1);
        continue;
      }
      ctx.fillStyle = b.color;
      if (look === 'pixel') {
        // chunky square pixels, no spin
        const s = Math.round(b.size / 4) * 4;
        ctx.fillRect(Math.round(b.x / 4) * 4, Math.round(b.y / 4) * 4, s, s);
        continue;
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(1, Math.cos(b.wobble * 1.3)); // paper flipping over
      ctx.beginPath();
      if (b.round || look.startsWith('cozy')) ctx.arc(0, 0, b.size / 2, 0, Math.PI * 2);
      else ctx.rect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
      ctx.fill();
      if (look === 'sketch') {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
      ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    clearInterval(drizzle);
    window.removeEventListener('resize', resize);
  };
}

// ---------------------------------------------------------------- the share picture

const FILE = 'tannery-celebration.png';

// How to save a file here: the claude.ai page's own download prompt, or a plain link elsewhere.
let saverPromise = null;
function saver() {
  saverPromise ??= (async () => {
    if (window.claude?.use) {
      const downloads = await window.claude.use('downloads');
      return downloads ? (blob) => downloads.save({ filename: FILE, data: blob }) : null;
    }
    return (blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = FILE;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    };
  })();
  return saverPromise;
}

// The sheep as a stand-alone picture: page styles don't reach inside an <img>, so bake the colours in.
function sheepImage(css) {
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const pen = v('--pen', '#222'), lw = parseFloat(v('--lw', '2')) || 2;
  const style = `
    .wool{fill:${v('--wool', '#fff')};stroke:${pen};stroke-width:${lw * 1.2};stroke-linejoin:round}
    .face,.leg{fill:${v('--face', '#333')};stroke:${pen};stroke-width:${lw};stroke-linejoin:round}
    .leg.far{fill:${v('--leg-far', '#555')}}
    .y{fill:${v('--yellow', '#f2c830')};stroke:${pen};stroke-width:${lw};stroke-linejoin:round}
    .k{fill:${v('--dark', '#222')}}
    .h{fill:rgba(0,0,0,.12)}
    .o{fill:none;stroke:${pen};stroke-width:${lw};stroke-linecap:round}
    .fleece{stroke:${v('--fleece', '#bbb')};stroke-width:${lw * 0.65}}
    .shadow{fill:rgba(30,30,30,.16)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="440" viewBox="-38 -56 78 62"><style>${style}</style>${CREATURE}</svg>`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function makePicture({ travel, j, days, byCat, flock }) {
  const W = 1080, H = 1350;
  const css = getComputedStyle(document.body);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const hand = v('--hand', 'cursive'), body = v('--body', 'sans-serif');
  try {
    await Promise.all([document.fonts.load(`80px ${hand}`), document.fonts.load(`40px ${body}`)]);
  } catch {}
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const ink = v('--ink', '#222'), muted = v('--muted', '#777'), card = v('--paper-2', '#fff'), yellow = v('--yellow', '#f2c830');
  const pixel = STYLE.name === 'pixel', soft = STYLE.name.startsWith('cozy');

  // background glow and sun rays
  const bg = g.createRadialGradient(W / 2, 330, 40, W / 2, 330, 900);
  bg.addColorStop(0, v('--yellow-soft', '#f7e39a'));
  bg.addColorStop(1, v('--paper', '#efeee9'));
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, 330);
  g.globalAlpha = 0.28;
  g.fillStyle = yellow;
  for (let i = 0; i < 18; i++) {
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 420, (i * 2 * Math.PI) / 18, ((i + 0.5) * 2 * Math.PI) / 18);
    g.fill();
  }
  g.restore();

  const sheep = await sheepImage(css);
  if (sheep) g.drawImage(sheep, W / 2 - 280, 90, 560, 440);

  const text = (str, x, y, font, color = ink, align = 'center') => {
    g.font = font;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    g.fillText(str, x, y);
  };
  const fit = (str, max, size, family) => {
    let s = size;
    g.font = `${s}px ${family}`;
    while (g.measureText(str).width > max && s > 20) g.font = `${(s -= 4)}px ${family}`;
    return `${s}px ${family}`;
  };
  text(travel.name, W / 2, 610, fit(travel.name, W - 160, 46, hand), muted);
  const title = `Welcome to ${FINAL_STOP.name}!`;
  text(title, W / 2, 720, fit(title, W - 100, 118, hand));

  const box = (x, y, w, h) => {
    g.fillStyle = card;
    g.strokeStyle = ink;
    g.lineWidth = soft ? 0 : 4;
    g.beginPath();
    if (pixel || !g.roundRect) g.rect(x, y, w, h);
    else g.roundRect(x, y, w, h, 28);
    g.fill();
    if (!soft) g.stroke();
  };
  // three stats
  const stats = [[j.total, 'steps'], [days, days === 1 ? 'day' : 'days'], [flock.length, flock.length === 1 ? 'traveller' : 'travellers']];
  stats.forEach(([n, label], i) => {
    const x = 90 + i * 310;
    box(x, 780, 280, 170);
    text(String(n), x + 140, 880, `84px ${hand}`);
    text(label, x + 140, 925, `32px ${body}`, muted);
  });
  // savings, tithe, initiative
  byCat.forEach(([k, n], i) => {
    const x = 90 + i * 310;
    box(x, 980, 280, 120);
    g.fillStyle = v(`--cat-${k}`, CATEGORIES[k].color);
    g.strokeStyle = ink;
    g.lineWidth = soft ? 0 : 4;
    g.beginPath();
    if (pixel) g.rect(x + 28, 1010, 60, 60);
    else g.arc(x + 58, 1040, 30, 0, Math.PI * 2);
    g.fill();
    if (!soft) g.stroke();
    text(String(n), x + 170, 1058, `64px ${hand}`, ink);
    text(CATEGORIES[k].label, x + 170, 1090, `24px ${body}`, muted);
  });
  // the flock's names
  const names = flock.map((m) => m.display_name);
  g.font = `34px ${body}`;
  const lines = [];
  let line = '';
  for (const n of names) {
    const next = line ? `${line}  ·  ${n}` : n;
    if (g.measureText(next).width > W - 180 && line) {
      lines.push(line);
      line = n;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    const shown = lines[0].split('  ·  ').length + lines[1].split('  ·  ').length;
    lines.splice(2, lines.length, `and ${names.length - shown} more`);
  }
  text('Thank you, flock', W / 2, 1160, `44px ${hand}`);
  lines.slice(0, 3).forEach((l, i) => text(l, W / 2, 1208 + i * 42, `34px ${body}`, ink));
  text('Journey to Mattar', W / 2, H - 34, `28px ${hand}`, muted);

  // confetti over everything, like the screen
  const colors = byCat.map(([k]) => v(`--cat-${k}`, CATEGORIES[k].color)).concat([yellow, v('--coral', '#e9785b')]);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * W, y = rnd() * H;
    // mostly round the edges, so the sheep, title and numbers stay readable
    if (x > 110 && x < W - 110 && y > 90 && y < H - 60 && rnd() < 0.88) continue;
    const size = 10 + rnd() * 16;
    g.fillStyle = colors[Math.floor(rnd() * colors.length)];
    if (pixel) {
      const s8 = Math.max(8, Math.round(size / 8) * 8);
      g.fillRect(Math.round(x / 8) * 8, Math.round(y / 8) * 8, s8, s8);
      continue;
    }
    g.save();
    g.translate(x, y);
    {
      g.rotate(rnd() * 6.3);
      g.beginPath();
      if (soft || rnd() < 0.35) g.arc(0, 0, size / 2, 0, Math.PI * 2);
      else g.rect(-size / 2, -size / 4, size, size / 2);
      g.fill();
      if (STYLE.name === 'sketch') {
        g.lineWidth = 2;
        g.strokeStyle = ink;
        g.stroke();
      }
    }
    g.restore();
  }
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

// ---------------------------------------------------------------- the screen

function countUp(el, to, ms = 1200) {
  if (reduceMotion()) return (el.textContent = to);
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const avatarHtml = (m, size = 34) => {
  if (m.avatar_url) return `<img class="avatar" src="${esc(m.avatar_url)}" width="${size}" height="${size}" alt="" referrerpolicy="no-referrer">`;
  const initials = String(m.display_name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${size * 0.42}px">${esc(initials)}</span>`;
};

/**
 * Show the finale. `travel`, `members` and the journey `j` come from the journey screen.
 * Returns a promise that resolves when the viewer closes it.
 */
export function celebrate({ travel, members, j, toast }) {
  const steps = j.sorted.slice(0, j.total);
  const first = steps[0] ? new Date(steps[0].created_at) : new Date();
  const last = steps[steps.length - 1] ? new Date(steps[steps.length - 1].created_at) : new Date();
  const days = Math.max(1, Math.round((last - first) / 864e5));
  const byCat = Object.keys(CATEGORIES).map((k) => [k, steps.filter((a) => a.category === k).length]);
  // everyone together, alphabetically: no ranking at the finish line
  const flock = [...members].sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)));
  const summary =
    `Our flock “${travel.name}” made it to ${FINAL_STOP.name}! ` +
    `${j.total} steps in ${days} day${days === 1 ? '' : 's'}: ` +
    byCat.map(([k, n]) => `${n} ${CATEGORIES[k].label.toLowerCase()}`).join(', ') + '.';

  const wrap = document.createElement('div');
  wrap.className = 'celebrate';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'Journey complete');
  wrap.innerHTML = `
    <canvas class="cel-confetti" aria-hidden="true"></canvas>
    <div class="cel-scroll">
      <div class="cel-card">
        <div class="cel-hero">
          <div class="cel-rays" aria-hidden="true"></div>
          <div class="cel-sheep">${creatureSvg(150)}</div>
        </div>
        <p class="cel-kicker">${esc(travel.name)} made it to the end of the road</p>
        <h1 class="cel-title">Welcome to ${esc(FINAL_STOP.name)}!</h1>
        <p class="cel-lead">${STOPS.length} stops, one road, one flock. Every tithe, every saving and every new idea got you here.</p>
        <div class="cel-stats">
          <div><b data-count="${j.total}">0</b><span>steps</span></div>
          <div><b data-count="${days}">0</b><span>day${days === 1 ? '' : 's'}</span></div>
          <div><b data-count="${members.length}">0</b><span>traveller${members.length === 1 ? '' : 's'}</span></div>
        </div>
        <div class="cel-cats">${byCat
          .map(([k, n]) => `<div class="cel-cat">${bubbleButtonSvg(k, 52)}<b data-count="${n}">0</b><span>${CATEGORIES[k].label}</span></div>`)
          .join('')}</div>
        <h2 class="cel-h2">Thank you, flock</h2>
        <ul class="cel-flock">${flock.map((m) => `<li>${avatarHtml(m, 30)}<span>${esc(m.display_name)}</span></li>`).join('')}</ul>
        <ol class="cel-road" aria-label="Stops passed">${STOPS.map((s, i) => `<li${i === STOPS.length - 1 ? ' class="end"' : ''}>${esc(s.name)}</li>`).join('')}</ol>
        <div class="cel-actions">
          <button class="btn primary" id="cel-share">Share the news</button>
          <div class="cel-share" id="cel-share-panel" hidden>
            <div class="cel-shot"><span class="muted">Making your picture…</span></div>
            <p class="muted small">On a phone you can also press and hold the picture to save or share it.</p>
            <button class="btn primary" id="cel-copy-img">Copy picture</button>
            <button class="btn" id="cel-save-img" hidden>Save picture</button>
            <button class="btn" id="cel-copy-text">Copy message</button>
          </div>
          <button class="btn" id="cel-close">Back to the map</button>
        </div>
      </div>
    </div>`;
  document.body.append(wrap);
  setTimeout(() => wrap.classList.add('open'), 20);

  const stopConfetti = reduceMotion() ? () => {} : confetti(wrap.querySelector('.cel-confetti'));
  setTimeout(() => wrap.querySelectorAll('[data-count]').forEach((el) => countUp(el, +el.dataset.count)), 500);

  // ---- sharing: a picture of the finale (with confetti), plus the message as text
  let picture = null; // Promise<Blob>
  const panel = wrap.querySelector('#cel-share-panel');
  wrap.querySelector('#cel-share').onclick = async (e) => {
    e.currentTarget.hidden = true;
    panel.hidden = false;
    panel.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    picture ??= makePicture({ travel, j, days, byCat, flock });
    const blob = await picture;
    const img = new Image();
    img.alt = `Celebration picture: ${travel.name} made it to ${FINAL_STOP.name}`;
    img.src = URL.createObjectURL(blob);
    panel.querySelector('.cel-shot').replaceChildren(img);
    if (await saver()) panel.querySelector('#cel-save-img').hidden = false;
  };
  panel.querySelector('#cel-copy-img').onclick = async () => {
    try {
      // hand the clipboard a promise so the copy still counts as part of the tap
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': picture })]);
      toast?.('Picture copied. Paste it in your group chat!');
    } catch {
      toast?.("This browser won't copy pictures here. Press and hold the picture, or use Save picture.");
    }
  };
  panel.querySelector('#cel-save-img').onclick = async () => {
    const save = await saver();
    try {
      await save(await picture);
    } catch (err) {
      if (err?.code !== 'declined') toast?.("Couldn't save the picture. Press and hold it instead.");
    }
  };
  panel.querySelector('#cel-copy-text').onclick = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast?.('Message copied. Paste it in your group chat!');
    } catch {
      toast?.(summary);
    }
  };
  return new Promise((resolve) => {
    const close = () => {
      stopConfetti();
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 350);
      document.removeEventListener('keydown', onKey);
      resolve();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    wrap.querySelector('#cel-close').onclick = close;
    wrap.querySelector('#cel-close').focus({ preventScroll: true });
  });
}
