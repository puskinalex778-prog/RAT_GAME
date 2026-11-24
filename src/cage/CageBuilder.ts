import * as THREE from 'three';
import type { HabitatId, PlacedItem, RoomThemeId } from '../types/game';
import { CAGE_SLOTS, ITEM_MAP, ROOM_THEMES, type CageSlotDef } from './catalog';

export interface CageBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
  secondFloorY: number;
  secondFloorMinX: number;
  secondFloorMaxX: number;
  secondFloorMinZ: number;
  secondFloorMaxZ: number;
  rampBottom: THREE.Vector3;
  rampTop: THREE.Vector3;
}

export interface InteractiveFurnitureAnchor {
  slotId: string;
  itemId: string;
  category: string;
  position: THREE.Vector3;
  rotationY: number;
  level: 0 | 1;
}

function createProceduralWoodTexture(baseHex: string, grainHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = grainHex;
  ctx.globalAlpha = 0.24;
  for (let i = 0; i < 48; i++) {
    const y = (i / 48) * 256;
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(85, y + Math.sin(i) * 5, 170, y - Math.cos(i) * 5, 256, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBeddingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#E8DAC2';
  ctx.fillRect(0, 0, 512, 512);

  const colors = ['#F4ECDD', '#DECBA8', '#D3BC97', '#EFE4CF', '#C9B18A'];
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI);
    ctx.beginPath();
    ctx.roundRect(-7, -3.5, 14, 7, 3);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

export class CageBuilder {
  public readonly roomGroup = new THREE.Group();
  public readonly cageGroup = new THREE.Group();
  public readonly furnitureGroup = new THREE.Group();
  public readonly slotMarkersGroup = new THREE.Group();

  public dedicationPlaqueMesh!: THREE.Mesh;
  public wheelSpinMesh: THREE.Object3D | null = null;
  public furnitureAnchors: InteractiveFurnitureAnchor[] = [];
  public slotMarkerMeshes: THREE.Mesh[] = [];

  private wallMat!: THREE.MeshStandardMaterial;
  private floorMat!: THREE.MeshStandardMaterial;
  private baseboardMat!: THREE.MeshStandardMaterial;
  private accentMat!: THREE.MeshStandardMaterial;

  private woodTex: THREE.CanvasTexture;
  private darkWoodTex: THREE.CanvasTexture;
  private beddingTex: THREE.CanvasTexture;

  public bounds: CageBounds = {
    minX: -1.04,
    maxX: 1.04,
    minZ: -0.58,
    maxZ: 0.56,
    floorY: 0.08,
    secondFloorY: 0.78,
    secondFloorMinX: -1.02,
    secondFloorMaxX: 0.32,
    secondFloorMinZ: -0.56,
    secondFloorMaxZ: 0.44,
    rampBottom: new THREE.Vector3(0.76, 0.08, 0.05),
    rampTop: new THREE.Vector3(0.28, 0.78, 0.05),
  };

  constructor() {
    this.woodTex = createProceduralWoodTexture('#D8B589', '#9E7447');
    this.darkWoodTex = createProceduralWoodTexture('#B68A5B', '#7B5432');
    this.beddingTex = createBeddingTexture();

    this.buildCozyRoom();
    this.slotMarkersGroup.visible = false;
  }

  private buildCozyRoom() {
    const theme = ROOM_THEMES.scandi;

    this.wallMat = new THREE.MeshStandardMaterial({ color: theme.wallColor, roughness: 0.92 });
    this.floorMat = new THREE.MeshStandardMaterial({
      color: theme.floorColor,
      map: this.woodTex,
      roughness: 0.76,
    });
    this.baseboardMat = new THREE.MeshStandardMaterial({ color: theme.baseboardColor, roughness: 0.75 });
    this.accentMat = new THREE.MeshStandardMaterial({ color: theme.accentColor, roughness: 0.8 });

    // Wooden desk / cozy table the cage sits on
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.14, 2.2),
      new THREE.MeshStandardMaterial({ map: this.woodTex, color: '#DFBE95', roughness: 0.65 })
    );
    tableTop.position.set(0, -0.07, 0);
    tableTop.receiveShadow = true;
    this.roomGroup.add(tableTop);

    // Table legs
    const legGeo = new THREE.CylinderGeometry(0.055, 0.042, 1.4, 10);
    const legMat = new THREE.MeshStandardMaterial({ map: this.darkWoodTex, roughness: 0.72 });
    for (const [lx, lz] of [
      [-1.65, -0.88],
      [1.65, -0.88],
      [-1.65, 0.88],
      [1.65, 0.88],
    ]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, -0.8, lz);
      this.roomGroup.add(leg);
    }

    // Room floor far below table
    const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), this.floorMat);
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(0, -1.5, 0);
    roomFloor.receiveShadow = true;
    this.roomGroup.add(roomFloor);

    // Cozy back wall & side walls
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), this.wallMat);
    backWall.position.set(0, 3.0, -2.15);
    backWall.receiveShadow = true;
    this.roomGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), this.wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-5.2, 3.0, 1.5);
    this.roomGroup.add(leftWall);

    // Baseboard trim
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(18, 0.22, 0.06), this.baseboardMat);
    baseboard.position.set(0, -1.39, -2.12);
    this.roomGroup.add(baseboard);

    // Cozy wall shelf to the right with books & little potted plant
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.07, 0.34),
      new THREE.MeshStandardMaterial({ map: this.darkWoodTex, roughness: 0.7 })
    );
    shelf.position.set(2.35, 1.9, -1.96);
    shelf.castShadow = true;
    this.roomGroup.add(shelf);

    // Little terracotta pot & green leaves on the wall shelf
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.095, 0.2, 12),
      new THREE.MeshStandardMaterial({ color: '#C67B5A', roughness: 0.82 })
    );
    pot.position.set(2.0, 2.04, -1.95);
    this.roomGroup.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: '#587E52', roughness: 0.78 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), leafMat);
      leaf.scale.set(1.2, 0.45, 0.7);
      leaf.position.set(2.0 + Math.cos(a) * 0.11, 2.18 + (i % 2) * 0.05, -1.95 + Math.sin(a) * 0.11);
      leaf.rotation.set(0.3, a, 0.25);
      this.roomGroup.add(leaf);
    }

    // Warm standing floor lamp glow accent on the right
    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 0.42, 16, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#F7E7CA',
        emissive: '#FFCC80',
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.85,
      })
    );
    lampShade.position.set(3.25, 1.6, -1.55);
    this.roomGroup.add(lampShade);

    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 3.0, 8), legMat);
    lampPole.position.set(3.25, 0.0, -1.55);
    this.roomGroup.add(lampPole);

    // Sunlit window on the left wall
    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 2.4, 1.8),
      new THREE.MeshStandardMaterial({ color: '#FAF6EE', roughness: 0.7 })
    );
    winFrame.position.set(-5.14, 1.7, -0.3);
    this.roomGroup.add(winFrame);

    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 2.2),
      new THREE.MeshBasicMaterial({ color: '#FFFDF2' })
    );
    winGlass.rotation.y = Math.PI / 2;
    winGlass.position.set(-5.08, 1.7, -0.3);
    this.roomGroup.add(winGlass);

    // === USER'S DEDICATION PLAQUE ("Посвящается : Тимме, Жоржу, Васе, Элвину") ===
    // Mounted prominently in a warm wooden gallery frame on the back wall right above/behind the cage!
    this.buildDedicationPlaque();
  }

  private buildDedicationPlaque() {
    const plaqueGroup = new THREE.Group();
    // Centered warmly above the cage so it's visible in overview & pet-level camera views!
    plaqueGroup.position.set(-0.15, 2.15, -2.06);

    const plaqueW = 1.62;
    const plaqueH = 1.28;

    // Warm oak backing shadow board
    const backBoard = new THREE.Mesh(
      new THREE.BoxGeometry(plaqueW + 0.09, plaqueH + 0.09, 0.055),
      new THREE.MeshStandardMaterial({
        map: this.darkWoodTex,
        color: '#C89E6E',
        roughness: 0.65,
      })
    );
    backBoard.castShadow = true;
    backBoard.receiveShadow = true;
    plaqueGroup.add(backBoard);

    // Front plaque face carrying the exact user-attached image
    const loader = new THREE.TextureLoader();
    const plaqueTex = loader.load('./assets/dedication_plaque.png');
    plaqueTex.colorSpace = THREE.SRGBColorSpace;
    plaqueTex.anisotropy = 4;

    const plaqueFaceMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      transparent: true,
      roughness: 0.58,
      metalness: 0.0,
    });
    const plaqueFace = new THREE.Mesh(new THREE.PlaneGeometry(plaqueW, plaqueH), plaqueFaceMat);
    plaqueFace.position.z = 0.032;
    plaqueFace.userData = { isDedicationPlaque: true };
    backBoard.userData = { isDedicationPlaque: true };
    plaqueGroup.add(plaqueFace);

    // Small brass hanging peg / cord accent above the plaque
    const peg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.04, 10),
      new THREE.MeshStandardMaterial({ color: '#D4A857', metalness: 0.6, roughness: 0.35 })
    );
    peg.rotation.x = Math.PI / 2;
    peg.position.set(0, plaqueH * 0.5 + 0.14, -0.01);
    plaqueGroup.add(peg);

    const cordMat = new THREE.LineBasicMaterial({ color: '#A68763' });
    const cordPts = [
      new THREE.Vector3(-0.34, plaqueH * 0.5 + 0.03, 0),
      new THREE.Vector3(0, plaqueH * 0.5 + 0.14, 0),
      new THREE.Vector3(0.34, plaqueH * 0.5 + 0.03, 0),
    ];
    plaqueGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cordPts), cordMat));

    this.dedicationPlaqueMesh = plaqueFace;
    this.roomGroup.add(plaqueGroup);
  }

  public applyTheme(themeId: RoomThemeId) {
    const t = ROOM_THEMES[themeId];
    this.wallMat.color.set(t.wallColor);
    this.floorMat.color.set(t.floorColor);
    this.baseboardMat.color.set(t.baseboardColor);
    this.accentMat.color.set(t.accentColor);
  }

  public rebuildCage(habitatId: HabitatId, hasSecondFloor: boolean) {
    this.cageGroup.clear();

    const isPanoramic = habitatId === 'panoramic_cage';
    const isPlaypen = habitatId === 'playpen';

    const width = isPanoramic ? 2.6 : isPlaypen ? 2.75 : 2.3;
    const depth = isPanoramic ? 1.42 : isPlaypen ? 1.56 : 1.28;
    const height = isPlaypen ? 0.62 : hasSecondFloor ? 1.58 : 1.02;

    this.bounds.minX = -width * 0.5 + 0.14;
    this.bounds.maxX = width * 0.5 - 0.14;
    this.bounds.minZ = -depth * 0.5 + 0.14;
    this.bounds.maxZ = depth * 0.5 - 0.14;

    // 1. Cozy plastic base tray (or fleece playpen mat)
    if (isPlaypen) {
      // Soft cream fleece mat
      const fleece = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.08, depth),
        new THREE.MeshStandardMaterial({ color: '#F2E8D5', roughness: 0.95 })
      );
      fleece.position.y = 0.04;
      fleece.receiveShadow = true;
      this.cageGroup.add(fleece);

      // Sage-green low modular panels around the playpen (front opening low threshold)
      const panelMat = new THREE.MeshStandardMaterial({ color: '#6E8572', roughness: 0.62 });
      const backP = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.05), panelMat);
      backP.position.set(0, height * 0.5, -depth * 0.5);
      backP.castShadow = true;
      this.cageGroup.add(backP);

      const leftP = new THREE.Mesh(new THREE.BoxGeometry(0.05, height, depth), panelMat);
      leftP.position.set(-width * 0.5, height * 0.5, 0);
      leftP.castShadow = true;
      this.cageGroup.add(leftP);

      const rightP = new THREE.Mesh(new THREE.BoxGeometry(0.05, height, depth), panelMat);
      rightP.position.set(width * 0.5, height * 0.5, 0);
      rightP.castShadow = true;
      this.cageGroup.add(rightP);

      // Front split panels with welcoming low doorway
      const frontSideW = width * 0.32;
      const flP = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, height, 0.05), panelMat);
      flP.position.set(-width * 0.5 + frontSideW * 0.5, height * 0.5, depth * 0.5);
      const frP = new THREE.Mesh(new THREE.BoxGeometry(frontSideW, height, 0.05), panelMat);
      frP.position.set(width * 0.5 - frontSideW * 0.5, height * 0.5, depth * 0.5);
      const threshold = new THREE.Mesh(new THREE.BoxGeometry(width * 0.36, 0.14, 0.05), panelMat);
      threshold.position.set(0, 0.07, depth * 0.5);
      this.cageGroup.add(flP, frP, threshold);
    } else {
      // Deep warm cream base tray + soft bedding layer
      const trayMat = new THREE.MeshStandardMaterial({ color: '#DDD2BF', roughness: 0.65 });
      const trayH = 0.2;
      const wallT = 0.05;

      const trayFloor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), trayMat);
      trayFloor.position.y = 0.025;
      trayFloor.receiveShadow = true;
      this.cageGroup.add(trayFloor);

      // 4 tray walls
      const tb = new THREE.Mesh(new THREE.BoxGeometry(width, trayH, wallT), trayMat);
      tb.position.set(0, trayH * 0.5, -depth * 0.5);
      const tf = new THREE.Mesh(new THREE.BoxGeometry(width, trayH * 0.72, wallT), trayMat);
      tf.position.set(0, trayH * 0.36, depth * 0.5);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(wallT, trayH, depth), trayMat);
      tl.position.set(-width * 0.5, trayH * 0.5, 0);
      const tr = new THREE.Mesh(new THREE.BoxGeometry(wallT, trayH, depth), trayMat);
      tr.position.set(width * 0.5, trayH * 0.5, 0);
      this.cageGroup.add(tb, tf, tl, tr);

      // Soft textured bedding inside tray
      const bedding = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.1, 0.06, depth - 0.1),
        new THREE.MeshStandardMaterial({ map: this.beddingTex, roughness: 0.96 })
      );
      bedding.position.y = 0.055;
      bedding.receiveShadow = true;
      this.cageGroup.add(bedding);

      // Outer sage-green metal cage frame posts
      const frameMat = new THREE.MeshStandardMaterial({
        color: isPanoramic ? '#556958' : '#657968',
        roughness: 0.42,
        metalness: 0.38,
      });

      const postGeo = new THREE.CylinderGeometry(0.018, 0.018, height - 0.14, 8);
      for (const [px, pz] of [
        [-width * 0.5, -depth * 0.5],
        [width * 0.5, -depth * 0.5],
        [-width * 0.5, depth * 0.5],
        [width * 0.5, depth * 0.5],
      ]) {
        const post = new THREE.Mesh(postGeo, frameMat);
        post.position.set(px, 0.14 + (height - 0.14) * 0.5, pz);
        this.cageGroup.add(post);
      }

      // Top perimeter frame
      const topFront = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.036, 0.036), frameMat);
      topFront.position.set(0, height, depth * 0.5);
      const topBack = topFront.clone();
      topBack.position.z = -depth * 0.5;
      const topLeft = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, depth + 0.04), frameMat);
      topLeft.position.set(-width * 0.5, height, 0);
      const topRight = topLeft.clone();
      topRight.position.x = width * 0.5;
      this.cageGroup.add(topFront, topBack, topLeft, topRight);

      // Optimized InstancedMesh cage bars (thin, unobtrusive on back/sides/top; front left open/panoramic so camera sees rats clearly!)
      const barMatrices: THREE.Matrix4[] = [];
      const dummy = new THREE.Object3D();
      const barSpacing = isPanoramic ? 0.13 : 0.1;

      // Back vertical bars
      for (let x = -width * 0.5 + barSpacing; x < width * 0.5; x += barSpacing) {
        dummy.position.set(x, 0.18 + (height - 0.18) * 0.5, -depth * 0.5);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, height - 0.18, 1);
        dummy.updateMatrix();
        barMatrices.push(dummy.matrix.clone());
      }
      // Left & Right vertical bars
      for (let z = -depth * 0.5 + barSpacing; z < depth * 0.5; z += barSpacing) {
        for (const sx of [-width * 0.5, width * 0.5]) {
          dummy.position.set(sx, 0.18 + (height - 0.18) * 0.5, z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, height - 0.18, 1);
          dummy.updateMatrix();
          barMatrices.push(dummy.matrix.clone());
        }
      }
      // Back & side horizontal crossbars
      for (let y = 0.38; y < height - 0.06; y += 0.26) {
        dummy.position.set(0, y, -depth * 0.5);
        dummy.rotation.set(0, 0, Math.PI / 2);
        dummy.scale.set(1, width, 1);
        dummy.updateMatrix();
        barMatrices.push(dummy.matrix.clone());

        for (const sx of [-width * 0.5, width * 0.5]) {
          dummy.position.set(sx, y, 0);
          dummy.rotation.set(Math.PI / 2, 0, 0);
          dummy.scale.set(1, depth, 1);
          dummy.updateMatrix();
          barMatrices.push(dummy.matrix.clone());
        }
      }
      // Top roof bars (spaced lightly for hanging hammocks)
      for (let x = -width * 0.5 + 0.18; x < width * 0.5; x += 0.18) {
        dummy.position.set(x, height, 0);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.set(1, depth, 1);
        dummy.updateMatrix();
        barMatrices.push(dummy.matrix.clone());
      }

      // Small open hinged front door detail on the front-right so the cage reads immediately as an inviting open pet home
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.015), new THREE.MeshStandardMaterial({
        color: '#657968',
        wireframe: true,
      }));
      doorFrame.position.set(width * 0.5 - 0.16, 0.4, depth * 0.5 + 0.16);
      doorFrame.rotation.y = -0.9;
      this.cageGroup.add(doorFrame);

      const barGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 1, 5);
      const instBars = new THREE.InstancedMesh(barGeo, frameMat, barMatrices.length);
      barMatrices.forEach((m, idx) => instBars.setMatrixAt(idx, m));
      instBars.instanceMatrix.needsUpdate = true;
      this.cageGroup.add(instBars);
    }

    // 2. Second Floor Expansion (wooden shelf + climbing ramp with wooden rungs!)
    if (hasSecondFloor) {
      const shelfW = 1.48;
      const shelfD = depth - 0.16;
      const shelfY = 0.75;
      const shelfX = -width * 0.5 + shelfW * 0.5 + 0.06;

      this.bounds.secondFloorY = shelfY + 0.03;
      this.bounds.secondFloorMinX = shelfX - shelfW * 0.5 + 0.1;
      this.bounds.secondFloorMaxX = shelfX + shelfW * 0.5 - 0.08;
      this.bounds.secondFloorMinZ = -shelfD * 0.5 + 0.1;
      this.bounds.secondFloorMaxZ = shelfD * 0.5 - 0.1;

      const woodMat = new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.72 });
      const shelfMesh = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 0.06, shelfD), woodMat);
      shelfMesh.position.set(shelfX, shelfY, 0);
      shelfMesh.castShadow = true;
      shelfMesh.receiveShadow = true;
      this.cageGroup.add(shelfMesh);

      // Subtle low wooden guardrail on back/left edges
      const rail = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 0.08, 0.03), woodMat);
      rail.position.set(shelfX, shelfY + 0.06, -shelfD * 0.5 + 0.02);
      this.cageGroup.add(rail);

      // Climbing wooden ladder/ramp from 1st floor up to 2nd floor!
      const rampStart = new THREE.Vector3(shelfX + shelfW * 0.5 + 0.52, 0.08, 0.08);
      const rampEnd = new THREE.Vector3(shelfX + shelfW * 0.5 - 0.02, shelfY + 0.02, 0.08);
      this.bounds.rampBottom.copy(rampStart);
      this.bounds.rampTop.copy(rampEnd);

      const rampVec = new THREE.Vector3().subVectors(rampEnd, rampStart);
      const rampLen = rampVec.length();
      const rampMid = new THREE.Vector3().addVectors(rampStart, rampEnd).multiplyScalar(0.5);

      const rampGroup = new THREE.Group();
      rampGroup.position.copy(rampMid);
      const slopeAngle = Math.atan2(rampVec.y, -rampVec.x);
      rampGroup.rotation.z = -slopeAngle;

      const rampBoard = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.032, 0.26), woodMat);
      rampBoard.castShadow = true;
      rampBoard.receiveShadow = true;
      rampGroup.add(rampBoard);

      // Grippy wooden cleats / rungs along ramp
      const rungMat = new THREE.MeshStandardMaterial({ map: this.darkWoodTex, roughness: 0.8 });
      const numRungs = 9;
      for (let i = 0; i < numRungs; i++) {
        const rx = -rampLen * 0.44 + (i / (numRungs - 1)) * rampLen * 0.88;
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.24), rungMat);
        rung.position.set(rx, 0.022, 0);
        rampGroup.add(rung);
      }

      this.cageGroup.add(rampGroup);
    }

    this.rebuildSlotMarkers(hasSecondFloor);
  }

  private rebuildSlotMarkers(hasSecondFloor: boolean) {
    this.slotMarkersGroup.clear();
    this.slotMarkerMeshes = [];

    for (const slot of CAGE_SLOTS) {
      if (slot.requiresSecondFloor && !hasSecondFloor) continue;

      const isHang = slot.type === 'hanging' || slot.type === 'upper_hanging';
      const geo = isHang
        ? new THREE.OctahedronGeometry(0.11, 0)
        : new THREE.CylinderGeometry(0.16, 0.16, 0.035, 20);
      const mat = new THREE.MeshBasicMaterial({
        color: '#6E9B74',
        transparent: true,
        opacity: 0.72,
      });
      const marker = new THREE.Mesh(geo, mat);
      marker.position.set(...slot.position);
      if (!isHang) marker.position.y += 0.03;
      marker.userData = { slotId: slot.id, slotType: slot.type };
      this.slotMarkersGroup.add(marker);
      this.slotMarkerMeshes.push(marker);
    }
  }

  public highlightSlotsForItem(itemId: string | null) {
    const def = itemId ? ITEM_MAP[itemId] : null;
    for (const m of this.slotMarkerMeshes) {
      const slotType = m.userData.slotType as CageSlotDef['type'];
      const mat = m.material as THREE.MeshBasicMaterial;
      if (!def || !def.slotTypes) {
        mat.color.set('#6E9B74');
        mat.opacity = 0.65;
        m.visible = true;
      } else {
        const compatible = def.slotTypes.includes(slotType);
        m.visible = compatible;
        mat.color.set(compatible ? '#4E9E5A' : '#A8A8A8');
        mat.opacity = compatible ? 0.88 : 0.25;
      }
    }
  }

  public rebuildFurniture(placedItems: PlacedItem[], hasSecondFloor: boolean) {
    this.furnitureGroup.clear();
    this.furnitureAnchors = [];
    this.wheelSpinMesh = null;

    for (const p of placedItems) {
      const slot = CAGE_SLOTS.find((s) => s.id === p.slotId);
      const def = ITEM_MAP[p.itemId];
      if (!slot || !def) continue;
      if (slot.requiresSecondFloor && !hasSecondFloor) continue;

      const mesh = this.createFurnitureMesh(def.modelType ?? def.id);
      mesh.position.set(...slot.position);
      mesh.rotation.y = slot.rotationY ?? 0;
      this.furnitureGroup.add(mesh);

      this.furnitureAnchors.push({
        slotId: slot.id,
        itemId: def.id,
        category: def.category,
        position: new THREE.Vector3(...slot.position),
        rotationY: slot.rotationY ?? 0,
        level: slot.requiresSecondFloor ? 1 : 0,
      });
    }
  }

  private createFurnitureMesh(modelType: string): THREE.Group {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.72 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ map: this.darkWoodTex, roughness: 0.75 });
    const sageFabricMat = new THREE.MeshStandardMaterial({ color: '#6E8572', roughness: 0.92, side: THREE.DoubleSide });
    const creamFleeceMat = new THREE.MeshStandardMaterial({ color: '#EFE5D1', roughness: 0.95, side: THREE.DoubleSide });
    const terraMat = new THREE.MeshStandardMaterial({ color: '#C97254', roughness: 0.88 });
    const metalMat = new THREE.MeshStandardMaterial({ color: '#A5ADB2', metalness: 0.65, roughness: 0.3 });

    switch (modelType) {
      case 'house_wood': {
        // Cute gabled wooden house with dark round entrance
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.34), woodMat);
        body.position.y = 0.14;
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);

        const roofL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.032, 0.4), darkWoodMat);
        roofL.position.set(-0.12, 0.32, 0);
        roofL.rotation.z = 0.52;
        roofL.castShadow = true;
        const roofR = roofL.clone();
        roofR.position.x = 0.12;
        roofR.rotation.z = -0.52;
        g.add(roofL, roofR);

        // Dark doorway recess
        const door = new THREE.Mesh(
          new THREE.CircleGeometry(0.095, 16),
          new THREE.MeshStandardMaterial({ color: '#2F2117', roughness: 0.95 })
        );
        door.position.set(0, 0.12, 0.172);
        g.add(door);
        break;
      }

      case 'house_pouch': {
        // Cozy terracotta fleece teepee pouch
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 16), terraMat);
        cone.position.y = 0.18;
        cone.castShadow = true;
        g.add(cone);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.022, 8, 16), creamFleeceMat);
        rim.position.set(0, 0.12, 0.16);
        const hole = new THREE.Mesh(
          new THREE.CircleGeometry(0.088, 14),
          new THREE.MeshStandardMaterial({ color: '#2D1D17', roughness: 0.96 })
        );
        hole.position.set(0, 0.12, 0.162);
        g.add(rim, hole);
        break;
      }

      case 'house_pumpkin': {
        const pumpMat = new THREE.MeshStandardMaterial({ color: '#D67B3A', roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), pumpMat);
        body.scale.set(1.18, 0.85, 1.05);
        body.position.y = 0.17;
        body.castShadow = true;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.032, 0.09, 8),
          new THREE.MeshStandardMaterial({ color: '#5D6E46', roughness: 0.85 })
        );
        stem.position.set(0, 0.36, 0);
        stem.rotation.z = 0.18;
        const door = new THREE.Mesh(
          new THREE.CircleGeometry(0.09, 14),
          new THREE.MeshStandardMaterial({ color: '#2D1B10' })
        );
        door.position.set(0, 0.12, 0.215);
        g.add(body, stem, door);
        break;
      }

      case 'house_nest': {
        const nestRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.072, 10, 20), darkWoodMat);
        nestRing.rotation.x = Math.PI / 2;
        nestRing.position.y = 0.07;
        nestRing.castShadow = true;
        const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18), creamFleeceMat);
        cushion.position.y = 0.04;
        g.add(nestRing, cushion);
        break;
      }

      case 'hammock_fabric':
      case 'hammock_double':
      case 'hammock_plush': {
        // Curved hammock sling suspended from roof bars
        const mat = modelType === 'hammock_plush' ? terraMat : sageFabricMat;
        const slingGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.44, 14, 1, true, Math.PI * 0.15, Math.PI * 0.7);
        slingGeo.rotateZ(Math.PI / 2);
        const sling = new THREE.Mesh(slingGeo, mat);
        sling.position.y = 0.05;
        sling.castShadow = true;
        g.add(sling);

        const linerGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.41, 14, 1, true, Math.PI * 0.17, Math.PI * 0.66);
        linerGeo.rotateZ(Math.PI / 2);
        const liner = new THREE.Mesh(linerGeo, creamFleeceMat);
        liner.position.y = 0.055;
        g.add(liner);

        if (modelType === 'hammock_double') {
          const lower = sling.clone();
          lower.position.y = -0.14;
          lower.scale.set(0.95, 0.9, 0.95);
          g.add(lower);
        }

        // 4 hanging straps up to cage ceiling
        const strapGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.34, 6);
        for (const [sx, sz] of [
          [-0.2, -0.18],
          [0.2, -0.18],
          [-0.2, 0.18],
          [0.2, 0.18],
        ]) {
          const strap = new THREE.Mesh(strapGeo, metalMat);
          strap.position.set(sx, 0.14, sz);
          g.add(strap);
        }
        break;
      }

      case 'tunnel_clear': {
        const glassMat = new THREE.MeshStandardMaterial({
          color: '#D8EBE8',
          transparent: true,
          opacity: 0.48,
          roughness: 0.22,
          side: THREE.DoubleSide,
        });
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.48, 16, 1, true), glassMat);
        tube.rotation.z = Math.PI / 2;
        tube.position.y = 0.12;
        const ringL = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.012, 8, 18), sageFabricMat);
        ringL.rotation.y = Math.PI / 2;
        ringL.position.set(-0.24, 0.12, 0);
        const ringR = ringL.clone();
        ringR.position.x = 0.24;
        g.add(tube, ringL, ringR);
        break;
      }

      case 'tunnel_fabric': {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.48, 16, 1, true), creamFleeceMat);
        tube.rotation.z = Math.PI / 2;
        tube.position.y = 0.12;
        tube.castShadow = true;
        const rimL = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 8, 18), sageFabricMat);
        rimL.rotation.y = Math.PI / 2;
        rimL.position.set(-0.24, 0.12, 0);
        const rimR = rimL.clone();
        rimR.position.x = 0.24;
        g.add(tube, rimL, rimR);
        break;
      }

      case 'tunnel_bridge': {
        const numLogs = 9;
        for (let i = 0; i < numLogs; i++) {
          const a = (i / (numLogs - 1)) * Math.PI;
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8), woodMat);
          log.rotation.x = Math.PI / 2;
          log.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.17 + 0.02, 0);
          log.castShadow = true;
          g.add(log);
        }
        break;
      }

      case 'toy_ball': {
        const b1 = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.072, 1),
          new THREE.MeshStandardMaterial({ color: '#D67C59', roughness: 0.65 })
        );
        b1.position.set(-0.07, 0.072, 0.03);
        b1.castShadow = true;
        const b2 = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.058, 1),
          new THREE.MeshStandardMaterial({ color: '#6E8E76', roughness: 0.65 })
        );
        b2.position.set(0.08, 0.058, -0.04);
        b2.castShadow = true;
        g.add(b1, b2);
        break;
      }

      case 'puzzle_feeder': {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.065, 0.18), woodMat);
        base.position.y = 0.033;
        base.castShadow = true;
        g.add(base);
        for (const cx of [-0.11, 0, 0.11]) {
          const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 14), darkWoodMat);
          lid.position.set(cx, 0.072, 0);
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), darkWoodMat);
          knob.position.set(cx, 0.092, 0);
          g.add(lid, knob);
        }
        break;
      }

      case 'toy_rope': {
        const ropeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.24, 0.24, 0),
          new THREE.Vector3(-0.08, 0.02, 0.05),
          new THREE.Vector3(0.08, -0.02, -0.04),
          new THREE.Vector3(0.24, 0.24, 0),
        ]);
        const rope = new THREE.Mesh(
          new THREE.TubeGeometry(ropeCurve, 20, 0.024, 8, false),
          new THREE.MeshStandardMaterial({ color: '#D7C4A1', roughness: 0.94 })
        );
        rope.castShadow = true;
        g.add(rope);
        break;
      }

      case 'toy_wheel': {
        // Safe large solid-surface exercise wheel
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.2), darkWoodMat);
        stand.position.y = 0.015;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), darkWoodMat);
        post.position.set(0, 0.15, -0.08);
        g.add(stand, post);

        const wheelPivot = new THREE.Group();
        wheelPivot.position.set(0, 0.26, 0);
        const drum = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 0.13, 24, 1, true),
          new THREE.MeshStandardMaterial({ color: '#6E8572', roughness: 0.55, side: THREE.DoubleSide })
        );
        drum.rotation.x = Math.PI / 2;
        const backDisc = new THREE.Mesh(
          new THREE.CircleGeometry(0.22, 24),
          new THREE.MeshStandardMaterial({ color: '#DCE3D9', roughness: 0.65, side: THREE.DoubleSide })
        );
        backDisc.position.z = -0.065;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 12), woodMat);
        hub.rotation.x = Math.PI / 2;
        wheelPivot.add(drum, backDisc, hub);
        g.add(wheelPivot);
        this.wheelSpinMesh = wheelPivot;
        break;
      }

      case 'toy_ladder': {
        for (let i = 0; i < 6; i++) {
          const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), woodMat);
          rung.rotation.z = Math.PI / 2;
          rung.position.set(0, 0.2 - i * 0.09, 0);
          g.add(rung);
        }
        for (const sx of [-0.09, 0.09]) {
          const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6), creamFleeceMat);
          cord.position.set(sx, -0.02, 0);
          g.add(cord);
        }
        break;
      }

      case 'water_bottle': {
        const glass = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.22, 14),
          new THREE.MeshStandardMaterial({
            color: '#DCF2F5',
            transparent: true,
            opacity: 0.62,
            roughness: 0.15,
          })
        );
        glass.position.y = 0.08;
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(0.048, 0.048, 0.15, 12),
          new THREE.MeshStandardMaterial({ color: '#8ED2E0', transparent: true, opacity: 0.55 })
        );
        water.position.y = 0.05;
        const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.032, 14), sageFabricMat);
        capTop.position.y = 0.2;
        const capBot = capTop.clone();
        capBot.position.y = -0.04;
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.11, 8), metalMat);
        spout.position.set(0, -0.09, 0.04);
        spout.rotation.x = 0.55;
        g.add(glass, water, capTop, capBot, spout);
        break;
      }

      case 'bowl_ceramic': {
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.125, 0.11, 0.075, 18),
          new THREE.MeshStandardMaterial({ color: '#587A72', roughness: 0.35 })
        );
        bowl.position.y = 0.038;
        bowl.castShadow = true;
        const foodMound = new THREE.Mesh(
          new THREE.SphereGeometry(0.098, 12, 8),
          new THREE.MeshStandardMaterial({ color: '#AD824F', roughness: 0.92 })
        );
        foodMound.scale.set(1, 0.32, 1);
        foodMound.position.y = 0.068;
        g.add(bowl, foodMound);
        break;
      }

      case 'care_paper': {
        const paperMat = new THREE.MeshStandardMaterial({ color: '#FCF8F0', roughness: 0.94 });
        for (let i = 0; i < 9; i++) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.028), paperMat);
          strip.position.set((Math.random() - 0.5) * 0.12, 0.012 + i * 0.005, (Math.random() - 0.5) * 0.12);
          strip.rotation.set(0.1, Math.random() * Math.PI, 0.08);
          g.add(strip);
        }
        break;
      }

      default: {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.22), woodMat);
        box.position.y = 0.075;
        g.add(box);
      }
    }

    return g;
  }
}
