const $ = (sel) => document.querySelector(sel);

const form = $('#demo-form');
const urlInput = $('#url');
const rollBtn = $('#roll-btn');
const advToggle = $('#adv-toggle');
const adv = $('#adv');
const production = $('#production');
const logEl = $('#log');
const result = $('#result');
const storyboard = $('#storyboard');
const filmstrip = $('#filmstrip');
const envBadge = $('#env-badge');

const seenSteps = new Set();
let currentJob = null;

// Report which engines are configured (purely cosmetic hint).
fetch('/healthz').then(() => {
  envBadge.textContent = 'engine ready';
}).catch(() => { envBadge.textContent = 'engine offline'; });

advToggle.addEventListener('click', () => {
  const open = adv.hidden;
  adv.hidden = !open;
  advToggle.setAttribute('aria-expanded', String(open));
  advToggle.textContent = open ? '– hide scene direction' : '+ scene direction (steps, voice, login)';
});

$('#again').addEventListener('click', () => window.location.reload());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let url = urlInput.value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  rollBtn.disabled = true;
  rollBtn.classList.add('is-rolling');
  $('.roll__label').textContent = 'Rolling…';

  resetViews();
  production.hidden = false;
  storyboard.hidden = false;

  const payload = {
    url,
    maxSteps: Number($('#maxSteps').value) || 6,
    voice: $('#voice').value || null,
    user: $('#user').value || null,
    password: $('#password').value || null,
  };

  try {
    const res = await fetch('/api/demos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start');
    currentJob = data.id;
    log(`scene cut — job ${data.id} queued`, 'info');
    streamEvents(data.id);
  } catch (err) {
    log(err.message, 'error');
    resetButton();
  }
});

function resetViews() {
  logEl.innerHTML = '';
  filmstrip.innerHTML = '';
  seenSteps.clear();
  result.hidden = true;
  document.querySelectorAll('.rail__step').forEach((el) => {
    el.dataset.state = 'idle';
    el.querySelector('[data-status]').textContent = 'idle';
  });
}

function resetButton() {
  rollBtn.disabled = false;
  rollBtn.classList.remove('is-rolling');
  $('.roll__label').textContent = 'Roll demo';
}

function streamEvents(id) {
  const es = new EventSource(`/api/demos/${id}/events`);
  es.onmessage = (e) => {
    let evt;
    try { evt = JSON.parse(e.data); } catch { return; }
    handleEvent(evt);
    if (evt.type === 'done' || evt.type === 'error') es.close();
  };
  es.onerror = () => {
    // EventSource auto-retries; only surface if we never got a terminal event.
  };
}

function handleEvent({ type, data }) {
  switch (type) {
    case 'log':
      log(data.msg, data.level);
      break;
    case 'stage':
      updateStage(data);
      break;
    case 'script':
      renderStoryboard(data.steps);
      if (data.title) log(`script locked — "${data.title}"`, 'info');
      break;
    case 'asset':
      log(`asset · step ${data.index} · ${data.duration?.toFixed?.(1) ?? '?'}s narration`, 'info');
      break;
    case 'clip':
      log(`clip ${data.index} rendered`, 'info');
      break;
    case 'video':
      log('final cut encoded', 'info');
      break;
    case 'done':
      finish(data);
      break;
    case 'error':
      log(`✖ ${data.message}`, 'error');
      resetButton();
      break;
  }
}

function updateStage({ stage, status, step, total }) {
  const el = document.querySelector(`.rail__step[data-stage="${stage}"]`);
  if (!el) return;
  const statusEl = el.querySelector('[data-status]');
  if (status === 'running') {
    el.dataset.state = 'running';
    statusEl.textContent = step && total ? `${step}/${total}` : 'working';
  } else if (status === 'done') {
    el.dataset.state = 'done';
    statusEl.textContent = '✓ done';
  }
}

function renderStoryboard(steps) {
  for (const step of steps) {
    if (seenSteps.has(step.index)) continue;
    seenSteps.add(step.index);

    const frame = document.createElement('div');
    frame.className = 'frame';
    frame.style.animationDelay = `${step.index * 60}ms`;

    const shotUrl = `/output/${currentJob}/${step.screenshot}`;
    frame.innerHTML = `
      <div class="frame__shot" style="background-image:url('${shotUrl}')">
        <span class="frame__chip">${escapeHtml(step.type)}</span>
        <span class="frame__num">${String(step.index + 1).padStart(2, '0')}</span>
      </div>
      <div class="frame__text">${escapeHtml(step.narration)}</div>
    `;
    filmstrip.appendChild(frame);
  }
}

function finish(data) {
  resetButton();
  if (!data.video) return;
  const src = `/output/${currentJob}/${data.video}`;
  $('#video').src = src;
  $('#download').href = src;
  $('#download').setAttribute('download', `makedemo-${currentJob}.mp4`);
  $('#transcript-link').href = `/output/${currentJob}/transcript.txt`;
  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  log('★ demo ready', 'info');
}

function log(msg, level = 'info') {
  const line = document.createElement('div');
  line.className = `log__line ${level}`;
  const t = new Date().toLocaleTimeString('en-GB');
  line.innerHTML = `<span class="t">${t}</span>  ${escapeHtml(msg)}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
