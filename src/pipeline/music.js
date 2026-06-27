import { runFfmpeg, probeDuration } from './ffmpeg.js';

/**
 * Background-music handling: take the user's uploaded suno.com song clip, loop
 * it to cover the whole video, and duck it under the voiceover.
 *
 * The ducking is a sidechain compressor: the voiceover drives the compressor so
 * the music automatically dips whenever narration plays, then swells back in
 * the gaps. `buildMusicFilter` is pure so it can be unit-tested.
 */

/**
 * Build the ffmpeg -filter_complex string that mixes a looped, ducked music bed
 * under a voiceover track.
 *
 * Inputs are assumed to be: [0:a] = voiceover, [1:a] = music.
 * @returns {string} filter_complex
 */
export function buildMusicFilter({ musicVolume = 0.35, threshold = 0.05, ratio = 8, attack = 20, release = 600 } = {}) {
  // Split the voiceover: one copy is the sidechain key, one is the final VO.
  // The music is volume-reduced, then sidechain-compressed by the VO key, then
  // mixed back with the full-volume voiceover.
  return [
    '[0:a]asplit=2[vo][key]',
    `[1:a]volume=${musicVolume}[bed]`,
    `[bed][key]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[ducked]`,
    '[vo][ducked]amix=inputs=2:duration=first:dropout_transition=0[aout]',
  ].join(';');
}

/**
 * Mix a ducked, looped music bed under a voiceover track into one audio file.
 * @param {string} voicePath  combined voiceover track
 * @param {string} songPath   uploaded suno.com clip
 * @param {string} outPath    output audio path
 * @param {object} [opts]
 */
export async function mixMusicUnderVoice(voicePath, songPath, outPath, opts = {}) {
  const filter = buildMusicFilter(opts);
  await runFfmpeg([
    '-i', voicePath,
    '-stream_loop', '-1', '-i', songPath, // loop the song to outlast the VO
    '-filter_complex', filter,
    '-map', '[aout]',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-shortest',
    outPath,
  ]);
  return outPath;
}

/** True if the uploaded song looks usable (exists and has a real duration). */
export async function validateSong(songPath) {
  try {
    const d = await probeDuration(songPath);
    return Number.isFinite(d) && d > 0.5;
  } catch {
    return false;
  }
}
