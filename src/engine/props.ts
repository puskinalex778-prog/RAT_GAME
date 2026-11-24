import * as THREE from 'three';
import { featherTexture } from './textures';

/** Стилизованная рука игрока (угощение, поглаживание) */
export function buildHand(): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#f2c6a8', roughness: 0.62, emissive: '#6a2a1a', emissiveIntensity: 0.06 });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skin);
  palm.scale.set(0.042, 0.016, 0.05);
  g.add(palm);
  const fingerLen = [0.05, 0.058, 0.055, 0.045];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, fingerLen[i], 4, 8), skin);
    f.rotation.x = Math.PI / 2 - 0.15;
    f.position.set(-0.027 + i * 0.018, -0.004, 0.05 + fingerLen[i] / 2);
    g.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.04, 4, 8), skin);
  thumb.rotation.set(Math.PI / 2, 0, 0.9);
  thumb.position.set(0.045, -0.002, 0.02);
  g.add(thumb);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.2, 16), new THREE.MeshStandardMaterial({ color: '#b8c9d8', roughness: 0.95 }));
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.z = -0.13;
  g.add(sleeve);
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
  g.visible = false;
  return g;
}

/** Игрушка-удочка с пёрышком */
export function buildFeatherToy(): { group: THREE.Group; feather: THREE.Object3D; string: THREE.Line } {
  const g = new THREE.Group();
  const feather = new THREE.Group();
  const tex = featherTexture();
  const fm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 1 });
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.1), fm);
    p.rotation.y = i * Math.PI * 0.5;
    p.position.y = 0.05;
    feather.add(p);
  }
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: '#e67a8a' }));
  feather.add(bead);
  g.add(feather);
  const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
  const string = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: '#7a6a5a' }));
  g.add(string);
  g.visible = false;
  return { group: g, feather, string };
}

export function buildPlayBall(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 2), new THREE.MeshStandardMaterial({ color: '#f0b45a', roughness: 0.6, flatShading: true }));
  m.castShadow = true;
  m.visible = false;
  return m;
}

/** Кольцо для трюка «Через кольцо» */
export function buildHoop(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 10, 36), new THREE.MeshStandardMaterial({ color: '#e66b7d', roughness: 0.4 }));
  ring.position.y = 0.075;
  g.add(ring);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 6), new THREE.MeshStandardMaterial({ color: '#c9a46a' }));
  stand.position.y = 0.01;
  g.add(stand);
  g.visible = false;
  return g;
}

/** Угощение, лежащее в руке */
export function buildTreatPiece(color: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.008, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  m.castShadow = true;
  return m;
}
