// Groww Huge Icons — single-file vanilla JS app, variant-aware (Rounded / Standard).

(() => {
  const $  = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];

  const els = {
    grid:        $('#grid'),
    counter:     $('#counter'),
    search:      $('#search'),
    filters:     $('#filters'),
    empty:       $('#empty'),
    selectToggle:$('#select-toggle'),
    downloadAll: $('#download-all'),
    drawer:      $('#drawer'),
    drawerClose: $('#drawer-close'),
    drawerName:  $('#drawer-name'),
    drawerCat:   $('#drawer-category'),
    drawerSrc:   $('#drawer-source'),
    drawerUni:   $('#drawer-unicode'),
    drawerIcon:  $('#drawer-icon-large'),
    drawerVariantPill: $('#drawer-variant-pill'),
    drawerSingleVariant: $('#drawer-single-variant'),
    fontLinks:   $('#font-links'),
    selbar:      $('#selbar'),
    selCount:    $('#sel-count'),
    selClear:    $('#sel-clear'),
    selAll:      $('#sel-all'),
    allDialog:   $('#all-dialog'),
    allCancel:   $('#all-cancel'),
    allGo:       $('#all-go'),
    toast:       $('#toast'),
    variantWrap: $('.variant'),
    sectionsNav: $('.sections'),
    panels: {
      icons:         $('#panel-icons'),
      illustrations: $('#panel-illustrations'),
      animation:     $('#panel-animation'),
    },
    counts: {
      icons:         $('#count-icons'),
      illustrations: $('#count-illustrations'),
      animation:     $('#count-animation'),
    },
    illuGrid: $('#illu-grid'),
    illuEmpty: $('#illu-empty'),
    animGrid: $('#anim-grid'),
    animEmpty: $('#anim-empty'),
    nhGrid:   $('#nh-grid'),
    nhEmpty:  $('#nh-empty'),
    nhEmptyState: $('#nh-empty-state'),
    nhFilters: $('#nh-filters'),
    viewMain:    $('#view-main'),
    viewNewHuge: $('#view-new-huge'),
  };

  let manifest = null;
  let icons = [];
  let filtered = [];
  let fuseIcons = null;
  let activeCategory = 'All';
  let searchQuery = '';
  let selectMode = false;
  const selected = new Set();
  let currentDetail = null;

  // Variant state — persisted in localStorage. Default: Standard (per user).
  const VARIANT_KEY = 'gh.variant';
  let variant = (localStorage.getItem(VARIANT_KEY) === 'rounded') ? 'rounded' : 'standard';

  // Brand state — persisted in localStorage. Default: groww.
  const BRAND_KEY = 'gh.brand';
  const BRANDS = {
    // variant: fixed variant for this brand (null = user can toggle freely)
    // manifest: which icon manifest to load (wealth reuses root manifest.json)
    groww:  { label: 'Groww · Visual Assets',  color: '#00b386', path: '',        variant: 'standard', manifest: 'manifest.json',       logo: '<svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.5943 39.4589C35.342 36.9217 41.9978 26.1522 39.4606 15.405C36.9233 4.65784 26.1533 -1.99773 15.4057 0.539424C4.65804 3.07658 -1.99782 13.8461 0.539447 24.5933C3.07671 35.3404 13.8467 41.996 24.5943 39.4589Z" fill="#5367FF"/><path d="M39.4606 15.405C39.0987 13.8684 38.567 12.4172 37.8925 11.0593L37.888 11.0637L25.2955 22.7043C24.5093 23.4324 23.339 23.5574 22.4143 23.0169L17.0628 19.8812C16.1962 19.3765 15.1107 19.4524 14.3245 20.0733C11.01 22.6953 2.52268 29.409 2.40207 29.5072C6.58766 37.2706 15.5978 41.5851 24.5943 39.4589C35.342 36.9217 41.9978 26.1522 39.4606 15.405Z" fill="#00F3BB"/></svg>' },
    wealth: { label: 'Wealth · Visual Assets', color: '#4F8EF7', path: 'wealth/', variant: 'rounded',  manifest: 'manifest.json' },
    prime:  { label: 'Prime · Visual Assets',  color: '#A855F7', path: 'prime/',  variant: null,       manifest: 'prime/manifest.json' },
  };
  const VALID_BRANDS = Object.keys(BRANDS);
  let activeBrand = VALID_BRANDS.includes(localStorage.getItem(BRAND_KEY))
    ? localStorage.getItem(BRAND_KEY) : 'groww';

  // Section state — persisted in localStorage. Default: icons.
  const SECTION_KEY = 'gh.section';
  const VALID_SECTIONS = ['icons', 'illustrations', 'animation'];
  const SUBVIEW_KEY = 'gh.icon-subview';
  let iconSubView = (localStorage.getItem(SUBVIEW_KEY) === 'new-huge') ? 'new-huge' : 'main';
  let section = VALID_SECTIONS.includes(localStorage.getItem(SECTION_KEY))
    ? localStorage.getItem(SECTION_KEY) : 'icons';

  let illustrations = [];
  let animations = [];
  let activeIlluCat = 'hero';
  let nhIcons = [];
  let nhFiltered = [];
  let fuseNH = null;
  let nhCategory = 'All';
  const riveInstances = new Map(); // canvas-id → Rive instance

  const FONT_PATH = v => `fonts/${v}/groww-huge-${v}`;
  const FONT_FILES = ['.ttf', '.otf', '.woff', '.woff2', '.css'];
  const cap = s => s[0].toUpperCase() + s.slice(1);

  // ---------- bootstrap --------------------------------------------------
  let keysWired = false;

  function loadBrand(id) {
    activeBrand = id;
    localStorage.setItem(BRAND_KEY, id);
    const brand = BRANDS[id];
    const p = brand.path;

    // Update brand mark + title
    const markEl  = document.getElementById('brand-mark');
    const titleEl = document.getElementById('brand-title');
    if (markEl) {
      if (brand.logo) {
        markEl.innerHTML     = brand.logo;
        markEl.style.background   = 'transparent';
        markEl.style.borderRadius = '0';
        markEl.style.color        = '';
      } else {
        markEl.innerHTML     = '●';
        markEl.style.background   = '#1a1a1a';
        markEl.style.borderRadius = '8px';
        markEl.style.color        = brand.color;
      }
    }
    if (titleEl) titleEl.textContent = brand.label;


    // Lock variant to brand's fixed variant (or keep current if brand allows free toggle)
    if (brand.variant) {
      variant = brand.variant;
      localStorage.setItem(VARIANT_KEY, variant);
    }
    // Show/hide the variant toggle: only visible when brand has no fixed variant
    const variantWrap = document.querySelector('.variant');
    if (variantWrap) variantWrap.style.display = brand.variant ? 'none' : '';

    // Update dropdown option check marks
    $$('.brand-opt').forEach(o =>
      o.setAttribute('aria-selected', o.dataset.brand === id));

    // Reset icon/illustration/animation state
    icons = []; filtered = []; selected.clear();
    if (selectMode) els.selectToggle.click();
    illustrations = []; animations = [];
    searchQuery = ''; els.search.value = '';
    activeCategory = 'All'; activeIlluCat = 'hero';
    els.counts.icons.textContent = '—';
    els.counts.illustrations.textContent = '—';
    els.counts.animation.textContent = '—';
    els.counter.textContent = 'loading…';

    // Reset illu category chip state
    const illuCatsNav = $('#illu-cats');
    if (illuCatsNav) {
      $$('[data-illu-cat]', illuCatsNav).forEach(c =>
        c.setAttribute('aria-pressed', c.dataset.illuCat === 'hero'));
    }

    // Fetch icon manifest (brand.manifest allows wealth to reuse root manifest.json)
    fetch(brand.manifest)
      .then(r => r.json())
      .then(data => {
        manifest = data;
        icons = data.icons || [];
        fuseIcons = new Fuse(icons, {
          keys: [
            { name: 'name',     weight: 2   },
            { name: 'mintName', weight: 1.5 },
            { name: 'tags',     weight: 1   },
            { name: 'category', weight: 0.5 },
          ],
          threshold: 0.4,
          includeScore: true,
          minMatchCharLength: 2,
          ignoreLocation: true,
        });
        els.counts.icons.textContent = icons.length;
        applyVariantToDom();
        buildFilters();
        applyFilters();
        if (!keysWired) { bindKeys(); keysWired = true; }
        renderFontLinks();
        applySectionToDom();
        applySubView();
        updateCounter();
        updateSearchPlaceholder();
      })
      .catch(err => {
        manifest = { icons: [], categories: [], fontFamilies: {}, classNamePrefixes: {} };
        icons = []; filtered = [];
        els.counts.icons.textContent = 0;
        if (!keysWired) { bindKeys(); keysWired = true; }
        buildFilters(); applyFilters();
        applySectionToDom(); updateCounter(); updateSearchPlaceholder();
        console.warn('No icon manifest for brand:', id, err);
      });

    // Fetch illustrations manifest
    fetch(`${p}illustrations.json`).then(r => r.ok ? r.json() : null).then(data => {
      illustrations = (data && Array.isArray(data.items)) ? data.items : [];
      els.counts.illustrations.textContent = illustrations.length || 0;
      buildIlluCatCounts();
      renderIllustrations();
    }).catch(() => {
      illustrations = [];
      els.counts.illustrations.textContent = 0;
      renderIllustrations();
    });

    // Fetch animations manifest
    fetch(`${p}animations.json`).then(r => r.ok ? r.json() : null).then(data => {
      animations = (data && Array.isArray(data.items)) ? data.items : [];
      els.counts.animation.textContent = animations.length || 0;
      renderAnimations();
    }).catch(() => {
      animations = [];
      els.counts.animation.textContent = 0;
      renderAnimations();
    });

    // Fetch New Huge manifest
    fetch(`${p}new-huge.json`).then(r => r.ok ? r.json() : null).then(data => {
      nhIcons = (data && Array.isArray(data.icons)) ? data.icons : [];
      fuseNH = nhIcons.length ? new Fuse(nhIcons, {
        keys: [{ name: 'name', weight: 2 }, { name: 'mintName', weight: 1.5 }, { name: 'tags', weight: 1 }, { name: 'category', weight: 0.5 }],
        threshold: 0.4, includeScore: true, minMatchCharLength: 2, ignoreLocation: true,
      }) : null;
      buildNHFilters();
      renderNH();
      applySubView();
    }).catch(() => {
      nhIcons = []; fuseNH = null;
      buildNHFilters(); renderNH();
      applySubView();
    });
  }

  // Wire brand dropdown
  const brandBtn      = document.getElementById('brand-btn');
  const brandDropdown = document.getElementById('brand-dropdown');
  if (brandBtn && brandDropdown) {
    brandBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = brandDropdown.classList.contains('hidden');
      brandDropdown.classList.toggle('hidden', !isOpen);
      brandBtn.setAttribute('aria-expanded', isOpen);
    });
    brandDropdown.addEventListener('click', e => {
      const opt = e.target.closest('.brand-opt');
      if (!opt) return;
      const id = opt.dataset.brand;
      brandDropdown.classList.add('hidden');
      brandBtn.setAttribute('aria-expanded', 'false');
      if (id !== activeBrand) loadBrand(id);
    });
    document.addEventListener('click', () => {
      brandDropdown.classList.add('hidden');
      brandBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // Initial load
  loadBrand(activeBrand);

  // ---------- section switching -----------------------------------------
  function applySectionToDom() {
    document.body.dataset.section = section;
    $$('.section-tab').forEach(t => t.setAttribute('aria-selected', t.dataset.section === section));
    Object.entries(els.panels).forEach(([k, p]) => p.classList.toggle('hidden', k !== section));
    // Close drawer / leave select mode when switching away from icons.
    if (section !== 'icons') {
      if (!els.drawer.classList.contains('hidden')) closeDrawer();
      if (selectMode) els.selectToggle.click();
    }
    updateCounter();
    updateSearchPlaceholder();
  }

  function updateCounter() {
    if (section === 'icons') {
      const n = iconSubView === 'new-huge' ? nhIcons.length : icons.length;
      els.counter.textContent = n ? `${n} icons · two variants` : (iconSubView === 'new-huge' ? 'no icons yet' : 'loading…');
    } else if (section === 'illustrations') {
      els.counter.textContent = illustrations.length
        ? `${illustrations.length} illustrations`
        : 'no illustrations yet';
    } else {
      els.counter.textContent = animations.length
        ? `${animations.length} animations`
        : 'no animations yet';
    }
  }

  function updateSearchPlaceholder() {
    if (section === 'icons') {
      if (iconSubView === 'new-huge') {
        els.search.placeholder = nhIcons.length ? `Search ${nhIcons.length} New Huge icons…` : 'Search New Huge…';
      } else {
        els.search.placeholder = `Search ${icons.length || ''} icons by name, tag, category…`.replace('  ', ' ');
      }
    } else if (section === 'illustrations') {
      els.search.placeholder = illustrations.length
        ? `Search ${illustrations.length} illustrations…`
        : 'Search illustrations…';
    } else {
      els.search.placeholder = animations.length
        ? `Search ${animations.length} animations…`
        : 'Search animations…';
    }
  }

  els.sectionsNav.addEventListener('click', e => {
    const btn = e.target.closest('.section-tab');
    if (!btn || btn.dataset.section === section) return;
    section = btn.dataset.section;
    localStorage.setItem(SECTION_KEY, section);
    // Clear search when switching sections — its meaning is section-scoped.
    searchQuery = '';
    els.search.value = '';
    applySectionToDom();
    if (section === 'icons') { applyFilters(); applyNHFilters(); }
    else if (section === 'illustrations') renderIllustrations();
    else renderAnimations();
  });

  // Sub-view switcher (Icons ↔ New Huge inside the icons panel)
  // ── Pill helper: builds the structured inner HTML for the pill ──────────
  const CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function pillHTML(label, count, selected) {
    return `<span class="pill-check" aria-hidden="true">${CHECK_SVG}</span>` +
           `<span class="pill-label">${label}</span>` +
           `<span class="icon-subview-count">${count || '—'}</span>`;
  }

  function applySubView() {
    const isNH = iconSubView === 'new-huge';
    els.viewMain?.classList.toggle('hidden', isNH);
    els.viewNewHuge?.classList.toggle('hidden', !isNH);

    // Update trigger label (shows active sub-view)
    const label = document.getElementById('icon-subview-label');
    if (label) {
      const n = isNH ? nhIcons.length : icons.length;
      const name = isNH ? 'Huge All' : 'Groww Huge';
      label.innerHTML = `${name} <span class="icon-subview-count">${n || '—'}</span>`;
    }

    // Update pill to represent the OTHER option (the one you can switch to)
    // Also mark it selected=true when it matches current view so checkmark shows
    const pill = document.querySelector('.icon-subview-pill[data-subview]');
    if (pill) {
      if (isNH) {
        pill.dataset.subview = 'main';
        pill.innerHTML = pillHTML('Groww Huge', icons.length, false);
        pill.setAttribute('aria-selected', 'false');
      } else {
        pill.dataset.subview = 'new-huge';
        pill.innerHTML = pillHTML('Huge All', nhIcons.length, false);
        pill.setAttribute('aria-selected', 'false');
      }
    }
    updateCounter();
    updateSearchPlaceholder();
  }

  // ── Dropdown open / close helpers ────────────────────────────────────────
  const subviewDropBtn  = document.getElementById('icon-subview-dropdown-btn');
  const subviewDropdown = document.getElementById('icon-subview-dropdown');

  function openSubviewDropdown() {
    subviewDropBtn?.setAttribute('aria-expanded', 'true');
    subviewDropdown?.classList.remove('hidden');
    // Focus first pill for keyboard users
    subviewDropdown?.querySelector('.icon-subview-pill')?.focus();
  }
  function closeSubviewDropdown(returnFocus = true) {
    subviewDropBtn?.setAttribute('aria-expanded', 'false');
    subviewDropdown?.classList.add('hidden');
    if (returnFocus) subviewDropBtn?.focus();
  }

  // Unified trigger — whole button opens/closes dropdown
  subviewDropBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = subviewDropBtn.getAttribute('aria-expanded') === 'true';
    isOpen ? closeSubviewDropdown(false) : openSubviewDropdown();
  });

  // Pill click — switch sub-view
  subviewDropdown?.addEventListener('click', e => {
    const btn = e.target.closest('[data-subview]');
    if (!btn) return;
    iconSubView = btn.dataset.subview;
    localStorage.setItem(SUBVIEW_KEY, iconSubView);
    searchQuery = '';
    els.search.value = '';
    closeSubviewDropdown();
    applySubView();
    if (iconSubView === 'new-huge') applyNHFilters();
    else applyFilters();
  });

  // Keyboard: Escape closes; arrow keys navigate pills (future-proof for multi-pill)
  subviewDropdown?.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSubviewDropdown(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      const btn = e.target.closest('[data-subview]');
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && subviewDropBtn?.getAttribute('aria-expanded') === 'true') {
      closeSubviewDropdown();
    }
  });

  // Click outside → close
  document.addEventListener('click', e => {
    if (!e.target.closest('#icon-subview-bar')) closeSubviewDropdown(false);
  });

  function buildIlluCatCounts() {
    const cats = { hero: 0, 'spot-hero': 0, 'illustrated-icons': 0 };
    for (const i of illustrations) if (cats[i.category] !== undefined) cats[i.category]++;
    for (const [cat, el] of [
      ['hero', $('#illu-count-hero')],
      ['spot-hero', $('#illu-count-spot-hero')],
      ['illustrated-icons', $('#illu-count-illustrated-icons')],
    ]) { if (el) el.textContent = cats[cat] ?? 0; }
  }

  // Wire illustration category chips
  const illuCatsNav = $('#illu-cats');
  if (illuCatsNav) {
    illuCatsNav.addEventListener('click', e => {
      const chip = e.target.closest('[data-illu-cat]');
      if (!chip || chip.dataset.illuCat === activeIlluCat) return;
      activeIlluCat = chip.dataset.illuCat;
      $$('[data-illu-cat]', illuCatsNav).forEach(c =>
        c.setAttribute('aria-pressed', c === chip));
      renderIllustrations();
    });
  }

  // Global illustration preview mode — single value, persisted in localStorage.
  const ILLU_MODE_KEY = 'gh.illuMode';
  let illuMode = localStorage.getItem(ILLU_MODE_KEY) === 'dark' ? 'dark' : 'light';

  function applyIlluModeToDom() {
    els.illuGrid.dataset.mode = illuMode;
    const btn   = document.getElementById('illu-mode-global');
    const label = document.getElementById('illu-mode-label');
    if (btn)   btn.setAttribute('aria-pressed', String(illuMode === 'dark'));
    if (label) label.textContent = illuMode === 'dark' ? 'Dark' : 'Light';
  }

  // Wire global mode toggle
  const illuModeGlobalBtn = document.getElementById('illu-mode-global');
  if (illuModeGlobalBtn) {
    illuModeGlobalBtn.addEventListener('click', () => {
      illuMode = illuMode === 'light' ? 'dark' : 'light';
      localStorage.setItem(ILLU_MODE_KEY, illuMode);
      applyIlluModeToDom();
    });
  }

  // For light/dark/svg illustrations, support both legacy { src } entries and
  // the new { light, dark } shape. Returns { light, dark } URL strings.
  function illuSources(item) {
    if (item.light && item.dark) return { light: item.light, dark: item.dark };
    const fallback = item.src || item.preview;
    return { light: fallback, dark: fallback };
  }

  // Auto-generate searchable tags from an illustration's name when no explicit
  // tags are provided. Splits on underscores, drops single-char noise, and
  // appends the category so every item is at least findable by category.
  // Explicit tags in illustrations.json always take priority over auto-tags.
  function illuTagsFor(item) {
    if (item.tags && item.tags.length) return item.tags;
    const parts = item.name.toLowerCase()
      .split(/[_\s]+/)
      .filter(p => p.length > 1);
    return [...new Set([...parts, item.category || ''])].filter(Boolean);
  }

  // ---------- New Huge section -------------------------------------------
  function buildNHFilters() {
    if (!els.nhFilters) return;
    const counts = { All: nhIcons.length };
    for (const e of nhIcons) counts[e.category] = (counts[e.category] || 0) + 1;
    const order = ['All', ...Array.from(new Set(nhIcons.map(e => e.category))).sort()];
    els.nhFilters.innerHTML = order.map(c =>
      `<button class="chip" data-nh-cat="${c}" aria-pressed="${c === 'All'}">${c}<span class="count">${counts[c] ?? 0}</span></button>`
    ).join('');
    els.nhFilters.addEventListener('click', e => {
      const chip = e.target.closest('[data-nh-cat]');
      if (!chip) return;
      nhCategory = chip.dataset.nhCat;
      $$('[data-nh-cat]', els.nhFilters).forEach(c => c.setAttribute('aria-pressed', c === chip));
      applyNHFilters();
    });
  }

  function applyNHFilters() {
    const q = searchQuery.trim();
    if (!q) {
      nhFiltered = nhCategory === 'All' ? nhIcons.slice() : nhIcons.filter(e => e.category === nhCategory);
    } else {
      const terms = q.split(/\s+/).filter(Boolean);
      function nhSearchTerm(term) {
        if (term.length === 1) {
          const t = term.toLowerCase();
          return nhIcons.filter(e => e.name.toLowerCase().includes(t) || e.tags.some(tag => tag.includes(t)));
        }
        const exact = nhIcons.filter(e => relevanceRank(e, term) < 8);
        if (exact.length > 0) return exact.sort((a, b) => relevanceRank(a, term) - relevanceRank(b, term) || a.name.localeCompare(b.name));
        return fuseNH ? fuseNH.search(term).map(r => r.item) : [];
      }
      if (terms.length > 1) {
        const sets = terms.map(t => new Set(nhSearchTerm(t).map(e => e.name)));
        const ix = sets.reduce((a, b) => new Set([...a].filter(n => b.has(n))));
        nhFiltered = nhSearchTerm(terms[0]).filter(e => ix.has(e.name));
      } else {
        nhFiltered = nhSearchTerm(terms[0]);
      }
      if (nhCategory !== 'All') nhFiltered = nhFiltered.filter(e => e.category === nhCategory);
    }
    renderNH();
  }

  function renderNH() {
    if (!els.nhGrid) return;
    const hasIcons = nhIcons.length > 0;
    els.nhEmptyState?.classList.toggle('hidden', hasIcons);
    if (!hasIcons) { els.nhGrid.innerHTML = ''; els.nhEmpty?.classList.add('hidden'); return; }
    if (!nhFiltered.length) {
      els.nhGrid.innerHTML = '';
      els.nhEmpty?.classList.remove('hidden');
      return;
    }
    els.nhEmpty?.classList.add('hidden');
    els.nhGrid.innerHTML = nhFiltered.map(e => {
      return `<div class="card" data-nh-name="${e.name}" tabindex="0" role="button" aria-label="${e.name}">
        <span class="card-copy" role="button" data-card-copy aria-label="Copy icon name" title="Copy icon name" tabindex="0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </span>
        <div class="card-icon"><img src="${e.svgPath}" alt="${e.name}" width="24" height="24" loading="lazy" style="display:block"></div>
        <div class="card-name">${e.name}</div>
      </div>`;
    }).join('');
  }

  function renderIllustrations() {
    // Sync active category onto the grid so CSS can adjust column widths
    // (e.g. tighter grid for spot's native 64 px icons).
    els.illuGrid.dataset.illuCat = activeIlluCat;
    if (!illustrations.length) {
      els.illuGrid.innerHTML = '';
      els.illuEmpty.classList.remove('hidden');
      applyIlluModeToDom();
      return;
    }
    const q = searchQuery.trim().toLowerCase();
    const list = illustrations.filter(i => {
      if (activeIlluCat !== 'all' && i.category !== activeIlluCat) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) ||
        illuTagsFor(i).some(t => t.toLowerCase().includes(q));
    });
    els.illuEmpty.classList.toggle('hidden', list.length > 0);
    els.illuGrid.innerHTML = list.map(i => {
      const { light, dark } = illuSources(i);
      return `
        <div class="card card-illu" data-illu-name="${i.name}" data-illu-cat="${i.category || 'hero'}">
          <div class="illu-thumb-wrap">
            <img class="illu-thumb illu-thumb-light" src="${light}" alt="${i.name} light" loading="lazy">
            <img class="illu-thumb illu-thumb-dark" src="${dark}" alt="${i.name} dark" loading="lazy">
          </div>
          <div class="illu-card-foot">
            <span class="name" title="${i.name}">${i.name}</span>
            <div class="illu-dl-group" role="group" aria-label="Download formats">
              <button class="illu-dl-btn illu-copy-btn" data-illu-copy title="Copy SVG markup">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button class="illu-dl-btn" data-illu-dl="svg"  title="Download light + dark as SVG zip">SVG</button>
              <button class="illu-dl-btn" data-illu-dl="webp" title="Download light + dark as WEBP zip">WEBP</button>
              <button class="illu-dl-btn" data-illu-dl="png"  title="Download light + dark as PNG zip">PNG</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    applyIlluModeToDom();
  }

  // Click handler for the illustrations grid: handles per-card mode toggles
  // and paired-format downloads. We attach lazily once.
  if (els.illuGrid) {
    els.illuGrid.addEventListener('click', async e => {
      const card = e.target.closest('.card-illu');
      if (!card) return;
      const name = card.dataset.illuName;
      const item = illustrations.find(i => i.name === name);
      if (!item) return;

      const dlBtn = e.target.closest('[data-illu-dl]');
      if (dlBtn) {
        e.preventDefault();
        await downloadIlluPair(item, dlBtn.dataset.illuDl, dlBtn);
        return;
      }

      // Card-level copy SVG button — copies whichever mode is currently active
      const copyBtn = e.target.closest('[data-illu-copy]');
      if (copyBtn) {
        e.preventDefault();
        const { light, dark } = illuSources(item);
        await fetchAndCopySvg(illuMode === 'dark' ? dark : light, copyBtn, item.category, `${item.name}-${illuMode}`);
        return;
      }

      // Otherwise: clicking the thumbnail (or its hover ↗ View hint) opens
      // the illustration viewer. Mode-toggle and download buttons short-circuit
      // before we get here.
      const thumb = e.target.closest('.illu-thumb-wrap');
      if (thumb) {
        e.preventDefault();
        openIlluViewer(item);
      }
    });
  }

  // ---------- illustration viewer (lightbox) ----------------------------
  const illuViewer = {
    root:   $('#illu-viewer'),
    close:  $('#illu-viewer-close'),
    name:   $('#illu-viewer-name'),
    tags:   $('#illu-viewer-tags'),
    light:  $('#illu-viewer-img-light'),
    dark:   $('#illu-viewer-img-dark'),
  };
  let currentIllu = null;

  function openIlluViewer(item) {
    if (!illuViewer.root) return;
    currentIllu = item;
    const { light, dark } = illuSources(item);
    illuViewer.name.textContent = item.name;
    illuViewer.root.dataset.illuCat = item.category || 'hero';
    illuViewer.light.src = light;
    illuViewer.light.alt = `${item.name} — light`;
    illuViewer.dark.src = dark;
    illuViewer.dark.alt = `${item.name} — dark`;
    const tags = [item.category, ...illuTagsFor(item)].filter(Boolean);
    illuViewer.tags.innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');
    illuViewer.root.classList.remove('hidden');
    illuViewer.root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeIlluViewer() {
    if (!illuViewer.root) return;
    illuViewer.root.classList.add('hidden');
    illuViewer.root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentIllu = null;
  }
  if (illuViewer.root) {
    illuViewer.close.addEventListener('click', closeIlluViewer);
    // Click outside the inner card → close.
    illuViewer.root.addEventListener('click', e => {
      if (e.target === illuViewer.root) closeIlluViewer();
    });
    // Wire the viewer's download buttons through the same paired-zip helper.
    illuViewer.root.addEventListener('click', async e => {
      const btn = e.target.closest('[data-illu-viewer-dl]');
      if (!btn || !currentIllu) return;
      await downloadIlluPair(currentIllu, btn.dataset.illuViewerDl, btn);
    });
    // Wire the viewer copy SVG buttons (one per mode).
    illuViewer.root.addEventListener('click', async e => {
      const btn = e.target.closest('[data-illu-viewer-copy]');
      if (!btn || !currentIllu) return;
      const { light, dark } = illuSources(currentIllu);
      const url = btn.dataset.illuViewerCopy === 'dark' ? dark : light;
      if (!url) { toast(`No ${btn.dataset.illuViewerCopy} SVG available`); return; }
      await fetchAndCopySvg(url, btn, currentIllu.category, `${currentIllu.name}-${btn.dataset.illuViewerCopy}`);
    });
  }

  // Build a zip with light + dark variants in the requested format and trigger
  // a download. SVG ships the source files directly; PNG / WEBP are rendered
  // through a canvas at 2× the SVG's intrinsic size so they stay crisp.
  async function downloadIlluPair(item, format, btn) {
    const { light, dark } = illuSources(item);
    if (!light || !dark) { toast('Missing light/dark pair'); return; }
    const prevLabel = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    const lightIsRaster = isPngSource(light);
    const darkIsRaster  = isPngSource(dark);
    try {
      const zip = new JSZip();
      if (format === 'svg') {
        if (lightIsRaster || darkIsRaster) {
          // Source is a raster — no SVG available; download the original PNGs instead.
          const [lBlob, dBlob] = await Promise.all([
            fetch(light).then(r => r.blob()),
            fetch(dark).then(r => r.blob()),
          ]);
          zip.file(`${item.name}-light.png`, lBlob);
          zip.file(`${item.name}-dark.png`, dBlob);
          const blob = await zip.generateAsync({ type: 'blob' });
          downloadBlob(`${item.name}-png.zip`, blob);
          toast(`Downloaded ${item.name} (PNG — SVG not available)`);
          return;
        }
        const [lText, dText] = await Promise.all([
          fetch(light).then(r => r.text()),
          fetch(dark).then(r => r.text()),
        ]);
        zip.file(`${item.name}-light.svg`, wrapSvgForExport(lText, item.category, `${item.name}-light`));
        zip.file(`${item.name}-dark.svg`, wrapSvgForExport(dText, item.category, `${item.name}-dark`));
      } else {
        const mime = format === 'webp' ? 'image/webp' : 'image/png';
        const ext = format;
        const toBlob = (url, isRaster) => isRaster
          ? rasterUrlToRasterBlob(url, mime, item.category)
          : svgUrlToRasterBlob(url, mime, item.category);
        const [lBlob, dBlob] = await Promise.all([
          toBlob(light, lightIsRaster),
          toBlob(dark, darkIsRaster),
        ]);
        zip.file(`${item.name}-light.${ext}`, lBlob);
        zip.file(`${item.name}-dark.${ext}`, dBlob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(`${item.name}-${format}.zip`, blob);
      toast(`Downloaded ${item.name} (${format.toUpperCase()})`);
    } catch (err) {
      console.error(err);
      toast(`Failed to build ${format.toUpperCase()} zip`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prevLabel; }
    }
  }

  // Returns true when the illustration source is already a raster (PNG/WEBP/JPG).
  function isPngSource(url) { return url && /\.(png|jpe?g|webp)(\?.*)?$/i.test(url); }

  // Per-category outer export sizes. The internal frame (250 mask + 5px padding) scales proportionally.
  const ILLU_EXPORT_OUTER = {
    hero:                 300,
    'spot-hero':          172,
    'illustrated-icons':   64,
  };

  // Derive frame dimensions for a given category, scaled from the 300-outer baseline.
  function illuExportDims(category) {
    const outer = ILLU_EXPORT_OUTER[category] || 300;
    const k = outer / 300;
    return {
      outer,
      maskSize:    250 * k,
      maskOffset:   25 * k,
      innerPad:      5 * k,
      contentSize: 240 * k,
      contentOff:   30 * k,
    };
  }

  // Escape user-supplied text for safe inclusion in SVG content (e.g. <title>).
  function escapeXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Wrap an SVG string in the nested outer→mask→artwork export frame, sized per category.
  // If the source viewBox isn't square, crop to a centered square on the shorter side
  // so wide/tall empty space doesn't shrink the content.
  // When `name` is provided, a <title> element is inserted as the first child of the outer
  // <svg> so design tools (Figma, Sketch) and a11y stacks surface the illustration name.
  function wrapSvgForExport(svgText, category, name) {
    const d = illuExportDims(category);
    const { vbW, vbH } = parseSvgSize(svgText);
    const sq = Math.min(vbW, vbH);
    const cropX = (vbW - sq) / 2;
    const cropY = (vbH - sq) / 2;
    const inner = svgText
      .replace(/<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '');
    const titleLine = name ? `  <title>${escapeXml(name)}</title>` : null;
    const idAttr    = name ? ` id="${escapeXml(name)}"` : '';
    return [
      `<svg xmlns="http://www.w3.org/2000/svg"${idAttr} width="${d.outer}" height="${d.outer}" viewBox="0 0 ${d.outer} ${d.outer}">`,
      titleLine,
      `  <svg x="${d.maskOffset}" y="${d.maskOffset}" width="${d.maskSize}" height="${d.maskSize}" viewBox="0 0 ${d.maskSize} ${d.maskSize}">`,
      `    <svg x="${d.innerPad}" y="${d.innerPad}" width="${d.contentSize}" height="${d.contentSize}" viewBox="${cropX} ${cropY} ${sq} ${sq}" preserveAspectRatio="xMidYMid meet">`,
      inner,
      `    </svg>`,
      `  </svg>`,
      `</svg>`,
    ].filter(Boolean).join('\n');
  }

  // Render a raster image URL into a target-format Blob via canvas.
  // Output size scales with category (300/172/64) using the same proportional frame.
  async function rasterUrlToRasterBlob(url, mime, category) {
    const d = illuExportDims(category);
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload  = () => res(i);
      i.onerror = () => rej(new Error(`Failed to load raster image: ${url}`));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width  = d.outer;
    canvas.height = d.outer;
    canvas.getContext('2d').drawImage(img, d.contentOff, d.contentOff, d.contentSize, d.contentSize);
    return await new Promise((res, rej) => {
      canvas.toBlob(b => b ? res(b) : rej(new Error('canvas.toBlob returned null')), mime, 0.95);
    });
  }

  // Render an SVG URL into a raster Blob via canvas.
  // Renders the wrapped 300×300 export SVG so the raster matches the SVG download exactly,
  // including the square-crop aspect-ratio handling.
  async function svgUrlToRasterBlob(url, mime, category) {
    const d = illuExportDims(category);
    const rawText = await fetch(url).then(r => r.text());
    const wrapped = wrapSvgForExport(rawText, category);
    const blob = new Blob([wrapped], { type: 'image/svg+xml' });
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('image load failed'));
        i.src = objUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width  = d.outer;
      canvas.height = d.outer;
      canvas.getContext('2d').drawImage(img, 0, 0, d.outer, d.outer);
      return await new Promise((res, rej) => {
        canvas.toBlob(b => b ? res(b) : rej(new Error(`canvas.toBlob returned null for ${mime}`)), mime, 0.95);
      });
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  }

  function parseSvgSize(svgText) {
    // Prefer viewBox; fall back to width/height attributes.
    const vb = svgText.match(/viewBox=["']\s*([\d.\-eE+]+)\s+([\d.\-eE+]+)\s+([\d.\-eE+]+)\s+([\d.\-eE+]+)\s*["']/);
    if (vb) return { vbW: parseFloat(vb[3]), vbH: parseFloat(vb[4]) };
    const w = svgText.match(/\bwidth=["']([\d.]+)/);
    const h = svgText.match(/\bheight=["']([\d.]+)/);
    return { vbW: w ? parseFloat(w[1]) : 411, vbH: h ? parseFloat(h[1]) : 300 };
  }

  function animType(src) {
    const ext = src.split('?')[0].split('.').pop().toLowerCase();
    if (ext === 'riv') return 'rive';
    if (ext === 'lottie') return 'dotlottie';
    return 'lottie'; // .json
  }

  function animTypeLabel(type) {
    return { rive: 'Rive', dotlottie: 'dotLottie', lottie: 'Lottie' }[type] ?? type;
  }

  function animPreviewHtml(a, idx) {
    const type = animType(a.src);
    if (type === 'rive') {
      return `<canvas class="anim-canvas rive-canvas" id="rive-${idx}" data-src="${a.src}"></canvas>`;
    }
    // dotlottie-player handles both .lottie and .json
    return `<dotlottie-player class="anim-canvas" src="${a.src}" autoplay loop background="transparent"></dotlottie-player>`;
  }

  function destroyRiveInstances() {
    riveInstances.forEach(r => { try { r.cleanup(); } catch (_) {} });
    riveInstances.clear();
  }

  function initRiveCanvases() {
    if (typeof rive === 'undefined') return;
    document.querySelectorAll('.rive-canvas[data-src]').forEach(canvas => {
      if (riveInstances.has(canvas.id)) return;
      const r = new rive.Rive({
        src: canvas.dataset.src,
        canvas,
        autoplay: true,
        onLoad() { r.resizeDrawingSurfaceToCanvas(); },
      });
      riveInstances.set(canvas.id, r);
    });
  }

  function renderAnimations() {
    destroyRiveInstances();
    if (!animations.length) {
      els.animGrid.innerHTML = '';
      els.animEmpty.classList.remove('hidden');
      return;
    }
    const q = searchQuery.trim().toLowerCase();
    const list = animations.filter(a => {
      if (!q) return true;
      return a.name.toLowerCase().includes(q) ||
        (a.tags || []).some(t => t.toLowerCase().includes(q));
    });
    els.animEmpty.classList.toggle('hidden', list.length > 0);
    els.animGrid.innerHTML = list.map((a, idx) => {
      const type = animType(a.src);
      return `
        <div class="card card-anim" title="${a.name}">
          <div class="anim-preview-wrap">
            ${animPreviewHtml(a, idx)}
          </div>
          <div class="anim-card-foot">
            <span class="name">${a.name}</span>
            <span class="tag anim-type-tag">${animTypeLabel(type)}</span>
          </div>
          <a class="anim-dl" href="${a.src}" download="${a.name}" title="Download" aria-label="Download ${a.name}">↓</a>
        </div>
      `;
    }).join('');
    initRiveCanvases();
  }

  // ---------- variant ----------------------------------------------------
  function applyVariantToDom() {
    document.body.dataset.variant = variant;
    $$('.variant-btn').forEach(b => b.setAttribute('aria-checked', b.dataset.variant === variant));
    if (els.drawerVariantPill) els.drawerVariantPill.textContent = cap(variant);
  }

  els.variantWrap.addEventListener('click', e => {
    const btn = e.target.closest('.variant-btn');
    if (!btn) return;
    if (variant === btn.dataset.variant) return;
    variant = btn.dataset.variant;
    localStorage.setItem(VARIANT_KEY, variant);
    applyVariantToDom();
    render();                 // re-render grid with new variant SVGs
    if (currentDetail) refreshDrawer();
    renderFontLinks();
  });

  function getSvg(entry)       { return entry[variant].svg; }
  function getClassName(entry) { return entry[variant].className; }
  function getUnicode(entry)   { return entry[variant].unicode; }

  // Small "copied" bubble that pops up next to `el` for 0.2 seconds.
  function showCopiedBubble(el, label = 'Name copied') {
    const r   = el.getBoundingClientRect();
    const vw  = window.innerWidth;
    const bub = document.createElement('div');
    bub.className   = 'copy-bubble';
    bub.textContent = label;
    // Prefer right of button; flip left if too close to viewport edge.
    const spaceRight = vw - r.right;
    if (spaceRight >= 72) {
      bub.style.left = `${r.right + 8}px`;
      bub.dataset.dir = 'right';
    } else {
      bub.style.left = `${r.left - 8}px`;
      bub.dataset.dir = 'left';
    }
    bub.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(bub);
    // Trigger entrance on next frame
    requestAnimationFrame(() => bub.classList.add('copy-bubble--in'));
    setTimeout(() => {
      bub.classList.replace('copy-bubble--in', 'copy-bubble--out');
      bub.addEventListener('transitionend', () => bub.remove(), { once: true });
    }, 200);
  }

  // Shared copy-SVG helper used by card hover buttons and illustration viewer.
  // `el` is the button element — it gets a .copied class for visual feedback.
  async function quickCopySvg(svgText, el, label = 'Name copied') {
    try {
      await navigator.clipboard.writeText(svgText);
      el.classList.add('copied');
      showCopiedBubble(el, label);
      setTimeout(() => el.classList.remove('copied'), 1400);
    } catch { toast('Copy failed'); }
  }

  // Fetch an SVG file from `url` and copy its text content.
  async function fetchAndCopySvg(url, el, category, name) {
    const prev = el.innerHTML;
    el.innerHTML = '…';
    try {
      const res  = await fetch(url);
      const text = await res.text();
      if (!text.trim().startsWith('<svg')) throw new Error('not SVG');
      await navigator.clipboard.writeText(wrapSvgForExport(text, category, name));
      el.innerHTML = prev;
      el.classList.add('copied');
      showCopiedBubble(el);
      setTimeout(() => { el.classList.remove('copied'); el.innerHTML = prev; }, 1400);
    } catch {
      el.innerHTML = prev;
      toast('Copy failed — may be a raster format');
    }
  }

  function renderFontLinks() {
    const base = FONT_PATH(variant);
    els.fontLinks.innerHTML = FONT_FILES.map(ext =>
      `<a class="btn btn-soft" href="${base}${ext}" download>${ext}</a>`
    ).join('');
  }

  // ---------- filters ----------------------------------------------------
  function buildFilters() {
    const counts = { All: icons.length };
    for (const c of manifest.categories) counts[c] = 0;
    for (const e of icons) counts[e.category]++;
    const order = ['All', ...manifest.categories];
    els.filters.innerHTML = order.map(c => `
      <button class="chip" data-cat="${c}" aria-pressed="${c === 'All'}">${c}<span class="count">${counts[c] ?? 0}</span></button>
    `).join('');
    els.filters.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      activeCategory = chip.dataset.cat;
      $$('.chip', els.filters).forEach(c => c.setAttribute('aria-pressed', c === chip));
      applyFilters();
    });
  }

  // ---------- search + filter -------------------------------------------

  // Relevance rank for a single term against a single icon (lower = better).
  // 1: name is exact query
  // 2: name starts with query
  // 3: name contains query
  // 4: mintName contains query
  // 5: one of the first 5 tags contains query
  // 6: a later tag contains query
  // 7: category contains query
  // 8: fuzzy fallback (no exact hit anywhere)
  function relevanceRank(icon, term) {
    const t = term.toLowerCase();
    const name = icon.name.toLowerCase();
    if (name === t)               return 1;
    if (name.startsWith(t))       return 2;
    if (name.includes(t))         return 3;
    if (icon.mintName && icon.mintName.toLowerCase().includes(t)) return 4;
    const tagIdx = icon.tags.findIndex(tag => tag.toLowerCase().includes(t));
    if (tagIdx !== -1)            return tagIdx < 5 ? 5 : 6;
    if (icon.category.toLowerCase().includes(t)) return 7;
    return 8; // fuzzy fallback
  }

  // Per-term search: exact first (ranked), fuzzy fallback only when exact returns nothing.
  function searchTerm(term) {
    if (term.length === 1) {
      const t = term.toLowerCase();
      return icons
        .filter(e => e.name.toLowerCase().includes(t) || e.tags.some(tag => tag.includes(t)))
        .sort((a, b) => relevanceRank(a, t) - relevanceRank(b, t) || a.name.localeCompare(b.name));
    }
    const exact = icons.filter(e => relevanceRank(e, term) < 8);
    if (exact.length > 0) {
      return exact.sort((a, b) =>
        relevanceRank(a, term) - relevanceRank(b, term) || a.name.localeCompare(b.name)
      );
    }
    // No exact hits — typo likely — fall back to fuzzy (already scored by Fuse)
    return fuseIcons ? fuseIcons.search(term).map(r => r.item) : [];
  }

  function applyFilters() {
    const q = searchQuery.trim();

    if (!q) {
      // No query — just category filter
      filtered = activeCategory === 'All'
        ? icons.slice()
        : icons.filter(e => e.category === activeCategory);
      render();
      return;
    }

    // Split on whitespace — multi-term AND: every term must match
    const terms = q.split(/\s+/).filter(Boolean);

    if (terms.length > 1) {
      // Multi-term AND: intersect per-term results, rank by best combined score
      const sets = terms.map(term => new Set(searchTerm(term).map(e => e.name)));
      const intersection = sets.reduce((a, b) => new Set([...a].filter(n => b.has(n))));
      filtered = searchTerm(terms[0])
        .filter(e => intersection.has(e.name))
        .sort((a, b) => {
          // Sum of ranks across all terms — lower total = more relevant overall
          const scoreA = terms.reduce((s, t) => s + relevanceRank(a, t), 0);
          const scoreB = terms.reduce((s, t) => s + relevanceRank(b, t), 0);
          return scoreA - scoreB || a.name.localeCompare(b.name);
        });
    } else {
      filtered = searchTerm(terms[0]);
    }

    // Apply category filter on top
    if (activeCategory !== 'All') {
      filtered = filtered.filter(e => e.category === activeCategory);
    }

    render();
  }

  els.search.addEventListener('input', e => {
    searchQuery = e.target.value;
    if (section === 'icons') {
      if (iconSubView === 'new-huge') applyNHFilters();
      else applyFilters();
    } else if (section === 'illustrations') renderIllustrations();
    else renderAnimations();
  });

  // ---------- render -----------------------------------------------------
  function render() {
    if (!filtered.length) {
      els.grid.innerHTML = '';
      els.empty.classList.remove('hidden');
      return;
    }
    els.empty.classList.add('hidden');
    els.grid.innerHTML = filtered.map(e => `
      <button class="card${selected.has(e.name) ? ' selected' : ''}${e.source === 'groww-custom' ? ' custom' : ''}" data-name="${e.name}" title="${e.name}">
        <span class="check" aria-hidden="true"></span>
        <span class="icon">${getSvg(e)}</span>
        <span class="name">${e.name}</span>
        <span class="card-copy card-copy-svg" role="button" data-card-copy-svg aria-label="Copy SVG markup" title="Copy SVG markup" tabindex="0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </span>
        <span class="card-copy" role="button" data-card-copy aria-label="Copy icon name" title="Copy icon name" tabindex="0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </span>
      </button>
    `).join('');
    if (selectMode) updateSelbar();
  }

  els.grid.addEventListener('click', async e => {
    // Copy SVG markup button
    const copySvgSpan = e.target.closest('[data-card-copy-svg]');
    if (copySvgSpan) {
      e.stopPropagation();
      const card  = copySvgSpan.closest('.card');
      const entry = icons.find(i => i.name === card?.dataset.name);
      if (entry) await quickCopySvg(getSvg(entry), copySvgSpan, 'SVG copied');
      return;
    }
    // Card-level copy name button — takes priority, swallows the click
    const copySpan = e.target.closest('[data-card-copy]');
    if (copySpan) {
      e.stopPropagation();
      const card  = copySpan.closest('.card');
      const entry = icons.find(i => i.name === card?.dataset.name);
      if (entry) await quickCopySvg(entry.name, copySpan);
      return;
    }
    const card = e.target.closest('.card');
    if (!card) return;
    const entry = icons.find(i => i.name === card.dataset.name);
    if (!entry) return;
    if (selectMode) toggleSelect(entry, card);
    else openDrawer(entry);
  });

  // ---------- select mode -----------------------------------------------
  els.selectToggle.addEventListener('click', () => {
    selectMode = !selectMode;
    document.body.classList.toggle('select-mode', selectMode);
    els.selectToggle.setAttribute('aria-pressed', selectMode);
    els.selectToggle.textContent = selectMode ? 'Done' : 'Select';
    if (!selectMode) {
      selected.clear();
      $$('.card.selected').forEach(c => c.classList.remove('selected'));
      els.selbar.classList.add('hidden');
    } else {
      els.selbar.classList.remove('hidden');
      updateSelbar();
    }
  });

  function toggleSelect(entry, card) {
    if (selected.has(entry.name)) { selected.delete(entry.name); card.classList.remove('selected'); }
    else { selected.add(entry.name); card.classList.add('selected'); }
    updateSelbar();
  }

  function updateSelbar() {
    els.selCount.textContent = selected.size;
    const filteredAllSelected = filtered.length > 0 && filtered.every(e => selected.has(e.name));
    const isFilterActive = filtered.length !== icons.length;
    els.selAll.textContent = isFilterActive
      ? (filteredAllSelected ? `Deselect visible (${filtered.length})` : `Select all visible (${filtered.length})`)
      : (filteredAllSelected ? 'Deselect all' : `Select all (${icons.length})`);
  }

  els.selAll.addEventListener('click', () => {
    const everySelected = filtered.length > 0 && filtered.every(e => selected.has(e.name));
    if (everySelected) filtered.forEach(e => selected.delete(e.name));
    else filtered.forEach(e => selected.add(e.name));
    $$('.card').forEach(c => c.classList.toggle('selected', selected.has(c.dataset.name)));
    updateSelbar();
  });

  els.selClear.addEventListener('click', () => {
    selected.clear();
    $$('.card.selected').forEach(c => c.classList.remove('selected'));
    updateSelbar();
  });

  // ---------- drawer ----------------------------------------------------
  function openDrawer(entry) {
    currentDetail = entry;
    refreshDrawer();
    els.drawer.classList.remove('hidden');
    els.drawer.setAttribute('aria-hidden', 'false');
  }
  function refreshDrawer() {
    if (!currentDetail) return;
    const e = currentDetail;
    els.drawerName.textContent = e.name;
    els.drawerCat.textContent = e.category;
    els.drawerSrc.textContent = e.source === 'groww-custom' ? 'Groww custom' : 'Hugeicons';
    els.drawerUni.textContent = `\\u${getUnicode(e).hex}`;
    els.drawerIcon.innerHTML = getSvg(e);
    if (els.drawerSingleVariant) els.drawerSingleVariant.classList.toggle('hidden', !e.singleVariant);

    // Keywords
    const kwEl     = document.getElementById('drawer-keywords');
    const kwSec    = document.getElementById('drawer-kw-section');
    const kwToggle = document.getElementById('kw-toggle');
    if (kwEl) {
      const kws = (e.tags || []).filter(t => t && t.trim());
      if (kws.length) {
        const shapes = ['■', '▲', '●'];
        kwEl.innerHTML = kws.map((t, i) =>
          `<span class="kw-tag" role="button" tabindex="0" data-kw="${t}" title="Copy keyword"><span class="kw-shape" aria-hidden="true">${shapes[i % 3]}</span>${t}</span>`
        ).join('');
        if (kwSec) kwSec.classList.remove('hidden');
        // Reset to collapsed whenever a new icon opens
        if (kwToggle) kwToggle.setAttribute('aria-expanded', 'false');
        kwEl.classList.add('hidden');
      } else {
        kwEl.innerHTML = '';
        if (kwSec) kwSec.classList.add('hidden');
      }
    }
  }
  function closeDrawer() {
    els.drawer.classList.add('hidden');
    els.drawer.setAttribute('aria-hidden', 'true');
    currentDetail = null;
  }
  els.drawerClose.addEventListener('click', closeDrawer);

  // Keywords toggle
  document.getElementById('kw-toggle')?.addEventListener('click', () => {
    const kwEl = document.getElementById('drawer-keywords');
    const btn  = document.getElementById('kw-toggle');
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    kwEl.classList.toggle('hidden', open);
  });

  document.getElementById('drawer-keywords')?.addEventListener('click', async e => {
    const tag = e.target.closest('[data-kw]');
    if (!tag) return;
    await quickCopySvg(tag.dataset.kw, tag);
  });

  // New Huge grid — copy name + open drawer
  els.nhGrid?.addEventListener('click', async e => {
    const copySpan = e.target.closest('[data-card-copy]');
    const card = e.target.closest('[data-nh-name]');
    if (!card) return;
    if (copySpan) {
      e.stopPropagation();
      await quickCopySvg(card.dataset.nhName, copySpan);
      return;
    }
    // Open drawer for new-huge icon
    const entry = nhIcons.find(i => i.name === card.dataset.nhName);
    if (!entry) return;
    currentDetail = { ...entry, _isNH: true };
    els.drawerName.textContent = entry.name;
    els.drawerCat.textContent = entry.category;
    els.drawerSrc.textContent = 'Hugeicons';
    els.drawerUni.textContent = '';
    if (els.drawerSingleVariant) els.drawerSingleVariant.classList.add('hidden');
    // Show icon via img
    els.drawerIcon.innerHTML = `<img src="${entry.svgPath}" alt="${entry.name}" width="80" height="80" style="display:block;margin:auto">`;
    // Keywords
    const kwEl  = document.getElementById('drawer-keywords');
    const kwSec = document.getElementById('drawer-kw-section');
    const kwToggle = document.getElementById('kw-toggle');
    if (kwEl && entry.tags?.length) {
      const shapes = ['■','▲','●'];
      kwEl.innerHTML = entry.tags.map((t,i) =>
        `<span class="kw-tag" role="button" tabindex="0" data-kw="${t}" title="Copy keyword"><span class="kw-shape" aria-hidden="true">${shapes[i%3]}</span>${t}</span>`
      ).join('');
      kwSec?.classList.remove('hidden');
      kwToggle?.setAttribute('aria-expanded','false');
      kwEl.classList.add('hidden');
    }
    // Hide copy/download sections not applicable to NH icons
    document.getElementById('font-links')?.closest('.drawer-section')?.classList.add('hidden');
    els.drawer.classList.remove('hidden');
    els.drawer.setAttribute('aria-hidden','false');
  });

  els.drawer.addEventListener('click', async e => {
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn && currentDetail) {
      const what = copyBtn.dataset.copy;
      let text = '';
      if (what === 'className') text = getClassName(currentDetail);
      else if (what === 'svg')   text = getSvg(currentDetail);
      else if (what === 'unicode') text = `\\u${getUnicode(currentDetail).hex}`;
      try { await navigator.clipboard.writeText(text); toast(`Copied ${what}`); }
      catch { toast('Copy failed'); }
      return;
    }
    const dlBtn = e.target.closest('[data-dl]');
    if (dlBtn && currentDetail) {
      const fmt = dlBtn.dataset.dl;
      const stamped = `${currentDetail.name}-${variant}`;
      if (fmt === 'svg') downloadFile(`${stamped}.svg`, getSvg(currentDetail), 'image/svg+xml');
      else if (fmt === 'json') {
        downloadFile(`${stamped}.json`, JSON.stringify(currentDetail, null, 2), 'application/json');
      } else if (fmt === 'png') svgToPngDownload(currentDetail);
    }
  });

  // ---------- bulk download ---------------------------------------------
  els.selbar.addEventListener('click', e => {
    const btn = e.target.closest('[data-bulk]');
    if (!btn) return;
    bulkZip(btn.dataset.bulk);
  });

  async function bulkZip(kind) {
    if (!selected.size) return;
    toast('Building zip…');
    const zip = new JSZip();
    const chosen = icons.filter(i => selected.has(i.name));

    if (kind === 'svg' || kind === 'all') {
      const r = zip.folder('svg/rounded');
      const s = zip.folder('svg/standard');
      for (const e of chosen) { r.file(`${e.name}.svg`, e.rounded.svg); s.file(`${e.name}.svg`, e.standard.svg); }
    }
    if (kind === 'json' || kind === 'all') {
      const subset = {
        generatedAt: new Date().toISOString(),
        fontFamilies: manifest.fontFamilies,
        classNamePrefixes: manifest.classNamePrefixes,
        total: chosen.length,
        icons: chosen,
      };
      zip.file('manifest.json', JSON.stringify(subset, null, 2));
    }
    if (kind === 'font' || kind === 'all') {
      const brandFontVariants = BRANDS[activeBrand].variant
        ? [BRANDS[activeBrand].variant]
        : ['rounded', 'standard'];
      for (const v of brandFontVariants) {
        const folder = zip.folder(`font/${v}`);
        for (const ext of FONT_FILES) {
          const buf = await fetch(`${FONT_PATH(v)}${ext}`).then(r => r.arrayBuffer());
          folder.file(`groww-huge-${v}${ext}`, buf);
        }
      }
      zip.file('font/README.txt',
`These fonts contain the FULL 452-icon library — both Rounded and Standard.
Reference an icon in markup with its CSS class name + the right family:

  <i class="gh-rounded-arrow-up-01"></i>     <!-- rounded -->
  <i class="gh-standard-arrow-up-01"></i>    <!-- standard -->

Selected icons in this download:
${chosen.map(c => '  ' + c.name).join('\n')}
`);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = `groww-huge-icons-v${manifest.version}-${chosen.length}-${kind}.zip`;
    downloadBlob(filename, blob);
    toast(`Downloaded ${chosen.length} icons`);
  }

  // ---------- download all ----------------------------------------------
  els.downloadAll.addEventListener('click', () => els.allDialog.showModal());
  els.allCancel.addEventListener('click', () => els.allDialog.close());
  els.allGo.addEventListener('click', async () => {
    const variants = $$('input[name="all-variant"]:checked').map(i => i.value);
    const formats  = $$('input[name="all-format"]:checked').map(i => i.value);
    els.allDialog.close();
    if (!variants.length || !formats.length) { toast('Pick at least one variant and format'); return; }
    toast('Building zip…');
    const zip = new JSZip();

    if (formats.includes('svg')) {
      for (const v of variants) {
        const folder = zip.folder(`svg/${v}`);
        for (const e of icons) folder.file(`${e.name}.svg`, e[v].svg);
      }
    }
    if (formats.includes('json')) {
      // Trim manifest to selected variants if user unchecked one
      const trimmed = JSON.parse(JSON.stringify(manifest));
      if (variants.length === 1) {
        trimmed.icons = trimmed.icons.map(e => {
          const out = { name: e.name, category: e.category, tags: e.tags, source: e.source };
          out[variants[0]] = e[variants[0]];
          return out;
        });
      }
      zip.file('manifest.json', JSON.stringify(trimmed, null, 2));
    }
    // For font/CSS downloads, use the brand's fixed variant if it has one
    // (Groww → standard, Wealth → rounded), otherwise use selected variants.
    const fontVariants = BRANDS[activeBrand].variant
      ? [BRANDS[activeBrand].variant]
      : variants;
    if (formats.includes('font')) {
      for (const v of fontVariants) {
        const folder = zip.folder(`font/${v}`);
        for (const ext of FONT_FILES.filter(x => x !== '.css')) {
          const buf = await fetch(`${FONT_PATH(v)}${ext}`).then(r => r.arrayBuffer());
          folder.file(`groww-huge-${v}${ext}`, buf);
        }
      }
    }
    if (formats.includes('css')) {
      for (const v of fontVariants) {
        const css = await fetch(`${FONT_PATH(v)}.css`).then(r => r.text());
        zip.file(`groww-huge-${v}.css`, css);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const tag = variants.length === 2 ? 'both-variants' : variants[0];
    downloadBlob(`groww-huge-icons-v${manifest.version}-full-${tag}.zip`, blob);
    toast(`Downloaded full library (${manifest.total} icons, ${tag})`);
  });

  // ---------- helpers ---------------------------------------------------
  function downloadFile(name, content, type) { downloadBlob(name, new Blob([content], { type })); }
  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function svgToPngDownload(entry, size = 256) {
    const svg = getSvg(entry).replace('<svg', `<svg width="${size}" height="${size}"`);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      c.toBlob(b => downloadBlob(`${entry.name}-${variant}.png`, b), 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    requestAnimationFrame(() => els.toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
      setTimeout(() => els.toast.classList.add('hidden'), 250);
    }, 1800);
  }

  function bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== els.search) {
        e.preventDefault(); els.search.focus();
      } else if (e.key === 'Escape') {
        if (illuViewer.root && !illuViewer.root.classList.contains('hidden')) closeIlluViewer();
        else if (!els.drawer.classList.contains('hidden')) closeDrawer();
        else if (els.allDialog.open) els.allDialog.close();
        else if (selectMode) els.selectToggle.click();
      }
    });
  }
})();
