import path from 'node:path';
import { generateSpeech, getRandomVoice, estimateAudioDuration } from '../audio/generator.js';
import { generateSilentAudio, probeDuration } from './ffmpeg.js';

/**
 * Synthesize one audio file per script segment from the generated narration,
 * using ElevenLabs (via the existing audio generator) with a single consistent
 * voice. Segments with no narration (uploaded B-roll) get a short silent track
 * so the timeline still lines up.
 *
 * Returns { voice, audios: [{ path, duration }] } aligned to `segments`.
 */
export async function synthesizeVoiceover({ segments, outputDir, voice, minSegment = 3, log }) {
  const chosenVoice = voice || getRandomVoice();
  log?.(`Synthesizing voiceover (voice ${chosenVoice})`);

  const audios = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const audioPath = path.join(outputDir, `vo-${String(i).padStart(2, '0')}.mp3`);
    const text = (seg.narration || '').trim();

    if (text) {
      const estimated = Math.max(minSegment, estimateAudioDuration(text));
      try {
        await generateSpeech(text, audioPath, { voice: chosenVoice });
      } catch (err) {
        log?.(`TTS failed on segment ${i} (${err.message}) — silent`);
        await generateSilentAudio(audioPath, estimated);
      }
    } else {
      // B-roll/clip segment: short silent bed (clip's own audio is added later).
      await generateSilentAudio(audioPath, minSegment);
    }

    const duration = await probeDuration(audioPath).catch(() => minSegment);
    audios.push({ path: audioPath, duration });
  }

  return { voice: chosenVoice, audios };
}
