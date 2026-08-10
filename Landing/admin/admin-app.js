/* India Mind League — Admin static-page interactions
   The data lives in the static HTML (per-row data-json on each <tr>).
   This script only wires the 3-dot row menus, header CTA buttons and modal
   forms; edits/adds/deletes mutate the DOM directly (no data store). */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.toISOString().slice(0, 10); }
  var COMPETITIONS = window.IML_COMPETITIONS || {};
  function compName(id) { return COMPETITIONS[id] || id || '—'; }
  function compBadge(id) { return bdg(compName(id), 'blue'); }
  function compStatus(s) { return bdg(s, s === 'Live' ? 'green' : s === 'Open' ? 'blue' : s === 'Closed' ? 'red' : 'grey'); }
  function stagesCell(r) {
    var st = (r && r.stages) || [];
    if (!st.length) return '—';
    var label = r.multi ? st.length + ' stages' : 'Single stage';
    return '<span class="bdg purple">' + esc(label) + '</span><small>' +
      st.map(function (x) { return esc(x.name) + ' · ' + esc(x.mode) + ' · pass ' + esc(x.pass) + '%' + ((x.rules && x.rules.length) ? ' · ' + x.rules.length + ' rules' : ''); }).join('<br>') + '</small>';
  }
  function payMode(m) { return bdg(m, m === 'UPI' ? 'blue' : m === 'Card' ? 'purple' : m === 'Net Banking' ? 'pink' : 'grey'); }
  function payStatus(s) { return bdg(s, s === 'Paid' ? 'green' : s === 'Pending' ? 'gold' : 'red'); }
  function tierBadge(t) { return bdg(t, t === 'Platinum' ? 'purple' : t === 'Gold' ? 'gold' : t === 'Silver' ? 'grey' : t === 'Bronze' ? 'pink' : 'blue'); }
  function sponStatus(s) { return bdg(s, s === 'Active' ? 'green' : s === 'Pending' ? 'gold' : 'red'); }
  function griType(t) { return bdg(t, t === 'Complaint' ? 'red' : t === 'Feedback' ? 'blue' : 'purple'); }
  function griStatus(s) { return bdg(s, s === 'New' ? 'gold' : s === 'In Progress' ? 'purple' : 'green'); }
  function logoHtml(r, extra) {
    var cls = 'sp-logo' + (extra || '');
    if (r && r.logo) return '<span class="' + cls + '"><img src="' + esc(r.logo) + '" alt="' + esc(r.name || '') + '" /></span>';
    var ch = (r && r.name) ? String(r.name).trim().charAt(0).toUpperCase() : '?';
    return '<span class="' + cls + '">' + esc(ch) + '</span>';
  }
  function compChecks(keys) {
    keys = keys || [];
    return '<div class="mods">' + Object.keys(COMPETITIONS).map(function (id) {
      return '<label class="chk"><input type="checkbox" name="fSponEvt" value="' + id + '"' + (keys.indexOf(id) >= 0 ? ' checked' : '') + '><span>' + esc(COMPETITIONS[id]) + '</span></label>';
    }).join('') + '</div>';
  }
  function planStatus(a) { return bdg(a ? 'Active' : 'Inactive', a ? 'green' : 'red'); }
  var PLAN_EXTRAS = [
    { label: 'Branded Booth Premium', cost: 50000 },
    { label: 'Branded Booth Basic', cost: 35000 },
    { label: 'Branded Booth Corner', cost: 15000 },
    { label: 'Catalog Listing', cost: 15000 }
  ];
  function planExtrasTotal(extras) {
    extras = extras || [];
    return PLAN_EXTRAS.reduce(function (s, x) { return s + (extras.indexOf(x.label) >= 0 ? x.cost : 0); }, 0);
  }
  function planOptionsCell(extras) {
    extras = extras || [];
    if (!extras.length) return '—';
    return extras.map(function (label) {
      var x = PLAN_EXTRAS.filter(function (p) { return p.label === label; })[0];
      return '<small>' + esc(label) + (x ? ' <span style="color:var(--gold-2)">+' + inr(x.cost) + '</span>' : '') + '</small>';
    }).join('');
  }
  function planExtrasChecks(keys) {
    keys = keys || [];
    return '<div class="mods">' + PLAN_EXTRAS.map(function (x) {
      return '<label class="chk"><input type="checkbox" name="fPlExt" value="' + esc(x.label) + '"' + (keys.indexOf(x.label) >= 0 ? ' checked' : '') + '><span>' + esc(x.label) + ' <small style="color:var(--gold-2)">+' + inr(x.cost) + '</small></span></label>';
    }).join('') + '</div>';
  }
  function planSelect(id, val) {
    var list = (window.IML_PLANS || []).filter(function (p) { return p.active; }).map(function (p) { return p.name; });
    if (!list.length) list = ['Platinum', 'Gold', 'Silver', 'Bronze'];
    if (val && list.indexOf(val) < 0) list.push(val);
    return '<select id="' + id + '">' + list.map(function (n) {
      return '<option value="' + esc(n) + '"' + (n === val ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('') + '</select>';
  }
  function syncPlans() {
    var tb = document.querySelector('tbody[data-tbody="plan"]');
    if (!tb) return;
    var rows = [];
    tb.querySelectorAll('tr[data-json]').forEach(function (tr) { try { rows.push(JSON.parse(tr.getAttribute('data-json'))); } catch (e) {} });
    window.IML_PLANS = rows.map(function (r) { return { id: r.id, name: r.name, min: r.min, benefits: r.benefits, active: r.active, extras: r.extras || [] }; });
  }
  function refreshPlanStats() {
    var tb = document.querySelector('tbody[data-tbody="plan"]');
    if (!tb) return;
    var rows = [];
    tb.querySelectorAll('tr[data-json]').forEach(function (tr) { try { rows.push(JSON.parse(tr.getAttribute('data-json'))); } catch (e) {} });
    var mins = rows.map(function (r) { return r.min || 0; });
    var set = function (id, v) { var el = $('#' + id); if (el) el.textContent = v; };
    set('stPlTotal', rows.length);
    set('stPlActive', rows.filter(function (r) { return r.active; }).length);
    set('stPlFrom', inr(mins.length ? Math.min.apply(null, mins) : 0));
    set('stPlTop', inr(mins.length ? Math.max.apply(null, mins) : 0));
  }
  function compSelect(id, val) {
    var opts = Object.keys(COMPETITIONS).map(function (cid) {
      return '<option value="' + esc(cid) + '"' + (cid === val ? ' selected' : '') + '>' + esc(COMPETITIONS[cid]) + '</option>';
    }).join('');
    return '<select id="' + id + '">' + opts + '</select>';
  }
  function compOpts() {
    var html = '<option value="All">All competitions</option>';
    Object.keys(COMPETITIONS).forEach(function (id) { html += '<option value="' + esc(id) + '">' + esc(COMPETITIONS[id]) + '</option>'; });
    return html;
  }
  function fillCompFilters() {
    document.querySelectorAll('select[data-comp]').forEach(function (s) { s.innerHTML = compOpts(); });
  }
  function applyCompFilter(val) {
    document.querySelectorAll('tbody tr[data-json]').forEach(function (tr) {
      var r = JSON.parse(tr.getAttribute('data-json'));
      tr.hidden = !(val === 'All' || String(r.comp || '') === val);
    });
  }
  var MODULES = [
    { k: 'dash', l: 'Dashboard' }, { k: 'comp', l: 'Competitions' },
    { k: 'reg', l: 'Registrations' }, { k: 'sch', l: 'Schools' },
    { k: 'q', l: 'Question Bank' }, { k: 'ex', l: 'Exam Dates' },
    { k: 'nt', l: 'Notifications' }, { k: 'ad', l: 'Admin Users' },
    { k: 'lb', l: 'Leaderboard' }, { k: 'res', l: 'Results' }
  ];
  function modLabel(k) { for (var i = 0; i < MODULES.length; i++) if (MODULES[i].k === k) return MODULES[i].l; return k; }
  function modBadges(keys) {
    keys = keys || [];
    if (!keys.length) return bdg('None', 'red');
    if (keys.length >= MODULES.length) return bdg('All modules', 'gold');
    return keys.map(function (k) { return bdg(modLabel(k), 'blue'); }).join(' ');
  }
  function modChecks(keys) {
    keys = keys || [];
    return '<div class="mods">' + MODULES.map(function (m) {
      return '<label class="chk"><input type="checkbox" name="fMod" value="' + m.k + '"' + (keys.indexOf(m.k) >= 0 ? ' checked' : '') + '><span>' + m.l + '</span></label>';
    }).join('') + '</div>';
  }
  var LETTERS = 'ABCD';
  var TYPE_PAIRS = [{ v: 'text', l: 'Text' }, { v: 'video', l: 'Watch this video' }, { v: 'image', l: 'See this Picture' }];
  var MODE_PAIRS = [{ v: 'single', l: 'Multiple Options' }, { v: 'multi', l: 'Multiselect' }];

  /* ================= toast ================= */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ================= modal ================= */
  var modalRoot = $('#modalRoot');
  function modal(title, bodyHtml, footHtml, wide) {
    if (!modalRoot) return;
    modalRoot.innerHTML =
      '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="m-head"><h3>' + esc(title) + '</h3><button class="m-x" data-close>✕</button></div>' +
      '<div class="m-body">' + bodyHtml + '</div>' +
      (footHtml ? '<div class="m-foot">' + footHtml + '</div>' : '') +
      '</div>';
    modalRoot.hidden = false;
  }
  function closeModal() { if (modalRoot) { modalRoot.hidden = true; modalRoot.innerHTML = ''; } }
  if (modalRoot) {
    modalRoot.addEventListener('click', function (e) { if (e.target === modalRoot || e.target.closest('[data-close]')) closeModal(); });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeAllMenus(); } });

  /* ================= form field builders ================= */
  function field(label, inner) { return '<div class="f"><label>' + label + '</label>' + inner + '</div>'; }
  function inp(id, val, ph, type) { return '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '" placeholder="' + (ph || '') + '" />'; }
  function sel(id, options, val) {
    return '<select id="' + id + '">' + options.map(function (o) {
      return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('') + '</select>';
  }
  function selKv(id, pairs, val) {
    return '<select id="' + id + '">' + pairs.map(function (p) {
      return '<option value="' + esc(p.v) + '"' + (p.v === val ? ' selected' : '') + '>' + esc(p.l) + '</option>';
    }).join('') + '</select>';
  }

  /* ================= badges ================= */
  function bdg(s, cls) { return '<span class="bdg ' + cls + '">' + esc(s) + '</span>'; }
  function regStatus(s) { return bdg(s, s === 'Qualified' ? 'green' : s === 'Test Taken' ? 'blue' : 'grey'); }
  function examStatus(s) { return bdg(s, s === 'Live' ? 'green' : s === 'Completed' ? 'grey' : 'gold'); }
  function catBadge(c) { return bdg(c, c === 'IQ' ? 'blue' : c === 'EQ' ? 'pink' : 'purple'); }
  function roleBadge(r) { return bdg(r, r === 'Super Admin' ? 'gold' : r === 'Editor' ? 'blue' : 'grey'); }
  function activeBadge(s) { return bdg(s, s === 'Active' ? 'green' : 'red'); }
  function scoreBadge(s, t) { return bdg(s + ' / ' + t, s >= t * 0.6 ? 'green' : s >= t * 0.4 ? 'gold' : 'red'); }
  function typeBadge(t) { return t === 'video' ? bdg('Video', 'gold') : t === 'image' ? bdg('Picture', 'pink') : bdg('Text', 'grey'); }
  function timingCell(t) {
    if (!t) return '—';
    return t.mode === 'custom' ? bdg('Custom /q', 'purple') : bdg((t.secs || 60) + 's / q', 'gold');
  }
  function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function awardBadge(a) { return bdg(a, a === 'Trophy' ? 'gold' : a === 'Medal' ? 'purple' : a === 'Certificate' ? 'blue' : a === 'Scholarship' ? 'pink' : 'green'); }
  function annCat(c) { return bdg(c, c === 'Exam' ? 'blue' : c === 'Results' ? 'green' : c === 'Event' ? 'purple' : 'grey'); }
  function annStatus(s) { return bdg(s, s === 'Active' ? 'green' : 'grey'); }
  function newsCat(c) { return bdg(c, c === 'Press' ? 'blue' : c === 'Media' ? 'purple' : c === 'Competition' ? 'gold' : 'grey'); }
  function newsStatus(s) { return bdg(s, s === 'Published' ? 'green' : 'grey'); }
  function visBadge(v) { return bdg(v, v === 'Public' ? 'green' : 'grey'); }
  function galThumb(r) {
    if (r && r.cover) return '<span class="sp-logo sm"><img src="' + esc(r.cover) + '" alt="' + esc(r.name || '') + '" /></span>';
    return '<span class="sp-logo sm">🖼</span>';
  }

  /* ================= question helpers ================= */
  function correctArray(c) { return Array.isArray(c) ? c : (c == null ? [] : [c]); }
  function correctCell(r) {
    var cs = correctArray(r.correct).filter(function (i) { return i < (r.opts || []).length; });
    return cs.map(function (i) { return LETTERS[i] + '. ' + r.opts[i]; }).join('<br>');
  }
  function qOptsHtml(mode, opts, correct) {
    var cs = correctArray(correct);
    return opts.map(function (o, i) {
      var checked = cs.indexOf(i) > -1 ? ' checked' : '';
      var input = mode === 'multi'
        ? '<input type="checkbox" name="fQCorrect" value="' + i + '"' + checked + ' />'
        : '<input type="radio" name="fQCorrect" value="' + i + '"' + checked + ' />';
      return '<div class="opt-row">' + input + '<span class="key">' + LETTERS[i] + '</span><input id="fQOpt' + i + '" value="' + esc(o) + '" placeholder="Option ' + LETTERS[i] + '" /></div>';
    }).join('');
  }
  function embedUrl(url) {
    var m = String(url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
    return m ? 'https://www.youtube.com/embed/' + m[1] : url;
  }
  function mediaHtml(r) {
    if (r.type === 'video' && r.media) {
      return '<div style="position:relative;padding-top:56.25%"><iframe src="' + esc(embedUrl(r.media)) + '" title="Question video" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px"></iframe></div>' +
        '<p style="margin-top:.7rem;color:var(--muted);font-size:.85rem">' + esc(r.q) + '</p>';
    }
    if (r.type === 'image' && r.media) {
      return '<div style="text-align:center"><img src="' + esc(r.media) + '" alt="Question image" style="max-width:100%;max-height:60vh;border-radius:12px;border:1px solid var(--line-2)" /></div>' +
        '<p style="margin-top:.7rem;color:var(--muted);font-size:.85rem">' + esc(r.q) + '</p>';
    }
    return '<p style="color:var(--muted)">' + esc(r.q) + '</p>';
  }

  /* ================= 3-dot menu ================= */
  function dotBtn() { return '<button class="dot-btn" type="button" aria-label="Actions">⋮</button>'; }
  function dotItem(label, act, danger) { return '<button type="button" data-act="' + act + '"' + (danger ? ' class="danger"' : '') + '>' + label + '</button>'; }
  function actionsCell(items) {
    return '<td style="text-align:right"><div class="acts"><div class="dotmenu">' + dotBtn() +
      '<div class="dot-menu">' + items + '</div></div></div></td>';
  }

  /* ================= entity configs ================= */
  var SCHOOLS = ['Amity International School, Saket', 'Amity International School, Noida', 'Amity International School, Gurugram 46', 'Amity International School, Vasundhara', 'Amity International School, Mayur Vihar'];

  var entities = {
    reg: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td>' +
          '<td><div class="sp-cell">' + logoHtml(r, ' avatar') +
          '<span class="meta" style="font-weight:700"><a href="student-detail.html?id=' + encodeURIComponent(r.id) + '" style="color:var(--gold-2)">' + esc(r.name) + '</a>' +
          '<small>' + esc(r.email || '') + '</small></span></div></td>' +
          '<td>' + esc(r.grade) + '</td><td>' + esc(r.school) + '</td><td>' + compBadge(r.comp) + '</td><td>' + esc(r.phone) + '</td>' +
          '<td>' + regStatus(r.status) + '</td>' +
          actionsCell(dotItem('View', 'view') + dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { name: '', grade: '9', school: '', parent: '', phone: '', email: '', comp: 'C01', status: 'Registered', photo: '' }; },
      form: function (r) {
        return '<div class="f-row">' + field('Student Name *', inp('fName', r.name, 'Full name')) + field('Class / Grade *', sel('fGrade', ['9', '10', '11', '12'], r.grade)) + '</div>' +
          '<div class="f-row">' + field('School', sel('fSchool', [''].concat(SCHOOLS), r.school)) + field('Competition', compSelect('fComp', r.comp)) + '</div>' +
          '<div class="f-row">' + field('Parent Name', inp('fParent', r.parent)) + field('Mobile *', inp('fPhone', r.phone, '10-digit mobile')) + '</div>' +
          '<div class="f-row">' + field('Email', inp('fEmail', r.email, 'name@example.com', 'email')) + field('Status', sel('fStatus', ['Registered', 'Test Taken', 'Qualified'], r.status)) + '</div>' +
          field('Profile photo URL', inp('fRegPhoto', r.photo, 'https://… or leave blank for a monogram'));
      },
      collect: function () {
        return { name: $('#fName').value.trim(), grade: $('#fGrade').value, school: $('#fSchool').value, parent: $('#fParent').value.trim(), phone: $('#fPhone').value.trim(), email: $('#fEmail').value.trim(), comp: $('#fComp').value, status: $('#fStatus').value, photo: (($('#fRegPhoto') || {}).value || '').trim() };
      },
      validate: function (d) {
        if (!d.name) return 'Student name is required';
        if (!/^[6-9]\d{9}$/.test(d.phone)) return 'Enter a valid 10-digit mobile';
        return '';
      },
      viewTitle: function (r) { return 'Registration ' + r.id; },
      view: function (r) {
        return '<dl class="dl"><dt>Student</dt><dd>' + esc(r.name) + '</dd><dt>Class / Grade</dt><dd>' + esc(r.grade) + '</dd>' +
          '<dt>School</dt><dd>' + esc(r.school) + '</dd><dt>Competition</dt><dd>' + compBadge(r.comp) + '</dd>' +
          '<dt>Parent</dt><dd>' + esc(r.parent || '—') + '</dd>' +
          '<dt>Mobile</dt><dd>' + esc(r.phone) + '</dd><dt>Email</dt><dd>' + esc(r.email || '—') + '</dd>' +
          '<dt>Registered on</dt><dd>' + esc(r.date) + '</dd><dt>Status</dt><dd>' + regStatus(r.status) + '</dd></dl>';
      },
      addTitle: 'Add Registration', editTitle: 'Edit Registration',
      saveAdd: 'Add registration', saveEdit: 'Save changes',
      idPrefix: 'R',
      prepareNew: function (d) { d.date = today(); return d; },
      deleteMsg: function (r) { return 'Delete registration of "' + r.name + '"? This cannot be undone.'; },
      addedMsg: 'Registration added', updatedMsg: 'Registration updated', deletedMsg: 'Registration deleted'
    },

    sch: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td><td class="b">' + esc(r.name) + '</td><td>' + esc(r.city) + '</td>' +
          '<td>' + esc(r.coordinator) + '</td><td>' + esc(r.contact) + '</td><td>' + esc(r.students) + '</td>' +
          actionsCell(dotItem('View', 'view') + dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { name: '', city: '', coordinator: '', contact: '', students: 0 }; },
      form: function (r) {
        return field('School Name *', inp('fSName', r.name)) +
          '<div class="f-row">' + field('City', inp('fSCity', r.city)) + field('Coordinator', inp('fSCoord', r.coordinator)) + '</div>' +
          '<div class="f-row">' + field('Contact', inp('fSContact', r.contact)) + field('Registered Students', inp('fSCount', r.students, '', 'number')) + '</div>';
      },
      collect: function () {
        return { name: $('#fSName').value.trim(), city: $('#fSCity').value.trim(), coordinator: $('#fSCoord').value.trim(), contact: $('#fSContact').value.trim(), students: parseInt($('#fSCount').value, 10) || 0 };
      },
      validate: function (d) { return d.name ? '' : 'School name is required'; },
      viewTitle: function (r) { return r.name; },
      view: function (r) {
        return '<dl class="dl"><dt>City</dt><dd>' + esc(r.city) + '</dd><dt>Coordinator</dt><dd>' + esc(r.coordinator) + '</dd>' +
          '<dt>Contact</dt><dd>' + esc(r.contact) + '</dd><dt>Registered students</dt><dd>' + esc(r.students) + '</dd></dl>';
      },
      addTitle: 'Add School', editTitle: 'Edit School',
      saveAdd: 'Add school', saveEdit: 'Save changes',
      idPrefix: 'S',
      deleteMsg: function (r) { return 'Delete "' + r.name + '"?'; },
      addedMsg: 'School added', updatedMsg: 'School updated', deletedMsg: 'School deleted'
    },

    q: {
      build: function (key, r) {
        var type = r.type || 'text';
        var smalls = [];
        if (type !== 'text' && r.media) smalls.push(r.media);
        if (r.ref) smalls.push('Ref: ' + r.ref);
        if (r.limit) smalls.push('Limit: ' + r.limit + 's');
        var actions = (type !== 'text' ? dotItem('Preview', 'preview') : '') + dotItem('Edit', 'edit') + dotItem('Delete', 'del', true);
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td>' +
          '<td>' + typeBadge(type) + '</td>' +
          '<td>' + (r.label ? bdg(r.label, 'purple') : bdg('—', 'grey')) + '</td>' +
          '<td class="b" style="max-width:360px">' + esc(r.q) + (smalls.length ? '<small>' + smalls.map(esc).join('<br>') + '</small>' : '') + '</td>' +
          '<td>' + esc(r.grade) + '</td><td>' + catBadge(r.cat) + '</td><td>' + compBadge(r.comp) + '</td>' +
          '<td>' + correctCell(r) + '</td>' +
          actionsCell(actions) + '</tr>';
      },
      defaults: function () { return { grade: '9', cat: 'IQ', type: 'text', media: '', mode: 'single', label: '', ref: '', limit: '', comp: 'C01', q: '', opts: ['', '', '', ''], correct: 0 }; },
      form: function (r) {
        var type = r.type || 'text';
        return '<div class="f-row">' + field('Question Type', selKv('fQType', TYPE_PAIRS, type)) + field('Answer Mode', selKv('fQMode', MODE_PAIRS, r.mode || 'single')) + '</div>' +
          '<div id="fQMediaWrap"' + (type === 'text' ? ' style="display:none"' : '') + '>' +
          field('Media URL *', inp('fQMedia', r.media || '', type === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://example.com/image.jpg')) + '</div>' +
          '<div class="f-row">' + field('Label', inp('fQLabel', r.label, 'e.g. Series, Empathy, Visual')) + field('Reference', inp('fQRef', r.ref, 'e.g. IQ-S01')) + '</div>' +
          '<div class="f-row">' + field('Grade', sel('fQGrade', ['9', '10', '11', '12'], r.grade)) + field('Category', sel('fQCat', ['IQ', 'EQ', 'Values'], r.cat)) + '</div>' +
          '<div class="f-row">' + field('Competition', compSelect('fQComp', r.comp)) + '</div>' +
          field('Time limit (s) — used when exam timing is Custom', inp('fQLimit', r.limit, 'Blank = no limit', 'number')) +
          field('Question *', '<textarea id="fQText">' + esc(r.q) + '</textarea>') +
          field('Options — pick the correct answer(s)', '<div id="fQOpts">' + qOptsHtml(r.mode || 'single', r.opts, r.correct) + '</div>');
      },
      afterOpen: function () {
        $('#fQMode').addEventListener('change', function () {
          var opts = [0, 1, 2, 3].map(function (i) { return $('#fQOpt' + i).value; });
          $('#fQOpts').innerHTML = qOptsHtml(this.value, opts, []);
        });
        $('#fQType').addEventListener('change', function () {
          var t = this.value;
          $('#fQMediaWrap').style.display = t === 'text' ? 'none' : '';
          $('#fQMedia').placeholder = t === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://example.com/image.jpg';
        });
      },
      collect: function () {
        var opts = [0, 1, 2, 3].map(function (i) { return $('#fQOpt' + i).value.trim(); });
        var mode = $('#fQMode').value;
        var checked = [];
        document.querySelectorAll('input[name=fQCorrect]:checked').forEach(function (c) { checked.push(parseInt(c.value, 10)); });
        return {
          grade: $('#fQGrade').value, cat: $('#fQCat').value, type: $('#fQType').value,
          media: $('#fQMedia').value.trim(), mode: mode, label: $('#fQLabel').value.trim(), ref: $('#fQRef').value.trim(),
          limit: $('#fQLimit').value.trim(), comp: $('#fQComp').value,
          q: $('#fQText').value.trim(), opts: opts, correct: mode === 'multi' ? checked : (checked.length ? checked[0] : NaN)
        };
      },
      validate: function (d) {
        if (!d.q) return 'Question text is required';
        if (d.opts.some(function (o) { return !o; })) return 'All four options are required';
        if (d.type !== 'text' && !d.media) return 'Add the video or picture URL';
        var cs = correctArray(d.correct);
        if (d.mode === 'multi') { if (cs.length < 2) return 'Select at least two correct answers'; }
        else if (cs.length !== 1 || isNaN(cs[0])) return 'Select the correct answer';
        return '';
      },
      addTitle: 'MCQ Builder', editTitle: 'Edit Question',
      saveAdd: 'Add to bank', saveEdit: 'Save question',
      idPrefix: 'Q',
      deleteMsg: function (r) { return 'Delete this question? "' + r.q.slice(0, 60) + '…"'; },
      addedMsg: 'Question added', updatedMsg: 'Question updated', deletedMsg: 'Question deleted'
    },

    ex: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td class="b">' + esc(r.title) + '</td><td>' + compBadge(r.comp) + '</td><td>' + esc(r.grade) + '</td><td>' + esc(r.date) + '</td>' +
          '<td>' + esc(r.time) + '</td><td>' + esc(r.duration) + ' min</td><td>' + timingCell(r.timing) + '</td><td>' + examStatus(r.status) + '</td>' +
          actionsCell(dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { title: '', grade: 'All', date: '', time: '10:00', duration: 15, timing: { mode: 'common', secs: 60 }, comp: 'C01', status: 'Scheduled' }; },
      form: function (r) {
        var tm = r.timing || { mode: 'common', secs: 60 };
        return field('Title *', inp('fETitle', r.title, 'e.g. Digital Qualifier — Window 1')) +
          '<div class="f-row">' + field('Competition', compSelect('fEComp', r.comp)) + '</div>' +
          '<div class="f-row">' + field('Grade', sel('fEGrade', ['All', '9', '10', '11', '12', '9-10', '11-12'], r.grade)) + field('Status', sel('fEStatus', ['Scheduled', 'Live', 'Completed'], r.status)) + '</div>' +
          '<div class="f-row">' + field('Date *', inp('fEDate', r.date, '', 'date')) + field('Time', inp('fETime', r.time, '', 'time')) + '</div>' +
          field('Duration (minutes)', inp('fEDur', r.duration, '', 'number')) +
          '<div class="f-row">' + field('Question timing', selKv('fETiming', [{ v: 'common', l: 'Common — same limit for all' }, { v: 'custom', l: 'Custom — per question (MCQ Builder) ' }], tm.mode)) +
          '<div id="fETimingWrap"' + (tm.mode === 'common' ? '' : ' style="display:none"') + '>' + field('Seconds per question', inp('fESecs', tm.secs, 'e.g. 60', 'number')) + '</div></div>';
      },
      afterOpen: function () {
        $('#fETiming').addEventListener('change', function () {
          $('#fETimingWrap').style.display = this.value === 'common' ? '' : 'none';
        });
      },
      collect: function () {
        return { title: $('#fETitle').value.trim(), grade: $('#fEGrade').value, date: $('#fEDate').value, time: $('#fETime').value, duration: parseInt($('#fEDur').value, 10) || 15, timing: { mode: $('#fETiming').value, secs: parseInt($('#fESecs').value, 10) || 60 }, comp: $('#fEComp').value, status: $('#fEStatus').value };
      },
      validate: function (d) {
        if (!d.title) return 'Title is required';
        if (!d.date) return 'Pick a date';
        return '';
      },
      addTitle: 'Schedule Exam', editTitle: 'Edit Exam',
      saveAdd: 'Schedule', saveEdit: 'Save changes',
      idPrefix: 'E',
      deleteMsg: function (r) { return 'Delete "' + r.title + '"?'; },
      addedMsg: 'Exam scheduled', updatedMsg: 'Exam updated', deletedMsg: 'Exam deleted'
    },

    ad: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td class="b">' + esc(r.name) + '</td><td>' + esc(r.email) + '</td>' +
          '<td>' + roleBadge(r.role) + '</td><td>' + activeBadge(r.status) + '</td>' +
          '<td>' + modBadges(r.modules) + '</td>' +
          actionsCell(dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { name: '', email: '', role: 'Editor', status: 'Active', modules: MODULES.map(function (m) { return m.k; }) }; },
      form: function (r) {
        return field('Name *', inp('fAName', r.name)) + field('Email *', inp('fAEmail', r.email, 'name@amity.edu', 'email')) +
          '<div class="f-row">' + field('Role', sel('fARole', ['Super Admin', 'Editor', 'Viewer'], r.role)) + field('Status', sel('fAStatus', ['Active', 'Disabled'], r.status)) + '</div>' +
          field('Module access', modChecks(r.modules));
      },
      collect: function () {
        var mods = [];
        document.querySelectorAll('input[name=fMod]:checked').forEach(function (c) { mods.push(c.value); });
        return { name: $('#fAName').value.trim(), email: $('#fAEmail').value.trim(), role: $('#fARole').value, status: $('#fAStatus').value, modules: mods };
      },
      validate: function (d) {
        if (!d.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'Valid name and email are required';
        if (!d.modules || !d.modules.length) return 'Select at least one module access';
        return '';
      },
      addTitle: 'Add Admin', editTitle: 'Edit Admin',
      saveAdd: 'Add admin', saveEdit: 'Save changes',
      idPrefix: 'A',
      deleteMsg: function (r) { return 'Remove admin "' + r.name + '"?'; },
      addedMsg: 'Admin added', updatedMsg: 'Admin updated', deletedMsg: 'Admin removed'
    },

    res: {
      noAdd: true,
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td><td class="b">' + esc(r.student) + '<small>' + esc(r.school) + '</small></td>' +
          '<td>' + compBadge(r.comp) + '</td><td>' + esc(r.grade) + '</td><td>' + esc(r.date) + '</td><td>' + esc(r.startedAt || r.time || '—') + '</td><td>' + esc(r.finishedAt || '—') + '</td>' +
          '<td>' + scoreBadge(r.score, r.total) + '</td>' +
          actionsCell(dotItem('View responses', 'view')) + '</tr>';
      },
      viewTitle: function (r) { return 'Responses — ' + r.student + ' (' + r.score + '/' + r.total + ')'; },
      view: function (r) {
        return r.answers.map(function (an, i) {
          return '<div class="resp"><div class="q">' + (i + 1) + '. ' + esc(an.q) + '</div>' +
            '<div class="a">Answered: <span class="' + (an.ok ? 'ok' : 'bad') + '">' + esc(an.a) + (an.ok ? ' ✓' : ' ✕') + '</span>' +
            (an.ok ? '' : ' &nbsp;·&nbsp; Correct: <span class="ok">' + esc(an.correct) + '</span>') + '</div></div>';
        }).join('');
      }
    },

    comp: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td><td class="b">' + esc(r.title) + '</td>' +
          '<td>' + esc(r.grades) + '</td><td>' + esc(r.start) + '</td><td>' + esc(r.end) + '</td>' +
          '<td>' + esc(r.enrolled || 0) + '</td><td>' + stagesCell(r) + '</td><td>' + compStatus(r.status) + '</td>' +
          actionsCell(dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { title: '', grades: '9-12', start: '', end: '', enrolled: 0, status: 'Draft', desc: '', multi: false, stages: [{ name: 'Stage 1', mode: 'Online', pass: 40 }] }; },
      form: function (r) {
        return field('Title *', inp('fCTitle', r.title, 'e.g. Digital Qualifier 2026')) +
          '<div class="f-row">' + field('Grades', sel('fCGrades', ['9', '10', '11', '12', '9-10', '11-12', '9-12'], r.grades)) + field('Status', sel('fCStatus', ['Draft', 'Open', 'Live', 'Closed'], r.status)) + '</div>' +
          '<div class="f-row">' + field('Start date *', inp('fCStart', r.start, '', 'date')) + field('End date *', inp('fCEnd', r.end, '', 'date')) + '</div>' +
          field('Enrolled students', inp('fCEnrolled', r.enrolled, '0', 'number')) +
          field('Description', '<textarea id="fCDesc">' + esc(r.desc || '') + '</textarea>') +
          '<p class="hint">Stages, stage rules and passing scores are managed on the Edit page — after creating, click Edit on the row.</p>';
      },
      collect: function () {
        return { title: $('#fCTitle').value.trim(), grades: $('#fCGrades').value, start: $('#fCStart').value, end: $('#fCEnd').value, enrolled: parseInt($('#fCEnrolled').value, 10) || 0, status: $('#fCStatus').value, desc: $('#fCDesc').value.trim() };
      },
      prepareNew: function (d) { d.multi = false; d.stages = [{ name: 'Stage 1', mode: 'Online', pass: 40 }]; return d; },
      validate: function (d) {
        if (!d.title) return 'Competition title is required';
        if (!d.start || !d.end) return 'Pick start and end dates';
        return '';
      },
      addTitle: 'Create Competition', editTitle: 'Edit Competition',
      saveAdd: 'Create', saveEdit: 'Save changes',
      idPrefix: 'C',
      afterSave: function (d) { COMPETITIONS[d.id] = d.title; },
      afterDelete: function (r) { delete COMPETITIONS[r.id]; },
      deleteMsg: function (r) { return 'Delete competition "' + r.title + '"? Linked questions, exams, results and registrations keep their data (demo).'; },
      addedMsg: 'Competition created', updatedMsg: 'Competition updated', deletedMsg: 'Competition deleted'
    },

    ann: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td>' +
          '<td class="b" style="max-width:360px">' + esc(r.title) + (r.pinned ? ' ' + bdg('Pinned', 'gold') : '') +
          '<small>' + esc((r.message || '').slice(0, 78)) + ((r.message || '').length > 78 ? '…' : '') + '</small></td>' +
          '<td>' + annCat(r.category) + '</td><td>' + esc(r.audience) + '</td><td>' + esc(r.date) + '</td>' +
          '<td>' + annStatus(r.status) + '</td>' +
          actionsCell(dotItem('View', 'view') + dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { title: '', category: 'General', audience: 'All Registered', date: '', status: 'Active', pinned: false, message: '' }; },
      form: function (r) {
        return '<div class="f-row">' + field('Title *', inp('fATitle', r.title, 'e.g. Qualifier windows confirmed')) +
          field('Category', sel('fACat', ['Exam', 'Results', 'Event', 'General'], r.category)) + '</div>' +
          '<div class="f-row">' + field('Audience', sel('fAAud', ['All Registered', 'Grades 9-12', 'Schools', 'Parents', 'Qualified only'], r.audience)) +
          field('Date', inp('fADate', r.date, '', 'date')) + '</div>' +
          '<div class="f-row">' + field('Status', sel('fAStatus', ['Active', 'Draft'], r.status)) +
          '<div class="f"><label>Pin to top</label><label class="opt"><input type="checkbox" id="fAPin"' + (r.pinned ? ' checked' : '') + ' /> Pinned announcement</label></div></div>' +
          field('Message *', '<textarea id="fAMsg">' + esc(r.message || '') + '</textarea>');
      },
      collect: function () {
        return { title: $('#fATitle').value.trim(), category: $('#fACat').value, audience: $('#fAAud').value, date: $('#fADate').value, status: $('#fAStatus').value, pinned: !!$('#fAPin').checked, message: $('#fAMsg').value.trim() };
      },
      validate: function (d) {
        if (!d.title) return 'Title is required';
        if (!d.date) return 'Pick a date';
        if (!d.message) return 'Message is required';
        return '';
      },
      viewTitle: function (r) { return 'Announcement ' + r.id; },
      view: function (r) {
        return '<div class="card" style="padding:.85rem">' +
          '<div style="font-weight:800">' + esc(r.title) + (r.pinned ? ' ' + bdg('Pinned', 'gold') : '') + '</div>' +
          '<small style="display:block;color:var(--muted)">' + annCat(r.category) + ' · ' + esc(r.audience) + ' · ' + esc(r.date) + ' · ' + annStatus(r.status) + '</small>' +
          '<p style="margin-top:.7rem;white-space:pre-wrap">' + esc(r.message) + '</p></div>';
      },
      addTitle: 'New Announcement', editTitle: 'Edit Announcement',
      saveAdd: 'Publish announcement', saveEdit: 'Save changes',
      idPrefix: 'AN',
      prepareNew: function (d) { d.date = d.date || today(); return d; },
      deleteMsg: function (r) { return 'Delete announcement "' + r.title + '"?'; },
      addedMsg: 'Announcement created', updatedMsg: 'Announcement updated', deletedMsg: 'Announcement deleted'
    },

    news: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td>' +
          '<td class="b" style="max-width:360px">' + esc(r.title) +
          '<small>' + esc((r.summary || '').slice(0, 78)) + ((r.summary || '').length > 78 ? '…' : '') + '</small></td>' +
          '<td>' + newsCat(r.category) + '</td><td>' + esc(r.author) + '</td><td>' + esc(r.date) + '</td>' +
          '<td>' + newsStatus(r.status) + '</td>' +
          actionsCell(dotItem('View', 'view') + dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { title: '', category: 'Competition', author: '', date: '', status: 'Draft', photo: '', summary: '' }; },
      form: function (r) {
        return field('Title *', inp('fNwTitle', r.title)) +
          '<div class="f-row">' + field('Category', sel('fNwCat', ['Competition', 'Press', 'Media', 'Student', 'General'], r.category)) +
          field('Author', inp('fNwAuthor', r.author, 'e.g. PR Team')) + '</div>' +
          '<div class="f-row">' + field('Date', inp('fNwDate', r.date, '', 'date')) +
          field('Status', sel('fNwStatus', ['Published', 'Draft'], r.status)) + '</div>' +
          field('Cover photo URL', inp('fNwPhoto', r.photo, 'https://… or leave blank')) +
          field('Summary *', '<textarea id="fNwSum">' + esc(r.summary || '') + '</textarea>');
      },
      collect: function () {
        return { title: $('#fNwTitle').value.trim(), category: $('#fNwCat').value, author: $('#fNwAuthor').value.trim(), date: $('#fNwDate').value, status: $('#fNwStatus').value, photo: $('#fNwPhoto').value.trim(), summary: $('#fNwSum').value.trim() };
      },
      validate: function (d) {
        if (!d.title) return 'Title is required';
        if (!d.date) return 'Pick a date';
        if (!d.summary) return 'Summary is required';
        return '';
      },
      viewTitle: function (r) { return 'News — ' + r.title; },
      view: function (r) {
        return (r.photo ? '<img src="' + esc(r.photo) + '" alt="' + esc(r.title) + '" style="max-width:100%;max-height:220px;object-fit:cover;border-radius:12px;border:1px solid var(--line-2);margin-bottom:.7rem" />' : '') +
          '<div class="card" style="padding:.85rem">' +
          '<div style="font-weight:800">' + esc(r.title) + '</div>' +
          '<small style="display:block;color:var(--muted)">' + newsCat(r.category) + ' · by ' + esc(r.author) + ' · ' + esc(r.date) + ' · ' + newsStatus(r.status) + '</small>' +
          '<p style="margin-top:.7rem;white-space:pre-wrap">' + esc(r.summary) + '</p></div>';
      },
      addTitle: 'New News Item', editTitle: 'Edit News Item',
      saveAdd: 'Publish news', saveEdit: 'Save changes',
      idPrefix: 'NW',
      prepareNew: function (d) { d.date = d.date || today(); return d; },
      deleteMsg: function (r) { return 'Delete news item "' + r.title + '"?'; },
      addedMsg: 'News created', updatedMsg: 'News updated', deletedMsg: 'News deleted'
    },

    gal: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td>' +
          '<td><div class="sp-cell">' + galThumb(r) + '<span class="meta" style="font-weight:700">' + esc(r.name) +
          '<small>' + esc((r.desc || '').slice(0, 60)) + '</small></span></div></td>' +
          '<td>' + esc(r.date) + '</td><td>' + esc(r.photos) + '</td><td>' + visBadge(r.visibility) + '</td>' +
          actionsCell(dotItem('View', 'view') + dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { name: '', date: '', photos: 0, visibility: 'Public', cover: '', desc: '', status: 'Active' }; },
      form: function (r) {
        return field('Album name *', inp('fGName', r.name)) +
          field('Cover photo URL', inp('fGCover', r.cover, 'https://… or leave blank')) +
          '<div class="f-row">' + field('Date', inp('fGDate', r.date, '', 'date')) +
          field('Photo count', inp('fGCount', r.photos, '', 'number')) + '</div>' +
          '<div class="f-row">' + field('Visibility', sel('fGVis', ['Public', 'Private'], r.visibility)) +
          field('Status', sel('fGStatus', ['Active', 'Draft'], r.status)) + '</div>' +
          field('Description', '<textarea id="fGDesc">' + esc(r.desc || '') + '</textarea>');
      },
      collect: function () {
        return { name: $('#fGName').value.trim(), date: $('#fGDate').value, photos: parseInt($('#fGCount').value, 10) || 0, visibility: $('#fGVis').value, cover: $('#fGCover').value.trim(), desc: $('#fGDesc').value.trim(), status: $('#fGStatus').value };
      },
      validate: function (d) {
        if (!d.name) return 'Album name is required';
        if (!d.date) return 'Pick a date';
        return '';
      },
      viewTitle: function (r) { return 'Gallery — ' + r.name; },
      view: function (r) {
        return (r.cover ? '<img src="' + esc(r.cover) + '" alt="' + esc(r.name) + '" style="max-width:100%;max-height:220px;object-fit:cover;border-radius:12px;border:1px solid var(--line-2);margin-bottom:.7rem" />' : '') +
          '<dl class="dl"><dt>Album</dt><dd>' + esc(r.name) + '</dd><dt>Created on</dt><dd>' + esc(r.date) + '</dd>' +
          '<dt>Photos</dt><dd>' + esc(r.photos) + '</dd><dt>Visibility</dt><dd>' + visBadge(r.visibility) + '</dd>' +
          '<dt>Status</dt><dd>' + esc(r.status) + '</dd><dt>Description</dt><dd>' + esc(r.desc || '—') + '</dd></dl>';
      },
      addTitle: 'New Gallery Album', editTitle: 'Edit Gallery Album',
      saveAdd: 'Create album', saveEdit: 'Save changes',
      idPrefix: 'GA',
      prepareNew: function (d) { d.date = d.date || today(); return d; },
      deleteMsg: function (r) { return 'Delete gallery album "' + r.name + '"?'; },
      addedMsg: 'Album created', updatedMsg: 'Album updated', deletedMsg: 'Album deleted'
    },

    prize: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td><td>' + compBadge(r.comp) + '</td><td class="b">' + esc(r.rank) + '</td>' +
          '<td class="b" style="color:var(--gold-2)">' + inr(r.money) + '</td>' +
          '<td>' + awardBadge(r.award) + '</td><td>' + esc(r.note || '—') + '</td>' +
          actionsCell(dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { comp: 'C01', rank: '1st', money: 10000, award: 'Trophy', note: '' }; },
      form: function (r) {
        return '<div class="f-row">' + field('Competition', compSelect('fPrizeComp', r.comp)) + field('Rank', sel('fPrizeRank', ['1st', '2nd', '3rd', 'Consolation'], r.rank)) + '</div>' +
          '<div class="f-row">' + field('Prize money (₹) *', inp('fPrizeMoney', r.money, 'e.g. 25000', 'number')) + field('Award', sel('fPrizeAward', ['Trophy', 'Medal', 'Certificate', 'Scholarship', 'Goodies'], r.award)) + '</div>' +
          field('Note (optional)', inp('fPrizeNote', r.note, 'e.g. Winner trophy + certificate'));
      },
      collect: function () {
        return { comp: $('#fPrizeComp').value, rank: $('#fPrizeRank').value, money: parseInt($('#fPrizeMoney').value, 10) || 0, award: $('#fPrizeAward').value, note: $('#fPrizeNote').value.trim() };
      },
      validate: function (d) { return d.money > 0 ? '' : 'Enter a prize money amount'; },
      afterSave: function () { refreshPrizeStats(); },
      afterDelete: function () { refreshPrizeStats(); },
      addTitle: 'Add Prize / Award', editTitle: 'Edit Prize / Award',
      saveAdd: 'Add prize', saveEdit: 'Save changes',
      idPrefix: 'PR',
      deleteMsg: function (r) { return 'Delete ' + r.rank + ' prize for ' + compName(r.comp) + ' (' + inr(r.money) + ')?'; },
      addedMsg: 'Prize added', updatedMsg: 'Prize updated', deletedMsg: 'Prize deleted'
    },

    spon: {
      build: function (key, r) {
        var evt = (r.events || []).map(function (e) { return compBadge(e); }).join(' ') || '—';
        var toggleLabel = r.status === 'Pending' ? 'Approve' : r.status === 'Active' ? 'Disable' : 'Enable';
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td>' +
          '<td><div class="sp-cell">' + logoHtml(r) +
          '<span class="meta" style="font-weight:700"><a href="sponsor-detail.html?id=' + encodeURIComponent(r.id) + '" style="color:var(--gold-2)">' + esc(r.name) + '</a>' +
          '<small>since ' + esc(r.since || '—') + '</small></span></div></td>' +
          '<td>' + esc(r.contact) + '<small>' + esc(r.email) + '</small></td>' +
          '<td>' + tierBadge(r.tier) + '</td><td>' + evt + '</td>' +
          '<td class="b" style="color:var(--gold-2)">' + inr(r.amount) + '</td><td>' + sponStatus(r.status) + '</td>' +
          actionsCell(dotItem('View profile', 'view') + dotItem('Edit', 'edit') + dotItem(toggleLabel, 'toggle') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { name: '', contact: '', email: '', phone: '', website: '', tier: 'Silver', status: 'Active', amount: 0, since: '2026', events: [], logo: '' }; },
      form: function (r) {
        return field('Organization *', inp('fSpName', r.name)) +
          '<div class="f-row">' + field('Contact person', inp('fSpContact', r.contact)) + field('Phone', inp('fSpPhone', r.phone)) + '</div>' +
          '<div class="f-row">' + field('Email *', inp('fSpEmail', r.email)) + field('Website', inp('fSpWeb', r.website)) + '</div>' +
          field('Company logo URL', inp('fSpLogo', r.logo, 'https://… or leave blank for a monogram')) +
          '<div class="f-row">' + field('Tier', planSelect('fSpTier', r.tier)) + field('Status', sel('fSpStatus', ['Active', 'Disabled', 'Pending'], r.status)) + '</div>' +
          '<div class="f-row">' + field('Contribution (₹)', inp('fSpAmt', r.amount, '', 'number')) + field('Partner since', inp('fSpSince', r.since)) + '</div>' +
          field('Sponsors events', compChecks(r.events));
      },
      collect: function () {
        return {
          name: $('#fSpName').value.trim(), contact: $('#fSpContact').value.trim(), email: $('#fSpEmail').value.trim(),
          phone: $('#fSpPhone').value.trim(), website: $('#fSpWeb').value.trim(), tier: $('#fSpTier').value, status: $('#fSpStatus').value,
          amount: parseInt($('#fSpAmt').value, 10) || 0, since: $('#fSpSince').value.trim() || '2026',
          logo: $('#fSpLogo').value.trim(),
          events: [].slice.call(document.querySelectorAll('input[name="fSponEvt"]:checked')).map(function (c) { return c.value; })
        };
      },
      validate: function (d) {
        if (!d.name) return 'Organization name is required';
        if (!d.email) return 'Contact email is required';
        return '';
      },
      afterSave: function () { refreshSponsorStats(); },
      afterDelete: function () { refreshSponsorStats(); },
      addTitle: 'Add Sponsor', editTitle: 'Edit Sponsor',
      saveAdd: 'Add sponsor', saveEdit: 'Save changes',
      idPrefix: 'SP',
      deleteMsg: function (r) { return 'Delete sponsor "' + r.name + '"?'; },
      addedMsg: 'Sponsor added', updatedMsg: 'Sponsor updated', deletedMsg: 'Sponsor deleted'
    },

    plan: {
      build: function (key, r) {
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td><td class="b">' + esc(r.name) + '</td>' +
          '<td class="b" style="color:var(--gold-2)">' + inr(r.min) + '</td>' +
          '<td>' + planOptionsCell(r.extras) + '</td>' +
          '<td class="b" style="color:var(--gold-2)">' + inr((r.min || 0) + planExtrasTotal(r.extras)) + '</td>' +
          '<td style="max-width:300px">' + esc(r.benefits) + '</td><td>' + planStatus(r.active) + '</td>' +
          actionsCell(dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { name: '', min: 50000, benefits: '', active: true, extras: [] }; },
      form: function (r) {
        return field('Plan name *', inp('fPlName', r.name)) +
          '<div class="f-row">' + field('Min contribution (₹) *', inp('fPlMin', r.min, '', 'number')) + field('Status', sel('fPlStatus', ['Active', 'Inactive'], r.active ? 'Active' : 'Inactive')) + '</div>' +
          field('Benefits', '<textarea id="fPlBenefits">' + esc(r.benefits) + '</textarea>') +
          field('Additional options (add to min contribution)', planExtrasChecks(r.extras));
      },
      collect: function () {
        var extras = [];
        document.querySelectorAll('input[name="fPlExt"]:checked').forEach(function (c) { extras.push(c.value); });
        return { name: $('#fPlName').value.trim(), min: parseInt($('#fPlMin').value, 10) || 0, benefits: $('#fPlBenefits').value.trim(), active: $('#fPlStatus').value === 'Active', extras: extras };
      },
      validate: function (d) {
        if (!d.name) return 'Plan name is required';
        return d.min > 0 ? '' : 'Enter a minimum contribution amount';
      },
      afterSave: function () { syncPlans(); refreshPlanStats(); },
      afterDelete: function () { syncPlans(); refreshPlanStats(); },
      addTitle: 'Add Sponsorship Plan', editTitle: 'Edit Sponsorship Plan',
      saveAdd: 'Add plan', saveEdit: 'Save changes',
      idPrefix: 'PL',
      deleteMsg: function (r) { return 'Delete plan "' + r.name + '"?'; },
      addedMsg: 'Plan added', updatedMsg: 'Plan updated', deletedMsg: 'Plan deleted'
    },

    gri: {
      build: function (key, r) {
        var nextLabel = r.status === 'New' ? 'Mark In Progress' : r.status === 'In Progress' ? 'Mark Resolved' : 'Reopen';
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td>' + esc(r.id) + '</td><td>' + griType(r.type) + '</td>' +
          '<td class="b">' + esc(r.name) + '<small>' + esc(r.contact) + '</small></td>' +
          '<td class="b" style="max-width:260px">' + esc(r.subject) + '</td>' +
          '<td>' + esc(r.contact) + '</td><td>' + esc(r.date) + '</td><td>' + griStatus(r.status) + '</td>' +
          actionsCell(dotItem('View', 'view') + dotItem('Reply', 'reply') + dotItem(nextLabel, 'next') + dotItem('Edit', 'edit') + dotItem('Delete', 'del', true)) + '</tr>';
      },
      defaults: function () { return { type: 'Complaint', name: '', contact: '', subject: '', message: '', date: today(), status: 'New' }; },
      form: function (r) {
        return '<div class="f-row">' + field('Type', sel('fGriType', ['Complaint', 'Feedback', 'Suggestion'], r.type)) + field('Status', sel('fGriStatus', ['New', 'In Progress', 'Resolved'], r.status)) + '</div>' +
          '<div class="f-row">' + field('Name *', inp('fGriName', r.name)) + field('Contact', inp('fGriContact', r.contact)) + '</div>' +
          field('Subject *', inp('fGriSubject', r.subject)) +
          field('Message', '<textarea id="fGriMsg">' + esc(r.message) + '</textarea>');
      },
      collect: function () {
        return { type: $('#fGriType').value, status: $('#fGriStatus').value, name: $('#fGriName').value.trim(), contact: $('#fGriContact').value.trim(), subject: $('#fGriSubject').value.trim(), message: $('#fGriMsg').value.trim() };
      },
      validate: function (d) {
        if (!d.name) return 'Name is required';
        return d.subject ? '' : 'Subject is required';
      },
      viewTitle: function (r) { return r.id + ' · ' + r.subject; },
      view: function (r) {
        return '<dl class="dl">' +
          '<dt>Type</dt><dd>' + griType(r.type) + '</dd>' +
          '<dt>Submitted by</dt><dd>' + esc(r.name) + '</dd>' +
          '<dt>Contact</dt><dd>' + esc(r.contact || '—') + '</dd>' +
          '<dt>Date</dt><dd>' + esc(r.date) + '</dd>' +
          '<dt>Status</dt><dd>' + griStatus(r.status) + '</dd>' +
          '<dt>Subject</dt><dd>' + esc(r.subject) + '</dd>' +
          '<dt>Message</dt><dd style="white-space:pre-wrap;max-width:520px">' + esc(r.message) + '</dd></dl>';
      },
      afterSave: function () { refreshGrievanceStats(); },
      afterDelete: function () { refreshGrievanceStats(); },
      addTitle: 'Add Submission', editTitle: 'Edit Submission',
      saveAdd: 'Add submission', saveEdit: 'Save changes',
      idPrefix: 'GV',
      deleteMsg: function (r) { return 'Delete ' + r.type.toLowerCase() + ' "' + r.subject + '" from ' + r.name + '?'; },
      addedMsg: 'Submission added', updatedMsg: 'Submission updated', deletedMsg: 'Submission deleted'
    },

    pay: {
      noAdd: true,
      build: function (key, r) {
        var acts = r.status === 'Paid'
          ? dotItem('Download Receipt', 'receipt') + dotItem('Send Receipt', 'sendreceipt')
          : dotItem('Send Payment Link', 'paylink');
        return '<tr data-ent="' + key + '" data-json="' + esc(JSON.stringify(r)) + '">' +
          '<td class="b">' + esc(r.name) + '<small>' + esc(r.reg || '') + '</small></td>' +
          '<td>' + esc(r.phone) + '</td><td>' + esc(r.id) + '</td>' +
          '<td>' + payMode(r.mode) + '</td><td>₹' + esc(r.amount) + '</td><td>' + payStatus(r.status) + '</td>' +
          actionsCell(acts) + '</tr>';
      }
    }
  };

  /* ================= actions ================= */
  function tbodyFor(ent) { return document.querySelector('tbody[data-tbody="' + ent + '"]'); }

  function nextId(prefix, tbody) {
    var max = 0;
    tbody.querySelectorAll('tr[data-json]').forEach(function (tr) {
      try {
        var id = JSON.parse(tr.getAttribute('data-json')).id;
        var n = parseInt(String(id).slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      } catch (e) {}
    });
    return prefix + (max + 1);
  }

  function openView(key, rec) {
    var cfg = entities[key];
    modal(cfg.viewTitle(rec), cfg.view(rec), '<button class="btn" data-close>Close</button>', key === 'res');
  }

  function openPreview(key, rec) {
    modal('Preview', mediaHtml(rec), '<button class="btn" data-close>Close</button>', true);
  }

  function openForm(key, rec, tr, isNew) {
    var cfg = entities[key];
    modal(isNew ? cfg.addTitle : cfg.editTitle, cfg.form(rec),
      '<button class="btn" data-close>Cancel</button><button class="btn btn-gold" id="fSave">' + (isNew ? cfg.saveAdd : cfg.saveEdit) + '</button>', key === 'q');
    if (cfg.afterOpen) cfg.afterOpen(rec);
    $('#fSave').addEventListener('click', function () {
      var data = cfg.collect();
      var err = cfg.validate(data);
      if (err) return toast(err);
      if (isNew) {
        var tb = tbodyFor(key);
        data.id = nextId(cfg.idPrefix, tb);
        if (cfg.prepareNew) data = cfg.prepareNew(data);
        tb.insertAdjacentHTML('beforeend', cfg.build(key, data));
        toast(cfg.addedMsg);
      } else {
        Object.assign(rec, data);
        data.id = rec.id;
        tr.outerHTML = cfg.build(key, rec);
        toast(cfg.updatedMsg);
      }
      if (cfg.afterSave) cfg.afterSave(data);
      refreshLabelFilter();
      closeModal();
    });
  }

  function confirmDelete(key, rec, tr) {
    var cfg = entities[key];
    modal('Please confirm', '<p style="color:var(--muted)">' + esc(cfg.deleteMsg(rec)) + '</p>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn-danger" id="cfYes">Delete</button>');
    $('#cfYes').addEventListener('click', function () { tr.remove(); closeModal(); toast(cfg.deletedMsg); if (cfg.afterDelete) cfg.afterDelete(rec); refreshLabelFilter(); });
  }

  function handleAdd(key) {
    var cfg = entities[key];
    if (!cfg || cfg.noAdd) return;
    openForm(key, cfg.defaults(), null, true);
  }

  function handleAct(act, rec, tr) {
    var key = tr.getAttribute('data-ent');
    var cfg = entities[key];
    if (!cfg) return;
    if (act === 'view') {
      if (page === 'results') { location.href = 'results-detail.html?id=' + encodeURIComponent(rec.id); return; }
      if (page === 'schools') { location.href = 'school-detail.html?id=' + encodeURIComponent(rec.id); return; }
      if (page === 'registrations') { location.href = 'student-detail.html?id=' + encodeURIComponent(rec.id); return; }
      if (page === 'sponsors') { location.href = 'sponsor-detail.html?id=' + encodeURIComponent(rec.id); return; }
      openView(key, rec);
    }
    else if (act === 'preview') openPreview(key, rec);
    else if (act === 'edit' && page === 'registrations') { location.href = 'student-edit.html?id=' + encodeURIComponent(rec.id); return; }
    else if (act === 'edit' && page === 'competitions') { location.href = 'competition-edit.html?id=' + encodeURIComponent(rec.id); return; }
    else if (act === 'edit') openForm(key, rec, tr, false);
    else if (act === 'del') confirmDelete(key, rec, tr);
    else if (act === 'toggle' && key === 'spon') {
      rec.status = rec.status === 'Active' ? 'Disabled' : 'Active';
      tr.outerHTML = entities.spon.build(key, rec);
      refreshSponsorStats();
      toast('Sponsor ' + (rec.status === 'Active' ? 'enabled / approved' : 'disabled'));
    }
    else if (act === 'reply' && key === 'gri') replyGrievance(rec);
    else if (act === 'next' && key === 'gri') {
      rec.status = rec.status === 'New' ? 'In Progress' : rec.status === 'In Progress' ? 'Resolved' : 'New';
      tr.outerHTML = entities.gri.build(key, rec);
      refreshGrievanceStats();
      toast('Status updated to ' + rec.status);
    }
    else if (act === 'receipt') downloadReceipt(rec);
    else if (act === 'sendreceipt') { toast('Receipt sent to ' + rec.name + ' (demo)'); }
    else if (act === 'paylink') sendPayLink(rec);
  }

  /* ================= payment actions ================= */
  function downloadReceipt(r) {
    var txt = 'India Mind League — Payment Receipt\n' +
      '------------------------------------\n' +
      'Receipt ID : ' + r.id + '\n' +
      'Participant: ' + r.name + '\n' +
      'Registration: ' + (r.reg || '—') + '\n' +
      'Phone      : ' + r.phone + '\n' +
      'Mode       : ' + r.mode + '\n' +
      'Amount     : Rs ' + r.amount + '\n' +
      'Status     : ' + r.status + '\n' +
      '------------------------------------\n' +
      'Thank you for participating in India Mind League!';
    var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = r.id + '-receipt.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
    toast('Receipt downloaded');
  }
  function sendPayLink(r) {
    var link = 'https://iml.amity.edu/pay/' + r.id;
    var msg = 'Hi ' + r.name + ', your payment of Rs ' + r.amount + ' was not successful. Here is the link to retry the payment: ' + link;
    modal('Send Payment Link — ' + r.name,
      '<div class="f"><label>Payment link</label><input id="fPLink" value="' + esc(link) + '" /></div>' +
      '<div class="f"><label>Message (editable)</label><textarea id="fPMsg">' + esc(msg) + '</textarea></div>' +
      '<div class="f"><label>Channel</label><select id="fPCh"><option>SMS</option><option>WhatsApp</option><option>Email</option></select></div>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn-gold" id="fPSend">Send Link</button>');
    $('#fPSend').addEventListener('click', function () {
      if (!$('#fPMsg').value.trim()) return toast('Message is required');
      closeModal();
      toast('Payment link sent to ' + r.name + ' (demo)');
    });
  }
  function replyGrievance(r) {
    modal('Reply to ' + r.name,
      '<div class="card" style="padding:.8rem"><div class="b">' + esc(r.subject) + '</div>' +
      '<small style="color:var(--muted)">' + griType(r.type) + ' · ' + esc(r.date) + ' · ' + esc(r.contact) + '</small>' +
      '<p style="margin-top:.5rem;white-space:pre-wrap">' + esc(r.message) + '</p></div>' +
      '<div class="f"><label>Reply message</label><textarea id="fGriReply"></textarea></div>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn-gold" id="fGriSend">Send Reply</button>');
    $('#fGriSend').addEventListener('click', function () {
      if (!$('#fGriReply').value.trim()) return toast('Write a reply first');
      closeModal();
      toast('Reply sent to ' + r.name + ' (demo)');
    });
  }

  /* ================= bulk import (questions) ================= */
  function parseCSVLine(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return [];
    var headers = parseCSVLine(lines[0]).map(function (h) { return h.trim().toLowerCase(); });
    return lines.slice(1).map(function (l) {
      var cells = parseCSVLine(l);
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = (cells[i] || '').trim(); });
      return obj;
    });
  }
  function toIndex(x) {
    if (typeof x === 'number') return isNaN(x) ? -1 : x;
    var s = String(x || '').trim().toUpperCase();
    var n = parseInt(s, 10);
    if (!isNaN(n)) return n;
    var L = s.charAt(0);
    return (L >= 'A' && L <= 'D') ? L.charCodeAt(0) - 65 : -1;
  }
  function parseCorrect(c, mode) {
    if (Array.isArray(c)) {
      var a = c.map(function (x) { return toIndex(x); }).filter(function (x) { return x >= 0; });
      return mode === 'multi' ? a : (a.length ? a[0] : NaN);
    }
    if (mode === 'multi') {
      return String(c == null ? '' : c).split(/[;,]/).map(function (x) { return toIndex(x.trim()); }).filter(function (x) { return x >= 0; });
    }
    return toIndex(c);
  }
  function normalizeRow(raw) {
    var opts = Array.isArray(raw.opts)
      ? raw.opts.map(function (o) { return String(o == null ? '' : o).trim(); })
      : ['optA', 'optB', 'optC', 'optD'].map(function (k) { return String(raw[k] == null ? '' : raw[k]).trim(); });
    var mode = String(raw.mode || 'single').toLowerCase() === 'multi' ? 'multi' : 'single';
    var type = String(raw.type || 'text').toLowerCase();
    if (['text', 'video', 'image'].indexOf(type) < 0) type = 'text';
    return {
      grade: String(raw.grade || '9'), cat: raw.cat || 'IQ', type: type,
      media: String(raw.media || '').trim(), mode: mode,
      label: String(raw.label || '').trim(), ref: String(raw.ref || '').trim(),
      limit: String(raw.limit || '').trim(),
      q: String(raw.q || '').trim(), opts: opts, correct: parseCorrect(raw.correct, mode)
    };
  }
  function validateImport(r) {
    if (!r.q) return 'Question text is required';
    if (r.opts.some(function (o) { return !o; })) return 'All four options are required';
    if (r.type !== 'text' && !r.media) return 'Media URL required for ' + r.type;
    var cs = correctArray(r.correct);
    if (r.mode === 'multi') { if (cs.length < 2) return 'Select at least two correct answers'; }
    else if (cs.length !== 1 || isNaN(cs[0])) return 'Select the correct answer';
    return '';
  }
  function parseRows(text) {
    var t = String(text || '').trim();
    if (!t) return { rows: [], errors: ['No data provided'] };
    if (t.charAt(0) === '[') {
      try { return { rows: JSON.parse(t), errors: [] }; }
      catch (e) { return { rows: [], errors: ['Invalid JSON: ' + e.message] }; }
    }
    return { rows: parseCSV(t), errors: [] };
  }
  function doImport(text) {
    var parsed = parseRows(text);
    if (parsed.errors.length) { toast(parsed.errors[0]); return; }
    var tb = tbodyFor('q');
    var ok = 0, bad = 0;
    parsed.rows.forEach(function (raw) {
      if (!raw || typeof raw !== 'object') { bad++; return; }
      var rec = normalizeRow(raw);
      if (validateImport(rec)) { bad++; return; }
      rec.id = nextId('Q', tb);
      tb.insertAdjacentHTML('beforeend', entities.q.build('q', rec));
      ok++;
    });
    refreshLabelFilter();
    applyFilters();
    toast(ok ? 'Imported ' + ok + ' question' + (ok > 1 ? 's' : '') + (bad ? ' · ' + bad + ' skipped' : '') : 'Nothing imported');
    closeModal();
  }
  function openBulkUpload() {
    modal('Bulk Upload Questions',
      '<div class="f"><label>Upload a .csv or .json file</label><input id="fBulkFile" type="file" accept=".csv,.json,text/csv,application/json" /></div>' +
      '<div class="f"><label>…or paste rows below</label><textarea id="fBulkText" placeholder="Paste CSV (with header) or a JSON array"></textarea></div>' +
      '<div class="f"><label>Format guide</label>' +
      '<pre style="margin:0;padding:.7rem .8rem;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.3);color:var(--muted);font-size:.78rem;overflow:auto;white-space:pre-wrap">' +
      'CSV header:\nlabel,ref,type,media,mode,grade,cat,q,optA,optB,optC,optD,correct\n' +
      'Series,,text,,single,9,IQ,Which number completes the series?,36,40,42,48,2\n' +
      'Teamwork,,text,,multi,12,Values,Choose all the fair ways...,A,B,C,D,"0,3"\n' +
      'Visual,IQ-V01,video,https://youtube.com/watch?v=ID,single,9,IQ,Watch then answer...,42,44,46,48,C\n\n' +
      'type: text | video | image        mode: single | multi\n' +
      'correct: 0-3 or A-D (multiselect: comma-separated, e.g. "0,3")</pre></div>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn-gold" id="fBulkGo">Import Questions</button>', true);
    $('#fBulkGo').addEventListener('click', function () {
      var file = $('#fBulkFile');
      if (file && file.files && file.files.length) {
        var fr = new FileReader();
        fr.onload = function () { doImport(fr.result); };
        fr.readAsText(file.files[0]);
      } else {
        doImport($('#fBulkText').value);
      }
    });
  }

  /* ================= label filter (questions page) ================= */
  function refreshLabelFilter() {
    var fLabel = $('#fLabel');
    if (!fLabel) return;
    var labels = {};
    document.querySelectorAll('tbody[data-tbody="q"] tr[data-json]').forEach(function (tr) {
      try { var l = JSON.parse(tr.getAttribute('data-json')).label; if (l) labels[l] = 1; } catch (e) {}
    });
    var cur = fLabel.value;
    fLabel.innerHTML = '<option value="All">All labels</option>' +
      Object.keys(labels).sort().map(function (l) { return '<option value="' + esc(l) + '">' + esc(l) + '</option>'; }).join('');
    fLabel.value = cur || 'All';
  }
  function applyFilters() {
    var g = (($('#fGrade') || {}).value), c = (($('#fCat') || {}).value), l = (($('#fLabel') || {}).value), cp = (($('#fComp') || {}).value);
    document.querySelectorAll('tbody[data-tbody="q"] tr[data-json]').forEach(function (tr) {
      var r = JSON.parse(tr.getAttribute('data-json'));
      var ok = (g === 'All' || String(r.grade) === g) && (c === 'All' || r.cat === c) && (l === 'All' || (r.label || '') === l) && (cp === 'All' || r.comp === cp);
      tr.hidden = !ok;
    });
  }

  /* ================= dropdown + click delegation ================= */
  function closeAllMenus() { document.querySelectorAll('.dotmenu.open').forEach(function (m) { m.classList.remove('open'); }); }

  document.addEventListener('click', function (e) {
    var dotBtnEl = e.target.closest('.dot-btn');
    if (dotBtnEl) {
      var menu = dotBtnEl.closest('.dotmenu');
      var wasOpen = menu.classList.contains('open');
      closeAllMenus();
      if (!wasOpen) menu.classList.add('open');
      return;
    }
    var item = e.target.closest('[data-act]');
    if (item) {
      var tr = item.closest('tr[data-json]');
      var rec = JSON.parse(tr.getAttribute('data-json'));
      closeAllMenus();
      handleAct(item.getAttribute('data-act'), rec, tr);
      return;
    }
    var addBtn = e.target.closest('[data-add]');
    if (addBtn) { handleAdd(addBtn.getAttribute('data-add')); return; }
    var bulkBtn = e.target.closest('[data-bulk]');
    if (bulkBtn) { openBulkUpload(); return; }
    if (!e.target.closest('.dotmenu')) closeAllMenus();
  });

  /* ================= results detail page ================= */
  function toSec(t) {
    var p = String(t || '').split(':');
    return (+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0);
  }
  function fmtDur(sec) {
    if (isNaN(sec) || sec < 0) return '—';
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ' min ' + s + ' s';
  }
  function ansCell(an) {
    return (an.ok ? '<span style="color:#86efac;font-weight:700">' : '<span style="color:#fecdd3;font-weight:700">') + esc(an.a) + '</span>' +
      (an.ok ? '' : '<small><span style="color:#86efac">Correct: ' + esc(an.correct) + '</span></small>');
  }
  function renderResultDetail() {
    var holder = $('#rd');
    if (!holder) return;
    var want = (location.search.match(/[?&]id=([^&]+)/) || [])[1];
    var list = [];
    try { list = JSON.parse(($('#resData') || {}).textContent || '[]'); } catch (e) { list = []; }
    var rec = list.filter(function (x) { return String(x.id) === want; })[0];
    if (!rec) {
      holder.innerHTML = '<div class="empty">Attempt not found. <a href="results.html" style="color:var(--gold)">← Back to results</a></div>';
      return;
    }
    var totalSec = toSec(rec.finishedAt) - toSec(rec.startedAt);
    var timeUps = rec.answers.filter(function (a) { return a.timeUp; }).length;
    var avg = rec.answers.length ? Math.round(rec.answers.reduce(function (s, a) { return s + (a.taken || 0); }, 0) / rec.answers.length) : 0;
    var tm = rec.timing || {};
    var meta = '<a class="btn btn-sm" style="margin-bottom:1rem" href="results.html">← Back to results</a>' +
      '<div class="grid g4" style="margin-bottom:1rem">' +
      '<div class="card"><div style="font-weight:800;font-size:1.02rem">' + esc(rec.student) + '</div>' +
      '<small style="display:block;color:var(--muted)">' + esc(rec.school) + '</small>' +
      '<div style="margin-top:.6rem">' + bdg(rec.id, 'grey') + ' ' + compBadge(rec.comp) + ' <span style="color:var(--muted);font-size:.85rem">Grade ' + esc(rec.grade) + '</span></div></div>' +
      '<div class="card stat"><b>' + esc(rec.date) + '</b><small>Attempt date</small></div>' +
      '<div class="card stat"><b>' + esc(rec.score) + ' / ' + esc(rec.total) + '</b><small>Score</small></div>' +
      '<div class="card stat"><b>' + (timeUps ? timeUps + ' ⏱' : 'None') + '</b><small>Time-up / auto-advance</small></div></div>' +
      '<div class="grid g4" style="margin-bottom:1rem">' +
      '<div class="card stat"><b>' + esc(rec.startedAt) + '</b><small>Started at</small></div>' +
      '<div class="card stat"><b>' + esc(rec.finishedAt) + '</b><small>Finished at</small></div>' +
      '<div class="card stat"><b>' + fmtDur(totalSec) + '</b><small>Total time</small></div>' +
      '<div class="card stat"><b>' + timingCell(tm) + '</b><small>Question timing · avg ' + avg + 's / q</small></div></div>';
    var rows = rec.answers.map(function (an, i) {
      var taken = an.timeUp
        ? '<span style="color:#f9a8d4;font-weight:700">' + (an.taken != null ? an.taken : '—') + 's ⏱</span>'
        : (an.taken != null ? an.taken + 's' : '—');
      return '<tr><td>' + (i + 1) + '</td><td class="b" style="max-width:380px">' + esc(an.q) + '</td>' +
        '<td>' + ansCell(an) + '</td>' +
        '<td>' + (an.ok ? bdg('Correct', 'green') : bdg('Wrong', 'red')) + '</td>' +
        '<td>' + taken + '</td>' +
        '<td><small>' + esc(an.started || '—') + ' → ' + esc(an.answered || '—') + '</small></td>' +
        '<td>' + (an.limit != null ? an.limit + 's' : '—') + '</td></tr>';
    }).join('');
    holder.innerHTML = meta +
      '<div class="tbl-wrap"><table>' +
      '<thead><tr><th>#</th><th>Question</th><th>Student answer</th><th>Result</th><th>Time taken</th><th>Response time</th><th>Limit</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' + stageTabs(rec.comp);
    wireTabs('stTabs');
  }

  /* ================= stage qualifiers ================= */
  function stageTabs(compId) {
    var q = (window.IML_QUALIFIERS || {})[compId];
    if (!q || !q.stages || !q.stages.length) return '';
    var btns = q.stages.map(function (st, i) {
      return '<button class="tab' + (i ? '' : ' on') + '" type="button" data-t="s' + i + '">' + esc(st.name) + ' <small style="opacity:.65">' + st.rows.length + '</small></button>';
    }).join('');
    var panes = q.stages.map(function (st, i) {
      var head = '<div style="display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:.7rem">' +
        '<b>' + esc(st.name) + '</b>' + bdg(st.mode, 'blue') + bdg('Pass ' + st.pass + '%', 'gold') +
        '<small style="color:var(--muted)">' + esc(st.desc || '') + '</small></div>';
      var body = st.rows.length ? '<div class="tbl-wrap"><table>' +
        '<thead><tr><th>Reg ID</th><th>Student</th><th>Grade</th><th>School</th><th>Score</th><th>Status</th></tr></thead><tbody>' +
        st.rows.map(function (r) {
          var ok = r.score >= st.pass;
          return '<tr><td>' + esc(r.id) + '</td><td class="b">' + esc(r.name) + '</td><td>' + esc(r.grade) + '</td><td>' + esc(r.school) + '</td><td>' + r.score + '%</td><td>' +
            (ok ? bdg('Qualified', 'green') : bdg('Not qualified', 'red')) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">No participants recorded.</div>';
      return '<div data-p="s' + i + '" class="pane"' + (i ? ' hidden' : '') + '>' + head + body + '</div>';
    }).join('');
    return '<div class="card" style="margin-top:1rem" id="stTabs">' +
      '<div style="font-weight:800;font-size:1.02rem;margin-bottom:.2rem">Stage Qualifiers — ' + compName(compId) + '</div>' +
      '<small style="display:block;color:var(--muted);margin-bottom:.9rem">' + esc(q.desc || '') + ' · ' + q.reg + ' registered</small>' +
      '<div class="tabs">' + btns + '</div>' + panes + '</div>';
  }

  function wireTabs(wrapId) {
    var w = $('#' + wrapId);
    if (!w) return;
    var btns = w.querySelectorAll('.tab');
    var panes = w.querySelectorAll('[data-p]');
    var show = function (name) {
      panes.forEach(function (p) { p.hidden = p.getAttribute('data-p') !== name; });
      btns.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === name); });
    };
    btns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-t')); }); });
    show(btns.length ? btns[0].getAttribute('data-t') : '');
  }

  function detailJson(id, listId) {
    var list = [];
    try { list = JSON.parse(($('#' + listId) || {}).textContent || '[]'); } catch (e) { list = []; }
    return list.filter(function (x) { return String(x.id) === id; })[0];
  }

  /* ================= school detail ================= */
  function renderSchoolDetail() {
    var holder = $('#sd');
    if (!holder) return;
    var want = (location.search.match(/[?&]id=([^&]+)/) || [])[1];
    var rec = detailJson(want, 'schoolData');
    if (!rec) { holder.innerHTML = '<div class="empty">School not found. <a href="schools.html" style="color:var(--gold)">← Back to schools</a></div>'; return; }
    var p = rec.pupils || [], rs = rec.results || [], ps = rec.payments || [];
    var taken = p.filter(function (x) { return x.status === 'Qualified' || x.status === 'Test Taken'; }).length;
    var collected = ps.filter(function (x) { return x.status === 'Paid'; }).length;
    var totalPaid = ps.reduce(function (s, x) { return s + (parseInt(x.amount, 10) || 0); }, 0);
    holder.innerHTML =
      '<a class="btn btn-sm" style="margin-bottom:1rem" href="schools.html">← Back to schools</a>' +
      '<div class="grid g4" style="margin-bottom:1rem">' +
      '<div class="card"><div style="font-weight:800;font-size:1.02rem">' + esc(rec.name) + '</div>' +
      '<small style="display:block;color:var(--muted)">' + esc(rec.city) + ' · Coordinator: ' + esc(rec.coordinator) + '</small>' +
      '<div style="margin-top:.6rem">' + bdg(rec.id, 'grey') + ' ' + bdg(rec.contact, 'blue') + '</div></div>' +
      '<div class="card stat"><b>' + esc(rec.students) + '</b><small>Registered students</small></div>' +
      '<div class="card stat"><b>' + taken + '</b><small>Participated</small></div>' +
      '<div class="card stat"><b>' + inr(totalPaid) + '</b><small>Fees collected</small></div></div>' +
      '<div id="sdTabs"><div class="tabs">' +
      '<button class="tab on" type="button" data-t="basic">Basic Details</button>' +
      '<button class="tab" type="button" data-t="students">Students (' + p.length + ')</button>' +
      '<button class="tab" type="button" data-t="results">Results (' + rs.length + ')</button>' +
      '<button class="tab" type="button" data-t="payments">Payments (' + ps.length + ')</button></div>' +
      '<div data-p="basic" class="pane"><div class="card"><dl class="dl">' +
      '<dt>School</dt><dd>' + esc(rec.name) + '</dd><dt>City</dt><dd>' + esc(rec.city) + '</dd>' +
      '<dt>Coordinator</dt><dd>' + esc(rec.coordinator) + '</dd><dt>Contact</dt><dd>' + esc(rec.contact) + '</dd>' +
      '<dt>Registered students</dt><dd>' + esc(rec.students) + '</dd></dl></div></div>' +
      '<div data-p="students" class="pane" hidden>' + (p.length ?
        '<div class="tbl-wrap"><table><thead><tr><th>Student ID</th><th>Name</th><th>Grade</th><th>Registration</th><th>Status</th></tr></thead><tbody>' +
        p.map(function (s) { return '<tr><td>' + esc(s.id) + '</td><td class="b">' + esc(s.name) + '</td><td>' + esc(s.grade) + '</td><td>' + esc(s.reg) + '</td><td>' + regStatus(s.status) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty">No students recorded.</div>') + '</div>' +
      '<div data-p="results" class="pane" hidden>' + (rs.length ?
        '<div class="tbl-wrap"><table><thead><tr><th>Attempt</th><th>Student</th><th>Competition</th><th>Date</th><th>Score</th></tr></thead><tbody>' +
        rs.map(function (x) { return '<tr><td>' + esc(x.id) + '</td><td class="b">' + esc(x.student) + '</td><td>' + compBadge(x.comp) + '</td><td>' + esc(x.date) + '</td><td>' + scoreBadge(x.score, x.total) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty">No attempts yet.</div>') + '</div>' +
      '<div data-p="payments" class="pane" hidden>' + (ps.length ?
        '<div class="tbl-wrap"><table><thead><tr><th>Payment ID</th><th>Student</th><th>Mode</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
        ps.map(function (x) { return '<tr><td>' + esc(x.id) + '</td><td class="b">' + esc(x.name) + '</td><td>' + payMode(x.mode) + '</td><td>' + inr(x.amount) + '</td><td>' + payStatus(x.status) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty">No payments recorded.</div>') + '</div></div>';
    wireTabs('sdTabs');
  }

  /* ================= student detail ================= */
  function renderStudentDetail() {
    var holder = $('#std');
    if (!holder) return;
    var want = (location.search.match(/[?&]id=([^&]+)/) || [])[1];
    var pendEdit = sessionStorage.getItem('iml_pending_student_edit');
    if (pendEdit) {
      try {
        var pd = JSON.parse(pendEdit);
        var listEl = document.getElementById('studentData');
        var list = JSON.parse(listEl.textContent || '[]');
        for (var i = 0; i < list.length; i++) {
          if (String(list[i].id) === String(pd.id)) { list[i] = Object.assign({}, list[i], pd); break; }
        }
        listEl.textContent = JSON.stringify(list);
      } catch (e) { /* ignore malformed handoff */ }
    }
    var rec = detailJson(want, 'studentData');
    if (!rec) { holder.innerHTML = '<div class="empty">Student not found. <a href="registrations.html" style="color:var(--gold)">← Back to registrations</a></div>'; return; }
    var comps = rec.competitions || [], ps = rec.payments || [], rs = rec.results || [];
    var paid = ps.filter(function (x) { return x.status === 'Paid'; }).length;
    var collected = ps.reduce(function (s, x) { return s + (parseInt(x.amount, 10) || 0); }, 0);
    var best = rs.reduce(function (m, x) { return Math.max(m, x.score || 0); }, 0);
    holder.innerHTML =
      '<div style="display:flex;gap:.6rem;align-items:center;margin-bottom:1rem">' +
      '<a class="btn btn-sm" href="registrations.html">← Back to registrations</a><span class="grow"></span>' +
      '<a class="btn btn-sm btn-gold" href="student-edit.html?id=' + encodeURIComponent(rec.id) + '">✏ Edit</a></div>' +
      '<div class="grid g4" style="margin-bottom:1rem">' +
      '<div class="card"><div style="display:flex;align-items:center;gap:.8rem">' + logoHtml(rec, ' avatar big') +
      '<div><div style="font-weight:800;font-size:1.02rem">' + esc(rec.name) + '</div>' +
      '<small style="display:block;color:var(--muted)">' + esc(rec.school) + ' · Grade ' + esc(rec.grade) + '</small></div></div>' +
      '<div style="margin-top:.6rem">' + bdg(rec.id, 'grey') + ' ' + bdg(rec.gender, 'blue') + '</div></div>' +
      '<div class="card stat"><b>' + comps.length + '</b><small>Competitions</small></div>' +
      '<div class="card stat"><b>' + rs.length + '</b><small>Attempts</small></div>' +
      '<div class="card stat"><b>' + (rs.length ? best + ' / ' + rs[0].total : '—') + '</b><small>Best score</small></div></div>' +
      '<div class="card stat" style="max-width:220px;margin-bottom:1rem"><b>' + inr(collected) + '</b><small>Fees paid (' + paid + '/' + ps.length + ')</small></div>' +
      '<div id="stdTabs"><div class="tabs">' +
      '<button class="tab on" type="button" data-t="personal">Personal Information</button>' +
      '<button class="tab" type="button" data-t="contact">Contact Details</button>' +
      '<button class="tab" type="button" data-t="payments">Payments (' + ps.length + ')</button>' +
      '<button class="tab" type="button" data-t="comps">Competitions (' + comps.length + ')</button>' +
      '<button class="tab" type="button" data-t="results">Results (' + rs.length + ')</button></div>' +
      '<div data-p="personal" class="pane"><div class="card"><dl class="dl">' +
      '<dt>Full name</dt><dd>' + esc(rec.name) + '</dd><dt>Registration ID</dt><dd>' + esc(rec.id) + '</dd>' +
      '<dt>Grade</dt><dd>' + esc(rec.grade) + '</dd><dt>School</dt><dd>' + esc(rec.school) + '</dd>' +
      '<dt>Date of birth</dt><dd>' + esc(rec.dob) + '</dd><dt>Gender</dt><dd>' + esc(rec.gender) + '</dd></dl></div></div>' +
      '<div data-p="contact" class="pane" hidden><div class="card"><dl class="dl">' +
      '<dt>Phone</dt><dd>' + esc(rec.phone) + '</dd><dt>Email</dt><dd>' + esc(rec.email) + '</dd>' +
      '<dt>Parent / Guardian</dt><dd>' + esc(rec.parent) + '</dd><dt>Parent phone</dt><dd>' + esc(rec.parentPhone) + '</dd>' +
      '<dt>Address</dt><dd>' + esc(rec.address) + '</dd></dl></div></div>' +
      '<div data-p="payments" class="pane" hidden>' + (ps.length ?
        '<div class="tbl-wrap"><table><thead><tr><th>Payment ID</th><th>Date</th><th>Mode</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
        ps.map(function (x) { return '<tr><td>' + esc(x.id) + '</td><td>' + esc(x.date) + '</td><td>' + payMode(x.mode) + '</td><td>' + inr(x.amount) + '</td><td>' + payStatus(x.status) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty">No payments recorded.</div>') + '</div>' +
      '<div data-p="comps" class="pane" hidden>' + (comps.length ?
        '<div class="tbl-wrap"><table><thead><tr><th>Competition</th><th>Registered on</th><th>Status</th></tr></thead><tbody>' +
        comps.map(function (x) { return '<tr><td>' + compBadge(x.id) + '</td><td>' + esc(x.date) + '</td><td>' + regStatus(x.status) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty">No competitions registered.</div>') + '</div>' +
      '<div data-p="results" class="pane" hidden>' + (rs.length ?
        '<div class="tbl-wrap"><table><thead><tr><th>Attempt</th><th>Competition</th><th>Date</th><th>Score</th><th style="text-align:right">Actions</th></tr></thead><tbody>' +
        rs.map(function (x) { return '<tr><td><a href="results-detail.html?id=' + encodeURIComponent(x.id) + '" style="color:var(--gold)">' + esc(x.id) + '</a></td><td>' + compBadge(x.comp) + '</td><td>' + esc(x.date) + '</td><td>' + scoreBadge(x.score, x.total) + '</td><td style="text-align:right"><a class="btn btn-sm" href="results-detail.html?id=' + encodeURIComponent(x.id) + '">View</a></td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty">No attempts yet.</div>') + '</div></div>';
    wireTabs('stdTabs');
  }

  /* ================= sponsor detail ================= */
  function renderSponsorDetail() {
    var holder = $('#spd');
    if (!holder) return;
    var want = (location.search.match(/[?&]id=([^&]+)/) || [])[1];
    var rec = detailJson(want, 'sponsorData');
    if (!rec) { holder.innerHTML = '<div class="empty">Sponsor not found. <a href="sponsors.html" style="color:var(--gold)">← Back to sponsors</a></div>'; return; }
    var evts = rec.sponsored || [], ps = rec.payments || [], prds = rec.products || [];
    var paidAmt = ps.reduce(function (s, x) { return s + (parseInt(x.amount, 10) || 0); }, 0);
    holder.innerHTML =
      '<a class="btn btn-sm" style="margin-bottom:1rem" href="sponsors.html">← Back to sponsors</a>' +
      '<div class="grid g4" style="margin-bottom:1rem">' +
      '<div class="card"><div style="display:flex;align-items:center;gap:.8rem">' + logoHtml(rec, ' big') +
      '<div><div style="font-weight:800;font-size:1.02rem">' + esc(rec.name) + '</div>' +
      '<small style="display:block;color:var(--muted)">' + esc(rec.website || '') + ' · partner since ' + esc(rec.since) + '</small></div></div>' +
      '<div style="margin-top:.6rem">' + bdg(rec.id, 'grey') + ' ' + tierBadge(rec.tier) + ' ' + sponStatus(rec.status) + '</div></div>' +
      '<div class="card stat"><b>' + inr(rec.amount) + '</b><small>Committed</small></div>' +
      '<div class="card stat"><b>' + evts.length + '</b><small>Events sponsored</small></div>' +
      '<div class="card stat"><b>' + inr(paidAmt) + '</b><small>Received</small></div></div>' +
      '<div id="spdTabs"><div class="tabs">' +
      '<button class="tab on" type="button" data-t="basic">Basic Details</button>' +
      '<button class="tab" type="button" data-t="events">Sponsored Events (' + evts.length + ')</button>' +
      '<button class="tab" type="button" data-t="payments">Contributions (' + ps.length + ')</button>' +
      '<button class="tab" type="button" data-t="catalog">Catalog (' + prds.length + ')</button></div>' +
      '<div data-p="basic" class="pane"><div class="card"><dl class="dl">' +
      '<dt>Organization</dt><dd>' + esc(rec.name) + '</dd><dt>Contact person</dt><dd>' + esc(rec.contact) + '</dd>' +
      '<dt>Email</dt><dd>' + esc(rec.email) + '</dd><dt>Phone</dt><dd>' + esc(rec.phone) + '</dd>' +
      '<dt>Website</dt><dd>' + esc(rec.website || '—') + '</dd><dt>Tier</dt><dd>' + esc(rec.tier) + '</dd>' +
      '<dt>Committed amount</dt><dd>' + inr(rec.amount) + '</dd><dt>Partner since</dt><dd>' + esc(rec.since) + '</dd>' +
      '<dt>Status</dt><dd>' + esc(rec.status) + '</dd></dl></div></div>' +
      '<div data-p="events" class="pane" hidden>' + (evts.length ?
        '<div class="tbl-wrap"><table><thead><tr><th>Competition</th><th>Sponsorship type</th><th>Amount</th></tr></thead><tbody>' +
        evts.map(function (x) { return '<tr><td>' + compBadge(x.comp) + '</td><td>' + esc(x.type) + '</td><td>' + inr(x.amount) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty">No events sponsored yet.</div>') + '</div>' +
      '<div data-p="payments" class="pane" hidden>' + (ps.length ?
        '<div class="tbl-wrap"><table><thead><tr><th>Payment ID</th><th>Date</th><th>Mode</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
        ps.map(function (x) { return '<tr><td>' + esc(x.id) + '</td><td>' + esc(x.date) + '</td><td>' + payMode(x.mode) + '</td><td>' + inr(x.amount) + '</td><td>' + payStatus(x.status) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty">No contributions received yet.</div>') + '</div>' +
      '<div data-p="catalog" class="pane" hidden><div id="catPane">' +
      '<div class="bar"><span class="grow"></span><button class="btn btn-gold" type="button" data-pact="add">＋ Add Product</button></div>' +
      catalogTable(rec) + '</div></div></div>';
    wireTabs('spdTabs');
    holder.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pact]');
      if (!b) return;
      var act = b.getAttribute('data-pact');
      var items = rec.products || (rec.products = []);
      if (act === 'add') { productForm(rec, null, null); return; }
      var i = parseInt(b.getAttribute('data-i'), 10);
      if (act === 'edit') { productForm(rec, items[i], i); return; }
      if (act === 'del') {
        items.splice(i, 1);
        renderCatalogPane(rec);
        toast('Product removed from catalog');
      }
    });
  }

  /* ================= sponsor catalog (products) ================= */
  function productThumb(p) {
    if (p && p.photo) return '<span class="sp-logo sm"><img src="' + esc(p.photo) + '" alt="' + esc(p.name || '') + '" /></span>';
    return '<span class="sp-logo sm">📦</span>';
  }
  function offerBadge(p) {
    var mrp = parseInt(p.mrp, 10) || 0, price = parseInt(p.price, 10) || 0;
    if (!mrp || !price || price >= mrp) return '';
    var off = Math.round((1 - price / mrp) * 100);
    return '<span class="bdg green">' + off + '% Off</span>';
  }
  function catalogTable(rec) {
    var items = rec.products || [];
    if (!items.length) return '<div class="empty">No products in the catalog yet — add the first one.</div>';
    return '<div class="tbl-wrap"><table><thead><tr><th>Photo</th><th>Product</th><th>Description</th><th>Price</th><th>Purchase link</th><th style="text-align:right">Actions</th></tr></thead><tbody>' +
      items.map(function (p, i) {
        var mrp = parseInt(p.mrp, 10) || 0;
        return '<tr><td>' + productThumb(p) + '</td>' +
          '<td class="b">' + esc(p.name) + '</td>' +
          '<td style="max-width:300px"><small>' + esc(p.desc || '—') + '</small></td>' +
          '<td class="b" style="color:var(--gold-2)">' + (mrp && mrp > (p.price || 0) ? '<small style="text-decoration:line-through;color:var(--faint)">' + inr(mrp) + '</small> ' : '') + inr(p.price) + ' ' + offerBadge(p) + '</td>' +
          '<td>' + (p.link ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener" style="color:var(--gold)">Buy ↗</a>' : '—') + '</td>' +
          '<td style="text-align:right"><button class="btn btn-sm" type="button" data-pact="edit" data-i="' + i + '">Edit</button> <button class="btn btn-sm btn-danger" type="button" data-pact="del" data-i="' + i + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function renderCatalogPane(rec) {
    var pane = $('#catPane');
    if (!pane) return;
    pane.innerHTML = '<div class="bar"><span class="grow"></span><button class="btn btn-gold" type="button" data-pact="add">＋ Add Product</button></div>' + catalogTable(rec);
    var tab = document.querySelector('#spdTabs .tab[data-t="catalog"]');
    if (tab) tab.textContent = 'Catalog (' + (rec.products || []).length + ')';
  }
  function productForm(rec, item, idx) {
    item = item || {};
    modal('Catalog Product',
      '<div class="f"><label>Product photo</label><div class="prd-upload">' +
      '<img id="fPrdPrev" alt="" hidden />' +
      '<input type="file" id="fPrdFile" accept="image/*" />' +
      '<input type="text" id="fPrdPhoto" placeholder="…or paste an image URL" value="' + esc(item.photo || '') + '" /></div></div>' +
      field('Product name *', inp('fPrdName', item.name)) +
      field('Description (like WhatsApp)', '<textarea id="fPrdDesc">' + esc(item.desc || '') + '</textarea>') +
      '<div class="f-row">' + field('Actual price (₹) *', inp('fPrdMrp', item.mrp || '', 'e.g. 5499', 'number')) + field('Offer price (₹) *', inp('fPrdPrice', item.price || '', 'e.g. 3499', 'number')) + '</div>' +
      field('Purchase link', inp('fPrdLink', item.link, 'https://…')) +
      '<p class="hint">The offer badge (like <b>35% Off</b>) is calculated automatically from the actual and offer price.</p>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn-gold" id="fPrdSave">Save Product</button>');
    var prev = $('#fPrdPrev'), photo = $('#fPrdPhoto'), fileIn = $('#fPrdFile');
    function upd() {
      var v = photo.value.trim();
      if (v) { prev.hidden = false; prev.src = v; } else { prev.hidden = true; prev.removeAttribute('src'); }
    }
    photo.addEventListener('input', upd);
    fileIn.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { photo.value = rd.result; upd(); };
      rd.readAsDataURL(f);
    });
    upd();
    $('#fPrdSave').addEventListener('click', function () {
      var name = $('#fPrdName').value.trim();
      var mrp = parseInt($('#fPrdMrp').value, 10) || 0;
      var price = parseInt($('#fPrdPrice').value, 10) || 0;
      if (!name) return toast('Product name is required');
      if (mrp <= 0) return toast('Enter a valid actual price');
      if (price <= 0) return toast('Enter a valid offer price');
      if (price > mrp) return toast('Offer price cannot exceed the actual price');
      var d = {
        name: name,
        desc: $('#fPrdDesc').value.trim(),
        price: price,
        mrp: mrp,
        link: $('#fPrdLink').value.trim(),
        photo: photo.value.trim()
      };
      var items = rec.products || (rec.products = []);
      if (idx == null) items.push(d); else items[idx] = d;
      renderCatalogPane(rec);
      closeModal();
      toast(idx == null ? 'Product added to catalog' : 'Product updated');
    });
  }

  /* ================= prizes stats ================= */
  function refreshPrizeStats() {
    var tb = document.querySelector('tbody[data-tbody="prize"]');
    if (!tb) return;
    var rows = [];
    tb.querySelectorAll('tr[data-json]').forEach(function (tr) { try { rows.push(JSON.parse(tr.getAttribute('data-json'))); } catch (e) {} });
    var pool = rows.reduce(function (s, r) { return s + (r.money || 0); }, 0);
    var comps = {};
    rows.forEach(function (r) { if (r.comp) comps[r.comp] = 1; });
    var top = rows.reduce(function (m, r) { return Math.max(m, r.money || 0); }, 0);
    var set = function (id, v) { var el = $('#' + id); if (el) el.textContent = v; };
    set('stPool', inr(pool)); set('stPrizes', rows.length); set('stTop', inr(top)); set('stComps', Object.keys(comps).length);
  }

  /* ================= sponsor helpers ================= */
  function sponsorRows() {
    var tb = document.querySelector('tbody[data-tbody="spon"]');
    if (!tb) return [];
    var rows = [];
    tb.querySelectorAll('tr[data-json]').forEach(function (tr) { try { rows.push(JSON.parse(tr.getAttribute('data-json'))); } catch (e) {} });
    return rows;
  }
  function refreshSponsorStats() {
    var rows = sponsorRows();
    var set = function (id, v) { var el = $('#' + id); if (el) el.textContent = v; };
    set('stSpTotal', rows.length);
    set('stSpActive', rows.filter(function (r) { return r.status === 'Active'; }).length);
    set('stSpInactive', rows.filter(function (r) { return r.status !== 'Active'; }).length);
    set('stSpAmt', inr(rows.reduce(function (s, r) { return s + (r.amount || 0); }, 0)));
  }
  function applySponsorFilter(val) {
    document.querySelectorAll('tbody[data-tbody="spon"] tr[data-json]').forEach(function (tr) {
      var r = JSON.parse(tr.getAttribute('data-json'));
      tr.hidden = !(val === 'All' || String(r.status) === val);
    });
  }

  /* ================= grievance helpers ================= */
  function grievanceRows() {
    var tb = document.querySelector('tbody[data-tbody="gri"]');
    if (!tb) return [];
    var rows = [];
    tb.querySelectorAll('tr[data-json]').forEach(function (tr) { try { rows.push(JSON.parse(tr.getAttribute('data-json'))); } catch (e) {} });
    return rows;
  }
  function refreshGrievanceStats() {
    var rows = grievanceRows();
    var set = function (id, v) { var el = $('#' + id); if (el) el.textContent = v; };
    set('stGrTotal', rows.length);
    set('stGrNew', rows.filter(function (r) { return r.status === 'New'; }).length);
    set('stGrProgress', rows.filter(function (r) { return r.status === 'In Progress'; }).length);
    set('stGrDone', rows.filter(function (r) { return r.status === 'Resolved'; }).length);
  }
  function applyGrievanceFilter() {
    var t = (($('#fGType') || {}).value), s = (($('#fGStatus') || {}).value);
    document.querySelectorAll('tbody[data-tbody="gri"] tr[data-json]').forEach(function (tr) {
      var r = JSON.parse(tr.getAttribute('data-json'));
      tr.hidden = !(t === 'All' || r.type === t) || !(s === 'All' || r.status === s);
    });
  }

  /* ================= per-page init ================= */
  var page = document.body.getAttribute('data-page');

  fillCompFilters();

  var createFrom = (location.search.match(/[?&]create=([^&]*)/) || [])[1];
  if (createFrom) {
    var createMap = { announcements: 'ann', news: 'news', gallery: 'gal', competitions: 'comp' };
    var createKey = createMap[page];
    if (createKey) setTimeout(function () { handleAdd(createKey); }, 0);
  }

  if (page === 'registrations' || page === 'exams' || page === 'results' || page === 'leaderboard' || page === 'prizes') {
    var compFilter = $('#fComp');
    if (compFilter) compFilter.addEventListener('change', function () { applyCompFilter(this.value); });
  }

  if (page === 'registrations') {
    var pendEdit = sessionStorage.getItem('iml_pending_student_edit');
    if (pendEdit) {
      sessionStorage.removeItem('iml_pending_student_edit');
      try {
        var d = JSON.parse(pendEdit);
        var rows = document.querySelectorAll('tbody[data-tbody="reg"] tr[data-json]');
        var match = null;
        rows.forEach(function (r) {
          try { if (JSON.parse(r.getAttribute('data-json')).id === d.id) match = r; } catch (e) {}
        });
        if (match) {
          match.outerHTML = entities.reg.build('reg', d);
          toast('Registration ' + d.id + ' updated');
        }
      } catch (e) { /* ignore malformed handoff */ }
    }
  }

  if (page === 'competitions') {
    var pendComp = sessionStorage.getItem('iml_pending_comp_edit');
    if (pendComp) {
      sessionStorage.removeItem('iml_pending_comp_edit');
      try {
        var c = JSON.parse(pendComp);
        var compRows = document.querySelectorAll('tbody[data-tbody="comp"] tr[data-json]');
        var compMatch = null;
        compRows.forEach(function (r) {
          try { if (JSON.parse(r.getAttribute('data-json')).id === c.id) compMatch = r; } catch (e) {}
        });
        if (compMatch) {
          compMatch.outerHTML = entities.comp.build('comp', c);
          COMPETITIONS[c.id] = c.title;
          toast('Competition ' + c.id + ' updated');
        }
      } catch (e) { /* ignore malformed handoff */ }
    }
  }

  if (page === 'prizes') refreshPrizeStats();

  if (page === 'plans') { syncPlans(); refreshPlanStats(); }

  if (page === 'sponsors') {
    refreshSponsorStats();
    var spStatus = $('#fStatus');
    if (spStatus) spStatus.addEventListener('change', function () { applySponsorFilter(this.value); });
    var pending = sessionStorage.getItem('iml_pending_sponsor');
    if (pending) {
      sessionStorage.removeItem('iml_pending_sponsor');
      try {
        var d = JSON.parse(pending);
        var tb = tbodyFor('spon');
        if (tb && d && d.name) {
          d.id = nextId('SP', tb);
          tb.insertAdjacentHTML('beforeend', entities.spon.build('spon', d));
          refreshSponsorStats();
          toast('Sponsor "' + d.name + '" added');
        }
      } catch (e) { /* ignore malformed handoff */ }
    }
  }

  if (page === 'grievances') {
    refreshGrievanceStats();
    var gType = $('#fGType'), gStatus = $('#fGStatus');
    if (gType) gType.addEventListener('change', applyGrievanceFilter);
    if (gStatus) gStatus.addEventListener('change', applyGrievanceFilter);
  }

  if (page === 'notifications') {
    var ntTab = 'history';
    function ntShow() {
      var h = $('#ntHistory'), s = $('#ntSend');
      if (!h || !s) return;
      h.hidden = ntTab !== 'history';
      s.hidden = ntTab !== 'send';
      document.querySelectorAll('#ntTabs .tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === ntTab); });
    }
    document.querySelectorAll('#ntTabs .tab').forEach(function (b) {
      b.addEventListener('click', function () { ntTab = b.getAttribute('data-t'); ntShow(); });
    });
    var typeSel = $('#fNType'), subWrap = $('#fNSubWrap'), htmlWrap = $('#fNHtmlWrap'), useHtml = $('#fNUseHtml'), htmlIn = $('#fNHtml');
    if (typeSel) typeSel.addEventListener('change', function () {
      var isEmail = this.value === 'EMAIL';
      subWrap.style.display = isEmail ? '' : 'none';
      htmlWrap.hidden = !isEmail;
      if (!isEmail && useHtml && useHtml.checked) { useHtml.checked = false; htmlIn.hidden = true; }
    });
    if (useHtml) useHtml.addEventListener('change', function () { htmlIn.hidden = !this.checked; });
    var prevBtn = $('#fNPreview');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      var type = typeSel.value, subject = $('#fNSub').value.trim(), msg = $('#fNMsg').value.trim();
      var useHtmlContent = type === 'EMAIL' && useHtml && useHtml.checked && htmlIn.value.trim();
      if (!msg && !useHtmlContent) return toast('Nothing to preview — type a message or paste HTML first');
      var head = subject ? '<div style="padding:12px 14px 8px;color:var(--muted);font-size:.85rem">Subject: <b style="color:var(--text)">' + esc(subject) + '</b></div>' : '';
      var body = useHtmlContent ? htmlIn.value : '<div style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;color:#111;padding:16px;font-size:14px;line-height:1.5">' + esc(msg) + '</div>';
      modal('Preview — ' + (type === 'EMAIL' ? 'Email' : 'SMS'), head +
        '<iframe title="Preview" style="width:100%;height:440px;border:1px solid var(--line);border-radius:10px;background:#fff" sandbox="" srcdoc="' + esc(body) + '"></iframe>',
        '<button class="btn" data-close>Close</button>', true);
    });
    var sendBtn = $('#fNSend');
    if (sendBtn) sendBtn.addEventListener('click', function () {
      var msg = $('#fNMsg').value.trim();
      if (!msg) return toast('Message is required');
      var type = typeSel.value, aud = $('#fNAud').value, subject = type === 'EMAIL' ? $('#fNSub').value.trim() : '';
      var usedHtml = type === 'EMAIL' && useHtml && useHtml.checked && htmlIn.value.trim();
      $('#ntBody').insertAdjacentHTML('afterbegin',
        '<tr><td>' + today() + '</td><td>' + bdg(type, type === 'EMAIL' ? 'blue' : 'purple') + '</td><td>' + esc(aud) + '</td>' +
        '<td class="b" style="max-width:420px">' + esc(subject || msg.slice(0, 70)) + (usedHtml ? '<small>HTML email attached</small>' : '<small>' + esc(msg.slice(0, 90)) + (msg.length > 90 ? '…' : '') + '</small>') + '</td>' +
        '<td>' + bdg('Sent', 'green') + '</td></tr>');
      toast('Notification sent (demo)');
      ntTab = 'history'; ntShow();
    });
    ntShow();
  }

  if (page === 'questions') {
    ['fGrade', 'fCat', 'fLabel', 'fComp'].forEach(function (id) {
      var s = $('#' + id);
      if (s) s.addEventListener('change', applyFilters);
    });
    refreshLabelFilter();
  }

  if (page === 'results-detail') renderResultDetail();
  if (page === 'school-detail') renderSchoolDetail();
  if (page === 'student-detail') renderStudentDetail();
  if (page === 'sponsor-detail') renderSponsorDetail();
})();
