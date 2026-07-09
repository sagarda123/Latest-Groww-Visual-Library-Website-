import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../rive-animation-repo/package.json', import.meta.url));
const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'http://localhost:8081';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORTS = [
  { label: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  { label: 'tablet', width: 768, height: 1024, deviceScaleFactor: 1 },
  { label: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1 },
  { label: 'wide', width: 1440, height: 1000, deviceScaleFactor: 1 },
];

const issues = [];
const runtimeEvents = [];

function addIssue(severity, area, title, detail = null) {
  issues.push({ severity, area, title, detail });
}

function addEvent(type, detail) {
  runtimeEvents.push({ type, detail });
}

function isCriticalConsole(text) {
  return ![
    /Failed to load resource: the server responded with a status of 404 \(File not found\)/,
    /Could not find a View Model linked to Artboard/,
  ].some((pattern) => pattern.test(text));
}

function printReport() {
  const order = ['P0', 'P1', 'P2', 'P3'];
  const grouped = Object.fromEntries(order.map((severity) => [severity, issues.filter((issue) => issue.severity === severity)]));
  const summary = Object.fromEntries(order.map((severity) => [severity, grouped[severity].length]));
  console.log('\nDeep site audit summary:', JSON.stringify(summary));
  for (const severity of order) {
    console.log(`\n${severity}`);
    if (!grouped[severity].length) {
      console.log('  none');
      continue;
    }
    grouped[severity].forEach((issue, index) => {
      console.log(`  ${index + 1}. [${issue.area}] ${issue.title}`);
      if (issue.detail) console.log(`     ${JSON.stringify(issue.detail).slice(0, 1200)}`);
    });
  }
  if (runtimeEvents.length) {
    console.log('\nRuntime observations:', JSON.stringify(runtimeEvents.slice(0, 20), null, 2));
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function selectAllAndClear(page) {
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.down(modifier);
  await page.keyboard.press('KeyA');
  await page.keyboard.up(modifier);
  await page.keyboard.press('Backspace');
}

async function installPageInstrumentation(page) {
  await page.evaluateOnNewDocument(() => {
    if (!window.name.includes('__deep_audit_storage_cleared__')) {
      try { localStorage.clear(); } catch (_) {}
      try { indexedDB.deleteDatabase('rive-repo'); } catch (_) {}
      window.name = `${window.name || ''}__deep_audit_storage_cleared__`;
    }
    window.__listenerAudit = {};
    window.__deepAuditDownloads = [];
    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
      const id = this && this.id;
      if (id) {
        const key = `${id}:${type}`;
        window.__listenerAudit[key] = (window.__listenerAudit[key] || 0) + 1;
      }
      return nativeAddEventListener.call(this, type, listener, options);
    };
    const nativeClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedAnchorClick() {
      if (this.download) {
        window.__deepAuditDownloads.push({ href: this.href, download: this.download });
      }
      return nativeClick.call(this);
    };
  });
}

function hookRuntimeEvents(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' && isCriticalConsole(msg.text())) {
      addIssue('P1', 'runtime', 'Critical console error', msg.text());
    }
  });
  page.on('pageerror', (error) => addIssue('P1', 'runtime', 'Unhandled page error', error.message));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (/^data:/.test(url)) return;
    addIssue('P1', 'network', 'Request failed', { url, reason: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !/favicon\.ico$/.test(url)) {
      addIssue(status >= 500 ? 'P1' : 'P2', 'network', `HTTP ${status}`, url);
    }
  });
}

async function evaluateAudit(page, fn, arg) {
  return page.evaluate(fn, arg);
}

async function layoutAudit(page, label) {
  return evaluateAudit(page, (auditLabel) => {
    const root = document.scrollingElement || document.documentElement;
    const isInHiddenTree = (node) => Boolean(node.closest?.('.hidden,[aria-hidden="true"]'));
    const hasScrollableAncestor = (node) => {
      for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') return true;
      }
      return false;
    };
    const offenders = [...document.body.querySelectorAll('*')]
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
          hidden: isInHiddenTree(node),
          scrollContained: hasScrollableAncestor(node),
        };
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > window.innerWidth + 1))
      .filter((item) => !item.hidden)
      .filter((item) => !item.scrollContained)
      .filter((item) => item.overflowX !== 'auto' && item.overflowX !== 'scroll')
      .slice(0, 12);
    return {
      label: auditLabel,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: root.scrollWidth,
      overflow: root.scrollWidth - window.innerWidth,
      offenders,
    };
  }, label);
}

