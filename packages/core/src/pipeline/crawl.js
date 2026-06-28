import { chromium } from 'playwright';
import { globToRegExp, isExcluded, normalize } from './url-utils.js';

/**
 * Same-origin site crawler (ported/adapted from the qaaas discovery flow).
 *
 * BFS over <a href> links from the homepage, capturing each page's URL, title,
 * and a snippet of visible text. Optional credential login runs first so the
 * crawl can reach authenticated app surfaces. The crawled pages feed Claude in
 * feature-detect.js.
 */

export { globToRegExp, isExcluded, normalize };

// Best-effort heuristic login using Playwright (the existing auth handler is
// Puppeteer-bound; here we keep the crawler self-contained on Playwright).
async function tryLogin(page, { loginUrl, homepageUrl, user, password }, log) {
  try {
    await page.goto(loginUrl || homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});

    const emailSel = 'input[type="email"], input[name*="email" i], input[name*="user" i], input[id*="email" i]';
    const passSel = 'input[type="password"]';
    const email = page.locator(emailSel).first();
    const pass = page.locator(passSel).first();

    if (await email.count()) await email.fill(user, { timeout: 4000 }).catch(() => {});
    if (await pass.count()) await pass.fill(password, { timeout: 4000 }).catch(() => {});

    const submit = page
      .locator('button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
      .first();
    if (await submit.count()) await submit.click({ timeout: 4000 }).catch(() => {});
    else await pass.press('Enter').catch(() => {});

    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    log?.(`Attempted login as ${user}`);
  } catch (err) {
    log?.(`Login skipped/failed: ${String(err).slice(0, 120)}`);
  }
}

/**
 * @param {object} opts
 * @param {string} opts.homepageUrl
 * @param {number} [opts.maxPages]
 * @param {{user,password,loginUrl?}|null} [opts.credentials]
 * @param {string[]} [opts.excludedPaths]
 * @param {(msg:string)=>void} [opts.log]
 * @returns {Promise<Array<{url,title,text}>>}
 */
export async function crawlSite(opts) {
  const maxPages = Math.min(opts.maxPages || 20, 40);
  const excludePatterns = (opts.excludedPaths ?? []).map((p) => p.trim()).filter(Boolean).map(globToRegExp);
  const log = opts.log;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const page = await context.newPage();
    const origin = new URL(opts.homepageUrl).origin;
    const deadline = Date.now() + 5 * 60 * 1000;

    if (opts.credentials?.user && opts.credentials?.password) {
      await tryLogin(page, { ...opts.credentials, homepageUrl: opts.homepageUrl }, log);
    }

    const visited = new Set();
    const queue = [normalize(opts.homepageUrl)];
    const pages = [];

    while (queue.length && pages.length < maxPages && Date.now() < deadline) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);
      if (isExcluded(url, excludePatterns)) continue;

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        const title = await page.title();
        const text = (await page.locator('body').innerText({ timeout: 4000 }).catch(() => '')).slice(0, 1500);
        pages.push({ url, title, text });
        log?.(`Crawled ${title || url}`);

        const links = await page.evaluate(
          (org) =>
            Array.from(document.querySelectorAll('a[href]'))
              .map((a) => a.href)
              .filter((h) => {
                try {
                  return new URL(h).origin === org;
                } catch {
                  return false;
                }
              }),
          origin,
        );

        for (const link of links.map(normalize)) {
          if (!visited.has(link) && !queue.includes(link) && !isExcluded(link, excludePatterns) && queue.length < maxPages * 3) {
            queue.push(link);
          }
        }
      } catch (err) {
        log?.(`Skipped ${url}: ${String(err).slice(0, 120)}`);
      }
    }

    return pages;
  } finally {
    await browser.close();
  }
}
