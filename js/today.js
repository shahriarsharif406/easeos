import { store } from "./store.js";
import { esc, uid, ago, isToday, dayKeyAgo, startOfDay, renderKeepFocus, setText } from "./util.js";
import { getSkip, setSkip, getEnergy } from "./energy.js";
import { toast } from "./dialog.js";

const PRIO = { high: 3, med: 2, low: 1 };
const PRIO_LABEL = { high: "High", med: "Med", low: "Low" };
const PRIO_COLOR = { high: "clay", med: "ochre", low: "sage" };
let lowAdding = false;
let menuOpenId = null;

export function openTasks(s) {
  return s.tasks.filter((t) => !t.done).sort((a, b) =>
    (b.pinned - a.pinned) || (PRIO[b.priority] - PRIO[a.priority]) || (a.createdAt - b.createdAt));
}
/** Low-energy pick: the open tasks in priority order; the session skip index rotates through them. */
export function pickOneTask(s) {
  const list = openTasks(s);
  if (!list.length) return null;
  return list[getSkip() % list.length];
}

const pinSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 14v7"/></svg>';
const trashSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function rowHtml(t, i, isNext) {
  const meta = `<span class="chip"><span class="dot c-${PRIO_COLOR[t.priority]}"></span>${PRIO_LABEL[t.priority]}</span>
    <span>added ${ago(t.createdAt)}</span>${t.pinned ? ' <span class="chip" data-fx-noise>Pinned</span>' : ""}`;
  const next = isNext ? `<span class="chip" data-fx-noise data-min-energy="high"><span class="pulse"></span>Next up</span>` : "";
  const menu = menuOpenId === t.id ? `<div class="row-menu" role="group" aria-label="Task actions">
      <button type="button" data-act="pin" data-id="${t.id}" data-fk="mpin:${t.id}">${t.pinned ? "Unpin" : "Pin to top"}</button>
      <button type="button" data-act="delete" data-id="${t.id}" data-fk="mdel:${t.id}">Delete</button></div>` : "";
  return `<li class="task-row${i >= 5 ? " beyond" : ""}" data-id="${t.id}">
    <label class="check"><input type="checkbox" data-act="toggle" data-id="${t.id}" data-fk="chk:${t.id}" aria-label="Mark done: ${esc(t.title)}"></label>
    <div class="task-main"><p class="task-title">${esc(t.title)}</p><p class="task-meta">${meta} ${next}</p></div>
    <button type="button" class="icon-btn" data-min-energy="high" data-act="pin" data-id="${t.id}" data-fk="pin:${t.id}" aria-pressed="${t.pinned}" aria-label="${t.pinned ? "Unpin" : "Pin"}: ${esc(t.title)}">${pinSvg}</button>
    <button type="button" class="icon-btn" data-min-energy="high" data-act="delete" data-id="${t.id}" data-fk="del:${t.id}" aria-label="Delete: ${esc(t.title)}">${trashSvg}</button>
    <button type="button" class="icon-btn" data-only-energy="normal" data-act="menu" data-id="${t.id}" data-fk="menu:${t.id}" aria-haspopup="true" aria-expanded="${menuOpenId === t.id}" aria-label="More actions: ${esc(t.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg></button>
    ${menu}</li>`;
}
function doneRowHtml(t) {
  return `<li class="task-row is-done" data-id="${t.id}">
    <label class="check"><input type="checkbox" checked data-act="toggle" data-id="${t.id}" data-fk="chk:${t.id}" aria-label="Mark not done: ${esc(t.title)}"></label>
    <div class="task-main"><p class="task-title">${esc(t.title)}</p></div>
    <button type="button" class="icon-btn" data-act="delete" data-id="${t.id}" data-fk="del:${t.id}" aria-label="Delete: ${esc(t.title)}">${trashSvg}</button></li>`;
}

