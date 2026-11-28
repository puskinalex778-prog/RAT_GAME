class_name Data
extends RefCounted
## Статические игровые данные: окрасы, характеры, предметы, задания, темы.

# ---------- Рисунки шерсти (используются шейдером fur.gdshader) ----------
const P_SELF := 0
const P_BELLY_LIGHT := 1
const P_STRIPE := 2
const P_CAPPED := 3
const P_HOODED := 4
const P_BERKSHIRE := 5
const P_VARIEGATED := 6
const P_SPOTS := 7
const P_HOOD_ONLY := 8
const P_SIAMESE := 9
const P_HIMALAYAN := 10

const PATTERN_NAMES := {
	0: "Однотонный", 1: "Однотонный, светлый живот", 2: "Полоса по спине",
	3: "Полоса и шапочка", 4: "Капюшон с полосой", 5: "Берксир (светлый живот и лапки)",
	6: "Пятнистый (вариегейтед)", 7: "Мелкие пятнышки", 8: "Капюшон без полосы",
	9: "Сиамский (пойнты)", 10: "Гималайский",
}

const WHITE := Color(0.92, 0.90, 0.87)
const COLORS := {
	"white": Color(0.92, 0.90, 0.87), "gray": Color(0.40, 0.42, 0.45), "blue": Color(0.45, 0.51, 0.60),
	"black": Color(0.14, 0.14, 0.15), "agouti": Color(0.39, 0.31, 0.21), "beige": Color(0.82, 0.72, 0.58),
	"cream": Color(0.90, 0.84, 0.71), "chocolate": Color(0.34, 0.21, 0.14), "siam_body": Color(0.87, 0.82, 0.72),
	"siam_point": Color(0.31, 0.23, 0.19), "hima_point": Color(0.42, 0.36, 0.33), "silver": Color(0.52, 0.53, 0.56),
	"dark_gray": Color(0.30, 0.31, 0.34),
}
const COLOR_NAMES := {
	"white": "Белый", "gray": "Серый", "blue": "Голубовато-серый", "black": "Чёрный", "agouti": "Агути",
	"beige": "Бежевый", "cream": "Кремовый", "chocolate": "Шоколадный", "siam_body": "Светло-кремовый",
	"siam_point": "Тёмно-коричневый", "hima_point": "Серо-коричневый", "silver": "Серебристый", "dark_gray": "Тёмно-серый",
}

const EYES := {
	"black": {"name": "Тёмные", "color": Color(0.05, 0.03, 0.03)},
	"ruby": {"name": "Рубиновые", "color": Color(0.34, 0.02, 0.06)},
	"red": {"name": "Красные", "color": Color(0.86, 0.12, 0.18)},
}

