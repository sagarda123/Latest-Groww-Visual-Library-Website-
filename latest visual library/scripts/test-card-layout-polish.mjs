import { createRequire } from 'node:module';

const require = createRequire(new URL('../../rive-animation-repo/package.json', import.meta.url));
const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'http://localhost:8081';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
const failures = [];
const assert = (condition, message, detail = null) => {
  if (!condition) failures.push(detail ? `${message}: ${JSON.stringify(detail)}` : message);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function criticalIllustrationFooterIssues() {
  const cards = [...document.querySelectorAll('#illu-grid .card-illu')].slice(0, 12);
  return cards.map((card) => {
    const footer = card.querySelector('.illu-card-foot');
    const name = card.querySelector('.illu-card-foot .name');
    const actions = card.querySelector('.illu-dl-group');
    const thumb = card.querySelector('.illu-thumb-wrap');
    const cardRect = card.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const nameRect = name?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    const thumbRect = thumb?.getBoundingClientRect();
    const footerWidthMatchesCard = footerRect
      ? Math.abs(footerRect.left - cardRect.left) <= 1 && Math.abs(footerRect.right - cardRect.right) <= 1
      : false;
    const actionsInsideFooter = footerRect && actionsRect
      ? actionsRect.left >= footerRect.left - 1 && actionsRect.right <= footerRect.right + 1
      : false;
    const nameInsideFooter = footerRect && nameRect
      ? nameRect.left >= footerRect.left - 1 && nameRect.right <= footerRect.right + 1
      : false;
    const isCompactArtwork = ['spot', 'spot-hero', 'illustrated-icons'].includes(card.dataset.illuCat);
    const thumbWidthMatchesCard = isCompactArtwork || (thumbRect
      ? Math.abs(thumbRect.left - cardRect.left) <= 1 && Math.abs(thumbRect.right - cardRect.right) <= 1
      : false);
    return {
      name: card.dataset.illuName,
      cardWidth: Math.round(cardRect.width),
      footerWidth: Math.round(footerRect?.width || 0),
      footerScrollOverflow: footer ? footer.scrollWidth - footer.clientWidth : 999,
      footerWidthMatchesCard,
      actionsInsideFooter,
      nameInsideFooter,
      thumbWidthMatchesCard,
    };
  }).filter((item) => (
    !item.footerWidthMatchesCard ||
    !item.actionsInsideFooter ||
    !item.nameInsideFooter ||
    !item.thumbWidthMatchesCard ||
    item.footerScrollOverflow > 1
  ));
}

function illustrationTileRadiusIssues() {
  return [...document.querySelectorAll('#illu-grid .card-illu')]
    .slice(0, 12)
    .map((card) => {
      const style = getComputedStyle(card);
      return {
        name: card.dataset.illuName,
        category: card.dataset.illuCat,
        radius: Number.parseFloat(style.borderTopLeftRadius || '0'),
      };
    })
    .filter((item) => item.radius < 14);
}

function compactThumbnailCanvasIssues() {
  const compactCategories = new Set(['spot', 'spot-hero', 'illustrated-icons']);
  return [...document.querySelectorAll('#illu-grid .card-illu')]
    .filter((card) => compactCategories.has(card.dataset.illuCat))
    .slice(0, 12)
    .map((card) => {
      const thumb = card.querySelector('.illu-thumb-wrap');
      const style = thumb ? getComputedStyle(thumb) : null;
      return {
        name: card.dataset.illuName,
        category: card.dataset.illuCat,
        backgroundColor: style?.backgroundColor || null,
      };
    })
    .filter((item) => item.backgroundColor !== 'rgba(0, 0, 0, 0)' && item.backgroundColor !== 'transparent');
}

await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.goto(`${BASE}/index.html?qa=card-layout-polish`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('#grid .card', { timeout: 30000 });
await page.evaluate(() => window.GrowwVisualTheme?.set('dark'));
await page.click('[data-section="illustrations"]');
await page.waitForSelector('#illu-grid .card-illu', { timeout: 30000 });
await sleep(300);

let issues = await page.evaluate(criticalIllustrationFooterIssues);
assert(issues.length === 0, 'Hero illustration card footers should stretch to the card and avoid clipped controls in dark mode', issues.slice(0, 4));
let radiusIssues = await page.evaluate(illustrationTileRadiusIssues);
assert(radiusIssues.length === 0, 'Hero illustration tiles should use the rounded illustration card radius', radiusIssues.slice(0, 4));

await page.click('[data-illu-cat="spot-hero"]');
await page.waitForSelector('#illu-grid .card-illu', { timeout: 30000 });
await sleep(300);
issues = await page.evaluate(criticalIllustrationFooterIssues);
assert(issues.length === 0, 'Spot hero card footers should keep names and actions inside the card', issues.slice(0, 4));
radiusIssues = await page.evaluate(illustrationTileRadiusIssues);
assert(radiusIssues.length === 0, 'Spot hero tiles should use the rounded illustration card radius', radiusIssues.slice(0, 4));
let canvasIssues = await page.evaluate(compactThumbnailCanvasIssues);
assert(canvasIssues.length === 0, 'Spot hero thumbnails should not render a boxed dark canvas behind transparent SVG art', canvasIssues.slice(0, 4));

await page.click('[data-illu-cat="illustrated-icons"]');
await page.waitForSelector('#illu-grid .card-illu', { timeout: 30000 });
await sleep(300);
issues = await page.evaluate(criticalIllustrationFooterIssues);
assert(issues.length === 0, 'Compact illustration card footers should keep names and actions inside the card', issues.slice(0, 4));
radiusIssues = await page.evaluate(illustrationTileRadiusIssues);
assert(radiusIssues.length === 0, 'Illustrated icon tiles should use the rounded illustration card radius', radiusIssues.slice(0, 4));
canvasIssues = await page.evaluate(compactThumbnailCanvasIssues);
assert(canvasIssues.length === 0, 'Illustrated icon thumbnails should not render a boxed dark canvas behind transparent SVG art', canvasIssues.slice(0, 4));

await page.click('[data-section="animation"]');
await page.waitForSelector('#rv-grid .rv-tile', { timeout: 30000 });
await sleep(4000);
const animationGridLayout = await page.evaluate(() => {
  const grid = document.getElementById('rv-grid');
  const firstPreviewInner = grid?.querySelector('.rv-tile-preview-inner');
  const gridStyle = grid ? getComputedStyle(grid) : null;
  const previewInnerStyle = firstPreviewInner ? getComputedStyle(firstPreviewInner) : null;
  return {
    columns: gridStyle?.gridTemplateColumns?.split(' ').filter(Boolean).length || 0,
    previewInset: Number.parseFloat(previewInnerStyle?.paddingTop || '999'),
  };
});
assert(
  animationGridLayout.columns === 3 && animationGridLayout.previewInset === 0,
  'Animation grid should render three desktop columns with edge-to-edge tile previews',
  animationGridLayout
);
const animationIssues = await page.evaluate(() => [...document.querySelectorAll('#rv-grid .rv-tile')].slice(0, 8).map((tile) => {
  const foot = tile.querySelector('.rv-tile-foot');
  const name = tile.querySelector('.rv-tile-name');
  const button = tile.querySelector('.rv-tile-copy');
  const tileStyle = getComputedStyle(tile);
  const footRect = foot?.getBoundingClientRect();
  const nameRect = name?.getBoundingClientRect();
  const buttonRect = button?.getBoundingClientRect();
  return {
    name: name?.textContent?.trim(),
    radius: Number.parseFloat(tileStyle.borderTopLeftRadius || '0'),
    footOverflow: foot ? foot.scrollWidth - foot.clientWidth : 999,
    nameBeforeButton: nameRect && buttonRect ? nameRect.right <= buttonRect.left - 8 : false,
    buttonInside: footRect && buttonRect ? buttonRect.right <= footRect.right + 1 : false,
  };
}).filter((item) => item.radius < 14 || item.footOverflow > 1 || !item.nameBeforeButton || !item.buttonInside));
assert(animationIssues.length === 0, 'Animation tiles should keep rounded corners and avoid label/download collisions', animationIssues.slice(0, 4));

await browser.close();
if (failures.length) {
  console.error('Failures:\n' + failures.map((failure) => `- ${failure}`).join('\n'));
}
process.exit(failures.length ? 1 : 0);
