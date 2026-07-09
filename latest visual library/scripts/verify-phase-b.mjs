import { createRequire } from 'node:module';

const require = createRequire(new URL('../../rive-animation-repo/package.json', import.meta.url));
const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  if (!window.name.includes('__phase_b_qa_storage_cleared__')) {
    localStorage.clear();
    indexedDB.deleteDatabase('rive-repo');
    window.name = `${window.name || ''}__phase_b_qa_storage_cleared__`;
  }
  window.__listenerAudit = {};
  const nativeAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
    const id = this && this.id;
    if (id) {
      const key = `${id}:${type}`;
      window.__listenerAudit[key] = (window.__listenerAudit[key] || 0) + 1;
    }
    return nativeAddEventListener.call(this, type, listener, options);
  };
});
const issues = [];
page.on('console', (msg) => { if (msg.type() === 'error') issues.push(msg.text()); });
page.on('pageerror', (err) => issues.push(err.message));
const isCriticalIssue = (issue) => ![
  /Failed to load resource: the server responded with a status of 404 \(File not found\)/,
  /Could not find a View Model linked to Artboard/,
].some((pattern) => pattern.test(issue));
const failures = [];
const assert = (condition, message, detail = null) => {
  if (condition) return;
  failures.push(detail ? `${message}: ${JSON.stringify(detail)}` : message);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForFrame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const interactiveAudit = async (scope, minSize = 36) => page.evaluate(({ scope, minSize }) => {
  const root = document.querySelector(scope);
  if (!root) return [{ issue: 'missing scope', scope }];
  const isVisible = (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight &&
      style.visibility !== 'hidden' &&
      style.display !== 'none';
  };
  return [...root.querySelectorAll('button,a,input:not([type="range"]),select,textarea,[role="button"],[role="tab"],[role="radio"]')]
    .filter(isVisible)
    .filter((node) => !node.disabled && node.getAttribute('aria-hidden') !== 'true')
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName.toLowerCase(),
        cls: String(node.className || '').split(/\s+/).filter(Boolean).slice(0, 4).join('.'),
        text: (node.innerText || node.getAttribute('aria-label') || node.getAttribute('title') || '').trim().slice(0, 80),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    })
    .filter((item) => item.width < minSize || item.height < minSize)
    .slice(0, 12);
}, { scope, minSize });
const layoutAudit = async (label) => {
  await waitForFrame();
  return page.evaluate((auditLabel) => {
    const root = document.scrollingElement || document.documentElement;
    const elements = [...document.body.querySelectorAll('*')];
    const offenders = elements
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || '',
          cls: String(node.className || '').split(/\s+/).filter(Boolean).slice(0, 4).join('.'),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          overflowX: style.overflowX,
        };
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > window.innerWidth + 1))
      .filter((item) => item.overflowX !== 'auto' && item.overflowX !== 'scroll')
      .slice(0, 8);
    const controls = document.querySelector('.rv-viewer-controls');
    return {
      label: auditLabel,
      width: window.innerWidth,
      scrollWidth: root.scrollWidth,
      overflow: root.scrollWidth - window.innerWidth,
      controlsOverflow: controls ? controls.scrollWidth - controls.clientWidth : 0,
      offenders,
    };
  }, label);
};