async function interactiveAudit(page, scope, minSize) {
  return evaluateAudit(page, ({ scope, minSize }) => {
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
        const name = (node.innerText || node.getAttribute('aria-label') || node.getAttribute('title') || '').trim();
        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || '',
          cls: String(node.className || '').split(/\s+/).filter(Boolean).slice(0, 4).join('.'),
          name,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          labelMissing: !name && !node.getAttribute('aria-label'),
          tabIndex: node.getAttribute('tabindex'),
        };
      })
      .filter((item) => item.width < minSize || item.height < minSize || item.labelMissing)
      .slice(0, 20);
  }, { scope, minSize });
}

async function textClipAudit(page, scope) {
  return evaluateAudit(page, (auditScope) => {
    const root = document.querySelector(auditScope);
    if (!root) return [{ issue: 'missing scope', scope: auditScope }];
    return [...root.querySelectorAll('button,a,.card-name,.name,.rv-tile-name,.brand-title,.brand-sub,.rv-detail-row span:last-child')]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((node) => ({
        tag: node.tagName.toLowerCase(),
        id: node.id || '',
        cls: String(node.className || '').split(/\s+/).filter(Boolean).slice(0, 4).join('.'),
        text: (node.textContent || '').trim().slice(0, 80),
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
        overflowX: getComputedStyle(node).overflowX,
        overflowY: getComputedStyle(node).overflowY,
      }))
      .filter((item) => (item.scrollWidth - item.clientWidth > 2 && item.overflowX !== 'hidden') ||
        (item.scrollHeight - item.clientHeight > 2 && item.overflowY !== 'hidden'))
      .slice(0, 20);
  }, scope);
}

async function assertTopbar(page) {
  const state = await evaluateAudit(page, () => ({
    section: document.body.dataset.section,
    iconCount: document.getElementById('count-icons')?.textContent,
    illustrationCount: document.getElementById('count-illustrations')?.textContent,
    animationCount: document.getElementById('count-animation')?.textContent,
    themeLabel: document.getElementById('theme-toggle-label')?.textContent?.trim(),
    searchPlaceholder: document.getElementById('search')?.getAttribute('placeholder'),
  }));
  if (state.iconCount !== '488') addIssue('P1', 'icons', 'Groww icon count changed from deployed library', state);
  if (state.illustrationCount !== '148') addIssue('P1', 'illustrations', 'Illustration count changed from deployed library', state);
  if (!state.themeLabel) addIssue('P1', 'theme', 'Theme toggle is missing a visible label', state);
}

async function selectSection(page, section) {
  await page.click(`[data-section="${section}"]`);
  await wait(section === 'animation' ? 4500 : 700);
}

async function auditBrands(page) {
  for (const brand of ['wealth', 'prime', 'groww']) {
    await page.click('#brand-btn');
    await page.click(`.brand-opt[data-brand="${brand}"]`);
    await wait(900);
    const state = await evaluateAudit(page, (expectedBrand) => ({
      selected: [...document.querySelectorAll('.brand-opt')].find((node) => node.getAttribute('aria-selected') === 'true')?.dataset.brand,
      title: document.getElementById('brand-title')?.textContent?.trim(),
      section: document.body.dataset.section,
      drawerOpen: document.getElementById('drawer')?.getAttribute('aria-hidden') === 'false',
      icons: document.querySelectorAll('#grid .card').length,
      emptyVisible: !document.getElementById('empty')?.classList.contains('hidden'),
      expectedBrand,
    }), brand);
    if (state.selected !== brand) addIssue('P1', 'brand', 'Brand option did not become selected', state);
    if (!state.title?.toLowerCase().includes(brand === 'groww' ? 'groww' : brand)) addIssue('P2', 'brand', 'Brand title did not sync with selected brand', state);
    if (state.drawerOpen) addIssue('P1', 'brand', 'Icon drawer stayed open after brand switch', state);
  }
}

