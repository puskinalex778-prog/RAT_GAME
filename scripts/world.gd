class_name World
extends Node3D
## 3D-мир: комната, клетка, полки, пандусы, предметы, манеж, граф навигации и слоты размещения.

const PEN_C := Vector3(17, -0.95, 0)
const FLOOR_Y := -1.0
const HALF_X := 5.95
const HALF_Z := 2.95
## Габариты предметов (длина по X, глубина по Z) для проверки пересечений
const FOOT := {
	"wood_house": Vector2(2.3, 1.9), "tunnel": Vector2(2.7, 1.1), "tunnel_long": Vector2(3.1, 1.6), "bridge": Vector2(2.9, 1.3),
	"foraging_box": Vector2(1.8, 1.4), "puzzle_feeder": Vector2(2.0, 0.9), "chew_sticks": Vector2(1.2, 0.7), "nesting_paper": Vector2(1.2, 1.2),
	"ball": Vector2(0.7, 0.7), "wheel": Vector2(3.4, 1.4),
}

var level := 1
var H := 9.4
var nodes := {}
var node_area := {}
var edges := {}
var slots := {}
var item_nodes := {}
var cage_root: Node3D
var items_root: Node3D
var pen_root: Node3D
var theme_root: Node3D
var markers_root: Node3D
var fixed := {}
var hand: Node3D
var litter_mat: ShaderMaterial
var leftovers_root: Node3D
var env: Environment
var sun: DirectionalLight3D
var lamp: OmniLight3D
var bg_layer: CanvasLayer
var bg_rect: TextureRect
var bg_stars: Control
var _hand_target := Vector3.ZERO
var _hand_visible := false
var _spinners := {}

func _ready() -> void:
	_build_env()
	rebuild()
	Game.world_changed.connect(rebuild)
	Game.changed.connect(refresh_state_visuals)
	Game.settings_changed.connect(apply_quality)

# ---------------------------------------------------------------------
func _build_env() -> void:
	bg_layer = CanvasLayer.new()
	bg_layer.layer = -10
	add_child(bg_layer)
	bg_rect = TextureRect.new()
	bg_rect.texture = load("res://assets/ui/room.jpg")
	bg_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg_rect.anchor_left = -0.08
	bg_rect.anchor_right = 1.08
	bg_layer.add_child(bg_rect)
	bg_stars = preload("res://scripts/ui/starfield.gd").new()
	bg_stars.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg_stars.visible = false
	bg_layer.add_child(bg_stars)
	var we := WorldEnvironment.new()
	env = Environment.new()
	env.background_mode = Environment.BG_CANVAS
	env.background_canvas_max_layer = -1
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1.0, 0.92, 0.82)
	env.ambient_light_energy = 0.38
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.rotation = Vector3(-0.95, 0.5, 0)
	sun.light_energy = 0.46
	sun.light_color = Color(1.0, 0.93, 0.82)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 40.0
	sun.shadow_bias = 0.05
	add_child(sun)
	lamp = OmniLight3D.new()
	lamp.position = Vector3(-6, 12, 8)
	lamp.omni_range = 30
	lamp.light_energy = 0.28
	lamp.light_color = Color(1.0, 0.85, 0.65)
	add_child(lamp)
	hand = Items3D.hand()
	hand.visible = false
	hand.scale = Vector3.ONE * 0.9
	add_child(hand)
	apply_quality()

func apply_quality() -> void:
	var q := int(Game.setting("quality"))
	sun.shadow_enabled = q >= 1
	get_viewport().msaa_3d = Viewport.MSAA_DISABLED if q == 0 else (Viewport.MSAA_2X if q == 1 else Viewport.MSAA_4X)

func set_background_offset(yaw: float) -> void:
	if bg_rect:
		var off := clampf(yaw, -1.2, 1.2) * 0.06
		bg_rect.anchor_left = -0.08 + off
		bg_rect.anchor_right = 1.08 + off

# ---------------------------------------------------------------------
func rebuild() -> void:
	level = int(Game.state.cage.level)
	H = 9.4 if level == 1 else 12.6
	for r in [cage_root, items_root, pen_root, theme_root, markers_root]:
		if r:
			r.queue_free()
	cage_root = Node3D.new(); add_child(cage_root)
	items_root = Node3D.new(); add_child(items_root)
	pen_root = Node3D.new(); add_child(pen_root)
	theme_root = Node3D.new(); add_child(theme_root)
	markers_root = Node3D.new(); add_child(markers_root)
	markers_root.visible = false
	nodes.clear(); node_area.clear(); edges.clear(); slots.clear(); item_nodes.clear(); fixed.clear(); _spinners.clear()
	_build_layout()
	_build_cage()
	if bool(Game.state.playpen):
		_build_pen()
	_build_items()
	_apply_theme()
	refresh_state_visuals()

