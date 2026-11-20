'use strict';

const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, resolve, sep } = require('node:path');
const { chromium, webkit } = require('playwright');

const root = resolve(process.argv[2] || '_site');
const routes = [
  '/', '/projects/', '/experience/', '/projects/sprout-patrol/', '/poster/', '/honor/',
  '/updates/', '/contact/', '/ice/', '/story/', '/en/', '/plain/', '/standby/', '/404.html',
];
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json',
};

let rolledBack = false;
const restoredPage = '<!doctype html><meta charset=utf-8><h1 data-restored>已恢复旧版</h1>';
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  try {
    if (rolledBack && path === '/') {
      response.setHeader('Content-Type', types['.html']);
      response.end(restoredPage);
      return;
    }
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep) || (rolledBack && ['/sw-state.json', '/sw.js'].includes(path))) {
      response.writeHead(404).end();
      return;
    }
    const body = await readFile(file);
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': types['.html'] });
    if (error.code === 'ENOENT' && request.headers.accept?.includes('text/html')) {
      response.end(await readFile(resolve(root, '404.html')));
    } else response.end();
  }
});

async function session(browser, options, run) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 }, reducedMotion: 'reduce', serviceWorkers: 'block',
    ...options,
  });
  try {
    await run(context, await context.newPage());
  } finally {
    await context.close();
  }
}

async function verify(browser, origin) {
  const resume = JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8')).resume.file;
  await session(browser, { javaScriptEnabled: false }, async (context, page) => {
    for (const route of routes) {
      assert.equal((await page.goto(origin + route)).status(), 200);
      assert.ok(await page.locator('main h1').isVisible(), 'No-JS heading at ' + route);
    }
    await page.goto(origin + '/');
    const shortcut = page.locator('[data-resume-entry]');
    const target = new URL(await shortcut.getAttribute('href'), page.url());
    assert.equal(target.pathname, '/' + resume);
    assert.equal((await context.request.head(target.href)).status(), 200);
    assert.equal(await page.locator('#intro-video[playsinline][width][height]').count(), 1);
    assert.ok(await page.locator('#introduction noscript a[href$=".mp4"]').isVisible());
    await page.locator('.os-app[href*="projects"]').first().click();
    await page.waitForURL(/\/projects\/(?:index\.html)?$/);
    await page.goto(origin + '/contact/');
    const details = page.locator('noscript details');
    for (const scheme of ['tel:', 'mailto:']) {
      assert.equal(await details.locator('a[href^="' + scheme + '"]').isVisible(), false);
    }
    await details.locator('summary').click();
    for (const scheme of ['tel:', 'mailto:']) {
      assert.equal(await details.locator('a[href^="' + scheme + '"]').isVisible(), true);
    }
  });

  await session(browser, { reducedMotion: 'no-preference' }, async (context, page) => {
    await context.addInitScript(() => {
      localStorage.setItem('mjc-lockscreen-seen', '1');
      for (const property of ['startViewTransition', 'activeViewTransition']) {
        if (property in Document.prototype) {
          Object.defineProperty(Document.prototype, property, { configurable: true, value: undefined });
        }
      }
    });
    await context.route('**/*.css', async route => {
      const response = await route.fetch();
      const css = (await response.text())
        .replace(/(?:-webkit-)?backdrop-filter\s*:/g, 'unsupported-glass-filter:')
        .replace(/@view-transition\s*\{[^}]*\}/g, '');
      await route.fulfill({ response, body: css });
    });
    await page.goto(origin + '/');
    assert.ok(await page.locator('.os-hero').isVisible());
    const blur = await page.locator('.glass-dock').evaluate(node => {
      const style = getComputedStyle(node);
      return style.backdropFilter || style.webkitBackdropFilter || 'none';
    });
    assert.equal(blur, 'none');
    await page.locator('.os-app[href*="projects"]').first().click();
    await page.waitForURL(/\/projects\/(?:index\.html)?$/);
    assert.ok(await page.locator('h1').isVisible());
  });

  await session(browser, {}, async (_context, page) => {
    await page.goto(origin + '/');
    assert.ok(await page.locator('[data-lockscreen]').isHidden());
    assert.equal(await page.locator('html').getAttribute('data-polish'), null);
    await page.goto(origin + '/ice/');
    assert.ok(await page.locator('[data-ice-poster]').isVisible());
    assert.ok(await page.locator('[data-ice-play]').isDisabled());
  });

  await session(browser, { reducedMotion: 'no-preference', serviceWorkers: 'allow',
    extraHTTPHeaders: { 'Save-Data': 'on' } }, async (context, page) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true, value: { saveData: true, effectiveType: '2g' },
      });
    });
    const heavy = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (/\.(?:mp4|aac)$|\/sw\.js$/.test(path) ||
          (path.startsWith('/assets/ice.') && !path.endsWith('/preview.mjs'))) heavy.push(path);
    });
    await page.goto(origin + '/');
    assert.ok(await page.locator('main h1').isVisible());
    assert.equal(await page.locator('html').getAttribute('data-polish'), null);
    await page.goto(origin + '/ice/');
    assert.ok(await page.locator('[data-ice-poster]').isVisible());
    assert.ok(await page.locator('[data-ice-play]').isDisabled());
    assert.deepEqual(heavy, []);
  });

  const overflow = [];
  for (const fontScale of [100, 130]) {
    await session(browser, { viewport: { width: 320, height: 690 } }, async (_context, page) => {
      for (const route of routes) {
        await page.goto(origin + route);
        if (fontScale === 130) await page.addStyleTag({ content: 'html {font-size:130% !important}' });
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.locator('main h1').isVisible(), 'Narrow viewport at ' + route);
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        if (width > 321) overflow.push({ fontScale, route, width });
      }
    });
  }
  assert.deepEqual(overflow, []);
  await session(browser, {}, async (_context, page) => {
    const legacyPdf = await page.goto(origin + '/resume-e320d240bb78.pdf');
    assert.equal(legacyPdf.status(), 404);
    for (const destination of ['/', '/projects/', '/' + resume]) {
      assert.ok(await page.locator('main a[href="' + destination + '"]').isVisible(), destination);
    }
    await page.goto(origin + '/projects/ai-content/');
    await page.waitForURL(origin + '/projects/');
    assert.ok(await page.locator('main h1').isVisible());
  });
}

