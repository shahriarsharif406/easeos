# EaseOS — Build Plan (architect spec)

> The coder implements **strictly from this file**. Where something is not specified, choose the simplest option that keeps the app honest, accessible and calm. Do not add features that aren't listed here.

Hackathon: Roxten Studios "Build Your Own Website" (Devpost). Deadline **Nov 25 2026, 9:30pm GMT+6**. It must be a live public site on GitHub Pages plus a public GitHub repo, and the README and Devpost page must say that AI was used.

---

## 1. Pitch, 10-second explanation, demo scripts

**One-sentence pitch**
> Most productivity apps make you more tired. EaseOS measures its own fatigue and simplifies itself to match how you feel.

**10-second explanation (first-screen copy)**
> A tiny planner (Today, Habits, Focus) with a **Friction Meter** that scores how heavy the screen is. Slide **Energy** to Low and the app shrinks to one task. The score drops, and you can see why.

**30-second demo script** (screen recording, Today tab, demo data loaded, Energy = High)
1. 0–5s: "This is a normal busy productivity dashboard." The Friction ring reads **~82**.
2. 5–10s: Open "How is this calculated?" for a moment. "It counts buttons, words, competing panels, colours and motion on this screen, live."
3. 10–20s: Drag Energy to **Low**. The dashboard exhales into **one task**, big type, one button. The ring counts down to **~18**.
4. 20–27s: Turn on the **Dyslexia-friendly** lens. The font, spacing and line length change. The label says "approximate simulation".
5. 27–30s: Press **Done**. "Less app when you have less energy. EaseOS."

**2-minute demo script**
1. (0:00) Problem: "Planners add screens, badges and choices. On a bad day that is the opposite of help."
2. (0:15) Tour in **High**: tasks, habits strip, focus mini, stats, upcoming. Ring ~82.
3. (0:35) Open the explainer dialog. Show the live breakdown table (6 factors, raw counts, weights, points). "No AI guesswork. It's a transparent formula over the real DOM."
4. (0:55) **Normal**: fewer panels, row actions tucked into a menu. Ring ~44.
5. (1:05) **Low**: one task, "Not this one" to skip, "Done". Ring ~18.
6. (1:20) Lenses: Low-vision (blur/contrast-loss simulation), Dyslexia-friendly, Calm (motion and colour removed, which the ring picks up), Keyboard-only (mouse disabled; only Tab, Enter, Space and Esc work).
7. (1:40) Habits and Focus in Low energy: three big habit toggles, and one big "Start 10 min" focus button. Refresh the page and everything is still there (LocalStorage).
8. (1:55) "No backend, no tracking, no build step. Your data stays on your device."

---

## 2. File structure and state model

```
easeos/
├─ index.html              # single page, all screens as <section>s, hash router
├─ css/
│  ├─ tokens.css           # design tokens (section 7), pasted verbatim
│  ├─ base.css             # reset, typography, layout shell, focus styles, utilities (.sr-only)
│  ├─ components.css       # buttons, cards, task row, habit chip, segmented energy control, ring, dialog, toast
│  ├─ energy.css           # all [data-energy] rules (section 4)
│  └─ lenses.css           # all .lens-* rules (section 5)
├─ js/
│  ├─ app.js               # entry (type="module"): load store, init modules, hash router, keyboard shortcuts
│  ├─ store.js             # load/save/migrate LocalStorage, seed demo data, pub/sub (subscribe(fn), update(mutator))
│  ├─ friction.js          # pure-ish measurement: measure(rootEl) -> {score, factors[]}; no DOM writes
│  ├─ meter-ui.js          # ring render + count animation, explainer dialog with live table, recompute scheduling
│  ├─ energy.js            # set/get energy, writes html[data-energy], view-transition wrapper
│  ├─ lenses.js            # toggle lenses, html classes, keyboard-only pointer lock, disclaimer toast
│  ├─ today.js             # tasks: render list, quick add, toggle/pin/delete, pickOneTask()
│  ├─ habits.js            # habits: render, toggle today, streak calc, add/delete
│  ├─ focus.js             # timer: start/pause/reset, resume after refresh, session log
│  ├─ dialog.js            # <dialog> helpers: open/close, focus return, confirm(text) -> Promise<bool>
│  └─ util.js              # uid(), todayKey(), debounce(), clamp(), prefersReducedMotion()
├─ assets/
│  ├─ logo.svg             # section 7 logo
│  ├─ favicon.svg          # same mark, 32px-optimised
│  └─ og-image.png         # 1200x630 screenshot: High (82) vs Low (18) side by side
├─ README.md
└─ LICENSE                 # MIT
```

