import { parseStructured } from './llm.js';
import { featureDetectionSchema } from './schemas.js';

/**
 * Turn a crawl into a ranked list of demo-worthy features (Claude).
 *
 * This is the makedemo analog of qaaas's "identify testable features" step —
 * but framed for marketing: pick the features that best sell the product, give
 * each a punchy name, a one-line pitch, and concrete on-page steps to perform
 * while recording.
 *
 * Falls back to a heuristic (homepage + a few distinct crawled pages) when no
 * ANTHROPIC_API_KEY is configured.
 */
export async function detectFeatures({ homepageUrl, pages, maxFeatures = 5, log }) {
  log?.(`Analyzing ${pages.length} page(s) to pick demo-worthy features`);

  const result = await parseStructured({
    system:
      'You are a senior product marketer making a punchy demo video. Given a crawl of a website (each page has a URL, title, and a snippet of visible text), pick the distinct, user-facing FEATURES that best showcase the product (e.g. a core workflow, a create/edit flow, search, a dashboard, checkout). For each feature give: a short punchy name, the best feature URL to start from (chosen from the crawled URLs), a one-sentence pitch a viewer would care about, and 2-5 concrete on-page actions to perform while recording it. Order them into a compelling narrative (hook first, payoff last). Skip legal/utility pages (privacy, terms, 404, login) and avoid duplicates.',
    prompt: `Homepage: ${homepageUrl}\nWant about ${maxFeatures} features.\n\nCrawled pages:\n${pages
      .map((p) => `- ${p.url}\n  title: ${p.title}\n  text: ${p.text.slice(0, 300)}`)
      .join('\n')}`,
    schema: featureDetectionSchema,
    maxTokens: 8000,
  });

  let features = result?.features ?? [];
  if (features.length === 0) {
    features = heuristicFeatures(homepageUrl, pages, maxFeatures);
    log?.('No LLM features — using heuristic feature list');
  }

  features = features.slice(0, maxFeatures);
  log?.(`Selected ${features.length} feature(s)`);
  return features;
}

function heuristicFeatures(homepageUrl, pages, maxFeatures) {
  const skip = /privacy|terms|login|signin|sign-in|404|cookie/i;
  const picked = [];
  const seenPaths = new Set();
  for (const p of [{ url: homepageUrl, title: 'Home', text: '' }, ...pages]) {
    let path;
    try {
      path = new URL(p.url).pathname;
    } catch {
      continue;
    }
    if (seenPaths.has(path) || skip.test(p.url) || skip.test(p.title || '')) continue;
    seenPaths.add(path);
    picked.push({
      name: (p.title || path || 'Feature').slice(0, 40),
      featureUrl: p.url,
      pitch: `A look at ${p.title || path}.`,
      steps: ['Wait for the page to load', 'Scroll through the main content'],
    });
    if (picked.length >= maxFeatures) break;
  }
  return picked;
}
