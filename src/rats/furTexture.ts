import * as THREE from 'three';
import type { Appearance } from '../store/types';
import { colorDef, EYES } from '../store/data/coats';
import { fbmWrap, hash2, hexToRgb, mixRgb, smoothstep, vnoiseWrapX } from '../engine/noise';

/**
 * Процедурная текстура окраса в «цилиндрических» координатах тела:
 *  u — вокруг тела (0.5 = хребет, 0/1 = середина живота),
 *  v — вдоль тела (0 = основание хвоста, 1 = кончик носа).
 */

export const TEX_W = 384;
export const TEX_H = 256;

type RGB = [number, number, number];

const WHITE: RGB = hexToRgb('#f3efe7');
const SIAM_BODY: RGB = hexToRgb('#e8dcc6');
const HIMA_BODY: RGB = hexToRgb('#f2eee6');

/** Доля пигмента (0 — белая шерсть, 1 — окрашенная) для рисунка */
function markAmount(a: Appearance, u: number, v: number, seed: number): number {
  const d = Math.abs(u - 0.5) * 2; // 0 — спина, 1 — живот
  const edge = (fbmWrap(u * 24, v * 18, 24, seed, 2) - 0.5) * 0.09;
  const p = a.pattern;
  const stripe = () => {
    const along = smoothstep(0.03, 0.09, v) * (1 - smoothstep(0.6, 0.67, v));
    const width = 0.26 + 0.05 * Math.sin(v * 9 + seed);
    return (1 - smoothstep(width - 0.03, width + 0.03, d + edge)) * along;
  };
  const hood = (from: number) => {
    const reach = from + edge * 0.8 + (d > 0.75 ? 0.08 * smoothstep(0.75, 1, d) : 0);
    return smoothstep(reach - 0.02, reach + 0.02, v);
  };
  switch (p) {
    case 'self':
      return 1;
    case 'stripe':
      return stripe();
    case 'capped': {
      const cap = smoothstep(0.66, 0.7, v + edge * 0.5) * (1 - smoothstep(0.58, 0.66, d + edge)) * (1 - smoothstep(0.93, 0.97, v));
      return Math.max(stripe(), cap);
    }
    case 'hooded':
      return Math.max(stripe(), hood(0.56));
    case 'hoodonly':
      return hood(0.58);
    case 'berkshire':
      return 1 - smoothstep(0.6, 0.68, d + edge);
    case 'variegated': {
      const head = smoothstep(0.66, 0.7, v + edge) * (1 - smoothstep(0.7, 0.82, d));
      const blot = smoothstep(0.52, 0.58, fbmWrap(u * 6, v * 7, 6, seed + 5, 3)) * (1 - smoothstep(0.55, 0.75, d)) * smoothstep(0.02, 0.08, v) * (1 - smoothstep(0.66, 0.7, v));
      return Math.max(head, blot);
    }
    case 'spots': {
      const n = vnoiseWrapX(u * 22, v * 16, 22, seed + 9);
      const s = smoothstep(0.74, 0.79, n) * (1 - smoothstep(0.6, 0.85, d)) * smoothstep(0.03, 0.08, v) * (1 - smoothstep(0.9, 0.95, v));
      return s;
    }
    case 'siamese': {
      const nose = smoothstep(0.8, 0.97, v);
      const back = 0.28 * (1 - smoothstep(0.1, 0.55, d)) * smoothstep(0.1, 0.4, v);
      const tail = 0.75 * (1 - smoothstep(0.0, 0.07, v));
      return Math.min(1, Math.max(nose, back, tail));
    }
    case 'himalayan': {
      const nose = 0.9 * smoothstep(0.86, 0.98, v);
      const tail = 0.45 * (1 - smoothstep(0.0, 0.05, v));
      return Math.max(nose, tail);
    }
  }
  return 1;
}

function lightBase(a: Appearance): RGB {
  if (a.pattern === 'siamese') return SIAM_BODY;
  if (a.pattern === 'himalayan') return HIMA_BODY;
  return WHITE;
}

