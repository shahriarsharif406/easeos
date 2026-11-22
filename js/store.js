import { uid, todayKey, dayKeyAgo, startOfDay } from "./util.js";

const KEY = "easeos.v1";
const CURRENT = 1;
/** migrations[v] upgrades a state at version v to v+1. */
export const migrations = {};

const listeners = new Set();
let state = null;
let notice = null;
let saveTimer = null;
let saveFailedShown = false;
let onSaveError = () => {};
let memoryOnly = false;

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { memoryOnly = true; return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

export function emptyState() {
  return {
    version: CURRENT, tasks: [], habits: [],
    focus: { defaultMinutes: 25, active: null, sessions: [] },
    prefs: { energy: "normal", lenses: [], introDismissed: false, demoLoaded: false },
  };
}

export function seedDemo() {
  const now = Date.now(), day = 864e5, min = 60000;
  const todayAt = (h) => Math.min(now - min, startOfDay() + h * 3600000);
  const task = (title, priority, ageDays, i, extra = {}) => ({
    id: uid("t"), title, note: "", priority, pinned: false, done: false,
    createdAt: now - ageDays * day - i * min, doneAt: null, ...extra,
  });
  const tasks = [
    task("Send the project proposal draft", "high", 2, 1, { pinned: true }),
    task("Reply to Sara about the venue", "high", 1, 2),
    task("Pay the electricity bill", "high", 3, 3),
    task("Book a dentist appointment", "med", 4, 4),
    task("Plan next week's meals", "med", 1, 5),
    task("Water the balcony plants", "low", 0, 6),
    task("Return the library books", "low", 5, 7),
    task("Back up phone photos", "low", 6, 8),
    task("Write morning pages", "low", 1, 9, { done: true, doneAt: todayAt(7) }),
    task("Order printer ink", "med", 2, 10, { done: true, doneAt: todayAt(9) }),
  ];
  const mk = (name, color, pattern) => {
    const log = {};
    pattern.split("").forEach((c, i) => { if (c === "1") log[dayKeyAgo(i)] = true; });
    return { id: uid("h"), name, color, log, createdAt: now - 20 * day };
  };
  const habits = [
    mk("Drink water", "sage", "1111011"),
    mk("Stretch 5 min", "ochre", "0110111"),
    mk("Read 10 pages", "plum", "1101101"),
    mk("Walk outside", "dusk", "0111010"),
    mk("No phone after 11pm", "rose", "1011010"),
  ];
  const sess = (daysAgo, hoursAgo, minutes) => ({
    startedAt: daysAgo === 0 ? todayAt(10) : now - daysAgo * day - hoursAgo * 3600000, minutes, completed: true,
  });
  const sessions = [sess(0, 0, 25), sess(1, 3, 50), sess(1, 6, 25), sess(2, 4, 25), sess(4, 5, 25), sess(5, 2, 10)];
  return {
    version: CURRENT, tasks, habits,
    focus: { defaultMinutes: 25, active: null, sessions },
    prefs: { energy: "high", lenses: [], introDismissed: false, demoLoaded: true },
  };
}

function valid(o) {
  return o && typeof o === "object" && Array.isArray(o.tasks) && Array.isArray(o.habits) &&
    o.focus && typeof o.focus === "object" && o.prefs && typeof o.prefs === "object";
}
function normalise(o) {
  const e = emptyState();
  o.focus.sessions = Array.isArray(o.focus.sessions) ? o.focus.sessions : [];
  o.focus.defaultMinutes = [10, 25, 50].includes(o.focus.defaultMinutes) ? o.focus.defaultMinutes : 25;
  if (o.focus.active === undefined) o.focus.active = null;
  o.prefs = { ...e.prefs, ...o.prefs };
  if (!["low", "normal", "high"].includes(o.prefs.energy)) o.prefs.energy = "normal";
  if (!Array.isArray(o.prefs.lenses)) o.prefs.lenses = [];
  o.habits.forEach((h) => { if (!h.log || typeof h.log !== "object") h.log = {}; });
  return o;
}

function load() {
  const raw = lsGet(KEY);
  if (raw == null) { state = seedDemo(); persist(); return state; }
  try {
    let o = JSON.parse(raw);
    if (!valid(o)) throw new Error("shape");
    while ((o.version || 1) < CURRENT) {
      const fn = migrations[o.version || 1];
      if (!fn) break;
      o = fn(o); 
    }
    state = normalise(o);
  } catch (e) {
    lsSet("easeos.corrupt." + Date.now(), raw);
    state = seedDemo();
    notice = "Saved data was unreadable and was reset. A backup was kept.";
    persist();
  }
  return state;
}

function persist() {
  clearTimeout(saveTimer); saveTimer = null;
  const ok = lsSet(KEY, JSON.stringify(state));
  if (!ok && !saveFailedShown) { saveFailedShown = true; onSaveError(); }
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 150); }

export const store = {
  load,
  get: () => state,
  update(fn) {
    const next = structuredClone(state);
    fn(next);
    state = next;
    scheduleSave();
    listeners.forEach((l) => l(state));
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  flush() { if (saveTimer) persist(); },
  takeNotice() { const n = notice; notice = null; return n; },
  setSaveErrorHandler(fn) { onSaveError = fn; },
  isMemoryOnly: () => memoryOnly,
  replaceWith(next) { state = next; persist(); listeners.forEach((l) => l(state)); },
  clearAll() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("easeos.")).forEach((k) => localStorage.removeItem(k));
      Object.keys(sessionStorage).filter((k) => k.startsWith("easeos.")).forEach((k) => sessionStorage.removeItem(k));
    } catch (e) { /* storage blocked: nothing to clear */ }
    clearTimeout(saveTimer);
    state = emptyState();
    lsSet(KEY, JSON.stringify(state));
  },
};