## 21 готовый вариант (основной — №1 в двух версиях: с белой головой и с шапочкой).
const COATS := [
	{"id": "white_stripe", "name": "Белая с серой полоской", "img": "white_gray_back_stripe", "pattern": P_STRIPE, "base": "white", "mark": "gray", "eyes": ["black", "ruby"]},
	{"id": "white_stripe_cap", "name": "Белая с серой полоской и шапочкой", "img": "gray_capped", "pattern": P_CAPPED, "base": "white", "mark": "gray", "eyes": ["black", "ruby"]},
	{"id": "solid_gray", "name": "Полностью серая", "img": "solid_gray", "pattern": P_BELLY_LIGHT, "base": "gray", "mark": "gray", "eyes": ["black"]},
	{"id": "white_dark_eyes", "name": "Белая с тёмными глазами", "img": "white_black_eyes", "pattern": P_SELF, "base": "white", "mark": "white", "eyes": ["black"]},
	{"id": "albino", "name": "Белая с красными глазами", "img": "albino", "pattern": P_SELF, "base": "white", "mark": "white", "eyes": ["red", "ruby"]},
	{"id": "black", "name": "Чёрная однотонная", "img": "black", "pattern": P_SELF, "base": "black", "mark": "black", "eyes": ["black"]},
	{"id": "black_hooded", "name": "Чёрно-белая, капюшон и полоса", "img": "black_hooded", "pattern": P_HOODED, "base": "white", "mark": "black", "eyes": ["black"]},
	{"id": "gray_patched", "name": "Серо-белая пятнистая", "img": "gray_white_patched", "pattern": P_VARIEGATED, "base": "white", "mark": "gray", "eyes": ["black", "ruby"]},
	{"id": "black_berkshire", "name": "Чёрная с белым животиком", "img": "black_white_belly", "pattern": P_BERKSHIRE, "base": "black", "mark": "white", "eyes": ["black"]},
	{"id": "gray_berkshire", "name": "Серая с белым животиком", "img": "gray_white_belly", "pattern": P_BERKSHIRE, "base": "gray", "mark": "white", "eyes": ["black"]},
	{"id": "blue", "name": "Голубовато-серая", "img": "blue_gray", "pattern": P_BELLY_LIGHT, "base": "blue", "mark": "blue", "eyes": ["black", "ruby"]},
	{"id": "agouti", "name": "Коричневая агути", "img": "agouti", "pattern": P_SELF, "base": "agouti", "mark": "agouti", "eyes": ["black"], "ticking": 1.0},
	{"id": "beige", "name": "Тёплая бежевая", "img": "beige", "pattern": P_SELF, "base": "beige", "mark": "beige", "eyes": ["ruby", "black", "red"]},
	{"id": "cream", "name": "Кремовая", "img": "cream", "pattern": P_SELF, "base": "cream", "mark": "cream", "eyes": ["ruby", "black", "red"]},
	{"id": "chocolate", "name": "Шоколадно-коричневая", "img": "chocolate", "pattern": P_SELF, "base": "chocolate", "mark": "chocolate", "eyes": ["black"]},
	{"id": "white_hood", "name": "Белая с тёмной головой", "img": "", "pattern": P_HOOD_ONLY, "base": "white", "mark": "dark_gray", "eyes": ["black"]},
	{"id": "siamese", "name": "Сиамского типа", "img": "siamese", "pattern": P_SIAMESE, "base": "siam_body", "mark": "siam_point", "eyes": ["ruby", "black"]},
	{"id": "himalayan", "name": "Гималайского типа", "img": "himalayan", "pattern": P_HIMALAYAN, "base": "white", "mark": "hima_point", "eyes": ["red", "ruby"]},
	{"id": "silver", "name": "Серебристая", "img": "silver", "pattern": P_SELF, "base": "silver", "mark": "silver", "eyes": ["black"], "silver": 1.0},
	{"id": "white_gray_spots", "name": "Белая с серыми пятнышками", "img": "white_gray_spots", "pattern": P_SPOTS, "base": "white", "mark": "gray", "eyes": ["black", "ruby"]},
	{"id": "white_black_spots", "name": "Белая с чёрными пятнышками", "img": "white_black_spots", "pattern": P_SPOTS, "base": "white", "mark": "black", "eyes": ["black"]},
]

static func coat(id: String) -> Dictionary:
	for c in COATS:
		if c.id == id:
			return c
	return COATS[0]

## Внешность → полный словарь для модели
static func appearance_from_coat(coat_id: String, eye := "", ears := "normal", rex := false) -> Dictionary:
	var c := coat(coat_id)
	return {
		"coat": c.id, "pattern": c.pattern, "base": c.base, "mark": c.mark,
		"eye": eye if eye != "" else c.eyes[0], "ears": ears, "rex": rex,
		"ticking": c.get("ticking", 0.0), "silver": c.get("silver", 0.0),
	}

static func describe_appearance(a: Dictionary) -> String:
	var c := coat(a.get("coat", ""))
	var s: String = c.name if a.get("coat", "") != "custom" else "Свой вариант"
	if a.get("coat", "") == "custom":
		s = "%s: %s / %s" % [PATTERN_NAMES.get(int(a.pattern), "?"), COLOR_NAMES.get(a.base, ""), COLOR_NAMES.get(a.mark, "")]
	var extra := []
	if a.get("ears", "normal") == "dumbo":
		extra.append("ушки дамбо")
	if a.get("rex", false):
		extra.append("шерсть рекс")
	extra.append("глаза: " + EYES[a.get("eye", "black")].name.to_lower())
	return s + " (" + ", ".join(extra) + ")"

