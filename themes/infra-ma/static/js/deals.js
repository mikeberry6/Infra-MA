(function () {
  'use strict';

  /* ================================================================
     Infrastructure M&A Tracker — Deals Page JavaScript
     Features: Multi-select filters, date range, value range,
     sortable columns, pagination, CSV export, charts, shareable URLs
     ================================================================ */

  // ── DOM References ──────────────────────────────────────────────
  var searchEl    = document.getElementById('filter-search');
  var resetBtn    = document.getElementById('filter-reset');
  var pillsEl     = document.getElementById('filter-pills');
  var countEl     = document.getElementById('deals-visible-count');
  var totalEl     = document.getElementById('deals-total-count');
  var emptyEl     = document.getElementById('deals-empty');
  var table       = document.getElementById('deals-table');
  var tbody       = table ? table.querySelector('tbody') : null;
  var headers     = table ? Array.from(table.querySelectorAll('th.sortable')) : [];
  var dateFrom    = document.getElementById('filter-date-from');
  var dateTo      = document.getElementById('filter-date-to');
  var valueMin    = document.getElementById('filter-value-min');
  var valueMax    = document.getElementById('filter-value-max');
  var exportBtn   = document.getElementById('export-csv');
  var exportAll   = document.getElementById('export-csv-all');
  var pageSizeEl  = document.getElementById('page-size');
  var pageJumpEl  = document.getElementById('page-jump');
  var paginationNav     = document.getElementById('pagination-nav');
  var paginationBottom  = document.getElementById('pagination-controls-bottom');

  // ── Mobile DOM References ───────────────────────────────────────
  var mobileFilterToggle  = document.getElementById('mobile-filter-toggle');
  var filterDrawerClose   = document.getElementById('filter-drawer-close');
  var filterDrawerOverlay = document.getElementById('filter-drawer-overlay');
  var filterDrawerApply   = document.getElementById('filter-drawer-apply');
  var filterBar           = document.getElementById('filter-bar');
  var mobileVisibleCount  = document.getElementById('mobile-visible-count');
  var mobileTotalCount    = document.getElementById('mobile-total-count');
  var filterChipsScroll   = document.getElementById('filter-chips-scroll');
  var filterChipsInner    = document.getElementById('filter-chips-inner');
  var loadMoreWrap        = document.getElementById('load-more-wrap');
  var loadMoreBtn         = document.getElementById('load-more-btn');
  var loadMoreCount       = document.getElementById('load-more-count');

  // ── Mobile Load More State ──────────────────────────────────────
  var mobileLoadedCount = 10;

  // All deal rows (excluding summary rows)
  var allRows = table ? Array.from(table.querySelectorAll('tr.deal-row')) : [];
  // Summary rows (hidden by default, toggled on click)
  var summaryRows = table ? Array.from(table.querySelectorAll('tr.deal-summary-row')) : [];

  // Filtered rows (subset of allRows that pass all filters)
  var filteredRows = allRows.slice();

  if (totalEl) totalEl.textContent = allRows.length;

  // ── Mobile Filter Drawer Toggle ─────────────────────────────────
  function openFilterDrawer() {
    if (filterBar) filterBar.classList.add('filter-bar--drawer-open');
    if (filterDrawerOverlay) filterDrawerOverlay.style.display = '';
    document.body.classList.toggle('drawer-open', true);
  }

  function closeFilterDrawer() {
    if (filterBar) filterBar.classList.remove('filter-bar--drawer-open');
    if (filterDrawerOverlay) filterDrawerOverlay.style.display = 'none';
    document.body.classList.toggle('drawer-open', false);
  }

  if (mobileFilterToggle) {
    mobileFilterToggle.addEventListener('click', openFilterDrawer);
  }
  if (filterDrawerClose) {
    filterDrawerClose.addEventListener('click', closeFilterDrawer);
  }
  if (filterDrawerOverlay) {
    filterDrawerOverlay.addEventListener('click', closeFilterDrawer);
  }
  if (filterDrawerApply) {
    filterDrawerApply.addEventListener('click', closeFilterDrawer);
  }

  // ── Multi-Select Filter Panels ──────────────────────────────────
  var multiGroups = ['sector', 'geography', 'year', 'status'];
  var panels = {};
  var buttons = {};

  multiGroups.forEach(function (group) {
    var btnId = group === 'geography' ? 'filter-geo-btn' : 'filter-' + group + '-btn';
    var panelId = group === 'geography' ? 'filter-geo-panel' : 'filter-' + group + '-panel';
    buttons[group] = document.getElementById(btnId);
    panels[group] = document.getElementById(panelId);
  });

  // Toggle panels
  function togglePanel(group) {
    var panel = panels[group];
    var btn = buttons[group];
    if (!panel || !btn) return;
    var isOpen = panel.classList.toggle('filter-multi-panel--open');
    btn.setAttribute('aria-expanded', isOpen);
    // Close other panels
    multiGroups.forEach(function (g) {
      if (g !== group && panels[g]) {
        panels[g].classList.remove('filter-multi-panel--open');
        if (buttons[g]) buttons[g].setAttribute('aria-expanded', 'false');
      }
    });
  }

  multiGroups.forEach(function (group) {
    if (buttons[group]) {
      buttons[group].addEventListener('click', function (e) {
        e.stopPropagation();
        togglePanel(group);
      });
    }
  });

  // Close panels on outside click
  document.addEventListener('click', function (e) {
    multiGroups.forEach(function (group) {
      if (panels[group] && !panels[group].contains(e.target) && buttons[group] !== e.target) {
        panels[group].classList.remove('filter-multi-panel--open');
        if (buttons[group]) buttons[group].setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Prevent panel clicks from closing
  multiGroups.forEach(function (group) {
    if (panels[group]) {
      panels[group].addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }
  });

  // Select All / Clear buttons
  document.querySelectorAll('.filter-select-all').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      var checkboxes = document.querySelectorAll('input[data-filter="' + group + '"]');
      checkboxes.forEach(function (cb) { cb.checked = true; });
      applyFilters();
    });
  });
  document.querySelectorAll('.filter-clear-group').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-group');
      var checkboxes = document.querySelectorAll('input[data-filter="' + group + '"]');
      checkboxes.forEach(function (cb) { cb.checked = false; });
      applyFilters();
    });
  });

  // Checkbox change events
  document.querySelectorAll('.filter-check input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', applyFilters);
  });

  // ── Value Preset Buttons ────────────────────────────────────────
  document.querySelectorAll('.filter-value-preset').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var isActive = btn.classList.contains('active');
      document.querySelectorAll('.filter-value-preset').forEach(function (b) {
        b.classList.remove('active');
      });
      if (isActive) {
        if (valueMin) valueMin.value = '';
        if (valueMax) valueMax.value = '';
      } else {
        btn.classList.add('active');
        if (valueMin) valueMin.value = btn.getAttribute('data-min');
        if (valueMax) valueMax.value = btn.getAttribute('data-max');
      }
      applyFilters();
    });
  });

  // ── Get Selected Values for a Multi-Select Group ────────────────
  function getSelected(group) {
    var checkboxes = document.querySelectorAll('input[data-filter="' + group + '"]:checked');
    return Array.from(checkboxes).map(function (cb) { return cb.value; });
  }

  // ── Update Multi-Select Button Text ─────────────────────────────
  function updateMultiButtonText(group) {
    var selected = getSelected(group);
    var btn = buttons[group];
    if (!btn) return;
    var textEl = btn.querySelector('.filter-multi-btn__text');
    if (!textEl) return;
    var labels = { sector: 'Sectors', geography: 'Geographies', year: 'Years', status: 'Statuses' };
    if (selected.length === 0) {
      textEl.textContent = 'All ' + labels[group];
    } else if (selected.length === 1) {
      textEl.textContent = selected[0];
    } else {
      textEl.textContent = labels[group] + ' (' + selected.length + ')';
    }
  }

  // ── Check if Any Filter is Active ───────────────────────────────
  function hasActiveFilters() {
    for (var i = 0; i < multiGroups.length; i++) {
      if (getSelected(multiGroups[i]).length > 0) return true;
    }
    if (searchEl && searchEl.value.trim() !== '') return true;
    if (dateFrom && dateFrom.value) return true;
    if (dateTo && dateTo.value) return true;
    if (valueMin && valueMin.value) return true;
    if (valueMax && valueMax.value) return true;
    return false;
  }

  // ── URL Parameters (#10) ────────────────────────────────────────
  function readParams() {
    var p = new URLSearchParams(window.location.search);

    // Multi-select params (comma-separated)
    multiGroups.forEach(function (group) {
      var val = p.get(group);
      if (val) {
        var values = val.split(',');
        values.forEach(function (v) {
          var cb = document.querySelector('input[data-filter="' + group + '"][value="' + v + '"]');
          if (cb) cb.checked = true;
        });
      }
    });

    if (searchEl && p.get('q')) searchEl.value = p.get('q');
    if (dateFrom && p.get('from')) dateFrom.value = p.get('from');
    if (dateTo && p.get('to')) dateTo.value = p.get('to');
    if (valueMin && p.get('vmin')) valueMin.value = p.get('vmin');
    if (valueMax && p.get('vmax')) valueMax.value = p.get('vmax');

    // Sort params
    if (p.get('sort')) {
      currentSort = p.get('sort');
      sortAsc = p.get('order') === 'asc';
    }

    // Pagination
    if (p.get('page')) currentPage = parseInt(p.get('page'), 10) || 1;
    if (p.get('size') && pageSizeEl) pageSizeEl.value = p.get('size');
  }

  function writeParams() {
    var p = new URLSearchParams();

    multiGroups.forEach(function (group) {
      var selected = getSelected(group);
      if (selected.length > 0) p.set(group, selected.join(','));
    });

    if (searchEl && searchEl.value) p.set('q', searchEl.value);
    if (dateFrom && dateFrom.value) p.set('from', dateFrom.value);
    if (dateTo && dateTo.value) p.set('to', dateTo.value);
    if (valueMin && valueMin.value) p.set('vmin', valueMin.value);
    if (valueMax && valueMax.value) p.set('vmax', valueMax.value);
    if (currentSort !== 'date' || sortAsc) {
      p.set('sort', currentSort);
      p.set('order', sortAsc ? 'asc' : 'desc');
    }
    if (currentPage > 1) p.set('page', currentPage);
    if (pageSizeEl && pageSizeEl.value !== '25') p.set('size', pageSizeEl.value);

    var qs = p.toString();
    var url = window.location.pathname + (qs ? '?' + qs : '');
    history.replaceState(null, '', url);
  }

  // ── Filter Pills ────────────────────────────────────────────────
  function buildPills() {
    if (!pillsEl) return;
    pillsEl.innerHTML = '';

    multiGroups.forEach(function (group) {
      var selected = getSelected(group);
      var labels = { sector: 'Sector', geography: 'Geography', year: 'Year', status: 'Status' };
      selected.forEach(function (val) {
        var pill = document.createElement('span');
        pill.className = 'filter-pill';
        pill.innerHTML = labels[group] + ': ' + val + ' <button aria-label="Remove ' + labels[group] + ' ' + val + ' filter">&times;</button>';
        pill.querySelector('button').addEventListener('click', function () {
          var cb = document.querySelector('input[data-filter="' + group + '"][value="' + val + '"]');
          if (cb) cb.checked = false;
          applyFilters();
        });
        pillsEl.appendChild(pill);
      });
    });

    if (dateFrom && dateFrom.value) {
      addPill('From: ' + dateFrom.value, function () { dateFrom.value = ''; applyFilters(); });
    }
    if (dateTo && dateTo.value) {
      addPill('To: ' + dateTo.value, function () { dateTo.value = ''; applyFilters(); });
    }
    if (valueMin && valueMin.value) {
      addPill('Min: $' + valueMin.value + 'B', function () { valueMin.value = ''; applyFilters(); });
    }
    if (valueMax && valueMax.value) {
      addPill('Max: $' + valueMax.value + 'B', function () { valueMax.value = ''; applyFilters(); });
    }
    if (searchEl && searchEl.value) {
      addPill('Search: ' + searchEl.value, function () { searchEl.value = ''; applyFilters(); });
    }
  }

  function addPill(text, onRemove) {
    var pill = document.createElement('span');
    pill.className = 'filter-pill';
    pill.innerHTML = text + ' <button aria-label="Remove filter">&times;</button>';
    pill.querySelector('button').addEventListener('click', onRemove);
    pillsEl.appendChild(pill);
  }

  // ── Mobile Filter Chips (scrollable) ────────────────────────────
  function buildMobileChips() {
    if (!filterChipsInner || !filterChipsScroll) return;
    filterChipsInner.innerHTML = '';

    var hasChips = false;

    multiGroups.forEach(function (group) {
      var selected = getSelected(group);
      var labels = { sector: 'Sector', geography: 'Geography', year: 'Year', status: 'Status' };
      selected.forEach(function (val) {
        hasChips = true;
        var chip = document.createElement('span');
        chip.className = 'filter-chip';
        chip.innerHTML = labels[group] + ': ' + val + ' <button aria-label="Remove ' + labels[group] + ' ' + val + ' filter">&times;</button>';
        chip.querySelector('button').addEventListener('click', function () {
          var cb = document.querySelector('input[data-filter="' + group + '"][value="' + val + '"]');
          if (cb) cb.checked = false;
          applyFilters();
        });
        filterChipsInner.appendChild(chip);
      });
    });

    if (dateFrom && dateFrom.value) {
      hasChips = true;
      addMobileChip('From: ' + dateFrom.value, function () { dateFrom.value = ''; applyFilters(); });
    }
    if (dateTo && dateTo.value) {
      hasChips = true;
      addMobileChip('To: ' + dateTo.value, function () { dateTo.value = ''; applyFilters(); });
    }
    if (valueMin && valueMin.value) {
      hasChips = true;
      addMobileChip('Min: $' + valueMin.value + 'B', function () { valueMin.value = ''; applyFilters(); });
    }
    if (valueMax && valueMax.value) {
      hasChips = true;
      addMobileChip('Max: $' + valueMax.value + 'B', function () { valueMax.value = ''; applyFilters(); });
    }
    if (searchEl && searchEl.value) {
      hasChips = true;
      addMobileChip('Search: ' + searchEl.value, function () { searchEl.value = ''; applyFilters(); });
    }

    filterChipsScroll.style.display = hasChips ? '' : 'none';
  }

  function addMobileChip(text, onRemove) {
    if (!filterChipsInner) return;
    var chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = text + ' <button aria-label="Remove filter">&times;</button>';
    chip.querySelector('button').addEventListener('click', onRemove);
    filterChipsInner.appendChild(chip);
  }

  // ── Core Filter Logic ───────────────────────────────────────────
  function applyFilters() {
    var sectors = getSelected('sector');
    var geos = getSelected('geography');
    var years = getSelected('year');
    var statuses = getSelected('status');
    var query = searchEl ? searchEl.value.toLowerCase().trim() : '';
    var dFrom = dateFrom && dateFrom.value ? dateFrom.value : '';
    var dTo = dateTo && dateTo.value ? dateTo.value : '';
    var vMin = valueMin && valueMin.value ? parseFloat(valueMin.value) : null;
    var vMax = valueMax && valueMax.value ? parseFloat(valueMax.value) : null;

    filteredRows = [];

    allRows.forEach(function (row, idx) {
      var rSector = row.getAttribute('data-sector');
      var rGeo = row.getAttribute('data-geography');
      var rYear = row.getAttribute('data-year');
      var rStatus = row.getAttribute('data-status');
      var rDate = row.getAttribute('data-date');
      var rValueUsd = parseFloat(row.getAttribute('data-value-usd')) || 0;

      var ms = sectors.length === 0 || sectors.indexOf(rSector) !== -1;
      var mg = geos.length === 0 || geos.indexOf(rGeo) !== -1;
      var my = years.length === 0 || years.indexOf(rYear) !== -1;
      var mt = statuses.length === 0 || statuses.indexOf(rStatus) !== -1;

      // Date range
      var md = true;
      if (dFrom && rDate < dFrom) md = false;
      if (dTo && rDate > dTo) md = false;

      // Value range
      var mv = true;
      if (vMin !== null && rValueUsd < vMin) mv = false;
      if (vMax !== null && vMax < 999 && rValueUsd > vMax) mv = false;

      // Search
      var mq = true;
      if (query) {
        var searchable = (
          row.getAttribute('data-title') + ' ' +
          row.getAttribute('data-buyer') + ' ' +
          row.getAttribute('data-seller') + ' ' +
          row.getAttribute('data-sector') + ' ' +
          row.getAttribute('data-geography') + ' ' +
          (row.getAttribute('data-summary') || '')
        ).toLowerCase();
        mq = searchable.indexOf(query) !== -1;
      }

      var show = ms && mg && my && mt && md && mv && mq;
      if (show) filteredRows.push(row);
    });

    // Update button text
    multiGroups.forEach(updateMultiButtonText);

    // Update stats dashboard with filtered data
    updateStatsDashboard();

    // Sort filtered rows
    sortFilteredRows();

    // Reset to page 1 when filters change
    currentPage = 1;

    // Reset mobile loaded count when filters change
    mobileLoadedCount = 10;

    // Apply pagination
    applyPagination();

    if (countEl) countEl.textContent = filteredRows.length;

    // Update mobile sticky bar counts
    if (mobileVisibleCount && countEl) mobileVisibleCount.textContent = countEl.textContent;
    if (mobileTotalCount) mobileTotalCount.textContent = allRows.length;

    // Empty message: only show when filteredRows is empty AND filters are active
    if (emptyEl) {
      emptyEl.style.display = (filteredRows.length === 0 && hasActiveFilters()) ? '' : 'none';
    }

    writeParams();
    buildPills();
    buildMobileChips();

    // Update charts
    updateCharts();
  }

  // ── Summary Row Toggle ──────────────────────────────────────────
  allRows.forEach(function (row) {
    var summary = row.getAttribute('data-summary');
    if (summary) {
      row.style.cursor = 'pointer';
      row.setAttribute('title', 'Click to expand summary');
      row.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') return; // Don't toggle on link clicks
        var next = row.nextElementSibling;
        if (next && next.classList.contains('deal-summary-row')) {
          var isHidden = next.getAttribute('aria-hidden') === 'true';
          next.setAttribute('aria-hidden', !isHidden);
          next.style.display = isHidden ? '' : 'none';
          row.classList.toggle('deal-row--expanded', isHidden);
        }
      });
    }
  });

  // Hide all summary rows initially
  summaryRows.forEach(function (row) {
    row.style.display = 'none';
  });

  // ── Statistics Dashboard Update ─────────────────────────────────
  function updateStatsDashboard() {
    var totalDealsEl = document.getElementById('stat-total-deals');
    var totalValueEl = document.getElementById('stat-total-value');
    var avgSizeEl = document.getElementById('stat-avg-size');

    var totalVal = 0;
    var announced = 0, closed = 0, terminated = 0;

    filteredRows.forEach(function (row) {
      var v = parseFloat(row.getAttribute('data-value-usd')) || 0;
      totalVal += v;
      var st = row.getAttribute('data-status');
      if (st === 'announced') announced++;
      else if (st === 'closed') closed++;
      else if (st === 'terminated') terminated++;
    });

    if (totalDealsEl) totalDealsEl.textContent = filteredRows.length;
    if (totalValueEl) totalValueEl.textContent = '$' + totalVal.toFixed(1) + 'B';
    if (avgSizeEl) avgSizeEl.textContent = filteredRows.length > 0 ? '$' + (totalVal / filteredRows.length).toFixed(1) + 'B' : '$0.0B';

    // Update status badges
    var dashboard = document.getElementById('stats-dashboard');
    if (dashboard) {
      var badges = dashboard.querySelectorAll('.status-badge');
      badges.forEach(function (badge) {
        if (badge.classList.contains('status-badge--announced')) {
          badge.innerHTML = '<span class="status-dot"></span>' + announced + ' Announced';
        } else if (badge.classList.contains('status-badge--closed')) {
          badge.innerHTML = '<span class="status-dot"></span>' + closed + ' Closed';
        } else if (badge.classList.contains('status-badge--terminated')) {
          badge.innerHTML = '<span class="status-dot"></span>' + terminated + ' Terminated';
        }
      });
    }
  }

  // ── Sorting ─────────────────────────────────────────────────────
  var currentSort = 'date';
  var sortAsc = false;

  function sortFilteredRows() {
    filteredRows.sort(function (a, b) {
      var va, vb;
      if (currentSort === 'value') {
        va = parseFloat(a.getAttribute('data-value-usd')) || 0;
        vb = parseFloat(b.getAttribute('data-value-usd')) || 0;
      } else {
        va = (a.getAttribute('data-' + currentSort) || '').toLowerCase();
        vb = (b.getAttribute('data-' + currentSort) || '').toLowerCase();
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  function sortTable(key) {
    if (currentSort === key) {
      sortAsc = !sortAsc;
    } else {
      currentSort = key;
      sortAsc = key === 'date' ? false : true;
    }

    headers.forEach(function (h) {
      h.classList.remove('sorted', 'sorted--asc', 'sorted--desc');
    });
    var activeHeader = table.querySelector('th[data-sort="' + key + '"]');
    if (activeHeader) {
      activeHeader.classList.add('sorted', sortAsc ? 'sorted--asc' : 'sorted--desc');
    }

    sortFilteredRows();
    currentPage = 1;
    applyPagination();
    writeParams();
  }

  // ── Pagination (#13) ───────────────────────────────────────────
  var currentPage = 1;

  function getPageSize() {
    return pageSizeEl ? parseInt(pageSizeEl.value, 10) : 25;
  }

  function applyPagination() {
    var isMobile = window.innerWidth < 768;
    var pageSize = getPageSize();
    var totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    var start, end;

    if (isMobile) {
      // Mobile: use load-more pattern
      start = 0;
      end = Math.min(mobileLoadedCount, filteredRows.length);
    } else {
      // Desktop: use standard pagination
      start = (currentPage - 1) * pageSize;
      end = start + pageSize;
    }

    // Hide all rows first
    allRows.forEach(function (row) {
      row.style.display = 'none';
      // Also hide associated summary row
      var next = row.nextElementSibling;
      if (next && next.classList.contains('deal-summary-row')) {
        next.style.display = 'none';
        next.setAttribute('aria-hidden', 'true');
        row.classList.remove('deal-row--expanded');
      }
    });

    // Show only filtered rows on current page/loaded count
    filteredRows.forEach(function (row, idx) {
      if (idx >= start && idx < end) {
        row.style.display = '';
        // Re-attach row to DOM in sorted order
        var next = row.nextElementSibling;
        if (next && next.classList.contains('deal-summary-row')) {
          tbody.appendChild(row);
          tbody.appendChild(next);
        } else {
          tbody.appendChild(row);
        }
      }
    });

    // Also move non-visible filtered rows and all summary rows to maintain DOM order
    filteredRows.forEach(function (row, idx) {
      if (idx < start || idx >= end) {
        var next = row.nextElementSibling;
        tbody.appendChild(row);
        if (next && next.classList.contains('deal-summary-row')) {
          tbody.appendChild(next);
        }
      }
    });

    if (isMobile) {
      // Mobile: hide pagination, show load-more
      if (paginationNav) paginationNav.style.display = 'none';
      if (paginationBottom) paginationBottom.style.display = 'none';

      if (loadMoreWrap) {
        if (filteredRows.length > end) {
          loadMoreWrap.style.display = '';
        } else {
          loadMoreWrap.style.display = 'none';
        }
      }
      if (loadMoreCount) {
        loadMoreCount.textContent = 'Showing ' + Math.min(end, filteredRows.length) + ' of ' + filteredRows.length;
      }

      // Show range text
      var showingMobile = filteredRows.length > 0 ? '1-' + Math.min(end, filteredRows.length) + ' of ' : '0 of ';
      if (countEl) countEl.textContent = showingMobile + filteredRows.length;
      if (mobileVisibleCount) mobileVisibleCount.textContent = countEl ? countEl.textContent : '';
    } else {
      // Desktop: hide load-more, show pagination
      if (loadMoreWrap) loadMoreWrap.style.display = 'none';
      if (paginationNav) paginationNav.style.display = '';
      if (paginationBottom) paginationBottom.style.display = '';

      renderPagination(totalPages);

      // Update page jump max
      if (pageJumpEl) pageJumpEl.max = totalPages;

      // Show range text
      var showing = filteredRows.length > 0 ? (start + 1) + '-' + Math.min(end, filteredRows.length) + ' of ' : '0 of ';
      if (countEl) countEl.textContent = showing + filteredRows.length;
    }
  }

  // ── Load More Button ────────────────────────────────────────────
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      mobileLoadedCount += 10;
      applyPagination();
      // Update mobile visible count after pagination
      if (mobileVisibleCount && countEl) mobileVisibleCount.textContent = countEl.textContent;
    });
  }

  function renderPagination(totalPages) {
    if (!paginationNav) return;
    paginationNav.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous
    var prev = document.createElement('button');
    prev.className = 'pagination-btn' + (currentPage <= 1 ? ' pagination-btn--disabled' : '');
    prev.textContent = 'Previous';
    prev.disabled = currentPage <= 1;
    prev.addEventListener('click', function () {
      if (currentPage > 1) { currentPage--; applyPagination(); writeParams(); }
    });
    paginationNav.appendChild(prev);

    // Page numbers
    var pages = getPageNumbers(currentPage, totalPages);
    pages.forEach(function (p) {
      if (p === '...') {
        var dots = document.createElement('span');
        dots.className = 'pagination-dots';
        dots.textContent = '...';
        paginationNav.appendChild(dots);
      } else {
        var btn = document.createElement('button');
        btn.className = 'pagination-btn' + (p === currentPage ? ' pagination-btn--active' : '');
        btn.textContent = p;
        btn.addEventListener('click', function () {
          currentPage = p;
          applyPagination();
          writeParams();
        });
        paginationNav.appendChild(btn);
      }
    });

    // Next
    var next = document.createElement('button');
    next.className = 'pagination-btn' + (currentPage >= totalPages ? ' pagination-btn--disabled' : '');
    next.textContent = 'Next';
    next.disabled = currentPage >= totalPages;
    next.addEventListener('click', function () {
      if (currentPage < totalPages) { currentPage++; applyPagination(); writeParams(); }
    });
    paginationNav.appendChild(next);

    // Clone to bottom
    if (paginationBottom) {
      paginationBottom.innerHTML = paginationNav.innerHTML;
      // Re-attach event listeners on cloned buttons
      var bottomBtns = paginationBottom.querySelectorAll('.pagination-btn:not(.pagination-btn--disabled)');
      bottomBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var text = btn.textContent.trim();
          if (text === 'Previous') {
            if (currentPage > 1) { currentPage--; applyPagination(); writeParams(); }
          } else if (text === 'Next') {
            var ts = Math.ceil(filteredRows.length / getPageSize());
            if (currentPage < ts) { currentPage++; applyPagination(); writeParams(); }
          } else {
            currentPage = parseInt(text, 10);
            applyPagination();
            writeParams();
          }
        });
      });
    }
  }

  function getPageNumbers(current, total) {
    if (total <= 7) {
      var arr = [];
      for (var i = 1; i <= total; i++) arr.push(i);
      return arr;
    }
    var pages = [1];
    if (current > 3) pages.push('...');
    for (var j = Math.max(2, current - 1); j <= Math.min(total - 1, current + 1); j++) {
      pages.push(j);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  // ── CSV Export (#6) ─────────────────────────────────────────────
  function exportCSV(rows) {
    var headers = ['Deal', 'Value', 'Value (USD B)', 'Currency', 'Buyer', 'Seller', 'Sector', 'Geography', 'Date', 'Status', 'Summary', 'Source URL'];
    var csvRows = [headers.join(',')];

    rows.forEach(function (row) {
      var values = [
        escapeCSV(row.getAttribute('data-title')),
        escapeCSV(row.getAttribute('data-value')),
        row.getAttribute('data-value-usd'),
        escapeCSV(row.getAttribute('data-currency')),
        escapeCSV(row.getAttribute('data-buyer')),
        escapeCSV(row.getAttribute('data-seller')),
        escapeCSV(row.getAttribute('data-sector')),
        escapeCSV(row.getAttribute('data-geography')),
        row.getAttribute('data-date'),
        escapeCSV(row.getAttribute('data-status')),
        escapeCSV(row.getAttribute('data-summary') || ''),
        escapeCSV(row.getAttribute('data-source') || '')
      ];
      csvRows.push(values.join(','));
    });

    var csv = csvRows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'infra-ma-deals-export-' + date + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeCSV(str) {
    if (!str) return '""';
    str = String(str);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      exportCSV(filteredRows);
    });
  }
  if (exportAll) {
    exportAll.addEventListener('click', function () {
      exportCSV(allRows);
    });
  }

  // ── Charts (#17) ───────────────────────────────────────────────
  var chartVolume, chartValue, chartSector, chartGeo;

  function initCharts() {
    if (typeof Chart === 'undefined') return;

    var chartDefaults = {
      color: '#94a3b8',
      borderColor: 'rgba(148,163,184,0.12)',
      font: { family: "'DM Sans', sans-serif" }
    };
    Chart.defaults.color = chartDefaults.color;
    Chart.defaults.borderColor = chartDefaults.borderColor;
    Chart.defaults.font.family = chartDefaults.font.family;

    var volumeCtx = document.getElementById('chart-volume');
    var valueCtx = document.getElementById('chart-value');
    var sectorCtx = document.getElementById('chart-sector');
    var geoCtx = document.getElementById('chart-geography');

    if (volumeCtx) {
      chartVolume = new Chart(volumeCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Deals', data: [], backgroundColor: '#14b8a6', borderRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    }

    if (valueCtx) {
      chartValue = new Chart(valueCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Value (USD B)', data: [], backgroundColor: '#8b5cf6', borderRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    if (sectorCtx) {
      chartSector = new Chart(sectorCtx, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#f43f5e'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } }
          },
          onClick: function (e, elements) {
            if (elements.length > 0) {
              var idx = elements[0].index;
              var sectorName = chartSector.data.labels[idx].toLowerCase();
              // Set sector filter
              var cb = document.querySelector('input[data-filter="sector"][value="' + sectorName + '"]');
              if (cb && !cb.checked) {
                cb.checked = true;
                applyFilters();
              }
            }
          }
        }
      });
    }

    if (geoCtx) {
      chartGeo = new Chart(geoCtx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [{ label: 'Deals', data: [], backgroundColor: '#3b82f6', borderRadius: 6 }]
        },
        options: {
          responsive: true,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }
  }

  function updateCharts() {
    if (typeof Chart === 'undefined') return;

    // Volume by year
    var yearCounts = {};
    var yearValues = {};
    var sectorCounts = {};
    var geoCounts = {};

    filteredRows.forEach(function (row) {
      var y = row.getAttribute('data-year');
      var v = parseFloat(row.getAttribute('data-value-usd')) || 0;
      var s = row.getAttribute('data-sector') || 'unknown';
      var g = row.getAttribute('data-geography') || 'unknown';

      yearCounts[y] = (yearCounts[y] || 0) + 1;
      yearValues[y] = (yearValues[y] || 0) + v;
      sectorCounts[s] = (sectorCounts[s] || 0) + 1;
      geoCounts[g] = (geoCounts[g] || 0) + 1;
    });

    var sortedYears = Object.keys(yearCounts).sort();

    if (chartVolume) {
      chartVolume.data.labels = sortedYears;
      chartVolume.data.datasets[0].data = sortedYears.map(function (y) { return yearCounts[y]; });
      chartVolume.update();
    }

    if (chartValue) {
      chartValue.data.labels = sortedYears;
      chartValue.data.datasets[0].data = sortedYears.map(function (y) { return Math.round(yearValues[y] * 10) / 10; });
      chartValue.update();
    }

    var sectorNames = { energy: 'Energy', transport: 'Transport', digital: 'Digital', water: 'Water', social: 'Social' };
    var sectorOrder = ['energy', 'transport', 'digital', 'water', 'social'];
    if (chartSector) {
      var sLabels = [];
      var sData = [];
      sectorOrder.forEach(function (s) {
        if (sectorCounts[s]) {
          sLabels.push(sectorNames[s] || s);
          sData.push(sectorCounts[s]);
        }
      });
      chartSector.data.labels = sLabels;
      chartSector.data.datasets[0].data = sData;
      chartSector.update();
    }

    if (chartGeo) {
      var gEntries = Object.entries(geoCounts).sort(function (a, b) { return b[1] - a[1]; });
      chartGeo.data.labels = gEntries.map(function (e) { return e[0]; });
      chartGeo.data.datasets[0].data = gEntries.map(function (e) { return e[1]; });
      chartGeo.update();
    }
  }

  // ── Geographic Map Cards (#18) ──────────────────────────────────
  document.querySelectorAll('.geo-map__card').forEach(function (card) {
    card.addEventListener('click', function () {
      var geo = card.getAttribute('data-geo');
      // Clear all geo checkboxes first, then select just this one
      var geoCbs = document.querySelectorAll('input[data-filter="geography"]');
      geoCbs.forEach(function (cb) { cb.checked = false; });
      var target = document.querySelector('input[data-filter="geography"][value="' + geo + '"]');
      if (target) target.checked = true;
      applyFilters();
      // Scroll to table
      var tableWrap = document.querySelector('.deals-table-wrap');
      if (tableWrap) tableWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ── Debounced Search ────────────────────────────────────────────
  var searchTimer;
  function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 200);
  }

  // ── Event Listeners ─────────────────────────────────────────────
  if (searchEl) searchEl.addEventListener('input', onSearch);
  if (dateFrom) dateFrom.addEventListener('change', applyFilters);
  if (dateTo) dateTo.addEventListener('change', applyFilters);
  if (valueMin) valueMin.addEventListener('input', function () {
    document.querySelectorAll('.filter-value-preset').forEach(function (b) { b.classList.remove('active'); });
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });
  if (valueMax) valueMax.addEventListener('input', function () {
    document.querySelectorAll('.filter-value-preset').forEach(function (b) { b.classList.remove('active'); });
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 300);
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      document.querySelectorAll('.filter-check input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
      if (searchEl) searchEl.value = '';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (valueMin) valueMin.value = '';
      if (valueMax) valueMax.value = '';
      document.querySelectorAll('.filter-value-preset').forEach(function (b) { b.classList.remove('active'); });
      applyFilters();
    });
  }

  headers.forEach(function (th) {
    th.addEventListener('click', function () {
      sortTable(th.getAttribute('data-sort'));
    });
  });

  if (pageSizeEl) {
    pageSizeEl.addEventListener('change', function () {
      currentPage = 1;
      applyPagination();
      writeParams();
    });
  }

  if (pageJumpEl) {
    pageJumpEl.addEventListener('change', function () {
      var val = parseInt(pageJumpEl.value, 10);
      var totalPages = Math.ceil(filteredRows.length / getPageSize());
      if (val >= 1 && val <= totalPages) {
        currentPage = val;
        applyPagination();
        writeParams();
      }
      pageJumpEl.value = '';
    });
  }

  // ── Handle Resize: switch between mobile/desktop pagination ─────
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      applyPagination();
      if (mobileVisibleCount && countEl) mobileVisibleCount.textContent = countEl.textContent;
    }, 150);
  });

  // ── Initialize ──────────────────────────────────────────────────
  readParams();
  initCharts();
  applyFilters();

  // Lazy load charts section
  if ('IntersectionObserver' in window) {
    var chartsSection = document.getElementById('deals-charts');
    if (chartsSection) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            updateCharts();
            observer.disconnect();
          }
        });
      }, { threshold: 0.1 });
      observer.observe(chartsSection);
    }
  }
})();
