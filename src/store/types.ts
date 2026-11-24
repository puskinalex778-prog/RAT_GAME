// Общие типы игрового состояния. Всё сериализуемо в JSON.

export type Sex = 'm' | 'f';
export type EarType = 'standard' | 'dumbo';
export type CoatType = 'smooth' | 'rex';
export type EyeId = 'black' | 'darkruby' | 'ruby' | 'red';

export type ColorId =
  | 'white'
  | 'gray'
  | 'black'
  | 'blue'
  | 'agouti'
  | 'beige'
  | 'cream'
  | 'chocolate'
  | 'silver'
  | 'seal';

export type PatternId =
  | 'self'
  | 'stripe'
  | 'capped'
  | 'hooded'
  | 'hoodonly'
  | 'berkshire'
  | 'variegated'
  | 'spots'
  | 'siamese'
  | 'himalayan';

export interface Appearance {
  /** id пресета или null, если комбинация своя */
  preset: string | null;
  color: ColorId;
  pattern: PatternId;
  eyes: EyeId;
  ears: EarType;
  coat: CoatType;
  /** зерно для случайных пятен/вариаций, чтобы каждая крыса была уникальна */
  seed: number;
}

export type PersonalityId = 'curious' | 'affectionate' | 'mischievous' | 'calm' | 'explorer' | 'gourmet';

export type TrickId = 'spin' | 'paw' | 'stand' | 'hoop' | 'fetch';

export type OriginId = 'shelter' | 'breeder' | 'petshop' | 'born';

export interface RatStats {
  satiety: number; // 0..100
  health: number;
  comfort: number;
  trust: number;
}

export interface RatData {
  id: string;
  name: string;
  sex: Sex;
  appearance: Appearance;
  personality: PersonalityId;
  /** возраст в игровых месяцах */
  ageMonths: number;
  stats: RatStats;
  /** счётчики использования игрушек по типам */
  toyLove: Record<string, number>;
  /** прогресс трюков 0..1, 1 = изучен */
  tricks: Partial<Record<TrickId, number>>;
  origin: OriginId;
  parents: [string, string] | null;
  generation: number;
  bornAt: number;
  adoptedAt: number;
  alive: boolean;
  diedAt: number | null;
  /** ожидаемые роды (unix ms) */
  pregnantUntil: number | null;
  pregnantBy: string | null;
  lastLitterAt: number;
  /** лёгкая простуда (только вне комфортного режима) */
  sick: boolean;
  petsToday: number;
}

export type SlotKind = 'floor' | 'hang';

export interface PlacedItem {
  slotId: string;
  itemId: string;
}

export interface CageState {
  cageId: string;
  secondFloor: boolean;
  bottle: string;
  placed: PlacedItem[];
  bowlFood: number; // 0..100
  water: number; // 0..100
  bedding: number; // свежесть подстилки 0..100
  nestPapers: number; // количество бумажек на полу для гнезда
  nestBuilt: number; // сколько бумажек уже в домиках
}

export type LifespanId = '1h' | '3h' | '1d' | '2d' | '1w' | '1m' | '3m' | 'real';

export interface Settings {
  breeding: boolean;
  aging: boolean;
  naturalDeath: boolean;
  comfortMode: boolean;
  lifespan: LifespanId;
  music: number; // 0..1
  sfx: number;
  haptics: boolean;
  hints: boolean;
  quality: 'low' | 'medium' | 'high';
  shellFur: boolean;
}

export interface QuestProgress {
  id: string;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export interface PhotoMeta {
  id: string;
  createdAt: number;
  ratNames: string[];
}

export interface FamilyRecord {
  id: string;
  name: string;
  sex: Sex;
  appearanceText: string;
  parents: [string, string] | null;
  generation: number;
  bornAt: number;
  diedAt: number | null;
}

export interface GameState {
  version: number;
  started: boolean;
  introSeen: boolean;
  coins: number;
  rats: RatData[];
  family: FamilyRecord[];
  inventory: Record<string, number>; // предметы и еда: id -> количество
  ownedCages: string[];
  ownedThemes: string[];
  theme: string;
  cage: CageState;
  settings: Settings;
  storyQuests: QuestProgress[];
  storyIndex: number;
  daily: { day: string; quests: QuestProgress[] };
  achievements: Record<string, number>; // id -> unix ms получения
  counters: Record<string, number>;
  photos: PhotoMeta[];
  lastTick: number;
  lastSave: number;
  totalPlayMs: number;
  earnCooldowns: Record<string, number>;
}
