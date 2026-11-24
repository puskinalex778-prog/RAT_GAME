import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ThemeDef } from '../store/data/items';
import { fabricTexture, rugTexture, wallTexture, woodFloorTexture, woodTexture } from './textures';

/** Уютная комната вокруг клетки: стены, пол, тумба, окно, растения, табличка-посвящение */
export class Room {
  readonly group = new THREE.Group();
  readonly floorY = -0.82;
  readonly plaque: THREE.Mesh;
  private wallMat: THREE.MeshStandardMaterial;
  private floorMat: THREE.MeshStandardMaterial;
  private rugMat: THREE.MeshStandardMaterial;
  private tableMat: THREE.MeshStandardMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private plants: THREE.Group[] = [];
  readonly lampLight: THREE.PointLight;
  private garland: THREE.Group;

  constructor() {
    const fy = this.floorY;
    const RW = 6.4;
    const RD = 5.6;
    const RH = 3.0;

    this.floorMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = fy;
    floor.receiveShadow = true;
    this.group.add(floor);

    this.wallMat = new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.BackSide });
    const walls = new THREE.Mesh(new THREE.BoxGeometry(RW, RH, RD), this.wallMat);
    walls.position.y = fy + RH / 2;
    walls.receiveShadow = true;
    this.group.add(walls);
    // плинтус
    const skirtMat = new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.6 });
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.02, 0.08, RD - 0.02), skirtMat);
    skirt.position.y = fy + 0.04;
    (skirt.material as THREE.Material).side = THREE.BackSide;
    this.group.add(skirt);

    // ковёр
    this.rugMat = new THREE.MeshStandardMaterial({ roughness: 1 });
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), this.rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, fy + 0.004, 0.5);
    rug.scale.set(1.3, 1, 1);
    rug.receiveShadow = true;
    this.group.add(rug);

    // тумба под клеткой
    this.tableMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.05, 1.15), this.tableMat);
    tableTop.position.set(0, -0.065, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    this.group.add(tableTop);
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.85, -fy - 0.09, 1.05), this.tableMat);
    cabinet.position.set(0, fy + (-fy - 0.09) / 2, -0.02);
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    this.group.add(cabinet);
    const doorMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, transparent: true, opacity: 0.12 });
    for (const sx of [-0.46, 0.46]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.6), doorMat);
      door.position.set(sx, fy + 0.4, 0.512);
      this.group.add(door);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 0.7, roughness: 0.3 }));
      knob.position.set(sx + (sx < 0 ? 0.34 : -0.34), fy + 0.42, 0.53);
      this.group.add(knob);
    }

    // окно на задней стене
    const winGroup = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.25), new THREE.MeshBasicMaterial({ color: '#dff0fb' }));
    winGroup.add(glass);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#f7f3ec', roughness: 0.5 });
    const fr = (w: number, h: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), frameMat);
      m.position.set(x, y, 0.02);
      winGroup.add(m);
    };
    fr(1.3, 0.06, 0, 0.65);
    fr(1.3, 0.06, 0, -0.65);
    fr(0.06, 1.36, -0.63, 0);
    fr(0.06, 1.36, 0.63, 0);
    fr(0.04, 1.25, 0, 0);
    fr(1.2, 0.04, 0, 0.1);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.04, 0.2), frameMat);
    sill.position.set(0, -0.69, 0.08);
    winGroup.add(sill);
    // занавески
    const curtainMat = new THREE.MeshStandardMaterial({ map: fabricTexture('#f2e6d6', '#ead8c2', 'stripe'), roughness: 1, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const cg = new THREE.PlaneGeometry(0.42, 1.7, 16, 4);
      const pa = cg.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 40) * 0.03);
      cg.computeVertexNormals();
      const c = new THREE.Mesh(cg, curtainMat);
      c.position.set(sx * 0.82, 0.05, 0.1);
      winGroup.add(c);
    }
    winGroup.position.set(-1.35, fy + 1.75, -RD / 2 + 0.01);
    this.group.add(winGroup);

    // растения
    const potMat = new THREE.MeshStandardMaterial({ color: '#c98b6b', roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#5f8f57', roughness: 0.75, side: THREE.DoubleSide });
    const makePlant = (scale: number) => {
      const p = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.24, 20), potMat);
      pot.position.y = 0.12;
      pot.castShadow = true;
      p.add(pot);
      const leaves: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 14; i++) {
        const lg = new THREE.SphereGeometry(0.1, 8, 6);
        const a = (i / 14) * Math.PI * 2;
        const tilt = 0.4 + (i % 3) * 0.25;
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(a) * 0.07, 0.36 + (i % 4) * 0.05, Math.sin(a) * 0.07),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, -a, Math.cos(a) * tilt)),
          new THREE.Vector3(0.35, 1, 0.08),
        );
        lg.applyMatrix4(m);
        leaves.push(lg);
      }
      const leaf = new THREE.Mesh(mergeGeometries(leaves), leafMat);
      leaf.castShadow = true;
      p.add(leaf);
      p.scale.setScalar(scale);
      return p;
    };
    const plant1 = makePlant(1.6);
    plant1.position.set(-2.3, fy, -1.9);
    const plant2 = makePlant(0.9);
    plant2.position.set(1.25, fy + 1.32 - 0.02, -RD / 2 + 0.2);
    const plant3 = makePlant(1.2);
    plant3.position.set(2.4, fy, 1.6);
    this.plants.push(plant1, plant2, plant3);
    for (const p of this.plants) this.group.add(p);

    // полка с книгами справа
    const shelfMat = new THREE.MeshStandardMaterial({ map: woodTexture('#c49a6c'), roughness: 0.7 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.26), shelfMat);
    shelf.position.set(1.4, fy + 1.3, -RD / 2 + 0.14);
    shelf.castShadow = true;
    this.group.add(shelf);
    const bookColors = ['#c25b4a', '#4f7ca0', '#e0b050', '#7a9a6a', '#a07ab0', '#d99076'];
    for (let i = 0; i < 9; i++) {
      const h = 0.18 + ((i * 37) % 7) * 0.012;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, h, 0.19), new THREE.MeshStandardMaterial({ color: bookColors[i % bookColors.length], roughness: 0.8 }));
      b.position.set(1.0 + i * 0.05, fy + 1.32 + h / 2, -RD / 2 + 0.14);
      b.rotation.z = i === 8 ? 0.25 : 0;
      this.group.add(b);
    }

    // табличка-посвящение в деревянной рамке (на стене за клеткой)
    const plaqueGroup = new THREE.Group();
    const tex = new THREE.TextureLoader().load('./dedication.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    this.plaque.position.z = 0.012;
    this.plaque.userData.plaque = true;
    plaqueGroup.add(this.plaque);
    const pfMat = new THREE.MeshStandardMaterial({ map: woodTexture('#b88a5a'), roughness: 0.6 });
    const pf = (w: number, h: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), pfMat);
      m.position.set(x, y, 0.01);
      m.castShadow = true;
      plaqueGroup.add(m);
    };
    pf(0.8, 0.04, 0, 0.26);
    pf(0.8, 0.04, 0, -0.26);
    pf(0.04, 0.56, -0.38, 0);
    pf(0.04, 0.56, 0.38, 0);
    plaqueGroup.position.set(0.55, fy + 1.95, -RD / 2 + 0.01);
    this.group.add(plaqueGroup);

    // торшер
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.55, 8), new THREE.MeshStandardMaterial({ color: '#3d3530', metalness: 0.5, roughness: 0.4 }));
    pole.position.y = 0.78;
    lamp.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 20), pole.material);
    lamp.add(base);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.28, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#f6e3c4', emissive: '#ffcf8a', emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.9 }));
    shade.position.y = 1.6;
    lamp.add(shade);
    lamp.position.set(2.2, fy, -1.7);
    this.group.add(lamp);
    this.lampLight = new THREE.PointLight('#ffc98a', 1.4, 5, 1.6);
    this.lampLight.position.set(2.2, fy + 1.55, -1.7);
    this.group.add(this.lampLight);

    // кресло-пуф (сзади камеры, видно при облёте)
    this.accentMat = new THREE.MeshStandardMaterial({ map: fabricTexture('#8fb38a', '#7ea478', 'plush'), roughness: 1 });
    const pouf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), this.accentMat);
    pouf.scale.set(1, 0.55, 1);
    pouf.position.set(-1.6, fy + 0.22, 1.9);
    pouf.castShadow = true;
    this.group.add(pouf);

    // гирлянда (для пастельной темы)
    this.garland = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: ['#ffd9a0', '#ffc0cb', '#d0f0ff'][i % 3] }));
      bulb.position.set(-2.2 + t * 4.4, fy + 2.55 - Math.sin(t * Math.PI) * 0.25, -RD / 2 + 0.05);
      this.garland.add(bulb);
    }
    this.group.add(this.garland);
  }

  applyTheme(t: ThemeDef) {
    const wt = wallTexture(t.wall, t.wall2);
    wt.repeat.set(6, 3);
    this.wallMat.map = wt;
    this.wallMat.needsUpdate = true;
    const ft = woodFloorTexture(t.floor, t.floor2);
    ft.repeat.set(4, 4);
    this.floorMat.map = ft;
    this.floorMat.needsUpdate = true;
    const rt = rugTexture(t.rug, t.rug2);
    rt.repeat.set(3, 3);
    this.rugMat.map = rt;
    this.rugMat.needsUpdate = true;
    this.tableMat.map = woodTexture(t.table);
    this.tableMat.needsUpdate = true;
    this.lampLight.color.set(t.light);
    for (let i = 0; i < this.plants.length; i++) this.plants[i].visible = t.plant || i === 0;
    this.garland.visible = t.id === 'theme_pastel';
  }
}
