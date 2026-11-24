class_name RatModel
extends Node3D
## Новая 3D-модель декоративной крысы на базе скульптурных мешей из Blender 5.2
## с процедурным шейдером шерсти, мягкой оболочкой, ушками стандарт/дамбо,
## подвижными усиками и инерционным 14-сегментным хвостом.

static var _mesh_torso: Mesh
static var _mesh_head: Mesh
static var _mesh_ear_std: Mesh
static var _mesh_ear_dumbo: Mesh
static var _mesh_arm: Mesh
static var _mesh_thigh: Mesh
static var _mesh_front_paw: Mesh
static var _mesh_hind_paw: Mesh
static var _sphere: SphereMesh
static var _sphere_lo: SphereMesh
static var _fur_shader: Shader
static var _skin_shader: Shader
static var _tail_meshes: Array = []
static var _whisker_mesh: CapsuleMesh
static var _blob_mat: StandardMaterial3D
static var _eye_hi_mat: StandardMaterial3D

const SP := Vector3(0.0, 0.12, 0.58)        # опора корпуса (таз/седалище)
const NECK := Vector3(0.0, 0.62, -0.72)     # шея
const TAIL_ROOT := Vector3(0.0, 0.36, 0.90) # корень хвоста
const TAIL_N := 14
const TAIL_SEG := 0.155
const TAIL_REST := [0.46, 0.36, 0.12, -0.32, -0.42, -0.06, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

var app: Dictionary = {}
var fur_mats: Array[ShaderMaterial] = []
var skin_mat: ShaderMaterial
var tail_mat: ShaderMaterial
var ear_mat: ShaderMaterial

var spine: Node3D
var head: Node3D
var torso_mesh: MeshInstance3D
var head_mesh: MeshInstance3D
var nose_mesh: MeshInstance3D
var shells: Array[MeshInstance3D] = []
var front_paws: Array[Node3D] = []
var hind_paws: Array[Node3D] = []
var arms: Array[Node3D] = []
var thighs: Array[Node3D] = []
var ears: Array[Node3D] = []
var eyes: Array[Node3D] = []
var whiskers: Array[Node3D] = []
var tail: Array[Node3D] = []
var tail_yaw_vel: Array[float] = []
var mouth: Node3D
var hands: Node3D
var held: Node3D
var blob: MeshInstance3D

var _front_rest: Array[Vector3] = []
var _hind_rest: Array[Vector3] = []

## Целевые и текущие параметры позы (интерполируются плавно без рывков)
var pose := {
	"rear": 0.0, "curl": 0.0, "paws_up": 0.0, "groom": 0.0, "chew": 0.0,
	"eyes": 1.0, "head_yaw": 0.0, "head_pitch": 0.0, "sniff": 0.35,
	"walk": 0.0, "crouch": 0.0, "puff": 0.0, "lean": 0.0, "reach": 0.0,
	"box": 0.0, "relax": 0.0, "hammock": 0.0,
}
var target := pose.duplicate()
var phase := 0.0
var t := 0.0
var walk_rate := 0.0
var turn_rate := 0.0
var blend_speed := 6.5
var reduced_motion := false
var shells_on := true

static func _load_obj(path: String, fallback: Mesh) -> Mesh:
	if ResourceLoader.exists(path):
		var res := load(path)
		if res is Mesh:
			return res
	return fallback

static func _init_static() -> void:
	if _sphere:
		return
	_sphere = SphereMesh.new()
	_sphere.radius = 1.0
	_sphere.height = 2.0
	_sphere.radial_segments = 18
	_sphere.rings = 10
	_sphere_lo = SphereMesh.new()
	_sphere_lo.radius = 1.0
	_sphere_lo.height = 2.0
	_sphere_lo.radial_segments = 10
	_sphere_lo.rings = 6

	_mesh_torso = _load_obj("res://assets/models/rat_torso.obj", _sphere)
	_mesh_head = _load_obj("res://assets/models/rat_head.obj", _sphere)
	_mesh_ear_std = _load_obj("res://assets/models/rat_ear_standard.obj", _sphere_lo)
	_mesh_ear_dumbo = _load_obj("res://assets/models/rat_ear_dumbo.obj", _sphere_lo)
	_mesh_arm = _load_obj("res://assets/models/rat_front_arm.obj", _sphere_lo)
	_mesh_thigh = _load_obj("res://assets/models/rat_hind_thigh.obj", _sphere_lo)
	_mesh_front_paw = _load_obj("res://assets/models/rat_front_paw.obj", _sphere_lo)
	_mesh_hind_paw = _load_obj("res://assets/models/rat_hind_paw.obj", _sphere_lo)

	_fur_shader = load("res://shaders/fur.gdshader")
	_skin_shader = load("res://shaders/skin.gdshader")

	for i in TAIL_N:
		var cm := CylinderMesh.new()
		cm.bottom_radius = _tail_r(i)
		cm.top_radius = _tail_r(i + 1)
		cm.height = TAIL_SEG * 1.12
		cm.radial_segments = 8
		cm.rings = 1
		cm.cap_top = (i == TAIL_N - 1)
		cm.cap_bottom = false
		_tail_meshes.append(cm)

	_whisker_mesh = CapsuleMesh.new()
	_whisker_mesh.radius = 0.0028
	_whisker_mesh.height = 0.56
	_whisker_mesh.radial_segments = 4
	_whisker_mesh.rings = 1

	_blob_mat = StandardMaterial3D.new()
	_blob_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_blob_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var g := Gradient.new()
	g.set_color(0, Color(0.11, 0.07, 0.05, 0.36))
	g.set_color(1, Color(0.11, 0.07, 0.05, 0.0))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 64
	gt.height = 64
	_blob_mat.albedo_texture = gt

	_eye_hi_mat = StandardMaterial3D.new()
	_eye_hi_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_eye_hi_mat.albedo_color = Color(1, 1, 1, 0.94)

static func _tail_r(i: int) -> float:
	return lerpf(0.076, 0.015, float(i) / TAIL_N)

# ---------------------------------------------------------------------
func build(appearance: Dictionary) -> void:
	_init_static()
	app = appearance.duplicate()
	for c in get_children():
		c.queue_free()
	fur_mats.clear()
	shells.clear()
	front_paws.clear()
	hind_paws.clear()
	arms.clear()
	thighs.clear()
	ears.clear()
	eyes.clear()
	whiskers.clear()
	tail.clear()
	tail_yaw_vel.clear()
	_front_rest.clear()
	_hind_rest.clear()

	var base_c: Color = Data.COLORS.get(app.get("base", "gray"), Color.GRAY)
	var pat := int(app.get("pattern", 0))
	var dark: bool = (base_c.v < 0.38 and pat in [0, 1, 5]) or pat == 9
	var skin := Color(0.95, 0.72, 0.70)
	if dark:
		skin = Color(0.72, 0.56, 0.56) if pat != 9 else Color(0.60, 0.45, 0.43)
	elif pat == 10:
		skin = Color(0.84, 0.68, 0.65)

	skin_mat = ShaderMaterial.new()
	skin_mat.shader = _skin_shader
	skin_mat.set_shader_parameter("skin_col", skin)

	ear_mat = ShaderMaterial.new()
	ear_mat.shader = _skin_shader
	ear_mat.set_shader_parameter("skin_col", skin.lerp(Color(0.98, 0.66, 0.68), 0.35) if not dark else skin.lightened(0.08))

	tail_mat = ShaderMaterial.new()
	tail_mat.shader = _skin_shader
	tail_mat.set_shader_parameter("skin_col", skin.lerp(Color(0.86, 0.71, 0.69), 0.22) if pat != 9 else skin.darkened(0.12))
	tail_mat.set_shader_parameter("rings", 1.0)

	# Мягкая контактная тень под крыской
	blob = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1.55, 2.55)
	q.orientation = PlaneMesh.FACE_Y
	blob.mesh = q
	blob.material_override = _blob_mat
	blob.position = Vector3(0, 0.014, -0.05)
	blob.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(blob)

	# 1. Цельный скульптурный корпус из Blender (SP-локальные координаты)
	spine = Node3D.new()
	spine.position = SP
	add_child(spine)

	torso_mesh = _attach_sculpted_fur(spine, _mesh_torso, SP, Vector3.ONE, true)

	# 2. Конечности и лапки из Blender
	for s in [-1.0, 1.0]:
		# Заднее пушистое бедро
		var thigh_piv := Node3D.new()
		thigh_piv.position = Vector3(0.32 * s, 0.34, 0.36) - SP
		spine.add_child(thigh_piv)
		_attach_sculpted_fur(thigh_piv, _mesh_thigh, Vector3(0.32 * s, 0.34, 0.36), Vector3.ONE, false)
		thighs.append(thigh_piv)

		# Передняя лапка (предплечье + кисть с пальчиками)
		var arm_piv := Node3D.new()
		arm_piv.position = Vector3(0.20 * s, 0.28, -0.58) - SP
		spine.add_child(arm_piv)
		_attach_sculpted_fur(arm_piv, _mesh_arm, Vector3(0.20 * s, 0.28, -0.58), Vector3.ONE, false)
		arms.append(arm_piv)

		var fp := Node3D.new()
		var frest := Vector3(0.19 * s, 0.042, -0.68)
		fp.position = frest - SP
		spine.add_child(fp)
		var fm := MeshInstance3D.new()
		fm.mesh = _mesh_front_paw
		fm.material_override = skin_mat
		fp.add_child(fm)
		front_paws.append(fp)
		_front_rest.append(frest - SP)

		var hp := Node3D.new()
		var hrest := Vector3(0.28 * s, 0.036, 0.42)
		hp.position = hrest
		add_child(hp)
		var hm := MeshInstance3D.new()
		hm.mesh = _mesh_hind_paw
		hm.material_override = skin_mat
		if s < 0.0:
			hm.scale.x = -1.0
		hp.add_child(hm)
		hind_paws.append(hp)
		_hind_rest.append(hrest)

	# 3. Цельная скульптурная голова из Blender (NECK-локальные координаты)
	head = Node3D.new()
	head.position = NECK - SP
	spine.add_child(head)

	head_mesh = _attach_sculpted_fur(head, _mesh_head, NECK, Vector3.ONE, true)

	# Подвижный аккуратный носик
	nose_mesh = MeshInstance3D.new()
	nose_mesh.mesh = _sphere_lo
	nose_mesh.scale = Vector3(0.048, 0.040, 0.038)
	nose_mesh.position = Vector3(0, 0.592, -1.485) - NECK
	var nose_mat := ShaderMaterial.new()
	nose_mat.shader = _skin_shader
	nose_mat.set_shader_parameter("skin_col", Color(0.96, 0.62, 0.66) if not dark else Color(0.68, 0.48, 0.50))
	nose_mesh.material_override = nose_mat
	head.add_child(nose_mesh)

	# Естественные бусинки-глаза с живым бликом (БЕЗ мультяшных огромных глаз)
	var eye_key: String = app.get("eye", "black")
	var eye_col: Color = Data.EYES.get(eye_key, Data.EYES.black).color
	var eye_m := StandardMaterial3D.new()
	eye_m.albedo_color = eye_col
	eye_m.roughness = 0.07
	eye_m.metallic_specular = 0.92
	if eye_key in ["ruby", "red"]:
		eye_m.emission_enabled = true
		eye_m.emission = eye_col
		eye_m.emission_energy_multiplier = 0.28 if eye_key == "red" else 0.12

	var dumbo: bool = app.get("ears", "normal") == "dumbo"
	var is_rex: bool = bool(app.get("rex", false))

	for s in [-1.0, 1.0]:
		var ep := Node3D.new()
		ep.position = Vector3(0.205 * s, 0.725, -1.135) - NECK
		ep.rotation = Vector3(0.0, 0.56 * s, 0.0)
		head.add_child(ep)

		var e := MeshInstance3D.new()
		e.mesh = _sphere
		e.scale = Vector3(0.056, 0.054, 0.052)
		e.material_override = eye_m
		ep.add_child(e)

		var hi := MeshInstance3D.new()
		hi.mesh = _sphere_lo
		hi.scale = Vector3.ONE * 0.0135
		hi.position = Vector3(-0.012 * s, 0.025, -0.048)
		hi.material_override = _eye_hi_mat
		hi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		ep.add_child(hi)

		eyes.append(ep)

		# Скульптурные чашеобразные ушки из Blender (Стандарт или Дамбо)
		var er := Node3D.new()
		if dumbo:
			er.position = Vector3(0.255 * s, 0.725, -0.90) - NECK
			er.rotation = Vector3(-0.12, 1.12 * s, 0.34 * s)
		else:
			er.position = Vector3(0.165 * s, 0.875, -0.87) - NECK
			er.rotation = Vector3(-0.26, 0.42 * s, 0.24 * s)
		head.add_child(er)

		var ear_mi := MeshInstance3D.new()
		ear_mi.mesh = _mesh_ear_dumbo if dumbo else _mesh_ear_std
		ear_mi.material_override = ear_mat
		ear_mi.scale.x = s
		er.add_child(ear_mi)
		ears.append(er)

		# 6 тонких вибрисс (усиков) с каждой стороны (у рекса слегка завитые)
		var wm := StandardMaterial3D.new()
		wm.albedo_color = Color(0.93, 0.90, 0.86) if not dark else Color(0.45, 0.43, 0.42)
		wm.roughness = 0.45
		for k in 6:
			var wp := Node3D.new()
			var row_y := 0.585 - 0.011 * float(k % 3)
			var row_z := -1.34 - 0.025 * float(k / 3)
			wp.position = Vector3(0.105 * s, row_y, row_z) - NECK
			wp.rotation = Vector3(0.14 - 0.09 * float(k % 3), (0.95 + 0.10 * float(k)) * s, 0.0)
			head.add_child(wp)

			var w := MeshInstance3D.new()
			w.mesh = _whisker_mesh
			w.rotation.x = PI / 2.0
			w.position = Vector3(0, 0, -0.26)
			if is_rex:
				w.rotation.z = 0.24 * s * (1.0 if k % 2 == 0 else -1.0)
				w.scale = Vector3(1.1, 0.78, 1.1)
			w.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			w.material_override = wm
			wp.add_child(w)
			whiskers.append(wp)

	# Точки крепления лакомств и бумаги
	mouth = Node3D.new()
	mouth.position = Vector3(0, 0.52, -1.40) - NECK
	head.add_child(mouth)
	hands = Node3D.new()
	hands.position = Vector3(0, 0.48, -1.00) - SP
	spine.add_child(hands)

	# 4. Инерционный 14-сегментный гибкий хвост
	var parent: Node3D = self
	for i in TAIL_N:
		var seg := Node3D.new()
		seg.position = TAIL_ROOT if i == 0 else Vector3(0, 0, TAIL_SEG)
		parent.add_child(seg)
		var m := MeshInstance3D.new()
		m.mesh = _tail_meshes[i]
		m.rotation.x = PI / 2.0
		m.position = Vector3(0, 0, TAIL_SEG * 0.5)
		m.material_override = tail_mat
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if i < 7 else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		seg.add_child(m)
		tail.append(seg)
		tail_yaw_vel.append(0.0)
		parent = seg

	set_shells(shells_on)
	_apply(0.016)

