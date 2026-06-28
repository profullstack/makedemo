# makedemo pipeline brain (Claude feature-detection + media pipeline)

This document describes the `src/pipeline/` module: a qaaas-style flow that turns
a URL into a finished, scored-for-vibes demo video — animated motion graphics,
recorded feature clips, user-uploaded B-roll, a Claude-written voiceover, and a
ducked surreal/metal background track from a suno.com song.

It is designed as a **drop-in for the web upload UI** (built in parallel on the
`feat/web-app` branch): it speaks the same `job` / `emit(type, data)` contract.

## Why this exists

The original makedemo planned interactions on a **single page** with OpenAI and
narrated each click. This brain borrows the qaaas QA flow instead:

> crawl the whole site → let Claude pick the real features → act on each feature
> → let Claude write the script → synthesize → assemble.

…and extends it for marketing video: real screen-recorded clips, uploaded
clips, motion graphics, one cohesive voiceover, and music.

## Pipeline stages

| Stage | Module | What it does |
|---|---|---|
| 1. discover | `crawl.js` + `feature-detect.js` | Same-origin BFS crawl (optionally logged in), then Claude picks the demo-worthy features (name, pitch, start URL, concrete steps). Structured output via zod. Heuristic fallback with no key. |
| 2. record | `feature-recorder.js` | Playwright `recordVideo` per feature, performing the feature's steps, → one `.webm` clip each. |
| 3. script | `script-writer.js` | Claude writes ONE cohesive timeline (intro → features/clips → outro) with on-screen titles, captions, spoken narration, **and a ready-to-paste suno.com surreal/metal music prompt**. |
| 4. voiceover | `voiceover.js` | ElevenLabs TTS per segment (one consistent voice), silent beds for B-roll. |
| 5. assemble | `timeline.js` + `graphics.js` + `music.js` + `assembly.js` | Build a timeline from voiceover durations; render animated cards + lower-thirds; concat segment videos; build the continuous voiceover; **duck the uploaded song under it**; mux → `demo.mp4`. |

Orchestrated by `index.js#runPipeline(job, emit)`.

## The job + event contract (drop-in for the web shell)

```js
// job (superset of the existing web job)
{
  id, url,
  credentials: { user, password } | null,
  maxFeatures: number,           // default 5
  voice: string | null,          // ElevenLabs voice id
  clips: string[],               // paths to user-uploaded video clips
  song: string | null,           // path to an uploaded suno.com song clip
}

// emit(type, data) — same vocabulary as web/lib/jobs.js
//   'stage'  { stage, status, step?, total? }   stage ∈ discover|record|script|voiceover|assemble
//   'log'    { level, msg }
//   'script' { features? , title?, segments?, sunoPrompt? }
//   'video'  { video }
//   'done'   { video, features, sunoPrompt }
//   'error'  { message }
```

The web shell can swap its `web/lib/pipeline.js` import for:

```js
import { runPipeline, OUTPUT_ROOT } from '../../src/pipeline/index.js';
// in runPipeline(job) inside jobs.js:
await runPipeline(job, (type, data) => emit(job, type, data));
```

Outputs land in `output/<jobId>/`: `demo.mp4`, `transcript.txt`, `suno-prompt.txt`,
per-feature `feature-NN.webm`, per-segment voiceover, and a `work/` scratch dir.

## Music: the suno.com flow

1. The script writer emits a **surreal/metal Suno prompt** (saved to
   `suno-prompt.txt` and emitted on the `script` event) — the user pastes it into
   suno.com and downloads a clip.
2. The uploaded clip is passed as `job.song`. `music.js` loops it to cover the
   whole video and **sidechain-compresses it against the voiceover** so the bed
   ducks under narration and swells in the gaps.
3. No song → voiceover-only audio (still a complete video).

## Motion graphics

`graphics.js` has two backends:

- **ffmpeg (default):** animated `mandelbrot` background (surreal, zero-asset),
  fading kinetic title/subtitle, and slide-in lower-thirds burned onto clips.
- **Remotion (opt-in, `MKDEMO_REMOTION=1`):** full React motion graphics via
  `@remotion/renderer` + a `graphics/` composition. Falls back to ffmpeg if the
  optional deps/project aren't present.

## Smart path vs fallback

Every external dependency degrades gracefully, matching makedemo's existing
style:

| Missing | Behavior |
|---|---|
| `ANTHROPIC_API_KEY` | Heuristic feature list + deterministic script (no Claude). |
| `ELEVENLABS_API_KEY` | Silent timed voiceover (timing preserved). |
| `job.song` | Voiceover-only audio. |
| `@remotion/*` | ffmpeg motion-graphics backend. |

## Running locally

```bash
pnpm install
npx playwright install chromium      # browsers for crawl + recording
node scripts/run-pipeline.js --url https://example.com \
  --clips ./a.mp4,./b.mp4 --song ./suno.mp3 --max-features 5
```

Unit tests for the pure pieces (timeline math, music filter, URL globs):

```bash
pnpm run test:pipeline
```

## Status / what's wired vs. pending

- **Wired & unit-tested:** timeline math, ducking-filter construction, crawl
  URL globbing.
- **Wired (needs keys/browsers/ffmpeg to run end-to-end):** crawl, Claude
  feature detection + script, Playwright recording, ElevenLabs voiceover,
  ffmpeg assembly with ducked music.
- **Scaffolded:** Remotion backend (ffmpeg backend is the default and fully
  functional); a Claude action-loop for richer in-clip interactions (current
  recorder uses a light step interpreter) is the next upgrade.