- No build step and no frameworks. Use `<script type="module" src="js/app.js">`. Modules need http(s), so for local testing run `python3 -m http.server 8000`.
- Load fonts with one Google Fonts `<link>` using `display=swap`. Every font stack has a system fallback.
- All paths are relative (`./css/...`) so the site works under `https://<user>.github.io/easeos/`.

### LocalStorage
One key holds all data: **`easeos.v1`**. Storing it as a single JSON blob makes saves atomic and keeps "Clear all data" trivial. A separate key **`easeos.session`** goes in `sessionStorage` (not localStorage) and holds the Low-mode skip index.

```json
{
  "version": 1,
  "tasks": [
    { "id": "t_k3j9", "title": "Reply to Sara about the venue", "note": "", "priority": "high",
      "pinned": false, "done": false, "createdAt": 1764000000000, "doneAt": null }
  ],
  "habits": [
    { "id": "h_a1", "name": "Drink water", "color": "sage", "log": { "2026-11-22": true }, "createdAt": 1764000000000 }
  ],
  "focus": {
    "defaultMinutes": 25,
    "active": null,
    "sessions": [ { "startedAt": 1764000000000, "minutes": 25, "completed": true } ]
  },
  "prefs": { "energy": "normal", "lenses": [], "introDismissed": false, "demoLoaded": true }
}
```

- `priority`: `"low" | "med" | "high"`. `color` is one of the palette names `clay | ochre | sage | plum | dusk | rose`. Habit `log` keys come from `todayKey()`, which returns local `YYYY-MM-DD`.
- `focus.active` is either `null` or `{ "startedAt": ms, "durationMs": n, "pausedRemainingMs": n|null }`. Remaining time is always derived from `Date.now()`, so a refresh resumes the timer correctly. When remaining time is ≤0 on load, record the session as completed and set `active` back to `null`.
- **Versioning:** `store.load()` parses the key. If it is missing, seed demo data (section 6) with `prefs.energy = "high"` so the first visit shows the busy screen (82). If `version < CURRENT`, run `migrations[v]` in sequence. If the JSON is corrupt, back the raw string up to `easeos.corrupt.<ts>`, reseed, and show the toast "Saved data was unreadable and was reset. A backup was kept."
- Saves are debounced (150 ms), wrapped in try/catch, and show a toast "Couldn't save (storage full or blocked)" on failure.
- `store.update(fn)` mutates a clone, saves it, then notifies subscribers. Every render module subscribes, and the meter recompute runs after renders (section 3).

---

## 3. Friction Meter — exact formula

### Measurement scope (DOM-based, honest)
- **Root** is `#app`, the whole app shell: header, nav, energy control, lens bar and the active screen.
- **Excluded**: anything inside `[data-fx-ignore]`. That covers only the meter widget itself (the ring and its "How is this calculated?" button), the explainer dialog, and toasts. This exclusion is disclosed in the explainer.
- An element counts as **visible** when `el.checkVisibility({checkOpacity:true, checkVisibilityCSS:true})` is true. Fallback: computed `display != none`, `visibility != hidden`, `opacity > 0`, and `getBoundingClientRect()` width and height both > 0. Content scrolled off-screen inside the page **still counts**. It is part of "this screen", and counting it keeps the score stable while scrolling.

### Six factors (each normalised to 0–1 and capped at 1)

| # | Factor | Raw measurement | Cap | Weight |
|---|--------|-----------------|-----|--------|
| I | Interactive elements | visible `button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])`, excluding `disabled` | 40 | **30** |
| W | Words | TreeWalker over text nodes whose parent element is visible; `text.trim().split(/\s+/).filter(Boolean).length` (aria-labels are not counted) | 300 | **20** |
| K | Competing regions | visible elements with `[data-fx-region]` (each panel or card that asks for its own attention or action) | 8 | **15** |
| V | Colour variety | distinct hue buckets (see below) across computed `color`, `background-color`, `border-top-color` of visible elements | 10 | **10** |
| C | Low-contrast text | share of visible text-bearing elements whose contrast is < 4.5:1 (< 3:1 if font-size ≥ 24px, or ≥ 18.66px and weight ≥ 700) | 0.30 | **10** |
| M | Motion | count of `document.getAnimations()` with `playState==="running"`, infinite iterations, target inside root (not ignored) **+** visible `[data-fx-motion]` elements (JS-driven ticking such as a running clock or timer) | 4 | **15** |