await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('#grid .card', { timeout: 30000 });
const untouchedTabs = await page.evaluate(() => ({
  initialSection: document.body.dataset.section,
  iconCards: document.querySelectorAll('#grid .card').length,
  iconCount: document.getElementById('count-icons')?.textContent,
  hasIconDrawer: Boolean(document.getElementById('drawer')),
  hasIllustrationPanel: Boolean(document.getElementById('panel-illustrations')),
}));
console.log('Icons baseline:', JSON.stringify(untouchedTabs, null, 2));
assert(untouchedTabs.initialSection === 'icons', 'Initial section should be icons', untouchedTabs);
assert(untouchedTabs.iconCards === 488, 'Icon grid should match original library count', untouchedTabs);
assert(untouchedTabs.iconCount === '488', 'Icon badge should match original library count', untouchedTabs);
const iconCardSemantics = await page.evaluate(() => {
  const first = document.querySelector('#grid .card');
  const copyControls = [...document.querySelectorAll('#grid .card .card-copy')].slice(0, 2);
  return {
    tag: first?.tagName.toLowerCase(),
    role: first?.getAttribute('role'),
    tabIndex: first?.getAttribute('tabindex'),
    copyTags: copyControls.map((node) => node.tagName.toLowerCase()),
    copyLabels: copyControls.map((node) => node.getAttribute('aria-label')),
  };
});
console.log('Icon card semantics:', JSON.stringify(iconCardSemantics, null, 2));
assert(iconCardSemantics.tag === 'div' && iconCardSemantics.role === 'button' && iconCardSemantics.tabIndex === '0', 'Icon cards should avoid nested interactive button markup', iconCardSemantics);
assert(iconCardSemantics.copyTags.every((tag) => tag === 'button') && iconCardSemantics.copyLabels.every(Boolean), 'Icon copy actions should be real labelled buttons', iconCardSemantics);
await page.focus('#grid .card');
await page.keyboard.press('Enter');
await sleep(200);
const keyboardDrawer = await page.evaluate(() => ({
  open: document.getElementById('drawer')?.getAttribute('aria-hidden') === 'false',
  name: document.getElementById('drawer-name')?.textContent?.trim(),
}));
assert(keyboardDrawer.open && keyboardDrawer.name, 'Keyboard Enter on an icon card should open the drawer', keyboardDrawer);
await page.keyboard.press('Escape');
await sleep(200);
const iconTargets = await interactiveAudit('#panel-icons', 36);
assert(iconTargets.length === 0, 'Visible icon controls should have usable desktop hit targets', iconTargets);
const themeBar = await page.evaluate(() => {
  const sections = document.querySelector('.sections')?.getBoundingClientRect();
  const theme = document.querySelector('.theme-bar')?.getBoundingClientRect();
  const search = document.querySelector('.search')?.getBoundingClientRect();
  const btn = document.getElementById('theme-toggle');
  return {
    exists: Boolean(btn),
    pressed: btn?.getAttribute('aria-pressed'),
    label: document.getElementById('theme-toggle-label')?.textContent?.trim(),
    actionLabel: btn?.getAttribute('aria-label'),
    afterSections: Boolean(sections && theme && theme.left >= sections.right - 1),
    beforeSearch: Boolean(theme && search && theme.right <= search.left + 1),
    buttonWidth: Math.round(btn?.getBoundingClientRect().width || 0),
    buttonHeight: Math.round(btn?.getBoundingClientRect().height || 0),
  };
});
console.log('Theme bar:', JSON.stringify(themeBar, null, 2));
assert(themeBar.exists, 'Universal theme toggle should exist in the topbar', themeBar);
assert(themeBar.afterSections && themeBar.beforeSearch, 'Theme toggle bar should sit between section tabs and search on desktop', themeBar);
assert(themeBar.buttonWidth >= 36 && themeBar.buttonHeight >= 36, 'Theme toggle should expose a usable hit target', themeBar);

await page.click('[data-section="illustrations"]');
await sleep(1500);
const illustrations = await page.evaluate(() => ({
  section: document.body.dataset.section,
  panelHidden: document.getElementById('panel-illustrations')?.classList.contains('hidden'),
  count: document.getElementById('count-illustrations')?.textContent,
  emptyVisible: !document.getElementById('illu-empty')?.classList.contains('hidden'),
  cards: document.querySelectorAll('#illu-grid .card-illu').length,
}));
console.log('Illustrations baseline:', JSON.stringify(illustrations, null, 2));
assert(illustrations.section === 'illustrations', 'Illustrations tab should become active', illustrations);
assert(illustrations.panelHidden === false, 'Illustrations panel should be visible', illustrations);
assert(illustrations.count === '148', 'Illustration badge should match original library count', illustrations);
assert(illustrations.cards > 0, 'Illustration grid should not be empty', illustrations);
const illustrationSemantics = await page.evaluate(() => {
  const firstThumb = document.querySelector('#illu-grid .illu-thumb-wrap');
  const copy = document.querySelector('#illu-grid [data-illu-copy]');
  return {
    thumbTag: firstThumb?.tagName.toLowerCase(),
    thumbLabel: firstThumb?.getAttribute('aria-label'),
    copyTag: copy?.tagName.toLowerCase(),
    copyLabel: copy?.getAttribute('aria-label'),
  };
});
console.log('Illustration semantics:', JSON.stringify(illustrationSemantics, null, 2));
assert(illustrationSemantics.thumbTag === 'button' && illustrationSemantics.thumbLabel, 'Illustration previews should be keyboard-reachable buttons', illustrationSemantics);
assert(illustrationSemantics.copyTag === 'button' && illustrationSemantics.copyLabel, 'Illustration copy action should be a labelled button', illustrationSemantics);
const illustrationTargets = await interactiveAudit('#panel-illustrations', 36);
assert(illustrationTargets.length === 0, 'Visible illustration controls should have usable desktop hit targets', illustrationTargets);

