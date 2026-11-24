extends Node
## Глобальное состояние игры: питомцы, клетка, экономика, задания, сохранения, офлайн-прогресс.

signal changed
signal coins_changed(v: int)
signal toast(msg: String)
signal quest_done(id: String)
signal rats_changed
signal world_changed
signal settings_changed
signal rat_event(rat_id: int, kind: String)

const SAVE_PATH := "user://save.json"
const BACKUP_PATH := "user://save_backup.json"
const SAVE_VERSION := 1
const OFFLINE_CAP := 12.0 * 3600.0
const DAY := 86400.0

var state: Dictionary = {}
var return_summary: Array = []
var rng := RandomNumberGenerator.new()
var time_offset := 0.0 # для тестов: сдвиг «текущего» времени
var _sim_acc := 0.0
var _save_acc := 0.0
var _was_loaded_from_backup := false
var autosave_enabled := true

func _ready() -> void:
	rng.randomize()
	process_mode = Node.PROCESS_MODE_ALWAYS
	load_game()
	apply_settings()

func now() -> float:
	return Time.get_unix_time_from_system() + time_offset

# =====================================================================
#  Новое состояние
# =====================================================================
func new_state() -> Dictionary:
	var s := {
		"version": SAVE_VERSION, "created": now(), "last_time": now(), "coins": 100,
		"rats": [], "next_id": 1, "memorials": [],
		"cage": {
			"level": 1,
			"bowl": {"pellets": 0.0, "veg": 0, "fruit": 0, "veg_time": 0.0},
			"water": {"level": 60.0, "fresh": 55.0},
			"clean": {"litter": 85.0, "tray": 80.0, "bowls": 70.0, "shelves": 90.0, "hammock": 85.0, "pen": 100.0},
			"leftovers": 0,
		},
		"placed": {"f1": {"item": "wood_house", "color": 0, "rot": 0}, "h1": {"item": "hammock", "color": 0, "rot": 0},
			"sa1": {"item": "chew_sticks", "color": 0, "rot": 0}, "sb1": {"item": "nesting_paper", "color": 0, "rot": 0}},
		"inventory": {"sleeping_pouch": 1},
		"food": {"pellets": 6, "veg": 4, "fruit": 3, "treat": 8},
		"theme": "scandi", "owned_themes": ["scandi"], "playpen": false, "pen_safe": false,
		"quests": {}, "ach": {}, "flags": {},
		"counters": {"pets": 0, "photos": 0, "tricks": 0, "cleans": 0, "days": 0, "best_bond": 0, "max_trust": 0, "games": 0},
		"days_seen": [], "coin_cd": {}, "treat_log": [], "clean_log": [],
		"album": [],
		"settings": {"music": 0.6, "sfx": 0.8, "vibration": true, "reduced_motion": false, "quality": 1, "fps60": true,
			"comfort": true, "breeding": false, "aging": true, "death": false, "lifespan_hours": 720.0, "creative": false, "hints": true, "photo_ui": false},
		"intro_done": false,
	}
	state = s
	add_rat(make_rat("white_stripe", "m", "Тимма", "curious", 6.0))
	return s

func make_rat(coat_id: String, sex: String, rname: String, personality := "", age_weeks := 6.0, eye := "", ears := "normal", rex := false) -> Dictionary:
	if personality == "":
		personality = Data.PERSONALITIES.keys()[rng.randi() % Data.PERSONALITIES.size()]
	var app := Data.appearance_from_coat(coat_id, eye, ears, rex)
	return {
		"id": 0, "name": rname, "sex": sex, "app": app, "personality": personality,
		"age": age_weeks, "satiety": 75.0, "hydration": 80.0, "health": 95.0, "comfort": 70.0, "trust": 8.0 if personality != "social" else 15.0,
		"energy": 70.0 + rng.randf() * 25.0, "stress": 5.0, "variety": 40.0, "relations": {}, "fav_toy": "", "toy_counts": {},
		"tricks": {}, "parents": [], "alive": true, "loc": "cage", "pregnant_at": 0.0, "litter_cd": 0.0, "pets_count": 0,
		"sick": false, "born_note": "", "fav_spot": "", "adopted_at": now(),
	}

func add_rat(r: Dictionary) -> Dictionary:
	r.id = int(state.next_id)
	state.next_id = int(state.next_id) + 1
	for o in state.rats:
		r.relations[str(o.id)] = 10.0 if r.parents.is_empty() else 40.0
		o.relations[str(r.id)] = r.relations[str(o.id)]
	state.rats.append(r)
	rats_changed.emit()
	return r

func live_rats() -> Array:
	return state.rats.filter(func(r): return r.alive)

func rat_by_id(id: int) -> Dictionary:
	for r in state.rats:
		if int(r.id) == id:
			return r
	return {}

