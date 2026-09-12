// The MediaPipe runtime loads WebAssembly with importScripts, which requires a classic worker.
self.exports = {};
importScripts('/mediapipe/vision_bundle.js');
const { FilesetResolver, PoseLandmarker } = self.exports;

let landmarker;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const vision = await FilesetResolver.forVisionTasks(`${data.origin}/mediapipe/wasm`);
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${data.origin}/mediapipe/pose_landmarker_lite.task`, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        outputSegmentationMasks: true,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      console.error('Pose tracker initialization failed:', error.message);
      self.postMessage({ type: 'error' });
    }
  }
  if (data.type === 'frame') {
    try {
      landmarker.detectForVideo(data.frame, data.timestamp, result => {
        const mask = result.segmentationMasks?.[0];
        const pixels = mask ? new Float32Array(mask.getAsFloat32Array()) : null;
        self.postMessage({ type: 'pose', landmarks: result.landmarks[0] || null,
          mask: pixels, maskWidth: mask?.width, maskHeight: mask?.height }, pixels ? [pixels.buffer] : []);
      });
    } catch {
      self.postMessage({ type: 'error' });
    } finally {
      data.frame.close();
    }
  }
};
