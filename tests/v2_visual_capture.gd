extends Node3D
## Визуальная автопроверка RAT HOME v2 в реальном Godot 4.3 GL Compatibility:
## 1) Скриншот запуска настоящей scenes/main.tscn (проверка, что НЕТ бежевого экрана!)
## 2) Скриншот живой игры с клеткой, памятной табличкой, крыской и русским HUD
## 3) Сетка 6 скелетных анимаций (вкл. Eat_Nibble с едой в лапках + низкий ракурс лап и хвоста)
## 4) Сетка 6 окрасов + ушки Дамбо + шерсть Рекс

var out_dir := "C:/Users/worsan/.gemini/antigravity/brain/f6a12bf2-59f3-4b6e-9b60-96f146f0c676/renders/"

func _ready() -> void:
	call_deferred("_run")

func _run() -> void:
	var env_out := OS.get_environment("V2_OUT_DIR")
	if env_out != "":
		out_dir = env_out.rstrip("/") + "/"
	DirAccess.make_dir_recursive_absolute(out_dir)

	# --- Фаза 1: Реальный запуск основной сцены scenes/main.tscn ---
	var main_ps := load("res://scenes/main.tscn") as PackedScene
	var main := main_ps.instantiate() as Main
	get_tree().root.add_child(main)

	for i in 12:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img_launch := get_viewport().get_texture().get_image()
	img_launch.save_png(out_dir + "godot_v2_launch.png")
	print("SAVED:", out_dir + "godot_v2_launch.png")

	# Закрываем стартовую модалку интро, ставим крыску перед миской на еду и снимаем живой HUD!
	Game.state.intro_done = true
	main.hud._close_modal()
	main.hud.refresh_soft()
	if not main.rat_nodes().is_empty():
		var r: Rat = main.rat_nodes()[0]
		main.select_rat(r)
		r.moving = false
		r.path.clear()
		r.global_position = Vector3(0.4, 0.0, 1.2)
		r.yaw = -0.65
		r.model.hold("veg")
		r.perform("eat", 10.0)
		main.follow_selected(true)
	main.rig.t_yaw = 0.45
	main.rig.t_pitch = 0.22
	main.rig.t_dist = 7.2
	for i in 30:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out_dir + "godot_v2_gameplay.png")
	print("SAVED:", out_dir + "godot_v2_gameplay.png")

	# Удаляем main перед студийными кадрами
	main.queue_free()
	await get_tree().process_frame

	# --- Фаза 2: Студийная сцена 6 анимаций + контакт лап и хвоста с полом ---
	var stage := Node3D.new()
	add_child(stage)
	var cam := Camera3D.new()
	cam.fov = 38.0
	stage.add_child(cam)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.78, 0.65, 0)
	sun.light_energy = 0.55
	sun.light_color = Color(1.0, 0.96, 0.88)
	sun.shadow_enabled = true
	stage.add_child(sun)
	var fill := OmniLight3D.new()
	fill.position = Vector3(-5, 4, 6)
	fill.omni_range = 24.0
	fill.light_energy = 0.25
	fill.light_color = Color(0.92, 0.95, 1.0)
	stage.add_child(fill)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.84, 0.80, 0.74)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1.0, 0.95, 0.88)
	env.ambient_light_energy = 0.34
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	we.environment = env
	stage.add_child(we)

	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(30, 30)
	fl.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.68, 0.62, 0.54)
	fm.roughness = 0.90
	fl.material_override = fm
	stage.add_child(fl)

	var anim_specs := [
		["Idle_Sniff", "white_stripe", "normal", false, ""],
		["Walk_Scurry", "white_stripe", "normal", false, ""],
		["Rear_Beg", "white_stripe", "normal", false, ""],
		["Eat_Nibble", "white_stripe", "normal", false, "veg"],
		["Sleep_Curl", "white_stripe", "normal", false, ""],
		["Sleep_Loaf", "white_stripe", "normal", false, ""],
	]
	var models_a := []
	for i in anim_specs.size():
		var sp = anim_specs[i]
		var m := RatModel.new()
		stage.add_child(m)
		m.build(Data.appearance_from_coat(sp[1], "", sp[2], sp[3]))
		m.play_clip(sp[0], 1.0, true)
		if m.anim_player:
			m.anim_player.seek(0.65, true)
		if sp[4] != "":
			m.hold(sp[4])
		var col := i % 3
		var row := i / 3
		m.position = Vector3((col - 1) * 3.1, 0.0, (row - 0.5) * 3.0)
		m.rotation.y = PI * 0.72 if i != 2 else PI * 0.62
		models_a.append(m)

	# Низкий 3/4 ракурс, чтобы отлично видеть контакт задних лап, хвоста и еду в лапках
	cam.position = Vector3(0.2, 2.35, 8.2)
	cam.look_at(Vector3(0.0, 0.48, 0.0))
	for i in 10:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out_dir + "godot_v2_anims.png")
	print("SAVED:", out_dir + "godot_v2_anims.png")

	# --- Фаза 3: Сетка 6 окрасов (вкл. Дамбо и Рекс) в Godot ---
	var coat_specs := [
		["white_stripe", "normal", false],
		["white_stripe_cap", "normal", false],
		["solid_gray", "dumbo", false],
		["black_hooded", "normal", false],
		["siamese", "normal", false],
		["albino", "dumbo", true],
	]
	for i in models_a.size():
		var m: RatModel = models_a[i]
		var cs = coat_specs[i]
		m.drop_held()
		m.build(Data.appearance_from_coat(cs[0], "", cs[1], cs[2]))
		m.play_clip("Idle_Sniff", 1.0, true)
		m.rotation.y = PI * 0.68

	cam.position = Vector3(0.0, 2.6, 8.0)
	cam.look_at(Vector3(0.0, 0.45, 0.0))
	for i in 10:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out_dir + "godot_v2_coats.png")
	print("SAVED:", out_dir + "godot_v2_coats.png")
	get_tree().quit()
