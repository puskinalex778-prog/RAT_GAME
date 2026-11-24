import type {
  BaseColorId,
  CoatPreset,
  CoatType,
  EarType,
  EyeColor,
  HeadCapVariant,
  LifeStage,
  LifespanOption,
  MarkingId,
  RatAppearance,
  RatPersonalityId,
  TrickId,
} from '../types/game';

export const BASE_COLORS: Record<
  BaseColorId,
  {
    name: string;
    primary: string;
    secondary: string;
    belly: string;
    pawTint: string;
    earInner: string;
    ticking?: string;
    silvering?: boolean;
  }
> = {
  white: {
    name: 'Белый',
    primary: '#F6F3EC',
    secondary: '#E8E3D8',
    belly: '#FCFBF8',
    pawTint: '#F2C7C2',
    earInner: '#F3BABA',
  },
  gray: {
    name: 'Серый',
    primary: '#7D8084',
    secondary: '#62666B',
    belly: '#A5A8AC',
    pawTint: '#DFB6B2',
    earInner: '#E2AEAE',
  },
  black: {
    name: 'Чёрный',
    primary: '#2A292B',
    secondary: '#1B1A1C',
    belly: '#37363A',
    pawTint: '#C8A29F',
    earInner: '#C99898',
  },
  blue_gray: {
    name: 'Голубовато-серый',
    primary: '#7A8999',
    secondary: '#627080',
    belly: '#9EABB8',
    pawTint: '#DEB8B6',
    earInner: '#E1B0B0',
  },
  agouti: {
    name: 'Коричневый агути',
    primary: '#7A6247',
    secondary: '#523F2B',
    belly: '#B7A48C',
    pawTint: '#DFB4AE',
    earInner: '#DDA8A3',
    ticking: '#B89768',
  },
  beige: {
    name: 'Тёплый бежевый',
    primary: '#C9B396',
    secondary: '#B19877',
    belly: '#DFD0BC',
    pawTint: '#EEBEB8',
    earInner: '#EDB3AF',
  },
  cream: {
    name: 'Кремовый',
    primary: '#EBDAC1',
    secondary: '#D9C2A2',
    belly: '#F6EDE0',
    pawTint: '#F4C8C2',
    earInner: '#F3BCBA',
  },
  chocolate: {
    name: 'Шоколадный',
    primary: '#573B2B',
    secondary: '#3D271B',
    belly: '#6F4E3C',
    pawTint: '#CF9E98',
    earInner: '#CE9B96',
  },
  silver: {
    name: 'Серебристый',
    primary: '#8B8F95',
    secondary: '#6E737A',
    belly: '#B6BAC0',
    pawTint: '#E5BCB8',
    earInner: '#E7B4B4',
    silvering: true,
  },
};

export const MARKINGS: Record<MarkingId, { name: string; short: string }> = {
  solid: { name: 'Однотонный', short: 'Однотон.' },
  back_stripe: { name: 'Полоска по спине', short: 'Полоска' },
  hooded_stripe: { name: 'Капюшон + полоса', short: 'Капюшон' },
  capped: { name: 'Тёмная шапочка (без полосы)', short: 'Шапочка' },
  berkshire: { name: 'Белый животик и лапки (беркшир)', short: 'Беркшир' },
  patched: { name: 'Крупные пятна', short: 'Пятнистый' },
  spots: { name: 'Небольшие пятнышки', short: 'Крап/пятна' },
  siamese: { name: 'Сиамский (пойнты)', short: 'Сиамский' },
  himalayan: { name: 'Гималайский (мягкие пойнты)', short: 'Гималай.' },
};

export const HEAD_CAP_LABELS: Record<HeadCapVariant, string> = {
  gray_cap: 'С серой «шапочкой» на голове',
  white_head: 'С полностью белой головой',
};

export const EAR_LABELS: Record<EarType, string> = {
  standard: 'Стандартные',
  dumbo: 'Дамбо (округлые низкие)',
};

export const COAT_LABELS: Record<CoatType, string> = {
  smooth: 'Гладкая шерсть',
  rex: 'Рекс (мягкая волнистая)',
};

export const EYE_LABELS: Record<EyeColor, { name: string; hex: string; glint: string }> = {
  black: { name: 'Чёрные', hex: '#141111', glint: '#FFFFFF' },
  dark_ruby: { name: 'Тёмно-рубиновые', hex: '#3D1014', glint: '#FFE8E8' },
  ruby: { name: 'Рубиновые', hex: '#8A1822', glint: '#FFD8DC' },
  red: { name: 'Красные', hex: '#C6242C', glint: '#FFE0E4' },
};