export function generateFurCanvas(a: Appearance): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = TEX_W;
  cv.height = TEX_H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(TEX_W, TEX_H);
  const data = img.data;
  const col = colorDef(a.color);
  const pigment = hexToRgb(col.hex);
  const belly = hexToRgb(col.belly);
  const light = lightBase(a);
  const seed = a.seed % 100000;
  const ticking = col.ticking ?? 0;
  const silver = col.silvering ?? 0;
  const rex = a.coat === 'rex';
  const tickDark: RGB = [45, 32, 22];
  const tickGold: RGB = [176, 136, 86];
  const isWhiteSelf = a.color === 'white';

  for (let y = 0; y < TEX_H; y++) {
    const v = y / (TEX_H - 1);
    for (let x = 0; x < TEX_W; x++) {
      const u = x / TEX_W;
      const d = Math.abs(u - 0.5) * 2;
      let m = markAmount(a, u, v, seed);
      if (isWhiteSelf) m = 0;
      // пигментированная шерсть: светлее к животу
      let pig: RGB = pigment;
      if (a.pattern === 'self' || a.pattern === 'berkshire') {
        pig = mixRgb(pigment, belly, smoothstep(0.55, 0.95, d) * (a.pattern === 'self' ? 1 : 0.4));
      }
      if (ticking > 0) {
        const t = hash2(x, y, seed + 3);
        const t2 = vnoiseWrapX(u * 90, v * 30, 90, seed + 4);
        pig = mixRgb(pig, t < 0.4 ? tickDark : tickGold, (t2 > 0.6 ? 0.32 : 0.16) * ticking * (1 - smoothstep(0.6, 0.95, d)));
      }
      let c = mixRgb(light, pig, m);
      // мягкая тень по спине (объём)
      const back = 1 - smoothstep(0, 0.7, d);
      c = mixRgb(c, [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9], back * 0.25 * (1 - m * 0.3));
      // волоски вдоль тела
      const strand = vnoiseWrapX(u * 140, v * 10, 140, seed + 11);
      const fine = hash2(x, Math.floor(y / 3), seed + 12);
      let k = 0.9 + strand * 0.14 + (fine - 0.5) * 0.06;
      if (rex) k *= 0.96 + 0.05 * Math.sin(v * 90 + strand * 5 + u * 20);
      c = [c[0] * k, c[1] * k, c[2] * k];
      if (silver > 0 && m > 0.5) {
        const sh = hash2(x, Math.floor(y / 2), seed + 21);
        if (sh > 0.72) c = mixRgb(c, [236, 236, 240], 0.75 * silver);
      }
      const i = (y * TEX_W + x) * 4;
      data[i] = Math.min(255, c[0]);
      data[i + 1] = Math.min(255, c[1]);
      data[i + 2] = Math.min(255, c[2]);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function makeFurTexture(a: Appearance): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(generateFurCanvas(a));
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ---------- Общие текстуры (кэшируются) ----------

const cache = new Map<string, THREE.Texture>();

/** Нормал-карта ворса (гладкая / рекс) */
export function furNormalMap(rex: boolean): THREE.Texture {
  const key = rex ? 'n_rex' : 'n_smooth';
  const ex = cache.get(key);
  if (ex) return ex;
  const W = 256;
  const H = 256;
  const hgt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      let h = vnoiseWrapX(u * 120, v * 8, 120, 7) * 0.7 + hash2(x, Math.floor(y / 4), 3) * 0.3;
      if (rex) h = h * 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(v * 90 + vnoiseWrapX(u * 20, v * 4, 20, 1) * 6));
      hgt[y * W + x] = h;
    }
  }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const strength = rex ? 2.6 : 2.2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = hgt[y * W + ((x - 1 + W) % W)];
      const r = hgt[y * W + ((x + 1) % W)];
      const t = hgt[Math.max(0, y - 1) * W + x];
      const b = hgt[Math.min(H - 1, y + 1) * W + x];
      let nx = (l - r) * strength;
      let ny = (t - b) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      const i = (y * W + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / len) * 0.5 * 255 + 127;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Альфа-карта для shell-слоёв меха (кончики волосков) */
