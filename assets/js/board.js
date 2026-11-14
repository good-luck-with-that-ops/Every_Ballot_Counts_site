// Tripwire board: route filters and the History panels. Without JS every row shows and History stays closed.
(function () {
  var rows = document.querySelectorAll('.brow');
  document.querySelectorAll('.filters button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.filters button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var r = b.getAttribute('data-route');
      rows.forEach(function (row) {
        row.hidden = !!r && (' ' + row.getAttribute('data-routes') + ' ').indexOf(' ' + r + ' ') < 0;
      });
    });
  });
  document.querySelectorAll('.brow .ch button').forEach(function (b) {
    b.addEventListener('click', function () {
      var row = b.closest('.brow'), open = row.classList.toggle('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.textContent = open ? 'Close' : 'History';
    });
  });
  if (location.hash && /^#row-\d+$/.test(location.hash)) {
    var row = document.querySelector(location.hash);
    if (row) { row.classList.add('open'); var b = row.querySelector('.ch button'); if (b) { b.setAttribute('aria-expanded', 'true'); b.textContent = 'Close'; } }
  }
})();
