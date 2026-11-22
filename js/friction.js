/* Friction Meter: measures the LIVE DOM under a root element. Read-only, no DOM writes. */

export const FACTORS = [
  { key: "I", label: "Interactive elements", what: "Visible buttons, links, inputs, selects, summaries", cap: 40, weight: 30 },
  { key: "W", label: "Words", what: "Visible words of text (option lists and aria-labels not counted)", cap: 300, weight: 20 },
  { key: "K", label: "Competing regions", what: "Panels that ask for their own attention or action", cap: 8, weight: 15 },
  { key: "V", label: "Colour variety", what: "Distinct hue families used (warm neutrals count as one)", cap: 10, weight: 10 },
  { key: "C", label: "Low-contrast text", what: "Share of text elements below WCAG AA contrast", cap: 0.3, weight: 10 },
  { key: "M", label: "Motion", what: "Running infinite animations + ticking clocks/timers", cap: 4, weight: 15 },
];

const INTERACTIVE = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const SKIP_TEXT = "option, optgroup, select, script, style, noscript, template";

function isVisible(el) {
  if (typeof el.checkVisibility === "function") return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) <= 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function parseColor(str) {
  if (!str) return null;
  let m = str.match(/^rgba?\(([^)]+)\)/);
  if (!m) m = str.match(/^color\(srgb ([^)]+)\)/);
  if (!m) return null;
  const isColorFn = str.startsWith("color(");
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map((t) => (t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t)));
  if (p.length < 3 || p.some(Number.isNaN)) return null;
  const k = isColorFn ? 1 : 255;
  return { r: p[0] / k, g: p[1] / k, b: p[2] / k, a: p.length > 3 ? p[3] : 1 };
}

function hueBucket(c) {
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b), ch = max - min;
  if (ch < 0.15) return "neutral";
  let h;
  if (max === c.r) h = ((c.g - c.b) / ch) % 6;
  else if (max === c.g) h = (c.b - c.r) / ch + 2;
  else h = (c.r - c.g) / ch + 4;
  h = (h * 60 + 360) % 360;
  return "h" + (Math.floor(h / 30) % 12);
}

function lum(c) {
  const f = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrast(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function blend(fg, bg) { const a = fg.a; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }; }

function backgroundOf(el, fallback) {
  let n = el;
  while (n && n.nodeType === 1) {
    const c = parseColor(getComputedStyle(n).backgroundColor);
    if (c && c.a >= 0.5) return c.a < 1 ? blend(c, fallback) : c;
    n = n.parentElement;
  }
  return fallback;
}

export function measure(root = document.getElementById("app")) {
  const rootCS = getComputedStyle(document.documentElement);
  const fallbackBg = parseColor(getComputedStyle(document.body).backgroundColor) || parseColor("rgb(246,241,231)");
  void rootCS;
  const vis = new Map();
  const visible = (el) => { if (!vis.has(el)) vis.set(el, isVisible(el)); return vis.get(el); };
  const ignored = (el) => !!el.closest("[data-fx-ignore]");

  let I = 0, K = 0, W = 0, M = 0;
  const buckets = new Set();
  let textEls = 0, lowContrast = 0;
  const failing = [];

  const els = root.querySelectorAll("*");
  for (const el of els) {
    if (el.matches(SKIP_TEXT) || ignored(el) || !visible(el)) continue;
    if (el.matches(INTERACTIVE) && !el.disabled && el.type !== "hidden") I++;
    if (el.hasAttribute("data-fx-region")) K++;
    if (el.hasAttribute("data-fx-motion")) M++;

    const cs = getComputedStyle(el);
    for (const prop of ["color", "backgroundColor", "borderTopColor"]) {
      const c = parseColor(cs[prop]);
      if (c && c.a >= 0.5) buckets.add(hueBucket(c));
    }

    // text-bearing? (at least one direct non-empty text node)
    let hasText = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { hasText = true; break; }
    if (hasText && !el.closest(SKIP_TEXT)) {
      textEls++;
      let fg = parseColor(cs.color);
      const bg = backgroundOf(el, fallbackBg);
      if (fg) {
        if (fg.a < 1) fg = blend(fg, bg);
        const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const need = large ? 3 : 4.5;
        const ratio = contrast(fg, bg);
        if (ratio < need) { lowContrast++; failing.push({ el, ratio: +ratio.toFixed(2), need }); }
      }
    }
  }

  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = tw.nextNode())) {
    const t = node.nodeValue.trim();
    if (!t) continue;
    const p = node.parentElement;
    if (!p || p.closest(SKIP_TEXT) || ignored(p) || !visible(p)) continue;
    W += t.split(/\s+/).filter(Boolean).length;
  }

  for (const a of document.getAnimations()) {
    if (a.playState !== "running") continue;
    let it; try { it = a.effect.getComputedTiming().iterations; } catch (e) { continue; }
    if (it !== Infinity) continue;
    const t = a.effect.target;
    if (!t || !root.contains(t) || ignored(t) || !visible(t)) continue;
    M++;
  }

  const raw = { I, W, K, V: buckets.size, C: textEls ? lowContrast / textEls : 0, M };
  const factors = FACTORS.map((f) => {
    const r = raw[f.key];
    return { ...f, raw: r, points: f.weight * Math.min(r / f.cap, 1) };
  });
  const total = factors.reduce((s, f) => s + f.points, 0);
  return { score: Math.round(total), total, factors, textEls, lowContrast, failing, buckets: [...buckets] };
}
