class_name RatModel
extends Node3D
## 3D-модель декоративной крысы v2 на базе единого рига rat_rigged.glb из Blender 5.2
## с UV-привязанным шейдером шерсти для всех 21 окрасов, переключаемыми ушками Стандарт/Дамбо
## и 6 плавными скелетными анимациями (включая Eat_Nibble — кормление из лапок).

const RIG_PATH := "res://assets/models/rat_rigged.glb"
const MODEL_SCALE := 1.26

static var _rig_scene: PackedScene
static var _fur_shader: Shader
static var _skin_shader: Shader
static var _fur_bump_tex: Texture2D
static var _fur_rough_tex: Texture2D
static var _blob_mat: StandardMaterial3D

var app: Dictionary = {}
var rig_root: Node3D
var skeleton: Skeleton3D
var anim_player: AnimationPlayer
var meshes := {}
var fur_mat: ShaderMaterial
var skin_mat: ShaderMaterial
var ear_mat: ShaderMaterial
var tail_mat: ShaderMaterial
var nose_mat: ShaderMaterial
var hands: BoneAttachment3D
var hand_anchor: Node3D
var mouth: BoneAttachment3D
var mouth_anchor: Node3D
var held: Node3D
var blob: MeshInstance3D

var current_clip := ""
var walk_rate := 0.0
var turn_rate := 0.0
var reduced_motion := false
var shells_on := true
var pose := {"eyes": 1.0, "sniff": 0.35}
var target := {"eyes": 1.0, "sniff": 0.35}

static func _init_static() -> void:
	if _rig_scene:
		return
	if ResourceLoader.exists(RIG_PATH):
		_rig_scene = load(RIG_PATH)
	_fur_shader = load("res://shaders/fur_v2.gdshader")
	_skin_shader = load("res://shaders/skin.gdshader")
	if ResourceLoader.exists("res://assets/textures/fur_bump.png"):
		_fur_bump_tex = load("res://assets/textures/fur_bump.png")
	if ResourceLoader.exists("res://assets/textures/fur_roughness.png"):
		_fur_rough_tex = load("res://assets/textures/fur_roughness.png")

	_blob_mat = StandardMaterial3D.new()
	_blob_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_blob_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var g := Gradient.new()
	g.set_color(0, Color(0.11, 0.07, 0.05, 0.34))
	g.set_color(1, Color(0.11, 0.07, 0.05, 0.0))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 64
	gt.height = 64
	_blob_mat.albedo_texture = gt

func build(appearance: Dictionary) -> void:
	_init_static()
	app = appearance.duplicate()
	var prev_clip := current_clip
	current_clip = ""
	for c in get_children():
		remove_child(c)
		c.queue_free()
	meshes.clear()
	skeleton = null
	anim_player = null
	hands = null
	hand_anchor = null
	mouth = null
	mouth_anchor = null
	held = null

	# Мягкая контактная тень под крыской
	blob = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1.45, 2.35)
	q.orientation = PlaneMesh.FACE_Y
	blob.mesh = q
	blob.material_override = _blob_mat
	blob.position = Vector3(0, 0.012, -0.04)
	blob.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(blob)

	if _rig_scene:
		rig_root = _rig_scene.instantiate()
		rig_root.scale = Vector3.ONE * MODEL_SCALE
		add_child(rig_root)
		_collect_nodes(rig_root)

	if skeleton:
		hands = BoneAttachment3D.new()
		hands.bone_name = "front_paw_L"
		skeleton.add_child(hands)
		hand_anchor = Node3D.new()
		hand_anchor.position = Vector3(0.085, 0.035, -0.055)
		hands.add_child(hand_anchor)

		mouth = BoneAttachment3D.new()
		mouth.bone_name = "head"
		skeleton.add_child(mouth)
		mouth_anchor = Node3D.new()
		mouth_anchor.position = Vector3(0.0, 0.36, -0.05)
		mouth.add_child(mouth_anchor)

	_setup_animations()
	_apply_appearance()

	var start_clip := prev_clip if prev_clip != "" else "Idle_Sniff"
	play_clip(start_clip, 1.0, true)

func _collect_nodes(n: Node) -> void:
	if n is Skeleton3D:
		skeleton = n
		skeleton.show_rest_only = false
	elif n is AnimationPlayer:
		anim_player = n
	elif n is MeshInstance3D:
		# Расширяем границу отсечения, чтобы скиннинг-меш крысы НИКОГДА не пропадал при приближении/стойке на Android GLES3!
		n.extra_cull_margin = 8.0
		n.ignore_occlusion_culling = true
		n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		meshes[n.name] = n
	for c in n.get_children():
		_collect_nodes(c)

