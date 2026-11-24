import type { Appearance, LifespanId, PersonalityId, RatData, Settings } from './types';
import { allowedEyes } from './data/coats';

export const LIFESPANS: { id: LifespanId; name: string; ms: number }[] = [
  { id: '1h', name: '1 час', ms: 3600_000 },
  { id: '3h', name: '3 часа', ms: 3 * 3600_000 },
  { id: '1d', name: '1 день', ms: 86400_000 },
  { id: '2d', name: '2 дня', ms: 2 * 86400_000 },
  { id: '1w', name: '1 неделя', ms: 7 * 86400_000 },
  { id: '1m', name: '1 месяц', ms: 30 * 86400_000 },
  { id: '3m', name: '3 месяца', ms: 90 * 86400_000 },
  { id: 'real', name: 'Как в жизни (~2,5 года)', ms: 912 * 86400_000 },
];

/** Полная жизнь крысы в игровых месяцах */
export const LIFE_MONTHS = 30;

export function lifespanMs(id: LifespanId): number {
  return LIFESPANS.find((l) => l.id === id)?.ms ?? LIFESPANS[5].ms;
}

/** Сколько игровых месяцев проходит за 1 мс реального времени */
export function monthsPerMs(s: Settings): number {
  return LIFE_MONTHS / lifespanMs(s.lifespan);
}

export function stageName(ageMonths: number, sex: 'm' | 'f'): string {
  if (ageMonths < 1.5) return 'крысёнок';
  if (ageMonths < 4) return sex === 'm' ? 'подросток' : 'подросток';
  if (ageMonths < 18) return sex === 'm' ? 'взрослый' : 'взрослая';
  return sex === 'm' ? 'пожилой' : 'пожилая';
}

export function formatAge(ageMonths: number): string {
  if (ageMonths < 1) {
    const w = Math.max(1, Math.round(ageMonths * 4.3));
    return `${w} ${plural(w, 'неделя', 'недели', 'недель')}`;
  }
  const m = Math.floor(ageMonths);
  if (m < 12) return `${m} ${plural(m, 'месяц', 'месяца', 'месяцев')}`;
  const y = Math.floor(m / 12);
  const rest = m % 12;
  const ys = `${y} ${plural(y, 'год', 'года', 'лет')}`;
  return rest ? `${ys} ${rest} мес.` : ys;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** Размер модели в зависимости от возраста и пола */
export function bodyScale(r: Pick<RatData, 'ageMonths' | 'sex'>): number {
  const a = r.ageMonths;
  let s: number;
  if (a < 1) s = 0.42 + a * 0.18;
  else if (a < 4) s = 0.6 + ((a - 1) / 3) * 0.32;
  else if (a < 8) s = 0.92 + ((a - 4) / 4) * 0.08;
  else s = 1;
  return s * (r.sex === 'm' ? 1.08 : 0.96);
}

/** Ожидаемая продолжительность жизни конкретной крысы (мес.) */
export function lifeExpectancy(r: RatData): number {
  const x = Math.sin(r.appearance.seed * 12.9898) * 43758.5453;
  const f = x - Math.floor(x);
  return LIFE_MONTHS * (0.9 + f * 0.2);
}

function pick<T>(a: T, b: T, pa = 0.5): T {
  return Math.random() < pa ? a : b;
}

/** Упрощённое наследование: каждый признак — от одного из родителей, с небольшой вариативностью */
export function inherit(mother: Appearance, father: Appearance): Appearance {
  let color = pick(mother.color, father.color);
  let pattern = pick(mother.pattern, father.pattern);
  // редкие «рецессивные» сюрпризы
  if (Math.random() < 0.08) color = pick('beige', 'blue', 0.5) as Appearance['color'];
  if (Math.random() < 0.06) pattern = pick('hooded', 'berkshire', 0.5) as Appearance['pattern'];
  const ears = Math.random() < (mother.ears === 'dumbo' && father.ears === 'dumbo' ? 1 : mother.ears === 'dumbo' || father.ears === 'dumbo' ? 0.3 : 0.02) ? 'dumbo' : 'standard';
  const coat = Math.random() < (mother.coat === 'rex' || father.coat === 'rex' ? 0.5 : 0.02) ? 'rex' : 'smooth';
  const allowed = allowedEyes(color, pattern);
  const parentEyes = [mother.eyes, father.eyes].filter((e) => allowed.includes(e));
  const eyes = parentEyes.length ? parentEyes[Math.floor(Math.random() * parentEyes.length)] : allowed[0];
  return { preset: null, color, pattern, eyes, ears, coat, seed: Math.floor(Math.random() * 1e9) };
}

const PERS: PersonalityId[] = ['curious', 'affectionate', 'mischievous', 'calm', 'explorer', 'gourmet'];
export function randomPersonality(): PersonalityId {
  return PERS[Math.floor(Math.random() * PERS.length)];
}
