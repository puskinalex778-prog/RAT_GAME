import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ItemKind } from '../store/data/items';
import { fabricTexture, woodTexture } from '../engine/textures';

/** Точки взаимодействия предмета (локальные координаты предмета) */
export interface ItemAnchors {
  approach: THREE.Vector3;
  inside?: THREE.Vector3;
  exit?: THREE.Vector3;
  top?: THREE.Vector3;
  /** точки пути внутри туннеля (от входа к выходу) */
  path?: THREE.Vector3[];
  radius: number;
  /** подвесной предмет: высота спального места относительно слота */
  hangDrop?: number;
  /** может ли крыса спать здесь */
  sleep: boolean;
  /** второй спальный ярус (двухъярусный гамак) */
  inside2?: THREE.Vector3;
}

export interface BuiltItem {
  group: THREE.Group;
  anchors: ItemAnchors;
  /** вращающаяся часть колеса */
  spinner?: THREE.Object3D;
  /** мяч, который можно катать */
  ball?: THREE.Mesh;
  /** горка корма в миске */
  foodMound?: THREE.Object3D;
  /** гнездо из салфеток внутри домика */
  nest?: THREE.Object3D;
}

const matCache = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}

const woodMat = () => mat('wood', () => new THREE.MeshStandardMaterial({ map: woodTexture('#dcbd92'), roughness: 0.75 }));
const darkWoodMat = () => mat('wood_dark', () => new THREE.MeshStandardMaterial({ map: woodTexture('#b48a5f'), roughness: 0.8 }));

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

function nestFluff(radius: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.PlaneGeometry(0.03, 0.022, 2, 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) p.setZ(k, (Math.random() - 0.5) * 0.008);
    g.rotateX(-Math.PI / 2 + (Math.random() - 0.5) * 1.2);
    g.rotateY(Math.random() * Math.PI);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    g.translate(Math.cos(a) * r, 0.006 + Math.random() * 0.012, Math.sin(a) * r);
    parts.push(g.toNonIndexed());
  }
  const m = new THREE.Mesh(mergeGeometries(parts), mat('paper', () => new THREE.MeshStandardMaterial({ color: '#f5f1ea', roughness: 0.95, side: THREE.DoubleSide })));
  m.visible = false;
  return m;
}

// ---------------------------------------------------------------- Домики

function houseWood(): BuiltItem {
  const g = new THREE.Group();
  const W = 0.18;
  const H = 0.11;
  const D = 0.15;
  const t = 0.008;
  const wm = woodMat();
  // передняя стенка с круглым входом
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0);
  shape.lineTo(W / 2, 0);
  shape.lineTo(W / 2, H);
  shape.lineTo(0, H + 0.055);
  shape.lineTo(-W / 2, H);
  shape.lineTo(-W / 2, 0);
  const hole = new THREE.Path();
  hole.absarc(0.02, 0.048, 0.034, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const front = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }), wm);
  front.position.z = D / 2 - t;
  g.add(front);
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry((() => {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0);
    s.lineTo(W / 2, 0);
    s.lineTo(W / 2, H);
    s.lineTo(0, H + 0.055);
    s.lineTo(-W / 2, H);
    return s;
  })(), { depth: t, bevelEnabled: false }), wm);
  back.position.z = -D / 2;
  g.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(t, H, D), wm);
    side.position.set((sx * (W - t)) / 2, H / 2, 0);
    g.add(side);
    // крыша
    const roofLen = Math.hypot(W / 2, 0.055) + 0.02;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(roofLen, 0.01, D + 0.03), darkWoodMat());
    roof.position.set((sx * W) / 4, H + 0.03, 0);
    roof.rotation.z = -sx * Math.atan2(0.055, W / 2);
    g.add(roof);
  }
  const nest = nestFluff(0.05);
  nest.position.set(0, 0, -0.01);
  g.add(nest);
  shadowed(g);
  return {
    group: g,
    anchors: { approach: new THREE.Vector3(0.02, 0, D / 2 + 0.09), inside: new THREE.Vector3(0, 0.004, -0.01), radius: 0.11, sleep: true },
    nest,
  };
}

