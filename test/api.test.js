import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { previewVerdict } from '../shared/verdict.js';
import { mapPoint } from '../src/effects.js';

const input = { image: 'data:image/jpeg;base64,/9j/2Q==', occasion: 'Runway' };

async function withServer(options, run) {
  const server = createApp({ settingsProvider: () => ({}), ...options }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); } finally { await new Promise(resolve => server.close(resolve)); }
}

function judge(base, body = input) {
  return fetch(`${base}/api/judge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('missing credentials produce an actionable error without calling Gemini', async () => {
  await withServer({ apiKey: '', fetchImpl: () => assert.fail('Gemini must not be called') }, async base => {
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.deepEqual(status, { configured: false, keyCount: 0, model: 'gemini-3.6-flash', provider: 'gemini', video: false });
    const response = await judge(base);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /GEMINI_API_KEY/);
  });
});

test('invalid input and foreign origins cannot call Gemini', async () => {
  await withServer({ apiKey: 'test-secret', fetchImpl: () => assert.fail('Gemini must not be called') }, async base => {
    assert.equal((await judge(base, { ...input, image: 'not-an-image' })).status, 400);
    assert.equal((await judge(base, { ...input, previousScene: 'invented' })).status, 400);
    const response = await fetch(`${base}/api/judge`, { method: 'POST', headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(response.status, 403);
  });
});

test('Gemini receives the image and schema while credentials stay on the server', async () => {
  await withServer({ apiKey: 'test-secret', fetchImpl: async (url, options) => {
    assert.match(url, /gemini-3.6-flash:generateContent$/);
    assert.equal(options.headers['x-goog-api-key'], 'test-secret');
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[1].inlineData.data, '/9j/2Q==');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseJsonSchema.required.includes('effects'));
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(previewVerdict) }] } }] });
  } }, async base => {
    const response = await judge(base);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ...previewVerdict, provider: 'gemini' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const status = await (await fetch(`${base}/api/status`)).text();
    assert.ok(!status.includes('test-secret'));
  });
});

test('invalid model output never reaches the animation renderer', async () => {
  for (const output of ['not json', JSON.stringify({ ...previewVerdict, score: 999 }), JSON.stringify({ ...previewVerdict, effects: [{ emoji: '<script>', anchor: 'body', animation: 'orbit' }] })]) {
    await withServer({ apiKey: 'test', fetchImpl: async () => Response.json({ candidates: [{ content: { parts: [{ text: output }] } }] }) }, async base => {
      assert.equal((await judge(base)).status, 502);
    });
  }
});

test('Gemini rate limits return a retryable error', async () => {
  await withServer({ apiKey: 'test', fetchImpl: async () => new Response('{}', { status: 429 }) }, async base => {
    assert.equal((await judge(base)).status, 429);
  });
});

test('overlapping requests do not send duplicate Gemini calls', async () => {
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await withServer({ apiKey: 'test', fetchImpl: async () => {
    entered();
    await gate;
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(previewVerdict) }] } }] });
  } }, async base => {
    const first = judge(base);
    await started;
    assert.equal((await judge(base)).status, 429);
    release();
    assert.equal((await first).status, 200);
  });
});

test('broadcast tokens require Vonage credentials and are reported by status', async () => {
  await withServer({ apiKey: 'test' }, async base => {
    const response = await fetch(`${base}/api/token`);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /VONAGE_APPLICATION_ID/);
  });
  const credentialed = { settingsProvider: () => ({ VONAGE_APPLICATION_ID: 'app-id', VONAGE_PRIVATE_KEY: 'key' }) };
  await withServer({ apiKey: 'test', ...credentialed }, async base => {
    assert.equal((await (await fetch(`${base}/api/status`)).json()).video, true);
  });
});

test('body coordinates match mirrored video with a cover crop', () => {
  assert.deepEqual(mapPoint({ x: .5, y: .5 }, 1280, 720, 600, 600), { x: 300, y: 300 });
  const point = mapPoint({ x: .25, y: .25 }, 1280, 720, 1280, 720);
  assert.deepEqual(point, { x: 960, y: 180 });
  assert.equal(mapPoint({ x: .5, y: 0 }, 720, 1280, 600, 400).y, -(1280 * (600 / 720) - 400) / 2);
});
