// Architecture map: draws the sourced flows, pan/zoom, select a node or a flow, and the flow docket table.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var view = $('view'), stage = $('stage'), card = $('card');
  var CH = { D: '<span class="m m-d">D</span>', R: '<span class="m m-r">R</span>', P: '<span class="m m-p"><i>[</i>P<i>]</i></span>', I: '<span class="m m-p"><i>[</i>P<i>]</i></span>' };
  var NS = 'http://www.w3.org/2000/svg';
  var data, nodeEl = {}, edgeEls = {}, k = 1, tx = 0, ty = 0, sel = null;
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function chip(m) { return CH[m] || '<span class="label">still waiting on a source</span>'; }
  function apply() { stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')'; }
  function fit() {
    var vw = view.clientWidth, vh = view.clientHeight;
    k = Math.min(vw / data.w, vh / data.h); tx = (vw - data.w * k) / 2; ty = 8; apply();
  }
  function zoom(f, cx, cy) {
    cx = cx == null ? view.clientWidth / 2 : cx; cy = cy == null ? view.clientHeight / 2 : cy;
    var nk = Math.max(0.12, Math.min(2.5, k * f));
    tx = cx - (cx - tx) * nk / k; ty = cy - (cy - ty) * nk / k; k = nk; apply();
  }
  function centerOn(x, y) { tx = view.clientWidth / 2 - x * k; ty = view.clientHeight / 2 - y * k; apply(); }
  function midpoint(d) {
    var pts = d.match(/-?\d+(\.\d+)?/g).map(Number), segs = [], tot = 0;
    for (var i = 2; i < pts.length; i += 2) { var L = Math.abs(pts[i] - pts[i - 2]) + Math.abs(pts[i + 1] - pts[i - 1]); segs.push([pts[i - 2], pts[i - 1], pts[i], pts[i + 1], L]); tot += L; }
    var half = tot / 2;
    for (var j = 0; j < segs.length; j++) { var s = segs[j]; if (half <= s[4]) { var t = s[4] ? half / s[4] : 0; return [s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t]; } half -= s[4]; }
    return [pts[0], pts[1]];
  }
  function draw() {
    stage.style.width = data.w + 'px'; stage.style.height = data.h + 'px';
    data.groups.forEach(function (g) {
      var el = document.createElement('div'); el.className = 'mgroup';
      el.style.cssText = 'left:' + g.x + 'px;top:' + g.y + 'px;width:' + g.w + 'px;height:' + g.h + 'px';
      el.innerHTML = '<span>' + esc(g.title) + '</span>'; stage.appendChild(el);
    });
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', data.w); svg.setAttribute('height', data.h); svg.setAttribute('class', 'medges'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>';
    stage.appendChild(svg);
    data.edges.forEach(function (e) {
      var m = e.mark === 'I' ? 'P' : e.mark, els = [];
      e.d.forEach(function (d, i) {
        var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d);
        p.setAttribute('class', 'mline ml-' + (m || 'U')); if (i === e.d.length - 1) p.setAttribute('marker-end', 'url(#ah)');
        svg.appendChild(p); els.push(p);
      });
      var mp = midpoint(e.d[0]);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mno'; b.textContent = e.no;
      b.style.left = (mp[0] - 13) + 'px'; b.style.top = (mp[1] - 11) + 'px';
      b.setAttribute('aria-label', 'Flow ' + e.no + ': ' + e.title);
      b.addEventListener('click', function (ev) { ev.stopPropagation(); selectEdge(e); });
      stage.appendChild(b); els.push(b);
      edgeEls[e.no] = els;
    });
    data.nodes.forEach(function (n) {
      var el = document.createElement('button'); el.type = 'button';
      el.className = 'mnode mn-' + n.kind; el.id = 'n-' + n.id;
      el.style.cssText = 'left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.w + 'px;height:' + n.h + 'px';
      el.innerHTML = '<span class="o">' + esc(n.org) + '</span><b>' + esc(n.name) + '</b><span class="s">' + esc(n.desc) + (n.rid ? ', ' + esc(n.rid) : '') + '</span>';
      el.addEventListener('click', function (ev) { ev.stopPropagation(); selectNode(n); });
      stage.appendChild(el); nodeEl[n.id] = el;
      $('mq-list').insertAdjacentHTML('beforeend', '<option value="' + esc(n.name) + '">');
    });
  }
  function nodeById(id) { for (var i = 0; i < data.nodes.length; i++) if (data.nodes[i].id === id) return data.nodes[i]; return { name: id, org: '' }; }
  function clear() {
    stage.classList.remove('has-sel'); sel = null;
    stage.querySelectorAll('.on').forEach(function (x) { x.classList.remove('on'); });
    document.querySelectorAll('#flows tr.on').forEach(function (x) { x.classList.remove('on'); });
    card.hidden = true; $('zclear').hidden = true;
  }
  function light(e) { (edgeEls[e.no] || []).forEach(function (x) { x.classList.add('on'); }); var r = document.getElementById('flow-' + e.no); if (r) r.classList.add('on'); }
  function flowLine(e, me) {
    var other = e.a === me ? nodeById(e.b) : nodeById(e.a), dir = e.a === me ? '→ ' : '← ';
    return '<li><button type="button" class="linkish" data-no="' + e.no + '"><span class="no">' + e.no + '</span></button> ' + dir + '<b>' + esc(other.name) + '</b>: ' + esc(e.what) + ' ' + chip(e.mark) + (e.src ? '<span class="sr">' + esc(e.src) + '</span>' : '') + '</li>';
  }
  function bindCard() {
    card.querySelectorAll('button[data-no]').forEach(function (b) { b.addEventListener('click', function () { var no = +b.getAttribute('data-no'); data.edges.forEach(function (e) { if (e.no === no) selectEdge(e); }); }); });
    var c = card.querySelector('.close'); if (c) c.addEventListener('click', clear);
  }
  function selectNode(n) {
    clear(); sel = n; stage.classList.add('has-sel'); nodeEl[n.id].classList.add('on'); $('zclear').hidden = false;
    var mine = data.edges.filter(function (e) { return e.a === n.id || e.b === n.id; });
    mine.forEach(function (e) { light(e); var o = e.a === n.id ? e.b : e.a; if (nodeEl[o]) nodeEl[o].classList.add('on2'); });
    card.innerHTML = '<button type="button" class="close btn btn-2" style="float:right;min-height:36px;padding:0 10px">Close</button>' +
      '<p class="label">' + esc(n.org) + '</p><h3>' + esc(n.name) + '</h3><p>' + esc(n.desc) + '</p>' +
      (n.rid ? '<p><a class="quiet" href="' + esc(n.rhref) + '">Registry entry ' + esc(n.rid) + '</a></p>' : '') +
      (n.kind === 'presumed' ? '<div class="presume" style="padding:12px 14px"><p>' + CH.P + ' Drawn from the pattern. No source states this box exists as shown.</p></div>' : '') +
      '<p class="label" style="margin-top:16px">' + mine.length + ' flows</p><ul class="flowlist">' + mine.map(function (e) { return flowLine(e, n.id); }).join('') + '</ul>' +
      '<p><a class="quiet" href="' + window.ARCH_TL + encodeURIComponent(n.name) + '">Search the timeline</a></p>';
    card.hidden = false; bindCard();
  }
  function selectEdge(e) {
    clear(); stage.classList.add('has-sel'); light(e); $('zclear').hidden = false;
    [e.a, e.b].forEach(function (id) { if (nodeEl[id]) nodeEl[id].classList.add('on'); });
    var A = nodeById(e.a), B = nodeById(e.b);
    card.innerHTML = '<button type="button" class="close btn btn-2" style="float:right;min-height:36px;padding:0 10px">Close</button>' +
      '<p class="label">Flow ' + e.no + '</p><h3>' + esc(A.name) + ' → ' + esc(B.name) + '</h3><p>' + esc(e.what) + ' ' + chip(e.mark) + '</p>' +
      (e.status ? '<p class="label">Status: ' + esc(e.status) + '</p>' : '') + (e.src ? '<p class="mono" style="font-size:13px">' + esc(e.src) + '</p>' : '');
    card.hidden = false; bindCard();
    var mp = midpoint(e.d[0]); if (window.innerWidth > 900) centerOn(mp[0], mp[1]);
  }
  function table() {
    var tb = document.querySelector('#flows tbody'), html = '';
    data.edges.forEach(function (e) {
      var A = nodeById(e.a), B = nodeById(e.b);
      html += '<tr id="flow-' + e.no + '"><td class="d"><button type="button" class="linkish" data-no="' + e.no + '">' + e.no + '</button></td><td><b>' + esc(A.name) + '</b> → <b>' + esc(B.name) + '</b></td><td>' + esc(e.what) + ' ' + chip(e.mark) + '</td><td class="src">' + esc(e.src) + '</td></tr>';
    });
    tb.innerHTML = html;
    tb.querySelectorAll('button[data-no]').forEach(function (b) { b.addEventListener('click', function () { var no = +b.getAttribute('data-no'); data.edges.forEach(function (e) { if (e.no === no) { selectEdge(e); view.scrollIntoView({ behavior: 'smooth' }); } }); }); });
  }
  // pan / zoom
  var drag = null, pts = {};
  view.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; pts[e.pointerId] = [e.clientX, e.clientY]; drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, moved: false }; view.setPointerCapture(e.pointerId); });
  view.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (pts[e.pointerId]) pts[e.pointerId] = [e.clientX, e.clientY];
    var ids = Object.keys(pts);
    if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (drag.dist) { var r = view.getBoundingClientRect(); zoom(dist / drag.dist, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
      drag.dist = dist; return;
    }
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    tx = drag.tx + dx; ty = drag.ty + dy; apply();
  });
  function up(e) { delete pts[e.pointerId]; if (!Object.keys(pts).length) { if (drag && !drag.moved && !e.target.closest('button')) clear(); drag = null; } }
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', function (e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); var r = view.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  $('zin').onclick = function () { zoom(1.25); }; $('zout').onclick = function () { zoom(0.8); }; $('zfit').onclick = fit; $('zclear').onclick = clear;
  $('mq').addEventListener('change', function () {
    var q = this.value.trim().toLowerCase(); if (!q) return;
    var n = data.nodes.filter(function (n) { return (n.name + ' ' + n.org + ' ' + n.rid).toLowerCase().indexOf(q) >= 0; })[0];
    if (n) { selectNode(n); k = Math.max(k, 0.6); centerOn(n.x + n.w / 2, n.y + n.h / 2); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') clear(); });
  fetch(window.ARCH_DATA).then(function (r) { return r.json(); }).then(function (d) {
    data = d; draw(); table(); fit(); window.addEventListener('resize', fit);
    var h = location.hash.match(/^#(n-[A-Z0-9_]+|flow-\d+)$/);
    if (h) { if (h[1][0] === 'n') { var n = nodeById(h[1].slice(2)); if (n.x != null) selectNode(n); } else data.edges.forEach(function (e) { if ('flow-' + e.no === h[1]) selectEdge(e); }); }
  });
})();
