import type { PersonalityId, Sex, TrickId } from '../types';

export interface PersonalityDef {
  id: PersonalityId;
  m: string;
  f: string;
  desc: string;
  /** веса для ИИ-поведения */
  w: {
    explore: number;
    play: number;
    social: number;
    food: number;
    rest: number;
    human: number; // тяга к игроку
    groom: number;
  };
  favToys: string[]; // категории игрушек
  trustGain: number; // множитель роста доверия
  learn: number; // множитель обучения
}

export const PERSONALITIES: PersonalityDef[] = [
  {
    id: 'curious',
    m: 'Любопытный',
    f: 'Любопытная',
    desc: 'Первым проверяет всё новое и часто встаёт столбиком, чтобы осмотреться.',
    w: { explore: 1.4, play: 1.0, social: 1.0, food: 1.0, rest: 0.9, human: 1.1, groom: 0.9 },
    favToys: ['forage', 'tunnel'],
    trustGain: 1.1,
    learn: 1.2,
  },
  {
    id: 'affectionate',
    m: 'Ласковый',
    f: 'Ласковая',
    desc: 'Обожает поглаживания, быстро привязывается и часто подходит к руке.',
    w: { explore: 0.9, play: 0.9, social: 1.4, food: 1.0, rest: 1.0, human: 1.6, groom: 1.2 },
    favToys: ['hammock', 'house'],
    trustGain: 1.5,
    learn: 1.0,
  },
  {
    id: 'mischievous',
    m: 'Озорной',
    f: 'Озорная',
    desc: 'Любит возню, догонялки и шарики. Иногда утаскивает чужие лакомства.',
    w: { explore: 1.1, play: 1.6, social: 1.2, food: 1.1, rest: 0.8, human: 1.0, groom: 0.8 },
    favToys: ['ball', 'wheel'],
    trustGain: 1.0,
    learn: 1.1,
  },
  {
    id: 'calm',
    m: 'Спокойный',
    f: 'Спокойная',
    desc: 'Неторопливый и уравновешенный, долго дремлет в гамаке.',
    w: { explore: 0.8, play: 0.7, social: 1.0, food: 1.0, rest: 1.5, human: 1.0, groom: 1.3 },
    favToys: ['hammock', 'house'],
    trustGain: 1.1,
    learn: 0.9,
  },
  {
    id: 'explorer',
    m: 'Исследователь',
    f: 'Исследовательница',
    desc: 'Лазает по всем лесенкам и туннелям, знает каждый уголок клетки.',
    w: { explore: 1.6, play: 1.1, social: 0.9, food: 0.9, rest: 0.8, human: 0.9, groom: 0.9 },
    favToys: ['tunnel', 'ladder'],
    trustGain: 0.9,
    learn: 1.1,
  },
  {
    id: 'gourmet',
    m: 'Лакомка',
    f: 'Лакомка',
    desc: 'Всегда первым у миски и с радостью учится за угощение.',
    w: { explore: 1.0, play: 0.9, social: 1.0, food: 1.6, rest: 1.1, human: 1.2, groom: 1.0 },
    favToys: ['forage', 'house'],
    trustGain: 1.2,
    learn: 1.3,
  },
];

export function personalityDef(id: PersonalityId): PersonalityDef {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0];
}
export function personalityName(id: PersonalityId, sex: Sex): string {
  const p = personalityDef(id);
  return sex === 'm' ? p.m : p.f;
}

export interface TrickDef {
  id: TrickId;
  name: string;
  desc: string;
  difficulty: number; // сколько успешных повторений нужно (≈)
  minTrust: number;
}

export const TRICKS: TrickDef[] = [
  { id: 'spin', name: 'Поворот', desc: 'Крыска делает круг вокруг себя.', difficulty: 4, minTrust: 15 },
  { id: 'stand', name: 'Стойка', desc: 'Встаёт столбиком на задние лапки.', difficulty: 4, minTrust: 15 },
  { id: 'paw', name: 'Лапка', desc: 'Протягивает переднюю лапку к руке.', difficulty: 5, minTrust: 30 },
  { id: 'hoop', name: 'Через кольцо', desc: 'Пробегает сквозь маленькое кольцо.', difficulty: 6, minTrust: 40 },
  { id: 'fetch', name: 'Принеси шарик', desc: 'Приносит маленький шарик к передней стенке.', difficulty: 7, minTrust: 50 },
];

export function trickDef(id: TrickId): TrickDef {
  return TRICKS.find((t) => t.id === id) ?? TRICKS[0];
}

export const NAMES_M = ['Тимма', 'Жорж', 'Вася', 'Элвин', 'Пиксель', 'Бублик', 'Сырник', 'Финик', 'Кекс', 'Шуршик', 'Лучик', 'Пряник', 'Орешек', 'Мишель', 'Тоша'];
export const NAMES_F = ['Пушинка', 'Ириска', 'Белла', 'Сливка', 'Мята', 'Кнопка', 'Зефирка', 'Вишенка', 'Люся', 'Фасолька', 'Ягодка', 'Тучка', 'Маковка', 'Нюша', 'Плюшка'];

export function randomName(sex: Sex, taken: string[] = []): string {
  const pool = (sex === 'm' ? NAMES_M : NAMES_F).filter((n) => !taken.includes(n));
  const list = pool.length ? pool : sex === 'm' ? NAMES_M : NAMES_F;
  return list[Math.floor(Math.random() * list.length)];
}
