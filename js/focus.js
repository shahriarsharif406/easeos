import { store } from "./store.js";
import { esc, pad2, setText, ago } from "./util.js";
import { toast } from "./dialog.js";
import { getEnergy } from "./energy.js";

const C = 2 * Math.PI * 100; // focus ring r=100
const BASE_TITLE = document.title;
let finishing = false;

export const remainingMs = (a) => (!a ? null : a.pausedRemainingMs != null ? a.pausedRemainingMs : a.durationMs - (Date.now() - a.startedAt));
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; };
const idleMinutes = (s) => (getEnergy() === "low" ? 10 : s.focus.defaultMinutes);

function chime() {
  if (document.documentElement.classList.contains("lens-calm")) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.22;
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
    });
  } catch (e) { /* audio is optional */ }
}

function complete() {
  if (finishing) return;
  finishing = true;
  store.update((s) => {
    const a = s.focus.active;
    if (a) { s.focus.sessions.unshift({ startedAt: a.sessionStart || Date.now(), minutes: a.minutes, completed: true }); s.focus.sessions = s.focus.sessions.slice(0, 50); }
    s.focus.active = null;
  });
  finishing = false;
  toast("Focus done. Take a breath.");
  chime();
}

function startNew(min) {
  store.update((s) => { const t = Date.now(); s.focus.active = { startedAt: t, sessionStart: t, durationMs: min * 60000, pausedRemainingMs: null, minutes: min }; });
}
function mainAction() {
  const s = store.get(), a = s.focus.active;
  if (!a) return startNew(idleMinutes(s));
  if (a.pausedRemainingMs != null) store.update((x) => { const q = x.focus.active; q.startedAt = Date.now(); q.durationMs = q.pausedRemainingMs; q.pausedRemainingMs = null; });
  else store.update((x) => { const q = x.focus.active; q.pausedRemainingMs = Math.max(0, remainingMs(q)); });
}

function labels(s) {
  const a = s.focus.active, paused = a && a.pausedRemainingMs != null;
  return { main: !a ? "Start" : paused ? "Resume" : "Pause", low: !a ? "Start 10 min" : paused ? "Resume" : "Pause", running: !!a && !paused };
}

function render(s) {
  const L = labels(s);
  document.querySelectorAll("[data-focus-main]").forEach((b) => {
    b.textContent = b.hasAttribute("data-low-label") ? L.low : L.main;
    b.setAttribute("aria-pressed", String(L.running));
  });
  document.querySelectorAll("[data-focus-digits]").forEach((d) => { if (L.running) d.setAttribute("data-fx-motion", ""); else d.removeAttribute("data-fx-motion"); });
  document.getElementById("f-reset").disabled = !s.focus.active;
  document.querySelectorAll("[data-preset]").forEach((b) => {
    b.setAttribute("aria-pressed", String(+b.dataset.preset === s.focus.defaultMinutes));
    b.disabled = !!s.focus.active;
  });
  const sess = s.focus.sessions.filter((x) => x.completed).slice(0, 5);
  document.getElementById("session-list").innerHTML = sess.length
    ? sess.map((x) => `<li><span>${x.minutes} min focus</span><span class="muted">${ago(x.startedAt)}, ${new Date(x.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span></li>`).join("")
    : `<li class="muted">No sessions yet. Your first one will show up here.</li>`;
  tick();
}

function tick() {
  const s = store.get(), a = s.focus.active;
  if (a && a.pausedRemainingMs == null && remainingMs(a) <= 0) { complete(); return; }
  const rem = a ? remainingMs(a) : idleMinutes(s) * 60000;
  const total = a ? a.minutes * 60000 : idleMinutes(s) * 60000;
  const text = fmt(rem);
  document.querySelectorAll("[data-focus-digits]").forEach((d) => setText(d, text));
  const arc = document.getElementById("focus-arc");
  if (arc) { arc.style.strokeDasharray = String(C); arc.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, rem / total)))); }
  document.title = a ? `${text} · EaseOS` : BASE_TITLE;
}

export function initFocus() {
  document.getElementById("screen").addEventListener("click", (e) => {
    const m = e.target.closest("[data-focus-main]");
    if (m) return mainAction();
    const p = e.target.closest("[data-preset]");
    if (p && !p.disabled) { const v = +p.dataset.preset; store.update((s) => { s.focus.defaultMinutes = v; }); return; }
    if (e.target.closest("#f-reset")) { store.update((s) => { s.focus.active = null; }); toast("Timer reset."); }
  });
  store.subscribe(render);
  render(store.get());
  setInterval(tick, 250);
}
