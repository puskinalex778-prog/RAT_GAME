import * as THREE from 'three';
import { CageView, type ItemInstance } from '../cage/CageView';
import { Nav } from './nav';
import { RatAgent } from './RatAgent';
import { getGame, useGame } from '../store/gameStore';
import { bus } from '../store/bus';
import { buildFeatherToy, buildHand, buildHoop, buildPlayBall, buildTreatPiece } from '../engine/props';
import type { TrickId } from '../store/types';
import { haptic } from '../platform/native';

export type InteractionMode = 'none' | 'pet' | 'play' | 'train';

/** Мир клетки: крысы-агенты, предметы, взаимодействия игрока */
export class World {
  readonly group = new THREE.Group();
  readonly cage = new CageView();
  readonly nav = new Nav(this.cage);
  agents: RatAgent[] = [];
  cameraPos = new THREE.Vector3(0, 0.5, 2);

  private hand = buildHand();
  private handTreat: THREE.Mesh | null = null;
  private handTarget = new THREE.Vector3();
  private handVisibleT = 0;
  private feather = buildFeatherToy();
  private playBall = buildPlayBall();
  private hoop = buildHoop();
  private fetchBall = buildPlayBall();
  private fetchCarrier: RatAgent | null = null;
  private balls = new Map<string, { v: THREE.Vector3 }>();

  mode: InteractionMode = 'none';
  modeRat: RatAgent | null = null;
  playToy: 'feather' | 'ball' = 'feather';
  private toyPos = new THREE.Vector3(0, 0.03, 0.1);
  private toyVel = new THREE.Vector3();
  private chaseT = 0;
  private catchCd = 0;
  catches = 0;
  private petAccum = 0;
  private lastPetPoint: THREE.Vector3 | null = null;
  private shell = true;
  private unsub: (() => void)[] = [];

  constructor() {
    this.group.add(this.cage.group);
    this.group.add(this.hand);
    this.group.add(this.feather.group);
    this.group.add(this.playBall);
    this.group.add(this.hoop);
    this.group.add(this.fetchBall);
    this.rebuildCage();
    this.syncRats();

    this.unsub.push(
      bus.on('cageChanged', () => this.rebuildCage()),
      bus.on('ratsChanged', () => this.syncRats()),
      bus.on('worldTreat', ({ ratId, foodId }) => this.cmdTreat(ratId, foodId)),
      bus.on('worldCall', ({ ratId }) => this.cmdCall(ratId)),
      bus.on('worldFillBowl', () => this.cage.updateState(getGame().cage)),
      bus.on('worldWater', () => this.cage.updateState(getGame().cage)),
      bus.on('worldBedding', () => {
        this.cage.updateState(getGame().cage);
        bus.emit('sound', { name: 'rustle' });
      }),
      bus.on('worldTissues', () => this.cage.updateState(getGame().cage)),
      bus.on('worldTrick', ({ ratId, trick }) => this.cmdTrick(ratId, trick)),
    );
    let lastCage = getGame().cage;
    this.unsub.push(
      useGame.subscribe((s) => {
        if (s.cage !== lastCage) {
          lastCage = s.cage;
          this.cage.updateState(s.cage);
        }
      }),
    );
  }

  setShell(on: boolean) {
    this.shell = on;
    for (const a of this.agents) a.model.setShellEnabled(on);
  }

  rebuildCage() {
    const g = getGame();
    this.cage.rebuild(g.cage);
    this.balls.clear();
    for (const a of this.agents) a.resetPlacement();
    if (this.mode !== 'none') this.endMode();
  }

  syncRats() {
    const g = getGame();
    const alive = g.rats.filter((r) => r.alive);
    // удалить
    for (const a of [...this.agents]) {
      if (!alive.find((r) => r.id === a.id)) {
        a.dispose();
        this.agents = this.agents.filter((x) => x !== a);
      }
    }
    // добавить / обновить внешность
    for (const r of alive) {
      let a = this.agents.find((x) => x.id === r.id);
      if (!a) {
        a = new RatAgent(r.id, this, r, this.shell);
        this.agents.push(a);
        this.group.add(a.model.group);
        this.group.add(a.model.tail);
      } else if (JSON.stringify(a.model.appearance) !== JSON.stringify(r.appearance)) {
        a.model.setAppearance(r.appearance);
      }
    }
  }

  agent(id: string | null): RatAgent | undefined {
    return id ? this.agents.find((a) => a.id === id) : undefined;
  }

  // ------------------------------------------------------------------ рука

  offerHand(ratPos: THREE.Vector3, color: string): THREE.Vector3 {
    const L = this.cage.layout;
    this.hand.visible = true;
    this.handVisibleT = 0;
    if (this.handTreat) this.hand.remove(this.handTreat);
    this.handTreat = buildTreatPiece(color);
    this.handTreat.position.set(0, 0.014, 0.05);
    this.hand.add(this.handTreat);
    this.handTarget.set(ratPos.x, 0.07, L.d / 2 - 0.005);
    this.hand.position.set(ratPos.x + 0.05, 0.12, L.d / 2 + 0.2);
    this.hand.rotation.set(0.15, Math.PI, 0);
    return this.handTarget.clone().setY(0.06);
  }