func _setup_animations() -> void:
	if anim_player == null:
		return
	# Дублируем библиотеку анимаций, чтобы каждая крыска имела независимое состояние зацикливания
	for lib_name in anim_player.get_animation_library_list():
		var orig := anim_player.get_animation_library(lib_name)
		var dup := orig.duplicate(true) as AnimationLibrary
		anim_player.remove_animation_library(lib_name)
		anim_player.add_animation_library(lib_name, dup)
		for anim_name in dup.get_animation_list():
			var anim := dup.get_animation(anim_name)
			if anim:
				anim.loop_mode = Animation.LOOP_LINEAR

func _resolve_clip_name(name_or_short: String) -> String:
	if anim_player == null:
		return ""
	var list := anim_player.get_animation_list()
	if name_or_short in list:
		return name_or_short
	for full in list:
		if full.ends_with(name_or_short) or full.to_lower() == name_or_short.to_lower():
			return full
	return list[0] if not list.is_empty() else ""

func play_clip(clip_name: String, speed := 1.0, immediate := false) -> void:
	if anim_player == null:
		return
	var target_name := _resolve_clip_name(clip_name)
	if target_name == "":
		return
	var eff_speed := (speed * 0.45) if reduced_motion else speed
	if current_clip != target_name or not anim_player.is_playing():
		current_clip = target_name
		anim_player.play(target_name, 0.0 if immediate else 0.22, eff_speed)
	else:
		anim_player.speed_scale = eff_speed

func _apply_appearance() -> void:
	var base_c: Color = Data.COLORS.get(app.get("base", "white"), Data.WHITE)
	var mark_c: Color = Data.COLORS.get(app.get("mark", "gray"), Color.GRAY)
	var pat := int(app.get("pattern", 2))
	var dark: bool = (base_c.v < 0.38 and pat in [0, 1, 5]) or pat == 9
	var skin := Color(0.95, 0.72, 0.70)
	if dark:
		skin = Color(0.72, 0.56, 0.56) if pat != 9 else Color(0.60, 0.45, 0.43)
	elif pat == 10:
		skin = Color(0.84, 0.68, 0.65)

	fur_mat = ShaderMaterial.new()
	fur_mat.shader = _fur_shader
	fur_mat.set_shader_parameter("pattern", pat)
	fur_mat.set_shader_parameter("base_col", base_c)
	fur_mat.set_shader_parameter("mark_col", mark_c)
	fur_mat.set_shader_parameter("white_col", Data.WHITE)
	fur_mat.set_shader_parameter("rex", 1.0 if bool(app.get("rex", false)) else 0.0)
	fur_mat.set_shader_parameter("ticking", float(app.get("ticking", 0.0)))
	fur_mat.set_shader_parameter("silver", float(app.get("silver", 0.0)))
	fur_mat.set_shader_parameter("seed", float(app.get("seed", 0.3)))
	if _fur_bump_tex:
		fur_mat.set_shader_parameter("fur_bump_tex", _fur_bump_tex)
	if _fur_rough_tex:
		fur_mat.set_shader_parameter("fur_rough_tex", _fur_rough_tex)

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

	nose_mat = ShaderMaterial.new()
	nose_mat.shader = _skin_shader
	nose_mat.set_shader_parameter("skin_col", Color(0.96, 0.62, 0.66) if not dark else Color(0.68, 0.48, 0.50))

	# Цвет век подстраивается под окрас головы
	var lid_col := base_c
	if pat in [3, 4, 6, 8]:
		lid_col = mark_c
	elif pat in [2, 7, 10]:
		lid_col = Data.WHITE
	elif pat == 9:
		lid_col = base_c.lerp(mark_c, 0.35)
	var eyelid_mat := StandardMaterial3D.new()
	eyelid_mat.albedo_color = lid_col
	eyelid_mat.roughness = 0.88

	var eye_key: String = app.get("eye", "black")
	var eye_col: Color = Data.EYES.get(eye_key, Data.EYES.black).color
	var eye_mat := StandardMaterial3D.new()
	eye_mat.albedo_color = eye_col
	eye_mat.roughness = 0.14
	eye_mat.metallic_specular = 0.55
	eye_mat.clearcoat_enabled = true
	eye_mat.clearcoat = 0.35
	eye_mat.clearcoat_roughness = 0.12
	if eye_key in ["ruby", "red"]:
		eye_mat.emission_enabled = true
		eye_mat.emission = eye_col
		eye_mat.emission_energy_multiplier = 0.28 if eye_key == "red" else 0.12

	var whisk_mat := StandardMaterial3D.new()
	whisk_mat.albedo_color = Color(0.93, 0.90, 0.86) if not dark else Color(0.45, 0.43, 0.42)
	whisk_mat.roughness = 0.42

	var dumbo: bool = app.get("ears", "normal") == "dumbo"

	for mname in meshes:
		var mi: MeshInstance3D = meshes[mname]
		if mname.begins_with("RatBody"):
			mi.material_override = fur_mat
		elif mname.begins_with("RatPaws"):
			mi.material_override = skin_mat
		elif mname.begins_with("RatTail"):
			mi.material_override = tail_mat
		elif mname.begins_with("RatNose"):
			mi.material_override = nose_mat
		elif mname.begins_with("RatWhiskers"):
			mi.material_override = whisk_mat
		elif mname.begins_with("RatEye_"):
			mi.material_override = eye_mat
		elif mname.begins_with("RatEyelid_"):
			mi.material_override = eyelid_mat
		elif mname.begins_with("RatEarStd"):
			mi.material_override = ear_mat
			mi.visible = not dumbo
		elif mname.begins_with("RatEarDumbo"):
			mi.material_override = ear_mat
			mi.visible = dumbo

