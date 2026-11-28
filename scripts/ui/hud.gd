class_name HUD
extends CanvasLayer
## Полный мобильный интерфейс «Крыски дома» (RAT HOME) на русском языке:
## вступительная кат-сцена с конструктором, HUD, карточка питомца, магазин (9 разделов),
## уход, дрессировка трюков, задания/достижения, фоторежим, альбом, настройки и памятная табличка.

var main: Main

var root: Control
var hud_box: Control
var top_bar: HBoxContainer
var hint_wrap: PanelContainer
var hint_lbl: Label
var sel_panel: PanelContainer
var sel_box: HBoxContainer
var dock_wrap: PanelContainer
var coins_lbl: Label
var pets_lbl: Label
var pet_mode_btn: Button
var play_mode_btn: Button
var pen_switch_btn: Button
var toast_panel: PanelContainer
var toast_lbl: Label
var _toast_t := 0.0

var photo_ui: Control
var decor_ui: Control
var decor_tray: HBoxContainer
var decor_info: Label
var cutscene_ui: Control
var cutscene_lbl: Label

var modal_backdrop: ColorRect
var modal_host: CenterContainer
var _modal_open := false
var _selected_decor_item := ""

# Состояние конструктора питомца (для зоомагазина в интро и Центра знакомства)
var _custom_coat := "white_stripe"
var _custom_eye := "black"
var _custom_ears := "normal"
var _custom_rex := false
var _custom_sex := "m"
var _custom_name := "Тимма"
var _preview_rat: RatModel = null
var _preview_turntable: Node3D = null
var _preview_yaw := 0.55
var _preview_dragging := false

func _ready() -> void:
	layer = 10
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UI.make_theme()
	add_child(root)

	_build_main_hud()
	_build_photo_ui()
	_build_decor_ui()
	_build_cutscene_ui()
	_build_toast()
	_build_modal_layer()

	Game.coins_changed.connect(func(_v): refresh_soft())
	Game.changed.connect(refresh_soft)
	Game.rats_changed.connect(refresh_soft)
	Game.toast.connect(func(msg): toast(msg, "info"))
	refresh_soft()

func _process(delta: float) -> void:
	if _toast_t > 0.0:
		_toast_t -= delta
		if _toast_t <= 0.0 and toast_panel:
			toast_panel.visible = false
			_refresh_hint()
	if _preview_turntable and is_instance_valid(_preview_turntable):
		if not _preview_dragging:
			_preview_yaw += delta * 0.42
		_preview_turntable.rotation.y = _preview_yaw

func is_over_ui(pos: Vector2) -> bool:
	if _modal_open:
		return true
	if cutscene_ui and cutscene_ui.visible:
		return true
	if photo_ui and photo_ui.visible:
		return _hit_visible_buttons(photo_ui, pos)
	if decor_ui and decor_ui.visible:
		return _hit_visible_buttons(decor_ui, pos)
	if hud_box and hud_box.visible:
		for c in [top_bar, hint_wrap, sel_panel, dock_wrap]:
			if c and c.visible and c.get_global_rect().has_point(pos):
				return true
	return false

func _hit_visible_buttons(node: Control, pos: Vector2) -> bool:
	for c in node.get_children():
		if c is Control and c.visible:
			if (c is Button or c is PanelContainer) and c.get_global_rect().has_point(pos):
				return true
			if _hit_visible_buttons(c, pos):
				return true
	return false

# =====================================================================
#  Основной HUD
# =====================================================================
func _build_main_hud() -> void:
	hud_box = Control.new()
	hud_box.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(hud_box)

	var outer := MarginContainer.new()
	outer.set_anchors_preset(Control.PRESET_FULL_RECT)
	outer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	outer.add_theme_constant_override("margin_left", 16)
	outer.add_theme_constant_override("margin_right", 16)
	outer.add_theme_constant_override("margin_top", 14)
	outer.add_theme_constant_override("margin_bottom", 14)
	hud_box.add_child(outer)

	var vbox := UI.vb(10)
	vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	outer.add_child(vbox)

	# --- Верхняя панель ---
	top_bar = UI.hb(8)
	top_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vbox.add_child(top_bar)

	# Монеты
	var coin_p := PanelContainer.new()
	coin_p.add_theme_stylebox_override("panel", UI.sb(UI.CREAM, 20, UI.CREAM2, 2, 4, 8))
	var ch := UI.hb(6)
	ch.add_child(UI.icon("icons/coin", 34))
	coins_lbl = UI.lbl("100", 22, UI.BROWN, false, true)
	ch.add_child(coins_lbl)
	coin_p.add_child(ch)
	top_bar.add_child(coin_p)

	# Кол-во крысок
	var pets_btn := UI.btn("1", "icons/pets", func(): open_pets_list(), "secondary", 52)
	pets_lbl = Label.new() # используем текст кнопки
	pets_btn.name = "PetsTopBtn"
	top_bar.add_child(pets_btn)

	# Переключатели режимов камеры
	var cam_box := UI.hb(6)
	cam_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cam_box.alignment = BoxContainer.ALIGNMENT_CENTER
	cam_box.add_child(UI.btn("Клетка", "", func():
		main.rig.reset_view()
		main.focus_area("cage"), "secondary", 48))
	cam_box.add_child(UI.btn("Вблизи", "", func():
		if main.selected:
			main.follow_selected(true)
		elif not main.rat_nodes().is_empty():
			main.select_rat(main.rat_nodes()[0])
			main.follow_selected(true), "secondary", 48))
	cam_box.add_child(UI.btn("Следить", "", func():
		if main.selected:
			main.follow_selected(false)
		elif not main.rat_nodes().is_empty():
			main.select_rat(main.rat_nodes()[0])
			main.follow_selected(false), "secondary", 48))
	cam_box.add_child(UI.btn("Фото", "icons/camera", func(): enter_photo_mode(true), "secondary", 48))
	top_bar.add_child(cam_box)

	# Справа: Обустроить, Памятная табличка ♥, Настройки
	top_bar.add_child(UI.btn("Обустроить", "", func(): enter_decor_mode(true), "secondary", 52))
	top_bar.add_child(UI.btn("♥", "", func(): open_dedication(), "accent", 52))
	top_bar.add_child(UI.btn("", "icons/settings", func(): open_settings(), "secondary", 52))

	# --- Мягкая стартовая подсказка (можно скрыть) ---
	hint_wrap = PanelContainer.new()
	hint_wrap.add_theme_stylebox_override("panel", UI.sb(Color(0.99, 0.96, 0.89, 0.94), 18, UI.SAGE, 2, 3, 8))
	hint_wrap.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var hh := UI.hb(10)
	hint_lbl = UI.lbl("", 18, UI.BROWN, false, true)
	hh.add_child(hint_lbl)
	hh.add_child(UI.btn("×", "", func(): Game.set_setting("hints", false), "ghost", 34))
	hint_wrap.add_child(hh)
	vbox.add_child(hint_wrap)

	# Распорка в центре для 3D-обзора
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vbox.add_child(spacer)

	# --- Панель действий выбранной крыски ---
	sel_panel = PanelContainer.new()
	sel_panel.add_theme_stylebox_override("panel", UI.sb(Color(0.99, 0.96, 0.90, 0.95), 22, UI.CREAM2, 2, 6, 10))
	sel_panel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	sel_panel.visible = false
	sel_box = UI.hb(8)
	sel_panel.add_child(sel_box)
	vbox.add_child(sel_panel)

	# --- Нижняя панель навигации ---
	dock_wrap = PanelContainer.new()
	dock_wrap.add_theme_stylebox_override("panel", UI.sb(Color(0.99, 0.96, 0.90, 0.95), 26, UI.CREAM2, 2, 8, 8))
	dock_wrap.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var dock := UI.hb(8)
	dock.add_child(UI.btn("Питомцы", "icons/pets", func(): open_pets_list(), "secondary", 58))
	dock.add_child(UI.btn("Магазин", "icons/shop", func(): open_shop("food"), "secondary", 58))
	dock.add_child(UI.btn("Уход", "icons/pellet_food", func(): open_care(), "secondary", 58))
	dock.add_child(UI.btn("Задания", "icons/quests", func(): open_quests(), "secondary", 58))
	dock.add_child(UI.btn("Альбом", "icons/camera", func(): open_album(), "secondary", 58))
	pen_switch_btn = UI.btn("Манеж", "habitats/playpen", func():
		var next := "pen" if main.view_area == "cage" else "cage"
		main.focus_area(next)
		pen_switch_btn.text = "Клетка" if next == "pen" else "Манеж", "accent", 58)
	pen_switch_btn.visible = false
	dock.add_child(pen_switch_btn)
	dock_wrap.add_child(dock)
	vbox.add_child(dock_wrap)

