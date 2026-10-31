// Shows a strength badge and card at password fields. The password is only handed to this extension's own
// background script (inside the browser). This file has no network code and never stores or logs the password.
(() => {
  if (window.__pwStrengthLoaded) return; window.__pwStrengthLoaded = true;
  const api = globalThis.browser ?? globalThis.chrome;
  const LABELS = ["Weak", "Medium", "Strong"];
  // fill = bright bar colour; solid = darker colour with AA contrast for white text
  const TONE = [{ fill: "#ef4444", solid: "#d92d20" }, { fill: "#f59e0b", solid: "#b54708" }, { fill: "#22c55e", solid: "#067647" }];
  const S_PATH = "M242 588L393 738L396.5 739L466.5 739L471 738L555.5 650.5L431.5 650L367.5 588ZM575.5 416L582 429.5L586 445.5L586.5 458.5L584.5 471L579.5 483.5L570.5 496.5L559 507L545.5 515L633 602.5L607.5 629.5L660 680.5L750 590ZM275.5 436L461 621L488 518.5L402 432.5L461.5 375L593.5 375L655.5 436.5L782 436.5L629.5 285L428 285ZM639.5 700L589 650.5L534 705.5L502 739L601 738.5L604.5 736L638.5 702Z";   // the Strengthify "S" (one colour here so it follows the strength colour)
  const MARK = c => `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.8 7.5 10.2 4.4-1.4 7.5-5.6 7.5-10.2V5.6L12 2.5z" fill="${c}"/><path transform="translate(12 12.02) scale(0.02143) translate(-512 -512)" fill="${c === "#fff" ? "currentColor" : "#fff"}" fill-rule="evenodd" d="${S_PATH}"/></svg>`;
  const CLOSE = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const W = 288, GAP = 12;

  const tracked = new WeakSet();           // fields we attached to (keeps working if the site flips type to text)
  let ui = null, field = null, last = null, seq = 0, timer = null, hideTimer = null, dismissed = false;

  function build() {
    if (ui) return ui;
    const host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>
      *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
      .card{--bg:#fff;--fg:#111827;--mut:#667085;--soft:#f2f4f7;--line:#e4e7ec;
        position:absolute;width:${W}px;background:var(--bg);color:var(--fg);border-radius:14px;padding:14px 16px 12px;display:none;
        pointer-events:auto;font-size:13px;line-height:1.45;animation:pop .14s ease-out;
        filter:drop-shadow(0 0 .6px rgba(16,24,40,.45)) drop-shadow(0 12px 20px rgba(16,24,40,.16))}
      .arrow{position:absolute;width:12px;height:12px;background:var(--bg);transform:rotate(45deg);border-radius:2px}
      @keyframes pop{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
      @media(prefers-reduced-motion:reduce){.card{animation:none}.meter i{transition:none}}
      .head{display:flex;align-items:center;gap:8px}
      .logo{width:20px;height:20px;flex:none;color:#4f46e5}
      .title{font-weight:600;font-size:13px;flex:1}
      .pill{font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:99px;color:#fff;background:var(--c)}
      .x{pointer-events:auto;border:0;background:transparent;color:var(--mut);width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-right:-6px}
      .x:hover{background:var(--soft)}
      .meter{display:flex;gap:5px;margin:12px 0 4px}
      .meter i{flex:1;height:6px;border-radius:99px;background:var(--line);transition:background .15s}
      .meter i.on{background:var(--f)}
      .foot{margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-size:11px;color:var(--mut);display:flex;align-items:center;gap:6px}
      .foot svg{width:12px;height:12px;flex:none;color:#067647}
      .foot kbd{margin-left:auto;font:inherit;font-size:10.5px;border:1px solid var(--line);border-radius:4px;padding:0 5px}
      .badge{position:absolute;width:24px;height:24px;border-radius:50%;background:var(--c);color:var(--c);padding:4px;display:none;
        pointer-events:auto;cursor:pointer;box-shadow:0 1px 3px rgba(16,24,40,.35);transition:background .15s,color .15s}
      .badge:hover{transform:scale(1.08)}
      @media(prefers-color-scheme:dark){.card{--bg:#1d2230;--fg:#f2f4f7;--mut:#98a2b3;--soft:#2a3040;--line:#343b4d}
        .logo{color:#818cf8}.foot svg{color:#4ade80}}
      </style>
      <div class="badge" role="button" aria-label="Show password strength">${MARK("#fff")}</div>
      <div class="card" role="status" aria-live="polite">
        <div class="arrow"></div>
        <div class="head"><span class="logo">${MARK("currentColor")}</span><span class="title">Password strength</span><span class="pill"></span>
          <button class="x" type="button" aria-label="Dismiss">${CLOSE}</button></div>
        <div class="meter"><i></i><i></i><i></i></div>
        <div class="foot">${MARK("currentColor")}<span>Checked on your device. Never sent anywhere.</span><kbd>Esc</kbd></div>
      </div>`;
    document.documentElement.appendChild(host);
    const q = s => root.querySelector(s);
    ui = { host, badge: q(".badge"), card: q(".card"), arrow: q(".arrow"), pill: q(".pill"), meter: [...root.querySelectorAll(".meter i")] };
    // keep focus in the password box while the user interacts with our UI
    for (const el of [ui.card, ui.badge]) el.addEventListener("mousedown", e => e.preventDefault());
    q(".x").addEventListener("click", () => { dismissed = true; hideCard(); });
    ui.badge.addEventListener("click", () => { dismissed = !dismissed; if (field) field.focus(); paint(last); });
    return ui;
  }

  const hideAll = () => { if (ui) { ui.badge.style.display = "none"; ui.card.style.display = "none"; } };
  const hideCard = () => { if (ui) ui.card.style.display = "none"; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function place() {
    if (!ui || !field || !last) return;
    const r = field.getBoundingClientRect();
    if (!field.isConnected || r.width < 80 || !r.height) { hideAll(); return; }

    // Badge: inside the right edge of the field. If the site has its own icon there (show/hide eye), step left of it.
    let right = r.right - 8;
    if (typeof document.elementFromPoint === "function") {
      const shown = ui.badge.style.display; ui.badge.style.display = "none";           // so we hit the site's element, not ours
      const hit = document.elementFromPoint(r.right - 14, r.top + r.height / 2);
      ui.badge.style.display = shown;
      if (hit && hit !== field && !hit.contains(field) && hit !== ui.host) {
        const hr = hit.getBoundingClientRect(); if (hr.left > r.left + r.width / 2) right = hr.left - 6;
      }
    }
    ui.badge.style.left = Math.max(r.left + 4, right - 24) + "px";
    ui.badge.style.top = r.top + (r.height - 24) / 2 + "px";

    // Card: NEVER directly under the field, because that is where the browser draws its own saved-password list
    // (which sits above every web page and cannot be moved). Prefer the right side, then left, then above, then below.
    const vw = innerWidth, vh = innerHeight, ch = ui.card.offsetHeight || 250;
    let side, left, top;
    if (r.right + GAP + W <= vw - 8) { side = "right"; left = r.right + GAP; top = clamp(r.top - 12, 8, vh - ch - 8); }
    else if (r.left - GAP - W >= 8) { side = "left"; left = r.left - GAP - W; top = clamp(r.top - 12, 8, vh - ch - 8); }
    else if (r.top - GAP - ch >= 8) { side = "above"; left = clamp(r.left, 8, vw - W - 8); top = r.top - GAP - ch; }
    else { side = "below"; left = clamp(r.left, 8, vw - W - 8); top = clamp(r.bottom + GAP, 8, vh - ch - 8); }
    ui.card.dataset.side = side;
    ui.card.style.left = left + "px"; ui.card.style.top = top + "px";
    const a = ui.arrow.style; a.left = a.right = a.top = a.bottom = "auto";
    if (side === "right" || side === "left") {
      a.top = clamp(r.top + r.height / 2 - top - 6, 18, ch - 30) + "px"; a[side === "right" ? "left" : "right"] = "-5px";
    } else {
      a.left = clamp(r.left + 28 - left, 18, W - 30) + "px"; a[side === "above" ? "bottom" : "top"] = "-5px";
    }
  }

  function paint(res) {
    last = res && res.cls != null ? res : null;
    if (!field || !field.value || !last) { hideAll(); return; }
    const u = build(), t = TONE[last.cls];
    for (const el of [u.badge, u.card]) { el.style.setProperty("--c", t.solid); el.style.setProperty("--f", t.fill); }
    u.pill.textContent = LABELS[last.cls];
    u.meter.forEach((el, i) => el.classList.toggle("on", i <= last.cls));
    u.badge.style.display = "block";
    u.card.style.display = (document.activeElement === field && !dismissed) ? "block" : "none";
    place();
  }

  function ask(el) {
    const mine = ++seq;
    try { Promise.resolve(api.runtime.sendMessage({ type: "score", pw: el.value })).then(res => { if (mine === seq) paint(res); }).catch(hideAll); }
    catch (e) { hideAll(); }                               // extension was reloaded; this old page script is orphaned
  }

  function onEvent(e) {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (!tracked.has(el)) { if (el.type !== "password") return; tracked.add(el); }
    clearTimeout(hideTimer);
    if (e.type === "focusout") { dismissed = false; hideTimer = setTimeout(hideCard, 120); return; }
    if (field !== el) { field = el; last = null; dismissed = false; hideAll(); }
    if (!el.value) { hideAll(); return; }
    if (e.type === "focusin" && last) { paint(last); return; }
    clearTimeout(timer); timer = setTimeout(() => ask(el), 80);
  }

  for (const t of ["input", "focusin", "focusout"]) document.addEventListener(t, onEvent, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && ui && ui.card.style.display === "block") { dismissed = true; hideCard(); } }, true);
  addEventListener("scroll", place, true); addEventListener("resize", place);
})();