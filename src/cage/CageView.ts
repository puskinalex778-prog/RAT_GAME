import * as THREE from 'three';
import type { CageState } from '../store/types';
import { cageDef, placeableDef, type ItemKind } from '../store/data/items';
import { buildLayout, type CageLayout, type SlotDef } from './layout';
import { buildBottle, buildItem, type BuiltItem } from './items3d';
import { beddingTexture, fabricTexture, woodTexture } from '../engine/textures';

export interface ItemInstance {
  slotId: string;
  itemId: string;
  kind: ItemKind;
  hang: boolean;
  /** уровень пола, с которого к предмету подходят (0 — пол, 1 — полка) */
  level: 0 | 1;
  built: BuiltItem;
  approach: THREE.Vector3;
  inside?: THREE.Vector3;
  inside2?: THREE.Vector3;
  exit?: THREE.Vector3;
  top?: THREE.Vector3;
  path?: THREE.Vector3[];
  /** точка у стенки, откуда начинается подъём к подвесному предмету */
  climbBase?: THREE.Vector3;
  center: THREE.Vector3;
  radius: number;
  occupants: number;
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
  level: 0 | 1;
  slotId: string;
}

/** 3D-представление клетки: поддон, подстилка, прутья, полка, предметы, слоты */
export class CageView {
  readonly group = new THREE.Group();
  layout!: CageLayout;
  items: ItemInstance[] = [];
  obstacles: Obstacle[] = [];
  slotMarkers: THREE.Mesh[] = [];
  private markerGroup = new THREE.Group();
  private bedding!: THREE.Mesh;
  private bottleWater: THREE.Mesh | null = null;
  private papers: THREE.Mesh[] = [];
  paperSpots: THREE.Vector3[] = [];
  private cageId = '';
  private playpen = false;
  wheelSpin = 0;
  bowlLevel = 1;

  constructor() {
    this.group.add(this.markerGroup);
    this.markerGroup.visible = false;
  }

  get floorY(): number {
    return 0;
  }

  levelY(level: 0 | 1): number {
    return level === 1 && this.layout.shelf ? this.layout.shelf.y : 0;
  }

  /** Полная пересборка при смене клетки/предметов */
  rebuild(c: CageState) {
    for (const ch of [...this.group.children]) {
      if (ch !== this.markerGroup) this.group.remove(ch);
    }
    this.markerGroup.clear();
    this.slotMarkers = [];
    this.items = [];
    this.obstacles = [];
    this.papers = [];
    this.cageId = c.cageId;
    const def = cageDef(c.cageId);
    this.playpen = !def.roof;
    this.layout = buildLayout(c.cageId, c.secondFloor);
    const L = this.layout;

    this.buildBase(L);
    if (this.playpen) this.buildPlaypenWalls(L);
    else this.buildBars(L);
    if (L.shelf && L.ramp) this.buildShelf(L);
    if (!this.playpen) this.buildBottleView(c.bottle === 'bottle_glass');

    for (const p of c.placed) {
      const slot = L.slots.find((s) => s.id === p.slotId);
      const pd = placeableDef(p.itemId);
      if (!slot || !pd) continue;
      this.placeItem(slot, p.itemId, pd.kind, pd.variant);
    }
    this.buildMarkers(L, c);
    this.buildPapers();
    this.updateState(c);
  }