  hideHand() {
    if (this.handTreat) {
      this.hand.remove(this.handTreat);
      this.handTreat = null;
    }
    this.handTarget.set(this.hand.position.x, 0.14, this.cage.layout.d / 2 + 0.3);
    this.handVisibleT = -0.6;
  }

  // ------------------------------------------------------------------ команды

  private cmdTreat(ratId: string, foodId: string) {
    const a = this.agent(ratId);
    if (!a) return;
    if (this.mode !== 'none' && this.modeRat === a) this.endMode();
    a.playerBusy = true;
    a.start('treat', a.actReceiveTreat(foodId));
  }

  private cmdCall(ratId: string) {
    const a = this.agent(ratId);
    const d = a?.data();
    if (!a || !d || a.playerBusy) return;
    if (a.sleeping && Math.random() < 0.5) {
      bus.emit('toast', { text: `${d.name} сонно шевелит ушками…`, kind: 'info' });
    }
    a.start('listen', a.actListen(d.stats.trust));
  }

  private cmdTrick(ratId: string, trick: TrickId) {
    const a = this.agent(ratId);
    if (!a) return;
    a.start('trick', a.actTrick(trick, true, false));
    getGame().trickPerformed(ratId, trick);
  }

  startMode(mode: InteractionMode, ratId: string, toy: 'feather' | 'ball' = 'feather') {
    this.endMode();
    const a = this.agent(ratId);
    if (!a) return;
    this.mode = mode;
    this.modeRat = a;
    a.playerBusy = true;
    if (mode === 'pet') {
      a.start('petted', a.actPetted());
      this.petAccum = 0;
      this.lastPetPoint = null;
    } else if (mode === 'play') {
      this.playToy = toy;
      this.catches = 0;
      this.toyPos.set(0, 0.03, 0.08);
      a.start('play', a.actPlay());
      this.chaseT = 1.0;
      if (toy === 'feather') this.feather.group.visible = true;
      else this.playBall.visible = true;
    } else if (mode === 'train') {
      a.start('train', a.actTrainWait());
    }
  }

  endMode() {
    const a = this.modeRat;
    if (a) a.playerBusy = false;
    this.mode = 'none';
    this.modeRat = null;
    this.feather.group.visible = false;
    this.playBall.visible = false;
    this.hand.visible = false;
    this.lastPetPoint = null;
  }

  trainAttempt(trick: TrickId, success: boolean) {
    const a = this.modeRat;
    if (!a || this.mode !== 'train') return;
    a.start('trick', a.actTrick(trick, success, true));
    a.playerBusy = true;
  }

  /** Поглаживание: точка касания на крысе (или null) */
  petPointer(p: THREE.Vector3 | null) {
    const a = this.modeRat;
    if (!a || this.mode !== 'pet') return;
    if (!p) {
      this.lastPetPoint = null;
      this.handTarget.set(this.hand.position.x, this.hand.position.y + 0.08, this.hand.position.z + 0.1);
      return;
    }
    this.hand.visible = true;
    this.handVisibleT = 0;
    this.handTarget.copy(p).add(new THREE.Vector3(0, 0.022, 0));
    this.hand.rotation.set(0.2, Math.PI, 0);
    if (this.lastPetPoint) {
      const dd = this.lastPetPoint.distanceTo(p);
      this.petAccum += dd;
      if (this.petAccum > 0.06) {
        this.petAccum = 0;
        getGame().petStroke(a.id);
        haptic('light');
        bus.emit('sound', { name: 'brux' });
      }
    }
    this.lastPetPoint = p.clone();
  }

  /** Игрушка в режиме игры следует за пальцем по полу */
  playPointer(p: THREE.Vector3 | null) {
    if (this.mode !== 'play' || !p) return;
    const L = this.cage.layout;
    const t = p.clone();
    t.x = Math.max(-L.w / 2 + 0.05, Math.min(L.w / 2 - 0.05, t.x));
    t.z = Math.max(-L.d / 2 + 0.05, Math.min(L.d / 2 - 0.05, t.z));
    this.toyVel.subVectors(t, this.toyPos).multiplyScalar(0.5);
    this.toyPos.x = t.x;
    this.toyPos.z = t.z;
  }

  showHoop(near: THREE.Vector3): THREE.Vector3 {
    const c = this.nav.frontPoint(near.x).add(new THREE.Vector3(0, 0, -0.08));
    this.nav.clampToLevel(c, 0);
    this.hoop.position.copy(c);
    this.hoop.rotation.y = Math.PI / 2;
    this.hoop.visible = true;
    return c;
  }

  hideHoop() {
    this.hoop.visible = false;
  }

  showFetchBall(near: THREE.Vector3): THREE.Vector3 {
    const p = new THREE.Vector3(near.x + (Math.random() < 0.5 ? -1 : 1) * 0.22, 0, near.z - 0.18);
    this.nav.clampToLevel(p, 0);
    this.fetchBall.position.copy(p).setY(0.022);
    this.fetchBall.visible = true;
    this.fetchCarrier = null;
    return p;
  }

