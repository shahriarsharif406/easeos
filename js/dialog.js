const $ = (s) => document.querySelector(s);

export function confirm(text, { title = "Are you sure?", ok = "Confirm" } = {}) {
  return new Promise((resolve) => {
    const dlg = $("#dlg-confirm");
    const trigger = document.activeElement;
    $("#dlg-confirm-title").textContent = title;
    $("#dlg-confirm-text").textContent = text;
    $("#dlg-ok").textContent = ok;
    dlg.returnValue = "";
    const done = () => {
      dlg.removeEventListener("close", done);
      resolve(dlg.returnValue === "ok");
      if (trigger && trigger.isConnected && typeof trigger.focus === "function") trigger.focus();
    };
    dlg.addEventListener("close", done);
    dlg.showModal();
    $("#dlg-cancel").focus();
  });
}

export function openDialog(dlg, focusSel) {
  const trigger = document.activeElement;
  const done = () => { dlg.removeEventListener("close", done); if (trigger && trigger.isConnected) trigger.focus(); };
  dlg.addEventListener("close", done);
  dlg.showModal();
  const f = focusSel && dlg.querySelector(focusSel);
  if (f) f.focus();
}

export function toast(msg, { action, ms = 3600 } = {}) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.appendChild(document.createTextNode(msg));
  if (action) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn btn-ghost btn-sm"; b.textContent = action.label;
    b.style.cssText = "color:#fff;text-decoration:underline;min-height:32px;padding:0 8px";
    b.addEventListener("click", () => { action.fn(); el.remove(); });
    el.appendChild(b);
  }
  box.appendChild(el);
  setTimeout(() => el.remove(), action ? ms + 2400 : ms);
}
