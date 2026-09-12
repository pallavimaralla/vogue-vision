import './style.css';
import { createEffects } from './effects.js';
import { previewVerdict, verdictSchema, scenes, scenePreview } from '../shared/verdict.js';

const sparkle = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" fill="currentColor"/></svg>';
const cameraIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 1.5-3h5L16 6"/><circle cx="12" cy="13" r="3.5"/></svg>';

document.querySelector('#app').innerHTML = `
  <header class="header"><span class="brand">${sparkle} Vogue Vision</span><div id="connection" class="connection"><span class="status-dot"></span><span id="connection-text">Connecting…</span></div></header>
  <main>
    <section id="stage" class="stage" aria-label="Live AR mirror">
      <video id="camera" autoplay playsinline muted></video>
      <div id="placeholder" class="placeholder">
        <div class="ambient"></div>
        <svg class="silhouette" viewBox="0 0 300 500" fill="none" aria-hidden="true"><defs><linearGradient id="figure" x1="150" y1="20" x2="150" y2="480" gradientUnits="userSpaceOnUse"><stop stop-color="#656a53"/><stop offset="1" stop-color="#242820"/></linearGradient></defs><ellipse cx="150" cy="66" rx="34" ry="43" fill="url(#figure)"/><path d="M132 103h36l9 18 49 21 23 141-23 7-28-104-7 131 17 163h-42l-16-139-16 139H92l17-163-7-131-28 104-23-7 23-141 49-21 9-18Z" fill="url(#figure)" stroke="#858c6633"/></svg>
        <div id="empty-copy" class="empty-copy"><button id="start-camera" class="button light">${cameraIcon} Start live mirror</button><span>Automatic Gemini snapshots while live.</span></div>
      </div>
      <div id="remote" style="position:absolute;inset:0;z-index:1;background:#000;" hidden></div>
      <div id="publisher" style="position:absolute;left:-9999px;top:0;width:320px;height:240px;pointer-events:none;"></div>
      <canvas id="effects" aria-label="Live video with 3D emoji effects"></canvas>
      <div class="stage-top"><span class="stage-pill"><i id="live-dot"></i><span id="stage-mode">CAMERA OFF</span></span><select id="scene" class="scene-select" aria-label="AR scene"><option value="auto">Auto AR</option><option value="galaxy">🪐 Galaxy</option><option value="inferno">🔥 Inferno</option><option value="electric">⚡ Electric</option><option value="butterflies">🦋 Butterflies</option><option value="disco">🪩 Disco</option><option value="vortex">🌀 Vortex</option></select><span id="tracking" class="stage-pill subtle">BODY TRACKING</span></div>
      <div id="scan-label" class="scan-label" hidden>✦ Reading your fit…</div>
      <div id="verdict" class="verdict" hidden><div class="verdict-heading"><span id="hero-emoji"></span><h2 id="verdict-title"></h2><span id="score-row" hidden><strong id="score"></strong></span></div><p id="reaction"></p><div id="tip-box" hidden><p id="tip"></p></div><span id="verdict-tag" class="small-tag"></span><div id="waiting-note" hidden></div></div>
      <div id="preview-label" class="preview-label" hidden>PREVIEW</div>
      <div class="stage-bottom"><span id="frame-hint"></span><div class="video-actions"><button id="record" class="icon-button" hidden>↓ Save 6s clip</button><button id="stop-camera" class="icon-button" hidden>Stop camera</button></div></div>
    </section>
    <div class="toolbar"><span id="occasion" class="detected-occasion" aria-label="Detected outfit occasion">Detecting style</span><button id="preview" class="preview-button">Preview effects</button><button id="clear" class="clear-button" hidden>Clear</button><button id="judge" class="button primary" disabled>${sparkle}<span>Live reactions</span><span class="button-arrow">Ⅱ</span></button></div>
    <div id="share" style="margin-top:12px;font-size:9px;letter-spacing:1.4px;color:#a8bd97;" hidden></div>
    <div id="message" class="message" role="status" aria-live="polite" hidden></div>
    <details id="setup" class="setup" hidden><summary>Connect Gemini</summary><p>Add GEMINI_API_KEY to .env and restart.</p><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get API key ↗</a></details>
  </main>
`;