export function furShellAlpha(rex: boolean): THREE.Texture {
  const key = rex ? 'shell_rex' : 'shell';
  const ex = cache.get(key);
  if (ex) return ex;
  const W = 512;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = hash2(x, Math.floor(y / (rex ? 1 : 2)), 77);
      const clump = vnoiseWrapX((x / W) * 60, (y / H) * 30, 60, 5);
      const a = n * 0.7 + clump * 0.3 > (rex ? 0.62 : 0.58) ? 255 : 0;
      const i = (y * W + x) * 4;
      img.data[i] = a;
      img.data[i + 1] = a;
      img.data[i + 2] = a;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Текстура кожи хвоста с колечками-чешуйками */
export function tailTexture(): THREE.Texture {
  const ex = cache.get('tail');
  if (ex) return ex;
  const W = 64;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ring = 0.5 + 0.5 * Math.sin((y / H) * Math.PI * 2 * 60 + Math.sin((x / W) * Math.PI * 2 * 6) * 0.6);
      const k = 0.82 + ring * 0.18 + (hash2(x, y, 9) - 0.5) * 0.06;
      const i = (y * W + x) * 4;
      img.data[i] = 255 * k;
      img.data[i + 1] = 255 * k;
      img.data[i + 2] = 255 * k;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  cache.set('tail', tex);
  return tex;
}

export interface RatPalette {
  frontLimb: THREE.Color;
  hindLimb: THREE.Color;
  skin: THREE.Color;
  paw: THREE.Color;
  earInner: THREE.Color;
  earOuter: THREE.Color;
  tailBase: THREE.Color;
  tail: THREE.Color;
  eye: THREE.Color;
  nose: THREE.Color;
  whisker: THREE.Color;
}

function c(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/** Цвета частей тела, согласованные с рисунком */
export function ratPalette(a: Appearance): RatPalette {
  const col = colorDef(a.color);
  const pig = c(col.hex);
  const white = c('#f1ede5');
  const pinkSkin = c('#eeb3b0');
  const isWhiteSelf = a.color === 'white';
  let frontLimb = pig.clone();
  let hindLimb = pig.clone();
  let skin = c(col.skin);
  let paw = pinkSkin.clone();
  let tailBase = pig.clone();
  switch (a.pattern) {
    case 'stripe':
    case 'spots':
      frontLimb = white.clone();
      hindLimb = white.clone();
      skin = pinkSkin.clone();
      tailBase = a.pattern === 'stripe' ? pig.clone().lerp(white, 0.3) : white.clone();
      break;
    case 'capped':
    case 'hoodonly':
    case 'hooded':
    case 'variegated':
      // цветная голова — ушки слегка пигментированы
      frontLimb = a.pattern === 'hooded' ? white.clone().lerp(pig, 0.15) : white.clone();
      hindLimb = white.clone();
      skin = c(col.skin).lerp(pinkSkin, 0.35);
      tailBase = a.pattern === 'hoodonly' ? white.clone() : pig.clone().lerp(white, 0.35);
      break;
    case 'berkshire':
      frontLimb = white.clone();
      hindLimb = white.clone();
      paw = c('#f3c5c2');
      break;
    case 'siamese':
      frontLimb = pig.clone().lerp(c('#e8dcc6'), 0.25);
      hindLimb = pig.clone().lerp(c('#e8dcc6'), 0.35);
      skin = c('#9b7c74');
      paw = c('#8c6d66');
      tailBase = pig.clone();
      break;
    case 'himalayan':
      frontLimb = pig.clone().lerp(c('#f2eee6'), 0.45);
      hindLimb = pig.clone().lerp(c('#f2eee6'), 0.55);
      skin = c('#b2928c');
      paw = c('#a3837d');
      tailBase = pig.clone().lerp(c('#f2eee6'), 0.5);
      break;
    case 'self':
      if (isWhiteSelf) {
        frontLimb = white.clone();
        hindLimb = white.clone();
        skin = pinkSkin.clone();
        tailBase = white.clone();
      } else {
        paw = c(col.skin).lerp(pinkSkin, 0.4);
      }
      break;
  }
  const dark = pig.getHSL({ h: 0, s: 0, l: 0 }).l < 0.35 && !['stripe', 'capped', 'hoodonly', 'spots', 'variegated'].includes(a.pattern);
  return {
    frontLimb,
    hindLimb,
    skin,
    paw,
    earInner: skin.clone().lerp(c('#f0a4a4'), 0.35),
    earOuter: skin.clone().multiplyScalar(0.92),
    tailBase,
    tail: skin.clone().lerp(c('#e9b0ad'), 0.3),
    eye: c(EYES[a.eyes].hex),
    nose: skin.clone().lerp(c('#e88f95'), 0.5),
    whisker: dark ? c('#4a4440') : c('#f4f0ea'),
  };
}