func set_shells(on: bool) -> void:
	shells_on = on

func set_highlight(v: float) -> void:
	if fur_mat:
		fur_mat.set_shader_parameter("highlight", v)

func set_dirt(v: float) -> void:
	if fur_mat:
		fur_mat.set_shader_parameter("dirt", v)

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
	mat.roughness = 0.72
	match kind:
		"pellets":
			var b := BoxMesh.new(); b.size = Vector3(0.085, 0.06, 0.095); m.mesh = b; mat.albedo_color = Color(0.56, 0.39, 0.24)
		"veg":
			var c := CylinderMesh.new(); c.top_radius = 0.032; c.bottom_radius = 0.048; c.height = 0.14; m.mesh = c; m.rotation.z = 1.2; mat.albedo_color = Color(0.95, 0.52, 0.16)
		"fruit":
			var s := SphereMesh.new(); s.radius = 0.055; s.height = 0.11; m.mesh = s; mat.albedo_color = Color(0.32, 0.36, 0.78)
		"treat":
			var s2 := SphereMesh.new(); s2.radius = 0.048; s2.height = 0.096; m.mesh = s2; mat.albedo_color = Color(0.96, 0.62, 0.22)
		"paper":
			var b2 := BoxMesh.new(); b2.size = Vector3(0.28, 0.022, 0.10); m.mesh = b2; mat.albedo_color = Color(0.98, 0.96, 0.91); m.rotation = Vector3(0.25, 0.35, 0.45)
		"ball":
			var s3 := SphereMesh.new(); s3.radius = 0.10; s3.height = 0.20; m.mesh = s3; mat.albedo_color = Color(0.89, 0.78, 0.60)
		_:
			var b3 := BoxMesh.new(); b3.size = Vector3(0.065, 0.065, 0.065); m.mesh = b3; mat.albedo_color = Color(0.6, 0.45, 0.3)
	m.material_override = mat
	held.add_child(m)
	var parent_node: Node3D = mouth_anchor if (in_mouth and mouth_anchor) else (hand_anchor if hand_anchor else self)
	parent_node.add_child(held)

func drop_held() -> void:
	if held and is_instance_valid(held):
		held.queue_free()
	held = null

func set_anim_targets(d: Dictionary) -> void:
	if float(d.get("curl", 0.0)) > 0.55 or float(d.get("relax", 0.0)) > 0.75:
		play_clip("Sleep_Curl", 1.0)
	elif float(d.get("walk", 0.0)) > 0.25:
		play_clip("Walk_Scurry", clampf(walk_rate / 7.5, 0.75, 1.85) if walk_rate > 0.1 else 1.0)
	elif float(d.get("groom", 0.0)) > 0.45:
		play_clip("Groom_Face", 1.0)
	elif float(d.get("chew", 0.0)) > 0.45:
		play_clip("Eat_Nibble", 1.0)
	elif float(d.get("rear", 0.0)) > 0.45 or float(d.get("box", 0.0)) > 0.45:
		play_clip("Rear_Beg", 1.0)
	else:
		play_clip("Idle_Sniff", 1.0)

func set_activity_anim(act: String, speed := 1.0) -> void:
	match act:
		"eat", "hand_treat", "dig", "gnaw", "play_toy":
			play_clip("Eat_Nibble", speed)
		"walk", "wheel", "tunnel_run", "spin", "fetch", "bridge", "come":
			play_clip("Walk_Scurry", speed)
		"stand", "drink", "wrestle", "target", "button":
			play_clip("Rear_Beg", speed)
		"groom_face", "groom_body", "groom_other":
			play_clip("Groom_Face", speed)
		"sleep_curl", "sleep", "sleep_hammock":
			play_clip("Sleep_Curl", 0.85)
		"sleep_loaf", "relax", "groomed":
			play_clip("Sleep_Loaf", 0.85 if act == "sleep_loaf" else 1.0)
		_:
			play_clip("Idle_Sniff", speed)

func _process(_delta: float) -> void:
	# Совместимость со старыми вызовами (например PortraitStudio)
	pass
