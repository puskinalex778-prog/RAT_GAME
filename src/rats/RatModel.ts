import * as THREE from 'three';
import type { RatAppearance, RatBehaviorState, TrickId } from '../types/game';
import { BASE_COLORS, EYE_LABELS } from './coatPresets';
import { getFurTextures } from './furTexture';

export interface RatPoseInput {
  time: number;
  dt: number;
  speed: number; // world units/s
  turnRate: number; // rad/s
  behavior: RatBehaviorState;
  behaviorTime: number;
  activeTrick?: TrickId | null;
  trickPhase?: number;
  isClimbing?: boolean;
  climbPitch?: number;
  heldItem?: 'none' | 'treat' | 'paper' | 'ball';
  pettingIntensity?: number; // 0..1
  ageScale?: number; // 0.65 (pup) .. 1.05 (adult/senior)
  worldPosition: THREE.Vector3;
  worldYaw: number;
}

/**
 * Creates a sculpted organic sphere-based geometry with clean anatomical UVs:
 * u = 0.5 on dorsal back (+Y), u = 0/1 on belly (-Y)
 * v = 1 at front (+Z), v = 0 at rear (-Z)
 */
function createOrganicSegmentGeometry(
  rx: number,
  ry: number,
  rz: number,
  options: {
    taperFront?: number; // scale x/y at +Z
    taperRear?: number; // scale x/y at -Z
    bellyFlatten?: number; // 0..0.4
    archBack?: number; // lifts +Y slightly
    segW?: number;
    segH?: number;
  } = {}
): THREE.BufferGeometry {
  const segW = options.segW ?? 22;
  const segH = options.segH ?? 16;
  const geo = new THREE.SphereGeometry(1, segW, segH);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const taperFront = options.taperFront ?? 1;
  const taperRear = options.taperRear ?? 1;
  const bellyFlatten = options.bellyFlatten ?? 0.14;
  const archBack = options.archBack ?? 0.06;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Remap poles along Z instead of Y for clean longitudinal rat body UVs
    // Original sphere: y in [-1, 1] -> map to z; original z -> map to y
    const nz = y; // [-1, 1] rear to front
    const ny = z;
    const nx = x;

    const t = (nz + 1) * 0.5; // 0 rear .. 1 front
    const radialTaper = taperRear * (1 - t) + taperFront * t;

    x = nx * rx * radialTaper;
    y = ny * ry * radialTaper;
    z = nz * rz;

    if (y < 0) {
      y *= 1 - bellyFlatten * (1 - Math.abs(nz) * 0.4);
    } else {
      y += archBack * ry * (1 - nz * nz);
    }

    pos.setXYZ(i, x, y, z);

    // Clean anatomical UV (no seam on back; seam sits hidden on bottom centerline)
    const u = 0.5 + Math.atan2(nx, ny) / (2 * Math.PI);
    const v = t;
    uv.setXY(i, u, v);
  }

  geo.computeVertexNormals();
  return geo;
}