await page.evaluate(() => window.GrowwVisualTheme?.set('light'));
await sleep(150);
await page.click('#theme-toggle');
await sleep(350);
const illustrationModeDark = await page.evaluate(() => {
  const light = document.querySelector('#illu-grid .card-illu .illu-thumb-light');
  const dark = document.querySelector('#illu-grid .card-illu .illu-thumb-dark');
  const btn = document.getElementById('theme-toggle');
  return {
    htmlDark: document.documentElement.classList.contains('dark'),
    mode: document.getElementById('illu-grid')?.dataset.mode,
    pressed: btn?.getAttribute('aria-pressed'),
    label: document.getElementById('theme-toggle-label')?.textContent?.trim(),
    actionLabel: btn?.getAttribute('aria-label'),
    storedTheme: localStorage.getItem('rive-theme'),
    storedIllu: localStorage.getItem('gh.illuMode'),
    lightOpacity: light ? getComputedStyle(light).opacity : null,
    darkOpacity: dark ? getComputedStyle(dark).opacity : null,
  };
});
console.log('Illustration mode dark:', JSON.stringify(illustrationModeDark, null, 2));
assert(illustrationModeDark.htmlDark && illustrationModeDark.mode === 'dark', 'Universal theme switch should set site and illustration mode to dark', illustrationModeDark);
assert(illustrationModeDark.pressed === 'true' && illustrationModeDark.label === 'Dark' && /light/i.test(illustrationModeDark.actionLabel || ''), 'Universal theme switch should sync accessible button state for dark mode', illustrationModeDark);
assert(illustrationModeDark.storedTheme === 'dark' && illustrationModeDark.storedIllu === 'dark', 'Universal theme switch should persist canonical and legacy theme keys', illustrationModeDark);
assert(illustrationModeDark.lightOpacity === '0' && illustrationModeDark.darkOpacity === '1', 'Universal theme switch should visibly show dark illustration assets', illustrationModeDark);

await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('#illu-grid .card-illu', { timeout: 30000 });
const illustrationModePersisted = await page.evaluate(() => ({
  section: document.body.dataset.section,
  htmlDark: document.documentElement.classList.contains('dark'),
  mode: document.getElementById('illu-grid')?.dataset.mode,
  pressed: document.getElementById('theme-toggle')?.getAttribute('aria-pressed'),
  label: document.getElementById('theme-toggle-label')?.textContent?.trim(),
}));
console.log('Illustration mode persisted:', JSON.stringify(illustrationModePersisted, null, 2));
assert(illustrationModePersisted.section === 'illustrations', 'Illustrations tab should persist across reload before animation checks', illustrationModePersisted);
assert(illustrationModePersisted.htmlDark && illustrationModePersisted.mode === 'dark' && illustrationModePersisted.pressed === 'true' && illustrationModePersisted.label === 'Dark', 'Universal dark mode should persist across reload', illustrationModePersisted);

await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.click('[data-section="animation"]');
await sleep(6000);