# ---------------------- навигация ----------------------
func _n(id: String, p: Vector3, area := "cage") -> void:
	nodes[id] = p
	node_area[id] = area
	edges[id] = []

func _e(a: String, b: String, type := "walk") -> void:
	edges[a].append({"to": b, "type": type})
	edges[b].append({"to": a, "type": type})

func _slot(id: String, pos: Vector3, type: String, acc: Vector3, links: Array, area := "cage", maxfoot := Vector2(9, 9), attach := 0.0, rot := 0.0) -> void:
	var nid := "s_" + id
	_n(nid, pos + acc, area)
	for l in links:
		_e(nid, l)
	slots[id] = {"pos": pos, "type": type, "acc": nid, "area": area, "max": maxfoot, "attach": attach, "rot": rot}

func _build_layout() -> void:
	# пол клетки
	for i in 5:
		_n("fw%d" % i, Vector3(-4.6 + i * 2.3, 0, [0.0, 0.1, 0.0, 0.1, 0.2][i]))
		if i > 0:
			_e("fw%d" % (i - 1), "fw%d" % i)
	_n("door", Vector3(0, 0, 1.55)); _e("door", "fw2")
	_n("bowl", Vector3(3.15, 0, 1.55)); _e("bowl", "fw3"); _e("bowl", "fw4")
	_n("drink", Vector3(5.0, 0, 0.6)); _e("drink", "fw4")
	_n("litter", Vector3(4.8, 0.2, -1.4)); _e("litter", "fw4")
	_slot("f1", Vector3(-4.3, 0, -1.6), "floor", Vector3(0.3, 0, 1.1), ["fw0", "fw1"], "cage", Vector2(3.1, 2.3))
	_slot("f2", Vector3(-4.3, 0, 1.7), "floor", Vector3(0.3, 0, -1.2), ["fw0", "fw1"], "cage", Vector2(3.1, 2.3))
	_slot("f3", Vector3(-1.3, 0, -1.55), "floor", Vector3(0, 0, 1.1), ["fw1", "fw2"], "cage", Vector2(2.9, 2.2))
	_slot("f4", Vector3(-1.4, 0, 1.75), "floor", Vector3(0, 0, -1.2), ["fw1", "fw2"], "cage", Vector2(2.6, 2.2))
	_slot("f5", Vector3(1.4, 0, 1.75), "floor", Vector3(0, 0, -1.2), ["fw2", "fw3"], "cage", Vector2(2.3, 2.0))
	# пандус 1 (задняя стенка) → полка A
	_n("r1b", Vector3(3.45, 0, -2.15)); _e("r1b", "fw3"); _e("r1b", "fw4")
	_n("r1t", Vector3(-2.35, 3.6, -2.15)); _e("r1b", "r1t", "ramp")
	_n("a2", Vector3(-2.9, 3.6, -2.0)); _e("r1t", "a2")
	_n("a0", Vector3(-4.3, 3.6, -0.3)); _n("a1", Vector3(-3.2, 3.6, 1.0)); _n("a3", Vector3(-2.9, 3.6, 1.85)); _n("aw", Vector3(-5.4, 3.6, 0.4))
	_e("a2", "a0"); _e("a0", "a1"); _e("a1", "a3"); _e("a0", "aw"); _e("a2", "a1")
	_slot("sa1", Vector3(-4.6, 3.6, -1.75), "shelf", Vector3(0.4, 0, 1.15), ["a0", "a2"], "cage", Vector2(2.4, 1.5))
	_slot("sa2", Vector3(-4.6, 3.6, 1.6), "shelf", Vector3(0.6, 0, -0.9), ["a1"], "cage", Vector2(2.4, 1.5))
	# пандус 2 (спереди) → полка B
	_n("r2b", Vector3(-2.35, 3.6, 1.85)); _e("a3", "r2b")
	_n("r2t", Vector3(2.35, 6.8, 1.85)); _e("r2b", "r2t", "ramp")
	_n("b0", Vector3(2.9, 6.8, 1.85)); _e("r2t", "b0")
	_n("b1", Vector3(3.8, 6.8, 0.2)); _n("b2", Vector3(2.9, 6.8, -1.4)); _n("bw", Vector3(5.4, 6.8, 0.4))
	_e("b0", "b1"); _e("b1", "b2"); _e("b1", "bw")
	_slot("sb1", Vector3(4.7, 6.8, -1.75), "shelf", Vector3(-0.6, 0, 1.15), ["b1", "b2"], "cage", Vector2(2.4, 1.5))
	_slot("sb2", Vector3(4.75, 6.8, 1.65), "shelf", Vector3(-0.8, 0, -0.8), ["b1", "b0"], "cage", Vector2(2.2, 1.4))
	# подвесные места
	var under_c := 9.9 if level >= 2 else H
	_n("h1e", Vector3(-5.35, 6.55, 0.35)); _e("aw", "h1e", "climb")
	_slot("h1", Vector3(-3.9, 6.5, 0.3), "hang", Vector3(0, 0.05, 0), ["h1e"], "cage", Vector2(9, 9), under_c)
	_n("h2e", Vector3(1.7, 6.1, -1.0)); _e("b2", "h2e", "hop")
	_slot("h2", Vector3(0.1, 5.9, -0.9), "hang", Vector3(0, 0.05, 0), ["h2e"], "cage", Vector2(9, 9), H)
	# полка на правой стенке
	_n("w1b", Vector3(5.4, 0, -0.35)); _e("w1b", "fw4"); _e("w1b", "drink")
	_n("w1e", Vector3(5.45, 3.4, -0.35)); _e("w1b", "w1e", "climb")
	_slot("w1", Vector3(5.15, 3.4, -1.1), "wall", Vector3(-0.1, 0, 0.2), ["w1e"], "cage", Vector2(9, 9), 0.0, PI / 2)
	if level >= 2:
		_n("r3b", Vector3(2.35, 6.8, -2.15)); _e("r3b", "b2")
		_n("r3t", Vector3(-2.35, 10.0, -2.15)); _e("r3b", "r3t", "ramp")
		_n("c2", Vector3(-2.9, 10.0, -2.0)); _e("r3t", "c2")
		_n("c0", Vector3(-4.3, 10.0, -0.3)); _n("c1", Vector3(-3.2, 10.0, 1.2))
		_e("c2", "c0"); _e("c0", "c1")
		_slot("sc1", Vector3(-4.6, 10.0, -1.75), "shelf", Vector3(0.4, 0, 1.15), ["c0", "c2"], "cage", Vector2(2.4, 1.5))
		_slot("sc2", Vector3(-4.6, 10.0, 1.6), "shelf", Vector3(0.6, 0, -0.9), ["c1"], "cage", Vector2(2.4, 1.5))
		_n("h3e", Vector3(5.35, 9.7, 0.35)); _e("bw", "h3e", "climb")
		_slot("h3", Vector3(3.9, 9.6, 0.3), "hang", Vector3(0, 0.05, 0), ["h3e"], "cage", Vector2(9, 9), H)
	if bool(Game.state.playpen):
		for i in [-1, 0, 1]:
			for j in [-1, 0, 1]:
				_n("pn%d%d" % [i + 1, j + 1], PEN_C + Vector3(i * 2.4, 0, j * 1.9), "pen")
		for i in 3:
			for j in 3:
				if i < 2: _e("pn%d%d" % [i, j], "pn%d%d" % [i + 1, j])
				if j < 2: _e("pn%d%d" % [i, j], "pn%d%d" % [i, j + 1])
		var pm := Vector2(3.6, 2.4)
		_slot("p1", PEN_C + Vector3(-3.4, 0, -2.9), "pen", Vector3(1.0, 0, 1.0), ["pn00", "pn10"], "pen", pm)
		_slot("p2", PEN_C + Vector3(3.4, 0, -2.9), "pen", Vector3(-1.0, 0, 1.0), ["pn20", "pn10"], "pen", pm)
		_slot("p3", PEN_C + Vector3(-3.9, 0, 2.6), "pen", Vector3(1.0, 0, -0.9), ["pn02", "pn01"], "pen", pm)
		_slot("p4", PEN_C + Vector3(3.9, 0, 2.6), "pen", Vector3(-1.0, 0, -0.9), ["pn22", "pn21"], "pen", pm)

