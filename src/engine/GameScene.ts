import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  CameraMode,
  HabitatId,
  InteractionMode,
  PlacedItem,
  ProjectedRatLabel,
  RatAppearance,
  RatEntity,
  RoomThemeId,
  TrickId,
} from '../types/game';
import { RatModel } from '../rats/RatModel';
import { BEHAVIOR_LABELS, RatAIAgent } from '../ai/RatAI';
import { CageBuilder } from '../cage/CageBuilder';
import { ROOM_THEMES } from '../cage/catalog';
import { soundEngine } from '../audio/SoundEngine';

export interface SceneCallbacks {
  onRatTapped: (ratId: string, alreadySelected: boolean) => void;
  onSlotTapped: (slotId: string) => void;
  onPlaqueTapped: () => void;
  onPetProgress: (ratId: string, screenX: number, screenY: number) => void;
  onPlayProgress: (ratId: string, screenX: number, screenY: number) => void;
  onLabelsUpdate: (labels: ProjectedRatLabel[]) => void;
}

export class GameScene {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private hemiLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;
  private lampLight: THREE.PointLight;

  private cageBuilder: CageBuilder;
  private ratModels = new Map<string, RatModel>();
  private ratAgents = new Map<string, RatAIAgent>();
  private latestRats: RatEntity[] = [];

  // Intro preview rat
  private introMode = false;
  private introRatModel: RatModel | null = null;
  private introElapsed = 0;