const state = await page.evaluate(() => ({
  section: document.body.dataset.section,
  tiles: document.querySelectorAll('#rv-grid .rv-tile').length,
  names: [...document.querySelectorAll('#rv-grid .rv-tile-name')].map((n) => n.textContent.trim()),
  count: document.getElementById('count-animation')?.textContent,
  counter: document.getElementById('counter')?.textContent,
  panelHidden: document.getElementById('panel-animation')?.classList.contains('hidden'),
  legacyCards: document.querySelectorAll('#anim-grid .card-anim').length,
  hasUpload: Boolean(document.getElementById('rv-upload-btn')),
  conventionsHref: document.querySelector('#panel-animation a[href="conventions.html"]')?.getAttribute('href') || null,
}));
console.log('Animation tab:', JSON.stringify(state, null, 2));
assert(state.section === 'animation', 'Animation tab should become active', state);
assert(state.tiles >= 8, 'Animation tab should render the Rive repository tiles', state);
assert(state.names[0] === 'mds_rive_gtmstory_1_stocks_technicals', 'Seeded animation order should follow animations.json deterministically', state.names);
assert(state.legacyCards === 0, 'Legacy animation cards should not render', state);
assert(state.hasUpload, 'Animation tab should expose upload control', state);
assert(state.conventionsHref === 'conventions.html', 'Animation tab should link conventions page', state);
const animationTargets = await interactiveAudit('#panel-animation', 36);
assert(animationTargets.length === 0, 'Visible animation controls should have usable desktop hit targets', animationTargets);
const animationTileLayout = await page.evaluate(() => {
  const grid = document.getElementById('rv-grid');
  const tile = grid?.querySelector('.rv-tile');
  const preview = tile?.querySelector('.rv-tile-preview');
  const previewInner = tile?.querySelector('.rv-tile-preview-inner');
  const foot = tile?.querySelector('.rv-tile-foot');
  const gridStyle = grid ? getComputedStyle(grid) : null;
  const previewInnerStyle = previewInner ? getComputedStyle(previewInner) : null;
  const tileRect = tile?.getBoundingClientRect();
  const previewRect = preview?.getBoundingClientRect();
  const footRect = foot?.getBoundingClientRect();
  return {
    columns: gridStyle?.gridTemplateColumns?.split(' ').filter(Boolean).length || 0,
    tileWidth: Math.round(tileRect?.width || 0),
    previewHeight: Math.round(previewRect?.height || 0),
    previewInset: Number.parseFloat(previewInnerStyle?.paddingTop || '999'),
    previewRatio: previewRect?.height ? Number((previewRect.width / previewRect.height).toFixed(2)) : 0,
    footerHeight: Math.round(footRect?.height || 0),
  };
});
console.log('Animation tile layout:', JSON.stringify(animationTileLayout, null, 2));
assert(animationTileLayout.columns === 3, 'Desktop animation grid should render exactly three larger tiles per row', animationTileLayout);
assert(animationTileLayout.previewInset === 0, 'Animation tile previews should render edge-to-edge without inner padding', animationTileLayout);
assert(animationTileLayout.tileWidth >= 360 && animationTileLayout.previewHeight >= 240, 'Animation tiles should have a larger preview surface', animationTileLayout);
assert(animationTileLayout.previewRatio >= 1.4 && animationTileLayout.previewRatio <= 1.5, 'Animation preview ratio should stay balanced for Rive content', animationTileLayout);

const listenerAuditBefore = await page.evaluate(() => window.__listenerAudit?.['rv-upload:click'] || 0);
await page.evaluate(async () => {
  const mod = await import('./rive-section.js?v=phase-b-universal-theme-1');
  await mod.initRiveSection({});
});
await sleep(300);
const listenerAuditAfter = await page.evaluate(() => window.__listenerAudit?.['rv-upload:click'] || 0);
console.log('Rive init listener audit:', JSON.stringify({ before: listenerAuditBefore, after: listenerAuditAfter }, null, 2));
assert(listenerAuditAfter === listenerAuditBefore, 'Rive section init should be idempotent and avoid duplicate upload listeners', { before: listenerAuditBefore, after: listenerAuditAfter });

await page.click('#search');
await page.keyboard.type('checkbox');
await sleep(600);
const searchState = await page.evaluate(() => ({
  tiles: document.querySelectorAll('#rv-grid .rv-tile').length,
  names: [...document.querySelectorAll('#rv-grid .rv-tile-name')].map((n) => n.textContent.trim()),
}));
console.log('Animation search:', JSON.stringify(searchState, null, 2));
assert(searchState.tiles === 1, 'Animation search should filter to one checkbox result', searchState);
assert(/checkbox/i.test(searchState.names[0] || ''), 'Animation search result should be the checkbox asset', searchState);
await page.keyboard.press('Meta+A').catch(() => {});
await page.keyboard.press('Backspace').catch(() => {});

await page.click('#rv-upload-btn');
await sleep(300);
const upload = await page.evaluate(() => ({
  open: !document.getElementById('rv-upload')?.classList.contains('hidden'),
  bodyOverflow: document.body.style.overflow,
  body: document.getElementById('rv-upload-body')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120),
}));
console.log('Upload modal:', JSON.stringify(upload, null, 2));
assert(upload.open, 'Upload modal should open', upload);
assert(upload.bodyOverflow === 'hidden', 'Upload modal should lock background scroll', upload);
await page.keyboard.press('Escape');
await sleep(200);
const uploadClosed = await page.evaluate(() => ({
  open: !document.getElementById('rv-upload')?.classList.contains('hidden'),
  bodyOverflow: document.body.style.overflow,
}));
assert(!uploadClosed.open && uploadClosed.bodyOverflow === '', 'Upload modal should close and restore background scroll on Escape', uploadClosed);

