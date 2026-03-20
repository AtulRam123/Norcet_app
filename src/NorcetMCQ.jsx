import { useState, useEffect, useCallback, useRef, useMemo } from "react";
const ALL_QUESTIONS = require('./questions.json');

// ── Storage keys ─────────────────────────────────────────────────────────────
const LS_V2      = "norcet_app_v2";   // unified store (new)
const LS_ATT     = "norcet_att_v9";   // legacy — read for migration
const LS_HIST    = "norcet_hist_v9";
const LS_WRONG   = "norcet_wrong_v9";
const LS_WMAP    = "norcet_wmap_v9";
const LS_SET     = "norcet_set_v9";
const LS_SESS    = "norcet_sess_v9";
const LS_BOOK    = "norcet_book_v9";
const LS_DAY_LOG = "norcet_daylog_v9";

const MOCK_SPQ = 72;
const todayStr = () => new Date().toISOString().slice(0, 10);

// ── Storage helpers ───────────────────────────────────────────────────────────
function loadState(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function saveState(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Unified store (v2) ───────────────────────────────────────────────────────
// Shape: { attempts, sessions, bookmarks, settings }
// attempts: [{ qid, selected, correct, date, sessionId }]
// sessions: [{ id, date, correct, wrong, poolIds, poolIdx, isMock, timeLeft, target, mockAnswers }]
function loadUnified() {
  const stored = loadState(LS_V2, null);
  if (stored) return stored;

  // ── Migration from legacy keys ──────────────────────────────────────────
  console.log("[NORCET] Migrating legacy data to v2...");
  const legacyAtt     = new Set(loadState(LS_ATT, []));
  const legacyWrong   = new Set(loadState(LS_WRONG, []));
  const legacyWmap    = loadState(LS_WMAP, {});
  const legacyDayLog  = loadState(LS_DAY_LOG, {});
  const legacyHist    = loadState(LS_HIST, {});
  const legacyBook    = loadState(LS_BOOK, []);
  const legacySet     = loadState(LS_SET, { userName: "" });
  const legacySess    = loadState(LS_SESS, null);

  // Build attempts from dayLog (most complete legacy source)
  const attempts = [];
  Object.entries(legacyDayLog).forEach(([date, entries]) => {
    entries.forEach(e => {
      attempts.push({
        qid:       e.qid,
        selected:  e.myAnswer,
        correct:   e.correct,
        date,
        sessionId: `legacy_${date}`,
      });
    });
  });
  // Fill in any att IDs not in dayLog (we know they were attempted but not how)
  legacyAtt.forEach(qid => {
    if (!attempts.find(a => a.qid === qid)) {
      attempts.push({ qid, selected: null, correct: null, date: "unknown", sessionId: "legacy" });
    }
  });

  // Migrate session
  const sessions = legacySess ? [{
    id:          legacySess.sessionId || `legacy_sess`,
    date:        legacySess.date || todayStr(),
    correct:     legacySess.correct || 0,
    wrong:       legacySess.wrong || 0,
    poolIds:     legacySess.poolIds || [],
    poolIdx:     legacySess.poolIdx || 0,
    isMock:      legacySess.isMock || false,
    timeLeft:    legacySess.timeLeft || null,
    target:      legacySess.target || 0,
    mockAnswers: legacySess.mockAnswers || {},
  }] : [];

  const unified = {
    attempts,
    sessions,
    bookmarks: [...legacyBook],
    settings:  legacySet,
    wrongMap:  legacyWmap,
  };

  saveState(LS_V2, unified);
  console.log(`[NORCET] Migration complete. ${attempts.length} attempts migrated.`);
  return unified;
}

// ── Derive sets from attempts ─────────────────────────────────────────────────
function deriveAtt(attempts) {
  return new Set(attempts.map(a => a.qid));
}
function deriveWrongIds(attempts) {
  // A question is "wrong" if the LAST attempt was incorrect
  const lastByQ = {};
  attempts.forEach(a => { lastByQ[a.qid] = a; });
  const wrong = new Set();
  Object.values(lastByQ).forEach(a => {
    if (a.correct === false) wrong.add(a.qid);
  });
  return wrong;
}
function deriveHist(attempts) {
  const hist = {};
  attempts.forEach(a => {
    if (!a.date || a.date === "unknown") return;
    if (!hist[a.date]) hist[a.date] = { correct: 0, wrong: 0, total: 0 };
    if (a.correct === true)  { hist[a.date].correct++; hist[a.date].total++; }
    if (a.correct === false) { hist[a.date].wrong++;   hist[a.date].total++; }
  });
  return hist;
}
function deriveDayLog(attempts) {
  const log = {};
  attempts.forEach(a => {
    if (!a.date || a.date === "unknown" || !a.selected) return;
    if (!log[a.date]) log[a.date] = [];
    if (!log[a.date].find(e => e.qid === a.qid))
      log[a.date].push({ qid: a.qid, myAnswer: a.selected, correct: a.correct });
  });
  return log;
}

// ── Adaptive question pool ────────────────────────────────────────────────────
function pickPool(allQ, att, wrongIds, count) {
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  const freshQ   = allQ.filter(q => !att.has(q.id));
  const wrongQ   = allQ.filter(q => wrongIds.has(q.id));
  // previously correct = attempted but not currently wrong
  const prevCorrQ = allQ.filter(q => att.has(q.id) && !wrongIds.has(q.id));

  // Targets: 40% wrong, 40% fresh, 20% prev-correct
  let wantWrong = Math.floor(count * 0.40);
  let wantFresh = Math.floor(count * 0.40);
  let wantPrev  = count - wantWrong - wantFresh; // ~20%

  // Fallback: if a bucket is empty, redistribute to others
  const wrongPool  = shuffle(wrongQ).slice(0, wantWrong);
  const prevPool   = shuffle(prevCorrQ).slice(0, wantPrev);
  let   freshPool  = shuffle(freshQ).slice(0, wantFresh);

  // If wrong or prev is short, fill from fresh
  const shortfall = (wantWrong - wrongPool.length) + (wantPrev - prevPool.length);
  if (shortfall > 0) {
    freshPool = shuffle(freshQ).slice(0, Math.min(freshQ.length, wantFresh + shortfall));
  }

  // If no fresh at all, fill from wrong+prev
  const combined = [...wrongPool, ...freshPool, ...prevPool];
  const seen = new Set();
  const unique = combined.filter(q => { if (seen.has(q.id)) return false; seen.add(q.id); return true; });

  // If still short, pad with anything available
  if (unique.length < count) {
    allQ.forEach(q => { if (!seen.has(q.id)) { seen.add(q.id); unique.push(q); } });
  }

  return shuffle(unique).slice(0, count).map(q => q.id);
}

function getPresets(available) {
  // Dynamic presets based on available count — always include All if ≤ 100
  const base = [10, 25, 50, 75, 100].filter(x => x <= available);
  if (available > 0 && !base.includes(available) && available <= 100) base.push(available);
  base.sort((a, b) => a - b);
  return base.length ? base : available > 0 ? [available] : [];
}

// ── Romantic content ──────────────────────────────────────────────────────────
const DAILY_NOTES = [
  "Every page you study brings your dream closer. I'm so proud of you 🌸",
  "You are going to be the most compassionate nurse, just like you are with me 💕",
  "Watching you work hard makes me fall for you every single day 🌷",
  "Future Nurse. Present love of my life. Forever my person 💝",
  "Your dedication is the most beautiful thing I've ever seen 🥀",
  "Study hard today, celebrate together tomorrow 🎀",
  "You carry so much strength — never forget that 💪🌸",
  "I believe in you more than you'll ever know, my love 💖",
  "Every question you get right is a step closer to your dream 🌟",
  "You make me proud every single day. Keep going 💗",
];
const CORRECT_MSGS = ["Brilliant! 🌟", "That's my girl! 💕", "You knew it! 🌸", "Perfect! 💖", "Yes! 🥰", "Nailed it! 🎯"];
const WRONG_MSGS   = ["You'll get it next time 💪", "Keep going, my love 💕", "One step closer 🌸", "Learning is growing 💝", "Almost! Try again 🌷"];
const DONE_MSGS    = ["You did amazing today, love! 💖", "I'm so proud of you 🌸", "Every session makes you stronger 💪", "You're going to ace NORCET! 🏆", "My brilliant future nurse 🥰", "That was incredible. I love you 💕"];
const rand = arr => arr[Math.floor(Math.random() * arr.length)];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WDAYS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function FloatingHearts() {
  const hearts = ["💕","🌸","💗","🌷","💖","🥀","💝","✨","🌹","💞"];
  return (
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}} aria-hidden="true">
      {Array.from({length:12},(_,i)=>(
        <div key={i} style={{
          position:"absolute",bottom:"-20px",
          left:`${5+i*8}%`,
          fontSize:`${0.6+Math.random()*0.8}rem`,
          opacity:0,
          animation:`floatUp ${8+Math.random()*12}s linear infinite`,
          animationDelay:`${Math.random()*15}s`,
        }}>{hearts[i%hearts.length]}</div>
      ))}
    </div>
  );
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Nunito:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#fff8fb;--bg2:#fff0f5;--bg3:#fce8f0;--bg4:#f8e0ec;
  --card:#ffffff;
  --pink:#e8608a;--pink2:#c84070;--pink3:#f090b0;
  --pink-light:rgba(232,96,138,.10);--pink-lighter:rgba(232,96,138,.05);
  --rose:#f4a0b8;--lavender:#c090e8;--lav-light:rgba(192,144,232,.10);
  --gold:#e8a030;--gold-light:rgba(232,160,48,.10);
  --teal:#30b4a0;--teal-light:rgba(48,180,160,.10);
  --correct:#28a060;--correct-light:rgba(40,160,96,.10);
  --wrong:#e04060;--wrong-light:rgba(224,64,96,.10);
  --text:#3a2040;--t2:#7a5080;--t3:#b090b8;--t4:#d8c0e0;
  --b1:rgba(232,96,138,.12);--b2:rgba(232,96,138,.22);--b3:rgba(232,96,138,.35);
  --shadow:0 8px 40px rgba(200,80,120,.10);
  --shadow2:0 20px 60px rgba(200,80,120,.15);
  --r1:12px;--r2:18px;--r3:24px;--r4:32px;
  --sidebar-w:72px;
  --safe-bottom:max(16px,env(safe-area-inset-bottom));
  --safe-top:env(safe-area-inset-top,0px);
}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font-family:'Nunito',sans-serif;background:var(--bg);color:var(--text);
  min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;
  overscroll-behavior-y:contain}
