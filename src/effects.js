import * as THREE from 'three';
import { clamp, mapPoint, poseLayout, previewPose, safeEffect } from './pose-layout.js';
export { mapPoint } from './pose-layout.js';

const sceneFormats = {
  galaxy: ['glints', 'prisms', 'stickers'], inferno: ['flames', 'glints', 'stickers'],
  electric: ['trails', 'prisms', 'glints'], butterflies: ['wings', 'glints', 'stickers'],
  disco: ['confetti', 'letters', 'glints'], vortex: ['trails', 'letters', 'prisms'],
};
const sceneColors = { galaxy: '#bca5ff', inferno: '#ff9b54', electric: '#7bdeff', butterflies: '#f5aad8', disco: '#ffcf81', vortex: '#adf0c2' };

export function createEffects(canvas, video) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 3000);
  camera.position.z = 1000;
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight('#ffffff', 2));
  const light = new THREE.DirectionalLight('#ffffff', 4);
  light.position.set(200, 350, 600);
  scene.add(light);
  const background = new THREE.Scene(), foreground = new THREE.Scene();
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  let maskTexture = new THREE.DataTexture(new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType);
  maskTexture.needsUpdate = true;
  const uniforms = {
    videoMap: { value: videoTexture }, maskMap: { value: maskTexture }, crop: { value: new THREE.Vector2(1, 1) },
    cutout: { value: false }, tint: { value: new THREE.Color('#bca5ff') }, time: { value: 0 },
    glow: { value: 0 }, neck: { value: 0 },
  };
  const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const fragmentShader = `uniform sampler2D videoMap; uniform sampler2D maskMap; uniform vec2 crop; uniform bool cutout;
    uniform vec3 tint; uniform float time; uniform float glow; uniform float neck; varying vec2 vUv;
    void main(){vec2 uv=(vUv-.5)*crop+.5;uv.x=1.-uv.x;
      vec4 color=texture2D(videoMap,uv); vec2 maskUv=vec2(uv.x,1.-uv.y);
      float mask=texture2D(maskMap,maskUv).r;
      float edge=abs(mask-texture2D(maskMap,maskUv+vec2(.004,0.)).r)+abs(mask-texture2D(maskMap,maskUv+vec2(0.,.004)).r);
      float garment=1.-smoothstep(neck-.015,neck,vUv.y);
      float sweep=pow(max(0.,1.-abs(vUv.y-fract(time*.075))/.045),3.);
      color.rgb+=tint*glow*garment*(edge*.25+sweep*mask*.035);
      gl_FragColor=vec4(color.rgb,cutout?smoothstep(.35,.7,mask):1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const bgMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false });
  const fgMaterial = new THREE.ShaderMaterial({ uniforms: { ...uniforms, cutout: { value: true } }, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false });
  const plane = new THREE.PlaneGeometry(1, 1);
  const bgPlane = new THREE.Mesh(plane, bgMaterial), fgPlane = new THREE.Mesh(plane, fgMaterial);
  background.add(bgPlane); foreground.add(fgPlane);
  const backClip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
  const frontClip = [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)];
  const star = new THREE.Shape();
  star.moveTo(0, .5); star.lineTo(.11, .11); star.lineTo(.5, 0); star.lineTo(.11, -.11);
  star.lineTo(0, -.5); star.lineTo(-.11, -.11); star.lineTo(-.5, 0); star.lineTo(-.11, .11); star.closePath();
  const wing = new THREE.Shape();
  wing.moveTo(0, 0); wing.bezierCurveTo(.55, .7, .8, .45, .43, .04); wing.bezierCurveTo(.75, -.37, .17, -.55, 0, 0);
  const flame = new THREE.Shape();
  flame.moveTo(0, -.5); flame.bezierCurveTo(-.48, -.3, -.17, .1, .08, .55);
  flame.bezierCurveTo(-.02, .08, .48, -.25, 0, -.5);
  const geometry = { glints: new THREE.ShapeGeometry(star), prisms: new THREE.OctahedronGeometry(.5), confetti: plane,
    flames: new THREE.ShapeGeometry(flame), wings: new THREE.ShapeGeometry(wing), stickers: plane };
  const effects = new THREE.Group(); scene.add(effects);
  const textures = new Map();
  let items = [], trails = [], letters = [], history = [[], []], formats = [], landmarks = null, lastPose = 0;
  let preview = false, enabled = false, scanning = false, width = 1, height = 1, sceneName = 'galaxy';
  let start = performance.now(), lastFrame = start, clock = 0, motion = 0, previousCenter = null;
  let previousLandmarks = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function emojiTexture(emoji) {
    if (textures.has(emoji)) return textures.get(emoji);
    const source = document.createElement('canvas'); source.width = source.height = 128;
    const ctx = source.getContext('2d');
    ctx.font = '94px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 69);
    const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace; textures.set(emoji, texture);
    return texture;
  }
  function letterTexture(char, color) {
    const cacheKey = `letter:${char}:${color}`;
    if (textures.has(cacheKey)) return textures.get(cacheKey);
    const source = document.createElement('canvas'); source.width = source.height = 256;
    const ctx = source.getContext('2d');
    ctx.font = '900 186px "Arial Rounded MT Bold", "Helvetica Rounded", Avenir, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const shade = new THREE.Color(color).multiplyScalar(.4).getStyle();
    ctx.fillStyle = shade;
    for (let depth = 16; depth > 0; depth--) ctx.fillText(char, 124 + depth * .8, 136 + depth);
    ctx.fillStyle = color; ctx.fillText(char, 124, 136);
    ctx.globalAlpha = .32; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(100, 92, 32, 20, -.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(cacheKey, texture);
    return texture;
  }
  function clear() {
    effects.traverse(object => { object.material?.dispose(); if (object.userData.ownGeometry) object.geometry.dispose(); });
    effects.clear(); items = []; trails = []; letters = []; history = [[], []]; enabled = false;
    uniforms.glow.value = 0;
  }
  function setVerdict(verdict, isPreview = false) {
    clear(); preview = isPreview; enabled = true; start = performance.now();
    sceneName = verdict.scene || 'galaxy';
    formats = verdict.formats?.length ? [...new Set(verdict.formats)].slice(0, 3) : sceneFormats[sceneName];
    const color = sceneColors[sceneName]; uniforms.tint.value.set(color);
    canvas.dataset.scene = sceneName;
    canvas.dataset.formats = formats.join(',');
    const visualFormats = formats.filter(format => format !== 'trails' && format !== 'letters');
    visualFormats.forEach((format, formatIndex) => {
      const count = format === 'stickers' ? 2 : format === 'wings' ? 3 : 5;
      for (let i = 0; i < count; i++) {
        const material = format === 'prisms'
          ? new THREE.MeshStandardMaterial({ color, metalness: .65, roughness: .23, transparent: true })
          : new THREE.MeshBasicMaterial({ color: format === 'stickers' ? '#ffffff' : color, transparent: true, side: THREE.DoubleSide, depthWrite: false,
            ...(format === 'stickers' ? { map: emojiTexture(verdict.effects[i % verdict.effects.length].emoji), alphaTest: .04 } : {}) });
        const object = new THREE.Group();
        const mesh = new THREE.Mesh(geometry[format], material); object.add(mesh);
        if (format === 'wings') { const other = new THREE.Mesh(geometry.wings, material.clone()); other.scale.x = -1; object.add(other); }
        effects.add(object);
        items.push({ object, format, i, formatIndex, effect: verdict.effects[i % verdict.effects.length] });
      }
    });
    if (formats.includes('trails')) {
      for (let i = 0; i < 2; i++) {
        const path = new THREE.BufferGeometry(); path.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36), 3));
        const line = new THREE.Line(path, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .65 }));
        line.userData.ownGeometry = true; effects.add(line); trails.push(line);
      }
    }
    if (formats.includes('letters')) {
      const word = [...(verdict.title || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().split(/\s+/)[0] || ''].slice(0, 6);
      word.forEach((char, i) => {
        const material = new THREE.MeshBasicMaterial({ map: letterTexture(char, color), transparent: true, depthWrite: false, alphaTest: .02, side: THREE.DoubleSide });
        const object = new THREE.Group();
        object.add(new THREE.Mesh(plane, material));
        effects.add(object);
        letters.push({ object, i, total: word.length });
      });
    }
  }
  const resize = new ResizeObserver(() => {
    width = canvas.clientWidth; height = canvas.clientHeight; renderer.setSize(width, height, false);
    camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
    bgPlane.scale.set(width, height, 1); fgPlane.scale.copy(bgPlane.scale);
  });
  resize.observe(canvas);

  function draw(now) {
    const live = video.readyState >= 2 && video.srcObject;
    const dt = Math.min((now - lastFrame) / 1000, .05); clock += dt * (1 + motion * .45);
    const t = reducedMotion.matches ? 1 : clock;
    const layout = preview ? poseLayout(previewPose(), width, height, width, height)
      : now - lastPose < 750 ? poseLayout(landmarks, video.videoWidth || 1, video.videoHeight || 1, width, height) : null;
    const reveal = reducedMotion.matches ? 1 : Math.min(1, (now - start) / 800);
    let visible = 0, maxSize = 0;
    items.forEach((item, index) => {
      const { object, format, i, formatIndex } = item;
      object.visible = false;
      if (!layout) return;
      const limit = layout.closeup ? 7 : 13;
      const u = layout.unit;
      const side = i % 2 ? -1 : 1;
      const shoulder = side < 0 ? layout.left : layout.right;
      const lower = side < 0 ? layout.lowerLeft : layout.lowerRight;
      const phase = i * .618 + formatIndex * .27;
      const progress = (t * (format === 'stickers' ? .18 : .32) + phase) % 1;
      const life = Math.sin(progress * Math.PI);
      const along = .18 + (i % 3) * .25;
      let x = shoulder.x + (lower.x - shoulder.x) * along;
      let y = shoulder.y + (lower.y - shoulder.y) * along;
      let size = u * .75, alpha = life, z = 12;
      object.rotation.set(0, 0, 0);
      if (format === 'glints') {
        x -= side * u * (1.5 + i % 2); y += Math.sin(phase * 3) * u;
        size = u * (.4 + .5 * life); alpha = Math.pow(life, 4) * .9;
      } else if (format === 'prisms') {
        x += side * u * (1.3 + formatIndex); y -= progress * u * 2;
        size = u * .7; object.rotation.set(.3 + progress * .5, -.4 + progress * .9, .15);
      } else if (format === 'confetti') {
        x += side * u * (.7 + progress * 2); y += u * (5 * progress * progress - 3 * progress);
        size = u * .38; object.rotation.set(progress * 2, progress * 1.2, side * progress);
        object.children[0].material.color.setHSL((i * .23 + formatIndex * .3) % 1, .75, .7);
      } else if (format === 'flames') {
        x += side * u * (1 + Math.sin(t * 3 + i) * .25); y -= progress * u * 3.5;
        size = u * 1.15 * life; object.rotation.z = Math.sin(t * 2 + i) * .12; alpha *= .65;
      } else if (format === 'wings') {
        x += side * u * (1.4 + Math.sin(t * .6 + i) * .65); y -= u * (1 + Math.sin(t * .5 + phase) * 1.3);
        size = u * 1.2; object.rotation.z = side * .2;
        const flap = Math.sin(t * 7 + i) * .7;
        object.children[0].rotation.y = flap; object.children[1].rotation.y = -flap;
      } else {
        const target = item.effect.anchor === 'head' ? shoulder : layout.anchors[item.effect.anchor] || shoulder;
        x = item.effect.anchor === 'head' ? shoulder.x + side * u * 1.8 : target.x + side * u * 3;
        y = item.effect.anchor === 'head' ? shoulder.y - u * 2.5 : target.y - progress * u * 1.8;
        size = u * 1.05; alpha = Math.pow(life, 2);
      }
      const radius = size * .95;
      if (visible >= limit || alpha < .16 || !safeEffect(layout, x, y, radius)) return;
      object.visible = true; visible++; maxSize = Math.max(maxSize, size);
      object.position.set(x - width / 2, height / 2 - y, z);
      object.scale.setScalar(size * reveal);
      object.children.forEach(mesh => { mesh.material.opacity = alpha * reveal; });
    });
    letters.forEach(({ object, i, total }) => {
      object.visible = false;
      if (!layout) return;
      const u = layout.unit;
      const size = u * (layout.closeup ? 4.4 : 6);
      const offset = i - (total - 1) / 2;
      const x = layout.center.x + offset * u * 5.4;
      const arc = Math.cos((offset / Math.max(1, total - 1)) * Math.PI) * u * 1.5;
      const y = layout.center.y - u * 2.2 - arc + Math.sin(t * 1.1 + i * .55) * u * .3;
      if (x < -size || x > width + size || y < -size || y > height + size) return;
      object.visible = true;
      object.position.set(x - width / 2, height / 2 - y, -25);
      object.scale.setScalar(size * reveal);
      object.rotation.z = offset * .05 + Math.sin(t * .7 + i) * .05;
      object.children[0].material.opacity = reveal * .94;
    });
    trails.forEach((line, i) => {
      line.visible = false;
      if (!layout || reducedMotion.matches) return;
      const wrist = layout.wrists[i];
      const fallback = i ? layout.right : layout.left;
      const p = wrist || fallback;
      const path = history[i];
      if (now - (path.at(-1)?.time || 0) > 35) path.push({ x: p.x, y: p.y, time: now });
      while (path.length > 12 || (path[0] && now - path[0].time > 500)) path.shift();
      if (path.length < 3 || !path.every(point => safeEffect(layout, point.x, point.y, 3))) return;
      const distance = Math.hypot(path.at(-1).x - path[0].x, path.at(-1).y - path[0].y);
      if (distance < layout.unit * .25) return;
      const positions = line.geometry.attributes.position;
      path.forEach((p, j) => positions.setXYZ(j, p.x - width / 2, height / 2 - p.y, 10));
      line.geometry.setDrawRange(0, path.length); positions.needsUpdate = true; line.geometry.computeBoundingSphere();
      line.material.opacity = Math.min(.65, distance / (layout.unit * 3)); line.visible = true;
    });
    uniforms.time.value = t;
    uniforms.neck.value = layout ? 1 - layout.neck / height : 0;
    uniforms.glow.value = enabled && layout && formats.includes('glints') ? (scanning ? .7 : .4) : 0;
    renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.clippingPlanes = [];
    if (live) {
      const cover = Math.max(width / video.videoWidth, height / video.videoHeight);
      uniforms.crop.value.set(width / (video.videoWidth * cover), height / (video.videoHeight * cover));
      renderer.render(background, camera);
    }
    if (enabled) {
      if (live && !preview && layout) {
        renderer.clearDepth(); renderer.clippingPlanes = backClip; renderer.render(scene, camera);
        renderer.clippingPlanes = []; renderer.render(foreground, camera);
        renderer.clearDepth(); renderer.clippingPlanes = frontClip; renderer.render(scene, camera); renderer.clippingPlanes = [];
      } else { renderer.clearDepth(); renderer.render(scene, camera); }
    }
    canvas.dataset.renderMode = live ? 'composited-video' : 'preview';
    canvas.dataset.framing = layout?.closeup ? 'closeup' : 'full';
    canvas.dataset.visibleEffects = String(visible);
    canvas.dataset.maxEffectSize = String(Math.round(maxSize));
    lastFrame = now; requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  return {
    setVerdict, clear,
    setPose(value, mask, maskWidth, maskHeight) {
      if (value && previousLandmarks) landmarks = value.map((p, i) => ({ ...p, x: previousLandmarks[i].x + (p.x - previousLandmarks[i].x) * .55, y: previousLandmarks[i].y + (p.y - previousLandmarks[i].y) * .55 }));
      else landmarks = value;
      previousLandmarks = landmarks; lastPose = performance.now();
      if (value) {
        const center = (value[11].x + value[12].x) / 2;
        motion += ((previousCenter === null ? 0 : Math.min(1, Math.abs(center - previousCenter) * 25)) - motion) * .25;
        previousCenter = center;
      } else { previousCenter = null; motion = 0; history = [[], []]; }
      if (mask) {
        if (maskTexture.image.width !== maskWidth || maskTexture.image.height !== maskHeight) {
          maskTexture.dispose(); maskTexture = new THREE.DataTexture(mask, maskWidth, maskHeight, THREE.RedFormat, THREE.FloatType);
          maskTexture.minFilter = maskTexture.magFilter = THREE.LinearFilter; uniforms.maskMap.value = maskTexture;
        } else maskTexture.image.data = mask;
        maskTexture.needsUpdate = true;
      }
    },
    setPreview(value) { preview = value; }, setScanning(value) { scanning = value; },
  };
}