func _build_photo_ui() -> void:
	photo_ui = Control.new()
	photo_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	photo_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	photo_ui.visible = false
	root.add_child(photo_ui)

	var m := MarginContainer.new()
	m.set_anchors_preset(Control.PRESET_FULL_RECT)
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.add_theme_constant_override("margin_left", 20)
	m.add_theme_constant_override("margin_right", 20)
	m.add_theme_constant_override("margin_top", 20)
	m.add_theme_constant_override("margin_bottom", 24)
	photo_ui.add_child(m)

	var vb := UI.vb(10)
	vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.add_child(vb)

	var top := UI.hb(10)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sp := Control.new(); sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL; sp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(sp)
	top.add_child(UI.btn("Выйти из фоторежима", "", func(): enter_photo_mode(false), "secondary", 54))
	vb.add_child(top)

	var mid := Control.new(); mid.size_flags_vertical = Control.SIZE_EXPAND_FILL; mid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.add_child(mid)

	var bot := UI.hb(16)
	bot.alignment = BoxContainer.ALIGNMENT_CENTER
	bot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bot.add_child(UI.btn("Сделать снимок", "icons/camera", func():
		photo_ui.visible = false
		await main.take_photo()
		photo_ui.visible = true, "primary", 68))
	vb.add_child(bot)

func _build_decor_ui() -> void:
	decor_ui = Control.new()
	decor_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	decor_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	decor_ui.visible = false
	root.add_child(decor_ui)

	var m := MarginContainer.new()
	m.set_anchors_preset(Control.PRESET_FULL_RECT)
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.add_theme_constant_override("margin_left", 16)
	m.add_theme_constant_override("margin_right", 16)
	m.add_theme_constant_override("margin_top", 14)
	m.add_theme_constant_override("margin_bottom", 14)
	decor_ui.add_child(m)

	var vb := UI.vb(10)
	vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.add_child(vb)

	var top := UI.hb(12)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var info_p := PanelContainer.new()
	info_p.add_theme_stylebox_override("panel", UI.sb(UI.CREAM, 18, UI.CREAM2, 2, 4, 10))
	decor_info = UI.lbl("Выбери предмет снизу и нажми на кружок-место в клетке", 20, UI.BROWN, false, true)
	info_p.add_child(decor_info)
	top.add_child(info_p)
	var sp := Control.new(); sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL; sp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(sp)
	top.add_child(UI.btn("Готово", "", func(): enter_decor_mode(false), "primary", 56))
	vb.add_child(top)

	var mid := Control.new(); mid.size_flags_vertical = Control.SIZE_EXPAND_FILL; mid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.add_child(mid)

	var tray_p := PanelContainer.new()
	tray_p.add_theme_stylebox_override("panel", UI.sb(UI.CREAM, 22, UI.CREAM2, 2, 6, 10))
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(0, 94)
	sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	decor_tray = UI.hb(10)
	sc.add_child(decor_tray)
	tray_p.add_child(sc)
	vb.add_child(tray_p)

func _build_cutscene_ui() -> void:
	cutscene_ui = Control.new()
	cutscene_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	cutscene_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cutscene_ui.visible = false
	root.add_child(cutscene_ui)

	var m := MarginContainer.new()
	m.set_anchors_preset(Control.PRESET_FULL_RECT)
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.add_theme_constant_override("margin_left", 24)
	m.add_theme_constant_override("margin_right", 24)
	m.add_theme_constant_override("margin_bottom", 24)
	m.add_theme_constant_override("margin_top", 20)
	cutscene_ui.add_child(m)

	var vb := UI.vb(12)
	vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	m.add_child(vb)

	var sp := Control.new()
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.add_child(sp)

	var bot := UI.hb(14)
	bot.alignment = BoxContainer.ALIGNMENT_CENTER
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", UI.sb(Color(0.995, 0.968, 0.915, 0.96), 22, UI.SAGE, 2, 8, 14))
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cutscene_lbl = UI.lbl("", 22, UI.BROWN, true, true)
	cutscene_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	card.add_child(cutscene_lbl)
	bot.add_child(card)
	bot.add_child(UI.btn("Пропустить", "", func():
		if main:
			main.skip_arrival_cutscene(), "secondary", 56))
	vb.add_child(bot)

func show_cutscene_ui(on: bool, text := "") -> void:
	if hud_box:
		hud_box.visible = not on
	if cutscene_ui:
		cutscene_ui.visible = on
	if text != "" and cutscene_lbl:
		cutscene_lbl.text = text

func set_cutscene_text(text: String) -> void:
	if cutscene_lbl:
		cutscene_lbl.text = text

func _build_toast() -> void:
	toast_panel = PanelContainer.new()
	toast_panel.add_theme_stylebox_override("panel", UI.sb(Color(0.24, 0.19, 0.14, 0.92), 18, UI.CREAM2, 1, 6, 12))
	toast_panel.anchor_left = 0.5
	toast_panel.anchor_right = 0.5
	toast_panel.anchor_top = 0.0
	toast_panel.offset_left = -300
	toast_panel.offset_right = 300
	toast_panel.offset_top = 82
	toast_panel.offset_bottom = 136
	toast_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	toast_panel.visible = false
	toast_lbl = UI.lbl("", 20, Color.WHITE, true, true)
	toast_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_panel.add_child(toast_lbl)
	root.add_child(toast_panel)

func _build_modal_layer() -> void:
	modal_backdrop = ColorRect.new()
	modal_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	modal_backdrop.color = Color(0.12, 0.09, 0.06, 0.38)
	modal_backdrop.visible = false
	root.add_child(modal_backdrop)

	modal_host = CenterContainer.new()
	modal_host.set_anchors_preset(Control.PRESET_FULL_RECT)
	modal_host.visible = false
	root.add_child(modal_host)

