export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function mapPoint(point, videoWidth, videoHeight, width, height) {
  const scale = Math.max(width / videoWidth, height / videoHeight);
  return {
    x: width - (point.x * videoWidth * scale - (videoWidth * scale - width) / 2),
    y: point.y * videoHeight * scale - (videoHeight * scale - height) / 2,
  };
}

export function poseLayout(landmarks, videoWidth, videoHeight, width, height) {
  if (!landmarks) return null;
  const raw = index => landmarks[index] && landmarks[index].visibility >= .5
    ? mapPoint(landmarks[index], videoWidth, videoHeight, width, height) : null;
  const onscreen = point => point && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
  const point = index => { const p = raw(index); return onscreen(p) ? p : null; };
  const shoulders = [point(11), point(12)].filter(Boolean).sort((a, b) => a.x - b.x);
  const nose = point(0);
  if (!shoulders.length && !nose) return null;
  const a = raw(11), b = raw(12);
  const shoulderSpan = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : width * .25;
  const short = Math.min(width, height);
  const unit = clamp(shoulderSpan * .065, short * .014, short * .034);
  const earA = raw(7), earB = raw(8);
  const faceRadius = nose ? Math.max(unit * 2.5, earA && earB ? Math.hypot(earA.x - earB.x, earA.y - earB.y) * .72 : shoulderSpan * .23) : 0;
  const face = nose ? { left: nose.x - faceRadius * 1.1, right: nose.x + faceRadius * 1.1, top: nose.y - faceRadius * 1.65, bottom: nose.y + faceRadius * 1.1 } : null;
  const hips = [point(23), point(24)].filter(Boolean).sort((x, y) => x.x - y.x);
  const closeup = shoulderSpan > width * .58 || !hips.length || (face && (face.right - face.left) > width * .3);
  const center = shoulders.length ? { x: shoulders.reduce((sum, p) => sum + p.x, 0) / shoulders.length, y: shoulders.reduce((sum, p) => sum + p.y, 0) / shoulders.length } : { x: nose.x, y: Math.min(height - unit * 2, face.bottom + unit * 3) };
  const left = shoulders[0] || { x: center.x - unit * 4, y: center.y };
  const right = shoulders.at(-1) || { x: center.x + unit * 4, y: center.y };
  const lowerLeft = hips[0] || { x: left.x + unit, y: Math.min(height - unit * 2, left.y + shoulderSpan * .55) };
  const lowerRight = hips.at(-1) || { x: right.x - unit, y: Math.min(height - unit * 2, right.y + shoulderSpan * .55) };
  return { width, height, unit, closeup, face, center, left, right, lowerLeft, lowerRight,
    wrists: [point(15), point(16)], head: nose,
    neck: Math.min(height, Math.max(face?.bottom || 0, center.y - unit)),
    anchors: { shoulders: center, body: { x: center.x, y: (center.y + lowerLeft.y + lowerRight.y) / 3 },
      hips: hips.length ? { x: (lowerLeft.x + lowerRight.x) / 2, y: (lowerLeft.y + lowerRight.y) / 2 } : null,
      feet: point(27) || point(28), head: nose },
  };
}

export function safeEffect(layout, x, y, radius) {
  if (x - radius < 6 || x + radius > layout.width - 6 || y - radius < 45 || y + radius > layout.height - 42) return false;
  const face = layout.face;
  return !face || x + radius < face.left || x - radius > face.right || y + radius < face.top || y - radius > face.bottom;
}

export function previewPose() {
  const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
  for (const [index, x, y] of [[0,.5,.24],[7,.46,.24],[8,.54,.24],[11,.4,.39],[12,.6,.39],[15,.36,.64],[16,.64,.64],[23,.43,.65],[24,.57,.65],[27,.43,.91],[28,.57,.91]]) points[index] = { x, y, visibility: 1 };
  return points;
}