func find_path(from: String, to: String) -> Array:
	if not nodes.has(from) or not nodes.has(to):
		return []
	if from == to:
		return [to]
	var dist := {from: 0.0}
	var prev := {}
	var open := [from]
	while not open.is_empty():
		var best := 0
		for i in open.size():
			if dist[open[i]] < dist[open[best]]:
				best = i
		var u: String = open[best]
		open.remove_at(best)
		if u == to:
			break
		for e in edges[u]:
			var v: String = e.to
			# узлы слотов — тупиковые, через них не ходим
			if v.begins_with("s_") and v != to:
				continue
			var nd: float = dist[u] + nodes[u].distance_to(nodes[v]) * (1.6 if e.type == "climb" else 1.0)
			if not dist.has(v) or nd < dist[v]:
				dist[v] = nd
				prev[v] = u
				if not v in open:
					open.append(v)
	if not prev.has(to):
		return []
	var path := [to]
	var c: String = to
	while prev.has(c):
		c = prev[c]
		path.push_front(c)
	return path

func edge_type(a: String, b: String) -> String:
	for e in edges.get(a, []):
		if e.to == b:
			return e.type
	return "walk"

func nearest_node(p: Vector3, area := "cage") -> String:
	var best := ""
	var bd := 1e9
	for id in nodes:
		if node_area[id] != area or id.begins_with("s_"):
			continue
		var d: float = nodes[id].distance_to(p)
		if d < bd:
			bd = d
			best = id
	return best

