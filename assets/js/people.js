// People map. The whole network first (people, agencies, companies, think tanks; solid line = document,
// dashed = reporting), group filters that combine, and one person's file as the detail view.
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
  var groupsOn = [], picks = [], sel = null, hov = null;
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
    nodes.forEach(function (n) { n.deg = deg[n.id] || 0; n.r = n.t === 'p' ? 3.4 + 1.25 * Math.sqrt(n.deg) : 4 + 1.15 * Math.sqrt(n.size); });
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
  function shape(n) {
    var r = n.r, g = el('g', { 'class': 'n n-' + n.t, 'data-id': n.id, transform: 'translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')' }), s;
    if (n.t === 'p') s = el('circle', { r: r.toFixed(1) });
    else if (n.t === 'agency') s = el('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r });
    else if (n.t === 'company') s = el('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r, transform: 'rotate(45)' });
    else if (n.t === 'tank') s = el('path', { d: 'M0 ' + (-r * 1.25) + 'L' + (r * 1.15) + ' ' + (r * .8) + 'L' + (-r * 1.15) + ' ' + (r * .8) + 'Z' });
    else s = el('circle', { r: r.toFixed(1) });
    s.setAttribute('class', 'sh');
    g.appendChild(el('circle', { r: Math.max(r + 6, 11), 'class': 'hit' })); g.appendChild(s);
    var t = el('title', {}); t.textContent = n.name + (n.t === 'p' ? (n.p.now ? ', ' + n.p.now : '') : ' (' + KIND[n.t].toLowerCase() + ', ' + n.size + ' people on file)'); g.appendChild(t);
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
    nodes.slice().sort(function (a, b) { return (a.t === 'p' ? 1 : 0) - (b.t === 'p' ? 1 : 0); }).forEach(function (n) { gn.appendChild(shape(n)); });
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
  // What is lit up: each picked group and each person or organization picked in the map is one "set".
  // A group holds its people and the organizations they work at; a pick holds that node and everything tied to it.
  function sets() {
    return groupsOn.map(function (g) { return { g: g }; }).concat(picks.map(function (id) { return { id: id }; }));
  }
  function inSet(n, s) {
    if (s.g) return n.t === 'p' ? n.p.groups.indexOf(s.g) >= 0 : Object.keys(n.members).some(function (id) { return byId[id].groups.indexOf(s.g) >= 0; });
    return n.id === s.id || !!adj[s.id][n.id];
  }
  function focusId() { return hov || (sel && picks.indexOf(sel) < 0 ? sel : null); }
  // classes for filter, hover and selection
  function paint() {
    var S = sets(), focus = focusId(), f = S.length > 0;
    svg.classList.toggle('has-focus', !!focus); svg.classList.toggle('has-filter', f);
    nodes.forEach(function (n) {
      var c = 'n n-' + n.t;
      n.sets = [];
      if (f) {
        S.forEach(function (s, i) { if (inSet(n, s)) n.sets.push(i); });
        n.fin = n.sets.length > 0; n.both = S.length > 1 && n.sets.length > 1;
        c += n.fin ? ' in' : ' out'; if (n.both) c += ' both';
      } else { n.fin = true; n.both = false; }
      if (picks.indexOf(n.id) >= 0) c += ' pick';
      if (focus && (n.id === focus || adj[focus][n.id])) c += ' on';
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
    var focus = focusId(), f = groupsOn.length + picks.length > 0, placed = [], count = 0;
    var cand = nodes.filter(function (n) {
      var x = n.x * T.k + T.x, y = n.y * T.k + T.y; n.sx = x; n.sy = y;
      return x > -20 && x < CW + 20 && y > 0 && y < CHT;
    });
    function pri(n) {
      var s = n.t === 'p' ? n.deg : n.size * 1.6;
      if (n.lone) s -= 100;
      if (f && !n.fin) s -= 1000;
      if (n.both) s += 400;
      if (picks.indexOf(n.id) >= 0) s += 3000;
      if (focus) { if (n.id === focus) s += 5000; else if (adj[focus][n.id]) s += 2000; else s -= 500; }
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
      if (!moved && e.type === 'pointerup') { if (start.id) togglePick(start.id); else if (sel) select(null); }
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

  // ---------- filters ----------
  function chips() {
    var gs = {}; P.forEach(function (p) { p.groups.forEach(function (g) { gs[g] = (gs[g] || 0) + 1; }); });
    $('pf').innerHTML = Object.keys(gs).sort(function (a, b) { return gs[b] - gs[a]; }).map(function (g) {
      return '<button type="button" aria-pressed="false" data-g="' + esc(g) + '">' + esc(g) + ' <span class="c">' + gs[g] + '</span></button>';
    }).join('');
    $('pf').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = b.getAttribute('data-g'), i = groupsOn.indexOf(g);
        if (i >= 0) groupsOn.splice(i, 1); else groupsOn.push(g);
        b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true'); filtered();
      });
    });
  }
  // People and organizations picked in the map, shown as chips you can take off again.
  function pickChips() {
    var box = $('ppicks');
    if (!picks.length && !groupsOn.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = picks.map(function (id) {
      return '<button type="button" class="pk" aria-pressed="true" data-pick="' + esc(id) + '" aria-label="Take ' + esc(nodeById[id].name) + ' off the map">' + esc(nodeById[id].name) + ' <span aria-hidden="true">\u00d7</span></button>';
    }).join('') + '<button type="button" class="pk-clear" data-clear="1">Clear all</button>';
    box.querySelectorAll('button[data-pick]').forEach(function (b) { b.addEventListener('click', function () { togglePick(b.getAttribute('data-pick'), true); }); });
    box.querySelector('[data-clear]').addEventListener('click', function () {
      picks = []; groupsOn = []; $('pf').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); filtered();
    });
  }
  function togglePick(id, fromChip) {
    var i = picks.indexOf(id);
    if (i >= 0) {
      picks.splice(i, 1);
      if (sel === id) { if (picks.length && !fromChip) select(picks[picks.length - 1], false, true); else if (sel) select(null, false, true); }
      filtered();
    } else {
      picks.push(id); select(id, false, true); filtered();
    }
  }
  function filteredLater() { setTimeout(filtered, 0); }
  function names(list, max) {
    return list.slice(0, max).map(function (n) { return '<button type="button" class="linkish" data-id="' + esc(n.id) + '">' + esc(n.name) + '</button>'; }).join(', ') + (list.length > max ? ' and ' + (list.length - max) + ' more' : '');
  }
  function filtered() {
    paint(); index(); pickChips();
    var s = $('psum'), html, S = sets();
    if (!S.length) { s.innerHTML = ''; return; }
    var inAny = nodes.filter(function (n) { return n.t === 'p' && n.fin; });
    if (S.length === 1) {
      s.innerHTML = S[0].g ? '<b>' + inAny.length + ' people</b> in ' + esc(S[0].g) + '. Add a group or click someone in the map to see who connects them.'
        : '<b>' + esc(nodeById[S[0].id].name) + '</b> and the ' + (inAny.length - (nodeById[S[0].id].t === 'p' ? 1 : 0)) + ' people tied to them. Click someone else in the map, or pick a group, to see who connects them.';
      return;
    }
    var both = nodes.filter(function (n) { return n.t === 'p' && n.both; }), sharedOrgs = orgList.filter(function (n) { return n.both; }).sort(function (a, b) { return b.size - a.size; });
    var nx = edges.filter(function (e) { return /cross/.test(e.el.getAttribute('class')); }).length;
    html = '<b>' + inAny.length + ' people</b> lit up across ' + S.length + ' picks. ';
    html += both.length ? '<b>' + both.length + (both.length === 1 ? ' connects' : ' connect') + ' two or more</b> (ringed in amber): ' + names(both, 8) + '. ' : 'Nobody sits in more than one of them. ';
    html += nx ? '<b>' + nx + ' sourced ' + (nx === 1 ? 'tie runs' : 'ties run') + '</b> between them (the heavy lines). ' : '';
    html += sharedOrgs.length ? 'Organizations in more than one: ' + names(sharedOrgs, 8) + '.' : '';
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
      return '<li><button type="button" data-id="' + esc(n.id) + '"><b>' + esc(n.name) + '</b><span>' + esc(n.t === 'p' ? (n.p.now || n.p.groups.join(', ')) : KIND[n.t] + ', ' + n.size + ' people on file') + '</span></button></li>';
    }).join('') + (m.length > 8 ? '<li class="more">' + (m.length - 8) + ' more. Keep typing to narrow it down.</li>' : '') : '<li class="more">Nobody by that name is on file. Try a last name or an agency.</li>';
    bind(box, true);
  }
  function index() {
    var lit = groupsOn.length + picks.length > 0, rows = P.filter(function (p) { return !lit || nodeById[p.id].fin; });
    $('pindex-n').textContent = lit ? rows.length + ' people lit up, A to Z' : 'All ' + P.length + ' people, A to Z';
    $('plist').innerHTML = rows.map(function (p) {
      return '<li><button type="button" data-id="' + p.id + '"' + (sel === p.id ? ' aria-current="true"' : '') + '><b>' + esc(p.name) + '</b><span>' + esc(p.now || p.groups.join(', ')) + '</span></button></li>';
    }).join('');
    bind($('plist'), true);
  }
  function bind(root, go) {
    root.querySelectorAll('button[data-id]').forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-id'), true); }); });
  }

  // ---------- the card ----------
  function personCard(p) {
    var f = file(p), T = tiesOf(p.id), h = '';
    h += '<p class="pc-groups">' + esc(p.groups.join(', ')) + '</p><h2 id="pcard-h" tabindex="-1">' + esc(p.name) + '</h2>';
    if (f.cur.length) {
      h += '<h3>Now</h3><ol class="pm-rows">' + f.cur.map(function (r) {
        return '<li><span class="d">' + (r.since ? 'Since ' + esc(fmtDate(r.since)) : 'Current') + '</span><span>' + roleLine(r) + ' ' + (CH[r.m] || '') + '<span class="sr">' + srcs(r.s) + '</span></span></li>';
      }).join('') + '</ol>';
    }
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
    h += '<p style="margin:18px 0 0"><a class="quiet" href="' + window.PEOPLE_TL + encodeURIComponent(p.name) + '">Search the timeline for ' + esc(p.name) + '</a></p>';
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
  // Opening someone from the list, the search or a card starts a fresh pick with just them;
  // clicks in the map add to the picks instead (togglePick passes keep).
  function select(id, go, keep) {
    var n = id ? nodeById[id] : null, card = $('pcard');
    sel = n ? n.id : null; hov = null;
    if (n && !keep) { picks = [n.id]; pickChips(); filteredLater(); }
    document.body.classList.toggle('pm-open', !!n);
    if (!n) { card.hidden = true; $('ego').hidden = true; $('pintro').hidden = false; history.replaceState(null, '', location.pathname + location.search); paint(); index(); return; }
    $('pintro').hidden = true; card.hidden = false;
    $('pcard-body').innerHTML = n.t === 'p' ? personCard(n.p) : orgCard(n);
    bind($('pcard-body')); card.scrollTop = 0;
    if (n.t === 'p') { ego(n.p); history.replaceState(null, '', '#' + n.id); } else { $('ego').hidden = true; }
    if (go) { center(n); $('pres').hidden = true; if (window.innerWidth > 900) $('pmap').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    paint(); index();
  }

  fetch(window.PEOPLE_DATA).then(function (r) { return r.json(); }).then(function (d) {
    P = d.people.slice().sort(function (a, b) { return a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0]); });
    ties = d.ties; P.forEach(function (p) { byId[p.id] = p; });
    var seen = {}; P.forEach(function (p) { p.roles.forEach(function (r) { if (r.org && !seen[r.org] && !SKIP.test(r.org) && !EVENT.test(r.org)) { seen[r.org] = 1; vocab.push(r.org); } }); });
    buildGraph(); layout(); draw(); wire(); chips(); filtered();
    $('pcount').textContent = P.length + ' people, ' + orgList.length + ' organizations that two or more of them share, and ' + edges.filter(function (e) { return e.k === 'tie'; }).length + ' sourced person-to-person ties.';
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
