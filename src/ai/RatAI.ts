import * as THREE from 'three';
import type { RatBehaviorState, RatEntity, TrickId } from '../types/game';
import type { CageBounds, InteractiveFurnitureAnchor } from '../cage/CageBuilder';
import { PERSONALITIES, getLifeStage } from '../rats/coatPresets';
import { soundEngine } from '../audio/SoundEngine';

export const BEHAVIOR_LABELS: Record<RatBehaviorState, string> = {
  idle: 'Отдыхает',
  walk: 'Гуляет',
  run: 'Резвится',
  sniff: 'Обнюхивает',
  rear_up: 'Осматривается',
  groom_face: 'Умывается',
  groom_body: 'Чистит шубку',
  eat: 'Лакомится',
  drink: 'Пьёт водичку',
  carry_paper: 'Обустраивает гнездо',
  climb: 'Лезет на 2-й этаж',
  tunnel: 'Ползёт по туннелю',
  sleep_hammock: 'Спит в гамаке',
  sleep_house: 'Уютно дремлет',
  social_groom: 'Ухаживает за другом',
  play_wrestle: 'Весело возится',
  come_to_player: 'Бежит к тебе!',
  being_petted: 'Мурлычет от ласки',
  chase_toy: 'Охотится за игрушкой',
  perform_trick: 'Выполняет трюк!',
};

export interface RatAIContext {
  bounds: CageBounds;
  hasSecondFloor: boolean;
  anchors: InteractiveFurnitureAnchor[];
  allAgents: RatAIAgent[];
  toyTarget: THREE.Vector3 | null;
}

export class RatAIAgent {
  public readonly ratId: string;
  public position = new THREE.Vector3(0, 0.08, 0);
  public yaw = 0;
  public speed = 0;
  public turnRate = 0;
  public level: 0 | 1 = 0;

  public behavior: RatBehaviorState = 'idle';
  public behaviorTime = 0;
  public stateDuration = 3.0;
  public energy = 0.65 + Math.random() * 0.3; // 0..1 natural activity-rest wave
  public activeTrick: TrickId | null = null;
  public heldItem: 'none' | 'treat' | 'paper' | 'ball' = 'none';
  public climbPitch = 0;
  public pettingTimer = 0;

  // Navigation targets
  private targetPos = new THREE.Vector3();
  private hasWaypoint = false;
  private postArrivalState: RatBehaviorState | null = null;
  private postArrivalDuration = 4;
  private postArrivalAnchor: InteractiveFurnitureAnchor | null = null;
  private climbFrom = new THREE.Vector3();
  private climbTo = new THREE.Vector3();
  private climbProgress = 0;
  private climbDestLevel: 0 | 1 = 0;
  private tunnelStart = new THREE.Vector3();
  private tunnelEnd = new THREE.Vector3();
  private tunnelProgress = 0;
  private soundCooldown = 2 + Math.random() * 4;
  private partnerId: string | null = null;

  constructor(ratId: string, startPos?: THREE.Vector3) {
    this.ratId = ratId;
    if (startPos) {
      this.position.copy(startPos);
    } else {
      this.position.set((Math.random() - 0.5) * 1.1, 0.08, (Math.random() - 0.5) * 0.6);
    }
    this.yaw = (Math.random() - 0.5) * Math.PI * 2;
    this.stateDuration = 2 + Math.random() * 2.5;
  }

  public getAgeScale(rat: RatEntity): number {
    const stage = getLifeStage(rat.ageDays);
    switch (stage) {
      case 'pup':
        return 0.66;
      case 'juvenile':
        return 0.84;
      case 'adult':
        return 1.0;
      case 'senior':
        return 1.03;
    }
  }

  /** Player calls rat by name */
  public commandComeToPlayer(bounds: CageBounds, trust: number) {
    if (this.level === 1) {
      // Come down ramp first or to front edge of 2nd floor
      this.targetPos.set(0.05, bounds.secondFloorY, bounds.secondFloorMaxZ - 0.04);
    } else {
      this.targetPos.set((Math.random() - 0.5) * 0.35, bounds.floorY, bounds.maxZ - 0.1);
    }
    this.behavior = 'come_to_player';
    this.behaviorTime = 0;
    this.stateDuration = 4.5;
    this.hasWaypoint = true;
    this.postArrivalState = trust >= 25 ? 'rear_up' : 'sniff';
    this.postArrivalDuration = 3.5;
    this.heldItem = 'none';
    soundEngine.playSqueak(1.06);
  }

