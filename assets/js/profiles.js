// EBC & [POI] Profiles: everything below the written part of a profile comes straight from the people map's public data
// (assets/data/people.json), so a profile keeps updating after its post goes stale. MOCKUP, Nov 17, 2026.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  var MK = { D: '<span class="m m-d" title="Document">D</span>', R: '<span class="m m-r" title="Reporting">R</span>', P: '<span class="m m-p" title="Presumed"><i>[</i>P<i>]</i></span>', I: '<span class="m m-p" title="Presumed: our inference"><i>[</i>P<i>]</i></span>' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  function fd(s) { if (!s) return ''; var p = s.split('-'); if (p.length === 1) return p[0]; if (p.length === 2) return MON[+p[1] - 1] + ' ' + p[0]; return MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }
  function pl(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function org(o) { return (o || '').replace(/^Gov:\s*/, ''); }
  function src(list) { return (list || []).map(function (s) { return s.u ? '<a href="' + esc(s.u) + '" rel="noopener">' + esc(s.t) + '</a>' : esc(s.t); }).join('; '); }
  var PROFILES = { eueland: { url: '/profiles/eric-ueland/', since: '2026-11-17' } }; // written profiles; everyone else gets a record page
  var root = document.querySelector('[data-profiles]');
  if (!root) return;
  fetch('/assets/data/people.json').then(function (r) { return r.json(); }).then(function (D) {
    var byId = {}; D.people.forEach(function (p) { byId[p.id] = p; });
    var P = (D.tiers && D.tiers.P) || [];
    var built = D.built ? fd(String(D.built).slice(0, 10)) : '';
    if (root.getAttribute('data-profiles') === 'index') {
      var rows = P.map(function (id) { return byId[id]; }).filter(Boolean).map(function (p) {
        var ties = D.ties.filter(function (t) { return t.a === p.id || t.b === p.id; }).length, w = PROFILES[p.id];
        return { p: p, ties: ties, tl: (p.tl || []).length, w: w };
      }).sort(function (a, b) { return (b.w ? 1 : 0) - (a.w ? 1 : 0) || b.tl - a.tl; });
      $('prof-list').innerHTML = rows.map(function (r) {
        var href = r.w ? r.w.url : '/profiles/p/#' + r.p.id;
        return '<a class="pf-row" href="' + href + '"><span class="pf-nm">' + esc(r.p.name) + ' <span class="m m-p"><i>[</i>POI<i>]</i></span></span>' +
          '<span class="pf-now">' + esc(r.p.now) + '</span>' +
          '<span class="pf-ct label">' + r.tl + ' timeline rows · ' + r.ties + ' ties · ' + (r.p.roles || []).length + ' roles</span>' +
          '<span class="pf-st ' + (r.w ? 'w' : '') + '">' + (r.w ? 'Profile' : 'Record page') + '</span></a>';
      }).join('');
      $('prof-built').textContent = built ? 'From the people map, built ' + built + '.' : '';
      return;
    }
    var id = root.getAttribute('data-id') || decodeURIComponent(location.hash.slice(1)), p = byId[id];
    if (!p) { $('prof-roles').innerHTML = '<p class="label">Nobody with that id is on the map.</p>'; return; }
    if ($('prof-name')) $('prof-name').textContent = p.name;
    if ($('prof-now')) $('prof-now').textContent = p.now;
    if ($('prof-groups')) $('prof-groups').textContent = (p.groups || []).join(' · ');
    if ($('prof-tier')) $('prof-tier').innerHTML = P.indexOf(id) >= 0 ? '<span class="m m-p"><i>[</i>POI<i>]</i></span> A Person of Interest: someone Amanda has chosen to watch. It doesn’t say anyone broke a law.' : '';
    if ($('prof-map')) $('prof-map').href = '/record/people/#' + id;
    var roles = (p.roles || []).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    $('prof-roles').innerHTML = '<ol class="pf-roles">' + roles.map(function (r) {
      return '<li><span class="pf-d mono">' + esc(fd(r.date)) + (r.end ? '–' + esc(fd(r.end)) : (r.kind === 'current-role' ? '–now' : '')) + '</span>' +
        '<span><b>' + esc(org(r.org)) + '</b> ' + (MK[r.m] || '') + '<br>' + esc(r.role) + '<span class="pf-s">' + src(r.s) + '</span></span></li>';
    }).join('') + '</ol>';
    var ties = D.ties.filter(function (t) { return t.a === id || t.b === id; }).sort(function (a, b) { return (b.date || '0000').localeCompare(a.date || '0000'); }); // newest on top, undated last
    $('prof-ties').innerHTML = ties.length ? '<ul class="pf-ties">' + ties.map(function (t) {
      var o = byId[t.a === id ? t.b : t.a] || { name: t.a === id ? t.b : t.a, id: '' };
      return '<li><a href="/record/people/#' + esc(o.id) + '"><b>' + esc(o.name) + '</b></a> <span class="label">' + esc(t.type) + (t.date ? ' · ' + esc(fd(t.date)) : '') + '</span> ' + (MK[t.m] || '') +
        '<br>' + esc(t.ev) + '<span class="pf-s">' + src(t.s) + '</span></li>';
    }).join('') + '</ul>' : '<p class="label">No sourced ties on the map yet.</p>';
    var tl = (p.tl || []).map(function (i) { return D.tl[i]; }).filter(Boolean).sort(function (a, b) { return (b.d || '').localeCompare(a.d || ''); });
    $('prof-tl').innerHTML = tl.length ? '<ol class="pf-tl">' + tl.map(function (r) {
      return '<li><span class="pf-d mono">' + esc(fd(r.d)) + '</span><span>' + (MK[r.m] || '') + ' ' + esc(r.e) + (r.u ? ' <a class="quiet" href="' + esc(r.u) + '" rel="noopener">Source</a>' : '') + '</span></li>';
    }).join('') + '</ol>' : '<p class="label">Not on the timeline yet.</p>';
    if ($('prof-built')) $('prof-built').textContent = built ? 'These sections come straight from the people map and the timeline. Last built ' + built + '. They update whenever the record does.' : '';
    if (root.getAttribute('data-generic') && $('prof-crumb')) $('prof-crumb').textContent = p.name;
  });
})();
