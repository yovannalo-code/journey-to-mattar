import { CONFIG } from './config.js';

export const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;

export async function createBackend() {
  // Opened as a shared claude.ai page: use the page's own shared database.
  const shared = await artifactBackend();
  if (shared) return shared;
  return DEMO ? demoBackend() : supabaseBackend();
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

// ---------------------------------------------------------------- Shared claude.ai page (prototype)
// Everyone who opens the page with their Claude account plays together.
// Stores only ids; names and avatars are looked up fresh for each viewer.

async function artifactBackend() {
  if (!window.claude?.use) return null;
  const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
  if (!db || !user) return null;
  const me = await user.me();
  if (!me.id) return null;

  const nowIso = () => new Date().toISOString();
  const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const memberDoc = (tid, uid) => db.doc(`members/${tid}__${uid}`);
  const travelsCol = db.collection('travels');
  const membersCol = db.collection('members');
  const actionsCol = db.collection('actions');
  const friendly = (e) => {
    if (e?.code === 'invalid_argument') return new Error('You can look but not play yet. Ask the page owner to give you Contributor access.');
    if (e?.code === 'quota_exceeded') return new Error('The prototype is full. Ask the page owner to clear out old journeys.');
    return new Error(e?.message || 'Something went wrong. Try again.');
  };
  const run = (p) => p.catch((e) => Promise.reject(friendly(e)));
  async function withPeople(members) {
    const ps = await user.profiles(members.map((m) => m.user_id));
    return members.map((m) => ({
      ...m,
      display_name: ps[m.user_id]?.name || (m.user_id === me.id ? me.name || 'You' : 'Traveller'),
      avatar_url: ps[m.user_id]?.avatarUrl || null,
    }));
  }

  return {
    kind: 'artifact',
    demo: false,
    canSignOut: false,
    async currentUser() {
      return { id: me.id, name: me.name || 'You', avatar: me.avatarUrl };
    },
    onAuthChange() {},
    async signIn() {},
    async signOut() {},
    async listTravels() {
      const mine = rows(await run(membersCol.where('user_id', '==', me.id).get()));
      const out = await Promise.all(
        mine.map(async (m) => {
          const [t, mem, act] = await Promise.all([
            db.doc('travels/' + m.travel_id).get(),
            membersCol.where('travel_id', '==', m.travel_id).get(),
            actionsCol.where('travel_id', '==', m.travel_id).get(),
          ]);
          return t.exists ? { id: t.id, ...t.data(), memberCount: mem.size, stepCount: act.size } : null;
        })
      );
      return out.filter(Boolean).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async createTravel(name) {
      let code;
      do code = randomCode();
      while (!(await run(travelsCol.where('code', '==', code).limit(1).get())).empty);
      const ref = travelsCol.doc();
      const t = { name: name.trim().slice(0, 60), code, created_by: me.id, created_at: nowIso() };
      await run(ref.set(t));
      await run(memberDoc(ref.id, me.id).set({ travel_id: ref.id, user_id: me.id, joined_at: nowIso() }));
      return { id: ref.id, ...t };
    },
    async joinTravel(code) {
      const found = await run(travelsCol.where('code', '==', code.trim().toUpperCase()).limit(1).get());
      if (found.empty) throw new Error('No journey has that code. Check the 6 letters and try again.');
      const t = found.docs[0];
      const mine = await run(memberDoc(t.id, me.id).get());
      if (!mine.exists) await run(memberDoc(t.id, me.id).set({ travel_id: t.id, user_id: me.id, joined_at: nowIso() }));
      return { id: t.id, ...t.data() };
    },
    async getTravel(id) {
      const [t, mem, act] = await Promise.all([
        run(db.doc('travels/' + id).get()),
        run(membersCol.where('travel_id', '==', id).get()),
        run(actionsCol.where('travel_id', '==', id).get()),
      ]);
      const members = rows(mem);
      if (!t.exists || !members.some((m) => m.user_id === me.id)) throw new Error("You're not part of this journey. Join it with its code first.");
      return {
        travel: { id: t.id, ...t.data() },
        members: await withPeople(members),
        actions: rows(act).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      };
    },
    async logAction(travelId, category, note) {
      const a = { travel_id: travelId, user_id: me.id, category, note: note || null, created_at: nowIso() };
      const ref = await run(actionsCol.add(a));
      return { id: ref.id, ...a };
    },
    async deleteAction(id) {
      await run(db.doc('actions/' + id).delete());
    },
    subscribe(travelId, onChange) {
      const offs = [
        actionsCol.where('travel_id', '==', travelId).onSnapshot(() => onChange(), () => {}),
        membersCol.where('travel_id', '==', travelId).onSnapshot(() => onChange(), () => {}),
      ];
      return () => offs.forEach((off) => off());
    },
  };
}

// ---------------------------------------------------------------- Supabase

async function supabaseBackend() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { flowType: 'pkce' } });

  const toUser = (u) =>
    u && {
      id: u.id,
      name: u.user_metadata?.full_name || u.user_metadata?.name || u.email,
      avatar: u.user_metadata?.avatar_url || null,
    };
  const must = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  // Supabase returns at most 1000 rows per request, so page through big journeys.
  async function fetchAll(build) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = must(await build().range(from, from + 999));
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }

  return {
    kind: 'supabase',
    demo: false,
    canSignOut: true,
    async currentUser() {
      const { data } = await sb.auth.getSession();
      return toUser(data.session?.user);
    },
    onAuthChange(cb) {
      sb.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)));
    },
    async signIn() {
      await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async listTravels() {
      const rows = must(
        await sb.from('travels').select('id,name,code,created_at,members(count),actions(count)').order('created_at', { ascending: false })
      );
      return rows.map((r) => ({ ...r, memberCount: r.members[0]?.count ?? 0, stepCount: r.actions[0]?.count ?? 0 }));
    },
    async createTravel(name) {
      return must(await sb.rpc('create_travel', { p_name: name }));
    },
    async joinTravel(code) {
      return must(await sb.rpc('join_travel', { p_code: code }));
    },
    async getTravel(id) {
      const [travel, members, actions] = await Promise.all([
        sb.from('travels').select('*').eq('id', id).single().then(must),
        sb.from('members').select('*').eq('travel_id', id).then(must),
        fetchAll(() => sb.from('actions').select('*').eq('travel_id', id).order('created_at')),
      ]);
      return { travel, members, actions };
    },
    async logAction(travelId, category, note) {
      return must(await sb.from('actions').insert({ travel_id: travelId, category, note: note || null }).select().single());
    },
    async deleteAction(id) {
      must(await sb.from('actions').delete().eq('id', id));
    },
    subscribe(travelId, onChange) {
      const filter = `travel_id=eq.${travelId}`;
      const ch = sb
        .channel('travel-' + travelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'actions', filter }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter }, onChange)
        .subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