# ---------- Характеры ----------
const PERSONALITIES := {
	"curious": {"name": "Любопытная", "desc": "Первой бежит к новым предметам.", "curiosity": 0.9, "caution": 0.2, "social": 0.6, "activity": 0.7, "puzzle": 0.6, "cozy": 0.4},
	"cautious": {"name": "Осторожная", "desc": "Сначала наблюдает из укрытия, доверяет постепенно.", "curiosity": 0.4, "caution": 0.9, "social": 0.5, "activity": 0.4, "puzzle": 0.4, "cozy": 0.8},
	"social": {"name": "Общительная", "desc": "Любит компанию сородичей и людей.", "curiosity": 0.6, "caution": 0.3, "social": 0.95, "activity": 0.6, "puzzle": 0.4, "cozy": 0.5},
	"active": {"name": "Активная", "desc": "Много лазает и исследует маршруты.", "curiosity": 0.7, "caution": 0.3, "social": 0.6, "activity": 0.95, "puzzle": 0.5, "cozy": 0.3},
	"calm": {"name": "Спокойная", "desc": "Неторопливая, любит долго дремать.", "curiosity": 0.4, "caution": 0.4, "social": 0.6, "activity": 0.3, "puzzle": 0.4, "cozy": 0.8},
	"puzzler": {"name": "Любительница головоломок", "desc": "Обожает игрушки-головоломки и обучение.", "curiosity": 0.7, "caution": 0.4, "social": 0.5, "activity": 0.6, "puzzle": 0.95, "cozy": 0.4},
	"explorer": {"name": "Исследовательница", "desc": "Проверяет каждый угол и туннель.", "curiosity": 0.85, "caution": 0.3, "social": 0.5, "activity": 0.8, "puzzle": 0.6, "cozy": 0.3},
	"cozy": {"name": "Любительница уютных мест", "desc": "Собирает гнёзда и выбирает мягкие места.", "curiosity": 0.5, "caution": 0.5, "social": 0.6, "activity": 0.4, "puzzle": 0.4, "cozy": 0.95},
}

static func personality_name(id: String, sex: String) -> String:
	var n: String = PERSONALITIES.get(id, PERSONALITIES.curious).name
	if sex == "m":
		n = n.replace("Любопытная", "Любопытный").replace("Осторожная", "Осторожный").replace("Общительная", "Общительный") \
			.replace("Активная", "Активный").replace("Спокойная", "Спокойный").replace("Любительница", "Любитель").replace("Исследовательница", "Исследователь")
	return n

# ---------- Еда ----------
const FOODS := {
	"pellets": {"name": "Полнорационный корм", "icon": "icons/pellet_food", "price": 15, "pack": 10, "desc": "Основа рациона декоративных крыс."},
	"veg": {"name": "Овощи (маленькие порции)", "icon": "icons/vegetables", "price": 12, "pack": 6, "desc": "Брокколи, морковь, огурец — понемногу."},
	"fruit": {"name": "Фруктовые лакомства", "icon": "icons/fruit_treat", "price": 12, "pack": 6, "desc": "Кусочки яблока и ягоды — изредка."},
	"treat": {"name": "Игровые угощения", "icon": "icons/trust", "price": 14, "pack": 8, "desc": "Крошечные лакомства для обучения и знакомства."},
}

