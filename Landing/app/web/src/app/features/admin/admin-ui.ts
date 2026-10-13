export const ADMIN_UI_CSS = `
  :host {
    display: block;
    color: var(--text, #eef2fb);
    font-family: 'Archivo', system-ui, sans-serif;
  }
  :host * { box-sizing: border-box; }
  a { color: inherit; text-decoration: none; }
  button, input, select, textarea { font: inherit; color: inherit; }
  ul, ol { list-style: none; padding: 0; margin: 0; }

  .grid { display: grid; gap: 1rem; }
  .g4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .g2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .card { background: var(--panel, #0c1c38); border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 16px; padding: 1.15rem 1.25rem; }
  .card h3 { font-size: 1rem; font-weight: 700; margin: 0 0 0.8rem; }
  .stat b { display: block; font-size: 1.7rem; font-weight: 800; line-height: 1.1; color: var(--gold-2, #f5cc5a); }
  .stat small { color: var(--muted, #9fb0d0); font-size: 0.82rem; }

  .bar { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .bar .grow { flex: 1; }
  .search { flex: 1; min-width: 180px; max-width: 340px; padding: 0.55rem 0.85rem; border-radius: 10px;
    background: rgba(0, 0, 0, 0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); color: var(--text, #eef2fb); }
  .search::placeholder { color: var(--faint, #6e7f9e); }
  .search:focus, select:focus, input:focus, textarea:focus { outline: none; border-color: var(--gold, #e8b64a); box-shadow: 0 0 0 3px rgba(232, 182, 74, 0.18); }
  .filter { width: auto; flex: 0 0 auto; min-width: 150px; max-width: 220px;
    padding: 0.55rem 0.7rem; border-radius: 10px; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); color: var(--text, #eef2fb); }
  .filter option { background: var(--panel, #0c1c38); color: var(--text, #eef2fb); }

  .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.05rem; border-radius: 10px;
    border: 1px solid var(--line-2, rgba(255,255,255,0.16)); background: rgba(255, 255, 255, 0.05); font-weight: 700;
    font-size: 0.88rem; cursor: pointer; transition: 0.15s; color: var(--text, #eef2fb); }
  .btn:hover { background: rgba(255, 255, 255, 0.1); }
  .btn-gold { background: linear-gradient(180deg, #f5cc5a, #e0a92e); color: #241a02; border: 0; box-shadow: 0 8px 18px -8px rgba(232, 182, 74, 0.55); }
  .btn-gold:hover { filter: brightness(1.06); background: linear-gradient(180deg, #f5cc5a, #e0a92e); }
  .btn-danger { color: #fecdd3; border-color: rgba(251, 113, 133, 0.5); background: rgba(251, 113, 133, 0.12); }
  .btn-danger:hover { background: rgba(251, 113, 133, 0.22); }

  /* Shared row-actions "3 dots" menu — a compact dropdown instead of a
     row of buttons that can overflow once a row has more than 2-3
     possible actions (View / Edit / Archive / Delete / ...). */
  .kebab-wrap { position: relative; display: inline-block; }
  .kebab-btn { padding: 0.35rem 0.55rem; font-weight: 800; line-height: 1; }
  .kebab-menu {
    /* position/top/right here are the fallback for anything not yet
       passing computed menuPos coordinates — every page using this menu
       now sets [style.position]="'fixed'" plus [style.top.px]/[style.right.px]
       from the button's own getBoundingClientRect(), which override these
       via inline-style precedence. That's what keeps the menu from being
       clipped by an ancestor .tbl-wrap's overflow:auto (needed for
       horizontal scroll on narrow viewports — overflow:auto on any axis
       clips a position:absolute descendant on both axes, not just the one
       that actually needs scrolling). */
    position: absolute; top: calc(100% + 0.3rem); right: 0; z-index: 20; min-width: 220px;
    background: var(--panel-2, #10254a); border: 1px solid var(--line, rgba(255,255,255,0.09));
    border-radius: 10px; padding: 0.4rem; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
    display: flex; flex-direction: column; gap: 0.25rem;
  }
  .kebab-menu button {
    text-align: left; padding: 0.5rem 0.6rem; border-radius: 7px; border: none;
    background: none; color: var(--text, #eef2fb); font: inherit; font-size: 0.84rem; cursor: pointer;
  }
  .kebab-menu button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
  .kebab-menu button:disabled { color: var(--faint, #6e7f9e); cursor: not-allowed; }
  .kebab-menu button.danger { color: #fecdd3; }
  .kebab-menu button.danger:hover { background: rgba(251, 113, 133, 0.14); }
  .kebab-menu small { padding: 0.1rem 0.6rem 0.2rem; color: var(--faint, #6e7f9e); font-size: 0.72rem; line-height: 1.4; }
  .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.78rem; border-radius: 8px; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .tbl-wrap { background: var(--panel, #0c1c38); border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 16px; overflow: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 640px; }
  th { text-align: left; font-size: 0.7rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--faint, #6e7f9e);
    padding: 0.85rem 1rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); white-space: nowrap; }
  td { padding: 0.78rem 1rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); vertical-align: middle; }
  tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: rgba(255, 255, 255, 0.025); }
  td .b { font-weight: 700; }
  td small { display: block; color: var(--faint, #6e7f9e); font-size: 0.76rem; }
  .acts { display: flex; gap: 0.35rem; justify-content: flex-end; white-space: nowrap; }
  .empty { padding: 2.2rem 1rem; text-align: center; color: var(--faint, #6e7f9e); }

  .bdg { display: inline-block; padding: 0.18rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; }
  .bdg.blue { background: rgba(59, 130, 246, 0.16); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); }
  .bdg.green { background: rgba(52, 211, 153, 0.14); color: #86efac; border: 1px solid rgba(52, 211, 153, 0.4); }
  .bdg.gold { background: rgba(232, 182, 74, 0.14); color: var(--gold-2, #f5cc5a); border: 1px solid rgba(232, 182, 74, 0.4); }
  .bdg.purple { background: rgba(167, 139, 250, 0.14); color: #d8ccff; border: 1px solid rgba(167, 139, 250, 0.4); }
  .bdg.pink { background: rgba(236, 72, 153, 0.14); color: #f9a8d4; border: 1px solid rgba(236, 72, 153, 0.4); }
  .bdg.red { background: rgba(251, 113, 133, 0.14); color: #fecdd3; border: 1px solid rgba(251, 113, 133, 0.4); }
  .bdg.grey { background: rgba(255, 255, 255, 0.07); color: var(--muted, #9fb0d0); border: 1px solid var(--line-2, rgba(255,255,255,0.16)); }

  .tabs { display: inline-flex; gap: 0.25rem; padding: 0.25rem; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 11px; margin-bottom: 1rem; }
  .tab { border: 0; background: none; color: var(--muted, #9fb0d0); font-weight: 700; font-size: 0.85rem; padding: 0.45rem 0.95rem; border-radius: 8px; cursor: pointer; }
  .tab.on { background: linear-gradient(180deg, #f5cc5a, #e0a92e); color: #241a02; }

  .modal-root { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 1rem;
    background: rgba(3, 8, 18, 0.72); backdrop-filter: blur(6px); overflow-y: auto; }
  .modal { width: min(560px, 100%); background: var(--panel-2, #10254a); border: 1px solid var(--line-2, rgba(255,255,255,0.16)); border-radius: 18px;
    box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.7); max-height: 92vh; overflow-y: auto; }
  .modal.wide { width: min(760px, 100%); }
  .m-head { display: flex; align-items: center; justify-content: space-between; padding: 1.05rem 1.3rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); }
  .m-head h3 { font-size: 1.05rem; font-weight: 800; margin: 0; }
  .m-x { background: none; border: 0; color: var(--muted, #9fb0d0); font-size: 1.2rem; cursor: pointer; }
  .m-x:hover { color: #fff; }
  .m-body { padding: 1.2rem 1.3rem; }
  .m-foot { display: flex; justify-content: flex-end; gap: 0.6rem; padding: 1rem 1.3rem; border-top: 1px solid var(--line, rgba(255,255,255,0.09)); }
  .f-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
  .f { margin-bottom: 0.9rem; }
  .f.full { grid-column: 1 / -1; }
  .f label { display: block; font-size: 0.78rem; font-weight: 700; color: var(--muted, #9fb0d0); margin-bottom: 0.32rem; }
  .f input, .f select, .f textarea { width: 100%; padding: 0.6rem 0.8rem; border-radius: 10px;
    background: rgba(0, 0, 0, 0.3); border: 1px solid var(--line, rgba(255,255,255,0.09)); color: var(--text, #eef2fb); }
  .f textarea { min-height: 96px; resize: vertical; }
  .f select option { background: var(--panel-2, #10254a); color: var(--text, #eef2fb); }
  .f .hint { font-size: 0.78rem; color: var(--faint, #6e7f9e); margin-top: 0.3rem; }
  .time-pick { display: flex; align-items: center; gap: 0.4rem; }
  .time-pick select { width: auto; flex: 1; min-width: 0; }
  .time-pick select.ap { flex: 0 0 auto; }
  .time-pick .tsep { color: var(--faint, #6e7f9e); font-weight: 800; }
  .mods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem 0.9rem; }
  .mods .chk { display: flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; cursor: pointer; }
  .mods .chk input { width: auto; accent-color: var(--gold, #e8b64a); flex: 0 0 auto; }
  .dl { display: grid; grid-template-columns: 130px 1fr; gap: 0.45rem 1rem; font-size: 0.92rem; }
  .dl dt { color: var(--faint, #6e7f9e); font-weight: 600; }
  .dl dd { font-weight: 600; margin: 0; }
  .sec { font-size: 0.72rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--faint, #6e7f9e);
    font-weight: 800; margin: 1.15rem 0 0.5rem; }
  table.mini { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  table.mini th { text-align: left; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint, #6e7f9e);
    padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.09)); }
  table.mini td { padding: 0.5rem; border-bottom: 1px solid var(--line, rgba(255,255,255,0.07)); }
  table.mini tr:last-child td { border-bottom: 0; }
  .resp { border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 12px; padding: 0.8rem 0.95rem; margin-bottom: 0.65rem; background: rgba(0, 0, 0, 0.18); }
  .resp .q { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.35rem; }
  .resp .a { font-size: 0.84rem; color: var(--muted, #9fb0d0); }
  .resp .ok { color: #86efac; font-weight: 700; }
  .resp .bad { color: #fecdd3; font-weight: 700; }
  .opt-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; }
  .opt-row .key { width: 26px; height: 26px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 7px;
    background: rgba(255, 255, 255, 0.07); border: 1px solid var(--line-2, rgba(255,255,255,0.16)); font-weight: 800; font-size: 0.75rem; }
  .toast { position: fixed; bottom: 1.4rem; left: 50%; transform: translateX(-50%); z-index: 99;
    background: var(--panel-2, #10254a); border: 1px solid var(--line-2, rgba(255,255,255,0.16)); border-radius: 999px; padding: 0.65rem 1.2rem;
    font-weight: 700; font-size: 0.9rem; box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.7); }
  .err { background: rgba(220, 38, 38, 0.14); border: 1px solid rgba(220, 38, 38, 0.45); color: #fecaca;
    padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.85rem; margin-bottom: 1rem; }
  .sp-cell { display: flex; align-items: center; gap: 0.65rem; }
  .sp-logo { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 40px; height: 40px;
    border-radius: 10px; font-weight: 800; font-size: 1.05rem; color: #241a02;
    background: linear-gradient(180deg, #f5cc5a, #e0a92e); border: 1px solid rgba(232, 182, 74, 0.4); overflow: hidden; }
  .sp-logo img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
  tr.top1 td { background: rgba(232, 182, 74, 0.08); }
  .pager { display: flex; align-items: center; justify-content: flex-end; gap: 0.6rem; margin-top: 0.9rem; font-size: 0.85rem; color: var(--muted, #9fb0d0); }
  .bulk-summary { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.9rem 0; }
  .bulk-errors-wrap { max-height: 260px; overflow-y: auto; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 10px; }
  .bulk-errors-wrap table.mini th { position: sticky; top: 0; background: var(--panel-2, #10254a); }

  .img-pick { display: flex; align-items: center; gap: 0.8rem; }
  .img-pick-thumb {
    width: 56px; height: 56px; flex: 0 0 auto; object-fit: contain; border-radius: 8px;
    background: rgba(255, 255, 255, 0.04); border: 1px solid var(--line, rgba(255,255,255,0.09));
  }
  .img-pick-thumb.empty-thumb { display: grid; place-items: center; color: var(--faint, #6e7f9e); font-size: 0.8rem; }
  .img-pick-body { display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
  .img-pick-name { font-size: 0.82rem; color: var(--muted, #9fb0d0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .img-pick-actions { display: flex; gap: 0.5rem; }

  .merge-results { margin-top: 0.35rem; border: 1px solid var(--line, rgba(255,255,255,0.09)); border-radius: 10px;
    background: rgba(0, 0, 0, 0.3); max-height: 220px; overflow-y: auto; }
  .merge-results button { display: block; width: 100%; text-align: left; padding: 0.55rem 0.8rem; border: 0;
    background: none; color: var(--text, #eef2fb); font-size: 0.85rem; cursor: pointer;
    border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); }
  .merge-results button:last-child { border-bottom: 0; }
  .merge-results button:hover { background: rgba(232, 182, 74, 0.12); }

  .checklist-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.5rem 1rem;
    max-height: 220px; overflow-y: auto; padding: 0.7rem 0.85rem; border-radius: 8px;
    background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line, rgba(255,255,255,0.09));
  }
  .checklist-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text, #f5f4ff);
    font-weight: 400; cursor: pointer; }
  .checklist-item input { width: auto; flex: 0 0 auto; }

  .opt-builder { display: flex; flex-direction: column; gap: 0.55rem; }
  .opt-row { display: flex; align-items: center; gap: 0.6rem; }
  .opt-row input[type="text"] { flex: 1; margin: 0; }
  .opt-row input[type="checkbox"], .opt-row input[type="radio"] { flex: 0 0 auto; width: 18px; height: 18px; accent-color: var(--gold, #e8b64a); cursor: pointer; }
  .opt-remove {
    flex: 0 0 auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line, rgba(255,255,255,0.09));
    background: rgba(255, 255, 255, 0.03); color: var(--muted, #9fb0d0); cursor: pointer; font-size: 0.85rem;
  }
  .opt-remove:hover:not(:disabled) { background: rgba(251, 113, 133, 0.14); color: #fecdd3; border-color: rgba(251, 113, 133, 0.4); }
  .opt-remove:disabled { opacity: 0.35; cursor: not-allowed; }

  @media (max-width: 900px) {
    .g4 { grid-template-columns: 1fr 1fr; }
    .g2 { grid-template-columns: 1fr; }
    .f-row { grid-template-columns: 1fr; gap: 0; }
    .filter, .search { width: 100%; max-width: none; }

    /* Main data grids only (table.mini stays a real, scrollable table —
       those live inside an already-narrow modal, where a full label/value
       stack per row would cost more room than it saves). Each <tr> becomes
       its own card; each <td> becomes a label/value line using its
       data-label attribute — set per column by the page (see
       admin-crud.page.ts / admin-competitions.page.ts). A <td> with no
       data-label (the trailing actions cell) just renders an empty
       ::before, which collapses to nothing and leaves the kebab button
       flush right via the same justify-content:space-between. */
    .tbl-wrap { overflow: visible; border: none; background: none; border-radius: 0; }
    .tbl-wrap table { min-width: 0; width: 100%; }
    .tbl-wrap table thead { display: none; }
    .tbl-wrap table, .tbl-wrap table tbody, .tbl-wrap table tr, .tbl-wrap table td { display: block; width: 100%; }
    .tbl-wrap table tr {
      margin-bottom: 0.7rem; border: 1px solid var(--line, rgba(255,255,255,0.09));
      border-radius: 14px; padding: 0.3rem 0.9rem; background: var(--panel, #0c1c38);
    }
    .tbl-wrap table tr:last-child { margin-bottom: 0; }
    .tbl-wrap table td {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.55rem 0; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); text-align: right;
    }
    .tbl-wrap table td:last-child { border-bottom: 0; }
    .tbl-wrap table td::before {
      content: attr(data-label); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em;
      text-transform: uppercase; color: var(--faint, #6e7f9e); text-align: left; flex-shrink: 0;
    }
    .tbl-wrap .empty { padding: 1.4rem 0.5rem; }
  }
`;
