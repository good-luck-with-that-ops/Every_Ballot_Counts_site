// The timeline: search, filters, the weekly density bar (which is also the date filter), newest/oldest, paging.
// Internal ids are never shown.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
  var LABEL = {'STATEMENT':'Statement','DATA-ACCESS/SYSTEM':'Data and systems','COURT':'Court','CONTRACT':'Contract','ENFORCEMENT':'Enforcement','AGENCY-CHANGE':'Agency change','OVERSIGHT/LEAK':'Oversight','STATE-ACTION':'State action','CONGRESS':'Congress','FOREIGN/PREDICATE':'Foreign claim','EXEC-ORDER/DIRECTIVE':'Order or directive','ELECTION-OPS':'Election operations','LAW':'Law','PERSONNEL':'Personnel','DIPLOMACY':'Diplomacy'};
  var CH = {
    D: '<span class="m m-d" title="Document">D</span>',
    R: '<span class="m m-r" title="Reporting">R</span>',
    P: '<span class="m m-p" title="Presumed"><i>[</i>P<i>]</i></span>'
  };
  var rows = [], view = [], shown = 0, PAGE = 120, newest = true, mark = '', futOpen = false;
  var TODAY = new Date().toISOString().slice(0, 10);
  // Density bar: one bar per week from Jan 20, 2025 (a Monday), plus one block for everything earlier.
  var W0 = Date.UTC(2025, 0, 20), WK = 7 * 86400000, NW = 0, all = [], hit = [], pre = 0, preHit = 0, sel = null, drag = null;
  function utc(d) { return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)); }
  function wk(d) { return Math.floor((utc(d) - W0) / WK); }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function nice(t) { var d = new Date(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); }
  function inSel(r) {
    if (!sel) return true;
    var w = r.d > TODAY ? NW : wk(r.d);
    return w >= sel[0] && w <= sel[1];
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function chips(s) {
    return esc(s)
      .replace(/\(I\)/g, CH.P).replace(/\(D\)/g, CH.D).replace(/\(R\)/g, CH.R)
      .replace(/\(I;/g, '(' + CH.P + ';').replace(/\(U\)/g, '');
  }
  function linkify(s) {
    return esc(s).replace(/(https?:\/\/[^\s<·;)\]|]+)/g, function (u) {
      var t = u.replace(/^https?:\/\/(www\.)?/, ''); if (t.length > 44) t = t.slice(0, 42) + '…';
      return '<a href="' + u + '" rel="noopener">' + t + '</a>';
    });
  }
  function cleanSrc(s) {
    // keep public citations; drop local file notes
    return (s || '').split(/\s\|\|\s|;\s(?=file )/).filter(function (p) {
      return !/inbox\/|\.pdf \(enclosure\)|Letters in hand|pdfinfo|_private|Vault|\bfile [A-Za-z0-9_-]+\.pdf/i.test(p);
    }).join('; ');
  }
  function fmt(r) {
    var p = (r.d || '').split('-'); if (p.length < 2) return r.d;
    var s = r.p === 'year' ? p[0] : (r.p === 'month' || !p[2]) ? MON[+p[1] - 1] + ' ' + p[0] : MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
    if (r.de && r.de !== r.d) { var q = r.de.split('-'); if (q.length === 3) s += ' – ' + MON[+q[1] - 1] + ' ' + (+q[2]) + (q[0] !== p[0] ? ', ' + q[0] : ''); }
    return s;
  }
  function mk(r) { return r.m === 'I' ? 'P' : r.m; }
  function row(r) {
    var m = mk(r), src = cleanSrc(r.s);
    return '<tr><td class="d">' + esc(fmt(r)) + '<br><span class="label" style="font-weight:400">' + esc(LABEL[r.c] || (r.c.charAt(0) + r.c.slice(1).toLowerCase())) + '</span></td>' +
      '<td>' + (r.a ? '<b>' + esc(r.a) + '.</b> ' : '') + chips(r.e) + (CH[m] && !/\((D|R|I)\)\s*$/.test(r.e) ? ' ' + CH[m] : '') +
      (r.w ? '<div class="muted" style="font-size:14.5px;margin-top:6px">' + chips(r.w) + '</div>' : '') + '</td>' +
      '<td class="src">' + (m === 'U' || !src ? '<span class="label">Still waiting on a source</span>' : linkify(src)) + '</td></tr>';
  }
  function apply() {
    var q = $('q').value.trim().toLowerCase(), c = $('fc').value, y = $('fy').value;
    var terms = q ? q.split(/\s+/) : [];
    view = rows.filter(function (r) {
      if (mark && mk(r) !== mark) return false;
      if (c && r.c !== c) return false;
      if (y && r.d.slice(0, 4) !== y) return false;
      r._ok = true;
      if (terms.length) { var hay = (r.e + ' ' + r.a + ' ' + r.w + ' ' + r.sy + ' ' + r.s).toLowerCase(); for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) < 0) return false; }
      return true;
    });
    // Count what matches before the date range is applied, so the bar shows where the matches are.
    var filtered = !!(mark || c || y || terms.length), i;
    for (i = 0; i < NW; i++) hit[i] = 0; preHit = 0;
    view.forEach(function (r) { if (r.d > TODAY) return; var w = wk(r.d); if (w < 0) preHit++; else hit[w]++; });
    view = view.filter(inSel);
    drawDens(filtered);
    view.sort(function (a, b) { return newest ? (a.d < b.d ? 1 : a.d > b.d ? -1 : 0) : (a.d > b.d ? 1 : a.d < b.d ? -1 : 0); });
    // Scheduled and future dates sit in a collapsed group at the top (newest first only).
    var fut = (newest && !y && !sel) ? view.filter(function (r) { return r.d > TODAY; }) : [];
    if (fut.length) {
      view = view.filter(function (r) { return r.d <= TODAY; });
      $('fut').innerHTML = '<tr class="fut-head"><td colspan="3"><button type="button" class="btn btn-2" id="futbtn" aria-expanded="' + futOpen + '">' +
        (futOpen ? 'Hide' : 'Show') + ' ' + fut.length + ' scheduled and future ' + (fut.length === 1 ? 'date' : 'dates') + '</button> <span class="label" style="margin-left:8px">Deadlines and effective dates, ' + fut[fut.length - 1].d.slice(0, 4) + ' to ' + fut[0].d.slice(0, 4) + '.</span></td></tr>' +
        (futOpen ? fut.slice().reverse().map(row).join('') : '');
      $('futbtn').addEventListener('click', function () { futOpen = !futOpen; apply(); });
    } else { $('fut').innerHTML = ''; }
    shown = 0; $('list').innerHTML = ''; more();
    var n = view.length + fut.length; $('count').textContent = n ? n.toLocaleString() + (n === 1 ? ' entry' : ' entries') + (n !== rows.length ? ' of ' + rows.length.toLocaleString() : '') : 'Nothing matches that. Try fewer words, or clear a filter.';
  }
  function selText() {
    if (!sel) return '';
    var a = sel[0] < 0 ? 'the earliest entry' : nice(W0 + sel[0] * WK), b = sel[1] < 0 ? 'Jan 19, 2025' : nice(Math.min(W0 + sel[1] * WK + 6 * 86400000, utc(TODAY)));
    return a + ' to ' + b;
  }
  function drawDens(filtered) {
    var host = $('dens-plot'); if (!host || !NW) return;
    $('dens').hidden = false;
    var Wd = host.clientWidth || 600, H = 88, TOP = 22, AX = 22, PRE = Wd < 520 ? 34 : 54, GAP = 10;
    var bw = (Wd - PRE - GAP) / NW, max = Math.max.apply(null, all), NS = 'http://www.w3.org/2000/svg';
    function el(n, a, txt) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (txt) e.textContent = txt; return e; }
    function x(w) { return w < 0 ? 0 : PRE + GAP + w * bw; }
    var svg = el('svg', { width: Wd, height: H + AX, viewBox: '0 0 ' + Wd + ' ' + (H + AX), 'aria-hidden': 'true' });
    if (sel) {
      var x0 = x(sel[0]), x1 = sel[1] < 0 ? PRE : x(sel[1]) + bw;
      svg.appendChild(el('rect', { x: x0, y: 0, width: Math.max(2, x1 - x0), height: H, 'class': 'dn-sel' }));
    }
    // the block for everything before the weekly bars start
    svg.appendChild(el('rect', { x: 0, y: H - 30, width: PRE, height: 30, 'class': filtered ? 'dn-all' : 'dn-hit' }));
    if (filtered && preHit) svg.appendChild(el('rect', { x: 0, y: H - Math.max(2, 30 * preHit / pre), width: PRE, height: Math.max(2, 30 * preHit / pre), 'class': 'dn-hit' }));
    svg.appendChild(el('text', { x: 0, y: H + 15, 'class': 'dn-t' }, Wd < 520 ? 'Earlier' : 'Before 2025'));
    for (var w = 0; w < NW; w++) {
      var h = all[w] ? Math.max(1.5, (H - TOP) * all[w] / max) : 0, g = Math.max(.5, bw * .18);
      if (h) svg.appendChild(el('rect', { x: x(w) + g / 2, y: H - h, width: bw - g, height: h, 'class': filtered ? 'dn-all' : 'dn-hit' }));
      if (filtered && hit[w]) { var hh = Math.max(1.5, (H - TOP) * hit[w] / max); svg.appendChild(el('rect', { x: x(w) + g / 2, y: H - hh, width: bw - g, height: hh, 'class': 'dn-hit' })); }
      var d = new Date(W0 + w * WK), m = d.getUTCMonth();
      if (d.getUTCDate() <= 7 && (m % (Wd < 520 ? 6 : 3) === 0) && x(w) > PRE + 30 && x(w) < Wd - 40) {
        svg.appendChild(el('rect', { x: x(w), y: H, width: 1, height: 5, 'class': 'dn-tick' }));
        svg.appendChild(el('text', { x: x(w) + 3, y: H + 15, 'class': 'dn-t' }, MON[m] + (m === 0 || Wd >= 700 || Wd < 520 ? ' ' + d.getUTCFullYear() : '')));
      }
    }
    // Election Day, Nov 3, 2026
    var ew = wk('2026-11-03');
    if (ew < NW) { var ex = x(ew) + bw * (1 / 7) + bw / 14; svg.appendChild(el('rect', { x: ex, y: 14, width: 1.5, height: H - 14, 'class': 'dn-elec' })); svg.appendChild(el('text', { x: ex + 2, y: 10, 'class': 'dn-t dn-et', 'text-anchor': 'end' }, 'Election Day')); }
    svg.appendChild(el('rect', { x: 0, y: H, width: Wd, height: 1, 'class': 'dn-base' }));
    svg.appendChild(el('text', { x: PRE + GAP + 2, y: 10, 'class': 'dn-t' }, 'Busiest week: ' + max + ' entries'));
    host.innerHTML = ''; host.appendChild(svg);
    host._geo = { PRE: PRE, GAP: GAP, bw: bw };
    $('dens-clear').hidden = !sel;
    $('dens-cap').textContent = sel ? 'Showing ' + selText() + '.' : (filtered ? 'Dark bars are the entries that match; light bars are everything.' : 'Entries per week since Jan 20, 2025.');
  }
  function weekAt(clientX) {
    var host = $('dens-plot'), g = host._geo, px = clientX - host.getBoundingClientRect().left;
    if (px <= g.PRE + g.GAP / 2) return -1;
    return Math.max(0, Math.min(NW - 1, Math.floor((px - g.PRE - g.GAP) / g.bw)));
  }
  function setSel(a, b) { sel = a === null ? null : [Math.min(a, b), Math.max(a, b)]; if (sel) $('fy').value = ''; apply(); }
  function more() {
    var html = ''; var end = Math.min(view.length, shown + PAGE);
    for (var i = shown; i < end; i++) html += row(view[i]);
    $('list').insertAdjacentHTML('beforeend', html); shown = end;
    $('more').hidden = shown >= view.length;
  }
  fetch(window.TL_DATA).then(function (r) { return r.json(); }).then(function (d) {
    rows = d.rows;
    NW = wk(TODAY) + 1;
    for (var i = 0; i < NW; i++) { all.push(0); hit.push(0); }
    rows.forEach(function (r) { if (r.d > TODAY) return; var w = wk(r.d); if (w < 0) pre++; else all[w]++; });
    var cats = {}, yrs = {};
    rows.forEach(function (r) { cats[r.c] = (cats[r.c] || 0) + 1; yrs[r.d.slice(0, 4)] = 1; });
    Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).forEach(function (k) { if (cats[k] > 3) $('fc').insertAdjacentHTML('beforeend', '<option value="' + esc(k) + '">' + esc(LABEL[k] || k) + ' (' + cats[k] + ')</option>'); });
    Object.keys(yrs).sort().reverse().forEach(function (k) { $('fy').insertAdjacentHTML('beforeend', '<option>' + k + '</option>'); });
    var u = new URLSearchParams(location.search); if (u.get('q')) $('q').value = u.get('q');
    apply();
  });
  var t; $('q').addEventListener('input', function () { clearTimeout(t); t = setTimeout(apply, 150); });
  $('fc').addEventListener('change', apply); $('fy').addEventListener('change', function () { sel = null; apply(); });
  var plot = $('dens-plot');
  if (plot) {
    plot.addEventListener('pointerdown', function (e) { drag = weekAt(e.clientX); plot.setPointerCapture(e.pointerId); sel = [drag, drag]; drawDens(true); e.preventDefault(); });
    plot.addEventListener('pointermove', function (e) { if (drag === null) return; var w = weekAt(e.clientX); sel = [Math.min(drag, w), Math.max(drag, w)]; drawDens(true); });
    plot.addEventListener('pointerup', function (e) { if (drag === null) return; var w = weekAt(e.clientX), a = drag; drag = null; setSel(a, w); });
    plot.addEventListener('pointercancel', function () { drag = null; });
    plot.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setSel(null); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var step = e.key === 'ArrowLeft' ? -1 : 1;
      if (!sel) { setSel(NW - 1, NW - 1); return; }
      if (e.shiftKey) { if (step < 0) setSel(Math.max(-1, sel[0] - 1), sel[1]); else setSel(sel[0], Math.min(NW - 1, sel[1] + 1)); }
      else { var w = Math.max(-1, Math.min(NW - 1, (step < 0 ? sel[0] : sel[1]) + step)); setSel(w, w); }
    });
    $('dens-clear').addEventListener('click', function () { setSel(null); });
    var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(apply, 150); });
  }
  $('more').addEventListener('click', more);
  $('ord').addEventListener('click', function () { newest = !newest; this.textContent = newest ? 'Newest first' : 'Oldest first'; apply(); });
  document.querySelectorAll('#fm button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#fm button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      mark = b.getAttribute('data-m'); apply();
    });
  });
})();
