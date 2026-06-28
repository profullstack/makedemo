import { expect } from 'chai';
import { writeScript } from '../../packages/core/src/pipeline/script-writer.js';

// No ANTHROPIC_API_KEY -> deterministic heuristic script.
describe('writeScript (heuristic fallback)', () => {
  before(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  const features = [
    { name: 'Search', featureUrl: 'https://x.com/search', pitch: 'Find anything fast.', steps: [] },
    { name: 'Build', featureUrl: 'https://x.com/build', pitch: 'Ship in minutes.', steps: [] },
    { name: 'Share', featureUrl: 'https://x.com/share', pitch: 'One-click sharing.', steps: [] },
  ];

  it('opens with intro and ends with outro', async () => {
    const script = await writeScript({ productUrl: 'https://x.com', features, clipCount: 0 });
    expect(script.segments[0].kind).to.equal('intro');
    expect(script.segments[script.segments.length - 1].kind).to.equal('outro');
  });

  it('includes every feature exactly once', async () => {
    const script = await writeScript({ productUrl: 'https://x.com', features, clipCount: 0 });
    const featureIdx = script.segments.filter((s) => s.kind === 'feature').map((s) => s.featureIndex).sort();
    expect(featureIdx).to.deep.equal([0, 1, 2]);
  });

  it('places every uploaded clip with a valid clipIndex', async () => {
    const script = await writeScript({ productUrl: 'https://x.com', features, clipCount: 2 });
    const clipSegs = script.segments.filter((s) => s.kind === 'clip');
    expect(clipSegs).to.have.length(2);
    const idx = clipSegs.map((s) => s.clipIndex).sort();
    expect(idx).to.deep.equal([0, 1]);
  });

  it('always emits a non-empty suno prompt and a title', async () => {
    const script = await writeScript({ productUrl: 'https://x.com', features, clipCount: 0 });
    expect(script.sunoPrompt).to.be.a('string').with.length.greaterThan(10);
    expect(script.sunoPrompt.toLowerCase()).to.match(/metal|surreal/);
    expect(script.title).to.be.a('string').that.is.not.empty;
  });
});
