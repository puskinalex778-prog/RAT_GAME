import type { Appearance, ColorId, EyeId, PatternId } from '../types';

export interface ColorDef {
  id: ColorId;
  name: string;
  /** основной цвет пигмента */
  hex: string;
  /** более светлый оттенок для живота */
  belly: string;
  ticking?: number; // агути-тикинг 0..1
  silvering?: number; // доля светлых волосков 0..1
  /** цвет кожи ушей/лап при сплошном окрасе */
  skin: string;
  eyes: EyeId[];
}

export const COLORS: ColorDef[] = [
  { id: 'white', name: 'Белый', hex: '#f4f1ea', belly: '#f7f5f0', skin: '#f2b8b8', eyes: ['black', 'darkruby', 'ruby', 'red'] },
  { id: 'gray', name: 'Серый', hex: '#7f8084', belly: '#a5a5a8', skin: '#d9a7a8', eyes: ['black', 'darkruby'] },
  { id: 'black', name: 'Чёрный', hex: '#26252a', belly: '#36353a', skin: '#b58f92', eyes: ['black'] },
  { id: 'blue', name: 'Голубовато-серый', hex: '#7c8797', belly: '#9aa3b0', skin: '#d6a9ad', eyes: ['black', 'darkruby'] },
  { id: 'agouti', name: 'Агути', hex: '#6b5238', belly: '#b49b82', ticking: 1, skin: '#d8a6a2', eyes: ['black'] },
  { id: 'beige', name: 'Бежевый', hex: '#c9a985', belly: '#ddc6a9', skin: '#f0b4b0', eyes: ['darkruby', 'ruby', 'red', 'black'] },
  { id: 'cream', name: 'Кремовый', hex: '#e8d7b9', belly: '#f1e6d1', skin: '#f2b8b2', eyes: ['ruby', 'red', 'darkruby', 'black'] },
  { id: 'chocolate', name: 'Шоколадный', hex: '#4e3324', belly: '#6d4c38', skin: '#c99894', eyes: ['black', 'darkruby'] },
  { id: 'silver', name: 'Серебристый', hex: '#8d8f95', belly: '#b2b3b7', silvering: 1, skin: '#dba9aa', eyes: ['black', 'darkruby'] },
  { id: 'seal', name: 'Тёмно-коричневый (пойнты)', hex: '#4a3a33', belly: '#6a5a52', skin: '#b08d87', eyes: ['ruby', 'darkruby', 'black', 'red'] },
];

export interface PatternDef {
  id: PatternId;
  name: string;
  desc: string;
}

export const PATTERNS: PatternDef[] = [
  { id: 'self', name: 'Однотонный', desc: 'Окрас по всему телу, животик немного светлее' },
  { id: 'stripe', name: 'Полоса по спине', desc: 'Белая крыса с цветной полосой от плеч до хвоста, белая голова' },
  { id: 'capped', name: 'Шапочка и полоса', desc: 'Цветная «шапочка» на голове и полоса по спине' },
  { id: 'hooded', name: 'Капюшон с полосой', desc: 'Цветная голова, плечи и полоса вдоль спины' },
  { id: 'hoodonly', name: 'Капюшон без полосы', desc: 'Цветная голова и плечи, белое тело' },
  { id: 'berkshire', name: 'Беркшир (белый живот и лапки)', desc: 'Цветная спина, белый живот и белые лапки' },
  { id: 'variegated', name: 'Пятнистый', desc: 'Цветная голова и крупные пятна по белому телу' },
  { id: 'spots', name: 'Мелкие пятнышки', desc: 'Белая с небольшими пятнышками' },
  { id: 'siamese', name: 'Сиамский (пойнты)', desc: 'Светлое кремовое тело и тёмные мордочка, ушки, лапки, основание хвоста' },
  { id: 'himalayan', name: 'Гималайский', desc: 'Почти белое тело и мягкие тёмные отметины' },
];

export const EYES: Record<EyeId, { name: string; hex: string }> = {
  black: { name: 'Чёрные', hex: '#0c0808' },
  darkruby: { name: 'Тёмно-рубиновые', hex: '#3a0811' },
  ruby: { name: 'Рубиновые', hex: '#7a0c1e' },
  red: { name: 'Красные', hex: '#d0283a' },
};

export interface CoatPreset {
  id: string;
  num: string;
  name: string;
  color: ColorId;
  pattern: PatternId;
  eyes: EyeId;
}

