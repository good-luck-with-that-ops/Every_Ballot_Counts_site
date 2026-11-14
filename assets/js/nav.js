// Menu panels (Case Files, The Record) and the phone menu. Works without JS: every panel item is also a page.
(function () {
  var btns = document.querySelectorAll('nav.main button[aria-controls]');
  function closeAll(except) {
    btns.forEach(function (b) {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false');
      var p = document.getElementById(b.getAttribute('aria-controls'));
      if (p) p.classList.remove('open');
    });
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') === 'true';
      closeAll(b);
      b.setAttribute('aria-expanded', open ? 'false' : 'true');
      document.getElementById(b.getAttribute('aria-controls')).classList.toggle('open', !open);
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('nav.main') && !e.target.closest('.panel')) closeAll();
  });
  var mb = document.querySelector('.menu-btn'), mn = document.getElementById('mnav');
  if (mb && mn) mb.addEventListener('click', function () {
    var open = mb.getAttribute('aria-expanded') === 'true';
    mb.setAttribute('aria-expanded', open ? 'false' : 'true');
    mb.textContent = open ? 'Menu' : 'Close';
    mn.classList.toggle('open', !open);
  });
  // The "?" beside the menu: one legend for the whole page.
  var q = document.querySelector('button.marks-q'), pop = document.getElementById('marks-pop');
  function setPop(open) { pop.hidden = !open; q.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  if (q && pop) {
    q.addEventListener('click', function (e) { e.stopPropagation(); setPop(pop.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { setPop(false); q.focus(); } });
    document.addEventListener('click', function (e) { if (!pop.hidden && !e.target.closest('#marks-pop')) setPop(false); });
  }
})();
