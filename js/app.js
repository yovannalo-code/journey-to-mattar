import { CONFIG } from './config.js';
import { createBackend, DEMO } from './backend.js';
import { computeJourney, buildPath, CATEGORIES, FINAL_STOP } from './journey.js';
import { JourneyMap } from './map.js';
import { creatureSvg, iconSvg, bubbleButtonSvg, setArtStyle, installDefs } from './art.js';
import { esc, timeAgo, fmtDate } from './util.js';
import { celebrate } from './celebrate.js';

const app = document.getElementById('app');
let be, user;
let cleanup = null;

// Invite links look like  https://your-site/?join=ABC123
const params = new URLSearchParams(location.search);
const hashJoin = location.hash.match(/^#join-([A-Za-z0-9]{6})$/);
if (hashJoin) {
  sessionStorage.setItem('pendingJoin', hashJoin[1].toUpperCase());
  history.replaceState(null, '', location.pathname + location.search);
}
if (params.get('join')) {
  sessionStorage.setItem('pendingJoin', params.get('join').trim().toUpperCase());
  params.delete('join');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
}

// ---------------------------------------------------------------- small UI helpers

const ICON = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  invite: '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M2 20c1-4 4-6 7-6s6 2 7 6M19 7v6M16 10h6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  log: '<svg width="22" height="22" viewBox="0 0 24 24"><g class="icon-art"><path d="M5 6h14M5 12h14M5 18h9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></g></svg>',
  google:
    '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.1 5.5c4.2-3.9 7.2-9.6 7.2-17z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.6 2.2-8.8 2.2-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>',
};

function avatar(name, url, size = 34) {
  if (url) return `<img class="avatar" src="${esc(url)}" width="${size}" height="${size}" alt="" referrerpolicy="no-referrer">`;
  const initials = String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${size * 0.42}px">${esc(initials)}</span>`;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

function sheet(html, onMount, onClose) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog"><div class="sheet-grip"></div>${html}</div>`;
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    onClose?.();
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 250);
  };
  wrap.querySelector('.sheet-backdrop').onclick = close;
  wrap.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
  onMount?.(wrap.querySelector('.sheet'), close);
  return close;
}

// First tap arms the button, second tap within 4s does it.
function armed(btn, label) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1';
  const old = btn.textContent;
  btn.textContent = label;
  btn.classList.add('armed');
  setTimeout(() => {
    delete btn.dataset.armed;
    btn.textContent = old;
    btn.classList.remove('armed');
  }, 4000);
  return false;
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