/** 20 обязательных окрасов (№1 — в двух подвариантах) */
export const PRESETS: CoatPreset[] = [
  { id: 'stripe_white_head', num: '1.1', name: 'Белая с серой полоской (белая голова)', color: 'gray', pattern: 'stripe', eyes: 'black' },
  { id: 'stripe_cap', num: '1.2', name: 'Белая с серой полоской и шапочкой', color: 'gray', pattern: 'capped', eyes: 'black' },
  { id: 'solid_gray', num: '2', name: 'Полностью серая', color: 'gray', pattern: 'self', eyes: 'black' },
  { id: 'white_dark_eyes', num: '3', name: 'Белая с тёмными глазами', color: 'white', pattern: 'self', eyes: 'black' },
  { id: 'white_red_eyes', num: '4', name: 'Белая с рубиновыми глазами', color: 'white', pattern: 'self', eyes: 'ruby' },
  { id: 'black', num: '5', name: 'Чёрная однотонная', color: 'black', pattern: 'self', eyes: 'black' },
  { id: 'black_hooded', num: '6', name: 'Чёрно-белая капюшонная', color: 'black', pattern: 'hooded', eyes: 'black' },
  { id: 'gray_variegated', num: '7', name: 'Серо-белая пятнистая', color: 'gray', pattern: 'variegated', eyes: 'black' },
  { id: 'black_berkshire', num: '8', name: 'Чёрная с белым животиком', color: 'black', pattern: 'berkshire', eyes: 'black' },
  { id: 'gray_berkshire', num: '9', name: 'Серая с белым животиком', color: 'gray', pattern: 'berkshire', eyes: 'black' },
  { id: 'blue', num: '10', name: 'Голубовато-серая', color: 'blue', pattern: 'self', eyes: 'black' },
  { id: 'agouti', num: '11', name: 'Коричневая агути', color: 'agouti', pattern: 'self', eyes: 'black' },
  { id: 'beige', num: '12', name: 'Тёплая бежевая', color: 'beige', pattern: 'self', eyes: 'darkruby' },
  { id: 'cream', num: '13', name: 'Кремовая', color: 'cream', pattern: 'self', eyes: 'ruby' },
  { id: 'chocolate', num: '14', name: 'Шоколадно-коричневая', color: 'chocolate', pattern: 'self', eyes: 'black' },
  { id: 'dark_hood', num: '15', name: 'Белая с тёмной головой', color: 'black', pattern: 'hoodonly', eyes: 'black' },
  { id: 'siamese', num: '16', name: 'Сиамского типа', color: 'seal', pattern: 'siamese', eyes: 'ruby' },
  { id: 'himalayan', num: '17', name: 'Гималайского типа', color: 'seal', pattern: 'himalayan', eyes: 'red' },
  { id: 'silver', num: '18', name: 'Серебристая', color: 'silver', pattern: 'self', eyes: 'black' },
  { id: 'white_gray_spots', num: '19', name: 'Белая с серыми пятнышками', color: 'gray', pattern: 'spots', eyes: 'black' },
  { id: 'white_black_spots', num: '20', name: 'Белая с чёрными пятнышками', color: 'black', pattern: 'spots', eyes: 'black' },
];

export const DEFAULT_PRESET = 'stripe_white_head';

export function colorDef(id: ColorId): ColorDef {
  return COLORS.find((c) => c.id === id) ?? COLORS[0];
}
export function patternDef(id: PatternId): PatternDef {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
}
export function presetDef(id: string | null): CoatPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Какие цвета глаз допустимы для сочетания цвета и рисунка */
export function allowedEyes(color: ColorId, pattern: PatternId): EyeId[] {
  if (pattern === 'himalayan') return ['red', 'ruby'];
  if (pattern === 'siamese') return ['ruby', 'darkruby', 'red', 'black'];
  return colorDef(color).eyes;
}

export function appearanceFromPreset(presetId: string, extra?: Partial<Appearance>): Appearance {
  const p = presetDef(presetId) ?? PRESETS[0];
  return {
    preset: p.id,
    color: p.color,
    pattern: p.pattern,
    eyes: p.eyes,
    ears: 'standard',
    coat: 'smooth',
    seed: Math.floor(Math.random() * 1e9),
    ...extra,
  };
}

/** Найти пресет, совпадающий с комбинацией (для отображения названия) */
export function matchPreset(a: Pick<Appearance, 'color' | 'pattern' | 'eyes'>): CoatPreset | undefined {
  const exact = PRESETS.find((p) => p.color === a.color && p.pattern === a.pattern && p.eyes === a.eyes);
  if (exact) return exact;
  return PRESETS.find((p) => p.color === a.color && p.pattern === a.pattern && !(p.color === 'white' && p.pattern === 'self'));
}

export function describeCoat(a: Appearance): string {
  const p = matchPreset(a);
  if (p) return p.name;
  const c = colorDef(a.color).name.toLowerCase();
  return `${patternDef(a.pattern).name}, ${c}`;
}

export function describeAppearanceFull(a: Appearance): string {
  const parts = [describeCoat(a)];
  parts.push(a.ears === 'dumbo' ? 'ушки дамбо' : 'стандартные ушки');
  parts.push(a.coat === 'rex' ? 'шерсть рекс' : 'гладкая шерсть');
  parts.push(`глаза: ${EYES[a.eyes].name.toLowerCase()}`);
  return parts.join(', ');
}