```
score = round( 30*min(I/40,1) + 20*min(W/300,1) + 15*min(K/8,1)
             + 10*min(V/10,1) + 10*min(C/0.30,1) + 15*min(M/4,1) )   // 0..100
```

**Hue buckets (V):** parse each colour to RGB in 0–1 and skip it if alpha < 0.5. Chroma = max − min. If chroma < 0.15, the colour falls in the single **"neutral"** bucket. Otherwise bucket = `floor(hue° / 30)`, giving 12 buckets. V = number of distinct buckets used, with neutral counting as 1. (Chroma is used instead of HSL saturation so that the warm oat background is neutral.)

**Contrast (C):** a text-bearing element has at least one direct non-empty text node. The foreground is its computed `color`. The background comes from walking up the ancestors to the first `background-color` with alpha ≥ 0.5, falling back to `--bg`. Use the WCAG relative-luminance formula. The design is built to pass, so **C is normally 0**. That is fine, and it shows the meter isn't rigged. The factor exists so that themes or lenses that do hurt contrast get penalised.

**Recompute:** use a `MutationObserver` on `#app` (`childList, subtree, attributes: ['class','hidden','data-energy']`) plus `resize`, debounced 250 ms, then wait for `transitionend` or 400 ms, whichever comes first, before measuring. Also recompute on energy change, lens change and route change. Measuring is read-only and takes about 2–5 ms on ~500 nodes, which is acceptable.

**Ring colour:** 0–33 is `--sage`, 34–66 is `--ochre`, 67–100 is `--clay`. A text label sits under the number: "Light", "Moderate" or "Heavy". Colour is never the only cue.

### Worked examples (targets the seeded demo must hit)

| Energy | I | W | K | V | C | M | Points (I+W+K+V+C+M) | Score |
|---|---|---|---|---|---|---|---|---|
| **High** | ≥40 | ≥300 | 7 | 8 | 0 | 3 | 30 + 20 + 13.125 + 8 + 0 + 11.25 = 82.375 | **82** |
| **Normal** | 24 | 150 | 4 | 5 | 0 | 1 | 18 + 10 + 7.5 + 5 + 0 + 3.75 = 44.25 | **44** |
| **Low** | 7 | 60 | 3 | 3 | 0 | 0 | 5.25 + 4 + 5.625 + 3 + 0 + 0 = 17.875 | **18** |

Where the numbers come from (Today screen, demo data):
- **High I ≈ 46**: nav 4 (Today, Habits, Focus, About), energy radios 3, lens toggles 4, quick add 3 (input, priority select, Add), 8 tasks × 3 (checkbox, pin, delete) = 24, habit strip 5 toggles, focus mini Start 1, "Clear completed" 1, intro "Got it" 1 → 46, capped at 40.
- **High W ≈ 300+**: intro strip, 8 task titles with meta line ("High · added today"), habit names with streak text ("4-day streak"), stats card, a "Coming up" card (4 items), and a "Tip of the day" card (~50 words). If W comes out short, **lengthen the seed content, not the weights**.
- **High K = 7**: `data-fx-region` on Intro strip, Quick add, Task list, Habits strip, Focus mini, Stats, Coming up. The tip card sits inside Stats and is not its own region.
- **High V = 8**: neutral, clay, ochre, sage, plum, dusk, rose (habit and priority chips), plus the ochre/clay stats bars → 7 hues + neutral.
- **High M = 3**: the header clock ticking each second (`data-fx-motion`), a pulsing "next up" dot (infinite CSS animation), and a slow shimmer on the habit progress bar (infinite CSS animation). These all exist **only in High** and stop under `prefers-reduced-motion`.
- **Normal I ≈ 24**: nav 4, energy 3, lenses 4, quick add 2 (input + Add), 5 tasks × 2 (checkbox + "…" menu button) = 10, "See habits" link 1 → 24. K = 4: Quick add, Task list, Habit summary, Focus mini. M = 1: the clock.
- **Low I = 7**: energy radios 3, Done 1, "Not this one" 1, "Show everything" 1 (switches to Normal), "Lenses" 1 (opens a popover). W ≈ 60. K = 3: energy control, the one-task card, footer strip. V = 3: neutral, clay, sage.
- **Tolerance:** High must land at 78–86 and Low at 14–22. Write a console helper `window.easeosFriction()` that logs the factor table so the coder can tune content.
- **Honest side effects to document:** a user with reduced motion sees High at ~71 (M = 0). The Calm lens lowers the score (it removes motion and colour). The Dyslexia and Low-vision lenses barely move it, because the meter measures **structure, not perception**. That is stated in the explainer.

