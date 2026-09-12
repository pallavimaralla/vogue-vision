import test from 'node:test';
import assert from 'node:assert/strict';
import { poseLayout, safeEffect, previewPose } from '../src/pose-layout.js';

test('close-up effects remain small when shoulders extend beyond the frame', () => {
  const points = previewPose();
  points[0] = { x: .5, y: .4, visibility: 1 };
  points[7] = { x: .35, y: .4, visibility: 1 };
  points[8] = { x: .65, y: .4, visibility: 1 };
  points[11] = { x: -.2, y: .85, visibility: 1 };
  points[12] = { x: 1.2, y: .85, visibility: 1 };
  points[23].visibility = points[24].visibility = 0;
  const layout = poseLayout(points, 700, 1000, 700, 1000);
  assert.equal(layout.closeup, true);
  assert.ok(layout.unit <= 24);
  assert.equal(safeEffect(layout, 350, 400, 16), false);
  assert.equal(safeEffect(layout, 350, 210, 16), false);
  assert.equal(safeEffect(layout, 80, 750, 16), true);
  assert.equal(safeEffect(layout, 2, 750, 16), false);
});

test('effect scale follows distance without growing to fill the screen', () => {
  const near = previewPose();
  const far = near.map(p => ({ ...p, x: .5 + (p.x - .5) * .5, y: .5 + (p.y - .5) * .5 }));
  const a = poseLayout(near, 1000, 700, 1000, 700);
  const b = poseLayout(far, 1000, 700, 1000, 700);
  assert.ok(b.unit < a.unit);
  assert.equal(a.closeup, false);
  assert.equal(poseLayout(null, 1000, 700, 1000, 700), null);
});

test('invisible or cropped body parts cannot serve as garment anchors', () => {
  const points = previewPose();
  points[23].y = points[24].y = 1.3;
  points[27].visibility = points[28].visibility = 0;
  const layout = poseLayout(points, 700, 1000, 700, 1000);
  assert.equal(layout.anchors.hips, null);
  assert.equal(layout.anchors.feet, null);
});
