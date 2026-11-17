// People map. The whole network first (people, agencies, companies, think tanks; solid line = document,
// dashed = reporting), filters you can tick several values in and combine, two tiers, and one person's file as the detail view.
// No outside libraries. The layout is computed here, the same way every time, from people.json.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var CH = { D: '<span class="m m-d" title="Document">D</span>', R: '<span class="m m-r" title="Reporting">R</span>' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  var KIND = { p: 'Person', agency: 'Agency or office', company: 'Company or firm', tank: 'Think tank or advocacy group', event: 'Event or document' };
  var SKIP = /^(Special|Private practice)$|^Prior:/;
  var EVENT = /launch|summit|hackathon|^Texts to|^Cited in|disclosing|^Clerkship/i;
  var TANK = /Heritage|Project 2025|Institute|Foundation|Center for|Network|America First|True the Vote|Republican National|Alliance|Coalition/;
  // Longer names for agencies, so "Secretary of Homeland Security" counts as naming DHS.
  var ALIAS = {
    DHS: ['Homeland Security'], DOJ: ['Justice Department', 'Department of Justice', 'Attorney General', 'U.S. Attorney', 'AAG', 'Solicitor General', 'Office of Legal Counsel', 'Civil Rights Division'],
    DoD: ['Defense', 'Secretary of War', 'Pentagon'], SSA: ['Social Security'], OMB: ['Management and Budget'], State: ['State Department', 'Secretary of State'],
    EOP: ['White House', 'President', 'Oval Office', 'NSC'], 'White House': ['President', 'Oval Office'], ODNI: ['National Intelligence', 'DNI'], HUD: ['Housing and Urban'],
    'Supreme Court': ['Chief Justice', 'Associate Justice'], 'U.S. Senate': ['Senator'], 'Center for Renewing America': ['CRA'], 'Conservative Partnership Institute (CPI) network': ['CPI', 'Conservative Partnership Institute'], 'Election Integrity Network': ['EIN'], Education: ['Education Department', 'Secretary of Education'], Treasury: ['Treasury']
  };
  var SELF = /\b(President|Senator|Representative|Justice|Attorney General|Governor|Federal Reserve|Heritage|Claremont|True the Vote|Election Integrity Network|Fannie Mae|FEMA|U\.S\. Attorney|Secretary of [A-Z]|Project 2025|State Election Board|Valor Equity)\b/;

  var P = [], byId = {}, ties = [], vocab = [], flags = [];
  var nodes = [], nodeById = {}, edges = [], adj = {}, orgList = [];
  var picks = [], F = {}, TLR = [], sel = null, hov = null, RQ = [];
  // The menus in the filter row, left to right. People and the project's own filters come first; the rest are
  // things on the record (an office, a body, a system, a document), never a description of a person.
  var FDEF = [
    { k: 'people', label: 'People', find: 'Find a person by name or job' },
    { k: 'ebc', label: 'EBC & [POI] filters' },
    { k: 'agency', label: 'Agency or office', find: 'Find an agency or office' },
    { k: 'organization', label: 'Organization', find: 'Find an organization' },
    { k: 'body', label: 'Task force or body', find: 'Find a task force or body' },
    { k: 'system', label: 'System', find: 'Find a system' },
    { k: 'document', label: 'Document or event', find: 'Find a document or event by a word, a name or a year' },
    { k: 'date', label: 'Date' }
  ];
  // The kinds of thing a person can be in. Each kind with something ticked is one requirement.
  var KINDS = [
    { k: 'flag', label: 'Group' }, { k: 'agency', label: 'Agency or office' }, { k: 'organization', label: 'Organization' },
    { k: 'body', label: 'Task force or body' }, { k: 'system', label: 'System' }, { k: 'document', label: 'Document or event' }
  ];
  var CASEFILES = [['CF-01', 'What’s the BS, Russ?'], ['CF-02', 'The citizen database'], ['CF-03', 'Mississippi’s commercial-data purge'], ['CF-04', 'Pressuring the people who count']];
  var on = { flag: [], agency: [], organization: [], body: [], system: [], document: [] }, marksOn = { P: true, M: true }, dFrom = '', dTo = '', every = false, openF = null, optQ = '';
  var TIER = {}, MM = {}, tierIds = { P: {}, M: {} };
  // The two marks, drawn from the same two symbols everywhere: the map, the key, the menus, the lists and the file.
  function glyph(t) { return '<svg class="mk" aria-hidden="true" viewBox="7 7 86 86"><use href="#' + (t === 'P' ? 'poi-seal' : 'mm-seal') + '" x="0" y="0" width="100" height="100"/></svg>'; }
  var MP = glyph('P'), MK = glyph('M'), POICHIP = '<span class="m m-p"><i>[</i>POI<i>]</i></span>';
  // the EBC avatar as supplied (not redrawn)
  var EBCICON = '<svg class="ebc-i" aria-hidden="true" viewBox="0 0 100 100"><use href="#ebc-avatar" x="0" y="0" width="100" height="100"/></svg>';
  function mark(id) { var t = TIER[id]; return t && marksOn[t] ? ' ' + (t === 'P' ? MP : MK) + '<span class="vh">' + (t === 'P' ? ' (Person of Interest)' : ' (Monitor Mark)') + '</span>' : ''; }
  var CARET = '<svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>';
  var svg, world, lab, T = { x: 0, y: 0, k: 1 }, K0 = 1, box = null, CW = 800, CHT = 600;

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function orgName(o) { return (o || '').replace(/^Gov:\s*/, ''); }
  function orgKind(o) { if (/^Gov:|^DOGE/.test(o)) return 'agency'; if (EVENT.test(o)) return 'event'; if (TANK.test(o)) return 'tank'; return 'company'; }
  function fmtDate(s) {
    if (!s) return ''; var p = s.split('-');
    if (p.length === 1) return p[0];
    if (p.length === 2) return MON[+p[1] - 1] + ' ' + p[0];
    return MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }
  function when(r) { var a = fmtDate(r.date), b = fmtDate(r.end); return a && b ? a + ' to ' + b : (a || (b ? 'Until ' + b : '')); }
  function srcs(s) {
    return (s || []).map(function (x) { return '<a href="' + esc(x.u) + '" rel="noopener">' + esc(x.t || x.u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)) + '</a>'; }).join('; ');
  }
  function mergeSrc(a, b) { var seen = {}; return a.concat(b).filter(function (x) { if (seen[x.u]) return false; seen[x.u] = 1; return true; }); }
  function norm(s) { return (s || '').replace(/\([^)]*\)/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function mentions(text, org) {
    var o = orgName(org), al = [o].concat(ALIAS[o] || []);
    return al.some(function (a) { return a.length > 2 && new RegExp('\\b' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(text); });
  }
  function namesOrg(text) { return SELF.test(text) || /,\s+(the\s+)?[A-Z]/.test(text) || /state senator/i.test(text) || vocab.some(function (o) { return mentions(text, o); }); }

  // One person's file: the current role first, then the rest newest to oldest, with repeats folded together.
  function file(p) {
    var cur = [], hist = [];
    p.roles.forEach(function (r) {
      var c = { date: r.date, end: r.end, org: r.org, role: r.role, kind: r.kind, m: r.m, s: (r.s || []).slice() };
      (r.kind === 'current-role' ? cur : hist).push(c);
    });
    // the same job from two sources becomes one line with both sources
    var out = [];
    hist.forEach(function (r) {
      var n = norm(r.role), hit = null;
      // one background line that names two employers ("Engineer at X and SpaceX") prints once
      if (r.kind === 'background' && out.some(function (o) { return o.kind === 'background' && o.role === r.role; })) return;
      out.forEach(function (o) {
        if (hit || orgName(o.org).toLowerCase() !== orgName(r.org).toLowerCase()) return;
        var on = norm(o.role);
        var same = on === n || (n && on && (on.indexOf(n) === 0 || n.indexOf(on) === 0));
        var dates = !o.date || !r.date || o.date.slice(0, 4) === r.date.slice(0, 4);
        if (same && dates) hit = o;
      });
      if (!hit) { out.push(r); return; }
      if (r.role.length > hit.role.length) hit.role = r.role;
      if (r.date.length > hit.date.length) hit.date = r.date;
      if (!hit.end) hit.end = r.end;
      if (r.m === 'D') hit.m = 'D';
      hit.s = mergeSrc(hit.s, r.s);
    });
    hist = out;
    // an open-ended job that is the current role is shown once, under "Now"
    cur.forEach(function (c) {
      c.since = '';
      hist.forEach(function (h) {
        if (h.used || h.end || !h.org || h.kind !== 'career') return;
        var t = norm(h.role); if (!t || t.split(' ').length > 6) return;
        if (!mentions(c.role, h.org) || c.role.toLowerCase().indexOf(t.split(' ')[0]) < 0) return;
        h.used = true; c.org = c.org || h.org; c.s = mergeSrc(c.s, h.s); if (h.m === 'D') c.m = 'D';
        if (h.date && (!c.since || h.date < c.since)) c.since = h.date;
      });
      c.named = !!c.org || namesOrg(c.role);
    });
    hist = hist.filter(function (h) { return !h.used; });
    hist.forEach(function (h) { h.named = !!h.org || namesOrg(h.role); });
    hist.sort(function (a, b) { var x = a.date || '0', y = b.date || '0'; return x < y ? 1 : x > y ? -1 : 0; });
    return { cur: cur, hist: hist };
  }
  function roleLine(r) {
    var o = orgName(r.org), role = r.role || '';
    if (!o) return '<b>' + esc(role) + '</b>' + (r.named ? '' : ' <span class="nosrc">organization not yet sourced</span>');
    if (/^Prior:/.test(o)) return 'Earlier: ' + esc(o.replace(/^Prior:\s*/, ''));
    if (!role) return '<b>' + esc(o) + '</b>';
    if (mentions(role, r.org)) return '<b>' + esc(role) + '</b>';
    if (role.split(/\s+/).length > 7 || /[;:]/.test(role)) return 'At <b>' + esc(o) + '</b>: ' + esc(role);
    return '<b>' + esc(role) + '</b>, ' + esc(o);
  }
  function tiesOf(id) { return ties.filter(function (t) { return t.a === id || t.b === id; }); }

  // ---------- the graph ----------
  function buildGraph() {
    var members = {}, deg = {};
    P.forEach(function (p) {
      p.roles.forEach(function (r) {
        if (!r.org || SKIP.test(r.org)) return;
        var m = members[r.org] = members[r.org] || {};
        if (!m[p.id] || r.m === 'D') m[p.id] = r.m;
      });
    });
    function add(n) { n.i = nodes.length; nodes.push(n); nodeById[n.id] = n; adj[n.id] = {}; }
    P.forEach(function (p) { add({ id: p.id, t: 'p', name: p.name, p: p }); });
    Object.keys(members).forEach(function (o) {
      var ids = Object.keys(members[o]); if (ids.length < 2) return;
      var n = { id: 'org:' + o, t: orgKind(o), name: orgName(o), org: o, members: members[o], size: ids.length };
      add(n); orgList.push(n);
      ids.forEach(function (id) { edges.push({ a: id, b: n.id, m: members[o][id], k: 'org' }); });
    });
    var pair = {};
    ties.forEach(function (t) {
      if (!byId[t.a] || !byId[t.b] || t.a === t.b) return;
      var key = t.a < t.b ? t.a + '|' + t.b : t.b + '|' + t.a;
      if (pair[key]) { if (t.m === 'D') pair[key].m = 'D'; return; }
      pair[key] = { a: t.a, b: t.b, m: t.m, k: 'tie' }; edges.push(pair[key]);
    });
    edges.forEach(function (e) { adj[e.a][e.b] = e; adj[e.b][e.a] = e; deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
    nodes.forEach(function (n) { n.deg = deg[n.id] || 0; n.r = n.t === 'p' ? 3.4 + 1.25 * Math.sqrt(n.deg) : 4 + 1.15 * Math.sqrt(n.size); if (n.t === 'p' && TIER[n.id]) n.r = Math.max(n.r, TIER[n.id] === 'P' ? 11 : 8.5); });
  }
  function layout() {
    var live = nodes.filter(function (n) { return n.deg > 0; }), lone = nodes.filter(function (n) { return n.deg === 0; });
    live.sort(function (a, b) { return b.deg - a.deg || (a.id < b.id ? -1 : 1); });
    var n = live.length, i, j, it, k = 34;
    live.forEach(function (v, ix) { var r = 13 * Math.sqrt(ix + 1), a = ix * 2.399963; v.x = r * Math.cos(a); v.y = r * Math.sin(a); });
    var E = edges.map(function (e) { return [nodeById[e.a], nodeById[e.b], e.k === 'tie' ? 1 : .55]; });
    for (it = 0; it < 300; it++) {
      var temp = 26 * (1 - it / 300) + .4;
      for (i = 0; i < n; i++) { live[i].dx = -live[i].x * .034; live[i].dy = -live[i].y * .034; }
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        var a = live[i], b = live[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + .01;
        if (d2 > 90000) continue;
        var f = k * k / d2; dx *= f; dy *= f; a.dx += dx; a.dy += dy; b.dx -= dx; b.dy -= dy;
      }
      for (i = 0; i < E.length; i++) {
        var u = E[i][0], v = E[i][1], ex = u.x - v.x, ey = u.y - v.y, d = Math.sqrt(ex * ex + ey * ey) + .01, fa = d / k * E[i][2] * .5;
        ex *= fa; ey *= fa; u.dx -= ex; u.dy -= ey; v.dx += ex; v.dy += ey;
      }
      for (i = 0; i < n; i++) {
        var w = live[i], m = Math.sqrt(w.dx * w.dx + w.dy * w.dy) + .01, s = Math.min(m, temp) / m;
        w.x += w.dx * s; w.y += w.dy * s;
      }
    }
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    live.forEach(function (v) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); });
    // people with no tie or shared organization on file yet sit in rows underneath
    lone.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var cols = Math.max(1, Math.floor((x1 - x0) / 16)), top = y1 + 46;
    lone.forEach(function (v, ix) { v.x = x0 + (ix % cols) * 16 + 6; v.y = top + Math.floor(ix / cols) * 16; v.lone = true; });
    var yb = lone.length ? top + Math.ceil(lone.length / cols) * 16 : y1;
    box = { x0: x0 - 30, y0: y0 - 30, x1: x1 + 30, y1: yb + 20, loneY: lone.length ? top - 22 : null, loneN: lone.length };
  }
  function ncls(n) { return 'n n-' + n.t + (n.t === 'p' && TIER[n.id] ? ' t-' + TIER[n.id] : ''); }
  function shape(n) {
    var r = n.r, g = el('g', { 'class': ncls(n), 'data-id': n.id, transform: 'translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')' }), s;
    if (n.t === 'p') s = el('circle', { r: r.toFixed(1) });
    else if (n.t === 'agency') s = el('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r });
    else if (n.t === 'company') s = el('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r, transform: 'rotate(45)' });
    else if (n.t === 'tank') s = el('path', { d: 'M0 ' + (-r * 1.25) + 'L' + (r * 1.15) + ' ' + (r * .8) + 'L' + (-r * 1.15) + ' ' + (r * .8) + 'Z' });
    else s = el('circle', { r: r.toFixed(1) });
    s.setAttribute('class', 'sh');
    var tier = n.t === 'p' ? TIER[n.id] : null;
    g.appendChild(el('circle', { r: (r * 1.08).toFixed(1), 'class': 'halo' }));
    g.appendChild(el('circle', { r: Math.max(r + 6, 11), 'class': 'hit' })); g.appendChild(s);
    if (tier) { // the mark itself sits on the dot, from the same symbol the key and the menus use
      var w = (2 * r / .86).toFixed(1), o = (-r / .86).toFixed(1);
      g.appendChild(el('use', { 'class': 'mk', href: '#' + (tier === 'P' ? 'poi-seal' : 'mm-seal'), x: o, y: o, width: w, height: w }));
    }
    var t = el('title', {}); t.textContent = n.name + (n.t === 'p' ? (n.p.now ? ', ' + n.p.now : '') + (tier ? (tier === 'P' ? ' (Person of Interest)' : ' (Monitor Mark)') : '') : ' (' + KIND[n.t].toLowerCase() + ', ' + n.size + ' people on file)'); g.appendChild(t);
    n.el = g; return g;
  }
  function draw() {
    svg = $('pgraph'); world = el('g', { id: 'pworld' }); lab = el('g', { id: 'plabels', 'aria-hidden': 'true' });
    // sizes are designed in screen pixels at the fitted view, so divide by that view's scale
    size(); var k0 = Math.min(CW / (box.x1 - box.x0), CHT / (box.y1 - box.y0));
    nodes.forEach(function (n) { n.r = n.r / k0 * (CW < 600 ? .8 : 1); });
    var ge = el('g', {}), gn = el('g', {});
    edges.forEach(function (e) {
      var a = nodeById[e.a], b = nodeById[e.b];
      e.el = el('line', { x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1), 'class': 'e e-' + e.k + ' e-' + e.m });
      ge.appendChild(e.el);
    });
    if (box.loneY !== null) {
      var t = el('text', { x: box.x0 + 30, y: box.loneY, 'class': 'lone-t', 'font-size': (12.5 / k0).toFixed(1) }); t.textContent = 'No tie or shared organization on file yet (' + box.loneN + ' people)'; world.appendChild(t);
    }
    nodes.slice().sort(function (a, b) { function z(n) { return (n.t === 'p' ? 1 : 0) + (n.t === 'p' && TIER[n.id] ? 1 : 0); } return z(a) - z(b); }).forEach(function (n) { gn.appendChild(shape(n)); });
    world.appendChild(ge); world.appendChild(gn); svg.appendChild(world); svg.appendChild(lab);
    size(); fit(); paint();
  }
  function size() { var r = svg.getBoundingClientRect(); CW = r.width || 800; CHT = r.height || 600; svg.setAttribute('viewBox', '0 0 ' + CW + ' ' + CHT); }
  function fit() {
    var w = box.x1 - box.x0, h = box.y1 - box.y0;
    K0 = Math.min(CW / w, CHT / h); T.k = K0; T.x = (CW - w * K0) / 2 - box.x0 * K0; T.y = (CHT - h * K0) / 2 - box.y0 * K0; apply();
  }
  var raf = 0;
  function apply() {
    world.setAttribute('transform', 'translate(' + T.x.toFixed(1) + ',' + T.y.toFixed(1) + ') scale(' + T.k.toFixed(4) + ')');
    svg.style.touchAction = T.k > K0 * 1.08 ? 'none' : 'pan-y';
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; labels(); });
  }
  function zoomAt(cx, cy, f) {
    var k = Math.max(K0 * .7, Math.min(K0 * 14, T.k * f)); f = k / T.k;
    T.x = cx - (cx - T.x) * f; T.y = cy - (cy - T.y) * f; T.k = k; apply();
  }
  function center(n) {
    var k = Math.max(T.k, K0 * 2.6); T.k = k; T.x = CW / 2 - n.x * k; T.y = CHT * .45 - n.y * k; apply();
  }
  // What is lit up. Every filter in use is one requirement: a person meets it by being in any value ticked there
  // (or, with "every" on, each ticked value is its own requirement). The tiers, the dates and each network added
  // from a file are requirements too. Lit = meets at least one. Ringed in amber = meets all of them.
  function idsOf(k, vals) { var o = {}; vals.forEach(function (v) { var m = (F[k] || {})[v] || {}; for (var id in m) o[id] = 1; }); return o; }
  function within(s, e) { return (!dTo || s <= dTo) && (!dFrom || (e + '~') >= dFrom); }
  function dateIds() {
    var o = {};
    P.forEach(function (p) {
      if (p.roles.some(function (r) { return r.date && within(r.date, r.end || r.date); }) || p.tl.some(function (i) { return within(TLR[i].d, TLR[i].d); })) o[p.id] = 1;
    });
    ties.forEach(function (t) { if (t.date && within(t.date, t.date)) { o[t.a] = 1; o[t.b] = 1; } });
    return o;
  }
  function reqs() {
    var R = [];
    picks.forEach(function (id) { R.push({ id: id }); });   // each person ticked is a requirement of their own: tied to them
    KINDS.forEach(function (f) {
      var v = on[f.k]; if (!v.length) return;
      if (every) v.forEach(function (x) { R.push({ f: f, vals: [x], ids: idsOf(f.k, [x]) }); });
      else R.push({ f: f, vals: v.slice(), ids: idsOf(f.k, v) });
    });
    if (dFrom || dTo) R.push({ date: 1, ids: dateIds() });
    return R;
  }
  function inSet(n, s) {
    if (s.ids) return n.t === 'p' ? !!s.ids[n.id] : Object.keys(n.members).some(function (id) { return !!s.ids[id]; });
    return n.id === s.id || !!adj[s.id][n.id];
  }
  function anyOn() { return RQ.length > 0; }
  function focusId() { return hov || sel; }
  // classes for filter, hover and selection
  function paint() {
    RQ = reqs(); var S = RQ, focus = focusId(), f = S.length > 0;
    svg.classList.toggle('has-focus', !!focus && !f); svg.classList.toggle('has-filter', f); svg.classList.toggle('has-multi', S.length > 1); svg.classList.toggle('hide-P', !marksOn.P); svg.classList.toggle('hide-M', !marksOn.M);
    nodes.forEach(function (n) {
      var c = ncls(n);
      n.sets = [];
      if (f) {
        S.forEach(function (s, i) { if (inSet(n, s)) n.sets.push(i); });
        n.fin = n.sets.length > 0;
        // a person is ringed when they meet everything; an organization when every person ticked sits in it
        n.both = n.t === 'p' ? S.length > 1 && n.sets.length === S.length : picks.length > 1 && picks.every(function (id) { return !!adj[id][n.id]; });
        c += n.fin ? ' in' : ' out'; if (n.both) c += ' both';
      } else { n.fin = true; n.both = false; }
      if (picks.indexOf(n.id) >= 0) c += ' pick';
      if (focus && (n.id === focus || adj[focus][n.id])) c += ' on';
      if (focus && n.id === focus) c += ' foc';
      if (n.id === sel) c += ' sel';
      n.el.setAttribute('class', c);
    });
    edges.forEach(function (e) {
      var c = 'e e-' + e.k + ' e-' + e.m, a = nodeById[e.a], b = nodeById[e.b];
      if (f) { c += (a.fin && b.fin) ? ' in' : ' out'; if (e.k === 'tie' && S.length > 1 && a.fin && b.fin && cross(a, b)) c += ' cross'; }
      if (focus && (e.a === focus || e.b === focus)) c += ' on';
      e.el.setAttribute('class', c);
    });
    labels();
  }
  function cross(a, b) { // a tie that runs between two different lit-up sets
    return a.sets.some(function (i) { return b.sets.some(function (j) { return i !== j; }); });
  }
  function labels() {
    if (!lab) return;
    while (lab.firstChild) lab.removeChild(lab.firstChild);
    var focus = focusId(), f = anyOn(), placed = [], count = 0;
    var cand = nodes.filter(function (n) {
      var x = n.x * T.k + T.x, y = n.y * T.k + T.y; n.sx = x; n.sy = y;
      return x > -20 && x < CW + 20 && y > 0 && y < CHT;
    });
    function pri(n) {
      var s = n.t === 'p' ? n.deg : n.size * 1.6;
      // with filters on, the people they light come before the organizations those people sit in
      if (f && n.t !== 'p') s *= .2;
      if (f && n.t === 'p' && n.fin) s += 40 + n.sets.length * 60;
      if (n.lone) s -= 100;
      if (f && !n.fin) s -= 1000;
      if (n.both) s += 400;
      if (TIER[n.id] === 'P' && marksOn.P) s += 60;
      if (picks.indexOf(n.id) >= 0) s += 3000;
      if (focus) { if (n.id === focus) s += 5000; else if (adj[focus][n.id]) s += (f ? 0 : 2000); else if (!f) s -= 500; }
      return s;
    }
    cand.forEach(function (n) { n.pri = pri(n); });
    cand.sort(function (a, b) { return b.pri - a.pri; });
    var zoomed = T.k / K0, max = Math.round(26 + 22 * (zoomed - 1));
    cand.forEach(function (n) {
      var forced = n.pri >= 2000;
      if (!forced && (count >= max || n.pri < (zoomed > 3 ? -50 : 1))) return;
      var w = n.name.length * 6.6 + 8, r = n.r * T.k, x = n.sx + r + 4, y = n.sy + 4, left = false;
      if (x + w > CW - 2) { x = n.sx - r - 4 - w; left = true; }
      if (x < 2 && !forced) return;
      var rect = [x - 2, y - 13, x + w, y + 4], i;
      for (i = 0; i < placed.length; i++) { var q = placed[i]; if (rect[0] < q[2] && rect[2] > q[0] && rect[1] < q[3] && rect[3] > q[1]) { if (n.pri >= 5000) break; return; } }
      placed.push(rect); count++;
      var t = el('text', { x: (left ? x + w - 8 : x).toFixed(1), y: y.toFixed(1), 'class': 'lb' + (n.t === 'p' ? '' : ' lb-o') + (n.id === focus ? ' lb-f' : ''), 'text-anchor': left ? 'end' : 'start' });
      t.textContent = n.name; lab.appendChild(t);
    });
  }

  // ---------- pointer: pan, pinch, hover, click ----------
  function wire() {
    var pts = {}, moved = false, start = null, pinch = 0;
    function pos(e) { var r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function nodeAt(e) { var g = e.target.closest ? e.target.closest('g.n') : null; return g ? g.getAttribute('data-id') : null; }
    svg.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = pos(e); moved = false; start = { p: pos(e), tx: T.x, ty: T.y, id: nodeAt(e) };
      var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) { if (e.pointerType === 'mouse') { var id = nodeAt(e); if (id !== hov) { hov = id; paint(); } } return; }
      var p = pos(e), ids = Object.keys(pts);
      if (ids.length === 2) {
        pts[e.pointerId] = p; var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch); pinch = d; moved = true; return;
      }
      var dx = p.x - start.p.x, dy = p.y - start.p.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      if (!moved) { moved = true; try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
      T.x = start.tx + dx; T.y = start.ty + dy; apply();
    });
    function up(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId]; pinch = 0;
      if (!moved && e.type === 'pointerup') { if (start.id) select(sel === start.id ? null : start.id, false); else if (sel) select(null); }
      if (Object.keys(pts).length === 1) { var k = Object.keys(pts)[0]; start = { p: pts[k], tx: T.x, ty: T.y, id: null }; }
    }
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && hov) { hov = null; paint(); } });
    svg.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); var p = pos(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * .01));
    }, { passive: false });
    $('pz-in').addEventListener('click', function () { zoomAt(CW / 2, CHT / 2, 1.5); });
    $('pz-out').addEventListener('click', function () { zoomAt(CW / 2, CHT / 2, 1 / 1.5); });
    $('pz-fit').addEventListener('click', fit);
    var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { var k = T.k / K0; size(); if (k < 1.08) fit(); else apply(); }, 150); });
  }

  // ---------- filters: set them in the row above the map, then move around the map freely ----------
  function clip(s, n) { s = s || ''; return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '…'; }
  function optText(k, v) { return k === 'document' ? TLR[+v].e : v; }
  function chipText(k, v) { return k === 'document' ? fmtDate(TLR[+v].d) + ': ' + clip(TLR[+v].e, 44) : v; }
  function fdef(k) { return FDEF.filter(function (f) { return f.k === k; })[0]; }
  function kdef(k) { return KINDS.filter(function (f) { return f.k === k; })[0]; }
  function fname(f) { return f.k === 'ebc' ? EBCICON + 'EBC &amp; ' + POICHIP + ' filters' : esc(f.label); }
  // The row of menus. Each opens a list you can tick through; the list stays open until you close it.
  function bar() {
    $('pfbar').innerHTML = FDEF.map(function (f) {
      var n = f.k === 'date' ? (dFrom || dTo ? 1 : 0) : f.k === 'people' ? picks.length : f.k === 'ebc' ? on.flag.length : on[f.k].length;
      return '<button type="button" class="pm-fbtn' + (n ? ' has' : '') + '" data-f="' + f.k + '" aria-expanded="' + (openF === f.k ? 'true' : 'false') + '" aria-controls="pfp">' + fname(f) + (n ? ' <span class="k">' + (f.k === 'date' ? 'set' : n) + '</span>' : '') + CARET + '</button>';
    }).join('');
    $('pfbar').querySelectorAll('button[data-f]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-f'); openF = openF === k ? null : k; optQ = ''; bar(); panel();
        if (openF) { var q = $('pfq') || $('pdf'); if (q && window.innerWidth > 900) q.focus(); }
      });
    });
  }
  // Everything in use except kind k: the count beside each value says how many of its people also meet these.
  function others(k) { return RQ.filter(function (s) { return !(s.f && s.f.k === k); }); }
  function meets(id, S) { var n = nodeById[id]; return !!n && S.every(function (s) { return inSet(n, s); }); }
  function head(title, find) {
    return '<div class="pm-panel-head"><h2>' + title + '</h2>' + (find ? '<label class="vh" for="pfq">' + esc(find) + '</label><input id="pfq" class="search" type="search" placeholder="' + esc(find) + '" autocomplete="off">' : '') + '<button type="button" class="linkish" id="pfdone">Close</button></div>';
  }
  function panel() {
    var box = $('pfp');
    if (!openF) { box.hidden = true; box.innerHTML = ''; return; }
    var f = fdef(openF); box.hidden = false;
    if (f.k === 'date') {
      box.innerHTML = head('Date') +
        '<div class="pm-dates"><label for="pdf">From <input id="pdf" class="search" type="date" value="' + esc(dFrom) + '"></label><label for="pdt">To <input id="pdt" class="search" type="date" value="' + esc(dTo) + '"></label></div>' +
        '<p class="label">Lights up the people who have a role, a tie or a timeline row dated in this range. Leave one end empty for everything before or after.</p>';
      $('pdf').addEventListener('change', function () { dFrom = this.value; filtered(); });
      $('pdt').addEventListener('change', function () { dTo = this.value; filtered(); });
    } else if (f.k === 'ebc') {
      box.innerHTML = head(fname(f)) + '<div id="pfopts"></div>'; ebcOpts();
    } else {
      box.innerHTML = head(esc(f.label), f.find) + '<p class="label" id="pfhow"></p><div id="pfopts"></div>';
      var t; $('pfq').addEventListener('input', function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { optQ = v.trim(); redrawOpts(); }, 100); });
      redrawOpts();
    }
    $('pfdone').addEventListener('click', function () { openF = null; bar(); panel(); });
  }
  function redrawOpts() { if (!openF || openF === 'date') return; (openF === 'ebc' ? ebcOpts : openF === 'people' ? peopleOpts : opts)(); }
  function tickRow(k, r, S, wide) {
    return '<li' + (S.length && !r.x ? ' class="zero"' : '') + '><label><input type="checkbox" data-k="' + k + '" value="' + esc(r.v) + '"' + (on[k].indexOf(r.v) >= 0 ? ' checked' : '') + '><span class="t">' + (r.d ? '<span class="d">' + esc(fmtDate(r.d)) + '</span> ' : '') + esc(wide ? clip(r.t, 170) : r.t) + '</span><span class="c">' + (S.length ? r.x + ' of ' + r.n : r.n) + '</span></label></li>';
  }
  function wireTicks() {
    $('pfopts').querySelectorAll('input[data-k]').forEach(function (c) {
      c.addEventListener('change', function () {
        var a = on[c.getAttribute('data-k')], i = a.indexOf(c.value);
        if (c.checked && i < 0) a.push(c.value); else if (!c.checked && i >= 0) a.splice(i, 1);
        filtered();
      });
    });
  }
  function rowsOf(k, S) {
    return Object.keys(F[k]).map(function (v) {
      var ids = Object.keys(F[k][v]), doc = k === 'document';
      return { v: v, n: ids.length, x: S.length ? ids.filter(function (id) { return meets(id, S); }).length : ids.length, t: optText(k, v), d: doc ? TLR[+v].d : '', a: doc ? TLR[+v].a : '' };
    });
  }
  function opts() {
    var f = fdef(openF), S = others(f.k), q = optQ.toLowerCase(), isDoc = f.k === 'document', rows = rowsOf(f.k, S);
    if (q) rows = rows.filter(function (r) { return (r.t + ' ' + r.a + ' ' + fmtDate(r.d) + ' ' + r.d).toLowerCase().indexOf(q) >= 0; });
    rows.sort(function (a, b) {
      var ca = on[f.k].indexOf(a.v) >= 0, cb = on[f.k].indexOf(b.v) >= 0;
      if (ca !== cb) return ca ? -1 : 1;
      if (S.length && (a.x > 0) !== (b.x > 0)) return a.x > 0 ? -1 : 1;
      if (isDoc) return (S.length ? b.x - a.x : 0) || (a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
      return (S.length ? b.x - a.x : 0) || b.n - a.n || a.t.localeCompare(b.t);
    });
    var MAX = isDoc ? 60 : 120, more = rows.length - MAX;
    $('pfhow').textContent = 'Tick as many as you like. ' + (S.length ? 'The number beside each one is how many of its people are also in your other filters.' : 'The number beside each one is how many people are on file under it.');
    $('pfopts').innerHTML = rows.length ? '<ul class="pm-opts' + (isDoc ? ' wide' : '') + '">' + rows.slice(0, MAX).map(function (r) { return tickRow(f.k, r, S, isDoc); }).join('') + '</ul>' + (more > 0 ? '<p class="label pm-more">' + more + ' more. Type in the box above to narrow the list.</p>' : '') : '<p class="label">Nothing on file matches that. Try a shorter word.</p>';
    wireTicks();
  }
  // EBC & [POI] filters: the two marks (on by default; untick to take them off the map), the groups the project
  // sorts people into, and the Case Files (not tagged on the timeline yet).
  function ebcOpts() {
    var S = others('flag'), rows = rowsOf('flag', S).sort(function (a, b) { return b.n - a.n; }), h = '';
    h += '<h3 class="pm-sub">Marks</h3><ul class="pm-opts">' + ['P', 'M'].map(function (t) {
      return '<li><label><input type="checkbox" data-mark="' + t + '"' + (marksOn[t] ? ' checked' : '') + '><span class="t">' + (t === 'P' ? MP + ' Persons of Interest' : MK + ' Monitor Marks') + '</span><span class="c">' + Object.keys(tierIds[t]).length + '</span></label></li>';
    }).join('') + '</ul>';
    h += '<p class="label pm-note">' + MP + ' marks a Person of Interest: someone Amanda has chosen to watch. ' + MK + ' is a Monitor Mark: the monitor adds it by count when a person keeps turning up in the record. Neither one says anyone broke a law. Both are on the map to start with; untick one to take its marks off.</p>';
    h += '<h3 class="pm-sub">Groups</h3><p class="label">' + (S.length ? 'The number beside each one is how many of its people are also in your other filters.' : 'The number beside each one is how many people are on file under it.') + '</p><ul class="pm-opts">' + rows.map(function (r) { return tickRow('flag', r, S); }).join('') + '</ul>';
    h += '<h3 class="pm-sub">Case Files</h3><ul class="pm-opts">' + CASEFILES.map(function (c) {
      return '<li class="zero"><label><input type="checkbox" disabled><span class="t"><span class="d">' + c[0] + '</span> ' + esc(c[1]) + '</span></label></li>';
    }).join('') + '</ul><p class="label pm-note">The timeline rows aren’t tagged by Case File yet, so these can’t be ticked.</p>';
    $('pfopts').innerHTML = h; wireTicks();
    $('pfopts').querySelectorAll('input[data-mark]').forEach(function (c) {
      c.addEventListener('change', function () { marksOn[c.getAttribute('data-mark')] = c.checked; filtered(); ebcOpts(); });
    });
  }
  // People: tick two or more to see what they share.
  function peopleOpts() {
    var S = RQ.filter(function (s) { return !s.id; }), q = optQ.toLowerCase();
    var rows = P.filter(function (p) { return !q || (p.name + ' ' + p.now + ' ' + p.groups.join(' ')).toLowerCase().indexOf(q) >= 0; })
      .map(function (p) { return { p: p, c: picks.indexOf(p.id) >= 0, x: !S.length || meets(p.id, S) }; });
    rows.sort(function (a, b) { if (a.c !== b.c) return a.c ? -1 : 1; if (a.x !== b.x) return a.x ? -1 : 1; return 0; });
    var MAX = 150, more = rows.length - MAX;
    $('pfhow').textContent = 'Tick two or more people to see what they share: offices, organizations, bodies, systems and timeline rows, and anyone tied to all of them.' + (S.length ? ' People in your other filters come first.' : '');
    $('pfopts').innerHTML = rows.length ? '<ul class="pm-opts">' + rows.slice(0, MAX).map(function (r) {
      return '<li' + (r.x ? '' : ' class="zero"') + '><label><input type="checkbox" value="' + esc(r.p.id) + '"' + (r.c ? ' checked' : '') + '><span class="t">' + esc(r.p.name) + mark(r.p.id) + '<span class="sub">' + esc(r.p.now || r.p.groups.join(', ')) + '</span></span></label></li>';
    }).join('') + '</ul>' + (more > 0 ? '<p class="label pm-more">' + more + ' more. Type a name in the box above.</p>' : '') : '<p class="label">Nobody by that name is on file. Try a last name.</p>';
    $('pfopts').querySelectorAll('input').forEach(function (c) {
      c.addEventListener('change', function () {
        var i = picks.indexOf(c.value);
        if (c.checked && i < 0) picks.push(c.value); else if (!c.checked && i >= 0) picks.splice(i, 1);
        filtered();
      });
    });
  }
  // What is ticked, as chips you can take off again. The words between them say how they combine.
  function pk(attrs, label, plain) {
    return '<button type="button" class="pk" aria-pressed="true" ' + attrs + ' aria-label="Take ' + esc(plain) + ' off">' + label + ' <span aria-hidden="true">×</span></button>';
  }
  function pickChips() {
    var box = $('ppicks'), ev = $('pevery');
    if (!RQ.length) { box.hidden = true; box.innerHTML = ''; ev.hidden = true; return; }
    var parts = [], multi = false, jn = '<span class="jn">' + (every ? 'and' : 'or') + '</span>';
    if (picks.length) parts.push('<span class="fl">People</span>' + picks.map(function (id) { return pk('data-pick="' + esc(id) + '"', esc(byId[id].name), byId[id].name); }).join('<span class="jn">and</span>'));
    KINDS.forEach(function (f) {
      var v = on[f.k]; if (!v.length) return; if (v.length > 1) multi = true;
      parts.push('<span class="fl">' + esc(f.label) + '</span>' + v.map(function (x) { return pk('data-k="' + f.k + '" data-v="' + esc(x) + '"', esc(chipText(f.k, x)), chipText(f.k, x)); }).join(jn));
    });
    if (dFrom || dTo) { var dl = dFrom && dTo ? fmtDate(dFrom) + ' to ' + fmtDate(dTo) : dFrom ? 'From ' + fmtDate(dFrom) : 'Up to ' + fmtDate(dTo); parts.push('<span class="fl">Date</span>' + pk('data-date="1"', esc(dl), dl)); }
    box.hidden = false;
    box.innerHTML = parts.join('<span class="jn jn-and">and</span>') + '<button type="button" class="pk-clear" data-clear="1">Clear all</button>';
    box.querySelectorAll('button[data-k]').forEach(function (b) { b.addEventListener('click', function () { var a = on[b.getAttribute('data-k')]; a.splice(a.indexOf(b.getAttribute('data-v')), 1); filtered(true); }); });
    box.querySelectorAll('button[data-date]').forEach(function (b) { b.addEventListener('click', function () { dFrom = dTo = ''; filtered(true); }); });
    box.querySelectorAll('button[data-pick]').forEach(function (b) { b.addEventListener('click', function () { togglePick(b.getAttribute('data-pick')); }); });
    box.querySelector('[data-clear]').addEventListener('click', function () {
      picks = []; dFrom = dTo = ''; every = false; KINDS.forEach(function (f) { on[f.k] = []; }); filtered(true);
    });
    ev.hidden = !multi;
    if (multi) {
      ev.innerHTML = every ? 'Two ticks in the same filter now count only a person who is in both. <button type="button" class="linkish">Count a person in either one</button>'
        : 'Two ticks in the same filter count a person who is in either one. <button type="button" class="linkish">Count only people in both</button>';
      ev.querySelector('button').addEventListener('click', function () { every = !every; filtered(true); });
    }
  }
  function togglePick(id) {
    var i = picks.indexOf(id);
    if (i >= 0) picks.splice(i, 1); else picks.push(id);
    filtered(true);
  }
  function filteredLater() { setTimeout(filtered, 0); }
  function names(list, max) {
    return list.slice(0, max).map(function (n) { return '<button type="button" class="linkish" data-id="' + esc(n.id) + '">' + esc(n.name) + '</button>' + mark(n.id); }).join(', ') + (list.length > max ? ' and ' + (list.length - max) + ' more' : '');
  }
  function byLast(a, b) { return a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0]); }
  function nameList(ids) { var a = ids.map(function (id) { return byId[id].name; }); return a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  // Two or more people ticked: what the record puts them in together, most of them first.
  function overlap() {
    if (picks.length < 2) return '';
    var groups = {}, order = [], kinds = KINDS.slice(1);
    kinds.forEach(function (f) {
      Object.keys(F[f.k]).forEach(function (v) {
        var who = picks.filter(function (id) { return !!F[f.k][v][id]; });
        if (who.length < 2) return;
        var key = who.join('|'); if (!groups[key]) { groups[key] = { who: who, items: {} }; order.push(key); }
        (groups[key].items[f.k] = groups[key].items[f.k] || []).push(v);
      });
    });
    order.sort(function (a, b) { return groups[b].who.length - groups[a].who.length; });
    function val(k, v) { return '<button type="button" class="linkish" data-k="' + k + '" data-v="' + esc(v) + '">' + esc(k === 'document' ? fmtDate(TLR[+v].d) + ': ' + clip(TLR[+v].e, 70) : v) + '</button>'; }
    function vals(k, arr) {
      if (k !== 'document') return arr.map(function (v) { return val(k, v); }).join(', ');
      arr.sort(function (a, b) { return TLR[+a].d < TLR[+b].d ? 1 : -1; });
      return arr.length + (arr.length === 1 ? ' row' : ' rows') + ' (' + arr.slice(0, 2).map(function (v) { return val(k, v); }).join('; ') + (arr.length > 2 ? '; and ' + (arr.length - 2) + ' more' : '') + ')';
    }
    var lines = order.slice(0, 8).map(function (key) {
      var g = groups[key], w = g.who.length === picks.length ? (picks.length === 2 ? 'Both' : 'All ' + picks.length) : nameList(g.who);
      return '<li><span class="fk">' + esc(w) + '</span><span>' + kinds.filter(function (f) { return g.items[f.k]; }).map(function (f) { return '<span class="ok">' + esc(f.k === 'document' ? 'Timeline' : f.label) + ':</span> ' + vals(f.k, g.items[f.k]); }).join('<br>') + '</span></li>';
    });
    ties.forEach(function (t) {
      if (picks.indexOf(t.a) < 0 || picks.indexOf(t.b) < 0 || t.a === t.b) return;
      lines.push('<li><span class="fk">Sourced tie</span><span><b>' + esc(byId[t.a].name) + ' and ' + esc(byId[t.b].name) + '</b> <span class="tt">(' + esc(t.type) + ')</span> ' + esc(clip(t.ev, 160)) + ' ' + (CH[t.m] || '') + '<span class="sr">' + srcs(t.s) + '</span></span></li>');
    });
    if (!lines.length) return '<div class="pm-ov"><p><b>Nothing on file puts ' + esc(nameList(picks)) + ' in the same place yet.</b> There is no shared office, organization, body, system or timeline row, and no sourced tie between them.</p></div>';
    return '<div class="pm-ov"><h2>What ' + esc(nameList(picks)) + ' share</h2><ol class="pm-rows">' + lines.join('') + '</ol>' + (order.length > 8 ? '<p class="label">' + (order.length - 8) + ' more combinations of two. Take someone off to narrow it down.</p>' : '') + '<p class="label">Click anything they share to add it as a filter and see who else is in it.</p></div>';
  }
  function filtered(redraw) {
    paint(); index(); bar(); pickChips();
    if (redraw) redrawOpts();
    if (sel) card();
    var s = $('psum'), ov = $('pover'), S = RQ, html;
    ov.innerHTML = overlap(); bind(ov);
    ov.querySelectorAll('button[data-k]').forEach(function (b) { b.addEventListener('click', function () { var a = on[b.getAttribute('data-k')], v = b.getAttribute('data-v'); if (a.indexOf(v) < 0) a.push(v); filtered(true); }); });
    if (!S.length) { s.innerHTML = ''; return; }
    var ppl = nodes.filter(function (n) { return n.t === 'p'; }), lit = ppl.filter(function (n) { return n.fin; }).sort(byLast);
    var onlyPicks = S.every(function (x) { return !!x.id; });
    if (S.length === 1) {
      html = onlyPicks ? '<b>' + esc(byId[picks[0]].name) + '</b> and the ' + (lit.length - 1) + ' people tied to them. Tick a second person to see what they share, or tick something in another filter.'
        : '<b>' + lit.length + (lit.length === 1 ? ' person' : ' people') + '</b> lit up' + (lit.length && lit.length <= 16 ? ': ' + names(lit, 16) : '') + '. Tick something in another filter to see who is in both.';
      s.innerHTML = html; bind(s); return;
    }
    var all = ppl.filter(function (n) { return n.both; }).sort(byLast), phrase = onlyPicks ? 'tied to ' + (S.length === 2 ? 'both' : 'all ' + S.length) : 'in all of it';
    var nx = edges.filter(function (e) { return /cross/.test(e.el.getAttribute('class')); }).length;
    if (all.length) html = '<b>' + all.length + (all.length === 1 ? ' person is ' : ' people are ') + phrase + '</b> (ringed in amber): ' + names(all, 14) + '. ';
    else {
      var best = 0; ppl.forEach(function (n) { if (n.sets.length > best) best = n.sets.length; });
      var near = best > 1 ? ppl.filter(function (n) { return n.sets.length === best; }).sort(byLast) : [];
      html = '<b>Nobody on file is ' + (onlyPicks ? 'tied to all ' : 'in all ') + S.length + '.</b> ' + (near.length ? 'The closest ' + (near.length === 1 ? 'is' : 'are') + (onlyPicks ? ' tied to ' : ' in ') + best + ' of the ' + S.length + ': ' + names(near, 10) + '. ' : '');
    }
    var rest = lit.length - all.length;
    html += rest ? rest + (all.length ? ' more ' : ' ') + (rest === 1 ? 'person is' : 'people are') + (onlyPicks ? ' tied to at least one' : ' in at least one') + ' and stay faintly lit. ' : '';
    html += nx && !onlyPicks ? nx + ' sourced ' + (nx === 1 ? 'tie runs' : 'ties run') + ' between people in different filters (the heavy lines).' : '';
    s.innerHTML = html; bind(s);
  }

  // ---------- search and the A to Z index ----------
  function matches(q) {
    q = q.toLowerCase();
    var ps = P.filter(function (p) {
      if ((p.name + ' ' + p.now).toLowerCase().indexOf(q) >= 0) return true;
      return p.roles.some(function (r) { return r.org.toLowerCase().indexOf(q) >= 0; });
    }).map(function (p) { return nodeById[p.id]; });
    var os = orgList.filter(function (n) { return n.name.toLowerCase().indexOf(q) >= 0; });
    return os.concat(ps);
  }
  function results() {
    var q = $('pq').value.trim(), box = $('pres');
    if (q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    var m = matches(q);
    box.hidden = false;
    box.innerHTML = m.length ? m.slice(0, 8).map(function (n) {
      return '<li><button type="button" data-id="' + esc(n.id) + '"><b>' + esc(n.name) + '</b>' + mark(n.id) + '<span>' + esc(n.t === 'p' ? (n.p.now || n.p.groups.join(', ')) : KIND[n.t] + ', ' + n.size + ' people on file') + '</span></button></li>';
    }).join('') + (m.length > 8 ? '<li class="more">' + (m.length - 8) + ' more. Keep typing to narrow it down.</li>' : '') : '<li class="more">Nobody by that name is on file. Try a last name or an agency.</li>';
    bind(box, true);
  }
  function index() {
    var lit = anyOn(), all = RQ.length > 1 && P.some(function (p) { return nodeById[p.id].both; });
    var rows = P.filter(function (p) { return !lit || (all ? nodeById[p.id].both : nodeById[p.id].fin); });
    $('pindex-n').textContent = all ? rows.length + (rows.length === 1 ? ' person' : ' people') + ' in all of it, A to Z' : lit ? rows.length + ' people lit up, A to Z' : 'All ' + P.length + ' people, A to Z';
    $('plist').innerHTML = rows.map(function (p) {
      return '<li><button type="button" data-id="' + p.id + '"' + (sel === p.id ? ' aria-current="true"' : '') + '><b>' + esc(p.name) + '</b>' + mark(p.id) + '<span>' + esc(p.now || p.groups.join(', ')) + '</span></button></li>';
    }).join('');
    bind($('plist'), true);
  }
  function bind(root, go) {
    root.querySelectorAll('button[data-id]').forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-id'), true); }); });
  }

  // ---------- the card ----------
  function host(u) { return u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]; }
  function tierLine(p) {
    var t = TIER[p.id]; if (!t) return '';
    if (t === 'P') return '<p class="pc-tier">' + MP + ' <b>Person of Interest.</b> Chosen by Amanda to watch.</p>';
    var m = MM[p.id], bits = [];
    if (m.rows) bits.push('named in ' + m.rows + ' timeline ' + (m.rows === 1 ? 'row' : 'rows'));
    if (m.signed) bits.push('signed ' + m.signed + (m.signed === 1 ? ' document' : ' documents') + ' on the timeline');
    if (m.links) bits.push('tied to ' + m.links.split(/;\s*/).join(' and '));
    return '<p class="pc-tier">' + MK + ' <b>Monitor Mark.</b> Added by count: ' + esc(bits.join('; ')) + '.</p>';
  }
  // For each ticked value this person is in: what puts them there, its mark and the timeline row behind it.
  function whyLit(p) {
    var rows = [];
    KINDS.forEach(function (f) {
      on[f.k].forEach(function (v) {
        var b = F[f.k][v][p.id]; if (!b) return;
        var r = b.r >= 0 ? TLR[b.r] : null, isDoc = f.k === 'document', w = b.d ? (b.c ? 'as of ' + fmtDate(b.d) : when({ date: b.d, end: b.e })) : '';
        var line = isDoc ? '<b>' + esc(fmtDate(r.d)) + '</b>: ' + esc(clip(r.e, 150)) : '<b>' + esc(v) + '</b>' + (b.t ? ': ' + esc(b.t) : '') + (w ? ' (' + esc(w) + ')' : '');
        var src = r ? (isDoc ? '' : esc(fmtDate(r.d)) + ': ' + esc(clip(r.e, 130)) + ' ') + (r.u ? '<a href="' + esc(r.u) + '" rel="noopener">' + esc(host(r.u)) + '</a>' : '') : srcs(b.s);
        rows.push('<li><span class="fk">' + esc(f.label) + '</span><span>' + line + ' ' + (CH[b.m] || '') + (src ? '<span class="sr">' + src + '</span>' : '') + '</span></li>');
      });
    });
    picks.forEach(function (id) { if (id !== p.id && adj[id][p.id]) rows.push('<li><span class="fk">Tied to</span><span><button type="button" class="linkish" data-id="' + esc(id) + '"><b>' + esc(byId[id].name) + '</b></button></span></li>'); });
    return rows.length ? '<h3>What puts ' + esc(p.name.split(' ')[0]) + ' in your filters</h3><ol class="pm-rows pm-why">' + rows.join('') + '</ol>' : '';
  }
  function tlRows(p) {
    if (!p.tl.length) return '';
    var MAX = 5;
    return '<h3>On the timeline, newest first</h3><ol class="pm-rows" id="pc-tl">' + p.tl.map(function (i, ix) {
      var r = TLR[i];
      return '<li' + (ix >= MAX ? ' hidden' : '') + '><span class="d">' + esc(fmtDate(r.d)) + '</span><span>' + esc(clip(r.e, 280)) + ' ' + (CH[r.m] || '') + (r.u ? '<span class="sr"><a href="' + esc(r.u) + '" rel="noopener">' + esc(host(r.u)) + '</a></span>' : '') + '</span></li>';
    }).join('') + '</ol>' + (p.tl.length > MAX ? '<p style="margin:10px 0 0"><button type="button" class="linkish" id="pc-tlmore">Show all ' + p.tl.length + ' rows</button></p>' : '');
  }
  function pickBtn(p) {
    var inP = picks.indexOf(p.id) >= 0, first = esc(p.name.split(' ')[0]);
    return '<p style="margin:18px 0 0"><button type="button" class="linkish" data-net="' + esc(p.id) + '">' + (inP ? 'Take ' + first + ' off the People filter' : 'Add ' + first + ' to the People filter') + '</button></p>';
  }
  function personCard(p) {
    var f = file(p), T = tiesOf(p.id), h = '';
    h += '<p class="pc-groups">' + esc(p.groups.join(', ')) + '</p><h2 id="pcard-h" tabindex="-1">' + esc(p.name) + '</h2>' + tierLine(p) + whyLit(p);
    if (f.cur.length) {
      h += '<h3>Now</h3><ol class="pm-rows">' + f.cur.map(function (r) {
        return '<li><span class="d">' + (r.since ? 'Since ' + esc(fmtDate(r.since)) : 'Current') + '</span><span>' + roleLine(r) + ' ' + (CH[r.m] || '') + '<span class="sr">' + srcs(r.s) + '</span></span></li>';
      }).join('') + '</ol>';
    }
    h += tlRows(p);
    if (f.hist.length) {
      h += '<h3>Before and alongside, newest first</h3><ol class="pm-rows">' + f.hist.map(function (r) {
        return '<li><span class="d">' + esc(when(r) || 'Undated') + '</span><span>' + roleLine(r) + ' ' + (CH[r.m] || '') + '<span class="sr">' + srcs(r.s) + '</span></span></li>';
      }).join('') + '</ol>';
    }
    if (T.length) {
      h += '<h3>Sourced ties to other people</h3><ol class="pm-rows">' + T.slice().sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; }).map(function (t) {
        var o = byId[t.a === p.id ? t.b : t.a]; if (!o) return '';
        return '<li><span class="d">' + esc(fmtDate((t.date || '').slice(0, 7)) || 'Undated') + '</span><span><button type="button" class="linkish" data-id="' + o.id + '"><b>' + esc(o.name) + '</b></button> <span class="tt">(' + esc(t.type) + ')</span> ' + esc(t.ev) + ' ' + (CH[t.m] || '') + '<span class="sr">' + srcs(t.s) + '</span></span></li>';
      }).join('') + '</ol>';
    } else h += '<p class="pc-none">No person-to-person tie is on file for ' + esc(p.name.split(' ')[0]) + ' yet. Shared employers show up as lines to the organizations in the map.</p>';
    h += pickBtn(p);
    h += '<p style="margin:10px 0 0"><a class="quiet" href="' + window.PEOPLE_TL + encodeURIComponent(p.name) + '">Search the timeline for ' + esc(p.name) + '</a></p>';
    return h;
  }
  function orgCard(n) {
    var ids = Object.keys(n.members).sort(function (a, b) { return byId[a].name < byId[b].name ? -1 : 1; });
    return '<p class="pc-groups">' + esc(KIND[n.t]) + '</p><h2 id="pcard-h" tabindex="-1">' + esc(n.name) + '</h2>' +
      '<h3>' + ids.length + ' people on file here</h3><ol class="pm-rows">' + ids.map(function (id) {
        var p = byId[id], rs = p.roles.filter(function (r) { return r.org === n.org; }), r = rs[0];
        return '<li><span class="d">' + esc(when(r) || 'Undated') + '</span><span><button type="button" class="linkish" data-id="' + id + '"><b>' + esc(p.name) + '</b></button>' + (r.role ? ', ' + esc(r.role) : '') + (rs.length > 1 ? ' (and ' + (rs.length - 1) + ' more ' + (rs.length === 2 ? 'entry' : 'entries') + ')' : '') + ' ' + (CH[n.members[id]] || '') + '</span></li>';
      }).join('') + '</ol>';
  }
  // What a tie box says under the name, kept very short (the card above has the detail and sources).
  // For a working tie, "where" is the organization both people share (one the evidence names first);
  // for an event, a document or money, it is an organization the evidence names, or its first few words.
  // The full evidence is the tooltip.
  var AFFIL = /worked|founded|authored|org tie|colleague|employ|board/i;
  function shortOrg(o) { return orgName(o).replace(/\s*\([^)]*\)/g, ''); }
  function tieWhere(t, p, o) {
    var ev = t.ev || '', mine = {}, shared = [];
    p.roles.forEach(function (r) { if (r.org && !SKIP.test(r.org) && !EVENT.test(r.org)) mine[r.org] = 1; });
    (byId[o.id] ? byId[o.id].roles : []).forEach(function (r) { if (mine[r.org] && shared.indexOf(r.org) < 0) shared.push(r.org); });
    var named = vocab.filter(function (x) { return !EVENT.test(x) && mentions(ev, x); }).sort(function (x, y) { return orgName(y).length - orgName(x).length; });
    var hit = shared.filter(function (x) { return named.indexOf(x) >= 0; })[0] || (AFFIL.test(t.type) ? shared[0] : null) || named[0];
    if (hit) return t.type + ' \u00b7 ' + shortOrg(hit);
    var e = ev.split(';')[0].replace(/\.$/, '');
    if (e.length > 30) e = e.slice(0, 30).replace(/\s+\S*$/, '') + '\u2026';
    return e ? t.type + ' \u00b7 ' + e : t.type;
  }
  function tieTip(t) { return (t.date ? fmtDate(t.date) + ': ' : '') + (t.ev || t.type); }
  function ego(p) {
    var host = $('ego'), f = file(p), TT = tiesOf(p.id), T = TT.slice(0, 14), orgs = [], seen = {};
    f.cur.concat(f.hist).forEach(function (r) { var o = orgName(r.org); if (o && !seen[o] && !SKIP.test(r.org) && orgs.length < 10) { seen[o] = 1; orgs.push(r); } });
    if (!T.length && !orgs.length) { host.hidden = true; return; }
    host.hidden = false;
    var rowH = 76, n = Math.max(T.length, orgs.length, 1), H = Math.max(n * rowH + 30, 200), W = 900, cx = 330, cw = 240, cy = H / 2 - 40, html = '';
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" class="ego-lines" aria-hidden="true">';
    T.forEach(function (t, i) {
      var o = byId[t.a === p.id ? t.b : t.a]; if (!o) return; var y = 14 + i * rowH + (n - T.length) * rowH / 2;
      s += '<path d="M200 ' + (y + 22) + ' H260 V' + (cy + 40) + ' H' + cx + '" class="eline e-' + t.m + '"/>';
      html += '<button type="button" class="enode en-person" style="left:0;top:' + y + 'px" data-id="' + o.id + '" title="' + esc(tieTip(t)) + '"><b>' + esc(o.name) + '</b><span>' + esc(tieWhere(t, p, o)) + '</span></button>';
    });
    orgs.forEach(function (r, i) {
      var y = 14 + i * rowH + (n - orgs.length) * rowH / 2, on = nodeById['org:' + r.org];
      s += '<path d="M' + (cx + cw) + ' ' + (cy + 40) + ' H640 V' + (y + 22) + ' H700" class="eline e-' + r.m + '"/>';
      html += '<' + (on ? 'button type="button" data-id="' + esc(on.id) + '"' : 'div') + ' class="enode ' + (orgKind(r.org) === 'agency' ? 'en-agency' : 'en-outside') + '" style="left:700px;top:' + y + 'px"><b>' + esc(orgName(r.org)) + '</b><span>' + esc(r.kind === 'current-role' ? (r.since ? 'Since ' + fmtDate(r.since) : 'Current') : when(r)) + '</span></' + (on ? 'button' : 'div') + '>';
    });
    html += '<div class="enode en-sel" style="left:' + cx + 'px;top:' + cy + 'px;width:' + cw + 'px;min-height:80px"><b style="font:700 19px/1.15 var(--serif)">' + esc(p.name) + '</b><span>' + esc(p.now) + '</span></div>';
    host.innerHTML = '<h2>' + esc(p.name) + ', one person at a time</h2><p class="label" style="margin:-6px 0 12px">People with a sourced tie are on the left' + (TT.length > 14 ? ' (the first 14 of ' + TT.length + ')' : '') + ', and employers and offices are on the right, newest first. A dashed line means reporting.</p><div class="ego-scroll"><div class="ego-stage" style="height:' + H + 'px">' + s + '</svg>' + html + '</div></div>';
    bind(host);
  }
  // Opening someone (from the map, the list, the search or another file) shows their file and lights their own
  // network while it is open. It never changes the filters; a network is added as a filter from the file.
  function card() {
    var n = nodeById[sel]; if (!n) return;
    var box = $('pcard'), top = box.scrollTop, b = $('pcard-body');
    b.innerHTML = n.t === 'p' ? personCard(n.p) : orgCard(n); bind(b);
    b.querySelectorAll('button[data-net]').forEach(function (x) { x.addEventListener('click', function () { togglePick(x.getAttribute('data-net')); }); });
    var more = $('pc-tlmore'); if (more) more.addEventListener('click', function () { $('pc-tl').querySelectorAll('li[hidden]').forEach(function (li) { li.hidden = false; }); more.parentNode.hidden = true; });
    box.scrollTop = top;
  }
  function hash(h) { try { history.replaceState(null, '', h); } catch (x) {} }
  function select(id, go) {
    var n = id ? nodeById[id] : null, box = $('pcard');
    sel = n ? n.id : null; hov = null;
    document.body.classList.toggle('pm-open', !!n);
    if (!n) { box.hidden = true; $('ego').hidden = true; $('pintro').hidden = false; hash(location.pathname + location.search); paint(); index(); return; }
    $('pintro').hidden = true; box.hidden = false;
    card(); box.scrollTop = 0;
    if (n.t === 'p') { ego(n.p); hash('#' + n.id); } else { $('ego').hidden = true; }
    if (go) { center(n); $('pres').hidden = true; if (window.innerWidth > 900) $('pmap').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    paint(); index();
  }

  fetch(window.PEOPLE_DATA).then(function (r) { return r.json(); }).then(function (d) {
    P = d.people.slice().sort(function (a, b) { return a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0]); });
    ties = d.ties; F = d.filters || F; TLR = d.tl || []; P.forEach(function (p) { byId[p.id] = p; p.tl = p.tl || []; });
    F.flag = {}; P.forEach(function (p) { p.groups.forEach(function (g) { (F.flag[g] = F.flag[g] || {})[p.id] = { t: '' }; }); });
    ((d.tiers || {}).M || []).forEach(function (m) { if (byId[m.id]) { TIER[m.id] = 'M'; MM[m.id] = m; tierIds.M[m.id] = 1; } });
    ((d.tiers || {}).P || []).forEach(function (id) { if (byId[id]) { TIER[id] = 'P'; delete tierIds.M[id]; tierIds.P[id] = 1; } });
    var seen = {}; P.forEach(function (p) { p.roles.forEach(function (r) { if (r.org && !seen[r.org] && !SKIP.test(r.org) && !EVENT.test(r.org)) { seen[r.org] = 1; vocab.push(r.org); } }); });
    buildGraph(); layout(); draw(); wire(); filtered();
    // for the build session: roles that do not name an organization
    P.forEach(function (p) { var f = file(p); f.cur.concat(f.hist).forEach(function (r) { if (!r.named) flags.push({ id: p.id, name: p.name, role: r.role }); }); });
    window.EBC_PEOPLE_FLAGS = flags;
    var h = decodeURIComponent(location.hash.slice(1)); if (nodeById[h]) select(h, true);
    if (window.innerWidth > 900) $('pindex').open = true;
  });
  var t; $('pq').addEventListener('input', function () { clearTimeout(t); t = setTimeout(results, 120); });
  $('pq').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var b = $('pres').querySelector('button[data-id]'); if (b) b.click(); } if (e.key === 'Escape') { $('pres').hidden = true; } });
  $('pclose').addEventListener('click', function () { select(null); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sel && document.activeElement !== $('pq')) select(null); });
})();