async function auditIcons(page) {
  await selectSection(page, 'icons');
  await page.waitForSelector('#grid .card', { timeout: 30000 });
  await page.focus('#search');
  await page.keyboard.type('bank');
  await wait(300);
  const searchState = await evaluateAudit(page, () => ({
    cards: document.querySelectorAll('#grid .card').length,
    query: document.getElementById('search')?.value,
  }));
  if (searchState.cards <= 0) addIssue('P1', 'icons', 'Icon search returned no results for a common term', searchState);
  await selectAllAndClear(page);
  await wait(200);
  await page.focus('#grid .card');
  await page.keyboard.press('Enter');
  await wait(200);
  const drawer = await evaluateAudit(page, () => ({
    open: document.getElementById('drawer')?.getAttribute('aria-hidden') === 'false',
    name: document.getElementById('drawer-name')?.textContent?.trim(),
    bodyOverflow: document.body.style.overflow,
  }));
  if (!drawer.open || !drawer.name) addIssue('P1', 'icons', 'Keyboard activation did not open icon drawer', drawer);
  await page.keyboard.press('Escape');
  await wait(200);
  const drawerClosed = await evaluateAudit(page, () => ({
    open: document.getElementById('drawer')?.getAttribute('aria-hidden') === 'false',
    bodyOverflow: document.body.style.overflow,
  }));
  if (drawerClosed.open || drawerClosed.bodyOverflow) addIssue('P1', 'icons', 'Icon drawer did not close cleanly on Escape', drawerClosed);

  await page.click('#icon-subview-dropdown-btn');
  await page.click('#icon-subview-dropdown [data-subview]');
  await wait(250);
  const newHuge = await evaluateAudit(page, () => ({
    viewHidden: document.getElementById('view-new-huge')?.classList.contains('hidden'),
    emptyState: !document.getElementById('nh-empty-state')?.classList.contains('hidden'),
    counter: document.getElementById('counter')?.textContent?.trim(),
  }));
  if (newHuge.viewHidden) addIssue('P1', 'icons', 'New Huge subview did not become visible', newHuge);
  await page.click('#icon-subview-dropdown-btn');
  await page.click('#icon-subview-dropdown [data-subview]');
  await wait(250);
}

async function auditIllustrations(page) {
  await selectSection(page, 'illustrations');
  await page.waitForSelector('#illu-grid .card-illu', { timeout: 30000 });
  for (const cat of ['hero', 'spot-hero', 'illustrated-icons']) {
    await page.click(`[data-illu-cat="${cat}"]`);
    await wait(500);
    const state = await evaluateAudit(page, (expectedCat) => ({
      cards: document.querySelectorAll('#illu-grid .card-illu').length,
      active: document.querySelector(`[data-illu-cat="${expectedCat}"]`)?.getAttribute('aria-pressed'),
      firstCat: document.querySelector('#illu-grid .card-illu')?.dataset.illuCat,
    }), cat);
    if (state.active !== 'true' || state.cards <= 0) addIssue('P1', 'illustrations', 'Illustration category did not render results', { cat, state });
  }
  await page.click('[data-illu-cat="hero"]');
  await wait(300);
  await page.click('#illu-grid .illu-thumb-wrap');
  await wait(300);
  const viewer = await evaluateAudit(page, () => ({
    open: document.getElementById('illu-viewer')?.getAttribute('aria-hidden') === 'false',
    name: document.getElementById('illu-viewer-name')?.textContent?.trim(),
    bodyOverflow: document.body.style.overflow,
  }));
  if (!viewer.open || !viewer.name || viewer.bodyOverflow !== 'hidden') addIssue('P1', 'illustrations', 'Illustration viewer did not open with scroll lock', viewer);
  await page.keyboard.press('Escape');
  await wait(200);
  const viewerAfterEsc = await evaluateAudit(page, () => ({
    open: document.getElementById('illu-viewer')?.getAttribute('aria-hidden') === 'false',
    bodyOverflow: document.body.style.overflow,
  }));
  if (viewerAfterEsc.open || viewerAfterEsc.bodyOverflow) addIssue('P1', 'illustrations', 'Illustration viewer did not close cleanly on Escape', viewerAfterEsc);
}

