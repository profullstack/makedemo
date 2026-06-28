/**
 * Dependency-free URL helpers shared by the crawler. Kept separate from
 * crawl.js (which imports Playwright) so they're unit-testable in isolation.
 */

// Convert a `/blog/*`-style glob to a RegExp anchored to the full path.
export function globToRegExp(glob) {
  const escaped = glob.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

// True if the URL's path matches any exclusion glob.
export function isExcluded(url, patterns) {
  if (!patterns.length) return false;
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  return patterns.some((re) => re.test(path));
}

// Drop the hash fragment for stable de-duplication.
export function normalize(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    return url.toString();
  } catch {
    return u;
  }
}
