import { parseStructured } from './llm.js';
import { demoScriptSchema } from './schemas.js';

/**
 * Write one cohesive voiceover script + a surreal/metal Suno music prompt.
 *
 * Given the detected features and the count of user-uploaded clips, Claude
 * produces an ordered timeline of segments (intro -> features/clips -> outro),
 * each with on-screen title, caption, and a spoken narration line. It also
 * writes a ready-to-paste suno.com prompt for the surreal/metal background bed.
 *
 * Falls back to a deterministic script when no ANTHROPIC_API_KEY is set, so the
 * pipeline always produces something renderable.
 */
export async function writeScript({ productUrl, features, clipCount = 0, log }) {
  log?.('Writing the voiceover script + Suno music prompt');

  const result = await parseStructured({
    system:
      'You are a scriptwriter for a high-energy product demo video with a surreal, metal aesthetic. You are given the product URL, the features being shown (each already has a recorded screen clip), and the number of extra user-uploaded video clips to intercut. Produce: (1) an overall title and tagline; (2) an ordered list of timeline segments. Start with an "intro" segment, then weave "feature" segments (set featureIndex to the feature being shown, clipIndex null) and "clip" segments for the uploaded clips (set clipIndex 0..N-1, featureIndex null), and finish with an "outro" segment. Every feature should appear once; spread the uploaded clips between features as B-roll. For each segment write a punchy on-screen title, a short caption, and a narration line written to be spoken aloud (no stage directions). Keep narration tight — one or two sentences. (3) A vivid suno.com prompt for a SURREAL, METAL instrumental bed that matches the energy (mention tempo, instrumentation, mood, and that it must loop and sit under a voiceover).',
    prompt: `Product URL: ${productUrl}\nUploaded B-roll clips available: ${clipCount}\n\nFeatures (in intended order):\n${features
      .map((f, i) => `${i}. ${f.name} — ${f.pitch} (url: ${f.featureUrl})`)
      .join('\n')}`,
    schema: demoScriptSchema,
    maxTokens: 8000,
  });

  if (result && result.segments?.length) {
    log?.(`Script: "${result.title}" with ${result.segments.length} segment(s)`);
    return result;
  }

  log?.('No LLM script — using heuristic script');
  return heuristicScript({ productUrl, features, clipCount });
}

function heuristicScript({ productUrl, features, clipCount }) {
  const host = safeHost(productUrl);
  const segments = [
    {
      kind: 'intro',
      featureIndex: null,
      clipIndex: null,
      title: host,
      caption: 'A quick tour',
      narration: `Welcome to ${host}. Let's take a fast tour of what it can do.`,
    },
  ];

  let clipsUsed = 0;
  features.forEach((f, i) => {
    segments.push({
      kind: 'feature',
      featureIndex: i,
      clipIndex: null,
      title: f.name,
      caption: f.pitch.slice(0, 60),
      narration: f.pitch,
    });
    // Intercut an uploaded clip after every other feature.
    if (clipsUsed < clipCount && i % 2 === 1) {
      segments.push({
        kind: 'clip',
        featureIndex: null,
        clipIndex: clipsUsed,
        title: '',
        caption: '',
        narration: '',
      });
      clipsUsed += 1;
    }
  });

  // Any remaining uploaded clips go before the outro.
  while (clipsUsed < clipCount) {
    segments.push({ kind: 'clip', featureIndex: null, clipIndex: clipsUsed, title: '', caption: '', narration: '' });
    clipsUsed += 1;
  }

  segments.push({
    kind: 'outro',
    featureIndex: null,
    clipIndex: null,
    title: 'Try it yourself',
    caption: host,
    narration: `That's ${host}. Come see what you can build.`,
  });

  return {
    title: host,
    tagline: 'A quick tour',
    segments,
    sunoPrompt:
      'Surreal, cinematic metal instrumental: driving down-tuned guitars and double-kick drums under dreamy, reverb-drenched synth pads; ~140 BPM, dark and euphoric, seamless loop, leaves headroom for a spoken voiceover.',
  };
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'this product';
  }
}
