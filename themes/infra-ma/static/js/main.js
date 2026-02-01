/**
 * Infra-MA: Infrastructure M&A Tracker
 * Client-side filtering, sorting, and interactivity
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------

  function debounce(fn, ms) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, arguments), ms);
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
  // Subsector cascade mapping
  // ---------------------------------------------------------------------------

  const SUBSECTOR_MAP = {
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

  // ---------------------------------------------------------------------------
  // Deal filtering (/deals/ page)
  // ---------------------------------------------------------------------------

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
    const searchInput = document.getElementById('deal-search');
    const resultsCount = document.getElementById('results-count');
    const resetBtn     = document.getElementById('filter-reset');
    const cards        = Array.from(list.querySelectorAll('[data-sector]'));

    // Cache original subsector options for cascade reset
    let allSubsectorOptions = [];
    if (filters.subsector) {
      allSubsectorOptions = Array.from(filters.subsector.options).map(o => ({
        value: o.value, text: o.textContent
      }));
    }

    // --- Subsector cascade ---------------------------------------------------

    function updateSubsectors() {
      if (!filters.sector || !filters.subsector) return;
      const sector = filters.sector.value;
      const allowed = sector ? (SUBSECTOR_MAP[sector] || []) : null;

      // Rebuild options
      filters.subsector.innerHTML = '';
      allSubsectorOptions.forEach(opt => {
        if (!allowed || opt.value === '' || allowed.includes(opt.value)) {
          const el = document.createElement('option');
          el.value = opt.value;
          el.textContent = opt.text;
          filters.subsector.appendChild(el);
        }
      });
      // Reset subsector selection when sector changes
      filters.subsector.value = '';
    }

    // --- Core filter logic ---------------------------------------------------

    function applyFilters() {
      const vals = {};
      Object.keys(filters).forEach(key => {
        vals[key] = filters[key] ? filters[key].value : '';
      });
      const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

      let visible = 0;
      cards.forEach(card => {
        const match =
          (!vals.sector    || card.dataset.sector    === vals.sector) &&
          (!vals.subsector || card.dataset.subsector === vals.subsector) &&
          (!vals.geography || card.dataset.geography === vals.geography) &&
          (!vals.fund      || card.dataset.fund      === vals.fund) &&
          (!vals.status    || card.dataset.status    === vals.status) &&
          (!search         || (card.dataset.search || '').toLowerCase().includes(search));

        card.style.display = match ? '' : 'none';
        if (match) visible++;
      });

      if (resultsCount) {
        resultsCount.textContent = visible + ' deal' + (visible !== 1 ? 's' : '');
      }

      syncFiltersToURL(vals, search);
    }

    // --- URL parameter sync --------------------------------------------------

    function syncFiltersToURL(vals, search) {
      const params = new URLSearchParams();
      Object.keys(vals).forEach(k => { if (vals[k]) params.set(k, vals[k]); });
      if (search) params.set('q', search);
      const qs = params.toString();
      const url = window.location.pathname + (qs ? '?' + qs : '');
      history.replaceState(null, '', url);
    }

    function restoreFiltersFromURL() {
      const params = new URLSearchParams(window.location.search);
      // Restore sector first so subsector cascade runs
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

    // --- Event listeners -----------------------------------------------------

    Object.keys(filters).forEach(key => {
      if (!filters[key]) return;
      filters[key].addEventListener('change', () => {
        if (key === 'sector') updateSubsectors();
        applyFilters();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', debounce(applyFilters, 200));
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        Object.keys(filters).forEach(k => { if (filters[k]) filters[k].value = ''; });
        if (searchInput) searchInput.value = '';
        updateSubsectors();
        applyFilters();
        history.replaceState(null, '', window.location.pathname);
      });
    }

    // Restore on page load
    restoreFiltersFromURL();
  }

  // ---------------------------------------------------------------------------
  // Sort controls
  // ---------------------------------------------------------------------------

  function initSortControls() {
    const controls = document.querySelectorAll('.sort-control');
    if (!controls.length) return;

    const list = document.getElementById('deals-list');
    if (!list) return;

    let currentKey = 'date';
    let ascending = false; // default newest / highest first

    controls.forEach(ctrl => {
      ctrl.addEventListener('click', () => {
        const key = ctrl.dataset.sort; // "date", "value", or "title"
        if (key === currentKey) {
          ascending = !ascending;
        } else {
          currentKey = key;
          ascending = false;
        }

        // Update active state on controls
        controls.forEach(c => c.classList.remove('active', 'asc', 'desc'));
        ctrl.classList.add('active', ascending ? 'asc' : 'desc');

        const cards = Array.from(list.querySelectorAll('[data-sector]'));
        cards.sort((a, b) => {
          let va, vb;
          if (key === 'date') {
            va = a.dataset.date || '';
            vb = b.dataset.date || '';
          } else if (key === 'value') {
            va = parseFloat(a.dataset.value) || 0;
            vb = parseFloat(b.dataset.value) || 0;
          } else {
            va = (a.dataset.title || '').toLowerCase();
            vb = (b.dataset.title || '').toLowerCase();
          }
          if (va < vb) return ascending ? -1 : 1;
          if (va > vb) return ascending ? 1 : -1;
          return 0;
        });

        // Re-append in new order
        cards.forEach(c => list.appendChild(c));
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Fund directory search (/funds/ page)
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
  // Smooth scroll for anchor links
  // ---------------------------------------------------------------------------

  function initSmoothScroll() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ---------------------------------------------------------------------------
  // Scroll reveal (Intersection Observer)
  // ---------------------------------------------------------------------------

  function initScrollReveal() {
    // Respect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => {
        el.classList.add('is-visible');
      });
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
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => {
      observer.observe(el);
    });
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
    const duration = 1200;
    const start = performance.now();

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
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
    const hero = document.querySelector('.hero');
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const glow = document.createElement('div');
    glow.className = 'hero-cursor-glow';
    hero.appendChild(glow);

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      glow.style.left = (e.clientX - rect.left) + 'px';
      glow.style.top = (e.clientY - rect.top) + 'px';
    });
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    initNavToggle();
    initDealFiltering();
    initSortControls();
    initFundSearch();
    initSmoothScroll();
    initScrollReveal();
    initStatCounters();
    initCursorGlow();
  });

})();
