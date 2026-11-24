class_name Rat
extends Node3D
## Новая логика ИИ крыски: Utility-AI с естественными циклами бодрствования и сна,
## плавной инерцией поворотов, 15+ живыми действиями, социальными связями и тёплым откликом на игрока.

signal said(rat: Rat, text: String)

const CAPACITY := {"hide": 3, "cozy": 3, "platform": 2, "tunnel": 2}

var data: Dictionary
var world: World
var model: RatModel
var label: Label3D
var zzz: Label3D
var pers: Dictionary

# Навигация и плавное движение
var path: Array = []
var cur_node := ""
var seg_from := Vector3.ZERO
var seg_to := Vector3.ZERO
var seg_t := 0.0
var seg_len := 1.0
var seg_type := "walk"
var moving := false
var goal: Dictionary = {}
var cur_speed := 0.0

# Состояние Utility AI
var activity := "idle"
var act_t := 0.0
var act_dur := 2.4
var act_data: Dictionary = {}
var spot := ""
var offset := Vector3.ZERO
var yaw := 0.0
var _prev_yaw := 0.0
var pitch := 0.0
var controlled := ""      # "", hand, training, held, show, play
var selected := false
var think_cd := 0.0
var _name_t := 0.0
var _partner: Rat = null
var _sleep_wave := 0.0
var _said_recent := {}
var _play_target := Vector3.ZERO
var _has_play_target := false

func setup(d: Dictionary, w: World) -> void:
	data = d
	world = w
	pers = Data.PERSONALITIES.get(d.personality, Data.PERSONALITIES.curious)
	add_to_group("rats")

	model = RatModel.new()
	add_child(model)
	rebuild_model()

	label = Label3D.new()
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 58
	label.outline_size = 13
	label.outline_modulate = Color(0.24, 0.17, 0.12, 0.92)
	label.modulate = Color(1.0, 0.97, 0.91)
	label.position = Vector3(0, 1.8, 0)
	label.no_depth_test = true
	label.visible = false
	label.font = load("res://assets/fonts/Montserrat.ttf")
	add_child(label)

	zzz = Label3D.new()
	zzz.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	zzz.font_size = 46
	zzz.text = "z z"
	zzz.modulate = Color(0.58, 0.66, 0.88, 0.85)
	zzz.position = Vector3(0.32, 1.32, 0)
	zzz.visible = false
	zzz.font = label.font
	add_child(zzz)

	offset = Vector3(Game.rng.randf_range(-0.32, 0.32), 0.0, Game.rng.randf_range(-0.28, 0.28))
	var ar: String = d.get("loc", "cage")
	if ar == "pen" and not bool(Game.state.playpen):
		d.loc = "cage"
		ar = "cage"
	cur_node = world.random_node(ar)
	if cur_node != "" and world.nodes.has(cur_node):
		position = world.nodes[cur_node] + offset
	yaw = Game.rng.randf() * TAU
	_prev_yaw = yaw
	_sleep_wave = Game.rng.randf() * TAU
	think_cd = Game.rng.randf_range(0.4, 1.8)

func rebuild_model() -> void:
	var app: Dictionary = data.app.duplicate()
	app["seed"] = float(int(data.id) % 7) * 0.37
	model.reduced_motion = bool(Game.setting("reduced_motion"))
	model.shells_on = int(Game.setting("quality")) >= 1
	model.build(app)
	var a := float(data.age)
	var s := clampf(0.48 + a / 12.0 * 0.52, 0.48, 1.02) * (1.06 if data.sex == "m" else 1.0)
	model.scale = Vector3.ONE * s
	if label:
		label.position = Vector3(0, 1.65 * s + 0.35, 0)

func display_name() -> String:
	return str(data.get("name", "Крыска"))

func area() -> String:
	return str(data.get("loc", "cage"))

func energy() -> float:
	return float(data.get("energy", 75.0))

func is_sleeping() -> bool:
	return activity in ["sleep", "sleep_hammock"]

func is_busy_social() -> bool:
	return activity in ["groom_other", "groomed", "wrestle", "nose", "sleep", "sleep_hammock"] or controlled != ""