// ---------------------------------------------------------------- Demo (this browser only)

function demoBackend() {
  const KEY = 'wayfarers-demo';
  const blank = () => ({ users: {}, travels: [], members: [], actions: [] });
  const load = () => {
    try {
      return JSON.parse(store.get(KEY)) || blank();
    } catch {
      return blank();
    }
  };
  const save = (db) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* private window: keep playing, nothing is saved */
    }
  };
  const store = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
      } catch {}
    },
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
  const nowIso = () => new Date().toISOString();
  const listeners = new Set();
  const authCbs = [];
  const changed = () => listeners.forEach((f) => f());
  window.addEventListener('storage', (e) => e.key === KEY && changed());

  let me = store.get(KEY + ':me');
  const userOf = (id) => {
    const u = load().users[id];
    return u ? { id, name: u.name, avatar: null } : null;
  };
  const isMember = (db, tid, id = me) => db.members.some((m) => m.travel_id === tid && m.user_id === id);
  const memberRow = (db, tid, id, at = nowIso()) => ({ travel_id: tid, user_id: id, display_name: db.users[id].name, avatar_url: null, joined_at: at });
  const makeCode = (db) => {
    let code;
    do code = randomCode();
    while (db.travels.some((t) => t.code === code));
    return code;
  };

  return {
    kind: 'demo',
    demo: true,
    canSignOut: true,
    async currentUser() {
      return me ? userOf(me) : null;
    },
    onAuthChange(cb) {
      authCbs.push(cb);
    },
    async signIn(name) {
      name = (name || '').trim();
      if (!name) throw new Error('Type your name first');
      const db = load();
      let id = Object.keys(db.users).find((k) => db.users[k].name.toLowerCase() === name.toLowerCase());
      if (!id) {
        id = uid();
        db.users[id] = { name };
        save(db);
      }
      me = id;
      store.set(KEY + ':me', id);
      authCbs.forEach((cb) => cb(userOf(id)));
    },
    async signOut() {
      me = null;
      store.set(KEY + ':me', null);
      authCbs.forEach((cb) => cb(null));
    },
    async listTravels() {
      const db = load();
      return db.travels
        .filter((t) => isMember(db, t.id))
        .map((t) => ({
          ...t,
          memberCount: db.members.filter((m) => m.travel_id === t.id).length,
          stepCount: db.actions.filter((a) => a.travel_id === t.id).length,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async createTravel(name) {
      const db = load();
      const t = { id: uid(), name: name.trim(), code: makeCode(db), created_by: me, created_at: nowIso() };
      db.travels.push(t);
      db.members.push(memberRow(db, t.id, me));
      save(db);
      return t;
    },
    async joinTravel(code) {
      const db = load();
      const t = db.travels.find((x) => x.code === code.trim().toUpperCase());
      if (!t) throw new Error('No journey has that code');
      if (!isMember(db, t.id)) db.members.push(memberRow(db, t.id, me));
      save(db);
      changed();
      return t;
    },
    async getTravel(id) {
      const db = load();
      const travel = db.travels.find((t) => t.id === id);
      if (!travel || !isMember(db, id)) throw new Error("You're not part of this journey");
      return {
        travel,
        members: db.members.filter((m) => m.travel_id === id),
        actions: db.actions.filter((a) => a.travel_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      };
    },
    async logAction(travelId, category, note) {
      const db = load();
      if (!isMember(db, travelId)) throw new Error("You're not part of this journey");
      const a = { id: uid(), travel_id: travelId, user_id: me, category, note: note || null, created_at: nowIso() };
      db.actions.push(a);
      save(db);
      changed();
      return a;
    },
    async deleteAction(id) {
      const db = load();
      db.actions = db.actions.filter((a) => !(a.id === id && a.user_id === me));
      save(db);
      changed();
    },
    subscribe(_travelId, onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    // Demo-only helper: adds three pretend friends and some steps so you can see the map move.
    async seedDemo(travelId, steps = 10) {
      const db = load();
      const t0 = Date.now();
      const friends = ['Ana', 'Ben', 'Chloe'].map((name) => {
        let id = Object.keys(db.users).find((k) => db.users[k].name === name);
        if (!id) db.users[(id = uid())] = { name };
        if (!isMember(db, travelId, id)) db.members.push(memberRow(db, travelId, id, new Date(t0 - 1000).toISOString()));
        return id;
      });
      const cats = Object.keys({ savings: 1, tithe: 1, initiatives: 1 });
      const notes = [null, 'Brought lunch from home', 'Skipped Grab, took the bus', 'Sunday offering', 'Helped at the welcome table', null];
      for (let i = 0; i < steps; i++) {
        db.actions.push({
          id: uid(),
          travel_id: travelId,
          user_id: friends[i % friends.length],
          category: cats[Math.floor(Math.random() * cats.length)],
          note: notes[Math.floor(Math.random() * notes.length)],
          created_at: new Date(t0 + i).toISOString(),
        });
      }
      save(db);
      changed();
    },
  };
}
