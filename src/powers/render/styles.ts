export const POWERS_CSS = `
.pw-root{--pw-bg:#16131a;--pw-bg1:#1a171e;--pw-bg2:#211d25;--pw-bg3:#2a2530;--pw-bd:#3a3342;--pw-ac:#b080ff;--pw-btn:#7138cc;--pw-tx:#e8e3ef;--pw-mu:#9a92a6;--pw-ok:#80ffb5;background:var(--pw-bg);color:var(--pw-tx);font-family:Inter,-apple-system,"Segoe UI",system-ui,sans-serif;line-height:1.5;margin:0}
.pw-root [hidden]{display:none!important}
.pw-wrap{max-width:1120px;margin:0 auto;padding:20px}
.pw-hero{background:linear-gradient(120deg,#2d1f47,#211d25 60%);border:1px solid var(--pw-bd);border-radius:14px;padding:20px 22px;margin-bottom:18px;display:grid;grid-template-columns:auto 1fr;gap:6px 18px;align-items:center}
.pw-hero .pw-mascot{grid-row:span 2}
.pw-hero h1{margin:0;font-size:26px}
.pw-hero p{margin:0;color:var(--pw-mu)}
.pw-hero .pw-filters{grid-column:1/-1}
.pw-filters{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;align-items:center}
.pw-chip{font:inherit;font-size:12px;padding:4px 11px;border-radius:999px;border:1px solid var(--pw-bd);background:rgba(22,19,26,.6);color:var(--pw-tx);cursor:default}
button.pw-chip{cursor:pointer;color:var(--pw-mu)}
.pw-chip.pw-on{background:var(--pw-ac);color:#1a171e;border-color:var(--pw-ac)}
.pw-search{margin-left:auto;font:inherit;font-size:13px;background:var(--pw-bg3);border:1px solid var(--pw-bd);color:var(--pw-tx);border-radius:8px;padding:5px 10px;min-width:180px}
.pw-section{font-size:11px;letter-spacing:.1em;color:var(--pw-mu);margin:22px 0 10px}
.pw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}
.pw-card,.pw-poster{background:var(--pw-bg2);border:1px solid var(--pw-bd);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px}
.pw-card:hover{border-color:rgba(176,128,255,.5)}
.pw-poster{max-width:760px;margin:0 auto;background:linear-gradient(160deg,#2d1f47,#211d25 55%)}
.pw-head{display:flex;gap:12px;align-items:center}
.pw-ico{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:21px;background:rgba(176,128,255,.18);flex-shrink:0}
.pw-name{font-weight:700;font-size:16px}
.pw-by{font-size:12px;color:var(--pw-mu)}
.pw-pill{font-size:10px;padding:1px 7px;border-radius:9px;background:var(--pw-bd)}
.pw-summary{margin:0;color:var(--pw-mu);font-size:14px}
.pw-strip{display:flex;gap:4px;align-items:center;font-size:11.5px;background:var(--pw-bg);border-radius:8px;padding:8px}
.pw-strip div{flex:1;text-align:center;background:var(--pw-bg1);border-radius:6px;padding:6px 4px}
.pw-strip b{display:block;color:var(--pw-ac);font-size:9.5px;letter-spacing:.06em;margin-bottom:2px}
.pw-strip span{color:var(--pw-mu)}
.pw-foot{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:auto}
.pw-btn{font:inherit;font-size:13px;background:var(--pw-btn);color:#fff;border:0;border-radius:7px;padding:6px 12px;cursor:pointer}
.pw-btn.pw-ghost{background:transparent;color:var(--pw-mu);border:1px solid var(--pw-bd)}
.pw-state{color:var(--pw-ok);font-size:13px}
.pw-link{font:inherit;font-size:13px;color:var(--pw-ac);background:none;border:0;cursor:pointer;text-decoration:none;padding:0}
.pw-lbl{font-size:10px;letter-spacing:.1em;color:var(--pw-ac);font-weight:700;margin-top:6px}
.pw-chips{display:flex;flex-wrap:wrap;gap:6px}
.pw-gets{list-style:none;margin:0;padding:0}
.pw-gets li::before{content:"✓ ";color:var(--pw-ok)}
.pw-source{margin:0;font-size:13px;color:var(--pw-mu)}
.pw-source a{color:var(--pw-ac)}
.pw-diagram{width:100%;max-width:520px;height:auto;display:block;margin:4px auto}
.pw-diagram .pw-label{font:700 11px Inter,system-ui,sans-serif}
.pw-diagram .pw-edge{font:10px Inter,system-ui,sans-serif;fill:var(--pw-mu)}
.pw-diagram .pw-item{font:11px Inter,system-ui,sans-serif;fill:var(--pw-tx)}
.pw-banner{background:rgba(255,210,122,.12);border:1px solid rgba(255,210,122,.4);color:#ffd27a;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px}
.pw-empty{color:var(--pw-mu)}
.pw-mcp{color:var(--pw-ac);font-weight:600}
.pw-mcpstrip{list-style:none;margin:0;padding:8px 10px;background:var(--pw-bg);border-radius:8px;font-size:13px;display:flex;flex-direction:column;gap:4px}
.pw-mcpstrip code{background:var(--pw-bg3);padding:1px 6px;border-radius:5px;font-size:12px}
.pw-kind{font-size:10px;padding:1px 7px;border-radius:9px;background:var(--pw-bd);color:var(--pw-tx)}
.pw-kind.pw-local{background:rgba(255,210,122,.18);color:#ffd27a}
.pw-mcpmeta{margin:0;font-size:12px;color:var(--pw-mu)}
.pw-beta{color:#ffd27a;font-weight:700}
.pw-mode{display:inline-flex;border:1px solid var(--pw-bd);border-radius:7px;overflow:hidden}
.pw-seg{font:inherit;font-size:12px;background:transparent;color:var(--pw-mu);border:0;padding:5px 10px;cursor:pointer}
.pw-seg.pw-on{background:var(--pw-bg3);color:var(--pw-tx)}
.pw-seg.pw-on.pw-warn{background:rgba(255,210,122,.2);color:#ffd27a}
.pw-btn.pw-blocked{background:var(--pw-bg3);color:var(--pw-mu);cursor:not-allowed}
@media (max-width:560px){.pw-hero{grid-template-columns:1fr}.pw-search{margin-left:0;min-width:0;width:100%}}
`;
