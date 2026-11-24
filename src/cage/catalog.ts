import type {
  AchievementDef,
  CageItemDef,
  QuestDef,
  RoomThemeId,
  ShopCategory,
  SlotType,
} from '../types/game';

export const SHOP_CATEGORIES: { id: ShopCategory; label: string; icon: string }[] = [
  { id: 'food', label: 'Корма', icon: './assets/icons/pellet_food.png' },
  { id: 'houses', label: 'Домики', icon: './assets/icons/wood_house.png' },
  { id: 'hammocks', label: 'Гамаки', icon: './assets/icons/hammock.png' },
  { id: 'tunnels', label: 'Туннели', icon: './assets/icons/tunnel.png' },
  { id: 'toys', label: 'Игрушки', icon: './assets/icons/puzzle_feeder.png' },
  { id: 'care', label: 'Уход', icon: './assets/icons/water_bottle.png' },
  { id: 'habitats', label: 'Клетки', icon: './assets/icons/two_level_cage.png' },
  { id: 'themes', label: 'Темы', icon: './assets/icons/shop.png' },
  { id: 'upgrades', label: '2-й этаж', icon: './assets/icons/shelf.png' },
];

export const SHOP_ITEMS: CageItemDef[] = [
  // 1. Корма и лакомства
  {
    id: 'food_grain',
    name: 'Зерновая смесь',
    description: 'Сбалансированный повседневный корм из злаков и гранул.',
    category: 'food',
    price: 15,
    icon: './assets/icons/pellet_food.png',
    isConsumable: true,
    hungerRestore: 38,
    trustGain: 4,
  },
  {
    id: 'food_veggies',
    name: 'Свежие овощи',
    description: 'Хрустящая брокколи, морковка и огурчик — кладезь витаминов.',
    category: 'food',
    price: 22,
    icon: './assets/icons/vegetables.png',
    isConsumable: true,
    hungerRestore: 30,
    healthBonus: 10,
    trustGain: 7,
  },
  {
    id: 'food_yogurt_drops',
    name: 'Йогуртовые дропсы',
    description: 'Любимое нежное лакомство для дрессировки и дружбы!',
    category: 'food',
    price: 30,
    icon: './assets/icons/fruit_treat.png',
    isConsumable: true,
    hungerRestore: 18,
    trustGain: 14,
  },
  {
    id: 'food_nuts',
    name: 'Орешки',
    description: 'Ароматные фундук и грецкие орешки в хрустящей скорлупе.',
    category: 'food',
    price: 28,
    icon: './assets/icons/foraging_box.png',
    isConsumable: true,
    hungerRestore: 25,
    trustGain: 11,
  },
  {
    id: 'food_seeds',
    name: 'Тыквенные семечки',
    description: 'Полезные и вкусные семечки, которые крыски обожают держать в лапках.',
    category: 'food',
    price: 18,
    icon: './assets/icons/pellet_food.png',
    isConsumable: true,
    hungerRestore: 20,
    trustGain: 8,
  },

  // 2. Домики
  {
    id: 'house_wood',
    name: 'Деревянный домик',
    description: 'Уютный домик из натурального бука для спокойного сна.',
    category: 'houses',
    price: 70,
    icon: './assets/icons/wood_house.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 12,
    modelType: 'house_wood',
  },
  {
    id: 'house_pouch',
    name: 'Мягкий вигвам',
    description: 'Тёплый плюшевый домик-вигвам с мягким входом.',
    category: 'houses',
    price: 95,
    icon: './assets/icons/sleeping_pouch.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 16,
    modelType: 'house_pouch',
  },
  {
    id: 'house_pumpkin',
    name: 'Домик-тыква',
    description: 'Милый уютный домик в форме тёплой осенней тыковки.',
    category: 'houses',
    price: 125,
    icon: './assets/icons/sleeping_pouch.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 18,
    modelType: 'house_pumpkin',
  },
  {
    id: 'house_nest',
    name: 'Просторное гнездо',
    description: 'Мягкая плетёная лежанка, куда поместятся сразу несколько крысок.',
    category: 'houses',
    price: 140,
    icon: './assets/icons/foraging_box.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 22,
    modelType: 'house_nest',
  },

  // 3. Гамаки
  {
    id: 'hammock_fabric',
    name: 'Тканевый гамак',
    description: 'Мягкий хлопковый гамак на карабинах — крыски обожают в нём дремать!',
    category: 'hammocks',
    price: 65,
    icon: './assets/icons/hammock.png',
    slotTypes: ['hanging', 'upper_hanging'],
    comfortBonus: 15,
    modelType: 'hammock_fabric',
  },
  {
    id: 'hammock_double',
    name: 'Двухъярусный гамак',
    description: 'Два уютных уровня: можно спать сверху или прятаться внутри.',
    category: 'hammocks',
    price: 120,
    icon: './assets/icons/clean_hammock.png',
    slotTypes: ['hanging', 'upper_hanging'],
    comfortBonus: 22,
    modelType: 'hammock_double',
  },
  {
    id: 'hammock_plush',
    name: 'Угловой плюшевый гамак',
    description: 'Пушистый тёплый уголок с мягкой меховой подкладкой.',
    category: 'hammocks',
    price: 105,
    icon: './assets/icons/hammock.png',
    slotTypes: ['hanging', 'upper_hanging'],
    comfortBonus: 19,
    modelType: 'hammock_plush',
  },

  // 4. Туннели
  {
    id: 'tunnel_clear',
    name: 'Прозрачная труба',
    description: 'Забавная изогнутая труба, через которую видно, как бежит крыска.',
    category: 'tunnels',
    price: 75,
    icon: './assets/icons/tunnel.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 10,
    modelType: 'tunnel_clear',
  },
  {
    id: 'tunnel_fabric',
    name: 'Тканевый рукав',
    description: 'Шуршащий мягкий льняной тоннель для пряток и забегов.',
    category: 'tunnels',
    price: 85,
    icon: './assets/icons/tunnel.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 13,
    modelType: 'tunnel_fabric',
  },
  {
    id: 'tunnel_bridge',
    name: 'Деревянный мостик-туннель',
    description: 'Арочный мостик: можно перебегать сверху и прятаться снизу.',
    category: 'tunnels',
    price: 90,
    icon: './assets/icons/bridge.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 14,
    modelType: 'tunnel_bridge',
  },

  // 5. Игрушки
  {
    id: 'toy_ball',
    name: 'Мячики для катания',
    description: 'Лёгкие безопасные мячики-погремушки для весёлых игр.',
    category: 'toys',
    price: 45,
    icon: './assets/icons/training_target.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 8,
    modelType: 'toy_ball',
  },
  {
    id: 'puzzle_feeder',
    name: 'Фуражилка-головоломка',
    description: 'Развивающая деревянная игрушка со спрятанными угощениями.',
    category: 'toys',
    price: 110,
    icon: './assets/icons/puzzle_feeder.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 16,
    modelType: 'puzzle_feeder',
  },
  {
    id: 'toy_rope',
    name: 'Канат для лазания',
    description: 'Плетёный хлопковый канат — развивает ловкость и баланс.',
    category: 'toys',
    price: 60,
    icon: './assets/icons/chew_sticks.png',
    slotTypes: ['hanging', 'upper_hanging'],
    comfortBonus: 11,
    modelType: 'toy_rope',
  },
  {
    id: 'toy_wheel',
    name: 'Безопасное беговое колесо',
    description: 'Сплошное колесо большого диаметра, бережное к спинке и хвостику.',
    category: 'toys',
    price: 150,
    icon: './assets/icons/settings.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 20,
    modelType: 'toy_wheel',
  },
  {
    id: 'toy_ladder',
    name: 'Верёвочная лесенка',
    description: 'Деревянные перекладины на мягких верёвках для акробатики.',
    category: 'toys',
    price: 80,
    icon: './assets/icons/bridge.png',
    slotTypes: ['hanging', 'upper_hanging'],
    comfortBonus: 12,
    modelType: 'toy_ladder',
  },

  // 6. Предметы ухода
  {
    id: 'water_bottle',
    name: 'Подвесная поилка',
    description: 'Чистая стеклянная поилка с удобным шариковым носиком.',
    category: 'care',
    price: 45,
    icon: './assets/icons/water_bottle.png',
    slotTypes: ['wall'],
    comfortBonus: 10,
    modelType: 'water_bottle',
  },
  {
    id: 'bowl_ceramic',
    name: 'Керамическая миска',
    description: 'Тяжёлая устойчивая миска, которую невозможно перевернуть.',
    category: 'care',
    price: 50,
    icon: './assets/icons/food_bowl.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 10,
    modelType: 'bowl_ceramic',
  },
  {
    id: 'care_bedding',
    name: 'Мягкий наполнитель',
    description: 'Свежий беспыльный целлюлозный наполнитель — освежает всю клетку!',
    category: 'care',
    price: 35,
    icon: './assets/icons/litter_scoop.png',
    isConsumable: true,
    comfortBonus: 25,
    healthBonus: 12,
  },
  {
    id: 'care_paper',
    name: 'Салфетки для гнезда',
    description: 'Полоски мягкой бумаги — крыски обожают таскать их в домик!',
    category: 'care',
    price: 30,
    icon: './assets/icons/nesting_paper.png',
    slotTypes: ['floor', 'upper_floor'],
    comfortBonus: 12,
    modelType: 'care_paper',
  },

  // 7. Клетки и манежи
  {
    id: 'habitat_basic',
    name: 'Просторная базовая клетка',
    description: 'Уютная светлая клетка с глубоким поддоном и безопасными прутьями.',
    category: 'habitats',
    price: 0,
    icon: './assets/icons/two_level_cage.png',
    habitatId: 'basic_cage',
  },
  {
    id: 'habitat_panoramic',
    name: 'Большая панорамная клетка',
    description: 'Просторный видовой дом с широким обзором и дополнительным простором.',
    category: 'habitats',
    price: 260,
    icon: './assets/icons/three_level_cage.png',
    habitatId: 'panoramic_cage',
  },
  {
    id: 'habitat_playpen',
    name: 'Выгульный манеж',
    description: 'Светлый открытый манеж на мягком пледе для свободных пробежек!',
    category: 'habitats',
    price: 320,
    icon: './assets/icons/playpen.png',
    habitatId: 'playpen',
  },

  // 8. Темы оформления комнаты
  {
    id: 'theme_scandi',
    name: 'Уютная сканди-комната',
    description: 'Светлые кремовые стены, натуральный дуб и шалфейные акценты.',
    category: 'themes',
    price: 0,
    icon: './assets/icons/shop.png',
    themeId: 'scandi',
  },
  {
    id: 'theme_warm_wood',
    name: 'Тёплое дерево',
    description: 'Солнечный медовый интерьер с янтарным вечерним светом.',
    category: 'themes',
    price: 120,
    icon: './assets/icons/wood_house.png',
    themeId: 'warm_wood',
  },
  {
    id: 'theme_pastel',
    name: 'Пастельный уют',
    description: 'Нежные пудрово-лавандовые и кремовые оттенки комнаты.',
    category: 'themes',
    price: 140,
    icon: './assets/icons/sleeping_pouch.png',
    themeId: 'pastel',
  },
  {
    id: 'theme_botanical',
    name: 'Ботанический уголок',
    description: 'Свежие оливковые стены, зелень растений и мягкий утренний свет.',
    category: 'themes',
    price: 160,
    icon: './assets/icons/vegetables.png',
    themeId: 'botanical',
  },

  // 9. Расширение до 2 этажа
  {
    id: 'upgrade_second_floor',
    name: 'Расширение: 2-й этаж',
    description: 'Добавляет в клетку полноценный второй ярус с деревянной полкой, лесенкой и новыми слотами для гамаков и домиков!',
    category: 'upgrades',
    price: 190,
    icon: './assets/icons/shelf.png',
    isSecondFloorUpgrade: true,
  },
];

