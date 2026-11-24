import * as THREE from 'three';
import { RatModel, type HeldShape } from '../rats/RatModel';
import type { RatData, TrickId } from '../store/types';
import { personalityDef } from '../store/data/personalities';
import { foodDef } from '../store/data/items';
import { bodyScale } from '../store/life';
import { getGame } from '../store/gameStore';
import { bus } from '../store/bus';
import { applyAnim, type AnimName } from './anims';
import { UP, type Waypoint } from './nav';
import type { World } from './World';
import type { ItemInstance } from '../cage/CageView';

type Step =
  | { k: 'go'; to: THREE.Vector3; level: 0 | 1; run?: boolean; ignore?: string[] }
  | { k: 'path'; wps: Waypoint[]; run?: boolean }
  | { k: 'anim'; name: AnimName; dur: number }
  | { k: 'face'; dir: THREE.Vector3 }
  | { k: 'wait'; until: () => boolean; max: number; name: AnimName };

type Activity = Generator<Step, void, unknown>;

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export class RatAgent {
  readonly model: RatModel;
  pos = new THREE.Vector3();
  level: 0 | 1 | 2 = 0;
  quat = new THREE.Quaternion();
  private targetQuat = new THREE.Quaternion();
  private surfaceUp = new THREE.Vector3(0, 1, 0);

  private activity: Activity | null = null;
  activityName = 'none';
  private step: Step | null = null;
  private stepT = 0;
  private route: Waypoint[] = [];
  private ri = 0;
  private running = false;
  moving = false;

  anim: AnimName = 'idle';
  private animT = 0;
  private seed = Math.random() * 10;

  /** маршрут «наружу» из гамака/домика/колеса при прерывании */
  private exitRoute: Waypoint[] | null = null;
  private onCleanup: (() => void) | null = null;

  energy = rnd(0.6, 1);
  thirst = rnd(0, 0.4);
  social = rnd(0.2, 0.6);
  boredom = rnd(0.2, 0.7);
  playerBusy = false;
  partner: RatAgent | null = null;
  lookTarget: THREE.Vector3 | null = null;
  sleeping = false;
  private scaleT = 0;
  private yOffset = 0;
  private sqT = rnd(5, 20);

  constructor(public readonly id: string, private world: World, data: RatData, shell: boolean) {
    this.model = new RatModel(data.appearance, shell);
    this.model.setScale(bodyScale(data));
    this.pos.copy(world.nav.randomPoint(0));
    this.quat.setFromAxisAngle(UP, Math.random() * Math.PI * 2);
    this.targetQuat.copy(this.quat);
  }

  data(): RatData | undefined {
    return getGame().rats.find((r) => r.id === this.id && r.alive);
  }

  get floorLevel(): 0 | 1 {
    return this.level === 1 ? 1 : 0;
  }

  get busy(): boolean {
    return this.playerBusy || this.partner !== null;
  }

  // ------------------------------------------------------------------ управление

  /** Прервать текущее занятие и начать новое */
  start(name: string, act: Activity) {
    this.cleanup();
    let exit = this.exitRoute;
    this.exitRoute = null;
    if (!exit || !exit.length) exit = this.dropRoute();
    this.activityName = name;
    if (exit && exit.length) {
      const self = this;
      const wrapped = (function* (): Activity {
        yield { k: 'path', wps: exit };
        self.level = (exit[exit.length - 1].level ?? 0) as 0 | 1 | 2;
        yield* act;
      })();
      this.activity = wrapped;
    } else {
      this.activity = act;
    }
    this.step = null;
  }

  /** Если крыса прервана в воздухе (на стенке) без маршрута выхода — аккуратно спуститься */
  private dropRoute(): Waypoint[] | null {
    const cage = this.world.cage;
    const lv: 0 | 1 = this.level === 1 ? 1 : 0;
    const y0 = cage.levelY(lv);
    if (this.level !== 2 && Math.abs(this.pos.y - y0) < 0.03) return null;
    const shelf = cage.layout.shelf;
    const onShelf = !!shelf && this.pos.x > shelf.x0 + 0.02 && this.pos.y > shelf.y - 0.02;
    const level: 0 | 1 = onShelf ? 1 : 0;
    const down = new THREE.Vector3(this.pos.x, cage.levelY(level), this.pos.z);
    const inward = this.world.nav.clampToLevel(down.clone(), level);
    return [
      { p: down, climb: true, normal: this.surfaceUp.clone(), level },
      { p: inward, level },
    ];
  }

  /** Можно ли сейчас позвать эту крысу на совместную игру/груминг */
  get availableForSocial(): boolean {
    const calm = ['none', 'wander', 'sniffItem', 'rear', 'groom', 'beg', 'shelf', 'hop'];
    return !this.busy && !this.sleeping && this.level !== 2 && !this.exitRoute && !this.route[this.ri]?.climb && calm.includes(this.activityName) && !!this.data();
  }

  private cleanup() {
    this.model.setHeld(null);
    this.model.setMouthItem(false);
    this.model.whiskerBoost = 0;
    this.sleeping = false;
    this.lookTarget = null;
    if (this.onCleanup) {
      const f = this.onCleanup;
      this.onCleanup = null;
      f();
    }
    if (this.partner) {
      const p = this.partner;
      this.partner = null;
      if (p.partner === this) {
        p.partner = null;
        p.activity = null;
        p.step = null;
      }
    }
    this.yOffset = 0;
  }

  /** Сбросить всё (после пересборки клетки) */
  resetPlacement() {
    this.cleanup();
    this.exitRoute = null;
    this.activity = null;
    this.step = null;
    this.route = [];
    this.level = 0;
    this.pos.copy(this.world.nav.randomPoint(0));
    this.surfaceUp.set(0, 1, 0);
    this.model.resetTail();
  }

  teleport(p: THREE.Vector3, level: 0 | 1, yaw: number) {
    this.cleanup();
    this.exitRoute = null;
    this.activity = null;
    this.step = null;
    this.pos.copy(p);
    this.level = level;
    this.quat.setFromAxisAngle(UP, yaw);
    this.targetQuat.copy(this.quat);
    this.surfaceUp.set(0, 1, 0);
    this.model.resetTail();
  }

  // ------------------------------------------------------------------ кадр

  update(dt: number) {
    const d = this.data();
    if (!d) return;
    // потребности
    const active = !this.sleeping;
    this.energy = Math.max(0, Math.min(1, this.energy + (active ? -dt / (this.running ? 90 : 200) : dt / 45)));
    this.thirst = Math.min(1, this.thirst + dt / 320);
    this.social = Math.min(1, this.social + dt / (this.world.agents.length > 1 ? 220 : 9999));
    this.boredom = Math.min(1, this.boredom + dt / 160);

    // шаги
    if (!this.step) this.nextStep();
    if (this.step) this.runStep(dt);

    // анимация
    this.animT += dt;
    let lookYaw = 0;
    if (this.lookTarget) {
      const local = tmpV.copy(this.lookTarget).sub(this.pos).applyQuaternion(tmpQ.copy(this.quat).invert());
      lookYaw = Math.max(-1.2, Math.min(1.2, Math.atan2(local.x, local.z)));
    }
    let a: AnimName = this.anim;
    if (this.moving) a = this.route[this.ri]?.climb || this.level === 2 ? 'climb' : this.running ? 'run' : 'walk';
    applyAnim(this.model.target, a, this.animT, this.seed, this.moving, lookYaw);
    this.yOffset = a === 'hop' ? Math.max(0, Math.sin(this.animT * 8)) * 0.025 : a === 'pounce' && this.animT < 0.5 ? Math.sin((this.animT / 0.5) * Math.PI) * 0.03 : 0;

    // ориентация
    const k = 1 - Math.exp(-dt * (this.moving ? 9 : 5));
    this.quat.slerp(this.targetQuat, k);
    this.model.group.position.copy(this.pos).addScaledVector(this.surfaceUp, this.yOffset);
    this.model.group.quaternion.copy(this.quat);
    this.model.tailFloorY = this.level === 2 ? null : this.pos.y;
    this.model.update(dt);

    // рост
    this.scaleT -= dt;
    if (this.scaleT <= 0) {
      this.scaleT = 5;
      this.model.setScale(bodyScale(d));
    }
    // случайный писк
    this.sqT -= dt;
    if (this.sqT <= 0) {
      this.sqT = rnd(15, 45);
      if (!this.sleeping && Math.random() < 0.35) bus.emit('sound', { name: 'squeak' });
    }
  }

  private nextStep() {
    if (!this.activity) {
      if (this.partner) return; // партнёр управляет
      this.chooseActivity();
    }
    if (!this.activity) return;
    const r = this.activity.next();
    if (r.done) {
      this.activity = null;
      this.activityName = 'none';
      this.step = null;
      this.anim = 'idle';
      return;
    }
    this.step = r.value;
    this.stepT = 0;
    const s = this.step;
    if (s.k === 'go') {
      const from = this.pos.clone();
      this.route = this.world.nav.plan(from, this.floorLevel, s.to, s.level, s.ignore);
      this.ri = 0;
      this.running = !!s.run;
    } else if (s.k === 'path') {
      this.route = s.wps;
      this.ri = 0;
      this.running = !!s.run;
    } else if (s.k === 'anim') {
      this.setAnim(s.name);
    } else if (s.k === 'wait') {
      this.setAnim(s.name);
    }
  }

  setAnim(name: AnimName) {
    if (this.anim !== name) {
      this.anim = name;
      this.animT = 0;
    }
  }

  private runStep(dt: number) {
    const s = this.step!;
    this.stepT += dt;
    if (s.k === 'go' || s.k === 'path') {
      this.moving = true;
      if (this.ri >= this.route.length) {
        this.moving = false;
        this.step = null;
        return;
      }
      const wp = this.route[this.ri];
      const sc = this.model.scaleValue;
      let speed = (this.running ? 0.3 : 0.11) * (0.6 + 0.4 * sc);
      if (wp.climb || this.level === 2) speed = 0.1;
      speed *= wp.speedMul ?? 1;
      const to = tmpV.subVectors(wp.p, this.pos);
      const dist = to.length();
      const stepLen = speed * dt;
      if (dist <= stepLen + 1e-4) {
        this.pos.copy(wp.p);
        if (wp.level !== undefined) this.level = wp.level;
        this.ri++;
        this.model.gaitPhase += dist / (0.055 * sc);
        if (this.ri >= this.route.length) {
          this.moving = false;
          this.step = null;
        }
      } else {
        to.divideScalar(dist);
        this.pos.addScaledVector(to, stepLen);
        this.model.gaitPhase += stepLen / (0.055 * sc);
        const up = wp.normal ?? (this.level === 2 && !wp.climb ? this.surfaceUp : UP);
        this.orient(to, up);
      }
      // safety: не застревать
      if (this.stepT > 40) {
        this.moving = false;
        this.step = null;
      }
    } else if (s.k === 'anim') {
      this.moving = false;
      if (this.stepT >= s.dur) this.step = null;
    } else if (s.k === 'face') {
      this.moving = false;
      this.orient(s.dir, this.level === 2 ? this.surfaceUp : UP);
      if (this.stepT > 0.35) this.step = null;
    } else if (s.k === 'wait') {
      this.moving = false;
      if (s.until() || this.stepT >= s.max) this.step = null;
    }
  }

  /** Повернуть «вперёд» к dir, «спиной» к up */
  orient(dir: THREE.Vector3, up: THREE.Vector3) {
    const f = tmpV2.copy(dir);
    const u = up.clone();
    if (Math.abs(f.dot(u)) > 0.97) {
      // движение вдоль нормали (вертикальный подъём) — «вперёд» остаётся, верх — от стенки
      u.copy(this.surfaceUp);
      if (Math.abs(f.dot(u)) > 0.97) return;
    }
    f.addScaledVector(u, -f.dot(u));
    if (f.lengthSq() < 1e-8) return;
    f.normalize();
    const y = u.clone().normalize();
    const x = new THREE.Vector3().crossVectors(y, f).normalize();
    tmpM.makeBasis(x, y, f);
    this.targetQuat.setFromRotationMatrix(tmpM);
    this.surfaceUp.copy(y);
  }

  faceDir(dir: THREE.Vector3) {
    this.orient(dir, UP);
  }

  forward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 0, 1).applyQuaternion(this.quat);
  }

  // ------------------------------------------------------------------ выбор занятия (Utility AI)

  chooseActivity() {
    const d = this.data();
    if (!d) return;
    const g = getGame();
    const p = personalityDef(d.personality).w;
    const cage = this.world.cage;
    const hunger = 1 - d.stats.satiety / 100;
    const bowls = cage.findItems((i) => i.kind === 'bowl');
    const toys = cage.findItems((i) => ['wheel', 'tunnel', 'ball', 'forage', 'rope', 'ladder'].includes(i.kind));
    const houses = cage.findItems((i) => i.kind === 'house');
    const others = this.world.agents.filter((a) => a !== this && a.availableForSocial && a.floorLevel === this.floorLevel);
    const opts: [string, number][] = [];
    if (bowls.length && g.cage.bowlFood > 1) opts.push(['eat', (Math.pow(hunger, 1.4) * 2.2 + 0.12) * p.food]);
    if (!cage.isPlaypen) opts.push(['drink', Math.pow(this.thirst, 1.5) * 2 + 0.03]);
    else opts.push(['drink', 0]);
    opts.push(['sleep', Math.pow(1 - this.energy, 2) * 3 * p.rest]);
    opts.push(['wander', 0.35 * p.explore]);
    opts.push(['sniffItem', 0.25 * p.explore]);
    opts.push(['rear', 0.18 * p.explore]);
    opts.push(['groom', 0.22 * p.groom]);
    if (toys.length) opts.push(['toy', (0.25 + this.boredom * 0.8) * p.play]);
    if (others.length) opts.push(['social', this.social * 0.9 * p.social]);
    if (g.cage.nestPapers > 0 && houses.length) opts.push(['nest', 0.55]);
    opts.push(['beg', (d.stats.trust / 100) * 0.22 * p.human]);
    if (cage.layout.shelf) opts.push(['shelf', 0.22 * p.explore]);
    if (!cage.isPlaypen) opts.push(['climbBars', 0.1 * p.explore]);
    if (d.stats.comfort > 75 && this.energy > 0.5) opts.push(['hop', 0.05]);
    if (cage.findItems((i) => i.kind === 'hammock' || i.kind === 'hammock2').length) opts.push(['lounge', 0.12 * p.rest]);

    const total = opts.reduce((s, o) => s + Math.max(0, o[1]), 0);
    let r = Math.random() * total;
    let pick = 'wander';
    for (const [k, w] of opts) {
      r -= Math.max(0, w);
      if (r <= 0) {
        pick = k;
        break;
      }
    }
    this.startByName(pick, { bowls, toys, houses, others });
  }

  private startByName(
    pick: string,
    ctx: { bowls: ItemInstance[]; toys: ItemInstance[]; houses: ItemInstance[]; others: RatAgent[] },
  ) {
    const choose = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    switch (pick) {
      case 'eat':
        return this.start('eat', this.actEat(choose(ctx.bowls)));
      case 'drink':
        return this.start('drink', this.actDrink());
      case 'sleep':
        return this.start('sleep', this.actSleep());
      case 'sniffItem': {
        const items = this.world.cage.items.filter((i) => !i.hang);
        if (items.length) return this.start('sniffItem', this.actSniffItem(choose(items)));
        return this.start('wander', this.actWander());
      }
      case 'rear':
        return this.start('rear', this.actRear());
      case 'groom':
        return this.start('groom', this.actGroom());
      case 'toy':
        return this.start('toy', this.actToy(this.pickToy(ctx.toys)));
      case 'social':
        return this.start('social', this.actSocial(choose(ctx.others)));
      case 'nest':
        return this.start('nest', this.actNest(choose(ctx.houses)));
      case 'beg':
        return this.start('beg', this.actBeg());
      case 'shelf':
        return this.start('shelf', this.actShelf());
      case 'climbBars':
        return this.start('climbBars', this.actClimbBars());
      case 'hop':
        return this.start('hop', this.actHop());
      case 'lounge': {
        const h = this.world.cage.findItems((i) => i.kind === 'hammock' || i.kind === 'hammock2');
        return this.start('lounge', this.actHammock(choose(h), false));
      }
      default:
        return this.start('wander', this.actWander());
    }
  }

  private pickToy(toys: ItemInstance[]): ItemInstance {
    const d = this.data();
    const fav = d ? personalityDef(d.personality).favToys : [];
    const love = d?.toyLove ?? {};
    const toyCat = (i: ItemInstance) => (i.kind === 'rope' || i.kind === 'ladder' ? 'ladder' : i.kind);
    const weights = toys.map((t) => 1 + (fav.includes(toyCat(t)) ? 1.5 : 0) + Math.min(3, (love[toyCat(t)] ?? 0) / 10));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < toys.length; i++) {
      r -= weights[i];
      if (r <= 0) return toys[i];
    }
    return toys[0];
  }

  // ------------------------------------------------------------------ занятия

  private *actWander(): Activity {
    const lv = this.floorLevel;
    const to = this.world.nav.randomPoint(lv);
    yield { k: 'go', to, level: lv, run: Math.random() < 0.15 };
    const r = Math.random();
    if (r < 0.45) yield { k: 'anim', name: 'sniff', dur: rnd(1.5, 3.5) };
    else if (r < 0.7) yield { k: 'anim', name: 'rear', dur: rnd(1.5, 3) };
    else if (r < 0.85) yield { k: 'anim', name: 'dig', dur: rnd(1, 2) };
    else yield { k: 'anim', name: 'idle', dur: rnd(1.5, 3.5) };
  }

  private *actRear(): Activity {
    yield { k: 'anim', name: 'rear', dur: rnd(2, 3.5) };
    yield { k: 'anim', name: 'sniff', dur: rnd(1, 2) };
  }

  private *actGroom(): Activity {
    yield { k: 'anim', name: 'groomSelf', dur: rnd(6, 9) };
  }

  private *actHop(): Activity {
    yield { k: 'anim', name: 'hop', dur: rnd(1.2, 2.2) };
    yield { k: 'go', to: this.world.nav.randomPoint(this.floorLevel), level: this.floorLevel, run: true };
  }

  private *actSniffItem(it: ItemInstance): Activity {
    yield { k: 'go', to: it.approach.clone(), level: it.level, ignore: [it.slotId] };
    yield { k: 'face', dir: tmpV.subVectors(it.center, it.approach).setY(0).normalize().clone() };
    yield { k: 'anim', name: 'sniff', dur: rnd(1.5, 3) };
    if (Math.random() < 0.4) yield { k: 'anim', name: 'rear', dur: 1.5 };
  }

  private *actEat(bowl: ItemInstance): Activity {
    yield { k: 'go', to: bowl.approach.clone(), level: bowl.level, ignore: [bowl.slotId] };
    yield { k: 'face', dir: tmpV.subVectors(bowl.center, bowl.approach).setY(0).normalize().clone() };
    yield { k: 'anim', name: 'sniff', dur: 0.8 };
    if (getGame().cage.bowlFood <= 1) return;
    this.model.setHeld('pellet', '#c89f62');
    bus.emit('sound', { name: 'chew' });
    yield { k: 'anim', name: 'eat', dur: rnd(4.5, 7) };
    this.model.setHeld(null);
    getGame().ratAte(this.id);
    if (Math.random() < 0.5) yield { k: 'anim', name: 'wash', dur: rnd(2, 3) };
  }

  private *actDrink(): Activity {
    const b = this.world.cage.layout.bottle;
    const to = new THREE.Vector3(b.drinkX, 0, b.drinkZ);
    yield { k: 'go', to, level: 0 };
    yield { k: 'face', dir: new THREE.Vector3(-1, 0, 0) };
    bus.emit('sound', { name: 'drink' });
    yield { k: 'anim', name: 'drink', dur: rnd(2.5, 4) };
    this.thirst = 0;
    getGame().ratDrank(this.id);
  }

  private *actSleep(): Activity {
    const cage = this.world.cage;
    const d = this.data();
    const cozy = d ? personalityDef(d.personality).w.rest : 1;
    const houses = cage.findItems((i) => i.kind === 'house');
    const hammocks = cage.findItems((i) => i.kind === 'hammock' || i.kind === 'hammock2');
    const r = Math.random();
    if (hammocks.length && r < 0.35 * cozy) {
      yield* this.actHammock(hammocks[Math.floor(Math.random() * hammocks.length)], true);
      return;
    }
    if (houses.length && r < 0.85) {
      const h = houses[Math.floor(Math.random() * houses.length)];
      yield* this.actHouse(h, true);
      return;
    }
    // уютный уголок на подстилке
    const L = cage.layout;
    const corner = new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (L.w / 2 - 0.09), 0, (Math.random() < 0.5 ? -1 : 1) * (L.d / 2 - 0.09));
    this.world.nav.clampToLevel(corner, 0);
    yield { k: 'go', to: corner, level: 0 };
    yield* this.sleepHere('sleepCurl');
  }

  private *sleepHere(anim: AnimName): Activity {
    this.sleeping = true;
    yield { k: 'anim', name: 'idle', dur: 0.6 };
    const dur = rnd(25, 60) * (1 + (1 - this.energy));
    yield { k: 'wait', name: anim, until: () => this.energy > 0.98 && this.stepT > 12, max: dur };
    this.sleeping = false;
    yield { k: 'anim', name: 'sleepStretch', dur: 1.2 };
    yield { k: 'anim', name: 'wash', dur: rnd(1.5, 2.5) };
  }

  private *actHouse(h: ItemInstance, sleep: boolean): Activity {
    yield { k: 'go', to: h.approach.clone(), level: h.level, ignore: [h.slotId] };
    if (!h.inside) return;
    const inside = h.inside.clone();
    const out = h.approach.clone();
    yield { k: 'path', wps: [{ p: inside, level: h.level, speedMul: 0.6 }] };
    this.exitRoute = [{ p: out, level: h.level }];
    h.occupants++;
    this.onCleanup = () => {
      h.occupants = Math.max(0, h.occupants - 1);
    };
    yield { k: 'face', dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize() };
    if (sleep) yield* this.sleepHere('sleepCurl');
    else yield { k: 'anim', name: 'sniff', dur: rnd(2, 4) };
    this.exitRoute = null;
    h.occupants = Math.max(0, h.occupants - 1);
    this.onCleanup = null;
    yield { k: 'path', wps: [{ p: out, level: h.level }] };
    getGame().ratUsedToy(this.id, 'house');
  }

  /** Подъём по задней стенке в гамак */
  private *actHammock(h: ItemInstance, sleep: boolean): Activity {
    if (!h.climbBase || !h.inside) return;
    const base = h.climbBase.clone();
    const wallTop = new THREE.Vector3(base.x, h.approach.y, base.z);
    const wallN = new THREE.Vector3(0, 0, 1);
    yield { k: 'go', to: base.clone().setZ(base.z + 0.05), level: h.level };
    yield { k: 'path', wps: [{ p: base, level: h.level }] };
    const spot = Math.random() < 0.5 && h.inside2 ? h.inside2.clone() : h.inside.clone();
    const inWp: Waypoint[] = [
      { p: wallTop, climb: true, normal: wallN, level: 2 },
      { p: h.approach.clone(), level: 2 },
      { p: spot, level: 2, speedMul: 0.7 },
    ];
    yield { k: 'path', wps: inWp };
    this.surfaceUp.set(0, 1, 0);
    this.exitRoute = [
      { p: h.approach.clone(), level: 2 },
      { p: wallTop.clone(), level: 2 },
      { p: base.clone(), climb: true, normal: wallN, level: h.level },
      { p: base.clone().setZ(base.z + 0.06), level: h.level },
    ];
    this.orient(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), UP);
    if (sleep) yield* this.sleepHere('sleepHammock');
    else {
      yield { k: 'anim', name: Math.random() < 0.5 ? 'groomSelf' : 'idle', dur: rnd(4, 7) };
    }
    getGame().ratUsedToy(this.id, 'hammock');
    const exit = this.exitRoute;
    this.exitRoute = null;
    if (exit) yield { k: 'path', wps: exit };
    this.level = h.level;
  }

  private *actToy(it: ItemInstance): Activity {
    const cat = it.kind === 'rope' || it.kind === 'ladder' ? 'ladder' : it.kind;
    this.boredom = Math.max(0, this.boredom - 0.6);
    switch (it.kind) {
      case 'wheel': {
        yield { k: 'go', to: it.approach.clone(), level: it.level, ignore: [it.slotId] };
        if (!it.inside) return;
        yield { k: 'path', wps: [{ p: it.inside.clone(), level: it.level, speedMul: 0.6 }] };
        this.exitRoute = [{ p: it.approach.clone(), level: it.level }];
        const dirX = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, it.built.group.rotation.y);
        yield { k: 'face', dir: dirX };
        const dur = rnd(6, 12);
        bus.emit('sound', { name: 'wheel' });
        yield { k: 'wait', name: 'wheel', until: () => {
          this.world.cage.wheelSpin = 7;
          this.model.gaitPhase += 0.12;
          return false;
        }, max: dur };
        this.exitRoute = null;
        yield { k: 'path', wps: [{ p: it.approach.clone(), level: it.level }] };
        break;
      }
      case 'tunnel': {
        yield { k: 'go', to: it.approach.clone(), level: it.level, ignore: [it.slotId] };
        const wps: Waypoint[] = (it.path ?? []).map((p) => ({ p: p.clone().setY(this.world.cage.levelY(it.level)), level: it.level, speedMul: 1.3 }));
        if (it.exit) wps.push({ p: it.exit.clone(), level: it.level });
        bus.emit('sound', { name: 'rustle' });
        yield { k: 'path', wps, run: true };
        yield { k: 'anim', name: 'sniff', dur: 1 };
        break;
      }
      case 'ball': {
        const ball = it.built.ball;
        if (!ball) return;
        for (let i = 0; i < 3; i++) {
          const bw = ball.getWorldPosition(new THREE.Vector3());
          const to = bw.clone().add(new THREE.Vector3(rnd(-0.05, 0.05), 0, rnd(-0.05, 0.05)).setLength(0.06));
          to.y = 0;
          this.world.nav.clampToLevel(to, it.level);
          yield { k: 'go', to, level: it.level, ignore: [it.slotId], run: i > 0 };
          yield { k: 'face', dir: bw.clone().sub(this.pos).setY(0).normalize() };
          yield { k: 'anim', name: 'sniff', dur: 0.6 };
          this.world.pushBall(it, this.forward(new THREE.Vector3()));
          yield { k: 'anim', name: 'pounce', dur: 0.6 };
        }
        break;
      }
      case 'forage': {
        yield { k: 'go', to: it.approach.clone(), level: it.level, ignore: [it.slotId] };
        yield { k: 'face', dir: tmpV.subVectors(it.center, it.approach).setY(0).normalize().clone() };
        bus.emit('sound', { name: 'rustle' });
        yield { k: 'anim', name: 'dig', dur: rnd(2.5, 4) };
        this.model.setHeld('seed', '#d8cf9a');
        bus.emit('sound', { name: 'chew' });
        yield { k: 'anim', name: 'eat', dur: rnd(2.5, 4) };
        this.model.setHeld(null);
        break;
      }
      case 'rope':
      case 'ladder': {
        if (!it.climbBase || !it.top) return;
        yield { k: 'go', to: it.approach.clone(), level: it.level };
        const n = new THREE.Vector3(0, 0, 1);
        const top = it.top.clone();
        const mid = it.climbBase.clone().lerp(top, rnd(0.5, 1));
        yield { k: 'path', wps: [{ p: it.climbBase.clone(), level: it.level }, { p: mid, climb: true, normal: n, level: 2 }] };
        this.exitRoute = [{ p: it.climbBase.clone(), climb: true, normal: n, level: it.level }, { p: it.approach.clone(), level: it.level }];
        yield { k: 'anim', name: 'sniff', dur: rnd(1, 2) };
        const ex = this.exitRoute;
        this.exitRoute = null;
        yield { k: 'path', wps: ex };
        this.level = it.level;
        break;
      }
      default:
        yield* this.actSniffItem(it);
    }
    getGame().ratUsedToy(this.id, cat);
  }

  private *actSocial(other: RatAgent): Activity {
    if (!other.availableForSocial) return;
    const d = this.data();
    const wrestle = d && (d.personality === 'mischievous' ? Math.random() < 0.7 : Math.random() < 0.35);
    const kind: AnimName = wrestle ? 'wrestle' : 'groomOther';
    const dur = rnd(5, 9);
    // партнёр останавливается и ждёт
    other.start('partner', other.actPartner(this, wrestle ? 'wrestle' : 'groomed', dur + 6));
    other.partner = this;
    this.partner = other;
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(other.quat).multiplyScalar(0.075 * other.model.scaleValue + 0.02);
    const to = other.pos.clone().add(side);
    this.world.nav.clampToLevel(to, other.floorLevel);
    yield { k: 'go', to, level: other.floorLevel };
    if (this.partner !== other) return;
    yield { k: 'face', dir: other.pos.clone().sub(this.pos).setY(0).normalize() };
    if (wrestle) bus.emit('sound', { name: 'squeak' });
    yield { k: 'anim', name: kind, dur };
    this.social = 0;
    other.social = 0;
    if (other.partner === this) {
      other.partner = null;
      other.activity = null;
      other.step = null;
    }
    this.partner = null;
    if (wrestle) yield { k: 'go', to: this.world.nav.randomPoint(this.floorLevel), level: this.floorLevel, run: true };
  }

  actPartner(initiator: RatAgent, anim: AnimName, max: number): Activity {
    const self = this;
    return (function* (): Activity {
      yield { k: 'wait', name: 'idle', until: () => self.partner !== initiator || initiator.pos.distanceTo(self.pos) < 0.16, max: 8 };
      if (self.partner !== initiator) return;
      yield { k: 'face', dir: initiator.pos.clone().sub(self.pos).setY(0).normalize() };
      yield { k: 'wait', name: anim, until: () => self.partner !== initiator, max };
    })();
  }

  private *actNest(house: ItemInstance): Activity {
    const vis = this.world.cage.visiblePaperIndex();
    if (!vis.length || !house.inside) return;
    const idx = vis[Math.floor(Math.random() * vis.length)];
    const spot = this.world.cage.paperSpots[idx].clone();
    yield { k: 'go', to: spot, level: 0 };
    yield { k: 'anim', name: 'sniff', dur: 0.8 };
    if (!this.world.cage.visiblePaperIndex().includes(idx)) return;
    this.world.cage.hidePaper(idx);
    this.model.setMouthItem(true);
    bus.emit('sound', { name: 'rustle' });
    yield { k: 'go', to: house.approach.clone(), level: house.level, ignore: [house.slotId] };
    yield { k: 'path', wps: [{ p: house.inside.clone(), level: house.level, speedMul: 0.6 }] };
    this.exitRoute = [{ p: house.approach.clone(), level: house.level }];
    yield { k: 'anim', name: 'dig', dur: 1.6 };
    this.model.setMouthItem(false);
    getGame().nestPaperCarried();
    this.exitRoute = null;
    yield { k: 'path', wps: [{ p: house.approach.clone(), level: house.level }] };
  }

  private *actBeg(): Activity {
    const fp = this.world.nav.frontPoint(this.pos.x);
    yield { k: 'go', to: fp, level: 0 };
    yield { k: 'face', dir: new THREE.Vector3(0, 0, 1) };
    this.lookTarget = this.world.cameraPos;
    yield { k: 'anim', name: 'beg', dur: rnd(2, 3.5) };
    this.lookTarget = null;
  }

  private *actShelf(): Activity {
    const lv: 0 | 1 = this.floorLevel === 1 ? 0 : 1;
    yield { k: 'go', to: this.world.nav.randomPoint(lv), level: lv };
    yield { k: 'anim', name: Math.random() < 0.5 ? 'rear' : 'sniff', dur: rnd(1.5, 3) };
  }

  private *actClimbBars(): Activity {
    const L = this.world.cage.layout;
    const walls = [
      { p: new THREE.Vector3(rnd(-L.w / 2 + 0.15, L.w / 2 - 0.15), 0, L.d / 2 - 0.02), n: new THREE.Vector3(0, 0, -1), off: new THREE.Vector3(0, 0, -0.05) },
      { p: new THREE.Vector3(L.w / 2 - 0.02, 0, rnd(-L.d / 2 + 0.12, L.d / 2 - 0.12)), n: new THREE.Vector3(-1, 0, 0), off: new THREE.Vector3(-0.05, 0, 0) },
    ];
    const w = walls[Math.floor(Math.random() * walls.length)];
    if (this.world.nav.blocked(w.p.clone().add(w.off), 0, 0.02)) return yield* this.actWander();
    yield { k: 'go', to: w.p.clone().add(w.off), level: 0 };
    yield { k: 'path', wps: [{ p: w.p.clone(), level: 0 }] };
    const top = w.p.clone().setY(rnd(0.12, Math.min(0.3, L.h * 0.4)));
    yield { k: 'path', wps: [{ p: top, climb: true, normal: w.n, level: 2 }] };
    this.exitRoute = [{ p: w.p.clone(), climb: true, normal: w.n, level: 0 }, { p: w.p.clone().add(w.off), level: 0 }];
    yield { k: 'anim', name: 'sniff', dur: rnd(1, 2.5) };
    const ex = this.exitRoute;
    this.exitRoute = null;
    yield { k: 'path', wps: ex };
    this.level = 0;
  }

  // ------------------------------------------------------------------ команды игрока

  *actComeToFront(): Activity {
    const fp = this.world.nav.frontPoint(this.pos.x);
    yield { k: 'go', to: fp, level: 0, run: true };
    yield { k: 'face', dir: new THREE.Vector3(0, 0, 1) };
  }

  *actReceiveTreat(foodId: string): Activity {
    const f = foodDef(foodId);
    yield* this.actComeToFront();
    const hand = this.world.offerHand(this.pos, f?.color ?? '#d8cf9a');
    this.lookTarget = hand;
    yield { k: 'anim', name: 'beg', dur: 0.9 };
    this.world.hideHand();
    this.lookTarget = null;
    this.model.setHeld((f?.shape ?? 'seed') as HeldShape, f?.color ?? '#d8cf9a');
    bus.emit('sound', { name: 'chew' });
    yield { k: 'anim', name: 'eat', dur: rnd(5, 7) };
    this.model.setHeld(null);
    yield { k: 'anim', name: 'wash', dur: 2 };
    this.playerBusy = false;
  }

  *actListen(trust: number): Activity {
    this.lookTarget = this.world.cameraPos;
    bus.emit('sound', { name: 'squeak' });
    yield { k: 'anim', name: 'listen', dur: 1.6 };
    this.lookTarget = null;
    if (trust >= 40) {
      yield* this.actComeToFront();
      this.lookTarget = this.world.cameraPos;
      yield { k: 'anim', name: 'beg', dur: 2.5 };
      this.lookTarget = null;
    } else if (trust >= 20) {
      yield { k: 'anim', name: 'rear', dur: 1.5 };
    }
  }

  *actPetted(): Activity {
    yield* this.actComeToFront();
    yield { k: 'wait', name: 'petted', until: () => !this.playerBusy, max: 600 };
  }

  *actPlay(): Activity {
    yield { k: 'go', to: new THREE.Vector3(this.pos.x * 0.5, 0, 0.05), level: 0, run: true };
    yield { k: 'wait', name: 'idle', until: () => !this.playerBusy, max: 600 };
  }

  /** Погоня за игрушкой (маршрут обновляет World) */
  chase(target: THREE.Vector3) {
    this.route = [{ p: target.clone(), level: 0 }];
    this.ri = 0;
    this.running = true;
    this.step = { k: 'path', wps: this.route, run: true };
    this.stepT = 0;
  }

  pounce() {
    this.step = { k: 'anim', name: 'pounce', dur: 0.6 };
    this.stepT = 0;
    this.setAnim('pounce');
    this.animT = 0;
  }

  *actTrainWait(): Activity {
    yield* this.actComeToFront();
    this.lookTarget = this.world.cameraPos;
    yield { k: 'wait', name: 'idle', until: () => !this.playerBusy, max: 600 };
    this.lookTarget = null;
  }

  *actTrick(trick: TrickId, success: boolean, thenWait: boolean): Activity {
    if (!success) {
      yield { k: 'anim', name: 'confused', dur: 1.4 };
    } else {
      yield* this.trickBody(trick);
      const hand = this.world.offerHand(this.pos, '#d8cf9a');
      this.lookTarget = hand;
      yield { k: 'anim', name: 'beg', dur: 0.8 };
      this.world.hideHand();
      this.lookTarget = null;
      this.model.setHeld('seed', '#d8cf9a');
      yield { k: 'anim', name: 'eat', dur: 1.6 };
      this.model.setHeld(null);
    }
    if (thenWait) {
      yield* this.actComeToFront();
      this.lookTarget = this.world.cameraPos;
      yield { k: 'wait', name: 'idle', until: () => !this.playerBusy, max: 600 };
      this.lookTarget = null;
    }
  }

  private *trickBody(trick: TrickId): Activity {
    const self = this;
    switch (trick) {
      case 'spin': {
        const start = new THREE.Quaternion().copy(this.quat);
        let a = 0;
        yield {
          k: 'wait',
          name: 'spin',
          until: () => {
            a += 0.075;
            self.targetQuat.copy(start).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, a));
            self.quat.copy(self.targetQuat);
            self.model.gaitPhase += 0.06;
            return a >= Math.PI * 2;
          },
          max: 3,
        };
        break;
      }
      case 'stand':
        yield { k: 'anim', name: 'stand', dur: 2.2 };
        break;
      case 'paw':
        yield { k: 'anim', name: 'paw', dur: 2.2 };
        break;
      case 'hoop': {
        const center = this.world.showHoop(this.pos);
        const left = center.clone().add(new THREE.Vector3(-0.16, 0, 0));
        const right = center.clone().add(new THREE.Vector3(0.16, 0, 0));
        this.world.nav.clampToLevel(left, 0);
        this.world.nav.clampToLevel(right, 0);
        yield { k: 'go', to: left, level: 0 };
        yield { k: 'face', dir: new THREE.Vector3(1, 0, 0) };
        yield { k: 'anim', name: 'pounce', dur: 0.3 };
        const mid = center.clone().setY(0.03);
        yield { k: 'path', wps: [{ p: mid, level: 0, speedMul: 1.2 }, { p: right, level: 0 }], run: true };
        this.world.hideHoop();
        yield { k: 'face', dir: new THREE.Vector3(0, 0, 1) };
        yield { k: 'anim', name: 'rear', dur: 0.8 };
        break;
      }
      case 'fetch': {
        const ballPos = this.world.showFetchBall(this.pos);
        yield { k: 'go', to: ballPos.clone().add(new THREE.Vector3(0, 0, 0.05)), level: 0, run: true };
        yield { k: 'face', dir: ballPos.clone().sub(this.pos).setY(0).normalize() };
        yield { k: 'anim', name: 'sniff', dur: 0.5 };
        this.world.grabFetchBall(this);
        yield* this.actComeToFront();
        this.world.dropFetchBall(this);
        yield { k: 'anim', name: 'rear', dur: 0.8 };
        break;
      }
    }
  }

  dispose() {
    this.cleanup();
    this.model.dispose();
  }
}
