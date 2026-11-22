import { measure } from "./friction.js";
import { prefersReducedMotion, debounce, setText } from "./util.js";
import { openDialog } from "./dialog.js";

const C = 2 * Math.PI * 26;
let last = null;
let shown = 0;
let announced = null;
let rafId = 0;
const hooks = [];

const band = (s) => (s <= 33 ? "low" : s <= 66 ? "mid" : "high");
const wordFor = (s) => (s <= 33 ? "Light" : s <= 66 ? "Moderate" : "Heavy");

export const onMeasure = (fn) => hooks.push(fn);
export const lastResult = () => last;

function paintNumber(from, to) {
  cancelAnimationFrame(rafId);
  const num = document.getElementById("ring-num");
  if (prefersReducedMotion() || from === to) { setText(num, String(to)); shown = to; return; }
  const t0 = performance.now(), dur = 600;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    shown = Math.round(from + (to - from) * e);
    setText(num, String(shown));
    if (p < 1) rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}

function render(res) {
  const ring = document.getElementById("ring");
  const arc = document.getElementById("ring-arc");
  const s = res.score;
  ring.dataset.band = band(s);
  ring.dataset.score = String(s);
  ring.setAttribute("aria-label", `Friction ${s} of 100, ${wordFor(s).toLowerCase()}`);
  arc.style.strokeDasharray = String(C);
  arc.style.strokeDashoffset = String(C * (1 - s / 100));
  setText(document.getElementById("meter-label"), wordFor(s));
  paintNumber(shown, s);
  if (announced === null || Math.abs(s - announced) >= 5) {
    if (announced !== null) setText(document.getElementById("meter-live"), `Friction ${s}, ${wordFor(s).toLowerCase()}`);
    announced = s;
  }
}

function fillTable(res) {
  const body = document.getElementById("explain-rows");
  if (!body) return;
  const fmt = (f) => (f.key === "C" ? `${Math.round(f.raw * 100)}% (${res.lowContrast} of ${res.textEls})` : String(f.raw));
  const cap = (f) => (f.key === "C" ? "30%" : String(f.cap));
  body.innerHTML = res.factors.map((f) => `
    <tr><th scope="row">${f.label}</th><td>${f.what}</td><td class="num">${fmt(f)}</td><td class="num">${cap(f)}</td><td class="num">${f.weight}</td><td class="num">${f.points.toFixed(1)}</td></tr>`).join("");
  document.getElementById("explain-total").textContent = `${res.total.toFixed(1)} → ${res.score}`;
}

export function recomputeNow() {
  const res = measure(document.getElementById("app"));
  last = res;
  render(res);
  fillTable(res);
  hooks.forEach((h) => h(res));
  return res;
}

function waitSettle() {
  return new Promise((resolve) => {
    const app = document.getElementById("app");
    let done = false;
    const fin = () => { if (done) return; done = true; app.removeEventListener("transitionend", fin, true); resolve(); };
    app.addEventListener("transitionend", fin, true);
    setTimeout(fin, 400);
  });
}

const run = debounce(async () => { await waitSettle(); recomputeNow(); }, 250);
export const scheduleRecompute = () => run();

export function initMeter() {
  const app = document.getElementById("app");
  const ignoreTarget = (n) => { const el = n.nodeType === 1 ? n : n.parentElement; return !!(el && el.closest("[data-fx-ignore]")); };
  const mo = new MutationObserver((recs) => { if (recs.some((r) => !ignoreTarget(r.target))) run(); });
  mo.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "data-energy", "data-fx-motion", "open"] });
  new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ["data-energy", "class"] });
  window.addEventListener("resize", run);

  const dlg = document.getElementById("dlg-explain");
  const open = () => { recomputeNow(); openDialog(dlg, "#explain-close"); };
  document.getElementById("meter-help").addEventListener("click", open);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-open-explain]")) open(); });
  document.getElementById("explain-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  window.easeosFriction = () => {
    const r = measure(app);
    console.table(r.factors.map((f) => ({ factor: f.label, raw: +(+f.raw).toFixed(3), cap: f.cap, weight: f.weight, points: +f.points.toFixed(2) })));
    console.log(`Friction score: ${r.score} (${r.total.toFixed(2)})`, r.failing.length ? { lowContrast: r.failing } : "no low-contrast text");
    return r;
  };
  run();
}
