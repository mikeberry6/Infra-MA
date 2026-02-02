/**
 * Infra-MA: Infrastructure M&A Tracker
 * Client-side: filtering, command palette, timeline, animations
 */

(function () {
  'use strict';

  function debounce(fn, ms) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  function throttle(fn, ms) {
    let last = 0;
    return function () {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Subsector cascade — loaded from search-data JSON if available, else fallback
  // ---------------------------------------------------------------------------

  let SUBSECTOR_MAP = {};

  function loadSubsectorMap() {
    try {
      const el = document.getElementById('search-data');
      if (!el) return;
      const data = JSON.parse(el.textContent);
      const sectorItems = data.filter(d => d.type === 'sector');
      // Build from sectors — not available directly, use fallback
    } catch (e) {
      console.warn('[Infra-MA] Could not load subsector map from search data:', e);
    }

    // Fallback — built from filter options on the deals page
    const sectorSelect = document.getElementById('filter-sector');
    const subsectorSelect = document.getElementById('filter-subsector');
    if (!sectorSelect || !subsectorSelect) return;

    const allSubs = Array.from(subsectorSelect.options).map(o => o.value).filter(Boolean);
    // We still need the mapping. Keep a static fallback for now.
    SUBSECTOR_MAP = {
      'Transportation & Logistics': [
        'Aviation', 'Maritime & Ports', 'Roads & Surface Transport',
        'Rail & Mass Transit', 'Logistics & Supply Chain'
      ],
      'Power & Energy Transition': [
        'Renewable Power Generation', 'Conventional Power Generation',
        'Energy Transition Infrastructure'
      ],
      'Midstream Energy': [
        'Pipeline Transport', 'Storage & Terminals',
        'LNG Infrastructure', 'Carbon & Molecule Management'
      ],
      'Regulated Utilities': [
        'Electric Networks', 'Gas Networks', 'Water Utilities', 'District Energy'
      ],
      'Environmental Services': [
        'Waste Management', 'Resource Recovery', 'Industrial Services'
      ],
      'Digital Infrastructure': [
        'Towers & Wireless', 'Fiber Networks', 'Data Centers', 'Global Connectivity'
      ],
      'Social Infrastructure': [
        'Healthcare Infrastructure', 'Education Infrastructure',
        'Civic & Government Facilities'
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // Mobile nav toggle
  // ---------------------------------------------------------------------------

  function initNavToggle() {
    const btn = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-mobile');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen);
    });
  }

  // ---------------------------------------------------------------------------
  // Deal filtering (/deals/ page)
  // ---------------------------------------------------------------------------

  // Track visible cards for timeline sync (#16)
  let visibleCards = [];

  function initDealFiltering() {
    const list = document.getElementById('deals-list');
    if (!list) return;

    const filters = {
      sector:    document.getElementById('filter-sector'),
      subsector: document.getElementById('filter-subsector'),
      geography: document.getElementById('filter-geography'),
      fund:      document.getElementById('filter-fund'),
      status:    document.getElementById('filter-status')
    };
    const searchInput    = document.getElementById('deal-search');
    const resultsCount   = document.getElementById('results-count');
    const resetBtn       = document.getElementById('filter-reset');
    const activeFiltersEl = document.getElementById('active-filters');
    const cards          = Array.from(list.querySelectorAll('[data-sector]'));
    visibleCards = cards;

    let allSubsectorOptions = [];
    if (filters.subsector) {
      allSubsectorOptions = Array.from(filters.subsector.options).map(o => ({
        value: o.value, text: o.textContent
      }));
    }

    function updateSubsectors() {
      if (!filters.sector || !filters.subsector) return;
      const sector = filters.sector.value;
      const allowed = sector ? (SUBSECTOR_MAP[sector] || []) : null;
      filters.subsector.innerHTML = '';
      allSubsectorOptions.forEach(opt => {
        if (!allowed || opt.value === '' || allowed.includes(opt.value)) {
          const el = document.createElement('option');
          el.value = opt.value;
          el.textContent = opt.text;
          filters.subsector.appendChild(el);
        }
      });
      filters.subsector.value = '';
    }

    function updateActiveFilterPills(vals, search) {
      if (!activeFiltersEl) return;
      activeFiltersEl.innerHTML = '';
      const labels = { sector: 'Sector', subsector: 'Subsector', geography: 'Geography', fund: 'Fund', status: 'Status' };
      Object.keys(vals).forEach(key => {
        if (!vals[key]) return;
        const pill = document.createElement('button');
        pill.className = 'active-filter-pill';
        pill.setAttribute('type', 'button');
        pill.innerHTML = labels[key] + ': ' + vals[key] + ' <span class="active-filter-pill-x">&times;</span>';
        pill.addEventListener('click', () => {
          if (filters[key]) filters[key].value = '';
          if (key === 'sector') updateSubsectors();
          applyFilters();
        });
        activeFiltersEl.appendChild(pill);
      });
      if (search) {
        const pill = document.createElement('button');
        pill.className = 'active-filter-pill';
        pill.setAttribute('type', 'button');
        pill.innerHTML = 'Search: ' + search + ' <span class="active-filter-pill-x">&times;</span>';
        pill.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          applyFilters();
        });
        activeFiltersEl.appendChild(pill);
      }
    }

    function applyFilters() {
      const vals = {};
      Object.keys(filters).forEach(key => {
        vals[key] = filters[key] ? filters[key].value : '';
      });
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

      if (resultsCount) resultsCount.classList.add('results-count-updating');

      let visible = 0;
      const nowVisible = [];
      cards.forEach(card => {
        const match =
          (!vals.sector    || card.dataset.sector    === vals.sector) &&
          (!vals.subsector || card.dataset.subsector === vals.subsector) &&
          (!vals.geography || card.dataset.geography === vals.geography) &&
          (!vals.fund      || card.dataset.fund      === vals.fund) &&
          (!vals.status    || card.dataset.status    === vals.status) &&
          (!search         || (card.dataset.search || '').toLowerCase().includes(search));
        card.style.display = match ? '' : 'none';
        if (match) {
          visible++;
          nowVisible.push(card);
        }
      });

      // #16: Update visible cards for timeline
      visibleCards = nowVisible;
      // Rebuild timeline if currently in timeline view
      const timelineView = document.getElementById('deals-timeline');
      if (timelineView && timelineView.style.display !== 'none') {
        buildTimeline();
      }

      if (resultsCount) {
        resultsCount.textContent = visible + ' deal' + (visible !== 1 ? 's' : '');
        requestAnimationFrame(() => resultsCount.classList.remove('results-count-updating'));
      }
      updateActiveFilterPills(vals, search);
      syncFiltersToURL(vals, search);
    }

    function syncFiltersToURL(vals, search) {
      const params = new URLSearchParams();
      Object.keys(vals).forEach(k => { if (vals[k]) params.set(k, vals[k]); });
      if (search) params.set('q', search);
      const qs = params.toString();
      history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    }

    function restoreFiltersFromURL() {
      const params = new URLSearchParams(window.location.search);
      if (filters.sector && params.has('sector')) {
        filters.sector.value = params.get('sector');
        updateSubsectors();
      }
      Object.keys(filters).forEach(key => {
        if (key === 'sector') return;
        if (filters[key] && params.has(key)) filters[key].value = params.get(key);
      });
      if (searchInput && params.has('q')) searchInput.value = params.get('q');
      applyFilters();
    }

    Object.keys(filters).forEach(key => {
      if (!filters[key]) return;
      filters[key].addEventListener('change', () => {
        if (key === 'sector') updateSubsectors();
        applyFilters();
      });
    });

    if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 200));

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        Object.keys(filters).forEach(k => { if (filters[k]) filters[k].value = ''; });
        if (searchInput) searchInput.value = '';
        updateSubsectors();
        applyFilters();
        history.replaceState(null, '', window.location.pathname);
      });
    }

    restoreFiltersFromURL();
  }

  // ---------------------------------------------------------------------------
  // View toggle (grid / timeline)
  // ---------------------------------------------------------------------------

  function initViewToggle() {
    const toggle = document.getElementById('view-toggle');
    if (!toggle) return;

    const gridView = document.getElementById('deals-list');
    const timelineView = document.getElementById('deals-timeline');
    if (!gridView || !timelineView) return;

    const btns = toggle.querySelectorAll('.view-toggle-btn');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const view = btn.dataset.view;

        if (view === 'timeline') {
          gridView.style.display = 'none';
          timelineView.style.display = '';
          buildTimeline();
        } else {
          gridView.style.display = '';
          timelineView.style.display = 'none';
        }
      });
    });
  }

  // #16: buildTimeline now respects visibleCards filter state
  function buildTimeline() {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;

    const cards = visibleCards.length ? visibleCards : document.querySelectorAll('#deals-list [data-date]');
    if (!cards.length) {
      timeline.innerHTML = '<div class="empty-state" style="padding: var(--space-10)"><p>No deals match current filters.</p></div>';
      return;
    }

    const items = Array.from(cards).map(c => ({
      title: c.dataset.title || '',
      date: c.dataset.date || '',
      sector: c.dataset.sector || '',
      color: c.dataset.color || '#555',
      url: c.dataset.url || '#',
      value: c.dataset.value || ''
    })).sort((a, b) => a.date.localeCompare(b.date));

    timeline.innerHTML = '';

    items.forEach(item => {
      const el = document.createElement('a');
      el.href = item.url;
      el.className = 'timeline-item';

      const bar = document.createElement('div');
      bar.className = 'timeline-bar';
      bar.style.background = item.color;
      bar.style.height = item.value ? '80px' : '40px';

      const dot = document.createElement('div');
      dot.className = 'timeline-dot';
      dot.style.borderColor = item.color;

      const label = document.createElement('div');
      label.className = 'timeline-label';
      label.textContent = new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      const title = document.createElement('div');
      title.className = 'timeline-title';
      title.textContent = item.title;

      el.appendChild(bar);
      el.appendChild(dot);
      el.appendChild(label);
      el.appendChild(title);
      timeline.appendChild(el);
    });
  }

  // ---------------------------------------------------------------------------
  // Command palette
  // ---------------------------------------------------------------------------

  function initCommandPalette() {
    const overlay = document.getElementById('cmdpal');
    const input = document.getElementById('cmdpal-input');
    const results = document.getElementById('cmdpal-results');
    const trigger = document.getElementById('cmdpal-trigger');
    if (!overlay || !input || !results) return;

    let searchData = [];
    try {
      const el = document.getElementById('search-data');
      if (el) searchData = JSON.parse(el.textContent);
    } catch (e) {
      // #20: Log JSON parse errors instead of silently swallowing
      console.warn('[Infra-MA] Failed to parse search data:', e);
    }

    let selectedIndex = -1;

    function open() {
      overlay.classList.add('is-open');
      input.value = '';
      input.focus();
      renderResults('');
    }

    function close() {
      overlay.classList.remove('is-open');
      selectedIndex = -1;
    }

    // #18: Debounce command palette search
    const debouncedRender = debounce(function (val) { renderResults(val); }, 100);

    function renderResults(query) {
      const q = query.toLowerCase().trim();
      results.innerHTML = '';
      selectedIndex = -1;

      const groups = { deal: [], sector: [], fund: [] };
      const groupLabels = { deal: 'Deals', sector: 'Sectors', fund: 'Funds' };
      const groupIcons = { deal: '\u{1F4C4}', sector: '\u{1F3D7}', fund: '\u{1F3E6}' };

      const filtered = q
        ? searchData.filter(item =>
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.buyer && item.buyer.toLowerCase().includes(q)) ||
            (item.sector && item.sector.toLowerCase().includes(q))
          )
        : searchData.slice(0, 15);

      filtered.forEach(item => {
        if (groups[item.type]) groups[item.type].push(item);
      });

      let totalItems = 0;
      ['deal', 'sector', 'fund'].forEach(type => {
        const items = groups[type];
        if (!items.length) return;

        const label = document.createElement('div');
        label.className = 'cmdpal-group-label';
        label.textContent = groupLabels[type];
        results.appendChild(label);

        items.slice(0, 8).forEach(item => {
          const row = document.createElement('a');
          row.href = item.url || '#';
          row.className = 'cmdpal-item';
          row.dataset.index = totalItems++;

          const icon = document.createElement('span');
          icon.className = 'cmdpal-item-icon';
          icon.textContent = groupIcons[type];

          const text = document.createElement('div');
          text.className = 'cmdpal-item-text';

          const title = document.createElement('div');
          title.className = 'cmdpal-item-title';
          title.textContent = item.title || '';

          const sub = document.createElement('div');
          sub.className = 'cmdpal-item-sub';
          if (type === 'deal') {
            sub.textContent = [item.buyer, item.sector, item.date].filter(Boolean).join(' \u00b7 ');
          } else if (type === 'sector') {
            sub.textContent = 'Sector';
          } else {
            sub.textContent = 'Fund';
          }

          text.appendChild(title);
          text.appendChild(sub);
          row.appendChild(icon);
          row.appendChild(text);

          if (item.color) {
            const badge = document.createElement('span');
            badge.className = 'cmdpal-item-badge';
            badge.style.background = item.color;
            row.appendChild(badge);
          }

          results.appendChild(row);
        });
      });

      if (!totalItems) {
        const empty = document.createElement('div');
        empty.className = 'cmdpal-empty';
        empty.textContent = q ? 'No results for \u201c' + q + '\u201d' : 'Start typing to search\u2026';
        results.appendChild(empty);
      }
    }

    function updateSelection() {
      const items = results.querySelectorAll('.cmdpal-item');
      items.forEach((el, i) => {
        el.classList.toggle('is-selected', i === selectedIndex);
      });
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (overlay.classList.contains('is-open')) close(); else open();
        return;
      }

      if (!overlay.classList.contains('is-open')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      const items = results.querySelectorAll('.cmdpal-item');
      const count = items.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % Math.max(count, 1);
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? count - 1 : selectedIndex - 1;
        updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].click();
        }
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // #18: debounced input
    input.addEventListener('input', () => debouncedRender(input.value));

    if (trigger) trigger.addEventListener('click', open);
  }

  // ---------------------------------------------------------------------------
  // Fund directory search
  // ---------------------------------------------------------------------------

  function initFundSearch() {
    const input = document.getElementById('fund-search');
    if (!input) return;
    const cards = Array.from(document.querySelectorAll('.fund-card'));
    if (!cards.length) return;

    input.addEventListener('input', debounce(() => {
      const q = input.value.toLowerCase().trim();
      cards.forEach(card => {
        const name = (card.dataset.name || card.textContent).toLowerCase();
        card.style.display = (!q || name.includes(q)) ? '' : 'none';
      });
    }, 200));
  }

  // ---------------------------------------------------------------------------
  // Scroll reveal
  // ---------------------------------------------------------------------------

  function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => observer.observe(el));
  }

  // ---------------------------------------------------------------------------
  // Animated stat counters
  // ---------------------------------------------------------------------------

  function initStatCounters() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const counters = document.querySelectorAll('.stat-value[data-count]');
    if (!counters.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach(el => observer.observe(el));
  }

  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;
    const duration = 1400;
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------------
  // Hero cursor-following glow
  // ---------------------------------------------------------------------------

  function initCursorGlow() {
    const hero = document.querySelector('.page-hero');
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let glow = hero.querySelector('.hero-cursor-glow');
    if (!glow) {
      glow = document.createElement('div');
      glow.className = 'hero-cursor-glow';
      hero.appendChild(glow);
    }

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      glow.style.left = (e.clientX - rect.left) + 'px';
      glow.style.top = (e.clientY - rect.top) + 'px';
    });
  }

  // ---------------------------------------------------------------------------
  // Card cursor-tracking glow (#17: throttled)
  // ---------------------------------------------------------------------------

  function initCardGlow() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if ('ontouchstart' in window) return;

    // #17: Cache card list and throttle mousemove
    let cardCache = [];
    let cacheTime = 0;

    const handler = throttle((e) => {
      const now = Date.now();
      // Refresh cache every 2s
      if (now - cacheTime > 2000) {
        cardCache = Array.from(document.querySelectorAll('.deal-card, .bento-tile'));
        cacheTime = now;
      }
      for (let i = 0; i < cardCache.length; i++) {
        const rect = cardCache[i].getBoundingClientRect();
        cardCache[i].style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
        cardCache[i].style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
      }
    }, 16); // ~60fps

    document.addEventListener('mousemove', handler);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    loadSubsectorMap();
    initNavToggle();
    initDealFiltering();
    initViewToggle();
    initFundSearch();
    initScrollReveal();
    initStatCounters();
    initCursorGlow();
    initCardGlow();
    initCommandPalette();
  });

})();