await page.click('#rv-grid .rv-tile');
await sleep(2500);
const viewer = await page.evaluate(() => ({
  open: !document.getElementById('rv-viewer')?.classList.contains('hidden'),
  meta: document.querySelectorAll('#rv-viewer-side .rv-meta-sec').length,
  bodyOverflow: document.body.style.overflow,
}));
console.log('Viewer:', JSON.stringify(viewer, null, 2));
assert(viewer.open, 'Viewer should open from an animation tile', viewer);
assert(viewer.meta >= 1, 'Viewer should render detected metadata sections', viewer);
assert(viewer.bodyOverflow === 'hidden', 'Viewer should lock background scroll', viewer);
await page.keyboard.press('Escape');
await sleep(200);
const viewerClosed = await page.evaluate(() => ({
  open: !document.getElementById('rv-viewer')?.classList.contains('hidden'),
  bodyOverflow: document.body.style.overflow,
}));
assert(!viewerClosed.open && viewerClosed.bodyOverflow === '', 'Viewer should close and restore background scroll on Escape', viewerClosed);

await page.evaluate(() => {
  localStorage.setItem('gh.section', 'icons');
  localStorage.setItem('rive-theme', 'light');
  localStorage.setItem('gh.illuMode', 'light');
});
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
await page.goto(`${BASE}/?qa=mobile`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('#grid .card', { timeout: 30000 });
const mobileIcons = await layoutAudit('mobile-icons');
console.log('Mobile icons layout:', JSON.stringify(mobileIcons, null, 2));
assert(mobileIcons.overflow <= 1, 'Mobile icons layout should not horizontally overflow', mobileIcons);
const mobileIconTargets = await interactiveAudit('#panel-icons', 44);
assert(mobileIconTargets.length === 0, 'Mobile icon controls should meet touch target sizing', mobileIconTargets);
await page.click('[data-section="illustrations"]');
await sleep(1200);
const mobileIllustrations = await layoutAudit('mobile-illustrations');
console.log('Mobile illustrations layout:', JSON.stringify(mobileIllustrations, null, 2));
assert(mobileIllustrations.overflow <= 1, 'Mobile illustrations layout should not horizontally overflow', mobileIllustrations);
const mobileIllustrationTargets = await interactiveAudit('#panel-illustrations', 44);
assert(mobileIllustrationTargets.length === 0, 'Mobile illustration controls should meet touch target sizing', mobileIllustrationTargets);
await page.click('[data-section="animation"]');
await sleep(6000);
const mobileAnimation = await layoutAudit('mobile-animation');
console.log('Mobile animation layout:', JSON.stringify(mobileAnimation, null, 2));
assert(mobileAnimation.overflow <= 1, 'Mobile animation layout should not horizontally overflow', mobileAnimation);
const mobileAnimationTargets = await interactiveAudit('#panel-animation', 44);
assert(mobileAnimationTargets.length === 0, 'Mobile animation controls should meet touch target sizing', mobileAnimationTargets);
await page.click('#rv-filter-btn');
await sleep(300);
const mobileFilter = await layoutAudit('mobile-filter');
console.log('Mobile filter layout:', JSON.stringify(mobileFilter, null, 2));
assert(mobileFilter.overflow <= 1, 'Mobile filter panel should stay inside the viewport', mobileFilter);
await page.keyboard.press('Escape');
await sleep(200);
await page.click('#rv-grid .rv-tile');
await sleep(2500);
const mobileViewer = await layoutAudit('mobile-viewer');
console.log('Mobile viewer layout:', JSON.stringify(mobileViewer, null, 2));
assert(mobileViewer.overflow <= 1, 'Mobile viewer should not horizontally overflow', mobileViewer);
assert(mobileViewer.controlsOverflow <= 1, 'Mobile viewer controls should wrap without internal horizontal overflow', mobileViewer);

await page.goto(`${BASE}/conventions.html`, { waitUntil: 'networkidle2', timeout: 60000 });
const conventions = await page.evaluate(() => ({
  title: document.title,
  heading: document.querySelector('h1')?.textContent?.trim() || '',
  sections: document.querySelectorAll('main section').length,
}));
console.log('Conventions:', JSON.stringify(conventions, null, 2));
assert(/Naming conventions/i.test(conventions.title), 'Conventions page should have the expected title', conventions);
assert(/Naming conventions/i.test(conventions.heading), 'Conventions page should have the expected heading', conventions);
assert(conventions.sections >= 8, 'Conventions page should render all guidance sections', conventions);

const criticalIssues = issues.filter(isCriticalIssue);
console.log('Errors:', criticalIssues.length ? criticalIssues.slice(0, 5).join('\n') : '(none critical)');
criticalIssues.forEach((issue) => failures.push(`Console/page error: ${issue}`));
await browser.close();
if (failures.length) {
  console.error('Failures:\n' + failures.map((f) => `- ${f}`).join('\n'));
}
process.exit(failures.length ? 1 : 0);