  grabFetchBall(a: RatAgent) {
    this.fetchCarrier = a;
  }

  dropFetchBall(a: RatAgent) {
    this.fetchCarrier = null;
    const f = a.forward(new THREE.Vector3());
    this.fetchBall.position.copy(a.pos).addScaledVector(f, 0.08).setY(0.022);
    setTimeout(() => (this.fetchBall.visible = false), 2500);
  }

  pushBall(it: ItemInstance, dir: THREE.Vector3) {
    const st = this.balls.get(it.slotId) ?? { v: new THREE.Vector3() };
    st.v.copy(dir).setY(0).normalize().multiplyScalar(0.25 + Math.random() * 0.15);
    this.balls.set(it.slotId, st);
    bus.emit('sound', { name: 'pop' });
  }

  // ------------------------------------------------------------------ кадр

  update(dt: number) {
    for (const a of this.agents) a.update(dt);
    this.cage.update(dt);

    // мячики-игрушки
    const L = this.cage.layout;
    for (const [slotId, st] of this.balls) {
      const it = this.cage.items.find((i) => i.slotId === slotId);
      const b = it?.built.ball;
      if (!it || !b) continue;
      if (st.v.lengthSq() < 1e-6) continue;
      const world = it.built.group.localToWorld(b.position.clone());
      world.addScaledVector(st.v, dt);
      const minX = -L.w / 2 + 0.03;
      const maxX = L.w / 2 - 0.03;
      const minZ = -L.d / 2 + 0.03;
      const maxZ = L.d / 2 - 0.03;
      if (world.x < minX || world.x > maxX) st.v.x *= -0.6;
      if (world.z < minZ || world.z > maxZ) st.v.z *= -0.6;
      world.x = Math.max(minX, Math.min(maxX, world.x));
      world.z = Math.max(minZ, Math.min(maxZ, world.z));
      const local = it.built.group.worldToLocal(world);
      const moved = Math.hypot(local.x - b.position.x, local.z - b.position.z);
      b.position.x = local.x;
      b.position.z = local.z;
      b.rotation.x += moved / 0.024;
      st.v.multiplyScalar(Math.exp(-dt * 2.2));
    }

    // рука плавно подлетает
    if (this.hand.visible) {
      this.handVisibleT += dt;
      this.hand.position.lerp(this.handTarget, 1 - Math.exp(-dt * 8));
      if (this.handVisibleT < 0 && this.handVisibleT + dt >= 0) this.hand.visible = false;
    }

    // игра
    if (this.mode === 'play' && this.modeRat) {
      const a = this.modeRat;
      const toyObj = this.playToy === 'feather' ? this.feather.group : this.playBall;
      if (this.playToy === 'feather') {
        const wob = Math.sin(performance.now() / 120) * 0.006;
        this.feather.group.position.set(this.toyPos.x, 0, this.toyPos.z);
        this.feather.feather.position.set(0, 0.012 + Math.abs(wob) * 2, 0);
        this.feather.feather.rotation.z = this.toyVel.x * 4;
        const sp = this.feather.string.geometry.attributes.position as THREE.BufferAttribute;
        sp.setXYZ(0, 0, 0.03, 0);
        sp.setXYZ(1, -this.toyVel.x * 0.5, 0.6, -this.toyVel.z * 0.5 + 0.2);
        sp.needsUpdate = true;
      } else {
        const prev = this.playBall.position.clone();
        this.playBall.position.lerp(new THREE.Vector3(this.toyPos.x, 0.022, this.toyPos.z), 1 - Math.exp(-dt * 6));
        const mv = this.playBall.position.distanceTo(prev);
        this.playBall.rotation.x += mv / 0.022;
      }
      this.toyVel.multiplyScalar(Math.exp(-dt * 4));
      this.chaseT -= dt;
      this.catchCd -= dt;
      const toyP = toyObj.position.clone().setY(0);
      const dist = Math.hypot(a.pos.x - toyP.x, a.pos.z - toyP.z);
      if (dist < 0.07 * a.model.scaleValue + 0.02 && this.catchCd <= 0) {
        this.catchCd = 1.2;
        this.catches++;
        a.faceDir(toyP.clone().sub(a.pos).setY(0).normalize());
        a.pounce();
        haptic('medium');
        bus.emit('sound', { name: 'squeak' });
        bus.emit('playScore', { ratId: a.id, catches: this.catches });
      } else if (this.chaseT <= 0 && this.catchCd < 0.6) {
        this.chaseT = 0.35;
        if (dist > 0.05) {
          const target = toyP.clone();
          const back = target.clone().sub(a.pos).setY(0).normalize().multiplyScalar(-0.04);
          a.chase(target.add(back));
        }
      }
    }

    // мяч для «Принеси»
    if (this.fetchCarrier) {
      this.fetchCarrier.model.mouthWorld(this.fetchBall.position);
      this.fetchBall.position.y -= 0.01;
    }
  }

  dispose() {
    for (const u of this.unsub) u();
    for (const a of this.agents) a.dispose();
  }
}
