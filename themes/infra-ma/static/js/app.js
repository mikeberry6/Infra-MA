(function () {
  'use strict';

  /* ── Mobile Nav ── */
  const burger = document.getElementById('nav-burger');
  const navLinks = document.querySelector('.nav__links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      burger.classList.toggle('open');
    });
    navLinks.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        burger.classList.remove('open');
      });
    });
  }

  /* ── Command Bar (Cmd+K) ── */
  const cmdk = document.getElementById('cmdk');
  const cmdkOverlay = document.getElementById('cmdk-overlay');
  const cmdkInput = document.getElementById('cmdk-input');
  const cmdkResults = document.getElementById('cmdk-results');
  const cmdkTrigger = document.getElementById('cmdk-trigger');

  // Collect all deal rows for command bar search
  const allRows = Array.from(document.querySelectorAll('.row[data-title]'));
  // Also collect timeline cards
  const allTlCards = Array.from(document.querySelectorAll('.tl-card[data-href]'));

  // Build search index from rows or from any deal links
  const dealIndex = [];
  allRows.forEach(row => {
    dealIndex.push({
      title: row.dataset.title || '',
      href: row.dataset.href || '',
      value: row.dataset.dealValue || '',
      buyer: row.dataset.buyer || '',
      seller: row.dataset.seller || '',
      sector: row.dataset.sector || '',
      status: row.dataset.status || ''
    });
  });

  function openCmdk() {
    cmdk.classList.add('open');
    cmdkOverlay.classList.add('open');
    cmdkInput.value = '';
    cmdkInput.focus();
    renderCmdkResults('');
  }

  function closeCmdk() {
    cmdk.classList.remove('open');
    cmdkOverlay.classList.remove('open');
  }

  if (cmdkTrigger) cmdkTrigger.addEventListener('click', openCmdk);
  if (cmdkOverlay) cmdkOverlay.addEventListener('click', closeCmdk);

  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (cmdk.classList.contains('open')) closeCmdk();
      else openCmdk();
    }
    // / to search (when not in input)
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      openCmdk();
    }
    // Escape
    if (e.key === 'Escape') {
      closeCmdk();
      closePeek();
    }
  });

  if (cmdkInput) {
    let activeIdx = -1;
    cmdkInput.addEventListener('input', () => {
      activeIdx = -1;
      renderCmdkResults(cmdkInput.value.trim());
    });
    cmdkInput.addEventListener('keydown', (e) => {
      const items = cmdkResults.querySelectorAll('.cmdk__item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        updateActive(items, activeIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        updateActive(items, activeIdx);
      } else if (e.key === 'Enter' && items[activeIdx]) {
        e.preventDefault();
        items[activeIdx].click();
      }
    });
  }

  function updateActive(items, idx) {
    items.forEach((el, i) => el.classList.toggle('cmdk__item--active', i === idx));
    if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  }

  function renderCmdkResults(query) {
    if (!cmdkResults) return;
    if (dealIndex.length === 0) {
      cmdkResults.innerHTML = '<div class="cmdk__empty">No deals indexed on this page</div>';
      return;
    }
    const q = query.toLowerCase();
    const matches = q
      ? dealIndex.filter(d =>
          d.title.toLowerCase().includes(q) ||
          d.buyer.toLowerCase().includes(q) ||
          d.seller.toLowerCase().includes(q) ||
          d.sector.toLowerCase().includes(q)
        )
      : dealIndex.slice(0, 10);

    if (matches.length === 0) {
      cmdkResults.innerHTML = '<div class="cmdk__empty">No results</div>';
      return;
    }

    cmdkResults.innerHTML = matches.slice(0, 15).map(d => `
      <div class="cmdk__item" data-href="${d.href}">
        <span class="dot dot--${d.status}"></span>
        <span class="cmdk__item-title">${d.title}</span>
        <span class="cmdk__item-meta">${d.value}</span>
      </div>
    `).join('');

    cmdkResults.querySelectorAll('.cmdk__item').forEach(item => {
      item.addEventListener('click', () => {
        window.location.href = item.dataset.href;
      });
    });
  }

  /* ── Pagefind Search ── */
  const searchEl = document.getElementById('search');
  if (searchEl && typeof PagefindUI !== 'undefined') {
    new PagefindUI({
      element: '#search',
      showSubResults: false,
      showImages: false
    });
  }

  /* ── Timeline card click ── */
  allTlCards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const href = card.dataset.href;
      if (href) window.location.href = href;
    });
  });

  /* ── Deals Page: Filters ── */
  const tbody = document.getElementById('deals-tbody');
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll('.row'));
  let currentStatus = 'all';
  let currentSector = 'all';
  let currentSort = 'date';

  document.querySelectorAll('.fpill[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.filter;
      const value = btn.dataset.value;
      // Deactivate siblings
      btn.closest('.filters__group').querySelectorAll('.fpill').forEach(b => b.classList.remove('fpill--active'));
      btn.classList.add('fpill--active');
      if (group === 'status') currentStatus = value;
      if (group === 'sector') currentSector = value;
      applyFilters();
    });
  });

  document.querySelectorAll('.fpill[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.filters__group').querySelectorAll('.fpill').forEach(b => b.classList.remove('fpill--active'));
      btn.classList.add('fpill--active');
      currentSort = btn.dataset.sort;
      applySort();
    });
  });

  function applyFilters() {
    let visible = 0;
    rows.forEach(row => {
      const matchStatus = currentStatus === 'all' || row.dataset.status === currentStatus;
      const matchSector = currentSector === 'all' || row.dataset.sector === currentSector;
      const show = matchStatus && matchSector;
      row.hidden = !show;
      if (show) visible++;
    });
    const countEl = document.getElementById('results-count');
    if (countEl) countEl.textContent = visible + ' deal' + (visible !== 1 ? 's' : '');
  }

  function applySort() {
    const sorted = [...rows].sort((a, b) => {
      if (currentSort === 'date') return b.dataset.date.localeCompare(a.dataset.date);
      if (currentSort === 'value') return parseFloat(b.dataset.value || 0) - parseFloat(a.dataset.value || 0);
      if (currentSort === 'alpha') return a.dataset.title.localeCompare(b.dataset.title);
      return 0;
    });
    sorted.forEach(row => tbody.appendChild(row));
  }

  /* ── Peek Drawer ── */
  const peek = document.getElementById('peek');
  const peekOverlay = document.getElementById('peek-overlay');
  const peekClose = document.getElementById('peek-close');

  function openPeek(row) {
    if (!peek) return;
    document.getElementById('peek-status').innerHTML =
      `<span class="status status--${row.dataset.status}">${row.dataset.status}</span>` +
      (row.dataset.sector ? ` <span class="pill pill--${row.dataset.sector}">${row.dataset.sector}</span>` : '');
    document.getElementById('peek-title').textContent = row.dataset.title;
    document.getElementById('peek-value').textContent = row.dataset.dealValue || '';
    document.getElementById('peek-buyer').textContent = row.dataset.buyer ? 'Buyer: ' + row.dataset.buyer : '';
    document.getElementById('peek-seller').textContent = row.dataset.seller ? 'Seller: ' + row.dataset.seller : '';

    const facts = document.getElementById('peek-facts');
    facts.innerHTML = '';
    const pairs = [
      ['Geography', row.dataset.geography],
      ['Asset', row.dataset.asset],
      ['Date', row.dataset.date],
      ['Status', row.dataset.status]
    ];
    pairs.forEach(([k, v]) => {
      if (v) facts.innerHTML += `<dt>${k}</dt><dd>${v}</dd>`;
    });

    document.getElementById('peek-summary').textContent = row.dataset.summary || '';
    document.getElementById('peek-detail').href = row.dataset.href;
    const srcBtn = document.getElementById('peek-source');
    if (row.dataset.source) {
      srcBtn.href = row.dataset.source;
      srcBtn.style.display = '';
    } else {
      srcBtn.style.display = 'none';
    }

    peek.classList.add('open');
    peekOverlay.classList.add('open');
  }

  function closePeek() {
    if (peek) peek.classList.remove('open');
    if (peekOverlay) peekOverlay.classList.remove('open');
  }

  if (peekClose) peekClose.addEventListener('click', closePeek);
  if (peekOverlay) peekOverlay.addEventListener('click', closePeek);

  // Row click opens peek (but not if clicking a link)
  rows.forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      openPeek(row);
    });
  });

})();
