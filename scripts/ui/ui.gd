class_name UI
extends RefCounted
## Помощники интерфейса: тема, кнопки, подписи, шкалы, иконки.

const CREAM := Color(0.995, 0.965, 0.905)
const CREAM2 := Color(0.96, 0.91, 0.83)
const SAGE := Color(0.45, 0.60, 0.49)
const SAGE_D := Color(0.36, 0.50, 0.40)
const BROWN := Color(0.33, 0.24, 0.17)
const ACCENT := Color(0.85, 0.50, 0.34)
const GOLD := Color(0.93, 0.74, 0.30)
const RED := Color(0.85, 0.42, 0.36)

static var _tex := {}
static var font: FontVariation
static var font_bold: FontVariation

static func tex(path: String) -> Texture2D:
	if path == "":
		return null
	if _tex.has(path):
		return _tex[path]
	var full := "res://assets/%s.png" % path
	var t: Texture2D = load(full) if ResourceLoader.exists(full) else null
	_tex[path] = t
	return t

static func sb(bg: Color, radius := 20, border := Color(0, 0, 0, 0), bw := 0, shadow := 0, pad := 14) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	if bw > 0:
		s.border_color = border
		s.set_border_width_all(bw)
	if shadow > 0:
		s.shadow_color = Color(0.2, 0.12, 0.05, 0.25)
		s.shadow_size = shadow
		s.shadow_offset = Vector2(0, 3)
	s.set_content_margin_all(pad)
	s.anti_aliasing = true
	return s

static func make_theme() -> Theme:
	var base := load("res://assets/fonts/Montserrat.ttf") as FontFile
	font = FontVariation.new()
	font.base_font = base
	font.variation_opentype = {"wght": 560}
	font_bold = FontVariation.new()
	font_bold.base_font = base
	font_bold.variation_opentype = {"wght": 760}
	var th := Theme.new()
	th.default_font = font
	th.default_font_size = 24
	# кнопки
	th.set_stylebox("normal", "Button", sb(SAGE, 18, SAGE_D, 0, 3, 12))
	th.set_stylebox("hover", "Button", sb(SAGE.lightened(0.08), 18, SAGE_D, 0, 3, 12))
	th.set_stylebox("pressed", "Button", sb(SAGE_D, 18, SAGE_D, 0, 1, 12))
	th.set_stylebox("disabled", "Button", sb(Color(0.75, 0.73, 0.68), 18, SAGE_D, 0, 0, 12))
	th.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	th.set_color("font_color", "Button", Color.WHITE)
	th.set_color("font_hover_color", "Button", Color.WHITE)
	th.set_color("font_pressed_color", "Button", Color(0.95, 0.95, 0.9))
	th.set_color("font_disabled_color", "Button", Color(0.95, 0.94, 0.9))
	th.set_font("font", "Button", font_bold)
	th.set_constant("h_separation", "Button", 10)
	th.set_constant("icon_max_width", "Button", 56)
	# панели
	th.set_stylebox("panel", "PanelContainer", sb(CREAM, 26, CREAM2, 2, 10, 18))
	th.set_stylebox("panel", "Panel", sb(CREAM, 26, CREAM2, 2, 10, 18))
	th.set_color("font_color", "Label", BROWN)
	# поле ввода
	th.set_stylebox("normal", "LineEdit", sb(Color.WHITE, 14, CREAM2, 2, 0, 12))
	th.set_stylebox("focus", "LineEdit", sb(Color.WHITE, 14, SAGE, 3, 0, 12))
	th.set_color("font_color", "LineEdit", BROWN)
	th.set_color("caret_color", "LineEdit", BROWN)
	# шкалы
	th.set_stylebox("background", "ProgressBar", sb(Color(0.88, 0.84, 0.77), 10, Color(), 0, 0, 0))
	th.set_stylebox("fill", "ProgressBar", sb(SAGE, 10, Color(), 0, 0, 0))
	th.set_constant("outline_size", "ProgressBar", 0)
	# слайдеры
	th.set_stylebox("slider", "HSlider", sb(Color(0.86, 0.82, 0.74), 8, Color(), 0, 0, 4))
	th.set_stylebox("grabber_area", "HSlider", sb(SAGE, 8, Color(), 0, 0, 4))
	th.set_stylebox("grabber_area_highlight", "HSlider", sb(SAGE, 8, Color(), 0, 0, 4))
	th.set_color("font_color", "CheckButton", BROWN)
	th.set_color("font_hover_color", "CheckButton", BROWN)
	th.set_color("font_pressed_color", "CheckButton", BROWN)
	th.set_color("font_hover_pressed_color", "CheckButton", BROWN)
	th.set_stylebox("normal", "CheckButton", StyleBoxEmpty.new())
	th.set_stylebox("pressed", "CheckButton", StyleBoxEmpty.new())
	th.set_stylebox("hover", "CheckButton", StyleBoxEmpty.new())
	th.set_stylebox("hover_pressed", "CheckButton", StyleBoxEmpty.new())
	th.set_stylebox("focus", "CheckButton", StyleBoxEmpty.new())
	# прокрутка
	th.set_stylebox("scroll", "VScrollBar", sb(Color(0, 0, 0, 0.05), 6, Color(), 0, 0, 2))
	th.set_stylebox("grabber", "VScrollBar", sb(Color(0.6, 0.5, 0.4, 0.5), 6, Color(), 0, 0, 2))
	th.set_stylebox("grabber_highlight", "VScrollBar", sb(Color(0.6, 0.5, 0.4, 0.7), 6, Color(), 0, 0, 2))
	return th

