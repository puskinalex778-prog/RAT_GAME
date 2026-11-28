class_name Main
extends Node3D
## Главная сцена: мир, камера, питомцы, интерфейс и сенсорное управление.

var world: World
var rig: CameraRig
var hud: HUD
var portraits: PortraitStudio
var rats := {}
var selected: Rat = null
var view_area := "cage"
var mode := "normal"          # normal / decor / photo / session
var pet_mode := false
var play_mode := false
var touches := {}
var _press_pos := Vector2.ZERO
var _moved := 0.0
var _pinch := 0.0
var _mid := Vector2.ZERO
var _pet_acc := 0.0
var decor_item := ""
var decor_hover := ""
var session_props: Node3D
var cutscene_root: Node3D
var _cutscene_active := false
var _cutscene_t := 0.0
var _cutscene_rat: Rat = null
var _cutscene_box: Node3D = null
var _cutscene_hand: Node3D = null
var _cutscene_squeaked := false
var _cutscene_reared := false

func _ready() -> void:
	get_tree().set_auto_accept_quit(false)
	get_tree().set_quit_on_go_back(false)
	world = World.new()
	add_child(world)
	rig = CameraRig.new()
	rig.world = world
	add_child(rig)
	rig.focus_area("cage")
	portraits = PortraitStudio.new()
	add_child(portraits)
	session_props = Node3D.new()
	add_child(session_props)
	cutscene_root = Node3D.new()
	add_child(cutscene_root)
	spawn_rats()
	Game.rats_changed.connect(spawn_rats)
	Game.world_changed.connect(_on_world_changed)
	Game.settings_changed.connect(_on_settings)
	hud = HUD.new()
	hud.main = self
	add_child(hud)
	if not bool(Game.state.intro_done):
		# Прячем первую крыску до завершения выбора в зоомагазине и кат-сцены прибытия
		for r in rats.values():
			r.visible = false
		hud.start_intro()
	elif not Game.return_summary.is_empty():
		hud.show_summary()

# ---------------------------------------------------------------------
func spawn_rats() -> void:
	var alive_ids := []
	for d in Game.live_rats():
		alive_ids.append(int(d.id))
		if not rats.has(int(d.id)):
			var r := Rat.new()
			add_child(r)
			r.setup(d, world)
			r.said.connect(_on_rat_said)
			rats[int(d.id)] = r
	for id in rats.keys():
		if not id in alive_ids:
			if rats[id] == selected:
				select_rat(null)
			rats[id].queue_free()
			rats.erase(id)

func rat_nodes() -> Array:
	return rats.values()

func refresh_rat_model(id: int) -> void:
	if rats.has(id):
		rats[id].rebuild_model()

func _on_rat_said(_r: Rat, text: String) -> void:
	if hud:
		hud.toast(text, "rat")

func _on_world_changed() -> void:
	for r in rats.values():
		if r.data.loc == "pen" and not bool(Game.state.playpen):
			r.data.loc = "cage"
		r.moving = false
		r.path.clear()
		r.spot = ""
		r.controlled = ""
		r.cur_node = world.nearest_node(r.global_position, r.area())
		r.global_position = world.nodes[r.cur_node] + r.offset
		r._finish_activity()
		r.act_dur = 0.0

func _on_settings() -> void:
	for r in rats.values():
		r.model.reduced_motion = bool(Game.setting("reduced_motion"))
		r.model.set_shells(int(Game.setting("quality")) >= 1)

func select_rat(r: Rat) -> void:
	if selected and is_instance_valid(selected):
		selected.select(false)
	selected = r
	if r:
		r.select(true)
		Sfx.play("squeak", 1.0 + Game.rng.randf() * 0.3)
	if hud:
		hud.on_selection()

func follow_selected(level := false) -> void:
	if selected:
		rig.follow_node(selected, level)

func focus_area(a: String) -> void:
	view_area = a
	rig.focus_area(a)