func random_node(area := "cage") -> String:
	var ids := nodes.keys().filter(func(k): return node_area[k] == area and not k.begins_with("s_") and not k in ["litter"])
	return ids[Game.rng.randi() % ids.size()] if not ids.is_empty() else ""

func slot_item(slot_id: String) -> String:
	var s: Dictionary = slots.get(slot_id, {})
	if s.is_empty():
		return ""
	var d: Dictionary = Game.placed_dict(s.area)
	return d[slot_id].item if d.has(slot_id) else ""

func occupied_slots(area := "cage", pred := Callable()) -> Array:
	var out := []
	for sid in slots:
		if slots[sid].area != area:
			continue
		var it := slot_item(sid)
		if it == "":
			continue
		if pred.is_valid() and not pred.call(Data.ITEMS[it]):
			continue
		out.append(sid)
	return out

## Проверки размещения: тип слота, высота, габариты, пересечения
func can_place(item_id: String, slot_id: String, rot := -1) -> Dictionary:
	var it: Dictionary = Data.ITEMS[item_id]
	var s: Dictionary = slots.get(slot_id, {})
	if s.is_empty():
		return {"ok": false, "why": "Нет такого места"}
	if not s.type in it.slots:
		var where := {"floor": "на полу", "shelf": "на полках", "hang": "подвешивать", "wall": "на стенке", "pen": "в манеже"}
		var allowed := []
		for t in it.slots:
			allowed.append(where.get(t, t))
		return {"ok": false, "why": "Этот предмет можно ставить только: " + ", ".join(allowed)}
	if FOOT.has(item_id):
		var f: Vector2 = FOOT[item_id]
		var r := rot if rot >= 0 else 0
		var fx := f.x if r % 2 == 0 else f.y
		var fz := f.y if r % 2 == 0 else f.x
		var mx: Vector2 = s.max
		if fx > mx.x + 0.01 or fz > mx.y + 0.01:
			if f.y <= mx.x and f.x <= mx.y and rot < 0:
				return {"ok": true, "why": "", "rot": 1}
			return {"ok": false, "why": "Слишком большой для этого места — пересечётся с соседними предметами или стенкой"}
	return {"ok": true, "why": "", "rot": 0 if rot < 0 else rot}