async function auditAnimation(page) {
  await selectSection(page, 'animation');
  await page.waitForSelector('#rv-grid .rv-tile', { timeout: 30000 });
  const before = await evaluateAudit(page, () => window.__listenerAudit?.['rv-upload:click'] || 0);
  await evaluateAudit(page, async () => {
    const mod = await import('./rive-section.js?v=deep-audit-idempotency');
    await mod.initRiveSection({});
  });
  await wait(300);
  const after = await evaluateAudit(page, () => window.__listenerAudit?.['rv-upload:click'] || 0);
  if (after !== before) addIssue('P1', 'animation', 'Rive upload backdrop listener is not idempotent', { before, after });

  await page.focus('#search');
  await page.keyboard.type('checkbox');
  await wait(700);
  const searchState = await evaluateAudit(page, () => ({
    tiles: document.querySelectorAll('#rv-grid .rv-tile').length,
    names: [...document.querySelectorAll('#rv-grid .rv-tile-name')].map((node) => node.textContent.trim()),
  }));
  if (searchState.tiles !== 1 || !/checkbox/i.test(searchState.names[0] || '')) addIssue('P1', 'animation', 'Animation search did not narrow to checkbox sample', searchState);
  await selectAllAndClear(page);
  await wait(500);

  await page.click('#rv-upload-btn');
  await wait(250);
  const upload = await evaluateAudit(page, () => ({
    open: document.getElementById('rv-upload')?.getAttribute('aria-hidden') === 'false',
    bodyOverflow: document.body.style.overflow,
  }));
  if (!upload.open || upload.bodyOverflow !== 'hidden') addIssue('P1', 'animation', 'Upload modal did not open with scroll lock', upload);
  await page.keyboard.press('Escape');
  await wait(200);
  const uploadClosed = await evaluateAudit(page, () => ({
    open: document.getElementById('rv-upload')?.getAttribute('aria-hidden') === 'false',
    bodyOverflow: document.body.style.overflow,
  }));
  if (uploadClosed.open || uploadClosed.bodyOverflow) addIssue('P1', 'animation', 'Upload modal did not close cleanly on Escape', uploadClosed);

  await page.click('#rv-grid .rv-tile');
  await wait(2500);
  const viewer = await evaluateAudit(page, () => ({
    open: document.getElementById('rv-viewer')?.getAttribute('aria-hidden') === 'false',
    metaSections: document.querySelectorAll('#rv-viewer-side .rv-meta-sec').length,
    bodyOverflow: document.body.style.overflow,
  }));
  if (!viewer.open || viewer.metaSections < 1 || viewer.bodyOverflow !== 'hidden') addIssue('P1', 'animation', 'Animation viewer did not open with metadata and scroll lock', viewer);
  await page.keyboard.press('Escape');
  await wait(200);
}