# ---------------------------------------------------------------------
#  Ввод
# ---------------------------------------------------------------------
func _unhandled_input(ev: InputEvent) -> void:
	if mode == "session" or mode == "cutscene":
		return
	if ev is InputEventScreenTouch:
		if ev.pressed:
			if hud and hud.is_over_ui(ev.position):
				return
			touches[ev.index] = ev.position
			if touches.size() == 1:
				_press_pos = ev.position
				_moved = 0.0
			elif touches.size() == 2:
				var ps := touches.values()
				_pinch = ps[0].distance_to(ps[1])
				_mid = (ps[0] + ps[1]) / 2.0
		else:
			if touches.has(ev.index):
				touches.erase(ev.index)
				if touches.is_empty() and _moved < 14.0:
					_tap(ev.position)
	elif ev is InputEventScreenDrag:
		if not touches.has(ev.index):
			return
		touches[ev.index] = ev.position
		_moved += ev.relative.length()
		if touches.size() == 1:
			if pet_mode and selected and _try_pet(ev.position, ev.relative.length()):
				return
			if play_mode and selected and _try_play(ev.position):
				return
			rig.orbit(ev.relative.x, ev.relative.y)
			if rig.follow and _moved > 40.0 and not rig.pet_level:
				pass
		elif touches.size() == 2:
			var ps2 := touches.values()
			var d: float = ps2[0].distance_to(ps2[1])
			var m: Vector2 = (ps2[0] + ps2[1]) / 2.0
			if _pinch > 1.0 and d > 1.0:
				rig.zoom(_pinch / d)
			rig.pan(m.x - _mid.x, m.y - _mid.y)
			_pinch = d
			_mid = m
	elif ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			rig.zoom(0.9)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			rig.zoom(1.1)

func _tap(pos: Vector2) -> void:
	if mode == "decor":
		var sid := _slot_at(pos)
		if sid != "":
			hud.decor_item_menu(sid)
		return
	if mode == "photo":
		return
	var best: Rat = null
	var bd := 120.0
	for r in rats.values():
		var p: Vector3 = r.focus_pos()
		if rig.cam.is_position_behind(p):
			continue
		var sp := rig.cam.unproject_position(p)
		var d := sp.distance_to(pos)
		if d < bd:
			bd = d
			best = r
	if best:
		if best == selected:
			hud.open_card(best)
		else:
			select_rat(best)
		return
	# Клик по памятной табличке в 3D-сцене
	var pp := world.plaque_world_pos()
	if not rig.cam.is_position_behind(pp):
		var psp := rig.cam.unproject_position(pp)
		if psp.distance_to(pos) < 110.0:
			Sfx.play("click")
			hud.open_dedication()

func _try_pet(pos: Vector2, amount: float) -> bool:
	var sp := rig.cam.unproject_position(selected.focus_pos())
	if sp.distance_to(pos) > 190.0:
		return false
	_pet_acc += amount
	if _pet_acc > 130.0:
		_pet_acc = 0.0
		var msg := selected.cmd_pet(1.0)
		if msg != "":
			hud.toast(msg, "rat")
		hud.refresh_soft()
	else:
		selected.cmd_pet(0.05)
	return true

func _try_play(pos: Vector2) -> bool:
	var ray_o := rig.cam.project_ray_origin(pos)
	var ray_d := rig.cam.project_ray_normal(pos)
	var plane := Plane(Vector3.UP, selected.global_position.y)
	var hit = plane.intersects_ray(ray_o, ray_d)
	if hit == null:
		return false
	var pt: Vector3 = hit
	if selected.area() == "cage":
		pt.x = clampf(pt.x, -World.HALF_X + 0.7, World.HALF_X - 0.7)
		pt.z = clampf(pt.z, -World.HALF_Z + 0.7, World.HALF_Z - 0.7)
	else:
		pt.x = clampf(pt.x, World.PEN_C.x - 4.8, World.PEN_C.x + 4.8)
		pt.z = clampf(pt.z, World.PEN_C.z - 4.8, World.PEN_C.z + 4.8)
	selected.cmd_play_at(pt)
	return true

func _slot_at(pos: Vector2, item := "") -> String:
	var best := ""
	var bd := 95.0
	var sp := world.slot_screen_positions(rig.cam, view_area)
	for sid in sp:
		var d: float = sp[sid].distance_to(pos)
		if d < bd and (item == "" or bool(world.can_place(item, sid).ok)):
			bd = d
			best = sid
	return best

# ---------------------------------------------------------------------
#  Обустройство
# ---------------------------------------------------------------------
func enter_decor(on: bool) -> void:
	mode = "decor" if on else "normal"
	world.show_markers(on)
	if on:
		rig.reset_view()
		rig.t_dist = rig.home_dist * 1.08
		pet_mode = false
		world.show_hand(Vector3.ZERO, false)