# =====================================================================
#  Обновление и уведомления
# =====================================================================
func toast(msg: String, _kind := "info") -> void:
	if msg == "":
		return
	toast_lbl.text = msg
	toast_panel.visible = true
	_toast_t = 3.2
	if hint_wrap:
		hint_wrap.visible = false

func refresh_soft() -> void:
	if Game.state.is_empty():
		return
	if coins_lbl:
		coins_lbl.text = str(int(Game.state.coins))
	var pb := top_bar.get_node_or_null("PetsTopBtn") as Button
	if pb:
		pb.text = str(Game.live_rats().size())
	if pen_switch_btn:
		pen_switch_btn.visible = bool(Game.state.playpen)
	_refresh_hint()
	on_selection()

func _refresh_hint() -> void:
	if not hint_wrap:
		return
	if not bool(Game.setting("hints")) or not bool(Game.state.intro_done) or _toast_t > 0.0:
		hint_wrap.visible = false
		return
	var next_q: Dictionary = {}
	for q in Data.QUESTS:
		if q.group == "start" and not bool(Game.state.quests.get(q.id, false)):
			next_q = q
			break
	if next_q.is_empty():
		hint_wrap.visible = false
	else:
		hint_lbl.text = "Совет: %s (+%d монет)" % [next_q.name, int(next_q.reward)]
		hint_wrap.visible = true

func on_selection() -> void:
	if not sel_panel or not main:
		return
	UI.clear(sel_box)
	var r: Rat = main.selected
	if r == null or not is_instance_valid(r) or main.mode != "normal":
		sel_panel.visible = false
		return
	sel_panel.visible = true

	sel_box.add_child(UI.btn(r.display_name(), "", func(): open_card(r), "secondary", 54))

	pet_mode_btn = UI.btn("Погладить" if not main.pet_mode else "Гладим ♥", "icons/trust", func():
		main.play_mode = false
		main.pet_mode = not main.pet_mode
		if main.pet_mode:
			toast("Проведи пальцем по %s, чтобы нежно погладить!" % r.display_name())
		else:
			r.cmd_release()
		on_selection(), "accent" if main.pet_mode else "primary", 54)
	sel_box.add_child(pet_mode_btn)

	sel_box.add_child(UI.btn("Угостить", "icons/fruit_treat", func():
		var msg := r.cmd_treat()
		if msg != "":
			toast(msg, "rat")
		refresh_soft(), "primary", 54))

	sel_box.add_child(UI.btn("Позвать", "", func():
		var msg := r.cmd_call()
		if msg != "":
			toast(msg, "rat"), "secondary", 54))

	play_mode_btn = UI.btn("Поиграть" if not main.play_mode else "Стоп игра", "icons/training_target", func():
		main.pet_mode = false
		main.play_mode = not main.play_mode
		if main.play_mode:
			toast("Води пальцем по полу клетки — %s побежит за ним!" % r.display_name())
		else:
			r.cmd_release()
		on_selection(), "accent" if main.play_mode else "secondary", 54)
	sel_box.add_child(play_mode_btn)

	sel_box.add_child(UI.btn("Трюки", "", func(): open_training(r), "secondary", 54))
	sel_box.add_child(UI.btn("Фото", "icons/camera", func():
		main.follow_selected(true)
		enter_photo_mode(true), "secondary", 54))

# =====================================================================
#  Модальные окна (база)
# =====================================================================
func _open_modal(title: String, min_size := Vector2(780, 520), closable := true) -> VBoxContainer:
	_close_modal()
	_modal_open = true
	modal_backdrop.visible = true
	modal_host.visible = true

	var panel := PanelContainer.new()
	panel.custom_minimum_size = min_size
	modal_host.add_child(panel)

	var vb := UI.vb(12)
	panel.add_child(vb)

	var hdr := UI.hb(10)
	var t := UI.lbl(title, 28, UI.BROWN, false, true)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hdr.add_child(t)
	if closable:
		hdr.add_child(UI.btn("✕", "", func(): _close_modal(), "secondary", 46))
	vb.add_child(hdr)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vb.add_child(scroll)

	var body := UI.vb(12)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(body)
	return body

func _close_modal() -> void:
	_modal_open = false
	_preview_rat = null
	_preview_turntable = null
	_preview_dragging = false
	if modal_backdrop:
		modal_backdrop.visible = false
	if modal_host:
		modal_host.visible = false
		UI.clear(modal_host)

func back() -> bool:
	if _modal_open:
		_close_modal()
		return true
	if main.mode == "photo":
		enter_photo_mode(false)
		return true
	if main.mode == "decor":
		enter_decor_mode(false)
		return true
	return false

func confirm_exit() -> void:
	var body := _open_modal("Выйти из игры?", Vector2(520, 220))
	body.add_child(UI.lbl("Прогресс сохраняется автоматически. Хочешь выйти из RAT HOME?", 22))
	var row := UI.hb(12)
	row.add_child(UI.btn("Остаться", "", func(): _close_modal(), "secondary", 56))
	row.add_child(UI.btn("Выйти", "", func():
		Game.save_game()
		main.get_tree().quit(), "accent", 56))
	body.add_child(row)

# =====================================================================
#  1. Приветствие, визуальный выбор крыски из зоомагазина и кат-сцена
# =====================================================================
func start_intro() -> void:
	var body := _open_modal("Добро пожаловать домой!", Vector2(720, 340), false)
	body.add_child(UI.lbl("В твоей уютной комнате на комоде уже стоит просторная клетка с домиком, гамаком, миской и свежей водичкой.", 22, UI.BROWN, true, false))
	body.add_child(UI.lbl("Давай заглянем в зоомагазин и выберем твою первую крыску!", 22, UI.SAGE_D, true, true))

	var row := UI.hb(12)
	var sp := Control.new(); sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(sp)
	row.add_child(UI.btn("Выбрать крыску в зоомагазине →", "", func(): _show_intro_customizer(), "primary", 60))
	body.add_child(row)

func _show_intro_customizer() -> void:
	var body := _open_modal("Зоомагазин — выбери свою первую крыску", Vector2(980, 600), false)
	_build_customizer_controls(body, func():
		var rats := Game.live_rats()
		var first_node: Rat = null
		if not rats.is_empty():
			var r: Dictionary = rats[0]
			r.name = _custom_name.strip_edges() if _custom_name.strip_edges() != "" else "Тимма"
			r.sex = _custom_sex
			r.app = Data.appearance_from_coat(_custom_coat, _custom_eye, _custom_ears, _custom_rex)
			main.refresh_rat_model(int(r.id))
			if main.rats.has(int(r.id)):
				first_node = main.rats[int(r.id)]
		Game.state.intro_done = true
		Game.set_flag("named")
		Game.save_game()
		_close_modal()
		main.play_arrival_cutscene(first_node), "Забрать домой!")

