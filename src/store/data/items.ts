import type { SlotKind } from '../types';

export type ShopCategory =
  | 'food'
  | 'houses'
  | 'hammocks'
  | 'tunnels'
  | 'toys'
  | 'care'
  | 'cages'
  | 'themes'
  | 'upgrades';

export const CATEGORY_NAMES: Record<ShopCategory, string> = {
  food: 'Корма и лакомства',
  houses: 'Домики',
  hammocks: 'Гамаки',
  tunnels: 'Туннели',
  toys: 'Игрушки',
  care: 'Уход',
  cages: 'Клетки и манежи',
  themes: 'Темы оформления',
  upgrades: 'Улучшения',
};

/** Как предмет используется крысами (ИИ) и как строится 3D-модель */
export type ItemKind =
  | 'house'
  | 'hammock'
  | 'hammock2'
  | 'tunnel'
  | 'ball'
  | 'forage'
  | 'wheel'
  | 'rope'
  | 'ladder'
  | 'bowl';

export interface PlaceableDef {
  id: string;
  name: string;
  desc: string;
  category: ShopCategory;
  price: number;
  slot: SlotKind;
  kind: ItemKind;
  variant: string;
  comfort: number; // вклад в комфорт клетки
  /** категория любимой игрушки */
  toy: string;
}

export const PLACEABLES: PlaceableDef[] = [
  // Домики
  { id: 'house_wood', name: 'Деревянный домик', desc: 'Классический домик из светлой берёзы с круглым входом.', category: 'houses', price: 0, slot: 'floor', kind: 'house', variant: 'wood', comfort: 8, toy: 'house' },
  { id: 'house_wigwam', name: 'Мягкий вигвам', desc: 'Тканевый вигвам — тёплый и уютный для сна.', category: 'houses', price: 140, slot: 'floor', kind: 'house', variant: 'wigwam', comfort: 10, toy: 'house' },
  { id: 'house_pumpkin', name: 'Домик-тыква', desc: 'Круглый оранжевый домик из прессованного сена.', category: 'houses', price: 180, slot: 'floor', kind: 'house', variant: 'pumpkin', comfort: 10, toy: 'house' },
  { id: 'house_nest', name: 'Просторное гнездо', desc: 'Плетёная корзинка с мягкой подушкой, хватит места всем.', category: 'houses', price: 240, slot: 'floor', kind: 'house', variant: 'nest', comfort: 14, toy: 'house' },
  // Гамаки
  { id: 'hammock_fabric', name: 'Тканевый гамак', desc: 'Мягкий гамак на четырёх карабинах.', category: 'hammocks', price: 0, slot: 'hang', kind: 'hammock', variant: 'fabric', comfort: 7, toy: 'hammock' },
  { id: 'hammock_double', name: 'Двухъярусный гамак', desc: 'Два уровня — можно спать вместе или по отдельности.', category: 'hammocks', price: 190, slot: 'hang', kind: 'hammock2', variant: 'double', comfort: 12, toy: 'hammock' },
  { id: 'hammock_corner', name: 'Угловой плюшевый гамак', desc: 'Треугольный плюшевый гамак — любимое место дремать.', category: 'hammocks', price: 150, slot: 'hang', kind: 'hammock', variant: 'corner', comfort: 10, toy: 'hammock' },
  // Туннели
  { id: 'tunnel_clear', name: 'Прозрачная труба', desc: 'Сквозь неё видно, как крыска пробегает.', category: 'tunnels', price: 90, slot: 'floor', kind: 'tunnel', variant: 'clear', comfort: 4, toy: 'tunnel' },
  { id: 'tunnel_fabric', name: 'Тканевый рукав', desc: 'Шуршащий рукав, в котором приятно прятаться.', category: 'tunnels', price: 110, slot: 'floor', kind: 'tunnel', variant: 'fabric', comfort: 6, toy: 'tunnel' },
  { id: 'tunnel_bridge', name: 'Деревянный мостик-туннель', desc: 'Изогнутый мостик из реечек: можно и по нему, и под ним.', category: 'tunnels', price: 130, slot: 'floor', kind: 'tunnel', variant: 'bridge', comfort: 5, toy: 'tunnel' },
  // Игрушки
  { id: 'toy_ball', name: 'Мячик-погремушка', desc: 'Лёгкий плетёный мячик, крыски катают его носом.', category: 'toys', price: 40, slot: 'floor', kind: 'ball', variant: 'ball', comfort: 2, toy: 'ball' },
  { id: 'toy_forage', name: 'Фуражилка-головоломка', desc: 'Коробочка с отверстиями: внутри спрятаны семечки.', category: 'toys', price: 120, slot: 'floor', kind: 'forage', variant: 'forage', comfort: 5, toy: 'forage' },
  { id: 'toy_wheel', name: 'Беговое колесо (Ø 30 см)', desc: 'Безопасное колесо большого диаметра со сплошной дорожкой.', category: 'toys', price: 220, slot: 'floor', kind: 'wheel', variant: 'wheel', comfort: 5, toy: 'wheel' },
  { id: 'toy_rope', name: 'Канат для лазания', desc: 'Хлопковый канат, подвешивается к потолку клетки.', category: 'toys', price: 70, slot: 'hang', kind: 'rope', variant: 'rope', comfort: 3, toy: 'ladder' },
  { id: 'toy_ladder', name: 'Верёвочная лестница', desc: 'Мягкая лесенка из верёвок и деревянных перекладин.', category: 'toys', price: 90, slot: 'hang', kind: 'ladder', variant: 'ladder', comfort: 4, toy: 'ladder' },
  // Уход (размещаемое)
  { id: 'bowl_plastic', name: 'Простая миска', desc: 'Пластиковая миска для зерновой смеси.', category: 'care', price: 0, slot: 'floor', kind: 'bowl', variant: 'plastic', comfort: 1, toy: 'food' },
  { id: 'bowl_ceramic', name: 'Керамическая миска', desc: 'Тяжёлая, не переворачивается. Вмещает больше корма.', category: 'care', price: 80, slot: 'floor', kind: 'bowl', variant: 'ceramic', comfort: 3, toy: 'food' },
];

