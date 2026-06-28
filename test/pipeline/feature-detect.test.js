import { expect } from 'chai';
import { detectFeatures } from '../../packages/core/src/pipeline/feature-detect.js';

// With no ANTHROPIC_API_KEY, parseStructured returns null and detectFeatures
// falls back to its deterministic heuristic — which is what we exercise here.
describe('detectFeatures (heuristic fallback)', () => {
  before(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  const pages = [
    { url: 'https://x.com/', title: 'Home', text: '' },
    { url: 'https://x.com/dashboard', title: 'Dashboard', text: 'metrics' },
    { url: 'https://x.com/dashboard', title: 'Dashboard dup', text: 'dup' },
    { url: 'https://x.com/pricing', title: 'Pricing', text: 'plans' },
    { url: 'https://x.com/login', title: 'Login', text: 'sign in' },
    { url: 'https://x.com/privacy', title: 'Privacy', text: 'legal' },
  ];

  it('returns features and respects maxFeatures', async () => {
    const features = await detectFeatures({ homepageUrl: 'https://x.com/', pages, maxFeatures: 3 });
    expect(features).to.be.an('array');
    expect(features.length).to.be.at.most(3);
    expect(features.length).to.be.greaterThan(0);
  });

  it('skips login/privacy and de-duplicates paths', async () => {
    const features = await detectFeatures({ homepageUrl: 'https://x.com/', pages, maxFeatures: 10 });
    const urls = features.map((f) => f.featureUrl);
    expect(urls.some((u) => /login|privacy/.test(u))).to.equal(false);
    const paths = urls.map((u) => new URL(u).pathname);
    expect(new Set(paths).size).to.equal(paths.length);
  });

  it('produces features with the required shape', async () => {
    const [f] = await detectFeatures({ homepageUrl: 'https://x.com/', pages, maxFeatures: 1 });
    expect(f).to.have.all.keys('name', 'featureUrl', 'pitch', 'steps');
    expect(f.steps).to.be.an('array').that.is.not.empty;
  });
});
