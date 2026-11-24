import * as THREE from 'three';
import type { CageView, Obstacle } from '../cage/CageView';

/** Точка маршрута. normal — «верх» поверхности (для ориентации крысы при лазании) */
export interface Waypoint {
  p: THREE.Vector3;
  climb?: boolean;
  normal?: THREE.Vector3;
  /** уровень после достижения точки: 0 — пол, 1 — полка, 2 — в воздухе (гамак, канат, стенка) */
  level?: 0 | 1 | 2;
  speedMul?: number;
}

export const UP = new THREE.Vector3(0, 1, 0);

export class Nav {
  constructor(private cage: CageView) {}

  get L() {
    return this.cage.layout;
  }

  clampToLevel(p: THREE.Vector3, level: 0 | 1): THREE.Vector3 {
    const L = this.L;
    if (level === 1 && L.shelf) {
      p.x = Math.max(L.shelf.x0 + 0.05, Math.min(L.shelf.x1 - 0.04, p.x));
      p.z = Math.max(L.shelf.z0 + 0.05, Math.min(L.shelf.z1 - 0.05, p.z));
      p.y = L.shelf.y;
    } else {
      p.x = Math.max(-L.w / 2 + 0.05, Math.min(L.w / 2 - 0.05, p.x));
      p.z = Math.max(-L.d / 2 + 0.05, Math.min(L.d / 2 - 0.05, p.z));
      p.y = 0;
    }
    return p;
  }

  randomPoint(level: 0 | 1): THREE.Vector3 {
    const L = this.L;
    for (let i = 0; i < 12; i++) {
      let p: THREE.Vector3;
      if (level === 1 && L.shelf) {
        p = new THREE.Vector3(L.shelf.x0 + 0.05 + Math.random() * (L.shelf.x1 - L.shelf.x0 - 0.1), L.shelf.y, L.shelf.z0 + 0.06 + Math.random() * (L.shelf.z1 - L.shelf.z0 - 0.12));
      } else {
        p = new THREE.Vector3((Math.random() - 0.5) * (L.w - 0.12), 0, (Math.random() - 0.5) * (L.d - 0.12));
      }
      if (!this.blocked(p, level)) return p;
    }
    return this.clampToLevel(new THREE.Vector3(0, 0, 0.1), level);
  }

  blocked(p: THREE.Vector3, level: 0 | 1, margin = 0.03): boolean {
    return this.cage.obstacles.some((o) => o.level === level && Math.hypot(o.x - p.x, o.z - p.z) < o.r + margin);
  }

  /** Точка перед клеткой для общения с игроком */
  frontPoint(nearX = 0): THREE.Vector3 {
    const L = this.L;
    const x = Math.max(-L.w / 2 + 0.16, Math.min(L.w / 2 - 0.16, nearX));
    const p = new THREE.Vector3(x, 0, L.d / 2 - 0.13);
    // сдвинуть, если перед клеткой стоит предмет
    for (let k = 0; k < 8 && this.blocked(p, 0, 0.02); k++) p.x += k % 2 === 0 ? 0.12 * (k + 1) : -0.12 * (k + 1);
    return this.clampToLevel(p, 0);
  }

  /** Обход препятствий на одном уровне */
  private detour(a: THREE.Vector3, b: THREE.Vector3, level: 0 | 1, ignore: Set<string>, depth = 0): THREE.Vector3[] {
    if (depth > 3) return [b];
    const ab = new THREE.Vector3().subVectors(b, a);
    ab.y = 0;
    const len = ab.length();
    if (len < 1e-4) return [b];
    const d = ab.clone().divideScalar(len);
    let best: { t: number; o: Obstacle } | null = null;
    for (const o of this.cage.obstacles) {
      if (o.level !== level || ignore.has(o.slotId)) continue;
      const cx = o.x - a.x;
      const cz = o.z - a.z;
      const t = Math.max(0, Math.min(len, cx * d.x + cz * d.z));
      const px = a.x + d.x * t;
      const pz = a.z + d.z * t;
      const dist = Math.hypot(o.x - px, o.z - pz);
      if (dist < o.r + 0.03 && t > 0.01 && t < len - 0.01) {
        if (!best || t < best.t) best = { t, o };
      }
    }
    if (!best) return [b];
    const o = best.o;
    const n = new THREE.Vector3(-d.z, 0, d.x);
    const px = a.x + d.x * best.t;
    const pz = a.z + d.z * best.t;
    const side = Math.sign((o.x - px) * n.x + (o.z - pz) * n.z) || 1;
    const w = new THREE.Vector3(o.x - n.x * side * (o.r + 0.06), a.y, o.z - n.z * side * (o.r + 0.06));
    this.clampToLevel(w, level);
    ignore.add(o.slotId);
    return [w, ...this.detour(w, b, level, ignore, depth + 1)];
  }

  /** Маршрут между точками (с переходом по пандусу между этажами) */
  plan(from: THREE.Vector3, fromLevel: 0 | 1, to: THREE.Vector3, toLevel: 0 | 1, ignoreSlots: string[] = []): Waypoint[] {
    const out: Waypoint[] = [];
    const ign = () => new Set(ignoreSlots);
    const L = this.L;
    if (fromLevel !== toLevel && L.ramp && L.shelf) {
      const bottom = new THREE.Vector3(...L.ramp.from);
      const top = new THREE.Vector3(...L.ramp.to);
      const rampN = new THREE.Vector3().subVectors(top, bottom).normalize();
      const side = new THREE.Vector3().crossVectors(rampN, UP).normalize();
      const nrm = new THREE.Vector3().crossVectors(side, rampN).normalize();
      if (nrm.y < 0) nrm.negate();
      const bottomIn = bottom.clone().add(new THREE.Vector3(-0.05, 0, 0));
      const topIn = top.clone().add(new THREE.Vector3(0.06, 0, 0));
      if (fromLevel === 0) {
        for (const p of this.detour(from, bottomIn, 0, ign())) out.push({ p, level: 0 });
        out.push({ p: bottom.clone(), level: 0 });
        out.push({ p: top.clone(), climb: true, normal: nrm, level: 1, speedMul: 0.8 });
        out.push({ p: topIn, level: 1 });
        for (const p of this.detour(topIn, to, 1, ign())) out.push({ p, level: 1 });
      } else {
        for (const p of this.detour(from, topIn, 1, ign())) out.push({ p, level: 1 });
        out.push({ p: top.clone(), level: 1 });
        out.push({ p: bottom.clone(), climb: true, normal: nrm, level: 0, speedMul: 0.8 });
        out.push({ p: bottomIn, level: 0 });
        for (const p of this.detour(bottomIn, to, 0, ign())) out.push({ p, level: 0 });
      }
      return out;
    }
    const lv = fromLevel === toLevel ? fromLevel : 0;
    for (const p of this.detour(from, to, lv, ign())) out.push({ p, level: lv });
    return out;
  }
}