export const ITEM_MAP: Record<string, CageItemDef> = Object.fromEntries(
  SHOP_ITEMS.map((item) => [item.id, item])
);

export interface CageSlotDef {
  id: string;
  label: string;
  type: SlotType;
  position: [number, number, number];
  rotationY?: number;
  requiresSecondFloor?: boolean;
}

/** 3D placement slots inside the cage */
export const CAGE_SLOTS: CageSlotDef[] = [
  // Ground floor (Y = 0.08 is top of bedding)
  { id: 'floor_left_back', label: 'Нижний левый угол', type: 'floor', position: [-0.82, 0.08, -0.36], rotationY: 0.35 },
  { id: 'floor_center_back', label: 'Центр задней стенки', type: 'floor', position: [0.0, 0.08, -0.44], rotationY: 0 },
  { id: 'floor_right_back', label: 'Нижний правый угол', type: 'floor', position: [0.82, 0.08, -0.34], rotationY: -0.35 },
  { id: 'floor_left_front', label: 'Передний левый слот', type: 'floor', position: [-0.66, 0.08, 0.36], rotationY: 0.2 },
  { id: 'floor_right_front', label: 'Передний правый слот', type: 'floor', position: [0.68, 0.08, 0.36], rotationY: -0.2 },

  // Hanging slots (level 1 ceiling or underside)
  { id: 'hang_left', label: 'Подвес слева', type: 'hanging', position: [-0.72, 0.72, -0.08], rotationY: 0.15 },
  { id: 'hang_right', label: 'Подвес справа', type: 'hanging', position: [0.74, 0.72, -0.05], rotationY: -0.15 },

  // Wall slot for water bottle
  { id: 'wall_bottle', label: 'Стенка (поилка)', type: 'wall', position: [1.14, 0.36, 0.16], rotationY: -Math.PI / 2 },

  // 2nd Floor slots (Y = 0.78 is top of 2nd floor shelf)
  {
    id: 'upper_left',
    label: '2-й этаж слева',
    type: 'upper_floor',
    position: [-0.75, 0.78, -0.15],
    rotationY: 0.25,
    requiresSecondFloor: true,
  },
  {
    id: 'upper_center',
    label: '2-й этаж по центру',
    type: 'upper_floor',
    position: [-0.05, 0.78, -0.25],
    rotationY: 0,
    requiresSecondFloor: true,
  },
  {
    id: 'upper_hang',
    label: 'Верхний подвес (2-й этаж)',
    type: 'upper_hanging',
    position: [0.62, 1.38, -0.1],
    rotationY: -0.1,
    requiresSecondFloor: true,
  },
];

