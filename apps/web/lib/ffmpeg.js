import { spawn } from 'node:child_process';

/**
 * Run an ffmpeg command and resolve when it completes.
 * @param {string[]} args - ffmpeg arguments (without the leading `ffmpeg`)
 * @param {(line: string) => void} [onLog] - optional stderr line handler
 * @returns {Promise<void>}
 */
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
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Generate a silent audio track of a given duration. Used as a fallback when
 * no ElevenLabs key is configured so the final render still has correct timing.
 * @param {string} outputPath
 * @param {number} durationSec
 */
export async function generateSilentAudio(outputPath, durationSec) {
  await runFfmpeg([
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', String(Math.max(1, durationSec)),
    '-c:a', 'aac',
    '-b:a', '128k',
    outputPath,
  ]);
}