func max_pets() -> int:
	return Data.MAX_PETS_XL if int(state.cage.level) >= 2 else Data.MAX_PETS_BASE

func setting(key: String):
	return state.settings.get(key)

func set_setting(key: String, v) -> void:
	state.settings[key] = v
	if key == "comfort" and bool(v):
		state.settings["death"] = false
	elif key == "death" and bool(v):
		state.settings["comfort"] = false
	apply_settings()
	settings_changed.emit()
	save_game()

func apply_settings() -> void:
	if state.is_empty():
		return
	Engine.max_fps = 60 if state.settings.fps60 else 30
	var mb := AudioServer.get_bus_index("Music")
	var sb := AudioServer.get_bus_index("SFX")
	if mb >= 0:
		AudioServer.set_bus_volume_db(mb, linear_to_db(maxf(0.0001, float(state.settings.music))))
	if sb >= 0:
		AudioServer.set_bus_volume_db(sb, linear_to_db(maxf(0.0001, float(state.settings.sfx))))

func comfort_mode() -> bool:
	return bool(state.settings.comfort)

func vibrate(ms := 30) -> void:
	if bool(state.settings.vibration) and OS.has_feature("mobile"):
		Input.vibrate_handheld(ms)

# =====================================================================
#  Экономика
# =====================================================================
func add_coins(n: int, silent := false) -> void:
	state.coins = int(state.coins) + n
	coins_changed.emit(int(state.coins))
	if not silent and n > 0:
		Sfx.play("coin")

## Монеты за осмысленное действие с перезарядкой по ключу — нельзя «фармить» одно и то же.
func earn(n: int, key: String, cooldown_s: float) -> bool:
	var last: float = float(state.coin_cd.get(key, 0.0))
	if now() - last < cooldown_s:
		return false
	state.coin_cd[key] = now()
	add_coins(n)
	return true

func spend(n: int) -> bool:
	if int(state.coins) < n:
		toast.emit("Не хватает монет: нужно %d" % n)
		return false
	add_coins(-n, true)
	Sfx.play("pop")
	return true

func flag(k: String) -> bool:
	return bool(state.flags.get(k, false))

func set_flag(k: String, v := true) -> void:
	state.flags[k] = v
	check_quests()

func count(k: String, n := 1) -> void:
	state.counters[k] = int(state.counters.get(k, 0)) + n
	check_quests()

func counter_max(k: String, v: int) -> void:
	if v > int(state.counters.get(k, 0)):
		state.counters[k] = v
		check_quests()

# =====================================================================
#  Кормление и вода
# =====================================================================
func fill_bowl() -> String:
	var b: Dictionary = state.cage.bowl
	if int(state.food.pellets) <= 0:
		return "Корм закончился — загляни в магазин."
	if b.pellets >= 85.0:
		Sfx.play("click")
		return "Миска уже полная. Перекладывать не нужно."
	var was: float = b.pellets
	state.food.pellets = int(state.food.pellets) - 1
	b.pellets = 100.0
	Sfx.play("crunch")
	set_flag("bowl_filled")
	if was < 40.0:
		earn(3, "bowl", 1800)
	changed.emit()
	return "Миска наполнена полнорационным кормом."

func refresh_water() -> String:
	var w: Dictionary = state.cage.water
	set_flag("water_checked")
	Sfx.play("water")
	if w.level >= 95.0 and w.fresh >= 90.0:
		return "Вода свежая, поилка полная."
	var was: float = minf(w.level, w.fresh)
	w.level = 100.0
	w.fresh = 100.0
	if was < 60.0:
		earn(3, "water", 1800)
	changed.emit()
	return "Свежая вода налита."

func give_bowl_extra(kind: String) -> String:
	var b: Dictionary = state.cage.bowl
	if int(state.food.get(kind, 0)) <= 0:
		return "Закончилось. Можно купить в магазине."
	if kind == "veg":
		if int(b.veg) >= 2:
			return "Овощей в миске достаточно — небольшие порции лучше."
		b.veg = int(b.veg) + 1
		b.veg_time = now()
	elif kind == "fruit":
		if _treats_recent() >= 4:
			return "На сегодня лакомств хватит: основа рациона — полнорационный корм."
		if int(b.fruit) >= 1:
			return "Фрукты уже лежат в миске."
		b.fruit = 1
		b.veg_time = now()
		state.treat_log.append(now())
	state.food[kind] = int(state.food[kind]) - 1
	Sfx.play("pop")
	earn(2, "extra_" + kind, 3600)
	changed.emit()
	return "Положили маленькую порцию."

func _treats_recent() -> int:
	var t := now()
	state.treat_log = state.treat_log.filter(func(x): return t - float(x) < 7200.0)
	return state.treat_log.size()

