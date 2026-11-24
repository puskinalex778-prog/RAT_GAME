import { defaultPose, type PoseParams } from '../rats/RatModel';

/** Имена процедурных анимаций */
export type AnimName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sniff'
  | 'rear'
  | 'wash'
  | 'scratch'
  | 'groomSelf'
  | 'eat'
  | 'drink'
  | 'climb'
  | 'sleepCurl'
  | 'sleepHammock'
  | 'sleepStretch'
  | 'groomOther'
  | 'groomed'
  | 'wrestle'
  | 'pounce'
  | 'beg'
  | 'petted'
  | 'listen'
  | 'spin'
  | 'paw'
  | 'stand'
  | 'dig'
  | 'hop'
  | 'confused'
  | 'wheel';

const BASE = defaultPose();

function n(t: number, seed: number): number {
  return Math.sin(t * 0.9 + seed) * 0.6 + Math.sin(t * 2.3 + seed * 1.7) * 0.4;
}

/**
 * Записывает целевую позу для анимации в момент t (секунды с начала анимации).
 * Модель сама плавно интерполирует к целевым значениям.
 */
export function applyAnim(target: PoseParams, name: AnimName, t: number, seed: number, moving: boolean, lookYaw: number): void {
  Object.assign(target, BASE);
  const s = seed;
  switch (name) {
    case 'idle':
      target.sniff = 0.35 + 0.3 * Math.max(0, n(t * 0.7, s));
      target.headYaw = n(t * 0.35, s) * 0.5 + lookYaw;
      target.headPitch = -0.05 + n(t * 0.3, s + 3) * 0.15;
      target.crouch = 0.1;
      break;
    case 'walk':
      target.gait = 1;
      target.sniff = 0.6;
      target.headPitch = -0.12 + Math.sin(t * 3) * 0.05;
      target.headYaw = n(t * 0.8, s) * 0.2;
      target.stretch = 0.15;
      break;
    case 'run':
      target.gait = 1;
      target.stretch = 0.55;
      target.crouch = 0.25;
      target.sniff = 0.3;
      target.headPitch = -0.05;
      target.earPerk = 0.4;
      break;
    case 'climb':
      target.gait = 0.9;
      target.climb = 1;
      target.stretch = 0.35;
      target.sniff = 0.4;
      target.headPitch = 0.1;
      break;
    case 'sniff':
      target.crouch = 0.3;
      target.stretch = 0.35;
      target.sniff = 1;
      target.headPitch = -0.35 + Math.sin(t * 1.5 + s) * 0.15;
      target.headYaw = n(t * 0.9, s) * 0.45;
      break;
    case 'rear':
      target.rear = 1;
      target.frontLift = 1;
      target.sniff = 0.9;
      target.earPerk = 0.6;
      target.headYaw = Math.sin(t * 0.8 + s) * 0.7 + lookYaw;
      target.headPitch = 0.15 + Math.sin(t * 1.3) * 0.1;
      break;
    case 'beg':
      target.rear = 1;
      target.frontLift = 1;
      target.sniff = 1;
      target.earPerk = 0.8;
      target.headPitch = 0.25;
      target.headYaw = lookYaw;
      break;
    case 'wash': {
      target.rear = 0.6;
      target.frontLift = 1;
      target.wash = 1;
      target.headPitch = -0.25 + Math.sin(t * 9) * 0.06;
      target.squint = 0.55;
      target.sniff = 0;
      break;
    }
    case 'scratch':
      target.scratch = 1;
      target.yaw = 0.7;
      target.headYaw = 0.8;
      target.crouch = 0.25;
      target.squint = 0.5;
      target.headRoll = 0.2;
      break;
    case 'groomSelf': {
      const ph = t % 9;
      if (ph < 3.5) {
        target.rear = 0.6;
        target.frontLift = 1;
        target.wash = 1;
        target.headPitch = -0.25 + Math.sin(t * 9) * 0.06;
        target.squint = 0.55;
      } else if (ph < 6) {
        target.yaw = 0.9;
        target.headYaw = 1.4;
        target.headPitch = -0.35 + Math.sin(t * 12) * 0.05;
        target.crouch = 0.3;
        target.squint = 0.6;
        target.chew = 0.6;
      } else {
        target.scratch = 1;
        target.yaw = 0.6;
        target.headYaw = 0.7;
        target.crouch = 0.25;
        target.squint = 0.5;
      }
      target.sniff = 0;
      break;
    }
    case 'eat':
      target.rear = 0.62;
      target.frontLift = 1;
      target.hold = 1;
      target.chew = 1;
      target.headPitch = -0.1 + Math.sin(t * 2.2) * 0.05;
      target.squint = 0.25;
      target.sniff = 0.2;
      break;
    case 'drink':
      target.rear = 0.35;
      target.frontLift = 0.4;
      target.headPitch = 0.45;
      target.chew = 0.9;
      target.sniff = 0.3;
      target.squint = 0.3;
      break;
    case 'sleepCurl':
      target.curl = 1;
      target.lie = 1;
      target.tailCurl = 1;
      target.squint = 1;
      target.sniff = 0;
      target.breath = 1.2;
      target.earPerk = -0.5;
      break;
    case 'sleepHammock':
      target.curl = 0.65;
      target.lie = 1;
      target.tailCurl = 0;
      target.squint = 1;
      target.sniff = 0;
      target.earPerk = -0.5;
      break;
    case 'sleepStretch':
      target.lie = 1;
      target.stretch = 0.4;
      target.squint = 1;
      target.sniff = 0;
      target.headPitch = -0.25;
      target.tailCurl = 0.3;
      target.earPerk = -0.4;
      break;
    case 'groomOther':
      target.crouch = 0.2;
      target.stretch = 0.3;
      target.headPitch = -0.3 + Math.sin(t * 6) * 0.08;
      target.headYaw = Math.sin(t * 2) * 0.25;
      target.sniff = 1;
      target.chew = 0.7;
      target.frontLift = 0.25;
      break;
    case 'groomed':
      target.crouch = 0.35;
      target.squint = 0.75;
      target.earPerk = -0.4;
      target.sniff = 0.1;
      target.headPitch = -0.15;
      break;
    case 'wrestle': {
      const ph = (t * 1.6 + s) % 2;
      if (ph < 1) {
        target.rear = 0.8;
        target.frontLift = 1;
        target.headYaw = Math.sin(t * 7) * 0.4;
      } else {
        target.crouch = 0.5;
        target.stretch = 0.6;
        target.yaw = Math.sin(t * 5) * 0.8;
      }
      target.earPerk = 0.5;
      target.sniff = 0.8;
      break;
    }
    case 'pounce': {
      const k = Math.min(1, t / 0.35);
      target.crouch = k < 0.5 ? 0.7 : 0.1;
      target.stretch = k < 0.5 ? 0 : 0.8;
      target.frontLift = k > 0.5 && k < 0.9 ? 0.6 : 0;
      target.earPerk = 0.8;
      target.sniff = 0.6;
      break;
    }
    case 'petted':
      target.squint = 0.85;
      target.crouch = 0.4;
      target.earPerk = -0.6;
      target.chew = 0.5;
      target.sniff = 0.1;
      target.headPitch = -0.08 + lookYaw * 0;
      target.yaw = Math.sin(t * 0.7) * 0.15;
      break;
    case 'listen':
      target.rear = 0.35;
      target.frontLift = 0.5;
      target.earPerk = 1;
      target.headYaw = lookYaw;
      target.headPitch = 0.15;
      target.sniff = 1;
      break;
    case 'spin':
      target.gait = 0.8;
      target.yaw = 0.9;
      target.headYaw = 0.6;
      target.crouch = 0.2;
      target.earPerk = 0.5;
      break;
    case 'paw':
      target.rear = 0.45;
      target.pawRaise = 1;
      target.frontLift = 0.3;
      target.headPitch = 0.2;
      target.earPerk = 0.6;
      target.sniff = 0.7;
      break;
    case 'stand':
      target.rear = 1;
      target.frontLift = 1;
      target.headPitch = 0.3;
      target.earPerk = 0.8;
      target.sniff = 0.8;
      break;
    case 'dig':
      target.crouch = 0.45;
      target.headPitch = -0.5;
      target.gait = 0.6;
      target.sniff = 1;
      target.stretch = 0.2;
      break;
    case 'hop':
      target.crouch = Math.sin(t * 8) > 0 ? 0.4 : 0;
      target.stretch = 0.3;
      target.earPerk = 0.7;
      break;
    case 'confused':
      target.sniff = 1;
      target.headYaw = Math.sin(t * 3) * 0.7;
      target.headPitch = -0.2;
      target.crouch = 0.15;
      break;
    case 'wheel':
      target.gait = 1;
      target.stretch = 0.5;
      target.crouch = 0.2;
      target.earPerk = 0.3;
      break;
  }
  if (moving && name !== 'run' && name !== 'climb' && name !== 'wheel') target.gait = 1;
}
