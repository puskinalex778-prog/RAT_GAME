extends Node3D
var frames := 0
var models := []
func _ready():
	var cam := Camera3D.new(); add_child(cam)
	var coats = OS.get_environment("COATS").split(",") if OS.get_environment("COATS") != "" else ["white_stripe","solid_gray","black_hooded","siamese","agouti","white_black_spots"]
	var n = coats.size()
	cam.fov = 40; cam.position = Vector3(float(OS.get_environment("CX")), 1.6, float(OS.get_environment("CZ"))) if OS.get_environment("CX") != "" else Vector3(0, 3.0 + n*0.25, 5.0 + n*0.9); cam.look_at(Vector3(0,0.5,0) if OS.get_environment("CX") == "" else Vector3(-1.2,0.6,0))
	var l := DirectionalLight3D.new(); add_child(l); l.rotation = Vector3(-0.9, 0.6, 0); l.light_energy = 0.5; l.shadow_enabled = true
	var env := WorldEnvironment.new(); var e := Environment.new(); e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.85,0.8,0.72)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; e.ambient_light_color = Color(1,0.93,0.85); e.ambient_light_energy = 0.3; e.tonemap_mode = Environment.TONE_MAPPER_FILMIC; env.environment = e; add_child(env)
	var fl := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(30,30); fl.mesh = pm; var fm := StandardMaterial3D.new(); fm.albedo_color = Color(0.6,0.5,0.4); fl.material_override = fm; add_child(fl)
	var poses = OS.get_environment("POSES").split(",") if OS.get_environment("POSES") != "" else []
	for i in n:
		var m := RatModel.new(); add_child(m)
		var ears = "dumbo" if i == 4 else "normal"
		m.build(Data.appearance_from_coat(coats[i], "", ears, i == 5))
		var row = i / 3; var col = i % 3
		m.position = Vector3((col-1)*3.0, 0, (row-0.5)*3.2 if n > 3 else 0)
		m.rotation.y = PI - 1.1 + (0.0 if row == 0 else 0.4)
		if poses.size() > i:
			match poses[i]:
				"rear": m.set_anim_targets({"rear":1.0, "sniff":1.0})
				"eat": m.set_anim_targets({"rear":0.35, "paws_up":1.0, "chew":1.0}); m.hold("veg")
				"sleep": m.set_anim_targets({"curl":1.0, "eyes":0.0})
				"groom": m.set_anim_targets({"rear":0.3, "groom":1.0})
				"walk": m.set_anim_targets({"walk":1.0}); m.walk_rate = 9.0
		models.append(m)
func _process(_d):
	frames += 1
	if frames == 40:
		get_viewport().get_texture().get_image().save_png(OS.get_environment("SHOT"))
		get_tree().quit()
