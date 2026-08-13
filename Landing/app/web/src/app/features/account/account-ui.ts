// =====================================================================
// Shared styles for the student account area (port of Landing/css/dashboard.css)
// =====================================================================

export const ACCOUNT_UI_CSS = `
/* ---------- shell layout ---------- */
.acc-top {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50; height: var(--nav-h);
  display: flex; align-items: center; gap: 1.2rem; padding: 0 1.5rem;
  background: rgba(7, 16, 33, 0.86); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line);
}
.acc-top .brand { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 0.55rem;
  font-family: var(--display); font-weight: 800; letter-spacing: 0.05em; font-size: 1.02rem; }
.acc-top .brand .logo { width: 30px; height: 30px; }
.acc-top .brand .b2 { background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.acc-nav { display: flex; align-items: center; gap: 0.15rem; margin: 0 auto; }
.acc-nav a { position: relative; color: rgba(255, 255, 255, 0.78); font-family: var(--display);
  font-weight: 600; font-size: 0.84rem; letter-spacing: 0.02em; padding: 0.5rem 0.85rem; border-radius: 10px; transition: color 0.2s, background 0.2s; }
.acc-nav a:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }
.acc-nav a.active { color: var(--gold); background: rgba(232, 182, 74, 0.1); }
.acc-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 0.7rem; }

/* ---------- user menu ---------- */
.user-menu { position: relative; }
.user-btn {
  display: flex; align-items: center; gap: 0.6rem; cursor: pointer;
  background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line-2); border-radius: 999px;
  padding: 0.3rem 0.7rem 0.3rem 0.3rem; color: var(--text); transition: background 0.2s, border-color 0.2s;
}
.user-btn:hover { background: rgba(255, 255, 255, 0.1); }
.user-av { width: 34px; height: 34px; border-radius: 50%; background: var(--grad);
  display: grid; place-items: center; font-family: var(--display); font-weight: 800; font-size: 0.8rem; color: #0a0820; }
.user-name { font-family: var(--display); font-weight: 600; font-size: 0.92rem; max-width: 9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-caret { color: var(--muted); transition: transform 0.25s; font-size: 0.7rem; }
.user-menu.open .user-caret { transform: rotate(180deg); }

.user-drop {
  position: absolute; top: calc(100% + 0.6rem); right: 0; width: 260px; z-index: 60;
  background: rgba(13, 12, 33, 0.98); border: 1px solid var(--line-2); border-radius: 16px; padding: 0.5rem;
  box-shadow: var(--shadow); opacity: 0; transform: translateY(-8px) scale(0.98); pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
}
.user-menu.open .user-drop { opacity: 1; transform: none; pointer-events: auto; }
.ud-head { display: flex; align-items: center; gap: 0.7rem; padding: 0.6rem 0.7rem 0.8rem; border-bottom: 1px solid var(--line); margin-bottom: 0.4rem; }
.ud-av { width: 42px; height: 42px; border-radius: 50%; background: var(--grad); display: grid; place-items: center;
  font-family: var(--display); font-weight: 800; font-size: 0.95rem; color: #0a0820; }
.ud-head b { display: block; font-family: var(--display); font-weight: 700; font-size: 0.96rem; }
.ud-head small { color: var(--faint); font-size: 0.8rem; display: block; max-width: 13rem; overflow: hidden; text-overflow: ellipsis; }
.user-drop a, .user-drop button {
  display: flex; align-items: center; gap: 0.7rem; width: 100%; text-align: left;
  padding: 0.7rem; border-radius: 10px; color: var(--muted); font-size: 0.92rem; font-weight: 600;
  background: none; border: 0; cursor: pointer; font-family: inherit;
}
.user-drop a:hover, .user-drop button:hover { background: rgba(139, 92, 246, 0.16); color: #fff; }
.user-drop .ud-logout { color: #fda4af; margin-top: 0.2rem; border-top: 1px solid var(--line); }
.user-drop .ud-logout:hover { background: rgba(251, 113, 133, 0.14); color: #fff; }

/* ---------- main area ---------- */
.acc-main { max-width: var(--maxw); margin: 0 auto; padding: calc(var(--nav-h) + 1.4rem) 1.5rem 3rem; min-height: 100vh; }
.acc-foot { max-width: var(--maxw); margin: 0 auto; padding: 1.4rem 1.5rem 2rem; border-top: 1px solid var(--line);
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; color: var(--faint); font-size: 0.85rem; }
.acc-foot b { color: var(--muted); }

/* ---------- page header ---------- */
.acc-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.4rem; }
.acc-eyebrow { font-family: var(--display); font-weight: 700; font-size: 0.72rem; letter-spacing: 0.26em; text-transform: uppercase;
  background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.acc-title { font-size: clamp(1.6rem, 3.4vw, 2.2rem); margin: 0.25rem 0 0.35rem; }
.acc-sub { color: var(--muted); max-width: 62ch; font-size: 0.98rem; }
.acc-actions-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

/* ---------- cards & grid ---------- */
.acc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.1rem; margin-top: 1.1rem; }
.card { padding: 1.4rem; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); }
.card.wide { grid-column: 1 / -1; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; margin-bottom: 1rem; }
.card-head h3 { font-family: var(--display); font-weight: 700; font-size: 1.1rem; }
.card-head .tag { font-size: 0.78rem; }

/* ---------- stat tiles ---------- */
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
.stat { display: flex; align-items: center; gap: 0.85rem; padding: 1.1rem 1.2rem; border-radius: 18px;
  background: var(--surface); border: 1px solid var(--line); min-width: 0; }
.stat-ic { width: 48px; height: 48px; flex: 0 0 auto; border-radius: 14px; display: grid; place-items: center; font-size: 1.5rem; }
.stat-ic.iq { background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.45); }
.stat-ic.eq { background: rgba(236, 72, 153, 0.2); border: 1px solid rgba(236, 72, 153, 0.45); }
.stat-ic.val { background: rgba(124, 58, 237, 0.2); border: 1px solid rgba(124, 58, 237, 0.45); }
.stat-ic.amber { background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.45); }
.stat-ic.green { background: rgba(52, 211, 153, 0.2); border: 1px solid rgba(52, 211, 153, 0.45); }
.stat-ic.red { background: rgba(251, 113, 133, 0.2); border: 1px solid rgba(251, 113, 133, 0.45); }
.stat b { font-family: var(--display); font-weight: 800; font-size: 1.4rem; line-height: 1; display: block; white-space: nowrap; }
.stat small { color: var(--muted); font-size: 0.82rem; }
.stat > div { min-width: 0; }

/* ---------- badges / tags ---------- */
.tag { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.22rem 0.6rem; border-radius: 999px;
  font-family: var(--display); font-weight: 700; font-size: 0.72rem; letter-spacing: 0.02em; }
.tag-green { background: rgba(52, 211, 153, 0.14); color: var(--green); border: 1px solid rgba(52, 211, 153, 0.35); }
.tag-amber { background: rgba(251, 191, 36, 0.14); color: var(--amber); border: 1px solid rgba(251, 191, 36, 0.35); }
.tag-red { background: rgba(251, 113, 133, 0.14); color: var(--red); border: 1px solid rgba(251, 113, 133, 0.35); }
.tag-violet { background: rgba(139, 92, 246, 0.16); color: var(--violet-2); border: 1px solid rgba(139, 92, 246, 0.4); }
.tag-blue { background: rgba(59, 130, 246, 0.16); color: var(--blue); border: 1px solid rgba(59, 130, 246, 0.4); }
.tag-muted { background: rgba(255, 255, 255, 0.06); color: var(--muted); border: 1px solid var(--line); }
.tag-gold { background: rgba(232, 182, 74, 0.14); color: var(--gold); border: 1px solid rgba(232, 182, 74, 0.4); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

/* ---------- segmented control ---------- */
.seg { display: inline-flex; padding: 0.3rem; gap: 0.2rem; border-radius: 12px; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--line); }
.seg button { background: none; border: 0; color: var(--muted); font-family: var(--display); font-weight: 700;
  font-size: 0.82rem; padding: 0.45rem 0.9rem; border-radius: 9px; cursor: pointer; transition: background 0.2s, color 0.2s; }
.seg button.active { background: var(--grad); color: #0a0820; }

/* ---------- tables ---------- */
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
table { width: 100%; border-collapse: collapse; font-size: 0.92rem; min-width: 560px; }
th { text-align: left; font-family: var(--display); font-weight: 700; font-size: 0.74rem; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--faint); padding: 0.9rem 1.1rem; border-bottom: 1px solid var(--line); background: rgba(0, 0, 0, 0.25); }
td { padding: 0.95rem 1.1rem; border-bottom: 1px solid var(--line); vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: rgba(255, 255, 255, 0.03); }
td b { color: #fff; font-family: var(--display); font-weight: 700; }
td small { color: var(--faint); }
.mono { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 0.82rem; color: var(--violet-2); }

/* ---------- progress ---------- */
.prog-track { height: 10px; border-radius: 999px; background: rgba(0, 0, 0, 0.35); overflow: hidden; }
.prog-fill { display: block; height: 100%; border-radius: 999px; background: var(--grad); }

/* ---------- lists ---------- */
.dlist { display: grid; gap: 0.7rem; }
.dlist li { display: flex; align-items: center; gap: 0.8rem; padding: 0.7rem; border-radius: 14px;
  background: rgba(0, 0, 0, 0.2); border: 1px solid var(--line); }
.dl-ic { width: 40px; height: 40px; flex: 0 0 auto; border-radius: 12px; display: grid; place-items: center; font-size: 1.2rem; }
.dl-ic.iq { background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.45); }
.dl-ic.eq { background: rgba(236, 72, 153, 0.2); border: 1px solid rgba(236, 72, 153, 0.45); }
.dl-ic.val { background: rgba(124, 58, 237, 0.2); border: 1px solid rgba(124, 58, 237, 0.45); }
.dl-ic.amber { background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.45); }
.dl-ic.blue { background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.45); }
.dl-ic.red { background: rgba(251, 113, 133, 0.2); border: 1px solid rgba(251, 113, 133, 0.45); }
.dl-ic.green { background: rgba(52, 211, 153, 0.2); border: 1px solid rgba(52, 211, 153, 0.45); }
.dlist b { display: block; font-family: var(--display); font-weight: 700; font-size: 0.92rem; }
.dlist small { color: var(--faint); font-size: 0.8rem; }
.dl-go { margin-left: auto; color: var(--violet-2); font-weight: 800; }

/* ---------- forms ---------- */
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem 1.2rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field.full { grid-column: 1 / -1; }
.field label { font-family: var(--display); font-weight: 700; font-size: 0.76rem; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--muted); }
.field input, .field select, .field textarea {
  background: rgba(0, 0, 0, 0.3); border: 1px solid var(--line-2); border-radius: 12px;
  padding: 0.72rem 0.9rem; color: var(--text); font-size: 0.95rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
}
.field input:focus, .field select:focus, .field textarea:focus { border-color: rgba(139, 92, 246, 0.7); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18); }
.field input:disabled { opacity: 0.55; }
.field textarea { resize: vertical; min-height: 110px; }
.field .hint { color: var(--faint); font-size: 0.8rem; }
.field.error input, .field.error select, .field.error textarea { border-color: rgba(251, 113, 133, 0.6); }
.err-text { color: var(--red); font-size: 0.8rem; }
.form-actions { display: flex; align-items: center; gap: 0.7rem; margin-top: 1.2rem; flex-wrap: wrap; }

/* ---------- alerts & empty ---------- */
.alert { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.85rem 1rem; border-radius: 14px; font-size: 0.9rem;
  border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.04); color: var(--muted); }
.alert.ok { border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.08); color: var(--green); }
.alert.err { border-color: rgba(251, 113, 133, 0.4); background: rgba(251, 113, 133, 0.08); color: var(--red); }
.empty { text-align: center; padding: 3rem 1.5rem; border: 1px dashed var(--line-2); border-radius: 20px; color: var(--faint); }
.empty .big { font-size: 2.4rem; margin-bottom: 0.5rem; }
.empty p { color: var(--faint); max-width: 42ch; margin: 0.3rem auto 1rem; }
.loading { text-align: center; padding: 3rem; color: var(--faint); }

/* ---------- details rows ---------- */
.kv { display: grid; grid-template-columns: 150px 1fr; gap: 0.6rem 1rem; }
.kv dt { color: var(--faint); font-size: 0.86rem; }
.kv dd { color: var(--text); font-weight: 600; font-size: 0.95rem; min-width: 0; overflow-wrap: anywhere; }

/* ---------- responsive ---------- */
@media (max-width: 900px) {
  .acc-top { flex-wrap: wrap; height: auto; padding: 0.6rem 1rem; gap: 0.5rem; }
  .acc-top .brand { font-size: 0.95rem; }
  .acc-nav { order: 3; width: 100%; overflow-x: auto; justify-content: flex-start; margin: 0; padding-bottom: 0.3rem; }
  .acc-main { padding: calc(var(--nav-h) + 5.5rem) 1rem 2.5rem; }
  .acc-grid, .form-grid { grid-template-columns: 1fr; }
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .user-name { display: none; }
  .kv { grid-template-columns: 1fr; gap: 0.2rem; }
  .kv dd { margin-bottom: 0.6rem; }
}
@media (max-width: 480px) {
  .stat-grid { grid-template-columns: 1fr; }
}
`;
