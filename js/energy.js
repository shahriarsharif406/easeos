import { store } from "./store.js";
import { prefersReducedMotion } from "./util.js";

const html = document.documentElement;
export const getEnergy = () => html.dataset.energy || "normal";
const ORDER = ["low", "normal", "high"];

export function applyEnergy(v) {
  html.dataset.energy = v;
  const r = document.querySelector(`.energy input[value="${v}"]`);
  if (r) r.checked = true;
}

export function setEnergy(v) {
  if (v === getEnergy() || !ORDER.includes(v)) return;
  const change = () => { applyEnergy(v); store.update((s) => { s.prefs.energy = v; }); };
  if (prefersReducedMotion()) return change();
  if (typeof document.startViewTransition === "function") { document.startViewTransition(change); return; }
  const screen = document.getElementById("screen");
  screen.classList.add("is-exhaling");
  setTimeout(() => {
    change();
    screen.classList.remove("is-exhaling");
    screen.classList.add("is-inhaling");
    setTimeout(() => screen.classList.remove("is-inhaling"), 260);
  }, 180);
}

export function shiftEnergy(dir) {
  const i = ORDER.indexOf(getEnergy()) + dir;
  if (i >= 0 && i < ORDER.length) setEnergy(ORDER[i]);
}

export function initEnergy() {
  document.querySelectorAll(".energy input").forEach((r) => r.addEventListener("change", () => { if (r.checked) setEnergy(r.value); }));
}

/* Low-mode skip index lives in sessionStorage, not localStorage. */
export function getSkip() { try { return JSON.parse(sessionStorage.getItem("easeos.session") || "{}").skip || 0; } catch (e) { return 0; } }
export function setSkip(n) { try { sessionStorage.setItem("easeos.session", JSON.stringify({ skip: n })); } catch (e) { /* ignore */ } }