export const ROOM_THEMES: Record<
  RoomThemeId,
  {
    wallColor: string;
    floorColor: string;
    baseboardColor: string;
    accentColor: string;
    lightColor: string;
    ambientColor: string;
    bgColor: string;
  }
> = {
  scandi: {
    wallColor: '#EADCC8',
    floorColor: '#C59A6C',
    baseboardColor: '#728272',
    accentColor: '#6E8572',
    lightColor: '#FFF3DF',
    ambientColor: '#F6E8D2',
    bgColor: '#EAE0D0',
  },
  warm_wood: {
    wallColor: '#DEC4A4',
    floorColor: '#A97848',
    baseboardColor: '#6E4B32',
    accentColor: '#B87242',
    lightColor: '#FFE5BD',
    ambientColor: '#F3D6B3',
    bgColor: '#DFC7A8',
  },
  pastel: {
    wallColor: '#EBDDE4',
    floorColor: '#D6BEAA',
    baseboardColor: '#A48D9A',
    accentColor: '#B68FA3',
    lightColor: '#FFF5F7',
    ambientColor: '#F3E4EC',
    bgColor: '#ECE0E6',
  },
  botanical: {
    wallColor: '#D7E2D4',
    floorColor: '#B99268',
    baseboardColor: '#566C57',
    accentColor: '#56785A',
    lightColor: '#F7FFE8',
    ambientColor: '#E2EEDF',
    bgColor: '#D8E3D5',
  },
};