func _set_btn_style(b: Button, style: String) -> void:
	match style:
		"primary":
			b.add_theme_stylebox_override("normal", UI.sb(UI.SAGE, 18, UI.SAGE_D, 1, 3, 12))
			b.add_theme_stylebox_override("hover", UI.sb(UI.SAGE.lightened(0.08), 18, UI.SAGE_D, 1, 3, 12))
			b.add_theme_stylebox_override("pressed", UI.sb(UI.SAGE_D, 18, UI.SAGE_D, 1, 1, 12))
			for c in ["font_color", "font_hover_color", "font_pressed_color"]:
				b.add_theme_color_override(c, Color.WHITE)
		"secondary":
			b.add_theme_stylebox_override("normal", UI.sb(UI.CREAM2, 18, Color(0.80, 0.73, 0.63), 1, 2, 12))
			b.add_theme_stylebox_override("hover", UI.sb(UI.CREAM2.lightened(0.12), 18, Color(0.75, 0.67, 0.56), 1, 2, 12))
			b.add_theme_stylebox_override("pressed", UI.sb(UI.CREAM2.darkened(0.08), 18, Color(0.70, 0.62, 0.52), 1, 0, 12))
			for c in ["font_color", "font_hover_color", "font_pressed_color"]:
				b.add_theme_color_override(c, UI.BROWN)

func _build_live_3d_preview() -> Control:
	# Левая колонка: живая 3D-витрина с вращающейся крыской (можно крутить пальцем/мышкой!)
	var wrap := UI.vb(8)
	wrap.custom_minimum_size = Vector2(390, 420)

	var frame := PanelContainer.new()
	frame.add_theme_stylebox_override("panel", UI.sb(Color(0.24, 0.20, 0.17), 20, UI.SAGE, 2, 4, 4))
	frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	frame.custom_minimum_size = Vector2(390, 345)

	var svc := SubViewportContainer.new()
	svc.stretch = true
	svc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	svc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	svc.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
			_preview_dragging = ev.pressed
		elif ev is InputEventMouseMotion and _preview_dragging:
			_preview_yaw += ev.relative.x * 0.014
		elif ev is InputEventScreenTouch:
			_preview_dragging = ev.pressed
		elif ev is InputEventScreenDrag:
			_preview_yaw += ev.relative.x * 0.014)
	frame.add_child(svc)

	var vp := SubViewport.new()
	vp.own_world_3d = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_DISABLED
	vp.size = Vector2i(480, 420)
	svc.add_child(vp)

	var we := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.27, 0.23, 0.19)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.98, 0.92, 0.85)
	e.ambient_light_energy = 0.56
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.tonemap_exposure = 0.95
	we.environment = e
	vp.add_child(we)

	var key_l := DirectionalLight3D.new()
	key_l.rotation = Vector3(-0.62, 0.55, 0)
	key_l.light_energy = 0.72
	key_l.light_color = Color(1.0, 0.96, 0.90)
	vp.add_child(key_l)

	var fill_l := DirectionalLight3D.new()
	fill_l.rotation = Vector3(-0.35, -2.2, 0)
	fill_l.light_energy = 0.30
	fill_l.light_color = Color(0.86, 0.92, 1.0)
	vp.add_child(fill_l)

	# Студийная подставка
	var ped := MeshInstance3D.new()
	var pc := CylinderMesh.new()
	pc.top_radius = 1.65; pc.bottom_radius = 1.75; pc.height = 0.22; pc.radial_segments = 32
	ped.mesh = pc
	ped.position = Vector3(0, -0.11, 0)
	ped.material_override = Items3D.mat(Color(0.64, 0.52, 0.39), 0.78, "wood")
	vp.add_child(ped)

	_preview_turntable = Node3D.new()
	_preview_yaw = 2.45
	_preview_turntable.rotation.y = _preview_yaw
	vp.add_child(_preview_turntable)

	_preview_rat = RatModel.new()
	_preview_rat.build(Data.appearance_from_coat(_custom_coat, _custom_eye, _custom_ears, _custom_rex))
	_preview_rat.scale = Vector3.ONE * 1.0
	_preview_turntable.add_child(_preview_rat)

	var cam := Camera3D.new()
	cam.fov = 34.0
	vp.add_child(cam)
	cam.look_at_from_position(Vector3(0.0, 1.35, 4.15), Vector3(0.0, 0.48, 0.0), Vector3.UP)
	cam.current = true

	wrap.add_child(frame)

	# Кнопки просмотра поз прямо на витрине
	var poses := UI.hb(6)
	poses.alignment = BoxContainer.ALIGNMENT_CENTER
	for p_item in [["Обнюх.", "Idle_Sniff"], ["Стойка", "Rear_Beg"], ["Ест", "Eat_Nibble"], ["Спит", "Sleep_Curl"]]:
		var clip_id: String = p_item[1]
		var pb := UI.btn(p_item[0], "", func():
			if _preview_rat and is_instance_valid(_preview_rat):
				_preview_rat.play_clip(clip_id, 1.0), "secondary", 40)
		pb.add_theme_font_size_override("font_size", 16)
		poses.add_child(pb)
	wrap.add_child(poses)

	var hint := UI.lbl("Покрути крыску пальцем или мышкой на 360°", 15, UI.BROWN.lightened(0.22), true, false)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	wrap.add_child(hint)
	return wrap