### Explainer dialog ("How is this calculated?")
A `<dialog>` with a live table of six rows: factor, what is counted, raw value, cap, weight, points. Below the table, the formula in `<code>`, then these lines:
- "Measured from the live page (DOM), every time something changes. The meter itself is not counted."
- "This is a heuristic, not a medical or scientific measurement of fatigue."

---

## 4. Energy modes

`energy.js` sets **`<html data-energy="low|normal|high">`** and saves `prefs.energy`.

**Visibility attributes** on elements:
- `data-min-energy="normal"`: hidden in Low.
- `data-min-energy="high"`: hidden in Low and Normal.
- `data-only-energy="low"`: shown only in Low.

```css
[data-energy="low"] [data-min-energy="normal"],
[data-energy="low"] [data-min-energy="high"],
[data-energy="normal"] [data-min-energy="high"],
[data-energy="normal"] [data-only-energy="low"],
[data-energy="high"] [data-only-energy="low"] { display: none !important; }
```
Use `display:none` rather than `opacity`, so the elements leave the tab order and the meter honestly stops counting them.

| Area | High | Normal | Low |
|---|---|---|---|
| Header | logo, wordmark, tagline, clock HH:MM:SS ticking every second (`data-fx-motion`), energy, ring | logo, wordmark, clock HH:MM updating every minute (still carries `data-fx-motion` → M=1), energy, ring | wordmark only (no clock), energy, ring |
| Nav tabs | visible | visible | **hidden**; footer has "Show everything" |
| Lens bar | 4 toggle buttons | 4 toggle buttons | one "Lenses" button → popover listing 4 |
| Intro strip | visible until dismissed | hidden | hidden |
| Today | full dashboard (section 6) | list (max 5 open tasks + "n more"), quick add, habit summary line, focus mini | **one task card** |
| Task row actions | checkbox, pin, delete inline | checkbox + "…" menu (pin, delete) | Done button only |
| Habits | grid with 7-day dots and streaks | list with today toggle + streak number | max 3 undone habits as big toggles |
| Focus | ring timer, presets 10/25/50, log | timer + start/pause/reset | one big "Start 10 min" (or Pause), large digits |
| Type scale | `--fs-base` 16px | 17px | 22px; task title `clamp(2rem, 6vw, 3rem)` |
| Colour | full palette | palette minus rose/dusk accents (chips become neutral) | ink, surface, clay, sage only |
| Ambient motion | pulse dot, shimmer, clock seconds | none (clock minutes only) | none |

Implementation notes:
- Energy-specific tokens go in `energy.css`, e.g. `[data-energy="low"] { --fs-base: 1.375rem; --gap: 2rem; --radius-card: 28px; }`. In Normal, chips use `[data-energy="normal"] .chip { background: var(--surface-2); color: var(--ink-2); }`.
- **pickOneTask()** (Low): open tasks sorted by pinned first, then priority high > med > low, then oldest `createdAt`. The index comes from `sessionStorage['easeos.session'].skip`. "Not this one" increments it modulo the count. When there are no open tasks, show: "Nothing left. Rest is a valid task." plus a single "Add one" button. That button counts toward I, still about 7.
- Low card copy: small label "Just this one", the task title, the button **Done** (full width, 72px tall), the text link "Not this one", and a line "Everything else is saved and waiting."
- **Energy control:** three native radio inputs in a `role="radiogroup"` `<fieldset>` with legend "Energy", styled as a 3-stop pill "slider" with a sliding thumb. Arrow keys work natively. Shortcuts `[` and `]` lower and raise energy (ignored while focus is in a text field).
- **Collapse animation:** wrap the change in `document.startViewTransition(() => setEnergy(v))` when it is available and motion is allowed. Without it, add `.is-exhaling` to `#screen`: opacity 1→0, scale 1→.985 over 180 ms, swap, then fade in over 240ms. Under reduced motion, swap instantly. The ring animates from the old score to the new one (section 7).

---

## 5. Lenses (BarrierMirror)

`lenses.js` toggles classes on `<html>`: `lens-lowvision`, `lens-dyslexia`, `lens-calm`, `lens-keyboard`. They can be combined and are saved in `prefs.lenses`. Each toggle is a `<button aria-pressed>`. The lens bar sits **outside** the effects (see keyboard lens) but inside `#app`, so it is counted.

**Persistent disclaimer:** while any lens is active, show a slim banner under the header (`role="status"`):
> **Approximate simulation.** Real experiences vary widely. This is a design aid, not a diagnosis or a substitute for testing with disabled people. [Turn off lenses]