export const QUESTS: QuestDef[] = [
  // Starter gentle onboarding quests
  {
    id: 'q_feed_1',
    title: 'Первый перекус',
    description: 'Угости крыску лакомством или кормом.',
    kind: 'starter',
    target: 1,
    rewardCoins: 35,
    icon: './assets/icons/pellet_food.png',
    trackKey: 'feedCount',
  },
  {
    id: 'q_pet_1',
    title: 'Тёплое знакомство',
    description: 'Нежно погладь свою крыску.',
    kind: 'starter',
    target: 1,
    rewardCoins: 35,
    icon: './assets/icons/trust.png',
    trackKey: 'petCount',
  },
  {
    id: 'q_call_1',
    title: 'Отклик на имя',
    description: 'Позови крыску по имени.',
    kind: 'starter',
    target: 1,
    rewardCoins: 30,
    icon: './assets/icons/pets.png',
    trackKey: 'callCount',
  },
  {
    id: 'q_hammock_1',
    title: 'Уютный гамак',
    description: 'Купи и повесь в клетку гамак.',
    kind: 'starter',
    target: 1,
    rewardCoins: 60,
    icon: './assets/icons/hammock.png',
    trackKey: 'hammockPlaced',
  },
  {
    id: 'q_photo_1',
    title: 'Памятный снимок',
    description: 'Сделай первое фото в фоторежиме.',
    kind: 'starter',
    target: 1,
    rewardCoins: 45,
    icon: './assets/icons/camera.png',
    trackKey: 'photoCount',
  },

  // Daily & story progression quests
  {
    id: 'q_play_3',
    title: 'Время весёлых игр',
    description: 'Поиграй с питомцами 3 раза.',
    kind: 'daily',
    target: 3,
    rewardCoins: 65,
    icon: './assets/icons/training_target.png',
    trackKey: 'playCount',
  },
  {
    id: 'q_trick_1',
    title: 'Юный артист',
    description: 'Изучи любой трюк до 100%.',
    kind: 'story',
    target: 1,
    rewardCoins: 90,
    icon: './assets/icons/quests.png',
    trackKey: 'tricksLearned',
  },
  {
    id: 'q_friend_2',
    title: 'Дружная компания',
    description: 'Заведи вторую крыску — вместе им ещё веселее!',
    kind: 'story',
    target: 2,
    rewardCoins: 110,
    icon: './assets/icons/pets.png',
    trackKey: 'ratCount',
  },
  {
    id: 'q_second_floor',
    title: 'Двухэтажный особняк',
    description: 'Открой расширение до 2-го этажа в магазине.',
    kind: 'story',
    target: 1,
    rewardCoins: 120,
    icon: './assets/icons/shelf.png',
    trackKey: 'secondFloorUnlocked',
  },
  {
    id: 'q_trust_80',
    title: 'Настоящее доверие',
    description: 'Подними доверие любого питомца до 80%.',
    kind: 'story',
    target: 80,
    rewardCoins: 100,
    icon: './assets/icons/trust.png',
    trackKey: 'maxTrust',
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach_first_friend',
    title: 'Добро пожаловать домой',
    description: 'Завести первую декоративную крыску.',
    rewardCoins: 25,
    icon: './assets/icons/white_gray_back_stripe.png',
  },
  {
    id: 'ach_gourmet',
    title: 'Щедрый хозяин',
    description: 'Угостить питомцев 10 раз.',
    rewardCoins: 60,
    icon: './assets/icons/vegetables.png',
  },
  {
    id: 'ach_trainer',
    title: 'Мастер трюков',
    description: 'Выучить 3 разных трюка.',
    rewardCoins: 120,
    icon: './assets/icons/quests.png',
  },
  {
    id: 'ach_designer',
    title: 'Дизайнер уюта',
    description: 'Разместить в клетке 5 разных предметов.',
    rewardCoins: 90,
    icon: './assets/icons/wood_house.png',
  },
  {
    id: 'ach_photographer',
    title: 'Семейный фотограф',
    description: 'Собрать 5 фотографий в альбоме.',
    rewardCoins: 80,
    icon: './assets/icons/camera.png',
  },
  {
    id: 'ach_best_friends',
    title: 'Лучшие друзья навсегда',
    description: 'Достичь 100% доверия с крыской.',
    rewardCoins: 150,
    icon: './assets/icons/trust.png',
  },
];
