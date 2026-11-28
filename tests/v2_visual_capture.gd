extends Node3D
## Визуальная проверка RAT HOME v2.1 в реальном Godot 4.3 GL Compatibility:
## 1) godot_v2_launch.png — Приветствие с чётким жирным шрифтом на фоне настоящей 3D-комнаты, комода, клетки и картины
## 2) godot_v2_customizer.png — Визуальный выбор крыски: живая 3D-витрина слева + выпадающий список окрасов справа
## 3) godot_v2_cutscene.png — 3D-кат-сцена с картонным домиком-переноской и выходящей крыской
## 4) godot_v2_room_front.png — Общий вид 3D-комнаты, комода, клетки, картины на стене и всех предметов
## 5) godot_v2_room_left.png — Повёрнутый вид 3/4 слева (окно, стеллаж, домик со сквозным входом, полки, пандусы)
## 6) godot_v2_room_right.png — Повёрнутый вид 3/4 справа (миска внутри, поилка снаружи с носиком, лоток, картина, лампа)
## 7) godot_v2_cage_closeup.png — Крупный план предметов внутри клетки (домик, миска, поилка, лоток, крыска на стружке)

var out_dir := "C:/Users/worsan/.gemini/antigravity/brain/f6a12bf2-59f3-4b6e-9b60-96f146f0c676/renders/"

func _ready() -> void:
	call_deferred("_run")

func _snap(name: String, frames := 14) -> void:
	for i in frames:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out_dir + name)
	print("SAVED:", out_dir + name)

func _run() -> void:
	var env_out := OS.get_environment("V2_OUT_DIR")
	if env_out != "":
		out_dir = env_out.rstrip("/") + "/"
	DirAccess.make_dir_recursive_absolute(out_dir)

	# 1. Стартовое окно приветствия (без таблички и без выбора происхождения)
	Game.state.intro_done = false
	var main_ps := load("res://scenes/main.tscn") as PackedScene
	var main := main_ps.instantiate() as Main
	get_tree().root.add_child(main)
	await _snap("godot_v2_launch.png", 16)

	# 2. Визуальный выбор крыски в зоомагазине (выпадающий список + живая 3D-крыска)
	main.hud._show_intro_customizer()
	await _snap("godot_v2_customizer.png", 18)

	# 3. 3D-кат-сцена прибытия в картонном домике (момент раскрытия створок и выхода крыски!)
	Game.state.intro_done = true
	main.hud._close_modal()
	var first_rat: Rat = main.rat_nodes()[0] if not main.rat_nodes().is_empty() else null
	main.play_arrival_cutscene(first_rat)
	main._cutscene_t = 3.55
	main.rig.yaw = main.rig.t_yaw
	main.rig.pitch = main.rig.t_pitch
	main.rig.dist = main.rig.t_dist
	main.rig.target = main.rig.t_target
	await _snap("godot_v2_cutscene.png", 12)

	# 4. Завершаем кат-сцену, ставим крыску рядом с миской и делаем общий вид 3D-комнаты спереди!
	main.skip_arrival_cutscene()
	main.hud.toast_panel.visible = false
	main.hud._toast_t = 0.0
	main.hud._refresh_hint()
	if first_rat:
		first_rat.moving = false
		first_rat.path.clear()
		first_rat.controlled = "show"
		first_rat.position = Vector3(1.1, 0.0, 1.1)
		first_rat.yaw = -0.65
		first_rat.model.hold("veg")
		first_rat.model.play_clip("Eat_Nibble", 1.0, true)
	main.select_rat(null)
	main.rig.follow = null
	main.rig.t_target = Vector3(1.1, 3.6, 0.0)
	main.rig.t_dist = 19.5
	main.rig.t_yaw = 0.0
	main.rig.t_pitch = 0.20
	main.rig.target = main.rig.t_target
	main.rig.dist = main.rig.t_dist
	main.rig.yaw = main.rig.t_yaw
	main.rig.pitch = main.rig.t_pitch
	await _snap("godot_v2_room_front.png", 16)

	# 5. Орбита камеры влево (настоящая 3D-комната: окно, стеллаж, домик, полки)
	main.rig.t_yaw = -0.58
	main.rig.t_pitch = 0.24
	main.rig.t_dist = 18.2
	main.rig.yaw = main.rig.t_yaw
	main.rig.pitch = main.rig.t_pitch
	main.rig.dist = main.rig.t_dist
	await _snap("godot_v2_room_left.png", 12)

	# 6. Орбита камеры вправо (миска, поилка снаружи стенки, лоток, картина на стене, лампа)
	main.rig.t_yaw = 0.56
	main.rig.t_pitch = 0.24
	main.rig.t_dist = 18.2
	main.rig.yaw = main.rig.t_yaw
	main.rig.pitch = main.rig.t_pitch
	main.rig.dist = main.rig.t_dist
	await _snap("godot_v2_room_right.png", 12)

	# 7. Крупный план предметов внутри клетки (проверяем Z-буфер, миску, поилку, лоток, домик, крыску)
	main.rig.t_target = Vector3(2.2, 1.1, 0.3)
	main.rig.t_yaw = 0.35
	main.rig.t_pitch = 0.34
	main.rig.t_dist = 9.2
	main.rig.target = main.rig.t_target
	main.rig.yaw = main.rig.t_yaw
	main.rig.pitch = main.rig.t_pitch
	main.rig.dist = main.rig.t_dist
	await _snap("godot_v2_cage_closeup.png", 12)

	get_tree().quit()