static func btn(text: String, icon := "", cb: Callable = Callable(), style := "primary", min_h := 64) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, min_h)
	if icon != "":
		b.icon = tex(icon)
		b.expand_icon = false
		b.add_theme_constant_override("icon_max_width", int(min_h * 0.8))
	match style:
		"secondary":
			b.add_theme_stylebox_override("normal", sb(CREAM2, 18, Color(), 0, 2, 12))
			b.add_theme_stylebox_override("hover", sb(CREAM2.lightened(0.2), 18, Color(), 0, 2, 12))
			b.add_theme_stylebox_override("pressed", sb(CREAM2.darkened(0.08), 18, Color(), 0, 0, 12))
			for c in ["font_color", "font_hover_color", "font_pressed_color"]:
				b.add_theme_color_override(c, BROWN)
		"accent":
			b.add_theme_stylebox_override("normal", sb(ACCENT, 18, Color(), 0, 3, 12))
			b.add_theme_stylebox_override("hover", sb(ACCENT.lightened(0.08), 18, Color(), 0, 3, 12))
			b.add_theme_stylebox_override("pressed", sb(ACCENT.darkened(0.1), 18, Color(), 0, 1, 12))
		"ghost":
			var e := sb(Color(1, 1, 1, 0.0), 18, Color(), 0, 0, 8)
			b.add_theme_stylebox_override("normal", e)
			b.add_theme_stylebox_override("hover", sb(Color(1, 1, 1, 0.15), 18, Color(), 0, 0, 8))
			b.add_theme_stylebox_override("pressed", sb(Color(0, 0, 0, 0.08), 18, Color(), 0, 0, 8))
			for c in ["font_color", "font_hover_color", "font_pressed_color"]:
				b.add_theme_color_override(c, BROWN)
	if cb.is_valid():
		b.pressed.connect(func():
			Sfx.play("click")
			cb.call())
	return b

static func lbl(text: String, size := 24, color := BROWN, wrap := true, bold := false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if bold:
		l.add_theme_font_override("font", font_bold)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size.x = 60
	return l

static func bar(v: float, col := SAGE, h := 16, w := 160) -> ProgressBar:
	var p := ProgressBar.new()
	p.min_value = 0
	p.max_value = 100
	p.value = v
	p.show_percentage = false
	p.custom_minimum_size = Vector2(w, h)
	var c := col
	if v < 30:
		c = RED
	elif v < 55:
		c = GOLD
	p.add_theme_stylebox_override("fill", sb(c, 10, Color(), 0, 0, 0))
	return p

static func stat_row(name: String, v: float, col := SAGE) -> HBoxContainer:
	var h := HBoxContainer.new()
	var l := lbl(name, 21, BROWN, false)
	l.custom_minimum_size = Vector2(210, 0)
	h.add_child(l)
	var b := bar(v, col, 18, 180)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(b)
	var n := lbl("%d" % int(v), 20, BROWN, false)
	n.custom_minimum_size = Vector2(44, 0)
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	h.add_child(n)
	return h

static func icon(path: String, size := 56) -> TextureRect:
	var t := TextureRect.new()
	t.texture = tex(path)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2(size, size)
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t

static func tex_rect(t: Texture2D, size := 56) -> TextureRect:
	var r := TextureRect.new()
	r.texture = t
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.custom_minimum_size = Vector2(size, size)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

static func hb(sep := 10) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", sep)
	return h

static func vb(sep := 10) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", sep)
	return v

static func card(bg := Color(1, 1, 1, 0.65), pad := 12) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", sb(bg, 18, CREAM2, 1, 0, pad))
	return p

static func clear(n: Node) -> void:
	for c in n.get_children():
		n.remove_child(c)
		c.queue_free()

static func swatch_tex(app: Dictionary) -> Texture2D:
	var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var b: Color = Data.COLORS.get(app.base, Color.GRAY)
	var m: Color = Data.COLORS.get(app.mark, Color.GRAY)
	for y in 64:
		for x in 64:
			var d := Vector2(x - 32, y - 32).length()
			if d < 30:
				var c := b if app.pattern in [0, 1, 5, 9] else Data.WHITE
				if app.pattern in [2, 3, 4, 8] and (absf(x - 32) < 7 or y < 22):
					c = m
				if app.pattern in [6, 7] and (int(x / 9) + int(y / 11)) % 3 == 0:
					c = m
				if app.pattern in [9, 10] and y < 18:
					c = m
				img.set_pixel(x, y, c)
	return ImageTexture.create_from_image(img)

static func coat_tex(app: Dictionary) -> Texture2D:
	var c := Data.coat(app.get("coat", ""))
	var img_name: String = c.img if app.get("coat", "") == c.id else ""
	if app.get("ears", "normal") == "dumbo" and app.get("coat", "") == "solid_gray":
		img_name = "dumbo_gray"
	if app.get("rex", false) and app.get("coat", "") == "beige":
		img_name = "rex_beige"
	if img_name != "":
		var t := tex("rats/" + img_name)
		if t:
			return t
	return swatch_tex(app)
