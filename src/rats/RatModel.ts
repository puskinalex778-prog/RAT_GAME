import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Appearance } from '../store/types';
import { furNormalMap, furShellAlpha, makeFurTexture, ratPalette, tailTexture, type RatPalette } from './furTexture';
import { createFurMaterial, createShellMaterial } from './furMaterial';

/**
 * Процедурная 3D-модель декоративной крысы.
 * Тело — единая «протяжка» эллиптических сечений вдоль гибкого позвоночника
 * (бёдра → середина спины → грудь → шея → голова → нос), пересчитывается каждый кадр.
 * Хвост — цепочка из 10 сегментов с пружинной инерцией (verlet), в мировых координатах.
 */

export interface PoseParams {
  crouch: number;
  rear: number;
  curl: number;
  yaw: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  stretch: number;
  frontLift: number;
  hold: number;
  wash: number;
  pawRaise: number;
  scratch: number;
  squint: number;
  earPerk: number;
  chew: number;
  sniff: number;
  breath: number;
  lie: number;
  tailCurl: number;
  climb: number;
  gait: number;
}

export function defaultPose(): PoseParams {
  return {
    crouch: 0,
    rear: 0,
    curl: 0,
    yaw: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    stretch: 0,
    frontLift: 0,
    hold: 0,
    wash: 0,
    pawRaise: 0,
    scratch: 0,
    squint: 0,
    earPerk: 0,
    chew: 0,
    sniff: 0.3,
    breath: 1,
    lie: 0,
    tailCurl: 0,
    climb: 0,
    gait: 0,
  };
}

const POSE_KEYS = Object.keys(defaultPose()) as (keyof PoseParams)[];
/** скорость сглаживания по параметрам (1/с) */
const POSE_RATE: Partial<Record<keyof PoseParams, number>> = {
  squint: 14,
  chew: 12,
  wash: 7,
  gait: 6,
  curl: 2.2,
  lie: 2.2,
  tailCurl: 1.8,
  rear: 5,
  frontLift: 7,
};

// --- профиль сечений тела вдоль s (0 — основание хвоста, 1 — нос) ---
const PROF_S = [0, 0.05, 0.14, 0.28, 0.42, 0.56, 0.64, 0.7, 0.76, 0.84, 0.91, 0.96, 1];
const PROF_W = [0.018, 0.035, 0.047, 0.05, 0.046, 0.038, 0.031, 0.031, 0.032, 0.027, 0.019, 0.011, 0.002];
const PROF_H = [0.017, 0.033, 0.044, 0.046, 0.042, 0.036, 0.03, 0.03, 0.03, 0.024, 0.016, 0.0095, 0.002];

function profile(s: number, arr: number[]): number {
  for (let i = 1; i < PROF_S.length; i++) {
    if (s <= PROF_S[i]) {
      const t = (s - PROF_S[i - 1]) / (PROF_S[i] - PROF_S[i - 1]);
      const k = t * t * (3 - 2 * t);
      return arr[i - 1] + (arr[i] - arr[i - 1]) * k;
    }
  }
  return arr[arr.length - 1];
}

const RINGS = 30;
const RADIAL = 20;
const SPINE_PTS = 7;
const SPINE_SAMPLES = 64;

const TAIL_N = 11; // 10 сегментов
const TAIL_SMOOTH = 26;
const TAIL_RADIAL = 6;

// Общие геометрии
let pawHindGeo: THREE.BufferGeometry | null = null;
let pawFrontGeo: THREE.BufferGeometry | null = null;
let earGeo: THREE.BufferGeometry | null = null;
let limbGeo: THREE.BufferGeometry | null = null;
let eyeGeo: THREE.BufferGeometry | null = null;
let hlGeo: THREE.BufferGeometry | null = null;
let noseGeo: THREE.BufferGeometry | null = null;

function sharedGeos() {
  if (!pawHindGeo) {
    const parts: THREE.BufferGeometry[] = [];
    const palm = new THREE.SphereGeometry(1, 10, 6);
    palm.scale(0.0072, 0.0036, 0.0165);
    palm.translate(0, 0.0032, 0.011);
    parts.push(palm);
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.32;
      const t = new THREE.SphereGeometry(1, 6, 4);
      const len = i === 0 || i === 4 ? 0.0045 : 0.006;
      t.scale(0.0018, 0.0016, len);
      t.translate(Math.sin(a) * 0.009, 0.0018, 0.024 + Math.cos(a) * 0.004 - Math.abs(i - 2) * 0.0015);
      parts.push(t);
    }
    pawHindGeo = mergeGeometries(parts.map((g) => g.toNonIndexed()));
    pawHindGeo.computeVertexNormals();

    const fparts: THREE.BufferGeometry[] = [];
    const fpalm = new THREE.SphereGeometry(1, 8, 6);
    fpalm.scale(0.0055, 0.0032, 0.0062);
    fpalm.translate(0, 0.003, 0.004);
    fparts.push(fpalm);
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.42;
      const t = new THREE.SphereGeometry(1, 6, 4);
      t.scale(0.0014, 0.0013, 0.0042);
      t.translate(Math.sin(a) * 0.0058, 0.002, 0.0095 + Math.cos(a) * 0.0015);
      fparts.push(t);
    }
    pawFrontGeo = mergeGeometries(fparts.map((g) => g.toNonIndexed()));
    pawFrontGeo.computeVertexNormals();

    // Ухо: овальный «лепесток» с чашечкой, начало координат — у основания
    const eg = new THREE.BufferGeometry();
    const seg = 18;
    const rings = 5;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    pos.push(0, 0.012, 0);
    col.push(1, 1, 1);
    for (let r = 1; r <= rings; r++) {
      const rr = r / rings;
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const x = Math.cos(a) * 0.0115 * rr;
        const y = 0.012 + Math.sin(a) * 0.0128 * rr;
        const z = rr * rr * 0.0045;
        pos.push(x, y, z);
        const edge = rr > 0.8 ? 0 : 1;
        col.push(edge, edge, edge);
      }
    }
    for (let i = 0; i < seg; i++) idx.push(0, 1 + i, 1 + ((i + 1) % seg));
    for (let r = 1; r < rings; r++) {
      const a0 = 1 + (r - 1) * seg;
      const a1 = 1 + r * seg;
      for (let i = 0; i < seg; i++) {
        const i1 = (i + 1) % seg;
        idx.push(a0 + i, a1 + i, a1 + i1, a0 + i, a1 + i1, a0 + i1);
      }
    }
    eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    eg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    eg.setIndex(idx);
    eg.computeVertexNormals();
    earGeo = eg;

    limbGeo = new THREE.CapsuleGeometry(1, 1, 4, 8);
    eyeGeo = new THREE.SphereGeometry(1, 14, 10);
    hlGeo = new THREE.SphereGeometry(1, 6, 4);
    noseGeo = new THREE.SphereGeometry(1, 10, 8);
  }
  return {
    pawHind: pawHindGeo!,
    pawFront: pawFrontGeo!,
    ear: earGeo!,
    limb: limbGeo!,
    eye: eyeGeo!,
    hl: hlGeo!,
    nose: noseGeo!,
  };
}

