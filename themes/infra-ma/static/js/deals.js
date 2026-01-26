(function () {
  'use strict';
  var sectorEl  = document.getElementById('filter-sector');
  var geoEl     = document.getElementById('filter-geography');
  var yearEl    = document.getElementById('filter-year');
  var statusEl  = document.getElementById('filter-status');
  var searchEl  = document.getElementById('filter-search');
  var resetBtn  = document.getElementById('filter-reset');
  var pillsEl   = document.getElementById('filter-pills');
  var rows      = Array.from(document.querySelectorAll('.deal-row'));
  var countEl   = document.getElementById('deals-visible-count');
  var totalEl   = document.getElementById('deals-total-count');
  var emptyEl   = document.getElementById('deals-empty');
  var table     = document.getElementById('deals-table');
  var tbody     = table ? table.querySelector('tbody') : null;
  var headers   = table ? Array.from(table.querySelectorAll('th.sortable')) : [];

  if (totalEl) totalEl.textContent = rows.length;

  // Read URL params
  function readParams() {
    var p = new URLSearchParams(window.location.search);
    if (sectorEl && p.get('sector'))  sectorEl.value = p.get('sector');
    if (geoEl && p.get('geography'))  geoEl.value = p.get('geography');
    if (yearEl && p.get('year'))      yearEl.value = p.get('year');
    if (statusEl && p.get('status'))  statusEl.value = p.get('status');
    if (searchEl && p.get('q'))       searchEl.value = p.get('q');
  }

  // Write URL params
  function writeParams() {
    var p = new URLSearchParams();
    if (sectorEl && sectorEl.value) p.set('sector', sectorEl.value);
    if (geoEl && geoEl.value)       p.set('geography', geoEl.value);
    if (yearEl && yearEl.value)     p.set('year', yearEl.value);
    if (statusEl && statusEl.value) p.set('status', statusEl.value);
    if (searchEl && searchEl.value) p.set('q', searchEl.value);
    var qs = p.toString();
    var url = window.location.pathname + (qs ? '?' + qs : '');
    history.replaceState(null, '', url);
  }

  // Build filter pills
  function buildPills() {
    if (!pillsEl) return;
    pillsEl.innerHTML = '';
    var filters = [
      { el: sectorEl, label: 'Sector' },
      { el: geoEl, label: 'Geography' },
      { el: yearEl, label: 'Year' },
      { el: statusEl, label: 'Status' }
    ];
    filters.forEach(function (f) {
      if (f.el && f.el.value) {
        var pill = document.createElement('span');
        pill.className = 'filter-pill';
        pill.innerHTML = f.label + ': ' + f.el.value + ' <button aria-label="Remove ' + f.label + ' filter">&times;</button>';
        pill.querySelector('button').addEventListener('click', function () {
          f.el.value = '';
          applyFilters();
        });
        pillsEl.appendChild(pill);
      }
    });
    if (searchEl && searchEl.value) {
      var pill = document.createElement('span');
      pill.className = 'filter-pill';
      pill.innerHTML = 'Search: ' + searchEl.value + ' <button aria-label="Clear search">&times;</button>';
      pill.querySelector('button').addEventListener('click', function () {
        searchEl.value = '';
        applyFilters();
      });
      pillsEl.appendChild(pill);
    }
  }

  function applyFilters() {
    var sector = sectorEl ? sectorEl.value.toLowerCase() : '';
    var geo    = geoEl ? geoEl.value : '';
    var year   = yearEl ? yearEl.value : '';
    var status = statusEl ? statusEl.value.toLowerCase() : '';
    var query  = searchEl ? searchEl.value.toLowerCase().trim() : '';
    var visible = 0;

    rows.forEach(function (row) {
      var ms = !sector || row.getAttribute('data-sector') === sector;
      var mg = !geo    || row.getAttribute('data-geography') === geo;
      var my = !year   || row.getAttribute('data-year') === year;
      var mt = !status || row.getAttribute('data-status') === status;
      var mq = true;
      if (query) {
        var searchable = (
          row.getAttribute('data-title') + ' ' +
          row.getAttribute('data-buyer') + ' ' +
          row.getAttribute('data-seller') + ' ' +
          row.getAttribute('data-sector') + ' ' +
          row.getAttribute('data-geography')
        ).toLowerCase();
        mq = searchable.indexOf(query) !== -1;
      }
      var show = ms && mg && my && mt && mq;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (countEl) countEl.textContent = visible;
    if (emptyEl) emptyEl.style.display = visible === 0 ? '' : 'none';
    writeParams();
    buildPills();
  }

  // Debounced search
  var searchTimer;
  function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 200);
  }

  // Sorting
  var currentSort = 'date';
  var sortAsc = false;

  function sortTable(key) {
    if (currentSort === key) {
      sortAsc = !sortAsc;
    } else {
      currentSort = key;
      sortAsc = true;
    }

    headers.forEach(function (h) {
      h.classList.remove('sorted', 'sorted--asc', 'sorted--desc');
    });
    var activeHeader = table.querySelector('th[data-sort="' + key + '"]');
    if (activeHeader) {
      activeHeader.classList.add('sorted', sortAsc ? 'sorted--asc' : 'sorted--desc');
    }

    rows.sort(function (a, b) {
      var va = (a.getAttribute('data-' + key) || '').toLowerCase();
      var vb = (b.getAttribute('data-' + key) || '').toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    rows.forEach(function (row) {
      tbody.appendChild(row);
    });
  }

  // Event listeners
  if (sectorEl) sectorEl.addEventListener('change', applyFilters);
  if (geoEl) geoEl.addEventListener('change', applyFilters);
  if (yearEl) yearEl.addEventListener('change', applyFilters);
  if (statusEl) statusEl.addEventListener('change', applyFilters);
  if (searchEl) searchEl.addEventListener('input', onSearch);
  if (resetBtn) resetBtn.addEventListener('click', function () {
    if (sectorEl) sectorEl.value = '';
    if (geoEl) geoEl.value = '';
    if (yearEl) yearEl.value = '';
    if (statusEl) statusEl.value = '';
    if (searchEl) searchEl.value = '';
    applyFilters();
  });

  headers.forEach(function (th) {
    th.addEventListener('click', function () {
      sortTable(th.getAttribute('data-sort'));
    });
  });

  readParams();
  applyFilters();
})();
