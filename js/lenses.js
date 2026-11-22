import { store } from "./store.js";
import { toast } from "./dialog.js";

const html = document.documentElement;
const LENSES = ["lowvision", "dyslexia", "calm", "keyboard"];
const INTERACTIVE = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
export const activeLenses = () => LENSES.filter((l) => html.classList.contains("lens-" + l));

export function applyLenses(list) {
  LENSES.forEach((l) => html.classList.toggle("lens-" + l, list.includes(l)));
  document.querySelectorAll("[data-lens]").forEach((b) => b.setAttribute("aria-pressed", String(list.includes(b.dataset.lens))));
  const banner = document.getElementById("lens-banner");
  banner.hidden = list.length === 0;
  document.getElementById("lv-note").hidden = !list.includes("lowvision");
  document.getElementById("kb-count").hidden = !list.includes("keyboard");
  refreshLensInfo();
}

export function setLenses(list) { applyLenses(list); store.update((s) => { s.prefs.lenses = list; }); }
export function toggleLens(l) {
  const cur = activeLenses();
  setLenses(cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]);
}

const visible = (el) => el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : el.offsetParent !== null;
export function refreshLensInfo() {
  const out = document.getElementById("kb-count");
  if (!out || out.hidden) return;
  const sec = document.querySelector("#screen > section:not([hidden])");
  if (!sec) return;
  const stops = [...sec.querySelectorAll(INTERACTIVE)].filter((e) => !e.disabled && visible(e));
  const i = stops.findIndex((e) => e.hasAttribute("data-primary-action"));
  out.textContent = i >= 0 ? `Tab stops to the main action: ${i + 1}` : "Tab stops to the main action: none on this screen";
}

export function initLenses() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lens]");
    if (b) { toggleLens(b.dataset.lens); return; }
    if (e.target.closest("#lens-off")) { setLenses([]); toast("Lenses off."); return; }
    const pop = document.getElementById("lens-pop"), openBtn = document.getElementById("lens-open");
    if (e.target.closest("#lens-open")) {
      pop.hidden = !pop.hidden; openBtn.setAttribute("aria-expanded", String(!pop.hidden)); return;
    }
    if (!pop.hidden && !e.target.closest("#lens-pop")) { pop.hidden = true; openBtn.setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
    const pop = document.getElementById("lens-pop");
    if (!pop.hidden) { pop.hidden = true; const b = document.getElementById("lens-open"); b.setAttribute("aria-expanded", "false"); b.focus(); return; }
    if (html.classList.contains("lens-keyboard")) { toggleLens("keyboard"); toast("Keyboard-only lens off."); }
  });
}