func _build_customizer_controls(body: VBoxContainer, on_confirm: Callable, confirm_text: String) -> void:
	var split := UI.hb(18)
	split.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_child(split)

	# Слева: живая 3D-крыска
	split.add_child(_build_live_3d_preview())

	# Справа: имя, пол, визуальный выпадающий список окрасов, ушки/шерсть/глаза
	var right := UI.vb(12)
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	split.add_child(right)

	right.add_child(UI.lbl("Имя и пол:", 19, UI.BROWN, false, true))
	var top := UI.hb(8)
	var name_ed := LineEdit.new()
	name_ed.text = _custom_name
	name_ed.placeholder_text = "Имя крыски..."
	name_ed.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_ed.text_changed.connect(func(v): _custom_name = v)
	top.add_child(name_ed)

	var refs := {}
	var desc_lbl := UI.lbl("", 17, UI.SAGE_D, true, true)

	var sync_ui := func():
		_set_btn_style(refs["m"], "primary" if _custom_sex == "m" else "secondary")
		_set_btn_style(refs["f"], "primary" if _custom_sex == "f" else "secondary")
		refs["ear"].text = "Ушки: " + ("Дамбо" if _custom_ears == "dumbo" else "Стандарт")
		refs["rex"].text = "Шерсть: " + ("Рекс" if _custom_rex else "Гладкая")
		refs["eye"].text = "Глаза: " + Data.EYES[_custom_eye].name
		var app_d := Data.appearance_from_coat(_custom_coat, _custom_eye, _custom_ears, _custom_rex)
		desc_lbl.text = Data.describe_appearance(app_d)

	var btn_m := UI.btn("♂ Самец", "", func():
		_custom_sex = "m"
		sync_ui.call(), "primary" if _custom_sex == "m" else "secondary", 50)
	var btn_f := UI.btn("♀ Самка", "", func():
		_custom_sex = "f"
		sync_ui.call(), "primary" if _custom_sex == "f" else "secondary", 50)
	refs["m"] = btn_m
	refs["f"] = btn_f
	top.add_child(btn_m)
	top.add_child(btn_f)
	right.add_child(top)

	# Визуальный выпадающий список всех 21 окрасов с миниатюрами!
	right.add_child(UI.lbl("Окрас (выпадающий список — смотри на крыску слева):", 19, UI.BROWN, false, true))
	var coat_opt := OptionButton.new()
	coat_opt.custom_minimum_size = Vector2(0, 58)
	coat_opt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	coat_opt.clip_text = true
	var sel_idx := 0
	for i in Data.COATS.size():
		var c: Dictionary = Data.COATS[i]
		var ico: Texture2D = UI.tex("rats/" + str(c.img)) if str(c.img) != "" else UI.swatch_tex(Data.appearance_from_coat(c.id))
		if ico:
			coat_opt.add_icon_item(ico, "%d. %s" % [i + 1, str(c.name)], i)
		else:
			coat_opt.add_item("%d. %s" % [i + 1, str(c.name)], i)
		if c.id == _custom_coat:
			sel_idx = i
	coat_opt.selected = sel_idx
	coat_opt.item_selected.connect(func(idx: int):
		var c: Dictionary = Data.COATS[idx]
		_custom_coat = c.id
		var allowed: Array = c.eyes
		if not _custom_eye in allowed:
			_custom_eye = allowed[0]
		_apply_live_preview()
		sync_ui.call()
		Sfx.play("click"))
	right.add_child(coat_opt)

	# Ушки + Шерсть + Глаза
	right.add_child(UI.lbl("Особенности внешности:", 19, UI.BROWN, false, true))
	var opts := UI.hb(8)
	var ear_btn := UI.btn("Ушки: " + ("Дамбо" if _custom_ears == "dumbo" else "Стандарт"), "", func():
		_custom_ears = "dumbo" if _custom_ears == "normal" else "normal"
		_apply_live_preview()
		sync_ui.call(), "secondary", 52)
	ear_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var rex_btn := UI.btn("Шерсть: " + ("Рекс" if _custom_rex else "Гладкая"), "", func():
		_custom_rex = not _custom_rex
		_apply_live_preview()
		sync_ui.call(), "secondary", 52)
	rex_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var eye_btn := UI.btn("Глаза: " + Data.EYES[_custom_eye].name, "", func():
		var allowed: Array = Data.coat(_custom_coat).eyes
		var idx := allowed.find(_custom_eye)
		_custom_eye = allowed[(idx + 1) % allowed.size()]
		_apply_live_preview()
		sync_ui.call(), "secondary", 52)
	eye_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	refs["ear"] = ear_btn
	refs["rex"] = rex_btn
	refs["eye"] = eye_btn
	opts.add_child(ear_btn)
	opts.add_child(rex_btn)
	opts.add_child(eye_btn)
	right.add_child(opts)

	var summary_card := UI.card(Color(0.95, 0.91, 0.83, 0.85), 12)
	summary_card.add_child(desc_lbl)
	right.add_child(summary_card)

	var sp2 := Control.new()
	sp2.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(sp2)

	right.add_child(UI.btn(confirm_text, "", on_confirm, "accent", 64))
	sync_ui.call()

func _apply_live_preview() -> void:
	var app := Data.appearance_from_coat(_custom_coat, _custom_eye, _custom_ears, _custom_rex)
	if _preview_rat and is_instance_valid(_preview_rat):
		_preview_rat.build(app)
	if not bool(Game.state.intro_done):
		var rats := Game.live_rats()
		if not rats.is_empty():
			rats[0].app = app
			main.refresh_rat_model(int(rats[0].id))

func _reopen_or_toast(msg: String) -> void:
	toast(msg)

# =====================================================================
#  2. Карточка питомца
# =====================================================================
func open_card(r: Rat) -> void:
	var d: Dictionary = r.data
	var body := _open_modal("Карточка питомца: " + r.display_name(), Vector2(780, 560))

	# Шапка с портретом и переименованием
	var hdr := UI.hb(14)
	hdr.add_child(UI.tex_rect(main.portraits.get_portrait(d.app, float(d.age)), 120))
	var info := UI.vb(6)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var name_row := UI.hb(8)
	var ne := LineEdit.new()
	ne.text = d.name
	ne.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_row.add_child(ne)
	name_row.add_child(UI.btn("Переименовать", "", func():
		var nn := ne.text.strip_edges()
		if nn != "":
			d.name = nn
			Game.set_flag("named")
			Game.save_game()
			toast("Новое имя: " + nn)
			open_card(r), "secondary", 48))
	info.add_child(name_row)

	var sex_s := "♂ Самец" if d.sex == "m" else "♀ Самка"
	info.add_child(UI.lbl("%s • %d нед. (%s)" % [sex_s, int(d.age), Game.stage_name(float(d.age))], 20, UI.BROWN, true, true))
	info.add_child(UI.lbl("Характер: %s — %s" % [Data.personality_name(d.personality, d.sex), Data.PERSONALITIES[d.personality].desc], 18))
	info.add_child(UI.lbl("Внешность: " + Data.describe_appearance(d.app), 18))
	info.add_child(UI.lbl("Сейчас: " + r.state_text(), 18, UI.SAGE_D, true, true))
	hdr.add_child(info)
	body.add_child(hdr)

	# Шкалы состояния
	var sc := UI.card()
	var sv := UI.vb(8)
	sv.add_child(UI.stat_row("Сытость", float(d.satiety), UI.GOLD))
	sv.add_child(UI.stat_row("Здоровье", float(d.health), UI.SAGE))
	sv.add_child(UI.stat_row("Комфорт", float(d.comfort), Color(0.45, 0.62, 0.78)))
	sv.add_child(UI.stat_row("Доверие к тебе", float(d.trust), UI.ACCENT))
	sv.add_child(UI.stat_row("Бодрость", float(d.energy), Color(0.58, 0.72, 0.52)))
	sc.add_child(sv)
	body.add_child(sc)

	# Любимая игрушка
	var fav: String = str(d.get("fav_toy", ""))
	var fav_name: String = Data.ITEMS[fav].name if fav != "" and Data.ITEMS.has(fav) else "ещё определяется по играм"
	body.add_child(UI.lbl("Любимая игрушка: " + fav_name, 19, UI.BROWN, true, true))

	# Трюки
	var tc := UI.card()
	var tv := UI.vb(6)
	var th := UI.hb(8)
	var tl := UI.lbl("Изученные трюки", 20, UI.BROWN, false, true)
	tl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	th.add_child(tl)
	th.add_child(UI.btn("Обучить трюку", "", func(): open_training(r), "primary", 44))
	tv.add_child(th)
	for tid in Data.TRICKS:
		var prog := int(d.tricks.get(tid, 0.0))
		var tr_row := UI.hb(8)
		var tr_lbl := UI.lbl("%s — %d%%" % [Data.TRICKS[tid].name, prog], 18)
		tr_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tr_row.add_child(tr_lbl)
		if prog >= 100:
			var t_key: String = tid
			tr_row.add_child(UI.btn("Команда!", "", func():
				_close_modal()
				r.perform(Data.TRICKS[t_key].anim, 2.8)
				toast("%s выполняет «%s»!" % [r.display_name(), Data.TRICKS[t_key].name]), "primary", 40))
		tv.add_child(tr_row)
	tc.add_child(tv)
	body.add_child(tc)

	# Родословная (если включено разведение или крыска родилась в стае)
	if bool(Game.setting("breeding")) or str(d.get("born_note", "")) != "":
		var pc := UI.card()
		var pv := UI.vb(4)
		pv.add_child(UI.lbl("Семейная история / родословная", 20, UI.BROWN, false, true))
		pv.add_child(UI.lbl(str(d.get("born_note", "Первое поколение домашней стаи.")), 18))
		pc.add_child(pv)
		body.add_child(pc)

	# Действия (Ветеринар, Манеж)
	var acts := UI.hb(10)
	acts.add_child(UI.btn("Осмотр ветеринара", "", func():
		toast(Game.vet_visit(d))
		open_card(r), "secondary", 52))
	if bool(Game.state.playpen):
		var to_a := "pen" if r.area() == "cage" else "cage"
		acts.add_child(UI.btn("Перенести в " + ("манеж" if to_a == "pen" else "клетку"), "", func():
			r.move_area(to_a)
			main.focus_area(to_a)
			_close_modal(), "primary", 52))
	body.add_child(acts)