func _make_fur_material(origin_offset: Vector3, scale_v: Vector3, shell_thickness := 0.0) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = _fur_shader
	mat.set_shader_parameter("pattern", int(app.get("pattern", 0)))
	mat.set_shader_parameter("base_col", Data.COLORS.get(app.get("base", "gray"), Color.GRAY))
	mat.set_shader_parameter("mark_col", Data.COLORS.get(app.get("mark", "gray"), Color.GRAY))
	mat.set_shader_parameter("white_col", Data.WHITE)
	mat.set_shader_parameter("part_origin", origin_offset)
	mat.set_shader_parameter("part_scale", scale_v)
	mat.set_shader_parameter("rex", 1.0 if bool(app.get("rex", false)) else 0.0)
	mat.set_shader_parameter("ticking", float(app.get("ticking", 0.0)))
	mat.set_shader_parameter("silver", float(app.get("silver", 0.0)))
	mat.set_shader_parameter("seed", float(app.get("seed", 0.3)))
	mat.set_shader_parameter("shell", shell_thickness)
	fur_mats.append(mat)
	return mat

func _attach_sculpted_fur(parent: Node3D, mesh: Mesh, origin_offset: Vector3, scale_v: Vector3, with_shell: bool) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _make_fur_material(origin_offset, scale_v, 0.0)
	parent.add_child(mi)

	if with_shell:
		var thickness := 0.062 if bool(app.get("rex", false)) else 0.036
		var sh := MeshInstance3D.new()
		sh.mesh = mesh
		sh.material_override = _make_fur_material(origin_offset, scale_v, thickness)
		sh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.add_child(sh)
		shells.append(sh)
	return mi

