import type { SlotKind } from '../store/types';
import { cageDef } from '../store/data/items';

/** Чистые данные о раскладке клетки (без Three.js), используются и стором, и 3D */

export interface SlotDef {
  id: string;
  kind: SlotKind;
  level: 0 | 1; // 0 — пол, 1 — второй этаж
  x: number;
  y: number;
  z: number;
  /** поворот предмета вокруг Y */
  rot: number;
  name: string;
}

export interface CageLayout {
  w: number;
  d: number;
  h: number;
  roof: boolean;
  shelf: null | { x0: number; x1: number; y: number; z0: number; z1: number };
  ramp: null | { from: [number, number, number]; to: [number, number, number]; width: number };
  slots: SlotDef[];
  bottle: { x: number; y: number; z: number; drinkX: number; drinkZ: number };
}

export function buildLayout(cageId: string, secondFloor: boolean): CageLayout {
  const def = cageDef(cageId);
  const [w, d, h] = def.size;
  const hasShelf = secondFloor && def.canSecondFloor;
  const slots: SlotDef[] = [];

  // Напольные слоты: два ряда
  const n = def.floorSlots;
  const cols = Math.ceil(n / 2);
  const marginL = 0.27;
  const marginR = 0.14;
  const zBack = -d * 0.14;
  const zFront = d * 0.24;
  let k = 0;
  for (let row = 0; row < 2; row++) {
    for (let c = 0; c < cols && k < n; c++) {
      const t = cols === 1 ? 0.5 : c / (cols - 1);
      const x = -w / 2 + marginL + t * (w - marginL - marginR);
      const z = row === 0 ? zBack : zFront;
      slots.push({ id: `f${k}`, kind: 'floor', level: 0, x, y: 0, z, rot: row === 0 ? 0 : Math.PI, name: `Пол ${k + 1}` });
      k++;
    }
  }

  let shelf: CageLayout['shelf'] = null;
  let ramp: CageLayout['ramp'] = null;
  if (hasShelf) {
    const sy = h * 0.48;
    const x0 = w / 2 - w * 0.46;
    shelf = { x0, x1: w / 2 - 0.01, y: sy, z0: -d / 2 + 0.01, z1: d / 2 - 0.01 };
    const rz = -d / 2 + 0.065;
    ramp = { from: [x0 - 0.36, 0, rz], to: [x0 + 0.04, sy, rz], width: 0.09 };
    const sw = shelf.x1 - shelf.x0;
    slots.push({ id: 's0', kind: 'floor', level: 1, x: x0 + sw * 0.3, y: sy, z: d * 0.08, rot: Math.PI, name: '2 этаж, слева' });
    slots.push({ id: 's1', kind: 'floor', level: 1, x: x0 + sw * 0.75, y: sy, z: d * 0.08, rot: Math.PI, name: '2 этаж, справа' });
  }

  // Подвесные слоты под крышей
  if (def.roof) {
    const hn = def.hangSlots;
    for (let i = 0; i < hn; i++) {
      const t = hn === 1 ? 0.5 : i / (hn - 1);
      const x = -w / 2 + 0.2 + t * (w - 0.4);
      slots.push({ id: `h${i}`, kind: 'hang', level: 0, x, y: h - 0.01, z: -d / 2 + 0.12, rot: 0, name: `Подвес ${i + 1}` });
    }
  }

  const bottle = { x: -w / 2 + 0.02, y: 0.16, z: d * 0.05, drinkX: -w / 2 + 0.11, drinkZ: d * 0.05 };
  return { w, d, h, roof: def.roof, shelf, ramp, slots, bottle };
}