function render(s) {
  const open = openTasks(s);
  const list = document.getElementById("task-list");
  renderKeepFocus(list, open.length
    ? open.map((t, i) => rowHtml(t, i, i === 0)).join("")
    : `<li class="empty">No tasks yet. Add one above, or take the rest.</li>`, "#qa-title");
  setText(document.getElementById("tasks-count"), `${open.length} open`);
  const more = document.getElementById("more-btn");
  const extra = Math.max(0, open.length - 5);
  more.hidden = extra === 0;
  more.dataset.fxNoise = "";
  more.textContent = list.classList.contains("show-all") ? "Show fewer" : `+${extra} more`;

  const doneToday = s.tasks.filter((t) => t.done && isToday(t.doneAt));
  const dl = document.getElementById("done-list");
  renderKeepFocus(dl, doneToday.length ? doneToday.map(doneRowHtml).join("") : `<li class="empty">Nothing finished yet today.</li>`);
  setText(document.getElementById("done-sum"), `Done today (${doneToday.length})`);
  document.getElementById("clear-done").hidden = !s.tasks.some((t) => t.done);

  document.getElementById("intro").hidden = s.prefs.introDismissed;
  renderLow(s);
  renderStats(s, doneToday.length);
  renderComing(s);
}

function renderLow(s) {
  const el = document.getElementById("one-task");
  const t = pickOneTask(s);
  const count = openTasks(s).length;
  const saved = `<p class="saved"><span class="dot c-sage"></span>Everything else is saved and waiting.</p>`;
  if (!t) {
    el.innerHTML = lowAdding
      ? `<p class="label">Add one</p><form id="low-form" novalidate><input class="field btn-block" id="low-title" aria-label="New task" maxlength="140" autocomplete="off" placeholder="What is one small thing?" style="min-height:64px;font-size:1.25rem;margin-bottom:12px">
         <button class="btn btn-primary done-btn" type="submit" data-primary-action>Add</button></form>`
      : `<p class="title">Nothing left. Rest is a valid task.</p><button type="button" class="btn btn-primary done-btn" data-act="low-add" data-primary-action>Add one</button>`;
    return;
  }
  el.innerHTML = `<p class="label">Just this one</p><h2 class="title">${esc(t.title)}</h2>
    <button type="button" class="btn btn-primary done-btn" data-act="low-done" data-id="${t.id}" data-primary-action>Done</button>
    ${count > 1 ? `<div class="skip-row"><button type="button" class="btn btn-ghost" data-act="low-skip">Not this one</button></div>` : ""}${saved}`;
}

function renderStats(s, doneCount) {
  const minsOf = (ms0) => s.focus.sessions.filter((x) => x.completed && x.startedAt >= ms0 && x.startedAt < ms0 + 864e5).reduce((a, x) => a + x.minutes, 0);
  const today0 = startOfDay();
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(today0); d.setDate(d.getDate() - i); days.push({ ms: d.getTime(), label: d.toLocaleDateString("en-US", { weekday: "short" }) }); }
  const vals = days.map((d) => minsOf(d.ms));
  const max = Math.max(60, ...vals);
  setText(document.getElementById("stat-done"), String(doneCount));
  setText(document.getElementById("stat-focus"), String(vals[6]));
  document.getElementById("bars").innerHTML = days.map((d, i) =>
    `<div class="bar-col" role="img" aria-label="${d.label}: ${vals[i]} focus minutes"><div class="bar${i === 6 ? " today" : ""}" style="height:${Math.round((vals[i] / max) * 52)}px"></div><span aria-hidden="true">${d.label[0]}</span></div>`).join("");
}

const COMING = [["Tomorrow", "Groceries and a short walk"], ["Thursday", "Dentist at 4pm, leave by 3:30"], ["Friday", "Send the weekly note to the team"], ["Saturday", "Call Mum, nothing else planned"]];
function renderComing(s) {
  const ul = document.getElementById("coming-list");
  ul.innerHTML = s.prefs.demoLoaded
    ? COMING.map(([w, t]) => `<li><span class="when">${w}</span><span>${t}</span></li>`).join("")
    : `<li class="empty">Nothing coming up. Enjoy the quiet.</li>`;
}

const TIPS = [
  "Start with the smallest version of the task. Two minutes of real work beats twenty minutes of deciding what to do first, and once you have started, carrying on usually feels far easier than you expected.",
  "Pick one thing to finish before lunch. Everything else today is a bonus, and that is allowed. A short list you actually finish builds more trust in yourself than a long list you keep carrying around.",
  "If a task keeps sliding to tomorrow, shrink it. Write the first sentence, open the file, or send the first message, then stop. Starting is the hard part, and a tiny start is still a start.",
  "Rest counts as part of the work. A short walk, a glass of water or ten quiet minutes are not a break from your plan, they are what lets the rest of the plan happen at all.",
  "Look at your list once in the morning and once in the evening. Checking it all day only adds friction, and the list will wait for you without any help, so let it.",
];