function houseWigwam(): BuiltItem {
  const g = new THREE.Group();
  const tex = fabricTexture('#e7b8a8', '#f6e6d8', 'stripe');
  const m = mat('wigwam', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.19, 24, 1, true, Math.PI * 0.5 + 0.5, Math.PI * 2 - 1.0), m);
  cone.position.y = 0.095;
  g.add(cone);
  for (let i = 0; i < 4; i++) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25, 6), darkWoodMat());
    const a = (i / 4) * Math.PI * 2 + 0.4;
    stick.position.set(Math.cos(a) * 0.045, 0.12, Math.sin(a) * 0.045);
    stick.lookAt(0, 0.4, 0);
    stick.rotateX(Math.PI / 2);
    g.add(stick);
  }
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8), mat('pillow', () => new THREE.MeshStandardMaterial({ color: '#efe3d2', roughness: 1 })));
  pillow.scale.set(1, 0.18, 1);
  pillow.position.y = 0.008;
  g.add(pillow);
  const nest = nestFluff(0.05);
  nest.position.y = 0.012;
  g.add(nest);
  shadowed(g);
  return {
    group: g,
    anchors: { approach: new THREE.Vector3(0, 0, 0.17), inside: new THREE.Vector3(0, 0.016, -0.005), radius: 0.11, sleep: true },
    nest,
  };
}

function housePumpkin(): BuiltItem {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.1, 32, 18, Math.PI * 0.5 + 0.55, Math.PI * 2 - 1.1);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + Math.cos(a * 10) * 0.05;
    p.setX(i, x * k);
    p.setZ(i, z * k);
    p.setY(i, p.getY(i) * 0.82);
  }
  geo.computeVertexNormals();
  const m = mat('pumpkin', () => new THREE.MeshStandardMaterial({ color: '#e58a3a', roughness: 0.85, side: THREE.DoubleSide }));
  const shell = new THREE.Mesh(geo, m);
  shell.position.y = 0.075;
  g.add(shell);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.035, 8), mat('stem', () => new THREE.MeshStandardMaterial({ color: '#5b7a3a', roughness: 0.8 })));
  stem.position.y = 0.165;
  stem.rotation.z = 0.25;
  g.add(stem);
  const nest = nestFluff(0.05);
  g.add(nest);
  shadowed(g);
  return {
    group: g,
    anchors: { approach: new THREE.Vector3(0, 0, 0.17), inside: new THREE.Vector3(0, 0.004, -0.01), radius: 0.11, sleep: true },
    nest,
  };
}

function houseNest(): BuiltItem {
  const g = new THREE.Group();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.07 + Math.sin(t * Math.PI * 0.5) * 0.045, t * 0.065));
  }
  pts.push(new THREE.Vector2(0.11, 0.07));
  const basket = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat('wicker', () => new THREE.MeshStandardMaterial({ map: fabricTexture('#c79a62', '#a87a45', 'check'), roughness: 0.9, side: THREE.DoubleSide })));
  g.add(basket);
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), mat('wicker', () => new THREE.MeshStandardMaterial({ color: '#b78a55' })));
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.002;
  g.add(base);
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 10), mat('cushion', () => new THREE.MeshStandardMaterial({ map: fabricTexture('#b9d3c8', '#a3c2b5', 'plush'), roughness: 1 })));
  cushion.scale.set(1, 0.22, 1);
  cushion.position.y = 0.022;
  g.add(cushion);
  const nest = nestFluff(0.06);
  nest.position.y = 0.03;
  g.add(nest);
  shadowed(g);
  return {
    group: g,
    anchors: { approach: new THREE.Vector3(0, 0, 0.16), inside: new THREE.Vector3(0, 0.04, 0), radius: 0.12, sleep: true },
    nest,
  };
}

// ---------------------------------------------------------------- Гамаки

function sagSheet(w: number, d: number, sag: number, tex: THREE.Texture, triangle = false): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, d, 12, 10);
  geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    const z = p.getZ(i);
    if (triangle) {
      // сужаем к переднему краю → треугольник
      const k = 1 - (z + d / 2) / d;
      x *= Math.max(0.05, k);
      p.setX(i, x);
    }
    const nx = (x / (w / 2)) ** 2;
    const nz = (z / (d / 2)) ** 2;
    p.setY(i, -sag * (1 - nx) * (1 - nz * 0.6));
  }
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, m);
  return mesh;
}

