// Tripwire board: the route filter, the History panels and the 14-day entry strips.
// Without JS every row shows, History stays closed and the strips are simply absent.
(function () {
  var rows = document.querySelectorAll('.brow'), total = rows.length;
  var rts = document.querySelectorAll('.rt'), state = document.getElementById('rt-state');
  function apply(id, name) {
    var shown = 0;
    rows.forEach(function (row) {
      var hide = !!id && (' ' + row.getAttribute('data-routes') + ' ').indexOf(' ' + id + ' ') < 0;
      row.hidden = hide; if (!hide) shown++;
    });
    rts.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-route') === id ? 'true' : 'false'); });
    if (!state) return;
    state.textContent = '';
    if (!id) { state.textContent = 'Showing all ' + total + ' rows.'; return; }
    state.appendChild(document.createTextNode('Showing ' + shown + ' of ' + total + ' (' + name.charAt(0).toLowerCase() + name.slice(1) + '). '));
    var all = document.createElement('button'); all.type = 'button'; all.textContent = 'Show all'; all.className = 'linkish';
    all.addEventListener('click', function () { apply('', ''); });
    state.appendChild(all);
  }
  rts.forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') === 'true';
      apply(on ? '' : b.getAttribute('data-route'), b.getAttribute('data-name'));
    });
  });

  function openRow(row, open) {
    var b = row.querySelector('.ch button'); row.classList.toggle('open', open);
    if (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); b.textContent = open ? 'Close' : b.getAttribute('data-label'); }
  }
  document.querySelectorAll('.brow .ch button').forEach(function (b) {
    b.setAttribute('data-label', b.textContent);
    b.addEventListener('click', function () { var row = b.closest('.brow'); openRow(row, !row.classList.contains('open')); });
  });
  if (location.hash && /^#row-\d+$/.test(location.hash)) {
    var row = document.querySelector(location.hash); if (row) openRow(row, true);
  }

  // 14-day strips. History dates are written "Nov 14" or "Nov 9-10" (a range counts on its last day).
  var board = document.getElementById('board'); if (!board) return;
  var end = new Date(board.getAttribute('data-checked') + 'T12:00:00'); if (isNaN(end)) return;
  var DAYS = 14, MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  var NAMES = Object.keys(MON), day = 86400000, NS = 'http://www.w3.org/2000/svg';
  function lbl(d) { return NAMES[d.getMonth()] + ' ' + d.getDate(); }
  function parse(t) {
    var m = /^([A-Z][a-z]{2}) (\d{1,2})(?:-(\d{1,2}))?$/.exec(t.trim()); if (!m || !(m[1] in MON)) return null;
    return new Date(end.getFullYear(), MON[m[1]], +(m[3] || m[2]), 12);
  }
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  var start = new Date(end.getTime() - (DAYS - 1) * day);
  var head = document.getElementById('spark-h');
  if (head) head.textContent = 'Entries by day, ' + lbl(start) + ' to ' + lbl(end);
  rows.forEach(function (row) {
    var host = row.querySelector('.spark'); if (!host) return;
    var got = [], seen = [], n = 0, i;
    for (i = 0; i < DAYS; i++) { got.push(0); seen.push(0); }
    row.querySelectorAll('.hist li').forEach(function (li) {
      var d = parse(li.getAttribute('data-d') || ''); if (!d) return;
      var ix = Math.round((d - start) / day); if (ix < 0 || ix >= DAYS) return;
      if (li.hasAttribute('data-c')) seen[ix]++; else { got[ix]++; n++; }
    });
    var W = 8, G = 2, H = 24, svg = el('svg', { width: DAYS * (W + G) - G, height: H + 2, viewBox: '0 0 ' + (DAYS * (W + G) - G) + ' ' + (H + 2), role: 'img' });
    svg.setAttribute('aria-label', n + (n === 1 ? ' entry' : ' entries') + ' in the last ' + DAYS + ' days');
    svg.appendChild(el('rect', { x: 0, y: H, width: DAYS * (W + G) - G, height: 1, 'class': 'sp-base' }));
    for (i = 0; i < DAYS; i++) {
      var x = i * (W + G), d = new Date(start.getTime() + i * day), g = el('g', {}), t = el('title', {});
      if (got[i]) {
        var h = Math.min(got[i], 4) * 6;
        g.appendChild(el('rect', { x: x, y: H - h, width: W, height: h, 'class': 'sp-bar' }));
        t.textContent = lbl(d) + ': ' + got[i] + (got[i] === 1 ? ' entry' : ' entries');
      } else if (seen[i]) {
        g.appendChild(el('circle', { cx: x + W / 2, cy: H - 5, r: 2.5, 'class': 'sp-dot' }));
        t.textContent = lbl(d) + ': checked, nothing seen';
      } else { t.textContent = lbl(d) + ': no entry'; g.appendChild(el('rect', { x: x, y: 0, width: W, height: H, fill: 'transparent' })); }
      g.appendChild(t); svg.appendChild(g);
    }
    host.appendChild(svg);
  });
})();