@keyframes floatUp{0%{transform:translateY(0) rotate(-15deg) scale(.8);opacity:0}10%{opacity:.6}90%{opacity:.2}100%{transform:translateY(-110vh) rotate(15deg) scale(1.1);opacity:0}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{opacity:0;transform:scale(.9) translateY(24px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes slideLeft{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes qPop{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes bob{from{transform:translateY(0) rotate(-3deg)}to{transform:translateY(-10px) rotate(3deg)}}

.bg-pattern{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse 70% 50% at 0% 0%,rgba(244,160,184,.18) 0%,transparent 55%),
  radial-gradient(ellipse 60% 70% at 100% 100%,rgba(192,144,232,.12) 0%,transparent 55%),
  radial-gradient(ellipse 50% 40% at 60% 20%,rgba(232,96,138,.07) 0%,transparent 50%)}
.bg-dots{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.4;
  background-image:radial-gradient(circle,rgba(232,96,138,.15) 1px,transparent 1px);
  background-size:28px 28px}

/* ── LAYOUT SHELL ── */
.app{position:relative;z-index:2;min-height:100vh;display:flex;flex-direction:column}

/* ── DESKTOP NAV (top bar) ── */
.nav{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;
  border-bottom:1px solid var(--b1);background:rgba(255,248,251,.92);
  backdrop-filter:blur(20px) saturate(180%);position:sticky;top:0;z-index:300;
  box-shadow:0 2px 20px rgba(200,80,120,.06)}
.logo{display:flex;align-items:center;gap:10px}
.logo-heart{width:36px;height:36px;border-radius:11px;
  background:linear-gradient(135deg,var(--pink),var(--lavender));
  display:flex;align-items:center;justify-content:center;font-size:1.1rem;
  box-shadow:0 4px 14px rgba(232,96,138,.35)}
.logo-text{font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:700;
  background:linear-gradient(135deg,var(--pink) 0%,var(--lavender) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-tabs{display:flex;gap:2px;background:var(--bg3);border:1px solid var(--b1);border-radius:14px;padding:3px}
.ntab{padding:7px 16px;border-radius:11px;border:none;background:transparent;color:var(--t2);
  font-family:'Nunito',sans-serif;font-size:.76rem;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.ntab:hover{color:var(--text);background:rgba(232,96,138,.08)}
.ntab.on{background:linear-gradient(135deg,rgba(232,96,138,.15),rgba(192,144,232,.12));
  color:var(--pink);border:1px solid rgba(232,96,138,.25);box-shadow:0 2px 10px rgba(232,96,138,.12)}
.nav-end{display:flex;align-items:center;gap:8px}
.streak-chip{display:flex;align-items:center;gap:6px;font-size:.74rem;font-weight:700;
  color:var(--pink);background:var(--pink-light);
  border:1px solid rgba(232,96,138,.2);padding:6px 13px;border-radius:99px}
.icon-btn{width:34px;height:34px;border-radius:10px;border:1px solid var(--b1);background:var(--card);
  color:var(--t2);cursor:pointer;font-size:1rem;
  display:flex;align-items:center;justify-content:center;transition:all .18s;
  box-shadow:0 2px 8px rgba(200,80,120,.06)}
.icon-btn:hover{border-color:var(--b2);color:var(--pink);background:var(--pink-lighter)}

/* ── MOBILE TOP BAR ── */
.mob-topbar{
  display:none;align-items:center;justify-content:space-between;
  padding:calc(var(--safe-top) + 12px) 16px 12px;
  background:rgba(255,248,251,.95);backdrop-filter:blur(20px);
  border-bottom:1px solid var(--b1);
  position:sticky;top:0;z-index:300;
  box-shadow:0 2px 16px rgba(200,80,120,.06);
}
.mob-topbar .logo-text{font-size:1.1rem}
.mob-topbar .logo-heart{width:30px;height:30px;font-size:.9rem}
.mob-menu-btn{
  width:36px;height:36px;border-radius:10px;border:1px solid var(--b1);
  background:var(--card);color:var(--t2);cursor:pointer;font-size:1.1rem;
  display:flex;align-items:center;justify-content:center;
}
.mob-streak{font-size:.72rem;font-weight:700;color:var(--pink);
  background:var(--pink-light);border:1px solid rgba(232,96,138,.2);
  padding:5px 10px;border-radius:99px}

/* ── SIDEBAR OVERLAY (mobile) ── */
.sidebar-overlay{
  display:none;position:fixed;inset:0;z-index:450;
  background:rgba(58,32,64,.45);backdrop-filter:blur(4px);
  animation:fadeIn .22s ease;
}
.sidebar{
  position:fixed;left:0;top:0;bottom:0;z-index:500;
  width:280px;
  background:var(--card);
  border-right:1.5px solid var(--b1);
  box-shadow:4px 0 32px rgba(200,80,120,.15);
  display:flex;flex-direction:column;
  animation:slideLeft .3s cubic-bezier(.22,.68,0,1.2);
  overflow-y:auto;
  padding-top:var(--safe-top);
}
.sidebar-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 20px 14px;border-bottom:1px solid var(--b1);
}
.sidebar-head .logo{gap:8px}
.sidebar-close{
  width:32px;height:32px;border-radius:9px;border:1px solid var(--b1);
  background:var(--bg2);color:var(--t2);cursor:pointer;font-size:1rem;
  display:flex;align-items:center;justify-content:center;
}

/* Sidebar nav links */
.sidebar-nav{padding:12px 12px 0;flex:1}
.snav-item{
  display:flex;align-items:center;gap:12px;width:100%;
  padding:12px 14px;border-radius:13px;border:none;
  background:transparent;color:var(--t2);
  font-family:'Nunito',sans-serif;font-size:.9rem;font-weight:600;
  cursor:pointer;text-align:left;transition:all .18s;margin-bottom:3px;
}
.snav-item:hover{background:var(--pink-lighter);color:var(--pink)}
.snav-item.on{background:linear-gradient(135deg,var(--pink-light),var(--lav-light));
  color:var(--pink);border:1px solid rgba(232,96,138,.2)}
.snav-icon{font-size:1.2rem;width:28px;text-align:center;flex-shrink:0}
.snav-label{flex:1}
.snav-badge{font-size:.6rem;font-weight:700;padding:2px 7px;border-radius:99px;
  background:var(--wrong-light);color:var(--wrong)}

/* Sidebar stats mini-cards */
.sidebar-stats{padding:14px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sstat{background:var(--bg2);border:1px solid var(--b1);border-radius:12px;
  padding:10px 12px;text-align:center}
.sstat .sv{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:700;color:var(--pink)}
.sstat .sl{font-size:.6rem;color:var(--t3);margin-top:2px;font-weight:600}

/* Sidebar calendar (compact) */
.sidebar-cal{padding:14px 12px 8px;border-top:1px solid var(--b1)}
.sidebar-cal .ptitle{margin-bottom:12px}
.scal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.scal-m{font-size:.78rem;font-weight:700;color:var(--text)}
.scal-btn{width:24px;height:24px;border-radius:6px;border:1px solid var(--b1);
  background:var(--bg2);color:var(--t2);cursor:pointer;font-size:.75rem;
  display:flex;align-items:center;justify-content:center}
.scal-dn{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:3px}
.scal-dn span{font-size:.52rem;color:var(--t3);text-align:center;font-weight:700}
.scal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.scal-cell{aspect-ratio:1;border-radius:5px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;font-size:.55rem;color:var(--t3);
  transition:all .15s;cursor:default}
.scal-cell.hd{cursor:pointer}.scal-cell.hd:hover{background:var(--bg3)}
.scal-cell.tc{border:1px solid var(--pink);color:var(--pink);font-weight:700}
.scal-cell.perf{background:rgba(48,180,160,.15)}.scal-cell.perf span{color:var(--teal);font-weight:700}
.scal-cell.good{background:rgba(232,160,48,.1)}.scal-cell.good span{color:var(--gold);font-weight:700}
.scal-cell.low{background:rgba(224,64,96,.08)}.scal-cell.low span{color:var(--wrong);font-weight:700}
.scal-pip{width:3px;height:3px;border-radius:50%;margin-top:1px}
.sidebar-footer{padding:14px 12px calc(var(--safe-bottom) + 4px);border-top:1px solid var(--b1)}
.sfooter-note{font-size:.72rem;color:var(--pink);font-style:italic;
  font-family:'Playfair Display',serif;line-height:1.5;text-align:center;padding:8px 0}

/* ── MOBILE BOTTOM NAV ── */
.bottom-nav{
  display:none;
  position:fixed;bottom:0;left:0;right:0;z-index:400;
  background:rgba(255,248,251,.97);backdrop-filter:blur(20px);
  border-top:1.5px solid var(--b1);
  padding:8px 0 var(--safe-bottom);
  box-shadow:0 -4px 20px rgba(200,80,120,.08);
}
.bn-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;
  background:none;border:none;color:var(--t3);cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:.58rem;padding:4px 0;
  transition:all .18s;font-weight:700;position:relative;
  -webkit-tap-highlight-color:transparent}
.bn-btn.on{color:var(--pink)}
.bn-btn.on .bn-icon{transform:scale(1.1)}
.bn-icon{font-size:1.2rem;transition:transform .18s}
.bn-badge{position:absolute;top:2px;right:calc(50% - 18px);
  width:16px;height:16px;border-radius:50%;
  background:var(--wrong);color:#fff;font-size:.52rem;font-weight:700;
  display:flex;align-items:center;justify-content:center;border:2px solid var(--bg)}

/* ── PAGE CONTENT ── */
.page{position:relative;z-index:2;padding:36px 26px 90px;max-width:1140px;margin:0 auto;width:100%}

/* ── MODAL / OVERLAY ── */
.overlay{position:fixed;inset:0;z-index:600;background:rgba(240,220,230,.75);
  backdrop-filter:blur(20px);display:flex;align-items:flex-end;justify-content:center;
  padding:0;animation:fadeIn .22s ease}
.modal{background:var(--card);border:1px solid var(--b2);
  border-radius:var(--r4) var(--r4) 0 0;
  padding:32px 28px calc(var(--safe-bottom) + 20px);
  max-width:540px;width:100%;max-height:92vh;overflow-y:auto;
  box-shadow:var(--shadow2),0 0 60px rgba(232,96,138,.08);
  animation:sheetUp .35s cubic-bezier(.22,.68,0,1.2);
  position:relative;
}
@keyframes sheetUp{from{transform:translateY(100%);opacity:.5}to{transform:translateY(0);opacity:1}}
.modal::before{content:'';display:block;width:40px;height:4px;border-radius:99px;
  background:var(--b2);margin:0 auto 24px;flex-shrink:0}
.modal-hd{text-align:center;margin-bottom:24px}
.modal-icon{font-size:2.6rem;margin-bottom:8px}
.modal-hd h2{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;
  background:linear-gradient(135deg,var(--text),var(--pink));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:5px}
.modal-hd p{font-size:.82rem;color:var(--t2);line-height:1.65}
.modal-hd strong{color:var(--pink)}

.field-label{font-size:.67rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:var(--t2);margin-bottom:9px;display:block}
.text-input{width:100%;padding:13px 16px;border-radius:13px;background:var(--bg2);
  border:1.5px solid var(--b1);color:var(--text);font-family:'Nunito',sans-serif;
  font-size:1rem;outline:none;transition:all .2s;margin-bottom:20px;
  -webkit-appearance:none;appearance:none}
.text-input:focus{border-color:var(--b2);box-shadow:0 0 0 3px rgba(232,96,138,.08)}
.text-input::placeholder{color:var(--t3)}
.preset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;margin-bottom:16px}
.pchip{padding:12px 8px;border-radius:13px;border:1.5px solid var(--b1);background:var(--bg2);
  color:var(--t2);font-family:'Nunito',sans-serif;font-size:.78rem;font-weight:700;
  cursor:pointer;text-align:center;transition:all .2s;display:flex;flex-direction:column;
  align-items:center;gap:3px;-webkit-tap-highlight-color:transparent}
.pchip:hover:not(:disabled){border-color:var(--b2);background:var(--pink-lighter);color:var(--pink)}
.pchip.on{background:linear-gradient(135deg,var(--pink-light),var(--lav-light));
  border-color:var(--b2);color:var(--pink);box-shadow:0 4px 14px rgba(232,96,138,.12)}
.pchip:disabled{opacity:.35;cursor:not-allowed}
.pchip-n{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700;line-height:1}
.pchip-l{font-size:.58rem;color:var(--t3);margin-top:2px}
.pchip.on .pchip-l{color:var(--t2)}
.slider-row{display:flex;align-items:center;gap:14px;margin-bottom:6px}
.range{flex:1;height:6px;border-radius:99px;-webkit-appearance:none;appearance:none;
  cursor:pointer;background:linear-gradient(90deg,var(--pink) var(--p,0%),var(--b1) var(--p,0%));outline:none}
.range::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;
  background:var(--pink);border:3px solid white;box-shadow:0 2px 10px rgba(232,96,138,.4);transition:transform .15s}
.range::-webkit-slider-thumb:hover{transform:scale(1.1)}
.range-val{min-width:48px;text-align:center;font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--pink)}
.range-note{font-size:.68rem;color:var(--t3);text-align:right;margin-bottom:18px}
.mode-toggle{display:flex;gap:8px;margin-bottom:20px}
.mmode{flex:1;padding:12px 8px;border-radius:13px;border:1.5px solid var(--b1);background:var(--bg2);
  color:var(--t2);font-family:'Nunito',sans-serif;font-size:.78rem;font-weight:700;
  cursor:pointer;text-align:center;transition:all .2s;-webkit-tap-highlight-color:transparent}
.mmode:hover{border-color:var(--b2);color:var(--text)}
.mmode.on{border-color:var(--b2);background:var(--pink-light);color:var(--pink)}
.mmode.mock-on{border-color:rgba(192,144,232,.4);background:var(--lav-light);color:var(--lavender)}
.mmode-icon{font-size:1.4rem;display:block;margin-bottom:4px}
.mmode-l{font-size:.7rem;font-weight:700}
.mmode-sub{font-size:.6rem;color:var(--t3);margin-top:2px}
.mmode.on .mmode-sub,.mmode.mock-on .mmode-sub{color:var(--t2)}
.avail-bar{display:flex;align-items:center;gap:10px;background:var(--bg3);border:1px solid var(--b1);
  border-radius:10px;padding:10px 14px;margin-bottom:20px;font-size:.78rem;color:var(--t2)}
.avail-bar strong{color:var(--teal)}
.go-btn{width:100%;padding:15px;border-radius:14px;border:none;
  background:linear-gradient(135deg,var(--pink) 0%,var(--pink2) 50%,var(--lavender) 100%);
  background-size:200%;background-position:0%;color:#fff;font-family:'Nunito',sans-serif;
  font-size:.97rem;font-weight:700;cursor:pointer;transition:all .3s;letter-spacing:.02em;
  box-shadow:0 8px 24px rgba(232,96,138,.3);-webkit-tap-highlight-color:transparent;
  -webkit-appearance:none;touch-action:manipulation}
.go-btn:active{transform:scale(.98);opacity:.9}
.go-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}

/* ── DAILY NOTE ── */
.daily-note{background:linear-gradient(135deg,rgba(244,160,184,.15),rgba(192,144,232,.12));
  border:1.5px solid rgba(232,96,138,.18);border-radius:var(--r3);padding:16px 20px;
  margin-bottom:22px;display:flex;align-items:center;gap:12px;
  box-shadow:0 4px 20px rgba(200,80,120,.07)}
.daily-note-icon{font-size:1.6rem;flex-shrink:0}
.daily-note-text{font-family:'Playfair Display',serif;font-size:.9rem;font-style:italic;
  color:var(--pink2);line-height:1.6}

/* ── GREETING ── */
.greeting{margin-bottom:28px;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:14px}
.greeting-left h1{font-family:'Playfair Display',serif;
  font-size:clamp(1.8rem,5vw,3rem);font-weight:700;line-height:1.15;
  background:linear-gradient(135deg,var(--text) 0%,var(--pink) 50%,var(--lavender) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.greeting-left p{color:var(--t2);margin-top:6px;font-size:.83rem;font-weight:500;line-height:1.7}
.start-fab{padding:12px 22px;border-radius:13px;border:none;
  background:linear-gradient(135deg,var(--pink),var(--pink2));color:#fff;
  font-family:'Nunito',sans-serif;font-size:.82rem;font-weight:700;cursor:pointer;
  white-space:nowrap;transition:all .22s;flex-shrink:0;
  box-shadow:0 6px 20px rgba(232,96,138,.3);touch-action:manipulation}
.start-fab:active{transform:scale(.97)}

/* ── STAT GRID ── */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px;margin-bottom:22px}
.sc{background:var(--card);border:1.5px solid var(--b1);border-radius:var(--r3);
  padding:18px 16px;position:relative;overflow:hidden;transition:all .22s;cursor:default;box-shadow:var(--shadow)}
.sc:active{transform:scale(.98)}
.sc::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--a)}
.sc-icon{font-size:1.3rem;margin-bottom:10px}
.sc-val{font-family:'Playfair Display',serif;font-size:2.2rem;font-weight:700;color:var(--text);line-height:1}
.sc-lbl{font-size:.68rem;color:var(--t2);margin-top:4px;font-weight:600}
.sc-sub{font-size:.6rem;color:var(--t3);margin-top:2px}

/* ── TODAY BANNER ── */
.today{background:linear-gradient(135deg,rgba(232,96,138,.08),rgba(192,144,232,.06),rgba(48,180,160,.04));
  border:1.5px solid rgba(232,96,138,.18);border-radius:var(--r3);padding:20px 22px;
  margin-bottom:22px;position:relative;overflow:hidden;box-shadow:0 6px 24px rgba(200,80,120,.08)}
.today::after{content:'🌸';position:absolute;right:16px;top:50%;transform:translateY(-50%);
  font-size:3.5rem;opacity:.08;pointer-events:none}
.today-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.today-tag{font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--pink);margin-bottom:5px}
.today-title{font-size:1rem;font-weight:700;color:var(--text)}
.today-sub{font-size:.74rem;color:var(--t2);margin-top:4px;line-height:1.5;font-weight:500}
.today-pbar{margin-top:14px;height:4px;background:var(--b1);border-radius:99px;overflow:hidden}
.today-pfill{height:100%;background:linear-gradient(90deg,var(--pink),var(--lavender));border-radius:99px;transition:width .9s cubic-bezier(.22,.68,0,1)}
.today-btns{display:flex;gap:8px;flex-wrap:wrap}
.btn-primary{padding:10px 20px;border-radius:11px;border:none;
  background:linear-gradient(135deg,var(--pink),var(--pink2));color:#fff;
  font-family:'Nunito',sans-serif;font-weight:700;font-size:.8rem;cursor:pointer;
  transition:all .2s;box-shadow:0 4px 16px rgba(232,96,138,.3);touch-action:manipulation}