# =====================================================================
#  Главный цикл обновления ИИ
# =====================================================================
func _process(delta: float) -> void:
	if data.is_empty() or not bool(data.get("alive", true)):
		return
	var dt := minf(delta, 0.05)
	_sleep_wave += dt * 0.025

	# Всплывающее имя над питомцем
	if _name_t > 0.0:
		_name_t -= dt
		label.visible = true
		label.text = display_name()
		label.modulate.a = clampf(_name_t * 1.2, 0.0, 1.0)
	else:
		label.visible = selected
		label.text = display_name()
		label.modulate.a = 1.0

	zzz.visible = is_sleeping()
	if zzz.visible:
		zzz.position.y = 1.32 + sin(Time.get_ticks_msec() / 550.0) * 0.12

	# Естественный цикл энергии (бодрствование ↔ спокойный сон)
	var e := energy()
	if is_sleeping():
		e += dt * 2.1
	elif activity in ["rest", "lounge", "groom_face", "groom_body", "groomed", "relax"]:
		e += dt * 0.45
	else:
		var act_drain := 0.24 + 0.22 * float(pers.activity)
		if Game.stage_name(float(data.age)) == "Пожилая крыска":
			act_drain *= 1.35
		e -= dt * act_drain
	data.energy = clampf(e, 0.0, 100.0)

	# Интерактивная игра с пёрышком / пальцем
	if controlled == "play" and _has_play_target:
		_process_play_chase(dt)
	elif moving:
		_move(dt)
	else:
		act_t += dt
		_act_process(dt)
		if act_t >= act_dur and controlled == "":
			_finish_activity()
			think_cd -= dt
			if think_cd <= 0.0:
				_choose_utility_action()

	_orient(dt)

func _orient(dt: float) -> void:
	var dyaw := wrapf(yaw - _prev_yaw, -PI, PI)
	_prev_yaw = yaw
	model.set_turn_rate(dyaw / maxf(dt, 0.005))
	var target_b := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, pitch)
	basis = basis.slerp(target_b.orthonormalized(), 1.0 - exp(-7.5 * dt)).orthonormalized()

func face_point(p: Vector3) -> void:
	var d := p - global_position
	d.y = 0.0
	if d.length() > 0.01:
		yaw = atan2(-d.x, -d.z)

# =====================================================================
#  Плавное перемещение по графу клетки
# =====================================================================
func go_to(node_id: String, g: Dictionary = {}) -> bool:
	if node_id == "" or not world.nodes.has(node_id):
		return false
	var start := cur_node if world.nodes.has(cur_node) else world.nearest_node(global_position, area())
	var p := world.find_path(start, node_id)
	if p.is_empty():
		return false
	goal = g
	path = p
	if path.size() > 0 and path[0] == start:
		path.remove_at(0)
	if global_position.distance_to(world.nodes[start]) > 0.55:
		path.push_front(start)
		cur_node = start
	_set_activity("walk", 999.0)
	spot = ""
	model.set_blob(true)
	if path.is_empty():
		_arrive()
		return true
	_next_segment()
	return true

func _node_pos(id: String) -> Vector3:
	var p: Vector3 = world.nodes[id]
	if id.begins_with("s_") or id in ["bowl", "drink", "door", "litter"] or id.ends_with("e"):
		return p
	return p + offset

func _next_segment() -> void:
	var nxt: String = path.pop_front()
	seg_type = world.edge_type(cur_node, nxt) if world.nodes.has(cur_node) else "walk"
	seg_from = global_position
	seg_to = _node_pos(nxt)
	seg_len = maxf(0.06, seg_from.distance_to(seg_to))
	seg_t = 0.0
	cur_node = nxt
	moving = true

func _target_speed() -> float:
	var base := 2.1 + 1.15 * float(pers.activity)
	if Game.stage_name(float(data.age)) == "Пожилая крыска":
		base *= 0.72
	match seg_type:
		"ramp": base *= 0.75
		"climb": base *= 0.48
		"hop": base *= 0.95
	if goal.get("cautious", false):
		base *= 0.55
	if goal.get("run", false):
		base *= 1.55
	return base