export type HeldShape = 'pellet' | 'veg' | 'drop' | 'nut' | 'seed';

function makeHeldMesh(shape: HeldShape, color: string): THREE.Mesh {
  let g: THREE.BufferGeometry;
  switch (shape) {
    case 'veg': {
      const stem = new THREE.CylinderGeometry(0.0022, 0.0028, 0.012, 6);
      stem.translate(0, -0.004, 0);
      const head = new THREE.IcosahedronGeometry(0.0062, 1);
      head.translate(0, 0.004, 0);
      g = mergeGeometries([stem.toNonIndexed(), head.toNonIndexed()]);
      break;
    }
    case 'drop':
      g = new THREE.SphereGeometry(0.0055, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
      break;
    case 'nut':
      g = new THREE.IcosahedronGeometry(0.0065, 1);
      g.scale(1.2, 0.8, 1);
      break;
    case 'seed':
      g = new THREE.SphereGeometry(0.0045, 8, 6);
      g.scale(0.7, 0.35, 1.3);
      break;
    default:
      g = new THREE.CylinderGeometry(0.0035, 0.0035, 0.011, 8);
      g.rotateZ(Math.PI / 2);
  }
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
  m.castShadow = false;
  return m;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

export interface Frame {
  c: THREE.Vector3;
  t: THREE.Vector3;
  n: THREE.Vector3;
  b: THREE.Vector3;
  w: number;
  h: number;
}

function newFrame(): Frame {
  return { c: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), w: 0, h: 0 };
}

export class RatModel {
  readonly group = new THREE.Group();
  readonly pose: PoseParams = defaultPose();
  readonly target: PoseParams = defaultPose();
  readonly pick: THREE.Mesh;

  appearance: Appearance;
  palette: RatPalette;
  scaleValue = 1;

  private bodyGeo: THREE.BufferGeometry;
  private bodyPos: Float32Array;
  private bodyNrm: Float32Array;
  private body: THREE.Mesh;
  private shells: THREE.Mesh[] = [];
  private furTex: THREE.CanvasTexture;
  private bodyMat: THREE.MeshStandardMaterial;
  private shellMats: THREE.MeshStandardMaterial[] = [];

  private ears: THREE.Mesh[] = [];
  private eyes: THREE.Mesh[] = [];
  private highlights: THREE.Mesh[] = [];
  private nose: THREE.Mesh;
  private whiskers: THREE.LineSegments;
  private whiskerPos: Float32Array;
  private whiskerSegs: number;
  private limbs: THREE.Mesh[] = []; // fl, fr, hl, hr
  private paws: THREE.Mesh[] = [];
  private limbMatF: THREE.MeshStandardMaterial;
  private limbMatH: THREE.MeshStandardMaterial;
  private skinMat: THREE.MeshStandardMaterial;
  private pawMat: THREE.MeshStandardMaterial;
  private earMat: THREE.MeshStandardMaterial;
  private eyeMat: THREE.MeshStandardMaterial;
  private noseMat: THREE.MeshStandardMaterial;
  private whiskerMat: THREE.LineBasicMaterial;

  // хвост (в мировых координатах)
  readonly tail: THREE.Mesh;
  private tailGeo: THREE.BufferGeometry;
  private tailPos: Float32Array;
  private tailNrm: Float32Array;
  private tailCol: Float32Array;
  private tailMat: THREE.MeshStandardMaterial;
  private tp: THREE.Vector3[] = [];
  private tpPrev: THREE.Vector3[] = [];
  private tailInit = false;
  tailFloorY: number | null = 0;

  // позвоночник
  private spine: THREE.Vector3[] = [];
  private samples: THREE.Vector3[] = [];
  private sampleLen = new Float32Array(SPINE_SAMPLES);
  private frames: Frame[] = [];
  private tmpFrame = newFrame();

  private time = Math.random() * 100;
  private blinkT = 2 + Math.random() * 3;
  private blink = 0;
  gaitPhase = 0;
  private held: THREE.Mesh | null = null;
  private mouthItem: THREE.Mesh | null = null;
  private shellEnabled = true;
  /** множитель размаха вибриссов (обнюхивание) */
  whiskerBoost = 0;

  constructor(appearance: Appearance, shell = true) {
    this.appearance = appearance;
    this.palette = ratPalette(appearance);
    const g = sharedGeos();

    // --- тело ---
    const vertCount = (RINGS + 1) * (RADIAL + 1) + 2;
    this.bodyPos = new Float32Array(vertCount * 3);
    this.bodyNrm = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const idx: number[] = [];
    for (let i = 0; i <= RINGS; i++) {
      for (let j = 0; j <= RADIAL; j++) {
        const k = i * (RADIAL + 1) + j;
        uvs[k * 2] = j / RADIAL;
        uvs[k * 2 + 1] = i / RINGS;
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j;
        const b = a + RADIAL + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const capA = (RINGS + 1) * (RADIAL + 1);
    const capB = capA + 1;
    uvs[capA * 2] = 0.5;
    uvs[capA * 2 + 1] = 0;
    uvs[capB * 2] = 0.5;
    uvs[capB * 2 + 1] = 1;
    for (let j = 0; j < RADIAL; j++) {
      idx.push(capA, j + 1, j);
      const last = RINGS * (RADIAL + 1);
      idx.push(capB, last + j, last + j + 1);
    }
    this.bodyGeo = new THREE.BufferGeometry();
    this.bodyGeo.setAttribute('position', new THREE.BufferAttribute(this.bodyPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.bodyGeo.setAttribute('normal', new THREE.BufferAttribute(this.bodyNrm, 3).setUsage(THREE.DynamicDrawUsage));
    this.bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.bodyGeo.setIndex(idx);

    this.furTex = makeFurTexture(appearance);
    this.bodyMat = createFurMaterial(this.furTex, furNormalMap(appearance.coat === 'rex'));
    this.body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    this.body.castShadow = true;
    this.body.frustumCulled = false;
    this.group.add(this.body);

    this.shellEnabled = shell;
    this.buildShells();

    for (let i = 0; i <= RINGS; i++) this.frames.push(newFrame());
    for (let i = 0; i < SPINE_PTS; i++) this.spine.push(new THREE.Vector3());
    for (let i = 0; i < SPINE_SAMPLES; i++) this.samples.push(new THREE.Vector3());

    // --- материалы частей ---
    const p = this.palette;
    this.limbMatF = new THREE.MeshStandardMaterial({ color: p.frontLimb, roughness: 0.95 });
    this.limbMatH = new THREE.MeshStandardMaterial({ color: p.hindLimb, roughness: 0.95 });
    this.skinMat = new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.6 });
    this.pawMat = new THREE.MeshStandardMaterial({ color: p.paw, roughness: 0.62, emissive: new THREE.Color('#5a1f1f'), emissiveIntensity: 0.08 });
    this.earMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color('#6a2020'), emissiveIntensity: 0.12 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: p.eye, roughness: 0.22, metalness: 0.0 });
    this.noseMat = new THREE.MeshStandardMaterial({ color: p.nose, roughness: 0.4 });
    this.whiskerMat = new THREE.LineBasicMaterial({ color: p.whisker, transparent: true, opacity: 0.75 });
    this.applyEarColors();

    for (let s = 0; s < 2; s++) {
      const ear = new THREE.Mesh(g.ear, this.earMat);
      ear.matrixAutoUpdate = false;
      this.ears.push(ear);
      this.group.add(ear);
      const eye = new THREE.Mesh(g.eye, this.eyeMat);
      eye.matrixAutoUpdate = false;
      this.eyes.push(eye);
      this.group.add(eye);
      const hl = new THREE.Mesh(g.hl, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      hl.matrixAutoUpdate = false;
      this.highlights.push(hl);
      this.group.add(hl);
    }
    this.nose = new THREE.Mesh(g.nose, this.noseMat);
    this.nose.matrixAutoUpdate = false;
    this.group.add(this.nose);

    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const limb = new THREE.Mesh(g.limb, front ? this.limbMatF : this.limbMatH);
      limb.matrixAutoUpdate = false;
      limb.castShadow = false;
      this.limbs.push(limb);
      this.group.add(limb);
      const paw = new THREE.Mesh(front ? g.pawFront : g.pawHind, this.pawMat);
      paw.matrixAutoUpdate = false;
      this.paws.push(paw);
      this.group.add(paw);
    }

    // вибриссы
    this.whiskerSegs = appearance.coat === 'rex' ? 4 : 2;
    const wCount = 12 * this.whiskerSegs * 2;
    this.whiskerPos = new Float32Array(wCount * 3);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(this.whiskerPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.whiskers = new THREE.LineSegments(wg, this.whiskerMat);
    this.whiskers.frustumCulled = false;
    this.group.add(this.whiskers);

    // хвост
    const tv = (TAIL_SMOOTH) * (TAIL_RADIAL + 1);
    this.tailPos = new Float32Array(tv * 3);
    this.tailNrm = new Float32Array(tv * 3);
    this.tailCol = new Float32Array(tv * 3);
    const tuv = new Float32Array(tv * 2);
    const tidx: number[] = [];
    for (let i = 0; i < TAIL_SMOOTH; i++) {
      for (let j = 0; j <= TAIL_RADIAL; j++) {
        const k = i * (TAIL_RADIAL + 1) + j;
        tuv[k * 2] = j / TAIL_RADIAL;
        tuv[k * 2 + 1] = (i / (TAIL_SMOOTH - 1)) * 4;
      }
    }
    for (let i = 0; i < TAIL_SMOOTH - 1; i++) {
      for (let j = 0; j < TAIL_RADIAL; j++) {
        const a = i * (TAIL_RADIAL + 1) + j;
        const b = a + TAIL_RADIAL + 1;
        tidx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    this.tailGeo = new THREE.BufferGeometry();
    this.tailGeo.setAttribute('position', new THREE.BufferAttribute(this.tailPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.tailGeo.setAttribute('normal', new THREE.BufferAttribute(this.tailNrm, 3).setUsage(THREE.DynamicDrawUsage));
    this.tailGeo.setAttribute('color', new THREE.BufferAttribute(this.tailCol, 3));
    this.tailGeo.setAttribute('uv', new THREE.BufferAttribute(tuv, 2));
    this.tailGeo.setIndex(tidx);
    this.tailMat = new THREE.MeshStandardMaterial({ map: tailTexture(), vertexColors: true, roughness: 0.55, emissive: new THREE.Color('#5a2020'), emissiveIntensity: 0.06 });
    this.tail = new THREE.Mesh(this.tailGeo, this.tailMat);
    this.tail.castShadow = true;
    this.tail.frustumCulled = false;
    this.applyTailColors();
    for (let i = 0; i < TAIL_N; i++) {
      this.tp.push(new THREE.Vector3());
      this.tpPrev.push(new THREE.Vector3());
    }

    // прокси для выбора касанием
    this.pick = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    this.pick.scale.set(0.06, 0.055, 0.12);
    this.pick.position.set(0, 0.045, 0.0);
    this.group.add(this.pick);

    this.update(0);
  }

  private buildShells() {
    for (const s of this.shells) this.group.remove(s);
    for (const m of this.shellMats) m.dispose();
    this.shells = [];
    this.shellMats = [];
    if (!this.shellEnabled) return;
    const rex = this.appearance.coat === 'rex';
    const alpha = furShellAlpha(rex);
    const offs = rex ? [0.0018, 0.0034] : [0.0012, 0.0024];
    offs.forEach((o, i) => {
      const m = createShellMaterial(this.furTex, alpha, o, i + 1);
      this.shellMats.push(m);
      const mesh = new THREE.Mesh(this.bodyGeo, m);
      mesh.frustumCulled = false;
      this.shells.push(mesh);
      this.group.add(mesh);
    });
  }

  setShellEnabled(on: boolean) {
    if (on === this.shellEnabled) return;
    this.shellEnabled = on;
    this.buildShells();
  }

  private applyEarColors() {
    // вершинные цвета уха: 1 — внутренняя часть, 0 — край
    this.earMat.color.set('#ffffff');
    const inner = this.palette.earInner;
    const outer = this.palette.earOuter;
    this.earMat.onBeforeCompile = (sh) => {
      sh.uniforms.uInner = { value: inner };
      sh.uniforms.uOuter = { value: outer };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uInner;\nuniform vec3 uOuter;')
        .replace('#include <color_fragment>', 'diffuseColor.rgb = mix(uOuter, uInner, vColor.r);');
    };
    this.earMat.customProgramCacheKey = () => `ear-${inner.getHexString()}-${outer.getHexString()}`;
    this.earMat.needsUpdate = true;
  }

  private applyTailColors() {
    const base = this.palette.tailBase;
    const tail = this.palette.tail;
    for (let i = 0; i < TAIL_SMOOTH; i++) {
      const t = i / (TAIL_SMOOTH - 1);
      const k = Math.min(1, t / 0.12);
      const r = base.r + (tail.r - base.r) * k;
      const g = base.g + (tail.g - base.g) * k;
      const b = base.b + (tail.b - base.b) * k;
      for (let j = 0; j <= TAIL_RADIAL; j++) {
        const q = (i * (TAIL_RADIAL + 1) + j) * 3;
        this.tailCol[q] = r;
        this.tailCol[q + 1] = g;
        this.tailCol[q + 2] = b;
      }
    }
    (this.tailGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Обновить внешность (конструктор) */
  setAppearance(a: Appearance) {
    const rexChanged = a.coat !== this.appearance.coat;
    this.appearance = a;
    this.palette = ratPalette(a);
    const old = this.furTex;
    this.furTex = makeFurTexture(a);
    this.bodyMat.map = this.furTex;
    this.bodyMat.normalMap = furNormalMap(a.coat === 'rex');
    this.bodyMat.needsUpdate = true;
    if (rexChanged) {
      this.whiskerSegs = a.coat === 'rex' ? 4 : 2;
      const wCount = 12 * this.whiskerSegs * 2;
      this.whiskerPos = new Float32Array(wCount * 3);
      this.whiskers.geometry.setAttribute('position', new THREE.BufferAttribute(this.whiskerPos, 3).setUsage(THREE.DynamicDrawUsage));
    }
    this.buildShells();
    old.dispose();
    const p = this.palette;
    this.limbMatF.color.copy(p.frontLimb);
    this.limbMatH.color.copy(p.hindLimb);
    this.skinMat.color.copy(p.skin);
    this.pawMat.color.copy(p.paw);
    this.eyeMat.color.copy(p.eye);
    this.noseMat.color.copy(p.nose);
    this.whiskerMat.color.copy(p.whisker);
    this.applyEarColors();
    this.applyTailColors();
  }

  setScale(s: number) {
    this.scaleValue = s;
    this.group.scale.setScalar(s);
  }

  setHeld(shape: HeldShape | null, color = '#c9a36a') {
    if (this.held) {
      this.group.remove(this.held);
      this.held.geometry.dispose();
      (this.held.material as THREE.Material).dispose();
      this.held = null;
    }
    if (shape) {
      this.held = makeHeldMesh(shape, color);
      this.held.matrixAutoUpdate = false;
      this.group.add(this.held);
    }
  }

  setMouthItem(on: boolean) {
    if (on && !this.mouthItem) {
      const g = new THREE.PlaneGeometry(0.026, 0.02, 3, 2);
      const pa = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, (Math.random() - 0.5) * 0.006);
      g.computeVertexNormals();
      this.mouthItem = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#f7f4ee', roughness: 0.95, side: THREE.DoubleSide }));
      this.mouthItem.matrixAutoUpdate = false;
      this.group.add(this.mouthItem);
    } else if (!on && this.mouthItem) {
      this.group.remove(this.mouthItem);
      this.mouthItem.geometry.dispose();
      this.mouthItem = null;
    }
  }

  resetTail() {
    this.tailInit = false;
  }

  /** Кадр позвоночника в точке s (локальные координаты модели) */
  frameAt(s: number, out: Frame = this.tmpFrame): Frame {
    const f = Math.min(RINGS - 1e-4, Math.max(0, s * RINGS));
    const i = Math.floor(f);
    const t = f - i;
    const a = this.frames[i];
    const b = this.frames[i + 1];
    out.c.lerpVectors(a.c, b.c, t);
    out.t.lerpVectors(a.t, b.t, t).normalize();
    out.n.lerpVectors(a.n, b.n, t).normalize();
    out.b.lerpVectors(a.b, b.b, t).normalize();
    out.w = a.w + (b.w - a.w) * t;
    out.h = a.h + (b.h - a.h) * t;
    return out;
  }

  /** Мировая позиция головы (для камеры/имени) */
  headWorld(out: THREE.Vector3): THREE.Vector3 {
    const f = this.frameAt(0.82);
    return this.group.localToWorld(out.copy(f.c));
  }
  mouthWorld(out: THREE.Vector3): THREE.Vector3 {
    const f = this.frameAt(0.97);
    return this.group.localToWorld(out.copy(f.c));
  }
  bodyCenterWorld(out: THREE.Vector3): THREE.Vector3 {
    const f = this.frameAt(0.42);
    return this.group.localToWorld(out.copy(f.c));
  }

  // ---------------------------------------------------------------
  update(dt: number) {
    this.time += dt;
    const P = this.pose;
    const T = this.target;
    for (const k of POSE_KEYS) {
      const rate = POSE_RATE[k] ?? 8;
      const a = 1 - Math.exp(-rate * dt);
      P[k] += (T[k] - P[k]) * (dt > 0 ? a : 1);
    }
    // моргание
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 0.14;
      this.blinkT = 2.5 + Math.random() * 4;
    }
    if (this.blink > 0) this.blink -= dt;

    this.computeSpine();
    this.buildBody();
    this.placeHead();
    this.placeLimbs();
    this.group.updateMatrixWorld(true);
    this.updateTail(dt);
  }

  private computeSpine() {
    const P = this.pose;
    const r = P.rear;
    const c = P.curl;
    const st = P.stretch;
    const lenK = 1 + 0.14 * st - 0.06 * c;
    const L = [0.056 * lenK, 0.048 * lenK, 0.03, 0.032, 0.042];
    const pitch = [
      0.07 + 1.18 * r - 0.05 * st + 0.12 * P.climb,
      -0.13 + 1.3 * r - 0.04 * st,
      0.05 + 1.05 * r - 0.25 * P.lie,
      0.05 + 0.5 * r + P.headPitch * 0.5 - 0.3 * c - 0.2 * P.lie,
      -0.32 + 0.28 * r + P.headPitch - 0.35 * c,
    ];
    const bend = P.yaw * 0.2;
    // приращения рыскания (накапливаются вдоль позвоночника)
    const dyaw = [
      0.5 * c + bend,
      0.55 * c + bend,
      0.5 * c + bend + P.headYaw * 0.1,
      0.45 * c + P.headYaw * 0.35,
      0.35 * c + P.headYaw * 0.35,
    ];
    const yaw: number[] = [];
    let acc0 = 0;
    for (let i = 0; i < 5; i++) {
      acc0 += dyaw[i];
      yaw.push(acc0);
    }
    // дыхание и обнюхивание — микродвижение головы
    const sniffBob = Math.sin(this.time * 18) * 0.03 * P.sniff;
    pitch[4] += sniffBob + Math.sin(this.time * 24) * 0.02 * P.chew;

    const hipY = (0.042 - 0.01 * r - 0.016 * P.crouch - 0.018 * P.lie - 0.012 * c) * (1 - 0.1 * st);
    const hipZ = -0.055 - 0.012 * r + 0.012 * c;
    const sp = this.spine;
    sp[1].set(0, hipY, hipZ);
    // основание хвоста
    const tp = -0.45 - 0.25 * r + 0.2 * P.lie;
    const ty = -0.5 * c - bend;
    sp[0].set(-Math.sin(ty) * Math.cos(tp) * 0.036, hipY + Math.sin(tp) * 0.036, hipZ - Math.cos(ty) * Math.cos(tp) * 0.036);
    for (let i = 0; i < 5; i++) {
      const p = pitch[i];
      const y = yaw[i];
      _v1.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
      sp[i + 2].copy(sp[i + 1]).addScaledVector(_v1, L[i]);
    }
    // центрируем крысу: середина тела около начала координат по Z
    const shiftZ = -(sp[1].z + sp[3].z) * 0.5 * (1 - r) - 0.0;
    for (const v of sp) v.z += shiftZ;

    // Catmull-Rom сэмплинг с длинами
    const S = this.samples;
    let acc = 0;
    for (let i = 0; i < SPINE_SAMPLES; i++) {
      const u = (i / (SPINE_SAMPLES - 1)) * (SPINE_PTS - 1);
      const k = Math.min(SPINE_PTS - 2, Math.floor(u));
      const t = u - k;
      const p0 = sp[Math.max(0, k - 1)];
      const p1 = sp[k];
      const p2 = sp[k + 1];
      const p3 = sp[Math.min(SPINE_PTS - 1, k + 2)];
      const t2 = t * t;
      const t3 = t2 * t;
      S[i].set(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      );
      if (i > 0) acc += S[i].distanceTo(S[i - 1]);
      this.sampleLen[i] = acc;
    }
    const total = acc;
    // кадры колец (parallel transport)
    let si = 0;
    const breath = 1 + Math.sin(this.time * (P.lie > 0.5 || P.curl > 0.5 ? 5 : 9)) * 0.022 * P.breath;
    for (let i = 0; i <= RINGS; i++) {
      const s = i / RINGS;
      const target = s * total;
      while (si < SPINE_SAMPLES - 2 && this.sampleLen[si + 1] < target) si++;
      const l0 = this.sampleLen[si];
      const l1 = this.sampleLen[si + 1];
      const t = l1 > l0 ? (target - l0) / (l1 - l0) : 0;
      const F = this.frames[i];
      F.c.lerpVectors(S[si], S[si + 1], t);
      F.t.subVectors(S[si + 1], S[si]).normalize();
      if (i === 0) {
        F.n.copy(UP).addScaledVector(F.t, -UP.dot(F.t));
        if (F.n.lengthSq() < 1e-6) F.n.set(0, 0, -1);
        F.n.normalize();
      } else {
        const prev = this.frames[i - 1];
        _q.setFromUnitVectors(prev.t, F.t);
        F.n.copy(prev.n).applyQuaternion(_q);
        F.n.addScaledVector(F.t, -F.n.dot(F.t)).normalize();
      }
      F.b.crossVectors(F.t, F.n).normalize();
      let w = profile(s, PROF_W);
      let h = profile(s, PROF_H);
      if (s > 0.3 && s < 0.62) {
        w *= breath;
        h *= breath;
      }
      F.w = w;
      F.h = h;
    }
    // крен головы
    if (Math.abs(P.headRoll) > 1e-3) {
      for (let i = Math.floor(RINGS * 0.66); i <= RINGS; i++) {
        const F = this.frames[i];
        const k = (i / RINGS - 0.66) / 0.34;
        _q.setFromAxisAngle(F.t, P.headRoll * k);
        F.n.applyQuaternion(_q);
        F.b.applyQuaternion(_q);
      }
    }
  }

  private buildBody() {
    const pos = this.bodyPos;
    const nrm = this.bodyNrm;
    for (let i = 0; i <= RINGS; i++) {
      const F = this.frames[i];
      for (let j = 0; j <= RADIAL; j++) {
        const u = j / RADIAL;
        const phi = (u - 0.5) * Math.PI * 2;
        let cy = Math.cos(phi);
        const sx = Math.sin(phi);
        const bellyK = cy < 0 ? 0.86 : 1;
        cy *= bellyK;
        const k = (i * (RADIAL + 1) + j) * 3;
        const px = F.c.x + F.n.x * F.h * cy + F.b.x * F.w * sx;
        const py = F.c.y + F.n.y * F.h * cy + F.b.y * F.w * sx;
        const pz = F.c.z + F.n.z * F.h * cy + F.b.z * F.w * sx;
        pos[k] = px;
        pos[k + 1] = py;
        pos[k + 2] = pz;
        // аналитическая нормаль эллипса
        const nx = (F.n.x * Math.cos(phi)) / F.h + (F.b.x * sx) / F.w;
        const ny = (F.n.y * Math.cos(phi)) / F.h + (F.b.y * sx) / F.w;
        const nz = (F.n.z * Math.cos(phi)) / F.h + (F.b.z * sx) / F.w;
        const len = Math.hypot(nx, ny, nz) || 1;
        nrm[k] = nx / len;
        nrm[k + 1] = ny / len;
        nrm[k + 2] = nz / len;
      }
    }
    const capA = (RINGS + 1) * (RADIAL + 1) * 3;
    const f0 = this.frames[0];
    pos[capA] = f0.c.x - f0.t.x * 0.004;
    pos[capA + 1] = f0.c.y - f0.t.y * 0.004;
    pos[capA + 2] = f0.c.z - f0.t.z * 0.004;
    nrm[capA] = -f0.t.x;
    nrm[capA + 1] = -f0.t.y;
    nrm[capA + 2] = -f0.t.z;
    const fl = this.frames[RINGS];
    pos[capA + 3] = fl.c.x + fl.t.x * 0.001;
    pos[capA + 4] = fl.c.y + fl.t.y * 0.001;
    pos[capA + 5] = fl.c.z + fl.t.z * 0.001;
    nrm[capA + 3] = fl.t.x;
    nrm[capA + 4] = fl.t.y;
    nrm[capA + 5] = fl.t.z;
    this.bodyGeo.attributes.position.needsUpdate = true;
    this.bodyGeo.attributes.normal.needsUpdate = true;
  }

  private setBasis(mesh: THREE.Object3D, pos: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3, sx: number, sy: number, sz: number) {
    _m.makeBasis(x, y, z);
    _m.scale(_v4.set(sx, sy, sz));
    _m.setPosition(pos);
    mesh.matrix.copy(_m);
  }

  private placeHead() {
    const P = this.pose;
    const dumbo = this.appearance.ears === 'dumbo';
    const fe = this.frameAt(0.765, newFrameTmp[0]);
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      const ear = this.ears[s];
      const pos = _v1.copy(fe.c);
      const nrm = _v2;
      const up = _v3;
      if (dumbo) {
        pos.addScaledVector(fe.n, fe.h * 0.42).addScaledVector(fe.b, fe.w * 0.86 * side);
        nrm.copy(fe.t).multiplyScalar(0.45 + 0.15 * P.earPerk).addScaledVector(fe.b, 0.9 * side).normalize();
        up.copy(fe.n).multiplyScalar(0.8).addScaledVector(fe.b, 0.4 * side).addScaledVector(fe.t, -0.15 - 0.1 * P.earPerk);
      } else {
        pos.addScaledVector(fe.n, fe.h * 0.76).addScaledVector(fe.b, fe.w * 0.5 * side).addScaledVector(fe.t, -0.002);
        nrm.copy(fe.t).multiplyScalar(0.75 + 0.25 * P.earPerk).addScaledVector(fe.b, 0.62 * side).addScaledVector(fe.n, 0.08).normalize();
        up.copy(fe.n).addScaledVector(fe.t, -0.22 - 0.25 * P.earPerk).addScaledVector(fe.b, 0.28 * side);
      }
      // ушко подрагивает при обнюхивании
      up.addScaledVector(fe.t, Math.sin(this.time * 7 + s) * 0.04 * P.sniff);
      up.addScaledVector(nrm, -up.dot(nrm)).normalize();
      const x = _v4.crossVectors(up, nrm).normalize();
      const k = dumbo ? 1.38 : 1;
      _m.makeBasis(x, up, nrm);
      _m.scale(new THREE.Vector3(k, k, k));
      _m.setPosition(pos);
      ear.matrix.copy(_m);
    }

    // глаза
    const fy = this.frameAt(0.85, newFrameTmp[1]);
    const squint = Math.max(this.pose.squint, this.blink > 0 ? 1 : 0);
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      const pos = _v1.copy(fy.c).addScaledVector(fy.n, fy.h * 0.4).addScaledVector(fy.b, fy.w * 0.74 * side).addScaledVector(fy.t, 0.001);
      const fwd = _v2.copy(fy.b).multiplyScalar(side * 0.85).addScaledVector(fy.t, 0.45).addScaledVector(fy.n, 0.12).normalize();
      const up = _v3.copy(fy.n).addScaledVector(fwd, -fy.n.dot(fwd)).normalize();
      const x = new THREE.Vector3().crossVectors(up, fwd).normalize();
      const r = 0.0054;
      this.setBasis(this.eyes[s], pos, x, up, fwd, r, r * Math.max(0.12, 1 - squint * 0.9), r * 0.85);
      const hp = pos.clone().addScaledVector(fwd, r * 0.72).addScaledVector(up, r * 0.45).addScaledVector(fy.t, r * 0.25);
      const hr = 0.0012 * (squint > 0.6 ? 0 : 1);
      this.setBasis(this.highlights[s], hp, x, up, fwd, hr, hr, hr);
    }

    // нос
    const fn = this.frameAt(0.985, newFrameTmp[2]);
    const np = _v1.copy(fn.c).addScaledVector(fn.t, 0.002).addScaledVector(fn.n, 0.0005);
    const nx = _v2.crossVectors(fn.n, fn.t).normalize();
    const wig = 1 + Math.sin(this.time * 20) * 0.08 * this.pose.sniff;
    this.setBasis(this.nose, np, nx, fn.n, fn.t, 0.0042 * wig, 0.0032, 0.0034);

    // вибриссы
    const fw = this.frameAt(0.945, newFrameTmp[3]);
    const segs = this.whiskerSegs;
    const rex = segs > 2;
    let vi = 0;
    const wp = this.whiskerPos;
    const rate = 7 + 10 * this.pose.sniff;
    const amp = 0.08 + 0.22 * this.pose.sniff + this.whiskerBoost;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      for (let k = 0; k < 6; k++) {
        const base = _v1.copy(fw.c).addScaledVector(fw.b, fw.w * 0.82 * side).addScaledVector(fw.n, fw.h * (0.15 - k * 0.09));
        const tw = Math.sin(this.time * rate + k * 0.7 + s * 1.3) * amp;
        const dir = _v2
          .copy(fw.b)
          .multiplyScalar(side * 0.9)
          .addScaledVector(fw.t, 0.28 + k * 0.04 + tw)
          .addScaledVector(fw.n, 0.22 - k * 0.1)
          .normalize();
        const len = (0.056 - k * 0.004) * (rex ? 0.8 : 1);
        const down = _v3.copy(fw.n).multiplyScalar(-1);
        let px = base.x;
        let py = base.y;
        let pz = base.z;
        for (let q = 1; q <= segs; q++) {
          const t = q / segs;
          const curl = rex ? Math.sin(t * Math.PI * 2 + k) * 0.006 : 0;
          const sag = t * t * 0.006;
          const nxp = base.x + dir.x * len * t + down.x * sag + fw.t.x * curl;
          const nyp = base.y + dir.y * len * t + down.y * sag + fw.t.y * curl;
          const nzp = base.z + dir.z * len * t + down.z * sag + fw.t.z * curl;
          wp[vi++] = px;
          wp[vi++] = py;
          wp[vi++] = pz;
          wp[vi++] = nxp;
          wp[vi++] = nyp;
          wp[vi++] = nzp;
          px = nxp;
          py = nyp;
          pz = nzp;
        }
      }
    }
    this.whiskers.geometry.attributes.position.needsUpdate = true;

    // предмет во рту
    if (this.mouthItem) {
      const fm = this.frameAt(0.97, newFrameTmp[4]);
      const mp = _v1.copy(fm.c).addScaledVector(fm.n, -fm.h * 1.4).addScaledVector(fm.t, 0.004);
      const x = _v2.copy(fm.b);
      const y = _v3.copy(fm.n);
      this.setBasis(this.mouthItem, mp, x, y, _v4.crossVectors(x, y), 1, 1, 1);
    }
  }

  private limbBetween(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    const dir = _v3.subVectors(b, a);
    const len = dir.length();
    dir.normalize();
    _q.setFromUnitVectors(UP, dir);
    // CapsuleGeometry(1, 1): полная высота 3 → масштаб по Y = (длина + радиус) / 3
    _m.compose(_v4.addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(radius, Math.max(0.0005, (len + radius) / 3), radius));
    mesh.matrix.copy(_m);
  }

  private placeLimbs() {
    const P = this.pose;
    const g = P.gait;
    const ph = this.gaitPhase * Math.PI * 2;
    const stride = 0.014 * g;
    const lift = 0.011 * g;
    const fh = this.frameAt(0.22, newFrameTmp[5]);
    const ff = this.frameAt(0.56, newFrameTmp[6]);
    const fmouth = this.frameAt(0.92, newFrameTmp[7]);
    const fchest = this.frameAt(0.6, newFrameTmp[8]);
    const heldPts: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const side = i % 2 === 0 ? 1 : -1;
      const F = front ? ff : fh;
      const attach = new THREE.Vector3()
        .copy(F.c)
        .addScaledVector(F.b, F.w * (front ? 0.55 : 0.68) * side)
        .addScaledVector(F.n, -F.h * (front ? 0.55 : 0.4));
      // фаза диагональной походки
      const off = (front ? 0 : 0.5) + (side > 0 ? 0 : 0.5);
      const phase = ph + off * Math.PI * 2;
      const gz = Math.sin(phase) * stride;
      const gy = Math.max(0, Math.cos(phase)) * lift;
      const ground = new THREE.Vector3(attach.x * (front ? 0.85 : 0.95), gy, attach.z + (front ? 0.012 : -0.006) + gz);
      if (P.lie > 0.3 || P.curl > 0.3) {
        // лёжа лапки подобраны под тело
        ground.lerp(new THREE.Vector3(attach.x * 0.7, 0.004, attach.z + (front ? 0.02 : 0.0)), Math.max(P.lie, P.curl));
      }
      let pawPos = ground;
      let fwd = new THREE.Vector3(0, 0, 1);
      let up = new THREE.Vector3(0, 1, 0);
      if (front) {
        // поднятые лапки: у груди / у рта с едой / умывание / «лапка»
        const tuck = new THREE.Vector3().copy(fchest.c).addScaledVector(fchest.n, -fchest.h * 1.05).addScaledVector(fchest.b, fchest.w * 0.42 * side).addScaledVector(fchest.t, 0.006);
        const hold = new THREE.Vector3().copy(fmouth.c).addScaledVector(fmouth.n, -fmouth.h * 1.7).addScaledVector(fmouth.b, 0.0045 * side).addScaledVector(fmouth.t, -0.006);
        const wPh = this.time * 9 + (side > 0 ? 0 : Math.PI * 0.6);
        const wash = new THREE.Vector3()
          .copy(fmouth.c)
          .addScaledVector(fmouth.b, fmouth.w * 1.25 * side)
          .addScaledVector(fmouth.t, -0.008 + Math.cos(wPh) * 0.009)
          .addScaledVector(fmouth.n, -0.002 + Math.sin(wPh) * 0.007);
        const lifted = tuck.clone().lerp(hold, P.hold).lerp(wash, P.wash);
        if (side < 0 && P.pawRaise > 0.01) {
          const ext = new THREE.Vector3().copy(fchest.c).addScaledVector(fchest.n, -fchest.h * 2.2).addScaledVector(fchest.t, 0.025).addScaledVector(fchest.b, -0.008);
          lifted.lerp(ext, P.pawRaise);
        }
        const k = Math.max(P.frontLift, side < 0 ? P.pawRaise : 0);
        pawPos = ground.clone().lerp(lifted, k);
        const lfwd = new THREE.Vector3().copy(fchest.t).multiplyScalar(0.7).addScaledVector(fchest.n, -0.5).normalize();
        const lup = new THREE.Vector3().copy(fchest.n).multiplyScalar(-1).addScaledVector(fchest.b, -0.4 * side).normalize();
        fwd = fwd.lerp(lfwd, k).normalize();
        up = up.lerp(lup, k).normalize();
        if (P.hold > 0.5 && P.frontLift > 0.5) heldPts.push(pawPos);
      } else if (side > 0 && P.scratch > 0.01) {
        const fs = this.frameAt(0.45, newFrameTmp[9]);
        const sc = new THREE.Vector3()
          .copy(fs.c)
          .addScaledVector(fs.b, fs.w * 1.05)
          .addScaledVector(fs.n, -fs.h * 0.1 + Math.sin(this.time * 32) * 0.006)
          .addScaledVector(fs.t, Math.cos(this.time * 32) * 0.005);
        pawPos = ground.clone().lerp(sc, P.scratch);
        const sfwd = new THREE.Vector3().copy(fs.n).normalize();
        fwd = fwd.lerp(sfwd, P.scratch).normalize();
        up = up.lerp(new THREE.Vector3().copy(fs.b).multiplyScalar(-1), P.scratch).normalize();
      }
      // базис лапы
      up.addScaledVector(fwd, -up.dot(fwd)).normalize();
      const x = new THREE.Vector3().crossVectors(up, fwd).normalize();
      _m.makeBasis(x, up, fwd);
      _m.setPosition(front ? pawPos : pawPos.clone().addScaledVector(fwd, -0.006));
      this.paws[i].matrix.copy(_m);
      // голень/предплечье
      const ankle = pawPos.clone().addScaledVector(up, front ? 0.004 : 0.005).addScaledVector(fwd, front ? 0.001 : -0.004);
      this.limbBetween(this.limbs[i], attach, ankle, front ? 0.0062 : 0.0095);
    }
    if (this.held) {
      if (heldPts.length === 2 && P.hold > 0.5) {
        this.held.visible = true;
        const mid = heldPts[0].clone().add(heldPts[1]).multiplyScalar(0.5).addScaledVector(fmouth.n, -0.001).addScaledVector(fmouth.t, 0.003);
        _m.makeBasis(fmouth.b, fmouth.t, fmouth.n.clone().multiplyScalar(-1));
        _m.setPosition(mid);
        this.held.matrix.copy(_m);
      } else {
        this.held.visible = false;
      }
    }
  }

  private updateTail(dt: number) {
    const sc = this.scaleValue;
    const segLen = 0.0205 * sc;
    const f0 = this.frameAt(0.0, newFrameTmp[10]);
    const baseLocal = _v1.copy(f0.c).addScaledVector(f0.t, 0.003);
    const base = this.group.localToWorld(baseLocal.clone());
    const backDir = this.group.localToWorld(f0.c.clone().addScaledVector(f0.t, -1)).sub(this.group.localToWorld(f0.c.clone())).normalize();
    const groupUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    const tp = this.tp;
    const pp = this.tpPrev;
    if (!this.tailInit || tp[0].distanceTo(base) > 0.25) {
      for (let i = 0; i < TAIL_N; i++) {
        tp[i].copy(base).addScaledVector(backDir, segLen * i);
        pp[i].copy(tp[i]);
      }
      this.tailInit = true;
    }
    const steps = dt > 0 ? 2 : 1;
    const h = Math.min(dt, 1 / 30) / steps;
    const curl = this.pose.tailCurl;
    const sway = Math.sin(this.time * 1.3) * 0.12 * (1 - curl) * (1 - this.pose.lie);
    for (let st = 0; st < steps; st++) {
      tp[0].copy(base);
      for (let i = 1; i < TAIL_N; i++) {
        const p = tp[i];
        const vx = (p.x - pp[i].x) * 0.86;
        const vy = (p.y - pp[i].y) * 0.86;
        const vz = (p.z - pp[i].z) * 0.86;
        pp[i].copy(p);
        p.x += vx;
        p.y += vy - 6 * h * h;
        p.z += vz;
      }
      for (let i = 1; i < TAIL_N; i++) {
        const prev = tp[i - 1];
        // желаемое направление: продолжение тела, слегка вниз, с закручиванием при сне
        const dir = _v2.copy(backDir);
        if (i > 1) dir.copy(_v3.subVectors(prev, tp[i - 2]).normalize()).lerp(backDir, 0.12 * (1 - curl));
        const ang = (curl * 0.42 + sway * 0.25) * (i < 3 ? 0.4 : 1);
        _q.setFromAxisAngle(groupUp, ang);
        dir.applyQuaternion(_q).normalize();
        const k = 0.34 * (1 - i / TAIL_N) * (1 - i / TAIL_N) + 0.02 + 0.3 * curl;
        const tgt = _v3.copy(prev).addScaledVector(dir, segLen);
        tp[i].lerp(tgt, k);
        // жёсткая длина
        const d = _v4.subVectors(tp[i], prev);
        const l = d.length() || 1;
        tp[i].copy(prev).addScaledVector(d, segLen / l);
        if (this.tailFloorY !== null) {
          const r = 0.004 * sc * (1 - i / TAIL_N) + 0.0012;
          if (tp[i].y < this.tailFloorY + r) tp[i].y = this.tailFloorY + r;
        }
      }
    }
    // сглаженная трубка
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < TAIL_SMOOTH; i++) {
      const u = (i / (TAIL_SMOOTH - 1)) * (TAIL_N - 1);
      const k = Math.min(TAIL_N - 2, Math.floor(u));
      const t = u - k;
      const p0 = tp[Math.max(0, k - 1)];
      const p1 = tp[k];
      const p2 = tp[k + 1];
      const p3 = tp[Math.min(TAIL_N - 1, k + 2)];
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push(
        new THREE.Vector3(
          0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
          0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
        ),
      );
    }
    let n = new THREE.Vector3().copy(groupUp);
    let prevT = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
    for (let i = 0; i < TAIL_SMOOTH; i++) {
      const t = new THREE.Vector3().subVectors(pts[Math.min(TAIL_SMOOTH - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      _q.setFromUnitVectors(prevT, t);
      n.applyQuaternion(_q);
      n.addScaledVector(t, -n.dot(t));
      if (n.lengthSq() < 1e-8) n = new THREE.Vector3(1, 0, 0);
      n.normalize();
      prevT = t;
      const b = new THREE.Vector3().crossVectors(t, n);
      const s = i / (TAIL_SMOOTH - 1);
      const r = (0.0068 * (1 - s) + 0.0012 * s) * sc;
      for (let j = 0; j <= TAIL_RADIAL; j++) {
        const a = (j / TAIL_RADIAL) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const q = (i * (TAIL_RADIAL + 1) + j) * 3;
        const nx = n.x * ca + b.x * sa;
        const ny = n.y * ca + b.y * sa;
        const nz = n.z * ca + b.z * sa;
        this.tailPos[q] = pts[i].x + nx * r;
        this.tailPos[q + 1] = pts[i].y + ny * r;
        this.tailPos[q + 2] = pts[i].z + nz * r;
        this.tailNrm[q] = nx;
        this.tailNrm[q + 1] = ny;
        this.tailNrm[q + 2] = nz;
      }
    }
    this.tailGeo.attributes.position.needsUpdate = true;
    this.tailGeo.attributes.normal.needsUpdate = true;
  }

  setVisible(v: boolean) {
    this.group.visible = v;
    this.tail.visible = v;
  }

  dispose() {
    this.bodyGeo.dispose();
    this.tailGeo.dispose();
    this.whiskers.geometry.dispose();
    this.furTex.dispose();
    this.bodyMat.dispose();
    for (const m of this.shellMats) m.dispose();
    for (const m of [this.limbMatF, this.limbMatH, this.skinMat, this.pawMat, this.earMat, this.eyeMat, this.noseMat, this.tailMat]) m.dispose();
    this.whiskerMat.dispose();
    this.setHeld(null);
    this.setMouthItem(false);
    this.tail.removeFromParent();
    this.group.removeFromParent();
  }
}

const newFrameTmp: Frame[] = Array.from({ length: 12 }, () => newFrame());