.btn-primary:active{transform:scale(.97)}
.btn-sec{padding:10px 20px;border-radius:11px;border:1.5px solid var(--b2);background:transparent;
  color:var(--pink);font-family:'Nunito',sans-serif;font-weight:700;font-size:.8rem;
  cursor:pointer;transition:all .2s;touch-action:manipulation}
.btn-sec:active{background:var(--pink-light)}

/* ── DASH GRID ── */
.dgrid{display:grid;grid-template-columns:1fr 1.1fr;gap:18px}
.panel{background:var(--card);border:1.5px solid var(--b1);border-radius:var(--r3);padding:20px 18px;box-shadow:var(--shadow)}
.panel+.panel{margin-top:18px}
.ptitle{font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:var(--t3);margin-bottom:18px;display:flex;align-items:center;gap:8px}
.ptitle::after{content:'';flex:1;height:1px;background:var(--b1)}

/* ── CALENDAR (desktop panel) ── */
.cal-nav-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.cal-m{font-size:.84rem;font-weight:700;color:var(--text)}
.cbtn{width:26px;height:26px;border-radius:7px;border:1.5px solid var(--b1);background:var(--bg2);
  color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem;transition:all .15s}
.cbtn:hover{border-color:var(--b2);color:var(--pink)}
.cal-dn-row{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:3px}
.cal-dn{font-size:.56rem;color:var(--t3);text-align:center;padding:2px 0;font-weight:700}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cc{aspect-ratio:1;border-radius:7px;display:flex;flex-direction:column;align-items:center;
  justify-content:center;font-size:.6rem;color:var(--t3);position:relative;transition:all .18s}
.cc.today-cell{border:1.5px solid var(--pink);color:var(--pink);font-weight:700;background:var(--pink-lighter)}
.cc.hd{cursor:pointer;-webkit-tap-highlight-color:transparent}
.cc.hd:hover{transform:scale(1.1);box-shadow:0 3px 10px rgba(200,80,120,.12)}
.cc.hd:active{transform:scale(.95)}
.cc.perfect{background:rgba(48,180,160,.12)}.cc.perfect .cn{color:var(--teal);font-weight:700}
.cc.good{background:rgba(232,160,48,.1)}.cc.good .cn{color:var(--gold);font-weight:700}
.cc.low{background:rgba(224,64,96,.08)}.cc.low .cn{color:var(--wrong);font-weight:700}
.cn{font-size:.58rem;line-height:1}
.cpip{width:4px;height:4px;border-radius:50%;margin-top:2px}
.cal-leg{display:flex;gap:12px;margin-top:10px;flex-wrap:wrap}
.cleg{display:flex;align-items:center;gap:4px;font-size:.58rem;color:var(--t3);font-weight:600}
.cleg-d{width:7px;height:7px;border-radius:50%}
.cal-hint{font-size:.62rem;color:var(--t3);margin-top:7px;font-style:italic;font-weight:500}

/* ── 7-day bars ── */
.arow{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.aday{font-size:.66rem;color:var(--t2);min-width:24px;font-weight:700}
.atrack{flex:1;height:5px;background:var(--bg3);border-radius:99px;overflow:hidden}
.afill{height:100%;border-radius:99px;transition:width 1.4s cubic-bezier(.22,.68,0,1)}
.apct{font-size:.65rem;color:var(--t2);min-width:28px;text-align:right;font-weight:700}

/* ── RECENT list ── */
.rlist{display:flex;flex-direction:column;gap:7px}
.ri{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;
  background:var(--bg2);border:1.5px solid var(--b1);transition:border-color .15s}
.ri:hover{border-color:var(--b2)}
.ri-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.ri-date{font-size:.68rem;color:var(--t2);min-width:60px;font-weight:600}
.ri-score{font-size:.74rem;color:var(--text);flex:1;font-weight:600}
.ri-badge{font-size:.56rem;font-weight:700;padding:3px 8px;border-radius:99px;letter-spacing:.04em}
.rb-g{background:rgba(48,180,160,.12);color:var(--teal)}
.rb-o{background:rgba(232,160,48,.1);color:var(--gold)}
.rb-r{background:rgba(224,64,96,.1);color:var(--wrong)}

/* ── DAY DETAIL MODAL ── */
.day-modal{max-width:560px;max-height:90vh;overflow-y:auto;border-radius:var(--r3) var(--r3) 0 0}
.day-modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px}
.day-modal-hd h3{font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--text)}
.day-stats{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
.day-stat{flex:1;min-width:72px;background:var(--bg2);border:1.5px solid var(--b1);border-radius:11px;padding:10px;text-align:center}
.day-stat .dv{font-family:'Playfair Display',serif;font-size:1.6rem;color:var(--pink)}
.day-stat .dl{font-size:.6rem;color:var(--t3);margin-top:2px;font-weight:700}
.day-q-list{display:flex;flex-direction:column;gap:10px}
.day-q-card{background:var(--bg2);border:1.5px solid var(--b1);border-radius:var(--r2);padding:14px 12px}
.day-q-num{font-size:.58rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--pink);margin-bottom:7px}
.day-q-text{font-size:.86rem;line-height:1.6;color:var(--text);margin-bottom:10px;font-weight:600}
.day-opts{display:flex;flex-direction:column;gap:5px}
.day-opt{display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:9px;
  font-size:.78rem;color:var(--t2);background:transparent;border:1px solid var(--b1)}
.day-opt.is-correct{background:var(--correct-light);border-color:rgba(40,160,96,.3);color:var(--correct)}
.day-opt.is-wrong{background:var(--wrong-light);border-color:rgba(224,64,96,.3);color:var(--wrong)}
.day-opt.is-mine-right{background:var(--correct-light);border-color:rgba(40,160,96,.35);color:var(--correct)}
.day-opt-key{min-width:24px;height:24px;border-radius:6px;background:var(--bg3);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.65rem;flex-shrink:0}
.day-opt.is-correct .day-opt-key,.day-opt.is-mine-right .day-opt-key{background:var(--correct);color:#fff}
.day-opt.is-wrong .day-opt-key{background:var(--wrong);color:#fff}
.day-opt-badge{margin-left:auto;font-size:.56rem;font-weight:700}
.day-no-ans{font-size:.68rem;color:var(--t3);font-style:italic;margin-top:7px}
.day-expl{font-size:.76rem;color:var(--lavender);margin-top:9px;padding:8px 11px;
  background:var(--lav-light);border:1px solid rgba(192,144,232,.2);border-radius:8px;line-height:1.6}
.day-expl strong{display:block;font-size:.6rem;color:var(--lavender);letter-spacing:.07em;text-transform:uppercase;margin-bottom:3px}

/* ── PRACTICE SHELL ── */
.pshell{display:flex;flex-direction:column;align-items:center;gap:16px}
.ptopbar{width:100%;max-width:680px;display:flex;align-items:center;gap:12px}
.p-qinfo{font-size:.72rem;color:var(--t2);white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}
.p-track{flex:1;height:5px;background:var(--bg3);border-radius:99px;overflow:hidden}
.p-fill{height:100%;background:linear-gradient(90deg,var(--pink),var(--lavender));border-radius:99px;transition:width .6s cubic-bezier(.22,.68,0,1)}
.p-acc{font-size:.7rem;color:var(--t2);white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}

/* ── QUESTION CARD ── */
.qcard{width:100%;max-width:680px;background:var(--card);border:1.5px solid var(--b1);
  border-radius:var(--r4);padding:28px 24px;position:relative;overflow:hidden;
  box-shadow:var(--shadow2);animation:qPop .42s cubic-bezier(.22,.68,0,1.2) both}
.qcard::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,var(--pink),var(--lavender),var(--rose))}
.qcard-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap}
.qtag{font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:var(--pink);background:var(--pink-light);border:1px solid rgba(232,96,138,.25);padding:4px 11px;border-radius:99px}
.mock-qtag{color:var(--lavender);background:var(--lav-light);border-color:rgba(192,144,232,.3)}
.qmeta{display:flex;align-items:center;gap:7px}
.img-chip{font-size:.58rem;color:var(--teal);background:var(--teal-light);
  border:1px solid rgba(48,180,160,.25);padding:3px 9px;border-radius:99px;font-weight:700}
.no-ans-chip{font-size:.58rem;color:var(--t3);background:var(--bg3);
  border:1px solid var(--b1);padding:3px 9px;border-radius:99px;font-weight:700}
.book-btn{background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px;
  transition:transform .15s;line-height:1;-webkit-tap-highlight-color:transparent}
.book-btn:active{transform:scale(.85)}
.qtext{font-size:1rem;font-weight:600;line-height:1.75;color:var(--text);margin-bottom:20px}
.qimg{margin-bottom:18px;border-radius:14px;overflow:hidden;border:1.5px solid var(--b1);
  box-shadow:0 4px 16px rgba(200,80,120,.08);background:var(--bg2)}
.qimg img{width:100%;max-height:260px;object-fit:contain;display:block;padding:8px}
.qimg-cap{font-size:.64rem;color:var(--t3);text-align:center;padding-bottom:7px;font-weight:600}

/* ── OPTIONS ── */
.opts{display:flex;flex-direction:column;gap:10px}
.opt{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:14px;
  border:1.5px solid var(--b1);background:var(--bg2);cursor:pointer;text-align:left;
  font-family:'Nunito',sans-serif;font-size:.9rem;color:var(--text);transition:all .18s ease;font-weight:500;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;width:100%}
.opt:active:not(:disabled){transform:scale(.98);background:var(--pink-lighter)}
.okey{min-width:34px;height:34px;border-radius:10px;background:var(--bg3);border:1.5px solid var(--b1);
  display:flex;align-items:center;justify-content:center;
  font-weight:700;font-size:.76rem;flex-shrink:0;transition:all .22s;color:var(--t2);margin-top:1px}