# ---------- Предметы ----------
# slots: floor / shelf / hang / wall / pen ; kind: hide, cozy, toy, tunnel, forage, puzzle, chew, nest, bridge, ball, wheel, platform
const ITEMS := {
	"wood_house": {"name": "Деревянный домик", "cat": "houses", "price": 40, "icon": "items/wood_house", "slots": ["floor", "shelf", "pen"], "kind": "hide", "cozy": true, "comfort": 8, "colors": ["#c9a36b", "#e3c79a", "#9c7448", "#b9c7a6"], "desc": "Укрытие и место для сна."},
	"sleeping_pouch": {"name": "Тканевый мешочек для сна", "cat": "houses", "price": 35, "icon": "items/sleeping_pouch", "slots": ["hang"], "kind": "hide", "cozy": true, "comfort": 9, "colors": ["#c8694d", "#7f9c7a", "#d9b8c4", "#8fa6c4", "#e8d6b4"], "desc": "Мягкое подвесное укрытие."},
	"hammock": {"name": "Гамак", "cat": "hammocks", "price": 30, "icon": "items/hammock", "slots": ["hang"], "kind": "cozy", "cozy": true, "comfort": 8, "colors": ["#7f9c7a", "#c8694d", "#e8d6b4", "#b7a6d6", "#8fb6d4"], "desc": "Любимое место для совместного сна."},
	"hammock_double": {"name": "Двухъярусный гамак", "cat": "hammocks", "price": 55, "icon": "items/hammock", "slots": ["hang"], "kind": "cozy", "cozy": true, "comfort": 12, "colors": ["#e8d6b4", "#7f9c7a", "#d9b8c4", "#8fb6d4"], "desc": "Два уровня мягкого отдыха."},
	"tunnel": {"name": "Мягкий туннель", "cat": "tunnels", "price": 30, "icon": "items/tunnel", "slots": ["floor", "pen"], "kind": "tunnel", "cozy": false, "comfort": 5, "colors": ["#e3dccb", "#7f9c7a", "#c8694d", "#8fa6c4"], "desc": "Через него интересно пробегать."},
	"tunnel_long": {"name": "Длинный туннель", "cat": "tunnels", "price": 45, "icon": "items/tunnel", "slots": ["floor", "pen"], "kind": "tunnel", "cozy": true, "comfort": 7, "colors": ["#e3dccb", "#d9b8c4", "#7f9c7a"], "desc": "В нём можно и подремать."},
	"bridge": {"name": "Широкий низкий мостик", "cat": "toys", "price": 25, "icon": "items/bridge", "slots": ["floor", "pen"], "kind": "bridge", "cozy": false, "comfort": 4, "colors": ["#c9a36b", "#e3c79a"], "desc": "Безопасный мостик для прогулок и трюков."},
	"foraging_box": {"name": "Коробка для поиска корма", "cat": "toys", "price": 20, "icon": "items/foraging_box", "slots": ["floor", "shelf", "pen"], "kind": "forage", "cozy": false, "comfort": 5, "colors": ["#c9a36b"], "desc": "Можно спрятать немного корма."},
	"puzzle_feeder": {"name": "Игрушка-головоломка", "cat": "toys", "price": 45, "icon": "items/puzzle_feeder", "slots": ["floor", "shelf", "pen"], "kind": "puzzle", "cozy": false, "comfort": 5, "colors": ["#c9a36b", "#9c7448"], "desc": "Сдвигай крышечки — найди угощение."},
	"chew_sticks": {"name": "Палочки для грызения", "cat": "care", "price": 10, "icon": "items/chew_sticks", "slots": ["floor", "shelf", "pen"], "kind": "chew", "cozy": false, "comfort": 3, "colors": ["#9c7448"], "desc": "Безопасная древесина для зубов."},
	"nesting_paper": {"name": "Бумага для гнезда", "cat": "care", "price": 8, "icon": "items/nesting_paper", "slots": ["floor", "shelf"], "kind": "nest", "cozy": false, "comfort": 4, "colors": ["#f4efe3", "#e8d6b4"], "desc": "Крыски перенесут её в домик."},
	"ball": {"name": "Плетёный мячик", "cat": "toys", "price": 12, "icon": "", "slots": ["floor", "pen"], "kind": "ball", "cozy": false, "comfort": 3, "colors": ["#e3c79a", "#c8694d", "#7f9c7a"], "desc": "Лёгкий мячик для игры «Принеси»."},
	"platform": {"name": "Дополнительная широкая полка", "cat": "cages", "price": 45, "icon": "items/shelf", "slots": ["wall"], "kind": "platform", "cozy": true, "comfort": 6, "colors": ["#c9a36b", "#e3c79a"], "desc": "Сплошная полка с бортиком."},
	"wheel": {"name": "Большое колесо со сплошной дорожкой", "cat": "toys", "price": 80, "icon": "", "slots": ["floor"], "kind": "wheel", "cozy": false, "comfort": 4, "colors": ["#e3dccb", "#8fa6c4"], "desc": "Необязательно. Диаметр подходит, чтобы не выгибать спину."},
}