async function verifyRollback(browser, origin) {
  await session(browser, { serviceWorkers: 'allow' }, async (context, page) => {
    await page.goto(origin + '/');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30000 });
    const cacheNames = () => page.evaluate(() => caches.keys());
    await page.evaluate(() => caches.open('game-fixture-cache'));
    assert.ok((await cacheNames()).some(name => name.startsWith('mjc-os-static-')));

    await context.setOffline(true);
    await page.goto(origin + '/plain/');
    assert.ok(await page.locator('main h1').isVisible());
    assert.ok((await cacheNames()).some(name => name.startsWith('mjc-os-static-')));
    await page.goto(origin + '/');

    // The legacy release has no state file or worker. Start from an open,
    // formerly cached page and simulate the event that happens on returning.
    rolledBack = true;
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await page.locator('[data-restored]').waitFor({ timeout: 15000 });
    assert.equal(page.url(), origin + '/');
    assert.deepEqual(await cacheNames(), ['game-fixture-cache']);
    assert.equal(await page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration('/'))), false);
  });
}

(async () => {
  await new Promise(accept => server.listen(0, '127.0.0.1', accept));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const runWebKit = Boolean(process.env.WEBKIT_PATH);
  let args = ['--no-sandbox'];
  if (!runWebKit && process.env.CHROME_HELPER) {
    args = (await import(process.env.CHROME_HELPER)).default.args
      .filter(flag => flag !== '--single-process' && !flag.startsWith('--headless'));
  }
  const browser = await (runWebKit ? webkit : chromium).launch({
    executablePath: process.env.WEBKIT_PATH || process.env.CHROME_PATH || undefined,
    ...(runWebKit ? {} : { args }),
  });
  try {
    await verify(browser, origin);
    if (!runWebKit) await verifyRollback(browser, origin);
    console.log(JSON.stringify({
      browser: browser.version(), fallbacks: 6, pages: routes.length,
      legacyDestinations: 2, ...(runWebKit ? {} : { rollback: true }),
    }));
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