.otxt{line-height:1.6;font-size:.88rem;flex:1}
.opt.correct{background:var(--correct-light);border-color:rgba(40,160,96,.4)}
.opt.correct .okey{background:var(--correct);color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(40,160,96,.3)}
.opt.wrong{background:var(--wrong-light);border-color:rgba(224,64,96,.4)}
.opt.wrong .okey{background:var(--wrong);color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(224,64,96,.3)}
.opt.reveal{background:rgba(40,160,96,.06);border-color:rgba(40,160,96,.25);opacity:.85}
.opt.reveal .okey{background:var(--correct);color:#fff;border-color:transparent}

/* ── ANSWER NOTE ── */
.anote{margin-top:16px;padding:12px 15px;border-radius:12px;font-size:.82rem;font-weight:700;
  display:flex;align-items:flex-start;gap:9px;line-height:1.5}
.anote.ok{background:var(--correct-light);color:var(--correct);border:1.5px solid rgba(40,160,96,.25)}
.anote.err{background:var(--wrong-light);color:var(--wrong);border:1.5px solid rgba(224,64,96,.25)}
.anote.na{color:var(--t3);font-style:italic;border:1px solid var(--b1)}
.love-feedback{font-size:.86rem;font-style:italic;color:var(--pink);
  font-family:'Playfair Display',serif;margin-top:8px;text-align:center;padding:6px 0}
.explanation{margin-top:10px;padding:12px 15px;border-radius:12px;
  background:var(--lav-light);border:1.5px solid rgba(192,144,232,.25);
  font-size:.8rem;line-height:1.65;color:var(--t2);font-weight:500}
.explanation strong{color:var(--lavender);font-size:.64rem;letter-spacing:.08em;
  text-transform:uppercase;display:block;margin-bottom:5px;font-weight:700}
.nbtn{margin-top:18px;width:100%;padding:15px;border-radius:14px;border:none;
  background:linear-gradient(135deg,var(--pink) 0%,var(--pink2) 55%,var(--lavender) 100%);
  background-size:200%;background-position:0%;color:#fff;font-family:'Nunito',sans-serif;
  font-size:.94rem;font-weight:700;cursor:pointer;transition:all .3s;letter-spacing:.02em;
  box-shadow:0 8px 24px rgba(232,96,138,.25);-webkit-tap-highlight-color:transparent;
  touch-action:manipulation}
.nbtn:hover{background-position:100%;transform:translateY(-2px)}
.nbtn:active{transform:scale(.98)}

/* ── TIMER ── */
.timer-bar{width:100%;max-width:680px;display:flex;align-items:center;gap:11px}
.timer-track{flex:1;height:6px;background:var(--bg3);border-radius:99px;overflow:hidden}
.timer-fill{height:100%;border-radius:99px;transition:width .9s linear}
.timer-label{font-size:.78rem;font-weight:700;min-width:46px;text-align:right;font-variant-numeric:tabular-nums}

/* ── STAT STRIP ── */
.sstrip{display:flex;gap:10px;width:100%;max-width:680px;flex-wrap:wrap}
.ss{flex:1;min-width:100px;background:var(--card);border:1.5px solid var(--b1);
  border-radius:13px;padding:11px 8px;text-align:center;transition:all .18s;box-shadow:var(--shadow)}
.ss .v{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;line-height:1}
.ss .l{font-size:.6rem;color:var(--t3);margin-top:2px;font-weight:700}
.ss.vc .v{color:var(--correct)}.ss.vw .v{color:var(--wrong)}
.ss.vg .v{color:var(--gold)}.ss.vt .v{color:var(--teal)}

/* ── DONE / READY SCREENS ── */
.done-wrap{text-align:center;max-width:540px;margin:40px auto 0;padding:44px 28px;
  background:var(--card);border:1.5px solid var(--b1);border-radius:var(--r4);
  box-shadow:var(--shadow2);position:relative;overflow:hidden}
.done-wrap::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,var(--pink),var(--lavender),var(--pink))}
.done-emoji{font-size:3.5rem;display:block;margin-bottom:10px;animation:bob .7s ease-in-out infinite alternate}
.done-wrap h2{font-family:'Playfair Display',serif;font-size:2.2rem;font-weight:700;
  background:linear-gradient(135deg,var(--pink),var(--lavender));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.done-score{font-family:'Playfair Display',serif;font-size:5rem;font-weight:700;
  background:linear-gradient(135deg,var(--pink),var(--lavender));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:12px 0 5px;line-height:1}
.done-acc-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 16px;
  border-radius:99px;font-size:.78rem;font-weight:700;margin-bottom:12px}
.done-love{font-family:'Playfair Display',serif;font-size:1.1rem;font-style:italic;
  color:var(--pink);margin:8px 0 14px;line-height:1.5}
.done-wrap p{color:var(--t2);font-size:.84rem;line-height:1.75;font-weight:500}
.done-acts{display:flex;gap:9px;margin-top:20px;justify-content:center;flex-wrap:wrap}
.btn-danger{padding:10px 20px;border-radius:11px;border:1.5px solid rgba(224,64,96,.3);
  background:var(--wrong-light);color:var(--wrong);font-family:'Nunito',sans-serif;font-weight:700;
  font-size:.78rem;cursor:pointer;transition:all .2s;touch-action:manipulation}
.ready-card{text-align:center;max-width:480px;margin:40px auto 0;padding:44px 28px;
  background:var(--card);border:1.5px solid var(--b1);border-radius:var(--r4);
  box-shadow:var(--shadow2);position:relative;overflow:hidden}
.ready-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,var(--pink),var(--lavender),var(--pink))}
.ready-card h2{font-family:'Playfair Display',serif;font-size:1.9rem;font-weight:700;color:var(--text);margin:10px 0 7px}
.ready-card p{color:var(--t2);font-size:.82rem;line-height:1.7;margin-bottom:20px;font-weight:500}

/* ── MISTAKES / BOOKMARKS ── */
.rev-wrap{max-width:720px;margin:0 auto}
.rev-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
.rev-hdr h2{font-family:'Playfair Display',serif;font-size:1.9rem;font-weight:700;color:var(--text)}
.rev-count{font-size:.72rem;color:var(--wrong);background:var(--wrong-light);
  border:1.5px solid rgba(224,64,96,.25);padding:5px 12px;border-radius:99px;font-weight:700}
.rev-filters{display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap}
.rf{padding:6px 14px;border-radius:99px;border:1.5px solid var(--b1);background:var(--bg2);
  color:var(--t2);font-family:'Nunito',sans-serif;font-size:.72rem;font-weight:700;
  cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent}
.rf:active{transform:scale(.97)}
.rf.on{background:var(--wrong-light);border-color:rgba(224,64,96,.3);color:var(--wrong)}
.rev-empty{text-align:center;padding:70px 20px}
.rev-empty .e-icon{font-size:4rem;margin-bottom:14px}
.rev-empty h3{font-family:'Playfair Display',serif;font-size:1.7rem;color:var(--text);margin-bottom:7px}
.rev-empty p{color:var(--t2);font-size:.82rem;line-height:1.7;font-weight:500}
.rc{background:var(--card);border:1.5px solid var(--b1);border-radius:var(--r3);
  padding:20px 18px;margin-bottom:12px;border-left:4px solid var(--wrong);
  transition:all .2s;box-shadow:var(--shadow)}
.rc:active{transform:scale(.99)}
.rc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px}
.rc-num{font-size:.56rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--wrong);background:var(--wrong-light);border:1px solid rgba(224,64,96,.2);
  padding:3px 9px;border-radius:99px;white-space:nowrap;flex-shrink:0;margin-top:2px}
.rq{font-size:.88rem;font-weight:600;line-height:1.65;color:var(--text);flex:1}
.rimg{margin-bottom:12px;border-radius:10px;overflow:hidden;border:1.5px solid var(--b1)}
.rimg img{width:100%;max-height:200px;object-fit:contain;display:block;padding:7px;background:var(--bg2)}
.ropts{display:flex;flex-direction:column;gap:6px}
.ro{display:flex;align-items:flex-start;gap:9px;padding:9px 12px;border-radius:9px;
  font-size:.8rem;color:var(--t2);background:var(--bg2);border:1px solid var(--b1);font-weight:500}
.ro.cor{background:var(--correct-light);border-color:rgba(40,160,96,.3);color:var(--correct);font-weight:700}
.ro.wrg{background:var(--wrong-light);border-color:rgba(224,64,96,.25);color:var(--wrong);font-weight:700}
.ro-key{min-width:24px;height:24px;border-radius:6px;background:var(--bg3);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.66rem;flex-shrink:0;margin-top:1px}
.ro.cor .ro-key{background:var(--correct);color:#fff}
.ro.wrg .ro-key{background:var(--wrong);color:#fff}
.ro-badge{margin-left:auto;font-size:.58rem;font-weight:700;opacity:.9;white-space:nowrap;flex-shrink:0}
.r-expl{font-size:.76rem;color:var(--t2);margin-top:10px;padding:9px 12px;
  background:var(--lav-light);border:1px solid rgba(192,144,232,.2);border-radius:9px;line-height:1.6;font-weight:500}
.r-expl strong{color:var(--lavender);font-size:.61rem;letter-spacing:.07em;text-transform:uppercase;display:block;margin-bottom:3px;font-weight:700}
.r-no-ans{font-size:.68rem;color:var(--t3);font-style:italic;margin-top:8px;
  padding:7px 11px;background:var(--bg3);border-radius:7px;font-weight:500}
.book-wrap{max-width:720px;margin:0 auto}
.book-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
.book-hdr h2{font-family:'Playfair Display',serif;font-size:1.9rem;font-weight:700;color:var(--text)}
.book-count{font-size:.72rem;color:var(--pink);background:var(--pink-light);
  border:1.5px solid rgba(232,96,138,.25);padding:5px 12px;border-radius:99px;font-weight:700}
.bcard{background:var(--card);border:1.5px solid var(--b1);border-radius:var(--r3);
  padding:18px 16px;margin-bottom:10px;border-left:4px solid var(--pink);
  transition:all .2s;box-shadow:var(--shadow)}
.bcard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
.bq{font-size:.88rem;line-height:1.65;color:var(--text);flex:1;font-weight:600}
.unbook-btn{background:none;border:1.5px solid var(--b1);border-radius:7px;color:var(--t2);
  cursor:pointer;font-size:.7rem;padding:4px 10px;font-family:'Nunito',sans-serif;font-weight:700;
  transition:all .15s;white-space:nowrap;flex-shrink:0;-webkit-tap-highlight-color:transparent}
.unbook-btn:active{border-color:var(--wrong);color:var(--wrong)}
.bopts{display:flex;flex-direction:column;gap:5px}
.bopt{display:flex;align-items:flex-start;gap:8px;padding:7px 11px;border-radius:8px;
  font-size:.78rem;color:var(--t2);background:var(--bg2);border:1px solid var(--b1);font-weight:500}
.bopt-key{min-width:22px;height:22px;border-radius:5px;background:var(--bg3);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.64rem;
  flex-shrink:0;margin-top:1px}

/* ── SETTINGS ── */
.set-row{margin-bottom:18px}
.set-lbl{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t2);margin-bottom:8px;display:block}

/* ── RESPONSIVE BREAKPOINTS ── */

/* visibility helpers */
.desktop-only{display:block}
.mob-only{display:none}

/* Tablet */
@media(max-width:900px){
  .dgrid{grid-template-columns:1fr}
}

/* Mobile — full overhaul */
@media(max-width:600px){
  :root{--safe-bottom:max(20px,env(safe-area-inset-bottom))}
  .nav{display:none}
  .mob-topbar{display:flex}
  .bottom-nav{display:flex}
  .app{padding-bottom:0;background:var(--bg)}
  .page{padding:12px 12px calc(var(--safe-bottom) + 72px);max-width:100%}
  /* hide desktop-only on mobile, show mob-only */
  .desktop-only{display:none!important}
  .mob-only{display:block}

  /* Modals become full bottom sheets on mobile */
  .overlay{align-items:flex-end;padding:0}
  .modal{border-radius:22px 22px 0 0;padding:18px 16px calc(var(--safe-bottom) + 16px);
    max-height:96vh;max-width:100%;width:100%}

  /* Dashboard */
  .greeting{flex-direction:column;gap:8px}
  .greeting-left h1{font-size:1.65rem}
  .start-fab{width:100%;text-align:center}
  .stat-grid{grid-template-columns:repeat(2,1fr);gap:8px}
  .sc{padding:12px 10px}
  .sc-val{font-size:1.75rem}
  .sc-icon{font-size:1.1rem;margin-bottom:7px}
  .dgrid{grid-template-columns:1fr;gap:12px}
  .today{padding:14px 16px}
  .daily-note{padding:10px 12px;gap:9px;margin-bottom:14px}
  .daily-note-icon{font-size:1.2rem}
  .daily-note-text{font-size:.8rem}
  .panel{padding:16px 14px}

  /* Practice shell — full width, no centering */
  .pshell{align-items:stretch;gap:10px}
  .ptopbar{max-width:100%;width:100%}
  .timer-bar{max-width:100%;width:100%}
  .sstrip{max-width:100%;width:100%;gap:7px}
  .sstrip .ss{min-width:0;flex:1;padding:9px 6px}
  .ss .v{font-size:1.5rem}
  .ss .l{font-size:.56rem}

  /* Question card — full width */
  .qcard{max-width:100%;width:100%;padding:16px 14px;border-radius:18px}
  .qtext{font-size:.92rem;margin-bottom:16px}
  .qcard-top{margin-bottom:12px}
  .qtag{font-size:.56rem;padding:3px 9px}
  .opts{gap:8px}
  .opt{padding:11px 12px;gap:10px;border-radius:12px}
  .okey{min-width:28px;height:28px;font-size:.7rem;border-radius:8px}
  .otxt{font-size:.83rem}
  .anote{padding:10px 13px;font-size:.8rem}
  .love-feedback{font-size:.82rem}
  .nbtn{padding:13px;font-size:.88rem;margin-top:14px}

  /* Done / Ready screens — full width */
  .done-wrap{max-width:100%;width:100%;margin:16px auto 0;padding:28px 18px}
  .done-score{font-size:3.8rem}
  .done-wrap h2{font-size:1.9rem}
  .done-love{font-size:1rem}
  .done-acts{gap:8px}
  .done-acts .btn-primary,.done-acts .btn-sec{padding:10px 14px;font-size:.76rem}
  .ready-card{max-width:100%;width:100%;margin:16px auto 0;padding:28px 18px}
  .ready-card h2{font-size:1.7rem}

  /* Mistakes / Bookmarks */
  .rev-wrap,.book-wrap{max-width:100%}
  .rc{padding:14px 12px;margin-bottom:10px}
  .bcard{padding:12px 10px;margin-bottom:8px}
  .rev-hdr h2,.book-hdr h2{font-size:1.6rem}
  .rq,.bq{font-size:.84rem}
  .rev-filters{gap:5px;margin-bottom:14px}
  .rf{padding:5px 10px;font-size:.67rem}
  .ro{padding:8px 10px;font-size:.78rem}
  .ro-key{min-width:22px;height:22px;font-size:.64rem}
}

/* Very small phones */
@media(max-width:380px){
  .page{padding:10px 10px calc(var(--safe-bottom) + 72px)}
  .stat-grid{grid-template-columns:repeat(2,1fr);gap:6px}
  .sc{padding:10px 8px}
  .sc-val{font-size:1.55rem}
  .preset-grid{grid-template-columns:repeat(3,1fr)}
  .mode-toggle{gap:6px}
  .qcard{padding:14px 12px}
  .opt{padding:10px 10px;gap:8px}
  .sstrip{gap:5px}
  .sstrip .ss{padding:8px 4px}
  .ss .v{font-size:1.4rem}
}

/* ── MOBILE DASHBOARD EXTRAS ── */

/* Mood / motivation card (mob-only) */
.mood-card{
  background:linear-gradient(135deg,rgba(232,96,138,.12),rgba(192,144,232,.10));
  border:1.5px solid rgba(232,96,138,.2);border-radius:20px;
  padding:16px 18px;margin-bottom:14px;
  display:flex;align-items:center;gap:14px;
  position:relative;overflow:hidden;
}
.mood-card::after{content:'💗';position:absolute;right:14px;top:50%;
  transform:translateY(-50%);font-size:2.8rem;opacity:.1;pointer-events:none}
.mood-avatar{width:44px;height:44px;border-radius:14px;flex-shrink:0;
  background:linear-gradient(135deg,var(--pink),var(--lavender));
  display:flex;align-items:center;justify-content:center;font-size:1.4rem;
  box-shadow:0 4px 14px rgba(232,96,138,.3)}
.mood-text .mt{font-family:'Playfair Display',serif;font-size:.82rem;
  font-style:italic;color:var(--pink2);line-height:1.5}
.mood-text .ms{font-size:.65rem;color:var(--t3);margin-top:3px;font-weight:600}

/* Quick action row (mob-only) */
.quick-actions{display:flex;gap:9px;margin-bottom:14px}
.qa-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:12px 8px;border-radius:16px;border:1.5px solid var(--b1);
  background:var(--card);cursor:pointer;font-family:'Nunito',sans-serif;
  transition:all .18s;box-shadow:var(--shadow);-webkit-tap-highlight-color:transparent;
  touch-action:manipulation}
