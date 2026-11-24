import * as THREE from 'three';
import { hash2, hexToRgb, mixRgb, vnoise } from './noise';

/** Процедурные текстуры интерьера (Canvas2D → CanvasTexture), с кэшем */

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, img: ImageData) => void, srgb = true, repeat = true): THREE.CanvasTexture {
  const ex = cache.get(key);
  if (ex) return ex;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  draw(ctx, img);
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

function fill(img: ImageData, fn: (x: number, y: number) => [number, number, number]) {
  const { width: w, height: h, data } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      const i = (y * w + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
}

/** Доски пола */
export function woodFloorTexture(c1: string, c2: string): THREE.CanvasTexture {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return make(`floor_${c1}_${c2}`, 512, 512, (ctx, img) => {
    const plankW = 64;
    fill(img, (x, y) => {
      const plank = Math.floor(x / plankW);
      const off = hash2(plank, 0, 3) * 512;
      const yy = (y + off) % 512;
      const seg = Math.floor(yy / 256);
      const tone = hash2(plank, seg, 5);
      const grain = vnoise(x * 0.08, yy * 0.012, plank) * 0.6 + vnoise(x * 0.3, yy * 0.04, plank + 9) * 0.4;
      let c = mixRgb(a, b, tone * 0.7 + grain * 0.3);
      const edge = x % plankW < 2 || yy % 256 < 2 ? 0.72 : 1;
      c = [c[0] * edge, c[1] * edge, c[2] * edge];
      return c;
    });
    ctx.putImageData(img, 0, 0);
  });
}

/** Светлая древесина (мебель, домики, лесенки) */
export function woodTexture(base = '#d9b98f'): THREE.CanvasTexture {
  const a = hexToRgb(base);
  const b: [number, number, number] = [a[0] * 0.82, a[1] * 0.78, a[2] * 0.72];
  return make(`wood_${base}`, 256, 256, (ctx, img) => {
    fill(img, (x, y) => {
      const g = vnoise(x * 0.05, y * 0.6, 4) * 0.5 + Math.sin(x * 0.18 + vnoise(x * 0.02, y * 0.05, 2) * 6) * 0.25 + 0.25;
      return mixRgb(a, b, Math.max(0, Math.min(1, g)));
    });
    ctx.putImageData(img, 0, 0);
  });
}

/** Ткань (гамаки, вигвам) с полосками/клеткой */
export function fabricTexture(c1: string, c2: string, kind: 'stripe' | 'check' | 'plain' | 'plush' = 'stripe'): THREE.CanvasTexture {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return make(`fabric_${c1}_${c2}_${kind}`, 256, 256, (ctx, img) => {
    fill(img, (x, y) => {
      const weave = ((x + y) % 4 < 2 ? 0.96 : 1.03) * (0.97 + hash2(x, y, 1) * 0.06);
      let t = 0;
      if (kind === 'stripe') t = Math.floor(x / 32) % 2;
      else if (kind === 'check') t = (Math.floor(x / 32) + Math.floor(y / 32)) % 2 ? 0.8 : (Math.floor(x / 32) % 2 || Math.floor(y / 32) % 2 ? 0.4 : 0);
      else if (kind === 'plush') t = vnoise(x * 0.2, y * 0.2, 3) * 0.35;
      const c = mixRgb(a, b, t);
      return [c[0] * weave, c[1] * weave, c[2] * weave];
    });
    ctx.putImageData(img, 0, 0);
  });
}

/** Бумажный наполнитель (подстилка) */
export function beddingTexture(fresh: boolean): THREE.CanvasTexture {
  return make(`bedding_${fresh}`, 512, 512, (ctx, img) => {
    const base: [number, number, number] = fresh ? [238, 230, 214] : [214, 200, 176];
    fill(img, (x, y) => {
      const n = vnoise(x * 0.06, y * 0.06, 2) * 0.5 + vnoise(x * 0.2, y * 0.2, 7) * 0.3 + hash2(x, y, 1) * 0.2;
      const k = 0.78 + n * 0.3;
      return [base[0] * k, base[1] * k, base[2] * k];
    });
    ctx.putImageData(img, 0, 0);
    // клочки бумаги
    for (let i = 0; i < 700; i++) {
      const x = hash2(i, 1, 3) * 512;
      const y = hash2(i, 2, 3) * 512;
      const s = 4 + hash2(i, 3, 3) * 9;
      const l = 205 + hash2(i, 4, 3) * 45;
      ctx.fillStyle = `rgba(${l},${l - 6},${l - 18},0.9)`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hash2(i, 5, 3) * Math.PI);
      ctx.fillRect(-s / 2, -s / 3, s, s * 0.6);
      ctx.restore();
    }
  });
}

/** Обои/стена */
export function wallTexture(c1: string, c2: string): THREE.CanvasTexture {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return make(`wall_${c1}_${c2}`, 256, 256, (ctx, img) => {
    fill(img, (x, y) => {
      const n = vnoise(x * 0.04, y * 0.04, 5) * 0.4 + hash2(x, y, 2) * 0.1;
      const stripe = Math.floor(x / 64) % 2 === 0 ? 0 : 0.35;
      return mixRgb(a, b, stripe * 0.5 + n * 0.5);
    });
    ctx.putImageData(img, 0, 0);
  });
}

/** Вязаный ковёр */
export function rugTexture(c1: string, c2: string): THREE.CanvasTexture {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return make(`rug_${c1}_${c2}`, 256, 256, (ctx, img) => {
    fill(img, (x, y) => {
      const knit = Math.abs(((x % 8) - 4) / 4) * 0.25 + (y % 6 < 3 ? 0.05 : 0);
      const band = Math.floor(y / 32) % 3 === 0 ? 1 : 0;
      const c = mixRgb(a, b, band * 0.8 + knit);
      const k = 0.92 + hash2(x, y, 4) * 0.1;
      return [c[0] * k, c[1] * k, c[2] * k];
    });
    ctx.putImageData(img, 0, 0);
  });
}

/** Простая шумовая roughness-карта */
export function noiseRoughness(): THREE.CanvasTexture {
  return make('rough', 128, 128, (ctx, img) => {
    fill(img, (x, y) => {
      const v = 170 + vnoise(x * 0.1, y * 0.1, 1) * 70;
      return [v, v, v];
    });
    ctx.putImageData(img, 0, 0);
  }, false);
}

/** Мягкая радиальная тень-«блоб» */
export function blobShadowTexture(): THREE.CanvasTexture {
  return make('blob', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }, false, false);
}

/** Пёрышко для игрушки */
export function featherTexture(): THREE.CanvasTexture {
  return make('feather', 64, 128, (ctx) => {
    ctx.clearRect(0, 0, 64, 128);
    ctx.strokeStyle = '#f3e7d8';
    ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const y = 10 + i * 1.8;
      const w = Math.sin((i / 60) * Math.PI) * 26;
      ctx.strokeStyle = i % 7 === 0 ? '#e7a3b7' : '#f6efe6';
      ctx.beginPath();
      ctx.moveTo(32, y);
      ctx.quadraticCurveTo(32 - w * 0.6, y - 4, 32 - w, y - 8);
      ctx.moveTo(32, y);
      ctx.quadraticCurveTo(32 + w * 0.6, y - 4, 32 + w, y - 8);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c9b6a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.lineTo(32, 124);
    ctx.stroke();
  }, true, false);
}