func _move(dt: float) -> void:
	cur_speed = lerpf(cur_speed, _target_speed(), 1.0 - exp(-7.0 * dt))
	seg_t += cur_speed * dt / seg_len
	var t := clampf(seg_t, 0.0, 1.0)
	# Мягкое сглаживание на последнем сегменте
	var smooth_t := t if not path.is_empty() else (t * t * (3.0 - 2.0 * t) * 0.45 + t * 0.55)
	var p := seg_from.lerp(seg_to, smooth_t)
	if seg_type == "hop":
		p.y += sin(t * PI) * 0.72
	global_position = p

	var d := seg_to - seg_from
	var flat := Vector2(d.x, d.z)
	if seg_type == "climb":
		yaw = PI / 2.0 if seg_to.x < 0.0 else -PI / 2.0
		pitch = 1.25 if d.y > 0.0 else -1.15
	else:
		if flat.length() > 0.02:
			var desired_yaw := atan2(-d.x, -d.z)
			yaw = lerp_angle(yaw, desired_yaw, 1.0 - exp(-10.0 * dt))
		pitch = atan2(d.y, flat.length()) if seg_type == "ramp" else 0.0

	model.walk_rate = cur_speed * 4.4
	var tg := {"walk": clampf(cur_speed / 2.2, 0.4, 1.1), "sniff": 0.55}
	if goal.get("cautious", false):
		tg = {"walk": 0.55, "crouch": 0.65, "reach": 0.65, "sniff": 0.95}
	if goal.has("carry"):
		tg["head_pitch"] = 0.08
	model.set_anim_targets(tg)

	if seg_t >= 1.0:
		if path.is_empty():
			moving = false
			cur_speed = 0.0
			pitch = 0.0
			model.walk_rate = 0.0
			_arrive()
		else:
			_next_segment()

func _process_play_chase(dt: float) -> void:
	var d := _play_target - global_position
	d.y = 0.0
	var dist := d.length()
	if dist > 0.35:
		var spd := 3.6
		global_position += d.normalized() * minf(dist, spd * dt)
		yaw = lerp_angle(yaw, atan2(-d.x, -d.z), 1.0 - exp(-11.0 * dt))
		model.walk_rate = spd * 4.6
		model.set_anim_targets({"walk": 1.0, "sniff": 0.9, "reach": 0.4})
	else:
		model.walk_rate = 0.0
		model.set_anim_targets({"rear": 0.75, "box": 0.5, "sniff": 0.9})

# =====================================================================
#  Utility AI — взвешенный выбор естественного поведения
# =====================================================================
func _others() -> Array:
	var out := []
	for n in get_tree().get_nodes_in_group("rats"):
		if n != self and n is Rat and n.area() == area() and bool(n.data.get("alive", true)):
			out.append(n)
	return out

func _slot_occupants(sid: String) -> int:
	var c := 0
	for o in _others():
		if o.spot == sid:
			c += 1
	return c