/** 20 mandatory presets matching the specification in exact order */
export const COAT_PRESETS: CoatPreset[] = [
  {
    id: 'white_gray_back_stripe',
    index: 1,
    name: 'Белая с серой полоской по спине',
    description: 'Фирменный окрас: белые бока и живот, аккуратная серая полоса вдоль спины.',
    icon: './assets/icons/white_gray_back_stripe.png',
    hasHeadCapSubvariant: true,
    appearance: {
      baseColor: 'white',
      marking: 'back_stripe',
      markingColor: 'gray',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'solid_gray',
    index: 2,
    name: 'Полностью серая',
    description: 'Ровная мягкая серая шерсть, животик чуть светлее.',
    icon: './assets/icons/solid_gray.png',
    appearance: {
      baseColor: 'gray',
      marking: 'solid',
      markingColor: 'gray',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'white_black_eyes',
    index: 3,
    name: 'Белая с тёмными глазами',
    description: 'Белоснежная мягкая шубка и выразительные тёмные бусинки-глазки.',
    icon: './assets/icons/white_black_eyes.png',
    appearance: {
      baseColor: 'white',
      marking: 'solid',
      markingColor: 'white',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'albino',
    index: 4,
    name: 'Белая с рубиновыми/красными глазами',
    description: 'Нежная белая крыска с рубиновыми или красными глазками.',
    icon: './assets/icons/albino.png',
    appearance: {
      baseColor: 'white',
      marking: 'solid',
      markingColor: 'white',
      headCapVariant: 'white_head',
      eyeColor: 'red',
    },
  },
  {
    id: 'black',
    index: 5,
    name: 'Чёрная однотонная',
    description: 'Глубокий бархатистый чёрный окрас с мягким матовым ворсом.',
    icon: './assets/icons/black.png',
    appearance: {
      baseColor: 'black',
      marking: 'solid',
      markingColor: 'black',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'black_hooded',
    index: 6,
    name: 'Чёрно-белая капюшонная',
    description: 'Тёмная голова, «капюшон» на плечах и полоса вдоль спины.',
    icon: './assets/icons/black_hooded.png',
    appearance: {
      baseColor: 'white',
      marking: 'hooded_stripe',
      markingColor: 'black',
      headCapVariant: 'gray_cap',
      eyeColor: 'black',
    },
  },
  {
    id: 'gray_white_patched',
    index: 7,
    name: 'Серо-белая пятнистая',
    description: 'Мягкие крупные серые пятна на белой шерсти.',
    icon: './assets/icons/gray_white_patched.png',
    appearance: {
      baseColor: 'white',
      marking: 'patched',
      markingColor: 'gray',
      headCapVariant: 'gray_cap',
      eyeColor: 'black',
    },
  },
  {
    id: 'black_white_belly',
    index: 8,
    name: 'Чёрная с белым животиком (беркшир)',
    description: 'Чёрная спинка, аккуратный белый животик и белые носочки-лапки.',
    icon: './assets/icons/black_white_belly.png',
    appearance: {
      baseColor: 'black',
      marking: 'berkshire',
      markingColor: 'white',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'gray_white_belly',
    index: 9,
    name: 'Серая с белым животиком (беркшир)',
    description: 'Мягкая серая спинка, светлый белый животик и белые лапки.',
    icon: './assets/icons/gray_white_belly.png',
    appearance: {
      baseColor: 'gray',
      marking: 'berkshire',
      markingColor: 'white',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'blue_gray',
    index: 10,
    name: 'Голубовато-серая',
    description: 'Благородный прохладный оттенок русского/американского голубого.',
    icon: './assets/icons/blue_gray.png',
    appearance: {
      baseColor: 'blue_gray',
      marking: 'solid',
      markingColor: 'blue_gray',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'agouti',
    index: 11,
    name: 'Коричневая агути',
    description: 'Природный зональный окрас с естественным тикингом и плавными переливами.',
    icon: './assets/icons/agouti.png',
    appearance: {
      baseColor: 'agouti',
      marking: 'solid',
      markingColor: 'agouti',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'beige',
    index: 12,
    name: 'Тёплая бежевая',
    description: 'Уютный песочно-бежевый оттенок с тёплым подтоном.',
    icon: './assets/icons/beige.png',
    appearance: {
      baseColor: 'beige',
      marking: 'solid',
      markingColor: 'beige',
      headCapVariant: 'white_head',
      eyeColor: 'dark_ruby',
    },
  },
  {
    id: 'cream',
    index: 13,
    name: 'Кремовая',
    description: 'Нежный светлый сливочно-кремовый окрас.',
    icon: './assets/icons/cream.png',
    appearance: {
      baseColor: 'cream',
      marking: 'solid',
      markingColor: 'cream',
      headCapVariant: 'white_head',
      eyeColor: 'dark_ruby',
    },
  },
  {
    id: 'chocolate',
    index: 14,
    name: 'Шоколадно-коричневая',
    description: 'Глубокий тёплый оттенок тёмного какао.',
    icon: './assets/icons/chocolate.png',
    appearance: {
      baseColor: 'chocolate',
      marking: 'solid',
      markingColor: 'chocolate',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'gray_capped',
    index: 15,
    name: 'Белая с тёмной головой',
    description: 'Капюшонный рисунок на голове без длинной полосы по спине.',
    icon: './assets/icons/gray_capped.png',
    appearance: {
      baseColor: 'white',
      marking: 'capped',
      markingColor: 'gray',
      headCapVariant: 'gray_cap',
      eyeColor: 'black',
    },
  },
  {
    id: 'siamese',
    index: 16,
    name: 'Сиамского типа',
    description: 'Кремово-бежевое тело и тёмные пойнты на мордочке, ушках, лапках и у хвоста.',
    icon: './assets/icons/siamese.png',
    appearance: {
      baseColor: 'cream',
      marking: 'siamese',
      markingColor: 'chocolate',
      headCapVariant: 'white_head',
      eyeColor: 'dark_ruby',
    },
  },
  {
    id: 'himalayan',
    index: 17,
    name: 'Гималайского типа',
    description: 'Почти белое тело и мягкие шоколадно-серые пойнты на носике и лапках.',
    icon: './assets/icons/himalayan.png',
    appearance: {
      baseColor: 'white',
      marking: 'himalayan',
      markingColor: 'chocolate',
      headCapVariant: 'white_head',
      eyeColor: 'ruby',
    },
  },
  {
    id: 'silver',
    index: 18,
    name: 'Серебристая',
    description: 'Серая шубка с равномерными светлыми серебристыми волосками.',
    icon: './assets/icons/silver.png',
    appearance: {
      baseColor: 'silver',
      marking: 'solid',
      markingColor: 'silver',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'white_gray_spots',
    index: 19,
    name: 'Белая с серыми пятнышками',
    description: 'Светлая шерсть, украшенная аккуратными серыми пятнышками.',
    icon: './assets/icons/white_gray_spots.png',
    appearance: {
      baseColor: 'white',
      marking: 'spots',
      markingColor: 'gray',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
  {
    id: 'white_black_spots',
    index: 20,
    name: 'Белая с чёрными пятнышками',
    description: 'Белая шубка с контрастными чёрными пятнышками.',
    icon: './assets/icons/white_black_spots.png',
    appearance: {
      baseColor: 'white',
      marking: 'spots',
      markingColor: 'black',
      headCapVariant: 'white_head',
      eyeColor: 'black',
    },
  },
];

export function getDefaultAppearance(): RatAppearance {
  const first = COAT_PRESETS[0];
  return {
    presetId: first.id,
    ...first.appearance,
    ears: 'standard',
    coat: 'smooth',
  };
}

/** Realistic allowed eye colors for a coat appearance */
export function getAllowedEyeColors(appearance: Pick<RatAppearance, 'baseColor' | 'marking'>): EyeColor[] {
  if (appearance.marking === 'siamese') return ['dark_ruby', 'ruby', 'black'];
  if (appearance.marking === 'himalayan') return ['ruby', 'red', 'dark_ruby'];
  if (appearance.baseColor === 'white' && appearance.marking === 'solid') {
    return ['black', 'dark_ruby', 'ruby', 'red'];
  }
  if (appearance.baseColor === 'beige' || appearance.baseColor === 'cream') {
    return ['black', 'dark_ruby', 'ruby'];
  }
  return ['black', 'dark_ruby'];
}

export function getPresetIconForAppearance(appearance: RatAppearance): string {
  if (appearance.presetId) {
    const found = COAT_PRESETS.find((p) => p.id === appearance.presetId);
    if (found) return found.icon;
  }
  // Best visual match fallback
  const match = COAT_PRESETS.find(
    (p) =>
      p.appearance.baseColor === appearance.baseColor &&
      p.appearance.marking === appearance.marking
  );
  if (match) return match.icon;
  const byBase = COAT_PRESETS.find((p) => p.appearance.baseColor === appearance.baseColor);
  return byBase ? byBase.icon : COAT_PRESETS[0].icon;
}

export function describeAppearance(a: RatAppearance): string {
  if (a.presetId) {
    const preset = COAT_PRESETS.find((p) => p.id === a.presetId);
    if (preset) {
      if (preset.hasHeadCapSubvariant) {
        return `${preset.name} (${a.headCapVariant === 'gray_cap' ? 'с серой шапочкой' : 'с белой головой'})`;
      }
      return preset.name;
    }
  }
  const base = BASE_COLORS[a.baseColor].name;
  const mark = MARKINGS[a.marking].name;
  if (a.marking === 'solid') return base;
  return `${base}, ${mark.toLowerCase()}`;
}

export function inheritAppearance(mother: RatAppearance, father: RatAppearance): RatAppearance {
  const pick = <T,>(a: T, b: T): T => (Math.random() < 0.5 ? a : b);
  const baseColor = pick(mother.baseColor, father.baseColor);
  const marking = pick(mother.marking, father.marking);
  const markingColor = pick(mother.markingColor, father.markingColor);
  const headCapVariant = pick(mother.headCapVariant, father.headCapVariant);
  // Dumbo & Rex are recessive/semi-dominant feel: if both have it -> always, if one -> 35%, if neither -> 5% surprise
  const ears: EarType =
    mother.ears === 'dumbo' && father.ears === 'dumbo'
      ? 'dumbo'
      : mother.ears === 'dumbo' || father.ears === 'dumbo'
      ? Math.random() < 0.35
        ? 'dumbo'
        : 'standard'
      : Math.random() < 0.05
      ? 'dumbo'
      : 'standard';

  const coat: CoatType =
    mother.coat === 'rex' && father.coat === 'rex'
      ? 'rex'
      : mother.coat === 'rex' || father.coat === 'rex'
      ? Math.random() < 0.45
        ? 'rex'
        : 'smooth'
      : 'smooth';

  const allowedEyes = getAllowedEyeColors({ baseColor, marking });
  const preferredEye = pick(mother.eyeColor, father.eyeColor);
  const eyeColor = allowedEyes.includes(preferredEye) ? preferredEye : allowedEyes[0];

  const matchedPreset = COAT_PRESETS.find(
    (p) =>
      p.appearance.baseColor === baseColor &&
      p.appearance.marking === marking &&
      p.appearance.markingColor === markingColor
  );

  return {
    presetId: matchedPreset ? matchedPreset.id : null,
    baseColor,
    marking,
    markingColor,
    headCapVariant,
    ears,
    coat,
    eyeColor,
  };
}

export const PERSONALITIES: Record<
  RatPersonalityId,
  {
    name: string;
    description: string;
    weights: {
      explore: number;
      play: number;
      rest: number;
      food: number;
      social: number;
      climb: number;
    };
    defaultFavToys: string[];
  }
> = {
  curious: {
    name: 'Любопытный',
    description: 'Обожает обнюхивать каждый уголок, вставать на задние лапки и проверять новые вещи.',
    weights: { explore: 1.5, play: 1.1, rest: 0.9, food: 1.0, social: 1.1, climb: 1.3 },
    defaultFavToys: ['tunnel_clear', 'puzzle_feeder'],
  },
  affectionate: {
    name: 'Ласковый',
    description: 'Быстро привязывается, обожает поглаживания и уютный сон в гамаке.',
    weights: { explore: 0.9, play: 0.9, rest: 1.35, food: 1.0, social: 1.6, climb: 0.9 },
    defaultFavToys: ['hammock_fabric', 'hammock_plush'],
  },
  mischievous: {
    name: 'Озорной',
    description: 'Непоседа: любит возиться, катать мячики, таскать салфетки и бегать по лесенкам.',
    weights: { explore: 1.2, play: 1.6, rest: 0.8, food: 1.1, social: 1.2, climb: 1.5 },
    defaultFavToys: ['toy_ball', 'toy_rope'],
  },
  calm: {
    name: 'Спокойный',
    description: 'Неторопливый, уютный философ. Любит долгий сон в домике и аккуратно умываться.',
    weights: { explore: 0.8, play: 0.7, rest: 1.6, food: 1.0, social: 1.1, climb: 0.7 },
    defaultFavToys: ['house_wood', 'house_pouch'],
  },
  explorer: {
    name: 'Исследователь',
    description: 'Первым забирается на второй этаж, обожает туннели, канаты и мостики.',
    weights: { explore: 1.6, play: 1.2, rest: 0.85, food: 0.95, social: 1.0, climb: 1.7 },
    defaultFavToys: ['tunnel_bridge', 'toy_wheel'],
  },
  foodie: {
    name: 'Лакомка',
    description: 'Всегда рад вкусному перекусу и быстрее всех учит трюки за лакомство!',
    weights: { explore: 1.0, play: 1.0, rest: 1.1, food: 1.7, social: 1.1, climb: 0.9 },
    defaultFavToys: ['puzzle_feeder', 'bowl_ceramic'],
  },
};

export const PERSONALITY_IDS: RatPersonalityId[] = Object.keys(PERSONALITIES) as RatPersonalityId[];

export const TRICKS: Record<
  TrickId,
  { id: TrickId; name: string; description: string; difficulty: number; rewardCoins: number }
> = {
  spin: {
    id: 'spin',
    name: 'Поворот',
    description: 'Крыска изящно кружится вокруг себя по команде.',
    difficulty: 1,
    rewardCoins: 20,
  },
  paw: {
    id: 'paw',
    name: 'Лапка',
    description: 'Поднимает переднюю розовую лапку и здоровается.',
    difficulty: 1,
    rewardCoins: 25,
  },
  stand: {
    id: 'stand',
    name: 'Стойка',
    description: 'Уверенно встаёт на задние лапки столбиком.',
    difficulty: 1.2,
    rewardCoins: 30,
  },
  hoop: {
    id: 'hoop',
    name: 'Через кольцо',
    description: 'Ловко прыгает вперёд с грациозным рывком.',
    difficulty: 1.4,
    rewardCoins: 40,
  },
  fetch: {
    id: 'fetch',
    name: 'Принеси шарик',
    description: 'Подбегает к игрушке и приносит шарик обратно.',
    difficulty: 1.5,
    rewardCoins: 50,
  },
};

export const TRICK_IDS: TrickId[] = ['spin', 'paw', 'stand', 'hoop', 'fetch'];

export const LIFESPAN_OPTIONS: Record<LifespanOption, { label: string; realHours: number }> = {
  '1h': { label: '1 час', realHours: 1 },
  '3h': { label: '3 часа', realHours: 3 },
  '2d': { label: '2 дня', realHours: 48 },
  '7d': { label: '1 неделя', realHours: 24 * 7 },
  '30d': { label: '1 месяц', realHours: 24 * 30 },
  '90d': { label: '3 месяца', realHours: 24 * 90 },
};

export function getLifeStage(ageDays: number): LifeStage {
  if (ageDays < 45) return 'pup';
  if (ageDays < 120) return 'juvenile';
  if (ageDays < 540) return 'adult';
  return 'senior';
}

export function getLifeStageLabel(stage: LifeStage): string {
  switch (stage) {
    case 'pup':
      return 'Крысёнок';
    case 'juvenile':
      return 'Подросток';
    case 'adult':
      return 'Взрослая';
    case 'senior':
      return 'Пожилая';
  }
}

export function formatRatAge(ageDays: number): string {
  const days = Math.max(1, Math.floor(ageDays));
  if (days < 30) {
    return `${days} дн.`;
  }
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remM = months % 12;
    return remM > 0 ? `${years} г. ${remM} мес.` : `${years} г.`;
  }
  return remDays > 5 ? `${months} мес. ${remDays} дн.` : `${months} мес.`;
}

export const RANDOM_RAT_NAMES_MALE = [
  'Тимма',
  'Жорж',
  'Вася',
  'Элвин',
  'Шустрик',
  'Пушок',
  'Марсель',
  'Орешек',
  'Чижик',
  'Фунтик',
  'Кекс',
  'Пряник',
];

export const RANDOM_RAT_NAMES_FEMALE = [
  'Бусинка',
  'Ириска',
  'Мышка',
  'Луна',
  'Плюша',
  'Кнопка',
  'Марта',
  'Зефирка',
  'Милка',
  'Ваниль',
  'Крошка',
  'Слива',
];
