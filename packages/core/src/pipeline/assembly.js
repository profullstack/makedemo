import path from 'node:path';
import fs from 'node:fs/promises';
import { runFfmpeg } from './ffmpeg.js';
import { renderCard, overlayLowerThird } from './graphics.js';
import { mixMusicUnderVoice, validateSong } from './music.js';

const W = 1920;
const H = 1080;
const FPS = 30;
const PAD_COLOR = '0x0d0c0f';

/**
 * Assemble the final MP4 from a built timeline.
 *
 * Video and audio are built as two independent tracks, then muxed:
 *   - VIDEO: each segment -> a normalized, silent 1080p/30fps clip (animated
 *     card for intro/outro; recorded feature webm or uploaded clip otherwise,
 *     with an animated lower-third burned on). Concatenated in order.
 *   - AUDIO: each segment's voiceover, padded to the segment's exact duration,
 *     concatenated into one continuous voice track, then (if a suno.com song
 *     was uploaded) ducked under the looped music bed.
 *
 * @param {object} opts
 * @param {Array}  opts.timeline   built timeline (see timeline.js)
 * @param {Array<{path,duration}>} opts.audios  per-segment voiceover (aligned)
 * @param {Array<{path}>}  opts.featureClips    recorded feature clips (mp4/webm on disk)
 * @param {string[]} opts.uploadedClips         user-uploaded clip paths
 * @param {string|null} opts.song               uploaded suno.com song path
 * @param {string} opts.workDir
 * @param {string} opts.outPath
 * @param {(m:string)=>void} [opts.log]
 */
export async function assembleVideo(opts) {
  const { timeline, audios, featureClips, uploadedClips, song, workDir, outPath, log } = opts;
  await fs.mkdir(workDir, { recursive: true });

  // 1. Build one normalized, silent video clip per segment.
  const segVideos = [];
  for (const seg of timeline) {
    const out = path.join(workDir, `seg-${String(seg.index).padStart(2, '0')}.mp4`);
    log?.(`Rendering segment ${seg.index + 1}/${timeline.length} (${seg.kind})`);

    if (seg.kind === 'intro' || seg.kind === 'outro') {
      await renderCard({ title: seg.title, subtitle: seg.caption, duration: seg.duration, outPath: out });
    } else {
      const src = sourceForSegment(seg, featureClips, uploadedClips);
      if (!src) {
        // Missing source — render a titled card so the timeline stays intact.
        await renderCard({ title: seg.title || '', subtitle: seg.caption || '', duration: seg.duration, outPath: out });
      } else {
        const normalized = path.join(workDir, `norm-${String(seg.index).padStart(2, '0')}.mp4`);
        await normalizeClip(src, seg.duration, normalized);
        await overlayLowerThird(normalized, { title: seg.title, caption: seg.caption, outPath: out });
      }
    }
    segVideos.push(out);
  }

  // 2. Concat the segment videos (identical params -> stream copy).
  const videoTrack = path.join(workDir, 'video.mp4');
  await concatCopy(segVideos, path.join(workDir, 'video-list.txt'), videoTrack);

  // 3. Build the continuous voiceover track (pad each segment to its duration).
  const paddedVo = [];
  for (const seg of timeline) {
    const vo = audios[seg.index];
    const out = path.join(workDir, `voa-${String(seg.index).padStart(2, '0')}.m4a`);
    await padAudioToDuration(vo.path, seg.duration, out);
    paddedVo.push(out);
  }
  const voiceTrack = path.join(workDir, 'voice.m4a');
  await concatAudioFilter(paddedVo, voiceTrack);

  // 4. Mix in the ducked music bed if a song was uploaded.
  let audioTrack = voiceTrack;
  if (song && (await validateSong(song))) {
    log?.('Ducking suno.com song under the voiceover');
    audioTrack = path.join(workDir, 'final-audio.m4a');
    await mixMusicUnderVoice(voiceTrack, song, audioTrack);
  } else if (song) {
    log?.('Uploaded song unreadable — continuing with voiceover only');
  }

  // 5. Mux video + audio.
  await runFfmpeg([
    '-i', videoTrack,
    '-i', audioTrack,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart',
    outPath,
  ]);
  log?.(`Final video written: ${outPath}`);
  return outPath;
}

function sourceForSegment(seg, featureClips, uploadedClips) {
  if (seg.kind === 'feature' && seg.featureIndex != null) return featureClips[seg.featureIndex]?.path;
  if (seg.kind === 'clip' && seg.clipIndex != null) return uploadedClips[seg.clipIndex];
  return null;
}

// Scale + letterbox a source to 1080p/30fps, looping short clips and trimming to
// an exact duration. Output is silent so audio can be assembled independently.
async function normalizeClip(src, duration, outPath) {
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${PAD_COLOR},fps=${FPS},format=yuv420p`;
  await runFfmpeg([
    '-stream_loop', '-1', '-i', src,
    '-t', String(duration),
    '-vf', vf,
    '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    outPath,
  ]);
}

async function concatCopy(files, listFile, outPath) {
  await fs.writeFile(listFile, files.map((f) => `file '${f}'`).join('\n'), 'utf8');
  await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outPath]);
}

// Pad (or trim) an audio file to an exact duration; normalize to stereo/44.1k AAC.
async function padAudioToDuration(audioPath, duration, outPath) {
  await runFfmpeg([
    '-i', audioPath,
    '-af', 'apad',
    '-t', String(duration),
    '-ar', '44100', '-ac', '2',
    '-c:a', 'aac', '-b:a', '192k',
    outPath,
  ]);
}

// Concatenate audio segments with the concat filter (robust across containers).
async function concatAudioFilter(files, outPath) {
  const inputs = files.flatMap((f) => ['-i', f]);
  const filter = files.map((_, i) => `[${i}:a]`).join('') + `concat=n=${files.length}:v=0:a=1[a]`;
  await runFfmpeg([
    ...inputs,
    '-filter_complex', filter,
    '-map', '[a]',
    '-ar', '44100', '-ac', '2',
    '-c:a', 'aac', '-b:a', '192k',
    outPath,
  ]);
}
