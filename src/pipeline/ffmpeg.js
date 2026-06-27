import { spawn } from 'node:child_process';

/** Run ffmpeg with the given args; resolves on success, rejects on non-zero. */
export function runFfmpeg(args, onLog) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onLog?.(text.trim());
    });
    proc.on('error', (err) => reject(new Error(`ffmpeg failed to start: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/** Probe a media file's duration in seconds (ffprobe). */
export function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      file,
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

/** Generate a silent stereo AAC track of a given duration (timing fallback). */
export async function generateSilentAudio(outputPath, durationSec) {
  await runFfmpeg([
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', String(Math.max(1, durationSec)),
    '-c:a', 'aac', '-b:a', '128k',
    outputPath,
  ]);
}
