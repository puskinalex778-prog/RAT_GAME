class_name PortraitStudio
extends Node
## Рендерит 3D-портреты питомцев в отдельном SubViewport (с учётом дамбо, рекса, возраста).

signal portrait_ready(key: String)

var vp: SubViewport
var model: RatModel
var cache := {}
var queue: Array = []
var _busy := false

func _ready() -> void:
	vp = SubViewport.new()
	vp.size = Vector2i(256, 256)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(vp)
	var cam := Camera3D.new()
	cam.fov = 30
	cam.position = Vector3(-2.6, 1.6, -3.4)
	vp.add_child(cam)
	cam.look_at(Vector3(0, 0.55, -0.3))
	var l := DirectionalLight3D.new()
	l.rotation = Vector3(-0.7, -2.4, 0)
	l.light_energy = 0.75
	vp.add_child(l)
	var we := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(1, 0.95, 0.88)
	e.ambient_light_energy = 0.45
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	we.environment = e
	vp.add_child(we)
	model = RatModel.new()
	vp.add_child(model)

static func key_of(app: Dictionary, age: float) -> String:
	return JSON.stringify(app) + ("b" if age < 4 else ("t" if age < 10 else "a"))

func get_portrait(app: Dictionary, age := 20.0) -> Texture2D:
	var k := key_of(app, age)
	if cache.has(k):
		return cache[k]
	if not k in queue.map(func(q): return q[0]):
		queue.append([k, app, age])
	return UI.coat_tex(app)

func _process(_d: float) -> void:
	if _busy or queue.is_empty():
		return
	_busy = true
	var q = queue.pop_front()
	var app: Dictionary = q[1].duplicate()
	app["seed"] = 0.3
	model.build(app)
	model.scale = Vector3.ONE * clampf(0.42 + float(q[2]) / 12.0 * 0.58, 0.42, 1.0) / 0.95
	model.set_blob(false)
	model.set_anim_targets({"sniff": 0.5, "head_yaw": -0.35})
	for i in 4:
		model._process(0.25)
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	await get_tree().process_frame
	var img := vp.get_texture().get_image()
	if img:
		cache[q[0]] = ImageTexture.create_from_image(img)
		portrait_ready.emit(q[0])
	_busy = false