  /** Player offers a treat */
  public commandGiveTreat(bounds: CageBounds) {
    this.behavior = 'come_to_player';
    this.behaviorTime = 0;
    this.stateDuration = 3.5;
    this.targetPos.set(
      THREE.MathUtils.clamp(this.position.x * 0.5, bounds.minX + 0.2, bounds.maxX - 0.2),
      this.level === 1 ? bounds.secondFloorY : bounds.floorY,
      this.level === 1 ? bounds.secondFloorMaxZ - 0.06 : bounds.maxZ - 0.14
    );
    this.hasWaypoint = true;
    this.postArrivalState = 'eat';
    this.postArrivalDuration = 5.2;
    this.heldItem = 'treat';
    soundEngine.playSqueak(1.12);
  }

  /** Player pets the rat */
  public triggerPetting() {
    this.pettingTimer = 0.65;
    if (this.behavior !== 'being_petted') {
      this.behavior = 'being_petted';
      this.behaviorTime = 0;
      this.stateDuration = 1.6;
      this.hasWaypoint = false;
      this.speed = 0;
      soundEngine.playBrux();
    }
  }

  /** Player commands a learned or training trick */
  public commandTrick(trick: TrickId) {
    this.behavior = 'perform_trick';
    this.activeTrick = trick;
    this.behaviorTime = 0;
    this.stateDuration = trick === 'fetch' ? 3.2 : 2.6;
    this.hasWaypoint = false;
    this.heldItem = trick === 'fetch' ? 'ball' : 'none';
    soundEngine.playSqueak(1.15);
  }

  /** Player plays toy mini-game */
  public commandChaseToy() {
    if (this.level === 1) {
      // Gently stay on same level or bring down
      this.level = 0;
      this.position.y = 0.08;
    }
    this.behavior = 'chase_toy';
    this.behaviorTime = 0;
    this.stateDuration = 10;
    this.hasWaypoint = false;
    this.heldItem = 'none';
  }

  public stopInteractiveMode() {
    if (this.behavior === 'chase_toy' || this.behavior === 'being_petted') {
      this.behavior = 'idle';
      this.behaviorTime = 0;
      this.stateDuration = 2.0;
    }
  }