// Runs an async button action with a busy state.
async function busy(btn, fn) {
  btn.disabled = true;
  try {
    await fn();
  } catch (e) {
    toast(e.message || String(e));
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------- routing

async function main() {
  // the app is drawn in the Sketch look only
  installDefs();
  setArtStyle('sketch');
  document.body.classList.add('style-sketch');
  app.innerHTML = `<div class="splash"><div class="splash-hero">${creatureSvg(120)}</div><p class="muted">Loading…</p></div>`;
  try {
    be = await createBackend();
    user = await be.currentUser();
  } catch (e) {
    app.innerHTML = `<div class="splash"><h1>Couldn't start</h1><p class="muted">${esc(e.message)}</p></div>`;
    return;
  }
  // Tidy the sign-in code out of the address bar after Google redirects back.
  if (new URLSearchParams(location.search).has('code')) history.replaceState(null, '', location.pathname + location.hash);

  be.onAuthChange((u) => {
    const changed = (u?.id || null) !== (user?.id || null);
    user = u;
    if (changed) route();
  });
  window.addEventListener('hashchange', route);
  route();
}

async function route() {
  cleanup?.();
  cleanup = null;
  if (!user) return showSignIn();

  const pending = sessionStorage.getItem('pendingJoin');
  if (pending) {
    sessionStorage.removeItem('pendingJoin');
    try {
      const t = await be.joinTravel(pending);
      toast(`You joined “${t.name}”!`);
      return go('#/t/' + t.id);
    } catch (e) {
      toast(e.message);
    }
  }

  const m = location.hash.match(/^#\/t\/([\w-]+)/);
  if (m) return showTravel(m[1]);
  showHome();
}

// ---------------------------------------------------------------- sign in

function showSignIn() {
  const pending = sessionStorage.getItem('pendingJoin');
  app.innerHTML = `<main class="splash">
    <div class="splash-hero">${creatureSvg(150)}</div>
    <h1>${esc(CONFIG.APP_NAME)}</h1>
    <p class="lead">Walk the long road together. Every tithe, every saving, every new initiative moves your flock one step closer to Mattar.</p>
    ${pending ? `<p class="invite-note">You've been invited to join journey <b>${esc(pending)}</b>. Sign in to hop on.</p>` : ''}
    ${
      DEMO
        ? `<form id="demo" class="stack">
             <input id="name" class="input" placeholder="Your name" autocomplete="given-name" maxlength="40">
             <button class="btn primary">Start</button>
           </form>
           <p class="demo-note">Demo mode: everything is saved on this device only. Add your Supabase keys in <code>js/config.js</code> to switch on Google sign-in.</p>`
        : `<button class="btn primary google" id="google">${ICON.google}<span>Sign in with Google</span></button>`
    }
  </main>`;
  if (DEMO) {
    app.querySelector('#demo').onsubmit = (e) => {
      e.preventDefault();
      busy(e.submitter || app.querySelector('#demo button'), () => be.signIn(app.querySelector('#name').value));
    };
  } else {
    app.querySelector('#google').onclick = (e) => busy(e.currentTarget, () => be.signIn());
  }
}

// ---------------------------------------------------------------- home: list of journeys

async function showHome() {
  app.innerHTML = `<main class="home">
    <header class="home-head">
      <div class="brand">${creatureSvg(46)}<span>${esc(CONFIG.APP_NAME)}</span></div>
      <button class="avatar-btn" id="me" aria-label="Account">${avatar(user.name, user.avatar)}</button>
    </header>
    <h2>Your journeys</h2>
    <div id="list" class="list"><p class="muted">Loading…</p></div>
    <div class="home-actions">
      <button class="btn primary" id="new">Start a new journey</button>
      <button class="btn" id="join">Join with a code</button>
    </div>
  </main>`;

  app.querySelector('#me').onclick = () =>
    sheet(
      `<div class="sheet-head">${avatar(user.name, user.avatar, 44)}<h3>${esc(user.name)}</h3></div>
       ${be.canSignOut ? '<button class="btn" id="out">Sign out</button>' : '<p class="muted">You\'re playing with your Claude account.</p>'}`,
      (el, close) => el.querySelector('#out')?.addEventListener('click', () => (close(), be.signOut()))
    );

  app.querySelector('#new').onclick = () =>
    sheet(
      `<h3>Start a new journey</h3>
       <p class="muted">Give your group a name. You'll get a code to share with them.</p>
       <form class="stack"><input class="input" id="tname" placeholder="e.g. Joshua's CG" maxlength="60" required>
       <button class="btn primary">Set off</button></form>`,
      (el, close) => {
        el.querySelector('#tname').focus();
        el.querySelector('form').onsubmit = (e) => {
          e.preventDefault();
          busy(el.querySelector('button.primary'), async () => {
            const t = await be.createTravel(el.querySelector('#tname').value);
            close();
            go('#/t/' + t.id);
          });
        };
      }
    );

  app.querySelector('#join').onclick = () => openJoin();

  try {
    const travels = await be.listTravels();
    const list = app.querySelector('#list');
    if (!list) return;
    list.innerHTML = travels.length
      ? travels
          .map(
            (t) => `<a class="card" href="#/t/${t.id}">
              <div class="card-main"><div class="card-title">${esc(t.name)}</div>
              <div class="muted">${t.memberCount} traveller${t.memberCount === 1 ? '' : 's'} · ${t.stepCount} step${t.stepCount === 1 ? '' : 's'}</div></div>
              <span class="code-chip">${esc(t.code)}</span></a>`
          )
          .join('')
      : `<div class="empty">${creatureSvg(80)}<p>No journeys yet. Start one, or join a friend's with their code.</p></div>`;
  } catch (e) {
    toast(e.message);
  }
}

function openJoin() {
  sheet(
    `<h3>Join a journey</h3>
     <p class="muted">Ask whoever started it for the 6-letter code.</p>
     <form class="stack"><input class="input code-input" id="code" placeholder="ABC123" maxlength="6" autocapitalize="characters" autocomplete="off" required>
     <button class="btn primary">Join</button></form>`,
    (el, close) => {
      const input = el.querySelector('#code');
      input.focus();
      input.oninput = () => (input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
      el.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        busy(el.querySelector('button.primary'), async () => {
          const t = await be.joinTravel(input.value);
          close();
          toast(`You joined “${t.name}”!`);
          go('#/t/' + t.id);
        });
      };
    }
  );
}

// ---------------------------------------------------------------- the journey map

function showTravel(id) {
  app.innerHTML = `<div class="travel">
    <div id="map" class="map"></div>
    <header class="t-top">
      <button class="icon-btn" id="back" aria-label="All journeys">${ICON.back}</button>
      <div class="t-card" id="card"><div class="muted">Loading…</div></div>
      <button class="icon-btn" id="invite" aria-label="Invite">${ICON.invite}</button>
    </header>
    <button class="recenter" id="recenter" hidden>Back to the traveller</button>
    <nav class="t-actions">
      ${Object.entries(CATEGORIES)
        .map(([key, c]) => `<button class="act-btn" data-cat="${key}">${bubbleButtonSvg(key)}<span>${c.label}</span></button>`)
        .join('')}
      <button class="act-btn" id="activity"><span class="act-log">${ICON.log}</span><span>Activity</span></button>
    </nav>
  </div>`;

  const map = new JourneyMap(app.querySelector('#map'));
  const card = app.querySelector('#card');
  const recenterBtn = app.querySelector('#recenter');
  map.onPan = (off) => (recenterBtn.hidden = !off);
  recenterBtn.onclick = () => map.recenter();
  map.onStepTap = (i) => openStep(i);
  app.querySelector('#back').onclick = () => go('#/');

  let state = null;
  let alive = true;
  let chain = Promise.resolve();

  async function load() {
    const data = await be.getTravel(id);
    if (!alive) return;
    const j = computeJourney(data.members, data.actions);
    const need = j.total + 120;
    const path = state && state.path.length >= need ? state.path : buildPath(data.travel.id, Math.max(need, 600));
    const first = !state;
    state = { ...data, j, path };
    renderCard();
    map.set({ seed: data.travel.id, path, stops: j.stops, cats: j.cats });
    const before = map.pos;
    if (first) map.jumpTo(j.position);
    else await map.walkTo(j.position);
    // reached a new stop on this walk: say where the flock is now
    const arrived = first ? null : j.stops.filter((st) => st.index > before && st.index <= j.position).pop();
    // the finale plays for whoever is watching when the flock arrives, and once for everyone else
    if (j.done && (arrived?.key === FINAL_STOP.key || !celebrated())) showFinale();
    else if (arrived) toast(`${arrived.name}: ${arrived.blurb}`);
  }
  const refresh = () =>
    (chain = chain.then(load).catch((e) => {
      toast(e.message);
      if (!state) go('#/');
    }));

  const seenKey = 'mattar-celebrated:' + id;
  function celebrated() {
    try {
      return localStorage.getItem(seenKey) === '1';
    } catch {
      return false;
    }
  }
  let finaleOpen = false;
  async function showFinale() {
    if (finaleOpen || !state) return;
    finaleOpen = true;
    try {
      localStorage.setItem(seenKey, '1');
    } catch {}
    await celebrate({ travel: state.travel, members: state.members, j: state.j, toast });
    finaleOpen = false;
  }

  function renderCard() {
    const { j, travel, members } = state;
    const legs = j.legs
      .map((l) => {
        const fill = Math.max(0, Math.min(1, (j.position - l.from) / (l.to - l.from)));
        return `<div class="leg" style="flex:${l.to - l.from}"><div style="width:${fill * 100}%"></div></div>`;
      })
      .join('<i class="leg-dot"></i>');
    const left = j.next ? j.next.index - j.position : 0;
    card.innerHTML = `
      <div class="t-name">${esc(travel.name)}</div>
      <div class="legs"><i class="leg-dot on"></i>${legs}<i class="leg-dot${j.done ? ' on' : ''}"></i></div>
      <div class="t-next">${
        j.done
          ? `<b>You reached ${esc(FINAL_STOP.name)}!</b> <button class="t-celebrate" id="replay">Celebrate again</button>`
          : `Next: <b>${esc(j.next.name)}</b> · ${left} step${left === 1 ? '' : 's'} away`
      }</div>
      <div class="t-sub">Step ${j.position} of ${j.total} · ${members.length} traveller${members.length === 1 ? '' : 's'}${
        j.eta ? ` · arrive ~${fmtDate(j.eta)}` : ''
      }</div>`;
    card.querySelector('#replay')?.addEventListener('click', showFinale);
  }

  app.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => openLog(b.dataset.cat)));

  function openLog(cat) {
    const c = CATEGORIES[cat];
    sheet(
      `<div class="sheet-head">${bubbleButtonSvg(cat, 54)}<h3>${c.title}</h3></div>
       <p class="muted">${esc(c.hint)}</p>
       <form class="stack">
         <input class="input" id="note" maxlength="200" placeholder="${esc(c.placeholder)} (optional)">
         <button class="btn primary">Take a step</button>
       </form>`,
      (el, close) => {
        el.querySelector('form').onsubmit = (e) => {
          e.preventDefault();
          busy(el.querySelector('button.primary'), async () => {
            await be.logAction(id, cat, el.querySelector('#note').value.trim());
            close();
            refresh();
          });
        };
      }
    );
  }

  app.querySelector('#invite').onclick = () => {
    const code = state?.travel.code ?? '';
    const shared = be.kind === 'artifact';
    const base = shared ? CONFIG.SHARE_URL : `${location.origin}${location.pathname}`;
    const link = base ? (shared ? `${base}#join-${code}` : `${base}?join=${code}`) : '';
    const message = `Join our journey “${state?.travel.name}” on ${CONFIG.APP_NAME}!${link ? ` Open ${link}` : ''} and use code ${code}.`;
    const canShare = !shared && !!navigator.share;
    sheet(
      `<h3>Invite travellers</h3>
       <p class="muted">Send them this code${link ? ' and link' : ''}. Anyone with it can join “${esc(state?.travel.name)}”.</p>
       <div class="big-code">${esc(code)}</div>
       <div class="stack">
         <textarea class="input invite-text" id="invite-text" rows="3" readonly>${esc(message)}</textarea>
         ${canShare ? '<button class="btn primary" id="share">Share invite</button>' : ''}
         <button class="btn${canShare ? '' : ' primary'}" id="copy">Copy invite message</button>
       </div>`,
      (el) => {
        el.querySelector('#copy').onclick = async () => {
          try {
            await navigator.clipboard.writeText(message);
            toast('Invite copied');
          } catch {
            const ta = el.querySelector('#invite-text');
            ta.focus();
            ta.select();
            toast('Press copy on the highlighted text');
          }
        };
        el.querySelector('#share')?.addEventListener('click', () =>
          navigator.share({ title: CONFIG.APP_NAME, text: message, url: link || undefined }).catch(() => {})
        );
      }
    );
  };

  app.querySelector('#activity').onclick = () => openActivity();

  // Tapped a footprint on the road: who took this step, and why.
  function openStep(i) {
    const a = state?.j.sorted[i - 1];
    if (!a) return;
    const who = state.members.find((m) => m.user_id === a.user_id);
    const c = CATEGORIES[a.category];
    map.select(i);
    sheet(
      `<div class="sheet-head">${bubbleButtonSvg(a.category, 54)}<div>
         <h3>Step ${i} · ${esc(c?.label || a.category)}</h3>
         <div class="step-who">${avatar(who?.display_name, who?.avatar_url, 26)}<b>${esc(who?.display_name || 'Someone')}</b><span class="muted small">${timeAgo(a.created_at)}</span></div>
       </div></div>
       <p class="step-note${a.note ? '' : ' muted'}">${a.note ? `“${esc(a.note)}”` : 'No note for this step.'}</p>
       ${a.user_id === user.id ? '<button class="btn" id="del">Remove this step</button>' : ''}`,
      (el, close) => {
        el.querySelector('#del')?.addEventListener('click', (e) => {
          const btn = e.currentTarget;
          if (!armed(btn, 'Tap again to remove')) return;
          busy(btn, async () => {
            await be.deleteAction(a.id);
            close();
            refresh();
          });
        });
      },
      () => map.select(0)
    );
  }

  function openActivity() {
    if (!state) return;
    const { j, members } = state;
    const sorted = j.sorted;
    const names = Object.fromEntries(members.map((m) => [m.user_id, m]));
    const byCat = Object.keys(CATEGORIES).map((k) => [k, sorted.filter((a) => a.category === k).length]);
    const byMember = members
      .map((m) => ({ m, n: sorted.filter((a) => a.user_id === m.user_id).length }))
      .sort((a, b) => b.n - a.n);
    const recent = [...sorted].reverse().slice(0, 60);

    sheet(
      `<h3>Activity</h3>
       <div class="stat-row">${byCat
         .map(([k, n]) => `<div class="stat">${iconSvg(k, 22)}<b>${n}</b><span>${CATEGORIES[k].label}</span></div>`)
         .join('')}</div>
       <h4>Travellers</h4>
       <ul class="people">${byMember
         .map(({ m, n }) => `<li>${avatar(m.display_name, m.avatar_url, 30)}<span>${esc(m.display_name)}${m.user_id === user.id ? ' (you)' : ''}</span><b>${n}</b></li>`)
         .join('')}</ul>
       <h4>Latest steps</h4>
       <ul class="feed">${
         recent.length
           ? recent
               .map(
                 (a) => `<li><span class="feed-ic" style="background:var(--cat-${a.category})">${iconSvg(a.category, 18)}</span>
                 <div><b>${esc(names[a.user_id]?.display_name || 'Someone')}</b> · ${CATEGORIES[a.category]?.label || a.category}
                 ${a.note ? `<div class="feed-note">${esc(a.note)}</div>` : ''}<div class="muted small">${timeAgo(a.created_at)}</div></div>
                 ${a.user_id === user.id ? `<button class="x-btn" data-del="${a.id}" aria-label="Remove">×</button>` : ''}</li>`
               )
               .join('')
           : '<li class="muted">No steps yet. Be the first!</li>'
       }</ul>
       ${be.demo ? '<button class="btn" id="seed">Demo: add 3 friends + 10 steps</button>' : ''}`,
      (el, close) => {
        el.querySelectorAll('[data-del]').forEach(
          (b) =>
            (b.onclick = () => {
              if (!armed(b, 'Remove?')) return;
              busy(b, async () => {
                await be.deleteAction(b.dataset.del);
                close();
                refresh();
              });
            })
        );
        el.querySelector('#seed')?.addEventListener('click', (e) =>
          busy(e.currentTarget, async () => {
            await be.seedDemo(id);
            close();
            refresh();
          })
        );
      }
    );
  }

  const unsub = be.subscribe(id, () => refresh());
  cleanup = () => {
    alive = false;
    unsub();
    map.destroy();
  };
  refresh();
}

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.claude) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

main();
