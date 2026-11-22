export const uid = (p = "t") => p + "_" + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3);
const pad = (n) => String(n).padStart(2, "0");
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dayKeyAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return todayKey(d); };
export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
export const isToday = (ms) => ms != null && ms >= startOfDay() && ms < startOfDay() + 864e5;
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const prefersReducedMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pad2 = pad;

/** Update an element's text without replacing its text node (avoids childList mutations / re-measures). */
export function setText(el, text) {
  if (!el) return;
  const n = el.firstChild;
  if (n && n.nodeType === 3 && el.childNodes.length === 1) { if (n.nodeValue !== text) n.nodeValue = text; }
  else el.textContent = text;
}

/** Re-render a container while keeping keyboard focus on the same control (matched by data-fk). */
export function renderKeepFocus(container, html, fallbackSel) {
  const a = document.activeElement;
  const key = a && container.contains(a) ? a.getAttribute("data-fk") : null;
  container.innerHTML = html;
  if (key) {
    const again = container.querySelector(`[data-fk="${CSS.escape(key)}"]`);
    if (again) { again.focus(); return; }
    const fb = fallbackSel && document.querySelector(fallbackSel);
    if (fb) fb.focus();
  }
}

export function ago(ms) {
  const d = Math.round((startOfDay() - startOfDay(new Date(ms))) / 864e5);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}