function cords(points: [THREE.Vector3, THREE.Vector3][]): THREE.LineSegments {
  const arr: number[] = [];
  for (const [a, b] of points) arr.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return new THREE.LineSegments(g, mat('cord', () => new THREE.LineBasicMaterial({ color: '#8c7a6a' })));
}

function hammock(variant: string): BuiltItem {
  const g = new THREE.Group();
  const drop = 0.13;
  if (variant === 'corner') {
    const sheet = sagSheet(0.24, 0.2, 0.035, fabricTexture('#c7a6d8', '#b693cc', 'plush'), true);
    sheet.position.y = -drop;
    g.add(sheet);
    g.add(cords([
      [new THREE.Vector3(-0.12, -drop, -0.1), new THREE.Vector3(-0.12, 0, -0.1)],
      [new THREE.Vector3(0.12, -drop, -0.1), new THREE.Vector3(0.12, 0, -0.1)],
      [new THREE.Vector3(0, -drop, 0.1), new THREE.Vector3(0, 0, 0.1)],
    ]));
    shadowed(sheet);
    return { group: g, anchors: { approach: new THREE.Vector3(0, -drop, -0.09), inside: new THREE.Vector3(0, -drop - 0.03, -0.04), radius: 0, hangDrop: drop, sleep: true } };
  }
  const tex = variant === 'double' ? fabricTexture('#9ec5d8', '#f2efe6', 'stripe') : fabricTexture('#e9a8a0', '#f4e3d0', 'check');
  const levels = variant === 'double' ? [0.11, 0.23] : [drop];
  for (const lv of levels) {
    const sheet = sagSheet(0.22, 0.16, 0.04, tex);
    sheet.position.y = -lv;
    g.add(sheet);
    shadowed(sheet);
  }
  const deepest = levels[levels.length - 1];
  g.add(cords([
    [new THREE.Vector3(-0.11, -deepest, -0.08), new THREE.Vector3(-0.11, 0, -0.08)],
    [new THREE.Vector3(0.11, -deepest, -0.08), new THREE.Vector3(0.11, 0, -0.08)],
    [new THREE.Vector3(-0.11, -deepest, 0.08), new THREE.Vector3(-0.11, 0, 0.08)],
    [new THREE.Vector3(0.11, -deepest, 0.08), new THREE.Vector3(0.11, 0, 0.08)],
  ]));
  const top = levels[0];
  return {
    group: g,
    anchors: {
      approach: new THREE.Vector3(0, -top, -0.08),
      inside: new THREE.Vector3(0, -top - 0.035, 0),
      inside2: levels.length > 1 ? new THREE.Vector3(0, -levels[1] - 0.035, 0) : undefined,
      radius: 0,
      hangDrop: top,
      sleep: true,
    },
  };
}

// ---------------------------------------------------------------- Туннели

function tunnel(variant: string): BuiltItem {
  const g = new THREE.Group();
  const L = 0.3;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-L / 2, 0.04, 0),
    new THREE.Vector3(-L / 6, 0.04, 0.025),
    new THREE.Vector3(L / 6, 0.04, -0.02),
    new THREE.Vector3(L / 2, 0.04, 0),
  ]);
  const path = curve.getPoints(10).map((p) => new THREE.Vector3(p.x, 0, p.z));
  if (variant === 'bridge') {
    const slats = 13;
    const wm = woodMat();
    for (let i = 0; i < slats; i++) {
      const t = i / (slats - 1);
      const a = Math.PI * t;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.11), wm);
      s.position.set(-Math.cos(a) * 0.13, Math.sin(a) * 0.09 + 0.004, 0);
      s.rotation.z = -(a - Math.PI / 2);
      g.add(s);
    }
    const straight = [new THREE.Vector3(-0.16, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.16, 0, 0)];
    shadowed(g);
    return { group: g, anchors: { approach: new THREE.Vector3(-0.2, 0, 0), exit: new THREE.Vector3(0.2, 0, 0), path: straight, radius: 0.08, sleep: false } };
  }
  const geo = new THREE.TubeGeometry(curve, 24, 0.042, 16, false);
  if (variant === 'fabric') {
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const wob = 1 + Math.sin(p.getX(i) * 90) * 0.04;
      p.setY(i, 0.04 + (p.getY(i) - 0.04) * wob);
      p.setZ(i, p.getZ(i) * wob);
    }
    geo.computeVertexNormals();
  }
  const m =
    variant === 'clear'
      ? mat('tube_clear', () => new THREE.MeshStandardMaterial({ color: '#cfe8f0', transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false }))
      : mat('tube_fabric', () => new THREE.MeshStandardMaterial({ map: fabricTexture('#8fb38a', '#a9c7a2', 'stripe'), roughness: 0.95, side: THREE.DoubleSide }));
  const mesh = new THREE.Mesh(geo, m);
  g.add(mesh);
  if (variant !== 'clear') shadowed(g);
  else {
    // ободки на концах
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.003, 6, 20), mat('ring', () => new THREE.MeshStandardMaterial({ color: '#9ab9c4', roughness: 0.3 })));
      ring.position.set((sx * L) / 2, 0.04, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
    }
  }
  return { group: g, anchors: { approach: new THREE.Vector3(-L / 2 - 0.06, 0, 0), exit: new THREE.Vector3(L / 2 + 0.06, 0, 0), path, radius: 0.08, sleep: false } };
}

