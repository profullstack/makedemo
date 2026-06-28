/**
 * Pure timeline math — no I/O, so it's unit-testable.
 *
 * Given script segments and the measured duration of each segment's voiceover,
 * compute a concrete per-segment duration and absolute start offset. Segments
 * with no narration (e.g. uploaded B-roll clips) fall back to `clipDurations`
 * or a default.
 */
export function buildTimeline(segments, { voiceDurations = [], clipDurations = [], minSegment = 3, padding = 0.4 } = {}) {
  let offset = 0;
  return segments.map((seg, i) => {
    const voice = voiceDurations[i] || 0;
    let duration;
    if (voice > 0) {
      duration = voice + padding;
    } else if (seg.kind === 'clip' && seg.clipIndex != null && clipDurations[seg.clipIndex] != null) {
      duration = clipDurations[seg.clipIndex];
    } else {
      duration = minSegment;
    }
    duration = Math.max(minSegment, round(duration));
    const entry = { ...seg, index: i, start: round(offset), duration };
    offset += duration;
    return entry;
  });
}

/** Total length of a built timeline. */
export function timelineDuration(timeline) {
  return round(timeline.reduce((sum, s) => sum + s.duration, 0));
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
