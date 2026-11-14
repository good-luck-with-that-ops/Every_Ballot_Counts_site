// The timeline: search, filters, newest/oldest, paging. Internal ids are never shown.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
  var LABEL = {'STATEMENT':'Statement','DATA-ACCESS/SYSTEM':'Data and systems','COURT':'Court','CONTRACT':'Contract','ENFORCEMENT':'Enforcement','AGENCY-CHANGE':'Agency change','OVERSIGHT/LEAK':'Oversight','STATE-ACTION':'State action','CONGRESS':'Congress','FOREIGN/PREDICATE':'Foreign claim','EXEC-ORDER/DIRECTIVE':'Order or directive','ELECTION-OPS':'Election operations','LAW':'Law','PERSONNEL':'Personnel','DIPLOMACY':'Diplomacy'};
  var CH = {
    D: '<span class="m m-d" title="Document">D</span>',
    R: '<span class="m m-r" title="Reporting">R</span>',
    P: '<span class="m m-p" title="Presumed"><i>[</i>P<i>]</i></span>'
  };
  var rows = [], view = [], shown = 0, PAGE = 120, newest = true, mark = '';
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
    }).join(' · ');
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
    return '<tr><td class="d">' + esc(fmt(r)) + '<br><span class="label" style="font-weight:400">' + esc(LABEL[r.c] || r.c.toLowerCase()) + '</span></td>' +
      '<td>' + (r.a ? '<b>' + esc(r.a) + '.</b> ' : '') + chips(r.e) + (CH[m] && !/\((D|R|I)\)\s*$/.test(r.e) ? ' ' + CH[m] : '') +
      (r.w ? '<div class="muted" style="font-size:14.5px;margin-top:6px">' + chips(r.w) + '</div>' : '') + '</td>' +
      '<td class="src">' + (m === 'U' || !src ? '<span class="label">Source to come</span>' : linkify(src)) + '</td></tr>';
  }
  function apply() {
    var q = $('q').value.trim().toLowerCase(), c = $('fc').value, y = $('fy').value;
    var terms = q ? q.split(/\s+/) : [];
    view = rows.filter(function (r) {
      if (mark && mk(r) !== mark) return false;
      if (c && r.c !== c) return false;
      if (y && r.d.slice(0, 4) !== y) return false;
      if (terms.length) { var hay = (r.e + ' ' + r.a + ' ' + r.w + ' ' + r.sy + ' ' + r.s).toLowerCase(); for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) < 0) return false; }
      return true;
    });
    view.sort(function (a, b) { return newest ? (a.d < b.d ? 1 : a.d > b.d ? -1 : 0) : (a.d > b.d ? 1 : a.d < b.d ? -1 : 0); });
    shown = 0; $('list').innerHTML = ''; more();
    $('count').textContent = view.length.toLocaleString() + (view.length === 1 ? ' entry' : ' entries') + (view.length !== rows.length ? ' of ' + rows.length.toLocaleString() : '');
  }
  function more() {
    var html = ''; var end = Math.min(view.length, shown + PAGE);
    for (var i = shown; i < end; i++) html += row(view[i]);
    $('list').insertAdjacentHTML('beforeend', html); shown = end;
    $('more').hidden = shown >= view.length;
  }
  fetch(window.TL_DATA).then(function (r) { return r.json(); }).then(function (d) {
    rows = d.rows;
    var cats = {}, yrs = {};
    rows.forEach(function (r) { cats[r.c] = (cats[r.c] || 0) + 1; yrs[r.d.slice(0, 4)] = 1; });
    Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).forEach(function (k) { if (cats[k] > 3) $('fc').insertAdjacentHTML('beforeend', '<option value="' + esc(k) + '">' + esc(LABEL[k] || k) + ' (' + cats[k] + ')</option>'); });
    Object.keys(yrs).sort().reverse().forEach(function (k) { $('fy').insertAdjacentHTML('beforeend', '<option>' + k + '</option>'); });
    var u = new URLSearchParams(location.search); if (u.get('q')) $('q').value = u.get('q');
    apply();
  });
  var t; $('q').addEventListener('input', function () { clearTimeout(t); t = setTimeout(apply, 150); });
  $('fc').addEventListener('change', apply); $('fy').addEventListener('change', apply);
  $('more').addEventListener('click', more);
  $('ord').addEventListener('click', function () { newest = !newest; this.textContent = newest ? 'Newest first' : 'Oldest first'; apply(); });
  document.querySelectorAll('#fm button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#fm button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      mark = b.getAttribute('data-m'); apply();
    });
  });
})();