// ---------------------------------------------------------------- Игрушки

function ball(): BuiltItem {
  const g = new THREE.Group();
  const tex = fabricTexture('#e8c46a', '#d79f4a', 'check');
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.024, 2), mat('ball', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, flatShading: true })));
  m.position.y = 0.024;
  m.castShadow = true;
  g.add(m);
  return { group: g, ball: m, anchors: { approach: new THREE.Vector3(0, 0, 0.07), radius: 0.03, sleep: false } };
}

function forage(): BuiltItem {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.065, 0.1), woodMat());
  box.position.y = 0.0325;
  g.add(box);
  const holeMat = mat('hole', () => new THREE.MeshBasicMaterial({ color: '#3a2a1c' }));
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const h = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), holeMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(-0.04 + i * 0.04, 0.0655, -0.022 + j * 0.044);
      g.add(h);
    }
  }
  for (let i = 0; i < 3; i++) {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), holeMat);
    h.position.set(-0.04 + i * 0.04, 0.03, 0.0505);
    g.add(h);
  }
  shadowed(g);
  return { group: g, anchors: { approach: new THREE.Vector3(0, 0, 0.11), radius: 0.09, sleep: false } };
}

function wheel(): BuiltItem {
  const g = new THREE.Group();
  const R = 0.15;
  const cy = R + 0.03;
  const spinner = new THREE.Group();
  spinner.position.y = cy;
  const track = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.085, 40, 1, true), mat('wheel_track', () => new THREE.MeshStandardMaterial({ color: '#cfe3df', roughness: 0.55, side: THREE.DoubleSide })));
  track.rotation.x = Math.PI / 2;
  spinner.add(track);
  const back = new THREE.Mesh(new THREE.CircleGeometry(R, 40), mat('wheel_back', () => new THREE.MeshStandardMaterial({ color: '#9fc8c0', roughness: 0.5, side: THREE.DoubleSide })));
  back.position.z = -0.0425;
  spinner.add(back);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.008, R * 1.9, 0.004), mat('spoke', () => new THREE.MeshStandardMaterial({ color: '#7fb2a8' })));
    spoke.rotation.z = (i / 6) * Math.PI;
    spoke.position.z = -0.04;
    spinner.add(spoke);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.006, 8, 40), mat('rim', () => new THREE.MeshStandardMaterial({ color: '#7fb2a8', roughness: 0.4 })));
  rim.position.z = 0.0425;
  spinner.add(rim);
  g.add(spinner);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.02, cy, 0.02), mat('stand', () => new THREE.MeshStandardMaterial({ color: '#6d9c93' })));
  stand.position.set(0, cy / 2, -0.06);
  g.add(stand);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.05), mat('stand', () => new THREE.MeshStandardMaterial({ color: '#6d9c93' })));
  foot.position.set(0, 0.006, -0.06);
  g.add(foot);
  shadowed(g);
  return { group: g, spinner, anchors: { approach: new THREE.Vector3(0, 0, 0.12), inside: new THREE.Vector3(0, 0.032, 0), radius: 0.12, sleep: false } };
}