func _choose_utility_action() -> void:
	think_cd = Game.rng.randf_range(0.5, 1.6)
	if controlled != "":
		return

	var options: Array = [] # [{ "w": float, "fn": Callable }]
	var ar := area()
	var e := energy()
	var wave := 0.5 + 0.5 * sin(_sleep_wave)

	# 1. Сон в гамаке или домике (естественные циклы отдыха — не бегают без остановки!)
	var sleep_score := 0.25
	if e < 32.0:
		sleep_score = 6.5
	elif e < 52.0:
		sleep_score = 2.4 * (0.7 + 0.6 * wave)
	sleep_score *= (0.75 + 0.8 * float(pers.cozy))

	var hammocks := world.occupied_slots(ar, func(it): return it.kind == "cozy")
	var hides := world.occupied_slots(ar, func(it): return it.kind == "hide")
	if not hammocks.is_empty():
		options.append({"w": sleep_score * 1.45, "fn": func():
			var sid: String = hammocks[Game.rng.randi() % hammocks.size()]
			if _slot_occupants(sid) < 3:
				go_to(world.slots[sid].acc, {"type": "sleep_hammock", "slot": sid})
		})
	if not hides.is_empty():
		options.append({"w": sleep_score * 1.2, "fn": func():
			var sid: String = hides[Game.rng.randi() % hides.size()]
			if _slot_occupants(sid) < 3:
				go_to(world.slots[sid].acc, {"type": "sleep_house", "slot": sid})
		})
	else:
		options.append({"w": sleep_score * 0.7, "fn": func():
			_set_activity("sleep", Game.rng.randf_range(9.0, 16.0))
		})

	# 2. Еда из миски (держит еду передними лапками)
	var b: Dictionary = Game.state.cage.bowl
	var has_food := float(b.pellets) > 5.0 or int(b.veg) > 0 or int(b.fruit) > 0
	if ar == "cage" and has_food:
		var eat_w := (4.8 if float(data.satiety) < 55.0 else 1.25)
		options.append({"w": eat_w, "fn": func():
			go_to("bowl", {"type": "eat"})
		})

	# 3. Питьё из подвесной поилки
	if ar == "cage" and float(Game.state.cage.water.level) > 5.0:
		var drink_w := (4.0 if float(data.hydration) < 60.0 else 1.0)
		options.append({"w": drink_w, "fn": func():
			go_to("drink", {"type": "drink"})
		})

	# 4. Уход за собой: умывание мордочки и вычёсывание шубки на боку
	options.append({"w": 1.7 + 0.5 * float(pers.cozy), "fn": func():
		var kind := "groom_face" if Game.rng.randf() < 0.58 else "groom_body"
		_set_activity(kind, Game.rng.randf_range(3.2, 5.8))
	})

	# 5. Стойка на задних лапках и любопытное обнюхивание воздуха
	options.append({"w": 1.6 * (0.6 + float(pers.curiosity)), "fn": func():
		var kind := "stand" if Game.rng.randf() < 0.52 else "sniff"
		face_point(global_position + Vector3(Game.rng.randf_range(-1.5, 1.5), 0, 3.0))
		_set_activity(kind, Game.rng.randf_range(2.6, 4.8))
	})

	# 6. Перенос бумаги/салфеток в домик для гнезда
	var papers := world.occupied_slots(ar, func(it): return it.kind == "nest")
	if not papers.is_empty() and not hides.is_empty() and e > 30.0:
		options.append({"w": 1.45 * (0.6 + float(pers.cozy)), "fn": func():
			var psid: String = papers[0]
			var hsid: String = hides[Game.rng.randi() % hides.size()]
			go_to(world.slots[psid].acc, {"type": "fetch_paper", "dest_slot": hsid})
		})

	# 7. Пробежка сквозь туннель
	var tunnels := world.occupied_slots(ar, func(it): return it.kind == "tunnel")
	if not tunnels.is_empty() and e > 32.0:
		options.append({"w": 1.85 * (0.6 + float(pers.curiosity)), "fn": func():
			var sid: String = tunnels[Game.rng.randi() % tunnels.size()]
			go_to(world.slots[sid].acc, {"type": "tunnel", "slot": sid, "run": true})
		})

	# 8. Игры с фуражилкой, головоломкой, колесом, палочками, мячиком
	var toys := world.occupied_slots(ar, func(it): return it.kind in ["forage", "puzzle", "chew", "wheel", "ball", "bridge"])
	if not toys.is_empty() and e > 30.0:
		options.append({"w": 2.1 * (0.5 + float(pers.puzzle) + float(pers.activity) * 0.5), "fn": func():
			var sid: String = toys[Game.rng.randi() % toys.size()]
			go_to(world.slots[sid].acc, {"type": "toy", "slot": sid})
		})

	# 9. Социальное поведение (груминг друг друга, игровая возня, приветствие носиками)
	var peers := _others().filter(func(o): return not o.is_busy_social())
	if not peers.is_empty() and e > 34.0:
		options.append({"w": 2.4 * (0.5 + float(pers.social)), "fn": func():
			var peer: Rat = peers[Game.rng.randi() % peers.size()]
			var kind := "wrestle" if (Game.rng.randf() < 0.42 * float(pers.activity) + 0.15) else "groom_other"
			go_to(peer.cur_node, {"type": "social", "partner": peer, "kind": kind, "run": kind == "wrestle"})
		})

	# 10. Свободное исследование клетки (включая полки, 2-й и 3-й этажи!)
	options.append({"w": 2.3 * (0.5 + float(pers.activity)), "fn": func():
		var dest := world.random_node(ar)
		if dest != "":
			go_to(dest, {"type": "explore", "run": Game.rng.randf() < 0.25 and e > 55.0})
	})

	# Взвешенный выбор
	var total := 0.0
	for o in options:
		total += float(o.w)
	var r := Game.rng.randf() * total
	for o in options:
		r -= float(o.w)
		if r <= 0.0:
			o.fn.call()
			return
	if not options.is_empty():
		options[0].fn.call()

