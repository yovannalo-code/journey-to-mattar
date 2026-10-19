# Journey to Mattar

A group journey game for phones. Your group shares one traveller on a hand-drawn map. Every **savings**, **tithe** or **initiative** someone logs moves the traveller one step down the road, past 11 stops from the Village Well to the Watchtower, all the way to the Tannery in Mattar.

- Anyone can **start a journey** and gets a 6-letter code (and an invite link) to share.
- Groups never see each other. One person can be in many groups.
- **Pacing:** 48 steps per person (12 legs × 4). At 2–3 actions a week each, a group arrives in about 4–5 months, whatever its size. Each leg's length is locked when the group starts walking it, so people joining later only lengthen the legs still ahead.

It's a plain web app (no app store). Open the link on any phone; tap **Share → Add to Home Screen** for an app icon.

## Try it now (demo mode)

With `js/config.js` empty the game runs in demo mode. There's no Google sign-in, you just type a name, and data stays in that browser.

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. In a journey, **Activity → Demo: add 3 friends + 10 steps** shows the map moving.

## Go live (about 20 minutes, all free tiers)

1. **Supabase** (database + login): create a project at https://supabase.com.
   - SQL Editor → paste `supabase/schema.sql` → Run.
   - Project Settings → API → copy the **Project URL** and **anon public key** into `js/config.js`.
2. **Google sign-in**
   - In https://console.cloud.google.com create an *OAuth client ID* (type: Web application).
     Add the authorised redirect URI shown in Supabase → Authentication → Providers → Google
     (it looks like `https://<project>.supabase.co/auth/v1/callback`).
   - Paste the Google client ID and secret into that Supabase Google provider page and enable it.
3. **Host it**: put this folder on Vercel or Netlify (drag-and-drop the folder, or `npx vercel`).
   - Then in Supabase → Authentication → URL Configuration, set **Site URL** to your new address
     (e.g. `https://journey-to-mattar.vercel.app`) and add it under **Redirect URLs**.

## Files

| File | What it does |
|---|---|
| `js/journey.js` | Categories, pacing rules, road generation |
| `js/stops.js` | The 13 stops: names, drawings (and 3D models, used only by the stops preview page) |
| `js/world.js` | What stands where on the map |
| `js/map3d.js` | An experimental 3D map (not used by the app) |
| `js/map.js` | The scrolling Sketch map: drawn once as a layer that slides when you drag or walk |
| `js/art.js` | All the hand-drawn pieces (trees, mountains, buildings, the sheep traveller, bubbles) |
| `js/app.js` | Screens: sign-in, journey list, map, logging, invites, activity |
| `js/backend.js` | Supabase calls, plus the demo-mode stand-in |
| `supabase/schema.sql` | Tables, privacy rules, create/join functions |