export interface FoodDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  pack: number;
  satiety: number;
  trust: number;
  comfort: number;
  /** используется для наполнения миски */
  bowl?: boolean;
  color: string;
  shape: 'pellet' | 'veg' | 'drop' | 'nut' | 'seed';
}

export const FOODS: FoodDef[] = [
  { id: 'food_mix', name: 'Зерновая смесь', desc: 'Сбалансированный основной корм. Насыпается в миску.', price: 20, pack: 5, satiety: 0, trust: 0, comfort: 0, bowl: true, color: '#c9a36a', shape: 'pellet' },
  { id: 'treat_veg', name: 'Свежие овощи', desc: 'Кусочек брокколи или морковки — полезно и вкусно.', price: 15, pack: 4, satiety: 12, trust: 4, comfort: 3, color: '#5f9a43', shape: 'veg' },
  { id: 'treat_yogurt', name: 'Йогуртовые дропсы', desc: 'Особое лакомство, крыски их обожают. Не больше пары в день.', price: 30, pack: 5, satiety: 5, trust: 9, comfort: 4, color: '#f6efe3', shape: 'drop' },
  { id: 'treat_nut', name: 'Орешки', desc: 'Кусочек грецкого ореха — крыска держит его лапками.', price: 25, pack: 5, satiety: 8, trust: 7, comfort: 3, color: '#b07a45', shape: 'nut' },
  { id: 'treat_seed', name: 'Семечки', desc: 'Тыквенные семечки — отличное поощрение на дрессировке.', price: 12, pack: 8, satiety: 4, trust: 5, comfort: 2, color: '#d8cf9a', shape: 'seed' },
];

export interface ConsumableDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  pack: number;
}

export const CONSUMABLES: ConsumableDef[] = [
  { id: 'care_bedding', name: 'Мягкий наполнитель', desc: 'Бумажный наполнитель без пыли. Освежает подстилку в клетке.', price: 25, pack: 3 },
  { id: 'care_tissues', name: 'Салфетки для гнезда', desc: 'Крыски разносят их по домикам и строят гнёзда.', price: 15, pack: 3 },
  { id: 'care_vitamins', name: 'Витаминные капли', desc: 'Поддерживают здоровье и помогают при лёгкой простуде.', price: 40, pack: 2 },
];