## Лакомство из руки. Возвращает текст-подсказку; доверие растёт при умеренности.
func hand_treat(r: Dictionary) -> String:
	if int(state.food.treat) <= 0:
		return "Угощения закончились."
	var overfed := _treats_recent() >= 5
	state.food.treat = int(state.food.treat) - 1
	state.treat_log.append(now())
	if overfed:
		r.satiety = minf(100.0, float(r.satiety) + 2.0)
		return "%s берёт угощение, но лакомств сегодня уже много. Лучше погладить или поиграть." % r.name
	r.satiety = minf(100.0, float(r.satiety) + 4.0)
	change_trust(r, 2.5)
	return "%s аккуратно берёт угощение лапками." % r.name

## Вызывается ИИ крыски, когда она поела из миски
func rat_eat(r: Dictionary) -> String:
	var b: Dictionary = state.cage.bowl
	var what := ""
	if int(b.veg) > 0 and rng.randf() < 0.6:
		b.veg = int(b.veg) - 1
		r.variety = minf(100.0, float(r.variety) + 20.0)
		r.satiety = minf(100.0, float(r.satiety) + 12.0)
		what = "veg"
	elif int(b.fruit) > 0 and rng.randf() < 0.5:
		b.fruit = 0
		r.satiety = minf(100.0, float(r.satiety) + 8.0)
		r.stress = maxf(0.0, float(r.stress) - 5.0)
		what = "fruit"
	elif float(b.pellets) > 0.0:
		b.pellets = maxf(0.0, float(b.pellets) - 7.0)
		r.satiety = minf(100.0, float(r.satiety) + 28.0)
		what = "pellets"
	return what

func rat_drink(r: Dictionary) -> void:
	var w: Dictionary = state.cage.water
	if w.level > 0.0:
		w.level = maxf(0.0, float(w.level) - 1.5)
		r.hydration = minf(100.0, float(r.hydration) + (35.0 if w.fresh > 30.0 else 15.0))

func bowl_has_food() -> bool:
	var b: Dictionary = state.cage.bowl
	return float(b.pellets) > 0.0 or int(b.veg) > 0 or int(b.fruit) > 0

# =====================================================================
#  Доверие, отношения, игрушки
# =====================================================================
func change_trust(r: Dictionary, d: float) -> void:
	var p: Dictionary = Data.PERSONALITIES.get(r.personality, {})
	var mult := 1.0 - 0.4 * float(p.get("caution", 0.5)) + 0.3 * float(p.get("social", 0.5))
	r.trust = clampf(float(r.trust) + d * mult, 0.0, 100.0)
	counter_max("max_trust", int(r.trust))

func relation(a: Dictionary, b: Dictionary) -> float:
	return float(a.relations.get(str(b.id), 10.0))

func change_relation(a: Dictionary, b: Dictionary, d: float) -> void:
	var v := clampf(relation(a, b) + d, 0.0, 100.0)
	a.relations[str(b.id)] = v
	b.relations[str(a.id)] = v
	counter_max("best_bond", int(v))

func bump_relation(a: Dictionary, b: Dictionary, d: float) -> void:
	change_relation(a, b, d)

func record_toy(r: Dictionary, item_id: String) -> void:
	rat_used_toy(r, item_id)

func train_trick(r: Dictionary, trick_id: String, use_treat := true) -> Dictionary:
	var used := false
	if use_treat and int(state.food.get("treat", 0)) > 0:
		state.food.treat = int(state.food.treat) - 1
		used = true
	var cur := float(r.tricks.get(trick_id, 0.0))
	var boost := 1.45 if used else 1.0
	var gain := (22.0 + float(r.trust) * 0.15) * boost
	var nxt := minf(100.0, cur + gain)
	var learned_now := cur < 100.0 and nxt >= 100.0
	r.tricks[trick_id] = nxt
	change_trust(r, 3.0 if learned_now else 1.5)
	if learned_now:
		count("tricks")
		add_coins(20)
		Sfx.play("chime")
		toast.emit("%s выучил(а) трюк «%s»! +20 монет" % [r.name, Data.TRICKS[trick_id].name])
	else:
		earn(3, "train_" + str(r.id) + "_" + trick_id, 30.0)
	check_quests()
	changed.emit()
	return {"progress": nxt, "learned_now": learned_now, "used_treat": used}

func rat_used_toy(r: Dictionary, item_id: String) -> void:
	r.toy_counts[item_id] = int(r.toy_counts.get(item_id, 0)) + 1
	r.stress = maxf(0.0, float(r.stress) - 2.0)
	if r.fav_toy == "":
		var best := ""
		var bv := 0
		for k in r.toy_counts:
			if int(r.toy_counts[k]) > bv:
				bv = int(r.toy_counts[k])
				best = k
		if bv >= 4:
			r.fav_toy = best
			toast.emit("Похоже, любимая игрушка %s — %s!" % [r.name, Data.ITEMS[best].name.to_lower()])
			Sfx.play("sparkle")
			check_quests()

