/** Игровые события, на которые реагируют задания и достижения */
export type GameEvent =
  | 'fill_bowl'
  | 'refresh_water'
  | 'refresh_bedding'
  | 'give_tissues'
  | 'pet'
  | 'call'
  | 'treat'
  | 'place_hammock'
  | 'place_item'
  | 'photo'
  | 'play'
  | 'train'
  | 'trick_learned'
  | 'trick_perform'
  | 'buy'
  | 'open_card'
  | 'rename'
  | 'adopt'
  | 'litter'
  | 'nest_paper'
  | 'second_floor'
  | 'theme'
  | 'vitamins';

export interface QuestDef {
  id: string;
  title: string;
  hint: string;
  event: GameEvent;
  target: number;
  reward: number;
}

/** Цепочка мягких стартовых заданий */
export const STORY_QUESTS: QuestDef[] = [
  { id: 's_feed', title: 'Покормить крыску', hint: 'Нажми «Миска» внизу экрана, чтобы насыпать зерновую смесь.', event: 'fill_bowl', target: 1, reward: 30 },
  { id: 's_pet', title: 'Погладить питомца', hint: 'Нажми на крыску, выбери «Погладить» и проведи пальцем по спинке.', event: 'pet', target: 1, reward: 30 },
  { id: 's_call', title: 'Позвать по имени', hint: 'Выбери крыску и нажми «Позвать».', event: 'call', target: 1, reward: 25 },
  { id: 's_hammock', title: 'Повесить гамак', hint: 'Открой «Обустройство», нажми на подвесной слот под крышей и выбери гамак.', event: 'place_hammock', target: 1, reward: 40 },
  { id: 's_photo', title: 'Сделать фото', hint: 'Кнопка с фотоаппаратом включает фоторежим. Нажми на затвор!', event: 'photo', target: 1, reward: 30 },
  { id: 's_treat', title: 'Угостить с руки', hint: 'Выбери крыску → «Лакомство» → выбери угощение.', event: 'treat', target: 1, reward: 30 },
  { id: 's_card', title: 'Познакомиться поближе', hint: 'Открой карточку питомца — там характер, шкалы и трюки.', event: 'open_card', target: 1, reward: 20 },
  { id: 's_play', title: 'Поиграть с пёрышком', hint: 'Выбери крыску → «Играть» и води пёрышком по экрану.', event: 'play', target: 1, reward: 40 },
  { id: 's_train', title: 'Первое занятие', hint: 'Выбери крыску → «Трюки» и попробуй выучить «Поворот».', event: 'train', target: 3, reward: 50 },
  { id: 's_buy', title: 'Первая покупка', hint: 'Загляни в магазин и купи что-нибудь для клетки.', event: 'buy', target: 1, reward: 40 },
  { id: 's_tissues', title: 'Материал для гнезда', hint: 'Дай салфетки (кнопка «Салфетки») и посмотри, как крыски строят гнездо.', event: 'give_tissues', target: 1, reward: 30 },
  { id: 's_trick', title: 'Выучить трюк', hint: 'Доведи любой трюк до конца на занятиях.', event: 'trick_learned', target: 1, reward: 80 },
];