const $ = (id) => document.getElementById(id);
const video = $('camera');
const renderer = createEffects($('effects'), video);
let stream = null, worker = null, workerReady = false, workerBusy = false, lastDetection = 0;
let configured = false, judging = false, cameraStarting = false, cameraGeneration = 0, requestGeneration = 0;
let previewActive = false, requestController = null;
let trackingTimer;
let autoEnabled = true, nextCheck = 0, lastPersonAt = 0;
let recording = false;
let lastVerdict = previewVerdict, previewIndex = -1;
let videoReady = false, broadcasting = false, otSession = null, otPublisher = null, subscriber = null, viewers = 0;

function message(text = '') { $('message').textContent = text; $('message').hidden = !text; }
function updateJudge() {
  $('judge').disabled = !stream || !configured;
  $('judge').querySelector('span').textContent = autoEnabled ? 'Live reactions' : 'Resume reactions';
  $('judge').querySelector('.button-arrow').textContent = autoEnabled ? 'Ⅱ' : '▶';
  $('judge').classList.toggle('paused', !autoEnabled);
  $('judge').setAttribute('aria-pressed', String(autoEnabled));
}
function setTracking(text) { $('tracking').textContent = text; }

async function initTracking() {
  if (worker) return;
  setTracking('LOADING TRACKER');
  worker = new Worker('/pose-worker.js');
  const timer = trackingTimer = setTimeout(() => {
    if (!workerReady) trackingFailed();
  }, 25000);
  function trackingFailed() {
    clearTimeout(timer);
    workerReady = false;
    workerBusy = false;
    worker?.terminate();
    worker = null;
    renderer.setPose(null);
    setTracking('TRACKING UNAVAILABLE');
    message('Body tracking could not load. Stop and restart the camera to retry. Automatic reactions need a visible, tracked person.');
  }
  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') { clearTimeout(timer); workerReady = true; setTracking('FINDING YOUR POSE'); }
    if (data.type === 'pose') {
      workerBusy = false;
      renderer.setPose(data.landmarks, data.mask, data.maskWidth, data.maskHeight);
      if (data.landmarks) lastPersonAt = Date.now();
      setTracking(data.landmarks ? '● BODY TRACKED' : 'STEP INTO FRAME');
    }
    if (data.type === 'error') trackingFailed();
  };
  worker.onerror = trackingFailed;
  worker.postMessage({ type: 'init', origin: location.origin });
}

async function track(now) {
  if (stream && workerReady && !workerBusy && video.readyState >= 2 && now - lastDetection > 85) {
    workerBusy = true;
    lastDetection = now;
    try {
      const frame = await createImageBitmap(video);
      if (worker && stream) worker.postMessage({ type: 'frame', frame, timestamp: now }, [frame]);
      else { frame.close(); workerBusy = false; }
    } catch { workerBusy = false; }
  }
  requestAnimationFrame(track);
}
requestAnimationFrame(track);

