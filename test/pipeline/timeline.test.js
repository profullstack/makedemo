import { expect } from 'chai';
import { buildTimeline, timelineDuration } from '../../packages/core/src/pipeline/timeline.js';

describe('timeline', () => {
  const segments = [
    { kind: 'intro', featureIndex: null, clipIndex: null },
    { kind: 'feature', featureIndex: 0, clipIndex: null },
    { kind: 'clip', featureIndex: null, clipIndex: 0 },
    { kind: 'outro', featureIndex: null, clipIndex: null },
  ];

  it('uses voiceover duration + padding when narration exists', () => {
    const t = buildTimeline(segments, { voiceDurations: [4, 6, 0, 3], clipDurations: [9], padding: 0.4 });
    expect(t[0].duration).to.equal(4.4);
    expect(t[1].duration).to.equal(6.4);
  });

  it('falls back to clip duration for silent clip segments', () => {
    const t = buildTimeline(segments, { voiceDurations: [4, 6, 0, 3], clipDurations: [9] });
    expect(t[2].duration).to.equal(9);
  });

  it('enforces the minimum segment length', () => {
    const t = buildTimeline(segments, { voiceDurations: [1, 1, 0, 1], clipDurations: [1], minSegment: 3 });
    t.forEach((s) => expect(s.duration).to.be.at.least(3));
  });

  it('computes monotonically increasing start offsets', () => {
    const t = buildTimeline(segments, { voiceDurations: [4, 6, 0, 3], clipDurations: [9] });
    expect(t[0].start).to.equal(0);
    expect(t[1].start).to.equal(t[0].duration);
    expect(t[2].start).to.equal(t[0].duration + t[1].duration);
  });

  it('total duration equals the sum of segment durations', () => {
    const t = buildTimeline(segments, { voiceDurations: [4, 6, 0, 3], clipDurations: [9] });
    const sum = t.reduce((s, x) => s + x.duration, 0);
    expect(timelineDuration(t)).to.equal(Math.round(sum * 1000) / 1000);
  });
});