# =====================================================================
#  Чистота
# =====================================================================
const CLEAN_AREAS := {
	"litter": "Наполнитель", "tray": "Лоток", "bowls": "Миски и поилка", "shelves": "Полки",
	"hammock": "Гамаки и текстиль", "leftovers": "Остатки еды", "pen": "Игровой манеж",
}

func clean_value(area: String) -> float:
	if area == "leftovers":
		return 100.0 - 30.0 * float(state.cage.leftovers)
	return float(state.cage.clean.get(area, 100.0))

func clean_avg() -> float:
	var s := 0.0
	var n := 0
	for k in ["litter", "tray", "bowls", "shelves", "hammock"]:
		s += float(state.cage.clean[k])
		n += 1
	return s / n - 8.0 * float(state.cage.leftovers)

## Завершение мини-игры уборки
func cleaned(area: String) -> String:
	var was := clean_value(area)
	if area == "leftovers":
		state.cage.leftovers = 0
	else:
		state.cage.clean[area] = 100.0
	if area == "bowls":
		state.cage.water.fresh = maxf(float(state.cage.water.fresh), 90.0)
	var t := now()
	state.clean_log = state.clean_log.filter(func(x): return t - float(x) < 1800.0)
	state.clean_log.append(t)
	var msg := "Чисто! Часть знакомых запахов сохранилась — крыскам спокойно."
	if state.clean_log.size() > 3:
		for r in live_rats():
			r.stress = minf(100.0, float(r.stress) + 6.0)
		msg = "Чисто. Но много уборки подряд немного волнует крысок — генеральная уборка каждый день не нужна."
	if was < 70.0:
		count("cleans")
		earn(4, "clean_" + area, 1200)
	Sfx.play("sparkle")
	changed.emit()
	return msg

# =====================================================================
#  Предметы и размещение
# =====================================================================
func placed_dict(area: String) -> Dictionary:
	if area == "pen":
		if not state.has("pen_placed"):
			state.pen_placed = {}
		return state.pen_placed
	return state.placed

func place_item(area: String, slot_id: String, item_id: String) -> void:
	var d := placed_dict(area)
	if d.has(slot_id):
		take_item(area, slot_id)
	d[slot_id] = {"item": item_id, "color": 0, "rot": 0}
	state.inventory[item_id] = int(state.inventory.get(item_id, 0)) - 1
	if int(state.inventory[item_id]) <= 0:
		state.inventory.erase(item_id)
	if Data.ITEMS[item_id].cat == "hammocks":
		set_flag("hung_hammock")
	Sfx.play("pop")
	for r in live_rats():
		r["novelty"] = slot_id
	world_changed.emit()
	check_quests()
	changed.emit()

func take_item(area: String, slot_id: String) -> void:
	var d := placed_dict(area)
	if not d.has(slot_id):
		return
	var it: String = d[slot_id].item
	d.erase(slot_id)
	state.inventory[it] = int(state.inventory.get(it, 0)) + 1
	world_changed.emit()
	changed.emit()

func count_placed(pred: Callable, include_pen := true) -> int:
	var n := 0
	for d in ([state.placed, state.get("pen_placed", {})] if include_pen else [state.placed]):
		for s in d:
			if pred.call(Data.ITEMS[d[s].item]):
				n += 1
	return n

func cozy_count() -> int:
	return count_placed(func(it): return it.cozy, false)

func hide_count() -> int:
	return count_placed(func(it): return it.kind == "hide", false)

func buy_item(id: String) -> bool:
	var it: Dictionary = Data.ITEMS[id]
	if not spend(int(it.price)):
		return false
	state.inventory[id] = int(state.inventory.get(id, 0)) + 1
	changed.emit()
	return true

func buy_food(id: String) -> bool:
	var f: Dictionary = Data.FOODS[id]
	if not spend(int(f.price)):
		return false
	state.food[id] = int(state.food.get(id, 0)) + int(f.pack)
	changed.emit()
	return true

func buy_theme(id: String) -> bool:
	if id in state.owned_themes:
		state.theme = id
		world_changed.emit()
		return true
	if not spend(int(Data.THEMES[id].price)):
		return false
	state.owned_themes.append(id)
	state.theme = id
	world_changed.emit()
	changed.emit()
	return true

