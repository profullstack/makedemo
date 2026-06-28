#!/usr/bin/env node
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { runPipeline } from '../packages/core/index.js';

/**
 * Local CLI runner for the makedemo pipeline brain — useful for testing the
 * full crawl -> Claude features -> record -> script -> voiceover -> assemble
 * flow without the web shell. The web app drives runPipeline(job, emit) the
 * same way.
 *
 *   node scripts/run-pipeline.js --url https://example.com \
 *     --clips ./a.mp4,./b.mp4 --song ./suno.mp3 --max-features 5
 */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.url) {
  console.error('Usage: node scripts/run-pipeline.js --url <url> [--user <e> --password <p>] [--clips a.mp4,b.mp4] [--song suno.mp3] [--max-features 5] [--voice <id>]');
  process.exit(1);
}

const job = {
  id: randomUUID().slice(0, 8),
  url: args.url,
  credentials: args.user && args.password ? { user: args.user, password: args.password } : null,
  maxFeatures: args['max-features'] ? Number(args['max-features']) : 5,
  voice: args.voice || null,
  clips: args.clips ? args.clips.split(',').map((s) => s.trim()).filter(Boolean) : [],
  song: args.song || null,
};

const emit = (type, data) => {
  if (type === 'log') console.log(`  ${data.msg}`);
  else if (type === 'stage') console.log(`[${data.stage}] ${data.status}${data.step ? ` ${data.step}/${data.total}` : ''}`);
  else if (type === 'done') console.log(`\n✅ Done: output/${job.id}/${data.video}`);
  else if (type === 'error') console.error(`❌ ${data.message}`);
};

console.log(`Job ${job.id} → ${job.url}`);
runPipeline(job, emit).catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