.qa-btn:active{transform:scale(.95);opacity:.85}
.qa-icon{font-size:1.4rem}
.qa-label{font-size:.62rem;font-weight:700;color:var(--t2)}
.qa-btn.primary-qa{background:linear-gradient(135deg,var(--pink),var(--pink2));
  border-color:transparent;box-shadow:0 6px 18px rgba(232,96,138,.3)}
.qa-btn.primary-qa .qa-label{color:rgba(255,255,255,.9)}

/* Mobile progress ring */
.mob-progress-row{display:flex;gap:10px;margin-bottom:14px}
.mob-prog-card{flex:1;background:var(--card);border:1.5px solid var(--b1);
  border-radius:16px;padding:14px 12px;text-align:center;box-shadow:var(--shadow)}
.mob-prog-big{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;line-height:1}
.mob-prog-lbl{font-size:.6rem;color:var(--t3);margin-top:3px;font-weight:600}
.mob-prog-bar{height:4px;background:var(--bg3);border-radius:99px;
  margin-top:8px;overflow:hidden}
.mob-prog-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.22,.68,0,1)}

/* Session resume banner (mob-only) */
.sess-banner{
  background:linear-gradient(135deg,rgba(48,180,160,.1),rgba(232,160,48,.08));
  border:1.5px solid rgba(48,180,160,.25);border-radius:16px;
  padding:14px 16px;margin-bottom:14px;
  display:flex;align-items:center;gap:12px;
}
.sess-banner-icon{font-size:1.5rem;flex-shrink:0}
.sess-banner-text .st{font-size:.82rem;font-weight:700;color:var(--text)}
.sess-banner-text .ss2{font-size:.68rem;color:var(--t2);margin-top:2px}
.sess-banner-btn{margin-left:auto;padding:8px 14px;border-radius:10px;border:none;
  background:var(--teal);color:#fff;font-family:'Nunito',sans-serif;
  font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;
  -webkit-tap-highlight-color:transparent}