  public update(dt: number, rat: RatEntity, ctx: RatAIContext) {
    const cdt = Math.min(dt, 0.05);
    this.behaviorTime += cdt;
    this.soundCooldown -= cdt;
    this.climbPitch = 0;

    // Petting decay
    if (this.pettingTimer > 0) {
      this.pettingTimer -= cdt;
      this.speed = 0;
      this.turnRate = 0;
      if (this.pettingTimer <= 0 && this.behavior === 'being_petted') {
        this.behavior = 'groom_face';
        this.behaviorTime = 0;
        this.stateDuration = 2.5;
      }
      return;
    }

    // Natural activity / rest cycle energy update
    if (this.behavior === 'sleep_hammock' || this.behavior === 'sleep_house') {
      this.energy = Math.min(1, this.energy + cdt * 0.048);
    } else if (this.behavior === 'idle' || this.behavior === 'groom_face' || this.behavior === 'groom_body') {
      this.energy = Math.min(1, this.energy + cdt * 0.008);
    } else {
      this.energy = Math.max(0.05, this.energy - cdt * 0.016);
    }

    // Keep rat within valid floor if 2nd floor removed or cage changed
    if (this.level === 1 && !ctx.hasSecondFloor) {
      this.level = 0;
      this.position.y = ctx.bounds.floorY;
    }

    // Special interactive chase-toy mode
    if (this.behavior === 'chase_toy') {
      if (ctx.toyTarget) {
        const target = ctx.toyTarget.clone();
        target.y = ctx.bounds.floorY;
        const dist = this.steerTowards(target, 0.92, cdt, ctx.bounds);
        if (dist < 0.16 && this.soundCooldown <= 0) {
          soundEngine.playSqueak(1.18);
          this.soundCooldown = 1.6;
        }
      } else {
        this.speed = THREE.MathUtils.lerp(this.speed, 0, cdt * 6);
      }
      return;
    }

    // Special climbing ramp trajectory (1st <-> 2nd floor)
    if (this.behavior === 'climb') {
      this.climbProgress += cdt * 0.55;
      const t = Math.min(1, this.climbProgress);
      this.position.lerpVectors(this.climbFrom, this.climbTo, t);
      const dx = this.climbTo.x - this.climbFrom.x;
      const dz = this.climbTo.z - this.climbFrom.z;
      const dy = this.climbTo.y - this.climbFrom.y;
      const targetYaw = Math.atan2(dx, dz);
      this.yaw = this.lerpAngle(this.yaw, targetYaw, cdt * 8);
      this.climbPitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 0.72;
      this.speed = 0.45;
      this.turnRate = 0;

      if (t >= 1) {
        this.level = this.climbDestLevel;
        this.position.y = this.level === 1 ? ctx.bounds.secondFloorY : ctx.bounds.floorY;
        this.behavior = 'sniff';
        this.behaviorTime = 0;
        this.stateDuration = 2.4;
      }
      return;
    }

    // Special crawling through tunnel trajectory
    if (this.behavior === 'tunnel') {
      this.tunnelProgress += cdt * 0.52;
      const t = Math.min(1, this.tunnelProgress);
      this.position.lerpVectors(this.tunnelStart, this.tunnelEnd, t);
      const dx = this.tunnelEnd.x - this.tunnelStart.x;
      const dz = this.tunnelEnd.z - this.tunnelStart.z;
      this.yaw = this.lerpAngle(this.yaw, Math.atan2(dx, dz), cdt * 10);
      this.speed = 0.44;
      this.turnRate = 0;
      if (t >= 1) {
        this.behavior = 'rear_up';
        this.behaviorTime = 0;
        this.stateDuration = 2.2;
      }
      return;
    }

    // Sleeping in hammock gently settles into the hammock sling
    if (this.behavior === 'sleep_hammock' && this.postArrivalAnchor) {
      const slingPos = this.postArrivalAnchor.position.clone();
      slingPos.y -= 0.08;
      this.position.lerp(slingPos, cdt * 5);
      this.yaw = this.lerpAngle(this.yaw, this.postArrivalAnchor.rotationY + 0.4, cdt * 4);
      this.speed = 0;
      this.turnRate = 0;
      if (this.behaviorTime >= this.stateDuration) {
        // Gently hop back down to floor
        this.position.y = this.level === 1 ? ctx.bounds.secondFloorY : ctx.bounds.floorY;
        this.postArrivalAnchor = null;
        this.pickNextBehavior(rat, ctx);
      }
      return;
    }

    // Moving towards waypoint
    if (this.hasWaypoint) {
      const desiredSpeed =
        this.behavior === 'run' || this.behavior === 'come_to_player'
          ? 0.72
          : this.behavior === 'carry_paper'
          ? 0.42
          : 0.36;
      const dist = this.steerTowards(this.targetPos, desiredSpeed, cdt, ctx.bounds);

      if (this.soundCooldown <= 0 && (this.behavior === 'walk' || this.behavior === 'run')) {
        if (Math.random() < 0.25) soundEngine.playRustle();
        this.soundCooldown = 4 + Math.random() * 5;
      }

      if (dist < 0.11 || this.behaviorTime > 7.5) {
        this.hasWaypoint = false;
        this.speed = 0;
        if (this.postArrivalState) {
          const next = this.postArrivalState;
          this.postArrivalState = null;
          this.enterArrivedState(next, ctx);
          return;
        }
        this.pickNextBehavior(rat, ctx);
      }
      return;
    }

    // Stationary / animated behaviors
    this.speed = THREE.MathUtils.lerp(this.speed, 0, cdt * 7);
    this.turnRate = THREE.MathUtils.lerp(this.turnRate, 0, cdt * 7);

    // Subtle ambient sounds for eating / drinking / wrestling
    if (this.soundCooldown <= 0) {
      if (this.behavior === 'eat') {
        soundEngine.playNibble();
        this.soundCooldown = 1.4;
      } else if (this.behavior === 'drink') {
        soundEngine.playDrink();
        this.soundCooldown = 1.6;
      } else if (this.behavior === 'play_wrestle') {
        soundEngine.playSqueak(1.0 + Math.random() * 0.2);
        this.soundCooldown = 1.8;
      }
    }

    // Face partner during social grooming or play wrestling
    if ((this.behavior === 'social_groom' || this.behavior === 'play_wrestle') && this.partnerId) {
      const partner = ctx.allAgents.find((a) => a.ratId === this.partnerId);
      if (partner) {
        const dx = partner.position.x - this.position.x;
        const dz = partner.position.z - this.position.z;
        this.yaw = this.lerpAngle(this.yaw, Math.atan2(dx, dz), cdt * 6);
      }
    }

    // Face front of cage nicely when rearing up for player
    if (this.behavior === 'rear_up' || this.behavior === 'perform_trick') {
      this.yaw = this.lerpAngle(this.yaw, 0, cdt * 4);
    }

    // Transition when state duration completes
    if (this.behaviorTime >= this.stateDuration) {
      this.activeTrick = null;
      this.heldItem = 'none';
      this.partnerId = null;
      this.pickNextBehavior(rat, ctx);
    }
  }

