import { z } from 'zod';

/**
 * Shared zod schemas for the makedemo pipeline brain.
 *
 * These describe the structured artifacts Claude produces and that the
 * assembly stage consumes. They double as the integration contract with the
 * web shell (web/lib/pipeline.js can import + reuse these shapes).
 */

/** A single user-facing feature worth showing in the demo. */
export const featureSchema = z.object({
  name: z.string().describe('Short, punchy feature name (e.g. "Instant Checkout")'),
  featureUrl: z.string().describe('Best URL to start demoing this feature, chosen from the crawl'),
  pitch: z.string().describe('One sentence on why a viewer should care about this feature'),
  // Concrete things to do on the page so the recording shows the feature in action.
  steps: z.array(z.string()).describe('2-5 concrete on-page actions to perform while recording'),
});

export const featureDetectionSchema = z.object({
  features: z.array(featureSchema),
});

/**
 * One segment of the final video timeline. The script writer emits an ordered
 * list of these; each maps to either a recorded feature clip, an uploaded
 * clip, or a pure motion-graphics card.
 */
export const scriptSegmentSchema = z.object({
  kind: z.enum(['intro', 'feature', 'clip', 'outro']).describe('What drives the visuals for this segment'),
  // For kind==="feature": index into the recorded features array.
  featureIndex: z.number().nullable().describe('Index into recorded features, or null'),
  // For kind==="clip": index into the user-uploaded clips array.
  clipIndex: z.number().nullable().describe('Index into uploaded clips, or null'),
  title: z.string().describe('On-screen title/lower-third text for this segment'),
  caption: z.string().describe('Short on-screen caption synced to the voiceover'),
  narration: z.string().describe('Voiceover line(s) for this segment, written to be spoken aloud'),
});

export const demoScriptSchema = z.object({
  title: z.string().describe('Overall video title shown on the intro card'),
  tagline: z.string().describe('One-line subtitle for the intro card'),
  segments: z.array(scriptSegmentSchema),
  // A ready-to-paste prompt for suno.com to generate the surreal/metal bed.
  sunoPrompt: z.string().describe('A surreal/metal background-music prompt the user can paste into suno.com'),
});

/** Mirrors the web shell's job object so this brain is a drop-in. */
export const jobShape = {
  id: 'string',
  url: 'string',
  credentials: '{ user, password } | null',
  maxFeatures: 'number',
  voice: 'string | null',
  // New for the media pipeline:
  clips: 'string[]  (paths to user-uploaded video clips)',
  song: 'string | null  (path to an uploaded suno.com song clip)',
};