func buy_upgrade(id: String) -> bool:
	if id == "cage_xl" and int(state.cage.level) >= 2:
		return false
	if id == "playpen" and bool(state.playpen):
		return false
	if not spend(int(Data.UPGRADES[id].price)):
		return false
	if id == "cage_xl":
		state.cage.level = 2
	else:
		state.playpen = true
		state.pen_placed = {}
	world_changed.emit()
	changed.emit()
	check_quests()
	return true

# =====================================================================
#  Здоровье, ветеринар
# =====================================================================
func health_target(r: Dictionary) -> float:
	var t := 100.0
	t -= maxf(0.0, 30.0 - float(r.satiety)) * 0.8
	t -= maxf(0.0, 40.0 - float(r.hydration)) * 0.8
	t -= maxf(0.0, 50.0 - clean_avg()) * 0.5
	t -= maxf(0.0, float(r.stress) - 50.0) * 0.5
	t -= maxf(0.0, 30.0 - float(r.variety)) * 0.2
	if live_rats().size() == 1:
		t -= 10.0
	return clampf(t, 20.0, 100.0)

func health_advice(r: Dictionary) -> Array:
	var a := []
	if float(r.satiety) < 40: a.append("Следите, чтобы в миске был полнорационный корм.")
	if float(r.hydration) < 50: a.append("Нужна свежая вода в поилке.")
	if clean_avg() < 55: a.append("Немного уборки сделает клетку уютнее.")
	if float(r.stress) > 50: a.append("Дайте больше укрытий и спокойного времени.")
	if float(r.variety) < 30: a.append("Небольшие порции овощей разнообразят рацион.")
	if live_rats().size() == 1: a.append("Крысам нужна компания сородичей.")
	if a.is_empty(): a.append("Хорошее питание, отдых и общение — лучшая профилактика.")
	return a

func vet_visit(r: Dictionary) -> String:
	var price := 15 if float(r.health) < 60 else 0
	if price > 0 and int(state.coins) < price:
		price = 0 # ветеринар не откажет: питомцу важнее
	if price > 0:
		add_coins(-price, true)
	r.health = maxf(float(r.health), 88.0)
	r.sick = false
	r.stress = maxf(0.0, float(r.stress) - 15.0)
	changed.emit()
	return "Ветеринар осмотрел %s. %s\nЭто игровой ветеринар: в реальной жизни лечение подбирает только специалист." % [r.name, " ".join(health_advice(r))]

# =====================================================================
#  Симуляция
# =====================================================================
func _process(delta: float) -> void:
	if state.is_empty():
		return
	_sim_acc += delta
	_save_acc += delta
	if _sim_acc >= 1.0:
		sim(_sim_acc, false)
		_sim_acc = 0.0
		state.last_time = now()
	if _save_acc >= 20.0 and autosave_enabled:
		_save_acc = 0.0
		save_game()

func sim(dt: float, offline: bool) -> void:
	var h := dt / 3600.0
	var c: Dictionary = state.cage
	var comfort := comfort_mode()
	var rats := live_rats()
	var cage_rats := rats.filter(func(r): return r.loc == "cage")
	# --- среда
	var dec := {"litter": 2.4, "tray": 3.6, "bowls": 3.0, "shelves": 1.1, "hammock": 1.4, "pen": 0.8}
	var floor_v := 45.0 if comfort else 8.0
	for k in dec:
		if k == "pen" and not bool(state.playpen):
			continue
		c.clean[k] = maxf(floor_v, float(c.clean[k]) - dec[k] * h * maxf(0.5, cage_rats.size() / 2.0))
	c.water.fresh = maxf(floor_v if comfort else 0.0, float(c.water.fresh) - 4.0 * h)
	# неубранные овощи/фрукты портятся через 2 часа
	if (int(c.bowl.veg) > 0 or int(c.bowl.fruit) > 0) and now() - float(c.bowl.veg_time) > 7200.0:
		c.leftovers = mini(3, int(c.leftovers) + int(c.bowl.veg) + int(c.bowl.fruit))
		c.bowl.veg = 0
		c.bowl.fruit = 0
	var cozy := cozy_count()
	var toys := count_placed(func(it): return it.kind in ["toy", "tunnel", "forage", "puzzle", "chew", "ball", "bridge", "wheel"], false)
	for r in rats:
		r.satiety = maxf(0.0, float(r.satiety) - 12.0 * h)
		var w: Dictionary = c.water
		if float(w.level) > 0.0 and float(w.fresh) > 15.0 and (offline or float(r.hydration) < 30.0):
			# крыски пьют сами
			if float(r.hydration) < 80.0:
				rat_drink(r)
		else:
			r.hydration = maxf(0.0, float(r.hydration) - 14.0 * h)
		if float(r.hydration) > 0 and float(w.level) > 0.0:
			r.hydration = maxf(0.0, float(r.hydration) - 6.0 * h)
		if (offline or float(r.satiety) < 30.0) and float(r.satiety) < 65.0 and bowl_has_food():
			rat_eat(r)
		r.variety = maxf(0.0, float(r.variety) - 3.0 * h)
		r.stress = maxf(0.0, float(r.stress) - 8.0 * h + (6.0 * h if rats.size() == 1 else 0.0))
		# комфорт
		var cm := 30.0 + minf(cozy, 4) * 9.0 + minf(toys, 4) * 5.0 + (clean_avg() - 50.0) * 0.3 - float(r.stress) * 0.2
		if rats.size() >= 2:
			cm += 10.0
		r.comfort = clampf(lerpf(float(r.comfort), cm, minf(1.0, h * 2.0)), 0.0, 100.0)
		# здоровье
		var ht := health_target(r)
		var rate := 8.0 if ht > float(r.health) else 4.0
		r.health = clampf(move_toward(float(r.health), ht, rate * h), 0.0, 100.0)
		if comfort:
			r.health = maxf(float(r.health), 70.0)
			r.satiety = maxf(float(r.satiety), 40.0)
			r.hydration = maxf(float(r.hydration), 40.0)
			r.sick = false
		elif float(r.health) < 45.0 and not r.sick:
			r.sick = true
			toast.emit("%s выглядит неважно. Загляните к игровому ветеринару в карточке питомца." % r.name)
		# отношения
		for o in rats:
			if int(o.id) > int(r.id) and o.loc == r.loc:
				var ps: float = Data.PERSONALITIES[r.personality].social + Data.PERSONALITIES[o.personality].social
				change_relation(r, o, 0.6 * ps * h)
		# возраст
		if bool(state.settings.aging):
			r.age = float(r.age) + dt / DAY
		if offline:
			r.energy = clampf(float(r.energy) + 20.0 * h, 0.0, 100.0)
	_breeding(dt)
	_aging_death(dt, offline)