  private enterArrivedState(next: RatBehaviorState, ctx: RatAIContext) {
    this.behavior = next;
    this.behaviorTime = 0;
    this.stateDuration = this.postArrivalDuration;

    if (next === 'climb') {
      this.climbProgress = 0;
      if (this.level === 0) {
        this.climbFrom.copy(ctx.bounds.rampBottom);
        this.climbTo.copy(ctx.bounds.rampTop);
        this.climbDestLevel = 1;
      } else {
        this.climbFrom.copy(ctx.bounds.rampTop);
        this.climbTo.copy(ctx.bounds.rampBottom);
        this.climbDestLevel = 0;
      }
      return;
    }

    if (next === 'tunnel' && this.postArrivalAnchor) {
      const dir = new THREE.Vector3(Math.cos(this.postArrivalAnchor.rotationY), 0, -Math.sin(this.postArrivalAnchor.rotationY));
      this.tunnelStart.copy(this.postArrivalAnchor.position).addScaledVector(dir, -0.28);
      this.tunnelEnd.copy(this.postArrivalAnchor.position).addScaledVector(dir, 0.28);
      this.tunnelStart.y = this.level === 1 ? ctx.bounds.secondFloorY : ctx.bounds.floorY;
      this.tunnelEnd.y = this.tunnelStart.y;
      this.tunnelProgress = 0;
      soundEngine.playRustle();
      return;
    }

    if (next === 'eat') {
      this.heldItem = 'treat';
      soundEngine.playNibble();
      return;
    }

    if (next === 'drink') {
      soundEngine.playDrink();
      return;
    }

    if (next === 'carry_paper') {
      // Arrived at house with paper -> drop it and groom/rest!
      this.heldItem = 'none';
      this.behavior = 'sniff';
      this.stateDuration = 2.0;
      soundEngine.playRustle();
    }
  }