async function auditResponsive(page) {
  for (const viewport of VIEWPORTS) {
    await page.setViewport(viewport);
    await page.goto(`${BASE}/?audit=${viewport.label}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#grid .card', { timeout: 30000 });
    for (const section of ['icons', 'illustrations', 'animation']) {
      await selectSection(page, section);
      const layout = await layoutAudit(page, `${viewport.label}-${section}`);
      if (layout.overflow > 1) addIssue('P1', 'layout', 'Viewport has horizontal overflow', layout);
      if (layout.offenders.length) addIssue('P2', 'layout', 'Visible elements extend beyond viewport', layout);
      const minSize = viewport.width < 768 ? 44 : 36;
      const scope = section === 'icons' ? '#panel-icons' : section === 'illustrations' ? '#panel-illustrations' : '#panel-animation';
      const targetIssues = await interactiveAudit(page, scope, minSize);
      if (targetIssues.length) addIssue(viewport.width < 768 ? 'P1' : 'P2', 'accessibility', 'Visible interactive controls have missing labels or undersized hit areas', { label: `${viewport.label}-${section}`, issues: targetIssues });
      const clipIssues = await textClipAudit(page, scope);
      if (clipIssues.length) addIssue('P2', 'layout', 'Text may clip or overflow unexpectedly', { label: `${viewport.label}-${section}`, issues: clipIssues });
    }
  }
}

async function auditConventions(page) {
  await page.goto(`${BASE}/conventions.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  const state = await evaluateAudit(page, () => ({
    title: document.title,
    heading: document.querySelector('h1')?.textContent?.trim(),
    sections: document.querySelectorAll('main section').length,
    themeButton: Boolean(document.getElementById('cv-theme')),
    copyables: document.querySelectorAll('code, .cv-token').length,
  }));
  if (!/Naming conventions/i.test(state.title || '') || !/Naming conventions/i.test(state.heading || '')) addIssue('P1', 'conventions', 'Conventions page identity is broken', state);
  if (state.sections < 8) addIssue('P1', 'conventions', 'Conventions page is missing guidance sections', state);
  if (!state.themeButton || state.copyables < 10) addIssue('P2', 'conventions', 'Conventions utility controls look incomplete', state);
  for (const viewport of VIEWPORTS) {
    await page.setViewport(viewport);
    await wait(200);
    const layout = await layoutAudit(page, `conventions-${viewport.label}`);
    if (layout.overflow > 1) addIssue('P1', 'conventions', 'Conventions page has horizontal overflow', layout);
  }
}

function auditStaticCode() {
  const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const riveSection = fs.readFileSync(new URL('../rive-section.js', import.meta.url), 'utf8');
  const conventions = fs.readFileSync(new URL('../conventions.html', import.meta.url), 'utf8');

  const legacySelectors = ['.card-anim', '.anim-preview', '.anim-canvas', '.anim-download', '.anim-badge'];
  const legacyPresent = legacySelectors.filter((selector) => styles.includes(selector));
  if (legacyPresent.length) {
    addIssue('P3', 'cleanup', 'Legacy animation CSS remains after native Rive grid migration', legacyPresent);
  }

  const source = `${index}\n${app}\n${riveSection}\n${conventions}`;
  const remoteScripts = [...index.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((match) => match[1]);
  const unpinned = remoteScripts.filter((url) => /^https?:/.test(url) && !/@\d|\d+\.\d+\.\d+/.test(url));
  if (unpinned.length) addIssue('P2', 'security', 'Remote scripts should be version-pinned', unpinned);
  if (remoteScripts.length) addIssue('P3', 'dependency', 'Runtime depends on remote CDN scripts; keep pinned or vendor later for offline builds', remoteScripts);

  const dangerousEval = /\beval\s*\(|new Function\s*\(/.test(source);
  if (dangerousEval) addIssue('P1', 'security', 'CWE-95: dynamic code execution found', 'Remove eval/new Function usage');

  const hardcodedColorMatches = styles
    .split('\n')
    .filter((line) => !line.trim().startsWith('--') && !line.includes('data:image'))
    .flatMap((line) => [...line.matchAll(/#[0-9A-Fa-f]{3,8}|rgba?\([^)]*\)/g)].map((match) => match[0]));
  const hardcodedColors = hardcodedColorMatches.filter((color) => ![
    '#fff', '#ffffff', 'rgba(0,0,0,.3)', 'rgba(0, 0, 0, 0)',
  ].includes(color.toLowerCase()));
  if (hardcodedColors.length > 20) {
    addIssue('P2', 'design-system', 'Stylesheet still has many hardcoded colors; audit against Mint DS token exceptions', { count: hardcodedColors.length, sample: hardcodedColors.slice(0, 20) });
  }

  const boxShadowCount = (styles.match(/box-shadow\s*:/g) || []).length;
  if (boxShadowCount) addIssue('P2', 'design-system', 'Stylesheet uses box-shadow despite the top-level no box-shadows note', { count: boxShadowCount });
}

const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
hookRuntimeEvents(page);
await installPageInstrumentation(page);

try {
  await page.setViewport(VIEWPORTS[2]);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#grid .card', { timeout: 30000 });
  await assertTopbar(page);
  await auditBrands(page);
  await auditIcons(page);
  await auditIllustrations(page);
  await auditAnimation(page);
  await auditResponsive(page);
  await auditConventions(page);
  auditStaticCode();
} finally {
  await browser.close();
}

const blocking = issues.filter((issue) => issue.severity === 'P0' || issue.severity === 'P1');
printReport();
process.exit(blocking.length ? 1 : 0);