func _breeding(dt: float) -> void:
	if not bool(state.settings.breeding):
		return
	var rats := live_rats()
	for f in rats:
		if f.sex != "f":
			continue
		if float(f.pregnant_at) > 0.0:
			if now() - float(f.pregnant_at) >= 3.0 * DAY:
				_give_birth(f)
			continue
		if float(f.age) < 10.0 or float(f.age) > 60.0 or now() < float(f.litter_cd) or rats.size() >= max_pets():
			continue
		for m in rats:
			if m.sex == "m" and m.loc == f.loc and float(m.age) >= 10.0 and relation(f, m) >= 30.0:
				if rng.randf() < 0.25 * dt / DAY:
					f.pregnant_at = now()
					f["father"] = int(m.id)
					toast.emit("%s ждёт малышей. Обеспечьте ей покой и мягкое гнездо." % f.name)
				break

func _give_birth(f: Dictionary) -> void:
	f.pregnant_at = 0.0
	f.litter_cd = now() + 7.0 * DAY
	var father := rat_by_id(int(f.get("father", -1)))
	var room := max_pets() - live_rats().size()
	var n := mini(rng.randi_range(2, 4), room)
	if n <= 0:
		return
	var names := []
	for i in n:
		var sex := "f" if rng.randf() < 0.5 else "m"
		var pool: Array = Data.NAMES_F if sex == "f" else Data.NAMES_M
		var baby := make_rat(f.app.coat, sex, pool[rng.randi() % pool.size()], "", 0.0)
		baby.app = inherit(f.app, father.get("app", f.app))
		baby.parents = [int(f.id), int(father.get("id", -1))]
		baby.trust = 20.0
		baby.born_note = "Мама: %s, папа: %s" % [f.name, father.get("name", "—")]
		add_rat(baby)
		names.append(baby.name)
	toast.emit("У %s появились малыши: %s! Им нужны покой и тепло." % [f.name, ", ".join(names)])
	state.album.append({"type": "memory", "time": now(), "text": "Родились малыши: " + ", ".join(names)})

## Упрощённая игровая модель наследования (не точная генетика).
func inherit(a: Dictionary, b: Dictionary) -> Dictionary:
	var src := a if rng.randf() < 0.5 else b
	var other := b if src == a else a
	var app := src.duplicate()
	if rng.randf() < 0.3:
		app.base = other.base
	if rng.randf() < 0.3:
		app.mark = other.mark
	if a.ears == "dumbo" and b.ears == "dumbo":
		app.ears = "dumbo"
	elif a.ears == "dumbo" or b.ears == "dumbo":
		app.ears = "dumbo" if rng.randf() < 0.25 else "normal"
	else:
		app.ears = "normal"
	app.rex = (a.rex or b.rex) and rng.randf() < 0.5
	app.coat = "custom" if (app.base != src.base or app.mark != src.mark) else src.coat
	return app

