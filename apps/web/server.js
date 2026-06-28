import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { stream } from 'hono/streaming';
import { createJob, getJob, publicJob, subscribe } from './lib/jobs.js';
import { OUTPUT_ROOT } from './lib/pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = new Hono();

// --- API ---------------------------------------------------------------

app.post('/api/demos', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const url = (body.url || '').trim();
  if (!/^https?:\/\/.+/i.test(url)) {
    return c.json({ error: 'A valid http(s) URL is required' }, 400);
  }

  const credentials =
    body.user && body.password ? { user: body.user, password: body.password } : null;

  const job = createJob({
    url,
    maxSteps: Number(body.maxSteps) || 6,
    voice: body.voice || null,
    credentials,
  });

  return c.json({ id: job.id }, 201);
});

app.get('/api/demos/:id', (c) => {
  const job = getJob(c.req.param('id'));
  if (!job) return c.json({ error: 'Not found' }, 404);
  return c.json(publicJob(job));
});

// Server-Sent Events stream of pipeline progress.
app.get('/api/demos/:id/events', (c) => {
  const job = getJob(c.req.param('id'));
  if (!job) return c.json({ error: 'Not found' }, 404);

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s) => {
    let closed = false;
    const queue = [];
    let resolveNext;

    const unsubscribe = subscribe(job, (evt) => {
      queue.push(evt);
      resolveNext?.();
    });

    s.onAbort(() => {
      closed = true;
      unsubscribe();
      resolveNext?.();
    });

    try {
      while (!closed) {
        while (queue.length) {
          const evt = queue.shift();
          await s.write(`data: ${JSON.stringify(evt)}\n\n`);
          if (evt.type === 'done' || evt.type === 'error') {
            closed = true;
          }
        }
        if (closed) break;
        await new Promise((r) => (resolveNext = r));
      }
    } finally {
      unsubscribe();
    }
  });
});

// Serve generated artifacts (screenshots, audio, final mp4).
// OUTPUT_ROOT is <project>/output; serveStatic resolves <root>/output/<id>/<file>.
const projectRootRel = path.relative(process.cwd(), path.dirname(OUTPUT_ROOT)) || '.';
app.use('/output/*', serveStatic({ root: projectRootRel }));

// Direct file download with a friendly name.
app.get('/api/demos/:id/video', (c) => {
  const job = getJob(c.req.param('id'));
  if (!job?.video) return c.json({ error: 'Video not ready' }, 404);
  return c.redirect(`/output/${job.id}/${job.video}`);
});

app.get('/healthz', (c) => c.text('ok'));

// --- Static frontend ---------------------------------------------------

app.use('/*', serveStatic({ root: path.relative(process.cwd(), path.join(__dirname, 'public')) }));

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`▶ makedemo web running at http://localhost:${info.port}`);
});