func decor_drag_begin(item_id: String) -> void:
	decor_item = item_id
	world.show_markers(true, item_id)

func decor_drag_update(pos: Vector2) -> String:
	decor_hover = _slot_at(pos, decor_item)
	return decor_hover

func decor_drop(pos: Vector2) -> String:
	var item := decor_item
	decor_item = ""
	world.show_markers(true)
	if item == "":
		return ""
	var sid := _slot_at(pos)
	if sid == "":
		return "Перетащи предмет на кружок-место в клетке."
	var chk := world.can_place(item, sid)
	if not chk.ok:
		Sfx.play("click", 0.7)
		return chk.why
	var area: String = world.slots[sid].area
	Game.place_item(area, sid, item)
	if int(chk.get("rot", 0)) != 0:
		Game.placed_dict(area)[sid].rot = int(chk.rot)
		Game.world_changed.emit()
	world.show_markers(true)
	return "Готово! Маршруты проходимы, высота безопасна, пересечений нет."

func decor_rotate(sid: String) -> String:
	var area: String = world.slots[sid].area
	var d: Dictionary = Game.placed_dict(area)[sid]
	var nr := (int(d.get("rot", 0)) + 1) % 4
	var chk := world.can_place(d.item, sid, nr)
	if not chk.ok:
		nr = (nr + 1) % 4
	d.rot = nr
	Game.world_changed.emit()
	world.show_markers(true)
	return ""

func decor_color(sid: String) -> void:
	var area: String = world.slots[sid].area
	var d: Dictionary = Game.placed_dict(area)[sid]
	d.color = (int(d.color) + 1) % Data.ITEMS[d.item].colors.size()
	Game.world_changed.emit()
	world.show_markers(true)

func decor_remove(sid: String) -> String:
	var area: String = world.slots[sid].area
	var it := world.slot_item(sid)
	if Data.ITEMS[it].kind == "hide" and area == "cage" and Game.hide_count() <= 1:
		return "Это последнее укрытие в клетке. Крыскам нужно хотя бы одно место, где можно спрятаться."
	Game.take_item(area, sid)
	world.show_markers(true)
	return "Предмет убран в инвентарь."

# ---------------------------------------------------------------------
#  Фото
# ---------------------------------------------------------------------
func take_photo() -> void:
	Sfx.play("shutter")
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	DirAccess.make_dir_recursive_absolute("user://photos")
	var t := int(Game.now())
	var path := "user://photos/photo_%d.png" % t
	img.save_png(path)
	var names := []
	for r in rats.values():
		if r.area() == view_area:
			names.append(r.data.name)
	Game.state.album.append({"type": "photo", "path": path, "time": t, "text": ", ".join(names)})
	Game.count("photos")
	# совместный сон в кадре
	var spots := {}
	for r in rats.values():
		if r.is_sleeping() and r.spot != "":
			spots[r.spot] = int(spots.get(r.spot, 0)) + 1
	for s in spots:
		if int(spots[s]) >= 2:
			Game.set_flag("photo_sleep")
	Game.save_game()
	hud.toast("Фото сохранено в альбом", "info")

# ---------------------------------------------------------------------
#  Сессии (обучение и мини-игры с 3D-питомцем)
# ---------------------------------------------------------------------
func begin_session(r: Rat) -> void:
	mode = "session"
	select_rat(r)
	r.begin_session()
	rig.follow_node(r, true)
	rig.t_dist = 6.0
	rig.t_pitch = 0.18
	rig.t_yaw = 0.0
	for c in session_props.get_children():
		c.queue_free()