func _aging_death(dt: float, _offline: bool) -> void:
	if not bool(state.settings.death) or comfort_mode():
		return
	var max_life_s := maxf(3600.0, float(state.settings.get("lifespan_hours", 720.0)) * 3600.0)
	for r in live_rats():
		var lived := now() - float(r.get("adopted_at", now()))
		if lived >= max_life_s or (bool(state.settings.aging) and float(r.age) >= 100.0 and rng.randf() < 0.12 * dt / DAY):
			pass_away(r)
			return # не больше одной утраты за раз

func pass_away(r: Dictionary) -> void:
	r.alive = false
	state.memorials.append({"id": r.id, "name": r.name, "app": r.app, "age": r.age, "personality": r.personality, "time": now(),
		"tricks": r.tricks.keys(), "fav": r.fav_toy})
	state.album.append({"type": "memory", "time": now(), "text": "%s прожила долгую счастливую жизнь. Мы будем помнить её любопытный нос и тёплые лапки." % r.name})
	toast.emit("%s мирно уснула навсегда. Её фотография и воспоминания сохранены в альбоме." % r.name)
	rats_changed.emit()

func rehome(r: Dictionary) -> void:
	r.alive = false
	r["rehomed"] = true
	state.album.append({"type": "memory", "time": now(), "text": "%s переехал(а) в заботливую семью. Новые хозяева обещали присылать фото!" % r.name})
	rats_changed.emit()
	changed.emit()

static func stage_name(age: float) -> String:
	if age < 4.0: return "Крысёныш"
	if age < 10.0: return "Подросток"
	if age < 70.0: return "Взрослая крыска"
	return "Пожилая крыска"

# =====================================================================
#  Офлайн-прогресс
# =====================================================================
func apply_offline() -> void:
	var elapsed := now() - float(state.get("last_time", now()))
	return_summary.clear()
	if elapsed < 120.0:
		return
	var sim_t := minf(elapsed, OFFLINE_CAP)
	var t := 0.0
	var aging: bool = state.settings.aging
	while t < sim_t:
		var d := minf(900.0, sim_t - t)
		sim(d, true)
		t += d
	if aging and elapsed > sim_t:
		for r in live_rats():
			r.age = float(r.age) + minf(elapsed - sim_t, 14.0 * DAY) / DAY
	# автоматическая помощь: долгое отсутствие не приводит к беде
	var floor_need := 45.0 if comfort_mode() else 25.0
	for r in live_rats():
		r.satiety = maxf(float(r.satiety), floor_need)
		r.hydration = maxf(float(r.hydration), floor_need)
		r.health = maxf(float(r.health), 70.0 if comfort_mode() else 50.0)
	if elapsed > 3600.0:
		_make_return_summary(elapsed)
	state.last_time = now()
	changed.emit()

func _make_return_summary(elapsed: float) -> void:
	var rats := live_rats()
	if rats.is_empty():
		return
	var hours := int(elapsed / 3600.0)
	return_summary.append("Тебя не было %s. Вот что происходило:" % (("%d ч" % hours) if hours < 48 else ("%d дн" % (hours / 24))))
	var pool := [
		"{a} перетаскала бумагу в домик и устроила гнездо.", "{a} и {b} спали в обнимку в гамаке.",
		"{a} обследовала каждую полку и проверила все туннели.", "{a} спрятала кусочек корма в тайник.",
		"{a} долго умывала мордочку и вычёсывала шерсть.", "{a} и {b} устроили дружескую возню.",
		"{a} ждала тебя у дверцы клетки, принюхиваясь.", "{b} вылизала ушки {a} — настоящая дружба!",
	]
	pool.shuffle()
	for i in mini(3, pool.size()):
		var a: Dictionary = rats[rng.randi() % rats.size()]
		var b: Dictionary = rats[(rats.find(a) + 1) % rats.size()]
		if rats.size() == 1 and "{b}" in pool[i]:
			continue
		return_summary.append("• " + pool[i].format({"a": a.name, "b": b.name}))
	if float(state.cage.bowl.pellets) < 30:
		return_summary.append("• Миска почти пуста — крыски будут рады ужину.")
	if float(state.cage.water.fresh) < 50:
		return_summary.append("• Воду стоит освежить.")
	if clean_avg() < 55:
		return_summary.append("• Немного уборки сделает клетку уютнее.")

