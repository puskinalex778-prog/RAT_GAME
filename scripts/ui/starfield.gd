extends Control
## Звёздное небо для темы «Космическая станция»
var stars := []
func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	for i in 220:
		stars.append([Vector2(rng.randf(), rng.randf()), rng.randf_range(0.6, 2.4), rng.randf() * TAU])
func _process(_d: float) -> void:
	if visible:
		queue_redraw()
func _draw() -> void:
	var sz := size
	draw_rect(Rect2(Vector2.ZERO, sz), Color(0.06, 0.07, 0.16))
	var t := Time.get_ticks_msec() / 1000.0
	for s in stars:
		var a := 0.55 + 0.45 * sin(t * 1.3 + s[2])
		draw_circle(s[0] * sz, s[1], Color(1, 0.97, 0.9, a))