func session_prop(kind: String, r: Rat) -> void:
	for c in session_props.get_children():
		c.queue_free()
	var base: Vector3 = r.global_position
	match kind:
		"target":
			var st := Node3D.new()
			Items3D.cyl(st, 0.04, 0.04, 2.0, Items3D.mat(Color(0.8, 0.65, 0.45), 0.7, "wood"), Vector3(0, 1.0, 0), Vector3(0.9, 0, 0))
			Items3D.sph(st, Vector3.ONE * 0.2, Items3D.mat(Color(0.35, 0.6, 0.55), 0.4), Vector3(0, 0.75, -0.75))
			st.position = base + Vector3(0, 0, -0.9)
			session_props.add_child(st)
		"button":
			var b := Node3D.new()
			Items3D.cyl(b, 0.35, 0.4, 0.12, Items3D.mat(Color(0.9, 0.88, 0.82)), Vector3(0, 0.06, 0))
			Items3D.cyl(b, 0.22, 0.22, 0.1, Items3D.mat(Color(0.85, 0.45, 0.35), 0.4), Vector3(0, 0.15, 0))
			b.position = base + Vector3(0, 0, -1.4)
			session_props.add_child(b)
		"fetch":
			var cup := Node3D.new()
			Items3D.cyl(cup, 0.5, 0.4, 0.3, Items3D.mat(Color(0.95, 0.85, 0.7)), Vector3(0, 0.15, 0))
			cup.position = base + Vector3(1.2, 0, 0.3)
			session_props.add_child(cup)
		"bridge":
			var br := Items3D.make("bridge")
			br.position = base + Vector3(0, 0, -0.6)
			br.rotation.y = PI / 2
			br.scale = Vector3.ONE * 0.8
			session_props.add_child(br)

func end_session(r: Rat) -> void:
	mode = "normal"
	for c in session_props.get_children():
		c.queue_free()
	if r and is_instance_valid(r):
		r.end_session()
	rig.reset_view()

# ---------------------------------------------------------------------
#  Вступительная 3D-кат-сцена: приносим крыску в картонном домике и сажаем в клетку!
# ---------------------------------------------------------------------
func play_arrival_cutscene(r: Rat = null) -> void:
	if r == null and not rats.is_empty():
		r = rats.values()[0]
	if r == null:
		return
	for c in cutscene_root.get_children():
		c.queue_free()
	mode = "cutscene"
	_cutscene_active = true
	_cutscene_t = 0.0
	_cutscene_rat = r
	_cutscene_squeaked = false
	_cutscene_reared = false

	r.visible = true
	r.controlled = "cutscene"
	r.moving = false
	r.path.clear()
	r.spot = ""
	r.model.drop_held()
	r.model.play_clip("Idle_Sniff", 1.0, true)

	_cutscene_box = Items3D.carrier_box()
	_cutscene_box.position = Vector3(5.8, 2.2, 6.4)
	cutscene_root.add_child(_cutscene_box)

	_cutscene_hand = Items3D.hand()
	_cutscene_hand.scale = Vector3.ONE * 1.1
	_cutscene_hand.position = _cutscene_box.position + Vector3(0.0, 2.0, 0.25)
	cutscene_root.add_child(_cutscene_hand)

	r.position = _cutscene_box.position + Vector3(0.0, 0.22, 0.0)
	r.yaw = 0.0
	r.pitch = 0.0

	rig.follow = null
	rig.pet_level = false
	rig.t_target = Vector3(-0.3, 1.15, 2.0)
	rig.t_dist = 9.4
	rig.t_yaw = 0.44
	rig.t_pitch = 0.36

	if hud:
		hud.show_cutscene_ui(true, "Приносим %s домой из зоомагазина в картонном домике..." % r.display_name())

func skip_arrival_cutscene() -> void:
	if not _cutscene_active:
		return
	_finish_arrival_cutscene()

func _finish_arrival_cutscene() -> void:
	_cutscene_active = false
	mode = "normal"
	for c in cutscene_root.get_children():
		c.queue_free()
	_cutscene_box = null
	_cutscene_hand = null
	var r := _cutscene_rat
	_cutscene_rat = null
	if r and is_instance_valid(r):
		r.visible = true
		r.controlled = ""
		r.cur_node = "door" if world.nodes.has("door") else world.random_node("cage")
		r.position = Vector3(0.0, 0.0, 0.85)
		r.yaw = 0.25
		r.pitch = 0.0
		r.act_dur = 2.0
		r.act_t = 0.0
		r.model.play_clip("Idle_Sniff", 1.0)
		select_rat(r)
	rig.reset_view()
	if hud:
		hud.show_cutscene_ui(false)
		if r and is_instance_valid(r):
			hud.toast("Добро пожаловать домой, %s!" % r.display_name(), "rat")
		hud.refresh_soft()