async function startCamera() {
  if (cameraStarting || stream) return;
  cameraStarting = true;
  const generation = ++cameraGeneration;
  $('start-camera').disabled = true;
  message();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');
    const OT = await loadOpenTok();
    const session = await connectSession();
    otPublisher = OT.initPublisher($('publisher'), { insertMode: 'append', width: '100%', height: '100%', resolution: '1280x720', audioSource: null, showControls: false });
    const captured = await publisherStream($('publisher'));
    if (generation !== cameraGeneration) { stopBroadcast(); return; }
    await new Promise((resolve, reject) => session.publish(otPublisher, error => error ? reject(new Error(error.message)) : resolve()));
    broadcasting = true;
    subscriber = null;
    $('remote').hidden = true;
    $('remote').replaceChildren();
    stream = captured;
    video.srcObject = stream;
    await video.play();
    $('placeholder').hidden = true;
    $('stage').classList.remove('previewing');
    nextCheck = Date.now() + 1800;
    autoEnabled = true;
    renderer.clear();
    $('preview-label').hidden = true;
    $('occasion').textContent = 'Detecting style';
    $('stop-camera').hidden = false;
    $('record').hidden = false;
    $('stage-mode').textContent = 'LIVE MIRROR';
    $('live-dot').classList.add('active');
    $('frame-hint').textContent = 'Step into frame. Your aura reacts automatically.';
    renderer.setPreview(false);
    stream.getVideoTracks()[0].onended = stopCamera;
    await initTracking();
    updateJudge();
    updateLive();
  } catch (error) {
    stopCamera();
    const errors = { NotAllowedError: 'Camera access was denied. Allow camera access in your browser, then try again.', NotFoundError: 'No camera was found. Connect a camera or preview the animations.', NotReadableError: 'Your camera is busy. Close another app using it, then try again.' };
    message(errors[error.name] || 'Camera unavailable. Open this app on localhost in Chrome, or preview the animations.');
  } finally { cameraStarting = false; $('start-camera').disabled = false; }
}

function stopCamera() {
  stopBroadcast();
  clearTimeout(trackingTimer);
  cameraGeneration++;
  requestGeneration++;
  requestController?.abort();
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  worker?.terminate();
  worker = null;
  workerReady = false;
  workerBusy = false;
  renderer.setPose(null);
  renderer.setPreview(previewActive);
  if (!previewActive) renderer.clear();
  $('stage').classList.toggle('previewing', previewActive);
  $('placeholder').hidden = false;
  $('stop-camera').hidden = true;
  $('record').hidden = true;
  lastPersonAt = 0;
  $('stage-mode').textContent = previewActive ? 'EFFECTS PREVIEW' : 'CAMERA OFF';
  $('live-dot').classList.remove('active');
  $('frame-hint').textContent = '';
  $('verdict').hidden = true;
  $('occasion').textContent = 'Detecting style';
  setTracking('BODY TRACKING');
  updateJudge();
}

function showVerdict(verdict, isPreview = false) {
  previewActive = isPreview;
  lastVerdict = verdict;
  $('verdict').hidden = isPreview;
  $('occasion').textContent = isPreview ? 'Preview' : verdict.occasion === 'Unclear' ? 'Style unclear' : `${verdict.occasion} · detected`;
  $('verdict-title').textContent = verdict.title;
  $('reaction').textContent = verdict.reaction;
  $('hero-emoji').textContent = verdict.effects[0].emoji;
  $('hero-emoji').classList.add('revealed');
  $('score').textContent = `${verdict.score}/10`;
  $('score-row').hidden = isPreview || !verdict.visible;
  $('tip-box').hidden = true;
  $('tip').textContent = verdict.tip;
  $('waiting-note').hidden = true;
  $('verdict-tag').textContent = isPreview ? 'SAMPLE REACTION' : 'GEMINI REACTION';
  $('preview-label').hidden = !isPreview;
  $('clear').hidden = false;
  $('stage').classList.toggle('previewing', isPreview && !stream);
  document.documentElement.dataset.palette = verdict.palette;
  if (verdict.visible) renderer.setVerdict({ ...verdict, ...($('scene').value === 'auto' ? {} : { scene: $('scene').value, formats: scenePreview($('scene').value).formats }) }, isPreview && !stream);
  else renderer.clear();
}