const UPGRADES := {
	"cage_xl": {"name": "Просторная трёхэтажная клетка", "price": 300, "icon": "habitats/three_level_cage", "desc": "Третий этаж, больше мест и лимит питомцев до 8."},
	"playpen": {"name": "Защищённый игровой манеж", "price": 150, "icon": "habitats/playpen", "desc": "Безопасная зона для прогулок и игр вне клетки."},
}

const SHOP_TABS := [
	["food", "Корма и лакомства"], ["houses", "Домики"], ["hammocks", "Гамаки"], ["tunnels", "Туннели"],
	["toys", "Игрушки"], ["care", "Уход"], ["cages", "Клетки и манежи"], ["themes", "Темы"], ["adopt", "Центр знакомства"],
]

const THEMES := {
	"scandi": {"name": "Уютный скандинавский домик", "price": 0, "tint": Color(1, 1, 1), "tray": Color(0.50, 0.60, 0.52), "litter": Color(0.64, 0.52, 0.37), "ambient": Color(0.96, 0.89, 0.80), "wall": Color(0.69, 0.62, 0.53)},
	"forest": {"name": "Лесная полянка", "price": 80, "tint": Color(0.78, 0.95, 0.74), "tray": Color(0.42, 0.56, 0.38), "litter": Color(0.56, 0.52, 0.36), "ambient": Color(0.86, 0.94, 0.84), "wall": Color(0.58, 0.67, 0.56)},
	"pastel": {"name": "Пастельная детская", "price": 80, "tint": Color(1.0, 0.86, 0.92), "tray": Color(0.78, 0.60, 0.66), "litter": Color(0.70, 0.58, 0.52), "ambient": Color(0.96, 0.88, 0.92), "wall": Color(0.74, 0.65, 0.69)},
	"space": {"name": "Космическая станция", "price": 120, "tint": Color(0.25, 0.30, 0.55), "tray": Color(0.36, 0.42, 0.54), "litter": Color(0.44, 0.47, 0.56), "ambient": Color(0.72, 0.80, 0.96), "wall": Color(0.20, 0.23, 0.36)},
	"city": {"name": "Миниатюрный город", "price": 100, "tint": Color(0.85, 0.88, 0.92), "tray": Color(0.46, 0.50, 0.54), "litter": Color(0.60, 0.56, 0.50), "ambient": Color(0.90, 0.92, 0.96), "wall": Color(0.62, 0.65, 0.70)},
	"autumn": {"name": "Осенний уют", "price": 90, "tint": Color(1.0, 0.80, 0.62), "tray": Color(0.65, 0.38, 0.24), "litter": Color(0.62, 0.48, 0.32), "ambient": Color(0.96, 0.82, 0.66), "wall": Color(0.70, 0.57, 0.44)},
}

const ADOPT_PRICE := 60

# ---------- Трюки ----------
const TRICKS := {
	"come": {"name": "Приходить на зов", "anim": "come", "desc": "Позови по имени — крыска прибежит."},
	"target": {"name": "Касаться мишени носом", "anim": "target", "desc": "Коснуться шарика на палочке."},
	"spin": {"name": "Поворот вокруг себя", "anim": "spin", "desc": "Следовать за лакомством по кругу."},
	"stand": {"name": "Стойка «Столбик»", "anim": "stand", "desc": "Встать на задние лапки."},
	"button": {"name": "Нажать кнопку", "anim": "button", "desc": "Нажать маленькую мягкую кнопку."},
	"fetch": {"name": "Принести мячик", "anim": "fetch", "desc": "Доставить лёгкий мячик к руке."},
	"bridge": {"name": "Пройти по мостику", "anim": "bridge", "desc": "Пройти по широкому низкому мостику."},
}

