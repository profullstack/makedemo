import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { crawlSite } from './crawl.js';
import { detectFeatures } from './feature-detect.js';
import { recordFeature } from './feature-recorder.js';
import { writeScript } from './script-writer.js';
import { synthesizeVoiceover } from './voiceover.js';
import { buildTimeline } from './timeline.js';
import { assembleVideo } from './assembly.js';
import { isLlmEnabled } from './llm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Honor OUTPUT_DIR (set by the web app) so brain output lands next to the web
// shell's; otherwise default to the package-local output dir.
export const OUTPUT_ROOT = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.resolve(__dirname, '../../../../output');

/**
 * makedemo pipeline brain — drop-in for the web shell.
 *
 * Job shape (a superset of the existing web job; see schemas.js#jobShape):
 *   { id, url, credentials?, maxFeatures?, voice?, clips?: string[], song?: string }
 *
 * `emit(type, data)` uses the same event vocabulary as web/lib/jobs.js
 * ('stage' | 'log' | 'script' | 'asset' | 'video' | 'done' | 'error'), so the
 * existing SSE UI works unchanged. Stage runners are also exported individually
 * if the web layer prefers to drive them.
 */
export async function runPipeline(job, emit) {
  const e = emit || (() => {});
  const log = (msg) => e('log', { level: 'info', msg });
  const jobDir = path.join(OUTPUT_ROOT, job.id);
  await fs.mkdir(jobDir, { recursive: true });
  log(isLlmEnabled() ? 'Claude enabled (smart path)' : 'No ANTHROPIC_API_KEY — heuristic path');

  // STAGE 1 — discover: crawl + Claude feature detection.
  e('stage', { stage: 'discover', status: 'running' });
  const pages = await crawlSite({
    homepageUrl: job.url,
    maxPages: job.maxPages || 20,
    credentials: job.credentials || null,
    excludedPaths: job.excludedPaths || [],
    log,
  });
  const features = await detectFeatures({
    homepageUrl: job.url,
    pages,
    maxFeatures: job.maxFeatures || 5,
    log,
  });
  job.features = features;
  e('stage', { stage: 'discover', status: 'done' });
  e('script', { features });

  // STAGE 2 — record: one screen-capture clip per feature.
  e('stage', { stage: 'record', status: 'running' });
  const featureClips = [];
  for (let i = 0; i < features.length; i++) {
    e('stage', { stage: 'record', status: 'running', step: i + 1, total: features.length });
    const rec = await recordFeature(features[i], { credentials: job.credentials, log });
    let clipPath = null;
    if (rec.webm?.length) {
      clipPath = path.join(jobDir, `feature-${String(i).padStart(2, '0')}.webm`);
      await fs.writeFile(clipPath, rec.webm);
    }
    featureClips.push({ name: rec.name, path: clipPath });
  }
  e('stage', { stage: 'record', status: 'done' });

  // STAGE 3 — script: cohesive VO script + Suno music prompt.
  e('stage', { stage: 'script', status: 'running' });
  const uploadedClips = job.clips || [];
  const script = await writeScript({
    productUrl: job.url,
    features,
    clipCount: uploadedClips.length,
    log,
  });
  job.script = script;
  job.sunoPrompt = script.sunoPrompt;
  await fs.writeFile(path.join(jobDir, 'suno-prompt.txt'), script.sunoPrompt || '', 'utf8');
  await fs.writeFile(
    path.join(jobDir, 'transcript.txt'),
    script.segments.map((s) => s.narration).filter(Boolean).join('\n\n'),
    'utf8',
  );
  e('stage', { stage: 'script', status: 'done' });
  e('script', { title: script.title, segments: script.segments, sunoPrompt: script.sunoPrompt });

  // STAGE 4 — voiceover: ElevenLabs per segment.
  e('stage', { stage: 'voiceover', status: 'running' });
  const { voice, audios } = await synthesizeVoiceover({
    segments: script.segments,
    outputDir: jobDir,
    voice: job.voice,
    log,
  });
  job.voice = voice;
  e('stage', { stage: 'voiceover', status: 'done' });

  // STAGE 5 — assemble: motion graphics + clips + ducked music -> MP4.
  e('stage', { stage: 'assemble', status: 'running' });
  const timeline = buildTimeline(script.segments, { voiceDurations: audios.map((a) => a.duration) });
  const outPath = path.join(jobDir, 'demo.mp4');
  await assembleVideo({
    timeline,
    audios,
    featureClips,
    uploadedClips,
    song: job.song || null,
    workDir: path.join(jobDir, 'work'),
    outPath,
    log,
  });
  job.video = 'demo.mp4';
  job.transcript = 'transcript.txt';
  e('stage', { stage: 'assemble', status: 'done' });
  e('video', { video: job.video });

  e('done', { video: job.video, features, sunoPrompt: job.sunoPrompt });
  return { videoPath: outPath, features, script };
}