$('start-camera').onclick = startCamera;
$('stop-camera').onclick = stopCamera;
$('preview').onclick = () => {
  message();
  previewIndex = (previewIndex + 1) % scenes.length;
  const selected = $('scene').value === 'auto' ? scenes[previewIndex] : $('scene').value;
  showVerdict(scenePreview(selected), true);
  if (!stream) $('stage-mode').textContent = 'EFFECTS PREVIEW';
};
$('clear').onclick = () => {
  renderer.clear();
  previewActive = false;
  $('preview-label').hidden = true;
  $('stage').classList.remove('previewing');
  $('stage-mode').textContent = stream ? 'LIVE MIRROR' : 'CAMERA OFF';
  $('clear').hidden = true;
  $('verdict').hidden = true;
};
async function analyzeOutfit() {
  if (!stream || judging || video.readyState < 2) return;
  judging = true;
  const generation = ++requestGeneration;
  requestController = new AbortController();
  updateJudge();
  message();
  renderer.setScanning(true);
  $('scan-label').hidden = false;
  $('stage-mode').textContent = 'READING YOUR AURA';
  const timeout = setTimeout(() => requestController?.abort(), 35000);
  try {
    const snapshot = document.createElement('canvas');
    const scale = Math.min(1, 960 / video.videoWidth);
    snapshot.width = video.videoWidth * scale;
    snapshot.height = video.videoHeight * scale;
    snapshot.getContext('2d').drawImage(video, 0, 0, snapshot.width, snapshot.height);
    const response = await fetch('/api/judge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: requestController.signal,
      body: JSON.stringify({ image: snapshot.toDataURL('image/jpeg', .82), previousScene: lastVerdict.scene }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        nextCheck = Date.now() + Math.max(10, Number(result.retryAfterSeconds) || 60) * 1000;
        $('connection-text').textContent = 'Gemini rate limited';
      }
      throw new Error(result.error || 'The outfit check failed. Retrying shortly.');
    }
    if (generation === requestGeneration) {
      showVerdict(verdictSchema.parse(result));
      $('connection-text').textContent = 'Gemini ready';
    }
  } catch (error) {
    if (generation === requestGeneration) message(error.name === 'AbortError' ? 'The outfit check timed out. Try again.' : error.message);
  } finally {
    clearTimeout(timeout);
    judging = false;
    renderer.setScanning(false);
    $('scan-label').hidden = true;
    nextCheck = Math.max(nextCheck, Date.now() + 12000);
    if (stream) $('stage-mode').textContent = 'LIVE 3D MIRROR';
    updateJudge();
  }
}

$('judge').onclick = () => {
  autoEnabled = !autoEnabled;
  if (autoEnabled) { nextCheck = 0; message(); }
  else { requestGeneration++; requestController?.abort(); }
  updateJudge();
};
$('scene').onchange = () => {
  const selected = $('scene').value;
  if (!stream) showVerdict(scenePreview(selected === 'auto' ? 'galaxy' : selected), true);
  else renderer.setVerdict(selected === 'auto' ? lastVerdict : { ...lastVerdict, scene: selected, formats: scenePreview(selected).formats }, false);
};
setInterval(() => {
  if (!stream || !configured) return;
  if (!autoEnabled) { $('frame-hint').textContent = 'AI paused. Your 3D effects keep moving.'; return; }
  if (judging) { $('frame-hint').textContent = 'Gemini is creating your next aura…'; return; }
  if (Date.now() - lastPersonAt > 1200) { $('frame-hint').textContent = 'Step into frame to activate your aura.'; return; }
  const seconds = Math.ceil((nextCheck - Date.now()) / 1000);
  $('frame-hint').textContent = seconds > 0 ? `Live AI · next reaction in ${seconds}s` : 'Your next aura is on its way.';
  if (seconds <= 0 && !document.hidden) analyzeOutfit();
}, 500);

function loadOpenTok() {
  if (window.OT) return Promise.resolve(window.OT);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/opentok.js';
    script.onload = () => window.OT ? resolve(window.OT) : reject(new Error('The broadcast SDK could not load.'));
    script.onerror = () => reject(new Error('The broadcast SDK could not load.'));
    document.head.appendChild(script);
  });
}

function stopBroadcast() {
  if (otPublisher) {
    try { otSession?.unpublish(otPublisher); } catch { /* session already gone */ }
    otPublisher.destroy?.();
    otPublisher = null;
  }
  $('publisher').replaceChildren();
  broadcasting = false;
  updateLive();
}