# =====================================================================
#  3. Список питомцев
# =====================================================================
func open_pets_list() -> void:
	var body := _open_modal("Мои крыски (%d/%d)" % [Game.live_rats().size(), Game.max_pets()], Vector2(740, 500))
	for r in main.rat_nodes():
		var c := UI.card()
		var hb := UI.hb(12)
		hb.add_child(UI.tex_rect(main.portraits.get_portrait(r.data.app, float(r.data.age)), 82))
		var vb := UI.vb(4)
		vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		vb.add_child(UI.lbl("%s (%s)" % [r.display_name(), Data.personality_name(r.data.personality, r.data.sex)], 22, UI.BROWN, true, true))
		vb.add_child(UI.lbl("%s • Доверие %d%% • Сытость %d%%" % [r.state_text(), int(r.data.trust), int(r.data.satiety)], 18))
		hb.add_child(vb)
		var rat_ref: Rat = r
		hb.add_child(UI.btn("Найти", "", func():
			main.select_rat(rat_ref)
			main.follow_selected(false)
			_close_modal(), "secondary", 48))
		hb.add_child(UI.btn("Карточка", "", func(): open_card(rat_ref), "primary", 48))
		c.add_child(hb)
		body.add_child(c)
	if Game.live_rats().size() < Game.max_pets():
		body.add_child(UI.btn("+ Завести ещё одну крыску (%d монет)" % Data.ADOPT_PRICE, "icons/pets", func(): open_shop("adopt"), "accent", 58))

# =====================================================================
#  4. Магазин (все 9 разделов + Центр знакомства)
# =====================================================================
func open_shop(tab := "food") -> void:
	var sz := Vector2(990, 615) if tab == "adopt" else Vector2(900, 590)
	var body := _open_modal("Магазин • %d монет" % int(Game.state.coins), sz)
	var tabs_sc := ScrollContainer.new()
	tabs_sc.custom_minimum_size = Vector2(0, 62)
	tabs_sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var th := UI.hb(6)
	for t in Data.SHOP_TABS:
		var tid: String = t[0]
		th.add_child(UI.btn(t[1], "", func(): open_shop(tid), "primary" if tab == tid else "secondary", 48))
	tabs_sc.add_child(th)
	body.add_child(tabs_sc)

	if tab == "food":
		for fid in Data.FOODS:
			var f: Dictionary = Data.FOODS[fid]
			var key: String = fid
			var have := int(Game.state.food.get(key, 0))
			_shop_row(body, f.name, "%s (Есть: %d)" % [f.desc, have], f.icon, int(f.price), "Купить ×%d" % int(f.pack), func():
				if Game.buy_food(key):
					open_shop("food"))
	elif tab == "themes":
		for th_id in Data.THEMES:
			var th_d: Dictionary = Data.THEMES[th_id]
			var key: String = th_id
			var owned: bool = key in Game.state.owned_themes
			var active: bool = Game.state.theme == key
			var btn_t := "Активна ✓" if active else ("Выбрать" if owned else "Купить")
			_shop_row(body, th_d.name, "Меняет атмосферу и освещение комнаты.", "icons/shop", 0 if owned else int(th_d.price), btn_t, func():
				if not active and Game.buy_theme(key):
					open_shop("themes"))
	elif tab == "adopt":
		body.add_child(UI.lbl("Завести нового друга в стаю (%d монет). Выбери внешность и имя:" % Data.ADOPT_PRICE, 20, UI.BROWN, true, true))
		_build_customizer_controls(body, func():
			if Game.live_rats().size() >= Game.max_pets():
				toast("В клетке уже максимум питомцев!")
				return
			if Game.spend(Data.ADOPT_PRICE):
				var rname := _custom_name.strip_edges() if _custom_name.strip_edges() != "" else "Жорж"
				var nr := Game.make_rat(_custom_coat, _custom_sex, rname, "", 6.0, _custom_eye, _custom_ears, _custom_rex)
				Game.add_rat(nr)
				Game.save_game()
				_close_modal()
				toast("Добро пожаловать, %s!" % rname, "rat"), "Завести за %d монет" % Data.ADOPT_PRICE)
	else:
		# Улучшения клетки и манеж на вкладке "cages"
		if tab == "cages":
			for uid in Data.UPGRADES:
				var u: Dictionary = Data.UPGRADES[uid]
				var key: String = uid
				var done := (key == "cage_xl" and int(Game.state.cage.level) >= 2) or (key == "playpen" and bool(Game.state.playpen))
				_shop_row(body, u.name, u.desc, u.icon, 0 if done else int(u.price), "Открыто ✓" if done else "Купить", func():
					if not done and Game.buy_upgrade(key):
						open_shop("cages"))
		for iid in Data.ITEMS:
			var it: Dictionary = Data.ITEMS[iid]
			if it.cat != tab:
				continue
			var key: String = iid
			var have := int(Game.state.inventory.get(key, 0))
			_shop_row(body, it.name, "%s (В инвентаре: %d)" % [it.desc, have], it.icon, int(it.price), "Купить", func():
				if Game.buy_item(key):
					toast("Куплено: %s! Установи через кнопку «Обустроить»." % it.name)
					open_shop(tab))

func _shop_row(body: VBoxContainer, title: String, desc: String, icon_p: String, price: int, btn_text: String, cb: Callable) -> void:
	var c := UI.card()
	var hb := UI.hb(12)
	if icon_p != "":
		hb.add_child(UI.icon(icon_p, 64))
	var vb := UI.vb(3)
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vb.add_child(UI.lbl(title, 21, UI.BROWN, true, true))
	vb.add_child(UI.lbl(desc, 17))
	hb.add_child(vb)
	var label := ("%d • %s" % [price, btn_text]) if price > 0 else btn_text
	hb.add_child(UI.btn(label, "icons/coin" if price > 0 else "", cb, "primary", 52))
	c.add_child(hb)
	body.add_child(c)

