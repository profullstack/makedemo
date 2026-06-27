import { expect } from 'chai';
import { featureSchema, featureDetectionSchema, demoScriptSchema } from '../../src/pipeline/schemas.js';

describe('schemas', () => {
  it('accepts a well-formed feature', () => {
    const ok = featureSchema.safeParse({
      name: 'Instant Checkout',
      featureUrl: 'https://x.com/checkout',
      pitch: 'Buy in one tap.',
      steps: ['Click Buy', 'Confirm'],
    });
    expect(ok.success).to.equal(true);
  });

  it('rejects a feature missing required fields', () => {
    const bad = featureSchema.safeParse({ name: 'X' });
    expect(bad.success).to.equal(false);
  });

  it('validates a feature-detection result of multiple features', () => {
    const res = featureDetectionSchema.safeParse({
      features: [
        { name: 'A', featureUrl: 'https://x.com/a', pitch: 'a', steps: ['s'] },
        { name: 'B', featureUrl: 'https://x.com/b', pitch: 'b', steps: ['s'] },
      ],
    });
    expect(res.success).to.equal(true);
    expect(res.data.features).to.have.length(2);
  });

  it('accepts a full demo script with nullable indices and a suno prompt', () => {
    const res = demoScriptSchema.safeParse({
      title: 'Demo',
      tagline: 'A tour',
      segments: [
        { kind: 'intro', featureIndex: null, clipIndex: null, title: 'T', caption: 'c', narration: 'hi' },
        { kind: 'feature', featureIndex: 0, clipIndex: null, title: 'F', caption: 'c', narration: 'feat' },
        { kind: 'clip', featureIndex: null, clipIndex: 0, title: '', caption: '', narration: '' },
        { kind: 'outro', featureIndex: null, clipIndex: null, title: 'Bye', caption: 'c', narration: 'bye' },
      ],
      sunoPrompt: 'surreal metal bed, 140bpm, loops, leaves room for VO',
    });
    expect(res.success).to.equal(true);
  });

  it('rejects an unknown segment kind', () => {
    const res = demoScriptSchema.safeParse({
      title: 'Demo',
      tagline: 't',
      segments: [{ kind: 'banana', featureIndex: null, clipIndex: null, title: '', caption: '', narration: '' }],
      sunoPrompt: 'x',
    });
    expect(res.success).to.equal(false);
  });
});