function showBackdrop(visible) {
  $('placeholder').style.background = visible ? '' : 'none';
  $('placeholder').querySelector('.silhouette').style.display = visible ? '' : 'none';
  $('placeholder').querySelector('.ambient').style.display = visible ? '' : 'none';
}

function updateLive() {
  const label = broadcasting ? `● LIVE · ${viewers} watching` : subscriber ? '● WATCHING LIVE' : '';
  $('share').textContent = label;
  $('share').hidden = !label;
}

async function connectSession() {
  if (otSession) return otSession;
  const OT = await loadOpenTok();
  const response = await fetch('/api/token');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The video session is unavailable.');
  const session = OT.initSession(data.applicationId, data.sessionId);
  const audience = new Set();
  session.on('connectionCreated', event => {
    if (event.connection.connectionId === session.connection?.connectionId) return;
    audience.add(event.connection.connectionId); viewers = audience.size; updateLive();
  });
  session.on('connectionDestroyed', event => {
    audience.delete(event.connection.connectionId); viewers = audience.size; updateLive();
  });
  session.on('streamCreated', event => {
    if (otPublisher) return;
    if (!event.stream.hasVideo) return;
    subscriber = session.subscribe(event.stream, $('remote'), { insertMode: 'append', width: '100%', height: '100%' }, error => {
      if (error) {
        subscriber = null;
        $('remote').hidden = true;
        $('remote').replaceChildren();
        updateLive();
        return;
      }
      $('remote').hidden = false;
      showBackdrop(false);
      $('stage-mode').textContent = 'WATCHING LIVE';
      updateLive();
    });
  });
  session.on('streamDestroyed', () => {
    subscriber = null;
    $('remote').hidden = true;
    $('remote').replaceChildren();
    if (!stream) { showBackdrop(true); $('stage-mode').textContent = 'CAMERA OFF'; }
    updateLive();
  });
  await new Promise((resolve, reject) => session.connect(data.token, error => error ? reject(new Error(error.message)) : resolve()));
  otSession = session;
  return session;
}

function publisherStream(host) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000;
    const poll = () => {
      const element = host.querySelector('video');
      if (element?.srcObject?.getVideoTracks().length) return resolve(element.srcObject);
      if (Date.now() > deadline) return reject(new Error('The camera did not start. Please try again.'));
      setTimeout(poll, 120);
    };
    poll();
  });
}

$('record').onclick = async () => {
  if (recording || !stream) return;
  if (!window.MediaRecorder || !$('effects').captureStream) { message('Clip recording is unavailable in this browser. Try Chrome.'); return; }
  recording = true;
  const button = $('record');
  button.disabled = true;
  const composite = $('effects').captureStream(30);
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  try {
    const recorder = new MediaRecorder(composite, mimeType ? { mimeType } : {});
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      composite.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `vogue-vision-aura.${recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      recording = false; button.disabled = false; button.textContent = '↓ Save 6s clip';
    };
    recorder.start();
    let remaining = 6;
    button.textContent = `● Recording ${remaining}s`;
    const timer = setInterval(() => {
      remaining--;
      button.textContent = `● Recording ${remaining}s`;
      if (!remaining) { clearInterval(timer); if (recorder.state !== 'inactive') recorder.stop(); }
    }, 1000);
  } catch {
    composite.getTracks().forEach(track => track.stop());
    recording = false; button.disabled = false; button.textContent = '↓ Save 6s clip';
    message('This browser could not record a clip. Your live mirror still works.');
  }
};

fetch('/api/status').then(response => response.json()).then(status => {
  configured = status.configured;
  videoReady = Boolean(status.video);
  $('connection-text').textContent = configured ? 'Gemini ready' : 'Gemini key needed';
  $('connection').classList.toggle('connected', configured);
  $('setup').hidden = configured;
  updateJudge();
  updateLive();
  if (videoReady) connectSession().catch(() => { /* broadcasting stays unavailable */ });
}).catch(() => { $('connection-text').textContent = 'Server offline'; });
window.addEventListener('pagehide', stopCamera);
