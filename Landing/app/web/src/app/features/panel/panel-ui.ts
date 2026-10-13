// Shared styles of the panel portal: a calm, high-contrast layout that works on a phone or a
// tablet held in one hand, with large touch targets.
export const PANEL_CSS = `
  :host { display: block; }
  .pn-wrap { max-width: 960px; margin: 0 auto; padding: 1.2rem 1rem 4rem; }
  .pn-h1 { font-size: 1.5rem; margin: 0 0 0.3rem; }
  .pn-sub { color: var(--muted, #9fb0d0); margin: 0 0 1.2rem; font-size: 0.92rem; }
  .pn-back { display: inline-block; color: var(--muted, #9fb0d0); font-weight: 600; font-size: 0.88rem; margin-bottom: 0.8rem; }
  .pn-back:hover { color: var(--gold, #f5cc5a); }
  .pn-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
  .pn-card { background: var(--panel, rgba(255,255,255,0.05)); border: 1px solid var(--line-2, rgba(255,255,255,0.14)); border-radius: 16px; padding: 1.1rem 1.2rem; }
  .pn-card h3 { margin: 0 0 0.25rem; font-size: 1.05rem; }
  .pn-muted { color: var(--muted, #9fb0d0); font-size: 0.85rem; }
  .pn-pill { display: inline-block; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; padding: 0.2rem 0.65rem; border-radius: 999px; border: 1px solid var(--line-2, rgba(255,255,255,0.18)); }
  .pn-pill.go { background: rgba(52,211,153,0.16); border-color: rgba(52,211,153,0.5); color: #6ee7b7; }
  .pn-pill.wait { background: rgba(232,182,74,0.15); border-color: rgba(232,182,74,0.5); color: #f5cc5a; }
  .pn-pill.done { background: rgba(148,163,184,0.15); color: #cbd5e1; }
  .pn-bar { height: 8px; border-radius: 5px; background: rgba(255,255,255,0.09); overflow: hidden; margin: 0.7rem 0 0.3rem; }
  .pn-bar i { display: block; height: 100%; background: linear-gradient(90deg, #f5cc5a, #e0a92e); }
  .pn-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; min-height: 44px; padding: 0.55rem 1.1rem; border-radius: 12px; border: 1px solid var(--line-2, rgba(255,255,255,0.2)); background: rgba(255,255,255,0.06); color: inherit; font-weight: 700; cursor: pointer; font-size: 0.92rem; }
  .pn-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
  .pn-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .pn-btn.gold { background: linear-gradient(180deg, #f5cc5a, #e0a92e); color: #241a02; border-color: transparent; }
  .pn-row { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.9rem; }
  .pn-row input, .pn-row select { min-height: 44px; padding: 0.5rem 0.8rem; border-radius: 12px; border: 1px solid var(--line-2, rgba(255,255,255,0.2)); background: rgba(0,0,0,0.25); color: inherit; font-size: 0.95rem; }
  .pn-row .grow { flex: 1 1 200px; }
  .pn-err { background: rgba(251,113,133,0.12); border: 1px solid rgba(251,113,133,0.45); color: #fda4af; padding: 0.7rem 0.9rem; border-radius: 12px; margin-bottom: 1rem; }
  .pn-ok { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.4); color: #6ee7b7; padding: 0.7rem 0.9rem; border-radius: 12px; margin-bottom: 1rem; }
  .pn-list { display: grid; gap: 0.6rem; }
  .pn-item { display: flex; gap: 0.8rem; align-items: center; justify-content: space-between; flex-wrap: wrap; background: var(--panel, rgba(255,255,255,0.05)); border: 1px solid var(--line, rgba(255,255,255,0.1)); border-radius: 14px; padding: 0.8rem 1rem; }
  .pn-item b { display: block; }
  textarea.pn-text { width: 100%; min-height: 110px; padding: 0.7rem 0.8rem; border-radius: 12px; border: 1px solid var(--line-2, rgba(255,255,255,0.2)); background: rgba(0,0,0,0.25); color: inherit; font: inherit; resize: vertical; }
`;