/** Пул ежедневных заданий (каждый день выбираются 3) */
export const DAILY_POOL: QuestDef[] = [
  { id: 'd_pet5', title: 'Погладить крысок 5 раз', hint: 'Поглаживания укрепляют доверие.', event: 'pet', target: 5, reward: 40 },
  { id: 'd_treat3', title: 'Угостить 3 раза', hint: 'Любые лакомства из инвентаря.', event: 'treat', target: 3, reward: 35 },
  { id: 'd_play2', title: 'Поиграть 2 раза', hint: 'Пёрышко или мячик.', event: 'play', target: 2, reward: 45 },
  { id: 'd_train3', title: '3 занятия дрессировкой', hint: 'Любой трюк, любая крыска.', event: 'train', target: 3, reward: 45 },
  { id: 'd_photo2', title: 'Сделать 2 фото', hint: 'Поймай милый момент!', event: 'photo', target: 2, reward: 30 },
  { id: 'd_call3', title: 'Позвать по имени 3 раза', hint: 'Крыски учатся откликаться.', event: 'call', target: 3, reward: 25 },
  { id: 'd_feed', title: 'Наполнить миску', hint: 'Свежая зерновая смесь.', event: 'fill_bowl', target: 1, reward: 20 },
  { id: 'd_water', title: 'Сменить воду', hint: 'Свежая вода в поилке.', event: 'refresh_water', target: 1, reward: 20 },
  { id: 'd_trick', title: 'Показать трюк 2 раза', hint: 'Выбери изученный трюк в меню «Трюки».', event: 'trick_perform', target: 2, reward: 40 },
  { id: 'd_place', title: 'Переставить что-нибудь', hint: 'Режим обустройства — новые маршруты для крысок.', event: 'place_item', target: 1, reward: 25 },
];

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  reward: number;
  check: (c: Record<string, number>) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_first_pet', title: 'Первое касание', desc: 'Погладить крыску впервые.', reward: 20, check: (c) => (c.pet ?? 0) >= 1 },
  { id: 'a_pet50', title: 'Тёплые ладошки', desc: 'Погладить крысок 50 раз.', reward: 100, check: (c) => (c.pet ?? 0) >= 50 },
  { id: 'a_treat25', title: 'Щедрая рука', desc: 'Угостить крысок 25 раз.', reward: 80, check: (c) => (c.treat ?? 0) >= 25 },
  { id: 'a_trick1', title: 'Умница!', desc: 'Выучить первый трюк.', reward: 60, check: (c) => (c.trick_learned ?? 0) >= 1 },
  { id: 'a_trick5', title: 'Цирк на дому', desc: 'Выучить 5 трюков (у любых крысок).', reward: 200, check: (c) => (c.trick_learned ?? 0) >= 5 },
  { id: 'a_photo10', title: 'Фотограф', desc: 'Сделать 10 фотографий.', reward: 80, check: (c) => (c.photo ?? 0) >= 10 },
  { id: 'a_trust100', title: 'Лучшие друзья', desc: 'Довести доверие крыски до максимума.', reward: 150, check: (c) => (c.max_trust ?? 0) >= 100 },
  { id: 'a_rats3', title: 'Дружная компания', desc: 'Завести трёх крысок.', reward: 120, check: (c) => (c.rats_owned ?? 0) >= 3 },
  { id: 'a_floor2', title: 'Двухэтажный дом', desc: 'Достроить второй этаж клетки.', reward: 100, check: (c) => (c.second_floor ?? 0) >= 1 },
  { id: 'a_nest', title: 'Гнездо готово', desc: 'Крыски перенесли в домик 10 салфеток.', reward: 70, check: (c) => (c.nest_paper ?? 0) >= 10 },
  { id: 'a_play20', title: 'Неутомимые', desc: 'Сыграть с крысками 20 раз.', reward: 120, check: (c) => (c.play ?? 0) >= 20 },
  { id: 'a_decor10', title: 'Дизайнер клеток', desc: 'Расставить 10 предметов.', reward: 80, check: (c) => (c.place_item ?? 0) >= 10 },
  { id: 'a_theme', title: 'Новый интерьер', desc: 'Сменить тему комнаты.', reward: 60, check: (c) => (c.theme ?? 0) >= 1 },
  { id: 'a_litter', title: 'Пополнение', desc: 'В семье родились крысята.', reward: 150, check: (c) => (c.litter ?? 0) >= 1 },
  { id: 'a_days7', title: 'Неделя вместе', desc: 'Заходить в игру 7 разных дней.', reward: 150, check: (c) => (c.days_played ?? 0) >= 7 },
];