func set_shells(on: bool) -> void:
	shells_on = on
	for s in shells:
		if is_instance_valid(s):
			s.visible = on

func set_highlight(v: float) -> void:
	for m in fur_mats:
		m.set_shader_parameter("highlight", v)

func set_dirt(v: float) -> void:
	for m in fur_mats:
		m.set_shader_parameter("dirt", v)

func set_blob(v: bool) -> void:
	if blob:
		blob.visible = v

func set_turn_rate(rate: float) -> void:
	turn_rate = clampf(rate, -4.5, 4.5)

## Предмет в лапках (еда) или во рту (бумага, мячик)
func hold(kind: String, in_mouth := false) -> void:
	drop_held()
	if kind == "":
		return
	held = Node3D.new()
	var m := MeshInstance3D.new()
	var mat := StandardMaterial3D.new()
	mat.roughness = 0.8
	match kind:
		"pellets":
			var b := BoxMesh.new(); b.size = Vector3(0.11, 0.08, 0.12); m.mesh = b; mat.albedo_color = Color(0.56, 0.39, 0.24)
		"veg":
			var c := CylinderMesh.new(); c.top_radius = 0.04; c.bottom_radius = 0.06; c.height = 0.19; m.mesh = c; m.rotation.z = 1.2; mat.albedo_color = Color(0.95, 0.52, 0.16)
		"fruit":
			var s := SphereMesh.new(); s.radius = 0.07; s.height = 0.14; m.mesh = s; mat.albedo_color = Color(0.32, 0.36, 0.78)
		"treat":
			var s2 := SphereMesh.new(); s2.radius = 0.058; s2.height = 0.116; m.mesh = s2; mat.albedo_color = Color(0.98, 0.93, 0.80)
		"paper":
			var b2 := BoxMesh.new(); b2.size = Vector3(0.38, 0.028, 0.13); m.mesh = b2; mat.albedo_color = Color(0.98, 0.96, 0.91); m.rotation = Vector3(0.25, 0.35, 0.45)
		"ball":
			var s3 := SphereMesh.new(); s3.radius = 0.13; s3.height = 0.26; m.mesh = s3; mat.albedo_color = Color(0.89, 0.78, 0.60)
		_:
			var b3 := BoxMesh.new(); b3.size = Vector3(0.08, 0.08, 0.08); m.mesh = b3; mat.albedo_color = Color(0.6, 0.45, 0.3)
	m.material_override = mat
	held.add_child(m)
	(mouth if in_mouth else hands).add_child(held)
	if in_mouth:
		held.position = Vector3(0, -0.04, -0.05)