# =====================================================================
#  5. Уход, кормление миски и мягкая уборка
# =====================================================================
func open_care() -> void:
	var body := _open_modal("Уход и уют клетки", Vector2(760, 520))
	var f: Dictionary = Game.state.food
	var row1 := UI.hb(10)
	row1.add_child(UI.btn("Насыпать корм (%d)" % int(f.pellets), "icons/pellet_food", func():
		toast(Game.fill_bowl()); open_care(), "primary", 58))
	row1.add_child(UI.btn("Свежая вода", "icons/water_pitcher", func():
		toast(Game.refresh_water()); open_care(), "primary", 58))
	body.add_child(row1)

	var row2 := UI.hb(10)
	row2.add_child(UI.btn("Добавить овощи (%d)" % int(f.veg), "icons/vegetables", func():
		toast(Game.give_bowl_extra("veg")); open_care(), "secondary", 54))
	row2.add_child(UI.btn("Добавить фрукты (%d)" % int(f.fruit), "icons/fruit_treat", func():
		toast(Game.give_bowl_extra("fruit")); open_care(), "secondary", 54))
	body.add_child(row2)

	body.add_child(UI.lbl("Мягкая уборка (общая чистота: %d%%):" % int(Game.clean_avg()), 21, UI.BROWN, false, true))
	for area_k in ["litter", "tray", "bowls", "shelves", "hammock", "leftovers"]:
		var ak: String = area_k
		var val := int(Game.clean_value(ak))
		var cr := UI.hb(10)
		var l := UI.lbl("%s — %d%%" % [Game.CLEAN_AREAS[ak], val], 19)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cr.add_child(l)
		cr.add_child(UI.btn("Освежить", "icons/sponge", func():
			toast(Game.cleaned(ak))
			open_care(), "secondary", 46))
		body.add_child(cr)

# =====================================================================
#  6. Дрессировка трюков (с 3D-реквизитом)
# =====================================================================
func open_training(r: Rat) -> void:
	main.begin_session(r)
	var body := _open_modal("Обучение трюкам: " + r.display_name(), Vector2(760, 520), false)
	body.add_child(UI.lbl("Угощения ускоряют обучение! В запасе: %d шт." % int(Game.state.food.get("treat", 0)), 19, UI.SAGE_D, true, true))

	for tid in Data.TRICKS:
		var tinfo: Dictionary = Data.TRICKS[tid]
		var tkey: String = tid
		var prog := int(r.data.tricks.get(tkey, 0.0))
		var c := UI.card()
		var hb := UI.hb(10)
		var vb := UI.vb(3)
		vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		vb.add_child(UI.lbl("%s (%d%%)" % [tinfo.name, prog], 20, UI.BROWN, true, true))
		vb.add_child(UI.lbl(tinfo.desc, 17))
		hb.add_child(vb)
		hb.add_child(UI.btn("Показать" if prog >= 100 else "Тренировать", "icons/training_target", func():
			main.session_prop(tinfo.anim, r)
			r.perform(tinfo.anim, 2.4)
			if prog < 100:
				var res := Game.train_trick(r.data, tkey, true)
				toast("Прогресс «%s»: %d%%" % [tinfo.name, int(res.progress)])
				open_training(r)
			else:
				toast("%s блестяще выполняет «%s»!" % [r.display_name(), tinfo.name]), "primary", 50))
		c.add_child(hb)
		body.add_child(c)

	body.add_child(UI.btn("Завершить занятие", "", func():
		main.end_session(r)
		_close_modal(), "secondary", 56))

# =====================================================================
#  7. Задания и достижения
# =====================================================================
func open_quests() -> void:
	var body := _open_modal("Задания и достижения", Vector2(780, 540))
	body.add_child(UI.lbl("Задания:", 22, UI.BROWN, false, true))
	for q in Data.QUESTS:
		var done := bool(Game.state.quests.get(q.id, false))
		var c := UI.card(Color(0.90, 0.96, 0.91, 0.85) if done else Color(1, 1, 1, 0.72))
		var hb := UI.hb(10)
		var l := UI.lbl(("%s %s" % ["✓" if done else "•", q.name]), 19, UI.BROWN, true, done)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hb.add_child(l)
		hb.add_child(UI.lbl("+%d" % int(q.reward), 19, UI.SAGE_D, false, true))
		c.add_child(hb)
		body.add_child(c)

	body.add_child(UI.lbl("Достижения:", 22, UI.BROWN, false, true))
	for a in Data.ACHIEVEMENTS:
		var done := bool(Game.state.ach.get(a.id, false))
		var cur := int(Game.state.counters.get(a.counter, 0))
		var c := UI.card(Color(0.99, 0.95, 0.84, 0.9) if done else Color(1, 1, 1, 0.7))
		var hb := UI.hb(10)
		var vb := UI.vb(2)
		vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		vb.add_child(UI.lbl(("%s %s" % ["★" if done else "☆", a.name]), 20, UI.BROWN, true, true))
		vb.add_child(UI.lbl("%s (%d/%d)" % [a.desc, mini(cur, int(a.need)), int(a.need)], 17))
		hb.add_child(vb)
		hb.add_child(UI.lbl("+%d" % int(a.reward), 19, UI.ACCENT, false, true))
		c.add_child(hb)
		body.add_child(c)

# =====================================================================
#  8. Фотоальбом и воспоминания
# =====================================================================
func open_album() -> void:
	var body := _open_modal("Фотоальбом (%d)" % Game.state.album.size(), Vector2(800, 540))
	body.add_child(UI.btn("Открыть фоторежим", "icons/camera", func():
		_close_modal()
		enter_photo_mode(true), "primary", 54))
	if Game.state.album.is_empty():
		body.add_child(UI.lbl("Пока здесь пусто — сделай первый уютный снимок своих крысок!", 20))
		return
	var rev: Array = Game.state.album.duplicate()
	rev.reverse()
	for entry in rev:
		var c := UI.card()
		var vb := UI.vb(6)
		if entry.get("type", "") == "photo" and FileAccess.file_exists(str(entry.get("path", ""))):
			var img := Image.load_from_file(str(entry.path))
			if img:
				var tr := TextureRect.new()
				tr.texture = ImageTexture.create_from_image(img)
				tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
				tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
				tr.custom_minimum_size = Vector2(0, 240)
				vb.add_child(tr)
		vb.add_child(UI.lbl(str(entry.get("text", "Снимок")), 19, UI.BROWN, true, true))
		c.add_child(vb)
		body.add_child(c)