/* Scrollbar */
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:var(--bg2)}
::-webkit-scrollbar-thumb{background:rgba(232,96,138,.2);border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:rgba(232,96,138,.4)}
`;



export default function App() {
  const allQ   = ALL_QUESTIONS;
  const totalQ = allQ.length;

  const qMap = useMemo(() => {
    const m = {};
    allQ.forEach(q => { m[q.id] = q; });
    return m;
  }, []);

  const [unified, setUnified] = useState(() => loadUnified());

  const patchUnified = useCallback((patch) => {
    setUnified(prev => {
      const next = { ...prev, ...patch };
      saveState(LS_V2, next);
      return next;
    });
  }, []);

  const att      = useMemo(() => deriveAtt(unified.attempts),     [unified.attempts]);
  const wrongIds = useMemo(() => deriveWrongIds(unified.attempts), [unified.attempts]);
  const hist     = useMemo(() => deriveHist(unified.attempts),     [unified.attempts]);
  const dayLog   = useMemo(() => deriveDayLog(unified.attempts),   [unified.attempts]);

  const activeSess = useMemo(() => {
    const sessions = unified.sessions || [];
    return sessions.find(s => s.poolIdx < (s.poolIds?.length || 0) && !(s.isMock && s.timeLeft === 0)) || null;
  }, [unified.sessions]);

  const sess       = activeSess;
  const sessIdx    = sess ? sess.poolIdx : 0;
  const sessPool   = sess ? sess.poolIds : [];
  const sessTotal  = sessPool.length;
  const currentQ   = sess && sessIdx < sessTotal ? qMap[sessPool[sessIdx]] || null : null;
  const sessDone   = sess ? sessPool.filter(id => att.has(id)).length : 0;
  const sessPct    = sessTotal ? Math.round((sessDone / sessTotal) * 100) : 0;
  const sessCorrect= sess?.correct || 0;
  const sessWrong  = sess?.wrong   || 0;
  const sessAcc    = (sessCorrect + sessWrong) > 0 ? Math.round((sessCorrect / (sessCorrect + sessWrong)) * 100) : 0;
  const isDone     = !!sess && (sessIdx >= sessTotal || (sess.isMock && sess.timeLeft === 0));
  const sessionActive = !!sess && !isDone;

  // ── Timer ──
  const [mockDone, setMockDone] = useState(false);
  const timerRef  = useRef(null);
  const sessIdRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!sess?.isMock || mockDone || !sessionActive) return;
    if (sess.timeLeft <= 0) { setMockDone(true); return; }
    sessIdRef.current = sess.id;
    timerRef.current = setInterval(() => {
      setUnified(prev => {
        const sessions = prev.sessions || [];
        const idx = sessions.findIndex(s => s.id === sess.id);
        if (idx === -1) return prev;
        const tl = (sessions[idx].timeLeft || 0) - 1;
        if (tl <= 0) { clearInterval(timerRef.current); timerRef.current = null; setMockDone(true); }
        const updated = [...sessions];
        updated[idx] = { ...updated[idx], timeLeft: Math.max(0, tl) };
        const next = { ...prev, sessions: updated };
        saveState(LS_V2, next);
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [sess?.id, sess?.isMock, mockDone, sessionActive]);

  // ── UI state ──
  const [tab,           setTab]          = useState("dashboard");
  const [sidebarOpen,   setSidebarOpen]  = useState(false);
  const [selected,      setSelected]     = useState(null);
  const [answered,      setAnswered]     = useState(false);
  const [loveFeedback,  setLoveFeedback] = useState("");
  const [showSetup,     setShowSetup]    = useState(false);
  const [showSettings,  setShowSettings] = useState(false);
  const [dayDetail,     setDayDetail]    = useState(null);
  const [wrongFilter,   setWrongFilter]  = useState("all");
  const [calDate,       setCalDate]      = useState(new Date());
  const [loveNote]                       = useState(() => rand(DAILY_NOTES));

  // Close sidebar when tab changes
  useEffect(() => { setSidebarOpen(false); }, [tab]);

  // Prevent body scroll when sidebar open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const freshCount  = allQ.filter(q => !att.has(q.id)).length;
  const presets     = getPresets(freshCount);
  const maxCount    = Math.min(Math.max(freshCount, wrongIds.size, 1), 100);
  const [setupCount,  setSetupCount]  = useState(() => Math.min(30, Math.max(1, freshCount || 1)));
  const [setupPreset, setSetupPreset] = useState(null);
  const [isMockMode,  setIsMockMode]  = useState(false);

  const handleSliderChange = useCallback((v) => {
    setSetupCount(v);
    const closest = presets.reduce((best, p) => Math.abs(p - v) < Math.abs(best - v) ? p : best, presets[0] || v);
    setSetupPreset(Math.abs(closest - v) <= 2 ? closest : null);
  }, [presets]);

  const handlePresetClick = useCallback((n) => { setSetupPreset(n); setSetupCount(n); }, []);

  const settings  = unified.settings || { userName: "" };
  const userName  = settings.userName || "";
  const setUserName = (name) => patchUnified({ settings: { ...settings, userName: name } });

  const totalCorrect = Object.values(hist).reduce((a, h) => a + (h.correct || 0), 0);
  const totalAllH    = Object.values(hist).reduce((a, h) => a + (h.total   || 0), 0);
  const overallAcc   = totalAllH ? Math.round((totalCorrect / totalAllH) * 100) : 0;

  const streak = useMemo(() => {
    let s = 0; const d = new Date();
    for (let i = 0; i < 730; i++) {
      const k = d.toISOString().slice(0, 10);
      if (!hist[k]) break;
      s++; d.setDate(d.getDate() - 1);
    }
    return s;
  }, [hist]);

  const topicStats = useMemo(() => {
    const stats = {};
    unified.attempts.forEach(a => {
      const q = qMap[a.qid];
      if (!q?.topic) return;
      if (!stats[q.topic]) stats[q.topic] = { correct: 0, wrong: 0, total: 0 };
      if (a.correct === true)  { stats[q.topic].correct++; stats[q.topic].total++; }
      if (a.correct === false) { stats[q.topic].wrong++;   stats[q.topic].total++; }
    });
    return stats;
  }, [unified.attempts, qMap]);

  const hr         = new Date().getHours();
  const greetWord  = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : "Good Evening";
  const greetEmoji = hr < 12 ? "🌅" : hr < 17 ? "☀️" : "🌙";
  const name1      = (userName || "").split(" ")[0];
  const mockTimeLeft = sess?.timeLeft || 0;
  const mockTimePct  = sess?.isMock ? Math.max(0, (mockTimeLeft / ((sessTotal || 1) * MOCK_SPQ)) * 100) : 0;
  const mockTimeFmt  = `${String(Math.floor(mockTimeLeft / 60)).padStart(2, "0")}:${String(mockTimeLeft % 60).padStart(2, "0")}`;
  const timerColor   = mockTimeLeft < 300 ? "var(--wrong)" : mockTimeLeft < 600 ? "var(--gold)" : "var(--teal)";

  const startSession = useCallback((count, mock) => {
    const ids = pickPool(allQ, att, wrongIds, count);
    if (!ids.length) return;
    const sessionId = `sess_${Date.now()}`;
    const newSess = {
      id: sessionId, date: todayStr(), correct: 0, wrong: 0,
      poolIds: ids, poolIdx: 0, isMock: !!mock,
      timeLeft: mock ? ids.length * MOCK_SPQ : null,
      target: count, mockAnswers: {},
    };
    patchUnified({ sessions: [newSess, ...(unified.sessions || []).slice(0, 9)], settings: { ...settings, userName } });
    setSelected(null); setAnswered(false); setMockDone(false); setLoveFeedback("");
    setShowSetup(false); setTab("practice");
  }, [allQ, att, wrongIds, unified.sessions, settings, userName, patchUnified]);

  const handleSelect = useCallback((key) => {
    if (answered || !currentQ || !sess) return;
    setSelected(key); setAnswered(true);
    const isCorrect = currentQ.answer ? key === currentQ.answer : null;
    if (isCorrect === true)  setLoveFeedback(rand(CORRECT_MSGS));
    else if (isCorrect === false) setLoveFeedback(rand(WRONG_MSGS));
    else setLoveFeedback("");
    const date = todayStr();
    setUnified(prev => {
      const attempts = [...prev.attempts, { qid: currentQ.id, selected: key, correct: isCorrect, date, sessionId: sess.id }];
      const sessions = (prev.sessions || []).map(s =>
        s.id !== sess.id ? s : { ...s, correct: s.correct + (isCorrect === true ? 1 : 0), wrong: s.wrong + (isCorrect === false ? 1 : 0), mockAnswers: { ...s.mockAnswers, [currentQ.id]: key } }
      );
      const wrongMap = { ...prev.wrongMap };
      if (isCorrect === false) wrongMap[currentQ.id] = key;
      else delete wrongMap[currentQ.id];
      const next = { ...prev, attempts, sessions, wrongMap };
      saveState(LS_V2, next);
      return next;
    });
  }, [answered, currentQ, sess]);

  const handleNext = useCallback(() => {
    if (!sess) return;
    const nextIdx = sess.poolIdx + 1;
    if (nextIdx >= sessTotal && sess.isMock) { setMockDone(true); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }
    setUnified(prev => {
      const sessions = (prev.sessions || []).map(s => s.id === sess.id ? { ...s, poolIdx: nextIdx } : s);
      const next = { ...prev, sessions };
      saveState(LS_V2, next);
      return next;
    });
    setSelected(null); setAnswered(false); setLoveFeedback("");
  }, [sess, sessTotal]);

  const bookmarks = useMemo(() => new Set(unified.bookmarks || []), [unified.bookmarks]);
  const toggleBookmark = useCallback((id) => {
    const nb = new Set(bookmarks);
    nb.has(id) ? nb.delete(id) : nb.add(id);
    patchUnified({ bookmarks: [...nb] });
  }, [bookmarks, patchUnified]);

  const handleReset = () => { localStorage.clear(); window.location.reload(); };

  const optClass = useCallback((key) => {
    if (!answered || !currentQ) return "";
    const ans = currentQ.answer;
    if (key === selected && ans && key === ans)  return "correct";
    if (key === selected && ans && key !== ans)  return "wrong";
    if (key !== selected && ans && key === ans)  return "reveal";
    return "";
  }, [answered, currentQ, selected]);

  const openDayDetail = (ds) => {
    const entries = dayLog[ds] || [];
    if (!entries.length) return;
    setDayDetail({ date: ds, entries });
  };

  // Calendar helpers
  const calY     = calDate.getFullYear();
  const calM2    = calDate.getMonth();
  const firstDay = new Date(calY, calM2, 1).getDay();
  const daysInM  = new Date(calY, calM2 + 1, 0).getDate();
  const todayD   = new Date();
  const calCls   = (ds) => { const h = hist[ds]; if (!h || !h.total) return ""; const a = h.correct / h.total; return a === 1 ? "hd perfect" : a >= 0.6 ? "hd good" : "hd low"; };
  const pipColor = (ds) => { const h = hist[ds]; if (!h || !h.total) return null; const a = h.correct / h.total; return a === 1 ? "var(--teal)" : a >= 0.6 ? "var(--gold)" : "var(--wrong)"; };
  // Sidebar calendar uses same helpers but with different classes
  const sCalCls  = (ds) => { const h = hist[ds]; if (!h || !h.total) return ""; const a = h.correct / h.total; return a === 1 ? "hd perf" : a >= 0.6 ? "hd good" : "hd low"; };

  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i); return d.toISOString().slice(0, 10);
  }), []);

  const wrongQ      = useMemo(() => allQ.filter(q => wrongIds.has(q.id)), [allQ, wrongIds]);
  const bookmarkedQ = useMemo(() => allQ.filter(q => bookmarks.has(q.id)), [allQ, bookmarks]);
  const wrongMap    = unified.wrongMap || {};
  const canRevise   = wrongIds.size > 0;

  const imgSrc = (path) => { if (!path) return null; return path.startsWith("/") ? path : "/" + path; };

  const startRevision = useCallback(() => {
    const ids = pickPool(allQ, new Set(), wrongIds, Math.min(wrongIds.size, 30));
    if (!ids.length) return;
    const sessionId = `sess_${Date.now()}`;
    patchUnified({ sessions: [{ id: sessionId, date: todayStr(), correct: 0, wrong: 0, poolIds: ids, poolIdx: 0, isMock: false, timeLeft: null, target: ids.length, mockAnswers: {} }, ...(unified.sessions || []).slice(0, 9)] });
    setShowSetup(false); setTab("practice");
    setSelected(null); setAnswered(false); setMockDone(false); setLoveFeedback("");
  }, [allQ, wrongIds, unified.sessions, patchUnified]);

  // CSS injection
  const styleRef = useRef(null);
  useEffect(() => {
    if (!styleRef.current) {
      const s = document.createElement("style"); s.textContent = CSS;
      document.head.appendChild(s); styleRef.current = s;
    }
  }, []);

  // ── Calendar JSX (reused in both desktop panel and sidebar) ──────────────
  const CalendarGrid = ({ compact = false }) => (
    <>
      <div className={compact ? "scal-nav" : "cal-nav-row"}>
        <button className={compact ? "scal-btn" : "cbtn"} onClick={() => setCalDate(new Date(calY, calM2-1, 1))}>‹</button>
        <span className={compact ? "scal-m" : "cal-m"}>{MONTHS[calM2]} {calY}</span>
        <button className={compact ? "scal-btn" : "cbtn"} onClick={() => setCalDate(new Date(calY, calM2+1, 1))}>›</button>
      </div>
      <div className={compact ? "scal-dn" : "cal-dn-row"}>
        {WDAYS.map(d => <span key={d} className={compact ? "" : "cal-dn"} style={compact?{fontSize:".5rem",color:"var(--t3)",textAlign:"center",fontWeight:700}:{}}>{d}</span>)}
      </div>
      <div className={compact ? "scal-grid" : "cal-grid"}>
        {Array.from({length: firstDay}, (_, i) => <div key={`e${i}`}/>)}
        {Array.from({length: daysInM}, (_, i) => {
          const day = i + 1;
          const ds  = `${calY}-${String(calM2+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isT = day===todayD.getDate() && calM2===todayD.getMonth() && calY===todayD.getFullYear();
          const h   = hist[ds];
          const pip = pipColor(ds);
          const hasLog = dayLog[ds]?.length > 0;
          if (compact) {
            const cls2 = !h||!h.total ? "" : h.correct/h.total===1?"perf":h.correct/h.total>=0.6?"good":"low";
            return (
              <div key={day} className={`scal-cell ${isT?"tc":""} ${cls2?"hd "+cls2:""}`}
                onClick={() => { if(hasLog){openDayDetail(ds);setSidebarOpen(false);}}}
                title={h?`${h.correct}✓ ${h.wrong}✗`:""}>
                <span>{day}</span>
                {pip && <span className="scal-pip" style={{background:pip}}/>}
              </div>
            );
          }
          return (
            <div key={day} className={`cc ${isT?"today-cell":""} ${calCls(ds)}`}
              onClick={() => hasLog && openDayDetail(ds)}
              title={h?`${h.correct}✓ ${h.wrong}✗ — click to view`:""}
              style={hasLog?{cursor:"pointer"}:{}}>
              <span className="cn">{day}</span>
              {pip && <span className="cpip" style={{background:pip}}/>}
            </div>
          );
        })}
      </div>
    </>
  );

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="bg-pattern"/>
      <div className="bg-dots"/>
      <FloatingHearts/>

      {/* ══ MOBILE SIDEBAR ══ */}
      {sidebarOpen && (
        <>
          <div className="sidebar-overlay" style={{display:"block"}} onClick={() => setSidebarOpen(false)}/>
          <div className="sidebar">
            {/* Header */}
            <div className="sidebar-head">
              <div className="logo">
                <div className="logo-heart">💗</div>
                <span className="logo-text">NORCET Prep</span>
              </div>
              <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
            </div>

            {/* Love note */}
            <div style={{padding:"12px 16px",borderBottom:"1px solid var(--b1)"}}>
              <div style={{fontSize:".78rem",fontStyle:"italic",color:"var(--pink2)",fontFamily:"'Playfair Display',serif",lineHeight:1.5}}>
                "{loveNote}"
              </div>
            </div>

            {/* Streak + nav */}
            <div className="sidebar-nav">
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px 14px",borderBottom:"1px solid var(--b1)",marginBottom:8}}>
                <span style={{fontSize:"1.2rem"}}>🔥</span>
                <div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.3rem",color:"var(--pink)",fontWeight:700}}>{streak}</div>
                  <div style={{fontSize:".6rem",color:"var(--t3)",fontWeight:600}}>Day Streak</div>
                </div>
                <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                  <button className="icon-btn" onClick={() => { setShowSettings(true); setSidebarOpen(false); }}>⚙</button>
                </div>
              </div>

              {[
                {id:"dashboard",icon:"🏠",label:"Home"},
                {id:"practice", icon:"📝",label:"Practice", badge: sessionActive&&!isDone ? `${sessDone}/${sessTotal}` : null},
                {id:"wrong",    icon:"❌",label:"Mistakes",  badge: wrongIds.size > 0 ? wrongIds.size : null},
                {id:"bookmarks",icon:"🔖",label:"Saved",     badge: bookmarks.size > 0 ? bookmarks.size : null},
              ].map(({id,icon,label,badge}) => (
                <button key={id} className={`snav-item ${tab===id?"on":""}`} onClick={() => { setTab(id); setSidebarOpen(false); }}>
                  <span className="snav-icon">{icon}</span>
                  <span className="snav-label">{label}</span>
                  {badge && <span className="snav-badge">{badge}</span>}
                </button>
              ))}

              <button className="snav-item" style={{marginTop:6}} onClick={() => { setShowSetup(true); setSidebarOpen(false); }}>
                <span className="snav-icon">✨</span>
                <span className="snav-label">New Session</span>
              </button>
            </div>

            {/* Mini stats */}
            <div className="sidebar-stats">
              {[
                {l:"Done",    v:`${att.size}/${totalQ}`, c:"var(--pink)"},
                {l:"Accuracy",v:`${overallAcc}%`,        c:"var(--teal)"},
                {l:"Mistakes",v:wrongIds.size,            c:"var(--wrong)"},
                {l:"Saved",   v:bookmarks.size,           c:"var(--lavender)"},
              ].map(({l,v,c}) => (
                <div className="sstat" key={l}>
                  <div className="sv" style={{color:c}}>{v}</div>
                  <div className="sl">{l}</div>
                </div>
              ))}
            </div>

            {/* Compact calendar */}
            <div className="sidebar-cal">
              <div className="ptitle">📅 Activity</div>
              <CalendarGrid compact={true}/>
              <div style={{display:"flex",gap:10,marginTop:8,flexWrap:"wrap"}}>
                {[["var(--teal)","Perfect"],["var(--gold)","≥60%"],["var(--wrong)","<60%"]].map(([c,l]) => (
                  <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:".56rem",color:"var(--t3)",fontWeight:600}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:c,display:"inline-block"}}/>
                    {l}
                  </div>
                ))}
              </div>
              <div style={{fontSize:".6rem",color:"var(--t3)",marginTop:6,fontStyle:"italic"}}>Tap a day to review</div>
            </div>

            {/* Footer */}
            <div className="sidebar-footer">
              <div className="sfooter-note">You've got this, my love 💕</div>
            </div>
          </div>
        </>
      )}

      {/* ══ SETUP MODAL ══ */}
      {showSetup && (
        <div className="overlay" onClick={e => e.target===e.currentTarget && setShowSetup(false)}>
          <div className="modal">
            <div className="modal-hd">
              <div className="modal-icon">💖</div>
              <h2>Start a Session</h2>
              {freshCount > 0
                ? <p><strong>{freshCount}</strong> fresh questions ready, my love 🌸</p>
                : canRevise
                  ? <p>No fresh questions — but <strong>{wrongIds.size}</strong> mistakes to revise! 💪</p>
                  : <p>All questions completed! You're amazing 🏆</p>}
            </div>
            {!settings.userName && (
              <><label className="field-label">Your Name</label>
              <input className="text-input" placeholder="e.g. Priya 💕" value={userName} onChange={e => setUserName(e.target.value)}/></>
            )}
            {freshCount === 0 && (
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {canRevise && <button className="go-btn" onClick={startRevision}>🔁 Revise {wrongIds.size} Mistakes</button>}
                <button className="go-btn" style={{background:"linear-gradient(135deg,var(--lavender),var(--teal))"}} onClick={handleReset}>🔄 Reset All & Start Fresh</button>
              </div>
            )}
            {freshCount > 0 && (
              <>
                <label className="field-label">Mode</label>
                <div className="mode-toggle">
                  <button className={`mmode ${!isMockMode?"on":""}`} onClick={() => setIsMockMode(false)}>
                    <span className="mmode-icon">📚</span><span className="mmode-l">Practice</span>
                    <span className="mmode-sub">Your pace, my love</span>
                  </button>
                  <button className={`mmode ${isMockMode?"mock-on":""}`} onClick={() => setIsMockMode(true)}>
                    <span className="mmode-icon">⏱</span><span className="mmode-l">Mock Exam</span>
                    <span className="mmode-sub">Timed like real NORCET</span>
                  </button>
                </div>
                <label className="field-label">How many questions?</label>
                <div className="preset-grid">
                  {presets.map(n => {
                    const labels = {10:"Quick",25:"Regular",50:"Standard",75:"Extended",100:"Full Exam"};
                    return (
                      <button key={n} className={`pchip ${setupPreset===n?"on":""}`} disabled={n>maxCount}
                        onClick={() => handlePresetClick(n)}>
                        <span className="pchip-n">{n}</span>
                        <span className="pchip-l">{labels[n]||"Custom"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="slider-row">
                  <input type="range" className="range" min="1" max={Math.max(maxCount,1)} value={setupCount}
                    style={{"--p":maxCount>1?`${((setupCount-1)/(maxCount-1))*100}%`:"0%"}}
                    onChange={e => handleSliderChange(Number(e.target.value))}/>
                  <div className="range-val">{setupCount}</div>
                </div>
                <div className="range-note">
                  {isMockMode && `⏱ ${Math.floor(setupCount*MOCK_SPQ/60)} min · `}
                  {freshCount} fresh · {wrongIds.size} to revise · Max 100
                </div>
                <div className="avail-bar"><strong>{freshCount}</strong>&nbsp;fresh · {att.size} done · {totalQ} total</div>
                <button className="go-btn"
                  onClick={() => { if (userName) patchUnified({settings:{...settings,userName}}); startSession(setupCount,isMockMode); }}>
                  {isMockMode ? `Start ${setupCount}Q Mock Exam ⏱` : `Let's go! ${setupCount} questions 💪`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ SETTINGS MODAL ══ */}
      {showSettings && (
        <div className="overlay" onClick={e => e.target===e.currentTarget && setShowSettings(false)}>
          <div className="modal">
            <div className="modal-hd"><div className="modal-icon">⚙️</div><h2>Settings</h2></div>
            <div className="set-row">
              <label className="set-lbl">Name</label>
              <input className="text-input" placeholder="Enter name" value={userName} onChange={e => setUserName(e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:22}}>
              {[{l:"Done",v:`${att.size}/${totalQ}`,c:"var(--pink)"},{l:"Accuracy",v:`${overallAcc}%`,c:"var(--teal)"},
                {l:"Streak",v:`${streak}d`,c:"var(--gold)"},{l:"Saved",v:bookmarks.size,c:"var(--lavender)"}
              ].map(({l,v,c}) => (
                <div key={l} style={{flex:1,background:"var(--bg2)",border:"1.5px solid var(--b1)",borderRadius:12,padding:"12px 14px",minWidth:80}}>
                  <div style={{fontSize:".62rem",color:"var(--t3)",marginBottom:3,fontWeight:700}}>{l}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:c,fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>
            <button className="go-btn" style={{marginBottom:10}} onClick={() => { patchUnified({settings:{...settings,userName}}); setShowSettings(false); }}>Save 💕</button>
            <div style={{borderTop:"1.5px solid var(--b1)",paddingTop:16,marginTop:4}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--wrong)",marginBottom:10}}>Danger Zone</div>
              <button className="btn-danger" style={{width:"100%"}} onClick={handleReset}>🗑 Reset All Progress</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DAY DETAIL MODAL ══ */}
      {dayDetail && (
        <div className="overlay" onClick={e => e.target===e.currentTarget && setDayDetail(null)}>
          <div className="modal day-modal">
            <div className="day-modal-hd">
              <h3>📅 {new Date(dayDetail.date+"T00:00").toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric"})}</h3>
              <button className="icon-btn" onClick={() => setDayDetail(null)}>✕</button>
            </div>
            {(() => {
              const h = hist[dayDetail.date]||{correct:0,wrong:0,total:0};
              const acc = h.total ? Math.round((h.correct/h.total)*100) : 0;
              return (
                <div className="day-stats">
                  {[{l:"Attempted",v:h.total,c:"var(--pink)"},{l:"Correct",v:h.correct,c:"var(--correct)"},
                    {l:"Wrong",v:h.wrong,c:"var(--wrong)"},{l:"Accuracy",v:`${acc}%`,c:"var(--teal)"}
                  ].map(({l,v,c}) => (
                    <div className="day-stat" key={l}><div className="dv" style={{color:c}}>{v}</div><div className="dl">{l}</div></div>
                  ))}
                </div>
              );
            })()}
            <div className="ptitle">Questions from this day</div>
            <div className="day-q-list">
              {dayDetail.entries.map((entry, i) => {
                const q = qMap[entry.qid]; if (!q) return null;
                return (
                  <div className="day-q-card" key={entry.qid}>
                    <div className="day-q-num">Question {i+1}{q.topic?` · ${q.topic}`:""}</div>
                    <div className="day-q-text">{q.question}</div>
                    {q.image && <div className="rimg" style={{marginBottom:10}}><img src={imgSrc(q.image)} alt="Q" onError={e=>{e.target.style.display="none"}}/></div>}
                    <div className="day-opts">
                      {["A","B","C","D"].map(key => {
                        if (!q.options[key]) return null;
                        const isCor    = q.answer && key===q.answer;
                        const isMyWrong= key===entry.myAnswer && key!==q.answer;
                        const isMyRight= key===entry.myAnswer && key===q.answer;
                        return (
                          <div key={key} className={`day-opt ${isCor&&!isMyRight?"is-correct":""} ${isMyRight?"is-mine-right":""} ${isMyWrong?"is-wrong":""}`}>
                            <span className="day-opt-key">{key}</span>
                            <span style={{flex:1}}>{q.options[key]}</span>
                            {isCor&&!isMyRight && <span className="day-opt-badge">✓ Correct</span>}
                            {isMyRight         && <span className="day-opt-badge">✓ Yours</span>}
                            {isMyWrong         && <span className="day-opt-badge">✗ Yours</span>}
                          </div>
                        );
                      })}
                    </div>
                    {!q.answer && <div className="day-no-ans">ℹ️ No answer key</div>}
                    {q.explanation && <div className="day-expl"><strong>💡 Explanation</strong>{q.explanation}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ DESKTOP NAV ══ */}
      <nav className="nav">
        <div className="logo">
          <div className="logo-heart">💗</div>
          <span className="logo-text">NORCET Prep</span>
        </div>
        <div className="nav-tabs">
          {[["dashboard","Dashboard"],["practice","Practice"],["wrong","Mistakes"],["bookmarks","Bookmarks"]].map(([id,lbl])=>(
            <button key={id} className={`ntab ${tab===id?"on":""}`} onClick={()=>setTab(id)}>{lbl}</button>
          ))}
        </div>
        <div className="nav-end">
          <div className="streak-chip">🔥 {streak} day{streak!==1?"s":""}</div>
          <button className="icon-btn" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
      </nav>

      {/* ══ MOBILE TOP BAR ══ */}
      <div className="mob-topbar">
        <button className="mob-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
        <div className="logo">
          <div className="logo-heart">💗</div>
          <span className="logo-text">NORCET Prep</span>
        </div>
        <div className="mob-streak">🔥 {streak}d</div>
      </div>

      {/* ══ DASHBOARD ══ */}
      {tab==="dashboard" && (
        <div className="page">
          <div className="daily-note desktop-only">
            <div className="daily-note-icon">💌</div>
            <div className="daily-note-text">"{loveNote}"</div>
          </div>
          <div className="greeting desktop-only">
            <div className="greeting-left">
              <h1>{greetEmoji} {greetWord}{name1?`, ${name1}`:""} 💗</h1>
              <p>Your NORCET prep · {totalQ} questions · {freshCount} remaining</p>
            </div>
            <button className="start-fab" onClick={() => setShowSetup(true)}>+ New Session 💕</button>
          </div>

          {/* Mobile compact header */}
          <div className="mob-only" style={{marginBottom:12}}>
            <div className="mood-card">
              <div className="mood-avatar">💌</div>
              <div className="mood-text">
                <div className="mt">"{loveNote}"</div>
                <div className="ms">{greetEmoji} {greetWord}{name1?`, ${name1}`:""}</div>
              </div>
            </div>
          </div>

          <div className="stat-grid desktop-only">
            {[
              {icon:"📚",val:att.size,       lbl:"Attempted",   sub:`of ${totalQ} total`,   a:"linear-gradient(90deg,#e8608a,#c84070)"},
              {icon:"✅",val:totalCorrect,    lbl:"Correct",     sub:`${overallAcc}% accuracy`,a:"linear-gradient(90deg,#28a060,#208050)"},
              {icon:"❌",val:wrongIds.size,   lbl:"Need Review", sub:"tap Mistakes tab",      a:"linear-gradient(90deg,#e04060,#c03050)"},
              {icon:"🎯",val:`${overallAcc}%`,lbl:"Accuracy",    sub:"all time",              a:"linear-gradient(90deg,#c090e8,#9060c8)"},
              {icon:"📖",val:freshCount,      lbl:"Remaining",   sub:"unattempted",           a:"linear-gradient(90deg,#30b4a0,#209880)"},
              {icon:"🔥",val:streak,          lbl:"Day Streak",  sub:"keep it up!",           a:"linear-gradient(90deg,#e8a030,#c88020)"},
            ].map(({icon,val,lbl,sub,a}) => (
              <div className="sc" key={lbl} style={{"--a":a}}>
                <div className="sc-icon">{icon}</div>
                <div className="sc-val">{val}</div>
                <div className="sc-lbl">{lbl}</div>
                <div className="sc-sub">{sub}</div>
              </div>
            ))}
          </div>

          {Object.keys(topicStats).length > 0 && (
            <div className="panel desktop-only" style={{marginBottom:20}}>
              <div className="ptitle">📚 Topic Performance</div>
              {Object.entries(topicStats).map(([topic, s]) => {
                const acc = s.total ? Math.round((s.correct/s.total)*100) : 0;
                return (
                  <div className="arow" key={topic}>
                    <div className="aday" style={{minWidth:90,fontSize:".7rem"}}>{topic}</div>
                    <div className="atrack"><div className="afill" style={{width:`${acc}%`,background:acc>=80?"var(--teal)":acc>=50?"var(--gold)":"var(--wrong)"}}/></div>
                    <div className="apct">{acc}%</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="today desktop-only">
            <div className="today-row">
              <div>
                <div className="today-tag">{sessionActive&&!isDone?"⚡ Active Session":isDone?"✅ Completed":"📋 No Session Yet"}</div>
                <div className="today-title">
                  {sessionActive?isDone?`Done — ${sessCorrect}/${sessPool.length} correct`:`${sessDone}/${sessTotal} done${sess?.isMock?" · MOCK ⏱":""}`:
                  "Ready to study, my love? 💕"}
                </div>
                <div className="today-sub">
                  {sessionActive?`${sessCorrect} correct · ${sessWrong} wrong${sessAcc>0?` · ${sessAcc}%`:""}`:
                  "Choose 1–100 questions"}
                </div>
              </div>
              <div className="today-btns">
                {sessionActive&&!isDone&&<button className="btn-sec" onClick={()=>setTab("practice")}>Continue →</button>}
                <button className="btn-primary" onClick={()=>setShowSetup(true)}>
                  {sessionActive&&!isDone?"New Session":"Start Session 💪"}
                </button>
              </div>
            </div>
            {sessionActive&&!isDone&&sessTotal>0&&(
              <div className="today-pbar"><div className="today-pfill" style={{width:`${sessPct}%`}}/></div>
            )}
          </div>

          {/* Desktop: 2-col grid with calendar. Mobile: calendar is in sidebar */}
          <div className="dgrid desktop-only">
            <div className="panel">
              <div className="ptitle">📅 Activity Calendar</div>
              <CalendarGrid compact={false}/>
              <div className="cal-leg">
                {[["var(--teal)","Perfect"],["var(--gold)","≥60%"],["var(--wrong)","<60%"]].map(([c,l]) => (
                  <div className="cleg" key={l}><span className="cleg-d" style={{background:c}}/>{l}</div>
                ))}
              </div>
              <div className="cal-hint">💡 Tap any colored day to review questions</div>
            </div>
            <div>
              <div className="panel">
                <div className="ptitle">📊 Last 7 Days</div>
                {last7.map(ds => {
                  const h = hist[ds]||{correct:0,wrong:0,total:0};
                  const acc = h.total?Math.round((h.correct/h.total)*100):0;
                  const wd = new Date(ds+"T00:00").toLocaleDateString("en",{weekday:"short"});
                  return (
                    <div className="arow" key={ds}>
                      <div className="aday">{wd}</div>
                      <div className="atrack"><div className="afill" style={{width:h.total?`${acc}%`:"0%",background:acc>=80?"var(--teal)":acc>=50?"var(--gold)":acc>0?"var(--wrong)":"transparent"}}/></div>
                      <div className="apct">{h.total?`${acc}%`:"–"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="panel" style={{marginTop:16}}>
                <div className="ptitle">🕐 Recent Sessions</div>
                <div className="rlist">
                  {Object.entries(hist).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6).map(([ds,h]) => {
                    const acc = h.total?Math.round((h.correct/h.total)*100):0;
                    const bc  = acc>=80?"rb-g":acc>=50?"rb-o":"rb-r";
                    const bl  = acc>=80?"Great! 💕":acc>=50?"Good 👍":"Keep going 💪";
                    const col = acc>=80?"var(--teal)":acc>=50?"var(--gold)":"var(--wrong)";
                    return (
                      <div className="ri" key={ds}>
                        <div className="ri-dot" style={{background:col}}/>
                        <div className="ri-date">{new Date(ds+"T00:00").toLocaleDateString("en",{month:"short",day:"numeric"})}</div>
                        <div className="ri-score">{h.correct}/{h.total} correct</div>
                        <div className={`ri-badge ${bc}`}>{bl}</div>
                      </div>
                    );
                  })}
                  {!Object.keys(hist).length && (
                    <div style={{color:"var(--t3)",fontSize:".76rem",textAlign:"center",padding:"16px 0",fontWeight:500}}>Start your first session 💕</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── MOBILE DASHBOARD (calendar hidden, clean layout) ── */}
          <div className="mob-only">

            {/* Session resume banner */}
            {sessionActive && !isDone && (
              <div className="sess-banner">
                <span className="sess-banner-icon">⚡</span>
                <div className="sess-banner-text">
                  <div className="st">Session in progress</div>
                  <div className="ss2">{sessDone}/{sessTotal} done · {sessAcc>0?`${sessAcc}% accuracy`:"just started"}</div>
                </div>
                <button className="sess-banner-btn" onClick={()=>setTab("practice")}>Continue →</button>
              </div>
            )}

            {/* Quick action buttons */}
            <div className="quick-actions">
              <button className="qa-btn primary-qa" onClick={()=>setShowSetup(true)}>
                <span className="qa-icon">✨</span>
                <span className="qa-label" style={{color:"#fff"}}>New Session</span>
              </button>
              <button className="qa-btn" onClick={()=>setTab("wrong")} style={{borderColor:wrongIds.size>0?"rgba(224,64,96,.25)":"var(--b1)"}}>
                <span className="qa-icon">❌</span>
                <span className="qa-label" style={{color:wrongIds.size>0?"var(--wrong)":"var(--t2)"}}>
                  {wrongIds.size>0?`${wrongIds.size} Mistakes`:"Mistakes"}
                </span>
              </button>
              <button className="qa-btn" onClick={()=>setTab("bookmarks")}>
                <span className="qa-icon">🔖</span>
                <span className="qa-label">Saved{bookmarks.size>0?` (${bookmarks.size})`:""}</span>
              </button>
              <button className="qa-btn" onClick={()=>setSidebarOpen(true)}>
                <span className="qa-icon">📅</span>
                <span className="qa-label">Calendar</span>
              </button>
            </div>

            {/* Progress cards row */}
            <div className="mob-progress-row">
              <div className="mob-prog-card">
                <div className="mob-prog-big" style={{color:"var(--pink)"}}>{att.size}</div>
                <div className="mob-prog-lbl">of {totalQ} done</div>
                <div className="mob-prog-bar">
                  <div className="mob-prog-fill" style={{width:`${totalQ>0?Math.round((att.size/totalQ)*100):0}%`,background:"linear-gradient(90deg,var(--pink),var(--lavender))"}}/>
                </div>
              </div>
              <div className="mob-prog-card">
                <div className="mob-prog-big" style={{color:"var(--correct)"}}>{overallAcc}%</div>
                <div className="mob-prog-lbl">accuracy</div>
                <div className="mob-prog-bar">
                  <div className="mob-prog-fill" style={{width:`${overallAcc}%`,background:"linear-gradient(90deg,var(--correct),var(--teal))"}}/>
                </div>
              </div>
              <div className="mob-prog-card">
                <div className="mob-prog-big" style={{color:"var(--gold)"}}>{streak}</div>
                <div className="mob-prog-lbl">day streak 🔥</div>
                <div className="mob-prog-bar">
                  <div className="mob-prog-fill" style={{width:`${Math.min(streak*10,100)}%`,background:"linear-gradient(90deg,var(--gold),var(--rose))"}}/>
                </div>
              </div>
            </div>

            {/* Last 7 days — compact on mobile */}
            <div className="panel" style={{marginBottom:12}}>
              <div className="ptitle">📊 Last 7 Days</div>
              {last7.map(ds => {
                const h = hist[ds]||{correct:0,wrong:0,total:0};
                const acc = h.total?Math.round((h.correct/h.total)*100):0;
                const wd = new Date(ds+"T00:00").toLocaleDateString("en",{weekday:"short"});
                return (
                  <div className="arow" key={ds}>
                    <div className="aday">{wd}</div>
                    <div className="atrack"><div className="afill" style={{width:h.total?`${acc}%`:"0%",background:acc>=80?"var(--teal)":acc>=50?"var(--gold)":acc>0?"var(--wrong)":"transparent"}}/></div>
                    <div className="apct">{h.total?`${acc}%`:"–"}</div>
                  </div>
                );
              })}
              <div style={{fontSize:".65rem",color:"var(--t3)",marginTop:10,fontStyle:"italic",textAlign:"center"}}>
                💡 Open ☰ menu to view full calendar
              </div>
            </div>

            {/* Recent sessions compact */}
            {Object.keys(hist).length > 0 && (
              <div className="panel">
                <div className="ptitle">🕐 Recent Sessions</div>
                <div className="rlist">
                  {Object.entries(hist).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,4).map(([ds,h]) => {
                    const acc = h.total?Math.round((h.correct/h.total)*100):0;
                    const bc  = acc>=80?"rb-g":acc>=50?"rb-o":"rb-r";
                    const bl  = acc>=80?"Great! 💕":acc>=50?"Good 👍":"Keep going 💪";
                    const col = acc>=80?"var(--teal)":acc>=50?"var(--gold)":"var(--wrong)";
                    return (
                      <div className="ri" key={ds}>
                        <div className="ri-dot" style={{background:col}}/>
                        <div className="ri-date">{new Date(ds+"T00:00").toLocaleDateString("en",{month:"short",day:"numeric"})}</div>
                        <div className="ri-score">{h.correct}/{h.total} correct</div>
                        <div className={`ri-badge ${bc}`}>{bl}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ PRACTICE ══ */}
      {tab==="practice" && (
        <div className="page">
          <div className="pshell">
            {!sess && (
              <div className="ready-card">
                <div style={{fontSize:"3.2rem",marginBottom:8}}>💕</div>
                <h2>Ready to Practice?</h2>
                {freshCount>0?<p>I believe in you! Choose your questions 💪</p>
                  :canRevise?<p>No fresh questions, but <strong>{wrongIds.size}</strong> mistakes to master! 💪</p>
                  :<p>You've completed everything! Reset to start again 🌸</p>}
                <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
                  <button className="go-btn" onClick={()=>setShowSetup(true)}>
                    {freshCount>0?"Choose Questions →":canRevise?"Revise Mistakes →":"Open Setup →"}
                  </button>
                  {freshCount===0&&canRevise&&(
                    <button className="go-btn" style={{background:"linear-gradient(135deg,var(--lavender),var(--teal))"}} onClick={startRevision}>
                      🔁 Quick Revision — {Math.min(wrongIds.size,30)} mistakes
                    </button>
                  )}
                </div>
              </div>
            )}

            {isDone && (
              <div className="done-wrap">
                <span className="done-emoji">{sessAcc===100?"🏆":sessAcc>=80?"🌟":"💖"}</span>
                <h2>{sess?.isMock?"Mock Exam Done!":"Session Complete!"}</h2>
                <div className="done-score">{sessCorrect}/{sessTotal}</div>
                <div className="done-acc-pill" style={{
                  background:sessAcc>=80?"var(--correct-light)":sessAcc>=50?"var(--gold-light)":"var(--wrong-light)",
                  color:sessAcc>=80?"var(--correct)":sessAcc>=50?"var(--gold)":"var(--wrong)",
                  border:`1.5px solid ${sessAcc>=80?"rgba(40,160,96,.3)":sessAcc>=50?"rgba(232,160,48,.3)":"rgba(224,64,96,.3)"}`
                }}>{sessAcc}% Accuracy{sessAcc===100?" 🏆":sessAcc>=80?" 🌟":""}</div>
                <div className="done-love">{rand(DONE_MSGS)}</div>
                <p>{sessCorrect} correct · {sessWrong} wrong<br/>{att.size} of {totalQ} total done</p>
                <div className="done-acts">
                  <button className="btn-primary" onClick={()=>setShowSetup(true)}>New Session 💕</button>
                  <button className="btn-sec" onClick={()=>setTab("dashboard")}>Dashboard</button>
                  {wrongIds.size>0&&<button className="btn-sec" onClick={()=>setTab("wrong")}>Mistakes</button>}
                </div>
              </div>
            )}

            {sessionActive&&!isDone&&currentQ&&(
              <>
                {sess?.isMock&&(
                  <div className="timer-bar" style={{maxWidth:680,width:"100%"}}>
                    <span style={{fontSize:".7rem",color:"var(--t2)",fontWeight:700}}>⏱ Mock</span>
                    <div className="timer-track"><div className="timer-fill" style={{width:`${mockTimePct}%`,background:timerColor}}/></div>
                    <div className="timer-label" style={{color:timerColor}}>{mockTimeFmt}</div>
                  </div>
                )}
                <div className="ptopbar">
                  <div className="p-qinfo">Q{sessIdx+1}/{sessTotal}</div>
                  <div className="p-track"><div className="p-fill" style={{width:`${sessPct}%`}}/></div>
                  <div className="p-acc">{sessAcc>0?`${sessAcc}%`:"–"}</div>
                </div>
                <div className="qcard" key={`${sessIdx}-${currentQ.id}`}>
                  <div className="qcard-top">
                    <div className={`qtag ${sess?.isMock?"mock-qtag":""}`}>{sess?.isMock?"⏱ Mock":"Practice"} · Q{sessIdx+1}/{sessTotal}</div>
                    <div className="qmeta">
                      {currentQ.topic&&<div className="img-chip" style={{color:"var(--lavender)",background:"var(--lav-light)",borderColor:"rgba(192,144,232,.25)"}}>{currentQ.topic}</div>}
                      {currentQ.image&&<div className="img-chip">🖼 Image</div>}
                      {!currentQ.answer&&<div className="no-ans-chip">No key</div>}
                      <button className="book-btn" onClick={()=>toggleBookmark(currentQ.id)}>
                        {bookmarks.has(currentQ.id)?"🔖":"🏷"}
                      </button>
                    </div>
                  </div>
                  <div className="qtext">{currentQ.question}</div>
                  {currentQ.image&&(
                    <div className="qimg">
                      <img src={imgSrc(currentQ.image)} alt="Question" onError={e=>{e.target.parentElement.style.display="none"}}/>
                      <div className="qimg-cap">Refer to the image above</div>
                    </div>
                  )}
                  <div className="opts">
                    {["A","B","C","D"].map(key=>currentQ.options[key]?(
                      <button key={key} className={`opt ${optClass(key)}`} disabled={answered} onClick={()=>handleSelect(key)}>
                        <span className="okey">{key}</span>
                        <span className="otxt">{currentQ.options[key]}</span>
                      </button>
                    ):null)}
                  </div>
                  {answered&&(
                    <div className={`anote ${!currentQ.answer?"na":selected===currentQ.answer?"ok":"err"}`}>
                      {!currentQ.answer?"ℹ️ No answer key."
                        :selected===currentQ.answer?"✅ Correct!"
                        :`❌ Incorrect — Answer: ${currentQ.answer}) ${currentQ.options[currentQ.answer]}`}
                    </div>
                  )}
                  {answered&&loveFeedback&&<div className="love-feedback">{loveFeedback}</div>}
                  {answered&&currentQ.explanation&&(
                    <div className="explanation"><strong>💡 Explanation</strong>{currentQ.explanation}</div>
                  )}
                  {answered&&(
                    <button className="nbtn" onClick={handleNext}>
                      {sessIdx+1>=sessTotal?"Finish Session 🌸":"Next Question →"}
                    </button>
                  )}
                </div>
                <div className="sstrip">
                  <div className="ss vc"><div className="v">{sessCorrect}</div><div className="l">Correct</div></div>
                  <div className="ss vw"><div className="v">{sessWrong}</div><div className="l">Wrong</div></div>
                  <div className="ss"><div className="v" style={{color:"var(--text)"}}>{sessTotal-sessDone}</div><div className="l">Left</div></div>
                  <div className="ss vt"><div className="v">{sessAcc>0?`${sessAcc}%`:"–"}</div><div className="l">Accuracy</div></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ MISTAKES ══ */}
      {tab==="wrong" && (
        <div className="page">
          <div className="rev-wrap">
            <div className="rev-hdr">
              <h2>Mistakes to Review</h2>
              <div className="rev-count">{wrongQ.length} questions</div>
            </div>
            <div className="rev-filters">
              {[["all","All"],["img","With Images"],["no-ans","No Key"],["has-ans","Has Key"]].map(([f,l])=>(
                <button key={f} className={`rf ${wrongFilter===f?"on":""}`} onClick={()=>setWrongFilter(f)}>{l}</button>
              ))}
            </div>
            {wrongQ.length===0?(
              <div className="rev-empty"><div className="e-icon">🏆</div><h3>No Mistakes Yet!</h3><p>You're doing amazing! 💕</p></div>
            ):wrongQ.filter(q=>{
              if(wrongFilter==="img")return!!q.image;
              if(wrongFilter==="no-ans")return!q.answer;
              if(wrongFilter==="has-ans")return!!q.answer;
              return true;
            }).map((q,i)=>{
              const myW=wrongMap[q.id];
              return(
                <div className="rc" key={q.id}>
                  <div className="rc-top"><div className="rq">{q.question}</div><div className="rc-num">#{i+1}</div></div>
                  {q.image&&<div className="rimg"><img src={imgSrc(q.image)} alt="Q" onError={e=>{e.target.parentElement.style.display="none"}}/></div>}
                  <div className="ropts">
                    {["A","B","C","D"].map(key=>{
                      if(!q.options[key])return null;
                      const isCor=q.answer&&key===q.answer;
                      const isWrg=key===myW&&key!==q.answer;
                      return(
                        <div key={key} className={`ro ${isCor?"cor":""} ${isWrg?"wrg":""}`}>
                          <span className="ro-key">{key}</span>
                          <span style={{flex:1,lineHeight:1.5}}>{q.options[key]}</span>
                          {isCor&&<span className="ro-badge">✓ Correct</span>}
                          {isWrg&&<span className="ro-badge">✗ Yours</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation&&<div className="r-expl"><strong>💡 Explanation</strong>{q.explanation}</div>}
                  {!q.answer&&<div className="r-no-ans">ℹ️ No answer key</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ BOOKMARKS ══ */}
      {tab==="bookmarks" && (
        <div className="page">
          <div className="book-wrap">
            <div className="book-hdr">
              <h2>Saved Questions</h2>
              <div className="book-count">{bookmarkedQ.length} bookmarked 🔖</div>
            </div>
            <p style={{fontSize:".8rem",color:"var(--t2)",marginBottom:18,fontWeight:500}}>
              💡 Answers are hidden here — use this for self-testing.
            </p>
            {bookmarkedQ.length===0?(
              <div className="rev-empty"><div className="e-icon">🔖</div><h3>No Bookmarks Yet</h3><p>Tap 🏷 on any question to save it here.</p></div>
            ):bookmarkedQ.map((q,i)=>(
              <div className="bcard" key={q.id}>
                <div className="bcard-top">
                  <div className="bq">{i+1}. {q.question}</div>
                  <button className="unbook-btn" onClick={()=>toggleBookmark(q.id)}>Remove</button>
                </div>
                {q.image&&<div className="rimg" style={{marginBottom:10}}><img src={imgSrc(q.image)} alt="Q" onError={e=>{e.target.parentElement.style.display="none"}}/></div>}
                <div className="bopts">
                  {["A","B","C","D"].map(key=>q.options[key]?(
                    <div key={key} className="bopt">
                      <span className="bopt-key">{key}</span>
                      <span style={{flex:1,lineHeight:1.5}}>{q.options[key]}</span>
                    </div>
                  ):null)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ MOBILE BOTTOM NAV ══ */}
      <div className="bottom-nav">
        {[
          {id:"dashboard",icon:"🏠",lbl:"Home"},
          {id:"practice", icon:"📝",lbl:"Practice", badge: sessionActive&&!isDone?`${sessDone}/${sessTotal}`:null},
          {id:"wrong",    icon:"❌",lbl:"Mistakes",  badge: wrongIds.size||null},
          {id:"bookmarks",icon:"🔖",lbl:"Saved",     badge: null},
        ].map(({id,icon,lbl,badge})=>(
          <button key={id} className={`bn-btn ${tab===id?"on":""}`} onClick={()=>setTab(id)}>
            <span className="bn-icon">{icon}</span>
            {badge && <span className="bn-badge">{badge}</span>}
            <span>{lbl}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