  private buildBase(L: CageLayout) {
    const trayMat = new THREE.MeshStandardMaterial({ color: this.playpen ? '#c9b8a6' : '#9cb9b2', roughness: 0.55 });
    if (!this.playpen) {
      const t = 0.012;
      const wallH = 0.06;
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(L.w + 0.04, t, L.d + 0.04), trayMat);
      bottom.position.y = -0.035;
      bottom.receiveShadow = true;
      this.group.add(bottom);
      const walls: [number, number, number, number, number][] = [
        [0, (L.d + 0.04) / 2, L.w + 0.04, wallH, t],
        [0, -(L.d + 0.04) / 2, L.w + 0.04, wallH, t],
        [(L.w + 0.04) / 2, 0, t, wallH, L.d + 0.04],
        [-(L.w + 0.04) / 2, 0, t, wallH, L.d + 0.04],
      ];
      for (const [x, z, sx, sy, sz] of walls) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), trayMat);
        m.position.set(x, -0.035 + sy / 2, z);
        m.castShadow = true;
        m.receiveShadow = true;
        this.group.add(m);
      }
    }
    // подстилка с лёгким рельефом
    const geo = new THREE.PlaneGeometry(L.w + (this.playpen ? 0 : 0.03), L.d + (this.playpen ? 0 : 0.03), 40, 24);
    geo.rotateX(-Math.PI / 2);
    const pa = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const z = pa.getZ(i);
      const n = Math.sin(x * 37 + z * 11) * 0.5 + Math.sin(x * 13 - z * 29) * 0.5;
      pa.setY(i, this.playpen ? 0 : -0.004 + n * 0.003);
    }
    geo.computeVertexNormals();
    const bedMat = this.playpen
      ? new THREE.MeshStandardMaterial({ map: fabricTexture('#d7c7e4', '#cbb8db', 'plush'), roughness: 1 })
      : new THREE.MeshStandardMaterial({ map: beddingTexture(true), roughness: 1 });
    (bedMat.map as THREE.Texture).repeat.set(2, 1.2);
    this.bedding = new THREE.Mesh(geo, bedMat);
    this.bedding.receiveShadow = true;
    this.group.add(this.bedding);
  }

  private buildBars(L: CageLayout) {
    const barMat = new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.35, metalness: 0.3 });
    const spacing = 0.024;
    const y0 = 0.02;
    const hBars = L.h - y0;
    const geo = new THREE.CylinderGeometry(0.0017, 0.0017, 1, 5);
    const mats: THREE.Matrix4[] = [];
    const add = (x: number, y: number, z: number, len: number, axis: 'y' | 'x' | 'z') => {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      if (axis === 'x') q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      if (axis === 'z') q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, len, 1));
      mats.push(m);
    };
    const nx = Math.round(L.w / spacing);
    const nz = Math.round(L.d / spacing);
    for (let i = 0; i <= nx; i++) {
      const x = -L.w / 2 + (i / nx) * L.w;
      add(x, y0 + hBars / 2, L.d / 2, hBars, 'y');
      add(x, y0 + hBars / 2, -L.d / 2, hBars, 'y');
      add(x, L.h, 0, L.d, 'z'); // крыша
    }
    for (let i = 1; i < nz; i++) {
      const z = -L.d / 2 + (i / nz) * L.d;
      add(L.w / 2, y0 + hBars / 2, z, hBars, 'y');
      add(-L.w / 2, y0 + hBars / 2, z, hBars, 'y');
    }
    const inst = new THREE.InstancedMesh(geo, barMat, mats.length);
    mats.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = true;
    this.group.add(inst);

    // рамы (толще)
    const frameMat = new THREE.MeshStandardMaterial({ color: '#e9e4dc', roughness: 0.4, metalness: 0.25 });
    const fgeo = new THREE.BoxGeometry(1, 1, 1);
    const fm: THREE.Matrix4[] = [];
    const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      fm.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
    };
    const th = 0.008;
    for (const y of [y0, L.h * 0.5, L.h]) {
      box(0, y, L.d / 2, L.w + th, th, th);
      box(0, y, -L.d / 2, L.w + th, th, th);
      box(L.w / 2, y, 0, th, th, L.d + th);
      box(-L.w / 2, y, 0, th, th, L.d + th);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box((sx * L.w) / 2, y0 + hBars / 2, (sz * L.d) / 2, th, hBars, th);
    // дверца спереди
    box(-0.12, L.h * 0.62, L.d / 2 + 0.002, th * 0.8, 0.28, th * 0.8);
    box(0.12, L.h * 0.62, L.d / 2 + 0.002, th * 0.8, 0.28, th * 0.8);
    box(0, L.h * 0.62 + 0.14, L.d / 2 + 0.002, 0.24, th * 0.8, th * 0.8);
    box(0, L.h * 0.62 - 0.14, L.d / 2 + 0.002, 0.24, th * 0.8, th * 0.8);
    const finst = new THREE.InstancedMesh(fgeo, frameMat, fm.length);
    fm.forEach((m, i) => finst.setMatrixAt(i, m));
    finst.castShadow = true;
    this.group.add(finst);
  }

  private buildPlaypenWalls(L: CageLayout) {
    const m = new THREE.MeshStandardMaterial({ map: fabricTexture('#e8c9b8', '#f3e2d6', 'stripe'), roughness: 0.95, side: THREE.DoubleSide });
    const h = L.h;
    const walls: [number, number, number, number][] = [
      [0, L.d / 2, L.w, 0],
      [0, -L.d / 2, L.w, 0],
      [L.w / 2, 0, L.d, Math.PI / 2],
      [-L.w / 2, 0, L.d, Math.PI / 2],
    ];
    for (const [x, z, len, rot] of walls) {
      const geo = new THREE.PlaneGeometry(len, h, 24, 2);
      const pa = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 40) * 0.006);
      geo.computeVertexNormals();
      const w = new THREE.Mesh(geo, m);
      w.position.set(x, h / 2, z);
      w.rotation.y = rot;
      w.castShadow = true;
      w.receiveShadow = true;
      this.group.add(w);
    }
    const poleMat = new THREE.MeshStandardMaterial({ map: woodTexture('#d9b98f'), roughness: 0.7 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h + 0.04, 10), poleMat);
        p.position.set((sx * L.w) / 2, (h + 0.04) / 2, (sz * L.d) / 2);
        p.castShadow = true;
        this.group.add(p);
      }
    }
  }

  private buildShelf(L: CageLayout) {
    const s = L.shelf!;
    const r = L.ramp!;
    const wm = new THREE.MeshStandardMaterial({ map: woodTexture('#dcbd92'), roughness: 0.75 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0, 0.014, s.z1 - s.z0), wm);
    board.position.set((s.x0 + s.x1) / 2, s.y - 0.007, (s.z0 + s.z1) / 2);
    board.castShadow = true;
    board.receiveShadow = true;
    this.group.add(board);
    // мягкий коврик на полке
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(s.x1 - s.x0 - 0.04, s.z1 - s.z0 - 0.04), new THREE.MeshStandardMaterial({ map: fabricTexture('#efe3cf', '#e3d2b8', 'plush'), roughness: 1 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set((s.x0 + s.x1) / 2, s.y + 0.001, (s.z0 + s.z1) / 2);
    mat.receiveShadow = true;
    this.group.add(mat);
    // бортик полки
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.025, s.z1 - s.z0 - 0.14), wm);
    lip.position.set(s.x0 + 0.006, s.y + 0.012, 0.06);
    this.group.add(lip);
    // пандус-лесенка
    const from = new THREE.Vector3(...r.from);
    const to = new THREE.Vector3(...r.to);
    const len = from.distanceTo(to);
    const ramp = new THREE.Group();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(r.width, 0.01, len + 0.02), wm);
    plank.castShadow = true;
    plank.receiveShadow = true;
    ramp.add(plank);
    for (let i = 0; i < 10; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(r.width, 0.006, 0.008), wm);
      slat.position.set(0, 0.008, -len / 2 + (i + 0.5) * (len / 10));
      ramp.add(slat);
    }
    ramp.position.copy(from).add(to).multiplyScalar(0.5);
    ramp.position.y -= 0.004;
    ramp.lookAt(to.x, to.y - 0.004, to.z);
    this.group.add(ramp);
  }

  private buildBottleView(glass: boolean) {
    const L = this.layout;
    const { group, water } = buildBottle(glass);
    group.position.set(L.bottle.x - 0.052, 0.088, L.bottle.z);
    this.group.add(group);
    this.bottleWater = water;
  }

  private placeItem(slot: SlotDef, itemId: string, kind: ItemKind, variant: string) {
    const built = buildItem(kind, variant);
    const g = built.group;
    g.position.set(slot.x, slot.y, slot.z);
    g.rotation.y = slot.rot;
    const L = this.layout;
    const hang = slot.kind === 'hang';
    let level: 0 | 1 = slot.level;
    let baseY = slot.y;
    if (hang) {
      const s = L.shelf;
      level = s && slot.x > s.x0 + 0.02 && slot.x < s.x1 ? 1 : 0;
      baseY = this.levelY(level);
      // растянуть канат/лестницу до пола
      const stretch = g.getObjectByName('stretch');
      if (stretch) stretch.scale.y = Math.max(0.1, slot.y - baseY - 0.01);
    }
    this.group.add(g);
    g.updateMatrixWorld(true);
    const a = built.anchors;
    const toWorld = (v?: THREE.Vector3) => (v ? this.group.worldToLocal(g.localToWorld(v.clone())) : undefined);
    const inst: ItemInstance = {
      slotId: slot.id,
      itemId,
      kind,
      hang,
      level,
      built,
      approach: toWorld(a.approach)!,
      inside: toWorld(a.inside),
      inside2: toWorld(a.inside2),
      exit: toWorld(a.exit),
      top: toWorld(a.top),
      path: a.path?.map((p) => toWorld(p)!),
      center: new THREE.Vector3(slot.x, baseY, slot.z),
      radius: a.radius,
      occupants: 0,
    };
    if (hang) {
      inst.approach.y = Math.max(inst.approach.y, baseY + 0.05);
      if (kind === 'rope' || kind === 'ladder') {
        inst.approach = new THREE.Vector3(slot.x, baseY, slot.z + 0.05);
        inst.climbBase = new THREE.Vector3(slot.x, baseY, slot.z + 0.012);
        inst.top = new THREE.Vector3(slot.x, slot.y - 0.11, slot.z + 0.012);
      } else {
        // подъём по задней стенке
        inst.climbBase = new THREE.Vector3(slot.x, baseY, -L.d / 2 + 0.02);
      }
    } else {
      inst.approach.y = baseY;
      if (inst.exit) inst.exit.y = baseY;
      this.obstacles.push({ x: slot.x, z: slot.z, r: a.radius, level: slot.level, slotId: slot.id });
    }
    // чтобы точки подхода не выходили за стенки
    const clampV = (v?: THREE.Vector3) => {
      if (!v) return;
      v.x = Math.max(-L.w / 2 + 0.05, Math.min(L.w / 2 - 0.05, v.x));
      v.z = Math.max(-L.d / 2 + 0.05, Math.min(L.d / 2 - 0.05, v.z));
    };
    if (!hang) {
      clampV(inst.approach);
      clampV(inst.exit);
    }
    this.items.push(inst);
  }

  private buildMarkers(L: CageLayout, c: CageState) {
    const ringGeo = new THREE.RingGeometry(0.055, 0.075, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const hookGeo = new THREE.TorusGeometry(0.03, 0.008, 8, 24);
    for (const s of L.slots) {
      const occupied = c.placed.some((p) => p.slotId === s.id);
      const m = new THREE.Mesh(
        s.kind === 'hang' ? hookGeo : ringGeo,
        new THREE.MeshBasicMaterial({ color: occupied ? '#f0b24a' : '#5fb37a', transparent: true, opacity: 0.85, depthTest: false }),
      );
      m.renderOrder = 10;
      m.position.set(s.x, s.y + (s.kind === 'hang' ? -0.04 : 0.006), s.z + (s.kind === 'floor' ? 0 : 0));
      m.userData.slotId = s.id;
      this.markerGroup.add(m);
      this.slotMarkers.push(m);
    }
  }

  setDecorMode(on: boolean) {
    this.markerGroup.visible = on;
  }

  highlightSlot(slotId: string | null) {
    for (const m of this.slotMarkers) {
      const mm = m.material as THREE.MeshBasicMaterial;
      mm.opacity = m.userData.slotId === slotId ? 1 : 0.7;
      m.scale.setScalar(m.userData.slotId === slotId ? 1.25 : 1);
    }
  }

  private buildPapers() {
    const L = this.layout;
    const geo = new THREE.PlaneGeometry(0.03, 0.024, 3, 2);
    const pa = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setZ(i, (Math.random() - 0.5) * 0.008);
    geo.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: '#faf7f1', roughness: 0.95, side: THREE.DoubleSide });
    this.paperSpots = [];
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(geo, m);
      let x = 0;
      let z = 0;
      for (let tries = 0; tries < 20; tries++) {
        x = (Math.random() - 0.5) * (L.w - 0.16);
        z = (Math.random() - 0.5) * (L.d - 0.14);
        if (!this.obstacles.some((o) => o.level === 0 && Math.hypot(o.x - x, o.z - z) < o.r + 0.03)) break;
      }
      p.position.set(x, 0.006, z);
      p.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.4, Math.random() * Math.PI, 0);
      p.castShadow = true;
      p.visible = false;
      this.group.add(p);
      this.papers.push(p);
      this.paperSpots.push(new THREE.Vector3(x, 0, z));
    }
  }

  /** Обновление «живых» показателей без пересборки */
  updateState(c: CageState) {
    const fresh = c.bedding > 40;
    const bedMat = this.bedding.material as THREE.MeshStandardMaterial;
    if (!this.playpen) {
      const tex = beddingTexture(fresh);
      if (bedMat.map !== tex) {
        tex.repeat.set(2, 1.2);
        bedMat.map = tex;
        bedMat.needsUpdate = true;
      }
    }
    if (this.bottleWater) {
      const lv = Math.max(0.02, c.water / 100) * 0.14;
      this.bottleWater.scale.y = lv;
      this.bottleWater.position.y = 0.05 + lv / 2;
    }
    this.bowlLevel = c.bowlFood / 100;
    for (const it of this.items) {
      if (it.built.foodMound) {
        it.built.foodMound.visible = c.bowlFood > 2;
        it.built.foodMound.scale.set(1, 0.3 + this.bowlLevel * 0.9, 1);
        it.built.foodMound.position.y = -0.012 * (1 - this.bowlLevel);
      }
      if (it.built.nest) it.built.nest.visible = c.nestBuilt > 0;
    }
    const n = Math.min(this.papers.length, c.nestPapers);
    this.papers.forEach((p, i) => (p.visible = i < n));
  }

  visiblePaperIndex(): number[] {
    const out: number[] = [];
    this.papers.forEach((p, i) => p.visible && out.push(i));
    return out;
  }

  hidePaper(i: number) {
    if (this.papers[i]) this.papers[i].visible = false;
  }

  findItems(pred: (i: ItemInstance) => boolean): ItemInstance[] {
    return this.items.filter(pred);
  }

  update(dt: number) {
    for (const it of this.items) {
      if (it.built.spinner) {
        it.built.spinner.rotation.z += this.wheelSpin * dt;
      }
    }
    this.wheelSpin *= Math.exp(-dt * 1.5);
  }

  get isPlaypen(): boolean {
    return this.playpen;
  }

  get id(): string {
    return this.cageId;
  }
}
