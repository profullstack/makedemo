import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  BrowserManager,
  AuthenticationHandler,
  AIDecisionMaker,
  generateSpeech,
  estimateAudioDuration,
  getRandomVoice,
} from '@makedemo/core';
import { runFfmpeg, generateSilentAudio } from './ffmpeg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Generated artifacts live under apps/web/output (kept inside the app for
// straightforward static serving and Railway volume mounting).
export const OUTPUT_ROOT = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.resolve(__dirname, '../output');

const hasOpenAI = () => Boolean(process.env.OPENAI_API_KEY);
const hasElevenLabs = () => Boolean(process.env.ELEVENLABS_API_KEY);

/** Minimal logger that forwards into the job event stream. */
const makeLogger = (emit) => ({
  info: (msg) => emit('log', { level: 'info', msg }),
  warn: (msg) => emit('log', { level: 'warn', msg }),
  error: (msg) => emit('log', { level: 'error', msg }),
  debug: () => {},
});

/**
 * STAGE 1 — Generate the demo script.
 * Drives a headless browser to the URL, walks the page, and produces an
 * ordered list of steps (interaction + narration + screenshot) that becomes
 * the storyboard for the video.
 */
export async function runScriptStage(job, emit) {
  const logger = makeLogger(emit);
  const jobDir = path.join(OUTPUT_ROOT, job.id);
  await fs.mkdir(jobDir, { recursive: true });

  emit('stage', { stage: 'script', status: 'running' });
  logger.info(`Opening ${job.url}`);

  const browser = new BrowserManager({ headless: true, logger });
  await browser.initialize();
  const page = browser.getPage();

  try {
    await browser.navigateTo(job.url);

    if (job.credentials?.user && job.credentials?.password) {
      logger.info('Credentials supplied — attempting authentication');
      const auth = new AuthenticationHandler({ logger });
      const ok = await auth.authenticate(page, job.credentials).catch(() => false);
      emit('log', { level: ok ? 'info' : 'warn', msg: ok ? 'Authenticated' : 'Auth skipped/failed — continuing as guest' });
    }

    const ai = new AIDecisionMaker({ logger, maxInteractions: job.maxSteps });

    let interactions = [];
    let useAI = hasOpenAI();
    if (useAI) {
      try {
        logger.info('Planning interactions with OpenAI');
        interactions = await ai.planInteractions(page);
      } catch (err) {
        logger.warn(`AI planning failed (${err.message}) — falling back to a heuristic storyboard`);
        useAI = false;
        interactions = [];
      }
    } else {
      logger.warn('No OPENAI_API_KEY — generating a heuristic storyboard');
    }

    const steps = [];
    // Opening title frame on the landing page.
    const introShot = path.join(jobDir, 'step-00.png');
    await page.screenshot({ path: introShot });
    const title = await page.title().catch(() => job.url);
    steps.push({
      index: 0,
      type: 'intro',
      description: `Landing page: ${title}`,
      narration: useAI
        ? await safeNarration(ai, { type: 'intro', description: `Welcome to ${title}` })
        : `Welcome to ${title}. Let's take a quick tour of what it can do.`,
      screenshot: path.basename(introShot),
    });

    if (useAI && interactions.length) {
      // AI path: each interaction carries a selector, so drive the real browser.
      for (let i = 0; i < interactions.length; i++) {
        const interaction = interactions[i];
        emit('stage', { stage: 'script', status: 'running', step: i + 1, total: interactions.length });
        const narration = await safeNarration(ai, interaction);

        try {
          await browser.executeInteraction(interaction);
          await new Promise((r) => setTimeout(r, 1200));
        } catch (err) {
          logger.warn(`Step ${i + 1} interaction skipped: ${err.message}`);
        }

        const shot = path.join(jobDir, `step-${String(i + 1).padStart(2, '0')}.png`);
        await page.screenshot({ path: shot }).catch(() => {});
        steps.push({
          index: i + 1,
          type: interaction.type,
          description: interaction.description,
          narration,
          screenshot: path.basename(shot),
        });
      }
    } else {
      // Fallback path: a guided scroll tour of the page. No selectors needed —
      // we scroll in viewport-sized beats and narrate by the headings in view.
      const beats = await scrollTourBeats(page, job.maxSteps);
      for (let i = 0; i < beats.length; i++) {
        const beat = beats[i];
        emit('stage', { stage: 'script', status: 'running', step: i + 1, total: beats.length });

        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), beat.y);
        await new Promise((r) => setTimeout(r, 700));

        const shot = path.join(jobDir, `step-${String(i + 1).padStart(2, '0')}.png`);
        await page.screenshot({ path: shot }).catch(() => {});
        steps.push({
          index: i + 1,
          type: 'scroll',
          description: beat.heading,
          narration: beat.heading
            ? `Next, ${beat.heading.replace(/[.!?…]+$/, '')}.`
            : 'Scrolling further through the experience.',
          screenshot: path.basename(shot),
        });
      }
    }

    job.steps = steps;
    job.title = title;
    emit('stage', { stage: 'script', status: 'done' });
    emit('script', { steps, title });
    return steps;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * STAGE 2 — Produce assets.
 * For each step, render narration audio (ElevenLabs, or a timed silent track as
 * a fallback) and measure its duration so the render can sync slides to voice.
 */
