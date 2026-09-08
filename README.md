# Bronco Trailer Inspection — Rhino Energy Solutions

A mobile-first Progressive Web App (PWA) for inspecting the Bronco flatbed
trailer: inspector/site details, a 53-item checklist across 10 sections,
required photo evidence per item, a finger-signature pad, and one-tap PDF
export straight to WhatsApp, email, or anything else on the phone's share
sheet.

It's a static site — no build step, no server, no database. Everything
(including photos and the signature) is generated and stored on the
inspector's own phone; nothing is uploaded anywhere. The PDF is the record,
and it's the inspector's job to send it on.

## Publishing it (GitHub Pages)

1. Push all these files to the root of your repository (`RhinoEnergyDavidWH/CPT-Trailer-Inspection`).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Pick the `main` branch and the `/ (root)` folder, then **Save**.
5. After a minute or two your app is live at:
   `https://rhinoenergydavidwh.github.io/CPT-Trailer-Inspection/`

Because the repo is **public**, GitHub Pages works on the free plan. If you
ever switch it to private, Pages hosting needs a paid GitHub plan (Pro,
Team or Enterprise) to keep working.

## Installing it on a phone

- **Android (Chrome):** open the link above, wait for the "Install app" /
  "Add to Home screen" prompt (or use the ⋮ menu → *Add to Home screen*).
- **iPhone (Safari):** open the link, tap the Share icon, then
  **Add to Home Screen**. iOS doesn't offer an automatic install prompt —
  this manual step is the only way to install any web app on iOS, not a bug.

Once installed it opens full-screen, with its own icon, like any other app.

## File structure

```
index.html              the app shell (all markup)
styles.css               all styling (dark theme, matches your other RES apps)
app.js                   all app logic — checklist data, state, photo capture,
                          signature pad, PDF export
manifest.json             PWA manifest (name, icons, colours, install behaviour)
sw.js                     service worker — caches the app so it opens and works
                          with no signal after the first visit
vendor/jspdf.umd.min.js   PDF generation library, bundled locally (no external
                          dependency at runtime — works even on a locked-down
                          work Wi-Fi)
icons/                    app icons generated from your RES logo manual
                          (icon-192, icon-512, maskable-512, apple-touch-icon,
                          favicon)
```

## Editing the checklist

Everything about the checklist — section names, item names, how many
sections/items there are — lives in one place: the `CHECKLIST` constant at
the top of `app.js`. Add, remove or rename items there; the rest of the app
(numbering, stats, PDF layout) updates itself automatically. No other file
needs to change.

## Updating the app later

Bump the version number in `sw.js` (`CACHE_NAME = 'bronco-inspection-v1'` →
`'v2'`, etc.) whenever you change `index.html`, `styles.css` or `app.js` and
push. That tells phones that already installed the app to fetch the new
version instead of serving the old cached one.

## Notes on the checklist as built

- Every item has its own condition buttons (Good / Fair / Damaged /
  Unusable / N/A – Not Fitted), its own description box, and its own photo —
  nothing is grouped.
- A photo is required on every item **except** ones marked N/A – Not
  Fitted.
- The Braking System section assumes a trailer with a mechanical handbrake
  only (no electric brakes/battery) — a breakaway cable that pulls the
  handbrake on disconnection. If a future trailer in the fleet does have
  electric brakes, that section is the one to extend.
- A draft (including photos already taken) is saved on-device automatically
  as you go, so a dropped signal or an accidental tab close doesn't lose the
  inspection — it's still there next time the app is opened, until you tap
  **Start New Inspection**.

---
*This document was developed with the assistance of an AI agent under the direction of qualified RES personnel.*
