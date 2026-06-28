import { chromium } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Record a short screen-capture clip of one feature (Playwright recordVideo).
 *
 * Ported from qaaas's browser-explorer: navigate to the feature URL, record
 * video while performing the feature's steps, then flush the .webm to disk and
 * return its bytes (the assembly stage transcodes/trims to the timeline).
 *
 * Steps are plain English; we run a light best-effort interpreter (click text
 * matches, scroll, wait) so the recording shows motion. A full Claude-driven
 * action loop (like qaaas browser-agent) is the documented upgrade path.
 */
export async function recordFeature(feature, { credentials, log } = {}) {
  const videoDir = await mkdtemp(join(tmpdir(), 'mkdemo-feat-'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });

  try {
    const page = await context.newPage();
    await page.goto(feature.featureUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    for (const step of feature.steps || []) {
      await runStep(page, step).catch(() => {});
      await page.waitForTimeout(1200);
    }
    // A beat at the end so the clip doesn't cut on the last action.
    await page.waitForTimeout(1000);

    const video = page.video();
    await context.close(); // flushes the recorded video to disk

    let webm;
    if (video) {
      const p = await video.path().catch(() => null);
      if (p) webm = await readFile(p).catch(() => undefined);
    }
    log?.(`Recorded "${feature.name}" (${webm ? webm.length : 0} bytes)`);
    return { name: feature.name, webm };
  } finally {
    await browser.close();
    await rm(videoDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Best-effort single-step interpreter. Tries to click an element whose visible
// text overlaps the step's words; otherwise scrolls the viewport.
async function runStep(page, step) {
  const lower = String(step).toLowerCase();

  if (/scroll/.test(lower)) {
    await page.mouse.wheel(0, 600);
    return;
  }
  if (/wait|load/.test(lower)) {
    await page.waitForTimeout(800);
    return;
  }

  // Pull candidate phrases (quoted text or capitalized words) from the step.
  const quoted = [...lower.matchAll(/"([^"]+)"|'([^']+)'/g)].map((m) => m[1] || m[2]);
  const words = lower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  const phrases = [...quoted, ...words];

  for (const phrase of phrases) {
    const el = page.getByText(new RegExp(phrase, 'i')).first();
    if (await el.count().catch(() => 0)) {
      const box = await el.boundingBox().catch(() => null);
      if (box) {
        await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await el.click({ timeout: 2500 }).catch(() => {});
        return;
      }
    }
  }
  // Nothing matched — give the viewer a gentle scroll.
  await page.mouse.wheel(0, 400);
}