export interface BottleDef {
  id: string;
  name: string;
  desc: string;
  price: number;
}
export const BOTTLES: BottleDef[] = [
  { id: 'bottle_basic', name: 'Простая поилка', desc: 'Пластиковая поилка с шариковым носиком.', price: 0 },
  { id: 'bottle_glass', name: 'Стеклянная поилка', desc: 'Стеклянная поилка с металлическим носиком, вода дольше свежая.', price: 90 },
];

export interface CageDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  size: [number, number, number]; // ширина, глубина, высота (м)
  roof: boolean;
  capacity: number;
  floorSlots: number;
  hangSlots: number;
  canSecondFloor: boolean;
}

export const CAGES: CageDef[] = [
  { id: 'cage_basic', name: 'Просторная базовая клетка', desc: 'Удобная стартовая клетка 100×60 см.', price: 0, size: [1.0, 0.6, 0.9], roof: true, capacity: 4, floorSlots: 6, hangSlots: 3, canSecondFloor: true },
  { id: 'cage_panorama', name: 'Большая панорамная клетка', desc: 'Огромная клетка 140×70 см с широким обзором.', price: 900, size: [1.4, 0.7, 1.05], roof: true, capacity: 6, floorSlots: 9, hangSlots: 4, canSecondFloor: true },
  { id: 'cage_playpen', name: 'Выгульный манеж', desc: 'Большой мягкий манеж на ковре для прогулок и игр.', price: 600, size: [1.7, 1.1, 0.4], roof: false, capacity: 6, floorSlots: 10, hangSlots: 0, canSecondFloor: false },
];

export interface ThemeDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  wall: string;
  wall2: string;
  floor: string;
  floor2: string;
  rug: string;
  rug2: string;
  table: string;
  accent: string;
  light: string;
  plant: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: 'theme_scandi', name: 'Уютная сканди-комната', desc: 'Светлые стены, берёзовый пол и шерстяной плед.', price: 0, wall: '#ebe3d6', wall2: '#dfd4c3', floor: '#d6b48c', floor2: '#c49d74', rug: '#d9cbb8', rug2: '#bfae98', table: '#e8d9c2', accent: '#8fb38a', light: '#ffe2b8', plant: true },
  { id: 'theme_wood', name: 'Тёплое дерево', desc: 'Деревянные панели, мёдовый свет и вязаный ковёр.', price: 350, wall: '#a77a52', wall2: '#8f6542', floor: '#7a5336', floor2: '#684629', rug: '#b5543f', rug2: '#8f3f2f', table: '#9b6b45', accent: '#e0a458', light: '#ffcf95', plant: false },
  { id: 'theme_pastel', name: 'Пастельный уют', desc: 'Нежно-розовые стены, мятный ковёр и гирлянда.', price: 400, wall: '#f2d6da', wall2: '#e8c4ca', floor: '#e6d2bf', floor2: '#d8c0a8', rug: '#bfe0d1', rug2: '#9fcbb8', table: '#f7eee6', accent: '#c4a5d8', light: '#ffe6d6', plant: false },
  { id: 'theme_botanic', name: 'Ботанический уголок', desc: 'Зелёные стены, много растений и мягкий дневной свет.', price: 450, wall: '#b8c9a7', wall2: '#a3b78f', floor: '#c7a77f', floor2: '#b39267', rug: '#e7dcc4', rug2: '#cfc0a1', table: '#d9c4a2', accent: '#557d51', light: '#fff2cf', plant: true },
];

export const SECOND_FLOOR_PRICE = 450;

export function placeableDef(id: string): PlaceableDef | undefined {
  return PLACEABLES.find((p) => p.id === id);
}
export function foodDef(id: string): FoodDef | undefined {
  return FOODS.find((f) => f.id === id);
}
export function cageDef(id: string): CageDef {
  return CAGES.find((c) => c.id === id) ?? CAGES[0];
}
export function themeDef(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function itemName(id: string): string {
  return (
    placeableDef(id)?.name ??
    foodDef(id)?.name ??
    CONSUMABLES.find((c) => c.id === id)?.name ??
    BOTTLES.find((b) => b.id === id)?.name ??
    id
  );
}
