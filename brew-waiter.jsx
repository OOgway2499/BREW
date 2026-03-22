import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  SUPABASE CONFIG
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://kutqywmxkfysulshkzxn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dHF5d214a2Z5c3Vsc2hrenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjA3NTYsImV4cCI6MjA4ODUzNjc1Nn0.XhZk-467hh3-p0-H0wpLmxtZRVM8HWtaieBo3j-lSfM";
const SB = {
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
};

// ─────────────────────────────────────────────────────────────
//  DB — ORDERS
// ─────────────────────────────────────────────────────────────
async function dbGetOrders() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, { headers: SB });
  return await res.json() || [];
}
async function dbUpdateStatus(id, status) {
  await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}`, {
    method: "PATCH", headers: { ...SB, "Prefer": "return=minimal" }, body: JSON.stringify({ status }),
  });
}

// ─────────────────────────────────────────────────────────────
//  DB — MENU
// ─────────────────────────────────────────────────────────────
async function dbGetMenuItems() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/menu_items?select=*&order=sort_order.asc,created_at.asc`, { headers: SB });
  return await res.json() || [];
}
async function dbToggleAvailable(id, available) {
  await fetch(`${SUPABASE_URL}/rest/v1/menu_items?id=eq.${id}`, {
    method: "PATCH", headers: { ...SB, "Prefer": "return=minimal" }, body: JSON.stringify({ available }),
  });
}
async function dbUpdateMenuItem(id, fields) {
  await fetch(`${SUPABASE_URL}/rest/v1/menu_items?id=eq.${id}`, {
    method: "PATCH", headers: { ...SB, "Prefer": "return=minimal" }, body: JSON.stringify(fields),
  });
}
async function dbAddMenuItem(item) {
  await fetch(`${SUPABASE_URL}/rest/v1/menu_items`, {
    method: "POST", headers: { ...SB, "Prefer": "return=minimal" }, body: JSON.stringify(item),
  });
}
async function dbDeleteMenuItem(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/menu_items?id=eq.${id}`, {
    method: "DELETE", headers: { ...SB, "Prefer": "return=minimal" },
  });
}
// ─────────────────────────────────────────────────────────
//  IST HELPERS  (Open 12:00 PM – 11:00 PM)
// ─────────────────────────────────────────────────────────
const OPEN_HOUR = 12;
const CLOSE_HOUR = 23;
function nowIST() { return new Date(Date.now() + 5.5 * 60 * 60 * 1000); }
function todayIST() { return nowIST().toISOString().slice(0, 10); }
function istHour() { const d = nowIST(); return d.getUTCHours() + d.getUTCMinutes() / 60; }
function isCafeTime() { const h = istHour(); return h >= OPEN_HOUR && h < CLOSE_HOUR; }

async function dbGetSession(date) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${date}&select=*`, { headers: SB });
  const d = await r.json(); return d?.[0] || null;
}
async function dbEnsureOpenSession(date) {
  await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
    method: "POST",
    headers: { ...SB, "Prefer": "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({ id: date, status: "open", opened_at: new Date().toISOString(), opened_by: "auto" }),
  });
}
async function dbManualOpenSession(date) {
  const e = await dbGetSession(date);
  if (e) {
    await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${date}`, {
      method: "PATCH", headers: { ...SB, "Prefer": "return=minimal" },
      body: JSON.stringify({ status: "open", opened_at: new Date().toISOString(), opened_by: "manual", closed_at: null }),
    });
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: "POST", headers: { ...SB, "Prefer": "return=minimal" },
      body: JSON.stringify({ id: date, status: "open", opened_at: new Date().toISOString(), opened_by: "manual" }),
    });
  }
}
async function dbCloseSession(date, by = "manual") {
  const start = `${date}T00:00:00+05:30`, end = `${date}T23:59:59+05:30`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?created_at=gte.${encodeURIComponent(start)}&created_at=lte.${encodeURIComponent(end)}&select=*`, { headers: SB });
  const orders = await r.json() || [];
  const order_count = orders.length;
  const revenue = orders.filter(o => o.status === "served").reduce((s, o) => s + (o.total || 0), 0);
  await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${date}`, {
    method: "PATCH", headers: { ...SB, "Prefer": "return=minimal" },
    body: JSON.stringify({ status: "closed", closed_at: new Date().toISOString(), closed_by: by, order_count, revenue }),
  });
}
async function dbGetRecentSessions(limit = 30) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sessions?select=*&order=id.desc&limit=${limit}`, { headers: SB });
  return await r.json() || [];
}
async function dbGetOrdersForDate(date) {
  const start = `${date}T00:00:00+05:30`, end = `${date}T23:59:59+05:30`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?created_at=gte.${encodeURIComponent(start)}&created_at=lte.${encodeURIComponent(end)}&select=*&order=created_at.desc`, { headers: SB });
  return await r.json() || [];
}


// ─────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────
const WAITER_PIN = "2468";
const TABLES = Array.from({ length: 10 }, (_, i) => i + 1);
const CATEGORIES = ["Garlic Breads", "Sandwiches", "Wraps", "Salads", "Pastas", "Pizzas", "Appetizers", "Iced Teas", "Herbal Teas", "Chocolate", "Mocktails", "Coffees", "Coffee Fusions", "Cold Brews", "Cold Coffees", "Shakes"];

// ─────────────────────────────────────────────────────────────
//  FONTS
// ─────────────────────────────────────────────────────────────
const _fl = document.createElement("link"); _fl.rel = "stylesheet";
_fl.href = "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,800;1,400&family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap";
document.head.appendChild(_fl);

// ─────────────────────────────────────────────────────────────
//  SOUNDS
// ─────────────────────────────────────────────────────────────
function playNewOrder() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[0, .05, 880], [.15, .05, 1100], [.3, .05, 1320], [.5, .08, 1100]].forEach(([t, d, f]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(.35, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + d + .25);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + .3);
    });
  } catch { }
}
function playPinError() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 180; o.type = "square";
    g.gain.setValueAtTime(.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .45);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + .45);
  } catch { }
}

// ─────────────────────────────────────────────────────────────
//  GLOBAL CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fdf8f3; font-family: 'DM Sans', sans-serif; color: #1a0a04; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(59,31,14,.15); border-radius: 99px; }
  input, select, textarea { font-family: 'DM Sans', sans-serif; }

  @keyframes fadeUp    { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
  @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
  @keyframes shake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:.2} }
  @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:.08} }
  @keyframes popIn     { 0%{transform:scale(.94);opacity:0} 60%{transform:scale(1.02)} 100%{transform:scale(1);opacity:1} }
  @keyframes spin      { to { transform: rotate(360deg); } }
  @keyframes bounce    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes glow      { 0%,100%{box-shadow:0 0 16px rgba(232,98,42,.2)} 50%{box-shadow:0 0 32px rgba(232,98,42,.45)} }

  .btn-action { transition: all .18s cubic-bezier(.34,1.56,.64,1); }
  .btn-action:hover { transform: translateY(-2px) scale(1.03); }
  .btn-action:active { transform: scale(.93); }

  .card-order { transition: all .25s ease; }
  .card-order:hover { transform: translateX(3px); box-shadow: 4px 0 20px rgba(232,98,42,.08) !important; }

  .tab-btn { transition: all .2s ease; }
  .tab-btn:hover { color: #1a0a04 !important; }

  .pin-key { transition: all .15s ease; }
  .pin-key:hover { background: rgba(232,98,42,.12) !important; border-color: rgba(232,98,42,.35) !important; color: #e8622a !important; }
  .pin-key:active { transform: scale(.88); }

  .toggle-avail { transition: all .2s ease; }
  .toggle-avail:hover { filter: brightness(.92); }
`;

// ═══════════════════════════════════════════════════════════════
//  PIN SCREEN
// ═══════════════════════════════════════════════════════════════
function PinScreen({ onUnlock }) {
  const [pin, setPin] = useState([]);
  const [shake, setShake] = useState(false);
  const [errMsg, setErr] = useState("");
  const [tries, setTries] = useState(0);
  const [locked, setLock] = useState(false);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!locked || secs <= 0) { if (locked && secs === 0) { setLock(false); setTries(0); setErr(""); } return; }
    const t = setTimeout(() => setSecs(n => n - 1), 1000); return () => clearTimeout(t);
  }, [locked, secs]);

  function press(k) {
    if (locked || pin.length >= 4) return;
    const next = [...pin, k]; setPin(next);
    if (next.length === 4) setTimeout(() => {
      if (next.join("") === WAITER_PIN) { onUnlock(); }
      else {
        playPinError(); setShake(true); setTimeout(() => { setShake(false); setPin([]); }, 600);
        const nt = tries + 1; setTries(nt);
        if (nt >= 3) { setLock(true); setSecs(30); setErr(""); }
        else setErr(`Wrong PIN — ${3 - nt} attempt${3 - nt === 1 ? "" : "s"} left`);
      }
    }, 170);
  }

  const KEYS = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]];

  return (
    <div style={{ minHeight: "100vh", background: "#fdf8f3", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>

      {/* Background texture */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 60%, rgba(232,98,42,.12) 0%, transparent 55%), radial-gradient(circle at 80% 20%, rgba(59,31,14,.07) 0%, transparent 50%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(59,31,14,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,31,14,.06) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />

      {/* Scanline */}
      <div style={{ position: "absolute", left: 0, right: 0, height: 120, background: "linear-gradient(transparent, rgba(232,98,42,.04), transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 340, padding: "0 1.5rem", animation: "fadeUp .6s cubic-bezier(.16,1,.3,1)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <img src="/chef-logo.png" style={{ width: 36, height: 36, objectFit: "contain" }} alt="" />
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: "1.5rem", fontWeight: 800, letterSpacing: -1, color: "#1a0a04" }}>The Chef Table</span>
          </div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: ".62rem", letterSpacing: 4, color: "rgba(232,98,42,.65)", textTransform: "uppercase" }}>Staff Terminal · Authentication</div>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", border: "1px solid rgba(59,31,14,.1)", borderRadius: 20, padding: "2rem 1.8rem", backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(59,31,14,.12), inset 0 1px 0 rgba(255,255,255,.8)" }}>

          {/* PIN dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 28, animation: shake ? "shake .55s ease" : "none" }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: "50%", transition: "all .2s cubic-bezier(.34,1.56,.64,1)",
                background: pin.length > i ? "#e8622a" : "transparent",
                border: `2px solid ${pin.length > i ? "#e8622a" : "rgba(59,31,14,.15)"}`,
                boxShadow: pin.length > i ? "0 0 12px rgba(232,98,42,.5)" : "none",
                transform: pin.length > i ? "scale(1.25)" : "scale(1)"
              }} />
            ))}
          </div>

          {/* Status msg */}
          <div style={{ textAlign: "center", minHeight: 20, marginBottom: 20, fontFamily: "'Space Mono',monospace", fontSize: ".65rem", letterSpacing: 1 }}>
            {locked
              ? <span style={{ color: "#ef4444", animation: "blink 1s infinite" }}>🔒 Locked · {secs}s</span>
              : errMsg ? <span style={{ color: "#fb923c" }}>{errMsg}</span>
                : <span style={{ color: "rgba(59,31,14,.3)" }}>Enter your staff PIN</span>}
          </div>

          {locked ? (
            <div style={{ background: "rgba(239,68,68,.05)", border: "1px solid rgba(239,68,68,.15)", borderRadius: 12, padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔒</div>
              <div style={{ fontFamily: "'Space Mono',monospace", color: "#ef4444", fontSize: ".72rem", letterSpacing: 1 }}>Terminal locked · {secs}s</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {KEYS.flat().map((k, i) => {
                const empty = k === "", back = k === "⌫";
                return (
                  <button key={i} className={empty ? "" : "pin-key"}
                    onClick={() => back ? setPin(p => p.slice(0, -1)) : (!empty && press(k))}
                    style={{
                      aspectRatio: "1", borderRadius: 12, border: empty ? "none" : `1px solid rgba(59,31,14,.12)`,
                      background: empty ? "transparent" : back ? "rgba(239,68,68,.06)" : "rgba(59,31,14,.04)",
                      color: back ? "#ef4444" : "#1a0a04",
                      fontFamily: "'Space Mono',monospace", fontSize: back ? "1rem" : "1.25rem", fontWeight: 700,
                      cursor: empty ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      pointerEvents: empty ? "none" : "auto"
                    }}>
                    {k}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontFamily: "'Space Mono',monospace", fontSize: ".55rem", color: "rgba(59,31,14,.2)", letterSpacing: 3 }}>DEMO PIN: 2468</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MENU MANAGER
// ═══════════════════════════════════════════════════════════════
function MenuManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editingId, setEditing] = useState(null);
  const [editFields, setFields] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [catFilter, setCat] = useState("All");
  const [newItem, setNew] = useState({ name: "", description: "", price: "", emoji: "☕", prep_time: "5", tag: "", category: "Coffee", available: true });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await dbGetMenuItems();
    setItems(data); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(item) {
    setSaving(item.id);
    const next = !item.available;
    setItems(p => p.map(i => i.id === item.id ? { ...i, available: next } : i));
    await dbToggleAvailable(item.id, next);
    setSaving(null);
  }

  function startEdit(item) {
    setEditing(item.id);
    setFields({ name: item.name, description: item.description, price: item.price, emoji: item.emoji, prep_time: item.prep_time, tag: item.tag || "", category: item.category });
  }

  async function saveEdit(id) {
    setSaving(id);
    const f = { ...editFields, price: parseInt(editFields.price) || 0, prep_time: parseInt(editFields.prep_time) || 5 };
    setItems(p => p.map(i => i.id === id ? { ...i, ...f } : i));
    await dbUpdateMenuItem(id, f);
    setEditing(null); setSaving(null);
  }

  async function confirmDelete(id) {
    setSaving(id);
    setItems(p => p.filter(i => i.id !== id));
    await dbDeleteMenuItem(id);
    setDeleteId(null); setSaving(null);
  }

  async function addItem() {
    if (!newItem.name || !newItem.price) return;
    setSaving("new");
    const id = `item-${Date.now()}`;
    const item = { ...newItem, id, price: parseInt(newItem.price) || 0, prep_time: parseInt(newItem.prep_time) || 5, sort_order: items.length };
    setItems(p => [...p, item]);
    await dbAddMenuItem(item);
    setNew({ name: "", description: "", price: "", emoji: "☕", prep_time: "5", tag: "", category: "Coffee", available: true });
    setShowAdd(false); setSaving(null);
  }

  const cats = ["All", ...CATEGORIES];
  const filtered = catFilter === "All" ? items : items.filter(i => i.category === catFilter);

  const inp = { background: "rgba(59,31,14,.04)", border: "1px solid rgba(59,31,14,.12)", borderRadius: 10, padding: "9px 13px", color: "#1a0a04", fontSize: ".85rem", outline: "none", width: "100%" };

  return (
    <div style={{ padding: "0 1.2rem 4rem" }}>
      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(12px)" }}>
          <div style={{ background: "#fff", border: "1px solid rgba(239,68,68,.2)", borderRadius: 20, padding: "2.2rem", maxWidth: 300, width: "90%", textAlign: "center", animation: "popIn .3s ease" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.1rem", fontWeight: 800, color: "#1a0a04", marginBottom: 8 }}>Delete item?</div>
            <div style={{ color: "rgba(59,31,14,.45)", fontSize: ".82rem", marginBottom: 24, lineHeight: 1.7 }}>This permanently removes it from the customer menu.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(59,31,14,.04)", border: "1px solid rgba(59,31,14,.1)", color: "#9a7a5a", cursor: "pointer", fontWeight: 600, fontSize: ".85rem" }}>Cancel</button>
              <button onClick={() => confirmDelete(deleteId)} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", color: "#ef4444", cursor: "pointer", fontWeight: 700, fontSize: ".85rem" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 12px", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} className="tab-btn"
              style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${catFilter === c ? "rgba(232,98,42,.4)" : "rgba(59,31,14,.1)"}`, background: catFilter === c ? "rgba(232,98,42,.08)" : "transparent", color: catFilter === c ? "#c4501e" : "rgba(59,31,14,.4)", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: ".62rem", fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="btn-action"
          style={{ padding: "7px 16px", borderRadius: 10, border: "1px solid rgba(22,163,74,.35)", background: "rgba(22,163,74,.08)", color: "#16a34a", cursor: "pointer", fontWeight: 700, fontSize: ".82rem", whiteSpace: "nowrap", flexShrink: 0 }}>
          + Add Item
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: "rgba(22,163,74,.04)", border: "1px solid rgba(22,163,74,.15)", borderRadius: 16, padding: "1.4rem", marginBottom: 16, animation: "fadeUp .3s ease" }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: ".6rem", color: "#16a34a", letterSpacing: 2, marginBottom: 14 }}>NEW MENU ITEM</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input style={inp} placeholder="Item name *" value={newItem.name} onChange={e => setNew(p => ({ ...p, name: e.target.value }))} />
            <div style={{ display: "flex", gap: 7 }}>
              <input style={{ ...inp, width: 52, flexShrink: 0, textAlign: "center", fontSize: "1.2rem", padding: "6px" }} value={newItem.emoji} onChange={e => setNew(p => ({ ...p, emoji: e.target.value }))} />
              <select style={{ ...inp, flex: 1, cursor: "pointer" }} value={newItem.category} onChange={e => setNew(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <input style={{ ...inp, marginBottom: 8 }} placeholder="Description" value={newItem.description} onChange={e => setNew(p => ({ ...p, description: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            <input style={inp} placeholder="Price ₹ *" type="number" value={newItem.price} onChange={e => setNew(p => ({ ...p, price: e.target.value }))} />
            <input style={inp} placeholder="Prep time (min)" type="number" value={newItem.prep_time} onChange={e => setNew(p => ({ ...p, prep_time: e.target.value }))} />
            <input style={inp} placeholder="Tag" value={newItem.tag} onChange={e => setNew(p => ({ ...p, tag: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "rgba(59,31,14,.04)", border: "1px solid rgba(59,31,14,.1)", color: "#9a7a5a", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
            <button onClick={addItem} disabled={saving === "new" || !newItem.name || !newItem.price}
              style={{ flex: 2, padding: "10px", borderRadius: 10, background: "rgba(22,163,74,.1)", border: "1px solid rgba(22,163,74,.3)", color: "#16a34a", cursor: "pointer", fontWeight: 700, opacity: (!newItem.name || !newItem.price) ? 0.4 : 1 }}>
              {saving === "new" ? "Saving…" : "✓ Add to Menu"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem", gap: 12, color: "rgba(59,31,14,.3)", fontFamily: "'Space Mono',monospace", fontSize: ".7rem", letterSpacing: 2 }}>
          <div style={{ width: 18, height: 18, border: "2px solid rgba(59,31,14,.1)", borderTop: "2px solid #e8622a", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          LOADING…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 1rem", color: "rgba(59,31,14,.15)", fontFamily: "'Space Mono',monospace" }}>
          <div style={{ fontSize: "2rem", marginBottom: 10 }}>[ ]</div>
          <div style={{ fontSize: ".7rem", letterSpacing: 3 }}>NO ITEMS</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(item => (
            <div key={item.id} style={{ background: item.available ? "#fff" : "rgba(239,68,68,.03)", border: `1px solid ${item.available ? "rgba(59,31,14,.08)" : "rgba(239,68,68,.15)"}`, borderRadius: 14, padding: "14px 16px", borderLeft: `3px solid ${item.available ? "#e8622a" : "rgba(239,68,68,.4)"}`, animation: "popIn .3s ease", transition: "all .3s" }}>
              {editingId === item.id ? (
                <div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: ".58rem", color: "#e8622a", letterSpacing: 2, marginBottom: 12 }}>EDITING</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
                    <input style={inp} value={editFields.name} onChange={e => setFields(p => ({ ...p, name: e.target.value }))} placeholder="Name" />
                    <div style={{ display: "flex", gap: 6 }}>
                      <input style={{ ...inp, width: 52, textAlign: "center", fontSize: "1.1rem", padding: "6px", flexShrink: 0 }} value={editFields.emoji} onChange={e => setFields(p => ({ ...p, emoji: e.target.value }))} />
                      <select style={{ ...inp, flex: 1, cursor: "pointer" }} value={editFields.category} onChange={e => setFields(p => ({ ...p, category: e.target.value }))}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <input style={{ ...inp, marginBottom: 7 }} value={editFields.description} onChange={e => setFields(p => ({ ...p, description: e.target.value }))} placeholder="Description" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 12 }}>
                    <input style={inp} type="number" value={editFields.price} onChange={e => setFields(p => ({ ...p, price: e.target.value }))} placeholder="Price ₹" />
                    <input style={inp} type="number" value={editFields.prep_time} onChange={e => setFields(p => ({ ...p, prep_time: e.target.value }))} placeholder="Time (m)" />
                    <input style={inp} value={editFields.tag} onChange={e => setFields(p => ({ ...p, tag: e.target.value }))} placeholder="Tag" />
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "9px", borderRadius: 9, background: "rgba(59,31,14,.04)", border: "1px solid rgba(59,31,14,.1)", color: "#9a7a5a", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                    <button onClick={() => saveEdit(item.id)} disabled={saving === item.id}
                      style={{ flex: 2, padding: "9px", borderRadius: 9, background: "rgba(232,98,42,.1)", border: "1px solid rgba(232,98,42,.25)", color: "#fb923c", cursor: "pointer", fontWeight: 700 }}>
                      {saving === item.id ? "Saving…" : "✓ Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: "1.6rem", width: 42, height: 42, background: "rgba(59,31,14,.05)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: item.available ? 1 : .3 }}>{item.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: ".9rem", color: item.available ? "#1a0a04" : "rgba(59,31,14,.3)" }}>{item.name}</span>
                      {!item.available && <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".52rem", color: "#ef4444", background: "rgba(239,68,68,.12)", borderRadius: 5, padding: "2px 7px", letterSpacing: 1 }}>OUT OF STOCK</span>}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 800, color: "#e8622a", fontSize: ".92rem" }}>₹{item.price}</span>
                      <span style={{ color: "rgba(59,31,14,.3)", fontSize: ".78rem" }}>⏱ {item.prep_time}m</span>
                      {item.tag && <span style={{ fontSize: ".7rem", color: "rgba(59,31,14,.35)", background: "rgba(59,31,14,.06)", borderRadius: 5, padding: "2px 7px" }}>{item.tag}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                    <button onClick={() => toggle(item)} disabled={saving === item.id} className="toggle-avail"
                      style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${item.available ? "rgba(22,163,74,.3)" : "rgba(239,68,68,.3)"}`, background: item.available ? "rgba(22,163,74,.08)" : "rgba(239,68,68,.06)", color: item.available ? "#16a34a" : "#ef4444", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: ".58rem", fontWeight: 700, minWidth: 78, textAlign: "center" }}>
                      {saving === item.id ? "…" : item.available ? "✓ In Stock" : "✗ Out"}
                    </button>
                    <button onClick={() => startEdit(item)} className="btn-action"
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(232,98,42,.25)", background: "rgba(232,98,42,.06)", color: "#c4501e", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem" }}>✏️</button>
                    <button onClick={() => setDeleteId(item.id)} className="btn-action"
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(239,68,68,.15)", background: "rgba(239,68,68,.05)", color: "rgba(239,68,68,.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem" }}>🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
//  HISTORY TAB
// ═══════════════════════════════════════════════════════
function HistoryTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [dayOrders, setDayOrds] = useState({});
  const [loadingDay, setLoadDay] = useState(null);
  const F = { title: "'Fraunces',serif", body: "'DM Sans',sans-serif", mono: "'Space Mono',monospace" };

  useEffect(() => {
    async function load() {
      const sessData = await dbGetRecentSessions();
      setSessions(sessData);
      setLoading(false);
      // Pre-fetch orders for all sessions so revenue shows immediately
      const allOrders = {};
      await Promise.all(sessData.map(async s => {
        allOrders[s.id] = await dbGetOrdersForDate(s.id);
      }));
      setDayOrds(allOrders);
    }
    load();
  }, []);

  async function toggleDay(date) {
    if (expanded === date) { setExpanded(null); return; }
    setExpanded(date);
    if (!dayOrders[date]) {
      setLoadDay(date);
      const o = await dbGetOrdersForDate(date);
      setDayOrds(p => ({ ...p, [date]: o }));
      setLoadDay(null);
    }
  }

  const ST = {
    pending: { color: "#e8622a", bg: "rgba(232,98,42,.1)", label: "Pending" },
    preparing: { color: "#d97706", bg: "rgba(217,119,6,.1)", label: "Preparing" },
    served: { color: "#16a34a", bg: "rgba(22,163,74,.1)", label: "Served" },
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem", gap: 12, color: "rgba(59,31,14,.3)", fontFamily: F.mono, fontSize: ".7rem", letterSpacing: 2 }}>
      <div style={{ width: 18, height: 18, border: "2px solid rgba(59,31,14,.1)", borderTop: "2px solid #e8622a", borderRadius: "50%", animation: "spin .8s linear infinite" }} />LOADING HISTORY…
    </div>
  );
  if (!sessions.length) return (
    <div style={{ textAlign: "center", padding: "5rem 1rem", color: "rgba(59,31,14,.12)" }}>
      <div style={{ fontFamily: F.title, fontSize: "2.5rem", marginBottom: 10 }}>◻</div>
      <div style={{ fontFamily: F.mono, fontSize: ".7rem", letterSpacing: 3 }}>NO HISTORY YET</div>
    </div>
  );

  return (
    <div style={{ padding: "4px 1.4rem 4rem", display: "flex", flexDirection: "column", gap: 10 }}>
      {sessions.map(sess => {
        const isOpen = sess.status === "open";
        const isExp = expanded === sess.id;
        const orders = dayOrders[sess.id] || [];
        const isLoad = loadingDay === sess.id;
        const isToday = sess.id === todayIST();
        const dt = new Date(sess.id + "T12:00:00Z");
        const dayNum = dt.getUTCDate();
        const month = dt.toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
        const weekday = dt.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
        const openT = sess.opened_at ? new Date(sess.opened_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : null;
        const closeT = sess.closed_at ? new Date(sess.closed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : null;

        return (
          <div key={sess.id} style={{ background: "#fff", borderRadius: 16, border: `1px solid ${isOpen ? "rgba(232,98,42,.25)" : "rgba(59,31,14,.08)"}`, overflow: "hidden", boxShadow: "0 2px 12px rgba(59,31,14,.05)", borderLeft: `4px solid ${isOpen ? "#e8622a" : "rgba(59,31,14,.15)"}` }}>

            <button onClick={() => toggleDay(sess.id)}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Calendar tile */}
                <div style={{ background: isOpen ? "rgba(232,98,42,.08)" : "rgba(59,31,14,.04)", borderRadius: 10, padding: "8px 12px", textAlign: "center", minWidth: 54, flexShrink: 0 }}>
                  <div style={{ fontFamily: F.mono, fontSize: ".46rem", color: isOpen ? "#e8622a" : "rgba(59,31,14,.4)", letterSpacing: 1 }}>{month}</div>
                  <div style={{ fontFamily: F.title, fontSize: "1.7rem", fontWeight: 800, color: isOpen ? "#e8622a" : "#1a0a04", lineHeight: 1 }}>{dayNum}</div>
                  <div style={{ fontFamily: F.mono, fontSize: ".46rem", color: "rgba(59,31,14,.35)", letterSpacing: 1 }}>{weekday}</div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: ".9rem", color: "#1a0a04" }}>{sess.id}</span>
                    {isToday && <span style={{ fontFamily: F.mono, fontSize: ".5rem", background: "rgba(232,98,42,.1)", color: "#c4501e", borderRadius: 5, padding: "2px 7px", letterSpacing: 1 }}>TODAY</span>}
                    {sess.closed_by === "manual" && !isOpen && <span style={{ fontFamily: F.mono, fontSize: ".5rem", background: "rgba(59,31,14,.06)", color: "rgba(59,31,14,.4)", borderRadius: 5, padding: "2px 7px", letterSpacing: 1 }}>CLOSED EARLY</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontFamily: F.mono, fontSize: ".72rem", color: "rgba(59,31,14,.4)" }}>{(dayOrders[sess.id] || []).length} orders</span>
                    <span style={{ fontFamily: F.title, fontWeight: 800, fontSize: ".85rem", color: "#e8622a" }}>₹{(dayOrders[sess.id] || []).filter(o => o.status === "served").reduce((s, o) => s + (o.total || 0), 0)}</span>
                    {openT && <span style={{ fontFamily: F.mono, fontSize: ".58rem", color: "rgba(59,31,14,.28)" }}>{openT} → {closeT || "ongoing"}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, background: isOpen ? "rgba(232,98,42,.08)" : "rgba(59,31,14,.05)", border: `1px solid ${isOpen ? "rgba(232,98,42,.2)" : "rgba(59,31,14,.1)"}` }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: isOpen ? "#e8622a" : "rgba(59,31,14,.25)", animation: isOpen ? "pulse 1.5s infinite" : "none" }} />
                  <span style={{ fontFamily: F.mono, fontSize: ".56rem", fontWeight: 700, color: isOpen ? "#c4501e" : "rgba(59,31,14,.4)", letterSpacing: .5 }}>{isOpen ? "OPEN" : "CLOSED"}</span>
                </div>
                <span style={{ color: "rgba(59,31,14,.25)", fontSize: "1rem", transition: "transform .25s", display: "block", transform: isExp ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </div>
            </button>

            {isExp && (
              <div style={{ borderTop: "1px solid rgba(59,31,14,.06)" }}>
                {isLoad ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", gap: 10, color: "rgba(59,31,14,.3)", fontFamily: F.mono, fontSize: ".65rem", letterSpacing: 2 }}>
                    <div style={{ width: 14, height: 14, border: "2px solid rgba(59,31,14,.1)", borderTop: "2px solid #e8622a", borderRadius: "50%", animation: "spin .8s linear infinite" }} />LOADING…
                  </div>
                ) : orders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "rgba(59,31,14,.2)", fontFamily: F.mono, fontSize: ".68rem", letterSpacing: 2 }}>NO ORDERS THIS DAY</div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", background: "rgba(59,31,14,.02)", borderBottom: "1px solid rgba(59,31,14,.06)" }}>
                      {[
                        ["Total Orders", orders.length, "#1a0a04"],
                        ["Served", orders.filter(o => o.status === "served").length, "#16a34a"],
                        ["Revenue", "₹" + orders.filter(o => o.status === "served").reduce((s, o) => s + (o.total || 0), 0), "#e8622a"],
                      ].map(([l, v, c], i) => (
                        <div key={l} style={{ padding: "12px 16px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(59,31,14,.06)" : "none" }}>
                          <div style={{ fontFamily: F.title, fontSize: "1.15rem", fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
                          <div style={{ fontSize: ".68rem", color: "rgba(59,31,14,.4)", marginTop: 3 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {orders.map(order => {
                      const st = ST[order.status] || ST.served;
                      const tableNum = order.table_num ?? order.table ?? "?";
                      const ts = order.created_at || order.time;
                      const tStr = ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
                      return (
                        <div key={order.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 16px", borderBottom: "1px solid rgba(59,31,14,.04)" }}>
                          <div style={{ background: st.bg, borderRadius: 9, padding: "6px 10px", textAlign: "center", flexShrink: 0, minWidth: 50 }}>
                            <div style={{ fontFamily: F.mono, fontSize: ".45rem", color: st.color, letterSpacing: 1 }}>TABLE</div>
                            <div style={{ fontFamily: F.title, fontSize: "1.15rem", fontWeight: 800, color: st.color, lineHeight: 1 }}>{tableNum}</div>
                            <div style={{ fontFamily: F.mono, fontSize: ".48rem", color: st.color, opacity: .7, marginTop: 2 }}>{tStr}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: order.note ? 4 : 0 }}>
                              {(order.items || []).map((it, i) => (
                                <span key={i} style={{ fontSize: ".82rem", color: "#5a3a22" }}>{it.emoji} {it.name} ×{it.qty}</span>
                              ))}
                            </div>
                            {order.note && <div style={{ fontSize: ".72rem", color: "rgba(200,75,25,.7)", fontStyle: "italic" }}>📝 {order.note}</div>}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontFamily: F.title, fontWeight: 800, fontSize: ".92rem", color: "rgba(59,31,14,.45)" }}>₹{order.total}</div>
                            <div style={{ fontFamily: F.mono, fontSize: ".54rem", color: st.color, marginTop: 3, letterSpacing: .5 }}>{st.label.toUpperCase()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Dashboard({ onLogout }) {
  const [view, setView] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [tableFilter, setTblF] = useState(null);
  const [flash, setFlash] = useState(false);
  const [confirmOut, setConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [session, setSession] = useState(null);
  const [sessLoading, setSessL] = useState(false);
  const prevCount = useRef(0);
  const prevPending = useRef(0);

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    async function tick() {
      const today = todayIST();
      if (isCafeTime()) {
        await dbEnsureOpenSession(today);
      } else if (istHour() >= CLOSE_HOUR) {
        const s = await dbGetSession(today);
        if (s?.status === "open") await dbCloseSession(today, "auto");
      }
      setSession(await dbGetSession(today));
    }
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);

  const fetchOrders = useCallback(async () => {
    const data = await dbGetOrders();
    const curPending = data.filter(o => o.status === "pending").length;
    if (data.length > prevCount.current && curPending > prevPending.current) {
      playNewOrder(); setFlash(true); setTimeout(() => setFlash(false), 2000);
    }
    prevCount.current = data.length;
    prevPending.current = curPending;
    setOrders(data);
  }, []);

  useEffect(() => { fetchOrders(); const iv = setInterval(fetchOrders, 3000); return () => clearInterval(iv); }, [fetchOrders]);

  async function updateStatus(id, status) {
    setOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
    await dbUpdateStatus(id, status);
  }

  // Scope all stats to today (IST 00:00 – 23:59)
  const _today = todayIST();
  const _tStart = new Date(_today + "T00:00:00+05:30").getTime();
  const _tEnd = new Date(_today + "T23:59:59+05:30").getTime();
  const todayOrders = orders.filter(o => { const t = new Date(o.created_at || o.time).getTime(); return t >= _tStart && t <= _tEnd; });
  const pending = todayOrders.filter(o => o.status === "pending").length;
  const preparing = todayOrders.filter(o => o.status === "preparing").length;
  const served = todayOrders.filter(o => o.status === "served").length;
  // Revenue only counts orders that are both served AND paid
  const revenue = todayOrders.filter(o => o.status === "served" && o.payment_status === "paid").reduce((s, o) => s + o.total, 0);
  const unpaidCount = todayOrders.filter(o => o.payment_status !== "paid").length;
  const filtered = tableFilter
    ? todayOrders.filter(o => o.table_num === tableFilter)
    : filter === "all" ? todayOrders
    : filter === "paid" ? todayOrders.filter(o => o.payment_status === "paid")
    : filter === "unpaid" ? todayOrders.filter(o => o.payment_status !== "paid")
    : todayOrders.filter(o => o.status === filter);

  // FIX: use created_at (Supabase field) not time
  const minsAgo = t => { const d = new Date(t); return isNaN(d) ? "?" : Math.max(0, Math.floor((now - d) / 60000)); };
  const timeStr = t => { try { return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  const STATUS_CFG = {
    pending: { label: "New Order", color: "#e8622a", bg: "rgba(232,98,42,.1)", border: "rgba(232,98,42,.25)", dot: "#e8622a" },
    preparing: { label: "Preparing", color: "#d97706", bg: "rgba(217,119,6,.08)", border: "rgba(217,119,6,.25)", dot: "#d97706" },
    served: { label: "Served", color: "#16a34a", bg: "rgba(22,163,74,.08)", border: "rgba(22,163,74,.25)", dot: "#16a34a" },
  };

  return (
    <div style={{ minHeight: "100vh", background: flash ? "#fff3e8" : "#fdf8f3", transition: "background .5s", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Logout modal */}
      {confirmOut && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(16px)" }}>
          <div style={{ background: "#fff", border: "1px solid rgba(59,31,14,.1)", borderRadius: 20, padding: "2.2rem", maxWidth: 300, width: "90%", textAlign: "center", animation: "popIn .3s ease" }}>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.2rem", fontWeight: 800, color: "#1a0a04", marginBottom: 8 }}>Lock terminal?</div>
            <p style={{ color: "rgba(59,31,14,.4)", fontSize: ".82rem", lineHeight: 1.8, marginBottom: 24 }}>You'll need the PIN to get back in.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirm(false)} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(59,31,14,.04)", border: "1px solid rgba(59,31,14,.1)", color: "#9a7a5a", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={onLogout} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)", color: "#ef4444", cursor: "pointer", fontWeight: 700 }}>Lock</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background: "rgba(253,248,243,.97)", borderBottom: "1px solid rgba(59,31,14,.08)", padding: ".9rem 1.6rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#fb923c,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", boxShadow: "0 4px 16px rgba(251,146,60,.3)" }}>☕</div>
          <div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1rem", fontWeight: 800, letterSpacing: -.5, color: "#1a0a04", display: "flex", alignItems: "center", gap: 7 }}><img src="/chef-logo.png" style={{ width: 24, height: 24, objectFit: "contain" }} alt="" />The Chef Table <span style={{ color: "rgba(59,31,14,.3)", fontWeight: 700 }}>/ Kitchen</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2.5s infinite", boxShadow: "0 0 6px rgba(34,197,94,.5)" }} />
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".52rem", color: "rgba(59,31,14,.35)", letterSpacing: 2 }}>LIVE · POLLING 3s</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pending > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(232,98,42,.1)", border: "1px solid rgba(232,98,42,.25)", borderRadius: 8, padding: "5px 10px", animation: "glow 2s infinite" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#e8622a", animation: "pulse 1s infinite" }} />
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".62rem", color: "#c4501e", fontWeight: 700, letterSpacing: .5 }}>{pending} NEW</span>
            </div>
          )}
          {unpaidCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, padding: "5px 10px" }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".62rem", color: "#ef4444", fontWeight: 700, letterSpacing: .5 }}>{unpaidCount} UNPAID</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", background: session?.status === "open" ? "rgba(22,163,74,.08)" : "rgba(239,68,68,.08)", padding: 4, borderRadius: 24, border: `1px solid ${session?.status === "open" ? "rgba(22,163,74,.3)" : "rgba(239,68,68,.3)"}`}}>
            <button disabled={sessLoading || session?.status === "open"} onClick={async () => {
              setSessL(true); await dbManualOpenSession(todayIST()); setSession(await dbGetSession(todayIST())); setSessL(false);
            }} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: session?.status === "open" ? "default" : "pointer", background: session?.status === "open" ? "#22c55e" : "transparent", color: session?.status === "open" ? "#fff" : "rgba(239,68,68,.6)", fontFamily: "'Space Mono',monospace", fontSize: ".6rem", fontWeight: 800, letterSpacing: 1, transition: "all .3s" }}>OPEN</button>
            <button disabled={sessLoading || session?.status === "closed" || !session} onClick={async () => {
              setSessL(true); await dbCloseSession(todayIST(), "manual"); setSession(await dbGetSession(todayIST())); setSessL(false);
            }} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: (session?.status === "closed" || !session) ? "default" : "pointer", background: (session?.status === "closed" || !session) ? "#ef4444" : "transparent", color: (session?.status === "closed" || !session) ? "#fff" : "rgba(22,163,74,.6)", fontFamily: "'Space Mono',monospace", fontSize: ".6rem", fontWeight: 800, letterSpacing: 1, transition: "all .3s" }}>CLOSED</button>
          </div>
          <button onClick={() => setConfirm(true)} className="btn-action"
            style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)", color: "rgba(239,68,68,.7)", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: ".6rem", fontWeight: 700, letterSpacing: 1 }}>
            LOCK
          </button>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, padding: "1rem 1.4rem" }}>
        {[
          { icon: "📋", label: "Pending", val: pending, color: "#e8622a", bg: "rgba(232,98,42,.08)", border: "rgba(232,98,42,.2)" },
          { icon: "🔥", label: "Preparing", val: preparing, color: "#d97706", bg: "rgba(217,119,6,.08)", border: "rgba(217,119,6,.2)" },
          { icon: "✅", label: "Served", val: served, color: "#16a34a", bg: "rgba(22,163,74,.08)", border: "rgba(22,163,74,.18)" },
          { icon: "💰", label: "Revenue", val: `₹${revenue}`, color: "#7c3aed", bg: "rgba(124,58,237,.07)", border: "rgba(124,58,237,.18)" },
        ].map(({ icon, label, val, color, bg, border }) => (
          <div key={label} style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 14, padding: "14px 12px", position: "relative", overflow: "hidden", boxShadow: "0 2px 12px rgba(59,31,14,.06)" }}>
            <div style={{ position: "absolute", top: -8, right: -8, fontSize: "2.8rem", opacity: .12 }}>{icon}</div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: label === "Revenue" ? "1.05rem" : "1.7rem", fontWeight: 800, color, lineHeight: 1, marginBottom: 5 }}>{val}</div>
            <div style={{ fontSize: ".72rem", color: "rgba(59,31,14,.4)", fontWeight: 500, letterSpacing: .5 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── VIEW TABS ── */}
      <div style={{ display: "flex", margin: "0 1.4rem .8rem", background: "rgba(59,31,14,.05)", borderRadius: 12, padding: 4, gap: 3 }}>
        {[["orders", "📋 Orders"], ["menu", "🍽️ Menu"], ["history", "📅 History"]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} className="tab-btn"
            style={{
              flex: 1, padding: "9px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 600, fontSize: ".78rem", transition: "all .2s",
              background: view === v ? "#1a0a04" : "transparent",
              color: view === v ? "#fff" : "rgba(59,31,14,.4)"
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── MENU MANAGER ── */}
      {view === "menu" && <MenuManager />}

      {/* ── HISTORY ── */}
      {view === "history" && <HistoryTab />}

      {/* ── TODAY SESSION BANNER (orders view only) ── */}
      {view === "orders" && session && session.status === "closed" && (
        <div style={{ margin: "0 1.4rem .8rem", background: "rgba(232,98,42,.06)", border: "1px solid rgba(232,98,42,.2)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>🔒</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: ".85rem", color: "#c4501e" }}>Café is closed for today</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: ".6rem", color: "rgba(59,31,14,.4)", letterSpacing: .5 }}>Orders will not be accepted by customers</div>
            </div>
          </div>
          <button onClick={async () => {
            setSessL(true);
            await dbManualOpenSession(todayIST());
            setSession(await dbGetSession(todayIST()));
            setSessL(false);
          }} className="btn-action"
            style={{ padding: "6px 13px", borderRadius: 8, border: "1px solid rgba(232,98,42,.3)", background: "rgba(232,98,42,.1)", color: "#c4501e", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: ".58rem", fontWeight: 700, whiteSpace: "nowrap" }}>
            Reopen →
          </button>
        </div>
      )}

      {/* ── ORDERS VIEW ── */}
      {view === "orders" && (
        <>
          {/* Filter bar */}
          <div style={{ padding: "0 1.4rem .9rem", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {["all", "pending", "preparing", "served", "paid", "unpaid"].map(f => (
              <button key={f} onClick={() => { setFilter(f); setTblF(null); }} className="tab-btn"
                style={{ padding: "5px 13px", borderRadius: 8, border: `1px solid ${filter === f && !tableFilter ? (f === "paid" ? "rgba(22,163,74,.4)" : f === "unpaid" ? "rgba(239,68,68,.4)" : "rgba(232,98,42,.4)") : "rgba(59,31,14,.1)"}`, background: filter === f && !tableFilter ? (f === "paid" ? "rgba(22,163,74,.08)" : f === "unpaid" ? "rgba(239,68,68,.08)" : "rgba(232,98,42,.08)") : "transparent", color: filter === f && !tableFilter ? (f === "paid" ? "#16a34a" : f === "unpaid" ? "#ef4444" : "#c4501e") : "rgba(59,31,14,.4)", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: ".6rem", fontWeight: 700, letterSpacing: .5 }}>
                {f.toUpperCase()}{f === "paid" ? ` (${todayOrders.filter(o => o.payment_status === "paid").length})` : f === "unpaid" ? ` (${unpaidCount})` : f !== "all" ? ` (${todayOrders.filter(o => o.status === f).length})` : ""}
              </button>
            ))}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {TABLES.map(t => {
                const active = todayOrders.some(o => o.table_num === t && o.status !== "served");
                return (
                  <button key={t} onClick={() => setTblF(tableFilter === t ? null : t)}
                    style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${tableFilter === t ? "#e8622a" : active ? "rgba(232,98,42,.25)" : "rgba(59,31,14,.1)"}`, background: tableFilter === t ? "rgba(232,98,42,.1)" : active ? "rgba(232,98,42,.05)" : "transparent", color: tableFilter === t ? "#c4501e" : active ? "rgba(232,98,42,.6)" : "rgba(59,31,14,.2)", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: ".6rem", fontWeight: 700, transition: "all .2s" }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orders */}
          <div style={{ padding: "0 1.4rem 4rem", display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "5rem 1rem", color: "rgba(59,31,14,.12)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>◻</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".8rem", letterSpacing: 2, color: "rgba(59,31,14,.2)" }}>No orders yet</div>
              </div>
            ) : filtered.map(order => {
              const st = STATUS_CFG[order.status] || STATUS_CFG.pending;
              // FIX: Supabase stores table_num, timestamps as created_at
              const tableNum = order.table_num ?? order.table ?? "?";
              const ts = order.created_at || order.time;
              const mins = minsAgo(ts);
              const urgent = order.status === "pending" && typeof mins === "number" && mins >= 5;

              return (
                <div key={order.id} className="card-order"
                  style={{ background: urgent ? "rgba(239,68,68,.04)" : "#fff", border: `1px solid ${urgent ? "rgba(239,68,68,.25)" : st.border}`, borderRadius: 16, overflow: "hidden", animation: "popIn .35s ease", transition: "border .3s" }}>

                  {/* Card top bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 10px", borderBottom: "1px solid rgba(59,31,14,.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Table badge */}
                      <div style={{ background: `linear-gradient(135deg,${st.color}22,${st.color}11)`, border: `1px solid ${st.color}44`, borderRadius: 10, padding: "6px 14px", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".48rem", color: st.color, letterSpacing: 2, opacity: .7 }}>TABLE</span>
                        <span style={{ fontFamily: "'Fraunces',serif", fontSize: "1.3rem", fontWeight: 800, color: st.color, lineHeight: 1 }}>{tableNum}</span>
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".68rem", color: "rgba(59,31,14,.3)", letterSpacing: .5 }}>#{String(order.id || "").slice(-8)}</span>
                          {urgent && <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".52rem", color: "#ef4444", background: "rgba(239,68,68,.12)", borderRadius: 5, padding: "2px 7px", animation: "blink 1s infinite", letterSpacing: 1 }}>⚠ URGENT</span>}
                        </div>
                        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: ".6rem", color: "rgba(59,31,14,.3)", letterSpacing: .5 }}>
                          {timeStr(ts)} · {typeof mins === "number" ? `${mins}m ago` : "just now"}
                        </div>
                      </div>
                    </div>
                    {/* Status chip + Payment badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Payment badge */}
                      {order.payment_status === "paid" ? (
                        <div style={{ background: "rgba(22,163,74,.08)", border: "1px solid rgba(22,163,74,.25)", borderRadius: 8, padding: "6px 10px" }}>
                          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".58rem", color: "#16a34a", fontWeight: 700, letterSpacing: .5 }}>PAID ✓</span>
                        </div>
                      ) : (
                        <div style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, padding: "6px 10px" }}>
                          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".58rem", color: "#ef4444", fontWeight: 700, letterSpacing: .5 }}>UNPAID</span>
                        </div>
                      )}
                      {/* Status chip */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: st.bg, border: `1px solid ${st.border}`, borderRadius: 8, padding: "6px 12px" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, animation: order.status !== "served" ? "pulse 1.5s infinite" : "none" }} />
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".6rem", color: st.color, fontWeight: 700, letterSpacing: .5 }}>{st.label.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Items list */}
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(59,31,14,.06)" }}>
                    {(order.items || []).map((item, idx) => (
                      <div key={item.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(59,31,14,.05)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".85rem", color: "#5a3a22", flexWrap: "wrap" }}>
                          <span style={{
                            background: "rgba(232,98,42,.1)", color: "#c4501e", border: "1px solid rgba(232,98,42,.25)",
                            padding: "2px 6px", borderRadius: 6, fontFamily: "'Space Mono',monospace",
                            fontSize: ".6rem", fontWeight: 800, letterSpacing: .5
                          }}>
                            #{(idx + 1)}
                          </span>
                          <span>{item.emoji}</span>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={{ color: "rgba(59,31,14,.4)", fontFamily: "'Space Mono',monospace", fontSize: ".68rem", fontWeight: 700 }}>×{item.qty}</span>
                        </div>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".72rem", color: "rgba(59,31,14,.35)" }}>₹{item.price * item.qty}</span>
                      </div>
                    ))}
                    {order.note && (
                      <div style={{ marginTop: 8, padding: "7px 10px", background: "rgba(232,98,42,.06)", borderRadius: 8, border: "1px solid rgba(232,98,42,.15)", fontSize: ".78rem", color: "rgba(200,75,25,.8)", fontStyle: "italic" }}>📝 {order.note}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "rgba(59,31,14,.02)" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {order.status === "pending" && order.payment_status === "paid" && (
                        <button className="btn-action" onClick={() => updateStatus(order.id, "preparing")}
                          style={{ padding: "7px 18px", borderRadius: 9, border: "1px solid rgba(217,119,6,.3)", background: "rgba(217,119,6,.08)", color: "#b45309", cursor: "pointer", fontWeight: 700, fontSize: ".8rem", letterSpacing: .3 }}>
                          ▶ Start Preparing
                        </button>
                      )}
                      {order.status === "pending" && order.payment_status !== "paid" && (
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".62rem", color: "#ef4444", letterSpacing: 1, display: "flex", alignItems: "center", gap: 5 }}>
                          ⏳ AWAITING PAYMENT
                        </span>
                      )}
                      {order.status === "preparing" && (
                        <button className="btn-action" onClick={() => updateStatus(order.id, "served")}
                          style={{ padding: "7px 18px", borderRadius: 9, border: "1px solid rgba(22,163,74,.3)", background: "rgba(22,163,74,.08)", color: "#16a34a", cursor: "pointer", fontWeight: 700, fontSize: ".8rem", letterSpacing: .3 }}>
                          ✓ Mark Served
                        </button>
                      )}
                      {order.status === "served" && (
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: ".62rem", color: "rgba(22,163,74,.5)", letterSpacing: 1 }}>✓ COMPLETE</span>
                      )}
                    </div>
                    <span style={{ fontFamily: "'Fraunces',serif", fontSize: "1rem", fontWeight: 800, color: order.payment_status === "paid" ? "#16a34a" : "rgba(59,31,14,.4)" }}>₹{order.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [auth, setAuth] = useState(false);
  return auth
    ? <Dashboard onLogout={() => setAuth(false)} />
    : <PinScreen onUnlock={() => setAuth(true)} />;
}