# ---------- Задания ----------
# check: имя функции-проверки в Game; reward: монеты
const QUESTS := [
	{"id": "t_names", "group": "start", "name": "Дай имена первой паре", "reward": 10},
	{"id": "t_water", "group": "start", "name": "Проверь воду", "reward": 5},
	{"id": "t_bowl", "group": "start", "name": "Наполни миску", "reward": 5},
	{"id": "t_hide", "group": "start", "name": "Добавь укрытие (мешочек в инвентаре)", "reward": 10},
	{"id": "t_hand", "group": "start", "name": "Протяни руку и дождись, пока крыска подойдёт сама", "reward": 15},
	{"id": "q_meet", "group": "main", "name": "Познакомься с каждой крыской (погладь всех)", "reward": 25},
	{"id": "q_hammock", "group": "main", "name": "Повесь новый гамак", "reward": 20},
	{"id": "q_cozy3", "group": "main", "name": "Создай три уютных места для отдыха", "reward": 30},
	{"id": "q_come", "group": "main", "name": "Научи питомца приходить на зов", "reward": 40},
	{"id": "q_forage", "group": "main", "name": "Устрой поиск лакомства", "reward": 25},
	{"id": "q_photo_sleep", "group": "main", "name": "Сфотографируй совместный сон", "reward": 30},
	{"id": "q_tunnels", "group": "main", "name": "Построй безопасный маршрут из двух туннелей", "reward": 30},
	{"id": "q_pen", "group": "main", "name": "Обустрой манеж (минимум 2 предмета)", "reward": 40},
	{"id": "q_favs", "group": "main", "name": "Найди любимую игрушку каждой крыски", "reward": 35},
	{"id": "q_clean", "group": "main", "name": "Сделай 5 спокойных уборок", "reward": 20},
	{"id": "q_maze", "group": "main", "name": "Пройди лабиринт с питомцем", "reward": 20},
]

const ACHIEVEMENTS := [
	{"id": "a_pets10", "name": "Нежные руки", "desc": "Погладь питомцев 10 раз", "counter": "pets", "need": 10, "reward": 20},
	{"id": "a_pets100", "name": "Лучший друг крысок", "desc": "Погладь питомцев 100 раз", "counter": "pets", "need": 100, "reward": 60},
	{"id": "a_photo10", "name": "Фотограф", "desc": "Сделай 10 фотографий", "counter": "photos", "need": 10, "reward": 30},
	{"id": "a_tricks3", "name": "Терпеливый тренер", "desc": "Изучите 3 трюка", "counter": "tricks", "need": 3, "reward": 50},
	{"id": "a_clean20", "name": "Порядок без суеты", "desc": "20 спокойных уборок", "counter": "cleans", "need": 20, "reward": 40},
	{"id": "a_days7", "name": "Первая неделя вместе", "desc": "Заходи в игру 7 разных дней", "counter": "days", "need": 7, "reward": 50},
	{"id": "a_friends", "name": "Не разлей вода", "desc": "Отношения двух крысок достигли 80", "counter": "best_bond", "need": 80, "reward": 40},
	{"id": "a_trust", "name": "Полное доверие", "desc": "Доверие питомца достигло 100", "counter": "max_trust", "need": 100, "reward": 50},
	{"id": "a_games10", "name": "Весёлые занятия", "desc": "Сыграйте 10 мини-игр", "counter": "games", "need": 10, "reward": 30},
]

const MAX_PETS_BASE := 6
const MAX_PETS_XL := 8

const NAMES_F := ["Зефирка", "Дымка", "Пуговка", "Ириска", "Тучка", "Соня", "Мята", "Кнопка", "Булочка", "Фасолька", "Ромашка", "Пенка"]
const NAMES_M := ["Пломбир", "Уголёк", "Тимоша", "Сухарик", "Шнурок", "Финик", "Бублик", "Орешек", "Пиксель", "Кекс", "Изюм", "Фантик"]
