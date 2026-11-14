// People map: a list, a one-person diagram (ties left, employers right), and the person's file card.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var CH = { D: '<span class="m m-d">D</span>', R: '<span class="m m-r">R</span>' };
  var GOV = /(Department|DOJ|DHS|USCIS|ICE|CBP|FBI|CISA|OMB|OPM|GSA|SSA|Treasury|IRS|White House|Executive Office|Office of|Bureau|Agency|Administration|Senate|House|Congress|Court|U\.S\.|United States|State Department|Pentagon|Army|Navy|Air Force|Census|NASA|USDA|HHS|HUD|VA\b|Commission|Federal|DOGE|National)/;
  var P, byId = {}, ties = [], group = '', sel = null;
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function yr(r) { return (r.date || '').slice(0, 4) + (r.end ? '–' + r.end.slice(0, 4) : ''); }
  function src(s) { return (s || []).map(function (x) { return '<a href="' + esc(x.u) + '" rel="noopener">' + esc(x.t || x.u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)) + '</a>'; }).join(' · '); }
  function tiesOf(id) { return ties.filter(function (t) { return t.a === id || t.b === id; }); }
  function list() {
    var q = $('pq').value.trim().toLowerCase();
    var rows = P.filter(function (p) {
      if (group && p.groups.indexOf(group) < 0) return false;
      if (!q) return true;
      if ((p.name + ' ' + p.now).toLowerCase().indexOf(q) >= 0) return true;
      return p.roles.some(function (r) { return r.org.toLowerCase().indexOf(q) >= 0; });
    });
    $('plist').innerHTML = rows.slice(0, 400).map(function (p) {
      return '<li><button type="button" data-id="' + p.id + '"' + (sel === p.id ? ' aria-current="true"' : '') + '><b>' + esc(p.name) + '</b><span>' + esc(p.now) + '</span></button></li>';
    }).join('') || '<li class="muted" style="padding:12px">No match.</li>';
    $('plist').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-id'), true); }); });
  }
  function ego(p) {
    var T = tiesOf(p.id).slice(0, 14);
    var orgs = [], seen = {};
    p.roles.forEach(function (r) { var o = r.org; if (o && !seen[o] && orgs.length < 10) { seen[o] = 1; orgs.push(r); } });
    var rowH = 58, n = Math.max(T.length, orgs.length, 1), H = Math.max(n * rowH + 40, 220), W = 900;
    var cx = 330, cw = 240, cy = H / 2 - 40;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" class="ego-lines" aria-hidden="true">';
    var html = '';
    T.forEach(function (t, i) {
      var o = byId[t.a === p.id ? t.b : t.a]; if (!o) return;
      var y = 20 + i * rowH + (n - T.length) * rowH / 2;
      svg += '<path d="M200 ' + (y + 22) + ' H260 V' + (cy + 40) + ' H' + cx + '" class="eline e-' + t.m + '"/>';
      html += '<button type="button" class="enode en-person" style="left:0;top:' + y + 'px" data-id="' + o.id + '"><b>' + esc(o.name) + '</b><span>' + esc(t.type) + ' ' + '</span></button>';
    });
    orgs.forEach(function (r, i) {
      var y = 20 + i * rowH + (n - orgs.length) * rowH / 2, gov = GOV.test(r.org);
      svg += '<path d="M' + (cx + cw) + ' ' + (cy + 40) + ' H640 V' + (y + 22) + ' H700" class="eline e-' + r.m + '"/>';
      html += '<div class="enode ' + (gov ? 'en-agency' : 'en-outside') + '" style="left:700px;top:' + y + 'px"><b>' + esc(r.org) + '</b><span>' + esc(yr(r)) + '</span></div>';
    });
    svg += '</svg>';
    html += '<div class="enode en-person en-sel" style="left:' + cx + 'px;top:' + cy + 'px;width:' + cw + 'px;height:80px"><b style="font:24px/1.1 var(--serif)">' + esc(p.name) + '</b><span>' + esc(p.now) + '</span></div>';
    $('ego').innerHTML = '<div class="ego-stage" style="height:' + H + 'px">' + svg + html + '</div>' +
      '<p class="label" style="padding:8px 0 0">Left: people with a sourced tie' + (tiesOf(p.id).length > 14 ? ' (first 14 of ' + tiesOf(p.id).length + ')' : '') + '. Right: employers and offices, newest first.</p>';
    $('ego').querySelectorAll('button[data-id]').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-id'), true); }); });
  }
  function card(p) {
    var T = tiesOf(p.id);
    $('pcard').innerHTML = '<p class="label">' + esc(p.groups.join(' · ')) + '</p><h2>' + esc(p.name) + '</h2><p class="dek" style="font-size:21px">' + esc(p.now) + '</p>' +
      '<h3>Jobs and roles</h3><ol class="pm-rows">' + p.roles.map(function (r) {
        return '<li><span class="d">' + esc(yr(r)) + '</span><span><b>' + esc(r.org) + '</b>' + (r.role ? ': ' + esc(r.role) : '') + ' ' + CH[r.m] + '<span class="sr">' + src(r.s) + '</span></span></li>';
      }).join('') + '</ol>' +
      (T.length ? '<h3>Ties</h3><ol class="pm-rows">' + T.map(function (t) {
        var o = byId[t.a === p.id ? t.b : t.a];
        return '<li><span class="d">' + esc((t.date || '').slice(0, 7)) + '</span><span><button type="button" class="linkish" data-id="' + o.id + '" style="text-decoration:underline;text-decoration-color:var(--amber);text-decoration-thickness:2px">' + esc(o.name) + '</button> · ' + esc(t.type) + '. ' + esc(t.ev) + ' ' + CH[t.m] + '<span class="sr">' + src(t.s) + '</span></span></li>';
      }).join('') + '</ol>' : '') +
      '<p><a class="quiet" href="' + window.PEOPLE_TL + encodeURIComponent(p.name) + '">Search the timeline for ' + esc(p.name) + '</a></p>';
    $('pcard').querySelectorAll('button[data-id]').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-id'), true); }); });
  }
  function show(id, push) {
    var p = byId[id]; if (!p) return; sel = id;
    ego(p); card(p); list();
    if (push) { history.replaceState(null, '', '#' + id); $('ego').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  fetch(window.PEOPLE_DATA).then(function (r) { return r.json(); }).then(function (d) {
    P = d.people.sort(function (a, b) { return a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0]); });
    ties = d.ties; P.forEach(function (p) { byId[p.id] = p; });
    var gs = {}; P.forEach(function (p) { p.groups.forEach(function (g) { gs[g] = (gs[g] || 0) + 1; }); });
    $('pf').innerHTML = '<button type="button" aria-pressed="true" data-g="">Everyone <span class="c">' + P.length + '</span></button>' +
      Object.keys(gs).sort(function (a, b) { return gs[b] - gs[a]; }).map(function (g) { return '<button type="button" aria-pressed="false" data-g="' + esc(g) + '">' + esc(g) + ' <span class="c">' + gs[g] + '</span></button>'; }).join('');
    $('pf').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () {
      $('pf').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      group = b.getAttribute('data-g'); list(); }); });
    list();
    var h = location.hash.slice(1); show(byId[h] ? h : (byId.vought ? 'vought' : P[0].id), false);
  });
  var t; $('pq').addEventListener('input', function () { clearTimeout(t); t = setTimeout(list, 120); });
})();