/** Creates a realistic rounded cupped rat ear geometry */
function createRatEarGeometry(isDumbo: boolean): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const pos = geo.attributes.position;
  const wScale = isDumbo ? 0.095 : 0.072;
  const hScale = isDumbo ? 0.088 : 0.082;
  const dScale = isDumbo ? 0.032 : 0.026;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Cup faces forward (+Z), rounded silhouette
    pos.setXYZ(i, x * wScale, (y - 0.35) * hScale, z * dScale);
  }
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/** Adds soft velvet/fur Fresnel sheen to MeshStandardMaterial without plastic shine */
function applyVelvetFurShader(mat: THREE.MeshStandardMaterial, fuzzStrength = 0.24) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFuzzStrength = { value: fuzzStrength };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\nuniform float uFuzzStrength;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      vec3 viewDirFur = normalize(vViewPosition);
      float rimFur = pow(1.0 - max(dot(normalize(vNormal), viewDirFur), 0.0), 2.6);
      gl_FragColor.rgb += vec3(0.98, 0.94, 0.89) * rimFur * uFuzzStrength;
      #include <dithering_fragment>
      `
    );
  };
}

export class RatModel {
  public readonly root = new THREE.Group();
  public readonly ratId: string;

  private appearance: RatAppearance;

  // Hierarchical spine & body
  private bodyPivot = new THREE.Group();
  private pelvis = new THREE.Group();
  private midSpine = new THREE.Group();
  private chest = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();

  // Head details
  private noseTip!: THREE.Mesh;
  private earL = new THREE.Group();
  private earR = new THREE.Group();
  private eyeL!: THREE.Group;
  private eyeR!: THREE.Group;
  private eyelidL!: THREE.Mesh;
  private eyelidR!: THREE.Mesh;
  private whiskersL = new THREE.Group();
  private whiskersR = new THREE.Group();

  // Limbs
  private legFL = new THREE.Group();
  private legFR = new THREE.Group();
  private legBL = new THREE.Group();
  private legBR = new THREE.Group();

  // Held items on paws / mouth
  private heldTreatMesh!: THREE.Mesh;
  private heldPaperMesh!: THREE.Mesh;
  private heldBallMesh!: THREE.Mesh;

  // 9-segment procedural spring tail
  private tailSegments: THREE.Group[] = [];
  private tailYawHistory: number[] = [];
  private tailPitchOffsets: number[] = [];
  private readonly tailCount = 9;

  // Materials for disposal / dynamic update
  private bodyMat!: THREE.MeshStandardMaterial;
  private headMat!: THREE.MeshStandardMaterial;
  private shellMat!: THREE.MeshStandardMaterial;
  private pawMat!: THREE.MeshStandardMaterial;
  private tailMat!: THREE.MeshStandardMaterial;
  private earOuterMat!: THREE.MeshStandardMaterial;
  private earInnerMat!: THREE.MeshStandardMaterial;
  private eyeBallMat!: THREE.MeshStandardMaterial;

  // Animation smoothing state
  private smoothPitch = 0;
  private smoothRear = 0;
  private smoothCurl = 0;
  private smoothSquint = 0;
  private blinkTimer = 2.5 + Math.random() * 4;
  private walkPhase = Math.random() * Math.PI * 2;
  private lastWorldPos = new THREE.Vector3();
  private hasInitPos = false;

  // Hitbox for easy mobile tapping
  public readonly hitMesh: THREE.Mesh;

  constructor(ratId: string, appearance: RatAppearance) {
    this.ratId = ratId;
    this.appearance = { ...appearance };
    this.root.name = `rat_${ratId}`;
    this.root.userData = { ratId };

    // Invisible slightly forgiving tap sphere for mobile touch selection
    const hitGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitMesh = new THREE.Mesh(hitGeo, hitMat);
    this.hitMesh.position.set(0, 0.14, 0.02);
    this.hitMesh.userData = { ratId };
    this.root.add(this.hitMesh);

    this.root.add(this.bodyPivot);

    this.buildMaterials();
    this.buildSkeleton();
    this.updateAppearance(appearance);
  }

  private buildMaterials() {
    this.bodyMat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0.0,
      bumpScale: 0.012,
    });
    applyVelvetFurShader(this.bodyMat, 0.22);

    this.headMat = new THREE.MeshStandardMaterial({
      roughness: 0.88,
      metalness: 0.0,
      bumpScale: 0.01,
    });
    applyVelvetFurShader(this.headMat, 0.2);

    // Delicate 2nd shell-fur layer for fluffy silhouette & wavy rex coat
    this.shellMat = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.22,
      roughness: 0.96,
      metalness: 0.0,
      depthWrite: false,
      bumpScale: 0.022,
    });

    this.pawMat = new THREE.MeshStandardMaterial({
      color: '#EEC1BC',
      roughness: 0.68,
      metalness: 0.0,
    });

    this.tailMat = new THREE.MeshStandardMaterial({
      color: '#E3B2AC',
      roughness: 0.62,
      metalness: 0.0,
    });

    this.earOuterMat = new THREE.MeshStandardMaterial({
      color: '#D5B0AC',
      roughness: 0.78,
      metalness: 0.0,
    });

    this.earInnerMat = new THREE.MeshStandardMaterial({
      color: '#F3BABA',
      roughness: 0.66,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    this.eyeBallMat = new THREE.MeshStandardMaterial({
      color: '#141111',
      roughness: 0.12,
      metalness: 0.05,
    });
  }

  private buildSkeleton() {
    // 1. Pelvis / haunches (pear-shaped plump back half of domestic rat)
    this.pelvis.position.set(0, 0.125, -0.09);
    this.bodyPivot.add(this.pelvis);

    const rumpGeo = createOrganicSegmentGeometry(0.118, 0.105, 0.145, {
      taperFront: 0.96,
      taperRear: 0.74,
      bellyFlatten: 0.18,
      archBack: 0.12,
    });
    const rumpMesh = new THREE.Mesh(rumpGeo, this.bodyMat);
    rumpMesh.castShadow = true;
    rumpMesh.receiveShadow = true;
    rumpMesh.userData = { ratId: this.ratId };
    this.pelvis.add(rumpMesh);

    const rumpShell = new THREE.Mesh(rumpGeo, this.shellMat);
    rumpShell.scale.setScalar(1.045);
    this.pelvis.add(rumpShell);

    // 2. Mid-spine
    this.midSpine.position.set(0, 0.01, 0.095);
    this.pelvis.add(this.midSpine);

    const midGeo = createOrganicSegmentGeometry(0.105, 0.096, 0.12, {
      taperFront: 0.88,
      taperRear: 1.04,
      bellyFlatten: 0.16,
      archBack: 0.1,
    });
    const midMesh = new THREE.Mesh(midGeo, this.bodyMat);
    midMesh.castShadow = true;
    midMesh.receiveShadow = true;
    midMesh.userData = { ratId: this.ratId };
    this.midSpine.add(midMesh);

    const midShell = new THREE.Mesh(midGeo, this.shellMat);
    midShell.scale.setScalar(1.045);
    this.midSpine.add(midShell);

    // 3. Chest / shoulders
    this.chest.position.set(0, -0.005, 0.088);
    this.midSpine.add(this.chest);

    const chestGeo = createOrganicSegmentGeometry(0.086, 0.08, 0.095, {
      taperFront: 0.78,
      taperRear: 1.02,
      bellyFlatten: 0.12,
      archBack: 0.05,
    });
    const chestMesh = new THREE.Mesh(chestGeo, this.bodyMat);
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    chestMesh.userData = { ratId: this.ratId };
    this.chest.add(chestMesh);

    // 4. Neck & Head
    this.neck.position.set(0, 0.018, 0.072);
    this.chest.add(this.neck);

    this.head.position.set(0, 0.006, 0.036);
    this.neck.add(this.head);

    // Cranium (soft rounded cheeks)
    const craniumGeo = createOrganicSegmentGeometry(0.068, 0.058, 0.078, {
      taperFront: 0.72,
      taperRear: 0.94,
      bellyFlatten: 0.12,
      archBack: 0.06,
      segW: 18,
      segH: 14,
    });
    const craniumMesh = new THREE.Mesh(craniumGeo, this.headMat);
    craniumMesh.castShadow = true;
    craniumMesh.receiveShadow = true;
    craniumMesh.userData = { ratId: this.ratId };
    this.head.add(craniumMesh);

    const craniumShell = new THREE.Mesh(craniumGeo, this.shellMat);
    craniumShell.scale.setScalar(1.04);
    this.head.add(craniumShell);

    // Tapered delicate rat snout
    const snoutGeo = createOrganicSegmentGeometry(0.044, 0.037, 0.074, {
      taperFront: 0.42,
      taperRear: 1.02,
      bellyFlatten: 0.18,
      archBack: 0.04,
      segW: 16,
      segH: 12,
    });
    const snoutMesh = new THREE.Mesh(snoutGeo, this.headMat);
    snoutMesh.position.set(0, -0.01, 0.066);
    snoutMesh.rotation.x = 0.09;
    snoutMesh.castShadow = true;
    snoutMesh.userData = { ratId: this.ratId };
    this.head.add(snoutMesh);

    // Cute soft pink nose tip
    const noseGeo = new THREE.SphereGeometry(0.015, 12, 10);
    noseGeo.scale(1.15, 0.85, 0.85);
    const noseMat = new THREE.MeshStandardMaterial({
      color: '#F39CA6',
      roughness: 0.42,
      metalness: 0.0,
    });
    this.noseTip = new THREE.Mesh(noseGeo, noseMat);
    this.noseTip.position.set(0, -0.014, 0.136);
    this.head.add(this.noseTip);

    // Natural beady rat eyes (small, glossy with crisp catchlight, NO anime eyes)
    this.eyeL = this.createEye(-1);
    this.eyeR = this.createEye(1);
    this.head.add(this.eyeL, this.eyeR);

    // Ears container (geometry rebuilt on standard vs dumbo toggle)
    this.head.add(this.earL, this.earR);

    // Whiskers container (rebuilt on smooth vs rex toggle)
    this.whiskersL.position.set(-0.028, -0.015, 0.108);
    this.whiskersR.position.set(0.028, -0.015, 0.108);
    this.head.add(this.whiskersL, this.whiskersR);

    // 5. Four articulated legs with delicate pink paws & toes
    this.legFL = this.createLeg(true, -1);
    this.legFR = this.createLeg(true, 1);
    this.legBL = this.createLeg(false, -1);
    this.legBR = this.createLeg(false, 1);

    this.legFL.position.set(-0.056, -0.05, 0.02);
    this.legFR.position.set(0.056, -0.05, 0.02);
    this.chest.add(this.legFL, this.legFR);

    this.legBL.position.set(-0.072, -0.042, -0.035);
    this.legBR.position.set(0.072, -0.042, -0.035);
    this.pelvis.add(this.legBL, this.legBR);

    // 6. Held props (treat nugget, nesting paper strip, mini ball)
    const treatGeo = new THREE.DodecahedronGeometry(0.024, 1);
    const treatMat = new THREE.MeshStandardMaterial({ color: '#B57B43', roughness: 0.85 });
    this.heldTreatMesh = new THREE.Mesh(treatGeo, treatMat);
    this.heldTreatMesh.position.set(0, -0.052, 0.088);
    this.heldTreatMesh.visible = false;
    this.chest.add(this.heldTreatMesh);

    const paperGeo = new THREE.BoxGeometry(0.095, 0.008, 0.034);
    const paperMat = new THREE.MeshStandardMaterial({ color: '#FBF7EE', roughness: 0.92 });
    this.heldPaperMesh = new THREE.Mesh(paperGeo, paperMat);
    this.heldPaperMesh.position.set(0, -0.025, 0.14);
    this.heldPaperMesh.rotation.z = 0.12;
    this.heldPaperMesh.visible = false;
    this.head.add(this.heldPaperMesh);

    const ballGeo = new THREE.SphereGeometry(0.032, 12, 10);
    const ballMat = new THREE.MeshStandardMaterial({ color: '#D97B59', roughness: 0.72 });
    this.heldBallMesh = new THREE.Mesh(ballGeo, ballMat);
    this.heldBallMesh.position.set(0, -0.025, 0.145);
    this.heldBallMesh.visible = false;
    this.head.add(this.heldBallMesh);

    // 7. 9-segment tapered flexible tail
    let parent: THREE.Object3D = this.pelvis;
    const totalLen = 0.42;
    const segLen = totalLen / this.tailCount;

    for (let i = 0; i < this.tailCount; i++) {
      const segGroup = new THREE.Group();
      if (i === 0) {
        segGroup.position.set(0, -0.024, -0.12);
      } else {
        segGroup.position.set(0, 0, -segLen * 0.94);
      }

      const r0 = THREE.MathUtils.lerp(0.024, 0.0055, i / this.tailCount);
      const r1 = THREE.MathUtils.lerp(0.024, 0.004, (i + 1) / this.tailCount);
      const cylGeo = new THREE.CylinderGeometry(r1, r0, segLen * 1.08, 8, 1);
      cylGeo.rotateX(Math.PI * 0.5);
      cylGeo.translate(0, 0, -segLen * 0.5);

      const segMesh = new THREE.Mesh(cylGeo, this.tailMat);
      segMesh.castShadow = i < 5;
      segGroup.add(segMesh);

      parent.add(segGroup);
      this.tailSegments.push(segGroup);
      this.tailYawHistory.push(0);
      this.tailPitchOffsets.push(0);
      parent = segGroup;
    }
  }

  private createEye(side: -1 | 1): THREE.Group {
    const g = new THREE.Group();
    g.position.set(side * 0.044, 0.012, 0.048);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 12, 10), this.eyeBallMat);
    ball.scale.set(0.88, 1.0, 1.0);
    g.add(ball);

    // Subtle crisp catchlight glint (gives life without anime look)
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.0042, 6, 6),
      new THREE.MeshBasicMaterial({ color: '#FFFFFF' })
    );
    glint.position.set(side * 0.007, 0.006, 0.012);
    g.add(glint);

    // Soft eyelid cap for blinking & happy squinting
    const lidGeo = new THREE.SphereGeometry(0.0172, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const lid = new THREE.Mesh(lidGeo, this.headMat);
    lid.rotation.x = -Math.PI * 0.45;
    lid.scale.set(1, 0.05, 1);
    g.add(lid);

    if (side === -1) this.eyelidL = lid;
    else this.eyelidR = lid;

    return g;
  }

  private createLeg(isFront: boolean, side: -1 | 1): THREE.Group {
    const leg = new THREE.Group();

    // Furry upper thigh / shoulder
    const upperGeo = new THREE.SphereGeometry(isFront ? 0.032 : 0.046, 10, 8);
    upperGeo.scale(0.85, 1.25, 1.0);
    const upper = new THREE.Mesh(upperGeo, this.bodyMat);
    upper.position.set(0, -0.014, 0);
    upper.castShadow = true;
    leg.add(upper);

    // Delicate lower ankle + sculpted paw with 4 tiny toes
    const pawGroup = new THREE.Group();
    pawGroup.position.set(0, isFront ? -0.055 : -0.068, isFront ? 0.014 : 0.02);

    const palmGeo = new THREE.SphereGeometry(isFront ? 0.017 : 0.021, 10, 8);
    palmGeo.scale(0.95, 0.5, isFront ? 1.35 : 1.75);
    const palm = new THREE.Mesh(palmGeo, this.pawMat);
    pawGroup.add(palm);

    // 4 neat tiny fingers/toes
    const toeGeo = new THREE.CapsuleGeometry(0.0036, isFront ? 0.011 : 0.015, 4, 6);
    toeGeo.rotateX(Math.PI * 0.5);
    const spread = [-0.01, -0.0035, 0.0035, 0.01];
    for (let t = 0; t < 4; t++) {
      const toe = new THREE.Mesh(toeGeo, this.pawMat);
      toe.position.set(spread[t] * (isFront ? 1 : 1.15), -0.002, isFront ? 0.018 : 0.028);
      toe.rotation.y = (t - 1.5) * 0.14 * side;
      pawGroup.add(toe);
    }

    leg.add(pawGroup);
    return leg;
  }

  private rebuildEars() {
    const isDumbo = this.appearance.ears === 'dumbo';
    this.earL.clear();
    this.earR.clear();

    const outerGeo = createRatEarGeometry(isDumbo);
    const innerGeo = createRatEarGeometry(isDumbo);
    innerGeo.scale(0.82, 0.82, 0.72);

    const makeEar = (side: -1 | 1) => {
      const g = new THREE.Group();
      const outer = new THREE.Mesh(outerGeo, this.earOuterMat);
      outer.castShadow = true;
      const inner = new THREE.Mesh(innerGeo, this.earInnerMat);
      inner.position.set(0, 0, 0.005);
      g.add(outer, inner);
      g.scale.x = side;
      return g;
    };

    this.earL.add(makeEar(-1));
    this.earR.add(makeEar(1));

    if (isDumbo) {
      // Larger, rounder, set lower & wider on the sides of the head
      this.earL.position.set(-0.064, 0.022, -0.006);
      this.earR.position.set(0.064, 0.022, -0.006);
      this.earL.rotation.set(-0.08, -0.45, 0.52);
      this.earR.rotation.set(-0.08, 0.45, -0.52);
    } else {
      // Standard perched higher on top-sides of head
      this.earL.position.set(-0.044, 0.056, -0.006);
      this.earR.position.set(0.044, 0.056, -0.006);
      this.earL.rotation.set(-0.14, -0.35, 0.22);
      this.earR.rotation.set(-0.14, 0.35, -0.22);
    }
  }

  private rebuildWhiskers() {
    this.whiskersL.clear();
    this.whiskersR.clear();

    const isRex = this.appearance.coat === 'rex';
    const whiskerMat = new THREE.LineBasicMaterial({
      color: this.appearance.baseColor === 'black' ? '#B8B0A8' : '#E8E0D5',
      transparent: true,
      opacity: 0.72,
    });

    const buildSide = (side: -1 | 1, container: THREE.Group) => {
      const rows = [
        { y: 0.008, len: 0.105, spreadY: 0.02 },
        { y: 0.003, len: 0.125, spreadY: 0.005 },
        { y: -0.003, len: 0.118, spreadY: -0.01 },
        { y: -0.008, len: 0.095, spreadY: -0.022 },
        { y: 0.001, len: 0.11, spreadY: 0.014 },
        { y: -0.005, len: 0.1, spreadY: -0.016 },
      ];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const pts: THREE.Vector3[] = [];
        const steps = 6;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const curl = isRex ? Math.sin(t * Math.PI * 2.4 + i) * 0.012 : 0;
          const x = side * t * r.len;
          const y = r.y + r.spreadY * t - t * t * 0.015 + curl;
          const z = (i % 2 === 0 ? 0.012 : -0.012) * t - t * t * 0.032 + curl * 0.5;
          pts.push(new THREE.Vector3(x, y, z));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        container.add(new THREE.Line(geo, whiskerMat));
      }
    };

    buildSide(-1, this.whiskersL);
    buildSide(1, this.whiskersR);
  }

  public updateAppearance(appearance: RatAppearance) {
    this.appearance = { ...appearance };
    const textures = getFurTextures(appearance);
    const basePalette = BASE_COLORS[appearance.baseColor];
    const eyeInfo = EYE_LABELS[appearance.eyeColor];

    this.bodyMat.map = textures.bodyMap;
    this.bodyMat.bumpMap = textures.bumpMap;
    this.bodyMat.roughnessMap = textures.roughnessMap;
    this.bodyMat.bumpScale = appearance.coat === 'rex' ? 0.026 : 0.011;
    this.bodyMat.needsUpdate = true;

    this.headMat.map = textures.headMap;
    this.headMat.bumpMap = textures.bumpMap;
    this.headMat.roughnessMap = textures.roughnessMap;
    this.headMat.bumpScale = appearance.coat === 'rex' ? 0.022 : 0.009;
    this.headMat.needsUpdate = true;

    this.shellMat.map = textures.bodyMap;
    this.shellMat.bumpMap = textures.bumpMap;
    this.shellMat.opacity = appearance.coat === 'rex' ? 0.34 : 0.18;
    this.shellMat.needsUpdate = true;

    // Paws: white paws for berkshire, darker tinted for siamese/himalayan, pink otherwise
    if (appearance.marking === 'siamese') {
      this.pawMat.color.set('#7A5B4B');
      this.earOuterMat.color.set('#5C4133');
      this.earInnerMat.color.set('#B4867A');
      this.tailMat.color.set('#B88B7D');
    } else if (appearance.marking === 'himalayan') {
      this.pawMat.color.set('#AA8D82');
      this.earOuterMat.color.set('#84675B');
      this.earInnerMat.color.set('#D8AEA6');
      this.tailMat.color.set('#D4A69E');
    } else if (appearance.marking === 'berkshire') {
      this.pawMat.color.set('#F4DDD9');
      this.earOuterMat.color.set(basePalette.primary);
      this.earInnerMat.color.set(basePalette.earInner);
      this.tailMat.color.set('#DFAFA9');
    } else {
      this.pawMat.color.set(basePalette.pawTint);
      this.earOuterMat.color.set(
        appearance.marking === 'capped' || appearance.marking === 'hooded_stripe'
          ? BASE_COLORS[appearance.markingColor].primary
          : basePalette.primary
      );
      this.earInnerMat.color.set(basePalette.earInner);
      this.tailMat.color.set('#E2B2AC');
    }

    this.eyeBallMat.color.set(eyeInfo.hex);
    this.eyeBallMat.emissive.set(
      appearance.eyeColor === 'red' || appearance.eyeColor === 'ruby' ? '#360408' : '#000000'
    );
    this.eyeBallMat.emissiveIntensity = appearance.eyeColor === 'red' ? 0.32 : 0.14;

    this.rebuildEars();
    this.rebuildWhiskers();
  }

  public updatePose(input: RatPoseInput) {
    const { time, dt, speed, turnRate, behavior, behaviorTime } = input;
    const clampedDt = Math.min(dt, 0.05);

    const scale = input.ageScale ?? 1.0;
    this.root.scale.setScalar(scale);

    // Held props visibility
    const held = input.heldItem ?? 'none';
    this.heldTreatMesh.visible = held === 'treat' || behavior === 'eat';
    this.heldPaperMesh.visible = held === 'paper' || behavior === 'carry_paper';
    this.heldBallMesh.visible = held === 'ball';

    // Target pose parameters
    let targetRear = 0; // 0 = 4 legs, 1 = standing on hind legs
    let targetCurl = 0; // 0 = stretched, 1 = curled sleeping ball
    let targetSquint = 0; // 0 = eyes open, 1 = eyes softly closed
    let headPitch = 0;
    let headYaw = 0;
    let headRoll = 0;
    let bodyYOffset = 0;
    let spineYaw = THREE.MathUtils.clamp(-turnRate * 0.25, -0.35, 0.35);
    let spinePitch = input.climbPitch ?? 0;
    let whiskerSpeed = 9;
    let whiskerAmp = 0.08;

    // Reset limb targets
    let flX = 0, frX = 0, blX = 0, brX = 0;
    let flZ = 0, frZ = 0;

    // Breathing rhythm
    const breath = Math.sin(time * 4.2) * 0.022;
    this.midSpine.scale.set(1 + breath, 1 + breath * 0.7, 1);

    // Locomotion phase
    if (speed > 0.04) {
      this.walkPhase += clampedDt * (speed * 13.5 + 3.0);
    }

    switch (behavior) {
      case 'walk':
      case 'run':
      case 'come_to_player':
      case 'chase_toy':
      case 'tunnel':
      case 'carry_paper': {
        const stride = Math.min(1, speed / 0.55);
        const freq = behavior === 'run' || behavior === 'chase_toy' ? 1.25 : 1.0;
        const p = this.walkPhase * freq;
        flX = Math.sin(p) * 0.55 * stride;
        frX = Math.sin(p + Math.PI * 0.85) * 0.55 * stride;
        blX = Math.sin(p + Math.PI) * 0.62 * stride;
        brX = Math.sin(p + Math.PI * 1.85) * 0.62 * stride;
        bodyYOffset = Math.abs(Math.sin(p)) * 0.016 * stride;
        headPitch = behavior === 'tunnel' ? 0.14 : -0.05 + Math.sin(p * 2) * 0.04;
        whiskerSpeed = 14;
        whiskerAmp = 0.12;
        break;
      }

      case 'climb': {
        const p = time * 10;
        flX = Math.sin(p) * 0.7;
        frX = Math.sin(p + Math.PI) * 0.7;
        blX = Math.sin(p + Math.PI) * 0.65;
        brX = Math.sin(p) * 0.65;
        headPitch = -0.22;
        whiskerSpeed = 15;
        break;
      }

      case 'sniff': {
        headPitch = -0.18 + Math.sin(time * 8.5) * 0.12;
        headYaw = Math.sin(time * 3.1) * 0.38;
        headRoll = Math.sin(time * 4.2) * 0.08;
        whiskerSpeed = 24;
        whiskerAmp = 0.22;
        break;
      }

      case 'rear_up': {
        targetRear = 1.0;
        headPitch = 0.35 + Math.sin(time * 5.2) * 0.08;
        headYaw = Math.sin(time * 2.4) * 0.32;
        flX = -0.85 + Math.sin(time * 6) * 0.12;
        frX = -0.85 - Math.sin(time * 6) * 0.12;
        flZ = 0.22;
        frZ = -0.22;
        whiskerSpeed = 20;
        whiskerAmp = 0.18;
        break;
      }

      case 'groom_face': {
        targetRear = 0.72;
        const rub = Math.sin(time * 16);
        headPitch = 0.58 + rub * 0.14;
        flX = -1.35 + rub * 0.28;
        frX = -1.35 - rub * 0.28;
        flZ = 0.36;
        frZ = -0.36;
        targetSquint = 0.55;
        whiskerSpeed = 12;
        break;
      }

      case 'groom_body': {
        spineYaw = 0.68;
        headYaw = 0.52 + Math.sin(time * 12) * 0.12;
        headPitch = 0.28 + Math.sin(time * 15) * 0.09;
        targetSquint = 0.35;
        break;
      }

      case 'eat': {
        targetRear = 0.68;
        const nibble = Math.sin(time * 19);
        headPitch = 0.52 + nibble * 0.07;
        flX = -1.15 + nibble * 0.06;
        frX = -1.15 + nibble * 0.06;
        flZ = 0.32;
        frZ = -0.32;
        whiskerSpeed = 16;
        break;
      }

      case 'drink': {
        targetRear = 0.45;
        headPitch = -0.25 + Math.sin(time * 12) * 0.06;
        flX = -0.7;
        frX = -0.7;
        whiskerSpeed = 11;
        break;
      }

      case 'sleep_hammock':
      case 'sleep_house': {
        targetCurl = 1.0;
        targetSquint = 1.0;
        bodyYOffset = -0.025;
        headPitch = 0.36;
        whiskerSpeed = 2.5;
        whiskerAmp = 0.02;
        break;
      }

      case 'being_petted': {
        const p = input.pettingIntensity ?? 1;
        targetSquint = 0.85 * p;
        bodyYOffset = -0.022 * p;
        // Bruxing / happy gentle vibrate & head lean
        headPitch = -0.06 + Math.sin(time * 28) * 0.015 * p;
        headRoll = Math.sin(time * 3.5) * 0.14 * p;
        whiskerSpeed = 7;
        break;
      }

      case 'social_groom': {
        headPitch = 0.18 + Math.sin(time * 13) * 0.1;
        headYaw = Math.sin(time * 4.5) * 0.22;
        flX = -0.45 + Math.sin(time * 12) * 0.18;
        frX = -0.45 - Math.sin(time * 12) * 0.18;
        targetSquint = 0.3;
        break;
      }

      case 'play_wrestle': {
        const hop = Math.abs(Math.sin(time * 11));
        bodyYOffset = hop * 0.085;
        spineYaw = Math.sin(time * 9) * 0.36;
        headRoll = Math.sin(time * 10) * 0.25;
        flX = Math.sin(time * 14) * 0.65;
        frX = -Math.sin(time * 14) * 0.65;
        blX = -hop * 0.5;
        brX = -hop * 0.5;
        whiskerSpeed = 22;
        break;
      }

      case 'perform_trick': {
        const trick = input.activeTrick;
        const phase = input.trickPhase ?? (behaviorTime % 2) / 2;
        if (trick === 'spin') {
          this.bodyPivot.rotation.y = phase * Math.PI * 2;
          flX = Math.sin(time * 16) * 0.45;
          frX = -flX;
        } else if (trick === 'paw') {
          targetRear = 0.82;
          frX = -1.65 + Math.sin(time * 12) * 0.2;
          flX = -0.6;
          headPitch = 0.22;
        } else if (trick === 'stand') {
          targetRear = 1.05;
          flX = -0.9;
          frX = -0.9;
          headPitch = 0.4;
        } else if (trick === 'hoop') {
          const arc = Math.sin(phase * Math.PI);
          bodyYOffset = arc * 0.22;
          spinePitch = (0.5 - phase) * 0.65;
          flX = -0.7;
          frX = -0.7;
          blX = 0.7;
          brX = 0.7;
        } else if (trick === 'fetch') {
          flX = Math.sin(time * 14) * 0.5;
          frX = -flX;
          headPitch = -0.08;
        }
        break;
      }

      case 'idle':
      default: {
        headYaw = Math.sin(time * 0.9) * 0.16;
        headPitch = Math.sin(time * 1.4) * 0.05;
        whiskerSpeed = 10;
        whiskerAmp = 0.08;
        break;
      }
    }

    if (behavior !== 'perform_trick' || input.activeTrick !== 'spin') {
      this.bodyPivot.rotation.y = THREE.MathUtils.lerp(this.bodyPivot.rotation.y, 0, clampedDt * 8);
    }

    // Smooth organic interpolation (no robotic snaps!)
    const lerpSpeed = clampedDt * 7.5;
    this.smoothRear = THREE.MathUtils.lerp(this.smoothRear, targetRear, lerpSpeed);
    this.smoothCurl = THREE.MathUtils.lerp(this.smoothCurl, targetCurl, lerpSpeed * 0.7);
    this.smoothPitch = THREE.MathUtils.lerp(this.smoothPitch, spinePitch, lerpSpeed);

    // Natural random eye blinking
    this.blinkTimer -= clampedDt;
    let blinkVal = 0;
    if (this.blinkTimer <= 0) {
      if (this.blinkTimer > -0.14) {
        blinkVal = Math.sin(((0 - this.blinkTimer) / 0.14) * Math.PI);
      } else {
        this.blinkTimer = 2.6 + Math.random() * 4.5;
      }
    }
    const desiredSquint = Math.max(targetSquint, blinkVal);
    this.smoothSquint = THREE.MathUtils.lerp(this.smoothSquint, desiredSquint, clampedDt * 18);
    this.eyelidL.scale.y = Math.max(0.05, this.smoothSquint * 1.05);
    this.eyelidR.scale.y = Math.max(0.05, this.smoothSquint * 1.05);

    // Apply spine articulation
    this.bodyPivot.position.y = THREE.MathUtils.lerp(
      this.bodyPivot.position.y,
      bodyYOffset + this.smoothRear * 0.045,
      lerpSpeed
    );

    this.pelvis.rotation.x = -this.smoothRear * 0.62 + this.smoothPitch;
    this.midSpine.rotation.x = -this.smoothRear * 0.24 + this.smoothCurl * 0.18;
    this.chest.rotation.x = this.smoothRear * 0.14 + this.smoothCurl * 0.22;

    const curlYaw = this.smoothCurl * 0.62;
    this.midSpine.rotation.y = THREE.MathUtils.lerp(this.midSpine.rotation.y, spineYaw * 0.6 + curlYaw, lerpSpeed);
    this.chest.rotation.y = THREE.MathUtils.lerp(this.chest.rotation.y, spineYaw * 0.5 + curlYaw * 0.9, lerpSpeed);
    this.neck.rotation.y = THREE.MathUtils.lerp(this.neck.rotation.y, headYaw * 0.45 + curlYaw * 0.4, lerpSpeed);

    this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, headPitch, lerpSpeed * 1.2);
    this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, headYaw * 0.55, lerpSpeed * 1.2);
    this.head.rotation.z = THREE.MathUtils.lerp(this.head.rotation.z, headRoll, lerpSpeed);

    // Nose twitching + lively whiskers
    this.noseTip.position.y = -0.014 + Math.sin(time * whiskerSpeed * 1.1) * 0.0025;
    const wOsc = Math.sin(time * whiskerSpeed) * whiskerAmp;
    this.whiskersL.rotation.y = wOsc;
    this.whiskersR.rotation.y = -wOsc;
    this.whiskersL.rotation.z = Math.cos(time * whiskerSpeed * 0.7) * whiskerAmp * 0.4;
    this.whiskersR.rotation.z = -Math.cos(time * whiskerSpeed * 0.7) * whiskerAmp * 0.4;

    // Subtle expressive ear twitches
    const earTwitch = Math.sin(time * 2.1 + this.ratId.length) > 0.94 ? Math.sin(time * 26) * 0.14 : 0;
    const baseEarZ = this.appearance.ears === 'dumbo' ? 0.52 : 0.22;
    this.earL.rotation.z = baseEarZ + earTwitch;
    this.earR.rotation.z = -baseEarZ - earTwitch * 0.7;

    // Apply limbs smoothly
    this.legFL.rotation.x = THREE.MathUtils.lerp(this.legFL.rotation.x, flX, lerpSpeed * 1.4);
    this.legFR.rotation.x = THREE.MathUtils.lerp(this.legFR.rotation.x, frX, lerpSpeed * 1.4);
    this.legFL.rotation.z = THREE.MathUtils.lerp(this.legFL.rotation.z, flZ, lerpSpeed * 1.4);
    this.legFR.rotation.z = THREE.MathUtils.lerp(this.legFR.rotation.z, frZ, lerpSpeed * 1.4);
    this.legBL.rotation.x = THREE.MathUtils.lerp(this.legBL.rotation.x, blX + this.smoothRear * 0.45, lerpSpeed * 1.4);
    this.legBR.rotation.x = THREE.MathUtils.lerp(this.legBR.rotation.x, brX + this.smoothRear * 0.45, lerpSpeed * 1.4);

    // 9-segment procedural spring / inertia tail
    if (!this.hasInitPos) {
      this.lastWorldPos.copy(input.worldPosition);
      this.hasInitPos = true;
    }
    const deltaDist = input.worldPosition.distanceTo(this.lastWorldPos);
    this.lastWorldPos.copy(input.worldPosition);

    const swayDrive = THREE.MathUtils.clamp(-turnRate * 0.26, -0.35, 0.35) + Math.sin(time * 4.2) * (0.04 + Math.min(deltaDist * 1.8, 0.08));

    for (let i = 0; i < this.tailCount; i++) {
      let targetYaw = i === 0 ? swayDrive : this.tailYawHistory[i - 1] * 0.92;
      let targetPitch = i === 0 ? -0.18 : 0.035;

      if (behavior === 'sleep_hammock') {
        // Tail hangs gently over hammock edge!
        targetYaw = Math.sin(time * 1.1 + i * 0.3) * 0.06;
        targetPitch = i < 3 ? -0.22 : -0.12;
      } else if (behavior === 'sleep_house') {
        // Curled cozily around body
        targetYaw = 0.34;
        targetPitch = i === 0 ? -0.14 : 0.01;
      } else if (this.smoothRear > 0.3) {
        // Tail braces lightly on floor for balance when standing up
        targetPitch = i === 0 ? 0.45 * this.smoothRear : 0.06;
      }

      const stiffness = clampedDt * (7.5 - i * 0.38);
      this.tailYawHistory[i] = THREE.MathUtils.lerp(this.tailYawHistory[i], targetYaw, Math.max(0.05, stiffness));
      this.tailPitchOffsets[i] = THREE.MathUtils.lerp(this.tailPitchOffsets[i], targetPitch, Math.max(0.05, stiffness));

      this.tailSegments[i].rotation.y = this.tailYawHistory[i];
      this.tailSegments[i].rotation.x = this.tailPitchOffsets[i];
    }
  }

  public dispose() {
    this.bodyMat.dispose();
    this.headMat.dispose();
    this.shellMat.dispose();
    this.pawMat.dispose();
    this.tailMat.dispose();
    this.earOuterMat.dispose();
    this.earInnerMat.dispose();
    this.eyeBallMat.dispose();
  }
}