  private pickNextBehavior(rat: RatEntity, ctx: RatAIContext) {
    const pWeights = PERSONALITIES[rat.personality].weights;
    this.behaviorTime = 0;
    this.postArrivalState = null;
    this.postArrivalAnchor = null;
    this.heldItem = 'none';
    this.partnerId = null;

    // Build weighted utility options
    const candidates: { action: () => void; weight: number }[] = [];

    const floorY = this.level === 1 ? ctx.bounds.secondFloorY : ctx.bounds.floorY;

    // 1. Sleep / Rest when energy is low (prevents endless hyperactive running!)
    const sleepUrgency = this.energy < 0.35 ? 5.5 : this.energy < 0.55 ? 1.8 : 0.35;
    const hammocks = ctx.anchors.filter(
      (a) => a.category === 'hammocks' && a.level === this.level
    );
    const houses = ctx.anchors.filter(
      (a) => a.category === 'houses' && a.level === this.level
    );

    if (hammocks.length > 0) {
      candidates.push({
        weight: sleepUrgency * pWeights.rest * 1.45,
        action: () => {
          const h = hammocks[Math.floor(Math.random() * hammocks.length)];
          this.postArrivalAnchor = h;
          this.targetPos.set(h.position.x, floorY, h.position.z);
          this.behavior = 'walk';
          this.hasWaypoint = true;
          this.postArrivalState = 'sleep_hammock';
          this.postArrivalDuration = 9 + Math.random() * 8;
        },
      });
    }

    candidates.push({
      weight: sleepUrgency * pWeights.rest * 1.15,
      action: () => {
        if (houses.length > 0) {
          const house = houses[Math.floor(Math.random() * houses.length)];
          this.targetPos.set(house.position.x, floorY, house.position.z + 0.12);
          this.behavior = 'walk';
          this.hasWaypoint = true;
          this.postArrivalState = 'sleep_house';
          this.postArrivalDuration = 8 + Math.random() * 8;
        } else {
          this.behavior = 'sleep_house';
          this.stateDuration = 7 + Math.random() * 6;
        }
      },
    });

    // 2. Casual walk & explore
    candidates.push({
      weight: 2.2 * pWeights.explore,
      action: () => {
        this.targetPos.copy(this.randomPointOnLevel(ctx.bounds));
        this.behavior = Math.random() < 0.28 && this.energy > 0.5 ? 'run' : 'walk';
        this.hasWaypoint = true;
        this.postArrivalState = Math.random() < 0.55 ? 'sniff' : 'rear_up';
        this.postArrivalDuration = 2.4 + Math.random() * 2.2;
      },
    });

    // 3. Sniff / Rear up on hind legs
    candidates.push({
      weight: 1.5 * pWeights.explore,
      action: () => {
        this.behavior = Math.random() < 0.5 ? 'sniff' : 'rear_up';
        this.stateDuration = 2.4 + Math.random() * 2.4;
      },
    });

    // 4. Self-grooming (face washing & body grooming)
    candidates.push({
      weight: 1.75 * pWeights.rest,
      action: () => {
        this.behavior = Math.random() < 0.58 ? 'groom_face' : 'groom_body';
        this.stateDuration = 3.2 + Math.random() * 2.5;
      },
    });

    // 5. Eat from bowl (or snack)
    const bowls = ctx.anchors.filter(
      (a) => (a.itemId === 'bowl_ceramic' || a.itemId === 'puzzle_feeder') && a.level === this.level
    );
    const hungerUrgency = rat.stats.hunger < 65 ? 3.2 : 1.1;
    candidates.push({
      weight: hungerUrgency * pWeights.food,
      action: () => {
        if (bowls.length > 0) {
          const b = bowls[Math.floor(Math.random() * bowls.length)];
          this.targetPos.set(b.position.x, floorY, b.position.z + 0.16);
          this.behavior = 'walk';
          this.hasWaypoint = true;
          this.postArrivalState = 'eat';
          this.postArrivalDuration = 4.2 + Math.random() * 2.5;
        } else {
          this.behavior = 'eat';
          this.heldItem = 'treat';
          this.stateDuration = 3.8;
        }
      },
    });

    // 6. Drink from water bottle
    const bottles = ctx.anchors.filter((a) => a.itemId === 'water_bottle');
    if (bottles.length > 0 && this.level === 0) {
      candidates.push({
        weight: 1.15 * pWeights.food,
        action: () => {
          const b = bottles[0];
          this.targetPos.set(b.position.x - 0.18, floorY, b.position.z);
          this.behavior = 'walk';
          this.hasWaypoint = true;
          this.postArrivalState = 'drink';
          this.postArrivalDuration = 3.2 + Math.random() * 2;
        },
      });
    }

    // 7. Carry nesting paper to house!
    const papers = ctx.anchors.filter((a) => a.itemId === 'care_paper' && a.level === this.level);
    if (papers.length > 0 || houses.length > 0) {
      candidates.push({
        weight: 1.05 * pWeights.play,
        action: () => {
          const dest = houses.length > 0
            ? new THREE.Vector3(houses[0].position.x, floorY, houses[0].position.z + 0.14)
            : this.randomPointOnLevel(ctx.bounds);
          this.targetPos.copy(dest);
          this.behavior = 'carry_paper';
          this.heldItem = 'paper';
          this.hasWaypoint = true;
          this.postArrivalState = 'carry_paper';
          this.postArrivalDuration = 2.0;
        },
      });
    }

    // 8. Crawl through a placed tunnel!
    const tunnels = ctx.anchors.filter((a) => a.category === 'tunnels' && a.level === this.level);
    if (tunnels.length > 0 && this.energy > 0.3) {
      candidates.push({
        weight: 1.65 * pWeights.explore,
        action: () => {
          const tun = tunnels[Math.floor(Math.random() * tunnels.length)];
          this.postArrivalAnchor = tun;
          const dir = new THREE.Vector3(Math.cos(tun.rotationY), 0, -Math.sin(tun.rotationY));
          this.targetPos.copy(tun.position).addScaledVector(dir, -0.3);
          this.targetPos.y = floorY;
          this.behavior = 'walk';
          this.hasWaypoint = true;
          this.postArrivalState = 'tunnel';
          this.postArrivalDuration = 3.0;
        },
      });
    }

    // 9. Climb ramp to 2nd floor (or climb back down)!
    if (ctx.hasSecondFloor && this.energy > 0.32) {
      candidates.push({
        weight: 1.45 * pWeights.climb,
        action: () => {
          this.targetPos.copy(this.level === 0 ? ctx.bounds.rampBottom : ctx.bounds.rampTop);
          this.behavior = 'walk';
          this.hasWaypoint = true;
          this.postArrivalState = 'climb';
          this.postArrivalDuration = 3.0;
        },
      });
    }

    // 10. Social grooming & playful wrestling with another rat on the same level!
    const peers = ctx.allAgents.filter(
      (a) =>
        a.ratId !== this.ratId &&
        a.level === this.level &&
        a.behavior !== 'climb' &&
        a.behavior !== 'sleep_hammock' &&
        a.behavior !== 'tunnel'
    );
    if (peers.length > 0 && this.energy > 0.35) {
      candidates.push({
        weight: 1.9 * pWeights.social,
        action: () => {
          const peer = peers[Math.floor(Math.random() * peers.length)];
          this.partnerId = peer.ratId;
          const offset = new THREE.Vector3(0.2, 0, 0.08);
          this.targetPos.copy(peer.position).add(offset);
          this.targetPos.y = floorY;
          this.behavior = 'run';
          this.hasWaypoint = true;
          const wrestle = Math.random() < 0.45 * pWeights.play;
          this.postArrivalState = wrestle ? 'play_wrestle' : 'social_groom';
          this.postArrivalDuration = 3.6 + Math.random() * 2.5;
        },
      });
    }

    // Weighted random pick
    const total = candidates.reduce((acc, c) => acc + c.weight, 0);
    let r = Math.random() * total;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) {
        c.action();
        return;
      }
    }
    candidates[0].action();
  }

  private randomPointOnLevel(bounds: CageBounds): THREE.Vector3 {
    if (this.level === 1) {
      return new THREE.Vector3(
        THREE.MathUtils.lerp(bounds.secondFloorMinX, bounds.secondFloorMaxX, Math.random()),
        bounds.secondFloorY,
        THREE.MathUtils.lerp(bounds.secondFloorMinZ, bounds.secondFloorMaxZ, Math.random())
      );
    }
    return new THREE.Vector3(
      THREE.MathUtils.lerp(bounds.minX + 0.08, bounds.maxX - 0.08, Math.random()),
      bounds.floorY,
      THREE.MathUtils.lerp(bounds.minZ + 0.08, bounds.maxZ - 0.08, Math.random())
    );
  }

  private steerTowards(target: THREE.Vector3, maxSpeed: number, dt: number, bounds: CageBounds): number {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.02) {
      const desiredYaw = Math.atan2(dx, dz);
      const prevYaw = this.yaw;
      this.yaw = this.lerpAngle(this.yaw, desiredYaw, dt * 6.5);
      this.turnRate = (this.yaw - prevYaw) / Math.max(dt, 0.001);

      const moveSpeed = Math.min(maxSpeed, dist * 3.5);
      this.speed = THREE.MathUtils.lerp(this.speed, moveSpeed, dt * 8);

      this.position.x += Math.sin(this.yaw) * this.speed * dt;
      this.position.z += Math.cos(this.yaw) * this.speed * dt;

      // Soft clamp within current level bounds
      if (this.level === 1) {
        this.position.x = THREE.MathUtils.clamp(this.position.x, bounds.secondFloorMinX, bounds.secondFloorMaxX);
        this.position.z = THREE.MathUtils.clamp(this.position.z, bounds.secondFloorMinZ, bounds.secondFloorMaxZ);
        this.position.y = bounds.secondFloorY;
      } else {
        this.position.x = THREE.MathUtils.clamp(this.position.x, bounds.minX, bounds.maxX);
        this.position.z = THREE.MathUtils.clamp(this.position.z, bounds.minZ, bounds.maxZ);
        this.position.y = bounds.floorY;
      }
    } else {
      this.speed = 0;
      this.turnRate = 0;
    }

    return dist;
  }

  private lerpAngle(current: number, target: number, alpha: number): number {
    let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * Math.min(1, alpha);
  }
}
