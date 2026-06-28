import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { runScriptStage, runAssetsStage, runRenderStage } from './pipeline.js';
import { runPipeline as runBrainPipeline } from '@makedemo/core';

const jobs = new Map();

/**
 * Create a new demo job and kick off the pipeline asynchronously.
 * @param {{url: string, maxSteps?: number, voice?: string, credentials?: object}} input
 */
export function createJob(input) {
  const id = randomUUID().slice(0, 8);
  const job = {
    id,
    url: input.url,
    maxSteps: Math.min(Math.max(input.maxSteps ?? 6, 1), 12),
    voice: input.voice || null,
    credentials: input.credentials || null,
    // Pipeline-brain inputs (used only when MKDEMO_PIPELINE_BRAIN=1):
    maxFeatures: Math.min(Math.max(input.maxFeatures ?? 5, 1), 12),
    clips: Array.isArray(input.clips) ? input.clips : [],
    song: input.song || null,
    status: 'queued',
    stage: null,
    steps: [],
    video: null,
    transcript: null,
    title: null,
    error: null,
    createdAt: Date.now(),
    history: [],
    emitter: new EventEmitter(),
  };
  job.emitter.setMaxListeners(50);
  jobs.set(id, job);

  // Fire-and-forget; progress is observed via SSE.
  runPipeline(job).catch((err) => {
    emit(job, 'error', { message: err.message });
  });

  return job;
}

export function getJob(id) {
  return jobs.get(id);
}

/** Public, serialisable view of a job (no emitter/history internals). */
export function publicJob(job) {
  return {
    id: job.id,
    url: job.url,
    title: job.title,
    status: job.status,
    stage: job.stage,
    steps: job.steps,
    video: job.video,
    transcript: job.transcript,
    voice: job.voice,
    error: job.error,
  };
}

/** Subscribe to a job's event stream; replays history first. Returns unsubscribe. */
export function subscribe(job, listener) {
  for (const evt of job.history) listener(evt);
  const handler = (evt) => listener(evt);
  job.emitter.on('event', handler);
  return () => job.emitter.off('event', handler);
}

function emit(job, type, data) {
  const evt = { type, data, ts: Date.now() };
  job.history.push(evt);

  if (type === 'stage') job.stage = data.stage;
  if (type === 'error') {
    job.status = 'error';
    job.error = data.message;
  }
  if (type === 'done') job.status = 'done';

  job.emitter.emit('event', evt);
}

async function runPipeline(job) {
  const e = (type, data) => emit(job, type, data);
  job.status = 'running';
  e('status', { status: 'running' });

  // Opt-in pipeline brain: crawl -> Claude features -> per-feature recording ->
  // Claude VO script + Suno prompt -> ElevenLabs -> motion-graphics assembly.
  // Default-off so the live scroll-tour pipeline is unchanged until flipped.
  if (process.env.MKDEMO_PIPELINE_BRAIN === '1') {
    await runBrainPipeline(job, e); // emits its own 'done'
    return;
  }

  await runScriptStage(job, e);
  await runAssetsStage(job, e);
  await runRenderStage(job, e);

  e('done', { video: job.video, steps: job.steps });
}
