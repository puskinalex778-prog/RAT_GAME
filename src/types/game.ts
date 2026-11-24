export type BaseColorId =
  | 'white'
  | 'gray'
  | 'black'
  | 'blue_gray'
  | 'agouti'
  | 'beige'
  | 'cream'
  | 'chocolate'
  | 'silver';

export type MarkingId =
  | 'solid'
  | 'back_stripe'
  | 'hooded_stripe'
  | 'capped'
  | 'berkshire'
  | 'patched'
  | 'spots'
  | 'siamese'
  | 'himalayan';

export type HeadCapVariant = 'gray_cap' | 'white_head';

export type EarType = 'standard' | 'dumbo';
export type CoatType = 'smooth' | 'rex';
export type EyeColor = 'black' | 'dark_ruby' | 'ruby' | 'red';
export type RatSex = 'male' | 'female';

export type RatPersonalityId =
  | 'curious'
  | 'affectionate'
  | 'mischievous'
  | 'calm'
  | 'explorer'
  | 'foodie';

export type LifeStage = 'pup' | 'juvenile' | 'adult' | 'senior';

export type TrickId = 'spin' | 'paw' | 'stand' | 'hoop' | 'fetch';

export type AdoptionOrigin = 'rescue' | 'breeder' | 'petshop';

export type CameraMode = 'overview' | 'pet_level' | 'follow' | 'photo';

export type InteractionMode =
  | 'none'
  | 'petting'
  | 'playing'
  | 'decorate'
  | 'training';

export type RoomThemeId = 'scandi' | 'warm_wood' | 'pastel' | 'botanical';

export type HabitatId = 'basic_cage' | 'panoramic_cage' | 'playpen';

export type ShopCategory =
  | 'food'
  | 'houses'
  | 'hammocks'
  | 'tunnels'
  | 'toys'
  | 'care'
  | 'habitats'
  | 'themes'
  | 'upgrades';

export type SlotType = 'floor' | 'upper_floor' | 'hanging' | 'upper_hanging' | 'wall';

export interface RatAppearance {
  presetId: string | null;
  baseColor: BaseColorId;
  marking: MarkingId;
  markingColor: BaseColorId;
  headCapVariant: HeadCapVariant;
  ears: EarType;
  coat: CoatType;
  eyeColor: EyeColor;
}

export interface CoatPreset {
  id: string;
  index: number;
  name: string;
  description: string;
  icon: string;
  appearance: Omit<RatAppearance, 'presetId' | 'ears' | 'coat'>;
  hasHeadCapSubvariant?: boolean;
}

export interface TrickProgress {
  progress: number; // 0..100
  learned: boolean;
}

export interface RatStats {
  hunger: number; // 0..100 (100 = сытый)
  health: number; // 0..100
  comfort: number; // 0..100
  trust: number; // 0..100
}

export interface RatPedigree {
  origin: AdoptionOrigin | 'bred';
  motherId?: string;
  motherName?: string;
  fatherId?: string;
  fatherName?: string;
  generation: number;
}

export interface RatEntity {
  id: string;
  name: string;
  sex: RatSex;
  appearance: RatAppearance;
  personality: RatPersonalityId;
  ageDays: number; // in game days (30 = 1 month)
  bornAt: number; // real timestamp ms
  stats: RatStats;
  favoriteToys: string[];
  tricks: Record<TrickId, TrickProgress>;
  pedigree: RatPedigree;
  alive: boolean;
  passedAwayAt?: number;
  lastBredAt?: number;
}

export interface CageItemDef {
  id: string;
  name: string;
  description: string;
  category: ShopCategory;
  price: number;
  icon: string;
  slotTypes?: SlotType[];
  isConsumable?: boolean;
  hungerRestore?: number;
  trustGain?: number;
  comfortBonus?: number;
  healthBonus?: number;
  modelType?: string;
  themeId?: RoomThemeId;
  habitatId?: HabitatId;
  isSecondFloorUpgrade?: boolean;
}

export interface PlacedItem {
  slotId: string;
  itemId: string;
}

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  kind: 'starter' | 'daily' | 'story';
  target: number;
  rewardCoins: number;
  icon: string;
  trackKey: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  icon: string;
}

export type LifespanOption = '1h' | '3h' | '2d' | '7d' | '30d' | '90d';

export interface LifecycleSettings {
  breedingEnabled: boolean; // FALSE by default
  agingEnabled: boolean;
  naturalDeathEnabled: boolean; // FALSE by default in comfort preset
  comfortMode: boolean; // TRUE by default
  lifespanOption: LifespanOption;
}

export interface AppSettings {
  soundEnabled: boolean;
  ambientEnabled: boolean;
  hapticsEnabled: boolean;
  showHints: boolean;
  lifecycle: LifecycleSettings;
}

export interface PhotoRecord {
  id: string;
  dataUrl: string;
  takenAt: number;
  caption: string;
  ratNames: string[];
}

export interface FloatingFeedback {
  id: number;
  text: string;
  screenX: number;
  screenY: number;
  color?: string;
}

export interface ProjectedRatLabel {
  ratId: string;
  name: string;
  activityLabel: string;
  x: number;
  y: number;
  visible: boolean;
}

export type RatBehaviorState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sniff'
  | 'rear_up'
  | 'groom_face'
  | 'groom_body'
  | 'eat'
  | 'drink'
  | 'carry_paper'
  | 'climb'
  | 'tunnel'
  | 'sleep_hammock'
  | 'sleep_house'
  | 'social_groom'
  | 'play_wrestle'
  | 'come_to_player'
  | 'being_petted'
  | 'chase_toy'
  | 'perform_trick';
