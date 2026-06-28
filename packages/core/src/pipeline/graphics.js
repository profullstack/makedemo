import path from 'node:path';
import { existsSync } from 'node:fs';
import { runFfmpeg } from './ffmpeg.js';

/**
 * Motion graphics for the demo: animated title/outro cards and lower-third
 * overlays burned onto feature/clip segments.
 *
 * Two backends:
 *   - Remotion (full React motion graphics) when MKDEMO_REMOTION=1 and the
 *     graphics/ project + @remotion/renderer are installed — see renderCardRemotion.
 *   - An ffmpeg backend (default) that animates a surreal mandelbrot background
 *     with fading kinetic type. Zero extra toolchain, always runnable.
 */

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const FONT = findFont();

function findFont() {
  // Common Linux font; drawtext falls back gracefully if absent.
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  ];
  return candidates[0]; // ffmpeg ignores a missing file only if fontfile omitted; see drawtextFont()
}

export function escapeDrawtext(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "’")
    .replace(/%/g, '\\%');
}

function drawtextFont() {
  // Only pass fontfile if it exists; otherwise let ffmpeg use its default.
  return existsSync(FONT) ? `fontfile='${FONT}':` : '';
}

/**
 * Render an animated intro/outro card to MP4.
 * @param {object} opts
 * @param {'intro'|'outro'} opts.kind
 * @param {string} opts.title
 * @param {string} opts.subtitle
 * @param {number} opts.duration  seconds
 * @param {string} opts.outPath
 * @param {string} [opts.audioPath]  optional narration to mux in
 */
export async function renderCard({ title, subtitle, duration, outPath, audioPath }) {
  const ff = drawtextFont();
  const d = Math.max(2, duration);

  // Surreal animated background: a slowly-zooming mandelbrot, desaturated and
  // darkened so white type pops. Title fades in + drifts up; subtitle follows.
  const vf = [
    `format=yuv420p`,
    `eq=saturation=0.6:brightness=-0.25:contrast=1.1`,
    `drawtext=${ff}text='${escapeDrawtext(title)}':fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h-text_h)/2-60-20*sin(t):alpha='min(1,t/0.8)':box=1:boxcolor=black@0.35:boxborderw=24`,
    `drawtext=${ff}text='${escapeDrawtext(subtitle || '')}':fontcolor=0xC0C0FF:fontsize=44:x=(w-text_w)/2:y=(h-text_h)/2+70:alpha='min(1,max(0,(t-0.5)/0.8))'`,
  ].join(',');

  const args = [
    '-f', 'lavfi', '-i', `mandelbrot=size=${WIDTH}x${HEIGHT}:rate=${FPS}`,
  ];
  if (audioPath) args.push('-i', audioPath);
  args.push(
    '-t', String(d),
    '-vf', vf,
    '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
  );
  if (audioPath) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  else args.push('-an');
  args.push(outPath);

  if (process.env.MKDEMO_REMOTION === '1') {
    const ok = await renderCardRemotion({ title, subtitle, duration: d, outPath, audioPath }).catch(() => false);
    if (ok) return outPath;
  }
  await runFfmpeg(args);
  return outPath;
}

/**
 * Burn an animated lower-third (title + caption) onto an existing video clip.
 * @param {string} inputVideo
 * @param {object} opts { title, caption, outPath }
 */
export async function overlayLowerThird(inputVideo, { title, caption, outPath }) {
  if (!title && !caption) {
    // Nothing to overlay — just normalize the clip.
    await runFfmpeg(['-i', inputVideo, '-c', 'copy', outPath]).catch(async () => {
      await runFfmpeg(['-i', inputVideo, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', outPath]);
    });
    return outPath;
  }
  const ff = drawtextFont();
  // Slide-in lower-third bar that holds for ~4s then fades.
  const vf = [
    `format=yuv420p`,
    `drawbox=x=80:y=h-220:w=900:h=120:color=black@0.45:t=fill:enable='lt(t,5)'`,
    `drawtext=${ff}text='${escapeDrawtext(title)}':fontcolor=white:fontsize=52:x=110:y=h-200:enable='lt(t,5)':alpha='min(1,t/0.5)'`,
    `drawtext=${ff}text='${escapeDrawtext(caption || '')}':fontcolor=0xC0C0FF:fontsize=34:x=110:y=h-140:enable='lt(t,5)':alpha='min(1,t/0.5)'`,
  ].join(',');
  await runFfmpeg([
    '-i', inputVideo,
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    outPath,
  ]).catch(async () => {
    // Some clips have no audio stream; retry without copying audio.
    await runFfmpeg(['-i', inputVideo, '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-an', outPath]);
  });
  return outPath;
}

/**
 * Optional Remotion backend. Expects a bundled composition at graphics/ and
 * @remotion/renderer installed. Returns true on success, false to fall back.
 */
async function renderCardRemotion({ title, subtitle, duration, outPath }) {
  try {
    const { bundle } = await import('@remotion/bundler');
    const { renderMedia, selectComposition } = await import('@remotion/renderer');
    const entry = path.resolve('graphics/src/index.jsx');
    const serveUrl = await bundle({ entryPoint: entry });
    const inputProps = { title, subtitle, durationInFrames: Math.round(duration * FPS) };
    const composition = await selectComposition({ serveUrl, id: 'Card', inputProps });
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: outPath, inputProps });
    return true;
  } catch {
    return false;
  }
}
