// @makedemo/core — shared demo-generation pipeline.
// Re-exports the building blocks used by both the CLI and the web app.

export { BrowserManager } from './src/browser/manager.js';
export { AuthenticationHandler } from './src/auth/handler.js';
export { AIDecisionMaker } from './src/ai/decision-maker.js';
export { VideoProcessor } from './src/video/processor.js';
export {
  generateSpeech,
  estimateAudioDuration,
  getRandomVoice,
  getAvailableVoices,
  VOICES,
} from './src/audio/generator.js';
export { createDemo } from './src/index.js';
// Pipeline brain: crawl -> Claude feature detection -> per-feature recording ->
// Claude VO script + Suno prompt -> ElevenLabs -> motion-graphics assembly.
export { runPipeline, OUTPUT_ROOT as PIPELINE_OUTPUT_ROOT } from './src/pipeline/index.js';