# =====================================================================
#  Прибытие в цель и проигрывание анимаций
# =====================================================================
func _arrive() -> void:
	var gtype: String = goal.get("type", "")
	match gtype:
		"hand":
			_at_hand()
		"hand_treat_go":
			_at_hand()
			var msg := Game.hand_treat(data)
			model.hold("treat")
			_set_activity("hand_treat", 5.2)
			Sfx.play("crunch", 1.35)
			say(msg)
		"call":
			face_point(hand_point())
			_set_activity("stand", 3.2)
			Sfx.play("squeak", 1.15)
		"eat":
			var kind := Game.rat_eat(data)
			if kind != "":
				model.hold(kind)
				face_point(world.nodes.get("bowl", global_position) + Vector3(0, 0, 1.5))
				_set_activity("eat", Game.rng.randf_range(4.5, 6.8))
				Sfx.play("crunch", 1.15)
			else:
				_set_activity("sniff", 2.0)
		"drink":
			Game.rat_drink(data)
			face_point(Vector3(6.2, global_position.y, global_position.z))
			_set_activity("drink", Game.rng.randf_range(3.0, 4.8))
			Sfx.play("water", 1.2)
		"sleep_hammock":
			var sid: String = goal.get("slot", "")
			if world.slots.has(sid):
				spot = sid
				var sp: Vector3 = world.slots[sid].pos
				var occ := _slot_occupants(sid)
				global_position = sp + Vector3((occ - 0.5) * 0.45 if occ > 0 else 0.0, -0.35, 0.0)
				model.set_blob(false)
			_set_activity("sleep_hammock", Game.rng.randf_range(12.0, 22.0))
		"sleep_house":
			var sid: String = goal.get("slot", "")
			if world.slots.has(sid):
				spot = sid
				var sp: Vector3 = world.slots[sid].pos
				global_position = sp + Vector3(Game.rng.randf_range(-0.22, 0.22), 0.02, 0.15)
			_set_activity("sleep", Game.rng.randf_range(10.0, 18.0))
		"fetch_paper":
			model.hold("paper", true)
			var dest: String = goal.get("dest_slot", "")
			if world.slots.has(dest):
				go_to(world.slots[dest].acc, {"type": "drop_paper", "slot": dest, "carry": true})
			else:
				model.drop_held()
				_set_activity("sniff", 2.0)
		"drop_paper":
			model.drop_held()
			data.comfort = minf(100.0, float(data.comfort) + 4.0)
			_set_activity("groom_face", 3.0)
		"tunnel":
			var sid: String = goal.get("slot", "")
			if world.slots.has(sid):
				var sp: Vector3 = world.slots[sid].pos
				var rot := float(world.slots[sid].rot) + int(Game.placed_dict(area()).get(sid, {}).get("rot", 0)) * PI / 2.0
				var dir := Vector3(cos(rot), 0.0, -sin(rot))
				_set_activity("tunnel_run", 2.8, {"pts": [sp - dir * 1.45, sp, sp + dir * 1.45], "i": 0})
			else:
				_set_activity("sniff", 2.0)
		"toy":
			var sid: String = goal.get("slot", "")
			var item_id := world.slot_item(sid)
			if item_id != "":
				Game.record_toy(data, item_id)
				var kind: String = Data.ITEMS[item_id].kind
				spot = sid
				if kind == "wheel":
					_set_activity("wheel", Game.rng.randf_range(5.0, 8.5), {"slot": sid})
				elif kind in ["forage", "puzzle"]:
					_set_activity("dig", Game.rng.randf_range(4.0, 6.5))
				elif kind == "chew":
					_set_activity("gnaw", Game.rng.randf_range(4.0, 6.0))
				else:
					_set_activity("play_toy", Game.rng.randf_range(3.5, 5.5))
			else:
				_set_activity("sniff", 2.0)
		"social":
			var peer: Rat = goal.get("partner", null)
			if peer and is_instance_valid(peer) and not peer.is_busy_social():
				var skind: String = goal.get("kind", "groom_other")
				_partner = peer
				peer._partner = self
				face_point(peer.global_position)
				peer.face_point(global_position)
				var dur := Game.rng.randf_range(4.0, 6.5)
				if skind == "wrestle":
					_set_activity("wrestle", dur)
					peer._set_activity("wrestle", dur)
					Sfx.play("squeak", 1.25)
				else:
					_set_activity("groom_other", dur)
					peer._set_activity("groomed", dur)
				Game.bump_relation(data, peer.data, 3.5)
			else:
				_set_activity("sniff", 2.2)
		_:
			_set_activity("sniff" if Game.rng.randf() < 0.6 else "stand", Game.rng.randf_range(2.2, 4.2))
	goal = {}