Every lens button label ends with "(approx.)" in its tooltip and accessible description.

| Lens | Technique |
|---|---|
| **Low-vision** (simulation) | `.lens-lowvision #screen { filter: blur(1.6px) contrast(.8) brightness(1.04); }` plus a fixed overlay `#lv-vignette` (`pointer-events:none`, `radial-gradient(circle at 50% 45%, transparent 45%, rgba(43,38,32,.55) 100%)`). Header and lens bar stay sharp so the user can turn it off. Helper note: "Can you still find the main button?" |
| **Dyslexia-friendly** | Switch to pairing 2: `--font-body: "Lexend", "Atkinson Hyperlegible", system-ui;` also used for headings; `letter-spacing:.04em; word-spacing:.16em; line-height:1.8;` `max-width: 60ch` on text blocks; `text-align:left`; no italics (`font-style:normal !important`); no all-caps (`text-transform:none !important`); background tinted `--bg-dyslexia: #FBF3DF`. |
| **Calm** | `animation: none !important; transition-duration: .01ms !important` inside `#app`; set `data-calm` so JS pauses the clock's seconds tick (remove `data-fx-motion`); hide `[data-fx-noise]` items (badges, streak counters, "n more" pills); remap chip and habit colours to `--surface-2`/`--ink-2`. The ring drops noticeably, which is honest because colour and motion really were removed. |
| **Keyboard-only** | Simulates having no mouse. Add `pointer-events:none; cursor:none` to `#screen` and nav (the lens bar stays clickable so the user is never trapped). Use thick focus rings (`outline: 4px solid var(--clay); outline-offset: 3px`) and reveal the "Skip to main" link permanently. Show a small counter: "Tab stops to the main action: N", computed by counting focusable elements in DOM order up to `[data-primary-action]` in the current screen. Esc also turns the lens off. |

---

## 6. Screen-by-screen layout

**App shell (all screens)**
- `header.app-header`: logo + wordmark "EaseOS", tagline (High only), clock, the Energy control, and the **Friction ring** (`data-fx-ignore`, 56px desktop / 44px mobile, number inside, label below, "How is this calculated?" as an icon button with a visible text tooltip and `aria-label`).
- `nav.tabs` (`role="tablist"` is not needed; use plain links with `aria-current="page"`): Today · Habits · Focus · About. Desktop puts it on the left under the header. On mobile ≤640px it becomes a fixed bottom bar.
- `div.lens-bar`, the lens disclaimer banner, then `main#screen` holding one `<section data-route>` visible at a time, and `footer.app-footer`: "Data stays on this device · Load demo data · Clear all data", plus "Show everything" in Low.
- Max content width 1120px. On desktop High, Today uses a 12-column grid; on mobile it is a single column. Spacing comes from tokens.

**Today — High (dashboard)**
1. Intro strip (`data-fx-region`, `data-min-energy="high"`): the 10-second copy + "Got it".
2. Quick add (`data-fx-region`): text input "Add a task…", priority `<select>`, Add button. Enter submits.
3. Task list (`data-fx-region`): rows have a checkbox, title, meta line, pin button and delete button. Completed tasks collapse into a "Done today (n)" `<details>`.
4. Habits strip (`data-fx-region`, `data-min-energy="high"`): 5 chips with a toggle each, a streak count, and a progress bar with shimmer.
5. Focus mini (`data-fx-region`): remaining time + Start/Pause.
6. Stats (`data-fx-region`, `data-min-energy="high"`): tasks done today, focus minutes, a tiny bar per day for the last 7 days, and the tip card inside.
7. Coming up (`data-fx-region`, `data-min-energy="high"`): 4 static gentle items from seed (e.g. "Tomorrow · Groceries").

**Today — Normal:** Quick add, task list (max 5 open, "+n more" expands), habit summary line ("3 of 5 habits today · See habits"), focus mini.
**Today — Low:** the one-task card (`data-only-energy="low"`, `data-fx-region`, `data-primary-action` on Done).

**Habits:** an add form (name + colour swatch radio group of 6) and a habit list. High shows a 7-day dot row and a streak. Normal shows today's toggle + streak. Low shows up to 3 undone habits as big toggles, and "All done for today" when none are left. Delete always goes through `dialog.confirm`. Streak = consecutive days with `log[day]===true` ending today, or ending yesterday if today isn't logged yet.

**Focus:** the big timer (SVG ring, separate from the friction ring), presets 10/25/50 (High/Normal), Start/Pause/Reset, and the last 5 sessions (High). Low shows one button with large digits. On completion: a toast "Focus done. Take a breath." plus an optional short WebAudio chime, off when Calm is active. `document.title` shows the remaining time while the timer runs.

