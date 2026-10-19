import { mulberry32, hashStr } from './util.js';
import { STOP_TYPES } from './stops.js';

// Pacing: 12 legs × 4 steps = 48 actions per person.
// At 2–3 actions a week each, a group arrives in about 4–5 months, whatever its size.
export const STEPS_PER_PERSON_PER_LEG = 4;
export const PACE_PER_PERSON_PER_WEEK = 2.5;

// The 13 stops, Base Camp to Tannery (drawings and models live in stops.js).
export const STOPS = STOP_TYPES;
export const FINAL_STOP = STOPS[STOPS.length - 1];

export const CATEGORIES = {
  savings: {
    label: 'Savings',
    title: 'I saved money',
    color: '#f0c541',
    hint: 'Skipped a bubble tea, took the bus instead of Grab, cooked at home…',
    placeholder: 'e.g. Took the MRT instead of Grab',
  },
  tithe: {
    label: 'Tithe',
    title: 'I gave my tithe',
    color: '#e9785b',
    hint: 'Gave your tithe or an offering.',
    placeholder: 'e.g. Sunday offering',
  },
  initiatives: {
    label: 'Initiative',
    title: 'I took an initiative',
    color: '#8cb7dc',
    hint: 'Started something new, served, or helped someone out.',
    placeholder: 'e.g. Organised a CG dinner',
  },
};

// Every action = one step. Each leg's length is locked when the group takes its
// first step on that leg, using how many people were in the group at that moment.
// People who join later make the *upcoming* legs longer, never the ones already walked.
export function computeJourney(members, actions, now = Date.now()) {
  const sorted = [...actions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const joins = members.map((m) => new Date(m.joined_at).getTime());
  const peopleAt = (t) => Math.max(1, joins.filter((j) => j <= t).length);

  const legs = [];
  let from = 0;
  for (let i = 1; i < STOPS.length; i++) {
    const first = sorted[from];
    const people = first ? peopleAt(new Date(first.created_at).getTime()) : Math.max(1, members.length);
    const length = people * STEPS_PER_PERSON_PER_LEG;
    legs.push({ from, to: from + length, people, locked: !!first });
    from += length;
  }
  const total = from;
  const steps = sorted.length;
  const position = Math.min(steps, total);
  const stops = STOPS.map((s, i) => {
    const index = i ? legs[i - 1].to : 0;
    return { ...s, index, reached: position >= index };
  });
  const next = stops.find((s) => !s.reached) || null;

  let eta = null;
  if (next) {
    const firstAt = sorted[0] ? new Date(sorted[0].created_at).getTime() : now;
    const days = (now - firstAt) / 864e5;
    const expectedPerDay = (Math.max(1, members.length) * PACE_PER_PERSON_PER_WEEK) / 7;
    const perDay = days >= 7 && steps > 0 ? steps / days : expectedPerDay;
    eta = new Date(now + ((total - position) / perDay) * 864e5);
  }

  return { legs, total, steps, position, stops, next, eta, done: !next, cats: sorted.map((a) => a.category), sorted };
}

// The road: a winding line of tiles on the isometric grid. Tile i has x + y = i,
// so the road always heads "down" the map, wandering left and right.
export function buildPath(seed, length) {
  const r = mulberry32(hashStr(seed));
  const path = [{ x: 0, y: 0 }];
  let dir = 0, run = 0;
  for (let i = 1; i < length; i++) {
    const p = path[i - 1];
    if (run <= 0) {
      const drift = p.x - p.y; // nudge back toward the middle
      const pX = 0.5 - Math.max(-0.35, Math.min(0.35, drift * 0.06));
      dir = r() < pX ? 0 : 1;
      run = 2 + Math.floor(r() * 4);
    }
    run--;
    path.push(dir === 0 ? { x: p.x + 1, y: p.y } : { x: p.x, y: p.y + 1 });
  }
  return path;
}