func _set_activity(act: String, dur: float, extra: Dictionary = {}) -> void:
	activity = act
	act_t = 0.0
	act_dur = dur
	act_data = extra

func _finish_activity() -> void:
	if activity in ["eat", "hand_treat", "fetch"]:
		model.drop_held()
	if _partner and is_instance_valid(_partner):
		_partner._partner = null
		_partner = null
	if spot != "" and world.slots.has(spot) and is_sleeping():
		# Плавно спускаемся с гамака на точку доступа
		var acc: String = world.slots[spot].acc
		if world.nodes.has(acc):
			global_position = world.nodes[acc]
		model.set_blob(true)
	spot = ""
	activity = "idle"
	model.walk_rate = 0.0

func _act_process(dt: float) -> void:
	match activity:
		"sleep":
			model.set_anim_targets({"curl": 1.0, "eyes": 0.0, "sniff": 0.05})
		"sleep_hammock":
			model.set_anim_targets({"curl": 0.88, "hammock": 1.0, "eyes": 0.0, "sniff": 0.05})
		"eat", "hand_treat":
			model.set_anim_targets({"rear": 0.62, "paws_up": 1.0, "chew": 1.0, "sniff": 0.45})
		"drink":
			model.set_anim_targets({"rear": 0.42, "head_pitch": -0.25, "chew": 0.55, "sniff": 0.4})
		"groom_face":
			model.set_anim_targets({"rear": 0.68, "groom": 1.0, "eyes": 0.4, "sniff": 0.35})
		"groom_body":
			model.set_anim_targets({"curl": 0.45, "groom": 0.8, "head_yaw": 0.65, "eyes": 0.55})
		"stand":
			model.set_anim_targets({"rear": 0.98, "paws_up": 0.65, "sniff": 0.85, "head_yaw": sin(act_t * 2.2) * 0.35})
		"sniff", "explore", "watch":
			model.set_anim_targets({"sniff": 1.0, "reach": 0.35, "head_yaw": sin(act_t * 2.8) * 0.4, "head_pitch": sin(act_t * 5.0) * 0.12})
		"hand_sniff":
			model.set_anim_targets({"reach": 0.6, "sniff": 1.0, "head_pitch": -0.15})
		"relax":
			model.set_anim_targets({"relax": 1.0, "crouch": 0.45, "eyes": 0.15, "sniff": 0.25})
		"groom_other":
			model.set_anim_targets({"groom": 0.85, "reach": 0.45, "sniff": 0.55})
		"groomed":
			model.set_anim_targets({"relax": 0.85, "crouch": 0.4, "eyes": 0.2})
		"wrestle":
			model.set_anim_targets({"rear": 0.72, "box": 1.0, "sniff": 0.9})
			global_position.y = world.nodes.get(cur_node, global_position).y + absf(sin(act_t * 9.0)) * 0.22
		"wheel":
			var sid: String = act_data.get("slot", "")
			world.spin(sid, dt)
			model.walk_rate = 14.0
			model.set_anim_targets({"walk": 1.0, "sniff": 0.5})
		"dig", "gnaw", "play_toy":
			model.set_anim_targets({"crouch": 0.45, "paws_up": 0.4, "chew": 0.8, "sniff": 0.95})
		"tunnel_run":
			var pts: Array = act_data.get("pts", [])
			var i := int(act_data.get("i", 0))
			if i >= pts.size():
				act_dur = act_t
				return
			var tgt: Vector3 = pts[i]
			var d := tgt - global_position
			var step := 2.7 * dt
			if d.length() <= step:
				global_position = tgt
				act_data.i = i + 1
			else:
				global_position += d.normalized() * step
				var fl := Vector2(d.x, d.z)
				if fl.length() > 0.01:
					yaw = lerp_angle(yaw, atan2(-d.x, -d.z), 1.0 - exp(-10.0 * dt))
			model.walk_rate = 11.5
			model.set_anim_targets({"walk": 1.0, "crouch": 0.35, "sniff": 0.65})
			act_dur = 999.0
		"spin":
			yaw += dt * TAU * 0.95
			model.walk_rate = 11.0
			model.set_anim_targets({"walk": 0.85, "sniff": 0.7})
		"target", "button":
			model.set_anim_targets({"reach": 0.85, "rear": 0.35, "sniff": 1.0, "paws_up": 0.5})
		"fetch", "bridge", "come":
			model.walk_rate = 11.0
			model.set_anim_targets({"walk": 1.0, "sniff": 0.75})
		"train_wait":
			model.set_anim_targets({"rear": 0.25, "sniff": 0.7, "head_yaw": sin(act_t * 1.8) * 0.2})
		_:
			model.set_anim_targets({"sniff": 0.4, "head_yaw": sin(act_t * 1.4) * 0.2})

