import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────
//  SUPABASE CONFIG  (REST API — no library needed)
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://kutqywmxkfysulshkzxn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dHF5d214a2Z5c3Vsc2hrenhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjA3NTYsImV4cCI6MjA4ODUzNjc1Nn0.XhZk-467hh3-p0-H0wpLmxtZRVM8HWtaieBo3j-lSfM";
const SB = {
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
};

// ─────────────────────────────────────────────────────────────
//  PAYMENT CONFIG
// ─────────────────────────────────────────────────────────────
// Flip to true when Razorpay API keys are configured in Vercel
const USE_REAL_PAYMENT = import.meta.env.VITE_PAYMENT_ENABLED === "true";
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY || "rzp_test_XXXXXXXXXX";
// API routes are on same Vercel domain (/api/*)
const PAYMENT_API = "";

// ─────────────────────────────────────────────────────────────
//  RAZORPAY SCRIPT LOADER
// ─────────────────────────────────────────────────────────────
let _rzpLoaded = false;
function loadRazorpayScript(retries = 3) {
  return new Promise((resolve, reject) => {
    if (_rzpLoaded || window.Razorpay) { _rzpLoaded = true; return resolve(); }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => { _rzpLoaded = true; resolve(); };
    script.onerror = () => {
      if (retries > 1) {
        setTimeout(() => loadRazorpayScript(retries - 1).then(resolve).catch(reject), 1000);
      } else {
        reject(new Error("Failed to load payment gateway"));
      }
    };
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────
//  DB FUNCTIONS
// ─────────────────────────────────────────────────────────────
async function dbGetMenu() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/menu_items?available=eq.true&select=*&order=sort_order.asc,created_at.asc`,
    { headers: SB }
  );
  const data = await res.json();
  const grouped = {};
  (data || []).forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push({
      id: item.id,
      name: item.name,
      desc: item.description,
      price: item.price,
      emoji: item.emoji,
      time: item.prep_time,
      tag: item.tag || "",
    });
  });
  return grouped;
}

async function dbInsertOrder(order) {
  await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: "POST",
    headers: { ...SB, "Prefer": "return=minimal" },
    body: JSON.stringify({
      id: order.id,
      table_num: order.table,
      items: order.items,
      note: order.note || "",
      total: order.total,
      status: "pending",
      payment_status: "pending",
    }),
  });
}

async function dbUpdatePayment(orderId, paymentId, rzpOrderId) {
  await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
    method: "PATCH",
    headers: { ...SB, "Prefer": "return=minimal" },
    body: JSON.stringify({
      payment_status: "paid",
      payment_id: paymentId,
      razorpay_order_id: rzpOrderId,
      paid_at: new Date().toISOString(),
    }),
  });
}

async function dbGetOrder(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${id}&select=*`,
    { headers: SB }
  );
  const data = await res.json();
  return data?.[0] || null;
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
function nextOpenMsg() { return istHour() < OPEN_HOUR ? "Opens today at 12:00 PM" : "Opens tomorrow at 12:00 PM"; }

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

// ─────────────────────────────────────────────────────────────

const _fl = document.createElement("link"); _fl.rel = "stylesheet";
_fl.href = "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,800;1,400&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(_fl);

const TABLE_TOKENS = {
  "xK9mP2qR": 1,
  "nJ4wL8vY": 2,
  "pQ6bT3mW": 3,
  "yH8fV5kC": 4,
  "rD2gZ9xN": 5,
  "wA1sM7cL": 6,
  "eT4jB6pG": 7,
  "mU9yR3dW": 8,
  "fC5vK1qH": 9,
  "hN7xC8bJ": 10
};

function getTable() {
  try {
    const token = new URLSearchParams(window.location.search).get("t");
    return token && TABLE_TOKENS[token] ? TABLE_TOKENS[token] : null;
  } catch {
    return null;
  }
}
const TABLE_NUM = getTable();

const TAG_C = {
  "Popular": ["rgba(232,98,42,.15)", "#e8622a"],
  "Bestseller": ["rgba(212,168,67,.15)", "#d4a843"],
  "Vegan": ["rgba(34,197,94,.12)", "#22c55e"],
  "Chef's Pick": ["rgba(168,85,247,.15)", "#a855f7"],
  "New": ["rgba(59,130,246,.15)", "#3b82f6"],
  "Local Fav": ["rgba(236,72,153,.15)", "#ec4899"],
  "Fresh": ["rgba(20,184,166,.15)", "#14b8a6"],
  "Healthy": ["rgba(34,197,94,.12)", "#22c55e"],
  "Value": ["rgba(212,168,67,.15)", "#d4a843"],
  "Signature": ["rgba(232,98,42,.15)", "#e8622a"],
  "Special": ["rgba(168,85,247,.15)", "#a855f7"],
  "Offer": ["rgba(59,130,246,.15)", "#3b82f6"],
};

const CAT_EMOJI = { "Garlic Breads": "🥖", Sandwiches: "🥪", Wraps: "🌯", Salads: "🥗", Pastas: "🍝", Pizzas: "🍕", Appetizers: "🍟", "Iced Teas": "🍹", "Herbal Teas": "🫖", Chocolate: "🍫", Mocktails: "🍸", Coffees: "☕", "Coffee Fusions": "🌟", "Cold Brews": "🧊", "Cold Coffees": "🥤", Shakes: "🧋" };

const ST_INFO = {
  pending: { label: "Order Received", sub: "Kitchen has your order", color: "#f97316", bg: "rgba(249,115,22,.1)", icon: "📋", step: 0 },
  preparing: { label: "Being Prepared", sub: "Your items are being made", color: "#eab308", bg: "rgba(234,179,8,.1)", icon: "👨‍🍳", step: 1 },
  served: { label: "On Its Way!", sub: "Your order is being served", color: "#22c55e", bg: "rgba(34,197,94,.1)", icon: "🚀", step: 2 },
};

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#fdf8f3;font-family:'DM Sans',sans-serif}
  @keyframes fadeUp {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes pop    {0%{transform:scale(1)}45%{transform:scale(1.28)}100%{transform:scale(1)}}
  @keyframes pulse  {0%,100%{opacity:1}50%{opacity:.25}}
  @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  @keyframes bounce {0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  @keyframes spin   {to{transform:rotate(360deg)}}
  .mc{transition:all .3s}.mc:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(59,31,14,.1)!important}
  .ab:active{transform:scale(.84)!important}
  .tb:hover{opacity:.82}
`;


function ClosedScreen({ msg }) {
  const F = { title: "'Fraunces',serif", body: "'DM Sans',sans-serif" };
  return (
    <div style={{ minHeight: "100vh", background: "#fdf8f3", fontFamily: F.body, display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>
      <div style={{ background: "rgba(253,248,243,.97)", borderBottom: "1px solid rgba(59,31,14,.08)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: F.title, fontSize: "1.4rem", fontWeight: 800, color: "#1a0a04", display: "flex", alignItems: "center", gap: 8 }}><img src="/chef-logo.png" style={{ width: 28, height: 28, objectFit: "contain" }} alt="" />The Chef Table</div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: ".6rem", color: "rgba(59,31,14,.3)", letterSpacing: 2 }}>12:00 PM – 11:00 PM</div>
      </div>
      <div style={{ background: "linear-gradient(135deg,#3b1f0e,#e8622a)", padding: "2.5rem 1.5rem 3rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.05)" }}></div>
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: 16, animation: "bounce 2s ease infinite" }}>☕</div>
          <div style={{ fontFamily: F.title, fontSize: "2.1rem", fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: 8, fontStyle: "italic" }}>We're Closed</div>
          <div style={{ fontSize: ".9rem", color: "rgba(255,255,255,.7)", lineHeight: 1.5 }}>{msg || "Opens tomorrow at 12:00 PM"}</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 1.5rem", gap: 14 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "1.8rem", width: "100%", maxWidth: 360, border: "1px solid rgba(59,31,14,.07)", boxShadow: "0 8px 32px rgba(59,31,14,.08)", animation: "fadeUp .5s ease" }}>
          <div style={{ fontSize: ".7rem", color: "#c0a090", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, fontFamily: "'Space Mono',monospace" }}>Café Hours</div>
          {[["🌞", "Opens", "12:00 PM"], ["🕙", "Last Order", "10:45 PM"], ["🔒", "Closes", "11:00 PM"]].map(([icon, label, time]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(59,31,14,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.1rem" }}>{icon}</span>
                <span style={{ fontSize: ".85rem", color: "#5a3a22" }}>{label}</span>
              </div>
              <span style={{ fontFamily: F.title, fontWeight: 700, color: "#1a0a04", fontSize: ".92rem" }}>{time}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(232,98,42,.07)", border: "1px solid rgba(232,98,42,.15)", borderRadius: 14, padding: "1.2rem 1.5rem", width: "100%", maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>🕐</div>
          <div style={{ fontFamily: F.title, fontSize: "1rem", fontWeight: 700, color: "#c4501e", marginBottom: 3 }}>{msg || "Opens tomorrow at 12:00 PM"}</div>
          <div style={{ fontSize: ".78rem", color: "#9a7a5a" }}>See you then! ☕</div>
        </div>
      </div>
    </div>
  );
}

function InvalidTableScreen() {
  const F = { title: "'Fraunces',serif", body: "'DM Sans',sans-serif" };
  return (
    <div style={{ minHeight: "100vh", background: "#fdf8f3", fontFamily: F.body, display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>
      <div style={{ background: "rgba(253,248,243,.97)", borderBottom: "1px solid rgba(59,31,14,.08)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: F.title, fontSize: "1.4rem", fontWeight: 800, color: "#1a0a04", display: "flex", alignItems: "center", gap: 8 }}><img src="/chef-logo.png" style={{ width: 28, height: 28, objectFit: "contain" }} alt="" />The Chef Table</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: 16 }}>🚫</div>
        <div style={{ fontFamily: F.title, fontSize: "2rem", fontWeight: 800, color: "#1a0a04", marginBottom: 12 }}>Invalid Table Link</div>
        <div style={{ fontSize: "1rem", color: "#9a7a5a", lineHeight: 1.6, maxWidth: 320 }}>
          Please scan the QR code placed on your table to access the order menu.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MOCK PAYMENT SHEET (Razorpay-style demo)
// ═══════════════════════════════════════════════════════════════
function MockPaymentSheet({ amount, onSuccess, onClose }) {
  const [payTab, setPayTab] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [cardNum, setCardNum] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [payState, setPayState] = useState("form"); // form | processing | success | failed
  const [failMsg, setFailMsg] = useState("");
  const txnId = useRef("pay_demo_" + Math.random().toString(36).slice(2, 14));

  const RZP = "#072654";
  const ACCENT = "#e8622a";

  function processPay() {
    // Simulate failure for fail@upi
    if (payTab === "upi" && upiId.toLowerCase().trim() === "fail@upi") {
      setPayState("processing");
      setTimeout(() => {
        setFailMsg("Payment declined by bank. Please try another method.");
        setPayState("failed");
      }, 2200);
      return;
    }
    setPayState("processing");
    setTimeout(() => setPayState("success"), 2200);
  }

  const canPay = payTab === "upi" ? upiId.includes("@")
    : payTab === "card" ? cardNum.replace(/\s/g, "").length === 16 && cardExpiry.length >= 4 && cardCvv.length >= 3 && cardName.length > 1
    : payTab === "bank" ? selectedBank !== null
    : selectedWallet !== null;

  const UPI_APPS = [
    { name: "GPay", icon: "🟢", color: "#34A853" },
    { name: "PhonePe", icon: "🟣", color: "#5f259f" },
    { name: "Paytm", icon: "🔵", color: "#00BAF2" },
    { name: "BHIM", icon: "🟠", color: "#ef6c00" },
  ];
  const BANKS = [
    { name: "SBI", color: "#1a237e" }, { name: "HDFC", color: "#004c8c" },
    { name: "ICICI", color: "#f57c00" }, { name: "Axis", color: "#800020" },
    { name: "Kotak", color: "#ed1c24" }, { name: "Yes Bank", color: "#0050a0" },
  ];
  const WALLETS = [
    { name: "PhonePe", icon: "🟣" }, { name: "Google Pay", icon: "🟢" },
    { name: "Paytm", icon: "🔵" }, { name: "Amazon Pay", icon: "🟡" },
    { name: "BHIM", icon: "🟠" }, { name: "FreeCharge", icon: "🟤" },
  ];

  const inp = { width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", fontSize: ".88rem", outline: "none", fontFamily: "'DM Sans',sans-serif" };

  // Processing screen
  if (payState === "processing") return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: RZP, borderRadius: 20, padding: "3rem 2.5rem", textAlign: "center", maxWidth: 320, width: "90%", animation: "fadeUp .4s ease" }}>
        <div style={{ width: 56, height: 56, border: "4px solid rgba(255,255,255,.15)", borderTop: `4px solid ${ACCENT}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 24px" }}></div>
        <div style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>Processing Payment</div>
        <div style={{ color: "rgba(255,255,255,.5)", fontSize: ".82rem" }}>₹{amount} · Do not close this screen</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
          {["🔒 256-bit SSL", "🛡️ PCI DSS", "🏦 RBI Approved"].map(b => (
            <span key={b} style={{ fontSize: ".6rem", color: "rgba(255,255,255,.3)", letterSpacing: .5 }}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  );

  // Success screen
  if (payState === "success") return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: RZP, borderRadius: 20, padding: "3rem 2.5rem", textAlign: "center", maxWidth: 320, width: "90%", animation: "fadeUp .4s ease" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,.15)", border: "3px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 20px" }}>✓</div>
        <div style={{ color: "#22c55e", fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Payment Successful!</div>
        <div style={{ color: "rgba(255,255,255,.7)", fontSize: ".88rem", marginBottom: 20 }}>₹{amount} paid</div>
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "12px", marginBottom: 20 }}>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".7rem", marginBottom: 4 }}>Transaction ID</div>
          <div style={{ color: "#e2e8f0", fontSize: ".82rem", fontFamily: "'Space Mono',monospace", letterSpacing: 1 }}>{txnId.current}</div>
        </div>
        <button onClick={() => onSuccess(txnId.current)}
          style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#22c55e", color: "#fff", fontSize: ".95rem", fontWeight: 700, cursor: "pointer" }}>
          Done ✓
        </button>
      </div>
    </div>
  );

  // Failed screen
  if (payState === "failed") return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: RZP, borderRadius: 20, padding: "3rem 2.5rem", textAlign: "center", maxWidth: 320, width: "90%", animation: "fadeUp .4s ease" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,.15)", border: "3px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 20px" }}>✕</div>
        <div style={{ color: "#ef4444", fontSize: "1.2rem", fontWeight: 800, marginBottom: 8 }}>Payment Failed</div>
        <div style={{ color: "rgba(255,255,255,.6)", fontSize: ".85rem", marginBottom: 24, lineHeight: 1.6 }}>{failMsg}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "transparent", color: "rgba(255,255,255,.6)", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
          <button onClick={() => { setPayState("form"); setFailMsg(""); }} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Try Again</button>
        </div>
      </div>
    </div>
  );

  // Main payment form
  const TABS = [["upi", "UPI"], ["card", "Card"], ["bank", "Net Banking"], ["wallet", "Wallets"]];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "92vh", overflow: "auto", borderRadius: "20px 20px 0 0", background: RZP, animation: "slideUp .35s cubic-bezier(.32,0,.67,0)", boxShadow: "0 -20px 60px rgba(0,0,0,.5)" }}>

        {/* Demo banner */}
        <div style={{ background: "#fbbf24", padding: "6px", textAlign: "center", fontSize: ".7rem", fontWeight: 700, color: "#1a0a04", letterSpacing: 1, borderRadius: "20px 20px 0 0" }}>
          ⚡ DEMO MODE — No real money charged
        </div>

        {/* Header */}
        <div style={{ padding: "1.2rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <div>
            <div style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 800 }}>The Chef Table</div>
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".78rem" }}>Table {TABLE_NUM} · Order Payment</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.4rem", fontWeight: 800, color: ACCENT }}>₹{amount}</div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setPayTab(id)}
              style={{ flex: 1, padding: "12px 8px", border: "none", background: "transparent", color: payTab === id ? ACCENT : "rgba(255,255,255,.4)", fontWeight: 700, fontSize: ".78rem", cursor: "pointer", borderBottom: payTab === id ? `2px solid ${ACCENT}` : "2px solid transparent", transition: "all .2s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Form area */}
        <div style={{ padding: "1.4rem 1.5rem 2rem" }}>

          {/* UPI */}
          {payTab === "upi" && (
            <div style={{ animation: "fadeUp .3s ease" }}>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".72rem", letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>Enter UPI ID</div>
              <input style={inp} placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
              <div style={{ color: "rgba(255,255,255,.25)", fontSize: ".7rem", marginTop: 6, marginBottom: 20 }}>Type fail@upi to simulate decline</div>

              <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".72rem", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Or pay using</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {UPI_APPS.map(app => (
                  <button key={app.name} onClick={() => { setUpiId(`demo@${app.name.toLowerCase()}`); }}
                    style={{ padding: "14px 8px", borderRadius: 12, border: upiId.includes(app.name.toLowerCase()) ? `2px solid ${app.color}` : "1px solid rgba(255,255,255,.1)", background: upiId.includes(app.name.toLowerCase()) ? `${app.color}15` : "rgba(255,255,255,.04)", cursor: "pointer", textAlign: "center", transition: "all .2s" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>{app.icon}</div>
                    <div style={{ color: "#e2e8f0", fontSize: ".72rem", fontWeight: 600 }}>{app.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Card */}
          {payTab === "card" && (
            <div style={{ animation: "fadeUp .3s ease", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".72rem", marginBottom: 6 }}>Card Number</div>
                <input style={inp} placeholder="4111 1111 1111 1111" maxLength={19}
                  value={cardNum} onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                    setCardNum(v.replace(/(.{4})/g, "$1 ").trim());
                  }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".72rem", marginBottom: 6 }}>Expiry</div>
                  <input style={inp} placeholder="MM/YY" maxLength={5}
                    value={cardExpiry} onChange={e => {
                      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                      setCardExpiry(v);
                    }} />
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".72rem", marginBottom: 6 }}>CVV</div>
                  <input style={inp} placeholder="•••" maxLength={4} type="password"
                    value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </div>
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".72rem", marginBottom: 6 }}>Cardholder Name</div>
                <input style={inp} placeholder="Name on card" value={cardName} onChange={e => setCardName(e.target.value)} />
              </div>
            </div>
          )}

          {/* Net Banking */}
          {payTab === "bank" && (
            <div style={{ animation: "fadeUp .3s ease" }}>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".72rem", letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>Select your bank</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {BANKS.map(bank => (
                  <button key={bank.name} onClick={() => setSelectedBank(bank.name)}
                    style={{ padding: "16px 10px", borderRadius: 12, border: selectedBank === bank.name ? `2px solid ${bank.color}` : "1px solid rgba(255,255,255,.1)", background: selectedBank === bank.name ? `${bank.color}20` : "rgba(255,255,255,.04)", cursor: "pointer", transition: "all .2s" }}>
                    <div style={{ color: "#e2e8f0", fontSize: ".82rem", fontWeight: 700 }}>{bank.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Wallets */}
          {payTab === "wallet" && (
            <div style={{ animation: "fadeUp .3s ease" }}>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".72rem", letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>Select wallet</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {WALLETS.map(w => (
                  <button key={w.name} onClick={() => setSelectedWallet(w.name)}
                    style={{ padding: "14px 8px", borderRadius: 12, border: selectedWallet === w.name ? `2px solid ${ACCENT}` : "1px solid rgba(255,255,255,.1)", background: selectedWallet === w.name ? `${ACCENT}20` : "rgba(255,255,255,.04)", cursor: "pointer", textAlign: "center", transition: "all .2s" }}>
                    <div style={{ fontSize: "1.3rem", marginBottom: 4 }}>{w.icon}</div>
                    <div style={{ color: "#e2e8f0", fontSize: ".7rem", fontWeight: 600 }}>{w.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pay button */}
          <button onClick={processPay} disabled={!canPay}
            style={{ width: "100%", marginTop: 24, padding: "16px", borderRadius: 12, border: "none", background: canPay ? ACCENT : "rgba(255,255,255,.08)", color: canPay ? "#fff" : "rgba(255,255,255,.25)", fontSize: "1rem", fontWeight: 700, cursor: canPay ? "pointer" : "not-allowed", transition: "all .3s", boxShadow: canPay ? "0 8px 24px rgba(232,98,42,.4)" : "none" }}>
            {canPay ? `Pay ₹${amount}` : "Select a payment method"}
          </button>

          {/* Security badges */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 20 }}>
            {["🔒 256-bit SSL", "🛡️ PCI DSS", "🏦 RBI Approved"].map(b => (
              <span key={b} style={{ fontSize: ".62rem", color: "rgba(255,255,255,.25)", letterSpacing: .5 }}>{b}</span>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <span style={{ fontSize: ".6rem", color: "rgba(255,255,255,.15)", letterSpacing: 1 }}>Powered by Razorpay</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerApp() {
  const [menu, setMenu] = useState({});
  const [menuLoading, setMenuLoad] = useState(true);
  const [sessionStatus, setSess] = useState("checking");
  const [closedMsg, setClosedMsg] = useState("");
  const [tab, setTab] = useState(null);
  const [cart, setCart] = useState([]);
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState("menu");
  const [cartOpen, setCartOpen] = useState(false);
  const [addedId, setAddedId] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [showMockPay, setShowMockPay] = useState(false);
  const pendingOid = useRef(null);
  const pollRef = useRef(null);
  const F = { title: "'Fraunces',serif", body: "'DM Sans',sans-serif" };

  useEffect(() => {
    async function checkSession() {
      try {
        const today = todayIST();
        if (isCafeTime()) {
          // Best-effort: ensure session exists. If sessions table not set up yet,
          // default to open so the menu still works.
          try { await dbEnsureOpenSession(today); } catch (_) { }
          let s = null;
          try { s = await dbGetSession(today); } catch (_) { }
          if (s === null) { setSess("open"); return; } // table missing → stay open
          if (s.status === "open") { setSess("open"); }
          else { setSess("closed"); setClosedMsg(nextOpenMsg()); }
        } else {
          // Outside hours — check if waiter manually opened it anyway
          let s = null;
          try { s = await dbGetSession(todayIST()); } catch (_) { }
          if (s?.status === "open") { setSess("open"); } // waiter forced open
          else { setSess("closed"); setClosedMsg(nextOpenMsg()); }
        }
      } catch (_) {
        setSess("open"); // any unexpected error → default open, don't block customers
      }
    }
    checkSession();
    const iv = setInterval(checkSession, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    async function loadMenu() {
      setMenuLoad(true);
      try {
        const data = await dbGetMenu();
        setMenu(data);
        setTab(t => t && data[t] ? t : Object.keys(data)[0] || null);
      } catch (e) { console.error(e); }
      setMenuLoad(false);
    }
    loadMenu();
    const iv = setInterval(loadMenu, 60000);
    return () => clearInterval(iv);
  }, []);

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const add = (item) => {
    setCart(c => { const e = c.find(x => x.id === item.id); return e ? c.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x) : [...c, { ...item, qty: 1, pref: "Any" }]; });
    setAddedId(item.id); setTimeout(() => setAddedId(null), 700);
  };
  const dec = (id) => setCart(c => c.map(x => x.id === id ? { ...x, qty: x.qty - 1 } : x).filter(x => x.qty > 0));
  const rem = (id) => setCart(c => c.filter(x => x.id !== id));
  // Shift item up/down in the cart array
  const move = (index, dir) => {
    setCart(c => {
      if (index + dir < 0 || index + dir >= c.length) return c;
      const next = [...c];
      const temp = next[index];
      next[index] = next[index + dir];
      next[index + dir] = temp;
      return next;
    });
  };

  const [paymentError, setPayError] = useState("");

  function startPolling(oid) {
    pollRef.current = setInterval(async () => {
      const o = await dbGetOrder(oid);
      if (o) setStatus(o.status);
    }, 3000);
  }

  async function placeOrder() {
    setLoading(true);
    setPayError("");
    const oid = `ORD-${Date.now()}`;

    // Step 1: Insert order to Supabase (payment_status: pending)
    await dbInsertOrder({ id: oid, table: TABLE_NUM, items: cart, note, total });

    // Step 2: If real payment disabled, show mock payment sheet (demo mode)
    if (!USE_REAL_PAYMENT) {
      pendingOid.current = oid;
      setLoading(false);
      setCartOpen(false);
      setShowMockPay(true);
      return;
    }

    // Step 3: Create Razorpay order via backend
    let rzpOrder;
    try {
      const res = await fetch(`${PAYMENT_API}/api/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total * 100, orderId: oid }), // Razorpay uses paise
      });
      if (!res.ok) throw new Error("Server error");
      rzpOrder = await res.json();
    } catch (err) {
      setPayError("Payment gateway unavailable. Please try again.");
      setLoading(false);
      return;
    }

    // Step 4: Load Razorpay checkout script
    try {
      await loadRazorpayScript();
    } catch (err) {
      setPayError("Unable to load payment gateway. Check your internet.");
      setLoading(false);
      return;
    }

    // Step 5: Open Razorpay checkout
    setLoading(false);
    const razorpay = new window.Razorpay({
      key: RAZORPAY_KEY,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      name: "The Chef Table",
      description: `Table ${TABLE_NUM} Order`,
      order_id: rzpOrder.id,
      handler: async (response) => {
        // Step 6: Verify signature on server
        try {
          const vRes = await fetch(`${PAYMENT_API}/api/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const { verified } = await vRes.json();
          if (!verified) {
            setPayError("Payment verification failed. Contact staff.");
            return;
          }
        } catch (_) {
          setPayError("Could not verify payment. Contact staff.");
          return;
        }

        // Step 7: Mark paid in Supabase
        await dbUpdatePayment(oid, response.razorpay_payment_id, response.razorpay_order_id);
        setOrderId(oid);
        setPhase("success");
        setCartOpen(false);
        startPolling(oid);
      },
      prefill: { contact: "" },
      theme: { color: "#e8622a" },
      modal: {
        ondismiss: () => {
          setPayError("Payment cancelled. Tap below to retry.");
        },
      },
    });
    razorpay.on("payment.failed", (resp) => {
      const desc = resp?.error?.description || "Payment failed";
      setPayError(`${desc}. Please try again.`);
    });
    razorpay.open();
  }

  // Retry payment for a pending order
  async function retryPayment() {
    setPayError("");
    setLoading(true);
    await placeOrder();
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Mock payment callbacks
  async function handleMockPaySuccess(txnId) {
    const oid = pendingOid.current;
    if (oid) {
      try { await dbUpdatePayment(oid, txnId, "demo"); } catch (_) {}
      setOrderId(oid);
      setPhase("success");
      startPolling(oid);
    }
    setShowMockPay(false);
    pendingOid.current = null;
  }
  function handleMockPayClose() {
    setShowMockPay(false);
    pendingOid.current = null;
  }

  // ── LOADING / CHECKING ──────────────────────────────────
  if (TABLE_NUM === null) return <InvalidTableScreen />;

  if (sessionStatus === 'checking' && menuLoading) return (
    <div style={{ minHeight: "100vh", background: "#fdf8f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F.body }}>
      <style>{CSS}</style>
      <div style={{ fontSize: "3rem", marginBottom: 16, animation: "bounce 1.2s ease infinite" }}>☕</div>
      <div style={{ fontFamily: F.title, fontSize: "1.4rem", fontWeight: 800, color: "#1a0a04", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><img src="/chef-logo.png" style={{ width: 28, height: 28, objectFit: "contain" }} alt="" />The Chef Table</div>
      <div style={{ fontSize: ".8rem", color: "#c0a090", marginBottom: 20 }}>Loading today's menu…</div>
      <div style={{ width: 28, height: 28, border: "3px solid rgba(232,98,42,.2)", borderTop: "3px solid #e8622a", borderRadius: "50%", animation: "spin .8s linear infinite" }}></div>
    </div>
  );

  if (sessionStatus === 'closed') return <ClosedScreen msg={closedMsg} />;

  // ── EMPTY MENU ──────────────────────────────────────────
  if (Object.keys(menu).length === 0) return (
    <div style={{ minHeight: "100vh", background: "#fdf8f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F.body, padding: "2rem", textAlign: "center" }}>
      <style>{CSS}</style>
      <div style={{ fontSize: "3rem", marginBottom: 16 }}>🛑</div>
      <div style={{ fontFamily: F.title, fontSize: "1.4rem", fontWeight: 800, color: "#1a0a04", marginBottom: 8 }}>Menu Unavailable</div>
      <div style={{ fontSize: ".85rem", color: "#9a7a5a", lineHeight: 1.6 }}>Our menu is being updated.<br />Please check back in a moment.</div>
    </div>
  );

  const cats = Object.keys(menu);
  const activeTab = tab && menu[tab] ? tab : cats[0];

  // ── SUCCESS SCREEN ───────────────────────────────────────
  if (phase === "success") {
    const st = ST_INFO[status];
    return (
      <div style={{ minHeight: "100vh", background: "#fdf8f3", fontFamily: F.body }}>
        <style>{CSS}</style>
        <div style={{ background: "rgba(253,248,243,.97)", borderBottom: "1px solid rgba(59,31,14,.08)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ fontFamily: F.title, fontSize: "1.4rem", fontWeight: 800, color: "#1a0a04", display: "flex", alignItems: "center", gap: 8 }}><img src="/chef-logo.png" style={{ width: 28, height: 28, objectFit: "contain" }} alt="" />The Chef Table</div>
          <div style={{ background: "rgba(232,98,42,.1)", border: "1px solid rgba(232,98,42,.2)", color: "#c4501e", borderRadius: 20, padding: "4px 14px", fontSize: ".78rem", fontWeight: 600 }}>Table {TABLE_NUM}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2.5rem 1.5rem", textAlign: "center" }}>
          <div style={{ background: "#fff", borderRadius: 24, padding: "2.5rem 2rem", width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(59,31,14,.1)", animation: "fadeUp .5s ease", border: "1px solid rgba(59,31,14,.06)", marginBottom: 16 }}>
            <div style={{ fontSize: "4rem", animation: "bounce 1.5s ease infinite", marginBottom: 16 }}>{st.icon}</div>
            <div style={{ fontFamily: F.title, fontSize: "1.9rem", fontWeight: 800, color: "#1a0a04", lineHeight: 1.1, marginBottom: 6 }}>{st.label}</div>
            <div style={{ fontSize: ".9rem", color: "#9a7a5a", marginBottom: 24, lineHeight: 1.6 }}>{st.sub}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
              {["pending", "preparing", "served"].map((s, i) => {
                const done = i <= st.step, cur = i === st.step;
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: done ? st.color : "rgba(0,0,0,.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".8rem", fontWeight: 700, color: done ? "#fff" : "#c0a090", transition: "all .5s", transform: cur ? "scale(1.15)" : "scale(1)", boxShadow: cur ? `0 0 0 5px ${st.bg}` : "none" }}>{done ? "✓" : i + 1}</div>
                    {i < 2 && <div style={{ width: 40, height: 2, background: i < st.step ? st.color : "rgba(0,0,0,.06)", transition: "background .5s" }}></div>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 50, background: st.bg, border: `1.5px solid ${st.color}30`, fontWeight: 700, color: st.color, fontSize: ".88rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: st.color, animation: status !== "served" ? "pulse 1.5s infinite" : "none" }}></div>
              {st.label}
            </div>
            {status === "served" && (
              <div style={{ marginTop: 18, padding: "14px", background: "rgba(34,197,94,.08)", borderRadius: 12, border: "1px solid rgba(34,197,94,.2)" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>😊</div>
                <div style={{ color: "#15803d", fontWeight: 600, fontSize: ".9rem" }}>Your order has arrived! Enjoy!</div>
              </div>
            )}
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: "1.2rem 1.5rem", width: "100%", maxWidth: 360, border: "1px solid rgba(59,31,14,.06)", marginBottom: 16 }}>
            <div style={{ fontSize: ".7rem", color: "#c0a090", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Order Summary</div>
            {cart.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: ".85rem", padding: "5px 0", borderBottom: "1px solid rgba(59,31,14,.05)" }}>
                <span style={{ color: "#5a3a22" }}>{item.emoji} {item.name} ×{item.qty}</span>
                <span style={{ fontWeight: 600, color: "#1a0a04" }}>₹{item.price * item.qty}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 700 }}>
              <span style={{ color: "#5a3a22" }}>Total</span>
              <span style={{ color: "#e8622a" }}>₹{total}</span>
            </div>
          </div>
          <div style={{ fontSize: ".72rem", color: "#c0a090", marginBottom: 16 }}>ID: <span style={{ fontWeight: 600, letterSpacing: 1 }}>{orderId}</span></div>
          <button onClick={() => { setCart([]); setNote(""); setPhase("menu"); setOrderId(null); setStatus("pending"); clearInterval(pollRef.current); }}
            style={{ padding: "12px 32px", borderRadius: 50, background: "transparent", border: "1.5px solid rgba(232,98,42,.3)", color: "#e8622a", cursor: "pointer", fontWeight: 600, fontSize: ".85rem", fontFamily: F.body }}>
            + Place Another Order
          </button>
        </div>
      </div>
    );
  }

  // ── MENU SCREEN ──────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#fdf8f3", fontFamily: F.body, paddingBottom: 110 }}>
      <style>{CSS}</style>
      <div style={{ background: "rgba(253,248,243,.97)", borderBottom: "1px solid rgba(59,31,14,.07)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        <div>
          <div style={{ fontFamily: F.title, fontSize: "1.4rem", fontWeight: 800, color: "#1a0a04", letterSpacing: "-.5px", display: "flex", alignItems: "center", gap: 8 }}><img src="/chef-logo.png" style={{ width: 28, height: 28, objectFit: "contain" }} alt="" />The Chef Table</div>
          <div style={{ fontSize: ".65rem", color: "#c0a090", letterSpacing: 3, fontFamily: "'Space Mono',monospace", textTransform: "uppercase" }}>House of Flavours</div>
        </div>
        <div style={{ background: "rgba(232,98,42,.1)", border: "1px solid rgba(232,98,42,.2)", color: "#c4501e", borderRadius: 20, padding: "5px 14px", fontSize: ".78rem", fontWeight: 700 }}>📍 Table {TABLE_NUM}</div>
      </div>
      <div style={{ background: "linear-gradient(135deg,#3b1f0e,#e8622a)", padding: "2rem 1.5rem", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.05)" }}></div>
        <div style={{ fontFamily: F.title, fontSize: "1.9rem", fontWeight: 800, color: "#fff", fontStyle: "italic", lineHeight: 1.1, marginBottom: 6, position: "relative" }}>What would you<br />like today? ☕</div>
        <div style={{ fontSize: ".82rem", color: "rgba(255,255,255,.65)", position: "relative" }}>Fresh · Made to order · Served at your table</div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "1rem 1.5rem", overflowX: "auto", background: "#fdf8f3", borderBottom: "1px solid rgba(59,31,14,.06)", position: "sticky", top: "62px", zIndex: 40 }}>
        {cats.map(t => (
          <button key={t} className="tb" onClick={() => setTab(t)}
            style={{
              padding: "8px 20px", borderRadius: 50, border: "none", cursor: "pointer", fontFamily: F.body, fontSize: ".82rem", fontWeight: 600, whiteSpace: "nowrap", transition: "all .25s", flexShrink: 0,
              background: activeTab === t ? "#1a0a04" : "rgba(59,31,14,.06)", color: activeTab === t ? "#fff" : "#9a7a5a", boxShadow: activeTab === t ? "0 4px 12px rgba(26,10,4,.2)" : "none"
            }}>
            {CAT_EMOJI[t] || "🍽️"} {t}
          </button>
        ))}
      </div>
      <div style={{ padding: "1rem 1.2rem", display: "flex", flexDirection: "column", gap: 10 }}>
        {(menu[activeTab] || []).map(item => {
          const inCart = cart.find(x => x.id === item.id);
          const justAdded = addedId === item.id;
          const tag = TAG_C[item.tag];
          return (
            <div key={item.id} className="mc"
              style={{ background: "#fff", borderRadius: 16, padding: "1rem 1.2rem", border: `1.5px solid ${inCart ? "rgba(232,98,42,.3)" : "rgba(59,31,14,.07)"}`, display: "flex", alignItems: "center", gap: 14, boxShadow: inCart ? "0 4px 16px rgba(232,98,42,.1)" : "0 2px 8px rgba(59,31,14,.04)" }}>
              <div style={{ width: 58, height: 58, borderRadius: 14, background: "rgba(59,31,14,.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.9rem", flexShrink: 0, transition: "transform .3s", transform: justAdded ? "scale(1.2)" : "scale(1)" }}>{item.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: F.title, fontSize: ".98rem", fontWeight: 600, color: "#1a0a04", lineHeight: 1.2 }}>{item.name}</div>
                  {item.tag && tag && <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: ".6rem", fontWeight: 700, letterSpacing: .5, background: tag[0], color: tag[1], flexShrink: 0 }}>{item.tag}</span>}
                </div>
                <div style={{ fontSize: ".78rem", color: "#c0a090", marginBottom: 6, lineHeight: 1.4 }}>{item.desc}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: F.title, fontSize: "1.05rem", fontWeight: 800, color: "#1a0a04" }}>₹{item.price}</span>
                    <span style={{ fontSize: ".7rem", color: "#c0a090" }}>· ⏱ {item.time}m</span>
                  </div>
                  {inCart ? (
                    <div style={{ display: "flex", alignItems: "center", background: "#1a0a04", borderRadius: 50, overflow: "hidden" }}>
                      <button onClick={() => dec(item.id)} style={{ width: 32, height: 32, border: "none", background: "transparent", color: "#f5ede0", cursor: "pointer", fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700, color: "#e8622a", fontSize: ".9rem" }}>{inCart.qty}</span>
                      <button onClick={() => add(item)} className="ab" style={{ width: 32, height: 32, border: "none", background: "#e8622a", color: "#fff", cursor: "pointer", fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .15s" }}>+</button>
                    </div>
                  ) : (
                    <button onClick={() => add(item)} className="ab"
                      style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#1a0a04", color: "#fff", cursor: "pointer", fontSize: "1.3rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .15s", animation: justAdded ? "pop .4s ease" : "none", boxShadow: "0 4px 10px rgba(26,10,4,.2)" }}>+</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {count > 0 && !cartOpen && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 100, width: "calc(100% - 2.4rem)", maxWidth: 420 }}>
          <button onClick={() => setCartOpen(true)}
            style={{ width: "100%", background: "#1a0a04", border: "none", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", color: "#fff", boxShadow: "0 8px 32px rgba(26,10,4,.4)", animation: "fadeUp .4s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "#e8622a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: ".88rem" }}>{count}</div>
              <span style={{ fontWeight: 600, fontSize: ".95rem" }}>View Your Order</span>
            </div>
            <span style={{ fontFamily: F.title, fontWeight: 800, fontSize: "1.05rem", color: "#e8622a" }}>₹{total}</span>
          </button>
        </div>
      )}
      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <div onClick={() => setCartOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(26,10,4,.55)", backdropFilter: "blur(4px)" }}></div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fdf8f3", borderRadius: "24px 24px 0 0", animation: "slideUp .35s cubic-bezier(.32,0,.67,0)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 -20px 60px rgba(26,10,4,.25)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 0" }}><div style={{ width: 40, height: 4, borderRadius: 4, background: "rgba(59,31,14,.12)" }}></div></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem 0" }}>
              <div style={{ fontFamily: F.title, fontSize: "1.4rem", fontWeight: 800, color: "#1a0a04" }}>Your Order</div>
              <button onClick={() => setCartOpen(false)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(59,31,14,.07)", border: "none", cursor: "pointer", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#5a3a22" }}>✕</button>
            </div>
            <div style={{ padding: "4px 1.5rem 14px" }}><span style={{ background: "rgba(232,98,42,.1)", color: "#c4501e", borderRadius: 20, padding: "3px 12px", fontSize: ".75rem", fontWeight: 600 }}>📍 Table {TABLE_NUM}</span></div>
            <div style={{ padding: "0 1.2rem", display: "flex", flexDirection: "column", gap: 8 }}>
              {cart.map((item, index) => (
                <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 10, background: "#fff", borderRadius: 14, padding: "12px", border: "1px solid rgba(59,31,14,.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

                    {/* UP/DOWN REORDERING */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button onClick={() => move(index, -1)} disabled={index === 0}
                        style={{ border: "none", background: "transparent", color: index === 0 ? "rgba(59,31,14,.1)" : "#e8622a", cursor: index === 0 ? "default" : "pointer", fontSize: "1.2rem", padding: "0 4px" }}>▲</button>
                      <button onClick={() => move(index, 1)} disabled={index === cart.length - 1}
                        style={{ border: "none", background: "transparent", color: index === cart.length - 1 ? "rgba(59,31,14,.1)" : "#e8622a", cursor: index === cart.length - 1 ? "default" : "pointer", fontSize: "1.2rem", padding: "0 4px" }}>▼</button>
                    </div>

                    <div style={{ fontSize: "1.5rem", width: 44, height: 44, background: "rgba(59,31,14,.05)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: ".9rem", color: "#1a0a04", marginBottom: 2 }}>
                        <span style={{ fontSize: ".7rem", color: "#c4501e", fontWeight: "800", marginRight: 6 }}>#{index + 1}</span>
                        {item.name}
                      </div>
                      <div style={{ fontSize: ".78rem", color: "#c0a090" }}>₹{item.price} each</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", background: "rgba(59,31,14,.06)", borderRadius: 50, overflow: "hidden" }}>
                      <button onClick={() => dec(item.id)} style={{ width: 30, height: 30, border: "none", background: "transparent", color: "#5a3a22", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700, color: "#1a0a04", fontSize: ".9rem" }}>{item.qty}</span>
                      <button onClick={() => add(item)} style={{ width: 30, height: 30, border: "none", background: "transparent", color: "#5a3a22", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                    <div style={{ fontFamily: F.title, fontWeight: 800, fontSize: "1rem", color: "#1a0a04", minWidth: 44, textAlign: "right" }}>₹{item.price * item.qty}</div>
                    <button onClick={() => rem(item.id)} style={{ background: "transparent", border: "none", color: "rgba(59,31,14,.2)", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", fontSize: ".75rem", color: "#9a7a5a", padding: "10px 1.5rem 0", fontStyle: "italic" }}>
              ⬆️ Use arrows to arrange serving order
            </div>
            <div style={{ padding: "1rem 1.2rem 0" }}>
              <textarea style={{ width: "100%", background: "#fff", border: "1.5px solid rgba(59,31,14,.1)", borderRadius: 12, padding: "12px", color: "#1a0a04", fontFamily: F.body, fontSize: ".88rem", resize: "none", outline: "none", lineHeight: 1.5 }}
                rows={2} placeholder="📝 Special requests? (less sugar, extra hot...)" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div style={{ padding: "1rem 1.2rem 2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid rgba(59,31,14,.08)", borderBottom: "1px solid rgba(59,31,14,.08)", marginBottom: 14 }}>
                <span style={{ fontWeight: 600, color: "#5a3a22", fontSize: ".9rem" }}>Total</span>
                <span style={{ fontFamily: F.title, fontWeight: 800, fontSize: "1.1rem", color: "#1a0a04" }}>₹{total}</span>
              </div>
              {paymentError && (
                <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 12, textAlign: "center" }}>
                  <div style={{ fontSize: ".85rem", color: "#ef4444", fontWeight: 600, marginBottom: 6 }}>{paymentError}</div>
                  <button onClick={retryPayment} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(232,98,42,.3)", background: "rgba(232,98,42,.08)", color: "#e8622a", cursor: "pointer", fontWeight: 700, fontSize: ".82rem" }}>🔄 Retry Payment</button>
                </div>
              )}
              <button onClick={placeOrder} disabled={loading}
                style={{ width: "100%", background: loading ? "rgba(232,98,42,.5)" : "linear-gradient(135deg,#e8622a,#c4501e)", border: "none", borderRadius: 14, padding: "17px", color: "#fff", fontFamily: F.body, fontSize: "1rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 8px 24px rgba(232,98,42,.3)", transition: "all .3s" }}>
                {loading ? "⏳ Processing..." : `💳 Pay & Order · ₹${total}`}
              </button>
              <div style={{ textAlign: "center", fontSize: ".75rem", color: "#c0a090", marginTop: 10 }}>Secure payment via Razorpay · UPI / Card / Net Banking</div>
            </div>
          </div>
        </div>
      )}
      {showMockPay && (
        <MockPaymentSheet
          amount={total}
          onSuccess={handleMockPaySuccess}
          onClose={handleMockPayClose}
        />
      )}
    </div>
  );
}

