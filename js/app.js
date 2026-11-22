import { store } from "./store.js";
import { applyEnergy, initEnergy, shiftEnergy } from "./energy.js";
import { initToday } from "./today.js";
import { initHabits } from "./habits.js";
import { initFocus } from "./focus.js";
import { initLenses, applyLenses, refreshLensInfo } from "./lenses.js";
import { initMeter, scheduleRecompute, onMeasure } from "./meter-ui.js";
import { confirm, toast } from "./dialog.js";
import { setText, prefersReducedMotion, pad2 } from "./util.js";

const html = document.documentElement;
const ROUTES = ["today", "habits", "focus", "about"];
let firstRoute = true;

/* ---------- boot ---------- */
store.setSaveErrorHandler(() => toast("Couldn't save (storage full or blocked)"));
const state = store.load();
applyEnergy(state.prefs.energy);
applyLenses(state.prefs.lenses);

initEnergy();
initToday();
initHabits();
initFocus();
initLenses();
initMeter();
onMeasure(refreshLensInfo);

const notice = store.takeNotice();
if (notice) toast(notice, { ms: 6000 });

/* ---------- router ---------- */
function route() {
  if (location.hash && !location.hash.startsWith("#/")) return; // e.g. the skip link's #screen
  const m = location.hash.match(/^#\/(\w+)/);
  const name = m && ROUTES.includes(m[1]) ? m[1] : "today";
  document.querySelectorAll("#screen > section").forEach((s) => { s.hidden = s.dataset.route !== name; });
  document.querySelectorAll(".tabs a").forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (!firstRoute) {
    const h = document.querySelector(`#screen > section[data-route="${name}"] h1`);
    if (h) h.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }
  firstRoute = false;
  scheduleRecompute();
  refreshLensInfo();
}
window.addEventListener("hashchange", route);
route();

/* ---------- clock ---------- */
function tickClock() {
  const el = document.getElementById("clock");
  const d = new Date();
  const sec = html.dataset.energy === "high" && !html.classList.contains("lens-calm") && !prefersReducedMotion();
  setText(el, `${pad2(d.getHours())}:${pad2(d.getMinutes())}${sec ? ":" + pad2(d.getSeconds()) : ""}`);
  const still = html.classList.contains("lens-calm") || prefersReducedMotion();
  if (still) el.removeAttribute("data-fx-motion"); else el.setAttribute("data-fx-motion", "");
}
tickClock();
setInterval(tickClock, 1000);
new MutationObserver(tickClock).observe(html, { attributes: true, attributeFilter: ["data-energy", "class"] });

/* ---------- keyboard shortcuts: [ lowers energy, ] raises it ---------- */
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "radio")) return;
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "[") shiftEnergy(-1);
  else if (e.key === "]") shiftEnergy(1);
});

/* ---------- data controls ---------- */
document.getElementById("clear-all").addEventListener("click", async () => {
  const ok = await confirm("Delete all tasks, habits and focus history on this device? This can't be undone.", { title: "Clear all data?", ok: "Delete everything" });
  if (!ok) return;
  store.clearAll();
  location.hash = "#/today";
  location.reload();
});
document.getElementById("load-demo").addEventListener("click", async () => {
  const ok = await confirm("Replace your current tasks, habits and focus history with the demo data?", { title: "Load demo data?", ok: "Load demo" });
  if (!ok) return;
  const { seedDemo } = await import("./store.js");
  const demo = seedDemo();
  demo.prefs.energy = html.dataset.energy;
  demo.prefs.lenses = store.get().prefs.lenses;
  store.replaceWith(demo);
  toast("Demo data loaded.");
});

/* ---------- persistence on leave ---------- */
window.addEventListener("pagehide", () => store.flush());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") store.flush(); });

/* ---------- about ---------- */
document.querySelectorAll("[data-goto]").forEach((a) => a.addEventListener("click", () => scheduleRecompute()));