  // Interactive toy visual (feather/ball wand on floor plane)
  private toyWandMesh: THREE.Group;
  private toyTarget: THREE.Vector3 | null = null;
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);

  // State mirrors
  private selectedRatId: string | null = null;
  private cameraMode: CameraMode = 'overview';
  private interactionMode: InteractionMode = 'none';
  private hasSecondFloor = false;
  private currentHabitat: HabitatId | null = null;
  private currentTheme: RoomThemeId | null = null;
  private placedSignature = '';

  // Camera smooth lerping
  private desiredCamPos = new THREE.Vector3(0, 1.35, 3.05);
  private desiredTarget = new THREE.Vector3(0, 0.55, -0.1);
  private isTransitioningCam = false;

  // Pointer & Raycasting
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();
  private pointerDownPos = new THREE.Vector2();
  private isPointerDown = false;
  private lastPetEmit = 0;
  private lastPlayEmit = 0;

  // Loop
  private rafId = 0;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private labelAccum = 0;
  private disposed = false;

  // Bound event listeners
  private onResizeBound: () => void;
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(ROOM_THEMES.scandi.bgColor);
    this.scene.fog = new THREE.Fog(ROOM_THEMES.scandi.bgColor, 7.5, 16);

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.08, 35);
    this.camera.position.copy(this.desiredCamPos);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    // Warm cozy home lighting
    this.hemiLight = new THREE.HemisphereLight('#FFF8EC', '#C7B093', 0.92);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight('#FFF1DA', 1.45);
    this.dirLight.position.set(-3.2, 4.8, 3.4);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 14;
    this.dirLight.shadow.camera.left = -2.6;
    this.dirLight.shadow.camera.right = 2.6;
    this.dirLight.shadow.camera.top = 2.6;
    this.dirLight.shadow.camera.bottom = -2.0;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.lampLight = new THREE.PointLight('#FFCF8C', 1.35, 8, 1.6);
    this.lampLight.position.set(2.4, 1.75, -0.9);
    this.scene.add(this.lampLight);

    // Controls: 1-finger orbit, 2-finger pinch zoom with cozy damping
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.95;
    this.controls.maxDistance = 4.6;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minPolarAngle = 0.25;
    this.controls.target.copy(this.desiredTarget);

    // Room & Cage
    this.cageBuilder = new CageBuilder();
    this.scene.add(this.cageBuilder.roomGroup);
    this.scene.add(this.cageBuilder.cageGroup);
    this.scene.add(this.cageBuilder.furnitureGroup);
    this.scene.add(this.cageBuilder.slotMarkersGroup);

    // Interactive Play Toy visual (feather pom-pom wand)
    this.toyWandMesh = this.buildToyWandMesh();
    this.toyWandMesh.visible = false;
    this.scene.add(this.toyWandMesh);

    // Events
    this.onResizeBound = this.handleResize.bind(this);
    this.onPointerDownBound = this.handlePointerDown.bind(this);
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerUpBound = this.handlePointerUp.bind(this);

    window.addEventListener('resize', this.onResizeBound);
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDownBound);
    dom.addEventListener('pointermove', this.onPointerMoveBound);
    dom.addEventListener('pointerup', this.onPointerUpBound);
    dom.addEventListener('pointercancel', this.onPointerUpBound);

    this.animate();
  }

  private buildToyWandMesh(): THREE.Group {
    const g = new THREE.Group();
    const pom = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.06, 1),
      new THREE.MeshStandardMaterial({ color: '#E07A5F', roughness: 0.78 })
    );
    pom.position.y = 0.08;
    pom.castShadow = true;
    const feather1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: '#F2CC8F', roughness: 0.85 })
    );
    feather1.position.set(0.03, 0.14, 0);
    feather1.rotation.z = -0.4;
    const feather2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.022, 0.13, 8),
      new THREE.MeshStandardMaterial({ color: '#81B29A', roughness: 0.85 })
    );
    feather2.position.set(-0.03, 0.14, 0.02);
    feather2.rotation.z = 0.4;
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.45, 6),
      new THREE.MeshStandardMaterial({ color: '#C8A175' })
    );
    stick.position.set(0, 0.3, -0.05);
    stick.rotation.x = 0.25;
    g.add(pom, feather1, feather2, stick);
    return g;
  }

  public syncState(params: {
    introMode: boolean;
    introPreviewAppearance: RatAppearance;
    rats: RatEntity[];
    selectedRatId: string | null;
    habitat: HabitatId;
    theme: RoomThemeId;
    hasSecondFloor: boolean;
    placedItems: PlacedItem[];
    cameraMode: CameraMode;
    interactionMode: InteractionMode;
    decorateSelectedItemId: string | null;
  }) {
    this.introMode = params.introMode;
    this.latestRats = params.rats.filter((r) => r.alive);
    this.selectedRatId = params.selectedRatId;

    // Theme update
    if (this.currentTheme !== params.theme) {
      this.currentTheme = params.theme;
      this.cageBuilder.applyTheme(params.theme);
      const t = ROOM_THEMES[params.theme];
      this.scene.background = new THREE.Color(t.bgColor);
      if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.set(t.bgColor);
      }
      this.dirLight.color.set(t.lightColor);
      this.hemiLight.color.set(t.ambientColor);
    }

    // Cage rebuild if habitat or 2nd floor changed
    if (this.currentHabitat !== params.habitat || this.hasSecondFloor !== params.hasSecondFloor) {
      this.currentHabitat = params.habitat;
      this.hasSecondFloor = params.hasSecondFloor;
      this.cageBuilder.rebuildCage(params.habitat, params.hasSecondFloor);
      this.placedSignature = ''; // force furniture rebuild
    }

    // Furniture rebuild if placedItems changed
    const sig = JSON.stringify(params.placedItems) + '|' + params.hasSecondFloor;
    if (sig !== this.placedSignature) {
      this.placedSignature = sig;
      this.cageBuilder.rebuildFurniture(params.placedItems, params.hasSecondFloor);
    }

    // Intro preview rat vs live rats
    if (params.introMode) {
      if (!this.introRatModel) {
        this.introRatModel = new RatModel('intro_preview', params.introPreviewAppearance);
        this.introRatModel.root.position.set(0, 0.08, 0.12);
        this.scene.add(this.introRatModel.root);
      } else {
        this.introRatModel.updateAppearance(params.introPreviewAppearance);
      }
      this.introRatModel.root.visible = true;
    } else if (this.introRatModel) {
      this.introRatModel.root.visible = false;
    }

    // Sync live rat models & agents
    const activeIds = new Set(this.latestRats.map((r) => r.id));
    for (const [id, model] of this.ratModels.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(model.root);
        model.dispose();
        this.ratModels.delete(id);
        this.ratAgents.delete(id);
      }
    }

    for (const rat of this.latestRats) {
      if (!this.ratModels.has(rat.id)) {
        const model = new RatModel(rat.id, rat.appearance);
        const agent = new RatAIAgent(rat.id);
        model.root.position.copy(agent.position);
        this.scene.add(model.root);
        this.ratModels.set(rat.id, model);
        this.ratAgents.set(rat.id, agent);
      }
      const m = this.ratModels.get(rat.id)!;
      m.root.visible = !params.introMode;
    }

    // Camera mode transitions
    if (this.cameraMode !== params.cameraMode) {
      this.cameraMode = params.cameraMode;
      this.applyCameraModePreset(params.cameraMode);
    }

    // Interaction mode updates
    if (this.interactionMode !== params.interactionMode) {
      if (this.interactionMode === 'playing' || this.interactionMode === 'petting') {
        this.ratAgents.forEach((a) => a.stopInteractiveMode());
        this.toyTarget = null;
        this.toyWandMesh.visible = false;
      }
      this.interactionMode = params.interactionMode;
      if (params.interactionMode === 'playing' && params.selectedRatId) {
        const agent = this.ratAgents.get(params.selectedRatId);
        agent?.commandChaseToy();
      }
    }

    // Decorate mode slot markers
    const showDecorate = params.interactionMode === 'decorate' && !params.introMode;
    this.cageBuilder.slotMarkersGroup.visible = showDecorate;
    if (showDecorate) {
      this.cageBuilder.highlightSlotsForItem(params.decorateSelectedItemId);
    }

    // Disable OrbitControls drag while actively petting or dragging play wand
    this.controls.enabled =
      !params.introMode && params.interactionMode !== 'petting' && params.interactionMode !== 'playing';
  }

  private applyCameraModePreset(mode: CameraMode) {
    if (mode === 'overview') {
      this.desiredCamPos.set(0.0, 1.48, 3.25);
      this.desiredTarget.set(0.0, 0.72, -0.25);
      this.isTransitioningCam = true;
    } else if (mode === 'pet_level') {
      this.desiredCamPos.set(0.32, 0.42, 1.65);
      this.desiredTarget.set(0.0, 0.24, 0.0);
      this.isTransitioningCam = true;
    } else if (mode === 'follow') {
      this.isTransitioningCam = false;
    } else if (mode === 'photo') {
      if (this.selectedRatId) {
        const agent = this.ratAgents.get(this.selectedRatId);
        if (agent) {
          this.desiredTarget.copy(agent.position).add(new THREE.Vector3(0, 0.14, 0));
          this.desiredCamPos.copy(this.desiredTarget).add(new THREE.Vector3(0.45, 0.34, 1.05));
          this.isTransitioningCam = true;
        }
      }
    }
  }

  public focusOnRat(ratId: string) {
    const agent = this.ratAgents.get(ratId);
    if (!agent) return;
    this.desiredTarget.copy(agent.position).add(new THREE.Vector3(0, 0.14, 0));
    this.desiredCamPos.copy(this.desiredTarget).add(new THREE.Vector3(0.35, 0.38, 1.15));
    this.isTransitioningCam = true;
  }

  public commandCallRat(ratId: string, trust: number) {
    const agent = this.ratAgents.get(ratId);
    agent?.commandComeToPlayer(this.cageBuilder.bounds, trust);
  }

  public commandFeedRat(ratId: string) {
    const agent = this.ratAgents.get(ratId);
    agent?.commandGiveTreat(this.cageBuilder.bounds);
  }

  public commandRatTrick(ratId: string, trick: TrickId) {
    const agent = this.ratAgents.get(ratId);
    agent?.commandTrick(trick);
  }

  public capturePhotoDataUrl(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private handleResize() {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private updatePointerNDC(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerDown(e: PointerEvent) {
    soundEngine.unlock();
    this.isPointerDown = true;
    this.pointerDownPos.set(e.clientX, e.clientY);
    this.isTransitioningCam = false;
    this.updatePointerNDC(e);

    if (this.interactionMode === 'playing') {
      this.updateToyTargetFromPointer(e.clientX, e.clientY);
    } else if (this.interactionMode === 'petting') {
      this.tryPetAtPointer(e.clientX, e.clientY);
    }
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.isPointerDown) return;
    this.updatePointerNDC(e);

    if (this.interactionMode === 'playing') {
      this.updateToyTargetFromPointer(e.clientX, e.clientY);
    } else if (this.interactionMode === 'petting') {
      this.tryPetAtPointer(e.clientX, e.clientY);
    }
  }

  private handlePointerUp(e: PointerEvent) {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (moveDist > 12 || this.introMode) return; // was a drag/orbit

    this.updatePointerNDC(e);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    // 1. Decorate mode slot click
    if (this.interactionMode === 'decorate') {
      const visibleMarkers = this.cageBuilder.slotMarkerMeshes.filter((m) => m.visible);
      const slotHits = this.raycaster.intersectObjects(visibleMarkers, false);
      if (slotHits.length > 0) {
        const slotId = slotHits[0].object.userData.slotId as string;
        if (slotId) this.callbacks.onSlotTapped(slotId);
        return;
      }
    }

    // 2. Rat tap selection
    const ratTargets: THREE.Object3D[] = [];
    this.ratModels.forEach((m) => ratTargets.push(m.hitMesh));
    const ratHits = this.raycaster.intersectObjects(ratTargets, false);
    if (ratHits.length > 0) {
      const ratId = ratHits[0].object.userData.ratId as string;
      if (ratId) {
        this.callbacks.onRatTapped(ratId, ratId === this.selectedRatId);
        return;
      }
    }

    // 3. Dedication Plaque tap on the wall!
    if (this.cageBuilder.dedicationPlaqueMesh) {
      const plaqueHits = this.raycaster.intersectObject(this.cageBuilder.dedicationPlaqueMesh, false);
      if (plaqueHits.length > 0) {
        this.callbacks.onPlaqueTapped();
        return;
      }
    }
  }

  private tryPetAtPointer(clientX: number, clientY: number) {
    if (!this.selectedRatId) return;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const model = this.ratModels.get(this.selectedRatId);
    if (!model) return;
    const hits = this.raycaster.intersectObject(model.hitMesh, false);
    if (hits.length > 0) {
      const agent = this.ratAgents.get(this.selectedRatId);
      agent?.triggerPetting();
      const now = performance.now();
      if (now - this.lastPetEmit > 420) {
        this.lastPetEmit = now;
        this.callbacks.onPetProgress(this.selectedRatId, clientX, clientY);
      }
    }
  }

  private updateToyTargetFromPointer(clientX: number, clientY: number) {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const pt = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, pt)) {
      const b = this.cageBuilder.bounds;
      pt.x = THREE.MathUtils.clamp(pt.x, b.minX + 0.08, b.maxX - 0.08);
      pt.z = THREE.MathUtils.clamp(pt.z, b.minZ + 0.08, b.maxZ - 0.08);
      pt.y = b.floorY;
      this.toyTarget = pt;
      this.toyWandMesh.position.copy(pt);
      this.toyWandMesh.visible = true;

      if (this.selectedRatId) {
        const agent = this.ratAgents.get(this.selectedRatId);
        if (agent && agent.position.distanceTo(pt) < 0.24) {
          const now = performance.now();
          if (now - this.lastPlayEmit > 900) {
            this.lastPlayEmit = now;
            this.callbacks.onPlayProgress(this.selectedRatId, clientX, clientY);
          }
        }
      }
    }
  }

  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    // Gentle spinning exercise wheel if installed & rats active
    if (this.cageBuilder.wheelSpinMesh && !this.introMode) {
      this.cageBuilder.wheelSpinMesh.rotation.z += dt * 0.45;
    }

    // Pulse decorate slot markers subtly
    if (this.cageBuilder.slotMarkersGroup.visible) {
      const s = 1 + Math.sin(this.elapsed * 4.5) * 0.08;
      for (const m of this.cageBuilder.slotMarkerMeshes) {
        m.scale.set(s, 1, s);
      }
    }

    if (this.introMode && this.introRatModel) {
      // Cozy cinematic intro sweep showing the room, dedication plaque, and customizable starter rat
      this.introElapsed += dt;
      const sway = Math.sin(this.introElapsed * 0.45) * 0.38;
      this.camera.position.lerp(new THREE.Vector3(sway, 0.56, 1.38), dt * 2.2);
      this.camera.lookAt(0, 0.24, 0.06);

      this.introRatModel.root.rotation.y = Math.sin(this.introElapsed * 0.7) * 0.55 + 0.25;
      this.introRatModel.updatePose({
        time: this.elapsed,
        dt,
        speed: 0,
        turnRate: 0,
        behavior: Math.sin(this.introElapsed * 0.5) > 0.55 ? 'rear_up' : 'sniff',
        behaviorTime: this.introElapsed,
        ageScale: 1.0,
        worldPosition: this.introRatModel.root.position,
        worldYaw: this.introRatModel.root.rotation.y,
      });
    } else {
      // Update all live rat AI & procedural models
      const allAgents = Array.from(this.ratAgents.values());
      const aiCtx = {
        bounds: this.cageBuilder.bounds,
        hasSecondFloor: this.hasSecondFloor,
        anchors: this.cageBuilder.furnitureAnchors,
        allAgents,
        toyTarget: this.toyTarget,
      };

      for (const rat of this.latestRats) {
        const agent = this.ratAgents.get(rat.id);
        const model = this.ratModels.get(rat.id);
        if (!agent || !model) continue;

        agent.update(dt, rat, aiCtx);
        model.root.position.copy(agent.position);
        model.root.rotation.y = agent.yaw;

        model.updatePose({
          time: this.elapsed,
          dt,
          speed: agent.speed,
          turnRate: agent.turnRate,
          behavior: agent.behavior,
          behaviorTime: agent.behaviorTime,
          activeTrick: agent.activeTrick,
          trickPhase: (agent.behaviorTime % 2.4) / 2.4,
          climbPitch: agent.climbPitch,
          heldItem: agent.heldItem,
          pettingIntensity: agent.pettingTimer > 0 ? 1 : 0,
          ageScale: agent.getAgeScale(rat),
          worldPosition: agent.position,
          worldYaw: agent.yaw,
        });
      }

      // Camera smooth tracking / transitions
      if (this.cameraMode === 'follow' && this.selectedRatId) {
        const targetAgent = this.ratAgents.get(this.selectedRatId);
        if (targetAgent) {
          const desiredT = targetAgent.position.clone().add(new THREE.Vector3(0, 0.14, 0));
          this.controls.target.lerp(desiredT, dt * 4.5);
          const idealPos = desiredT.clone().add(new THREE.Vector3(0.42, 0.42, 1.18));
          this.camera.position.lerp(idealPos, dt * 2.5);
        }
      } else if (this.isTransitioningCam) {
        this.camera.position.lerp(this.desiredCamPos, dt * 4.5);
        this.controls.target.lerp(this.desiredTarget, dt * 4.5);
        if (
          this.camera.position.distanceTo(this.desiredCamPos) < 0.03 &&
          this.controls.target.distanceTo(this.desiredTarget) < 0.03
        ) {
          this.isTransitioningCam = false;
        }
      }

      this.controls.update();

      // Project floating rat labels every ~70ms for crisp 2D UI badges without React overload
      this.labelAccum += dt;
      if (this.labelAccum >= 0.07) {
        this.labelAccum = 0;
        this.emitProjectedLabels();
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private emitProjectedLabels() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const labels: ProjectedRatLabel[] = [];
    const proj = new THREE.Vector3();

    for (const rat of this.latestRats) {
      const agent = this.ratAgents.get(rat.id);
      if (!agent) continue;
      proj.copy(agent.position).add(new THREE.Vector3(0, 0.34, 0));
      proj.project(this.camera);
      const visible = proj.z < 1 && proj.x >= -1.05 && proj.x <= 1.05 && proj.y >= -1.05 && proj.y <= 1.05;
      labels.push({
        ratId: rat.id,
        name: rat.name,
        activityLabel: BEHAVIOR_LABELS[agent.behavior],
        x: (proj.x * 0.5 + 0.5) * w,
        y: (-proj.y * 0.5 + 0.5) * h,
        visible,
      });
    }

    this.callbacks.onLabelsUpdate(labels);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResizeBound);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDownBound);
    dom.removeEventListener('pointermove', this.onPointerMoveBound);
    dom.removeEventListener('pointerup', this.onPointerUpBound);
    dom.removeEventListener('pointercancel', this.onPointerUpBound);

    this.ratModels.forEach((m) => m.dispose());
    this.introRatModel?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    if (dom.parentElement) dom.parentElement.removeChild(dom);
  }
}