# =====================================================================
#  Взаимодействие с игроком
# =====================================================================
func say(text: String) -> void:
	said.emit(self, text)

func say_once(text: String) -> void:
	var now_s := Time.get_ticks_msec() / 1000.0
	if now_s - float(_said_recent.get(text, -999.0)) > 120.0:
		_said_recent[text] = now_s
		said.emit(self, text)

func show_name() -> void:
	_name_t = 3.0

func select(on: bool) -> void:
	selected = on
	model.set_highlight(0.65 if on else 0.0)
	if on:
		show_name()

func focus_pos() -> Vector3:
	return global_position + Vector3(0, 0.65, 0)

func wake() -> void:
	if is_sleeping():
		_finish_activity()

func hand_point() -> Vector3:
	var a := area()
	if a == "cage" and world.nodes.has("door"):
		return world.nodes["door"] + Vector3(0, 0.15, 0.3)
	if world.nodes.has("pn11"):
		return world.nodes["pn11"] + Vector3(0, 0.15, 1.6)
	return global_position + Vector3(0, 0.15, 1.2)

func cmd_hand() -> void:
	world.show_hand(hand_point())
	wake()
	controlled = "hand"
	var near := world.nearest_node(hand_point(), area())
	go_to(near, {"type": "hand", "cautious": float(data.trust) < 25.0})

func _at_hand() -> void:
	face_point(hand_point())
	global_position = global_position.lerp(hand_point() + Vector3(0, -0.15, -1.2), 0.55)
	_set_activity("hand_sniff", 4.5)
	controlled = "hand"
	Game.change_trust(data, 2.2)
	Game.set_flag("hand_approach")
	say("%s подбегает и доверчиво обнюхивает ладонь." % display_name())
	Sfx.play("squeak", 1.18)

func near_hand() -> bool:
	return (controlled == "hand" and not moving) or activity == "relax"

func cmd_release() -> void:
	world.show_hand(Vector3.ZERO, false)
	_has_play_target = false
	if controlled in ["hand", "held", "play"]:
		controlled = ""
		_finish_activity()
		act_dur = 0.0

func cmd_treat() -> String:
	if int(Game.state.food.get("treat", 0)) <= 0:
		return "Угощения закончились — купи вкусняшки в магазине!"
	wake()
	if near_hand():
		var msg := Game.hand_treat(data)
		model.hold("treat")
		_set_activity("hand_treat", 5.2)
		Sfx.play("crunch", 1.35)
		return msg
	# Если далеко — крыска сразу бежит к руке за лакомством!
	world.show_hand(hand_point())
	controlled = "hand"
	go_to(world.nearest_node(hand_point(), area()), {"type": "hand_treat_go", "run": true})
	Sfx.play("squeak", 1.22)
	return "%s чует вкусняшку и бежит к тебе!" % display_name()

## Прямое поглаживание — крыска сразу тает, жмурится и поскрипывает зубками
func cmd_pet(amount: float) -> String:
	wake()
	moving = false
	path.clear()
	_set_activity("relax", 3.2)
	act_t = 0.0
	Game.change_trust(data, clampf(amount, 0.3, 1.8))
	data.comfort = minf(100.0, float(data.comfort) + 1.5)
	data.stress = maxf(0.0, float(data.stress) - 1.5)
	if amount >= 1.0:
		data.pets_count = int(data.pets_count) + 1
		Game.count("pets")
		Game.vibrate(18)
		Game.earn(2, "pet_" + str(data.id), 45.0)
		Sfx.play("squeak", 1.05 + Game.rng.randf() * 0.2)
		var reacts := [
			"%s сладко жмурится от ласки.",
			"%s прижимается к руке и тихонько поскрипывает зубками!",
			"%s подставляет пушистую спинку.",
			"%s довольно прикрывает глазки.",
		]
		return reacts[Game.rng.randi() % reacts.size()] % display_name()
	return ""

