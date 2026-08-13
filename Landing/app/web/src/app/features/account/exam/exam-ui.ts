// =====================================================================
// Full-screen exam UI (port of Landing/css/exam.css, compact layout)
// =====================================================================

export const EXAM_UI_CSS = `
.exam-page { height: 100dvh; overflow: hidden; background: var(--bg); }

/* ---------- top bar ---------- */
.exam-top {
  position: fixed; top: 0; left: 0; right: 0; height: 56px; z-index: 50;
  display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; padding: 0 clamp(0.8rem, 2.5vw, 1.4rem);
  background: rgba(6, 5, 20, 0.86); backdrop-filter: blur(16px); border-bottom: 1px solid var(--line);
}
.exam-top .brand { display: inline-flex; align-items: center; color: var(--text); }
.exam-top .brand .logo { height: 26px; width: auto; }
.et-logo-mini { display: none; height: 30px; width: auto; }
.et-mid { text-align: center; line-height: 1.1; min-width: 0; }
.et-title { display: block; font-family: var(--display); font-weight: 700; font-size: 0.94rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.et-sub { display: block; color: var(--faint); font-size: 0.72rem; }
.et-right { display: flex; align-items: center; gap: 0.6rem; }
.et-timer { display: inline-flex; align-items: center; gap: 0.4rem; font-family: var(--display); font-weight: 700; font-size: 0.92rem;
  padding: 0.4rem 0.75rem; border-radius: 10px; background: rgba(124, 58, 237, 0.18); border: 1px solid rgba(139, 92, 246, 0.45); color: #fff; font-variant-numeric: tabular-nums; }
.et-timer.warn { background: rgba(251, 113, 133, 0.18); border-color: rgba(251, 113, 133, 0.5); color: #fecdd3; animation: tkPulse 1s ease-in-out infinite; }
@keyframes tkPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
.btn-quit { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line-2); color: var(--muted); border-radius: 9px;
  padding: 0.4rem 0.75rem; font-weight: 600; font-size: 0.84rem; cursor: pointer; font-family: inherit; }
.btn-quit:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }

.exam-progress { position: fixed; top: 56px; left: 0; right: 0; height: 3px; z-index: 49; background: rgba(255, 255, 255, 0.08); }
.exam-progress span { display: block; height: 100%; width: 0; background: var(--grad); transition: width 0.3s; }

/* ---------- layout ---------- */
.exam-wrap { height: 100dvh; padding: 62px 0.9rem 0.9rem; max-width: 1100px; margin: 0 auto;
  display: flex; gap: 0.9rem; min-height: 0; }
.q-col { flex: 1; min-width: 0; overflow-y: auto; padding: 0.1rem 0.4rem 0.6rem; }

/* ---------- question ---------- */
.q-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 1.15rem 1.2rem; }
.q-top { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.85rem; flex-wrap: wrap; }
.q-cat { font-family: var(--display); font-weight: 700; font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 0.26rem 0.6rem; border-radius: 999px; background: rgba(124, 58, 237, 0.2); border: 1px solid rgba(139, 92, 246, 0.45); color: var(--violet-2); }
.q-cat.iq { background: rgba(59, 130, 246, 0.18); border-color: rgba(59, 130, 246, 0.45); color: #93c5fd; }
.q-cat.eq { background: rgba(236, 72, 153, 0.18); border-color: rgba(236, 72, 153, 0.45); color: #f9a8d4; }
.q-cat.values { background: rgba(124, 58, 237, 0.18); border-color: rgba(139, 92, 246, 0.45); color: var(--violet-2); }
.q-count { color: var(--muted); font-size: 0.82rem; font-weight: 600; margin-left: auto; }
.q-count b { color: #fff; font-family: var(--display); }
.q-timer { display: inline-flex; align-items: center; gap: 0.3rem; font-family: var(--display); font-weight: 700; font-size: 0.84rem;
  padding: 0.24rem 0.6rem; border-radius: 999px; background: rgba(124, 58, 237, 0.16); border: 1px solid rgba(139, 92, 246, 0.4);
  color: #e9d5ff; font-variant-numeric: tabular-nums; }
.q-timer.warn { background: rgba(251, 113, 133, 0.16); border-color: rgba(251, 113, 133, 0.5); color: #fecdd3; animation: tkPulse 1s ease-in-out infinite; }
.q-timer.lapsed { background: rgba(251, 113, 133, 0.13); border-color: rgba(251, 113, 133, 0.4); color: #fda4af; animation: none; }
.q-multi-hint { font-family: var(--display); font-weight: 700; font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--amber); display: block; margin-bottom: 0.7rem; }
.q-media { margin: 0.15rem 0 0.85rem; }
.q-media img, .q-media iframe, .q-media video { width: 100%; max-height: 300px; border-radius: 12px; border: 1px solid var(--line); background: #000; object-fit: cover; }
.q-text { font-family: var(--display); font-weight: 600; font-size: clamp(1.02rem, 2vw, 1.28rem); line-height: 1.4; letter-spacing: -0.01em; }
.q-lapsed-note { margin: 0.6rem 0 0.85rem; padding: 0.55rem 0.75rem; border-radius: 10px;
  background: rgba(251, 113, 133, 0.1); border: 1px solid rgba(251, 113, 133, 0.3); color: #fda4af; font-size: 0.8rem; font-weight: 600; }

.q-opts { display: grid; gap: 0.55rem; margin-top: 1rem; }
.q-opts.disabled { pointer-events: none; opacity: 0.6; }
.opt {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.66rem 0.85rem; cursor: pointer;
  border-radius: 12px; border: 1px solid var(--line); background: rgba(0, 0, 0, 0.22);
  transition: border-color 0.18s, background 0.18s, transform 0.1s;
}
.opt:hover { border-color: var(--line-2); background: rgba(255, 255, 255, 0.04); }
.opt:active { transform: scale(0.995); }
.opt .key { width: 28px; height: 28px; flex: 0 0 auto; border-radius: 8px; display: grid; place-items: center;
  font-family: var(--display); font-weight: 800; font-size: 0.86rem; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--line-2); color: var(--muted); transition: 0.18s; }
.opt .otext { font-weight: 500; line-height: 1.4; font-size: 0.95rem; }
.opt.sel { border-color: var(--violet-2); background: rgba(124, 58, 237, 0.16); }
.opt.sel .key { background: var(--grad); border-color: transparent; color: #0a0820; }
.opt.correct { border-color: rgba(52, 211, 153, 0.55); background: rgba(52, 211, 153, 0.14); }
.opt.correct .key { background: var(--green); border-color: transparent; color: #04211a; }
.opt.wrong { border-color: rgba(251, 113, 133, 0.55); background: rgba(251, 113, 133, 0.14); }
.opt.wrong .key { background: var(--red); border-color: transparent; color: #2a0710; }
.reviewing .opt { cursor: pointer; }
.locked .opt { cursor: default; }

.q-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; margin-top: 0.85rem; }
.q-foot .btn { flex: 0 0 auto; }
.q-block-note { margin: 0.55rem 0 0; text-align: right; font-size: 0.78rem; font-weight: 600; color: var(--amber);
  opacity: 0; transition: opacity 0.2s; min-height: 1rem; }
.q-block-note.show { opacity: 1; }

/* ---------- palette (always open sidebar) ---------- */
.palette { flex: 0 0 300px; min-height: 0; }
.pal-card { height: 100%; overflow-y: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 1rem; }
.pal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem; }
.pal-head h3 { font-family: var(--display); font-weight: 700; font-size: 0.95rem; margin: 0; }
.pal-status { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--violet-2);
  background: rgba(124, 58, 237, 0.15); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 999px; padding: 0.16rem 0.55rem; }
.pal-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; }
.pal-grid button { aspect-ratio: 1; border-radius: 9px; border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.04);
  color: var(--muted); font-family: var(--display); font-weight: 800; font-size: 0.88rem; cursor: pointer; transition: 0.15s; }
.pal-grid button:hover { transform: translateY(-1px); }
.pal-grid button.answered { background: rgba(52, 211, 153, 0.22); border-color: rgba(52, 211, 153, 0.5); color: #d1fae5; }
.pal-grid button.lapsed { background: rgba(251, 113, 133, 0.16); border-color: rgba(251, 113, 133, 0.45); color: #fda4af; text-decoration: line-through; }
.pal-grid button.current { outline: 2px solid var(--violet-2); outline-offset: 1px; color: #fff; }

.pal-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem 0.7rem; margin: 0.9rem 0; font-size: 0.74rem; color: var(--muted); }
.pal-legend li { display: flex; align-items: center; gap: 0.4rem; }
.lg { width: 13px; height: 13px; border-radius: 5px; flex: 0 0 auto; }
.sw-answered { background: rgba(52, 211, 153, 0.4); border: 1px solid rgba(52, 211, 153, 0.6); }
.sw-current { background: transparent; border: 2px solid var(--violet-2); }
.sw-lapsed { background: rgba(251, 113, 133, 0.35); border: 1px solid rgba(251, 113, 133, 0.55); }
.sw-empty { background: rgba(255, 255, 255, 0.06); border: 1px solid var(--line-2); }
.pal-counts { display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.9rem; font-size: 0.8rem; color: var(--muted); }
.pal-counts b { color: #fff; font-family: var(--display); }

/* ---------- result ---------- */
.result { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 1.2rem; overflow-y: auto;
  background: rgba(4, 3, 14, 0.86); backdrop-filter: blur(10px); }
.res-card { width: min(540px, 100%); text-align: center; background: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
  border: 1px solid var(--line-2); border-radius: 24px; padding: clamp(1.4rem, 4vw, 2.2rem); box-shadow: var(--shadow); margin: 2rem 0; }
.res-ring { position: relative; width: 148px; height: 148px; margin: 0 auto 1.1rem; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(var(--violet) calc(var(--p, 0) * 1%), rgba(255, 255, 255, 0.08) 0); }
.res-ring::before { content: ""; position: absolute; width: 118px; height: 118px; border-radius: 50%; background: #0c0a20; }
.res-pct { position: relative; z-index: 1; }
.res-pct b { display: block; font-family: var(--display); font-weight: 800; font-size: 2.3rem; line-height: 1; }
.res-pct small { color: var(--muted); font-size: 0.78rem; }
.res-title { font-family: var(--display); font-weight: 800; font-size: clamp(1.4rem, 4vw, 1.9rem); }
.res-sub { color: var(--muted); margin: 0.4rem 0 1.3rem; }
.res-breakdown { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-bottom: 1.4rem; }
.res-breakdown .rb { background: rgba(0, 0, 0, 0.25); border: 1px solid var(--line); border-radius: 12px; padding: 0.8rem 0.5rem; }
.res-breakdown .rb b { display: block; font-family: var(--display); font-weight: 800; font-size: 1.2rem; }
.res-breakdown .rb small { color: var(--muted); font-size: 0.74rem; }
.res-actions { display: flex; gap: 0.7rem; justify-content: center; flex-wrap: wrap; }

/* ---------- error / loading ---------- */
.exam-state { display: grid; place-items: center; min-height: calc(100vh - 56px); padding: 2rem; }
.exam-state-card { max-width: 480px; text-align: center; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 2rem; }
.exam-state-card .big { font-size: 2.4rem; margin-bottom: 0.6rem; }
.exam-state-card h3 { font-family: var(--display); font-weight: 800; font-size: 1.3rem; margin: 0 0 0.4rem; }
.exam-state-card p { color: var(--muted); margin: 0 0 1.2rem; }

/* ---------- responsive ---------- */
@media (max-width: 900px) {
  .exam-wrap { flex-direction: column; }
  .palette { flex: 0 0 auto; }
  .pal-card { height: auto; max-height: 30vh; }
  .pal-grid { grid-template-columns: repeat(8, 1fr); }
}
@media (max-width: 860px) {
  .et-mid { display: none; }
}
@media (max-width: 560px) {
  .et-logo-full { display: none; }
  .et-logo-mini { display: block; }
  .exam-top { padding: 0 0.8rem; }
  .et-right { gap: 0.45rem; }
  .et-timer { font-size: 0.88rem; padding: 0.36rem 0.65rem; }
  .btn-quit { padding: 0.38rem 0.6rem; font-size: 0.8rem; }
  .q-foot { gap: 0.5rem; }
  .q-foot .btn { padding: 0.62rem 0.75rem; font-size: 0.88rem; }
  .pal-grid { grid-template-columns: repeat(6, 1fr); }
  .res-actions { flex-direction: column; }
  .res-actions .btn { width: 100%; }
}
`;