**About / How it works** (`#/about`, short): three cards.
1. "Why": two sentences.
2. "The Friction Meter": the formula and a link to open the explainer.
3. "Lenses are approximate": the disclaimer.
Then the honesty list (section 9, condensed), "Built with plain HTML/CSS/JS, AI-assisted, see README", and a link to the GitHub repo.

**Seed demo data:** 8 tasks with mixed priorities and 1 pinned ("Send the project proposal draft"); 5 habits (Drink water/sage, Stretch 5 min/ochre, Read 10 pages/plum, Walk outside/dusk, No phone after 11pm/rose) with plausible 7-day logs; 6 past focus sessions. "Load demo data" asks for confirmation before replacing data.

**Components:** Button (primary/secondary/ghost/icon), Card, TaskRow, HabitChip, HabitToggleBig, SegmentedEnergy, FrictionRing, FocusRing, LensToggle, LensPopover, Banner, Toast (`aria-live="polite"`), Dialog (confirm + explainer), EmptyState.

---

## 7. Design system

**Identity: "Clay & Oat".** Warm paper, soft clay accents, editorial serif headings. It should feel like a calm notebook rather than a SaaS console. There is no navy or electric blue and no Inter. All imagery is abstract: rings, dots, breath. No bottles, glasses, barrels or any alcohol imagery anywhere, including icons, illustrations and the OG image.

**Fonts**
- Pairing 1 (default): **Fraunces** (headings, `opsz` auto, weights 500/600, `font-variation-settings: "SOFT" 50`) + **Figtree** (body/UI 400/500/600). Fallbacks: `Georgia, "Times New Roman", serif` / `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Pairing 2 (Dyslexia lens, and the fallback for anyone who prefers it): **Lexend** (400/500) + **Atkinson Hyperlegible** (400/700).
- Google Fonts link: `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,500..600,50&family=Figtree:wght@400;500;600&family=Lexend:wght@400;500&family=Atkinson+Hyperlegible:wght@400;700&display=swap`

**Ready-to-paste `css/tokens.css`**
```css
:root {
  /* palette */
  --bg:          #F6F1E7;  /* oat paper */
  --surface:     #FFFDF8;  /* card */
  --surface-2:   #EFE7D9;  /* sunken / neutral chip */
  --line:        #E4DACB;
  --ink:         #2B2620;  /* primary text  (≈13:1 on bg) */
  --ink-2:       #5E554A;  /* secondary text (≈6.9:1 on bg) */
  --clay:        #A9502E;  /* primary accent; white text on it ≈5.4:1 */
  --clay-soft:   #F3DDD2;
  --ochre:       #C99A2E;  /* use with --ink text only */
  --sage:        #5E8C61;
  --sage-soft:   #DDE9DC;
  --plum:        #7D4E86;
  --dusk:        #4F7A96;
  --rose:        #B8476A;
  --focus:       #A9502E;
  --bg-dyslexia: #FBF3DF;

  /* type */
  --font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --font-body: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-read: "Lexend", "Atkinson Hyperlegible", system-ui, sans-serif;
  --fs-base: 1rem;
  --fs-sm: .875rem;
  --fs-lg: 1.25rem;
  --fs-xl: clamp(1.5rem, 3vw, 2rem);
  --fs-hero: clamp(2rem, 6vw, 3rem);
  --lh: 1.55;

  /* spacing (4px base) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;
  --gap: var(--s-5);

  /* radius */
  --radius-sm: 8px; --radius: 14px; --radius-card: 20px; --radius-pill: 999px;

  /* shadow (warm, low) */
  --shadow-1: 0 1px 2px rgba(43,38,32,.06), 0 1px 1px rgba(43,38,32,.04);
  --shadow-2: 0 6px 20px -8px rgba(43,38,32,.18), 0 2px 6px rgba(43,38,32,.06);
  --shadow-focus: 0 0 0 3px var(--bg), 0 0 0 6px var(--focus);

  /* motion */
  --ease-out: cubic-bezier(.22,.8,.24,1);
  --ease-breath: cubic-bezier(.45,0,.25,1);
  --dur-1: 140ms; --dur-2: 240ms; --dur-3: 600ms;

  /* sizes */
  --tap: 44px;
  --ring-size: 56px;
}
@media (max-width: 640px) { :root { --ring-size: 44px; --gap: var(--s-4); } }
@media (prefers-reduced-motion: reduce) { :root { --dur-1: 1ms; --dur-2: 1ms; --dur-3: 1ms; } }
```

**Motion principles**
1. Motion means *settling*, never attention-seeking. Things ease out and come to rest.
2. Use transform and opacity only. Nothing bounces or flashes, and no infinite loops appear outside High.
3. Honour `prefers-reduced-motion` everywhere (tokens collapse; JS checks `matchMedia`).

**Friction ring:** an SVG with `r=26` and `stroke-width=6`. The background track is `--line`, and the value arc uses `stroke-dasharray = C` with `stroke-dashoffset = C*(1-score/100)`, transitioned over `--dur-3` with `--ease-breath`. The number counts with `requestAnimationFrame` over the same 600 ms. The stroke colour crossfades between sage, ochre and clay. `role="img"` with `aria-label="Friction 82 of 100, heavy"`, plus a hidden `aria-live="polite"` span that announces only after a settled change of ≥5 points.

**Low-energy collapse ("exhale"):** hidden panels fade out and shrink to 98.5% over 180 ms, staggered by 30 ms each, using view transitions where available. The single card then grows in (opacity 0→1, translateY 8px→0, 240 ms), and its type steps up through the token change. The sequence takes under 0.6 s in total.

**Logo:** "Settle", an open ring (the meter) with one dot resting near its base.
```svg
<svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">
  <circle cx="32" cy="32" r="22" fill="none" stroke="#A9502E" stroke-width="6"
          stroke-linecap="round" stroke-dasharray="110 140" transform="rotate(-60 32 32)"/>
  <circle cx="32" cy="44" r="5" fill="#5E8C61"/>
