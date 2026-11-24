import * as THREE from 'three';
import type { RatAppearance } from '../types/game';
import { BASE_COLORS } from './coatPresets';

export interface FurTextureBundle {
  bodyMap: THREE.CanvasTexture;
  headMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const textureCache = new Map<string, FurTextureBundle>();

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function appearanceKey(a: RatAppearance): string {
  return `${a.baseColor}|${a.marking}|${a.markingColor}|${a.headCapVariant}|${a.coat}`;
}

function drawFurStrokes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  isRex: boolean,
  tickingHex?: string,
  silvering?: boolean
) {
  const count = isRex ? 4200 : 3400;
  ctx.save();
  ctx.lineCap = 'round';

  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = isRex ? 7 + rand() * 8 : 10 + rand() * 12;
    const light = rand() > 0.48;
    ctx.strokeStyle = light
      ? `rgba(255,255,255,${isRex ? 0.08 + rand() * 0.08 : 0.05 + rand() * 0.07})`
      : `rgba(25,20,18,${isRex ? 0.08 + rand() * 0.09 : 0.05 + rand() * 0.08})`;
    ctx.lineWidth = isRex ? 1.5 : 1.05;

    ctx.beginPath();
    ctx.moveTo(x, y);
    if (isRex) {
      const wave = (rand() - 0.5) * 6;
      ctx.quadraticCurveTo(x + wave, y + len * 0.5, x - wave * 0.6, y + len);
    } else {
      ctx.lineTo(x + (rand() - 0.5) * 2.5, y + len);
    }
    ctx.stroke();
  }

  if (tickingHex) {
    ctx.strokeStyle = tickingHex;
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 1600; i++) {
      const x = rand() * w;
      const y = rand() * h;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 2, y + 6 + rand() * 7);
      ctx.stroke();
    }
  }

  if (silvering) {
    ctx.strokeStyle = '#F7FAFF';
    ctx.globalAlpha = 0.34;
    for (let i = 0; i < 1200; i++) {
      const x = rand() * w;
      const y = rand() * h;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 2, y + 7 + rand() * 6);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * SphereGeometry UV layout in Three.js:
 * u in [0, 1] wraps around Y axis (0.25 = +X side, 0.5 = back/top depending on orientation, 0.75 = -X side).
 * In our RatModel, body spheres are elongated along local Z (head at +Z, tail at -Z) by scaling (rx, ry, rz)
 * and rotating geometry so u=0.5 is top dorsal ridge, u=0/1 is ventral belly, v=0 is rear, v=1 is front!
 */
function generateBodyTexture(a: RatAppearance, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(hashString(appearanceKey(a) + '_body'));

  const base = BASE_COLORS[a.baseColor];
  const mark = BASE_COLORS[a.markingColor];

  // Base fill with subtle dorsal-to-ventral shading
  // In our body UV convention: X = around circumference (0.5 = dorsal spine, 0 & 1 = belly), Y = front(0) to rear(1)
  const bgGrad = ctx.createLinearGradient(0, 0, size, 0);
  bgGrad.addColorStop(0, base.belly);
  bgGrad.addColorStop(0.2, base.primary);
  bgGrad.addColorStop(0.5, base.secondary);
  bgGrad.addColorStop(0.8, base.primary);
  bgGrad.addColorStop(1, base.belly);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  const cx = size * 0.5;

  // Apply markings
  switch (a.marking) {
    case 'back_stripe': {
      // Neat longitudinal stripe along dorsal spine (center X) from shoulders to tail base
      const stripeW = size * 0.17;
      const grad = ctx.createLinearGradient(cx - stripeW, 0, cx + stripeW, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.18, mark.primary);
      grad.addColorStop(0.5, mark.secondary);
      grad.addColorStop(0.82, mark.primary);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - stripeW * 0.85, size * 0.04);
      ctx.bezierCurveTo(
        cx - stripeW * 1.15,
        size * 0.32,
        cx - stripeW * 1.05,
        size * 0.68,
        cx - stripeW * 0.72,
        size * 0.96
      );
      ctx.lineTo(cx + stripeW * 0.72, size * 0.96);
      ctx.bezierCurveTo(
        cx + stripeW * 1.05,
        size * 0.68,
        cx + stripeW * 1.15,
        size * 0.32,
        cx + stripeW * 0.85,
        size * 0.04
      );
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'hooded_stripe': {
      // Dark shoulders (top of body Y < 0.35) + longitudinal stripe down the back
      ctx.fillStyle = mark.primary;
      ctx.fillRect(0, 0, size, size * 0.29);
      // Soft ragged edge
      for (let i = 0; i < 40; i++) {
        const px = (i / 40) * size;
        ctx.beginPath();
        ctx.arc(px, size * 0.29 + (rand() - 0.5) * 18, 12 + rand() * 14, 0, Math.PI * 2);
        ctx.fill();
      }
      // Dorsal stripe
      const stripeW = size * 0.16;
      ctx.fillStyle = mark.primary;
      ctx.beginPath();
      ctx.ellipse(cx, size * 0.62, stripeW, size * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'capped': {
      // Only a slight collar at very front neck edge; body itself stays clean base color
      const grad = ctx.createLinearGradient(0, 0, 0, size * 0.16);
      grad.addColorStop(0, mark.primary);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size * 0.16);
      break;
    }

    case 'berkshire': {
      // White belly at edges X near 0 and 1
      const bellyColor = '#F7F5F0';
      const leftGrad = ctx.createLinearGradient(0, 0, size * 0.22, 0);
      leftGrad.addColorStop(0, bellyColor);
      leftGrad.addColorStop(0.75, bellyColor);
      leftGrad.addColorStop(1, 'rgba(247,245,240,0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, size * 0.22, size);

      const rightGrad = ctx.createLinearGradient(size * 0.78, 0, size, 0);
      rightGrad.addColorStop(0, 'rgba(247,245,240,0)');
      rightGrad.addColorStop(0.25, bellyColor);
      rightGrad.addColorStop(1, bellyColor);
      ctx.fillStyle = rightGrad;
      ctx.fillRect(size * 0.78, 0, size * 0.22, size);
      break;
    }

    case 'patched': {
      // Large organic patches across back & sides
      ctx.fillStyle = mark.primary;
      const patches = [
        { x: 0.45, y: 0.22, rx: 0.22, ry: 0.16, rot: 0.2 },
        { x: 0.62, y: 0.54, rx: 0.19, ry: 0.18, rot: -0.3 },
        { x: 0.33, y: 0.68, rx: 0.18, ry: 0.15, rot: 0.4 },
        { x: 0.52, y: 0.85, rx: 0.21, ry: 0.13, rot: -0.1 },
      ];
      for (const p of patches) {
        ctx.save();
        ctx.translate(p.x * size, p.y * size);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx * size, p.ry * size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'spots': {
      // Scattered neat small spots
      ctx.fillStyle = mark.primary;
      for (let i = 0; i < 24; i++) {
        const sx = (0.16 + rand() * 0.68) * size;
        const sy = (0.08 + rand() * 0.84) * size;
        const r = (0.025 + rand() * 0.042) * size;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rand() * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'siamese':
    case 'himalayan': {
      // Warm shaded rump/tail base point at bottom of texture (Y -> 1)
      const intensity = a.marking === 'siamese' ? 0.85 : 0.48;
      const rumpGrad = ctx.createLinearGradient(0, size * 0.68, 0, size);
      rumpGrad.addColorStop(0, 'rgba(65,45,35,0)');
      rumpGrad.addColorStop(1, `rgba(65,43,31,${intensity})`);
      ctx.fillStyle = rumpGrad;
      ctx.fillRect(0, size * 0.68, size, size * 0.32);
      break;
    }

    case 'solid':
    default:
      break;
  }

  // Fine fur texture strokes
  drawFurStrokes(ctx, size, size, rand, a.coat === 'rex', base.ticking, base.silvering);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function generateHeadTexture(a: RatAppearance, size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(hashString(appearanceKey(a) + '_head'));

  const base = BASE_COLORS[a.baseColor];
  const mark = BASE_COLORS[a.markingColor];

  // Head color depends on marking & headCapVariant
  const headIsMarked =
    a.marking === 'hooded_stripe' ||
    a.marking === 'capped' ||
    (a.marking === 'back_stripe' && a.headCapVariant === 'gray_cap');

  ctx.fillStyle = headIsMarked ? mark.primary : base.primary;
  ctx.fillRect(0, 0, size, size);

  if (a.marking === 'back_stripe' && a.headCapVariant === 'gray_cap') {
    // Soft white cheeks & snout tip, neat gray cap over crown & forehead
    ctx.fillStyle = base.primary;
    ctx.fillRect(0, size * 0.56, size, size * 0.44);
    const capGrad = ctx.createRadialGradient(size * 0.5, size * 0.36, 12, size * 0.5, size * 0.38, size * 0.46);
    capGrad.addColorStop(0, mark.secondary);
    capGrad.addColorStop(0.7, mark.primary);
    capGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = capGrad;
    ctx.fillRect(0, 0, size, size * 0.72);
  } else if (a.marking === 'patched') {
    ctx.fillStyle = mark.primary;
    ctx.beginPath();
    ctx.ellipse(size * 0.35, size * 0.4, size * 0.28, size * 0.24, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.72, size * 0.35, size * 0.2, size * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (a.marking === 'spots') {
    ctx.fillStyle = mark.primary;
    ctx.beginPath();
    ctx.arc(size * 0.32, size * 0.36, size * 0.1, 0, Math.PI * 2);
    ctx.arc(size * 0.68, size * 0.32, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (a.marking === 'siamese' || a.marking === 'himalayan') {
    // Dark snout point gradient toward front (+Z mapped near center-bottom)
    const alpha = a.marking === 'siamese' ? 0.92 : 0.72;
    const snoutGrad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.85,
      size * 0.06,
      size * 0.5,
      size * 0.82,
      size * 0.44
    );
    snoutGrad.addColorStop(0, `rgba(56,36,26,${alpha})`);
    snoutGrad.addColorStop(0.55, `rgba(74,50,37,${alpha * 0.6})`);
    snoutGrad.addColorStop(1, 'rgba(74,50,37,0)');
    ctx.fillStyle = snoutGrad;
    ctx.fillRect(0, 0, size, size);
  }

  drawFurStrokes(ctx, size, size, rand, a.coat === 'rex', base.ticking, base.silvering);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function generateFurMaps(isRex: boolean, size = 256): { bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;
  const rand = seededRand(isRex ? 99123 : 44511);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  const strokes = isRex ? 2600 : 2200;
  for (let i = 0; i < strokes; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = isRex ? 8 + rand() * 8 : 9 + rand() * 10;
    const v = Math.floor(85 + rand() * 100);
    bctx.strokeStyle = `rgb(${v},${v},${v})`;
    bctx.lineWidth = isRex ? 1.8 : 1.1;
    bctx.beginPath();
    bctx.moveTo(x, y);
    if (isRex) {
      bctx.quadraticCurveTo(x + (rand() - 0.5) * 8, y + len * 0.5, x + (rand() - 0.5) * 4, y + len);
    } else {
      bctx.lineTo(x + (rand() - 0.5) * 2, y + len);
    }
    bctx.stroke();
  }

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  // High matte roughness (0.82 - 0.96 -> 210..246) so rats NEVER look like shiny plastic!
  rctx.fillStyle = '#DCDCDC';
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1200; i++) {
    const v = Math.floor(205 + rand() * 44);
    rctx.fillStyle = `rgb(${v},${v},${v})`;
    rctx.fillRect(rand() * size, rand() * size, 3, 6);
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { bumpMap, roughnessMap };
}

const sharedMaps: Partial<Record<'smooth' | 'rex', { bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture }>> = {};

export function getFurTextures(appearance: RatAppearance): FurTextureBundle {
  const key = appearanceKey(appearance);
  const existing = textureCache.get(key);
  if (existing) return existing;

  const coatKey = appearance.coat;
  if (!sharedMaps[coatKey]) {
    sharedMaps[coatKey] = generateFurMaps(coatKey === 'rex');
  }
  const { bumpMap, roughnessMap } = sharedMaps[coatKey]!;

  const bundle: FurTextureBundle = {
    bodyMap: generateBodyTexture(appearance),
    headMap: generateHeadTexture(appearance),
    bumpMap,
    roughnessMap,
  };
  textureCache.set(key, bundle);
  return bundle;
}