func drop_held() -> void:
	if held and is_instance_valid(held):
		held.queue_free()
	held = null

func set_anim_targets(d: Dictionary) -> void:
	for k in pose:
		target[k] = float(d.get(k, _default(k)))

func _default(k: String) -> float:
	match k:
		"eyes": return 1.0
		"sniff": return 0.35
	return 0.0

func _process(delta: float) -> void:
	if spine == null:
		return
	var dt := minf(delta, 0.05)
	t += dt
	var k := 1.0 - exp(-blend_speed * dt)
	for key in pose:
		pose[key] = lerpf(pose[key], target[key], k)
	phase += walk_rate * dt
	_apply(dt)

func _apply(dt: float) -> void:
	var rm := 0.35 if reduced_motion else 1.0
	var rear: float = pose.rear
	var curl: float = pose.curl
	var walk: float = pose.walk
	var relax: float = pose.relax
	var hammock: float = pose.hammock
	var breath := sin(t * TAU * (0.52 if curl > 0.5 else 1.25)) * (0.026 if curl > 0.5 else 0.013)

	# 1. Плавное движение корпуса и дыхание
	var bob := absf(sin(phase)) * 0.036 * walk
	spine.position = SP + Vector3(0, bob - 0.065 * curl - 0.055 * pose.crouch - 0.03 * relax, 0.0)
	spine.rotation = Vector3(
		rear * 0.96 + pose.box * 0.16 * sin(t * 9.5) - 0.06 * curl + 0.06 * pose.lean,
		sin(phase * 0.5) * 0.055 * walk - turn_rate * 0.07,
		sin(phase) * 0.032 * walk + 0.22 * pose.puff * sin(t * 3.0) * 0.3
	)
	if torso_mesh:
		torso_mesh.scale = Vector3(
			1.0 + 0.10 * curl + 0.07 * pose.puff + 0.04 * relax,
			1.0 - 0.11 * curl + breath + 0.05 * pose.puff - 0.05 * relax,
			1.0 - 0.10 * curl
		)

	# 2. Голова, носик и поскрипывание зубками (bruxing) при поглаживании
	var sniff_n: float = pose.sniff * rm
	var brux := sin(t * 34.0) * 0.012 * relax * rm
	var hp: float = pose.head_pitch - rear * 0.82 + sin(t * 17.0) * 0.024 * sniff_n + pose.groom * (0.34 + 0.14 * sin(t * 7.5)) + brux
	var hy: float = pose.head_yaw + curl * 1.18 + pose.groom * 0.24 * sin(t * 3.2) - turn_rate * 0.09
	head.rotation = Vector3(hp + 0.42 * curl, hy, 0.14 * curl + pose.groom * 0.11 * sin(t * 4.2) + sin(t * 3.0) * 0.08 * relax)
	head.position = NECK - SP + Vector3(0, -0.09 * curl, -0.11 * pose.reach + 0.07 * curl)

	if nose_mesh:
		nose_mesh.position.y = (0.592 - NECK.y) + sin(t * 21.0) * 0.008 * sniff_n

	# 3. Моргание и уютное жмурение глаз
	var blink := 1.0
	if fmod(t + float(get_instance_id() % 97) * 0.13, 4.1) < 0.13:
		blink = 0.12
	var eo: float = clampf(pose.eyes * blink * (1.0 - 0.65 * relax), 0.08, 1.0)
	for e in eyes:
		e.scale = Vector3(1.0, eo, 1.0)

	# 4. Живые движения ушек
	var dumbo: bool = app.get("ears", "normal") == "dumbo"
	var base_ez := 0.34 if dumbo else 0.24
	for i in ears.size():
		var s := -1.0 if i == 0 else 1.0
		var twitch := sin(t * 2.4 + i * 1.7) * 0.045 * rm
		ears[i].rotation.z = (base_ez - 0.18 * relax) * s + twitch

	# 5. Постоянное живое подёргивание усиков
	var half_w := whiskers.size() / 2
	for i in whiskers.size():
		var w := whiskers[i]
		var s2 := -1.0 if i < half_w else 1.0
		var idx := i % half_w
		w.rotation.y = (0.95 + 0.10 * float(idx)) * s2 + sin(t * (16.0 + float(idx) * 1.3)) * 0.13 * sniff_n * s2

	# 6. Передние и задние лапки
	var up: float = maxf(pose.paws_up, pose.groom)
	for i in front_paws.size():
		var s := -1.0 if i == 0 else 1.0
		var rest := _front_rest[i]
		var step := Vector3(0, maxf(0.0, cos(phase + PI * i)) * 0.075 * walk, sin(phase + PI * i) * 0.13 * walk)
		var mouth_p := Vector3(0.075 * s, 0.45 - 0.12 * rear, -0.98 - 0.08 * rear) - SP
		mouth_p += Vector3(0, sin(t * 8.5 + i * PI) * 0.032 * pose.groom + sin(t * 11.0) * 0.012 * pose.chew, 0)
		var box_p := Vector3(0.12 * s, 0.60, -0.95) - SP + Vector3(0, sin(t * 9.5 + i * 2.0) * 0.065, sin(t * 9.5 + i * 2.0) * 0.06) * pose.box
		var p := rest + step
		p = p.lerp(mouth_p, up)
		p = p.lerp(box_p, pose.box)
		p.y -= 0.05 * curl
		front_paws[i].position = p
		front_paws[i].rotation.x = -0.95 * up

		arms[i].position = (Vector3(0.20 * s, 0.28, -0.58) - SP).lerp(Vector3(0.11 * s, 0.40, -0.84) - SP, up)
		arms[i].rotation.x = -0.65 * up + sin(phase + PI * i) * 0.25 * walk

		var hs := Vector3(0, maxf(0.0, cos(phase + PI * (1 - i))) * 0.065 * walk, sin(phase + PI * (1 - i)) * 0.15 * walk)
		hind_paws[i].position = _hind_rest[i] + hs + Vector3(-0.055 * s * curl + 0.035 * s * rear, 0, -0.09 * curl + 0.12 * rear)
		thighs[i].rotation.x = sin(phase + PI * (1 - i)) * 0.22 * walk - 0.15 * rear

	hands.position = Vector3(0, 0.47 - 0.10 * rear, -1.02 - 0.06 * rear) - SP

	# 7. Инерционный хвост (реагирует на повороты, сон клубочком и свешивается с гамака!)
	var tail_drive := clampf(-turn_rate * 0.18, -0.42, 0.42)
	for i in tail.size():
		var seg := tail[i]
		var target_yaw := tail_drive if i == 0 else tail_yaw_vel[i - 1] * 0.90
		var sway := sin(t * 1.5 - float(i) * 0.42) * (0.045 + 0.08 * walk) * rm
		var stiffness := clampf(dt * (8.5 - float(i) * 0.32), 0.04, 0.45)
		tail_yaw_vel[i] = lerpf(tail_yaw_vel[i], target_yaw, stiffness)

		var rest_pitch: float = TAIL_REST[i]
		if i < 3:
			rest_pitch -= rear * 0.26
		if hammock > 0.4:
			# В гамаке хвостик уютно свешивается вниз!
			rest_pitch = lerpf(rest_pitch, -0.18 if i > 2 else 0.15, hammock)

		var yaw_val := tail_yaw_vel[i] + sway + curl * (1.0 - hammock * 0.85) * (0.32 if i > 1 else 0.58)
		seg.rotation = Vector3(rest_pitch * (1.0 - 0.55 * curl * (1.0 - hammock)) + pose.puff * 0.05, yaw_val, 0.0)

	if held:
		held.position = Vector3(0, sin(t * 10.5) * 0.012 * pose.chew, 0) if held.get_parent() == hands else held.position