export function initToday() {
  document.getElementById("tip-text").textContent = TIPS[Math.floor(Date.now() / 864e5) % TIPS.length];
  setText(document.getElementById("date-line"), new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));

  const form = document.getElementById("qa-form"), input = document.getElementById("qa-title"), msg = document.getElementById("qa-msg");
  const add = (title, priority) => store.update((s) => { s.tasks.push({ id: uid("t"), title, note: "", priority, pinned: false, done: false, createdAt: Date.now(), doneAt: null }); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) { msg.hidden = false; msg.textContent = "Type a task first."; input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    msg.hidden = true; input.removeAttribute("aria-invalid");
    add(v, document.getElementById("qa-priority").value);
    input.value = ""; input.focus();
  });
  input.addEventListener("input", () => { if (input.value.trim()) { msg.hidden = true; input.removeAttribute("aria-invalid"); } });

  document.getElementById("intro-dismiss").addEventListener("click", () => store.update((s) => { s.prefs.introDismissed = true; }));
  document.getElementById("clear-done").addEventListener("click", () => {
    store.update((s) => { s.tasks = s.tasks.filter((t) => !t.done); });
    toast("Cleared completed tasks.");
  });
  document.getElementById("more-btn").addEventListener("click", () => {
    const list = document.getElementById("task-list");
    list.classList.toggle("show-all");
    render(store.get());
  });

  const screen = document.getElementById("screen");
  screen.addEventListener("change", (e) => {
    const el = e.target.closest('input[data-act="toggle"]');
    if (!el) return;
    const id = el.dataset.id, done = el.checked;
    store.update((s) => { const t = s.tasks.find((x) => x.id === id); if (t) { t.done = done; t.doneAt = done ? Date.now() : null; } });
  });
  screen.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === "pin") { menuOpenId = null; store.update((s) => { const t = s.tasks.find((x) => x.id === id); if (t) t.pinned = !t.pinned; }); }
    else if (act === "delete") {
      menuOpenId = null;
      const snap = store.get().tasks.find((x) => x.id === id);
      store.update((s) => { s.tasks = s.tasks.filter((x) => x.id !== id); });
      toast("Task deleted.", { action: { label: "Undo", fn: () => store.update((s) => { if (snap) s.tasks.push(snap); }) } });
    }
    else if (act === "menu") { menuOpenId = menuOpenId === id ? null : id; render(store.get()); const nb = document.querySelector(`[data-fk="menu:${id}"]`); if (nb) nb.focus(); }
    else if (act === "low-done") {
      store.update((s) => { const t = s.tasks.find((x) => x.id === id); if (t) { t.done = true; t.doneAt = Date.now(); } });
      toast("Done. Nice and easy.");
    }
    else if (act === "low-skip") { setSkip(getSkip() + 1); render(store.get()); const n = document.querySelector('[data-act="low-skip"]'); if (n) n.focus(); }
    else if (act === "low-add") { lowAdding = true; render(store.get()); const i = document.getElementById("low-title"); if (i) i.focus(); }
  });
  screen.addEventListener("submit", (e) => {
    if (e.target.id !== "low-form") return;
    e.preventDefault();
    const v = document.getElementById("low-title").value.trim();
    if (!v) { document.getElementById("low-title").focus(); return; }
    lowAdding = false;
    add(v, "med");
  });
  document.addEventListener("click", (e) => {
    if (menuOpenId && !e.target.closest(".row-menu") && !e.target.closest('[data-act="menu"]')) { menuOpenId = null; render(store.get()); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpenId) { const id = menuOpenId; menuOpenId = null; render(store.get()); const nb = document.querySelector(`[data-fk="menu:${id}"]`); if (nb) nb.focus(); }
  });

  document.getElementById("show-all").addEventListener("click", () => import("./energy.js").then((m) => m.setEnergy("normal")));
  store.subscribe(render);
  render(store.get());
}