</svg>
```
The wordmark is "Ease" in Fraunces 600 and "OS" in Figtree 500 at 0.8em, letter-spaced .04em, in `--ink-2`.

**Accessibility basics:** every control is at least 44px. The `:focus-visible` style is `box-shadow: var(--shadow-focus)`. Use semantic elements (button, fieldset/legend, dialog, details). Use `lang="en"`. Do not use colour alone to carry meaning. Provide a skip link "Skip to main".

---

## 8. Build order and QA

**Milestones** (remaining time is about 3 days, so cut M7 extras before cutting QA)
- **M0, Shell (1–2h):** files, tokens, base layout, header/nav/footer, hash router, logo/favicon. Deploy an empty shell to GitHub Pages **immediately** to confirm the path works.
- **M1, Store + Today (3h):** store with seed/migrate/save, tasks CRUD, quick add, all three Today layouts as static markup with `data-min-energy`.
- **M2, Habits + Focus (3h):** habit toggles and streaks, the timer with refresh-resume, the session log.
- **M3, Friction engine (3h):** `friction.js`, ring UI, recompute scheduling, explainer dialog with the live table, `window.easeosFriction()`. Tune seed content until High is 78–86, Normal 38–50 and Low 14–22.
- **M4, Energy (2h):** energy control, the energy.css rules, pickOneTask, Low card, exhale animation, shortcuts.
- **M5, Lenses (2h):** the 4 lenses, banner, Low-mode popover, keyboard-only tab counter.
- **M6, About, intro, data controls (1h):** About screen, intro strip, Load demo, Clear all (confirm dialog).
- **M7, Polish + ship (3h):** mobile pass, a11y pass, OG image, README, screenshots, 30s video, Devpost.

**QA checklist** (every item must pass before submitting)
- Functionality
  - [ ] Add, complete, uncomplete, pin and delete a task. Enter in quick add submits, and empty input is rejected with an inline message.
  - [ ] Habit toggle updates the streak. Adding and deleting a habit works, and delete asks for confirmation.
  - [ ] Focus start, pause, resume, reset. Completion logs a session and shows a toast.
  - [ ] Energy High→Normal→Low→High, with the correct elements per section 4. Low shows exactly one task, and "Not this one" cycles.
  - [ ] Seeded demo gives a ring of ~82 in High, ~44 in Normal and ~18 in Low. The explainer table values match `easeosFriction()`.
  - [ ] Each lens toggles on and off, they combine, the disclaimer banner shows, and the Calm lens lowers the score.
- Persistence
  - [ ] Refresh keeps tasks, habits, energy, lenses and the running timer (the remaining time is correct after a 30 s reload).
  - [ ] Corrupt `easeos.v1` (set it to `"{"`) gives a reseed, the backup key, and the toast.
  - [ ] Private mode or blocked storage: the app still runs (in memory) and shows the save-failed toast once.
- Clear data
  - [ ] "Clear all data" opens a dialog with the text "Delete all tasks, habits and focus history on this device? This can't be undone." The **Cancel** button has focus by default and Esc cancels. Confirm removes `easeos.*` and reloads an empty, non-demo state.
- Mobile 375px (iPhone SE size, Chrome devtools)
  - [ ] No horizontal scroll. The bottom nav doesn't cover content (padding-bottom). The ring and energy control fit in the header. Tap targets are ≥44px. The Low card button is full width.
- Keyboard-only (real keyboard, no mouse)
  - [ ] Everything is reachable with Tab in a logical order and the focus ring is always visible. The skip link works.
  - [ ] Energy changes with arrow keys and with `[`/`]`. Dialogs trap focus, Esc closes them, and focus returns to the trigger.
  - [ ] There are no keyboard traps, and the keyboard lens can be turned off with Esc.
- Reduced motion (OS setting or devtools emulation)
  - [ ] No pulse, shimmer or exhale animation. The ring jumps without animating, and High scores ~71, which the explainer note covers.
- General
  - [ ] Lighthouse accessibility ≥ 95 and no console errors. It works in Chrome, Firefox and Safari (fallbacks for view transitions and `checkVisibility`).
  - [ ] All text contrast passes AA. The meter's own C factor reads 0 in all modes without lenses.
  - [ ] The live GitHub Pages URL works in an incognito window, and the OG image shows when the link is shared.

---

## 9. Known limitations / honesty

- **Per-device data:** LocalStorage only. There is no sync or account, data doesn't move between browsers or devices, and clearing browser data erases it.
- **Scores are heuristics:** the Friction Meter counts DOM features with fixed, published weights. It does not measure a person's fatigue or cognitive load, and the weights are design judgements, not research-validated values.
- **The meter excludes itself** (the ring and its dialog) and counts content scrolled off-screen as part of the screen.
- **Lenses are approximate simulations and adaptations.** They don't replace testing with disabled people or assistive tech such as screen readers. The low-vision blur represents one of many conditions.
- **Energy is self-reported**, and the app does not infer how you feel.
- Some recent browser APIs (View Transitions, `checkVisibility`) have fallbacks, so the visuals may differ slightly across browsers.

---

## 10. Devpost copy (draft)

**Tagline:** Productivity that gets lighter when you do.

**Overview:** Most productivity apps make you more tired. EaseOS is a tiny planner (Today, Habits, Focus) that measures its own friction live and simplifies itself to match your energy. On a low day it's one task and one button.

**What it does**
- **Friction Meter:** a live 0–100 score of the screen's load (buttons, words, panels, colour, motion), with the formula shown in the app.
- **Energy slider:** High shows the full dashboard. Low collapses to a single task, and the score drops from ~82 to ~18.
- **Lenses:** Low-vision, Dyslexia-friendly, Calm and Keyboard-only views, each clearly labelled an approximate simulation.
- **Private by design:** no backend and no tracking. Data stays in your browser.

**How we built it:** Plain HTML, CSS and vanilla JavaScript modules, with no framework, no build step, and GitHub Pages hosting. The Friction Meter walks the live DOM with a MutationObserver and scores six weighted factors. Energy modes are pure CSS driven by `data-energy` attributes. Lenses are CSS classes and filters. The UI uses a custom "Clay & Oat" design system (Fraunces + Figtree, with Lexend for reading).

**Challenges:** Making the score honest instead of theatrical. That meant measuring the real page, not hard-coding numbers, and tuning content rather than weights so the demo numbers hold up. Other challenges were making a dramatic layout collapse still feel calm, and building simulations without overclaiming what they represent.

**What's next:** Optional gentle energy check-ins, a per-screen "friction budget" for designers to use on their own sites (a bookmarklet version of the meter), export/import of data as JSON, and testing with disabled users to refine the lenses.

**AI-use disclosure (placeholder):**
> This project was built with help from AI (Anthropic's Claude) for [planning / design system / code generation / copy — fill in]. All code was reviewed, tested and adjusted by me. [Add specifics.]

**README outline**
1. EaseOS: one-line pitch, live demo link, screenshot (High 82 vs Low 18)
2. The 10-second idea
3. Features (4 bullets, same as Devpost)
4. How the Friction Meter works (formula table + "it's a heuristic")
5. Lenses and the disclaimer
6. Run locally (`python3 -m http.server 8000`) / deploy (GitHub Pages, root of `main`)
7. Tech and file structure
8. Accessibility notes (keyboard, reduced motion, contrast)
9. Known limitations
10. AI-use disclosure
11. Credits (Google Fonts: Fraunces, Figtree, Lexend, Atkinson Hyperlegible) and the MIT license
