import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Room } from './Room';
import { World } from '../ai/World';
import { RatModel } from '../rats/RatModel';
import { applyAnim, type AnimName } from '../ai/anims';
import { getGame, useGame } from '../store/gameStore';
import { themeDef } from '../store/data/items';
import { bus } from '../store/bus';
import type { Appearance } from '../store/types';
import { fabricTexture } from './textures';

export type CamMode = 'overview' | 'pet' | 'follow' | 'photo' | 'intro' | 'showcase' | 'play';

export type PickResult = { type: 'rat'; id: string } | { type: 'slot'; id: string } | { type: 'plaque' } | null;

interface Shot {
  t: number;
  pos: [number, number, number];
  target: [number, number, number];
}

const INTRO: Shot[] = [
  { t: 0, pos: [-2.2, 1.5, 2.2], target: [-1.2, 0.9, -2.4] },
  { t: 6, pos: [-1.2, 0.9, 1.9], target: [-0.3, 0.25, 0] },
  { t: 12, pos: [0.3, 0.35, 1.1], target: [0, 0.15, 0] },
  { t: 18, pos: [-0.25, 0.5, 0.75], target: [0.1, 0.55, -0.15] },
  { t: 24, pos: [0.5, 1.0, 1.1], target: [0.55, 1.13, -2.79] },
  { t: 31, pos: [0.55, 1.13, -1.7], target: [0.55, 1.13, -2.79] },
];
export const INTRO_DURATION = 31;

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly room = new Room();
  readonly world: World;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  camMode: CamMode = 'overview';
  followId: string | null = null;
  private frameSubs = new Set<(dt: number) => void>();
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private introT = -1;
  private introDone: (() => void) | null = null;
  private preview: RatModel | null = null;
  private previewGroup = new THREE.Group();
  private previewT = 0;
  private previewAnim: AnimName = 'idle';
  private camGoal: { pos: THREE.Vector3; target: THREE.Vector3; t: number } | null = null;
  private simAcc = 0;
  private decorMode = false;
  fps = 60;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 30);
    this.camera.position.set(0.2, 0.75, 1.75);

    this.scene.background = new THREE.Color('#e8dccb');
    this.hemi = new THREE.HemisphereLight('#fff2df', '#8a6e58', 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.3);
    this.sun.position.set(-1.6, 2.6, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -1.1;
    this.sun.shadow.camera.right = 1.1;
    this.sun.shadow.camera.top = 1.2;
    this.sun.shadow.camera.bottom = -1.0;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 6;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.01;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const fill = new THREE.DirectionalLight('#ffd9b0', 0.45);
    fill.position.set(1.5, 1.2, 2);
    this.scene.add(fill);

    this.scene.add(this.room.group);
    this.world = new World();
    this.scene.add(this.world.group);
    this.buildPreviewStage();
    this.scene.add(this.previewGroup);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.setCamMode('overview', null, true);

    this.applyTheme();
    this.applyQuality();
    bus.on('themeChanged', () => this.applyTheme());
    let q = getGame().settings.quality;
    let sh = getGame().settings.shellFur;
    useGame.subscribe((s) => {
      if (s.settings.quality !== q || s.settings.shellFur !== sh) {
        q = s.settings.quality;
        sh = s.settings.shellFur;
        this.applyQuality();
      }
    });

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  // ------------------------------------------------------------------ настройки

  applyTheme() {
    const t = themeDef(getGame().theme);
    this.room.applyTheme(t);
    this.hemi.color.set(t.light).lerp(new THREE.Color('#ffffff'), 0.5);
  }

  applyQuality() {
    const s = getGame().settings;
    const dpr = window.devicePixelRatio || 1;
    const pr = s.quality === 'low' ? Math.min(dpr, 1) : s.quality === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
    this.renderer.setPixelRatio(pr);
    const size = s.quality === 'low' ? 512 : s.quality === 'medium' ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    const shadows = s.quality !== 'low';
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
        else if (m) m.needsUpdate = true;
      });
    }
    this.world.setShell(s.shellFur && s.quality !== 'low');
    this.preview?.setShellEnabled(s.shellFur && s.quality !== 'low');
    this.resize();
  }

  resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 55 : 42;
    this.camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------------ цикл

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  onFrame(cb: (dt: number) => void): () => void {
    this.frameSubs.add(cb);
    return () => this.frameSubs.delete(cb);
  }

  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    // симуляция стора раз в секунду
    this.simAcc += dt;
    if (this.simAcc >= 1) {
      if (getGame().started) getGame().tick(this.simAcc * 1000);
      this.simAcc = 0;
    }
    this.world.cameraPos.copy(this.camera.position);
    this.world.update(dt);
    this.updatePreview(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    for (const cb of this.frameSubs) cb(dt);
  }

  // ------------------------------------------------------------------ камера

  setCamMode(mode: CamMode, ratId: string | null = null, instant = false) {
    this.camMode = mode;
    this.followId = ratId;
    const c = this.controls;
    const L = this.world.cage.layout;
    c.enabled = mode !== 'intro';
    c.enableRotate = true;
    c.enableZoom = true;
    c.minPolarAngle = 0.15;
    c.maxPolarAngle = Math.PI / 2 - 0.02;
    let pos: THREE.Vector3;
    let target: THREE.Vector3;
    switch (mode) {
      case 'overview':
        c.minDistance = 0.5;
        c.maxDistance = 2.6;
        target = new THREE.Vector3(0, L.h * 0.36, 0);
        pos = new THREE.Vector3(0.2, L.h * 0.8, L.d / 2 + 1.12);
        break;
      case 'pet':
        c.minDistance = 0.3;
        c.maxDistance = 1.3;
        c.minPolarAngle = Math.PI / 2 - 0.55;
        c.maxPolarAngle = Math.PI / 2 + 0.05;
        target = new THREE.Vector3(0, 0.06, 0.08);
        pos = new THREE.Vector3(0.08, 0.2, L.d / 2 + 0.5);
        break;
      case 'play':
        c.minDistance = 0.4;
        c.maxDistance = 1.6;
        target = new THREE.Vector3(0, 0.02, 0.02);
        pos = new THREE.Vector3(0, 0.62, L.d / 2 + 0.62);
        break;
      case 'follow': {
        c.minDistance = 0.22;
        c.maxDistance = 1.2;
        const a = this.world.agent(ratId);
        target = a ? a.pos.clone().setY(a.pos.y + 0.05) : new THREE.Vector3(0, 0.05, 0);
        const off = this.camera.position.clone().sub(c.target).setLength(0.55);
        if (off.y < 0.15) off.y = 0.2;
        pos = target.clone().add(off);
        break;
      }
      case 'photo':
        c.minDistance = 0.15;
        c.maxDistance = 3.2;
        c.minPolarAngle = 0.05;
        c.maxPolarAngle = Math.PI / 2 + 0.1;
        target = c.target.clone();
        pos = this.camera.position.clone();
        if (ratId) {
          const a = this.world.agent(ratId);
          if (a) {
            target = a.pos.clone().setY(a.pos.y + 0.05);
            pos = target.clone().add(new THREE.Vector3(0.12, 0.12, 0.42));
          }
        }
        break;
      case 'showcase':
        c.minDistance = 0.25;
        c.maxDistance = 0.9;
        {
          // крыска в левой части кадра (справа — панель конструктора)
          const narrow = this.camera.aspect < 1;
          target = this.previewGroup.position.clone().add(new THREE.Vector3(narrow ? 0 : 0.11, narrow ? -0.02 : 0.05, 0));
          pos = target.clone().add(new THREE.Vector3(0.05, 0.17, 0.46));
        }
        break;
      default:
        target = c.target.clone();
        pos = this.camera.position.clone();
    }
    if (instant) {
      c.target.copy(target);
      this.camera.position.copy(pos);
      this.camGoal = null;
      c.update();
    } else {
      this.camGoal = { pos, target, t: 0 };
    }
  }

  private updateCamera(dt: number) {
    const c = this.controls;
    if (this.camMode === 'intro' && this.introT >= 0) {
      this.introT += dt;
      const t = Math.min(INTRO_DURATION, this.introT);
      let i = 0;
      while (i < INTRO.length - 2 && INTRO[i + 1].t < t) i++;
      const a = INTRO[i];
      const b = INTRO[i + 1];
      const k = smooth(Math.min(1, (t - a.t) / (b.t - a.t)));
      this.camera.position.set(...a.pos).lerp(new THREE.Vector3(...b.pos), k);
      c.target.set(...a.target).lerp(new THREE.Vector3(...b.target), k);
      this.camera.lookAt(c.target);
      if (this.introT >= INTRO_DURATION) this.finishIntro();
      return;
    }
    if (this.camGoal) {
      this.camGoal.t += dt;
      const k = 1 - Math.exp(-dt * 4);
      this.camera.position.lerp(this.camGoal.pos, k);
      c.target.lerp(this.camGoal.target, k);
      if (this.camGoal.t > 1.4) this.camGoal = null;
    }
    if (this.camMode === 'follow' || (this.camMode === 'photo' && this.followId && !this.camGoal)) {
      const a = this.world.agent(this.followId);
      if (a && this.camMode === 'follow') {
        const tgt = a.model.bodyCenterWorld(new THREE.Vector3());
        const delta = tgt.sub(c.target).multiplyScalar(1 - Math.exp(-dt * 3));
        c.target.add(delta);
        this.camera.position.add(delta);
      }
    }
    // не опускать камеру ниже пола комнаты
    if (this.camera.position.y < this.room.floorY + 0.1) this.camera.position.y = this.room.floorY + 0.1;
    c.update();
  }

  // ------------------------------------------------------------------ вступление

  playIntro(onDone: () => void) {
    this.camMode = 'intro';
    this.controls.enabled = false;
    this.introT = 0;
    this.introDone = onDone;
  }

  get introTime(): number {
    return this.introT;
  }

  skipIntro() {
    this.finishIntro();
  }

  private finishIntro() {
    if (this.introT < 0) return;
    this.introT = -1;
    const cb = this.introDone;
    this.introDone = null;
    this.setCamMode('overview', null, true);
    cb?.();
  }

  // ------------------------------------------------------------------ знакомство (предпросмотр)

  private buildPreviewStage() {
    this.previewGroup.position.set(0.74, -0.04, 0.12);
    const blanket = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), new THREE.MeshStandardMaterial({ map: fabricTexture('#e9c4c0', '#f6e7e2', 'check'), roughness: 1 }));
    blanket.rotation.x = -Math.PI / 2;
    blanket.position.y = 0.002;
    blanket.receiveShadow = true;
    this.previewGroup.add(blanket);
    // переноска
    const carrier = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.26), new THREE.MeshStandardMaterial({ color: '#a9cfc4', roughness: 0.5 }));
    shell.position.y = 0.07;
    carrier.add(shell);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#e9e5de', metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0.6 }));
    door.position.set(0, 0.07, 0.131);
    carrier.add(door);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#7fb2a8' }));
    handle.position.y = 0.14;
    carrier.add(handle);
    carrier.position.set(0.05, 0, -0.27);
    carrier.rotation.y = -0.4;
    carrier.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
    this.previewGroup.add(carrier);
    this.previewGroup.visible = false;
  }

  showPreview(a: Appearance, scale: number) {
    const s = getGame().settings;
    if (!this.preview) {
      this.preview = new RatModel(a, s.shellFur && s.quality !== 'low');
      this.previewGroup.add(this.preview.group);
      this.scene.add(this.preview.tail);
      this.preview.group.rotation.y = 0.5;
    } else {
      this.preview.setAppearance(a);
    }
    this.preview.setScale(scale);
    this.previewGroup.visible = true;
    this.preview.setVisible(true);
  }

  hidePreview() {
    this.previewGroup.visible = false;
    if (this.preview) {
      this.preview.dispose();
      this.preview = null;
    }
  }

  private updatePreview(dt: number) {
    if (!this.preview || !this.previewGroup.visible) return;
    this.previewT += dt;
    const cycle: AnimName[] = ['idle', 'sniff', 'rear', 'idle', 'wash', 'listen'];
    const slot = Math.floor(this.previewT / 3.2) % cycle.length;
    if (cycle[slot] !== this.previewAnim) this.previewAnim = cycle[slot];
    const local = this.camera.position.clone();
    this.preview.group.worldToLocal(local);
    const look = Math.max(-1, Math.min(1, Math.atan2(local.x, local.z)));
    applyAnim(this.preview.target, this.previewAnim, this.previewT % 3.2, 1, false, look);
    this.preview.tailFloorY = this.previewGroup.position.y;
    this.preview.update(dt);
  }

  // ------------------------------------------------------------------ выбор касанием

  private setRay(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  pick(clientX: number, clientY: number): PickResult {
    this.setRay(clientX, clientY);
    if (this.decorMode) {
      const hits = this.ray.intersectObjects(this.world.cage.slotMarkers, false);
      if (hits.length) return { type: 'slot', id: hits[0].object.userData.slotId as string };
    }
    const picks = this.world.agents.map((a) => a.model.pick);
    const hits = this.ray.intersectObjects(picks, false);
    if (hits.length) {
      const a = this.world.agents.find((x) => x.model.pick === hits[0].object);
      if (a) return { type: 'rat', id: a.id };
    }
    const ph = this.ray.intersectObject(this.room.plaque, false);
    if (ph.length) return { type: 'plaque' };
    return null;
  }

  /** Точка на поверхности выбранной крысы (для поглаживания) */
  pickOnRat(clientX: number, clientY: number, ratId: string): THREE.Vector3 | null {
    const a = this.world.agent(ratId);
    if (!a) return null;
    this.setRay(clientX, clientY);
    const hits = this.ray.intersectObject(a.model.pick, false);
    return hits.length ? hits[0].point.clone() : null;
  }

  /** Точка на полу клетки */
  pickFloor(clientX: number, clientY: number): THREE.Vector3 | null {
    this.setRay(clientX, clientY);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(plane, p) ? p : null;
  }

  setDecorMode(on: boolean) {
    this.decorMode = on;
    this.world.cage.setDecorMode(on);
  }

  /** Экранные координаты точки над головой крысы */
  ratScreenPos(id: string, out: { x: number; y: number; visible: boolean }) {
    const a = this.world.agent(id);
    if (!a) {
      out.visible = false;
      return out;
    }
    const p = a.model.headWorld(new THREE.Vector3()).add(new THREE.Vector3(0, 0.07 * a.model.scaleValue + 0.02, 0));
    p.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    out.x = (p.x * 0.5 + 0.5) * r.width + r.left;
    out.y = (-p.y * 0.5 + 0.5) * r.height + r.top;
    out.visible = p.z < 1 && p.z > -1;
    return out;
  }

  // ------------------------------------------------------------------ фото

  capture(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/jpeg', 0.92);
  }

  /** Маленькая превью-картинка для альбома */
  static thumb(dataUrl: string, w = 360): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        const k = w / img.width;
        cv.width = w;
        cv.height = Math.round(img.height * k);
        cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