# ---------------------- клетка ----------------------
func _build_cage() -> void:
	var th: Dictionary = Data.THEMES.get(Game.state.theme, Data.THEMES.scandi)
	var tray := Items3D.mat(th.tray, 0.5)
	# поддон
	Items3D.box(cage_root, Vector3(12.6, 1.0, 6.6), tray, Vector3(0, -0.5, 0))
	var floor_mi := MeshInstance3D.new()
	var fb := BoxMesh.new()
	fb.size = Vector3(HALF_X * 2, 0.1, HALF_Z * 2)
	floor_mi.mesh = fb
	floor_mi.position = Vector3(0, -0.05, 0)
	litter_mat = ShaderMaterial.new()
	litter_mat.shader = load("res://shaders/litter.gdshader")
	litter_mat.set_shader_parameter("col", th.litter)
	floor_mi.material_override = litter_mat
	cage_root.add_child(floor_mi)
	# ковёр под клеткой
	var rug := MeshInstance3D.new()
	var rc := CylinderMesh.new()
	rc.top_radius = 11.0; rc.bottom_radius = 11.0; rc.height = 0.04; rc.radial_segments = 48
	rug.mesh = rc
	rug.position = Vector3(0, FLOOR_Y + 0.02, 0)
	var rm := ShaderMaterial.new()
	rm.shader = load("res://shaders/rug.gdshader")
	rm.set_shader_parameter("radius", 11.0)
	rug.material_override = rm
	cage_root.add_child(rug)
	# прутья (MultiMesh — один вызов отрисовки)
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color(0.92, 0.92, 0.9)
	metal.metallic = 0.6
	metal.roughness = 0.35
	var front_metal := metal.duplicate()
	front_metal.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	front_metal.albedo_color = Color(0.92, 0.92, 0.9, 0.35)
	var bar := CylinderMesh.new()
	bar.top_radius = 0.035; bar.bottom_radius = 0.035; bar.height = 1.0; bar.radial_segments = 6; bar.rings = 1
	var back_t := []
	var front_t := []
	var sp := 0.55
	var nx := int(HALF_X * 2 / sp)
	var nz := int(HALF_Z * 2 / sp)
	for i in nx + 1:
		var x := -HALF_X + i * HALF_X * 2 / nx
		back_t.append(Transform3D(Basis.from_scale(Vector3(1, H, 1)), Vector3(x, H / 2, -HALF_Z - 0.02)))
		front_t.append(Transform3D(Basis.from_scale(Vector3(1, H, 1)), Vector3(x, H / 2, HALF_Z + 0.02)))
	for j in nz + 1:
		var z := -HALF_Z + j * HALF_Z * 2 / nz
		back_t.append(Transform3D(Basis.from_scale(Vector3(1, H, 1)), Vector3(-HALF_X - 0.02, H / 2, z)))
		back_t.append(Transform3D(Basis.from_scale(Vector3(1, H, 1)), Vector3(HALF_X + 0.02, H / 2, z)))
	# крыша
	for i in nx + 1:
		var x2 := -HALF_X + i * HALF_X * 2 / nx
		back_t.append(Transform3D(Basis(Vector3.RIGHT, PI / 2).scaled(Vector3(1, 1, HALF_Z * 2)), Vector3(x2, H, 0)))
	_multi(cage_root, bar, metal, back_t)
	_multi(cage_root, bar, front_metal, front_t)
	# рамы
	var frame := Items3D.mat(Color(0.85, 0.85, 0.83), 0.4, "metal")
	for y in [0.05, H]:
		Items3D.box(cage_root, Vector3(HALF_X * 2 + 0.1, 0.1, 0.1), frame, Vector3(0, y, -HALF_Z))
		Items3D.box(cage_root, Vector3(0.1, 0.1, HALF_Z * 2), frame, Vector3(-HALF_X, y, 0))
		Items3D.box(cage_root, Vector3(0.1, 0.1, HALF_Z * 2), frame, Vector3(HALF_X, y, 0))
	Items3D.box(cage_root, Vector3(HALF_X * 2 + 0.1, 0.1, 0.1), Items3D.mat(Color(0.85, 0.85, 0.83, 0.5), 0.4), Vector3(0, H, HALF_Z))
	# полки (сплошные, с бортиком) и пандусы с поперечными рейками
	var wood := Items3D.mat(Color(0.82, 0.66, 0.44), 0.7, "wood")
	_shelf(Vector3(-4.15, 3.6, -0.25), Vector2(3.6, 5.3), wood)
	_shelf(Vector3(4.15, 6.8, -0.25), Vector2(3.6, 5.3), wood)
	_ramp(Vector3(3.45, 0, -2.15), Vector3(-2.4, 3.6, -2.15), wood)
	_ramp(Vector3(-2.4, 3.6, 1.85), Vector3(2.4, 6.8, 1.85), wood)
	if level >= 2:
		_shelf(Vector3(-4.15, 10.0, -0.25), Vector2(3.6, 5.3), wood)
		_ramp(Vector3(2.4, 6.8, -2.15), Vector3(-2.4, 10.0, -2.15), wood)
	# фиксированные предметы
	var b := Items3D.bowl()
	b.position = Vector3(4.25, 0, 1.85)
	cage_root.add_child(b)
	fixed.bowl = b
	var bt := Items3D.bottle()
	bt.position = Vector3(5.65, 0, 0.6)
	cage_root.add_child(bt)
	fixed.bottle = bt
	var lt := Items3D.litter_tray()
	lt.position = Vector3(4.85, 0, -1.55)
	lt.scale = Vector3(0.9, 1, 0.9)
	cage_root.add_child(lt)
	fixed.litter = lt
	leftovers_root = Node3D.new()
	leftovers_root.position = Vector3(3.6, 0, 2.3)
	cage_root.add_child(leftovers_root)
	_build_dedication_plaque()