# =====================================================================
#  9. Настройки жизненного цикла (4 переключателя + срок жизни!), звук, табличка
# =====================================================================
func open_settings() -> void:
	var body := _open_modal("Настройки", Vector2(800, 580))

	body.add_child(UI.lbl("Жизненный цикл и размножение:", 22, UI.SAGE_D, false, true))
	_toggle_row(body, "Разведение (выкл. по умолчанию)", "Разнополые взрослые крысы с высоким комфортом могут заводить крысят с наследованием окрасов.", "breeding")
	_toggle_row(body, "Старение", "Плавное взросление: крысёнок → подросток → взрослая → пожилая.", "aging")
	_toggle_row(body, "Естественная смерть", "Выключено по умолчанию в комфортном режиме. При отключении пожилые крысы живут вечно.", "death")

	# Выбор продолжительности жизни при включённой естественной смерти!
	if bool(Game.setting("death")):
		var lc := UI.card(Color(0.97, 0.93, 0.85, 0.95))
		var lv := UI.vb(8)
		lv.add_child(UI.lbl("Сколько живут крыски в игре:", 20, UI.BROWN, false, true))
		var lg := GridContainer.new()
		lg.columns = 3
		lg.add_theme_constant_override("h_separation", 8)
		lg.add_theme_constant_override("v_separation", 8)
		var cur_h := float(Game.setting("lifespan_hours") if Game.setting("lifespan_hours") != null else 720.0)
		for opt in [[1.0, "1 час"], [3.0, "3 часа"], [48.0, "2 дня"], [168.0, "1 неделя"], [720.0, "1 месяц"], [2160.0, "3 месяца"]]:
			var hrs: float = opt[0]
			var lbl_s: String = opt[1]
			var active := absf(cur_h - hrs) < 0.5
			lg.add_child(UI.btn(lbl_s, "", func():
				Game.set_setting("lifespan_hours", hrs)
				open_settings(), "primary" if active else "secondary", 46))
		lv.add_child(lg)
		lc.add_child(lv)
		body.add_child(lc)

	_toggle_row(body, "Комфортный режим", "Мягкий режим без стресса: показатели снижаются медленно, питомцы не болеют, смерть отключена.", "comfort")

	body.add_child(UI.lbl("Звук, графика и удобство:", 22, UI.SAGE_D, false, true))
	_toggle_row(body, "60 FPS (плавная картинка)", "Повышенная плавность анимаций на Android.", "fps60")
	_toggle_row(body, "Вибрация при поглаживании", "Мягкий тактильный отклик на смартфоне.", "vibration")
	_toggle_row(body, "Стартовые подсказки", "Показывать мягкую строку-подсказку наверху.", "hints")

	var snd_row := UI.hb(10)
	var mus_on := float(Game.setting("music")) > 0.05
	var sfx_on := float(Game.setting("sfx")) > 0.05
	snd_row.add_child(UI.btn("Музыка: " + ("Вкл" if mus_on else "Выкл"), "", func():
		Game.set_setting("music", 0.0 if mus_on else 0.6)
		open_settings(), "primary" if mus_on else "secondary", 50))
	snd_row.add_child(UI.btn("Звуки: " + ("Вкл" if sfx_on else "Выкл"), "", func():
		Game.set_setting("sfx", 0.0 if sfx_on else 0.8)
		open_settings(), "primary" if sfx_on else "secondary", 50))
	body.add_child(snd_row)

	var foot := UI.hb(10)
	foot.add_child(UI.btn("♥ Памятная табличка", "", func(): open_dedication(), "accent", 52))
	var sp := Control.new(); sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL; foot.add_child(sp)
	foot.add_child(UI.btn("Сбросить игру", "", func():
		Game.reset_game()
		_close_modal()
		start_intro(), "secondary", 52))
	body.add_child(foot)

func _toggle_row(body: VBoxContainer, title: String, desc: String, key: String) -> void:
	var c := UI.card()
	var hb := UI.hb(12)
	var vb := UI.vb(3)
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vb.add_child(UI.lbl(title, 20, UI.BROWN, true, true))
	vb.add_child(UI.lbl(desc, 16))
	hb.add_child(vb)
	var val := bool(Game.setting(key))
	hb.add_child(UI.btn("ВКЛ" if val else "ВЫКЛ", "", func():
		Game.set_setting(key, not val)
		open_settings(), "primary" if val else "secondary", 48))
	c.add_child(hb)
	body.add_child(c)

# =====================================================================
#  10. Памятная табличка и сводка возвращения
# =====================================================================
func open_dedication() -> void:
	var body := _open_modal("Памятная табличка ♥", Vector2(720, 540))
	var tr := TextureRect.new()
	tr.texture = load("res://assets/ui/dedication_plaque.png")
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tr.custom_minimum_size = Vector2(0, 340)
	body.add_child(tr)
	var l := UI.lbl("Эта тёплая табличка всегда висит на стене над клеткой — в память и с любовью к Тимме, Жоржу, Васе и Элвину.", 20, UI.BROWN, true, true)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.add_child(l)

func show_summary() -> void:
	var body := _open_modal("С возвращением домой!", Vector2(680, 400))
	for line in Game.return_summary:
		body.add_child(UI.lbl(str(line), 20))
	body.add_child(UI.btn("Поздороваться с крысками", "", func():
		Game.return_summary.clear()
		_close_modal(), "primary", 56))

# =====================================================================
#  11. Режим обустройства клетки и фоторежим
# =====================================================================
func enter_photo_mode(on: bool) -> void:
	main.mode = "photo" if on else "normal"
	hud_box.visible = not on
	photo_ui.visible = on
	if not on:
		main.rig.reset_view()
	on_selection()

func enter_decor_mode(on: bool) -> void:
	main.enter_decor(on)
	hud_box.visible = not on
	decor_ui.visible = on
	_selected_decor_item = ""
	if on:
		_rebuild_decor_tray()
	else:
		on_selection()

func _rebuild_decor_tray() -> void:
	UI.clear(decor_tray)
	var inv: Dictionary = Game.state.inventory
	if inv.is_empty():
		decor_tray.add_child(UI.lbl("В инвентаре пусто — купи домики, гамаки или игрушки в магазине!", 19))
		return
	for iid in inv:
		if not Data.ITEMS.has(iid) or int(inv[iid]) <= 0:
			continue
		var it: Dictionary = Data.ITEMS[iid]
		var key: String = iid
		decor_tray.add_child(UI.btn("%s (×%d)" % [it.name, int(inv[key])], it.icon, func():
			_selected_decor_item = key
			main.decor_drag_begin(key)
			decor_info.text = "Нажми на зелёный кружок в клетке, чтобы поставить «%s»" % it.name
			_rebuild_decor_tray(), "accent" if _selected_decor_item == key else "secondary", 68))

func decor_item_menu(sid: String) -> void:
	if _selected_decor_item != "":
		var chk := main.world.can_place(_selected_decor_item, sid)
		if chk.ok:
			var ar: String = main.world.slots[sid].area
			Game.place_item(ar, sid, _selected_decor_item)
			_selected_decor_item = ""
			main.world.show_markers(true)
			_rebuild_decor_tray()
			toast("Предмет установлен в клетку!")
			return
		toast(str(chk.why))
		return

	var it_id := main.world.slot_item(sid)
	if it_id == "":
		return
	var body := _open_modal(Data.ITEMS[it_id].name, Vector2(540, 260))
	var row := UI.hb(10)
	row.add_child(UI.btn("Повернуть", "", func():
		main.decor_rotate(sid)
		_close_modal(), "secondary", 54))
	if Data.ITEMS[it_id].colors.size() > 1:
		row.add_child(UI.btn("Сменить цвет", "", func():
			main.decor_color(sid)
			_close_modal(), "secondary", 54))
	row.add_child(UI.btn("Убрать в инвентарь", "", func():
		var msg := main.decor_remove(sid)
		toast(msg)
		_rebuild_decor_tray()
		_close_modal(), "accent", 54))
	body.add_child(row)
