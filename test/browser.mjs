import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { previewVerdict } from '../shared/verdict.js';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', entry => { if (entry.type() === 'error') console.log('Browser error:', entry.text()); });
try {
  if (!process.env.LIVE_GEMINI_TEST) {
    await page.route('**/api/judge', route => route.fulfill({ json: { ...previewVerdict, title: 'Sporty layers', occasion: 'Activewear', formats: ['glints', 'prisms', 'stickers'] } }));
  }
  await page.goto('http://localhost:5173');
  await page.locator('.brand').waitFor();
  await page.screenshot({ path: '/tmp/vogue-vision-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Preview effects' }).click();
  await page.getByText('PREVIEW', { exact: true }).waitFor();
  await page.waitForTimeout(1200);
  const frameA = await page.locator('#effects').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(200);
  const frameB = await page.locator('#effects').evaluate(canvas => canvas.toDataURL());
  assert.notEqual(frameA, frameB, 'Emoji frames should animate');
  await page.screenshot({ path: '/tmp/vogue-vision-preview.png', fullPage: true });
  for (const scene of ['galaxy', 'inferno', 'electric', 'butterflies', 'disco', 'vortex']) {
    await page.getByRole('combobox', { name: 'AR scene' }).selectOption(scene);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#effects').getAttribute('data-scene'), scene);
    await page.screenshot({ path: `/tmp/vogue-vision-${scene}.png`, fullPage: true });
  }
  await page.getByRole('combobox', { name: 'AR scene' }).selectOption('auto');
  console.log('All six 3D scenes rendered.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/vogue-vision-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile should not overflow');
  await page.screenshot({ path: '/tmp/vogue-vision-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  const fixture = `data:image/jpeg;base64,${(await readFile('/tmp/fit-check-test-pose.jpg')).toString('base64')}`;
  await page.evaluate(async imageUrl => {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    window.fixtureCrop = null;
    window.fixtureTimer = setInterval(() => {
      if (window.fixtureCrop) context.drawImage(image, ...window.fixtureCrop, 0, 0, canvas.width, canvas.height);
      else context.drawImage(image, 0, 0);
    }, 33);
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(30);
  }, fixture);
  await page.getByRole('button', { name: 'Start live mirror', exact: true }).click();
  await page.getByText('● BODY TRACKED', { exact: true }).waitFor({ timeout: 40000 });
  console.log('Pose tracker detected the sample person.');
  await page.locator('#verdict').waitFor({ timeout: 45000 });
  assert.match(await page.locator('#occasion').textContent(), /detected|unclear/);
  assert.equal(await page.getByRole('combobox', { name: 'Occasion', exact: true }).count(), 0);
  console.log(process.env.LIVE_GEMINI_TEST ? 'Gemini reacted automatically:' : 'Automatic verdict UI passed with a test response:', await page.locator('#verdict-title').textContent());
  await page.getByRole('button', { name: /Live reactions/ }).click();
  assert.equal(await page.locator('#judge').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#effects').getAttribute('data-render-mode'), 'composited-video');
  await page.waitForTimeout(1500);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '↓ Save 6s clip' }).click();
  const download = await downloadPromise;
  await download.saveAs('/tmp/vogue-vision-ar-test.webm');
  console.log('Composited AR video exported.');
  await page.screenshot({ path: '/tmp/vogue-vision-tracking.png', fullPage: true });
  await page.setViewportSize({ width: 700, height: 900 });
  await page.evaluate(() => { window.fixtureCrop = [350, 190, 350, 233]; });
  await page.waitForFunction(() => document.getElementById('effects').dataset.framing === 'closeup');
  await page.waitForTimeout(1500);
  for (const scene of ['galaxy', 'inferno', 'electric', 'butterflies', 'disco', 'vortex']) {
    await page.getByRole('combobox', { name: 'AR scene' }).selectOption(scene);
    await page.waitForTimeout(900);
    const metrics = await page.locator('#effects').evaluate(canvas => ({ count: Number(canvas.dataset.visibleEffects), size: Number(canvas.dataset.maxEffectSize), width: canvas.clientWidth }));
    assert.ok(metrics.count <= 7, `${scene} close-up should stay sparse`);
    assert.ok(metrics.size <= metrics.width * .05, `${scene} effects should fit the person`);
    await page.screenshot({ path: `/tmp/vogue-vision-closeup-${scene}.png`, fullPage: true });
  }
  console.log('Close-up density and scale passed for all six scenes.');
  await page.getByRole('button', { name: 'Stop camera' }).click();
  assert.equal(await page.locator('#camera').evaluate(video => video.srcObject), null);
  assert.equal(await page.locator('#judge').isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('Desktop, mobile, 3D preview, real pose inference, automatic reaction flow, pause, video export, and camera stop passed.');
} finally {
  await browser.close();
}
