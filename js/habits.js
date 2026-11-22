import { store } from "./store.js";
import { esc, uid, todayKey, dayKeyAgo, renderKeepFocus, setText } from "./util.js";
import { confirm, toast } from "./dialog.js";

const COLORS = ["clay", "ochre", "sage", "plum", "dusk", "rose"];
const COLOR_NAMES = { clay: "Clay", ochre: "Ochre", sage: "Sage", plum: "Plum", dusk: "Dusk", rose: "Rose" };

export function doneToday(h) { return !!h.log[todayKey()]; }
export function streakOf(h) {
  let i = doneToday(h) ? 0 : 1, n = 0;
  while (h.log[dayKeyAgo(i)]) { n++; i++; }
  return n;
}
const streakText = (n) => (n > 0 ? `${n}-day streak` : "No streak yet");

function chipHtml(h) {
  const on = doneToday(h), n = streakOf(h);
  return `<button type="button" class="habit-chip" data-act="htoggle" data-id="${h.id}" data-fk="hc:${h.id}" aria-pressed="${on}" aria-label="${esc(h.name)}, ${on ? "done" : "not done"} today, ${streakText(n)}">
    <span class="dot c-${h.color}"></span><span class="name">${esc(h.name)}</span><span class="streak" data-fx-noise>${streakText(n)}</span><span class="tick" aria-hidden="true">${on ? "✓" : ""}</span></button>`;
}

function weekHtml(h) {
  let out = "";
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const on = !!h.log[dayKeyAgo(i)];
    out += `<div class="day"><span class="dot c-${h.color}${on ? " on" : ""}" role="img" aria-label="${d.toLocaleDateString("en-US", { weekday: "long" })}: ${on ? "done" : "not done"}"></span><span aria-hidden="true">${d.toLocaleDateString("en-US", { weekday: "short" })[0]}</span></div>`;
  }
  return `<div class="week" data-min-energy="high">${out}</div>`;
}

function rowHtml(h) {
  const on = doneToday(h), n = streakOf(h);
  return `<li class="habit-row" data-id="${h.id}">
    <div class="info"><p class="name"><span class="dot c-${h.color}"></span>${esc(h.name)}</p><p class="muted small" data-fx-noise>${streakText(n)}</p></div>
    ${weekHtml(h)}
    <button type="button" class="btn btn-secondary toggle-btn" data-act="htoggle" data-id="${h.id}" data-fk="ht:${h.id}" aria-pressed="${on}">${on ? "Done today" : "Mark done"}</button>
    <button type="button" class="icon-btn" data-act="hdelete" data-id="${h.id}" data-fk="hd:${h.id}" aria-label="Delete habit: ${esc(h.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></li>`;
}

function render(s) {
  const hs = s.habits, done = hs.filter(doneToday).length, total = hs.length;
  renderKeepFocus(document.getElementById("habit-chips"), total ? hs.map(chipHtml).join("") : `<p class="empty">No habits yet. Add one on the Habits tab.</p>`);
  const label = `${done} of ${total} today`;
  setText(document.getElementById("habit-count"), label);
  document.getElementById("habit-fill").style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
  setText(document.getElementById("habit-summary-text"), `${done} of ${total} habits today`);
  renderKeepFocus(document.getElementById("habit-list"), total ? hs.map(rowHtml).join("") : `<li class="empty">No habits yet. Name one above and pick a colour.</li>`, "#habit-name");
  const undone = hs.filter((h) => !doneToday(h));
  renderKeepFocus(document.getElementById("habit-low"), undone.length
    ? undone.slice(0, 3).map((h, i) => `<button type="button" class="big-toggle" data-act="htoggle" data-id="${h.id}" data-fk="hl:${h.id}" aria-pressed="false"${i === 0 ? " data-primary-action" : ""}><span class="dot c-${h.color}"></span>${esc(h.name)}</button>`).join("")
    : `<p class="card empty" style="font-size:1.25rem">${total ? "All done for today." : "No habits yet."}</p>`);
}

export function initHabits() {
  const form = document.getElementById("habit-form"), name = document.getElementById("habit-name"), msg = document.getElementById("habit-msg");
  document.getElementById("swatches").innerHTML = COLORS.map((c, i) =>
    `<label class="swatch"><input type="radio" name="hcolor" value="${c}"${i === 0 ? " checked" : ""} aria-label="${COLOR_NAMES[c]}"><span class="dot c-${c}"></span></label>`).join("");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = name.value.trim();
    if (!v) { msg.hidden = false; msg.textContent = "Name the habit first."; name.setAttribute("aria-invalid", "true"); name.focus(); return; }
    msg.hidden = true; name.removeAttribute("aria-invalid");
    const color = form.querySelector('input[name="hcolor"]:checked').value;
    store.update((s) => { s.habits.push({ id: uid("h"), name: v, color, log: {}, createdAt: Date.now() }); });
    name.value = ""; name.focus();
  });
  document.getElementById("screen").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === "htoggle") {
      store.update((s) => { const h = s.habits.find((x) => x.id === id); if (h) { const k = todayKey(); if (h.log[k]) delete h.log[k]; else h.log[k] = true; } });
    } else if (b.dataset.act === "hdelete") {
      const h = store.get().habits.find((x) => x.id === id);
      if (!h) return;
      const ok = await confirm(`Delete “${h.name}” and its history? This can't be undone.`, { title: "Delete habit?", ok: "Delete" });
      if (ok) { store.update((s) => { s.habits = s.habits.filter((x) => x.id !== id); }); toast("Habit deleted."); }
    }
  });
  store.subscribe(render);
  render(store.get());
}