function rope(isLadder: boolean): BuiltItem {
  const g = new THREE.Group();
  // слот под крышей: y=0 — точка крепления. Длина до пола задаётся при размещении (масштаб)
  const len = 1;
  const ropeMat = mat('rope', () => new THREE.MeshStandardMaterial({ map: fabricTexture('#cdb28a', '#b0915f', 'stripe'), roughness: 1 }));
  if (!isLadder) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, len, 8), ropeMat);
    r.position.y = -len / 2;
    r.name = 'stretch';
    g.add(r);
  } else {
    const holder = new THREE.Group();
    holder.name = 'stretch';
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 6), ropeMat);
      r.position.set(sx * 0.04, -len / 2, 0);
      holder.add(r);
    }
    for (let i = 1; i < 10; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.085, 6), woodMat());
      rung.rotation.z = Math.PI / 2;
      rung.position.y = -i * 0.1;
      holder.add(rung);
    }
    g.add(holder);
  }
  shadowed(g);
  return { group: g, anchors: { approach: new THREE.Vector3(0, 0, 0.05), top: new THREE.Vector3(0, -0.1, 0), radius: 0, hangDrop: 0.1, sleep: false } };
}

function bowl(variant: string): BuiltItem {
  const g = new THREE.Group();
  const ceramic = variant === 'ceramic';
  const R = ceramic ? 0.06 : 0.052;
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(R * 0.8, 0), new THREE.Vector2(R, 0.03), new THREE.Vector2(R * 1.05, 0.034), new THREE.Vector2(R * 0.85, 0.034), new THREE.Vector2(R * 0.65, 0.008), new THREE.Vector2(0, 0.008)];
  const m = ceramic
    ? mat('bowl_c', () => new THREE.MeshStandardMaterial({ color: '#8fb3c9', roughness: 0.25 }))
    : mat('bowl_p', () => new THREE.MeshStandardMaterial({ color: '#f0a7a0', roughness: 0.45 }));
  const b = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), m);
  g.add(b);
  // горка корма
  const mound = new THREE.Group();
  const pelletGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.009, 6);
  const pelletMat = mat('pellet', () => new THREE.MeshStandardMaterial({ color: '#c89f62', roughness: 0.9 }));
  const n = 46;
  const inst = new THREE.InstancedMesh(pelletGeo, pelletMat, n);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * R * 0.72;
    tmp.position.set(Math.cos(a) * r, 0.012 + (1 - r / R) * 0.016 + Math.random() * 0.004, Math.sin(a) * r);
    tmp.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    tmp.updateMatrix();
    inst.setMatrixAt(i, tmp.matrix);
  }
  mound.add(inst);
  g.add(mound);
  shadowed(g);
  return { group: g, foodMound: mound, anchors: { approach: new THREE.Vector3(0, 0, R + 0.07), radius: R + 0.02, sleep: false } };
}

export function buildItem(kind: ItemKind, variant: string): BuiltItem {
  switch (kind) {
    case 'house':
      if (variant === 'wigwam') return houseWigwam();
      if (variant === 'pumpkin') return housePumpkin();
      if (variant === 'nest') return houseNest();
      return houseWood();
    case 'hammock':
    case 'hammock2':
      return hammock(variant);
    case 'tunnel':
      return tunnel(variant);
    case 'ball':
      return ball();
    case 'forage':
      return forage();
    case 'wheel':
      return wheel();
    case 'rope':
      return rope(false);
    case 'ladder':
      return rope(true);
    case 'bowl':
      return bowl(variant);
  }
}

/** Поилка (на левой стенке) */
export function buildBottle(glass: boolean): { group: THREE.Group; water: THREE.Mesh } {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.16, 20, 1, true),
    glass
      ? new THREE.MeshStandardMaterial({ color: '#e8f4f6', transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: '#d6ecf2', transparent: true, opacity: 0.45, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  );
  body.position.y = 0.12;
  g.add(body);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 16), new THREE.MeshStandardMaterial({ color: '#8cc6dc', transparent: true, opacity: 0.55, roughness: 0.1 }));
  water.position.y = 0.05;
  g.add(water);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.02, 20), new THREE.MeshStandardMaterial({ color: glass ? '#9aa3a8' : '#e8939a', roughness: 0.4, metalness: glass ? 0.6 : 0 }));
  cap.position.y = 0.04;
  g.add(cap);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.07, 10), new THREE.MeshStandardMaterial({ color: '#b9c0c4', metalness: 0.8, roughness: 0.3 }));
  nozzle.position.set(0.026, 0.018, 0.0);
  nozzle.rotation.z = 0.9;
  g.add(nozzle);
  return { group: g, water };
}