func plaque_world_pos() -> Vector3:
	return Vector3(0.0, H * 0.56, -HALF_Z - 0.14)

func _build_dedication_plaque() -> void:
	# Памятная деревянная табличка «Посвящается : Тимме, Жоржу, Васе, Элвину»
	# Закреплена на задней стенке клетки в тёплой дубовой рамке — всегда видна и кликабельна!
	var plaque_root := Node3D.new()
	plaque_root.position = plaque_world_pos()
	cage_root.add_child(plaque_root)

	var pw := 3.9
	var ph := 3.08
	var wood_frame := Items3D.mat(Color(0.76, 0.58, 0.38), 0.65, "wood")
	Items3D.box(plaque_root, Vector3(pw + 0.24, ph + 0.24, 0.14), wood_frame, Vector3(0, 0, -0.08))

	var tex := load("res://assets/ui/dedication_plaque.png") as Texture2D
	if tex:
		var face := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(pw, ph)
		face.mesh = qm
		var fm := StandardMaterial3D.new()
		fm.albedo_texture = tex
		fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		fm.roughness = 0.55
		fm.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
		face.material_override = fm
		face.position = Vector3(0, 0, 0.01)
		plaque_root.add_child(face)

	# Маленькое латунное крепление сверху рамки
	var brass := Items3D.mat(Color(0.84, 0.68, 0.34), 0.35, "metal")
	Items3D.cyl(plaque_root, 0.08, 0.08, 0.08, brass, Vector3(0, ph * 0.5 + 0.18, -0.05), Vector3(PI / 2.0, 0, 0))

