class_name CameraRig
extends Node3D
## Плавная камера: вращение вокруг клетки, приближение, слежение за крыской, вид «на уровне питомца».

var cam: Camera3D
var yaw := 0.0
var pitch := 0.28
var dist := 19.0
var target := Vector3(0, 3.4, 0)
var t_yaw := 0.0
var t_pitch := 0.25
var t_dist := 19.5
var t_target := Vector3(0, 3.4, 0)
var follow: Node3D = null
var pet_level := false
var home := Vector3(0, 3.4, 0)
var home_dist := 19.5
var smooth := 5.0
var world: World

func _ready() -> void:
	cam = Camera3D.new()
	cam.fov = 42.0
	cam.near = 0.1
	cam.far = 200.0
	add_child(cam)
	cam.current = true
	_apply()

func orbit(dx: float, dy: float) -> void:
	t_yaw = clampf(t_yaw - dx * 0.006, -1.15, 1.15)
	t_pitch = clampf(t_pitch + dy * 0.004, 0.02, 1.15)

func zoom(f: float) -> void:
	t_dist = clampf(t_dist * f, 3.5, 32.0)

func pan(dx: float, dy: float) -> void:
	follow = null
	var right := cam.global_basis.x
	var up := Vector3.UP
	t_target += (-right * dx + up * dy) * t_dist * 0.0012
	t_target.y = clampf(t_target.y, -0.5, 13.0)

func focus_area(area: String) -> void:
	follow = null
	pet_level = false
	home = Vector3(0, 3.4 if (world == null or world.level == 1) else 4.9, 0) if area == "cage" else World.PEN_C + Vector3(0, 1.0, 0)
	home_dist = 19.5 if area == "cage" else 15.0
	if world and world.level >= 2 and area == "cage":
		home_dist = 22.5
	t_target = home
	t_dist = home_dist

func reset_view() -> void:
	follow = null
	pet_level = false
	t_target = home
	t_dist = home_dist
	t_pitch = 0.28
	t_yaw = 0.0

func follow_node(n: Node3D, level := false) -> void:
	follow = n
	pet_level = level
	t_dist = 5.5 if level else 9.0
	if level:
		t_pitch = 0.06

func _process(delta: float) -> void:
	if follow and is_instance_valid(follow):
		t_target = follow.call("focus_pos") if follow.has_method("focus_pos") else follow.global_position
	var k := 1.0 - exp(-smooth * delta)
	yaw = lerpf(yaw, t_yaw, k)
	pitch = lerpf(pitch, t_pitch, k)
	dist = lerpf(dist, t_dist, k)
	target = target.lerp(t_target, k)
	_apply()
	if world:
		world.set_background_offset(yaw)

func _apply() -> void:
	if cam == null:
		return
	var off := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	cam.global_position = target + off
	cam.look_at(target, Vector3.UP)
