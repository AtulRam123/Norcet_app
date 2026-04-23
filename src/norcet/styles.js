export const CSS = `

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
body[data-theme="dark"]{
  --bg:#140f1c;--bg2:#1d1527;--bg3:#251b31;--bg4:#31213d;
  --card:#1b1425;
  --pink:#ff86ae;--pink2:#ff5e97;--pink3:#ffb4ca;
  --pink-light:rgba(255,134,174,.14);--pink-lighter:rgba(255,134,174,.08);
  --rose:#ffb0cb;--lavender:#c89cff;--lav-light:rgba(200,156,255,.14);
  --gold:#ffce73;--gold-light:rgba(255,206,115,.14);
  --teal:#5fd6c7;--teal-light:rgba(95,214,199,.14);
  --correct:#61d58d;--correct-light:rgba(97,213,141,.13);
  --wrong:#ff6f93;--wrong-light:rgba(255,111,147,.14);
  --text:#f7edf7;--t2:#d6bfe3;--t3:#a78eb5;--t4:#725f80;
  --b1:rgba(255,255,255,.08);--b2:rgba(255,255,255,.18);--b3:rgba(255,255,255,.28);
  --shadow:0 8px 40px rgba(0,0,0,.30);
  --shadow2:0 22px 60px rgba(0,0,0,.42);
}
@keyframes floatUp{0%{transform:translateY(0) rotate(-15deg) scale(.8);opacity:0}10%{opacity:.6}90%{opacity:.2}100%{transform:translateY(-110vh) rotate(15deg) scale(1.1);opacity:0}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{opacity:0;transform:scale(.9) translateY(24px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes slideLeft{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes qPop{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes bob{from{transform:translateY(0) rotate(-3deg)}to{transform:translateY(-10px) rotate(3deg)}}
@keyframes shimmer{0%{transform:translateX(-140%) skewX(-18deg);opacity:0}28%{opacity:.45}100%{transform:translateX(160%) skewX(-18deg);opacity:0}}

.bg-pattern{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse 80% 62% at 0% 0%,rgba(255,201,219,.34) 0%,transparent 60%),
  radial-gradient(ellipse 65% 70% at 100% 100%,rgba(206,185,255,.20) 0%,transparent 60%),
  radial-gradient(ellipse 46% 38% at 68% 18%,rgba(240,120,166,.11) 0%,transparent 55%),
  linear-gradient(180deg,#fffafc 0%,#fff5f8 42%,#fff8fb 100%)}
.bg-dots{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.35;
  background-image:radial-gradient(circle,rgba(232,96,138,.12) 1px,transparent 1px);
  background-size:26px 26px;mask-image:linear-gradient(180deg,rgba(0,0,0,.7),rgba(0,0,0,.18))}
.bg-orb{position:fixed;border-radius:999px;filter:blur(16px);pointer-events:none;z-index:0;opacity:.8}
.bg-orb.o1{width:280px;height:280px;top:84px;left:-72px;background:radial-gradient(circle,rgba(255,191,214,.55) 0%,rgba(255,191,214,0) 70%)}
.bg-orb.o2{width:360px;height:360px;top:35vh;right:-100px;background:radial-gradient(circle,rgba(210,187,255,.38) 0%,rgba(210,187,255,0) 72%)}
.bg-orb.o3{width:220px;height:220px;bottom:64px;left:24%;background:radial-gradient(circle,rgba(255,221,186,.25) 0%,rgba(255,221,186,0) 72%)}
.bg-sheen{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:linear-gradient(120deg,transparent 0%,rgba(255,255,255,.42) 48%,transparent 70%);
  opacity:.42;mix-blend-mode:screen}

/* ?????? LAYOUT SHELL ?????? */
.app{position:relative;z-index:2;min-height:100vh;display:flex;flex-direction:column}
.app::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;
  background:linear-gradient(180deg,rgba(255,255,255,.20),transparent 18%,transparent 82%,rgba(255,255,255,.20))}

/* ── DESKTOP NAV (top bar) ── */
.nav{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;
  border-bottom:1px solid rgba(232,96,138,.08);background:rgba(255,250,252,.74);
  backdrop-filter:blur(20px) saturate(180%);position:sticky;top:0;z-index:300;
  box-shadow:0 12px 34px rgba(200,80,120,.07)}
.logo{display:flex;align-items:center;gap:10px}
.logo-heart{width:36px;height:36px;border-radius:11px;
  background:linear-gradient(135deg,#ff7ba7 0%,#d96cff 100%);
  display:flex;align-items:center;justify-content:center;font-size:1.1rem;
  box-shadow:0 8px 20px rgba(232,96,138,.26)}
.logo-text{font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:700;
  letter-spacing:.01em;background:linear-gradient(135deg,#d44a7f 0%,#a65de6 52%,#ff8aa8 100%);
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
.page{position:relative;z-index:2;padding:40px 48px 90px;max-width:980px;margin:0 auto;width:100%}

/* ── MODAL / OVERLAY ── */
.overlay{position:fixed;inset:0;z-index:600;background:rgba(240,220,230,.75);
  backdrop-filter:blur(20px);display:flex;align-items:flex-end;justify-content:center;
  padding:0;animation:fadeIn .22s ease}
.modal{background:var(--card);border:1px solid var(--b2);
  border-radius:var(--r4) var(--r4) 0 0;
  padding:32px 22px calc(var(--safe-bottom) + 20px) 28px;
  max-width:540px;width:100%;max-height:92vh;overflow-y:auto;
  box-shadow:var(--shadow2),0 0 60px rgba(232,96,138,.08);
  animation:sheetUp .35s cubic-bezier(.22,.68,0,1.2);
  position:relative;background-clip:padding-box;scrollbar-gutter:stable;
  overscroll-behavior:contain;
}
@keyframes sheetUp{from{transform:translateY(100%);opacity:.5}to{transform:translateY(0);opacity:1}}
.modal::before{content:'';display:block;width:40px;height:4px;border-radius:99px;
  background:var(--b2);margin:0 auto 24px;flex-shrink:0}
.modal::-webkit-scrollbar{width:10px}
.modal::-webkit-scrollbar-track{background:transparent;margin:14px 0}
.modal::-webkit-scrollbar-thumb{
  background:rgba(232,96,138,.22);
  border-radius:999px;
  border:3px solid transparent;
  background-clip:padding-box
}
.modal::-webkit-scrollbar-thumb:hover{
  background:rgba(232,96,138,.34);
  border:3px solid transparent;
  background-clip:padding-box
}
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
.filter-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.filter-chip{padding:8px 12px;border-radius:999px;border:1.5px solid var(--b1);background:var(--bg2);color:var(--t2);
  font-family:'Nunito',sans-serif;font-size:.72rem;font-weight:800;cursor:pointer;transition:all .18s}
.filter-chip.on{background:linear-gradient(135deg,var(--pink-light),var(--lav-light));color:var(--pink);border-color:var(--b2)}
.setup-filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.mini-label{font-size:.58rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-bottom:6px}
.select-input{width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid var(--b1);background:var(--bg2);color:var(--text);
  font-family:'Nunito',sans-serif;font-size:.82rem;outline:none}
.toggle-row{width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;
  border:1.5px solid var(--b1);background:var(--bg2);color:var(--t2);font-family:'Nunito',sans-serif;font-size:.78rem;
  font-weight:700;cursor:pointer;margin-bottom:18px;transition:all .18s}
.toggle-row.on{border-color:rgba(48,180,160,.28);background:var(--teal-light);color:var(--teal)}
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
.stat-grid{display:grid!important;grid-template-columns:repeat(6,1fr)!important;gap:16px;margin-bottom:24px}
.sc{background:
  linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,247,251,.9));
  border:1.5px solid rgba(232,96,138,.12);border-radius:22px;
  padding:18px 18px 17px;position:relative;overflow:hidden;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;cursor:default;
  box-shadow:0 14px 30px rgba(198,102,142,.10),inset 0 1px 0 rgba(255,255,255,.82)}
.sc:hover{transform:translateY(-2px);box-shadow:0 22px 38px rgba(198,102,142,.13);border-color:rgba(232,96,138,.2)}
.sc:active{transform:scale(.98)}
.sc::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background:var(--a)}
.sc::after{content:'';position:absolute;right:-28px;bottom:-34px;width:92px;height:92px;border-radius:999px;
  background:radial-gradient(circle,rgba(232,96,138,.10) 0%,rgba(232,96,138,0) 68%);pointer-events:none}
.sc-icon{font-size:1.15rem;margin-bottom:24px;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;
  border-radius:13px;background:rgba(255,255,255,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.82)}
.sc-val{font-family:'Playfair Display',serif;font-size:2.15rem;font-weight:700;color:var(--text);line-height:.95;letter-spacing:-.02em}
.sc-lbl{font-size:.68rem;color:var(--t2);margin-top:6px;font-weight:800;letter-spacing:.01em}
.sc-sub{font-size:.6rem;color:var(--t3);margin-top:4px;line-height:1.45}

/* ── TODAY BANNER ── */
.today{background:
  radial-gradient(circle at top right,rgba(255,222,236,.5),transparent 32%),
  linear-gradient(135deg,rgba(255,248,252,.96),rgba(250,241,255,.94),rgba(243,251,248,.9));
  border:1.5px solid rgba(255,255,255,.84);border-radius:28px;padding:24px 24px 22px;
  margin-bottom:24px;position:relative;overflow:hidden;
  box-shadow:0 24px 48px rgba(200,80,120,.11),inset 0 1px 0 rgba(255,255,255,.82)}
.today::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;
  background:linear-gradient(90deg,var(--pink),var(--lavender),var(--teal))}
.today::after{content:'🌸';position:absolute;right:16px;top:50%;transform:translateY(-50%);
  font-size:3.5rem;opacity:.08;pointer-events:none}
.today-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.today-tag{font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--pink);margin-bottom:5px}
.today-title{font-size:1.08rem;font-weight:800;color:var(--text);line-height:1.4}
.today-sub{font-size:.76rem;color:var(--t2);margin-top:5px;line-height:1.6;font-weight:600}
.today-pbar{margin-top:16px;height:8px;background:rgba(232,96,138,.08);border-radius:999px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(176,93,129,.14)}
.today-pfill{height:100%;background:linear-gradient(90deg,var(--pink),var(--lavender));border-radius:99px;transition:width .9s cubic-bezier(.22,.68,0,1)}
.today-btns{display:flex;gap:8px;flex-wrap:wrap}
.btn-primary{padding:11px 22px;border-radius:13px;border:none;
  background:linear-gradient(135deg,var(--pink),var(--pink2) 55%,var(--lavender));color:#fff;
  font-family:'Nunito',sans-serif;font-weight:800;font-size:.8rem;cursor:pointer;
  transition:transform .2s ease,box-shadow .2s ease,background-position .3s ease;
  box-shadow:0 12px 28px rgba(232,96,138,.28),inset 0 1px 0 rgba(255,255,255,.24);touch-action:manipulation;background-size:180%}
.btn-primary:hover{transform:translateY(-1px);background-position:100% 0;box-shadow:0 18px 32px rgba(232,96,138,.32)}
.btn-primary:active{transform:scale(.97)}
.btn-sec{padding:11px 20px;border-radius:13px;border:1.5px solid rgba(232,96,138,.18);background:rgba(255,255,255,.58);
  color:var(--pink);font-family:'Nunito',sans-serif;font-weight:800;font-size:.8rem;
  cursor:pointer;transition:transform .2s ease,border-color .2s ease,background .2s ease,box-shadow .2s ease;touch-action:manipulation;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
.btn-sec:hover{transform:translateY(-1px);border-color:rgba(232,96,138,.28);background:rgba(255,255,255,.82);box-shadow:0 12px 22px rgba(232,96,138,.08)}
.btn-sec:active{background:var(--pink-light)}

/* ── DASH GRID ── */
.dgrid{display:grid!important;grid-template-columns:1fr 1.1fr;gap:18px}
.panel{background:
  radial-gradient(circle at top right,rgba(255,255,255,.72),transparent 36%),
  linear-gradient(160deg,rgba(255,255,255,.86),rgba(255,248,252,.8));
  border:1.5px solid rgba(255,255,255,.84);border-radius:26px;padding:22px 20px;
  box-shadow:0 24px 46px rgba(198,102,142,.11),inset 0 1px 0 rgba(255,255,255,.82);backdrop-filter:blur(18px)}
.panel+.panel{margin-top:18px}
.ptitle{font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:var(--t3);margin-bottom:18px;display:flex;align-items:center;gap:8px}
.ptitle::after{content:'';flex:1;height:1px;background:var(--b1)}
.weak-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.weak-card{padding:16px;border-radius:18px;border:1.5px solid rgba(255,255,255,.78);background:
  linear-gradient(160deg,rgba(255,255,255,.92),rgba(250,242,248,.84));text-align:left;cursor:pointer;
  transition:all .2s ease;box-shadow:0 14px 26px rgba(200,80,120,.08)}
.weak-card:hover{transform:translateY(-2px);border-color:rgba(232,96,138,.16);box-shadow:0 18px 30px rgba(200,80,120,.12)}
.weak-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.weak-topic{font-size:.82rem;font-weight:800;color:var(--text);text-transform:capitalize}
.weak-badge{font-size:.64rem;font-weight:800;padding:4px 8px;border-radius:999px}
.weak-badge.good{background:var(--teal-light);color:var(--teal)}
.weak-badge.mid{background:var(--gold-light);color:var(--gold)}
.weak-badge.low{background:var(--wrong-light);color:var(--wrong)}
.weak-sub{font-size:.72rem;color:var(--t2);margin-bottom:10px}
.weak-track{height:6px;background:var(--b1);border-radius:999px;overflow:hidden}
.weak-fill{height:100%;background:linear-gradient(90deg,var(--wrong),var(--gold),var(--teal));border-radius:999px}

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
.ri{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;
  background:linear-gradient(160deg,rgba(255,255,255,.88),rgba(250,242,248,.8));border:1.5px solid rgba(255,255,255,.76);
  transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.ri:hover{transform:translateY(-1px);border-color:rgba(232,96,138,.14);box-shadow:0 12px 22px rgba(200,80,120,.08)}
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
.pshell{display:flex;flex-direction:column;align-items:center;gap:18px}
.ptopbar{width:100%;max-width:720px;display:flex;align-items:center;gap:14px;padding:12px 16px;
  border-radius:18px;background:
  linear-gradient(160deg,rgba(255,255,255,.74),rgba(255,245,250,.68));border:1px solid rgba(255,255,255,.72);
  box-shadow:0 16px 34px rgba(204,92,136,.1);backdrop-filter:blur(18px)}
.p-qinfo{font-size:.7rem;color:var(--pink2);white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:800;
  letter-spacing:.08em;text-transform:uppercase}
.p-track{flex:1;height:8px;background:rgba(232,96,138,.10);border-radius:99px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(176,93,129,.14)}
.p-fill{height:100%;background:linear-gradient(90deg,var(--pink),var(--lavender));border-radius:99px;transition:width .6s cubic-bezier(.22,.68,0,1);
  box-shadow:0 4px 14px rgba(232,96,138,.22)}
.p-acc{font-size:.76rem;color:var(--text);white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:800;
  min-width:46px;text-align:right}

/* ── QUESTION CARD ── */
.qcard{width:100%;max-width:720px;
  background:
    radial-gradient(circle at top right,rgba(255,195,215,.4),transparent 34%),
    radial-gradient(circle at bottom left,rgba(210,187,255,.24),transparent 30%),
    linear-gradient(160deg,rgba(255,255,255,.97),rgba(255,248,252,.94) 54%,rgba(252,241,247,.92));
  border:1.5px solid rgba(255,255,255,.84);
  border-radius:34px;padding:32px 28px;position:relative;overflow:hidden;
  box-shadow:0 30px 80px rgba(204,92,136,.2),0 14px 30px rgba(204,92,136,.1),inset 0 1px 0 rgba(255,255,255,.78);
  animation:qPop .42s cubic-bezier(.22,.68,0,1.2) both;backdrop-filter:blur(22px)}
.qcard::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,#ff7aa5,#d58cff,#ffc497)}
.qcard::after{content:'';position:absolute;top:-10%;left:-18%;width:54%;height:120%;
  background:linear-gradient(120deg,transparent 0%,rgba(255,255,255,.48) 48%,transparent 72%);
  opacity:.55;transform:skewX(-18deg);animation:shimmer 10s linear infinite}
.qcard:focus-within{box-shadow:0 30px 78px rgba(204,92,136,.22),0 12px 32px rgba(204,92,136,.1),inset 0 1px 0 rgba(255,255,255,.72)}
.qcard-top,.qtext,.qimg,.opts,.anote,.love-feedback,.nbtn{position:relative;z-index:1}
.qcard-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap}
.qtag{font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:var(--pink);background:linear-gradient(135deg,rgba(232,96,138,.13),rgba(232,96,138,.05));
  border:1px solid rgba(232,96,138,.25);padding:5px 12px;border-radius:99px;box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}
.mock-qtag{color:var(--lavender);background:var(--lav-light);border-color:rgba(192,144,232,.3)}
.qmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.img-chip{font-size:.58rem;color:var(--teal);background:var(--teal-light);
  border:1px solid rgba(48,180,160,.25);padding:4px 10px;border-radius:99px;font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,.45)}
.no-ans-chip{font-size:.58rem;color:var(--t3);background:var(--bg3);
  border:1px solid var(--b1);padding:4px 10px;border-radius:99px;font-weight:800}
.book-btn{width:38px;height:38px;border-radius:12px;border:1px solid rgba(232,96,138,.16);
  background:linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,241,246,.68));cursor:pointer;font-size:1.05rem;padding:0;
  transition:transform .15s,box-shadow .18s,border-color .18s;line-height:1;-webkit-tap-highlight-color:transparent;
  display:flex;align-items:center;justify-content:center;box-shadow:0 10px 22px rgba(204,92,136,.08)}
.book-btn:hover{transform:translateY(-1px);border-color:rgba(232,96,138,.28);box-shadow:0 14px 26px rgba(204,92,136,.12)}
.book-btn:active{transform:scale(.92)}
.qeyebrow{font-size:.63rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--pink2);
  margin-bottom:10px;opacity:.8}
.qtext{font-size:1.12rem;font-weight:750;line-height:1.74;color:var(--text);margin-bottom:22px;
  text-wrap:balance}
.qimg{margin-bottom:18px;border-radius:18px;overflow:hidden;border:1.5px solid rgba(232,96,138,.14);
  box-shadow:0 12px 28px rgba(200,80,120,.10),inset 0 1px 0 rgba(255,255,255,.6);
  background:
    linear-gradient(180deg,rgba(255,255,255,.82),rgba(255,244,249,.76)),
    var(--bg2)}
.qimg img{width:100%;max-height:260px;object-fit:contain;display:block;padding:12px}
.qimg-cap{font-size:.64rem;color:var(--t2);text-align:center;padding:0 10px 10px;font-weight:700;letter-spacing:.02em}

/* ── OPTIONS ── */
.opts{display:flex;flex-direction:column;gap:12px}
.opt{display:flex;align-items:flex-start;gap:12px;padding:16px 17px;border-radius:18px;
  border:1.5px solid rgba(232,96,138,.14);background:linear-gradient(180deg,rgba(255,247,250,.92),rgba(255,241,246,.82));cursor:pointer;text-align:left;
  font-family:'Nunito',sans-serif;font-size:.9rem;color:var(--text);transition:all .22s ease;font-weight:500;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;width:100%;position:relative;overflow:hidden;
  box-shadow:0 12px 24px rgba(204,92,136,.07),inset 0 1px 0 rgba(255,255,255,.6)}
.opt::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(120deg,transparent 0%,rgba(255,255,255,.32) 46%,transparent 70%);
  opacity:0;transform:translateX(-40%);transition:opacity .18s ease,transform .28s ease}
.opt:disabled{opacity:1;color:var(--text);-webkit-text-fill-color:var(--text);cursor:not-allowed}
.opt:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 20px 30px rgba(232,96,138,.12);border-color:rgba(232,96,138,.24)}
.opt:hover:not(:disabled)::after{opacity:.9;transform:translateX(0)}
.opt:active:not(:disabled){transform:scale(.985);background:var(--pink-lighter)}
.okey{min-width:34px;height:34px;border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,237,245,.86));border:1.5px solid rgba(232,96,138,.2);
  display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:.78rem;letter-spacing:.02em;flex-shrink:0;transition:all .22s;color:var(--pink2);margin-top:1px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.78),0 6px 16px rgba(232,96,138,.08)}
.otxt{line-height:1.6;font-size:.9rem;flex:1;color:inherit}
.opt.correct{background:var(--correct-light);border-color:rgba(40,160,96,.4)}
.opt.correct .okey{background:var(--correct);color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(40,160,96,.3)}
.opt.wrong{background:var(--wrong-light);border-color:rgba(224,64,96,.4)}
.opt.wrong .okey{background:var(--wrong);color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(224,64,96,.3)}
.opt.reveal{background:rgba(40,160,96,.06);border-color:rgba(40,160,96,.25);opacity:.9}
.opt.reveal .okey{background:var(--correct);color:#fff;border-color:transparent}

/* ── ANSWER NOTE ── */
.anote{margin-top:18px;padding:14px 16px;border-radius:16px;font-size:.84rem;font-weight:700;
  display:flex;align-items:flex-start;gap:9px;line-height:1.6;box-shadow:0 12px 28px rgba(200,80,120,.06)}
.anote.ok{background:linear-gradient(180deg,rgba(235,252,242,.95),rgba(228,246,236,.88));color:var(--correct);border:1.5px solid rgba(40,160,96,.18)}
.anote.err{background:linear-gradient(180deg,rgba(255,242,246,.95),rgba(255,235,241,.90));color:var(--wrong);border:1.5px solid rgba(224,64,96,.18)}
.anote.na{background:rgba(255,255,255,.7);color:var(--t3);font-style:italic;border:1px solid rgba(232,96,138,.12)}
.love-feedback{font-size:.86rem;font-style:italic;color:var(--pink);
  font-family:'Playfair Display',serif;margin-top:8px;text-align:center;padding:6px 0}
.explanation{margin-top:14px;padding:16px 16px 15px;border-radius:18px;
  background:linear-gradient(160deg,rgba(255,250,252,.96),rgba(247,240,255,.94));
  border:1.5px solid rgba(197,157,238,.28);
  font-size:.81rem;line-height:1.72;color:#654769;font-weight:500;
  box-shadow:0 18px 32px rgba(173,124,218,.11)}
.explanation.is-collapsed{padding:12px 14px}
.explanation-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;
  border:none;background:transparent;color:inherit;cursor:pointer;text-align:left;padding:0;
  font-family:'Nunito',sans-serif}
.explanation-toggle-copy{display:flex;flex-direction:column;gap:4px;min-width:0}
.explanation-toggle-text{font-size:.76rem;line-height:1.5;color:#7b6586}
.explanation-toggle-icon{width:30px;height:30px;border-radius:999px;display:flex;align-items:center;justify-content:center;
  flex-shrink:0;background:rgba(255,255,255,.82);border:1px solid rgba(197,157,238,.22);color:#6f61d9;
  font-size:1rem;font-weight:800}
.explanation.is-open .explanation-toggle{padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid rgba(197,157,238,.18)}
.explanation strong{color:var(--lavender);font-size:.64rem;letter-spacing:.12em;
  text-transform:uppercase;display:block;margin-bottom:4px;font-weight:800}
.explanation-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:0;padding-bottom:12px;border-bottom:1px solid rgba(197,157,238,.18)}
.explanation-chip{font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  color:#6f61d9;background:rgba(255,255,255,.82);border:1px solid rgba(192,144,232,.22);padding:4px 10px;border-radius:999px}
.explanation-main{padding:18px 2px 4px}
.explanation-kicker{font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d5db0;margin-bottom:6px}
.explanation-answer-row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.explanation-answer-badge{min-width:28px;height:24px;border-radius:8px;background:rgba(192,144,232,.18);color:#6f61d9;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800}
.explanation-answer{font-size:.95rem;font-weight:800;color:#6f61d9;margin-bottom:0;line-height:1.45}
.explanation-note-main{font-size:.92rem;font-weight:700;color:var(--text);margin-bottom:8px}
.explanation-note{font-size:.77rem;line-height:1.72;color:#5f4867}
.explanation-note-hint{margin-top:10px;color:#7f6288}
.explanation-why-not{margin-top:14px;padding-top:16px;border-top:1px solid rgba(197,157,238,.22)}
.explanation-subhead{font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9a8a7b;margin-bottom:12px}
.explanation-option-card{display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-top:1px solid rgba(197,157,238,.14);margin-top:0}
.explanation-option-card:first-of-type{border-top:none;padding-top:0}
.explanation-option-badge{min-width:30px;height:24px;border-radius:8px;background:rgba(255,255,255,.7);border:1px solid rgba(197,157,238,.18);color:#8b8b8b;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:800}
.explanation-option-copy{display:flex;flex-direction:column;gap:6px;flex:1}
.explanation-option-topline{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.explanation-option-title{font-size:.9rem;line-height:1.6;color:var(--text);font-weight:800}
.explanation-option-tag{font-size:.6rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6f61d9;background:rgba(255,255,255,.84);border:1px solid rgba(192,144,232,.2);padding:3px 8px;border-radius:999px}
.explanation-option-line{font-size:.8rem;line-height:1.72;color:#8a8176}
.nbtn{margin-top:18px;width:100%;padding:15px;border-radius:14px;border:none;
  background:linear-gradient(135deg,#f06292 0%,#db4b8d 45%,#be68e6 100%);
  background-size:200%;background-position:0%;color:#fff;font-family:'Nunito',sans-serif;
  font-size:.94rem;font-weight:700;cursor:pointer;transition:all .3s;letter-spacing:.02em;
  box-shadow:0 18px 32px rgba(232,96,138,.28),inset 0 1px 0 rgba(255,255,255,.26);-webkit-tap-highlight-color:transparent;
  touch-action:manipulation}
.nbtn:hover{background-position:100%;transform:translateY(-2px)}
.nbtn:active{transform:scale(.98)}

/* ── TIMER ── */
.timer-bar{width:100%;max-width:680px;display:flex;align-items:center;gap:11px}
.timer-track{flex:1;height:6px;background:var(--bg3);border-radius:99px;overflow:hidden}
.timer-fill{height:100%;border-radius:99px;transition:width .9s linear}
.timer-label{font-size:.78rem;font-weight:700;min-width:46px;text-align:right;font-variant-numeric:tabular-nums}

/* ── STAT STRIP ── */
.sstrip{display:flex;gap:12px;width:100%;max-width:720px;flex-wrap:wrap}
.ss{flex:1;min-width:100px;background:
  linear-gradient(160deg,rgba(255,255,255,.82),rgba(255,245,250,.74));border:1.5px solid rgba(255,255,255,.8);
  border-radius:20px;padding:14px 10px;text-align:center;transition:all .18s;box-shadow:0 16px 28px rgba(200,80,120,.08);backdrop-filter:blur(18px)}
.ss .v{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;line-height:1}
.ss .l{font-size:.6rem;color:var(--t3);margin-top:2px;font-weight:700}
.ss.vc .v{color:var(--correct)}.ss.vw .v{color:var(--wrong)}
.ss.vg .v{color:var(--gold)}.ss.vt .v{color:var(--teal)}

/* ── DONE / READY SCREENS ── */
.done-wrap{text-align:center;max-width:620px;margin:40px auto 0;padding:46px 30px;
  background:
  radial-gradient(circle at top right,rgba(255,228,239,.45),transparent 34%),
  linear-gradient(160deg,rgba(255,255,255,.95),rgba(252,244,249,.92));
  border:1.5px solid rgba(255,255,255,.84);border-radius:36px;
  box-shadow:0 30px 70px rgba(198,102,142,.16),inset 0 1px 0 rgba(255,255,255,.8);position:relative;overflow:hidden}
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
.done-summary-copy{max-width:440px;margin:0 auto 16px;color:var(--t2);font-size:.82rem;line-height:1.7;font-weight:600}
.done-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:6px 0 14px}
.done-stat-card{background:var(--bg2);border:1.5px solid var(--b1);border-radius:14px;padding:14px 12px}
.done-stat-value{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;line-height:1}
.done-stat-label{font-size:.62rem;color:var(--t3);margin-top:4px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.done-wrap p{color:var(--t2);font-size:.84rem;line-height:1.75;font-weight:500}
.done-acts{display:flex;gap:9px;margin-top:20px;justify-content:center;flex-wrap:wrap}
.btn-danger{padding:10px 20px;border-radius:11px;border:1.5px solid rgba(224,64,96,.3);
  background:var(--wrong-light);color:var(--wrong);font-family:'Nunito',sans-serif;font-weight:700;
  font-size:.78rem;cursor:pointer;transition:all .2s;touch-action:manipulation}
.ready-card{text-align:center;max-width:520px;margin:40px auto 0;padding:46px 30px;
  background:
  radial-gradient(circle at top right,rgba(255,228,239,.42),transparent 34%),
  linear-gradient(160deg,rgba(255,255,255,.95),rgba(252,244,249,.92));
  border:1.5px solid rgba(255,255,255,.84);border-radius:36px;
  box-shadow:0 28px 64px rgba(198,102,142,.15),inset 0 1px 0 rgba(255,255,255,.8);position:relative;overflow:hidden}
.ready-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,var(--pink),var(--lavender),var(--pink))}
.ready-card h2{font-family:'Playfair Display',serif;font-size:1.9rem;font-weight:700;color:var(--text);margin:10px 0 7px}
.ready-card p{color:var(--t2);font-size:.82rem;line-height:1.7;margin-bottom:20px;font-weight:500}
.ready-actions-grid{display:grid;gap:10px;margin-top:4px}
.ready-action-card{display:flex;flex-direction:column;align-items:flex-start;gap:6px;width:100%;padding:16px 16px 15px;border-radius:18px;border:1.5px solid rgba(192,144,232,.18);background:linear-gradient(145deg,rgba(255,251,253,.94),rgba(247,240,255,.94));text-align:left;cursor:pointer;transition:all .22s;box-shadow:0 14px 28px rgba(173,124,218,.08)}
.ready-action-card:hover{transform:translateY(-1px);border-color:rgba(192,144,232,.3);box-shadow:0 18px 32px rgba(173,124,218,.12)}
.ready-action-teal{border-color:rgba(48,180,160,.18);background:linear-gradient(145deg,rgba(247,255,252,.96),rgba(238,250,248,.94))}
.ready-action-soft{border-color:rgba(232,96,138,.16);background:linear-gradient(145deg,rgba(255,250,252,.96),rgba(255,241,247,.94))}
.ready-action-icon{display:none}
.ready-action-title{font-size:.84rem;font-weight:800;color:var(--text)}
.ready-action-sub{font-size:.72rem;line-height:1.55;color:var(--t2)}

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
.rc{background:
  radial-gradient(circle at top right,rgba(255,255,255,.72),transparent 38%),
  linear-gradient(160deg,rgba(255,255,255,.93),rgba(252,244,249,.88));border:1.5px solid rgba(255,255,255,.82);border-radius:28px;
  padding:20px 18px;margin-bottom:14px;border-left:4px solid var(--wrong);
  transition:transform .2s ease,box-shadow .2s ease;box-shadow:0 22px 42px rgba(198,102,142,.11)}
.rc:hover{transform:translateY(-2px);box-shadow:0 28px 48px rgba(198,102,142,.14)}
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
.bcard{background:
  radial-gradient(circle at top right,rgba(255,255,255,.7),transparent 40%),
  linear-gradient(160deg,rgba(255,255,255,.93),rgba(252,244,249,.88));border:1.5px solid rgba(255,255,255,.82);border-radius:26px;
  padding:20px 18px;margin-bottom:12px;border-left:4px solid var(--pink);
  transition:all .2s;box-shadow:0 18px 36px rgba(198,102,142,.1)}
.bcard:hover{transform:translateY(-2px);box-shadow:0 24px 42px rgba(198,102,142,.13)}
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
.theme-row{display:flex;gap:8px;flex-wrap:wrap}
.theme-chip{display:flex;align-items:center;gap:8px;padding:11px 14px;border-radius:12px;border:1.5px solid var(--b1);
  background:var(--bg2);color:var(--t2);font-family:'Nunito',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;
  transition:all .18s}
.theme-chip.on{background:linear-gradient(135deg,var(--pink-light),var(--lav-light));color:var(--pink);border-color:var(--b2);box-shadow:0 10px 20px rgba(232,96,138,.10)}
.theme-chip-icon{font-size:.95rem;line-height:1}

body[data-theme="dark"] .bg-pattern{
  background:radial-gradient(ellipse 80% 62% at 0% 0%,rgba(103,44,77,.40) 0%,transparent 60%),
  radial-gradient(ellipse 65% 70% at 100% 100%,rgba(80,55,122,.34) 0%,transparent 60%),
  radial-gradient(ellipse 46% 38% at 68% 18%,rgba(130,66,102,.22) 0%,transparent 55%),
  linear-gradient(180deg,#100b17 0%,#160f1f 42%,#140f1c 100%)}
body[data-theme="dark"] .bg-dots{opacity:.24}
body[data-theme="dark"] .nav,
body[data-theme="dark"] .mob-topbar,
body[data-theme="dark"] .bottom-nav{background:rgba(22,16,30,.76)}
body[data-theme="dark"] .ptopbar{
  background:rgba(31,22,42,.72);
  border-color:rgba(255,255,255,.08);
  box-shadow:0 16px 34px rgba(0,0,0,.2)}
body[data-theme="dark"] .p-qinfo{color:#ffb1ca}
body[data-theme="dark"] .p-track{background:rgba(255,255,255,.08);box-shadow:inset 0 1px 3px rgba(0,0,0,.28)}
body[data-theme="dark"] .p-acc{color:#f5eaf6}
body[data-theme="dark"] .filter-chip,
body[data-theme="dark"] .select-input,
body[data-theme="dark"] .toggle-row,
body[data-theme="dark"] .weak-card{background:rgba(41,28,54,.94);border-color:rgba(255,255,255,.08)}
body[data-theme="dark"] .panel,
body[data-theme="dark"] .qcard,
body[data-theme="dark"] .modal,
body[data-theme="dark"] .ss,
body[data-theme="dark"] .mob-stat-item,
body[data-theme="dark"] .mob-prog-card{background:rgba(30,22,40,.72);border-color:rgba(255,255,255,.08)}
body[data-theme="dark"] .sc,
body[data-theme="dark"] .today,
body[data-theme="dark"] .done-wrap,
body[data-theme="dark"] .ready-card,
body[data-theme="dark"] .rc,
body[data-theme="dark"] .bcard,
body[data-theme="dark"] .mood-card,
body[data-theme="dark"] .qa-btn,
body[data-theme="dark"] .ri{
  background:linear-gradient(165deg,rgba(35,25,48,.96),rgba(27,20,37,.94));
  border-color:rgba(255,255,255,.1)
}
body[data-theme="dark"] .sc{
  background:linear-gradient(180deg,rgba(32,24,43,.94),rgba(24,18,34,.96));
  border-color:rgba(255,255,255,.08);
  box-shadow:0 16px 34px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.04)
}
body[data-theme="dark"] .sc::after{background:radial-gradient(circle,rgba(255,134,174,.12) 0%,rgba(255,134,174,0) 68%)}
body[data-theme="dark"] .sc-icon{background:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
body[data-theme="dark"] .btn-sec{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12)}
body[data-theme="dark"] .btn-sec:hover{background:rgba(255,255,255,.08);box-shadow:0 12px 22px rgba(0,0,0,.18)}
body[data-theme="dark"] .modal::-webkit-scrollbar-thumb{
  background:rgba(255,255,255,.18);
  border:3px solid transparent;
  background-clip:padding-box
}
body[data-theme="dark"] .modal::-webkit-scrollbar-thumb:hover{
  background:rgba(255,255,255,.28);
  border:3px solid transparent;
  background-clip:padding-box
}
body[data-theme="dark"] .qcard{
  background:
    radial-gradient(circle at top right,rgba(255,142,184,.16),transparent 34%),
    radial-gradient(circle at bottom left,rgba(200,156,255,.12),transparent 30%),
    linear-gradient(165deg,rgba(35,25,48,.96),rgba(27,20,37,.95) 58%,rgba(22,16,31,.97));
  border-color:rgba(255,255,255,.12);
  box-shadow:0 28px 70px rgba(0,0,0,.34),0 10px 26px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.05)}
body[data-theme="dark"] .qimg{
  background:
    linear-gradient(180deg,rgba(45,31,59,.92),rgba(34,24,46,.92)),
    var(--bg2);
  border-color:rgba(255,255,255,.08);
  box-shadow:0 14px 30px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.04)}
body[data-theme="dark"] .qtag{box-shadow:none}
body[data-theme="dark"] .qeyebrow{color:#ffb1ca}
body[data-theme="dark"] .book-btn{
  background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.04));
  border-color:rgba(255,255,255,.1);
  box-shadow:0 12px 22px rgba(0,0,0,.18)}
body[data-theme="dark"] .opt{
  background:linear-gradient(180deg,rgba(41,28,54,.96),rgba(32,23,44,.90));
  box-shadow:0 14px 24px rgba(0,0,0,.18)}
body[data-theme="dark"] .okey{
  background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.08));
  border-color:rgba(255,255,255,.14);
  color:#fff;
  -webkit-text-fill-color:#fff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 8px 18px rgba(0,0,0,.18)}
body[data-theme="dark"] .opt::after{background:linear-gradient(120deg,transparent 0%,rgba(255,255,255,.08) 46%,transparent 72%)}
body[data-theme="dark"] .anote.na{background:rgba(36,28,48,.86)}
body[data-theme="dark"] .explanation{background:linear-gradient(160deg,rgba(41,28,54,.96),rgba(32,23,44,.94));color:#eadbf2}
body[data-theme="dark"] .explanation-toggle-text{color:#d6bfe3}
body[data-theme="dark"] .explanation-toggle-icon{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.1);color:#d9b5ff}
body[data-theme="dark"] .explanation.is-open .explanation-toggle{border-bottom-color:rgba(255,255,255,.08)}
body[data-theme="dark"] .ready-action-card{
  background:rgba(41,28,54,.88);
  border-color:rgba(255,255,255,.08)
}
body[data-theme="dark"] .explanation-answer,
body[data-theme="dark"] .explanation-note,
body[data-theme="dark"] .explanation-option-line{color:#eadbf2}
body[data-theme="dark"] .explanation-why-not{border-top-color:rgba(255,255,255,.08)}
body[data-theme="dark"] .explanation-subhead{color:#d9b5ff}
body[data-theme="dark"] .explanation-kicker,
body[data-theme="dark"] .ready-action-title{color:#f7edf7}
body[data-theme="dark"] .ready-action-sub{color:#d6bfe3}
body[data-theme="dark"] .explanation-head{border-bottom-color:rgba(255,255,255,.08)}
body[data-theme="dark"] .explanation-chip,
body[data-theme="dark"] .explanation-option-tag,
body[data-theme="dark"] .explanation-option-badge{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.1);color:#d9b5ff}
body[data-theme="dark"] .explanation-answer-badge{background:rgba(255,255,255,.1);color:#d9b5ff}
body[data-theme="dark"] .explanation-answer{color:#d9b5ff}
body[data-theme="dark"] .explanation-note-main,
body[data-theme="dark"] .explanation-option-title{color:#f7edf7}
body[data-theme="dark"] .explanation-note-hint{color:#d6bfe3}
body[data-theme="dark"] .explanation-option-card{border-top-color:rgba(255,255,255,.08)}
body[data-theme="dark"] .done-summary-copy{color:#d6bfe3}
body[data-theme="dark"] .mood-text .ms{
  background:linear-gradient(135deg,#f7edf7 0%,#ff9fc0 58%,#d9b5ff 100%);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent
}

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
  .modal{border-radius:22px 22px 0 0;padding:18px 12px calc(var(--safe-bottom) + 16px) 16px;
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
  .setup-filter-grid{grid-template-columns:1fr}
  .weak-grid{grid-template-columns:1fr}

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
  .ready-action-card{padding:14px 14px 13px;border-radius:16px}

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
  .filter-chip-row{gap:6px}
  .qcard{padding:14px 12px}
  .opt{padding:10px 10px;gap:8px}
  .sstrip{gap:5px}
  .sstrip .ss{padding:8px 4px}
  .ss .v{font-size:1.4rem}
}

/* ── MOBILE DASHBOARD — clean & minimal ── */

/* Hero card: greeting + love note combined */
.mob-hero{
  background:linear-gradient(135deg,rgba(232,96,138,.1),rgba(192,144,232,.08));
  border:1.5px solid rgba(232,96,138,.15);
  border-radius:20px;padding:18px 18px 16px;
  margin-bottom:16px;position:relative;overflow:hidden;
}
.mob-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,var(--pink),var(--lavender))}
.mob-hero-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.mob-greeting{font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:700;
  background:linear-gradient(135deg,var(--text),var(--pink));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.mob-date{font-size:.65rem;color:var(--t3);font-weight:600}
.mob-love{font-family:'Playfair Display',serif;font-size:.82rem;font-style:italic;
  color:var(--pink2);line-height:1.55}
.mob-hero-fab{
  padding:10px 18px;border-radius:12px;border:none;
  background:linear-gradient(135deg,var(--pink),var(--pink2));color:#fff;
  font-family:'Nunito',sans-serif;font-size:.78rem;font-weight:700;
  cursor:pointer;margin-top:14px;width:100%;
  box-shadow:0 6px 18px rgba(232,96,138,.28);
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
}
.mob-hero-fab:active{transform:scale(.98);opacity:.92}

/* Stats strip — inline, no boxes */
.mob-stats-strip{
  display:flex;align-items:center;gap:0;
  background:var(--card);border:1.5px solid var(--b1);
  border-radius:16px;overflow:hidden;margin-bottom:14px;
  box-shadow:0 4px 16px rgba(200,80,120,.07);
}
.mob-stat-item{
  flex:1;padding:13px 8px;text-align:center;
  border-right:1px solid var(--b1);
}
.mob-stat-item:last-child{border-right:none}
.mob-stat-val{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700;line-height:1}
.mob-stat-lbl{font-size:.58rem;color:var(--t3);margin-top:3px;font-weight:600}

/* Session resume — inline in hero, not separate box */
.mob-sess-row{
  display:flex;align-items:center;gap:10px;
  background:rgba(48,180,160,.08);border:1px solid rgba(48,180,160,.2);
  border-radius:12px;padding:10px 14px;margin-top:12px;
}
.mob-sess-row .st{font-size:.78rem;font-weight:700;color:var(--teal);flex:1}
.mob-sess-row .ss2{font-size:.62rem;color:var(--t2)}
.mob-sess-cont{padding:7px 13px;border-radius:9px;border:none;
  background:var(--teal);color:#fff;font-family:'Nunito',sans-serif;
  font-size:.7rem;font-weight:700;cursor:pointer;white-space:nowrap;
  -webkit-tap-highlight-color:transparent}

/* 2-button action row */
.mob-actions{display:flex;gap:9px;margin-bottom:14px}
.mob-action{flex:1;display:flex;align-items:center;gap:9px;
  padding:13px 14px;border-radius:14px;border:1.5px solid var(--b1);
  background:var(--card);cursor:pointer;font-family:'Nunito',sans-serif;
  box-shadow:0 4px 14px rgba(200,80,120,.07);
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:all .18s}
.mob-action:active{transform:scale(.97);opacity:.88}
.mob-action-icon{font-size:1.3rem;flex-shrink:0}
.mob-action-text .mal{font-size:.74rem;font-weight:700;color:var(--text)}
.mob-action-text .mas{font-size:.6rem;color:var(--t3);margin-top:1px}

/* Compact 7-day bars — no panel box, just bare */
.mob-week{margin-bottom:4px}
.mob-week-title{font-size:.6rem;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--t3);margin-bottom:10px;
  display:flex;align-items:center;gap:8px}
.mob-week-title::after{content:'';flex:1;height:1px;background:var(--b1)}
.mob-week-row{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.mob-week-day{font-size:.6rem;color:var(--t2);min-width:22px;font-weight:700}
.mob-week-bar{flex:1;height:5px;background:var(--bg3);border-radius:99px;overflow:hidden}
.mob-week-fill{height:100%;border-radius:99px;transition:width 1.2s cubic-bezier(.22,.68,0,1)}
.mob-week-pct{font-size:.6rem;color:var(--t2);min-width:24px;text-align:right;font-weight:600}

/* Mood / motivation card (mob-only) */
.mood-card{display:flex;align-items:center;gap:14px;
  background:
  radial-gradient(circle at top right,rgba(255,255,255,.56),transparent 32%),
  linear-gradient(135deg,rgba(232,96,138,.12),rgba(192,144,232,.1));
  border:1.5px solid rgba(255,255,255,.72);border-radius:22px;
  padding:18px 18px 17px;margin-bottom:14px;
  box-shadow:0 16px 28px rgba(200,80,120,.1),inset 0 1px 0 rgba(255,255,255,.7)}
.mood-avatar{width:52px;height:52px;border-radius:16px;flex-shrink:0;
  background:linear-gradient(135deg,var(--pink),var(--lavender));
  display:flex;align-items:center;justify-content:center;font-size:1.6rem;
  box-shadow:0 4px 14px rgba(232,96,138,.3)}
.mood-text{display:flex;flex-direction:column;gap:6px;min-width:0}
.mood-text .mt{font-family:'Playfair Display',serif;font-size:.88rem;font-style:italic;
  color:var(--pink2);line-height:1.55}
.mood-text .ms{font-family:'Playfair Display',serif;font-size:1.02rem;font-weight:700;line-height:1.15;
  color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap;
  background:linear-gradient(135deg,var(--text) 0%,var(--pink) 65%,var(--lavender) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.mood-heart{-webkit-text-fill-color:initial}
/* Quick action row */
.quick-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.qa-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:6px;padding:15px 8px;border-radius:18px;border:1.5px solid rgba(255,255,255,.74);
  background:var(--card);cursor:pointer;font-family:'Nunito',sans-serif;
  box-shadow:0 10px 18px rgba(200,80,120,.08),inset 0 1px 0 rgba(255,255,255,.74);
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:all .18s}
.qa-btn:active{transform:scale(.95);opacity:.85}
.qa-btn.primary-qa{background:linear-gradient(135deg,var(--pink),var(--pink2));border-color:transparent;
  box-shadow:0 6px 20px rgba(232,96,138,.35)}
.qa-icon{font-size:1.4rem}
.qa-label{font-size:.62rem;font-weight:700;color:var(--t2)}
.qa-btn.primary-qa .qa-label{color:#fff}
/* Mobile progress cards row */
.mob-progress-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.mob-prog-card{background:
  linear-gradient(160deg,rgba(255,255,255,.92),rgba(252,244,249,.84));border:1.5px solid rgba(255,255,255,.78);border-radius:18px;
  padding:15px 10px 14px;text-align:center;box-shadow:0 14px 24px rgba(200,80,120,.08),inset 0 1px 0 rgba(255,255,255,.72)}
.mob-prog-big{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700;line-height:1}
.mob-prog-lbl{font-size:.6rem;color:var(--t3);margin-top:4px;font-weight:600}
.mob-prog-bar{height:3px;background:var(--bg3);border-radius:99px;overflow:hidden;margin-top:8px}
.mob-prog-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.22,.68,0,1)}
/* Session resume banner */
.sess-banner{display:flex;align-items:center;gap:10px;
  background:rgba(48,180,160,.08);border:1.5px solid rgba(48,180,160,.2);
  border-radius:14px;padding:12px 14px;margin-bottom:12px}
.sess-banner-icon{font-size:1.3rem;flex-shrink:0}
.sess-banner-text{flex:1}
.sess-banner-text .st{font-size:.78rem;font-weight:700;color:var(--teal)}
.sess-banner-text .ss2{font-size:.62rem;color:var(--t2);margin-top:2px}
.sess-banner-btn{padding:7px 13px;border-radius:9px;border:none;
  background:var(--teal);color:#fff;font-family:'Nunito',sans-serif;
  font-size:.7rem;font-weight:700;cursor:pointer;white-space:nowrap;
  -webkit-tap-highlight-color:transparent}

/* Scrollbar */
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:var(--bg2)}
::-webkit-scrollbar-thumb{background:rgba(232,96,138,.2);border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:rgba(232,96,138,.4)}

`;