func _multi(parent: Node3D, mesh: Mesh, m: Material, ts: Array) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = ts.size()
	for i in ts.size():
		mm.set_instance_transform(i, ts[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = m
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(mmi)

func _shelf(center: Vector3, size: Vector2, wood: Material) -> void:
	Items3D.box(cage_root, Vector3(size.x, 0.16, size.y), wood, center - Vector3(0, 0.08, 0))
	var side := 1.0 if center.x < 0 else -1.0
	Items3D.box(cage_root, Vector3(0.08, 0.3, size.y), wood, center + Vector3(side * size.x / 2, 0.1, 0))

func _ramp(a: Vector3, b: Vector3, wood: Material) -> void:
	var mid := (a + b) / 2.0
	var len := a.distance_to(b)
	var dir := (b - a).normalized()
	var r := Node3D.new()
	r.position = mid
	cage_root.add_child(r)
	r.basis = Basis.looking_at(dir, Vector3.UP)
	Items3D.box(r, Vector3(0.95, 0.1, len + 0.3), wood, Vector3(0, -0.05, 0))
	var n := int(len / 0.45)
	for i in n:
		Items3D.box(r, Vector3(0.9, 0.06, 0.06), wood, Vector3(0, 0.02, -len / 2 + (i + 0.5) * len / n))
	for sx in [-0.5, 0.5]:
		Items3D.box(r, Vector3(0.05, 0.22, len + 0.3), wood, Vector3(sx, 0.08, 0))

# ---------------------- манеж ----------------------
func _build_pen() -> void:
	var panel := Items3D.mat(Color(0.56, 0.66, 0.58), 0.6)
	var mat_floor := Items3D.mat(Color(0.93, 0.89, 0.8), 0.95, "fabric")
	var mf := Items3D.cyl(pen_root, 5.9, 5.9, 0.06, mat_floor, PEN_C + Vector3(0, -0.02, 0), Vector3.ZERO, 8)
	mf.rotation.y = PI / 8
	for i in 8:
		var a := TAU * i / 8.0
		var a2 := TAU * (i + 1) / 8.0
		var p1 := Vector3(cos(a), 0, sin(a)) * 6.0
		var p2 := Vector3(cos(a2), 0, sin(a2)) * 6.0
		var mid := (p1 + p2) / 2.0
		var w := Node3D.new()
		w.position = PEN_C + mid + Vector3(0, 0.8, 0)
		pen_root.add_child(w)
		w.basis = Basis.looking_at((p2 - p1).normalized().cross(Vector3.UP), Vector3.UP)
		var tr := Items3D.mat(Color(0.56, 0.66, 0.58, 0.55 if mid.z > 0 else 1.0), 0.6)
		Items3D.box(w, Vector3(p1.distance_to(p2), 1.6, 0.08), tr if mid.z > 0 else panel)

# ---------------------- предметы ----------------------
func _build_items() -> void:
	for area in ["cage", "pen"]:
		var d: Dictionary = Game.placed_dict(area) if (area == "cage" or bool(Game.state.playpen)) else {}
		for sid in d:
			if not slots.has(sid):
				continue
			var s: Dictionary = slots[sid]
			var info: Dictionary = d[sid]
			var hang_up: float = float(s.attach) - s.pos.y if s.type == "hang" else 3.0
			var n := Items3D.make(info.item, int(info.color), hang_up)
			n.position = s.pos
			n.rotation.y = float(s.rot) + int(info.get("rot", 0)) * PI / 2
			items_root.add_child(n)
			item_nodes[sid] = n
			if n.has_meta("spinner"):
				_spinners[sid] = n.get_meta("spinner")

func refresh_state_visuals() -> void:
	if fixed.is_empty():
		return
	var c: Dictionary = Game.state.cage
	Items3D.update_bowl(fixed.bowl, float(c.bowl.pellets), int(c.bowl.veg), int(c.bowl.fruit))
	Items3D.update_bottle(fixed.bottle, float(c.water.level))
	if litter_mat:
		litter_mat.set_shader_parameter("dirt", clampf(1.0 - float(c.clean.litter) / 100.0, 0.0, 1.0) * 0.8)
	var fill: MeshInstance3D = fixed.litter.get_node("fill")
	fill.material_override = Items3D.mat(Color(0.93, 0.9, 0.82).lerp(Color(0.8, 0.76, 0.66), 1.0 - float(c.clean.tray) / 100.0), 0.95)
	# остатки еды — аккуратные кусочки, без натурализма
	for ch in leftovers_root.get_children():
		ch.queue_free()
	for i in int(c.leftovers):
		Items3D.sph(leftovers_root, Vector3(0.1, 0.06, 0.1), Items3D.mat(Color(0.6, 0.55, 0.3)), Vector3(i * 0.3 - 0.3, 0.06, 0))

func spin(slot_id: String, delta: float) -> void:
	if _spinners.has(slot_id):
		_spinners[slot_id].rotation.z += delta * 4.0

# ---------------------- тема ----------------------
func _apply_theme() -> void:
	var id: String = Game.state.theme
	var th: Dictionary = Data.THEMES.get(id, Data.THEMES.scandi)
	bg_rect.modulate = th.tint
	bg_stars.visible = id == "space"
	bg_rect.visible = id != "space"
	env.ambient_light_color = th.ambient
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	match id:
		"forest":
			for i in 7:
				var p := Vector3(rng.randf_range(-12, 12), FLOOR_Y, rng.randf_range(-7, -4.5))
				var h := rng.randf_range(2.0, 4.0)
				Items3D.cyl(theme_root, 0.0, h * 0.35, h, Items3D.mat(Color(0.35, 0.55, 0.32)), p + Vector3(0, h / 2 + 0.6, 0))
				Items3D.cyl(theme_root, 0.12, 0.12, 0.6, Items3D.mat(Color(0.45, 0.32, 0.2)), p + Vector3(0, 0.3, 0))
			for i in 6:
				var q := Vector3(rng.randf_range(-10, 10), FLOOR_Y, rng.randf_range(4.0, 6.0))
				Items3D.cyl(theme_root, 0.06, 0.08, 0.3, Items3D.mat(Color(0.95, 0.92, 0.85)), q + Vector3(0, 0.15, 0))
				Items3D.sph(theme_root, Vector3(0.25, 0.13, 0.25), Items3D.mat(Color(0.85, 0.35, 0.28)), q + Vector3(0, 0.32, 0))
		"pastel":
			for i in 8:
				var p2 := Vector3(rng.randf_range(-12, 12), rng.randf_range(4, 12), rng.randf_range(-8, -5))
				var col: Color = [Color(1, 0.8, 0.88), Color(0.8, 0.92, 1), Color(0.86, 1, 0.88), Color(1, 0.95, 0.75)][i % 4]
				Items3D.sph(theme_root, Vector3(0.6, 0.35, 0.3), Items3D.mat(col), p2)
		"space":
			Items3D.sph(theme_root, Vector3.ONE * 2.2, Items3D.mat(Color(0.85, 0.6, 0.45)), Vector3(-11, 9, -9))
			Items3D.torus(theme_root, 2.8, 3.4, Items3D.mat(Color(0.9, 0.82, 0.6)), Vector3(-11, 9, -9), Vector3(0.4, 0, 0.3))
			Items3D.sph(theme_root, Vector3.ONE * 1.2, Items3D.mat(Color(0.5, 0.7, 0.95)), Vector3(12, 12, -8))
		"city":
			for i in 9:
				var p3 := Vector3(-13 + i * 3.2, FLOOR_Y, rng.randf_range(-8, -6))
				var hh := rng.randf_range(2, 6)
				var b := Items3D.box(theme_root, Vector3(2.4, hh, 2.0), Items3D.mat([Color(0.85, 0.8, 0.72), Color(0.72, 0.78, 0.86), Color(0.9, 0.75, 0.7)][i % 3]), p3 + Vector3(0, hh / 2, 0))
				for k in int(hh / 1.2):
					Items3D.box(b, Vector3(1.6, 0.4, 0.05), Items3D.mat(Color(1, 0.92, 0.6)), Vector3(0, -hh / 2 + 0.8 + k * 1.2, 1.01))
		"autumn":
			for i in 30:
				var p4 := Vector3(rng.randf_range(-11, 11), FLOOR_Y + 0.05, rng.randf_range(3.6, 7))
				var lc: Color = [Color(0.9, 0.5, 0.2), Color(0.8, 0.3, 0.15), Color(0.95, 0.75, 0.3)][i % 3]
				Items3D.box(theme_root, Vector3(0.35, 0.02, 0.22), Items3D.mat(lc), p4, Vector3(0, rng.randf() * 3, 0))
			for x in [-9.0, 9.5]:
				Items3D.sph(theme_root, Vector3(0.9, 0.7, 0.9), Items3D.mat(Color(0.92, 0.5, 0.15)), Vector3(x, FLOOR_Y + 0.7, 5))

# ---------------------- маркеры обустройства ----------------------
func show_markers(on: bool, item_id := "") -> void:
	markers_root.visible = on
	for c in markers_root.get_children():
		c.queue_free()
	if not on:
		return
	for sid in slots:
		var s: Dictionary = slots[sid]
		var ok := item_id == "" or bool(can_place(item_id, sid).ok)
		var col := Color(0.4, 0.85, 0.5, 0.45) if ok else Color(0.9, 0.4, 0.35, 0.25)
		if slot_item(sid) != "":
			col = Color(0.95, 0.8, 0.3, 0.45) if ok else Color(0.9, 0.4, 0.35, 0.25)
		var m := Items3D.mat(col, 1.0)
		var p: Vector3 = s.pos + Vector3(0, 0.06, 0)
		var disc := Items3D.cyl(markers_root, 0.9, 0.9, 0.04, m, p)
		disc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		disc.set_meta("slot", sid)

func slot_screen_positions(cam: Camera3D, area_filter := "") -> Dictionary:
	var out := {}
	for sid in slots:
		if area_filter != "" and slots[sid].area != area_filter:
			continue
		var p: Vector3 = slots[sid].pos + Vector3(0, 0.4, 0)
		if cam.is_position_behind(p):
			continue
		out[sid] = cam.unproject_position(p)
	return out

# ---------------------- рука ----------------------
func show_hand(at: Vector3, on := true) -> void:
	_hand_visible = on
	_hand_target = at
	if on and not hand.visible:
		hand.position = at + Vector3(0, 2.0, 2.5)
		hand.visible = true

func _process(delta: float) -> void:
	if hand.visible:
		var tgt := _hand_target if _hand_visible else _hand_target + Vector3(0, 2.5, 3.0)
		hand.position = hand.position.lerp(tgt, 1.0 - exp(-5.0 * delta))
		hand.rotation.y = 0.0
		if not _hand_visible and hand.position.distance_to(tgt) < 0.3:
			hand.visible = false