# =====================================================================
#  Задания и достижения
# =====================================================================
func quest_check(id: String) -> bool:
	var rats := live_rats()
	match id:
		"t_names": return flag("named")
		"t_water": return flag("water_checked")
		"t_bowl": return flag("bowl_filled")
		"t_hide": return hide_count() >= 2
		"t_hand": return flag("hand_approach")
		"q_meet": return not rats.is_empty() and rats.all(func(r): return int(r.pets_count) > 0)
		"q_hammock": return flag("hung_hammock")
		"q_cozy3": return cozy_count() >= 3
		"q_come": return rats.any(func(r): return float(r.tricks.get("come", 0)) >= 100.0)
		"q_forage": return flag("forage_done")
		"q_photo_sleep": return flag("photo_sleep")
		"q_tunnels": return count_placed(func(it): return it.kind == "tunnel") >= 2
		"q_pen": return bool(state.playpen) and state.get("pen_placed", {}).size() >= 2
		"q_favs": return not rats.is_empty() and rats.all(func(r): return r.fav_toy != "")
		"q_clean": return int(state.counters.cleans) >= 5
		"q_maze": return flag("maze_done")
	return false

func check_quests() -> void:
	if state.is_empty():
		return
	for q in Data.QUESTS:
		if state.quests.get(q.id, false):
			continue
		if quest_check(q.id):
			state.quests[q.id] = true
			add_coins(int(q.reward), true)
			Sfx.play("chime")
			toast.emit("Задание выполнено: «%s» +%d" % [q.name, q.reward])
			quest_done.emit(q.id)
	for a in Data.ACHIEVEMENTS:
		if state.ach.get(a.id, false):
			continue
		if int(state.counters.get(a.counter, 0)) >= int(a.need):
			state.ach[a.id] = true
			add_coins(int(a.reward), true)
			Sfx.play("chime")
			toast.emit("Достижение: «%s» +%d" % [a.name, a.reward])

func mark_day() -> void:
	var d := Time.get_date_string_from_unix_time(int(now()))
	if not d in state.days_seen:
		state.days_seen.append(d)
		if state.days_seen.size() > 60:
			state.days_seen.pop_front()
		state.counters.days = int(state.counters.days) + 1
		check_quests()

# =====================================================================
#  Сохранение
# =====================================================================
func save_game() -> bool:
	if state.is_empty():
		return false
	state.last_time = now()
	var txt := JSON.stringify(state)
	# резервная копия: предыдущий удачный файл
	if FileAccess.file_exists(SAVE_PATH):
		var old := FileAccess.get_file_as_string(SAVE_PATH)
		if _parse(old).size() > 0:
			var fb := FileAccess.open(BACKUP_PATH, FileAccess.WRITE)
			if fb:
				fb.store_string(old)
				fb.close()
	var tmp := SAVE_PATH + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(txt)
	f.close()
	DirAccess.rename_absolute(ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(SAVE_PATH))
	return true

func _parse(txt: String) -> Dictionary:
	if txt.strip_edges() == "":
		return {}
	var j = JSON.parse_string(txt)
	if typeof(j) != TYPE_DICTIONARY or not j.has("rats") or not j.has("cage"):
		return {}
	return j

func load_game() -> void:
	var s := {}
	_was_loaded_from_backup = false
	if FileAccess.file_exists(SAVE_PATH):
		s = _parse(FileAccess.get_file_as_string(SAVE_PATH))
	if s.is_empty() and FileAccess.file_exists(BACKUP_PATH):
		s = _parse(FileAccess.get_file_as_string(BACKUP_PATH))
		_was_loaded_from_backup = not s.is_empty()
	if s.is_empty():
		new_state()
	else:
		state = _migrate(s)
		apply_offline()
	mark_day()

func _migrate(s: Dictionary) -> Dictionary:
	var base := new_state_template()
	for k in base:
		if not s.has(k):
			s[k] = base[k]
	for k in base.settings:
		if not s.settings.has(k):
			s.settings[k] = base.settings[k]
	for k in base.counters:
		if not s.counters.has(k):
			s.counters[k] = base.counters[k]
	# JSON превращает int в float: приводим ключевые числа
	s.coins = int(s.coins)
	s.next_id = int(s.next_id)
	for r in s.rats:
		r.id = int(r.id)
	return s

func new_state_template() -> Dictionary:
	var keep := state
	var t := new_state()
	state = keep
	return t

func restore_backup() -> bool:
	if not FileAccess.file_exists(BACKUP_PATH):
		return false
	var s := _parse(FileAccess.get_file_as_string(BACKUP_PATH))
	if s.is_empty():
		return false
	state = _migrate(s)
	rats_changed.emit()
	world_changed.emit()
	changed.emit()
	return true

func reset_game() -> void:
	new_state()
	save_game()
	rats_changed.emit()
	world_changed.emit()
	changed.emit()

func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_WM_CLOSE_REQUEST:
			if autosave_enabled:
				save_game()
		NOTIFICATION_APPLICATION_RESUMED:
			if not state.is_empty():
				apply_offline()
				mark_day()