export async function runAssetsStage(job, emit) {
  const logger = makeLogger(emit);
  const jobDir = path.join(OUTPUT_ROOT, job.id);
  emit('stage', { stage: 'assets', status: 'running' });

  const voice = job.voice || getRandomVoice();
  job.voice = voice;
  const useTTS = hasElevenLabs();
  logger.info(useTTS ? `Synthesizing narration (voice ${voice})` : 'No ELEVENLABS_API_KEY — using timed silent audio');

  for (let i = 0; i < job.steps.length; i++) {
    const step = job.steps[i];
    emit('stage', { stage: 'assets', status: 'running', step: i + 1, total: job.steps.length });

    const audioPath = path.join(jobDir, `audio-${String(step.index).padStart(2, '0')}.mp3`);
    const estimated = Math.max(2.5, estimateAudioDuration(step.narration));

    if (useTTS) {
      try {
        await generateSpeech(step.narration, audioPath, { voice });
      } catch (err) {
        logger.warn(`TTS failed on step ${step.index} (${err.message}) — using silent track`);
        await generateSilentAudio(audioPath, estimated);
      }
    } else {
      await generateSilentAudio(audioPath, estimated);
    }

    step.audio = path.basename(audioPath);
    step.duration = await probeDuration(audioPath).catch(() => estimated);
    emit('asset', { index: step.index, audio: step.audio, duration: step.duration });
  }

  // Persist transcript alongside the assets.
  const transcript = job.steps.map((s) => s.narration).join('\n\n');
  await fs.writeFile(path.join(jobDir, 'transcript.txt'), transcript, 'utf8');
  job.transcript = 'transcript.txt';

  emit('stage', { stage: 'assets', status: 'done' });
  return job.steps;
}

/**
 * STAGE 3 — Render the final MP4.
 * Builds one clip per step (screenshot held for the narration duration) and
 * concatenates them into a single 1080p video.
 */
export async function runRenderStage(job, emit) {
  const logger = makeLogger(emit);
  const jobDir = path.join(OUTPUT_ROOT, job.id);
  emit('stage', { stage: 'render', status: 'running' });

  const clipPaths = [];
  for (let i = 0; i < job.steps.length; i++) {
    const step = job.steps[i];
    emit('stage', { stage: 'render', status: 'running', step: i + 1, total: job.steps.length });

    const clip = path.join(jobDir, `clip-${String(step.index).padStart(2, '0')}.mp4`);
    const imagePath = path.join(jobDir, step.screenshot);
    const audioPath = path.join(jobDir, step.audio);
    const duration = Math.max(2.5, step.duration || 3);

    await runFfmpeg([
      '-loop', '1', '-i', imagePath,
      '-i', audioPath,
      '-t', String(duration),
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0d0c0f,format=yuv420p',
      '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      '-shortest',
      clip,
    ], (l) => l && logger.info(l));

    clipPaths.push(clip);
    emit('clip', { index: step.index });
  }

  // Concat demuxer needs a list file.
  const listFile = path.join(jobDir, 'concat.txt');
  await fs.writeFile(listFile, clipPaths.map((c) => `file '${c}'`).join('\n'), 'utf8');

  const finalPath = path.join(jobDir, 'demo.mp4');
  await runFfmpeg([
    '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c', 'copy',
    finalPath,
  ], (l) => l && logger.info(l));

  job.video = 'demo.mp4';
  emit('stage', { stage: 'render', status: 'done' });
  emit('video', { video: job.video });
  return finalPath;
}

/* ----------------------------- helpers ----------------------------- */

async function safeNarration(ai, interaction) {
  try {
    return await ai.generateNarration(interaction);
  } catch {
    return heuristicNarration(interaction);
  }
}

function heuristicNarration(interaction) {
  const d = interaction.description || 'this part of the interface';
  switch (interaction.type) {
    case 'click': return `Here we select ${d}, opening up the next part of the experience.`;
    case 'type': return `Now we enter some details into ${d}.`;
    case 'scroll': return `Scrolling down, we can see ${d}.`;
    case 'hover': return `Hovering over ${d} reveals more context.`;
    default: return `Next, ${d}.`;
  }
}

/**
 * Build a guided scroll tour of the page — no LLM, no selectors required.
 * Divides the scrollable height into beats and tags each with the most relevant
 * heading so narration can reference real on-screen content.
 */
async function scrollTourBeats(page, maxSteps) {
  const data = await page.evaluate(() => {
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const viewport = window.innerHeight;
    const headings = [...document.querySelectorAll('h1, h2, h3')]
      .map((el) => ({
        y: el.getBoundingClientRect().top + window.scrollY,
        text: (el.innerText || '').trim().replace(/\s+/g, ' '),
      }))
      .filter((h) => h.text && h.text.length <= 80);
    return { docHeight, viewport, headings };
  });

  const { docHeight, viewport, headings } = data;
  const scrollable = Math.max(0, docHeight - viewport);
  // At most `maxSteps` beats; fewer if the page is short.
  const count = scrollable < viewport * 0.6 ? 0 : Math.min(maxSteps, Math.ceil(scrollable / viewport) + 1);

  const beats = [];
  for (let i = 1; i <= count; i++) {
    const y = Math.round((scrollable * i) / count);
    // Pick the heading nearest the top of this viewport beat.
    let heading = '';
    let best = Infinity;
    for (const h of headings) {
      const d = Math.abs(h.y - y);
      if (h.y >= y - viewport && d < best) {
        best = d;
        heading = lowerFirst(h.text);
      }
    }
    beats.push({ y, heading });
  }
  return beats;
}

function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function probeDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);
    let out = '';
    proc.stdout.on('data', (c) => (out += c.toString()));
    proc.on('error', reject);
    proc.on('close', () => {
      const d = parseFloat(out.trim());
      Number.isFinite(d) ? resolve(d) : reject(new Error('bad duration'));
    });
  });
}