func _process(delta: float) -> void:
	if not _cutscene_active:
		return
	var dt := minf(delta, 0.05)
	_cutscene_t += dt
	if not is_instance_valid(_cutscene_rat) or not is_instance_valid(_cutscene_box):
		_finish_arrival_cutscene()
		return

	var t := _cutscene_t
	var box_start := Vector3(5.6, 2.1, 6.2)
	var box_rest := Vector3(-1.35, 0.08, 3.85)
	var box_exit := Vector3(-6.4, 3.4, 7.8)
	var flap_back := _cutscene_box.get_node_or_null("FlapBack") as Node3D
	var flap_front := _cutscene_box.get_node_or_null("FlapFront") as Node3D

	if t < 2.0:
		# Фаза 1: приносим картонный домик к открытому входу клетки
		var u := smoothstep(0.0, 2.0, t)
		var pos := box_start.lerp(box_rest, u)
		pos.y += sin(u * PI) * 0.65 + sin(u * PI * 3.0) * 0.08
		_cutscene_box.position = pos
		_cutscene_box.rotation.y = lerpf(-0.30, 0.38, u)
		_cutscene_hand.position = pos + Vector3(0.0, 1.75, 0.25)
		_cutscene_rat.position = pos + Vector3(0.0, 0.20, 0.0)
		_cutscene_rat.yaw = -0.35
	elif t < 3.1:
		# Фаза 2: ставим коробку и плавно раскрываем створки картонного домика
		var u := smoothstep(2.0, 3.1, t)
		_cutscene_box.position = box_rest
		_cutscene_box.rotation.y = 0.38
		if flap_back:
			flap_back.rotation.x = lerpf(0.0, -2.05, u)
		if flap_front:
			flap_front.rotation.x = lerpf(0.0, 2.05, u)
		_cutscene_hand.position = box_rest + Vector3(0.0, 1.75 + u * 2.2, 0.25 + u * 1.6)
		_cutscene_rat.position = box_rest + Vector3(u * 0.25, 0.22 + u * 0.42, -u * 0.32)
		_cutscene_rat.yaw = -0.35
		_cutscene_rat.model.play_clip("Rear_Beg", 0.9)
		if hud and u > 0.15:
			hud.set_cutscene_text("Открываем картонный домик — %s выглядывает наружу!" % _cutscene_rat.display_name())
	elif t < 4.7:
		# Фаза 3: крыска мягко перепрыгивает из картонного домика внутрь клетки!
		var u := smoothstep(3.1, 4.7, t)
		if not _cutscene_squeaked:
			_cutscene_squeaked = true
			Sfx.play("squeak", 1.15)
			if hud:
				hud.set_cutscene_text("%s перебирается в свой новый уютный домик!" % _cutscene_rat.display_name())
		_cutscene_box.position = box_rest
		_cutscene_box.rotation.y = 0.38
		if flap_back:
			flap_back.rotation.x = -2.05
		if flap_front:
			flap_front.rotation.x = 2.05
		var p_from := box_rest + Vector3(0.25, 0.64, -0.32)
		var p_to := Vector3(0.35, 0.0, 0.85)
		var rp := p_from.lerp(p_to, u)
		rp.y += sin(u * PI) * 0.85
		_cutscene_rat.position = rp
		_cutscene_rat.yaw = -0.38
		_cutscene_rat.model.play_clip("Walk_Scurry", 1.15)
		rig.t_target = Vector3(-0.2, 1.15, 1.65)
		rig.t_dist = 8.8
		rig.t_yaw = 0.38
		rig.t_pitch = 0.34
	elif t < 6.3:
		# Фаза 4: крыска радостно осматривается, а коробку аккуратно убираем
		var u := smoothstep(4.7, 6.3, t)
		if not _cutscene_reared:
			_cutscene_reared = true
			_cutscene_rat.position = Vector3(0.0, 0.0, 0.85)
			_cutscene_rat.yaw = 0.55
			_cutscene_rat.model.play_clip("Rear_Beg", 1.0)
			if hud:
				hud.set_cutscene_text("%s уже осваивается в клетке! ♥" % _cutscene_rat.display_name())
		var bpos := box_rest.lerp(box_exit, u)
		_cutscene_box.position = bpos
		_cutscene_hand.position = bpos + Vector3(0.0, 2.0, 0.25)
	else:
		_finish_arrival_cutscene()

# ---------------------------------------------------------------------
func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_GO_BACK_REQUEST:
			if hud and not hud.back():
				hud.confirm_exit()
		NOTIFICATION_WM_CLOSE_REQUEST:
			Game.save_game()
			get_tree().quit()
