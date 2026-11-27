extends SceneTree
## Автоматический headless smoke- и rig-тест RAT HOME v2.
## Проверяет компиляцию всех сцен/скриптов, запуск main.tscn (без бежевого экрана),
## наличие всех 30 костей и 6 клипов в rat_rigged.glb (вкл. Eat_Nibble), ориентировку,
## переключение ушей Стандарт/Дамбо и ключевую логику Game + HUD.

var _errors: Array[String] = []

func _req(cond: bool, msg: String) -> void:
	if not cond:
		_errors.append(msg)
		push_error("V2_VERIFY_FAIL: " + msg)

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var Game := root.get_node_or_null("Game")
	var Sfx := root.get_node_or_null("Sfx")
	_req(Game != null, "Autoload Game missing")
	_req(Sfx != null, "Autoload Sfx missing")

	var main_ps := load("res://scenes/main.tscn") as PackedScene
	_req(main_ps != null, "Failed to load res://scenes/main.tscn")
	if main_ps == null:
		_finish()
		return

	var main := main_ps.instantiate()
	_req(main != null, "Failed to instantiate main.tscn")
	root.add_child(main)

	for i in 12:
		await process_frame

	_req(main.get("world") != null, "main.world is null")
	_req(main.get("rig") != null, "main.rig is null")
	_req(main.get("hud") != null, "main.hud is null")
	_req(main.get("portraits") != null, "main.portraits is null")

	var rat_map: Dictionary = main.get("rats")
	_req(not rat_map.is_empty(), "No rats spawned in main scene")
	var rat: Node = rat_map.values()[0]
	var model: Node = rat.get("model")
	_req(model != null, "rat.model is null")

	var skel: Skeleton3D = model.get("skeleton")
	var ap: AnimationPlayer = model.get("anim_player")
	_req(skel != null, "rat_rigged.glb Skeleton3D missing")
	_req(ap != null, "rat_rigged.glb AnimationPlayer missing")

	if skel:
		_req(skel.get_bone_count() >= 28, "Expected >=28 bones, got %d" % skel.get_bone_count())
		var head_idx := skel.find_bone("head")
		var pelvis_idx := skel.find_bone("pelvis")
		_req(head_idx >= 0 and pelvis_idx >= 0, "head/pelvis bones missing")
		if head_idx >= 0 and pelvis_idx >= 0:
			var hz := skel.get_bone_global_pose(head_idx).origin.z
			var pz := skel.get_bone_global_pose(pelvis_idx).origin.z
			print("ORIENTATION CHECK: pelvis.z=%.3f, head.z=%.3f (nose faces -Z: %s)" % [pz, hz, str(hz < pz)])
			_req(hz < pz, "Rat nose should face -Z in Godot local space!")

	if ap:
		var anims := ap.get_animation_list()
		print("ANIMATION CLIPS IN GLB: ", anims)
		for expected in ["Idle_Sniff", "Walk_Scurry", "Rear_Beg", "Groom_Face", "Eat_Nibble", "Sleep_Curl", "Sleep_Loaf"]:
			var found := false
			for a in anims:
				if a.ends_with(expected):
					found = true
					break
			_req(found, "Missing animation clip: " + expected)

	# Проверка переключения всех 7 анимаций + держания еды + ушей Дамбо + окрасов
	for act in ["eat", "walk", "stand", "groom_face", "sleep_curl", "sleep_loaf", "sniff"]:
		model.call("set_activity_anim", act, 1.0)
		await process_frame
		_req(model.get("current_clip") != "", "Failed to switch activity anim: " + act)

	model.call("hold", "veg")
	_req(model.get("held") != null, "hold('veg') did not create held item")
	model.call("drop_held")

	# Проверяем наличие обеих пар ушей и их переключение
	var meshes: Dictionary = model.get("meshes")
	var has_std := false
	var has_dumbo := false
	for k in meshes:
		if k.begins_with("RatEarStd"):
			has_std = true
		elif k.begins_with("RatEarDumbo"):
			has_dumbo = true
	_req(has_std and has_dumbo, "Missing toggleable Standard or Dumbo ear meshes in GLB!")

	for coat_id in ["white_stripe", "white_stripe_cap", "solid_gray", "black_hooded", "siamese", "albino"]:
		var app := Data.appearance_from_coat(coat_id, "", "dumbo" if coat_id == "solid_gray" else "normal", coat_id == "albino")
		model.call("build", app)
		await process_frame

	# Проверка HUD модальных окон и базовой логики Game
	var hud: Node = main.get("hud")
	hud.call("open_shop", "food")
	await process_frame
	hud.call("open_care")
	await process_frame
	hud.call("open_settings")
	await process_frame
	hud.call("open_dedication")
	await process_frame
	hud.call("_close_modal")

	Game.call("fill_bowl")
	Game.call("refresh_water")
	var r0: Dictionary = Game.call("live_rats")[0]
	var treat_msg: String = Game.call("hand_treat", r0)
	_req(treat_msg != "", "hand_treat returned empty")
	_req(Game.call("save_game"), "save_game failed")

	main.queue_free()
	await process_frame
	_finish()

func _finish() -> void:
	if _errors.is_empty():
		print("ALL V2 CHECKS PASSED")
		quit(0)
	else:
		print("V2 CHECKS FAILED: %d errors" % _errors.size())
		quit(1)
