import { access, cp, mkdir, writeFile } from 'node:fs/promises';

await mkdir('public/mediapipe', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe/wasm', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs', 'public/mediapipe/vision_bundle.js');
const modelPath = 'public/mediapipe/pose_landmarker_lite.task';
try {
  await access(modelPath);
} catch {
  const response = await fetch('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('The pose model download failed. See README.md for the download link.');
  await writeFile(modelPath, Buffer.from(await response.arrayBuffer()));
}
