# EaseOS

**Productivity that gets lighter when you do.** A tiny planner (Today, Habits, Focus) that measures its own friction live and simplifies itself to match your energy.

- Live demo: `https://<your-github-username>.github.io/easeos/` (GitHub Pages, root of `main`)
- Screenshot: `assets/og-image.png` (High, Friction 83, beside Low, Friction 16)

## The 10-second idea
A Friction Meter scores how heavy the screen is. Slide **Energy** to Low and the app shrinks to one task. The score drops, and you can see why.

## Features
- **Friction Meter:** a live 0-100 score of the screen's load (buttons, words, panels, colour, motion), with the formula and live numbers in a "How is this calculated?" dialog.
- **Energy slider:** High is the full dashboard, Normal is a short list, Low is one task and one button. Shortcuts: `[` lowers, `]` raises.
- **Lenses:** Low-vision, Dyslexia-friendly, Calm and Keyboard-only views, each labelled an approximate simulation.
- **Private by design:** no backend, no tracking, no account. Data stays in your browser (LocalStorage key `easeos.v1`).

## How the Friction Meter works
Measured from the live DOM under `#app` on every change (MutationObserver, debounced). Six factors, each capped, then weighted:

| Factor | Counts | Cap | Weight |
|---|---|---|---|
| I Interactive | visible buttons, links, inputs, selects, summaries | 40 | 30 |
| W Words | visible words | 300 | 20 |
| K Regions | visible `[data-fx-region]` panels | 8 | 15 |
| V Colour | distinct hue buckets (12 hues + neutral) | 10 | 10 |
| C Contrast | share of text under WCAG AA | 0.30 | 10 |
| M Motion | running infinite animations + ticking `[data-fx-motion]` | 4 | 15 |

`score = round(30*min(I/40,1) + 20*min(W/300,1) + 15*min(K/8,1) + 10*min(V/10,1) + 10*min(C/0.30,1) + 15*min(M/4,1))`

Measured on the seeded demo: **High 83, Normal 41, Low 16** (Reduced-motion High: 71; Calm lens on High: 67). Weights were never tuned to hit these numbers; the seed content was. Run `easeosFriction()` in the console for the factor table.

**It is a heuristic**, not a medical or scientific measure of fatigue. The weights are design judgements. The meter excludes itself (ring, dialog, toasts), the skip link and the footer's data controls, and counts content scrolled off-screen.

## Lenses and the disclaimer
Low-vision (blur/contrast simulation), Dyslexia-friendly (Lexend, spacing, tinted background), Calm (no motion, muted colour) and Keyboard-only (mouse disabled, thick focus rings, Tab-stop counter). While any lens is on, a banner says: *Approximate simulation. Real experiences vary widely. This is a design aid, not a diagnosis or a substitute for testing with disabled people.*

## Run locally / deploy
```
python3 -m http.server 8000   # then open http://localhost:8000
```
Deploy: push to GitHub, Settings > Pages > Deploy from branch `main`, folder `/ (root)`. All paths are relative, so it works under `/easeos/`. After deploying, change the `og:image` meta in `index.html` to the absolute URL of `assets/og-image.png` so link previews work.

## Tech and structure
Plain HTML, CSS and vanilla JS modules. No framework, no build step.
```
index.html  css/{tokens,base,components,energy,lenses}.css
js/{app,store,friction,meter-ui,energy,lenses,today,habits,focus,dialog,util}.js
assets/{logo.svg,favicon.svg,og-image.png}
```

## Accessibility notes
Semantic elements (fieldset/legend, dialog, details), skip link, visible `:focus-visible` rings, 44px tap targets, dialogs with focus return and Esc, `prefers-reduced-motion` honoured (no pulse, shimmer or view transition), text contrast built to AA (the meter's own C factor reads 0).

## Known limitations
- LocalStorage only: no sync between devices, and clearing browser data erases everything.
- Scores are heuristics with fixed weights; they do not measure a person's fatigue.
- Lenses are approximate simulations, not a replacement for testing with disabled people or screen readers.
- Energy is self-reported; the app never infers it.
- View Transitions and `checkVisibility` have fallbacks, so visuals may differ slightly between browsers.
- In Low energy the tab bar is hidden; use "Show everything" or the Lenses popover's page links.

## AI-use disclosure
> **This project was built with AI.** Planning and design were done with Claude Opus; the implementation and testing were done with Claude Sonnet (Anthropic). The author directed the idea and reviews the result.

## Credits
Fonts from Google Fonts: Fraunces, Figtree, Lexend, Atkinson Hyperlegible. Released under the MIT License (see `LICENSE`).