func cmd_call() -> String:
	world.show_hand(Vector3.ZERO, false)
	Sfx.play("call")
	wake()
	var learned := float(data.tricks.get("come", 0)) >= 100.0
	var trust := float(data.trust)
	controlled = ""
	if learned or trust >= 18.0:
		go_to("door" if area() == "cage" else "pn12", {"type": "call", "run": learned or trust >= 50.0})
		Game.change_trust(data, 1.0)
		return ("%s радостно мчится на зов!" if learned else "%s услышала своё имя и бежит к дверце!") % display_name()
	_set_activity("stand", 2.8)
	face_point(hand_point())
	Game.change_trust(data, 0.8)
	return "%s повернула ушки, встала столбиком и прислушалась к твоему голосу." % display_name()

func cmd_play_at(world_pt: Vector3) -> void:
	wake()
	moving = false
	path.clear()
	controlled = "play"
	_play_target = world_pt
	_has_play_target = true

func can_be_held() -> bool:
	return float(data.trust) >= 40.0 and not is_sleeping()

func move_area(to_area: String) -> bool:
	if to_area == "pen" and not bool(Game.state.playpen):
		return false
	data.loc = to_area
	moving = false
	path.clear()
	spot = ""
	controlled = ""
	cur_node = "pn11" if to_area == "pen" else "door"
	if world.nodes.has(cur_node):
		global_position = world.nodes[cur_node] + offset
	_finish_activity()
	_set_activity("sniff", 3.0)
	world.show_hand(Vector3.ZERO, false)
	return true

func begin_session() -> void:
	wake()
	controlled = "training"
	moving = false
	path.clear()
	cur_node = "door" if area() == "cage" else "pn12"
	if world.nodes.has(cur_node):
		global_position = world.nodes[cur_node] + Vector3(0, 0, 0.2)
	pitch = 0.0
	yaw = 0.0
	_set_activity("train_wait", 999.0)

func end_session() -> void:
	controlled = ""
	_finish_activity()
	act_dur = 0.0

func perform(behavior: String, dur := 2.4) -> void:
	_set_activity(behavior, dur)
	if behavior == "fetch":
		model.hold("ball", true)
	if behavior in ["stand", "spin", "target", "button", "fetch", "bridge", "come"]:
		face_point(global_position + Vector3(0, 0, 5))

func state_text() -> String:
	if controlled == "play":
		return "Охотится за игрушкой!"
	if moving:
		match goal.get("type", ""):
			"eat": return "Бежит к миске"
			"drink": return "Идёт к поилке"
			"sleep_hammock", "sleep_house": return "Ищет уютное место для сна"
			"fetch_paper", "drop_paper": return "Несёт салфетку в гнездо"
			"tunnel": return "Бежит к туннелю"
			"social": return "Бежит к подружке"
			"hand", "hand_treat_go": return "Бежит к твоей руке!"
		return "Исследует клетку" if area() == "cage" else "Резвится в манеже"
	match activity:
		"sleep_hammock": return "Спит в гамаке"
		"sleep": return "Уютно спит в домике"
		"eat", "hand_treat": return "Ест, держа еду лапками"
		"drink": return "Пьёт водичку"
		"groom_face": return "Умывает мордочку"
		"groom_body": return "Вычёсывает шубку"
		"groom_other": return "Вычёсывает друга"
		"groomed": return "Наслаждается грумингом"
		"wrestle": return "Весело возится"
		"dig", "gnaw", "play_toy": return "Играет с игрушкой"
		"wheel": return "Бегает в колесе"
		"tunnel_run": return "Ползёт по туннелю"
		"stand": return "Стоит на задних лапках"
		"relax": return "Мурлычет от ласки"
		"hand_sniff": return "Обнюхивает руку"
	return "Обнюхивает окрестности"
